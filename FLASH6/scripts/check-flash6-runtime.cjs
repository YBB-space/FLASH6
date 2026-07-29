#!/usr/bin/env node
/* Static structural checks for the split FLASH6 classic-script runtime. */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
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

function fail(message){
  console.error("FLASH6 runtime check failed: " + message);
  process.exitCode = 1;
}

const loader = fs.readFileSync(path.join(root, "flash6-loader.js"), "utf8");
let previousIndex = -1;
for(const name of runtimeModules){
  const filePath = path.join(root, "scripts", name);
  if(!fs.existsSync(filePath)){
    fail("missing runtime module " + name);
    continue;
  }
  const loaderIndex = loader.indexOf('"' + name + '"');
  if(loaderIndex < 0){
    fail("loader manifest is missing " + name);
  }else if(loaderIndex <= previousIndex){
    fail("loader order is invalid at " + name);
  }
  previousIndex = loaderIndex;
}

try{
  const combined = runtimeModules
    .map((name)=>fs.readFileSync(path.join(root, "scripts", name), "utf8"))
    .join("\n");
  new Function(combined);
  const bundlePath = path.join(root, "flash6.runtime.js");
  if(!fs.existsSync(bundlePath)){
    fail("generated flash6.runtime.js is missing");
  }else{
    const expectedBundle =
      "/* Generated FLASH6 runtime bundle. Edit scripts/flash6-*.js source modules. */\n" +
      combined;
    const bundle = fs.readFileSync(bundlePath, "utf8");
    if(bundle !== expectedBundle){
      fail("flash6.runtime.js is stale; run node scripts/build-flash6-runtime.cjs");
    }
  }
}catch(error){
  fail("combined runtime does not parse: " + error.message);
}

const cssSourceRoot = path.join(root, "styles", "src");
const cssSources = fs.readdirSync(cssSourceRoot)
  .filter((name)=>/^\d{2}-.+\.css$/i.test(name))
  .sort();
const expectedCss = cssSources
  .map((name)=>fs.readFileSync(path.join(cssSourceRoot, name), "utf8"))
  .join("");
const generatedCss = fs.readFileSync(path.join(root, "styles", "flash6-app.css"), "utf8");
if(expectedCss !== generatedCss){
  fail("styles/flash6-app.css is stale; run node scripts/build-flash6-css.cjs");
}

const html = fs.readFileSync(path.join(root, "flash6.html"), "utf8");
if(/\son(?:click|change|input|submit)=/i.test(html)){
  fail("inline DOM event handlers remain in flash6.html");
}
if(!html.includes("flash6-loader.js")){
  fail("flash6.html does not reference the dedicated runtime loader");
}
if(!html.includes("styles/flash6-app.css")){
  fail("flash6.html does not reference the dedicated application stylesheet");
}
if(!html.includes("scripts/flash6-watchdog.js")){
  fail("external boot watchdog is not referenced by flash6.html");
}

if(!process.exitCode){
  const bytes = runtimeModules.reduce(
    (sum, name)=>sum + fs.statSync(path.join(root, "scripts", name)).size,
    0
  );
  console.log(
    "FLASH6 runtime structure OK · " +
    runtimeModules.length + " modules · " +
    bytes.toLocaleString("en-US") + " bytes"
  );
}
