uint16_t loadcellFlagsForTelemetry(const Telemetry& source) {
  uint16_t flags = 0;
  if (source.loadcellReady) flags |= 1U << 0;
  if (source.loadcellValid) flags |= 1U << 1;
  if (source.loadcellSaturated) flags |= 1U << 2;
  if (source.loadcellOffsetValid) flags |= 1U << 3;
  return flags;
}

void publishLoadcellTelemetry(bool active, bool valid) {
  snap.thrustKgf = valid ? loadcellFilteredKgf : 0.0f;
  snap.loadcellNoiseKg = kLoadcellNoiseDeadbandKg;
  snap.loadcellScale = loadcellScale;
  snap.loadcellRaw = loadcellRaw;
  snap.loadcellHz = active ? loadcellHz : 0;
  snap.loadcellReady = active && loadcellReady;
  snap.loadcellValid = active && valid;
  snap.loadcellSaturated = active && loadcellSaturated;
  snap.loadcellOffsetValid = active && loadcellAutoZeroDone;
}

void resetLoadcellRuntime() {
  loadcellFilterReady = false;
  loadcellAutoZeroDone = false;
  loadcellSaturated = false;
  loadcellAutoZeroCount = 0;
  loadcellAutoZeroSum = 0;
  loadcellRateWindowMs = millis();
  loadcellRateWindowSamples = 0;
  loadcellHz = 0;
  lastLoadcellPollUs = 0;
  lastLoadcellSampleMs = 0;
  loadcellFilteredKgf = 0.0f;
  publishLoadcellTelemetry(false, false);
}

void loadLoadcellConfig() {
  loadcellPrefsReady = loadcellPrefs.begin("loadcell", false);
  if (!loadcellPrefsReady) {
    loadcellOffset = 0;
    loadcellScale = kLoadcellDefaultScale;
    return;
  }
  loadcellOffset = loadcellPrefs.getInt("offset", 0);
  const float storedScale = loadcellPrefs.getFloat("scale", kLoadcellDefaultScale);
  loadcellScale =
    (isfinite(storedScale) && fabsf(storedScale) >= 1.0f)
      ? storedScale
      : kLoadcellDefaultScale;
}

bool saveLoadcellOffset(int32_t offset) {
  loadcellOffset = offset;
  loadcellAutoZeroDone = true;
  if (!loadcellPrefsReady) loadcellPrefsReady = loadcellPrefs.begin("loadcell", false);
  if (!loadcellPrefsReady) return false;
  loadcellPrefs.putInt("offset", loadcellOffset);
  return true;
}

bool saveLoadcellScale(float scale) {
  if (!isfinite(scale) || fabsf(scale) < 1.0f) return false;
  loadcellScale = scale;
  if (!loadcellPrefsReady) loadcellPrefsReady = loadcellPrefs.begin("loadcell", false);
  if (!loadcellPrefsReady) return false;
  loadcellPrefs.putFloat("scale", loadcellScale);
  return true;
}

void resetLoadcellConfig() {
  loadcellOffset = 0;
  loadcellScale = kLoadcellDefaultScale;
  resetLoadcellRuntime();
  if (!loadcellPrefsReady) loadcellPrefsReady = loadcellPrefs.begin("loadcell", false);
  if (loadcellPrefsReady) {
    loadcellPrefs.putInt("offset", loadcellOffset);
    loadcellPrefs.putFloat("scale", loadcellScale);
  }
}

bool hx711ReadRaw(int32_t& out) {
  if (!loadcellReady || digitalRead(hx711Dout) != LOW) return false;

  uint32_t value = 0;
  noInterrupts();
  for (uint8_t i = 0; i < 24U; ++i) {
    digitalWrite(hx711Sck, HIGH);
    delayMicroseconds(1);
    value = (value << 1) | (digitalRead(hx711Dout) ? 1U : 0U);
    digitalWrite(hx711Sck, LOW);
    delayMicroseconds(1);
  }
  digitalWrite(hx711Sck, HIGH);
  delayMicroseconds(1);
  digitalWrite(hx711Sck, LOW);
  delayMicroseconds(1);
  interrupts();

  if (value & 0x800000UL) value |= 0xFF000000UL;
  out = (int32_t)value;
  return true;
}

void initLoadcell() {
  loadLoadcellConfig();
  hx711Dout = hx711DoutDaq;
  hx711Sck = hx711SckDaq;
  pinMode(hx711Sck, OUTPUT);
  digitalWrite(hx711Sck, LOW);
  pinMode(hx711Dout, INPUT_PULLUP);
  loadcellReady = true;
  loadcellPinsActive = true;
  resetLoadcellRuntime();
  Serial.printf("[HX711] ready dout=%d sck=%d scale=%.3f mode=daq_only\n",
                hx711Dout,
                hx711Sck,
                loadcellScale);
}

void releaseLoadcellPins() {
  if (loadcellPinsActive || loadcellReady) {
    digitalWrite(hx711Sck, LOW);
    pinMode(hx711Sck, INPUT);
    pinMode(hx711Dout, INPUT);
  }
  loadcellReady = false;
  loadcellPinsActive = false;
  resetLoadcellRuntime();
}

void sampleLoadcell() {
  static bool wasActive = false;
  const bool active = loadcellShouldRun();
  if (!active) {
    if (wasActive ||
        snap.loadcellReady ||
        snap.loadcellValid ||
        snap.loadcellHz != 0U ||
        snap.thrustKgf != 0.0f ||
        snap.loadcellRaw != 0) {
      resetLoadcellRuntime();
    }
    wasActive = false;
    return;
  }
  if (!wasActive) {
    resetLoadcellRuntime();
    wasActive = true;
  }
  if (!loadcellReady) {
    publishLoadcellTelemetry(true, false);
    return;
  }

  const uint32_t nowUs = micros();
  if (lastLoadcellPollUs != 0 &&
      (uint32_t)(nowUs - lastLoadcellPollUs) < kLoadcellPollPeriodUs) {
    return;
  }
  lastLoadcellPollUs = nowUs;

  const uint32_t nowMs = millis();
  if ((uint32_t)(nowMs - loadcellRateWindowMs) >= 1000U) {
    const uint32_t elapsed = nowMs - loadcellRateWindowMs;
    loadcellHz = elapsed > 0
      ? (uint16_t)min<uint32_t>(
          65535U,
          (loadcellRateWindowSamples * 1000UL) / elapsed)
      : 0;
    loadcellRateWindowSamples = 0;
    loadcellRateWindowMs = nowMs;
  }

  int32_t raw = 0;
  if (!hx711ReadRaw(raw)) {
    const bool stale =
      lastLoadcellSampleMs == 0 ||
      (uint32_t)(nowMs - lastLoadcellSampleMs) > kLoadcellStaleMs;
    if (stale) publishLoadcellTelemetry(true, false);
    return;
  }

  loadcellRaw = raw;
  loadcellRateWindowSamples++;
  lastLoadcellSampleMs = nowMs;
  loadcellSaturated = raw > 0x7F0000L || raw < -0x7F0000L;

  if (!loadcellAutoZeroDone) {
    loadcellAutoZeroSum += raw;
    if (loadcellAutoZeroCount < UINT16_MAX) loadcellAutoZeroCount++;
    if (loadcellAutoZeroCount >= kLoadcellAutoZeroSamples) {
      loadcellOffset = (int32_t)(loadcellAutoZeroSum / (int64_t)loadcellAutoZeroCount);
      loadcellAutoZeroDone = true;
      loadcellFilterReady = false;
      Serial.printf("[HX711] boot auto-zero offset=%ld samples=%u\n",
                    (long)loadcellOffset,
                    (unsigned)loadcellAutoZeroCount);
    }
    publishLoadcellTelemetry(true, false);
    return;
  }

  const float scale =
    (isfinite(loadcellScale) && fabsf(loadcellScale) >= 1.0f)
      ? loadcellScale
      : kLoadcellDefaultScale;
  const float kgf = (float)(raw - loadcellOffset) / scale;
  if (!isfinite(kgf) || loadcellSaturated) {
    loadcellReadErrors++;
    publishLoadcellTelemetry(true, false);
    return;
  }
  if (!loadcellFilterReady) {
    loadcellFilteredKgf = kgf;
    loadcellFilterReady = true;
  } else {
    loadcellFilteredKgf += (kgf - loadcellFilteredKgf) * kLoadcellFilterAlpha;
  }
  if (fabsf(loadcellFilteredKgf) < kLoadcellNoiseDeadbandKg) {
    loadcellFilteredKgf = 0.0f;
  }
  publishLoadcellTelemetry(true, true);
}

const char* flashLinkRoleName() {
  return flashLinkRole == FlashLinkRole::Ground ? "ground" : "avionics";
}
