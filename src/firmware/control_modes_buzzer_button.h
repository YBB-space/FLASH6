uint8_t flashLinkRoleCode() {
  return static_cast<uint8_t>(flashLinkRole);
}

bool flashLinkGroundRole() {
  return flashLinkMode && flashLinkRole == FlashLinkRole::Ground;
}

bool flashLinkAvionicsRole() {
  return flashLinkMode && flashLinkRole == FlashLinkRole::Avionics;
}

bool flashLinkStage1RelayRole() {
  return flashLinkAvionicsRole() && flashLinkNodeId == kFlashLinkNodeIdStage1;
}

bool flashLinkStage2LeafRole() {
  return flashLinkAvionicsRole() && flashLinkNodeId == kFlashLinkNodeIdStage2;
}

uint8_t clampFlashLinkVehicleNodeId(long value) {
  return value == kFlashLinkNodeIdStage2
    ? kFlashLinkNodeIdStage2
    : kFlashLinkNodeIdStage1;
}

uint8_t flashLinkLocalNodeId() {
  return flashLinkGroundRole() ? kFlashLinkNodeIdGround : flashLinkNodeId;
}

bool setFlashLinkNodeId(const String& value) {
  String node = value;
  node.trim();
  node.toLowerCase();
  node.replace('-', '_');
  if (node == "stage_1" || node == "stage1" || node == "first" || node == "1") {
    flashLinkNodeId = kFlashLinkNodeIdStage1;
    return true;
  }
  if (node == "stage_2" || node == "stage2" || node == "second" || node == "2") {
    flashLinkNodeId = kFlashLinkNodeIdStage2;
    return true;
  }
  return false;
}

wifi_interface_t flashLinkWifiInterface() {
  return WIFI_IF_STA;
}

bool setFlashLinkRole(const String& value) {
  String role = value;
  role.trim();
  role.toLowerCase();
  role.replace('-', '_');
  if (role == "ground" || role == "ground_station" || role == "station" || role == "gcs" || role == "1") {
    flashLinkRole = FlashLinkRole::Ground;
    return true;
  }
  if (role == "avionics" || role == "vehicle" || role == "air" || role == "0") {
    flashLinkRole = FlashLinkRole::Avionics;
    return true;
  }
  return false;
}

bool setFlashLinkDataMode(const String& value) {
  String mode = value;
  mode.trim();
  mode.toLowerCase();
  mode.replace('-', '_');
  if (mode == "flight" || mode == "1" || mode == "true" || mode == "on") {
    flashLinkDataFlightMode = true;
    return true;
  }
  if (mode == "daq" || mode == "0" || mode == "false" || mode == "off") {
    flashLinkDataFlightMode = false;
    return true;
  }
  return false;
}

bool setOperationMode(const String& value) {
  String mode = value;
  mode.trim();
  mode.toLowerCase();
  mode.replace('-', '_');
  if (mode == "flight" || mode == "1") {
    flightMode = true;
    flashLinkMode = false;
    return true;
  }
  if (mode == "flash_link" || mode == "flashlink" || mode == "link" || mode == "2") {
    flashLinkMode = true;
    return true;
  }
  if (mode == "daq" || mode == "0") {
    flightMode = false;
    flashLinkMode = false;
    return true;
  }
  return false;
}

void saveDeveloperMode() {
  if (!settingsPrefsReady) settingsPrefsReady = settingsPrefs.begin("settings", false);
  if (!settingsPrefsReady) return;
  if (settingsPrefs.getBool("dev", !developerMode) != developerMode) {
    settingsPrefs.putBool("dev", developerMode);
  }
}

void setSerialStreamRequested(bool enabled) {
  if (flashLinkGroundRole()) {
    enabled = true;
  } else if (flashLinkAvionicsRole() && !developerMode) {
    enabled = false;
  }
  serialStream = enabled;
  if (serialStream) lastSerialUs = 0;
}

void applyDeveloperModeSerialPolicy() {
  if (flashLinkGroundRole()) {
    setSerialStreamRequested(true);
    return;
  }
  if (flashLinkAvionicsRole()) {
    setSerialStreamRequested(developerMode);
    return;
  }
  setSerialStreamRequested(developerMode);
}

void setDeveloperMode(bool enabled, bool persist = true) {
  const bool changed = developerMode != enabled;
  developerMode = enabled;
  applyDeveloperModeSerialPolicy();
  if (persist && changed) saveDeveloperMode();
}

uint16_t clampBuzzerHz(long hz) {
  if (hz < kBuzzerMinHz) return kBuzzerMinHz;
  if (hz > kBuzzerMaxHz) return kBuzzerMaxHz;
  return (uint16_t)hz;
}

uint16_t clampBuzzerMs(long ms) {
  if (ms <= 0) return 0;
  if (ms > kBuzzerMaxPulseMs) return kBuzzerMaxPulseMs;
  return (uint16_t)ms;
}

void buzzerSilence() {
  if (buzzerToneInitialized) {
    ledcWriteTone(kBuzzerLedcChannel, 0);
    ledcWrite(kBuzzerLedcChannel, 0);
  }
}

void buzzerStop() {
  buzzerSilence();
  buzzer.notes = nullptr;
  buzzer.count = 0;
  buzzer.index = 0;
  buzzer.active = false;
  buzzer.steady = false;
  buzzer.noteOn = false;
  buzzer.loop = false;
  buzzer.nextMs = 0;
}

void buzzerBegin() {
  pinMode(kBuzzer, OUTPUT);
  digitalWrite(kBuzzer, LOW);
  buzzerToneInitialized =
    ledcSetup(
      kBuzzerLedcChannel,
      kBuzzerDefaultHz,
      kBuzzerLedcResolutionBits) > 0.0;
  if (buzzerToneInitialized) {
    ledcAttachPin(kBuzzer, kBuzzerLedcChannel);
  }
  buzzerStop();
}

void loadBuzzerConfig() {
  buzzerPrefsReady = buzzerPrefs.begin("buzzer", false);
  if (!buzzerPrefsReady) return;
  buzzerMuted = buzzerPrefs.getBool("mute", false);
}

void saveBuzzerConfig() {
  if (!buzzerPrefsReady) buzzerPrefsReady = buzzerPrefs.begin("buzzer", false);
  if (!buzzerPrefsReady) return;
  if (buzzerPrefs.getBool("mute", !buzzerMuted) != buzzerMuted) {
    buzzerPrefs.putBool("mute", buzzerMuted);
  }
}

void setBuzzerMuted(bool muted) {
  const bool changed = buzzerMuted != muted;
  buzzerMuted = muted;
  if (buzzerMuted) buzzerStop();
  if (changed) saveBuzzerConfig();
}

void buzzerStartCurrentNote(uint32_t nowMs) {
  if (!buzzer.active || !buzzer.notes || buzzer.count == 0) {
    buzzerStop();
    return;
  }
  if (buzzer.index >= buzzer.count) {
    if (buzzer.loop) {
      buzzer.index = 0;
    } else {
      buzzerStop();
      return;
    }
  }

  const BuzzerNote& note = buzzer.notes[buzzer.index];
  const uint16_t onMs = note.onMs > 0 ? note.onMs : 1;
  if (note.hz > 0 && buzzerToneInitialized) {
    ledcWriteTone(kBuzzerLedcChannel, clampBuzzerHz(note.hz));
  } else {
    buzzerSilence();
  }
  buzzer.noteOn = true;
  buzzer.nextMs = nowMs + onMs;
}

void buzzerPlayPattern(const BuzzerNote* notes, uint8_t count, bool loop) {
  if (buzzerMuted) {
    buzzerStop();
    return;
  }
  if (!notes || count == 0) {
    buzzerStop();
    return;
  }
  buzzerSilence();
  buzzer.notes = notes;
  buzzer.count = count;
  buzzer.index = 0;
  buzzer.active = true;
  buzzer.steady = false;
  buzzer.noteOn = false;
  buzzer.loop = loop;
  buzzer.nextMs = 0;
  buzzerStartCurrentNote(millis());
}

void buzzerPlayTone(uint16_t hz, uint16_t ms) {
  if (buzzerMuted) {
    buzzerStop();
    return;
  }
  hz = clampBuzzerHz(hz);
  ms = clampBuzzerMs(ms);
  if (ms == 0) {
    buzzerStop();
    buzzer.steady = true;
    if (buzzerToneInitialized) {
      ledcWriteTone(kBuzzerLedcChannel, hz);
    }
    return;
  }
  buzzerSingleNote[0] = {hz, ms, 0};
  buzzerPlayPattern(buzzerSingleNote, 1, false);
}

void buzzerPlayBootMelody() {
  if (buzzerMuted) return;
  buzzerPlayPattern(kBootMelody, sizeof(kBootMelody) / sizeof(kBootMelody[0]), false);
}

void buzzerPlayFlashLinkMelody() {
  buzzerPlayPattern(kFlashLinkMelody, sizeof(kFlashLinkMelody) / sizeof(kFlashLinkMelody[0]), false);
}

void buzzerPlayFlashLinkConnectedMelody() {
  buzzerPlayPattern(
    kFlashLinkConnectedMelody,
    sizeof(kFlashLinkConnectedMelody) / sizeof(kFlashLinkConnectedMelody[0]),
    false);
}

void buzzerPlayFlashLinkDisconnectedAlarm() {
  buzzerPlayPattern(
    kFlashLinkDisconnectedAlarm,
    sizeof(kFlashLinkDisconnectedAlarm) /
      sizeof(kFlashLinkDisconnectedAlarm[0]),
    true);
}

void buzzerPlayFindMelody(bool loop = false) {
  buzzerPlayPattern(kFindMelody, sizeof(kFindMelody) / sizeof(kFindMelody[0]), loop);
}

void buzzerPlayBootButtonMenuCue(uint8_t action) {
  if (action == 0) return;
  if (action > kBootButtonMaxActionClicks) action = kBootButtonMaxActionClicks;
  for (uint8_t i = 0; i < action; ++i) {
    bootButtonMenuCue[i] = {
      kBootButtonMenuBeepHz,
      kBootButtonMenuBeepMs,
      (uint16_t)(i + 1U < action ? kBootButtonMenuBeepGapMs : 0U),
    };
  }
  buzzerPlayPattern(bootButtonMenuCue, action, false);
}

void handleBootButtonClick(uint32_t nowMs) {
  if (bootButtonPressCount == 0 ||
      (uint32_t)(nowMs - bootButtonLastPressMs) > kBootButtonSequenceGapMs) {
    bootButtonPressCount = 0;
  }
  bootButtonLastPressMs = nowMs;
  if (bootButtonPressCount < kBootButtonMaxActionClicks) bootButtonPressCount++;

  buzzerPlayTone((uint16_t)(1180U + (uint16_t)bootButtonPressCount * 130U), 48);
  Serial.printf("[BOOT_BUTTON] clicks=%u/%u hold_to_run=%lums\n",
                (unsigned)bootButtonPressCount,
                (unsigned)kBootButtonMaxActionClicks,
                (unsigned long)kBootButtonConfirmHoldMs);
}

void buttonSequenceWarningTick(uint32_t nowMs) {
  if (!buttonSequenceWarningActive) return;
  const uint32_t elapsedMs = nowMs - buttonSequenceWarningStartMs;

  if (buttonSequenceWarningBeeps < 3U &&
      elapsedMs >= (uint32_t)buttonSequenceWarningBeeps * kButtonSequenceBeepIntervalMs) {
    buttonSequenceWarningBeeps++;
    buzzerPlayTone(1760, 130);
    Serial.printf("[BOOT_BUTTON] sequence warning beep=%u/3\n",
                  (unsigned)buttonSequenceWarningBeeps);
    return;
  }

  if (elapsedMs < kButtonSequenceWarningMs) return;
  buttonSequenceWarningActive = false;
  if (startCountdownRuntimeFor(nowMs, kButtonSequenceCountdownMs, false)) {
    Serial.println("[BOOT_BUTTON] 60s sequence started");
  } else {
    buzzerPlayTone(420, 260);
    Serial.println("[BOOT_BUTTON] 60s sequence start rejected");
  }
}

void dispatchBootButtonHoldAction(uint8_t action, uint32_t nowMs) {
  bootButtonPendingHoldAction = 0;
  bootButtonPendingHoldActionAtMs = 0;
  switch (action) {
    case 1:
    case 2:
      buzzerPlayTone((uint16_t)(1450U + action * 170U), 110);
      Serial.printf("[BOOT_BUTTON] action=%u reserved\n", (unsigned)action);
      break;

    case 3:
      setDeveloperMode(!developerMode);
      if (developerMode) {
        buzzerPlayPattern(
          kDeveloperOnMelody,
          sizeof(kDeveloperOnMelody) / sizeof(kDeveloperOnMelody[0]),
          false);
      } else {
        buzzerPlayPattern(
          kDeveloperOffMelody,
          sizeof(kDeveloperOffMelody) / sizeof(kDeveloperOffMelody[0]),
          false);
      }
      Serial.printf("[BOOT_BUTTON] action=3 developer_mode=%u debug_serial=%u serial_stream=%u\n",
                    developerMode ? 1U : 0U,
                    developerMode ? 1U : 0U,
                    serialStream ? 1U : 0U);
      Serial.printf("[DEBUG] mode=%s serial_output=%s source=boot_button action=3\n",
                    developerMode ? "ON" : "OFF",
                    serialStream ? "ON" : "OFF");
      Serial.printf("ACK DEBUG_MODE=%u SERIAL_STREAM=%u\n",
                    developerMode ? 1U : 0U,
                    serialStream ? 1U : 0U);
      break;

    case 4:
      if (buttonSequenceWarningActive || safetyMode || sequenceState != kSequenceStateIdle) {
        buzzerPlayTone(420, 260);
        Serial.printf("[BOOT_BUTTON] action=4 rejected warning=%u safety=%u state=%u\n",
                      buttonSequenceWarningActive ? 1U : 0U,
                      safetyMode ? 1U : 0U,
                      (unsigned)sequenceState);
        break;
      }
      buttonSequenceWarningActive = true;
      buttonSequenceWarningBeeps = 0;
      buttonSequenceWarningStartMs = nowMs;
      Serial.println("[BOOT_BUTTON] action=4 armed: 3s warning then 60s sequence");
      buttonSequenceWarningTick(nowMs);
      break;

    case 5:
      setOperationMode("flash_link");
      saveSequenceSettings();
      saveBootOnceMode("flash_link");
      buzzerPlayFlashLinkMelody();
      pendingRestart = true;
      restartAtMs = nowMs + 900U;
      Serial.printf("[BOOT_BUTTON] action=5 FLASH_LINK mode selected role=%s restart=1\n",
                    flashLinkRoleName());
      break;

    default:
      Serial.printf("[BOOT_BUTTON] action=%u ignored\n", (unsigned)action);
      break;
  }
}

void scheduleBootButtonHoldAction(uint8_t action, uint32_t nowMs) {
  if (action == 0 || action > kBootButtonMaxActionClicks) return;
  buzzerPlayBootButtonMenuCue(action);
  bootButtonPendingHoldAction = action;
  bootButtonPendingHoldActionAtMs =
    nowMs +
    (uint32_t)action * (kBootButtonMenuBeepMs + kBootButtonMenuBeepGapMs) +
    kBootButtonMenuActionDelayMs;
  Serial.printf("[BOOT_BUTTON] menu cue action=%u dispatch_in=%lums\n",
                (unsigned)action,
                (unsigned long)(bootButtonPendingHoldActionAtMs - nowMs));
}

void initBootButton() {
  pinMode(kBootButton, INPUT_PULLUP);
  const bool pressed = digitalRead(kBootButton) == LOW;
  bootButtonRawPressed = pressed;
  bootButtonStablePressed = pressed;
  bootButtonRawChangedMs = millis();
  bootButtonLastPressMs = 0;
  bootButtonPressedAtMs = 0;
  bootButtonPressCount = 0;
  bootButtonHoldAction = 0;
  bootButtonPendingHoldAction = 0;
  bootButtonPendingHoldActionAtMs = 0;
  bootButtonConfirmHoldActive = false;
  bootButtonConfirmHoldTriggered = false;
  Serial.printf("[BOOT_BUTTON] ready gpio=%d active_low=1\n", kBootButton);
}

void bootButtonTick() {
  const uint32_t nowMs = millis();
  buttonSequenceWarningTick(nowMs);
  if (bootButtonPendingHoldAction != 0 &&
      (int32_t)(nowMs - bootButtonPendingHoldActionAtMs) >= 0) {
    const uint8_t action = bootButtonPendingHoldAction;
    dispatchBootButtonHoldAction(action, nowMs);
  }
  const bool pressed = digitalRead(kBootButton) == LOW;
  if (pressed != bootButtonRawPressed) {
    bootButtonRawPressed = pressed;
    bootButtonRawChangedMs = nowMs;
  }

  if (pressed != bootButtonStablePressed &&
      (uint32_t)(nowMs - bootButtonRawChangedMs) >= kBootButtonDebounceMs) {
    bootButtonStablePressed = pressed;
    if (pressed) {
      bootButtonPressedAtMs = nowMs;
      bootButtonHoldAction = 0;
      bootButtonConfirmHoldActive =
        bootButtonPressCount >= 1U &&
        bootButtonPressCount <= kBootButtonMaxActionClicks &&
        (uint32_t)(nowMs - bootButtonLastPressMs) <= kBootButtonSequenceGapMs;
      if (bootButtonConfirmHoldActive) bootButtonHoldAction = bootButtonPressCount;
      bootButtonConfirmHoldTriggered = false;
      if (bootButtonConfirmHoldActive) {
        Serial.printf("[BOOT_BUTTON] action=%u hold started target=%lums\n",
                      (unsigned)bootButtonHoldAction,
                      (unsigned long)kBootButtonConfirmHoldMs);
      }
    } else {
      if (!bootButtonConfirmHoldTriggered) {
        if ((uint32_t)(nowMs - bootButtonPressedAtMs) <= kBootButtonMaxClickMs) {
          handleBootButtonClick(nowMs);
        } else {
          bootButtonPressCount = 0;
          Serial.printf("[BOOT_BUTTON] action=%u hold canceled\n",
                        (unsigned)bootButtonHoldAction);
        }
      }
      bootButtonPressedAtMs = 0;
      bootButtonHoldAction = 0;
      bootButtonConfirmHoldActive = false;
      bootButtonConfirmHoldTriggered = false;
    }
  }

  if (bootButtonStablePressed &&
      bootButtonConfirmHoldActive &&
      !bootButtonConfirmHoldTriggered &&
      (uint32_t)(nowMs - bootButtonPressedAtMs) >= kBootButtonConfirmHoldMs) {
    bootButtonConfirmHoldTriggered = true;
    bootButtonPressCount = 0;
    scheduleBootButtonHoldAction(bootButtonHoldAction, nowMs);
  }

  if (!bootButtonStablePressed &&
      bootButtonPressCount > 0 &&
      (uint32_t)(nowMs - bootButtonLastPressMs) > kBootButtonSequenceGapMs) {
    bootButtonPressCount = 0;
  }
}

void buzzerTick() {
  if (!buzzer.active || buzzer.steady) return;
  const uint32_t nowMs = millis();
  if ((int32_t)(nowMs - buzzer.nextMs) < 0) return;

  if (buzzer.noteOn) {
    buzzerSilence();
    buzzer.noteOn = false;
    const BuzzerNote& note = buzzer.notes[buzzer.index];
    if (note.gapMs > 0) {
      buzzer.nextMs = nowMs + note.gapMs;
      return;
    }
  }

  buzzer.index++;
  buzzerStartCurrentNote(nowMs);
}
