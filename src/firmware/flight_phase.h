constexpr float kFlightLaunchAccelG = 1.5f;
constexpr float kFlightLaunchSpeedMps = 5.0f;
constexpr uint32_t kFlightLaunchHoldMs = 100U;

// Burnout detection is intentionally IMU-led. The minimum powered interval
// blocks launch-shock/free-fall transients, while the clipped low-pass filter
// keeps one vibration spike from delaying a real burnout for seconds.
constexpr uint32_t kFlightPoweredMinimumMs = 900U;
constexpr float kFlightCoastAccelClipG = 2.5f;
constexpr float kFlightCoastAccelFilterTauSec = 0.060f;
constexpr float kFlightCoastAccelEnterG = 0.55f;
constexpr float kFlightCoastAccelExitG = 0.85f;
constexpr uint32_t kFlightCoastHoldMs = 140U;

// The phase detector uses a causal short-window barometric slope. Display and
// report smoothing remain independent and cannot delay an apogee transition.
constexpr uint32_t kFlightFastVelocityWindowMs = 320U;
constexpr uint32_t kFlightFastVelocityMinimumSpanMs = 140U;
constexpr float kFlightDisplayVelocityTauSec = 0.45f;
constexpr float kFlightApogeeUpdateEpsilonM = 0.05f;
constexpr float kFlightDescentDropEnterM = 0.45f;
constexpr float kFlightDescentDropExitM = 0.20f;
constexpr float kFlightDescentSpeedEnterMps = -0.55f;
constexpr float kFlightDescentSpeedExitMps = 0.15f;
constexpr uint32_t kFlightApogeeQuietMs = 120U;
constexpr uint32_t kFlightDescentHoldMs = 140U;

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

const char* flightTransitionReasonName(FlightTransitionReason reason) {
  switch (reason) {
    case FlightTransitionReason::LaunchAcceleration: return "LAUNCH_ACCEL";
    case FlightTransitionReason::LaunchBarometer: return "LAUNCH_BARO";
    case FlightTransitionReason::BurnoutAcceleration: return "BURNOUT_ACCEL_FILTERED";
    case FlightTransitionReason::ApogeeBarometer: return "APOGEE_FAST_BARO";
    case FlightTransitionReason::LandingStable: return "LANDING_STABLE";
    default: return "NONE";
  }
}

uint16_t flightHeldMs(uint32_t nowMs, uint32_t sinceMs) {
  if (sinceMs == 0U) return 0U;
  return (uint16_t)min<uint32_t>(UINT16_MAX, (uint32_t)(nowMs - sinceMs));
}

void flightPhaseResetRuntime() {
  flightPhaseRuntime = FlightPhaseRuntime{};
  snap.flightRawAccelMagnitudeG = NAN;
  snap.flightCoastAccelFilteredG = NAN;
  snap.flightFastVerticalSpeedMps = 0.0f;
  snap.flightPhase = static_cast<uint8_t>(FlightPhase::PreFlight);
  snap.flightVerticalSpeedMps = 0.0f;
  snap.flightApogeeM = 0.0f;
  snap.flightPhaseElapsedMs = 0U;
  snap.flightCoastHoldMs = 0U;
  snap.flightDescentHoldMs = 0U;
  snap.flightTransitionReason = static_cast<uint8_t>(FlightTransitionReason::None);
  snap.flightTransitionAtMs = 0U;
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

void flightPhaseSet(
  FlightPhase next,
  uint32_t nowMs,
  FlightTransitionReason reason
) {
  FlightPhaseRuntime& rt = flightPhaseRuntime;
  if (next == rt.phase) return;
  rt.phase = next;
  rt.phaseEnteredMs = nowMs;
  rt.transitionAtMs = nowMs;
  rt.launchAccelSinceMs = 0;
  rt.launchSpeedSinceMs = 0;
  rt.coastSinceMs = 0;
  rt.descentSinceMs = 0;
  rt.landingSinceMs = 0;
  if (next == FlightPhase::PoweredFlight) {
    rt.phaseStartAltitudeM = snap.baroValid && isfinite(snap.altM) ? snap.altM : 0.0f;
    rt.apogeeM = rt.phaseStartAltitudeM;
    rt.lastApogeeUpdateMs = nowMs;
    // An acceleration-triggered launch still needs independent barometric
    // ascent evidence before burnout can be accepted. If the barometer fails,
    // the independent T+2.0 deployment backup remains available.
    rt.ascentConfirmed = reason == FlightTransitionReason::LaunchBarometer;
    rt.coastAccelLow = false;
    rt.descentEvidenceLatched = false;
  } else if (next == FlightPhase::Coasting) {
    rt.descentEvidenceLatched = false;
  }
  snap.flightTransitionReason = static_cast<uint8_t>(reason);
  snap.flightTransitionAtMs = (uint32_t)(nowMs - bootMs);
  Serial.printf(
    "[FLIGHT_PHASE] phase=%s reason=%s at=%lums alt=%.2f "
    "acc_raw=%.3f acc_coast=%.3f vs_fast=%.2f vs_display=%.2f "
    "apogee=%.2f coast_hold=%ums descent_hold=%ums backup=%u arm=%u\n",
    flightPhaseName(next),
    flightTransitionReasonName(reason),
    (unsigned long)snap.flightTransitionAtMs,
    snap.baroValid ? snap.altM : 0.0f,
    rt.rawAccelMagnitudeG,
    rt.coastAccelFilteredG,
    rt.fastVerticalSpeedMps,
    rt.displayVerticalSpeedMps,
    rt.apogeeM,
    (unsigned)snap.flightCoastHoldMs,
    (unsigned)snap.flightDescentHoldMs,
    (snap.deploymentFlags & (1U << 2)) ? 1U : 0U,
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

void flightVelocityHistoryPush(float altitudeM, uint32_t nowMs) {
  FlightPhaseRuntime& rt = flightPhaseRuntime;
  const uint8_t index = rt.velocityHistoryHead;
  rt.velocityAltitudeM[index] = altitudeM;
  rt.velocityTimestampMs[index] = nowMs;
  rt.velocityHistoryHead =
    (uint8_t)((index + 1U) % FlightPhaseRuntime::kVelocityHistoryCapacity);
  if (rt.velocityHistoryCount < FlightPhaseRuntime::kVelocityHistoryCapacity) {
    rt.velocityHistoryCount++;
  }
}

bool flightCalculateFastVerticalSpeed(uint32_t nowMs, float& speedMps) {
  const FlightPhaseRuntime& rt = flightPhaseRuntime;
  if (rt.velocityHistoryCount < 4U) return false;

  float sumT = 0.0f;
  float sumAlt = 0.0f;
  float sumTT = 0.0f;
  float sumTAlt = 0.0f;
  uint8_t count = 0U;
  uint32_t oldestMs = nowMs;
  for (uint8_t i = 0; i < rt.velocityHistoryCount; ++i) {
    const uint8_t index = (uint8_t)(
      (rt.velocityHistoryHead + FlightPhaseRuntime::kVelocityHistoryCapacity - 1U - i) %
      FlightPhaseRuntime::kVelocityHistoryCapacity);
    const uint32_t timestampMs = rt.velocityTimestampMs[index];
    const uint32_t ageMs = (uint32_t)(nowMs - timestampMs);
    if (ageMs > kFlightFastVelocityWindowMs) break;
    const float altitudeM = rt.velocityAltitudeM[index];
    if (!isfinite(altitudeM)) continue;
    const float timeSec = -((float)ageMs / 1000.0f);
    sumT += timeSec;
    sumAlt += altitudeM;
    sumTT += timeSec * timeSec;
    sumTAlt += timeSec * altitudeM;
    oldestMs = timestampMs;
    count++;
  }
  if (count < 4U ||
      (uint32_t)(nowMs - oldestMs) < kFlightFastVelocityMinimumSpanMs) {
    return false;
  }
  const float denominator = ((float)count * sumTT) - (sumT * sumT);
  if (!isfinite(denominator) || fabsf(denominator) < 1.0e-6f) return false;
  const float slope =
    (((float)count * sumTAlt) - (sumT * sumAlt)) / denominator;
  if (!isfinite(slope)) return false;
  speedMps = clampFloat(slope, -250.0f, 500.0f);
  return true;
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
      rt.rawVerticalSpeedMps = clampFloat(rawSpeedMps, -250.0f, 500.0f);
      const float displayAlpha = 1.0f - expf(-dtSec / kFlightDisplayVelocityTauSec);
      rt.displayVerticalSpeedMps +=
        (rt.rawVerticalSpeedMps - rt.displayVerticalSpeedMps) * displayAlpha;
    }
  }
  rt.lastAltitudeM = altitudeM;
  rt.lastBaroSampleMs = lastBaroValidMs;
  flightVelocityHistoryPush(altitudeM, lastBaroValidMs);
  float fastSpeedMps = rt.fastVerticalSpeedMps;
  if (flightCalculateFastVerticalSpeed(lastBaroValidMs, fastSpeedMps)) {
    rt.fastVerticalSpeedMps = fastSpeedMps;
  }
  if (rt.phase != FlightPhase::PreFlight) {
    if (altitudeM > (rt.apogeeM + kFlightApogeeUpdateEpsilonM)) {
      rt.lastApogeeUpdateMs = nowMs;
    }
    rt.apogeeM = fmaxf(rt.apogeeM, altitudeM);
  }
  flightLandingHistoryPush(altitudeM, nowMs);
}

void flightPhaseUpdateAcceleration(float rawAccelG, float dtSec) {
  FlightPhaseRuntime& rt = flightPhaseRuntime;
  rt.rawAccelMagnitudeG = rawAccelG;
  if (!isfinite(rawAccelG)) return;
  const float boundedAccelG = clampFloat(rawAccelG, 0.0f, kFlightCoastAccelClipG);
  if (!isfinite(rt.coastAccelFilteredG)) {
    rt.coastAccelFilteredG = boundedAccelG;
  } else {
    const float safeDtSec = clampFloat(dtSec, 0.001f, 0.050f);
    const float alpha = 1.0f - expf(-safeDtSec / kFlightCoastAccelFilterTauSec);
    rt.coastAccelFilteredG +=
      (boundedAccelG - rt.coastAccelFilteredG) * alpha;
  }
  if (!rt.coastAccelLow) {
    if (rt.coastAccelFilteredG < kFlightCoastAccelEnterG) {
      rt.coastAccelLow = true;
    }
  } else if (rt.coastAccelFilteredG > kFlightCoastAccelExitG) {
    rt.coastAccelLow = false;
  }
}

void flightPhaseTick() {
  FlightPhaseRuntime& rt = flightPhaseRuntime;
  const uint32_t nowUs = micros();
  if (rt.lastTickUs != 0U &&
      (uint32_t)(nowUs - rt.lastTickUs) < kSamplePeriodUs) {
    return;
  }
  const float dtSec = rt.lastTickUs == 0U
    ? (1.0f / (float)kImuSampleHz)
    : (float)(uint32_t)(nowUs - rt.lastTickUs) / 1000000.0f;
  rt.lastTickUs = nowUs;
  const uint32_t nowMs = millis();
  if (sequenceState == kSequenceStateFiring || sequenceState == kSequenceStateTplus) {
    rt.ignitionSeen = true;
  }
  flightPhaseUpdateBarometer(nowMs);

  const float accelG = snap.sampleValid
    ? snap.flightRawAccelMagnitudeG
    : NAN;
  flightPhaseUpdateAcceleration(accelG, dtSec);
  const bool baroFresh = snap.baroValid && lastBaroValidMs != 0U &&
    (uint32_t)(nowMs - lastBaroValidMs) <= 250U;
  const bool armReleasedFromLauncher = !armSwitchEffectiveOn();
  snap.flightCoastHoldMs = 0U;
  snap.flightDescentHoldMs = 0U;

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
        baroFresh && rt.fastVerticalSpeedMps > kFlightLaunchSpeedMps,
        kFlightLaunchHoldMs);
      if (rt.ignitionSeen && armReleasedFromLauncher && (accelerationLaunch || speedLaunch)) {
        flightPhaseSet(
          FlightPhase::PoweredFlight,
          nowMs,
          accelerationLaunch
            ? FlightTransitionReason::LaunchAcceleration
            : FlightTransitionReason::LaunchBarometer);
      }
      break;
    }
    case FlightPhase::PoweredFlight: {
      if (baroFresh &&
          (rt.fastVerticalSpeedMps > 0.75f ||
           snap.altM > (rt.phaseStartAltitudeM + 3.0f))) {
        rt.ascentConfirmed = true;
      }
      const bool minimumPoweredTimeElapsed =
        (uint32_t)(nowMs - rt.phaseEnteredMs) >= kFlightPoweredMinimumMs;
      const bool coastCondition = minimumPoweredTimeElapsed &&
        rt.ascentConfirmed &&
        isfinite(rt.coastAccelFilteredG) &&
        rt.coastAccelLow;
      const bool coastConfirmed = flightConditionHeld(
        nowMs,
        rt.coastSinceMs,
        coastCondition,
        kFlightCoastHoldMs);
      snap.flightCoastHoldMs = flightHeldMs(nowMs, rt.coastSinceMs);
      if (coastConfirmed) {
        flightPhaseSet(
          FlightPhase::Coasting,
          nowMs,
          FlightTransitionReason::BurnoutAcceleration);
      }
      break;
    }
    case FlightPhase::Coasting: {
      const float apogeeDropM = rt.apogeeM - snap.altM;
      const bool apogeeQuiet = rt.lastApogeeUpdateMs != 0U &&
        (uint32_t)(nowMs - rt.lastApogeeUpdateMs) >= kFlightApogeeQuietMs;
      if (!rt.descentEvidenceLatched) {
        if (baroFresh &&
            apogeeQuiet &&
            apogeeDropM >= kFlightDescentDropEnterM &&
            rt.fastVerticalSpeedMps < kFlightDescentSpeedEnterMps) {
          rt.descentEvidenceLatched = true;
        }
      } else if (!baroFresh ||
                 apogeeDropM < kFlightDescentDropExitM ||
                 rt.fastVerticalSpeedMps > kFlightDescentSpeedExitMps) {
        rt.descentEvidenceLatched = false;
      }
      const bool descentConfirmed = flightConditionHeld(
        nowMs,
        rt.descentSinceMs,
        rt.descentEvidenceLatched,
        kFlightDescentHoldMs);
      snap.flightDescentHoldMs = flightHeldMs(nowMs, rt.descentSinceMs);
      if (descentConfirmed) {
        flightPhaseSet(
          FlightPhase::Descent,
          nowMs,
          FlightTransitionReason::ApogeeBarometer);
      }
      break;
    }
    case FlightPhase::Descent: {
      const bool landingMotionStable = baroFresh &&
        fabsf(rt.displayVerticalSpeedMps) < kFlightLandingMaxSpeedMps &&
        isfinite(accelG) &&
        accelG >= kFlightLandingMinAccelG && accelG <= kFlightLandingMaxAccelG;
      const bool landingMotionHeld = flightConditionHeld(
        nowMs,
        rt.landingSinceMs,
        landingMotionStable,
        kFlightLandingHoldMs);
      if (landingMotionHeld && flightLandingAltitudeStable(nowMs)) {
        flightPhaseSet(
          FlightPhase::Landed,
          nowMs,
          FlightTransitionReason::LandingStable);
      }
      break;
    }
    case FlightPhase::Landed:
      break;
  }

  snap.flightRawAccelMagnitudeG = rt.rawAccelMagnitudeG;
  snap.flightCoastAccelFilteredG = rt.coastAccelFilteredG;
  snap.flightFastVerticalSpeedMps = rt.fastVerticalSpeedMps;
  snap.flightPhase = static_cast<uint8_t>(rt.phase);
  snap.flightVerticalSpeedMps = rt.displayVerticalSpeedMps;
  snap.flightApogeeM = rt.apogeeM;
  snap.flightPhaseElapsedMs = rt.phaseEnteredMs == 0U
    ? 0U
    : (uint32_t)(nowMs - rt.phaseEnteredMs);
}
