#pragma once

#include "pins.h"
#include "driver/gpio.h"

static inline int fastRead(int pin) {
  return gpio_get_level((gpio_num_t)pin);
}

static inline void fastWrite(int pin, int level) {
  gpio_set_level((gpio_num_t)pin, level);
}

enum LauncherDir : uint8_t {
  LAUNCHER_STOP = 0,
  LAUNCHER_UP = 1,
  LAUNCHER_DOWN = 2,
};

void setLauncherDir(LauncherDir dir);
void setupPins();
