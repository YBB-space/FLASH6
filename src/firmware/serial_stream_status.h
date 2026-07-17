void serialPrintStorageStatus() {
  StorageLock lock;
  if (!lock) {
    Serial.println("ERR SPI_FLASH_STATUS BUSY");
    return;
  }
  storageRefreshStats();
  char currentName[32];
  storageSessionName(storageCurrentSessionId, currentName, sizeof(currentName));
  Serial.printf("ACK SPI_FLASH_STATUS ready=%u busy=%u full=%u model=W25Q256JVEIQ kind=external_spi_nor "
                "reset=%s reset_code=%u "
                "mfr=%u type=%u cap_code=%u chip_capacity=%lu capacity=%lu used=%lu queue=%lu "
                "records=%lu dropped=%lu lock_skips=%lu flush=%lu sessions=%lu current_session=%lu current_file=%s "
                "record_hz=%lu record_ver=%u record_bytes=%u spi_hz=%lu generation=%lu sectors=%lu\n",
                storageState.ready ? 1U : 0U,
                storageState.busy ? 1U : 0U,
                storageState.full ? 1U : 0U,
                resetReasonName(bootResetReason),
                (unsigned)bootResetReason,
                (unsigned)storageJedecMfr,
                (unsigned)storageJedecType,
                (unsigned)flashCapacityCode(),
                (unsigned long)kNorExpectedCapacityBytes,
                (unsigned long)storageState.capacityBytes,
                (unsigned long)storageState.usedBytes,
                (unsigned long)storageState.queueBytes,
                (unsigned long)storageState.recordCount,
                (unsigned long)storageState.droppedRecords,
                (unsigned long)storageLockSkippedSamples,
                (unsigned long)storageState.flushCount,
                (unsigned long)storageState.sessionCount,
                (unsigned long)storageCurrentSessionId,
                currentName,
                (unsigned long)kStorageRecordHz,
                (unsigned)kStorageRecordVersionV4,
                (unsigned)sizeof(StorageRecordV4),
                (unsigned long)storageSpiActiveHz,
                (unsigned long)storageState.generation,
                (unsigned long)storageState.sectorCount);
}

void serialPrintStorageItem(uint32_t idx) {
  StorageLock lock;
  if (!lock) {
    Serial.println("ERR SPI_FLASH_ITEM BUSY");
    return;
  }
  storageRefreshStats();
  if (!storageState.ready || storageState.sessionCount == 0) {
    Serial.println("ACK SPI_FLASH_ITEM count=0 idx=0");
    return;
  }
  if (idx >= storageState.sessionCount) idx = storageState.sessionCount - 1U;
  StorageSessionInfo item{};
  if (!storageGetSessionInfo(idx, item)) {
    Serial.println("ERR SPI_FLASH_ITEM INDEX_FAILED");
    return;
  }
  char name[32];
  storageSessionName(item.id, name, sizeof(name));
  Serial.printf("ACK SPI_FLASH_ITEM count=%lu idx=%lu name=%s session=%lu off=%lu bytes=%lu records=%lu current=%u started=0\n",
                (unsigned long)storageState.sessionCount,
                (unsigned long)idx,
                name,
                (unsigned long)item.id,
                (unsigned long)item.offsetBytes,
                (unsigned long)item.bytes,
                (unsigned long)item.records,
                item.id == storageCurrentSessionId ? 1U : 0U);
}

void serialPrintStorageChunk(uint32_t offset, uint32_t len) {
  if (len == 0 || len > 1536U) len = 1536U;
  if (!storageFlush(true)) {
    Serial.println("ERR SPI_FLASH_READ FLUSH_FAILED");
    return;
  }
  storageRefreshStats();
  if (!storageState.ready || offset > storageState.usedBytes || len > (storageState.usedBytes - offset)) {
    Serial.println("ERR SPI_FLASH_READ BAD_RANGE");
    return;
  }

  static uint8_t data[1536];
  static unsigned char b64[2052];
  size_t b64Len = 0;
  if (!storageRead(offset, data, len)) {
    Serial.println("ERR SPI_FLASH_READ READ_FAILED");
    return;
  }
  // mbedTLS requires room for both the encoded payload and its trailing NUL.
  // Passing payload capacity only makes exact-size chunks fail at the boundary.
  const int rc = mbedtls_base64_encode(b64, sizeof(b64), &b64Len, data, len);
  if (rc != 0) {
    Serial.println("ERR SPI_FLASH_READ B64_FAILED");
    return;
  }
  b64[b64Len] = '\0';
  Serial.printf("ACK SPI_FLASH_CHUNK off=%lu len=%lu b64=", (unsigned long)offset, (unsigned long)len);
  Serial.write(b64, b64Len);
  Serial.write('\n');
}

void serialPrintRemoteStorageItem(uint32_t idx) {
  if (!flashLinkCanProxyStorage()) {
    Serial.println("ERR SPI_FLASH_REMOTE_ITEM LINK_UNAVAILABLE");
    return;
  }

  FlashLinkStorageListResponseV1 response{};
  if (!flashLinkRequestStorageList(
        (uint16_t)min<uint32_t>(UINT16_MAX, idx),
        response,
        2800U)) {
    Serial.println("ERR SPI_FLASH_REMOTE_ITEM TIMEOUT");
    return;
  }

  const uint32_t capacity = flashLinkRemoteState.storageCapacityBytes;
  const uint32_t used = flashLinkRemoteState.storageUsedBytes;
  const uint32_t records = flashLinkRemoteState.storageRecordCount;
  if (response.totalSessions == 0U || response.status == 2U) {
    Serial.printf(
      "ACK SPI_FLASH_REMOTE_ITEM count=0 idx=0 ready=%u capacity=%lu used=%lu records=%lu record_hz=%lu\n",
      capacity > 0U ? 1U : 0U,
      (unsigned long)capacity,
      (unsigned long)used,
      (unsigned long)records,
      (unsigned long)kStorageRecordHz);
    return;
  }
  if (response.status != 0U || response.count == 0U ||
      response.startOrdinal != idx) {
    Serial.printf(
      "ERR SPI_FLASH_REMOTE_ITEM BAD_RESPONSE status=%u start=%u count=%u\n",
      (unsigned)response.status,
      (unsigned)response.startOrdinal,
      (unsigned)response.count);
    return;
  }

  const FlashLinkStorageListItemV1& item = response.items[0];
  char name[32];
  storageSessionName(item.sessionId, name, sizeof(name));
  Serial.printf(
    "ACK SPI_FLASH_REMOTE_ITEM count=%u idx=%lu name=%s session=%lu off=%lu bytes=%lu records=%lu current=%u started=0 "
    "ready=%u capacity=%lu used=%lu total_records=%lu record_hz=%lu\n",
    (unsigned)response.totalSessions,
    (unsigned long)idx,
    name,
    (unsigned long)item.sessionId,
    (unsigned long)item.offsetBytes,
    (unsigned long)item.bytes,
    (unsigned long)item.records,
    item.current ? 1U : 0U,
    capacity > 0U ? 1U : 0U,
    (unsigned long)capacity,
    (unsigned long)used,
    (unsigned long)records,
    (unsigned long)kStorageRecordHz);
}

void serialPrintRemoteStorageChunk(uint32_t offset, uint32_t len) {
  if (!flashLinkCanProxyStorage()) {
    Serial.println("ERR SPI_FLASH_REMOTE_CHUNK LINK_UNAVAILABLE");
    return;
  }
  if (len == 0U || len > kFlashLinkStorageHttpChunkBytes) {
    len = kFlashLinkStorageHttpChunkBytes;
  }

  static uint8_t data[kFlashLinkStorageHttpChunkBytes];
  static unsigned char b64[((kFlashLinkStorageHttpChunkBytes + 2U) / 3U) * 4U + 1U];
  uint16_t totalLen = 0;
  if (!flashLinkRequestStorageReadWindowed(
        offset,
        (uint16_t)len,
        data,
        totalLen,
        3200U) ||
      totalLen != len) {
    Serial.println("ERR SPI_FLASH_REMOTE_CHUNK TIMEOUT");
    return;
  }

  size_t b64Len = 0;
  if (mbedtls_base64_encode(
        b64,
        sizeof(b64),
        &b64Len,
        data,
        totalLen) != 0) {
    Serial.println("ERR SPI_FLASH_REMOTE_CHUNK B64_FAILED");
    return;
  }
  b64[b64Len] = '\0';
  Serial.printf(
    "ACK SPI_FLASH_REMOTE_CHUNK off=%lu len=%u b64=",
    (unsigned long)offset,
    (unsigned)totalLen);
  Serial.write(b64, b64Len);
  Serial.write('\n');
}

void serialMissionBegin(size_t len) {
  if (len == 0 || len > kMissionProfileMaxBytes) {
    Serial.println("ERR MISSION_PROFILE_BEGIN BAD_LEN");
    return;
  }
  missionUploadSerial = "";
  missionUploadSerial.reserve(len + 1U);
  missionUploadExpectedBytes = len;
  missionUploadActive = true;
  Serial.printf("ACK MISSION_PROFILE_BEGIN len=%u\n", (unsigned)len);
}

void serialMissionChunk(const String& b64) {
  if (!missionUploadActive) {
    Serial.println("ERR MISSION_PROFILE_CHUNK NO_BEGIN");
    return;
  }
  String decoded;
  if (!decodeBase64Chunk(b64, decoded)) {
    Serial.println("ERR MISSION_PROFILE_CHUNK B64_FAILED");
    return;
  }
  if ((missionUploadSerial.length() + decoded.length()) > missionUploadExpectedBytes ||
      (missionUploadSerial.length() + decoded.length()) > kMissionProfileMaxBytes) {
    missionUploadActive = false;
    missionUploadSerial = "";
    Serial.println("ERR MISSION_PROFILE_CHUNK TOO_LARGE");
    return;
  }
  missionUploadSerial += decoded;
  Serial.printf("ACK MISSION_PROFILE_CHUNK bytes=%u\n", (unsigned)missionUploadSerial.length());
}

void serialMissionEnd() {
  if (!missionUploadActive) {
    Serial.println("ERR MISSION_PROFILE_END NO_BEGIN");
    return;
  }
  missionUploadActive = false;
  if (missionUploadSerial.length() != missionUploadExpectedBytes || !isLikelyJsonObject(missionUploadSerial)) {
    missionUploadSerial = "";
    Serial.println("ERR MISSION_PROFILE_END JSON_INVALID");
    return;
  }
  if (!saveMissionProfileJson(missionUploadSerial)) {
    missionUploadSerial = "";
    Serial.println("ERR MISSION_PROFILE_END SAVE_FAILED");
    return;
  }
  Serial.printf(
    "ACK MISSION_PROFILE_SAVED bytes=%u blocks=%u\n",
    (unsigned)missionUploadSerial.length(),
    (unsigned)missionRuntimeBlockCount);
  missionUploadSerial = "";
}

void serialMissionCancel() {
  missionUploadActive = false;
  missionUploadSerial = "";
  missionUploadExpectedBytes = 0;
  Serial.println("ACK MISSION_PROFILE_CANCEL");
}

bool forwardFlashLinkSerialCommand(
  FlashLinkCommandCode code,
  int32_t arg0 = 0,
  int32_t arg1 = 0,
  int32_t arg2 = 0,
  bool acknowledgeQueued = true
) {
  if (!flashLinkGroundRole()) return false;
  if (!flashLinkQueueCommand(code, arg0, arg1, arg2)) {
    Serial.printf(
      "ERR FLASH_LINK_COMMAND_UNAVAILABLE code=%u\n",
      (unsigned)code);
  } else if (acknowledgeQueued) {
    Serial.printf(
      "ACK FLASH_LINK_COMMAND_QUEUED code=%u\n",
      (unsigned)code);
  }
  return true;
}

void handleSerialLine(const char* line) {
  if (!line || !line[0]) return;
  String cmd(line);
  cmd.trim();

  if (cmd == "help" || cmd == "/help") {
    Serial.println("ACK GYRO_BARO_GPS_FLASH commands: /set?stream=0|1&ign_ms=1000&cd_ms=10000&daq_seq_pyro=1, /settings, /rates, /gps, /baro, /loadcell|zero|cal|reset, /servo?ch=1&deg=90 or SERVO 1 90, /storage/spi_flash/status|list|read|init, /storage/spi_flash/remote/list|read, /mission_profile_begin|chunk|end|cancel, /countdown_start, /abort, /reset");
    return;
  }

  if (cmd == "/rates") {
    Serial.printf("ACK RATES sample_hz=%lu serial_hz=%lu wifi_hz=%lu flash_link_hz=%lu record_hz=%lu baro_hz=%lu gps_hz=%lu loadcell_hz=%u\n",
                  (unsigned long)kImuSampleHz,
                  (unsigned long)kSerialStreamHz,
                  (unsigned long)activeWifiStreamHz(),
                  (unsigned long)flashLinkTelemetryHz(),
                  (unsigned long)kStorageRecordHz,
                  (unsigned long)kBaroSampleHz,
                  (unsigned long)kGpsTargetHz,
                  (unsigned)snap.loadcellHz);
    return;
  }

  if (cmd == "/settings") {
    Serial.printf("ACK SETTINGS ign_ms=%lu cd_ms=%lu daq_seq_pyro=%u safe=%u arm_lock=%u inspection=%u mute=%u flash_link_role=%s flash_link_node_id=%u flash_link_target_node_id=%u flash_link_stage2_mode=%u flash_link_hz=%lu\n",
                  (unsigned long)ignitionDurationMs,
                  (unsigned long)countdownDurationMs,
                  (unsigned)daqSequencePyroChannel,
                  safetyMode ? 1U : 0U,
                  armLock ? 1U : 0U,
                  inspectionPassed ? 1U : 0U,
                  buzzerMuted ? 1U : 0U,
                  flashLinkRoleName(),
                  (unsigned)flashLinkNodeId,
                  (unsigned)flashLinkTargetNodeId,
                  flashLinkStage2Enabled ? 1U : 0U,
                  (unsigned long)flashLinkTelemetryHz());
    return;
  }

  if (cmd == "/storage/spi_flash/status") {
    serialPrintStorageStatus();
    return;
  }

  if (cmd == "/wifi_info" || cmd == "WIFI") {
    Serial.println(wifiInfoJson());
    return;
  }

  if (cmd == "/wifi_restart") {
    wifiApRestarts++;
    startWifiAp(true);
    Serial.println(wifiInfoJson());
    return;
  }

  if (cmd.startsWith("/storage/spi_flash/remote/list")) {
    String idxRaw;
    uint32_t idx = 0;
    if (getQueryValue(cmd, "idx", idxRaw)) {
      const long v = idxRaw.toInt();
      idx = v > 0 ? (uint32_t)v : 0U;
    }
    serialPrintRemoteStorageItem(idx);
    return;
  }

  if (cmd.startsWith("/storage/spi_flash/remote/read")) {
    String offRaw;
    String lenRaw;
    uint32_t off = 0;
    uint32_t len = 0;
    if (getQueryValue(cmd, "off", offRaw)) {
      const long v = offRaw.toInt();
      off = v > 0 ? (uint32_t)v : 0U;
    }
    if (getQueryValue(cmd, "len", lenRaw)) {
      const long v = lenRaw.toInt();
      len = v > 0 ? (uint32_t)v : 0U;
    }
    serialPrintRemoteStorageChunk(off, len);
    return;
  }

  if (cmd.startsWith("/storage/spi_flash/list")) {
    String idxRaw;
    uint32_t idx = 0;
    if (getQueryValue(cmd, "idx", idxRaw)) {
      const long v = idxRaw.toInt();
      idx = v > 0 ? (uint32_t)v : 0U;
    }
    serialPrintStorageItem(idx);
    return;
  }

  if (cmd.startsWith("/storage/spi_flash/read")) {
    String offRaw;
    String lenRaw;
    uint32_t off = 0;
    uint32_t len = 0;
    if (getQueryValue(cmd, "off", offRaw)) {
      const long v = offRaw.toInt();
      off = v > 0 ? (uint32_t)v : 0U;
    }
    if (getQueryValue(cmd, "len", lenRaw)) {
      const long v = lenRaw.toInt();
      len = v > 0 ? (uint32_t)v : 0U;
    }
    serialPrintStorageChunk(off, len);
    return;
  }

  if (cmd == "/storage/spi_flash/init") {
    if (forwardFlashLinkSerialCommand(FlashLinkCommandCode::StorageReset)) {
      return;
    }
    if (!storageReset()) {
      Serial.println("ERR SPI_FLASH_INIT RESET_FAILED");
      return;
    }
    Serial.println("ACK SPI_FLASH_INIT_OK");
    return;
  }

  if (cmd.startsWith("/mission_profile_begin")) {
    String lenRaw;
    if (!getQueryValue(cmd, "len", lenRaw)) {
      Serial.println("ERR MISSION_PROFILE_BEGIN NO_LEN");
      return;
    }
    long lenValue = 0;
    if (!parseLongStrict(lenRaw, lenValue)) {
      Serial.println("ERR MISSION_PROFILE_BEGIN BAD_LEN");
      return;
    }
    serialMissionBegin((size_t)(lenValue > 0 ? lenValue : 0));
    return;
  }

  if (cmd.startsWith("/mission_profile_chunk")) {
    String b64;
    if (!getQueryValue(cmd, "b64", b64)) {
      Serial.println("ERR MISSION_PROFILE_CHUNK NO_B64");
      return;
    }
    serialMissionChunk(b64);
    return;
  }

  if (cmd == "/mission_profile_end") {
    serialMissionEnd();
    return;
  }

  if (cmd == "/mission_profile_cancel") {
    serialMissionCancel();
    return;
  }

  if (cmd == "/gps") {
    char gpsLat[20];
    char gpsLon[20];
    char gpsAlt[16];
    formatGpsFields(gpsLat, sizeof(gpsLat), gpsLon, sizeof(gpsLon), gpsAlt, sizeof(gpsAlt));
    Serial.printf("ACK GPS_STATUS ready=%u seen=%u fix=%u age_ms=%lu raw_bytes=%lu sentences=%lu errors=%lu baud=%lu rx=%d tx=%d lat=%s lon=%s alt_m=%s\n",
                  snap.gpsReady ? 1U : 0U,
                  snap.gpsSeen ? 1U : 0U,
                  snap.gpsFix ? 1U : 0U,
                  (unsigned long)snap.gpsAgeMs,
                  (unsigned long)snap.gpsRawBytes,
                  (unsigned long)snap.gpsSentenceCount,
                  (unsigned long)snap.gpsParseErrors,
                  (unsigned long)snap.gpsBaud,
                  (int)snap.gpsRxPin,
                  (int)snap.gpsTxPin,
                  gpsLat, gpsLon, gpsAlt);
    return;
  }

  if (cmd == "/gps_reset") {
    gpsApplyConfig(0, !serialStream);
    syncGpsTelemetry(true);
    Serial.printf("ACK GPS_RESET baud=%lu rx=%d tx=%d\n",
                  (unsigned long)snap.gpsBaud,
                  (int)snap.gpsRxPin,
                  (int)snap.gpsTxPin);
    return;
  }

  if (cmd == "/servo" || cmd.startsWith("/servo?") || cmd.startsWith("SERVO")) {
    if (cmd == "/servo") {
      Serial.printf("ACK SERVO_STATUS ready=%u channels=%u ch1=%d pin1=%d ch2=%d pin2=%d ch3=%d pin3=%d ch4=%d pin4=%d ch5=%d pin5=%d\n",
                    servoReady ? 1U : 0U,
                    (unsigned)kServoChannelCount,
                    (int)servoAngles[0], kServoPins[0],
                    (int)servoAngles[1], kServoPins[1],
                    (int)servoAngles[2], kServoPins[2],
                    (int)servoAngles[3], kServoPins[3],
                    (int)servoAngles[4], kServoPins[4]);
      return;
    }
    long channel = 1;
    long angle = 0;
    bool channelProvided = false;
    bool angleProvided = false;
    if (cmd.startsWith("SERVO")) {
      String rest = cmd.substring(5);
      rest.trim();
      int sep = rest.indexOf(' ');
      String chRaw = sep >= 0 ? rest.substring(0, sep) : rest;
      String angleRaw = sep >= 0 ? rest.substring(sep + 1) : "";
      chRaw.trim();
      angleRaw.trim();
      if (chRaw.length()) {
        if (!parseLongStrict(chRaw, channel)) {
          Serial.println("ERR SERVO BAD_ARGUMENT");
          return;
        }
        channelProvided = true;
      }
      if (angleRaw.length()) {
        if (!parseLongStrict(angleRaw, angle)) {
          Serial.println("ERR SERVO BAD_ARGUMENT");
          return;
        }
        angleProvided = true;
      }
    } else {
      String chRaw;
      String angleRaw;
      if (getQueryValue(cmd, "ch", chRaw) || getQueryValue(cmd, "id", chRaw) || getQueryValue(cmd, "channel", chRaw)) {
        if (!parseLongStrict(chRaw, channel)) {
          Serial.println("ERR SERVO BAD_ARGUMENT");
          return;
        }
        channelProvided = true;
      }
      if (getQueryValue(cmd, "deg", angleRaw) || getQueryValue(cmd, "angle", angleRaw)) {
        if (!parseLongStrict(angleRaw, angle)) {
          Serial.println("ERR SERVO BAD_ARGUMENT");
          return;
        }
        angleProvided = true;
      }
    }
    if (!channelProvided || !angleProvided ||
        channel < 1 || channel > kServoChannelCount ||
        angle < 0 || angle > 180) {
      Serial.println("ERR SERVO BAD_ARGUMENT");
      return;
    }
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::SetServo,
          channel,
          angle)) {
      return;
    }
    if (!setServoAngle((uint8_t)channel, (uint8_t)angle)) {
      Serial.println("ERR SERVO NOT_READY");
      return;
    }
    Serial.printf("ACK SERVO ch=%ld deg=%ld pin=%d\n",
                  channel,
                  angle,
                  kServoPins[channel - 1]);
    return;
  }

  if (cmd.startsWith("/set")) {
    const uint8_t oldMode = operationModeCode();
    const uint8_t oldRole = flashLinkRoleCode();
    const uint8_t oldDataMode = flashLinkDataModeCode();
    const uint8_t oldNodeId = flashLinkNodeId;
    const bool oldStage2Mode = flashLinkStage2Enabled;
    const bool localCommunicationRequest =
      cmd.indexOf("?op_mode=") >= 0 || cmd.indexOf("&op_mode=") >= 0 ||
      cmd.indexOf("?mode=") >= 0 || cmd.indexOf("&mode=") >= 0 ||
      cmd.indexOf("?flash_link_role=") >= 0 || cmd.indexOf("&flash_link_role=") >= 0 ||
      cmd.indexOf("?fl_role=") >= 0 || cmd.indexOf("&fl_role=") >= 0 ||
      cmd.indexOf("?flash_link_node_id=") >= 0 || cmd.indexOf("&flash_link_node_id=") >= 0 ||
      cmd.indexOf("?fl_node=") >= 0 || cmd.indexOf("&fl_node=") >= 0 ||
      cmd.indexOf("?flash_link_stage2_mode=") >= 0 ||
      cmd.indexOf("&flash_link_stage2_mode=") >= 0 ||
      cmd.indexOf("?fl_stage2_mode=") >= 0 || cmd.indexOf("&fl_stage2_mode=") >= 0 ||
      cmd.indexOf("?stage2_mode=") >= 0 || cmd.indexOf("&stage2_mode=") >= 0;
    const bool forwardRemote = flashLinkGroundRole() && !localCommunicationRequest;
    bool remoteRequested = false;
    bool remoteQueued = true;
    uint8_t remoteRequestCount = 0;
    uint8_t remoteRequestCode = 0;
    int32_t remoteRequestValue = 0;
    String requestedMode;
    String requestedRole;
    String requestedDataMode;
    String requestedNodeId;
    String requestedStage2Mode;
    auto queueRemote = [&](FlashLinkCommandCode code, int32_t value) {
      remoteRequested = true;
      remoteRequestCount++;
      if (remoteRequestCount == 1U) {
        remoteRequestCode = static_cast<uint8_t>(code);
        remoteRequestValue = value;
      }
      if (!flashLinkQueueCommand(code, value)) remoteQueued = false;
    };
    int q = cmd.indexOf('?');
    if (q >= 0) {
      String query = cmd.substring(q + 1);
      int start = 0;
      while (start < (int)query.length()) {
        int amp = query.indexOf('&', start);
        if (amp < 0) amp = query.length();
        String part = query.substring(start, amp);
        int eq = part.indexOf('=');
        String key = eq >= 0 ? part.substring(0, eq) : part;
        String val = eq >= 0 ? part.substring(eq + 1) : "1";
        if (key == "stream") {
          setSerialStreamRequested(truthy(val));
        }
        else if (key == "dev" || key == "developer" || key == "developer_mode") {
          setDeveloperMode(truthy(val));
        }
        else if (key == "safe") {
          if (forwardRemote) queueRemote(FlashLinkCommandCode::SetSafety, truthy(val) ? 1 : 0);
          else safetyMode = truthy(val);
        }
        else if (key == "arm_lock") {
          if (forwardRemote) queueRemote(FlashLinkCommandCode::SetArmLock, truthy(val) ? 1 : 0);
          else armLock = truthy(val);
        }
        else if (key == "inspection" || key == "insp") {
          if (forwardRemote) queueRemote(FlashLinkCommandCode::SetInspection, truthy(val) ? 1 : 0);
          else inspectionPassed = truthy(val);
        }
        else if (key == "op_mode" || key == "mode") requestedMode = val;
        else if (key == "flash_link_role" || key == "fl_role") requestedRole = val;
        else if (key == "flash_link_node_id" || key == "fl_node") requestedNodeId = val;
        else if (key == "flash_link_stage2_mode" || key == "fl_stage2_mode" ||
                 key == "stage2_mode") requestedStage2Mode = val;
        else if (key == "flash_link_data_mode" || key == "fl_data_mode" || key == "data_mode") requestedDataMode = val;
        else if (key == "mute") {
          if (forwardRemote) queueRemote(FlashLinkCommandCode::SetMute, truthy(val) ? 1 : 0);
          else setBuzzerMuted(truthy(val));
        }
        else if (key == "ign_ms") {
          long parsed = 0;
          if (!parseLongStrict(val, parsed)) {
            Serial.println("ERR SET BAD_IGN_MS");
            return;
          }
          if (forwardRemote) queueRemote(FlashLinkCommandCode::SetIgnitionMs, parsed);
          else setIgnitionDurationMs(parsed);
        }
        else if (key == "cd_ms") {
          long parsed = 0;
          if (!parseLongStrict(val, parsed)) {
            Serial.println("ERR SET BAD_CD_MS");
            return;
          }
          if (forwardRemote) queueRemote(FlashLinkCommandCode::SetCountdownMs, parsed);
          else setCountdownDurationMs(parsed);
        }
        else if (key == "daq_seq_pyro" || key == "daq_pyro" || key == "pyro_ch") {
          long parsed = 0;
          if (!parseLongStrict(val, parsed)) {
            Serial.println("ERR SET BAD_PYRO_CH");
            return;
          }
          if (forwardRemote) queueRemote(FlashLinkCommandCode::SetPyroChannel, parsed);
          else setDaqSequencePyroChannel(parsed);
        }
        start = amp + 1;
      }
    }
    if (requestedMode.length() > 0) setOperationMode(requestedMode);
    if (requestedRole.length() > 0) setFlashLinkRole(requestedRole);
    if (requestedNodeId.length() > 0) setFlashLinkNodeId(requestedNodeId);
    if (requestedStage2Mode.length() > 0) {
      flashLinkSetStage2Mode(truthy(requestedStage2Mode), true);
    }
    if (requestedDataMode.length() > 0) {
      String normalizedDataMode = requestedDataMode;
      normalizedDataMode.trim();
      normalizedDataMode.toLowerCase();
      normalizedDataMode.replace('-', '_');
      const bool validDataMode =
        normalizedDataMode == "flight" || normalizedDataMode == "1" ||
        normalizedDataMode == "daq" || normalizedDataMode == "0";
      if (forwardRemote && validDataMode) {
        queueRemote(
          FlashLinkCommandCode::SetDataMode,
          (normalizedDataMode == "flight" || normalizedDataMode == "1") ? 1 : 0);
      } else {
        setFlashLinkDataMode(requestedDataMode);
      }
    }
    const bool modeChanged = oldMode != operationModeCode();
    const bool roleChanged = oldRole != flashLinkRoleCode();
    const bool dataModeChanged = oldDataMode != flashLinkDataModeCode();
    const bool nodeIdChanged = oldNodeId != flashLinkNodeId;
    const bool stage2ModeChanged = oldStage2Mode != flashLinkStage2Enabled;
    const bool communicationChanged =
      modeChanged || roleChanged || dataModeChanged || nodeIdChanged ||
      stage2ModeChanged;
    const bool restartRequired =
      modeChanged ||
      dataModeChanged ||
      (nodeIdChanged && operationModeCode() == 2U && flashLinkRole == FlashLinkRole::Avionics) ||
      (roleChanged && operationModeCode() == 2U);
    if (communicationChanged) {
      saveSequenceSettings();
    }
    if (restartRequired) {
      saveBootOnceMode(operationModeName());
      pendingRestart = true;
      restartAtMs = millis() + 900U;
    }
    if (remoteRequested) {
      if (!remoteQueued) {
        Serial.println("ERR FLASH_LINK_COMMAND_QUEUE_FULL");
      } else if (remoteRequestCount == 1U) {
        Serial.printf(
          "ACK FLASH_LINK_COMMANDS_QUEUED target=avionics code=%u value=%ld\n",
          (unsigned)remoteRequestCode,
          (long)remoteRequestValue);
      } else {
        Serial.println("ACK FLASH_LINK_COMMANDS_QUEUED target=avionics");
      }
      return;
    }
    Serial.printf("ACK STREAM=%u SAFE=%u ARM_LOCK=%u INSPECTION=%u DEV_MODE=%u OP_MODE=%s FLASH_LINK_ROLE=%s FLASH_LINK_NODE=%u FLASH_LINK_TARGET=%u FLASH_LINK_STAGE2_MODE=%u FLASH_LINK_HZ=%lu FLASH_LINK_DATA_MODE=%s RESTART=%u MUTE=%u IGN_MS=%lu CD_MS=%lu DAQ_SEQ_PYRO=%u\n",
                  serialStream ? 1U : 0U,
                  safetyMode ? 1U : 0U,
                  armLock ? 1U : 0U,
                  inspectionPassed ? 1U : 0U,
                  developerMode ? 1U : 0U,
                  operationModeName(),
                  flashLinkRoleName(),
                  (unsigned)flashLinkNodeId,
                  (unsigned)flashLinkTargetNodeId,
                  flashLinkStage2Enabled ? 1U : 0U,
                  (unsigned long)flashLinkTelemetryHz(),
                  dataOperationModeNameFor(flashLinkDataModeCode()),
                  restartRequired ? 1U : 0U,
                  buzzerMuted ? 1U : 0U,
                  (unsigned long)ignitionDurationMs,
                  (unsigned long)countdownDurationMs,
                  (unsigned)daqSequencePyroChannel);
    return;
  }

  if (cmd.startsWith("IGNMS")) {
    String rest = cmd.substring(5);
    rest.trim();
    long parsed = 0;
    if (!parseLongStrict(rest, parsed)) {
      Serial.println("ERR IGNMS BAD_ARGUMENT");
      return;
    }
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::SetIgnitionMs,
          parsed)) {
      return;
    }
    setIgnitionDurationMs(parsed);
    Serial.printf("ACK IGN_MS=%lu\n", (unsigned long)ignitionDurationMs);
    return;
  }

  if (cmd.startsWith("CDMS")) {
    String rest = cmd.substring(4);
    rest.trim();
    long parsed = 0;
    if (!parseLongStrict(rest, parsed)) {
      Serial.println("ERR CDMS BAD_ARGUMENT");
      return;
    }
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::SetCountdownMs,
          parsed)) {
      return;
    }
    setCountdownDurationMs(parsed);
    Serial.printf("ACK CD_MS=%lu\n", (unsigned long)countdownDurationMs);
    return;
  }

  if (cmd.startsWith("DAQPYRO")) {
    String rest = cmd.substring(7);
    rest.trim();
    long parsed = 0;
    if (!parseLongStrict(rest, parsed)) {
      Serial.println("ERR DAQPYRO BAD_ARGUMENT");
      return;
    }
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::SetPyroChannel,
          parsed)) {
      return;
    }
    setDaqSequencePyroChannel(parsed);
    Serial.printf("ACK DAQ_SEQ_PYRO=%u\n", (unsigned)daqSequencePyroChannel);
    return;
  }

  if (cmd.startsWith("/precount") || cmd.startsWith("PRECOUNT")) {
    bool requestedWaiting = sequenceUserWaiting;
    uint32_t requestedCountdownMs = countdownDurationMs;
    if (cmd.startsWith("PRECOUNT")) {
      String rest = cmd.substring(8);
      rest.trim();
      const int sep = rest.indexOf(' ');
      String uwRaw = sep >= 0 ? rest.substring(0, sep) : rest;
      String cdRaw = sep >= 0 ? rest.substring(sep + 1) : "";
      long uwParsed = 0;
      if (!parseLongStrict(uwRaw, uwParsed)) {
        Serial.println("ERR PRECOUNT BAD_ARGUMENT");
        return;
      }
      requestedWaiting = uwParsed != 0;
      if (requestedWaiting && cdRaw.length()) {
        long cdParsed = 0;
        if (!parseLongStrict(cdRaw, cdParsed)) {
          Serial.println("ERR PRECOUNT BAD_ARGUMENT");
          return;
        }
        const uint32_t cd = clampU32(cdParsed, 0, 60000, countdownDurationMs);
        if (cd >= 3000) requestedCountdownMs = cd;
      }
    } else {
      String uwRaw;
      String cdRaw;
      if (getQueryValue(cmd, "uw", uwRaw)) requestedWaiting = truthy(uwRaw);
      if (requestedWaiting && getQueryValue(cmd, "cd", cdRaw)) {
        long cdParsed = 0;
        if (!parseLongStrict(cdRaw, cdParsed)) {
          Serial.println("ERR PRECOUNT BAD_ARGUMENT");
          return;
        }
        const uint32_t cd = clampU32(cdParsed, 0, 60000, countdownDurationMs);
        if (cd >= 3000) requestedCountdownMs = cd;
      }
    }
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::SetPrecount,
          requestedWaiting ? 1 : 0,
          (int32_t)requestedCountdownMs)) {
      return;
    }
    sequenceUserWaiting = requestedWaiting;
    if (sequenceUserWaiting) countdownDurationMs = requestedCountdownMs;
    Serial.printf("ACK PRECOUNT uw=%u td=%ld\n", sequenceUserWaiting ? 1U : 0U, (long)sequenceTdMs(millis()));
    return;
  }

  if (cmd == "/countdown_start" || cmd == "COUNTDOWN") {
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::StartCountdown)) {
      return;
    }
    if (!startCountdownRuntime(millis())) {
      Serial.println(safetyMode ? "ERR COUNTDOWN SAFETY_MODE" : "ERR COUNTDOWN BUSY");
      return;
    }
    Serial.println("ACK COUNTDOWN_STARTED");
    return;
  }

  if (cmd == "/ignite" || cmd == "IGNITE" || cmd == "/force_ignite" || cmd == "FORCE") {
    const FlashLinkCommandCode flashCommand =
      (cmd == "/force_ignite" || cmd == "FORCE")
        ? FlashLinkCommandCode::ForceIgnite
        : FlashLinkCommandCode::Ignite;
    if (forwardFlashLinkSerialCommand(flashCommand)) {
      return;
    }
    if (!startFiringRuntime(millis(), daqSequencePyroChannel)) {
      Serial.println("ERR IGNITE SAFETY_MODE");
      return;
    }
    Serial.println("ACK IGNITION_IMMEDIATE");
    return;
  }

  if (cmd == "/abort" || cmd == "ABORT") {
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::Abort,
          1)) {
      return;
    }
    abortSequenceRuntime(1);
    Serial.println("ACK ABORTED");
    return;
  }

  if (cmd == "/sequence_end" || cmd == "SEQUENCE_END") {
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::SequenceEnd)) {
      return;
    }
    clearSequenceRuntime();
    Serial.println("ACK SEQUENCE_ENDED");
    return;
  }

  if (cmd.startsWith("/pyro_test") || cmd.startsWith("PYRO")) {
    if (!flashLinkGroundRole() && safetyMode) {
      Serial.println("ERR PYRO_TEST SAFETY_MODE");
      return;
    }
    uint8_t ch = daqSequencePyroChannel;
    uint32_t ms = 500;
    if (cmd.startsWith("PYRO")) {
      String rest = cmd.substring(4);
      rest.trim();
      int sep = rest.indexOf(' ');
      String chRaw = sep >= 0 ? rest.substring(0, sep) : rest;
      String msRaw = sep >= 0 ? rest.substring(sep + 1) : "";
      long parsed = 0;
      if (chRaw.length()) {
        if (!parseLongStrict(chRaw, parsed)) {
          Serial.println("ERR PYRO BAD_ARGUMENT");
          return;
        }
        ch = clampPyroChannel(parsed);
      }
      if (msRaw.length()) {
        if (!parseLongStrict(msRaw, parsed)) {
          Serial.println("ERR PYRO BAD_ARGUMENT");
          return;
        }
        ms = clampU32(parsed, 10, 30000, 500);
      }
    } else {
      String chRaw;
      String msRaw;
      long parsed = 0;
      if (getQueryValue(cmd, "ch", chRaw)) {
        if (!parseLongStrict(chRaw, parsed)) {
          Serial.println("ERR PYRO BAD_ARGUMENT");
          return;
        }
        ch = clampPyroChannel(parsed);
      }
      if (getQueryValue(cmd, "ms", msRaw) || getQueryValue(cmd, "dur", msRaw) || getQueryValue(cmd, "dur_ms", msRaw)) {
        if (!parseLongStrict(msRaw, parsed)) {
          Serial.println("ERR PYRO BAD_ARGUMENT");
          return;
        }
        ms = clampU32(parsed, 10, 30000, 500);
      }
    }
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::PyroTest,
          ch,
          (int32_t)ms)) {
      return;
    }
    const uint32_t nowMs = millis();
    sequenceRelayMask = pyroMaskForChannel(ch);
    sequenceRelayHoldUntilMs = nowMs + ms;
    applyPyroOutputs(nowMs);
    buzzerPlayTone(2200, min<uint32_t>(180U, ms));
    Serial.printf("ACK PYRO_TEST CH=%u MS=%lu\n", (unsigned)ch, (unsigned long)ms);
    return;
  }

  if (cmd.startsWith("/gyro_zero")) {
    const bool reset = cmd.indexOf("reset=1") >= 0;
    String rollRaw;
    String pitchRaw;
    String yawRaw;
    const float roll = getQueryValue(cmd, "roll", rollRaw) ? rollRaw.toFloat() : 0.0f;
    const float pitch = getQueryValue(cmd, "pitch", pitchRaw) ? pitchRaw.toFloat() : 0.0f;
    const float yaw = getQueryValue(cmd, "yaw", yawRaw) ? yawRaw.toFloat() : 0.0f;
    if (forwardFlashLinkSerialCommand(
          reset
            ? FlashLinkCommandCode::GyroZeroReset
            : FlashLinkCommandCode::GyroZero,
          (int32_t)lroundf(roll * 1000.0f),
          (int32_t)lroundf(pitch * 1000.0f),
          (int32_t)lroundf(yaw * 1000.0f),
          false)) {
      return;
    }
    if (reset) {
      clearGyroZero();
    } else {
      setGyroZeroTarget(roll, pitch, yaw);
    }
    Serial.printf("ACK GYRO_ZERO roll=%.2f pitch=%.2f yaw=%.2f\n", zeroRoll, zeroPitch, zeroYaw);
    return;
  }

  if (cmd.startsWith("/baro_reference")) {
    String hpaRaw;
    if (getQueryValue(cmd, "sea_level_hpa", hpaRaw)) {
      const float hpa = hpaRaw.toFloat();
      if (flashLinkGroundRole()) {
        if (!isfinite(hpa) || hpa < 850.0f || hpa > 1100.0f) {
          Serial.println("ERR BARO_REFERENCE BAD_SEA_LEVEL_HPA");
          return;
        }
        forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::BaroReference,
          (int32_t)lroundf(hpa * 100.0f),
          0,
          0,
          false);
        return;
      }
      if (!setSeaLevelHpa(hpa)) {
        Serial.println("ERR BARO_REFERENCE BAD_SEA_LEVEL_HPA");
        return;
      }
    }
    resetBaroBase();
    Serial.printf("ACK BARO_REFERENCE sea_level_hpa=%.2f pressure_mpa=%.6f alt_m=%.2f ready=%u\n",
                  seaLevelHpa,
                  snap.baroValid ? snap.p : 0.0f,
                  snap.baroValid ? snap.altM : 0.0f,
                  baroReady ? 1U : 0U);
    return;
  }

  if (cmd.startsWith("/baro_zero")) {
    if (forwardFlashLinkSerialCommand(FlashLinkCommandCode::BaroZero)) {
      return;
    }
    resetBaroBase();
    Serial.printf("ACK BARO_ZERO pressure_mpa=%.6f alt_m=%.2f ready=%u\n",
                  snap.baroValid ? snap.p : 0.0f,
                  snap.baroValid ? snap.altM : 0.0f,
                  baroReady ? 1U : 0U);
    return;
  }

  if (cmd == "/baro") {
    Serial.printf("ACK BARO_STATUS ready=%u valid=%u addr=0x%02X pressure_mpa=%.6f alt_m=%.2f sea_level_hpa=%.2f errors=%lu\n",
                  baroReady ? 1U : 0U,
                  snap.baroValid ? 1U : 0U,
                  baroAddr,
                  snap.baroValid ? snap.p : 0.0f,
                  snap.baroValid ? snap.altM : 0.0f,
                  seaLevelHpa,
                  (unsigned long)baroReadErrors);
    return;
  }

  if (cmd == "/loadcell" || cmd == "/hx711") {
    Serial.printf("ACK LOADCELL_STATUS active=%u ready=%u valid=%u fresh_raw=%u raw=%ld t=%.3f hz=%u offset=%ld offset_ok=%u scale=%.6f sat=%u errors=%lu dout=%d sck=%d\n",
                  loadcellShouldRun() ? 1U : 0U,
                  snap.loadcellReady ? 1U : 0U,
                  snap.loadcellValid ? 1U : 0U,
                  loadcellFreshRawAvailable() ? 1U : 0U,
                  (long)loadcellRaw,
                  snap.loadcellValid ? snap.thrustKgf : 0.0f,
                  (unsigned)snap.loadcellHz,
                  (long)loadcellOffset,
                  loadcellAutoZeroDone ? 1U : 0U,
                  loadcellScale,
                  loadcellSaturated ? 1U : 0U,
                  (unsigned long)loadcellReadErrors,
                  hx711Dout,
                  hx711Sck);
    return;
  }

  if (cmd.startsWith("/loadcell_zero")) {
    if (!saveLoadcellZeroFromCurrent()) {
      Serial.println(loadcellShouldRun() ? "ERR LOADCELL_ZERO RAW_NOT_READY" : "ERR LOADCELL_ZERO INACTIVE_DAQ_ONLY");
      return;
    }
    Serial.printf("ACK OFFSET=%ld RAW=%ld\n", (long)loadcellOffset, (long)loadcellRaw);
    return;
  }

  if (cmd.startsWith("/loadcell_noise_zero")) {
    Serial.printf("ACK NOISE=%.3f RAW=%ld\n", kLoadcellNoiseDeadbandKg, (long)loadcellRaw);
    return;
  }

  if (cmd.startsWith("/loadcell_cal")) {
    String weightRaw;
    const float weight = getQueryValue(cmd, "weight", weightRaw) ? weightRaw.toFloat() : 0.0f;
    if (!saveLoadcellScaleFromWeight(weight)) {
      Serial.println(loadcellShouldRun() ? "ERR LOADCELL_CAL BAD_SAMPLE_OR_WEIGHT" : "ERR LOADCELL_CAL INACTIVE_DAQ_ONLY");
      return;
    }
    Serial.printf("ACK SCALE=%.6f OFFSET=%ld RAW=%ld\n", loadcellScale, (long)loadcellOffset, (long)loadcellRaw);
    return;
  }

  if (cmd.startsWith("/loadcell_reset")) {
    resetLoadcellConfig();
    Serial.printf("ACK RESET SCALE=%.6f OFFSET=%ld NOISE=%.3f\n",
                  loadcellScale,
                  (long)loadcellOffset,
                  kLoadcellNoiseDeadbandKg);
    return;
  }

  if (cmd == "/buzzer_stop" || cmd == "NOTONE") {
    if (forwardFlashLinkSerialCommand(FlashLinkCommandCode::BuzzerStop)) {
      return;
    }
    buzzerStop();
    Serial.println("ACK BUZZER_STOP");
    return;
  }

  if (cmd == "/buzzer" || cmd.startsWith("/buzzer?") || cmd.startsWith("BEEP") || cmd == "FIND_BUZZER") {
    if (cmd == "FIND_BUZZER") {
      if (forwardFlashLinkSerialCommand(FlashLinkCommandCode::BuzzerFind)) {
        return;
      }
      buzzerPlayFindMelody();
      Serial.printf("ACK BUZZER_FIND loop=0 muted=%u\n", buzzerMuted ? 1U : 0U);
      return;
    }
    String pattern;
    if (getQueryValue(cmd, "pattern", pattern)) {
      pattern.toLowerCase();
      if (pattern == "find" || pattern == "finder" || pattern == "locate") {
        if (forwardFlashLinkSerialCommand(FlashLinkCommandCode::BuzzerFind)) {
          return;
        }
        buzzerPlayFindMelody();
        Serial.printf("ACK BUZZER_FIND loop=0 muted=%u\n", buzzerMuted ? 1U : 0U);
        return;
      }
    }
    if (cmd.indexOf("find=1") >= 0) {
      if (forwardFlashLinkSerialCommand(FlashLinkCommandCode::BuzzerFind)) {
        return;
      }
      buzzerPlayFindMelody();
      Serial.printf("ACK BUZZER_FIND loop=0 muted=%u\n", buzzerMuted ? 1U : 0U);
      return;
    }

    uint16_t hz = kBuzzerDefaultHz;
    uint16_t ms = 0;
    String hzRaw;
    String msRaw;
    if (getQueryValue(cmd, "hz", hzRaw)) hz = clampBuzzerHz(hzRaw.toInt());
    if (getQueryValue(cmd, "ms", msRaw) || getQueryValue(cmd, "dur", msRaw) || getQueryValue(cmd, "duration", msRaw)) {
      ms = clampBuzzerMs(msRaw.toInt());
    }
    if (cmd.startsWith("BEEP")) {
      String rest = cmd.substring(4);
      rest.trim();
      int sep = rest.indexOf(' ');
      String hzPart = sep >= 0 ? rest.substring(0, sep) : rest;
      String msPart = sep >= 0 ? rest.substring(sep + 1) : "";
      hzPart.trim();
      msPart.trim();
      if (hzPart.length() > 0) hz = clampBuzzerHz(hzPart.toInt());
      if (msPart.length() > 0) ms = clampBuzzerMs(msPart.toInt());
    }
    if (forwardFlashLinkSerialCommand(
          FlashLinkCommandCode::BuzzerTone,
          hz,
          ms)) {
      return;
    }
    buzzerPlayTone(hz, ms);
    Serial.printf("ACK BUZZER hz=%u ms=%u muted=%u\n", hz, ms, buzzerMuted ? 1U : 0U);
    return;
  }

  if (cmd == "/reset") {
    Serial.println("ACK RESETTING");
    pendingRestart = true;
    restartAtMs = millis() + 150;
    return;
  }

  Serial.println("ACK GYRO_BARO_GPS_OK");
}

void pollSerial() {
  uint16_t drained = 0;
  while (Serial.available() > 0 && drained < kSerialRxDrainMaxBytes) {
    drained++;
    char c = (char)Serial.read();
    if (c == '\r') c = '\n';
    if (c == '\n') {
      serialLine[serialLineLen] = '\0';
      handleSerialLine(serialLine);
      serialLineLen = 0;
    } else if (serialLineLen + 1 < sizeof(serialLine)) {
      serialLine[serialLineLen++] = c;
    } else {
      serialLineLen = 0;
      Serial.println("ERR LINE_TOO_LONG");
    }
  }
}

void sendPeriodicTelemetry() {
  if (flashLinkAvionicsRole() && !serialStream) return;
  const uint32_t nowUs = micros();
  const uint32_t serialPeriodUs = flashLinkGroundRole()
    ? flashLinkTelemetryPeriodUs()
    : kSerialPeriodUs;
  const uint32_t wsPeriodUs = activeWifiStreamPeriodUs();
  const bool wsDue =
    !flashLinkAvionicsRole() && (uint32_t)(nowUs - lastWsUs) >= wsPeriodUs;
  const bool serialDue =
    serialStream && (uint32_t)(nowUs - lastSerialUs) >= serialPeriodUs;
  const bool wsCanWrite =
    wsDue && ws.count() > 0 && ws.availableForWriteAll();
  char json[kStreamJsonMaxBytes];
  size_t len = 0;
  // Build a due serial frame before checking room. Checking the actual frame
  // length lets us drop on pressure instead of accumulating stale frames.
  if (wsCanWrite || serialDue) {
    len = buildStreamJsonV2(json, sizeof(json));
    if (len == 0) {
      if (wsDue) {
        lastWsUs = nowUs;
        if (ws.count() > 0) {
          wsLastStatus = 0;
          wsDroppedFrames++;
        }
      }
      if (serialDue) {
        lastSerialUs = nowUs;
        serialDroppedFrames++;
      }
      return;
    }
  }

  if (wsDue) {
    lastWsUs = nowUs;
    if (ws.count() > 0) {
      if (wsCanWrite) {
        AsyncWebSocket::SendStatus status = ws.textAll(json, len);
        wsLastStatus = (uint8_t)status;
        if (status == AsyncWebSocket::DISCARDED) wsDroppedFrames++;
      } else {
        wsLastStatus = 0;
        wsDroppedFrames++;
      }
      static uint32_t lastCleanupMs = 0;
      const uint32_t nowMs = millis();
      if ((uint32_t)(nowMs - lastCleanupMs) >= 1000U) {
        lastCleanupMs = nowMs;
        ws.cleanupClients(kWifiMaxClients);
      }
    }
  }

  if (serialDue) {
    lastSerialUs = nowUs;
    const size_t requiredRoom = len + 1U + kSerialControlReserveBytes;
    const bool serialCanWrite = len > 0U &&
      Serial.availableForWrite() >= (int)requiredRoom;
    if (serialCanWrite && len > 0U) {
      const size_t written = Serial.write((const uint8_t*)json, len);
      const size_t newlineWritten = Serial.write('\n');
      if (written != len || newlineWritten != 1U) {
        serialDroppedFrames++;
      }
    } else {
      serialDroppedFrames++;
    }
  }
}

void blinkStatus() {
  const uint32_t now = millis();
  const uint32_t period = flashLinkMode
    ? (flashLink.linked ? 800U : 120U)
    : (imuReady ? 500U : 140U);
  if ((uint32_t)(now - lastBlinkMs) >= period) {
    lastBlinkMs = now;
    ledState = !ledState;
    digitalWrite(kLed, ledState ? HIGH : LOW);
  }
}
