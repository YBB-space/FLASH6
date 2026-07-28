constexpr uint32_t kBoardIdentityMagic = 0x4636534EUL;  // F6SN
constexpr uint8_t kBoardIdentityVersion = 1;
constexpr uint8_t kFlashLinkBindingVersion = 1;

uint64_t flashLinkReadU64(
  Preferences& storage,
  const char* lowKey,
  const char* highKey
) {
  const uint64_t low = storage.getUInt(lowKey, 0U);
  const uint64_t high = storage.getUInt(highKey, 0U);
  return low | (high << 32U);
}

void flashLinkWriteU64(
  Preferences& storage,
  const char* lowKey,
  const char* highKey,
  uint64_t value
) {
  storage.putUInt(lowKey, (uint32_t)(value & 0xFFFFFFFFULL));
  storage.putUInt(highKey, (uint32_t)(value >> 32U));
}

void flashLinkFormatSerial(uint64_t serial, char* out, size_t outLen) {
  if (!out || outLen == 0U) return;
  if (serial == 0U) {
    snprintf(out, outLen, "--");
    return;
  }
  snprintf(
    out,
    outLen,
    "F6-%04X-%04X-%04X-%04X",
    (unsigned)((serial >> 48U) & 0xFFFFU),
    (unsigned)((serial >> 32U) & 0xFFFFU),
    (unsigned)((serial >> 16U) & 0xFFFFU),
    (unsigned)(serial & 0xFFFFU));
}

bool flashLinkParseSerial(const String& text, uint64_t& serial) {
  String normalized = text;
  normalized.trim();
  if (normalized.startsWith("F6-") || normalized.startsWith("f6-")) {
    normalized.remove(0, 3);
  }
  char compact[17] = {};
  uint8_t count = 0;
  for (size_t i = 0; i < normalized.length() && count < 16U; ++i) {
    const char c = normalized.charAt(i);
    if (isxdigit((unsigned char)c)) compact[count++] = c;
  }
  if (count != 16U) return false;
  char* end = nullptr;
  const unsigned long long parsed = strtoull(compact, &end, 16);
  if (!end || *end != '\0' || parsed == 0ULL) return false;
  serial = (uint64_t)parsed;
  return true;
}

void flashLinkPersistBindingSlot(uint8_t nodeId) {
  if (!bindingPrefsReady ||
      nodeId < kFlashLinkNodeIdStage1 ||
      nodeId > kFlashLinkNodeIdStage2) {
    return;
  }
  const uint8_t index = nodeId - kFlashLinkNodeIdStage1;
  const char* lowKey = index == 0U ? "s1_lo" : "s2_lo";
  const char* highKey = index == 0U ? "s1_hi" : "s2_hi";
  flashLinkWriteU64(
    bindingPrefs,
    lowKey,
    highKey,
    flashLinkBindings[index].occupied
      ? flashLinkBindings[index].deviceId
      : 0U);
}

void loadBoardIdentityAndBindings() {
  identityPrefsReady = identityPrefs.begin("flash_identity", false);
  if (identityPrefsReady) {
    const uint32_t magic = identityPrefs.getUInt("magic", 0U);
    const uint8_t version = identityPrefs.getUChar("version", 0U);
    boardSerialNumber = flashLinkReadU64(identityPrefs, "sn_lo", "sn_hi");
    if (magic != kBoardIdentityMagic ||
        version != kBoardIdentityVersion ||
        boardSerialNumber == 0U ||
        boardSerialNumber == UINT64_MAX) {
      boardSerialNumber =
        ((uint64_t)esp_random() << 32U) | (uint64_t)esp_random();
      if (boardSerialNumber == 0U || boardSerialNumber == UINT64_MAX) {
        boardSerialNumber =
          ((uint64_t)esp_random() << 32U) ^ ESP.getEfuseMac() ^ 0x4636534EULL;
      }
      flashLinkWriteU64(identityPrefs, "sn_lo", "sn_hi", boardSerialNumber);
      identityPrefs.putUInt("magic", kBoardIdentityMagic);
      identityPrefs.putUChar("version", kBoardIdentityVersion);
    }
    identityPrefs.end();
    identityPrefsReady = false;
  }

  bindingPrefsReady = bindingPrefs.begin("flash_bind", false);
  if (bindingPrefsReady) {
    const uint8_t version = bindingPrefs.getUChar("version", 0U);
    if (version == kFlashLinkBindingVersion) {
      flashLinkBindings[0].deviceId =
        flashLinkReadU64(bindingPrefs, "s1_lo", "s1_hi");
      flashLinkBindings[1].deviceId =
        flashLinkReadU64(bindingPrefs, "s2_lo", "s2_hi");
      flashLinkBindings[0].occupied = flashLinkBindings[0].deviceId != 0U;
      flashLinkBindings[1].occupied = flashLinkBindings[1].deviceId != 0U;
    } else {
      flashLinkBindings[0] = {};
      flashLinkBindings[1] = {};
      bindingPrefs.putUChar("version", kFlashLinkBindingVersion);
      flashLinkPersistBindingSlot(kFlashLinkNodeIdStage1);
      flashLinkPersistBindingSlot(kFlashLinkNodeIdStage2);
    }
  }

  char serialText[28];
  flashLinkFormatSerial(boardSerialNumber, serialText, sizeof(serialText));
  Serial.printf("[IDENTITY] board_sn=%s persistent=1\n", serialText);
}

uint64_t flashLinkBoundSerial(uint8_t nodeId) {
  if (nodeId < kFlashLinkNodeIdStage1 ||
      nodeId > kFlashLinkNodeIdStage2) {
    return 0U;
  }
  const FlashLinkBindingSlot& slot =
    flashLinkBindings[nodeId - kFlashLinkNodeIdStage1];
  return slot.occupied ? slot.deviceId : 0U;
}

bool flashLinkBindingAllows(uint8_t nodeId, uint64_t serial) {
  return serial != 0U && flashLinkBoundSerial(nodeId) == serial;
}

bool flashLinkBindDevice(uint8_t nodeId, uint64_t serial) {
  if (serial == 0U ||
      nodeId < kFlashLinkNodeIdStage1 ||
      nodeId > kFlashLinkNodeIdStage2) {
    return false;
  }
  const uint8_t index = nodeId - kFlashLinkNodeIdStage1;
  const uint8_t otherIndex = index == 0U ? 1U : 0U;
  if (flashLinkBindings[otherIndex].occupied &&
      flashLinkBindings[otherIndex].deviceId == serial) {
    return false;
  }
  flashLinkBindings[index].occupied = true;
  flashLinkBindings[index].deviceId = serial;
  flashLinkPersistBindingSlot(nodeId);
  flashLinkBindingChanged(nodeId);
  return true;
}

bool flashLinkUnbindDevice(uint8_t nodeId) {
  if (nodeId < kFlashLinkNodeIdStage1 ||
      nodeId > kFlashLinkNodeIdStage2) {
    return false;
  }
  const uint8_t index = nodeId - kFlashLinkNodeIdStage1;
  flashLinkBindings[index] = {};
  flashLinkPersistBindingSlot(nodeId);
  flashLinkBindingChanged(nodeId);
  return true;
}

void flashLinkRecordDiscoveredDevice(
  uint64_t serial,
  uint8_t nodeId,
  const uint8_t* mac,
  bool relayed,
  uint16_t telemetryHz,
  uint8_t capabilities,
  uint32_t nowMs
) {
  if (!flashLinkGroundRole() || serial == 0U ||
      nodeId < kFlashLinkNodeIdStage1 ||
      nodeId > kFlashLinkNodeIdStage2) {
    return;
  }
  int8_t target = -1;
  int8_t oldest = 0;
  uint32_t oldestAge = 0U;
  for (uint8_t i = 0; i < kFlashLinkDiscoveryCacheSize; ++i) {
    FlashLinkDiscoveredDevice& item = flashLinkDiscoveredDevices[i];
    if (item.occupied && item.deviceId == serial) {
      target = (int8_t)i;
      break;
    }
    if (!item.occupied && target < 0) target = (int8_t)i;
    const uint32_t age = item.occupied ? nowMs - item.lastSeenMs : UINT32_MAX;
    if (age >= oldestAge) {
      oldestAge = age;
      oldest = (int8_t)i;
    }
  }
  if (target < 0) target = oldest;
  FlashLinkDiscoveredDevice& item = flashLinkDiscoveredDevices[target];
  item = {};
  item.occupied = true;
  item.relayed = relayed;
  item.nodeId = nodeId;
  item.deviceId = serial;
  item.lastSeenMs = nowMs;
  item.telemetryHz = telemetryHz;
  item.capabilities = capabilities;
  if (mac) memcpy(item.mac, mac, ESP_NOW_ETH_ALEN);
}

String flashLinkDevicesJson() {
  const uint32_t nowMs = millis();
  char boardText[28];
  flashLinkFormatSerial(boardSerialNumber, boardText, sizeof(boardText));
  String json;
  json.reserve(1050);
  json = "{\"ok\":1,\"board_sn\":\"";
  json += boardText;
  json += "\",\"max_bindings\":2,\"bindings\":[";
  for (uint8_t i = 0; i < kFlashLinkVehicleNodeCount; ++i) {
    if (i) json += ',';
    const uint8_t nodeId = i + kFlashLinkNodeIdStage1;
    const uint64_t serial = flashLinkBoundSerial(nodeId);
    char serialText[28];
    flashLinkFormatSerial(serial, serialText, sizeof(serialText));
    const FlashLinkGroundPeer& peer = flashLinkGroundPeers[i];
    json += "{\"node\":";
    json += (unsigned)nodeId;
    json += ",\"bound\":";
    json += serial != 0U ? '1' : '0';
    json += ",\"sn\":\"";
    json += serialText;
    json += "\",\"connected\":";
    json += peer.linked && peer.deviceId == serial ? '1' : '0';
    json += '}';
  }
  json += "],\"devices\":[";
  bool first = true;
  for (uint8_t i = 0; i < kFlashLinkDiscoveryCacheSize; ++i) {
    const FlashLinkDiscoveredDevice& item = flashLinkDiscoveredDevices[i];
    if (!item.occupied ||
        (uint32_t)(nowMs - item.lastSeenMs) > kFlashLinkDiscoveryVisibleMs) {
      continue;
    }
    if (!first) json += ',';
    first = false;
    char serialText[28];
    flashLinkFormatSerial(item.deviceId, serialText, sizeof(serialText));
    json += "{\"node\":";
    json += (unsigned)item.nodeId;
    json += ",\"sn\":\"";
    json += serialText;
    json += "\",\"age_ms\":";
    json += (unsigned long)(nowMs - item.lastSeenMs);
    json += ",\"hz\":";
    json += (unsigned)item.telemetryHz;
    json += ",\"relayed\":";
    json += item.relayed ? '1' : '0';
    json += ",\"bound\":";
    json += flashLinkBindingAllows(item.nodeId, item.deviceId) ? '1' : '0';
    json += '}';
  }
  json += "]}";
  return json;
}
