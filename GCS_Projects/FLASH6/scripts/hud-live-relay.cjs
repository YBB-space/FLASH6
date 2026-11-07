#!/usr/bin/env node
"use strict";

/*
 * FLASH6 HUD LIVE loopback relay.
 *
 * Main console:
 *   POST http://127.0.0.1:4177/hud
 * OBS overlay:
 *   GET  http://127.0.0.1:4177/hud-stream
 *
 * The relay is intentionally dependency-free, binds to loopback only, keeps
 * just the newest frame, and never accepts mission/control commands.
 */

const fs = require("fs");
const http = require("http");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = Math.max(1, Math.min(65535, Number(process.env.FLASH6_HUD_PORT) || 4177));
const ROOT = path.resolve(__dirname, "..");
const MAX_FRAME_BYTES = 64 * 1024;
const clients = new Set();
let latestFrame = "";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function applyCommonHeaders(response){
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Private-Network", "true");
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function sendJson(response, status, body){
  applyCommonHeaders(response);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function isValidHudFrame(text){
  if(!text || Buffer.byteLength(text, "utf8") > MAX_FRAME_BYTES) return false;
  try{
    const value = JSON.parse(text);
    return !!value && typeof value === "object" && !Array.isArray(value);
  }catch(_error){
    return false;
  }
}

function broadcast(text){
  const packet = "data: " + text.replace(/\r?\n/g, "") + "\n\n";
  for(const response of clients){
    try{ response.write(packet); }catch(_error){ clients.delete(response); }
  }
}

function serveStatic(requestPath, response){
  let pathname = requestPath === "/" ? "/overlay.html" : requestPath;
  try{ pathname = decodeURIComponent(pathname); }catch(_error){}
  const filePath = path.resolve(ROOT, "." + pathname);
  if(filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)){
    sendJson(response, 403, {ok:0, error:"FORBIDDEN"});
    return;
  }
  fs.stat(filePath, (statError, stat)=>{
    if(statError || !stat.isFile()){
      sendJson(response, 404, {ok:0, error:"NOT_FOUND"});
      return;
    }
    applyCommonHeaders(response);
    response.statusCode = 200;
    response.setHeader(
      "Content-Type",
      mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    );
    const stream = fs.createReadStream(filePath);
    stream.on("error", ()=>response.destroy());
    stream.pipe(response);
  });
}

const server = http.createServer((request, response)=>{
  const url = new URL(request.url || "/", "http://" + HOST + ":" + PORT);
  if(request.method === "OPTIONS"){
    applyCommonHeaders(response);
    response.statusCode = 204;
    response.end();
    return;
  }

  if(request.method === "GET" && url.pathname === "/health"){
    sendJson(response, 200, {
      ok: 1,
      service: "FLASH6_HUD_LIVE",
      subscribers: clients.size,
      hasFrame: !!latestFrame
    });
    return;
  }

  if(request.method === "GET" && url.pathname === "/hud-stream"){
    applyCommonHeaders(response);
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();
    response.write("retry: 750\n\n");
    clients.add(response);
    if(latestFrame) response.write("data: " + latestFrame + "\n\n");
    const remove = ()=>clients.delete(response);
    request.on("close", remove);
    request.on("aborted", remove);
    return;
  }

  if(request.method === "POST" && url.pathname === "/hud"){
    let size = 0;
    const chunks = [];
    request.on("data", (chunk)=>{
      size += chunk.length;
      if(size > MAX_FRAME_BYTES){
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", ()=>{
      if(size > MAX_FRAME_BYTES) return;
      const text = Buffer.concat(chunks).toString("utf8");
      if(!isValidHudFrame(text)){
        sendJson(response, 400, {ok:0, error:"INVALID_HUD_FRAME"});
        return;
      }
      latestFrame = text;
      broadcast(text);
      applyCommonHeaders(response);
      response.statusCode = 204;
      response.end();
    });
    return;
  }

  if(request.method === "GET"){
    serveStatic(url.pathname, response);
    return;
  }

  sendJson(response, 405, {ok:0, error:"METHOD_NOT_ALLOWED"});
});

const heartbeat = setInterval(()=>{
  for(const response of clients){
    try{ response.write(": keepalive\n\n"); }catch(_error){ clients.delete(response); }
  }
}, 15000);
heartbeat.unref();

function shutdown(){
  clearInterval(heartbeat);
  for(const response of clients){
    try{ response.end(); }catch(_error){}
  }
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0), 1000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.on("error", (error)=>{
  if(error && error.code === "EADDRINUSE"){
    console.error("FLASH6 HUD LIVE relay: port " + PORT + " is already in use.");
  }else{
    console.error("FLASH6 HUD LIVE relay failed:", error && error.message ? error.message : error);
  }
  process.exit(1);
});

server.listen(PORT, HOST, ()=>{
  console.log("FLASH6 HUD LIVE relay listening on http://" + HOST + ":" + PORT);
  console.log("OBS URL: http://" + HOST + ":" + PORT + "/overlay.html?mode=replay");
});
