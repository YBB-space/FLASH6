/* FLASH6 settings and mission authoring/runtime controls. */
    // =====================
    // 설정/발사대
    // =====================
    function isMobileSettingsNavigation(){
      return !isPhoneLandscapeLayout()
        && !!(window.matchMedia && window.matchMedia("(max-width: 600px) and (pointer: coarse)").matches);
    }
    function isSettingsCommunicationOnlyMode(){
      return getSettingsOperationModeValue() === "flash_link" &&
        normalizeFlashLinkRole(uiSettings && uiSettings.flashLinkRole) === "ground";
    }
    function setActiveSettingsPanel(target, titleText){
      if(!target) return;
      document.querySelectorAll(".settings-nav-btn").forEach((btn)=>{
        btn.classList.toggle("active", btn.dataset.target === target);
      });
      document.querySelectorAll(".settings-panel").forEach((panel)=>{
        panel.classList.toggle("active", panel.dataset.panel === target);
      });
      const title = document.getElementById("settingsTitle");
      if(title && titleText) title.textContent = titleText;
      if(target === "communication") scheduleFlashLinkChartRender();
    }
    function syncSettingsCommunicationOnlyUi(){
      if(el.settingsOverlay){
        el.settingsOverlay.classList.remove("settings-communication-only");
        el.settingsOverlay.querySelectorAll(".mobile-settings-menu-card").forEach((card)=>{
          card.classList.remove("settings-card-hidden");
        });
      }
    }
    function setMobileSettingsLanding(){
      if(!el.settingsOverlay) return;
      el.settingsOverlay.classList.remove("mobile-settings-detail");
      const title = document.getElementById("settingsTitle");
      if(title) title.textContent = isMobileSettingsNavigation() ? "설정" : "SETTINGS";
      const body = el.settingsOverlay.querySelector(".settings-body");
      if(body) body.scrollTop = 0;
    }
    function openMobileSettingsSection(target, titleText){
      if(!el.settingsOverlay || !target) return;
      setActiveSettingsPanel(target, titleText || (target === "communication" ? t("settingsNavCommunication") : "설정"));
      el.settingsOverlay.classList.add("mobile-settings-detail");
      const body = el.settingsOverlay.querySelector(".settings-body");
      if(body) body.scrollTop = 0;
    }
    function showSettings(){
      if(isStatusMapViewportExpanded()){
        setStatusMapViewportExpanded(false);
      }
      if(isGyroViewportExpanded()){
        setGyroViewportExpanded(false);
      }
      closeIgnitionModals();
      hideMobileControlsPanel();
      document.documentElement.classList.add("settings-open");
      syncControlsToggleButtonsForSettings();
      syncSettingsCommunicationOnlyUi();
      setOverlayVisible(el.settingsOverlay, true);
      setMobileSettingsLanding();
      scheduleFlashLinkChartRender();
    }
    function hideSettings(){
      document.documentElement.classList.remove("settings-open");
      if(el.settingsOverlay) el.settingsOverlay.classList.remove("mobile-settings-detail");
      setOverlayVisible(el.settingsOverlay, false);
      syncControlsToggleButtonsForSettings();
    }
    function syncControlsToggleButtonsForSettings(){
      const shouldHide = isPhoneLandscapeLayout() && document.documentElement.classList.contains("settings-open");
      const controlsBtns = Array.from(new Set([
        ...(el.controlsToggleBtns ? Array.from(el.controlsToggleBtns) : []),
        ...Array.from(document.querySelectorAll(".js-controls-open, #tabletControlsNavBtn, .side-nav-btn[aria-label='Control panel']"))
      ]));
      controlsBtns.forEach((btn)=>{
        if(!btn) return;
        if(shouldHide){
          btn.style.setProperty("display", "none", "important");
          btn.style.setProperty("pointer-events", "none", "important");
          btn.style.setProperty("visibility", "hidden", "important");
          btn.style.setProperty("opacity", "0", "important");
        }else{
          btn.style.removeProperty("display");
          btn.style.removeProperty("pointer-events");
          btn.style.removeProperty("visibility");
          btn.style.removeProperty("opacity");
        }
      });
    }
    function setMissionCloseLabel(isBack){
      if(!el.missionCloseBtn) return;
      el.missionCloseBtn.textContent = "닫기";
    }
    function resetMissionToPresetList(){
      if(el.missionFields) el.missionFields.classList.remove("hidden");
      if(el.missionPresetBlock) el.missionPresetBlock.classList.remove("hidden");
      if(el.missionDialog){
        el.missionDialog.classList.remove("custom-mode");
        el.missionDialog.classList.remove("ask-test");
        el.missionDialog.classList.remove("review-mode");
      }
      if(el.missionTestInline){
        el.missionTestInline.style.display = "none";
        el.missionTestInline.setAttribute("aria-hidden","true");
      }
      if(el.missionReview) el.missionReview.setAttribute("aria-hidden","true");
      if(el.missionConfirmBtn) el.missionConfirmBtn.textContent = "다음";
      setMissionPresetSelectionUi(selectedMotorName || (el.missionName && el.missionName.value) || "");
      setMissionCloseLabel(false);
      updateMissionEditLockUI();
    }
    function openMissionCustomEditor(){
      resetMissionToPresetList();
    }
    function hasMissionSelected(){
      return !!(
        (selectedMotorName && selectedMotorName.trim()) ||
        (el.missionName && el.missionName.value && el.missionName.value.trim())
      );
    }
    function isMissionEditableNow(){
      if(missionFirmwareLocked) return false;
      if(replaySourceActive) return false;
      if(currentSt !== 0) return false;
      return !(latestTelemetry && latestTelemetry.uw === 1);
    }
    function missionEditUnavailableMessage(){
      if(missionFirmwareLocked){
        return "이 보드에는 미션 코드가 내장되어 있어 미션을 수정할 수 없습니다.";
      }
      return "미션 수정은 IDLE(시퀀스 전)에서만 가능합니다.";
    }
    function setMissionFirmwareCapability(locked, source, reason){
      const nextLocked = !!locked;
      const nextSource = String(source || "");
      const nextReason = String(reason || "");
      const changed =
        missionFirmwareLocked !== nextLocked ||
        missionFirmwareSource !== nextSource ||
        missionFirmwareLockReason !== nextReason;
      missionFirmwareLocked = nextLocked;
      missionFirmwareSource = nextSource;
      missionFirmwareLockReason = nextReason;
      if(changed && el && typeof updateMissionEditLockUI === "function"){
        updateMissionEditLockUI();
      }
    }
    function parseMissionNumber(raw){
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    function sanitizeMissionName(raw){
      return String(raw || "").trim();
    }
    function setMissionPresetSelectionUi(name){
      if(!el.missionPresetGrid) return;
      const target = sanitizeMissionName(name).toLowerCase();
      const presetCards = Array.from(el.missionPresetGrid.querySelectorAll(".mission-preset-btn[data-mission]"));
      let matched = false;
      presetCards.forEach((card)=>{
        const cardName = sanitizeMissionName(card.getAttribute("data-mission")).toLowerCase();
        const selected = !!target && cardName === target;
        card.classList.toggle("is-selected", selected);
        if(selected) matched = true;
      });
      if(el.missionCustomBtn){
        el.missionCustomBtn.classList.toggle("is-selected", !matched);
      }
    }
    function cloneMissionDocSafe(src){
      if(!src || typeof src !== "object") return null;
      try{
        return JSON.parse(JSON.stringify(src));
      }catch(_err){
        return null;
      }
    }
    function missionBlockTemplate(kind){
      const block = {
        level: 0,
        uiX: 0,
        uiY: 0,
        rowType: "full",
        loop: {mode:"count", count:3, gapMs:1000},
        enabled: true,
        once: true,
        delayMs: 0,
        when: {type:"altitude_gte", cmp:"gt", value:100, pin:1},
        then: {type:"servo", channel:1, angle:90}
      };
      const k = String(kind || "");
      if(k === "pyro"){
        block.when = {type:"switch_falling", cmp:"eq", value:0, pin:2};
        block.then = {type:"pyro", channel:1, durationMs:300};
      }else if(k === "cond_sequence_start"){
        block.rowType = "condition";
        block.once = true;
        block.when = {type:"sequence_start", cmp:"eq", value:0, pin:1};
      }else if(k === "cond_altitude"){
        block.rowType = "condition";
        block.when = {type:"altitude_gte", cmp:"gt", value:120, pin:1};
      }else if(k === "cond_start_arm_off"){
        block.rowType = "condition";
        block.once = true;
        block.when = {type:"switch_falling", cmp:"eq", value:0, pin:2};
      }else if(k === "cond_switch_falling"){
        block.rowType = "condition";
        block.when = {type:"switch_falling", cmp:"eq", value:0, pin:2};
      }else if(k === "cond_switch_rising"){
        block.rowType = "condition";
        block.when = {type:"switch_rising", cmp:"eq", value:0, pin:2};
      }else if(k === "cond_time_after_firing"){
        block.rowType = "condition";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:1800, pin:1};
      }else if(k === "cond_gyro_angle"){
        block.rowType = "condition";
        block.when = {type:"gyro_x_deg", cmp:"gt", value:15, pin:1};
      }else if(k === "cond_variable"){
        block.rowType = "condition";
        block.when = {type:"var_value", cmp:"gt", value:0, pin:1, varName:"stage"};
      }else if(k === "cond_var_change_count"){
        block.rowType = "condition";
        block.when = {type:"var_change_count", cmp:"gt", value:3, pin:1, varName:"stage"};
      }else if(k === "act_wait"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.delayMs = 2000;
        block.then = {type:"wait"};
      }else if(k === "act_servo"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"servo", channel:1, angle:90};
      }else if(k === "act_servo_high"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"servo", channel:3, angle:150};
      }else if(k === "act_pyro"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"pyro", channel:1, durationMs:300};
      }else if(k === "act_var_set"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"var_set", channel:1, value:0, varName:"stage"};
      }else if(k === "act_var_add"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"var_add", channel:1, value:1, varName:"stage"};
      }else if(k === "act_var_avg"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"var_avg", channel:1, varName:"avg_alt", sensor:"altitude_m", avgCount:5};
      }else if(k === "act_alarm"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"alarm", title:"미션 알람", message:"미션 알람"};
      }else if(k === "act_buzzer"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"buzzer", value:2000};
      }else if(k === "act_find_buzzer"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"find_buzzer"};
      }else if(k === "act_notone"){
        block.rowType = "action";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"notone"};
      }else if(k === "loop_forever"){
        block.rowType = "loop";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"wait"};
        block.loop = {mode:"forever", count:MISSION_RUNTIME_MAX_BLOCKS, gapMs:1000};
      }else if(k === "loop_count"){
        block.rowType = "loop";
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1};
        block.then = {type:"wait"};
        block.loop = {mode:"count", count:3, gapMs:1000};
      }else if(k === "time_servo"){
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:1500, pin:1};
        block.then = {type:"servo", channel:2, angle:120};
      }else if(k === "time_pyro"){
        block.when = {type:"time_after_firing_ms", cmp:"gt", value:2000, pin:1};
        block.then = {type:"pyro", channel:1, durationMs:350};
      }else if(k === "switch_servo"){
        block.when = {type:"switch_rising", cmp:"eq", value:0, pin:2};
        block.then = {type:"servo", channel:1, angle:100};
      }else if(k === "altitude_pyro"){
        block.when = {type:"altitude_gte", cmp:"gt", value:250, pin:1};
        block.then = {type:"pyro", channel:2, durationMs:300};
      }else if(k === "switch_pyro"){
        block.when = {type:"switch_rising", cmp:"eq", value:0, pin:2};
        block.then = {type:"pyro", channel:1, durationMs:280};
      }else if(k === "altitude_servo_high"){
        block.when = {type:"altitude_gte", cmp:"gt", value:450, pin:1};
        block.then = {type:"servo", channel:3, angle:150};
      }
      return block;
    }
    function toFiniteNumber(v, fallback){
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }
    function formatMissionDelaySec(delayMs){
      const ms = Math.max(0, Math.round(toFiniteNumber(delayMs, 0)));
      const sec = ms / 1000;
      if(Math.abs(sec - Math.round(sec)) < 1e-6){
        return String(Math.round(sec));
      }
      return sec.toFixed(1).replace(/\.0$/, "");
    }
    function normalizeMissionVarName(raw){
      const base = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
      if(!base) return "";
      return base.replace(/[<>"'`]/g, "").slice(0, 24);
    }
    function normalizeMissionAlarmTitle(raw){
      const base = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
      if(!base) return "알람";
      return base.replace(/[<>"'`]/g, "").slice(0, 40);
    }
    function normalizeMissionAlarmMessage(raw){
      const base = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
      if(!base) return "";
      return base.replace(/[<>"'`]/g, "").slice(0, 120);
    }
    function normalizeMissionExprOperandType(raw){
      const t = String(raw || "").trim().toLowerCase();
      if(t === "sensor" || t === "sens") return "sensor";
      return t === "var" ? "var" : "const";
    }
    function normalizeMissionExprSensorType(raw){
      const t = String(raw || "").trim().toLowerCase();
      if(
        t === "altitude_m" || t === "time_after_firing_ms" ||
        t === "gyro_x_deg" || t === "gyro_y_deg" || t === "gyro_z_deg" ||
        t === "thrust_kgf" || t === "pressure_mpa" ||
        t === "acc_x_g" || t === "acc_y_g" || t === "acc_z_g" ||
        t === "gyro_x_dps" || t === "gyro_y_dps" || t === "gyro_z_dps" ||
        t === "switch_state"
      ){
        return t;
      }
      return "altitude_m";
    }
    function missionExprSensorOptionsHtml(selected){
      const pick = normalizeMissionExprSensorType(selected);
      const options = [
        ["altitude_m", "고도(m)"],
        ["time_after_firing_ms", "점화후시간(ms)"],
        ["gyro_x_deg", "자이로X각도(deg)"],
        ["gyro_y_deg", "자이로Y각도(deg)"],
        ["gyro_z_deg", "자이로Z각도(deg)"],
        ["thrust_kgf", "추력(kgf)"],
        ["pressure_mpa", "압력(MPa)"],
        ["acc_x_g", "가속도X(g)"],
        ["acc_y_g", "가속도Y(g)"],
        ["acc_z_g", "가속도Z(g)"],
        ["gyro_x_dps", "자이로X속도(dps)"],
        ["gyro_y_dps", "자이로Y속도(dps)"],
        ["gyro_z_dps", "자이로Z속도(dps)"],
        ["switch_state", "스위치(0/1)"]
      ];
      return options.map(([value, label])=>
        "<option value=\"" + value + "\"" + (pick === value ? " selected" : "") + ">" + label + "</option>"
      ).join("");
    }
    function normalizeMissionExprOperator(raw){
      const op = String(raw || "").trim().toLowerCase();
      if(op === "sub" || op === "-") return "sub";
      if(op === "mul" || op === "*" || op === "x" || op === "×") return "mul";
      if(op === "div" || op === "/") return "div";
      return "add";
    }
    function normalizeMissionVarActionValueMode(raw){
      const mode = String(raw || "").trim().toLowerCase();
      if(mode === "expr") return "expr";
      if(mode === "sensor") return "sensor";
      return "direct";
    }
    function normalizeMissionExprValue(raw, fallback){
      return Math.round(Math.max(-99999, Math.min(99999, toFiniteNumber(raw, fallback))));
    }
    function normalizeMissionExprObject(rawExpr, fallbackValue, fallbackChannel){
      const fallbackNum = normalizeMissionExprValue(fallbackValue, 0);
      const fallbackCh = Math.max(1, Math.min(8, Math.round(toFiniteNumber(fallbackChannel, 1))));
      const src = (rawExpr && typeof rawExpr === "object") ? rawExpr : {};
      const lhsSrc = (src.lhs && typeof src.lhs === "object") ? src.lhs : {};
      const rhsSrc = (src.rhs && typeof src.rhs === "object") ? src.rhs : {};
      const enabled = !!src.enabled;
      const lhsType = normalizeMissionExprOperandType(src.lhsType != null ? src.lhsType : lhsSrc.type);
      const rhsType = normalizeMissionExprOperandType(src.rhsType != null ? src.rhsType : rhsSrc.type);
      return {
        enabled,
        op: normalizeMissionExprOperator(src.op != null ? src.op : src.operator),
        lhsType,
        lhsValue: normalizeMissionExprValue(src.lhsValue != null ? src.lhsValue : lhsSrc.value, fallbackNum),
        lhsVarName: normalizeMissionVarName(src.lhsVarName != null ? src.lhsVarName : (lhsSrc.varName != null ? lhsSrc.varName : lhsSrc.name)),
        lhsSensor: normalizeMissionExprSensorType(src.lhsSensor != null ? src.lhsSensor : (lhsSrc.sensor != null ? lhsSrc.sensor : lhsSrc.sensorType)),
        lhsChannel: Math.max(1, Math.min(8, Math.round(toFiniteNumber(src.lhsChannel != null ? src.lhsChannel : lhsSrc.channel, fallbackCh)))),
        rhsType,
        rhsValue: normalizeMissionExprValue(src.rhsValue != null ? src.rhsValue : rhsSrc.value, 0),
        rhsVarName: normalizeMissionVarName(src.rhsVarName != null ? src.rhsVarName : (rhsSrc.varName != null ? rhsSrc.varName : rhsSrc.name)),
        rhsSensor: normalizeMissionExprSensorType(src.rhsSensor != null ? src.rhsSensor : (rhsSrc.sensor != null ? rhsSrc.sensor : rhsSrc.sensorType)),
        rhsChannel: Math.max(1, Math.min(8, Math.round(toFiniteNumber(src.rhsChannel != null ? src.rhsChannel : rhsSrc.channel, fallbackCh))))
      };
    }
    function evaluateMissionExprValue(expr, readVarValue, fallbackValue, readSensorValue){
      const normalized = normalizeMissionExprObject(expr, fallbackValue, 1);
      const fallbackNum = normalizeMissionExprValue(fallbackValue, 0);
      if(!normalized.enabled) return fallbackNum;
      const getter = (typeof readVarValue === "function")
        ? readVarValue
        : (()=>0);
      const sensorGetter = (typeof readSensorValue === "function")
        ? readSensorValue
        : (()=>0);
      const lhs = (normalized.lhsType === "var")
        ? normalizeMissionExprValue(getter(normalized.lhsVarName, normalized.lhsChannel), 0)
        : ((normalized.lhsType === "sensor")
          ? normalizeMissionExprValue(sensorGetter(normalized.lhsSensor), 0)
          : normalized.lhsValue);
      const rhs = (normalized.rhsType === "var")
        ? normalizeMissionExprValue(getter(normalized.rhsVarName, normalized.rhsChannel), 0)
        : ((normalized.rhsType === "sensor")
          ? normalizeMissionExprValue(sensorGetter(normalized.rhsSensor), 0)
          : normalized.rhsValue);
      let out = lhs;
      if(normalized.op === "sub") out = lhs - rhs;
      else if(normalized.op === "mul") out = lhs * rhs;
      else if(normalized.op === "div"){
        out = (rhs === 0) ? 0 : Math.round(lhs / rhs);
      }else{
        out = lhs + rhs;
      }
      return normalizeMissionExprValue(out, fallbackNum);
    }
    function missionHtmlEscape(value){
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
    function normalizeMissionRowType(raw){
      const t = String(raw || "full");
      if(t === "condition" || t === "action" || t === "full" || t === "loop") return t;
      return "full";
    }
    function normalizeMissionLoopMode(raw){
      const mode = String(raw || "").trim().toLowerCase();
      if(mode === "forever" || mode === "infinite" || mode === "inf") return "forever";
      return "count";
    }
    function normalizeMissionLoopObject(rawLoop){
      const src = (rawLoop && typeof rawLoop === "object") ? rawLoop : {};
      const mode = normalizeMissionLoopMode(src.mode != null ? src.mode : src.type);
      const count = Math.max(1, Math.min(200, Math.round(toFiniteNumber(src.count, 3))));
      const gapMs = Math.max(0, Math.min(60000, Math.round(toFiniteNumber(src.gapMs != null ? src.gapMs : src.intervalMs, 1000))));
      return {mode, count, gapMs};
    }
    function normalizeMissionLevel(raw){
      const n = Math.round(toFiniteNumber(raw, 0));
      return Math.max(0, Math.min(6, n));
    }
    function normalizeMissionUiCoord(raw){
      const n = Math.round(toFiniteNumber(raw, 0));
      return Math.max(-MISSION_BLOCK_POS_LIMIT, Math.min(MISSION_BLOCK_POS_LIMIT, n));
    }
    function normalizeMissionComparator(raw, whenType){
      const val = String(raw || "").trim();
      if(val === "gt" || val === ">" || val === ">=") return "gt";
      if(val === "lt" || val === "<" || val === "<=") return "lt";
      if(val === "eq" || val === "=" || val === "=="){
        if(String(whenType || "") === "var_change_count") return "gt";
        return "eq";
      }
      if(String(whenType || "") === "var_change_count"){
        return "gt";
      }
      if(
        String(whenType || "") === "switch_falling" ||
        String(whenType || "") === "switch_rising" ||
        String(whenType || "") === "sequence_start" ||
        String(whenType || "") === "boot"
      ){
        return "eq";
      }
      return "gt";
    }
    function normalizeMissionTriggerValue(whenType, raw){
      const t = String(whenType || "");
      const n = toFiniteNumber(raw, 0);
      if(t === "switch_falling" || t === "switch_rising" || t === "sequence_start" || t === "boot") return 0;
      if(t === "var_value") return Math.max(-99999, Math.min(99999, n));
      if(t === "var_change_count") return Math.max(1, Math.min(99999, Math.round(n)));
      if(t === "gyro_x_deg" || t === "gyro_y_deg" || t === "gyro_z_deg"){
        return Math.max(-360, Math.min(360, n));
      }
      return Math.max(0, n);
    }
    function normalizeMissionVarWhenRhsType(raw){
      const t = String(raw || "").trim().toLowerCase();
      return (t === "var" || t === "variable") ? "var" : "const";
    }
    function isMissionWhenTypeSupported(type){
      const t = String(type || "");
      return t === "altitude_gte" || t === "switch_falling" ||
        t === "switch_rising" || t === "sequence_start" || t === "time_after_firing_ms" ||
        t === "gyro_x_deg" || t === "gyro_y_deg" || t === "gyro_z_deg" ||
        t === "var_value" || t === "var_change_count" || t === "boot";
    }
    function normalizeMissionWhenObject(rawWhen, fallbackType){
      const srcWhen = (rawWhen && typeof rawWhen === "object") ? rawWhen : {};
      let whenType = String(srcWhen.type || fallbackType || "altitude_gte");
      if(!isMissionWhenTypeSupported(whenType)){
        whenType = String(fallbackType || "altitude_gte");
      }
      if(!isMissionWhenTypeSupported(whenType)){
        whenType = "altitude_gte";
      }
      const rawVarName = (srcWhen.varName != null) ? srcWhen.varName : srcWhen.name;
      const varName = (whenType === "var_value" || whenType === "var_change_count") ? normalizeMissionVarName(rawVarName) : "";
      let rhsType = "const";
      let rhsValue = normalizeMissionTriggerValue(whenType, srcWhen.value);
      let rhsVarName = "";
      if(whenType === "var_value"){
        rhsType = normalizeMissionVarWhenRhsType(srcWhen.rhsType != null ? srcWhen.rhsType : srcWhen.valueType);
        rhsVarName = normalizeMissionVarName(
          (srcWhen.rhsVarName != null) ? srcWhen.rhsVarName
            : ((srcWhen.rhsName != null) ? srcWhen.rhsName : srcWhen.valueVarName)
        );
        if(rhsType === "var" && !rhsVarName){
          const legacyValueName = normalizeMissionVarName(srcWhen.value);
          if(legacyValueName){
            rhsVarName = legacyValueName;
          }else{
            rhsType = "const";
          }
        }
        if(rhsType === "var"){
          rhsValue = 0;
        }
      }
      const isSwitchWhen = (whenType === "switch_falling" || whenType === "switch_rising");
      return {
        type: whenType,
        cmp: normalizeMissionComparator(srcWhen.cmp != null ? srcWhen.cmp : srcWhen.op, whenType),
        value: rhsValue,
        pin: isSwitchWhen ? 2 : Math.max(1, Math.round(toFiniteNumber(srcWhen.pin, 1))),
        varName,
        rhsType,
        rhsValue,
        rhsVarName
      };
    }
    function normalizeMissionBlock(raw){
      const src = (raw && typeof raw === "object") ? raw : {};
      const when = (src.when && typeof src.when === "object") ? src.when : {};
      const then = (src.then && typeof src.then === "object") ? src.then : {};
      const normalizedWhen = normalizeMissionWhenObject(when, "altitude_gte");
      const actionType = String(then.type || "servo");
      const rowType = normalizeMissionRowType(src.rowType);
      const loopRaw = (src.loop && typeof src.loop === "object")
        ? src.loop
        : {
            mode: src.loopMode,
            count: src.loopCount,
            gapMs: src.loopGapMs != null ? src.loopGapMs : src.loopIntervalMs
          };

      const normalizedThenValue = Math.round(Math.max(-99999, Math.min(99999, toFiniteNumber(
        then.value != null ? then.value : (then.hz != null ? then.hz : then.angle),
        0
      ))));
      const out = {
        level: normalizeMissionLevel(src.level),
        uiX: normalizeMissionUiCoord(src.uiX),
        uiY: normalizeMissionUiCoord(src.uiY),
        rowType,
        loop: normalizeMissionLoopObject(loopRaw),
        enabled: src.enabled !== false,
        once: src.once !== false,
        delayMs: Math.max(0, Math.round(toFiniteNumber(src.delayMs, 0))),
        when: normalizedWhen,
        then: {
          type: actionType,
          channel: Math.max(1, Math.round(toFiniteNumber(then.channel, 1))),
          angle: Math.max(0, Math.min(SERVO_MAX_DEG, Math.round(toFiniteNumber(then.angle, 90)))),
          durationMs: Math.max(10, Math.round(toFiniteNumber(then.durationMs, 300))),
          value: normalizedThenValue,
          varName: normalizeMissionVarName((then.varName != null) ? then.varName : then.name),
          sensor: normalizeMissionExprSensorType((then.sensor != null) ? then.sensor : then.sensorType),
          avgCount: Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, Math.round(toFiniteNumber(then.avgCount != null ? then.avgCount : then.samples, 5)))),
          title: normalizeMissionAlarmTitle(then.title),
          message: normalizeMissionAlarmMessage((then.message != null) ? then.message : then.text),
          expr: normalizeMissionExprObject(then.expr, normalizedThenValue, then.channel)
        }
      };
      if(out.rowType === "loop"){
        out.when = normalizeMissionWhenObject({type:"time_after_firing_ms", cmp:"gt", value:0, pin:1}, "time_after_firing_ms");
        out.then.type = "wait";
        out.then.channel = 0;
        out.then.angle = 0;
        out.then.durationMs = 0;
        out.then.value = 0;
        out.then.varName = "";
        out.then.title = "";
        out.then.message = "";
        out.then.expr = normalizeMissionExprObject(null, 0, 1);
      }else if(out.then.type === "pyro"){
        out.then.channel = normalizePyroChannel(out.then.channel, 1);
        out.then.varName = "";
        out.then.title = "";
        out.then.message = "";
        out.then.expr = normalizeMissionExprObject(null, 0, 1);
      }else if(out.then.type === "var_set" || out.then.type === "var_add"){
        out.then.channel = Math.max(1, Math.min(8, out.then.channel));
        out.then.angle = 0;
        out.then.durationMs = 0;
        if(!out.then.varName){
          out.then.varName = out.when.varName || "";
        }
        out.then.expr = normalizeMissionExprObject(then.expr, out.then.value, out.then.channel);
        out.then.title = "";
        out.then.message = "";
      }else if(out.then.type === "var_avg"){
        out.then.channel = Math.max(1, Math.min(8, out.then.channel));
        out.then.angle = 0;
        out.then.durationMs = 0;
        out.then.value = Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, Math.round(toFiniteNumber(out.then.avgCount, 5))));
        out.then.avgCount = out.then.value;
        out.then.sensor = normalizeMissionExprSensorType(out.then.sensor);
        if(!out.then.varName){
          out.then.varName = out.when.varName || "";
        }
        out.then.title = "";
        out.then.message = "";
        out.then.expr = normalizeMissionExprObject(null, 0, 1);
      }else if(out.then.type === "alarm"){
        out.then.channel = 0;
        out.then.angle = 0;
        out.then.durationMs = 0;
        out.then.value = 0;
        out.then.varName = "";
        out.then.title = normalizeMissionAlarmTitle(out.then.title);
        out.then.message = normalizeMissionAlarmMessage(out.then.message);
        out.then.expr = normalizeMissionExprObject(null, 0, 1);
      }else if(out.then.type === "buzzer"){
        out.then.type = "buzzer";
        out.then.channel = 0;
        out.then.angle = 0;
        out.then.durationMs = 0;
        out.then.value = Math.max(1, Math.min(10000, Math.round(toFiniteNumber(out.then.value, 2000))));
        out.then.varName = "";
        out.then.title = "";
        out.then.message = "";
        out.then.expr = normalizeMissionExprObject(null, 0, 1);
      }else if(out.then.type === "find_buzzer"){
        out.then.type = "find_buzzer";
        out.then.channel = 0;
        out.then.angle = 0;
        out.then.durationMs = 0;
        out.then.value = 0;
        out.then.varName = "";
        out.then.title = "";
        out.then.message = "";
        out.then.expr = normalizeMissionExprObject(null, 0, 1);
      }else if(out.then.type === "notone"){
        out.then.type = "notone";
        out.then.channel = 0;
        out.then.angle = 0;
        out.then.durationMs = 0;
        out.then.value = 0;
        out.then.varName = "";
        out.then.title = "";
        out.then.message = "";
        out.then.expr = normalizeMissionExprObject(null, 0, 1);
      }else if(out.then.type === "wait"){
        out.then.type = "wait";
        out.then.channel = 0;
        out.then.angle = 0;
        out.then.durationMs = 0;
        out.then.value = 0;
        out.then.varName = "";
        out.then.title = "";
        out.then.message = "";
        out.then.expr = normalizeMissionExprObject(null, 0, 1);
      }else{
        out.then.type = "servo";
        out.then.channel = Math.max(1, Math.min(SERVO_CHANNELS.length, out.then.channel));
        out.then.value = out.then.angle;
        out.then.varName = "";
        out.then.title = "";
        out.then.message = "";
        out.then.expr = normalizeMissionExprObject(null, 0, 1);
      }
      if(Array.isArray(src.whenAll)){
        const chain = src.whenAll
          .map((item)=>normalizeMissionWhenObject(item, out.when.type))
          .filter((item)=>isMissionWhenTypeSupported(item.type));
        if(chain.length){
          const capped = chain.slice(0, 7);
          out.whenAll = capped;
          out.when = capped[capped.length - 1];
        }
      }
      return out;
    }
    function normalizeMissionBlocks(list){
      if(!Array.isArray(list)) return [];
      return list.map((item)=>normalizeMissionBlock(item));
    }
    function toRuntimeMissionBlock(raw){
      const block = normalizeMissionBlock(raw);
      if(block.rowType === "loop"){
        return null;
      }
      if(block.then.type === "wait"){
        return null;
      }
      const out = {
        enabled: block.enabled,
        once: block.once,
        delayMs: block.delayMs,
        when: {
          type: block.when.type,
          cmp: normalizeMissionComparator(block.when.cmp, block.when.type),
          value: block.when.value,
          pin: block.when.pin,
          varName: normalizeMissionVarName(block.when.varName),
          rhsType: normalizeMissionVarWhenRhsType(block.when.rhsType),
          rhsValue: Math.round(normalizeMissionTriggerValue(block.when.type, block.when.rhsValue != null ? block.when.rhsValue : block.when.value)),
          rhsVarName: normalizeMissionVarName(block.when.rhsVarName)
        },
        then: {
          type: block.then.type,
          channel: block.then.channel,
          varName: normalizeMissionVarName(block.then.varName)
        }
      };
      if(Array.isArray(block.whenAll) && block.whenAll.length){
        out.whenAll = block.whenAll.map((item)=>({
          type: item.type,
          cmp: normalizeMissionComparator(item.cmp, item.type),
          value: item.value,
          pin: item.pin,
          varName: normalizeMissionVarName(item.varName),
          rhsType: normalizeMissionVarWhenRhsType(item.rhsType),
          rhsValue: Math.round(normalizeMissionTriggerValue(item.type, item.rhsValue != null ? item.rhsValue : item.value)),
          rhsVarName: normalizeMissionVarName(item.rhsVarName)
        }));
      }
      if(block.then.type === "pyro"){
        out.then.durationMs = block.then.durationMs;
      }else if(block.then.type === "var_set" || block.then.type === "var_add"){
        out.then.value = block.then.value;
        const expr = normalizeMissionExprObject(block.then.expr, block.then.value, block.then.channel);
        if(expr.enabled){
          out.then.expr = expr;
        }
      }else if(block.then.type === "var_avg"){
        out.then.sensor = normalizeMissionExprSensorType(block.then.sensor);
        out.then.avgCount = Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, Math.round(toFiniteNumber(block.then.avgCount, block.then.value || 5))));
      }else if(block.then.type === "buzzer"){
        out.then.value = Math.max(1, Math.min(10000, Math.round(toFiniteNumber(block.then.value, 2000))));
      }else if(block.then.type === "find_buzzer"){
        // no extra fields
      }else if(block.then.type === "alarm"){
        out.then.title = normalizeMissionAlarmTitle(block.then.title);
        out.then.message = normalizeMissionAlarmMessage(block.then.message);
      }else if(block.then.type === "notone"){
        // no extra fields
      }else{
        out.then.angle = block.then.angle;
      }
      return out;
    }
    function compileMissionRuntimeBlocks(rows){
      const srcRows = normalizeMissionBlocks(rows);
      const compiled = [];
      const conditionByLevel = [];
      const loopByLevel = [];
      let pendingDelayMs = 0;
      const cloneWhen = (rawWhen)=>({
        type: rawWhen.type,
        cmp: normalizeMissionComparator(rawWhen.cmp, rawWhen.type),
        value: rawWhen.value,
        pin: rawWhen.pin,
        varName: normalizeMissionVarName(rawWhen.varName),
        rhsType: normalizeMissionVarWhenRhsType(rawWhen.rhsType),
        rhsValue: Math.round(normalizeMissionTriggerValue(rawWhen.type, rawWhen.rhsValue != null ? rawWhen.rhsValue : rawWhen.value)),
        rhsVarName: normalizeMissionVarName(rawWhen.rhsVarName)
      });
      const cloneLoop = (rawLoop)=>normalizeMissionLoopObject(rawLoop);
      const collectParentWhenChainForActionLevel = (level)=>{
        const lv = normalizeMissionLevel(level);
        const chain = [];
        for(let i = 0; i < lv; i++){
          if(conditionByLevel[i]){
            chain.push(cloneWhen(conditionByLevel[i]));
          }
        }
        return chain;
      };
      const collectParentLoopsForActionLevel = (level)=>{
        const lv = normalizeMissionLevel(level);
        const chain = [];
        for(let i = 0; i < lv; i++){
          if(loopByLevel[i]){
            chain.push(cloneLoop(loopByLevel[i]));
          }
        }
        return chain;
      };
      const defaultWhen = ()=>({type:"time_after_firing_ms", cmp:"gt", value:0, pin:1});
      const expandWithLoops = (runtime, loops)=>{
        if(compiled.length >= MISSION_RUNTIME_MAX_BLOCKS) return;
        const pushRuntime = (extraDelayMs)=>{
          if(compiled.length >= MISSION_RUNTIME_MAX_BLOCKS) return;
          const clone = JSON.parse(JSON.stringify(runtime));
          clone.delayMs = Math.max(0, Math.round(toFiniteNumber(clone.delayMs, 0) + extraDelayMs));
          compiled.push(clone);
        };
        if(!Array.isArray(loops) || loops.length === 0){
          pushRuntime(0);
          return;
        }
        const walk = (loopIndex, extraDelayMs)=>{
          if(compiled.length >= MISSION_RUNTIME_MAX_BLOCKS) return;
          if(loopIndex >= loops.length){
            pushRuntime(extraDelayMs);
            return;
          }
          const lp = normalizeMissionLoopObject(loops[loopIndex]);
          const repeatCount = (lp.mode === "forever")
            ? MISSION_RUNTIME_MAX_BLOCKS
            : Math.max(1, Math.round(toFiniteNumber(lp.count, 1)));
          const gapMs = Math.max(0, Math.round(toFiniteNumber(lp.gapMs, 1000)));
          for(let i = 0; i < repeatCount; i++){
            if(compiled.length >= MISSION_RUNTIME_MAX_BLOCKS) break;
            walk(loopIndex + 1, extraDelayMs + (i * gapMs));
          }
        };
        walk(0, 0);
      };
      const flushAction = (rawBlock, parentLoops)=>{
        if(compiled.length >= MISSION_RUNTIME_MAX_BLOCKS) return;
        const runtime = toRuntimeMissionBlock(rawBlock);
        if(!runtime) return;
        runtime.delayMs = Math.max(0, runtime.delayMs + pendingDelayMs);
        expandWithLoops(runtime, parentLoops);
      };
      srcRows.forEach((row)=>{
        if(compiled.length >= MISSION_RUNTIME_MAX_BLOCKS) return;
        const rowLevel = normalizeMissionLevel(row.level);
        const rowType = normalizeMissionRowType(row.rowType);
        conditionByLevel.length = Math.min(conditionByLevel.length, rowLevel);
        loopByLevel.length = Math.min(loopByLevel.length, rowLevel);
        if(rowType === "condition"){
          conditionByLevel[rowLevel] = cloneWhen(row.when);
          return;
        }
        if(rowType === "loop"){
          loopByLevel[rowLevel] = cloneLoop(row.loop);
          return;
        }
        const isWaitAction = row.then && row.then.type === "wait";
        const parentLoops = collectParentLoopsForActionLevel(rowLevel);
        if(rowType === "action"){
          if(isWaitAction){
            pendingDelayMs += Math.max(0, row.delayMs);
            return;
          }
          const parentWhenChain = collectParentWhenChainForActionLevel(rowLevel);
          const whenAll = parentWhenChain.length ? parentWhenChain : [defaultWhen()];
          const when = cloneWhen(whenAll[whenAll.length - 1]);
          flushAction({
            rowType: "full",
            enabled: row.enabled,
            once: row.once,
            delayMs: row.delayMs,
            when,
            whenAll,
            then: row.then
          }, parentLoops);
          return;
        }
        if(isWaitAction){
          pendingDelayMs += Math.max(0, row.delayMs);
          conditionByLevel[rowLevel] = cloneWhen(row.when);
          return;
        }
        const parentWhenChain = collectParentWhenChainForActionLevel(rowLevel);
        const whenAll = parentWhenChain.concat([cloneWhen(row.when)]);
        flushAction({
          rowType: "full",
          enabled: row.enabled,
          once: row.once,
          delayMs: row.delayMs,
          when: whenAll[whenAll.length - 1],
          whenAll,
          then: row.then
        }, parentLoops);
        conditionByLevel[rowLevel] = cloneWhen(row.when);
      });
      return compiled.slice(0, MISSION_RUNTIME_MAX_BLOCKS);
    }
    function expandRuntimeBlocksToEditorRows(runtimeBlocks){
      const src = normalizeMissionBlocks(runtimeBlocks);
      const expanded = [];
      src.forEach((block)=>{
        const chain = (Array.isArray(block.whenAll) && block.whenAll.length)
          ? block.whenAll
          : [block.when];
        chain.forEach((whenItem, idx)=>{
          expanded.push(normalizeMissionBlock({
            level: idx,
            uiX: normalizeMissionUiCoord(block.uiX),
            uiY: normalizeMissionUiCoord(block.uiY),
            rowType: "condition",
            enabled: true,
            once: true,
            delayMs: 0,
            when: whenItem,
            then: {type:"servo", channel:1, angle:90}
          }));
        });
        const actionLevel = Math.min(6, Math.max(1, chain.length));
        expanded.push(normalizeMissionBlock({
          level: actionLevel,
          uiX: normalizeMissionUiCoord(block.uiX),
          uiY: normalizeMissionUiCoord(block.uiY),
          rowType: "action",
          enabled: block.enabled,
          once: block.once,
          delayMs: block.delayMs,
          when: block.when,
          then: block.then
        }));
      });
      return expanded;
    }
    function getTriggerLabelAndUnit(type){
      if(type === "altitude_gte") return {phrase:"고도", unit:"m 이상", hasValue:true, keyMode:"none"};
      if(type === "sequence_start") return {phrase:"시퀀스", unit:"시작", hasValue:false, keyMode:"none"};
      if(type === "boot") return {phrase:"부팅", unit:"시작", hasValue:false, keyMode:"none"};
      if(type === "time_after_firing_ms") return {phrase:"점화 후", unit:"ms 이후", hasValue:true, keyMode:"none"};
      if(type === "switch_rising") return {phrase:"ARM", unit:"OFF→ON", hasValue:false, keyMode:"pin"};
      if(type === "switch_falling") return {phrase:"ARM", unit:"ON→OFF", hasValue:false, keyMode:"pin"};
      if(type === "gyro_x_deg") return {phrase:"자이로 X", unit:"deg", hasValue:true, keyMode:"none"};
      if(type === "gyro_y_deg") return {phrase:"자이로 Y", unit:"deg", hasValue:true, keyMode:"none"};
      if(type === "gyro_z_deg") return {phrase:"자이로 Z", unit:"deg", hasValue:true, keyMode:"none"};
      if(type === "var_value") return {phrase:"변수", unit:"값", hasValue:true, keyMode:"var"};
      if(type === "var_change_count") return {phrase:"변수 변화", unit:"이전값 대비 연속", hasValue:true, keyMode:"var"};
      return {phrase:"조건", unit:"-", hasValue:true, keyMode:"none"};
    }
    function getActionLabelAndUnit(type){
      if(type === "servo") return {phrase:"서보", unit:"deg"};
      if(type === "pyro") return {phrase:"파이로", unit:"ms"};
      if(type === "buzzer") return {phrase:"버저", unit:"Hz"};
      if(type === "find_buzzer") return {phrase:"파인드 버저", unit:"패턴"};
      if(type === "notone") return {phrase:"버저", unit:"정지"};
      if(type === "var_set") return {phrase:"변수", unit:"값"};
      if(type === "var_add") return {phrase:"변수", unit:"Δ"};
      if(type === "var_avg") return {phrase:"변수", unit:"회 평균"};
      if(type === "alarm") return {phrase:"알람", unit:"제목/내용"};
      if(type === "wait") return {phrase:"기다리기", unit:"초"};
      return {phrase:"동작", unit:"-"};
    }
    function updateMissionBlockRowUi(row){
      if(!row) return;
      const rowType = normalizeMissionRowType(row.getAttribute("data-row-type"));
      const triggerTypeEl = row.querySelector("[data-role='triggerType']");
      const triggerValueWrap = row.querySelector("[data-role='triggerValueWrap']");
      const triggerPhraseEl = row.querySelector("[data-role='triggerPhrase']");
      const triggerUnitEl = row.querySelector("[data-role='triggerUnit']");
      const triggerValueLabelEl = row.querySelector("[data-role='triggerValueLabel']");
      const triggerOpEl = row.querySelector("[data-role='triggerOp']");
      const triggerValueTypeEl = row.querySelector("[data-role='triggerValueType']");
      const triggerValueEl = row.querySelector("[data-role='triggerValue']");
      const triggerValueVarNameEl = row.querySelector("[data-role='triggerValueVarName']");
      const triggerKeyWrapEl = row.querySelector("[data-role='triggerKeyWrap']");
      const triggerKeyLabelEl = row.querySelector("[data-role='triggerKeyLabel']");
      const triggerPinEl = row.querySelector("[data-role='triggerPin']");
      const triggerVarNameEl = row.querySelector("[data-role='triggerVarName']");
      const actionTypeEl = row.querySelector("[data-role='actionType']");
      const actionPhraseEl = row.querySelector("[data-role='actionPhrase']");
      const actionUnitEl = row.querySelector("[data-role='actionUnit']");
      const actionKeyLabelEl = row.querySelector("[data-role='actionKeyLabel']");
      const actionChannelEl = row.querySelector("[data-role='actionChannel']");
      const actionVarNameEl = row.querySelector("[data-role='actionVarName']");
      const actionTextEl = row.querySelector("[data-role='actionText']");
      const actionSubLabelEl = row.querySelector("[data-role='actionSubLabel']");
      const actionTextSubEl = row.querySelector("[data-role='actionTextSub']");
      const actionValueEl = row.querySelector("[data-role='actionValue']");
      const actionValueModeEl = row.querySelector("[data-role='actionValueMode']");
      const actionSensorEl = row.querySelector("[data-role='actionSensor']");
      const actionExprWrapEl = row.querySelector("[data-role='actionExprWrap']");
      const actionExprLhsTypeEl = row.querySelector("[data-role='actionExprLhsType']");
      const actionExprLhsValueEl = row.querySelector("[data-role='actionExprLhsValue']");
      const actionExprLhsVarNameEl = row.querySelector("[data-role='actionExprLhsVarName']");
      const actionExprLhsSensorEl = row.querySelector("[data-role='actionExprLhsSensor']");
      const actionExprOpEl = row.querySelector("[data-role='actionExprOp']");
      const actionExprRhsTypeEl = row.querySelector("[data-role='actionExprRhsType']");
      const actionExprRhsValueEl = row.querySelector("[data-role='actionExprRhsValue']");
      const actionExprRhsVarNameEl = row.querySelector("[data-role='actionExprRhsVarName']");
      const actionExprRhsSensorEl = row.querySelector("[data-role='actionExprRhsSensor']");
      const actionConfigWrapEl = row.querySelector("[data-role='actionConfigWrap']");
      const waitWrapEl = row.querySelector("[data-role='waitWrap']");
      const actionHeadWrapEl = row.querySelector("[data-role='actionHeadWrap']");
      const actionTypeWrapEl = row.querySelector("[data-role='actionTypeWrap']");
      const delaySecEl = row.querySelector("[data-role='delaySec']");
      const loopModeEl = row.querySelector("[data-role='loopMode']");
      const loopCountWrapEl = row.querySelector("[data-role='loopCountWrap']");
      const loopCountEl = row.querySelector("[data-role='loopCount']");
      if(rowType === "loop"){
        row.setAttribute("data-action-type", "loop");
        const mode = normalizeMissionLoopMode((loopModeEl || {}).value);
        if(loopModeEl) loopModeEl.value = mode;
        if(loopCountWrapEl) loopCountWrapEl.style.display = (mode === "count") ? "" : "none";
        if(loopCountEl){
          const count = Math.max(1, Math.min(200, Math.round(toFiniteNumber(loopCountEl.value, 3))));
          loopCountEl.value = String(count);
        }
        return;
      }
      if(triggerTypeEl){
        const triggerInfo = getTriggerLabelAndUnit(triggerTypeEl.value);
        if(triggerPhraseEl) triggerPhraseEl.textContent = triggerInfo.phrase;
        if(triggerUnitEl) triggerUnitEl.textContent = triggerInfo.unit;
        if(triggerValueWrap) triggerValueWrap.style.display = triggerInfo.hasValue ? "" : "none";
        if(triggerOpEl && triggerInfo.hasValue){
          triggerOpEl.value = normalizeMissionComparator((triggerOpEl || {}).value, triggerTypeEl.value);
        }
        if(triggerOpEl && !triggerInfo.hasValue){
          triggerOpEl.value = "eq";
        }
        if(triggerValueLabelEl) triggerValueLabelEl.style.display = triggerInfo.hasValue ? "" : "none";
        if(triggerOpEl) triggerOpEl.style.display = triggerInfo.hasValue ? "" : "none";
        const varRhsMode = normalizeMissionVarWhenRhsType((triggerValueTypeEl || {}).value);
        const useVarRhs = (triggerTypeEl.value === "var_value" && varRhsMode === "var");
        if(triggerValueTypeEl){
          triggerValueTypeEl.value = varRhsMode;
          triggerValueTypeEl.style.display = (triggerTypeEl.value === "var_value") ? "" : "none";
        }
        if(triggerValueVarNameEl){
          triggerValueVarNameEl.style.display = useVarRhs ? "" : "none";
          if(useVarRhs){
            triggerValueVarNameEl.value = normalizeMissionVarName(triggerValueVarNameEl.value);
          }
        }
        if(triggerValueLabelEl && triggerTypeEl.value === "var_value"){
          triggerValueLabelEl.textContent = "기준";
        }else if(triggerValueLabelEl && triggerTypeEl.value === "var_change_count"){
          triggerValueLabelEl.textContent = "연속횟수";
        }else if(triggerValueLabelEl){
          triggerValueLabelEl.textContent = "값";
        }
        if(triggerOpEl){
          const opEq = triggerOpEl.querySelector("option[value='eq']");
          const opGt = triggerOpEl.querySelector("option[value='gt']");
          const opLt = triggerOpEl.querySelector("option[value='lt']");
          if(triggerTypeEl.value === "var_change_count"){
            if(opGt) opGt.textContent = "이상";
            if(opLt) opLt.textContent = "이하";
            if(opEq){
              opEq.disabled = true;
              opEq.hidden = true;
            }
            if(triggerOpEl.value === "eq"){
              triggerOpEl.value = "gt";
            }
          }else{
            if(opGt) opGt.textContent = ">";
            if(opLt) opLt.textContent = "<";
            if(opEq){
              opEq.disabled = false;
              opEq.hidden = false;
              opEq.textContent = "==";
            }
          }
        }
        const triggerKeyMode = String(triggerInfo.keyMode || "none");
        if(triggerKeyWrapEl) triggerKeyWrapEl.style.display = (triggerKeyMode === "none") ? "none" : "";
        const isSwitchTriggerType = (triggerTypeEl.value === "switch_falling" || triggerTypeEl.value === "switch_rising");
        if(triggerKeyLabelEl){
          if(triggerKeyMode === "var"){
            triggerKeyLabelEl.textContent = "VAR";
          }else if(isSwitchTriggerType){
            triggerKeyLabelEl.textContent = "IO";
          }else{
            triggerKeyLabelEl.textContent = "PIN";
          }
        }
        if(triggerPinEl) triggerPinEl.style.display = (triggerKeyMode === "pin") ? "" : "none";
        if(triggerVarNameEl){
          triggerVarNameEl.style.display = (triggerKeyMode === "var") ? "" : "none";
          if(triggerKeyMode === "var"){
            triggerVarNameEl.value = normalizeMissionVarName(triggerVarNameEl.value);
          }
        }
        if(triggerPinEl && triggerKeyMode !== "none"){
          const current = Math.max(1, Math.round(toFiniteNumber(triggerPinEl.value, 1)));
          triggerPinEl.innerHTML = "";
          if(isSwitchTriggerType){
            const option = document.createElement("option");
            option.value = "5";
            option.textContent = "5";
            triggerPinEl.appendChild(option);
            triggerPinEl.value = "5";
          }else{
            const max = (triggerKeyMode === "var") ? 8 : 4;
            for(let i = 1; i <= max; i++){
              const option = document.createElement("option");
              option.value = String(i);
              option.textContent = String(i);
              triggerPinEl.appendChild(option);
            }
            triggerPinEl.value = String(Math.max(1, Math.min(max, current)));
          }
        }
        if(triggerValueEl){
          triggerValueEl.style.display = useVarRhs ? "none" : "";
          if(triggerTypeEl.value === "gyro_x_deg" || triggerTypeEl.value === "gyro_y_deg" || triggerTypeEl.value === "gyro_z_deg"){
            triggerValueEl.min = "-360";
            triggerValueEl.max = "360";
            triggerValueEl.step = "1";
          }else if(triggerTypeEl.value === "var_value"){
            triggerValueEl.min = "-99999";
            triggerValueEl.max = "99999";
            triggerValueEl.step = "1";
          }else if(triggerTypeEl.value === "var_change_count"){
            triggerValueEl.min = "1";
            triggerValueEl.max = "99999";
            triggerValueEl.step = "1";
          }else{
            triggerValueEl.min = "0";
            triggerValueEl.max = "";
            triggerValueEl.step = "1";
          }
          triggerValueEl.value = String(Math.round(normalizeMissionTriggerValue(triggerTypeEl.value, triggerValueEl.value)));
        }
      }
        if(actionTypeEl){
          const actionType = actionTypeEl.value;
          const actionInfo = getActionLabelAndUnit(actionType);
          row.setAttribute("data-action-type", actionType);
          if(actionPhraseEl) actionPhraseEl.textContent = actionInfo.phrase;
        if(actionUnitEl) actionUnitEl.textContent = actionInfo.unit;
        if(waitWrapEl) waitWrapEl.style.display = (actionType === "wait") ? "" : "none";
        if(actionHeadWrapEl) actionHeadWrapEl.style.display = (actionType === "wait") ? "none" : "";
        if(actionTypeWrapEl) actionTypeWrapEl.style.display = (actionType === "wait") ? "none" : "";
        if(actionConfigWrapEl){
          actionConfigWrapEl.style.display = (actionType === "wait") ? "none" : "";
        }
        if(actionKeyLabelEl){
          if(actionType === "var_set" || actionType === "var_add" || actionType === "var_avg") actionKeyLabelEl.textContent = "VAR";
          else if(actionType === "buzzer") actionKeyLabelEl.textContent = "HZ";
          else if(actionType === "find_buzzer") actionKeyLabelEl.textContent = "—";
          else if(actionType === "notone") actionKeyLabelEl.textContent = "—";
          else if(actionType === "alarm") actionKeyLabelEl.textContent = "제목";
          else actionKeyLabelEl.textContent = "CH";
        }
        const useVarAvg = (actionType === "var_avg");
        const useVarName = (actionType === "var_set" || actionType === "var_add" || useVarAvg);
        const useAlarmTitle = (actionType === "alarm");
        const useBuzzerHz = (actionType === "buzzer");
        const useFindBuzzer = (actionType === "find_buzzer");
        const useNoTone = (actionType === "notone");
        let actionValueMode = "direct";
        if(actionValueModeEl){
          actionValueMode = normalizeMissionVarActionValueMode(actionValueModeEl.value);
          actionValueModeEl.value = actionValueMode;
          actionValueModeEl.style.display = (useVarName && !useVarAvg) ? "" : "none";
        }
        if(actionChannelEl){
          actionChannelEl.style.display = (useVarName || useAlarmTitle || useBuzzerHz || useFindBuzzer || useNoTone) ? "none" : "";
        }
        if(actionVarNameEl){
          actionVarNameEl.style.display = useVarName ? "" : "none";
          if(useVarName){
            actionVarNameEl.value = normalizeMissionVarName(actionVarNameEl.value);
          }
        }
        if(actionTextEl){
          actionTextEl.style.display = useAlarmTitle ? "" : "none";
          if(useAlarmTitle){
            actionTextEl.value = normalizeMissionAlarmTitle(actionTextEl.value);
          }
        }
        if(actionSubLabelEl){
          actionSubLabelEl.style.display = useAlarmTitle ? "" : "none";
        }
        if(actionTextSubEl){
          actionTextSubEl.style.display = useAlarmTitle ? "" : "none";
          if(useAlarmTitle){
            actionTextSubEl.value = normalizeMissionAlarmMessage(actionTextSubEl.value);
          }
        }
        const showRawActionValue = !(useAlarmTitle || useFindBuzzer || useNoTone) && (!useVarName || actionValueMode === "direct" || useVarAvg);
        if(actionValueEl){
          actionValueEl.style.display = showRawActionValue ? "" : "none";
        }
        if(actionSensorEl){
          const showSensor = !!(useVarAvg || (useVarName && actionValueMode === "sensor"));
          actionSensorEl.style.display = showSensor ? "" : "none";
          if(showSensor){
            actionSensorEl.value = normalizeMissionExprSensorType(actionSensorEl.value);
          }
        }
        if(actionUnitEl){
          actionUnitEl.style.display = showRawActionValue ? "" : "none";
        }
        if(actionExprWrapEl){
          actionExprWrapEl.style.display = ((useVarName && !useVarAvg) && actionValueMode === "expr") ? "" : "none";
        }
        if(actionExprLhsTypeEl){
          actionExprLhsTypeEl.value = normalizeMissionExprOperandType(actionExprLhsTypeEl.value);
        }
        if(actionExprRhsTypeEl){
          actionExprRhsTypeEl.value = normalizeMissionExprOperandType(actionExprRhsTypeEl.value);
        }
        if(actionExprOpEl){
          actionExprOpEl.value = normalizeMissionExprOperator(actionExprOpEl.value);
        }
        const lhsOperandType = normalizeMissionExprOperandType((actionExprLhsTypeEl || {}).value);
        const rhsOperandType = normalizeMissionExprOperandType((actionExprRhsTypeEl || {}).value);
        const showLhsVar = !!((useVarName && !useVarAvg) && actionValueMode === "expr" && lhsOperandType === "var");
        const showRhsVar = !!((useVarName && !useVarAvg) && actionValueMode === "expr" && rhsOperandType === "var");
        const showLhsSensor = !!((useVarName && !useVarAvg) && actionValueMode === "expr" && lhsOperandType === "sensor");
        const showRhsSensor = !!((useVarName && !useVarAvg) && actionValueMode === "expr" && rhsOperandType === "sensor");
        if(actionExprLhsValueEl){
          actionExprLhsValueEl.style.display = (showLhsVar || showLhsSensor) ? "none" : "";
          actionExprLhsValueEl.min = "-99999";
          actionExprLhsValueEl.max = "99999";
          actionExprLhsValueEl.step = "1";
          actionExprLhsValueEl.value = String(normalizeMissionExprValue(actionExprLhsValueEl.value, 0));
        }
        if(actionExprRhsValueEl){
          actionExprRhsValueEl.style.display = (showRhsVar || showRhsSensor) ? "none" : "";
          actionExprRhsValueEl.min = "-99999";
          actionExprRhsValueEl.max = "99999";
          actionExprRhsValueEl.step = "1";
          actionExprRhsValueEl.value = String(normalizeMissionExprValue(actionExprRhsValueEl.value, 0));
        }
        if(actionExprLhsVarNameEl){
          actionExprLhsVarNameEl.style.display = showLhsVar ? "" : "none";
          if(showLhsVar){
            actionExprLhsVarNameEl.value = normalizeMissionVarName(actionExprLhsVarNameEl.value);
          }
        }
        if(actionExprLhsSensorEl){
          actionExprLhsSensorEl.style.display = showLhsSensor ? "" : "none";
          if(showLhsSensor){
            actionExprLhsSensorEl.value = normalizeMissionExprSensorType(actionExprLhsSensorEl.value);
          }
        }
        if(actionExprRhsVarNameEl){
          actionExprRhsVarNameEl.style.display = showRhsVar ? "" : "none";
          if(showRhsVar){
            actionExprRhsVarNameEl.value = normalizeMissionVarName(actionExprRhsVarNameEl.value);
          }
        }
        if(actionExprRhsSensorEl){
          actionExprRhsSensorEl.style.display = showRhsSensor ? "" : "none";
          if(showRhsSensor){
            actionExprRhsSensorEl.value = normalizeMissionExprSensorType(actionExprRhsSensorEl.value);
          }
        }
        if(actionChannelEl && actionType !== "wait"){
          const current = Math.max(1, Math.round(toFiniteNumber(actionChannelEl.value, 1)));
          actionChannelEl.innerHTML = "";
          let max = SERVO_CHANNELS.length;
          if(actionType === "pyro") max = PYRO_CHANNELS.length;
          if(actionType === "var_set" || actionType === "var_add" || actionType === "var_avg") max = 8;
          for(let i = 1; i <= max; i++){
            const option = document.createElement("option");
            option.value = String(i);
            option.textContent = actionType === "servo" ? ("PWM" + i) : String(i);
            actionChannelEl.appendChild(option);
          }
          actionChannelEl.value = String(Math.max(1, Math.min(max, current)));
        }
        if(actionValueEl && actionType !== "wait"){
          if(actionType === "pyro"){
            actionValueEl.min = "10";
            actionValueEl.max = "60000";
            actionValueEl.step = "10";
          }else if(actionType === "buzzer"){
            actionValueEl.min = "1";
            actionValueEl.max = "10000";
            actionValueEl.step = "1";
          }else if(actionType === "var_avg"){
            actionValueEl.min = "1";
            actionValueEl.max = String(MISSION_SENSOR_HISTORY_MAX);
            actionValueEl.step = "1";
            actionValueEl.value = String(Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, Math.round(toFiniteNumber(actionValueEl.value, 5)))));
          }else if(actionType === "var_set" || actionType === "var_add"){
            actionValueEl.min = "-99999";
            actionValueEl.max = "99999";
            actionValueEl.step = "1";
          }else{
            actionValueEl.min = "0";
            actionValueEl.max = String(SERVO_MAX_DEG);
            actionValueEl.step = "1";
          }
        }
      }
      if(delaySecEl){
        const sec = Math.max(0, toFiniteNumber(delaySecEl.value, 0));
        delaySecEl.value = formatMissionDelaySec(Math.round(sec * 1000));
      }
    }
    function missionBlockRowHtml(block, index){
      const level = normalizeMissionLevel(block.level);
      const rowType = normalizeMissionRowType(block.rowType);
      const hasLoop = (rowType === "loop");
      const hasCondition = (rowType === "condition" || rowType === "full");
      const hasAction = (rowType === "action" || rowType === "full");
      const triggerType = String(block.when.type || "altitude_gte");
      const triggerValue = Math.round(normalizeMissionTriggerValue(triggerType, block.when.value));
      const triggerPin = Math.max(1, Math.round(toFiniteNumber(block.when.pin, 1)));
      const triggerVarName = missionHtmlEscape(normalizeMissionVarName(block.when.varName));
      const triggerRhsType = normalizeMissionVarWhenRhsType(block.when.rhsType);
      const triggerRhsValue = Math.round(normalizeMissionTriggerValue(triggerType, block.when.rhsValue != null ? block.when.rhsValue : block.when.value));
      const triggerRhsVarName = missionHtmlEscape(normalizeMissionVarName(block.when.rhsVarName));
      const actionType = String(block.then.type || "servo");
      const loopInfo = normalizeMissionLoopObject(block.loop);
      const loopMode = loopInfo.mode;
      const loopCount = Math.max(1, Math.round(toFiniteNumber(loopInfo.count, 3)));
      const actionChannel = Math.max(1, Math.round(toFiniteNumber(block.then.channel, 1)));
      const actionVarName = missionHtmlEscape(normalizeMissionVarName(block.then.varName || block.when.varName));
      const actionTitle = missionHtmlEscape(normalizeMissionAlarmTitle(block.then.title));
      const actionMessage = missionHtmlEscape(normalizeMissionAlarmMessage(block.then.message));
      const actionSensorType = normalizeMissionExprSensorType(block.then.sensor != null ? block.then.sensor : block.then.sensorType);
      let actionValue = 0;
      if(actionType === "pyro"){
        actionValue = Math.max(10, Math.round(toFiniteNumber(block.then.durationMs, 300)));
      }else if(actionType === "buzzer"){
        actionValue = Math.max(1, Math.min(10000, Math.round(toFiniteNumber(block.then.value, 2000))));
      }else if(actionType === "var_avg"){
        actionValue = Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, Math.round(toFiniteNumber(block.then.avgCount != null ? block.then.avgCount : block.then.value, 5))));
      }else if(actionType === "var_set" || actionType === "var_add"){
        actionValue = Math.round(Math.max(-99999, Math.min(99999, toFiniteNumber(block.then.value != null ? block.then.value : block.then.angle, 0))));
      }else if(actionType === "alarm" || actionType === "find_buzzer" || actionType === "notone"){
        actionValue = 0;
      }else{
        actionValue = Math.max(0, Math.min(SERVO_MAX_DEG, Math.round(toFiniteNumber(block.then.angle, 90))));
      }
      const actionExpr = normalizeMissionExprObject(block.then.expr, actionValue, actionChannel);
      let actionValueMode = "direct";
      if((actionType === "var_set" || actionType === "var_add") && actionExpr.enabled){
        const rhsZero = normalizeMissionExprValue(actionExpr.rhsValue, 0) === 0;
        const sensorShortcut = (actionExpr.lhsType === "sensor" && actionExpr.op === "add" && actionExpr.rhsType === "const" && rhsZero);
        actionValueMode = sensorShortcut ? "sensor" : "expr";
      }
      const actionExprLhsVarName = missionHtmlEscape(normalizeMissionVarName(actionExpr.lhsVarName));
      const actionExprRhsVarName = missionHtmlEscape(normalizeMissionVarName(actionExpr.rhsVarName));
      const triggerCmp = normalizeMissionComparator(block.when.cmp, triggerType);
      const delayMs = Math.max(0, Math.round(toFiniteNumber(block.delayMs, 0)));
      const delaySec = formatMissionDelaySec(delayMs);
      const enabledValue = block.enabled !== false ? "1" : "0";
      const onceValue = block.once !== false ? "1" : "0";
      const uiX = normalizeMissionUiCoord(block.uiX);
      const uiY = normalizeMissionUiCoord(block.uiY);
      let html = "" +
        "<div class=\"mission-block-row scratch-stack\" data-block-index=\"" + index + "\" data-level=\"" + level + "\" data-ui-x=\"" + uiX + "\" data-ui-y=\"" + uiY + "\" data-row-type=\"" + rowType + "\" data-action-type=\"" + actionType + "\">";
      if(hasLoop){
        html +=
          "<div class=\"scratch-block scratch-control scratch-control--if\">" +
            "<span class=\"scratch-text scratch-text--if\">반복</span>" +
            "<select class=\"scratch-field scratch-select scratch-input--xs\" data-role=\"loopMode\">" +
              "<option value=\"forever\"" + (loopMode === "forever" ? " selected" : "") + ">무한</option>" +
              "<option value=\"count\"" + (loopMode === "count" ? " selected" : "") + ">횟수</option>" +
            "</select>" +
            "<span class=\"scratch-inline\" data-role=\"loopCountWrap\"" + (loopMode === "count" ? "" : " style=\"display:none\"") + ">" +
              "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"loopCount\" type=\"number\" min=\"1\" max=\"200\" step=\"1\" value=\"" + loopCount + "\">" +
              "<span class=\"scratch-badge\">회</span>" +
            "</span>" +
            "<button class=\"scratch-mini-btn scratch-mini-btn--close\" type=\"button\" data-role=\"remove\" aria-label=\"삭제\">×</button>" +
          "</div>";
      }
      if(hasCondition){
        html +=
          "<div class=\"scratch-block scratch-control scratch-control--if\">" +
            "<span class=\"scratch-text scratch-text--if\">만일</span>" +
            "<select class=\"scratch-field scratch-select scratch-field--if-type\" data-role=\"triggerType\">" +
              "<option value=\"altitude_gte\"" + (triggerType === "altitude_gte" ? " selected" : "") + ">고도</option>" +
              "<option value=\"sequence_start\"" + (triggerType === "sequence_start" ? " selected" : "") + ">시퀀스 시작</option>" +
              "<option value=\"switch_falling\"" + (triggerType === "switch_falling" ? " selected" : "") + ">ARM OFF</option>" +
              "<option value=\"switch_rising\"" + (triggerType === "switch_rising" ? " selected" : "") + ">ARM ON</option>" +
              "<option value=\"time_after_firing_ms\"" + (triggerType === "time_after_firing_ms" ? " selected" : "") + ">점화 후 시간</option>" +
              "<option value=\"gyro_x_deg\"" + (triggerType === "gyro_x_deg" ? " selected" : "") + ">자이로 X 각도</option>" +
              "<option value=\"gyro_y_deg\"" + (triggerType === "gyro_y_deg" ? " selected" : "") + ">자이로 Y 각도</option>" +
              "<option value=\"gyro_z_deg\"" + (triggerType === "gyro_z_deg" ? " selected" : "") + ">자이로 Z 각도</option>" +
              "<option value=\"var_value\"" + (triggerType === "var_value" ? " selected" : "") + ">변수 값</option>" +
              "<option value=\"var_change_count\"" + (triggerType === "var_change_count" ? " selected" : "") + ">변수 변화 횟수</option>" +
            "</select>" +
            "<span class=\"scratch-inline\" data-role=\"triggerKeyWrap\" style=\"display:none\">" +
              "<span class=\"scratch-badge scratch-badge--if-key\" data-role=\"triggerKeyLabel\">IO</span>" +
              "<select class=\"scratch-field scratch-select scratch-input--xs\" data-role=\"triggerPin\">" +
                "<option value=\"" + triggerPin + "\" selected>" + triggerPin + "</option>" +
              "</select>" +
              "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"triggerVarName\" type=\"text\" maxlength=\"24\" placeholder=\"변수명\" value=\"" + triggerVarName + "\" style=\"display:none\">" +
            "</span>" +
            "<span class=\"scratch-badge scratch-badge--if-key\" data-role=\"triggerValueLabel\">값</span>" +
            "<select class=\"scratch-field scratch-select scratch-field--if-op\" data-role=\"triggerOp\">" +
              "<option value=\"eq\"" + (triggerCmp === "eq" ? " selected" : "") + ">==</option>" +
              "<option value=\"gt\"" + (triggerCmp === "gt" ? " selected" : "") + ">&gt;</option>" +
              "<option value=\"lt\"" + (triggerCmp === "lt" ? " selected" : "") + ">&lt;</option>" +
            "</select>" +
            "<span class=\"scratch-inline\" data-role=\"triggerValueWrap\">" +
              "<select class=\"scratch-field scratch-select scratch-input--xs\" data-role=\"triggerValueType\" style=\"display:none\">" +
                "<option value=\"const\"" + (triggerRhsType === "const" ? " selected" : "") + ">값</option>" +
                "<option value=\"var\"" + (triggerRhsType === "var" ? " selected" : "") + ">VAR</option>" +
              "</select>" +
              "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"triggerValue\" type=\"number\" step=\"1\" value=\"" + triggerRhsValue + "\">" +
              "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"triggerValueVarName\" type=\"text\" maxlength=\"24\" placeholder=\"비교 변수\" value=\"" + triggerRhsVarName + "\" style=\"display:none\">" +
            "</span>" +
            "<span class=\"scratch-text\">이라면</span>" +
            (!hasAction ? "<button class=\"scratch-mini-btn scratch-mini-btn--close\" type=\"button\" data-role=\"remove\" aria-label=\"삭제\">×</button>" : "") +
          "</div>";
      }
      if(hasAction){
        html +=
          "<div class=\"scratch-block scratch-action\">" +
            "<span class=\"scratch-inline\" data-role=\"waitWrap\">" +
              "<span class=\"scratch-text\">몇 초 기다리기</span>" +
              "<input class=\"scratch-field scratch-input scratch-input--delay\" data-role=\"delaySec\" type=\"number\" min=\"0\" step=\"0.1\" value=\"" + delaySec + "\">" +
              "<span class=\"scratch-badge scratch-badge--delay\">초</span>" +
            "</span>" +
            "<span class=\"scratch-inline\" data-role=\"actionHeadWrap\">" +
              "<span class=\"scratch-text\">실행</span>" +
            "</span>" +
            "<span class=\"scratch-inline\" data-role=\"actionTypeWrap\">" +
              "<select class=\"scratch-field scratch-select\" data-role=\"actionType\">" +
                "<option value=\"servo\"" + (actionType === "servo" ? " selected" : "") + ">서보 움직이기</option>" +
                "<option value=\"pyro\"" + (actionType === "pyro" ? " selected" : "") + ">파이로 작동</option>" +
                "<option value=\"var_set\"" + (actionType === "var_set" ? " selected" : "") + ">변수 설정</option>" +
                "<option value=\"var_add\"" + (actionType === "var_add" ? " selected" : "") + ">변수 계산</option>" +
                "<option value=\"var_avg\"" + (actionType === "var_avg" ? " selected" : "") + ">센서값 평균</option>" +
                "<option value=\"alarm\"" + (actionType === "alarm" ? " selected" : "") + ">알람 띄우기</option>" +
                "<option value=\"buzzer\"" + (actionType === "buzzer" ? " selected" : "") + ">버저 작동</option>" +
                "<option value=\"find_buzzer\"" + (actionType === "find_buzzer" ? " selected" : "") + ">파인드 버저</option>" +
                "<option value=\"notone\"" + (actionType === "notone" ? " selected" : "") + ">버저 정지</option>" +
                "<option value=\"wait\"" + (actionType === "wait" ? " selected" : "") + ">몇 초 기다리기</option>" +
              "</select>" +
            "</span>" +
            "<span class=\"scratch-inline\" data-role=\"actionConfigWrap\">" +
              "<span class=\"scratch-text\" data-role=\"actionPhrase\">서보</span>" +
              "<span class=\"scratch-text\" data-role=\"actionKeyLabel\">CH</span>" +
              "<select class=\"scratch-field scratch-select scratch-input--xs\" data-role=\"actionChannel\">" +
                "<option value=\"" + actionChannel + "\" selected>" + actionChannel + "</option>" +
              "</select>" +
              "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"actionVarName\" type=\"text\" maxlength=\"24\" placeholder=\"변수명\" value=\"" + actionVarName + "\" style=\"display:none\">" +
              "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"actionText\" type=\"text\" maxlength=\"40\" placeholder=\"알람 제목\" value=\"" + actionTitle + "\" style=\"display:none\">" +
              "<span class=\"scratch-badge\" data-role=\"actionSubLabel\" style=\"display:none\">내용</span>" +
              "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"actionTextSub\" type=\"text\" maxlength=\"120\" placeholder=\"알람 내용\" value=\"" + actionMessage + "\" style=\"display:none\">" +
              "<input class=\"scratch-field scratch-input\" data-role=\"actionValue\" type=\"number\" min=\"0\" step=\"1\" value=\"" + actionValue + "\">" +
              "<select class=\"scratch-field scratch-select scratch-input--xs\" data-role=\"actionValueMode\" style=\"display:none\">" +
                "<option value=\"direct\"" + (actionValueMode === "direct" ? " selected" : "") + ">직접값</option>" +
                "<option value=\"sensor\"" + (actionValueMode === "sensor" ? " selected" : "") + ">센서값</option>" +
                "<option value=\"expr\"" + (actionValueMode === "expr" ? " selected" : "") + ">연산</option>" +
              "</select>" +
              "<select class=\"scratch-field scratch-select\" data-role=\"actionSensor\" style=\"display:none\">" +
                missionExprSensorOptionsHtml(actionType === "var_avg" ? actionSensorType : actionExpr.lhsSensor) +
              "</select>" +
              "<span class=\"scratch-inline\" data-role=\"actionExprWrap\" style=\"display:none\">" +
                "<select class=\"scratch-field scratch-select scratch-input--xs\" data-role=\"actionExprLhsType\">" +
                  "<option value=\"const\"" + (actionExpr.lhsType === "const" ? " selected" : "") + ">값</option>" +
                  "<option value=\"var\"" + (actionExpr.lhsType === "var" ? " selected" : "") + ">VAR</option>" +
                  "<option value=\"sensor\"" + (actionExpr.lhsType === "sensor" ? " selected" : "") + ">센서</option>" +
                "</select>" +
                "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"actionExprLhsValue\" type=\"number\" min=\"-99999\" max=\"99999\" step=\"1\" value=\"" + actionExpr.lhsValue + "\">" +
                "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"actionExprLhsVarName\" type=\"text\" maxlength=\"24\" placeholder=\"좌 변수\" value=\"" + actionExprLhsVarName + "\" style=\"display:none\">" +
                "<select class=\"scratch-field scratch-select\" data-role=\"actionExprLhsSensor\" style=\"display:none\">" +
                  missionExprSensorOptionsHtml(actionExpr.lhsSensor) +
                "</select>" +
                "<select class=\"scratch-field scratch-select scratch-field--if-op\" data-role=\"actionExprOp\">" +
                  "<option value=\"add\"" + (actionExpr.op === "add" ? " selected" : "") + ">+</option>" +
                  "<option value=\"sub\"" + (actionExpr.op === "sub" ? " selected" : "") + ">-</option>" +
                  "<option value=\"mul\"" + (actionExpr.op === "mul" ? " selected" : "") + ">×</option>" +
                  "<option value=\"div\"" + (actionExpr.op === "div" ? " selected" : "") + ">/</option>" +
                "</select>" +
                "<select class=\"scratch-field scratch-select scratch-input--xs\" data-role=\"actionExprRhsType\">" +
                  "<option value=\"const\"" + (actionExpr.rhsType === "const" ? " selected" : "") + ">값</option>" +
                  "<option value=\"var\"" + (actionExpr.rhsType === "var" ? " selected" : "") + ">VAR</option>" +
                  "<option value=\"sensor\"" + (actionExpr.rhsType === "sensor" ? " selected" : "") + ">센서</option>" +
                "</select>" +
                "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"actionExprRhsValue\" type=\"number\" min=\"-99999\" max=\"99999\" step=\"1\" value=\"" + actionExpr.rhsValue + "\">" +
                "<input class=\"scratch-field scratch-input scratch-input--if-value\" data-role=\"actionExprRhsVarName\" type=\"text\" maxlength=\"24\" placeholder=\"우 변수\" value=\"" + actionExprRhsVarName + "\" style=\"display:none\">" +
                "<select class=\"scratch-field scratch-select\" data-role=\"actionExprRhsSensor\" style=\"display:none\">" +
                  missionExprSensorOptionsHtml(actionExpr.rhsSensor) +
                "</select>" +
              "</span>" +
              "<span class=\"scratch-badge\" data-role=\"actionUnit\">deg</span>" +
            "</span>" +
            "<button class=\"scratch-mini-btn scratch-mini-btn--close\" type=\"button\" data-role=\"remove\" aria-label=\"삭제\">×</button>" +
          "</div>";
      }
      html +=
        "<input type=\"hidden\" data-role=\"enabled\" value=\"" + enabledValue + "\">" +
        "<input type=\"hidden\" data-role=\"once\" value=\"" + onceValue + "\">" +
        "<input type=\"hidden\" data-role=\"delayMs\" value=\"" + delayMs + "\">" +
        "<input type=\"hidden\" data-role=\"loopGapMs\" value=\"" + Math.max(0, Math.round(toFiniteNumber(loopInfo.gapMs, 1000))) + "\">";
      html += "</div>";
      return html;
    }
    function readMissionBlockFromRow(row){
      if(!row) return null;
      const level = normalizeMissionLevel(row.getAttribute("data-level"));
      const uiX = normalizeMissionUiCoord(row.getAttribute("data-ui-x"));
      const uiY = normalizeMissionUiCoord(row.getAttribute("data-ui-y"));
      const rowType = normalizeMissionRowType(row.getAttribute("data-row-type"));
      const triggerTypeEl = row.querySelector("[data-role='triggerType']");
      const triggerValueEl = row.querySelector("[data-role='triggerValue']");
      const triggerPinEl = row.querySelector("[data-role='triggerPin']");
      const triggerVarNameEl = row.querySelector("[data-role='triggerVarName']");
      const triggerOpEl = row.querySelector("[data-role='triggerOp']");
      const triggerValueTypeEl = row.querySelector("[data-role='triggerValueType']");
      const triggerValueVarNameEl = row.querySelector("[data-role='triggerValueVarName']");
      const actionTypeEl = row.querySelector("[data-role='actionType']");
      const actionChannelEl = row.querySelector("[data-role='actionChannel']");
      const actionVarNameEl = row.querySelector("[data-role='actionVarName']");
      const actionTextEl = row.querySelector("[data-role='actionText']");
      const actionTextSubEl = row.querySelector("[data-role='actionTextSub']");
      const actionValueEl = row.querySelector("[data-role='actionValue']");
      const actionValueModeEl = row.querySelector("[data-role='actionValueMode']");
      const actionSensorEl = row.querySelector("[data-role='actionSensor']");
      const actionExprLhsTypeEl = row.querySelector("[data-role='actionExprLhsType']");
      const actionExprLhsValueEl = row.querySelector("[data-role='actionExprLhsValue']");
      const actionExprLhsVarNameEl = row.querySelector("[data-role='actionExprLhsVarName']");
      const actionExprLhsSensorEl = row.querySelector("[data-role='actionExprLhsSensor']");
      const actionExprOpEl = row.querySelector("[data-role='actionExprOp']");
      const actionExprRhsTypeEl = row.querySelector("[data-role='actionExprRhsType']");
      const actionExprRhsValueEl = row.querySelector("[data-role='actionExprRhsValue']");
      const actionExprRhsVarNameEl = row.querySelector("[data-role='actionExprRhsVarName']");
      const actionExprRhsSensorEl = row.querySelector("[data-role='actionExprRhsSensor']");
      const delaySecEl = row.querySelector("[data-role='delaySec']");
      const delayMsEl = row.querySelector("[data-role='delayMs']");
      const loopModeEl = row.querySelector("[data-role='loopMode']");
      const loopCountEl = row.querySelector("[data-role='loopCount']");
      const loopGapMsEl = row.querySelector("[data-role='loopGapMs']");
      const enabledEl = row.querySelector("[data-role='enabled']");
      const onceEl = row.querySelector("[data-role='once']");

      const triggerType = String((triggerTypeEl || {}).value || (rowType === "action" ? "time_after_firing_ms" : "altitude_gte"));
      const triggerCmp = normalizeMissionComparator((triggerOpEl || {}).value, triggerType);
      const triggerRawValue = Math.round(normalizeMissionTriggerValue(triggerType, (triggerValueEl || {}).value));
      const triggerRhsType = (triggerType === "var_value")
        ? normalizeMissionVarWhenRhsType((triggerValueTypeEl || {}).value)
        : "const";
      const triggerRhsVarName = (triggerType === "var_value")
        ? normalizeMissionVarName((triggerValueVarNameEl || {}).value)
        : "";
      const triggerValue = (triggerType === "var_value" && triggerRhsType === "var") ? 0 : triggerRawValue;
      const triggerPinRaw = Math.max(1, Math.round(toFiniteNumber((triggerPinEl || {}).value, 1)));
      const triggerPin = (triggerType === "switch_falling" || triggerType === "switch_rising") ? 2 : triggerPinRaw;
      const triggerVarName = normalizeMissionVarName((triggerVarNameEl || {}).value);
      const actionType = String((actionTypeEl || {}).value || "servo");
      const actionChannelRaw = Math.max(1, Math.round(toFiniteNumber((actionChannelEl || {}).value, 1)));
      const actionVarName = normalizeMissionVarName((actionVarNameEl || {}).value);
      const actionTitle = normalizeMissionAlarmTitle((actionTextEl || {}).value);
      const actionMessage = normalizeMissionAlarmMessage((actionTextSubEl || {}).value);
      const actionValueDefault = (actionType === "pyro")
        ? 300
        : ((actionType === "var_set" || actionType === "var_add" || actionType === "alarm" || actionType === "find_buzzer" || actionType === "notone")
            ? 0
            : (actionType === "buzzer" ? 2000 : (actionType === "var_avg" ? 5 : 90)));
      const actionValue = Math.round(toFiniteNumber((actionValueEl || {}).value, actionValueDefault));
      const actionValueMode = normalizeMissionVarActionValueMode((actionValueModeEl || {}).value);
      let actionExprRaw = {
        enabled: false,
        lhsType: "const",
        lhsValue: actionValue,
        lhsVarName: "",
        lhsSensor: "altitude_m",
        lhsChannel: actionChannelRaw,
        op: "add",
        rhsType: "const",
        rhsValue: 0,
        rhsVarName: "",
        rhsSensor: "altitude_m",
        rhsChannel: actionChannelRaw
      };
      if(actionValueMode === "expr"){
        actionExprRaw = {
          enabled: true,
          lhsType: (actionExprLhsTypeEl || {}).value,
          lhsValue: (actionExprLhsValueEl || {}).value,
          lhsVarName: (actionExprLhsVarNameEl || {}).value,
          lhsSensor: (actionExprLhsSensorEl || {}).value,
          lhsChannel: actionChannelRaw,
          op: (actionExprOpEl || {}).value,
          rhsType: (actionExprRhsTypeEl || {}).value,
          rhsValue: (actionExprRhsValueEl || {}).value,
          rhsVarName: (actionExprRhsVarNameEl || {}).value,
          rhsSensor: (actionExprRhsSensorEl || {}).value,
          rhsChannel: actionChannelRaw
        };
      }else if(actionValueMode === "sensor"){
        actionExprRaw = {
          enabled: true,
          lhsType: "sensor",
          lhsValue: 0,
          lhsVarName: "",
          lhsSensor: normalizeMissionExprSensorType((actionSensorEl || {}).value),
          lhsChannel: actionChannelRaw,
          op: "add",
          rhsType: "const",
          rhsValue: 0,
          rhsVarName: "",
          rhsSensor: "altitude_m",
          rhsChannel: actionChannelRaw
        };
      }
      const actionExpr = normalizeMissionExprObject(actionExprRaw, actionValue, actionChannelRaw);
      const delaySec = toFiniteNumber((delaySecEl || {}).value, NaN);
      const parsedDelayMs = Number.isFinite(delaySec)
        ? Math.max(0, Math.round(delaySec * 1000))
        : Math.max(0, Math.round(toFiniteNumber((delayMsEl || {}).value, 0)));
      const delayMs = (actionType === "wait") ? parsedDelayMs : 0;
      const enabled = enabledEl
        ? (enabledEl.type === "checkbox" ? !!enabledEl.checked : String(enabledEl.value || "1") !== "0")
        : true;
      let once = onceEl
        ? (onceEl.type === "checkbox" ? !!onceEl.checked : String(onceEl.value || "1") !== "0")
        : true;
      if(triggerType === "boot") once = true;
      if(rowType === "loop"){
        const loopMode = normalizeMissionLoopMode((loopModeEl || {}).value);
        const loopCount = Math.max(1, Math.min(200, Math.round(toFiniteNumber((loopCountEl || {}).value, 3))));
        const loopGapMs = Math.max(0, Math.min(60000, Math.round(toFiniteNumber((loopGapMsEl || {}).value, 1000))));
        return normalizeMissionBlock({
          level,
          uiX,
          uiY,
          rowType: "loop",
          enabled,
          once,
          delayMs: 0,
          when: {type:"time_after_firing_ms", cmp:"gt", value:0, pin:1},
          then: {type:"wait"},
          loop: {mode:loopMode, count:loopCount, gapMs:loopGapMs}
        });
      }
      const next = {
        level,
        uiX,
        uiY,
        rowType,
        enabled,
        once,
        delayMs,
        when: {
          type: triggerType,
          cmp: triggerCmp,
          value: triggerValue,
          pin: triggerPin,
          varName: (triggerType === "var_value" || triggerType === "var_change_count") ? triggerVarName : "",
          rhsType: (triggerType === "var_value") ? triggerRhsType : "const",
          rhsValue: (triggerType === "var_value") ? triggerRawValue : triggerValue,
          rhsVarName: (triggerType === "var_value") ? triggerRhsVarName : ""
        },
        then: {
          type: actionType,
          channel: actionChannelRaw,
          varName: (actionType === "var_set" || actionType === "var_add" || actionType === "var_avg")
            ? (actionVarName || triggerVarName)
            : "",
          sensor: (actionType === "var_avg")
            ? normalizeMissionExprSensorType((actionSensorEl || {}).value)
            : "altitude_m",
          avgCount: (actionType === "var_avg")
            ? Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, actionValue))
            : 1,
          title: (actionType === "alarm") ? actionTitle : "",
          message: (actionType === "alarm") ? actionMessage : "",
          expr: normalizeMissionExprObject(null, actionValue, actionChannelRaw)
        }
      };
      if(actionType === "pyro"){
        next.then.channel = normalizePyroChannel(actionChannelRaw, 1);
        next.then.durationMs = Math.max(10, actionValue);
      }else if(actionType === "buzzer"){
        next.then.type = "buzzer";
        next.then.channel = 0;
        next.then.value = Math.max(1, Math.min(10000, actionValue));
        next.then.durationMs = 0;
        next.then.angle = 0;
        next.then.varName = "";
        next.then.title = "";
        next.then.message = "";
      }else if(actionType === "find_buzzer"){
        next.then.type = "find_buzzer";
        next.then.channel = 0;
        next.then.value = 0;
        next.then.durationMs = 0;
        next.then.angle = 0;
        next.then.varName = "";
        next.then.sensor = "altitude_m";
        next.then.avgCount = 1;
        next.then.title = "";
        next.then.message = "";
      }else if(actionType === "notone"){
        next.then.type = "notone";
        next.then.channel = 0;
        next.then.value = 0;
        next.then.durationMs = 0;
        next.then.angle = 0;
        next.then.varName = "";
        next.then.sensor = "altitude_m";
        next.then.avgCount = 1;
        next.then.title = "";
        next.then.message = "";
      }else if(actionType === "var_avg"){
        next.then.type = "var_avg";
        next.then.channel = Math.max(1, Math.min(8, actionChannelRaw));
        next.then.value = Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, actionValue));
        next.then.durationMs = 0;
        next.then.angle = 0;
        next.then.varName = actionVarName || triggerVarName;
        next.then.sensor = normalizeMissionExprSensorType((actionSensorEl || {}).value);
        next.then.avgCount = next.then.value;
        next.then.expr = normalizeMissionExprObject(null, 0, 1);
        next.then.title = "";
        next.then.message = "";
      }else if(actionType === "var_set" || actionType === "var_add"){
        next.then.type = actionType;
        next.then.channel = Math.max(1, Math.min(8, actionChannelRaw));
        next.then.value = Math.max(-99999, Math.min(99999, actionValue));
        next.then.durationMs = 0;
        next.then.angle = 0;
        next.then.varName = actionVarName || triggerVarName;
        next.then.expr = normalizeMissionExprObject(actionExpr, next.then.value, next.then.channel);
        if(next.then.expr.enabled){
          if(next.then.expr.lhsType === "var" && !next.then.expr.lhsVarName){
            next.then.expr.lhsVarName = next.then.varName || "";
          }
          if(next.then.expr.rhsType === "var" && !next.then.expr.rhsVarName){
            next.then.expr.rhsVarName = next.then.varName || "";
          }
        }
        next.then.title = "";
        next.then.message = "";
      }else if(actionType === "alarm"){
        next.then.type = "alarm";
        next.then.channel = 0;
        next.then.value = 0;
        next.then.durationMs = 0;
        next.then.angle = 0;
        next.then.varName = "";
        next.then.sensor = "altitude_m";
        next.then.avgCount = 1;
        next.then.title = actionTitle;
        next.then.message = actionMessage;
      }else if(actionType === "wait"){
        next.then.type = "wait";
        next.then.channel = 0;
        next.then.durationMs = 0;
        next.then.angle = 0;
        next.then.value = 0;
        next.then.sensor = "altitude_m";
        next.then.avgCount = 1;
        next.then.message = "";
      }else{
        next.then.type = "servo";
        next.then.channel = Math.max(1, Math.min(SERVO_CHANNELS.length, actionChannelRaw));
        next.then.angle = Math.max(0, Math.min(SERVO_MAX_DEG, actionValue));
        next.then.value = next.then.angle;
        next.then.sensor = "altitude_m";
        next.then.avgCount = 1;
        next.then.message = "";
      }
      return normalizeMissionBlock(next);
    }
    function buildMissionBlocksFromUi(){
      if(!el.missionBlockList) return normalizeMissionBlocks(missionBlocksState);
      const rows = Array.from(el.missionBlockList.querySelectorAll(".mission-block-row"));
      return rows.map((row)=>readMissionBlockFromRow(row)).filter(Boolean);
    }
    function isMissionPaletteKind(kind){
      const k = String(kind || "");
      return k === "servo" || k === "pyro" || k === "time_servo" ||
        k === "time_pyro" || k === "switch_servo" || k === "altitude_pyro" ||
        k === "switch_pyro" || k === "altitude_servo_high" ||
        k === "cond_sequence_start" || k === "cond_altitude" || k === "cond_start_arm_off" || k === "cond_switch_falling" ||
        k === "cond_switch_rising" || k === "cond_time_after_firing" || k === "cond_gyro_angle" || k === "cond_variable" || k === "cond_var_change_count" ||
        k === "act_wait" || k === "act_servo" || k === "act_servo_high" || k === "act_pyro" || k === "act_var_set" || k === "act_var_add" || k === "act_var_avg" || k === "act_alarm" ||
        k === "act_buzzer" || k === "act_find_buzzer" || k === "act_notone" ||
        k === "loop_forever" || k === "loop_count";
    }
    function missionPaletteKindFromTransfer(ev){
      const raw = ev && ev.dataTransfer ? String(ev.dataTransfer.getData("text/x-mission-palette-kind") || "") : "";
      if(isMissionPaletteKind(raw)) return raw;
      return "";
    }
    function missionDragIndexFromTransfer(ev){
      const raw = ev && ev.dataTransfer
        ? String(ev.dataTransfer.getData("text/x-mission-block-index") || ev.dataTransfer.getData("text/plain") || "")
        : "";
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    }
    function missionPaletteKindIsAction(kind){
      const k = String(kind || "");
      return k === "act_wait" || k === "act_servo" || k === "act_servo_high" || k === "act_pyro" || k === "act_var_set" || k === "act_var_add" || k === "act_var_avg" || k === "act_alarm" ||
        k === "act_buzzer" || k === "act_find_buzzer" || k === "act_notone";
    }
    function missionPaletteKindIsCondition(kind){
      const k = String(kind || "");
      return k === "cond_sequence_start" || k === "cond_altitude" || k === "cond_start_arm_off" || k === "cond_switch_falling" ||
        k === "cond_switch_rising" || k === "cond_time_after_firing" || k === "cond_gyro_angle" || k === "cond_variable" || k === "cond_var_change_count";
    }
    function missionPaletteKindIsLoop(kind){
      const k = String(kind || "");
      return k === "loop_forever" || k === "loop_count";
    }
    function missionDragRowTypeFromIndex(idx){
      if(idx == null || idx < 0) return "";
      if(el.missionBlockList){
        const row = el.missionBlockList.querySelector(".mission-block-row[data-block-index=\"" + idx + "\"]");
        if(row) return normalizeMissionRowType(row.getAttribute("data-row-type"));
      }
      const current = normalizeMissionBlocks(missionBlocksState);
      if(idx >= current.length) return "";
      return normalizeMissionRowType(current[idx].rowType);
    }
    function missionRowLevelFromIndex(idx){
      if(idx == null || idx < 0) return 0;
      if(el.missionBlockList){
        const row = el.missionBlockList.querySelector(".mission-block-row[data-block-index=\"" + idx + "\"]");
        if(row) return normalizeMissionLevel(row.getAttribute("data-level"));
      }
      const current = normalizeMissionBlocks(missionBlocksState);
      if(idx >= current.length) return 0;
      return normalizeMissionLevel(current[idx].level);
    }
    function missionCanSnapToBranchFromEvent(ev){
      const paletteKind = missionPaletteKindFromTransfer(ev);
      if(paletteKind){
        return missionPaletteKindIsAction(paletteKind) || missionPaletteKindIsCondition(paletteKind) || missionPaletteKindIsLoop(paletteKind);
      }
      const dragIdx = missionDragIndexFromTransfer(ev);
      const rowType = missionDragRowTypeFromIndex(dragIdx);
      return rowType === "action" || rowType === "condition" || rowType === "loop";
    }
    function missionNearestBranchFromPoint(clientX, clientY){
      if(!el.missionBlockList) return null;
      if(!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      const branches = Array.from(el.missionBlockList.querySelectorAll(".mission-if-branch"));
      if(!branches.length) return null;
      const snapUpPx = 92;
      const snapDownPx = 560;
      const snapSidePx = 520;
      let bestNode = null;
      let bestDist = Infinity;
      let bestLevel = -1;
      let bestArea = Infinity;
      const insideCandidates = [];
      branches.forEach((branch)=>{
        const rect = branch.getBoundingClientRect();
        if(clientY < (rect.top - snapUpPx) || clientY > (rect.bottom + snapDownPx)) return;
        if(clientX < (rect.left - snapSidePx) || clientX > (rect.right + snapSidePx)) return;
        const level = normalizeMissionLevel(branch.getAttribute("data-level"));
        const area = Math.max(1, rect.width * rect.height);
        const insideStrict = (
          clientX >= (rect.left - 24) &&
          clientX <= (rect.right + 24) &&
          clientY >= (rect.top - 14) &&
          clientY <= (rect.bottom + 24)
        );
        if(insideStrict){
          insideCandidates.push({branch, rect, level, area});
        }
        const xGap = clientX < rect.left ? (rect.left - clientX) : (clientX > rect.right ? (clientX - rect.right) : 0);
        const yGapTop = clientY < rect.top ? (rect.top - clientY) : 0;
        const yGapBottom = clientY > rect.bottom ? (clientY - rect.bottom) : 0;
        // Above header is stricter, below branch is looser so "lower drop" still snaps.
        const dist = (xGap * 0.34) + (yGapTop * 0.95) + (yGapBottom * 0.42);
        const distEqual = Math.abs(dist - bestDist) <= 1e-3;
        const betterByDepth = distEqual && level > bestLevel;
        const betterByArea = distEqual && level === bestLevel && area < bestArea;
        if(dist < bestDist || betterByDepth || betterByArea){
          bestDist = dist;
          bestNode = branch;
          bestLevel = level;
          bestArea = area;
        }
      });
      if(insideCandidates.length){
        insideCandidates.sort((a, b)=>{
          if(b.level !== a.level) return b.level - a.level;
          if(a.area !== b.area) return a.area - b.area;
          const acx = a.rect.left + (a.rect.width * 0.5);
          const bcx = b.rect.left + (b.rect.width * 0.5);
          return Math.abs(acx - clientX) - Math.abs(bcx - clientX);
        });
        return insideCandidates[0].branch;
      }
      return bestNode;
    }
    function missionResolveBranchDropTarget(ev, allowNearby){
      const direct = ev.target && ev.target.closest ? ev.target.closest(".mission-if-branch") : null;
      if(!allowNearby) return direct;
      const x = Number(ev && ev.clientX);
      const y = Number(ev && ev.clientY);
      const nearby = missionNearestBranchFromPoint(x, y);
      if(!nearby) return direct;
      if(!direct) return nearby;
      const directLv = normalizeMissionLevel(direct.getAttribute("data-level"));
      const nearLv = normalizeMissionLevel(nearby.getAttribute("data-level"));
      return (nearLv >= directLv) ? nearby : direct;
    }
    function missionBranchIsSelfTarget(branchEl, rowIndex){
      if(!branchEl || !Number.isFinite(rowIndex)) return false;
      const condIdx = parseInt(String(branchEl.getAttribute("data-cond-index") || ""), 10);
      return Number.isFinite(condIdx) && condIdx === rowIndex;
    }
    function missionSetBranchDropActive(branchEl){
      clearMissionBranchDropActive();
      if(branchEl) branchEl.classList.add("drop-active");
    }
    function missionBranchInsertIndexFromTarget(branchEl, currentLength){
      if(!branchEl) return Math.max(0, currentLength);
      const condIdx = parseInt(String(branchEl.getAttribute("data-cond-index") || ""), 10);
      const rows = Array.from(branchEl.querySelectorAll(".mission-block-row"));
      if(rows.length){
        const lastIdx = parseInt(String(rows[rows.length - 1].getAttribute("data-block-index") || ""), 10);
        if(Number.isFinite(lastIdx)) return Math.max(0, Math.min(currentLength, lastIdx + 1));
      }
      if(Number.isFinite(condIdx)) return Math.max(0, Math.min(currentLength, condIdx + 1));
      return Math.max(0, currentLength);
    }
    function missionSubtreeEndIndex(blocks, startIdx){
      const list = Array.isArray(blocks) ? blocks : [];
      if(!Number.isFinite(startIdx) || startIdx < 0 || startIdx >= list.length) return startIdx;
      const baseLevel = normalizeMissionLevel((list[startIdx] || {}).level);
      let end = startIdx;
      for(let i = startIdx + 1; i < list.length; i++){
        const lv = normalizeMissionLevel((list[i] || {}).level);
        if(lv <= baseLevel) break;
        end = i;
      }
      return end;
    }
    function missionIndexInSubtree(blocks, rootIdx, probeIdx){
      if(!Number.isFinite(rootIdx) || !Number.isFinite(probeIdx)) return false;
      const end = missionSubtreeEndIndex(blocks, rootIdx);
      return probeIdx > rootIdx && probeIdx <= end;
    }
    function missionLinearDropPlacement(current, ev){
      if(!el.missionBlockList) return null;
      const list = normalizeMissionBlocks(current);
      if(!list.length) return {targetIdx:0, insertLevel:0};
      const rows = Array.from(el.missionBlockList.querySelectorAll(".mission-block-row"));
      if(!rows.length) return {targetIdx:list.length, insertLevel:0};

      const y = Number(ev && ev.clientY);
      const x = Number(ev && ev.clientX);
      if(!Number.isFinite(y) || !Number.isFinite(x)){
        return {targetIdx:list.length, insertLevel:0};
      }
      let pickRow = rows[0];
      let best = Infinity;
      rows.forEach((row)=>{
        const r = row.getBoundingClientRect();
        const cx = r.left + (r.width * 0.5);
        const cy = r.top + (r.height * 0.5);
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        const score = dy + (dx * 0.08);
        if(score < best){
          best = score;
          pickRow = row;
        }
      });
      if(!pickRow) return {targetIdx:list.length, insertLevel:0};
      const idx = parseInt(String(pickRow.getAttribute("data-block-index") || ""), 10);
      if(!Number.isFinite(idx) || idx < 0 || idx >= list.length){
        return {targetIdx:list.length, insertLevel:0};
      }
      const rect = pickRow.getBoundingClientRect();
      const yInRow = y - rect.top;
      const placeAfter = yInRow >= (rect.height * 0.5);
      const targetRow = normalizeMissionBlock(list[idx] || {});
      const canNestHere = (normalizeMissionRowType(targetRow.rowType) === "condition" || normalizeMissionRowType(targetRow.rowType) === "loop");
      const placeInside = canNestHere && yInRow >= (rect.height * 0.62);
      let targetIdx = idx + (placeAfter ? 1 : 0);
      let insertLevel = normalizeMissionLevel(targetRow.level);
      if(placeInside){
        targetIdx = idx + 1;
        insertLevel = normalizeMissionLevel(targetRow.level + 1);
      }
      return {targetIdx, insertLevel};
    }
    function missionMoveSubtreeToIndex(blocks, fromIdx, targetIdx, opts){
      const list = normalizeMissionBlocks(blocks);
      if(!Number.isFinite(fromIdx) || fromIdx < 0 || fromIdx >= list.length){
        return {list, moved:false, targetIdx:0};
      }
      const end = missionSubtreeEndIndex(list, fromIdx);
      const len = Math.max(1, (end - fromIdx + 1));
      let toIdx = Math.max(0, Math.min(list.length, Math.round(toFiniteNumber(targetIdx, list.length))));
      const chunk = list.slice(fromIdx, fromIdx + len);
      const next = list.slice(0, fromIdx).concat(list.slice(fromIdx + len));
      if(fromIdx < toIdx) toIdx -= len;
      toIdx = Math.max(0, Math.min(next.length, toIdx));

      const options = (opts && typeof opts === "object") ? opts : {};
      if(Number.isFinite(options.baseLevel) && chunk.length){
        const baseBefore = normalizeMissionLevel((chunk[0] || {}).level);
        const baseAfter = normalizeMissionLevel(options.baseLevel);
        const delta = baseAfter - baseBefore;
        for(let i = 0; i < chunk.length; i++){
          const b = chunk[i];
          b.level = normalizeMissionLevel(normalizeMissionLevel(b.level) + delta);
        }
      }
      if(options.resetUi){
        for(let i = 0; i < chunk.length; i++){
          chunk[i].uiX = 0;
          chunk[i].uiY = 0;
        }
      }
      next.splice(toIdx, 0, ...chunk);
      return {list:next, moved:true, targetIdx:toIdx};
    }
    function clearMissionBranchDropActive(){
      if(!el.missionBlockList) return;
      const nodes = el.missionBlockList.querySelectorAll(".mission-if-branch.drop-active");
      nodes.forEach((node)=>node.classList.remove("drop-active"));
    }
    function applyMissionRowUiPosition(row, x, y){
      if(!row) return;
      const rowLevel = normalizeMissionLevel(row.getAttribute("data-level"));
      const movingNow = row.classList && row.classList.contains("is-free-moving");
      let nx = normalizeMissionUiCoord(x);
      let ny = normalizeMissionUiCoord(y);
      if(rowLevel > 0 && !movingNow){
        nx = 0;
        ny = 0;
      }
      row.setAttribute("data-ui-x", String(nx));
      row.setAttribute("data-ui-y", String(ny));
      const moveTarget = missionMoveTargetForRow(row);
      if(moveTarget !== row){
        row.style.transform = "";
      }
      moveTarget.style.transform = "translate(" + nx + "px, " + ny + "px)";
    }
    function missionMoveTargetForRow(row){
      if(!row || !row.closest) return row;
      const rowType = normalizeMissionRowType(row.getAttribute("data-row-type"));
      if(rowType === "condition" || rowType === "loop"){
        const group = row.closest(".mission-if-group");
        if(group) return group;
      }
      return row;
    }
    function bindMissionBlockRowFreeMove(row){
      if(!row || row.dataset.freeMoveBound === "1") return;
      row.dataset.freeMoveBound = "1";

      const findAttachBranch = (excludeBranch, px, py)=>{
        if(!el.missionBlockList) return null;
        let branch = missionNearestBranchFromPoint(px, py);
        if(branch && excludeBranch && branch === excludeBranch){
          branch = null;
        }
        if(branch) return branch;
        const moveTarget = missionMoveTargetForRow(row);
        if(!moveTarget || !moveTarget.getBoundingClientRect) return null;
        const t = moveTarget.getBoundingClientRect();
        const cx = t.left + (t.width * 0.5);
        const cy = t.top + (t.height * 0.5);
        branch = missionNearestBranchFromPoint(cx, cy);
        if(branch && excludeBranch && branch === excludeBranch) return null;
        return branch;
      };

      const shouldDetachFromBranch = ()=>{
        const level = normalizeMissionLevel(row.getAttribute("data-level"));
        if(level <= 0) return false;
        const branch = row.closest ? row.closest(".mission-if-branch") : null;
        if(!branch) return false;
        const moveTarget = missionMoveTargetForRow(row);
        if(!moveTarget || !moveTarget.getBoundingClientRect) return false;
        const b = branch.getBoundingClientRect();
        const t = moveTarget.getBoundingClientRect();
        const cx = t.left + (t.width * 0.5);
        const cy = t.top + (t.height * 0.5);
        const margin = 32;
        const inside = (
          cx >= (b.left - margin) &&
          cx <= (b.right + margin) &&
          cy >= (b.top - margin) &&
          cy <= (b.bottom + margin)
        );
        return !inside;
      };
      const resolveAttachBranchPreview = (px, py)=>{
        const candidate = findAttachBranch(null, px, py);
        if(!candidate) return null;
        const rowIndex = parseInt(String(row.getAttribute("data-block-index") || ""), 10);
        if(missionBranchIsSelfTarget(candidate, rowIndex)) return null;
        missionSetBranchDropActive(candidate);
        return candidate;
      };

      const stopMove = (ev)=>{
        const state = row._freeMoveState;
        if(!state) return;
        if(ev && state.pointerId != null && ev.pointerId != null && state.pointerId !== ev.pointerId) return;
        const currentBranch = row.closest ? row.closest(".mission-if-branch") : null;
        const attachBranch = resolveAttachBranchPreview(state.lastClientX, state.lastClientY);
        const rowIndex = parseInt(String(row.getAttribute("data-block-index") || ""), 10);
        const sameBranch = !!(attachBranch && currentBranch && attachBranch === currentBranch);
        const canAttach = !!(attachBranch && !sameBranch && !missionBranchIsSelfTarget(attachBranch, rowIndex));
        const curX = normalizeMissionUiCoord(row.getAttribute("data-ui-x"));
        const curY = normalizeMissionUiCoord(row.getAttribute("data-ui-y"));
        const movedDist = Math.hypot(curX - toFiniteNumber(state.uiX, 0), curY - toFiniteNumber(state.uiY, 0));
        const startedNested = normalizeMissionLevel(state.levelBefore) > 0;
        const otherBranch = findAttachBranch(currentBranch, state.lastClientX, state.lastClientY);
        const shouldForceDetach = startedNested && !otherBranch && movedDist >= 24;
        if(canAttach){
          const parentCondIdx = parseInt(String(attachBranch.getAttribute("data-cond-index") || ""), 10);
          const nestedLevel = normalizeMissionLevel(missionRowLevelFromIndex(parentCondIdx) + 1);
          row.setAttribute("data-level", String(nestedLevel));
          row.setAttribute("data-ui-x", "0");
          row.setAttribute("data-ui-y", "0");
        }else{
          const detached = shouldForceDetach || shouldDetachFromBranch();
          if(detached){
            row.setAttribute("data-level", "0");
          }else if(startedNested){
            row.setAttribute("data-ui-x", "0");
            row.setAttribute("data-ui-y", "0");
          }
        }
        row._freeMoveState = null;
        row.classList.remove("is-free-moving");
        if(ev && row.releasePointerCapture){
          try{ row.releasePointerCapture(ev.pointerId); }catch(_err){}
        }
        clearMissionBranchDropActive();
        missionBlocksState = buildMissionBlocksFromUi();
        {
          // If a condition/loop parent changes nesting level via free-move,
          // keep its subtree relative depth so child blocks do not spill out.
          const fromIdx = parseInt(String(row.getAttribute("data-block-index") || ""), 10);
          const rowTypeNow = normalizeMissionRowType(row.getAttribute("data-row-type"));
          const beforeLevel = normalizeMissionLevel(state && state.levelBefore != null ? state.levelBefore : 0);
          const afterLevel = normalizeMissionLevel(row.getAttribute("data-level"));
          if(
            Number.isFinite(fromIdx) &&
            fromIdx >= 0 &&
            fromIdx < missionBlocksState.length &&
            (rowTypeNow === "condition" || rowTypeNow === "loop") &&
            beforeLevel !== afterLevel
          ){
            let end = fromIdx;
            for(let i = fromIdx + 1; i < missionBlocksState.length; i++){
              const lv = normalizeMissionLevel((missionBlocksState[i] || {}).level);
              if(lv <= beforeLevel) break;
              end = i;
            }
            const delta = afterLevel - beforeLevel;
            if(delta !== 0 && end > fromIdx){
              for(let i = fromIdx + 1; i <= end; i++){
                missionBlocksState[i].level = normalizeMissionLevel(
                  normalizeMissionLevel((missionBlocksState[i] || {}).level) + delta
                );
              }
            }
          }
        }

        if(canAttach){
          const fromIdx = parseInt(String(row.getAttribute("data-block-index") || ""), 10);
          const current = normalizeMissionBlocks(missionBlocksState);
          if(Number.isFinite(fromIdx) && fromIdx >= 0 && fromIdx < current.length){
            const parentCondIdx = parseInt(String(attachBranch.getAttribute("data-cond-index") || ""), 10);
            if(missionIndexInSubtree(current, fromIdx, parentCondIdx)){
              renderMissionBlocksEditor(missionBlocksState);
              return;
            }
            const nestedLevel = normalizeMissionLevel(missionRowLevelFromIndex(parentCondIdx) + 1);
            const targetIdx = missionBranchInsertIndexFromTarget(attachBranch, current.length);
            const moved = missionMoveSubtreeToIndex(current, fromIdx, targetIdx, {baseLevel:nestedLevel, resetUi:true});
            missionBlocksState = moved.list;
          }
          renderMissionBlocksEditor(missionBlocksState);
          return;
        }

        const detached = normalizeMissionLevel(row.getAttribute("data-level")) === 0 &&
          normalizeMissionLevel(state && state.levelBefore != null ? state.levelBefore : 0) > 0;
        const nestedSnap = !detached && !canAttach && startedNested;
        if(detached || nestedSnap){
          renderMissionBlocksEditor(missionBlocksState);
        }
      };

      row.addEventListener("pointerdown",(ev)=>{
        if(!isMissionEditableNow()) return;
        if(ev.button !== 0) return;
        // Desktop mouse uses native HTML5 DnD for stable reordering.
        // Touch/pen keeps free-move so mobile/tablet can still reposition.
        if(ev.pointerType === "mouse" && row.draggable) return;
        if(ev.target && ev.target.closest){
          const interactive = ev.target.closest("input, select, button");
          if(interactive) return;
        }
        const startX = normalizeMissionUiCoord(row.getAttribute("data-ui-x"));
        const startY = normalizeMissionUiCoord(row.getAttribute("data-ui-y"));
        row._freeMoveState = {
          pointerId: ev.pointerId,
          clientX: ev.clientX,
          clientY: ev.clientY,
          lastClientX: ev.clientX,
          lastClientY: ev.clientY,
          uiX: startX,
          uiY: startY,
          levelBefore: normalizeMissionLevel(row.getAttribute("data-level"))
        };
        row.classList.add("is-free-moving");
        if(row.setPointerCapture){
          try{ row.setPointerCapture(ev.pointerId); }catch(_err){}
        }
        clearMissionBranchDropActive();
        ev.preventDefault();
      });
      row.addEventListener("pointermove",(ev)=>{
        const state = row._freeMoveState;
        if(!state || state.pointerId !== ev.pointerId) return;
        const dx = ev.clientX - state.clientX;
        const dy = ev.clientY - state.clientY;
        state.lastClientX = ev.clientX;
        state.lastClientY = ev.clientY;
        const z = clampMissionCanvasZoom(missionCanvasZoom);
        applyMissionRowUiPosition(row, state.uiX + (dx / z), state.uiY + (dy / z));
        resolveAttachBranchPreview(ev.clientX, ev.clientY);
      });
      row.addEventListener("pointerup", stopMove);
      row.addEventListener("pointercancel", stopMove);
      row.addEventListener("lostpointercapture", ()=>{
        stopMove(null);
        clearMissionBranchDropActive();
      });
    }
    function clampMissionCanvasZoom(raw){
      const n = Number(raw);
      if(!Number.isFinite(n)) return 1;
      return Math.max(MISSION_CANVAS_ZOOM_MIN, Math.min(MISSION_CANVAS_ZOOM_MAX, n));
    }
    function missionStageEl(){
      if(!el.missionBlockList) return null;
      let stage = el.missionBlockStage;
      if(stage && stage.parentElement === el.missionBlockList) return stage;
      const byId = document.getElementById("missionBlockStage");
      if(byId && byId.parentElement === el.missionBlockList){
        el.missionBlockStage = byId;
        return byId;
      }
      stage = el.missionBlockList.querySelector(".mission-block-stage");
      if(!stage){
        stage = document.createElement("div");
        stage.id = "missionBlockStage";
        stage.className = "mission-block-stage";
        while(el.missionBlockList.firstChild){
          stage.appendChild(el.missionBlockList.firstChild);
        }
        el.missionBlockList.appendChild(stage);
      }
      el.missionBlockStage = stage;
      return stage;
    }
    function applyMissionCanvasZoom(nextZoom, anchor){
      if(!el.missionBlockList) return;
      const list = el.missionBlockList;
      const stage = missionStageEl();
      if(!stage) return;
      const prev = clampMissionCanvasZoom(missionCanvasZoom);
      const next = clampMissionCanvasZoom(nextZoom);
      let anchorX = null;
      let anchorY = null;
      let anchorContentX = null;
      let anchorContentY = null;
      if(anchor && Number.isFinite(anchor.clientX) && Number.isFinite(anchor.clientY)){
        const rect = list.getBoundingClientRect();
        anchorX = anchor.clientX - rect.left;
        anchorY = anchor.clientY - rect.top;
        if(Number.isFinite(anchorX) && Number.isFinite(anchorY)){
          anchorContentX = (list.scrollLeft + anchorX) / prev;
          anchorContentY = (list.scrollTop + anchorY) / prev;
        }
      }
      missionCanvasZoom = next;
      if(list.style.zoom) list.style.zoom = "";
      stage.style.zoom = String(next);
      if(anchorContentX != null && anchorContentY != null && anchorX != null && anchorY != null){
        list.scrollLeft = Math.max(0, Math.round(anchorContentX * next - anchorX));
        list.scrollTop = Math.max(0, Math.round(anchorContentY * next - anchorY));
      }
      if(el.missionCanvasZoomReset){
        el.missionCanvasZoomReset.textContent = String(Math.round(next * 100)) + "%";
      }
    }
    function bindMissionCanvasInteractions(){
      if(!el.missionBlockList || el.missionBlockList.dataset.canvasBound === "1") return;
      const list = el.missionBlockList;
      list.dataset.canvasBound = "1";
      applyMissionCanvasZoom(missionCanvasZoom);

      if(el.missionCanvasZoomOut){
        el.missionCanvasZoomOut.addEventListener("click",()=>{
          applyMissionCanvasZoom(missionCanvasZoom - MISSION_CANVAS_ZOOM_STEP);
        });
      }
      if(el.missionCanvasZoomIn){
        el.missionCanvasZoomIn.addEventListener("click",()=>{
          applyMissionCanvasZoom(missionCanvasZoom + MISSION_CANVAS_ZOOM_STEP);
        });
      }
      if(el.missionCanvasZoomReset){
        el.missionCanvasZoomReset.addEventListener("click",()=>{
          applyMissionCanvasZoom(1);
        });
      }

      list.addEventListener("wheel",(ev)=>{
        if(!(ev.ctrlKey || ev.metaKey)) return;
        ev.preventDefault();
        const factor = ev.deltaY < 0 ? 1.08 : (1 / 1.08);
        applyMissionCanvasZoom(missionCanvasZoom * factor, {clientX:ev.clientX, clientY:ev.clientY});
      }, {passive:false});

      const stopPan = (ev)=>{
        const pan = missionCanvasPanState;
        if(!pan) return;
        if(ev && pan.pointerId != null && ev.pointerId != null && pan.pointerId !== ev.pointerId) return;
        missionCanvasPanState = null;
        list.classList.remove("is-panning");
        if(ev && list.releasePointerCapture){
          try{ list.releasePointerCapture(ev.pointerId); }catch(_err){}
        }
      };

      list.addEventListener("pointerdown",(ev)=>{
        if(ev.button !== 0) return;
        if(ev.target && ev.target.closest){
          const interactive = ev.target.closest("input, select, button, .mission-block-row");
          if(interactive) return;
        }
        missionCanvasPanState = {
          pointerId: ev.pointerId,
          startX: ev.clientX,
          startY: ev.clientY,
          startLeft: list.scrollLeft,
          startTop: list.scrollTop
        };
        list.classList.add("is-panning");
        if(list.setPointerCapture){
          try{ list.setPointerCapture(ev.pointerId); }catch(_err){}
        }
      });
      list.addEventListener("pointermove",(ev)=>{
        const pan = missionCanvasPanState;
        if(!pan || pan.pointerId !== ev.pointerId) return;
        const dx = ev.clientX - pan.startX;
        const dy = ev.clientY - pan.startY;
        list.scrollLeft = pan.startLeft - dx;
        list.scrollTop = pan.startTop - dy;
      });
      list.addEventListener("pointerup", stopPan);
      list.addEventListener("pointercancel", stopPan);
      list.addEventListener("lostpointercapture", ()=>stopPan(null));
    }
    function bindMissionBlockListDropZone(){
      if(!el.missionBlockList || el.missionBlockList.dataset.dndBound === "1") return;
      el.missionBlockList.dataset.dndBound = "1";
      const list = el.missionBlockList;
      el.missionBlockList.addEventListener("dragover",(ev)=>{
        if(!isMissionEditableNow()) return;
        const paletteKind = missionPaletteKindFromTransfer(ev);
        const idx = missionDragIndexFromTransfer(ev);
        if(!paletteKind && idx == null) return;
        missionUpdateDragAutoScroll(ev.clientY);
        const rowTarget = ev.target && ev.target.closest ? ev.target.closest(".mission-block-row") : null;
        const branchTarget = missionResolveBranchDropTarget(ev, missionCanSnapToBranchFromEvent(ev) && !rowTarget);
        missionSetBranchDropActive(branchTarget);
        if(rowTarget && !branchTarget) return;
        ev.preventDefault();
        if(el.missionBlockCanvas) el.missionBlockCanvas.classList.add("drop-active");
      });
      el.missionBlockList.addEventListener("dragleave",(ev)=>{
        clearMissionBranchDropActive();
        if(!el.missionBlockCanvas) return;
        const related = ev.relatedTarget;
        if(related && list.contains(related)) return;
        stopMissionDragAutoScroll();
        el.missionBlockCanvas.classList.remove("drop-active");
      });
      el.missionBlockList.addEventListener("drop",(ev)=>{
        if(!isMissionEditableNow()) return;
        stopMissionDragAutoScroll();
        const rowTarget = ev.target && ev.target.closest ? ev.target.closest(".mission-block-row") : null;
        const branchTarget = missionResolveBranchDropTarget(ev, missionCanSnapToBranchFromEvent(ev) && !rowTarget);
        if(branchTarget){
          ev.preventDefault();
          ev.stopPropagation();
          clearMissionBranchDropActive();
          if(el.missionBlockCanvas) el.missionBlockCanvas.classList.remove("drop-active");
          const current = buildMissionBlocksFromUi();
          const parentCondIdx = parseInt(String(branchTarget.getAttribute("data-cond-index") || ""), 10);
          const nestedLevel = normalizeMissionLevel(missionRowLevelFromIndex(parentCondIdx) + 1);
          let targetIdx = missionBranchInsertIndexFromTarget(branchTarget, current.length);
          const paletteKind = missionPaletteKindFromTransfer(ev);
          if(paletteKind){
            const inserted = missionBlockTemplate(paletteKind);
            inserted.level = nestedLevel;
            current.splice(targetIdx, 0, inserted);
            missionBlocksState = current;
            renderMissionBlocksEditor(current);
            return;
          }
          const fromIdx = missionDragIndexFromTransfer(ev);
          if(fromIdx == null || fromIdx < 0 || fromIdx >= current.length) return;
          if(missionIndexInSubtree(current, fromIdx, parentCondIdx)) return;
          const moved = missionMoveSubtreeToIndex(current, fromIdx, targetIdx, {baseLevel:nestedLevel, resetUi:true});
          missionBlocksState = moved.list;
          renderMissionBlocksEditor(missionBlocksState);
          return;
        }
        if(rowTarget) return;
        ev.preventDefault();
        ev.stopPropagation();
        clearMissionBranchDropActive();
        if(el.missionBlockCanvas) el.missionBlockCanvas.classList.remove("drop-active");
        const current = buildMissionBlocksFromUi();
        const paletteKind = missionPaletteKindFromTransfer(ev);
        if(paletteKind){
          const place = missionLinearDropPlacement(current, ev);
          const targetIdx = place ? Math.max(0, Math.min(current.length, place.targetIdx)) : current.length;
          const inserted = missionBlockTemplate(paletteKind);
          if(place) inserted.level = normalizeMissionLevel(place.insertLevel);
          current.splice(targetIdx, 0, inserted);
          missionBlocksState = current;
          renderMissionBlocksEditor(current);
          return;
        }
        const fromIdx = missionDragIndexFromTransfer(ev);
        if(fromIdx == null || fromIdx < 0 || fromIdx >= current.length) return;
        const place = missionLinearDropPlacement(current, ev);
        const targetIdx = place ? place.targetIdx : current.length;
        const moved = missionMoveSubtreeToIndex(current, fromIdx, targetIdx, {baseLevel: place ? place.insertLevel : undefined, resetUi:true});
        missionBlocksState = moved.list;
        renderMissionBlocksEditor(missionBlocksState);
      });
    }
    function missionDragAutoScrollTick(){
      if(!el.missionBlockList){
        missionDragAutoScrollRaf = 0;
        missionDragAutoScrollStep = 0;
        return;
      }
      if(Math.abs(missionDragAutoScrollStep) < 0.1){
        missionDragAutoScrollRaf = 0;
        return;
      }
      el.missionBlockList.scrollTop += missionDragAutoScrollStep;
      missionDragAutoScrollRaf = requestAnimationFrame(missionDragAutoScrollTick);
    }
    function missionUpdateDragAutoScroll(clientY){
      if(!el.missionBlockList || !Number.isFinite(clientY)) return;
      const rect = el.missionBlockList.getBoundingClientRect();
      let step = 0;
      if(clientY <= rect.top + MISSION_DRAG_AUTOSCROLL_ZONE_PX){
        const ratio = 1 - Math.max(0, (clientY - rect.top) / MISSION_DRAG_AUTOSCROLL_ZONE_PX);
        step = -Math.max(2, Math.round(MISSION_DRAG_AUTOSCROLL_MAX_STEP * ratio));
      }else if(clientY >= rect.bottom - MISSION_DRAG_AUTOSCROLL_ZONE_PX){
        const ratio = 1 - Math.max(0, (rect.bottom - clientY) / MISSION_DRAG_AUTOSCROLL_ZONE_PX);
        step = Math.max(2, Math.round(MISSION_DRAG_AUTOSCROLL_MAX_STEP * ratio));
      }
      missionDragAutoScrollStep = step;
      if(!missionDragAutoScrollRaf && Math.abs(step) > 0.1){
        missionDragAutoScrollRaf = requestAnimationFrame(missionDragAutoScrollTick);
      }
      if(Math.abs(step) <= 0.1 && missionDragAutoScrollRaf){
        cancelAnimationFrame(missionDragAutoScrollRaf);
        missionDragAutoScrollRaf = 0;
      }
    }
    function stopMissionDragAutoScroll(){
      missionDragAutoScrollStep = 0;
      if(missionDragAutoScrollRaf){
        cancelAnimationFrame(missionDragAutoScrollRaf);
        missionDragAutoScrollRaf = 0;
      }
    }
    function updateMissionBlockCanvasState(count){
      if(el.missionBlockCount){
        el.missionBlockCount.textContent = "총 " + Math.max(0, count) + "개";
      }
      if(el.missionBlockCanvas){
        el.missionBlockCanvas.classList.toggle("is-empty", !(count > 0));
      }
    }
    function renderMissionBlocksEditor(list){
      if(!el.missionBlockList) return;
      const stage = missionStageEl();
      if(!stage) return;
      bindMissionBlockListDropZone();
      bindMissionCanvasInteractions();
      missionBlocksState = normalizeMissionBlocks(Array.isArray(list) ? list : missionBlocksState);
      // Rebuild mission runtime from latest editor blocks on next telemetry tick.
      resetReplayMissionRuntime();
      stage.innerHTML = "";
      if(missionBlocksState.length === 0){
        updateMissionBlockCanvasState(0);
        updateMissionEditLockUI();
        return;
      }
      updateMissionBlockCanvasState(missionBlocksState.length);
      const branchByLevel = [];
      const getParentContainerForLevel = (level)=>{
        const lv = normalizeMissionLevel(level);
        if(lv <= 0) return stage;
        const parentBranch = branchByLevel[lv - 1];
        return parentBranch || stage;
      };
      missionBlocksState.forEach((block, idx)=>{
        const wrap = document.createElement("div");
        wrap.innerHTML = missionBlockRowHtml(block, idx);
        const row = wrap.firstElementChild;
        if(!row) return;
        let rowLevel = normalizeMissionLevel(block.level);
        row.setAttribute("data-level", String(rowLevel));
        const triggerTypeEl = row.querySelector("[data-role='triggerType']");
        const triggerValueTypeEl = row.querySelector("[data-role='triggerValueType']");
        const actionTypeEl = row.querySelector("[data-role='actionType']");
        const actionValueModeEl = row.querySelector("[data-role='actionValueMode']");
        const actionSensorEl = row.querySelector("[data-role='actionSensor']");
        const actionExprLhsTypeEl = row.querySelector("[data-role='actionExprLhsType']");
        const actionExprLhsSensorEl = row.querySelector("[data-role='actionExprLhsSensor']");
        const actionExprRhsTypeEl = row.querySelector("[data-role='actionExprRhsType']");
        const actionExprRhsSensorEl = row.querySelector("[data-role='actionExprRhsSensor']");
        const loopModeEl = row.querySelector("[data-role='loopMode']");
        const removeBtn = row.querySelector("[data-role='remove']");
        row.draggable = !!isMissionEditableNow();
        row.addEventListener("dragstart",(ev)=>{
          if(!isMissionEditableNow()){
            ev.preventDefault();
            return;
          }
          stopMissionDragAutoScroll();
          if(ev.target && ev.target.closest){
            const interactive = ev.target.closest("input, select, button");
            if(interactive){
              ev.preventDefault();
              return;
            }
          }
          if(row._freeMoveState){
            row._freeMoveState = null;
            row.classList.remove("is-free-moving");
          }
          clearMissionBranchDropActive();
          if(el.missionBlockList) el.missionBlockList.classList.add("is-dragging");
          row.classList.add("is-dragging");
          if(ev.dataTransfer){
            ev.dataTransfer.effectAllowed = "move";
            ev.dataTransfer.setData("text/x-mission-block-index", String(idx));
            ev.dataTransfer.setData("text/plain", String(idx));
          }
        });
        row.addEventListener("dragover",(ev)=>{
          if(!isMissionEditableNow()) return;
          missionUpdateDragAutoScroll(ev.clientY);
          // While hovering a row, prioritize row reorder semantics over nearby-branch snap.
          const branchTarget = missionResolveBranchDropTarget(ev, false);
          if(branchTarget){
            missionSetBranchDropActive(branchTarget);
            row.classList.remove("drop-before", "drop-after", "drop-inside");
            ev.preventDefault();
            return;
          }
          clearMissionBranchDropActive();
          ev.preventDefault();
          const rect = row.getBoundingClientRect();
          const rowTypeHint = normalizeMissionRowType(row.getAttribute("data-row-type"));
          const canNestHere = (rowTypeHint === "condition" || rowTypeHint === "loop");
          const yInRow = ev.clientY - rect.top;
          const placeInside = canNestHere && yInRow >= (rect.height * 0.30);
          const placeAfter = (ev.clientY - rect.top) >= (rect.height * 0.5);
          row.classList.toggle("drop-inside", placeInside);
          row.classList.toggle("drop-before", !placeInside && !placeAfter);
          row.classList.toggle("drop-after", !placeInside && placeAfter);
        });
        row.addEventListener("dragleave",()=>{
          row.classList.remove("drop-before", "drop-after", "drop-inside");
          clearMissionBranchDropActive();
        });
        row.addEventListener("dragend",()=>{
          stopMissionDragAutoScroll();
          row.classList.remove("is-dragging", "drop-before", "drop-after", "drop-inside");
          if(el.missionBlockList){
            el.missionBlockList.classList.remove("is-dragging");
            const marks = el.missionBlockList.querySelectorAll(".mission-block-row.drop-before, .mission-block-row.drop-after, .mission-block-row.drop-inside, .mission-block-row.is-dragging");
            marks.forEach((node)=>node.classList.remove("drop-before", "drop-after", "drop-inside", "is-dragging"));
          }
          clearMissionBranchDropActive();
          if(el.missionBlockCanvas) el.missionBlockCanvas.classList.remove("drop-active");
        });
        row.addEventListener("drop",(ev)=>{
          if(!isMissionEditableNow()) return;
          stopMissionDragAutoScroll();
          ev.preventDefault();
          ev.stopPropagation();
          // Keep row drop deterministic: explicit branch drops are handled by list/canvas zones.
          const branchTarget = missionResolveBranchDropTarget(ev, false);
          if(branchTarget){
            missionSetBranchDropActive(null);
            row.classList.remove("drop-before", "drop-after", "drop-inside");
            const current = buildMissionBlocksFromUi();
            const parentCondIdx = parseInt(String(branchTarget.getAttribute("data-cond-index") || ""), 10);
            const nestedLevel = normalizeMissionLevel(missionRowLevelFromIndex(parentCondIdx) + 1);
            let targetIdx = missionBranchInsertIndexFromTarget(branchTarget, current.length);
            const paletteKind = missionPaletteKindFromTransfer(ev);
            if(paletteKind){
              const inserted = missionBlockTemplate(paletteKind);
              inserted.level = nestedLevel;
              current.splice(targetIdx, 0, inserted);
              missionBlocksState = current;
              renderMissionBlocksEditor(current);
              return;
            }
            const fromIdx = missionDragIndexFromTransfer(ev);
            if(fromIdx == null || fromIdx < 0 || fromIdx >= current.length) return;
            if(missionIndexInSubtree(current, fromIdx, parentCondIdx)) return;
            const moved = missionMoveSubtreeToIndex(current, fromIdx, targetIdx, {baseLevel:nestedLevel, resetUi:true});
            missionBlocksState = moved.list;
            renderMissionBlocksEditor(missionBlocksState);
            return;
          }
          clearMissionBranchDropActive();
          row.classList.remove("drop-before", "drop-after", "drop-inside");
          const current = buildMissionBlocksFromUi();
          const rect = row.getBoundingClientRect();
          const yInRow = ev.clientY - rect.top;
          const placeAfter = (ev.clientY - rect.top) >= (rect.height * 0.5);
          let targetIdx = idx + (placeAfter ? 1 : 0);
          const targetRow = normalizeMissionBlock(current[idx] || {});
          let insertLevel = normalizeMissionLevel(targetRow.level);
          const targetRowType = normalizeMissionRowType(targetRow.rowType);
          const canNestHere = (targetRowType === "condition" || targetRowType === "loop");
          const placeInside = canNestHere && yInRow >= (rect.height * 0.30);
          if(placeInside){
            targetIdx = idx + 1;
            insertLevel = normalizeMissionLevel(targetRow.level + 1);
          }
          const paletteKind = missionPaletteKindFromTransfer(ev);
          if(paletteKind){
            targetIdx = Math.max(0, Math.min(current.length, targetIdx));
            const inserted = missionBlockTemplate(paletteKind);
            inserted.level = insertLevel;
            current.splice(targetIdx, 0, inserted);
            missionBlocksState = current;
            renderMissionBlocksEditor(current);
            return;
          }
          const fromIdx = missionDragIndexFromTransfer(ev);
          if(fromIdx == null || fromIdx < 0 || fromIdx >= current.length) return;
          const moved = missionMoveSubtreeToIndex(current, fromIdx, targetIdx, {baseLevel:insertLevel, resetUi:true});
          missionBlocksState = moved.list;
          renderMissionBlocksEditor(missionBlocksState);
        });
        if(triggerTypeEl){
          triggerTypeEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(triggerValueTypeEl){
          triggerValueTypeEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(actionTypeEl){
          actionTypeEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(actionValueModeEl){
          actionValueModeEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(actionSensorEl){
          actionSensorEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(actionExprLhsTypeEl){
          actionExprLhsTypeEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(actionExprRhsTypeEl){
          actionExprRhsTypeEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(actionExprLhsSensorEl){
          actionExprLhsSensorEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(actionExprRhsSensorEl){
          actionExprRhsSensorEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(loopModeEl){
          loopModeEl.addEventListener("change",()=>updateMissionBlockRowUi(row));
        }
        if(removeBtn){
          removeBtn.addEventListener("click",()=>{
            if(!isMissionEditableNow()){
              showToast("시퀀스 중에는 블럭을 수정할 수 없습니다.", "notice", {key:"mission-edit-lock"});
              return;
            }
            const current = buildMissionBlocksFromUi();
            const end = missionSubtreeEndIndex(current, idx);
            current.splice(idx, Math.max(1, end - idx + 1));
            missionBlocksState = current;
            renderMissionBlocksEditor(current);
          });
        }
        updateMissionBlockRowUi(row);
        const rowType = normalizeMissionRowType(block.rowType);
        const normalizeParentForLevel = ()=>{
          let parent = getParentContainerForLevel(rowLevel);
          if(parent === stage && rowLevel > 0){
            rowLevel = 0;
            row.setAttribute("data-level", "0");
          }
          return getParentContainerForLevel(rowLevel);
        };
        if(rowType === "condition" || rowType === "loop"){
          const parentContainer = normalizeParentForLevel();
          branchByLevel.length = rowLevel;
          const group = document.createElement("div");
          group.className = "mission-if-group";
          if(rowLevel > 0) group.classList.add("mission-row--nested");
          group.setAttribute("data-cond-index", String(idx));
          group.setAttribute("data-level", String(rowLevel));
          const branch = document.createElement("div");
          branch.className = "mission-if-branch";
          branch.setAttribute("data-cond-index", String(idx));
          branch.setAttribute("data-level", String(rowLevel));
          group.appendChild(row);
          group.appendChild(branch);
          parentContainer.appendChild(group);
          branchByLevel[rowLevel] = branch;
          applyMissionRowUiPosition(row, block.uiX, block.uiY);
          bindMissionBlockRowFreeMove(row);
          return;
        }
        const parentContainer = normalizeParentForLevel();
        if(rowLevel > 0){
          row.classList.add("mission-row--nested");
        }else{
          row.classList.remove("mission-row--nested");
        }
        parentContainer.appendChild(row);
        branchByLevel.length = rowLevel;
        applyMissionRowUiPosition(row, block.uiX, block.uiY);
        bindMissionBlockRowFreeMove(row);
      });
      updateMissionEditLockUI();
    }
    function addMissionBlock(kind){
      if(!isMissionEditableNow()){
        showToast("시퀀스 중에는 블럭을 수정할 수 없습니다.", "notice", {key:"mission-edit-lock"});
        return;
      }
      const current = buildMissionBlocksFromUi();
      current.push(missionBlockTemplate(kind));
      missionBlocksState = current;
      renderMissionBlocksEditor(current);
    }
    function clearMissionBlocks(){
      if(!isMissionEditableNow()){
        showToast("시퀀스 중에는 블럭을 수정할 수 없습니다.", "notice", {key:"mission-edit-lock"});
        return;
      }
      missionBlocksState = [];
      renderMissionBlocksEditor([]);
    }
    function buildMissionProfileDoc(){
      const baseDoc = cloneMissionDocSafe(missionProfileDoc) || {};
      const missionName = sanitizeMissionName(el.missionName && el.missionName.value);
      const motorPreset = sanitizeMissionName(selectedMotorName || missionName);
      const testCountRaw = parseInt(el.missionTestCount && el.missionTestCount.value, 10);
      const testCount = (Number.isFinite(testCountRaw) && testCountRaw > 0) ? testCountRaw : null;
      const diameterMm = parseMissionNumber(el.missionMotorDia && el.missionMotorDia.value);
      const lengthMm = parseMissionNumber(el.missionMotorLen && el.missionMotorLen.value);
      const ignDelaySec = parseMissionNumber(el.missionIgnDelay && el.missionIgnDelay.value);
      const grainMassG = parseMissionNumber(el.missionGrainMass && el.missionGrainMass.value);
      const totalMassG = parseMissionNumber(el.missionTotalMass && el.missionTotalMass.value);
      const vendor = sanitizeMissionName(el.missionVendor && el.missionVendor.value);

      baseDoc.schema = "flash6-mission-v1";
      baseDoc.updatedAt = new Date().toISOString();
      const editorBlocks = buildMissionBlocksFromUi();
      if(!Array.isArray(baseDoc.blocks)) baseDoc.blocks = [];
      if(!Array.isArray(baseDoc.editorBlocks)) baseDoc.editorBlocks = [];
      if(!baseDoc.profile || typeof baseDoc.profile !== "object") baseDoc.profile = {};
      baseDoc.profile.missionName = missionName;
      baseDoc.profile.motorPreset = motorPreset;
      baseDoc.profile.testCount = testCount;
      baseDoc.profile.motor = {
        diameterMm,
        lengthMm
      };
      baseDoc.profile.ignitionDelaySec = ignDelaySec;
      baseDoc.profile.grainMassG = grainMassG;
      baseDoc.profile.totalMassG = totalMassG;
      baseDoc.profile.vendor = vendor;
      baseDoc.editorBlocks = editorBlocks;
      baseDoc.blocks = compileMissionRuntimeBlocks(editorBlocks);
      return baseDoc;
    }
    function assignMissionInputValue(node, value){
      if(!node) return;
      node.value = (value == null || !Number.isFinite(Number(value))) ? "" : String(value);
    }
    function applyMissionProfileDoc(doc){
      if(!doc || typeof doc !== "object") return false;
      const capabilities = (doc.capabilities && typeof doc.capabilities === "object")
        ? doc.capabilities
        : null;
      if(capabilities && capabilities.missionEditable != null){
        setMissionFirmwareCapability(
          !capabilities.missionEditable,
          capabilities.missionSource,
          capabilities.missionLockReason
        );
      }
      const profile = (doc.profile && typeof doc.profile === "object") ? doc.profile : doc;
      const motor = (profile.motor && typeof profile.motor === "object") ? profile.motor : {};

      const missionName = sanitizeMissionName(profile.missionName || profile.name) || DEFAULT_MISSION_NAME;
      const motorPreset = sanitizeMissionName(profile.motorPreset || profile.motorName || missionName);
      const testCount = parseMissionNumber(profile.testCount);
      const diameterMm = parseMissionNumber(motor.diameterMm != null ? motor.diameterMm : profile.diameterMm);
      const lengthMm = parseMissionNumber(motor.lengthMm != null ? motor.lengthMm : profile.lengthMm);
      const ignDelaySec = parseMissionNumber(profile.ignitionDelaySec != null ? profile.ignitionDelaySec : profile.ignDelaySec);
      const grainMassG = parseMissionNumber(profile.grainMassG);
      const totalMassG = parseMissionNumber(profile.totalMassG);
      const vendor = sanitizeMissionName(profile.vendor);

      if(el.missionName) el.missionName.value = missionName || "";
      if(el.missionTestCount) el.missionTestCount.value = (testCount != null && testCount > 0) ? String(Math.round(testCount)) : "";
      assignMissionInputValue(el.missionMotorDia, diameterMm);
      assignMissionInputValue(el.missionMotorLen, lengthMm);
      assignMissionInputValue(el.missionIgnDelay, ignDelaySec);
      assignMissionInputValue(el.missionGrainMass, grainMassG);
      assignMissionInputValue(el.missionTotalMass, totalMassG);
      if(el.missionVendor) el.missionVendor.value = vendor || "";

      selectedMotorName = motorPreset || missionName || "";
      setMissionPresetSelectionUi(selectedMotorName || missionName);
      missionProfileDoc = cloneMissionDocSafe(doc);
      const editorBlocks = Array.isArray(doc.editorBlocks)
        ? doc.editorBlocks
        : expandRuntimeBlocksToEditorRows(Array.isArray(doc.blocks) ? doc.blocks : []);
      missionBlocksState = normalizeMissionBlocks(editorBlocks);
      renderMissionBlocksEditor(missionBlocksState);

      reportExportedRevision = 0;
      reportExportedOnce = false;
      updateExportGuardUi();
      updateMotorInfoPanel();
      updateExportButtonState();
      return true;
    }
    async function loadMissionProfileFromBoard(){
      if(simEnabled || replaySourceActive) return false;
      const API_BASE = getApiBaseForCommands();
      const url = (API_BASE ? API_BASE : "") + "/mission_profile";
      try{
        const res = await fetch(url, {cache:"no-cache"});
        if(!res.ok){
          throw new Error("HTTP " + res.status);
        }
        const doc = await res.json();
        return applyMissionProfileDoc(doc);
      }catch(_err){
        return false;
      }
    }
    function base64FromUtf8Bytes(bytes){
      if(!(bytes && bytes.length)) return "";
      let bin = "";
      const step = 0x2000;
      for(let i = 0; i < bytes.length; i += step){
        const part = bytes.subarray(i, i + step);
        let s = "";
        for(let j = 0; j < part.length; j++){
          s += String.fromCharCode(part[j]);
        }
        bin += s;
      }
      return btoa(bin);
    }
    async function sendMissionSerialAckCommand(path, ackPrefix, timeoutMs){
      if(!serialConnected) return { ok:false, reason:"SERIAL_DISCONNECTED" };
      if(!serialTxEnabled) return { ok:false, reason:"SERIAL_TX_DISABLED" };
      const waiter = createSerialAckWaiter((evt)=>{
        if(evt.kind === "err") return true;
        if(evt.kind !== "ack") return false;
        if(!ackPrefix) return true;
        return String(evt.message || "").indexOf(ackPrefix) === 0;
      }, timeoutMs || MISSION_SERIAL_REPLY_TIMEOUT_MS);
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
    async function sendMissionSerialAckCommandRetry(path, ackPrefix, timeoutMs, maxAttempts){
      const attempts = Math.max(1, Math.round(Number(maxAttempts) || 1));
      let last = { ok:false, reason:"SERIAL_FAIL" };
      for(let i = 0; i < attempts; i++){
        const res = await sendMissionSerialAckCommand(path, ackPrefix, timeoutMs);
        if(res && res.ok) return res;
        last = res || last;
        const reason = String((res && res.reason) || "");
        const isRetryable = (reason === "SERIAL_TIMEOUT" || reason === "SERIAL_CANCELLED");
        if(!isRetryable) break;
        if(i < attempts - 1){
          await new Promise(resolve=>setTimeout(resolve, 140 + (i * 120)));
        }
      }
      return last;
    }
    async function saveMissionProfileViaSerial(body, bodyBytes){
      const canSerialSave = !!(serialEnabled && serialConnected && serialTxEnabled);
      if(!canSerialSave) return { ok:false, reason:"SERIAL_NOT_READY" };
      const streamWasEnabled = !!serialRxEnabled;
      if(streamWasEnabled){
        try{ await setSerialStreamState(false); }catch(_e){}
      }
      try{

        const beginRes = await sendMissionSerialAckCommandRetry(
          "/mission_profile_begin?len=" + String(Math.max(0, bodyBytes || 0)),
          "MISSION_PROFILE_BEGIN",
          4500,
          3
        );
        if(!beginRes.ok) return beginRes;

        const bytes = new TextEncoder().encode(String(body || ""));
        const b64 = base64FromUtf8Bytes(bytes);
        if(!b64){
          await sendMissionSerialAckCommandRetry("/mission_profile_cancel", "MISSION_PROFILE_CANCEL", 1800, 2);
          return { ok:false, reason:"SERIAL_B64_ENCODE_FAIL" };
        }

        for(let i = 0; i < b64.length; i += MISSION_SERIAL_CHUNK_B64_SIZE){
          const chunk = b64.slice(i, i + MISSION_SERIAL_CHUNK_B64_SIZE);
          const chunkRes = await sendMissionSerialAckCommandRetry(
            "/mission_profile_chunk?b64=" + chunk,
            "MISSION_PROFILE_CHUNK",
            5000,
            3
          );
          if(!chunkRes.ok){
            await sendMissionSerialAckCommandRetry("/mission_profile_cancel", "MISSION_PROFILE_CANCEL", 1800, 2);
            return chunkRes;
          }
        }

        const endRes = await sendMissionSerialAckCommandRetry("/mission_profile_end", "MISSION_PROFILE_SAVED", 7000, 3);
        return endRes;
      } finally {
        if(streamWasEnabled){
          try{ await setSerialStreamState(true); }catch(_e){}
        }
      }
    }
    async function saveMissionProfileToBoard(){
      if(missionFirmwareLocked){
        showToast(missionEditUnavailableMessage(), "notice", {
          key:"mission-firmware-lock",
          forceToast:true
        });
        return false;
      }
      if(missionBoardSavePending){
        showToast("보드 저장 중입니다. 완료될 때까지 기다리세요.", "notice", {
          key:"mission-board-save-pending",
          forceToast:true
        });
        return false;
      }
      if(!isMissionEditableNow()){
        showToast("미션 수정은 IDLE(시퀀스 전)에서만 가능합니다.", "notice", {
          key:"mission-edit-lock",
          forceToast:true
        });
        return false;
      }
      let payload = null;
      let body = "";
      let bodyBytes = 0;
      try{
        payload = buildMissionProfileDoc();
        body = JSON.stringify(payload);
        bodyBytes = new TextEncoder().encode(body).length;
      }catch(err){
        showToast("보드 저장 실패: 미션 컴파일 오류 (" + (err && err.message ? err.message : err) + ")", "error", {key:"mission-board-save-fail"});
        return false;
      }
      const boardMissionMaxBytes = 24576;
      if(bodyBytes > boardMissionMaxBytes){
        showToast(
          "보드 저장 실패: 미션 JSON 크기 초과 (" + bodyBytes + " / " + boardMissionMaxBytes + " bytes)",
          "error",
          {key:"mission-board-save-fail"}
        );
        return false;
      }
      missionBoardSavePending = true;
      showToast("보드에 미션 저장 요청 중...", "info", {
        key:"mission-board-save-progress",
        forceToast:true,
        duration:1800
      });
      const canSerialMissionSave = !!(serialEnabled && serialConnected && serialTxEnabled);
      const expectedRuntimeBlocks = Array.isArray(payload && payload.blocks)
        ? payload.blocks.length
        : 0;
      if(canSerialMissionSave){
        const serialRes = await saveMissionProfileViaSerial(body, bodyBytes);
        if(serialRes.ok){
          const loadedMatch = String(serialRes.reason || "").match(/\bblocks=(\d+)/i);
          const loadedBlocks = loadedMatch ? Number(loadedMatch[1]) : null;
          if(expectedRuntimeBlocks > 0 && loadedBlocks === 0){
            showToast("보드 저장 실패: 런타임 블록이 로드되지 않았습니다.", "error", {
              key:"mission-board-save-fail",
              forceToast:true
            });
            missionBoardSavePending = false;
            return false;
          }
          missionProfileDoc = payload;
          showToast("미션이 보드 플래시에 저장되었습니다.", "success", {key:"mission-board-save"});
          missionBoardSavePending = false;
          return true;
        }
        if(String(serialRes.reason || "").toUpperCase().indexOf("FIRMWARE_LOCKED") >= 0){
          setMissionFirmwareCapability(true, "builtin_launch_sequence", "BUILTIN_MISSION");
          showToast(missionEditUnavailableMessage(), "notice", {
            key:"mission-firmware-lock",
            forceToast:true
          });
          missionBoardSavePending = false;
          return false;
        }
        addLogLine("Mission save via SERIAL failed: " + serialRes.reason, "ERR");
        showToast("시리얼 저장 실패 → HTTP 저장 재시도: " + (serialRes.reason || "SERIAL_FAIL"), "notice", {
          key:"mission-board-save-serial-fallback",
          forceToast:true
        });
      }
      const API_BASE = getApiBaseForCommands();
      const url = (API_BASE ? API_BASE : "") + "/mission_profile";
      const opt = {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body,
        cache: "no-cache"
      };
      const saveTimeoutMs = 6000;
      const abortCtl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      let abortTimer = null;
      if(abortCtl){
        opt.signal = abortCtl.signal;
        abortTimer = setTimeout(()=>{
          try{ abortCtl.abort(); }catch(_abortErr){}
        }, saveTimeoutMs);
      }
      try{
        const res = await fetch(url, opt);
        if(abortTimer){ clearTimeout(abortTimer); abortTimer = null; }
        if(res.status === 423){
          setMissionFirmwareCapability(true, "builtin_launch_sequence", "BUILTIN_MISSION");
          showToast(missionEditUnavailableMessage(), "notice", {
            key:"mission-firmware-lock",
            forceToast:true
          });
          return false;
        }
        if(res.status === 409){
          showToast("시퀀스 진행 중에는 저장할 수 없습니다.", "notice", {key:"mission-edit-lock"});
          return false;
        }
        if(!res.ok){
          let detail = "";
          try{
            const text = await res.text();
            if(text){
              try{
                const obj = JSON.parse(text);
                if(obj && obj.err) detail = String(obj.err);
              }catch(_jsonErr){
                detail = text.slice(0, 120);
              }
            }
          }catch(_readErr){}
          throw new Error("HTTP " + res.status + (detail ? (" (" + detail + ")") : ""));
        }
        let saveResult = null;
        try{
          saveResult = await res.json();
        }catch(_jsonErr){}
        if(expectedRuntimeBlocks > 0 &&
           saveResult &&
           Number(saveResult.runtime_blocks) === 0){
          throw new Error("보드 런타임에 미션 블록이 로드되지 않았습니다.");
        }
        missionProfileDoc = payload;
        showToast("미션이 보드 플래시에 저장되었습니다.", "success", {key:"mission-board-save"});
        return true;
      }catch(err){
        if(abortTimer){ clearTimeout(abortTimer); abortTimer = null; }
        const isAbort = !!(err && (err.name === "AbortError" || String(err).indexOf("AbortError") >= 0));
        if(isAbort){
          showToast("보드 저장 실패: 응답 시간 초과(연결 확인 필요)", "error", {
            key:"mission-board-save-fail",
            forceToast:true
          });
          return false;
        }
        showToast("보드 저장 실패: " + (err && err.message ? err.message : err), "error", {
          key:"mission-board-save-fail",
          forceToast:true
        });
        return false;
      }finally{
        missionBoardSavePending = false;
      }
    }
    function downloadMissionProfileJson(){
      const payload = buildMissionProfileDoc();
      missionProfileDoc = payload;
      const missionName = sanitizeMissionName((payload.profile && payload.profile.missionName) || selectedMotorName || "mission");
      const safeName = missionName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "") || "mission";
      const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
      const filename = "flash6_mission_" + safeName + "_" + ts + ".json";
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(()=>{
        URL.revokeObjectURL(link.href);
        link.remove();
      }, 0);
      showToast("미션 JSON을 내보냈습니다.", "success", {key:"mission-export"});
    }
    function importMissionProfileFromFile(file){
      if(!file) return;
      if(missionFirmwareLocked){
        showToast(missionEditUnavailableMessage(), "notice", {key:"mission-firmware-lock"});
        if(el.missionImportInput) el.missionImportInput.value = "";
        return;
      }
      if(!isMissionEditableNow()){
        showToast("미션 수정은 IDLE(시퀀스 전)에서만 가능합니다.", "notice", {key:"mission-edit-lock"});
        return;
      }
      const reader = new FileReader();
      reader.onload = ()=>{
        try{
          const raw = String(reader.result || "");
          const doc = JSON.parse(raw);
          if(!doc || typeof doc !== "object" || Array.isArray(doc)){
            throw new Error("invalid format");
          }
          if(!applyMissionProfileDoc(doc)){
            throw new Error("apply failed");
          }
          showToast("미션 JSON을 불러왔습니다.", "success", {key:"mission-import"});
        }catch(err){
          showToast("미션 JSON 형식 오류: " + (err && err.message ? err.message : err), "error", {key:"mission-import-fail"});
        }finally{
          if(el.missionImportInput) el.missionImportInput.value = "";
        }
      };
      reader.onerror = ()=>{
        showToast("파일 읽기 실패", "error", {key:"mission-import-read-fail"});
        if(el.missionImportInput) el.missionImportInput.value = "";
      };
      reader.readAsText(file);
    }
    function updateMissionEditLockUI(){
      const editable = isMissionEditableNow();
      const missionProfileAvailable = !isFlightModeUi();
      const lockMessage = missionEditUnavailableMessage();
      if(el.missionFirmwareLockNotice){
        el.missionFirmwareLockNotice.classList.toggle("hidden", !missionFirmwareLocked);
        el.missionFirmwareLockNotice.setAttribute("aria-hidden", missionFirmwareLocked ? "false" : "true");
      }
      if(!missionProfileAvailable){
        if(isMobileMissionPanelVisible()) setMobileMissionPanelVisible(false);
        if(missionPanelActive) setMissionPanelVisible(false);
        if(isMissionOverlayVisible()) setOverlayVisible(el.missionOverlay, false);
      }
      if(el.missionOpenBtn){
        el.missionOpenBtn.classList.toggle("hidden", !missionProfileAvailable);
        el.missionOpenBtn.disabled = !missionProfileAvailable;
        el.missionOpenBtn.setAttribute("aria-hidden", missionProfileAvailable ? "false" : "true");
        el.missionOpenBtn.setAttribute("aria-disabled", (missionProfileAvailable && editable) ? "false" : "true");
        el.missionOpenBtn.title = !missionProfileAvailable
          ? "Flight 모드에서는 미션 프로필을 사용할 수 없습니다."
          : (editable ? "" : lockMessage);
      }
      if(el.missionViewOpenBtn){
        el.missionViewOpenBtn.classList.toggle("hidden", !missionProfileAvailable);
        el.missionViewOpenBtn.disabled = !missionProfileAvailable;
        el.missionViewOpenBtn.setAttribute("aria-hidden", missionProfileAvailable ? "false" : "true");
        el.missionViewOpenBtn.setAttribute("aria-disabled", (missionProfileAvailable && editable) ? "false" : "true");
        el.missionViewOpenBtn.title = !missionProfileAvailable
          ? "Flight 모드에서는 미션 프로필을 사용할 수 없습니다."
          : (editable ? "" : lockMessage);
      }
      if(el.missionPanel){
        el.missionPanel.classList.toggle("hidden", !missionProfileAvailable);
        if(!missionProfileAvailable){
          el.missionPanel.setAttribute("aria-hidden", "true");
        }
      }
      if(el.mobileMissionPanel){
        el.mobileMissionPanel.classList.toggle("hidden", !missionProfileAvailable);
        if(!missionProfileAvailable){
          el.mobileMissionPanel.setAttribute("aria-hidden", "true");
        }
      }
      if(el.mobileMissionWideBtn){
        el.mobileMissionWideBtn.classList.toggle("hidden", !missionProfileAvailable);
        el.mobileMissionWideBtn.disabled = !missionProfileAvailable;
        el.mobileMissionWideBtn.classList.toggle("disabled", !missionProfileAvailable);
        el.mobileMissionWideBtn.setAttribute("aria-hidden", missionProfileAvailable ? "false" : "true");
        el.mobileMissionWideBtn.setAttribute("aria-disabled", missionProfileAvailable ? "false" : "true");
        el.mobileMissionWideBtn.title = !missionProfileAvailable
          ? "Flight 모드에서는 미션 프로필을 사용할 수 없습니다."
          : "";
      }
      updateMobileArmLockWideButton();
      if(el.missionSaveBoardBtn){
        // Sequence locks remain clickable for feedback. A firmware mission is
        // authoritative and cannot accept a profile at all.
        el.missionSaveBoardBtn.disabled = missionFirmwareLocked;
        el.missionSaveBoardBtn.classList.toggle("disabled", missionFirmwareLocked);
        el.missionSaveBoardBtn.setAttribute("aria-disabled", missionFirmwareLocked ? "true" : "false");
        el.missionSaveBoardBtn.title = editable ? "" : lockMessage;
      }
      if(el.missionImportInput){
        el.missionImportInput.disabled = !editable;
      }
      if(el.missionBlockAddServoBtn) el.missionBlockAddServoBtn.disabled = !editable;
      if(el.missionBlockAddPyroBtn) el.missionBlockAddPyroBtn.disabled = !editable;
      if(el.missionBlockClearBtn) el.missionBlockClearBtn.disabled = !editable;
      if(el.missionFields){
        const metadataInputs = el.missionFields.querySelectorAll(".mission-meta-panel input");
        metadataInputs.forEach((node)=>{ node.disabled = !editable; });
      }
      if(el.missionPresetGrid){
        const presetButtons = el.missionPresetGrid.querySelectorAll("button");
        presetButtons.forEach((button)=>{ button.disabled = !editable; });
      }
      if(el.missionBlockPalette){
        const paletteBtns = el.missionBlockPalette.querySelectorAll("button");
        paletteBtns.forEach((btn)=>{
          btn.disabled = !editable;
          btn.draggable = !!editable;
        });
      }
      if(el.missionBlockList){
        const nodes = el.missionBlockList.querySelectorAll("input, select, button");
        nodes.forEach((node)=>{
          node.disabled = !editable;
        });
        const rows = el.missionBlockList.querySelectorAll(".mission-block-row");
        rows.forEach((row)=>{
          row.draggable = !!editable;
        });
      }
      if(el.missionConfirmBtn){
        el.missionConfirmBtn.disabled = !editable;
        el.missionConfirmBtn.classList.toggle("disabled", !editable);
      }
      setMobileControlButtonState("mission", (!missionProfileAvailable || !editable));
    }

    function showMissionRequired(){
      hideMobileControlsPanel();
      setOverlayVisible(el.missionRequiredOverlay, true);
    }
    function hideMissionRequired(){
      setOverlayVisible(el.missionRequiredOverlay, false);
    }
    function showInspectionWarning(failedKeys){
      if(el.inspectionWarnText){
        el.inspectionWarnText.innerHTML = buildInspectionFailMessage(failedKeys || inspectionLastFailedKeys);
      }
      setOverlayVisible(el.inspectionWarnOverlay, true);
    }
    function hideInspectionWarning(){
      setOverlayVisible(el.inspectionWarnOverlay, false);
    }
    function showNoMotorNotice(){
      hideMobileControlsPanel();
      setOverlayVisible(el.noMotorOverlay, true);
      showToast("메타데이터 미지정: 미션 정보 없이 진행", "notice", {key:"mission-no-meta"});
    }
    function hideNoMotorNotice(){
      setOverlayVisible(el.noMotorOverlay, false);
    }
    function showMission(){
      if(isFlightModeUi()){
        showToast("Flight 모드에서는 미션 프로필을 사용할 수 없습니다.", "notice", {key:"mission-profile-flight-disabled"});
        return;
      }
      if(missionFirmwareLocked){
        showToast(missionEditUnavailableMessage(), "notice", {
          key:"mission-firmware-lock",
          forceToast:true
        });
      }
      if(!isMissionEditableNow()){
        if(!missionFirmwareLocked){
          showToast("시퀀스 중에는 미션 편집만 잠깁니다.", "notice", {key:"mission-edit-lock"});
        }
      }
      const missionViewActive = !!(el.missionView && !el.missionView.classList.contains("hidden"));
      if(missionViewActive){
        hideMobileControlsPanel();
        setMissionPanelVisible(false);
        setMobileMissionPanelVisible(false);
        setOverlayVisible(el.missionOverlay, false);
        if(el.missionDialog && el.missionViewMount){
          mountDialogToPanel(el.missionDialog, el.missionViewMount, missionDialogDockState);
        }
        openMissionCustomEditor();
        if(el.missionViewMount){
          try{
            el.missionViewMount.scrollTo({top:0, behavior:"smooth"});
          }catch(_err){
            el.missionViewMount.scrollTop = 0;
          }
        }
        return;
      }
      if(isPhoneLandscapeLayout()){
        setOverlayVisible(el.missionOverlay, false);
        if(!mobileControlsActive){
          showMobileControlsPanel();
        }
        setMobileMissionPanelVisible(true);
        openMissionCustomEditor();
        return;
      }
      if(isTabletControlsLayout() || !isMobileLayout()){
        setOverlayVisible(el.missionOverlay, false);
        if(isTabletControlsLayout()){
          tabletControlsOpen = true;
          applyTabletControlsLayout();
        }
        setMissionPanelVisible(true);
        openMissionCustomEditor();
        return;
      }
      hideMobileControlsPanel();
      setMissionPanelVisible(false);
      setMobileMissionPanelVisible(false);
      setOverlayVisible(el.missionOverlay, true);
      openMissionCustomEditor();
    }
    function hideMission(){
      resetMissionToPresetList();
      if(isMobileMissionPanelVisible()){
        setMobileMissionPanelVisible(false);
      }
      if(missionPanelActive){
        setMissionPanelVisible(false);
      }
      setOverlayVisible(el.missionOverlay, false);
    }
