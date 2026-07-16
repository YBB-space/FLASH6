float clampFloat(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

float wrap180(float deg) {
  if (!isfinite(deg)) return 0.0f;
  while (deg <= -180.0f) deg += 360.0f;
  while (deg > 180.0f) deg -= 360.0f;
  return deg;
}

const char* resetReasonName(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON: return "POWERON";
    case ESP_RST_EXT: return "EXT";
    case ESP_RST_SW: return "SW";
    case ESP_RST_PANIC: return "PANIC";
    case ESP_RST_INT_WDT: return "INT_WDT";
    case ESP_RST_TASK_WDT: return "TASK_WDT";
    case ESP_RST_WDT: return "WDT";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
    case ESP_RST_BROWNOUT: return "BROWNOUT";
    case ESP_RST_SDIO: return "SDIO";
    default: return "UNKNOWN";
  }
}

bool truthy(const String& v) {
  String s = v;
  s.trim();
  s.toLowerCase();
  return s == "1" || s == "true" || s == "on" || s == "yes" || s == "flight";
}

bool armSwitchPhysicalOn() {
  return digitalRead(kArmSwitch) == HIGH;
}

bool armSwitchEffectiveOn() {
  return armLock || armSwitchPhysicalOn();
}

uint16_t crc16Ccitt(const uint8_t* data, size_t len) {
  uint16_t crc = 0xFFFFU;
  for (size_t i = 0; i < len; ++i) {
    crc ^= (uint16_t)data[i] << 8;
    for (uint8_t bit = 0; bit < 8; ++bit) {
      crc = (crc & 0x8000U) ? (uint16_t)((crc << 1) ^ 0x1021U) : (uint16_t)(crc << 1);
    }
  }
  return crc;
}

bool flashLinkGroundRole();

uint8_t operationModeCode() {
  if (flashLinkMode) return 2U;
  return flightMode ? 1U : 0U;
}

const char* operationModeName() {
  if (flashLinkMode) return "flash_link";
  return flightMode ? "flight" : "daq";
}

uint8_t flashLinkDataModeCode() {
  return flashLinkDataFlightMode ? 1U : 0U;
}

const char* dataOperationModeNameFor(uint8_t mode) {
  return mode == 1U ? "flight" : "daq";
}

uint8_t dataOperationModeCode() {
  return flashLinkMode ? flashLinkDataModeCode() : (flightMode ? 1U : 0U);
}

const char* dataOperationModeName() {
  return dataOperationModeNameFor(dataOperationModeCode());
}

bool loadcellShouldRun() {
  return !flashLinkGroundRole() && dataOperationModeCode() == 0U;
}

bool gpsShouldRun() {
  return !flashLinkGroundRole() && dataOperationModeCode() == 1U;
}
