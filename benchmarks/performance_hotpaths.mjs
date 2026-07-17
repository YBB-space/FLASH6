import { performance } from "node:perf_hooks";

const ITERATIONS = Math.max(50_000, Number(process.env.BENCH_ITERATIONS) || 200_000);
let legacyMathSink = 0;

function forceGc(){
  if(typeof global.gc === "function") global.gc();
}

function measure(name, fn, iterations = ITERATIONS){
  for(let i = 0; i < Math.min(20_000, iterations); i++) fn(i);
  forceGc();
  const start = performance.now();
  let checksum = 0;
  for(let i = 0; i < iterations; i++) checksum += fn(i);
  const elapsedMs = performance.now() - start;
  return {
    name,
    iterations,
    elapsedMs,
    nsPerOp:(elapsedMs * 1e6) / iterations,
    checksum
  };
}

function legacyAttitudeMath(i){
  const ax = 0.015 + ((i & 7) * 0.0001);
  const ay = -0.021 + ((i & 3) * 0.0001);
  const az = 0.9995;
  const gx = 0.42;
  const gy = -0.31;
  const gz = 0.18;
  const accMag = Math.sqrt((ax * ax) + (ay * ay) + (az * az));
  const accelRoll = Math.atan2(ay, az);
  const accelPitch = Math.atan2(-ax, Math.sqrt((ay * ay) + (az * az)));
  const rateMag = Math.sqrt((gx * gx) + (gy * gy) + (gz * gz));
  // Keep the otherwise-unused legacy initialization math observable to the JIT.
  legacyMathSink = accelRoll + accelPitch;
  return accMag + rateMag;
}

function optimizedAttitudeMath(i){
  const ax = 0.015 + ((i & 7) * 0.0001);
  const ay = -0.021 + ((i & 3) * 0.0001);
  const az = 0.9995;
  const gx = 0.42;
  const gy = -0.31;
  const gz = 0.18;
  // sampleImu() already needs this value for stationary/bias detection.
  const accMag = Math.sqrt((ax * ax) + (ay * ay) + (az * az));
  const rateMag = Math.sqrt((gx * gx) + (gy * gy) + (gz * gz));
  return accMag + rateMag;
}

const fullTelemetrySample = Object.fromEntries(
  Array.from({length:96}, (_, index)=>["field_" + index, index + 0.25])
);
fullTelemetrySample.stage_connected = 1;
fullTelemetrySample.stage_valid = 1;

const legacyStageState = {data:{}};
function legacyStageMerge(i){
  fullTelemetrySample.ut = i;
  const fallbackSample = Object.assign({}, fullTelemetrySample, {
    stage_connected:1,
    stage_valid:1
  });
  legacyStageState.data = Object.assign({}, legacyStageState.data, fallbackSample, {
    stage_node_id:1,
    data_origin:"avionics"
  });
  return legacyStageState.data.ut;
}

const optimizedStageState = {data:{}};
function optimizedStageMerge(i){
  fullTelemetrySample.ut = i;
  const fallbackSample = Object.assign({}, fullTelemetrySample, {
    stage_connected:1,
    stage_valid:1
  });
  fallbackSample.stage_node_id = 1;
  fallbackSample.data_origin = "avionics";
  optimizedStageState.data = fallbackSample;
  return optimizedStageState.data.ut;
}

const serialChunk = [
  '[2,100,10,0.1]',
  '[2,101,20,0.2]',
  '[2,102,30,0.3]',
  '[2,103,40,0.4]',
  '[2,104,50,0.5]',
  '[2,105,60,0.6]',
  '[2,106,70,0.7]',
  'ACK STREAM=1'
].join("\n") + "\npartial";

function legacySerialParse(){
  let buffer = serialChunk;
  let idx;
  let pendingJsonLine = null;
  let textLength = 0;
  while((idx = buffer.indexOf("\n")) >= 0){
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if(!line) continue;
    if((line[0] === "[" && line[line.length - 1] === "]") ||
       (line[0] === "{" && line[line.length - 1] === "}")){
      pendingJsonLine = line;
      continue;
    }
    if(pendingJsonLine){
      textLength += pendingJsonLine.length;
      pendingJsonLine = null;
    }
    textLength += line.length;
  }
  if(pendingJsonLine) textLength += pendingJsonLine.length;
  return textLength + buffer.length;
}

function optimizedSerialParse(){
  let buffer = serialChunk;
  let idx;
  let consumed = 0;
  let pendingJsonLine = null;
  let textLength = 0;
  while((idx = buffer.indexOf("\n", consumed)) >= 0){
    const line = buffer.slice(consumed, idx).trim();
    consumed = idx + 1;
    if(!line) continue;
    if((line[0] === "[" && line[line.length - 1] === "]") ||
       (line[0] === "{" && line[line.length - 1] === "}")){
      pendingJsonLine = line;
      continue;
    }
    if(pendingJsonLine){
      textLength += pendingJsonLine.length;
      pendingJsonLine = null;
    }
    textLength += line.length;
  }
  if(consumed > 0) buffer = buffer.slice(consumed);
  if(pendingJsonLine) textLength += pendingJsonLine.length;
  return textLength + buffer.length;
}

function compare(label, beforeFn, afterFn, iterations = ITERATIONS){
  const before = measure(label + " before", beforeFn, iterations);
  const after = measure(label + " after", afterFn, iterations);
  if(before.checksum !== after.checksum){
    throw new Error(label + " checksum mismatch: " + before.checksum + " != " + after.checksum);
  }
  return {
    hotPath:label,
    beforeMs:before.elapsedMs.toFixed(2),
    afterMs:after.elapsedMs.toFixed(2),
    speedup:(before.elapsedMs / after.elapsedMs).toFixed(2) + "x",
    savedPct:Math.max(0, (1 - (after.elapsedMs / before.elapsedMs)) * 100).toFixed(1) + "%",
    beforeNs:before.nsPerOp.toFixed(1),
    afterNs:after.nsPerOp.toFixed(1)
  };
}

const results = [
  compare("attitude steady-state", legacyAttitudeMath, optimizedAttitudeMath),
  compare("stage fallback merge", legacyStageMerge, optimizedStageMerge),
  compare("serial chunk parse", legacySerialParse, optimizedSerialParse, Math.max(50_000, ITERATIONS / 2))
];

console.log(`ALTIS hot-path benchmark · Node ${process.version} · ${process.platform}/${process.arch}`);
console.log(`Iterations: ${ITERATIONS.toLocaleString()} (serial: ${Math.max(50_000, ITERATIONS / 2).toLocaleString()})`);
console.table(results);
console.table([
  {
    model:"stage dashboard selectors @ 100 Hz",
    before:"2,800 /s",
    after:"14 once",
    reduction:">99.9% after warm-up"
  },
  {
    model:"stage dashboard text writes @ 100 Hz",
    before:"up to 2,400 /s",
    after:"up to 200 /s",
    reduction:"91.7% worst-case"
  },
  {
    model:"fallback top-level object allocations",
    before:"2 / sample",
    after:"1 / sample",
    reduction:"50%"
  },
  {
    model:"serial tail slices (8 lines/chunk)",
    before:"8 / chunk",
    after:"1 / chunk",
    reduction:"87.5%"
  },
  {
    model:"sample record zero-fill @ 200 Hz",
    before:"17,200 B/s",
    after:"0 B/s",
    reduction:"100%"
  }
]);
