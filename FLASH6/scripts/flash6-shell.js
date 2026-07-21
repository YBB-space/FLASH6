/* FLASH6 runtime module: flash6-shell.js. Loaded in manifest order by flash6.js. */
    // =====================
    // ✅ SPLASH / PRELOAD
    // =====================
    function preloadImages(paths){
      const uniq = Array.from(new Set(paths.filter(Boolean)));
      return Promise.all(uniq.map(src => new Promise(resolve=>{
        const img = new Image();
        img.onload = () => resolve({src, ok:true});
        img.onerror = () => resolve({src, ok:false});
        img.src = src;
      })));
    }
    async function runSplashAndPreload(){
      const splash  = document.getElementById("splash");
      const app     = document.querySelector(".page-wrap");

      if(!splash || !app){
        app?.classList?.add("ready");
        return;
      }

      const MIN_SPLASH_MS = 1200;  // 최소 표시 시간

      const ASSETS = [
        "img/Flash_logo.svg",
        "img/Danger.svg",
        "img/Tick.svg",
        "img/Graph.svg",
        "img/Activity.svg",
      ];

      const startMs = performance.now();
      try{
        const preloadPromise = preloadImages(ASSETS);
        const PRELOAD_TIMEOUT_MS = 900;
        await Promise.race([
          preloadPromise,
          new Promise(r => setTimeout(r, PRELOAD_TIMEOUT_MS)),
        ]);

        const elapsed = performance.now() - startMs;
        const waitMs = Math.max(0, MIN_SPLASH_MS - elapsed);
        if(waitMs) await new Promise(r => setTimeout(r, waitMs));
      }catch(_e){
        // Ignore splash preload errors and continue boot.
      }finally{
        splash.classList.add("hide");
        app.classList.add("ready");
        setTimeout(()=>{ try{ splash.remove(); }catch(e){} }, 350);
      }
    }


    // =====================
    // UI 설정 저장
    // =====================
    const SETTINGS_KEY = "hanwool_tms_settings_v3";
    const OVERLAY_CHANNEL = "hanwool_overlay_sync";
    const OVERLAY_SYNC_KEY = "hanwool_overlay_latest";
    const OVERLAY_SYNC_MIN_MS = 150;
    let overlayChannel = null;
    let lastOverlaySyncMs = 0;
    let uiSettings = null;

    function normalizeDecimalDigits(value, fallback){
      const digits = Math.round(Number(value));
      if(!isFinite(digits)) return fallback;
      return Math.max(0, Math.min(4, digits));
    }
    function getQuickDataDigits(){
      return normalizeDecimalDigits(uiSettings && uiSettings.quickDataDigits, 1);
    }
    function getLoadcellChartDigits(){
      return normalizeDecimalDigits(uiSettings && uiSettings.loadcellChartDigits, 3);
    }
    function getStorageExportDigits(){
      return normalizeDecimalDigits(uiSettings && uiSettings.storageExportDigits, 3);
    }
    function buildDecimalPlaceholder(digits){
      const safeDigits = normalizeDecimalDigits(digits, 1);
      return safeDigits > 0 ? ("--." + "-".repeat(safeDigits)) : "--";
    }
    function formatFixedDisplay(value, digits, fallback){
      if(value == null || value === "") return (fallback == null) ? "--" : String(fallback);
      const num = Number(value);
      if(!isFinite(num)) return (fallback == null) ? "--" : String(fallback);
      return num.toFixed(normalizeDecimalDigits(digits, 1));
    }
    function normalizePyroChannel(value, fallback){
      const channel = Math.round(Number(value));
      if(!isFinite(channel)) return fallback;
      return Math.max(1, Math.min(PYRO_CHANNELS.length, channel));
    }
    function resetParachuteDeployState(){
      parachuteDeployLatched = false;
      parachuteDeployAtMs = 0;
      parachuteDeployChannel = 0;
      lastRelayMaskForParachute = 0;
    }
    function updateParachuteDeployState(st, relayMask, aborted, nowMs){
      const now = isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
      const state = Number(st);
      const mask = Number.isFinite(Number(relayMask)) ? Math.max(0, Math.trunc(Number(relayMask))) : 0;
      if(state === 1){
        resetParachuteDeployState();
      }

      const channel = normalizePyroChannel(uiSettings && uiSettings.daqSequencePyroChannel, 1);
      const bit = (1 << (channel - 1));
      const risingMask = (mask & (~lastRelayMaskForParachute));
      const postFlight = !!localTplusActive || !!tplusUiActive || (simEnabled && !!devParachuteDrop);

      if(state === 0 && !aborted && simEnabled && !!devParachuteDrop){
        parachuteDeployLatched = true;
        parachuteDeployAtMs = now;
        parachuteDeployChannel = channel;
      }else if(state === 0 && !aborted && postFlight && risingMask !== 0){
        let detectedBit = (risingMask & bit) ? bit : (risingMask & -risingMask);
        let detectedChannel = 1;
        for(let ch=1; ch<=4; ch++){
          if(detectedBit === (1 << (ch - 1))){
            detectedChannel = ch;
            break;
          }
        }
        parachuteDeployLatched = true;
        parachuteDeployAtMs = now;
        parachuteDeployChannel = detectedChannel;
      }

      if(parachuteDeployLatched){
        const simHold = (state === 0 && simEnabled && !!devParachuteDrop);
        const expired = (now - parachuteDeployAtMs) > PARACHUTE_STATUS_HOLD_MS;
        if((expired && !simHold) || aborted){
          parachuteDeployLatched = false;
        }
      }

      lastRelayMaskForParachute = mask;
    }
    function isParachuteDeployStatusActive(st, aborted){
      if(aborted || Number(st) !== 0) return false;
      if(simEnabled && !!devParachuteDrop) return true;
      if(!parachuteDeployLatched) return false;
      if((Date.now() - parachuteDeployAtMs) > PARACHUTE_STATUS_HOLD_MS){
        parachuteDeployLatched = false;
        return false;
      }
      return true;
    }
    function roundFixedNumber(value, digits){
      if(value == null || value === "") return null;
      const num = Number(value);
      if(!isFinite(num)) return null;
      return Number(num.toFixed(normalizeDecimalDigits(digits, 1)));
    }

    function defaultSettings(){
      return {
        thrustUnit:"kgf",
        quickDataDigits:1,
        loadcellChartDigits:3,
        storageExportDigits:3,
        cameraEnabled:false,
        ignDurationMs:1000,
        countdownSec:10,
        daqSequencePyroChannel:1,
        opMode:"daq",
        flashLinkRole:"avionics",
        flashLinkNodeId:1,
        flashLinkTargetNodeId:1,
        flashLinkStage2Mode:false,
        flashLinkDataMode:"flight",
        gyroPreview:"3d",
        mobileHudPreview:false,
        mobileImmersive:false,
        relaySafe: true,
        refreshGuard: true,
        safetyMode: false,
        armLock: true,
        igs: 0,
        serialEnabled: false,
        serialRx: true,
        serialTx: true,
        muteMode: false,
        lang: "ko",
        theme: "dark"
      };
    }
    function applyTheme(theme){
      const root = document.documentElement;
      if(theme === "dark"){
        root.setAttribute("data-theme", "dark");
      }else{
        root.removeAttribute("data-theme");
      }
    }
    function loadSettings(){
      try{
        const raw = localStorage.getItem(SETTINGS_KEY);
        uiSettings = raw ? Object.assign(defaultSettings(), JSON.parse(raw)) : defaultSettings();
      }catch(e){ uiSettings = defaultSettings(); }
      {
        const ignMsRaw = Number(uiSettings.ignDurationMs);
        const legacyIgnSec = Number(uiSettings.ignDurationSec);
        const ignMs = isFinite(ignMsRaw)
          ? ignMsRaw
          : (isFinite(legacyIgnSec) ? (legacyIgnSec * 1000) : 1000);
        uiSettings.ignDurationMs = Math.max(100, Math.min(3000, Math.round(ignMs)));
        delete uiSettings.ignDurationSec;
        const cd = Number(uiSettings.countdownSec);
        uiSettings.countdownSec = (isFinite(cd) ? Math.max(3, Math.min(60, Math.round(cd))) : 10);
        uiSettings.daqSequencePyroChannel = normalizePyroChannel(uiSettings.daqSequencePyroChannel, 1);
        uiSettings.quickDataDigits = normalizeDecimalDigits(uiSettings.quickDataDigits, 1);
        uiSettings.loadcellChartDigits = normalizeDecimalDigits(uiSettings.loadcellChartDigits, 3);
        uiSettings.storageExportDigits = normalizeDecimalDigits(uiSettings.storageExportDigits, 3);
        uiSettings.cameraEnabled = uiSettings.cameraEnabled === true;
        uiSettings.gyroPreview = normalizeGyroPreviewMode(uiSettings.gyroPreview);
        uiSettings.flashLinkRole = normalizeFlashLinkRole(uiSettings.flashLinkRole);
        uiSettings.flashLinkNodeId = normalizeFlashLinkNodeId(uiSettings.flashLinkNodeId);
        uiSettings.flashLinkTargetNodeId = normalizeFlashLinkNodeId(uiSettings.flashLinkTargetNodeId);
        uiSettings.flashLinkStage2Mode = uiSettings.flashLinkStage2Mode === true;
        uiSettings.flashLinkDataMode = normalizeDataModeValue(uiSettings.flashLinkDataMode, "flight");
      }
      relaySafeEnabled = !!uiSettings.relaySafe;
      uiSettings.refreshGuard = uiSettings.refreshGuard !== false;
      safetyModeEnabled = !!uiSettings.safetyMode;
      uiSettings.armLock = !!uiSettings.armLock;

      serialEnabled = !!uiSettings.serialEnabled;
      serialRxEnabled = uiSettings.serialRx !== false;
      serialTxEnabled = uiSettings.serialTx !== false;
      // Simulation is session-only. Discard values saved by older builds.
      simEnabled = false;
      delete uiSettings.simEnabled;
      setLanguage(uiSettings.lang || "ko");
      applyTheme(uiSettings.theme || "light");
      saveSettings();
    }
    function saveSettings(){ try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(uiSettings)); }catch(e){} }

    try{
      if("BroadcastChannel" in window){
        overlayChannel = new BroadcastChannel(OVERLAY_CHANNEL);
      }
    }catch(e){}

    function publishOverlaySample(sample){
      if(!sample) return;
      if(overlayChannel) overlayChannel.postMessage(sample);
      const now = Date.now();
      if(now - lastOverlaySyncMs >= OVERLAY_SYNC_MIN_MS){
        lastOverlaySyncMs = now;
        try{ localStorage.setItem(OVERLAY_SYNC_KEY, JSON.stringify(sample)); }catch(e){}
      }
    }

    function setWebcamPanelVisible(visible){
      if(el.desktopCameraBtn){
        el.desktopCameraBtn.classList.toggle("is-active", visible && (!!webcamStream || cameraSimSourceActive));
      }
    }

    function isCameraUseEnabled(){
      return !!(uiSettings && uiSettings.cameraEnabled === true);
    }

    function setWebcamPlaceholderState(titleKey, descKey, showSettingsAction, fallbackTitle){
      if(el.webcamPlaceholderTitle){
        el.webcamPlaceholderTitle.setAttribute("data-i18n", titleKey || "");
        el.webcamPlaceholderTitle.textContent = fallbackTitle || t(titleKey || "cameraWaitingTitle");
      }
      if(el.webcamPlaceholderDesc){
        el.webcamPlaceholderDesc.setAttribute("data-i18n", descKey || "");
        el.webcamPlaceholderDesc.textContent = t(descKey || "cameraWaitingDesc");
      }
      if(el.cameraOpenSettingsBtn){
        el.cameraOpenSettingsBtn.classList.toggle("hidden", !showSettingsAction);
      }
    }

    function setWebcamStatus(text, live, state){
      const cameraEnabled = isCameraUseEnabled();
      if(el.webcamPanel) el.webcamPanel.classList.toggle("is-live", !!live);
      if(el.webcamPanel) el.webcamPanel.classList.toggle("is-camera-disabled", !cameraEnabled && !cameraSimSourceActive);
      if(el.desktopCameraBtn){
        el.desktopCameraBtn.classList.toggle("is-active", !!live);
      }
      if(live) return;
      if(!cameraEnabled){
        setWebcamPlaceholderState("cameraDisabledTitle", "cameraDisabledDesc", true);
      }else if(state === "permission"){
        setWebcamPlaceholderState("cameraPermissionTitle", "cameraPermissionDesc", false);
      }else{
        setWebcamPlaceholderState("cameraWaitingTitle", "cameraWaitingDesc", false, text || "");
      }
    }

    function syncCameraEnabledState(){
      const enabled = isCameraUseEnabled();
      if(el.cameraEnabledToggle) el.cameraEnabledToggle.checked = enabled;
      if(cameraSimSourceActive){
        setWebcamStatus("SIMULATION", true);
        refreshWebcamDeviceOptions();
        return;
      }
      if(!enabled && webcamStream){
        stopWebcam();
        return;
      }
      if(enabled && webcamStream){
        setWebcamStatus("", true);
        return;
      }
      setWebcamStatus(enabled ? t("cameraWaitingTitle") : t("cameraDisabledTitle"), false);
    }

    async function refreshWebcamDeviceOptions(){
      if(!el.cameraMenuDeviceSelect) return;
      const cameraEnabled = isCameraUseEnabled();
      const renderOptions = (cameras)=>{
        const list = Array.isArray(cameras) ? cameras : [];
        const activeTrack = webcamStream && webcamStream.getVideoTracks ? webcamStream.getVideoTracks()[0] : null;
        const activeSettings = activeTrack && activeTrack.getSettings ? activeTrack.getSettings() : null;
        const activeId = String((activeSettings && activeSettings.deviceId) || selectedWebcamDeviceId || "");
        el.cameraMenuDeviceSelect.replaceChildren();
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = cameraEnabled ? "DEFAULT CAMERA" : "DEFAULT CAMERA · OFF";
        el.cameraMenuDeviceSelect.appendChild(defaultOption);
        const simOption = document.createElement("option");
        simOption.value = CAMERA_SIM_SOURCE_ID;
        simOption.textContent = "SIM · HERO LAUNCH";
        el.cameraMenuDeviceSelect.appendChild(simOption);
        list.forEach((camera, index)=>{
          const option = document.createElement("option");
          option.value = camera.deviceId || "";
          option.textContent = camera.label || ("CAMERA " + (index + 1));
          el.cameraMenuDeviceSelect.appendChild(option);
        });
        el.cameraMenuDeviceSelect.disabled = false;
        const hasActive = list.some((camera)=>camera.deviceId === activeId);
        el.cameraMenuDeviceSelect.value = cameraSimSourceActive
          ? CAMERA_SIM_SOURCE_ID
          : (hasActive ? activeId : "");
      };
      if(!cameraEnabled || !navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function"){
        renderOptions([]);
        return;
      }
      try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device)=>device && device.kind === "videoinput");
        renderOptions(cameras);
      }catch(_err){
        renderOptions([]);
      }
    }

    function syncCameraControlMenu(){
      const online = !!(connOk || wsConnected || serialConnected || simEnabled);
      if(el.cameraControlLinkState){
        el.cameraControlLinkState.textContent = online ? "ONLINE" : "OFFLINE";
        el.cameraControlLinkState.classList.toggle("is-online", online);
      }
      if(el.cameraControlFlightState){
        const state = el.cameraHudState && el.cameraHudState.textContent
          ? el.cameraHudState.textContent.trim()
          : "STANDBY";
        el.cameraControlFlightState.textContent = state || "STANDBY";
      }
      if(el.cameraMenuAbortBtn){
        el.cameraMenuAbortBtn.disabled = !el.abortBtn || !!el.abortBtn.disabled;
      }
    }

    function setCameraControlMenuOpen(open){
      if(!el.cameraControlMenuLayer) return;
      const shouldOpen = !!open && document.body.classList.contains("camera-view-active");
      el.cameraControlMenuLayer.classList.toggle("hidden", !shouldOpen);
      el.cameraControlMenuLayer.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
      document.body.classList.toggle("camera-control-menu-open", shouldOpen);
      if(shouldOpen){
        syncCameraControlMenu();
        refreshWebcamDeviceOptions();
        requestAnimationFrame(()=>{
          if(el.cameraControlMenuClose) el.cameraControlMenuClose.focus({preventScroll:true});
        });
      }
    }

    function releaseWebcamStream(){
      if(!webcamStream) return;
      webcamStream.getTracks().forEach((track)=>{
        try{ track.stop(); }catch(_e){}
      });
      webcamStream = null;
    }

    function setCameraSimSource(active){
      const nextActive = !!active;
      webcamRequestGeneration++;
      releaseWebcamStream();
      if(el.webcamVideo) el.webcamVideo.srcObject = null;
      cameraSimSourceActive = nextActive;
      if(el.webcamPanel) el.webcamPanel.classList.toggle("is-sim", nextActive);
      if(nextActive){
        selectedWebcamDeviceId = "";
        setWebcamPanelVisible(true);
        setWebcamStatus("SIMULATION", true);
      }else{
        setWebcamStatus(isCameraUseEnabled() ? t("cameraWaitingTitle") : t("cameraDisabledTitle"), false);
        setWebcamPanelVisible(false);
      }
      refreshWebcamDeviceOptions();
    }

    function stopWebcam(options){
      const preserveSim = !!(options && options.preserveSim);
      webcamRequestGeneration++;
      releaseWebcamStream();
      if(el.webcamVideo) el.webcamVideo.srcObject = null;
      if(!preserveSim){
        cameraSimSourceActive = false;
        if(el.webcamPanel) el.webcamPanel.classList.remove("is-sim");
      }
      if(preserveSim && cameraSimSourceActive){
        setWebcamStatus("SIMULATION", true);
        setWebcamPanelVisible(true);
        refreshWebcamDeviceOptions();
        return;
      }
      setWebcamStatus(t("cameraWaitingTitle"), false);
      setWebcamPanelVisible(false);
      refreshWebcamDeviceOptions();
    }

    async function startWebcam(options){
      const opts = options || {};
      if(cameraSimSourceActive){
        setWebcamStatus("SIMULATION", true);
        return true;
      }
      if(!isCameraUseEnabled()){
        if(webcamStream) stopWebcam();
        else setWebcamStatus(t("cameraDisabledTitle"), false);
        return false;
      }
      const requestedDeviceId = String(opts.deviceId || selectedWebcamDeviceId || "");
      if(webcamStream && !opts.force){
        setWebcamStatus("웹캠 연결됨", true);
        refreshWebcamDeviceOptions();
        return true;
      }
      if(!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function"){
        showToast("이 환경에서는 웹캠을 사용할 수 없습니다.", "warn");
        setWebcamStatus("웹캠 API를 사용할 수 없음", false);
        return false;
      }
      if(window.isSecureContext === false){
        showToast("웹캠은 HTTPS, localhost, 앱 환경에서만 사용할 수 있습니다.", "warn");
        setWebcamStatus("보안 컨텍스트 필요", false);
        return false;
      }
      setWebcamPanelVisible(true);
      setWebcamStatus(t("cameraWaitingTitle"), false);
      const requestGeneration = ++webcamRequestGeneration;
      try{
        const videoConstraints = {
          width:{ideal:1280},
          height:{ideal:720}
        };
        if(requestedDeviceId) videoConstraints.deviceId = {exact:requestedDeviceId};
        else videoConstraints.facingMode = "environment";
        const requestedStream = await navigator.mediaDevices.getUserMedia({
          video:videoConstraints,
          audio:false
        });
        if(requestGeneration !== webcamRequestGeneration || !isCameraUseEnabled()){
          requestedStream.getTracks().forEach((track)=>{
            try{ track.stop(); }catch(_e){}
          });
          return false;
        }
        webcamStream = requestedStream;
        if(el.webcamPanel) el.webcamPanel.classList.remove("is-sim");
        if(el.webcamVideo){
          el.webcamVideo.srcObject = webcamStream;
          try{ await el.webcamVideo.play(); }catch(_e){}
        }
        const activeTrack = webcamStream.getVideoTracks ? webcamStream.getVideoTracks()[0] : null;
        const activeSettings = activeTrack && activeTrack.getSettings ? activeTrack.getSettings() : null;
        selectedWebcamDeviceId = String((activeSettings && activeSettings.deviceId) || requestedDeviceId || "");
        setWebcamStatus("웹캠 연결됨", true);
        refreshWebcamDeviceOptions();
        showToast("웹캠이 켜졌습니다.", "success");
        return true;
      }catch(err){
        if(requestGeneration !== webcamRequestGeneration) return false;
        webcamStream = null;
        const name = err && err.name ? String(err.name) : "";
        const denied = name === "NotAllowedError" || name === "SecurityError";
        setWebcamStatus(denied ? t("cameraPermissionTitle") : "웹캠 연결 실패", false, denied ? "permission" : "error");
        showToast(denied ? "카메라 권한이 필요합니다." : "웹캠을 열 수 없습니다.", "warn");
        return false;
      }
    }

    async function selectWebcamDevice(deviceId){
      const nextDeviceId = String(deviceId || "");
      if(nextDeviceId === CAMERA_SIM_SOURCE_ID){
        setCameraSimSource(true);
        return;
      }
      if(cameraSimSourceActive) setCameraSimSource(false);
      if(!isCameraUseEnabled()){
        syncCameraEnabledState();
        return;
      }
      if(webcamStream && nextDeviceId && nextDeviceId === selectedWebcamDeviceId) return;
      const previousStream = webcamStream;
      webcamStream = null;
      if(previousStream){
        previousStream.getTracks().forEach((track)=>{
          try{ track.stop(); }catch(_e){}
        });
      }
      if(el.webcamVideo) el.webcamVideo.srcObject = null;
      selectedWebcamDeviceId = nextDeviceId;
      if(el.cameraMenuDeviceSelect) el.cameraMenuDeviceSelect.disabled = true;
      const connected = await startWebcam({deviceId:nextDeviceId, force:true});
      if(!connected && nextDeviceId){
        selectedWebcamDeviceId = "";
        await startWebcam({force:true});
      }
      refreshWebcamDeviceOptions();
    }

    function drawCameraTelemetryChart(canvas, definitions){
      if(!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if(width < 2 || height < 2) return;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if(canvas.width !== pixelWidth || canvas.height !== pixelHeight){
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const ctx = canvas.getContext("2d");
      if(!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const seriesDefinitions = Array.isArray(definitions) ? definitions.filter(Boolean) : [];
      const plot = {
        left:3,
        right:Math.max(5, width - 3),
        top:6,
        bottom:Math.max(10, height - 6)
      };
      const plotWidth = plot.right - plot.left;
      const plotHeight = plot.bottom - plot.top;

      ctx.lineWidth = 1;
      for(let row = 1; row <= 3; row++){
        const y = Math.round(plot.top + (plotHeight * row / 4)) + .5;
        ctx.strokeStyle = row === 2 ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.085)";
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();
      }
      for(let column = 1; column <= 3; column++){
        const x = Math.round(plot.left + (plotWidth * column / 4)) + .5;
        ctx.strokeStyle = column === 2 ? "rgba(255,255,255,.085)" : "rgba(255,255,255,.045)";
        ctx.beginPath();
        ctx.moveTo(x, plot.top);
        ctx.lineTo(x, plot.bottom);
        ctx.stroke();
      }

      const buildSeries = (source)=>{
        const raw = Array.isArray(source)
          ? source.slice(-CAMERA_CHART_VISIBLE_POINTS).map(Number)
          : [];
        const finite = raw.filter(Number.isFinite);
        if(finite.length < 2) return null;
        let min = Math.min.apply(null, finite);
        let max = Math.max.apply(null, finite);
        if((max - min) < .01){
          const pad = Math.max(.1, Math.abs(max) * .08);
          min -= pad;
          max += pad;
        }
        const padding = Math.max((max - min) * .12, .02);
        min -= padding;
        max += padding;
        return {raw, min, span:Math.max(.001, max - min)};
      };
      const drawSeries = (series, color, lineWidth, shadow)=>{
        if(!series) return;
        const pointCount = series.raw.length;
        let drawing = false;
        ctx.save();
        ctx.beginPath();
        series.raw.forEach((value, index)=>{
          if(!Number.isFinite(value)){
            drawing = false;
            return;
          }
          const x = plot.left + ((index / Math.max(1, pointCount - 1)) * plotWidth);
          const normalized = Math.max(0, Math.min(1, (value - series.min) / series.span));
          const y = plot.bottom - (normalized * plotHeight);
          if(!drawing){
            ctx.moveTo(x, y);
            drawing = true;
          }else{
            ctx.lineTo(x, y);
          }
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        if(shadow){
          ctx.shadowColor = "rgba(255,255,255,.22)";
          ctx.shadowBlur = 5;
        }
        ctx.stroke();
        ctx.restore();
      };
      const preparedSeries = seriesDefinitions.map((definition)=>({
        definition,
        series:buildSeries(definition.source)
      }));
      preparedSeries.forEach((prepared)=>{
        const definition = prepared.definition;
        drawSeries(
          prepared.series,
          definition.color || "rgba(255,255,255,.96)",
          Number(definition.lineWidth) || 2,
          !!definition.shadow
        );
      });
    }

    function resolveTelemetryStageId(data){
      if(!data || typeof data !== "object") return null;
      const explicit = Number(
        data.stage_node_id ?? data.stageNodeId ?? data.source_node_id ??
        data.sourceNodeId ?? data.node_id ?? data.nodeId
      );
      if(explicit === 1 || explicit === 2) return explicit;
      const role = normalizeFlashLinkRole(data.flash_link_role ?? data.fl_role ?? (uiSettings && uiSettings.flashLinkRole));
      const origin = String(data.data_origin ?? data.dataOrigin ?? "").toLowerCase();
      const candidate = role === "ground" && origin === "avionics"
        ? Number(data.fl_target ?? data.flash_link_target_node_id ?? (uiSettings && uiSettings.flashLinkTargetNodeId))
        : Number(data.fl_node ?? data.flash_link_node_id ?? (uiSettings && uiSettings.flashLinkNodeId));
      return candidate === 2 ? 2 : (candidate === 1 ? 1 : null);
    }

    function stageTelemetryPhaseLabel(data){
      if(!data) return "NO DATA";
      const phaseCode = Number(data.flight_phase_code);
      if(isFinite(phaseCode) && FLIGHT_PHASE_CODE_NAMES[phaseCode]){
        return String(FLIGHT_PHASE_CODE_NAMES[phaseCode]).replace(/_/g, " ").toUpperCase();
      }
      const st = Number(data.st);
      if(st === 1) return "COUNTDOWN";
      if(st === 2) return "POWERED FLIGHT";
      if(st === 3) return "SEQUENCE END";
      return "STANDBY";
    }

    function trimStageTelemetryHistory(values){
      if(values.length > STAGE_TELEMETRY_HISTORY_MAX){
        values.splice(0, values.length - STAGE_TELEMETRY_HISTORY_MAX);
      }
    }

    const stageTelemetryDashboardCache = {
      root:null,
      motorCard:null,
      stages:Object.create(null)
    };
    function getStageTelemetryDashboardNodes(){
      const root = el.stageTelemetryDeck;
      if(!root) return null;
      if(stageTelemetryDashboardCache.root === root) return stageTelemetryDashboardCache;
      stageTelemetryDashboardCache.root = root;
      stageTelemetryDashboardCache.motorCard = root.closest(".motor-card");
      stageTelemetryDashboardCache.stages = Object.create(null);
      [1, 2].forEach((stageId)=>{
        const card = root.querySelector('[data-stage-card="' + stageId + '"]');
        if(!card) return;
        const values = Object.create(null);
        ["link", "phase", "altitude", "speed", "gforce", "rate", "chip", "perf", "power", "event"].forEach((key)=>{
          values[key] = card.querySelector('[data-stage-value="' + key + '"]');
        });
        stageTelemetryDashboardCache.stages[stageId] = {card, values};
      });
      return stageTelemetryDashboardCache;
    }
    function setStageTelemetryClass(node, name, enabled){
      if(node && node.classList.contains(name) !== !!enabled){
        node.classList.toggle(name, !!enabled);
      }
    }
    function setStageTelemetryText(node, value){
      if(node && node.textContent !== value) node.textContent = value;
    }
    function stageTelemetryPerfText(data){
      if(!data) return "--%";
      const loopMs = Number(data.lt ?? data.loop ?? data.loopTime);
      const cpuUs = Number(data.ct ?? data.cpu_us ?? data.cpu);
      const loopUs = isFinite(loopMs) && loopMs > 0 ? loopMs * 1000 : NaN;
      if(!isFinite(cpuUs) || cpuUs < 0 || !isFinite(loopUs) || loopUs <= 0) return "--%";
      return Math.round(Math.max(0, Math.min(100, (cpuUs / loopUs) * 100))) + "%";
    }
    function stageTelemetryPowerText(data){
      if(!data) return "N";
      const raw = data.bp ?? data.batt_pct ?? data.battery_pct;
      const value = Number(raw);
      return isFinite(value) ? (Math.round(Math.max(0, Math.min(100, value))) + "%") : "N";
    }
    function updateStageTelemetryDashboard(){
      const dashboard = getStageTelemetryDashboardNodes();
      if(!dashboard) return;
      setStageTelemetryClass(dashboard.root, "hidden", !stageTelemetryModeActive);
      setStageTelemetryClass(
        dashboard.motorCard,
        "is-dual-stage",
        stageTelemetryModeActive && flashLinkUiStage2Mode
      );
      [1, 2].forEach((stageId)=>{
        const state = stageTelemetryStore[stageId];
        const nodes = dashboard.stages[stageId];
        if(!nodes) return;
        // Keep both vehicle cards visible in the dashboard. Stage 2 remains an
        // explicit OFFLINE / NO DATA card while second-stage operation is off.
        setStageTelemetryClass(nodes.card, "hidden", false);
        setStageTelemetryClass(nodes.card, "is-linked", !!state.connected);
        setStageTelemetryClass(nodes.card, "is-active-hud", cameraHudActiveStageId === stageId);
        const stageData = state.data || null;
        const stageRate = Number(stageData && (stageData.stage_rx_hz ?? stageData.rx_hz ?? stageData.fl_rx_hz));
        const stageChip = Number(stageData && (stageData.chip_temp_c ?? stageData.ctemp ?? stageData.chip_temp));
        const stageChipOkRaw = stageData && (stageData.chip_temp_ok ?? stageData.ctemp_ok);
        const stageChipOk = stageChipOkRaw == null || Number(stageChipOkRaw) !== 0;
        setStageTelemetryText(nodes.values.link, state.connected ? "ONLINE" : (state.valid ? "STALE" : "OFFLINE"));
        setStageTelemetryText(nodes.values.phase, state.valid ? stageTelemetryPhaseLabel(state.data) : "NO DATA");
        setStageTelemetryText(nodes.values.altitude, isFinite(state.altitudeM) ? state.altitudeM.toFixed(1) : "--");
        setStageTelemetryText(nodes.values.speed, isFinite(state.speedMps) ? Math.max(0, state.speedMps).toFixed(1) : "--");
        setStageTelemetryText(nodes.values.gforce, isFinite(state.gforceG) ? Math.max(0, state.gforceG).toFixed(2) : "--");
        setStageTelemetryText(nodes.values.rate, state.connected && isFinite(stageRate) ? (Math.round(stageRate) + " Hz") : "-- Hz");
        setStageTelemetryText(nodes.values.chip, state.valid && stageChipOk && isFinite(stageChip) ? (stageChip.toFixed(1) + "°C") : "--°C");
        setStageTelemetryText(nodes.values.perf, state.valid ? stageTelemetryPerfText(stageData) : "--%");
        setStageTelemetryText(nodes.values.power, state.valid ? stageTelemetryPowerText(stageData) : "N");
        setStageTelemetryText(nodes.values.event, state.lastEvent || "--");
      });
    }

    function setAutomaticActiveStage(stageId, reason){
      const next = Number(stageId) === 2 ? 2 : 1;
      if(cameraHudActiveStageId === next) return false;
      cameraHudActiveStageId = next;
      const state = stageTelemetryStore[next];
      if(state){
        // Force the newly active stage quaternion into the preview immediately.
        // A per-stage revision may already have been rendered earlier, so it
        // cannot be used as the switch gate here.
        state.gyroAppliedRevision = -1;
      }
      gyroAttitudeLastMs = 0;
      gyroUiAttitudeReady = false;
      applyActiveStageGyroAttitude(Date.now());
      updateStageTelemetryDashboard();
      addLogLine(
        "HUD/CONTROL AUTO STAGE " + next + (reason ? " · " + reason : ""),
        "AIL"
      );
      return true;
    }

    function updateAutomaticActiveStage(data){
      if(!stageTelemetryModeActive) return;
      if(!flashLinkUiStage2Mode){
        cameraHudStageSwitchLatched = false;
        setAutomaticActiveStage(1, "STAGE 1 ONLY");
        return;
      }
      const stage1 = stageTelemetryStore[1];
      const stage2 = stageTelemetryStore[2];
      const boardTargetRaw = Number(data && (data.fl_target ?? data.flash_link_target_node_id));
      const boardTarget = boardTargetRaw === 2 ? 2 : (boardTargetRaw === 1 ? 1 : null);
      let desired = cameraHudActiveStageId;
      let reason = "LINK HOLD";
      if(cameraHudStageSwitchLatched && stage2.connected){
        desired = 2;
        reason = "SEPARATION";
      }else if(boardTarget && stageTelemetryStore[boardTarget].connected){
        desired = boardTarget;
        reason = "GROUND AUTO";
      }else if(stage1.connected){
        desired = 1;
        reason = "STAGE 1 PRIMARY";
      }else if(stage2.connected){
        desired = 2;
        reason = "STAGE 1 LOST";
      }
      setAutomaticActiveStage(desired, reason);
    }

    function recordStageTelemetrySample(stageId, sample, options){
      const state = stageTelemetryStore[stageId];
      if(!state || !sample || typeof sample !== "object") return;
      const recordOptions = options || {};
      const wasDeploymentState = Number(state.data && state.data.deployment_state) || 0;
      const previousRxSeq = Number(state.rxSeq) || 0;
      const nextRxSeq = Math.max(0, Number(sample.stage_rx_seq ?? sample.rx_seq) || 0);
      const validRaw = recordOptions.valid ?? sample.stage_valid ?? sample.valid;
      const connectedRaw = recordOptions.connected ?? sample.stage_connected ?? sample.connected;
      const valid = validRaw == null ? true : Number(validRaw) !== 0;
      state.connected = connectedRaw == null ? state.connected : Number(connectedRaw) !== 0;
      state.valid = valid;
      if(!valid) return;
      const sequenceDelta = (nextRxSeq - previousRxSeq) >>> 0;
      const sequenceReset = nextRxSeq > 0 && previousRxSeq > 0 && nextRxSeq < previousRxSeq &&
        Number(sample.flight_phase_code) === 0 && Number(sample.st) === 0;
      const isNewRadioSample = nextRxSeq === 0 || previousRxSeq === 0 ||
        (sequenceDelta > 0 && sequenceDelta < 0x80000000) || sequenceReset;
      if(!isNewRadioSample){
        // The same relay snapshot can arrive again through a parallel/fallback
        // transport. Never let an older HTTP response overwrite a newer WS
        // attitude; that makes the gyro bounce backward and forward.
        return;
      }
      if(recordOptions.reuseSample){
        sample.stage_node_id = stageId;
        sample.data_origin = "avionics";
        state.data = sample;
      }else{
        state.data = Object.assign({}, state.data || {}, sample, {
          stage_node_id:stageId,
          data_origin:"avionics"
        });
      }
      state.attitudeRevision++;
      const ageMs = Math.max(0, Number(sample.stage_age_ms ?? sample.age_ms) || 0);
      state.updatedAt = Date.now() - Math.min(ageMs, 0x7fffffff);
      if(nextRxSeq > 0) state.rxSeq = nextRxSeq;
      const altitudeM = Number(sample.alt_m);
      const speedMps = readQuickTelemetrySpeedMps(sample);
      const gforceG = calcTotalAccelG(Number(sample.ax) || 0, Number(sample.ay) || 0, Number(sample.az) || 0);
      if(isFinite(altitudeM)) state.altitudeM = Math.abs(altitudeM) < .05 ? 0 : altitudeM;
      if(isFinite(speedMps)) state.speedMps = Math.max(0, speedMps);
      if(isFinite(gforceG)) state.gforceG = Math.max(0, gforceG);
      const alarmTitle = String(sample.mission_alarm_title || "").trim();
      if(alarmTitle) state.lastEvent = localizeFirmwareMissionAlarm(alarmTitle, sample.mission_alarm_message).title;
      state.altitudeHistory.push(isFinite(state.altitudeM) ? state.altitudeM : 0);
      state.speedHistory.push(isFinite(state.speedMps) ? state.speedMps : 0);
      state.gforceHistory.push(isFinite(state.gforceG) ? state.gforceG : 1);
      trimStageTelemetryHistory(state.altitudeHistory);
      trimStageTelemetryHistory(state.speedHistory);
      trimStageTelemetryHistory(state.gforceHistory);

      if(stageId === 1 && flashLinkUiStage2Mode){
        const deploymentState = Number(sample.deployment_state) || 0;
        const deploymentFlags = Number(sample.deployment_flags) || 0;
        const primaryServoFailed = (deploymentFlags & (1 << 3)) !== 0;
        const separationConfirmed = (deploymentState >= 2 && !primaryServoFailed) ||
          missionAlarmSignalsPrimaryDeployment(sample);
        const missionReset = nextRxSeq > 0 && previousRxSeq > 0 && nextRxSeq < previousRxSeq;
        const returnedToPreflight = wasDeploymentState >= 2 && deploymentState === 0 &&
          Number(sample.flight_phase_code) === 0 && Number(sample.st) === 0;
        if(missionReset || returnedToPreflight){
          setAutomaticActiveStage(1, "MISSION RESET");
          cameraHudStageSwitchLatched = false;
        }else if(separationConfirmed && !cameraHudStageSwitchLatched){
          cameraHudStageSwitchLatched = true;
          setAutomaticActiveStage(2, "SEPARATION");
          latchCameraEventState("단분리 · HUD 2단 전환");
        }
      }else if(stageId === 1){
        cameraHudStageSwitchLatched = false;
      }
    }

    function ingestStageTelemetryBundle(data, src, isReplaySample, renderUi){
      if(!data || typeof data !== "object") return;
      const stage2ModeRaw = data.fl_stage2_mode ?? data.flash_link_stage2_mode;
      if(stage2ModeRaw != null) flashLinkUiStage2Mode = Number(stage2ModeRaw) !== 0;
      const bundle = Array.isArray(data.stage_telemetry)
        ? data.stage_telemetry
        : (Array.isArray(data.stageTelemetry) ? data.stageTelemetry : []);
      if(bundle.length){
        stageTelemetryModeActive = true;
        bundle.forEach((sample)=>{
          const stageId = resolveTelemetryStageId(sample);
          if(stageId !== 1 && stageId !== 2) return;
          if(stageId === 2 && !flashLinkUiStage2Mode) return;
          recordStageTelemetrySample(stageId, sample);
          handleMissionAlarmTelemetry(sample, src, isReplaySample, stageId);
        });
        updateAutomaticActiveStage(data);
      }else{
        const explicitRoleRaw = data.flash_link_role ?? data.fl_role;
        const groundSample = explicitRoleRaw != null &&
          normalizeFlashLinkRole(explicitRoleRaw) === "ground";
        const leaveGroundMode = isReplaySample ||
          (explicitRoleRaw != null && !groundSample);
        if(leaveGroundMode && stageTelemetryModeActive){
          stageTelemetryModeActive = false;
          setAutomaticActiveStage(1, "GROUND MODE END");
          cameraHudStageSwitchLatched = false;
        }else if(groundSample){
          stageTelemetryModeActive = true;
          if(data.fl_stage1 != null || data.flash_link_stage1_connected != null){
            stageTelemetryStore[1].connected = Number(
              data.fl_stage1 ?? data.flash_link_stage1_connected
            ) !== 0;
          }
          if(data.fl_stage2 != null || data.flash_link_stage2_connected != null){
            stageTelemetryStore[2].connected = Number(
              data.fl_stage2 ?? data.flash_link_stage2_connected
            ) !== 0;
          }
        }
      }
      if(!bundle.length){
        const stageId = resolveTelemetryStageId(data);
        if(stageId === 1 || stageId === 2){
          const stageSample = Object.assign({}, data, {
            stage_connected:stageTelemetryStore[stageId].connected ? 1 : 0,
            stage_valid:Number(data.fl_remote_valid ?? data.flash_link_remote_valid ?? 1) ? 1 : 0
          });
          recordStageTelemetrySample(stageId, stageSample, {reuseSample:true});
        }
        updateAutomaticActiveStage(data);
      }
      if(renderUi !== false) updateStageTelemetryDashboard();
    }

    function buildCameraHudStageValues(fallback){
      if(!stageTelemetryModeActive) return fallback;
      const active = stageTelemetryStore[cameraHudActiveStageId];
      const stage1 = stageTelemetryStore[1];
      const source = active && active.valid ? active : null;
      if(!source) return Object.assign({}, fallback, {
        stageId:cameraHudActiveStageId,
        connected:false,
        stateText:"STAGE " + cameraHudActiveStageId + " · NO DATA",
        stateStatus:"bad"
      });
      const data = source.data || {};
      const separationData = stage1 && stage1.data ? stage1.data : data;
      return Object.assign({}, fallback, {
        stageId:cameraHudActiveStageId,
        connected:source.connected,
        stateText:stageTelemetryPhaseLabel(data),
        stateStatus:source.connected ? "ok" : "warn",
        st:Number(data.st) || 0,
        td:Number(data.td) || 0,
        altitudeM:source.altitudeM,
        altitudeRateMps:Number(data.vertical_speed_mps) || 0,
        speedMps:source.speedMps,
        gforceG:source.gforceG,
        swOn:Number(data.s) !== 0,
        ignitionDelayMs:data.ignition_delay_ms,
        ignitionDelayValid:data.ignition_delay_valid,
        deploymentState:separationData.deployment_state,
        deploymentFlags:separationData.deployment_flags,
        flightPhaseCode:data.flight_phase_code,
        missionAlarmTitle:separationData.mission_alarm_title,
        missionAlarmMessage:separationData.mission_alarm_message
      });
    }

    function getActiveGyroTelemetryData(fallbackData){
      if(!stageTelemetryModeActive) return fallbackData || null;
      const state = stageTelemetryStore[cameraHudActiveStageId];
      // In dual-stage ground mode never fall back to the ground board's own
      // IMU. Alternating ground and vehicle quaternions on every packet makes
      // the preview jump between two unrelated attitudes. If the selected
      // vehicle becomes stale, hold the last pose until that stage returns.
      return state && state.valid && state.connected && state.data
        ? state.data
        : null;
    }
    function applyActiveStageGyroAttitude(nowMs){
      if(!stageTelemetryModeActive) return false;
      const state = stageTelemetryStore[cameraHudActiveStageId];
      const data = getActiveGyroTelemetryData(null);
      if(!state || !data || state.attitudeRevision === state.gyroAppliedRevision) return false;
      const applied = applyFirmwareGyroAttitudeEstimate(
        Number(data.gr),
        Number(data.gp),
        Number(data.gyw),
        nowMs || Date.now(),
        Number(data.gx),
        Number(data.gy),
        Number(data.gz),
        data.attitude_q,
        {smoothRelayedQuat:true}
      );
      if(applied){
        state.gyroAppliedRevision = state.attitudeRevision;
        scheduleLiveGyroRender(Number(data.gy) || 0);
      }
      return applied;
    }

    function drawCameraHudChart(){
      const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      if((now - cameraChartLastDrawAt) < 80) return;
      cameraChartLastDrawAt = now;
      const stageState = stageTelemetryModeActive ? stageTelemetryStore[cameraHudActiveStageId] : null;
      const altitudeSource = stageState && stageState.altitudeHistory.length
        ? stageState.altitudeHistory
        : quickAltitudeHistory;
      const speedSource = stageState && stageState.speedHistory.length
        ? stageState.speedHistory
        : quickVelocityHistory;
      const gforceSource = stageState && stageState.gforceHistory.length
        ? stageState.gforceHistory
        : quickSpeedHistory;
      drawCameraTelemetryChart(el.cameraAltitudeChart, [
        {
          source:altitudeSource,
          color:"rgba(255,255,255,.94)",
          lineWidth:1.05,
          shadow:false
        }
      ]);
      drawCameraTelemetryChart(el.cameraDynamicsChart, [
        {
          source:speedSource,
          color:"rgba(255,255,255,.94)",
          lineWidth:1.05,
          shadow:false
        },
        {
          source:gforceSource,
          color:"rgba(174,180,188,.46)",
          lineWidth:.7
        }
      ]);
    }

    function setCameraStageSeparating(active){
      if(el.cameraHudAttitudeGroup) el.cameraHudAttitudeGroup.classList.toggle("is-stage-separating", !!active);
      if(el.cameraHudFlightGauges) el.cameraHudFlightGauges.classList.toggle("is-stage-separating", !!active);
    }

    function getMissionAlarmEvents(data){
      if(!data || typeof data !== "object") return [];
      if(Array.isArray(data.missionAlarmEvents)) return data.missionAlarmEvents;
      if(Array.isArray(data.mission_alarm_events)) return data.mission_alarm_events;
      if(data.missionAlarmTitle || data.mission_alarm_title || data.missionAlarmMessage || data.mission_alarm_message){
        return [{
          title:data.missionAlarmTitle ?? data.mission_alarm_title,
          message:data.missionAlarmMessage ?? data.mission_alarm_message
        }];
      }
      return [];
    }

    function missionAlarmSignalsPrimaryDeployment(data){
      return getMissionAlarmEvents(data).some((event)=>{
        const title = String((event && event.title) || "").toLowerCase();
        const message = String((event && event.message) || "").toLowerCase();
        if(/servo\s*1\s*failed|서보\s*1[^\n]*실패/.test(title + " " + message)) return false;
        return /backup\s*deploy|coasting\s*conf|coasting\s*detec|백업\s*단분리|코스팅\s*감지\s*(?:완료|실패)/.test(title) ||
          /ch1\s*set\s*to\s*8|servo\s*1[^\n]*8|서보\s*1[^\n]*8/.test(message);
      });
    }

    function missionAlarmSignalsSecondaryDeployment(data){
      return getMissionAlarmEvents(data).some((event)=>{
        const title = String((event && event.title) || "").toLowerCase();
        const message = String((event && event.message) || "").toLowerCase();
        return /secondary\s*depl|2차\s*사출/.test(title) ||
          /ch2\s*set\s*to\s*8|서보\s*2[^\n]*8/.test(message);
      });
    }

    function resetCameraStageSeparation(renderNow){
      cameraStageSeparationLatched = false;
      cameraStageSeparationProgress = 0;
      cameraStageSeparationFallbackAt = 0;
      if(cameraStageSeparationAutoRaf){
        cancelAnimationFrame(cameraStageSeparationAutoRaf);
        cameraStageSeparationAutoRaf = 0;
      }
      setCameraStageSeparating(false);
      if(renderNow && gyroGl){
        renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        renderGyroPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
      }
    }

    function scheduleCameraStageSeparationRender(){
      if(cameraStageSeparationAutoRaf || cameraStageSeparationManualAt || !cameraStageSeparationFallbackAt) return;
      const renderFrame = ()=>{
        cameraStageSeparationAutoRaf = 0;
        if(cameraStageSeparationManualAt || !cameraStageSeparationLatched || !cameraStageSeparationFallbackAt) return;
        const elapsedMs = Math.max(0, Date.now() - cameraStageSeparationFallbackAt);
        cameraStageSeparationProgress = clampLocal(elapsedMs / 1800, 0, 1);
        setCameraStageSeparating(true);
        if(gyroGl){
          renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderGyroPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        }
        if(cameraStageSeparationProgress < 1){
          cameraStageSeparationAutoRaf = requestAnimationFrame(renderFrame);
        }
      };
      cameraStageSeparationAutoRaf = requestAnimationFrame(renderFrame);
    }

    function updateCameraStageSeparation(data){
      if(cameraStageSeparationManualAt) return;
      if(simEnabled && simState && simState.stageSeparationStartedMs){
        const elapsedMs = Math.max(0, Date.now() - simState.stageSeparationStartedMs);
        const previousProgress = cameraStageSeparationProgress;
        cameraStageSeparationProgress = clampLocal(elapsedMs / 1800, 0, 1);
        setCameraStageSeparating(true);
        if(previousProgress <= 0 && cameraStageSeparationProgress > 0){
          latchCameraEventState("단분리 · T+2.0 S");
        }
        return;
      }
      const deploymentRaw = data && data.deploymentState != null
        ? data.deploymentState
        : (data && data.deployment_state != null
          ? data.deployment_state
          : (latestTelemetry && latestTelemetry.deployment_state));
      const deploymentState = Number(deploymentRaw);
      const deploymentFlagsRaw = data && data.deploymentFlags != null
        ? data.deploymentFlags
        : (data && data.deployment_flags != null
          ? data.deployment_flags
          : (latestTelemetry && latestTelemetry.deployment_flags));
      const deploymentFlags = Number(deploymentFlagsRaw) || 0;
      const primaryServoFailed = (deploymentFlags & (1 << 3)) !== 0;
      const eventDeployment = missionAlarmSignalsPrimaryDeployment(data);
      const flightPhaseCode = Number(data && (data.flightPhaseCode ?? data.flight_phase_code));
      const armOn = data && data.swOn;
      if(deploymentState === 0 && flightPhaseCode === 0 && armOn === true && !eventDeployment){
        if(cameraStageSeparationLatched || cameraStageSeparationProgress > 0){
          resetCameraStageSeparation(true);
        }
        return;
      }
      const deploymentConfirmed = (isFinite(deploymentState) && deploymentState >= 2 && !primaryServoFailed) || eventDeployment;
      if(!deploymentConfirmed && !cameraStageSeparationLatched) return;
      if(deploymentConfirmed) cameraStageSeparationLatched = true;
      if(!cameraStageSeparationFallbackAt) cameraStageSeparationFallbackAt = Date.now();
      const elapsedMs = Date.now() - cameraStageSeparationFallbackAt;
      const fadeDurationMs = 1800;
      const previousProgress = cameraStageSeparationProgress;
      cameraStageSeparationProgress = Math.max(0, Math.min(1, elapsedMs / fadeDurationMs));
      setCameraStageSeparating(cameraStageSeparationProgress > 0);
      if(previousProgress <= 0 && cameraStageSeparationProgress > 0){
        latchCameraEventState("단분리 · 서보 CH1");
      }
      scheduleCameraStageSeparationRender();
    }

    function triggerCameraStageSeparationPreview(){
      cameraStageSeparationManualAt = Date.now();
      cameraStageSeparationProgress = 0;
      setCameraStageSeparating(true);
      latchCameraEventState("단분리");
      syncCameraHud();
      if(cameraStageSeparationManualRaf) cancelAnimationFrame(cameraStageSeparationManualRaf);
      const renderFrame = ()=>{
        if(!cameraStageSeparationManualAt){
          cameraStageSeparationManualRaf = 0;
          return;
        }
        const elapsedMs = Date.now() - cameraStageSeparationManualAt;
        if(elapsedMs >= 3000){
          cameraStageSeparationManualAt = 0;
          cameraStageSeparationProgress = 0;
          cameraStageSeparationManualRaf = 0;
          cameraStageSeparationCountdownUntil = 0;
          cameraStageSeparationTriggerAt = 0;
          setCameraStageSeparating(false);
          if(gyroGl) renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          syncCameraHud();
          return;
        }
        cameraStageSeparationProgress = Math.max(0, Math.min(1, elapsedMs / 1800));
        if(gyroGl) renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        cameraStageSeparationManualRaf = requestAnimationFrame(renderFrame);
      };
      cameraStageSeparationManualRaf = requestAnimationFrame(renderFrame);
    }

    function startCameraStageSeparationCountdown(){
      if(cameraStageSeparationTriggerAt > Date.now() || cameraStageSeparationManualAt > 0){
        showToast("단 분리 카운트다운 진행 중", "info", {key:"camera-stage-separation-preview"});
        return;
      }
      if(cameraStageSeparationCountdownTimer){
        clearTimeout(cameraStageSeparationCountdownTimer);
        cameraStageSeparationCountdownTimer = 0;
      }
      cameraStageSeparationCountdownUntil = Date.now() + 10000;
      cameraStageSeparationTriggerAt = cameraStageSeparationCountdownUntil + 5000;
      showToast("단 분리 테스트 T-10 시작", "info", {key:"camera-stage-separation-preview"});

      const tick = ()=>{
        if(!document.body.classList.contains("camera-view-active")){
          cameraStageSeparationCountdownUntil = 0;
          cameraStageSeparationTriggerAt = 0;
          cameraStageSeparationCountdownTimer = 0;
          return;
        }
        const now = Date.now();
        const remainMs = cameraStageSeparationCountdownUntil - now;
        if(now >= cameraStageSeparationTriggerAt){
          cameraStageSeparationTriggerAt = 0;
          cameraStageSeparationCountdownTimer = 0;
          triggerCameraStageSeparationPreview();
          showToast("단 분리 프리뷰", "info", {key:"camera-stage-separation-preview"});
          return;
        }
        if(remainMs > 0){
          const remainSec = Math.ceil(remainMs / 1000);
          const instrumentsReady = remainMs <= 3000;
          if(el.cameraHudTimerTag) el.cameraHudTimerTag.textContent = "T-";
          if(el.cameraHudCountdown) el.cameraHudCountdown.textContent = "00:" + String(remainSec).padStart(2, "0");
          if(el.cameraSequenceDock) el.cameraSequenceDock.classList.remove("is-tplus");
          if(el.cameraHudFlightGauges) el.cameraHudFlightGauges.classList.toggle("hidden", !instrumentsReady);
          if(el.cameraHudAttitudeGroup) el.cameraHudAttitudeGroup.classList.toggle("hidden", !instrumentsReady);
        }else{
          const elapsedSec = Math.min(5, Math.floor((now - cameraStageSeparationCountdownUntil) / 1000));
          if(el.cameraHudTimerTag) el.cameraHudTimerTag.textContent = "T+";
          if(el.cameraHudCountdown) el.cameraHudCountdown.textContent = "00:" + String(elapsedSec).padStart(2, "0");
          if(el.cameraSequenceDock) el.cameraSequenceDock.classList.add("is-tplus");
          if(el.cameraHudFlightGauges) el.cameraHudFlightGauges.classList.remove("hidden");
          if(el.cameraHudAttitudeGroup) el.cameraHudAttitudeGroup.classList.remove("hidden");
        }
        cameraStageSeparationCountdownTimer = setTimeout(tick, 100);
      };
      tick();
    }

    function latchCameraEventState(text){
      const value = String(text || "").replace(/\s+/g, " ").trim();
      if(!value) return;
      cameraLastEventStateKey = value.toUpperCase();
      cameraEventStateText = value;
      cameraEventStateUntil = Date.now() + 2200;
    }

    function getCameraSequenceStateText(rawStateText){
      const text = String(rawStateText || "").replace(/\s+/g, " ").trim();
      const upper = text.toUpperCase();
      const eventPattern = /(COUNT|IGNIT|FIRE|ABORT|PARACHUTE|DEPLOY|SEPARAT|LIFTOFF|LOCKOUT|ERROR|FAULT|카운트|점화|발사|중단|비상|낙하산|사출|분리|이륙|오류)/;
      const eventKey = eventPattern.test(upper) ? upper : "";
      const now = Date.now();
      if(eventKey && eventKey !== cameraLastEventStateKey){
        latchCameraEventState(text);
      }else if(!eventKey){
        cameraLastEventStateKey = "";
      }
      if(cameraEventStateText && now < cameraEventStateUntil) return cameraEventStateText;
      cameraEventStateText = "";
      cameraEventStateUntil = 0;
      return "";
    }

    function syncCameraHud(values){
      const data = values || {};
      updateCameraStageSeparation(data);
      if(!el.cameraView || el.cameraView.classList.contains("hidden")) return;
      const setText = (node, value)=>{
        if(node) node.textContent = (value == null || value === "") ? "--" : String(value);
      };
      const setClassName = (node, cls)=>{
        if(node && node.className !== cls) node.className = cls;
      };
      const setGaugeBar = (node, value, max)=>{
        if(!node) return;
        const n = Number(value);
        const m = Number(max);
        const pct = (isFinite(n) && isFinite(m) && m > 0) ? Math.max(0, Math.min(1, n / m)) : 0;
        node.style.width = (pct * 100).toFixed(1) + "%";
      };
      const stateText = data.stateText ||
        (el.mobilePreviewState && el.mobilePreviewState.textContent) ||
        (el.statusPill && el.statusPill.textContent) ||
        "READY";
      const stateStatus = data.stateStatus || "ok";
      const cleanStateText = String(stateText || "READY").replace(/\s+/g, " ").trim() || "READY";
      const statusTone = (stateStatus === "bad" || stateStatus === "warn" || stateStatus === "ok") ? stateStatus : "ok";
      const linkOk = data.connected == null
        ? !!(connOk || wsConnected || serialConnected)
        : !!data.connected;
      const cameraMissionName = (
        (el.missionName && el.missionName.value) ||
        selectedMotorName ||
        DEFAULT_MISSION_NAME ||
        "SEQUENCE"
      ).trim() || "SEQUENCE";
      setText(el.cameraSequenceMissionName, cameraMissionName);
      if(el.cameraHudStageSource){
        const stageId = Number(data.stageId);
        const hasStage = stageId === 1 || stageId === 2;
        setText(
          el.cameraHudStageSource,
          hasStage
            ? ("STAGE " + stageId + " " + (linkOk ? "LINKED" : "OFFLINE"))
            : ""
        );
        el.cameraHudStageSource.classList.toggle("is-linked", hasStage && linkOk);
        el.cameraHudStageSource.classList.toggle("hidden", !hasStage);
      }
      setText(el.cameraHudState, cleanStateText);
      setText(el.cameraHudStatePillText, cleanStateText);
      if(el.cameraHudState){
        setClassName(el.cameraHudState, "camera-hud-state " + statusTone);
      }
      if(el.cameraControlMenuLayer && !el.cameraControlMenuLayer.classList.contains("hidden")){
        syncCameraControlMenu();
      }
      setClassName(el.cameraHudStatePill, "camera-mini-pill " + statusTone);
      setClassName(el.cameraHudLinkPill, "camera-mini-pill " + (linkOk ? "ok" : "bad"));
      const countdownText = data.countdown || (el.countdown && el.countdown.textContent) || "T- --:--";
      const countdownMatch = String(countdownText).match(/^(T[+-])\s*(.*)$/);
      const countdownBody = countdownMatch ? countdownMatch[2].trim() : String(countdownText).trim();
      const countdownParts = countdownBody.split(":");
      const compactCountdown = countdownParts.length >= 2
        ? countdownParts.slice(0, 2).join(":")
        : countdownBody;
      const cameraTplusActive = !!(countdownMatch && countdownMatch[1] === "T+");
      const separationCountdownRemainMs = cameraStageSeparationCountdownUntil - Date.now();
      const separationCountdownActive = separationCountdownRemainMs > 0;
      const manualSeparationActive = cameraStageSeparationManualAt > 0;
      const separationTestTplusActive = !separationCountdownActive &&
        cameraStageSeparationCountdownUntil > 0 &&
        (cameraStageSeparationTriggerAt > Date.now() || manualSeparationActive);
      const separationCountdownText = "00:" + String(Math.ceil(Math.max(0, separationCountdownRemainMs) / 1000)).padStart(2, "0");
      const separationTplusText = "00:" + String(Math.floor(Math.max(0, Date.now() - cameraStageSeparationCountdownUntil) / 1000)).padStart(2, "0");
      const sequenceTplusActive = !separationCountdownActive && (cameraTplusActive || separationTestTplusActive);
      const cameraFlightState = Number(data.st != null ? data.st : currentSt);
      const sequenceCountdownRunning = cameraFlightState === 1;
      const compactMinute = Number(countdownParts[0]);
      const compactSecond = Number(countdownParts[1]);
      const compactElapsedMs = Number.isFinite(compactMinute) && Number.isFinite(compactSecond)
        ? ((compactMinute * 60) + compactSecond) * 1000
        : Infinity;
      const telemetryElapsedMs = Number(data.td);
      const sequenceRemainingMs = data.td != null && Number.isFinite(telemetryElapsedMs)
        ? Math.abs(telemetryElapsedMs)
        : compactElapsedMs;
      const tminusInstrumentsReady = sequenceCountdownRunning && sequenceRemainingMs <= 3000;
      const testTminusInstrumentsReady = separationCountdownActive && separationCountdownRemainMs <= 3000;
      const preSequenceVisible = !sequenceCountdownRunning && !sequenceTplusActive && !separationCountdownActive;
      const flightInstrumentsVisible = preSequenceVisible || tminusInstrumentsReady ||
        testTminusInstrumentsReady || sequenceTplusActive || manualSeparationActive;
      setText(el.cameraHudTimerTag, separationCountdownActive ? "T-" : (sequenceTplusActive ? "T+" : (countdownMatch ? countdownMatch[1] : "T-")));
      setText(el.cameraHudCountdown, separationCountdownActive ? separationCountdownText : (separationTestTplusActive ? separationTplusText : compactCountdown));
      if(el.cameraSequenceDock) el.cameraSequenceDock.classList.toggle("is-tplus", sequenceTplusActive);
      if(el.cameraHudAttitudeGroup){
        el.cameraHudAttitudeGroup.classList.toggle("hidden", !flightInstrumentsVisible);
      }
      if(el.cameraHudFlightGauges){
        el.cameraHudFlightGauges.classList.toggle("hidden", !flightInstrumentsVisible);
      }
      const altitudeValue = Number(data.altitudeM);
      const gforceValue = Number(data.gforceG);
      const speedValue = Number(data.speedMps);
      setText(el.cameraHudSpeedGauge, isFinite(speedValue) ? Math.max(0, speedValue).toFixed(1) : "--");
      setText(el.cameraHudGforceGauge, isFinite(gforceValue) ? Math.max(0, gforceValue).toFixed(2) : "--");
      setText(el.cameraHudAltitudeGauge, isFinite(altitudeValue) ? altitudeValue.toFixed(1) : "--");
      setText(el.cameraChartAltitude, isFinite(altitudeValue) ? altitudeValue.toFixed(1) + "m" : "--");
      setText(el.cameraChartSpeed, isFinite(speedValue) ? Math.max(0, speedValue).toFixed(1) + "m/s" : "--");
      setText(el.cameraChartGforce, isFinite(gforceValue) ? Math.max(0, gforceValue).toFixed(2) : "--");
      setText(el.cameraHudArm, data.swOn == null ? "--" : (data.swOn ? "ON" : "OFF"));
      const telemetryIgnitionDelayMs = Number(data.ignitionDelayMs);
      const telemetryIgnitionDelayValid = Number(data.ignitionDelayValid) !== 0 &&
        isFinite(telemetryIgnitionDelayMs) && telemetryIgnitionDelayMs >= 0;
      const ignitionDelaySec = telemetryIgnitionDelayValid
        ? telemetryIgnitionDelayMs / 1000
        : Number(ignitionAnalysis && ignitionAnalysis.delaySec);
      setText(el.cameraHudIgnitionDelay, isFinite(ignitionDelaySec) ? ignitionDelaySec.toFixed(2) : "--");
      const pyroChannel = normalizePyroChannel(uiSettings && uiSettings.daqSequencePyroChannel, 1);
      setText(el.cameraHudPyro, "CH" + pyroChannel);
      const storagePercent = getSpiFlashUsedPercent(getActiveStoragePreviewInfo());
      setText(el.cameraHudStorage, isFinite(storagePercent) ? storagePercent.toFixed(1) + "%" : "--");
      const hudStageId = Number(data.stageId);
      const hudLinkPrefix = hudStageId === 1 || hudStageId === 2 ? ("STAGE " + hudStageId + " • ") : "";
      setText(el.cameraHudLink, hudLinkPrefix + (linkOk ? "LINK CONNECTED" : "LINK DISCONNECTED"));
      setGaugeBar(el.cameraHudSpeedProg, Math.max(0, speedValue), CAMERA_SPEED_GAUGE_MAX_MPS);
      setGaugeBar(el.cameraHudGforceProg, Math.max(0, gforceValue), CAMERA_G_FORCE_GAUGE_MAX);
      setGaugeBar(el.cameraHudAltitudeProg, Math.max(0, altitudeValue), CAMERA_ALT_GAUGE_MAX_M);
      drawCameraHudChart();
      if(el.cameraHudTimelineItems && el.cameraHudTimelineItems.length){
        const st = Number(data.st != null ? data.st : currentSt);
        const phaseRaw = data.flightPhaseCode != null
          ? data.flightPhaseCode
          : (data.flight_phase_code != null
            ? data.flight_phase_code
            : (latestTelemetry && latestTelemetry.flight_phase_code));
        const phaseCode = Number(phaseRaw);
        const deploymentStateRaw = data.deploymentState != null
          ? data.deploymentState
          : (data.deployment_state != null
            ? data.deployment_state
            : (latestTelemetry && latestTelemetry.deployment_state));
        const deploymentFlagsRaw = data.deploymentFlags != null
          ? data.deploymentFlags
          : (data.deployment_flags != null
            ? data.deployment_flags
            : (latestTelemetry && latestTelemetry.deployment_flags));
        const deploymentState = Number(deploymentStateRaw) || 0;
        const deploymentFlags = Number(deploymentFlagsRaw) || 0;
        const primaryServoFailed = (deploymentFlags & (1 << 3)) !== 0;
        const secondaryCommanded = (deploymentFlags & (1 << 5)) !== 0;
        const secondaryServoFailed = (deploymentFlags & (1 << 6)) !== 0;
        let activeIndex = 0;
        if(st === 1) activeIndex = 1;
        else if(st === 2) activeIndex = 2;
        else if(st === 3) activeIndex = 2;
        if(phaseCode === 1) activeIndex = 3;
        else if(phaseCode === 2) activeIndex = 4;
        else if(phaseCode === 3) activeIndex = 7;
        else if(phaseCode === 4) activeIndex = 8;
        if(!isFinite(phaseCode) || phaseCode < 3){
          if(secondaryCommanded && !secondaryServoFailed) activeIndex = 6;
          else if(deploymentState >= 2 && !primaryServoFailed) activeIndex = 5;
        }
        let timelineStage = activeIndex;
        let timelineProgress = 0;
        const td = Number(data.td);
        const countdownTotalMs = Math.max(3000, Math.min(60000, Number(data.countdownTotalMs) || ((uiSettings ? uiSettings.countdownSec : 10) * 1000)));
        if(st === 1 && isFinite(td)){
          const remainMs = Math.max(0, Math.abs(td));
          timelineStage = 1;
          timelineProgress = 1 - Math.min(1, remainMs / countdownTotalMs);
          activeIndex = 1;
        }
        el.cameraHudTimelineItems.forEach((item, idx)=>{
          item.classList.toggle("active", idx === activeIndex);
          item.classList.toggle("passed", idx < activeIndex);
        });
        if(el.cameraHudTimelineRail){
          const items = Array.from(el.cameraHudTimelineItems);
          const safeStage = Math.max(0, Math.min(items.length - 1, Math.floor(timelineStage)));
          const nextStage = Math.max(0, Math.min(items.length - 1, safeStage + 1));
          const progress = Math.max(0, Math.min(1, Number(timelineProgress) || 0));
          const currentItem = items[safeStage];
          const nextItem = items[nextStage] || currentItem;
          if(currentItem){
            const currentCenter = currentItem.offsetLeft + currentItem.offsetWidth / 2;
            const nextCenter = nextItem.offsetLeft + nextItem.offsetWidth / 2;
            const targetCenter = currentCenter + ((nextCenter - currentCenter) * progress);
            el.cameraHudTimelineRail.style.transform = "translateX(" + (-targetCenter).toFixed(1) + "px)";
          }
        }
      }
    }

    // =====================
    // 언어 (i18n)
    // =====================
    const I18N = (typeof window !== "undefined" && window.FLASH6_I18N) ? window.FLASH6_I18N : {ko:{}, en:{}};


    let currentLang = "ko";
    function t(key, vars){
      const dict = I18N[currentLang] || I18N.ko;
      let text = dict[key] || I18N.ko[key] || key;
      if(vars){
        text = text.replace(/\{(\w+)\}/g, (_, name)=>(
          (vars[name] !== undefined && vars[name] !== null) ? String(vars[name]) : ""
        ));
      }
      return text;
    }
    function setLanguage(lang){
      currentLang = (lang === "en") ? "en" : "ko";
      document.documentElement.lang = currentLang;
      updateStaticTexts();
      updateLoadcellCalibrationCapabilityUi();
      updateQuickMetricLabels();
      updateSerialControlTile();
      updateExportGuardUi();
      updateRebootConfirmUi();
      updateFlashLinkReportUi();
      if(uiSettings) syncCameraEnabledState();
      scheduleFlashLinkChartRender();
      if(wifiConnectStage !== "idle"){
        setWifiConnectWizardStage(wifiConnectStage);
      }
      if(isLoadcellModalVisible()){
        updateLoadcellWorkflowUi();
        if(loadcellWarningMode === "stability"){
          if(el.loadcellDialog) el.loadcellDialog.classList.add("show-warning");
          if(el.loadcellWarningTitle) el.loadcellWarningTitle.textContent = t("loadcellStabilityFailTitle");
          if(el.loadcellWarningText) el.loadcellWarningText.textContent = t("loadcellStabilityFailText");
          if(el.loadcellWarningSub) el.loadcellWarningSub.textContent = t("loadcellStabilityFailSub");
          setLoadcellActionLabel(el.loadcellWarningProceed, t("loadcellRetryBtn"));
          setLoadcellActionLabel(el.loadcellWarningCancel, t("loadcellModalCancel"));
        }
      }
    }
    function updateStaticTexts(){
      const nodes = document.querySelectorAll("[data-i18n],[data-i18n-html]");
      nodes.forEach(node=>{
        const htmlKey = node.getAttribute("data-i18n-html");
        const textKey = node.getAttribute("data-i18n");
        const key = htmlKey || textKey;
        if(!key) return;
        const value = t(key);
        if(value === key) return;
        if(htmlKey) node.innerHTML = value;
        else node.textContent = value;
      });
    }
    function getConnectTransportMode(){
      return serialEnabled ? "serial" : "wifi";
    }
    function updateConnectActionUi(){
      if(!el.connectActionBtn || !el.connectModeSelect) return;
      const mode = getConnectTransportMode();
      el.connectModeSelect.value = mode;

      if(simEnabled){
        el.connectActionBtn.textContent = "OPEN";
        el.connectActionBtn.classList.add("is-on");
        el.connectActionBtn.classList.remove("is-off");
        return;
      }

      if(mode === "serial"){
        if(serialConnected){
          el.connectActionBtn.textContent = t("serialConnected");
          el.connectActionBtn.classList.add("is-on");
          el.connectActionBtn.classList.remove("is-off");
        }else{
          el.connectActionBtn.textContent = t("connectActionConnect");
          el.connectActionBtn.classList.add("is-off");
          el.connectActionBtn.classList.remove("is-on");
        }
      }else{
        el.connectActionBtn.textContent = t("connectActionConnect");
        el.connectActionBtn.classList.add("is-off");
        el.connectActionBtn.classList.remove("is-on");
      }
    }
    function updateSerialControlTile(){
      if(!el.serialControlTitle || !el.serialControlSub || !el.serialControlTile) return;
      if(simEnabled){
        el.serialControlTitle.textContent = t("controlDevToolsLabel");
        el.serialControlSub.textContent = t("controlDevToolsSub");
        if(el.connectModeSelect) el.connectModeSelect.style.display = "none";
        if(el.connectActionBtn) el.connectActionBtn.style.display = "inline-flex";
      }else{
        el.serialControlTitle.textContent = t("controlSerialLabel");
        const mode = getConnectTransportMode();
        el.serialControlSub.textContent = (mode === "serial")
          ? (serialConnected ? t("serialConnected") : t("serialDisconnected"))
          : t("controlSerialSub");
        if(el.connectModeSelect) el.connectModeSelect.style.display = "inline-flex";
        if(el.connectActionBtn) el.connectActionBtn.style.display = "inline-flex";
      }
      updateConnectActionUi();
    }
    function setDevToolsVisible(show){
      if(!el.controlsCard || !el.controlsMain || !el.devToolsPanel || !el.controlsHeader) return;
      el.controlsCard.classList.toggle("devtools-mode", !!show);
      el.controlsHeader.classList.toggle("hidden", !!show);
      if(el.controlsCardTitle){
        el.controlsCardTitle.textContent = show ? "DEV TOOLS" : getControlsPanelTitle();
      }
      if(show && isTabletControlsLayout() && !tabletControlsOpen){
        tabletControlsOpen = true;
        applyTabletControlsLayout();
      }
      setTimeout(()=>{
        refreshChartLayout();
        redrawCharts();
      }, 0);
    }
    function updateDevToolsUI(){
      const any = devRelay1Locked || devRelay2Locked;
      const hasRelays = !!(el.devRelay1Btn && el.devRelay2Btn);
      if(hasRelays){
        el.devRelay1Btn.classList.toggle("is-on", devRelay1Locked);
        el.devRelay2Btn.classList.toggle("is-on", devRelay2Locked);
        el.devRelay1Btn.classList.toggle("is-warning", any);
        el.devRelay2Btn.classList.toggle("is-warning", any);
      }
      if(el.devWsOffBtn){
        el.devWsOffBtn.classList.toggle("is-on", devWsOff);
        el.devWsOffBtn.classList.toggle("is-warning", devWsOff);
      }
      if(el.devLoadcellErrBtn){
        el.devLoadcellErrBtn.classList.toggle("is-on", devLoadcellError);
        el.devLoadcellErrBtn.classList.toggle("is-warning", devLoadcellError);
      }
      if(el.devParachuteBtn){
        el.devParachuteBtn.classList.toggle("is-on", devParachuteDrop);
        el.devParachuteBtn.classList.toggle("is-warning", devParachuteDrop);
      }
      if(simEnabled){
        lockoutLatched = devRelay1Locked || devRelay2Locked;
        lockoutRelayMask = (devRelay1Locked ? 1 : 0) | (devRelay2Locked ? 2 : 0);
        setLockoutVisual(lockoutLatched);
        updateRelaySafePill();
        setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
        if(lockoutLatched){
          resetSimState();
          resetGyroPathTracking();
        }
        if(any) showLockoutModal();
        else if(lockoutModalShown) hideLockoutModal();
      }
      updateWsAlert();
    }

    function convertThrustForDisplay(t){
      if(!uiSettings) return t;
      return (uiSettings.thrustUnit==="N") ? (t*9.80665) : t;
    }

    function formatThrustDisplay(value){
      return formatFixedDisplay(value, getQuickDataDigits(), "--");
    }

    function formatQuickPressureDisplay(value){
      return formatFixedDisplay(value, getQuickDataDigits(), "--");
    }

    function formatQuickTimeDisplay(value){
      return formatFixedDisplay(value, getQuickDataDigits(), buildDecimalPlaceholder(getQuickDataDigits()));
    }

    function pressureVoltToMpa(value){
      const volt = Number(value);
      if(!isFinite(volt)) return NaN;
      const fullScaleVolt = PRESSURE_LEGACY_VOLT_FULL_SCALE;
      if(!(fullScaleVolt > 0)) return NaN;
      const clampedVolt = Math.max(0, Math.min(fullScaleVolt, volt));
      return (clampedVolt / fullScaleVolt) * PRESSURE_GAUGE_MAX_MPA;
    }

    function parsePressureMpa(data){
      const src = data || {};
      if(!isFlightModeUi()){
        const daqMpaCandidates = [src.dp, src.daq_pressure_mpa, src.motor_pressure_mpa, src.pressure_daq_mpa];
        for(const raw of daqMpaCandidates){
          const mpa = Number(raw);
          if(isFinite(mpa)) return mpa;
        }
      }
      const fromMpa = [src.p_mpa, src.pressure_mpa];
      for(const raw of fromMpa){
        const mpa = Number(raw);
        if(isFinite(mpa)) return mpa;
      }

      const fromVolt = [src.p_v, src.pressure_v, src.pv, src.pressureV, src.pressureVolt];
      for(const raw of fromVolt){
        const mpa = pressureVoltToMpa(raw);
        if(isFinite(mpa)) return mpa;
      }

      const pressureUnitRaw = (src.p_unit != null) ? src.p_unit : src.pressure_unit;
      const pressureUnit = String(pressureUnitRaw == null ? "" : pressureUnitRaw).trim().toLowerCase();
      const rawPressure = Number(src.p != null ? src.p : src.pressure);
      if(!isFinite(rawPressure)) return 0;
      if(pressureUnit === "v" || pressureUnit === "volt" || pressureUnit === "voltage"){
        const mpa = pressureVoltToMpa(rawPressure);
        if(isFinite(mpa)) return mpa;
      }
      return rawPressure;
    }

    function normalizeAbsolutePressureMpa(rawPressure){
      const p = Number(rawPressure);
      if(!isFinite(p) || p <= 0) return NaN;
      if(p > 0.03 && p < 0.2) return p;             // MPa
      if(p > 50 && p < 200) return p / 1000;        // kPa -> MPa
      if(p > 50000 && p < 200000) return p / 1000000; // Pa -> MPa
      if(p > 0.5 && p < 2.0) return p * 0.1;        // bar -> MPa
      return NaN;
    }

    function parseBaroPressureMpa(data){
      const src = data || {};
      const pressureUnitRaw = (src.p_unit != null) ? src.p_unit : src.pressure_unit;
      const pressureUnit = String(pressureUnitRaw == null ? "" : pressureUnitRaw).trim().toLowerCase();
      if(pressureUnit === "v" || pressureUnit === "volt" || pressureUnit === "voltage"){
        return NaN;
      }
      const candidates = [
        src.p_mpa, src.baro_pressure_mpa, src.pressure_baro_mpa,
        src.p, src.pressure, src.baro_pressure, src.air_pressure
      ];
      for(const raw of candidates){
        const mpa = normalizeAbsolutePressureMpa(raw);
        if(isFinite(mpa)) return mpa;
      }
      return NaN;
    }

    function applySettingsToUI(){
      if(!uiSettings) return;
      const thrustLabel = document.querySelector('[data-label="thrust-unit"]');
      const thrustBadge = document.querySelector('[data-badge="thrust-unit"]');
      const pressureBadge = document.querySelector('[data-badge="pressure-unit"]');

      if(thrustLabel) thrustLabel.textContent = uiSettings.thrustUnit;
      if(thrustBadge) thrustBadge.textContent = "RED · " + uiSettings.thrustUnit;
      if(pressureBadge) pressureBadge.textContent = "BLUE · MPa";

      if(el.unitThrust) el.unitThrust.value = uiSettings.thrustUnit;
      if(el.quickDataDigitsSelect) el.quickDataDigitsSelect.value = String(getQuickDataDigits());
      if(el.loadcellChartDigitsSelect) el.loadcellChartDigitsSelect.value = String(getLoadcellChartDigits());
      if(el.storageExportDigitsSelect) el.storageExportDigitsSelect.value = String(getStorageExportDigits());
      if(el.cameraEnabledToggle) el.cameraEnabledToggle.checked = isCameraUseEnabled();
      if(el.ignTimeInput) el.ignTimeInput.value = uiSettings.ignDurationMs;
      if(el.hardwarePyroDurationInput){
        const ignMs = Math.max(10, Math.min(30000, Math.round(Number(uiSettings.ignDurationMs || 1000))));
        el.hardwarePyroDurationInput.value = String(ignMs);
      }
      if(el.countdownSecInput) el.countdownSecInput.value = uiSettings.countdownSec;
      if(el.daqSequencePyroSelect) el.daqSequencePyroSelect.value = String(normalizePyroChannel(uiSettings.daqSequencePyroChannel, 1));
      if(el.opModeSelect) el.opModeSelect.value = uiSettings.opMode || "daq";
      const flashLinkEnabled = getSettingsOperationModeValue() === "flash_link";
      if(el.opModeSelect){
        el.opModeSelect.disabled = operationModeChangeBusy;
        el.opModeSelect.title = operationModeChangeBusy ? "보드 모드 적용 중" : "";
      }
      if(el.flashLinkEnabledPill){
        el.flashLinkEnabledPill.textContent = flashLinkEnabled ? "ON" : "OFF";
        el.flashLinkEnabledPill.classList.toggle("is-on", flashLinkEnabled);
        el.flashLinkEnabledPill.classList.toggle("is-off", !flashLinkEnabled);
        el.flashLinkEnabledPill.disabled = operationModeChangeBusy;
        el.flashLinkEnabledPill.setAttribute("aria-busy", operationModeChangeBusy ? "true" : "false");
      }
      const stage2ModeEnabled = uiSettings.flashLinkStage2Mode === true;
      if(el.flashLinkStage2ModePill){
        el.flashLinkStage2ModePill.textContent = stage2ModeEnabled ? "ON" : "OFF";
        el.flashLinkStage2ModePill.classList.toggle("is-on", stage2ModeEnabled);
        el.flashLinkStage2ModePill.classList.toggle("is-off", !stage2ModeEnabled);
        el.flashLinkStage2ModePill.disabled = operationModeChangeBusy || !flashLinkEnabled;
      }
      if(el.flashLinkStatusHint){
        el.flashLinkStatusHint.textContent = currentLang === "ko"
          ? (stage2ModeEnabled
              ? "채널 6 · 1M_L · 2단 운용 50Hz"
              : "채널 6 · 1M_L · 1단 전용 100Hz")
          : (stage2ModeEnabled
              ? "Channel 6 · 1M_L · dual-stage 50Hz"
              : "Channel 6 · 1M_L · stage-1-only 100Hz");
      }
      if(el.flashLinkStageStatus){
        const stage2Status = el.flashLinkStageStatus.querySelector('[data-stage-link="2"]');
        if(stage2Status){
          if(!stage2ModeEnabled){
            stage2Status.classList.remove("is-linked");
            stage2Status.textContent = currentLang === "ko" ? "2단 사용 안 함" : "S2 DISABLED";
          }else if(/DISABLED|사용 안 함/.test(stage2Status.textContent || "")){
            stage2Status.textContent = currentLang === "ko" ? "2단 --" : "S2 --";
          }
        }
      }
      if(el.flashLinkRoleSelect) el.flashLinkRoleSelect.value = normalizeFlashLinkRole(uiSettings.flashLinkRole);
      if(el.flashLinkNodeSelect) el.flashLinkNodeSelect.value = String(normalizeFlashLinkNodeId(uiSettings.flashLinkNodeId));
      if(el.flashLinkDataModeSelect) el.flashLinkDataModeSelect.value = normalizeDataModeValue(uiSettings.flashLinkDataMode, "flight");
      {
        const role = normalizeFlashLinkRole(uiSettings.flashLinkRole);
        const dataModeDisabled = !flashLinkEnabled || role !== "avionics";
        if(el.flashLinkRoleSelect) el.flashLinkRoleSelect.disabled = operationModeChangeBusy || !flashLinkEnabled;
        if(el.flashLinkNodeRow) el.flashLinkNodeRow.hidden = role !== "avionics";
        if(el.flashLinkTargetRow) el.flashLinkTargetRow.hidden = role !== "ground";
        if(el.flashLinkNodeSelect) el.flashLinkNodeSelect.disabled = operationModeChangeBusy || !flashLinkEnabled || role !== "avionics";
        if(el.flashLinkNodeSelect){
          const stage2Option = el.flashLinkNodeSelect.querySelector('option[value="2"]');
          if(stage2Option) stage2Option.disabled = !stage2ModeEnabled;
        }
        if(el.flashLinkDataModeSelect) el.flashLinkDataModeSelect.disabled = operationModeChangeBusy || dataModeDisabled;
        if(el.flashLinkDataModeRow) el.flashLinkDataModeRow.classList.toggle("is-disabled", !flashLinkEnabled || dataModeDisabled);
        if(el.flashLinkStatus) el.flashLinkStatus.classList.toggle("is-disabled", !flashLinkEnabled);
        const group = el.flashLinkEnabledPill ? el.flashLinkEnabledPill.closest(".flash-link-settings-group") : null;
        if(group) group.classList.toggle("is-ail-off", !flashLinkEnabled);
      }
      syncSettingsCommunicationOnlyUi();
      const previewMode = getGyroPreviewMode();
      if(el.gyroPreviewSelect) el.gyroPreviewSelect.value = previewMode;
      if(el.mobileHudPreviewToggle) el.mobileHudPreviewToggle.checked = !!uiSettings.mobileHudPreview;
      if(el.mobileFullscreenToggle) el.mobileFullscreenToggle.checked = !!uiSettings.mobileImmersive;
      syncCameraEnabledState();
      if(isSettingsCommunicationOnlyMode() && !flashLinkUiRemoteValid && !simEnabled && !replaySourceActive){
        applyFlashLinkGroundWaitingUi(false);
      }

      if(el.relaySafeToggle) el.relaySafeToggle.checked = !!uiSettings.relaySafe;
      if(el.refreshGuardToggle) el.refreshGuardToggle.checked = uiSettings.refreshGuard !== false;
      if(el.safeModeToggle){
        el.safeModeToggle.checked = !!uiSettings.safetyMode;
        updateTogglePill(el.safeModePill, el.safeModeToggle.checked);
      }
      if(el.armLockToggle){
        el.armLockToggle.checked = !!uiSettings.armLock;
        updateTogglePill(el.armLockPill, el.armLockToggle.checked);
        updateMobileArmLockWideButton();
      }
      if(el.igswitch) el.igswitch.checked = !!uiSettings.igs;

      if(el.serialToggle){
        el.serialToggle.checked = !!uiSettings.serialEnabled;
      }
      if(el.serialRxToggle) el.serialRxToggle.checked = uiSettings.serialRx !== false;
      if(el.serialTxToggle) el.serialTxToggle.checked = uiSettings.serialTx !== false;
      if(el.muteModeToggle) el.muteModeToggle.checked = !!uiSettings.muteMode;
      if(el.langSelect) el.langSelect.value = (uiSettings.lang === "en") ? "en" : "ko";
      if(el.themeToggle) el.themeToggle.checked = (uiSettings.theme === "dark");
      const displayMode = getDisplayOperationModeValue();
      document.documentElement.classList.toggle("mode-flight", displayMode === "flight");
      document.documentElement.classList.toggle("mode-flash-link", displayMode === "flash_link");
      document.documentElement.classList.toggle("mode-daq", displayMode !== "flight" && displayMode !== "flash_link");
      document.documentElement.classList.toggle("link-flash-link", getSettingsOperationModeValue() === "flash_link");
      document.documentElement.classList.toggle("preview-3d", previewMode !== "navball");
      document.documentElement.classList.toggle("preview-navball", previewMode === "navball");
      document.documentElement.classList.toggle("preview-3d-plus", previewMode === "3d");
      if(displayMode !== "flight"){
        resetQuickFlightMetricsState();
      }
      if((displayMode !== "flight" || previewMode === "navball") && isGyroViewportExpanded()){
        setGyroViewportExpanded(false);
      }

      updateRelaySafePill();
      updateSerialPill();
      updateStaticTexts();
      updateQuickMetricLabels();
      updateQuickAuxLabels();
      updateControlsToolbarLabels();
      updateSerialControlTile();
      updateExportGuardUi();
      updateMissionEditLockUI();
      refreshStatusMapMarkerContent();
      refreshStatusMapSize();
      syncControlsPanelTitle();
      applyPhoneLandscapeLayout();
    }
    function updateControlsToolbarLabels(){
      if(el.missionOpenBtn){
        el.missionOpenBtn.setAttribute("title", t("missionToolbarBtn"));
        el.missionOpenBtn.setAttribute("aria-label", t("missionToolbarBtn"));
      }
      if(el.mobileMissionWideBtn){
        el.mobileMissionWideBtn.setAttribute("aria-label", t("missionToolbarBtn"));
      }
      if(el.gyroZeroBtn){
        el.gyroZeroBtn.setAttribute("title", t("gyroZeroBtn"));
        el.gyroZeroBtn.setAttribute("aria-label", t("gyroZeroBtn"));
      }
      if(el.exportCsvBtn){
        el.exportCsvBtn.setAttribute("title", t("exportXlsx"));
        el.exportCsvBtn.setAttribute("aria-label", t("exportXlsx"));
      }
      if(el.exportDocxBtn){
        el.exportDocxBtn.setAttribute("title", "Word 보고서 내보내기");
        el.exportDocxBtn.setAttribute("aria-label", "Word 보고서 내보내기");
      }
      if(el.rebootBoardBtn){
        el.rebootBoardBtn.setAttribute("title", t("controlRebootBtn"));
        el.rebootBoardBtn.setAttribute("aria-label", t("controlRebootBtn"));
      }
    }
    function refreshPrecisionSensitiveUi(){
      updateMotorInfoPanel();
      if(!isFlightModeUi()){
        if(el.thrust){
          const metric = el.thrust.closest(".status-metric");
          if(loadcellErrorActive){
            el.thrust.innerHTML = "로드셀 시스템을<br>점검하세요";
            if(metric) metric.classList.add("is-alert");
            if(metric) metric.classList.toggle("loadcell-blink", loadcellErrorActive);
          }else if(isFinite(Number(lastThrustKgf))){
            const thrustDisp = convertThrustForDisplay(Number(lastThrustKgf));
            const thrustUnit = (uiSettings && uiSettings.thrustUnit) ? uiSettings.thrustUnit : "kgf";
            if(metric){
              metric.classList.remove("is-alert");
              metric.classList.remove("loadcell-blink");
            }
            el.thrust.innerHTML = `<span class="num">${formatThrustDisplay(thrustDisp)}</span><span class="unit">${thrustUnit}</span>`;
          }
        }
        if(el.pressure){
          const latestSample = (sampleHistory && sampleHistory.length) ? sampleHistory[sampleHistory.length - 1] : null;
          const pressureVal = latestSample ? Number(latestSample.p) : NaN;
          if(isFinite(pressureVal)){
            el.pressure.innerHTML = `<span class="num">${formatQuickPressureDisplay(pressureVal)}</span><span class="unit">MPa</span>`;
          }
        }
      }
      if(el.loadcellLiveValue && isFinite(Number(lastThrustKgf))){
        el.loadcellLiveValue.textContent = formatThrustDisplay(lastThrustKgf);
      }
      syncExpandedQuickMetrics();
    }
    const delay = (ms)=>new Promise(resolve=>setTimeout(resolve, ms));
    function setOverlayVisible(node, visible, displayMode){
      if(!node) return;
      if(visible){
        node.classList.remove("hidden");
        node.style.display = displayMode || "flex";
        node.style.pointerEvents = "";
        node.setAttribute("aria-hidden", "false");
      }else{
        node.classList.add("hidden");
        node.style.display = "none";
        node.style.pointerEvents = "none";
        node.setAttribute("aria-hidden", "true");
      }
    }
    function isDesktopWelcomeLayout(){
      return !isMobileLayout();
    }
    function isGroundStationTransportConnected(){
      return !!(connOk || wsConnected || serialConnected);
    }
    function markWelcomeConnectionReady(){
      welcomeConnectCompleted = true;
      welcomeConnectionVerifiedAtMs = Date.now();
    }
    function clearWelcomeConnectionReady(){
      welcomeConnectCompleted = false;
      welcomeConnectionVerifiedAtMs = 0;
    }
    function isWelcomeConnectionReady(){
      const probeFresh = welcomeConnectCompleted &&
        welcomeConnectionVerifiedAtMs > 0 &&
        (Date.now() - welcomeConnectionVerifiedAtMs) < 30000;
      return !!(isGroundStationTransportConnected() || probeFresh);
    }
    function syncWelcomePrimaryAction(busyLabel){
      if(!el.welcomeBoardSearchBtn || !el.welcomeBoardSearchLabel) return;
      const ready = isWelcomeConnectionReady();
      el.welcomeBoardSearchBtn.classList.toggle("is-ready", ready);
      el.welcomeBoardSearchBtn.setAttribute("data-welcome-action", ready ? "enter" : "connect");
      if(welcomeBoardSearchBusy){
        el.welcomeBoardSearchLabel.textContent = busyLabel || "연결 확인중";
      }else{
        el.welcomeBoardSearchLabel.textContent = ready ? "시작하기" : "보드 연결";
      }
    }
    function syncWelcomeConnectCopy(){
      if(el.welcomeConnectHelp){
        el.welcomeConnectHelp.textContent = "탐색 순서: Wi-Fi 자동 확인 → 허용된 USB 포트 → USB 목록 표시 · SSID: ALTIS_FLASH6_XXXXXX · PW: 12345678";
      }
      syncWelcomePrimaryAction();
      if(el.welcomeReplayBtn){
        const label = "리플레이";
        const textNodes = Array.from(el.welcomeReplayBtn.childNodes).filter(node=>node.nodeType === 3);
        if(textNodes.length){
          textNodes[textNodes.length - 1].nodeValue = " " + label;
        }else{
          el.welcomeReplayBtn.appendChild(document.createTextNode(" " + label));
        }
        el.welcomeReplayBtn.setAttribute("aria-label", label);
      }
    }
    function setWelcomeConnectStatus(stage, text){
      if(!el.welcomeConnectScreen) return;
      const mode = String(stage || "idle");
      el.welcomeConnectScreen.classList.toggle("is-connecting", mode === "connecting");
      el.welcomeConnectScreen.classList.toggle("is-connected", mode === "connected");
      if(el.welcomeConnectStatus){
        el.welcomeConnectStatus.textContent = text || (
          mode === "connected" ? "연결 완료" :
          mode === "connecting" ? "연결 확인중" :
          "연결 대기중"
        );
      }
      syncWelcomePrimaryAction();
    }
    function setWelcomeConnectVisible(visible){
      if(!el.welcomeConnectScreen) return;
      if(visible){
        el.welcomeConnectScreen.classList.remove("hidden");
        el.welcomeConnectScreen.style.display = "";
        el.welcomeConnectScreen.setAttribute("aria-hidden", "false");
        document.body.classList.add("welcome-connect-active");
      }else{
        el.welcomeConnectScreen.classList.add("hidden");
        el.welcomeConnectScreen.style.display = "none";
        el.welcomeConnectScreen.setAttribute("aria-hidden", "true");
        document.body.classList.remove("welcome-connect-active");
      }
    }
    function syncWelcomeConnectScreen(connected){
      if(!el.welcomeConnectScreen) return;
      if(simEnabled || replayUiActive || replaySourceActive){
        setWelcomeConnectVisible(false);
        if(isMobileLayout()) hideDisconnectOverlay();
        return;
      }
      if(isMobileLayout()){
        setWelcomeConnectVisible(false);
        syncMobileGroundStationWaitOverlay();
        return;
      }
      if(welcomeDashboardEntered){
        setWelcomeConnectVisible(false);
        return;
      }
      const groundConnected = isGroundStationTransportConnected();
      syncWelcomeConnectCopy();
      setWelcomeConnectVisible(true);
      if(groundConnected || connected){
        markWelcomeConnectionReady();
        setWelcomeConnectStatus("connected", groundConnected ? "지상국 연결 완료" : "연결 완료");
        return;
      }
      if(isWelcomeConnectionReady()){
        setWelcomeConnectStatus("connected", "연결 완료");
        return;
      }
      if(!isDesktopWelcomeLayout()){
        setWelcomeConnectVisible(false);
        return;
      }
      setWelcomeConnectVisible(true);
      if(wifiConnectStage === "waiting" || serialConnectStage === "waiting" || serialConnectBusy){
        setWelcomeConnectStatus("connecting", "연결 확인중");
      }else{
        clearWelcomeConnectionReady();
        setWelcomeConnectStatus("idle", "연결 대기중");
      }
    }
    async function startWelcomeUsbConnect(){
      welcomeConnectAttempted = true;
      setWelcomeConnectStatus("connecting", "USB 연결 준비중");
      await setConnectTransportMode("serial", {toast:false});
      await serialConnect();
      updateSerialControlTile();
      updateSerialPill();
      if(serialConnected){
        markWelcomeConnectionReady();
        setWelcomeConnectStatus("connected", "USB 연결 완료");
        syncWelcomeConnectScreen(true);
      }else{
        setWelcomeConnectStatus("idle", "USB 연결 실패");
      }
    }
    async function startWelcomeWifiConnect(){
      welcomeConnectAttempted = true;
      setWelcomeConnectStatus("connecting", "Wi-Fi 보드 확인중");
      await setConnectTransportMode("wifi", {toast:false});
      startWifiConnectWait();
    }
    function setWelcomeBoardSearchBusy(busy, label){
      welcomeBoardSearchBusy = !!busy;
      if(el.welcomeBoardSearchBtn){
        el.welcomeBoardSearchBtn.disabled = welcomeBoardSearchBusy;
        el.welcomeBoardSearchBtn.setAttribute("aria-busy", welcomeBoardSearchBusy ? "true" : "false");
      }
      syncWelcomePrimaryAction(label);
    }
    function enterWelcomeDashboard(){
      if(!isWelcomeConnectionReady()) return false;
      welcomeConnectAttempted = true;
      welcomeDashboardEntered = true;
      setWelcomeConnectStatus("connected", "연결 완료");
      setWelcomeConnectVisible(false);
      requestAnimationFrame(()=>{
        try{ window.dispatchEvent(new Event("resize")); }catch(_e){}
      });
      showToast("FLASH6 시작", "success", {key:"welcome-enter"});
      return true;
    }
    async function handleWelcomePrimaryAction(){
      if(isWelcomeConnectionReady()){
        enterWelcomeDashboard();
        return;
      }
      await startWelcomeBoardSearch();
    }
    async function startWelcomeBoardSearch(){
      if(welcomeBoardSearchBusy) return;
      welcomeConnectAttempted = true;
      setWelcomeBoardSearchBusy(true, "연결 확인중");
      setWelcomeConnectStatus("connecting", "Wi-Fi 보드 확인중");
      try{
        if(connOk || wsConnected){
          await setConnectTransportMode("wifi", {toast:false});
          if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("welcome board search wifi");
          markWelcomeConnectionReady();
          setWelcomeConnectStatus("connected", "Wi-Fi 연결 완료");
          syncWelcomeConnectScreen(true);
          showToast("Wi-Fi 연결 감지됨", "success", {key:"welcome-board-search"});
          return;
        }
        await setConnectTransportMode("wifi", {toast:false});
        try{
          const ok = await probeWelcomeWifiBoardReachable();
          if(ok){
            if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("welcome board search wifi");
            markWelcomeConnectionReady();
            setWelcomeConnectStatus("connected", "Wi-Fi 연결 완료");
            syncWelcomeConnectScreen(true);
            showToast("Wi-Fi 연결 감지됨", "success", {key:"welcome-board-search"});
            return;
          }
        }catch(e){
          addLogLine("Welcome Wi-Fi probe failed: " + normalizeNetError(e, "failed"), "NET");
        }

        setWelcomeBoardSearchBusy(true, "USB 확인중");
        setWelcomeConnectStatus("connecting", "USB 시리얼 확인중");
        const grantedPort = await getPreviouslyGrantedSerialPort();
        await setConnectTransportMode("serial", {toast:false});
        if(!grantedPort){
          openSerialConnectWizard();
          setWelcomeConnectStatus("idle", "USB 보드를 선택하세요");
          showToast("USB 보드를 선택한 뒤 연결을 눌러주세요.", "notice", {key:"welcome-usb-permission"});
          return;
        }
        await serialConnect({preferGranted:true, grantedOnly:true, port:grantedPort});
        updateSerialControlTile();
        updateSerialPill();
        if(serialConnected){
          markWelcomeConnectionReady();
          setWelcomeConnectStatus("connected", "USB 연결 완료");
          syncWelcomeConnectScreen(true);
          showToast("USB 시리얼 연결 완료", "success", {key:"welcome-board-search"});
          return;
        }
        setWelcomeConnectStatus("idle", "보드를 찾지 못했습니다");
        showToast("보드를 찾지 못했습니다. Wi-Fi 또는 USB 연결을 확인하세요.", "error", {key:"welcome-board-search"});
      }finally{
        setWelcomeBoardSearchBusy(false);
      }
    }
    function startWelcomeSimulation(){
      welcomeConnectAttempted = true;
      markWelcomeConnectionReady();
      setWelcomeConnectStatus("connected", "시뮬레이션 시작");
      setSimEnabled(true);
      setWelcomeConnectVisible(false);
      showToast(t("simEnabledToast"), "info", {key:"sim-toggle"});
    }
    function startWelcomeReplay(){
      showReplayDataPicker();
    }
    function ensureHardwareServoChannelUi(){
      const grid = document.querySelector(".hardware-servo-inline-wrap .hardware-servo-grid");
      if(!grid || grid.querySelector('.hardware-servo-row[data-servo-channel="5"]')) return;
      const source = grid.querySelector('.hardware-servo-row[data-servo-channel="4"]');
      if(!source) return;
      const row = source.cloneNode(true);
      row.classList.remove("is-active");
      row.style.display = "none";
      row.setAttribute("data-servo-channel", "5");
      row.querySelectorAll("[data-servo-channel-label]").forEach(node=>{ node.textContent = "PWM5"; });
      row.querySelectorAll("[aria-label]").forEach(node=>{
        const label = node.getAttribute("aria-label") || "";
        if(label.indexOf("PWM4") >= 0) node.setAttribute("aria-label", label.replace(/PWM4/g, "PWM5"));
      });
      const angle = row.querySelector("[data-servo-current-angle]");
      if(angle) angle.textContent = "90°";
      const pin = row.querySelector("[data-servo-pin]");
      if(pin) pin.textContent = "-";
      const value = row.querySelector("[data-servo-value]");
      if(value) value.textContent = "90°";
      const range = row.querySelector("[data-servo-range]");
      if(range) range.value = "90";
      row.querySelectorAll("[data-servo-preset-input]").forEach(input=>{
        input.value = input.getAttribute("value") || input.value || "90";
      });
      grid.appendChild(row);
    }

    // =====================
    // LOCKOUT helpers
    // =====================
    function relayMaskName(mask){
      if(mask===1) return "RLY1";
      if(mask===2) return "RLY2";
      if(mask===3) return "RLY1+RLY2";
      return "RLY?";
    }
    function setLockoutVisual(on){
      if(el.lockoutBg){
        el.lockoutBg.classList.remove("active");
      }
      const inFlightMode = isFlightModeUi();
      const mask = on ? (lockoutRelayMask || 0) : 0;
      const blinkAll = on && mask === 0;
      const r1Blink = on && (blinkAll || ((mask & 1) !== 0));
      const r2Blink = on && (blinkAll || ((mask & 2) !== 0));
      if(el.quickRelay1){
        const item = el.quickRelay1.closest(".item");
        if(item) item.classList.toggle("relay-lockout", !!r1Blink);
      }
      if(el.quickRelay2){
        const item = el.quickRelay2.closest(".item");
        if(item) item.classList.toggle("relay-lockout", !inFlightMode && !!r2Blink);
      }
    }

    function lockoutImgSrc(mask){
      if(mask===1) return "img/Danger.svg";
      if(mask===2) return "img/Activity.svg";
      if(mask===3) return "img/Graph.svg";
      return "img/Danger.svg";
    }
    function showLockoutModal(){
      hideMobileControlsPanel();
      if(!el.lockoutOverlay) return;

      const name = relayMaskName(lockoutRelayMask);
      const img = lockoutImgSrc(lockoutRelayMask);

      if(el.lockoutImg) el.lockoutImg.src = img;
      if(el.lockoutTitle) el.lockoutTitle.textContent = t("lockoutModalTitle", {name});
      if(el.lockoutText){
        el.lockoutText.textContent = t("lockoutModalText", {name});
      }
      if(el.lockoutNote){
        el.lockoutNote.textContent = t("lockoutModalNote");
      }

      setOverlayVisible(el.lockoutOverlay, true);
      lockoutModalShown = true;
    }
    function hideLockoutModal(){
      setOverlayVisible(el.lockoutOverlay, false);
      lockoutModalShown = false;
    }

    function hideWsAlert(){
      setOverlayVisible(el.wsAlertOverlay, false);
    }
    function showGroundStationWaitingOverlay(){
      hideMobileControlsPanel();
      if(!el.disconnectOverlay) return;
      el.disconnectOverlay.classList.add("is-ground-waiting");
      if(el.disconnectTitle) el.disconnectTitle.textContent = "지상국 연결 대기 중";
      if(el.disconnectText) el.disconnectText.textContent = "Wi-Fi 또는 USB 연결을 자동으로 확인하고 있습니다.";
      setOverlayVisible(el.disconnectOverlay, true);
    }
    function isVisibleOverlay(node){
      return !!(
        node &&
        !node.classList.contains("hidden") &&
        node.style.display !== "none"
      );
    }
    function setConnectionGuideTab(tab){
      connectionGuideTab = tab === "serial" ? "serial" : "wifi";
      if(el.connectionGuideTabs){
        el.connectionGuideTabs.forEach((button)=>{
          const active = button.getAttribute("data-connection-guide-tab") === connectionGuideTab;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-selected", active ? "true" : "false");
        });
      }
      if(el.connectionGuidePanels){
        el.connectionGuidePanels.forEach((panel)=>{
          const active = panel.getAttribute("data-connection-guide-panel") === connectionGuideTab;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });
      }
      if(el.connectionGuideActionBtn){
        el.connectionGuideActionBtn.textContent = connectionGuideTab === "serial"
          ? "수동 시리얼 연결"
          : "수동 Wi-Fi 연결";
      }
    }
    function openConnectionGuide(tab){
      if(!el.connectionGuideOverlay) return;
      hideDisconnectOverlay();
      setConnectionGuideTab(tab || connectionGuideTab);
      setOverlayVisible(el.connectionGuideOverlay, true);
      el.connectionGuideOverlay.setAttribute("aria-hidden", "false");
    }
    function closeConnectionGuide(resumeWaiting){
      if(!el.connectionGuideOverlay) return;
      setOverlayVisible(el.connectionGuideOverlay, false);
      el.connectionGuideOverlay.setAttribute("aria-hidden", "true");
      if(resumeWaiting !== false) syncMobileGroundStationWaitOverlay();
    }
    function syncMobileGroundStationWaitOverlay(){
      if(!el.disconnectOverlay) return;
      const waitingVisible = el.disconnectOverlay.classList.contains("is-ground-waiting");
      if(simEnabled || replayUiActive || replaySourceActive){
        if(waitingVisible || !el.disconnectOverlay.classList.contains("hidden")) hideDisconnectOverlay();
        return;
      }
      if(!isMobileLayout()){
        if(waitingVisible) hideDisconnectOverlay();
        return;
      }
      const guideOpen = [
        el.connectionGuideOverlay,
        el.wifiConnectOverlay,
        el.serialConnectOverlay
      ].some(isVisibleOverlay);
      if(guideOpen){
        if(waitingVisible) hideDisconnectOverlay();
        return;
      }
      if(!groundStationWaitStartedAt){
        groundStationWaitStartedAt = Date.now();
      }
      const waitRemaining = GROUND_STATION_WAIT_MIN_MS - (Date.now() - groundStationWaitStartedAt);
      if(waitRemaining > 0){
        showGroundStationWaitingOverlay();
        if(!groundStationWaitTimer){
          groundStationWaitTimer = setTimeout(()=>{
            groundStationWaitTimer = null;
            syncMobileGroundStationWaitOverlay();
          }, waitRemaining + 20);
        }
        return;
      }
      if(isGroundStationTransportConnected()){
        groundStationConnectionEstablished = true;
        if(waitingVisible) hideDisconnectOverlay();
        return;
      }
      if(groundStationConnectionEstablished){
        showDisconnectOverlay();
      }else{
        showGroundStationWaitingOverlay();
      }
    }
    function showDisconnectOverlay(){
      hideMobileControlsPanel();
      if(!el.disconnectOverlay) return;
      if(!isMobileLayout() && !simEnabled && !replaySourceActive){
        hideDisconnectOverlay();
        syncWelcomeConnectScreen(false);
        return;
      }
      if(isMobileLayout() && !groundStationConnectionEstablished){
        showGroundStationWaitingOverlay();
        return;
      }
      if(rebootConfirmWaiting){
        hideRebootConfirm();
      }
      el.disconnectOverlay.classList.remove("is-ground-waiting");
      if(el.disconnectTitle) el.disconnectTitle.textContent = t("deviceDisconnectedTitle");
      if(el.disconnectText) el.disconnectText.innerHTML = t("deviceDisconnectedText");
      setOverlayVisible(el.disconnectOverlay, true);
    }
    function hideDisconnectOverlay(){
      if(el.disconnectOverlay) el.disconnectOverlay.classList.remove("is-ground-waiting");
      setOverlayVisible(el.disconnectOverlay, false);
    }
    function showGpsHelpModal(){
      hideMobileControlsPanel();
      if(!el.gpsHelpOverlay) return;
      setOverlayVisible(el.gpsHelpOverlay, true);
    }
    function hideGpsHelpModal(){
      setOverlayVisible(el.gpsHelpOverlay, false);
    }
    function showConnectMethodModal(){
      hideMobileControlsPanel();
      if(!el.connectMethodOverlay) return;
      setOverlayVisible(el.connectMethodOverlay, true);
    }
    function hideConnectMethodModal(){
      setOverlayVisible(el.connectMethodOverlay, false);
    }
    function getAgentAlarmIssue(code){
      const c = String(code || "");
      if(c === "WS_DISCONNECTED"){
        return {
          key:c,
          severity:"warning",
          title:"실시간 스트림 끊김",
          sub:"라이브 데이터가 잠시 멈췄습니다.",
          detail:"보드 전원과 Wi‑Fi 상태를 확인하세요.\nALTIS Wi‑Fi에 연결되어 있다면 잠시 뒤 자동으로 다시 연결됩니다."
        };
      }
      if(c === "DATA_TIMEOUT"){
        return {
          key:c,
          severity:"critical",
          title:"데이터 수신 없음",
          sub:"텔레메트리 업데이트가 멈췄습니다.",
          detail:"보드 전원, 배터리, 통신 모드를 확인하세요.\nWi‑Fi는 ALTIS AP 연결, USB는 케이블과 포트 권한을 확인하세요."
        };
      }
      if(c === "RX_HZ_DROP"){
        return {
          key:c,
          severity:"warning",
          title:"수신률 저하",
          sub:"현재 수신률: " + ((rxHzWindow > 0 && isFinite(rxHzWindow)) ? rxHzWindow.toFixed(0) : "--") + " Hz",
          detail:"무선 신호가 약하거나 기기 부하가 높을 수 있습니다.\n거리를 줄이고 백그라운드 앱을 정리한 뒤 확인하세요."
        };
      }
      if(c === "RELAY_LOCKOUT"){
        return {
          key:c,
          severity:"critical",
          title:"릴레이 LOCKOUT",
          sub:"비정상 릴레이 HIGH가 감지되었습니다.",
          detail:"제어가 차단되었습니다.\n릴레이, 배선, 드라이버 쇼트 여부를 확인한 뒤 보드를 재시작하세요."
        };
      }
      if(c === "WS_BACKPRESSURE"){
        return {
          key:c,
          severity:"warning",
          title:"전송 지연",
          sub:"라이브 데이터 전송이 밀리고 있습니다.",
          detail:"네트워크 또는 브라우저 부하가 높을 수 있습니다.\n잠시 대기하거나 연결을 다시 시도하세요."
        };
      }
      if(c === "INTERNAL_EXCEPTION"){
        return {
          key:c,
          severity:"warning",
          title:"UI 오류 반복",
          sub:"데이터 처리 중 오류가 반복되었습니다.",
          detail:"일시적인 렌더링 오류일 수 있습니다.\n계속 발생하면 로그를 저장한 뒤 페이지를 다시 열어보세요."
        };
      }
      return {
        key:c,
        severity:"warning",
        title:"알람: " + c,
        sub:"확인이 필요한 상태입니다.",
        detail:"로그에서 발생 시점을 확인하고 전원, 통신, 센서 상태를 점검하세요."
      };
    }
    function collectAgentIssues(){
      const issues = [];
      const push = (item)=>{
        if(!item || !item.key) return;
        if(issues.some(existing=>existing.key === item.key)) return;
        issues.push(item);
      };
      if(lockoutLatched){
        push({
          key:"lockout",
          severity:"critical",
          title:"LOCKOUT 상태",
          sub:"제어가 차단되었습니다.",
          detail:"비정상 릴레이 HIGH 또는 안전 오류가 감지되었습니다.\n릴레이, 배선, 드라이버 쇼트 여부를 확인하고 보드를 재시작하세요."
        });
      }
      if(!connOk && !simEnabled){
        push({
          key:"connection",
          severity:"critical",
          title:"보드 오프라인",
          sub:"보드와 통신 중이 아닙니다.",
          detail:"ALTIS Wi‑Fi 또는 USB 시리얼 연결을 확인하세요.\n전원, 배터리, 케이블, 포트 권한 순서로 점검하세요."
        });
      }else if(connOk && !wsConnected && !serialConnected){
        push({
          key:"ws",
          severity:"warning",
          title:"스트림 미연결",
          sub:"기본 통신은 있지만 라이브 스트림이 없습니다.",
          detail:"잠시 뒤 자동 재연결됩니다.\n계속 유지되면 Wi‑Fi 신호와 보드 웹서버 상태를 확인하세요."
        });
      }
      if(wsConnected && rxHzWindow > 0 && rxHzWindow <= rxHzWarnThreshold()){
        push({
          key:"rxhz",
          severity:"warning",
          title:"수신률 낮음",
          sub:"현재 " + rxHzWindow.toFixed(0) + " Hz",
          detail:"목표 수신률보다 낮습니다.\n거리를 줄이고 네트워크 혼잡이나 기기 부하를 확인하세요."
        });
      }
      if(statusMapState && statusMapState.tileOffline){
        push({
          key:"map-offline",
          severity:"warning",
          title:"지도 오프라인",
          sub:"지도 배경을 불러오지 못했습니다.",
          detail:"인터넷 연결 또는 로컬 지도 파일을 확인하세요.\nGPS 좌표가 있으면 위치 추적은 계속됩니다."
        });
      }
      if(statusMapState && !statusMapState.hasLiveFix){
        const gpsSeenKnown = latestTelemetry && latestTelemetry.gps_seen != null;
        const gpsSeen = gpsSeenKnown ? (Number(latestTelemetry.gps_seen) === 1) : true;
        const gpsAgeMs = latestTelemetry && isFinite(Number(latestTelemetry.gps_age_ms))
          ? Math.max(0, Number(latestTelemetry.gps_age_ms))
          : NaN;
        if(!gpsSeen){
          push({
            key:"gps-module",
            severity:"warning",
            title:"GPS 미수신",
            sub:"GPS 데이터가 수신되지 않습니다.",
            detail:"GPS 모듈 전원과 TX/RX 배선을 확인하세요.\n계속 미수신이면 GND 공통과 케이블 접촉 상태를 점검하세요.",
            images:[
              {
                src:"img/gps_guide_img.png",
                alt:"GPS 케이블 연결 포트 안내 이미지"
              }
            ]
          });
        }else{
        push({
          key:"gps-fix",
          severity:"warning",
          title:"GPS 위치 대기",
          sub:isFinite(gpsAgeMs) ? ("데이터 수신 중 · 위치 미고정 · " + Math.round(gpsAgeMs / 1000) + "초 전") : "GPS 데이터는 있으나 위치가 고정되지 않았습니다.",
          detail:"GPS 안테나를 하늘이 보이는 방향으로 두고 1~3분 기다리세요.\n케이블이 보드 포트에 끝까지 꽂혀 있는지도 확인하세요.",
          images:[
            {
              src:"img/gps_antenna_sky_guide.png",
              alt:"GPS 안테나를 하늘이 보이는 방향으로 향하게 두는 안내 이미지"
            }
          ]
        });
        }
      }
      if(safetyModeEnabled){
        push({
          key:"safety-mode",
          severity:"warning",
          title:"안전 모드 켜짐",
          sub:"일부 제어가 제한됩니다.",
          detail:"의도한 상태라면 정상입니다.\n제어가 필요하면 주변 안전을 확인한 뒤 해제하세요."
        });
      }
      if(replaySourceActive){
        push({
          key:"replay-mode",
          severity:"warning",
          title:"리플레이 모드",
          sub:"실기기 제어/상태와 다를 수 있습니다.",
          detail:"리플레이 데이터 재생 중입니다.\n실제 보드를 제어하려면 리플레이를 종료하세요."
        });
      }
      if(loadcellErrorActive){
        push({
          key:"loadcell",
          severity:"warning",
          title:"로드셀 확인 필요",
          sub:"추력 센서 상태를 확인할 수 없습니다.",
          detail:"로드셀 영점과 보정 상태를 확인하세요.\n센서 케이블과 장착 상태를 점검한 뒤 다시 측정하세요."
        });
      }
      Object.keys(alarmState || {}).forEach(code=>{
        const runtime = alarmState[code];
        if(code === "WS_DISCONNECTED" && !wsEverConnected) return;
        if(runtime && runtime.active) push(getAgentAlarmIssue(code));
      });
      return issues;
    }
    function updateAgentIssueImageDots(){
      if(!el.agentIssueImageTrack || !el.agentIssueImageDots) return;
      const slides = Array.from(el.agentIssueImageTrack.querySelectorAll(".agent-issue-image-slide"));
      const dots = Array.from(el.agentIssueImageDots.querySelectorAll(".agent-issue-image-dot"));
      if(!slides.length || !dots.length) return;
      const width = el.agentIssueImageTrack.clientWidth || 1;
      const index = Math.max(0, Math.min(dots.length - 1, Math.round(el.agentIssueImageTrack.scrollLeft / width)));
      dots.forEach((dot, dotIndex)=>{
        dot.classList.toggle("is-active", dotIndex === index);
      });
    }
    function renderAgentIssueDetail(issue){
      if(!el.agentIssueDetailTitle || !el.agentIssueDetailText) return;
      if(!issue){
        el.agentIssueDetailTitle.textContent = "현재 문제가 없습니다";
        el.agentIssueDetailText.textContent = "연결, 지도, GPS, 제어 상태에서 즉시 조치가 필요한 항목이 보이지 않습니다.";
        if(el.agentIssueImageWrap) el.agentIssueImageWrap.classList.add("hidden");
        if(el.agentIssueImageTrack) el.agentIssueImageTrack.textContent = "";
        if(el.agentIssueImageDots) el.agentIssueImageDots.textContent = "";
        return;
      }
      el.agentIssueDetailTitle.textContent = issue.title || "문제 상세";
      el.agentIssueDetailText.textContent = issue.detail || "해당 항목의 상태를 확인하세요.";
      if(el.agentIssueImageWrap && el.agentIssueImageTrack){
        const images = Array.isArray(issue.images) && issue.images.length
          ? issue.images
          : (issue.image ? [{ src:issue.image, alt:issue.imageAlt || "" }] : []);
        if(images.length){
          el.agentIssueImageTrack.textContent = "";
          images.forEach(item=>{
            const slide = document.createElement("div");
            slide.className = "agent-issue-image-slide";
            const img = document.createElement("img");
            img.src = item.src || "";
            img.alt = item.alt || "";
            slide.appendChild(img);
            el.agentIssueImageTrack.appendChild(slide);
          });
          if(el.agentIssueImageDots){
            el.agentIssueImageDots.textContent = "";
            images.forEach(()=>{
              const dot = document.createElement("span");
              dot.className = "agent-issue-image-dot";
              el.agentIssueImageDots.appendChild(dot);
            });
            el.agentIssueImageDots.style.display = images.length > 1 ? "" : "none";
          }
          el.agentIssueImageTrack.scrollLeft = 0;
          updateAgentIssueImageDots();
          el.agentIssueImageWrap.classList.remove("hidden");
        }else{
          el.agentIssueImageTrack.textContent = "";
          if(el.agentIssueImageDots) el.agentIssueImageDots.textContent = "";
          el.agentIssueImageWrap.classList.add("hidden");
        }
      }
    }
    function showAgentIssueModal(issue){
      if(!el.agentIssueOverlay) return;
      renderAgentIssueDetail(issue);
      el.agentIssueOverlay.classList.remove("is-open");
      setOverlayVisible(el.agentIssueOverlay, true);
      requestAnimationFrame(()=>{
        if(el.agentIssueOverlay) el.agentIssueOverlay.classList.add("is-open");
      });
    }
    function hideAgentIssueModal(){
      if(el.agentIssueOverlay) el.agentIssueOverlay.classList.remove("is-open");
      setOverlayVisible(el.agentIssueOverlay, false);
    }
    function renderAgentHelpModal(){
      const issues = collectAgentIssues();
      if(el.agentHelpEmpty){
        el.agentHelpEmpty.classList.toggle("hidden", issues.length !== 0);
      }
      if(el.agentHelpList){
        el.agentHelpList.innerHTML = "";
        el.agentHelpList.classList.toggle("hidden", issues.length === 0);
        issues.forEach((issue, index)=>{
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "agent-help-issue";
          btn.setAttribute("data-severity", issue.severity || "warning");
          btn.setAttribute("role", "listitem");
          const dot = document.createElement("span");
          dot.className = "agent-help-dot";
          dot.setAttribute("aria-hidden", "true");
          const copy = document.createElement("span");
          const title = document.createElement("span");
          title.className = "agent-help-issue-title";
          title.textContent = issue.title || "문제";
          const sub = document.createElement("span");
          sub.className = "agent-help-issue-sub";
          sub.textContent = issue.sub || "상세 확인";
          copy.appendChild(title);
          copy.appendChild(sub);
          const chevron = document.createElement("span");
          chevron.className = "agent-help-chevron";
          chevron.setAttribute("aria-hidden", "true");
          chevron.textContent = "›";
          btn.appendChild(dot);
          btn.appendChild(copy);
          btn.appendChild(chevron);
          btn.addEventListener("click", ()=>{
            showAgentIssueModal(issue);
          });
          el.agentHelpList.appendChild(btn);
        });
      }
    }
    function showAgentHelpModal(){
      hideMobileControlsPanel();
      if(!el.agentHelpOverlay) return;
      renderAgentHelpModal();
      el.agentHelpOverlay.classList.remove("is-open");
      setOverlayVisible(el.agentHelpOverlay, true);
      requestAnimationFrame(()=>{
        if(el.agentHelpOverlay) el.agentHelpOverlay.classList.add("is-open");
      });
    }
    function hideAgentHelpModal(){
      hideAgentIssueModal();
      if(el.agentHelpOverlay) el.agentHelpOverlay.classList.remove("is-open");
      setOverlayVisible(el.agentHelpOverlay, false);
    }
    function updateWsAlert(){
      if(replaySourceActive){
        wsAlertDismissed = false;
        lastWsAlertActive = false;
        hideWsAlert();
        return;
      }
      const simOff = (simEnabled && devWsOff);
      const shouldAlert = (simOff || (!simEnabled && !wsLogSilent && connOk && !wsConnected));

      if(!shouldAlert){
        wsAlertDismissed = false;
        lastWsAlertActive = false;
        hideWsAlert();
        return;
      }

      if(!lastWsAlertActive){
        lastWsAlertActive = true;
      }
      hideWsAlert();
    }
    function clearWifiConnectWaitTimer(){
      if(wifiConnectWaitTimer){
        clearTimeout(wifiConnectWaitTimer);
        wifiConnectWaitTimer = null;
      }
    }
    function setWifiConnectWizardStage(stage){
      wifiConnectStage = stage || "guide";
      if(!el.wifiConnectTitle || !el.wifiConnectDesc || !el.wifiConnectHint || !el.wifiConnectNextBtn){
        return;
      }
      const spinner = el.wifiConnectSpinner || null;
      const showSpinner = (wifiConnectStage === "waiting");
      if(spinner){
        spinner.classList.toggle("hidden", !showSpinner);
        spinner.style.display = showSpinner ? "block" : "none";
      }

      el.wifiConnectTitle.textContent = t("connectWifiTitle");

      if(wifiConnectStage === "waiting"){
        el.wifiConnectDesc.textContent = t("connectWifiWaitingText");
        el.wifiConnectHint.textContent = t("connectWifiWaitingHint");
        el.wifiConnectNextBtn.textContent = t("connectWifiWaitingBtn");
        el.wifiConnectNextBtn.disabled = true;
        setWelcomeConnectStatus("connecting", "Wi-Fi 보드 확인중");
      }else if(wifiConnectStage === "success"){
        el.wifiConnectDesc.textContent = t("connectWifiSuccessText");
        el.wifiConnectHint.textContent = t("connectWifiSuccessHint");
        el.wifiConnectNextBtn.textContent = t("connectWifiClose");
        el.wifiConnectNextBtn.disabled = false;
        setWelcomeConnectStatus("connected", "Wi-Fi 연결 완료");
      }else if(wifiConnectStage === "fail"){
        el.wifiConnectDesc.textContent = t("connectWifiFailText");
        el.wifiConnectHint.textContent = wifiConnectLastProbeError
          ? (t("connectWifiFailHint") + " / " + wifiConnectLastProbeError)
          : t("connectWifiFailHint");
        el.wifiConnectNextBtn.textContent = t("connectWifiRetry");
        el.wifiConnectNextBtn.disabled = false;
        setWelcomeConnectStatus("idle", "Wi-Fi 연결 실패");
      }else{
        el.wifiConnectDesc.textContent = t("connectWifiGuideText");
        el.wifiConnectHint.textContent = t("connectWifiGuideHint");
        el.wifiConnectNextBtn.textContent = t("connectWifiNext");
        el.wifiConnectNextBtn.disabled = false;
      }
    }
    function closeWifiConnectWizard(){
      clearWifiConnectWaitTimer();
      wifiConnectWaitUntilMs = 0;
      wifiConnectStage = "idle";
      setOverlayVisible(el.wifiConnectOverlay, false);
      syncMobileGroundStationWaitOverlay();
    }
    async function probeBoardPing(timeoutMs){
      const bases = getApiBaseCandidates();
      let lastErr = null;
      for(const base of bases){
        const url = (base ? base : "") + "/ping?_ts=" + Date.now();
        const ctrl = createAbortControllerSafe();
        const timer = ctrl ? setTimeout(()=>{
          try{ ctrl.abort(); }catch(_e){}
        }, timeoutMs || 1800) : null;
        try{
          let ok = false;
          if(shouldUseNativeBoardHttp(url)){
            await nativeBoardHttpGet(url, timeoutMs || 1800, "text");
            ok = true;
          }else{
            const res = await fetch(url, ctrl ? {signal:ctrl.signal} : {});
            ok = !!(res && res.ok);
            if(!ok) lastErr = new Error("HTTP " + (res ? res.status : 0));
          }
          if(ok){
            if(base){
              setApiBaseOverride(base, isLocalPreviewHost());
            }
            if(typeof window !== "undefined"){
              window.__flashLastProbe = {ok:true, kind:"ping", url, at:Date.now()};
            }
            return true;
          }
        }catch(e){
          lastErr = e;
        }finally{
          if(timer) clearTimeout(timer);
        }
      }
      if(typeof window !== "undefined"){
        window.__flashLastProbe = {
          ok:false,
          kind:"ping",
          err:normalizeNetError(lastErr, "failed"),
          at:Date.now()
        };
      }
      throw (lastErr || new Error("ping failed"));
    }
    async function probeWelcomeWifiBoardReachable(){
      wifiConnectLastProbeError = "";
      if(connOk || wsConnected) return true;
      // 650 ms was too short for the first request after joining the board AP:
      // ARP/DHCP settling alone can consume most of that window.
      const timeoutMs = 1200;
      const bases = getApiBaseCandidates();
      const attempts = bases.map(async (base)=>{
        const url = (base ? base : "") + "/ping?_ts=" + Date.now();
        const ctrl = createAbortControllerSafe();
        const timer = ctrl ? setTimeout(()=>{
          try{ ctrl.abort(); }catch(_e){}
        }, timeoutMs) : null;
        try{
          if(shouldUseNativeBoardHttp(url)){
            await nativeBoardHttpGet(url, timeoutMs, "text");
            return {ok:true, base, url};
          }
          const res = await fetch(url, ctrl ? {signal:ctrl.signal, cache:"no-store"} : {cache:"no-store"});
          return {ok:!!(res && res.ok), base, url};
        }catch(error){
          return {ok:false, base, url, error};
        }finally{
          if(timer) clearTimeout(timer);
        }
      });
      const results = await Promise.all(attempts);
      const match = results.find(result=>result && result.ok);
      if(!match){
        const failed = results.find(result=>result && result.error);
        wifiConnectLastProbeError = "ping: " + normalizeNetError(failed && failed.error, "failed");
        return false;
      }
      if(match.base){
        setApiBaseOverride(match.base, isLocalPreviewHost());
      }
      if(typeof window !== "undefined"){
        window.__flashLastProbe = {ok:true, kind:"welcome_ping", url:match.url, at:Date.now()};
      }
      if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("welcome ping alive");
      updateData().catch(()=>{});
      return true;
    }
    async function probeWifiBoardReachable(){
      wifiConnectLastProbeError = "";
      if(connOk || wsConnected) return true;
      try{
        if(await probeBoardPing(1800)){
          if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("ping alive");
          updateData().catch(()=>{});
          return true;
        }
      }catch(e){
        wifiConnectLastProbeError = "ping: " + normalizeNetError(e, "failed");
      }

      try{
        await fetchWifiInfo();
      }catch(e){
        wifiConnectLastProbeError = "wifi_info: " + normalizeNetError(e, "failed");
      }
      if(connOk || wsConnected) return true;

      try{
        const sample = await fetchJsonWithFallback(1800);
        onIncomingSample(sample, "WIFI");
        return true;
      }catch(e){
        wifiConnectLastProbeError = "data: " + normalizeNetError(e, "failed");
      }

      return !!(connOk || wsConnected);
    }
    async function wifiConnectWaitTick(){
      if(wifiConnectStage !== "waiting") return;
      const ok = await probeWifiBoardReachable();
      if(ok){
        setWifiConnectWizardStage("success");
        showToast(t("connectWifiSuccessText"), "success", {key:"wifi-connect-success"});
        if(welcomeConnectAttempted){
          markWelcomeConnectionReady();
          syncWelcomeConnectScreen(true);
        }
        return;
      }
      if(Date.now() >= wifiConnectWaitUntilMs){
        setWifiConnectWizardStage("fail");
        return;
      }
      clearWifiConnectWaitTimer();
      wifiConnectWaitTimer = setTimeout(()=>{
        wifiConnectWaitTick();
      }, 900);
    }
    function startWifiConnectWait(){
      clearWifiConnectWaitTimer();
      wifiConnectWaitUntilMs = Date.now() + WIFI_CONNECT_WAIT_TIMEOUT_MS;
      setWifiConnectWizardStage("waiting");
      wifiConnectWaitTick();
    }
    function openWifiConnectWizard(){
      if(!el.wifiConnectOverlay) return;
      clearWifiConnectWaitTimer();
      setWifiConnectWizardStage("guide");
      setOverlayVisible(el.wifiConnectOverlay, true);
    }
    function setSerialConnectWizardStage(stage, detail){
      serialConnectStage = stage || "guide";
      if(!el.serialConnectTitle || !el.serialConnectDesc || !el.serialConnectHint || !el.serialConnectNextBtn){
        return;
      }
      const spinner = el.serialConnectSpinner || null;
      const isWaiting = (serialConnectStage === "waiting");
      if(spinner){
        spinner.classList.toggle("hidden", !isWaiting);
        spinner.style.display = isWaiting ? "block" : "none";
      }
      if(serialConnectStage === "waiting"){
        el.serialConnectTitle.textContent = "시리얼 연결 중";
        el.serialConnectDesc.textContent = detail || "포트 권한을 허용하고 잠시 기다리세요.";
        el.serialConnectHint.textContent = detail
          ? "보드가 재시작되면 자동으로 다시 연결합니다."
          : "브라우저 포트 선택 창에서 ALTIS 보드를 선택하세요.";
        el.serialConnectNextBtn.textContent = "연결 중...";
        el.serialConnectNextBtn.disabled = true;
        setWelcomeConnectStatus("connecting", "USB 시리얼 연결중");
      }else if(serialConnectStage === "success"){
        el.serialConnectTitle.textContent = "시리얼 연결 완료";
        el.serialConnectDesc.textContent = "보드와 연결되었습니다.";
        el.serialConnectHint.textContent = "이제 라이브 데이터와 제어를 사용할 수 있습니다.";
        el.serialConnectNextBtn.textContent = "확인";
        el.serialConnectNextBtn.disabled = false;
        setWelcomeConnectStatus("connected", "USB 연결 완료");
      }else if(serialConnectStage === "fail"){
        el.serialConnectTitle.textContent = "시리얼 연결 실패";
        el.serialConnectDesc.textContent = "포트 또는 권한을 확인하세요.";
        el.serialConnectHint.textContent = "USB 케이블, 보드 전원, 브라우저 권한을 확인하세요.";
        el.serialConnectNextBtn.textContent = "다시 시도";
        el.serialConnectNextBtn.disabled = false;
        setWelcomeConnectStatus("idle", "USB 연결 실패");
      }else{
        el.serialConnectTitle.textContent = "시리얼 연결";
        el.serialConnectDesc.textContent = "USB 케이블을 연결한 뒤 ALTIS 보드를 선택하세요.";
        el.serialConnectHint.textContent = "연결을 누르면 브라우저 포트 선택 창이 열립니다.";
        el.serialConnectNextBtn.textContent = "연결";
        el.serialConnectNextBtn.disabled = false;
      }
    }
    function openSerialConnectWizard(){
      if(!el.serialConnectOverlay) return;
      setSerialConnectWizardStage("guide");
      setOverlayVisible(el.serialConnectOverlay, true);
    }
    function closeSerialConnectWizard(){
      serialConnectStage = "idle";
      setOverlayVisible(el.serialConnectOverlay, false);
      syncMobileGroundStationWaitOverlay();
    }
    async function startSerialConnectFromWizard(){
      if(serialConnectStage === "waiting") return;
      setSerialConnectWizardStage("waiting");
      await serialConnect();
      updateSerialControlTile();
      updateSerialPill();
      if(serialConnected){
        setSerialConnectWizardStage("success");
        if(welcomeConnectAttempted){
          markWelcomeConnectionReady();
          syncWelcomeConnectScreen(true);
        }
      }else{
        setSerialConnectWizardStage("fail");
      }
    }
    async function setConnectTransportMode(nextMode, opts){
      const options = opts || {};
      const mode = (nextMode === "serial") ? "serial" : "wifi";
      if(simEnabled){
        setSimEnabled(false, {silent:true});
      }
      const wasMode = getConnectTransportMode();
      const changed = (wasMode !== mode);

      serialEnabled = (mode === "serial");
      uiSettings.serialEnabled = serialEnabled;
      if(el.serialToggle) el.serialToggle.checked = serialEnabled;
      saveSettings();
      if(mode !== "wifi"){
        closeWifiConnectWizard();
      }
      if(mode !== "serial"){
        closeSerialConnectWizard();
      }

      if(mode === "serial"){
        if(wsRetryTimer){
          clearTimeout(wsRetryTimer);
          wsRetryTimer = null;
        }
        closeWsSocketSafe(1000, "serial mode");
        wsConnected = false;
        wsConnectStartedMs = 0;
        setAlarmActive("WS_DISCONNECTED", false);
        updateWsUI();
      }

      if(mode === "wifi" && serialConnected){
        await serialDisconnect();
      }

      updateSerialControlTile();
      updateSerialPill();

      if(changed && options.toast !== false){
        showToast(
          (mode === "serial") ? t("connectModeSerialToast") : t("connectModeWifiToast"),
          "info",
          {key:"connect-mode-change"}
        );
      }
      return mode;
    }
    async function handleConnectAction(){
      showConnectMethodModal();
    }
    async function disconnectCurrentConnection(){
      if(simEnabled){
        setSimEnabled(false);
        syncMobileBoardHeader();
        showToast("시뮬레이션 연결 해제", "info", {key:"mobile-disconnect"});
        return;
      }
      if(serialConnected || serialEnabled){
        await serialDisconnect({silent:true});
        syncMobileBoardHeader();
        showToast("시리얼 연결 해제", "info", {key:"mobile-disconnect"});
        return;
      }
      if(wsRetryTimer){
        clearTimeout(wsRetryTimer);
        wsRetryTimer = null;
      }
      closeWsSocketSafe(1000, "manual disconnect");
      wsConnected = false;
      wsConnectStartedMs = 0;
      connOk = false;
      updateConnectionUI(false);
      updateWsUI();
      syncMobileBoardHeader();
      showToast("연결 해제", "info", {key:"mobile-disconnect"});
    }
    async function startConnectMethod(mode){
      hideConnectMethodModal();
      const nextMode = (mode === "serial") ? "serial" : "wifi";
      await setConnectTransportMode(nextMode, {toast:false});
      if(nextMode === "wifi"){
        openWifiConnectWizard();
        return;
      }
      if(serialConnected){
        showToast(t("connectSerialAlready"), "info", {key:"serial-already"});
        return;
      }
      openSerialConnectWizard();
      await startSerialConnectFromWizard();
    }
    async function runAutoWifiConnect(reason){
      if(simEnabled) return;
      if(autoWifiConnectBusy) return;
      if(serialConnected || serialConnectStage === "waiting" || serialConnectBusy) return;
      if(wifiConnectStage === "waiting") return;
      autoWifiConnectBusy = true;
      try{
        if(serialEnabled){
          await setConnectTransportMode("wifi", {toast:false});
        }
        if(connOk || wsConnected){
          if(!wsConnected && !wsRetryTimer) scheduleWsReconnect(reason || "auto wifi");
          syncWelcomeConnectScreen(true);
          return;
        }
        if(!wsConnected && !wsRetryTimer) scheduleWsReconnect(reason || "auto wifi");
        let wifiReachable = false;
        try{
          wifiReachable = await probeBoardPing(650);
          if(wifiReachable && !wsConnected && !wsRetryTimer){
            scheduleWsReconnect(reason || "auto wifi");
          }
        }catch(_e){}
        if(connOk || wsConnected){
          syncWelcomeConnectScreen(true);
          return;
        }
        if(wifiReachable){
          syncWelcomeConnectScreen(false);
          return;
        }

        const grantedPort = await getPreviouslyGrantedSerialPort();
        if(grantedPort && !isGroundStationTransportConnected()){
          await setConnectTransportMode("serial", {toast:false});
          await serialConnect({preferGranted:true, autoReconnect:true});
          serialConnectStage = serialConnected ? "success" : "idle";
        }
      }finally{
        autoWifiConnectBusy = false;
        syncWelcomeConnectScreen(isGroundStationTransportConnected());
      }
    }
    function startAutoWifiConnectLoop(){
      if(autoWifiConnectTimer) return;
      runAutoWifiConnect("auto wifi boot");
      autoWifiConnectTimer = setInterval(()=>{
        runAutoWifiConnect("auto wifi loop");
      }, 1800);
    }
    async function startAutoWifiThenSerialConnect(){
      if(connOk || wsConnected){
        await setConnectTransportMode("wifi", {toast:false});
        if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("mobile auto wifi");
        showToast("Wi-Fi 연결 감지됨", "success", {key:"mobile-auto-wifi"});
        return;
      }
      showToast("Wi-Fi 자동 확인 중", "info", {key:"mobile-auto-wifi"});
      try{
        const ok = await probeWifiBoardReachable();
        if(ok){
          await setConnectTransportMode("wifi", {toast:false});
          if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("mobile auto wifi");
          showToast("Wi-Fi 연결 감지됨", "success", {key:"mobile-auto-wifi"});
          return;
        }
      }catch(_e){}
      await startConnectMethod("serial");
    }
    function updateTogglePill(pillEl, checked){
      if(!pillEl) return;
      pillEl.textContent = checked ? "ON" : "OFF";
      pillEl.classList.toggle("is-on", !!checked);
      pillEl.classList.toggle("is-off", !checked);
    }

    function boardControlUi(kind){
      if(kind === "safety"){
        return {toggle:el.safeModeToggle, pill:el.safeModePill};
      }
      return {toggle:el.armLockToggle, pill:el.armLockPill};
    }

    function syncBoardControlPendingUi(kind){
      const ui = boardControlUi(kind);
      const pending = pendingBoardControls[kind];
      if(ui.pill){
        ui.pill.classList.toggle("is-pending", !!pending);
        ui.pill.setAttribute("aria-busy", pending ? "true" : "false");
      }
    }

    function clearBoardControlPending(kind, token){
      const pending = pendingBoardControls[kind];
      if(!pending || (token && pending !== token)) return null;
      if(pending.timer) clearTimeout(pending.timer);
      pending.timer = null;
      pendingBoardControls[kind] = null;
      syncBoardControlPendingUi(kind);
      return pending;
    }

    function applyBoardControlUiValue(kind, value){
      const enabled = !!value;
      const ui = boardControlUi(kind);
      if(ui.toggle) ui.toggle.checked = enabled;
      updateTogglePill(ui.pill, enabled);
      if(kind === "safety"){
        safetyModeEnabled = enabled;
        if(uiSettings) uiSettings.safetyMode = enabled;
        updateMobileDashboardSafetyArmState();
        setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
        updateControlAccessUI(currentSt);
      }else{
        if(uiSettings) uiSettings.armLock = enabled;
        updateMobileArmLockWideButton();
      }
      if(uiSettings) saveSettings();
    }

    function rejectBoardControlPending(kind, token, reason){
      const pending = clearBoardControlPending(kind, token);
      if(!pending) return;
      const fallback = pending.lastObserved == null
        ? pending.previous
        : pending.lastObserved;
      applyBoardControlUiValue(kind, fallback);
      const label = kind === "safety" ? "안전 모드" : "ARM";
      showToast(label + " 적용 실패: " + (reason || "보드 응답 시간 초과"), "error", {
        key:"board-control-" + kind,
        duration:4200
      });
    }

    function confirmBoardControlPending(kind, token, value){
      if(!token || pendingBoardControls[kind] !== token) return false;
      const pending = clearBoardControlPending(kind, token);
      if(!pending) return false;
      const enabled = !!value;
      pending.lastObserved = enabled;
      applyBoardControlUiValue(kind, enabled);
      const label = kind === "safety" ? "안전 모드" : "ARM ON LOCK";
      showToast(label + (enabled ? " 켜짐" : " 꺼짐"), enabled ? "info" : "warn", {
        key:"board-control-" + kind,
        duration:2200
      });
      return true;
    }

    function reconcileBoardControlSerialCompletion(replyKind, message){
      if(replyKind !== "ack") return false;
      const upper = String(message || "").trim().toUpperCase();
      if(upper.indexOf("FLASH_LINK_STATE") !== 0) return false;
      const codeMatch = upper.match(/\bCODE=(\d+)/);
      const valueMatch = upper.match(/\bVALUE=(-?\d+)/);
      if(!codeMatch || !valueMatch) return false;
      const commandCode = Number(codeMatch[1]);
      const kind = commandCode === 1 ? "safety" : (commandCode === 2 ? "armLock" : null);
      if(!kind) return false;
      const pending = pendingBoardControls[kind];
      if(!pending) return true;
      const applied = Number(valueMatch[1]) !== 0;
      pending.lastObserved = applied;
      // A completion from an older request can arrive after the operator has
      // already selected the opposite state. Only settle the current request
      // when the applied value matches that request.
      if(applied === pending.expected){
        confirmBoardControlPending(kind, pending, applied);
      }
      return true;
    }

    function beginBoardControlPending(kind, expected, previous){
      clearBoardControlPending(kind);
      const token = {
        expected:!!expected,
        previous:!!previous,
        lastObserved:null,
        timer:null
      };
      pendingBoardControls[kind] = token;
      token.timer = setTimeout(()=>{
        rejectBoardControlPending(kind, token, "실제 상태 확인 시간 초과");
      }, BOARD_CONTROL_CONFIRM_TIMEOUT_MS);
      syncBoardControlPendingUi(kind);
      return token;
    }

    function reconcileBoardControlTelemetry(kind, rawValue, allowConfirm = true){
      if(rawValue == null || !Number.isFinite(Number(rawValue))) return rawValue;
      const incoming = Number(rawValue) !== 0;
      const pending = pendingBoardControls[kind];
      if(!pending) return incoming ? 1 : 0;
      if(!allowConfirm) return pending.expected ? 1 : 0;
      pending.lastObserved = incoming;
      if(incoming !== pending.expected){
        // AIL and USB both have transport latency. Do not let an older 100 Hz
        // telemetry frame undo the operator's selection while it is in flight.
        return pending.expected ? 1 : 0;
      }
      confirmBoardControlPending(kind, pending, incoming);
      return incoming ? 1 : 0;
    }

    function resetSimState(){
      simState = createSimState();
      resetCameraStageSeparation(false);
    }
    function buildSimImuSpecificForce(accEastMps2, accUpMps2, accNorthMps2, rollDeg, pitchDeg, yawDeg){
      const orientation = quatFromRenderEuler(pitchDeg, yawDeg, rollDeg);
      const worldSpecificForceG = [
        (Number(accEastMps2) || 0) / GYRO_IMU_GRAVITY_MPS2,
        1 + ((Number(accUpMps2) || 0) / GYRO_IMU_GRAVITY_MPS2),
        (Number(accNorthMps2) || 0) / GYRO_IMU_GRAVITY_MPS2
      ];
      const localRenderG = quatRotateVector(
        quatConjugate(orientation),
        worldSpecificForceG
      );
      // Inverse of sensor X/Y/Z -> render-local X/-Z/Y.
      return {
        ax:localRenderG[0],
        ay:-localRenderG[2],
        az:localRenderG[1]
      };
    }
    function setSimEnabled(enabled, opts){
      const silent = !!(opts && opts.silent);
      simEnabled = !!enabled;
      resetParachuteDeployState();
      if(simEnabled){
        setCameraSimSource(true);
        resetSimState();
        devParachuteDrop = false;
        resetGyroPathTracking();
        resetGyroAttitudeState();
        lockoutLatched = false;
        lockoutRelayMask = 0;
        devLoadcellError = false;
        hideLockoutModal();
        setLockoutVisual(false);
        resetInspectionUI();
        onIncomingSample(buildSimSample(), "SIMULATION");
      }else{
        if(cameraSimSourceActive){
          setCameraSimSource(false);
          if(isCameraUseEnabled() &&
             document.body.classList.contains("camera-view-active") &&
             !document.body.classList.contains("camera-gyro-plus-layout")) startWebcam();
        }
        resetSimState();
        devParachuteDrop = false;
        resetGyroPathTracking();
        resetGyroAttitudeState();
        resetInspectionUI();
        connOk = false;
        updateConnectionUI(false);
        if(!silent) showToast(t("simDisabledToast"), "info", {key:"sim-toggle"});
        devRelay1Locked = false;
        devRelay2Locked = false;
        devWsOff = false;
        devLoadcellError = false;
        lockoutLatched = false;
        lockoutRelayMask = 0;
        setLockoutVisual(false);
        updateRelaySafePill();
        setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
        setDevToolsVisible(false);
      }
      updateSerialControlTile();
      updateWsAlert();
      evaluateRuntimeAlarms(Date.now());
    }
    function buildSimSample(){
      const now = Date.now();
      const parachuteMode = !!devParachuteDrop;
      if(!parachuteMode && simState.st === 1){
        if(!simState.countdownStartMs) simState.countdownStartMs = now;
        const total = (simState.countdownTotalMs != null)
          ? simState.countdownTotalMs
          : ((uiSettings ? uiSettings.countdownSec : 10) * 1000);
        const remain = Math.max(0, total - (now - simState.countdownStartMs));
        simState.cdMs = remain;
        if(remain <= 0){
          simState.st = 2;
          simState.ignStartMs = now;
          if(simState.flightStartMs == null){
            simState.flightStartMs = now;
            simState.physicsLastMs = 0;
            resetGyroPathTracking();
          }
          simState.countdownStartMs = null;
          simState.cdMs = 0;
          simState.countdownTotalMs = null;
        }
      }else if(!parachuteMode && simState.st === 2){
        if(!simState.ignStartMs) simState.ignStartMs = now;
        const ignMs = Number((uiSettings ? uiSettings.ignDurationMs : 1000) || 1000);
        if(now - simState.ignStartMs >= ignMs){
          simState.st = 0;
          simState.ignStartMs = null;
        }
      }else if(parachuteMode){
        simState.st = 0;
        simState.cdMs = 0;
        simState.countdownStartMs = null;
        simState.countdownTotalMs = null;
        simState.ignStartMs = null;
      }

      const tSec = now / 1000;
      const baseLat = STATUS_MAP_DEFAULT.lat;
      const baseLon = STATUS_MAP_DEFAULT.lon;
      const baseAlt = 55;
      const metersPerLon = 111320 * Math.cos(baseLat * DEG_TO_RAD);
      const burnSec = parachuteMode
        ? 0
        : clampLocal(Number((uiSettings ? uiSettings.ignDurationMs : 1000) || 1000) / 1000, 0.1, 3);
      const parachuteDropAltM = 18; // 6-floor building equivalent (~3 m/floor)
      let hasFlight = (simState.flightStartMs != null);
      const padHeadingDeg = 34;
      const padPitchDeg = 88.6;
      const mainDeployAltM = 120;
      const simTargetApogeeM = 500;
      const coastGravityMps2 = 9.7;
      const burnSecSq = Math.max(0.6, burnSec * burnSec);
      const verticalDragCoeff = 0.0018;
      const boostMeanAccTarget = Math.max(
        10,
        (
          -coastGravityMps2 +
          Math.sqrt((coastGravityMps2 * coastGravityMps2) + ((8 * coastGravityMps2 * simTargetApogeeM) / burnSecSq))
        ) * 0.5
      ) * 1.41;
      if(parachuteMode && simState.flightStartMs == null){
        simState.flightStartMs = now; // T-0 release point
        simState.physicsLastMs = 0;
        hasFlight = true;
      }

      let simLat = baseLat;
      let simLon = baseLon;
      let simAlt = baseAlt;
      let ax = 0;
      let ay = 0;
      let az = 1;
      let gx = 0;
      let gy = 0;
      let gz = 0;
      let thrust = 0.12 + (0.02 * Math.sin((tSec * 1.9) + 0.4));
      let pressure = 0.22 + (0.03 * Math.sin((tSec * 1.3) + 0.2));
      let simBurnActive = false;

      if(hasFlight){
        if(simState.physicsLastMs <= 0){
          simState.physicsLastMs = now;
          simState.posE = 0;
          simState.posN = 0;
          simState.altM = parachuteMode ? parachuteDropAltM : Math.max(0, simState.altM || 0);
          simState.velE = 0;
          simState.velN = 0;
          simState.velU = parachuteMode ? -0.1 : 0;
          simState.accE = 0;
          simState.accN = 0;
          simState.accU = 0;
          simState.apogeeMs = parachuteMode ? now : null;
          simState.drogueDeployed = !!parachuteMode;
          simState.mainDeployed = !!parachuteMode;
          simState.landed = false;
          simState.landedMs = null;
          simState.gpsNextMs = 0;
          simState.gpsLat = null;
          simState.gpsLon = null;
          simState.gpsAlt = null;
          simState.gpsPhase = 0;
          simState.apogeeM = simState.altM;
          simState.flightPhase = parachuteMode ? "DESCENT" : "POWERED_FLIGHT";
          simState.flightPhaseStartedMs = now;
          simState.stageSeparated = false;
          simState.stageSeparationStartedMs = null;
          simState.stageSeparationAltitudeM = null;
          simState.stageSeparationAnnounced = false;
          simState.rollDeg = 0;
          simState.pitchDeg = parachuteMode ? 84.6 : padPitchDeg;
          simState.yawDeg = parachuteMode ? (padHeadingDeg + 2.5) : padHeadingDeg;
        }
        const prevPhysicsMs = simState.physicsLastMs || now;
        const rawDtSec = (now - prevPhysicsMs) / 1000;
        const dtSec = clampLocal(isFinite(rawDtSec) ? rawDtSec : 0.02, 0.005, 0.12);
        const steps = clampLocal(Math.ceil(dtSec / 0.02), 1, 6);
        const stepDt = dtSec / steps;
        const rollStart = simState.rollDeg;
        const pitchStart = simState.pitchDeg;
        const yawStart = simState.yawDeg;

        for(let i=0;i<steps;i++){
          const stepMs = prevPhysicsMs + Math.round((i + 1) * stepDt * 1000);
          const tFlight = Math.max(0, (stepMs - simState.flightStartMs) / 1000);
          const burnActive = tFlight < burnSec;

          if(!simState.apogeeMs && tFlight > Math.max(1.2, burnSec * 0.45) && simState.velU <= 0){
            simState.apogeeMs = stepMs;
          }
          if(simState.apogeeMs && !simState.drogueDeployed && (stepMs - simState.apogeeMs) >= 900){
            simState.drogueDeployed = true;
          }
          if(simState.drogueDeployed && !simState.mainDeployed && simState.altM <= mainDeployAltM){
            simState.mainDeployed = true;
          }

          const headingTarget = padHeadingDeg;
          const yawSmooth = simState.landed ? 5.2 : (burnActive ? 7.6 : (simState.mainDeployed ? 3.6 : 4.6));
          simState.yawDeg = lerpAngleDeg(simState.yawDeg, headingTarget, clampLocal(stepDt * yawSmooth, 0, 1));

          let targetForwardMps = 0;
          if(simState.landed){
            targetForwardMps = 0;
          }else if(burnActive){
            // A model rocket leaves the rail nearly vertical, then develops a
            // small flight-path angle as the fins weathercock into the airflow.
            // Use a smooth curve so the trail bends instead of stepping sideways.
            const curveStartSec = 0.18;
            const curveRatio = clampLocal(
              (tFlight - curveStartSec) /
                Math.max(0.2, Math.max(0.55, burnSec) - curveStartSec),
              0,
              1
            );
            const launchCurve = curveRatio * curveRatio * (3 - (2 * curveRatio));
            targetForwardMps = 2.2 * launchCurve;
          }else if(!simState.drogueDeployed){
            targetForwardMps = 1.55;
          }else if(!simState.mainDeployed){
            targetForwardMps = 0.32;
          }else{
            targetForwardMps = 0.10;
          }

          const altFactor = clampLocal(simState.altM / 600, 0, 1);
          let windE = 0;
          let windN = 0;
          if(!simState.landed){
            const windScale = simState.mainDeployed ? 1 :
              (simState.drogueDeployed ? 0.55 : 0.1);
            windE = windScale * (
              0.25 + (0.18 * altFactor) +
              (0.08 * Math.sin((tFlight * 0.08) + 0.8))
            );
            windN = windScale * (
              0.1 + (0.12 * altFactor) +
              (0.06 * Math.cos((tFlight * 0.07) + 1.6))
            );
            if(tFlight < 1.2){
              windE *= 0.2;
              windN *= 0.2;
            }
          }
          const yawRadVel = simState.yawDeg * DEG_TO_RAD;
          const targetVelE = (Math.sin(yawRadVel) * targetForwardMps) + windE;
          const targetVelN = (Math.cos(yawRadVel) * targetForwardMps) + windN;
          const horizTau = simState.landed ? 0.52 :
            (simState.mainDeployed ? 1.8 :
              (simState.drogueDeployed ? 2.5 : (burnActive ? 0.62 : 8)));
          const accE = (targetVelE - simState.velE) / horizTau;
          const accN = (targetVelN - simState.velN) / horizTau;

          const dragUp = verticalDragCoeff * simState.velU * Math.abs(simState.velU);
          let accU = 0;
          if(simState.landed){
            accU = 0;
          }else if(burnActive){
            const u = clampLocal(tFlight / Math.max(0.5, burnSec), 0, 1);
            const boostShape = Math.sin(Math.PI * Math.pow(u, 0.92));
            const boostAcc = clampLocal(
              boostMeanAccTarget * (0.74 + (0.42 * Math.max(0, boostShape))),
              10,
              148
            );
            accU = boostAcc - dragUp;
          }else if(!simState.drogueDeployed){
            accU = -9.72 - (dragUp * 0.65);
          }else if(!simState.mainDeployed){
            accU = (-14.5 - simState.velU) / 1.5;
          }else{
            const targetFall = -3.2;
            const tau = (simState.altM < 40) ? 0.85 : 1.1;
            accU = (targetFall - simState.velU) / tau;
            if(simState.altM < 7){
              const flare = clampLocal((7 - simState.altM) / 7, 0, 1);
              accU += 3.2 * flare;
            }
          }

          simState.velE += accE * stepDt;
          simState.velN += accN * stepDt;
          simState.velU += accU * stepDt;
          simState.posE += simState.velE * stepDt;
          simState.posN += simState.velN * stepDt;
          simState.altM += simState.velU * stepDt;
          simState.accE = accE;
          simState.accN = accN;
          simState.accU = accU;
          simState.apogeeM = Math.max(simState.apogeeM || 0, simState.altM);

          if(!parachuteMode && !simState.stageSeparated &&
             tFlight >= 2.0 && simState.velU > 0){
            simState.stageSeparated = true;
            simState.stageSeparationStartedMs = stepMs;
            simState.stageSeparationAltitudeM = simState.altM;
            // A short lateral/vertical impulse makes the event visible in the
            // flight path and IMU data without destabilizing the trajectory.
            simState.velE += 0.72;
            simState.velN -= 0.38;
            simState.velU -= 0.32;
          }

          if(simState.altM <= 0){
            simState.altM = 0;
            if(tFlight > (burnSec + 1.8) && simState.velU <= 0){
              simState.landed = true;
              if(!simState.landedMs) simState.landedMs = stepMs;
              simState.velU = 0;
            }
          }
          if(simState.landed){
            simState.velU = 0;
            simState.accU = 0;
            const groundDamp = Math.exp(-stepDt * 6.2);
            simState.velE *= groundDamp;
            simState.velN *= groundDamp;
            if(Math.hypot(simState.velE, simState.velN) < 0.01){
              simState.velE = 0;
              simState.velN = 0;
            }
          }

          const speedH = Math.hypot(simState.velE, simState.velN);
          const pathPitchDeg = Math.atan2(simState.velU, Math.max(0.1, speedH)) * RAD_TO_DEG;
          let pitchTarget = 0;
          if(simState.landed){
            pitchTarget = 88.8;
          }else if(burnActive){
            const u = clampLocal(tFlight / Math.max(0.5, burnSec), 0, 1);
            pitchTarget = padPitchDeg - (0.35 * Math.pow(u, 1.05));
          }else if(!simState.mainDeployed){
            pitchTarget = clampLocal(pathPitchDeg + (simState.velU > 0 ? 0.4 : -0.2), 78, 89.2);
          }else{
            pitchTarget = 84.5;
          }
          const pitchSmooth = simState.mainDeployed ? 2.6 : 3.2;
          simState.pitchDeg += (pitchTarget - simState.pitchDeg) * clampLocal(stepDt * pitchSmooth, 0, 1);

          let rollRateDps = 0;
          if(simState.landed){
            rollRateDps = 0;
          }else if(burnActive){
            rollRateDps = 0.12 + (0.08 * Math.sin((tFlight * 3.0) + 0.8));
          }else if(!simState.drogueDeployed){
            rollRateDps = 0.08 + (0.06 * Math.sin((tFlight * 2.4) + 0.4));
          }else if(!simState.mainDeployed){
            rollRateDps = 0.05 + (0.04 * Math.sin((tFlight * 1.6) + 1.1));
          }else{
            rollRateDps = 0.03 + (0.03 * Math.sin((tFlight * 0.8) + 0.2));
          }
          if(simState.landed){
            simState.rollDeg = lerpAngleDeg(simState.rollDeg, 0, clampLocal(stepDt * 6.0, 0, 1));
          }else{
            simState.rollDeg = normalizeAngleDeg(simState.rollDeg + (rollRateDps * stepDt));
          }
        }
        simState.physicsLastMs = now;

        const dtRate = Math.max(0.001, (now - prevPhysicsMs) / 1000);
        const tFlightNow = Math.max(0, (now - simState.flightStartMs) / 1000);
        const burnNow = tFlightNow < burnSec;
        simBurnActive = burnNow;
        const separationElapsedSec = simState.stageSeparationStartedMs
          ? Math.max(0, (now - simState.stageSeparationStartedMs) / 1000)
          : Infinity;
        const separationPulse = isFinite(separationElapsedSec)
          ? Math.exp(-separationElapsedSec / 0.22)
          : 0;
        const gyroNoiseAmp = burnNow ? 0.7 : (simState.mainDeployed ? 0.16 : 0.3);
        gx = angleDeltaDeg(rollStart, simState.rollDeg) / dtRate;
        gy = (simState.pitchDeg - pitchStart) / dtRate;
        gz = angleDeltaDeg(yawStart, simState.yawDeg) / dtRate;
        gx += gyroNoiseAmp * Math.sin((tSec * 18.0) + 0.2);
        gy += (gyroNoiseAmp * 0.5) * Math.cos((tSec * 16.0) + 0.7);
        gz += (gyroNoiseAmp * 0.45) * Math.sin((tSec * 15.0) + 1.1);
        gx += 18 * separationPulse;
        gy -= 7 * separationPulse;
        gz += 5 * separationPulse;
        gx = clampLocal(gx, -140, 140);
        gy = clampLocal(gy, -140, 140);
        gz = clampLocal(gz, -140, 140);

        const specificForce = buildSimImuSpecificForce(
          simState.accE,
          simState.accU,
          simState.accN,
          simState.rollDeg,
          simState.pitchDeg,
          simState.yawDeg
        );
        const vibeAmp = burnNow ? 0.012 : (simState.mainDeployed ? 0.002 : 0.005);
        const vibe = vibeAmp * (
          Math.sin((tSec * 34) + 0.4) +
          (0.6 * Math.sin((tSec * 47) + 0.9)) +
          (0.3 * Math.sin((tSec * 68) + 1.4))
        );
        ax = specificForce.ax + vibe;
        ay = specificForce.ay + (vibe * 0.56);
        az = specificForce.az + (vibe * 0.32);
        ax += 0.22 * separationPulse;
        ay -= 0.12 * separationPulse;
        az += 0.16 * separationPulse;
        ax = clampLocal(ax, -4, 4);
        ay = clampLocal(ay, -4, 4);
        az = clampLocal(az, -4, 4);

        const trueLat = baseLat + (simState.posN / 111320);
        const trueLon = baseLon + (simState.posE / (Math.abs(metersPerLon) > 1 ? metersPerLon : 1));
        const trueAlt = baseAlt + simState.altM;
        if(simState.gpsNextMs <= 0 || now >= simState.gpsNextMs){
          simState.gpsPhase += 1;
          const phase = simState.gpsPhase;
          const noiseH = simState.landed ? 0.03 : (simState.mainDeployed ? 0.05 : (burnNow ? 0.035 : 0.045));
          const noiseV = simState.landed ? 0.02 : (simState.mainDeployed ? 0.05 : 0.035);
          const noiseE = noiseH * Math.sin((phase * 1.37) + (tSec * 0.53));
          const noiseN = noiseH * 0.8 * Math.cos((phase * 0.91) + (tSec * 0.31));
          const noiseA = noiseV * Math.sin((phase * 1.11) + 0.4);
          simState.gpsLat = baseLat + ((simState.posN + noiseN) / 111320);
          simState.gpsLon = baseLon + ((simState.posE + noiseE) / (Math.abs(metersPerLon) > 1 ? metersPerLon : 1));
          simState.gpsAlt = baseAlt + Math.max(0, simState.altM + noiseA);
          const jitter = Math.floor((Math.sin((phase * 0.77) + 0.9) + 1) * 12);
          simState.gpsNextMs = now + 220 + jitter;
        }
        simLat = simState.gpsLat != null ? simState.gpsLat : trueLat;
        simLon = simState.gpsLon != null ? simState.gpsLon : trueLon;
        simAlt = simState.gpsAlt != null ? simState.gpsAlt : trueAlt;

        const u = clampLocal(tFlightNow / Math.max(0.5, burnSec), 0, 1);
        const thrustShape = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 1.08);
        if(burnNow){
          thrust = Math.max(0, 0.28 + (7.4 * Math.max(0, thrustShape)) + (0.25 * Math.sin((tSec * 41) + 0.3)));
        }else if(!simState.landed){
          thrust = 0.08 + (0.03 * Math.sin((tSec * 4.4) + 0.2));
        }else{
          thrust = 0.06 + (0.01 * Math.sin((tSec * 1.3) + 0.1));
        }
        const altNorm = clampLocal(simState.altM / 600, 0, 1);
        if(burnNow){
          pressure = 0.9 + (1.85 * Math.max(0, thrustShape)) + (0.08 * Math.sin((tSec * 18) + 0.4));
        }else if(!simState.landed){
          pressure = 0.24 + (0.16 * altNorm) + (simState.mainDeployed ? 0.02 : 0.06) + (0.04 * Math.sin((tSec * 2.4) + 0.9));
        }else{
          pressure = 0.22 + (0.02 * Math.sin((tSec * 1.4) + 0.2));
        }
        pressure = clampLocal(pressure, 0.1, 3.1);
      }else{
        const padPitchNow = padPitchDeg;
        const padRollNow = 0;
        simState.rollDeg = padRollNow;
        simState.pitchDeg = padPitchNow;
        simState.yawDeg = padHeadingDeg;
        const padSpecificForce = buildSimImuSpecificForce(
          0,
          0,
          0,
          padRollNow,
          padPitchNow,
          simState.yawDeg
        );
        ax = padSpecificForce.ax;
        ay = padSpecificForce.ay;
        az = padSpecificForce.az;
        gx = 0;
        gy = 0;
        gz = 0;
        simLat = baseLat;
        simLon = baseLon;
        simAlt = baseAlt;
        pressure = 0.22 + (0.01 * Math.sin((tSec * 1.3) + 0.2));
        thrust = 0.12 + (0.005 * Math.sin((tSec * 1.9) + 0.4));
      }
      if(hasFlight){
        let nextPhase = "COASTING";
        if(simState.landed) nextPhase = "LANDED";
        else if(simState.apogeeMs || simState.velU < -0.5) nextPhase = "DESCENT";
        else if(simBurnActive) nextPhase = "POWERED_FLIGHT";
        if(nextPhase !== simState.flightPhase){
          simState.flightPhase = nextPhase;
          simState.flightPhaseStartedMs = now;
        }
      }else{
        simState.flightPhase = "PRE_FLIGHT";
        simState.flightPhaseStartedMs = now;
      }
      if(simState.stageSeparationStartedMs){
        const separationElapsedMs = Math.max(0, now - simState.stageSeparationStartedMs);
        cameraStageSeparationProgress = clampLocal(separationElapsedMs / 1800, 0, 1);
        setCameraStageSeparating(true);
        if(!simState.stageSeparationAnnounced){
          simState.stageSeparationAnnounced = true;
          latchCameraEventState("단분리 · T+2.0 S");
          showToast("T+2.0초 단분리", "info", {key:"sim-stage-separation"});
        }
      }else if(!cameraStageSeparationManualAt){
        cameraStageSeparationProgress = 0;
        setCameraStageSeparating(false);
      }
      simState.lastGeo = {lat:simLat, lon:simLon, alt:simAlt, ms:now};

      const simTd = (simState.st === 1)
        ? -Math.max(0, simState.cdMs)
        : (simState.flightStartMs ? (now - simState.flightStartMs) : 0);
      const speedMps = Math.hypot(simState.velE, simState.velN, simState.velU);
      const phaseCode = {
        PRE_FLIGHT:0,
        POWERED_FLIGHT:1,
        COASTING:2,
        DESCENT:3,
        LANDED:4
      }[simState.flightPhase] || 0;
      const qX = quatFromAxisAngle([1,0,0], simState.rollDeg * DEG_TO_RAD);
      const qY = quatFromAxisAngle([0,1,0], simState.pitchDeg * DEG_TO_RAD);
      const qZ = quatFromAxisAngle([0,0,1], simState.yawDeg * DEG_TO_RAD);
      const attitudeQ = quatNormalize(quatMul(qZ, quatMul(qY, qX)));
      const flightAgeSec = simState.flightStartMs ? Math.max(0, (now - simState.flightStartMs) / 1000) : 0;
      const batteryV = clampLocal(4.18 - (flightAgeSec * 0.00045), 3.72, 4.18);
      const batteryPct = Math.round(clampLocal(((batteryV - 3.55) / 0.65) * 100, 0, 100));
      const motorPressureMpa = pressure;
      const atmosphereRatio = Math.max(0.01, 1 - (Math.max(0, simState.altM) / 44330));
      const baroPressureMpa = clampLocal(
        (0.101325 * Math.pow(atmosphereRatio, 5.255)) +
          (0.000006 * Math.sin((tSec * 2.1) + 0.5)),
        0.02,
        0.105
      );
      return {
        t: thrust,
        p:baroPressureMpa,
        p_mpa:baroPressureMpa,
        baro_pressure_mpa:baroPressureMpa,
        dp:motorPressureMpa,
        motor_pressure_mpa:motorPressureMpa,
        alt_m:simState.altM,
        altitude_m:simState.altM,
        speed_mps:speedMps,
        vertical_speed_mps:simState.velU,
        velocity_e_mps:simState.velE,
        velocity_n_mps:simState.velN,
        velocity_u_mps:simState.velU,
        ax,
        ay,
        az,
        gx,
        gy,
        gz,
        gr:simState.rollDeg,
        gp:simState.pitchDeg,
        gyw:simState.yawDeg,
        ga:1,
        attitude_q:attitudeQ,
        lt: 10,
        hz: SIM_SAMPLE_HZ,
        ct: 2000,
        chip_temp_c:31.5 + (simBurnActive ? 1.8 : 0.4 * Math.sin(tSec * 0.12)),
        chip_temp_ok:1,
        s: hasFlight ? 0 : 1,
        ic: 1,
        r: simState.st === 2 ? 1 : 0,
        st: simState.st,
        td: simTd,
        uw:simState.missionStandby ? 1 : 0,
        gs: isIgniterCheckEnabled() ? 1 : 0,
        m: 2,
        sm:safetyModeEnabled ? 1 : 0,
        al:(uiSettings && uiSettings.armLock) ? 1 : 0,
        ip:1,
        bo:1,
        sr:1,
        lc_raw:Math.round(thrust * 6510),
        lc_raw_ok:1,
        lc_ready:1,
        lc_sat:0,
        lc_offset_ok:1,
        lc_noise:0.02,
        lc_scale:6510,
        vbatt:batteryV,
        bp:batteryPct,
        storage_ready:1,
        gps_fix:1,
        gps_seen:1,
        gps_age_ms:0,
        gps_time_valid:1,
        gps_lat: simLat,
        gps_lon: simLon,
        gps_alt: simAlt,
        flight_phase:simState.flightPhase,
        flight_phase_code:phaseCode,
        apogee_m:simState.apogeeM,
        flight_phase_ms:Math.max(0, now - (simState.flightPhaseStartedMs || now)),
        deployment_state:simState.stageSeparated
          ? ((now - simState.stageSeparationStartedMs) >= 1000 ? 3 : 2)
          : (hasFlight ? 1 : 0),
        deployment_flags:(hasFlight ? 1 : 0) |
          (simState.stageSeparated && (now - simState.stageSeparationStartedMs) >= 1000 ? (1 << 5) : 0),
        stage_separated:simState.stageSeparated ? 1 : 0,
        stage_sep_progress:cameraStageSeparationProgress,
        stage_sep_alt_m:simState.stageSeparationAltitudeM,
        fl_role:"avionics",
        fl_link:1,
        fl_remote_valid:1,
        fl_rx_hz:SIM_SAMPLE_HZ,
        fl_loss_permille:2,
        fl_peer_age_ms:4,
        data_origin:"simulation"
      };
    }
