"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");

require("./flash6-mesh.js");

const flashRoot = path.resolve(__dirname, "..");
const sourceName = "ALTIS INTELLIGNET3b3 Mockup.3mf";
const sourcePath = path.join(flashRoot, "3d", sourceName);
const outputPath = path.join(flashRoot, "3d", "ALTIS_INTELLIGNET3b3_Mockup.preview.json");
const sourceBytes = fs.readFileSync(sourcePath);
const xml = execFileSync("unzip", ["-p", sourcePath, "3D/3dmodel.model"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024
});

const mesh = globalThis.FLASH6_MESH.parseMobileMockup3mfMesh(xml, {
  maxTriangles: 16000
});
const preview = {
  source: "3d/" + sourceName,
  source_size: sourceBytes.length,
  source_sha256: crypto.createHash("sha256").update(sourceBytes).digest("hex"),
  mode: "sampled-object-color",
  count: mesh.count,
  pos: mesh.pos,
  norm: mesh.norm,
  col: mesh.col,
  triangles: mesh.triangles,
  sampled_triangles: Math.round(mesh.count / 3),
  objects: mesh.objects,
  bounds: mesh.bounds
};

fs.writeFileSync(outputPath, JSON.stringify(preview));
console.log(JSON.stringify({
  output:path.relative(flashRoot, outputPath),
  vertices:preview.count,
  sampledTriangles:preview.sampled_triangles,
  sourceTriangles:preview.triangles,
  objects:preview.objects,
  bytes:fs.statSync(outputPath).size,
  sourceSha256:preview.source_sha256
}, null, 2));
