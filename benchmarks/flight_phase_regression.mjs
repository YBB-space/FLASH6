import assert from "node:assert/strict";

const DT_MS = 5;
const BARO_MS = 20;
const COAST = {
  minimumPoweredMs:900,
  clipG:2.5,
  tauSec:0.060,
  enterG:0.55,
  exitG:0.85,
  holdMs:140
};
const DESCENT = {
  windowMs:320,
  minimumSpanMs:140,
  dropEnterM:0.45,
  dropExitM:0.20,
  speedEnterMps:-0.55,
  speedExitMps:0.15,
  apogeeQuietMs:120,
  holdMs:140
};

function deterministicNoise(index, amplitude){
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return ((x - Math.floor(x)) * 2 - 1) * amplitude;
}

function regressionSpeed(history, nowMs){
  const points = history.filter(point=>nowMs - point.ms <= DESCENT.windowMs);
  if(points.length < 4 || nowMs - points[0].ms < DESCENT.minimumSpanMs) return null;
  let sumT = 0;
  let sumAlt = 0;
  let sumTT = 0;
  let sumTAlt = 0;
  for(const point of points){
    const t = (point.ms - nowMs) / 1000;
    sumT += t;
    sumAlt += point.alt;
    sumTT += t * t;
    sumTAlt += t * point.alt;
  }
  const denominator = points.length * sumTT - sumT * sumT;
  return (points.length * sumTAlt - sumT * sumAlt) / denominator;
}

function runScenario({
  durationMs,
  ignition = true,
  armReleased = true,
  accelerationAt,
  altitudeAt
}){
  let phase = "PRE_FLIGHT";
  let phaseEnteredMs = 0;
  let launchSinceMs = 0;
  let coastSinceMs = 0;
  let descentSinceMs = 0;
  let coastFilteredG = NaN;
  let coastLow = false;
  let descentLatched = false;
  let ascentConfirmed = false;
  let phaseStartAltitudeM = 0;
  let fastSpeedMps = 0;
  let apogeeM = 0;
  let lastApogeeUpdateMs = 0;
  const history = [];
  const transitions = [];

  for(let nowMs = 0; nowMs <= durationMs; nowMs += DT_MS){
    const rawAccelG = accelerationAt(nowMs);
    const boundedG = Math.max(0, Math.min(COAST.clipG, rawAccelG));
    if(!Number.isFinite(coastFilteredG)){
      coastFilteredG = boundedG;
    }else{
      const alpha = 1 - Math.exp(-(DT_MS / 1000) / COAST.tauSec);
      coastFilteredG += (boundedG - coastFilteredG) * alpha;
    }
    if(!coastLow && coastFilteredG < COAST.enterG) coastLow = true;
    else if(coastLow && coastFilteredG > COAST.exitG) coastLow = false;

    let altitudeM = history.length ? history[history.length - 1].alt : 0;
    if(nowMs % BARO_MS === 0){
      altitudeM = altitudeAt(nowMs);
      history.push({ms:nowMs, alt:altitudeM});
      while(history.length && nowMs - history[0].ms > DESCENT.windowMs){
        history.shift();
      }
      const calculatedSpeed = regressionSpeed(history, nowMs);
      if(Number.isFinite(calculatedSpeed)) fastSpeedMps = calculatedSpeed;
      if(phase !== "PRE_FLIGHT"){
        if(altitudeM > apogeeM + 0.05) lastApogeeUpdateMs = nowMs;
        apogeeM = Math.max(apogeeM, altitudeM);
      }
    }

    if(phase === "PRE_FLIGHT"){
      const launchCondition = rawAccelG > 1.5;
      launchSinceMs = launchCondition ? (launchSinceMs || nowMs || 1) : 0;
      if(ignition && armReleased && launchSinceMs && nowMs - launchSinceMs >= 100){
        phase = "POWERED_FLIGHT";
        phaseEnteredMs = nowMs;
        phaseStartAltitudeM = altitudeM;
        apogeeM = altitudeM;
        lastApogeeUpdateMs = nowMs;
        transitions.push({phase, ms:nowMs});
      }
    }else if(phase === "POWERED_FLIGHT"){
      if(fastSpeedMps > 0.75 || altitudeM > phaseStartAltitudeM + 3){
        ascentConfirmed = true;
      }
      const coastCondition =
        nowMs - phaseEnteredMs >= COAST.minimumPoweredMs &&
        ascentConfirmed &&
        coastLow;
      coastSinceMs = coastCondition ? (coastSinceMs || nowMs) : 0;
      if(coastSinceMs && nowMs - coastSinceMs >= COAST.holdMs){
        phase = "COASTING";
        phaseEnteredMs = nowMs;
        coastSinceMs = 0;
        transitions.push({phase, ms:nowMs});
      }
    }else if(phase === "COASTING"){
      const dropM = apogeeM - altitudeM;
      const quiet = nowMs - lastApogeeUpdateMs >= DESCENT.apogeeQuietMs;
      if(!descentLatched &&
         quiet &&
         dropM >= DESCENT.dropEnterM &&
         fastSpeedMps < DESCENT.speedEnterMps){
        descentLatched = true;
      }else if(descentLatched &&
               (dropM < DESCENT.dropExitM ||
                fastSpeedMps > DESCENT.speedExitMps)){
        descentLatched = false;
      }
      descentSinceMs = descentLatched ? (descentSinceMs || nowMs) : 0;
      if(descentSinceMs && nowMs - descentSinceMs >= DESCENT.holdMs){
        phase = "DESCENT";
        phaseEnteredMs = nowMs;
        transitions.push({phase, ms:nowMs});
      }
    }
  }
  return {phase, transitions};
}

const burnoutMs = 1400;
const apogeeMs = 5681;
function nominalAltitude(nowMs, pressureSpike = false){
  const t = nowMs / 1000;
  const burnSec = burnoutMs / 1000;
  let altitude;
  if(t <= burnSec){
    altitude = 0.5 * 30 * t * t;
  }else{
    const dt = t - burnSec;
    altitude = 0.5 * 30 * burnSec * burnSec + 42 * dt - 4.905 * dt * dt;
  }
  altitude += deterministicNoise(nowMs / BARO_MS, 0.055);
  if(pressureSpike && nowMs >= 3600 && nowMs < 3640) altitude -= 1.2;
  return altitude;
}

function nominalAcceleration(nowMs){
  if(nowMs < burnoutMs) return 3.1 + deterministicNoise(nowMs / DT_MS, 0.35);
  const vibrationSpike = nowMs % 85 < 10 ? 1.9 : 0;
  return 0.06 + deterministicNoise(nowMs / DT_MS, 0.08) + vibrationSpike;
}

const nominal = runScenario({
  durationMs:7500,
  accelerationAt:nominalAcceleration,
  altitudeAt:ms=>nominalAltitude(ms, false)
});
const coast = nominal.transitions.find(item=>item.phase === "COASTING");
const descent = nominal.transitions.find(item=>item.phase === "DESCENT");
assert.ok(coast, "nominal flight must detect coasting");
assert.ok(descent, "nominal flight must detect descent");
assert.ok(coast.ms - burnoutMs >= 100 && coast.ms - burnoutMs <= 300,
  `burnout delay out of range: ${coast.ms - burnoutMs} ms`);
assert.ok(descent.ms > apogeeMs && descent.ms - apogeeMs <= 550,
  `apogee delay out of range: ${descent.ms - apogeeMs} ms`);

const launchShockOnly = runScenario({
  durationMs:3500,
  accelerationAt:ms=>ms < 130 ? 2.2 : 1.0 + deterministicNoise(ms / DT_MS, 0.04),
  altitudeAt:ms=>deterministicNoise(ms / BARO_MS, 0.06)
});
assert.equal(
  launchShockOnly.transitions.some(item=>item.phase === "COASTING"),
  false,
  "a launch-like impact followed by 1 g rest must not become coasting"
);

const launchShockFreeFall = runScenario({
  durationMs:3500,
  accelerationAt:ms=>ms < 130 ? 2.2 : 0.04,
  altitudeAt:ms=>deterministicNoise(ms / BARO_MS, 0.06)
});
assert.equal(
  launchShockFreeFall.transitions.some(item=>item.phase === "COASTING"),
  false,
  "a launch-like impact followed by low-g motion without ascent must not become coasting"
);

const noIgnition = runScenario({
  durationMs:2500,
  ignition:false,
  accelerationAt:ms=>ms < 500 ? 3.0 : 0.05,
  altitudeAt:ms=>ms * 0.02
});
assert.equal(noIgnition.phase, "PRE_FLIGHT", "acceleration without ignition must not launch");

const pressureSpike = runScenario({
  durationMs:7500,
  accelerationAt:nominalAcceleration,
  altitudeAt:ms=>nominalAltitude(ms, true)
});
const spikeDescent = pressureSpike.transitions.find(item=>item.phase === "DESCENT");
assert.ok(spikeDescent && spikeDescent.ms > apogeeMs,
  "a short pressure dip during ascent must not cause early descent");

console.table([
  {
    scenario:"nominal + vibration",
    coastMs:coast.ms,
    burnoutDelayMs:coast.ms - burnoutMs,
    descentMs:descent.ms,
    apogeeDelayMs:descent.ms - apogeeMs,
    result:"PASS"
  },
  {
    scenario:"launch shock only",
    coastMs:"none",
    burnoutDelayMs:"-",
    descentMs:"none",
    apogeeDelayMs:"-",
    result:"PASS"
  },
  {
    scenario:"ascent pressure dip",
    coastMs:pressureSpike.transitions.find(item=>item.phase === "COASTING")?.ms ?? "none",
    burnoutDelayMs:"-",
    descentMs:spikeDescent?.ms ?? "none",
    apogeeDelayMs:spikeDescent ? spikeDescent.ms - apogeeMs : "-",
    result:"PASS"
  }
]);
