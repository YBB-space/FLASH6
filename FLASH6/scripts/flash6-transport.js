/* FLASH6 runtime module: flash6-transport.js. Loaded in manifest order by flash6.js. */
    // Protocol decoding is implemented in scripts/flash6-protocol.js.

    let wsBaseCandidateIndex = 0;
    function buildWsUrlFromBase(base){
      if(base){
        try{
          const u = new URL(base);
          const wsProto = (u.protocol === "https:") ? "wss:" : "ws:";
          return wsProto + "//" + (u.host || "192.168.4.1") + "/ws";
        }catch(_e){}
      }
      const proto = (location.protocol === "https:") ? "wss" : "ws";
      return proto + "://" + (location.host || "192.168.4.1") + "/ws";
    }
    function getWsTarget(){
      const bases = getApiBaseCandidates().filter((v)=>!!v);
      if(!bases.length){
        return {base:BOARD_FALLBACK_HTTP, url:buildWsUrlFromBase(BOARD_FALLBACK_HTTP), idx:0, count:1};
      }
      const idx = ((wsBaseCandidateIndex % bases.length) + bases.length) % bases.length;
      const base = bases[idx];
      return {base, url:buildWsUrlFromBase(base), idx, count:bases.length};
    }
    function getWsUrl(){
      return getWsTarget().url;
    }

    function addWsLog(msg){
      if(!wsLogSilent) addLogLine(msg, "NET");
    }

    function scheduleWsReconnect(reason){
      if(serialEnabled) return;
      if(wsRetryTimer) return;
      const delay = Math.min(WS_RETRY_MAX_MS, wsRetryMs);
      wsRetryMs = Math.min(WS_RETRY_MAX_MS, Math.round(wsRetryMs * 1.6 + 80));
      wsRetryTimer = setTimeout(()=>{ wsRetryTimer = null; openWebSocket(); }, delay);

      if(reason){
        addWsLog(t("wsReconnect", {reason}));
      }
    }

    function closeWsSocketSafe(closeCode, closeReason){
      if(!wsSocket) return;
      const sock = wsSocket;
      wsSocket = null;
      try{
        if(sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING){
          sock.close(closeCode || 1000, closeReason || "reconnect");
        }
      }catch(_e){}
    }

    function openWebSocket(){
      if(replaySourceActive) return;
      if(serialEnabled) return;
      if(wsSocket){
        const rs = wsSocket.readyState;
        if(rs === WebSocket.OPEN || rs === WebSocket.CONNECTING){
          return;
        }
        wsSocket = null;
      }
      const url = getWsUrl();
      const wsTarget = getWsTarget();
      wsLastOpenAttemptMs = Date.now();
      wsConnectStartedMs = wsLastOpenAttemptMs;
      addWsLog(t("wsConnecting", {url}));
      try{
        wsSocket = new WebSocket(url);
      }catch(e){
        wsSocket = null;
        scheduleWsReconnect("open failed");
        return;
      }

      wsSocket.onopen = ()=>{
        wsConnected = true;
        wsEverConnected = true;
        wsConnectStartedMs = 0;
        wsLastMsgMs = Date.now();
        wsBaseCandidateIndex = 0;
        if(wsTarget && wsTarget.base){
          setApiBaseOverride(wsTarget.base, isLocalPreviewHost());
        }
        if(!wsBootOpenBeaconSent){
          wsBootOpenBeaconSent = true;
          bootBeacon("ws_open");
        }
        setAlarmActive("WS_DISCONNECTED", false);
        updateWsUI();
        wsRetryMs = 300;
        addWsLog(t("wsConnected", {url}));
        syncDaqSequencePyroChannelToBoard(false);
      };

      wsSocket.onmessage = (ev)=>{
        wsLastMsgMs = Date.now();
        if(!ev || !ev.data) return;
        try{
          const obj = decodeFlash6ProtocolFrame(JSON.parse(ev.data));
          if(obj) onIncomingSample(obj, "WS");
        }catch(e){
          reportSilentException("ws-json", e);
        }
      };

      wsSocket.onerror = ()=>{
        wsConnected = false;
        wsConnectStartedMs = 0;
        if(!wsBootErrorBeaconSent){
          wsBootErrorBeaconSent = true;
          bootBeacon("ws_error");
        }
        addWsLog(t("wsError"));
        setAlarmActive("WS_DISCONNECTED", wsEverConnected && !serialEnabled);
        updateWsUI();
      };

      wsSocket.onclose = (ev)=>{
        wsConnected = false;
        wsConnectStartedMs = 0;
        wsSocket = null;
        const total = (wsTarget && wsTarget.count) ? wsTarget.count : 1;
        if(total > 1){
          wsBaseCandidateIndex = (wsBaseCandidateIndex + 1) % total;
        }
        const code = ev?.code ?? 0;
        const reason = ev?.reason || "-";
        if(!wsBootErrorBeaconSent && code !== 1000){
          wsBootErrorBeaconSent = true;
          bootBeacon("ws_close", "code=" + code);
        }
        addWsLog(t("wsClosed", {code, reason}));
        setAlarmActive("WS_DISCONNECTED", wsEverConnected && !serialEnabled);
        updateWsUI();
        scheduleWsReconnect("closed");
      };
    }

    function ensureWsAlive(){
      if(replaySourceActive) return;
      if(serialEnabled) return;
      const now = Date.now();
      if(wsConnected && (now - wsLastMsgMs) > DISCONNECT_GRACE_MS){
        failStreak = FAIL_STREAK_LIMIT;
        markDisconnectedIfNeeded(t("wsTimeout"));
        wsConnected = false;
        closeWsSocketSafe(4001, "ws stale timeout");
        scheduleWsReconnect("timeout");
        updateWsUI();
      }else if(!wsConnected){
        const socketState = wsSocket ? wsSocket.readyState : WebSocket.CLOSED;
        if(socketState === WebSocket.CONNECTING){
          if(wsConnectStartedMs > 0 && (now - wsConnectStartedMs) > WS_CONNECT_TIMEOUT_MS){
            closeWsSocketSafe(4002, "connect timeout");
            scheduleWsReconnect("connect timeout");
          }
        }else if((socketState === WebSocket.CLOSED || socketState === WebSocket.CLOSING) && !wsRetryTimer){
          if((now - wsLastOpenAttemptMs) >= 300){
            scheduleWsReconnect("ensure alive");
          }
        }
      }
      evaluateRuntimeAlarms(Date.now());
    }

    function ensureSerialAlive(){
      if(
        firmwareUpdateUiBusy ||
        !serialEnabled ||
        !serialConnected ||
        serialConnectBusy ||
        serialStaleRecoveryBusy
      ) return;
      const lastActivity = Math.max(lastSerialActivityAt || 0, lastSerialSampleAt || 0);
      if(!lastActivity || (Date.now() - lastActivity) <= SERIAL_LINK_STALE_MS) return;
      serialStaleRecoveryBusy = true;
      addLogLine("WebSerial link stale; reopening the verified FLASH6 board port.", "SER");
      serialConnected = false;
      serialConnectedRole = "";
      flushSerialAckWaiters("SERIAL_STALE");
      updateSerialPill();
      connOk = false;
      updateConnectionUI(false);
      closeSerialHandles({closePort:true}).finally(()=>{
        serialPort = null;
        serialStaleRecoveryBusy = false;
        scheduleSerialAutoReconnect("stale link");
      });
    }

    // =====================
    // 통신: Wi-Fi 폴링
    // =====================
    async function fetchJsonTimeout(url, timeoutMs){
      const ctrl = createAbortControllerSafe();
      const t = ctrl ? setTimeout(()=>{ try{ ctrl.abort(); }catch(e){} }, timeoutMs) : null;
      try{
        const sep = String(url || "").indexOf("?") >= 0 ? "&" : "?";
        const requestUrl = String(url || "") + sep + "_ts=" + Date.now();
        if(shouldUseNativeBoardHttp(requestUrl)){
          const data = await nativeBoardHttpGet(requestUrl, timeoutMs || 1600, "json");
          if(typeof data === "string"){
            return JSON.parse(data);
          }
          return data;
        }
        const resp = await fetch(requestUrl, ctrl ? { signal: ctrl.signal } : {});
        if(!resp.ok) throw new Error("HTTP " + resp.status);
        return await resp.json();
      }finally{
        if(t) clearTimeout(t);
      }
    }

    function normalizeNetError(err, fallbackText){
      const raw = (err && err.message) ? String(err.message) : String(err || "");
      const low = raw.toLowerCase();
      if(err && err.name === "AbortError") return "요청 시간 초과 (보드 연결/응답 지연)";
      if(low.indexOf("aborted") >= 0) return "요청 시간 초과 (보드 연결/응답 지연)";
      if(low.indexOf("failed to fetch") >= 0) return "보드에 연결할 수 없음";
      if(low.indexOf("networkerror") >= 0) return "네트워크 오류";
      if(low.indexOf("http ") >= 0) return raw.toUpperCase();
      return raw || fallbackText || "알 수 없는 오류";
    }

    async function fetchJsonWithFallback(timeoutMs){
      const order = [preferredEndpoint, ...ENDPOINTS.filter(e=>e!==preferredEndpoint)];
      const bases = getApiBaseCandidates();
      let lastErr = null;

      for(const base of bases){
        for(const path of order){
          const url = base ? (base + path) : path;
          try{
            const obj = decodeFlash6ProtocolFrame(await fetchJsonTimeout(url, timeoutMs || 1600));
            if(!obj) throw new Error("unsupported telemetry protocol");
            preferredEndpoint = path;
            if(base){
              setApiBaseOverride(base, isLocalPreviewHost());
            }
            return obj;
          }catch(e){
            lastErr = e;
          }
        }
      }
      throw (lastErr || new Error("no valid endpoint"));
    }

    function markDisconnectedIfNeeded(reason){
      if(replaySourceActive) return;
      if(serialEnabled && serialConnected) return;
      const now = Date.now();
      const sinceOk = now - (lastOkMs || 0);

      if(sinceOk > DISCONNECT_GRACE_MS && failStreak >= FAIL_STREAK_LIMIT){
        if(connOk){
          connOk = false;
          updateConnectionUI(false);
        }
        if(typeof window !== "undefined" && window.Flash6 && window.Flash6.telemetryStore){
          window.Flash6.telemetryStore.patch({
            connected:false,
            receivedAt:now,
            disconnectReason:reason || t("statusNoResponse")
          });
        }

        if(el.statusPill && el.statusText && !lockoutLatched){
          el.statusPill.className="status-disc hidden";
          el.statusPill.textContent = "";
          el.statusText.textContent = reason || t("statusNoResponse");
          syncCountdownInlineStatus();
        }

        if(!disconnectedLogged){
          if(!wsLogSilent) addLogLine(t("wsLost"), "DISC");
          disconnectedLogged = true;
        }

        if(!unstableToastShown){
          unstableToastShown = true;
          showToast(t("boardUnstable"), "warn");
        }
      }
    }

    // =====================
    // WebSerial helpers
    // =====================
    function serialSupported(){ return !!(navigator && navigator.serial); }

    function initSerialPortEvents(){
      if(serialPortEventsBound || !serialSupported() || !navigator.serial.addEventListener) return;
      serialPortEventsBound = true;
      navigator.serial.addEventListener("disconnect", ()=>{
        if(!serialConnected && !serialEnabled) return;
        addLogLine("WebSerial port disconnected by browser event.", "SER");
        if(serialConnected){
          serialConnected = false;
          serialConnectedRole = "";
          flushSerialAckWaiters("SERIAL_DISCONNECTED");
          updateSerialPill();
          connOk = false;
          updateConnectionUI(false);
        }
        if(serialEnabled){
          showDisconnectOverlay();
          scheduleSerialAutoReconnect("port disconnect");
        }
      });
      navigator.serial.addEventListener("connect", ()=>{
        if(serialEnabled && !serialConnected){
          scheduleSerialAutoReconnect("port connect");
        }
      });
    }

    function serialPromiseWithTimeout(promise, timeoutMs, code){
      let timer = null;
      return Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject)=>{
          timer = setTimeout(()=>{
            const err = new Error(code || "SERIAL_OPERATION_TIMEOUT");
            err.name = "TimeoutError";
            reject(err);
          }, Math.max(100, Number(timeoutMs) || 1000));
        })
      ]).finally(()=>{
        if(timer) clearTimeout(timer);
      });
    }

    async function waitForSerialSampleAfter(startedAt, timeoutMs){
      const deadline = Date.now() + Math.max(500, Number(timeoutMs) || 3500);
      while(Date.now() < deadline){
        if(!serialConnected) return false;
        if(lastSerialSampleAt >= startedAt) return true;
        await new Promise(resolve=>setTimeout(resolve, 50));
      }
      return lastSerialSampleAt >= startedAt;
    }

    function serialBaudCandidates(){
      const out = [];
      const seen = new Set();
      for(const raw of SERIAL_BAUD_CANDIDATES){
        const baud = Math.round(Number(raw));
        if(!isFinite(baud) || baud <= 0) continue;
        if(seen.has(baud)) continue;
        seen.add(baud);
        out.push(baud);
      }
      if(!out.length){
        out.push(SERIAL_BAUD_RATE);
      }
      return out;
    }

    async function closeSerialHandles(opts){
      const closePort = !opts || opts.closePort !== false;
      serialSessionId++;
      cancelQueuedSerialTelemetry();
      const reader = serialReader;
      const writer = serialWriter;
      const port = serialPort;
      serialReader = null;
      serialWriter = null;
      if(serialReadAbort){ try{ serialReadAbort.abort(); }catch(e){} serialReadAbort = null; }
      if(reader){
        try{ await serialPromiseWithTimeout(reader.cancel(), 800, "SERIAL_CANCEL_TIMEOUT"); }catch(e){}
        try{ reader.releaseLock(); }catch(e){}
      }
      if(writer){
        try{ writer.releaseLock(); }catch(e){}
      }
      if(closePort && port){
        try{ await serialPromiseWithTimeout(port.close(), 1200, "SERIAL_CLOSE_TIMEOUT"); }catch(e){}
      }
      serialLineBuf = "";
    }

    function removeSerialAckWaiter(waiter){
      if(!waiter) return;
      const idx = serialAckWaiters.indexOf(waiter);
      if(idx >= 0) serialAckWaiters.splice(idx, 1);
    }

    function settleSerialAckWaiter(waiter, result){
      if(!waiter || waiter.done) return;
      waiter.done = true;
      if(waiter.timer){
        clearTimeout(waiter.timer);
        waiter.timer = null;
      }
      removeSerialAckWaiter(waiter);
      waiter.resolve(result);
    }

    function cancelSerialAckWaiter(waiter, reason){
      settleSerialAckWaiter(waiter, {
        ok:false,
        kind:"cancel",
        message:reason || "SERIAL_CANCELLED"
      });
    }

    function flushSerialAckWaiters(reason){
      const pending = serialAckWaiters.slice();
      for(const waiter of pending){
        cancelSerialAckWaiter(waiter, reason || "SERIAL_DISCONNECTED");
      }
    }

    function createSerialAckWaiter(matchFn, timeoutMs){
      const safeMatch = (typeof matchFn === "function") ? matchFn : (()=>true);
      const waiter = {
        done:false,
        match:safeMatch,
        resolve:null,
        timer:null,
        promise:null
      };
      waiter.promise = new Promise(resolve=>{
        waiter.resolve = resolve;
      });
      serialAckWaiters.push(waiter);
      const waitMs = Math.max(120, Number(timeoutMs) || 800);
      waiter.timer = setTimeout(()=>{
        settleSerialAckWaiter(waiter, {
          ok:false,
          kind:"timeout",
          message:"SERIAL_TIMEOUT"
        });
      }, waitMs);
      return waiter;
    }

    function dispatchSerialAck(kind, message, rawLine){
      if(!serialAckWaiters.length) return;
      const waiters = serialAckWaiters.slice();
      for(const waiter of waiters){
        let matched = false;
        try{
          matched = !!waiter.match({
            kind,
            message:String(message || ""),
            raw:String(rawLine || "")
          });
        }catch(e){
          reportSilentException("serial-ack-match", e);
        }
        if(matched){
          settleSerialAckWaiter(waiter, {
            ok:(kind === "ack"),
            kind,
            message:String(message || ""),
            raw:String(rawLine || "")
          });
        }
      }
    }

    function handleSerialTextLine(line){
      const raw = String(line || "").trim();
      if(!raw) return;
      lastSerialActivityAt = Date.now();
      // Bulk ACKs contain up to ~11 KiB of Base64. Consume them directly;
      // uppercasing and logging every payload makes large downloads CPU- and
      // memory-bound in the browser.
      if(
        raw.indexOf("ACK SPI_FLASH_CHUNK ") === 0 ||
        raw.indexOf("ACK SPI_FLASH_REMOTE_CHUNK ") === 0
      ){
        dispatchSerialAck("ack", raw.slice(4).trim(), raw);
        return;
      }
      const upper = raw.toUpperCase();
      if(upper.startsWith("ACK ")){
        const msg = raw.slice(4).trim();
        const scale = parseLoadcellReplyValue(msg, "SCALE");
        if(scale != null){
          lastLoadcellScale = scale;
          updateLoadcellCalcPanel(lastLoadcellCalWeight);
        }
        const offset = parseLoadcellReplyValue(msg, "OFFSET");
        if(offset != null){
          lastLoadcellOffset = offset;
          updateLoadcellCalcPanel(lastLoadcellCalWeight);
        }
        const spiStatusInfo = parseSpiFlashStatusAckMessage(msg);
        if(spiStatusInfo){
          updateSpiFlashStatusUi(spiStatusInfo, null);
        }
        reconcileBoardControlSerialCompletion("ack", msg);
        addLogLine("ACK " + msg, "SER");
        dispatchSerialAck("ack", msg, raw);
        return;
      }
      if(upper.startsWith("ERR ")){
        const msg = raw.slice(4).trim();
        addLogLine("ERR " + msg, "SER");
        dispatchSerialAck("err", msg, raw);
        return;
      }
      if(/^PWM\d+\s*=\s*-?\d+$/i.test(raw)){
        addLogLine(raw, "SER");
        dispatchSerialAck("ack", raw, raw);
        return;
      }
      if(upper.startsWith("[SERVO]") || upper.startsWith("[BOOT]") || upper.startsWith("[WS]")){
        addLogLine(raw, "SER");
        return;
      }
      if(upper.indexOf("[SPI-STORAGE]") === 0){
        if(upper.indexOf("SD REMOVED") >= 0 || upper.indexOf("MOUNT FAILED") >= 0){
          spiFlashReadyState = false;
          updateMotorInfoPanel();
        }else if(upper.indexOf("SD READY") >= 0){
          spiFlashReadyState = true;
          updateMotorInfoPanel();
        }
        addLogLine(raw, "SER");
        return;
      }
      addLogLine(raw, "SER");
    }

    function isLikelyReadableSerialLine(line){
      const raw = String(line || "").trim();
      if(!raw) return false;
      if(!/^[\x09\x20-\x7E]+$/.test(raw)) return false;
      const upper = raw.toUpperCase();
      if(raw[0] === "[") return true;
      if(upper.startsWith("ACK ") || upper.startsWith("ERR ")) return true;
      if(upper.startsWith("=== ")) return true;
      if(upper.indexOf("BOOT") >= 0 || upper.indexOf("WIFI") >= 0) return true;
      return false;
    }

    async function requestSerialCommandAck(command, matchFn, opts){
      if(!serialConnected || !serialWriter) return { ok:false, kind:"offline", message:"SERIAL_NOT_READY" };
      const options = opts || {};
      const timeoutMs = Math.max(250, Number(options.timeoutMs) || 1000);
      const writeTimeoutMs = Math.max(250, Number(options.writeTimeoutMs) || 1200);
      const safeMatch = (typeof matchFn === "function") ? matchFn : (()=>true);
      const waiter = createSerialAckWaiter((evt)=>{
        if(evt.kind === "err") return true;
        if(evt.kind !== "ack") return false;
        try{
          return !!safeMatch(evt);
        }catch(e){
          reportSilentException("serial-command-ack-match", e);
          return false;
        }
      }, timeoutMs);
      const wrote = await serialWriteLine(command, {timeoutMs:writeTimeoutMs});
      if(!wrote){
        cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
      }
      return await waiter.promise;
    }

    async function requestSerialSettingsAck(timeoutMs){
      const reply = await requestSerialCommandAck(
        "/settings",
        (evt)=>String(evt.message || "").toUpperCase().indexOf("SETTINGS") === 0,
        {timeoutMs:timeoutMs || 1000, writeTimeoutMs:1000}
      );
      if(reply && reply.ok){
        const message = String(reply.message || "");
        const roleMatch = message.match(/\bflash_link_role=([^\s]+)/i);
        reply.flashLinkRole = roleMatch
          ? String(roleMatch[1] || "").trim().toLowerCase()
          : "";
        const lockMatch = message.match(/\bmission_locked=(\d+)/i);
        const sourceMatch = message.match(/\bmission_source=([^\s]+)/i);
        if(lockMatch){
          setMissionFirmwareCapability(
            Number(lockMatch[1]) !== 0,
            sourceMatch ? sourceMatch[1] : "",
            Number(lockMatch[1]) !== 0 ? "BUILTIN_MISSION" : ""
          );
        }
        if(uiSettings){
          const fields = [
            ["missionStage1SeparationBackupMs", "mission_s1_sep_backup_ms", 500, 15000],
            ["missionStage1EjectionDelayMs", "mission_s1_eject_delay_ms", 100, 10000],
            ["missionStage2EjectionDelayMs", "mission_s2_eject_delay_ms", 500, 30000],
            ["missionLaunchGraceMs", "mission_launch_grace_ms", 1000, 30000],
            ["missionLinkLossMs", "mission_link_loss_ms", 200, 5000],
            ["missionStage1SeparationAngleDeg", "mission_s1_sep_angle_deg", 0, 180],
            ["missionStage1EjectionAngleDeg", "mission_s1_eject_angle_deg", 0, 180],
            ["missionStage2EjectionAngleDeg", "mission_s2_eject_angle_deg", 0, 180]
          ];
          let changed = false;
          fields.forEach(([key, wire, min, max])=>{
            const match = message.match(new RegExp("\\b" + wire + "=(\\d+)", "i"));
            if(!match) return;
            const value = Math.max(min, Math.min(max, Number(match[1])));
            if(uiSettings[key] !== value){ uiSettings[key] = value; changed = true; }
          });
          if(changed){ saveSettings(); applySettingsToUI(); }
        }
      }
      return reply;
    }

    async function requestSerialStreamState(enabled, opts){
      const options = opts || {};
      const developerPart = (enabled && options.developer) ? "&developer=1" : "";
      const reply = await requestSerialCommandAck(
        "/set?stream=" + (enabled ? "1" : "0") + developerPart,
        (evt)=>String(evt.message || "").toUpperCase().indexOf("STREAM=") === 0,
        {
          timeoutMs:options.timeoutMs || 1000,
          writeTimeoutMs:options.writeTimeoutMs || 1200
        }
      );
      if(reply && reply.ok){
        const m = String(reply.message || "").match(/\bSTREAM=(\d+)/i);
        reply.streamEnabled = m ? (Number(m[1]) !== 0) : null;
      }
      return reply || { ok:false, kind:"unknown", message:"SERIAL_NO_REPLY" };
    }

    async function setSerialStreamState(enabled, opts){
      const reply = await requestSerialStreamState(enabled, opts);
      if(!reply.ok){
        addLogLine("SER stream " + (enabled ? "ON" : "OFF") + " request failed: " + (reply.message || reply.kind || "NO_ACK"), "SER");
      }
      return !!reply.ok;
    }

    function markSerialControlLinkReady(hasTelemetrySample){
      const now = Date.now();
      lastOkMs = now;
      lastSerialActivityAt = now;
      failStreak = 0;
      unstableToastShown = false;
      disconnectedLogged = false;
      if(!connOk){
        connOk = true;
        updateConnectionUI(true);
      }else{
        updateConnectionUI(true);
      }
      if(!hasTelemetrySample){
        syncMobileBoardHeader();
        syncMobileSequenceStatus();
      }
    }

    async function serialProbeIncoming(timeoutMs){
      if(!serialReader){
        return { ok:false, reason:"NO_READER", sample:null, leftover:"" };
      }
      const decoder = new TextDecoder();
      let probeBuf = "";
      let sawReadableText = false;
      const endAt = Date.now() + Math.max(600, Number(timeoutMs) || SERIAL_PROBE_TIMEOUT_MS);
      while(Date.now() < endAt){
        const remain = Math.max(1, endAt - Date.now());
        const result = await Promise.race([
          serialReader.read(),
          new Promise(resolve=>setTimeout(()=>resolve({ __timeout:true }), remain))
        ]);
        if(result && result.__timeout){
          return { ok:sawReadableText, reason:(sawReadableText ? "TEXT" : "TIMEOUT"), sample:null, leftover:probeBuf };
        }
        const value = result ? result.value : null;
        const done = !!(result && result.done);
        if(done){
          return { ok:sawReadableText, reason:(sawReadableText ? "TEXT" : "DONE"), sample:null, leftover:probeBuf };
        }
        if(!value) continue;

        probeBuf += decoder.decode(value, { stream:true }).replace(/\r/g, "\n");
        let idx;
        while((idx = probeBuf.indexOf("\n")) >= 0){
          const line = probeBuf.slice(0, idx).trim();
          probeBuf = probeBuf.slice(idx + 1);
          if(!line) continue;
          const jsonLine =
            (line[0] === "{" && line[line.length - 1] === "}") ||
            (line[0] === "[" && line[line.length - 1] === "]");
          if(jsonLine){
            try{
              const sample = decodeFlash6ProtocolFrame(JSON.parse(line));
              if(!sample) continue;
              return { ok:true, reason:"JSON", sample, leftover:probeBuf };
            }catch(e){}
          }
          if(isLikelyReadableSerialLine(line)){
            sawReadableText = true;
          }
        }
      }
      return { ok:sawReadableText, reason:(sawReadableText ? "TEXT" : "TIMEOUT"), sample:null, leftover:probeBuf };
    }

    async function getPreviouslyGrantedSerialPorts(){
      if(!serialSupported() || !navigator.serial.getPorts) return [];
      let ports = [];
      try{
        ports = await navigator.serial.getPorts();
      }catch(e){
        addLogLine("WebSerial getPorts failed: " + (e?.message || e), "SER");
        return [];
      }
      if(!ports || !ports.length) return [];
      const usbPorts = ports.filter(port=>{
        try{
          const info = port && typeof port.getInfo === "function" ? port.getInfo() : null;
          return !!(info && (info.usbVendorId || info.usbProductId));
        }catch(_e){
          return false;
        }
      });
      const candidates = usbPorts.length ? usbPorts : ports;
      const ranked = candidates.map((port, index)=>{
        let score = 0;
        try{
          const info = port && typeof port.getInfo === "function" ? port.getInfo() : null;
          // Espressif native USB/JTAG serial (ESP32-S3).
          if(info && Number(info.usbVendorId) === 0x303A) score += 100;
          if(info && Number(info.usbProductId) === 0x1001) score += 20;
        }catch(_e){}
        return {port, score, index};
      });
      ranked.sort((a, b)=>(b.score - a.score) || (a.index - b.index));
      return ranked.map(item=>item.port);
    }

    async function getPreviouslyGrantedSerialPort(){
      const ports = await getPreviouslyGrantedSerialPorts();
      return ports.length ? ports[0] : null;
    }

    function cancelSerialAutoReconnect(){
      if(serialAutoReconnectTimer){
        clearTimeout(serialAutoReconnectTimer);
        serialAutoReconnectTimer = null;
      }
      serialAutoReconnectAttempts = 0;
    }

    function scheduleSerialAutoReconnect(reason){
      if(serialAutoReconnectTimer) return;
      if(!serialEnabled || simEnabled || serialConnected || serialConnectBusy) return;
      serialAutoReconnectAttempts += 1;
      const delay = Math.min(8000, 900 + (serialAutoReconnectAttempts * 900));
      addLogLine("WebSerial auto reconnect scheduled (" + (reason || "disconnect") + ", try " + serialAutoReconnectAttempts + ")", "SER");
      serialAutoReconnectTimer = setTimeout(async ()=>{
        serialAutoReconnectTimer = null;
        if(!serialEnabled || simEnabled || serialConnected || serialConnectBusy) return;
        await serialConnect({
          preferGranted:true,
          autoReconnect:true,
          requireGround:serialGroundRequired
        });
        if(!serialConnected){
          scheduleSerialAutoReconnect("retry");
        }
      }, delay);
    }

    async function serialConnect(opts){
      const options = opts || {};
      const autoReconnect = !!options.autoReconnect;
      const requireGround = !!options.requireGround;
      const quiet = !!options.quiet;
      if(Object.prototype.hasOwnProperty.call(options, "requireGround") && !autoReconnect){
        serialGroundRequired = requireGround;
      }else if(requireGround){
        serialGroundRequired = true;
      }
      if(simEnabled){
        setSimEnabled(false, {silent:true});
      }
      if(!autoReconnect){
        cancelSerialAutoReconnect();
      }
      if(serialConnectBusy){
        addLogLine("WebSerial connect already in progress", "SER");
        return;
      }
      serialConnectBusy = true;
      if(!window.isSecureContext && !isLocalPreviewHost()){
        showToast(t("webserialInsecureToast"), "notice");
        addLogLine("WebSerial blocked: insecure context (" + location.origin + ")", "SER");
        serialConnectBusy = false;
        return;
      }
      if(!serialSupported()){
        showToast(t("webserialUnsupported"), "notice");
        serialConnectBusy = false;
        return;
      }
      try{
        setSerialConnectWizardStage("waiting", "기존 연결 정리 중");
        await closeSerialHandles({ closePort:true });
        let selectedPort = options.port || null;
        if(!selectedPort && options.preferGranted !== false){
          setSerialConnectWizardStage("waiting", "허용된 USB 포트 찾는 중");
          selectedPort = await getPreviouslyGrantedSerialPort();
        }
        if(selectedPort){
          addLogLine("WebSerial using previously granted port.", "SER");
        }else if(autoReconnect || options.grantedOnly){
          throw new Error("SERIAL_PORT_UNAVAILABLE");
        }else{
          setSerialConnectWizardStage("waiting", "브라우저 포트 권한 필요");
          selectedPort = await navigator.serial.requestPort({});
        }
        if(!selectedPort){
          throw new Error("SERIAL_PORT_UNAVAILABLE");
        }
        serialPort = selectedPort;
        serialCurrentBaud = SERIAL_BAUD_RATE;
        serialParseErrorCount = 0;
        serialRxDisabledWarned = false;
        serialRxEnabled = true;
        if(uiSettings){
          uiSettings.serialRx = true;
          saveSettings();
        }
        if(el.serialRxToggle) el.serialRxToggle.checked = true;

        // ESP32-S3 native USB CDC is fixed at the firmware baud setting.
        // Repeated close/open baud probing can leave the macOS port stuck busy.
        setSerialConnectWizardStage("waiting", "USB 포트 여는 중");
        await serialPromiseWithTimeout(
          selectedPort.open({ baudRate: SERIAL_BAUD_RATE }),
          5000,
          "SERIAL_OPEN_TIMEOUT"
        );
        serialWriter = serialPort.writable?.getWriter?.() || null;
        serialReadAbort = createAbortControllerSafe();
        serialReader = serialPort.readable?.getReader?.() || null;
        if(!serialWriter || !serialReader){
          throw new Error("SERIAL_STREAM_UNAVAILABLE");
        }
        serialCurrentBaud = SERIAL_BAUD_RATE;
        serialLineBuf = "";

        const handshakeStartedAt = Date.now();
        lastSerialSampleAt = 0;
        lastSerialActivityAt = 0;
        serialConnected = true;
        const activeSerialSessionId = ++serialSessionId;
        const activeSerialReader = serialReader;
        updateSerialPill();

        if(activeSerialReader){
          readSerialLoop(activeSerialSessionId, activeSerialReader).catch(err=>{
            addLogLine(t("serialReadEnded", {err:(err?.message||err)}), "SER");
          });
        }

        setSerialConnectWizardStage("waiting", "보드 응답 확인 중");
        let gotSample = false;
        let gotBoardAck = false;
        const settingsAck = await requestSerialSettingsAck(1100);
        if(settingsAck && settingsAck.ok){
          if(requireGround && settingsAck.flashLinkRole !== "ground"){
            throw new Error("SERIAL_NOT_GROUND_STATION");
          }
          serialConnectedRole = settingsAck.flashLinkRole || "";
          gotBoardAck = true;
        }else if(requireGround){
          throw new Error("SERIAL_GROUND_ROLE_UNVERIFIED");
        }
        const handshakeDeadline = Date.now() + (gotBoardAck ? 4200 : 9000);
        while(serialConnected && Date.now() < handshakeDeadline){
          const streamAck = await requestSerialStreamState(true, {developer:true, timeoutMs:1000, writeTimeoutMs:1200});
          if(streamAck && streamAck.ok){
            gotBoardAck = true;
          }
          gotSample = await waitForSerialSampleAfter(handshakeStartedAt, gotBoardAck ? 1200 : 1800);
          if(gotSample) break;
          if(gotBoardAck && !requireGround) break;
        }
        if(!gotSample && !gotBoardAck){
          throw new Error("SERIAL_DATA_TIMEOUT");
        }
        if(requireGround && !gotSample){
          throw new Error("SERIAL_GROUND_TELEMETRY_TIMEOUT");
        }

        markSerialControlLinkReady(gotSample);
        if(gotSample){
          addLogLine(t("webserialConnected") + " @" + serialCurrentBaud + "bps", "SER");
        }else{
          addLogLine("WebSerial control link established @" + serialCurrentBaud + "bps; telemetry stream is inactive.", "SER");
          showToast("시리얼 제어 연결됨. 텔레메트리 대기 중", "success", {duration:2600, key:"serial-control-link"});
        }
        serialAutoReconnectAttempts = 0;
        if(autoReconnect){
          hideDisconnectOverlay();
          showToast("시리얼 재연결됨", "success", {key:"serial-auto-reconnect"});
        }
        syncDaqSequencePyroChannelToBoard(false);
        return true;
      }catch(e){
        await closeSerialHandles({ closePort:true });
        serialPort = null;
        serialConnected = false;
        serialConnectedRole = "";
        updateSerialPill();
        const serialErrText = String(e?.message || e || "SERIAL_CONNECT_FAILED");
        addLogLine(t("webserialConnectFailed", {err:serialErrText}), "SER");
        if(quiet){
          // Automatic discovery may inspect more than one granted ESP32 port.
          // Keep rejected non-ground ports out of the operator notification UI.
        }else if(serialErrText === "SERIAL_NOT_GROUND_STATION"){
          showToast("선택한 장치는 지상국 보드가 아닙니다. 지상국 보드를 선택하세요.", "error", {key:"serial-ground-role"});
        }else if(serialErrText === "SERIAL_GROUND_ROLE_UNVERIFIED"){
          showToast("지상국 역할을 확인하지 못했습니다. 보드 전원과 펌웨어를 확인하세요.", "error", {key:"serial-ground-role"});
        }else if(serialErrText === "SERIAL_GROUND_TELEMETRY_TIMEOUT"){
          showToast("지상국 응답은 확인했지만 텔레메트리가 없습니다. 지상국 모드와 스트림을 확인하세요.", "error", {key:"serial-ground-telemetry"});
        }else if(autoReconnect){
          showToast("시리얼 재연결 중", "notice", {key:"serial-auto-reconnect"});
        }else if(serialErrText === "SERIAL_DATA_TIMEOUT"){
          showToast("USB는 열렸지만 보드 응답이 없습니다. 포트와 모드를 확인하세요.", "error", {key:"serial-data-timeout"});
        }else if(/busy|already open|failed to open|invalidstate/i.test(serialErrText)){
          showToast("USB 포트가 사용 중입니다. 다른 탭이나 프로그램을 닫으세요.", "error", {key:"serial-port-busy"});
        }else{
          showToast(t("webserialConnectFailedToast"), "error");
        }
        return false;
      }finally{
        serialConnectBusy = false;
      }
    }

    async function serialDisconnect(opts){
      const silent = !!(opts && opts.silent);
      cancelSerialAutoReconnect();
      try{
        if(serialConnected && serialWriter){
          await setSerialStreamState(false);
        }
        await closeSerialHandles({ closePort:true });
        serialPort = null;
      }finally{
        flushSerialAckWaiters("SERIAL_DISCONNECTED");
        serialConnected = false;
        serialConnectedRole = "";
        connOk = false;
        serialParseErrorCount = 0;
        serialRxDisabledWarned = false;
        updateSerialPill();
        updateConnectionUI(false);
        addLogLine(t("webserialDisconnected"), "SER");
        if(serialEnabled && !silent) showDisconnectOverlay();
      }
    }

    async function serialWriteLine(line, opts){
      if(!serialConnected || !serialWriter) return false;
      try{
        const outLine = String(line || "").trim();
        const data = new TextEncoder().encode(outLine.endsWith("\n") ? outLine : (outLine + "\n"));
        const timeoutMs = Math.max(200, Number(opts && opts.timeoutMs) || 2000);
        await serialPromiseWithTimeout(
          serialWriter.write(data),
          timeoutMs,
          "SERIAL_WRITE_TIMEOUT"
        );
        if(outLine && (!opts || opts.log !== false)) addLogLine("TX " + outLine, "SER");
        return true;
      }catch(e){
        addLogLine(t("serialWriteFailed", {err:(e?.message||e)}), "SER");
        return false;
      }
    }

    function formatMissionSimNum(value, digits){
      const n = Number(value);
      if(!isFinite(n)) return null;
      return Number(n.toFixed(digits));
    }

    async function sendBoardMissionSimControl(enabled){
      if(!serialConnected || !serialTxEnabled) return false;
      return await serialWriteLine("/mission_sim?on=" + (enabled ? "1" : "0"));
    }

    async function sendBoardMissionSimSample(sample){
      if(!serialConnected || !serialTxEnabled) return false;
      if(!sample || typeof sample !== "object") return false;
      const parts = ["on=1"];
      const relMs = Number(sample._replayTsMs) - Number(replayState.samples && replayState.samples[0] ? replayState.samples[0].tsMs : sample._replayTsMs);
      const stRaw = Number(sample.st);
      const st = (isFinite(stRaw) && stRaw >= 0) ? stRaw : 2;
      const sw = Number(sample.s);
      const tdRaw = Number(sample.td);
      const td = isFinite(tdRaw) ? tdRaw : (isFinite(relMs) ? Math.max(0, Math.round(relMs)) : 0);
      const alt = Number(sample.alt_m != null ? sample.alt_m : sample.altitude_m);
      const thrust = Number(sample.t);
      const pressure = Number(sample.p);
      const ax = Number(sample.ax);
      const ay = Number(sample.ay);
      const az = Number(sample.az);
      const gx = Number(sample.gx);
      const gy = Number(sample.gy);
      const gz = Number(sample.gz);
      const stOut = (Math.round(st) === 0) ? 2 : Math.max(0, Math.min(2, Math.round(st)));
      parts.push("st=" + stOut);
      if(isFinite(sw)) parts.push("s=" + (sw ? "1" : "0"));
      if(isFinite(td)) parts.push("td=" + Math.round(td));
      const altOut = formatMissionSimNum(alt, 2); if(altOut != null) parts.push("alt=" + altOut);
      const thrustOut = formatMissionSimNum(thrust, 3); if(thrustOut != null) parts.push("t=" + thrustOut);
      // Do not send zero/invalid pressure from replay files; firmware can derive pressure from alt.
      const pressureOut = formatMissionSimNum(pressure, 5);
      if(pressureOut != null && pressureOut > 0.02) parts.push("p=" + pressureOut);
      const axOut = formatMissionSimNum(ax, 3); if(axOut != null) parts.push("ax=" + axOut);
      const ayOut = formatMissionSimNum(ay, 3); if(ayOut != null) parts.push("ay=" + ayOut);
      const azOut = formatMissionSimNum(az, 3); if(azOut != null) parts.push("az=" + azOut);
      const gxOut = formatMissionSimNum(gx, 3); if(gxOut != null) parts.push("gx=" + gxOut);
      const gyOut = formatMissionSimNum(gy, 3); if(gyOut != null) parts.push("gy=" + gyOut);
      const gzOut = formatMissionSimNum(gz, 3); if(gzOut != null) parts.push("gz=" + gzOut);
      return await serialWriteLine("/mission_sim?" + parts.join("&"));
    }

    function handleSerialJsonLine(line){
      lastSerialActivityAt = Date.now();
      if(!serialRxEnabled){
        if(!serialRxDisabledWarned){
          serialRxDisabledWarned = true;
          addLogLine("SER JSON received but RX parsing is OFF", "SER");
        }
        return;
      }
      try{
        const parsed = JSON.parse(line);
        if(parsed && !Array.isArray(parsed) && parsed.type === "gps_time"){
          return;
        }
        const obj = decodeFlash6ProtocolFrame(parsed);
        if(!obj) throw new Error("UNSUPPORTED_PROTOCOL_FRAME");
        lastSerialSampleAt = Date.now();
        serialParseErrorCount = 0;
        serialRxDisabledWarned = false;
        queueSerialTelemetrySample(obj);
      }catch(e){
        serialParseErrorCount += 1;
        if(serialParseErrorCount <= SERIAL_PARSE_ERROR_LOG_LIMIT){
          addLogLine("SER JSON parse failed #" + serialParseErrorCount + " @" + serialCurrentBaud + "bps", "SER");
        }
        reportSilentException("serial-json", e);
      }
    }

    function cancelQueuedSerialTelemetry(){
      pendingSerialTelemetrySample = null;
      if(!serialTelemetryFrameHandle) return;
      try{ cancelAnimationFrame(serialTelemetryFrameHandle); }catch(_e){}
      try{ clearTimeout(serialTelemetryFrameHandle); }catch(_e){}
      serialTelemetryFrameHandle = 0;
    }

    function flushQueuedSerialTelemetry(){
      serialTelemetryFrameHandle = 0;
      const sample = pendingSerialTelemetrySample;
      pendingSerialTelemetrySample = null;
      if(!sample || !serialConnected) return;
      onIncomingSample(sample, "SER");
      if(pendingSerialTelemetrySample){
        queueSerialTelemetrySample(pendingSerialTelemetrySample);
      }
    }

    function queueSerialTelemetrySample(sample){
      // The preview needs the newest pose, not every intermediate USB packet.
      // Coalesce to one update per paint so ACK lines stay responsive while
      // the dashboard is rendering charts and maps.
      pendingSerialTelemetrySample = sample;
      if(serialTelemetryFrameHandle) return;
      if(typeof requestAnimationFrame === "function"){
        serialTelemetryFrameHandle = requestAnimationFrame(flushQueuedSerialTelemetry);
      }else{
        serialTelemetryFrameHandle = setTimeout(flushQueuedSerialTelemetry, 0);
      }
    }

    async function readSerialLoop(sessionId, reader){
      const decoder = new TextDecoder();
      try{
        while(reader && sessionId === serialSessionId){
          const { value, done } = await reader.read();
          if(done) break;
          if(!value) continue;

          const chunk = decoder.decode(value, { stream:true }).replace(/\r/g, "\n");
          serialLineBuf += chunk;

          let idx;
          let consumed = 0;
          let pendingJsonLine = null;
          while((idx = serialLineBuf.indexOf("\n", consumed)) >= 0){
            const line = serialLineBuf.slice(consumed, idx).trim();
            consumed = idx + 1;
            if(!line) continue;
            const jsonLine =
              (line[0] === "{" && line[line.length-1] === "}") ||
              (line[0] === "[" && line[line.length-1] === "]");
            if(jsonLine){
              pendingJsonLine = line;
              continue;
            }
            if(pendingJsonLine){
              handleSerialJsonLine(pendingJsonLine);
              pendingJsonLine = null;
            }
            handleSerialTextLine(line);
          }
          if(consumed > 0) serialLineBuf = serialLineBuf.slice(consumed);
          if(pendingJsonLine){
            handleSerialJsonLine(pendingJsonLine);
          }
        }
      } finally{
        if(sessionId === serialSessionId){
          flushSerialAckWaiters("SERIAL_DISCONNECTED");
          if(serialConnected){
            serialConnected = false;
            serialConnectedRole = "";
            updateSerialPill();
            if(serialEnabled){
              connOk = false;
              updateConnectionUI(false);
            }
            addLogLine(t("webserialDisconnected"), "SER");
            if(serialEnabled){
              showDisconnectOverlay();
              scheduleSerialAutoReconnect("read loop ended");
            }
          }
        }
      }
    }
