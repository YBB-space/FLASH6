#!/usr/bin/env node
/* Build the single-request FLASH6 stylesheet from ordered source layers. */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "styles", "src");
const outputPath = path.join(root, "styles", "flash6.css");
const files = fs.readdirSync(sourceRoot)
  .filter((name)=>/^\d{2}-.+\.css$/i.test(name))
  .sort();

if(!files.length){
  throw new Error("No ordered CSS source files were found in " + sourceRoot);
}

const output = files
  .map((name)=>fs.readFileSync(path.join(sourceRoot, name), "utf8"))
  .join("");

fs.writeFileSync(outputPath, output);
console.log("Built styles/flash6.css from " + files.length + " ordered layers.");
