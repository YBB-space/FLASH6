import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const bootstrapSource = fs.readFileSync(
  new URL("../scripts/flash6-bootstrap.js", import.meta.url),
  "utf8"
);
const reportSource = fs.readFileSync(
  new URL("../scripts/flash6-report.js", import.meta.url),
  "utf8"
);
const i18nSource = fs.readFileSync(
  new URL("../scripts/flash6-i18n.js", import.meta.url),
  "utf8"
);

assert.match(
  bootstrapSource,
  /t\("hdrElapsedMs"\),\s*t\("hdrFlightPhase"\),\s*t\("hdrAltitudeM"\)/,
  "FLIGHT_RECORD must place flight state immediately after elapsed time"
);
assert.match(
  bootstrapSource,
  /xNum,\s*flightPhaseTextFromExportRow\(row,\s*currentLang\),/,
  "FLIGHT_RECORD rows must contain the localized flight state"
);
assert.match(bootstrapSource, /xLabelCol:"H"/);
for(const expected of [
  'series:[{col:"C", nameCell:"FLIGHT_RECORD!$C$1"',
  'series:[{col:"E", nameCell:"FLIGHT_RECORD!$E$1"',
  '{col:"D", nameCell:"FLIGHT_RECORD!$D$1"',
  '{col:"F", nameCell:"FLIGHT_RECORD!$F$1"',
  '{col:"G", nameCell:"FLIGHT_RECORD!$G$1"',
  '{col:"I", nameCell:"FLIGHT_RECORD!$I$1"',
  '{col:"J", nameCell:"FLIGHT_RECORD!$J$1"',
  '{col:"K", nameCell:"FLIGHT_RECORD!$K$1"'
]){
  assert.ok(bootstrapSource.includes(expected), "shifted chart source missing: " + expected);
}
assert.match(i18nSource, /hdrFlightPhase:"비행 상태"/);
assert.match(i18nSource, /hdrFlightPhase:"flight_phase"/);

const start = reportSource.indexOf("function flightPhaseCodeFromExportRow");
const end = reportSource.indexOf("function selectFlightRecordWindow", start);
assert.ok(start >= 0 && end > start, "flight phase export helpers not found");
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
  reportSource.slice(start, end) +
  "\nglobalThis.phaseText = flightPhaseTextFromExportRow;",
  context
);
assert.equal(context.phaseText({flight_phase_code:0}, "ko"), "발사 전");
assert.equal(context.phaseText({flight_phase_code:1}, "ko"), "추력 비행");
assert.equal(context.phaseText({flight_phase:"COASTING"}, "ko"), "코스팅");
assert.equal(context.phaseText({flight_phase_code:3}, "en"), "DESCENT");

console.log("Flight-record export regression: PASS (phase column + shifted charts)");
