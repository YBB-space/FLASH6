constexpr uint8_t kMissionRuntimeMaxBlocks = 64;
constexpr uint8_t kMissionMaxConditions = 7;
constexpr uint32_t kMissionTickPeriodUs = 10000;

enum class MissionConditionType : uint8_t {
  Invalid,
  Altitude,
  SwitchRising,
  SwitchFalling,
  SequenceStart,
  TimeAfterFiring,
  GyroX,
  GyroY,
  GyroZ,
  Variable,
  VariableChange,
  Boot,
};

enum class MissionCompare : uint8_t { Greater, Less, Equal };

enum class MissionActionType : uint8_t {
  Invalid,
  Servo,
  Pyro,
  Buzzer,
  FindBuzzer,
  StopBuzzer,
  Alarm,
  VariableSet,
  VariableAdd,
  VariableAverage,
};

struct MissionCondition {
  MissionConditionType type = MissionConditionType::Invalid;
  MissionCompare compare = MissionCompare::Greater;
  float value = 0.0f;
  int8_t variable = -1;
  int8_t rhsVariable = -1;
};

struct MissionAction {
  MissionActionType type = MissionActionType::Invalid;
  uint8_t channel = 1;
  int32_t value = 0;
  uint32_t durationMs = 0;
  int8_t variable = -1;
  char title[24] = {};
  char message[64] = {};
};

struct MissionRuntimeBlock {
  bool enabled = true;
  bool once = true;
  bool fired = false;
  bool lastWhen = false;
  bool pending = false;
  uint8_t conditionCount = 0;
  uint32_t delayMs = 0;
  uint32_t pendingAtMs = 0;
  MissionCondition conditions[kMissionMaxConditions] = {};
  MissionAction action;
};

struct MissionAlarmState {
  uint32_t seq = 0;
  uint32_t timestampMs = 0;
  uint16_t blockIndex = 0;
  char title[24] = {};
  char message[64] = {};
};

MissionRuntimeBlock missionRuntimeBlocks[kMissionRuntimeMaxBlocks];
uint8_t missionRuntimeBlockCount = 0;
int32_t missionVariables[8] = {};
int32_t missionPreviousVariables[8] = {};
uint16_t missionVariableUpCount[8] = {};
uint16_t missionVariableDownCount[8] = {};
char missionVariableNames[8][20] = {};
uint8_t missionLastSwitch = 0;
uint8_t missionLastSequenceState = 0;
uint32_t missionLastTickUs = 0;
uint32_t missionAlarmCounter = 0;
MissionAlarmState missionAlarmLocal;
MissionAlarmState missionAlarmRemote;

constexpr uint32_t kLaunchArmDebounceMs = 50U;
constexpr uint32_t kLaunchEarlyCoastMs = 1500U;
constexpr uint32_t kLaunchThrustArmConfirmMs = 1000U;
constexpr uint32_t kLaunchArmChatterWindowMs = 1000U;
constexpr uint8_t kLaunchArmChatterTransitions = 3U;
constexpr uint32_t kMissionEventRepeatMs = 100U;

enum class LaunchMissionState : uint8_t {
  Idle = 0,
  Standby = 1,
  WaitingCoast = 2,
  WaitingStage2Arm = 3,
  WaitingStage2Ejection = 4,
  Complete = 5,
  Fault = 6,
};

struct LaunchMissionRuntime {
  LaunchMissionState state = LaunchMissionState::Idle;
  bool forceTimed = false;
  bool armRawOn = true;
  bool armStableOn = true;
  bool armContactFault = false;
  bool launchLatched = false;
  bool launchAuthorityConfirmed = false;
  bool thrustLaunchProvisional = false;
  bool launchDetectionFault = false;
  bool coastSeen = false;
  bool earlyCoast = false;
  bool coastTimeout = false;
  bool interstageFallback = false;
  bool stage1Separated = false;
  bool stage2ArmReleased = false;
  bool stage2Ignited = false;
  bool stage1Ejected = false;
  bool stage2Ejected = false;
  bool primaryFailed = false;
  bool secondaryCommanded = false;
  bool secondaryFailed = false;
  uint32_t armRawChangedMs = 0;
  uint32_t armChatterWindowMs = 0;
  uint8_t armChatterCount = 0;
  uint32_t standbyStartedMs = 0;
  uint32_t waitingLaunchSinceMs = 0;
  uint32_t launchMs = 0;
  uint32_t thrustArmDeadlineMs = 0;
  uint32_t ignitionStartMs = 0;
  uint32_t ignitionDelayMs = UINT32_MAX;
  uint32_t primaryCommandMs = 0;
  uint32_t stage2ArmReleasedMs = 0;
  uint32_t stage2IgnitionMs = 0;
  uint32_t localMotionSinceMs = 0;
  uint32_t sequenceId = 0;
  uint32_t eventSeq = 0;
  uint32_t lastStandbyEventTxMs = 0;
  uint32_t lastTplusEventTxMs = 0;
  uint32_t lastSeparationEventTxMs = 0;
  uint32_t lastStage2ArmEventTxMs = 0;
};

LaunchMissionRuntime launchMission;

struct MissionAbortBroadcastRuntime {
  bool active = false;
  uint8_t reason = 0;
  uint32_t sequenceId = 0;
  uint32_t eventSeq = 0;
  uint32_t untilMs = 0;
  uint32_t lastTxMs = 0;
};

MissionAbortBroadcastRuntime missionAbortBroadcast;

void missionCopyText(char* out, size_t outLen, const char* value, const char* fallback = "") {
  if (!out || outLen == 0) return;
  snprintf(out, outLen, "%s", value && value[0] ? value : fallback);
}

void missionSyncLaunchTelemetry() {
  snap.ignitionDelayMs = launchMission.ignitionDelayMs;
  // Preserve the public deployment_state/flags contract used by existing
  // HUD, replay and report code. The richer launch state machine remains an
  // internal detail and is exposed through alarms/sequence_state instead.
  if (launchMission.state == LaunchMissionState::Fault) {
    snap.deploymentState = 4U;
  } else if (launchMission.state == LaunchMissionState::Complete) {
    snap.deploymentState = 3U;
  } else if (launchMission.stage1Separated || launchMission.stage2Ignited) {
    snap.deploymentState = 2U;
  } else if (launchMission.launchLatched) {
    snap.deploymentState = 1U;
  } else {
    snap.deploymentState = 0U;
  }
  snap.deploymentFlags = 0;
  if (launchMission.ignitionDelayMs != UINT32_MAX) snap.deploymentFlags |= 1U << 0;
  if (launchMission.earlyCoast) snap.deploymentFlags |= 1U << 1;
  if (launchMission.coastTimeout) snap.deploymentFlags |= 1U << 2;
  if (launchMission.primaryFailed) snap.deploymentFlags |= 1U << 3;
  if (launchMission.state == LaunchMissionState::Fault) snap.deploymentFlags |= 1U << 4;
  if (launchMission.secondaryCommanded) snap.deploymentFlags |= 1U << 5;
  if (launchMission.secondaryFailed) snap.deploymentFlags |= 1U << 6;
  if (launchMission.forceTimed) snap.deploymentFlags |= 1U << 7;
}

void missionResetLaunchRuntime(uint32_t nowMs) {
  const bool rawOn = armSwitchPhysicalOn();
  launchMission = LaunchMissionRuntime{};
  launchMission.armRawOn = rawOn;
  launchMission.armStableOn = rawOn;
  launchMission.armRawChangedMs = nowMs;
  launchMission.sequenceId = bootSessionId ^ nowMs;
  if (launchMission.sequenceId == 0U) launchMission.sequenceId = 1U;
  missionSyncLaunchTelemetry();
}

int8_t missionVariableSlot(const char* name, uint8_t channel, bool create) {
  if (name && name[0]) {
    for (uint8_t i = 0; i < 8; ++i) {
      if (missionVariableNames[i][0] && strcmp(missionVariableNames[i], name) == 0) {
        return (int8_t)i;
      }
    }
    if (create) {
      for (uint8_t i = 0; i < 8; ++i) {
        if (!missionVariableNames[i][0]) {
          missionCopyText(missionVariableNames[i], sizeof(missionVariableNames[i]), name);
          return (int8_t)i;
        }
      }
    }
  }
  if (channel < 1U) channel = 1U;
  if (channel > 8U) channel = 8U;
  return (int8_t)(channel - 1U);
}

MissionCompare missionParseCompare(const char* value) {
  if (!value) return MissionCompare::Greater;
  if (!strcmp(value, "lt") || !strcmp(value, "<") || !strcmp(value, "<=")) {
    return MissionCompare::Less;
  }
  if (!strcmp(value, "eq") || !strcmp(value, "=") || !strcmp(value, "==")) {
    return MissionCompare::Equal;
  }
  return MissionCompare::Greater;
}

MissionConditionType missionParseConditionType(const char* value) {
  if (!value) return MissionConditionType::Invalid;
  if (!strcmp(value, "altitude_gte")) return MissionConditionType::Altitude;
  if (!strcmp(value, "switch_rising")) return MissionConditionType::SwitchRising;
  if (!strcmp(value, "switch_falling")) return MissionConditionType::SwitchFalling;
  if (!strcmp(value, "sequence_start")) return MissionConditionType::SequenceStart;
  if (!strcmp(value, "time_after_firing_ms")) return MissionConditionType::TimeAfterFiring;
  if (!strcmp(value, "gyro_x_deg")) return MissionConditionType::GyroX;
  if (!strcmp(value, "gyro_y_deg")) return MissionConditionType::GyroY;
  if (!strcmp(value, "gyro_z_deg")) return MissionConditionType::GyroZ;
  if (!strcmp(value, "var_value")) return MissionConditionType::Variable;
  if (!strcmp(value, "var_change_count")) return MissionConditionType::VariableChange;
  if (!strcmp(value, "boot")) return MissionConditionType::Boot;
  return MissionConditionType::Invalid;
}

MissionActionType missionParseActionType(const char* value) {
  if (!value) return MissionActionType::Invalid;
  if (!strcmp(value, "servo")) return MissionActionType::Servo;
  if (!strcmp(value, "pyro")) return MissionActionType::Pyro;
  if (!strcmp(value, "buzzer")) return MissionActionType::Buzzer;
  if (!strcmp(value, "find_buzzer")) return MissionActionType::FindBuzzer;
  if (!strcmp(value, "notone")) return MissionActionType::StopBuzzer;
  if (!strcmp(value, "alarm")) return MissionActionType::Alarm;
  if (!strcmp(value, "var_set")) return MissionActionType::VariableSet;
  if (!strcmp(value, "var_add")) return MissionActionType::VariableAdd;
  if (!strcmp(value, "var_avg")) return MissionActionType::VariableAverage;
  return MissionActionType::Invalid;
}

bool missionParseCondition(JsonObjectConst src, MissionCondition& out) {
  out.type = missionParseConditionType(src["type"] | "");
  if (out.type == MissionConditionType::Invalid) return false;
  out.compare = missionParseCompare(src["cmp"] | "gt");
  out.value = src["value"] | 0.0f;
  const uint8_t channel = src["pin"] | 1U;
  if (out.type == MissionConditionType::Variable ||
      out.type == MissionConditionType::VariableChange) {
    out.variable = missionVariableSlot(src["varName"] | "", channel, true);
  }
  const char* rhsType = src["rhsType"] | "const";
  if (out.type == MissionConditionType::Variable && !strcmp(rhsType, "var")) {
    out.rhsVariable = missionVariableSlot(src["rhsVarName"] | "", channel, true);
  }
  return true;
}

bool missionParseAction(JsonObjectConst src, MissionAction& out) {
  out.type = missionParseActionType(src["type"] | "");
  if (out.type == MissionActionType::Invalid) return false;
  const uint8_t maxChannel =
    out.type == MissionActionType::Servo ? kServoChannelCount :
    (out.type == MissionActionType::Pyro ? kPyroChannelCount : 8U);
  out.channel = constrain((int)(src["channel"] | 1), 1, (int)maxChannel);
  if (out.type == MissionActionType::Servo) {
    out.value = constrain((int)(src["angle"] | 90), 0, 180);
  } else {
    out.value = src["value"] | 0;
  }
  out.durationMs = src["durationMs"] | 300U;
  if (out.type == MissionActionType::VariableSet ||
      out.type == MissionActionType::VariableAdd ||
      out.type == MissionActionType::VariableAverage) {
    out.variable = missionVariableSlot(src["varName"] | "", out.channel, true);
  }
  if (out.type == MissionActionType::Alarm) {
    missionCopyText(out.title, sizeof(out.title), src["title"] | "", "Mission alarm");
    missionCopyText(out.message, sizeof(out.message), src["message"] | "", "Alarm triggered");
  }
  return true;
}

bool loadMissionRuntimeFromFlash() {
  missionRuntimeBlockCount = 0;
  memset(missionRuntimeBlocks, 0, sizeof(missionRuntimeBlocks));
  memset(missionVariables, 0, sizeof(missionVariables));
  memset(missionPreviousVariables, 0, sizeof(missionPreviousVariables));
  memset(missionVariableUpCount, 0, sizeof(missionVariableUpCount));
  memset(missionVariableDownCount, 0, sizeof(missionVariableDownCount));
  memset(missionVariableNames, 0, sizeof(missionVariableNames));
  missionLastSwitch = armSwitchEffectiveOn() ? 1U : 0U;
  missionLastSequenceState = sequenceState;
  missionResetLaunchRuntime(millis());

  if (kFirmwareMissionLocked) {
    Serial.println("[MISSION] built-in launch mission active; user runtime blocks disabled");
    return true;
  }

  const String body = missionProfileJson();
  DynamicJsonDocument doc(kMissionProfileMaxBytes + 4096U);
  const DeserializationError error = deserializeJson(doc, body);
  if (error) {
    Serial.printf("[MISSION] profile parse failed: %s\n", error.c_str());
    return false;
  }
  JsonArrayConst blocks = doc["blocks"].as<JsonArrayConst>();
  for (JsonObjectConst src : blocks) {
    if (missionRuntimeBlockCount >= kMissionRuntimeMaxBlocks) break;
    MissionRuntimeBlock& block = missionRuntimeBlocks[missionRuntimeBlockCount];
    block.enabled = src["enabled"] | true;
    block.once = src["once"] | true;
    block.delayMs = src["delayMs"] | 0U;

    JsonArrayConst all = src["whenAll"].as<JsonArrayConst>();
    if (!all.isNull()) {
      for (JsonObjectConst condition : all) {
        if (block.conditionCount >= kMissionMaxConditions) break;
        if (missionParseCondition(condition, block.conditions[block.conditionCount])) {
          block.conditionCount++;
        }
      }
    }
    if (block.conditionCount == 0) {
      JsonObjectConst condition = src["when"].as<JsonObjectConst>();
      if (!condition.isNull() &&
          missionParseCondition(condition, block.conditions[0])) {
        block.conditionCount = 1;
      }
    }
    JsonObjectConst action = src["then"].as<JsonObjectConst>();
    if (!block.enabled || block.conditionCount == 0 || action.isNull() ||
        !missionParseAction(action, block.action)) {
      continue;
    }
    Serial.printf(
      "[MISSION] arm block=%u conditions=%u action=%u ch=%u value=%ld delay=%lu once=%u\n",
      (unsigned)(missionRuntimeBlockCount + 1U),
      (unsigned)block.conditionCount,
      (unsigned)block.action.type,
      (unsigned)block.action.channel,
      (long)block.action.value,
      (unsigned long)block.delayMs,
      block.once ? 1U : 0U);
    missionRuntimeBlockCount++;
  }
  Serial.printf("[MISSION] loaded %u runtime blocks from ESP flash\n",
                (unsigned)missionRuntimeBlockCount);
  return true;
}

bool missionCompare(float left, float right, MissionCompare compare) {
  if (!isfinite(left) || !isfinite(right)) return false;
  if (compare == MissionCompare::Less) return left <= right;
  if (compare == MissionCompare::Equal) return fabsf(left - right) <= 0.0001f;
  return left >= right;
}

bool missionConditionSatisfied(
  const MissionCondition& condition,
  bool switchRising,
  bool switchFalling,
  bool sequenceStart,
  uint32_t nowMs
) {
  float left = 0.0f;
  float right = condition.value;
  switch (condition.type) {
    case MissionConditionType::SwitchRising: return switchRising;
    case MissionConditionType::SwitchFalling: return switchFalling;
    case MissionConditionType::SequenceStart: return sequenceStart;
    case MissionConditionType::Boot: return true;
    case MissionConditionType::Altitude: left = snap.altM; break;
    case MissionConditionType::TimeAfterFiring:
      left = sequenceState == kSequenceStateFiring ||
             sequenceState == kSequenceStateTplus
        ? (float)max<int32_t>(0, sequenceTdMs(nowMs))
        : -1.0f;
      break;
    case MissionConditionType::GyroX: left = snap.roll; break;
    case MissionConditionType::GyroY: left = snap.pitch; break;
    case MissionConditionType::GyroZ: left = snap.yaw; break;
    case MissionConditionType::Variable:
      if (condition.variable < 0) return false;
      left = (float)missionVariables[condition.variable];
      if (condition.rhsVariable >= 0) {
        right = (float)missionVariables[condition.rhsVariable];
      }
      break;
    case MissionConditionType::VariableChange:
      if (condition.variable < 0) return false;
      left = condition.compare == MissionCompare::Less
        ? (float)missionVariableDownCount[condition.variable]
        : (float)missionVariableUpCount[condition.variable];
      break;
    default: return false;
  }
  return missionCompare(left, right, condition.compare);
}

void missionEmitAlarm(uint16_t blockIndex, const char* title, const char* message) {
  const uint32_t nowMs = millis();
  missionAlarmCounter = max(missionAlarmCounter + 1U, nowMs);
  missionAlarmLocal.seq = missionAlarmCounter;
  missionAlarmLocal.timestampMs = nowMs;
  missionAlarmLocal.blockIndex = blockIndex;
  missionCopyText(missionAlarmLocal.title, sizeof(missionAlarmLocal.title), title, "Mission alarm");
  missionCopyText(missionAlarmLocal.message, sizeof(missionAlarmLocal.message), message, "Alarm triggered");
  const bool stored = storageEnqueueMissionAlarm(
    nowMs,
    missionAlarmLocal.seq,
    blockIndex,
    missionAlarmLocal.title,
    missionAlarmLocal.message);
  Serial.printf("[MISSION_ALARM][%lu][BLOCK %u] %s: %s flash=%s\n",
                (unsigned long)missionAlarmLocal.seq,
                (unsigned)blockIndex,
                missionAlarmLocal.title,
                missionAlarmLocal.message,
                stored ? "stored" : "not_stored");
  buzzerPlayTone(2480, 180);
}

bool missionUsesStage2HallPolarity() {
  return flashLinkStage2Enabled && flashLinkStage2NodeRole();
}

bool missionArmMechanismInstalled() {
  return armSwitchPhysicalInstalled();
}

bool missionArmReleaseTransition(bool wasHigh, bool isHigh) {
  return missionUsesStage2HallPolarity()
    ? (!wasHigh && isHigh)
    : (wasHigh && !isHigh);
}

bool missionUpdateArmSwitch(uint32_t nowMs, uint32_t& releaseEdgeMs) {
  releaseEdgeMs = 0;
  const bool rawOn = armSwitchPhysicalOn();
  if (rawOn != launchMission.armRawOn) {
    launchMission.armRawOn = rawOn;
    launchMission.armRawChangedMs = nowMs;
    // Contact chatter is a hardware fault, not a mission-state fault. Keep
    // watching vehicle ARM inputs while idle, during ignition/standby and in
    // flight so an intermittent connector cannot disappear merely because the
    // operator has not entered mission standby yet. Ground nodes have no
    // vehicle ARM contact to supervise.
    const bool chatterSensitive = flashLinkMissionRoleEnabled();
    if (chatterSensitive) {
      if (launchMission.armChatterWindowMs == 0U ||
          (uint32_t)(nowMs - launchMission.armChatterWindowMs) >
            kLaunchArmChatterWindowMs) {
        launchMission.armChatterWindowMs = nowMs;
        launchMission.armChatterCount = 1U;
      } else if (launchMission.armChatterCount < UINT8_MAX) {
        launchMission.armChatterCount++;
      }
    }
  }
  if (rawOn == launchMission.armStableOn ||
      (uint32_t)(nowMs - launchMission.armRawChangedMs) < kLaunchArmDebounceMs) {
    return false;
  }
  const bool wasOn = launchMission.armStableOn;
  launchMission.armStableOn = rawOn;
  if (missionArmReleaseTransition(wasOn, rawOn)) {
    releaseEdgeMs = launchMission.armRawChangedMs;
    return true;
  }
  return false;
}

bool missionInterstageLinkHealthy(uint32_t nowMs) {
  if (!flashLinkMode || !flashLinkStage2Enabled) return false;
  if (flashLinkStage1NodeRole()) {
    return flashLinkRelay.stage2PeerReady && flashLinkRelay.stage2Linked &&
      flashLinkRelay.stage2LastRxMs != 0U &&
      (uint32_t)(nowMs - flashLinkRelay.stage2LastRxMs) <=
        missionInterstageLinkLossMs;
  }
  if (flashLinkStage2NodeRole()) {
    return flashLink.peerReady && flashLink.linked &&
      flashLink.lastPeerRxMs != 0U &&
      (uint32_t)(nowMs - flashLink.lastPeerRxMs) <=
        missionInterstageLinkLossMs;
  }
  return false;
}

bool missionIsStage2Node() {
  return missionUsesStage2HallPolarity();
}

bool missionIsStage1Node() {
  // Stage 1 is also the default for single-board/wired operation where
  // A.I LINK is disabled. A configured stage-2 node never falls back into the
  // stage-1 mission while two-stage operation is disabled.
  return flashLinkMissionRoleEnabled() && !flashLinkStage2NodeRole();
}

void missionSendInterstageEvent(
  MissionInterstageEventCode code,
  uint32_t eventAtMs,
  int32_t tplusMs = 0
) {
  if (!flashLinkMode || !flashLinkStage2Enabled || flashLinkGroundRole()) return;
  FlashLinkMissionEventV1 event{};
  event.sequenceId = launchMission.sequenceId;
  event.eventSeq = ++launchMission.eventSeq;
  event.eventAtMs = eventAtMs;
  event.tplusMs = tplusMs;
  event.code = static_cast<uint8_t>(code);
  event.sourceNodeId = flashLinkLocalNodeId();
  if (launchMission.interstageFallback) event.flags |= 1U << 0;
  event.stage1SeparationBackupMs = missionStage1SeparationBackupMs;
  event.stage1EjectionDelayMs = missionStage1EjectionDelayMs;
  event.stage2EjectionDelayMs = missionStage2EjectionDelayMs;
  event.launchDetectionGraceMs = missionLaunchDetectionGraceMs;
  event.interstageLinkLossMs = missionInterstageLinkLossMs;
  event.stage1SeparationAngleDeg = missionStage1SeparationAngleDeg;
  event.stage1EjectionAngleDeg = missionStage1EjectionAngleDeg;
  event.stage2EjectionAngleDeg = missionStage2EjectionAngleDeg;
  flashLinkSendMissionEvent(event);
}

void missionBroadcastAbort(uint8_t reason) {
  if (!flashLinkMode || !flashLinkStage2Enabled || flashLinkGroundRole()) return;
  const uint32_t nowMs = millis();
  missionAbortBroadcast.active = true;
  missionAbortBroadcast.reason = reason ? reason : 1U;
  missionAbortBroadcast.sequenceId = launchMission.sequenceId;
  missionAbortBroadcast.eventSeq = launchMission.eventSeq;
  missionAbortBroadcast.untilMs = nowMs + 1000U;
  missionAbortBroadcast.lastTxMs = 0U;
}

void missionServiceAbortBroadcast(uint32_t nowMs) {
  if (!missionAbortBroadcast.active) return;
  if ((int32_t)(nowMs - missionAbortBroadcast.untilMs) > 0) {
    missionAbortBroadcast.active = false;
    return;
  }
  if (missionAbortBroadcast.lastTxMs != 0U &&
      (uint32_t)(nowMs - missionAbortBroadcast.lastTxMs) < kMissionEventRepeatMs) {
    return;
  }
  FlashLinkMissionEventV1 event{};
  event.sequenceId = missionAbortBroadcast.sequenceId;
  event.eventSeq = ++missionAbortBroadcast.eventSeq;
  event.eventAtMs = nowMs;
  event.code = static_cast<uint8_t>(MissionInterstageEventCode::MissionAbort);
  event.sourceNodeId = flashLinkLocalNodeId();
  event.flags = missionAbortBroadcast.reason;
  if (flashLinkSendMissionEvent(event)) {
    missionAbortBroadcast.lastTxMs = nowMs;
  }
}

void missionEnterArmContactFault(uint32_t nowMs) {
  if (launchMission.armContactFault) return;
  launchMission.armContactFault = true;

  // Once T+ is established, stopping the recovery mission because a released
  // mechanical contact bounced would be less safe than continuing. Report the
  // fault immediately but preserve the already-running flight sequence. In
  // every pre-launch/post-flight state, fail closed as before.
  const bool missionInFlight = launchMission.launchLatched &&
    launchMission.launchAuthorityConfirmed &&
    launchMission.state != LaunchMissionState::Complete &&
    launchMission.state != LaunchMissionState::Fault;
  if (missionInFlight) {
    missionEmitAlarm(
      0,
      "ARM contact fault",
      "ARM input is unstable during flight. Mission remains active; inspect connector, sensor and wiring after recovery.");
    missionSyncLaunchTelemetry();
    return;
  }

  launchMission.state = LaunchMissionState::Fault;
  missionLaunchStandby = false;
  sequenceUserWaiting = false;
  sequenceState = kSequenceStateFault;
  inspectionPassed = false;
  armLock = true;
  safetyMode = true;
  sequenceRelayHoldUntilMs = 0;
  sequenceRelayMask = 0;
  applyPyroOutputs(nowMs);
  missionEmitAlarm(
    0,
    "ARM contact fault",
    "ARM input is unstable. Inspect connector, sensor and wiring; safety mode enabled.");
  missionSyncLaunchTelemetry();
}

void missionLatchTplus(
  uint32_t launchMs,
  const char* reason,
  bool authorityConfirmed = true
) {
  if (launchMission.launchLatched) return;
  const uint32_t ignitionStartedMs =
    sequenceState == kSequenceStateFiring && sequenceFiringStartMs != 0U
      ? sequenceFiringStartMs
      : launchMission.ignitionStartMs;
  missionLaunchStandby = !authorityConfirmed;
  sequenceUserWaiting = false;
  sequenceState = kSequenceStateTplus;
  sequenceFiringStartMs = launchMs;
  sequenceFiringEndMs = 0;
  sequenceRelayHoldUntilMs = 0;
  sequenceRelayMask = 0;
  applyPyroOutputs(launchMs);

  launchMission.launchLatched = true;
  launchMission.launchAuthorityConfirmed = authorityConfirmed;
  launchMission.thrustLaunchProvisional = !authorityConfirmed;
  if (authorityConfirmed) launchMission.launchDetectionFault = false;
  launchMission.launchMs = launchMs;
  launchMission.ignitionStartMs = ignitionStartedMs;
  launchMission.thrustArmDeadlineMs = authorityConfirmed
    ? 0U
    : launchMs + kLaunchThrustArmConfirmMs;
  launchMission.state = missionIsStage2Node()
    ? LaunchMissionState::WaitingStage2Arm
    : LaunchMissionState::WaitingCoast;
  missionLastSequenceState = sequenceState;
  missionEmitAlarm(0, "T+ started", reason ? reason : "Stage-1 ARM released.");
  missionSyncLaunchTelemetry();
}

void missionConfirmThrustLaunchAuthority(uint32_t armReleasedMs) {
  if (!launchMission.launchLatched ||
      !launchMission.thrustLaunchProvisional ||
      launchMission.launchAuthorityConfirmed) {
    return;
  }
  launchMission.launchAuthorityConfirmed = true;
  launchMission.thrustLaunchProvisional = false;
  launchMission.thrustArmDeadlineMs = 0U;
  launchMission.launchDetectionFault = false;
  missionLaunchStandby = false;
  if (launchMission.ignitionStartMs != 0U &&
      armReleasedMs >= launchMission.ignitionStartMs) {
    launchMission.ignitionDelayMs =
      armReleasedMs - launchMission.ignitionStartMs;
  }
  missionEmitAlarm(
    0,
    "ARM authority confirmed",
    "Physical ARM release confirmed the thrust-detected T+.");
  missionSendInterstageEvent(
    MissionInterstageEventCode::Tplus,
    launchMission.launchMs,
    0);
  missionSyncLaunchTelemetry();
}

void missionRejectUnconfirmedThrustLaunch(uint32_t nowMs) {
  if (!launchMission.launchLatched ||
      !launchMission.thrustLaunchProvisional ||
      launchMission.launchAuthorityConfirmed) {
    return;
  }
  launchMission.launchLatched = false;
  launchMission.launchAuthorityConfirmed = false;
  launchMission.thrustLaunchProvisional = false;
  launchMission.launchDetectionFault = true;
  launchMission.launchMs = 0U;
  launchMission.thrustArmDeadlineMs = 0U;
  launchMission.state = LaunchMissionState::Standby;
  launchMission.coastSeen = false;
  launchMission.earlyCoast = false;
  launchMission.coastTimeout = false;
  launchMission.lastTplusEventTxMs = 0U;
  missionLaunchStandby = true;
  sequenceUserWaiting = true;
  sequenceState = kSequenceStateIdle;
  sequenceFiringStartMs = 0U;
  sequenceFiringEndMs = 0U;
  sequenceRelayHoldUntilMs = 0U;
  sequenceRelayMask = 0U;
  applyPyroOutputs(nowMs);
  missionEmitAlarm(
    0,
    "Launch validation fault",
    "No ARM release within 1 s of thrust; standby restored.");
  missionSyncLaunchTelemetry();
}

void missionCommandPrimaryDeployment(uint32_t nowMs) {
  const bool ok = setServoAngle(1U, missionStage1SeparationAngleDeg);
  launchMission.primaryFailed = !ok;
  launchMission.primaryCommandMs = nowMs;
  launchMission.stage1Separated = true;
  if (launchMission.forceTimed) launchMission.interstageFallback = true;
  launchMission.state = LaunchMissionState::WaitingStage2Arm;
  missionSendInterstageEvent(
    MissionInterstageEventCode::Stage1Separated,
    nowMs,
    (int32_t)(nowMs - launchMission.launchMs));
  if (!ok) {
    missionEmitAlarm(0, "Stage separation fault", "SERVO CH1 command failed.");
  } else if (launchMission.forceTimed) {
    missionEmitAlarm(0, "Forced separation", "Backup time reached. SERVO CH1 moved to configured angle.");
  } else if (launchMission.coastTimeout) {
    missionEmitAlarm(0, "Coasting backup", "No coasting by configured backup time. Separation executed.");
  } else if (launchMission.earlyCoast) {
    missionEmitAlarm(0, "Early coasting", "Filtered coasting confirmed. Separation executed.");
  } else {
    missionEmitAlarm(0, "Coasting confirmed", "SERVO CH1 moved to configured angle.");
  }
}

void missionCommandStage1Ejection(uint32_t nowMs) {
  if (launchMission.stage1Ejected) return;
  const bool ok = setServoAngle(2U, missionStage1EjectionAngleDeg);
  launchMission.stage1Ejected = true;
  launchMission.secondaryCommanded = true;
  launchMission.secondaryFailed = !ok;
  launchMission.state = ok && !launchMission.primaryFailed
    ? LaunchMissionState::Complete
    : LaunchMissionState::Fault;
  missionEmitAlarm(
    0,
    ok ? "Stage-1 ejection" : "Stage-1 ejection fault",
    ok ? "SERVO CH2 moved to configured angle." : "SERVO CH2 command failed.");
  if (ok) buzzerPlayRecoveryFindMelody();
  missionSyncLaunchTelemetry();
}

void missionCommandStage2Ignition(uint32_t nowMs) {
  if (launchMission.stage2Ignited || safetyMode) return;
  launchMission.stage2Ignited = true;
  launchMission.stage2IgnitionMs = nowMs;
  launchMission.state = LaunchMissionState::WaitingStage2Ejection;
  sequenceRelayMask = pyroMaskForChannel(1U);
  sequenceRelayHoldUntilMs = nowMs + ignitionDurationMs;
  applyPyroOutputs(nowMs);
  missionSendInterstageEvent(
    MissionInterstageEventCode::Stage2Ignited,
    nowMs,
    (int32_t)(nowMs - launchMission.launchMs));
  missionEmitAlarm(0, "Stage-2 ignition", "PYRO CH1 ignition output started.");
}

void missionCommandStage2Ejection(uint32_t nowMs) {
  if (launchMission.stage2Ejected) return;
  const bool ok = setServoAngle(1U, missionStage2EjectionAngleDeg);
  launchMission.stage2Ejected = true;
  launchMission.secondaryCommanded = true;
  launchMission.secondaryFailed = !ok;
  launchMission.state = ok ? LaunchMissionState::Complete : LaunchMissionState::Fault;
  missionEmitAlarm(
    0,
    ok ? "Stage-2 ejection" : "Stage-2 ejection fault",
    ok ? "SERVO CH1 moved to configured angle." : "SERVO CH1 command failed.");
  if (ok) buzzerPlayRecoveryFindMelody();
  missionSyncLaunchTelemetry();
}

bool startForcedTimedMissionRuntime(uint32_t nowMs) {
  if (!flashLinkMissionRoleEnabled() || safetyMode ||
      sequenceState != kSequenceStateIdle ||
      sequenceUserWaiting) {
    return false;
  }

  flightPhaseResetRuntime();
  missionResetLaunchRuntime(nowMs);
  sequenceAborted = false;
  sequenceAbortReason = 0;
  sequenceState = kSequenceStateTplus;
  sequenceUserWaiting = false;
  sequenceCountdownEndMs = 0;
  sequenceCountdownTotalMs = 0;
  sequenceFiringStartMs = nowMs;
  sequenceFiringEndMs = 0;
  sequenceRelayHoldUntilMs = 0;
  sequenceRelayMask = 0;
  applyPyroOutputs(nowMs);

  launchMission.forceTimed = true;
  launchMission.ignitionStartMs = nowMs;
  launchMission.ignitionDelayMs = 0;
  missionLatchTplus(nowMs, "Forced timed mission started without PYRO output.");
  missionEmitAlarm(
    0,
    "Forced timed mission",
    "Virtual T+ started. No pyro output; CH1/CH2 servo schedule is active.");
  missionSyncLaunchTelemetry();
  Serial.printf("[MISSION] forced timed start T+0 pyro=off separation=%lums\n",
                (unsigned long)missionStage1SeparationBackupMs);
  return true;
}

MissionStandbyResult startMissionStandbyRuntime(uint32_t nowMs) {
  if (!flashLinkMissionRoleEnabled()) {
    return MissionStandbyResult::PermissionDenied;
  }

  // A board that boots or receives this command with the physical ARM already
  // released must never become launch-sensitive. Revoke mission authority and
  // force both software interlocks on; the operator must inspect and re-arm the
  // vehicle before another standby request can be accepted.
  if (!missionArmMechanismInstalled()) {
    clearSequenceRuntime();
    inspectionPassed = false;
    armLock = true;
    safetyMode = true;
    applyPyroOutputs(nowMs);
    missionEmitAlarm(
      0,
      "ARM unsafe",
      "Mission standby rejected. ARM/separation mechanism is released; safety mode enabled.");
    Serial.printf("[MISSION] standby rejected arm_pin=%s stage2_hall=%u safe=1 arm_lock=1 inspection=0\n",
                  armSwitchPhysicalOn() ? "HIGH" : "LOW",
                  missionUsesStage2HallPolarity() ? 1U : 0U);
    return MissionStandbyResult::ArmUnsafe;
  }

  if (safetyMode) return MissionStandbyResult::SafetyMode;
  if (armLock) return MissionStandbyResult::PermissionDenied;
  if (!inspectionPassed) return MissionStandbyResult::PermissionDenied;
  if (sequenceState != kSequenceStateIdle || sequenceUserWaiting) {
    return MissionStandbyResult::Busy;
  }

  flightPhaseResetRuntime();
  missionResetLaunchRuntime(nowMs);
  sequenceAborted = false;
  sequenceAbortReason = 0;
  sequenceState = kSequenceStateIdle;
  sequenceUserWaiting = true;
  missionLaunchStandby = true;
  sequenceFiringStartMs = 0;
  sequenceFiringEndMs = 0;
  sequenceCountdownEndMs = 0;
  sequenceCountdownTotalMs = 0;
  sequenceRelayHoldUntilMs = 0;
  sequenceRelayMask = 0;
  applyPyroOutputs(nowMs);
  launchMission.state = LaunchMissionState::Standby;
  launchMission.standbyStartedMs = nowMs;
  missionEmitAlarm(
    0,
    "Mission standby",
    "Waiting for physical ARM release or thrust-flight detection.");
  if (missionIsStage1Node()) {
    missionSendInterstageEvent(MissionInterstageEventCode::Standby, nowMs, 0);
    launchMission.lastStandbyEventTxMs = nowMs;
  }
  missionSyncLaunchTelemetry();
  Serial.println("[MISSION] standby active ignition=wired launch_gate=arm_or_thrust arm_authority=required pyro=off");
  return MissionStandbyResult::Started;
}

void missionHandleInterstageEvent(
  const FlashLinkMissionEventV1& event,
  uint8_t sourceNodeId,
  uint32_t receivedAtMs
) {
  if (!flashLinkStage2Enabled || event.sequenceId == 0U) return;
  const MissionInterstageEventCode code =
    static_cast<MissionInterstageEventCode>(event.code);

  if (missionIsStage2Node() && sourceNodeId == kFlashLinkNodeIdStage1) {
    if (code == MissionInterstageEventCode::Standby) {
      if (launchMission.launchLatched) return;
      const uint32_t nextStage1SeparationMs = clampU32(
        (long)event.stage1SeparationBackupMs,
        500,
        15000,
        kDefaultMissionStage1SeparationBackupMs);
      const uint32_t nextStage1EjectionMs = clampU32(
        (long)event.stage1EjectionDelayMs, 100, 10000, 1000U);
      const uint32_t nextStage2EjectionMs = clampU32(
        (long)event.stage2EjectionDelayMs, 500, 30000, 5000U);
      const uint32_t nextLaunchGraceMs = clampU32(
        (long)event.launchDetectionGraceMs, 1000, 30000, 5000U);
      const uint32_t nextLinkLossMs = clampU32(
        (long)event.interstageLinkLossMs, 200, 5000, 500U);
      const uint8_t nextStage1SeparationAngle =
        clampServoAngle((long)event.stage1SeparationAngleDeg);
      const uint8_t nextStage1EjectionAngle =
        clampServoAngle((long)event.stage1EjectionAngleDeg);
      const uint8_t nextStage2EjectionAngle =
        clampServoAngle((long)event.stage2EjectionAngleDeg);
      const bool settingsChanged =
        missionStage1SeparationBackupMs != nextStage1SeparationMs ||
        missionStage1EjectionDelayMs != nextStage1EjectionMs ||
        missionStage2EjectionDelayMs != nextStage2EjectionMs ||
        missionLaunchDetectionGraceMs != nextLaunchGraceMs ||
        missionInterstageLinkLossMs != nextLinkLossMs ||
        missionStage1SeparationAngleDeg != nextStage1SeparationAngle ||
        missionStage1EjectionAngleDeg != nextStage1EjectionAngle ||
        missionStage2EjectionAngleDeg != nextStage2EjectionAngle;
      missionStage1SeparationBackupMs = nextStage1SeparationMs;
      missionStage1EjectionDelayMs = nextStage1EjectionMs;
      missionStage2EjectionDelayMs = nextStage2EjectionMs;
      missionLaunchDetectionGraceMs = nextLaunchGraceMs;
      missionInterstageLinkLossMs = nextLinkLossMs;
      missionStage1SeparationAngleDeg = nextStage1SeparationAngle;
      missionStage1EjectionAngleDeg = nextStage1EjectionAngle;
      missionStage2EjectionAngleDeg = nextStage2EjectionAngle;
      if (settingsChanged) saveSequenceSettings();
      if (!missionLaunchStandby && !launchMission.launchLatched) {
        const MissionStandbyResult result = startMissionStandbyRuntime(receivedAtMs);
        if (result != MissionStandbyResult::Started) return;
      }
      launchMission.sequenceId = event.sequenceId;
      return;
    }
    if (code == MissionInterstageEventCode::Tplus) {
      if (launchMission.launchLatched &&
          event.sequenceId != launchMission.sequenceId) return;
      if (!missionLaunchStandby && !launchMission.launchLatched &&
          missionArmMechanismInstalled()) {
        const MissionStandbyResult result = startMissionStandbyRuntime(receivedAtMs);
        if (result == MissionStandbyResult::Started) {
          launchMission.sequenceId = event.sequenceId;
        }
      }
      if (!launchMission.launchLatched && missionLaunchStandby) {
        const uint32_t elapsed = event.tplusMs > 0 ? (uint32_t)event.tplusMs : 0U;
        const uint32_t localLaunchMs = receivedAtMs >= elapsed
          ? receivedAtMs - elapsed
          : receivedAtMs;
        launchMission.sequenceId = event.sequenceId;
        missionLatchTplus(localLaunchMs, "Stage-1 T+ event received.");
      }
      return;
    }
    if (code == MissionInterstageEventCode::Stage1Separated) {
      if (launchMission.launchLatched &&
          event.sequenceId != launchMission.sequenceId) return;
      if (!launchMission.launchLatched && missionLaunchStandby) {
        const uint32_t elapsed = event.tplusMs > 0 ? (uint32_t)event.tplusMs : 0U;
        launchMission.sequenceId = event.sequenceId;
        missionLatchTplus(
          receivedAtMs >= elapsed ? receivedAtMs - elapsed : receivedAtMs,
          "Stage-1 separation event recovered missing T+ event.");
      }
      if (!launchMission.launchLatched) return;
      launchMission.stage1Separated = true;
      return;
    }
    if (code == MissionInterstageEventCode::MissionAbort &&
        event.sequenceId == launchMission.sequenceId) {
      abortSequenceRuntimeFromInterstage(3U);
    }
    return;
  }

  if (missionIsStage1Node() && sourceNodeId == kFlashLinkNodeIdStage2) {
    if (code == MissionInterstageEventCode::MissionAbort &&
        event.sequenceId == launchMission.sequenceId) {
      abortSequenceRuntimeFromInterstage(3U);
      return;
    }
    if (code == MissionInterstageEventCode::Stage2ArmReleased &&
        event.sequenceId == launchMission.sequenceId &&
        launchMission.launchLatched && launchMission.stage1Separated) {
      if (!launchMission.stage2ArmReleased) {
        launchMission.stage2ArmReleased = true;
        launchMission.stage2ArmReleasedMs = receivedAtMs;
        missionEmitAlarm(0, "Stage-2 separation confirmed", "Remote ARM release received.");
      }
    }
  }
}

void missionLaunchSequenceTick(uint32_t nowMs, bool armReleased, uint32_t armReleasedMs) {
  if (launchMission.armChatterCount >= kLaunchArmChatterTransitions &&
      flashLinkMissionRoleEnabled()) {
    missionEnterArmContactFault(nowMs);
    return;
  }

  const bool stage1ThrustEvidenceAvailable =
    missionIsStage1Node() &&
    flightPhaseRuntime.phase == FlightPhase::PoweredFlight &&
    flightPhaseRuntime.launchEvidenceAtMs != 0U &&
    snap.flightTransitionReason ==
      static_cast<uint8_t>(FlightTransitionReason::LaunchAcceleration);

  if (missionIsStage1Node() &&
      launchMission.thrustLaunchProvisional &&
      launchMission.thrustArmDeadlineMs != 0U &&
      (int32_t)(nowMs - launchMission.thrustArmDeadlineMs) >= 0 &&
      (!armReleased || armReleasedMs > launchMission.thrustArmDeadlineMs)) {
    missionRejectUnconfirmedThrustLaunch(nowMs);
  }

  if (armReleased) {
    if (missionIsStage1Node()) {
      if (launchMission.thrustLaunchProvisional &&
          armReleasedMs <= launchMission.thrustArmDeadlineMs) {
        missionConfirmThrustLaunchAuthority(armReleasedMs);
      } else if (missionLaunchStandby &&
                 !launchMission.launchLatched &&
                 !launchMission.launchDetectionFault) {
        if (stage1ThrustEvidenceAvailable &&
            flightPhaseRuntime.launchEvidenceAtMs < armReleasedMs) {
          missionLatchTplus(
            flightPhaseRuntime.launchEvidenceAtMs,
            "Thrust flight preceded ARM release; validating mission authority.",
            false);
          missionConfirmThrustLaunchAuthority(armReleasedMs);
        } else {
          if (sequenceFiringStartMs != 0U && armReleasedMs >= sequenceFiringStartMs) {
            launchMission.ignitionStartMs = sequenceFiringStartMs;
            launchMission.ignitionDelayMs = armReleasedMs - sequenceFiringStartMs;
          }
          missionLatchTplus(
            armReleasedMs,
            "Stage-1 physical ARM released; T+ established with mission authority.");
          missionSendInterstageEvent(MissionInterstageEventCode::Tplus, armReleasedMs, 0);
        }
      }
    } else if (missionIsStage2Node() &&
               (missionLaunchStandby || launchMission.launchLatched) &&
               !launchMission.stage2ArmReleased) {
      launchMission.stage2ArmReleased = true;
      launchMission.stage2ArmReleasedMs = armReleasedMs;
      if (launchMission.launchLatched) {
        missionSendInterstageEvent(
          MissionInterstageEventCode::Stage2ArmReleased,
          armReleasedMs,
          (int32_t)(armReleasedMs - launchMission.launchMs));
        missionEmitAlarm(0, "Stage-2 separation", "Hall sensor confirmed magnet departure.");
      }
    }
  }

  if (missionIsStage1Node() &&
      missionLaunchStandby &&
      !launchMission.launchLatched &&
      !launchMission.launchDetectionFault &&
      stage1ThrustEvidenceAvailable) {
    missionLatchTplus(
      flightPhaseRuntime.launchEvidenceAtMs,
      "Thrust flight detected; waiting up to 1 s for physical ARM release.",
      false);
  }

  if (!launchMission.launchLatched && sequenceState == kSequenceStateWaitingLaunch) {
    if (launchMission.waitingLaunchSinceMs == 0U) {
      launchMission.waitingLaunchSinceMs = nowMs;
    } else if (!launchMission.launchDetectionFault &&
               (uint32_t)(nowMs - launchMission.waitingLaunchSinceMs) >=
                 missionLaunchDetectionGraceMs) {
      launchMission.launchDetectionFault = true;
      sequenceState = kSequenceStateFault;
      missionEmitAlarm(
        0,
        "Launch detection fault",
        "Ignition ended without stage-1 ARM release. Keep clear of the vehicle.");
    }
  }

  if (missionIsStage2Node() && missionLaunchStandby &&
      !launchMission.launchLatched && !missionInterstageLinkHealthy(nowMs)) {
    const bool poweredMotion = isfinite(snap.flightRawAccelMagnitudeG) &&
      snap.flightRawAccelMagnitudeG >= kFlightLaunchAccelG;
    if (poweredMotion) {
      if (launchMission.localMotionSinceMs == 0U) launchMission.localMotionSinceMs = nowMs;
      if ((uint32_t)(nowMs - launchMission.localMotionSinceMs) >= kFlightLaunchHoldMs) {
        launchMission.interstageFallback = true;
        missionLatchTplus(launchMission.localMotionSinceMs,
                          "Stage link lost; local powered-flight fallback established T+.");
      }
    } else {
      launchMission.localMotionSinceMs = 0U;
    }
  }

  if (missionIsStage1Node() &&
      launchMission.launchLatched &&
      launchMission.launchAuthorityConfirmed) {
    const uint32_t elapsedMs = nowMs - launchMission.launchMs;
    if (!launchMission.stage1Separated) {
      const bool coasting =
        snap.flightPhase == static_cast<uint8_t>(FlightPhase::Coasting);
      if (coasting && !launchMission.coastSeen) {
        launchMission.coastSeen = true;
        launchMission.earlyCoast = elapsedMs <= kLaunchEarlyCoastMs;
        missionCommandPrimaryDeployment(nowMs);
      } else if (elapsedMs >= missionStage1SeparationBackupMs) {
        if (!launchMission.coastSeen) launchMission.coastTimeout = true;
        missionCommandPrimaryDeployment(nowMs);
      }
    }

    if (launchMission.stage1Separated && !launchMission.stage1Ejected) {
      if (!launchMission.stage2ArmReleased &&
          flashLinkRelay.stage2TelemetryValid &&
          (flashLinkRelay.stage2Telemetry.flags & (1U << 13)) == 0U) {
        launchMission.stage2ArmReleased = true;
        launchMission.stage2ArmReleasedMs = nowMs;
        missionEmitAlarm(
          0,
          "Stage-2 separation confirmed",
          "Remote telemetry confirms physical ARM release.");
      }
      if (!launchMission.interstageFallback && !missionInterstageLinkHealthy(nowMs)) {
        launchMission.interstageFallback = true;
        missionEmitAlarm(
          0,
          "Interstage link lost",
          "Stage-1 ejection fallback uses separation time.");
      }
      const uint32_t ejectionBaseMs = launchMission.interstageFallback
        ? launchMission.primaryCommandMs
        : launchMission.stage2ArmReleasedMs;
      const bool ejectionAuthorized = launchMission.interstageFallback ||
        launchMission.stage2ArmReleased;
      if (ejectionAuthorized &&
          (uint32_t)(nowMs - ejectionBaseMs) >= missionStage1EjectionDelayMs) {
        missionCommandStage1Ejection(nowMs);
      }
    }
  }

  if (missionIsStage2Node() && launchMission.launchLatched) {
    const bool separationAuthorized = launchMission.interstageFallback ||
      launchMission.stage1Separated;
    if (!launchMission.stage2Ignited && launchMission.stage2ArmReleased &&
        separationAuthorized) {
      missionCommandStage2Ignition(nowMs);
    }
    if (launchMission.stage2Ignited && !launchMission.stage2Ejected &&
        (uint32_t)(nowMs - launchMission.stage2IgnitionMs) >=
          missionStage2EjectionDelayMs) {
      missionCommandStage2Ejection(nowMs);
    }
  }

  if (missionIsStage1Node() && launchMission.launchLatched &&
      launchMission.launchAuthorityConfirmed &&
      !launchMission.stage1Ejected &&
      (launchMission.lastTplusEventTxMs == 0U ||
       (uint32_t)(nowMs - launchMission.lastTplusEventTxMs) >= kMissionEventRepeatMs)) {
    launchMission.lastTplusEventTxMs = nowMs;
    missionSendInterstageEvent(
      MissionInterstageEventCode::Tplus,
      launchMission.launchMs,
      (int32_t)(nowMs - launchMission.launchMs));
  }
  if (missionIsStage1Node() && launchMission.stage1Separated &&
      !launchMission.stage1Ejected &&
      (launchMission.lastSeparationEventTxMs == 0U ||
       (uint32_t)(nowMs - launchMission.lastSeparationEventTxMs) >= kMissionEventRepeatMs)) {
    launchMission.lastSeparationEventTxMs = nowMs;
    missionSendInterstageEvent(
      MissionInterstageEventCode::Stage1Separated,
      launchMission.primaryCommandMs,
      (int32_t)(nowMs - launchMission.launchMs));
  }
  if (missionIsStage2Node() && launchMission.stage2ArmReleased &&
      !launchMission.stage2Ejected &&
      (launchMission.lastStage2ArmEventTxMs == 0U ||
       (uint32_t)(nowMs - launchMission.lastStage2ArmEventTxMs) >= kMissionEventRepeatMs)) {
    launchMission.lastStage2ArmEventTxMs = nowMs;
    missionSendInterstageEvent(
      MissionInterstageEventCode::Stage2ArmReleased,
      launchMission.stage2ArmReleasedMs,
      (int32_t)(nowMs - launchMission.launchMs));
  }
  missionSyncLaunchTelemetry();
}

bool missionExecuteAction(MissionRuntimeBlock& block, uint16_t blockIndex, uint32_t nowMs) {
  MissionAction& action = block.action;
  bool ok = true;
  switch (action.type) {
    case MissionActionType::Servo:
      ok = setServoAngle(
        action.channel,
        (uint8_t)constrain(action.value, 0, 180));
      break;
    case MissionActionType::Pyro:
      if (safetyMode) {
        Serial.printf("[MISSION] block %u pyro blocked: SAFETY_MODE\n", (unsigned)blockIndex);
        return false;
      }
      sequenceRelayMask = pyroMaskForChannel(clampPyroChannel(action.channel));
      sequenceRelayHoldUntilMs = nowMs + constrain(action.durationMs, 10U, 3000U);
      applyPyroOutputs(nowMs);
      break;
    case MissionActionType::Buzzer:
      buzzerPlayTone((uint16_t)constrain(action.value, 1, 10000), 0);
      break;
    case MissionActionType::FindBuzzer:
      buzzerPlayFindMelody(false);
      break;
    case MissionActionType::StopBuzzer:
      buzzerStop();
      break;
    case MissionActionType::Alarm:
      missionEmitAlarm(blockIndex, action.title, action.message);
      break;
    case MissionActionType::VariableSet:
      if (action.variable >= 0) missionVariables[action.variable] = action.value;
      break;
    case MissionActionType::VariableAdd:
      if (action.variable >= 0) missionVariables[action.variable] += action.value;
      break;
    case MissionActionType::VariableAverage:
      if (action.variable >= 0) {
        missionVariables[action.variable] = (int32_t)lroundf(snap.altM);
      }
      break;
    default:
      return false;
  }
  Serial.printf("[MISSION] block %u action=%u ch=%u value=%ld result=%s\n",
                (unsigned)blockIndex,
                (unsigned)action.type,
                (unsigned)action.channel,
                (long)action.value,
                ok ? "ok" : "failed");
  return ok;
}

void missionRuntimeTick() {
  const uint32_t nowUs = micros();
  if ((uint32_t)(nowUs - missionLastTickUs) < kMissionTickPeriodUs) return;
  missionLastTickUs = nowUs;
  const uint32_t nowMs = millis();
  missionServiceAbortBroadcast(nowMs);
  uint32_t armReleasedMs = 0;
  const bool debouncedArmReleased = missionUpdateArmSwitch(nowMs, armReleasedMs);
  const uint8_t switchNow = launchMission.armStableOn ? 1U : 0U;
  const bool switchRising = missionLastSwitch == 0U && switchNow == 1U;
  const bool switchFalling = missionLastSwitch == 1U && switchNow == 0U;
  const bool sequenceStart =
    missionLastSequenceState == kSequenceStateIdle &&
    (sequenceState == kSequenceStateCountdown || sequenceState == kSequenceStateFiring);
  if (sequenceStart) {
    flightPhaseResetRuntime();
    missionResetLaunchRuntime(nowMs);
    launchMission.state = LaunchMissionState::Standby;
    launchMission.standbyStartedMs = nowMs;
  }
  if (missionIsStage1Node() && missionLaunchStandby &&
      !launchMission.launchLatched &&
      (launchMission.lastStandbyEventTxMs == 0U ||
       (uint32_t)(nowMs - launchMission.lastStandbyEventTxMs) >= 250U)) {
    launchMission.lastStandbyEventTxMs = nowMs;
    missionSendInterstageEvent(MissionInterstageEventCode::Standby, nowMs, 0);
  }
  missionLaunchSequenceTick(nowMs, debouncedArmReleased, armReleasedMs);

  for (uint8_t i = 0; i < 8; ++i) {
    const int32_t current = missionVariables[i];
    const int32_t previous = missionPreviousVariables[i];
    missionVariableUpCount[i] = current > previous
      ? (uint16_t)min<uint32_t>(UINT16_MAX, missionVariableUpCount[i] + 1U)
      : 0U;
    missionVariableDownCount[i] = current < previous
      ? (uint16_t)min<uint32_t>(UINT16_MAX, missionVariableDownCount[i] + 1U)
      : 0U;
    missionPreviousVariables[i] = current;
  }

  for (uint8_t i = 0; i < missionRuntimeBlockCount; ++i) {
    MissionRuntimeBlock& block = missionRuntimeBlocks[i];
    if (!block.enabled || (block.once && block.fired)) continue;
    if (block.pending) {
      if ((int32_t)(nowMs - block.pendingAtMs) >= 0) {
        block.pending = false;
        const bool executed =
          missionExecuteAction(block, (uint16_t)(i + 1U), nowMs);
        if (block.once && executed) block.fired = true;
        if (!executed) block.lastWhen = false;
      }
      continue;
    }
    bool whenNow = true;
    for (uint8_t c = 0; c < block.conditionCount; ++c) {
      if (!missionConditionSatisfied(
            block.conditions[c], switchRising, switchFalling, sequenceStart, nowMs)) {
        whenNow = false;
        break;
      }
    }
    const bool triggered = whenNow && !block.lastWhen;
    block.lastWhen = whenNow;
    if (!triggered) continue;
    if (block.action.type == MissionActionType::Pyro && safetyMode) {
      block.lastWhen = false;
      continue;
    }
    block.pending = true;
    block.pendingAtMs = nowMs + block.delayMs;
    if (block.delayMs == 0U) {
      block.pending = false;
      const bool executed =
        missionExecuteAction(block, (uint16_t)(i + 1U), nowMs);
      if (block.once && executed) block.fired = true;
      if (!executed) block.lastWhen = false;
    }
  }
  missionLastSwitch = switchNow;
  missionLastSequenceState = sequenceState;
}
