bool getQueryValue(const String& cmd, const char* key, String& out) {
  if (!key || !key[0]) return false;
  int q = cmd.indexOf('?');
  if (q < 0) return false;
  String query = cmd.substring(q + 1);
  int start = 0;
  while (start < (int)query.length()) {
    int amp = query.indexOf('&', start);
    if (amp < 0) amp = query.length();
    String part = query.substring(start, amp);
    int eq = part.indexOf('=');
    String k = eq >= 0 ? part.substring(0, eq) : part;
    if (k == key) {
      out = eq >= 0 ? part.substring(eq + 1) : "1";
      return true;
    }
    start = amp + 1;
  }
  return false;
}

bool parseLongStrict(const String& raw, long& out) {
  String s = raw;
  s.trim();
  if (s.length() == 0) return false;

  int i = 0;
  bool negative = false;
  if (s[0] == '+' || s[0] == '-') {
    negative = s[0] == '-';
    i = 1;
    if (i >= (int)s.length()) return false;
  }

  int64_t value = 0;
  for (; i < (int)s.length(); ++i) {
    const char c = s[i];
    if (c < '0' || c > '9') return false;
    value = value * 10 + (c - '0');
    if (value > 2147483647LL) return false;
  }
  out = (long)(negative ? -value : value);
  return true;
}

uint32_t clampU32(long value, uint32_t lo, uint32_t hi, uint32_t fallback) {
  if (value <= 0 && fallback >= lo && fallback <= hi) value = (long)fallback;
  if (value < (long)lo) return lo;
  if (value > (long)hi) return hi;
  return (uint32_t)value;
}

uint8_t clampPyroChannel(long value) {
  if (value < 1) return 1;
  if (value > kPyroChannelCount) return kPyroChannelCount;
  return (uint8_t)value;
}

uint8_t pyroMaskForChannel(uint8_t channel) {
  channel = clampPyroChannel(channel);
  return (uint8_t)(1U << (channel - 1U));
}

void initPyroOutputs() {
  for (uint8_t i = 0; i < kPyroChannelCount; ++i) {
    pinMode(kPyroPins[i], OUTPUT);
    digitalWrite(kPyroPins[i], LOW);
  }
  Serial.printf("[PYRO] outputs ready ch1=gpio%d ch2=gpio%d active_high=1\n",
                kPyroPins[0],
                kPyroPins[1]);
}

void applyPyroOutputs(uint32_t nowMs) {
  const uint8_t mask =
    (!flashLinkGroundRole() && !safetyMode)
      ? sequenceRelayMaskNow(nowMs)
      : 0U;
  for (uint8_t i = 0; i < kPyroChannelCount; ++i) {
    digitalWrite(kPyroPins[i], (mask & (1U << i)) ? HIGH : LOW);
  }
}

uint8_t clampServoChannel(long value) {
  if (value < 1) return 1;
  if (value > kServoChannelCount) return kServoChannelCount;
  return (uint8_t)value;
}

uint8_t clampServoAngle(long value) {
  if (value < 0) return 0;
  if (value > 180) return 180;
  return (uint8_t)value;
}

uint32_t servoDutyForAngle(uint8_t angleDeg) {
  angleDeg = clampServoAngle(angleDeg);
  const uint32_t pulseUs =
    kServoMinPulseUs +
    ((uint32_t)(kServoMaxPulseUs - kServoMinPulseUs) * angleDeg + 90U) / 180U;
  const uint32_t maxDuty = (1UL << kServoLedcResolutionBits) - 1UL;
  return (pulseUs * maxDuty + 10000UL) / 20000UL;
}

void initServoOutputs() {
  if (servoReady) return;
  for (uint8_t i = 0; i < kServoChannelCount; ++i) {
    const double actualHz =
      ledcSetup(kServoLedcChannels[i], kServoHz, kServoLedcResolutionBits);
    if (actualHz > 0.0) {
      ledcAttachPin(kServoPins[i], kServoLedcChannels[i]);
      servoAttached[i] = true;
    }
  }
  servoReady = true;
  Serial.printf("[SERVO] LEDC ready pwm1=gpio%d pwm2=gpio%d pwm3=gpio%d pwm4=gpio%d pwm5=gpio%d\n",
                kServoPins[0],
                kServoPins[1],
                kServoPins[2],
                kServoPins[3],
                kServoPins[4]);
}

bool setServoAngle(uint8_t channel, uint8_t angleDeg) {
  channel = clampServoChannel(channel);
  angleDeg = clampServoAngle(angleDeg);
  const uint8_t idx = channel - 1U;
  if (!servoReady) initServoOutputs();
  if (!servoAttached[idx]) return false;
  servoAngles[idx] = angleDeg;
  const uint32_t duty = servoDutyForAngle(angleDeg);
  ledcWrite(kServoLedcChannels[idx], duty);
  Serial.printf("[SERVO] set ch=%u pin=%d deg=%u duty=%lu\n",
                (unsigned)channel,
                kServoPins[idx],
                (unsigned)angleDeg,
                (unsigned long)duty);
  return true;
}

String servoJson() {
  char json[512];
  int n = snprintf(
    json,
    sizeof(json),
    "{\"ok\":1,\"ready\":%u,"
    "\"channels\":["
    "{\"id\":1,\"pin\":%d,\"angle\":%d},"
    "{\"id\":2,\"pin\":%d,\"angle\":%d},"
    "{\"id\":3,\"pin\":%d,\"angle\":%d},"
    "{\"id\":4,\"pin\":%d,\"angle\":%d},"
    "{\"id\":5,\"pin\":%d,\"angle\":%d}]}",
    servoReady ? 1U : 0U,
    kServoPins[0], (int)servoAngles[0],
    kServoPins[1], (int)servoAngles[1],
    kServoPins[2], (int)servoAngles[2],
    kServoPins[3], (int)servoAngles[3],
    kServoPins[4], (int)servoAngles[4]);
  if (n <= 0 || (size_t)n >= sizeof(json)) {
    return "{\"ok\":0,\"err\":\"SERVO_JSON_OVERFLOW\"}";
  }
  return String(json);
}

void saveSequenceSettings() {
  if (!settingsPrefsReady) settingsPrefsReady = settingsPrefs.begin("settings", false);
  if (!settingsPrefsReady) return;
  if (settingsPrefs.getUInt("ign_ms", 0U) != ignitionDurationMs) {
    settingsPrefs.putUInt("ign_ms", ignitionDurationMs);
  }
  if (settingsPrefs.getUInt("cd_ms", 0U) != countdownDurationMs) {
    settingsPrefs.putUInt("cd_ms", countdownDurationMs);
  }
  if (settingsPrefs.getUChar("daq_pyro", 0U) != daqSequencePyroChannel) {
    settingsPrefs.putUChar("daq_pyro", daqSequencePyroChannel);
  }
  if (settingsPrefs.getUChar("opm", 0xFFU) != operationModeCode()) {
    settingsPrefs.putUChar("opm", operationModeCode());
  }
  if (settingsPrefs.getUChar("fl_role", 0xFFU) != flashLinkRoleCode()) {
    settingsPrefs.putUChar("fl_role", flashLinkRoleCode());
  }
  if (settingsPrefs.getUChar("fl_data", 0xFFU) != flashLinkDataModeCode()) {
    settingsPrefs.putUChar("fl_data", flashLinkDataModeCode());
  }
  if (settingsPrefs.getUChar("fl_node", 0xFFU) != flashLinkNodeId) {
    settingsPrefs.putUChar("fl_node", flashLinkNodeId);
  }
  if (settingsPrefs.getUChar("fl_target", 0xFFU) != flashLinkTargetNodeId) {
    settingsPrefs.putUChar("fl_target", flashLinkTargetNodeId);
  }
}

void saveBootOnceMode(const char* mode) {
  if (!settingsPrefsReady) settingsPrefsReady = settingsPrefs.begin("settings", false);
  if (!settingsPrefsReady || !mode || !mode[0]) return;
  if (!settingsPrefs.isKey("boot_once") ||
      settingsPrefs.getString("boot_once", "") != mode) {
    settingsPrefs.putString("boot_once", mode);
  }
}

void loadSequenceSettings() {
  settingsPrefsReady = settingsPrefs.begin("settings", false);
  flightMode = true;
  flashLinkMode = false;
  if (!settingsPrefsReady) return;
  ignitionDurationMs = clampU32((long)settingsPrefs.getUInt("ign_ms", kDefaultIgnitionMs), 100, 3000, kDefaultIgnitionMs);
  countdownDurationMs = clampU32((long)settingsPrefs.getUInt("cd_ms", kDefaultCountdownMs), 3000, 60000, kDefaultCountdownMs);
  daqSequencePyroChannel = clampPyroChannel((long)settingsPrefs.getUChar("daq_pyro", 1));
  flashLinkRole = settingsPrefs.getUChar("fl_role", 0) == 1U
    ? FlashLinkRole::Ground
    : FlashLinkRole::Avionics;
  flashLinkDataFlightMode = settingsPrefs.getUChar("fl_data", 1U) != 0U;
  flashLinkNodeId = clampFlashLinkVehicleNodeId(
    settingsPrefs.getUChar("fl_node", kFlashLinkNodeIdStage1));
  flashLinkTargetNodeId = clampFlashLinkVehicleNodeId(
    settingsPrefs.getUChar("fl_target", kFlashLinkNodeIdStage1));
  developerMode = settingsPrefs.getBool("dev", false);
  const uint8_t savedMode = settingsPrefs.getUChar("opm", 1U);
  if (savedMode == 2U) {
    setOperationMode("flash_link");
  } else if (savedMode == 0U) {
    setOperationMode("daq");
  } else {
    setOperationMode("flight");
  }
  String bootOnceMode;
  if (settingsPrefs.isKey("boot_once")) {
    bootOnceMode = settingsPrefs.getString("boot_once", "");
    settingsPrefs.remove("boot_once");
  }
  if (settingsPrefs.isKey("op_mode")) settingsPrefs.remove("op_mode");
  if (bootOnceMode.length() > 0) {
    setOperationMode(bootOnceMode);
    saveSequenceSettings();
  }
  applyDeveloperModeSerialPolicy();
}

void setIgnitionDurationMs(long ms) {
  const uint32_t next = clampU32(ms, 100, 3000, kDefaultIgnitionMs);
  if (ignitionDurationMs == next) return;
  ignitionDurationMs = next;
  saveSequenceSettings();
}

void setCountdownDurationMs(long ms) {
  const uint32_t next = clampU32(ms, 3000, 60000, kDefaultCountdownMs);
  if (countdownDurationMs == next) return;
  countdownDurationMs = next;
  saveSequenceSettings();
}

void setDaqSequencePyroChannel(long channel) {
  const uint8_t next = clampPyroChannel(channel);
  if (daqSequencePyroChannel == next) return;
  daqSequencePyroChannel = next;
  saveSequenceSettings();
}

int32_t sequenceTdMs(uint32_t nowMs) {
  const uint8_t st = sequenceState;
  if (st == kSequenceStateCountdown) {
    const int32_t remainingDeltaMs = (int32_t)(sequenceCountdownEndMs - nowMs);
    const uint32_t remainingMs = remainingDeltaMs > 0 ? (uint32_t)remainingDeltaMs : 0U;
    return -(int32_t)remainingMs;
  }
  if (st == kSequenceStateFiring || st == kSequenceStateTplus) {
    return (int32_t)((nowMs >= sequenceFiringStartMs) ? (nowMs - sequenceFiringStartMs) : 0U);
  }
  if (sequenceUserWaiting) return -(int32_t)countdownDurationMs;
  return 0;
}

bool sequenceAbortActive(uint32_t nowMs) {
  return sequenceAborted && (int32_t)(sequenceAbortHoldUntilMs - nowMs) > 0;
}

uint8_t sequenceRelayMaskNow(uint32_t nowMs) {
  if ((int32_t)(sequenceRelayHoldUntilMs - nowMs) <= 0) return 0;
  return sequenceRelayMask;
}

void clearSequenceRuntime() {
  const uint32_t nowMs = millis();
  buttonSequenceWarningActive = false;
  buttonSequenceWarningBeeps = 0;
  sequenceState = kSequenceStateIdle;
  sequenceUserWaiting = false;
  sequenceCountdownEndMs = 0;
  sequenceCountdownTotalMs = 0;
  sequenceCountdownBeepSecond = 0;
  sequenceCountdownSecondBeepPending = false;
  sequenceCountdownSecondBeepAtMs = 0;
  sequenceFiringStartMs = 0;
  sequenceFiringEndMs = 0;
  sequenceRelayHoldUntilMs = 0;
  sequenceRelayMask = 0;
  applyPyroOutputs(nowMs);
}

bool startFiringRuntime(uint32_t nowMs, uint8_t channel) {
  if (safetyMode ||
      (sequenceState != kSequenceStateIdle &&
       sequenceState != kSequenceStateCountdown)) {
    return false;
  }
  sequenceState = kSequenceStateFiring;
  sequenceUserWaiting = false;
  sequenceAborted = false;
  sequenceAbortReason = 0;
  sequenceFiringStartMs = nowMs;
  sequenceFiringEndMs = nowMs + ignitionDurationMs;
  sequenceRelayMask = pyroMaskForChannel(channel);
  sequenceRelayHoldUntilMs = sequenceFiringEndMs;
  applyPyroOutputs(nowMs);
  buzzerPlayTone(2400, 120);
  return true;
}

bool startCountdownRuntimeFor(uint32_t nowMs, uint32_t durationMs, bool playStartTone) {
  if (safetyMode || sequenceState != kSequenceStateIdle) return false;
  durationMs = clampU32((long)durationMs, 3000, 60000, countdownDurationMs);
  sequenceState = kSequenceStateCountdown;
  sequenceUserWaiting = false;
  sequenceAborted = false;
  sequenceAbortReason = 0;
  sequenceCountdownTotalMs = durationMs;
  sequenceCountdownEndMs = nowMs + durationMs;
  sequenceCountdownBeepSecond = 0;
  sequenceCountdownSecondBeepPending = false;
  sequenceCountdownSecondBeepAtMs = 0;
  sequenceFiringStartMs = 0;
  sequenceFiringEndMs = 0;
  if (playStartTone) buzzerPlayTone(1200, 80);
  return true;
}

bool startCountdownRuntime(uint32_t nowMs) {
  return startCountdownRuntimeFor(nowMs, countdownDurationMs, true);
}

uint32_t reportedCountdownDurationMs() {
  return (sequenceState == kSequenceStateCountdown && sequenceCountdownTotalMs > 0U)
    ? sequenceCountdownTotalMs
    : countdownDurationMs;
}

void abortSequenceRuntime(uint8_t reason) {
  clearSequenceRuntime();
  sequenceAborted = true;
  sequenceAbortReason = reason ? reason : 1;
  sequenceAbortHoldUntilMs = millis() + 3500U;
  buzzerPlayTone(520, 260);
}

void sequenceTick() {
  const uint32_t nowMs = millis();
  if (sequenceAborted && (int32_t)(sequenceAbortHoldUntilMs - nowMs) <= 0) {
    sequenceAborted = false;
    sequenceAbortReason = 0;
  }
  if (sequenceState == kSequenceStateCountdown && (int32_t)(sequenceCountdownEndMs - nowMs) > 0) {
    const uint32_t remainingMs = sequenceCountdownEndMs - nowMs;
    const uint8_t remainingSec = (uint8_t)((remainingMs + 999U) / 1000U);

    if (remainingSec >= 1U && remainingSec <= 10U &&
        remainingSec != sequenceCountdownBeepSecond) {
      sequenceCountdownBeepSecond = remainingSec;
      buzzerPlayTone(remainingSec <= 3U ? 2300U : 1850U, 100U);
      sequenceCountdownSecondBeepPending = remainingSec <= 3U;
      sequenceCountdownSecondBeepAtMs = nowMs + 250U;
    }

    if (sequenceCountdownSecondBeepPending &&
        (int32_t)(nowMs - sequenceCountdownSecondBeepAtMs) >= 0) {
      const uint8_t currentSec = (uint8_t)((sequenceCountdownEndMs - nowMs + 999U) / 1000U);
      sequenceCountdownSecondBeepPending = false;
      if (currentSec == sequenceCountdownBeepSecond && currentSec >= 1U && currentSec <= 3U) {
        buzzerPlayTone(2300U, 100U);
      }
    }
  }
  if (sequenceState == kSequenceStateCountdown && (int32_t)(nowMs - sequenceCountdownEndMs) >= 0) {
    startFiringRuntime(nowMs, daqSequencePyroChannel);
    return;
  }
  if (sequenceState == kSequenceStateFiring && (int32_t)(nowMs - sequenceFiringEndMs) >= 0) {
    sequenceState = kSequenceStateTplus;
    sequenceFiringEndMs = 0;
    sequenceRelayHoldUntilMs = 0;
    sequenceRelayMask = 0;
    applyPyroOutputs(nowMs);
    buzzerPlayTone(1760, 90);
  }
}

uint8_t flashCapacityCode() {
  return storageJedecCapacity;
}
