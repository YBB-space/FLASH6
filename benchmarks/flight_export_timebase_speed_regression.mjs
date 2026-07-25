import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const reportSource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-report.js", import.meta.url),
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
  coastingVerticalStep <= 33,
  "burnout-confirmed ascent must not form a second acceleration peak"
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
  /Number\(row && row\.actual_speed_recorded\) === 1/,
  "replay export must trust only speed values explicitly present in the source file"
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

console.table([
  {scenario:"thrust first, ARM confirms later", tplusMs:thrustFirst.launchElapsedMs},
  {scenario:"ARM first", tplusMs:armFirst.launchElapsedMs},
  {scenario:"legacy phase before ARM", tplusMs:legacyWindow.launchElapsedMs},
  {scenario:"coordinate jitter rejected", maxSpeedMps:Math.max(...filteredComponentSpeed)}
]);
console.log("Flight export timebase/speed regression: PASS");
