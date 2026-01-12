#include <Arduino.h>

#include "config.h"
#include "io.h"
#include "loadcell.h"
#include "state.h"
#include "tasks.h"
#include "web_api.h"

// =======================================================
// ========================= SETUP ========================
// =======================================================
void setup() {
  Serial.begin(460800);

  setupPins();
  digitalWrite(led2, HIGH);

  initLoadcell();
  setupWebServer();

  tone(piezo, 900, 120);  delay(180);
  tone(piezo, 1300, 160); delay(220);
  tone(piezo, 1700, 200); delay(260);
  noTone(piezo);

  systemStartTime = millis();

  portENTER_CRITICAL(&stateMux);
  webPrecountMs = countdownDurationMs;
  portEXIT_CRITICAL(&stateMux);

  startTasks();

  Serial.println("[BOOT] Ready.");
}

// =======================================================
// ========================== LOOP ========================
// =======================================================
void loop() {
  pollSerialCommands();

  // JSON stream only when needed
  static uint32_t lastPrintMs = 0;
  const uint32_t now = millis();
  if (serialStream == 1 && (now - lastPrintMs) >= 12) { // ~80Hz
    lastPrintMs = now;
    static char json[768];
    const SampleSnap s = getLastSnapCopy();
    buildJson(json, sizeof(json), s);
    Serial.println(json);
  }

  delay(0);
}
