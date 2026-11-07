/* Nano bootcamp uploader: Web Serial + STK500v1, no remote compiler/service.
 * Protocol: ArduinoCore-avr/bootloaders/{optiboot,atmega}; ATmega328P only.
 */
window.Flash6BootcampUpload = (function(){
  "use strict";
  const PAGE_SIZE = 128;
  const FLASH_LIMIT = 30720; // Preserve the classic Nano's 2 KiB bootloader.
  const SIGNATURE = [0x1e, 0x95, 0x0f];
  const delay = ms=>new Promise(resolve=>setTimeout(resolve, ms));
  const fault = (code, message)=>Object.assign(new Error(message || code), {code});
  function timed(promise, ms, code){
    let timer;
    return Promise.race([promise, new Promise((_, reject)=>{
      timer = setTimeout(()=>reject(fault(code)), ms);
    })]).finally(()=>clearTimeout(timer));
  }

  function parseIntelHex(text){
    const memory = new Uint8Array(FLASH_LIMIT).fill(0xff);
    const seen = new Uint8Array(FLASH_LIMIT);
    let base = 0, size = 0, eof = false;
    for(const raw of String(text).split(/\r?\n/)){
      const line = raw.trim();
      if(!line) continue;
      if(eof || !/^:(?:[0-9a-f]{2})+$/i.test(line)) throw fault("HEX_FORMAT");
      const bytes = Uint8Array.from(line.slice(1).match(/../g), x=>parseInt(x, 16));
      const count = bytes[0], address = bytes[1] * 256 + bytes[2], type = bytes[3];
      if(bytes.length !== count + 5 || bytes.reduce((sum, b)=>sum + b, 0) % 256) throw fault("HEX_CHECKSUM");
      const data = bytes.slice(4, 4 + count);
      if(type === 0){
        const start = base + address;
        if(start + count > FLASH_LIMIT) throw fault("HEX_TOO_LARGE");
        data.forEach((b, i)=>{
          if(seen[start + i] && memory[start + i] !== b) throw fault("HEX_OVERLAP");
          memory[start + i] = b; seen[start + i] = 1;
        });
        size = Math.max(size, start + count);
      }else if(type === 1){
        if(count || address) throw fault("HEX_FORMAT");
        eof = true;
      }else if(type === 2 || type === 4){
        if(count !== 2 || address) throw fault("HEX_FORMAT");
        base = (data[0] * 256 + data[1]) * (type === 2 ? 16 : 65536);
      }else if(type === 3 || type === 5){
        if(count !== 4 || address) throw fault("HEX_FORMAT");
      }else throw fault("HEX_RECORD");
    }
    if(!eof || !size || !seen[0] || !seen[1]) throw fault("HEX_INCOMPLETE");
    return memory.slice(0, Math.ceil(size / PAGE_SIZE) * PAGE_SIZE);
  }

  // A single read pump owns the stream. Timeouts never leave competing reads.
  class SerialIO{
    constructor(port){ this.port = port; this.bytes = []; this.waiter = null; this.closed = false; this.error = null; }
    async open(baudRate){
      await this.port.open({baudRate, bufferSize:4096, flowControl:"none"});
      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      this.pump = this.readPump();
      return this;
    }
    async readPump(){
      try{
        while(!this.closed){
          const {value, done} = await this.reader.read();
          if(done) break;
          if(value){
            this.bytes.push(...value);
            if(this.bytes.length > 16384) throw fault("SERIAL_OVERFLOW");
            this.flush();
          }
        }
        if(!this.closed) this.fail(fault("SERIAL_DISCONNECTED"));
      }catch(error){ if(!this.closed) this.fail(error); }
    }
    fail(error){
      this.error = error;
      if(this.waiter){
        const waiter = this.waiter; this.waiter = null;
        clearTimeout(waiter.timer); waiter.reject(error);
      }
    }
    flush(){
      const waiter = this.waiter;
      if(!waiter || this.bytes.length < waiter.count) return;
      this.waiter = null; clearTimeout(waiter.timer);
      waiter.resolve(Uint8Array.from(this.bytes.splice(0, waiter.chunk ? this.bytes.length : waiter.count)));
    }
    read(count, timeout = 1200, chunk = false){
      if(this.closed || this.error) return Promise.reject(this.error || fault("SERIAL_CLOSED"));
      if(this.waiter) return Promise.reject(fault("SERIAL_READ_BUSY"));
      return new Promise((resolve, reject)=>{
        const timer = setTimeout(()=>{ this.waiter = null; reject(fault("SERIAL_TIMEOUT")); }, timeout);
        this.waiter = {count, chunk, resolve, reject, timer}; this.flush();
      });
    }
    clear(){ this.bytes.length = 0; }
    async command(data, responseLength = 0, timeout = 1200){
      await timed(this.writer.write(Uint8Array.from([...data, 0x20])), 2000, "SERIAL_WRITE_TIMEOUT");
      const response = await this.read(responseLength + 2, timeout);
      if(response[0] !== 0x14 || response[response.length - 1] !== 0x10) throw fault("STK_PROTOCOL");
      return response.slice(1, -1);
    }
    async close(){
      if(this.closed) return;
      this.closed = true; this.fail(fault("SERIAL_CLOSED"));
      try{ if(this.reader) await this.reader.cancel(); }catch(_e){}
      try{ if(this.pump) await this.pump; }catch(_e){}
      try{ if(this.reader) this.reader.releaseLock(); }catch(_e){}
      try{ if(this.writer) this.writer.releaseLock(); }catch(_e){}
      try{ await this.port.close(); }catch(_e){}
    }
  }

  async function resetNano(port){
    await port.setSignals({dataTerminalReady:false, requestToSend:false});
    await delay(100);
    await port.setSignals({dataTerminalReady:true, requestToSend:true});
    await delay(150);
  }

  async function flashNano(port, image, options = {}){
    if(!(image instanceof Uint8Array) || !image.length || image.length % PAGE_SIZE || image.length > FLASH_LIMIT) throw fault("HEX_TOO_LARGE");
    const report = options.onProgress || (()=>{});
    const log = options.onLog || (()=>{});
    let io = null, matchedBaud = 0;
    try{
      for(const baud of [115200, 57600]){
        report({phase:"detecting", percent:0, message:"Nano 부트로더 확인 중…"});
        log("부트로더 연결 시도 · " + baud + " baud");
        try{
          io = new SerialIO(port);
          await io.open(baud);
          await resetNano(port);
          let synced = false;
          for(let attempt = 0; attempt < 4 && !synced; attempt++){
            io.clear();
            try{ await io.command([0x30], 0, 350); synced = true; }
            catch(error){ if(attempt === 3) throw error; }
          }
          const signature = await io.command([0x75], 3);
          if(!SIGNATURE.every((b, i)=>signature[i] === b)) throw fault("MCU_MISMATCH", "ATmega328P가 아닌 보드입니다.");
          matchedBaud = baud;
          break;
        }catch(error){
          if(io) await io.close(); io = null;
          if(error.code === "MCU_MISMATCH" || baud === 57600) throw error;
        }
      }
      // STK_SET_DEVICE: 128-byte flash pages, 1 KiB EEPROM, 32 KiB flash.
      await io.command([0x42, 0x86,0,0,1,1,1,1,3,0xff,0xff,0xff,0xff,0,128,4,0,0,0,128,0]);
      await io.command([0x50]);
      const pages = image.length / PAGE_SIZE;
      const loadAddress = offset=>io.command([0x55, (offset / 2) & 0xff, (offset / 2) >> 8]);
      for(let page = 0; page < pages; page++){
        const offset = page * PAGE_SIZE;
        await loadAddress(offset);
        await io.command([0x64, 0, PAGE_SIZE, 0x46, ...image.slice(offset, offset + PAGE_SIZE)]);
        report({phase:"writing", percent:Math.round(5 + 45 * (page + 1) / pages), message:"코드를 Nano에 쓰는 중…"});
      }
      for(let page = 0; page < pages; page++){
        const offset = page * PAGE_SIZE;
        await loadAddress(offset);
        const actual = await io.command([0x74, 0, PAGE_SIZE, 0x46], PAGE_SIZE);
        if(!actual.every((b, i)=>b === image[offset + i])) throw fault("VERIFY_FAILED", "업로드한 코드의 검증에 실패했습니다. 다시 업로드해주세요.");
        report({phase:"verifying", percent:Math.round(50 + 45 * (page + 1) / pages), message:"업로드한 코드를 검증하는 중…"});
      }
      await io.command([0x51]);
      report({phase:"uploaded", percent:100, message:"업로드·검증 완료"});
      log("업로드·전체 읽기 검증 완료 · " + image.length + " bytes");
      return {baudRate:matchedBaud, bytes:image.length};
    }finally{ if(io) await io.close(); }
  }

  async function fetchText(url){
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 10000);
    try{
      const response = await fetch(url, {cache:"no-store", signal:controller.signal});
      if(!response.ok) throw fault("ASSET_HTTP", "예제 파일을 불러오지 못했습니다 (" + response.status + ").");
      return await response.text();
    }finally{ clearTimeout(timer); }
  }
  async function sha256(text){
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2, "0")).join("");
  }
  async function loadLesson(sensor){
    if(!["LSM6DSO", "MPU6050"].includes(sensor)) throw fault("SENSOR_INVALID");
    const url = new URL("bootcamp/firmware/manifest.json", document.baseURI);
    const manifest = JSON.parse(await fetchText(url));
    if(manifest.schema !== 1 || manifest.board !== "arduino-nano" || manifest.mcu !== "atmega328p" ||
       !Array.isArray(manifest.signature) || !SIGNATURE.every((b, i)=>manifest.signature[i] === b)) throw fault("MANIFEST_INVALID");
    const entry = manifest.sensors && manifest.sensors[sensor];
    if(!entry || !/^[\w.-]+\.ino$/.test(entry.source) || !/^[\w.-]+\.hex$/.test(entry.hex)) throw fault("MANIFEST_INVALID");
    const sourceUrl = new URL(entry.source, url), hexUrl = new URL(entry.hex, url);
    const [source, hex] = await Promise.all([fetchText(sourceUrl), fetchText(hexUrl)]);
    const [sourceHash, hexHash] = await Promise.all([sha256(source), sha256(hex)]);
    if(sourceHash !== entry.sourceSha256 || hexHash !== entry.hexSha256) throw fault("ASSET_CHECKSUM", "예제 파일 버전이 맞지 않습니다. 새로고침 후 다시 시도해주세요.");
    return {sensor, source, sourceUrl:sourceUrl.href, image:parseIntelHex(hex)};
  }

  function explain(error){
    if(error && error.name === "NotFoundError") return "장치 선택이 취소되었습니다. Nano 연결 버튼을 눌러 다시 선택하세요.";
    if(error && error.name === "SecurityError") return "USB 접근이 허용되지 않았습니다. 브라우저의 시리얼 포트 권한을 확인하세요.";
    if(error && error.name === "InvalidStateError") return "포트가 사용 중입니다. Arduino IDE의 시리얼 모니터를 닫고 다시 연결하세요.";
    const code = error && error.code;
    if(code === "SERIAL_TIMEOUT" || code === "STK_PROTOCOL") return "Nano 응답이 없습니다. 데이터 USB 케이블과 보드 종류를 확인하세요. 자동 리셋이 안 되면 업로드 시작 시 RESET을 한 번 눌러주세요.";
    if(code === "SERIAL_WRITE_TIMEOUT" || code === "SERIAL_DISCONNECTED" || code === "SERIAL_CLOSED") return "USB 연결이 끊겼습니다. 케이블을 연결한 후 다시 업로드해주세요.";
    if(error && error.message && error.message !== code) return error.message;
    return "작업에 실패했습니다. USB 연결과 포트 사용 상태를 확인하고 다시 시도해주세요.";
  }

  class NanoConnection{
    constructor(callbacks = {}){
      this.callbacks = callbacks; this.port = null; this.io = null; this.busy = false;
      this.enabled = false; this.generation = 0; this.preferredPort = null; this.lastSampleAt = 0;
      this.state = {connected:false, busy:false, phase:"idle", percent:0, message:"Nano를 USB로 연결해주세요."};
    }
    notify(patch){
      Object.assign(this.state, patch, {busy:this.busy});
      if(this.callbacks.onState) this.callbacks.onState({...this.state});
    }
    log(line){ if(this.callbacks.onLog) this.callbacks.onLog(line); }
    supported(){ return !!(window.isSecureContext && navigator.serial); }
    async start(){
      this.enabled = true;
      if(!this.supported()){
        this.notify({phase:"unsupported", message:"PC용 Chrome·Edge·Whale에서 HTTPS 또는 localhost로 열어주세요."});
        return;
      }
      if(!this.bound){
        this.bound = true;
        this.onConnect = ()=>{ if(this.enabled && !this.port && !this.busy) this.connect(false).catch(()=>{}); };
        this.onDisconnect = event=>{
          const port = event.port || event.target;
          if(port !== this.port) return;
          this.lastSampleAt = 0;
          this.notify({connected:false, message:"Nano USB 연결이 끊겼습니다."});
          if(!this.busy) this.disconnect().then(()=>{
            if(this.enabled) return this.connect(false);
          }).catch(()=>{});
        };
        navigator.serial.addEventListener("connect", this.onConnect);
        navigator.serial.addEventListener("disconnect", this.onDisconnect);
      }
      if(!this.port && !this.busy) await this.connect(false);
    }
    async grantedPort(){
      const ports = (await navigator.serial.getPorts()).filter(port=>port.connected !== false);
      if(ports.includes(this.preferredPort)) return this.preferredPort;
      let preferred = "";
      try{ preferred = localStorage.getItem("flash6_bootcamp_nano_usb") || ""; }catch(_e){}
      const key = port=>{ const info = port.getInfo(); return JSON.stringify([info.usbVendorId || 0, info.usbProductId || 0]); };
      const remembered = ports.filter(port=>key(port) === preferred);
      if(remembered.length === 1) return remembered[0];
      const known = ports.filter(port=>[0x0403,0x1a86,0x2341,0x2a03,0x10c4].includes(port.getInfo().usbVendorId));
      return known.length === 1 ? known[0] : null;
    }
    async closeIO(){
      this.generation++;
      const io = this.io; this.io = null;
      if(io) await io.close();
    }
    async connect(prompt = false){
      if(this.busy || !this.supported()) return false;
      if(this.io && !prompt) return true;
      this.busy = true;
      this.notify({phase:"connecting", message:prompt ? "브라우저에서 Nano 포트를 선택해주세요." : "허용된 Nano 포트를 찾는 중…"});
      try{
        // requestPort runs directly in the button's user gesture, before other awaits.
        const port = prompt ? await navigator.serial.requestPort({}) : await this.grantedPort();
        if(!port){
          this.notify({phase:"idle", connected:false, message:"처음 연결할 때만 ‘Nano 연결’을 눌러 포트를 선택하세요. 이후에는 자동 연결됩니다."});
          return false;
        }
        await this.closeIO(); this.port = port; this.preferredPort = port;
        const io = new SerialIO(port); this.io = io;
        await io.open(115200);
        const info = port.getInfo();
        try{ localStorage.setItem("flash6_bootcamp_nano_usb", JSON.stringify([info.usbVendorId || 0, info.usbProductId || 0])); }catch(_e){}
        this.notify({connected:true, phase:"connected", message:"USB 포트 연결됨 · 코드 업로드를 시작할 수 있습니다."});
        this.log("USB 연결 · 115200 baud"); this.monitor(io, ++this.generation);
        return true;
      }catch(error){
        if(!this.io || this.io.error || error.name !== "NotFoundError"){
          await this.closeIO(); this.port = null;
          this.notify({connected:false, phase:"error", message:explain(error)});
        }else this.notify({phase:"connected", message:explain(error)});
        return false;
      }finally{ this.busy = false; this.notify({}); }
    }
    async monitor(io, generation){
      const decoder = new TextDecoder(); let buffer = "";
      while(this.io === io && generation === this.generation){
        try{
          const chunk = await io.read(1, 2000, true);
          buffer += decoder.decode(chunk, {stream:true});
          if(buffer.length > 8192) buffer = buffer.slice(-4096);
          let end;
          while((end = buffer.indexOf("\n")) >= 0){
            const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
            if(!line) continue;
            try{
              const data = JSON.parse(line);
              if(data && ["LSM6DSO","MPU6050"].includes(data.sensor) && ["ready","telemetry","error"].includes(data.type)){
                if(data.type === "telemetry" && ["ax","ay","az","gx","gy","gz"].every(key=>typeof data[key] === "number" && Number.isFinite(data[key]))){
                  this.lastSampleAt = Date.now();
                  if(this.callbacks.onSample) this.callbacks.onSample(data);
                }else if(data.type !== "telemetry" && this.callbacks.onDevice) this.callbacks.onDevice(data);
              }
            }catch(_e){}
          }
        }catch(error){
          if(this.io !== io || generation !== this.generation) return;
          if(error.code === "SERIAL_TIMEOUT") continue;
          this.notify({connected:false, phase:"error", message:explain(error)});
          await this.closeIO(); this.port = null; return;
        }
      }
    }
    async upload(lesson){
      if(this.busy || !this.io || !this.port || !lesson) return false;
      this.busy = true;
      this.notify({phase:"detecting", percent:0, message:"업로드 준비 중…"});
      const port = this.port;
      try{
        await this.closeIO();
        await flashNano(port, lesson.image, {onProgress:value=>this.notify(value), onLog:line=>this.log(line)});
        this.lastSampleAt = 0;
        return true;
      }catch(error){
        this.notify({phase:"error", percent:0, message:explain(error)});
        this.log("업로드 실패 · " + explain(error));
        return false;
      }finally{
        this.busy = false; this.port = null;
        const uploaded = this.state.phase === "uploaded";
        const message = this.state.message;
        // Bootloader and serial monitor use separate, fully released handles.
        if(this.enabled){
          await this.connect(false);
          if(uploaded) this.notify({phase:"uploaded", percent:100, message:this.state.connected ? "업로드·검증 완료 · 센서 응답을 기다립니다." : "업로드·검증 완료 · Nano USB를 다시 연결해주세요."});
          else this.notify({phase:"error", message});
        }else this.notify({connected:false});
      }
    }
    async disconnect(){
      if(this.busy) return;
      await this.closeIO(); this.port = null; this.lastSampleAt = 0;
      this.notify({connected:false, phase:"idle", percent:0, message:"Nano를 USB로 연결해주세요."});
    }
    async dispose(){
      this.enabled = false;
      if(this.bound){
        navigator.serial.removeEventListener("connect", this.onConnect);
        navigator.serial.removeEventListener("disconnect", this.onDisconnect);
        this.bound = false;
      }
      await this.disconnect();
    }
  }
  return {parseIntelHex, flashNano, loadLesson, NanoConnection, SerialIO, explain};
})();
