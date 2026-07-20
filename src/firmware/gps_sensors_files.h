String defaultMissionProfileJson() {
  return String("{\"schema\":\"flash6-mission-v1\",\"updatedAt\":null,\"profile\":{\"missionName\":\"PIONEER-I test flight4 MISSION\"},\"blocks\":[],\"editorBlocks\":[]}");
}

bool isLikelyJsonObject(const String& body) {
  String s = body;
  s.trim();
  return s.length() >= 2 && s[0] == '{' && s[s.length() - 1] == '}';
}

bool isLikelyJsonObject(const char* body, size_t len) {
  if (!body || len < 2U) return false;
  size_t start = 0;
  while (start < len && isspace((unsigned char)body[start])) start++;
  size_t end = len;
  while (end > start && isspace((unsigned char)body[end - 1U])) end--;
  return end >= start + 2U && body[start] == '{' && body[end - 1U] == '}';
}

String readTextFile(const char* path, size_t maxBytes) {
  if (!flashFsReady || !path) return String();
  FileSystemLock lock;
  if (!lock) return String();
  if (!LittleFS.exists(path)) return String();
  File f = LittleFS.open(path, FILE_READ);
  if (!f) return String();
  const size_t size = f.size();
  if (size == 0 || size > maxBytes) {
    f.close();
    return String();
  }
  String out;
  out.reserve(size + 1U);
  char buffer[256];
  while (f.available()) {
    const size_t count = f.readBytes(buffer, sizeof(buffer));
    if (count == 0) break;
    out.concat(buffer, count);
  }
  f.close();
  return out.length() == size ? out : String();
}

bool writeTextFile(const char* path, const String& body) {
  if (!flashFsReady || !path || body.length() == 0 || body.length() > kMissionProfileMaxBytes) return false;
  FileSystemLock lock;
  if (!lock) return false;
  File f = LittleFS.open(path, FILE_WRITE);
  if (!f) return false;
  const size_t wrote = f.print(body);
  f.flush();
  f.close();
  return wrote == body.length();
}

String missionProfileJson() {
  String body = readTextFile(kMissionProfilePath, kMissionProfileMaxBytes);
  if (body.length() == 0) {
    body = readTextFile("/mission_profile.tmp", kMissionProfileMaxBytes);
  }
  if (body.length() == 0 || !isLikelyJsonObject(body)) return defaultMissionProfileJson();
  return body;
}

bool saveMissionProfileJson(const String& body) {
  if (!isLikelyJsonObject(body)) return false;
  {
    DynamicJsonDocument validation(kMissionProfileMaxBytes + 1024U);
    if (deserializeJson(validation, body)) return false;
  }
  constexpr const char* tempPath = "/mission_profile.tmp";
  if (!writeTextFile(tempPath, body)) return false;
  {
    FileSystemLock lock;
    if (!lock) return false;
    if (LittleFS.exists(kMissionProfilePath) && !LittleFS.remove(kMissionProfilePath)) {
      LittleFS.remove(tempPath);
      return false;
    }
    if (!LittleFS.rename(tempPath, kMissionProfilePath)) {
      return false;
    }
  }
  return loadMissionRuntimeFromFlash();
}

bool decodeBase64Chunk(const String& b64, String& decoded) {
  size_t outLen = 0;
  const size_t inLen = b64.length();
  if (inLen == 0 || inLen > 512) return false;
  uint8_t tmp[384];
  const int rc = mbedtls_base64_decode(tmp, sizeof(tmp), &outLen,
                                       reinterpret_cast<const unsigned char*>(b64.c_str()), inLen);
  if (rc != 0) return false;
  decoded.reserve(decoded.length() + outLen);
  decoded.concat(reinterpret_cast<const char*>(tmp), outLen);
  return true;
}

bool splitCsv(char* line, char** fields, uint8_t maxFields, uint8_t& count) {
  count = 0;
  if (!line || !fields || maxFields == 0) return false;
  char* p = line;
  while (count < maxFields) {
    fields[count++] = p;
    char* comma = strchr(p, ',');
    if (!comma) break;
    *comma = '\0';
    p = comma + 1;
  }
  return count > 0;
}

int8_t nmeaHexValue(char c) {
  if (c >= '0' && c <= '9') return (int8_t)(c - '0');
  if (c >= 'A' && c <= 'F') return (int8_t)(c - 'A' + 10);
  if (c >= 'a' && c <= 'f') return (int8_t)(c - 'a' + 10);
  return -1;
}

bool nmeaChecksumValid(const char* line) {
  if (!line || line[0] != '$') return false;
  const char* star = strchr(line, '*');
  if (!star) return true;
  if (star[1] == '\0' || star[2] == '\0') return false;
  const int8_t high = nmeaHexValue(star[1]);
  const int8_t low = nmeaHexValue(star[2]);
  if (high < 0 || low < 0) return false;

  uint8_t checksum = 0;
  for (const char* p = line + 1; p < star; ++p) {
    checksum ^= (uint8_t)*p;
  }
  return checksum == (uint8_t)((high << 4) | low);
}

float parseNmeaCoord(const char* value, const char* hemi) {
  if (!value || !value[0] || !hemi || !hemi[0]) return NAN;
  char* end = nullptr;
  const double raw = strtod(value, &end);
  if (end == value || !isfinite(raw) || raw <= 0.0) return NAN;
  const int deg = (int)(raw / 100.0);
  const double minutes = raw - ((double)deg * 100.0);
  if (!isfinite(minutes) || minutes < 0.0 || minutes >= 60.0) return NAN;
  const char h = hemi[0];
  const bool latitude = h == 'N' || h == 'n' || h == 'S' || h == 's';
  const bool longitude = h == 'E' || h == 'e' || h == 'W' || h == 'w';
  if ((!latitude && !longitude) ||
      (latitude && deg > 90) ||
      (longitude && deg > 180)) {
    return NAN;
  }
  double out = (double)deg + (minutes / 60.0);
  if (h == 'S' || h == 's' || h == 'W' || h == 'w') out = -out;
  return (float)out;
}

bool parseNmeaUtcMs(const char* value, uint32_t& utcMsOut) {
  if (!value || strlen(value) < 6) return false;
  char* end = nullptr;
  const double raw = strtod(value, &end);
  if (end == value || !isfinite(raw) || raw < 0.0) return false;

  const uint32_t whole = (uint32_t)raw;
  const uint8_t hour = (uint8_t)(whole / 10000U);
  const uint8_t minute = (uint8_t)((whole / 100U) % 100U);
  const uint8_t second = (uint8_t)(whole % 100U);
  if (hour > 23U || minute > 59U || second > 59U) return false;

  const double fraction = raw - (double)whole;
  const uint32_t millisPart = (uint32_t)fmin(999.0, floor(fmax(0.0, fraction) * 1000.0 + 0.5));
  utcMsOut =
    ((uint32_t)hour * 3600000UL) +
    ((uint32_t)minute * 60000UL) +
    ((uint32_t)second * 1000UL) +
    millisPart;
  return true;
}

bool parseNmeaDateEpochDay(const char* value, uint32_t& epochDayOut) {
  if (!value || strlen(value) < 6) return false;
  for (uint8_t i = 0; i < 6; ++i) {
    if (value[i] < '0' || value[i] > '9') return false;
  }
  const uint8_t day = (uint8_t)((value[0] - '0') * 10 + (value[1] - '0'));
  const uint8_t month = (uint8_t)((value[2] - '0') * 10 + (value[3] - '0'));
  const uint8_t year2 = (uint8_t)((value[4] - '0') * 10 + (value[5] - '0'));
  const int32_t year = year2 >= 80U ? (1900 + year2) : (2000 + year2);
  if (day < 1U || day > 31U || month < 1U || month > 12U) return false;

  const int32_t adjustedYear = year - (month <= 2U ? 1 : 0);
  const int32_t era = adjustedYear / 400;
  const uint32_t yearOfEra = (uint32_t)(adjustedYear - era * 400);
  const uint32_t adjustedMonth = month > 2U ? (uint32_t)month - 3U : (uint32_t)month + 9U;
  const uint32_t dayOfYear = (153U * adjustedMonth + 2U) / 5U + (uint32_t)day - 1U;
  const uint32_t dayOfEra = yearOfEra * 365U + yearOfEra / 4U - yearOfEra / 100U + dayOfYear;
  const int64_t epochDay = (int64_t)era * 146097LL + (int64_t)dayOfEra - 719468LL;
  if (epochDay < 0 || epochDay > UINT32_MAX) return false;
  epochDayOut = (uint32_t)epochDay;
  return true;
}

void gpsUpdateUtc(const char* value) {
  uint32_t utcMs = 0;
  if (!parseNmeaUtcMs(value, utcMs)) return;
  gpsState.utcMsOfDay = utcMs;
  if (gpsState.dateValid) {
    gpsState.utcEpochMs = (uint64_t)gpsState.utcEpochDay * (uint64_t)kDayMs + utcMs;
  }
  gpsState.lastTimeMs = millis();
  gpsState.timeValid = true;
}

void gpsUpdateDate(const char* value) {
  uint32_t epochDay = 0;
  if (!parseNmeaDateEpochDay(value, epochDay)) return;
  gpsState.utcEpochDay = epochDay;
  gpsState.utcEpochMs = (uint64_t)epochDay * (uint64_t)kDayMs + gpsState.utcMsOfDay;
  gpsState.dateValid = true;
}

void gpsMarkSentenceSeen() {
  gpsState.ready = true;
  gpsState.seen = true;
  gpsState.lastSentenceMs = millis();
  gpsState.sentenceCount++;
}

void gpsUpdateFix(float lat, float lon, float alt, bool fixValid) {
  if (fixValid && isfinite(lat) && isfinite(lon)) {
    gpsState.latDeg = lat;
    gpsState.lonDeg = lon;
    if (isfinite(alt)) gpsState.altM = alt;
    gpsState.fix = true;
    gpsState.lastFixMs = millis();
  } else {
    gpsState.fix = false;
  }
}

void gpsNoteParseError() {
  gpsState.parseErrors++;
}

void gpsParseGga(char** f, uint8_t n) {
  if (n < 10) {
    gpsNoteParseError();
    return;
  }
  gpsUpdateUtc(f[1]);
  const int quality = atoi(f[6]);
  const bool fixValid = quality > 0;
  const float lat = parseNmeaCoord(f[2], f[3]);
  const float lon = parseNmeaCoord(f[4], f[5]);
  const float alt = (f[9] && f[9][0]) ? (float)strtod(f[9], nullptr) : NAN;
  gpsUpdateFix(lat, lon, alt, fixValid);
}

void gpsParseRmc(char** f, uint8_t n) {
  if (n < 7) {
    gpsNoteParseError();
    return;
  }
  gpsUpdateUtc(f[1]);
  if (n > 9) gpsUpdateDate(f[9]);
  const bool fixValid = f[2] && (f[2][0] == 'A' || f[2][0] == 'a');
  const float lat = parseNmeaCoord(f[3], f[4]);
  const float lon = parseNmeaCoord(f[5], f[6]);
  gpsUpdateFix(lat, lon, NAN, fixValid);
}

void gpsParseLine(char* line) {
  if (!line || line[0] != '$') return;
  if (!nmeaChecksumValid(line)) {
    gpsNoteParseError();
    return;
  }
  char* star = strchr(line, '*');
  if (star) *star = '\0';

  char* fields[24] = {0};
  uint8_t count = 0;
  if (!splitCsv(line + 1, fields, 24, count) || count == 0) return;

  gpsMarkSentenceSeen();
  const char* type = fields[0];
  const size_t len = strlen(type);
  const char* suffix = (len >= 3) ? (type + len - 3) : type;
  if (strcmp(suffix, "GGA") == 0) {
    gpsParseGga(fields, count);
  } else if (strcmp(suffix, "RMC") == 0) {
    gpsParseRmc(fields, count);
  }
}

uint8_t gpsPairChecksum(const char* payload) {
  uint8_t checksum = 0;
  if (!payload) return checksum;
  while (*payload) {
    checksum ^= (uint8_t)(*payload++);
  }
  return checksum;
}

void gpsSendPairPayload(const char* payload) {
  if (!payload || !gpsState.ready) return;
  char sentence[48];
  snprintf(sentence, sizeof(sentence), "$%s*%02X\r\n", payload, gpsPairChecksum(payload));
  gpsUart.print(sentence);
  delay(8);
}

void gpsConfigureRys352a10Hz(bool logChange) {
  if (!gpsState.ready) return;

  // RYS352A uses REYAX PAIR commands. Keep only the sentences FLASH6 consumes
  // at every fix and use the drone dynamics model before enabling 10 Hz.
  static const char* const commands[] = {
    "PAIR080,5",    // Drone mode: track rapid vertical acceleration and phase changes.
    "PAIR062,0,1",  // GGA once per fix
    "PAIR062,4,1",  // RMC once per fix
    "PAIR062,1,0",  // GLL off
    "PAIR062,2,0",  // GSA off
    "PAIR062,3,0",  // GSV off
    "PAIR062,5,0",  // VTG off
    "PAIR062,6,0",  // ZDA off
    "PAIR062,7,0",  // GRS off
    "PAIR062,8,0",  // GST off
    "PAIR062,9,0",  // GNS off
    "PAIR050,100"   // Apply 100 ms fix interval after reducing NMEA output.
  };

  for (const char* payload : commands) {
    gpsSendPairPayload(payload);
  }
  if (logChange) {
    Serial.printf("[GPS] RYS352A target=%luHz interval=%lums\n",
                  (unsigned long)kGpsTargetHz,
                  (unsigned long)kGpsTargetFixIntervalMs);
  }
}

void stopGps() {
  if (gpsPinsActive || gpsState.ready) {
    gpsUart.end();
    delay(2);
    pinMode(kGpsRx, INPUT);
    pinMode(kGpsTx, INPUT);
  }
  gpsLineLen = 0;
  gpsState.ready = false;
  gpsState.fix = false;
  gpsState.seen = false;
  gpsState.timeValid = false;
  gpsState.ageMs = UINT32_MAX;
  gpsState.lastFixMs = 0;
  gpsState.lastSentenceMs = 0;
  gpsState.lastTimeMs = 0;
  gpsTargetRateConfigured = false;
  gpsState.baud = 0;
  gpsState.rxPin = -1;
  gpsState.txPin = -1;
  gpsPinsActive = false;
}

void gpsApplyConfig(uint8_t index, bool logChange) {
  if (!gpsShouldRun()) {
    stopGps();
    return;
  }
  const uint8_t configCount = (uint8_t)(sizeof(kGpsConfigs) / sizeof(kGpsConfigs[0]));
  if (index >= configCount) index = 0;
  gpsConfigIndex = index;
  const GpsUartConfig& cfg = kGpsConfigs[gpsConfigIndex];

  gpsUart.end();
  delay(2);
  gpsLineLen = 0;
  gpsUart.setRxBufferSize(2048);
  gpsUart.begin(cfg.baud, SERIAL_8N1, cfg.rx, cfg.tx);

  gpsState.ready = true;
  gpsPinsActive = true;
  gpsState.fix = false;
  gpsState.seen = false;
  gpsState.timeValid = false;
  gpsState.ageMs = UINT32_MAX;
  gpsState.lastTimeMs = 0;
  gpsState.baud = cfg.baud;
  gpsState.rxPin = cfg.rx;
  gpsState.txPin = cfg.tx;
  gpsLastAutodetectMs = millis();
  gpsSentenceCountAtSwitch = gpsState.sentenceCount;
  gpsTargetRateConfigured = false;

  if (logChange) {
    Serial.printf("[GPS] UART try baud=%lu rx=%d tx=%d\n",
                  (unsigned long)cfg.baud, (int)cfg.rx, (int)cfg.tx);
  }
}

void initGps() {
  if (!gpsShouldRun()) {
    stopGps();
    return;
  }
  gpsApplyConfig(0, true);
}

void updateSharedSensorPins() {
  if (!sensorPinsRuntimeReady) return;

  if (loadcellShouldRun()) {
    if (gpsPinsActive || gpsState.ready) stopGps();
    if (!loadcellPinsActive || !loadcellReady) initLoadcell();
    return;
  }

  if (loadcellPinsActive || loadcellReady) releaseLoadcellPins();

  if (gpsShouldRun()) {
    if (!gpsPinsActive || !gpsState.ready) initGps();
    return;
  }

  if (gpsPinsActive || gpsState.ready) stopGps();
}

void gpsServiceAutodetect() {
  if (!gpsState.ready) return;
  const uint32_t nowMs = millis();
  if (gpsState.seen && gpsState.lastSentenceMs != 0 &&
      (uint32_t)(nowMs - gpsState.lastSentenceMs) <= kGpsFixStaleMs) {
    return;
  }
  if ((uint32_t)(nowMs - gpsLastAutodetectMs) < kGpsAutodetectPeriodMs) return;
  if (gpsState.sentenceCount != gpsSentenceCountAtSwitch) {
    gpsLastAutodetectMs = nowMs;
    gpsSentenceCountAtSwitch = gpsState.sentenceCount;
    return;
  }
  const uint8_t configCount = (uint8_t)(sizeof(kGpsConfigs) / sizeof(kGpsConfigs[0]));
  gpsApplyConfig((uint8_t)((gpsConfigIndex + 1U) % configCount), false);
}

void pollGps() {
  if (!gpsShouldRun()) {
    if (gpsPinsActive || gpsState.ready) stopGps();
    return;
  }
  if (!gpsState.ready) initGps();
  if (!gpsState.ready) return;

  uint16_t drained = 0;
  while (gpsUart.available() > 0 && drained < 256U) {
    drained++;
    const char c = (char)gpsUart.read();
    gpsState.rawBytes++;
    if (c == '\r') continue;
    if (c == '\n') {
      if (gpsLineLen > 0) {
        gpsLine[gpsLineLen] = '\0';
        gpsParseLine(gpsLine);
        gpsLineLen = 0;
      }
      continue;
    }
    if (gpsLineLen < kGpsLineMax) {
      gpsLine[gpsLineLen++] = c;
    } else {
      gpsLineLen = 0;
      gpsNoteParseError();
    }
  }

  const uint32_t nowMs = millis();
  static uint32_t lastHousekeepingMs = 0;
  if (drained == 0U &&
      lastHousekeepingMs != 0U &&
      (uint32_t)(nowMs - lastHousekeepingMs) < kGpsHousekeepingPeriodMs) {
    return;
  }
  lastHousekeepingMs = nowMs;
  const uint32_t sentenceAgeMs = gpsState.lastSentenceMs
    ? (uint32_t)(nowMs - gpsState.lastSentenceMs)
    : UINT32_MAX;
  gpsState.ageMs = gpsState.lastFixMs
    ? (uint32_t)(nowMs - gpsState.lastFixMs)
    : UINT32_MAX;
  if (gpsState.seen && sentenceAgeMs > kGpsFixStaleMs) gpsState.seen = false;
  if (gpsState.fix && gpsState.ageMs > kGpsFixStaleMs) gpsState.fix = false;
  if (gpsState.timeValid && gpsState.lastTimeMs != 0 &&
      (uint32_t)(nowMs - gpsState.lastTimeMs) > kGpsFixStaleMs) {
    gpsState.timeValid = false;
  }
  if (gpsState.seen && !gpsTargetRateConfigured) {
    gpsTargetRateConfigured = true;
    gpsConfigureRys352a10Hz(true);
    gpsLastAutodetectMs = millis();
  }
  gpsServiceAutodetect();
}

void syncGpsTelemetry(bool force) {
  const uint32_t nowMs = millis();
  static uint32_t lastSyncMs = 0;
  if (!force &&
      lastSyncMs != 0U &&
      (uint32_t)(nowMs - lastSyncMs) < kGpsHousekeepingPeriodMs) {
    return;
  }
  lastSyncMs = nowMs;
  snap.gpsReady = gpsState.ready;
  snap.gpsFix = gpsState.fix;
  snap.gpsSeen = gpsState.seen;
  snap.gpsTimeValid = gpsState.timeValid;
  snap.gpsUtcMs = gpsState.timeValid
    ? (gpsState.utcMsOfDay + (uint32_t)(nowMs - gpsState.lastTimeMs)) % kDayMs
    : UINT32_MAX;
  snap.gpsDateValid = gpsState.timeValid && gpsState.dateValid;
  snap.gpsEpochMs = snap.gpsDateValid
    ? ((uint64_t)gpsState.utcEpochDay * (uint64_t)kDayMs + (uint64_t)snap.gpsUtcMs)
    : 0;
  snap.gpsAgeMs = gpsState.ageMs;
  snap.gpsRawBytes = gpsState.rawBytes;
  snap.gpsSentenceCount = gpsState.sentenceCount;
  snap.gpsParseErrors = gpsState.parseErrors;
  snap.gpsBaud = gpsState.baud;
  snap.gpsRxPin = gpsState.rxPin;
  snap.gpsTxPin = gpsState.txPin;
  snap.gpsLat = gpsState.fix ? gpsState.latDeg : NAN;
  snap.gpsLon = gpsState.fix ? gpsState.lonDeg : NAN;
  snap.gpsAlt = gpsState.fix ? gpsState.altM : NAN;
}

void formatGpsFieldsFor(
  const Telemetry& source,
  char* lat,
  size_t latLen,
  char* lon,
  size_t lonLen,
  char* alt,
  size_t altLen
) {
  if (!lat || !lon || !alt || latLen == 0 || lonLen == 0 || altLen == 0) return;
  strlcpy(lat, "null", latLen);
  strlcpy(lon, "null", lonLen);
  strlcpy(alt, "null", altLen);
  if (source.gpsFix && isfinite(source.gpsLat) && isfinite(source.gpsLon)) {
    snprintf(lat, latLen, "%.7f", source.gpsLat);
    snprintf(lon, lonLen, "%.7f", source.gpsLon);
    snprintf(alt, altLen, "%.2f", isfinite(source.gpsAlt) ? source.gpsAlt : 0.0f);
  }
}

void formatGpsFields(char* lat, size_t latLen, char* lon, size_t lonLen, char* alt, size_t altLen) {
  formatGpsFieldsFor(snap, lat, latLen, lon, lonLen, alt, altLen);
}

float pressureAltitudeM(float pressureMpa, float referenceMpa) {
  if (!isfinite(pressureMpa) || !isfinite(referenceMpa) || pressureMpa <= 0.0f || referenceMpa <= 0.0f) return 0.0f;
  const float ratio = pressureMpa / referenceMpa;
  if (!isfinite(ratio) || ratio <= 0.0f) return 0.0f;
  return 44330.0f * (1.0f - powf(ratio, 0.190294957f));
}

void loadBaroConfig() {
  baroPrefsReady = baroPrefs.begin("baro", false);
  if (!baroPrefsReady) return;
  const float savedSeaLevel = baroPrefs.isKey("sea_hpa")
    ? baroPrefs.getFloat("sea_hpa", kDefaultSeaLevelHpa)
    : kDefaultSeaLevelHpa;
  if (isfinite(savedSeaLevel) && savedSeaLevel >= 850.0f && savedSeaLevel <= 1100.0f) {
    seaLevelHpa = savedSeaLevel;
  }
}

void saveBaroConfig() {
  if (!baroPrefsReady) baroPrefsReady = baroPrefs.begin("baro", false);
  if (!baroPrefsReady) return;
  const float saved = baroPrefs.isKey("sea_hpa")
    ? baroPrefs.getFloat("sea_hpa", NAN)
    : NAN;
  if (!isfinite(saved) || fabsf(saved - seaLevelHpa) >= 0.005f) {
    baroPrefs.putFloat("sea_hpa", seaLevelHpa);
  }
}

bool setSeaLevelHpa(float hpa) {
  if (!isfinite(hpa) || hpa < 850.0f || hpa > 1100.0f) return false;
  if (fabsf(seaLevelHpa - hpa) < 0.005f) return true;
  seaLevelHpa = hpa;
  saveBaroConfig();
  return true;
}

void resetBaroBase() {
  baroBasePressureMpa = 0.0f;
  baroBaseSumMpa = 0.0f;
  baroBaseSamples = 0;
  baroBaseReady = false;
  if (baroFilterReady && baroPressureFilteredMpa > 0.0f) {
    baroBasePressureMpa = baroPressureFilteredMpa;
    baroBaseReady = true;
    snap.altM = 0.0f;
  }
}

bool i2cPing(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void normalizeQuatValues(float& q0, float& q1, float& q2, float& q3) {
  const float norm = sqrtf((q0 * q0) + (q1 * q1) + (q2 * q2) + (q3 * q3));
  if (!isfinite(norm) || norm < 1e-8f) {
    q0 = 1.0f; q1 = 0.0f; q2 = 0.0f; q3 = 0.0f;
    return;
  }
  const float inv = 1.0f / norm;
  q0 *= inv; q1 *= inv; q2 *= inv; q3 *= inv;
}

void eulerToStandardQuat(
  float rollDeg,
  float pitchDeg,
  float yawDeg,
  float& q0,
  float& q1,
  float& q2,
  float& q3
) {
  const float cr = cosf(rollDeg * 0.5f * kDegToRad);
  const float sr = sinf(rollDeg * 0.5f * kDegToRad);
  const float cp = cosf(pitchDeg * 0.5f * kDegToRad);
  const float sp = sinf(pitchDeg * 0.5f * kDegToRad);
  const float cy = cosf(yawDeg * 0.5f * kDegToRad);
  const float sy = sinf(yawDeg * 0.5f * kDegToRad);
  q0 = (cr * cp * cy) + (sr * sp * sy);
  q1 = (sr * cp * cy) - (cr * sp * sy);
  q2 = (cr * sp * cy) + (sr * cp * sy);
  q3 = (cr * cp * sy) - (sr * sp * cy);
  normalizeQuatValues(q0, q1, q2, q3);
}

void loadGyroZero() {
  prefsReady = prefs.begin("gyro", false);
  if (!prefsReady) return;
  zeroRoll = prefs.isKey("zr") ? prefs.getFloat("zr", 0.0f) : 0.0f;
  zeroPitch = prefs.isKey("zp") ? prefs.getFloat("zp", 0.0f) : 0.0f;
  zeroYaw = prefs.isKey("zy") ? prefs.getFloat("zy", 0.0f) : 0.0f;
  zeroRoll = wrap180(zeroRoll);
  zeroPitch = clampFloat(zeroPitch, -89.5f, 89.5f);
  zeroYaw = wrap180(zeroYaw);
  if (prefs.isKey("zqw") && prefs.isKey("zqx") && prefs.isKey("zqy") && prefs.isKey("zqz")) {
    zeroQ0 = prefs.getFloat("zqw", 1.0f);
    zeroQ1 = prefs.getFloat("zqx", 0.0f);
    zeroQ2 = prefs.getFloat("zqy", 0.0f);
    zeroQ3 = prefs.getFloat("zqz", 0.0f);
    normalizeQuatValues(zeroQ0, zeroQ1, zeroQ2, zeroQ3);
  } else {
    eulerToStandardQuat(zeroRoll, zeroPitch, zeroYaw, zeroQ0, zeroQ1, zeroQ2, zeroQ3);
  }
}

void saveGyroZero() {
  if (!prefsReady) prefsReady = prefs.begin("gyro", false);
  if (!prefsReady) return;
  prefs.putFloat("zr", zeroRoll);
  prefs.putFloat("zp", zeroPitch);
  prefs.putFloat("zy", zeroYaw);
  prefs.putFloat("zqw", zeroQ0);
  prefs.putFloat("zqx", zeroQ1);
  prefs.putFloat("zqy", zeroQ2);
  prefs.putFloat("zqz", zeroQ3);
}

void clearGyroZero() {
  zeroRoll = 0.0f;
  zeroPitch = 0.0f;
  zeroYaw = 0.0f;
  zeroQ0 = 1.0f;
  zeroQ1 = 0.0f;
  zeroQ2 = 0.0f;
  zeroQ3 = 0.0f;
  saveGyroZero();
}

void setGyroZeroTarget(float targetRoll, float targetPitch, float targetYaw) {
  zeroRoll = wrap180(targetRoll - rawRoll);
  zeroPitch = clampFloat(targetPitch - rawPitch, -89.5f, 89.5f);
  zeroYaw = wrap180(targetYaw - rawYaw);
  float targetQ0, targetQ1, targetQ2, targetQ3;
  eulerToStandardQuat(targetRoll, targetPitch, targetYaw, targetQ0, targetQ1, targetQ2, targetQ3);
  zeroQ0 = (targetQ0 * attitudeQ0) + (targetQ1 * attitudeQ1) +
    (targetQ2 * attitudeQ2) + (targetQ3 * attitudeQ3);
  zeroQ1 = (-targetQ0 * attitudeQ1) + (targetQ1 * attitudeQ0) -
    (targetQ2 * attitudeQ3) + (targetQ3 * attitudeQ2);
  zeroQ2 = (-targetQ0 * attitudeQ2) + (targetQ1 * attitudeQ3) +
    (targetQ2 * attitudeQ0) - (targetQ3 * attitudeQ1);
  zeroQ3 = (-targetQ0 * attitudeQ3) - (targetQ1 * attitudeQ2) +
    (targetQ2 * attitudeQ1) + (targetQ3 * attitudeQ0);
  normalizeQuatValues(zeroQ0, zeroQ1, zeroQ2, zeroQ3);
  saveGyroZero();
}

void normalizeAttitudeQuat() {
  const float n = sqrtf(
    attitudeQ0 * attitudeQ0 +
    attitudeQ1 * attitudeQ1 +
    attitudeQ2 * attitudeQ2 +
    attitudeQ3 * attitudeQ3);
  if (!isfinite(n) || n < 1e-9f) {
    attitudeQ0 = 1.0f;
    attitudeQ1 = 0.0f;
    attitudeQ2 = 0.0f;
    attitudeQ3 = 0.0f;
    return;
  }
  const float inv = 1.0f / n;
  attitudeQ0 *= inv;
  attitudeQ1 *= inv;
  attitudeQ2 *= inv;
  attitudeQ3 *= inv;
}

void setAttitudeQuatFromEuler(float rollDeg, float pitchDeg, float yawDeg) {
  const float cr = cosf(rollDeg * 0.5f * kDegToRad);
  const float sr = sinf(rollDeg * 0.5f * kDegToRad);
  const float cp = cosf(pitchDeg * 0.5f * kDegToRad);
  const float sp = sinf(pitchDeg * 0.5f * kDegToRad);
  const float cy = cosf(yawDeg * 0.5f * kDegToRad);
  const float sy = sinf(yawDeg * 0.5f * kDegToRad);
  attitudeQ0 = (cr * cp * cy) + (sr * sp * sy);
  attitudeQ1 = (sr * cp * cy) - (cr * sp * sy);
  attitudeQ2 = (cr * sp * cy) + (sr * cp * sy);
  attitudeQ3 = (cr * cp * sy) - (sr * sp * cy);
  normalizeAttitudeQuat();
}

void updateEulerFromAttitudeQuat() {
  normalizeAttitudeQuat();
  const float sinrCosp = 2.0f * ((attitudeQ0 * attitudeQ1) + (attitudeQ2 * attitudeQ3));
  const float cosrCosp = 1.0f - 2.0f * ((attitudeQ1 * attitudeQ1) + (attitudeQ2 * attitudeQ2));
  rawRoll = wrap180(atan2f(sinrCosp, cosrCosp) * kRadToDeg);

  const float sinp = 2.0f * ((attitudeQ0 * attitudeQ2) - (attitudeQ3 * attitudeQ1));
  rawPitch = fabsf(sinp) >= 1.0f
    ? copysignf(89.5f, sinp)
    : clampFloat(asinf(sinp) * kRadToDeg, -89.5f, 89.5f);

  const float sinyCosp = 2.0f * ((attitudeQ0 * attitudeQ3) + (attitudeQ1 * attitudeQ2));
  const float cosyCosp = 1.0f - 2.0f * ((attitudeQ2 * attitudeQ2) + (attitudeQ3 * attitudeQ3));
  rawYaw = wrap180(atan2f(sinyCosp, cosyCosp) * kRadToDeg);
}

void resetAttitudeFilter() {
  attitudeLastUs = 0;
  attitudeQ0 = 1.0f;
  attitudeQ1 = 0.0f;
  attitudeQ2 = 0.0f;
  attitudeQ3 = 0.0f;
  attitudeIntX = 0.0f;
  attitudeIntY = 0.0f;
  attitudeIntZ = 0.0f;
  gyroStillFrames = 0;
  rawRoll = 0.0f;
  rawPitch = 0.0f;
  rawYaw = 0.0f;
  snap.attitudeValid = false;
}

void initImu() {
  Wire.begin(kI2cSda, kI2cScl);
  Wire.setClock(kI2cBusHz);
  Wire.setTimeOut(kI2cTimeoutMs);

  imuAddr = 0x6A;
  if (!i2cPing(0x6A) && i2cPing(0x6B)) imuAddr = 0x6B;

  if (!imu.begin_I2C(imuAddr, &Wire)) {
    Wire.setClock(100000U);
    if (!imu.begin_I2C(imuAddr, &Wire)) {
      imuReady = false;
      Serial.printf("[IMU] LSM6DSOX init failed addr=0x%02X sda=%d scl=%d\n", imuAddr, kI2cSda, kI2cScl);
      return;
    }
  }

  Wire.setClock(kI2cBusHz);
  Wire.setTimeOut(kI2cTimeoutMs);
  imu.setAccelRange(LSM6DS_ACCEL_RANGE_16_G);
  imu.setGyroRange(LSM6DS_GYRO_RANGE_2000_DPS);
  imu.setAccelDataRate(LSM6DS_RATE_416_HZ);
  imu.setGyroDataRate(LSM6DS_RATE_416_HZ);
  imuConsecutiveErrors = 0;
  resetAttitudeFilter();
  imuReady = true;
  Serial.printf("[IMU] LSM6DSOX ready addr=0x%02X sample=%luHz sensor_odr=416Hz\n",
                imuAddr, (unsigned long)kImuSampleHz);
}

void initBarometer() {
  baroReady = false;
  baroAddr = 0x00;
  Wire.setClock(kI2cBusHz);

  const uint8_t addrs[] = {0x76, 0x77};
  for (uint8_t addr : addrs) {
    if (!i2cPing(addr)) continue;
    if (bmp.begin(addr)) {
      baroAddr = addr;
      baroReady = true;
      break;
    }
  }

  if (!baroReady) {
    Serial.println("[BARO] BMP280 init failed addr=0x76/0x77");
    Wire.setClock(kI2cBusHz);
    return;
  }

  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                  Adafruit_BMP280::SAMPLING_X1,
                  Adafruit_BMP280::SAMPLING_X4,
                  Adafruit_BMP280::FILTER_X4,
                  Adafruit_BMP280::STANDBY_MS_1);
  baroFilterReady = false;
  resetBaroBase();
  Wire.setClock(kI2cBusHz);
  Serial.printf("[BARO] BMP280 ready addr=0x%02X sea=%.2fhPa\n", baroAddr, seaLevelHpa);
}

void updateAttitude(
  float ax,
  float ay,
  float az,
  float gx,
  float gy,
  float gz,
  float accMag
) {
  const uint32_t nowUs = micros();
  float dt = 0.0f;
  if (attitudeLastUs != 0 && nowUs >= attitudeLastUs) {
    dt = (float)(nowUs - attitudeLastUs) / 1000000.0f;
  }
  if (!isfinite(dt) || dt < 0.0f || dt > 0.35f) dt = 0.0f;
  attitudeLastUs = nowUs;

  const bool accOk = isfinite(accMag) &&
                     accMag >= kAttitudeInitAccMinG &&
                     accMag <= kAttitudeInitAccMaxG;
  const float gravityErr = fabsf(accMag - 1.0f);
  const float rateMag = sqrtf(gx * gx + gy * gy + gz * gz);
  const bool stationaryHold = gyroStillFrames >= kStationaryFramesHardLock;
  if (!snap.attitudeValid) {
    if (!accOk) return;
    const float accelRoll = atan2f(ay, az) * kRadToDeg;
    const float accelPitch = atan2f(-ax, sqrtf(ay * ay + az * az)) * kRadToDeg;
    rawRoll = wrap180(accelRoll);
    rawPitch = clampFloat(accelPitch, -89.5f, 89.5f);
    rawYaw = 0.0f;
    setAttitudeQuatFromEuler(rawRoll, rawPitch, rawYaw);
    snap.attitudeValid = true;
  } else {
    float gxRad = gx * kDegToRad;
    float gyRad = gy * kDegToRad;
    float gzRad = gz * kDegToRad;

    // Gyro bias is already learned independently. Discard stale Mahony integral
    // correction at rest so it cannot project into another axis when tilted.
    if (stationaryHold) {
      attitudeIntX = 0.0f;
      attitudeIntY = 0.0f;
      attitudeIntZ = 0.0f;
    }

    if (accOk && dt > 0.0f) {
      const float invAcc = 1.0f / accMag;
      const float axN = ax * invAcc;
      const float ayN = ay * invAcc;
      const float azN = az * invAcc;

      const float vx = 2.0f * ((attitudeQ1 * attitudeQ3) - (attitudeQ0 * attitudeQ2));
      const float vy = 2.0f * ((attitudeQ0 * attitudeQ1) + (attitudeQ2 * attitudeQ3));
      const float vz = (attitudeQ0 * attitudeQ0) -
                       (attitudeQ1 * attitudeQ1) -
                       (attitudeQ2 * attitudeQ2) +
                       (attitudeQ3 * attitudeQ3);

      const float ex = (ayN * vz) - (azN * vy);
      const float ey = (azN * vx) - (axN * vz);
      const float ez = (axN * vy) - (ayN * vx);
      const float trustFromG =
        1.0f - clampFloat((gravityErr - 0.02f) / kAttitudeAccelTrustErrG, 0.0f, 1.0f);
      const float trustFromRate =
        1.0f - clampFloat((rateMag - 10.0f) / kAttitudeRateTrustMaxDps, 0.0f, 1.0f);
      const float trust = clampFloat(trustFromG * trustFromRate, 0.0f, 1.0f);
      const float kp =
        (stationaryHold ? kMahonyKpStill : kMahonyKpMotion) * trust;
      const float ki =
        (stationaryHold
          ? 0.0f
          : ((gyroStillFrames >= kStationaryFramesFastBias) ? kMahonyKiStill : kMahonyKiMotion)) * trust;

      attitudeIntX += ki * ex * dt;
      attitudeIntY += ki * ey * dt;
      attitudeIntZ += ki * ez * dt;
      attitudeIntX = clampFloat(attitudeIntX, -kMahonyIntegralLimitRadS, kMahonyIntegralLimitRadS);
      attitudeIntY = clampFloat(attitudeIntY, -kMahonyIntegralLimitRadS, kMahonyIntegralLimitRadS);
      attitudeIntZ = clampFloat(attitudeIntZ, -kMahonyIntegralLimitRadS, kMahonyIntegralLimitRadS);

      gxRad += (kp * ex) + attitudeIntX;
      gyRad += (kp * ey) + attitudeIntY;
      gzRad += (kp * ez) + attitudeIntZ;
    } else {
      attitudeIntX *= 0.995f;
      attitudeIntY *= 0.995f;
      attitudeIntZ *= 0.995f;
    }

    if (dt > 0.0f) {
      const float qDot0 = 0.5f * (
        (-attitudeQ1 * gxRad) - (attitudeQ2 * gyRad) - (attitudeQ3 * gzRad));
      const float qDot1 = 0.5f * (
        ( attitudeQ0 * gxRad) + (attitudeQ2 * gzRad) - (attitudeQ3 * gyRad));
      const float qDot2 = 0.5f * (
        ( attitudeQ0 * gyRad) - (attitudeQ1 * gzRad) + (attitudeQ3 * gxRad));
      const float qDot3 = 0.5f * (
        ( attitudeQ0 * gzRad) + (attitudeQ1 * gyRad) - (attitudeQ2 * gxRad));
      attitudeQ0 += qDot0 * dt;
      attitudeQ1 += qDot1 * dt;
      attitudeQ2 += qDot2 * dt;
      attitudeQ3 += qDot3 * dt;
      updateEulerFromAttitudeQuat();
    }
  }

  snap.roll = wrap180(rawRoll + zeroRoll);
  snap.pitch = clampFloat(rawPitch + zeroPitch, -89.5f, 89.5f);
  snap.yaw = wrap180(rawYaw + zeroYaw);
  snap.attitudeQw = (zeroQ0 * attitudeQ0) - (zeroQ1 * attitudeQ1) -
    (zeroQ2 * attitudeQ2) - (zeroQ3 * attitudeQ3);
  snap.attitudeQx = (zeroQ0 * attitudeQ1) + (zeroQ1 * attitudeQ0) +
    (zeroQ2 * attitudeQ3) - (zeroQ3 * attitudeQ2);
  snap.attitudeQy = (zeroQ0 * attitudeQ2) - (zeroQ1 * attitudeQ3) +
    (zeroQ2 * attitudeQ0) + (zeroQ3 * attitudeQ1);
  snap.attitudeQz = (zeroQ0 * attitudeQ3) + (zeroQ1 * attitudeQ2) -
    (zeroQ2 * attitudeQ1) + (zeroQ3 * attitudeQ0);
  normalizeQuatValues(
    snap.attitudeQw,
    snap.attitudeQx,
    snap.attitudeQy,
    snap.attitudeQz);
}

void sampleImu() {
  const uint32_t nowUs = micros();
  if (lastSampleUs != 0 && (uint32_t)(nowUs - lastSampleUs) < kSamplePeriodUs) return;
  const uint32_t startUs = micros();
  const uint32_t prevUs = lastSampleUs;
  lastSampleUs = nowUs;

  const uint32_t nowMs = millis();
  snap.ut = nowMs - bootMs;
  snap.lt = prevUs == 0 ? (float)kSamplePeriodUs / 1000.0f : (float)(nowUs - prevUs) / 1000.0f;

  if (!imuReady) {
    static uint32_t lastRetryMs = 0;
    if ((uint32_t)(nowMs - lastRetryMs) > 1000U) {
      lastRetryMs = nowMs;
      initImu();
    }
    snap.sampleValid = false;
    snap.flightRawAccelMagnitudeG = NAN;
    snap.attitudeValid = false;
    snap.ct = (uint16_t)min<uint32_t>(65535U, micros() - startUs);
    return;
  }

  sensors_event_t accel{};
  sensors_event_t gyro{};
  sensors_event_t temp{};
  const bool readOk = imu.getEvent(&accel, &gyro, &temp);

  const float ax = accel.acceleration.x / kG;
  const float ay = accel.acceleration.y / kG;
  const float az = accel.acceleration.z / kG;
  const float rawGx = gyro.gyro.x * kRadToDeg;
  const float rawGy = gyro.gyro.y * kRadToDeg;
  const float rawGz = gyro.gyro.z * kRadToDeg;
  const bool valuesValid =
    readOk &&
    isfinite(ax) && isfinite(ay) && isfinite(az) &&
    isfinite(rawGx) && isfinite(rawGy) && isfinite(rawGz) &&
    isfinite(temp.temperature);
  if (!valuesValid) {
    imuReadErrors++;
    if (imuConsecutiveErrors < UINT8_MAX) imuConsecutiveErrors++;
    snap.sampleValid = false;
    snap.flightRawAccelMagnitudeG = NAN;
    if (imuConsecutiveErrors >= 10U &&
        (lastImuValidMs == 0U ||
         (uint32_t)(nowMs - lastImuValidMs) > 250U)) {
      imuReady = false;
      snap.attitudeValid = false;
    }
    snap.ct = (uint16_t)min<uint32_t>(65535U, micros() - startUs);
    return;
  }
  imuConsecutiveErrors = 0;
  lastImuValidMs = nowMs;
  const float accMag = sqrtf(ax * ax + ay * ay + az * az);
  snap.flightRawAccelMagnitudeG = accMag;
  const float rawRateMag = sqrtf(rawGx * rawGx + rawGy * rawGy + rawGz * rawGz);
  const bool biasCalStationary =
    isfinite(accMag) &&
    fabsf(accMag - 1.0f) <= 0.10f &&
    rawRateMag <= 8.0f;

  if (!bootBiasReady && biasCalStationary && biasSamples < 160) {
    biasSumX += rawGx;
    biasSumY += rawGy;
    biasSumZ += rawGz;
    biasSamples++;
    if (biasSamples >= 80) {
      gyroBiasX = biasSumX / biasSamples;
      gyroBiasY = biasSumY / biasSamples;
      gyroBiasZ = biasSumZ / biasSamples;
      bootBiasReady = true;
      Serial.printf("[IMU] gyro bias %.3f %.3f %.3f dps\n", gyroBiasX, gyroBiasY, gyroBiasZ);
    }
  }

  if (bootBiasReady && kGyroAutoBiasEnabled) {
    const bool accNear1g = isfinite(accMag) && fabsf(accMag - 1.0f) <= kStationaryAccTolG;
    const float correctedRawX = rawGx - gyroBiasX;
    const float correctedRawY = rawGy - gyroBiasY;
    const float correctedRawZ = rawGz - gyroBiasZ;
    const float correctedRateMag =
      sqrtf(correctedRawX * correctedRawX +
            correctedRawY * correctedRawY +
            correctedRawZ * correctedRawZ);
    const bool gyroSmall =
      isfinite(correctedRateMag) && correctedRateMag <= kStationaryGyroTolRawDps;
    if (accNear1g && gyroSmall) {
      if (gyroStillFrames < UINT16_MAX) gyroStillFrames++;
      const float biasAlpha =
        (gyroStillFrames >= kStationaryFramesFastBias)
          ? kGyroAutoBiasAlphaFast
          : kGyroAutoBiasAlphaSlow;
      gyroBiasX += (rawGx - gyroBiasX) * biasAlpha;
      gyroBiasY += (rawGy - gyroBiasY) * biasAlpha;
      gyroBiasZ += (rawGz - gyroBiasZ) * biasAlpha;
    } else {
      gyroStillFrames = 0;
    }
  }

  snap.ax = ax;
  snap.ay = ay;
  snap.az = az;
  snap.gx = rawGx - gyroBiasX;
  snap.gy = rawGy - gyroBiasY;
  snap.gz = rawGz - gyroBiasZ;
  if (fabsf(snap.gx) < kGyroOutputDeadbandDps) snap.gx = 0.0f;
  if (fabsf(snap.gy) < kGyroOutputDeadbandDps) snap.gy = 0.0f;
  if (fabsf(snap.gz) < kGyroOutputDeadbandDps) snap.gz = 0.0f;
  if (gyroStillFrames >= kStationaryFramesHardLock) {
    snap.gx = 0.0f;
    snap.gy = 0.0f;
    snap.gz = 0.0f;
  }
  snap.imuTempC = temp.temperature;
  snap.sampleValid = true;
  updateAttitude(snap.ax, snap.ay, snap.az, snap.gx, snap.gy, snap.gz, accMag);
  snap.ct = (uint16_t)min<uint32_t>(65535U, micros() - startUs);
  storageEnqueueSample(snap.ut);
}

void sampleChipTemperature() {
  const uint32_t nowMs = millis();
  if (lastChipTempMs != 0 && (uint32_t)(nowMs - lastChipTempMs) < kChipTempPeriodMs) return;
  lastChipTempMs = nowMs;

  const float measured = temperatureRead();
  if (!isfinite(measured) || measured < -40.0f || measured > 125.0f) return;
  if (!isfinite(snap.chipTempC)) snap.chipTempC = measured;
  else snap.chipTempC += (measured - snap.chipTempC) * 0.20f;
}

void sampleBarometer() {
  const uint32_t nowUs = micros();
  if (lastBaroUs != 0 && (uint32_t)(nowUs - lastBaroUs) < kBaroPeriodUs) return;
  lastBaroUs = nowUs;

  const uint32_t nowMs = millis();
  if (!baroReady) {
    static uint32_t lastRetryMs = 0;
    if ((uint32_t)(nowMs - lastRetryMs) > 1500U) {
      lastRetryMs = nowMs;
      initBarometer();
    }
    snap.baroValid = false;
    snap.p = 0.0f;
    snap.altM = 0.0f;
    return;
  }

  const float pressurePa = bmp.readPressure();
  const float tempC = bmp.readTemperature();

  if (!isfinite(pressurePa) || pressurePa < 30000.0f || pressurePa > 120000.0f ||
      !isfinite(tempC) || tempC < -60.0f || tempC > 120.0f) {
    baroReadErrors++;
    if (lastBaroValidMs == 0U ||
        (uint32_t)(nowMs - lastBaroValidMs) > 2000U) {
      snap.baroValid = false;
      baroReady = false;
      baroFilterReady = false;
    }
    return;
  }

  const float pressureMpa = pressurePa / 1000000.0f;
  if (!baroFilterReady) {
    baroPressureFilteredMpa = pressureMpa;
    baroFilterReady = true;
  } else {
    baroPressureFilteredMpa += (pressureMpa - baroPressureFilteredMpa) * 0.25f;
  }

  if (!baroBaseReady) {
    baroBaseSumMpa += baroPressureFilteredMpa;
    baroBaseSamples++;
    if (baroBaseSamples >= 25U) {
      baroBasePressureMpa = baroBaseSumMpa / (float)baroBaseSamples;
      baroBaseReady = isfinite(baroBasePressureMpa) && baroBasePressureMpa > 0.0f;
      Serial.printf("[BARO] altitude zero pressure=%.6fMPa\n", baroBasePressureMpa);
    }
  }

  snap.p = baroPressureFilteredMpa;
  snap.baroTempC = tempC;
  snap.baroValid = true;
  snap.altM = baroBaseReady ? pressureAltitudeM(baroPressureFilteredMpa, baroBasePressureMpa) : 0.0f;
  snap.baroAltMslM = pressureAltitudeM(baroPressureFilteredMpa, seaLevelHpa / 10000.0f);
  lastBaroValidMs = nowMs;
}
