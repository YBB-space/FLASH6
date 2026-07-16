float clampFloat(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

int16_t quantizeInt16(
  float value,
  float lo,
  float hi,
  float scale,
  int16_t invalid = 0
) {
  if (!isfinite(value)) return invalid;
  const float scaled = clampFloat(value, lo, hi) * scale;
  const int32_t rounded = static_cast<int32_t>(
    scaled >= 0.0f ? scaled + 0.5f : scaled - 0.5f);
  if (rounded <= INT16_MIN) return INT16_MIN;
  if (rounded >= INT16_MAX) return INT16_MAX;
  return static_cast<int16_t>(rounded);
}

int32_t quantizeInt32(
  float value,
  float lo,
  float hi,
  float scale,
  int32_t invalid = 0
) {
  if (!isfinite(value)) return invalid;
  const float scaled = clampFloat(value, lo, hi) * scale;
  const float rounded = scaled >= 0.0f ? scaled + 0.5f : scaled - 0.5f;
  // 2,147,483,520 is the largest float strictly below INT32_MAX. Guard the
  // conversion because float rounds INT32_MAX itself to 2,147,483,648.
  if (rounded >= 2147483520.0f) return INT32_MAX;
  if (rounded <= -2147483648.0f) return INT32_MIN;
  return static_cast<int32_t>(rounded);
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
  static constexpr uint16_t kNibbleTable[16] = {
    0x0000U, 0x1021U, 0x2042U, 0x3063U,
    0x4084U, 0x50A5U, 0x60C6U, 0x70E7U,
    0x8108U, 0x9129U, 0xA14AU, 0xB16BU,
    0xC18CU, 0xD1ADU, 0xE1CEU, 0xF1EFU,
  };
  uint16_t crc = 0xFFFFU;
  for (size_t i = 0; i < len; ++i) {
    crc ^= (uint16_t)data[i] << 8;
    crc = (uint16_t)((crc << 4) ^ kNibbleTable[(crc >> 12) & 0x0FU]);
    crc = (uint16_t)((crc << 4) ^ kNibbleTable[(crc >> 12) & 0x0FU]);
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
