#include <Arduino.h>

#include "io.h"

void setLauncherDir(LauncherDir dir) {
  if (dir == LAUNCHER_UP) {
    fastWrite(launcher_in1, 1);
    fastWrite(launcher_in2, 0);
    fastWrite(launcher_ena, 1);
  } else if (dir == LAUNCHER_DOWN) {
    fastWrite(launcher_in1, 0);
    fastWrite(launcher_in2, 1);
    fastWrite(launcher_ena, 1);
  } else {
    fastWrite(launcher_ena, 0);
    fastWrite(launcher_in1, 0);
    fastWrite(launcher_in2, 0);
  }
}

void setupPins() {
  pinMode(led1, OUTPUT);
  pinMode(led2, OUTPUT);
  pinMode(rly1, OUTPUT);
  pinMode(rly2, OUTPUT);
  pinMode(switch1, INPUT);   // consider INPUT_PULLUP depending on wiring
  pinMode(ig_sens, INPUT);
  pinMode(piezo, OUTPUT);

  pinMode(pressure_sig, INPUT);
  pinMode(ign_adc_pin, INPUT);
  pinMode(launcher_ena, OUTPUT);
  pinMode(launcher_in1, OUTPUT);
  pinMode(launcher_in2, OUTPUT);
  setLauncherDir(LAUNCHER_STOP);

  analogReadResolution(12);
}
