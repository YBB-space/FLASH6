/* FLASH6 Wi-Fi fallback polling and periodic data acquisition. */
    async function updateData(){
      if(replaySourceActive) return;
      if(simEnabled){
        onIncomingSample(buildSimSample(), "SIM");
        return;
      }
      // USB mode receives telemetry only through WebSerial. Wi-Fi polling failures
      // must not overwrite a successful serial connection as OFFLINE.
      if(serialEnabled){
        return;
      }
      const nowMs = Date.now();
      if(isUpdating){
        if(updateDataStartedMs > 0 && (nowMs - updateDataStartedMs) > UPDATE_DATA_GUARD_TIMEOUT_MS){
          isUpdating = false;
          updateDataStartedMs = 0;
          if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("poll guard");
        }else{
          return;
        }
      }
      if(wsConnected && (Date.now() - wsLastMsgMs) < WS_FRESH_MS) return;
      isUpdating = true;
      updateDataStartedMs = nowMs;
      try{
        let data;
        try{
          data = await fetchJsonWithFallback(UPDATE_DATA_SOFT_TIMEOUT_MS);
        }catch(err){
          failStreak++;
          markDisconnectedIfNeeded(t("noResponse"));
          if((err && err.name) === "AbortError" && !wsConnected && !wsRetryTimer){
            scheduleWsReconnect("poll timeout");
          }
          return;
        }
        onIncomingSample(data, "WIFI");
      }finally{
        isUpdating = false;
        updateDataStartedMs = 0;
      }
    }

    async function fetchWifiInfo(){
      if(simEnabled) return;
      const isSettingsOpen = document.documentElement.classList.contains("settings-open");
      if(!wifiInfo || isSettingsOpen){
        let ok = false;
        let lastErr = null;
        const bases = getApiBaseCandidates();
        for(const base of bases){
          try{
            const url = (base ? base : "") + "/wifi_info";
            const info = await fetchJsonTimeout(url, 1200);
            wifiInfo = info;
            wifiInfoLastMs = Date.now();
            updateWifiInfoUI(info);
            if(base){
              setApiBaseOverride(base, isLocalPreviewHost());
            }
            ok = true;
            break;
          }catch(e){
            lastErr = e;
          }
        }
        if(!ok){
          if(!wifiInfo || (Date.now() - wifiInfoLastMs) > 5000){
            updateWifiInfoUI(null);
          }
          if(lastErr){
            // keep silent; this runs on interval
          }
        }
      }
    }

    let pollTimer=null;
    let pollLoopStopped=false;
    let updateDataStartedMs = 0;
    const UPDATE_DATA_GUARD_TIMEOUT_MS = 5500;
    const UPDATE_DATA_SOFT_TIMEOUT_MS = 1400;

    async function pollLoop(){
      if(pollLoopStopped) return;
      const t0 = (performance?.now?.() ?? Date.now());
      try{ await updateData(); }
      catch(e){
        addLogLine(t("pollingErrorLog", {err:(e?.message || e)}), "ERROR");
        showToast(t("pollingErrorToast"), "error");
      }
      evaluateRuntimeAlarms(Date.now());
      const t1 = (performance?.now?.() ?? Date.now());
      const dt = t1 - t0;

      const sinceOk = Date.now() - (lastOkMs || 0);
      const extraBackoff =
        !simEnabled && sinceOk > DISCONNECT_GRACE_MS ? 120 : 0;

      const loopInterval = simEnabled
        ? SIM_SAMPLE_INTERVAL_MS
        : POLL_INTERVAL;
      const delay = Math.max(0, (loopInterval + extraBackoff) - dt);
      if(!pollLoopStopped){
        pollTimer = setTimeout(pollLoop, delay);
      }
    }

    function stopPollLoop(){
      pollLoopStopped = true;
      if(pollTimer){
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    }
