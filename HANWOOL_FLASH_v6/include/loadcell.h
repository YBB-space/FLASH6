#pragma once

#include <ESPAsyncWebServer.h>
#include "HX711.h"

extern HX711 hx711;
extern float thrust_cal_factor;
extern volatile float currentThrust;

void initLoadcell();
void handleLoadcellCal(AsyncWebServerRequest* request);
void handleLoadcellZero(AsyncWebServerRequest* request);
