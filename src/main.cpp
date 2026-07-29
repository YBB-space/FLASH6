#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <SPI.h>
#include <Adafruit_LSM6DSOX.h>
#include <Adafruit_BMP280.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <Update.h>
#include "esp_now.h"
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "esp_rom_sys.h"
#include "esp_wifi.h"
#include "esp_heap_caps.h"
#include "mbedtls/base64.h"
#include "mbedtls/sha256.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include <cctype>
#include <cstring>

namespace {

#include "firmware/state.h"
#include "firmware/common.h"
#include "firmware/flash_link_identity.h"
#include "firmware/loadcell.h"
#include "firmware/control_modes_buzzer_button.h"
#include "firmware/pyro_servo_sequence.h"
#include "firmware/flash_storage.h"
#include "firmware/firmware_update.h"
#include "firmware/gps_sensors_files.h"
#include "firmware/flight_phase.h"
#include "firmware/mission_runtime.h"
#include "firmware/web_api.h"
#include "firmware/flash_link_wifi.h"
#include "firmware/serial_stream_status.h"

} // namespace

void setup() {
  bootResetReason = esp_reset_reason();
  bootRawResetReason = static_cast<uint8_t>(esp_rom_get_reset_reason(0));
  bootSessionId = esp_random();
  if (bootSessionId == 0U) bootSessionId = 1U;
  loopTaskHandle = xTaskGetCurrentTaskHandle();
  storageMutex = xSemaphoreCreateRecursiveMutex();
  fileSystemMutex = xSemaphoreCreateRecursiveMutex();
  bootMs = millis();
  pinMode(kLed, OUTPUT);
  pinMode(kArmSwitch, INPUT_PULLDOWN);
  digitalWrite(kLed, LOW);
  initPyroOutputs();
  buzzerBegin();
  loadBuzzerConfig();
  buzzerPlayBootMelody();

  // Load the role before sizing USB serial. Avionics normally has periodic
  // serial telemetry disabled, so reserving the ground station's active TX
  // queue there only reduces runtime heap.
  loadSequenceSettings();
#if ARDUINO_USB_MODE
  Serial.setRxBufferSize(kSerialRxBufferBytes);
#endif
  Serial.begin(kSerialBaud);
  Serial.setTimeout(2);
  Serial.setTxTimeoutMs(2);
#if ARDUINO_USB_MODE
  Serial.setTxBufferSize(
    serialStream ? kSerialTxBufferActiveBytes : kSerialTxBufferIdleBytes);
#endif
  delay(200);
  loadBoardIdentityAndBindings();
  Serial.printf("[BOOT] %s version=%s board=%s protocol=%s build=%s\n",
                kFirmwareProgram,
                kFirmwareVersion,
                kFirmwareBoard,
                kFirmwareProtocol,
                kFirmwareBuildId);
  Serial.printf("[BOOT] reset_reason=%s code=%u api_code=%u raw_code=%u\n",
                telemetryResetReasonName(),
                (unsigned)telemetryResetReasonCode(),
                (unsigned)bootResetReason,
                (unsigned)bootRawResetReason);
  Serial.printf("[BOOT] session=%lu\n", (unsigned long)bootSessionId);
  if (!storageMutex) {
    Serial.println("[W25Q] recursive mutex allocation failed; storage disabled");
  }
  if (!fileSystemMutex) {
    Serial.println("[LFS] recursive mutex allocation failed; mission storage disabled");
  }
  if (flashLinkGroundRole()) {
    setSerialStreamRequested(true);
    Serial.println("[FLASH_LINK] ground serial telemetry enabled");
  } else if (flashLinkAvionicsRole()) {
    applyDeveloperModeSerialPolicy();
    Serial.printf("[FLASH_LINK] avionics developer_mode=%u serial_telemetry=%u\n",
                  developerMode ? 1U : 0U,
                  serialStream ? 1U : 0U);
  }
  initFlashStorage();
  loadMissionRuntimeFromFlash();
  loadGyroZero();
  loadBaroConfig();
  if (!flashLinkGroundRole()) {
    initImu();
    initBarometer();
    sensorPinsRuntimeReady = true;
    updateSharedSensorPins();
    syncGpsTelemetry(true);
  } else {
    sensorPinsRuntimeReady = true;
    updateSharedSensorPins();
    Serial.println("[FLASH_LINK] ground role: local sensors disabled");
  }
  setupWifi();
  if (flashLinkMode) setupFlashLink();
  if (wifiApShouldRun()) {
    setupRoutes();
    server.begin();
    serverReady = true;
  }
  initBootButton();
  runtimeServicesReady = true;
  // A newly installed OTA image remains rollback-eligible until the complete
  // hardware/runtime setup above succeeds. Confirm it only at this point.
  const esp_err_t otaValidation = esp_ota_mark_app_valid_cancel_rollback();
  if (otaValidation == ESP_OK) {
    Serial.println("[OTA] running image validated");
  }
  if (serverReady) {
    Serial.println("[WEB] routes ready: /ws /data /data_full /gyro_zero /baro /gps");
  }
}

void loop() {
  const uint32_t nowMs = millis();
  pollSerial();
  updateSharedSensorPins();
  applyPyroOutputs(nowMs);
  // `pollSerial()` can start an OTA session in this same loop iteration.
  // Use a fresh timestamp here: comparing the pre-poll timestamp against the
  // newly-created session timestamp underflows uint32_t and used to trigger an
  // immediate TRANSFER_TIMEOUT before the first chunk could arrive.
  firmwareUpdateTick(millis());
  if (firmwareUpdateActive()) {
    // Async HTTP keeps running on its own task. USB OTA continues through
    // pollSerial() above; all unrelated sensor/link/storage work is paused.
    buzzerTick();
    delay(0);
    return;
  }
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
  wifiApWatchdogTick();
  bootButtonTick();
  storageTick();
  sendPeriodicTelemetry();
  blinkStatus();
  buzzerTick();

  if (pendingRestart && (int32_t)(nowMs - restartAtMs) >= 0) {
    Serial.println("[SYS] restarting");
    Serial.flush();
    ESP.restart();
  }

  delay(0);
}
