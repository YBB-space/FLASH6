import { performance } from "node:perf_hooks";

const totalBytes = Number(process.env.STORAGE_BENCH_BYTES) ||
  Math.round(31.25 * 1024 * 1024);
const iterations = Number(process.env.STORAGE_PARSE_ITERATIONS) || 10000;
const radioChunkBytes = 192;
const oldWindowDepth = 4;
const newWindowDepth = 8;
const oldRetryMs = 70;
const newRetryMs = 45;
const telemetryFrameBytes = 133;
const oldTransferTelemetryHz = 20;

function requestCount(bytes, chunkBytes) {
  return Math.ceil(bytes / chunkBytes);
}

function printRequestReduction(label, oldChunkBytes, newChunkBytes) {
  const before = requestCount(totalBytes, oldChunkBytes);
  const after = requestCount(totalBytes, newChunkBytes);
  const reduction = (1 - after / before) * 100;
  console.log(
    `${label}: ${before.toLocaleString()} -> ${after.toLocaleString()} ` +
    `requests (${reduction.toFixed(1)}% fewer)`
  );
}

const payload = Buffer.alloc(8192, 0x5a).toString("base64");
const prefix = "SPI_FLASH_REMOTE_CHUNK";
const line = `${prefix} off=123456 len=8192 b64=${payload}`;

function parseRegexWide(raw) {
  const fields = {};
  const expression = /([A-Za-z0-9_]+)=([^\s]+)/g;
  let match;
  const tail = raw.slice(prefix.length);
  while ((match = expression.exec(tail))) {
    fields[String(match[1]).toLowerCase()] = String(match[2]);
  }
  return {
    off: Number(fields.off),
    len: Number(fields.len),
    b64: String(fields.b64 || "")
  };
}

function parseFixedFields(raw) {
  const tail = raw.slice(prefix.length).trim();
  const b64Marker = " b64=";
  const b64At = tail.indexOf(b64Marker);
  const meta = tail.slice(0, b64At);
  return {
    off: Number(meta.match(/(?:^|\s)off=(\d+)/)?.[1]),
    len: Number(meta.match(/(?:^|\s)len=(\d+)/)?.[1]),
    b64: tail.slice(b64At + b64Marker.length).trim()
  };
}

function measure(label, parse) {
  const startedAt = performance.now();
  let result;
  for (let i = 0; i < iterations; i++) result = parse(line);
  const elapsedMs = performance.now() - startedAt;
  if (
    result.off !== 123456 ||
    result.len !== 8192 ||
    result.b64 !== payload
  ) {
    throw new Error(`${label} result mismatch`);
  }
  console.log(
    `${label}: ${elapsedMs.toFixed(1)} ms / ` +
    `${iterations.toLocaleString()} parses`
  );
  return elapsedMs;
}

console.log(
  `Storage download model: ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`
);
printRequestReduction("A.I LINK serial", 1024, 8192);
printRequestReduction("Direct USB serial", 1536, 8192);
console.log(
  `A.I LINK radio window: ${oldWindowDepth * radioChunkBytes} -> ` +
  `${newWindowDepth * radioChunkBytes} bytes in flight ` +
  `(${(newWindowDepth / oldWindowDepth).toFixed(1)}x)`
);
console.log(
  `A.I LINK retry latency: ${oldRetryMs} -> ${newRetryMs} ms ` +
  `(${((1 - newRetryMs / oldRetryMs) * 100).toFixed(1)}% shorter)`
);
console.log(
  `Competing transfer telemetry: ` +
  `${(telemetryFrameBytes * oldTransferTelemetryHz).toLocaleString()} -> 0 ` +
  `payload bytes/s (100.0% removed)`
);

const regexMs = measure("regex-wide", parseRegexWide);
const fixedMs = measure("fixed-field", parseFixedFields);
console.log(`parser speedup: ${(regexMs / fixedMs).toFixed(2)}x`);
