import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const reportSource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-report.js", import.meta.url),
  "utf8"
);
const coreSource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-core.js", import.meta.url),
  "utf8"
);
const bootstrapSource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-bootstrap.js", import.meta.url),
  "utf8"
);
const protocolSource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-protocol.js", import.meta.url),
  "utf8"
);
const viewsSource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-views.js", import.meta.url),
  "utf8"
);
const telemetrySource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-telemetry.js", import.meta.url),
  "utf8"
);
const replaySource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-charts-replay.js", import.meta.url),
  "utf8"
);

const helperStart = reportSource.indexOf("function flightPhaseCodeFromExportRow");
const helperEnd = reportSource.indexOf("function buildStoredFlightEventRows", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "flight record window helper not found");

const context = {
  FLIGHT_PHASE_CODE_NAMES:[
    "PRE_FLIGHT",
    "POWERED_FLIGHT",
    "COASTING",
    "DESCENT",
    "LANDED"
  ],
  FLIGHT_PHASES:{
    PRE_FLIGHT:"PRE_FLIGHT",
    POWERED_FLIGHT:"POWERED_FLIGHT",
    COASTING:"COASTING",
    DESCENT:"DESCENT",
    LANDED:"LANDED"
  },
  DEG_TO_RAD:Math.PI / 180,
  GYRO_IMU_GRAVITY_MPS2:9.80665,
  GYRO_FUSION_GPS_DEFAULT_ACCURACY_M:3.5,
  GYRO_FUSION_GPS_MIN_ACCURACY_M:0.18,
  GYRO_FUSION_GPS_MAX_ACCURACY_M:35,
  currentLang:"ko",
  clampLocal:(value, min, max)=>Math.max(min, Math.min(max, value))
};
vm.createContext(context);
vm.runInContext(
  reportSource.slice(helperStart, helperEnd) +
  "\nglobalThis.selectWindow = selectFlightRecordWindow;",
  context
);

const speedHelperStart = reportSource.indexOf("function buildTrajectoryScalarSpeedSeries");
const speedHelperEnd = reportSource.indexOf(
  "function buildFlightTrajectory3dArtifact",
  speedHelperStart
);
assert.ok(
  speedHelperStart >= 0 && speedHelperEnd > speedHelperStart,
  "trajectory scalar-speed helper not found"
);
vm.runInContext(
  reportSource.slice(speedHelperStart, speedHelperEnd) +
  "\nglobalThis.buildScalarSpeed = buildTrajectoryScalarSpeedSeries;" +
  "\nglobalThis.selectReportSpeed = selectReportScalarSpeedMps;" +
  "\nglobalThis.updateVerticalSpeed = updateReportVerticalSpeedMps;" +
  "\nglobalThis.getTrajectoryProjectionScale = getMetricTrajectoryProjectionScale;",
  context
);
const horizontalHelperStart = coreSource.indexOf(
  "function getModelRocketHorizontalRangeLimitM"
);
const horizontalHelperEnd = coreSource.indexOf(
  "const GYRO_CAPTURE_SPRING",
  horizontalHelperStart
);
assert.ok(
  horizontalHelperStart >= 0 && horizontalHelperEnd > horizontalHelperStart,
  "model-rocket horizontal-motion helper not found"
);
vm.runInContext(
  coreSource.slice(horizontalHelperStart, horizontalHelperEnd) +
  "\nglobalThis.updateHorizontalMotion = updateModelRocketHorizontalMotion;" +
  "\nglobalThis.getHorizontalRangeLimit = getModelRocketHorizontalRangeLimitM;",
  context
);
const altitudeSpeedHelperStart = replaySource.indexOf(
  "function isotonicAltitudeRegression"
);
assert.ok(altitudeSpeedHelperStart >= 0, "altitude-speed helper not found");
vm.runInContext(
  replaySource.slice(altitudeSpeedHelperStart) +
  "\nglobalThis.deriveAltitudeSpeed = deriveAltitudeSpeedSeries;" +
  "\nglobalThis.correctAltitude = buildPressureRobustAltitudeSeries;" +
  "\nglobalThis.correctReplayAltitude = applyPressureRobustAltitudeToReplayFrames;",
  context
);
context.GYRO_ABSOLUTE_TRAJECTORY_ENABLED = false;
context.GYRO_FUSION_ACCEL_CLAMP_MPS2 = 220;
context.GYRO_LOCAL_PHASE_DYNAMICS = {
  PRE_FLIGHT:{accelTau:0.45},
  POWERED_FLIGHT:{accelTau:0.15},
  COASTING:{accelTau:0.22},
  DESCENT:{accelTau:0.28},
  LANDED:{accelTau:0.35}
};
context.getModelRocketLaunchHorizontalAcceptance = (ageSec, altitudeM)=>{
  const timeRatio = Math.max(0, Math.min(1, (ageSec - 0.18) / 0.5));
  const altitudeRatio = Math.max(0, Math.min(1, (altitudeM - 1.2) / 5.8));
  const smooth = (ratio)=>ratio * ratio * (3 - (2 * ratio));
  return Math.min(smooth(timeRatio), smooth(altitudeRatio));
};
context.flightPhaseCodeFromExportRow = (row)=>Number(row && row.flight_phase_code);
context.missionAlarmSignalsPrimaryDeployment = ()=>false;
context.missionAlarmSignalsSecondaryDeployment = ()=>false;
const trajectoryHelperStart = reportSource.indexOf(
  "function buildFlightTrajectory3dArtifact"
);
const trajectoryHelperEnd = reportSource.indexOf(
  "function buildFlightTelemetryChartImages",
  trajectoryHelperStart
);
assert.ok(
  trajectoryHelperStart >= 0 && trajectoryHelperEnd > trajectoryHelperStart,
  "trajectory artifact helper not found"
);
vm.runInContext(
  reportSource.slice(trajectoryHelperStart, trajectoryHelperEnd) +
  "\nglobalThis.buildTrajectoryArtifact = buildFlightTrajectory3dArtifact;",
  context
);

function rows({thrustAt, armAt, confirmAt, endAt = 1200}){
  const result = [];
  for(let elapsed = 0; elapsed <= endAt; elapsed += 100){
    const powered = elapsed >= thrustAt;
    const armReleased = elapsed >= armAt;
    const confirmed = elapsed >= confirmAt;
    result.push({
      elapsed,
      time:new Date(1_800_000_000_000 + elapsed).toISOString(),
      sp:armReleased ? 0 : 1,
      s:armReleased ? 0 : 1,
      st:confirmed ? 3 : 0,
      td:confirmed ? elapsed - thrustAt : 0,
      flight_phase_code:powered ? 1 : 0
    });
  }
  return result;
}

const thrustFirst = context.selectWindow(rows({
  thrustAt:200,
  armAt:700,
  confirmAt:700
}));
assert.equal(thrustFirst.startReason, "mission_tplus");
assert.equal(thrustFirst.launchElapsedMs, 200);
assert.equal(thrustFirst.rows[0].elapsed, 200);

const armFirstRows = rows({thrustAt:600, armAt:200, confirmAt:200});
armFirstRows.forEach((row)=>{
  if(row.elapsed >= 200) row.td = row.elapsed - 200;
});
const armFirst = context.selectWindow(armFirstRows);
assert.equal(armFirst.launchElapsedMs, 200);
assert.equal(armFirst.rows[0].elapsed, 200);

const legacyThrustFirst = rows({thrustAt:200, armAt:700, confirmAt:9999});
const legacyWindow = context.selectWindow(legacyThrustFirst);
assert.equal(legacyWindow.startReason, "flight_phase");
assert.equal(legacyWindow.rows[0].elapsed, 200);

const filteredComponentSpeed = Array.from(context.buildScalarSpeed([
  {eastM:0, northM:0, altitudeM:0, horizontalSpeedMps:0},
  {
    eastM:100,
    northM:-80,
    altitudeM:50,
    horizontalSpeedMps:5,
    verticalSpeedMps:12
  },
  {eastM:-120, northM:140, altitudeM:-20, horizontalSpeedMps:7}
], [20, 18, -10]));
assert.equal(filteredComponentSpeed[0], 20);
assert.ok(Math.abs(filteredComponentSpeed[1] - Math.hypot(5, 12)) < 1e-9);
assert.ok(Math.abs(filteredComponentSpeed[2] - Math.hypot(7, -10)) < 1e-9);
assert.ok(
  Math.max(...filteredComponentSpeed) < 25,
  "reconstructed coordinate corrections must not create scalar-speed spikes"
);
assert.equal(
  context.selectReportSpeed(84, 20, false),
  20,
  "legacy replay-derived speed must not override the fused estimator"
);
assert.equal(
  context.selectReportSpeed(37.2, 20, true),
  37.2,
  "explicitly stored scalar speed must remain authoritative"
);
const initialVerticalStep = context.updateVerticalSpeed(
  0,
  30,
  25,
  0.01,
  {powered:true, established:false}
);
assert.ok(
  initialVerticalStep > 0 && initialVerticalStep <= 0.45 + 1e-9,
  "T+ speed must rise continuously instead of snapping to the barometric slope"
);
const coastingVerticalStep = context.updateVerticalSpeed(
  33,
  20,
  48,
  0.01,
  {powered:false, coastingAscent:true, established:true}
);
assert.ok(
  coastingVerticalStep <= 33 - (9.80665 * 0.01) + 1e-9,
  "burnout-confirmed ascent must begin ballistic deceleration immediately"
);
let ballisticVerticalSpeed = 33;
for(let i = 0; i < 100; i++){
  ballisticVerticalSpeed = context.updateVerticalSpeed(
    ballisticVerticalSpeed,
    20,
    48,
    0.01,
    {powered:false, coastingAscent:true, established:true}
  );
}
assert.ok(
  ballisticVerticalSpeed < 23.3,
  "delayed barometric rise must not create a post-burnout speed plateau"
);
const actualAspectProjectionScale = context.getTrajectoryProjectionScale(36, 139.7);
assert.ok(
  Math.abs(actualAspectProjectionScale - (500 / 139.7)) < 1e-9,
  "a tall model-rocket flight must use altitude as the shared metric-scale constraint"
);
assert.ok(
  (36 * actualAspectProjectionScale) < (139.7 * actualAspectProjectionScale * 0.27),
  "a 36 m horizontal span must render narrower than a 139.7 m ascent"
);
let energyBoundedVerticalSpeed = 0;
for(let i = 0; i < 160; i++){
  energyBoundedVerticalSpeed = context.updateVerticalSpeed(
    energyBoundedVerticalSpeed,
    30,
    84,
    0.01,
    {
      powered:true,
      established:i >= 45,
      currentAltitudeM:10,
      apogeeAltitudeM:107,
      hasFutureApogee:true
    }
  );
}
assert.ok(
  energyBoundedVerticalSpeed < 66,
  "barometric spikes must respect the measured apogee energy envelope"
);

let horizontalMotion = {
  velocityX:0,
  velocityZ:0,
  positionX:0,
  positionZ:0
};
for(let i = 0; i < 40; i++){
  horizontalMotion = context.updateHorizontalMotion(horizontalMotion, {
    dtSec:0.01,
    phase:"POWERED_FLIGHT",
    verticalSpeedMps:35,
    axisX:0.22,
    axisZ:0,
    axisUp:0.976,
    horizontalAcceptance:0
  });
}
assert.equal(
  horizontalMotion.positionX,
  0,
  "rail-constrained launch must not create horizontal travel"
);
for(let i = 0; i < 100; i++){
  horizontalMotion = context.updateHorizontalMotion(horizontalMotion, {
    dtSec:0.01,
    phase:"POWERED_FLIGHT",
    verticalSpeedMps:35,
    axisX:0.22,
    axisZ:0,
    axisUp:0.976,
    horizontalAcceptance:1
  });
}
assert.ok(
  horizontalMotion.positionX > 2 && horizontalMotion.positionX < 10,
  "post-rail attitude must produce gradual, bounded horizontal curvature"
);
const apogeeRangeLimitM = context.getHorizontalRangeLimit({
  phase:"COASTING",
  altitudeM:139.7,
  apogeeAltitudeM:139.7,
  gpsRangeEnvelopeM:11.38,
  gpsAccuracyM:3.5
});
assert.ok(
  apogeeRangeLimitM >= 15 && apogeeRangeLimitM <= 16,
  "GPS may constrain scalar range but must retain an accuracy margin"
);
let rangeGuardedMotion = {
  velocityX:20,
  velocityZ:0,
  positionX:4.95,
  positionZ:0
};
rangeGuardedMotion = context.updateHorizontalMotion(rangeGuardedMotion, {
  dtSec:0.05,
  phase:"COASTING",
  verticalSpeedMps:15,
  horizontalRangeLimitM:5
});
assert.ok(
  Math.hypot(rangeGuardedMotion.positionX, rangeGuardedMotion.positionZ) <= 5 + 1e-9 &&
  rangeGuardedMotion.velocityX <= 1e-9,
  "range guard must stop outward drift without changing the path heading"
);
const rangeObservedMotion = context.updateHorizontalMotion({
  velocityX:0,
  velocityZ:0,
  positionX:3,
  positionZ:4
}, {
  dtSec:0.01,
  phase:"COASTING",
  horizontalRangeLimitM:15,
  horizontalRangeTargetM:10,
  rangeCorrectionAlpha:0.2
});
assert.ok(
  Math.abs((3 * rangeObservedMotion.positionZ) - (4 * rangeObservedMotion.positionX)) < 1e-9 &&
  Math.hypot(rangeObservedMotion.positionX, rangeObservedMotion.positionZ) > 5,
  "GPS scalar range observation must preserve the local IMU path direction"
);
const coastVelocityBefore = horizontalMotion.velocityX;
for(let i = 0; i < 100; i++){
  horizontalMotion = context.updateHorizontalMotion(horizontalMotion, {
    dtSec:0.01,
    phase:"COASTING",
    verticalSpeedMps:20,
    axisX:-0.8,
    axisZ:0,
    axisUp:0.6,
    horizontalAcceptance:1
  });
}
assert.ok(
  horizontalMotion.velocityX > 0 &&
  horizontalMotion.velocityX < coastVelocityBefore,
  "coasting attitude changes must not reverse the center-of-mass trajectory"
);
const altitudeTimesMs = Array.from({length:101}, (_unused, index)=>index * 10);
const altitudeRampM = altitudeTimesMs.map((timeMs)=>timeMs * 0.02);
altitudeRampM[50] += 40;
const robustAltitudeSpeedMps = Array.from(
  context.deriveAltitudeSpeed(altitudeTimesMs, altitudeRampM, 600)
);
assert.ok(
  robustAltitudeSpeedMps.every((value)=>!isFinite(value) || Math.abs(value - 20) < 2),
  "an isolated pressure/altitude glitch must not create a speed impulse"
);
const pressureShockTimesMs = Array.from({length:401}, (_unused, index)=>index * 25);
const pressureShockAltitudeM = pressureShockTimesMs.map((timeMs)=>{
  const timeSec = timeMs / 1000;
  return timeSec <= 5
    ? 140 - (5.6 * Math.pow(timeSec - 5, 2))
    : 140 - (7.0 * Math.pow(timeSec - 5, 2));
});
for(let index = 124; index <= 132; index++){
  pressureShockAltitudeM[index] += 14 * Math.sin(
    ((index - 124) / 8) * Math.PI
  );
}
for(let index = 133; index <= 141; index++){
  pressureShockAltitudeM[index] -= 8 * Math.sin(
    ((index - 133) / 8) * Math.PI
  );
}
const correctedPressureShockAltitudeM = Array.from(context.correctAltitude(
  pressureShockTimesMs,
  pressureShockAltitudeM
));
const correctedApogeeIndex = correctedPressureShockAltitudeM.reduce(
  (best, value, index)=>value > correctedPressureShockAltitudeM[best] ? index : best,
  0
);
assert.ok(
  Math.abs((pressureShockTimesMs[correctedApogeeIndex] / 1000) - 5) < 0.2,
  "pressure shock must not become a false early apogee"
);
assert.ok(
  Math.abs(correctedPressureShockAltitudeM[correctedApogeeIndex] - 140) < 0.5,
  "pressure correction must preserve the real apogee altitude"
);
for(let index = 1; index <= correctedApogeeIndex; index++){
  assert.ok(
    correctedPressureShockAltitudeM[index] >=
      correctedPressureShockAltitudeM[index - 1] - 1e-9,
    "corrected ascent altitude must remain physically nondecreasing"
  );
}
for(let index = correctedApogeeIndex + 1;
    index < correctedPressureShockAltitudeM.length;
    index++){
  assert.ok(
    correctedPressureShockAltitudeM[index] <=
      correctedPressureShockAltitudeM[index - 1] + 1e-9,
    "corrected descent altitude must remain physically nonincreasing"
  );
}
const replayPressureFrames = pressureShockTimesMs.map((tsMs, index)=>({
  tsMs,
  sample:{alt_m:pressureShockAltitudeM[index]}
}));
context.correctReplayAltitude(replayPressureFrames);
assert.equal(
  replayPressureFrames[0].sample.alt_m,
  pressureShockAltitudeM[0],
  "replay correction must preserve raw barometric altitude"
);
assert.ok(
  isFinite(replayPressureFrames[130].sample.altitude_corrected_m),
  "replay correction must expose a separate corrected altitude"
);

const syntheticRows = [];
const syntheticAltitudes = [];
const syntheticVerticalSpeeds = [];
let syntheticAltitudeM = 0;
let syntheticVerticalSpeedMps = 0;
for(let index = 0; index <= 1200; index++){
  const elapsedSec = index * 0.01;
  let phaseCode = 3;
  let netAccelMps2 = 0;
  if(elapsedSec <= 1.3){
    phaseCode = 1;
    netAccelMps2 = 30;
  }else if(syntheticVerticalSpeedMps > 0){
    phaseCode = 2;
    netAccelMps2 = -9.80665;
  }else{
    phaseCode = 3;
    syntheticVerticalSpeedMps += (-10 - syntheticVerticalSpeedMps) * 0.025;
  }
  if(phaseCode !== 3) syntheticVerticalSpeedMps += netAccelMps2 * 0.01;
  syntheticAltitudeM = Math.max(
    0,
    syntheticAltitudeM + (syntheticVerticalSpeedMps * 0.01)
  );
  const vibration = phaseCode === 1
    ? 0.08 * Math.sin(index * 0.73)
    : 0.015 * Math.sin(index * 0.19);
  syntheticRows.push({
    elapsed:index * 10,
    time:new Date(1_800_000_000_000 + (index * 10)).toISOString(),
    alt_m:syntheticAltitudeM,
    ax:vibration,
    ay:vibration * 0.4,
    az:phaseCode === 1
      ? 1 + (30 / 9.80665) + vibration
      : 0.05 + vibration,
    gx:0,
    gy:phaseCode === 1 && elapsedSec > 0.35 ? 4.5 : 0,
    gz:0,
    flight_phase_code:phaseCode,
    deployment_state:0,
    deployment_flags:0
  });
  syntheticAltitudes.push(syntheticAltitudeM);
  syntheticVerticalSpeeds.push(syntheticVerticalSpeedMps);
}
const syntheticTrajectory = context.buildTrajectoryArtifact(
  syntheticRows,
  syntheticAltitudes,
  "",
  0,
  syntheticVerticalSpeeds
);
const finiteSyntheticSpeeds = Array.from(syntheticTrajectory.actualSpeedMps)
  .filter((value)=>isFinite(value));
assert.equal(finiteSyntheticSpeeds[0], 0);
assert.ok(
  Math.max(...finiteSyntheticSpeeds) > 35 &&
  Math.max(...finiteSyntheticSpeeds) < 60,
  "nominal 100 m model-rocket flight must have a smooth, plausible peak speed"
);
const trajectoryHeader = Array.from(syntheticTrajectory.rows[0]);
assert.ok(trajectoryHeader.includes("ESTIMATED_SPEED_MPS"));
assert.ok(trajectoryHeader.includes("GPS_RANGE_ENVELOPE_M"));
assert.ok(trajectoryHeader.includes("MODEL_RANGE_LIMIT_M"));
const earlyTrajectoryRow = syntheticTrajectory.rows.find((row)=>
  Number(row[0]) >= 0.18
);
assert.ok(
  earlyTrajectoryRow && Math.hypot(Number(earlyTrajectoryRow[1]), Number(earlyTrajectoryRow[2])) < 0.15,
  "trajectory must remain nearly vertical while rail constrained"
);
const gpsPollutedRows = syntheticRows.map((row, index)=>Object.assign({}, row, {
  gps_lat:34.6 + (index * 0.000002),
  gps_lon:127.2 + (Math.sin(index * 0.025) * 0.00025),
  gps_fix:1
}));
const gpsExcludedTrajectory = context.buildTrajectoryArtifact(
  gpsPollutedRows,
  syntheticAltitudes,
  "",
  0,
  syntheticVerticalSpeeds
);
assert.equal(
  gpsExcludedTrajectory.positionMode,
  "IMU_LOCAL",
  "GPS availability must not change trajectory reconstruction mode"
);
assert.ok(
  gpsExcludedTrajectory.rows.slice(1).every((row)=>
    row[6] === "IMU_LOCAL" && row[12] === "MODEL ROCKET FUSION"
  ),
  "GPS coordinates must remain reference-only in trajectory exports"
);
assert.match(
  coreSource,
  /const GYRO_TRAIL_HORIZONTAL_EXAGGERATION = 1\.0;/,
  "live gyro trajectory must preserve the same metric proportions as reports"
);
assert.match(
  reportSource,
  /const groundHalf = Math\.max\(\s*horizontalSpan \* 0\.68,\s*altitudeSpan \* 0\.38\s*\);/,
  "trajectory ground reference plane must remain readable without changing metric scale"
);
assert.match(
  reportSource,
  /"APOGEE  " \+ maxA\.toFixed\(1\) \+ " m · T\+" \+ apogeeTPlusSec\.toFixed\(3\) \+ " s"/,
  "apogee marker must include altitude and T+ time"
);
assert.match(
  reportSource,
  /"STAGE SEP  T\+"[\s\S]*stageSeparationEvent\.point\.altitudeM\.toFixed\(1\) \+ " m"/,
  "stage-separation marker must include event altitude"
);
assert.match(
  reportSource,
  /"EJECTION  T\+"[\s\S]*ejectionEvent\.point\.altitudeM\.toFixed\(1\) \+ " m"/,
  "ejection marker must include event altitude"
);
assert.match(
  reportSource,
  /"END  " \+ endPoint\.altitudeM\.toFixed\(1\) \+ " m"/,
  "end marker must include final altitude"
);

assert.match(
  bootstrapSource,
  /t\("hdrAltitudeM"\),\s*"FLIGHT_ACCEL_G",\s*"SPEED_MPS"/,
  "FLIGHT_RECORD must export actual scalar speed"
);
assert.match(
  bootstrapSource,
  /"BARO_ALTITUDE_RAW_M",\s*"ALTITUDE_CORRECTED_M"/,
  "RAW flight sheet must keep measured and corrected altitude separate"
);
assert.match(
  bootstrapSource,
  /elapsedSec - launchElapsedSec/,
  "FLIGHT_RECORD elapsed time must be relative to firmware T+"
);
assert.doesNotMatch(
  protocolSource,
  /\n\s*speed_mps:finiteOrNull\(16\)/,
  "relayed vertical speed must not be aliased as actual speed"
);
assert.doesNotMatch(
  viewsSource.slice(
    viewsSource.indexOf("function readQuickTelemetrySpeedMps"),
    viewsSource.indexOf("function getQuickFlightMetrics")
  ),
  /readTelemetryVerticalSpeedMps/,
  "HUD actual speed helper must not fall back to altitude speed"
);
assert.match(
  telemetrySource,
  /getQuickFlightMetrics\(motionTelemetryData,\s*timeMs\)/,
  "A.I LINK HUD speed must use the active vehicle sample instead of ground-station IMU"
);
assert.doesNotMatch(
  telemetrySource,
  /if\(isFinite\(quickSpeedMps\)\)\{\s*data\.actual_speed_mps/,
  "replay must not mutate a derived display speed into a recorded source field"
);
assert.match(
  bootstrapSource,
  /recordedSpeedSource === "IMPORTED"/,
  "replay export must re-estimate app-derived speed and trust only direct/imported speed"
);
assert.match(
  replaySource,
  /actual_speed_source:\(encodedActualSpeed & 0x8000\) \? "APP_DERIVED" : ""/,
  "app V6 stored speed must retain derived provenance"
);
assert.doesNotMatch(
  replaySource.slice(
    replaySource.indexOf("speedMps: replayFindHeaderIndex"),
    replaySource.indexOf("verticalSpeedMps: replayFindHeaderIndex")
  ),
  /verticalvelocity|velocityzms/,
  "imported vertical-speed columns must not be treated as scalar vehicle speed"
);
assert.match(
  bootstrapSource,
  /launchElapsedSec,\s*reportFastAltitudeSpeedMps\s*\)/,
  "legacy trajectory speed must receive the fast barometric correction component"
);
assert.doesNotMatch(
  reportSource,
  /const measuredSpeedMps = distanceM \/ dtSec/,
  "scalar speed must not differentiate corrected 3D trajectory positions"
);
assert.match(
  coreSource,
  /updateModelRocketHorizontalMotion\(/,
  "live gyro trajectory and report trajectory must share the model-rocket motion prior"
);

console.table([
  {scenario:"thrust first, ARM confirms later", tplusMs:thrustFirst.launchElapsedMs},
  {scenario:"ARM first", tplusMs:armFirst.launchElapsedMs},
  {scenario:"legacy phase before ARM", tplusMs:legacyWindow.launchElapsedMs},
  {scenario:"coordinate jitter rejected", maxSpeedMps:Math.max(...filteredComponentSpeed)},
  {scenario:"energy-bounded vertical speed", maxSpeedMps:energyBoundedVerticalSpeed},
  {scenario:"gradual horizontal curvature", rangeM:horizontalMotion.positionX},
  {scenario:"synthetic 100 m flight", maxSpeedMps:Math.max(...finiteSyntheticSpeeds)}
]);
console.log("Flight export timebase/speed regression: PASS");
