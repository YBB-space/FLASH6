/* FLASH6 command router. Loaded after feature definitions and before bootstrap. */
    // =====================
    // 공통 명령 전송: Wi-Fi + (옵션) Serial
    // =====================
    function handleSimCommand(cmd){
      const raw = (cmd.http || cmd.ser || "").toString().trim();
      if(!raw) return;
      let path = raw;
      if(path[0] !== "/"){
        const head = path.split(/\s+/)[0].toUpperCase();
        if(head === "FORCE") path = "/force_ignite";
        else if(head === "COUNTDOWN") path = "/countdown_start";
        else if(head === "ABORT") path = "/abort";
        else if(head === "IGNITE") path = "/ignite";
      }

      if(path.startsWith("/countdown_start")){
        resetSimState();
        simState.st = 1;
        simState.countdownTotalMs = (uiSettings ? uiSettings.countdownSec : 10) * 1000;
        simState.cdMs = simState.countdownTotalMs;
        simState.countdownStartMs = Date.now();
        resetGyroPathTracking();
      }else if(path.startsWith("/force_ignite") || path.startsWith("/ignite")){
        if(simState.flightStartMs == null || simState.landed){
          resetSimState();
        }
        simState.st = 2;
        simState.ignStartMs = Date.now();
        if(simState.flightStartMs == null){
          simState.flightStartMs = simState.ignStartMs;
          simState.physicsLastMs = 0;
          resetGyroPathTracking();
        }
        simState.countdownStartMs = null;
        simState.cdMs = 0;
        simState.countdownTotalMs = null;
      }else if(path.startsWith("/mission_force_timed")){
        resetSimState();
        simState.st = 3;
        simState.flightStartMs = Date.now();
        simState.physicsLastMs = 0;
        simState.countdownStartMs = null;
        simState.cdMs = 0;
        simState.countdownTotalMs = null;
        resetGyroPathTracking();
      }else if(path.startsWith("/mission_standby")){
        resetSimState();
        simState.missionStandby = true;
        simState.st = 0;
      }else if(path.startsWith("/sequence_end")){
        resetSimState();
        resetGyroPathTracking();
      }else if(path.startsWith("/abort")){
        resetSimState();
        resetGyroPathTracking();
      }else if(path.startsWith("/servo")){
        const chMatch = path.match(/[?&](?:ch|id)=([0-9]+)/i);
        const degMatch = path.match(/[?&](?:deg|angle)=(-?[0-9]+)/i);
        const ch = chMatch ? Number(chMatch[1]) : NaN;
        const deg = degMatch ? clampServoAngle(degMatch[1]) : NaN;
        if(isFinite(ch) && isFinite(deg) && SERVO_CHANNELS.indexOf(ch) >= 0){
          setServoUiAngle(ch, deg);
        }
      }
    }
	    async function sendCommand(cmd, logIt){
	      if(simEnabled){
	        handleSimCommand(cmd);
	        if(logIt){
	          addLogLine(t("cmdSentLog", {cmd:(cmd.http || cmd.ser || "?")}), "CMD");
	        }
	        return {ok:true, reason:"SIM"};
	      }

	      let serLine = cmd.ser ? String(cmd.ser).trim() : "";
	      if(serLine && serLine[0] !== "/"){
	        const parts = serLine.split(/\s+/);
	        const head = (parts[0] || "").toUpperCase();

        if(head === "FORCE"){
          serLine = "/force_ignite";
        }else if(head === "COUNTDOWN"){
          serLine = "/countdown_start";
        }else if(head === "ABORT"){
          serLine = "/abort";
        }else if(head === "SEQUENCE_END"){
          serLine = "/sequence_end";
        }else if(head === "IGNITE"){
          serLine = "/ignite";
        }else if(head === "MISSION_FORCE_TIMED"){
          serLine = "/mission_force_timed";
        }else if(head === "MISSION_STANDBY"){
          serLine = "/mission_standby";
        }else if(head === "PRECOUNT"){
          const uw = (parts[1] != null) ? Number(parts[1]) : 0;
          const cd = (parts[2] != null) ? Number(parts[2]) : 0;
          serLine = "/precount?uw=" + (uw ? 1 : 0) + "&cd=" + Math.max(0, Math.min(60000, cd|0));
        }else if(head === "RS"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?rs=" + v;
        }else if(head === "IGS"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?igs=" + v;
        }else if(head === "SAFE"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?safe=" + v;
        }else if(head === "ARMLOCK"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?arm_lock=" + v;
        }else if(head === "IGNMS"){
          const ms = (parts[1] != null) ? (Number(parts[1])|0) : 1000;
          serLine = "/set?ign_ms=" + ms;
        }else if(head === "CDMS"){
          const ms = (parts[1] != null) ? (Number(parts[1])|0) : 10000;
          serLine = "/set?cd_ms=" + ms;
        }else if(head === "LAUNCHER"){
          const dir = (parts[1] || "STOP").toUpperCase();
          const dirValue = (dir === "UP" || dir === "DOWN") ? dir.toLowerCase() : "stop";
          serLine = "/launcher?dir=" + dirValue;
        }else if(head === "SERVO"){
          const chRaw = (parts[1] != null) ? (Number(parts[1])|0) : 1;
          const ch = Math.max(1, Math.min(SERVO_CHANNELS.length, chRaw));
          const degRaw = (parts[2] != null) ? Number(parts[2]) : SERVO_DEFAULT_DEG;
          const deg = clampServoAngle(degRaw);
          serLine = "/servo?ch=" + ch + "&deg=" + deg;
        }else if(head === "PYRO"){
          const chRaw = (parts[1] != null) ? (Number(parts[1])|0) : 1;
          const ch = normalizePyroChannel(chRaw, 1);
          const msRaw = (parts[2] != null) ? (Number(parts[2])|0) : 500;
          const ms = Math.max(10, Math.min(30000, msRaw));
          serLine = "/pyro_test?ch=" + ch + "&ms=" + ms;
	        }
	      }

      const normalizedPath = (cmd.http && String(cmd.http).trim())
        ? String(cmd.http).trim()
        : ((serLine && serLine[0] === "/") ? serLine : "");
      const isCoreConfigCmd =
        normalizedPath.startsWith("/set?op_mode=") ||
        normalizedPath.startsWith("/set?mode=") ||
        normalizedPath.startsWith("/set?flash_link_role=") ||
        normalizedPath.startsWith("/set?fl_role=") ||
        normalizedPath.startsWith("/set?flash_link_node_id=") ||
        normalizedPath.startsWith("/set?fl_node=") ||
        normalizedPath.startsWith("/set?flash_link_stage2_mode=") ||
        normalizedPath.startsWith("/set?fl_stage2_mode=") ||
        normalizedPath.startsWith("/set?flash_link_data_mode=") ||
        normalizedPath.startsWith("/set?fl_data_mode=") ||
        normalizedPath.startsWith("/set?data_mode=") ||
        normalizedPath.indexOf("&op_mode=") >= 0 ||
        normalizedPath.indexOf("&mode=") >= 0 ||
        normalizedPath.indexOf("&flash_link_role=") >= 0 ||
        normalizedPath.indexOf("&fl_role=") >= 0 ||
        normalizedPath.indexOf("&flash_link_node_id=") >= 0 ||
        normalizedPath.indexOf("&fl_node=") >= 0 ||
        normalizedPath.indexOf("&flash_link_stage2_mode=") >= 0 ||
        normalizedPath.indexOf("&fl_stage2_mode=") >= 0 ||
        normalizedPath.indexOf("&flash_link_data_mode=") >= 0 ||
        normalizedPath.indexOf("&fl_data_mode=") >= 0 ||
        normalizedPath.indexOf("&data_mode=") >= 0;
      const isLockoutBypassCmd =
        normalizedPath.startsWith("/abort") ||
        normalizedPath.startsWith("/sequence_end") ||
        normalizedPath.startsWith("/set?safe=") ||
        normalizedPath.startsWith("/set?arm_lock=") ||
        normalizedPath.startsWith("/reset");
      if(lockoutLatched && !isLockoutBypassCmd && !isCoreConfigCmd){
        const name = relayMaskName(lockoutRelayMask);
        showToast(t("lockoutCmdDenied", {name}), "error");
        return {ok:false, reason:"LOCKOUT"};
      }

      const canSerialTx = !!(serialEnabled && serialConnected && serLine && (serialTxEnabled || isCoreConfigCmd));
      const API_BASE = getApiBaseForCommands();
      const httpPath = cmd.http ? String(cmd.http).trim() : "";
      const isResetCmd = normalizedPath.startsWith("/reset");
      const isCriticalDualPathCmd =
        normalizedPath.startsWith("/countdown_start") ||
        normalizedPath.startsWith("/ignite") ||
        normalizedPath.startsWith("/force_ignite") ||
        normalizedPath.startsWith("/mission_standby") ||
        normalizedPath.startsWith("/mission_force_timed") ||
        normalizedPath.startsWith("/pyro_test") ||
        normalizedPath.startsWith("/abort") ||
        normalizedPath.startsWith("/sequence_end");
      const CMD_HTTP_TIMEOUT_CRITICAL_MS = 900;
      const CMD_HTTP_TIMEOUT_DEFAULT_MS = 2200;

      const sendHttpCommand = async (emitTerminalLog, timeoutMs)=>{
        if(!httpPath) return {ok:false, status:0, reason:"NO_HTTP_PATH"};
        const url = API_BASE ? (API_BASE + httpPath) : httpPath;
        const isPostCommand = httpPath.indexOf("/storage/spi_flash/init") === 0;
        const controller = createAbortControllerSafe();
        const timeout = Math.max(250, Number(timeoutMs) || CMD_HTTP_TIMEOUT_DEFAULT_MS);
        const timer = controller ? setTimeout(()=>{ try{ controller.abort(); }catch(_e){} }, timeout) : null;
        const opt = isPostCommand
          ? Object.assign({ method:"POST", cache:"no-cache" }, controller ? {signal:controller.signal} : {})
          : Object.assign({ cache:"no-cache" }, controller ? {signal:controller.signal} : {});

        try{
          const res = await fetch(url, opt);
          let bodyText = "";
          try{ bodyText = await res.text(); }catch(_){}
          if(!res.ok){
            const reason = (bodyText && bodyText.trim()) ? bodyText.trim() : ("HTTP " + res.status);
            if(emitTerminalLog){
              addLogLine("HTTP ERR " + res.status + " " + httpPath + " :: " + reason, "ERR");
            }
            return {ok:false, status:res.status, reason};
          }
          if(emitTerminalLog){
            const detail = (bodyText && bodyText.trim()) ? (" :: " + bodyText.trim()) : "";
            addLogLine("HTTP OK " + res.status + " " + httpPath + detail, "HTTP");
          }
          return {ok:true, status:res.status, reason:"OK"};
        }catch(err){
          const timedOut = !!(err && err.name === "AbortError");
          const reason = timedOut
            ? ("TIMEOUT(" + timeout + "ms)")
            : ((err && err.message) ? err.message : String(err || "HTTP_FAILED"));
          if(emitTerminalLog){
            addLogLine("HTTP EXC " + httpPath + " :: " + reason, "ERR");
          }else{
            reportSilentException("cmd-http", err);
          }
          return {ok:false, status:0, reason};
        }finally{
          if(timer) clearTimeout(timer);
        }
      };

      let httpResult = null;
      let serialOk = false;

      if(isResetCmd){
        // Reboot is a single-target command. Prefer the active USB control
        // path and use HTTP only as fallback so the ground node cannot enqueue
        // the same avionics reboot twice.
        if(canSerialTx){
          serialOk = await serialWriteLine(serLine);
        }
        if(!serialOk && httpPath){
          httpResult = await sendHttpCommand(!!logIt, CMD_HTTP_TIMEOUT_DEFAULT_MS);
        }
      }else if(isCriticalDualPathCmd && canSerialTx){
        serialOk = await serialWriteLine(serLine);
        if(httpPath){
          if(serialOk){
            sendHttpCommand(false, CMD_HTTP_TIMEOUT_CRITICAL_MS).then((assistResult)=>{
              if(!assistResult.ok){
                addLogLine("HTTP ASSIST FAIL " + httpPath + " :: " + assistResult.reason, "NET");
              }
            });
          }else{
            addLogLine("SER TX failed, HTTP fallback: " + httpPath, "SER");
            httpResult = await sendHttpCommand(!!logIt, CMD_HTTP_TIMEOUT_CRITICAL_MS);
          }
        }
      }else{
        if(httpPath && (isCriticalDualPathCmd || !canSerialTx || isResetCmd)){
          const timeoutMs = isCriticalDualPathCmd
            ? CMD_HTTP_TIMEOUT_CRITICAL_MS
            : CMD_HTTP_TIMEOUT_DEFAULT_MS;
          httpResult = await sendHttpCommand(!!logIt, timeoutMs);
        }

        if(canSerialTx){
          serialOk = await serialWriteLine(serLine);
          if(!serialOk && httpPath && !isResetCmd && !isCriticalDualPathCmd){
            addLogLine("SER TX failed, HTTP fallback: " + httpPath, "SER");
            httpResult = await sendHttpCommand(!!logIt, CMD_HTTP_TIMEOUT_DEFAULT_MS);
          }
        }
      }

      if(logIt){
        addLogLine(t("cmdSentLog", {cmd:(cmd.http || cmd.ser || "?")}), "CMD");
        if(httpPath && httpResult && !httpResult.ok){
          addLogLine("CMD HTTP RESULT :: " + httpResult.reason, "ERR");
        }
      }
      return {
        ok: !!(serialOk || (httpResult && httpResult.ok)),
        serialOk,
        httpResult
      };
    }
    async function sendBoardToggleCommand(kind, enabled){
      const isSafety = kind === "safety";
      const param = isSafety ? "safe" : "arm_lock";
      const commandCode = isSafety ? 1 : 2;
      const value = enabled ? 1 : 0;
      const path = "/set?" + param + "=" + value;
      if(simEnabled){
        return {ok:true, reason:"SIM"};
      }
      if(serialEnabled){
        if(!serialConnected || !serialWriter){
          return {ok:false, reason:"SERIAL_DISCONNECTED"};
        }
        if(!serialTxEnabled){
          return {ok:false, reason:"SERIAL_TX_DISABLED"};
        }
        const waiter = createSerialAckWaiter((evt)=>{
          const message = String(evt.message || "").toUpperCase();
          if(message.indexOf("FLASH_LINK_COMMANDS_QUEUED") === 0 ||
             message.indexOf("FLASH_LINK_COMMAND_QUEUED") === 0){
            const queuedCode = message.match(/\bCODE=(\d+)/);
            const queuedValue = message.match(/\bVALUE=(-?\d+)/);
            if(queuedCode && Number(queuedCode[1]) !== commandCode) return false;
            if(queuedValue && Number(queuedValue[1]) !== value) return false;
            return evt.kind === "ack";
          }
          if(message.indexOf("FLASH_LINK_STATE") === 0){
            return new RegExp("\\bCODE=" + commandCode + "(?:\\b|$)").test(message) &&
              (evt.kind === "err" ||
                new RegExp("\\bVALUE=" + value + "(?:\\b|$)").test(message));
          }
          if(evt.kind === "ack" && message.indexOf("STREAM=") === 0){
            const field = isSafety ? "SAFE" : "ARM_LOCK";
            return new RegExp("\\b" + field + "=" + value + "(?:\\b|$)").test(message);
          }
          return false;
        }, 1400);
        const wrote = await serialWriteLine(path, {timeoutMs:700});
        if(!wrote){
          cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
        }
        const result = await waiter.promise;
        const message = String((result && result.message) || "").toUpperCase();
        const queued = !!(result && result.ok &&
          (message.indexOf("FLASH_LINK_COMMANDS_QUEUED") === 0 ||
           message.indexOf("FLASH_LINK_COMMAND_QUEUED") === 0));
        const confirmed = !!(result && result.ok && !queued);
        // A successful USB write can outlive a congested textual ACK. Keep the
        // board-state request pending for telemetry/completion confirmation
        // instead of reporting a false SERIAL_TIMEOUT and sending a duplicate.
        if(result && result.kind === "timeout" && serialConnected){
          return {
            ok:true,
            queued:true,
            confirmed:false,
            reason:"SERIAL_ACK_PENDING"
          };
        }
        return {
          ok:!!(result && result.ok),
          queued,
          confirmed,
          reason:(result && (result.message || result.kind)) || "SERIAL_NO_REPLY"
        };
      }

      const API_BASE = getApiBaseForCommands();
      const controller = createAbortControllerSafe();
      const timer = controller ? setTimeout(()=>{
        try{ controller.abort(); }catch(_e){}
      }, 2400) : null;
      try{
        const res = await fetch((API_BASE || "") + path, Object.assign(
          {cache:"no-cache"},
          controller ? {signal:controller.signal} : {}
        ));
        const body = await res.text().catch(()=>"");
        const field = isSafety ? "SAFE" : "ARM_LOCK";
        const confirmed = res.ok && new RegExp("\\b" + field + "=" + value + "(?:\\b|$)", "i").test(body);
        return {
          ok:res.ok,
          confirmed,
          reason:(body && body.trim()) || ("HTTP " + res.status)
        };
      }catch(err){
        return {
          ok:false,
          reason:(err && err.name === "AbortError")
            ? "HTTP_TIMEOUT"
            : ((err && err.message) || "NETWORK_ERROR")
        };
      }finally{
        if(timer) clearTimeout(timer);
      }
    }

    function showTerminalHelp(){
      addLogLine("Terminal commands:", "HELP");
      addLogLine("  HTTP paths: /set?... /launcher?dir=up|down|stop /servo?ch=1~5&deg=0~180 /pyro_test?ch=1~2&ms=10~30000 /countdown_start /ignite /force_ignite /abort /sequence_end /precount?uw=0|1&cd=ms", "HELP");
      addLogLine("  SPI Flash: /storage/spi_flash/status /storage/spi_flash/init", "HELP");
      addLogLine("  Shortcuts: FORCE, COUNTDOWN, ABORT, IGNITE, SEQUENCE_END", "HELP");
      addLogLine("  Params: PRECOUNT <uw> <ms>, RS <0|1>, IGS <0|1>, SAFE <0|1>, ARMLOCK <0|1>", "HELP");
      addLogLine("  Timing: IGNMS <ms>, CDMS <ms>, LAUNCHER <UP|DOWN|STOP>, SERVO <1-4> <0-360>, PYRO <1-4> <10-30000ms>, SPI_STATUS, SPI_INIT", "HELP");
    }

    function buildTerminalCommand(rawInput){
      const raw = String(rawInput || "").trim();
      if(!raw) return null;

      let http = null;
      let ser = raw;

      if(raw[0] === "/"){
        http = raw;
        ser = raw;
        return {http, ser};
      }

      const parts = raw.split(/\s+/);
      const head = (parts[0] || "").toUpperCase();

      if(head === "FORCE"){
        http = "/force_ignite";
        ser = "FORCE";
      }else if(head === "COUNTDOWN"){
        http = "/countdown_start";
        ser = "COUNTDOWN";
      }else if(head === "ABORT"){
        http = "/abort";
        ser = "ABORT";
      }else if(head === "SEQUENCE_END"){
        http = "/sequence_end";
        ser = "SEQUENCE_END";
      }else if(head === "IGNITE"){
        http = "/ignite";
        ser = "IGNITE";
      }else if(head === "PRECOUNT"){
        const uw = (parts[1] != null) ? Number(parts[1]) : 0;
        const cd = (parts[2] != null) ? Number(parts[2]) : 0;
        const cdMs = Math.max(0, Math.min(60000, cd|0));
        http = "/precount?uw=" + (uw ? 1 : 0) + "&cd=" + cdMs;
        ser = "PRECOUNT " + (uw ? 1 : 0) + " " + cdMs;
      }else if(head === "RS"){
        const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
        http = "/set?rs=" + v;
        ser = "RS " + v;
      }else if(head === "IGS"){
        const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
        http = "/set?igs=" + v;
        ser = "IGS " + v;
      }else if(head === "SAFE"){
        const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
        http = "/set?safe=" + v;
        ser = "SAFE " + v;
      }else if(head === "ARMLOCK"){
        const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
        http = "/set?arm_lock=" + v;
        ser = "ARMLOCK " + v;
      }else if(head === "IGNMS"){
        const ms = (parts[1] != null) ? (Number(parts[1])|0) : 1000;
        http = "/set?ign_ms=" + ms;
        ser = "IGNMS " + ms;
      }else if(head === "CDMS"){
        const ms = (parts[1] != null) ? (Number(parts[1])|0) : 10000;
        http = "/set?cd_ms=" + ms;
        ser = "CDMS " + ms;
      }else if(head === "LAUNCHER"){
        const dir = (parts[1] || "STOP").toUpperCase();
        const dirValue = (dir === "UP" || dir === "DOWN") ? dir.toLowerCase() : "stop";
        http = "/launcher?dir=" + dirValue;
        ser = "LAUNCHER " + dirValue.toUpperCase();
      }else if(head === "SERVO"){
        const chRaw = (parts[1] != null) ? (Number(parts[1])|0) : 1;
        const ch = Math.max(1, Math.min(SERVO_CHANNELS.length, chRaw));
        const degRaw = (parts[2] != null) ? Number(parts[2]) : SERVO_DEFAULT_DEG;
        const deg = clampServoAngle(degRaw);
        http = "/servo?ch=" + ch + "&deg=" + deg;
        ser = "SERVO " + ch + " " + deg;
      }else if(head === "PYRO"){
        const chRaw = (parts[1] != null) ? (Number(parts[1])|0) : 1;
        const ch = normalizePyroChannel(chRaw, 1);
        const msRaw = (parts[2] != null) ? (Number(parts[2])|0) : 500;
        const ms = Math.max(10, Math.min(30000, msRaw));
        http = "/pyro_test?ch=" + ch + "&ms=" + ms;
        ser = "PYRO " + ch + " " + ms;
      }else if(head === "SPI_STATUS"){
        http = "/storage/spi_flash/status";
        ser = "/storage/spi_flash/status";
      }else if(head === "SPI_INIT"){
        http = "/storage/spi_flash/init";
        ser = "/storage/spi_flash/init";
      }

      return {http, ser};
    }
