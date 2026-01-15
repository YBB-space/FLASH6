#pragma once

#include <ESPAsyncWebServer.h>
#include "state.h"

extern AsyncWebServer server;
extern AsyncWebSocket ws;

void setupWebServer();
void buildJson(char* out, size_t outLen, const SampleSnap& s);
