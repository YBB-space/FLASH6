#include "state.h"

// -------------------- igs mode --------------------
volatile int igs = 1;

// -------------------- RelaySafe --------------------
volatile int relaySafe = 1;
volatile int relayFault = 0;
volatile uint8_t relayFaultMask = 0;
volatile uint8_t safetyMode = 0;

// -------------------- serial JSON stream --------------------
volatile int serialStream = 1;

// -------------------- state machine --------------------
volatile SystemState currentState = ST_IDLE;

volatile uint32_t stateStartTimeMs    = 0;
volatile uint32_t tPlusAnchorMs       = 0;
volatile uint32_t countdownDurationMs = 10000;
volatile uint32_t ignitionDurationMs  = 5000;

volatile int webUserWaiting = 0;
volatile int webAbortFlag   = 0;
volatile uint8_t webAbortReason = ABORT_NONE;
volatile uint32_t webPrecountMs = 10000;
volatile uint8_t sequenceEndRequested = 0;

volatile uint8_t tetrisBgmRequest = 0;

unsigned long systemStartTime = 0;

portMUX_TYPE stateMux = portMUX_INITIALIZER_UNLOCKED;
portMUX_TYPE sampleMux = portMUX_INITIALIZER_UNLOCKED;

static SampleSnap lastSnap = {0};

SampleSnap getLastSnapCopy() {
  SampleSnap s;
  portENTER_CRITICAL(&sampleMux);
  s = lastSnap;
  portEXIT_CRITICAL(&sampleMux);
  return s;
}

void updateLastSnap(const SampleSnap& snap) {
  portENTER_CRITICAL(&sampleMux);
  lastSnap = snap;
  portEXIT_CRITICAL(&sampleMux);
}

bool isLocked(uint8_t* outMask) {
  bool locked;
  uint8_t mask;
  portENTER_CRITICAL(&stateMux);
  locked = (relayFault != 0);
  mask = relayFaultMask;
  portEXIT_CRITICAL(&stateMux);
  if (outMask) *outMask = mask;
  return locked;
}

bool isSafetyOn() {
  bool on;
  portENTER_CRITICAL(&stateMux);
  on = (safetyMode != 0);
  portEXIT_CRITICAL(&stateMux);
  return on;
}

void startCountdownNow(uint32_t now) {
  currentState = ST_COUNTDOWN;
  stateStartTimeMs = now;
  tPlusAnchorMs = 0;
  webAbortFlag = 0;
  webAbortReason = ABORT_NONE;
  webUserWaiting = 0;
}

void startFiringNow(uint32_t now) {
  currentState = ST_FIRING;
  stateStartTimeMs = now;
  tPlusAnchorMs = now;
  webAbortFlag = 0;
  webAbortReason = ABORT_NONE;
  webUserWaiting = 0;
}

void setIdleAbort(uint8_t reason) {
  currentState = ST_IDLE;
  tPlusAnchorMs = 0;
  webAbortFlag = 1;
  webAbortReason = reason;
  webUserWaiting = 0;
}

void endSequenceNow(uint32_t now) {
  (void)now;
  currentState = ST_IDLE;
  tPlusAnchorMs = 0;
  webAbortFlag = 0;
  webAbortReason = ABORT_NONE;
  webUserWaiting = 0;
  sequenceEndRequested = 1;
}

void applySetKV(const String& key, const String& val) {
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

void applyQueryLike(const String& queryPart) {
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

void requestTetrisBgm() {
  portENTER_CRITICAL(&stateMux);
  tetrisBgmRequest = 1;
  portEXIT_CRITICAL(&stateMux);
}
