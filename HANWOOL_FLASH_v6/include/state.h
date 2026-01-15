#pragma once

#include <stdint.h>
#include <Arduino.h>
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"

// -------------------- system state --------------------
enum SystemState : uint8_t { ST_IDLE = 0, ST_COUNTDOWN = 1, ST_FIRING = 2 };
enum AbortReason : uint8_t { ABORT_NONE = 0, ABORT_USER = 1, ABORT_IGNITER = 2, ABORT_LOCKOUT = 3 };

// -------------------- snapshot --------------------
struct SampleSnap {
  float t;          // thrust
  float p;          // pressure (V)
  float iv;         // igniter sense (V)
  uint8_t  bp;      // battery percent (0-100)
  uint32_t ut;      // uptime ms
  uint16_t lt;      // sample loop period (ms)
  uint16_t ct;      // SamplerTask calc time (us)
  uint16_t hz;      // HX711 update Hz
  uint8_t  s;       // switch
  uint8_t  ic;      // ign_ok
  uint8_t  r;       // relay mask (bit0=rly1 bit1=rly2)
  uint8_t  gs;      // igs
  uint8_t  st;      // state
  uint16_t cd;      // countdown remaining ms
  int32_t  td;      // time delta ms (negative=to zero, positive=after)
  uint8_t  uw;      // user waiting
  uint8_t  ab;      // abort flag
  uint8_t  ar;      // abort reason
  uint8_t  m;       // mode (0=SERIAL, 1=WIFI station connected)
  uint8_t  rs;      // relaySafe enabled
  uint8_t  rf;      // relayFault latched (LOCKOUT)
  uint8_t  rm;      // relayFaultMask
  uint8_t  ss;      // serialStream
  uint8_t  sm;      // safety mode
};

// -------------------- globals --------------------
extern volatile int igs;
extern volatile int relaySafe;
extern volatile int relayFault;
extern volatile uint8_t relayFaultMask;
extern volatile uint8_t safetyMode;
extern volatile int serialStream;

extern volatile SystemState currentState;
extern volatile uint32_t stateStartTimeMs;
extern volatile uint32_t tPlusAnchorMs;
extern volatile uint32_t countdownDurationMs;
extern volatile uint32_t ignitionDurationMs;

extern volatile int webUserWaiting;
extern volatile int webAbortFlag;
extern volatile uint8_t webAbortReason;
extern volatile uint32_t webPrecountMs;
extern volatile uint8_t sequenceEndRequested;

extern volatile uint8_t tetrisBgmRequest;

extern unsigned long systemStartTime;

extern portMUX_TYPE stateMux;
extern portMUX_TYPE sampleMux;

// -------------------- helpers --------------------
SampleSnap getLastSnapCopy();
void updateLastSnap(const SampleSnap& snap);

bool isLocked(uint8_t* outMask = nullptr);
bool isSafetyOn();

void startCountdownNow(uint32_t now);
void startFiringNow(uint32_t now);
void setIdleAbort(uint8_t reason);
void endSequenceNow(uint32_t now);

void applySetKV(const String& key, const String& val);
void applyQueryLike(const String& queryPart);

void requestTetrisBgm();
