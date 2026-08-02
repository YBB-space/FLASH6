#!/usr/bin/env node
/* Build the single-request runtime from ordered classic-script source modules. */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "flash6.runtime.js");
const runtimeModules = [
  "flash6-core.js",
  "flash6-shell.js",
  "flash6-views.js",
  "flash6-charts-replay.js",
  "flash6-protocol.js",
  "flash6-transport.js",
  "flash6-firmware-update.js",
  "flash6-telemetry.js",
  "flash6-storage.js",
  "flash6-polling.js",
  "flash6-interactions.js",
  "flash6-mission.js",
  "flash6-hardware.js",
  "flash6-report.js",
  "flash6-command.js",
  "flash6-bootstrap.js"
];

const output =
  "/* Generated FLASH6 runtime bundle. Edit scripts/flash6-*.js source modules. */\n" +
  runtimeModules
    .map((name)=>fs.readFileSync(path.join(root, "scripts", name), "utf8"))
    .join("\n");

fs.writeFileSync(outputPath, output);
console.log(
  "Built flash6.runtime.js from " + runtimeModules.length + " ordered modules."
);
