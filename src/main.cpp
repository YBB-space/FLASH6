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
#include "esp_now.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_heap_caps.h"
#include "mbedtls/base64.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include <cctype>
#include <cstring>

namespace {

#include "firmware/state.h"
#include "firmware/common.h"
#include "firmware/loadcell.h"
#include "firmware/control_modes_buzzer_button.h"
#include "firmware/pyro_servo_sequence.h"
#include "firmware/flash_storage.h"
#include "firmware/gps_sensors_files.h"
#include "firmware/flight_phase.h"
#include "firmware/mission_runtime.h"
#include "firmware/web_api.h"
#include "firmware/flash_link_wifi.h"
#include "firmware/serial_stream_status.h"

} // namespace

void setup() {
  bootResetReason = esp_reset_reason();
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

  Serial.begin(kSerialBaud);
  Serial.setTimeout(2);
  Serial.setTxTimeoutMs(2);
#if ARDUINO_USB_MODE
  Serial.setTxBufferSize(16384);
#endif
  delay(200);
  Serial.println("[BOOT] Altis_Intelligent3_firmware1 board=Altis_Intelligent3_b3 protocol=Flash6-Intelligent-b2 build=v6 b2");
  Serial.printf("[BOOT] reset_reason=%s code=%u\n",
                resetReasonName(bootResetReason),
                (unsigned)bootResetReason);
  if (!storageMutex) {
    Serial.println("[W25Q] recursive mutex allocation failed; storage disabled");
  }
  if (!fileSystemMutex) {
    Serial.println("[LFS] recursive mutex allocation failed; mission storage disabled");
  }
  loadSequenceSettings();
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
    syncGpsTelemetry();
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
  if (serverReady) {
    Serial.println("[WEB] routes ready: /ws /data /data_full /gyro_zero /baro /gps");
  }
}

void loop() {
  const uint32_t nowMs = millis();
  pollSerial();
  updateSharedSensorPins();
  applyPyroOutputs(nowMs);
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
