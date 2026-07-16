/* FLASH6 mesh parsers. Loaded before flash6.js. */
(function(global){
  "use strict";

  function vec3Sub(a, b){
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function vec3Cross(a, b){
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function vec3Normalize(v){
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function triNormal(a, b, c){
    return vec3Normalize(vec3Cross(vec3Sub(b, a), vec3Sub(c, a)));
  }

  function pushSolidTri(mesh, a, b, c, color, na, nb, nc){
    const n = triNormal(a, b, c);
    const normals = [na || n, nb || n, nc || n];
    const verts = [a, b, c];
    for(let i = 0; i < 3; i++){
      mesh.pos.push(verts[i][0], verts[i][1], verts[i][2]);
      mesh.norm.push(normals[i][0], normals[i][1], normals[i][2]);
      mesh.col.push(color[0], color[1], color[2], color[3]);
    }
    mesh.count += 3;
  }

  function getXmlAttr(text, name, fallback){
    if(!text) return fallback;
    const token = name + "=\"";
    const start = text.indexOf(token);
    if(start < 0) return fallback;
    const valueStart = start + token.length;
    const end = text.indexOf("\"", valueStart);
    if(end < 0) return fallback;
    return text.slice(valueStart, end);
  }

  function parseHexColor(raw, fallback){
    const text = String(raw || "").trim().replace(/^#/, "");
    if(text.length !== 6 && text.length !== 8) return fallback;
    const value = Number.parseInt(text, 16);
    if(!Number.isFinite(value)) return fallback;
    if(text.length === 6){
      return [
        ((value >>> 16) & 255) / 255,
        ((value >>> 8) & 255) / 255,
        (value & 255) / 255,
        1
      ];
    }
    return [
      ((value >>> 24) & 255) / 255,
      ((value >>> 16) & 255) / 255,
      ((value >>> 8) & 255) / 255,
      (value & 255) / 255
    ];
  }

  function parse3mfColorGroups(xmlText, fallbackColor){
    const groups = new Map();
    const groupRe = /<(?:[A-Za-z_][\w.-]*:)?colorgroup\b[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?colorgroup>/g;
    const colorRe = /<(?:[A-Za-z_][\w.-]*:)?color\b[^>]*>/g;
    let match;
    while((match = groupRe.exec(xmlText))){
      const block = match[0];
      const openTag = block.match(/^<[^>]+>/);
      const id = openTag ? String(getXmlAttr(openTag[0], "id", "")) : "";
      if(!id) continue;
      const colors = [];
      let colorMatch;
      colorRe.lastIndex = 0;
      while((colorMatch = colorRe.exec(block))){
        colors.push(parseHexColor(getXmlAttr(colorMatch[0], "color", ""), fallbackColor));
      }
      if(colors.length) groups.set(id, colors);
    }
    return groups;
  }

  function parseBinaryStlMesh(arrayBuffer, options){
    const opts = options || {};
    const targetLength = Number(opts.targetLength) || 1;
    const yOffset = Number(opts.yOffset) || 0;
    const color = Array.isArray(opts.color) ? opts.color : [0.9,0.94,0.99,1];
    const view = new DataView(arrayBuffer);
    if(view.byteLength < 84) throw new Error("STL too small");
    const triCount = view.getUint32(80, true);
    const expectedSize = 84 + (triCount * 50);
    if(triCount <= 0 || expectedSize !== view.byteLength){
      throw new Error("Unsupported STL layout");
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let offset = 84;
    for(let i = 0; i < triCount; i++){
      offset += 12;
      for(let v = 0; v < 3; v++){
        const x = view.getFloat32(offset, true);
        const y = view.getFloat32(offset + 4, true);
        const z = view.getFloat32(offset + 8, true);
        if(x < minX) minX = x;
        if(y < minY) minY = y;
        if(z < minZ) minZ = z;
        if(x > maxX) maxX = x;
        if(y > maxY) maxY = y;
        if(z > maxZ) maxZ = z;
        offset += 12;
      }
      offset += 2;
    }

    const maxSpan = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    if(!(maxSpan > 0.00001)) throw new Error("Invalid STL bounds");

    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const scale = targetLength / maxSpan;
    const mesh = {pos:[], norm:[], col:[], count:0};

    const rotatePos = (x, y, z)=>{
      const lx = (x - cx) * scale;
      const ly = (y - cy) * scale;
      const lz = (z - cz) * scale;
      return [lx, lz + yOffset, -ly];
    };
    const rotateNorm = (x, y, z)=>vec3Normalize([x, z, -y]);

    offset = 84;
    for(let i = 0; i < triCount; i++){
      const nxRaw = view.getFloat32(offset, true);
      const nyRaw = view.getFloat32(offset + 4, true);
      const nzRaw = view.getFloat32(offset + 8, true);
      offset += 12;

      const v0 = rotatePos(view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true));
      offset += 12;
      const v1 = rotatePos(view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true));
      offset += 12;
      const v2 = rotatePos(view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true));
      offset += 14;

      const fileNormalLen = Math.hypot(nxRaw, nyRaw, nzRaw);
      const n = (fileNormalLen > 0.00001) ? rotateNorm(nxRaw, nyRaw, nzRaw) : triNormal(v0, v1, v2);
      pushSolidTri(mesh, v0, v1, v2, color, n, n, n);
    }

    return mesh;
  }

  function parseMobileMockup3mfMesh(xmlText, options){
    if(!xmlText) throw new Error("Empty 3MF model");
    const opts = options || {};
    const maxTriangles = Math.max(1, Number(opts.maxTriangles) || 16000);
    const targetSpan = Number(opts.targetSpan) || 2.35;
    const splitSourceZ = Number(opts.splitSourceZ);
    const splitEnabled = Number.isFinite(splitSourceZ);
    const color = Array.isArray(opts.color) ? opts.color : [0.62,0.62,0.59,1];
    const colorGroups = parse3mfColorGroups(xmlText, color);
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let vertexCount = 0;
    let totalTriangles = 0;

    const vertexBoundsRe = /<vertex\b[^>]*>/g;
    let vm;
    while((vm = vertexBoundsRe.exec(xmlText))){
      const tag = vm[0];
      const x = Number(getXmlAttr(tag, "x", NaN));
      const y = Number(getXmlAttr(tag, "y", NaN));
      const z = Number(getXmlAttr(tag, "z", NaN));
      if(!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
      vertexCount++;
      if(x < minX) minX = x;
      if(y < minY) minY = y;
      if(z < minZ) minZ = z;
      if(x > maxX) maxX = x;
      if(y > maxY) maxY = y;
      if(z > maxZ) maxZ = z;
    }
    const triangleCountRe = /<triangle\b/g;
    while(triangleCountRe.exec(xmlText)) totalTriangles++;
    if(vertexCount <= 0 || totalTriangles <= 0) throw new Error("Invalid 3MF mesh");

    const maxSpan = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const scale = targetSpan / maxSpan;
    const sampleEvery = Math.max(1, Math.ceil(totalTriangles / maxTriangles));
    const mesh = {
      pos:[],
      norm:[],
      col:[],
      count:0,
      triangles:totalTriangles,
      objects:0,
      bounds:{min:[minX,minY,minZ], max:[maxX,maxY,maxZ]}
    };
    if(splitEnabled){
      mesh.groups = {
        stage1:{pos:[], norm:[], col:[], count:0},
        stage2:{pos:[], norm:[], col:[], count:0}
      };
    }
    const convert = (p)=>[
      (p[0] - cx) * scale,
      (p[2] - cz) * scale,
      -(p[1] - cy) * scale
    ];

    const objectRe = /<object\b[\s\S]*?<\/object>/g;
    const vertexRe = /<vertex\b[^>]*>/g;
    const triangleRe = /<triangle\b[^>]*>/g;
    let triIndex = 0;
    let om;
    while((om = objectRe.exec(xmlText))){
      const block = om[0];
      if(block.indexOf("<mesh") < 0) continue;
      mesh.objects++;
      const objectOpen = block.match(/^<object\b[^>]*>/);
      const objectTag = objectOpen ? objectOpen[0] : "";
      const objectPid = String(getXmlAttr(objectTag, "pid", ""));
      const objectPindex = Number(getXmlAttr(objectTag, "pindex", 0));
      const objectName = String(getXmlAttr(objectTag, "name", ""));
      const vertices = [];
      let objectMinZ = Infinity;
      let objectMaxZ = -Infinity;
      vertexRe.lastIndex = 0;
      while((vm = vertexRe.exec(block))){
        const tag = vm[0];
        const x = Number(getXmlAttr(tag, "x", NaN));
        const y = Number(getXmlAttr(tag, "y", NaN));
        const z = Number(getXmlAttr(tag, "z", NaN));
        vertices.push([x,y,z]);
        if(isFinite(z)){
          objectMinZ = Math.min(objectMinZ, z);
          objectMaxZ = Math.max(objectMaxZ, z);
        }
      }
      if(!vertices.length) continue;
      const objectCenterZ = (objectMinZ + objectMaxZ) * 0.5;
      const isNamedStage2 = /(?:2\s*단|stage\s*2|second\s*stage)/i.test(objectName);
      const targetMesh = splitEnabled
        ? ((isNamedStage2 || objectCenterZ >= splitSourceZ) ? mesh.groups.stage2 : mesh.groups.stage1)
        : mesh;
      triangleRe.lastIndex = 0;
      let tm;
      while((tm = triangleRe.exec(block))){
        const include = (triIndex % sampleEvery) === 0;
        triIndex++;
        if(!include) continue;
        const tag = tm[0];
        const p0 = vertices[Number(getXmlAttr(tag, "v1", -1))];
        const p1 = vertices[Number(getXmlAttr(tag, "v2", -1))];
        const p2 = vertices[Number(getXmlAttr(tag, "v3", -1))];
        if(!p0 || !p1 || !p2) continue;
        const pid = String(getXmlAttr(tag, "pid", objectPid));
        const pindex = Number(getXmlAttr(tag, "p1", objectPindex));
        const group = colorGroups.get(pid);
        const triangleColor = group && group[pindex] ? group[pindex] : color;
        pushSolidTri(targetMesh, convert(p0), convert(p1), convert(p2), triangleColor);
      }
    }

    if(splitEnabled){
      mesh.count = mesh.groups.stage1.count + mesh.groups.stage2.count;
    }
    if(!mesh.count) throw new Error("No sampled 3MF triangles");
    return mesh;
  }

  global.FLASH6_MESH = Object.freeze({
    parseBinaryStlMesh,
    parseMobileMockup3mfMesh
  });
})(typeof window !== "undefined" ? window : globalThis);
