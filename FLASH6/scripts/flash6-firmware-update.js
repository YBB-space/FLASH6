    const FIRMWARE_UPDATE_MIN_BYTES = 64 * 1024;
    const FIRMWARE_UPDATE_MAX_BYTES = 5 * 1024 * 1024;
    const FIRMWARE_UPDATE_SERIAL_CHUNK_BYTES = 768;
    const FIRMWARE_UPDATE_SERIAL_WINDOW_BYTES = 32 * 1024;
    const FIRMWARE_UPDATE_IMAGE_MAGIC = 0xE9;
    const FIRMWARE_UPDATE_REQUIRED_MARKERS = [
      "Altis_Intelligent3_firmware1",
      "Altis_Intelligent3_b3"
    ];
    let firmwareUpdateAuthorizationTimer = null;

    function isFirmwareUpdateOpen(){
      return !!(
        el.firmwareUpdateOverlay &&
        !el.firmwareUpdateOverlay.classList.contains("hidden")
      );
    }

    function firmwareUpdateTransportKind(){
      if(serialConnected && serialWriter) return "serial";
      if(!simEnabled && connOk) return "wifi";
      return "none";
    }

    function firmwareUpdateTransportLabel(){
      const kind = firmwareUpdateTransportKind();
      if(kind === "serial") return "USB DIRECT";
      if(kind === "wifi") return "GROUND WI-FI";
      return "연결된 보드 없음";
    }

    function formatFirmwareBytes(value){
      const bytes = Math.max(0, Number(value) || 0);
      if(bytes < 1024) return Math.round(bytes) + " B";
      if(bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    function formatFirmwareRate(value){
      const bytesPerSec = Math.max(0, Number(value) || 0);
      if(bytesPerSec <= 0) return "--";
      return formatFirmwareBytes(bytesPerSec) + "/s";
    }

    function formatFirmwareEta(seconds){
      const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
      if(!isFinite(safe) || safe <= 0) return "곧 완료";
      if(safe < 60) return "약 " + safe + "초";
      const minutes = Math.floor(safe / 60);
      const remain = safe % 60;
      return "약 " + minutes + "분 " + remain + "초";
    }

    function setFirmwareUpdateCheck(node, ready, value){
      if(!node) return;
      node.classList.toggle("is-ready", !!ready);
      node.classList.toggle("is-pending", !ready);
      const label = node.querySelector("b");
      if(label) label.textContent = String(value || (ready ? "완료" : "대기"));
    }

    function firmwareUpdateReadiness(){
      const telemetry = latestTelemetry || {};
      const safe = Number(telemetry.sm) === 1;
      const armLocked = Number(telemetry.al) === 1;
      const idle = Number(telemetry.st || 0) === 0 &&
        Number(telemetry.rly || 0) === 0;
      const transport = firmwareUpdateTransportKind();
      return {
        safe,
        armLocked,
        idle,
        connected: transport !== "none",
        transport
      };
    }

    function firmwareUpdateErrorText(code){
      const key = String(code || "").trim().toUpperCase();
      const messages = {
        PHYSICAL_AUTH_REQUIRED:"보드 물리 버튼을 6회 누른 뒤 길게 눌러 인증하세요.",
        SAFETY_MODE_REQUIRED:"안전 모드를 먼저 켜세요.",
        ARM_LOCK_REQUIRED:"ARM 잠금을 먼저 켜세요.",
        SEQUENCE_ACTIVE:"진행 중인 미션 또는 시퀀스를 종료하세요.",
        PYRO_ACTIVE:"파이로 출력이 활성 상태입니다.",
        BAD_SIZE:"펌웨어 파일 크기가 허용 범위를 벗어났습니다.",
        BAD_SHA256:"펌웨어 무결성 정보가 올바르지 않습니다.",
        BAD_IMAGE_MAGIC:"ESP32-S3 펌웨어 이미지가 아닙니다.",
        SHA256_MISMATCH:"전송된 펌웨어의 무결성 검증에 실패했습니다.",
        TRANSFER_TIMEOUT:"전송 응답 시간이 초과되었습니다. 연결을 확인하세요.",
        SERIAL_NOT_READY:"USB 연결을 확인하세요.",
        SERIAL_WRITE_FAIL:"USB 전송에 실패했습니다.",
        SERIAL_WRITE_TIMEOUT:"USB 전송 응답 시간이 초과되었습니다.",
        VERIFY_FAILED:"보드에서 펌웨어 이미지 검증을 완료하지 못했습니다.",
        UPDATE_BUSY:"보드에서 다른 업데이트가 진행 중입니다.",
        FIRMWARE_EMPTY_BODY:"선택한 펌웨어 파일이 비어 있습니다."
      };
      return messages[key] || (key ? ("업데이트 실패 · " + key) : "펌웨어 업데이트에 실패했습니다.");
    }

    function updateFirmwareUpdateUi(){
      const readiness = firmwareUpdateReadiness();
      if(el.firmwareUpdateTransport){
        el.firmwareUpdateTransport.textContent = firmwareUpdateTransportLabel();
      }
      setFirmwareUpdateCheck(
        el.firmwareUpdateAuthState,
        firmwareUpdateAuthorized,
        firmwareUpdateAuthorized ? "인증됨" : "대기");
      setFirmwareUpdateCheck(
        el.firmwareUpdateSafetyState,
        readiness.safe && readiness.idle,
        readiness.safe ? (readiness.idle ? "적용됨" : "시퀀스 확인") : "OFF");
      setFirmwareUpdateCheck(
        el.firmwareUpdateArmState,
        readiness.armLocked && Number(latestTelemetry && latestTelemetry.rly || 0) === 0,
        readiness.armLocked ? "잠김" : "해제");

      let status = "업데이트할 firmware.bin을 선택하세요.";
      if(firmwareUpdateValidationError){
        status = firmwareUpdateValidationError;
      }else if(firmwareUpdateFile && !firmwareUpdateBuffer){
        status = "펌웨어 파일을 검사하고 있습니다…";
      }else if(firmwareUpdateBuffer && !firmwareUpdateAuthorized){
        status = "파일 검증 완료 · 보드 물리 버튼을 6회 누른 뒤 길게 누르세요.";
      }else if(firmwareUpdateBuffer && !readiness.safe){
        status = "안전 모드를 켜야 업데이트할 수 있습니다.";
      }else if(firmwareUpdateBuffer && !readiness.armLocked){
        status = "ARM 잠금을 적용해야 업데이트할 수 있습니다.";
      }else if(firmwareUpdateBuffer && !readiness.idle){
        status = "진행 중인 시퀀스와 파이로 출력을 먼저 종료하세요.";
      }else if(firmwareUpdateBuffer && !readiness.connected){
        status = "USB 또는 지상국 Wi-Fi로 보드를 직접 연결하세요.";
      }else if(firmwareUpdateBuffer){
        status = "업데이트 준비가 완료되었습니다.";
      }
      if(el.firmwareUpdateStatus && !firmwareUpdateUiBusy){
        el.firmwareUpdateStatus.textContent = status;
        el.firmwareUpdateStatus.classList.toggle("is-error", !!firmwareUpdateValidationError);
        el.firmwareUpdateStatus.classList.toggle(
          "is-ready",
          !!firmwareUpdateBuffer &&
          firmwareUpdateAuthorized &&
          readiness.safe &&
          readiness.armLocked &&
          readiness.idle &&
          readiness.connected);
      }
      if(el.firmwareUpdateStart){
        el.firmwareUpdateStart.disabled = !!(
          firmwareUpdateUiBusy ||
          !firmwareUpdateBuffer ||
          !firmwareUpdateSha256 ||
          !firmwareUpdateAuthorized ||
          !readiness.safe ||
          !readiness.armLocked ||
          !readiness.idle ||
          !readiness.connected);
      }
    }

    function openFirmwareUpdateModal(){
      if(!el.firmwareUpdateOverlay) return;
      if(firmwareUpdateAuthorizationTimer){
        clearTimeout(firmwareUpdateAuthorizationTimer);
        firmwareUpdateAuthorizationTimer = null;
      }
      firmwareUpdateAuthorized = false;
      setFirmwareUpdateProgressVisible(false);
      setOverlayVisible(el.firmwareUpdateOverlay, true);
      el.firmwareUpdateOverlay.setAttribute("aria-hidden", "false");
      updateFirmwareUpdateUi();
    }

    function closeFirmwareUpdateModal(){
      if(firmwareUpdateUiBusy || !el.firmwareUpdateOverlay) return;
      if(firmwareUpdateAuthorizationTimer){
        clearTimeout(firmwareUpdateAuthorizationTimer);
        firmwareUpdateAuthorizationTimer = null;
      }
      firmwareUpdateAuthorized = false;
      setOverlayVisible(el.firmwareUpdateOverlay, false);
      el.firmwareUpdateOverlay.setAttribute("aria-hidden", "true");
    }

    function setFirmwareUpdateProgressVisible(visible){
      if(el.firmwareUpdateIdleView) el.firmwareUpdateIdleView.hidden = !!visible;
      if(el.firmwareUpdateProgressView) el.firmwareUpdateProgressView.hidden = !visible;
      if(el.firmwareUpdateActions) el.firmwareUpdateActions.hidden = !!visible;
      if(el.firmwareUpdateClose) el.firmwareUpdateClose.hidden = !!visible;
      if(el.firmwareUpdateOverlay){
        el.firmwareUpdateOverlay.classList.toggle("is-updating", !!visible);
      }
    }

    function firmwareBytesContainAscii(bytes, text){
      const needle = new TextEncoder().encode(text);
      if(!needle.length || needle.length > bytes.length) return false;
      outer:
      for(let i = 0; i <= bytes.length - needle.length; i += 1){
        if(bytes[i] !== needle[0]) continue;
        for(let j = 1; j < needle.length; j += 1){
          if(bytes[i + j] !== needle[j]) continue outer;
        }
        return true;
      }
      return false;
    }

    async function sha256Hex(buffer){
      if(!window.crypto || !window.crypto.subtle){
        throw new Error("이 브라우저에서는 SHA-256 검증을 사용할 수 없습니다.");
      }
      const digest = await window.crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest))
        .map((value)=>value.toString(16).padStart(2, "0"))
        .join("");
    }

    async function selectFirmwareUpdateFile(file){
      firmwareUpdateFile = file || null;
      firmwareUpdateBuffer = null;
      firmwareUpdateSha256 = "";
      firmwareUpdateValidationError = "";
      if(el.firmwareUpdateFileCard) el.firmwareUpdateFileCard.hidden = !file;
      if(el.firmwareUpdateFileName){
        el.firmwareUpdateFileName.textContent = file ? file.name : "--";
      }
      if(el.firmwareUpdateFileMeta){
        el.firmwareUpdateFileMeta.textContent = file ? (formatFirmwareBytes(file.size) + " · 검사 중") : "--";
      }
      updateFirmwareUpdateUi();
      if(!file) return;

      try{
        if(!/\.bin$/i.test(file.name || "")){
          throw new Error("firmware.bin 형식의 파일만 선택할 수 있습니다.");
        }
        if(file.size < FIRMWARE_UPDATE_MIN_BYTES || file.size > FIRMWARE_UPDATE_MAX_BYTES){
          throw new Error("펌웨어 파일은 64 KB 이상 5 MB 이하여야 합니다.");
        }
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if(bytes[0] !== FIRMWARE_UPDATE_IMAGE_MAGIC){
          throw new Error("올바른 ESP32-S3 펌웨어 이미지가 아닙니다.");
        }
        const missingMarker = FIRMWARE_UPDATE_REQUIRED_MARKERS.find(
          (marker)=>!firmwareBytesContainAscii(bytes, marker)
        );
        if(missingMarker){
          throw new Error("FLASH6 대상 펌웨어를 확인할 수 없습니다. 다른 보드용 BIN일 수 있습니다.");
        }
        const hash = await sha256Hex(buffer);
        if(firmwareUpdateFile !== file) return;
        firmwareUpdateBuffer = buffer;
        firmwareUpdateSha256 = hash;
        if(el.firmwareUpdateFileMeta){
          el.firmwareUpdateFileMeta.textContent =
            formatFirmwareBytes(file.size) + " · SHA-256 " + hash.slice(0, 12) + "…";
        }
      }catch(error){
        if(firmwareUpdateFile !== file) return;
        firmwareUpdateValidationError = error && error.message
          ? String(error.message)
          : "펌웨어 파일 검증에 실패했습니다.";
        firmwareUpdateBuffer = null;
        firmwareUpdateSha256 = "";
        if(el.firmwareUpdateFileMeta) el.firmwareUpdateFileMeta.textContent = "검증 실패";
      }
      updateFirmwareUpdateUi();
    }

    function bytesToBase64(bytes){
      let binary = "";
      for(let offset = 0; offset < bytes.length; offset += 0x2000){
        const part = bytes.subarray(offset, Math.min(bytes.length, offset + 0x2000));
        binary += String.fromCharCode.apply(null, part);
      }
      return btoa(binary);
    }

    function parseFirmwareProgressBytes(message){
      const match = String(message || "").match(/\bbytes=(\d+)/i);
      return match ? Math.max(0, Number(match[1]) || 0) : 0;
    }

    function updateFirmwareProgress(written, total, stage){
      const now = performance.now();
      const safeWritten = Math.max(0, Math.min(Number(total) || 0, Number(written) || 0));
      const safeTotal = Math.max(1, Number(total) || 1);
      const ratio = safeWritten / safeTotal;
      if(firmwareUpdateLastProgressAt > 0 && safeWritten > firmwareUpdateLastProgressBytes){
        const elapsedSec = Math.max(0.001, (now - firmwareUpdateLastProgressAt) / 1000);
        const instant = (safeWritten - firmwareUpdateLastProgressBytes) / elapsedSec;
        firmwareUpdateSmoothedBytesPerSec = firmwareUpdateSmoothedBytesPerSec > 0
          ? firmwareUpdateSmoothedBytesPerSec * 0.72 + instant * 0.28
          : instant;
      }
      firmwareUpdateLastProgressAt = now;
      firmwareUpdateLastProgressBytes = safeWritten;
      if(el.firmwareUpdateProgressStage && stage){
        el.firmwareUpdateProgressStage.textContent = stage;
      }
      if(el.firmwareUpdateProgressPercent){
        el.firmwareUpdateProgressPercent.textContent = Math.round(ratio * 100) + "%";
      }
      if(el.firmwareUpdateProgressBar){
        el.firmwareUpdateProgressBar.style.width = (ratio * 100).toFixed(2) + "%";
      }
      if(el.firmwareUpdateProgressBytes){
        el.firmwareUpdateProgressBytes.textContent =
          formatFirmwareBytes(safeWritten) + " / " + formatFirmwareBytes(safeTotal);
      }
      if(el.firmwareUpdateProgressSpeed){
        el.firmwareUpdateProgressSpeed.textContent =
          formatFirmwareRate(firmwareUpdateSmoothedBytesPerSec);
      }
      if(el.firmwareUpdateProgressEta){
        const eta = firmwareUpdateSmoothedBytesPerSec > 0
          ? (safeTotal - safeWritten) / firmwareUpdateSmoothedBytesPerSec
          : NaN;
        el.firmwareUpdateProgressEta.textContent = isFinite(eta)
          ? formatFirmwareEta(eta)
          : "계산 중";
      }
    }

    async function writeFirmwareSerialBatch(lines){
      if(!serialConnected || !serialWriter) throw new Error("SERIAL_NOT_READY");
      const encoded = new TextEncoder().encode(lines.join("\n") + "\n");
      await serialPromiseWithTimeout(
        serialWriter.write(encoded),
        30000,
        "SERIAL_WRITE_TIMEOUT");
    }

    async function uploadFirmwareOverSerial(buffer, hash){
      const bytes = new Uint8Array(buffer);
      const begin = await requestSerialCommandAck(
        "/firmware/begin?size=" + bytes.length + "&sha256=" + encodeURIComponent(hash),
        (event)=>String(event.message || "").toUpperCase().indexOf("FIRMWARE_BEGIN") === 0,
        {timeoutMs:6000, writeTimeoutMs:3000});
      if(!begin || !begin.ok){
        throw new Error(begin && begin.message ? begin.message : "SERIAL_NOT_READY");
      }

      let offset = 0;
      while(offset < bytes.length){
        const windowEnd = Math.min(bytes.length, offset + FIRMWARE_UPDATE_SERIAL_WINDOW_BYTES);
        const progressWaiter = createSerialAckWaiter((event)=>{
          if(event.kind === "err") return true;
          return event.kind === "ack" &&
            String(event.message || "").toUpperCase().indexOf("FIRMWARE_PROGRESS") === 0 &&
            parseFirmwareProgressBytes(event.message) >= windowEnd;
        }, 30000);
        try{
          while(offset < windowEnd){
            const lines = [];
            for(let batch = 0; batch < 8 && offset < windowEnd; batch += 1){
              const end = Math.min(windowEnd, offset + FIRMWARE_UPDATE_SERIAL_CHUNK_BYTES);
              const chunk = bytes.subarray(offset, end);
              lines.push(
                "/firmware/chunk?offset=" + offset + "&data=" + bytesToBase64(chunk)
              );
              offset = end;
            }
            await writeFirmwareSerialBatch(lines);
            updateFirmwareProgress(offset, bytes.length, "USB로 펌웨어 전송 중");
          }
          const progress = await progressWaiter.promise;
          if(!progress || !progress.ok){
            throw new Error(progress && progress.message ? progress.message : "TRANSFER_TIMEOUT");
          }
        }catch(error){
          cancelSerialAckWaiter(progressWaiter, "FIRMWARE_TRANSFER_ABORTED");
          throw error;
        }
      }

      updateFirmwareProgress(bytes.length, bytes.length, "이미지 무결성 검증 중");
      const complete = await requestSerialCommandAck(
        "/firmware/end",
        (event)=>String(event.message || "").toUpperCase().indexOf("FIRMWARE_COMPLETE") === 0,
        {timeoutMs:120000, writeTimeoutMs:3000});
      if(!complete || !complete.ok){
        throw new Error(complete && complete.message ? complete.message : "VERIFY_FAILED");
      }
    }

    function uploadFirmwareOverWifi(buffer, hash){
      return new Promise((resolve, reject)=>{
        const base = String(getApiBaseForCommands() || "").replace(/\/+$/, "");
        const xhr = new XMLHttpRequest();
        xhr.open("POST", base + "/firmware/update", true);
        xhr.timeout = 180000;
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.setRequestHeader("X-Firmware-SHA256", hash);
        xhr.upload.onprogress = (event)=>{
          if(event.lengthComputable){
            updateFirmwareProgress(event.loaded, event.total, "Wi-Fi로 펌웨어 전송 중");
          }
        };
        xhr.onerror = ()=>reject(new Error("보드 Wi-Fi 연결이 끊겼습니다."));
        xhr.ontimeout = ()=>reject(new Error("TRANSFER_TIMEOUT"));
        xhr.onload = ()=>{
          let payload = null;
          try{ payload = JSON.parse(xhr.responseText || "{}"); }catch(_error){}
          if(xhr.status >= 200 && xhr.status < 300 && payload && payload.ok){
            updateFirmwareProgress(buffer.byteLength, buffer.byteLength, "이미지 무결성 검증 완료");
            resolve(payload);
            return;
          }
          reject(new Error(
            payload && payload.err
              ? payload.err
              : ("HTTP_" + xhr.status)));
        };
        xhr.send(buffer);
      });
    }

    async function startFirmwareUpdate(){
      updateFirmwareUpdateUi();
      if(
        firmwareUpdateUiBusy ||
        !firmwareUpdateBuffer ||
        !firmwareUpdateSha256 ||
        !el.firmwareUpdateStart ||
        el.firmwareUpdateStart.disabled
      ) return;

      const transport = firmwareUpdateTransportKind();
      const buffer = firmwareUpdateBuffer;
      const hash = firmwareUpdateSha256;
      firmwareUpdateUiBusy = true;
      firmwareUpdateStartedAt = performance.now();
      firmwareUpdateLastProgressAt = firmwareUpdateStartedAt;
      firmwareUpdateLastProgressBytes = 0;
      firmwareUpdateSmoothedBytesPerSec = 0;
      document.body.classList.add("firmware-update-locked");
      setFirmwareUpdateProgressVisible(true);
      updateFirmwareProgress(0, buffer.byteLength, "업데이트 준비 중");

      try{
        if(transport === "serial"){
          await uploadFirmwareOverSerial(buffer, hash);
        }else if(transport === "wifi"){
          await uploadFirmwareOverWifi(buffer, hash);
        }else{
          throw new Error("연결된 보드를 찾을 수 없습니다.");
        }
        updateFirmwareProgress(buffer.byteLength, buffer.byteLength, "업데이트 완료 · 보드 재부팅 중");
        if(el.firmwareUpdateProgressEta) el.firmwareUpdateProgressEta.textContent = "재연결 대기";
        showToast(
          "펌웨어 업데이트가 완료되었습니다. 보드를 재부팅하고 있습니다.",
          "success",
          {key:"firmware-update-complete", duration:5200});
        setTimeout(()=>{
          firmwareUpdateUiBusy = false;
          document.body.classList.remove("firmware-update-locked");
          closeFirmwareUpdateModal();
        }, 4200);
      }catch(error){
        const raw = error && error.message ? String(error.message) : String(error || "");
        if(transport === "serial" && serialConnected && serialWriter){
          try{ await serialWriteLine("/firmware/abort", {log:false, timeoutMs:1200}); }catch(_abortError){}
        }
        firmwareUpdateUiBusy = false;
        document.body.classList.remove("firmware-update-locked");
        setFirmwareUpdateProgressVisible(false);
        firmwareUpdateValidationError = firmwareUpdateErrorText(
          raw
            .replace(/^ERR\s+/i, "")
            .replace(/^FIRMWARE_[A-Z_]+\s+/i, ""));
        if(el.firmwareUpdateStatus){
          el.firmwareUpdateStatus.textContent = firmwareUpdateValidationError;
          el.firmwareUpdateStatus.classList.add("is-error");
        }
        showToast(
          firmwareUpdateValidationError,
          "error",
          {key:"firmware-update-failed", duration:6500});
        updateFirmwareUpdateUi();
      }
    }

    function authorizeFirmwareUpdateFromHardware(){
      if(!isFirmwareUpdateOpen() || firmwareUpdateUiBusy) return false;
      firmwareUpdateAuthorized = true;
      if(firmwareUpdateAuthorizationTimer) clearTimeout(firmwareUpdateAuthorizationTimer);
      firmwareUpdateAuthorizationTimer = setTimeout(()=>{
        firmwareUpdateAuthorizationTimer = null;
        if(firmwareUpdateUiBusy) return;
        firmwareUpdateAuthorized = false;
        updateFirmwareUpdateUi();
      }, 58000);
      updateFirmwareUpdateUi();
      showToast(
        "펌웨어 업데이트 물리 인증이 완료되었습니다.",
        "success",
        {key:"firmware-update-authorized", duration:3200});
      return true;
    }
