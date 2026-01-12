#include <Arduino.h>
#include <Preferences.h>

#include "config.h"
#include "loadcell.h"
#include "pins.h"
#include "state.h"

static constexpr char LOADCELL_PREF_NS[] = "loadcell";
static constexpr char LOADCELL_PREF_SCALE[] = "scale";
static constexpr char LOADCELL_PREF_OFFSET[] = "offset";
static constexpr char LOADCELL_PREF_OFFSET_OK[] = "offset_ok";

HX711 hx711;
float thrust_cal_factor = 6510.0f;
volatile float currentThrust = 0.0f;

static Preferences loadcellPrefs;
static bool loadcellPrefsReady = false;
static long loadcellOffset = 0;
static bool loadcellOffsetValid = false;

void initLoadcell() {
  loadcellPrefsReady = loadcellPrefs.begin(LOADCELL_PREF_NS, false);
  if (loadcellPrefsReady) {
    const float storedScale = loadcellPrefs.getFloat(LOADCELL_PREF_SCALE, NAN);
    if (!isnan(storedScale) && !isinf(storedScale) && storedScale != 0.0f) {
      thrust_cal_factor = storedScale;
      Serial.printf("[CAL] Loaded scale: %.6f\n", thrust_cal_factor);
    } else {
      Serial.println("[CAL] Scale default");
    }
    loadcellOffsetValid = loadcellPrefs.getBool(LOADCELL_PREF_OFFSET_OK, false);
    if (loadcellOffsetValid) {
      loadcellOffset = loadcellPrefs.getLong(LOADCELL_PREF_OFFSET, 0);
      Serial.printf("[CAL] Loaded offset: %ld\n", loadcellOffset);
    }
  } else {
    Serial.println("[CAL] Prefs begin failed");
  }

  hx711.begin(hx711_dt, hx711_clk);
  hx711.set_gain(128);
  hx711.set_scale(thrust_cal_factor);
  if (loadcellOffsetValid) {
    hx711.set_offset(loadcellOffset);
  } else {
    hx711.tare();
    loadcellOffset = hx711.get_offset();
    loadcellOffsetValid = true;
    if (loadcellPrefsReady) {
      loadcellPrefs.putLong(LOADCELL_PREF_OFFSET, loadcellOffset);
      loadcellPrefs.putBool(LOADCELL_PREF_OFFSET_OK, true);
    }
  }
}

static void sendLockedHttp(AsyncWebServerRequest* request) {
  uint8_t mask = 0;
  isLocked(&mask);
  request->send(423, "text/plain", String("LOCKED_REBOOT_REQUIRED RM=") + (int)mask);
}

void handleLoadcellCal(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }

  if (!request->hasParam("weight")) {
    request->send(400, "text/plain", "NO_PARAM");
    return;
  }

  const float weight = request->getParam("weight")->value().toFloat();
  if (weight <= 0.0f || isnan(weight) || isinf(weight)) {
    request->send(400, "text/plain", "INVALID_WEIGHT");
    return;
  }
  if (!loadcellPrefsReady) {
    request->send(500, "text/plain", "PREFS_NOT_READY");
    return;
  }

  const uint32_t start = millis();
  while (!hx711.is_ready() && (millis() - start) < 800) { delay(5); }
  if (!hx711.is_ready()) {
    request->send(503, "text/plain", "HX711_NOT_READY");
    return;
  }

  const long raw = hx711.get_value(10);
  if (raw == 0) {
    request->send(500, "text/plain", "RAW_ZERO");
    return;
  }

  const float newScale = ((float)raw) / weight;
  if (newScale == 0.0f || isnan(newScale) || isinf(newScale)) {
    request->send(500, "text/plain", "INVALID_SCALE");
    return;
  }

  thrust_cal_factor = newScale;
  hx711.set_scale(thrust_cal_factor);
  loadcellPrefs.putFloat(LOADCELL_PREF_SCALE, thrust_cal_factor);

  request->send(200, "text/plain", String("SCALE=") + String(thrust_cal_factor, 6));
}

void handleLoadcellZero(AsyncWebServerRequest* request) {
  if (isLocked()) { sendLockedHttp(request); return; }
  if (!loadcellPrefsReady) {
    request->send(500, "text/plain", "PREFS_NOT_READY");
    return;
  }

  const uint32_t start = millis();
  while (!hx711.is_ready() && (millis() - start) < 800) { delay(5); }
  if (!hx711.is_ready()) {
    request->send(503, "text/plain", "HX711_NOT_READY");
    return;
  }

  hx711.tare(15);
  loadcellOffset = hx711.get_offset();
  loadcellOffsetValid = true;
  loadcellPrefs.putLong(LOADCELL_PREF_OFFSET, loadcellOffset);
  loadcellPrefs.putBool(LOADCELL_PREF_OFFSET_OK, true);

  request->send(200, "text/plain", String("OFFSET=") + String(loadcellOffset));
}
