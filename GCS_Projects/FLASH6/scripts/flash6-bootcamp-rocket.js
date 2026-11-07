/* Reuse the complete FLASH6 camera dashboard, not just its expanded canvas. */
window.Flash6BootcampRocket = class{
  constructor(mount, onStatus){
    this.view = document.getElementById("cameraView");
    this.viewport = document.getElementById("gyro3dViewport");
    this.canvas = document.getElementById("gyroGlPreview");
    this.hud = document.getElementById("gyro3dExpandedHud");
    this.home = this.viewport.parentNode; this.homeNext = this.viewport.nextSibling;
    this.viewHome = this.view.parentNode; this.viewNext = this.view.nextSibling;
    this.originalClass = this.viewport.className; this.viewClass = this.view.className;
    this.viewport.dataset.bootcampLesson = "1";
    this.view.classList.remove("hidden"); this.view.classList.add("bootcamp-camera-lesson");
    mount.appendChild(this.view);
    document.getElementById("cameraGyroPlusMount").appendChild(this.viewport);
    this.viewport.classList.add("is-camera-preview-mounted", "is-camera-gyro-plus-mounted");
    this.running = false; this.initialized = false; this.frame = 0;
    this.lastSampleAt = 0; this.lastFrameAt = 0; this.modelReady = false; this.sample = null;
    this.buffers = Object.fromEntries(["ax","ay","az","gx","gy","gz"].map(key=>[key,[]]));
    this.onStatus = onStatus; this.configureDashboard();
    ["bootcampRocketMessage", "bootcampGyroZero", "bootcampRocketNote"].forEach(id=>this.view.appendChild(document.getElementById(id)));
    this.onResize = ()=>{ if(this.running){ if(gyroGl) resizeGyroGl(); this.drawCharts(); } };
    window.addEventListener("resize", this.onResize);
    if(typeof ResizeObserver !== "undefined"){
      this.observer = new ResizeObserver(this.onResize); this.observer.observe(this.viewport);
    }
  }
  configureDashboard(){
    const stage1 = document.getElementById("cameraStage1Status");
    stage1.querySelector(".camera-system-stage-name strong").textContent = "ARDUINO NANO";
    const labels = ["ROLL", "PITCH", "YAW"];
    const ids = ["bootcampRocketRoll", "bootcampRocketPitch", "bootcampRocketYaw"];
    const metrics = stage1.querySelectorAll(".camera-system-stage-metrics > span");
    ids.forEach((id,i)=>metrics[i].replaceChildren(document.createTextNode(labels[i] + " "), document.getElementById(id)));
    const stage2 = document.getElementById("cameraStage2Status");
    const sensorName = stage2.querySelector(".camera-system-stage-name strong");
    sensorName.textContent = "SENSOR"; sensorName.setAttribute("data-bootcamp-sensor-name", "");
    const second = stage2.querySelectorAll(".camera-system-stage-metrics > span");
    this.sensorHeader = [];
    ["AX", "AY", "AZ", "G", "GYRO"].forEach((label,i)=>{
      const b = second[i].querySelector("b"); second[i].replaceChildren(document.createTextNode(label + " "), b);
      b.textContent = "—"; this.sensorHeader.push(b);
    });
    const center = this.view.querySelector(".camera-system-center");
    center.removeAttribute("aria-hidden");
    center.appendChild(document.getElementById("bootcampRocketClock"));
    document.getElementById("bootcampRocketStatusExtras").remove();
    this.view.querySelector("#cameraHudFlightGauges .camera-gauge--alt .camera-gauge-label").textContent = "ROLL";
    this.view.querySelector("#cameraHudFlightGauges .camera-gauge--alt .camera-gauge-unit").textContent = "deg";
    this.view.querySelector("#cameraHudFlightGauges .camera-gauge--speed .camera-gauge-label").textContent = "PITCH";
    this.view.querySelector("#cameraHudFlightGauges .camera-gauge--speed .camera-gauge-unit").textContent = "deg";
    document.getElementById("cameraHudSecondarySecondaryLabel").textContent = "ANGULAR RATE";
    document.getElementById("cameraHudSecondarySecondaryUnit").textContent = "deg/s";
    const panel = this.view.querySelector(".camera-map-panel");
    panel.setAttribute("aria-label", "실시간 6축 센서 데이터");
    panel.querySelector(".camera-map-heading strong").textContent = "SENSOR DATA";
    panel.querySelector(".camera-map-heading span").textContent = "6-AXIS IMU";
    const map = document.getElementById("cameraMapMount"); map.classList.add("bootcamp-axis-readings");
    this.axisReadings = {};
    ["ax","ay","az","gx","gy","gz"].forEach(key=>{
      const item = document.createElement("div"), name = document.createElement("span"), value = document.createElement("b"), unit = document.createElement("small");
      name.textContent = key.toUpperCase(); value.textContent = "—"; unit.textContent = key[0] === "a" ? "g" : "°/s";
      item.append(name, value, unit); map.appendChild(item); this.axisReadings[key] = value;
    });
    this.charts = [
      {canvas:document.getElementById("cameraAltitudeChart"), keys:["ax","ay","az"], name:"ACCELERATION"},
      {canvas:document.getElementById("cameraDynamicsChart"), keys:["gx","gy","gz"], name:"GYROSCOPE"}
    ];
    this.charts.forEach(chart=>{
      const container = chart.canvas.closest(".camera-telemetry-chart");
      container.setAttribute("aria-label", chart.name + " XYZ 실시간 차트");
      container.querySelector(".camera-chart-heading").textContent = chart.name;
      const legend = container.querySelector(".camera-chart-legend"); legend.replaceChildren(); chart.values = [];
      chart.keys.forEach((key,i)=>{
        const item = document.createElement("span");
        item.className = "camera-chart-legend-item " + ["camera-chart-legend-item--alt","camera-chart-legend-item--speed","camera-chart-legend-item--g"][i];
        const b = document.createElement("b"); b.textContent = "—";
        item.append(document.createElement("i"), document.createTextNode(key.slice(1).toUpperCase() + " "), b);
        legend.appendChild(item); chart.values.push(b);
      });
    });
    this.gauges = ["cameraHudAltitudeGauge","cameraHudSpeedGauge","cameraHudGforceGauge","cameraHudVerticalSpeedGauge"].map(id=>document.getElementById(id));
    this.bars = ["cameraHudAltitudeProg","cameraHudSpeedProg","cameraHudGforceProg","cameraHudVerticalSpeedProg"].map(id=>document.getElementById(id));
  }
  consume(data){
    this.lastSampleAt = Date.now(); this.sample = data;
    updateGyroAttitudeEstimate(data.ax, data.ay, data.az, data.gx, data.gy, data.gz, this.lastSampleAt);
    Object.keys(this.buffers).forEach(key=>{
      this.buffers[key].push(data[key]); if(this.buffers[key].length > 200) this.buffers[key].shift();
    });
    if(this.running && this.lastSampleAt - (this.lastDataPaintAt || 0) >= 100){
      this.lastDataPaintAt = this.lastSampleAt; this.paintDashboard(true); this.drawCharts();
    }
  }
  paintDashboard(fresh){
    const data = this.sample, attitude = this.attitude();
    Object.entries(this.axisReadings).forEach(([key,node])=>{ node.textContent = fresh && data ? data[key].toFixed(2) : "—"; });
    const g = data ? Math.hypot(data.ax,data.ay,data.az) : 0;
    const rate = data ? Math.hypot(data.gx,data.gy,data.gz) : 0;
    [attitude.roll,attitude.pitch,g,rate].forEach((value,i)=>{
      this.gauges[i].textContent = fresh && data ? value.toFixed(i === 2 ? 2 : 1) : "—";
      this.bars[i].style.width = fresh && data ? Math.min(100,Math.abs(value) / [180,90,2,250][i] * 100) + "%" : "0%";
    });
    [data && data.ax,data && data.ay,data && data.az,g,rate].forEach((value,i)=>{
      this.sensorHeader[i].textContent = fresh && data ? value.toFixed(2) : "—";
    });
    this.charts.forEach(chart=>chart.values.forEach((node,i)=>{ node.textContent = fresh && data ? data[chart.keys[i]].toFixed(2) : "—"; }));
  }
  drawCharts(){
    if(!this.running) return;
    this.charts.forEach(chart=>drawCameraTelemetryChart(chart.canvas, chart.keys.map((key,i)=>({source:this.buffers[key], color:["rgba(255,255,255,.94)","rgba(174,180,188,.72)","rgba(98,178,235,.75)"][i],lineWidth:1.1}))));
  }
  updateStatus(connected, fresh, hz){
    document.getElementById("cameraStage1Status").classList.toggle("is-online",fresh);
    document.getElementById("cameraStage2Status").classList.toggle("is-online",fresh);
    document.getElementById("cameraStage1Rate").textContent = fresh ? hz.toFixed(1) : "—";
    document.getElementById("cameraStage1State").textContent = fresh ? "STREAMING" : connected ? "WAITING" : "DISCONNECTED";
    document.getElementById("cameraStage2Link").textContent = fresh ? "LIVE" : "WAIT";
    this.paintDashboard(fresh);
  }
  fresh(){ return this.lastSampleAt > 0 && Date.now() - this.lastSampleAt < 3000 && gyroAttitudeReady; }
  attitude(){ return {roll:getGyroDisplayRollDeg(), pitch:getGyroDisplayPitchDeg(), yaw:getGyroDisplayYawDeg()}; }
  zero(){ if(!this.fresh()) return false; return applyGyroZeroReference(); }
  reset(){
    this.lastSampleAt = 0; this.sample = null; Object.values(this.buffers).forEach(buffer=>{ buffer.length = 0; });
    resetGyroAttitudeState(); resetGyroCameraPose(true); this.paintDashboard(false); this.drawCharts();
  }
  async start(){
    this.running = true;
    document.body.classList.add("camera-view-active", "camera-gyro-plus-layout");
    this.hud.setAttribute("aria-hidden", "true");
    if(!this.initialized){
      el.gyro3dViewport = this.viewport; el.gyroGl = this.canvas;
      try{ initGyroGl(); }
      catch(error){ this.onStatus("3D 초기화에 실패했습니다. 센서 데이터 화면으로 돌아가 확인해주세요."); return; }
      if(!gyroGl){ this.onStatus("WebGL을 사용할 수 없습니다. 브라우저의 하드웨어 가속을 확인해주세요."); return; }
      this.initialized = true; activateCameraGyroPlusViewport();
      this.onStatus("실제 로켓 모델을 불러오는 중…");
      const mesh = await requestGyroRocketMesh();
      if(!mesh){ this.onStatus("로켓 모델을 불러오지 못했습니다. 페이지를 새로고침해주세요."); return; }
      this.modelReady = true; this.viewport.classList.add("is-model-ready"); this.onStatus("");
    }
    this.paintDashboard(this.fresh()); this.drawCharts();
    if(!this.modelReady || !this.running || this.frame) return;
    const render = now=>{
      this.frame = 0; if(!this.running) return;
      if(now - this.lastFrameAt >= 32){ this.lastFrameAt = now; renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg); }
      this.frame = requestAnimationFrame(render);
    };
    resizeGyroGl(); this.frame = requestAnimationFrame(render);
  }
  stop(){
    this.running = false; document.body.classList.remove("camera-view-active", "camera-gyro-plus-layout");
    if(this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
  }
  dispose(){
    this.stop(); window.removeEventListener("resize", this.onResize); if(this.observer) this.observer.disconnect();
    this.viewport.className = this.originalClass; delete this.viewport.dataset.bootcampLesson;
    this.home.insertBefore(this.viewport,this.homeNext); this.view.className = this.viewClass;
    this.viewHome.insertBefore(this.view,this.viewNext);
  }
};
