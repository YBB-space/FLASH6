#!/usr/bin/env node
/* Protocol integration checks against a fragmented-stream STK500 Nano emulator. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {webcrypto, createHash} = require("node:crypto");
const root = path.resolve(__dirname, "..");
const storage = new Map();
const serial = Object.assign(new EventTarget(), {getPorts:async()=>[], requestPort:async()=>{ throw new Error("Unexpected port picker"); }});
const sandbox = {Uint8Array, TextEncoder, TextDecoder, AbortController, URL, setTimeout, clearTimeout,
  crypto:webcrypto, isSecureContext:true, navigator:{serial}, document:{baseURI:"http://localhost/flash6.html"},
  localStorage:{getItem:key=>storage.get(key), setItem:(key,value)=>storage.set(key,value)},
  fetch:async url=>{
    const file = path.join(root, new URL(url).pathname);
    return new Response(fs.existsSync(file) ? fs.readFileSync(file) : "missing", {status:fs.existsSync(file) ? 200 : 404});
  }
};
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "flash6-bootcamp-upload.js"), "utf8"), sandbox);
const api = sandbox.Flash6BootcampUpload;

class NanoEmulator{
  constructor(options = {}){
    this.options = options; this.connected = true; this.opened = false;
    this.memory = new Uint8Array(32768).fill(0xa5); this.address = 0;
    this.programs = 0; this.reads = 0; this.bauds = []; this.commands = [];
  }
  getInfo(){ return {usbVendorId:0x1a86, usbProductId:0x7523}; }
  async open({baudRate}){
    if(this.opened) throw new DOMException("Port already open", "InvalidStateError");
    this.opened = true; this.baud = baudRate; this.bauds.push(baudRate);
    this.readable = new ReadableStream({start:controller=>{ this.rx = controller; }});
    this.writable = new WritableStream({write:packet=>this.handle(packet)});
  }
  async setSignals(){ if(!this.opened) throw new Error("Port not open"); }
  async close(){ this.opened = false; }
  handle(packet){
    if(this.baud !== (this.options.baud || 115200)) return;
    assert.equal(packet[packet.length - 1], 0x20);
    const command = packet[0]; this.commands.push(command);
    let response = [];
    if(command === 0x75) response = this.options.wrongMcu ? [0x1e,0x94,0x06] : [0x1e,0x95,0x0f];
    else if(command === 0x42) assert.equal(packet.length, 22);
    else if(command === 0x55) this.address = (packet[1] + 256 * packet[2]) * 2;
    else if(command === 0x64){
      const count = packet[1] * 256 + packet[2];
      assert.equal(packet[3], 0x46); assert.equal(count, 128);
      assert.ok(this.address + count <= 30720, "bootloader must remain untouched");
      this.memory.set(packet.slice(4, 4 + count), this.address); this.programs++;
      if(this.options.unplug && this.programs === 2){
        this.connected = false; this.rx.error(new DOMException("Device lost", "NetworkError"));
        throw new DOMException("Device lost", "NetworkError");
      }
    }else if(command === 0x74){
      const count = packet[1] * 256 + packet[2];
      response = Array.from(this.memory.slice(this.address, this.address + count)); this.reads++;
      if(this.options.corrupt && this.reads === 1) response[3] ^= 0xff;
    }else assert.ok([0x30,0x50,0x51].includes(command), "unexpected STK500 command");
    // Split INSYNC, payload and OK across reads to exercise stream framing.
    this.rx.enqueue(Uint8Array.of(0x14));
    if(response.length) this.rx.enqueue(Uint8Array.from(response));
    this.rx.enqueue(Uint8Array.of(0x10));
  }
}

function record(address, type, data){
  const bytes = [data.length, address >> 8, address & 255, type, ...data];
  bytes.push((-bytes.reduce((sum,b)=>sum+b,0)) & 255);
  return ":" + bytes.map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
}
async function main(){
  const manifest = JSON.parse(fs.readFileSync(path.join(root,"bootcamp/firmware/manifest.json"),"utf8"));
  let image;
  for(const sensor of ["LSM6DSO","MPU6050"]){
    const lesson = await api.loadLesson(sensor); image = lesson.image;
    const entry = manifest.sensors[sensor];
    const authoritative = fs.readFileSync(path.resolve(root,"../../Firmwares/ALTIS_INTELLIGNET3_firmware/bootcamp_nano/examples",sensor+".ino"),"utf8");
    assert.equal(lesson.source, authoritative, "published example must match firmware source");
    assert.equal(createHash("sha256").update(authoritative).digest("hex"),entry.sourceSha256);
    assert.ok(image.length > 128 && image.length <= 30720);
    const port = new NanoEmulator(); const events = [];
    await api.flashNano(port, image, {onProgress:value=>events.push(value)});
    assert.deepEqual(port.memory.slice(0,image.length), image);
    assert.ok(port.memory.slice(30720).every(byte=>byte === 0xa5));
    assert.equal(port.programs, image.length/128); assert.equal(port.reads, port.programs);
    assert.equal(events.at(-1).percent,100); assert.equal(port.opened,false);
    assert.equal(port.readable.locked,false); assert.equal(port.writable.locked,false);
    console.log("PASS " + sensor + ": source/HEX hashes, full write/readback, stream cleanup");
  }
  const shortImage = image.slice(0,256);
  const old = new NanoEmulator({baud:57600});
  const oldResult = await api.flashNano(old,shortImage);
  assert.deepEqual(old.bauds,[115200,57600]); assert.equal(oldResult.baudRate,57600);
  console.log("PASS classic bootloader: automatic 115200 -> 57600 fallback");
  const wrong = new NanoEmulator({wrongMcu:true});
  await assert.rejects(api.flashNano(wrong,shortImage),error=>error.code === "MCU_MISMATCH");
  assert.equal(wrong.programs,0); assert.equal(wrong.opened,false);
  const corrupt = new NanoEmulator({corrupt:true}); const failedEvents = [];
  await assert.rejects(api.flashNano(corrupt,shortImage,{onProgress:value=>failedEvents.push(value)}),error=>error.code === "VERIFY_FAILED");
  assert.ok(!failedEvents.some(value=>value.percent===100)); assert.equal(corrupt.opened,false);
  const unplugged = new NanoEmulator({unplug:true});
  await assert.rejects(api.flashNano(unplugged,shortImage)); assert.equal(unplugged.opened,false);
  console.log("PASS wrong MCU, verification corruption and USB unplug: no false success");

  const eof = record(0,1,[]), valid = record(0,0,[1,2,3,4])+"\n"+eof;
  assert.equal(api.parseIntelHex(valid).length,128);
  assert.throws(()=>api.parseIntelHex(valid.replace(/.$/,"0")),error=>error.code === "HEX_CHECKSUM");
  assert.throws(()=>api.parseIntelHex(record(30720,0,[1])+"\n"+eof),error=>error.code === "HEX_TOO_LARGE");
  assert.throws(()=>api.parseIntelHex(record(0,0,[1,2])),error=>error.code === "HEX_INCOMPLETE");
  assert.throws(()=>api.parseIntelHex(valid+"\n"+record(0,0,[3])),error=>error.code === "HEX_FORMAT");
  console.log("PASS invalid HEX: checksum, flash bounds, EOF and trailing data rejected");

  const a = new NanoEmulator(), b = new NanoEmulator(); let pickerCalls = 0;
  serial.getPorts = async()=>[a]; serial.requestPort=async()=>{ pickerCalls++; return a; };
  const connection = new api.NanoConnection();
  await connection.start();
  assert.equal(connection.state.connected,true); assert.equal(pickerCalls,0);
  await connection.dispose(); assert.equal(a.opened,false);
  storage.clear(); serial.getPorts=async()=>[a,b];
  const ambiguous = new api.NanoConnection();
  await ambiguous.start(); assert.equal(ambiguous.state.connected,false);
  assert.equal(a.opened,false); assert.equal(b.opened,false);
  await ambiguous.connect(true); assert.equal(pickerCalls,1);
  await ambiguous.upload({image:shortImage});
  assert.equal(ambiguous.state.phase,"uploaded");
  assert.equal(ambiguous.state.connected,true,"reconnect to the same chosen Nano even with multiple permitted devices");
  assert.equal(b.opened,false);
  await ambiguous.dispose();
  console.log("PASS automatic connection, explicit selection for ambiguous devices, and reconnect after upload");
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
