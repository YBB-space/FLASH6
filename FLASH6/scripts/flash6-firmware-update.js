    const FIRMWARE_UPDATE_MIN_BYTES = 64 * 1024;
    const FIRMWARE_UPDATE_MAX_BYTES = 5 * 1024 * 1024;
    // The currently installed b52/b53 firmware can expose only a 256-byte
    // native USB RX queue. Keep the complete Base64 command below that limit
    // so a flash write can never truncate the following command.
    const FIRMWARE_UPDATE_SERIAL_CHUNK_BYTES = 128;
    const FIRMWARE_UPDATE_SERIAL_CONFIRM_BYTES = 2 * 1024;
    const FIRMWARE_UPDATE_SERIAL_LINE_PACE_MS = 2;
    const FIRMWARE_UPDATE_SERIAL_CONFIRM_RETRIES = 3;
    // Remote A.I LINK images are staged through the connected ground board.
    // Keep this command below the legacy 256-byte USB RX limit as well; using
    // a larger Base64 line can make otherwise valid boards report
    // LINE_TOO_LONG before the radio transfer even starts.
    const FIRMWARE_UPDATE_REMOTE_SERIAL_CHUNK_BYTES =
      FIRMWARE_UPDATE_SERIAL_CHUNK_BYTES;
    const FIRMWARE_UPDATE_REMOTE_SERIAL_CONFIRM_BYTES = 16 * 1024;
    const FIRMWARE_UPDATE_IMAGE_MAGIC = 0xE9;
    const FIRMWARE_UPDATE_REQUIRED_MARKERS = [
      "Altis_Intelligent3_firmware1",
      "Altis_Intelligent3_b3"
    ];
    const FIRMWARE_UPDATE_BUNDLED_BIN = "firmware/firmware.bin";
    const FIRMWARE_UPDATE_BUNDLED_MANIFEST = "firmware/manifest.json";
    let firmwareUpdateBundledLoadPromise = null;
    let firmwareUpdateBundledLoading = false;
    let firmwareUpdateFileSource = "none";
    let firmwareUpdateBundledManifest = null;

    function isFirmwareUpdateOpen(){
      return !!(
        el.firmwareUpdateOverlay &&
        !el.firmwareUpdateOverlay.classList.contains("hidden")
      );
    }

    function firmwareUpdateGatewayTransportKind(){
      if(serialConnected && serialWriter) return "serial";
      if(!simEnabled && connOk) return "wifi";
      return "none";
    }

    function firmwareUpdateRemoteNode(){
      if(firmwareUpdateTarget === "stage1") return 1;
      if(firmwareUpdateTarget === "stage2") return 2;
      return 0;
    }

    function firmwareUpdateTransportKind(){
      const gateway = firmwareUpdateGatewayTransportKind();
      if(firmwareUpdateRemoteNode() > 0 && gateway !== "none") return "ai_link";
      return gateway;
    }

    function firmwareUpdateTransportLabel(){
      const kind = firmwareUpdateTransportKind();
      if(kind === "ai_link"){
        return "A.I LINK DIRECT · STAGE " + firmwareUpdateRemoteNode();
      }
      if(kind === "serial") return "USB DIRECT";
      if(kind === "wifi") return "GROUND WI-FI";
      return "연결된 보드 없음";
    }

    function firmwareUpdateTargetLabel(){
      if(firmwareUpdateTarget === "stage1") return "STAGE 1 에비오닉스";
      if(firmwareUpdateTarget === "stage2") return "STAGE 2 에비오닉스";
      return "현재 연결된 보드";
    }

    function firmwareUpdateGroundRole(){
      return String(flashLinkUiRole || "").toLowerCase() === "ground";
    }

    function setFirmwareUpdateTarget(target){
      const next = target === "stage1" || target === "stage2"
        ? target
        : "local";
      if(next !== "local" && !firmwareUpdateGroundRole()) return;
      if(next === "stage2" && !flashLinkUiStage2Mode) return;
      firmwareUpdateTarget = next;
      firmwareUpdateValidationError = "";
      setFirmwareUpdateBlockedVisible(false);
      updateFirmwareUpdateUi();
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
      const remoteNode = firmwareUpdateRemoteNode();
      const remoteState = remoteNode > 0 ? stageTelemetryStore[remoteNode] : null;
      const telemetry = remoteState && remoteState.data
        ? remoteState.data
        : (latestTelemetry || {});
      const sequenceIdle = Number(telemetry.st || 0) === 0 &&
        Number(telemetry.rly || 0) === 0;
      const missionWaiting = Number(telemetry.uw || 0) === 1;
      const idle = sequenceIdle && !missionWaiting;
      const transport = firmwareUpdateTransportKind();
      return {
        sequenceIdle,
        missionWaiting,
        idle,
        connected: transport !== "none",
        targetConnected: remoteNode === 0 ||
          !!(remoteState && remoteState.connected),
        transport
      };
    }

    function firmwareUpdateErrorText(code){
      const key = String(code || "").trim().toUpperCase();
      const messages = {
        SAFETY_MODE_REQUIRED:"안전 모드를 먼저 켜세요.",
        ARM_LOCK_REQUIRED:"ARM 잠금을 먼저 켜세요.",
        SEQUENCE_ACTIVE:"진행 중인 미션 또는 시퀀스를 종료하세요.",
        PYRO_ACTIVE:"파이로 출력이 활성 상태입니다.",
        BAD_SIZE:"펌웨어 파일 크기가 허용 범위를 벗어났습니다.",
        BAD_SHA256:"펌웨어 무결성 정보가 올바르지 않습니다.",
        BAD_IMAGE_MAGIC:"ESP32-S3 펌웨어 이미지가 아닙니다.",
        BAD_OFFSET:"USB 청크 순서가 어긋났습니다. 보드 수신 위치를 다시 확인하세요.",
        BAD_CHUNK_SIZE:"USB 펌웨어 청크 크기가 올바르지 않습니다.",
        BASE64_DECODE_FAILED:"USB 펌웨어 청크가 전송 중 손상되었습니다.",
        UPDATE_NOT_ACTIVE:"보드의 펌웨어 업데이트 세션이 먼저 종료되었습니다.",
        SHA256_MISMATCH:"전송된 펌웨어의 무결성 검증에 실패했습니다.",
        TRANSFER_TIMEOUT:"전송 응답 시간이 초과되었습니다. 연결을 확인하세요.",
        SERIAL_BEGIN_TIMEOUT:"보드가 업데이트 시작에 응답하지 않았습니다. USB 연결 상태를 확인하세요.",
        SERIAL_TRANSFER_TIMEOUT:"USB 전송이 중단되었습니다. 케이블을 유지한 채 다시 시도하세요.",
        SERIAL_VERIFY_TIMEOUT:"전송은 끝났지만 보드의 펌웨어 검증 응답이 없습니다.",
        SERIAL_NOT_READY:"USB 연결을 확인하세요.",
        SERIAL_WRITE_FAIL:"USB 전송에 실패했습니다.",
        SERIAL_WRITE_TIMEOUT:"USB 전송 응답 시간이 초과되었습니다.",
        LINE_TOO_LONG:"USB 전송 프레임이 보드의 수신 한도를 초과했습니다.",
        VERIFY_FAILED:"보드에서 펌웨어 이미지 검증을 완료하지 못했습니다.",
        UPDATE_BUSY:"보드에서 다른 업데이트가 진행 중입니다.",
        FIRMWARE_EMPTY_BODY:"선택한 펌웨어 파일이 비어 있습니다.",
        GROUND_ROLE_REQUIRED:"A.I LINK 원격 업데이트는 지상국 모드에서만 사용할 수 있습니다.",
        GROUND_SEQUENCE_ACTIVE:"지상국 시퀀스가 진행 중이라 업데이트를 시작할 수 없습니다.",
        GROUND_MISSION_STANDBY_ACTIVE:"지상국이 미션 대기 상태라 업데이트를 시작할 수 없습니다.",
        STAGE2_MODE_REQUIRED:"지상국의 2단부 운용 모드를 먼저 켜세요.",
        TARGET_OFFLINE:"대상 에비오닉스가 오프라인입니다.",
        DIRECT_LINK_REQUIRED:"중계 경로에서는 업데이트할 수 없습니다. 대상 보드를 지상국 앞에 두고 직결 상태를 확인하세요.",
        LINK_RSSI_LOW:"A.I LINK 신호가 약합니다. 두 보드를 가까이 두고 안테나 방향을 확인하세요.",
        LINK_PACKET_LOSS_HIGH:"A.I LINK 패킷 손실률이 높습니다. 주변 간섭을 줄인 뒤 다시 시도하세요.",
        LINK_RX_RATE_LOW:"A.I LINK 수신률이 낮습니다. 링크가 안정될 때까지 기다리세요.",
        FLIGHT_ACTIVE:"대상 보드가 비행 상태입니다. 비행 중에는 업데이트할 수 없습니다.",
        TARGET_SEQUENCE_ACTIVE:"대상 보드의 미션 또는 시퀀스가 진행 중입니다.",
        MISSION_STANDBY_ACTIVE:"보드가 미션 대기 상태라 업데이트를 시작할 수 없습니다.",
        TARGET_MISSION_STANDBY_ACTIVE:"대상 보드가 미션 대기 상태라 업데이트를 시작할 수 없습니다.",
        TARGET_SAFETY_REQUIRED:"대상 에비오닉스의 안전 모드를 켜세요.",
        TARGET_ARM_LOCK_REQUIRED:"대상 에비오닉스의 ARM 잠금을 켜세요.",
        TARGET_ID_MISSING:"대상 보드의 S/N을 확인할 수 없습니다.",
        DIRECT_LINK_LOST:"업데이트 중 A.I LINK 직결 연결이 끊겼습니다.",
        INVALID_IMAGE:"대상 보드가 펌웨어 이미지를 거부했습니다.",
        NO_MEMORY:"지상국의 펌웨어 전송 메모리가 부족합니다.",
        BAD_TARGET:"업데이트 대상 보드를 확인할 수 없습니다."
      };
      return messages[key] || (key ? ("업데이트 실패 · " + key) : "펌웨어 업데이트에 실패했습니다.");
    }

    function updateFirmwareUpdateUi(){
      const readiness = firmwareUpdateReadiness();
      const remoteNode = firmwareUpdateRemoteNode();
      const groundRole = firmwareUpdateGroundRole();
      (el.firmwareUpdateTargetButtons || []).forEach((button)=>{
        const target = button.dataset.firmwareTarget || "local";
        button.classList.toggle("is-active", target === firmwareUpdateTarget);
        button.disabled = target !== "local" && (
          !groundRole ||
          (target === "stage2" && !flashLinkUiStage2Mode)
        );
      });
      if(el.firmwareUpdateTransport){
        el.firmwareUpdateTransport.textContent = firmwareUpdateTransportLabel();
      }
      setFirmwareUpdateCheck(
        el.firmwareUpdateSequenceState,
        readiness.sequenceIdle,
        readiness.sequenceIdle ? "정지" : "실행 중");
      setFirmwareUpdateCheck(
        el.firmwareUpdateMissionState,
        !readiness.missionWaiting,
        readiness.missionWaiting ? "대기 중" : "해제");

      let status = firmwareUpdateBundledLoading && !firmwareUpdateFile
        ? "프로젝트에 포함된 펌웨어를 불러오는 중입니다…"
        : "프로젝트 펌웨어를 불러오지 못했습니다. 다른 BIN 파일을 선택하세요.";
      if(firmwareUpdateValidationError){
        status = firmwareUpdateValidationError;
      }else if(firmwareUpdateFile && !firmwareUpdateBuffer){
        status = "펌웨어 파일을 검사하고 있습니다…";
      }else if(firmwareUpdateBuffer && remoteNode === 0 && !readiness.idle){
        status = readiness.missionWaiting
          ? "미션 대기 상태를 먼저 해제하세요."
          : "진행 중인 시퀀스와 파이로 출력을 먼저 종료하세요.";
      }else if(firmwareUpdateBuffer && !readiness.connected){
        status = "USB 또는 지상국 Wi-Fi로 보드를 직접 연결하세요.";
      }else if(firmwareUpdateBuffer && remoteNode > 0){
        status = "시작하면 대상의 비행 상태와 A.I LINK 직결 품질을 최종 검사합니다.";
      }else if(firmwareUpdateBuffer){
        status = "업데이트 준비가 완료되었습니다.";
      }
      if(el.firmwareUpdateStatus && !firmwareUpdateUiBusy){
        el.firmwareUpdateStatus.textContent = status;
        el.firmwareUpdateStatus.classList.toggle("is-error", !!firmwareUpdateValidationError);
        el.firmwareUpdateStatus.classList.toggle(
          "is-ready",
          !!firmwareUpdateBuffer &&
          (remoteNode > 0 || readiness.idle) &&
          readiness.connected);
      }
      if(el.firmwareUpdateStart){
        el.firmwareUpdateStart.disabled = !!(
          firmwareUpdateUiBusy ||
          !firmwareUpdateBuffer ||
          !firmwareUpdateSha256 ||
          (remoteNode === 0 && !readiness.idle) ||
          !readiness.connected);
      }
    }

    function openFirmwareUpdateModal(){
      if(!el.firmwareUpdateOverlay) return;
      setFirmwareUpdateProgressVisible(false);
      setFirmwareUpdateBlockedVisible(false);
      setOverlayVisible(el.firmwareUpdateOverlay, true);
      el.firmwareUpdateOverlay.setAttribute("aria-hidden", "false");
      updateFirmwareUpdateUi();
      if(!firmwareUpdateFile && !firmwareUpdateBundledLoadPromise){
        loadBundledFirmwareUpdateFile();
      }
    }

    function closeFirmwareUpdateModal(){
      if(firmwareUpdateUiBusy || !el.firmwareUpdateOverlay) return;
      setOverlayVisible(el.firmwareUpdateOverlay, false);
      el.firmwareUpdateOverlay.setAttribute("aria-hidden", "true");
    }

    function setFirmwareUpdateProgressVisible(visible){
      if(el.firmwareUpdateIdleView) el.firmwareUpdateIdleView.hidden = !!visible;
      if(el.firmwareUpdateConfirmView) el.firmwareUpdateConfirmView.hidden = true;
      if(el.firmwareUpdateProgressView) el.firmwareUpdateProgressView.hidden = !visible;
      if(el.firmwareUpdateBlockedView) el.firmwareUpdateBlockedView.hidden = true;
      if(el.firmwareUpdateActions) el.firmwareUpdateActions.hidden = !!visible;
      if(el.firmwareUpdateClose) el.firmwareUpdateClose.hidden = !!visible;
      if(el.firmwareUpdateOverlay){
        el.firmwareUpdateOverlay.classList.toggle("is-updating", !!visible);
      }
    }

    function setFirmwareUpdateBlockedVisible(visible, reasons){
      if(el.firmwareUpdateIdleView) el.firmwareUpdateIdleView.hidden = !!visible;
      if(el.firmwareUpdateConfirmView) el.firmwareUpdateConfirmView.hidden = true;
      if(el.firmwareUpdateProgressView) el.firmwareUpdateProgressView.hidden = true;
      if(el.firmwareUpdateBlockedView) el.firmwareUpdateBlockedView.hidden = !visible;
      if(el.firmwareUpdateActions) el.firmwareUpdateActions.hidden = !!visible;
      if(el.firmwareUpdateClose) el.firmwareUpdateClose.hidden = false;
      if(el.firmwareUpdateBlockedReasons && visible){
        const list = Array.isArray(reasons) ? reasons : [reasons];
        el.firmwareUpdateBlockedReasons.replaceChildren();
        list.filter(Boolean).forEach((reason)=>{
          const item = document.createElement("li");
          item.textContent = firmwareUpdateErrorText(reason);
          el.firmwareUpdateBlockedReasons.appendChild(item);
        });
      }
      if(el.firmwareUpdateOverlay){
        el.firmwareUpdateOverlay.classList.remove("is-updating");
      }
    }

    function setFirmwareUpdateConfirmVisible(visible){
      const active = !!visible;
      if(el.firmwareUpdateIdleView) el.firmwareUpdateIdleView.hidden = active;
      if(el.firmwareUpdateConfirmView) el.firmwareUpdateConfirmView.hidden = !active;
      if(el.firmwareUpdateProgressView) el.firmwareUpdateProgressView.hidden = true;
      if(el.firmwareUpdateBlockedView) el.firmwareUpdateBlockedView.hidden = true;
      if(el.firmwareUpdateActions) el.firmwareUpdateActions.hidden = active;
      if(el.firmwareUpdateClose) el.firmwareUpdateClose.hidden = false;
      if(el.firmwareUpdateOverlay){
        el.firmwareUpdateOverlay.classList.remove("is-updating");
      }
    }

    function openFirmwareUpdateConfirmation(){
      updateFirmwareUpdateUi();
      if(
        firmwareUpdateUiBusy ||
        !el.firmwareUpdateStart ||
        el.firmwareUpdateStart.disabled
      ) return;
      if(el.firmwareUpdateConfirmTarget){
        el.firmwareUpdateConfirmTarget.textContent = firmwareUpdateTargetLabel();
      }
      if(el.firmwareUpdateConfirmTransport){
        el.firmwareUpdateConfirmTransport.textContent = firmwareUpdateTransportLabel();
      }
      if(el.firmwareUpdateConfirmFile){
        el.firmwareUpdateConfirmFile.textContent = firmwareUpdateFile
          ? firmwareUpdateFile.name + " · " + formatFirmwareBytes(firmwareUpdateFile.size)
          : "--";
      }
      setFirmwareUpdateConfirmVisible(true);
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

    function firmwareBundleUrl(relativePath){
      const url = new URL(relativePath, document.baseURI);
      const assetVersion = typeof ASSET_VER !== "undefined"
        ? String(ASSET_VER || "")
        : "";
      if(assetVersion) url.searchParams.set("v", assetVersion);
      return url.href;
    }

    async function loadBundledFirmwareUpdateFile(){
      if(firmwareUpdateBundledLoadPromise) return firmwareUpdateBundledLoadPromise;
      firmwareUpdateBundledLoading = true;
      firmwareUpdateBundledLoadPromise = (async ()=>{
        firmwareUpdateValidationError = "";
        updateFirmwareUpdateUi();
        try{
          const responses = await Promise.all([
            fetch(firmwareBundleUrl(FIRMWARE_UPDATE_BUNDLED_MANIFEST), {cache:"no-store"}),
            fetch(firmwareBundleUrl(FIRMWARE_UPDATE_BUNDLED_BIN), {cache:"no-store"})
          ]);
          if(!responses[0].ok || !responses[1].ok){
            throw new Error("프로젝트 기본 펌웨어 파일을 찾지 못했습니다.");
          }
          const manifest = await responses[0].json();
          const blob = await responses[1].blob();
          const name = String(manifest.file || "firmware.bin");
          const file = new File([blob], name, {type:"application/octet-stream"});
          firmwareUpdateBundledManifest = manifest;
          await selectFirmwareUpdateFile(file, {
            source:"bundled",
            manifest
          });
          return true;
        }catch(error){
          firmwareUpdateBundledManifest = null;
          firmwareUpdateValidationError = error && error.message
            ? String(error.message)
            : "프로젝트 기본 펌웨어를 불러오지 못했습니다.";
          updateFirmwareUpdateUi();
          return false;
        }finally{
          firmwareUpdateBundledLoading = false;
          firmwareUpdateBundledLoadPromise = null;
        }
      })();
      return firmwareUpdateBundledLoadPromise;
    }

    async function selectFirmwareUpdateFile(file, options){
      const selection = options || {};
      firmwareUpdateFile = file || null;
      firmwareUpdateFileSource = file
        ? (selection.source === "bundled" ? "bundled" : "manual")
        : "none";
      firmwareUpdateBuffer = null;
      firmwareUpdateSha256 = "";
      firmwareUpdateValidationError = "";
      if(el.firmwareUpdateFileCard) el.firmwareUpdateFileCard.hidden = !file;
      if(el.firmwareUpdateFileLabel){
        el.firmwareUpdateFileLabel.textContent = firmwareUpdateFileSource === "bundled"
          ? "프로젝트 펌웨어"
          : "직접 선택한 펌웨어";
      }
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
        const manifest = selection.manifest || null;
        if(
          manifest &&
          manifest.sha256 &&
          String(manifest.sha256).toLowerCase() !== hash
        ){
          throw new Error("프로젝트 펌웨어의 SHA-256 정보가 일치하지 않습니다.");
        }
        if(
          manifest &&
          Number(manifest.size || 0) > 0 &&
          Number(manifest.size) !== file.size
        ){
          throw new Error("프로젝트 펌웨어의 파일 크기 정보가 일치하지 않습니다.");
        }
        if(firmwareUpdateFile !== file) return;
        firmwareUpdateBuffer = buffer;
        firmwareUpdateSha256 = hash;
        if(el.firmwareUpdateFileMeta){
          const buildText = manifest
            ? [manifest.version, manifest.build].filter(Boolean).join(" · ") + " · "
            : "";
          el.firmwareUpdateFileMeta.textContent = buildText +
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

    function parseFirmwareSerialStatus(message){
      const text = String(message || "");
      const jsonStart = text.indexOf("{");
      if(jsonStart < 0) return null;
      try{
        const value = JSON.parse(text.slice(jsonStart));
        return value && typeof value === "object" ? value : null;
      }catch(_error){
        return null;
      }
    }

    function waitFirmwareSerialPace(){
      return new Promise((resolve)=>{
        setTimeout(resolve, FIRMWARE_UPDATE_SERIAL_LINE_PACE_MS);
      });
    }

    async function requestFirmwareSerialStatus(){
      const reply = await requestSerialCommandAck(
        "/firmware/status",
        (event)=>String(event.message || "").toUpperCase().indexOf("FIRMWARE_STATUS") === 0,
        {timeoutMs:5000, writeTimeoutMs:2500, firmwareUpdate:true});
      return {
        reply:reply || null,
        status:reply && reply.ok
          ? parseFirmwareSerialStatus(reply.message)
          : null
      };
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

    async function writeFirmwareSerialChunk(bytes, offset, end){
      if(!serialConnected || !serialWriter) throw new Error("SERIAL_NOT_READY");
      const line =
        "/firmware/chunk?offset=" + offset +
        "&data=" + bytesToBase64(bytes.subarray(offset, end));
      const encoded = new TextEncoder().encode(line + "\n");
      await serialPromiseWithTimeout(
        serialWriter.write(encoded),
        6000,
        "SERIAL_WRITE_TIMEOUT");
      await waitFirmwareSerialPace();
    }

    async function uploadFirmwareOverSerial(buffer, hash){
      const bytes = new Uint8Array(buffer);
      const begin = await requestSerialCommandAck(
        "/firmware/begin?size=" + bytes.length + "&sha256=" + encodeURIComponent(hash),
        (event)=>String(event.message || "").toUpperCase().indexOf("FIRMWARE_BEGIN") === 0,
        {timeoutMs:6000, writeTimeoutMs:3000, firmwareUpdate:true});
      if(!begin || !begin.ok){
        const beginError = begin && begin.message ? begin.message : "SERIAL_NOT_READY";
        throw new Error(beginError === "SERIAL_TIMEOUT" ? "SERIAL_BEGIN_TIMEOUT" : beginError);
      }

      let offset = 0;
      while(offset < bytes.length){
        const confirmStart = offset;
        const confirmEnd = Math.min(
          bytes.length,
          confirmStart + FIRMWARE_UPDATE_SERIAL_CONFIRM_BYTES);
        let firstGroupError = null;
        const groupErrorWaiter = createSerialAckWaiter((event)=>{
          return event.kind === "err" &&
            String(event.message || "").toUpperCase().indexOf("FIRMWARE") >= 0;
        }, 15000);
        groupErrorWaiter.promise.then((result)=>{
          if(result && result.kind === "err" && !firstGroupError){
            firstGroupError = result;
          }
        });
        try{
          while(offset < confirmEnd){
            const end = Math.min(
              confirmEnd,
              offset + FIRMWARE_UPDATE_SERIAL_CHUNK_BYTES);
            await writeFirmwareSerialChunk(bytes, offset, end);
            offset = end;
            updateFirmwareProgress(offset, bytes.length, "USB로 펌웨어 전송 중");
          }

          let confirmed = false;
          for(
            let attempt = 0;
            attempt < FIRMWARE_UPDATE_SERIAL_CONFIRM_RETRIES;
            attempt += 1
          ){
            const result = await requestFirmwareSerialStatus();
            const reply = result ? result.reply : null;
            const status = result ? result.status : null;
            if(firstGroupError){
              throw new Error(firstGroupError.message || "SERIAL_TRANSFER_TIMEOUT");
            }
            if(reply && reply.kind === "err"){
              throw new Error(reply.message || "SERIAL_TRANSFER_TIMEOUT");
            }
            const written = status ? Math.round(Number(status.written)) : NaN;
            const total = status ? Math.round(Number(status.total)) : NaN;
            if(
              status &&
              Number(status.active) === 1 &&
              isFinite(written) &&
              written === confirmEnd &&
              (!isFinite(total) || total === bytes.length)
            ){
              confirmed = true;
              break;
            }
            if(
              status &&
              Number(status.active) === 1 &&
              isFinite(written) &&
              written >= confirmStart &&
              written < confirmEnd
            ){
              // The status command is ordered after the chunks on WebSerial.
              // Resume at the authoritative device offset when a retryable
              // frame error left this group only partially written.
              offset = written;
              updateFirmwareProgress(
                offset,
                bytes.length,
                "USB 수신 위치 재동기화 중");
              break;
            }
          }
          if(confirmed) continue;
          if(offset < confirmEnd) continue;
          throw new Error("SERIAL_TRANSFER_TIMEOUT");
        }finally{
          cancelSerialAckWaiter(groupErrorWaiter, "FIRMWARE_GROUP_COMPLETE");
        }
      }

      updateFirmwareProgress(bytes.length, bytes.length, "이미지 무결성 검증 중");
      const complete = await requestSerialCommandAck(
        "/firmware/end",
        (event)=>String(event.message || "").toUpperCase().indexOf("FIRMWARE_COMPLETE") === 0,
        {timeoutMs:120000, writeTimeoutMs:3000, firmwareUpdate:true});
      if(!complete || !complete.ok){
        const verifyError = complete && complete.message ? complete.message : "VERIFY_FAILED";
        throw new Error(verifyError === "SERIAL_TIMEOUT" ? "SERIAL_VERIFY_TIMEOUT" : verifyError);
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

    async function requestAiLinkFirmwareJson(path, timeoutMs){
      const controller = new AbortController();
      const timer = setTimeout(
        ()=>controller.abort(),
        Math.max(500, Number(timeoutMs) || 5000));
      try{
        const base = String(getApiBaseForCommands() || "").replace(/\/+$/, "");
        const response = await fetch(base + path, {
          cache:"no-store",
          signal:controller.signal
        });
        let payload = null;
        try{ payload = await response.json(); }catch(_error){}
        if(!response.ok || !payload || !payload.ok){
          const error = new Error(
            payload && payload.err
              ? String(payload.err)
              : ("HTTP_" + response.status));
          error.payload = payload;
          throw error;
        }
        return payload;
      }catch(error){
        if(error && error.name === "AbortError"){
          throw new Error("TRANSFER_TIMEOUT");
        }
        throw error;
      }finally{
        clearTimeout(timer);
      }
    }

    function stageFirmwareAtGround(buffer, hash, node){
      return new Promise((resolve, reject)=>{
        const base = String(getApiBaseForCommands() || "").replace(/\/+$/, "");
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          base + "/firmware/remote/update?node=" + encodeURIComponent(node),
          true);
        xhr.timeout = 20000;
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.setRequestHeader("X-Firmware-SHA256", hash);
        xhr.upload.onprogress = (event)=>{
          if(!event.lengthComputable) return;
          const stagedRatio = event.total > 0 ? event.loaded / event.total : 0;
          updateFirmwareProgress(
            Math.round(buffer.byteLength * stagedRatio * 0.01),
            buffer.byteLength,
            "지상국에 전송 이미지 준비 중");
        };
        xhr.onerror = ()=>reject(new Error("지상국 연결이 끊겼습니다."));
        xhr.ontimeout = ()=>reject(new Error("TRANSFER_TIMEOUT"));
        xhr.onload = ()=>{
          let payload = null;
          try{ payload = JSON.parse(xhr.responseText || "{}"); }catch(_error){}
          if(xhr.status >= 200 && xhr.status < 300 && payload && payload.ok){
            resolve(payload);
            return;
          }
          const error = new Error(
            payload && payload.err
              ? String(payload.err)
              : ("HTTP_" + xhr.status));
          error.payload = payload;
          reject(error);
        };
        xhr.send(buffer);
      });
    }

    async function uploadFirmwareOverAiLink(buffer, hash){
      const node = firmwareUpdateRemoteNode();
      if(node <= 0) throw new Error("BAD_TARGET");

      if(firmwareUpdateGatewayTransportKind() === "serial"){
        return uploadFirmwareOverAiLinkSerial(buffer, hash, node);
      }

      // Operational state and link quality are checked before the image is copied to the
      // ground station, then checked once more immediately before radio TX.
      await requestAiLinkFirmwareJson(
        "/firmware/remote/preflight?node=" + encodeURIComponent(node),
        5000);
      updateFirmwareProgress(0, buffer.byteLength, "운용 상태와 A.I LINK 품질 확인 완료");
      await stageFirmwareAtGround(buffer, hash, node);
      firmwareUpdateLastProgressAt = performance.now();
      firmwareUpdateLastProgressBytes = 0;
      firmwareUpdateSmoothedBytesPerSec = 0;
      updateFirmwareProgress(0, buffer.byteLength, "A.I LINK 전송 시작");

      const startedAt = performance.now();
      const deadlineMs = 90000;
      while(performance.now() - startedAt < deadlineMs){
        await new Promise((resolve)=>setTimeout(resolve, 120));
        const status = await requestAiLinkFirmwareJson(
          "/firmware/remote/status?node=" + encodeURIComponent(node),
          4000);
        const written = Math.max(0, Number(status.written) || 0);
        const total = Math.max(1, Number(status.total) || buffer.byteLength);
        updateFirmwareProgress(
          written,
          total,
          Number(status.status) === 3
            ? "대상 보드에서 이미지 검증 중"
            : "A.I LINK로 펌웨어 전송 중");
        if(Number(status.status) === 4){
          updateFirmwareProgress(total, total, "대상 보드 업데이트 완료");
          return status;
        }
        if(Number(status.status) === 5){
          throw new Error(String(status.error || "VERIFY_FAILED"));
        }
        if(
          Number(status.active) !== 1 &&
          Number(status.status) !== 1 &&
          Number(status.status) !== 2 &&
          Number(status.status) !== 3
        ){
          throw new Error(String(status.error || "UPDATE_NOT_ACTIVE"));
        }
      }
      try{
        await requestAiLinkFirmwareJson("/firmware/remote/abort", 1500);
      }catch(_error){}
      throw new Error("TRANSFER_TIMEOUT");
    }

    async function requestAiLinkFirmwareSerialStatus(node){
      const reply = await requestSerialCommandAck(
        "/firmware/remote/status?node=" + encodeURIComponent(node),
        (event)=>String(event.message || "").toUpperCase()
          .indexOf("FIRMWARE_REMOTE_STATUS") === 0,
        {timeoutMs:4000, writeTimeoutMs:2000, firmwareUpdate:true});
      if(!reply || !reply.ok){
        throw new Error(reply && reply.message ? reply.message : "SERIAL_TRANSFER_TIMEOUT");
      }
      const status = parseFirmwareSerialStatus(reply.message);
      if(!status) throw new Error("SERIAL_TRANSFER_TIMEOUT");
      return status;
    }

    async function uploadFirmwareOverAiLinkSerial(buffer, hash, node){
      const bytes = new Uint8Array(buffer);
      const preflight = await requestSerialCommandAck(
        "/firmware/remote/preflight?node=" + encodeURIComponent(node),
        (event)=>String(event.message || "").toUpperCase()
          .indexOf("FIRMWARE_REMOTE_PREFLIGHT") === 0,
        {timeoutMs:5000, writeTimeoutMs:2000, firmwareUpdate:true});
      if(!preflight || !preflight.ok){
        throw new Error(preflight && preflight.message
          ? preflight.message
          : "SERIAL_TRANSFER_TIMEOUT");
      }

      const begin = await requestSerialCommandAck(
        "/firmware/remote/begin?node=" + encodeURIComponent(node) +
          "&size=" + bytes.length +
          "&sha256=" + encodeURIComponent(hash),
        (event)=>String(event.message || "").toUpperCase()
          .indexOf("FIRMWARE_REMOTE_BEGIN") === 0,
        {timeoutMs:7000, writeTimeoutMs:2500, firmwareUpdate:true});
      if(!begin || !begin.ok){
        throw new Error(begin && begin.message ? begin.message : "SERIAL_TRANSFER_TIMEOUT");
      }

      let offset = 0;
      while(offset < bytes.length){
        const confirmEnd = Math.min(
          bytes.length,
          offset + FIRMWARE_UPDATE_REMOTE_SERIAL_CONFIRM_BYTES);
        while(offset < confirmEnd){
          const end = Math.min(
            confirmEnd,
            offset + FIRMWARE_UPDATE_REMOTE_SERIAL_CHUNK_BYTES);
          const command = "/firmware/remote/chunk?offset=" + offset +
            "&data=" + bytesToBase64(bytes.subarray(offset, end));
          const wrote = await serialWriteLine(command, {
            timeoutMs:3500,
            firmwareUpdate:true
          });
          if(!wrote) throw new Error("SERIAL_WRITE_FAIL");
          offset = end;
        }
        const status = await requestAiLinkFirmwareSerialStatus(node);
        const confirmed = Math.max(0, Number(status.written) || 0);
        if(Number(status.staging) !== 1 || confirmed > bytes.length){
          throw new Error(String(status.error || "SERIAL_TRANSFER_TIMEOUT"));
        }
        if(confirmed !== offset){
          offset = confirmed;
        }
        updateFirmwareProgress(
          Math.round(offset * 0.01),
          bytes.length,
          "USB 지상국에 전송 이미지 준비 중");
      }

      const staged = await requestSerialCommandAck(
        "/firmware/remote/end?node=" + encodeURIComponent(node),
        (event)=>String(event.message || "").toUpperCase()
          .indexOf("FIRMWARE_REMOTE_STAGED") === 0,
        {timeoutMs:10000, writeTimeoutMs:2500, firmwareUpdate:true});
      if(!staged || !staged.ok){
        throw new Error(staged && staged.message ? staged.message : "VERIFY_FAILED");
      }
      firmwareUpdateLastProgressAt = performance.now();
      firmwareUpdateLastProgressBytes = 0;
      firmwareUpdateSmoothedBytesPerSec = 0;
      updateFirmwareProgress(0, bytes.length, "A.I LINK 전송 시작");

      const startedAt = performance.now();
      while(performance.now() - startedAt < 90000){
        await new Promise((resolve)=>setTimeout(resolve, 120));
        const status = await requestAiLinkFirmwareSerialStatus(node);
        const written = Math.max(0, Number(status.written) || 0);
        const total = Math.max(1, Number(status.total) || bytes.length);
        updateFirmwareProgress(
          written,
          total,
          Number(status.status) === 3
            ? "대상 보드에서 이미지 검증 중"
            : "A.I LINK로 펌웨어 전송 중");
        if(Number(status.status) === 4){
          updateFirmwareProgress(total, total, "대상 보드 업데이트 완료");
          return status;
        }
        if(Number(status.status) === 5){
          throw new Error(String(status.error || "VERIFY_FAILED"));
        }
      }
      try{
        await requestSerialCommandAck(
          "/firmware/remote/abort?node=" + encodeURIComponent(node),
          (event)=>String(event.message || "").toUpperCase()
            .indexOf("FIRMWARE_REMOTE_ABORT") === 0,
          {timeoutMs:1500, writeTimeoutMs:1000, firmwareUpdate:true});
      }catch(_error){}
      throw new Error("TRANSFER_TIMEOUT");
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
        }else if(transport === "ai_link"){
          await uploadFirmwareOverAiLink(buffer, hash);
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
        let raw = error && error.message ? String(error.message) : String(error || "");
        if(transport === "serial" && serialConnected && serialWriter){
          try{
            const failureResult = await requestFirmwareSerialStatus();
            const failureStatus = failureResult ? failureResult.status : null;
            const boardError = failureStatus
              ? String(failureStatus.error || "").trim()
              : "";
            if(
              boardError &&
              (/UPDATE_NOT_ACTIVE/i.test(raw) || /SERIAL_TRANSFER_TIMEOUT/i.test(raw))
            ){
              raw = boardError;
            }
            if(failureStatus && Number(failureStatus.active) === 1){
              await serialWriteLine(
                "/firmware/abort",
                {log:false, timeoutMs:1200, firmwareUpdate:true});
            }
          }catch(_abortError){}
        }
        firmwareUpdateUiBusy = false;
        document.body.classList.remove("firmware-update-locked");
        const errorCode = raw
          .replace(/^ERR\s+/i, "")
          .replace(/^FIRMWARE_[A-Z_]+\s+/i, "");
        const blockedCodes = new Set([
          "GROUND_ROLE_REQUIRED",
          "UPDATE_BUSY",
          "BAD_TARGET",
          "STAGE2_MODE_REQUIRED",
          "GROUND_SEQUENCE_ACTIVE",
          "GROUND_MISSION_STANDBY_ACTIVE",
          "TARGET_OFFLINE",
          "DIRECT_LINK_REQUIRED",
          "LINK_RSSI_LOW",
          "LINK_PACKET_LOSS_HIGH",
          "LINK_RX_RATE_LOW",
          "FLIGHT_ACTIVE",
          "TARGET_SEQUENCE_ACTIVE",
          "TARGET_MISSION_STANDBY_ACTIVE",
          "TARGET_ID_MISSING"
        ]);
        firmwareUpdateValidationError = firmwareUpdateErrorText(errorCode);
        if(
          transport === "ai_link" &&
          (blockedCodes.has(errorCode) ||
            !!(error && error.payload && error.payload.blocked))
        ){
          setFirmwareUpdateBlockedVisible(true, [errorCode]);
          updateFirmwareUpdateUi();
          return;
        }
        setFirmwareUpdateProgressVisible(false);
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
