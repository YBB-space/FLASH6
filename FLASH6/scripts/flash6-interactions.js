/* FLASH6 touch, hold, and sequence confirmation interactions. */
/* FLASH6 interaction runtime. Loaded in manifest order by flash6.js. */
    // =====================
    // 터치 줌/팬
    // =====================
    let isPanning=false;
    let isPinching=false;
    let panStartX=0;
    let panStartStart=0;
    let pinchStartDist=0;
    let pinchStartWindow=CHART_WINDOW_MS_DEFAULT;

    function attachTouch(canvasId){
      const canvas=document.getElementById(canvasId);
      if(!canvas) return;

      canvas.addEventListener("touchstart",(ev)=>{
        autoScrollChart=false;
        chartView.allowSmallWindow=false;
        if(ev.touches.length===1){
          isPanning=true;isPinching=false;
          panStartX=ev.touches[0].clientX;
          if(chartView.startMs == null){
            const len = thrustBaseHistory.length;
            const lastTime = (len > 0) ? chartTimeHistory[len - 1] : 0;
            const windowMs = chartView.windowMs || CHART_WINDOW_MS_DEFAULT;
            panStartStart = lastTime - windowMs;
          }else{
            panStartStart = chartView.startMs;
          }
        }else if(ev.touches.length>=2){
          isPinching=true;isPanning=false;
          const dx=ev.touches[0].clientX-ev.touches[1].clientX;
          const dy=ev.touches[0].clientY-ev.touches[1].clientY;
          pinchStartDist=Math.sqrt(dx*dx+dy*dy)||1;
          pinchStartWindow=chartView.windowMs || CHART_WINDOW_MS_DEFAULT;
        }
        ev.preventDefault();
      },{passive:false});

      canvas.addEventListener("touchmove",(ev)=>{
        if(isPanning && ev.touches.length===1){
          const dx=ev.touches[0].clientX-panStartX;
          const width=canvas.clientWidth||200;
          const ratio=width ? dx/width : 0;
          const deltaMs=Math.round(-ratio*(chartView.windowMs || CHART_WINDOW_MS_DEFAULT)*0.8);
          chartView.startMs=panStartStart+deltaMs;
          redrawCharts();
        }else if(isPinching && ev.touches.length>=2){
          const dx=ev.touches[0].clientX-ev.touches[1].clientX;
          const dy=ev.touches[0].clientY-ev.touches[1].clientY;
          const dist=Math.sqrt(dx*dx+dy*dy)||1;
          const scale=pinchStartDist/dist;
          let newWindowMs=Math.round(pinchStartWindow*scale);
          if(newWindowMs < CHART_WINDOW_MS_MIN) newWindowMs = CHART_WINDOW_MS_MIN;
          if(newWindowMs > CHART_WINDOW_MS_MAX) newWindowMs = CHART_WINDOW_MS_MAX;
          chartView.windowMs=newWindowMs;
          redrawCharts();
        }
        ev.preventDefault();
      },{passive:false});

      canvas.addEventListener("touchend",(ev)=>{
        if(ev.touches.length===0){ isPanning=false; isPinching=false; }
      });
    }

    // =====================
    // 롱프레스 / 오버레이
    // =====================
    let lpTimer=null;
    let lpStart=0;
    const LP_DURATION=3000;
    let longPressPointerId=null;
    let longPressSpinnerEl=null;
    let confirmOverlayEl=null;
    let forceSlideEl=null;
    let forceSlideThumbEl=null;
    let forceSlideActive=false;
    let forceSlidePointerId=null;
    let forceSlideDragOffset=0;
    let confirmTitleEl=null;
    let lpLastSentSec=3;
    let userWaitingLocal=false;

    let forceOverlayEl=null;
    let launcherOverlayEl=null;
    let launcherUpHold=null;
    let launcherDownHold=null;
    let launcherAutoActive=false;
    let launcherPitchEst=null;
    let launcherPitchEstMs=0;
    let launcherAutoOverlayEl=null;
    let launcherAutoConfirmBtn=null;
    let launcherAutoCancelBtn=null;
    let rebootConfirmOverlayEl=null;
    let rebootConfirmBtnEl=null;
    let rebootConfirmCancelBtnEl=null;
    let rebootConfirmTitleEl=null;
    let rebootConfirmTextEl=null;
    let rebootConfirmActionsEl=null;
    let brownoutWarningOverlayEl=null;
    let brownoutWarningConfirmEl=null;
    let brownoutWarningActiveKey="";
    const BROWNOUT_ACK_STORAGE_KEY="flash6_brownout_ack";
    let pyroConfirmOverlayEl=null;
    let pyroConfirmTitleEl=null;
    let pyroConfirmDescEl=null;
    let pyroConfirmHintEl=null;
    let pyroConfirmOkBtnEl=null;
    let pyroConfirmCancelBtnEl=null;
    let rebootConfirmWaiting=false;
    let rebootConfirmStartedMs=0;
    let rebootWaitForRemoteLink=false;
    let rebootRemoteLinkDropped=false;
    let rebootRecoveryTimer=null;
    let rebootRecoveryInFlight=false;
    let rebootRecoveryReloaded=false;
    let easterOverlayEl=null;
    let easterEggOkEl=null;
    let easterEggPending=false;

    function brownoutWarningKeyFor(data){
      if(!data || simEnabled || replaySourceActive) return "";
      const resetCode = Number(data.reset_code);
      const resetReason = String(data.reset_reason || "").trim().toUpperCase();
      const powerFaultReset =
        resetCode === 9 ||
        resetCode === 23 ||
        resetReason === "BROWNOUT" ||
        resetReason === "POWER_GLITCH";
      if(!powerFaultReset) return "";
      const bootSession = Number(data.boot_session);
      if(!isFinite(bootSession) || bootSession <= 0) return "";
      const nodeId = Number(
        data.stage_node_id ?? data.fl_target ?? data.flash_link_target_node_id ??
        data.fl_node ?? data.flash_link_node_id ?? 1
      );
      return String(isFinite(nodeId) ? nodeId : 1) + ":" + String(Math.trunc(bootSession));
    }

    function readBrownoutAcknowledgements(){
      try{
        const raw = sessionStorage.getItem(BROWNOUT_ACK_STORAGE_KEY);
        if(!raw) return [];
        if(raw.charAt(0) !== "[") return [raw];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      }catch(_e){
        return [];
      }
    }

    function maybeShowBrownoutWarning(data){
      const key = brownoutWarningKeyFor(data);
      if(!key || brownoutWarningActiveKey) return;
      if(readBrownoutAcknowledgements().includes(key)) return;
      brownoutWarningActiveKey = key;
      if(!brownoutWarningOverlayEl){
        brownoutWarningOverlayEl = document.getElementById("brownoutWarningOverlay");
      }
      if(!brownoutWarningOverlayEl) return;
      brownoutWarningOverlayEl.setAttribute("aria-hidden", "false");
      setOverlayVisible(brownoutWarningOverlayEl, true);
      requestAnimationFrame(()=>{
        const button = brownoutWarningConfirmEl ||
          document.getElementById("brownoutWarningConfirm");
        if(button) button.focus({preventScroll:true});
      });
    }

    function acknowledgeBrownoutWarning(){
      if(brownoutWarningActiveKey){
        try{
          const acknowledged = readBrownoutAcknowledgements();
          if(!acknowledged.includes(brownoutWarningActiveKey)){
            acknowledged.push(brownoutWarningActiveKey);
          }
          sessionStorage.setItem(
            BROWNOUT_ACK_STORAGE_KEY,
            JSON.stringify(acknowledged.slice(-12))
          );
        }catch(_e){}
      }
      if(brownoutWarningOverlayEl){
        brownoutWarningOverlayEl.setAttribute("aria-hidden", "true");
        setOverlayVisible(brownoutWarningOverlayEl, false);
      }
      brownoutWarningActiveKey = "";
    }

    function resetLongPressVisual(){
      if(longPressSpinnerEl){
        longPressSpinnerEl.style.setProperty("--lp-angle","0deg");
        longPressSpinnerEl.style.setProperty("--lp-progress","0");
      }
      if(confirmTitleEl) confirmTitleEl.textContent = t("confirmTitleReady");
    }
    function releaseLongPressPointerCapture(){
      const pointerId = longPressPointerId;
      longPressPointerId = null;
      if(pointerId == null || !el.longPressBtn) return;
      try{
        if(!el.longPressBtn.hasPointerCapture ||
           el.longPressBtn.hasPointerCapture(pointerId)){
          el.longPressBtn.releasePointerCapture(pointerId);
        }
      }catch(_e){}
    }
    function closeSequenceStartOverlay(sendPrecountReset){
      if(lpTimer){ clearInterval(lpTimer); lpTimer=null; }
      releaseLongPressPointerCapture();
      resetLongPressVisual();
      userWaitingLocal=false;
      setOverlayVisible(confirmOverlayEl, false);
      if(sendPrecountReset){
        sendCommand({http:"/precount?uw=0&cd=0", ser:"PRECOUNT 0 0"}, false);
      }
    }
    function hideConfirm(){
      closeSequenceStartOverlay(true);
    }
    function showConfirm(){
      hideMobileControlsPanel();
      const storageGuard = getSequenceStorageGuard();
      if(storageGuard.blocked){
        showSequenceStorageGuardToast(true);
        setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
        return;
      }
      if(lockoutLatched){
        showToast(t("lockoutNoControl"), "error");
        return;
      }
      if(!isControlUnlocked()){
        showToast(t("inspectionRequiredToast"), "notice");
        return;
      }
      showSequenceStorageGuardToast(false);
      if(lpTimer){ clearInterval(lpTimer); lpTimer=null; }
      releaseLongPressPointerCapture();
      resetLongPressVisual();
      userWaitingLocal=true;
      lpLastSentSec=3;
      setOverlayVisible(confirmOverlayEl, true);
      const cdMs = Math.max(3000, Math.min(60000, ((uiSettings ? uiSettings.countdownSec : 10) * 1000)));
      sendCommand({http:"/precount?uw=1&cd="+cdMs, ser:"PRECOUNT 1 "+cdMs}, false);
      showToast(t("preSequenceToast", {safety:safetyLineSuffix()}),"warn");
    }

    function showEasterEggWarning(){
      if(!ENABLE_EASTER_TETRIS){
        showToast("Light mode: easter/tetris disabled", "notice", {key:"lite-easter-disabled"});
        return;
      }
      hideMobileControlsPanel();
      sendCommand({http:"/easter_bgm", ser:"/easter_bgm"}, false);
      if(easterOverlayEl){
        easterEggPending = true;
        setOverlayVisible(easterOverlayEl, true);
        return;
      }
      startTetris();
    }
    function hideEasterEggWarning(){
      if(!ENABLE_EASTER_TETRIS) return;
      setOverlayVisible(easterOverlayEl, false);
      if(easterEggPending){
        easterEggPending = false;
        startTetris();
      }
    }

    function startHold(){
      if(lockoutLatched) return;
      const storageGuard = getSequenceStorageGuard();
      if(storageGuard.blocked){
        showSequenceStorageGuardToast(true);
        setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
        return;
      }
      if(!isControlUnlocked()){
        showToast(t("inspectionRequiredShort"), "notice");
        return;
      }
      if(!el.longPressBtn || !longPressSpinnerEl || lpTimer) return;
      showSequenceStorageGuardToast(false);
      userWaitingLocal=true;
      lpStart=Date.now();
      lpLastSentSec=3;
      const configuredCdMs = Math.max(3000, Math.min(60000, ((uiSettings ? uiSettings.countdownSec : 10) * 1000)));

      lpTimer=setInterval(()=>{
        const now=Date.now();
        const remain=LP_DURATION-(now-lpStart);
        const left=remain<0?0:remain;

        let ratio=(LP_DURATION-left)/LP_DURATION; if(ratio>1) ratio=1;
        const angle=Math.floor(360*ratio);
        longPressSpinnerEl.style.setProperty("--lp-angle",angle+"deg");
        longPressSpinnerEl.style.setProperty("--lp-progress",String(ratio));

        let sec=Math.ceil(left/1000); if(sec<0) sec=0;
        if(confirmTitleEl){
          confirmTitleEl.textContent = sec>0
            ? t("confirmTitleEntering", {sec})
            : t("confirmTitleCountdown");
        }
        if(sec!==lpLastSentSec){
          lpLastSentSec=sec;
        }

        if(left===0){
          clearInterval(lpTimer); lpTimer=null;
          closeSequenceStartOverlay(false);
          sendCommand({http:"/precount?uw=0&cd="+configuredCdMs, ser:"PRECOUNT 0 "+configuredCdMs}, false);
          sendCommand({http:"/countdown_start", ser:"COUNTDOWN"}, true);
          addLogLine(t("countdownRequestedLog"),"CMD");
          suppressCountdownToastUntil = Date.now() + 3000;
          showToast(t("countdownRequestedToast", {safety:safetyLineSuffix()}),"ignite");
        }
      },40);
    }

    function endHold(){
      releaseLongPressPointerCapture();
      if(!lpTimer) return;
      clearInterval(lpTimer); lpTimer=null;
      resetLongPressVisual();
      if(userWaitingLocal){
        const cdMs = Math.max(3000, Math.min(60000, ((uiSettings ? uiSettings.countdownSec : 10) * 1000)));
        lpLastSentSec=Math.ceil(cdMs/1000);
        sendCommand({http:"/precount?uw=1&cd="+cdMs, ser:"PRECOUNT 1 "+cdMs}, false);
      }
    }
