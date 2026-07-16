constexpr float kFlightLaunchAccelG = 1.5f;
constexpr float kFlightLaunchSpeedMps = 5.0f;
constexpr uint32_t kFlightLaunchHoldMs = 100U;
constexpr uint32_t kFlightPoweredMinimumMs = 200U;
constexpr float kFlightCoastAccelG = 0.35f;
constexpr float kFlightCoastMinimumSpeedMps = 3.0f;
constexpr uint32_t kFlightCoastHoldMs = 250U;
constexpr float kFlightDescentDropM = 2.0f;
constexpr float kFlightDescentSpeedMps = -1.5f;
constexpr uint32_t kFlightDescentHoldMs = 500U;
constexpr float kFlightLandingMaxSpeedMps = 0.5f;
constexpr float kFlightLandingMinAccelG = 0.8f;
constexpr float kFlightLandingMaxAccelG = 1.2f;
constexpr float kFlightLandingAltitudeRangeM = 0.8f;
constexpr uint32_t kFlightLandingHoldMs = 4000U;

const char* flightPhaseName(FlightPhase phase) {
  switch (phase) {
    case FlightPhase::PoweredFlight: return "POWERED_FLIGHT";
    case FlightPhase::Coasting: return "COASTING";
    case FlightPhase::Descent: return "DESCENT";
    case FlightPhase::Landed: return "LANDED";
    default: return "PRE_FLIGHT";
  }
}

void flightPhaseResetRuntime() {
  flightPhaseRuntime = FlightPhaseRuntime{};
  snap.flightPhase = static_cast<uint8_t>(FlightPhase::PreFlight);
  snap.flightVerticalSpeedMps = 0.0f;
  snap.flightApogeeM = 0.0f;
  snap.flightPhaseElapsedMs = 0U;
  Serial.println("[FLIGHT_PHASE] runtime reset for new sequence");
}

bool flightConditionHeld(uint32_t nowMs, uint32_t& sinceMs, bool condition, uint32_t holdMs) {
  if (!condition) {
    sinceMs = 0;
    return false;
  }
  if (sinceMs == 0) sinceMs = nowMs ? nowMs : 1U;
  return (uint32_t)(nowMs - sinceMs) >= holdMs;
}

void flightPhaseSet(FlightPhase next, uint32_t nowMs) {
  if (next == flightPhaseRuntime.phase) return;
  flightPhaseRuntime.phase = next;
  flightPhaseRuntime.phaseEnteredMs = nowMs;
  flightPhaseRuntime.launchAccelSinceMs = 0;
  flightPhaseRuntime.launchSpeedSinceMs = 0;
  flightPhaseRuntime.coastSinceMs = 0;
  flightPhaseRuntime.descentSinceMs = 0;
  flightPhaseRuntime.landingSinceMs = 0;
  Serial.printf("[FLIGHT_PHASE] phase=%s alt=%.2f vs=%.2f apogee=%.2f arm=%u\n",
                flightPhaseName(next),
                snap.baroValid ? snap.altM : 0.0f,
                flightPhaseRuntime.verticalSpeedMps,
                flightPhaseRuntime.apogeeM,
                armSwitchEffectiveOn() ? 1U : 0U);
}

void flightLandingHistoryPush(float altitudeM, uint32_t nowMs) {
  FlightPhaseRuntime& rt = flightPhaseRuntime;
  const uint16_t index = rt.landingHistoryHead;
  rt.landingAltitudeM[index] = altitudeM;
  rt.landingTimestampMs[index] = nowMs;
  rt.landingHistoryHead = (uint16_t)((index + 1U) % FlightPhaseRuntime::kLandingHistoryCapacity);
  if (rt.landingHistoryCount < FlightPhaseRuntime::kLandingHistoryCapacity) {
    rt.landingHistoryCount++;
  }
}

bool flightLandingAltitudeStable(uint32_t nowMs) {
  const FlightPhaseRuntime& rt = flightPhaseRuntime;
  if (rt.landingHistoryCount < 2U) return false;
  float minAltitudeM = INFINITY;
  float maxAltitudeM = -INFINITY;
  uint32_t oldestMs = nowMs;
  uint16_t samples = 0;
  for (uint16_t i = 0; i < rt.landingHistoryCount; ++i) {
    const uint16_t index = (uint16_t)(
      (rt.landingHistoryHead + FlightPhaseRuntime::kLandingHistoryCapacity - 1U - i) %
      FlightPhaseRuntime::kLandingHistoryCapacity);
    const uint32_t timestampMs = rt.landingTimestampMs[index];
    const uint32_t ageMs = (uint32_t)(nowMs - timestampMs);
    if (ageMs > kFlightLandingHoldMs) break;
    const float altitudeM = rt.landingAltitudeM[index];
    if (!isfinite(altitudeM)) continue;
    minAltitudeM = fminf(minAltitudeM, altitudeM);
    maxAltitudeM = fmaxf(maxAltitudeM, altitudeM);
    oldestMs = timestampMs;
    samples++;
  }
  return samples >= 2U &&
         (uint32_t)(nowMs - oldestMs) >= (kFlightLandingHoldMs - 100U) &&
         (maxAltitudeM - minAltitudeM) < kFlightLandingAltitudeRangeM;
}

void flightPhaseUpdateBarometer(uint32_t nowMs) {
  FlightPhaseRuntime& rt = flightPhaseRuntime;
  if (!snap.baroValid || lastBaroValidMs == 0U || lastBaroValidMs == rt.lastBaroSampleMs) return;
  const float altitudeM = snap.altM;
  if (!isfinite(altitudeM)) return;

  if (isfinite(rt.lastAltitudeM) && rt.lastBaroSampleMs != 0U) {
    const float dtSec = (float)(uint32_t)(lastBaroValidMs - rt.lastBaroSampleMs) / 1000.0f;
    if (dtSec >= 0.01f && dtSec <= 0.25f) {
      const float rawSpeedMps = (altitudeM - rt.lastAltitudeM) / dtSec;
      const float boundedSpeedMps = clampFloat(rawSpeedMps, -250.0f, 500.0f);
      const float alpha = 1.0f - expf(-dtSec / 0.10f);
      rt.verticalSpeedMps += (boundedSpeedMps - rt.verticalSpeedMps) * alpha;
    }
  }
  rt.lastAltitudeM = altitudeM;
  rt.lastBaroSampleMs = lastBaroValidMs;
  if (rt.phase != FlightPhase::PreFlight) {
    rt.apogeeM = fmaxf(rt.apogeeM, altitudeM);
  }
  flightLandingHistoryPush(altitudeM, nowMs);
}

void flightPhaseTick() {
  const uint32_t nowMs = millis();
  FlightPhaseRuntime& rt = flightPhaseRuntime;
  if (sequenceState == kSequenceStateFiring || sequenceState == kSequenceStateTplus) {
    rt.ignitionSeen = true;
  }
  flightPhaseUpdateBarometer(nowMs);

  const float accelG = snap.sampleValid
    ? sqrtf((snap.ax * snap.ax) + (snap.ay * snap.ay) + (snap.az * snap.az))
    : NAN;
  const bool baroFresh = snap.baroValid && lastBaroValidMs != 0U &&
    (uint32_t)(nowMs - lastBaroValidMs) <= 250U;
  const bool armReleasedFromLauncher = !armSwitchEffectiveOn();

  switch (rt.phase) {
    case FlightPhase::PreFlight: {
      const bool accelerationLaunch = flightConditionHeld(
        nowMs,
        rt.launchAccelSinceMs,
        isfinite(accelG) && accelG > kFlightLaunchAccelG,
        kFlightLaunchHoldMs);
      const bool speedLaunch = flightConditionHeld(
        nowMs,
        rt.launchSpeedSinceMs,
        baroFresh && rt.verticalSpeedMps > kFlightLaunchSpeedMps,
        kFlightLaunchHoldMs);
      if (rt.ignitionSeen && armReleasedFromLauncher && (accelerationLaunch || speedLaunch)) {
        rt.apogeeM = snap.baroValid && isfinite(snap.altM) ? snap.altM : 0.0f;
        flightPhaseSet(FlightPhase::PoweredFlight, nowMs);
      }
      break;
    }
    case FlightPhase::PoweredFlight: {
      const bool minimumPoweredTimeElapsed =
        (uint32_t)(nowMs - rt.phaseEnteredMs) >= kFlightPoweredMinimumMs;
      const bool coastCondition = minimumPoweredTimeElapsed &&
        isfinite(accelG) && accelG < kFlightCoastAccelG &&
        baroFresh && rt.verticalSpeedMps > kFlightCoastMinimumSpeedMps;
      if (flightConditionHeld(nowMs, rt.coastSinceMs, coastCondition, kFlightCoastHoldMs)) {
        flightPhaseSet(FlightPhase::Coasting, nowMs);
      }
      break;
    }
    case FlightPhase::Coasting: {
      const bool descentCondition = baroFresh &&
        isfinite(snap.altM) &&
        snap.altM <= (rt.apogeeM - kFlightDescentDropM) &&
        rt.verticalSpeedMps < kFlightDescentSpeedMps;
      if (flightConditionHeld(nowMs, rt.descentSinceMs, descentCondition, kFlightDescentHoldMs)) {
        flightPhaseSet(FlightPhase::Descent, nowMs);
      }
      break;
    }
    case FlightPhase::Descent: {
      const bool landingMotionStable = baroFresh &&
        fabsf(rt.verticalSpeedMps) < kFlightLandingMaxSpeedMps &&
        isfinite(accelG) &&
        accelG >= kFlightLandingMinAccelG && accelG <= kFlightLandingMaxAccelG;
      const bool landingMotionHeld = flightConditionHeld(
        nowMs,
        rt.landingSinceMs,
        landingMotionStable,
        kFlightLandingHoldMs);
      if (landingMotionHeld && flightLandingAltitudeStable(nowMs)) {
        flightPhaseSet(FlightPhase::Landed, nowMs);
      }
      break;
    }
    case FlightPhase::Landed:
      break;
  }

  snap.flightPhase = static_cast<uint8_t>(rt.phase);
  snap.flightVerticalSpeedMps = rt.verticalSpeedMps;
  snap.flightApogeeM = rt.apogeeM;
  snap.flightPhaseElapsedMs = rt.phaseEnteredMs == 0U
    ? 0U
    : (uint32_t)(nowMs - rt.phaseEnteredMs);
}
