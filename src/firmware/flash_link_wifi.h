void flashLinkFormatMac(const uint8_t* mac, char* out, size_t outLen) {
  if (!out || outLen == 0) return;
  if (!mac) {
    snprintf(out, outLen, "--");
    return;
  }
  snprintf(out, outLen, "%02X:%02X:%02X:%02X:%02X:%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

const char* flashLinkCommandResultName(uint8_t result) {
  switch (static_cast<FlashLinkCommandResult>(result)) {
    case FlashLinkCommandResult::Ok: return "ok";
    case FlashLinkCommandResult::SafetyMode: return "safety_mode";
    case FlashLinkCommandResult::Busy: return "busy";
    case FlashLinkCommandResult::InvalidArgument: return "invalid_argument";
    default: return "unsupported";
  }
}

bool flashLinkSendPacket(
  FlashLinkPacketType type,
  const uint8_t* destination,
  const void* payload,
  uint16_t payloadBytes,
  uint32_t ack = 0,
  uint8_t targetNodeId = kFlashLinkNodeIdGround);

uint8_t flashLinkPacketSourceNode(const FlashLinkHeaderV1& header) {
  return header.flags & kFlashLinkNodeIdMask;
}

uint8_t flashLinkPacketTargetNode(const FlashLinkHeaderV1& header) {
  return (header.flags & kFlashLinkTargetNodeMask) >> kFlashLinkTargetNodeShift;
}

bool flashLinkPacketRelayed(const FlashLinkHeaderV1& header) {
  return (header.flags & kFlashLinkRelayedFlag) != 0U;
}

FlashLinkGroundPeer* flashLinkGroundPeerForNode(uint8_t nodeId) {
  if (nodeId < kFlashLinkNodeIdStage1 || nodeId > kFlashLinkNodeIdStage2) return nullptr;
  return &flashLinkGroundPeers[nodeId - kFlashLinkNodeIdStage1];
}

FlashLinkGroundPeer* flashLinkGroundPeerForMac(const uint8_t* mac) {
  if (!mac) return nullptr;
  for (uint8_t i = 0; i < kFlashLinkVehicleNodeCount; ++i) {
    FlashLinkGroundPeer& peer = flashLinkGroundPeers[i];
    if (peer.occupied && peer.directReady &&
        memcmp(peer.directMac, mac, ESP_NOW_ETH_ALEN) == 0) {
      return &peer;
    }
  }
  return nullptr;
}

bool flashLinkRouteFresh(uint32_t lastRxMs, uint32_t maxAgeMs) {
  return lastRxMs != 0U && (uint32_t)(millis() - lastRxMs) <= maxAgeMs;
}

void flashLinkGroundChooseRoute(FlashLinkGroundPeer& peer) {
  const bool directUsable = peer.directReady &&
    (peer.lastDirectRxMs == 0U ||
     flashLinkRouteFresh(peer.lastDirectRxMs, kFlashLinkPeerTimeoutMs));
  const bool relayUsable = peer.relayReady &&
    (peer.lastRelayRxMs == 0U ||
     flashLinkRouteFresh(peer.lastRelayRxMs, kFlashLinkPeerTimeoutMs));
  const uint32_t lastPrimaryRxMs = peer.lastRelayTelemetryRxMs != 0U
    ? peer.lastRelayTelemetryRxMs
    : peer.lastRelayRxMs;
  const bool relayActive = relayUsable && peer.relayLinked &&
    flashLinkRouteFresh(lastPrimaryRxMs, kFlashLinkPrimaryRouteFreshMs);
  const bool directActive = directUsable && peer.directLinked &&
    flashLinkRouteFresh(peer.lastDirectRxMs, kFlashLinkPeerTimeoutMs);
  const bool preferRelay = relayActive || (!directActive && relayUsable);
  peer.peerReady = relayUsable || directUsable;
  peer.relayed = peer.peerReady && preferRelay;
  if (preferRelay) {
    memcpy(peer.mac, peer.relayMac, ESP_NOW_ETH_ALEN);
    peer.rssiDbm = peer.relayRssiDbm;
    peer.lastRssiMs = peer.lastRelayRssiMs;
  } else if (directUsable) {
    memcpy(peer.mac, peer.directMac, ESP_NOW_ETH_ALEN);
    peer.rssiDbm = peer.directRssiDbm;
    peer.lastRssiMs = peer.lastDirectRssiMs;
  } else {
    memset(peer.mac, 0, sizeof(peer.mac));
    peer.rssiDbm = -127;
    peer.lastRssiMs = 0;
  }
  peer.linked = peer.directLinked || peer.relayLinked;
}

const uint8_t* flashLinkGroundCommandDestination(
  FlashLinkGroundPeer& peer,
  uint8_t attempts
) {
  flashLinkGroundChooseRoute(peer);
  const bool directUsable = peer.directReady && peer.directLinked &&
    (peer.lastDirectRxMs == 0U ||
     flashLinkRouteFresh(peer.lastDirectRxMs, kFlashLinkPeerTimeoutMs));
  const bool relayUsable = peer.relayReady && peer.relayLinked &&
    flashLinkRouteFresh(
      peer.lastRelayTelemetryRxMs != 0U
        ? peer.lastRelayTelemetryRxMs
        : peer.lastRelayRxMs,
      kFlashLinkPrimaryRouteFreshMs);
  if (relayUsable &&
      (!directUsable || attempts < kFlashLinkRelayCommandAttempts)) {
    return peer.relayMac;
  }
  if (directUsable) return peer.directMac;
  return relayUsable ? peer.relayMac : nullptr;
}

bool flashLinkGroundPeerActive(uint8_t nodeId) {
  FlashLinkGroundPeer* peer = flashLinkGroundPeerForNode(nodeId);
  if (peer) flashLinkGroundChooseRoute(*peer);
  return peer && peer->peerReady && peer->linked && peer->remoteValid &&
         peer->lastTelemetryRxMs != 0U &&
         (uint32_t)(millis() - peer->lastTelemetryRxMs) <= kFlashLinkTelemetryStaleMs;
}

void flashLinkGroundRefreshSelectedPeer() {
  if (!flashLinkGroundRole()) return;
  FlashLinkGroundPeer* peer = flashLinkGroundPeerForNode(flashLinkTargetNodeId);
  if (peer) flashLinkGroundChooseRoute(*peer);
  const bool ready = peer && peer->occupied && peer->peerReady;
  flashLink.peerReady = ready;
  flashLink.linked = ready && peer->linked;
  flashLink.remoteValid = ready && peer->remoteValid;
  if (!ready) {
    memset(flashLink.peerMac, 0, sizeof(flashLink.peerMac));
    flashLink.peerSession = 0;
    flashLink.rxTelemetrySeq = 0;
    flashLink.lastPeerRxMs = 0;
    flashLink.lastTelemetryRxMs = 0;
    flashLink.rxHz = 0;
    flashLink.rxLossPermille = 0;
    flashLink.rssiDbm = -127;
    flashLink.lastRssiMs = 0;
    flashLinkRemoteSnap = {};
    flashLinkRemoteState = {};
    missionAlarmRemote = {};
    return;
  }
  memcpy(flashLink.peerMac, peer->mac, ESP_NOW_ETH_ALEN);
  flashLink.peerSession = peer->session;
  flashLink.rxTelemetrySeq = peer->rxTelemetrySeq;
  flashLink.lastPeerRxMs = peer->lastPeerRxMs;
  flashLink.lastTelemetryRxMs = peer->lastTelemetryRxMs;
  flashLink.rxHz = peer->rxHz;
  flashLink.rxLossPermille = peer->rxLossPermille;
  flashLink.rssiDbm = peer->rssiDbm;
  flashLink.lastRssiMs = peer->lastRssiMs;
  flashLinkRemoteSnap = peer->snap;
  flashLinkRemoteState = peer->state;
  missionAlarmRemote.seq = peer->alarmSeq;
  missionAlarmRemote.timestampMs = peer->alarmTimestampMs;
  missionAlarmRemote.blockIndex = peer->alarmBlockIndex;
  missionCopyText(missionAlarmRemote.title, sizeof(missionAlarmRemote.title), peer->alarmTitle);
  missionCopyText(missionAlarmRemote.message, sizeof(missionAlarmRemote.message), peer->alarmMessage);
}

bool flashLinkCommandIsLongRunning(uint8_t code) {
  return code == static_cast<uint8_t>(FlashLinkCommandCode::StorageReset);
}

bool flashLinkCommandIsUrgent(uint8_t code) {
  return code == static_cast<uint8_t>(FlashLinkCommandCode::Abort) ||
         code == static_cast<uint8_t>(FlashLinkCommandCode::SequenceEnd) ||
         code == static_cast<uint8_t>(FlashLinkCommandCode::ForceIgnite);
}

bool flashLinkGroundControlActive() {
  flashLinkGroundRefreshSelectedPeer();
  return flashLinkGroundRole() &&
         flashLink.initialized &&
         flashLink.peerReady &&
         flashLinkOperational();
}

bool flashLinkCanProxyStorage() {
  return flashLinkGroundControlActive() && flashLinkRemoteActive();
}

void flashLinkStorageReadCancel(uint32_t transaction) {
  portENTER_CRITICAL(&flashLinkStorageReadMux);
  for (uint8_t i = 0; i < kFlashLinkStorageWindowDepth; ++i) {
    FlashLinkStorageReadClient& client = flashLinkStorageReadClients[i];
    if (transaction == 0 || client.transaction == transaction) {
      client.pending = false;
      client.ready = false;
    }
  }
  portEXIT_CRITICAL(&flashLinkStorageReadMux);
}

void flashLinkStorageListCancel(uint32_t transaction) {
  portENTER_CRITICAL(&flashLinkStorageReadMux);
  if (transaction == 0 || flashLinkStorageListClient.transaction == transaction) {
    flashLinkStorageListClient.pending = false;
    flashLinkStorageListClient.ready = false;
  }
  portEXIT_CRITICAL(&flashLinkStorageReadMux);
}

uint32_t flashLinkNextStorageReadTransaction() {
  uint32_t transaction = ++flashLink.nextStorageReadTransaction;
  if (transaction == 0) transaction = ++flashLink.nextStorageReadTransaction;
  return transaction;
}

bool flashLinkRequestStorageReadWindowed(
  uint32_t offset,
  uint16_t len,
  uint8_t* out,
  uint16_t& outLen,
  uint32_t timeoutMs
) {
  outLen = 0;
  if (!out || len == 0 || !flashLinkCanProxyStorage()) return false;
  const uint8_t targetNodeId = flashLinkTargetNodeId;

  struct PendingRead {
    bool active = false;
    bool sent = false;
    uint32_t transaction = 0;
    uint32_t offset = 0;
    uint16_t len = 0;
    uint16_t outOffset = 0;
    uint32_t lastSendMs = 0;
    uint8_t attempts = 0;
  };

  PendingRead reads[kFlashLinkStorageWindowDepth]{};
  uint16_t scheduled = 0;
  uint16_t completed = 0;
  uint8_t activeCount = 0;

  const uint32_t startMs = millis();
  uint32_t lastSendMs = 0;
  while ((uint32_t)(millis() - startMs) < max<uint32_t>(400U, timeoutMs)) {
    if (!flashLinkGroundPeerActive(targetNodeId)) {
      flashLinkStorageReadCancel(0);
      return false;
    }

    for (uint8_t i = 0; i < kFlashLinkStorageWindowDepth; ++i) {
      PendingRead& read = reads[i];
      if (!read.active) continue;

      bool ready = false;
      uint8_t status = 0;
      uint16_t responseLen = 0;
      uint8_t data[kFlashLinkStorageChunkBytes];
      portENTER_CRITICAL(&flashLinkStorageReadMux);
      FlashLinkStorageReadClient& client = flashLinkStorageReadClients[i];
      if (client.pending &&
          client.ready &&
          client.transaction == read.transaction &&
          client.offset == read.offset) {
        ready = true;
        status = client.status;
        responseLen = min<uint16_t>(client.len, kFlashLinkStorageChunkBytes);
        if (responseLen > 0) memcpy(data, client.data, responseLen);
        client.pending = false;
        client.ready = false;
      }
      portEXIT_CRITICAL(&flashLinkStorageReadMux);
      if (!ready) continue;

      if (status == 0 && responseLen == read.len) {
        memcpy(out + read.outOffset, data, responseLen);
        completed = (uint16_t)(completed + responseLen);
        read.active = false;
        if (activeCount > 0) activeCount--;
      } else if (status == 1 &&
                 read.attempts < kFlashLinkStorageRequestMaxAttempts) {
        read.transaction = flashLinkNextStorageReadTransaction();
        read.sent = false;
        read.lastSendMs = 0;
        portENTER_CRITICAL(&flashLinkStorageReadMux);
        client.pending = true;
        client.ready = false;
        client.transaction = read.transaction;
        client.offset = read.offset;
        client.requestedLen = read.len;
        client.len = 0;
        client.status = 0;
        client.completedMs = 0;
        client.targetNodeId = targetNodeId;
        portEXIT_CRITICAL(&flashLinkStorageReadMux);
      } else {
        flashLinkStorageReadCancel(0);
        return false;
      }
    }

    const uint32_t nowMs = millis();
    while (activeCount < kFlashLinkStorageWindowDepth && scheduled < len) {
      uint8_t slot = kFlashLinkStorageWindowDepth;
      portENTER_CRITICAL(&flashLinkStorageReadMux);
      for (uint8_t i = 0; i < kFlashLinkStorageWindowDepth; ++i) {
        if (!flashLinkStorageReadClients[i].pending && !reads[i].active) {
          slot = i;
          break;
        }
      }
      if (slot < kFlashLinkStorageWindowDepth) {
        const uint16_t chunk = min<uint16_t>(
          kFlashLinkStorageChunkBytes,
          len - scheduled);
        PendingRead& read = reads[slot];
        read.active = true;
        read.sent = false;
        read.transaction = flashLinkNextStorageReadTransaction();
        read.offset = offset + scheduled;
        read.len = chunk;
        read.outOffset = scheduled;
        read.lastSendMs = 0;
        read.attempts = 0;
        FlashLinkStorageReadClient& client = flashLinkStorageReadClients[slot];
        client.pending = true;
        client.ready = false;
        client.transaction = read.transaction;
        client.offset = read.offset;
        client.requestedLen = read.len;
        client.len = 0;
        client.status = 0;
        client.completedMs = 0;
        client.targetNodeId = targetNodeId;
        scheduled = (uint16_t)(scheduled + chunk);
        activeCount++;
      }
      portEXIT_CRITICAL(&flashLinkStorageReadMux);
      if (slot >= kFlashLinkStorageWindowDepth) break;
    }

    if (completed >= len) {
      outLen = completed;
      flashLinkStorageReadCancel(0);
      return true;
    }

    if (!flashLink.txBusy &&
        (lastSendMs == 0 ||
         (uint32_t)(nowMs - lastSendMs) >= kFlashLinkStorageRequestRetryMs)) {
      for (uint8_t i = 0; i < kFlashLinkStorageWindowDepth; ++i) {
        PendingRead& read = reads[i];
        if (!read.active || read.attempts >= kFlashLinkStorageRequestMaxAttempts) {
          continue;
        }
        const bool due =
          !read.sent ||
          (uint32_t)(nowMs - read.lastSendMs) >= kFlashLinkStorageRequestRetryMs;
        if (!due) continue;
        FlashLinkStorageReadRequestV1 request{};
        request.transaction = read.transaction;
        request.offset = read.offset;
        request.len = read.len;
        FlashLinkGroundPeer* targetPeer = flashLinkGroundPeerForNode(targetNodeId);
        const uint8_t* destination = targetPeer
          ? flashLinkGroundCommandDestination(*targetPeer, read.attempts)
          : nullptr;
        if (destination && flashLinkSendPacket(
              FlashLinkPacketType::StorageReadRequest,
              destination,
              &request,
              sizeof(request),
              0,
              targetNodeId)) {
          read.sent = true;
          read.lastSendMs = nowMs;
          read.attempts++;
          lastSendMs = nowMs;
        }
        break;
      }
    }
    delay(2);
  }

  flashLinkStorageReadCancel(0);
  return false;
}

bool flashLinkRequestStorageList(
  uint16_t startOrdinal,
  FlashLinkStorageListResponseV1& out,
  uint32_t timeoutMs
) {
  if (!flashLinkCanProxyStorage()) return false;
  const uint8_t targetNodeId = flashLinkTargetNodeId;
  const uint32_t transaction = flashLinkNextStorageReadTransaction();
  portENTER_CRITICAL(&flashLinkStorageReadMux);
  if (flashLinkStorageListClient.pending) {
    portEXIT_CRITICAL(&flashLinkStorageReadMux);
    return false;
  }
  flashLinkStorageListClient.pending = true;
  flashLinkStorageListClient.ready = false;
  flashLinkStorageListClient.transaction = transaction;
  flashLinkStorageListClient.targetNodeId = targetNodeId;
  flashLinkStorageListClient.response = {};
  portEXIT_CRITICAL(&flashLinkStorageReadMux);

  FlashLinkStorageListRequestV1 request{};
  request.transaction = transaction;
  request.startOrdinal = startOrdinal;
  request.limit = kFlashLinkStorageListBatchItems;
  uint32_t lastSendMs = 0;
  uint8_t attempts = 0;
  const uint32_t startMs = millis();
  while ((uint32_t)(millis() - startMs) < max<uint32_t>(400U, timeoutMs)) {
    if (!flashLinkGroundPeerActive(targetNodeId)) break;
    bool ready = false;
    FlashLinkStorageListResponseV1 response{};
    portENTER_CRITICAL(&flashLinkStorageReadMux);
    if (flashLinkStorageListClient.pending &&
        flashLinkStorageListClient.ready &&
        flashLinkStorageListClient.transaction == transaction) {
      ready = true;
      response = flashLinkStorageListClient.response;
      flashLinkStorageListClient.ready = false;
    }
    portEXIT_CRITICAL(&flashLinkStorageReadMux);
    if (ready && response.status != 1U) {
      out = response;
      flashLinkStorageListCancel(transaction);
      return response.status == 0U || response.status == 2U;
    }

    const uint32_t nowMs = millis();
    if (!flashLink.txBusy &&
        attempts < kFlashLinkStorageRequestMaxAttempts &&
        (lastSendMs == 0U ||
         (uint32_t)(nowMs - lastSendMs) >= kFlashLinkStorageRequestRetryMs)) {
      FlashLinkGroundPeer* targetPeer = flashLinkGroundPeerForNode(targetNodeId);
      const uint8_t* destination = targetPeer
        ? flashLinkGroundCommandDestination(*targetPeer, attempts)
        : nullptr;
      if (destination && flashLinkSendPacket(
            FlashLinkPacketType::StorageListRequest,
            destination,
            &request,
            sizeof(request),
            0,
            targetNodeId)) {
        lastSendMs = nowMs;
        attempts++;
      }
    }
    delay(2);
  }
  flashLinkStorageListCancel(transaction);
  return false;
}

bool flashLinkQueueCommand(
  FlashLinkCommandCode code,
  int32_t arg0,
  int32_t arg1,
  int32_t arg2
) {
  if (!flashLinkGroundControlActive()) return false;

  const uint8_t codeValue = static_cast<uint8_t>(code);
  const bool urgent = flashLinkCommandIsUrgent(codeValue);
  const bool allowDuplicate =
    codeValue == static_cast<uint8_t>(FlashLinkCommandCode::SetServo);
  const uint32_t nowMs = millis();
  bool queued = false;
  bool duplicate = false;
  bool coalesced = false;
  portENTER_CRITICAL(&flashLinkCommandMux);
  if (allowDuplicate && flashLinkCommandCount > 0) {
    for (uint8_t offset = 0; offset < flashLinkCommandCount; ++offset) {
      const uint8_t reverseOffset =
        (uint8_t)(flashLinkCommandCount - 1U - offset);
      const uint8_t index =
        (uint8_t)((flashLinkCommandHead + reverseOffset) %
                  kFlashLinkCommandQueueDepth);
      FlashLinkCommandQueueEntry& pending = flashLinkCommandQueue[index];
      if (pending.command.code == codeValue &&
          pending.targetNodeId == flashLinkTargetNodeId &&
          pending.command.arg0 == arg0 &&
          pending.attempts == 0U) {
        pending.command.arg1 = arg1;
        pending.command.arg2 = arg2;
        coalesced = true;
        break;
      }
    }
  }
  if (!allowDuplicate &&
      flashLink.lastQueuedTargetNodeId == flashLinkTargetNodeId &&
      flashLink.lastQueuedCommandCode == codeValue &&
      flashLink.lastQueuedArg0 == arg0 &&
      flashLink.lastQueuedArg1 == arg1 &&
      flashLink.lastQueuedArg2 == arg2 &&
      (uint32_t)(nowMs - flashLink.lastQueuedCommandMs) <= 500U) {
    duplicate = true;
  }
  for (uint8_t i = 0; !allowDuplicate && !duplicate && i < flashLinkCommandCount; ++i) {
    const uint8_t index =
      (uint8_t)((flashLinkCommandHead + i) % kFlashLinkCommandQueueDepth);
    const FlashLinkCommandV1& pending = flashLinkCommandQueue[index].command;
    duplicate =
      flashLinkCommandQueue[index].targetNodeId == flashLinkTargetNodeId &&
      pending.code == codeValue &&
      pending.arg0 == arg0 &&
      pending.arg1 == arg1 &&
      pending.arg2 == arg2;
  }
  if (!duplicate && !coalesced &&
      urgent &&
      flashLinkCommandCount >= kFlashLinkCommandQueueDepth) {
    flashLinkCommandTail =
      (uint8_t)((flashLinkCommandTail + kFlashLinkCommandQueueDepth - 1U) %
                kFlashLinkCommandQueueDepth);
    flashLinkCommandCount--;
    flashLink.commandFailed++;
  }
  if (!duplicate && !coalesced &&
      flashLinkCommandCount < kFlashLinkCommandQueueDepth) {
    uint8_t entryIndex = flashLinkCommandTail;
    if (urgent) {
      entryIndex =
        (uint8_t)((flashLinkCommandHead + kFlashLinkCommandQueueDepth - 1U) %
                  kFlashLinkCommandQueueDepth);
      flashLinkCommandHead = entryIndex;
      if (flashLinkCommandCount == 0U) {
        flashLinkCommandTail =
          (uint8_t)((entryIndex + 1U) % kFlashLinkCommandQueueDepth);
      }
    }
    FlashLinkCommandQueueEntry& entry = flashLinkCommandQueue[entryIndex];
    entry = {};
    entry.targetNodeId = flashLinkTargetNodeId;
    entry.command.transaction = ++flashLink.nextCommandTransaction;
    if (entry.command.transaction == 0) {
      entry.command.transaction = ++flashLink.nextCommandTransaction;
    }
    entry.command.code = codeValue;
    entry.command.arg0 = arg0;
    entry.command.arg1 = arg1;
    entry.command.arg2 = arg2;
    if (!urgent) {
      flashLinkCommandTail =
        (uint8_t)((flashLinkCommandTail + 1U) % kFlashLinkCommandQueueDepth);
    }
    flashLinkCommandCount++;
    flashLink.lastQueuedCommandMs = nowMs;
    flashLink.lastQueuedTargetNodeId = flashLinkTargetNodeId;
    flashLink.lastQueuedCommandCode = codeValue;
    flashLink.lastQueuedArg0 = arg0;
    flashLink.lastQueuedArg1 = arg1;
    flashLink.lastQueuedArg2 = arg2;
    queued = true;
  }
  portEXIT_CRITICAL(&flashLinkCommandMux);

  if (duplicate) return true;
  if (coalesced) return true;
  if (queued) {
    flashLink.commandQueued++;
    Serial.printf("[FLASH_LINK] command queued code=%u arg0=%ld arg1=%ld arg2=%ld\n",
                  (unsigned)code, (long)arg0, (long)arg1, (long)arg2);
  }
  return queued;
}

FlashLinkCommandResult flashLinkExecuteCommand(
  const FlashLinkCommandV1& command,
  int32_t& detail
) {
  detail = 0;
  const uint32_t nowMs = millis();
  switch (static_cast<FlashLinkCommandCode>(command.code)) {
    case FlashLinkCommandCode::SetSafety:
      safetyMode = command.arg0 != 0;
      detail = safetyMode ? 1 : 0;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SetArmLock:
      armLock = command.arg0 != 0;
      detail = armLock ? 1 : 0;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SetInspection:
      inspectionPassed = command.arg0 != 0;
      detail = inspectionPassed ? 1 : 0;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SetMute:
      setBuzzerMuted(command.arg0 != 0);
      detail = buzzerMuted ? 1 : 0;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SetIgnitionMs:
      setIgnitionDurationMs(command.arg0);
      detail = (int32_t)ignitionDurationMs;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SetCountdownMs:
      setCountdownDurationMs(command.arg0);
      detail = (int32_t)countdownDurationMs;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SetPyroChannel:
      if (command.arg0 < 1 || command.arg0 > kPyroChannelCount) {
        return FlashLinkCommandResult::InvalidArgument;
      }
      setDaqSequencePyroChannel(command.arg0);
      detail = daqSequencePyroChannel;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SetDataMode:
      if (command.arg0 != 0 && command.arg0 != 1) {
        return FlashLinkCommandResult::InvalidArgument;
      }
      flashLinkDataFlightMode = command.arg0 != 0;
      saveSequenceSettings();
      detail = flashLinkDataModeCode();
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SetServo:
      if (command.arg0 < 1 || command.arg0 > kServoChannelCount ||
          command.arg1 < 0 || command.arg1 > 180) {
        return FlashLinkCommandResult::InvalidArgument;
      }
      if (!setServoAngle((uint8_t)command.arg0, (uint8_t)command.arg1)) {
        return FlashLinkCommandResult::Busy;
      }
      detail = command.arg1;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SetPrecount:
      sequenceUserWaiting = command.arg0 != 0;
      if (sequenceUserWaiting && command.arg1 >= 3000 && command.arg1 <= 60000) {
        countdownDurationMs = (uint32_t)command.arg1;
      }
      detail = sequenceTdMs(nowMs);
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::StartCountdown:
      if (safetyMode) return FlashLinkCommandResult::SafetyMode;
      if (!startCountdownRuntime(nowMs)) return FlashLinkCommandResult::Busy;
      detail = sequenceTdMs(nowMs);
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::Ignite:
    case FlashLinkCommandCode::ForceIgnite:
      if (safetyMode) return FlashLinkCommandResult::SafetyMode;
      if (!startFiringRuntime(nowMs, daqSequencePyroChannel)) {
        return FlashLinkCommandResult::Busy;
      }
      detail = sequenceRelayMaskNow(nowMs);
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::Abort:
      abortSequenceRuntime(command.arg0 > 0 ? (uint8_t)command.arg0 : 1U);
      detail = sequenceAbortReason;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::SequenceEnd:
      clearSequenceRuntime();
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::PyroTest: {
      if (safetyMode) return FlashLinkCommandResult::SafetyMode;
      if (command.arg0 < 1 || command.arg0 > kPyroChannelCount ||
          command.arg1 < 10 || command.arg1 > 30000) {
        return FlashLinkCommandResult::InvalidArgument;
      }
      const uint8_t channel = (uint8_t)command.arg0;
      const uint32_t durationMs = (uint32_t)command.arg1;
      sequenceRelayMask = pyroMaskForChannel(channel);
      sequenceRelayHoldUntilMs = nowMs + durationMs;
      applyPyroOutputs(nowMs);
      buzzerPlayTone(2200, min<uint32_t>(180U, durationMs));
      detail = sequenceRelayMask;
      return FlashLinkCommandResult::Ok;
    }

    case FlashLinkCommandCode::GyroZero:
      setGyroZeroTarget(
        command.arg0 / 1000.0f,
        command.arg1 / 1000.0f,
        command.arg2 / 1000.0f);
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::GyroZeroReset:
      clearGyroZero();
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::BaroZero:
      resetBaroBase();
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::BaroReference:
      if (!setSeaLevelHpa(command.arg0 / 100.0f)) {
        return FlashLinkCommandResult::InvalidArgument;
      }
      resetBaroBase();
      detail = command.arg0;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::BuzzerTone:
      if (command.arg0 < kBuzzerMinHz || command.arg0 > kBuzzerMaxHz ||
          command.arg1 < 0 || command.arg1 > kBuzzerMaxPulseMs) {
        return FlashLinkCommandResult::InvalidArgument;
      }
      buzzerPlayTone((uint16_t)command.arg0, (uint16_t)command.arg1);
      detail = command.arg0;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::BuzzerStop:
      buzzerStop();
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::BuzzerFind:
      buzzerPlayFindMelody(command.arg0 != 0);
      detail = command.arg0 != 0 ? 1 : 0;
      return FlashLinkCommandResult::Ok;

    case FlashLinkCommandCode::StorageReset:
      if (sequenceState != kSequenceStateIdle || sequenceUserWaiting) {
        return FlashLinkCommandResult::Busy;
      }
      if (storageState.busy || storageWaitServiceActive) {
        return FlashLinkCommandResult::Busy;
      }
      if (!storageReset()) {
        return FlashLinkCommandResult::Busy;
      }
      detail = (int32_t)storageState.generation;
      return FlashLinkCommandResult::Ok;

  }
  return FlashLinkCommandResult::Unsupported;
}

uint16_t flashLinkLossPermille() {
  return flashLink.rxLossPermille;
}

bool wifiApShouldRun() {
  if (flashLinkGroundRole()) return true;
  if (!flashLinkMode && !flightMode) return true;  // DAQ/development Wi-Fi.
  return false;
}

const char* wifiModeText() {
  if (!wifiApShouldRun() && !flashLinkAvionicsRole()) return "off";
  wifi_mode_t mode = WIFI_MODE_NULL;
  if (esp_wifi_get_mode(&mode) != ESP_OK) return "unknown";
  switch (mode) {
    case WIFI_MODE_NULL: return "off";
    case WIFI_MODE_STA: return "STA";
    case WIFI_MODE_AP: return "AP";
    case WIFI_MODE_APSTA: return "AP_STA";
    default: return "unknown";
  }
}

bool wifiApActive() {
  if (!wifiApShouldRun()) return false;
  wifi_mode_t mode = WIFI_MODE_NULL;
  if (esp_wifi_get_mode(&mode) != ESP_OK) return false;
  const bool apMode = mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA;
  if (!apMode) return false;
  return WiFi.softAPIP() != IPAddress(0, 0, 0, 0);
}

bool startWifiAp(bool restart) {
  if (!wifiApShouldRun()) {
    wifiApReady = false;
    return false;
  }
  wifi_mode_t currentMode = WIFI_MODE_NULL;
  esp_wifi_get_mode(&currentMode);
  const wifi_mode_t wantedMode = flashLinkGroundRole()
    ? WIFI_MODE_APSTA
    : WIFI_MODE_AP;
  if (currentMode != wantedMode) {
    WiFi.mode(wantedMode);
    delay(30);
  }
  if (restart) {
    WiFi.softAPdisconnect(false);
    delay(30);
  }
  esp_wifi_set_bandwidth(WIFI_IF_AP, WIFI_BW_HT20);
  const bool configOk = WiFi.softAPConfig(
    IPAddress(192, 168, 4, 1),
    IPAddress(192, 168, 4, 1),
    IPAddress(255, 255, 255, 0));
  const bool ok = WiFi.softAP(apSsid, kWifiPass, kWifiChannel, 0, kWifiMaxClients);
  wifiApReady = ok && wifiApActive();
  if (wifiApReady) {
    wifiApConsecutiveFailures = 0;
  } else {
    wifiApStartFails++;
    if (wifiApConsecutiveFailures < UINT8_MAX) {
      wifiApConsecutiveFailures++;
    }
  }
  Serial.printf("[WIFI] AP %s SSID=%s IP=%s mode=%s config=%u restarts=%lu fails=%lu\n",
                wifiApReady ? "ready" : "failed",
                apSsid,
                WiFi.softAPIP().toString().c_str(),
                wifiModeText(),
                configOk ? 1U : 0U,
                (unsigned long)wifiApRestarts,
                (unsigned long)wifiApStartFails);
  return wifiApReady;
}

void wifiApWatchdogTick() {
  if (!wifiApShouldRun()) return;
  const uint32_t nowMs = millis();
  const uint32_t retryIntervalMs = min<uint32_t>(
    15000U,
    3000U << min<uint8_t>(wifiApConsecutiveFailures, 2U));
  if ((uint32_t)(nowMs - lastWifiApWatchdogMs) < retryIntervalMs) return;
  lastWifiApWatchdogMs = nowMs;
  if (wifiApActive()) {
    wifiApReady = true;
    wifiApConsecutiveFailures = 0;
    return;
  }
  wifiApRestarts++;
  Serial.printf("[WIFI] AP watchdog restart ssid=%s mode=%s ip=%s\n",
                apSsid,
                wifiModeText(),
                WiFi.softAPIP().toString().c_str());
  startWifiAp(true);
}

uint32_t flashLinkLastActivityMs() {
  if (flashLinkStage2LeafRole() && flashLinkDirectGround.lastRxMs != 0U) {
    if (flashLink.lastPeerRxMs == 0U ||
        (uint32_t)(millis() - flashLinkDirectGround.lastRxMs) <
          (uint32_t)(millis() - flashLink.lastPeerRxMs)) {
      return flashLinkDirectGround.lastRxMs;
    }
  }
  return flashLink.lastPeerRxMs;
}

uint32_t flashLinkPeerAgeMs() {
  const uint32_t lastActivityMs = flashLinkLastActivityMs();
  if (!lastActivityMs) return UINT32_MAX;
  return millis() - lastActivityMs;
}

bool flashLinkRemoteActive() {
  return flashLinkGroundRole() &&
         flashLink.remoteValid &&
         flashLink.lastTelemetryRxMs != 0 &&
         (uint32_t)(millis() - flashLink.lastTelemetryRxMs) <= kFlashLinkTelemetryStaleMs;
}

bool flashLinkOperational() {
  if (!flashLink.initialized) return false;
  if (flashLinkGroundRole()) return flashLinkRemoteActive();
  if (flashLinkStage2LeafRole()) {
    const bool relayActive = flashLink.peerReady && flashLink.linked &&
      flashLink.lastPeerRxMs != 0U &&
      (uint32_t)(millis() - flashLink.lastPeerRxMs) <= kFlashLinkTelemetryStaleMs;
    const bool directActive = flashLinkDirectGround.peerReady &&
      flashLinkDirectGround.linked && flashLinkDirectGround.lastRxMs != 0U &&
      (uint32_t)(millis() - flashLinkDirectGround.lastRxMs) <=
        kFlashLinkTelemetryStaleMs;
    return directActive || relayActive;
  }
  if (!flashLink.peerReady || !flashLink.linked) return false;
  return flashLinkLastActivityMs() != 0 &&
         flashLinkPeerAgeMs() <= kFlashLinkTelemetryStaleMs;
}

void flashLinkOnSend(const uint8_t* mac, esp_now_send_status_t status) {
  flashLink.lastSendOk = status == ESP_NOW_SEND_SUCCESS;
  if (status == ESP_NOW_SEND_SUCCESS) {
    flashLink.txOk++;
    if (mac &&
        flashLink.peerReady &&
        memcmp(mac, flashLink.peerMac, ESP_NOW_ETH_ALEN) == 0) {
      flashLink.lastMacAckMs = millis();
    }
    if (mac && flashLinkStage2LeafRole() &&
        flashLinkDirectGround.peerReady &&
        memcmp(mac, flashLinkDirectGround.mac, ESP_NOW_ETH_ALEN) == 0) {
      flashLinkDirectGround.lastMacAckMs = millis();
    }
  } else {
    flashLink.txFail++;
    if (mac && flashLinkStage2LeafRole() &&
        flashLinkDirectGround.peerReady &&
        memcmp(mac, flashLinkDirectGround.mac, ESP_NOW_ETH_ALEN) == 0) {
      flashLinkDirectGround.txFail++;
    }
  }
  flashLink.txBusy = false;
}

bool flashLinkRxSlotIsTelemetryFrom(
  const FlashLinkRxSlot& slot,
  uint8_t sourceNodeId
) {
  if (slot.len < sizeof(FlashLinkHeaderV1)) return false;
  FlashLinkHeaderV1 header{};
  memcpy(&header, slot.data, sizeof(header));
  return header.magic == kFlashLinkMagic &&
         header.version == kFlashLinkVersion &&
         header.type == static_cast<uint8_t>(FlashLinkPacketType::Telemetry) &&
         flashLinkPacketSourceNode(header) == sourceNodeId;
}

void flashLinkOnReceive(const uint8_t* mac, const uint8_t* data, int dataLen) {
  if (!mac || !data || dataLen <= 0 || dataLen > (int)kFlashLinkMaxPacketBytes) return;
  FlashLinkHeaderV1 incomingHeader{};
  const bool hasHeader = dataLen >= (int)sizeof(incomingHeader);
  if (hasHeader) memcpy(&incomingHeader, data, sizeof(incomingHeader));
  const bool incomingTelemetry =
    hasHeader &&
    incomingHeader.magic == kFlashLinkMagic &&
    incomingHeader.type == static_cast<uint8_t>(FlashLinkPacketType::Telemetry);

  portENTER_CRITICAL(&flashLinkRxMux);
  if ((flashLinkGroundRole() || flashLinkStage1RelayRole()) && incomingTelemetry) {
    // A delayed telemetry sample has no value once a newer sample from the
    // same stage is waiting. Replace it in place instead of growing latency.
    if (flashLinkRxCount >= kFlashLinkTelemetryQueueSoftLimit) {
      const uint8_t sourceNodeId = flashLinkPacketSourceNode(incomingHeader);
      for (uint8_t offset = 0; offset < flashLinkRxCount; ++offset) {
        const uint8_t index = (uint8_t)(
          (flashLinkRxHead + flashLinkRxCount - 1U - offset) %
          kFlashLinkRxQueueDepth);
        FlashLinkRxSlot& pending = flashLinkRxQueue[index];
        if (!flashLinkRxSlotIsTelemetryFrom(pending, sourceNodeId)) continue;
        memcpy(pending.mac, mac, ESP_NOW_ETH_ALEN);
        pending.len = (uint16_t)dataLen;
        memcpy(pending.data, data, (size_t)dataLen);
        flashLink.rxQueueDrops++;
        portEXIT_CRITICAL(&flashLinkRxMux);
        return;
      }
    }
    while (flashLinkRxCount >= kFlashLinkTelemetryQueueSoftLimit) {
      const FlashLinkRxSlot& oldest = flashLinkRxQueue[flashLinkRxHead];
      const bool oldestIsTelemetry =
        oldest.len >= sizeof(FlashLinkHeaderV1) &&
        reinterpret_cast<const FlashLinkHeaderV1*>(oldest.data)->magic ==
          kFlashLinkMagic &&
        reinterpret_cast<const FlashLinkHeaderV1*>(oldest.data)->type ==
          static_cast<uint8_t>(FlashLinkPacketType::Telemetry);
      if (!oldestIsTelemetry) break;
      flashLinkRxHead = (uint8_t)((flashLinkRxHead + 1U) % kFlashLinkRxQueueDepth);
      flashLinkRxCount--;
      flashLink.rxQueueDrops++;
    }
  }
  if (flashLinkRxCount >= kFlashLinkRxQueueDepth) {
    flashLink.rxQueueDrops++;
    portEXIT_CRITICAL(&flashLinkRxMux);
    return;
  }
  FlashLinkRxSlot& slot = flashLinkRxQueue[flashLinkRxTail];
  memcpy(slot.mac, mac, ESP_NOW_ETH_ALEN);
  slot.len = (uint16_t)dataLen;
  memcpy(slot.data, data, (size_t)dataLen);
  flashLinkRxTail = (uint8_t)((flashLinkRxTail + 1U) % kFlashLinkRxQueueDepth);
  flashLinkRxCount++;
  portEXIT_CRITICAL(&flashLinkRxMux);
}

void flashLinkPromiscuousRx(void* buf, wifi_promiscuous_pkt_type_t type) {
  if (!flashLinkMode ||
      (type != WIFI_PKT_MGMT && type != WIFI_PKT_DATA)) {
    return;
  }
  const wifi_promiscuous_pkt_t* pkt =
    reinterpret_cast<const wifi_promiscuous_pkt_t*>(buf);
  if (!pkt || pkt->rx_ctrl.sig_len < 16) return;
  const uint8_t* frame = pkt->payload;
  const uint8_t* sourceMac = frame + 10;  // 802.11 address 2.
  if (flashLinkGroundRole()) {
    FlashLinkGroundPeer* stage1 = flashLinkGroundPeerForNode(kFlashLinkNodeIdStage1);
    const uint32_t nowMs = millis();
    FlashLinkGroundPeer* stage2 = flashLinkGroundPeerForNode(kFlashLinkNodeIdStage2);
    if (stage1 && stage1->directReady &&
        memcmp(sourceMac, stage1->directMac, ESP_NOW_ETH_ALEN) == 0) {
      stage1->directRssiDbm = pkt->rx_ctrl.rssi;
      stage1->lastDirectRssiMs = nowMs;
      if (stage2 && stage2->relayReady) {
        stage2->relayRssiDbm = pkt->rx_ctrl.rssi;
        stage2->lastRelayRssiMs = nowMs;
      }
      return;
    }
    if (stage2 && stage2->directReady &&
        memcmp(sourceMac, stage2->directMac, ESP_NOW_ETH_ALEN) == 0) {
      stage2->directRssiDbm = pkt->rx_ctrl.rssi;
      stage2->lastDirectRssiMs = nowMs;
      return;
    }
    return;
  }
  if (flashLinkStage1RelayRole() && flashLinkRelay.stage2PeerReady &&
      memcmp(sourceMac, flashLinkRelay.stage2Mac, ESP_NOW_ETH_ALEN) == 0) {
    return;
  }
  if (flashLinkStage2LeafRole() && flashLinkDirectGround.peerReady &&
      memcmp(sourceMac, flashLinkDirectGround.mac, ESP_NOW_ETH_ALEN) == 0) {
    flashLinkDirectGround.rssiDbm = pkt->rx_ctrl.rssi;
    flashLinkDirectGround.lastRssiMs = millis();
    return;
  }
  if (!flashLink.peerReady) return;
  if (memcmp(sourceMac, flashLink.peerMac, ESP_NOW_ETH_ALEN) != 0) return;
  flashLink.rssiDbm = pkt->rx_ctrl.rssi;
  flashLink.lastRssiMs = millis();
}

bool flashLinkPopRx(FlashLinkRxSlot& out) {
  if (flashLinkRxCount == 0U) return false;
  bool available = false;
  portENTER_CRITICAL(&flashLinkRxMux);
  if (flashLinkRxCount > 0) {
    const FlashLinkRxSlot& queued = flashLinkRxQueue[flashLinkRxHead];
    out.len = queued.len;
    memcpy(out.mac, queued.mac, ESP_NOW_ETH_ALEN);
    memcpy(out.data, queued.data, queued.len);
    flashLinkRxHead = (uint8_t)((flashLinkRxHead + 1U) % kFlashLinkRxQueueDepth);
    flashLinkRxCount--;
    available = true;
  }
  portEXIT_CRITICAL(&flashLinkRxMux);
  return available;
}

void flashLinkResetPeer() {
  if (flashLinkGroundRole()) {
    for (uint8_t i = 0; i < kFlashLinkVehicleNodeCount; ++i) {
      FlashLinkGroundPeer& peer = flashLinkGroundPeers[i];
      if (peer.directReady && esp_now_is_peer_exist(peer.directMac)) {
        esp_now_del_peer(peer.directMac);
      }
      peer = {};
    }
  }
  if (flashLink.peerReady && esp_now_is_peer_exist(flashLink.peerMac)) {
    esp_now_del_peer(flashLink.peerMac);
  }
  memset(flashLink.peerMac, 0, sizeof(flashLink.peerMac));
  flashLink.peerReady = false;
  flashLink.linked = false;
  flashLink.linkAnnounced = false;
  flashLink.remoteValid = false;
  flashLink.txBusy = false;
  flashLink.peerSession = 0;
  flashLink.rxTelemetrySeq = 0;
  flashLink.lastPeerRxMs = 0;
  flashLink.lastTelemetryRxMs = 0;
  flashLink.lastTelemetryTxUs = 0;
  flashLink.lastStorageStatusTxMs = 0;
  flashLink.lastMacAckMs = 0;
  flashLink.lastHelloMs = 0;
  flashLink.lastDiscoveryMs = 0;
  flashLink.lastHeartbeatMs = 0;
  flashLink.rxRateWindowFrames = 0;
  flashLink.rxRateWindowDrops = 0;
  flashLink.rxHz = 0;
  flashLink.rxLossPermille = 0;
  flashLink.rssiDbm = -127;
  flashLink.lastRssiMs = 0;
  flashLink.ackPending = false;
  flashLink.commandAckPending = false;
  memset(flashLink.commandAckDestination, 0, sizeof(flashLink.commandAckDestination));
  flashLink.commandAckCacheCount = 0;
  flashLink.commandAckCacheNext = 0;
  flashLink.lastCommandTransaction = 0;
  flashLink.lastCommandAck = {};
  flashLinkRemoteState = {};
  flashLink.lastMissionAlarmTxSeq = 0;
  flashLink.lastMissionAlarmTxMs = 0;
  portENTER_CRITICAL(&flashLinkRxMux);
  flashLinkRxHead = 0;
  flashLinkRxTail = 0;
  flashLinkRxCount = 0;
  portEXIT_CRITICAL(&flashLinkRxMux);
  flashLinkStorageReadCancel(0);
  flashLinkStorageListCancel(0);
  if (flashLinkStage1RelayRole()) {
    flashLinkRelayTxHead = 0;
    flashLinkRelayTxTail = 0;
    flashLinkRelayTxCount = 0;
  }
  if (flashLinkGroundRole()) {
    uint8_t cleared = 0;
    portENTER_CRITICAL(&flashLinkCommandMux);
    cleared = flashLinkCommandCount;
    flashLinkCommandHead = 0;
    flashLinkCommandTail = 0;
    flashLinkCommandCount = 0;
    portEXIT_CRITICAL(&flashLinkCommandMux);
    flashLink.commandFailed += cleared;
  }
}

void flashLinkResetGroundPeer(FlashLinkGroundPeer& peer) {
  const uint8_t nodeId = peer.nodeId;
  if (peer.directReady && esp_now_is_peer_exist(peer.directMac)) {
    esp_now_del_peer(peer.directMac);
  }
  uint8_t removedCommands = 0;
  portENTER_CRITICAL(&flashLinkCommandMux);
  FlashLinkCommandQueueEntry kept[kFlashLinkCommandQueueDepth]{};
  uint8_t keptCount = 0;
  for (uint8_t i = 0; i < flashLinkCommandCount; ++i) {
    const uint8_t index = (uint8_t)((flashLinkCommandHead + i) % kFlashLinkCommandQueueDepth);
    if (flashLinkCommandQueue[index].targetNodeId == nodeId) {
      removedCommands++;
    } else {
      kept[keptCount++] = flashLinkCommandQueue[index];
    }
  }
  for (uint8_t i = 0; i < keptCount; ++i) flashLinkCommandQueue[i] = kept[i];
  flashLinkCommandHead = 0;
  flashLinkCommandCount = keptCount;
  flashLinkCommandTail = (uint8_t)(keptCount % kFlashLinkCommandQueueDepth);
  portEXIT_CRITICAL(&flashLinkCommandMux);
  flashLink.commandFailed += removedCommands;
  portENTER_CRITICAL(&flashLinkStorageReadMux);
  for (uint8_t i = 0; i < kFlashLinkStorageWindowDepth; ++i) {
    if (flashLinkStorageReadClients[i].targetNodeId == nodeId) {
      flashLinkStorageReadClients[i].pending = false;
      flashLinkStorageReadClients[i].ready = false;
    }
  }
  if (flashLinkStorageListClient.targetNodeId == nodeId) {
    flashLinkStorageListClient.pending = false;
    flashLinkStorageListClient.ready = false;
  }
  portEXIT_CRITICAL(&flashLinkStorageReadMux);
  peer = {};
  peer.nodeId = nodeId;
  flashLinkGroundRefreshSelectedPeer();
}

bool flashLinkEnsureRelayedGroundPeer(const uint8_t* relayMac, uint8_t nodeId) {
  if (!flashLinkGroundRole() || !relayMac || nodeId != kFlashLinkNodeIdStage2) return false;
  FlashLinkGroundPeer* stage1 = flashLinkGroundPeerForNode(kFlashLinkNodeIdStage1);
  FlashLinkGroundPeer* stage2 = flashLinkGroundPeerForNode(kFlashLinkNodeIdStage2);
  if (!stage1 || !stage2 || !stage1->directReady ||
      memcmp(stage1->directMac, relayMac, ESP_NOW_ETH_ALEN) != 0) {
    return false;
  }
  if (stage2->relayReady &&
      memcmp(stage2->relayMac, relayMac, ESP_NOW_ETH_ALEN) == 0) {
    return true;
  }
  stage2->occupied = true;
  stage2->relayReady = true;
  stage2->nodeId = kFlashLinkNodeIdStage2;
  if (stage2->rxRateWindowMs == 0U) stage2->rxRateWindowMs = millis();
  stage2->relayRssiDbm = stage1->directRssiDbm;
  stage2->lastRelayRssiMs = stage1->lastDirectRssiMs;
  memcpy(stage2->relayMac, relayMac, ESP_NOW_ETH_ALEN);
  flashLinkGroundChooseRoute(*stage2);
  Serial.println("[FLASH_LINK] stage 2 virtual peer discovered through stage 1 relay");
  return true;
}

bool flashLinkEnsureStage2DirectGroundPeer(const uint8_t* mac) {
  if (!flashLinkStage2LeafRole() || !mac ||
      memcmp(mac, kFlashLinkBroadcastMac, ESP_NOW_ETH_ALEN) == 0) {
    return false;
  }
  if (flashLinkDirectGround.peerReady &&
      memcmp(mac, flashLinkDirectGround.mac, ESP_NOW_ETH_ALEN) == 0) {
    return true;
  }
  if (flashLinkDirectGround.peerReady &&
      esp_now_is_peer_exist(flashLinkDirectGround.mac)) {
    esp_now_del_peer(flashLinkDirectGround.mac);
  }
  esp_now_peer_info_t peer{};
  memcpy(peer.peer_addr, mac, ESP_NOW_ETH_ALEN);
  memcpy(peer.lmk, kFlashLinkLmk, ESP_NOW_KEY_LEN);
  peer.channel = kFlashLinkChannel;
  peer.ifidx = flashLinkWifiInterface();
  peer.encrypt = true;
  const esp_err_t err = esp_now_add_peer(&peer);
  if (err != ESP_OK && err != ESP_ERR_ESPNOW_EXIST) {
    Serial.printf("[FLASH_LINK] direct ground peer add failed err=%d\n", (int)err);
    return false;
  }
  flashLinkDirectGround = {};
  flashLinkDirectGround.peerReady = true;
  memcpy(flashLinkDirectGround.mac, mac, ESP_NOW_ETH_ALEN);
  char peerText[20];
  flashLinkFormatMac(mac, peerText, sizeof(peerText));
  Serial.printf("[FLASH_LINK] stage 2 direct ground peer discovered mac=%s\n", peerText);
  return true;
}

bool flashLinkEnsureStage2RelayPeer(const uint8_t* mac) {
  if (!flashLinkStage1RelayRole() || !mac ||
      memcmp(mac, kFlashLinkBroadcastMac, ESP_NOW_ETH_ALEN) == 0) {
    return false;
  }
  if (flashLinkRelay.stage2PeerReady &&
      memcmp(mac, flashLinkRelay.stage2Mac, ESP_NOW_ETH_ALEN) == 0) {
    return true;
  }
  if (flashLinkRelay.stage2PeerReady &&
      esp_now_is_peer_exist(flashLinkRelay.stage2Mac)) {
    esp_now_del_peer(flashLinkRelay.stage2Mac);
  }
  esp_now_peer_info_t peer{};
  memcpy(peer.peer_addr, mac, ESP_NOW_ETH_ALEN);
  memcpy(peer.lmk, kFlashLinkLmk, ESP_NOW_KEY_LEN);
  peer.channel = kFlashLinkChannel;
  peer.ifidx = flashLinkWifiInterface();
  peer.encrypt = true;
  const esp_err_t err = esp_now_add_peer(&peer);
  if (err != ESP_OK && err != ESP_ERR_ESPNOW_EXIST) {
    Serial.printf("[FLASH_LINK] stage 2 relay peer add failed err=%d\n", (int)err);
    return false;
  }
  flashLinkRelay = {};
  flashLinkRelayTxHead = 0;
  flashLinkRelayTxTail = 0;
  flashLinkRelayTxCount = 0;
  flashLinkRelay.stage2PeerReady = true;
  memcpy(flashLinkRelay.stage2Mac, mac, ESP_NOW_ETH_ALEN);
  char peerText[20];
  flashLinkFormatMac(mac, peerText, sizeof(peerText));
  Serial.printf("[FLASH_LINK] stage 2 relay peer discovered mac=%s\n", peerText);
  return true;
}

bool flashLinkEnsurePeer(const uint8_t* mac, uint8_t nodeId = kFlashLinkNodeIdStage1) {
  if (!mac || memcmp(mac, kFlashLinkBroadcastMac, ESP_NOW_ETH_ALEN) == 0) return false;
  if (flashLinkGroundRole()) {
    nodeId = clampFlashLinkVehicleNodeId(nodeId);
    FlashLinkGroundPeer* peerSlot = flashLinkGroundPeerForNode(nodeId);
    if (!peerSlot) return false;
    if (peerSlot->directReady &&
        memcmp(mac, peerSlot->directMac, ESP_NOW_ETH_ALEN) == 0) {
      return true;
    }
    FlashLinkGroundPeer* previousSlot = flashLinkGroundPeerForMac(mac);
    if (previousSlot && previousSlot != peerSlot) flashLinkResetGroundPeer(*previousSlot);
    if (peerSlot->directReady && esp_now_is_peer_exist(peerSlot->directMac)) {
      esp_now_del_peer(peerSlot->directMac);
      peerSlot->directReady = false;
      peerSlot->directLinked = false;
    }
    esp_now_peer_info_t peer{};
    memcpy(peer.peer_addr, mac, ESP_NOW_ETH_ALEN);
    memcpy(peer.lmk, kFlashLinkLmk, ESP_NOW_KEY_LEN);
    peer.channel = kFlashLinkChannel;
    peer.ifidx = flashLinkWifiInterface();
    peer.encrypt = true;
    const esp_err_t err = esp_now_add_peer(&peer);
    if (err != ESP_OK && err != ESP_ERR_ESPNOW_EXIST) {
      Serial.printf("[FLASH_LINK] stage %u peer add failed err=%d\n", (unsigned)nodeId, (int)err);
      return false;
    }
    peerSlot->occupied = true;
    peerSlot->directReady = true;
    peerSlot->nodeId = nodeId;
    if (peerSlot->rxRateWindowMs == 0U) peerSlot->rxRateWindowMs = millis();
    memcpy(peerSlot->directMac, mac, ESP_NOW_ETH_ALEN);
    flashLinkGroundChooseRoute(*peerSlot);
    char peerText[20];
    flashLinkFormatMac(mac, peerText, sizeof(peerText));
    Serial.printf("[FLASH_LINK] stage %u discovered mac=%s\n", (unsigned)nodeId, peerText);
    flashLinkGroundRefreshSelectedPeer();
    return true;
  }
  if (flashLink.peerReady && memcmp(mac, flashLink.peerMac, ESP_NOW_ETH_ALEN) == 0) return true;

  flashLinkResetPeer();
  esp_now_peer_info_t peer{};
  memcpy(peer.peer_addr, mac, ESP_NOW_ETH_ALEN);
  memcpy(peer.lmk, kFlashLinkLmk, ESP_NOW_KEY_LEN);
  peer.channel = kFlashLinkChannel;
  peer.ifidx = flashLinkWifiInterface();
  peer.encrypt = true;
  const esp_err_t err = esp_now_add_peer(&peer);
  if (err != ESP_OK && err != ESP_ERR_ESPNOW_EXIST) {
    Serial.printf("[FLASH_LINK] peer add failed err=%d\n", (int)err);
    return false;
  }
  memcpy(flashLink.peerMac, mac, ESP_NOW_ETH_ALEN);
  flashLink.peerReady = true;
  flashLink.linked = false;
  flashLink.lastHelloMs = 0;
  flashLink.lastDiscoveryMs = 0;
  char peerText[20];
  flashLinkFormatMac(mac, peerText, sizeof(peerText));
  Serial.printf("[FLASH_LINK] peer discovered mac=%s\n", peerText);
  return true;
}

bool flashLinkSendPreparedFrame(
  const uint8_t* destination,
  const uint8_t* frame,
  uint16_t frameBytes
) {
  if (!flashLink.initialized || flashLink.txBusy || !destination || !frame ||
      frameBytes < sizeof(FlashLinkHeaderV1) || frameBytes > kFlashLinkMaxPacketBytes) {
    return false;
  }
  flashLink.txBusy = true;
  flashLink.lastTxStartMs = millis();
  flashLink.txFrames++;
  const esp_err_t err = esp_now_send(destination, frame, frameBytes);
  if (err != ESP_OK) {
    flashLink.txBusy = false;
    flashLink.txFail++;
    return false;
  }
  return true;
}

bool flashLinkSendRoutedPacket(
  FlashLinkPacketType type,
  const uint8_t* destination,
  const void* payload,
  uint16_t payloadBytes,
  uint32_t ack,
  uint8_t sourceNodeId,
  uint8_t targetNodeId,
  uint8_t roleCode,
  uint32_t session,
  bool relayed
) {
  if (!flashLink.initialized || flashLink.txBusy || !destination) return false;
  const size_t totalBytes = sizeof(FlashLinkHeaderV1) + payloadBytes;
  if (totalBytes > kFlashLinkMaxPacketBytes) return false;

  uint8_t frame[kFlashLinkMaxPacketBytes];
  FlashLinkHeaderV1* header = reinterpret_cast<FlashLinkHeaderV1*>(frame);
  header->magic = kFlashLinkMagic;
  header->version = kFlashLinkVersion;
  header->type = static_cast<uint8_t>(type);
  header->role = roleCode;
  header->flags = (sourceNodeId & kFlashLinkNodeIdMask) |
    ((targetNodeId << kFlashLinkTargetNodeShift) & kFlashLinkTargetNodeMask) |
    (relayed ? kFlashLinkRelayedFlag : 0U);
  header->session = session;
  header->seq = ++flashLink.txSeq;
  header->ack = ack;
  header->payloadBytes = payloadBytes;
  header->crc16 = 0;
  if (payloadBytes > 0 && payload) memcpy(frame + sizeof(*header), payload, payloadBytes);
  header->crc16 = crc16Ccitt(frame, totalBytes);

  return flashLinkSendPreparedFrame(destination, frame, (uint16_t)totalBytes);
}

bool flashLinkSendPacket(
  FlashLinkPacketType type,
  const uint8_t* destination,
  const void* payload,
  uint16_t payloadBytes,
  uint32_t ack,
  uint8_t targetNodeId
) {
  return flashLinkSendRoutedPacket(
    type,
    destination,
    payload,
    payloadBytes,
    ack,
    flashLinkLocalNodeId(),
    targetNodeId,
    flashLinkRoleCode(),
    flashLink.session,
    false);
}

bool flashLinkQueueRelayedFrame(
  const uint8_t* destination,
  const FlashLinkRxSlot& incoming,
  bool downlink
) {
  if (!flashLinkStage1RelayRole() || !destination ||
      incoming.len < sizeof(FlashLinkHeaderV1) ||
      incoming.len > kFlashLinkMaxPacketBytes) {
    return false;
  }
  FlashLinkHeaderV1 incomingHeader{};
  memcpy(&incomingHeader, incoming.data, sizeof(incomingHeader));
  if (!downlink &&
      incomingHeader.type == static_cast<uint8_t>(FlashLinkPacketType::Telemetry)) {
    for (uint8_t offset = 0; offset < flashLinkRelayTxCount; ++offset) {
      const uint8_t index = (uint8_t)(
        (flashLinkRelayTxHead + flashLinkRelayTxCount - 1U - offset) %
        kFlashLinkRelayTxQueueDepth);
      FlashLinkRelayTxSlot& pending = flashLinkRelayTxQueue[index];
      if (pending.len < sizeof(FlashLinkHeaderV1) ||
          memcmp(pending.destination, destination, ESP_NOW_ETH_ALEN) != 0) {
        continue;
      }
      FlashLinkHeaderV1 pendingHeader{};
      memcpy(&pendingHeader, pending.data, sizeof(pendingHeader));
      if (pendingHeader.type != incomingHeader.type ||
          flashLinkPacketSourceNode(pendingHeader) !=
            flashLinkPacketSourceNode(incomingHeader)) {
        continue;
      }
      pending.len = incoming.len;
      memcpy(pending.data, incoming.data, incoming.len);
      FlashLinkHeaderV1* header =
        reinterpret_cast<FlashLinkHeaderV1*>(pending.data);
      header->flags |= kFlashLinkRelayedFlag;
      header->crc16 = 0;
      header->crc16 = crc16Ccitt(pending.data, pending.len);
      flashLinkRelay.forwardedUp++;
      flashLinkRelay.telemetryCoalesced++;
      return true;
    }
  }
  if (flashLinkRelayTxCount >= kFlashLinkRelayTxQueueDepth) {
    flashLinkRelay.queueDrops++;
    return false;
  }
  FlashLinkRelayTxSlot& queued = flashLinkRelayTxQueue[flashLinkRelayTxTail];
  memcpy(queued.destination, destination, ESP_NOW_ETH_ALEN);
  queued.len = incoming.len;
  memcpy(queued.data, incoming.data, incoming.len);
  FlashLinkHeaderV1* header = reinterpret_cast<FlashLinkHeaderV1*>(queued.data);
  header->flags |= kFlashLinkRelayedFlag;
  if (downlink) header->session = flashLink.session;
  header->crc16 = 0;
  header->crc16 = crc16Ccitt(queued.data, queued.len);
  flashLinkRelayTxTail =
    (uint8_t)((flashLinkRelayTxTail + 1U) % kFlashLinkRelayTxQueueDepth);
  flashLinkRelayTxCount++;
  if (downlink) flashLinkRelay.forwardedDown++;
  else flashLinkRelay.forwardedUp++;
  return true;
}

bool flashLinkDrainRelayTxQueue() {
  if (!flashLinkStage1RelayRole() || flashLink.txBusy || flashLinkRelayTxCount == 0U) {
    return false;
  }
  FlashLinkRelayTxSlot& queued = flashLinkRelayTxQueue[flashLinkRelayTxHead];
  if (!flashLinkSendPreparedFrame(queued.destination, queued.data, queued.len)) return false;
  flashLinkRelayTxHead =
    (uint8_t)((flashLinkRelayTxHead + 1U) % kFlashLinkRelayTxQueueDepth);
  flashLinkRelayTxCount--;
  return true;
}

bool flashLinkSendDiscovery(FlashLinkPacketType type) {
  FlashLinkDiscoveryV1 discovery{};
  discovery.deviceId = ESP.getEfuseMac();
  discovery.telemetryHz = kFlashLinkTelemetryHz;
  discovery.channel = kFlashLinkChannel;
  // bit 4: stage-1 relay, bit 5: stage-2 direct-ground standby.
  discovery.capabilities = 0x0FU |
    (flashLinkStage1RelayRole() ? 0x10U : 0U) |
    (flashLinkStage2LeafRole() ? 0x20U : 0U);
  return flashLinkSendPacket(type, kFlashLinkBroadcastMac, &discovery, sizeof(discovery));
}

void flashLinkFillTelemetry(FlashLinkTelemetryV1& out) {
  const uint32_t nowMs = millis();
  out.telemetrySeq = ++flashLink.txTelemetrySeq;
  out.uptimeMs = snap.ut;
  out.pressureMpa = snap.baroValid ? snap.p : 0.0f;
  out.altitudeM = snap.baroValid ? snap.altM : 0.0f;
  out.axMilliG = quantizeInt16(snap.ax, -32.767f, 32.767f, 1000.0f);
  out.ayMilliG = quantizeInt16(snap.ay, -32.767f, 32.767f, 1000.0f);
  out.azMilliG = quantizeInt16(snap.az, -32.767f, 32.767f, 1000.0f);
  out.gxDeciDps = quantizeInt16(snap.gx, -3276.7f, 3276.7f, 10.0f);
  out.gyDeciDps = quantizeInt16(snap.gy, -3276.7f, 3276.7f, 10.0f);
  out.gzDeciDps = quantizeInt16(snap.gz, -3276.7f, 3276.7f, 10.0f);
  out.rollCentiDeg = quantizeInt16(snap.roll, -180.0f, 180.0f, 100.0f);
  out.pitchCentiDeg = quantizeInt16(snap.pitch, -180.0f, 180.0f, 100.0f);
  out.yawCentiDeg = quantizeInt16(snap.yaw, -180.0f, 180.0f, 100.0f);
  out.gpsLatE7 = snap.gpsFix
    ? quantizeInt32(snap.gpsLat, -90.0f, 90.0f, 10000000.0f, INT32_MIN)
    : INT32_MIN;
  out.gpsLonE7 = snap.gpsFix
    ? quantizeInt32(snap.gpsLon, -180.0f, 180.0f, 10000000.0f, INT32_MIN)
    : INT32_MIN;
  out.gpsAltCm = snap.gpsFix
    ? quantizeInt32(snap.gpsAlt, -21474836.0f, 21474836.0f, 100.0f, INT32_MIN)
    : INT32_MIN;
  out.gpsAgeMs = (uint16_t)min<uint32_t>(65535U, snap.gpsAgeMs);
  out.gpsUtcMs = snap.gpsTimeValid ? snap.gpsUtcMs : UINT32_MAX;
  out.chipTempDeciC = quantizeInt16(
    snap.chipTempC,
    -3276.7f,
    3276.7f,
    10.0f,
    INT16_MIN);
  out.loopUs = (uint16_t)min<uint32_t>(65535U, (uint32_t)fmaxf(1.0f, snap.lt * 1000.0f));
  out.cpuUs = snap.ct;
  out.tdMs = sequenceTdMs(nowMs);
  out.flags = 0;
  if (snap.sampleValid) out.flags |= 1U << 0;
  if (snap.baroValid) out.flags |= 1U << 1;
  if (snap.attitudeValid) out.flags |= 1U << 2;
  if (snap.gpsFix) out.flags |= 1U << 3;
  if (snap.gpsSeen) out.flags |= 1U << 4;
  if (armSwitchEffectiveOn()) out.flags |= 1U << 5;
  out.flags |= 1U << 6;
  if (sequenceUserWaiting) out.flags |= 1U << 7;
  if (sequenceAbortActive(nowMs)) out.flags |= 1U << 8;
  if (safetyMode) out.flags |= 1U << 9;
  if (armLock) out.flags |= 1U << 10;
  if (inspectionPassed) out.flags |= 1U << 11;
  if (storageState.ready) out.flags |= 1U << 12;
  if (armSwitchPhysicalOn()) out.flags |= 1U << 13;
  if (isfinite(snap.chipTempC)) out.flags |= 1U << 15;
  out.ignitionMs = (uint16_t)min<uint32_t>(65535U, ignitionDurationMs);
  out.countdownMs = (uint16_t)min<uint32_t>(65535U, reportedCountdownDurationMs());
  out.relayMask = sequenceRelayMaskNow(nowMs);
  out.state = sequenceState;
  out.abortReason = sequenceAbortReason;
  out.mode = flashLinkDataModeCode();
  out.pyroChannel = daqSequencePyroChannel;
  out.thrustMilliKgf = snap.loadcellValid
    ? quantizeInt32(snap.thrustKgf, -2147483.0f, 2147483.0f, 1000.0f, INT32_MIN)
    : INT32_MIN;
  out.loadcellRaw = snap.loadcellRaw;
  out.loadcellHz = snap.loadcellHz;
  out.loadcellFlags = (uint8_t)(loadcellFlagsForTelemetry(snap) & 0xFFU);
  out.flightPhase = snap.flightPhase;
  out.missionAlarmSeq = missionAlarmLocal.seq;
  out.missionAlarmTimestampMs = missionAlarmLocal.timestampMs;
  out.missionAlarmBlock = missionAlarmLocal.blockIndex;
  out.verticalSpeedDeciMps = quantizeInt16(
    snap.flightVerticalSpeedMps,
    -3276.8f,
    3276.7f,
    10.0f,
    0);
  out.attitudeQw = quantizeInt16(snap.attitudeQw, -1.0f, 1.0f, 32767.0f);
  out.attitudeQx = quantizeInt16(snap.attitudeQx, -1.0f, 1.0f, 32767.0f);
  out.attitudeQy = quantizeInt16(snap.attitudeQy, -1.0f, 1.0f, 32767.0f);
  out.attitudeQz = quantizeInt16(snap.attitudeQz, -1.0f, 1.0f, 32767.0f);
  out.ignitionDelayMs = (snap.deploymentFlags & 1U) != 0U
    ? (uint16_t)min<uint32_t>(65534U, snap.ignitionDelayMs)
    : UINT16_MAX;
  out.deploymentState = snap.deploymentState;
  out.deploymentFlags = snap.deploymentFlags;
}

void flashLinkFillMissionAlarm(FlashLinkMissionAlarmV1& out) {
  out.seq = missionAlarmLocal.seq;
  out.timestampMs = missionAlarmLocal.timestampMs;
  out.blockIndex = missionAlarmLocal.blockIndex;
  out.reserved = 0;
  missionCopyText(out.title, sizeof(out.title), missionAlarmLocal.title);
  missionCopyText(out.message, sizeof(out.message), missionAlarmLocal.message);
}

void flashLinkDecodeTelemetry(
  const FlashLinkTelemetryV1& in,
  Telemetry& output,
  FlashLinkRemoteState& state,
  uint32_t& alarmSeq,
  uint32_t& alarmTimestampMs,
  uint16_t& alarmBlockIndex,
  char* alarmTitle,
  char* alarmMessage
) {
  output.p = in.pressureMpa;
  output.altM = in.altitudeM;
  output.ax = in.axMilliG / 1000.0f;
  output.ay = in.ayMilliG / 1000.0f;
  output.az = in.azMilliG / 1000.0f;
  output.gx = in.gxDeciDps / 10.0f;
  output.gy = in.gyDeciDps / 10.0f;
  output.gz = in.gzDeciDps / 10.0f;
  output.roll = in.rollCentiDeg / 100.0f;
  output.pitch = in.pitchCentiDeg / 100.0f;
  output.yaw = in.yawCentiDeg / 100.0f;
  output.gpsLat = in.gpsLatE7 != INT32_MIN ? in.gpsLatE7 / 10000000.0f : NAN;
  output.gpsLon = in.gpsLonE7 != INT32_MIN ? in.gpsLonE7 / 10000000.0f : NAN;
  output.gpsAlt = in.gpsAltCm != INT32_MIN ? in.gpsAltCm / 100.0f : NAN;
  output.gpsAgeMs = in.gpsAgeMs;
  output.gpsTimeValid = in.gpsUtcMs < kDayMs;
  output.gpsUtcMs = output.gpsTimeValid ? in.gpsUtcMs : UINT32_MAX;
  output.chipTempC = in.chipTempDeciC != INT16_MIN ? in.chipTempDeciC / 10.0f : NAN;
  output.lt = in.loopUs / 1000.0f;
  output.ct = in.cpuUs;
  output.ut = in.uptimeMs;
  output.sampleValid = (in.flags & (1U << 0)) != 0;
  output.baroValid = (in.flags & (1U << 1)) != 0;
  output.attitudeValid = (in.flags & (1U << 2)) != 0;
  output.gpsFix = (in.flags & (1U << 3)) != 0;
  output.gpsSeen = (in.flags & (1U << 4)) != 0;
  output.gpsReady = output.gpsSeen || output.gpsFix;
  output.thrustKgf =
    in.thrustMilliKgf != INT32_MIN ? in.thrustMilliKgf / 1000.0f : 0.0f;
  output.loadcellRaw = in.loadcellRaw;
  output.loadcellHz = in.loadcellHz;
  output.loadcellReady = (in.loadcellFlags & (1U << 0)) != 0;
  output.loadcellValid = (in.loadcellFlags & (1U << 1)) != 0;
  output.loadcellSaturated = (in.loadcellFlags & (1U << 2)) != 0;
  output.loadcellOffsetValid = (in.loadcellFlags & (1U << 3)) != 0;
  output.loadcellNoiseKg = kLoadcellNoiseDeadbandKg;
  output.loadcellScale = kLoadcellDefaultScale;
  output.flightPhase = in.flightPhase <= static_cast<uint8_t>(FlightPhase::Landed)
    ? in.flightPhase
    : static_cast<uint8_t>(FlightPhase::PreFlight);
  output.flightVerticalSpeedMps = in.verticalSpeedDeciMps / 10.0f;
  output.flightApogeeM = 0.0f;
  output.flightPhaseElapsedMs = 0;
  output.attitudeQw = in.attitudeQw / 32767.0f;
  output.attitudeQx = in.attitudeQx / 32767.0f;
  output.attitudeQy = in.attitudeQy / 32767.0f;
  output.attitudeQz = in.attitudeQz / 32767.0f;
  output.ignitionDelayMs =
    ((in.deploymentFlags & 1U) != 0U && in.ignitionDelayMs != UINT16_MAX)
      ? in.ignitionDelayMs
      : UINT32_MAX;
  output.deploymentState = in.deploymentState;
  output.deploymentFlags = in.deploymentFlags;
  state.flags = in.flags;
  state.relayMask = in.relayMask;
  state.state = in.state;
  state.abortReason = in.abortReason;
  state.tdMs = in.tdMs;
  state.ignitionMs = in.ignitionMs;
  state.countdownMs = in.countdownMs;
  state.mode = in.mode == 1U ? 1U : 0U;
  state.pyroChannel = clampPyroChannel(in.pyroChannel);
  if (alarmSeq != in.missionAlarmSeq) {
    alarmSeq = in.missionAlarmSeq;
    alarmTimestampMs = in.missionAlarmTimestampMs;
    alarmBlockIndex = in.missionAlarmBlock;
    if (in.missionAlarmSeq == 0U) {
      if (alarmTitle) alarmTitle[0] = '\0';
      if (alarmMessage) alarmMessage[0] = '\0';
    }
  }
}

void flashLinkApplyTelemetry(const FlashLinkTelemetryV1& in) {
  flashLinkDecodeTelemetry(
    in,
    flashLinkRemoteSnap,
    flashLinkRemoteState,
    missionAlarmRemote.seq,
    missionAlarmRemote.timestampMs,
    missionAlarmRemote.blockIndex,
    missionAlarmRemote.title,
    missionAlarmRemote.message);
  flashLink.remoteValid = true;
}

void flashLinkApplyMissionAlarm(const FlashLinkMissionAlarmV1& in) {
  if (in.seq == 0U) return;
  missionAlarmRemote.seq = in.seq;
  missionAlarmRemote.timestampMs = in.timestampMs;
  missionAlarmRemote.blockIndex = in.blockIndex;
  missionCopyText(
    missionAlarmRemote.title,
    sizeof(missionAlarmRemote.title),
    in.title);
  missionCopyText(
    missionAlarmRemote.message,
    sizeof(missionAlarmRemote.message),
    in.message);
}

void flashLinkApplyTelemetryForGroundPeer(
  FlashLinkGroundPeer& peer,
  const FlashLinkTelemetryV1& in
) {
  flashLinkDecodeTelemetry(
    in,
    peer.snap,
    peer.state,
    peer.alarmSeq,
    peer.alarmTimestampMs,
    peer.alarmBlockIndex,
    peer.alarmTitle,
    peer.alarmMessage);
  peer.remoteValid = true;
}

void flashLinkApplyMissionAlarmForGroundPeer(
  FlashLinkGroundPeer& peer,
  const FlashLinkMissionAlarmV1& in
) {
  if (in.seq == 0U) return;
  peer.alarmSeq = in.seq;
  peer.alarmTimestampMs = in.timestampMs;
  peer.alarmBlockIndex = in.blockIndex;
  missionCopyText(peer.alarmTitle, sizeof(peer.alarmTitle), in.title);
  missionCopyText(peer.alarmMessage, sizeof(peer.alarmMessage), in.message);
}

void flashLinkBeginPeerSession(uint32_t session, uint32_t nowMs) {
  flashLink.peerSession = session;
  flashLink.linked = false;
  flashLink.linkAnnounced = false;
  flashLink.remoteValid = false;
  flashLink.rxTelemetrySeq = 0;
  flashLink.lastPeerRxMs = nowMs;
  flashLink.lastTelemetryRxMs = 0;
  flashLink.lastHelloMs = 0;
  flashLink.lastDiscoveryMs = 0;
  flashLink.lastHeartbeatMs = 0;
  flashLink.lastAckSeq = 0;
  flashLink.lastAckRxMs = 0;
  flashLink.ackPending = false;
  flashLink.commandAckPending = false;
  flashLink.commandAckCacheCount = 0;
  flashLink.commandAckCacheNext = 0;
  flashLink.rxRateWindowFrames = 0;
  flashLink.rxRateWindowDrops = 0;
  flashLink.rxHz = 0;
  flashLink.rxLossPermille = 0;
  flashLinkRemoteState = {};
  flashLink.lastMissionAlarmTxSeq = 0;
  flashLink.lastMissionAlarmTxMs = 0;
}

bool flashLinkHandleStage2RelayUplink(
  FlashLinkRxSlot& slot,
  const FlashLinkHeaderV1& header,
  FlashLinkPacketType type,
  uint32_t nowMs
) {
  if (!flashLinkStage1RelayRole() || header.role != static_cast<uint8_t>(FlashLinkRole::Avionics) ||
      flashLinkPacketSourceNode(header) != kFlashLinkNodeIdStage2 ||
      flashLinkPacketRelayed(header)) {
    return false;
  }
  if (type == FlashLinkPacketType::Discover) {
    if (header.payloadBytes != sizeof(FlashLinkDiscoveryV1) ||
        !flashLinkEnsureStage2RelayPeer(slot.mac)) {
      return true;
    }
    if (flashLinkRelay.stage2Session != 0U &&
        flashLinkRelay.stage2Session != header.session) {
      flashLinkRelay.stage2Linked = false;
      flashLinkRelay.stage2RxTelemetrySeq = 0;
    }
    flashLinkRelay.stage2Session = header.session;
    flashLinkRelay.stage2LastRxMs = nowMs;
  } else {
    if (!flashLinkRelay.stage2PeerReady ||
        memcmp(slot.mac, flashLinkRelay.stage2Mac, ESP_NOW_ETH_ALEN) != 0) {
      return true;
    }
    flashLinkRelay.stage2LastRxMs = nowMs;
    if (flashLinkRelay.stage2Session != 0U &&
        flashLinkRelay.stage2Session != header.session) {
      flashLinkRelay.stage2Linked = false;
      flashLinkRelay.stage2RxTelemetrySeq = 0;
    }
    flashLinkRelay.stage2Session = header.session;
    if (type == FlashLinkPacketType::Ack ||
        type == FlashLinkPacketType::Hello ||
        type == FlashLinkPacketType::Heartbeat) {
      flashLinkRelay.stage2Linked = true;
    }
    if (type == FlashLinkPacketType::Telemetry &&
        (header.payloadBytes == sizeof(FlashLinkTelemetryV1) ||
         header.payloadBytes == 105U || header.payloadBytes == 97U)) {
      FlashLinkTelemetryV1 telemetry{};
      memcpy(
        &telemetry,
        slot.data + sizeof(FlashLinkHeaderV1),
        min<size_t>(header.payloadBytes, sizeof(telemetry)));
      const uint32_t previousSeq = flashLinkRelay.stage2RxTelemetrySeq;
      const bool duplicate = previousSeq != 0U && telemetry.telemetrySeq == previousSeq;
      if (!duplicate) {
        flashLinkRelay.stage2RxTelemetrySeq = telemetry.telemetrySeq;
        flashLinkRelay.stage2RxTelemetryFrames++;
        flashLinkRelay.stage2LastTelemetryRxMs = nowMs;
        flashLinkRelay.stage2Linked = true;
      }
      if (duplicate ||
          (flashLinkRelay.stage2RxTelemetryFrames % kFlashLinkAckEveryFrames) == 0U) {
        flashLinkRelay.stage2AckPending = true;
      }
      if (duplicate) return true;
    }
  }

  // The relay forwards the original source node, payload, packet type, and
  // stage-2 session. Only the physical transmitter changes to stage 1.
  if (flashLink.peerReady) {
    flashLinkQueueRelayedFrame(flashLink.peerMac, slot, false);
  }
  return true;
}

void flashLinkHandlePacket(FlashLinkRxSlot& slot) {
  if (slot.len < sizeof(FlashLinkHeaderV1)) return;
  FlashLinkHeaderV1* header = reinterpret_cast<FlashLinkHeaderV1*>(slot.data);
  if (header->magic != kFlashLinkMagic ||
      header->version != kFlashLinkVersion ||
      header->payloadBytes != slot.len - sizeof(FlashLinkHeaderV1)) {
    return;
  }

  const uint16_t expectedCrc = header->crc16;
  header->crc16 = 0;
  const uint16_t actualCrc = crc16Ccitt(slot.data, slot.len);
  header->crc16 = expectedCrc;
  if (actualCrc != expectedCrc) {
    flashLink.rxCrcErrors++;
    return;
  }

  const FlashLinkPacketType type = static_cast<FlashLinkPacketType>(header->type);
  const uint32_t nowMs = millis();
  flashLink.rxFrames++;
  uint8_t incomingNodeId = flashLinkPacketSourceNode(*header);
  const uint8_t targetNodeId = flashLinkPacketTargetNode(*header);
  const bool relayedPacket = flashLinkPacketRelayed(*header);
  bool directGroundPacket = false;

  if (flashLinkHandleStage2RelayUplink(slot, *header, type, nowMs)) return;
  if (flashLinkGroundRole() && incomingNodeId == kFlashLinkNodeIdGround) {
    incomingNodeId = kFlashLinkNodeIdStage1;  // Protocol v2 single-node compatibility.
  }
  FlashLinkGroundPeer* groundPeer = nullptr;

  if (type == FlashLinkPacketType::Discover) {
    if (header->payloadBytes != sizeof(FlashLinkDiscoveryV1)) return;
    if (flashLinkGroundRole()) {
      const bool directStage1 = incomingNodeId == kFlashLinkNodeIdStage1 &&
        !relayedPacket && header->role == static_cast<uint8_t>(FlashLinkRole::Avionics);
      const bool directStage2 = incomingNodeId == kFlashLinkNodeIdStage2 &&
        !relayedPacket && header->role == static_cast<uint8_t>(FlashLinkRole::Avionics);
      const bool relayedStage2 = incomingNodeId == kFlashLinkNodeIdStage2 &&
        relayedPacket && header->role == static_cast<uint8_t>(FlashLinkRole::Avionics);
      if (directStage1 || directStage2) {
        if (!flashLinkEnsurePeer(slot.mac, incomingNodeId)) return;
      } else if (relayedStage2) {
        if (!flashLinkEnsureRelayedGroundPeer(slot.mac, incomingNodeId)) return;
      } else {
        return;
      }
      groundPeer = flashLinkGroundPeerForNode(incomingNodeId);
      if (!groundPeer) return;
      if (groundPeer->session != 0U && groundPeer->session != header->session) {
        Serial.printf("[FLASH_LINK] stage %u reboot session=%lu->%lu\n",
                      (unsigned)incomingNodeId,
                      (unsigned long)groundPeer->session,
                      (unsigned long)header->session);
        groundPeer->linked = false;
        groundPeer->directLinked = false;
        groundPeer->relayLinked = false;
        groundPeer->remoteValid = false;
        groundPeer->rxTelemetrySeq = 0;
      }
      groundPeer->session = header->session;
      groundPeer->lastPeerRxMs = nowMs;
      if (relayedStage2) groundPeer->lastRelayRxMs = nowMs;
      else groundPeer->lastDirectRxMs = nowMs;
      flashLinkGroundRefreshSelectedPeer();
    } else if (flashLinkStage2LeafRole()) {
      const bool stage1Discovery =
        header->role == static_cast<uint8_t>(FlashLinkRole::Avionics) &&
        incomingNodeId == kFlashLinkNodeIdStage1 && !relayedPacket;
      const bool groundDiscovery =
        header->role == static_cast<uint8_t>(FlashLinkRole::Ground) &&
        incomingNodeId == kFlashLinkNodeIdGround && !relayedPacket;
      if (stage1Discovery) {
        if (!flashLinkEnsurePeer(slot.mac)) return;
        const bool sessionChanged = flashLink.peerSession != 0U &&
          flashLink.peerSession != header->session;
        if (sessionChanged) flashLinkBeginPeerSession(header->session, nowMs);
        else {
          flashLink.peerSession = header->session;
          flashLink.lastPeerRxMs = nowMs;
        }
      } else if (groundDiscovery) {
        if (!flashLinkEnsureStage2DirectGroundPeer(slot.mac)) return;
        if (flashLinkDirectGround.session != 0U &&
            flashLinkDirectGround.session != header->session) {
          flashLinkDirectGround.linked = false;
          flashLinkDirectGround.ackPending = false;
        }
        flashLinkDirectGround.session = header->session;
        flashLinkDirectGround.lastRxMs = nowMs;
      } else {
        return;
      }
    } else if (header->role == static_cast<uint8_t>(FlashLinkRole::Ground) &&
               flashLinkEnsurePeer(slot.mac)) {
      const bool sessionChanged =
        flashLink.peerSession != 0 &&
        flashLink.peerSession != header->session;
      if (sessionChanged) {
        Serial.printf(
          "[FLASH_LINK] peer reboot detected session=%lu->%lu; reconnecting\n",
          (unsigned long)flashLink.peerSession,
          (unsigned long)header->session);
        flashLinkBeginPeerSession(header->session, nowMs);
      } else {
        flashLink.peerSession = header->session;
        flashLink.lastPeerRxMs = nowMs;
      }
    }
    return;
  }

  if (flashLinkGroundRole()) {
    if (header->role != static_cast<uint8_t>(FlashLinkRole::Avionics)) return;
    if (incomingNodeId == kFlashLinkNodeIdStage2 && relayedPacket) {
      if (!flashLinkEnsureRelayedGroundPeer(slot.mac, incomingNodeId)) return;
      groundPeer = flashLinkGroundPeerForNode(kFlashLinkNodeIdStage2);
    } else if (!relayedPacket &&
               (incomingNodeId == kFlashLinkNodeIdStage1 ||
                incomingNodeId == kFlashLinkNodeIdStage2)) {
      groundPeer = flashLinkGroundPeerForNode(incomingNodeId);
      if (!groundPeer || !groundPeer->directReady ||
          memcmp(slot.mac, groundPeer->directMac, ESP_NOW_ETH_ALEN) != 0) return;
    } else {
      return;
    }
    groundPeer->lastPeerRxMs = nowMs;
    if (relayedPacket) groundPeer->lastRelayRxMs = nowMs;
    else groundPeer->lastDirectRxMs = nowMs;
    groundPeer->rxFrames++;
    if (groundPeer->session != 0U && groundPeer->session != header->session) {
      groundPeer->linked = false;
      groundPeer->directLinked = false;
      groundPeer->relayLinked = false;
      groundPeer->remoteValid = false;
      groundPeer->rxTelemetrySeq = 0;
    }
    groundPeer->session = header->session;
  } else {
    if (flashLinkStage2LeafRole()) {
      const bool fromRelay =
        header->role == static_cast<uint8_t>(FlashLinkRole::Ground) &&
        relayedPacket && targetNodeId == kFlashLinkNodeIdStage2 &&
        flashLink.peerReady &&
        memcmp(slot.mac, flashLink.peerMac, ESP_NOW_ETH_ALEN) == 0;
      const bool fromDirect =
        header->role == static_cast<uint8_t>(FlashLinkRole::Ground) &&
        !relayedPacket && targetNodeId == kFlashLinkNodeIdStage2 &&
        flashLinkDirectGround.peerReady &&
        memcmp(slot.mac, flashLinkDirectGround.mac, ESP_NOW_ETH_ALEN) == 0;
      if (!fromRelay && !fromDirect) return;
      directGroundPacket = fromDirect;
    } else if (header->role != static_cast<uint8_t>(FlashLinkRole::Ground)) {
      return;
    }
    if (directGroundPacket) {
      flashLinkDirectGround.lastRxMs = nowMs;
      if (flashLinkDirectGround.session != 0U &&
          flashLinkDirectGround.session != header->session) {
        flashLinkDirectGround.linked = false;
        flashLinkDirectGround.ackPending = false;
      }
      flashLinkDirectGround.session = header->session;
    } else {
      if (!flashLink.peerReady ||
          memcmp(slot.mac, flashLink.peerMac, ESP_NOW_ETH_ALEN) != 0) return;
      flashLink.lastPeerRxMs = nowMs;
      if (flashLink.peerSession != 0 && flashLink.peerSession != header->session) {
        Serial.printf(
          "[FLASH_LINK] peer session changed session=%lu->%lu; reconnecting\n",
          (unsigned long)flashLink.peerSession,
          (unsigned long)header->session);
        flashLinkBeginPeerSession(header->session, nowMs);
      }
      flashLink.peerSession = header->session;
    }
    if (flashLinkStage1RelayRole() && targetNodeId == kFlashLinkNodeIdStage2) {
      if (flashLinkRelay.stage2PeerReady) {
        flashLinkQueueRelayedFrame(flashLinkRelay.stage2Mac, slot, true);
      }
      return;
    }
    if (targetNodeId != kFlashLinkNodeIdGround &&
        targetNodeId != flashLinkLocalNodeId()) return;
  }

  if (type == FlashLinkPacketType::Command &&
      flashLinkAvionicsRole() &&
      header->payloadBytes == sizeof(FlashLinkCommandV1)) {
    const FlashLinkCommandV1& command =
      *reinterpret_cast<const FlashLinkCommandV1*>(
        slot.data + sizeof(FlashLinkHeaderV1));
    FlashLinkCommandAckV1 ack{};
    bool duplicate = false;
    for (uint8_t i = 0; i < flashLink.commandAckCacheCount; ++i) {
      if (flashLink.commandAckCache[i].transaction == command.transaction) {
        ack = flashLink.commandAckCache[i];
        duplicate = true;
        break;
      }
    }
    if (!duplicate) {
      int32_t detail = 0;
      const FlashLinkCommandResult result =
        flashLinkExecuteCommand(command, detail);
      ack.transaction = command.transaction;
      ack.code = command.code;
      ack.result = static_cast<uint8_t>(result);
      ack.detail = detail;
      flashLink.lastCommandTransaction = command.transaction;
      flashLink.lastCommandAck = ack;
      flashLink.commandAckCache[flashLink.commandAckCacheNext] = ack;
      flashLink.commandAckCacheNext =
        (uint8_t)((flashLink.commandAckCacheNext + 1U) %
                  kFlashLinkCommandQueueDepth);
      if (flashLink.commandAckCacheCount < kFlashLinkCommandQueueDepth) {
        flashLink.commandAckCacheCount++;
      }
      flashLink.lastCommandCode = command.code;
      flashLink.lastCommandResult = ack.result;
      Serial.printf("[FLASH_LINK] command execute txn=%lu code=%u result=%s detail=%ld\n",
                    (unsigned long)ack.transaction,
                    (unsigned)ack.code,
                    flashLinkCommandResultName(ack.result),
                    (long)ack.detail);
    }
    flashLink.commandAck = ack;
    memcpy(
      flashLink.commandAckDestination,
      slot.mac,
      sizeof(flashLink.commandAckDestination));
    flashLink.commandAckPending = true;
    return;
  }

  if (type == FlashLinkPacketType::CommandAck &&
      flashLinkGroundRole() &&
      header->payloadBytes == sizeof(FlashLinkCommandAckV1)) {
    const FlashLinkCommandAckV1& ack =
      *reinterpret_cast<const FlashLinkCommandAckV1*>(
        slot.data + sizeof(FlashLinkHeaderV1));
    bool matched = false;
    portENTER_CRITICAL(&flashLinkCommandMux);
    if (flashLinkCommandCount > 0 &&
        flashLinkCommandQueue[flashLinkCommandHead].targetNodeId == incomingNodeId &&
        flashLinkCommandQueue[flashLinkCommandHead].command.transaction ==
          ack.transaction) {
      flashLinkCommandHead =
        (uint8_t)((flashLinkCommandHead + 1U) % kFlashLinkCommandQueueDepth);
      flashLinkCommandCount--;
      matched = true;
    }
    portEXIT_CRITICAL(&flashLinkCommandMux);
    if (matched) {
      flashLink.commandAcked++;
      flashLink.lastCommandCode = ack.code;
      flashLink.lastCommandResult = ack.result;
      const bool commandOk =
        ack.result == static_cast<uint8_t>(FlashLinkCommandResult::Ok);
      if (ack.code == static_cast<uint8_t>(FlashLinkCommandCode::GyroZero) ||
          ack.code == static_cast<uint8_t>(FlashLinkCommandCode::GyroZeroReset)) {
        if (commandOk) {
          Serial.printf("ACK GYRO_ZERO_REMOTE detail=%ld\n", (long)ack.detail);
        } else {
          Serial.printf("ERR GYRO_ZERO_REMOTE result=%s detail=%ld\n",
                        flashLinkCommandResultName(ack.result),
                        (long)ack.detail);
        }
      } else if (ack.code == static_cast<uint8_t>(FlashLinkCommandCode::BaroReference)) {
        if (commandOk) {
          Serial.printf("ACK BARO_REFERENCE_REMOTE detail=%ld\n", (long)ack.detail);
        } else {
          Serial.printf("ERR BARO_REFERENCE_REMOTE result=%s detail=%ld\n",
                        flashLinkCommandResultName(ack.result),
                        (long)ack.detail);
        }
      }
      Serial.printf("[FLASH_LINK] command ack txn=%lu code=%u result=%s detail=%ld\n",
                    (unsigned long)ack.transaction,
                    (unsigned)ack.code,
                    flashLinkCommandResultName(ack.result),
                    (long)ack.detail);
    }
    return;
  }

  if (type == FlashLinkPacketType::StorageListRequest &&
      flashLinkAvionicsRole() &&
      header->payloadBytes == sizeof(FlashLinkStorageListRequestV1)) {
    const FlashLinkStorageListRequestV1& request =
      *reinterpret_cast<const FlashLinkStorageListRequestV1*>(
        slot.data + sizeof(FlashLinkHeaderV1));
    FlashLinkStorageListResponseV1 response{};
    response.transaction = request.transaction;
    response.startOrdinal = request.startOrdinal;
    response.status = 0;
    if (storageState.busy || storageWaitServiceActive) {
      response.status = 1;
    } else {
      StorageLock lock(0);
      if (!lock) {
        response.status = 1;
      } else {
        storageRefreshStats();
        response.totalSessions = (uint16_t)min<uint32_t>(
          UINT16_MAX,
          storageState.sessionCount);
        if (request.startOrdinal >= response.totalSessions) {
          response.status = 2;
        } else {
          const uint8_t limit = min<uint8_t>(
            max<uint8_t>(1U, request.limit),
            kFlashLinkStorageListBatchItems);
          const uint16_t available = response.totalSessions - request.startOrdinal;
          response.count = min<uint8_t>(limit, (uint8_t)min<uint16_t>(UINT8_MAX, available));
          for (uint8_t i = 0; i < response.count; ++i) {
            StorageSessionInfo info{};
            if (!storageGetSessionInfo(request.startOrdinal + i, info)) {
              response.count = i;
              response.status = 3;
              break;
            }
            FlashLinkStorageListItemV1& item = response.items[i];
            item.sessionId = info.id;
            item.offsetBytes = info.offsetBytes;
            item.bytes = info.bytes;
            item.records = info.records;
            item.current = info.id == storageCurrentSessionId ? 1U : 0U;
          }
        }
      }
    }
    flashLinkSendPacket(
      FlashLinkPacketType::StorageListResponse,
      slot.mac,
      &response,
      sizeof(response));
    return;
  }

  if (type == FlashLinkPacketType::StorageListResponse &&
      flashLinkGroundRole() &&
      header->payloadBytes == sizeof(FlashLinkStorageListResponseV1)) {
    const FlashLinkStorageListResponseV1& response =
      *reinterpret_cast<const FlashLinkStorageListResponseV1*>(
        slot.data + sizeof(FlashLinkHeaderV1));
    portENTER_CRITICAL(&flashLinkStorageReadMux);
    if (flashLinkStorageListClient.pending &&
        flashLinkStorageListClient.targetNodeId == incomingNodeId &&
        flashLinkStorageListClient.transaction == response.transaction) {
      flashLinkStorageListClient.response = response;
      flashLinkStorageListClient.ready = true;
    }
    portEXIT_CRITICAL(&flashLinkStorageReadMux);
    return;
  }

  if (type == FlashLinkPacketType::StorageReadRequest &&
      flashLinkAvionicsRole() &&
      header->payloadBytes == sizeof(FlashLinkStorageReadRequestV1)) {
    const FlashLinkStorageReadRequestV1& request =
      *reinterpret_cast<const FlashLinkStorageReadRequestV1*>(
        slot.data + sizeof(FlashLinkHeaderV1));
    FlashLinkStorageReadResponseV1 response{};
    response.transaction = request.transaction;
    response.offset = request.offset;
    response.len = 0;
    response.status = 0;
    const uint16_t readLen = min<uint16_t>(
      request.len,
      kFlashLinkStorageChunkBytes);
    if (readLen == 0) {
      response.status = 2;
    } else if (storageState.busy || storageWaitServiceActive) {
      response.status = 1;
    } else if (storageRead(request.offset, response.data, readLen)) {
      response.len = readLen;
      response.status = 0;
    } else {
      response.status = 3;
    }
    flashLinkSendPacket(
      FlashLinkPacketType::StorageReadResponse,
      slot.mac,
      &response,
      sizeof(response));
    return;
  }

  if (type == FlashLinkPacketType::StorageReadResponse &&
      flashLinkGroundRole() &&
      header->payloadBytes == sizeof(FlashLinkStorageReadResponseV1)) {
    const FlashLinkStorageReadResponseV1& response =
      *reinterpret_cast<const FlashLinkStorageReadResponseV1*>(
        slot.data + sizeof(FlashLinkHeaderV1));
    portENTER_CRITICAL(&flashLinkStorageReadMux);
    for (uint8_t i = 0; i < kFlashLinkStorageWindowDepth; ++i) {
      FlashLinkStorageReadClient& client = flashLinkStorageReadClients[i];
      if (client.pending &&
          client.targetNodeId == incomingNodeId &&
          client.transaction == response.transaction &&
          client.offset == response.offset) {
        client.status = response.status;
        client.len = min<uint16_t>(
          response.len,
          kFlashLinkStorageChunkBytes);
        if (client.len > 0) {
          memcpy(
            client.data,
            response.data,
            client.len);
        }
        client.ready = true;
        client.completedMs = nowMs;
        break;
      }
    }
    portEXIT_CRITICAL(&flashLinkStorageReadMux);
    return;
  }

  if (type == FlashLinkPacketType::Hello || type == FlashLinkPacketType::Heartbeat) {
    if (groundPeer) {
      if (relayedPacket) groundPeer->relayLinked = true;
      else groundPeer->directLinked = true;
      groundPeer->linked = groundPeer->directLinked || groundPeer->relayLinked;
      memcpy(
        groundPeer->ackDestination,
        slot.mac,
        sizeof(groundPeer->ackDestination));
      groundPeer->ackPending = true;
      flashLinkGroundRefreshSelectedPeer();
    } else if (directGroundPacket) {
      flashLinkDirectGround.linked = true;
      flashLinkDirectGround.ackPending = true;
    } else {
      flashLink.linked = true;
      flashLink.ackPending = true;
    }
    return;
  }

  if (type == FlashLinkPacketType::Ack) {
    if (groundPeer) {
      if (relayedPacket) groundPeer->relayLinked = true;
      else groundPeer->directLinked = true;
      groundPeer->linked = groundPeer->directLinked || groundPeer->relayLinked;
      flashLinkGroundRefreshSelectedPeer();
    } else if (directGroundPacket) {
      flashLinkDirectGround.linked = true;
    } else {
      flashLink.linked = true;
      flashLink.lastAckSeq = header->ack;
      flashLink.lastAckRxMs = nowMs;
    }
    if (flashLinkAvionicsRole() &&
        (!flashLink.linkAnnounced || flashLink.disconnectAlarmActive)) {
      flashLink.linkAnnounced = true;
      flashLink.disconnectAlarmActive = false;
      buzzerPlayFlashLinkConnectedMelody();
      Serial.println("[FLASH_LINK] link established");
    }
    return;
  }

  if (type == FlashLinkPacketType::MissionAlarm &&
      flashLinkGroundRole() &&
      header->payloadBytes == sizeof(FlashLinkMissionAlarmV1)) {
    const FlashLinkMissionAlarmV1& alarm =
      *reinterpret_cast<const FlashLinkMissionAlarmV1*>(
        slot.data + sizeof(FlashLinkHeaderV1));
    if (groundPeer) flashLinkApplyMissionAlarmForGroundPeer(*groundPeer, alarm);
    else flashLinkApplyMissionAlarm(alarm);
    flashLinkGroundRefreshSelectedPeer();
    return;
  }

  if (type == FlashLinkPacketType::StorageStatus &&
      flashLinkGroundRole() &&
      header->payloadBytes == sizeof(FlashLinkStorageStatusV1)) {
    const FlashLinkStorageStatusV1& storage =
      *reinterpret_cast<const FlashLinkStorageStatusV1*>(
        slot.data + sizeof(FlashLinkHeaderV1));
    if (groundPeer) {
      groundPeer->state.storageUsedBytes = storage.usedBytes;
      groundPeer->state.storageCapacityBytes = storage.capacityBytes;
      groundPeer->state.storageRecordCount = storage.recordCount;
      flashLinkGroundRefreshSelectedPeer();
    }
    return;
  }

  constexpr uint16_t kPreviousFlashLinkTelemetryBytes = 105U;
  constexpr uint16_t kLegacyFlashLinkTelemetryBytes = 97U;
  if (type != FlashLinkPacketType::Telemetry ||
      !flashLinkGroundRole() ||
      (header->payloadBytes != sizeof(FlashLinkTelemetryV1) &&
       header->payloadBytes != kPreviousFlashLinkTelemetryBytes &&
       header->payloadBytes != kLegacyFlashLinkTelemetryBytes)) {
    return;
  }

  FlashLinkTelemetryV1 telemetry{};
  memcpy(
    &telemetry,
    slot.data + sizeof(FlashLinkHeaderV1),
    min<size_t>(header->payloadBytes, sizeof(telemetry)));
  uint32_t& rxTelemetrySeq = groundPeer
    ? groundPeer->rxTelemetrySeq
    : flashLink.rxTelemetrySeq;
  if (rxTelemetrySeq != 0) {
    if (telemetry.telemetrySeq == rxTelemetrySeq) {
      if (groundPeer) groundPeer->rxDuplicate++;
      else flashLink.rxDuplicate++;
      if (groundPeer) {
        memcpy(
          groundPeer->ackDestination,
          slot.mac,
          sizeof(groundPeer->ackDestination));
        groundPeer->ackPending = true;
      }
      else flashLink.ackPending = true;
      return;
    }
    const uint32_t delta = telemetry.telemetrySeq - rxTelemetrySeq;
    if (delta > 1U && delta < 0x80000000UL) {
      const uint32_t missing = delta - 1U;
      flashLink.rxDropped += missing;
      if (groundPeer) {
        groundPeer->rxDropped += missing;
        groundPeer->rxRateWindowDrops += missing;
      } else {
        flashLink.rxRateWindowDrops += missing;
      }
    } else if (delta >= 0x80000000UL) {
      if (groundPeer) groundPeer->rxDuplicate++;
      else flashLink.rxDuplicate++;
      return;
    }
  }
  rxTelemetrySeq = telemetry.telemetrySeq;
  flashLink.rxTelemetryFrames++;
  if (groundPeer) {
    groundPeer->rxTelemetryFrames++;
    groundPeer->rxRateWindowFrames++;
    groundPeer->lastTelemetryRxMs = nowMs;
    if (relayedPacket) {
      groundPeer->lastRelayTelemetryRxMs = nowMs;
      groundPeer->relayLinked = true;
    } else {
      groundPeer->lastDirectTelemetryRxMs = nowMs;
      groundPeer->directLinked = true;
    }
    groundPeer->linked = groundPeer->directLinked || groundPeer->relayLinked;
    flashLinkApplyTelemetryForGroundPeer(*groundPeer, telemetry);
    if (groundPeer->nodeId == flashLinkTargetNodeId) {
      flashLinkGroundRefreshSelectedPeer();
    }
  } else {
    flashLink.rxRateWindowFrames++;
    flashLink.lastTelemetryRxMs = nowMs;
    flashLink.linked = true;
    flashLinkApplyTelemetry(telemetry);
  }
  if (!flashLink.linkAnnounced || flashLink.disconnectAlarmActive) {
    flashLink.linkAnnounced = true;
    flashLink.disconnectAlarmActive = false;
    buzzerPlayFlashLinkConnectedMelody();
    Serial.println("[FLASH_LINK] link established");
  }
  const uint32_t ackFrameCount = groundPeer
    ? groundPeer->rxTelemetryFrames
    : flashLink.rxTelemetryFrames;
  if ((ackFrameCount % kFlashLinkAckEveryFrames) == 0U) {
    if (groundPeer) {
      memcpy(
        groundPeer->ackDestination,
        slot.mac,
        sizeof(groundPeer->ackDestination));
      groundPeer->ackPending = true;
    }
    else flashLink.ackPending = true;
  }
}

void setupFlashLink() {
  flashLink.session = esp_random();
  if (flashLink.session == 0) flashLink.session = 1;
  flashLink.rxRateWindowMs = millis();
  for (uint8_t i = 0; i < kFlashLinkVehicleNodeCount; ++i) {
    flashLinkGroundPeers[i].nodeId = i + kFlashLinkNodeIdStage1;
    flashLinkGroundPeers[i].rxRateWindowMs = flashLink.rxRateWindowMs;
  }

  const esp_err_t initErr = esp_now_init();
  if (initErr != ESP_OK) {
    Serial.printf("[FLASH_LINK] init failed err=%d\n", (int)initErr);
    return;
  }
  const esp_err_t pmkErr = esp_now_set_pmk(kFlashLinkPmk);
  const esp_err_t sendCallbackErr = esp_now_register_send_cb(flashLinkOnSend);
  const esp_err_t receiveCallbackErr = esp_now_register_recv_cb(flashLinkOnReceive);
  if (pmkErr != ESP_OK ||
      sendCallbackErr != ESP_OK ||
      receiveCallbackErr != ESP_OK) {
    Serial.printf(
      "[FLASH_LINK] setup failed pmk=%d send_cb=%d recv_cb=%d\n",
      (int)pmkErr,
      (int)sendCallbackErr,
      (int)receiveCallbackErr);
    esp_now_deinit();
    return;
  }

  esp_now_peer_info_t broadcast{};
  memcpy(broadcast.peer_addr, kFlashLinkBroadcastMac, ESP_NOW_ETH_ALEN);
  broadcast.channel = kFlashLinkChannel;
  broadcast.ifidx = flashLinkWifiInterface();
  broadcast.encrypt = false;
  const esp_err_t peerErr = esp_now_add_peer(&broadcast);
  if (peerErr != ESP_OK && peerErr != ESP_ERR_ESPNOW_EXIST) {
    Serial.printf("[FLASH_LINK] broadcast peer failed err=%d\n", (int)peerErr);
    esp_now_deinit();
    return;
  }

  wifi_promiscuous_filter_t filter{};
  filter.filter_mask =
    WIFI_PROMIS_FILTER_MASK_MGMT | WIFI_PROMIS_FILTER_MASK_DATA;
  const esp_err_t filterErr = esp_wifi_set_promiscuous_filter(&filter);
  const esp_err_t promiscuousCallbackErr =
    esp_wifi_set_promiscuous_rx_cb(flashLinkPromiscuousRx);
  const esp_err_t promiscuousErr = esp_wifi_set_promiscuous(true);
  if (filterErr != ESP_OK ||
      promiscuousCallbackErr != ESP_OK ||
      promiscuousErr != ESP_OK) {
    Serial.printf(
      "[FLASH_LINK] RSSI monitor unavailable filter=%d cb=%d enable=%d\n",
      (int)filterErr,
      (int)promiscuousCallbackErr,
      (int)promiscuousErr);
  }

  const wifi_interface_t flashIf = flashLinkWifiInterface();
  esp_err_t rateErr = esp_wifi_config_espnow_rate(flashIf, kFlashLinkEspNowRate);
  const char* rateName = rateErr == ESP_OK ? kFlashLinkEspNowRateName : "AUTO";
  snprintf(flashLinkRateName, sizeof(flashLinkRateName), "%s", rateName);
  flashLinkRateError = (int)rateErr;
  flashLink.initialized = true;
  Serial.printf("[FLASH_LINK] ready role=%s node=%u target=%u if=%s channel=%u rate=%s telemetry=%luHz rate_err=%d\n",
                flashLinkRoleName(),
                (unsigned)flashLinkLocalNodeId(),
                (unsigned)flashLinkTargetNodeId,
                flashIf == WIFI_IF_AP ? "AP" : "STA",
                (unsigned)kFlashLinkChannel,
                rateName,
                (unsigned long)kFlashLinkTelemetryHz,
                (int)rateErr);
}

void flashLinkGroundTick(uint32_t nowMs) {
  bool selectedStatsChanged = false;
  for (uint8_t i = 0; i < kFlashLinkVehicleNodeCount; ++i) {
    FlashLinkGroundPeer& peer = flashLinkGroundPeers[i];
    if (!peer.occupied) continue;
    if (peer.directReady && peer.lastDirectRxMs != 0U &&
        (uint32_t)(nowMs - peer.lastDirectRxMs) > kFlashLinkPeerTimeoutMs) {
      if (esp_now_is_peer_exist(peer.directMac)) esp_now_del_peer(peer.directMac);
      peer.directReady = false;
      peer.directLinked = false;
      memset(peer.directMac, 0, sizeof(peer.directMac));
    }
    if (peer.relayReady && peer.lastRelayRxMs != 0U &&
        (uint32_t)(nowMs - peer.lastRelayRxMs) > kFlashLinkPeerTimeoutMs) {
      peer.relayReady = false;
      peer.relayLinked = false;
      memset(peer.relayMac, 0, sizeof(peer.relayMac));
    }
    flashLinkGroundChooseRoute(peer);
    if (peer.rxRateWindowMs == 0U) peer.rxRateWindowMs = nowMs;
    if ((uint32_t)(nowMs - peer.rxRateWindowMs) >= 1000U) {
      const uint32_t elapsed = nowMs - peer.rxRateWindowMs;
      peer.rxHz = elapsed > 0U
        ? (uint16_t)min<uint32_t>(65535U, (peer.rxRateWindowFrames * 1000UL) / elapsed)
        : 0U;
      const uint32_t total = peer.rxRateWindowFrames + peer.rxRateWindowDrops;
      peer.rxLossPermille = total > 0U
        ? (uint16_t)min<uint32_t>(1000U, (peer.rxRateWindowDrops * 1000UL) / total)
        : (peer.remoteValid ? 1000U : 0U);
      peer.rxRateWindowFrames = 0;
      peer.rxRateWindowDrops = 0;
      peer.rxRateWindowMs = nowMs;
      if (peer.nodeId == flashLinkTargetNodeId) selectedStatsChanged = true;
    }
    if (peer.lastTelemetryRxMs != 0U &&
        (uint32_t)(nowMs - peer.lastTelemetryRxMs) > kFlashLinkTelemetryStaleMs) {
      Serial.printf("[FLASH_LINK] stage %u telemetry stale; clearing pending work\n",
                    (unsigned)peer.nodeId);
      flashLinkResetGroundPeer(peer);
      continue;
    }
    if (peer.lastPeerRxMs != 0U &&
        (uint32_t)(nowMs - peer.lastPeerRxMs) > kFlashLinkPeerTimeoutMs) {
      Serial.printf("[FLASH_LINK] stage %u timeout; removing peer\n", (unsigned)peer.nodeId);
      flashLinkResetGroundPeer(peer);
    }
  }
  if (selectedStatsChanged) flashLinkGroundRefreshSelectedPeer();

  if (!flashLink.txBusy) {
    for (uint8_t i = 0; i < kFlashLinkVehicleNodeCount; ++i) {
      FlashLinkGroundPeer& peer = flashLinkGroundPeers[i];
      if (!peer.peerReady || !peer.ackPending) continue;
      if (flashLinkSendPacket(
            FlashLinkPacketType::Ack,
            peer.ackDestination,
            nullptr,
            0,
            peer.rxTelemetrySeq,
            peer.nodeId)) {
        peer.ackPending = false;
        return;
      }
    }
  }

  if (!flashLink.txBusy && flashLinkCommandCount > 0U) {
    FlashLinkCommandQueueEntry pending{};
    portENTER_CRITICAL(&flashLinkCommandMux);
    if (flashLinkCommandCount > 0U) pending = flashLinkCommandQueue[flashLinkCommandHead];
    portEXIT_CRITICAL(&flashLinkCommandMux);
    FlashLinkGroundPeer* targetPeer = flashLinkGroundPeerForNode(pending.targetNodeId);
    if (targetPeer && flashLinkGroundPeerActive(pending.targetNodeId)) {
      const uint32_t retryMs = flashLinkCommandIsLongRunning(pending.command.code)
        ? kFlashLinkLongCommandRetryMs
        : kFlashLinkCommandRetryMs;
      const uint8_t maxAttempts = flashLinkCommandIsLongRunning(pending.command.code)
        ? kFlashLinkLongCommandMaxAttempts
        : kFlashLinkCommandMaxAttempts;
      const bool retryDue = pending.lastSendMs == 0U ||
        (uint32_t)(nowMs - pending.lastSendMs) >= retryMs;
      if (pending.attempts >= maxAttempts && retryDue) {
        portENTER_CRITICAL(&flashLinkCommandMux);
        if (flashLinkCommandCount > 0U &&
            flashLinkCommandQueue[flashLinkCommandHead].command.transaction ==
              pending.command.transaction) {
          flashLinkCommandHead =
            (uint8_t)((flashLinkCommandHead + 1U) % kFlashLinkCommandQueueDepth);
          flashLinkCommandCount--;
        }
        portEXIT_CRITICAL(&flashLinkCommandMux);
        flashLink.commandFailed++;
        flashLink.lastCommandCode = pending.command.code;
        flashLink.lastCommandResult = static_cast<uint8_t>(FlashLinkCommandResult::Busy);
        Serial.printf("[FLASH_LINK] stage %u command timeout txn=%lu code=%u\n",
                      (unsigned)pending.targetNodeId,
                      (unsigned long)pending.command.transaction,
                      (unsigned)pending.command.code);
        return;
      }
      const uint8_t* destination =
        flashLinkGroundCommandDestination(*targetPeer, pending.attempts);
      if (retryDue && destination && flashLinkSendPacket(
            FlashLinkPacketType::Command,
            destination,
            &pending.command,
            sizeof(pending.command),
            0,
            pending.targetNodeId)) {
        portENTER_CRITICAL(&flashLinkCommandMux);
        if (flashLinkCommandCount > 0U &&
            flashLinkCommandQueue[flashLinkCommandHead].command.transaction ==
              pending.command.transaction) {
          FlashLinkCommandQueueEntry& head = flashLinkCommandQueue[flashLinkCommandHead];
          if (head.attempts > 0U) flashLink.commandRetries++;
          head.attempts++;
          head.lastSendMs = nowMs;
        }
        portEXIT_CRITICAL(&flashLinkCommandMux);
        return;
      }
    }
  }

  if (!flashLink.txBusy) {
    for (uint8_t i = 0; i < kFlashLinkVehicleNodeCount; ++i) {
      FlashLinkGroundPeer& peer = flashLinkGroundPeers[i];
      if (!peer.peerReady ||
          (peer.lastHelloMs != 0U &&
           (uint32_t)(nowMs - peer.lastHelloMs) < kFlashLinkDiscoveryPeriodMs)) continue;
      const uint8_t* destination = nullptr;
      if (peer.relayReady && !peer.relayLinked) destination = peer.relayMac;
      else if (peer.directReady && !peer.directLinked) destination = peer.directMac;
      if (!destination) continue;
      peer.lastHelloMs = nowMs;
      if (flashLinkSendPacket(
            FlashLinkPacketType::Hello,
            destination,
            nullptr,
            0,
            0,
            peer.nodeId)) return;
    }
  }

  if (!flashLink.txBusy) {
    for (uint8_t i = 0; i < kFlashLinkVehicleNodeCount; ++i) {
      FlashLinkGroundPeer& peer = flashLinkGroundPeers[i];
      if (!peer.peerReady || !peer.linked ||
          (peer.lastHeartbeatMs != 0U &&
           (uint32_t)(nowMs - peer.lastHeartbeatMs) < kFlashLinkHeartbeatPeriodMs)) continue;
      peer.lastHeartbeatMs = nowMs;
      if (flashLinkSendPacket(
            FlashLinkPacketType::Heartbeat,
            peer.mac,
            nullptr,
            0,
            0,
            peer.nodeId)) return;
    }
  }

  FlashLinkGroundPeer* stage2Peer =
    flashLinkGroundPeerForNode(kFlashLinkNodeIdStage2);
  const bool stage2StandbyReady = stage2Peer && stage2Peer->directReady &&
    stage2Peer->directLinked;
  const bool allRequiredLinksReady =
    flashLinkGroundPeerActive(kFlashLinkNodeIdStage1) &&
    flashLinkGroundPeerActive(kFlashLinkNodeIdStage2) &&
    stage2StandbyReady;
  const uint32_t groundDiscoveryPeriod = allRequiredLinksReady
    ? kFlashLinkLinkedDiscoveryPeriodMs
    : kFlashLinkDiscoveryPeriodMs;
  if (!flashLink.txBusy &&
      (flashLink.lastDiscoveryMs == 0U ||
       (uint32_t)(nowMs - flashLink.lastDiscoveryMs) >= groundDiscoveryPeriod)) {
    flashLink.lastDiscoveryMs = nowMs;
    flashLinkSendDiscovery(FlashLinkPacketType::Discover);
  }
}

bool flashLinkStage1RelayTick(uint32_t nowMs) {
  if (!flashLinkStage1RelayRole()) return false;

  if (flashLinkRelay.stage2PeerReady && flashLinkRelay.stage2LastRxMs != 0U &&
      (uint32_t)(nowMs - flashLinkRelay.stage2LastRxMs) > kFlashLinkPeerTimeoutMs) {
    if (esp_now_is_peer_exist(flashLinkRelay.stage2Mac)) {
      esp_now_del_peer(flashLinkRelay.stage2Mac);
    }
    flashLinkRelay = {};
    flashLinkRelayTxHead = 0;
    flashLinkRelayTxTail = 0;
    flashLinkRelayTxCount = 0;
    Serial.println("[FLASH_LINK] stage 2 relay peer timeout; scanning again");
  } else if (flashLinkRelay.stage2LastTelemetryRxMs != 0U &&
             (uint32_t)(nowMs - flashLinkRelay.stage2LastTelemetryRxMs) >
               kFlashLinkTelemetryStaleMs) {
    flashLinkRelay.stage2Linked = false;
  }

  if (flashLinkDrainRelayTxQueue()) return true;

  if (flashLinkRelay.stage2PeerReady && flashLinkRelay.stage2AckPending &&
      !flashLink.txBusy) {
    if (flashLinkSendRoutedPacket(
          FlashLinkPacketType::Ack,
          flashLinkRelay.stage2Mac,
          nullptr,
          0,
          flashLinkRelay.stage2RxTelemetrySeq,
          kFlashLinkNodeIdGround,
          kFlashLinkNodeIdStage2,
          static_cast<uint8_t>(FlashLinkRole::Ground),
          flashLink.session,
          true)) {
      flashLinkRelay.stage2AckPending = false;
      return true;
    }
  }

  if (flashLinkRelay.stage2PeerReady && !flashLinkRelay.stage2Linked &&
      !flashLink.txBusy &&
      (flashLinkRelay.stage2LastHelloMs == 0U ||
       (uint32_t)(nowMs - flashLinkRelay.stage2LastHelloMs) >=
         kFlashLinkDiscoveryPeriodMs)) {
    flashLinkRelay.stage2LastHelloMs = nowMs;
    if (flashLinkSendRoutedPacket(
          FlashLinkPacketType::Hello,
          flashLinkRelay.stage2Mac,
          nullptr,
          0,
          0,
          kFlashLinkNodeIdGround,
          kFlashLinkNodeIdStage2,
          static_cast<uint8_t>(FlashLinkRole::Ground),
          flashLink.session,
          true)) {
      return true;
    }
  }

  if (flashLinkRelay.stage2PeerReady && flashLinkRelay.stage2Linked &&
      !flashLink.txBusy &&
      (flashLinkRelay.stage2LastHeartbeatMs == 0U ||
       (uint32_t)(nowMs - flashLinkRelay.stage2LastHeartbeatMs) >=
         kFlashLinkHeartbeatPeriodMs)) {
    flashLinkRelay.stage2LastHeartbeatMs = nowMs;
    if (flashLinkSendRoutedPacket(
          FlashLinkPacketType::Heartbeat,
          flashLinkRelay.stage2Mac,
          nullptr,
          0,
          0,
          kFlashLinkNodeIdGround,
          kFlashLinkNodeIdStage2,
          static_cast<uint8_t>(FlashLinkRole::Ground),
          flashLink.session,
          true)) {
      return true;
    }
  }

  if (!flashLinkRelay.stage2PeerReady && !flashLink.txBusy &&
      (flashLinkRelay.stage2LastDiscoveryMs == 0U ||
       (uint32_t)(nowMs - flashLinkRelay.stage2LastDiscoveryMs) >=
         kFlashLinkDiscoveryPeriodMs)) {
    flashLinkRelay.stage2LastDiscoveryMs = nowMs;
    if (flashLinkSendDiscovery(FlashLinkPacketType::Discover)) return true;
  }
  return false;
}

bool flashLinkStage2RelayActive(uint32_t nowMs) {
  return flashLinkStage2LeafRole() && flashLink.peerReady && flashLink.linked &&
    flashLink.lastPeerRxMs != 0U &&
    (uint32_t)(nowMs - flashLink.lastPeerRxMs) <=
      kFlashLinkPrimaryRouteFreshMs;
}

bool flashLinkStage2DirectGroundActive(uint32_t nowMs) {
  return flashLinkStage2LeafRole() && flashLinkDirectGround.peerReady &&
    flashLinkDirectGround.linked && flashLinkDirectGround.lastRxMs != 0U &&
    (uint32_t)(nowMs - flashLinkDirectGround.lastRxMs) <=
      kFlashLinkPeerTimeoutMs;
}

const uint8_t* flashLinkAvionicsUplinkDestination(uint32_t nowMs) {
  if (!flashLinkStage2LeafRole()) {
    return flashLink.peerReady && flashLink.linked ? flashLink.peerMac : nullptr;
  }
  // Stage 2 always uses the stage-1 relay while that primary path is fresh.
  // The direct ground peer is a hot standby, not a parallel telemetry source.
  if (flashLinkStage2RelayActive(nowMs)) return flashLink.peerMac;
  if (flashLinkStage2DirectGroundActive(nowMs)) return flashLinkDirectGround.mac;
  return nullptr;
}

bool flashLinkStage2DirectGroundTick(uint32_t nowMs) {
  if (!flashLinkStage2LeafRole()) return false;
  if (flashLinkDirectGround.peerReady && flashLinkDirectGround.lastRxMs != 0U &&
      (uint32_t)(nowMs - flashLinkDirectGround.lastRxMs) >
        kFlashLinkPeerTimeoutMs) {
    if (esp_now_is_peer_exist(flashLinkDirectGround.mac)) {
      esp_now_del_peer(flashLinkDirectGround.mac);
    }
    flashLinkDirectGround = {};
    Serial.println("[FLASH_LINK] direct ground standby timeout; scanning again");
  }
  if (!flashLinkDirectGround.peerReady || flashLink.txBusy) return false;

  if (flashLinkDirectGround.ackPending) {
    if (flashLinkSendPacket(
          FlashLinkPacketType::Ack,
          flashLinkDirectGround.mac,
          nullptr,
          0)) {
      flashLinkDirectGround.ackPending = false;
      flashLinkDirectGround.txFrames++;
      return true;
    }
  }
  if (!flashLinkDirectGround.linked &&
      (flashLinkDirectGround.lastHelloMs == 0U ||
       (uint32_t)(nowMs - flashLinkDirectGround.lastHelloMs) >=
         kFlashLinkDiscoveryPeriodMs)) {
    flashLinkDirectGround.lastHelloMs = nowMs;
    if (flashLinkSendPacket(
          FlashLinkPacketType::Hello,
          flashLinkDirectGround.mac,
          nullptr,
          0)) {
      flashLinkDirectGround.txFrames++;
      return true;
    }
  }
  if (flashLinkDirectGround.linked &&
      (flashLinkDirectGround.lastHeartbeatMs == 0U ||
       (uint32_t)(nowMs - flashLinkDirectGround.lastHeartbeatMs) >=
         kFlashLinkHeartbeatPeriodMs)) {
    flashLinkDirectGround.lastHeartbeatMs = nowMs;
    if (flashLinkSendPacket(
          FlashLinkPacketType::Heartbeat,
          flashLinkDirectGround.mac,
          nullptr,
          0)) {
      flashLinkDirectGround.txFrames++;
      return true;
    }
  }
  return false;
}

void flashLinkTick() {
  if (!flashLinkMode || !flashLink.initialized) return;

  static uint32_t lastServiceUs = 0;
  const uint32_t serviceNowUs = micros();
  if (flashLinkRxCount == 0U &&
      lastServiceUs != 0U &&
      (uint32_t)(serviceNowUs - lastServiceUs) <
        kFlashLinkServiceMinPeriodUs) {
    return;
  }
  lastServiceUs = serviceNowUs;

  FlashLinkRxSlot slot;
  uint8_t processed = 0;
  while (processed < kFlashLinkRxDrainLimit && flashLinkPopRx(slot)) {
    flashLinkHandlePacket(slot);
    processed++;
  }

  const uint32_t nowMs = millis();
  const uint32_t nowUs = micros();
  if (flashLink.txBusy &&
      flashLink.lastTxStartMs != 0 &&
      (uint32_t)(nowMs - flashLink.lastTxStartMs) > kFlashLinkTxBusyTimeoutMs) {
    flashLink.txBusy = false;
    flashLink.txFail++;
  }
  if (flashLinkStage1RelayTick(nowMs)) return;
  if (flashLinkGroundRole()) {
    flashLinkGroundTick(nowMs);
    return;
  }
  if ((uint32_t)(nowMs - flashLink.rxRateWindowMs) >= 1000U) {
    const uint32_t elapsed = nowMs - flashLink.rxRateWindowMs;
    flashLink.rxHz = elapsed > 0
      ? (uint16_t)min<uint32_t>(65535U, (flashLink.rxRateWindowFrames * 1000UL) / elapsed)
      : 0;
    const uint32_t windowTotal =
      flashLink.rxRateWindowFrames + flashLink.rxRateWindowDrops;
    flashLink.rxLossPermille = windowTotal > 0
      ? (uint16_t)min<uint32_t>(
          1000U,
          (flashLink.rxRateWindowDrops * 1000UL) / windowTotal)
      : (flashLink.remoteValid ? 1000U : 0U);
    flashLink.rxRateWindowFrames = 0;
    flashLink.rxRateWindowDrops = 0;
    flashLink.rxRateWindowMs = nowMs;
  }

  if (flashLink.linkAnnounced &&
      !flashLink.disconnectAlarmActive &&
      flashLinkLastActivityMs() != 0 &&
      flashLinkPeerAgeMs() > kFlashLinkTelemetryStaleMs) {
    flashLink.disconnectAlarmActive = true;
    flashLink.linked = false;
    flashLink.remoteValid = false;
    flashLink.ackPending = false;
    flashLink.lastHelloMs = 0;
    flashLink.lastDiscoveryMs = 0;
    buzzerPlayFlashLinkDisconnectedAlarm();
    Serial.println("[FLASH_LINK] connection lost; buzzer alarm active");
  }
  if (flashLink.disconnectAlarmActive &&
      !buzzerMuted &&
      (!buzzer.active ||
       !buzzer.loop ||
       buzzer.notes != kFlashLinkDisconnectedAlarm)) {
    buzzerPlayFlashLinkDisconnectedAlarm();
  }

  const uint32_t primaryLastRxMs = flashLinkStage2LeafRole()
    ? flashLink.lastPeerRxMs
    : flashLinkLastActivityMs();
  if (flashLink.peerReady && primaryLastRxMs != 0U) {
    const uint32_t peerAgeMs = nowMs - primaryLastRxMs;
    if (flashLink.disconnectAlarmActive &&
        peerAgeMs > kFlashLinkRecoveryPeerResetMs) {
      Serial.println("[FLASH_LINK] reconnect stalled; resetting peer");
      flashLinkResetPeer();
    } else if (peerAgeMs > kFlashLinkPeerTimeoutMs) {
      Serial.println("[FLASH_LINK] peer timeout; scanning again");
      flashLinkResetPeer();
    }
  }

  if (flashLinkStage2DirectGroundTick(nowMs)) return;

  if (flashLink.peerReady && !flashLink.linked) {
    if (!flashLink.txBusy &&
        (flashLink.lastDiscoveryMs == 0 ||
         (uint32_t)(nowMs - flashLink.lastDiscoveryMs) >= kFlashLinkDiscoveryPeriodMs)) {
      flashLink.lastDiscoveryMs = nowMs;
      if (flashLinkSendDiscovery(FlashLinkPacketType::Discover)) {
        return;
      }
    }
    if (!flashLink.txBusy &&
        (flashLink.lastHelloMs == 0 ||
         (uint32_t)(nowMs - flashLink.lastHelloMs) >= kFlashLinkDiscoveryPeriodMs)) {
      flashLink.lastHelloMs = nowMs;
      flashLinkSendPacket(FlashLinkPacketType::Hello, flashLink.peerMac, nullptr, 0);
      return;
    }
    if (!flashLinkStage2DirectGroundActive(nowMs)) return;
  }

  if (flashLink.commandAckPending && !flashLink.txBusy) {
    if (flashLinkSendPacket(
          FlashLinkPacketType::CommandAck,
          flashLink.commandAckDestination,
          &flashLink.commandAck,
          sizeof(flashLink.commandAck))) {
      flashLink.commandAckPending = false;
      memset(
        flashLink.commandAckDestination,
        0,
        sizeof(flashLink.commandAckDestination));
    }
    return;
  }

  if (flashLink.ackPending && flashLink.peerReady && !flashLink.txBusy) {
    flashLink.ackPending = false;
    flashLinkSendPacket(
      FlashLinkPacketType::Ack,
      flashLink.peerMac,
      nullptr,
      0,
      flashLink.rxTelemetrySeq);
    return;
  }

  if (flashLinkAvionicsRole() &&
      !flashLink.txBusy &&
      missionAlarmLocal.seq != 0U &&
      (missionAlarmLocal.seq != flashLink.lastMissionAlarmTxSeq ||
       (uint32_t)(nowMs - flashLink.lastMissionAlarmTxMs) >= 1000U)) {
    FlashLinkMissionAlarmV1 alarm{};
    flashLinkFillMissionAlarm(alarm);
    const uint8_t* destination = flashLinkAvionicsUplinkDestination(nowMs);
    if (destination && flashLinkSendPacket(
          FlashLinkPacketType::MissionAlarm,
          destination,
          &alarm,
          sizeof(alarm))) {
      flashLink.lastMissionAlarmTxSeq = missionAlarmLocal.seq;
      flashLink.lastMissionAlarmTxMs = nowMs;
      return;
    }
  }

  if (flashLinkAvionicsRole() && !flashLink.txBusy &&
      (flashLink.lastStorageStatusTxMs == 0 ||
       (uint32_t)(nowMs - flashLink.lastStorageStatusTxMs) >=
         kFlashLinkStorageStatusPeriodMs)) {
    flashLink.lastStorageStatusTxMs = nowMs;
    StorageRuntime storageSnapshot{};
    {
      StorageLock lock(0);
      if (lock) {
        storageRefreshStats();
        storageSnapshot = storageState;
      }
    }
    const FlashLinkStorageStatusV1 storage{
      storageSnapshot.usedBytes,
      storageSnapshot.capacityBytes,
      storageSnapshot.recordCount
    };
    const uint8_t* destination = flashLinkAvionicsUplinkDestination(nowMs);
    if (destination && flashLinkSendPacket(
          FlashLinkPacketType::StorageStatus,
          destination,
          &storage,
          sizeof(storage))) {
      return;
    }
  }

  if (flashLinkAvionicsRole() &&
      (uint32_t)(nowUs - flashLink.lastTelemetryTxUs) >= kFlashLinkTelemetryPeriodUs) {
    flashLink.lastTelemetryTxUs = nowUs;
    if (flashLink.txBusy) {
      flashLink.txSkipped++;
      return;
    }
    FlashLinkTelemetryV1 payload{};
    flashLinkFillTelemetry(payload);
    const uint8_t* destination = flashLinkAvionicsUplinkDestination(nowMs);
    if (destination && flashLinkSendPacket(
      FlashLinkPacketType::Telemetry,
      destination,
      &payload,
      sizeof(payload),
      flashLink.lastAckSeq)) {
      return;
    }
    flashLink.txSkipped++;
    return;
  }

  if (flashLink.linked && flashLink.peerReady && !flashLink.txBusy &&
      (uint32_t)(nowMs - flashLink.lastHeartbeatMs) >= kFlashLinkHeartbeatPeriodMs) {
    flashLink.lastHeartbeatMs = nowMs;
    flashLinkSendPacket(FlashLinkPacketType::Heartbeat, flashLink.peerMac, nullptr, 0);
    return;
  }

  const uint32_t discoveryPeriod = flashLink.linked
    ? kFlashLinkLinkedDiscoveryPeriodMs
    : kFlashLinkDiscoveryPeriodMs;
  if (!flashLink.txBusy &&
      (flashLink.lastDiscoveryMs == 0 ||
       (uint32_t)(nowMs - flashLink.lastDiscoveryMs) >= discoveryPeriod)) {
    flashLink.lastDiscoveryMs = nowMs;
    flashLinkSendDiscovery(FlashLinkPacketType::Discover);
  }
}

void setupWifi() {
  uint64_t mac = ESP.getEfuseMac();
  uint32_t suffix = (uint32_t)(mac & 0xFFFFFFUL);
  const char* ssidPrefix = flashLinkGroundRole()
    ? "ALTIS-GROUND"
    : (flashLinkAvionicsRole() ? "ALTIS-AVIONICS" : "ALTIS-FLASH6");
  snprintf(apSsid, sizeof(apSsid), "%s-%06lX", ssidPrefix, (unsigned long)suffix);

  WiFi.persistent(false);
  WiFi.disconnect(false, false);
  delay(50);
  if (flashLinkAvionicsRole()) {
    WiFi.mode(WIFI_STA);
  } else if (flashLinkGroundRole()) {
    WiFi.mode(WIFI_AP_STA);
  } else if (wifiApShouldRun()) {
    WiFi.mode(WIFI_AP);
  } else {
    WiFi.mode(WIFI_OFF);
    wifiApReady = false;
    Serial.println("[WIFI] disabled in flight mode");
    return;
  }
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);
  esp_wifi_set_max_tx_power(78);
  if (flashLinkAvionicsRole()) {
    esp_wifi_set_protocol(
      WIFI_IF_STA,
      WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N | WIFI_PROTOCOL_LR);
    esp_wifi_set_bandwidth(WIFI_IF_STA, WIFI_BW_HT20);
    esp_wifi_set_channel(kFlashLinkChannel, WIFI_SECOND_CHAN_NONE);
  } else if (flashLinkGroundRole()) {
    esp_wifi_set_protocol(
      WIFI_IF_STA,
      WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N | WIFI_PROTOCOL_LR);
    esp_wifi_set_bandwidth(WIFI_IF_STA, WIFI_BW_HT20);
    esp_wifi_set_channel(kFlashLinkChannel, WIFI_SECOND_CHAN_NONE);
  }
  if (wifiApShouldRun()) {
    uint8_t apProtocols =
      WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N;
    const esp_err_t protocolErr =
      esp_wifi_set_protocol(WIFI_IF_AP, apProtocols);
    if (protocolErr != ESP_OK) {
      Serial.printf("[WIFI] AP protocol setup failed err=%d\n",
                    (int)protocolErr);
    }
  }

  if (wifiApShouldRun()) {
    startWifiAp(false);
  } else {
    wifiApReady = false;
    Serial.printf("[WIFI] AP disabled; ALTIS INTELLIGENT LINK1 avionics radio channel=%u\n",
                  (unsigned)kFlashLinkChannel);
  }
}
