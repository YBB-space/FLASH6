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
  currentLang:"ko"
};
vm.createContext(context);
vm.runInContext(
  reportSource.slice(helperStart, helperEnd) +
  "\nglobalThis.selectWindow = selectFlightRecordWindow;",
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

console.table([
  {scenario:"thrust first, ARM confirms later", tplusMs:thrustFirst.launchElapsedMs},
  {scenario:"ARM first", tplusMs:armFirst.launchElapsedMs},
  {scenario:"legacy phase before ARM", tplusMs:legacyWindow.launchElapsedMs}
]);
console.log("Flight export timebase/speed regression: PASS");
