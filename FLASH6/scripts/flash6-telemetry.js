/* FLASH6 runtime module: flash6-telemetry.js. Loaded in manifest order by flash6.js. */
    // =====================
    // 공통: 샘플 수신 처리
    // =====================
    function localizeFirmwareMissionAlarm(rawTitle, rawMessage){
      const title = normalizeMissionAlarmTitle(rawTitle);
      const message = normalizeMissionAlarmMessage(rawMessage);
      const titles = {
        "Launch detected":"발사 감지",
        "Early coasting":"조기 코스팅 감지",
        "Coasting confirmed":"코스팅 감지 완료",
        "Coasting detect fail":"코스팅 감지 실패",
        "Backup deployment":"백업 단분리 실행",
        "Servo 1 failed":"서보 1 작동 실패",
        "Secondary deployment":"2차 사출 실행",
        "Servo 2 failed":"서보 2 작동 실패",
        "ARM contact fault":"ARM 신호 불안정",
        "ARM unsafe":"ARM 해제 상태 감지",
        "Launch detection fault":"발사 감지 비정상",
        "Launch validation fault":"발사 검증 실패",
        "ARM authority confirmed":"발사 권한 확인",
        "T+ started":"T+ 시작",
        "Stage separation fault":"단분리 작동 실패",
        "Forced separation":"강제 단분리",
        "Coasting backup":"코스팅 백업 단분리",
        "Stage-1 ejection":"1단 사출",
        "Stage-1 ejection fault":"1단 사출 실패",
        "Stage-2 ignition":"2단 점화",
        "Stage-2 ejection":"2단 사출",
        "Stage-2 ejection fault":"2단 사출 실패",
        "Stage-2 separation":"2단 분리 감지",
        "Forced timed mission":"미션 강제 구동",
        "Mission standby":"미션 대기",
        "Interstage link lost":"단간 통신 단절"
      };
      let localizedTitle = titles[title] || "";
      // Firmware alarm fields are fixed-size and a long title may arrive
      // truncated. Match that known prefix instead of exposing it in English.
      if(!localizedTitle && /^Stage-2 separation con/i.test(title)){
        localizedTitle = "2단 분리 확인";
      }
      let localizedMessage = message;
      const delayMatch = message.match(/^ARM released\. Ignition delay (\d+) ms\.$/i);
      if(delayMatch){
        localizedMessage = "ARM 분리 감지 · 점화 지연 " + delayMatch[1] + "ms";
      }else if(/^ARM input is unstable during flight\./i.test(message)){
        localizedMessage = "비행 중 ARM 접점 불안정 감지 · 복구 시퀀스는 계속 실행됩니다.";
      }else if(/^ARM input is unstable\./i.test(message)){
        localizedMessage = "ARM 입력 불안정 감지 · 커넥터·센서·배선을 점검하세요.";
      }else if(/^Stage-1 physical ARM released/i.test(message)){
        localizedMessage = "1단 물리 ARM 해제 감지 · 해당 시각으로 T+를 확정했습니다.";
      }else if(/^Thrust flight detected; waiting up to 1 s/i.test(message)){
        localizedMessage = "추력 비행 감지 시각으로 T+ 시작 · 1초 동안 물리 ARM 해제를 확인합니다.";
      }else if(/^Thrust flight preceded ARM release/i.test(message)){
        localizedMessage = "추력 비행이 ARM 해제보다 먼저 감지되어 해당 시각으로 T+를 설정했습니다.";
      }else if(/^Physical ARM release confirmed the thrust-detected T\+\./i.test(message)){
        localizedMessage = "물리 ARM 해제를 확인해 추력 감지 T+의 미션 실행 권한을 승인했습니다.";
      }else if(/^No ARM release within 1 s of thrust/i.test(message)){
        localizedMessage = "추력 비행 감지 후 1초 안에 물리 ARM 해제가 확인되지 않아 미션 대기로 복귀했습니다.";
      }else if(/^Stage-1 T\+ event received\./i.test(message)){
        localizedMessage = "1단 T+ 이벤트를 수신했습니다.";
      }else if(/^Stage-1 separation event recovered/i.test(message)){
        localizedMessage = "1단 분리 이벤트로 누락된 T+를 복구했습니다.";
      }else if(/^Stage link lost; local powered-flight fallback/i.test(message)){
        localizedMessage = "단간 통신 단절 · 로컬 추력 비행 감지로 T+를 설정했습니다.";
      }else if(/^Virtual T\+ started\. No pyro output/i.test(message)){
        localizedMessage = "가상 T+ 시작 · 파이로 출력 없이 서보 시퀀스를 실행합니다.";
      }else if(/^Mission standby rejected\. (?:Physical ARM|ARM\/separation mechanism) is released/i.test(message)){
        localizedMessage = "ARM 또는 단분리 장치가 해제된 상태라 미션 대기가 거부되었습니다 · 안전 모드를 적용했습니다.";
      }else if(/^Hall sensor confirmed magnet departure\./i.test(message)){
        localizedMessage = "홀센서에서 자석 이탈을 확인했습니다 · 2단 단분리로 판정합니다.";
      }else if(/^Ignition ended without stage-1 ARM release/i.test(message)){
        localizedMessage = "점화 종료 후에도 1단 ARM 해제가 감지되지 않았습니다 · 발사체에 접근하지 마세요.";
      }else{
        const messages = {
          "Stage-1 ARM released.":"1단 ARM 해제를 감지했습니다.",
          "SERVO CH1 80 degree command failed.":"서보 CH1 80° 명령이 실패했습니다.",
          "SERVO CH1 command failed.":"서보 CH1 명령이 실패했습니다.",
          "Backup time reached. SERVO CH1 set to 80 degrees.":"백업 시간 도달 · 서보 CH1을 80°로 작동했습니다.",
          "Backup time reached. SERVO CH1 moved to configured angle.":"백업 시간 도달 · 서보 CH1을 설정 각도로 작동했습니다.",
          "No coasting by configured backup time. Separation executed.":"설정된 백업 시간까지 코스팅 미감지 · 단분리를 실행했습니다.",
          "SERVO CH1 set to 80 degrees.":"서보 CH1을 80°로 작동했습니다.",
          "SERVO CH1 moved to configured angle.":"서보 CH1을 설정 각도로 작동했습니다.",
          "SERVO CH2 set to 80 degrees.":"서보 CH2를 80°로 작동했습니다.",
          "SERVO CH2 moved to configured angle.":"서보 CH2를 설정 각도로 작동했습니다.",
          "SERVO CH2 command failed.":"서보 CH2 명령이 실패했습니다.",
          "PYRO CH1 ignition output started.":"파이로 CH1 점화 출력을 시작했습니다.",
          "SERVO CH1 set to 0 degrees.":"서보 CH1을 0°로 작동했습니다.",
          "SERVO CH1 command failed.":"서보 CH1 명령이 실패했습니다.",
          "Virtual T+ started. No pyro output; CH1/CH2 servo schedule is active.":"가상 T+ 시작 · 파이로 출력 없이 서보 시퀀스를 실행합니다.",
          "Mission standby rejected. Physical ARM is released; safety mode enabled.":"물리 ARM 해제 상태로 미션 대기가 거부되었습니다 · 안전 모드를 적용했습니다.",
          "Mission standby rejected. ARM/separation mechanism is released; safety mode enabled.":"ARM 또는 단분리 장치가 해제된 상태라 미션 대기가 거부되었습니다 · 안전 모드를 적용했습니다.",
          "Waiting for stable stage-1 physical ARM release.":"안정적인 1단 물리 ARM 해제를 기다리는 중입니다.",
          "Waiting for physical ARM release or thrust-flight detection.":"물리 ARM 해제 또는 추력 비행 감지를 기다리는 중입니다.",
          "Remote ARM release received.":"원격 ARM 해제 신호를 수신했습니다.",
          "Local ARM release confirmed.":"로컬 ARM 해제를 확인했습니다.",
          "Hall sensor confirmed magnet departure.":"홀센서에서 자석 이탈을 확인했습니다 · 2단 단분리로 판정합니다.",
          "Ignition ended without stage-1 ARM release. Keep clear of the vehicle.":"점화 종료 후에도 1단 ARM 해제가 감지되지 않았습니다 · 발사체에 접근하지 마세요.",
          "Remote telemetry confirms physical ARM release.":"원격 텔레메트리에서 물리 ARM 해제를 확인했습니다.",
          "Stage-1 ejection fallback uses separation time.":"단간 통신 단절 · 단분리 시각 기준으로 1단 사출 백업을 실행합니다.",
          "CH1 command failed. CH2 remains scheduled.":"서보 1 작동 실패 · 서보 2는 예정대로 실행합니다.",
          "No coasting by T+2.0s. Backup deploy started.":"T+2.0초까지 코스팅 미감지 · 백업 단분리를 실행했습니다.",
          "Early-coast hold complete. CH1 set to 85 deg.":"조기 코스팅 대기 완료 · 서보 1을 85도로 작동했습니다.",
          "Coasting confirmed. CH1 set to 85 deg.":"코스팅 확인 · 서보 1을 85도로 작동했습니다.",
          "Filtered coasting confirmed. Separation executed.":"필터링된 코스팅 확인 · 1단 단분리를 실행했습니다.",
          "Coasting before T+1.5s. Deployment held.":"T+1.5초 전 코스팅 감지 · 전개를 대기합니다.",
          "CH2 set to 85 deg. Mission sequence complete.":"서보 2를 85도로 작동했습니다 · 미션 시퀀스 완료.",
          "CH2 command failed. Check deployment system.":"서보 2 작동 실패 · 사출 장치를 점검하세요."
        };
        localizedMessage = messages[message] || message;
      }
      return {
        title:localizedTitle || title || "미션 알람",
        message:localizedMessage || "미션 알람"
      };
    }

    function handleMissionAlarmTelemetry(data, src, isReplaySample, stageIdOverride){
      if(!data || typeof data !== "object") return;
      const resolvedStageId = Number(stageIdOverride) || resolveTelemetryStageId(data);
      const events = Array.isArray(data.mission_alarm_events)
        ? data.mission_alarm_events
        : [{
            seq:data.mission_alarm_seq,
            block:data.mission_alarm_block,
            title:data.mission_alarm_title,
            message:data.mission_alarm_message,
            timestampMs:data.mission_alarm_ts
          }];
      events.forEach((event)=>{
        const seq = Number(event && event.seq);
        if(!isFinite(seq) || seq <= 0) return;
        const block = Math.max(0, Math.round(Number(event.block) || 0));
        const timestampMs = Math.max(0, Math.round(Number(event.timestampMs) || 0));
        const eventStageId = Number(event && (event.stageId ?? event.stage_id)) || resolvedStageId || 0;
        const eventKey = (isReplaySample ? "replay" : "live") +
          ":s" + eventStageId + ":" + seq + ":" + (isReplaySample ? timestampMs : "");
        if(missionAlarmEventKeys.has(eventKey)) return;
        missionAlarmEventKeys.add(eventKey);
        if(missionAlarmEventKeys.size > 256){
          const oldestKey = missionAlarmEventKeys.values().next().value;
          if(oldestKey) missionAlarmEventKeys.delete(oldestKey);
        }
        const localized = localizeFirmwareMissionAlarm(event.title, event.message);
        const stagePrefix = eventStageId === 1 ? "1단 · " : (eventStageId === 2 ? "2단 · " : "");
        const title = stagePrefix + localized.title;
        const message = localized.message;
        const rawTitle = normalizeMissionAlarmTitle(event.title);
        if(!isReplaySample && rawTitle === "ARM contact fault"){
          const contactMode = /mission remains active/i.test(String(event.message || ""))
            ? "contact-flight"
            : "contact";
          showMissionArmRiskWarning(eventStageId ? [eventStageId] : [], contactMode);
        }else if(!isReplaySample && rawTitle === "Launch detection fault"){
          showMissionArmRiskWarning(eventStageId ? [eventStageId] : [1], "launch");
        }else if(!isReplaySample && rawTitle === "Launch validation fault"){
          showMissionArmRiskWarning(eventStageId ? [eventStageId] : [1], "thrust-validation");
        }
        showToast(message, "notice", {
          key:"hardware-mission-alarm-" + eventKey,
          title,
          duration:9000,
          keep:true,
          forceToast:false
        });
        addLogLine(
          (isReplaySample ? "[REPLAY][MISSION_ALARM]" : "[MISSION_ALARM]") +
          (eventStageId ? "[STAGE " + eventStageId + "]" : "") +
          (block ? "[BLOCK " + block + "] " : " ") + title + ": " + message,
          isReplaySample ? "RPL-MSN" : "MSN"
        );
      });
    }

    function onIncomingSample(data, srcTag, opts){
      const src = String(srcTag || "").toUpperCase();
      const isReplaySample = (src === "REPLAY");
      const sampleOptions = opts || {};
      const isFastReplaySeek = isReplaySample && !!sampleOptions.fastSeek;
      const forceReplayUi = isReplaySample && !!sampleOptions.forceUi;
      let flashLinkWaitingForRemote = false;
      if(replaySourceActive){
        if(!isReplaySample) return;
      }else if(isReplaySample){
        return;
      }
      if(!isFastReplaySeek) telemetryUiSampleCounter++;
      const shouldRefreshUi = !isFastReplaySeek && (
        forceReplayUi ||
        telemetryUiSampleCounter === 1 ||
        (simEnabled
          ? (telemetryUiSampleCounter % 2 === 0)
          : (telemetryUiSampleCounter % UI_SAMPLE_SKIP === 0))
      );
      if(!isFastReplaySeek){
        handleMissionAlarmTelemetry(data, src, isReplaySample, resolveTelemetryStageId(data));
        ingestStageTelemetryBundle(data, src, isReplaySample, shouldRefreshUi);
        if(!isReplaySample && data && Array.isArray(data.stage_telemetry)){
          data.stage_telemetry.forEach((stageSample)=>maybeShowBrownoutWarning(stageSample));
        }
      }
      if(!isFastReplaySeek && typeof window !== "undefined"){
        window.__flashLastSample = data;
        window.__flashLastSampleSrc = src;
        window.__flashLastSampleAt = Date.now();
      }
      if(!isReplaySample && data){
        const incomingMode = normalizeOperationModeValue(data.op_mode ?? data.operation_mode ?? "");
        const incomingLinkMode = normalizeOperationModeValue(
          data.link_mode ?? data.transport_mode ?? data.communication_mode ?? data.op_mode ?? data.operation_mode ?? ""
        );
        const incomingRoleRaw = data.flash_link_role ?? data.fl_role ?? null;
        const incomingRole = normalizeFlashLinkRole(incomingRoleRaw);
        if(incomingRoleRaw != null && uiSettings && document.activeElement !== el.flashLinkRoleSelect){
          uiSettings.flashLinkRole = incomingRole;
        }
        syncGpsClockFromTelemetry(data);
        const remoteValid = Number(data.fl_remote_valid ?? data.flash_link_remote_valid ?? 0) !== 0;
        const linkActive = incomingLinkMode === "flash_link" ||
          Number(data.fl_link ?? data.flash_link_connected ?? 0) !== 0;
        const incomingDataMode = normalizeDataModeValue(
          data.data_mode ?? data.remote_op_mode ?? data.flash_link_data_mode ??
            (incomingMode === "flash_link" ? null : incomingMode),
          null
        );
        const canDisplayDataMode = linkActive && (incomingRole !== "ground" || remoteValid);
        if(canDisplayDataMode && incomingDataMode){
          setFlashLinkDisplayDataMode(incomingDataMode);
        }else{
          setFlashLinkDisplayDataMode(null);
        }
        const pendingModeChange = isOperationModeConfirmPending();
        if(incomingLinkMode === "flash_link" && uiSettings && document.activeElement !== el.opModeSelect && !pendingModeChange){
          if(uiSettings.opMode !== "flash_link"){
            uiSettings.opMode = "flash_link";
            saveSettings();
            applySettingsToUI();
          }
        }
        if(incomingLinkMode === "flash_link" && incomingRole === "ground" && !remoteValid){
          if(uiSettings && uiSettings.opMode !== "flash_link" && !pendingModeChange){
            uiSettings.opMode = "flash_link";
            saveSettings();
            applySettingsToUI();
          }
          flashLinkWaitingForRemote = true;
        }
      }
      const nowOk = Date.now();
      if(src === "SER") lastSerialSampleAt = nowOk;
      if(rxWindowStartMs === 0) rxWindowStartMs = nowOk;
      rxWindowCount++;
      const winMs = nowOk - rxWindowStartMs;
      if(winMs >= 1000){
        rxHzWindow = Math.round((rxWindowCount * 1000) / winMs);
        rxWindowStartMs = nowOk;
        rxWindowCount = 0;
      }
      lastOkMs = nowOk;
      failStreak = 0;
      const rebootRemoteValid = Number(
        data && (data.fl_remote_valid ?? data.flash_link_remote_valid ?? 0)
      ) !== 0;
      if(rebootConfirmWaiting && rebootWaitForRemoteLink && !rebootRemoteValid){
        rebootRemoteLinkDropped = true;
      }
      if(
        rebootConfirmWaiting &&
        !isReplaySample &&
        rebootConfirmStartedMs > 0 &&
        (!rebootWaitForRemoteLink || (rebootRemoteLinkDropped && rebootRemoteValid)) &&
        (nowOk - rebootConfirmStartedMs) >= REBOOT_WAIT_MIN_VISIBLE_MS
      ){
        hideRebootConfirm();
      }

      if(!connOk){
        connOk = true;
        unstableToastShown = false;
        disconnectedLogged = false;
        if(!isFastReplaySeek){
          updateConnectionUI(true);
          addLogLine(t("linkEstablished", {src:srcTag}), "NET");
          showToast(t("linkEstablishedToast", {src:srcTag}), "success", {duration:2600});
        }
      }
      if(!isReplaySample){
        maybeShowBrownoutWarning(data);
      }
      if(flashLinkWaitingForRemote){
        updateFlashLinkStatusUi(data, shouldRefreshUi);
        if(shouldRefreshUi){
          const offlineText = getFlashLinkGroundStatusText() || "ALTIS INTELLIGENT LINK1";
          if(el.connStatusText) el.connStatusText.textContent = offlineText;
          if(el.snapHz) el.snapHz.textContent = Math.round(flashLinkUiRxHz) + " Hz";
          if(el.statusBar){
            el.statusBar.classList.remove("is-online");
            el.statusBar.classList.add("is-offline");
          }
          applyFlashLinkGroundWaitingUi(false);
          syncMobileBoardHeader();
        }
        if(stageTelemetryModeActive){
          applyActiveStageGyroAttitude(nowOk);
          if(shouldRefreshUi) syncCameraHud(buildCameraHudStageValues({}));
        }
        return;
      }
      clearFlashLinkGroundWaitingUi();
      const dataOrigin = normalizeDataOrigin(data);
      data.data_origin = dataOrigin;
      currentDataOrigin = dataOrigin;
      if(!isReplaySample) applyFlightDataLoggingTelemetry(data);
      {
        const applyTelemetryStorageInfo = (origin, usedRaw, capacityRaw, recordsRaw, stageNodeRaw)=>{
          const telemetryCapacity = Number(capacityRaw);
          if(!isFinite(telemetryCapacity) || telemetryCapacity <= 0) return false;
          const telemetryUsed = Math.max(0, Number(usedRaw) || 0);
          const telemetryRecordCount = Math.max(0, Number(recordsRaw) || 0);
          const stageNode = normalizeStorageStageNode(stageNodeRaw);
          const telemetryStorageInfo = {
            ready:true,
            used_bytes:telemetryUsed,
            capacity_bytes:telemetryCapacity,
            chip_capacity_bytes:telemetryCapacity,
            record_count:telemetryRecordCount,
            used_percent:Math.max(0, Math.min(100, (telemetryUsed / telemetryCapacity) * 100)),
            record_hz:200,
            selected_spi_hz:4000000,
            updated_at:Date.now()
          };
          if(origin === "avionics"){
            if(stageNode){
              telemetryStorageInfo.stage_node = stageNode;
              latestAvionicsStorageByStage[stageNode] = telemetryStorageInfo;
            }
            latestAvionicsStorageInfo = telemetryStorageInfo;
            latestAvionicsStorageOkMs = Date.now();
          }else{
            latestSpiFlashStorageInfo = telemetryStorageInfo;
            latestSpiFlashStorageOkMs = Date.now();
            spiFlashReadyState = true;
          }
          return true;
        };
        let storageChanged = false;
        if(
          data.storage_capacity_bytes != null ||
          data.storage_used_bytes != null ||
          data.storage_records != null
        ){
          storageChanged = applyTelemetryStorageInfo(
            "local",
            data.storage_used_bytes,
            data.storage_capacity_bytes,
            data.storage_records
          ) || storageChanged;
        }
        if(
          data.remote_storage_capacity_bytes != null ||
          data.remote_storage_used_bytes != null ||
          data.remote_storage_records != null
        ){
          storageChanged = applyTelemetryStorageInfo(
            dataOrigin === "avionics" ? "avionics" : "local",
            data.remote_storage_used_bytes,
            data.remote_storage_capacity_bytes,
            data.remote_storage_records,
            data.fl_target ?? data.flash_link_target_node_id
          ) || storageChanged;
        }
        if(storageChanged){
          if(shouldRefreshUi) syncStoragePreview();
          processSequenceStorageGuardUpdate({notifyCritical:!isReplaySample});
        }
      }
      // HTTP fallback로만 살아난 상황에서는 WS를 다시 붙여준다.
      if(src === "WIFI" && !wsConnected && !wsRetryTimer){
        const socketState = wsSocket ? wsSocket.readyState : WebSocket.CLOSED;
        if(socketState !== WebSocket.CONNECTING && socketState !== WebSocket.OPEN){
          scheduleWsReconnect("http alive");
        }
      }

      sampleCounter++;

      const nowDate=new Date();
      const hostTimeMs=nowDate.getTime();
      const timeIso=nowDate.toISOString();
      const rawReplayTsMs = Number(data && data._replayTsMs);
      const rawUptimeMs = Number(data && (data.ut != null ? data.ut : data.uptime_ms));
      const replayTimelineMs = isFinite(rawReplayTsMs) ? rawReplayTsMs : NaN;
      const uptimeTimelineMs = isFinite(rawUptimeMs) ? rawUptimeMs : NaN;
      const timelineMs = isReplaySample
        ? (isFinite(replayTimelineMs) ? replayTimelineMs : hostTimeMs)
        : (isFinite(uptimeTimelineMs) ? uptimeTimelineMs : hostTimeMs);
      const timeMs = timelineMs;
      if(firstSampleMs === null || !isFinite(firstSampleMs)) firstSampleMs = timelineMs;
      const elapsedMs = Math.max(0, timelineMs - firstSampleMs);
      if(isFinite(timelineMs)){
        if(sampleRateWindowStartMs === 0){
          sampleRateWindowStartMs = timelineMs;
          sampleRateWindowCount = 1;
        }else if(isFinite(lastSampleTimelineMs) && timelineMs > lastSampleTimelineMs){
          sampleRateWindowCount += 1;
          const spanMs = timelineMs - sampleRateWindowStartMs;
          if(spanMs >= 1000){
            sampleRateHzWindow = Math.round((sampleRateWindowCount * 1000) / spanMs);
            sampleRateWindowStartMs = timelineMs;
            sampleRateWindowCount = 1;
          }
        }
        lastSampleTimelineMs = timelineMs;
      }

      const thrustVal = Number(data.t  != null ? data.t  : (data.thrust   ?? 0));
      const thrustHasData = (data.t != null || data.thrust != null);
      const hxHz = Number(data.hz != null ? data.hz : (data.hx_hz ?? 0));
      loadcellTelemetryHasRaw = (data.lc_raw != null || data.lc_raw_ok != null || data.lc_ready != null || data.lc_sat != null || data.lc_offset_ok != null);
      const lcRawOkRaw = (data.lc_raw_ok != null) ? Number(data.lc_raw_ok) : null;
      const lcRawOk = (lcRawOkRaw != null && isFinite(lcRawOkRaw)) ? (lcRawOkRaw !== 0) : false;
      const lcRawNum = (data.lc_raw != null) ? Number(data.lc_raw) : NaN;
      const lcReadyRaw = (data.lc_ready != null) ? Number(data.lc_ready) : null;
      const lcSatRaw = (data.lc_sat != null) ? Number(data.lc_sat) : null;
      const lcOffsetOkRaw = (data.lc_offset_ok != null) ? Number(data.lc_offset_ok) : null;
      const lcNoiseRaw = (data.lc_noise != null) ? Number(data.lc_noise) : null;
      const lcScaleRaw = (data.lc_scale != null) ? Number(data.lc_scale) : null;
      lastLoadcellRawValid = lcRawOk && isFinite(lcRawNum);
      lastLoadcellRaw = lastLoadcellRawValid ? lcRawNum : null;
      lastLoadcellReadyFlag = (lcReadyRaw != null && isFinite(lcReadyRaw)) ? (lcReadyRaw !== 0 ? 1 : 0) : null;
      lastLoadcellSaturated = !!(lcSatRaw != null && isFinite(lcSatRaw) && lcSatRaw !== 0);
      lastLoadcellOffsetValid = (lcOffsetOkRaw != null && isFinite(lcOffsetOkRaw)) ? (lcOffsetOkRaw !== 0 ? 1 : 0) : null;
      lastLoadcellNoiseDeadband = (lcNoiseRaw != null && isFinite(lcNoiseRaw)) ? lcNoiseRaw : lastLoadcellNoiseDeadband;
      lastLoadcellScale = (lcScaleRaw != null && isFinite(lcScaleRaw)) ? lcScaleRaw : lastLoadcellScale;
      lastLoadcellHz = isFinite(hxHz) ? hxHz : 0;
      if(isFinite(hxHz) && hxHz > 0){
        lastLoadcellHzDisplay = hxHz;
        lastLoadcellHzDisplayMs = hostTimeMs;
      }
      const hzDisplayHoldAlive =
        (!isReplaySample) &&
        ((hostTimeMs - lastLoadcellHzDisplayMs) <= LOADCELL_HZ_DISPLAY_HOLD_MS) &&
        (lcRawOk || lastLoadcellRawValid) &&
        isFinite(lastLoadcellHzDisplay) &&
        lastLoadcellHzDisplay > 0;
      const hxHzDisplay = (isFinite(hxHz) && hxHz > 0) ? hxHz : (hzDisplayHoldAlive ? lastLoadcellHzDisplay : 0);
      const hasHxHz = (data.hz != null || data.hx_hz != null);
      const loadcellCheckRequired = !isFlightModeUi();
      const loadcellRateLowNow = loadcellCheckRequired && !isReplaySample && hasHxHz && elapsedMs >= LOADCELL_HZ_FAULT_GRACE_MS && isFinite(hxHz) && hxHz <= LOADCELL_HZ_FAULT_MIN;
      if(loadcellRateLowNow){
        if(loadcellRateLowSinceMs === 0) loadcellRateLowSinceMs = hostTimeMs;
      }else{
        loadcellRateLowSinceMs = 0;
      }
      const loadcellRateFault = loadcellRateLowSinceMs !== 0 && (hostTimeMs - loadcellRateLowSinceMs) >= LOADCELL_HZ_FAULT_HOLD_MS;
      const loadcellOffsetFault = loadcellCheckRequired && !isReplaySample && elapsedMs >= LOADCELL_HZ_FAULT_GRACE_MS && lastLoadcellOffsetValid === 0;
      const loadcellHardFault = loadcellCheckRequired && (!thrustHasData || !isFinite(thrustVal) || lastLoadcellSaturated || loadcellOffsetFault);
      const loadcellStreamFault = loadcellCheckRequired && loadcellRateFault && !lastLoadcellRawValid;
      loadcellErrorActive = loadcellCheckRequired && ((simEnabled && devLoadcellError) || loadcellHardFault || loadcellStreamFault);
      if(!loadcellCheckRequired){
        dismissToastByKey("loadcell-error");
      }
      if(loadcellErrorActive){
        if(loadcellErrorSinceMs === 0) loadcellErrorSinceMs = hostTimeMs;
      }else{
        loadcellErrorSinceMs = 0;
      }
      if(lastLoadcellErrorActive === null){
        lastLoadcellErrorActive = loadcellErrorActive;
      }else if(loadcellErrorActive && !lastLoadcellErrorActive){
        lastLoadcellErrorActive = true;
      }else if(!loadcellErrorActive){
        lastLoadcellErrorActive = false;
      }
      if(
        !isFastReplaySeek &&
        loadcellErrorActive &&
        loadcellErrorSinceMs !== 0 &&
        (hostTimeMs - loadcellErrorSinceMs) >= LOADCELL_ERROR_TOAST_HOLD_MS &&
        (hostTimeMs - lastLoadcellErrorToastMs) >= LOADCELL_ERROR_TOAST_DEBOUNCE_MS
      ){
        showToast(t("loadcellErrorToast"), "error", {key:"loadcell-error", duration:6000});
        lastLoadcellErrorToastMs = hostTimeMs;
      }
      const thrustMissing = loadcellErrorActive;
      if(!isFastReplaySeek){
        updateLoadcellLiveValue(loadcellErrorActive ? null : thrustVal, shouldRefreshUi);
      }
      const p   = parsePressureMpa(data);
      const ax  = Number(data.ax != null ? data.ax : (data.accel_x ?? data.ax_g ?? 0));
      const ay  = Number(data.ay != null ? data.ay : (data.accel_y ?? data.ay_g ?? 0));
      const az  = Number(data.az != null ? data.az : (data.accel_z ?? data.az_g ?? 0));
      const gx  = Number(data.gx != null ? data.gx : (data.gyro_x ?? data.gx_dps ?? 0));
      const gy  = Number(data.gy != null ? data.gy : (data.gyro_y ?? data.gy_dps ?? 0));
      const gz  = Number(data.gz != null ? data.gz : (data.gyro_z ?? data.gz_dps ?? 0));
      const gr  = Number(data.gr != null ? data.gr : (data.gyro_roll_deg ?? data.roll_deg ?? NaN));
      const gp  = Number(data.gp != null ? data.gp : (data.gyro_pitch_deg ?? data.pitch_deg ?? NaN));
      const gyw = Number(data.gyw != null ? data.gyw : (data.gyro_yaw_deg ?? data.yaw_deg ?? NaN));
      const ga  = Number(data.ga != null ? data.ga : (data.gyro_att_ok ?? 0));
      // Firmware `lt` is sampler loop period in milliseconds.
      const lt  = Number(data.lt != null ? data.lt : (data.loop ?? data.loopTime ?? 0));
      const ltUs = (isFinite(lt) && lt > 0) ? (lt * 1000) : NaN;
      const ctUs = Number(data.ct != null ? data.ct : (data.cpu_us ?? data.cpu ?? 0));
      const perfLoadPct = (isFinite(ctUs) && ctUs > 0 && isFinite(ltUs) && ltUs > 0)
        ? Math.max(0, Math.min(100, (ctUs / ltUs) * 100))
        : NaN;
      if(isFinite(perfLoadPct)){
        lastPerfLoadRawPct = Number(perfLoadPct);
        if(lastPerfLoadPct == null || !isFinite(Number(lastPerfLoadPct))){
          lastPerfLoadPct = Number(perfLoadPct);
        }else{
          const prev = Number(lastPerfLoadPct);
          const smoothed = prev + ((Number(perfLoadPct) - prev) * PERF_LOAD_EMA_ALPHA);
          lastPerfLoadPct = Math.max(0, Math.min(100, smoothed));
        }
        lastPerfCpuUs = isFinite(ctUs) ? ctUs : null;
        lastPerfLoopUs = isFinite(ltUs) ? ltUs : null;
        lastPerfSampleMs = hostTimeMs;
      }

      const swRaw  = (data.s  != null ? data.s  : (data.sw  != null ? data.sw  : null));
      const icRaw  = (data.ic != null ? data.ic : (data.ign != null ? data.ign : null));
      const rlyRaw = (data.r  != null ? data.r  : (data.rly != null ? data.rly : null));
      const sw = Number(swRaw);
      const ic = Number(icRaw);
      const rly = Number(rlyRaw);
      const smRaw = (data.sm != null ? data.sm : (data.safe != null ? data.safe : null));
      const sm = reconcileBoardControlTelemetry(
        "safety",
        (smRaw != null) ? Number(smRaw) : null,
        !flashLinkWaitingForRemote
      );
      const alRaw = (data.al != null ? data.al : (data.arm_lock != null ? data.arm_lock : null));
      const al = reconcileBoardControlTelemetry(
        "armLock",
        (alRaw != null) ? Number(alRaw) : null,
        !flashLinkWaitingForRemote
      );
      const spRaw = (data.sp != null ? data.sp : (data.arm_physical != null ? data.arm_physical : null));
      const sp = (spRaw != null) ? Number(spRaw) : null;
      const swKnown = Number.isFinite(sw);
      const icKnown = Number.isFinite(ic);
      const rlyKnown = Number.isFinite(rly);
      const prevSwOn = !!(latestTelemetry && latestTelemetry.sw === 1);
      const prevIcOn = (latestTelemetry && latestTelemetry.ic != null) ? (latestTelemetry.ic === 1) : true;
      const prevRelayMask = (latestTelemetry && Number.isFinite(Number(latestTelemetry.rly)))
        ? Math.max(0, Math.trunc(Number(latestTelemetry.rly)))
        : 0;
      const armLockOn = (al != null && Number.isFinite(al))
        ? (al !== 0)
        : !!(latestTelemetry && latestTelemetry.al === 1);
      const physicalArmKnown = Number.isFinite(sp) || (!armLockOn && swKnown);
      const physicalArmOn = Number.isFinite(sp) ? (sp !== 0) : (physicalArmKnown && sw !== 0);
      const swOn = armLockOn || (swKnown ? (sw !== 0) : prevSwOn);
      const icOn = icKnown ? (ic !== 0) : prevIcOn;
      const relayMask = rlyKnown ? Math.max(0, Math.trunc(rly)) : prevRelayMask;
      const st  = Number(data.st != null ? data.st : (data.state ?? 0));
      const td  = (data.td != null ? Number(data.td) : null);
      const uw  = Number(data.uw ?? 0);
      const ab  = Number(data.ab != null ? data.ab : 0);
      const ar  = (data.ar != null ? Number(data.ar) : null);
      const gs  = Number(data.gs != null ? data.gs : data.igs ?? 0);
      const ipRaw = (data.ip != null)
        ? data.ip
        : ((data.inspection != null) ? data.inspection : (data.insp != null ? data.insp : null));
      const ip = (ipRaw != null) ? Number(ipRaw) : null;
      const srRaw = (data.sr != null) ? data.sr : (data.storage_ready != null ? data.storage_ready : null);
      const sr = (srRaw != null) ? Number(srRaw) : null;
      const mode = Number(data.m != null ? data.m : data.mode ?? -1);
      const wsQueueDropCount = Number(data.wq != null ? data.wq : (data.ws_queue_drop ?? 0));

      if(sr != null && Number.isFinite(sr)){
        spiFlashReadyState = (sr !== 0);
      }
      if(!isFastReplaySeek && ip != null && Number.isFinite(ip)){
        applyInspectionAuthorityFromTelemetry(ip);
      }

      if(!isReplaySample && isFinite(wsQueueDropCount)){
        handleWsBackpressureSignal(wsQueueDropCount);
      }

      // ✅ LOCKOUT 필드 매칭(펌웨어: rf/rm 우선)
      const lko = Number(data.lko ?? data.lockout ?? data.rf ?? 0);
      const rm  = Number(data.rm  ?? data.rmask   ?? data.rm ?? 0);
      const battRaw = data.vbatt ?? data.vbat ?? data.batt ?? data.battery ?? data.iv ?? null;
      if(battRaw != null && isFinite(Number(battRaw))){
        lastBatteryV = Number(battRaw);
      }
      const battPctRaw = data.bp ?? data.batt_pct ?? data.battery_pct ?? null;
      if(battPctRaw != null && isFinite(Number(battPctRaw))){
        const pct = Math.max(0, Math.min(100, Number(battPctRaw)));
        lastBatteryPct = pct;
      }
      const chipTempOkRaw = data.chip_temp_ok ?? data.ctemp_ok ?? data.chipTempOk ?? null;
      const chipTempRaw = data.chip_temp_c ?? data.ctemp ?? data.chip_temp ?? data.chipTemp ?? null;
      const chipTempOk = (chipTempOkRaw == null) ? true : (Number(chipTempOkRaw) !== 0);
      if(chipTempRaw != null && chipTempOk && isFinite(Number(chipTempRaw))){
        const parsedChipTemp = Number(chipTempRaw);
        if(lastChipTempSampleMs === 0 && chipTempHistory.length){
          for(let i=0;i<chipTempHistory.length;i++) chipTempHistory[i] = parsedChipTemp;
        }
        lastChipTempC = parsedChipTemp;
        lastChipTempSampleMs = Date.now();
      }

      if(uiSettings && !isReplaySample && !simEnabled){
        const activeEl = document.activeElement;
        const boardIgnRaw = data.ign_ms ?? data.ignition_ms ?? data.ignDurationMs ?? null;
        const boardCdRaw = data.cd_ms ?? data.countdown_ms ?? data.countdownDurationMs ?? null;
        const boardPyroRaw = data.daq_seq_pyro ?? data.daq_pyro ?? data.pyro_ch ?? null;
        const missionTimingFields = [
          ["missionStage1SeparationBackupMs", data.mission_s1_sep_backup_ms, 500, 15000],
          ["missionStage1EjectionDelayMs", data.mission_s1_eject_delay_ms, 100, 10000],
          ["missionStage2EjectionDelayMs", data.mission_s2_eject_delay_ms, 500, 30000],
          ["missionLaunchGraceMs", data.mission_launch_grace_ms, 1000, 30000],
          ["missionLinkLossMs", data.mission_link_loss_ms, 200, 5000],
          ["missionStage1SeparationAngleDeg", data.mission_s1_sep_angle_deg, 0, 180],
          ["missionStage1EjectionAngleDeg", data.mission_s1_eject_angle_deg, 0, 180],
          ["missionStage2EjectionAngleDeg", data.mission_s2_eject_angle_deg, 0, 180]
        ];
        const boardLinkModeRaw = data.link_mode ?? data.transport_mode ?? null;
        const boardOpModeRaw = boardLinkModeRaw ?? data.op_mode ?? data.operation_mode ?? null;
        const boardFlashLinkRoleRaw = data.flash_link_role ?? data.fl_role ?? null;
        const boardFlashLinkDataModeRaw = data.flash_link_data_mode ?? data.fl_data_mode ?? null;
        const boardFlashLinkNodeRaw = data.flash_link_node_id ?? data.fl_node ?? null;
        const boardFlashLinkTargetRaw = data.flash_link_target_node_id ?? data.fl_target ?? null;
        const boardFlashLinkStage2ModeRaw = data.flash_link_stage2_mode ?? data.fl_stage2_mode ?? null;
        let boardSettingsChanged = false;
        if(boardOpModeRaw != null && activeEl !== el.opModeSelect){
          const nextMode = normalizeOperationModeValue(boardOpModeRaw);
          confirmOperationModeFromBoard(nextMode);
          if(!isOperationModeConfirmPending() && nextMode !== uiSettings.opMode){
            uiSettings.opMode = nextMode;
            boardSettingsChanged = true;
          }
        }else if(boardOpModeRaw != null){
          confirmOperationModeFromBoard(boardOpModeRaw);
        }
        if(boardFlashLinkRoleRaw != null && activeEl !== el.flashLinkRoleSelect){
          const nextFlashLinkRole = normalizeFlashLinkRole(boardFlashLinkRoleRaw);
          if(nextFlashLinkRole !== uiSettings.flashLinkRole){
            uiSettings.flashLinkRole = nextFlashLinkRole;
            boardSettingsChanged = true;
          }
        }
        if(boardFlashLinkDataModeRaw != null && activeEl !== el.flashLinkDataModeSelect){
          const nextFlashLinkDataMode = normalizeDataModeValue(boardFlashLinkDataModeRaw, uiSettings.flashLinkDataMode || "flight");
          if(nextFlashLinkDataMode !== uiSettings.flashLinkDataMode){
            uiSettings.flashLinkDataMode = nextFlashLinkDataMode;
            boardSettingsChanged = true;
          }
        }
        if(boardFlashLinkNodeRaw != null && activeEl !== el.flashLinkNodeSelect){
          const nextNodeId = normalizeFlashLinkNodeId(boardFlashLinkNodeRaw);
          if(nextNodeId !== uiSettings.flashLinkNodeId){
            uiSettings.flashLinkNodeId = nextNodeId;
            boardSettingsChanged = true;
          }
        }
        if(boardFlashLinkTargetRaw != null){
          const nextTargetNodeId = normalizeFlashLinkNodeId(boardFlashLinkTargetRaw);
          if(nextTargetNodeId !== uiSettings.flashLinkTargetNodeId){
            uiSettings.flashLinkTargetNodeId = nextTargetNodeId;
            boardSettingsChanged = true;
          }
        }
        if(boardFlashLinkStage2ModeRaw != null && activeEl !== el.flashLinkStage2ModePill){
          const nextStage2Mode = Number(boardFlashLinkStage2ModeRaw) !== 0;
          if(nextStage2Mode !== uiSettings.flashLinkStage2Mode){
            uiSettings.flashLinkStage2Mode = nextStage2Mode;
            boardSettingsChanged = true;
          }
        }
        if(boardIgnRaw != null && activeEl !== el.ignTimeInput && isFinite(Number(boardIgnRaw))){
          const nextIgn = Math.max(100, Math.min(3000, Math.round(Number(boardIgnRaw))));
          if(nextIgn !== uiSettings.ignDurationMs){
            uiSettings.ignDurationMs = nextIgn;
            boardSettingsChanged = true;
          }
        }
        if(boardCdRaw != null && activeEl !== el.countdownSecInput && isFinite(Number(boardCdRaw))){
          const nextCd = Math.max(3, Math.min(60, Math.round(Number(boardCdRaw) / 1000)));
          if(nextCd !== uiSettings.countdownSec){
            uiSettings.countdownSec = nextCd;
            boardSettingsChanged = true;
          }
        }
        if(boardPyroRaw != null && activeEl !== el.daqSequencePyroSelect){
          const nextPyro = normalizePyroChannel(boardPyroRaw, uiSettings.daqSequencePyroChannel || 1);
          if(nextPyro !== uiSettings.daqSequencePyroChannel){
            uiSettings.daqSequencePyroChannel = nextPyro;
            boardSettingsChanged = true;
          }
        }
        missionTimingFields.forEach(([key, raw, min, max])=>{
          if(raw == null || !isFinite(Number(raw))) return;
          const next = Math.max(min, Math.min(max, Math.round(Number(raw))));
          if(uiSettings[key] !== next){
            uiSettings[key] = next;
            boardSettingsChanged = true;
          }
        });
        if(boardSettingsChanged){
          saveSettings();
          applySettingsToUI();
        }
      }
      if(!isReplaySample) updateFlashLinkStatusUi(data, shouldRefreshUi);

      if(!isFastReplaySeek && isFirmwareSequenceRunningState(st) &&
         confirmOverlayEl &&
         !confirmOverlayEl.classList.contains("hidden")){
        closeSequenceStartOverlay(false);
      }
      if(shouldRefreshUi){
        syncSequenceInteractionState(st);
      }
      currentSt=st;
      if(isFirmwareSequenceRunningState(st)){
        userWaitingLocal = false;
        missionStandbyUiActive = false;
      }else if(st === 0 && uw && td != null && Number(td) === 0){
        missionStandbyUiActive = true;
      }else if(st === 0 && !uw){
        missionStandbyUiActive = false;
      }
      sequenceActive = (
        st === 0 &&
        (
          !!uw ||
          (td != null && isFinite(td) && Number(td) !== 0)
        )
      );
      if(ar != null){
        const mapped = mapAbortReasonCode(ar);
        if(mapped){
          lastAbortReason = mapped;
        }else if(!ab){
          lastAbortReason = null;
        }
      }
      if(st===2 && st2StartMs===null) st2StartMs=Date.now();
      if(st!==2) st2StartMs=null;
      const allowClientTplusFallback = isReplaySample || simEnabled;
      if(st===3){
        localTplusActive = false;
        localTplusStartMs = null;
      }else if(allowClientTplusFallback && st===2){
        if(localTplusStartMs===null) localTplusStartMs=Date.now();
        localTplusActive = true;
      }else if(st===1 || !allowClientTplusFallback){
        localTplusActive = false;
        localTplusStartMs = null;
      }else if(st===0 && localTplusStartMs!=null){
        localTplusActive = true;
      }
      updateParachuteDeployState(st, relayMask, !!ab, timeMs);
      latestTelemetry = {
        sw: swOn ? 1 : 0,
        swPhysical: physicalArmKnown ? (physicalArmOn ? 1 : 0) : null,
        ic: icOn ? 1 : 0,
        rly: relayMask,
        mode,
        gs,
        uw: uw?1:0,
        td: (td != null && isFinite(td)) ? Number(td) : null,
        sm: (sm != null) ? (sm ? 1 : 0) : (safetyModeEnabled ? 1 : 0),
        al: (al != null) ? (al ? 1 : 0) : null,
        lc_raw: lastLoadcellRaw,
        lc_raw_ok: lastLoadcellRawValid ? 1 : 0,
        lc_ready: lastLoadcellReadyFlag,
        lc_sat: lastLoadcellSaturated ? 1 : 0,
        lc_offset_ok: lastLoadcellOffsetValid,
        deployment_state:(data.deployment_state != null && isFinite(Number(data.deployment_state)))
          ? Number(data.deployment_state)
          : 0,
        deployment_flags:(data.deployment_flags != null && isFinite(Number(data.deployment_flags)))
          ? Number(data.deployment_flags)
          : 0,
        flight_phase_code:(data.flight_phase_code != null && isFinite(Number(data.flight_phase_code)))
          ? Number(data.flight_phase_code)
          : 0,
        gps_fix: (data.gps_fix != null) ? (Number(data.gps_fix) ? 1 : 0) : null,
        gps_seen: (data.gps_seen != null) ? (Number(data.gps_seen) ? 1 : 0) : null,
        gps_age_ms: (data.gps_age_ms != null && isFinite(Number(data.gps_age_ms))) ? Number(data.gps_age_ms) : null
      };
      if(!isFastReplaySeek){
        updateGpsFixAlarm(data, isReplaySample);
      }
      const telemetryGeo = extractTelemetryGeo(data, {koreaOnly:false}) ||
        ((simEnabled && !replaySourceActive && simState && simState.lastGeo) ? simState.lastGeo : null);
      if(telemetryGeo && isFinite(Number(telemetryGeo.lat)) && isFinite(Number(telemetryGeo.lon))){
        const geoLat = Number(telemetryGeo.lat);
        const geoLon = Number(telemetryGeo.lon);
        const geoAlt = Number(telemetryGeo.alt);
        latestTelemetryGeo = {
          lat: geoLat,
          lon: geoLon,
          alt: isFinite(geoAlt) ? geoAlt : NaN,
          fix: (data.gps_fix != null) ? (Number(data.gps_fix) ? 1 : 0) : 1,
          seen: (data.gps_seen != null) ? (Number(data.gps_seen) ? 1 : 0) : 1,
          ts: Date.now()
        };
        if(latestTelemetry){
          latestTelemetry.gps_lat = geoLat;
          latestTelemetry.gps_lon = geoLon;
          latestTelemetry.gps_alt = isFinite(geoAlt) ? geoAlt : null;
        }
        if(shouldRefreshUi){
          updateIntelligentCalibrationMap();
        }
      }
      if(!isFastReplaySeek){
        updateStatusMapFromTelemetry(data);
      }
      if(stageTelemetryModeActive){
        applyActiveStageGyroAttitude(timeMs);
      }else if(!(ga !== 0 && applyFirmwareGyroAttitudeEstimate(
        gr,
        gp,
        gyw,
        timeMs,
        gx,
        gy,
        gz,
        data.attitude_q ?? data.attitudeQuat ?? null))){
        updateGyroAttitudeEstimate(ax, ay, az, gx, gy, gz, timeMs);
      }
      const motionTelemetryData = stageTelemetryModeActive
        ? (getActiveGyroTelemetryData(data) || data)
        : data;
      const motionAx = Number(motionTelemetryData && motionTelemetryData.ax);
      const motionAy = Number(motionTelemetryData && motionTelemetryData.ay);
      const motionAz = Number(motionTelemetryData && motionTelemetryData.az);
      const quickFlight = getQuickFlightMetrics(motionTelemetryData, timeMs);
      const quickAltitudeM = isFinite(quickFlight.altitudeM)
        ? ((Math.abs(quickFlight.altitudeM) < 0.05) ? 0 : quickFlight.altitudeM)
        : NaN;
      const quickSpeedMps = isFinite(quickFlight.speedMps) ? Math.max(0, quickFlight.speedMps) : NaN;
      if(isFinite(quickSpeedMps)){
        // Replay-derived speed is display state, not a field that existed in
        // the source recording. Do not mutate legacy replay samples into
        // looking like they contain a trustworthy recorded scalar speed.
        if(!isReplaySample) data.actual_speed_mps = quickSpeedMps;
        if(motionTelemetryData && motionTelemetryData !== data){
          const activeStageState = stageTelemetryStore[cameraHudActiveStageId];
          if(activeStageState) activeStageState.speedMps = quickSpeedMps;
        }
      }
      if(!isFastReplaySeek){
        recordIncomingSampleToApp(data, src, isReplaySample);
      }
      const ascentAccelG = calcAscentAccelG(motionAx, motionAy, motionAz);
      const quickTotalAccelG = calcTotalAccelG(motionAx, motionAy, motionAz);
      const firmwareFlightPhaseInfo = readFirmwareFlightPhase(motionTelemetryData);
      const flightPhaseInfo = isFlightModeUi()
        ? (firmwareFlightPhaseInfo ||
          updateDerivedFlightPhase(quickAltitudeM, quickSpeedMps, quickTotalAccelG, timeMs))
        : null;
      const telemetryAltitudeRateMps = readTelemetryVerticalSpeedMps(motionTelemetryData);
      let quickAltitudeRateMps = isFinite(telemetryAltitudeRateMps)
        ? telemetryAltitudeRateMps
        : Number(flightPhaseInfo && flightPhaseInfo.verticalSpeedMps);
      if(!isFinite(quickAltitudeRateMps)) quickAltitudeRateMps = 0;
      if(Math.abs(quickAltitudeRateMps) < 0.05) quickAltitudeRateMps = 0;
      updateGyroPathFromTelemetry(motionTelemetryData, timeMs, {
        altitudeM:quickAltitudeM,
        verticalSpeedMps:quickAltitudeRateMps,
        phase:flightPhaseInfo && flightPhaseInfo.phase
          ? flightPhaseInfo.phase
          : null
      });
      if(!isFastReplaySeek && !stageTelemetryModeActive){
        scheduleLiveGyroRender(gy);
      }
      // Only the 3D gyro rocket is pinned to the pad before launch. Charts and
      // telemetry HUDs must continue to show the actual barometric altitude.
      const gyroPreviewAltitudeM = isGyroAltitudeLaunchActive(
        st,
        firmwareFlightPhaseInfo ? firmwareFlightPhaseInfo.phase : "")
        ? quickAltitudeM
        : 0;
      // Live mission execution is handled onboard (ESP32 internal flash runtime).
      // Keep JS mission runtime only for replay/simulator validation.
      if(isReplaySample || simEnabled){
        processReplayMissionRuntime(data, {
          sampleTimeMs: isReplaySample ? Number(data && data._replayTsMs) : timeMs,
          altitudeM: quickAltitudeM,
          sw: swOn ? 1 : 0,
          st,
          tdMs: td,
          thrustKgf: thrustVal,
          gyroXDeg: gyroRollDeg,
          gyroYDeg: gyroPitchDeg,
          gyroZDeg: gyroYawDeg
        }, isReplaySample);
      }
      const firmwareMissionLocked =
        data.mission_locked ?? data.missionLocked ?? null;
      if(firmwareMissionLocked != null){
        setMissionFirmwareCapability(
          Number(firmwareMissionLocked) !== 0,
          data.mission_source ?? data.missionSource ?? "",
          Number(firmwareMissionLocked) !== 0 ? "BUILTIN_MISSION" : ""
        );
      }
      const fwBoard = data.fw_board ?? data.fwBoard ?? null;
      const fwProgram = data.fw_program ?? data.fwProgram ?? null;
      const fwProtocol = data.fw_protocol ?? data.fwProtocol ?? null;
      let firmwareIdentityChanged = false;
      if(fwBoard && el.hwBoardName){
        const value = String(fwBoard);
        if(el.hwBoardName.textContent !== value){
          el.hwBoardName.textContent = value;
          firmwareIdentityChanged = true;
        }
      }
      if(fwProgram && el.hwFirmwareName){
        const value = String(fwProgram);
        if(el.hwFirmwareName.textContent !== value){
          el.hwFirmwareName.textContent = value;
          firmwareIdentityChanged = true;
        }
      }
      if(fwProtocol && el.hwProtocolName){
        const value = String(fwProtocol);
        if(el.hwProtocolName.textContent !== value){
          el.hwProtocolName.textContent = value;
          firmwareIdentityChanged = true;
        }
      }
      if(firmwareIdentityChanged && shouldRefreshUi){
          syncMobileSequenceStatus();
          syncMobileBoardHeader();
      }

      if(st===0){
        igniterAbortSent = false;
        if(!ab) lastAbortReason = null;
      }else if(st===1 && isIgniterCheckEnabled() && icKnown && !icOn && !igniterAbortSent){
        igniterAbortSent = true;
        lastAbortReason = "igniter";
        sendCommand({http:"/abort", ser:"ABORT"}, true);
        addLogLine(t("igniterLostAbortLog"), "ABORT");
        showToast(t("igniterLostAbortToast", {safety:safetyLineSuffix()}), "error");
      }

      thrustBaseHistory.push(thrustVal);
      pressureBaseHistory.push(p);
      // Keep altitude continuity: missing/invalid sample should not inject a hard zero spike.
      const prevAltitude = quickAltitudeHistory.length ? quickAltitudeHistory[quickAltitudeHistory.length - 1] : 0;
      quickAltitudeHistory.push(isFinite(quickAltitudeM) ? quickAltitudeM : (isFinite(prevAltitude) ? prevAltitude : 0));
      const prevAltitudeRate = quickAltitudeRateHistory.length
        ? quickAltitudeRateHistory[quickAltitudeRateHistory.length - 1]
        : 0;
      quickAltitudeRateHistory.push(isFinite(quickAltitudeRateMps)
        ? quickAltitudeRateMps
        : (isFinite(prevAltitudeRate) ? prevAltitudeRate : 0));
      const prevVelocity = quickVelocityHistory.length ? quickVelocityHistory[quickVelocityHistory.length - 1] : 0;
      quickVelocityHistory.push(isFinite(quickSpeedMps) ? quickSpeedMps : (isFinite(prevVelocity) ? prevVelocity : 0));
      const prevSpeed = quickSpeedHistory.length ? quickSpeedHistory[quickSpeedHistory.length - 1] : 1;
      quickSpeedHistory.push(isFinite(quickTotalAccelG) ? quickTotalAccelG : (isFinite(prevSpeed) ? prevSpeed : 1));
      const gyroSpeedDps = Math.sqrt((gx * gx) + (gy * gy) + (gz * gz));
      gyroSpeedHistory.push(isFinite(gyroSpeedDps) ? gyroSpeedDps : 0);
      const accelMagVal = quickTotalAccelG;
      accelMagHistory.push(accelMagVal);
      ascentAccelHistory.push(isFinite(ascentAccelG) ? ascentAccelG : 0);
      accelXHistory.push(ax);
      accelYHistory.push(ay);
      accelZHistory.push(az);
      gyroXHistory.push(gx);
      gyroYHistory.push(gy);
      gyroZHistory.push(gz);
      const prevChipTemp = chipTempHistory.length ? Number(chipTempHistory[chipTempHistory.length - 1]) : 0;
      chipTempHistory.push((lastChipTempC != null && isFinite(Number(lastChipTempC)))
        ? Number(lastChipTempC)
        : (isFinite(prevChipTemp) ? prevChipTemp : 0));
      const prevPerfLoad = perfLoadHistory.length ? Number(perfLoadHistory[perfLoadHistory.length - 1]) : 0;
      perfLoadHistory.push((lastPerfLoadPct != null && isFinite(Number(lastPerfLoadPct)))
        ? Number(lastPerfLoadPct)
        : (isFinite(prevPerfLoad) ? prevPerfLoad : 0));
      const prevBatteryPct = batteryPctHistory.length ? Number(batteryPctHistory[batteryPctHistory.length - 1]) : 0;
      batteryPctHistory.push((lastBatteryPct != null && isFinite(Number(lastBatteryPct)))
        ? Number(lastBatteryPct)
        : (isFinite(prevBatteryPct) ? prevBatteryPct : 0));
      chartTimeHistory.push(timeMs);

      const maxKeep=MAX_POINTS*4;
      if(thrustBaseHistory.length > maxKeep + HISTORY_TRIM_CHUNK){
        const remove = thrustBaseHistory.length - maxKeep;
        thrustBaseHistory.splice(0, remove);
        pressureBaseHistory.splice(0, remove);
        quickAltitudeHistory.splice(0, remove);
        quickAltitudeRateHistory.splice(0, remove);
        quickVelocityHistory.splice(0, remove);
        quickSpeedHistory.splice(0, remove);
        gyroSpeedHistory.splice(0, remove);
        accelMagHistory.splice(0, remove);
        ascentAccelHistory.splice(0, remove);
        accelXHistory.splice(0, remove);
        accelYHistory.splice(0, remove);
        accelZHistory.splice(0, remove);
        gyroXHistory.splice(0, remove);
        gyroYHistory.splice(0, remove);
        gyroZHistory.splice(0, remove);
        chipTempHistory.splice(0, remove);
        perfLoadHistory.splice(0, remove);
        batteryPctHistory.splice(0, remove);
        chartTimeHistory.splice(0, remove);
      }

      sampleHistory.push({timeMs,timeIso,t:thrustVal,p,lt,elapsed:elapsedMs,hz:hxHz,ct:ctUs,sw:swOn?1:0,ic:icOn?1:0,r:relayMask,st,td});
      trimArrayToMax(sampleHistory, SAMPLE_HISTORY_MAX, HISTORY_TRIM_CHUNK);

      logData.push({
        time:timeIso,origin:dataOrigin,t:thrustVal,p,alt_m:quickAltitudeM,speed_mps:quickSpeedMps,
        vertical_speed_mps:quickAltitudeRateMps,
        flight_phase: flightPhaseInfo ? flightPhaseInfo.phase : null,
        flight_phase_code:(data.flight_phase_code != null && isFinite(Number(data.flight_phase_code)))
          ? Number(data.flight_phase_code)
          : null,
        gps_lat:(telemetryGeo && isFinite(Number(telemetryGeo.lat))) ? Number(telemetryGeo.lat) : null,
        gps_lon:(telemetryGeo && isFinite(Number(telemetryGeo.lon))) ? Number(telemetryGeo.lon) : null,
        gps_alt:(telemetryGeo && isFinite(Number(telemetryGeo.alt))) ? Number(telemetryGeo.alt) : null,
        gps_age_ms:(data.gps_age_ms != null && isFinite(Number(data.gps_age_ms))) ? Number(data.gps_age_ms) : null,
        gps_fix:(data.gps_fix != null) ? (Number(data.gps_fix) ? 1 : 0) : null,
        gps_seen:(data.gps_seen != null) ? (Number(data.gps_seen) ? 1 : 0) : null,
        gps_time_valid:(data.gps_time_valid != null) ? (Number(data.gps_time_valid) ? 1 : 0) : null,
        gps_utc_ms:(data.gps_utc_ms != null && isFinite(Number(data.gps_utc_ms))) ? Number(data.gps_utc_ms) : null,
        ax,ay,az,gx,gy,gz,lt,elapsed:elapsedMs,hz:hxHz,ct:ctUs,
        s:swOn?1:0,sp:physicalArmKnown?(physicalArmOn?1:0):null,al:armLockOn?1:0,
        ic:icOn?1:0,r:relayMask,gs,st,td,
        deployment_state:(data.deployment_state != null && isFinite(Number(data.deployment_state)))
          ? Number(data.deployment_state)
          : null,
        deployment_flags:(data.deployment_flags != null && isFinite(Number(data.deployment_flags)))
          ? Number(data.deployment_flags)
          : null,
        mission_alarm_events:Array.isArray(data.mission_alarm_events)
          ? data.mission_alarm_events.map((event)=>Object.assign({}, event))
          : []
      });
      logDataRevision += 1;
      trimArrayToMax(logData, RAW_LOG_MAX, HISTORY_TRIM_CHUNK);
      if(shouldRefreshUi){
        updateExportGuardUi();
      }

      // ✅ LOCKOUT 반영(보드가 내보내면)
      if(lko === 1){
        if(!lockoutLatched){
          lockoutLatched = true;
          lockoutRelayMask = rm || 0;
          controlAuthority = false;
          inspectionState = "failed";

          const name = relayMaskName(lockoutRelayMask);
          if(!isFastReplaySeek){
            setLockoutVisual(true);

            addLogLine(t("lockoutDetectedLog", {name}), "SAFE");
            notifyAlarm("RELAY_LOCKOUT", {name}, {force:true});

            showLockoutModal();
          }
        }else{
          if(rm){
            const nextMask = (lockoutRelayMask || 0) | rm;
            if(nextMask !== lockoutRelayMask){
              lockoutRelayMask = nextMask;
              if(!isFastReplaySeek) setLockoutVisual(true);
            }
          }
        }
        if(!isFastReplaySeek) updateControlAccessUI(currentSt);
      }

      // 점화 분석
      if(st===2 && prevStForIgn!==2){
        ignitionAnalysis=createIgnitionAnalysis(timeMs);
        lastBurnSeconds = null;
        if(!isFastReplaySeek){
          addLogLine(t("ignitionSignal", {
            window:IGN_PRESSURE_WINDOW_THRESHOLD_MPA.toFixed(1),
            burn:IGN_PRESSURE_BURN_THRESHOLD_MPA.toFixed(1)
          }),"IGN");
        }
      }

      const pressureForIgn = Number(p);
      const thrustForIgn = Number(thrustVal);
      const firmwareIgnitionDelayMs = Number(data.ignition_delay_ms);
      const firmwareIgnitionDelayValid = Number(data.ignition_delay_valid) !== 0 &&
        isFinite(firmwareIgnitionDelayMs) && firmwareIgnitionDelayMs >= 0;
      const pressureWindowReached = isFinite(pressureForIgn) && pressureForIgn >= IGN_PRESSURE_WINDOW_THRESHOLD_MPA;
      const pressureWindowAbove = isFinite(pressureForIgn) && pressureForIgn > IGN_PRESSURE_WINDOW_THRESHOLD_MPA;
      const pressureBurnActive = isFinite(pressureForIgn) && pressureForIgn >= IGN_PRESSURE_BURN_THRESHOLD_MPA;
      const thrustBurnActive = isFinite(thrustForIgn) && thrustForIgn >= IGN_THRUST_THRESHOLD;
      if(
        pressureWindowReached &&
        ignitionAnalysis.windowCloseMs!=null &&
        ignitionAnalysis.windowEndMs!=null &&
        timeMs > ignitionAnalysis.windowEndMs
      ){
        ignitionAnalysis=createIgnitionAnalysis(st===2 ? timeMs : null);
        lastBurnSeconds = null;
      }
      if(ignitionAnalysis.ignStartMs==null && thrustBurnActive){
        ignitionAnalysis.ignStartMs=timeMs;
      }
      let startedPressureWindow = false;
      if(pressureWindowReached){
        if(ignitionAnalysis.windowTriggerMs==null){
          ignitionAnalysis.windowTriggerMs=timeMs;
          ignitionAnalysis.windowStartMs=Math.max(0, timeMs-IGN_PRE_WINDOW_MS);
          if(!isFastReplaySeek){
            addLogLine(t("ignitionWindowLog", {thr:IGN_PRESSURE_WINDOW_THRESHOLD_MPA.toFixed(1)}),"IGN");
          }
          startedPressureWindow = true;
        }else if(ignitionAnalysis.windowCloseMs!=null){
          ignitionAnalysis.windowCloseMs=null;
        }
      }
      if(ignitionAnalysis.windowTriggerMs!=null && ignitionAnalysis.windowCloseMs==null){
        if(pressureWindowAbove || startedPressureWindow){
          ignitionAnalysis.windowEndMs=timeMs+IGN_POST_WINDOW_MS;
          if(!isFastReplaySeek) applyIgnitionChartWindow();
        }else if(isFinite(pressureForIgn) && pressureForIgn <= IGN_PRESSURE_WINDOW_THRESHOLD_MPA){
          ignitionAnalysis.windowCloseMs=timeMs;
          ignitionAnalysis.windowEndMs=timeMs+IGN_POST_WINDOW_MS;
          if(!isFastReplaySeek){
            addLogLine(t("ignitionWindowClosedLog", {thr:IGN_PRESSURE_WINDOW_THRESHOLD_MPA.toFixed(1)}),"IGN");
            applyIgnitionChartWindow();
          }
        }
      }

      if(firmwareIgnitionDelayValid){
        ignitionAnalysis.delaySec = firmwareIgnitionDelayMs / 1000;
      }

      if(thrustBurnActive){
        if(ignitionAnalysis.thresholdMs==null){
          ignitionAnalysis.thresholdMs=timeMs;
          if(!firmwareIgnitionDelayValid){
            ignitionAnalysis.delaySec=(ignitionAnalysis.thresholdMs-ignitionAnalysis.ignStartMs)/1000.0;
          }
          if(!isFastReplaySeek){
            addLogLine(t("ignitionThresholdLog", {thr:IGN_THRUST_THRESHOLD.toFixed(1), delay:ignitionAnalysis.delaySec.toFixed(3)}),"IGN");
            showToast(t("ignitionThresholdToast", {thr:IGN_THRUST_THRESHOLD.toFixed(1), delay:ignitionAnalysis.delaySec.toFixed(3), safety:safetyLineSuffix()}),"ignite");
          }
        }
        ignitionAnalysis.lastAboveMs=timeMs;
        ignitionAnalysis.durationSec=Math.max(0,(ignitionAnalysis.lastAboveMs-ignitionAnalysis.thresholdMs)/1000.0);
        ignitionAnalysis.hasData=true;
      }else if(ignitionAnalysis.thresholdMs!=null && ignitionAnalysis.lastAboveMs!=null){
        ignitionAnalysis.durationSec=Math.max(0,(ignitionAnalysis.lastAboveMs-ignitionAnalysis.thresholdMs)/1000.0);
      }

      if(prevStForIgn===2 && st!==2 && ignitionAnalysis.ignStartMs!=null && !ignitionAnalysis.endNotified){
        ignitionAnalysis.endNotified=true;
        if(ignitionAnalysis.durationSec!=null){
          if(!isFastReplaySeek){
            addLogLine(t("ignitionEndLog", {dur:ignitionAnalysis.durationSec.toFixed(3)}),"IGN");
            showToast(t("ignitionEndToast"),"info");
          }
        }else{
          if(!isFastReplaySeek){
            addLogLine(t("ignitionNoThrustLog"),"IGN");
            showToast(t("ignitionNoThrustToast", {safety:safetyLineSuffix()}),"warn");
          }
        }
      }
      prevStForIgn=st;
      if(shouldRefreshUi){
        updateMotorInfoPanel();
        renderChipTempModal();
        renderPerfModal();
      }

      // UI 업데이트는 데이터 수집과 분리한다. 라이브 데이터는 모두 보존하고
      // DOM/Canvas 렌더링만 제한해 입력 및 3D 자세 반응 시간을 안정화한다.
      if(shouldRefreshUi){
        updateConnectionUI(true);
        disconnectedLogged=false;

        if(prevSwState===null) prevSwState=swOn;
        else if(prevSwState!==swOn){
          prevSwState=swOn;
          if(prevSwState){
            addLogLine(t("switchHighLog"), "SW");
            if(isIgniterCheckEnabled() && icKnown && !icOn){
              showToast(t("countdownIgniterRequired", {safety:safetyLineSuffix()}), "notice");
            }else{
              showToast(t("switchHighToast", {safety:safetyLineSuffix()}),"warn");
            }
          }else{
            addLogLine(t("switchLowLog"), "SW");
            showToast(t("switchLowToast", {safety:safetyLineSuffix()}),"info");
          }
        }

        if(icKnown){
          if(prevIcState===null) prevIcState=icOn;
          else if(prevIcState!==icOn){
            prevIcState=icOn;
            if(prevIcState){
              addLogLine(t("igniterOkLog"), "IGN");
              showToast(t("igniterOkToast", {safety:safetyLineSuffix()}),"success");
            }else{
              addLogLine(t("igniterNoLog"), "IGN");
              showToast(t("igniterNoToast", {safety:safetyLineSuffix()}),"warn");
              if(isIgniterCheckEnabled()){
                controlAuthority = false;
                inspectionState = "failed";
                updateInspectionPill();
                updateControlAccessUI(currentSt);
                showToast(t("inspectionRequiredToast"), "notice");
              }
            }
          }
        }

        if(prevGsState===null) prevGsState=!!gs;
        else if(prevGsState!==!!gs){
          prevGsState=!!gs;
          if(prevGsState){
            addLogLine(t("igsOnLog"), "SAFE");
            showToast(t("igsOnToast", {safety:safetyLineSuffix()}),"warn",{key:"igs-toggle"});
          }else{
            addLogLine(t("igsOffLog"), "SAFE");
            showToast(t("igsOffToast", {safety:safetyLineSuffix()}),"info",{key:"igs-toggle"});
          }
        }

        if(sm != null){
          if(prevSmState===null) prevSmState=!!sm;
          else if(prevSmState!==!!sm){
            prevSmState=!!sm;
          }
          safetyModeEnabled = !!sm;
          if(uiSettings){
            uiSettings.safetyMode = safetyModeEnabled;
            saveSettings();
          }
        }

        const thrustDisp=convertThrustForDisplay(thrustVal);
        const thrustUnit = (uiSettings && uiSettings.thrustUnit) ? uiSettings.thrustUnit : "kgf";
        const inFlightMode = isFlightModeUi();
        updateQuickMetricLabels();
        updateQuickAuxLabels();
        if(inFlightMode){
          const altVal = quickAltitudeM;
          if(el.thrust){
            const metric = el.thrust.closest(".status-metric");
            if(metric){
              metric.classList.remove("is-alert");
              metric.classList.remove("loadcell-blink");
            }
            el.thrust.innerHTML = isFinite(altVal)
              ? `<span class="num">${altVal.toFixed(1)}</span><span class="unit">m</span>`
              : `<span class="num">--</span><span class="unit">m</span>`;
          }
          if(el.pressure){
            el.pressure.innerHTML = isFinite(quickSpeedMps)
              ? `<span class="num">${quickSpeedMps.toFixed(1)}</span><span class="unit">m/s</span>`
              : `<span class="num">--</span><span class="unit">m/s</span>`;
          }
        }else{
          resetQuickFlightMetricsState();
          if(el.thrust){
            const metric = el.thrust.closest(".status-metric");
            if(thrustMissing){
              el.thrust.innerHTML = "로드셀 시스템을<br>점검하세요";
              if(metric) metric.classList.add("is-alert");
              if(metric) metric.classList.toggle("loadcell-blink", loadcellErrorActive);
            }else{
              if(metric) metric.classList.remove("is-alert");
              if(metric) metric.classList.remove("loadcell-blink");
              el.thrust.innerHTML = `<span class="num">${formatThrustDisplay(thrustDisp)}</span><span class="unit">${thrustUnit}</span>`;
            }
          }
          if(el.pressure) el.pressure.innerHTML = `<span class="num">${formatQuickPressureDisplay(p)}</span><span class="unit">MPa</span>`;
        }
      syncExpandedQuickMetrics();
      if(inFlightMode && el.gyro3dHudMetricPrimaryValue){
        el.gyro3dHudMetricPrimaryValue.innerHTML = isFinite(gyroPreviewAltitudeM)
          ? `<span class="num">${gyroPreviewAltitudeM.toFixed(1)}</span><span class="unit">m</span>`
          : `<span class="num">--</span><span class="unit">m</span>`;
      }
      if(el.accelX) el.accelX.innerHTML = `<span class="num">${ax.toFixed(3)}</span><span class="unit">g</span>`;
      if(el.accelY) el.accelY.innerHTML = `<span class="num">${ay.toFixed(3)}</span><span class="unit">g</span>`;
      if(el.accelZ) el.accelZ.innerHTML = `<span class="num">${az.toFixed(3)}</span><span class="unit">g</span>`;
      if(el.accelMag){
        const mag = Math.sqrt((ax * ax) + (ay * ay) + (az * az));
        el.accelMag.innerHTML = `<span class="num">${mag.toFixed(3)}</span><span class="unit">g</span>`;
      }
        if(el.gyroX) el.gyroX.innerHTML = `<span class="num">${gx.toFixed(3)}</span><span class="unit">dps</span>`;
        if(el.gyroY) el.gyroY.innerHTML = `<span class="num">${gy.toFixed(3)}</span><span class="unit">dps</span>`;
        if(el.gyroZ) el.gyroZ.innerHTML = `<span class="num">${gz.toFixed(3)}</span><span class="unit">dps</span>`;
        if(el.gyroMag){
          const mag = Math.sqrt((gx * gx) + (gy * gy) + (gz * gz));
          el.gyroMag.innerHTML = `<span class="num">${mag.toFixed(3)}</span><span class="unit">dps</span>`;
        }
        if(el.thrustGauge){
          const maxThrust = (String(thrustUnit).toLowerCase() === "lbf") ? THRUST_GAUGE_MAX_LBF : THRUST_GAUGE_MAX_KGF;
          const thrustVal = thrustMissing ? 0 : Math.max(0, thrustDisp);
          const thrustPct = Math.min(100, (maxThrust > 0 && isFinite(thrustVal) ? (thrustVal / maxThrust) * 100 : 0));
          el.thrustGauge.style.setProperty("--gauge-pct", thrustPct.toFixed(1) + "%");
        }
        if(el.pressureGauge){
          const pressureVal = Math.max(0, p);
          const pressurePct = Math.min(100, (PRESSURE_GAUGE_MAX_MPA > 0 ? (pressureVal / PRESSURE_GAUGE_MAX_MPA) * 100 : 0));
          el.pressureGauge.style.setProperty("--gauge-pct", pressurePct.toFixed(1) + "%");
        }
        if(el.lt){
        const spans = el.lt.querySelectorAll('.num');
        if (spans.length === 2) {
          spans[0].textContent = lt.toFixed(0);
          spans[1].textContent = elapsedMs.toFixed(0);
        } else {
          el.lt.innerHTML = `<span class="lt-line"><span class="num">${lt.toFixed(0)}</span><span class="unit">ms</span></span><span class="unit lt-sep">/</span><span class="lt-line"><span class="num">${elapsedMs.toFixed(0)}</span><span class="unit">ms</span></span>`;
        }
        }

        if(el.snapHz){
          const nowUi = Date.now();
          if((nowUi - lastSnapHzUiMs) >= 1000 || lastSnapHzUiMs === 0){
            const snapHz = (sampleRateHzWindow > 0) ? sampleRateHzWindow : rxHzWindow;
            el.snapHz.textContent = (snapHz>0 && isFinite(snapHz)) ? (snapHz.toFixed(0) + " Hz") : "-- Hz";
            lastSnapHzUiMs = nowUi;
          }
        }
        if(el.hxHz) el.hxHz.textContent = (hxHzDisplay>0 && isFinite(hxHzDisplay)) ? (hxHzDisplay.toFixed(0) + " Hz") : "-- Hz";
        ensureSpiFlashStateKnown();
        if(el.quickHxHz){
          if(inFlightMode){
            const sdTextHx = (spiFlashReadyState == null) ? "--" : (spiFlashReadyState ? "READY" : "NOT READY");
          updateNumValue(el.quickHxHz, sdTextHx);
            setQuickItemStatus(el.quickHxHz, (spiFlashReadyState == null) ? null : (spiFlashReadyState ? "ok" : "warn"));
          }else{
            const hxNum = (hxHzDisplay>0 && isFinite(hxHzDisplay)) ? hxHzDisplay.toFixed(0) : "--";
          updateNumValue(el.quickHxHz, hxNum, "Hz");
            setQuickItemStatus(el.quickHxHz, null);
          }
        }
        if(el.quickNullValue){
          if(inFlightMode){
            const displayYawDeg = getGyroDisplayYawDeg();
          updateNumValue(el.quickNullValue, displayYawDeg.toFixed(1), "deg");
            setQuickItemStatus(el.quickNullValue, null);
          }else{
            const sdText = (spiFlashReadyState == null) ? "--" : (spiFlashReadyState ? "READY" : "NOT READY");
          updateNumValue(el.quickNullValue, sdText);
            setQuickItemStatus(el.quickNullValue, (spiFlashReadyState == null) ? null : (spiFlashReadyState ? "ok" : "warn"));
          }
        }
        if(el.quickNull2Value){
        updateNumValue(el.quickNull2Value, "null");
          setQuickItemStatus(el.quickNull2Value, null);
        }
        if(el.quickNull3Value){
        updateNumValue(el.quickNull3Value, "null");
          setQuickItemStatus(el.quickNull3Value, null);
        }
        if(el.cpuUs) el.cpuUs.textContent = (ctUs>0 && isFinite(ctUs)) ? (ctUs.toFixed(0) + " us") : "-- us";

        if(el.ignDelayDisplay) el.ignDelayDisplay.textContent = (t("labelDelay") + " " + formatQuickTimeDisplay(ignitionAnalysis.delaySec) + "s");
        if(el.burnDurationDisplay) el.burnDurationDisplay.textContent = (t("labelBurn") + " " + formatQuickTimeDisplay(ignitionAnalysis.durationSec) + "s");

        if(el.modePill){
          let label="-";
          if(mode===0) label = t("modeSerial");
          else if(mode===1) label = t("modeWifi");
          else if(mode===2) label = t("modeAuto");
          el.modePill.textContent=label;
        }

        updateRelaySafePill();

        if(el.sw){
          if(swOn){ el.sw.textContent = "ON"; el.sw.className="pill pill-green"; }
          else { el.sw.textContent = "OFF"; el.sw.className="pill pill-gray"; }
        }
        if(el.quickSw){
          const swLabel = physicalArmKnown ? (physicalArmOn ? "ON" : "OFF") : "--";
          updateNumValue(el.quickSw, swLabel);
          let lockLabel = el.quickSw.querySelector(".quick-arm-lock");
          if(!lockLabel){
            lockLabel = document.createElement("span");
            lockLabel.className = "quick-arm-lock";
            lockLabel.textContent = "(LOCK ON)";
            el.quickSw.appendChild(lockLabel);
          }
          lockLabel.hidden = !armLockOn;
          setQuickItemStatus(el.quickSw, physicalArmKnown ? (physicalArmOn ? "ok" : "warn") : null);
        }

        if(el.ic){
          if(icOn){ el.ic.textContent = t("icOk"); el.ic.className="pill pill-green"; }
          else { el.ic.textContent = t("icNo"); el.ic.className="pill pill-red"; }
        }
        if(el.relay){
          if(relayMask){ el.relay.textContent = t("relayOn"); el.relay.className="pill pill-green"; }
          else { el.relay.textContent = t("relayOff"); el.relay.className="pill pill-gray"; }
        }
        if(el.quickRelay1 || el.quickRelay2 || el.quickMetricPyro){
          const rlyMask = (rly == null || !Number.isFinite(rly)) ? null : relayMask;
          const r1On = (rlyMask == null) ? null : ((rlyMask & 1) !== 0);
          const r2On = (rlyMask == null) ? null : ((rlyMask & 2) !== 0);
          const lockMask = lockoutLatched ? (lockoutRelayMask || 0) : 0;
          const lockAll = lockoutLatched && lockMask === 0;
          const r1Lock = lockoutLatched && (lockAll || ((lockMask & 1) !== 0));
          const r2Lock = lockoutLatched && (lockAll || ((lockMask & 2) !== 0));

          if(el.quickRelay1){
            let pyroLabel = "--";
            let pyroStatus = null;
            if(rlyMask != null){
              const active = [];
              for(let ch=1; ch<=4; ch++){
                if((rlyMask & (1 << (ch - 1))) !== 0){
                  active.push("CH" + ch);
                }
              }
              pyroLabel = active.length ? active.join(",") : "ALL OFF";
              pyroStatus = active.length ? "ok" : "warn";
            }
            if(lockoutLatched){
              pyroLabel = "ERROR";
              pyroStatus = "bad";
            }
          updateNumValue(el.quickRelay1, pyroLabel);
            setQuickItemStatus(el.quickRelay1, pyroStatus);
          }
          if(el.quickMetricPyro){
            let pyroLabel = "--";
            if(rlyMask != null){
              const active = [];
              for(let ch=1; ch<=4; ch++){
                if((rlyMask & (1 << (ch - 1))) !== 0) active.push("CH" + ch);
              }
              pyroLabel = active.length ? active.join(",") : "ALL OFF";
            }
            if(lockoutLatched) pyroLabel = "ERROR";
            updateNumValue(el.quickMetricPyro, pyroLabel);
          }
          if(el.quickRelay2){
            if(inFlightMode){
              const displayRollDeg = getGyroDisplayRollDeg();
            updateNumValue(el.quickRelay2, displayRollDeg.toFixed(1), "deg");
              setQuickItemStatus(el.quickRelay2, null);
            }else{
              let r2Label = (r2On == null) ? "--" : (r2On ? t("relayOn") : t("relayOff"));
              let r2Status = (r2On == null) ? null : (r2On ? "ok" : "warn");
              if(r2Lock){
                r2Label = "ERROR";
                r2Status = "bad";
              }
            updateNumValue(el.quickRelay2, r2Label);
              setQuickItemStatus(el.quickRelay2, r2Status);
            }
          }
        }
        updateGyroMetaFromMain();
        const parachuteStatusActive = isParachuteDeployStatusActive(st, !!ab);
        let cameraStateLabel = "";
        let cameraStateStatus = null;
        if(el.quickState){
          let stateLabel="--";
          let stateStatus=null;
          let isNotArmed=false;
          const showFlightPhase =
            isFlightModeUi() &&
            !!flightPhaseInfo &&
            !lockoutLatched &&
            !ab &&
            !loadcellErrorActive &&
            !sequenceActive &&
            st !== 1;
          if(lockoutLatched) stateLabel = t("statusLockout");
          else if(ab) stateLabel = t("statusAbort");
          else if(st===5){
            stateLabel = "LAUNCH FAULT";
            stateStatus = "bad";
          }
          else if(st===4){
            stateLabel = "WAITING LAUNCH";
            stateStatus = "warn";
          }
          else if(showFlightPhase && (st === 0 || st === 2 || st === 3)){
            stateLabel = flightPhaseInfo.label;
            stateStatus = flightPhaseInfo.status;
            isNotArmed = !icOn && flightPhaseInfo.phase === FLIGHT_PHASES.PRE_FLIGHT;
          }
          else if(st===3) stateLabel = "T+";
          else if(st===2) stateLabel = t("statusIgnition");
          else if(st===1) stateLabel = t("statusCountdown");
          else if(parachuteStatusActive) stateLabel = t("statusParachute");
          else if(sequenceActive) stateLabel = t("statusSequence");
          else if(st===0){
            if(loadcellErrorActive){
              stateLabel = t("statusLoadcellCheck");
            }else{
              isNotArmed = !icOn;
              stateLabel = isNotArmed ? t("statusNotArmed") : t("statusReady");
            }
          }
          if(stateStatus == null){
            if(lockoutLatched || ab || st===2 || st===5) stateStatus = "bad";
            else if(st===3) stateStatus = "ok";
            else if(st===4) stateStatus = "warn";
            else if(parachuteStatusActive) stateStatus = "ok";
            else if(st===1 || sequenceActive || (st===0 && (!icOn || loadcellErrorActive))) stateStatus = "warn";
            else if(st===0) stateStatus = "ok";
          }
          const loadcellLabel = t("statusLoadcellCheck");
          const stateHtml = (stateLabel === loadcellLabel)
            ? loadcellLabel.replace(" ", "<br>")
            : String(stateLabel).replace(/_/g, "<br>");
          el.quickState.innerHTML = `<span class="num">${stateHtml}</span>`;
          el.quickState.classList.toggle("is-not-armed", isNotArmed);
          const quickStateItem = el.quickState.closest(".item-quick-state");
          if(quickStateItem){
            quickStateItem.classList.toggle("state-lockout", lockoutLatched);
          }
          setQuickItemStatus(el.quickState, stateStatus);
          if(el.mobilePreviewState){
            el.mobilePreviewState.textContent = String(stateLabel || "--").replace(/\s+/g, " ").trim() || "--";
          }
          cameraStateLabel = String(stateLabel || "--").replace(/\s+/g, " ").trim() || "--";
          cameraStateStatus = stateStatus;
          lastOverlayStateText = cameraStateLabel;
          lastOverlayStateStatus = cameraStateStatus;
        }

        if(el.igswitch) el.igswitch.checked=!!gs;
        if(el.safeModeToggle && sm != null){
          el.safeModeToggle.checked = !!sm;
          updateTogglePill(el.safeModePill, el.safeModeToggle.checked);
        }
        if(el.armLockToggle && al != null){
          el.armLockToggle.checked = !!al;
          updateTogglePill(el.armLockPill, el.armLockToggle.checked);
          updateMobileArmLockWideButton();
        }
        updateMobileDashboardSafetyArmState();
        if(el.mobilePreviewArm){
          const physicalArmLabel = physicalArmKnown ? (physicalArmOn ? "ON" : "OFF") : "--";
          el.mobilePreviewArm.textContent = physicalArmLabel + (armLockOn ? " (LOCK ON)" : "");
        }

        let tplusActive = false;
        if(el.countdown){
          let prefix = "T- ";
          let cdText="--:--:??";
          const pad2 = (n)=>String(n).padStart(2,"0");
          const formatCountdown = (ms)=>{
            const value = Math.max(0, Math.round(Number(ms) || 0));
            const minPart = Math.floor(value / 60000);
            const secPart = Math.floor((value % 60000) / 1000);
            const centiPart = Math.floor((value % 1000) / 10);
            return pad2(minPart) + ":" + pad2(secPart) + ":" + pad2(centiPart);
          };
          let useTd = (td != null && isFinite(td) && !(st === 0 && Number(td) === 0));
          if(useTd && allowClientTplusFallback && td < 0 && localTplusActive && localTplusStartMs != null){
            useTd = false;
          }

          if(useTd){
            if(st === 1 || td < 0){
              const msRemain = Math.max(0, Math.round(Math.abs(td)));
              const totalCountdownMs = Math.max(3000, Math.round(Number((uiSettings && uiSettings.countdownSec) || 10) * 1000));
              setMobileSequenceProgress(1 - (msRemain / totalCountdownMs));
              const secRemain = Math.ceil(msRemain/1000);
              cdText = formatCountdown(msRemain);
              if(secRemain !== lastCountdownSec){
                if(secRemain > 0){
                  playCountdownMp3(secRemain);
                }else{
                  playCountdownMp3(0);
                }
                lastCountdownSec = secRemain;
              }
            }else if(st === 2 || st === 3 || td >= 0){
              prefix = "T+ ";
              const elapsedMs = Math.max(0, Math.round(Math.abs(td)));
              tplusActive = true;
              setMobileSequenceProgress(1);
              cdText = formatCountdown(elapsedMs);
              lastCountdownSec = null;
            }
          }else if(localTplusActive && localTplusStartMs!=null){
            prefix = "T+ ";
            const elapsedMs = Math.max(0, Date.now() - localTplusStartMs);
            tplusActive = true;
            setMobileSequenceProgress(1);
            cdText = formatCountdown(elapsedMs);
            lastCountdownSec = null;
          }else{
            lastCountdownSec = null;
            setMobileSequenceProgress(0.04);
          }
          const cdLabel = prefix + cdText;
          el.countdown.textContent = cdLabel;
          if(el.countdownMobile) el.countdownMobile.textContent = cdLabel;
          if(el.countdownBig) el.countdownBig.textContent = cdLabel;
          syncMobileSequenceTime();
        }
        updateAbortButtonLabel(isFirmwareTplusState(st) || (tplusActive && st !== 2));
        const statusCode=setStatusFromState(st,icOn,!!ab,lockoutLatched, sequenceActive, parachuteStatusActive);
        syncCountdownInlineStatus();
        if(el.countdownStatus && el.statusText){
          el.countdownStatus.textContent = el.statusText.textContent || "";
        }
        setButtonsFromState(st, lockoutLatched, sequenceActive);
        const cameraHudFallbackValues = {
          stateText: cameraStateLabel,
          stateStatus: cameraStateStatus,
          st,
          td,
          countdownTotalMs: Math.max(
            3000,
            Math.min(
              60000,
              Number(data.virtual_countdown_total_ms) ||
                Number((uiSettings && uiSettings.countdownSec) || 10) * 1000
            )
          ),
          altitudeM: quickAltitudeM,
          altitudeRateMps: quickAltitudeRateMps,
          speedMps: quickSpeedMps,
          gforceG: quickTotalAccelG,
          swOn,
          icOn,
          ignitionDelayMs:data.ignition_delay_ms,
          ignitionDelayValid:data.ignition_delay_valid,
          deploymentState:data.deployment_state,
          deploymentFlags:data.deployment_flags,
          flightPhaseCode:data.flight_phase_code,
          missionAlarmEvents:data.mission_alarm_events,
          missionAlarmTitle:data.mission_alarm_title,
          missionAlarmMessage:data.mission_alarm_message
        };
        const cameraHudValues = buildCameraHudStageValues(cameraHudFallbackValues);
        syncCameraHud(cameraHudValues);
        updateHomeUI();
        if(statusCode!==lastStatusCode){
          if(statusCode===1){
            addLogLine(t("countdownStartLog"),"COUNT");
            if(Date.now() >= suppressCountdownToastUntil){
              showToast(t("countdownStartToast", {safety:safetyLineSuffix()}),"warn");
            }
          }else if(statusCode===2){
            addLogLine(t("ignitionFiringLog"),"IGNITE");
            if(Date.now() >= suppressIgnitionToastUntil){
              showToast(t("ignitionFiringToast", {safety:safetyLineSuffix()}),"ignite");
            }
          }else if(statusCode===0 && lastStatusCode===2){
            addLogLine(t("sequenceCompleteLog"),"DONE");
            showToast(t("sequenceCompleteToast"),"success");
          }else if(statusCode===4){
            const reasonLabel = getAbortReasonLabel();
            addLogLine(t("sequenceAbortedLog") + " (" + reasonLabel + ")", "ABORT");
            showToast(t("sequenceAbortedToastReason", {reason:reasonLabel, safety:safetyLineSuffix()}),"error");
            lastAbortReason = null;
          }else if(statusCode===3){
            showToast(t("notArmedToast", {safety:safetyLineSuffix()}),"notice");
          }else if(statusCode===7){
            const chuteCh = parachuteDeployChannel || normalizePyroChannel(uiSettings && uiSettings.daqSequencePyroChannel, 1);
            addLogLine(t("statusParachuteLog", {ch:chuteCh}), "PYRO");
            showToast(t("statusParachuteToast", {ch:chuteCh}), "info", {key:"parachute-deploy"});
          }else if(statusCode===9){
            const now = Date.now();
            if(now - lastLockoutToastMs > 5000){
              lastLockoutToastMs = now;
              const name = relayMaskName(lockoutRelayMask);
              showToast(t("lockoutDetectedToastShort", {name}), "error", {duration:12000});
            }
          }
          lastStatusCode=statusCode;
        }
        if(virtualMissionActive){
          renderVirtualMissionUi(nowOk);
        }

        if(autoScrollChart){
          const len=thrustBaseHistory.length;
          const lastTime = (len > 0) ? chartTimeHistory[len - 1] : 0;
          let windowMs = chartView.windowMs || CHART_WINDOW_MS_DEFAULT;
          if(windowMs < CHART_WINDOW_MS_MIN) windowMs = CHART_WINDOW_MS_MIN;
          if(windowMs > CHART_WINDOW_MS_MAX) windowMs = CHART_WINDOW_MS_MAX;
          chartView.windowMs = windowMs;
          chartView.allowSmallWindow = false;
          chartView.startMs = lastTime - windowMs;
        }

        if(stageTelemetryModeActive){
          syncDashboardSelectedStageTelemetry();
        }

        const nowPerf=(typeof performance!=="undefined" && performance.now) ? performance.now() : Date.now();
        if(forceReplayUi || nowPerf-lastChartRedraw>=CHART_MIN_INTERVAL){
          redrawCharts();
          lastChartRedraw=nowPerf;
        }
      }

      // OBS HUD is a telemetry consumer, not part of the dashboard render loop.
      // Publish it from the sample pipeline so ordinary sensor frames keep
      // moving even when no event/state transition causes a DOM refresh.
      if(!isFastReplaySeek && shouldRefreshUi){
        publishOverlaySample(()=>{
          const fallbackStateText = String(
            (flightPhaseInfo && flightPhaseInfo.label) ||
            lastOverlayStateText ||
            "--"
          ).replace(/\s+/g, " ").trim() || "--";
          const fallbackStateStatus =
            (flightPhaseInfo && flightPhaseInfo.status) ||
            lastOverlayStateStatus;
          const liveHudValues = buildCameraHudStageValues({
            stateText:fallbackStateText,
            stateStatus:fallbackStateStatus,
            st,
            td,
            countdownTotalMs:Math.max(
              3000,
              Math.min(
                60000,
                Number(data.virtual_countdown_total_ms) ||
                  Number((uiSettings && uiSettings.countdownSec) || 10) * 1000
              )
            ),
            altitudeM:quickAltitudeM,
            altitudeRateMps:quickAltitudeRateMps,
            speedMps:quickSpeedMps,
            gforceG:quickTotalAccelG,
            swOn,
            icOn,
            ignitionDelayMs:data.ignition_delay_ms,
            ignitionDelayValid:data.ignition_delay_valid,
            deploymentState:data.deployment_state,
            deploymentFlags:data.deployment_flags,
            flightPhaseCode:data.flight_phase_code,
            missionAlarmEvents:data.mission_alarm_events,
            missionAlarmTitle:data.mission_alarm_title,
            missionAlarmMessage:data.mission_alarm_message
          });
          let storagePercent = NaN;
          try{
            storagePercent = getSpiFlashUsedPercent(getActiveStoragePreviewInfo());
          }catch(_error){}
          return Object.assign({}, liveHudValues, {
            t:thrustVal,
            p,
            ab,
            ts:Date.now(),
            mission:String(
              (el.missionName && el.missionName.value) ||
              selectedMotorName ||
              DEFAULT_MISSION_NAME ||
              "FLASH6 MISSION"
            ).trim(),
            connected:liveHudValues.connected == null
              ? !!(connOk || wsConnected || serialConnected || simEnabled || isReplaySample)
              : !!liveHudValues.connected,
            pyroChannel:normalizePyroChannel(
              uiSettings && uiSettings.daqSequencePyroChannel,
              1
            ),
            storagePercent:isFinite(storagePercent) ? storagePercent : null
          });
        });
      }

      if(!isFastReplaySeek && typeof window !== "undefined" &&
         window.Flash6 && window.Flash6.telemetryStore){
        window.Flash6.telemetryStore.set({
          connected:true,
          source:src,
          receivedAt:nowOk,
          sample:data,
          derived:{
            stageId:resolveTelemetryStageId(data),
            state:st,
            altitudeM:quickAltitudeM,
            altitudeRateMps:quickAltitudeRateMps,
            speedMps:quickSpeedMps,
            totalAccelG:quickTotalAccelG,
            rollDeg:gyroRollDeg,
            pitchDeg:gyroPitchDeg,
            yawDeg:gyroYawDeg,
            dataOrigin:dataOrigin
          }
        });
      }

      if(!isFastReplaySeek){
        evaluateRuntimeAlarms(nowOk);
      }
    }

    // =====================
    // Wi-Fi 폴링 루프
    // =====================
    // Polling and storage are implemented by dedicated runtime modules.
