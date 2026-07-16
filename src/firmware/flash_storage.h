void norBeginTransaction() {
  storageSpi.beginTransaction(SPISettings(storageSpiActiveHz, MSBFIRST, SPI_MODE0));
  digitalWrite(kFlashCs, LOW);
}

void norEndTransaction() {
  digitalWrite(kFlashCs, HIGH);
  storageSpi.endTransaction();
}

void norSendAddress(uint32_t address) {
  storageSpi.transfer((uint8_t)(address >> 24));
  storageSpi.transfer((uint8_t)(address >> 16));
  storageSpi.transfer((uint8_t)(address >> 8));
  storageSpi.transfer((uint8_t)address);
}

uint8_t norReadStatus1() {
  norBeginTransaction();
  storageSpi.transfer(0x05);
  const uint8_t status = storageSpi.transfer(0x00);
  norEndTransaction();
  return status;
}

void serviceRealtimeDuringStorageWait() {
  if (!runtimeServicesReady ||
      storageWaitServiceActive ||
      loopTaskHandle == nullptr ||
      xTaskGetCurrentTaskHandle() != loopTaskHandle) {
    delay(0);
    return;
  }
  storageWaitServiceActive = true;
  const bool wasBusy = storageState.busy;
  storageState.busy = true;
  updateSharedSensorPins();
  applyPyroOutputs(millis());
  if (!flashLinkGroundRole()) {
    if (gpsShouldRun()) pollGps();
    syncGpsTelemetry();
    sequenceTick();
    sampleLoadcell();
    sampleImu();
    sampleBarometer();
    flightPhaseTick();
    sampleChipTemperature();
    missionRuntimeTick();
  }
  flashLinkTick();
  bootButtonTick();
  sendPeriodicTelemetry();
  blinkStatus();
  buzzerTick();
  storageState.busy = wasBusy;
  storageWaitServiceActive = false;
  taskYIELD();
}

bool norWaitReady(uint32_t timeoutMs) {
  const uint32_t started = millis();
  while ((norReadStatus1() & 0x01U) != 0U) {
    if ((uint32_t)(millis() - started) >= timeoutMs) return false;
    serviceRealtimeDuringStorageWait();
  }
  return true;
}

bool norWriteEnable() {
  norBeginTransaction();
  storageSpi.transfer(0x06);
  norEndTransaction();
  return (norReadStatus1() & 0x02U) != 0U;
}

void norResetAndEnter4ByteMode() {
  norBeginTransaction();
  storageSpi.transfer(0xFF);
  norEndTransaction();
  norBeginTransaction();
  storageSpi.transfer(0xAB);
  norEndTransaction();
  delayMicroseconds(10);
  norBeginTransaction();
  storageSpi.transfer(0x66);
  norEndTransaction();
  norBeginTransaction();
  storageSpi.transfer(0x99);
  norEndTransaction();
  delay(1);
  (void)norWaitReady(100);
  norBeginTransaction();
  storageSpi.transfer(0xB7);
  norEndTransaction();
}

void norReadJedecId() {
  norBeginTransaction();
  storageSpi.transfer(0x9F);
  storageJedecMfr = storageSpi.transfer(0x00);
  storageJedecType = storageSpi.transfer(0x00);
  storageJedecCapacity = storageSpi.transfer(0x00);
  norEndTransaction();
}

bool norRead(uint32_t address, void* out, size_t len) {
  if (!out) return false;
  if (len == 0) return true;
  if (address >= kNorExpectedCapacityBytes || len > (size_t)(kNorExpectedCapacityBytes - address)) return false;
  if (!norWaitReady(1000)) return false;
  norBeginTransaction();
  storageSpi.transfer(0x03);
  norSendAddress(address);
  storageSpi.transferBytes(nullptr, static_cast<uint8_t*>(out), len);
  norEndTransaction();
  return true;
}

bool norProgramPage(uint32_t address, const uint8_t* data, size_t len) {
  if (!data || len == 0 || len > kNorPageBytes) return false;
  if ((address / kNorPageBytes) != ((address + len - 1U) / kNorPageBytes)) return false;
  if (!norWaitReady(1000) || !norWriteEnable()) return false;
  norBeginTransaction();
  storageSpi.transfer(0x02);
  norSendAddress(address);
  storageSpi.transferBytes(data, nullptr, len);
  norEndTransaction();
  return norWaitReady(1000);
}

bool norProgram(uint32_t address, const void* data, size_t len) {
  if (!data) return false;
  const uint8_t* src = static_cast<const uint8_t*>(data);
  while (len > 0) {
    const size_t pageRemaining = kNorPageBytes - (address % kNorPageBytes);
    const size_t chunk = len < pageRemaining ? len : pageRemaining;
    if (!norProgramPage(address, src, chunk)) return false;
    address += chunk;
    src += chunk;
    len -= chunk;
  }
  return true;
}

bool norEraseSector(uint32_t address) {
  address -= address % kNorSectorBytes;
  if (!norWaitReady(1000) || !norWriteEnable()) return false;
  norBeginTransaction();
  storageSpi.transfer(0x20);
  norSendAddress(address);
  norEndTransaction();
  return norWaitReady(3000);
}

bool norBytesAreErased(uint32_t address, size_t len) {
  uint8_t buffer[32];
  while (len > 0) {
    const size_t chunk = len < sizeof(buffer) ? len : sizeof(buffer);
    if (!norRead(address, buffer, chunk)) return false;
    for (size_t i = 0; i < chunk; ++i) {
      if (buffer[i] != 0xFFU) return false;
    }
    address += chunk;
    len -= chunk;
  }
  return true;
}

uint32_t norSectorAddress(uint16_t sectorIndex) {
  return kNorDataStartAddress + (uint32_t)sectorIndex * kNorSectorBytes;
}

bool norMetadataValid(const NorMetadataV1& meta) {
  return meta.magic == kNorMetadataMagic &&
         meta.version == kNorFormatVersion &&
         meta.headerSize == sizeof(NorMetadataV1) &&
         meta.generation != 0U &&
         meta.generationInverse == ~meta.generation;
}

uint32_t norMetadataAddress(uint8_t slot) {
  return (uint32_t)(slot % kNorMetadataSlotCount) * kNorSectorBytes;
}

bool norWriteMetadata(uint8_t slot, uint32_t generation) {
  const uint32_t address = norMetadataAddress(slot);
  if (!norEraseSector(address)) return false;
  NorMetadataV1 meta{};
  meta.magic = kNorMetadataMagic;
  meta.version = kNorFormatVersion;
  meta.headerSize = sizeof(NorMetadataV1);
  meta.generation = generation;
  meta.generationInverse = ~generation;
  return norProgram(address, &meta, sizeof(meta));
}

bool norReadSectorInfo(uint16_t sectorIndex, uint32_t generation,
                       uint8_t& headerSize, uint32_t& sessionId,
                       uint8_t& recordVersion) {
  NorSectorHeaderV3 header{};
  if (!norRead(norSectorAddress(sectorIndex), &header, sizeof(header))) return false;
  if (header.magic != kNorSectorMagic ||
      header.generation != generation ||
      header.sectorIndex != sectorIndex) {
    return false;
  }
  if (header.version == kNorFormatVersion &&
      header.headerSize == sizeof(NorSectorHeaderV1)) {
    headerSize = sizeof(NorSectorHeaderV1);
    sessionId = 1U;
    recordVersion = kStorageRecordVersionV1;
    return true;
  }
  if (header.version == kNorSessionSectorVersion &&
      header.headerSize == sizeof(NorSectorHeaderV2) &&
      header.sessionId != 0U &&
      header.sessionId <= UINT16_MAX) {
    headerSize = sizeof(NorSectorHeaderV2);
    sessionId = header.sessionId;
    recordVersion = kStorageRecordVersionV1;
    return true;
  }
  if (header.version == kNorCompactSectorVersion &&
      header.headerSize == sizeof(NorSectorHeaderV3) &&
      header.sessionId != 0U &&
      header.sessionId <= UINT16_MAX &&
      header.recordType == kStorageRecordTypeSampleV1 &&
      ((header.recordVersion == kStorageRecordVersionV2 &&
        header.recordSize == sizeof(StorageRecordV2)) ||
       (header.recordVersion == kStorageRecordVersionV3 &&
        header.recordSize == sizeof(StorageRecordV3)) ||
       (header.recordVersion == kStorageRecordVersionV4 &&
        header.recordSize == sizeof(StorageRecordV4)))) {
    headerSize = sizeof(NorSectorHeaderV3);
    sessionId = header.sessionId;
    recordVersion = header.recordVersion;
    return true;
  }
  return false;
}

uint16_t storageRecordSizeForVersion(uint8_t recordVersion) {
  if (recordVersion == kStorageRecordVersionV4) return (uint16_t)sizeof(StorageRecordV4);
  if (recordVersion == kStorageRecordVersionV3) return (uint16_t)sizeof(StorageRecordV3);
  if (recordVersion == kStorageRecordVersionV2) return (uint16_t)sizeof(StorageRecordV2);
  return (uint16_t)sizeof(StorageRecordV1);
}

uint16_t storagePayloadSizeForVersion(uint8_t recordVersion) {
  if (recordVersion == kStorageRecordVersionV4) return (uint16_t)sizeof(StorageSamplePayloadV4);
  if (recordVersion == kStorageRecordVersionV3) return (uint16_t)sizeof(StorageSamplePayloadV3);
  if (recordVersion == kStorageRecordVersionV2) return (uint16_t)sizeof(StorageSamplePayloadV2);
  return (uint16_t)sizeof(StorageSamplePayloadV1);
}

uint16_t storageMissionAlarmPayloadSizeForVersion(uint8_t recordVersion) {
  if (recordVersion == kStorageRecordVersionV4) return (uint16_t)sizeof(StorageMissionAlarmPayloadV2);
  return (uint16_t)sizeof(StorageMissionAlarmPayloadV1);
}

uint16_t storageRecordsPerSector(uint8_t headerSize, uint8_t recordVersion) {
  const uint16_t recordSize = storageRecordSizeForVersion(recordVersion);
  return recordSize > 0
    ? (uint16_t)((kNorFooterOffset - headerSize) / recordSize)
    : 0U;
}

bool norSectorHeaderValid(uint16_t sectorIndex, uint32_t generation) {
  uint8_t headerSize = 0;
  uint32_t sessionId = 0;
  uint8_t recordVersion = 0;
  return norReadSectorInfo(sectorIndex, generation, headerSize, sessionId, recordVersion);
}

bool norReadSectorFooter(uint16_t sectorIndex, uint32_t generation, uint8_t& recordCount) {
  NorSectorFooterV1 footer{};
  if (!norRead(norSectorAddress(sectorIndex) + kNorFooterOffset, &footer, sizeof(footer))) return false;
  if (footer.magic != kNorFooterMagic ||
      footer.generation != generation ||
      footer.sectorIndex != sectorIndex ||
      footer.recordCount > kNorMaxRecordsPerSector ||
      footer.recordCountInverse != (uint16_t)~footer.recordCount) {
    return false;
  }
  recordCount = (uint8_t)footer.recordCount;
  return true;
}

bool norCloseSector(uint16_t sectorIndex, uint8_t recordCount) {
  NorSectorFooterV1 footer{};
  footer.magic = kNorFooterMagic;
  footer.generation = storageState.generation;
  footer.recordCount = recordCount;
  footer.recordCountInverse = (uint16_t)~recordCount;
  footer.sectorIndex = sectorIndex;
  return norProgram(norSectorAddress(sectorIndex) + kNorFooterOffset, &footer, sizeof(footer));
}

uint8_t norScanSectorRecords(uint16_t sectorIndex, uint8_t headerSize,
                             uint8_t recordVersion,
                             uint32_t firstSequence, bool& nextSlotErased) {
  uint8_t count = 0;
  nextSlotErased = false;
  const uint32_t base = norSectorAddress(sectorIndex) + headerSize;
  const uint16_t recordSize = storageRecordSizeForVersion(recordVersion);
  const uint16_t payloadSize = storagePayloadSizeForVersion(recordVersion);
  const uint16_t recordLimit = storageRecordsPerSector(headerSize, recordVersion);
  for (; count < recordLimit; ++count) {
    StorageRecordHeaderV1 header{};
    const uint32_t address = base + (uint32_t)count * recordSize;
    if (!norRead(address, &header, sizeof(header))) break;
    const bool missionAlarmRecord = header.type == kStorageRecordTypeMissionAlarmV1 &&
      (recordVersion == kStorageRecordVersionV3 ||
       recordVersion == kStorageRecordVersionV4);
    const bool supportedType =
      header.type == kStorageRecordTypeSampleV1 ||
      missionAlarmRecord;
    const uint16_t expectedPayloadSize = missionAlarmRecord
      ? storageMissionAlarmPayloadSizeForVersion(recordVersion)
      : payloadSize;
    const bool valid = header.marker == kStorageRecordMarker &&
                       header.version == recordVersion &&
                       supportedType &&
                       header.payloadSize == expectedPayloadSize &&
                       header.seq == firstSequence + count;
    bool payloadValid = valid;
    if (payloadValid &&
        (recordVersion == kStorageRecordVersionV2 ||
         recordVersion == kStorageRecordVersionV3 ||
         recordVersion == kStorageRecordVersionV4)) {
      uint8_t payload[sizeof(StorageSamplePayloadV4)] = {};
      payloadValid =
        norRead(address + sizeof(StorageRecordHeaderV1), payload, expectedPayloadSize) &&
        crc16Ccitt(payload, expectedPayloadSize) == header.flags;
    }
    if (!payloadValid) {
      nextSlotErased = norBytesAreErased(address, recordSize);
      break;
    }
  }
  if (count == recordLimit) nextSlotErased = false;
  return count;
}

template <typename T>
T* allocateStorageIndexArray(size_t count) {
  T* memory = static_cast<T*>(
    heap_caps_calloc(count, sizeof(T), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (!memory) {
    memory = static_cast<T*>(calloc(count, sizeof(T)));
  }
  return memory;
}

void releaseStorageIndex() {
  heap_caps_free(storageSectorRecordCounts);
  heap_caps_free(storageSectorHeaderSizes);
  heap_caps_free(storageSectorRecordVersions);
  heap_caps_free(storageSectorPrefix);
  heap_caps_free(storageSectorBytePrefix);
  heap_caps_free(storageSectorSessionIds);
  storageSectorRecordCounts = nullptr;
  storageSectorHeaderSizes = nullptr;
  storageSectorRecordVersions = nullptr;
  storageSectorPrefix = nullptr;
  storageSectorBytePrefix = nullptr;
  storageSectorSessionIds = nullptr;
}

bool allocateStorageIndex() {
  if (storageSectorRecordCounts &&
      storageSectorHeaderSizes &&
      storageSectorRecordVersions &&
      storageSectorPrefix &&
      storageSectorBytePrefix &&
      storageSectorSessionIds) {
    return true;
  }

  releaseStorageIndex();
  storageSectorRecordCounts =
    allocateStorageIndexArray<uint8_t>(kNorDataSectorCount);
  storageSectorHeaderSizes =
    allocateStorageIndexArray<uint8_t>(kNorDataSectorCount);
  storageSectorRecordVersions =
    allocateStorageIndexArray<uint8_t>(kNorDataSectorCount);
  storageSectorPrefix =
    allocateStorageIndexArray<uint32_t>(kNorDataSectorCount + 1U);
  storageSectorBytePrefix =
    allocateStorageIndexArray<uint32_t>(kNorDataSectorCount + 1U);
  storageSectorSessionIds =
    allocateStorageIndexArray<uint32_t>(kNorDataSectorCount);

  if (!storageSectorRecordCounts ||
      !storageSectorHeaderSizes ||
      !storageSectorRecordVersions ||
      !storageSectorPrefix ||
      !storageSectorBytePrefix ||
      !storageSectorSessionIds) {
    releaseStorageIndex();
    return false;
  }
  return true;
}

void storageClearQueue() {
  storageQueueHead = 0;
  storageQueueTail = 0;
  storageQueueCount = 0;
  storageState.queueBytes = 0;
}

void storageClearIndex() {
  if (!storageSectorRecordCounts ||
      !storageSectorHeaderSizes ||
      !storageSectorRecordVersions ||
      !storageSectorPrefix ||
      !storageSectorBytePrefix ||
      !storageSectorSessionIds) {
    return;
  }
  memset(storageSectorRecordCounts, 0,
         sizeof(*storageSectorRecordCounts) * kNorDataSectorCount);
  memset(storageSectorHeaderSizes, 0,
         sizeof(*storageSectorHeaderSizes) * kNorDataSectorCount);
  memset(storageSectorRecordVersions, 0,
         sizeof(*storageSectorRecordVersions) * kNorDataSectorCount);
  memset(storageSectorPrefix, 0,
         sizeof(*storageSectorPrefix) * (kNorDataSectorCount + 1U));
  memset(storageSectorBytePrefix, 0,
         sizeof(*storageSectorBytePrefix) * (kNorDataSectorCount + 1U));
  memset(storageSectorSessionIds, 0,
         sizeof(*storageSectorSessionIds) * kNorDataSectorCount);
  storageCurrentSectorWritable = false;
  storageCurrentSessionId = 1U;
  storageState.sectorCount = 0;
  storageState.sessionCount = 0;
  storageState.usedBytes = 0;
  storageState.recordCount = 0;
  storageState.full = false;
}

bool norStartNewSector() {
  if (storageState.sectorCount >= kNorDataSectorCount) {
    storageState.full = true;
    return false;
  }
  const uint16_t sectorIndex = (uint16_t)storageState.sectorCount;
  const uint32_t address = norSectorAddress(sectorIndex);
  if (!norEraseSector(address)) return false;

  NorSectorHeaderV3 header{};
  header.magic = kNorSectorMagic;
  header.version = kNorCompactSectorVersion;
  header.headerSize = sizeof(NorSectorHeaderV3);
  header.generation = storageState.generation;
  header.sectorIndex = sectorIndex;
  header.sessionId = storageCurrentSessionId;
  header.recordVersion = kStorageRecordVersionV4;
  header.recordType = kStorageRecordTypeSampleV1;
  header.recordSize = sizeof(StorageRecordV4);
  if (!norProgram(address, &header, sizeof(header))) return false;

  storageSectorRecordCounts[sectorIndex] = 0;
  storageSectorHeaderSizes[sectorIndex] = sizeof(NorSectorHeaderV3);
  storageSectorRecordVersions[sectorIndex] = kStorageRecordVersionV4;
  storageSectorSessionIds[sectorIndex] = storageCurrentSessionId;
  storageSectorPrefix[sectorIndex + 1U] = storageSectorPrefix[sectorIndex];
  storageSectorBytePrefix[sectorIndex + 1U] = storageSectorBytePrefix[sectorIndex];
  if (sectorIndex == 0 ||
      storageSectorSessionIds[sectorIndex - 1U] != storageCurrentSessionId) {
    storageState.sessionCount++;
  }
  storageState.sectorCount++;
  storageCurrentSectorWritable = true;
  return true;
}

bool norAppendRecords(const uint8_t* records, uint16_t recordSize, uint8_t recordCount) {
  if (!records || recordCount == 0U) return true;
  if (!storageCurrentSectorWritable && !norStartNewSector()) return false;
  uint16_t sectorIndex = (uint16_t)(storageState.sectorCount - 1U);
  uint8_t recordInSector = storageSectorRecordCounts[sectorIndex];
  const uint16_t expectedRecordSize =
    storageRecordSizeForVersion(storageSectorRecordVersions[sectorIndex]);
  const uint16_t recordLimit =
    storageRecordsPerSector(
      storageSectorHeaderSizes[sectorIndex],
      storageSectorRecordVersions[sectorIndex]);
  if (recordSize != expectedRecordSize || recordCount > (recordLimit - recordInSector)) return false;
  if (recordInSector >= recordLimit) {
    storageCurrentSectorWritable = false;
    if (!norStartNewSector()) return false;
    sectorIndex = (uint16_t)(storageState.sectorCount - 1U);
    recordInSector = 0;
  }

  const uint32_t address = norSectorAddress(sectorIndex) +
                           storageSectorHeaderSizes[sectorIndex] +
                           (uint32_t)recordInSector * recordSize;
  const size_t writeBytes = (size_t)recordSize * recordCount;
  if (!norProgram(address, records, writeBytes)) {
    storageCurrentSectorWritable = false;
    (void)norCloseSector(sectorIndex, recordInSector);
    return false;
  }

  const uint8_t nextRecordCount =
    (uint8_t)(storageSectorRecordCounts[sectorIndex] + recordCount);
  // Close the sector before publishing the drained records into the counters.
  // Samples queued by serviceRealtimeDuringStorageWait then still see the old
  // persisted count plus the not-yet-popped queue, so sequence IDs stay
  // contiguous even while the footer page is being programmed.
  if (nextRecordCount >= recordLimit) {
    if (!norCloseSector(sectorIndex, nextRecordCount)) {
      storageState.writeErrors++;
    }
    storageCurrentSectorWritable = false;
  }

  storageSectorRecordCounts[sectorIndex] = nextRecordCount;
  storageSectorPrefix[sectorIndex + 1U] =
    storageSectorPrefix[sectorIndex] + nextRecordCount;
  storageSectorBytePrefix[sectorIndex + 1U] =
    storageSectorBytePrefix[sectorIndex] +
    (uint32_t)nextRecordCount * recordSize;
  storageState.recordCount += recordCount;
  storageState.usedBytes += (uint32_t)writeBytes;
  return true;
}

void storageRefreshStats() {
  StorageLock lock;
  if (!lock) return;
  storageState.capacityBytes = storageState.ready ? kNorLogicalCapacityBytes : 0U;
  storageState.full = storageState.ready &&
                      storageState.sectorCount >= kNorDataSectorCount &&
                      !storageCurrentSectorWritable;
}

bool initFlashStorage() {
  StorageLock lock;
  if (!lock) {
    Serial.println("[W25Q] storage mutex unavailable");
    return false;
  }
  if (!allocateStorageIndex()) {
    storageState.ready = false;
    Serial.println("[W25Q] storage index allocation failed");
    return false;
  }

  if (!LittleFS.begin(false)) {
    Serial.println("[LFS] mount failed, formatting settings partition");
    flashFsReady = LittleFS.begin(true);
  } else {
    flashFsReady = true;
  }

  pinMode(kFlashCs, OUTPUT);
  pinMode(kFlashMiso, INPUT_PULLUP);
  pinMode(kFlashMosi, OUTPUT);
  pinMode(kFlashSclk, OUTPUT);
  digitalWrite(kFlashCs, HIGH);
  storageSpi.end();
  storageSpi.begin(kFlashSclk, kFlashMiso, kFlashMosi, kFlashCs);
  storageSpi.setHwCs(false);
  static constexpr uint32_t probeSpeeds[] = {
    1000000UL,
    4000000UL,
    10000000UL,
    20000000UL,
    kNorSpiHz,
  };
  uint32_t bestSpiHz = 0;
  uint8_t bestMfr = 0;
  uint8_t bestType = 0;
  uint8_t bestCapacity = 0;
  for (uint32_t probeHz : probeSpeeds) {
    storageSpiActiveHz = probeHz;
    norResetAndEnter4ByteMode();
    uint8_t probeMfr = 0;
    uint8_t probeType = 0;
    uint8_t probeCapacity = 0;
    bool stableId = true;
    for (uint8_t attempt = 0; attempt < 3U; ++attempt) {
      norReadJedecId();
      if (attempt == 0U) {
        probeMfr = storageJedecMfr;
        probeType = storageJedecType;
        probeCapacity = storageJedecCapacity;
      } else if (storageJedecMfr != probeMfr ||
                 storageJedecType != probeType ||
                 storageJedecCapacity != probeCapacity) {
        stableId = false;
      }
    }
    Serial.printf("[W25Q] probe spi=%luHz jedec=%02X %02X %02X\n",
                  (unsigned long)probeHz,
                  probeMfr, probeType, probeCapacity);
    if (stableId &&
        probeMfr == 0xEFU &&
        probeType == 0x40U &&
        probeCapacity == 0x19U) {
      bestSpiHz = probeHz;
      bestMfr = probeMfr;
      bestType = probeType;
      bestCapacity = probeCapacity;
    } else if (bestSpiHz != 0U) {
      break;
    }
  }

  const bool chipMatches = bestSpiHz != 0U;
  if (!chipMatches) {
    storageState.ready = false;
    Serial.printf("[W25Q] not ready jedec=%02X %02X %02X pins(cs=%d,miso=%d,mosi=%d,sclk=%d)\n",
                  storageJedecMfr, storageJedecType, storageJedecCapacity,
                  kFlashCs, kFlashMiso, kFlashMosi, kFlashSclk);
    return false;
  }
  storageJedecMfr = bestMfr;
  storageJedecType = bestType;
  storageJedecCapacity = bestCapacity;
  storageSpiActiveHz = bestSpiHz;

  NorMetadataV1 meta{};
  bool metaFound = false;
  for (uint8_t slot = 0; slot < kNorMetadataSlotCount; ++slot) {
    NorMetadataV1 candidate{};
    if (!norRead(norMetadataAddress(slot), &candidate, sizeof(candidate)) ||
        !norMetadataValid(candidate)) {
      continue;
    }
    if (!metaFound || candidate.generation > meta.generation) {
      meta = candidate;
      storageMetadataSlot = slot;
      metaFound = true;
    }
  }
  if (!metaFound) {
    storageMetadataSlot = 0;
    if (!norWriteMetadata(storageMetadataSlot, 1U)) {
      storageState.ready = false;
      Serial.println("[W25Q] metadata initialization failed");
      return false;
    }
    meta.magic = kNorMetadataMagic;
    meta.version = kNorFormatVersion;
    meta.headerSize = sizeof(NorMetadataV1);
    meta.generation = 1U;
    meta.generationInverse = ~1U;
  }

  storageClearQueue();
  storageClearIndex();
  storageState.generation = meta.generation;
  storageState.ready = true;
  storageState.capacityBytes = kNorLogicalCapacityBytes;
  storageState.startedAtMs = millis() - bootMs;

  uint16_t low = 0;
  uint16_t high = kNorDataSectorCount;
  while (low < high) {
    const uint16_t mid = (uint16_t)(low + (high - low) / 2U);
    if (norSectorHeaderValid(mid, storageState.generation)) low = (uint16_t)(mid + 1U);
    else high = mid;
  }
  storageState.sectorCount = low;

  uint32_t maxSessionId = 0;
  uint32_t previousSessionId = 0;
  for (uint16_t i = 0; i < storageState.sectorCount; ++i) {
    uint8_t headerSize = 0;
    uint32_t sessionId = 0;
    uint8_t recordVersion = 0;
    if (!norReadSectorInfo(i, storageState.generation, headerSize, sessionId, recordVersion)) {
      storageState.sectorCount = i;
      break;
    }
    storageSectorHeaderSizes[i] = headerSize;
    storageSectorRecordVersions[i] = recordVersion;
    storageSectorSessionIds[i] = sessionId;
    if (sessionId != previousSessionId) {
      storageState.sessionCount++;
      previousSessionId = sessionId;
    }
    if (sessionId > maxSessionId) maxSessionId = sessionId;

    uint8_t count = 0;
    bool writable = false;
    const bool footerValid =
      norReadSectorFooter(i, storageState.generation, count) &&
      count <= storageRecordsPerSector(headerSize, recordVersion);
    if (!footerValid) {
      count = norScanSectorRecords(
        i,
        headerSize,
        recordVersion,
        storageSectorPrefix[i] + 1U,
        writable);
      if (i + 1U < storageState.sectorCount || !writable) {
        if (!norCloseSector(i, count)) storageState.writeErrors++;
        writable = false;
      }
    }
    storageSectorRecordCounts[i] = count;
    storageSectorPrefix[i + 1U] = storageSectorPrefix[i] + count;
    storageSectorBytePrefix[i + 1U] =
      storageSectorBytePrefix[i] +
      (uint32_t)count * storageRecordSizeForVersion(recordVersion);
    if (i + 1U == storageState.sectorCount) storageCurrentSectorWritable = writable;
  }

  storageState.recordCount = storageSectorPrefix[storageState.sectorCount];
  storageState.usedBytes = storageSectorBytePrefix[storageState.sectorCount];
  if (storageState.sectorCount > 0 && storageCurrentSectorWritable) {
    const uint16_t lastSector = (uint16_t)(storageState.sectorCount - 1U);
    if (!norCloseSector(lastSector, storageSectorRecordCounts[lastSector])) {
      storageState.writeErrors++;
    }
  }
  storageCurrentSectorWritable = false;
  storageCurrentSessionId = maxSessionId + 1U;
  if (storageCurrentSessionId == 0U) storageCurrentSessionId = 1U;
  if (!norStartNewSector()) {
    storageState.full = storageState.sectorCount >= kNorDataSectorCount;
    storageRefreshStats();
    Serial.printf("[W25Q] read-only: no space for boot session %lu; existing sessions remain available\n",
                  (unsigned long)storageCurrentSessionId);
    return true;
  }
  storageRefreshStats();
  Serial.printf("[W25Q] ready model=W25Q256JVEIQ jedec=%02X %02X %02X physical=%lu usable=%lu used=%lu records=%lu sectors=%lu sessions=%lu current=FLASH6_BOOT_%06lu spi=%luHz\n",
                storageJedecMfr, storageJedecType, storageJedecCapacity,
                (unsigned long)kNorExpectedCapacityBytes,
                (unsigned long)storageState.capacityBytes,
                (unsigned long)storageState.usedBytes,
                (unsigned long)storageState.recordCount,
                (unsigned long)storageState.sectorCount,
                (unsigned long)storageState.sessionCount,
                (unsigned long)storageCurrentSessionId,
                (unsigned long)storageSpiActiveHz);
  return true;
}

bool storageFlush(bool force = false) {
  StorageLock lock(force ? kStorageLockWaitTicks : 0);
  if (!lock) return !force;
  if (!storageState.ready) return false;
  if (storageQueueCount == 0) return true;

  const uint32_t nowMs = millis();
  if (!force &&
      storageQueueCount < kStorageDrainBatchMax &&
      (uint32_t)(nowMs - storageState.lastFlushMs) < kStorageFlushIntervalMs) {
    return true;
  }

  storageState.busy = true;
  uint16_t drained = 0;
  const uint16_t drainLimit = force ? kStorageQueueDepth : kStorageDrainBatchMax;
  while (storageQueueCount > 0 && drained < drainLimit) {
    if (!storageCurrentSectorWritable && !norStartNewSector()) {
      storageState.writeErrors++;
      break;
    }
    const uint16_t sectorIndex = (uint16_t)(storageState.sectorCount - 1U);
    const uint16_t recordSize =
      storageRecordSizeForVersion(storageSectorRecordVersions[sectorIndex]);
    const uint16_t recordLimit =
      storageRecordsPerSector(
        storageSectorHeaderSizes[sectorIndex],
        storageSectorRecordVersions[sectorIndex]);
    const uint16_t sectorRoom = recordLimit - storageSectorRecordCounts[sectorIndex];
    const uint16_t batchLimit = min<uint16_t>(
      min<uint16_t>(
        min<uint16_t>((uint16_t)(drainLimit - drained), storageQueueCount),
        kStorageDrainBatchMax),
      sectorRoom);
    if (batchLimit == 0U) {
      storageCurrentSectorWritable = false;
      continue;
    }

    uint8_t batch[kStorageDrainBatchMax * sizeof(StorageRecordV1)];
    uint16_t batchCount = 0;
    uint16_t queueIndex = storageQueueHead;
    while (batchCount < batchLimit) {
      const StorageQueueEntry& entry = storageQueue[queueIndex];
      if (entry.size != recordSize) break;
      memcpy(batch + (size_t)batchCount * recordSize, entry.bytes, recordSize);
      batchCount++;
      queueIndex = (uint16_t)((queueIndex + 1U) % kStorageQueueDepth);
    }
    if (batchCount == 0U ||
        !norAppendRecords(batch, recordSize, (uint8_t)batchCount)) {
      storageState.writeErrors++;
      break;
    }
    for (uint16_t i = 0; i < batchCount; ++i) {
      const StorageQueueEntry& entry = storageQueue[storageQueueHead];
      storageState.queueBytes = storageState.queueBytes >= entry.size
        ? storageState.queueBytes - entry.size
        : 0U;
      storageQueueHead = (uint16_t)((storageQueueHead + 1U) % kStorageQueueDepth);
      storageQueueCount--;
    }
    drained = (uint16_t)(drained + batchCount);
  }

  if (drained > 0) storageState.flushCount++;
  storageState.lastFlushMs = nowMs;
  storageState.busy = false;
  return storageQueueCount == 0 || drained > 0;
}

bool storageReset() {
  StorageLock lock;
  if (!lock || storageResetActive) return false;
  if (!storageState.ready) return false;
  storageResetActive = true;
  storageState.busy = true;
  storageClearQueue();
  uint32_t nextGeneration = storageState.generation + 1U;
  uint8_t nextSlot = (uint8_t)((storageMetadataSlot + 1U) % kNorMetadataSlotCount);
  if (nextGeneration == 0U) {
    nextGeneration = 1U;
    for (uint8_t slot = 0; slot < kNorMetadataSlotCount; ++slot) {
      if (!norEraseSector(norMetadataAddress(slot))) {
        storageResetActive = false;
        storageState.busy = false;
        storageState.writeErrors++;
        return false;
      }
    }
    nextSlot = 0;
  }
  if (!norWriteMetadata(nextSlot, nextGeneration)) {
    storageResetActive = false;
    storageState.busy = false;
    storageState.writeErrors++;
    return false;
  }
  storageClearIndex();
  storageMetadataSlot = nextSlot;
  storageState.generation = nextGeneration;
  storageState.capacityBytes = kNorLogicalCapacityBytes;
  storageState.droppedRecords = 0;
  storageState.flushCount = 0;
  storageState.writeErrors = 0;
  storageState.startedAtMs = millis() - bootMs;
  storageCurrentSessionId = 1U;
  if (!norStartNewSector()) {
    storageResetActive = false;
    storageState.busy = false;
    storageState.ready = false;
    return false;
  }
  storageResetActive = false;
  storageState.busy = false;
  storageRefreshStats();
  return true;
}

void storageEnqueueSample(uint32_t timestampMs) {
  if (storageResetActive) return;
  StorageLock lock(0);
  if (!lock) {
    storageLockSkippedSamples++;
    return;
  }
  // NOR page-program and sector-erase waits are serviced on the loop task.
  // The queue is safe to append from that recursive service path and doing so
  // prevents the 200 Hz recorder from losing every sample taken during an
  // erase. Other tasks still have to wait for the storage owner.
  const bool realtimeWaitOnLoopTask =
    storageWaitServiceActive &&
    loopTaskHandle != nullptr &&
    xTaskGetCurrentTaskHandle() == loopTaskHandle;
  if (storageState.busy && !realtimeWaitOnLoopTask) {
    storageLockSkippedSamples++;
    return;
  }
  if (!storageState.ready || storageState.full || !snap.sampleValid) return;
  if ((storageState.usedBytes + storageState.queueBytes + sizeof(StorageRecordV4)) >
      storageState.capacityBytes) {
    storageState.full = true;
    storageState.droppedRecords++;
    return;
  }
  if (storageQueueCount >= kStorageQueueDepth) {
    storageState.droppedRecords++;
    return;
  }

  const uint32_t nowMs = millis();
  StorageQueueEntry& entry = storageQueue[storageQueueTail];
  memset(entry.bytes, 0, sizeof(entry.bytes));
  entry.size = sizeof(StorageRecordV4);
  StorageRecordV4& rec = *reinterpret_cast<StorageRecordV4*>(entry.bytes);
  rec.header.marker = kStorageRecordMarker;
  rec.header.version = kStorageRecordVersionV4;
  rec.header.type = kStorageRecordTypeSampleV1;
  rec.header.payloadSize = sizeof(StorageSamplePayloadV4);
  rec.header.flags = 0;
  rec.header.timestampMs = timestampMs;
  rec.header.seq = storageState.recordCount + storageQueueCount + 1U;

  rec.payload.p = snap.baroValid ? snap.p : 0.0f;
  rec.payload.altM = snap.baroValid ? snap.altM : 0.0f;
  rec.payload.axMilliG = quantizeInt16(snap.ax, -32.767f, 32.767f, 1000.0f);
  rec.payload.ayMilliG = quantizeInt16(snap.ay, -32.767f, 32.767f, 1000.0f);
  rec.payload.azMilliG = quantizeInt16(snap.az, -32.767f, 32.767f, 1000.0f);
  rec.payload.gxDeciDps = quantizeInt16(snap.gx, -3276.7f, 3276.7f, 10.0f);
  rec.payload.gyDeciDps = quantizeInt16(snap.gy, -3276.7f, 3276.7f, 10.0f);
  rec.payload.gzDeciDps = quantizeInt16(snap.gz, -3276.7f, 3276.7f, 10.0f);
  rec.payload.rollCentiDeg = quantizeInt16(snap.roll, -180.0f, 180.0f, 100.0f);
  rec.payload.pitchCentiDeg = quantizeInt16(snap.pitch, -180.0f, 180.0f, 100.0f);
  rec.payload.yawCentiDeg = quantizeInt16(snap.yaw, -180.0f, 180.0f, 100.0f);
  rec.payload.td = sequenceTdMs(nowMs);
  rec.payload.loopUs = (uint16_t)min<uint32_t>(
    65535U, (uint32_t)fmaxf(1.0f, snap.lt * 1000.0f));
  rec.payload.cpuUs = snap.ct;
  uint16_t flags = 0;
  if (snap.baroValid) flags |= 1U << 0;
  if (snap.attitudeValid) flags |= 1U << 1;
  if (armSwitchEffectiveOn()) flags |= 1U << 2;
  if (sequenceUserWaiting) flags |= 1U << 3;
  if (sequenceAbortActive(nowMs)) flags |= 1U << 4;
  if (safetyMode) flags |= 1U << 5;
  if (serialStream) flags |= 1U << 6;
  if (snap.sampleValid) flags |= 1U << 7;
  if (armSwitchPhysicalOn()) flags |= 1U << 13;
  const uint8_t deploymentState = snap.deploymentState & 0x07U;
  if (deploymentState & 0x01U) flags |= 1U << 11;
  if (deploymentState & 0x02U) flags |= 1U << 12;
  if (deploymentState & 0x04U) flags |= 1U << 14;
  flags |= (uint16_t)(snap.flightPhase & 0x07U) << 8;
  flags |= 1U << 15;
  rec.payload.flags = flags;
  rec.payload.st = sequenceState;
  rec.payload.relayMask = sequenceRelayMaskNow(nowMs);
  rec.payload.abortReason = sequenceAbortReason;
  rec.payload.mode = dataOperationModeCode();
  rec.payload.thrustMilliKgf = snap.loadcellValid
    ? quantizeInt32(snap.thrustKgf, -2147483.0f, 2147483.0f, 1000.0f)
    : INT32_MIN;
  rec.payload.loadcellRaw = snap.loadcellRaw;
  rec.payload.loadcellHz = snap.loadcellHz;
  rec.payload.loadcellFlags = loadcellFlagsForTelemetry(snap);
  rec.payload.gpsLatE7 = (snap.gpsFix && isfinite(snap.gpsLat))
    ? quantizeInt32(snap.gpsLat, -90.0f, 90.0f, 10000000.0f)
    : INT32_MIN;
  rec.payload.gpsLonE7 = (snap.gpsFix && isfinite(snap.gpsLon))
    ? quantizeInt32(snap.gpsLon, -180.0f, 180.0f, 10000000.0f)
    : INT32_MIN;
  rec.payload.gpsAltCm = (snap.gpsFix && isfinite(snap.gpsAlt))
    ? quantizeInt32(snap.gpsAlt, -21474836.0f, 21474836.0f, 100.0f)
    : INT32_MIN;
  rec.payload.gpsAgeMs = (uint16_t)min<uint32_t>(65535U, snap.gpsAgeMs);
  uint16_t gpsFlags = 0;
  if (snap.gpsFix) gpsFlags |= 1U << 0;
  if (snap.gpsSeen) gpsFlags |= 1U << 1;
  if (snap.gpsReady) gpsFlags |= 1U << 2;
  if (snap.gpsTimeValid) gpsFlags |= 1U << 3;
  rec.payload.gpsFlags = gpsFlags;
  rec.header.flags = crc16Ccitt(
    reinterpret_cast<const uint8_t*>(&rec.payload), sizeof(rec.payload));

  storageQueueTail = (uint16_t)((storageQueueTail + 1U) % kStorageQueueDepth);
  storageQueueCount++;
  storageState.queueBytes += entry.size;
}

bool storageEnqueueMissionAlarm(
  uint32_t timestampMs,
  uint32_t eventSeq,
  uint16_t blockIndex,
  const char* title,
  const char* message
) {
  if (storageResetActive) return false;
  StorageLock lock(0);
  if (!lock || !storageState.ready || storageState.full) return false;
  if ((storageState.usedBytes + storageState.queueBytes +
       sizeof(StorageMissionAlarmRecordV2)) > storageState.capacityBytes) {
    storageState.full = true;
    storageState.droppedRecords++;
    return false;
  }
  if (storageQueueCount >= kStorageQueueDepth) {
    storageState.droppedRecords++;
    return false;
  }

  StorageQueueEntry& entry = storageQueue[storageQueueTail];
  entry.size = sizeof(StorageMissionAlarmRecordV2);
  StorageMissionAlarmRecordV2& rec =
    *reinterpret_cast<StorageMissionAlarmRecordV2*>(entry.bytes);
  memset(&rec, 0, sizeof(rec));
  rec.header.marker = kStorageRecordMarker;
  rec.header.version = kStorageRecordVersionV4;
  rec.header.type = kStorageRecordTypeMissionAlarmV1;
  rec.header.payloadSize = sizeof(StorageMissionAlarmPayloadV2);
  rec.header.timestampMs = timestampMs;
  rec.header.seq = storageState.recordCount + storageQueueCount + 1U;
  rec.payload.eventSeq = eventSeq;
  rec.payload.blockIndex = (uint8_t)min<uint16_t>(UINT8_MAX, blockIndex);
  rec.payload.severity = 1U;
  strlcpy(
    rec.payload.title,
    title && title[0] ? title : "Mission alarm",
    sizeof(rec.payload.title));
  strlcpy(
    rec.payload.message,
    message && message[0] ? message : "Alarm triggered",
    sizeof(rec.payload.message));
  if (snap.gpsDateValid && snap.gpsEpochMs >= 946684800000ULL) {
    int64_t eventEpochMs = (int64_t)snap.gpsEpochMs;
    const int32_t sampleDeltaMs = (int32_t)(timestampMs - snap.ut);
    if (sampleDeltaMs > -10000 && sampleDeltaMs < 10000) {
      eventEpochMs += sampleDeltaMs;
    }
    const uint64_t storedEpochMs = eventEpochMs > 0 ? (uint64_t)eventEpochMs : 0ULL;
    const uint32_t utcMarker = 0x31435455UL;  // "UTC1"
    memcpy(rec.payload.reserved + 0, &storedEpochMs, sizeof(storedEpochMs));
    memcpy(rec.payload.reserved + 8, &utcMarker, sizeof(utcMarker));
  }
  rec.header.flags = crc16Ccitt(
    reinterpret_cast<const uint8_t*>(&rec.payload), sizeof(rec.payload));

  storageQueueTail = (uint16_t)((storageQueueTail + 1U) % kStorageQueueDepth);
  storageQueueCount++;
  storageState.queueBytes += entry.size;
  return true;
}

void storageTick() {
  if (!storageState.ready || storageQueueCount == 0U) return;
  const uint32_t nowMs = millis();
  if (storageQueueCount < kStorageDrainBatchMax &&
      (uint32_t)(nowMs - storageState.lastFlushMs) < kStorageFlushIntervalMs) {
    return;
  }
  storageFlush(false);
}

bool storageRead(
  uint32_t offset,
  uint8_t* out,
  size_t len,
  uint32_t expectedGeneration = 0U
) {
  StorageLock lock;
  if (!lock) return false;
  if (!storageState.ready || !out) return false;
  if (expectedGeneration != 0U &&
      storageState.generation != expectedGeneration) {
    return false;
  }
  if (len == 0) return true;
  if (offset > storageState.usedBytes || len > (size_t)(storageState.usedBytes - offset)) return false;

  while (len > 0) {
    uint16_t low = 0;
    uint16_t high = (uint16_t)storageState.sectorCount;
    while (low < high) {
      const uint16_t mid = (uint16_t)(low + (high - low) / 2U);
      if (storageSectorBytePrefix[mid + 1U] <= offset) low = (uint16_t)(mid + 1U);
      else high = mid;
    }
    if (low >= storageState.sectorCount) return false;

    const uint32_t byteInSector = offset - storageSectorBytePrefix[low];
    const uint32_t sectorBytes =
      (uint32_t)storageSectorRecordCounts[low] *
      storageRecordSizeForVersion(storageSectorRecordVersions[low]);
    if (byteInSector >= sectorBytes) return false;
    const size_t chunk = min<size_t>(len, sectorBytes - byteInSector);
    const uint32_t physicalAddress = norSectorAddress(low) +
                                     storageSectorHeaderSizes[low] +
                                     byteInSector;
    if (!norRead(physicalAddress, out, chunk)) return false;
    offset += chunk;
    out += chunk;
    len -= chunk;
  }
  return true;
}

uint32_t storageCountRecordsInRange(uint32_t offset, uint32_t len) {
  StorageLock lock;
  if (!lock) return 0U;
  if (len == 0U || offset >= storageState.usedBytes) return 0U;
  const uint32_t end = min<uint32_t>(storageState.usedBytes, offset + len);
  uint32_t count = 0;
  for (uint16_t i = 0; i < storageState.sectorCount; ++i) {
    const uint32_t sectorStart = storageSectorBytePrefix[i];
    const uint32_t sectorEnd = storageSectorBytePrefix[i + 1U];
    if (sectorEnd <= offset) continue;
    if (sectorStart >= end) break;
    const uint16_t recordSize =
      storageRecordSizeForVersion(storageSectorRecordVersions[i]);
    const uint32_t overlapStart = max<uint32_t>(offset, sectorStart);
    const uint32_t overlapEnd = min<uint32_t>(end, sectorEnd);
    if (overlapEnd > overlapStart && recordSize > 0U) {
      count += (overlapEnd - overlapStart) / recordSize;
    }
  }
  return count;
}

bool storageGetSessionInfo(uint32_t ordinal, StorageSessionInfo& out) {
  StorageLock lock;
  if (!lock) return false;
  if (ordinal >= storageState.sessionCount || storageState.sectorCount == 0) return false;
  uint32_t currentOrdinal = 0;
  uint16_t firstSector = 0;
  while (firstSector < storageState.sectorCount) {
    const uint32_t sessionId = storageSectorSessionIds[firstSector];
    uint16_t endSector = (uint16_t)(firstSector + 1U);
    while (endSector < storageState.sectorCount &&
           storageSectorSessionIds[endSector] == sessionId) {
      endSector++;
    }
    if (currentOrdinal == ordinal) {
      const uint32_t firstRecord = storageSectorPrefix[firstSector];
      const uint32_t endRecord = storageSectorPrefix[endSector];
      out.id = sessionId;
      out.offsetBytes = storageSectorBytePrefix[firstSector];
      out.records = endRecord - firstRecord;
      out.bytes = storageSectorBytePrefix[endSector] - storageSectorBytePrefix[firstSector];
      out.firstSector = firstSector;
      out.sectorCount = (uint16_t)(endSector - firstSector);
      return true;
    }
    currentOrdinal++;
    firstSector = endSector;
  }
  return false;
}

void storageSessionName(uint32_t sessionId, char* out, size_t outLen) {
  if (!out || outLen == 0) return;
  snprintf(out, outLen, "FLASH6_BOOT_%06lu", (unsigned long)sessionId);
}

String storageStatusJson() {
  StorageRuntime state{};
  uint8_t jedecMfr = 0;
  uint8_t jedecType = 0;
  uint8_t jedecCapacity = 0;
  uint32_t spiHz = 0;
  uint32_t currentSessionId = 0;
  uint32_t lockSkippedSamples = 0;
  {
    StorageLock lock(0);
    if (!lock) return "{\"ok\":0,\"err\":\"STORAGE_BUSY\"}";
    storageRefreshStats();
    state = storageState;
    jedecMfr = storageJedecMfr;
    jedecType = storageJedecType;
    jedecCapacity = storageJedecCapacity;
    spiHz = storageSpiActiveHz;
    currentSessionId = storageCurrentSessionId;
    lockSkippedSamples = storageLockSkippedSamples;
  }
  const float usedPct = state.capacityBytes > 0
    ? ((float)state.usedBytes * 100.0f / (float)state.capacityBytes)
    : 0.0f;
  char json[1100];
  char currentName[32];
  storageSessionName(currentSessionId, currentName, sizeof(currentName));
  snprintf(json, sizeof(json),
    "{\"ok\":1,\"ready\":%u,\"busy\":%u,\"full\":%u,"
    "\"reset_reason\":\"%s\",\"reset_code\":%u,"
    "\"storage_kind\":\"external_spi_nor\",\"model\":\"W25Q256JVEIQ\","
    "\"jedec\":{\"mfr\":%u,\"type\":%u,\"cap_code\":%u},"
    "\"chip_capacity_bytes\":%lu,"
    "\"capacity_bytes\":%lu,\"used_bytes\":%lu,\"queue_bytes\":%lu,\"used_percent\":%.2f,"
    "\"record_hz\":%lu,\"selected_spi_hz\":%lu,\"session_count\":%lu,"
    "\"record_format\":\"mixed-v1-v2-v3-v4\",\"current_record_version\":%u,\"current_record_bytes\":%u,"
    "\"current_session_id\":%lu,\"current_file\":\"%s\",\"record_count\":%lu,"
    "\"dropped_records\":%lu,\"lock_skipped_samples\":%lu,"
    "\"flush_count\":%lu,\"write_errors\":%lu,"
    "\"generation\":%lu,\"sector_count\":%lu,\"log_path\":\"raw://w25q256/flash6_log\"}",
    state.ready ? 1U : 0U,
    state.busy ? 1U : 0U,
    state.full ? 1U : 0U,
    resetReasonName(bootResetReason),
    (unsigned)bootResetReason,
    (unsigned)jedecMfr,
    (unsigned)jedecType,
    (unsigned)jedecCapacity,
    (unsigned long)kNorExpectedCapacityBytes,
    (unsigned long)state.capacityBytes,
    (unsigned long)state.usedBytes,
    (unsigned long)state.queueBytes,
    usedPct,
    (unsigned long)kStorageRecordHz,
    (unsigned long)spiHz,
    (unsigned long)state.sessionCount,
    (unsigned)kStorageRecordVersionV4,
    (unsigned)sizeof(StorageRecordV4),
    (unsigned long)currentSessionId,
    currentName,
    (unsigned long)state.recordCount,
    (unsigned long)state.droppedRecords,
    (unsigned long)lockSkippedSamples,
    (unsigned long)state.flushCount,
    (unsigned long)state.writeErrors,
    (unsigned long)state.generation,
    (unsigned long)state.sectorCount);
  return String(json);
}

String storageListJson() {
  StorageLock lock(0);
  if (!lock) return "{\"ok\":0,\"err\":\"STORAGE_BUSY\"}";
  storageRefreshStats();
  const float usedPct = storageState.capacityBytes > 0
    ? ((float)storageState.usedBytes * 100.0f / (float)storageState.capacityBytes)
    : 0.0f;
  String json;
  json.reserve(4600);
  json += "{\"ok\":1,\"ready\":";
  json += storageState.ready ? "1" : "0";
  json += ",\"full\":";
  json += storageState.full ? "1" : "0";
  json += ",\"capacity_bytes\":";
  json += String(storageState.capacityBytes);
  json += ",\"chip_capacity_bytes\":";
  json += String(kNorExpectedCapacityBytes);
  json += ",\"storage_kind\":\"external_spi_nor\",\"model\":\"W25Q256JVEIQ\"";
  json += ",\"used_bytes\":";
  json += String(storageState.usedBytes);
  json += ",\"used_percent\":";
  json += String(usedPct, 2);
  json += ",\"record_hz\":";
  json += String(kStorageRecordHz);
  json += ",\"selected_spi_hz\":";
  json += String(storageSpiActiveHz);
  json += ",\"session_count\":";
  json += String(storageState.sessionCount);
  const uint32_t firstListedSession =
    storageState.sessionCount > kStorageHttpListMaxItems
      ? storageState.sessionCount - kStorageHttpListMaxItems
      : 0U;
  json += ",\"listed_from\":";
  json += String(firstListedSession);
  json += ",\"items\":";
  json += "[";
  bool first = true;
  if (storageState.ready) {
    for (uint32_t ordinal = firstListedSession;
         ordinal < storageState.sessionCount;
         ++ordinal) {
      StorageSessionInfo item{};
      if (!storageGetSessionInfo(ordinal, item)) continue;
      char name[32];
      storageSessionName(item.id, name, sizeof(name));
      if (!first) json += ",";
      first = false;
      json += "{\"name\":\"";
      json += name;
      json += "\",\"session_id\":";
      json += String(item.id);
      json += ",\"offset\":";
      json += String(item.offsetBytes);
      json += ",\"bytes\":";
      json += String(item.bytes);
      json += ",\"records\":";
      json += String(item.records);
      json += ",\"current\":";
      json += item.id == storageCurrentSessionId ? "1" : "0";
      json += ",\"started_at_ms\":0}";
    }
  }
  json += "]}";
  return json;
}
