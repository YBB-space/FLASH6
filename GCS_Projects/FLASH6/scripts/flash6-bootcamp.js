/* FLASH6 bootcamp setup. Enabled by FLASH6_BOOTCAMP_MODE in flash6.html. */
function initBootcampMode(){
  const root = document.getElementById("bootcampApp");
  const state = {step:"welcome", sensor:"", mcu:"", uploadedSensor:""};
  const steps = ["sensor", "mcu", "pins", "connect", "code", "data", "rocket"];
  const groups = ["prepare", "connect", "code", "data"];
  const groupFor = {sensor:"prepare", mcu:"prepare", pins:"prepare", connect:"connect", code:"code", data:"data"};
  const setup = document.getElementById("bootcampSetup");
  const progress = root.querySelector(".bootcamp-progress");
  const scope = window.Flash6 && window.Flash6.appScope;
  const listen = (type, handler)=>scope ? scope.listen(root, type, handler) : root.addEventListener(type, handler);
  const uploader = window.Flash6BootcampUpload;
  const ui = {};
  ["UsbBadge", "UsbStatus", "Connect", "ConnectNext", "Flash", "UploadMessage", "UploadPhase", "UploadPercent", "UploadProgress",
   "CodeStatus", "CodeDownload", "CodeRetry", "SensorStatus", "LiveDot", "UploadLog", "DataProgress", "AutoNext", "RocketNext",
   "RocketMessage", "RocketRoll", "RocketPitch", "RocketYaw", "RocketClock", "RocketNote", "GyroZero"].forEach(name=>{
    ui[name] = document.getElementById("bootcamp" + name);
  });
  ui.RocketConnection = document.getElementById("cameraStage1Link");
  let lesson = null, lessonEpoch = 0, lastSelectedSampleAt = 0, lastPaintAt = 0, autoAdvance = false;
  const logLines = [], sampleTimes = [];
  const gate = {count:0, since:0, lastAt:0, deviceMs:null, ready:false};
  const rocket = new window.Flash6BootcampRocket(
    document.getElementById("bootcampRocketMount"),
    message=>{ ui.RocketMessage.textContent = message; ui.RocketMessage.hidden = !message; }
  );
  const log = line=>{
    logLines.push(line); if(logLines.length > 3) logLines.shift();
    ui.UploadLog.textContent = logLines.join("\n");
  };
  function resetGate(){
    Object.assign(gate, {count:0, since:0, lastAt:0, deviceMs:null, ready:false});
    ui.DataProgress.value = 0;
    ui.AutoNext.textContent = "정상 데이터가 2초간 수신되면 3D 로켓으로 이동합니다.";
  }
  function clearValues(message){
    lastSelectedSampleAt = 0; sampleTimes.length = 0; rocket.lastSampleAt = 0; resetGate();
    root.querySelectorAll("[data-bootcamp-value]").forEach(node=>{ node.textContent = "—"; });
    ui.LiveDot.classList.remove("is-live"); ui.SensorStatus.textContent = message;
    updateRocketStatus();
  }
  function syncButtons(){
    root.querySelectorAll("button").forEach(button=>{ button.disabled = connection.busy; });
    root.querySelectorAll('input[type="radio"]').forEach(input=>{ input.disabled = connection.busy; });
    document.getElementById("bootcampSensorNext").disabled = connection.busy || !state.sensor;
    document.getElementById("bootcampMcuNext").disabled = connection.busy || !state.mcu;
    ui.Connect.disabled = connection.busy || !connection.supported();
    ui.ConnectNext.disabled = connection.busy || !connection.state.connected;
    ui.Flash.disabled = connection.busy || !connection.state.connected || !lesson;
    ui.RocketNext.disabled = connection.busy || !gate.ready || !connection.state.connected || !rocket.fresh();
    ui.GyroZero.disabled = connection.busy || !connection.state.connected || !rocket.fresh();
    root.setAttribute("aria-busy", String(connection.busy));
  }
  function updateRocketStatus(){
    const connected = connection.state.connected;
    const fresh = connected && rocket.fresh();
    const span = sampleTimes.length > 1 ? sampleTimes.at(-1) - sampleTimes[0] : 0;
    const hz = span > 0 ? (sampleTimes.length - 1) * 1000 / span : 0;
    ui.RocketConnection.textContent = !connected ? "USB · 연결 끊김" : fresh ? "USB · " + hz.toFixed(1) + " Hz" : "USB · 수신 대기";
    ui.RocketConnection.classList.toggle("is-live", fresh);
    rocket.updateStatus(connected, fresh, hz);
    const attitude = rocket.attitude();
    ui.RocketRoll.textContent = fresh ? attitude.roll.toFixed(1) + "°" : "—";
    ui.RocketPitch.textContent = fresh ? attitude.pitch.toFixed(1) + "°" : "—";
    ui.RocketYaw.textContent = fresh ? attitude.yaw.toFixed(1) + "°" : "—";
    ui.RocketClock.textContent = new Intl.DateTimeFormat("ko-KR", {timeZone:"Asia/Seoul", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false}).format(new Date());
    ui.GyroZero.disabled = connection.busy || !fresh;
  }
  function checkDataGate(data, now){
    if(state.step !== "data") return;
    const norm = Math.hypot(data.ax, data.ay, data.az);
    if(!Number.isFinite(data.ms) || norm < 0.18 || norm > 5){
      resetGate(); ui.AutoNext.textContent = "가속도 값과 센서 연결을 확인하고 있습니다."; return;
    }
    const deviceMs = data.ms >>> 0;
    const delta = gate.deviceMs == null ? 50 : (deviceMs - gate.deviceMs) >>> 0;
    if(delta === 0) return;
    if(gate.count && (now - gate.lastAt > 350 || delta > 350)) resetGate();
    if(!gate.count) gate.since = now;
    gate.count++; gate.deviceMs = deviceMs; gate.lastAt = now;
    const percent = Math.min(100, Math.floor(Math.min(gate.count / 30, (now - gate.since) / 2000) * 100));
    ui.DataProgress.value = percent;
    gate.ready = percent >= 100 && rocket.fresh();
    ui.AutoNext.textContent = gate.ready ? "정상 수신 확인 완료 · 3D 로켓을 볼 수 있습니다." : "센서 데이터 확인 중 · " + percent + "%";
    if(gate.ready && autoAdvance){ autoAdvance = false; showStep("rocket"); }
  }
  const connection = new uploader.NanoConnection({
    onState(value){
      ui.UsbStatus.textContent = value.message; ui.UploadMessage.textContent = value.message;
      ui.UsbStatus.dataset.phase = value.phase; ui.UploadMessage.dataset.phase = value.phase;
      ui.UsbBadge.textContent = value.connected ? "USB 연결됨" : "연결 대기";
      ui.UsbBadge.classList.toggle("is-connected", value.connected);
      ui.Connect.textContent = value.connected ? "다른 Nano 선택" : "Nano 연결";
      const phases = {idle:"업로드 대기", connecting:"USB 연결 중", connected:"업로드 준비", detecting:"부트로더 확인", writing:"코드 쓰는 중", verifying:"코드 검증 중", uploaded:"업로드·검증 완료", error:"작업 확인 필요", unsupported:"브라우저 확인 필요"};
      ui.UploadPhase.textContent = phases[value.phase] || "업로드 대기";
      ui.UploadPercent.textContent = value.percent + "%"; ui.UploadProgress.value = value.percent;
      if(!value.connected) clearValues("Nano 연결 후 센서 응답을 기다립니다.");
      syncButtons(); updateRocketStatus();
    },
    onLog:log,
    onSample(data){
      if(data.sensor !== state.sensor){
        clearValues("다른 센서용 코드가 실행 중입니다. 선택한 센서의 코드를 업로드하세요."); return;
      }
      const now = Date.now(); lastSelectedSampleAt = now;
      sampleTimes.push(now); while(sampleTimes.length > 1 && sampleTimes[0] < now - 2000) sampleTimes.shift();
      rocket.consume(data); checkDataGate(data, now);
      if(now - lastPaintAt < 100) return;
      lastPaintAt = now;
      root.querySelectorAll("[data-bootcamp-value]").forEach(node=>{ node.textContent = data[node.dataset.bootcampValue].toFixed(2); });
      ui.LiveDot.classList.add("is-live"); ui.SensorStatus.textContent = state.sensor + " 데이터 수신 중";
      syncButtons(); updateRocketStatus();
    },
    onDevice(data){
      if(data.sensor !== state.sensor){
        clearValues("다른 센서용 코드가 실행 중입니다. 선택한 코드를 업로드하세요.");
      }else if(data.type === "error"){
        clearValues(data.message === "SENSOR_NOT_FOUND" ? "센서를 찾지 못했습니다. 전원·SDA·SCL 연결을 확인하세요." : "센서 읽기에 실패했습니다. 배선과 전원을 확인하세요.");
      }else if(!lastSelectedSampleAt) ui.SensorStatus.textContent = "예제 코드 실행 중 · 센서 응답 대기";
      syncButtons();
    }
  });
  async function loadCode(){
    const epoch = ++lessonEpoch, sensor = state.sensor;
    lesson = null; ui.CodeDownload.hidden = true; ui.CodeRetry.hidden = true;
    ui.CodeStatus.textContent = "예제 코드를 준비하고 있습니다…"; syncButtons();
    try{
      const result = await uploader.loadLesson(sensor);
      if(epoch !== lessonEpoch || sensor !== state.sensor) return;
      lesson = result; ui.CodeStatus.textContent = "예제 준비 완료 · 코드를 업로드할 수 있습니다.";
      ui.CodeDownload.href = result.sourceUrl; ui.CodeDownload.download = sensor + ".ino"; ui.CodeDownload.hidden = false;
    }catch(error){
      if(epoch !== lessonEpoch) return;
      ui.CodeStatus.textContent = uploader.explain(error); ui.CodeRetry.hidden = false;
    }finally{ if(epoch === lessonEpoch) syncButtons(); }
  }
  const staleTimer = setInterval(()=>{
    if(lastSelectedSampleAt && Date.now() - lastSelectedSampleAt > 3000) clearValues("센서 데이터 수신이 멈췄습니다. 배선과 USB 연결을 확인하세요.");
    syncButtons(); updateRocketStatus();
  }, 1000);
  const dispose = ()=>{ clearInterval(staleTimer); rocket.dispose(); connection.dispose().catch(()=>{}); };
  if(scope) scope.add(dispose);
  window.addEventListener("pagehide", dispose, {once:true});

  function showStep(step, focus = true){
    const entering = state.step !== step;
    if(state.step === "rocket" && step !== "rocket") rocket.stop();
    state.step = step; setup.hidden = step === "welcome";
    progress.hidden = step === "welcome" || step === "rocket";
    root.classList.toggle("is-rocket", step === "rocket"); root.dataset.step = step;
    root.querySelectorAll("[data-bootcamp-step]").forEach(section=>{ section.hidden = section.dataset.bootcampStep !== step; });
    const group = groupFor[step];
    root.querySelectorAll("[data-bootcamp-progress]").forEach(item=>{
      const current = item.dataset.bootcampProgress === group;
      item.classList.toggle("is-complete", groups.indexOf(item.dataset.bootcampProgress) < groups.indexOf(group));
      if(current) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current");
    });
    root.querySelectorAll("[data-bootcamp-sensor-name]").forEach(node=>{ node.textContent = state.sensor; });
    if(entering && step === "connect") connection.start().catch(error=>log(uploader.explain(error)));
    if(entering && step === "code") loadCode();
    if(entering && step === "data") resetGate();
    if(entering && step === "rocket") rocket.start().catch(()=>{ ui.RocketMessage.hidden = false; ui.RocketMessage.textContent = "3D 모델을 불러오지 못했습니다. 센서 데이터 화면으로 돌아가 확인해주세요."; });
    syncButtons(); updateRocketStatus();
    if(focus){ root.querySelector('[data-bootcamp-step="' + step + '"] h1').focus(); window.scrollTo(0, 0); }
  }
  listen("change", event=>{
    if(connection.busy) return;
    const target = event.target;
    if(target.name === "bootcampSensor"){
      state.sensor = target.value; state.uploadedSensor = ""; lesson = null; lessonEpoch++; autoAdvance = false;
      rocket.reset(); clearValues("업로드 후 센서 데이터가 자동으로 표시됩니다.");
      connection.notify({phase:connection.state.connected ? "connected" : "idle", percent:0,
        message:connection.state.connected ? "센서 선택이 바뀌었습니다. 새 예제 코드를 업로드하세요." : "Nano를 USB로 연결해주세요."});
    }else if(target.name === "bootcampMcu") state.mcu = target.value;
    else return;
    showStep(state.step, false);
  });
  listen("click", event=>{
    const button = event.target.closest("[data-bootcamp-action]");
    if(!button || button.disabled || connection.busy) return;
    const action = button.dataset.bootcampAction;
    if(action === "pick-port") connection.connect(true).catch(error=>log(uploader.explain(error)));
    else if(action === "flash"){
      if(!lesson || lesson.sensor !== state.sensor) return;
      const sensor = state.sensor; state.uploadedSensor = ""; autoAdvance = false;
      rocket.reset(); clearValues("코드 업로드 중 · 완료 후 자동으로 연결합니다.");
      connection.upload(lesson).then(ok=>{
        if(ok && sensor === state.sensor){ state.uploadedSensor = sensor; autoAdvance = true; showStep("data"); }
      }).catch(error=>log(uploader.explain(error)));
    }else if(action === "gyro-zero"){
      ui.RocketNote.textContent = rocket.zero() ? "현재 자세를 영점으로 설정했습니다." : "센서 데이터 수신 후 다시 실행해주세요.";
      updateRocketStatus();
    }else if(action === "reload-code") loadCode();
    else if(action === "restart"){
      state.sensor = state.mcu = state.uploadedSensor = ""; lesson = null; lessonEpoch++; autoAdvance = false;
      connection.enabled = false; connection.disconnect().catch(()=>{}); rocket.reset();
      logLines.length = 0; ui.UploadLog.textContent = "코드 업로드를 기다립니다.";
      clearValues("업로드 후 센서 데이터가 자동으로 표시됩니다.");
      root.querySelectorAll('input[type="radio"]').forEach(input=>{ input.checked = false; }); showStep("welcome");
    }else{
      const next = action === "start" ? "sensor" : action;
      if(!["welcome", ...steps].includes(next)) return;
      if(next === "mcu" && !state.sensor) return;
      if(["pins","connect","code","data","rocket"].includes(next) && (!state.sensor || !state.mcu)) return;
      if(next === "data" && state.uploadedSensor !== state.sensor) return;
      if(next === "rocket" && (!gate.ready || !connection.state.connected || !rocket.fresh())) return;
      if(next === "data") autoAdvance = false;
      showStep(next);
    }
  });
  root.hidden = false;
  const splash = document.getElementById("splash"); if(splash) splash.remove();
  showStep("welcome", false);
  window.__flashBoot.jsReady = true; window.__flashBoot.phase = "app_ready"; bootBeacon("app_ready", "bootcamp");
}
