#!/usr/bin/env node
/* Compile both Nano examples and export the static browser upload assets. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const {spawnSync} = require("child_process");
const root = path.resolve(__dirname, "..");
const firmwareRoot = path.resolve(root, "../../Firmwares/ALTIS_INTELLIGNET3_firmware");
const project = path.join(firmwareRoot, "bootcamp_nano");
const bundledPio = path.join(os.homedir(), ".platformio/penv/bin/pio");
const pio = process.env.FLASH6_PIO || (fs.existsSync(bundledPio) ? bundledPio : "pio");
const result = spawnSync(pio, ["run", "--project-dir", project], {cwd:firmwareRoot, stdio:"inherit"});
if(result.error) throw result.error;
if(result.status !== 0) process.exit(result.status || 1);
const output = path.join(root, "bootcamp/firmware");
fs.mkdirSync(output, {recursive:true});
const hash = bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const manifest = {schema:1, board:"arduino-nano", mcu:"atmega328p", signature:[0x1e,0x95,0x0f], serialBaud:115200, sensors:{}};
for(const [sensor, env] of [["LSM6DSO","nano_lsm6dso"],["MPU6050","nano_mpu6050"]]){
  const source = fs.readFileSync(path.join(project, "examples", sensor + ".ino"));
  // Export stable LF files so Git checkout cannot alter the manifest's hashes.
  const hex = Buffer.from(fs.readFileSync(path.join(project, ".pio/build", env, "firmware.hex"), "utf8").replace(/\r\n/g, "\n"));
  const hexName = sensor.toLowerCase() + "-nano.hex";
  fs.writeFileSync(path.join(output, sensor + ".ino"), source);
  fs.writeFileSync(path.join(output, hexName), hex);
  manifest.sensors[sensor] = {source:sensor + ".ino", hex:hexName, sourceSha256:hash(source), hexSha256:hash(hex)};
}
fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("Exported 2 Nano sketches, HEX images and SHA-256 manifest to bootcamp/firmware.");
