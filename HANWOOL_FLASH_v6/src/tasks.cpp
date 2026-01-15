#include <Arduino.h>
#include <WiFi.h>
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "config.h"
#include "io.h"
#include "loadcell.h"
#include "state.h"
#include "tasks.h"
#include "web_api.h"

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

  if (line.startsWith("/launcher")) {
    if (isSafetyOn()) { serialErr("SAFETY_MODE"); return; }
    String dir = "";
    int q = line.indexOf('?');
    if (q >= 0 && q < (int)line.length() - 1) {
      String query = line.substring(q + 1);
      int dPos = query.indexOf("dir=");
      if (dPos >= 0) {
        int amp = query.indexOf('&', dPos);
        String val = (amp >= 0) ? query.substring(dPos + 4, amp) : query.substring(dPos + 4);
        val.trim();
        dir = val;
      }
    }
    dir.toLowerCase();
    LauncherDir mode = LAUNCHER_STOP;
    if (dir == "up") mode = LAUNCHER_UP;
    else if (dir == "down") mode = LAUNCHER_DOWN;
    setLauncherDir(mode);
    const char* label = (mode == LAUNCHER_UP) ? "UP" : (mode == LAUNCHER_DOWN) ? "DOWN" : "STOP";
    serialReply(String("LAUNCHER=") + label);
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

  if (line.startsWith("/sequence_end")) {
    portENTER_CRITICAL(&stateMux);
    endSequenceNow(now);
    portEXIT_CRITICAL(&stateMux);
    serialReply("SEQUENCE_ENDED");
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

  if (line.startsWith("/easter_bgm")) {
    requestTetrisBgm();
    serialReply("EASTER_BGM_OK");
    return;
  }

  serialErr("UNKNOWN_CMD");
}

void pollSerialCommands() {
  static String buf;
  static uint32_t lastRxMs = 0;

  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    lastRxMs = millis();

    // Accept CR/LF as line ending
    if (c == '\n' || c == '\r') {
      if (buf.length() > 0) handleSerialCommand(buf);
      buf = "";
    } else {
      if (buf.length() < 240) buf += c;
    }
  }

  // Timeout: accept lines without explicit line ending
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
    uint8_t battPct = 0;
    if (!isnan(ignV) && !isinf(ignV)) {
      float pct = (ignV / 3.3f) * 100.0f;
      if (pct < 0.0f) pct = 0.0f;
      if (pct > 100.0f) pct = 100.0f;
      battPct = (uint8_t)(pct + 0.5f);
    }

    const uint8_t sw = (uint8_t)fastRead(switch1);

    uint8_t relayMask = 0;
    relayMask |= (fastRead(rly1) ? 1 : 0);
    relayMask |= (fastRead(rly2) ? 2 : 0);

    uint8_t st, uw, ab, ar, gsLocal, rsLocal, rfLocal, rmLocal, ssLocal, smLocal;
    uint32_t ss, cdDur, tPlusMs;
    uint32_t cd = 0;
    int32_t td = 0;

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
    tPlusMs = tPlusAnchorMs;
    cdDur = countdownDurationMs;

    if (st == ST_COUNTDOWN) {
      uint32_t elapsed = nowMs - ss;
      cd = (elapsed < cdDur) ? (cdDur - elapsed) : 0;
      td = -(int32_t)cd;
    } else if (st == ST_FIRING) {
      td = (int32_t)(nowMs - ss);
      cd = 0;
    } else if (st == ST_IDLE && uw == 1) {
      cd = webPrecountMs;
      td = -(int32_t)cd;
    } else if (st == ST_IDLE && tPlusMs > 0) {
      td = (int32_t)(nowMs - tPlusMs);
      cd = 0;
    } else {
      cd = 0;
      td = 0;
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
    snap.bp = battPct;
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
    snap.td = td;
    snap.uw = uw;
    snap.ab = ab;
    snap.ar = ar;
    snap.m  = modeWifi;

    snap.rs = rsLocal;
    snap.rf = rfLocal;
    snap.rm = rmLocal;
    snap.ss = ssLocal;
    snap.sm = smLocal;

    updateLastSnap(snap);
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
struct TetrisNote {
  uint16_t freq;
  uint16_t dur;
};

static const TetrisNote TETRIS_BGM[] = {
  {659, 180},{494, 90},{523, 90},{587, 180},{523, 90},{494, 90},
  {440, 180},{440, 90},{523, 90},{659, 180},{587, 90},{523, 90},
  {494, 270},{523, 90},{587, 180},{659, 180},
  {523, 180},{440, 180},{440, 180},{0, 180},

  {587, 180},{698, 90},{880, 180},{784, 90},{698, 90},
  {659, 270},{523, 90},{659, 180},{587, 90},{523, 90},
  {494, 180},{494, 90},{523, 90},{587, 180},{659, 180},
  {523, 180},{440, 180},{440, 180},{0, 180},

  {659, 240},{523, 240},{587, 240},{494, 240},
  {523, 240},{440, 240},{392, 240},{494, 120},{0, 120},
  {659, 240},{523, 240},{587, 240},{494, 240},
  {523, 180},{659, 180},{880, 240},{784, 240},{0, 180}
};
static const uint8_t TETRIS_TEMPO_PCT = 200;
static const uint16_t TETRIS_GAP_MS = 80;

static void ControlTask(void* arg) {
  (void)arg;

  uint32_t lastBeepTime = 0;
  bool beepToggle = false;
  int lastCdBeepSec = -1;

  bool relayOn = false;  // command relay state
  bool toneOn  = false;

  bool tetrisBgmActive = false;
  uint8_t tetrisBgmIndex = 0;
  uint32_t tetrisNextMs = 0;

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

  auto stopTetrisBgm = [&]() {
    if (!tetrisBgmActive) return;
    tetrisBgmActive = false;
    tetrisBgmIndex = 0;
    tetrisNextMs = 0;
    noTone(piezo);
  };

  uint32_t lastBlinkMs = 0;
  bool blinkPhase = false;

  // RelaySafe mismatch duration tracking
  uint32_t offMismatchSinceMs = 0;

  TickType_t lastWake = xTaskGetTickCount();

  for (;;) {
    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(5));

    const uint32_t now = millis();
    const SampleSnap s = getLastSnapCopy();

    uint8_t rsLocal = 0;
    uint8_t rfLocal = 0;
    uint8_t smLocal = 0;
    uint8_t tetrisReq = 0;
    uint8_t seqEndReq = 0;

    SystemState st;
    uint32_t stStart, ignDur, cdDur;
    int ab;
    int uwLocal = 0;

    portENTER_CRITICAL(&stateMux);
    rsLocal = (uint8_t)relaySafe;
    rfLocal = (uint8_t)relayFault;
    smLocal = (uint8_t)safetyMode;
    tetrisReq = tetrisBgmRequest;
    if (tetrisReq) tetrisBgmRequest = 0;
    seqEndReq = sequenceEndRequested;
    if (seqEndReq) sequenceEndRequested = 0;

    st = currentState;
    stStart = stateStartTimeMs;
    ignDur = ignitionDurationMs;
    cdDur  = countdownDurationMs;
    ab = webAbortFlag;
    uwLocal = webUserWaiting;
    portEXIT_CRITICAL(&stateMux);

    if (seqEndReq) {
      portENTER_CRITICAL(&stateMux);
      currentState = ST_IDLE;
      tPlusAnchorMs = 0;
      webAbortFlag = 0;
      webAbortReason = ABORT_NONE;
      webUserWaiting = 0;
      portEXIT_CRITICAL(&stateMux);
    }

    const bool swNow = (fastRead(switch1) != 0);

    if (tetrisReq) {
      tetrisBgmActive = true;
      tetrisBgmIndex = 0;
      tetrisNextMs = now;
    }

    if (tetrisBgmActive && (rfLocal == 1 || smLocal == 1 || st != ST_IDLE)) {
      stopTetrisBgm();
    }

    bool toneUsed = false;

    if (rfLocal == 1) {
      stopTetrisBgm();
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
        toneUsed = true;
      }

      continue;
    }

    if (smLocal == 1) {
      if (st != ST_IDLE || uwLocal == 1) {
        portENTER_CRITICAL(&stateMux);
        setIdleAbort(ABORT_USER);
        portEXIT_CRITICAL(&stateMux);
      }
      setRelays(false);
      stopTetrisBgm();
      stopTone();
      fastWrite(led1, LOW);
      fastWrite(led2, HIGH);
      continue;
    }

    if (seqEndReq) {
      setRelays(false);
      stopTetrisBgm();
      stopTone();
      setLauncherDir(LAUNCHER_STOP);
      lastCdBeepSec = -1;
      continue;
    }

    fastWrite(led1, (s.ic == 1) ? HIGH : LOW);
    fastWrite(led2, HIGH);

    if (st == ST_IDLE) {
      if (swNow) {
        if (tPlusAnchorMs == 0) {
          portENTER_CRITICAL(&stateMux);
          if (tPlusAnchorMs == 0) tPlusAnchorMs = now;
          portEXIT_CRITICAL(&stateMux);
        }
        if (relayOn || s.ic == 1 || s.gs == 0) {
          setRelays(true);
          if (now - lastBeepTime >= 140) {
            lastBeepTime = now;
            beepToggle = !beepToggle;
            tone(piezo, beepToggle ? 1800 : 1400, 120);
            toneOn = true;
            toneUsed = true;
          }
        } else {
          setRelays(false);
          if (now - lastBeepTime > 200) {
            lastBeepTime = now;
            tone(piezo, 300, 100);
            toneOn = true;
            toneUsed = true;
          }
        }
      } else {
        setRelays(false);
        if (!tetrisBgmActive) stopTone();
        if (s.gs == 1 && s.ic == 1) {
          if (now - lastBeepTime >= 1500) {
            lastBeepTime = now;
            tone(piezo, 750, 120);
            toneOn = true;
            toneUsed = true;
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
          toneUsed = true;
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
        tPlusAnchorMs = 0;
        portEXIT_CRITICAL(&stateMux);
      }
      else if (now - stStart >= cdDur) {
        portENTER_CRITICAL(&stateMux);
        currentState = ST_FIRING;
        stateStartTimeMs = now;
        tPlusAnchorMs = now;
        portEXIT_CRITICAL(&stateMux);
      }
    }
    else if (st == ST_FIRING) {
      lastCdBeepSec = -1;
      if (ab || (now - stStart >= ignDur)) {
        portENTER_CRITICAL(&stateMux);
        currentState = ST_IDLE;
        if (ab) tPlusAnchorMs = 0;
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
          toneUsed = true;
        }
      }
    }
    else {
      lastCdBeepSec = -1;
    }

    if (tetrisBgmActive && !toneUsed && now >= tetrisNextMs) {
      if (tetrisBgmIndex >= (sizeof(TETRIS_BGM) / sizeof(TETRIS_BGM[0]))) {
        tetrisBgmIndex = 0;
      }
      const TetrisNote note = TETRIS_BGM[tetrisBgmIndex];
      const uint16_t scaledDur =
        (uint16_t)((uint32_t)note.dur * TETRIS_TEMPO_PCT / 100U);
      if (note.freq == 0) noTone(piezo);
      else tone(piezo, note.freq, scaledDur);
      tetrisBgmIndex++;
      tetrisNextMs = now + scaledDur + TETRIS_GAP_MS;
    }

    if (rsLocal == 1) {
      const uint8_t actualMask =
        (fastRead(rly1) ? 1 : 0) |
        (fastRead(rly2) ? 2 : 0);

      const bool shouldBeOff = (!relayOn);

      if (shouldBeOff && actualMask != 0) {
        if (offMismatchSinceMs == 0) offMismatchSinceMs = now;

        if ((now - offMismatchSinceMs) >= RELAYSAFE_CONFIRM_MS) {
          portENTER_CRITICAL(&stateMux);
          relayFault = 1;
          relayFaultMask = actualMask;

          currentState = ST_IDLE;
          tPlusAnchorMs = 0;
          webAbortFlag = 1;
          webAbortReason = ABORT_LOCKOUT;
          webUserWaiting = 0;
          portEXIT_CRITICAL(&stateMux);

          setRelays(false);
          stopTone();
          setLauncherDir(LAUNCHER_STOP);
        }
      } else {
        offMismatchSinceMs = 0;
      }
    } else {
      offMismatchSinceMs = 0;
    }
  }
}

void startTasks() {
  const BaseType_t CORE_APP = 1;
  xTaskCreatePinnedToCore(SamplerTask, "SamplerTask", 4096, nullptr, 2, nullptr, CORE_APP);
  xTaskCreatePinnedToCore(ControlTask, "ControlTask", 4096, nullptr, 3, nullptr, CORE_APP);
  xTaskCreatePinnedToCore(WebSocketTask, "WebSocketTask", 4096, nullptr, 2, nullptr, CORE_APP);
}
