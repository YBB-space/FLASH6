import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-charts-replay.js", import.meta.url),
  "utf8"
);
const storageSource = fs.readFileSync(
  new URL("../FLASH6/scripts/flash6-storage.js", import.meta.url),
  "utf8"
);
const start = source.indexOf("function replayReadMagicText");
const end = source.indexOf("function replayAttachBinProtocolMetadata");
assert.ok(start >= 0 && end > start, "replay protocol classifier source not found");

const context = {ArrayBuffer};
vm.createContext(context);
vm.runInContext(
  [
    "const REPLAY_BIN_RECORD_MARKER = 0xA55A;",
    "const REPLAY_BIN_RECORD_MARKER_ALT = 0x5AA5;",
    "const REPLAY_BIN_METADATA_BYTES = 64;",
    "const REPLAY_BIN_METADATA_MAGIC = 0x32544D48;",
    "const REPLAY_PROTOCOL_COMPATIBLE_MIN = 8;",
    "const REPLAY_PROTOCOL_COMPATIBLE_MAX = 8;",
    source.slice(start, end),
    "globalThis.inspectProtocol = replayInspectBinProtocol;"
  ].join("\n"),
  context
);

function makeHeader(protocolVersion, metadataValid = true, headerSize = 64) {
  const bytes = new Uint8Array(Math.max(64, headerSize));
  const dv = new DataView(bytes.buffer);
  "HWLOGV2".split("").forEach((char, index)=>{
    bytes[index] = char.charCodeAt(0);
  });
  dv.setUint16(8, headerSize >= 64 ? 3 : 2, true);
  dv.setUint16(10, headerSize, true);
  if(headerSize >= 64) {
    dv.setUint32(40, 0x32544D48, true);
    dv.setUint16(44, 1, true);
    dv.setUint16(46, metadataValid ? 1 : 0, true);
    dv.setUint16(52, protocolVersion, true);
    dv.setUint8(56, 1);
  }
  return bytes.buffer.slice(0, headerSize);
}

const oldHeader = context.inspectProtocol(makeHeader(0, false, 40));
assert.equal(oldHeader.candidate, true);
assert.equal(oldHeader.hasMetadata, false);
assert.equal(oldHeader.compatible, false);

const current = context.inspectProtocol(makeHeader(8));
assert.equal(current.hasMetadata, true);
assert.equal(current.compatible, true);
assert.equal(current.protocolVersion, 8);
assert.equal(current.missionTimebaseVersion, 1);

const older = context.inspectProtocol(makeHeader(7));
assert.equal(older.hasMetadata, true);
assert.equal(older.compatible, false);
assert.equal(older.reason, "outside-range");

const newer = context.inspectProtocol(makeHeader(9));
assert.equal(newer.hasMetadata, true);
assert.equal(newer.compatible, false);
assert.equal(newer.reason, "outside-range");

const missingFlag = context.inspectProtocol(makeHeader(8, false));
assert.equal(missingFlag.hasMetadata, false);
assert.equal(missingFlag.compatible, false);

const builderStart = storageSource.indexOf("function buildSpiFlashBinHeader");
const builderEnd = storageSource.indexOf("async function fetchSpiFlashStatusViaSerial");
assert.ok(builderStart >= 0 && builderEnd > builderStart, "BIN header builder source not found");
vm.runInContext(
  [
    "const sampleHistory = [];",
    storageSource.slice(builderStart, builderEnd),
    "globalThis.buildHeader = buildSpiFlashBinHeader;"
  ].join("\n"),
  context
);
const generated = context.buildHeader({
  used_bytes:1040,
  record_count:10,
  protocol:8,
  timebase:1,
  meta:1,
  build:36,
  session_id:12
});
assert.equal(generated.byteLength, 64);
const generatedMeta = context.inspectProtocol(Uint8Array.from(generated).buffer);
assert.equal(generatedMeta.compatible, true);
assert.equal(generatedMeta.protocolVersion, 8);
assert.equal(generatedMeta.sessionId, 12);
assert.equal(generatedMeta.firmwareBuildNumber, 36);

console.log("BIN protocol metadata regression: PASS (legacy, b7, b8, b9, missing)");
