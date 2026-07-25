import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const storageSource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-storage.js", import.meta.url),
  "utf8"
);
const replaySource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-charts-replay.js", import.meta.url),
  "utf8"
);
const htmlSource = fs.readFileSync(
  new URL("../FLASH6/flash6.html", import.meta.url),
  "utf8"
);

const builderStart = storageSource.indexOf("function clampInt");
const builderEnd = storageSource.indexOf("function flushAppDataSamples", builderStart);
assert.ok(builderStart >= 0 && builderEnd > builderStart, "app record V6 builder not found");

const context = {Uint8Array, DataView, Date, Math, Number, isFinite};
vm.createContext(context);
vm.runInContext(
  [
    "const REPLAY_BIN_RECORD_MARKER = 0xA55A;",
    "const REPLAY_BIN_SAMPLE_APP_V6_PAYLOAD_BYTES = 80;",
    "const REPLAY_BIN_APP_RECORD_V6_BYTES = 96;",
    "const FLIGHT_PHASE_CODE_NAMES = Object.freeze(['PRE_FLIGHT','POWERED_FLIGHT','COASTING','APOGEE','DESCENT']);",
    "function replayCrc16Ccitt(dv, offset, len){",
    "  let crc = 0xFFFF;",
    "  for(let i=0;i<len;i++){",
    "    crc ^= dv.getUint8(offset+i) << 8;",
    "    for(let bit=0;bit<8;bit++) crc = (crc & 0x8000) ? (((crc << 1) ^ 0x1021) & 0xFFFF) : ((crc << 1) & 0xFFFF);",
    "  }",
    "  return crc & 0xFFFF;",
    "}",
    storageSource.slice(builderStart, builderEnd),
    "globalThis.buildRecord = buildAppDataRecordV6;"
  ].join("\n"),
  context
);

const record = context.buildRecord({
  ut:1234,
  alt_m:42.5,
  fl_rx_hz:97.4,
  fl_loss_permille:12,
  fl_rssi_dbm:-76.3,
  fl_rssi_age_ms:25,
  fl_link:1,
  fl_remote_valid:1,
  fl_stage1:1,
  fl_stage2:0,
  fl_role_code:1
}, 7);
assert.equal(record.byteLength, 96);
const dv = new DataView(record.buffer, record.byteOffset, record.byteLength);
assert.equal(dv.getUint8(2), 6);
assert.equal(dv.getUint16(4, true), 80);
assert.equal(dv.getUint16(16 + 68, true), 974);
assert.equal(dv.getUint16(16 + 70, true), 12);
assert.equal(dv.getInt16(16 + 72, true), -763);
assert.equal(dv.getUint16(16 + 74, true), 25);
assert.equal(dv.getUint16(16 + 76, true), 0b11110111);

assert.match(replaySource, /recVersion === 4 \|\| recVersion === 6/);
assert.match(replaySource, /sample\.app_link_quality_recorded = 1/);
assert.match(replaySource, /function prepareReplayLinkQualityData/);
assert.match(htmlSource, /id="replayLinkStatusBtn"/);
assert.match(htmlSource, /id="replayLinkQualityChart"/);

console.log("App replay link-quality regression: PASS (V4 compatible, V6 metrics)");
