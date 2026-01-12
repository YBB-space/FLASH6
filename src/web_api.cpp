#include <Arduino.h>
#include <WiFi.h>
#include <LittleFS.h>

#include "config.h"
#include "io.h"
#include "loadcell.h"
#include "state.h"
#include "web_api.h"

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
static bool fsReady = false;

// =======================================================
// =================== FILE SERVE HELPERS =================
// =======================================================
static void serveFile(AsyncWebServerRequest* request, const char* path, const char* contentType) {
  if (!LittleFS.exists(path)) {
    request->send(404, "text/plain", String("File not found: ") + path);
    return;
  }
  request->send(LittleFS, path, contentType);
}

// =======================================================
// ======================= WEB PAGES ======================
// =======================================================
static void handleRoot(AsyncWebServerRequest* request)  { serveFile(request, "/home.html", "text/html; charset=utf-8"); }
static void dashboard(AsyncWebServerRequest* request)   { serveFile(request, "/dashboard.html", "text/html; charset=utf-8"); }
static void overlay(AsyncWebServerRequest* request)     { serveFile(request, "/overlay.html", "text/html; charset=utf-8"); }

// =======================================================
// ====================== JSON OUTPUT =====================
// =======================================================
void buildJson(char* out, size_t outLen, const SampleSnap& s) {
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

static void handleData(AsyncWebServerRequest* request) {
  static char json[768];
  const SampleSnap s = getLastSnapCopy();
  buildJson(json, sizeof(json), s);
  request->send(200, "application/json", json);
}

// =======================================================
// ===================== CORE LOGIC =======================
// =======================================================
static void sendLockedHttp(AsyncWebServerRequest* request) {
  uint8_t mask = 0;
  isLocked(&mask);
  request->send(423, "text/plain", String("LOCKED_REBOOT_REQUIRED RM=") + (int)mask);
}

static void handleSetIGS(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }

  bool anyParam = false;
  String resp;

  if (request->hasParam("igs")) {
    String val = request->getParam("igs")->value();
    portENTER_CRITICAL(&stateMux);
    applySetKV("igs", val);
    int v = igs;
    portEXIT_CRITICAL(&stateMux);
    resp += "IGS=" + String(v);
    anyParam = true;
  }

  if (request->hasParam("rs")) {
    String val = request->getParam("rs")->value();
    portENTER_CRITICAL(&stateMux);
    applySetKV("rs", val);
    int v = relaySafe;
    portEXIT_CRITICAL(&stateMux);
    if (resp.length()) resp += ", ";
    resp += "RS=" + String(v);
    anyParam = true;
  }

  if (request->hasParam("stream")) {
    String val = request->getParam("stream")->value();
    portENTER_CRITICAL(&stateMux);
    applySetKV("stream", val);
    int v = serialStream;
    portEXIT_CRITICAL(&stateMux);
    if (resp.length()) resp += ", ";
    resp += "STREAM=" + String(v);
    anyParam = true;
  }

  if (request->hasParam("safe")) {
    String val = request->getParam("safe")->value();
    portENTER_CRITICAL(&stateMux);
    applySetKV("safe", val);
    int v = safetyMode;
    portEXIT_CRITICAL(&stateMux);
    if (resp.length()) resp += ", ";
    resp += "SAFE=" + String(v);
    anyParam = true;
  }

  if (request->hasParam("ign_ms")) {
    String val = request->getParam("ign_ms")->value();
    portENTER_CRITICAL(&stateMux);
    applySetKV("ign_ms", val);
    uint32_t v = ignitionDurationMs;
    portEXIT_CRITICAL(&stateMux);
    if (resp.length()) resp += ", ";
    resp += "IGN_MS=" + String((uint32_t)v);
    anyParam = true;
  }

  if (request->hasParam("cd_ms")) {
    String val = request->getParam("cd_ms")->value();
    portENTER_CRITICAL(&stateMux);
    applySetKV("cd_ms", val);
    uint32_t v = countdownDurationMs;
    portEXIT_CRITICAL(&stateMux);
    if (resp.length()) resp += ", ";
    resp += "CD_MS=" + String((uint32_t)v);
    anyParam = true;
  }

  if (!anyParam) request->send(400, "text/plain", "NO PARAM");
  else request->send(200, "text/plain", resp);
}

static void handleLauncher(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }
  if (isSafetyOn()) { request->send(403, "text/plain", "SAFETY_MODE"); return; }

  String dir = request->hasParam("dir") ? request->getParam("dir")->value() : "";
  dir.toLowerCase();
  LauncherDir mode = LAUNCHER_STOP;
  if (dir == "up") mode = LAUNCHER_UP;
  else if (dir == "down") mode = LAUNCHER_DOWN;

  setLauncherDir(mode);
  const char* label = (mode == LAUNCHER_UP) ? "UP" : (mode == LAUNCHER_DOWN) ? "DOWN" : "STOP";
  request->send(200, "text/plain", String("LAUNCHER=") + label);
}

static void handleIgnite(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }
  if (isSafetyOn()) { request->send(403, "text/plain", "SAFETY_MODE"); return; }
  const uint32_t now = millis();
  portENTER_CRITICAL(&stateMux);
  startFiringNow(now);
  portEXIT_CRITICAL(&stateMux);
  request->send(200, "text/plain", "IGNITION_IMMEDIATE");
}

static void handleForceIgnite(AsyncWebServerRequest* request) {
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

static void handleCountdownStart(AsyncWebServerRequest* request) {
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

static void handleAbort(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }

  portENTER_CRITICAL(&stateMux);
  setIdleAbort(ABORT_USER);
  portEXIT_CRITICAL(&stateMux);

  fastWrite(rly1, LOW);
  fastWrite(rly2, LOW);
  noTone(piezo);

  request->send(200, "text/plain", "ABORTED");
}

static void handlePrecount(AsyncWebServerRequest* request) {
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

static void handleHelp(AsyncWebServerRequest* request) {
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
<li>/launcher?dir=up|down|stop</li>
<li>/precount?uw=0|1&cd=ms</li>
<li>/loadcell_cal?weight=kgf</li>
<li>/loadcell_zero</li>
</ul>
<a href="/">HOME</a>
</body></html>
)rawliteral";
  request->send(200, "text/html; charset=utf-8", msg);
}

void setupWebServer() {
  WiFi.mode(WIFI_AP);
  WiFi.setSleep(false);
  WiFi.softAP("HANWOOL_DAQ_BOARD", "12345678");

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
  server.on("/graphic_data",    HTTP_GET, handleData);
  server.on("/overlay",         HTTP_GET, overlay);

  server.on("/set",             HTTP_GET, handleSetIGS);
  server.on("/launcher",        HTTP_GET, handleLauncher);
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
}
