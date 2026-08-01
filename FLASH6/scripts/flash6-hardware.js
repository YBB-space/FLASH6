/* FLASH6 hardware status, calibration, and control features. */
    let hardwareControlTargetStage = 1;
    function hardwareControlUsesStageSelector(){
      const groundRole = typeof isFlashLinkGroundUi === "function"
        ? isFlashLinkGroundUi()
        : (typeof normalizeFlashLinkRole === "function" &&
          normalizeFlashLinkRole(uiSettings && uiSettings.flashLinkRole) === "ground");
      return !!(groundRole && uiSettings && uiSettings.flashLinkStage2Mode === true);
    }
    function hardwareControlTargetNode(){
      const groundRole = typeof isFlashLinkGroundUi === "function"
        ? isFlashLinkGroundUi()
        : (typeof normalizeFlashLinkRole === "function" &&
          normalizeFlashLinkRole(uiSettings && uiSettings.flashLinkRole) === "ground");
      if(!groundRole) return 0;
      if(!hardwareControlUsesStageSelector()) return 1;
      return Number(hardwareControlTargetStage) === 2 ? 2 : 1;
    }
    function hardwareControlPathForNode(path, requestedNode){
      const raw = String(path || "");
      const node = Number(requestedNode) === 2 ? 2 : (Number(requestedNode) === 1 ? 1 : 0);
      if(!node || /(?:[?&])node=\d+(?:&|$)/.test(raw)) return raw;
      return raw + (raw.indexOf("?") >= 0 ? "&" : "?") + "node=" + node;
    }
    function hardwareControlPath(path){
      return hardwareControlPathForNode(path, hardwareControlTargetNode());
    }
    function setHardwareControlTargetDisabled(disabled, root){
      const scope = root && typeof root.querySelectorAll === "function" ? root : document;
      scope.querySelectorAll("[data-hardware-target-stage]").forEach((button)=>{
        button.disabled = !!disabled;
      });
    }
    function syncHardwareControlTargetUi(){
      const visible = hardwareControlUsesStageSelector();
      const stage = visible && Number(hardwareControlTargetStage) === 2 ? 2 : 1;
      if(!visible) hardwareControlTargetStage = 1;
      document.querySelectorAll("[data-hardware-target-selector]").forEach((selector)=>{
        selector.hidden = !visible;
        selector.setAttribute("aria-hidden", visible ? "false" : "true");
        selector.querySelectorAll("[data-hardware-target-stage]").forEach((button)=>{
          const active = Number(button.getAttribute("data-hardware-target-stage")) === stage;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-selected", active ? "true" : "false");
        });
      });
    }
    function setHardwareControlTargetStage(stage){
      hardwareControlTargetStage = Number(stage) === 2 && hardwareControlUsesStageSelector() ? 2 : 1;
      syncHardwareControlTargetUi();
    }
    function initializeHardwareControlTargetSelectors(){
      document.querySelectorAll("[data-hardware-target-stage]").forEach((button)=>{
        if(button.dataset.hardwareTargetBound === "1") return;
        button.dataset.hardwareTargetBound = "1";
        button.addEventListener("click", ()=>{
          setHardwareControlTargetStage(button.getAttribute("data-hardware-target-stage"));
          if(el.hardwareServoOverlay && !el.hardwareServoOverlay.classList.contains("hidden")) fetchServoInfo();
        });
      });
      syncHardwareControlTargetUi();
    }
    const findingBuzzerActiveByStage = {1:false, 2:false};
    let findingBuzzerCommandBusy = false;
    function findingBuzzerTargetNode(){
      const role = typeof normalizeFlashLinkRole === "function"
        ? normalizeFlashLinkRole(
            (typeof flashLinkUiRole !== "undefined" && flashLinkUiRole) ||
            (uiSettings && uiSettings.flashLinkRole)
          )
        : "avionics";
      if(role === "ground") return Number(dashboardTelemetryStageId) === 2 ? 2 : 1;
      const localNode = Number(
        (typeof flashLinkUiNodeId !== "undefined" && flashLinkUiNodeId) ||
        (uiSettings && uiSettings.flashLinkNodeId)
      );
      return localNode === 2 ? 2 : 1;
    }
    function setFindingBuzzerPill(node, active, busy){
      if(!node) return;
      node.textContent = busy ? "확인 중" : (active ? "ON" : "OFF");
      node.classList.toggle("pill-green", active && !busy);
      node.classList.toggle("pill-gray", !active || busy);
    }
    function updateFindingBuzzerUi(){
      const stage = findingBuzzerTargetNode();
      const active = !!findingBuzzerActiveByStage[stage];
      if(el.findingBuzzerTarget) el.findingBuzzerTarget.textContent = "STAGE " + stage + " locator";
      if(el.findingBuzzerBtn){
        el.findingBuzzerBtn.classList.toggle("is-active", active);
        el.findingBuzzerBtn.disabled = findingBuzzerCommandBusy;
        el.findingBuzzerBtn.setAttribute("aria-pressed", active ? "true" : "false");
        el.findingBuzzerBtn.setAttribute(
          "aria-label",
          "STAGE " + stage + " 파인딩 버저 " + (active ? "끄기" : "켜기")
        );
      }
      if(el.mobileFindingBuzzerBtn){
        el.mobileFindingBuzzerBtn.classList.toggle("is-active", active);
        el.mobileFindingBuzzerBtn.disabled = findingBuzzerCommandBusy;
        el.mobileFindingBuzzerBtn.setAttribute("aria-pressed", active ? "true" : "false");
      }
      setFindingBuzzerPill(el.findingBuzzerStatus, active, findingBuzzerCommandBusy);
      setFindingBuzzerPill(el.mobileFindingBuzzerStatus, active, findingBuzzerCommandBusy);
    }
    async function toggleFindingBuzzer(){
      if(findingBuzzerCommandBusy) return;
      const stage = findingBuzzerTargetNode();
      const nextActive = !findingBuzzerActiveByStage[stage];
      findingBuzzerCommandBusy = true;
      updateFindingBuzzerUi();
      const result = await sendCommand(
        nextActive
          ? {
              http:"/buzzer?pattern=find&loop=1&node=" + stage,
              ser:"/buzzer?pattern=find&loop=1&node=" + stage
            }
          : {
              http:"/buzzer_stop?node=" + stage,
              ser:"/buzzer_stop?node=" + stage
            },
        true
      );
      findingBuzzerCommandBusy = false;
      if(result && result.ok){
        findingBuzzerActiveByStage[stage] = nextActive;
        showToast(
          "STAGE " + stage + " 파인딩 버저 " + (nextActive ? "작동" : "정지"),
          nextActive ? "info" : "success"
        );
      }else{
        showToast("파인딩 버저 명령을 전송하지 못했습니다.", "error");
      }
      updateFindingBuzzerUi();
    }
    function setQuickItemStatus(targetEl, status){
      if(!targetEl) return;
      const item = targetEl.closest(".item, .status-battery, .status-chiptemp");
      if(!item) return;
      const nextClass = status ? ("status-" + status) : "";
      const prevClass = item.dataset.statusClass || "";
      if(prevClass === nextClass) return;
      item.classList.remove("status-ok","status-warn","status-bad","status-time-ready","status-time-progress");
      if(nextClass) item.classList.add(nextClass);
      item.dataset.statusClass = nextClass;
    }
    function setMotorTimeState(valueEl, state){
      if(!valueEl) return;
      const item = valueEl.closest(".item");
      if(!item) return;
      const nextClass = state ? ("status-time-" + state) : "";
      const prevClass = item.dataset.statusClass || "";
      if(prevClass === nextClass) return;
      item.classList.remove("status-ok","status-warn","status-bad","status-time-ready","status-time-progress");
      if(nextClass) item.classList.add(nextClass);
      item.dataset.statusClass = nextClass;
    }
    function updateStatusMotor(){
      if(!el.statusMotor) return;
      const motorName = (selectedMotorName || (el.missionName && el.missionName.value) || "").trim();
      el.statusMotor.textContent = motorName || "--";
      const testCount = (el.missionTestCount && el.missionTestCount.value && el.missionTestCount.value.trim())
        ? el.missionTestCount.value.trim()
        : "--";
      const grain = (el.missionGrainMass && el.missionGrainMass.value && el.missionGrainMass.value.trim())
        ? (el.missionGrainMass.value.trim() + " g")
        : "--";

      if(el.statusMotorGrain) el.statusMotorGrain.textContent = grain;
      if(el.statusMotorTest) el.statusMotorTest.textContent = testCount;
    }
    function updateMotorInfoPanel(){
      if(!el.batteryStatus || !el.commStatus || !el.motorDelay || !el.motorBurn) return;
      const inFlightMode = isFlightModeUi();
      const delayRaw = ignitionAnalysis ? ignitionAnalysis.delaySec : null;
      const delaySec = (delayRaw != null && isFinite(Number(delayRaw))) ? Number(delayRaw) : NaN;
      const burn = formatQuickTimeDisplay(ignitionAnalysis && ignitionAnalysis.durationSec);
      const deviceUiOnline = isDeviceUiOnline();
      const commText = deviceUiOnline ? "CONNECTED" : "DISCONNECTED";
      const batteryBlocked = !!(latestTelemetry && (latestTelemetry.ic === 1 || latestTelemetry.sw === 1));
      const pctText = batteryBlocked
        ? "N"
        : ((lastBatteryPct != null && isFinite(lastBatteryPct)) ? (Math.round(lastBatteryPct) + "%") : "--%");
      const pctValue = (!batteryBlocked && lastBatteryPct != null && isFinite(lastBatteryPct))
        ? Math.max(0, Math.min(100, Math.round(lastBatteryPct)))
        : null;

      el.batteryStatus.textContent = pctText;
      const nowChipPerfUiMs = Date.now();
      if((nowChipPerfUiMs - chipPerfUiLastUpdateMs) >= 3000){
        chipTempUiDisplayText = (lastChipTempC != null && isFinite(lastChipTempC))
          ? (lastChipTempC.toFixed(1) + "°C")
          : "--°C";
        perfUiDisplayText = (lastPerfLoadPct != null && isFinite(Number(lastPerfLoadPct)))
          ? (Math.round(Number(lastPerfLoadPct)) + "%")
          : "--%";
        chipPerfUiLastUpdateMs = nowChipPerfUiMs;
      }
      if(el.chipTempStatus) el.chipTempStatus.textContent = chipTempUiDisplayText;
      if(el.perfStatus) el.perfStatus.textContent = perfUiDisplayText;
      if(el.mobilePreviewChipTemp) el.mobilePreviewChipTemp.textContent = chipTempUiDisplayText.replace(/°C/i, "").trim() || "--";
      if(el.mobilePreviewPerf) el.mobilePreviewPerf.textContent = perfUiDisplayText.replace(/%/g, "").trim() || "--";
      if(el.mobilePreviewBattery) el.mobilePreviewBattery.textContent = pctText || "--";
      syncStoragePreview();
      el.commStatus.innerHTML = '<span class="num">' + commText + "</span>";
      const delayText = Number.isFinite(delaySec) ? formatQuickTimeDisplay(delaySec) : "--";
      el.motorDelay.innerHTML = '<span class="num">' + delayText + '</span><span class="unit">S</span>';
      if(el.quickMetricDelay){
        el.quickMetricDelay.innerHTML = '<span class="num">' + delayText + '</span><span class="unit">S</span>';
      }
      if(inFlightMode){
        const displayPitchDeg = getGyroDisplayPitchDeg();
        el.motorBurn.innerHTML = formatQuickGyroDeg(displayPitchDeg);
      }else{
        el.motorBurn.innerHTML = '<span class="num">' + burn + '</span><span class="unit">S</span>';
      }
      setMotorTimeState(el.motorDelay, Number.isFinite(delaySec) ? "ready" : null);
      let burnState = null;
      if(!inFlightMode && ignitionAnalysis && ignitionAnalysis.durationSec != null){
        const burnNumeric = Number(ignitionAnalysis.durationSec);
        if(Number.isFinite(burnNumeric)){
          const isBurning = (currentSt === 2);
          const increasing = (lastBurnSeconds != null && burnNumeric > lastBurnSeconds);
          burnState = (isBurning || increasing) ? "progress" : "ready";
          lastBurnSeconds = burnNumeric;
        }else{
          lastBurnSeconds = null;
        }
      }else{
        lastBurnSeconds = null;
      }
      setMotorTimeState(el.motorBurn, burnState);
      if(el.statusBar){
        el.statusBar.classList.toggle("is-online", deviceUiOnline);
        el.statusBar.classList.toggle("is-offline", !deviceUiOnline);
      }
      if(el.connStatusText){
        const flashLinkStatusText = getFlashLinkGroundStatusText();
        if(flashLinkStatusText){
          el.connStatusText.textContent = flashLinkStatusText;
        }else{
          const snapHz = Number(rxHzWindow);
          const hzText = (snapHz > 0 && isFinite(snapHz)) ? (snapHz.toFixed(0) + " Hz") : "-- Hz";
          el.connStatusText.textContent = commText + " · " + hzText;
        }
      }
      if(el.batteryFill){
        const fill = (pctValue == null) ? 35 : Math.max(8, Math.min(88, pctValue));
        el.batteryFill.style.width = fill + "%";
      }

      let batteryState = null;
      if(batteryBlocked) batteryState = "warn";
      else if(lastBatteryPct != null && isFinite(lastBatteryPct)){
        if(lastBatteryPct >= 70) batteryState = "ok";
        else if(lastBatteryPct >= 40) batteryState = "warn";
        else batteryState = "bad";
      }
      let chipTempState = null;
      if(lastChipTempC != null && isFinite(lastChipTempC)){
        if(lastChipTempC >= 75) chipTempState = "bad";
        else if(lastChipTempC >= 60) chipTempState = "warn";
        else chipTempState = "ok";
      }
      let perfState = null;
      if(lastPerfLoadPct != null && isFinite(Number(lastPerfLoadPct))){
        const perfLoad = Number(lastPerfLoadPct);
        if(perfLoad >= 90) perfState = "bad";
        else if(perfLoad >= 70) perfState = "warn";
        else perfState = "ok";
      }
      setQuickItemStatus(el.batteryStatus, batteryState);
      setQuickItemStatus(el.chipTempStatus, chipTempState);
      setQuickItemStatus(el.perfStatus, perfState);
      setQuickItemStatus(el.commStatus, deviceUiOnline ? "ok" : "bad");
      syncMobilePreviewConnectionState();
      updateStatusMotor();
      updateGyroMetaFromMain();
      syncGyroExpandedHud();
      syncStatusMapExpandedHud();
    }
    function getChipTempStateLabel(tempC){
      if(tempC == null || !isFinite(Number(tempC))) return "NO DATA";
      if(Number(tempC) >= 75) return "HOT";
      if(Number(tempC) >= 60) return "WARN";
      return "NORMAL";
    }
    function isChipTempModalVisible(){
      return !!(el.chipTempOverlay && !el.chipTempOverlay.classList.contains("hidden"));
    }
    function renderChipTempModal(force){
      if(!isChipTempModalVisible()) return;
      const nowMs = Date.now();
      const shouldUpdateText = !!force || ((nowMs - chipTempModalLastRenderMs) >= 3000);
      if(shouldUpdateText) chipTempModalLastRenderMs = nowMs;
      const hasValidTemp = lastChipTempSampleMs > 0;
      if(!hasValidTemp){
        if(shouldUpdateText){
          if(el.chipTempNowValue) el.chipTempNowValue.textContent = "--°C";
          if(el.chipTempMinValue) el.chipTempMinValue.textContent = "--°C";
          if(el.chipTempMaxValue) el.chipTempMaxValue.textContent = "--°C";
          if(el.chipTempAvgValue) el.chipTempAvgValue.textContent = "--°C";
          if(el.chipTempStateValue) el.chipTempStateValue.textContent = "NO DATA";
          if(el.chipTempChartNote) el.chipTempChartNote.textContent = "데이터 대기 중";
        }
        drawChart("chipTempChart", [], "#16a34a", {windowMs:30000, startMs:null});
        return;
      }
      const values = [];
      for(let i=0;i<chipTempHistory.length;i++){
        const v = Number(chipTempHistory[i]);
        if(isFinite(v)) values.push(v);
      }
      const current = (lastChipTempC != null && isFinite(Number(lastChipTempC)))
        ? Number(lastChipTempC)
        : (values.length ? Number(values[values.length - 1]) : NaN);
      let min = NaN;
      let max = NaN;
      let avg = NaN;
      if(values.length){
        let sum = 0;
        min = values[0];
        max = values[0];
        for(let i=0;i<values.length;i++){
          const v = values[i];
          sum += v;
          if(v < min) min = v;
          if(v > max) max = v;
        }
        avg = sum / values.length;
      }

      if(shouldUpdateText){
        if(el.chipTempNowValue) el.chipTempNowValue.textContent = isFinite(current) ? (current.toFixed(1) + "°C") : "--°C";
        if(el.chipTempMinValue) el.chipTempMinValue.textContent = isFinite(min) ? (min.toFixed(1) + "°C") : "--°C";
        if(el.chipTempMaxValue) el.chipTempMaxValue.textContent = isFinite(max) ? (max.toFixed(1) + "°C") : "--°C";
        if(el.chipTempAvgValue) el.chipTempAvgValue.textContent = isFinite(avg) ? (avg.toFixed(1) + "°C") : "--°C";
        if(el.chipTempStateValue) el.chipTempStateValue.textContent = getChipTempStateLabel(current);
        if(el.chipTempChartNote){
          el.chipTempChartNote.textContent = "최근 30초 · 35~85°C";
        }
      }
      drawChart(
        "chipTempChart",
        chipTempHistory,
        "#16a34a",
        {windowMs:30000, startMs:null},
        {
          yMin:35,
          yMax:85,
          thresholdLines:[
            {value:60, label:"WARN 60°C", color:"rgba(245,158,11,0.92)"},
            {value:75, label:"HOT 75°C", color:"rgba(239,68,68,0.92)"}
          ]
        }
      );
    }
    function showChipTempModal(){
      hideMobileControlsPanel();
      setOverlayVisible(el.chipTempOverlay, true);
      chipTempModalLastRenderMs = 0;
      if(el.chipTempChart){
        el.chipTempChart._cssW = null;
        el.chipTempChart._cssH = null;
      }
      renderChipTempModal(true);
    }
    function hideChipTempModal(){
      setOverlayVisible(el.chipTempOverlay, false);
    }
    function formatPerfPct(value){
      return (value != null && isFinite(Number(value)))
        ? (Math.round(Number(value)) + "%")
        : "--%";
    }
    function getPerfStateLabel(loadPct){
      if(loadPct == null || !isFinite(Number(loadPct))) return "NO DATA";
      if(Number(loadPct) >= 90) return "CRITICAL";
      if(Number(loadPct) >= 70) return "BUSY";
      return "NORMAL";
    }
    function isPerfModalVisible(){
      return !!(el.perfOverlay && !el.perfOverlay.classList.contains("hidden"));
    }
    function renderPerfModal(force){
      if(!isPerfModalVisible()) return;
      const nowMs = Date.now();
      const shouldUpdateText = !!force || ((nowMs - perfModalLastRenderMs) >= 3000);
      if(shouldUpdateText) perfModalLastRenderMs = nowMs;
      const hasValidPerf = lastPerfSampleMs > 0;
      if(!hasValidPerf){
        if(shouldUpdateText){
          if(el.perfNowValue) el.perfNowValue.textContent = "--%";
          if(el.perfMinValue) el.perfMinValue.textContent = "--%";
          if(el.perfMaxValue) el.perfMaxValue.textContent = "--%";
          if(el.perfAvgValue) el.perfAvgValue.textContent = "--%";
          if(el.perfCpuNow) el.perfCpuNow.textContent = "-- us";
          if(el.perfLoopNow) el.perfLoopNow.textContent = "-- us";
          if(el.perfStateValue) el.perfStateValue.textContent = "NO DATA";
          if(el.perfChartNote) el.perfChartNote.textContent = "데이터 대기 중";
        }
        drawChart("perfChart", [], "#0ea5e9", {windowMs:30000, startMs:null});
        return;
      }

      const values = [];
      for(let i=0;i<perfLoadHistory.length;i++){
        const v = Number(perfLoadHistory[i]);
        if(isFinite(v)) values.push(v);
      }
      const current = (lastPerfLoadPct != null && isFinite(Number(lastPerfLoadPct)))
        ? Number(lastPerfLoadPct)
        : (values.length ? Number(values[values.length - 1]) : NaN);
      const currentRaw = (lastPerfLoadRawPct != null && isFinite(Number(lastPerfLoadRawPct)))
        ? Number(lastPerfLoadRawPct)
        : NaN;
      let min = NaN;
      let max = NaN;
      let avg = NaN;
      if(values.length){
        let sum = 0;
        min = values[0];
        max = values[0];
        for(let i=0;i<values.length;i++){
          const v = values[i];
          sum += v;
          if(v < min) min = v;
          if(v > max) max = v;
        }
        avg = sum / values.length;
      }

      if(shouldUpdateText){
        if(el.perfNowValue){
          const nowText = formatPerfPct(current);
          if(isFinite(currentRaw) && isFinite(current) && Math.abs(currentRaw - current) >= 8){
            el.perfNowValue.textContent = nowText + " (raw " + Math.round(currentRaw) + "%)";
          }else{
            el.perfNowValue.textContent = nowText;
          }
        }
        if(el.perfMinValue) el.perfMinValue.textContent = formatPerfPct(min);
        if(el.perfMaxValue) el.perfMaxValue.textContent = formatPerfPct(max);
        if(el.perfAvgValue) el.perfAvgValue.textContent = formatPerfPct(avg);
        if(el.perfCpuNow) el.perfCpuNow.textContent = (lastPerfCpuUs != null && isFinite(Number(lastPerfCpuUs))) ? (Math.round(Number(lastPerfCpuUs)) + " us") : "-- us";
        if(el.perfLoopNow) el.perfLoopNow.textContent = (lastPerfLoopUs != null && isFinite(Number(lastPerfLoopUs))) ? (Math.round(Number(lastPerfLoopUs)) + " us") : "-- us";
        if(el.perfStateValue) el.perfStateValue.textContent = getPerfStateLabel(current);
        if(el.perfChartNote){
          el.perfChartNote.textContent = "최근 30초 · CPU/LOOP 점유율 (EMA)";
        }
      }
      drawChart(
        "perfChart",
        perfLoadHistory,
        "#0ea5e9",
        {windowMs:30000, startMs:null},
        {
          yMin:0,
          yMax:100,
          thresholdLines:[
            {value:70, label:"WARN 70%", color:"rgba(245,158,11,0.92)"},
            {value:90, label:"CRIT 90%", color:"rgba(239,68,68,0.92)"}
          ]
        }
      );
    }
    function showPerfModal(){
      hideMobileControlsPanel();
      setOverlayVisible(el.perfOverlay, true);
      perfModalLastRenderMs = 0;
      if(el.perfChart){
        el.perfChart._cssW = null;
        el.perfChart._cssH = null;
      }
      renderPerfModal(true);
    }
    function hidePerfModal(){
      setOverlayVisible(el.perfOverlay, false);
    }
    function isLoadcellModalVisible(){
      return !!(el.loadcellOverlay && !el.loadcellOverlay.classList.contains("hidden"));
    }
    function setLoadcellGuideText(text){
      if(el.loadcellGuide) el.loadcellGuide.textContent = String(text || "");
    }
    function setLoadcellActionLabel(btn, text){
      if(!btn) return;
      btn.textContent = String(text || "");
    }
    function setLoadcellActionState(btn, disabled, hidden){
      if(!btn) return;
      btn.disabled = !!disabled;
      btn.hidden = !!hidden;
      btn.style.display = hidden ? "none" : "";
    }
    function updateLoadcellCalibrationCapabilityUi(){
      if(LOADCELL_CALIBRATION_SUPPORTED) return;
      if(el.loadcellCalOpen){
        el.loadcellCalOpen.disabled = true;
        el.loadcellCalOpen.classList.add("disabled");
        el.loadcellCalOpen.setAttribute("aria-disabled", "true");
      }
      if(el.loadcellResetBtn){
        el.loadcellResetBtn.disabled = true;
        el.loadcellResetBtn.classList.add("disabled");
        el.loadcellResetBtn.setAttribute("aria-disabled", "true");
      }
    }
    function clearLoadcellDialogStateClasses(){
      if(!el.loadcellDialog) return;
      el.loadcellDialog.classList.remove("step-input", "step-complete", "show-warning");
    }
    function resetLoadcellStabilityTracking(){
      loadcellStabilitySamples = [];
      loadcellStabilityStartedMs = Date.now();
      loadcellStabilizedAtMs = 0;
      loadcellStabilityFailed = false;
    }
    function updateLoadcellWorkflowUi(){
      clearLoadcellDialogStateClasses();
      if(loadcellModalStage === LOADCELL_MODAL_STAGE_WEIGHT && el.loadcellDialog){
        el.loadcellDialog.classList.add("step-input");
      }else if(loadcellModalStage === LOADCELL_MODAL_STAGE_COMPLETE && el.loadcellDialog){
        el.loadcellDialog.classList.add("step-complete");
      }

      if(loadcellModalStage === LOADCELL_MODAL_STAGE_STABILIZE){
        setLoadcellGuideText(t("loadcellGuideStabilizing"));
        setLoadcellActionLabel(el.loadcellZero, t("loadcellZeroSaveBtn"));
        setLoadcellActionState(el.loadcellZero, loadcellStabilizedAtMs === 0, false);
        setLoadcellActionLabel(el.loadcellApply, t("loadcellModalApply"));
        setLoadcellActionState(el.loadcellApply, true, true);
        setLoadcellActionLabel(el.loadcellCancel, t("loadcellModalCancel"));
        setLoadcellActionState(el.loadcellCancel, false, false);
        return;
      }

      if(loadcellModalStage === LOADCELL_MODAL_STAGE_NOISE){
        setLoadcellGuideText(t("loadcellGuideNoiseReady"));
        setLoadcellActionLabel(el.loadcellZero, t("loadcellNoiseSaveBtn"));
        setLoadcellActionState(el.loadcellZero, false, false);
        setLoadcellActionLabel(el.loadcellApply, t("loadcellModalApply"));
        setLoadcellActionState(el.loadcellApply, true, true);
        setLoadcellActionLabel(el.loadcellCancel, t("loadcellModalCancel"));
        setLoadcellActionState(el.loadcellCancel, false, false);
        return;
      }

      if(loadcellModalStage === LOADCELL_MODAL_STAGE_WEIGHT){
        setLoadcellGuideText(t("loadcellGuidePlaceWeight"));
        setLoadcellActionState(el.loadcellZero, true, true);
        setLoadcellActionLabel(el.loadcellApply, t("loadcellModalApply"));
        const weight = parseFloat(el.loadcellWeightInput ? el.loadcellWeightInput.value : "");
        const invalidWeight = !isFinite(weight) || weight <= 0;
        setLoadcellActionState(el.loadcellApply, invalidWeight, false);
        setLoadcellActionLabel(el.loadcellCancel, t("loadcellModalCancel"));
        setLoadcellActionState(el.loadcellCancel, false, false);
        return;
      }

      if(loadcellModalStage === LOADCELL_MODAL_STAGE_COMPLETE){
        setLoadcellGuideText(t("loadcellGuideComplete"));
        if(el.loadcellCompleteTitle) el.loadcellCompleteTitle.textContent = t("loadcellCompleteTitle");
        if(el.loadcellCompleteText) el.loadcellCompleteText.textContent = t("loadcellCompleteText");
        setLoadcellActionState(el.loadcellZero, true, true);
        setLoadcellActionLabel(el.loadcellApply, t("loadcellCompleteCloseBtn"));
        setLoadcellActionState(el.loadcellApply, false, false);
        setLoadcellActionState(el.loadcellCancel, true, true);
      }
    }
    function setLoadcellWorkflowStage(stage){
      loadcellModalStage = stage;
      updateLoadcellWorkflowUi();
    }
    function startLoadcellStabilizationStep(){
      hideLoadcellWarning();
      resetLoadcellStabilityTracking();
      setLoadcellWorkflowStage(LOADCELL_MODAL_STAGE_STABILIZE);
      const seedValue = loadcellTelemetryHasRaw ? lastLoadcellRaw : lastThrustKgf;
      if(isFinite(Number(seedValue))){
        requestAnimationFrame(()=>updateLoadcellStabilityState(Number(seedValue)));
      }
    }
    function updateLoadcellStabilityState(rawVal){
      if(loadcellModalStage !== LOADCELL_MODAL_STAGE_STABILIZE) return;
      if(!isLoadcellModalVisible() || loadcellWarningMode === "stability") return;
      const now = Date.now();
      const value = Number(rawVal);
      if(!isFinite(value)){
        setLoadcellGuideText(t("loadcellGuideStabilizing"));
        setLoadcellActionState(el.loadcellZero, true, false);
        return;
      }
      if(loadcellTelemetryHasRaw){
        const noRawStream = ((now - loadcellStabilityStartedMs) >= LOADCELL_HZ_FAULT_GRACE_MS) && (!isFinite(lastLoadcellHz) || lastLoadcellHz <= 0);
        if(!lastLoadcellRawValid || lastLoadcellSaturated || noRawStream){
          setLoadcellGuideText(t("loadcellGuideStabilizing"));
          setLoadcellActionState(el.loadcellZero, true, false);
          return;
        }
      }

      loadcellStabilitySamples.push({ts:now, value});
      let staleCount = 0;
      while(staleCount < loadcellStabilitySamples.length &&
            (now - loadcellStabilitySamples[staleCount].ts) > LOADCELL_STABILIZE_WINDOW_MS){
        staleCount++;
      }
      if(staleCount > 0) loadcellStabilitySamples.splice(0, staleCount);

      const elapsedMs = now - loadcellStabilityStartedMs;
      if(loadcellStabilitySamples.length < 3){
        setLoadcellGuideText(t("loadcellGuideStabilizing"));
        setLoadcellActionState(el.loadcellZero, true, false);
        return;
      }
      const stable =
        elapsedMs >= LOADCELL_STABILIZE_MIN_MS &&
        loadcellStabilitySamples.length >= LOADCELL_STABILIZE_MIN_SAMPLES;

      if(stable){
        loadcellStabilizedAtMs = now;
        setLoadcellGuideText(t("loadcellGuideStableReady"));
        setLoadcellActionState(el.loadcellZero, false, false);
        return;
      }

      const remainSec = Math.max(0, (LOADCELL_STABILIZE_MIN_MS - elapsedMs) / 1000);
      if(remainSec > 0.05){
        setLoadcellGuideText(t("loadcellGuideStabilizing") + " (" + remainSec.toFixed(1) + "s)");
      }else{
        setLoadcellGuideText(t("loadcellGuideStabilizing"));
      }
      setLoadcellActionState(el.loadcellZero, true, false);
    }
    function updateLoadcellLiveValue(val, renderUi){
      lastThrustKgf = val;
      const modalDisplayZero = isLoadcellModalVisible() && lastLoadcellOffsetValid === 0;
      const displayValue = modalDisplayZero ? 0 : val;
      if(renderUi !== false && el.loadcellLiveValue){
        if(displayValue == null || !isFinite(displayValue)){
          el.loadcellLiveValue.textContent = "--";
        }else{
          el.loadcellLiveValue.textContent = formatThrustDisplay(displayValue);
        }
      }
      if(isLoadcellModalVisible() && loadcellModalStage === LOADCELL_MODAL_STAGE_STABILIZE){
        updateLoadcellStabilityState(loadcellTelemetryHasRaw ? lastLoadcellRaw : displayValue);
      }
    }
    function parseLoadcellReplyValue(text, key){
      const raw = String(text || "");
      const escaped = String(key || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = raw.match(new RegExp("(?:^|\\s)" + escaped + "\\s*=\\s*([-+]?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)"));
      if(!m) return null;
      const n = Number(m[1]);
      return isFinite(n) ? n : null;
    }
    function estimateLoadcellScale(weight){
      const w = Number(weight);
      if(!(isFinite(w) && w > 0)) return null;
      const currentKgf = Number(lastThrustKgf);
      if(!isFinite(currentKgf)) return null;
      const refScale = (lastLoadcellScale != null && isFinite(lastLoadcellScale))
        ? Number(lastLoadcellScale)
        : LOADCELL_SCALE_FALLBACK;
      if(!(isFinite(refScale) && refScale > 0)) return null;
      const predicted = (currentKgf * refScale) / w;
      return isFinite(predicted) ? predicted : null;
    }
    function updateLoadcellCalcPanel(weight){
      const w = (isFinite(Number(weight)) && Number(weight) > 0) ? Number(weight) : null;
      if(el.loadcellWeightPreview){
        el.loadcellWeightPreview.textContent = (w != null) ? (w.toFixed(3) + " kg") : "--";
      }
      if(el.loadcellScaleValue){
        const saved = (lastLoadcellScale != null && isFinite(lastLoadcellScale)) ? Number(lastLoadcellScale) : null;
        const estimated = (w != null) ? estimateLoadcellScale(w) : null;
        const viewScale = (estimated != null) ? estimated : saved;
        const prefix = (saved == null && estimated != null) ? "~ " : "";
        el.loadcellScaleValue.textContent = (viewScale != null && isFinite(viewScale))
          ? (prefix + Number(viewScale).toFixed(6))
          : "--";
      }
      if(el.loadcellOffsetValue){
        el.loadcellOffsetValue.textContent = (lastLoadcellOffset != null && isFinite(lastLoadcellOffset))
          ? String(Math.round(lastLoadcellOffset))
          : "--";
      }
    }
    function refreshLoadcellInputPreview(){
      const raw = el.loadcellWeightInput ? el.loadcellWeightInput.value : "";
      const weight = parseFloat(raw || "");
      if(isFinite(weight) && weight > 0){
        lastLoadcellCalWeight = weight;
      }
      updateLoadcellCalcPanel(weight);
      if(loadcellModalStage === LOADCELL_MODAL_STAGE_WEIGHT){
        updateLoadcellWorkflowUi();
      }
    }
    function showLoadcellModal(){
      if(!LOADCELL_CALIBRATION_SUPPORTED){
        showToast(t("loadcellUnsupportedToast"), "notice", {key:"loadcell-unsupported"});
        return;
      }
      hideMobileControlsPanel();
      setOverlayVisible(el.loadcellOverlay, true);
      clearLoadcellDialogStateClasses();
      if(el.loadcellWeightInput) el.loadcellWeightInput.value = "";
      pendingLoadcellWeight = null;
      pendingLoadcellZero = false;
      loadcellWarningMode = "";
      const initialDisplayValue = (lastLoadcellOffsetValid === 0) ? 0 : lastThrustKgf;
      updateLoadcellLiveValue(initialDisplayValue);
      updateLoadcellCalcPanel(lastLoadcellCalWeight);
      startLoadcellStabilizationStep();
      requestAnimationFrame(()=>{
        refreshLoadcellInputPreview();
        if(isFinite(Number(initialDisplayValue))){
          updateLoadcellStabilityState(Number(initialDisplayValue));
        }
      });
    }
    function hideLoadcellModal(){
      setOverlayVisible(el.loadcellOverlay, false);
      clearLoadcellDialogStateClasses();
      loadcellWarningMode = "";
      resetLoadcellStabilityTracking();
      loadcellModalStage = LOADCELL_MODAL_STAGE_STABILIZE;
      if(el.loadcellZero){
        el.loadcellZero.hidden = false;
        el.loadcellZero.style.display = "";
      }
      if(el.loadcellApply){
        el.loadcellApply.hidden = false;
        el.loadcellApply.style.display = "";
      }
      if(el.loadcellCancel){
        el.loadcellCancel.hidden = false;
        el.loadcellCancel.style.display = "";
      }
    }
    function hideLoadcellWarning(){
      if(el.loadcellDialog) el.loadcellDialog.classList.remove("show-warning");
      pendingLoadcellZero = false;
      loadcellWarningMode = "";
    }
    async function sendGyroZeroCommand(path){
      if(serialEnabled){
        if(!serialConnected || !serialWriter){
          return {ok:false, reason:"SERIAL_DISCONNECTED"};
        }
        if(!serialTxEnabled){
          return {ok:false, reason:"SERIAL_TX_DISABLED"};
        }
        const waiter = createSerialAckWaiter((evt)=>{
          if(evt.kind === "err") return true;
          if(evt.kind !== "ack") return false;
          const message = String(evt.message || "").toUpperCase();
          // Direct avionics replies with GYRO_ZERO; a ground node only replies
          // GYRO_ZERO_REMOTE after the vehicle has really executed the command.
          return message.indexOf("GYRO_ZERO") === 0;
        }, GYRO_ZERO_SERIAL_REPLY_TIMEOUT_MS);
        try{
          const wrote = await serialWriteLine(path);
          if(!wrote){
            cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
            return { ok:false, reason:"SERIAL_WRITE_FAIL" };
          }
          const reply = await waiter.promise;
          if(reply.ok) return { ok:true, reason:reply.message || "SERIAL_ACK" };
          return { ok:false, reason:reply.message || reply.kind || "SERIAL_FAIL" };
        }catch(e){
          cancelSerialAckWaiter(waiter, "SERIAL_ERROR");
          return { ok:false, reason:(e && e.message) ? e.message : "SERIAL_ERROR" };
        }
      }

      const API_BASE = getApiBaseForCommands();
      const url = (API_BASE ? API_BASE : "") + path;
      const opt = { cache:"no-cache" };
      try{
        const res = await fetch(url, opt);
        if(!res.ok){
          let bodyText = "";
          try{ bodyText = (await res.text()) || ""; }catch(_err){}
          return { ok:false, reason:bodyText.trim() || ("HTTP " + res.status) };
        }
      }catch(e){
        return { ok:false, reason:(e && e.message) ? e.message : "NETWORK_ERROR" };
      }
      return { ok:true, reason:"HTTP" };
    }
    async function sendCalibrationCommand(path, ackPrefix){
      if(serialEnabled){
        if(!serialConnected || !serialWriter){
          return {ok:false, reason:"SERIAL_DISCONNECTED"};
        }
        if(!serialTxEnabled){
          return {ok:false, reason:"SERIAL_TX_DISABLED"};
        }
        const queuedCode = String(ackPrefix || "").toUpperCase() === "BARO_REFERENCE" ? 20 : null;
        const waiter = createSerialAckWaiter((evt)=>{
          if(evt.kind === "err") return true;
          if(evt.kind !== "ack") return false;
          const message = String(evt.message || "").toUpperCase();
          if(message.indexOf(String(ackPrefix || "").toUpperCase()) === 0) return true;
          return queuedCode != null &&
            message.indexOf("FLASH_LINK_COMMAND_QUEUED") === 0 &&
            new RegExp("\\bCODE=" + queuedCode + "(?:\\b|$)").test(message);
        }, GYRO_ZERO_SERIAL_REPLY_TIMEOUT_MS);
        const wrote = await serialWriteLine(path);
        if(!wrote){ cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL"); return {ok:false, reason:"SERIAL_WRITE_FAIL"}; }
        const reply = await waiter.promise;
        return {ok:!!reply.ok, reason:reply.message || reply.kind || "SERIAL_FAIL"};
      }
      try{
        const base = getApiBaseForCommands();
        const res = await fetch((base || "") + path, {cache:"no-store"});
        const text = await res.text();
        return {ok:res.ok, reason:text || ("HTTP " + res.status)};
      }catch(e){ return {ok:false, reason:e && e.message ? e.message : "NETWORK_ERROR"}; }
    }
    async function runIntelligentCalibration(){
      const status = el.intelligentCalibrationStatus;
      const button = el.intelligentCalibrationRunBtn;
      const geo = getLatestIntelligentCalibrationGeo();
      const lat = geo ? Number(geo.lat) : NaN;
      const lon = geo ? Number(geo.lon) : NaN;
      const hasGpsCoords = !!geo && isFinite(lat) && isFinite(lon);
      if(button) button.disabled = true;
      let hpa = null;
      let baroSkippedReason = "";
      try{
        if(hasGpsCoords){
          if(status) status.textContent = "현재 좌표의 해면기압을 조회하는 중…";
          try{
            const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(lat.toFixed(6)) + "&longitude=" + encodeURIComponent(lon.toFixed(6)) + "&current=pressure_msl&timezone=auto";
            const weatherRes = await fetch(weatherUrl, {cache:"no-store"});
            if(!weatherRes.ok) throw new Error("기상 데이터 HTTP " + weatherRes.status);
            const weather = await weatherRes.json();
            hpa = Number(weather && weather.current && weather.current.pressure_msl);
            if(!isFinite(hpa) || hpa < 850 || hpa > 1100) throw new Error("유효한 해면기압을 받지 못했습니다.");
            if(status) status.textContent = "기준기압 " + hpa.toFixed(1) + " hPa 저장 및 자이로 영점 보정 중…";
            const baro = await sendCalibrationCommand("/baro_reference?sea_level_hpa=" + encodeURIComponent(hpa.toFixed(2)), "BARO_REFERENCE");
            if(!baro.ok) throw new Error("기압 기준 저장 실패: " + baro.reason);
          }catch(baroErr){
            hpa = null;
            baroSkippedReason = "기압 데이터를 받아오지 못했습니다: " + (baroErr && baroErr.message ? baroErr.message : "UNKNOWN");
            if(status) status.textContent = "기압 기준은 건너뛰고 자이로 영점을 보정하는 중…";
          }
        }else{
          baroSkippedReason = "GPS가 잡히지 않아 기압 데이터를 받아오지 못했습니다.";
          if(status) status.textContent = "GPS가 잡히지 않았습니다. 기압 기준은 건너뛰고 자이로 영점을 보정하는 중…";
        }
        const gyro = await sendGyroZeroCommand("/gyro_zero?roll=0&pitch=0&yaw=0");
        if(!gyro.ok) throw new Error("자이로 영점 실패: " + gyro.reason);
        clearLocalGyroZeroReference();
        if(hpa != null){
          if(status) status.textContent = "완료 · GPS " + lat.toFixed(5) + ", " + lon.toFixed(5) + " · 기준기압 " + hpa.toFixed(1) + " hPa · 자이로 0°";
          showToast("인텔리전트 캘리브레이션 완료", "success");
        }else{
          if(status) status.textContent = "자이로 영점 완료 · " + baroSkippedReason + " 해면기압 기준을 저장하지 못해 고도 데이터의 신뢰도가 낮아질 수 있습니다.";
          showToast("자이로 영점 완료 · GPS/기압 기준 없음", "warn");
        }
      }catch(e){
        if(status) status.textContent = "실패 · " + (e && e.message ? e.message : "UNKNOWN");
      }finally{ if(button) button.disabled = false; }
    }
    async function sendLoadcellCommand(path, ackPrefix){
      const serialMode = !!serialEnabled;
      if(serialMode){
        if(!serialConnected) return { ok:false, reason:"SERIAL_DISCONNECTED" };
        if(!serialTxEnabled) return { ok:false, reason:"SERIAL_TX_DISABLED" };
        const waiter = createSerialAckWaiter((evt)=>{
          if(evt.kind === "err") return true;
          return evt.kind === "ack" && String(evt.message || "").indexOf(ackPrefix) === 0;
        }, LOADCELL_SERIAL_REPLY_TIMEOUT_MS);
        try{
          const wrote = await serialWriteLine(path);
          if(!wrote){
            cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
            return { ok:false, reason:"SERIAL_WRITE_FAIL" };
          }
          const reply = await waiter.promise;
          if(reply.ok) return { ok:true, reason:reply.message || "SERIAL_ACK" };
          return { ok:false, reason:reply.message || reply.kind || "SERIAL_FAIL" };
        }catch(e){
          cancelSerialAckWaiter(waiter, "SERIAL_ERROR");
          return { ok:false, reason:(e && e.message) ? e.message : "SERIAL_ERROR" };
        }
      }

      const API_BASE = getApiBaseForCommands();
      const url = (API_BASE ? API_BASE : "") + path;
      const opt = { cache:"no-cache" };
      try{
        const res = await fetch(url, opt);
        if(!res.ok){
          let bodyText = "";
          try{ bodyText = (await res.text()) || ""; }catch(_err){}
          return { ok:false, reason:bodyText.trim() || ("HTTP " + res.status) };
        }
      }catch(e){
        return { ok:false, reason:(e && e.message) ? e.message : "NETWORK_ERROR" };
      }
      return { ok:true, reason:"HTTP" };
    }
    async function saveLoadcellCalibration(weight){
      lastLoadcellCalWeight = weight;
      if(simEnabled){
        addLogLine(t("loadcellSaveLog", {weight:weight.toFixed(3)}), "CFG");
        showToast(t("loadcellSaveSuccessToast"), "success");
        updateLoadcellCalcPanel(weight);
        hideLoadcellWarning();
        setLoadcellWorkflowStage(LOADCELL_MODAL_STAGE_COMPLETE);
        return;
      }
      const path = "/loadcell_cal?weight=" + encodeURIComponent(weight);
      const result = await sendLoadcellCommand(path, "SCALE=");
      if(result.ok){
        const nextScale = parseLoadcellReplyValue(result.reason, "SCALE");
        if(nextScale != null) lastLoadcellScale = nextScale;
        addLogLine(t("loadcellSaveLog", {weight:weight.toFixed(3)}), "CFG");
        if(nextScale != null) addLogLine("Loadcell SCALE=" + Number(nextScale).toFixed(6), "CFG");
        showToast(t("loadcellSaveSuccessToast"), "success");
        updateLoadcellCalcPanel(weight);
        hideLoadcellWarning();
        setLoadcellWorkflowStage(LOADCELL_MODAL_STAGE_COMPLETE);
      }else{
        addLogLine("Loadcell calibration failed: " + result.reason, "ERR");
        showToast(t("loadcellSaveFailToast") + " (" + result.reason + ")", "error");
      }
    }
    async function saveLoadcellNoiseZero(){
      if(simEnabled){
        addLogLine(t("loadcellNoiseSaveLog"), "CFG");
        showToast(t("loadcellNoiseSaveSuccessToast"), "success");
        setLoadcellWorkflowStage(LOADCELL_MODAL_STAGE_WEIGHT);
        if(el.loadcellWeightInput) el.loadcellWeightInput.focus();
        return;
      }
      const result = await sendLoadcellCommand("/loadcell_noise_zero", "NOISE=");
      if(result.ok){
        const nextNoise = parseLoadcellReplyValue(result.reason, "NOISE");
        addLogLine(t("loadcellNoiseSaveLog"), "CFG");
        if(nextNoise != null) addLogLine("Loadcell NOISE=" + Number(nextNoise).toFixed(4) + " kg", "CFG");
        showToast(t("loadcellNoiseSaveSuccessToast"), "success");
        setLoadcellWorkflowStage(LOADCELL_MODAL_STAGE_WEIGHT);
        if(el.loadcellWeightInput) el.loadcellWeightInput.focus();
      }else{
        addLogLine("Loadcell noise zero failed: " + result.reason, "ERR");
        showToast(t("loadcellNoiseSaveFailToast") + " (" + result.reason + ")", "error");
      }
    }
    async function saveLoadcellZero(){
      if(simEnabled){
        addLogLine(t("loadcellZeroSaveLog"), "CFG");
        showToast(t("loadcellZeroSaveSuccessToast"), "success");
        updateLoadcellCalcPanel(lastLoadcellCalWeight);
        lastLoadcellOffsetValid = 1;
        setLoadcellWorkflowStage(LOADCELL_MODAL_STAGE_NOISE);
        return;
      }
      const result = await sendLoadcellCommand("/loadcell_zero", "OFFSET=");
      if(result.ok){
        const nextOffset = parseLoadcellReplyValue(result.reason, "OFFSET");
        if(nextOffset != null) lastLoadcellOffset = nextOffset;
        lastLoadcellOffsetValid = 1;
        addLogLine(t("loadcellZeroSaveLog"), "CFG");
        if(nextOffset != null) addLogLine("Loadcell OFFSET=" + Math.round(nextOffset), "CFG");
        showToast(t("loadcellZeroSaveSuccessToast"), "success");
        updateLoadcellCalcPanel(lastLoadcellCalWeight);
        setLoadcellWorkflowStage(LOADCELL_MODAL_STAGE_NOISE);
      }else{
        addLogLine("Loadcell zero failed: " + result.reason, "ERR");
        showToast(t("loadcellZeroSaveFailToast") + " (" + result.reason + ")", "error");
      }
    }
    async function resetLoadcellCalibration(){
      if(!LOADCELL_CALIBRATION_SUPPORTED){
        showToast(t("loadcellUnsupportedToast"), "notice", {key:"loadcell-unsupported"});
        return;
      }
      const applyResetState = ()=>{
        lastLoadcellScale = LOADCELL_SCALE_FALLBACK;
        lastLoadcellOffset = 0;
        lastLoadcellOffsetValid = 0;
        lastLoadcellNoiseDeadband = LOADCELL_NOISE_DB_FALLBACK;
        updateLoadcellCalcPanel(null);
        updateLoadcellLiveValue(0);
      };
      if(simEnabled){
        applyResetState();
        addLogLine(t("loadcellResetLog"), "CFG");
        showToast(t("loadcellResetSuccessToast"), "success");
        return;
      }
      const result = await sendLoadcellCommand("/loadcell_reset", "RESET");
      if(result.ok){
        applyResetState();
        addLogLine(t("loadcellResetLog"), "CFG");
        showToast(t("loadcellResetSuccessToast"), "success");
        setRebootConfirmWaiting();
        await sendCommand({http:"/reset", ser:"/reset"}, true);
      }else{
        addLogLine("Loadcell reset failed: " + result.reason, "ERR");
        showToast(t("loadcellResetFailToast") + " (" + result.reason + ")", "error");
      }
    }
    function setForceSlidePosition(x){
      if(!forceSlideEl || !forceSlideThumbEl) return 0;
      const rect = forceSlideEl.getBoundingClientRect();
      const padding = 3;
      const maxX = Math.max(0, rect.width - forceSlideThumbEl.offsetWidth - padding * 2);
      const clamped = Math.max(0, Math.min(x, maxX));
      forceSlideEl.style.setProperty("--slide-x", clamped + "px");
      const pct = maxX ? (clamped / maxX) * 100 : 0;
      forceSlideEl.style.setProperty("--slide-pct", pct.toFixed(2) + "%");
      return pct;
    }
    function resetForceSlide(){
      if(!forceSlideEl) return;
      forceSlideEl.classList.remove("dragging","unlocked");
      forceSlideEl.style.setProperty("--slide-x", "0px");
      forceSlideEl.style.setProperty("--slide-pct", "0%");
      forceSlideActive = false;
      updateMobileAbortButton();
      forceSlidePointerId = null;
      forceSlideDragOffset = 0;
    }
    function commitForceIgnite(){
      if(!isControlUnlocked()){
        showToast(t("inspectionRequiredShort"), "notice");
        resetForceSlide();
        return;
      }
      hideForceConfirm();
      sendCommand({http:"/force_ignite", ser:"FORCE"}, true);
      suppressIgnitionToastUntil = Date.now() + 3000;
      showToast(t("forceRequestedToast", {safety:safetyLineSuffix()}),"ignite");
    }
    function showForceConfirm(){
      hideMobileControlsPanel();
      if(lockoutLatched){
        showToast(t("lockoutForceDenied"), "error");
        return;
      }
      if(currentSt!==0){
        showToast(t("forceNotAllowed"), "notice");
        return;
      }
      if(isIgniterCheckEnabled() && latestTelemetry.ic !== 1){
        showToast(t("forceIgniterRequired"), "notice");
        return;
      }
      if(!isControlUnlocked() && !loadcellErrorActive){
        showToast(t("inspectionRequiredShort"), "notice");
        return;
      }
      if(el.forceConfirmTitle){
        el.forceConfirmTitle.textContent = loadcellErrorActive ? t("forceLoadcellTitle") : t("forceConfirmTitle");
      }
      if(el.forceConfirmText){
        el.forceConfirmText.innerHTML = loadcellErrorActive ? t("forceLoadcellText") : t("forceConfirmText");
      }
      setOverlayVisible(forceOverlayEl, true);
      resetForceSlide();
      showToast(t("forceWarning", {safety:safetyLineSuffix()}),"warn");
    }
    function hideForceConfirm(){
      setOverlayVisible(forceOverlayEl, false);
      resetForceSlide();
    }
    function closeIgnitionModals(){
      const sequenceModalOpen = !!(confirmOverlayEl && !confirmOverlayEl.classList.contains("hidden"));
      const forceModalOpen = !!(forceOverlayEl && !forceOverlayEl.classList.contains("hidden"));
      if(sequenceModalOpen) hideConfirm();
      if(forceModalOpen) hideForceConfirm();
    }
    function showServoControl(){
      syncHardwareControlTargetUi();
      if(isMobileLayout() && el.mobileControlsPanel){
        hideMobileControlsPanel();
        setLauncherPanelVisible(false);
        setMissionPanelVisible(false);
        setInspectionPanelVisible(false);
        setMobileServoPanelVisible(false);
        if(el.hardwareServoDialog && el.mobileServoPanelMount && el.hardwareServoDialog.parentNode === el.mobileServoPanelMount){
          restoreDialogFromPanel(el.hardwareServoDialog, servoDialogDockState);
        }
        setOverlayVisible(el.hardwareServoOverlay, true);
        fetchServoInfo();
        return;
      }
      setMobileServoPanelVisible(false);
      if(el.hardwareServoDialog && el.mobileServoPanelMount && el.hardwareServoDialog.parentNode === el.mobileServoPanelMount){
        restoreDialogFromPanel(el.hardwareServoDialog, servoDialogDockState);
      }
      setOverlayVisible(el.hardwareServoOverlay, true);
      fetchServoInfo();
    }
    function hideServoControl(){
      if(isMobileServoPanelVisible()){
        setMobileServoPanelVisible(false);
        return;
      }
      setOverlayVisible(el.hardwareServoOverlay, false);
      if(el.hardwareServoDialog && el.mobileServoPanelMount && el.hardwareServoDialog.parentNode === el.mobileServoPanelMount){
        restoreDialogFromPanel(el.hardwareServoDialog, servoDialogDockState);
      }
      updateNavActionState();
    }
    let pyroControlSelectedChannel = 1;
    function syncPyroControlChannelUi(channel){
      pyroControlSelectedChannel = normalizePyroChannel(channel, pyroControlSelectedChannel || 1);
      document.querySelectorAll("[data-pyro-modal-channel]").forEach((button)=>{
        const active = normalizePyroChannel(button.getAttribute("data-pyro-modal-channel"), 1) === pyroControlSelectedChannel;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const channelName = document.getElementById("pyroControlChannelName");
      if(channelName) channelName.textContent = "CH" + pyroControlSelectedChannel;
      if(el.pyroControlRunBtn){
        const label = el.pyroControlRunBtn.querySelector("span");
        if(label) label.textContent = "CH" + pyroControlSelectedChannel + " 동작";
      }
    }
    function syncPyroControlDurationFromHardware(){
      if(!el.pyroControlDurationInput) return;
      const raw = el.hardwarePyroDurationInput ? el.hardwarePyroDurationInput.value : el.pyroControlDurationInput.value;
      let durMs = Math.round(toFiniteNumber(raw, NaN));
      if(!isFinite(durMs)){
        durMs = Math.round(Number((uiSettings && uiSettings.ignDurationMs) || 1000));
      }
      durMs = Math.max(10, Math.min(30000, durMs));
      el.pyroControlDurationInput.value = String(durMs);
      if(el.hardwarePyroDurationInput) el.hardwarePyroDurationInput.value = String(durMs);
    }
    function showPyroControl(){
      syncHardwareControlTargetUi();
      if(isMobileLayout() && el.mobileControlsPanel){
        hideMobileControlsPanel();
      }
      if(el.pyroControlDialog) el.pyroControlDialog.classList.remove("is-confirming");
      syncPyroControlDurationFromHardware();
      syncPyroControlChannelUi(pyroControlSelectedChannel);
      setOverlayVisible(el.pyroControlOverlay, true);
    }
    function hidePyroControl(){
      if(el.pyroControlDialog) el.pyroControlDialog.classList.remove("is-confirming");
      setOverlayVisible(el.pyroControlOverlay, false);
      updateNavActionState();
    }
    function showLauncher(){
      if(isTabletPanelModeBlocked()){
        showTabletPanelBlockedToast("launcher");
        return;
      }
      if(lockoutLatched){
        showToast(t("lockoutControlDenied"), "error");
        return;
      }
      const launcherOperable = canOperateLauncher();
      if(!launcherOperable && safetyModeEnabled){
        showToast(t("safetyModeOnToast"), "notice");
      }
      setMissionPanelVisible(false);
      setInspectionPanelVisible(false);
      setMobileMissionPanelVisible(false);
      setMobileInspectionPanelVisible(false);
      setMobileServoPanelVisible(false);
      if(isMobileLayout()){
        setLauncherPanelVisible(false);
        if(launcherOverlayEl){
          setOverlayVisible(launcherOverlayEl, false);
          launcherOverlayEl.classList.remove("auto-active");
        }
        if(!mobileControlsActive){
          showMobileControlsPanel();
        }
        setMobileLauncherPanelVisible(true);
        return;
      }
      if(isTabletControlsLayout()){
        tabletControlsOpen = true;
        applyTabletControlsLayout();
        setLauncherPanelVisible(true);
        return;
      }
      setLauncherPanelVisible(true);
    }
    function hideLauncher(){
      if(isMobileLauncherPanelVisible()){
        setMobileLauncherPanelVisible(false);
      }
      if(launcherPanelActive){
        setLauncherPanelVisible(false);
        return;
      }
      if(launcherOverlayEl){
        setOverlayVisible(launcherOverlayEl, false);
        launcherOverlayEl.classList.remove("auto-active");
      }
      launcherAutoActive = false;
      launcherPitchEst = null;
      launcherPitchEstMs = 0;
      hideLauncherAutoConfirm();
      stopLauncherHold("up");
      stopLauncherHold("down");
      updateNavActionState();
    }
    function launcherStep(dir){
      sendCommand({http:"/launcher?dir="+dir, ser:"LAUNCHER "+dir.toUpperCase()}, false);
    }
    function startLauncherHold(dir){
      if(lockoutLatched){ showToast(t("lockoutControlDenied"), "error"); return; }
      if(!canOperateLauncher()){
        if(safetyModeEnabled) showToast(t("safetyModeOnToast"), "notice");
        return;
      }
      if(dir==="up"){
        if(!launcherUpHold){
          const dirLabel = t("dirUp");
          addLogLine(t("launcherUpDownLog", {dir:dirLabel}),"LAUNCHER");
          launcherStep("up");
          launcherUpHold=setInterval(()=>launcherStep("up"),200);
        }
      }else{
        if(!launcherDownHold){
          const dirLabel = t("dirDown");
          addLogLine(t("launcherUpDownLog", {dir:dirLabel}),"LAUNCHER");
          launcherStep("down");
          launcherDownHold=setInterval(()=>launcherStep("down"),200);
        }
      }
    }
    function stopLauncherHold(dir){
      if(dir==="up"){
        if(!launcherUpHold) return;
        clearInterval(launcherUpHold);
        launcherUpHold = null;
      }else{
        if(!launcherDownHold) return;
        clearInterval(launcherDownHold);
        launcherDownHold = null;
      }
      if(!launcherUpHold && !launcherDownHold){
        const dirLabel = t("dirStop");
        addLogLine(t("launcherUpDownLog", {dir:dirLabel}),"LAUNCHER");
        sendCommand({http:"/launcher?dir=stop", ser:"LAUNCHER STOP"}, false);
      }
    }

    function startLauncherAuto(){
      if(launcherAutoActive) return;
      launcherAutoActive = true;
      launcherPitchEst = null;
      launcherPitchEstMs = Date.now();
      if(launcherOverlayEl) launcherOverlayEl.classList.add("auto-active");
      addLogLine(t("launcherAutoLog"), "LAUNCHER");
      showToast(t("launcherAutoStartToast"), "info");
      startLauncherHold("up");
    }

    function showLauncherAutoConfirm(){
      hideMobileControlsPanel();
      setOverlayVisible(launcherAutoOverlayEl, true);
    }
    function hideLauncherAutoConfirm(){
      setOverlayVisible(launcherAutoOverlayEl, false);
    }
    function stopRebootRecoveryLoop(){
      if(rebootRecoveryTimer){
        clearTimeout(rebootRecoveryTimer);
        rebootRecoveryTimer = null;
      }
      rebootRecoveryInFlight = false;
      rebootRecoveryReloaded = false;
    }
    function scheduleRebootRecoveryLoop(delayMs){
      if(!rebootConfirmWaiting) return;
      if(rebootRecoveryTimer) return;
      const waitMs = Math.max(120, Number(delayMs) || REBOOT_RECOVERY_POLL_MS);
      rebootRecoveryTimer = setTimeout(()=>{
        rebootRecoveryTimer = null;
        runRebootRecoveryLoop().catch((err)=>{ reportSilentException("reboot-recovery-loop", err); });
      }, waitMs);
    }
    async function pingBoardQuick(timeoutMs){
      const API_BASE = getApiBaseForCommands();
      const url = (API_BASE ? API_BASE : "") + "/ping?_ts=" + Date.now();
      const ctrl = createAbortControllerSafe();
      const timer = ctrl ? setTimeout(()=>{
        try{ ctrl.abort(); }catch(_e){}
      }, Math.max(250, Number(timeoutMs) || REBOOT_RECOVERY_PING_TIMEOUT_MS)) : null;
      try{
        const opt = Object.assign({ cache:"no-cache" }, ctrl ? { signal: ctrl.signal } : {});
        const res = await fetch(url, opt);
        return !!(res && res.ok);
      }catch(_e){
        return false;
      }finally{
        if(timer) clearTimeout(timer);
      }
    }
    function getRebootRecoveryUrl(){
      const API_BASE = getApiBaseForCommands();
      const localBase = (location.origin || "");
      // In embedded app host(localhost/capacitor), keep recovery on local app page.
      // API_BASE there points to board IP and may not host flash6 assets.
      if(isLocalPreviewHost()){
        return localBase + "/flash6.html?recovery=" + Date.now();
      }
      const base = API_BASE ? API_BASE : localBase;
      return base + "/flash6.html?recovery=" + Date.now();
    }
    async function runRebootRecoveryLoop(){
      if(!rebootConfirmWaiting) return;
      if(rebootRecoveryInFlight){
        scheduleRebootRecoveryLoop(REBOOT_RECOVERY_POLL_MS);
        return;
      }
      rebootRecoveryInFlight = true;
      try{
        const now = Date.now();
        const elapsed = rebootConfirmStartedMs > 0 ? (now - rebootConfirmStartedMs) : 0;

        if(elapsed >= REBOOT_WAIT_AUTO_HIDE_MS){
          hideRebootConfirm();
          return;
        }

        if(isUpdating && updateDataStartedMs > 0 && (now - updateDataStartedMs) > UPDATE_DATA_GUARD_TIMEOUT_MS){
          isUpdating = false;
          updateDataStartedMs = 0;
        }

        if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("reboot recovery");

        if(elapsed >= REBOOT_RECOVERY_FIRST_PING_MS){
          const alive = await pingBoardQuick(REBOOT_RECOVERY_PING_TIMEOUT_MS);
          if(alive){
            const socketState = wsSocket ? wsSocket.readyState : WebSocket.CLOSED;
            if(socketState !== WebSocket.OPEN && socketState !== WebSocket.CONNECTING){
              wsRetryMs = 300;
              if(wsRetryTimer){
                clearTimeout(wsRetryTimer);
                wsRetryTimer = null;
              }
              openWebSocket();
            }
            updateData().catch(()=>{});
          }
        }

        if(
          rebootConfirmWaiting &&
          !wsConnected &&
          elapsed >= REBOOT_RECOVERY_HARD_RELOAD_MS &&
          !rebootRecoveryReloaded
        ){
          rebootRecoveryReloaded = true;
          addLogLine("재부팅 후 자동 복구: UI 새로고침 차단, 연결 재시도 유지", "NET");
          showToast("UI 새로고침 없이 보드 재연결을 계속 시도합니다.", "info", {key:"reboot-no-reload", duration:5000});
          scheduleRebootRecoveryLoop(REBOOT_RECOVERY_POLL_MS);
          return;
        }
      }finally{
        rebootRecoveryInFlight = false;
      }
      if(rebootConfirmWaiting){
        scheduleRebootRecoveryLoop(REBOOT_RECOVERY_POLL_MS);
      }
    }
    function updateRebootConfirmUi(){
      const waiting = !!rebootConfirmWaiting;
      if(rebootConfirmTitleEl){
        rebootConfirmTitleEl.textContent = waiting ? t("rebootPendingTitle") : t("rebootConfirmTitle");
      }
      if(rebootConfirmTextEl){
        rebootConfirmTextEl.innerHTML = waiting ? t("rebootPendingText") : t("rebootConfirmText");
      }
      if(rebootConfirmActionsEl){
        rebootConfirmActionsEl.classList.toggle("hidden", waiting);
      }
      if(rebootConfirmOverlayEl){
        rebootConfirmOverlayEl.classList.toggle("is-waiting", waiting);
        setHardwareControlTargetDisabled(waiting, rebootConfirmOverlayEl);
      }
    }
    function showRebootConfirm(){
      hideMobileControlsPanel();
      syncHardwareControlTargetUi();
      stopRebootRecoveryLoop();
      rebootConfirmWaiting = false;
      rebootConfirmStartedMs = 0;
      rebootWaitForRemoteLink = false;
      rebootRemoteLinkDropped = false;
      updateRebootConfirmUi();
      setOverlayVisible(rebootConfirmOverlayEl, true);
    }
    function hideRebootConfirm(){
      stopRebootRecoveryLoop();
      rebootConfirmWaiting = false;
      rebootConfirmStartedMs = 0;
      rebootWaitForRemoteLink = false;
      rebootRemoteLinkDropped = false;
      updateRebootConfirmUi();
      setOverlayVisible(rebootConfirmOverlayEl, false);
    }
    function setRebootConfirmWaiting(){
      stopRebootRecoveryLoop();
      rebootConfirmWaiting = true;
      rebootConfirmStartedMs = Date.now();
      rebootWaitForRemoteLink =
        isFlashLinkGroundUi() || isFlashLinkGroundStorageUi();
      rebootRemoteLinkDropped = false;
      // In A.I LINK ground mode only the selected avionics node reboots.
      // Keep the ground WebSocket alive so the UI can observe link recovery.
      if(!rebootWaitForRemoteLink){
        wsConnected = false;
        closeWsSocketSafe(4003, "avionics reboot");
        if(!wsRetryTimer) scheduleWsReconnect("avionics reboot");
        updateWsUI();
      }
      updateRebootConfirmUi();
      setOverlayVisible(rebootConfirmOverlayEl, true);
      scheduleRebootRecoveryLoop(260);
    }
