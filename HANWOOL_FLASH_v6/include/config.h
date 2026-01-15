#pragma once

#include <stdint.h>

extern const char* FW_PROGRAM;
extern const char* FW_PROG_VER;
extern const char* FW_PROG_BUILD;

extern const char* FW_VER_BUILD;
extern const char* FW_BOARD;
extern const char* FW_PROTOCOL;

static constexpr float ADC_TO_V = 3.3f / 4095.0f;

// Sample loop period for UI/logging
static constexpr uint32_t SAMPLE_PERIOD_MS = 10; // 100Hz snapshot
static constexpr uint32_t WS_PERIOD_US     = 12500; // 80Hz WebSocket push

// Loadcell noise filter
static constexpr uint8_t THRUST_MEDIAN_WINDOW = 5;   // odd recommended
static constexpr float THRUST_EMA_ALPHA = 0.2f;      // 0~1, lower is smoother

// RelaySafe confirm window
static constexpr uint32_t RELAYSAFE_CONFIRM_MS = 120;
