import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-charts-replay.js", import.meta.url),
  "utf8"
);
const start = source.indexOf("function replayLegacyEntryTimeMs");
const end = source.indexOf("function replayAttachBinProtocolMetadata", start);
assert.ok(start >= 0 && end > start, "legacy timebase source not found");

const context = {};
vm.createContext(context);
vm.runInContext(
  [
    "const REPLAY_LEGACY_ARM_DEBOUNCE_MS = 50;",
    "const REPLAY_LEGACY_THRUST_ACCEL_G = 1.5;",
    "const REPLAY_LEGACY_THRUST_HOLD_MS = 100;",
    "const REPLAY_LEGACY_ARM_CONFIRM_MS = 1000;",
    "const REPLAY_SEQUENCE_STATE_IDLE = 0;",
    "const REPLAY_SEQUENCE_STATE_TPLUS = 3;",
    source.slice(start, end),
    "globalThis.reconstruct = replayReconstructLegacyLaunchTimebase;"
  ].join("\n"),
  context
);

function makeSamples({armAt = null, thrustAt = null, endAt = 1800}){
  const samples = [];
  for(let tsMs = 0; tsMs <= endAt; tsMs += 10){
    const installed = armAt == null || tsMs < armAt;
    const powered = thrustAt != null && tsMs >= thrustAt;
    samples.push({
      tsMs,
      sample:{
        sp:installed ? 1 : 0,
        ax:powered ? 2.0 : 0,
        ay:0,
        az:powered ? 0 : 1.0,
        td:-77,
        st:0,
        uw:1
      }
    });
  }
  return samples;
}

const legacy = {compatible:false};

const armFirstSamples = makeSamples({armAt:200, thrustAt:400});
const armFirst = context.reconstruct(armFirstSamples, legacy);
assert.equal(armFirst.mode, "ARM_FIRST");
assert.equal(armFirst.launchAtMs, 200);
assert.equal(armFirstSamples.find((entry)=>entry.tsMs === 200).sample.td, 0);
assert.equal(armFirstSamples.at(-1).sample.st, 3);

const armOnlySamples = makeSamples({armAt:250});
const armOnly = context.reconstruct(armOnlySamples, legacy);
assert.equal(armOnly.mode, "ARM_FIRST");
assert.equal(armOnly.launchAtMs, 250);
assert.equal(armOnlySamples.at(-1).sample.bin_legacy_launch_validation_fault, 0);

const thrustFirstSamples = makeSamples({thrustAt:100, armAt:650});
const thrustFirst = context.reconstruct(thrustFirstSamples, legacy);
assert.equal(thrustFirst.mode, "THRUST_FIRST_CONFIRMED");
assert.equal(thrustFirst.launchAtMs, 100);
assert.equal(thrustFirstSamples.find((entry)=>entry.tsMs === 650).sample.td, 550);
assert.equal(thrustFirstSamples.at(-1).sample.uw, 0);

const thrustOnlySamples = makeSamples({thrustAt:100});
const thrustOnly = context.reconstruct(thrustOnlySamples, legacy);
assert.equal(thrustOnly.mode, "THRUST_REJECTED");
assert.equal(thrustOnly.rejectAtMs, 1100);
assert.equal(thrustOnlySamples.find((entry)=>entry.tsMs === 1090).sample.st, 3);
assert.equal(thrustOnlySamples.find((entry)=>entry.tsMs === 1100).sample.st, 0);
assert.equal(
  thrustOnlySamples.find((entry)=>entry.tsMs === 1100)
    .sample.bin_legacy_launch_validation_fault,
  1
);

const storedPhaseSamples = makeSamples({armAt:450});
storedPhaseSamples.forEach((entry)=>{
  delete entry.sample.ax;
  delete entry.sample.ay;
  delete entry.sample.az;
  if(entry.tsMs >= 300){
    entry.sample.flight_phase_code = 1;
    entry.sample.flight_phase = "POWERED_FLIGHT";
    entry.sample.flight_transition_reason = 1;
  }
});
const storedPhase = context.reconstruct(storedPhaseSamples, legacy);
assert.equal(storedPhase.mode, "THRUST_FIRST_CONFIRMED");
assert.equal(storedPhase.launchAtMs, 200);
assert.equal(storedPhase.thrustSource, "STORED_POWERED_PHASE");

const modernSamples = makeSamples({armAt:200, thrustAt:400});
const modernOriginal = modernSamples.map((entry)=>entry.sample.td);
const modern = context.reconstruct(modernSamples, {compatible:true});
assert.equal(modern.reconstructed, false);
assert.deepEqual(
  modernSamples.map((entry)=>entry.sample.td),
  modernOriginal
);

console.table([
  {scenario:"legacy ARM first", tplus:armFirst.launchAtMs, mode:armFirst.mode},
  {scenario:"legacy ARM only", tplus:armOnly.launchAtMs, mode:armOnly.mode},
  {scenario:"legacy thrust + ARM", tplus:thrustFirst.launchAtMs, mode:thrustFirst.mode},
  {scenario:"legacy thrust only", tplus:"discarded", mode:thrustOnly.mode},
  {scenario:"stored POWERED phase", tplus:storedPhase.launchAtMs, mode:storedPhase.mode}
]);
console.log("Legacy priority launch timebase regression: PASS");
