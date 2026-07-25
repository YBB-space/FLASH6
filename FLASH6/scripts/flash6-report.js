/* FLASH6 export state and close-guard runtime. */
    function updateExportButtonState(){
      const replayExportable = !!(replayState && Array.isArray(replayState.samples) && replayState.samples.length > 0);
      const ok = hasMissionSelected() || replayExportable;
      [el.exportCsvBtn, el.exportDocxBtn].forEach((button)=>{
        if(!button) return;
        button.disabled = !ok;
        button.classList.toggle("disabled", !ok);
      });
      updateExportGuardUi();
    }
    function flightPhaseCodeFromExportRow(row){
      if(!row || typeof row !== "object") return -1;
      const rawCode = Number(row.flight_phase_code);
      if(Number.isInteger(rawCode) && rawCode >= 0 && rawCode < FLIGHT_PHASE_CODE_NAMES.length){
        return rawCode;
      }
      const name = String(row.flight_phase || "").trim().toUpperCase();
      return FLIGHT_PHASE_CODE_NAMES.indexOf(name);
    }
    function flightPhaseTextFromExportRow(row, language){
      const phaseCode = flightPhaseCodeFromExportRow(row);
      const phaseName = phaseCode >= 0
        ? FLIGHT_PHASE_CODE_NAMES[phaseCode]
        : String((row && row.flight_phase) || "").trim().toUpperCase();
      if(!phaseName) return "";
      if(String(language || currentLang || "ko").toLowerCase() !== "ko") return phaseName;
      const labels = {
        PRE_FLIGHT:"발사 전",
        POWERED_FLIGHT:"추력 비행",
        COASTING:"코스팅",
        DESCENT:"하강",
        LANDED:"착지"
      };
      return labels[phaseName] || phaseName;
    }
    function selectFlightRecordWindow(rows){
      const input = Array.isArray(rows) ? rows.filter(row=>row && typeof row === "object") : [];
      if(!input.length){
        return {
          rows:[], startIndex:-1, endIndex:-1, startReason:"none", landed:false,
          launchElapsedMs:null, launchTimeMs:null
        };
      }
      const finiteBinary = (value)=>{
        if(value == null || value === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? (parsed !== 0 ? 1 : 0) : null;
      };
      const findFallingEdge = (key, rejectLocked)=>{
        let previous = null;
        for(let index=0; index<input.length; index++){
          const current = finiteBinary(input[index][key]);
          if(current == null) continue;
          const locked = rejectLocked && finiteBinary(input[index].al) === 1;
          if(previous === 1 && current === 0 && !locked) return index;
          previous = current;
        }
        return -1;
      };

      const physicalArmOffIndex = findFallingEdge("sp", false);
      const effectiveArmOffIndex = findFallingEdge("s", true);
      let missionTplusIndex = -1;
      let missionLaunchElapsedMs = NaN;
      let missionLaunchTimeMs = NaN;
      for(let index=0; index<input.length; index++){
        const sequenceState = Number(input[index].st);
        const tdMs = Number(input[index].td);
        if(sequenceState !== 3 || !Number.isFinite(tdMs) || tdMs < 0) continue;
        const elapsedMs = Number(input[index].elapsed);
        const timeMs = Date.parse(input[index].time);
        missionTplusIndex = index;
        if(Number.isFinite(elapsedMs)) missionLaunchElapsedMs = elapsedMs - tdMs;
        if(Number.isFinite(timeMs)) missionLaunchTimeMs = timeMs - tdMs;
        break;
      }
      let phaseStartIndex = -1;
      for(let index=0; index<input.length; index++){
        const phaseCode = flightPhaseCodeFromExportRow(input[index]);
        const sequenceState = Number(input[index].st);
        if((phaseCode >= 1 && phaseCode <= 4) || sequenceState === 3){
          phaseStartIndex = index;
          break;
        }
      }

      let startIndex = -1;
      let startReason = "not_detected";
      if(missionTplusIndex >= 0){
        startIndex = missionTplusIndex;
        startReason = "mission_tplus";
        if(Number.isFinite(missionLaunchElapsedMs)){
          for(let index=0; index<input.length; index++){
            const elapsedMs = Number(input[index].elapsed);
            if(Number.isFinite(elapsedMs) && elapsedMs >= missionLaunchElapsedMs){
              startIndex = index;
              break;
            }
          }
        }else if(Number.isFinite(missionLaunchTimeMs)){
          for(let index=0; index<input.length; index++){
            const timeMs = Date.parse(input[index].time);
            if(Number.isFinite(timeMs) && timeMs >= missionLaunchTimeMs){
              startIndex = index;
              break;
            }
          }
        }
      }
      if(startIndex < 0){
        const fallbackCandidates = [
          {index:physicalArmOffIndex, reason:"physical_arm_off"},
          {index:effectiveArmOffIndex, reason:"arm_off"},
          {index:phaseStartIndex, reason:"flight_phase"}
        ].filter((candidate)=>candidate.index >= 0);
        fallbackCandidates.sort((a, b)=>a.index - b.index);
        if(fallbackCandidates.length){
          startIndex = fallbackCandidates[0].index;
          startReason = fallbackCandidates[0].reason;
        }
      }
      if(startIndex < 0){
        return {
          rows:[], startIndex:-1, endIndex:-1, startReason:"not_detected", landed:false,
          launchElapsedMs:null, launchTimeMs:null
        };
      }

      const fallbackLaunchRow = input[startIndex] || {};
      const fallbackLaunchElapsedMs = Number(fallbackLaunchRow.elapsed);
      const fallbackLaunchTimeMs = Date.parse(fallbackLaunchRow.time);
      const launchElapsedMs = Number.isFinite(missionLaunchElapsedMs)
        ? missionLaunchElapsedMs
        : (Number.isFinite(fallbackLaunchElapsedMs) ? fallbackLaunchElapsedMs : null);
      const launchTimeMs = Number.isFinite(missionLaunchTimeMs)
        ? missionLaunchTimeMs
        : (Number.isFinite(fallbackLaunchTimeMs) ? fallbackLaunchTimeMs : null);

      let endIndex = input.length - 1;
      let landed = false;
      for(let index=startIndex; index<input.length; index++){
        if(flightPhaseCodeFromExportRow(input[index]) === 4){
          endIndex = index;
          landed = true;
          break;
        }
      }
      return {
        rows:input.slice(startIndex, endIndex + 1),
        startIndex,
        endIndex,
        startReason,
        landed,
        launchElapsedMs,
        launchTimeMs
      };
    }
    function buildStoredFlightEventRows(sourceRows, flightWindow){
      const rows = [[t("hdrTimeIso"), "T_PLUS", t("hdrTag"), t("hdrMessage")]];
      const source = Array.isArray(sourceRows) ? sourceRows : [];
      if(!flightWindow || flightWindow.startIndex < 0 || !source.length) return rows;
      const startIndex = Math.max(0, flightWindow.startIndex);
      const endIndex = Math.min(source.length - 1, flightWindow.endIndex);
      const launchRow = source[startIndex] || {};
      const windowLaunchElapsedMs = flightWindow.launchElapsedMs != null
        ? Number(flightWindow.launchElapsedMs)
        : NaN;
      const windowLaunchTimeMs = flightWindow.launchTimeMs != null
        ? Number(flightWindow.launchTimeMs)
        : NaN;
      const launchElapsedMs = isFinite(windowLaunchElapsedMs)
        ? windowLaunchElapsedMs
        : Number(launchRow.elapsed);
      const launchTimeMs = isFinite(windowLaunchTimeMs)
        ? windowLaunchTimeMs
        : Date.parse(launchRow.time);
      const phaseLabels = {
        PRE_FLIGHT:"발사 전",
        POWERED_FLIGHT:"추력 비행",
        COASTING:"코스팅",
        DESCENT:"하강",
        LANDED:"착지"
      };
      const sequenceLabels = {
        0:"대기",
        1:"카운트다운",
        2:"점화",
        3:"비행 시퀀스"
      };
      const binary = (value)=>{
        if(value == null || value === "") return null;
        const number = Number(value);
        return isFinite(number) ? (number ? 1 : 0) : null;
      };
      const eventKeys = new Set();
      const formatTPlus = (row)=>{
        const elapsedMs = Number(row && row.elapsed);
        const rowTimeMs = Date.parse(row && row.time);
        let relativeMs = NaN;
        if(isFinite(elapsedMs) && isFinite(launchElapsedMs)){
          relativeMs = elapsedMs - launchElapsedMs;
        }else if(isFinite(rowTimeMs) && isFinite(launchTimeMs)){
          relativeMs = rowTimeMs - launchTimeMs;
        }
        if(!isFinite(relativeMs)) return "";
        const clampedMs = Math.max(0, Math.round(relativeMs));
        const minutes = Math.floor(clampedMs / 60000);
        const seconds = Math.floor((clampedMs % 60000) / 1000);
        const milliseconds = clampedMs % 1000;
        return "T+" + String(minutes).padStart(2, "0") + ":" +
          String(seconds).padStart(2, "0") + "." + String(milliseconds).padStart(3, "0");
      };
      const shiftEventRow = (row, deltaMs)=>{
        const shifted = Object.assign({}, row || {});
        const elapsedMs = Number(shifted.elapsed);
        if(isFinite(elapsedMs)) shifted.elapsed = Math.max(0, elapsedMs + deltaMs);
        const timeMs = Date.parse(shifted.time);
        if(isFinite(timeMs)) shifted.time = new Date(timeMs + deltaMs).toISOString();
        return shifted;
      };
      let primaryDeploymentLogged = false;
      const append = (row, tag, message, uniqueKey)=>{
        const time = row && row.time ? row.time : "";
        const key = uniqueKey || (time + "|" + tag + "|" + message);
        if(eventKeys.has(key)) return;
        eventKeys.add(key);
        rows.push([time, formatTPlus(row), tag, message]);
      };
      let previous = startIndex > 0 ? source[startIndex - 1] : null;
      for(let index=startIndex; index<=endIndex; index++){
        const row = source[index];
        if(!row) continue;
        const previousPhysical = binary(previous && previous.sp);
        const currentPhysical = binary(row.sp);
        const previousEffective = binary(previous && previous.s);
        const currentEffective = binary(row.s);
        if(previousPhysical === 1 && currentPhysical === 0){
          append(row, "ARM", "발사대 분리 감지 (ARM OFF)", "arm-physical-off");
        }else if(previousPhysical == null && previousEffective === 1 && currentEffective === 0){
          append(row, "ARM", "ARM OFF 감지", "arm-effective-off");
        }

        const phaseCode = flightPhaseCodeFromExportRow(row);
        const previousPhaseCode = flightPhaseCodeFromExportRow(previous);
        if(phaseCode >= 0 && phaseCode !== previousPhaseCode){
          const phaseName = FLIGHT_PHASE_CODE_NAMES[phaseCode] || String(row.flight_phase || "");
          append(row, "FLIGHT_PHASE", (phaseLabels[phaseName] || phaseName) + " 진입", "phase-" + phaseCode);
        }

        const state = Number(row.st);
        const previousState = Number(previous && previous.st);
        if(isFinite(state) && state !== previousState && sequenceLabels[state]){
          append(row, "SEQUENCE", sequenceLabels[state] + " 상태 진입", "sequence-" + state + "-" + index);
        }

        const relayMask = Number(row.r);
        const previousRelayMask = Number(previous && previous.r);
        if(isFinite(relayMask) && isFinite(previousRelayMask) && relayMask !== previousRelayMask){
          append(
            row,
            "PYRO",
            relayMask ? ("파이로 출력 ON (mask " + relayMask + ")") : "파이로 출력 OFF",
            "relay-" + index + "-" + relayMask
          );
        }

        const storedEvents = Array.isArray(row.mission_alarm_events) ? row.mission_alarm_events : [];
        const deploymentState = Number(row.deployment_state);
        const previousDeploymentState = Number(previous && previous.deployment_state);
        const deploymentFlags = Number(row.deployment_flags) || 0;
        const previousDeploymentFlags = Number(previous && previous.deployment_flags) || 0;
        const primaryAlarmDetected = missionAlarmSignalsPrimaryDeployment({mission_alarm_events:storedEvents});
        const secondaryAlarmDetected = missionAlarmSignalsSecondaryDeployment({mission_alarm_events:storedEvents});
        const primaryStateEntered = isFinite(deploymentState) && deploymentState >= 2 &&
          (!isFinite(previousDeploymentState) || previousDeploymentState < 2);
        const secondaryStateEntered = isFinite(deploymentState) && deploymentState >= 3 &&
          (!isFinite(previousDeploymentState) || previousDeploymentState < 3);
        const secondaryFlagEntered = (deploymentFlags & (1 << 5)) !== 0 &&
          (previousDeploymentFlags & (1 << 5)) === 0;
        if(primaryStateEntered || primaryAlarmDetected){
          const primaryFailed = (deploymentFlags & (1 << 3)) !== 0;
          const inferredFromSecondary = !primaryDeploymentLogged && !primaryAlarmDetected &&
            secondaryAlarmDetected && deploymentState >= 3 &&
            (!isFinite(previousDeploymentState) || previousDeploymentState < 2);
          const primaryEventRow = inferredFromSecondary ? shiftEventRow(row, -1000) : row;
          append(
            primaryEventRow,
            "STAGE_SEPARATION",
            primaryFailed
              ? "단분리 명령 실패 (서보 CH1)"
              : (inferredFromSecondary
                ? "단분리 실행 (서보 CH1 85° · CH2 시점에서 1초 역산)"
                : "단분리 실행 (서보 CH1 85°)"),
            "stage-separation-ch1"
          );
          primaryDeploymentLogged = true;
        }
        if(secondaryStateEntered || secondaryFlagEntered || secondaryAlarmDetected){
          const secondaryFailed = (deploymentFlags & (1 << 6)) !== 0;
          append(
            row,
            "SECONDARY_DEPLOYMENT",
            secondaryFailed ? "사출 명령 실패 (서보 CH2)" : "사출 실행 (서보 CH2 85°)",
            "secondary-deployment-ch2"
          );
        }
        for(const storedEvent of storedEvents){
          const seq = Number(storedEvent && storedEvent.seq);
          const title = normalizeMissionAlarmTitle(storedEvent && storedEvent.title) || "미션 알람";
          const message = normalizeMissionAlarmMessage(storedEvent && storedEvent.message) || "미션 알람";
          append(
            row,
            "MISSION_ALARM",
            title + ": " + message,
            isFinite(seq) && seq > 0 ? ("mission-alarm-" + seq) : null
          );
        }
        previous = row;
      }
      return rows;
    }
    function isReportExportedUpToDate(){
      return !!reportExportedOnce;
    }
    function shouldWarnBeforeClose(){
      return !!(!uiSettings || uiSettings.refreshGuard !== false);
    }
    function blockUiRefreshShortcut(ev){
      if(uiSettings && uiSettings.refreshGuard === false) return;
      if(!ev) return;
      const key = String(ev.key || "").toLowerCase();
      const refreshKey = key === "f5" || ((ev.ctrlKey || ev.metaKey) && key === "r");
      if(!refreshKey) return;
      ev.preventDefault();
      ev.stopPropagation();
      showToast(t("refreshGuardBlockedToast"), "warn", {key:"ui-refresh-blocked", duration:3000});
    }
    function updateExportGuardUi(){
      if(el.exportPendingBadge){
        el.exportPendingBadge.classList.remove("hidden");
        const exported = isReportExportedUpToDate();
        el.exportPendingBadge.classList.toggle("is-exported", exported);
        el.exportPendingBadge.textContent = exported ? t("exportDoneBadge") : t("exportPendingBadge");
        el.exportPendingBadge.setAttribute("aria-hidden", "false");
      }
    }
    function hideExportLeaveOverlay(){
      pendingExportLeaveAction = null;
      if(el.exportLeaveOverlay){
        setOverlayVisible(el.exportLeaveOverlay, false);
      }
    }
    function confirmLeaveWithExportGuard(){
      const action = pendingExportLeaveAction;
      pendingExportLeaveAction = null;
      if(el.exportLeaveOverlay){
        setOverlayVisible(el.exportLeaveOverlay, false);
      }
      if(action) action();
    }
    function handleBeforeUnload(ev){
      if(!shouldWarnBeforeClose()) return;
      const msg = t("exportBeforeCloseConfirm");
      ev.preventDefault();
      ev.returnValue = msg;
      return msg;
    }
/* FLASH6 report, workbook, and document export runtime. */
    // =====================
    // XLSX 유틸 (멀티 시트)
    // =====================
    function isNativeCapacitorApp(){
      try{
        const cap = (typeof window !== "undefined") ? window.Capacitor : null;
        if(!cap) return false;
        if(typeof cap.isNativePlatform === "function") return !!cap.isNativePlatform();
        if(typeof cap.getPlatform === "function"){
          const platform = String(cap.getPlatform() || "").toLowerCase();
          return platform === "ios" || platform === "android";
        }
      }catch(_e){}
      return false;
    }
    function blobToBase64Payload(blob){
      return new Promise((resolve, reject)=>{
        try{
          const reader = new FileReader();
          reader.onload = ()=>{
            const result = String(reader.result || "");
            const comma = result.indexOf(",");
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
          };
          reader.onerror = ()=>reject(reader.error || new Error("FILE_READ_FAIL"));
          reader.readAsDataURL(blob);
        }catch(err){
          reject(err);
        }
      });
    }
    function triggerBrowserDownload(blob, filename){
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      if(isMobileLayout()){
        a.target = "_blank";
        a.rel = "noopener";
      }
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_e){} }, 30000);
    }
    function tryWebShareFile(blob, filename){
      try{
        if(!isMobileLayout()) return false;
        if(!navigator || typeof navigator.share !== "function" || typeof File === "undefined") return false;
        const file = new File([blob], filename, {type:blob.type || "application/octet-stream"});
        if(navigator.canShare && !navigator.canShare({files:[file]})) return false;
        navigator.share({
          title:filename,
          text:"ALTIS 보고서",
          files:[file]
        }).catch((err)=>{
          const msg = String((err && err.message) || err || "");
          if(msg.toLowerCase().indexOf("cancel") < 0){
            triggerBrowserDownload(blob, filename);
          }
        });
        return true;
      }catch(_e){
        return false;
      }
    }
    function tryNativeShareFile(blob, filename){
      if(!isNativeCapacitorApp()) return false;
      const cap = (typeof window !== "undefined") ? window.Capacitor : null;
      const plugins = cap && cap.Plugins ? cap.Plugins : {};
      const Filesystem = plugins.Filesystem;
      const Share = plugins.Share;
      if(!Filesystem || !Share || typeof Filesystem.writeFile !== "function" || typeof Share.share !== "function") return false;
      (async()=>{
        try{
          const safeFilename = String(filename || "altis_report.bin").replace(/[\\/:*?"<>|]+/g, "_");
          const data = await blobToBase64Payload(blob);
          const written = await Filesystem.writeFile({
            path:"reports/" + safeFilename,
            data,
            directory:"DOCUMENTS",
            recursive:true
          });
          const uri = written && (written.uri || written.path);
          await Share.share({
            title:safeFilename,
            text:"ALTIS 보고서 파일입니다. '파일에 저장'을 선택하면 iPhone Files 앱에 저장됩니다.",
            url:uri,
            dialogTitle:"보고서 저장/공유"
          });
        }catch(err){
          const msg = String((err && err.message) || err || "");
          if(msg.toLowerCase().indexOf("cancel") >= 0) return;
          reportSilentException("native-report-share", err);
          showToast("네이티브 저장을 열 수 없어 브라우저 다운로드로 전환합니다.", "notice", {key:"native-report-fallback"});
          triggerBrowserDownload(blob, filename);
        }
      })();
      return true;
    }
    function downloadBlobAsFile(blob, filename){
      if(tryNativeShareFile(blob, filename)) return;
      if(tryWebShareFile(blob, filename)) return;
      triggerBrowserDownload(blob, filename);
    }
    function requireFlash6ExportHelper(name){
      const api = (typeof window !== "undefined") ? window.FLASH6_EXPORT : null;
      const fn = api && api[name];
      if(typeof fn !== "function"){
        throw new Error("FLASH6 export helper missing: " + name);
      }
      return fn;
    }
    function buildZip(files){
      return requireFlash6ExportHelper("buildZip")(files);
    }
    function buildXlsxBytes(sheets, chart){
      return requireFlash6ExportHelper("buildXlsxBytes")(sheets, chart);
    }
    function buildDocxBytes(report){
      return requireFlash6ExportHelper("buildDocxBytes")(report);
    }
    function canvasPngBytes(canvas){
      if(!canvas || typeof canvas.toDataURL !== "function") return null;
      try{
        const dataUrl = canvas.toDataURL("image/png");
        const comma = dataUrl.indexOf(",");
        if(comma < 0) return null;
        const binary = atob(dataUrl.slice(comma + 1));
        const bytes = new Uint8Array(binary.length);
        for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xFF;
        return bytes;
      }catch(_err){
        return null;
      }
    }
    function buildTrajectoryScalarSpeedSeries(points, verticalSpeedValues){
      const sourcePoints = Array.isArray(points) ? points : [];
      const verticalSpeeds = Array.isArray(verticalSpeedValues) ? verticalSpeedValues : [];
      return sourcePoints.map((point, index)=>{
        const horizontalSpeedMps = Number(point && point.horizontalSpeedMps);
        const fusedVerticalSpeedMps = Number(point && point.verticalSpeedMps);
        const sourceIndex = Number(point && point.sourceIndex);
        const fallbackVerticalSpeedMps = Number(
          verticalSpeeds[Number.isInteger(sourceIndex) ? sourceIndex : index]
        );
        const verticalSpeedMps = isFinite(fusedVerticalSpeedMps)
          ? fusedVerticalSpeedMps
          : fallbackVerticalSpeedMps;
        const hasHorizontal = isFinite(horizontalSpeedMps) && horizontalSpeedMps >= 0;
        const hasVertical = isFinite(verticalSpeedMps);
        if(hasHorizontal && hasVertical){
          return Math.hypot(horizontalSpeedMps, verticalSpeedMps);
        }
        if(hasHorizontal) return horizontalSpeedMps;
        if(hasVertical) return Math.abs(verticalSpeedMps);
        return NaN;
      });
    }
    function selectReportScalarSpeedMps(
      recordedSpeedMps,
      estimatedSpeedMps,
      recordedSpeedIsTrusted
    ){
      const recorded = Number(recordedSpeedMps);
      if(recordedSpeedIsTrusted && isFinite(recorded)){
        return Math.max(0, recorded);
      }
      const estimated = Number(estimatedSpeedMps);
      return isFinite(estimated) ? Math.max(0, estimated) : NaN;
    }
    function updateReportVerticalSpeedMps(
      previousSpeedMps,
      verticalAccelMps2,
      barometricSpeedMps,
      dtSec,
      options
    ){
      const previous = isFinite(Number(previousSpeedMps))
        ? Number(previousSpeedMps)
        : 0;
      const dt = Math.max(0.001, Math.min(0.05, Number(dtSec) || 0.01));
      const settings = options || {};
      const powered = !!settings.powered;
      const coastingAscent = !!settings.coastingAscent && previous > 0;
      const established = !!settings.established;
      const accel = clampLocal(Number(verticalAccelMps2) || 0, -30, 30);
      let candidate = previous + (accel * dt);
      const barometric = Number(barometricSpeedMps);
      if(isFinite(barometric)){
        let target = clampLocal(barometric, -120, 120);
        const currentAltitudeM = Number(settings.currentAltitudeM);
        const apogeeAltitudeM = Number(settings.apogeeAltitudeM);
        if(
          settings.hasFutureApogee &&
          powered &&
          target > 0 &&
          isFinite(currentAltitudeM) &&
          isFinite(apogeeAltitudeM) &&
          apogeeAltitudeM > currentAltitudeM
        ){
          // A model rocket cannot retain more vertical kinetic energy than its
          // remaining climb can absorb. The margin covers aerodynamic drag,
          // pressure lag, and thrust that is still active.
          const remainingHeightM = Math.max(0, apogeeAltitudeM - currentAltitudeM);
          const energyFactor = 1.30;
          const energyMarginMps = 4.0;
          const energyLimitMps =
            (Math.sqrt(2 * GYRO_IMU_GRAVITY_MPS2 * remainingHeightM) * energyFactor) +
            energyMarginMps;
          target = Math.min(target, energyLimitMps);
        }
        const correctionAlpha = 1 - Math.exp(-dt / 0.32);
        candidate += (target - candidate) * correctionAlpha;
        if(established){
          const leadLimitMps = powered ? 5 : 3;
          candidate = clampLocal(
            candidate,
            target - leadLimitMps,
            target + leadLimitMps
          );
        }
      }
      if(coastingAscent){
        // After burnout the upward component must lose at least gravity every
        // second; aerodynamic drag only increases that deceleration. This
        // prevents a delayed/noisy barometric rise from freezing the estimate
        // at burnout speed.
        candidate = Math.min(
          candidate,
          previous - (GYRO_IMU_GRAVITY_MPS2 * dt)
        );
      }
      const riseRateMps2 = coastingAscent ? 0 : (powered ? 45 : 28);
      const fallRateMps2 = powered ? 45 : 35;
      return previous + clampLocal(
        candidate - previous,
        -fallRateMps2 * dt,
        riseRateMps2 * dt
      );
    }
    function getMetricTrajectoryProjectionScale(horizontalSpanM, altitudeSpanM){
      const horizontalSpan = Math.max(2, Number(horizontalSpanM) || 0);
      const altitudeSpan = Math.max(1, Number(altitudeSpanM) || 0);
      const horizontalFitScale = 720 / (horizontalSpan * 1.42);
      const altitudeFitScale = 500 / altitudeSpan;
      // X/Z and altitude must share one metres-to-pixels scale. Fitting each
      // axis independently makes a 30-40 m drift look almost as wide as a
      // 140 m ascent, even though the reconstructed coordinates are modest.
      return Math.min(horizontalFitScale, altitudeFitScale);
    }
    function buildFlightTrajectory3dArtifact(
      rows,
      altitudeValues,
      launchTimeIso,
      launchReferenceElapsedSec,
      verticalSpeedValues
    ){
      const sourceRows = Array.isArray(rows) ? rows : [];
      const altitudes = Array.isArray(altitudeValues) ? altitudeValues : [];
      const verticalSpeeds = Array.isArray(verticalSpeedValues) ? verticalSpeedValues : [];
      const rawPoints = [];
      let baseLat = NaN;
      let baseLon = NaN;
      let startTimeMs = NaN;
      for(let index = 0; index < sourceRows.length; index++){
        const row = sourceRows[index] || {};
        const altitudeM = Number(altitudes[index]);
        if(!isFinite(altitudeM)) continue;
        const lat = Number(row.gps_lat);
        const lon = Number(row.gps_lon);
        const gpsFix = Number(row.gps_fix);
        const gpsFixValid = !isFinite(gpsFix) || gpsFix !== 0;
        const validGps = gpsFixValid && isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
        const rowTimeMs = Date.parse(row.time);
        if(!isFinite(startTimeMs) && isFinite(rowTimeMs)) startTimeMs = rowTimeMs;
        const elapsedSec = row.elapsed != null && isFinite(Number(row.elapsed))
          ? Number(row.elapsed) / 1000
          : (isFinite(rowTimeMs) && isFinite(startTimeMs) ? (rowTimeMs - startTimeMs) / 1000 : index * 0.01);
        const gpsAgeMs = Number(row.gps_age_ms);
        const gpsMeasurementElapsedSec = validGps && isFinite(gpsAgeMs) && gpsAgeMs >= 0 && gpsAgeMs <= 5000
          ? elapsedSec - (gpsAgeMs / 1000)
          : elapsedSec;
        rawPoints.push({
          pointIndex:rawPoints.length,
          sourceIndex:index,
          elapsedSec,
          altitudeM,
          lat:validGps ? lat : NaN,
          lon:validGps ? lon : NaN,
          gpsAgeMs:isFinite(gpsAgeMs) ? gpsAgeMs : NaN,
          gpsMeasurementElapsedSec,
          gpsAccuracyM:Number(
            row.gps_accuracy_m ?? row.gpsAccuracyM ??
            (isFinite(Number(row.gps_hdop)) ? Number(row.gps_hdop) * 2.4 : NaN)
          ),
          ax:Number(row.ax),
          ay:Number(row.ay),
          az:Number(row.az),
          gx:Number(row.gx),
          gy:Number(row.gy),
          gz:Number(row.gz),
          flightPhaseCode:flightPhaseCodeFromExportRow(row),
          deploymentState:Number(row.deployment_state),
          deploymentFlags:Number(row.deployment_flags) || 0,
          missionAlarmEvents:Array.isArray(row.mission_alarm_events) ? row.mission_alarm_events : [],
          horizontalSpeedMps:NaN,
          verticalSpeedMps:NaN
        });
      }

      const gpsFixes = [];
      let previousGpsPoint = null;
      let lastGpsFixElapsedSec = -Infinity;
      rawPoints.forEach((point, index)=>{
        if(!isFinite(point.lat) || !isFinite(point.lon)) return;
        const previous = gpsFixes.length ? gpsFixes[gpsFixes.length - 1] : null;
        const coordinateChanged = !previous ||
          Math.abs(point.lat - previous.lat) > 1e-10 ||
          Math.abs(point.lon - previous.lon) > 1e-10;
        const ageReset = previousGpsPoint &&
          isFinite(previousGpsPoint.gpsAgeMs) && isFinite(point.gpsAgeMs) &&
          (previousGpsPoint.gpsAgeMs - point.gpsAgeMs) >= 3;
        const fixTimeSeparated = (point.gpsMeasurementElapsedSec - lastGpsFixElapsedSec) >= 0.04;
        previousGpsPoint = point;
        if(!coordinateChanged && !(ageReset && fixTimeSeparated)) return;
        gpsFixes.push({
          index,
          lat:point.lat,
          lon:point.lon,
          elapsedSec:point.gpsMeasurementElapsedSec
        });
        lastGpsFixElapsedSec = point.gpsMeasurementElapsedSec;
      });
      let previousSyncedFixIndex = 0;
      gpsFixes.forEach((fix)=>{
        let syncedIndex = previousSyncedFixIndex;
        let bestDistance = Infinity;
        for(let index = previousSyncedFixIndex; index < rawPoints.length; index++){
          const distance = Math.abs(rawPoints[index].elapsedSec - fix.elapsedSec);
          if(distance <= bestDistance){
            bestDistance = distance;
            syncedIndex = index;
            continue;
          }
          break;
        }
        fix.index = syncedIndex;
        previousSyncedFixIndex = syncedIndex;
      });
      if(gpsFixes.length){
        baseLat = gpsFixes[0].lat;
        baseLon = gpsFixes[0].lon;
        for(let index = 0; index <= gpsFixes[0].index; index++){
          rawPoints[index].lat = gpsFixes[0].lat;
          rawPoints[index].lon = gpsFixes[0].lon;
        }
        for(let fixIndex = 1; fixIndex < gpsFixes.length; fixIndex++){
          const previous = gpsFixes[fixIndex - 1];
          const current = gpsFixes[fixIndex];
          const timeSpan = current.elapsedSec - previous.elapsedSec;
          const indexSpan = Math.max(1, current.index - previous.index);
          for(let pointIndex = previous.index; pointIndex <= current.index; pointIndex++){
            const point = rawPoints[pointIndex];
            const timeRatio = timeSpan > 0
              ? (point.elapsedSec - previous.elapsedSec) / timeSpan
              : (pointIndex - previous.index) / indexSpan;
            const ratio = Math.max(0, Math.min(1, timeRatio));
            point.lat = previous.lat + ((current.lat - previous.lat) * ratio);
            point.lon = previous.lon + ((current.lon - previous.lon) * ratio);
          }
        }
        const lastFix = gpsFixes[gpsFixes.length - 1];
        for(let index = lastFix.index; index < rawPoints.length; index++){
          rawPoints[index].lat = lastFix.lat;
          rawPoints[index].lon = lastFix.lon;
        }
      }

      const gpsAvailable = isFinite(baseLat) && isFinite(baseLon);
      // GPS east/north coordinates never define the path shape or heading:
      // typical 1 Hz fixes and multipath jumps create false loops when
      // interpolated across a short flight. Only the accepted scalar distance
      // envelope is used later as a sanity observation for local IMU range.
      const useGpsForTrajectory = false;
      const metersPerLon = gpsAvailable ? 111320 * Math.cos(baseLat * DEG_TO_RAD) : 1;
      let sharedApogeePointIndex = 0;
      let sharedApogeeAltitudeM = -Infinity;
      rawPoints.forEach((point, index)=>{
        if(point.altitudeM > sharedApogeeAltitudeM){
          sharedApogeeAltitudeM = point.altitudeM;
          sharedApogeePointIndex = index;
        }
      });
      let sharedVerticalSpeedMps = 0;
      rawPoints.forEach((point, index)=>{
        if(index === 0){
          point.verticalSpeedMps = 0;
          return;
        }
        const previous = rawPoints[index - 1];
        const dt = Math.max(0.001, Math.min(0.05, point.elapsedSec - previous.elapsedSec));
        const sourceVerticalSpeedMps = Number(verticalSpeeds[point.sourceIndex]);
        let phaseName = FLIGHT_PHASE_CODE_NAMES[point.flightPhaseCode] || "";
        if(!phaseName){
          const launchAgeSec = point.elapsedSec - rawPoints[0].elapsedSec;
          phaseName = launchAgeSec < 2.2
            ? FLIGHT_PHASES.POWERED_FLIGHT
            : (index < sharedApogeePointIndex
              ? FLIGHT_PHASES.COASTING
              : FLIGHT_PHASES.DESCENT);
        }
        sharedVerticalSpeedMps = updateReportVerticalSpeedMps(
          sharedVerticalSpeedMps,
          0,
          sourceVerticalSpeedMps,
          dt,
          {
            powered:phaseName === FLIGHT_PHASES.POWERED_FLIGHT,
            coastingAscent:phaseName === FLIGHT_PHASES.COASTING,
            established:index >= 4,
            currentAltitudeM:point.altitudeM,
            apogeeAltitudeM:sharedApogeeAltitudeM,
            hasFutureApogee:index < sharedApogeePointIndex
          }
        );
        point.verticalSpeedMps = phaseName === FLIGHT_PHASES.LANDED
          ? 0
          : sharedVerticalSpeedMps;
      });
      rawPoints.forEach((point)=>{
        point.gpsEastM = gpsAvailable && isFinite(point.lon)
          ? (point.lon - baseLon) * metersPerLon
          : 0;
        point.gpsNorthM = gpsAvailable && isFinite(point.lat)
          ? (point.lat - baseLat) * 111320
          : 0;
        point.eastM = 0;
        point.northM = 0;
        point.positionSource = "VERTICAL_ONLY";
      });
      let gpsRangeEnvelopeM = NaN;
      rawPoints.forEach((point)=>{
        const gpsRangeM = gpsAvailable
          ? Math.hypot(point.gpsEastM, point.gpsNorthM)
          : NaN;
        if(isFinite(gpsRangeM)){
          gpsRangeEnvelopeM = isFinite(gpsRangeEnvelopeM)
            ? Math.max(gpsRangeEnvelopeM, gpsRangeM)
            : gpsRangeM;
        }
        point.gpsRangeM = gpsRangeM;
        point.gpsRangeEnvelopeM = gpsRangeEnvelopeM;
        point.horizontalRangeLimitM = NaN;
      });
      if(useGpsForTrajectory && gpsAvailable && gpsFixes.length >= 2){
        const fixVelocity = new Array(gpsFixes.length).fill(null);
        let filteredVelocityEastMps = 0;
        let filteredVelocityNorthMps = 0;
        let velocityReady = false;
        for(let fixIndex = 0; fixIndex < gpsFixes.length; fixIndex++){
          const leftIndex = Math.max(0, fixIndex - 1);
          const rightIndex = Math.min(gpsFixes.length - 1, fixIndex + 1);
          const left = gpsFixes[leftIndex];
          const right = gpsFixes[rightIndex];
          const dtSec = right.elapsedSec - left.elapsedSec;
          let velocityEastMps = 0;
          let velocityNorthMps = 0;
          if(dtSec >= 0.18){
            velocityEastMps = ((right.lon - left.lon) * metersPerLon) / dtSec;
            velocityNorthMps = ((right.lat - left.lat) * 111320) / dtSec;
          }
          const rawSpeedMps = Math.hypot(velocityEastMps, velocityNorthMps);
          if(!isFinite(rawSpeedMps) || rawSpeedMps > 160){
            velocityEastMps = velocityReady ? filteredVelocityEastMps : 0;
            velocityNorthMps = velocityReady ? filteredVelocityNorthMps : 0;
          }
          if(!velocityReady){
            filteredVelocityEastMps = velocityEastMps;
            filteredVelocityNorthMps = velocityNorthMps;
            velocityReady = true;
          }else{
            filteredVelocityEastMps += (velocityEastMps - filteredVelocityEastMps) * 0.42;
            filteredVelocityNorthMps += (velocityNorthMps - filteredVelocityNorthMps) * 0.42;
          }
          fixVelocity[fixIndex] = {
            eastMps:filteredVelocityEastMps,
            northMps:filteredVelocityNorthMps
          };
        }
        let activeFixIndex = 0;
        rawPoints.forEach((point)=>{
          while(
            activeFixIndex + 1 < gpsFixes.length &&
            gpsFixes[activeFixIndex + 1].index <= point.pointIndex
          ){
            activeFixIndex++;
          }
          const velocity = fixVelocity[activeFixIndex];
          point.horizontalSpeedMps = velocity
            ? Math.hypot(velocity.eastMps, velocity.northMps)
            : 0;
        });
      }
      let positionMode = "VERTICAL_ONLY";
      let imuAssistEndElapsedSec = null;
      if(
        useGpsForTrajectory &&
        GYRO_ABSOLUTE_TRAJECTORY_ENABLED &&
        gpsAvailable &&
        rawPoints.length > 20 &&
        gpsFixes.length > 1
      ){
        const gpsFixMetric = (fix)=>({
          fix,
          eastM:(fix.lon - baseLon) * metersPerLon,
          northM:(fix.lat - baseLat) * 111320
        });
        const fixMetrics = gpsFixes.map(gpsFixMetric);
        const firstMoved = fixMetrics.find((entry)=>
          Math.hypot(entry.eastM, entry.northM) >= 2.5 && entry.fix.index > 0
        );
        const headingReference = fixMetrics.reduce((best, entry)=>
          Math.hypot(entry.eastM, entry.northM) > Math.hypot(best.eastM, best.northM)
            ? entry
            : best
        , fixMetrics[0]);
        const headingDistanceM = Math.hypot(headingReference.eastM, headingReference.northM);

        if(firstMoved && headingDistanceM >= 5){
          const launchElapsedSec = rawPoints[0].elapsedSec;
          const upSum = [0, 0, 0];
          let upSamples = 0;
          rawPoints.forEach((point)=>{
            if((point.elapsedSec - launchElapsedSec) > 0.25) return;
            const magnitude = Math.hypot(point.ax, point.ay, point.az);
            if(!isFinite(magnitude) || magnitude < 1.5 || magnitude > 8) return;
            upSum[0] += point.ax / magnitude;
            upSum[1] += point.ay / magnitude;
            upSum[2] += point.az / magnitude;
            upSamples++;
          });
          const normalize3 = (vector)=>{
            const magnitude = Math.hypot(vector[0], vector[1], vector[2]);
            return magnitude > 1e-9
              ? [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude]
              : null;
          };
          const dot3 = (a, b)=>(a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
          const cross3 = (a, b)=>[
            (a[1] * b[2]) - (a[2] * b[1]),
            (a[2] * b[0]) - (a[0] * b[2]),
            (a[0] * b[1]) - (a[1] * b[0])
          ];
          const up = normalize3(upSamples ? upSum : [rawPoints[0].ax, rawPoints[0].ay, rawPoints[0].az]);
          if(up){
            const seed = Math.abs(up[0]) < 0.85 ? [1, 0, 0] : [0, 0, 1];
            const seedDotUp = dot3(seed, up);
            const horizontalX = normalize3([
              seed[0] - (up[0] * seedDotUp),
              seed[1] - (up[1] * seedDotUp),
              seed[2] - (up[2] * seedDotUp)
            ]);
            const horizontalY = horizontalX ? normalize3(cross3(up, horizontalX)) : null;
            if(horizontalX && horizontalY){
              const rotateByQuat = (quat, vector)=>{
                const w = quat[0], x = quat[1], y = quat[2], z = quat[3];
                const tx = 2 * ((y * vector[2]) - (z * vector[1]));
                const ty = 2 * ((z * vector[0]) - (x * vector[2]));
                const tz = 2 * ((x * vector[1]) - (y * vector[0]));
                return [
                  vector[0] + (w * tx) + (y * tz) - (z * ty),
                  vector[1] + (w * ty) + (z * tx) - (x * tz),
                  vector[2] + (w * tz) + (x * ty) - (y * tx)
                ];
              };
              let quat = [1, 0, 0, 0];
              let velocityX = 0;
              let velocityY = 0;
              let positionX = 0;
              let positionY = 0;
              let filteredAccelX = 0;
              let filteredAccelY = 0;
              rawPoints[0].imuX = 0;
              rawPoints[0].imuY = 0;
              for(let index = 1; index < rawPoints.length; index++){
                const point = rawPoints[index];
                const previous = rawPoints[index - 1];
                const dt = Math.max(0.001, Math.min(0.05, point.elapsedSec - previous.elapsedSec));
                const gx = isFinite(point.gx) ? point.gx * DEG_TO_RAD : 0;
                const gy = isFinite(point.gy) ? point.gy * DEG_TO_RAD : 0;
                const gz = isFinite(point.gz) ? point.gz * DEG_TO_RAD : 0;
                const qw = quat[0], qx = quat[1], qy = quat[2], qz = quat[3];
                quat = [
                  qw + (0.5 * ((-qx * gx) - (qy * gy) - (qz * gz)) * dt),
                  qx + (0.5 * (( qw * gx) + (qy * gz) - (qz * gy)) * dt),
                  qy + (0.5 * (( qw * gy) - (qx * gz) + (qz * gx)) * dt),
                  qz + (0.5 * (( qw * gz) + (qx * gy) - (qy * gx)) * dt)
                ];
                const quatMagnitude = Math.hypot(quat[0], quat[1], quat[2], quat[3]);
                if(quatMagnitude > 1e-9) quat = quat.map((value)=>value / quatMagnitude);

                const accelMagnitude = Math.hypot(point.ax, point.ay, point.az);
                const worldAccel = rotateByQuat(quat, [point.ax, point.ay, point.az]);
                let accelX = dot3(worldAccel, horizontalX) * 9.80665;
                let accelY = dot3(worldAccel, horizontalY) * 9.80665;
                if(!isFinite(accelMagnitude) || accelMagnitude < 0.12){
                  accelX = 0;
                  accelY = 0;
                }
                const horizontalAccelMagnitude = Math.hypot(accelX, accelY);
                if(horizontalAccelMagnitude > 60){
                  const limitScale = 60 / horizontalAccelMagnitude;
                  accelX *= limitScale;
                  accelY *= limitScale;
                }
                const accelAlpha = 1 - Math.exp(-dt / 0.08);
                filteredAccelX += (accelX - filteredAccelX) * accelAlpha;
                filteredAccelY += (accelY - filteredAccelY) * accelAlpha;
                velocityX += filteredAccelX * dt;
                velocityY += filteredAccelY * dt;
                positionX += velocityX * dt;
                positionY += velocityY * dt;
                point.imuX = positionX;
                point.imuY = positionY;
              }

              const transitionIndex = Math.min(rawPoints.length - 1, firstMoved.fix.index);
              const transitionPoint = rawPoints[transitionIndex];
              const imuEndDistance = Math.hypot(transitionPoint.imuX, transitionPoint.imuY);
              if(isFinite(imuEndDistance) && imuEndDistance >= 1){
                const imuHeading = Math.atan2(transitionPoint.imuY, transitionPoint.imuX);
                const gpsHeading = Math.atan2(headingReference.northM, headingReference.eastM);
                const headingDelta = gpsHeading - imuHeading;
                const cosHeading = Math.cos(headingDelta);
                const sinHeading = Math.sin(headingDelta);
                const maximumEstimateM = Math.max(5, headingDistanceM * 0.9);
                const estimateScale = imuEndDistance > maximumEstimateM
                  ? maximumEstimateM / imuEndDistance
                  : 1;
                const rotateEstimate = (point)=>({
                  eastM:((point.imuX * cosHeading) - (point.imuY * sinHeading)) * estimateScale,
                  northM:((point.imuX * sinHeading) + (point.imuY * cosHeading)) * estimateScale
                });
                for(let index = 0; index <= transitionIndex; index++){
                  const estimate = rotateEstimate(rawPoints[index]);
                  rawPoints[index].eastM = estimate.eastM;
                  rawPoints[index].northM = estimate.northM;
                  rawPoints[index].positionSource = index === 0 ? "GPS_ANCHOR" : "IMU_ESTIMATE";
                }
                const estimateAtTransition = rotateEstimate(transitionPoint);
                const correctionEndIndex = Math.max(transitionIndex + 1, headingReference.fix.index);
                const gpsBridgeEastM = headingReference.eastM - transitionPoint.gpsEastM;
                const gpsBridgeNorthM = headingReference.northM - transitionPoint.gpsNorthM;
                const fusedBridgeEastM = headingReference.eastM - estimateAtTransition.eastM;
                const fusedBridgeNorthM = headingReference.northM - estimateAtTransition.northM;
                const gpsBridgeDistanceM = Math.hypot(gpsBridgeEastM, gpsBridgeNorthM);
                const fusedBridgeDistanceM = Math.hypot(fusedBridgeEastM, fusedBridgeNorthM);
                const bridgeScale = gpsBridgeDistanceM > 1e-6
                  ? fusedBridgeDistanceM / gpsBridgeDistanceM
                  : 0;
                const bridgeHeadingDelta = Math.atan2(fusedBridgeNorthM, fusedBridgeEastM) -
                  Math.atan2(gpsBridgeNorthM, gpsBridgeEastM);
                const bridgeCos = Math.cos(bridgeHeadingDelta);
                const bridgeSin = Math.sin(bridgeHeadingDelta);
                for(let index = transitionIndex + 1; index < rawPoints.length; index++){
                  const point = rawPoints[index];
                  if(index <= correctionEndIndex){
                    const gpsDeltaEastM = point.gpsEastM - transitionPoint.gpsEastM;
                    const gpsDeltaNorthM = point.gpsNorthM - transitionPoint.gpsNorthM;
                    point.eastM = estimateAtTransition.eastM + bridgeScale * (
                      (gpsDeltaEastM * bridgeCos) - (gpsDeltaNorthM * bridgeSin)
                    );
                    point.northM = estimateAtTransition.northM + bridgeScale * (
                      (gpsDeltaEastM * bridgeSin) + (gpsDeltaNorthM * bridgeCos)
                    );
                    point.positionSource = "IMU_GPS_BLEND";
                  }else{
                    point.eastM = point.gpsEastM;
                    point.northM = point.gpsNorthM;
                    point.positionSource = "GPS";
                  }
                }
                positionMode = "IMU_GPS_FUSION";
                imuAssistEndElapsedSec = transitionPoint.elapsedSec - launchElapsedSec;
              }
            }
          }
        }
      }

      // Absolute heading is intentionally omitted. Every report uses the same
      // launch-relative model-rocket frame regardless of GPS availability.
      if(rawPoints.length > 1){
        const normalize3 = (vector)=>{
          const magnitude = Math.hypot(vector[0], vector[1], vector[2]);
          return magnitude > 1e-9
            ? [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude]
            : null;
        };
        const dot3 = (a, b)=>(a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
        const cross3 = (a, b)=>[
          (a[1] * b[2]) - (a[2] * b[1]),
          (a[2] * b[0]) - (a[0] * b[2]),
          (a[0] * b[1]) - (a[1] * b[0])
        ];
        const rotateByQuat = (quat, vector)=>{
          const w = quat[0], x = quat[1], y = quat[2], z = quat[3];
          const tx = 2 * ((y * vector[2]) - (z * vector[1]));
          const ty = 2 * ((z * vector[0]) - (x * vector[2]));
          const tz = 2 * ((x * vector[1]) - (y * vector[0]));
          return [
            vector[0] + (w * tx) + (y * tz) - (z * ty),
            vector[1] + (w * ty) + (z * tx) - (x * tz),
            vector[2] + (w * tz) + (x * ty) - (y * tx)
          ];
        };
        const launchElapsedSec = rawPoints[0].elapsedSec;
        const launchAltitudeM = rawPoints[0].altitudeM;
        const upSum = [0, 0, 0];
        let upSamples = 0;
        rawPoints.forEach((point)=>{
          if((point.elapsedSec - launchElapsedSec) > 0.25) return;
          const magnitude = Math.hypot(point.ax, point.ay, point.az);
          if(!isFinite(magnitude) || magnitude < 1.2 || magnitude > 25) return;
          upSum[0] += point.ax / magnitude;
          upSum[1] += point.ay / magnitude;
          upSum[2] += point.az / magnitude;
          upSamples++;
        });
        const firstAccel = rawPoints.find((point)=>
          isFinite(point.ax) && isFinite(point.ay) && isFinite(point.az) &&
          Math.hypot(point.ax, point.ay, point.az) > 0.1
        );
        const up = normalize3(upSamples
          ? upSum
          : (firstAccel ? [firstAccel.ax, firstAccel.ay, firstAccel.az] : [0, 0, 1]));
        if(up){
          const seed = Math.abs(up[0]) < 0.85 ? [1, 0, 0] : [0, 0, 1];
          const seedDotUp = dot3(seed, up);
          const horizontalX = normalize3([
            seed[0] - (up[0] * seedDotUp),
            seed[1] - (up[1] * seedDotUp),
            seed[2] - (up[2] * seedDotUp)
          ]);
          const horizontalZ = horizontalX ? normalize3(cross3(up, horizontalX)) : null;
          if(horizontalX && horizontalZ){
            let quat = [1, 0, 0, 0];
            let velocityX = 0;
            let velocityZ = 0;
            let positionX = 0;
            let positionZ = 0;
            let filteredAccelX = 0;
            let filteredAccelZ = 0;
            let filteredVerticalSpeed = 0;
            let filteredVerticalAccelMps2 = 0;
            let fusedVerticalSpeedMps = 0;
            let speedEstimatorBurnout = false;
            let lowThrustHoldSec = 0;
            let apogeePointIndex = 0;
            let apogeeAltitudeM = -Infinity;
            rawPoints.forEach((candidatePoint, candidateIndex)=>{
              if(candidatePoint.altitudeM > apogeeAltitudeM){
                apogeeAltitudeM = candidatePoint.altitudeM;
                apogeePointIndex = candidateIndex;
              }
            });
            rawPoints[0].eastM = 0;
            rawPoints[0].northM = 0;
            rawPoints[0].positionSource = "IMU_LOCAL";
            rawPoints[0].horizontalSpeedMps = 0;
            rawPoints[0].verticalSpeedMps = 0;
            for(let index = 1; index < rawPoints.length; index++){
              const point = rawPoints[index];
              const previous = rawPoints[index - 1];
              const dt = Math.max(0.001, Math.min(0.05, point.elapsedSec - previous.elapsedSec));
              const gx = isFinite(point.gx) ? point.gx * DEG_TO_RAD : 0;
              const gy = isFinite(point.gy) ? point.gy * DEG_TO_RAD : 0;
              const gz = isFinite(point.gz) ? point.gz * DEG_TO_RAD : 0;
              const qw = quat[0], qx = quat[1], qy = quat[2], qz = quat[3];
              quat = [
                qw + (0.5 * ((-qx * gx) - (qy * gy) - (qz * gz)) * dt),
                qx + (0.5 * (( qw * gx) + (qy * gz) - (qz * gy)) * dt),
                qy + (0.5 * (( qw * gy) - (qx * gz) + (qz * gx)) * dt),
                qz + (0.5 * (( qw * gz) + (qx * gy) - (qy * gx)) * dt)
              ];
              const quatMagnitude = Math.hypot(quat[0], quat[1], quat[2], quat[3]);
              if(quatMagnitude > 1e-9) quat = quat.map((value)=>value / quatMagnitude);

              let phaseName = FLIGHT_PHASE_CODE_NAMES[point.flightPhaseCode] || "";
              const rawVerticalSpeed = (point.altitudeM - previous.altitudeM) / dt;
              filteredVerticalSpeed += (
                clampLocal(rawVerticalSpeed, -120, 120) - filteredVerticalSpeed
              ) * (1 - Math.exp(-dt / 0.24));
              if(!phaseName){
                if((point.elapsedSec - launchElapsedSec) < 2.2) phaseName = FLIGHT_PHASES.POWERED_FLIGHT;
                else phaseName = filteredVerticalSpeed >= -0.5 ? FLIGHT_PHASES.COASTING : FLIGHT_PHASES.DESCENT;
              }
              const dynamics = GYRO_LOCAL_PHASE_DYNAMICS[phaseName] ||
                GYRO_LOCAL_PHASE_DYNAMICS.COASTING;
              const launchAgeSec = Math.max(0, point.elapsedSec - launchElapsedSec);

              let accelX = 0;
              let accelZ = 0;
              let verticalAccelMps2 = 0;
              const accelNormG = Math.hypot(point.ax, point.ay, point.az);
              if(phaseName !== FLIGHT_PHASES.PRE_FLIGHT &&
                 phaseName !== FLIGHT_PHASES.LANDED &&
                 isFinite(accelNormG) && accelNormG >= 0.03 && accelNormG <= 25){
                const worldSpecificForceG = rotateByQuat(
                  quat,
                  [point.ax, point.ay, point.az]
                );
                // horizontalX/Z are orthogonal to the launch gravity vector,
                // so their projections are already gravity-free.
                accelX = dot3(worldSpecificForceG, horizontalX) * GYRO_IMU_GRAVITY_MPS2;
                accelZ = dot3(worldSpecificForceG, horizontalZ) * GYRO_IMU_GRAVITY_MPS2;
                verticalAccelMps2 = (
                  dot3(worldSpecificForceG, up) - 1
                ) * GYRO_IMU_GRAVITY_MPS2;
              }
              const accelMagnitude = Math.hypot(accelX, accelZ);
              if(accelMagnitude > GYRO_FUSION_ACCEL_CLAMP_MPS2){
                const accelScale = GYRO_FUSION_ACCEL_CLAMP_MPS2 / accelMagnitude;
                accelX *= accelScale;
                accelZ *= accelScale;
              }
              const accelAlpha = 1 - Math.exp(-dt / dynamics.accelTau);
              filteredAccelX += (accelX - filteredAccelX) * accelAlpha;
              filteredAccelZ += (accelZ - filteredAccelZ) * accelAlpha;
              verticalAccelMps2 = clampLocal(
                verticalAccelMps2,
                -Math.min(30, GYRO_FUSION_ACCEL_CLAMP_MPS2),
                Math.min(30, GYRO_FUSION_ACCEL_CLAMP_MPS2)
              );
              filteredVerticalAccelMps2 += (
                verticalAccelMps2 - filteredVerticalAccelMps2
              ) * accelAlpha;
              if(
                phaseName === FLIGHT_PHASES.COASTING ||
                phaseName === FLIGHT_PHASES.DESCENT ||
                phaseName === FLIGHT_PHASES.LANDED
              ){
                speedEstimatorBurnout = true;
              }else if(!speedEstimatorBurnout && launchAgeSec >= 0.25){
                if(isFinite(accelNormG) && accelNormG < 1.15){
                  lowThrustHoldSec += dt;
                  if(lowThrustHoldSec >= 0.12) speedEstimatorBurnout = true;
                }else{
                  lowThrustHoldSec = 0;
                }
              }

              let horizontalRangeLimitM = NaN;
              if(phaseName === FLIGHT_PHASES.PRE_FLIGHT){
                velocityX = 0;
                velocityZ = 0;
                fusedVerticalSpeedMps = 0;
              }else{
                let horizontalAcceptance = 1;
                if(phaseName === FLIGHT_PHASES.POWERED_FLIGHT){
                  const poweredAgeSec = Math.max(0, point.elapsedSec - launchElapsedSec);
                  horizontalAcceptance = getModelRocketLaunchHorizontalAcceptance(
                    poweredAgeSec,
                    Math.max(0, point.altitudeM - launchAltitudeM)
                  );
                }
                if(phaseName === FLIGHT_PHASES.LANDED){
                  velocityX = 0;
                  velocityZ = 0;
                  fusedVerticalSpeedMps = 0;
                }else{
                  const barometricVerticalSpeedMps = Number(
                    verticalSpeeds[point.sourceIndex]
                  );
                  fusedVerticalSpeedMps = updateReportVerticalSpeedMps(
                    fusedVerticalSpeedMps,
                    filteredVerticalAccelMps2,
                    barometricVerticalSpeedMps,
                    dt,
                    {
                      powered:!speedEstimatorBurnout &&
                        phaseName === FLIGHT_PHASES.POWERED_FLIGHT,
                      coastingAscent:speedEstimatorBurnout,
                      established:launchAgeSec >= 0.45,
                      currentAltitudeM:point.altitudeM,
                      apogeeAltitudeM,
                      hasFutureApogee:index < apogeePointIndex
                    }
                  );
                }

                const rocketAxisWorld = normalize3(rotateByQuat(quat, up)) || up;
                const timeSinceApogeeSec = index > apogeePointIndex
                  ? Math.max(
                    0,
                    point.elapsedSec - rawPoints[apogeePointIndex].elapsedSec
                  )
                  : 0;
                horizontalRangeLimitM = getModelRocketHorizontalRangeLimitM({
                  phase:phaseName,
                  altitudeM:Math.max(0, point.altitudeM - launchAltitudeM),
                  apogeeAltitudeM:Math.max(0, apogeeAltitudeM - launchAltitudeM),
                  timeSinceApogeeSec,
                  gpsRangeEnvelopeM:point.gpsRangeEnvelopeM,
                  gpsAccuracyM:point.gpsAccuracyM
                });
                const horizontalMotion = updateModelRocketHorizontalMotion(
                  {velocityX, velocityZ, positionX, positionZ},
                  {
                    dtSec:dt,
                    phase:phaseName,
                    verticalSpeedMps:fusedVerticalSpeedMps,
                    axisX:dot3(rocketAxisWorld, horizontalX),
                    axisZ:dot3(rocketAxisWorld, horizontalZ),
                    axisUp:dot3(rocketAxisWorld, up),
                    accelX:filteredAccelX,
                    accelZ:filteredAccelZ,
                    horizontalAcceptance,
                    horizontalRangeLimitM,
                    horizontalRangeTargetM:point.gpsRangeEnvelopeM,
                    rangeCorrectionAlpha:1 - Math.exp(-dt / 0.9),
                    anchorX:0,
                    anchorZ:0
                  }
                );
                velocityX = horizontalMotion.velocityX;
                velocityZ = horizontalMotion.velocityZ;
                positionX = horizontalMotion.positionX;
                positionZ = horizontalMotion.positionZ;
              }
              point.eastM = positionX;
              point.northM = positionZ;
              point.positionSource = "IMU_LOCAL";
              point.horizontalSpeedMps = Math.hypot(velocityX, velocityZ);
              point.verticalSpeedMps = fusedVerticalSpeedMps;
              point.horizontalRangeLimitM = horizontalRangeLimitM;
            }
            positionMode = "IMU_LOCAL";
            imuAssistEndElapsedSec = null;
          }
        }
      }
      // Older BIN records do not contain an explicit scalar-speed field.
      // Combine the filtered horizontal inertial velocity with a vertical
      // complementary filter: acceleration supplies fast response, while the
      // short-window barometric slope removes integration drift. Differentiating the
      // reconstructed positions here would amplify trajectory corrections
      // and GPS jitter into non-physical speed spikes.
      const rawTrajectorySpeedMps = buildTrajectoryScalarSpeedSeries(
        rawPoints,
        verticalSpeeds
      );
      const trajectorySpeedMps = new Array(sourceRows.length).fill(NaN);
      rawPoints.forEach((point, index)=>{
        trajectorySpeedMps[point.sourceIndex] = rawTrajectorySpeedMps[index];
      });
      let stageSeparationEvent = null;
      let ejectionEvent = null;
      let previousDeploymentState = NaN;
      let previousDeploymentFlags = 0;
      rawPoints.forEach((point, index)=>{
        const deploymentState = point.deploymentState;
        const deploymentFlags = point.deploymentFlags;
        const alarmPayload = {mission_alarm_events:point.missionAlarmEvents};
        const primaryAlarmDetected = missionAlarmSignalsPrimaryDeployment(alarmPayload);
        const secondaryAlarmDetected = missionAlarmSignalsSecondaryDeployment(alarmPayload);
        const primaryStateEntered = isFinite(deploymentState) && deploymentState >= 2 &&
          (!isFinite(previousDeploymentState) || previousDeploymentState < 2);
        const secondaryStateEntered = isFinite(deploymentState) && deploymentState >= 3 &&
          (!isFinite(previousDeploymentState) || previousDeploymentState < 3);
        const secondaryFlagEntered = (deploymentFlags & (1 << 5)) !== 0 &&
          (previousDeploymentFlags & (1 << 5)) === 0;
        const secondaryDetected = secondaryStateEntered || secondaryFlagEntered || secondaryAlarmDetected;
        if(!stageSeparationEvent && (primaryAlarmDetected || (primaryStateEntered && !secondaryDetected))){
          stageSeparationEvent = {index, point, inferred:false};
        }
        if(!ejectionEvent && secondaryDetected){
          ejectionEvent = {index, point};
        }
        previousDeploymentState = deploymentState;
        previousDeploymentFlags = deploymentFlags;
      });
      if(!stageSeparationEvent && ejectionEvent){
        const inferredElapsedSec = ejectionEvent.point.elapsedSec - 1;
        let inferredIndex = 0;
        let inferredDistance = Infinity;
        rawPoints.forEach((point, index)=>{
          const distance = Math.abs(point.elapsedSec - inferredElapsedSec);
          if(distance < inferredDistance){
            inferredDistance = distance;
            inferredIndex = index;
          }
        });
        stageSeparationEvent = {
          index:inferredIndex,
          point:rawPoints[inferredIndex],
          inferred:true
        };
      }
      const trajectoryStartElapsedSec = isFinite(Number(launchReferenceElapsedSec))
        ? Number(launchReferenceElapsedSec)
        : (rawPoints.length ? rawPoints[0].elapsedSec : 0);
      const eventTPlusSec = (event)=>event && event.point
        ? Math.max(0, event.point.elapsedSec - trajectoryStartElapsedSec)
        : null;
      const stageSeparationTPlusSec = eventTPlusSec(stageSeparationEvent);
      const ejectionTPlusSec = eventTPlusSec(ejectionEvent);
      const eventPointIndexes = new Set();
      if(stageSeparationEvent) eventPointIndexes.add(stageSeparationEvent.index);
      if(ejectionEvent) eventPointIndexes.add(ejectionEvent.index);

      const maxPoints = 1800;
      const stride = Math.max(1, Math.ceil(rawPoints.length / maxPoints));
      const points = rawPoints.filter((_point, index)=>
        index === 0 || index === rawPoints.length - 1 || eventPointIndexes.has(index) || (index % stride) === 0
      );
      const dataRows = [[
        "ELAPSED_S", "LOCAL_X_M", "LOCAL_Z_M", "ALTITUDE_M",
        "GPS_LAT_REFERENCE", "GPS_LON_REFERENCE", "POSITION_SOURCE",
        "GPS_EAST_M_REFERENCE", "GPS_NORTH_M_REFERENCE",
        "HORIZONTAL_SPEED_MPS", "VERTICAL_SPEED_MPS",
        "ESTIMATED_SPEED_MPS", "SPEED_SOURCE",
        "GPS_RANGE_ENVELOPE_M", "MODEL_RANGE_LIMIT_M", "EVENT"
      ]];
      points.forEach((point)=>{
        const pointIndex = point.pointIndex;
        const estimatedSpeedMps = Number(rawTrajectorySpeedMps[pointIndex]);
        const eventLabels = [];
        if(stageSeparationEvent && pointIndex === stageSeparationEvent.index) eventLabels.push("STAGE_SEPARATION_CH1");
        if(ejectionEvent && pointIndex === ejectionEvent.index) eventLabels.push("EJECTION_CH2");
        dataRows.push([
          Number((point.elapsedSec - trajectoryStartElapsedSec).toFixed(3)),
          Number(point.eastM.toFixed(3)),
          Number(point.northM.toFixed(3)),
          Number(point.altitudeM.toFixed(3)),
          isFinite(point.lat) ? Number(point.lat.toFixed(7)) : "",
          isFinite(point.lon) ? Number(point.lon.toFixed(7)) : "",
          point.positionSource,
          Number(point.gpsEastM.toFixed(3)),
          Number(point.gpsNorthM.toFixed(3)),
          isFinite(point.horizontalSpeedMps)
            ? Number(point.horizontalSpeedMps.toFixed(3))
            : "",
          isFinite(point.verticalSpeedMps)
            ? Number(point.verticalSpeedMps.toFixed(3))
            : "",
          isFinite(estimatedSpeedMps)
            ? Number(estimatedSpeedMps.toFixed(3))
            : "",
          "MODEL ROCKET FUSION",
          isFinite(point.gpsRangeEnvelopeM)
            ? Number(point.gpsRangeEnvelopeM.toFixed(3))
            : "",
          isFinite(point.horizontalRangeLimitM)
            ? Number(point.horizontalRangeLimitM.toFixed(3))
            : "",
          eventLabels.join(" + ")
        ]);
      });
      if(points.length < 2 || typeof document === "undefined"){
        return {
          pngBytes:null,
          rows:dataRows,
          gpsAvailable,
          positionMode,
          imuAssistEndElapsedSec,
          actualSpeedMps:trajectorySpeedMps,
          stageSeparationTPlusSec,
          ejectionTPlusSec
        };
      }

      const width = 1400;
      const height = 900;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if(!ctx){
        return {
          pngBytes:null,
          rows:dataRows,
          gpsAvailable,
          positionMode,
          imuAssistEndElapsedSec,
          actualSpeedMps:trajectorySpeedMps,
          stageSeparationTPlusSec,
          ejectionTPlusSec
        };
      }

      let minE = Infinity, maxE = -Infinity;
      let minN = Infinity, maxN = -Infinity;
      let minA = Infinity, maxA = -Infinity;
      let apogeeIndex = 0;
      points.forEach((point, index)=>{
        minE = Math.min(minE, point.eastM); maxE = Math.max(maxE, point.eastM);
        minN = Math.min(minN, point.northM); maxN = Math.max(maxN, point.northM);
        if(point.altitudeM > maxA){ maxA = point.altitudeM; apogeeIndex = index; }
        minA = Math.min(minA, point.altitudeM);
      });
      const centerE = (minE + maxE) * 0.5;
      const centerN = (minN + maxN) * 0.5;
      const baseA = Math.min(0, minA);
      const horizontalSpan = Math.max(2, maxE - minE, maxN - minN);
      const altitudeSpan = Math.max(1, maxA - baseA);
      const groundHalf = horizontalSpan * 0.58;
      let covarianceEE = 0;
      let covarianceNN = 0;
      let covarianceEN = 0;
      points.forEach((point)=>{
        const de = point.eastM - centerE;
        const dn = point.northM - centerN;
        covarianceEE += de * de;
        covarianceNN += dn * dn;
        covarianceEN += de * dn;
      });
      const principalHeading = 0.5 * Math.atan2(
        2 * covarianceEN,
        covarianceEE - covarianceNN
      );
      // Keep the dominant horizontal motion almost perpendicular to the view.
      // A small depth offset preserves the 3D shape without hiding the path.
      const yaw = -principalHeading - (11 * DEG_TO_RAD);
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const metricProjectionScale = getMetricTrajectoryProjectionScale(
        horizontalSpan,
        altitudeSpan
      );
      const horizontalScale = metricProjectionScale;
      const altitudeScale = metricProjectionScale;
      const project = (eastM, northM, altitudeM)=>{
        const dx = eastM - centerE;
        const dy = northM - centerN;
        const rotatedX = (dx * cosYaw) - (dy * sinYaw);
        const depth = (dx * sinYaw) + (dy * cosYaw);
        return {
          x:(width * 0.5) + (rotatedX * horizontalScale),
          y:730 - ((altitudeM - baseA) * altitudeScale) - (depth * horizontalScale * 0.20)
        };
      };

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#eef6ff");
      bg.addColorStop(0.56, "#f8fafc");
      bg.addColorStop(1, "#eef2f7");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#0f172a";
      ctx.font = "700 34px Arial, sans-serif";
      ctx.fillText("3D FLIGHT TRAJECTORY", 58, 64);
      ctx.fillStyle = "#64748b";
      ctx.font = "500 18px Arial, sans-serif";
      ctx.fillText(
        positionMode === "IMU_LOCAL"
          ? "MODEL-CONSTRAINED LOCAL TRAJECTORY / GPS SHAPE EXCLUDED · RANGE GUARDED"
          : (positionMode === "IMU_GPS_FUSION"
            ? "IMU-ASSISTED EAST / NORTH + GPS / BAROMETRIC ALTITUDE"
            : (gpsAvailable ? "GPS EAST / NORTH / BAROMETRIC ALTITUDE" : "GPS UNAVAILABLE / VERTICAL PROFILE")),
        60,
        94
      );
      const flightTimeText = String(launchTimeIso || "").trim();
      if(flightTimeText){
        ctx.textAlign = "right";
        ctx.fillText("LAUNCH  " + flightTimeText, width - 60, 94);
        ctx.textAlign = "left";
      }

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(100,116,139,0.28)";
      for(let i = 0; i <= 8; i++){
        const u = -groundHalf + ((groundHalf * 2 * i) / 8);
        const a0 = project(centerE - groundHalf, centerN + u, baseA);
        const a1 = project(centerE + groundHalf, centerN + u, baseA);
        const b0 = project(centerE + u, centerN - groundHalf, baseA);
        const b1 = project(centerE + u, centerN + groundHalf, baseA);
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
      }

      const launchPoint = points[0];
      const origin = project(launchPoint.eastM, launchPoint.northM, baseA);
      const axisLength = groundHalf * 0.72;
      const eastAxis = project(launchPoint.eastM + axisLength, launchPoint.northM, baseA);
      const northAxis = project(launchPoint.eastM, launchPoint.northM + axisLength, baseA);
      const altAxis = project(launchPoint.eastM, launchPoint.northM, maxA);
      const drawAxis = (end, color, label)=>{
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "700 17px Arial, sans-serif";
        ctx.fillText(label, end.x + 8, end.y - 8);
      };
      drawAxis(eastAxis, "#0ea5e9", positionMode === "IMU_LOCAL" ? "LOCAL X" : "E");
      drawAxis(northAxis, "#10b981", positionMode === "IMU_LOCAL" ? "LOCAL Z" : "N");
      drawAxis(altAxis, "#f59e0b", "ALT");

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.94)";
      ctx.lineWidth = 11;
      ctx.shadowColor = "rgba(15,23,42,0.28)";
      ctx.shadowBlur = 9;
      ctx.beginPath();
      points.forEach((point, index)=>{
        const projected = project(point.eastM, point.northM, point.altitudeM);
        if(index === 0) ctx.moveTo(projected.x, projected.y);
        else ctx.lineTo(projected.x, projected.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 3;
      for(let index = 1; index < points.length; index++){
        const prev = project(points[index - 1].eastM, points[index - 1].northM, points[index - 1].altitudeM);
        const current = project(points[index].eastM, points[index].northM, points[index].altitudeM);
        const altitudeRatio = Math.max(0, Math.min(1, (points[index].altitudeM - minA) / Math.max(1e-6, maxA - minA)));
        const hue = 205 - (165 * altitudeRatio);
        ctx.strokeStyle = "hsl(" + hue.toFixed(1) + " 88% 48%)";
        ctx.lineWidth = 6;
        if(points[index].positionSource === "IMU_LOCAL") ctx.setLineDash([]);
        else if(points[index].positionSource === "IMU_ESTIMATE") ctx.setLineDash([10, 7]);
        else if(points[index].positionSource === "IMU_GPS_BLEND") ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(current.x, current.y); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      const drawMarker = (point, color, label, alignRight, labelOffsetY)=>{
        const p = project(point.eastM, point.northM, point.altitudeM);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.font = "700 16px Arial, sans-serif";
        ctx.textAlign = alignRight ? "right" : "left";
        ctx.fillText(label, p.x + (alignRight ? -14 : 14), p.y + (isFinite(labelOffsetY) ? labelOffsetY : -14));
        ctx.textAlign = "left";
      };
      drawMarker(points[0], "#10b981", "LAUNCH", false);
      drawMarker(points[apogeeIndex], "#f59e0b", "APOGEE " + maxA.toFixed(1) + " m", false);
      drawMarker(points[points.length - 1], "#ef4444", "END", true);
      if(stageSeparationEvent && isFinite(stageSeparationTPlusSec)){
        const inferredSuffix = stageSeparationEvent.inferred ? " · EST" : "";
        const projected = project(
          stageSeparationEvent.point.eastM,
          stageSeparationEvent.point.northM,
          stageSeparationEvent.point.altitudeM
        );
        drawMarker(
          stageSeparationEvent.point,
          "#2563eb",
          "STAGE SEP  T+" + stageSeparationTPlusSec.toFixed(3) + " s" + inferredSuffix,
          projected.x > width * 0.72,
          -18
        );
      }
      if(ejectionEvent && isFinite(ejectionTPlusSec)){
        const projected = project(
          ejectionEvent.point.eastM,
          ejectionEvent.point.northM,
          ejectionEvent.point.altitudeM
        );
        drawMarker(
          ejectionEvent.point,
          "#7c3aed",
          "EJECTION  T+" + ejectionTPlusSec.toFixed(3) + " s",
          projected.x > width * 0.72,
          28
        );
      }

      ctx.fillStyle = "#334155";
      ctx.font = "600 17px Arial, sans-serif";
      ctx.fillText((positionMode === "IMU_LOCAL" ? "X span  " : "E span  ") + (maxE - minE).toFixed(1) + " m", 60, 820);
      ctx.fillText((positionMode === "IMU_LOCAL" ? "Z span  " : "N span  ") + (maxN - minN).toFixed(1) + " m", 260, 820);
      ctx.fillText("ALT max  " + maxA.toFixed(1) + " m", 460, 820);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 15px Arial, sans-serif";
      ctx.fillText(
        positionMode === "IMU_LOCAL"
          ? "Local X/Z use model dynamics; GPS constrains range only, never path shape or heading. Axes share one metric scale."
          : (positionMode === "IMU_GPS_FUSION"
            ? "Dashed: IMU estimate · dotted: IMU/GPS blend · solid: GPS. Axes are independently scaled."
            : "GPS fixes are time-interpolated. Axes are scaled for readability. Source: TRAJECTORY_3D sheet."),
        60,
        855
      );
      return {
        pngBytes:canvasPngBytes(canvas),
        rows:dataRows,
        gpsAvailable,
        positionMode,
        imuAssistEndElapsedSec,
        actualSpeedMps:trajectorySpeedMps,
        stageSeparationTPlusSec,
        ejectionTPlusSec
      };
    }
    function buildFlightTelemetryChartImages(timeValuesSec, chartDefinitions, launchTimeIso){
      if(typeof document === "undefined") return [];
      const times = Array.isArray(timeValuesSec)
        ? timeValuesSec.map((value)=>Number(value))
        : [];
      const definitions = Array.isArray(chartDefinitions) ? chartDefinitions : [];
      if(times.length < 2 || !definitions.length) return [];

      const width = 1400;
      const height = 900;
      const plot = {left:118, top:174, right:1332, bottom:744};
      const plotWidth = plot.right - plot.left;
      const plotHeight = plot.bottom - plot.top;
      const finiteTimes = times.filter((value)=>isFinite(value));
      if(finiteTimes.length < 2) return [];
      const xMin = Math.min(...finiteTimes);
      let xMax = Math.max(...finiteTimes);
      if(!(xMax > xMin)) xMax = xMin + 1;
      const xSpan = xMax - xMin;

      const hexToRgba = (hex, alpha)=>{
        const normalized = String(hex || "#3b82f6").replace(/^#/, "");
        const value = parseInt(normalized.length === 3
          ? normalized.split("").map((char)=>char + char).join("")
          : normalized, 16);
        const red = (value >> 16) & 255;
        const green = (value >> 8) & 255;
        const blue = value & 255;
        return "rgba(" + red + "," + green + "," + blue + "," + alpha + ")";
      };
      const sampleNumber = (value)=>
        value === "" || value == null ? NaN : Number(value);
      const formatTick = (value, span)=>{
        const magnitude = Math.abs(span);
        const digits = magnitude < 2 ? 2 : (magnitude < 20 ? 1 : 0);
        return Number(value).toFixed(digits).replace(/\.0+$/, "");
      };
      const niceAxis = (minimum, maximum)=>{
        let minValue = Number(minimum);
        let maxValue = Number(maximum);
        if(!isFinite(minValue) || !isFinite(maxValue)) return {min:0, max:1, step:0.2};
        if(maxValue < minValue){ const swap = minValue; minValue = maxValue; maxValue = swap; }
        if(maxValue === minValue){
          const padding = Math.max(1, Math.abs(maxValue) * 0.12);
          minValue -= padding;
          maxValue += padding;
        }
        const rawStep = (maxValue - minValue) / 6;
        const power = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, rawStep))));
        const fraction = rawStep / power;
        const niceFraction = fraction <= 1 ? 1 : (fraction <= 2 ? 2 : (fraction <= 5 ? 5 : 10));
        const step = niceFraction * power;
        return {
          min:Math.floor(minValue / step) * step,
          max:Math.ceil(maxValue / step) * step,
          step
        };
      };
      const buildSegments = (values, transformValue)=>{
        const stride = Math.max(1, Math.ceil(times.length / 1800));
        const segments = [];
        let segment = [];
        for(let index = 0; index < times.length; index++){
          if(index !== times.length - 1 && index % stride !== 0) continue;
          const time = times[index];
          const rawValue = sampleNumber(values[index]);
          const value = transformValue ? transformValue(rawValue) : rawValue;
          if(!isFinite(time) || !isFinite(value)){
            if(segment.length > 1) segments.push(segment);
            segment = [];
            continue;
          }
          segment.push({time, value});
        }
        if(segment.length > 1) segments.push(segment);
        return segments;
      };

      return definitions.map((definition, definitionIndex)=>{
        const sourceSeries = Array.isArray(definition && definition.series)
          ? definition.series.filter((series)=>series && Array.isArray(series.values))
          : [];
        if(!sourceSeries.length) return null;
        const normalizeSeries = !!definition.normalizeSeries;
        const series = sourceSeries.map((entry)=>{
          const finiteValues = entry.values.map(sampleNumber).filter((value)=>isFinite(value));
          const sourceMin = finiteValues.length ? Math.min(...finiteValues) : 0;
          const sourceMax = finiteValues.length ? Math.max(...finiteValues) : 1;
          const sourceSpan = Math.max(1e-9, sourceMax - sourceMin);
          return Object.assign({}, entry, {sourceMin, sourceMax, sourceSpan});
        });
        const renderedValues = [];
        series.forEach((entry)=>{
          entry.values.forEach((rawValue)=>{
            const value = sampleNumber(rawValue);
            if(!isFinite(value)) return;
            renderedValues.push(normalizeSeries
              ? ((value - entry.sourceMin) / entry.sourceSpan) * 100
              : value);
          });
        });
        if(!renderedValues.length) return null;
        const requestedMin = Number(definition.yMin);
        const requestedMax = Number(definition.yMax);
        const axis = normalizeSeries
          ? {min:0, max:100, step:20}
          : niceAxis(
            isFinite(requestedMin) ? requestedMin : Math.min(...renderedValues),
            isFinite(requestedMax) ? requestedMax : Math.max(...renderedValues)
          );
        const ySpan = Math.max(1e-9, axis.max - axis.min);
        const mapX = (time)=>plot.left + (((time - xMin) / xSpan) * plotWidth);
        const mapY = (value)=>plot.bottom - (((value - axis.min) / ySpan) * plotHeight);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if(!ctx) return null;

        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, width, height);
        const background = ctx.createLinearGradient(0, 0, 0, height);
        background.addColorStop(0, "#eef6ff");
        background.addColorStop(0.58, "#f8fafc");
        background.addColorStop(1, "#eef2f7");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "#0f172a";
        ctx.font = "700 34px Arial, sans-serif";
        ctx.fillText(String(definition.title || ("FLIGHT CHART " + (definitionIndex + 1))), 58, 64);
        ctx.fillStyle = "#64748b";
        ctx.font = "500 18px Arial, sans-serif";
        ctx.fillText(String(definition.subtitle || "FLIGHT TELEMETRY · TIME SERIES"), 60, 94);
        const launchText = String(launchTimeIso || "").trim();
        if(launchText){
          ctx.textAlign = "right";
          ctx.fillText("LAUNCH  " + launchText, width - 60, 94);
          ctx.textAlign = "left";
        }

        ctx.fillStyle = "rgba(255,255,255,0.62)";
        ctx.fillRect(plot.left, plot.top, plotWidth, plotHeight);
        ctx.strokeStyle = "rgba(148,163,184,0.44)";
        ctx.lineWidth = 1;
        ctx.strokeRect(plot.left, plot.top, plotWidth, plotHeight);

        ctx.font = "500 15px Arial, sans-serif";
        ctx.textBaseline = "middle";
        for(let tick = 0; tick <= 6; tick++){
          const value = axis.min + ((axis.max - axis.min) * tick / 6);
          const y = mapY(value);
          ctx.strokeStyle = "rgba(148,163,184,0.28)";
          ctx.beginPath(); ctx.moveTo(plot.left, y); ctx.lineTo(plot.right, y); ctx.stroke();
          ctx.fillStyle = "#64748b";
          ctx.textAlign = "right";
          ctx.fillText(formatTick(value, ySpan), plot.left - 14, y);
        }
        for(let tick = 0; tick <= 8; tick++){
          const time = xMin + (xSpan * tick / 8);
          const x = mapX(time);
          ctx.strokeStyle = "rgba(148,163,184,0.18)";
          ctx.beginPath(); ctx.moveTo(x, plot.top); ctx.lineTo(x, plot.bottom); ctx.stroke();
          ctx.fillStyle = "#64748b";
          ctx.textAlign = "center";
          ctx.fillText(formatTick(time, xSpan), x, plot.bottom + 28);
        }
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#475569";
        ctx.font = "600 16px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FLIGHT TIME (s)", (plot.left + plot.right) * 0.5, plot.bottom + 60);
        ctx.save();
        ctx.translate(34, (plot.top + plot.bottom) * 0.5);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(definition.axisYTitle || "VALUE"), 0, 0);
        ctx.restore();
        ctx.textAlign = "left";

        series.forEach((entry, seriesIndex)=>{
          const transformValue = normalizeSeries
            ? (value)=>((value - entry.sourceMin) / entry.sourceSpan) * 100
            : null;
          const segments = buildSegments(entry.values, transformValue);
          const color = String(entry.color || "#3b82f6");
          if(series.length === 1){
            const baseline = mapY(axis.min <= 0 && axis.max >= 0 ? 0 : axis.min);
            const fill = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
            fill.addColorStop(0, hexToRgba(color, 0.28));
            fill.addColorStop(1, hexToRgba(color, 0.02));
            ctx.fillStyle = fill;
            segments.forEach((segment)=>{
              ctx.beginPath();
              ctx.moveTo(mapX(segment[0].time), baseline);
              segment.forEach((point)=>ctx.lineTo(mapX(point.time), mapY(point.value)));
              ctx.lineTo(mapX(segment[segment.length - 1].time), baseline);
              ctx.closePath();
              ctx.fill();
            });
          }
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = "rgba(255,255,255,0.92)";
          ctx.lineWidth = series.length === 1 ? 10 : 8;
          ctx.shadowColor = "rgba(15,23,42,0.20)";
          ctx.shadowBlur = 7;
          segments.forEach((segment)=>{
            ctx.beginPath();
            segment.forEach((point, index)=>{
              const x = mapX(point.time), y = mapY(point.value);
              if(index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
          });
          ctx.shadowBlur = 0;
          ctx.strokeStyle = color;
          ctx.lineWidth = series.length === 1 ? 5.5 : 4.5;
          if(entry.dashed) ctx.setLineDash([12, 8]);
          segments.forEach((segment)=>{
            ctx.beginPath();
            segment.forEach((point, index)=>{
              const x = mapX(point.time), y = mapY(point.value);
              if(index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
          });
          ctx.restore();
        });

        ctx.font = "600 16px Arial, sans-serif";
        ctx.fillStyle = "#334155";
        if(series.length === 1){
          const entry = series[0];
          const unit = String(definition.summaryUnit || "");
          ctx.fillText("MAX  " + formatTick(entry.sourceMax, entry.sourceSpan) + unit, 60, 824);
          ctx.fillText("MIN  " + formatTick(entry.sourceMin, entry.sourceSpan) + unit, 270, 824);
          ctx.fillText("DURATION  " + xSpan.toFixed(1) + " s", 480, 824);
        }else{
          let legendX = 60;
          series.forEach((entry)=>{
            ctx.strokeStyle = String(entry.color || "#3b82f6");
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(legendX, 820); ctx.lineTo(legendX + 32, 820); ctx.stroke();
            ctx.fillStyle = "#334155";
            const label = String(entry.label || "SERIES");
            ctx.fillText(label, legendX + 42, 826);
            legendX += 62 + ctx.measureText(label).width;
          });
        }
        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 15px Arial, sans-serif";
        ctx.fillText(
          normalizeSeries
            ? "Each series is normalized independently to 0–100 for shape comparison. Source values remain unchanged in FLIGHT_RECORD."
            : String(definition.note || "Source: FLIGHT_RECORD · Missing samples are shown as gaps."),
          60,
          860
        );

        return {
          name:String(definition.title || ("Flight Chart " + (definitionIndex + 1))),
          pngBytes:canvasPngBytes(canvas)
        };
      }).filter((entry)=>entry && entry.pngBytes instanceof Uint8Array && entry.pngBytes.length > 0);
    }
    function formatEngNumber(value, digits){
      if(!isFinite(value)) return "0";
      const fixed = Number(value).toFixed(digits);
      return fixed.replace(/\.?0+$/,"");
    }
    function buildEngText(rows, meta, options){
      const valueDigits = normalizeDecimalDigits(options && options.valueDigits, 3);
      const rawName = (meta.name || "ALTIS_MOTOR").trim() || "ALTIS_MOTOR";
      const rawVendor = (meta.vendor || "ALTIS").trim() || "ALTIS";
      const name = rawName.replace(/\s+/g, "_");
      const vendor = rawVendor.replace(/\s+/g, "_");
      const header = [
        name,
        formatEngNumber(meta.diameterMm, 0),
        formatEngNumber(meta.lengthMm, 0),
        formatEngNumber(meta.delaySec, valueDigits),
        formatEngNumber(meta.propMassKg, valueDigits),
        formatEngNumber(meta.totalMassKg, valueDigits),
        vendor
      ].join(" ");
      const lines = [header];
      for(const row of rows){
        lines.push(formatEngNumber(row[0], 4) + " " + formatEngNumber(row[1], valueDigits));
      }
      return lines.join("\n") + "\n";
    }

    // Command routing is implemented in scripts/flash6-command.js.

    function updateNumValue(el, numText, unitText) {
      if (!el) return;
      let numSpan = el.querySelector('.num');
      let unitSpan = el.querySelector('.unit');
      if (numSpan) {
        numSpan.textContent = numText;
        if (unitSpan && unitText != null) unitSpan.textContent = unitText;
      } else {
        let html = `<span class="num">${numText}</span>`;
        if (unitText != null) html += `<span class="unit">${unitText}</span>`;
        el.innerHTML = html;
      }
    }
