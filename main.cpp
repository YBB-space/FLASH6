#include <Arduino.h>
#include "driver/gpio.h"
#include "HX711.h"
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

#include <FS.h>
#include <LittleFS.h>
#include <Preferences.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"

// =======================================================
// ======================= FW INFO =======================
// =======================================================
const char* FW_PROGRAM     = "HANWOOL FLASH";
const char* FW_PROG_VER    = "v6";
const char* FW_PROG_BUILD  = "B0.3";

const char* FW_VER_BUILD   = "FLASH-F v1 · B0";
const char* FW_BOARD       = "ESP32-S3 FLASH-G Board1";
const char* FW_PROTOCOL    = "FLASH JSON v1.0";

// =======================================================
// ======================== PINS =========================
// =======================================================
int piezo        = 11;
int led1         = 4;
int led2         = 5;
int switch1      = 14;
int rly1         = 16;
int rly2         = 17;
int ig_sens      = 21;
int pressure_sig = 7;
int hx711_dt     = 6;
int hx711_clk    = 9;
int ign_adc_pin  = 15;

// =======================================================
// ===================== CONFIG/STATE ====================
// =======================================================
static constexpr float ADC_TO_V = 3.3f / 4095.0f;

// 샘플 루프(스냅샷 갱신) 주기: UI/로깅용
static constexpr uint32_t SAMPLE_PERIOD_MS = 10; // 100Hz 스냅샷
static constexpr uint32_t WS_PERIOD_US     = 12500; // 80Hz WebSocket push

// 로드셀 노이즈 필터
static constexpr uint8_t THRUST_MEDIAN_WINDOW = 5;   // 홀수 권장
static constexpr float THRUST_EMA_ALPHA = 0.2f;      // 0~1, 낮을수록 더 부드러움

// ✅ RelaySafe 오탐 방지: OFF 명령 후 실제 핀 HIGH가 이 시간 이상 지속될 때만 LOCKOUT
static constexpr uint32_t RELAYSAFE_CONFIRM_MS = 120;

// -------------------- igs 모드 --------------------
volatile int igs = 1;

// -------------------- RelaySafe --------------------
// switch가 OFF인데 릴레이 핀이 HIGH(비정상)면 LOCKOUT(재부팅 전까지 해제 불가)
volatile int relaySafe = 1;          // ✅ 기본 ON
volatile int relayFault = 0;         // 0/1 (latched)
volatile uint8_t relayFaultMask = 0; // bit0=rly1, bit1=rly2
volatile uint8_t safetyMode = 0;     // 0/1 (relay inhibit)

// -------------------- (옵션) 시리얼 JSON 스트림 --------------------
volatile int serialStream = 1;       // 1=JSON 계속 출력, 0=출력 중지 (/set?stream=0|1)

// -------------------- 로드셀 --------------------
HX711 hx711;
float thrust_cal_factor = 6510.0f;
volatile float currentThrust = 0.0f;
static constexpr char LOADCELL_PREF_NS[] = "loadcell";
static constexpr char LOADCELL_PREF_SCALE[] = "scale";
static constexpr char LOADCELL_PREF_OFFSET[] = "offset";
static constexpr char LOADCELL_PREF_OFFSET_OK[] = "offset_ok";
Preferences loadcellPrefs;
bool loadcellPrefsReady = false;
long loadcellOffset = 0;
bool loadcellOffsetValid = false;

// -------------------- SoftAP --------------------
const char* ap_ssid     = "HANWOOL_DAQ_BOARD";
const char* ap_password = "12345678";
unsigned long systemStartTime = 0;

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
bool fsReady = false;

// -------------------- 상태 머신 --------------------
enum SystemState : uint8_t { ST_IDLE = 0, ST_COUNTDOWN = 1, ST_FIRING = 2 };
volatile SystemState currentState = ST_IDLE;

volatile uint32_t stateStartTimeMs    = 0;
volatile uint32_t countdownDurationMs = 10000; // 3~30s
volatile uint32_t ignitionDurationMs  = 5000;  // 1~10s

// 🔁 대시보드 동기화 상태
volatile int webUserWaiting = 0;
volatile int webAbortFlag   = 0;
enum AbortReason : uint8_t { ABORT_NONE = 0, ABORT_USER = 1, ABORT_IGNITER = 2, ABORT_LOCKOUT = 3 };
volatile uint8_t webAbortReason = ABORT_NONE;
volatile uint32_t webPrecountMs = 10000;

static portMUX_TYPE stateMux = portMUX_INITIALIZER_UNLOCKED;

// =======================================================
// ====================== FAST IO =========================
// =======================================================
static inline int fastRead(int pin) {
  return gpio_get_level((gpio_num_t)pin);
}
static inline void fastWrite(int pin, int level) {
  gpio_set_level((gpio_num_t)pin, level);
}

// =======================================================
// =================== SAMPLE SNAPSHOT ====================
// =======================================================
struct SampleSnap {
  float t;          // thrust
  float p;          // pressure (V)
  float iv;         // igniter sense (V)
  uint32_t ut;      // uptime ms
  uint16_t lt;      // 샘플 주기(ms)
  uint16_t ct;      // SamplerTask 계산시간(us)
  uint16_t hz;      // HX711 update Hz
  uint8_t  s;       // switch
  uint8_t  ic;      // ign_ok
  uint8_t  r;       // relay mask (bit0=rly1 bit1=rly2)
  uint8_t  gs;      // igs
  uint8_t  st;      // state
  uint16_t cd;      // countdown remaining ms
  uint8_t  uw;      // user waiting
  uint8_t  ab;      // abort flag
  uint8_t  ar;      // abort reason
  uint8_t  m;       // mode (0=SERIAL, 1=WIFI station connected)
  uint8_t  rs;      // relaySafe enabled
  uint8_t  rf;      // relayFault latched (LOCKOUT)
  uint8_t  rm;      // relayFaultMask
  uint8_t  ss;      // serialStream
  uint8_t  sm;      // safety mode
};

static portMUX_TYPE sampleMux = portMUX_INITIALIZER_UNLOCKED;
static SampleSnap lastSnap = {0};

static inline SampleSnap getLastSnapCopy() {
  SampleSnap s;
  portENTER_CRITICAL(&sampleMux);
  s = lastSnap;
  portEXIT_CRITICAL(&sampleMux);
  return s;
}

static inline bool isLocked(uint8_t* outMask = nullptr) {
  bool locked;
  uint8_t mask;
  portENTER_CRITICAL(&stateMux);
  locked = (relayFault != 0);
  mask = relayFaultMask;
  portEXIT_CRITICAL(&stateMux);
  if (outMask) *outMask = mask;
  return locked;
}

static inline bool isSafetyOn() {
  bool on;
  portENTER_CRITICAL(&stateMux);
  on = (safetyMode != 0);
  portEXIT_CRITICAL(&stateMux);
  return on;
}

// =======================================================
// =================== FILE SERVE HELPERS =================
// =======================================================
void serveFile(AsyncWebServerRequest* request, const char* path, const char* contentType) {
  if (!LittleFS.exists(path)) {
    request->send(404, "text/plain", String("File not found: ") + path);
    return;
  }
  request->send(LittleFS, path, contentType);
}

// =======================================================
// ======================= WEB PAGES ======================
// =======================================================
void handleRoot(AsyncWebServerRequest* request)      { serveFile(request, "/home.html",      "text/html; charset=utf-8"); }
void dashboard(AsyncWebServerRequest* request)       { serveFile(request, "/dashboard.html", "text/html; charset=utf-8"); }
void overlay(AsyncWebServerRequest* request)         { serveFile(request, "/overlay.html",   "text/html; charset=utf-8"); }

// =======================================================
// ====================== JSON OUTPUT =====================
// =======================================================
static void buildJson(char* out, size_t outLen, const SampleSnap& s) {
  snprintf(out, outLen,
           "{\"t\":%.3f,\"p\":%.3f,\"iv\":%.3f,\"ut\":%lu,\"lt\":%u,\"ct\":%u,\"hz\":%u,"
           "\"s\":%u,\"ic\":%u,\"r\":%u,\"gs\":%u,"
           "\"st\":%u,\"cd\":%u,\"uw\":%u,\"ab\":%u,\"ar\":%u,\"m\":%u,"
           "\"rs\":%u,\"rf\":%u,\"rm\":%u,\"ss\":%u,\"sm\":%u,"
           "\"fw_program\":\"%s\",\"fw_ver\":\"%s\",\"fw_build\":\"%s\","
           "\"fw_ver_build\":\"%s\",\"fw_board\":\"%s\",\"fw_protocol\":\"%s\"}",
           s.t, s.p, s.iv, (unsigned long)s.ut, (unsigned)s.lt, (unsigned)s.ct, (unsigned)s.hz,
           (unsigned)s.s, (unsigned)s.ic, (unsigned)s.r, (unsigned)s.gs,
           (unsigned)s.st, (unsigned)s.cd, (unsigned)s.uw, (unsigned)s.ab, (unsigned)s.ar, (unsigned)s.m,
           (unsigned)s.rs, (unsigned)s.rf, (unsigned)s.rm, (unsigned)s.ss, (unsigned)s.sm,
           FW_PROGRAM, FW_PROG_VER, FW_PROG_BUILD, FW_VER_BUILD, FW_BOARD, FW_PROTOCOL);
}

void handleData(AsyncWebServerRequest* request) {
  static char json[768];
  const SampleSnap s = getLastSnapCopy();
  buildJson(json, sizeof(json), s);
  request->send(200, "application/json", json);
}

void handleGraphicData(AsyncWebServerRequest* request) {
  static char json[768];
  const SampleSnap s = getLastSnapCopy();
  buildJson(json, sizeof(json), s);
  request->send(200, "application/json", json);
}

// =======================================================
// ===================== CORE LOGIC =======================
// =======================================================
static inline void startCountdownNow(uint32_t now) {
  currentState = ST_COUNTDOWN;
  stateStartTimeMs = now;
  webAbortFlag = 0;
  webAbortReason = ABORT_NONE;
  webUserWaiting = 0;
}

static inline void startFiringNow(uint32_t now) {
  currentState = ST_FIRING;
  stateStartTimeMs = now;
  webAbortFlag = 0;
  webAbortReason = ABORT_NONE;
  webUserWaiting = 0;
}

static inline void setIdleAbort(uint8_t reason) {
  currentState = ST_IDLE;
  webAbortFlag = 1;
  webAbortReason = reason;
  webUserWaiting = 0;
}

static inline void applySetKV(const String& key, const String& val) {
  if (key == "igs") {
    int v = val.toInt();
    v = (v != 0) ? 1 : 0;
    igs = v;
  } else if (key == "rs") {
    int v = val.toInt();
    v = (v != 0) ? 1 : 0;
    relaySafe = v;
  } else if (key == "stream") {
    int v = val.toInt();
    v = (v != 0) ? 1 : 0;
    serialStream = v;
  } else if (key == "safe") {
    int v = val.toInt();
    v = (v != 0) ? 1 : 0;
    safetyMode = (uint8_t)v;
  } else if (key == "ign_ms") {
    long v = val.toInt();
    if (v < 1000)  v = 1000;
    if (v > 10000) v = 10000;
    ignitionDurationMs = (uint32_t)v;
  } else if (key == "cd_ms") {
    long v = val.toInt();
    if (v < 3000)  v = 3000;
    if (v > 30000) v = 30000;
    countdownDurationMs = (uint32_t)v;
    if (webUserWaiting == 0) webPrecountMs = (uint32_t)v;
  }
}

static inline void applyQueryLike(const String& queryPart) {
  int start = 0;
  while (start < (int)queryPart.length()) {
    int amp = queryPart.indexOf('&', start);
    if (amp < 0) amp = queryPart.length();
    String pair = queryPart.substring(start, amp);
    int eq = pair.indexOf('=');
    if (eq > 0) {
      String k = pair.substring(0, eq);
      String v = pair.substring(eq + 1);
      k.trim(); v.trim();
      applySetKV(k, v);
    }
    start = amp + 1;
  }
}

// =======================================================
// ===================== API HANDLERS =====================
// =======================================================
static inline void sendLockedHttp(AsyncWebServerRequest* request) {
  uint8_t mask = 0;
  isLocked(&mask);
  request->send(423, "text/plain", String("LOCKED_REBOOT_REQUIRED RM=") + (int)mask);
}

void handleSetIGS(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }

  bool anyParam = false;
  String resp;

  if (request->hasParam("igs")) {
    int v = request->getParam("igs")->value().toInt();
    v = (v != 0) ? 1 : 0;
    portENTER_CRITICAL(&stateMux);
    igs = v;
    portEXIT_CRITICAL(&stateMux);
    resp += "IGS=" + String(v);
    anyParam = true;
  }

  if (request->hasParam("rs")) {
    int v = request->getParam("rs")->value().toInt();
    v = (v != 0) ? 1 : 0;
    portENTER_CRITICAL(&stateMux);
    relaySafe = v;
    portEXIT_CRITICAL(&stateMux);
    if (resp.length()) resp += ", ";
    resp += "RS=" + String(v);
    anyParam = true;
  }

  if (request->hasParam("stream")) {
    int v = request->getParam("stream")->value().toInt();
    v = (v != 0) ? 1 : 0;
    portENTER_CRITICAL(&stateMux);
    serialStream = v;
    portEXIT_CRITICAL(&stateMux);
    if (resp.length()) resp += ", ";
    resp += "STREAM=" + String(v);
    anyParam = true;
  }

  if (request->hasParam("safe")) {
    int v = request->getParam("safe")->value().toInt();
    v = (v != 0) ? 1 : 0;
    portENTER_CRITICAL(&stateMux);
    safetyMode = (uint8_t)v;
    portEXIT_CRITICAL(&stateMux);
    if (resp.length()) resp += ", ";
    resp += "SAFE=" + String(v);
    anyParam = true;
  }

  if (request->hasParam("ign_ms")) {
    long v = request->getParam("ign_ms")->value().toInt();
    if (v < 1000)  v = 1000;
    if (v > 10000) v = 10000;

    portENTER_CRITICAL(&stateMux);
    ignitionDurationMs = (uint32_t)v;
    portEXIT_CRITICAL(&stateMux);

    if (resp.length()) resp += ", ";
    resp += "IGN_MS=" + String((uint32_t)v);
    anyParam = true;
  }

  if (request->hasParam("cd_ms")) {
    long v = request->getParam("cd_ms")->value().toInt();
    if (v < 3000)  v = 3000;
    if (v > 30000) v = 30000;

    portENTER_CRITICAL(&stateMux);
    countdownDurationMs = (uint32_t)v;
    if (webUserWaiting == 0) webPrecountMs = (uint32_t)v;
    portEXIT_CRITICAL(&stateMux);

    if (resp.length()) resp += ", ";
    resp += "CD_MS=" + String((uint32_t)v);
    anyParam = true;
  }

  if (!anyParam) request->send(400, "text/plain", "NO PARAM");
  else request->send(200, "text/plain", resp);
}

void handleIgnite(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }
  if (isSafetyOn()) { request->send(403, "text/plain", "SAFETY_MODE"); return; }
  const uint32_t now = millis();
  portENTER_CRITICAL(&stateMux);
  startFiringNow(now);
  portEXIT_CRITICAL(&stateMux);
  request->send(200, "text/plain", "IGNITION_IMMEDIATE");
}

void handleForceIgnite(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }
  if (isSafetyOn()) { request->send(403, "text/plain", "SAFETY_MODE"); return; }
  const SampleSnap s = getLastSnapCopy();
  if (igs && s.ic == 0) {
    request->send(403, "text/plain", "IGNITER_REQUIRED");
    return;
  }
  const uint32_t now = millis();
  portENTER_CRITICAL(&stateMux);
  startFiringNow(now);
  portEXIT_CRITICAL(&stateMux);
  request->send(200, "text/plain", "FORCE_IGNITION_OK");
}

void handleCountdownStart(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }
  if (isSafetyOn()) { request->send(403, "text/plain", "SAFETY_MODE"); return; }
  const uint32_t now = millis();
  bool ok = false;
  portENTER_CRITICAL(&stateMux);
  if (currentState == ST_IDLE) {
    startCountdownNow(now);
    ok = true;
  }
  portEXIT_CRITICAL(&stateMux);

  if (ok) request->send(200, "text/plain", "COUNTDOWN_STARTED");
  else    request->send(400, "text/plain", "BUSY");
}

void handleAbort(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }

  portENTER_CRITICAL(&stateMux);
  setIdleAbort(ABORT_USER);
  portEXIT_CRITICAL(&stateMux);

  fastWrite(rly1, LOW);
  fastWrite(rly2, LOW);
  noTone(piezo);

  request->send(200, "text/plain", "ABORTED");
}

void handlePrecount(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }
  if (isSafetyOn()) { request->send(403, "text/plain", "SAFETY_MODE"); return; }

  if (!request->hasParam("uw")) {
    request->send(400, "text/plain", "NO PARAM");
    return;
  }

  int v = request->getParam("uw")->value().toInt();
  v = (v != 0) ? 1 : 0;

  portENTER_CRITICAL(&stateMux);
  webUserWaiting = v;

  if (request->hasParam("cd")) {
    long cdVal = request->getParam("cd")->value().toInt();
    if (cdVal < 0) cdVal = 0;
    if (cdVal > 30000) cdVal = 30000;
    webPrecountMs = (uint32_t)cdVal;
  } else {
    if (webUserWaiting == 1 && webPrecountMs == 0) webPrecountMs = countdownDurationMs;
    if (webUserWaiting == 0) webPrecountMs = 0;
  }

  uint32_t cd = webPrecountMs;
  int uw = webUserWaiting;
  portEXIT_CRITICAL(&stateMux);

  request->send(200, "text/plain", String("UW=") + uw + ", CD=" + cd);
}

void handleLoadcellCal(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }

  if (!request->hasParam("weight")) {
    request->send(400, "text/plain", "NO_PARAM");
    return;
  }

  const float weight = request->getParam("weight")->value().toFloat();
  if (weight <= 0.0f || isnan(weight) || isinf(weight)) {
    request->send(400, "text/plain", "INVALID_WEIGHT");
    return;
  }
  if (!loadcellPrefsReady) {
    request->send(500, "text/plain", "PREFS_NOT_READY");
    return;
  }

  const uint32_t start = millis();
  while (!hx711.is_ready() && (millis() - start) < 800) { delay(5); }
  if (!hx711.is_ready()) {
    request->send(503, "text/plain", "HX711_NOT_READY");
    return;
  }

  const long raw = hx711.get_value(10);
  if (raw == 0) {
    request->send(500, "text/plain", "RAW_ZERO");
    return;
  }

  const float newScale = ((float)raw) / weight;
  if (newScale == 0.0f || isnan(newScale) || isinf(newScale)) {
    request->send(500, "text/plain", "INVALID_SCALE");
    return;
  }

  thrust_cal_factor = newScale;
  hx711.set_scale(thrust_cal_factor);
  loadcellPrefs.putFloat(LOADCELL_PREF_SCALE, thrust_cal_factor);

  request->send(200, "text/plain", String("SCALE=") + String(thrust_cal_factor, 6));
}

void handleLoadcellZero(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }
  if (!loadcellPrefsReady) {
    request->send(500, "text/plain", "PREFS_NOT_READY");
    return;
  }

  const uint32_t start = millis();
  while (!hx711.is_ready() && (millis() - start) < 800) { delay(5); }
  if (!hx711.is_ready()) {
    request->send(503, "text/plain", "HX711_NOT_READY");
    return;
  }

  hx711.tare(15);
  loadcellOffset = hx711.get_offset();
  loadcellOffsetValid = true;
  loadcellPrefs.putLong(LOADCELL_PREF_OFFSET, loadcellOffset);
  loadcellPrefs.putBool(LOADCELL_PREF_OFFSET_OK, true);

  request->send(200, "text/plain", String("OFFSET=") + String(loadcellOffset));
}

void handleHelp(AsyncWebServerRequest* request) {
  static const char msg[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>HANWOOL TMS 도움말</title></head>
<body style="font-family:system-ui;padding:18px">
<h2>HANWOOL TMS HELP</h2>
<ul>
<li>/data</li>
<li>/graphic_data</li>
<li>/dashboard</li>
<li>/countdown_start</li>
<li>/ignite</li>
<li>/force_ignite</li>
<li>/abort</li>
<li>/set?igs=0|1</li>
<li>/set?rs=0|1</li>
<li>/set?safe=0|1</li>
<li>/set?stream=0|1</li>
<li>/set?ign_ms=1000~10000</li>
<li>/set?cd_ms=3000~30000</li>
<li>/precount?uw=0|1&cd=ms</li>
<li>/loadcell_cal?weight=kgf</li>
<li>/loadcell_zero</li>
</ul>
<a href="/">HOME</a>
</body></html>
)rawliteral";
  request->send(200, "text/html; charset=utf-8", msg);
}

// =======================================================
// ===================== SERIAL CMD =======================
// =======================================================
static void serialReply(const String& s) {
  Serial.print("ACK ");
  Serial.println(s);
}
static void serialErr(const String& s) {
  Serial.print("ERR ");
  Serial.println(s);
}

static void handleSerialCommand(String line) {
  line.trim();
  if (line.length() == 0) return;

  if (!line.startsWith("/")) return;

  uint8_t mask = 0;
  if (isLocked(&mask)) {
    serialErr(String("LOCKED_REBOOT_REQUIRED RM=") + (int)mask);
    return;
  }

  const uint32_t now = millis();

  if (line.startsWith("/set")) {
    int q = line.indexOf('?');
    if (q < 0 || q == (int)line.length() - 1) { serialErr("NO_QUERY"); return; }
    String query = line.substring(q + 1);
    portENTER_CRITICAL(&stateMux);
    applyQueryLike(query);
    portEXIT_CRITICAL(&stateMux);
    serialReply("SET_OK");
    return;
  }

  if (line.startsWith("/countdown_start")) {
    if (isSafetyOn()) {
      serialErr("SAFETY_MODE");
      return;
    }
    bool ok = false;
    portENTER_CRITICAL(&stateMux);
    if (currentState == ST_IDLE) { startCountdownNow(now); ok = true; }
    portEXIT_CRITICAL(&stateMux);
    if (ok) serialReply("COUNTDOWN_STARTED");
    else serialErr("BUSY");
    return;
  }

  if (line.startsWith("/ignite")) {
    if (isSafetyOn()) {
      serialErr("SAFETY_MODE");
      return;
    }
    portENTER_CRITICAL(&stateMux);
    startFiringNow(now);
    portEXIT_CRITICAL(&stateMux);
    serialReply("IGNITION_IMMEDIATE");
    return;
  }

  if (line.startsWith("/force_ignite")) {
    if (isSafetyOn()) {
      serialErr("SAFETY_MODE");
      return;
    }
    const SampleSnap s = getLastSnapCopy();
    if (igs && s.ic == 0) {
      serialErr("IGNITER_REQUIRED");
      return;
    }
    portENTER_CRITICAL(&stateMux);
    startFiringNow(now);
    portEXIT_CRITICAL(&stateMux);
    serialReply("FORCE_IGNITION_OK");
    return;
  }

  if (line.startsWith("/abort")) {
    portENTER_CRITICAL(&stateMux);
    setIdleAbort(ABORT_USER);
    portEXIT_CRITICAL(&stateMux);
    fastWrite(rly1, LOW);
    fastWrite(rly2, LOW);
    noTone(piezo);
    serialReply("ABORTED");
    return;
  }

  if (line.startsWith("/precount")) {
    if (isSafetyOn()) {
      serialErr("SAFETY_MODE");
      return;
    }
    int q = line.indexOf('?');
    if (q < 0) { serialErr("NO_QUERY"); return; }
    String query = line.substring(q + 1);
    int uwPos = query.indexOf("uw=");
    if (uwPos < 0) { serialErr("NO_UW"); return; }

    int uwVal = 0;
    {
      int start = uwPos + 3;
      int end = query.indexOf('&', start);
      if (end < 0) end = query.length();
      uwVal = query.substring(start, end).toInt();
      uwVal = (uwVal != 0) ? 1 : 0;
    }

    uint32_t cdVal = 0;
    int cdPos = query.indexOf("cd=");
    if (cdPos >= 0) {
      int start = cdPos + 3;
      int end = query.indexOf('&', start);
      if (end < 0) end = query.length();
      long tmp = query.substring(start, end).toInt();
      if (tmp < 0) tmp = 0;
      if (tmp > 30000) tmp = 30000;
      cdVal = (uint32_t)tmp;
    }

    portENTER_CRITICAL(&stateMux);
    webUserWaiting = uwVal;
    if (cdPos >= 0) {
      webPrecountMs = cdVal;
    } else {
      if (webUserWaiting == 1 && webPrecountMs == 0) webPrecountMs = countdownDurationMs;
      if (webUserWaiting == 0) webPrecountMs = 0;
    }
    uint32_t cd = webPrecountMs;
    int uw = webUserWaiting;
    portEXIT_CRITICAL(&stateMux);

    serialReply(String("UW=") + uw + " CD=" + cd);
    return;
  }

  serialErr("UNKNOWN_CMD");
}

static void pollSerialCommands() {
  static String buf;
  static uint32_t lastRxMs = 0;

  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    lastRxMs = millis();

    // ✅ CR/LF 둘 다 종료로 인정
    if (c == '\n' || c == '\r') {
      if (buf.length() > 0) handleSerialCommand(buf);
      buf = "";
    } else {
      if (buf.length() < 240) buf += c;
    }
  }

  // ✅ "줄바꿈 없음(No line ending)"에서도 동작하도록 타임아웃 처리
  // (Serial Monitor는 보통 Send 누르면 한번에 다 들어오니 60ms면 충분)
  if (buf.length() > 0 && buf[0] == '/') {
    if (millis() - lastRxMs >= 60) {
      handleSerialCommand(buf);
      buf = "";
    }
  }
}

// =======================================================
// =================== LOADCELL FILTER ===================
// =======================================================
static float medianOf(const float* buf, uint8_t n) {
  float tmp[THRUST_MEDIAN_WINDOW];
  for (uint8_t i = 0; i < n; ++i) tmp[i] = buf[i];

  for (uint8_t i = 1; i < n; ++i) {
    float key = tmp[i];
    int8_t j = (int8_t)i - 1;
    while (j >= 0 && tmp[j] > key) {
      tmp[j + 1] = tmp[j];
      --j;
    }
    tmp[j + 1] = key;
  }
  return tmp[n / 2];
}

// =======================================================
// ===================== TASK: SAMPLER ===================
// =======================================================
static void SamplerTask(void* arg) {
  (void)arg;

  const TickType_t periodTicks = pdMS_TO_TICKS(SAMPLE_PERIOD_MS);
  TickType_t lastWake = xTaskGetTickCount();

  uint64_t lastWakeUs = esp_timer_get_time();

  uint32_t hzWindowStartMs = millis();
  uint32_t thrustCount = 0;
  uint16_t thrustHz = 0;

  float thrustBuf[THRUST_MEDIAN_WINDOW] = {0};
  uint8_t thrustBufCount = 0;
  uint8_t thrustBufIndex = 0;
  float thrustEma = 0.0f;
  bool thrustEmaInit = false;

  uint8_t modeWifi = 0;
  uint32_t lastStaCheckMs = 0;

  for (;;) {
    vTaskDelayUntil(&lastWake, periodTicks);

    const uint32_t nowMs = millis();

    const uint64_t nowWakeUs = esp_timer_get_time();
    const uint32_t periodUs  = (uint32_t)(nowWakeUs - lastWakeUs);
    lastWakeUs = nowWakeUs;

    uint16_t ltMs = (uint16_t)((periodUs + 500ULL) / 1000ULL);
    if (ltMs == 0) ltMs = 1;
    if (ltMs > 1000) ltMs = 1000;

    const uint64_t calcStartUs = esp_timer_get_time();

    if (hx711.is_ready()) {
      float v = hx711.get_units(1);
      if (!isnan(v) && !isinf(v)) {
        if (thrustBufCount < THRUST_MEDIAN_WINDOW) {
          thrustBuf[thrustBufCount++] = v;
        } else {
          thrustBuf[thrustBufIndex] = v;
          thrustBufIndex = (uint8_t)((thrustBufIndex + 1) % THRUST_MEDIAN_WINDOW);
        }

        float med = medianOf(thrustBuf, thrustBufCount);
        if (!thrustEmaInit) {
          thrustEma = med;
          thrustEmaInit = true;
        } else {
          thrustEma += THRUST_EMA_ALPHA * (med - thrustEma);
        }
        currentThrust = thrustEma;
      }
      thrustCount++;
    }

    const uint32_t elapsedHzMs = nowMs - hzWindowStartMs;
    if (elapsedHzMs >= 1000) {
      float hzF = (elapsedHzMs > 0) ? (thrustCount * 1000.0f / elapsedHzMs) : 0.0f;
      if (hzF < 0) hzF = 0;
      if (hzF > 500) hzF = 500;
      thrustHz = (uint16_t)(hzF + 0.5f);

      hzWindowStartMs = nowMs;
      thrustCount = 0;
    }

    const float pV   = analogRead(pressure_sig) * ADC_TO_V;
    const float ignV = analogRead(ign_adc_pin) * ADC_TO_V;

    const uint8_t sw = (uint8_t)fastRead(switch1);

    uint8_t relayMask = 0;
    relayMask |= (fastRead(rly1) ? 1 : 0);
    relayMask |= (fastRead(rly2) ? 2 : 0);

    uint8_t st, uw, ab, ar, gsLocal, rsLocal, rfLocal, rmLocal, ssLocal, smLocal;
    uint32_t ss, cdDur;
    uint32_t cd = 0;

    portENTER_CRITICAL(&stateMux);
    st = (uint8_t)currentState;
    uw = (uint8_t)webUserWaiting;
    ab = (uint8_t)webAbortFlag;
    ar = (uint8_t)webAbortReason;
    gsLocal = (uint8_t)igs;
    rsLocal = (uint8_t)relaySafe;
    rfLocal = (uint8_t)relayFault;
    rmLocal = (uint8_t)relayFaultMask;
    ssLocal = (uint8_t)serialStream;
    smLocal = (uint8_t)safetyMode;

    ss = stateStartTimeMs;
    cdDur = countdownDurationMs;

    if (st == ST_COUNTDOWN) {
      uint32_t elapsed = nowMs - ss;
      cd = (elapsed < cdDur) ? (cdDur - elapsed) : 0;
    } else if (st == ST_IDLE && uw == 1) {
      cd = webPrecountMs;
    } else {
      cd = 0;
    }
    portEXIT_CRITICAL(&stateMux);

    if (cd > 30000) cd = 30000;

    bool ign_ok = (ignV < 0.5f);

    if ((nowMs - lastStaCheckMs) >= 200) {
      lastStaCheckMs = nowMs;
      modeWifi = (WiFi.softAPgetStationNum() > 0) ? 1 : 0;
    }

    const uint64_t calcEndUs = esp_timer_get_time();
    uint32_t ctUs = (uint32_t)(calcEndUs - calcStartUs);
    if (ctUs > 65535) ctUs = 65535;

    SampleSnap snap;
    snap.t  = (isnan(currentThrust) || isinf(currentThrust)) ? 0.0f : currentThrust;
    snap.p  = (isnan(pV) || isinf(pV)) ? 0.0f : pV;
    snap.iv = (isnan(ignV) || isinf(ignV)) ? 0.0f : ignV;
    snap.ut = nowMs - systemStartTime;
    snap.lt = ltMs;
    snap.ct = (uint16_t)ctUs;
    snap.hz = thrustHz;

    snap.s  = sw ? 1 : 0;
    snap.ic = ign_ok ? 1 : 0;
    snap.r  = relayMask;
    snap.gs = gsLocal;
    snap.st = st;
    snap.cd = (uint16_t)cd;
    snap.uw = uw;
    snap.ab = ab;
    snap.ar = ar;
    snap.m  = modeWifi;

    snap.rs = rsLocal;
    snap.rf = rfLocal;
    snap.rm = rmLocal;
    snap.ss = ssLocal;
    snap.sm = smLocal;

    portENTER_CRITICAL(&sampleMux);
    lastSnap = snap;
    portEXIT_CRITICAL(&sampleMux);
  }
}

// =======================================================
// =================== TASK: WS PUSH =====================
// =======================================================
static void WebSocketTask(void* arg) {
  (void)arg;

  uint32_t lastSendUs = micros();
  uint32_t lastCleanupMs = millis();

  for (;;) {
    const uint32_t nowUs = micros();
    if ((uint32_t)(nowUs - lastSendUs) >= WS_PERIOD_US) {
      lastSendUs += WS_PERIOD_US;
      if ((uint32_t)(nowUs - lastSendUs) >= WS_PERIOD_US) lastSendUs = nowUs;

      if (ws.count() > 0) {
        static char json[768];
        const SampleSnap s = getLastSnapCopy();
        buildJson(json, sizeof(json), s);
        const AsyncWebSocket::SendStatus st = ws.textAll(json);
        if (st != AsyncWebSocket::ENQUEUED) {
          ws.cleanupClients();
        }
      }
    }

    const uint32_t nowMs = millis();
    if ((uint32_t)(nowMs - lastCleanupMs) >= 250U) {
      lastCleanupMs = nowMs;
      ws.cleanupClients();
    }

    vTaskDelay(pdMS_TO_TICKS(1));
  }
}

// =======================================================
// ===================== TASK: CONTROL ===================
// =======================================================
static void ControlTask(void* arg) {
  (void)arg;

  uint32_t lastBeepTime = 0;
  bool beepToggle = false;
  int lastCdBeepSec = -1;

  bool relayOn = false;  // ✅ "명령한" 릴레이 상태(ON/OFF)
  bool toneOn  = false;

  auto setRelays = [&](bool on) {
    if (relayOn == on) return;
    relayOn = on;
    fastWrite(rly1, on ? HIGH : LOW);
    fastWrite(rly2, on ? HIGH : LOW);
  };

  auto stopTone = [&]() {
    if (!toneOn) return;
    toneOn = false;
    noTone(piezo);
  };

  uint32_t lastBlinkMs = 0;
  bool blinkPhase = false;

  // ✅ RelaySafe 오탐 방지용 지속시간 체크
  uint32_t offMismatchSinceMs = 0;

  TickType_t lastWake = xTaskGetTickCount();

  for (;;) {
    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(5));

    const uint32_t now = millis();
    const SampleSnap s = getLastSnapCopy();

    // ---- 최신 설정/상태 읽기 ----
    uint8_t rsLocal = 0;
    uint8_t rfLocal = 0;
    uint8_t smLocal = 0;

    SystemState st;
    uint32_t stStart, ignDur, cdDur;
    int ab;
    int uwLocal = 0;

    portENTER_CRITICAL(&stateMux);
    rsLocal = (uint8_t)relaySafe;
    rfLocal = (uint8_t)relayFault;
    smLocal = (uint8_t)safetyMode;

    st = currentState;
    stStart = stateStartTimeMs;
    ignDur = ignitionDurationMs;
    cdDur  = countdownDurationMs;
    ab = webAbortFlag;
    uwLocal = webUserWaiting;
    portEXIT_CRITICAL(&stateMux);

    // ✅ 스위치는 스냅샷 말고 "직접" 읽어서 전환 순간 오탐/지연 제거
    const bool swNow = (fastRead(switch1) != 0);

    // ---- LOCKOUT 모드(래치) ----
    if (rfLocal == 1) {
      setRelays(false);

      if (now - lastBlinkMs >= 220) {
        lastBlinkMs = now;
        blinkPhase = !blinkPhase;
        fastWrite(led1, blinkPhase ? HIGH : LOW);
        fastWrite(led2, blinkPhase ? LOW  : HIGH);
      }

      if (now - lastBeepTime >= 200) {
        lastBeepTime = now;
        beepToggle = !beepToggle;
        tone(piezo, beepToggle ? 2000 : 1200, 160);
        toneOn = true;
      }

      continue;
    }

    // ---- SAFETY MODE (릴레이 차단) ----
    if (smLocal == 1) {
      if (st != ST_IDLE || uwLocal == 1) {
        portENTER_CRITICAL(&stateMux);
        setIdleAbort(ABORT_USER);
        portEXIT_CRITICAL(&stateMux);
      }
      setRelays(false);
      stopTone();
      fastWrite(led1, LOW);
      fastWrite(led2, HIGH);
      continue;
    }

    // 정상 모드 LED
    fastWrite(led1, (s.ic == 1) ? HIGH : LOW);
    fastWrite(led2, HIGH);

    // ---- 상태 머신 ----
    if (st == ST_IDLE) {
      if (swNow) {
        if (relayOn || s.ic == 1) {
          setRelays(true);
          if (now - lastBeepTime >= 140) {
            lastBeepTime = now;
            beepToggle = !beepToggle;
            tone(piezo, beepToggle ? 1800 : 1400, 120);
            toneOn = true;
          }
        } else {
          setRelays(false);
          if (now - lastBeepTime > 200) {
            lastBeepTime = now;
            tone(piezo, 300, 100);
            toneOn = true;
          }
        }
      } else {
        setRelays(false);
        stopTone();
        if (s.gs == 1 && s.ic == 1) {
          if (now - lastBeepTime >= 1500) {
            lastBeepTime = now;
            tone(piezo, 750, 120);
            toneOn = true;
          }
        }
      }
    }
    else if (st == ST_COUNTDOWN) {
      setRelays(false);
      stopTone();

      const int32_t remainMs = (int32_t)cdDur - (int32_t)(now - stStart);
      if (remainMs > 0 && remainMs <= 10000) {
        int sec = (int)((remainMs + 999) / 1000);
        if (sec != lastCdBeepSec) {
          lastCdBeepSec = sec;
          tone(piezo, 900, 80);
          toneOn = true;
        }
      }

      if (igs && !s.ic) {
        portENTER_CRITICAL(&stateMux);
        setIdleAbort(ABORT_IGNITER);
        portEXIT_CRITICAL(&stateMux);
      }
      else if (ab) {
        portENTER_CRITICAL(&stateMux);
        currentState = ST_IDLE;
        portEXIT_CRITICAL(&stateMux);
      }
      else if (now - stStart >= cdDur) {
        portENTER_CRITICAL(&stateMux);
        currentState = ST_FIRING;
        stateStartTimeMs = now;
        portEXIT_CRITICAL(&stateMux);
      }
    }
    else if (st == ST_FIRING) {
      lastCdBeepSec = -1;
      if (ab || (now - stStart >= ignDur)) {
        portENTER_CRITICAL(&stateMux);
        currentState = ST_IDLE;
        portEXIT_CRITICAL(&stateMux);

        setRelays(false);
        stopTone();
      } else {
        setRelays(true);
        if (now - lastBeepTime >= 140) {
          lastBeepTime = now;
          beepToggle = !beepToggle;
          tone(piezo, beepToggle ? 1800 : 1400, 120);
          toneOn = true;
        }
      }
    }
    else {
      lastCdBeepSec = -1;
    }

    // ===================================================
    // ✅ RelaySafe(오탐 방지 버전)
    //   - "릴레이를 OFF로 명령했는데도"
    //   - 실제 핀 레벨이 HIGH가 "RELAYSAFE_CONFIRM_MS 이상" 지속되면 LOCKOUT 래치
    // ===================================================
    if (rsLocal == 1) {
      const uint8_t actualMask =
        (fastRead(rly1) ? 1 : 0) |
        (fastRead(rly2) ? 2 : 0);

      const bool shouldBeOff = (!relayOn); // 우리가 OFF 명령 중인 상태

      if (shouldBeOff && actualMask != 0) {
        if (offMismatchSinceMs == 0) offMismatchSinceMs = now;

        if ((now - offMismatchSinceMs) >= RELAYSAFE_CONFIRM_MS) {
          // LOCKOUT 래치
          portENTER_CRITICAL(&stateMux);
          relayFault = 1;
          relayFaultMask = actualMask;

          currentState = ST_IDLE;
          webAbortFlag = 1;
          webAbortReason = ABORT_LOCKOUT;
          webUserWaiting = 0;
          portEXIT_CRITICAL(&stateMux);

          // 즉시 안전 상태
          setRelays(false);
          stopTone();
        }
      } else {
        offMismatchSinceMs = 0;
      }
    } else {
      offMismatchSinceMs = 0;
    }
  }
}

// =======================================================
// ========================= SETUP ========================
// =======================================================
void setup() {
  Serial.begin(460800);

  pinMode(led1, OUTPUT);
  pinMode(led2, OUTPUT);
  pinMode(rly1, OUTPUT);
  pinMode(rly2, OUTPUT);
  pinMode(switch1, INPUT);   // 필요하면 INPUT_PULLUP 고려(배선에 따라)
  pinMode(ig_sens, INPUT);
  pinMode(piezo, OUTPUT);

  pinMode(pressure_sig, INPUT);
  pinMode(ign_adc_pin, INPUT);

  analogReadResolution(12);

  loadcellPrefsReady = loadcellPrefs.begin(LOADCELL_PREF_NS, false);
  if (loadcellPrefsReady) {
    const float storedScale = loadcellPrefs.getFloat(LOADCELL_PREF_SCALE, NAN);
    if (!isnan(storedScale) && !isinf(storedScale) && storedScale != 0.0f) {
      thrust_cal_factor = storedScale;
      Serial.printf("[CAL] Loaded scale: %.6f\n", thrust_cal_factor);
    } else {
      Serial.println("[CAL] Scale default");
    }
    loadcellOffsetValid = loadcellPrefs.getBool(LOADCELL_PREF_OFFSET_OK, false);
    if (loadcellOffsetValid) {
      loadcellOffset = loadcellPrefs.getLong(LOADCELL_PREF_OFFSET, 0);
      Serial.printf("[CAL] Loaded offset: %ld\n", loadcellOffset);
    }
  } else {
    Serial.println("[CAL] Prefs begin failed");
  }

  hx711.begin(hx711_dt, hx711_clk);
  hx711.set_gain(128);
  hx711.set_scale(thrust_cal_factor);
  if (loadcellOffsetValid) {
    hx711.set_offset(loadcellOffset);
  } else {
    hx711.tare();
    loadcellOffset = hx711.get_offset();
    loadcellOffsetValid = true;
    if (loadcellPrefsReady) {
      loadcellPrefs.putLong(LOADCELL_PREF_OFFSET, loadcellOffset);
      loadcellPrefs.putBool(LOADCELL_PREF_OFFSET_OK, true);
    }
  }

  digitalWrite(led2, HIGH);

  WiFi.mode(WIFI_AP);
  WiFi.setSleep(false);
  WiFi.softAP(ap_ssid, ap_password);

  if (!LittleFS.begin(false)) {
    Serial.println("[LittleFS] mount failed");
    fsReady = false;
  } else {
    Serial.println("[LittleFS] mounted");
    fsReady = true;
  }

  server.serveStatic("/img/", LittleFS, "/img/");
  server.serveStatic("/dashboard.js", LittleFS, "/dashboard.js");

  server.on("/",                HTTP_GET, handleRoot);
  server.on("/help",            HTTP_GET, handleHelp);
  server.on("/dashboard",       HTTP_GET, dashboard);
  server.on("/data",            HTTP_GET, handleData);
  server.on("/graphic_data",    HTTP_GET, handleGraphicData);
  server.on("/overlay",         HTTP_GET, overlay);

  server.on("/set",             HTTP_GET, handleSetIGS);
  server.on("/ignite",          HTTP_GET, handleIgnite);
  server.on("/force_ignite",    HTTP_GET, handleForceIgnite);
  server.on("/abort",           HTTP_GET, handleAbort);
  server.on("/countdown_start", HTTP_GET, handleCountdownStart);
  server.on("/precount",        HTTP_GET, handlePrecount);
  server.on("/loadcell_cal",    HTTP_GET, handleLoadcellCal);
  server.on("/loadcell_zero",   HTTP_GET, handleLoadcellZero);

  ws.onEvent([](AsyncWebSocket*,
                AsyncWebSocketClient* client,
                AwsEventType type,
                void*,
                uint8_t*,
                size_t) {
    if (type == WS_EVT_CONNECT) {
      client->setCloseClientOnQueueFull(true);
      client->keepAlivePeriod(2);
      ws.cleanupClients();
      if (client->canSend()) {
        static char json[768];
        const SampleSnap s = getLastSnapCopy();
        buildJson(json, sizeof(json), s);
        client->text(json);
      }
      Serial.printf("[WS] Client #%u connected\n", client->id());
    } else if (type == WS_EVT_DISCONNECT) {
      Serial.printf("[WS] Client #%u disconnected\n", client->id());
    }
  });
  server.addHandler(&ws);

  server.begin();

  tone(piezo, 900, 120);  delay(180);
  tone(piezo, 1300, 160); delay(220);
  tone(piezo, 1700, 200); delay(260);
  noTone(piezo);

  systemStartTime = millis();

  portENTER_CRITICAL(&stateMux);
  webPrecountMs = countdownDurationMs;
  portEXIT_CRITICAL(&stateMux);

  const BaseType_t CORE_APP = 1;
  xTaskCreatePinnedToCore(SamplerTask, "SamplerTask", 4096, nullptr, 2, nullptr, CORE_APP);
  xTaskCreatePinnedToCore(ControlTask, "ControlTask", 4096, nullptr, 3, nullptr, CORE_APP);
  xTaskCreatePinnedToCore(WebSocketTask, "WebSocketTask", 4096, nullptr, 2, nullptr, CORE_APP);

  Serial.println("[BOOT] Ready.");
}

// =======================================================
// ========================== LOOP ========================
// =======================================================
void loop() {
  pollSerialCommands();

  // JSON 스트림은 필요할 때만 (Serial Monitor로 조작할 땐 /set?stream=0 추천)
  static uint32_t lastPrintMs = 0;
  const uint32_t now = millis();
  if (serialStream == 1 && (now - lastPrintMs) >= 12) { // ~80Hz
    lastPrintMs = now;
    static char json[768];
    const SampleSnap s = getLastSnapCopy();
    buildJson(json, sizeof(json), s);
    Serial.println(json);
  }

  delay(0);
}
