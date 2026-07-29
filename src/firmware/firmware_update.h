#pragma once

enum class FirmwareUpdateTransport : uint8_t {
  None = 0,
  Serial = 1,
  Http = 2,
};

struct FirmwareUpdateRuntime {
  bool active = false;
  bool shaReady = false;
  FirmwareUpdateTransport transport = FirmwareUpdateTransport::None;
  size_t expectedBytes = 0;
  size_t writtenBytes = 0;
  size_t nextProgressBytes = 0;
  uint32_t startedMs = 0;
  uint32_t lastWriteMs = 0;
  char expectedSha256[65] = {};
  char error[72] = {};
  mbedtls_sha256_context sha = {};
};

FirmwareUpdateRuntime firmwareUpdate;

constexpr size_t kFirmwareUpdateMinBytes = 64U * 1024U;
constexpr size_t kFirmwareUpdateMaxBytes = 5U * 1024U * 1024U;
constexpr size_t kFirmwareSerialChunkBytes = 768U;
constexpr size_t kFirmwareProgressStepBytes = 32U * 1024U;
constexpr uint32_t kFirmwareUpdateIdleTimeoutMs = 60000U;

bool firmwareUpdateActive() {
  return firmwareUpdate.active;
}

const char* firmwareUpdateTransportName(FirmwareUpdateTransport transport) {
  switch (transport) {
    case FirmwareUpdateTransport::Serial: return "serial";
    case FirmwareUpdateTransport::Http: return "http";
    default: return "none";
  }
}

void firmwareUpdateSetError(const char* error) {
  snprintf(
    firmwareUpdate.error,
    sizeof(firmwareUpdate.error),
    "%s",
    (error && error[0]) ? error : "UNKNOWN");
}

bool firmwareUpdateSha256Valid(const char* text) {
  if (!text || strlen(text) != 64U) return false;
  for (size_t i = 0; i < 64U; ++i) {
    const char c = text[i];
    if (!((c >= '0' && c <= '9') ||
          (c >= 'a' && c <= 'f') ||
          (c >= 'A' && c <= 'F'))) {
      return false;
    }
  }
  return true;
}

bool firmwareUpdateSafetyReady() {
  return roleConfigUnlockActive(millis()) &&
    safetyMode &&
    armLock &&
    sequenceState == kSequenceStateIdle &&
    !sequenceUserWaiting &&
    !missionLaunchStandby &&
    !buttonSequenceWarningActive &&
    sequenceRelayMask == 0U;
}

const char* firmwareUpdateSafetyError() {
  if (!roleConfigUnlockActive(millis())) return "PHYSICAL_AUTH_REQUIRED";
  if (!safetyMode) return "SAFETY_MODE_REQUIRED";
  if (!armLock) return "ARM_LOCK_REQUIRED";
  if (sequenceState != kSequenceStateIdle ||
      sequenceUserWaiting ||
      missionLaunchStandby ||
      buttonSequenceWarningActive) {
    return "SEQUENCE_ACTIVE";
  }
  if (sequenceRelayMask != 0U) return "PYRO_ACTIVE";
  return "";
}

void firmwareUpdateResetRuntime() {
  if (firmwareUpdate.shaReady) {
    mbedtls_sha256_free(&firmwareUpdate.sha);
  }
  firmwareUpdate = FirmwareUpdateRuntime();
}

void firmwareUpdateAbort(const char* reason) {
  if (Update.isRunning()) Update.abort();
  firmwareUpdateSetError(reason);
  char errorCopy[sizeof(firmwareUpdate.error)];
  snprintf(errorCopy, sizeof(errorCopy), "%s", firmwareUpdate.error);
  firmwareUpdateResetRuntime();
  firmwareUpdateSetError(errorCopy);
}

bool firmwareUpdateBegin(
  size_t totalBytes,
  const char* sha256,
  FirmwareUpdateTransport transport
) {
  if (firmwareUpdate.active || Update.isRunning()) {
    firmwareUpdateSetError("UPDATE_BUSY");
    return false;
  }
  if (!firmwareUpdateSafetyReady()) {
    firmwareUpdateSetError(firmwareUpdateSafetyError());
    return false;
  }
  if (transport == FirmwareUpdateTransport::None) {
    firmwareUpdateSetError("BAD_TRANSPORT");
    return false;
  }
  if (totalBytes < kFirmwareUpdateMinBytes ||
      totalBytes > kFirmwareUpdateMaxBytes) {
    firmwareUpdateSetError("BAD_SIZE");
    return false;
  }
  if (!firmwareUpdateSha256Valid(sha256)) {
    firmwareUpdateSetError("BAD_SHA256");
    return false;
  }

  firmwareUpdateResetRuntime();
  firmwareUpdate.active = true;
  firmwareUpdate.transport = transport;
  firmwareUpdate.expectedBytes = totalBytes;
  firmwareUpdate.startedMs = millis();
  firmwareUpdate.lastWriteMs = firmwareUpdate.startedMs;
  firmwareUpdate.nextProgressBytes = kFirmwareProgressStepBytes;
  snprintf(
    firmwareUpdate.expectedSha256,
    sizeof(firmwareUpdate.expectedSha256),
    "%s",
    sha256);
  for (size_t i = 0; i < 64U; ++i) {
    if (firmwareUpdate.expectedSha256[i] >= 'A' &&
        firmwareUpdate.expectedSha256[i] <= 'F') {
      firmwareUpdate.expectedSha256[i] =
        char(firmwareUpdate.expectedSha256[i] - 'A' + 'a');
    }
  }

  mbedtls_sha256_init(&firmwareUpdate.sha);
  if (mbedtls_sha256_starts_ret(&firmwareUpdate.sha, 0) != 0) {
    firmwareUpdate.shaReady = true;
    firmwareUpdateAbort("SHA_INIT_FAILED");
    return false;
  }
  firmwareUpdate.shaReady = true;

  if (!Update.begin(totalBytes, U_FLASH)) {
    firmwareUpdateAbort(Update.errorString());
    return false;
  }

  // The safety checks above guarantee that no mission output is owned. Keep
  // the pins explicitly low while telemetry, A.I LINK, sensors and logging
  // are paused for the update.
  sequenceRelayMask = 0U;
  sequenceRelayHoldUntilMs = 0U;
  applyPyroOutputs(millis());
  return true;
}

bool firmwareUpdateWrite(
  const uint8_t* data,
  size_t len,
  size_t offset
) {
  if (!firmwareUpdate.active || !data || len == 0U) {
    firmwareUpdateSetError("UPDATE_NOT_ACTIVE");
    return false;
  }
  if (offset != firmwareUpdate.writtenBytes ||
      len > firmwareUpdate.expectedBytes - firmwareUpdate.writtenBytes) {
    firmwareUpdateAbort("BAD_OFFSET");
    return false;
  }
  if (offset == 0U && data[0] != 0xE9U) {
    firmwareUpdateAbort("BAD_IMAGE_MAGIC");
    return false;
  }
  if (mbedtls_sha256_update_ret(&firmwareUpdate.sha, data, len) != 0) {
    firmwareUpdateAbort("SHA_UPDATE_FAILED");
    return false;
  }
  const size_t written = Update.write(const_cast<uint8_t*>(data), len);
  if (written != len) {
    firmwareUpdateAbort(Update.errorString());
    return false;
  }
  firmwareUpdate.writtenBytes += written;
  firmwareUpdate.lastWriteMs = millis();
  return true;
}

bool firmwareUpdateFinish(char* actualSha256, size_t actualSha256Len) {
  if (!firmwareUpdate.active ||
      firmwareUpdate.writtenBytes != firmwareUpdate.expectedBytes) {
    firmwareUpdateAbort("INCOMPLETE_IMAGE");
    return false;
  }

  uint8_t digest[32] = {};
  if (mbedtls_sha256_finish_ret(&firmwareUpdate.sha, digest) != 0) {
    firmwareUpdateAbort("SHA_FINISH_FAILED");
    return false;
  }
  mbedtls_sha256_free(&firmwareUpdate.sha);
  firmwareUpdate.shaReady = false;

  char digestHex[65];
  for (size_t i = 0; i < sizeof(digest); ++i) {
    snprintf(digestHex + i * 2U, 3U, "%02x", digest[i]);
  }
  digestHex[64] = '\0';
  if (actualSha256 && actualSha256Len > 0U) {
    snprintf(actualSha256, actualSha256Len, "%s", digestHex);
  }
  if (strcmp(digestHex, firmwareUpdate.expectedSha256) != 0) {
    firmwareUpdateAbort("SHA256_MISMATCH");
    return false;
  }
  if (!Update.end(false)) {
    firmwareUpdateAbort(Update.errorString());
    return false;
  }

  consumeRoleConfigUnlock();
  firmwareUpdate.active = false;
  firmwareUpdate.transport = FirmwareUpdateTransport::None;
  pendingRestart = true;
  restartAtMs = millis() + 1200U;
  return true;
}

String firmwareUpdateStatusJson() {
  char json[320];
  snprintf(
    json,
    sizeof(json),
    "{\"ok\":1,\"active\":%u,\"transport\":\"%s\","
    "\"written\":%u,\"total\":%u,\"error\":\"%s\","
    "\"authorized\":%u,\"safe\":%u,\"arm_lock\":%u}",
    firmwareUpdate.active ? 1U : 0U,
    firmwareUpdateTransportName(firmwareUpdate.transport),
    (unsigned)firmwareUpdate.writtenBytes,
    (unsigned)firmwareUpdate.expectedBytes,
    firmwareUpdate.error,
    roleConfigUnlockActive(millis()) ? 1U : 0U,
    safetyMode ? 1U : 0U,
    armLock ? 1U : 0U);
  return String(json);
}

void firmwareUpdateTick(uint32_t nowMs) {
  if (!firmwareUpdate.active) return;
  if ((uint32_t)(nowMs - firmwareUpdate.lastWriteMs) >
      kFirmwareUpdateIdleTimeoutMs) {
    const bool serialTransfer =
      firmwareUpdate.transport == FirmwareUpdateTransport::Serial;
    firmwareUpdateAbort("TRANSFER_TIMEOUT");
    if (serialTransfer) {
      Serial.println("ERR FIRMWARE_UPDATE TRANSFER_TIMEOUT");
    }
  }
}
