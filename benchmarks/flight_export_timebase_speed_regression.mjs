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
  "\nglobalThis.updateVerticalSpeed = updateReportVerticalSpeedMps;",
  context
);
const horizontalHelperStart = coreSource.indexOf(
  "function updateModelRocketHorizontalMotion"
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
  "\nglobalThis.updateHorizontalMotion = updateModelRocketHorizontalMotion;",
  context
);
const altitudeSpeedHelperStart = replaySource.indexOf(
  "function deriveAltitudeSpeedSeries"
);
assert.ok(altitudeSpeedHelperStart >= 0, "altitude-speed helper not found");
vm.runInContext(
  replaySource.slice(altitudeSpeedHelperStart) +
  "\nglobalThis.deriveAltitudeSpeed = deriveAltitudeSpeedSeries;",
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
  bootstrapSource,
  /t\("hdrAltitudeM"\),\s*"FLIGHT_ACCEL_G",\s*"SPEED_MPS"/,
  "FLIGHT_RECORD must export actual scalar speed"
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
