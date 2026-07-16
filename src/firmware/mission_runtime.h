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
constexpr uint32_t kLaunchCoastDeadlineMs = 2000U;
constexpr uint32_t kLaunchSecondaryDelayMs = 1000U;
constexpr uint8_t kLaunchDeployAngleDeg = 85U;

enum class LaunchMissionState : uint8_t {
  Idle = 0,
  WaitingCoast = 1,
  WaitingSecondary = 2,
  Complete = 3,
  Fault = 4,
};

struct LaunchMissionRuntime {
  LaunchMissionState state = LaunchMissionState::Idle;
  bool armRawOn = true;
  bool armStableOn = true;
  bool launchLatched = false;
  bool coastSeen = false;
  bool earlyCoast = false;
  bool coastTimeout = false;
  bool primaryFailed = false;
  bool secondaryCommanded = false;
  bool secondaryFailed = false;
  uint32_t armRawChangedMs = 0;
  uint32_t launchMs = 0;
  uint32_t ignitionStartMs = 0;
  uint32_t ignitionDelayMs = UINT32_MAX;
  uint32_t primaryCommandMs = 0;
};

LaunchMissionRuntime launchMission;

void missionCopyText(char* out, size_t outLen, const char* value, const char* fallback = "") {
  if (!out || outLen == 0) return;
  snprintf(out, outLen, "%s", value && value[0] ? value : fallback);
}

void missionSyncLaunchTelemetry() {
  snap.ignitionDelayMs = launchMission.ignitionDelayMs;
  snap.deploymentState = static_cast<uint8_t>(launchMission.state);
  snap.deploymentFlags = 0;
  if (launchMission.ignitionDelayMs != UINT32_MAX) snap.deploymentFlags |= 1U << 0;
  if (launchMission.earlyCoast) snap.deploymentFlags |= 1U << 1;
  if (launchMission.coastTimeout) snap.deploymentFlags |= 1U << 2;
  if (launchMission.primaryFailed) snap.deploymentFlags |= 1U << 3;
  if (launchMission.state == LaunchMissionState::Fault) snap.deploymentFlags |= 1U << 4;
  if (launchMission.secondaryCommanded) snap.deploymentFlags |= 1U << 5;
  if (launchMission.secondaryFailed) snap.deploymentFlags |= 1U << 6;
}

void missionResetLaunchRuntime(uint32_t nowMs) {
  const bool rawOn = armSwitchEffectiveOn();
  launchMission = LaunchMissionRuntime{};
  launchMission.armRawOn = rawOn;
  launchMission.armStableOn = rawOn;
  launchMission.armRawChangedMs = nowMs;
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

bool missionUpdateArmSwitch(uint32_t nowMs, uint32_t& fallingEdgeMs) {
  fallingEdgeMs = 0;
  const bool rawOn = armSwitchEffectiveOn();
  if (rawOn != launchMission.armRawOn) {
    launchMission.armRawOn = rawOn;
    launchMission.armRawChangedMs = nowMs;
  }
  if (rawOn == launchMission.armStableOn ||
      (uint32_t)(nowMs - launchMission.armRawChangedMs) < kLaunchArmDebounceMs) {
    return false;
  }
  const bool wasOn = launchMission.armStableOn;
  launchMission.armStableOn = rawOn;
  if (wasOn && !rawOn) {
    fallingEdgeMs = launchMission.armRawChangedMs;
    return true;
  }
  return false;
}

void missionCommandPrimaryDeployment(uint32_t nowMs) {
  const bool ok = setServoAngle(1U, kLaunchDeployAngleDeg);
  launchMission.primaryFailed = !ok;
  launchMission.primaryCommandMs = nowMs;
  launchMission.state = LaunchMissionState::WaitingSecondary;
  if (!ok) {
    missionEmitAlarm(0, "Servo 1 failed", "CH1 command failed. CH2 remains scheduled.");
  } else if (launchMission.coastTimeout) {
    missionEmitAlarm(0, "Coasting detect fail", "No coasting by T+2.0s. Backup deploy started.");
  } else if (launchMission.earlyCoast) {
    missionEmitAlarm(0, "Backup deployment", "Early-coast hold complete. CH1 set to 85 deg.");
  } else {
    missionEmitAlarm(0, "Coasting confirmed", "Coasting confirmed. CH1 set to 85 deg.");
  }
}

void missionLaunchSequenceTick(uint32_t nowMs, bool armFalling, uint32_t armFallingMs) {
  if (armFalling && !launchMission.launchLatched) {
    const bool ignitionStarted = sequenceFiringStartMs != 0U &&
      (sequenceState == kSequenceStateFiring || sequenceState == kSequenceStateTplus);
    if (ignitionStarted && (int32_t)(armFallingMs - sequenceFiringStartMs) >= 0) {
      launchMission.launchLatched = true;
      launchMission.state = LaunchMissionState::WaitingCoast;
      launchMission.launchMs = armFallingMs;
      launchMission.ignitionStartMs = sequenceFiringStartMs;
      launchMission.ignitionDelayMs = armFallingMs - sequenceFiringStartMs;
      char message[64];
      snprintf(message, sizeof(message), "ARM released. Ignition delay %lu ms.",
               (unsigned long)launchMission.ignitionDelayMs);
      missionEmitAlarm(0, "Launch detected", message);
    }
  }

  if (launchMission.state == LaunchMissionState::WaitingCoast) {
    const uint32_t elapsedMs = nowMs - launchMission.launchMs;
    const bool coasting =
      snap.flightPhase == static_cast<uint8_t>(FlightPhase::Coasting);
    if (elapsedMs >= kLaunchCoastDeadlineMs) {
      if (!launchMission.coastSeen) launchMission.coastTimeout = true;
      missionCommandPrimaryDeployment(nowMs);
    } else if (coasting && !launchMission.coastSeen) {
      launchMission.coastSeen = true;
      if (elapsedMs <= kLaunchEarlyCoastMs) {
        launchMission.earlyCoast = true;
        missionEmitAlarm(0, "Early coasting", "Coasting before T+1.5s. Deployment held.");
      } else if (elapsedMs <= kLaunchCoastDeadlineMs) {
        missionCommandPrimaryDeployment(nowMs);
      }
    }
  } else if (launchMission.state == LaunchMissionState::WaitingSecondary &&
             (uint32_t)(nowMs - launchMission.primaryCommandMs) >= kLaunchSecondaryDelayMs) {
    const bool ok = setServoAngle(2U, kLaunchDeployAngleDeg);
    launchMission.secondaryCommanded = true;
    launchMission.secondaryFailed = !ok;
    if (ok) {
      launchMission.state = launchMission.primaryFailed
        ? LaunchMissionState::Fault
        : LaunchMissionState::Complete;
      missionEmitAlarm(0, "Secondary deployment", "CH2 set to 85 deg. Mission sequence complete.");
    } else {
      launchMission.state = LaunchMissionState::Fault;
      missionEmitAlarm(0, "Servo 2 failed", "CH2 command failed. Check deployment system.");
    }
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
  uint32_t armFallingMs = 0;
  const bool debouncedArmFalling = missionUpdateArmSwitch(nowMs, armFallingMs);
  const uint8_t switchNow = launchMission.armStableOn ? 1U : 0U;
  const bool switchRising = missionLastSwitch == 0U && switchNow == 1U;
  const bool switchFalling = debouncedArmFalling ||
    (missionLastSwitch == 1U && switchNow == 0U);
  const bool sequenceStart =
    missionLastSequenceState == kSequenceStateIdle &&
    (sequenceState == kSequenceStateCountdown || sequenceState == kSequenceStateFiring);
  if (sequenceStart) {
    flightPhaseResetRuntime();
    missionResetLaunchRuntime(nowMs);
  }
  missionLaunchSequenceTick(nowMs, switchFalling, armFallingMs);

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
