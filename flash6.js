    // =====================
    // 상태/버퍼
    // =====================

    let logLines = [];
    let logData = [];
    let eventLog = [];
    let thrustBaseHistory = [];
    let pressureBaseHistory = [];
    let accelMagHistory = [];
    let accelXHistory = [];
    let accelYHistory = [];
    let accelZHistory = [];
    let chartTimeHistory = [];
    let sampleHistory = [];
    const SAMPLE_HISTORY_MAX = 10000;
    const EVENT_LOG_MAX = 5000;
    const RAW_LOG_MAX   = 20000;

    const IGN_THRUST_THRESHOLD = 2.0;  // kgf
    const IGN_PRE_WINDOW_MS    = 1000;
    const IGN_POST_WINDOW_MS   = 1000;

    let prevStForIgn = 0;
    let ignitionAnalysis = {hasData:false,ignStartMs:null,thresholdMs:null,lastAboveMs:null,windowStartMs:null,windowEndMs:null,delaySec:null,durationSec:null,endNotified:false};
    let selectedMotorName = "";
    let pendingMissionApply = null;
    const motorSpecs = {
      "frontier2025": {
        name: "frontier2025",
        diameterMm: 60,
        lengthMm: 250,
        ignDelaySec: 1.8,
        grainMassG: 400,
        totalMassG: 1430,
        vendor: "ALTIS"
      },
      "frontier2026 stg2 cnc": {
        name: "frontier2026 stg2 cnc",
        diameterMm: 48,
        lengthMm: 250,
        ignDelaySec: 1.8,
        grainMassG: 200,
        totalMassG: 1000,
        vendor: "ALTIS"
      },
      "frontier2026 stg2 pvc": {
        name: "frontier2026 stg2 pvc",
        diameterMm: 48,
        lengthMm: 250,
        ignDelaySec: 1.8,
        grainMassG: 200,
        totalMassG: 542,
        vendor: "ALTIS"
      },
      "QUAIL1 motor": {
        name: "QUAIL1 motor",
        diameterMm: 50,
        lengthMm: 255,
        ignDelaySec: 1.8,
        grainMassG: 400,
        totalMassG: 1500,
        vendor: "HANWOOL"
      }
    };
    function buildMotorPresetInfo(){
      const buttons = document.querySelectorAll(".mission-preset-btn[data-mission]");
      buttons.forEach(btn=>{
        if(btn.querySelector(".mission-preset-info")) return;
        const name = (btn.getAttribute("data-mission") || "").trim();
        if(!name) return;
        const spec = motorSpecs[name] || null;
        btn.classList.add("has-info");
        const photo = btn.querySelector(".mission-preset-photo");
        if(photo && !photo.querySelector("img")){
          const img = document.createElement("img");
          img.src = "img/flash_stb.svg";
          img.alt = name;
          photo.textContent = "";
          photo.appendChild(img);
        }

        const info = document.createElement("div");
        info.className = "mission-preset-info";
        const addLine = (label, value, valueClass, lineClass)=>{
          if(value == null || value === "") return;
          const line = document.createElement("div");
          line.className = "mission-info-line";
          if(lineClass) line.classList.add(lineClass);
          const key = document.createElement("span");
          key.className = "mission-info-label";
          key.textContent = label;
          const val = document.createElement("span");
          val.className = "mission-info-value";
          if(valueClass) val.classList.add(valueClass);
          val.textContent = value;
          line.appendChild(key);
          line.appendChild(val);
          info.appendChild(line);
        };

        if(name === "motor-support"){
          const msg = document.createElement("div");
          msg.className = "mission-info-message";
          msg.textContent = "모터 추가는 ybb1833@naver.com 으로 문의해주세요.";
          info.appendChild(msg);
          btn.appendChild(info);
          return;
        }
        if(name === "no-motor"){
          const msg = document.createElement("div");
          msg.className = "mission-info-message";
          msg.textContent = "모터의 메타데이터 없이 진행할수 있습니다.";
          info.appendChild(msg);
          btn.appendChild(info);
          return;
        }

          if(!spec){
            btn.classList.add("no-spec");
            if(!btn.querySelector(".mission-preset-sub")){
              const sub = document.createElement("div");
              sub.className = "mission-preset-sub";
              sub.textContent = "no data";
              const nameEl = btn.querySelector(".mission-preset-name");
              if(nameEl && nameEl.parentNode){
              nameEl.parentNode.insertBefore(sub, nameEl);
              }else{
                btn.appendChild(sub);
              }
            }
        }else{
          btn.classList.add("has-spec");
        }
        if(spec && spec.vendor){
          const existingVendor = btn.querySelector(".mission-preset-vendor");
          if(!existingVendor){
            const vendorEl = document.createElement("div");
            vendorEl.className = "mission-preset-vendor";
            vendorEl.textContent = spec.vendor;
            const nameEl = btn.querySelector(".mission-preset-name");
            if(nameEl && nameEl.parentNode){
              nameEl.parentNode.insertBefore(vendorEl, nameEl);
            }else{
              btn.appendChild(vendorEl);
            }
          }
        }
        addLine("MOTOR", name);
        if(spec){
          addLine("DIA", (spec.diameterMm != null) ? (spec.diameterMm + " mm") : "", null, "is-divider");
          addLine("LEN", (spec.lengthMm != null) ? (spec.lengthMm + " mm") : "");
          addLine("IGN", (spec.ignDelaySec != null) ? (spec.ignDelaySec + " s") : "");
          addLine("GRAIN", (spec.grainMassG != null) ? (spec.grainMassG + " g") : "");
          addLine("TOTAL", (spec.totalMassG != null) ? (spec.totalMassG + " g") : "");
        }else{
          addLine("INFO", "NO DATA");
        }
        btn.appendChild(info);
      });
    }

    const MAX_POINTS         = 300;
    const CHART_WINDOW_MS_DEFAULT = 25000;
    const CHART_WINDOW_MS_MIN = 5000;
    const CHART_WINDOW_MS_MAX = 120000;
    const RAD_TO_DEG = 57.2957795;
    const DEG_TO_RAD = 0.0174532925;

    // ✅ 너무 빡센 폴링(30ms)은 ESP 쪽 응답 흔들림(간헐 타임아웃/큐 적체)을 만들 수 있어서 완화
    const POLL_INTERVAL      = 80;

    const UI_SAMPLE_SKIP     = 3;
    const CHART_MIN_INTERVAL = 50;

    let lastChartRedraw = 0;
    let sampleCounter = 0;
    let isUpdating = false;
    let chartView = { startMs: null, windowMs: CHART_WINDOW_MS_DEFAULT };
    let autoScrollChart = true;
    let disconnectedLogged = false;
    let lastStatusCode = -1;
    let currentSt = 0;
    let lastSnapHzUiMs = 0;
    let rxWindowStartMs = 0;
    let rxWindowCount = 0;
    let rxHzWindow = 0;
    let gyroLastUiMs = 0;
    let gyroYawDeg = 0;
    let gyroPitchDeg = 0;
    let gyroRollDeg = 0;
    let gyroGl = null;
    const DATA_SOURCE_LIVE = "live";
    const DATA_SOURCE_REPLAY = "replay";
    let activeDataSource = DATA_SOURCE_LIVE;
    let replayUiActive = false;
    let replaySourceActive = false;
    const replayState = {
      samples: [],
      index: 0,
      lastIndex: -1,
      timer: null,
      playing: false,
      speed: 1,
      fileName: ""
    };
    let logDataRevision = 0;
    let reportExportedRevision = 0;
    let reportExportedOnce = false;
    let pendingExportLeaveAction = null;

    // =====================
    // Alarm policy
    // =====================
    const ALERT_LEVEL = Object.freeze({
      INFO: "info",
      NOTICE: "notice",
      WARNING: "warning",
      CRITICAL: "critical"
    });

    const ALARM_DEFS = Object.freeze({
      WS_DISCONNECTED: {
        level: ALERT_LEVEL.WARNING,
        textKey: "alarmWsDisconnected",
        clearKey: "alarmWsRecovered",
        sticky: true,
        rateLimitMs: 8000
      },
      DATA_TIMEOUT: {
        level: ALERT_LEVEL.CRITICAL,
        textKey: "alarmDataTimeout",
        clearKey: "alarmDataTimeoutClear",
        sticky: true,
        rateLimitMs: 12000
      },
      RX_HZ_DROP: {
        level: ALERT_LEVEL.WARNING,
        textKey: "alarmRxHzDrop",
        clearKey: "alarmRxHzRecovered",
        sticky: true,
        rateLimitMs: 10000
      },
      RELAY_LOCKOUT: {
        level: ALERT_LEVEL.CRITICAL,
        textKey: "alarmRelayLockout",
        sticky: true,
        rateLimitMs: 15000
      },
      REPLAY_FORMAT: {
        level: ALERT_LEVEL.WARNING,
        textKey: "alarmReplayFormat",
        rateLimitMs: 3000
      },
      REPLAY_AUTOSTOP: {
        level: ALERT_LEVEL.NOTICE,
        textKey: "alarmReplayAutoStop",
        rateLimitMs: 1500
      },
      WS_BACKPRESSURE: {
        level: ALERT_LEVEL.WARNING,
        textKey: "alarmWsBackpressure",
        rateLimitMs: 15000
      },
      INTERNAL_EXCEPTION: {
        level: ALERT_LEVEL.WARNING,
        textKey: "alarmInternalException",
        rateLimitMs: 10000
      }
    });
    const alarmState = {};
    const silentExceptionState = {};

    function mat4Identity(){
      return [1,0,0,0,
              0,1,0,0,
              0,0,1,0,
              0,0,0,1];
    }
    function mat4Mul(a,b){
      const o = new Array(16);
      for(let i=0;i<4;i++){
        const ai0=a[i], ai1=a[i+4], ai2=a[i+8], ai3=a[i+12];
        o[i]   = ai0*b[0] + ai1*b[1] + ai2*b[2] + ai3*b[3];
        o[i+4] = ai0*b[4] + ai1*b[5] + ai2*b[6] + ai3*b[7];
        o[i+8] = ai0*b[8] + ai1*b[9] + ai2*b[10]+ ai3*b[11];
        o[i+12]= ai0*b[12]+ ai1*b[13]+ ai2*b[14]+ ai3*b[15];
      }
      return o;
    }
    function mat4Perspective(fov, aspect, near, far){
      const f = 1 / Math.tan(fov/2);
      const nf = 1 / (near - far);
      return [
        f/aspect,0,0,0,
        0,f,0,0,
        0,0,(far+near)*nf,-1,
        0,0,(2*far*near)*nf,0
      ];
    }
    function mat4LookAt(eye, center, up){
      const zx = eye[0]-center[0];
      const zy = eye[1]-center[1];
      const zz = eye[2]-center[2];
      let zlen = Math.hypot(zx, zy, zz) || 1;
      const z0 = zx/zlen, z1 = zy/zlen, z2 = zz/zlen;
      const xx = up[1]*z2 - up[2]*z1;
      const xy = up[2]*z0 - up[0]*z2;
      const xz = up[0]*z1 - up[1]*z0;
      let xlen = Math.hypot(xx, xy, xz) || 1;
      const x0 = xx/xlen, x1 = xy/xlen, x2 = xz/xlen;
      const y0 = z1*x2 - z2*x1;
      const y1 = z2*x0 - z0*x2;
      const y2 = z0*x1 - z1*x0;
      return [
        x0,y0,z0,0,
        x1,y1,z1,0,
        x2,y2,z2,0,
        -(x0*eye[0]+x1*eye[1]+x2*eye[2]),
        -(y0*eye[0]+y1*eye[1]+y2*eye[2]),
        -(z0*eye[0]+z1*eye[1]+z2*eye[2]),
        1
      ];
    }
    function mat4RotateX(a){
      const c = Math.cos(a), s = Math.sin(a);
      return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];
    }
    function mat4RotateY(a){
      const c = Math.cos(a), s = Math.sin(a);
      return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
    }
    function mat4RotateZ(a){
      const c = Math.cos(a), s = Math.sin(a);
      return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
    }

    function buildGyroGeometry(){
      const pos = [];
      const col = [];
      const addLine = (x1,y1,z1,x2,y2,z2,r,g,b)=>{
        pos.push(x1,y1,z1,x2,y2,z2);
        for(let i=0;i<2;i++){ col.push(r,g,b,1); }
      };

      const dashColor = [0.6,0.6,0.6];

      addLine(0,0,0, 0.9,0,0, ...dashColor);
      addLine(0,0,0, 0,0.9,0, ...dashColor);
      addLine(0,0,0, 0,0,0.9, ...dashColor);

      const gridCount = pos.length / 3;

      const radius = 0.2;
      const height = 1.0;
      const seg = 14;
      for(let i=0;i<seg;i++){
        const a0 = (i/seg) * Math.PI * 2;
        const a1 = ((i+1)/seg) * Math.PI * 2;
        const x0 = Math.cos(a0) * radius;
        const z0 = Math.sin(a0) * radius;
        const x1 = Math.cos(a1) * radius;
        const z1 = Math.sin(a1) * radius;
        addLine(x0,-height/2,z0, x0,height/2,z0, 0.3,0.3,0.35);
        addLine(x0,height/2,z0, x1,height/2,z1, 0.4,0.4,0.45);
        addLine(x0,-height/2,z0, x1,-height/2,z1, 0.4,0.4,0.45);
      }

      const noseTop = [0, height/2 + 0.25, 0];
      for(let i=0;i<seg;i++){
        const a0 = (i/seg) * Math.PI * 2;
        const x0 = Math.cos(a0) * radius * 0.9;
        const z0 = Math.sin(a0) * radius * 0.9;
        addLine(x0,height/2,z0, noseTop[0], noseTop[1], noseTop[2], 0.6,0.6,0.65);
      }

      const finY = -height/2 + 0.05;
      const finLen = 0.28;
      addLine(radius, finY, 0, radius + finLen, finY + 0.12, 0, 0.12,0.35,0.85);
      addLine(-radius, finY, 0, -radius - finLen, finY + 0.12, 0, 0.12,0.35,0.85);
      addLine(0, finY, radius, 0, finY + 0.12, radius + finLen, 0.12,0.35,0.85);
      addLine(0, finY, -radius, 0, finY + 0.12, -radius - finLen, 0.12,0.35,0.85);

      addLine(0,0,0, 0.6,0,0, 0.93,0.27,0.27);
      addLine(0,0,0, 0,0.6,0, 0.13,0.77,0.35);
      addLine(0,0,0, 0,0,0.6, 0.23,0.51,0.96);

      const bodyCount = pos.length / 3 - gridCount;
      return {pos, col, gridCount, bodyCount};
    }

    function initGyroGl(){
      if(!el.gyroGl) return;
      const gl = el.gyroGl.getContext("webgl");
      if(!gl) return;

      const vs = `
        attribute vec3 aPos;
        attribute vec4 aCol;
        uniform mat4 uMvp;
        varying vec4 vCol;
        void main(){
          gl_Position = uMvp * vec4(aPos,1.0);
          vCol = aCol;
        }`;
      const fs = `
        precision mediump float;
        varying vec4 vCol;
        void main(){
          gl_FragColor = vCol;
        }`;
      const compile = (type, src)=>{
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        return sh;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      gl.useProgram(prog);

      const geom = buildGyroGeometry();
      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geom.pos), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

      const colBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geom.col), gl.STATIC_DRAW);
      const aCol = gl.getAttribLocation(prog, "aCol");
      gl.enableVertexAttribArray(aCol);
      gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 0, 0);

      gyroGl = {
        gl,
        prog,
        uMvp: gl.getUniformLocation(prog, "uMvp"),
        gridCount: geom.gridCount,
        bodyCount: geom.bodyCount,
        view: mat4LookAt([1.6,1.3,2.2],[0,0,0],[0,1,0]),
        proj: null,
        width: 0,
        height: 0
      };
      resizeGyroGl();
      renderGyroGl(0,0,0);
    }

    function resizeGyroGl(){
      if(!gyroGl || !el.gyroGl) return;
      const dpr = window.devicePixelRatio || 1;
      let w = Math.round(el.gyroGl.clientWidth * dpr);
      let h = Math.round(el.gyroGl.clientHeight * dpr);
      if((w <= 0 || h <= 0) && el.gyroGlPreview){
        const pw = Math.round(el.gyroGlPreview.clientWidth * dpr);
        const ph = Math.round(el.gyroGlPreview.clientHeight * dpr);
        if(pw > 0 && ph > 0){
          w = pw;
          h = ph;
        }
      }
      w = Math.max(1, w);
      h = Math.max(1, h);
      if(gyroGl.width === w && gyroGl.height === h) return;
      gyroGl.width = w;
      gyroGl.height = h;
      el.gyroGl.width = w;
      el.gyroGl.height = h;
      gyroGl.proj = mat4Perspective(45 * DEG_TO_RAD, w / h, 0.1, 10);
      gyroGl.gl.viewport(0,0,w,h);
    }

    function renderGyroGl(pitchDeg, yawDeg, rollDeg){
      if(!gyroGl) return;
      const gl = gyroGl.gl;
      resizeGyroGl();
      gl.clearColor(0.97,0.98,0.99,1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.lineWidth(2);

      const identity = mat4Identity();
      let mvp = mat4Mul(gyroGl.proj, mat4Mul(gyroGl.view, identity));
      gl.uniformMatrix4fv(gyroGl.uMvp, false, new Float32Array(mvp));
      gl.drawArrays(gl.LINES, 0, gyroGl.gridCount);

      const rx = mat4RotateX(pitchDeg * DEG_TO_RAD);
      const ry = mat4RotateY(yawDeg * DEG_TO_RAD);
      const rz = mat4RotateZ(rollDeg * DEG_TO_RAD);
      const model = mat4Mul(rz, mat4Mul(ry, rx));
      mvp = mat4Mul(gyroGl.proj, mat4Mul(gyroGl.view, model));
      gl.uniformMatrix4fv(gyroGl.uMvp, false, new Float32Array(mvp));
      gl.drawArrays(gl.LINES, gyroGl.gridCount, gyroGl.bodyCount);
    }

    function renderGyroPreview(){
      if(!el.gyroGlPreview || !el.gyroGl) return;
      if(el.gyroGlPreview === el.gyroGl) return;
      if(!document.documentElement.classList.contains("mode-flight")) return;
      if(!document.documentElement.classList.contains("preview-3d")) return;
      const ctx = el.gyroGlPreview.getContext("2d");
      if(!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(el.gyroGlPreview.clientWidth * dpr));
      const h = Math.max(1, Math.round(el.gyroGlPreview.clientHeight * dpr));
      if(el.gyroGlPreview.width !== w || el.gyroGlPreview.height !== h){
        el.gyroGlPreview.width = w;
        el.gyroGlPreview.height = h;
      }
      ctx.clearRect(0,0,w,h);
      ctx.drawImage(el.gyroGl, 0, 0, w, h);
    }

    function renderNavBallPreview(pitchDeg, yawDeg, rollDeg){
      if(!el.navBallPreview) return;
      if(el.navBallPreview === el.navBall) return;
      if(!document.documentElement.classList.contains("mode-flight")) return;
      if(!document.documentElement.classList.contains("preview-navball")) return;
      renderNavBallToCanvas(el.navBallPreview, pitchDeg, yawDeg, rollDeg);
    }

    function renderNavBall(pitchDeg, yawDeg, rollDeg){
      if(!el.navBall) return;
      renderNavBallToCanvas(el.navBall, pitchDeg, yawDeg, rollDeg);
    }

    function renderNavBallToCanvas(canvas, pitchDeg, yawDeg, rollDeg){
      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const { w: width, h: height, ctx } = size;
      ctx.clearRect(0,0,width,height);
      const cx = width / 2;
      const cy = height / 2;
      const half = Math.max(40, Math.min(width, height) / 2 - 6);
      const radius = half;

      ctx.save();
      ctx.translate(cx, cy);
      const r = 10;
      ctx.beginPath();
      ctx.moveTo(-half + r, -half);
      ctx.lineTo(half - r, -half);
      ctx.quadraticCurveTo(half, -half, half, -half + r);
      ctx.lineTo(half, half - r);
      ctx.quadraticCurveTo(half, half, half - r, half);
      ctx.lineTo(-half + r, half);
      ctx.quadraticCurveTo(-half, half, -half, half - r);
      ctx.lineTo(-half, -half + r);
      ctx.quadraticCurveTo(-half, -half, -half + r, -half);
      ctx.closePath();
      ctx.clip();

      const pitchClamped = Math.max(-45, Math.min(45, pitchDeg || 0));
      const pitchOffset = (pitchClamped / 45) * (radius * 0.65);
      const rollRad = -(rollDeg || 0) * DEG_TO_RAD;

      ctx.save();
      ctx.rotate(rollRad);
      ctx.translate(0, pitchOffset);

      const skyGrad = ctx.createLinearGradient(0, -radius, 0, 0);
      skyGrad.addColorStop(0, "#5ee7ff");
      skyGrad.addColorStop(1, "#1e40ff");
      const groundGrad = ctx.createLinearGradient(0, 0, 0, radius);
      groundGrad.addColorStop(0, "#fb923c");
      groundGrad.addColorStop(1, "#c2410c");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-radius * 2, -radius * 2, radius * 4, radius * 2);
      ctx.fillStyle = groundGrad;
      ctx.fillRect(-radius * 2, 0, radius * 4, radius * 2);

      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-radius * 1.2, 0);
      ctx.lineTo(radius * 1.2, 0);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1;
      for(let p = -30; p <= 30; p += 10){
        if(p === 0) continue;
        const y = -(p / 45) * (radius * 0.65);
        const w = (p % 20 === 0) ? radius * 0.7 : radius * 0.45;
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);
      const ringGrad = ctx.createLinearGradient(0, -radius, 0, radius);
      ringGrad.addColorStop(0, "rgba(14,116,144,0.75)");
      ringGrad.addColorStop(1, "rgba(14,116,144,0.35)");
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-half + r, -half);
      ctx.lineTo(half - r, -half);
      ctx.quadraticCurveTo(half, -half, half, -half + r);
      ctx.lineTo(half, half - r);
      ctx.quadraticCurveTo(half, half, half - r, half);
      ctx.lineTo(-half + r, half);
      ctx.quadraticCurveTo(-half, half, -half, half - r);
      ctx.lineTo(-half, -half + r);
      ctx.quadraticCurveTo(-half, -half, -half + r, -half);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1;
      const heading = ((yawDeg || 0) % 360 + 360) % 360;
      for(let deg = 0; deg < 360; deg += 30){
        const rad = (deg - heading) * DEG_TO_RAD;
        const inner = radius + 2;
        const outer = radius + (deg % 90 === 0 ? 10 : 6);
        ctx.beginPath();
        ctx.moveTo(Math.sin(rad) * inner, -Math.cos(rad) * inner);
        ctx.lineTo(Math.sin(rad) * outer, -Math.cos(rad) * outer);
        ctx.stroke();
      }

      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.moveTo(0, -radius - 2);
      ctx.lineTo(-6, -radius - 16);
      ctx.lineTo(6, -radius - 16);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(15,23,42,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-6, 0);
      ctx.moveTo(6, 0);
      ctx.lineTo(18, 0);
      ctx.stroke();

      ctx.fillStyle = "rgba(15,23,42,0.85)";
      ctx.font = "12px \"Space Grotesk\",\"Sora\",\"Manrope\",ui-sans-serif,system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.round(heading) + "°", 0, radius + 12);
      ctx.restore();
    }

    function updateLauncherPitchAngle(pitchDeg, gyroPitchRate, nowMs){
      if(!el.launcherPitchAngle) return;
      let value = isFinite(pitchDeg) ? -pitchDeg : null;
      if(launcherAutoActive && value != null && isFinite(gyroPitchRate)){
        if(launcherPitchEst == null){
          launcherPitchEst = value;
          launcherPitchEstMs = nowMs || Date.now();
        }else{
          const now = nowMs || Date.now();
          let dt = (now - launcherPitchEstMs) / 1000;
          if(dt < 0) dt = 0;
          if(dt > 0.25) dt = 0.25;
          launcherPitchEstMs = now;
          launcherPitchEst += (gyroPitchRate) * dt;
        }
        value = launcherPitchEst;
      }
      el.launcherPitchAngle.textContent = (value == null) ? "--°" : (value.toFixed(1) + "°");
      if(launcherAutoActive && value != null && Math.abs(value) >= 115){
        launcherAutoActive = false;
        stopLauncherHold("up");
        stopLauncherHold("down");
        if(launcherOverlayEl) launcherOverlayEl.classList.remove("auto-active");
        showToast(t("launcherAutoStopToast"), "info");
        launcherPitchEst = null;
        launcherPitchEstMs = 0;
      }
    }
    let lastCountdownSec = null;
    let wifiInfo = null;
    let wifiInfoLastMs = 0;

    let prevSwState = null;
    let prevIcState = null;
    let prevGsState = null;
    let prevSmState = null;
    let st2StartMs = null;
    let localTplusStartMs = null;
    let localTplusActive = false;
    let tplusUiActive = false;
    let igniterAbortSent = false;
    let lastAbortReason = null;
    let firstSampleMs = null;
    let sequenceActive = false;

    // ✅ RelaySafe/LOCKOUT
    let relaySafeEnabled = true;
    let safetyModeEnabled = false;
    let lockoutLatched = false;
    let lockoutRelayMask = 0; // bit0=rly1, bit1=rly2
    let lastLockoutToastMs = 0;
    let devRelay1Locked = false;
    let devRelay2Locked = false;
    let devWsOff = false;
    let devLoadcellError = false;
    let loadcellErrorActive = false;
    let lastLoadcellErrorActive = null;

    // ✅ LOCKOUT modal
    let lockoutModalShown = false;

    // ✅ WebSerial
    let serialEnabled = false;
    let serialRxEnabled = true;
    let serialTxEnabled = true;
    let serialPort = null;
    let serialReader = null;
    let serialWriter = null;
    let serialReadAbort = null;
    let serialLineBuf = "";
    let serialConnected = false;
    let simEnabled = false;
    let simState = {st:0, cdMs:0, countdownStartMs:null, ignStartMs:null, countdownTotalMs:null};

    // ✅ 설비 점검/제어 권한
    let controlAuthority = false;
    let inspectionState = "idle";
    let inspectionRunning = false;
    let latestTelemetry = {sw:null, ic:null, rly:null, mode:null};
    const STATUS_MAP_DEFAULT = Object.freeze({lat:35.154244, lon:128.09293, zoom:12});
    const STATUS_MAP_KR_BOUNDS = Object.freeze({south:33.0, west:124.5, north:38.9, east:131.9});
    const STATUS_MAP_OFFLINE_VIEW = Object.freeze({left:30, top:8, width:40, height:84});
    const statusMapState = {
      lat: STATUS_MAP_DEFAULT.lat,
      lon: STATUS_MAP_DEFAULT.lon,
      zoom: STATUS_MAP_DEFAULT.zoom,
      map: null,
      marker: null,
      markerExpanded: false,
      offlineMode: false,
      offlineRoot: null,
      offlineMarker: null,
      uiBound: false,
      hasLiveFix: false,
      lastUpdateMs: 0
    };
    let lastBatteryV = null;
    let lastBatteryPct = null;
    let lastThrustKgf = null;
    const THRUST_GAUGE_MAX_KGF = 10;
    const THRUST_GAUGE_MAX_LBF = 22;
    const PRESSURE_GAUGE_MAX_V = 5;
    let pendingLoadcellWeight = null;
    let pendingLoadcellZero = false;
    let lastBurnSeconds = null;
    function isIgniterCheckEnabled(){
      if(latestTelemetry && latestTelemetry.gs != null) return !!latestTelemetry.gs;
      return !!(uiSettings && uiSettings.igs);
    }
    const INSPECTION_STEPS = [
      {key:"link",    check:()=>connOk},
      {key:"serial",  check:()=>(!serialEnabled) || serialConnected},
      {key:"igniter", check:()=> isIgniterCheckEnabled() ? (latestTelemetry.ic===1) : true},
      {key:"loadcell", check:()=> (lastThrustKgf != null && isFinite(lastThrustKgf) && !loadcellErrorActive)},
      {key:"switch",  check:()=>latestTelemetry.sw===0},
      {key:"relay",   check:()=>!lockoutLatched},
    ];
    const INSPECTION_STEP_INFO = {
      link:{labelKey:"inspectionLabelLink", descKey:"inspectionDescLink"},
      serial:{label:"WebSerial", descKey:"inspectionDescSerial"},
      igniter:{labelKey:"inspectionLabelIgniter", descKey:"inspectionDescIgniter"},
      loadcell:{labelKey:"inspectionLabelLoadcell", descKey:"inspectionDescLoadcell"},
      switch:{labelKey:"inspectionLabelSwitch", descKey:"inspectionDescSwitch"},
      relay:{label:"RelaySafe/LOCKOUT", descKey:"inspectionDescRelay"}
    };

    // ✅ DOM 캐시
    const el = {};
    let controlsCardParent = null;
    let controlsCardNext = null;
    const CONTROLS_MOBILE_CLASS = "controls-mobile-hidden";
    const MAX_VISIBLE_LOG = 500;
    const TETRIS_W = 10;
    const TETRIS_H = 14;
    const TETRIS_SCALE_X = 1;
    const TETRIS_SCALE_Y = 1;
    const TETRIS_CELL_ON = "#";
    const TETRIS_CELL_OFF = ".";
    const TETRIS_TICK_MS = 300;
    const TETRIS_LOCK_DELAY_MS = 250;
    const TETRIS_SHAPES = [
      // I
      [
        [[0,1],[1,1],[2,1],[3,1]],
        [[2,0],[2,1],[2,2],[2,3]],
        [[0,2],[1,2],[2,2],[3,2]],
        [[1,0],[1,1],[1,2],[1,3]],
      ],
      // O
      [
        [[1,0],[2,0],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[2,1]],
      ],
      // T
      [
        [[1,0],[0,1],[1,1],[2,1]],
        [[1,0],[1,1],[2,1],[1,2]],
        [[0,1],[1,1],[2,1],[1,2]],
        [[1,0],[0,1],[1,1],[1,2]],
      ],
      // S
      [
        [[1,0],[2,0],[0,1],[1,1]],
        [[1,0],[1,1],[2,1],[2,2]],
        [[1,1],[2,1],[0,2],[1,2]],
        [[0,0],[0,1],[1,1],[1,2]],
      ],
      // Z
      [
        [[0,0],[1,0],[1,1],[2,1]],
        [[2,0],[1,1],[2,1],[1,2]],
        [[0,1],[1,1],[1,2],[2,2]],
        [[1,0],[0,1],[1,1],[0,2]],
      ],
      // J
      [
        [[0,0],[0,1],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[1,2]],
        [[0,1],[1,1],[2,1],[2,2]],
        [[1,0],[1,1],[0,2],[1,2]],
      ],
      // L
      [
        [[2,0],[0,1],[1,1],[2,1]],
        [[1,0],[1,1],[1,2],[2,2]],
        [[0,1],[1,1],[2,1],[0,2]],
        [[0,0],[1,0],[1,1],[1,2]],
      ],
    ];

    let tetrisActive = false;
    let tetrisTimer = null;
    let tetrisState = null;
    let tetrisKeyHandler = null;
    let logoTapCount = 0;
    let logoTapTimer = null;

    // ✅ 연결 상태 안정화(히스테리시스) - CONNECT/DISCONNECT 깜빡임 방지
    let connOk = false;
    let lastOkMs = Date.now();          // 마지막 정상 샘플 수신 시각
    let failStreak = 0;                // 연속 실패 횟수
    let unstableToastShown = false;

    const DISCONNECT_GRACE_MS = 1500;  // 이 시간 동안 샘플이 없으면 끊김 후보
    const FAIL_STREAK_LIMIT   = 20;    // 연속 실패가 이 이상이고, grace도 지났으면 DISCONNECTED
    const TARGET_STREAM_HZ = 80;
    const RX_HZ_WARN_THRESHOLD = 30;
    const RX_HZ_RECOVER_THRESHOLD = 45;
    const DATA_TIMEOUT_ALARM_MS = 2200;
    let lastWsQueueDropCount = 0;

    // ✅ 엔드포인트 “기억” (매번 3개 다 두드리지 않게)
    let preferredEndpoint = "/graphic_data";
    const ENDPOINTS = ["/graphic_data","/data","/json"];

    // ✅ WebSocket 스트림
    let wsSocket = null;
    let wsConnected = false;
    let wsRetryTimer = null;
    let wsRetryMs = 300;
    let wsLastMsgMs = 0;
    const WS_FRESH_MS = 300;
    const WS_RETRY_MAX_MS = 5000;
    let wsEverConnected = false;
    let wsAlertDismissed = false;
    let lastWsAlertActive = false;
    const wsLogSilent = (
      location.protocol === "file:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1"
    );
    let suppressCountdownToastUntil = 0;
    let suppressIgnitionToastUntil = 0;

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

      const MIN_SPLASH_MS = 2600;  // 최소 표시 시간
      const ALTIS_SHOW_MS = 1600;  // ALTIS 먼저

      const ASSETS = [
        "img/altis_logo2.svg",
        "img/Flash_logo.svg",
        "img/Flash_logo_plain.svg",
        "img/Danger.svg",
        "img/Tick.svg",
        "img/Graph.svg",
        "img/Activity.svg",
        "img/RS_1.svg",
        "img/RS_2.svg",
        "img/RS_all.svg",
      ];

      const startMs = performance.now();
      const preloadPromise = preloadImages(ASSETS);
      const switchTimer = setTimeout(()=>{ splash.classList.add("flash-on"); }, ALTIS_SHOW_MS);

      const PRELOAD_TIMEOUT_MS = 2500;
      await Promise.race([
        preloadPromise,
        new Promise(r => setTimeout(r, PRELOAD_TIMEOUT_MS)),
      ]);

      const elapsed = performance.now() - startMs;
      const waitMs = Math.max(0, MIN_SPLASH_MS - elapsed);
      if(waitMs) await new Promise(r => setTimeout(r, waitMs));

      clearTimeout(switchTimer);

      splash.classList.add("hide");
      app.classList.add("ready");
      setTimeout(()=>{ try{ splash.remove(); }catch(e){} }, 350);
    }


    // =====================
    // UI 설정 저장
    // =====================
    const SETTINGS_KEY = "hanwool_tms_settings_v2";
    const OVERLAY_CHANNEL = "hanwool_overlay_sync";
    const OVERLAY_SYNC_KEY = "hanwool_overlay_latest";
    const OVERLAY_SYNC_MIN_MS = 150;
    let overlayChannel = null;
    let lastOverlaySyncMs = 0;
    let uiSettings = null;

    function defaultSettings(){
      return {
        thrustUnit:"kgf",
        ignDurationSec:5,
        countdownSec:10,
        opMode:"daq",
        gyroPreview:"3d",
        relaySafe: true,
        safetyMode: false,
        igs: 0,
        serialEnabled: false,
        serialRx: true,
        serialTx: true,
        simEnabled: false,
        lang: "ko",
        theme: "light"
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
      relaySafeEnabled = !!uiSettings.relaySafe;
      safetyModeEnabled = !!uiSettings.safetyMode;

      // WebSerial 기본 OFF 강제
      serialEnabled = false;
      uiSettings.serialEnabled = false;
      saveSettings();

      serialRxEnabled = uiSettings.serialRx !== false;
      serialTxEnabled = uiSettings.serialTx !== false;
      simEnabled = !!uiSettings.simEnabled;
      setLanguage(uiSettings.lang || "ko");
      applyTheme(uiSettings.theme || "light");
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

    // =====================
    // 언어 (i18n)
    // =====================
    const I18N = {
      ko: {
        toastTitleSuccess:"성공 알림",
        toastTitleWarn:"주의 알림",
        toastTitleError:"오류 알림",
        toastTitleCritical:"치명 경고",
        toastTitleIgnite:"점화 알림",
        toastTitleInfo:"일반 알림",
        toastTitleNotice:"공지 알림",
        safetyLineSuffix:"안전거리 확보 · 결선/단락 확인 · 주변 인원 접근 금지.",
        splashLoading:"로딩중<span id=\"splashDots\"></span>",
        viewDashboardLabel:"DASHBOARD",
        viewCountdownLabel:"COUNTDOWN",
        viewHomeLabel:"HOME",
        viewHardwareLabel:"HARDWARE",
        viewTerminalLabel:"TERMINAL",
        labelThrust:"추력",
        labelPressure:"압력",
        labelSwitch:"스위치",
        labelRelay:"릴레이",
        labelIgniter:"이그나이터",
        controlsHelpLink:"도움말로 바로가기",
        controlsSectionData:"데이터",
        controlsSectionSequence:"시퀀스 제어",
        controlsSectionControl:"컨트롤",
        forceIgniteBtn:"강제 점화",
        forceIgniteSub:"고위험 동작",
        forceIgniteDanger:"위험",
        safetyModeOnToast:"안전 모드가 켜졌습니다. 제어 권한이 제한됩니다.",
        safetyModeOffToast:"안전 모드가 꺼졌습니다. 안전에 주의하세요!",
        controlSerialSub:"시리얼 연결",
        controlSerialLabel:"WebSerial",
        controlDevToolsLabel:"개발자 도구",
        controlDevToolsSub:"개발자 도구 열기",
        controlInspectionLabel:"설비 점검",
        controlSafetyLabel:"안전 모드",
        controlSafetySub:"Safty",
        controlLauncherLabel:"발사대",
        controlLauncherSub:"발사대 모터/액추에이터제어",
        devToolsTitle:"DEV TOOLS",
        devRelayStatus:"SIM ER",
        devRelay1Btn:"1번 릴레이 오류",
        devRelay2Btn:"2번 릴레이 오류",
        devWsOffBtn:"WS 오류",
        devLoadcellErrBtn:"로드셀 오류",
        settingsNavTitle:"섹션",
        settingsNavConnect:"하드웨어",
        settingsNavHardware:"하드웨어",
        settingsNavInterface:"인터페이스",
        settingsNavSequence:"시퀀스",
        settingsNavSafety:"안전",
        settingsNavInfo:"정보",
        settingsGroupHardware:"하드웨어",
        settingsHardwareInfoTitle:"하드웨어 정보",
        settingsBoardNameLabel:"보드 이름",
        settingsFirmwareNameLabel:"펌웨어 정보",
        settingsProtocolLabel:"프로토콜",
        settingsGroupSerial:"시리얼",
        settingsGroupOperation:"운용 모드",
        settingsWifiInfoTitle:"Wi-Fi",
        settingsWifiModeLabel:"모드",
        settingsWifiSsidLabel:"SSID",
        settingsWifiChannelLabel:"채널",
        settingsWifiBandwidthLabel:"대역폭",
        settingsWifiTxPowerLabel:"TX 전력",
        settingsWifiIpLabel:"IP",
        settingsWifiStaCountLabel:"접속 장치",
        settingsWifiRssiLabel:"신호(RSSI)",
        settingsOpModeLabel:"모드",
        settingsOpModeHint:"플라이트/DAQ 모드를 전환합니다.",
        opModeDaq:"DAQ",
        opModeFlight:"Flight",
        settingsSerialStatusLabel:"시리얼 연결 상태",
        settingsSerialRxLabel:"시리얼 수신 로그 반영",
        settingsSerialRxHint:"보드가 JSON 라인을 출력하면 그대로 파싱해 UI/차트에 반영합니다.",
        settingsSerialTxLabel:"시리얼 명령 전송",
        settingsSerialTxHint:"ON이면 /set?… 같은 HTTP 명령을 시리얼 “SET …” 라인으로도 전송합니다.",
        settingsSimLabel:"가상 기기 (개발자 모드)",
        settingsSimHint:"가상 센서 값을 생성해 모든 기능을 테스트합니다.",
        settingsWsKeepLabel:"WebSocket 유지",
        settingsWsKeepHint:"연결이 끊겨도 자동 재연결을 시도합니다.",
        settingsGroupInterface:"인터페이스 설정",
        settingsThrustUnitLabel:"추력 단위",
        settingsThrustUnitHint:"표시 단위만 변환됩니다. 저장 데이터(RAW)는 <strong>kgf 기준</strong>입니다.",
        settingsPressureUnitLabel:"압력 단위",
        settingsPressureUnitHint:"현재는 Voltage(V) 기준. 센서 보정이 들어가면 kPa/psi로 확장 가능합니다.",
        settingsGyroPreviewLabel:"자이로 프리뷰",
        settingsGyroPreviewHint:"플라이트 모드 프리뷰 형태를 선택합니다.",
        settingsGyroPreview3d:"3D Attitude",
        settingsGyroPreviewNav:"Navball",
        langOptionKo:"한국어",
        langOptionEn:"영어",
        settingsGroupSequence:"점화 시퀀스",
        settingsIgnitionTimeLabel:"점화 시간 (릴레이 ON)",
        settingsIgnitionTimeHint:"보드에 <span class=\"mono\">/set?ign_ms=...</span> 전송. 과열/인가 시간에 주의.",
        settingsIgnitionTimeRange:"1~10초",
        settingsGroupCountdown:"카운트다운",
        settingsCountdownTimeLabel:"카운트다운 시간",
        settingsCountdownTimeHint:"보드에 <span class=\"mono\">/set?cd_ms=...</span> 전송. 인원 통제 시간을 충분히 확보.",
        settingsCountdownTimeRange:"3~30초",
        settingsGroupSafety:"안전",
        settingsRelaySafeHint:"릴레이가 <strong>비정상</strong>일때 모든 제어권한 정지 + 재시작 후 제어 권한 반환",
        settingsIgniterSafetyHint:"이그나이터의 결선 확인/테스트",
        settingsSafetyToastLabel:"안전 알림",
        settingsSafetyToastHint:"각종 상태 변화 시 토스트 알림이 표시됩니다. 클릭하면 닫힙니다.",
        settingsSaveBtn:"저장",
        opModeChangedToast:"모드 변경: {mode}",
        confirmSequenceTitle:"점화 시퀀스를 진행할까요?",
        confirmSequenceText:"점화 조건이 충족되지 않으면 보드가 점화를 실행하지 않습니다.<br>버튼을 3초 동안 계속 누르고 있어야 카운트다운이 진행됩니다.",
        confirmSequenceNote:"• 주변 안전거리 확보 · 이그나이터 결선/단락 여부 반드시 확인!",
        confirmCancel:"취소",
        easterEggTitle:"이스터에그 발견!",
        easterEggText:"로고를 5번 두드리는 바람에 테트리스가 깨어났습니다.<br>10 블럭 이상 클리어시 선물이 있을수도 있습니다!(선착순)",
        easterEggOk:"시작",
        tetrisWinTitle:"축하합니다!",
        tetrisWinText:"10줄 클리어를 완료하셨습니다!",
        tetrisWinOk:"보상 받기",
        tetrisPrizeTitle:"문화상품권",
        tetrisPrizeText:"축하합니다 문화상품권을 획득 하셨습니다! (선착순)",
        tetrisPrizeCopy:"복사",
        tetrisPrizeClose:"닫기",
        tetrisPrizeCopiedToast:"번호를 복사했습니다.",
        tetrisPrizeCopyFailToast:"복사에 실패했습니다.",
        simEnabledToast:"시뮬레이션 모드가 켜졌습니다.",
        simDisabledToast:"시뮬레이션 모드가 꺼졌습니다.",
        forceConfirmTitle:"강제 점화를 진행할까요?",
        forceConfirmText:"강제 점화는 고위험 동작입니다.<br>주변 인원 접근 금지 · 보호구 착용 권장 · 결선/단락 재확인.",
        forceLoadcellTitle:"로드셀을 점검하세요",
        forceLoadcellText:"로드셀 상태가 확인되지 않았습니다.<br>강제 점화는 진행할 수 있지만 위험을 충분히 이해한 뒤 선택하세요.",
        forceConfirmYes:"강제 점화",
        forceSlideLabel:"밀어서 강제 점화",
        forceConfirmCancel:"취소",
        lockoutAck:"확인",
        launcherTitle:"발사대 제어",
        launcherNote:"발사대 모터/액추에이터 제어가 적용됩니다.<br>버튼을 누르는 동안 모터가 구동됩니다.",
        launcherHint:"안전 주의: 발사대 주변 접근 금지. 이상 징후 시 즉시 중지하세요.",
        launcherAutoBtn:"자동 기립",
        launcherAutoStartToast:"자동 기립 시작",
        launcherAutoStopToast:"자동 기립 종료",
        launcherAutoLog:"발사대 자동 기립 실행.",
        launcherAutoDesc:"발사대를 자동으로 세우는 1회 동작입니다.",
        launcherAutoConfirmTitle:"자동 기립을 실행할까요?",
        launcherAutoConfirmText:"발사대가 자동으로 상승합니다.<br>주변 안전을 확인한 후 진행하세요.",
        launcherAutoConfirmBtn:"실행",
        inspectionTitle:"설비 점검",
        inspectionSub:"자동 점검을 완료하면 제어 권한이 부여됩니다.",
        inspectionCurrentTitle:"현재 점검 항목",
        inspectionLabelLink:"데이터 링크",
        inspectionDescLink:"Wi-Fi/폴링 응답 상태",
        inspectionDescSerial:"USB 시리얼 연결/권한",
        inspectionLabelIgniter:"이그나이터",
        inspectionDescIgniter:"연속성/오픈 여부",
        inspectionLabelLoadcell:"로드셀",
        inspectionDescLoadcell:"추력 데이터 정상 수신",
        inspectionLabelSwitch:"스위치",
        inspectionDescSwitch:"저전위(LOW) 안전 상태",
        inspectionDescRelay:"비정상 릴레이 HIGH 여부",
        inspectionRetry:"다시 점검",
        footerMeta:"2026 ALTIS 추진팀 윤보배 - HANWOOL",
        inspectionFailText:"점검 실패 항목이 있습니다.",
        inspectionPassText:"모든 항목 통과. 제어 권한 확보됨.",
        settingsLangLabel:"언어",
        settingsLangHint:"표시 언어를 변경합니다.",
        settingsThemeLabel:"다크 모드",
        settingsThemeHint:"라이트/다크 테마를 전환합니다.",
        exportXlsx:"보고서 내보내기",
        exportPendingBadge:"보고서 내보내기 X",
        exportDoneBadge:"보고서 내보내기 O",
        exportLeaveTitle:"보고서 내보내기 안됨",
        exportLeaveText:"보고서를 아직 내보내지 않았습니다.<br>정말 이 페이지를 나가시겠습니까?",
        exportLeaveConfirm:"나가기",
        exportLeaveCancel:"취소",
        exportBeforeCloseConfirm:"보고서 내보내기가 완료되지 않았습니다. 정말 나가시겠습니까?",
        chartNoData:"데이터 없음",
        labelDelay:"지연",
        labelBurn:"연소",
        modeSerial:"시리얼",
        modeWifi:"와이파이",
        modeAuto:"자동",
        swHigh:"HIGH",
        swLow:"LOW",
        icOk:"OK",
        icNo:"NO",
        relayOn:"ON",
        relayOff:"OFF",
        dirUp:"상승",
        dirDown:"하강",
        confirmTitleReady:"점화 시퀀스를 진행할까요?",
        confirmTitleEntering:"점화 시퀀스 진입까지 {sec}초",
        confirmTitleCountdown:"카운트다운 시작",
        ignWindowDetected:"점화 구간 감지",
        ignWindowNone:"점화 구간 없음",
        igniterLostAbortLog:"시퀀스 중 이그나이터 끊김 감지 → ABORT 전송.",
        igniterLostAbortToast:"시퀀스 중 이그나이터가 끊겼습니다. ABORT 처리했습니다. {safety}",
        lockoutModalTitle:"LOCKOUT · {name}",
        lockoutModalText:"비정상적인 릴레이 HIGH 감지 ({name})로 모든 제어 권한이 해제되었습니다.",
        lockoutModalNote:"• 릴레이/배선/드라이버 쇼트 여부 확인 후 보드를 재시작하세요.",
        connConnected:"연결됨",
        connDisconnected:"연결 끊김",
        statusDisconnected:"DISCONNECTED",
        statusNoResponse:"보드 응답 없음",
        wsConnecting:"WebSocket 연결 시도: {url}",
        wsClosed:"WebSocket 종료 (코드 {code}, 사유 {reason}).",
        wsError:"WebSocket 오류.",
        wsTimeout:"WebSocket 시간초과",
        wsAlertTitle:"WebSocket 연결 안됨",
        wsAlertText:"WebSocket이 연결되어있지 않아 데이터가 10 Hz로 출력됩니다.<br>해결하려면 브라우저를 새로고침 하세요.",
        wsAlertClose:"닫기",
        deviceDisconnectedTitle:"연결 해제",
        deviceDisconnectedText:"기기와의 통신이 끊겼습니다.<br>케이블/전원을 확인해주세요.",
        deviceDisconnectedOk:"확인",
        noResponse:"보드 응답 없음",
        hdrTimeIso:"시간_ISO",
        hdrMessage:"메시지",
        hdrIgnWindow:"점화_구간",
        hdrIgnDelay:"점화_지연_s",
        hdrBurn:"유효_연소_s",
        hdrThreshold:"임계_kgf",
        hdrAvgThrust:"평균추력_kgf",
        hdrAvgPressure:"평균압력_v",
        hdrMaxThrust:"최대추력_kgf",
        hdrMaxPressure:"최대압력_v",
        hdrAvgThrustN:"평균추력_N",
        hdrMaxThrustN:"최대추력_N",
        hdrTag:"태그",
        hdrThrust:"추력_kgf",
        hdrThrustN:"추력_N",
        hdrPressure:"압력_v",
        hdrAccelX:"가속도_x_g",
        hdrAccelY:"가속도_y_g",
        hdrAccelZ:"가속도_z_g",
        hdrTerminalVel:"종단속도_mps",
        hdrGyroX:"자이로_x_dps",
        hdrGyroY:"자이로_y_dps",
        hdrGyroZ:"자이로_z_dps",
        hdrLoopMs:"루프_ms",
        hdrElapsedMs:"경과_ms",
        hdrHxHz:"hx_hz",
        hdrCpuUs:"cpu_us",
        hdrSwitch:"스위치",
        hdrIgnOk:"점화_정상",
        hdrRelay:"릴레이",
        hdrIgs:"igs_모드",
        hdrState:"상태",
        hdrTdMs:"td_ms",
        hdrRelTime:"상대시간_s",
        hdrIgnWindowFlag:"유효추력_구간",
        chartTitleIgnition:"유효추력 구간 추력/압력 (elapsed_ms 기준)",
        chartTitleThrust:"추력 그래프 (유효추력 구간)",
        chartTitleThrustN:"추력 그래프 (N, 유효추력 구간)",
        chartTitlePressure:"압력 그래프 (유효추력 구간)",
        statusLockout:"LOCKOUT",
        statusAbort:"ABORT",
        statusIgnition:"IGNITION",
        statusCountdown:"COUNTDOWN",
        statusNotArmed:"NOT ARMED",
        statusReady:"READY",
        statusLoadcellCheck:"LOADCELL CHECK",
        statusSequence:"SEQUENCE",
        statusLockoutText:"비정상적인 릴레이 HIGH 감지 ({name})",
        statusAbortText:"시퀀스가 중단되었습니다.",
        statusAbortTextReason:"시퀀스가 중단되었습니다. ({reason})",
        statusIgnitionText:"점화 중입니다.",
        statusCountdownText:"카운트다운 진행 중",
        statusSequenceText:"시퀀스 진행 중",
        statusNotArmedTextReady:"이그나이터 미연결 / 점화 시퀀스 가능",
        statusNotArmedTextBlocked:"이그나이터 미연결 / 점화 시퀀스 제한",
        statusReadyText:"시스템 준비 완료",
        sequenceReadyBtn:"READY",
        sequenceStartBtn:"SEQUENCE",
        sequenceEndBtn:"SEQUENCE END",
        sequenceEndLog:"시퀀스 종료 요청.",
        sequenceEndToast:"시퀀스를 종료했습니다.",
        relaySafeLockout:"LOCKOUT({name})",
        relaySafeSafe:"SAFE",
        relaySafeOff:"OFF",
        serialOff:"OFF",
        serialConnected:"연결됨",
        serialDisconnected:"연결 끊김",
        inspectFailToast:"점검 실패 항목이 있습니다. 상태를 확인하세요.",
        inspectFailLog:"설비 점검 실패: 일부 항목이 통과하지 못했습니다.",
        inspectPassToast:"설비 점검 통과. 제어 권한을 획득했습니다.",
        inspectPassLog:"설비 점검 완료. 제어 권한을 획득했습니다.",
        wsReconnect:"WebSocket 재연결 예약 ({reason}).",
        wsConnected:"WebSocket 연결됨: {url}",
        wsLost:"보드와의 연결이 끊겼습니다.",
        boardUnstable:"보드 응답이 불안정합니다. 전원/배선/Wi-Fi/폴링 주기를 확인하세요.",
        alarmWsDisconnected:"WebSocket 연결이 끊겼습니다. 실시간 스트림이 중단되었습니다.",
        alarmWsRecovered:"WebSocket 연결이 복구되었습니다.",
        alarmDataTimeout:"데이터가 일정 시간 수신되지 않았습니다. 통신/전원 상태를 확인하세요. ({ms} ms)",
        alarmDataTimeoutClear:"데이터 수신이 정상으로 복구되었습니다.",
        alarmRxHzDrop:"데이터 수신 주파수가 저하되었습니다. 목표 {target} Hz 대비 현재 {hz} Hz",
        alarmRxHzRecovered:"데이터 수신 주파수가 정상 범위로 복구되었습니다.",
        alarmRelayLockout:"비정상 릴레이 HIGH 감지로 LOCKOUT 되었습니다. ({name}) 보드를 재시작하세요.",
        alarmWsBackpressure:"WebSocket 전송 큐 적체가 발생했습니다. 누적 {total}회 (이번 +{delta})",
        alarmReplayFormat:"Replay 파일 포맷 오류: {reason}",
        alarmReplayAutoStop:"Replay 데이터 끝에 도달해 자동 정지되었습니다.",
        alarmInternalException:"내부 예외가 반복 발생했습니다. 소스={source}, 오류={err}",
        webserialUnsupported:"WebSerial조건이 아닙니다. (도움말 페이지를 확인하세요)",
        webserialConnected:"WebSerial 연결됨 @460800.",
        webserialConnectedToast:"시리얼(WebSerial) 연결 완료.",
        serialReadEnded:"시리얼 읽기 루프 종료: {err}",
        webserialConnectFailed:"WebSerial 연결 실패: {err}",
        webserialConnectFailedToast:"시리얼 연결 실패. 포트/권한을 확인하세요.",
        webserialDisconnected:"WebSerial 연결 해제됨.",
        serialWriteFailed:"시리얼 쓰기 실패: {err}",
        linkEstablished:"연결됨 ({src}).",
        linkEstablishedToast:"보드와 연결되었습니다. ({src})",
        lockoutDetectedLog:"LOCKOUT: 비정상적인 릴레이 HIGH 감지 ({name})",
        lockoutDetectedToast:"비정상적인 릴레이 HIGH 감지 ({name})",
        ignitionSignal:"점화 신호 감지 (st=2). 추력 {thr} kgf 초과 감시 시작.",
        ignitionThresholdLog:"추력이 {thr} kgf 초과. 점화 지연 = {delay}s",
        ignitionThresholdToast:"추력이 임계값({thr} kgf) 이상으로 감지되었습니다. 점화 지연 ≈ {delay}s. {safety}",
        ignitionEndLog:"점화 상태 종료. 연소 시간 ≈ {dur}s",
        ignitionEndToast:"유효추력 구간이 종료된 것으로 보입니다. 잔열/잔류가스 주의 후 접근하세요.",
        ignitionNoThrustLog:"점화 상태 종료. 임계값 이상 추력 미검출.",
        ignitionNoThrustToast:"점화 상태 종료. 유효추력이 감지되지 않았습니다. 결선/이그나이터 상태를 확인하세요. {safety}",
        switchHighLog:"스위치 변경: HIGH(ON).",
        switchHighToast:"스위치가 HIGH(ON) 상태입니다. 시퀀스 조건/주변 안전을 재확인하세요. {safety}",
        switchLowLog:"스위치 변경: LOW(OFF).",
        switchLowToast:"스위치가 LOW(OFF) 상태입니다. 안전 상태로 유지하세요. {safety}",
        igniterOkLog:"이그나이터 연속성: OK.",
        igniterOkToast:"이그나이터 상태가 OK로 변경되었습니다. 점화 전 결선/단락/극성을 재확인하세요. {safety}",
        igniterNoLog:"이그나이터 연속성: NO / OPEN.",
        igniterNoToast:"이그나이터가 NO(OPEN) 상태입니다. 커넥터/배선/단선 여부를 확인하세요. {safety}",
        igsOnLog:"Igniter Safety Test: ON (보드).",
        igsOnToast:"Igniter Safety Test가 ON입니다. 의도치 않은 인가 위험이 있습니다. {safety}",
        igsOffLog:"Igniter Safety Test: OFF (보드).",
        igsOffToast:"Igniter Safety Test가 OFF입니다. 안전 상태로 복귀했습니다. {safety}",
        countdownStartLog:"카운트다운 시작 (st=1).",
        countdownStartToast:"카운트다운이 시작되었습니다. 주변 안전거리 확보 후 진행하세요. {safety}",
        ignitionFiringLog:"점화 진행 (st=2).",
        ignitionFiringToast:"점화 시퀀스가 진행 중입니다. 절대 접근하지 마세요. {safety}",
        sequenceCompleteLog:"시퀀스 완료. 대기 상태로 복귀.",
        sequenceCompleteToast:"시퀀스가 완료되었습니다. 잔열/잔류가스 주의 후 접근하세요.",
        sequenceAbortedLog:"시퀀스 중단.",
        sequenceAbortedToast:"ABORT 처리되었습니다. 재시도 전 결선/스위치/환경을 다시 확인하세요. {safety}",
        sequenceAbortedToastReason:"시퀀스가 중단되었습니다. ({reason}) {safety}",
        abortReasonUser:"사용자 임의의 abort",
        abortReasonIgniter:"이그나이터 단락",
        abortReasonLockout:"릴레이 LOCKOUT",
        abortReasonUnknown:"원인 미상",
        notArmedToast:"NOT ARMED 상태입니다. 이그나이터 연결 상태를 확인하세요. {safety}",
        lockoutDetectedToastShort:"비정상적인 릴레이 HIGH 감지 ({name}).",
        pollingErrorLog:"폴링 오류: {err}",
        pollingErrorToast:"폴링 중 오류가 발생했습니다. 로그를 확인하세요.",
        lockoutNoControl:"LOCKOUT 상태에서는 어떤 제어도 불가능합니다. 보드를 재시작하세요.",
        inspectionRequiredToast:"설비 점검을 먼저 완료하세요. 점검 통과 후 제어 권한이 부여됩니다.",
        preSequenceToast:"시퀀스 시작 전 최종 안전 확인을 진행하세요. 3초 롱프레스로 진입합니다. {safety}",
        inspectionRequiredShort:"설비 점검을 먼저 완료하세요. 제어 권한이 필요합니다.",
        countdownRequestedLog:"대시보드에서 카운트다운 요청 (롱프레스).",
        countdownRequestedToast:"카운트다운 요청을 보드에 전송했습니다. 신호/배선/주변을 계속 확인하세요. {safety}",
        countdownIgniterRequired:"IGS 모드에서는 이그나이터가 없으면 RELAY ON을 시작할 수 없습니다. {safety}",
        longPressCanceledToast:"롱프레스가 취소되었습니다. 주변 안전 확보 후 다시 시도하세요. {safety}",
        lockoutForceDenied:"LOCKOUT 상태에서는 강제점화를 포함한 제어가 불가능합니다. 보드를 재시작하세요.",
        forceNotAllowed:"시퀀스 진행 중에는 강제 점화를 사용할 수 없습니다.",
        forceWarning:"강제 점화는 고위험 동작입니다. 마지막 확인 후 진행하세요. {safety}",
        forceIgniterRequired:"이그나이터 미연결 상태에서는 강제 점화를 사용할 수 없습니다.",
        lockoutControlDenied:"LOCKOUT 상태에서는 제어가 불가능합니다.",
        inspectionRequiredPlain:"설비 점검을 먼저 완료하세요.",
        launcherUpDownLog:"발사대 {dir} 명령 전송.",
        dirStop:"정지",
        lockoutCmdDenied:"LOCKOUT({name}) 상태에서는 명령을 보낼 수 없습니다. 보드를 재시작하세요.",
        cmdSentLog:"명령 => {cmd}",
        systemReadyLog:"시스템 준비 완료. 명령 대기 중.",
        dashboardStartToast:"대시보드가 시작되었습니다. 연결 상태 확인 후 운용하세요. {safety}",
        relaySafeOnToast:"RelaySafe가 ON입니다. 비정상 릴레이 HIGH 감지 시 LOCKOUT 됩니다.",
        relaySafeOffToast:"RelaySafe가 OFF입니다. (권장하지 않음)",
        igsToggledLog:"Igniter Safety Test 토글: {state}",
        igsToggledOnToast:"Igniter Safety Test가 ON입니다. 이그나이터/배선에 주의하세요. {safety}",
        igsToggledOffToast:"Igniter Safety Test가 OFF입니다. 안전 상태로 유지하세요. {safety}",
        serialRxOnToast:"시리얼 수신 파싱 ON",
        serialRxOffToast:"시리얼 수신 파싱 OFF",
        serialTxOnToast:"시리얼 명령 전송 ON",
        serialTxOffToast:"시리얼 명령 전송 OFF",
        lockoutAbortDenied:"LOCKOUT({name}) 상태에서는 ABORT도 불가능합니다. 보드를 재시작하세요.",
        abortRequestedToast:"ABORT 요청을 보드에 전송했습니다. 안전 확인 후 재시도하세요. {safety}",
        inspectionOpenToast:"보드와 연결 후 설비 점검을 실행하세요.",
        inspectionWait:"대기",
        inspectionRunningLabel:"진행중",
        inspectionChecking:"확인 중",
        inspectionOk:"정상",
        inspectionNeed:"확인 필요",
        inspectionSkip:"SKIP",
        inspectionIdleText:"점검 대기중…",
        inspectionRunningText:"점검 중…",
        forceRequestedToast:"강제 점화 요청을 보드에 전송했습니다. 절대 접근하지 마세요. {safety}",
        lockoutAckLog:"LOCKOUT 확인 처리 ({name}). 재시작 필요.",
        lockoutAckToast:"LOCKOUT({name}) 확인 처리(로그 기록). 보드를 재시작하세요.",
        logCopiedLog:"로그를 클립보드에 복사했습니다.",
        logCopiedToast:"로그가 클립보드에 복사되었습니다.",
        clipboardCopyFailedLog:"클립보드 복사 실패.",
        clipboardCopyFailedToast:"클립보드 복사에 실패했습니다. 브라우저 권한을 확인하세요.",
        copyFailedLog:"복사 실패: {err}",
        copyFailedToast:"복사에 실패했습니다. 브라우저 정책을 확인하세요.",
        xlsxExportLog:"보고서 내보내기 완료 (ZIP): {filename}",
        xlsxExportToast:"보고서를 .zip 파일로 내보냈습니다.",
        thrustUnitChangedToast:"추력 단위가 {from} → {to} 로 변경되었습니다. 표시 단위만 변경됩니다. {safety}",
        ignTimeChangedToast:"점화 시간이 {from}s → {to}s 로 변경되었습니다. 과열/인가 시간에 주의하세요. {safety}",
        countdownChangedToast:"카운트다운 시간이 {from}s → {to}s 로 변경되었습니다. 인원 통제 시간을 충분히 두세요. {safety}",
        settingsUpdatedLog:"설정 업데이트: thrustUnit={unit}, ignDuration={ign}s, countdown={cd}s",
        loadcellSettingsTitle:"로드셀 보정",
        loadcellSettingsLabel:"로드셀 영점/보정",
        loadcellSettingsHint:"영점/보정 값을 보드에 저장합니다.",
        loadcellOpenBtn:"로드셀 영점 조절",
        loadcellModalTitle:"로드셀 영점 조절",
        loadcellModalBadge:"Calibration",
        loadcellModalGuide:"무게추를 올려놓고 값을 확인하세요. 다음을 누르세요.",
        loadcellModalValueLabel:"현재 측정값 (kg)",
        loadcellModalValueHint:"보정은 kg 기준으로 저장됩니다.",
        loadcellModalInputLabel:"중량 입력 (kg)",
        loadcellModalInputHint:"1Kg = 1000g",
        loadcellModalNote:"이 값은 보드에 저장됩니다.",
        loadcellModalApply:"다음",
        loadcellModalCancel:"취소",
        loadcellZeroSaveBtn:"영점 저장",
        loadcellModalConfirmTitle:"보정값을 저장할까요?",
        loadcellModalConfirmText:"입력한 중량 {weight} kg로 보정값을 저장합니다. 이전 값은 삭제됩니다.",
        loadcellModalConfirmSub:"저장 후 측정 기준이 변경됩니다. 보정에 사용한 무게추를 제거한 뒤 값을 확인하세요.",
        loadcellModalConfirmProceed:"진행",
        loadcellModalConfirmCancel:"취소",
        loadcellZeroConfirmTitle:"영점을 저장할까요?",
        loadcellZeroConfirmText:"현재 상태를 영점으로 저장합니다. 이전 영점은 덮어씁니다.",
        loadcellWeightInvalidToast:"중량을 올바르게 입력하세요.",
        loadcellZeroSaveSuccessToast:"로드셀 영점을 저장했습니다.",
        loadcellZeroSaveFailToast:"로드셀 영점 저장에 실패했습니다.",
        loadcellSaveSuccessToast:"로드셀 보정값을 저장했습니다.",
        loadcellSaveFailToast:"로드셀 보정 저장에 실패했습니다.",
        loadcellZeroSaveLog:"로드셀 영점 저장 요청",
        loadcellSaveLog:"로드셀 보정 저장 요청 (weight={weight} kg)",
        loadcellErrorToast:"로드셀 데이터 수신 오류입니다. 센서/배선을 점검하세요."
      },
      en: {
        toastTitleSuccess:"Success",
        toastTitleWarn:"Warning",
        toastTitleError:"Error",
        toastTitleCritical:"Critical",
        toastTitleIgnite:"Ignite",
        toastTitleInfo:"Info",
        toastTitleNotice:"Notice",
        safetyLineSuffix:"Keep safe distance · Check wiring/shorts · No personnel approach.",
        splashLoading:"Loading<span id=\"splashDots\"></span>",
        viewDashboardLabel:"DASHBOARD",
        viewCountdownLabel:"COUNTDOWN",
        viewHomeLabel:"HOME",
        viewHardwareLabel:"HARDWARE",
        viewTerminalLabel:"TERMINAL",
        labelThrust:"Thrust",
        labelPressure:"Pressure",
        labelSwitch:"Switch",
        labelRelay:"Relay",
        labelIgniter:"Igniter",
        controlsHelpLink:"Open Help",
        controlsSectionData:"Data",
        controlsSectionSequence:"Sequence Control",
        controlsSectionControl:"Control",
        forceIgniteBtn:"Ignition",
        forceIgniteSub:"High-risk",
        forceIgniteDanger:"DANGER",
        safetyModeOnToast:"Safety mode enabled. Relay actuation is blocked.",
        safetyModeOffToast:"Safety mode disabled.",
        controlSerialSub:"Connect",
        controlSerialLabel:"WebSerial",
        controlDevToolsLabel:"Developer Tools",
        controlDevToolsSub:"Open developer tools",
        controlInspectionLabel:"Inspection",
        controlSafetyLabel:"Safety",
        controlSafetySub:"Safety mode",
        controlLauncherLabel:"Launcher",
        controlLauncherSub:"Launcher motor/actuator control",
        devToolsTitle:"DEV TOOLS",
        devRelayStatus:"Relay Status",
        devRelay1Btn:"Relay 1",
        devRelay2Btn:"Relay 2",
        devWsOffBtn:"WS OFF (SIM)",
        devLoadcellErrBtn:"LOADCELL ERROR (SIM)",
        settingsNavTitle:"Sections",
        settingsNavConnect:"Hardware",
        settingsNavHardware:"Hardware",
        settingsNavInterface:"Interface",
        settingsNavSequence:"Sequence",
        settingsNavSafety:"Safety",
        settingsNavInfo:"Info",
        settingsGroupHardware:"Hardware",
        settingsHardwareInfoTitle:"Hardware Info",
        settingsBoardNameLabel:"Board Name",
        settingsFirmwareNameLabel:"Firmware",
        settingsProtocolLabel:"Protocol",
        settingsGroupSerial:"Serial",
        settingsGroupOperation:"Operation Mode",
        settingsWifiInfoTitle:"Wi-Fi",
        settingsWifiModeLabel:"Mode",
        settingsWifiSsidLabel:"SSID",
        settingsWifiChannelLabel:"Channel",
        settingsWifiBandwidthLabel:"Bandwidth",
        settingsWifiTxPowerLabel:"TX power",
        settingsWifiIpLabel:"IP",
        settingsWifiStaCountLabel:"Connected devices",
        settingsWifiRssiLabel:"Signal (RSSI)",
        settingsOpModeLabel:"Mode",
        settingsOpModeHint:"Switch between Flight/DAQ.",
        opModeDaq:"DAQ",
        opModeFlight:"Flight",
        settingsSerialStatusLabel:"Serial connection status",
        settingsSerialRxLabel:"Apply serial RX logs",
        settingsSerialRxHint:"Parse JSON lines from the board and reflect them in the UI/charts.",
        settingsSerialTxLabel:"Send serial commands",
        settingsSerialTxHint:"When ON, /set?... is also sent as serial \"SET ...\".",
        settingsSimLabel:"Virtual device (simulation)",
        settingsSimHint:"Generate virtual sensor data to test all functions.",
        settingsWsKeepLabel:"Keep WebSocket",
        settingsWsKeepHint:"Automatically reconnect if the connection drops.",
        settingsGroupInterface:"Interface Settings",
        settingsThrustUnitLabel:"Thrust unit",
        settingsThrustUnitHint:"Only the display unit is converted. Saved RAW data uses <strong>kgf</strong>.",
        settingsPressureUnitLabel:"Pressure unit",
        settingsPressureUnitHint:"Currently based on Voltage (V). kPa/psi will be available after sensor calibration.",
        settingsGyroPreviewLabel:"Gyro preview",
        settingsGyroPreviewHint:"Choose the preview for Flight mode.",
        settingsGyroPreview3d:"3D Attitude",
        settingsGyroPreviewNav:"Navball",
        langOptionKo:"Korean",
        langOptionEn:"English",
        settingsGroupSequence:"Ignition Sequence",
        settingsIgnitionTimeLabel:"Ignition time (relay ON)",
        settingsIgnitionTimeHint:"Sends <span class=\"mono\">/set?ign_ms=...</span> to the board. Watch heat/energizing duration.",
        settingsIgnitionTimeRange:"1–10 s",
        settingsGroupCountdown:"Countdown",
        settingsCountdownTimeLabel:"Countdown time",
        settingsCountdownTimeHint:"Sends <span class=\"mono\">/set?cd_ms=...</span> to the board. Allow enough time to clear personnel.",
        settingsCountdownTimeRange:"3–30 s",
        settingsGroupSafety:"Safety",
        settingsRelaySafeHint:"When relay is <strong>abnormal</strong>, all control is suspended; control returns after restart.",
        settingsIgniterSafetyHint:"Check/test igniter wiring.",
        settingsSafetyToastLabel:"Safety alerts",
        settingsSafetyToastHint:"Toast notifications appear on state changes. Click to dismiss.",
        settingsSaveBtn:"Save",
        opModeChangedToast:"Mode changed: {mode}",
        confirmSequenceTitle:"Proceed with ignition sequence?",
        confirmSequenceText:"If conditions aren't met, the board won't ignite.<br>Hold the button for 3 seconds to start the countdown.",
        confirmSequenceNote:"• Keep safe distance · Verify igniter wiring/shorts!",
        confirmCancel:"Cancel",
        easterEggTitle:"Easter egg found!",
        easterEggText:"You poked the logo five times and woke up Tetris.<br>Wait... was this even approved?",
        easterEggOk:"OK, I confess",
        tetrisWinTitle:"Congratulations!",
        tetrisWinText:"10-line clear complete. Nice play.",
        tetrisWinOk:"Next",
        tetrisPrizeTitle:"Reward Card",
        tetrisPrizeText:"This is your voucher code. Copy it if needed.",
        tetrisPrizeCopy:"Copy code",
        tetrisPrizeClose:"Close",
        tetrisPrizeCopiedToast:"Code copied.",
        tetrisPrizeCopyFailToast:"Copy failed.",
        simEnabledToast:"Simulation mode enabled.",
        simDisabledToast:"Simulation mode disabled.",
        forceConfirmTitle:"Proceed with force ignition?",
        forceConfirmText:"Force ignition is high risk.<br>No personnel nearby · PPE recommended · Recheck wiring/shorts.",
        forceLoadcellTitle:"Check the loadcell",
        forceLoadcellText:"Loadcell status is not verified.<br>You can still force ignite, but proceed only if you understand the risk.",
        forceConfirmYes:"Force Ignition",
        forceSlideLabel:"Slide to Force Ignition",
        forceConfirmCancel:"Cancel",
        lockoutAck:"Acknowledge",
        launcherTitle:"Launcher Control",
        launcherNote:"Launcher motor/actuator control is enabled.<br>The motor runs while you hold the button.",
        launcherHint:"Safety: Keep clear of the launcher. Stop immediately if anything seems abnormal.",
        launcherAutoBtn:"Auto Stand",
        launcherAutoStartToast:"Auto stand started.",
        launcherAutoStopToast:"Auto stand complete.",
        launcherAutoLog:"Launcher auto stand triggered.",
        launcherAutoDesc:"Runs a single automatic stand-up sequence.",
        launcherAutoConfirmTitle:"Run auto stand?",
        launcherAutoConfirmText:"The launcher will raise automatically.<br>Proceed only after checking safety.",
        launcherAutoConfirmBtn:"Run",
        inspectionTitle:"Inspection",
        inspectionSub:"Complete the automatic check to gain control authority.",
        inspectionCurrentTitle:"Current check",
        inspectionLabelLink:"Data link",
        inspectionDescLink:"Wi-Fi/polling response",
        inspectionDescSerial:"USB serial connection/permissions",
        inspectionLabelIgniter:"Igniter",
        inspectionDescIgniter:"Continuity/open status",
        inspectionLabelLoadcell:"Loadcell",
        inspectionDescLoadcell:"Thrust data reception",
        inspectionLabelSwitch:"Switch",
        inspectionDescSwitch:"LOW safety state",
        inspectionDescRelay:"Abnormal relay HIGH status",
        inspectionRetry:"Recheck",
        footerMeta:"2026 ALTIS Propulsion Team Yoon Bobae - HANWOOL",
        inspectionFailText:"Some inspection items failed.",
        inspectionPassText:"All checks passed. Control authority granted.",
        loadcellSettingsTitle:"Loadcell Calibration",
        loadcellSettingsLabel:"Loadcell Zero/Calibration",
        loadcellSettingsHint:"Save zero/calibration value to the board.",
        loadcellOpenBtn:"Adjust Loadcell Zero",
        loadcellModalTitle:"Loadcell Zero Adjust",
        loadcellModalBadge:"Calibration",
        loadcellModalGuide:"Place the weight and check the value. Tap Next.",
        loadcellModalValueLabel:"Current value (kg)",
        loadcellModalValueHint:"Calibration is saved in kg.",
        loadcellModalInputLabel:"Enter weight (kg)",
        loadcellModalInputHint:"1 kg = 1000 g",
        loadcellModalNote:"This value will be saved to the board.",
        loadcellModalApply:"Next",
        loadcellModalCancel:"Cancel",
        loadcellModalConfirmTitle:"Save calibration value?",
        loadcellModalConfirmText:"Save calibration with {weight} kg. Previous value will be removed.",
        loadcellModalConfirmSub:"After saving, the measurement reference changes. Remove the calibration weight and check the value.",
        loadcellModalConfirmProceed:"Proceed",
        loadcellModalConfirmCancel:"Cancel",
        loadcellWeightInvalidToast:"Enter a valid weight.",
        loadcellSaveSuccessToast:"Loadcell calibration saved.",
        loadcellSaveFailToast:"Failed to save loadcell calibration.",
        loadcellSaveLog:"Loadcell calibration save request (weight={weight} kg)",
        loadcellErrorToast:"Loadcell data error. Check sensor and wiring.",
        settingsLangLabel:"Language",
        settingsLangHint:"Change display language.",
        settingsThemeLabel:"Dark mode",
        settingsThemeHint:"Toggle light/dark theme.",
        exportXlsx:"Export Report",
        exportPendingBadge:"Report Not Exported",
        exportDoneBadge:"Report Exported",
        exportLeaveTitle:"Report Not Exported",
        exportLeaveText:"The report has not been exported yet.<br>Do you really want to leave this page?",
        exportLeaveConfirm:"Leave",
        exportLeaveCancel:"Cancel",
        exportBeforeCloseConfirm:"Report export is not completed. Do you really want to leave?",
        chartNoData:"NO DATA",
        labelDelay:"Delay",
        labelBurn:"Burn",
        modeSerial:"SERIAL",
        modeWifi:"WIFI",
        modeAuto:"AUTO",
        swHigh:"HIGH",
        swLow:"LOW",
        icOk:"OK",
        icNo:"NO",
        relayOn:"ON",
        relayOff:"OFF",
        dirUp:"UP",
        dirDown:"DOWN",
        confirmTitleReady:"Proceed with ignition sequence?",
        confirmTitleEntering:"Entering ignition sequence in {sec}s",
        confirmTitleCountdown:"Countdown start",
        ignWindowDetected:"Ignition window detected",
        ignWindowNone:"No ignition window",
        igniterLostAbortLog:"Igniter lost during sequence → ABORT sent.",
        igniterLostAbortToast:"Igniter lost during sequence. ABORT sent. {safety}",
        lockoutModalTitle:"LOCKOUT · {name}",
        lockoutModalText:"Abnormal relay HIGH detected ({name}). Control revoked.",
        lockoutModalNote:"• Check relay/wiring/driver short then restart the board.",
        connConnected:"CONNECTED",
        connDisconnected:"DISCONNECTED",
        statusDisconnected:"DISCONNECTED",
        statusNoResponse:"No response from board",
        wsTimeout:"WebSocket timeout",
        noResponse:"No response from board",
        hdrTimeIso:"time_iso",
        hdrMessage:"message",
        hdrIgnWindow:"ignition_window",
        hdrIgnDelay:"ignition_delay_s",
        hdrBurn:"effective_burn_s",
        hdrThreshold:"threshold_kgf",
        hdrAvgThrust:"avg_thrust_kgf",
        hdrAvgPressure:"avg_pressure_v",
        hdrMaxThrust:"max_thrust_kgf",
        hdrMaxPressure:"max_pressure_v",
        hdrAvgThrustN:"avg_thrust_n",
        hdrMaxThrustN:"max_thrust_n",
        hdrTag:"tag",
        hdrThrust:"thrust_kgf",
        hdrThrustN:"thrust_n",
        hdrPressure:"pressure_v",
        hdrAccelX:"accel_x_g",
        hdrAccelY:"accel_y_g",
        hdrAccelZ:"accel_z_g",
        hdrTerminalVel:"terminal_velocity_mps",
        hdrGyroX:"gyro_x_dps",
        hdrGyroY:"gyro_y_dps",
        hdrGyroZ:"gyro_z_dps",
        hdrLoopMs:"loop_ms",
        hdrElapsedMs:"elapsed_ms",
        hdrHxHz:"hx_hz",
        hdrCpuUs:"cpu_us",
        hdrSwitch:"switch",
        hdrIgnOk:"ign_ok",
        hdrRelay:"relay",
        hdrIgs:"igs_mode",
        hdrState:"state",
        hdrTdMs:"td_ms",
        hdrRelTime:"rel_time_s",
        hdrIgnWindowFlag:"is_ignition_window",
        chartTitleIgnition:"Thrust/Pressure in ignition window (elapsed_ms)",
        chartTitleThrust:"Thrust chart (ignition window)",
        chartTitleThrustN:"Thrust (N) chart (ignition window)",
        chartTitlePressure:"Pressure chart (ignition window)",
        statusLockout:"LOCKOUT",
        statusAbort:"ABORT",
        statusIgnition:"IGNITION",
        statusCountdown:"COUNTDOWN",
        statusNotArmed:"NOT ARMED",
        statusReady:"READY",
        statusLoadcellCheck:"LOADCELL CHECK",
        statusSequence:"SEQUENCE",
        statusLockoutText:"Abnormal relay HIGH detected ({name}). Control revoked. Restart the board.",
        statusAbortText:"Sequence aborted.",
        statusAbortTextReason:"Sequence aborted. ({reason})",
        statusIgnitionText:"Igniter firing.",
        statusCountdownText:"Launch countdown in progress",
        statusSequenceText:"Sequence in progress",
        statusNotArmedTextReady:"Igniter open / ignition sequence allowed",
        statusNotArmedTextBlocked:"Igniter open / ignition sequence blocked",
        statusReadyText:"System ready",
        sequenceReadyBtn:"READY",
        sequenceStartBtn:"SEQUENCE START",
        sequenceEndBtn:"SEQUENCE END",
        sequenceEndLog:"Sequence end requested.",
        sequenceEndToast:"Sequence ended.",
        relaySafeLockout:"LOCKOUT({name})",
        relaySafeSafe:"SAFE",
        relaySafeOff:"OFF",
        serialOff:"OFF",
        serialConnected:"CONNECTED",
        serialDisconnected:"DISCONNECTED",
        inspectFailToast:"Inspection failed. Check the status.",
        inspectFailLog:"Inspection failed: some items did not pass.",
        inspectPassToast:"Inspection passed. Control authority acquired.",
        inspectPassLog:"Inspection complete. Control authority acquired.",
        wsReconnect:"WebSocket reconnect scheduled ({reason}).",
        wsConnecting:"WebSocket connecting: {url}",
        wsConnected:"WebSocket connected: {url}",
        wsClosed:"WebSocket closed (code {code}, reason {reason}).",
        wsError:"WebSocket error.",
        wsAlertTitle:"WebSocket disconnected",
        wsAlertText:"WebSocket is not connected, so data is shown at 10 Hz.<br>Refresh the browser to fix it.",
        wsAlertClose:"Close",
        deviceDisconnectedTitle:"Device disconnected",
        deviceDisconnectedText:"Connection to the device was lost.<br>Check cable/power.",
        deviceDisconnectedOk:"OK",
        wsLost:"Dashboard lost connection to board.",
        boardUnstable:"Board response is unstable. Check power/wiring/Wi-Fi/polling interval.",
        alarmWsDisconnected:"WebSocket disconnected. Real-time stream is down.",
        alarmWsRecovered:"WebSocket connection recovered.",
        alarmDataTimeout:"No data received for too long. Check communication/power. ({ms} ms)",
        alarmDataTimeoutClear:"Data reception has recovered.",
        alarmRxHzDrop:"Data receive rate dropped. Target {target} Hz, current {hz} Hz.",
        alarmRxHzRecovered:"Data receive rate recovered to normal range.",
        alarmRelayLockout:"LOCKOUT triggered by abnormal relay HIGH. ({name}) Restart the board.",
        alarmWsBackpressure:"WebSocket send queue backpressure detected. Total {total} (this +{delta}).",
        alarmReplayFormat:"Replay file format error: {reason}",
        alarmReplayAutoStop:"Replay reached end-of-data and stopped automatically.",
        alarmInternalException:"Repeated internal exceptions detected. source={source}, error={err}",
        webserialUnsupported:"This browser does not support WebSerial. (Chrome/Edge recommended)",
        webserialConnected:"WebSerial connected @460800.",
        webserialConnectedToast:"Serial (WebSerial) connected.",
        serialReadEnded:"Serial read loop ended: {err}",
        webserialConnectFailed:"WebSerial connect failed: {err}",
        webserialConnectFailedToast:"Serial connect failed. Check port/permissions.",
        webserialDisconnected:"WebSerial disconnected.",
        serialWriteFailed:"Serial write failed: {err}",
        linkEstablished:"Link established ({src}).",
        linkEstablishedToast:"Connected to board. ({src})",
        lockoutDetectedLog:"LOCKOUT: abnormal relay HIGH detected ({name}). Control revoked. Restart required.",
        lockoutDetectedToast:"Abnormal relay HIGH detected ({name}). Control revoked. Restart the board.",
        ignitionSignal:"Ignition signal detected (st=2). Tracking thrust over {thr} kgf.",
        ignitionThresholdLog:"Thrust exceeded {thr} kgf. Ignition delay = {delay}s",
        ignitionThresholdToast:"Thrust exceeded threshold ({thr} kgf). Ignition delay ≈ {delay}s. {safety}",
        ignitionEndLog:"Ignition state finished. Burn duration ≈ {dur}s",
        ignitionEndToast:"Effective thrust window ended. Approach after residual heat/gas.",
        ignitionNoThrustLog:"Ignition state finished. No thrust over threshold detected.",
        ignitionNoThrustToast:"Ignition ended. No effective thrust detected. Check wiring/igniter. {safety}",
        switchHighLog:"Switch changed: HIGH (ON).",
        switchHighToast:"Switch is HIGH (ON). Recheck sequence conditions and safety. {safety}",
        switchLowLog:"Switch changed: LOW (OFF).",
        switchLowToast:"Switch is LOW (OFF). Keep safe state. {safety}",
        igniterOkLog:"Igniter continuity: OK.",
        igniterOkToast:"Igniter state changed to OK. Recheck wiring/short/polarity before ignition. {safety}",
        igniterNoLog:"Igniter continuity: NO / OPEN.",
        igniterNoToast:"Igniter is NO(OPEN). Check connector/wiring/open circuit. {safety}",
        igsOnLog:"Igniter Safety Test: ON (from board).",
        igsOnToast:"Igniter Safety Test is ON. Risk of unintended power. {safety}",
        igsOffLog:"Igniter Safety Test: OFF (from board).",
        igsOffToast:"Igniter Safety Test is OFF. Returned to safe state. {safety}",
        countdownStartLog:"Countdown started (st=1).",
        countdownStartToast:"Countdown started. Maintain safe distance. {safety}",
        ignitionFiringLog:"Ignition firing (st=2).",
        ignitionFiringToast:"Ignition sequence in progress. Do not approach. {safety}",
        sequenceCompleteLog:"Sequence complete. Back to idle.",
        sequenceCompleteToast:"Sequence complete. Approach after residual heat/gas.",
        sequenceAbortedLog:"Sequence aborted.",
        sequenceAbortedToast:"ABORT processed. Recheck wiring/switch/environment before retry. {safety}",
        sequenceAbortedToastReason:"Sequence aborted. ({reason}) {safety}",
        abortReasonUser:"User abort",
        abortReasonIgniter:"Igniter short",
        abortReasonLockout:"Relay LOCKOUT",
        abortReasonUnknown:"Unknown reason",
        notArmedToast:"NOT ARMED. Check igniter connection. {safety}",
        lockoutDetectedToastShort:"Abnormal relay HIGH detected ({name}). All control stopped. Restart the board.",
        pollingErrorLog:"Polling error: {err}",
        pollingErrorToast:"Polling error occurred. Check the log.",
        lockoutNoControl:"LOCKOUT state: no control allowed. Restart the board.",
        inspectionRequiredToast:"Complete inspection first. Control authority is granted after pass.",
        preSequenceToast:"Do final safety check before sequence. Hold 3 seconds to enter. {safety}",
        inspectionRequiredShort:"Complete inspection first. Control authority required.",
        countdownRequestedLog:"Countdown requested from dashboard (long-press).",
        countdownRequestedToast:"Countdown request sent to board. Keep checking signal/wiring/area. {safety}",
        countdownIgniterRequired:"Countdown blocked: igniter missing while IGS is enabled. {safety}",
        longPressCanceledToast:"Long-press canceled. Try again after securing safety. {safety}",
        lockoutForceDenied:"LOCKOUT state: control including force ignition is not allowed. Restart the board.",
        forceNotAllowed:"Force ignition is not allowed during sequence.",
        forceWarning:"Force ignition is high risk. Proceed after final check. {safety}",
        forceIgniterRequired:"Force ignition requires igniter OK when IGS is enabled.",
        lockoutControlDenied:"LOCKOUT state: control not allowed.",
        inspectionRequiredPlain:"Complete inspection first.",
        launcherUpDownLog:"Launcher {dir} command sent.",
        dirStop:"STOP",
        lockoutCmdDenied:"LOCKOUT({name}) cannot send command. Restart the board.",
        cmdSentLog:"CMD => {cmd}",
        systemReadyLog:"System ready. Waiting for commands.",
        dashboardStartToast:"Dashboard started. Check connection before operation. {safety}",
        relaySafeOnToast:"RelaySafe is ON. LOCKOUT on abnormal relay HIGH.",
        relaySafeOffToast:"RelaySafe is OFF. (Not recommended)",
        igsToggledLog:"Igniter Safety Test toggled: {state}",
        igsToggledOnToast:"Igniter Safety Test is ON. Watch igniter/wiring. {safety}",
        igsToggledOffToast:"Igniter Safety Test is OFF. Keep safe state. {safety}",
        serialRxOnToast:"Serial RX parsing ON",
        serialRxOffToast:"Serial RX parsing OFF",
        serialTxOnToast:"Serial TX ON",
        serialTxOffToast:"Serial TX OFF",
        lockoutAbortDenied:"LOCKOUT({name}) cannot ABORT. Restart the board.",
        abortRequestedToast:"ABORT request sent to board. Recheck safety before retry. {safety}",
        inspectionOpenToast:"Connect to board before running inspection.",
        inspectionWait:"Wait",
        inspectionRunningLabel:"Run",
        inspectionChecking:"Checking",
        inspectionOk:"OK",
        inspectionNeed:"Check",
        inspectionSkip:"SKIP",
        inspectionIdleText:"Inspection ready…",
        inspectionRunningText:"Inspection running…",
        forceRequestedToast:"Force ignition request sent to board. Do not approach. {safety}",
        lockoutAckLog:"LOCKOUT acknowledged ({name}). Restart required.",
        lockoutAckToast:"LOCKOUT({name}) acknowledged (logged). Restart the board.",
        logCopiedLog:"Log copied to clipboard.",
        logCopiedToast:"Log copied to clipboard.",
        clipboardCopyFailedLog:"Clipboard copy failed.",
        clipboardCopyFailedToast:"Clipboard copy failed. Check browser permissions.",
        copyFailedLog:"Copy failed: {err}",
        copyFailedToast:"Copy failed. Check browser policy.",
        xlsxExportLog:"Report exported (ZIP): {filename}",
        xlsxExportToast:"Exported report as .zip file.",
        thrustUnitChangedToast:"Thrust unit changed {from} → {to}. Display only. {safety}",
        ignTimeChangedToast:"Ignition time changed {from}s → {to}s. Watch heating/drive time. {safety}",
        countdownChangedToast:"Countdown changed {from}s → {to}s. Allow enough clearance time. {safety}",
        settingsUpdatedLog:"Settings updated: thrustUnit={unit}, ignDuration={ign}s, countdown={cd}s",
        loadcellSettingsTitle:"Loadcell Calibration",
        loadcellSettingsLabel:"Loadcell zero/calibration",
        loadcellSettingsHint:"Save zero/calibration values to the board.",
        loadcellOpenBtn:"Loadcell Zero Adjust",
        loadcellModalTitle:"Loadcell Zero Adjust",
        loadcellModalBadge:"Calibration",
        loadcellModalGuide:"Place the weight, verify the reading, then tap Next.",
        loadcellModalValueLabel:"Current reading (kg)",
        loadcellModalValueHint:"Calibration is stored in kg.",
        loadcellModalInputLabel:"Enter weight (kg)",
        loadcellModalInputHint:"e.g. 1.250",
        loadcellModalNote:"This value is saved to the board.",
        loadcellModalApply:"Next",
        loadcellModalCancel:"Cancel",
        loadcellZeroSaveBtn:"Save Zero",
        loadcellModalConfirmTitle:"Save calibration?",
        loadcellModalConfirmText:"Save calibration using {weight} kg. Previous data will be overwritten.",
        loadcellModalConfirmSub:"Measurement baseline will change after saving. Remove the weight and verify the reading.",
        loadcellModalConfirmProceed:"Proceed",
        loadcellModalConfirmCancel:"Cancel",
        loadcellZeroConfirmTitle:"Save zero?",
        loadcellZeroConfirmText:"Save current state as zero. Previous zero will be overwritten.",
        loadcellWeightInvalidToast:"Enter a valid weight.",
        loadcellZeroSaveSuccessToast:"Loadcell zero saved.",
        loadcellZeroSaveFailToast:"Failed to save loadcell zero.",
        loadcellSaveSuccessToast:"Loadcell calibration saved.",
        loadcellSaveFailToast:"Failed to save loadcell calibration.",
        loadcellZeroSaveLog:"Loadcell zero save requested",
        loadcellSaveLog:"Loadcell calibration requested (weight={weight} kg)"
      }
    };

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
      updateSerialControlTile();
      updateExportGuardUi();
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
    function updateSerialControlTile(){
      if(!el.serialControlTitle || !el.serialControlSub || !el.serialTogglePill || !el.serialControlTile) return;
      if(simEnabled){
        el.serialControlTitle.textContent = t("controlDevToolsLabel");
        el.serialControlSub.textContent = t("controlDevToolsSub");
        el.serialTogglePill.style.display = "none";
      }else{
        el.serialControlTitle.textContent = t("controlSerialLabel");
        el.serialControlSub.textContent = t("controlSerialSub");
        el.serialTogglePill.style.display = "inline-flex";
      }
    }
    function setDevToolsVisible(show){
      if(!el.controlsCard || !el.controlsMain || !el.devToolsPanel || !el.controlsHeader) return;
      el.controlsCard.classList.toggle("devtools-mode", !!show);
      el.controlsHeader.classList.toggle("hidden", !!show);
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
      if(simEnabled){
        lockoutLatched = devRelay1Locked || devRelay2Locked;
        lockoutRelayMask = (devRelay1Locked ? 1 : 0) | (devRelay2Locked ? 2 : 0);
        setLockoutVisual(lockoutLatched);
        updateRelaySafePill();
        setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
        if(lockoutLatched){
          simState.st = 0;
          simState.countdownStartMs = null;
          simState.ignStartMs = null;
          simState.cdMs = 0;
          simState.countdownTotalMs = null;
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

    function applySettingsToUI(){
      if(!uiSettings) return;
      const thrustLabel = document.querySelector('[data-label="thrust-unit"]');
      const thrustBadge = document.querySelector('[data-badge="thrust-unit"]');
      const pressureBadge = document.querySelector('[data-badge="pressure-unit"]');

      if(thrustLabel) thrustLabel.textContent = uiSettings.thrustUnit;
      if(thrustBadge) thrustBadge.textContent = "RED · " + uiSettings.thrustUnit;
      if(pressureBadge) pressureBadge.textContent = "BLUE · V";

      if(el.unitThrust) el.unitThrust.value = uiSettings.thrustUnit;
      if(el.ignTimeInput) el.ignTimeInput.value = uiSettings.ignDurationSec;
      if(el.countdownSecInput) el.countdownSecInput.value = uiSettings.countdownSec;
      if(el.opModeSelect) el.opModeSelect.value = uiSettings.opMode || "daq";
      if(el.gyroPreviewSelect) el.gyroPreviewSelect.value = uiSettings.gyroPreview || "3d";

      if(el.relaySafeToggle) el.relaySafeToggle.checked = !!uiSettings.relaySafe;
      if(el.safeModeToggle){
        el.safeModeToggle.checked = !!uiSettings.safetyMode;
        updateTogglePill(el.safeModePill, el.safeModeToggle.checked);
      }
      if(el.igswitch) el.igswitch.checked = !!uiSettings.igs;

      if(el.serialToggle){
        el.serialToggle.checked = !!uiSettings.serialEnabled;
        updateTogglePill(el.serialTogglePill, el.serialToggle.checked);
      }
      if(el.serialRxToggle) el.serialRxToggle.checked = uiSettings.serialRx !== false;
      if(el.serialTxToggle) el.serialTxToggle.checked = uiSettings.serialTx !== false;
      if(el.simToggle) el.simToggle.checked = !!uiSettings.simEnabled;
      if(el.langSelect) el.langSelect.value = (uiSettings.lang === "en") ? "en" : "ko";
      if(el.themeToggle) el.themeToggle.checked = (uiSettings.theme === "dark");
      document.documentElement.classList.toggle("mode-flight", uiSettings.opMode === "flight");
      document.documentElement.classList.toggle("mode-daq", uiSettings.opMode !== "flight");
      document.documentElement.classList.toggle("preview-3d", (uiSettings.gyroPreview || "3d") === "3d");
      document.documentElement.classList.toggle("preview-navball", (uiSettings.gyroPreview || "3d") === "navball");

      updateRelaySafePill();
      updateSerialPill();
      updateStaticTexts();
      updateSerialControlTile();
      updateExportGuardUi();
      refreshStatusMapMarkerContent();
      refreshStatusMapSize();
    }
    const delay = (ms)=>new Promise(resolve=>setTimeout(resolve, ms));
    function setOverlayVisible(node, visible, displayMode){
      if(!node) return;
      if(visible){
        node.classList.remove("hidden");
        node.style.display = displayMode || "flex";
      }else{
        node.classList.add("hidden");
        node.style.display = "none";
      }
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
        if(item) item.classList.toggle("relay-lockout", !!r2Blink);
      }
    }

    function lockoutImgSrc(mask){
      if(mask===1) return "img/RS_1.svg";
      if(mask===2) return "img/RS_2.svg";
      if(mask===3) return "img/RS_all.svg";
      return "img/RS_all.svg";
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
    function showDisconnectOverlay(){
      hideMobileControlsPanel();
      if(!el.disconnectOverlay) return;
      if(el.disconnectTitle) el.disconnectTitle.textContent = t("deviceDisconnectedTitle");
      if(el.disconnectText) el.disconnectText.innerHTML = t("deviceDisconnectedText");
      setOverlayVisible(el.disconnectOverlay, true);
    }
    function hideDisconnectOverlay(){
      setOverlayVisible(el.disconnectOverlay, false);
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
    function updateTogglePill(pillEl, checked){
      if(!pillEl) return;
      pillEl.textContent = checked ? "ON" : "OFF";
      pillEl.classList.toggle("is-on", !!checked);
      pillEl.classList.toggle("is-off", !checked);
    }

    function resetSimState(){
      simState = {st:0, cdMs:0, countdownStartMs:null, ignStartMs:null, countdownTotalMs:null};
    }
    function setSimEnabled(enabled, opts){
      const silent = !!(opts && opts.silent);
      simEnabled = !!enabled;
      if(uiSettings){
        uiSettings.simEnabled = simEnabled;
        saveSettings();
      }
      if(simEnabled){
        resetSimState();
        lockoutLatched = false;
        lockoutRelayMask = 0;
        devLoadcellError = false;
        hideLockoutModal();
        setLockoutVisual(false);
        resetInspectionUI();
        onIncomingSample(buildSimSample(), "SIMULATION");
      }else{
        resetSimState();
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
      if(simState.st === 1){
        if(!simState.countdownStartMs) simState.countdownStartMs = now;
        const total = (simState.countdownTotalMs != null)
          ? simState.countdownTotalMs
          : ((uiSettings ? uiSettings.countdownSec : 10) * 1000);
        const remain = Math.max(0, total - (now - simState.countdownStartMs));
        simState.cdMs = remain;
        if(remain <= 0){
          simState.st = 2;
          simState.ignStartMs = now;
          simState.countdownStartMs = null;
          simState.cdMs = 0;
          simState.countdownTotalMs = null;
        }
      }else if(simState.st === 2){
        if(!simState.ignStartMs) simState.ignStartMs = now;
        const ignMs = (uiSettings ? uiSettings.ignDurationSec : 5) * 1000;
        if(now - simState.ignStartMs >= ignMs){
          simState.st = 0;
          simState.ignStartMs = null;
        }
      }

      let thrust = 0.15 + 0.05 * Math.sin(now / 420);
      let pressure = 0.2 + 0.08 * Math.sin(now / 360);
      if(simState.st === 1){
        thrust = 0.35 + 0.08 * Math.sin(now / 240);
        pressure = 0.4 + 0.12 * Math.sin(now / 260);
      }else if(simState.st === 2){
        thrust = 3.5 + 1.6 * Math.sin(now / 110);
        pressure = 1.2 + 0.6 * Math.sin(now / 140);
      }

      const ax = 0.02 * Math.sin(now / 260);
      const ay = 0.02 * Math.cos(now / 300);
      const az = 1.0 + 0.04 * Math.sin(now / 210);
      const gx = 0.8 * Math.sin(now / 180);
      const gy = 0.6 * Math.cos(now / 210);
      const gz = 0.4 * Math.sin(now / 160);

      const simTd = (simState.st === 1)
        ? -Math.max(0, simState.cdMs)
        : (simState.st === 2 && simState.ignStartMs ? (now - simState.ignStartMs) : 0);
      return {
        t: thrust,
        p: pressure,
        ax,
        ay,
        az,
        gx,
        gy,
        gz,
        lt: 10,
        hz: Math.round(1000 / POLL_INTERVAL),
        ct: 2000,
        s: 0,
        ic: 1,
        r: simState.st === 2 ? 1 : 0,
        st: simState.st,
        td: simTd,
        gs: (uiSettings && uiSettings.igs) ? 1 : 0,
        m: 2
      };
    }

    // =====================
    // UI 헬퍼
    // =====================
    function showTetrisOverlay(){
      hideMobileControlsPanel();
      if(el.tetrisOverlay){
        el.tetrisOverlay.classList.remove("hidden");
        el.tetrisOverlay.setAttribute("aria-hidden","false");
      }
      if(el.logView) el.logView.style.display = "none";
      if(el.termTitle) el.termTitle.textContent = "hanwool-tms@board: tetris";
    }

    function hideTetrisOverlay(){
      if(el.tetrisOverlay){
        el.tetrisOverlay.classList.add("hidden");
        el.tetrisOverlay.setAttribute("aria-hidden","true");
      }
      if(el.logView) el.logView.style.display = "block";
      if(el.termTitle) el.termTitle.textContent = "hanwool-tms@board: ~";
    }

    function createTetrisGrid(){
      return Array.from({length: TETRIS_H}, ()=>Array(TETRIS_W).fill(0));
    }

    function pieceCells(piece, rot){
      return TETRIS_SHAPES[piece.shape][rot];
    }

    function collides(piece, nx, ny, nrot){
      const cells = pieceCells(piece, nrot);
      for(const [cx, cy] of cells){
        const x = nx + cx;
        const y = ny + cy;
        if(x < 0 || x >= TETRIS_W || y >= TETRIS_H) return true;
        if(y >= 0 && tetrisState.grid[y][x]) return true;
      }
      return false;
    }

    function makePiece(shape){
      return {shape, rot:0, x:3, y:0};
    }

    function spawnPiece(){
      if(tetrisState.nextPiece == null){
        tetrisState.nextPiece = {shape: Math.floor(Math.random() * TETRIS_SHAPES.length), rot:0, x:0, y:0};
      }
      const piece = makePiece(tetrisState.nextPiece.shape);
      tetrisState.nextPiece = {shape: Math.floor(Math.random() * TETRIS_SHAPES.length), rot:0, x:0, y:0};
      if(collides(piece, piece.x, piece.y, piece.rot)){
        tetrisState.gameOver = true;
        return;
      }
      tetrisState.piece = piece;
      tetrisState.lockStartMs = null;
    }

    function clearLines(){
      let cleared = 0;
      for(let y = TETRIS_H - 1; y >= 0; y--){
        let full = true;
        for(let x = 0; x < TETRIS_W; x++){
          if(!tetrisState.grid[y][x]){ full = false; break; }
        }
        if(full){
          tetrisState.grid.splice(y, 1);
          tetrisState.grid.unshift(Array(TETRIS_W).fill(0));
          cleared += 1;
          y += 1;
        }
      }
      if(cleared > 0){
        tetrisState.lines += cleared;
        tetrisState.score += cleared;
        if(tetrisState.score >= 10){
          tetrisState.win = true;
          showTetrisWin();
        }
      }
    }

    function lockPiece(){
      const {piece} = tetrisState;
      for(const [cx, cy] of pieceCells(piece, piece.rot)){
        const x = piece.x + cx;
        const y = piece.y + cy;
        if(y >= 0 && y < TETRIS_H && x >= 0 && x < TETRIS_W){
          tetrisState.grid[y][x] = 1;
        }
      }
      clearLines();
      tetrisState.lockStartMs = null;
      spawnPiece();
      tetrisState.holdUsed = false;
    }

    function movePiece(dx, dy){
      const {piece} = tetrisState;
      const nx = piece.x + dx;
      const ny = piece.y + dy;
      if(collides(piece, nx, ny, piece.rot)) return false;
      piece.x = nx;
      piece.y = ny;
      tetrisState.lockStartMs = null;
      return true;
    }

    function rotatePiece(){
      const {piece} = tetrisState;
      const nr = (piece.rot + 1) % 4;
      if(!collides(piece, piece.x, piece.y, nr)){
        piece.rot = nr;
        tetrisState.lockStartMs = null;
      }
    }

    function stepTetris(){
      if(!tetrisState || tetrisState.gameOver) return;
      if(!movePiece(0, 1)){
        const now = Date.now();
        if(!tetrisState.lockStartMs){
          tetrisState.lockStartMs = now;
        }else if(now - tetrisState.lockStartMs >= TETRIS_LOCK_DELAY_MS){
          lockPiece();
        }
      }
      renderTetris();
      if(tetrisState && tetrisState.win) stopTetris();
    }

    function startTetris(){
      if(tetrisActive) return;
      tetrisActive = true;
      tetrisWinShown = false;
      hideTetrisWin();
      tetrisState = {
        grid: createTetrisGrid(),
        piece: null,
        score: 0,
        lines: 0,
        gameOver: false,
        intro: true,
        nextPiece: null,
        holdPiece: null,
        holdUsed: false,
        win: false,
        lockStartMs: null
      };
      showTetrisOverlay();
      renderTetris();

      tetrisKeyHandler = (ev)=>{
        if(!tetrisActive || !tetrisState) return;
        if(tetrisState.intro){
          if(ev.key === "Enter" || ev.key === " "){
            tetrisState.intro = false;
            spawnPiece();
            renderTetris();
            ev.preventDefault();
          }else if(ev.key === "Escape"){
            stopTetris();
            ev.preventDefault();
          }
          return;
        }
        if(tetrisState.gameOver && ev.key !== "Enter" && ev.key !== "Escape") return;
        if(ev.key === "ArrowLeft"){
          movePiece(-1, 0);
          renderTetris();
          ev.preventDefault();
        }else if(ev.key === "ArrowRight"){
          movePiece(1, 0);
          renderTetris();
          ev.preventDefault();
        }else if(ev.key === "ArrowDown"){
          movePiece(0, 1);
          renderTetris();
          ev.preventDefault();
        }else if(ev.key === "ArrowUp"){
          rotatePiece();
          renderTetris();
          ev.preventDefault();
        }else if(ev.key === "c" || ev.key === "C" || ev.code === "KeyC"){
          holdCurrentPiece();
          ev.preventDefault();
        }else if(ev.key === "Escape"){
          stopTetris();
          ev.preventDefault();
        }else if(ev.key === "Enter" && tetrisState.gameOver){
          tetrisState.grid = createTetrisGrid();
          tetrisState.score = 0;
          tetrisState.lines = 0;
          tetrisState.gameOver = false;
          tetrisState.intro = false;
          tetrisState.nextPiece = null;
          tetrisState.holdPiece = null;
          tetrisState.holdUsed = false;
          tetrisState.win = false;
          tetrisWinShown = false;
          hideTetrisWin();
          spawnPiece();
          renderTetris();
          ev.preventDefault();
        }
      };
      document.addEventListener("keydown", tetrisKeyHandler);

      tetrisTimer = setInterval(()=>{
        if(!tetrisActive || !tetrisState || tetrisState.gameOver || tetrisState.intro) return;
        stepTetris();
      }, TETRIS_TICK_MS);
    }

    function stopTetris(){
      tetrisActive = false;
      if(tetrisTimer){ clearInterval(tetrisTimer); tetrisTimer = null; }
      if(tetrisKeyHandler){
        document.removeEventListener("keydown", tetrisKeyHandler);
        tetrisKeyHandler = null;
      }
      hideTetrisOverlay();
      tetrisState = null;
    }

    function holdCurrentPiece(){
      if(!tetrisState || tetrisState.holdUsed || tetrisState.gameOver || tetrisState.intro) return;
      const current = tetrisState.piece;
      if(!current) return;
      const shape = current.shape;
      if(tetrisState.holdPiece == null){
        tetrisState.holdPiece = shape;
        spawnPiece();
      }else{
        const swapShape = tetrisState.holdPiece;
        tetrisState.holdPiece = shape;
        const next = makePiece(swapShape);
        if(collides(next, next.x, next.y, next.rot)){
          tetrisState.gameOver = true;
        }else{
          tetrisState.piece = next;
        }
      }
      tetrisState.lockStartMs = null;
      tetrisState.holdUsed = true;
      renderTetris();
    }

    function writeOverlayMsg(rows, rowIndex, msg){
      const row = rows[rowIndex].split("");
      const insideWidth = Math.max(0, row.length - 2);
      const start = Math.max(1, Math.floor((insideWidth - msg.length) / 2) + 1);
      for(let i = 0; i < msg.length && (start + i) < row.length - 1; i++){
        row[start + i] = msg[i];
      }
      rows[rowIndex] = row.join("");
    }

    function renderTetris(){
      if(!el.tetrisScreen || !tetrisState) return;
      const rows = [];
      const panel = [];
      const displayW = TETRIS_W * TETRIS_SCALE_X;
      const totalRows = (TETRIS_H * TETRIS_SCALE_Y) + 2;
      for(let i = 0; i < totalRows; i++) panel.push("");

      if(tetrisState.intro){
        const panelWidth = panel[0].length || 1;
        const totalWidth = (displayW + 2) + panelWidth;
        const blank = " ".repeat(totalWidth);
        for(let i = 0; i < totalRows; i++) rows.push(blank);
        const art = [
          "     H  H  AA  N  N W  W  OO   OO  L       ",
          "     H  H A  A NN N W  W O  O O  O L       ",
          "     HHHH AAAA N NN W WW O  O O  O L       ",
          "     H  H A  A N  N WW W O  O O  O L       ",
          "     H  H A  A N  N W  W  OO   OO  LLLL    ",
          "",
          "                   TETRIS                  ",
          "                 With ALTIS                "
        ];
        const mid = Math.max(0, Math.floor(totalRows / 2) - 5);
        for(let i = 0; i < art.length; i++){
          const text = art[i];
          const start = Math.max(0, Math.floor((totalWidth - text.length) / 2));
          rows[mid + i] = blank.slice(0, start) + text + blank.slice(start + text.length);
        }
        const hint = "                PRESS ENTER                ";
        const hintRow = mid + art.length + 1;
        if(hintRow < rows.length){
          const start = Math.max(0, Math.floor((totalWidth - hint.length) / 2));
          rows[hintRow] = blank.slice(0, start) + hint + blank.slice(start + hint.length);
        }
      }else{
        const holdPreview = Array.from({length:4}, ()=>Array(4).fill("."));
        if(tetrisState.holdPiece != null){
          const shape = tetrisState.holdPiece;
          for(const [cx, cy] of TETRIS_SHAPES[shape][0]){
            if(cx >= 0 && cx < 4 && cy >= 0 && cy < 4){
              holdPreview[cy][cx] = "#";
            }
          }
        }
        const holdLines = holdPreview.map(r=>r.map(c=>c === "#" ? TETRIS_CELL_ON : TETRIS_CELL_OFF).join(""));

        const preview = Array.from({length:4}, ()=>Array(4).fill("."));
        if(tetrisState.nextPiece){
          const shape = tetrisState.nextPiece.shape;
          for(const [cx, cy] of TETRIS_SHAPES[shape][0]){
            if(cx >= 0 && cx < 4 && cy >= 0 && cy < 4){
              preview[cy][cx] = "#";
            }
          }
        }
        const previewLines = preview.map(r=>r.map(c=>c === "#" ? TETRIS_CELL_ON : TETRIS_CELL_OFF).join(""));
        const panelBoxWidth = 4 * TETRIS_SCALE_X;
        panel[0] = "  HOLD";
        panel[1] = "  +" + "-".repeat(panelBoxWidth) + "+";
        for(let i = 0; i < 4; i++){
          panel[2 + i] = "  |" + holdLines[i] + "|";
        }
        panel[6] = "  +" + "-".repeat(panelBoxWidth) + "+";
        const clearCount = Math.min(tetrisState.score, 10);
        panel[7] = "  CLEAR " + String(clearCount).padStart(2, "0") + "/10";
        panel[8] = "  NEXT";
        panel[9] = "  +" + "-".repeat(panelBoxWidth) + "+";
        for(let i = 0; i < 4; i++){
          panel[10 + i] = "  |" + previewLines[i] + "|";
        }
        panel[14] = "  +" + "-".repeat(panelBoxWidth) + "+";

        rows.push("+" + "-".repeat(displayW) + "+");
        const {piece} = tetrisState;
        for(let y = 0; y < TETRIS_H; y++){
          let line = "|";
          for(let x = 0; x < TETRIS_W; x++){
            let filled = tetrisState.grid[y][x] ? 1 : 0;
            if(piece && !tetrisState.gameOver){
              for(const [cx, cy] of pieceCells(piece, piece.rot)){
                if(piece.x + cx === x && piece.y + cy === y){
                  filled = 1;
                  break;
                }
              }
            }
            line += filled ? TETRIS_CELL_ON : TETRIS_CELL_OFF;
          }
          line += "|";
          for(let sy = 0; sy < TETRIS_SCALE_Y; sy++){
            rows.push(line);
          }
        }
        rows.push("+" + "-".repeat(displayW) + "+");

        if(tetrisState.gameOver){
          const mid = Math.floor(rows.length / 2);
          writeOverlayMsg(rows, Math.max(1, mid - 1), "GAME OVER");
          writeOverlayMsg(rows, Math.min(rows.length - 2, mid), "ENTER TO R");
        }
      }

      if(el.tetrisScore){
        el.tetrisScore.textContent = "TETRIS · SCORE " + String(tetrisState.score).padStart(4, "0");
      }
      if(el.tetrisLines){
        el.tetrisLines.textContent = "LINES " + String(tetrisState.lines);
      }

      const out = rows.map((row, idx)=>row + (panel[idx] || ""));
      el.tetrisScreen.textContent = out.join("\n");
    }

    function formatStatusMapCoord(v){
      return Number(v).toFixed(5);
    }
    function isStatusMapInKorea(lat, lon){
      return lat >= STATUS_MAP_KR_BOUNDS.south &&
             lat <= STATUS_MAP_KR_BOUNDS.north &&
             lon >= STATUS_MAP_KR_BOUNDS.west &&
             lon <= STATUS_MAP_KR_BOUNDS.east;
    }
    function clampStatusMapToKorea(lat, lon){
      return {
        lat: Math.max(STATUS_MAP_KR_BOUNDS.south, Math.min(STATUS_MAP_KR_BOUNDS.north, lat)),
        lon: Math.max(STATUS_MAP_KR_BOUNDS.west, Math.min(STATUS_MAP_KR_BOUNDS.east, lon))
      };
    }
    function projectStatusMapOffline(lat, lon){
      const pos = clampStatusMapToKorea(lat, lon);
      const nx = (pos.lon - STATUS_MAP_KR_BOUNDS.west) / (STATUS_MAP_KR_BOUNDS.east - STATUS_MAP_KR_BOUNDS.west);
      const ny = (STATUS_MAP_KR_BOUNDS.north - pos.lat) / (STATUS_MAP_KR_BOUNDS.north - STATUS_MAP_KR_BOUNDS.south);
      return {
        x: STATUS_MAP_OFFLINE_VIEW.left + nx * STATUS_MAP_OFFLINE_VIEW.width,
        y: STATUS_MAP_OFFLINE_VIEW.top + ny * STATUS_MAP_OFFLINE_VIEW.height
      };
    }
    function updateStatusMapOfflineMarker(){
      if(!statusMapState.offlineMode || !statusMapState.offlineMarker) return;
      const p = projectStatusMapOffline(statusMapState.lat, statusMapState.lon);
      statusMapState.offlineMarker.style.left = p.x.toFixed(3) + "%";
      statusMapState.offlineMarker.style.top = p.y.toFixed(3) + "%";
    }
    function bindStatusMapControls(){
      if(statusMapState.uiBound) return;
      statusMapState.uiBound = true;
      if(el.statusMapRecenterBtn){
        el.statusMapRecenterBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          statusMapState.hasLiveFix = false;
          statusMapSetMarker(STATUS_MAP_DEFAULT.lat, STATUS_MAP_DEFAULT.lon, {recenter:true, zoom:STATUS_MAP_DEFAULT.zoom});
        });
      }
      if(el.statusMapCopyBtn){
        el.statusMapCopyBtn.addEventListener("click", async (ev)=>{
          ev.preventDefault();
          if(!statusMapState.hasLiveFix){
            const prevNoGps = el.statusMapCopyBtn.textContent;
            el.statusMapCopyBtn.textContent = "No GPS";
            setTimeout(()=>{
              if(el.statusMapCopyBtn) el.statusMapCopyBtn.textContent = prevNoGps;
            }, 900);
            return;
          }
          const txt = formatStatusMapCoord(statusMapState.lat) + ", " + formatStatusMapCoord(statusMapState.lon);
          const ok = await copyTextSafe(txt);
          const prev = el.statusMapCopyBtn.textContent;
          el.statusMapCopyBtn.textContent = ok ? "✓ Copied" : "Copy failed";
          setTimeout(()=>{
            if(el.statusMapCopyBtn) el.statusMapCopyBtn.textContent = prev;
          }, 900);
        });
      }
    }
    function initStatusMapOffline(){
      if(!el.statusMap) return;
      statusMapState.offlineMode = true;
      statusMapState.map = null;
      statusMapState.marker = null;
      statusMapState.markerExpanded = false;
      el.statusMap.innerHTML = "";
      el.statusMap.classList.remove("leaflet-container");
      el.statusMap.classList.add("status-map-canvas--offline");

      const root = document.createElement("div");
      root.className = "status-map-offline";

      const kr = document.createElement("div");
      kr.className = "status-map-offline-kr";
      const jeju = document.createElement("div");
      jeju.className = "status-map-offline-jeju";
      const label = document.createElement("div");
      label.className = "status-map-offline-label";
      label.textContent = "KR OFFLINE";
      const marker = document.createElement("div");
      marker.className = "status-map-offline-marker";
      marker.textContent = "🚀";

      root.appendChild(kr);
      root.appendChild(jeju);
      root.appendChild(label);
      root.appendChild(marker);
      el.statusMap.appendChild(root);

      statusMapState.offlineRoot = root;
      statusMapState.offlineMarker = marker;
      updateStatusMapOfflineMarker();
    }
    function updateStatusMapHud(){
      if(!el.statusMapCoordText || !el.statusMapZoomText) return;
      if(statusMapState.hasLiveFix){
        el.statusMapCoordText.textContent = formatStatusMapCoord(statusMapState.lat) + " , " + formatStatusMapCoord(statusMapState.lon);
      }else{
        el.statusMapCoordText.textContent = "-- , --";
      }
      if(statusMapState.offlineMode){
        el.statusMapZoomText.textContent = "KR offline";
      }else{
        const zoomVal = (statusMapState.map && isFinite(statusMapState.map.getZoom())) ? statusMapState.map.getZoom() : statusMapState.zoom;
        el.statusMapZoomText.textContent = "zoom " + String(zoomVal);
      }
    }
    function escapeStatusMapPopupText(v){
      return String(v == null ? "" : v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
    function getStatusMapMissionName(){
      const mission = (selectedMotorName || (el.missionName && el.missionName.value) || "").trim();
      return mission || "NO MISSION";
    }
    function getStatusMapPopupMode(){
      const selectMode = (el.opModeSelect && el.opModeSelect.value) ? String(el.opModeSelect.value).toLowerCase() : "";
      if(selectMode === "flight" || selectMode === "daq") return selectMode;
      const settingMode = (uiSettings && uiSettings.opMode) ? String(uiSettings.opMode).toLowerCase() : "";
      if(settingMode === "flight" || settingMode === "daq") return settingMode;
      if(document.documentElement.classList.contains("mode-daq")) return "daq";
      if(document.documentElement.classList.contains("mode-flight")) return "flight";
      return "daq";
    }
    function getStatusMapMarkerMeta(){
      const mode = getStatusMapPopupMode();
      const kind = (mode === "flight") ? "VEHICLE" : "MOTOR";
      const mission = getStatusMapMissionName();
      const modeLabel = (mode === "flight") ? "FLIGHT MODE" : "DAQ MODE";
      return {modeLabel, kind, mission};
    }
    function buildStatusMapRocketHtml(){
      const meta = getStatusMapMarkerMeta();
      return "<button class=\"status-map-rocket-pill\" type=\"button\" aria-expanded=\"false\" tabindex=\"-1\">" +
        "<span class=\"status-map-rocket-circle\"><span class=\"emoji\">🚀</span><span class=\"status-map-info-icon\">i</span></span>" +
        "<span class=\"status-map-rocket-meta\">" +
          "<span class=\"status-map-rocket-kicker\">" + escapeStatusMapPopupText(meta.modeLabel) + "</span>" +
          "<span class=\"status-map-rocket-title\">" + escapeStatusMapPopupText(meta.kind) + "</span>" +
          "<span class=\"status-map-rocket-mission\">" + escapeStatusMapPopupText(meta.mission) + "</span>" +
        "</span>" +
      "</button>";
    }
    function refreshStatusMapMarkerContent(){
      if(!statusMapState.marker || !statusMapState.marker.getElement) return;
      const markerEl = statusMapState.marker.getElement();
      if(!markerEl) return;
      const meta = getStatusMapMarkerMeta();
      const kicker = markerEl.querySelector(".status-map-rocket-kicker");
      const title = markerEl.querySelector(".status-map-rocket-title");
      const mission = markerEl.querySelector(".status-map-rocket-mission");
      if(kicker) kicker.textContent = meta.modeLabel;
      if(title) title.textContent = meta.kind;
      if(mission) mission.textContent = meta.mission;
    }
    function setStatusMapMarkerExpanded(expanded){
      statusMapState.markerExpanded = !!expanded;
      if(!statusMapState.marker || !statusMapState.marker.getElement) return;
      const markerEl = statusMapState.marker.getElement();
      if(!markerEl) return;
      const pill = markerEl.querySelector(".status-map-rocket-pill");
      if(!pill) return;
      pill.classList.toggle("is-expanded", statusMapState.markerExpanded);
      pill.setAttribute("aria-expanded", statusMapState.markerExpanded ? "true" : "false");
      refreshStatusMapMarkerContent();
    }
    function statusMapSetMarker(lat, lon, opt){
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if(!isFinite(latNum) || !isFinite(lonNum)) return;
      const clamped = clampStatusMapToKorea(latNum, lonNum);
      statusMapState.lat = clamped.lat;
      statusMapState.lon = clamped.lon;
      if(statusMapState.marker){
        statusMapState.marker.setLatLng([clamped.lat, clamped.lon]);
      }
      if(opt && opt.recenter && statusMapState.map){
        const zoomVal = isFinite(Number(opt.zoom)) ? Number(opt.zoom) : statusMapState.map.getZoom();
        statusMapState.map.setView([clamped.lat, clamped.lon], zoomVal);
      }
      updateStatusMapOfflineMarker();
      updateStatusMapHud();
    }
    async function copyTextSafe(text){
      if(!text) return false;
      try{
        if(navigator.clipboard && window.isSecureContext){
          await navigator.clipboard.writeText(text);
          return true;
        }
      }catch(e){}
      try{
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return !!ok;
      }catch(e){
        return false;
      }
    }
    function extractTelemetryLatLon(data){
      if(!data || typeof data !== "object") return null;
      const gps = (data.gps && typeof data.gps === "object") ? data.gps : null;
      const latRaw = data.gps_lat ?? data.gpsLat ?? data.gpsLatitude ?? data.nav_lat ?? (gps ? (gps.lat ?? gps.latitude ?? null) : null);
      const lonRaw = data.gps_lon ?? data.gps_lng ?? data.gpsLon ?? data.gpsLng ?? data.gpsLongitude ?? data.nav_lon ?? data.nav_lng ?? (gps ? (gps.lon ?? gps.lng ?? gps.longitude ?? null) : null);
      const latNum = Number(latRaw);
      const lonNum = Number(lonRaw);
      if(!isFinite(latNum) || !isFinite(lonNum)) return null;
      if(Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) return null;
      if(!isStatusMapInKorea(latNum, lonNum)) return null;
      return {lat:latNum, lon:lonNum};
    }
    function updateStatusMapFromTelemetry(data){
      const pos = extractTelemetryLatLon(data);
      if(!pos) return;
      const now = Date.now();
      if((now - statusMapState.lastUpdateMs) < 700 && statusMapState.hasLiveFix) return;
      statusMapState.lastUpdateMs = now;
      const shouldRecenter = !statusMapState.hasLiveFix;
      statusMapState.hasLiveFix = true;
      statusMapSetMarker(pos.lat, pos.lon, {recenter: shouldRecenter});
    }
    function refreshStatusMapSize(){
      if(!statusMapState.map) return;
      try{ statusMapState.map.invalidateSize(); }catch(e){}
    }
    function initStatusMap(){
      if(!el.statusMap || statusMapState.map) return;
      bindStatusMapControls();
      if(typeof window.L === "undefined"){
        initStatusMapOffline();
        updateStatusMapHud();
        return;
      }
      statusMapState.offlineMode = false;
      el.statusMap.classList.remove("status-map-canvas--offline");
      statusMapState.offlineRoot = null;
      statusMapState.offlineMarker = null;
      el.statusMap.innerHTML = "";
      const koreaBounds = [
        [STATUS_MAP_KR_BOUNDS.south, STATUS_MAP_KR_BOUNDS.west],
        [STATUS_MAP_KR_BOUNDS.north, STATUS_MAP_KR_BOUNDS.east]
      ];
      const map = window.L.map(el.statusMap, {
        zoomControl:false,
        maxBounds:koreaBounds,
        maxBoundsViscosity:1.0,
        minZoom:6
      }).setView(
        [statusMapState.lat, statusMapState.lon],
        statusMapState.zoom
      );
      let tileOk = false;
      let tileErrCount = 0;
      const tileLayer = window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        bounds: koreaBounds,
        noWrap: true,
        minZoom: 6,
        maxZoom: 19,
        attribution: "&copy; OSM contributors &copy; CARTO"
      }).addTo(map);
      tileLayer.on("tileload", ()=>{
        tileOk = true;
      });
      tileLayer.on("tileerror", ()=>{
        tileErrCount += 1;
        if(tileOk) return;
        if(tileErrCount < 8) return;
        try{ map.remove(); }catch(e){}
        initStatusMapOffline();
        updateStatusMapHud();
      });
      const rocketIcon = window.L.divIcon({
        className: "status-map-rocket-icon",
        html: buildStatusMapRocketHtml(),
        iconSize: [44, 44],
        iconAnchor: [22, 44]
      });
      const marker = window.L.marker([statusMapState.lat, statusMapState.lon], {icon:rocketIcon}).addTo(map);
      statusMapState.markerExpanded = false;
      marker.on("click",(ev)=>{
        if(ev && ev.originalEvent){
          if(ev.originalEvent.preventDefault) ev.originalEvent.preventDefault();
          if(ev.originalEvent.stopPropagation) ev.originalEvent.stopPropagation();
        }
        setStatusMapMarkerExpanded(!statusMapState.markerExpanded);
      });
      statusMapState.map = map;
      statusMapState.marker = marker;
      refreshStatusMapMarkerContent();
      setStatusMapMarkerExpanded(false);
      map.on("click", ()=>{
        setStatusMapMarkerExpanded(false);
      });
      map.on("zoomend", ()=>{
        statusMapState.zoom = map.getZoom();
        updateStatusMapHud();
      });
      map.on("moveend", ()=>{
        updateStatusMapHud();
      });
      updateStatusMapHud();
      setTimeout(refreshStatusMapSize, 120);
    }

    function syncCountdownInlineStatus(){
      if(!el.countdownInlineStatus || !el.countdownInlineStatusText || !el.countdownInlineStatusPill) return;
      const statusText = (el.statusText && el.statusText.textContent) ? el.statusText.textContent.trim() : "";
      const pillText = (el.statusPill && el.statusPill.textContent) ? el.statusPill.textContent.trim() : "";

      if(statusText){
        el.countdownInlineStatusText.textContent = statusText;
      }

      const pillClasses = ["countdown-inline-status-pill"];
      if(el.statusPill){
        const clsList = (el.statusPill.className || "").split(/\s+/);
        for(const cls of clsList){
          if(!cls || cls === "hidden") continue;
          if(/^status-/.test(cls)) pillClasses.push(cls);
        }
      }
      el.countdownInlineStatusPill.className = pillClasses.join(" ");

      if(pillText){
        el.countdownInlineStatusPill.textContent = pillText;
        el.countdownInlineStatusPill.classList.remove("hidden");
      }else{
        el.countdownInlineStatusPill.textContent = "";
        el.countdownInlineStatusPill.classList.add("hidden");
      }

      const hasContent = !!(statusText || pillText);
      el.countdownInlineStatus.classList.toggle("hidden", !hasContent);
    }

    function updateConnectionUI(connected){
      if(el.connDot){
        if(connected) el.connDot.classList.add("ok");
        else el.connDot.classList.remove("ok");
      }
      if(el.connText){
        el.connText.textContent = connected ? t("connConnected") : t("connDisconnected");
      }
      if(connected || sampleCounter === 0) hideDisconnectOverlay();
      else showDisconnectOverlay();
      syncCountdownInlineStatus();
      updateInspectionAccess();
      updateMotorInfoPanel();
      updateHomeUI();
      updateGyroConnectionUI(connected);
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      if(!connected){
        if(el.gyroStatusPill && el.gyroStatusText){
          el.gyroStatusPill.className = "gyro-status-pill status-disc";
          el.gyroStatusPill.textContent = t("statusDisconnected");
          el.gyroStatusText.textContent = t("statusNoResponse");
        }
      }else{
        syncGyroStatusFromMain();
      }
    }

    function updateGyroConnectionUI(connected){
      if(!el.gyroConnPill || !el.gyroConnText) return;
      el.gyroConnPill.classList.toggle("ok", !!connected);
      el.gyroConnText.textContent = connected ? t("connConnected") : t("connDisconnected");
    }

    function syncGyroStatusFromMain(){
      if(!el.gyroStatusPill || !el.gyroStatusText) return;
      if(el.statusPill){
        const pillClass = el.statusPill.className || "";
        el.gyroStatusPill.className = ("gyro-status-pill " + pillClass).trim();
        el.gyroStatusPill.textContent = el.statusPill.textContent || "";
      }
      if(el.statusText){
        el.gyroStatusText.textContent = el.statusText.textContent || "";
      }
    }

    function updateWsUI(){
      if(!el.wsDot || !el.wsText) return;
      if(wsConnected){
        el.wsDot.classList.add("ok");
        el.wsText.textContent = "ON";
      }else{
        el.wsDot.classList.remove("ok");
        el.wsText.textContent = wsEverConnected ? "OFF" : "INIT";
      }
      updateWsAlert();
      updateHomeUI();
      evaluateRuntimeAlarms(Date.now());
    }

    function updateWifiInfoUI(info){
      if(!el.wifiMode && !el.wifiSsid) return;
      if(!info){
        if(el.wifiMode) el.wifiMode.textContent = "-";
        if(el.wifiSsid) el.wifiSsid.textContent = "-";
        if(el.wifiChannel) el.wifiChannel.textContent = "-";
        if(el.wifiBandwidth) el.wifiBandwidth.textContent = "-";
        if(el.wifiTxPower) el.wifiTxPower.textContent = "-";
        if(el.wifiIp) el.wifiIp.textContent = "-";
        if(el.wifiStaCount) el.wifiStaCount.textContent = "-";
        if(el.wifiRssi) el.wifiRssi.textContent = "-";
        return;
      }
      const mode = info.mode || "-";
      const apSsid = info.ap_ssid || "";
      const staSsid = info.sta_ssid || "";
      const ssidLabel = (staSsid && staSsid.length) ? staSsid : apSsid;
      const channel = (info.channel != null) ? String(info.channel) : "-";
      const bandwidth = info.bandwidth || "-";
      const txDbm = (info.tx_dbm != null && isFinite(Number(info.tx_dbm))) ? Number(info.tx_dbm).toFixed(1) + " dBm" : "-";
      const apIp = info.ap_ip || "";
      const staIp = info.sta_ip || "";
      const ipLabel = (staIp && staIp !== "0.0.0.0") ? staIp : apIp;
      const staCount = (info.sta_count != null) ? String(info.sta_count) : "-";
      const rssiVal = Number(info.rssi);
      const rssiLabel = (isFinite(rssiVal) && rssiVal > -100) ? (rssiVal + " dBm") : "-";

      if(el.wifiMode) el.wifiMode.textContent = mode;
      if(el.wifiSsid) el.wifiSsid.textContent = ssidLabel || "-";
      if(el.wifiChannel) el.wifiChannel.textContent = channel;
      if(el.wifiBandwidth) el.wifiBandwidth.textContent = bandwidth;
      if(el.wifiTxPower) el.wifiTxPower.textContent = txDbm;
      if(el.wifiIp) el.wifiIp.textContent = ipLabel || "-";
      if(el.wifiStaCount) el.wifiStaCount.textContent = staCount;
      if(el.wifiRssi) el.wifiRssi.textContent = rssiLabel;
    }
    function updateHomeLog(){
      if(!el.homeLog) return;
      if(!eventLog.length){
        el.homeLog.textContent = "-";
        return;
      }
      const recent = eventLog.slice(-3).reverse().map(item=>{
        const time = (item.time || "").slice(11, 19);
        const tag = item.tag ? "[" + item.tag + "] " : "";
        return time + " " + tag + item.message;
      });
      el.homeLog.textContent = recent.join("\n");
    }
    function setHomeBadge(node, label, tone){
      if(!node) return;
      node.classList.remove("is-ok","is-warn","is-alert","is-off");
      if(tone) node.classList.add(tone);
      node.textContent = label;
    }
    function formatBoardNameHtml(name){
      const normalized = String(name || "").trim().replace(/\s+/g, " ");
      if(!normalized || normalized === "-") return null;
      const upper = normalized.toUpperCase();
      if(upper === "ALTIS INTELLIGNET V1" || upper === "ALTIS INTELLIGENT V1"){
        return '<span class="board-name-strong">ALTIS</span> <span class="board-name-regular">INTELLIGNET</span> <span class="board-name-light">V1</span>';
      }
      return null;
    }

    function setBoardNameDisplay(node, name, fallback){
      if(!node) return;
      const value = String(name || "").trim();
      const label = (value && value !== "-") ? value : (fallback || "FLASH6");
      const html = formatBoardNameHtml(label);
      if(html){
        node.innerHTML = html;
      }else{
        node.textContent = label;
      }
    }

    function updateHomeUI(){
      if(!el.homeView) return;
      const textOrDash = (node)=> (node && node.textContent && node.textContent.trim()) ? node.textContent.trim() : "-";
      const boardName = textOrDash(el.hwBoardName);
      if(el.pageKicker){
        setBoardNameDisplay(el.pageKicker, boardName, "FLASH6");
        el.pageKicker.classList.remove("hidden");
      }
      if(el.homeConnStatus) el.homeConnStatus.textContent = textOrDash(el.connText);
      if(el.homeWsStatus) el.homeWsStatus.textContent = textOrDash(el.wsText);
      if(el.homeMode) el.homeMode.textContent = textOrDash(el.modePill);
      if(el.homeStatus){
        const pill = textOrDash(el.statusPill);
        const text = textOrDash(el.statusText);
        el.homeStatus.textContent = (pill !== "-" && text !== "-") ? (pill + " — " + text) : (text !== "-" ? text : pill);
      }
      if(el.homeRelay) el.homeRelay.textContent = textOrDash(el.relay);
      if(el.homeSwitch) el.homeSwitch.textContent = textOrDash(el.sw);
      if(el.homeIgniter) el.homeIgniter.textContent = textOrDash(el.ic);
      if(el.homeSafety){
        const safety = (el.safeModeToggle && el.safeModeToggle.checked) ? "ON" : "OFF";
        el.homeSafety.textContent = safety;
      }
      if(el.homeHeroBoard) el.homeHeroBoard.textContent = boardName;
      if(el.homeFirmware) el.homeFirmware.textContent = textOrDash(el.hwFirmwareName);
      if(el.homeProtocol) el.homeProtocol.textContent = textOrDash(el.hwProtocolName);
      const serialLabel = !serialEnabled ? t("serialOff") : (serialConnected ? t("serialConnected") : t("serialDisconnected"));
      if(el.homeSerialStatus) el.homeSerialStatus.textContent = serialLabel;

      const heroLive = connOk && wsConnected;
      if(el.homeHeroPill){
        el.homeHeroPill.textContent = heroLive ? "LIVE" : "OFFLINE";
        el.homeHeroPill.classList.toggle("is-offline", !heroLive);
      }

      setHomeBadge(el.homeStatusBadge,
        lockoutLatched ? "ALERT" : (safetyModeEnabled ? "SAFE" : "OK"),
        lockoutLatched ? "is-alert" : (safetyModeEnabled ? "is-warn" : "is-ok"));
      setHomeBadge(el.homeConnBadge, connOk ? "OK" : "OFF", connOk ? "is-ok" : "is-alert");
      if(wsConnected){
        setHomeBadge(el.homeWsBadge, "ON", "is-ok");
      }else if(wsEverConnected){
        setHomeBadge(el.homeWsBadge, "OFF", "is-warn");
      }else{
        setHomeBadge(el.homeWsBadge, "INIT", "is-off");
      }
      setHomeBadge(el.homeModeBadge, (textOrDash(el.modePill) !== "-") ? "OK" : "OFF", (textOrDash(el.modePill) !== "-") ? "is-ok" : "is-off");
      setHomeBadge(el.homeSafetyBadge,
        (el.safeModeToggle && el.safeModeToggle.checked) ? "ON" : "OFF",
        (el.safeModeToggle && el.safeModeToggle.checked) ? "is-ok" : "is-warn");
      if(!serialEnabled){
        setHomeBadge(el.homeSerialBadge, "OFF", "is-off");
      }else if(serialConnected){
        setHomeBadge(el.homeSerialBadge, "OK", "is-ok");
      }else{
        setHomeBadge(el.homeSerialBadge, "ERR", "is-alert");
      }

      const missionName = (el.missionName && el.missionName.value && el.missionName.value.trim()) ? el.missionName.value.trim() : "-";
      const missionMotor = (selectedMotorName || (el.missionName && el.missionName.value) || "").trim() || "-";
      const missionDelay = (el.missionIgnDelay && el.missionIgnDelay.value && el.missionIgnDelay.value.trim()) ? (el.missionIgnDelay.value.trim() + " s") : "-";
      if(el.homeMissionName) el.homeMissionName.textContent = missionName;
      if(el.homeMissionMotor) el.homeMissionMotor.textContent = missionMotor;
      if(el.homeMissionDelay) el.homeMissionDelay.textContent = missionDelay;
      updateGyroMetaFromMain();

      const battValue = (lastBatteryV != null && isFinite(lastBatteryV)) ? lastBatteryV.toFixed(2) : null;
      const battPct = (lastBatteryPct != null && isFinite(lastBatteryPct)) ? Math.round(lastBatteryPct) : null;
      if(el.homeHealthBattery){
        el.homeHealthBattery.textContent = battValue ? (battValue + " V" + (battPct != null ? (" · " + battPct + "%") : "")) : "--";
      }
      setHomeBadge(el.homeHealthBatteryBadge, battValue ? "OK" : "WAIT", battValue ? "is-ok" : "is-warn");

      const igniterOk = !isIgniterCheckEnabled() || latestTelemetry.ic === 1;
      if(el.homeHealthIgniter) el.homeHealthIgniter.textContent = isIgniterCheckEnabled() ? (latestTelemetry.ic === 1 ? "OK" : "OPEN") : "SKIP";
      setHomeBadge(el.homeHealthIgniterBadge, isIgniterCheckEnabled() ? (igniterOk ? "OK" : "ALERT") : "OFF",
        isIgniterCheckEnabled() ? (igniterOk ? "is-ok" : "is-alert") : "is-off");

      const switchSafe = latestTelemetry.sw === 0;
      if(el.homeHealthSwitch) el.homeHealthSwitch.textContent = (latestTelemetry.sw == null) ? "--" : (switchSafe ? "OFF" : "ON");
      setHomeBadge(el.homeHealthSwitchBadge, (latestTelemetry.sw == null) ? "WAIT" : (switchSafe ? "OK" : "ALERT"),
        (latestTelemetry.sw == null) ? "is-warn" : (switchSafe ? "is-ok" : "is-alert"));

      if(el.homeHealthRelay) el.homeHealthRelay.textContent = lockoutLatched ? "LOCKOUT" : "OK";
      setHomeBadge(el.homeHealthRelayBadge, lockoutLatched ? "ALERT" : "OK", lockoutLatched ? "is-alert" : "is-ok");

      const armed = isControlUnlocked();
      if(el.homeArmBtn){
        el.homeArmBtn.textContent = armed ? "DISARM" : "ARM";
        el.homeArmBtn.classList.toggle("is-active", armed);
      }
      if(el.homeSafeBtn) el.homeSafeBtn.classList.toggle("is-active", !!(el.safeModeToggle && el.safeModeToggle.checked));
      if(el.homeIgniterBtn) el.homeIgniterBtn.classList.toggle("is-active", !!(el.igswitch && el.igswitch.checked));
      if(el.homeActionHint){
        el.homeActionHint.textContent = armed ? "제어 권한 활성" : "점검 후 ARM 가능";
      }
      updateHomeLog();
    }

    function updateGyroMetaFromMain(){
      if(el.gyroBattery){
        const battText = (el.batteryStatus && el.batteryStatus.textContent) ? el.batteryStatus.textContent.trim() : "--";
        el.gyroBattery.textContent = battText || "--";
      }
      if(el.gyroMode){
        const modeText = (el.modePill && el.modePill.textContent) ? el.modePill.textContent.trim() : "--";
        el.gyroMode.textContent = modeText || "--";
      }
      if(el.gyroRelay){
        const relayText = (el.relay && el.relay.textContent) ? el.relay.textContent.trim() : "--";
        el.gyroRelay.textContent = relayText || "--";
      }
    }

    function addLogLine(message, tag){
      if(!el.logView) return;
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      const timeIso = now.toISOString();
      const prefix = tag ? "[" + tag + "] " : "";
      const lineText = prefix + "[" + timeStr + "] " + message;

      logLines.push(lineText);
      eventLog.push({ time: timeIso, tag: tag || "", message: message });

      if(eventLog.length > EVENT_LOG_MAX) eventLog.splice(0, eventLog.length - EVENT_LOG_MAX);

      const div = document.createElement("div");
      div.className = "log-line";
      div.innerHTML = '<span class="log-prefix">$</span> ' + lineText.replace(/</g,"&lt;").replace(/>/g,"&gt;");
      el.logView.appendChild(div);

      while(el.logView.childNodes.length > MAX_VISIBLE_LOG){
        el.logView.removeChild(el.logView.firstChild);
      }
      while(logLines.length > MAX_VISIBLE_LOG){
        logLines.shift();
      }
      el.logView.scrollTop = el.logView.scrollHeight;
      updateHomeLog();
    }

    function normalizeToastType(type){
      const raw = String(type || "info").toLowerCase();
      if(raw === "notice") return "info";
      if(raw === "warning") return "warn";
      if(raw === "critical") return "error";
      return raw;
    }

    function normalizeToastTitleType(type){
      const raw = String(type || "info").toLowerCase();
      if(raw === "warn") return "warning";
      return raw;
    }

    function getToastIconPath(type){
      const tType = normalizeToastType(type);
      if(tType==="success") return "img/Tick.svg";
      if(tType==="warn") return "img/Danger.svg";
      if(tType==="error") return "img/Danger.svg";
      if(tType==="ignite") return "img/Graph.svg";
      return "img/Activity.svg";
    }

    function dismissToast(toast){
      if(!toast || toast._dismissed) return;
      toast._dismissed = true;
      if(toast._timer){ clearTimeout(toast._timer); toast._timer = null; }
      if(toast._expandTimer){ clearTimeout(toast._expandTimer); toast._expandTimer = null; }
      toast.classList.remove("toast-show");
      toast.classList.add("toast-hide");
      setTimeout(()=>{ if(toast && toast.parentNode) toast.parentNode.removeChild(toast); }, 220);
    }

    function dismissToastByKey(key){
      if(!el.toastContainer || !key) return;
      const token = String(key);
      for(const node of Array.from(el.toastContainer.children)){
        if(node && node.dataset && node.dataset.key === token){
          dismissToast(node);
        }
      }
    }

    function getToastTitle(type, message){
      const msg = String(message || "");
      const lower = msg.toLowerCase();
      const rules = [
        {re:/lockout|락아웃/i, title:"LOCKOUT 경고"},
        {re:/abort|중단/i, title:"시퀀스 중단"},
        {re:/점화|ignition|ignite|thrust/i, title:"점화 알림"},
        {re:/카운트다운|countdown/i, title:"카운트다운"},
        {re:/시퀀스|sequence/i, title:"시퀀스 상태"},
        {re:/메타데이터|미지정/i, title:"메타데이터 없음"},
        {re:/미션|mission/i, title:"미션 설정"},
        {re:/점검|inspection/i, title:"점검 결과"},
        {re:/시리얼|serial/i, title:"시리얼 상태"},
        {re:/연결|connect|disconnected|connected|link/i, title:"연결 상태"},
        {re:/로드셀|loadcell/i, title:"로드셀 저장"},
        {re:/복사|copy|clipboard/i, title:"복사 결과"},
        {re:/저장|save|saved/i, title:"저장 완료"},
        {re:/설정|setting|변경|changed/i, title:"설정 변경"},
        {re:/안전|safety/i, title:"안전 모드"},
        {re:/스위치|switch/i, title:"스위치 상태"},
        {re:/이그나이터|igniter/i, title:"이그나이터 상태"},
        {re:/배터리|battery/i, title:"배터리 상태"},
        {re:/대시보드|dashboard/i, title:"대시보드 시작"},
        {re:/강제|force/i, title:"강제 점화"}
      ];
      for(const rule of rules){
        if(rule.re.test(msg) || rule.re.test(lower)){
          return rule.title;
        }
      }
      if(type==="notice") return t("toastTitleNotice");
      if(type==="success") return t("toastTitleSuccess");
      if(type==="warning" || type==="warn") return t("toastTitleWarn");
      if(type==="critical") return t("toastTitleCritical");
      if(type==="error") return t("toastTitleError");
      if(type==="ignite") return t("toastTitleIgnite");
      return t("toastTitleInfo");
    }

    function showToast(message, type, opts){
      if(!el.toastContainer) return;
      const rawType = type || "info";
      const toastType = normalizeToastType(rawType);
      const titleType = normalizeToastTitleType(rawType);
      const duration = (opts && opts.duration) ? opts.duration : 3000;
      const key = (opts && opts.key) ? String(opts.key) : null;
      const titleText = (opts && opts.title) ? String(opts.title) : getToastTitle(titleType, message);
      const sticky = !!(opts && opts.sticky);

      const keepExisting = opts && opts.keep;
      if(!keepExisting){
        for(const node of Array.from(el.toastContainer.children)){
          if(node && node.dataset && node.dataset.sticky === "1") continue;
          dismissToast(node);
        }
      }

      let existingToast = null;
      if(key){
        for(const node of el.toastContainer.children){
          if(node && node.dataset && node.dataset.key === key){
            existingToast = node;
            break;
          }
        }
      }

      if(existingToast){
        existingToast.className = "toast toast-" + toastType;
        const img = existingToast.querySelector(".toast-icon img");
        if(img) img.src = getToastIconPath(toastType);
        const titleDiv = existingToast.querySelector(".toast-title");
        if(titleDiv) titleDiv.textContent = titleText;
        const textDiv = existingToast.querySelector(".toast-text");
        if(textDiv) textDiv.textContent = message;
        existingToast.dataset.full = message;
        existingToast.classList.remove("toast-expanded");
        if(existingToast._timer){ clearTimeout(existingToast._timer); }
        if(existingToast._expandTimer){ clearTimeout(existingToast._expandTimer); }
        existingToast.classList.remove("toast-hide");
        if(sticky) existingToast.dataset.sticky = "1";
        else if(existingToast.dataset && existingToast.dataset.sticky) delete existingToast.dataset.sticky;
        requestAnimationFrame(()=>existingToast.classList.add("toast-show"));
        existingToast._timer = setTimeout(()=>dismissToast(existingToast), duration);
        return;
      }

      const toast = document.createElement("div");
      toast.className = "toast toast-" + toastType;
      toast.setAttribute("role","status");
      toast.setAttribute("aria-live","polite");
      if(key) toast.dataset.key = key;
      if(sticky) toast.dataset.sticky = "1";

      const iconDiv = document.createElement("div");
      iconDiv.className = "toast-icon";
      const img = document.createElement("img");
      img.src = getToastIconPath(toastType);
      img.alt = "";
      iconDiv.appendChild(img);

      const bodyDiv = document.createElement("div");
      bodyDiv.className = "toast-body";

      const titleDiv = document.createElement("div");
      titleDiv.className = "toast-title";
      titleDiv.textContent = titleText;

      const textDiv = document.createElement("div");
      textDiv.className = "toast-text";
      textDiv.textContent = message;

      toast.dataset.full = message;
      bodyDiv.appendChild(titleDiv);
      bodyDiv.appendChild(textDiv);

      toast.appendChild(iconDiv);
      toast.appendChild(bodyDiv);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "toast-close";
      closeBtn.setAttribute("aria-label","Dismiss");
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click",(ev)=>{
        ev.stopPropagation();
        dismissToast(toast);
      });
      toast.appendChild(closeBtn);

      toast.addEventListener("click", ()=>{
        if(!toast.classList.contains("toast-expanded")){
          toast.classList.add("toast-expanded");
          textDiv.textContent = toast.dataset.full || message;
          if(toast._timer){ clearTimeout(toast._timer); toast._timer = null; }
          if(toast._expandTimer){ clearTimeout(toast._expandTimer); toast._expandTimer = null; }
          return;
        }
        dismissToast(toast);
      });
      el.toastContainer.appendChild(toast);
      requestAnimationFrame(()=>toast.classList.add("toast-show"));
      toast._timer = setTimeout(()=>dismissToast(toast), duration);
    }

    function addDebugLog(message){
      addLogLine(String(message || ""), "DBG");
    }

    function getAlarmRuntime(code){
      const key = String(code || "");
      if(!alarmState[key]){
        alarmState[key] = {
          active: false,
          lastNotifyMs: 0,
          lastClearMs: 0
        };
      }
      return alarmState[key];
    }

    function alarmLevelToToastType(level){
      if(level === ALERT_LEVEL.CRITICAL) return "critical";
      if(level === ALERT_LEVEL.WARNING) return "warning";
      if(level === ALERT_LEVEL.NOTICE) return "notice";
      return "info";
    }

    function alarmLevelTitle(level){
      if(level === ALERT_LEVEL.CRITICAL) return t("toastTitleCritical");
      if(level === ALERT_LEVEL.WARNING) return t("toastTitleWarn");
      if(level === ALERT_LEVEL.NOTICE) return t("toastTitleNotice");
      return t("toastTitleInfo");
    }

    function alarmLogTag(level){
      if(level === ALERT_LEVEL.CRITICAL) return "ALARM!";
      if(level === ALERT_LEVEL.WARNING) return "ALARM";
      if(level === ALERT_LEVEL.NOTICE) return "NOTICE";
      return "INFO";
    }

    function notifyAlarm(code, params, opts){
      const def = ALARM_DEFS[code];
      if(!def) return;
      const runtime = getAlarmRuntime(code);
      const now = Date.now();
      const rateLimitMs = (opts && opts.rateLimitMs != null)
        ? Math.max(0, Number(opts.rateLimitMs) || 0)
        : (def.rateLimitMs || 0);
      if(!(opts && opts.force) && rateLimitMs > 0 && (now - runtime.lastNotifyMs) < rateLimitMs){
        return;
      }

      const message = (opts && opts.message != null)
        ? String(opts.message)
        : (def.textKey ? t(def.textKey, params || {}) : String(code));

      runtime.lastNotifyMs = now;
      addLogLine("[ALARM][" + code + "] " + message, alarmLogTag(def.level));

      if(opts && opts.toast === false) return;

      showToast(message, alarmLevelToToastType(def.level), {
        key: "alarm-" + code,
        keep: !!def.sticky,
        sticky: !!def.sticky,
        duration: (opts && opts.duration) ? opts.duration : (def.level === ALERT_LEVEL.CRITICAL ? 12000 : 7000),
        title: alarmLevelTitle(def.level)
      });
    }

    function setAlarmActive(code, active, params, opts){
      const def = ALARM_DEFS[code];
      if(!def) return;
      const runtime = getAlarmRuntime(code);
      const nextActive = !!active;

      if(nextActive){
        const firstRaise = !runtime.active;
        runtime.active = true;
        if(firstRaise){
          notifyAlarm(code, params, opts);
        }
        return;
      }

      if(!runtime.active) return;
      runtime.active = false;
      runtime.lastClearMs = Date.now();
      dismissToastByKey("alarm-" + code);

      if(def.clearKey){
        const clearMessage = t(def.clearKey, params || {});
        addLogLine("[ALARM CLEAR][" + code + "] " + clearMessage, "INFO");
      }
    }

    function reportSilentException(source, err){
      const src = String(source || "unknown");
      const now = Date.now();
      const msg = (err && err.message) ? err.message : String(err || "unknown");

      let stat = silentExceptionState[src];
      if(!stat){
        stat = {windowStartMs: now, count: 0, lastAlarmMs: 0};
        silentExceptionState[src] = stat;
      }

      if((now - stat.windowStartMs) > 5000){
        stat.windowStartMs = now;
        stat.count = 0;
      }
      stat.count += 1;

      addDebugLog("[" + src + "] " + msg);

      if(stat.count >= 3 && (now - stat.lastAlarmMs) >= 10000){
        stat.lastAlarmMs = now;
        notifyAlarm("INTERNAL_EXCEPTION", {
          source: src,
          err: msg
        }, {force: true});
      }
    }

    function handleWsBackpressureSignal(counter){
      const next = Math.max(0, Number(counter) || 0);
      if(next < lastWsQueueDropCount){
        lastWsQueueDropCount = next;
        return;
      }
      if(next === lastWsQueueDropCount) return;

      const delta = next - lastWsQueueDropCount;
      lastWsQueueDropCount = next;
      notifyAlarm("WS_BACKPRESSURE", {total: next, delta});
    }

    function evaluateRuntimeAlarms(nowMs){
      if(replaySourceActive || simEnabled){
        setAlarmActive("WS_DISCONNECTED", false);
        setAlarmActive("DATA_TIMEOUT", false);
        setAlarmActive("RX_HZ_DROP", false);
        return;
      }

      const now = Number(nowMs || Date.now());
      const sinceOk = Math.max(0, now - (lastOkMs || 0));
      const wsDisconnected = !!(connOk && !wsConnected);
      const dataTimedOut = !!(sampleCounter > 0 && sinceOk >= DATA_TIMEOUT_ALARM_MS);
      const hzDrop = !!(sampleCounter > 0 && wsConnected && rxHzWindow > 0 && rxHzWindow <= RX_HZ_WARN_THRESHOLD);
      const hzRecovered = (rxHzWindow <= 0 || rxHzWindow >= RX_HZ_RECOVER_THRESHOLD || !wsConnected);

      setAlarmActive("WS_DISCONNECTED", wsDisconnected, {ms: sinceOk});
      setAlarmActive("DATA_TIMEOUT", dataTimedOut, {ms: sinceOk});

      if(hzDrop){
        setAlarmActive("RX_HZ_DROP", true, {target: TARGET_STREAM_HZ, hz: rxHzWindow});
      }else if(hzRecovered){
        setAlarmActive("RX_HZ_DROP", false, {target: TARGET_STREAM_HZ, hz: rxHzWindow});
      }
    }

    function mapAbortReasonCode(code){
      if(code === 1) return "user";
      if(code === 2) return "igniter";
      if(code === 3) return "lockout";
      return null;
    }
    function getAbortReasonLabel(){
      if(lastAbortReason === "user") return t("abortReasonUser");
      if(lastAbortReason === "igniter") return t("abortReasonIgniter");
      if(lastAbortReason === "lockout") return t("abortReasonLockout");
      return t("abortReasonUnknown");
    }

    let audioCtx = null;
    function getAudioCtx(){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return null;
      if(!audioCtx) audioCtx = new Ctx();
      if(audioCtx.state === "suspended"){
        audioCtx.resume().catch(()=>{});
      }
      return audioCtx;
    }

    const COUNTDOWN_AUDIO_SOURCES = {
      10: "/mp3/t-10.mp3",
      9: "/mp3/9.mp3",
      8: "/mp3/8.mp3",
      7: "/mp3/7.mp3",
      6: "/mp3/6.mp3",
      5: "/mp3/5.mp3",
      4: "/mp3/4.mp3",
      3: "/mp3/3.mp3",
      2: "/mp3/2.mp3",
      1: "/mp3/1.mp3",
      0: "/mp3/ignition.mp3"
    };
    const countdownAudioCache = {};
    function playCountdownMp3(secRemain){
      const key = Number(secRemain);
      if(!isFinite(key) || !(key in COUNTDOWN_AUDIO_SOURCES)) return;
      let audio = countdownAudioCache[key];
      if(!audio){
        audio = new Audio(COUNTDOWN_AUDIO_SOURCES[key]);
        audio.preload = "auto";
        countdownAudioCache[key] = audio;
      }
      try{
        audio.currentTime = 0;
        audio.play().catch(()=>{});
      }catch(e){}
    }
    function playTone(freq, durationMs, delayMs){
      const ctx = getAudioCtx();
      if(!ctx) return;
      const startAt = ctx.currentTime + (delayMs || 0) / 1000;
      const durSec = (durationMs || 0) / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durSec);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + durSec + 0.05);
    }
    function playBeepPattern(pattern){
      let offset = 0;
      for(const tone of pattern){
        const freq = tone.freq || 440;
        const dur = tone.dur || 120;
        const gap = tone.gap || 0;
        playTone(freq, dur, offset);
        offset += dur + gap;
      }
    }

    function safetyLineSuffix(){
      return t("safetyLineSuffix");
    }

    function updateRelaySafePill(){
      if(!el.relaySafePill) return;
      setLockoutVisual(lockoutLatched);

      if(lockoutLatched){
        const name = relayMaskName(lockoutRelayMask);
        el.relaySafePill.textContent = t("relaySafeLockout", {name});
        el.relaySafePill.style.color = "#991b1b";
      }else{
        el.relaySafePill.textContent = relaySafeEnabled ? t("relaySafeSafe") : t("relaySafeOff");
        el.relaySafePill.style.color = relaySafeEnabled ? "#166534" : "#64748b";
      }
    }

    function updateSerialPill(){
      if(!el.serialStatus || !el.serialStatusText) return;
      const enabled = serialEnabled;
      const ok = enabled && serialConnected;
      el.serialStatus.classList.remove("ok","bad");
      if(!enabled){
        el.serialStatusText.textContent = t("serialOff");
      }else if(ok){
        el.serialStatus.classList.add("ok");
        el.serialStatusText.textContent = t("serialConnected");
      }else{
        el.serialStatus.classList.add("bad");
        el.serialStatusText.textContent = t("serialDisconnected");
      }
      updateMobileControlPills();
    }

    function isControlUnlocked(){
      return controlAuthority && inspectionState==="passed" && !lockoutLatched;
    }
    function canOperateLauncher(){
      const relayOn = latestTelemetry && latestTelemetry.rly === 1;
      const switchOn = latestTelemetry && latestTelemetry.sw === 1;
      return !(lockoutLatched || safetyModeEnabled || replaySourceActive || currentSt !== 0 || relayOn || switchOn);
    }

    function updateInspectionPill(){
      if(!el.inspectionStatusPill) return;
      let cls="pill ";
      let txt=t("inspectionWait");
      if(inspectionState==="passed"){ cls+="pill-green"; txt=t("inspectionOk"); }
      else if(inspectionState==="failed"){ cls+="pill-red"; txt=t("inspectionNeed"); }
      else if(inspectionRunning){ cls+="pill-gray"; txt=t("inspectionRunningLabel"); }
      else { cls+="pill-gray"; txt=t("inspectionWait"); }
      el.inspectionStatusPill.className=cls;
      el.inspectionStatusPill.textContent=txt;
      updateMobileControlPills();
    }

    function updateInspectionAccess(){
      if(!el.inspectionOpenBtn) return;
      const blocked = inspectionRunning || replaySourceActive;
      el.inspectionOpenBtn.classList.toggle("disabled", blocked);
      el.inspectionOpenBtn.setAttribute("aria-disabled", blocked ? "true" : "false");
    }

    function updateControlAccessUI(st){
      const state = (st==null) ? currentSt : st;
      const unlocked=isControlUnlocked();
      if(el.forceBtn){
        const igniterBlocked = (uiSettings && uiSettings.igs) && latestTelemetry.ic !== 1;
        const blocked = replaySourceActive || ((!unlocked && !loadcellErrorActive) || lockoutLatched || state!==0 || sequenceActive || igniterBlocked || safetyModeEnabled);
        el.forceBtn.disabled = blocked;
        el.forceBtn.classList.toggle("disabled", blocked);
      }
      if(el.launcherOpenBtns && el.launcherOpenBtns.length){
        const blocked = !canOperateLauncher();
        el.launcherOpenBtns.forEach(btn=>{
          btn.classList.toggle("disabled", blocked);
          btn.setAttribute("aria-disabled", blocked ? "true" : "false");
        });
      }
      updateInspectionPill();
      updateMobileControlPills();
      syncMobileControlButtons();
      updateMobileSequenceStatusLabel(sequenceActive, state, lockoutLatched);
    }

    const MOBILE_PANEL_MEDIA = window.matchMedia("(max-width: 600px)");
    let mobileControlsActive = false;

    function isMobileLayout(){
      return MOBILE_PANEL_MEDIA.matches;
    }

    function showMobileControlsPanel(){
      if(!el.mobileControlsPanel || mobileControlsActive) return;
      updateMobileControlPills();
      syncMobileControlButtons();
      updateMobileSequenceStatusLabel(sequenceActive, currentSt, lockoutLatched);
      mobileControlsActive = true;
      el.mobileControlsPanel.classList.add("is-open");
      el.mobileControlsPanel.setAttribute("aria-hidden","false");
      document.documentElement.classList.add("mobile-controls-active");
    }

    function hideMobileControlsPanel(){
      if(!el.mobileControlsPanel || !mobileControlsActive) return;
      mobileControlsActive = false;
      el.mobileControlsPanel.classList.remove("is-open");
      el.mobileControlsPanel.setAttribute("aria-hidden","true");
      document.documentElement.classList.remove("mobile-controls-active");
    }

    if(MOBILE_PANEL_MEDIA.addEventListener){
      MOBILE_PANEL_MEDIA.addEventListener("change",(event)=>{
        if(!event.matches) hideMobileControlsPanel();
      });
    }else if(MOBILE_PANEL_MEDIA.addListener){
      MOBILE_PANEL_MEDIA.addListener((event)=>{
        if(!event.matches) hideMobileControlsPanel();
      });
    }

    function updateMobileControlPills(){
      if(!el.mobileControlsPanel) return;
      const serialPill = el.mobileControlPills ? el.mobileControlPills.serial : null;
      if(serialPill){
        const serialLabel = serialEnabled
          ? (serialConnected ? t("serialConnected") : t("serialDisconnected"))
          : t("serialOff");
        serialPill.textContent = serialLabel;
        serialPill.className = "pill " + (serialEnabled ? (serialConnected ? "pill-green" : "pill-red") : "pill-gray");
      }
      const safetyPill = el.mobileControlPills ? el.mobileControlPills.safety : null;
      if(safetyPill){
        const safetyOn = el.safeModeToggle ? el.safeModeToggle.checked : safetyModeEnabled;
        safetyPill.textContent = safetyOn ? "ON" : "OFF";
        safetyPill.className = "pill " + (safetyOn ? "pill-green" : "pill-gray");
      }
      const inspectionPill = el.mobileControlPills ? el.mobileControlPills.inspection : null;
      if(inspectionPill && el.inspectionStatusPill){
        inspectionPill.textContent = el.inspectionStatusPill.textContent;
        inspectionPill.className = el.inspectionStatusPill.className;
      }
    }

    function setMobileControlButtonState(type, disabled){
      if(!el.mobileControlButtonMap) return;
      const btn = el.mobileControlButtonMap[type];
      if(!btn) return;
      btn.disabled = !!disabled;
      btn.classList.toggle("disabled", !!disabled);
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
    }

    function syncMobileControlButtons(){
      if(!el.mobileControlButtonMap) return;
      const sequenceDisabled = !!(el.igniteBtn && el.igniteBtn.disabled);
      const forceDisabled = !!(el.forceBtn && el.forceBtn.disabled);
      const inspectionDisabled = !!(el.inspectionOpenBtn && el.inspectionOpenBtn.classList.contains("disabled"));
      setMobileControlButtonState("sequence", sequenceDisabled);
      setMobileControlButtonState("force", forceDisabled);
      setMobileControlButtonState("inspection", inspectionDisabled);
    }

    function shouldShowMobileAbortButton(){
      if(!isMobileLayout() || !el.mobileAbortBtn) return false;
      return sequenceActive || currentSt === 1 || currentSt === 2 || localTplusActive || forceSlideActive;
    }
    function updateMobileAbortButton(){
      if(!el.mobileAbortBtn) return;
      const show = shouldShowMobileAbortButton();
      el.mobileAbortBtn.classList.toggle("is-visible", show);
      if(el.mobileAbortPanel) el.mobileAbortPanel.classList.toggle("is-visible", show);
      el.mobileAbortBtn.disabled = !!(el.abortBtn && el.abortBtn.disabled);
    }

    function updateAbortButtonLabel(isTplus){
      const label = isTplus ? "STOP" : "ABORT";
      tplusUiActive = !!isTplus;
      if(el.abortBtn) el.abortBtn.textContent = label;
      if(el.mobileAbortBtn) el.mobileAbortBtn.textContent = label;
    }

    function setIgniteButtonLabel(key){
      const label = t(key);
      if(el.igniteLabel){
        el.igniteLabel.textContent = label;
      }
      if(el.igniteBtn && !el.igniteLabel) el.igniteBtn.textContent = label;
      if(el.mobileSequenceLabel) el.mobileSequenceLabel.textContent = label;
    }

    function toggleInput(node){
      if(!node) return;
      node.checked = !node.checked;
      node.dispatchEvent(new Event("change", {bubbles:true}));
    }

    function setInspectionStepInfo(key){
      const info = INSPECTION_STEP_INFO[key] || {};
      const label = info.labelKey ? t(info.labelKey) : (info.label || key || "-");
      const desc = info.descKey ? t(info.descKey) : (info.desc || "");
      if(el.inspectionStepLabel) el.inspectionStepLabel.textContent = label;
      if(el.inspectionStepDesc) el.inspectionStepDesc.textContent = desc;
    }

    function setInspectionStatusPills(state){
      const pill = el.inspectionStatusSingle;
      if(!pill) return;
      pill.classList.remove("is-active","is-running","is-ok","is-bad");
      let label = "-";
      if(state==="running"){
        pill.classList.add("is-active","is-running");
        label = t("inspectionChecking");
      }else if(state==="ok" || state==="skip"){
        pill.classList.add("is-active","is-ok");
        label = t("inspectionOk");
      }else if(state==="bad"){
        pill.classList.add("is-active","is-bad");
        label = t("inspectionNeed");
      }else{
        label = t("inspectionWait");
      }
      pill.textContent = label;
    }

    function setInspectionItemState(key,state,label){
      setInspectionStepInfo(key);
      if(!state){
        setInspectionStatusPills("idle");
        return;
      }
      if(state==="running") setInspectionStatusPills("running");
      else if(state==="ok") setInspectionStatusPills("ok");
      else if(state==="bad") setInspectionStatusPills("bad");
      else if(state==="skip") setInspectionStatusPills("skip");
    }

    function setInspectionResult(text, state){
      if(!el.inspectionResult) return;
      el.inspectionResult.classList.remove("ok","error","running");
      if(state) el.inspectionResult.classList.add(state);
      el.inspectionResult.textContent=text;
    }

    function resetInspectionUI(){
      inspectionRunning=false;
      controlAuthority=false;
      inspectionState="idle";
      if(INSPECTION_STEPS.length){
        setInspectionItemState(INSPECTION_STEPS[0].key,"", t("inspectionWait"));
      }
      setInspectionResult(t("inspectionIdleText"),"neutral");
      updateInspectionPill();
      updateControlAccessUI(currentSt);
    }

    async function runInspectionSequence(){
      if(inspectionRunning) return;
      inspectionRunning=true;
      inspectionState="running";
      controlAuthority=false;
      updateInspectionPill();
      setInspectionResult(t("inspectionRunningText"),"running");
      updateControlAccessUI(currentSt);

      let hasFail=false;
      for(const step of INSPECTION_STEPS){
        setInspectionItemState(step.key,"running", t("inspectionChecking"));
        await delay(320);
        let ok=false;
        let skipped=false;
        try{ ok = !!step.check(); }catch(e){ ok=false; }
        if(step.key==="igniter"){
          if(!isIgniterCheckEnabled()){
            ok = true;
            skipped = true;
          }
        }
        if(skipped){
          setInspectionItemState(step.key, "skip", t("inspectionSkip"));
        }else{
          setInspectionItemState(step.key, ok ? "ok" : "bad", ok ? t("inspectionOk") : t("inspectionNeed"));
        }
        if(!ok && !skipped) hasFail=true;
        await delay(180);
        if(!ok && !skipped){
          await delay(260);
          break;
        }
      }

      inspectionRunning=false;
      inspectionState = hasFail ? "failed" : "passed";

      if(hasFail){
        controlAuthority=false;
        setInspectionResult(t("inspectionFailText"),"error");
        showToast(t("inspectFailToast"),"notice");
        addLogLine(t("inspectFailLog"),"SAFE");
        playBeepPattern([
          {freq:440, dur:120, gap:80},
          {freq:440, dur:120, gap:80},
          {freq:440, dur:120, gap:0}
        ]);
      }else{
        controlAuthority=true;
        setInspectionResult(t("inspectionPassText"),"ok");
        showToast(t("inspectPassToast"),"success");
        addLogLine(t("inspectPassLog"),"SAFE");
        playBeepPattern([
          {freq:660, dur:140, gap:60},
          {freq:880, dur:140, gap:60},
          {freq:1100, dur:180, gap:0}
        ]);
      }
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      updateInspectionPill();
    }

    function openInspectionFromUI(){
      if(!connOk){
        showToast(t("inspectionOpenToast"), "notice");
        return;
      }
      showInspection();
    }

    function showInspection(){
      hideMobileControlsPanel();
      setOverlayVisible(el.inspectionOverlay, true);
      resetInspectionUI();
      runInspectionSequence();
    }
    function hideInspection(){
      setOverlayVisible(el.inspectionOverlay, false);
    }

    function showControlsModal(){
      hideMobileControlsPanel();
      if(!el.controlsOverlay || !el.controlsOverlaySlot || !el.controlsCard) return;
      if(!controlsCardParent){
        controlsCardParent = el.controlsCard.parentNode;
        controlsCardNext = el.controlsCard.nextSibling;
      }
      el.controlsCard.classList.remove(CONTROLS_MOBILE_CLASS);
      el.controlsOverlaySlot.appendChild(el.controlsCard);
      if(el.controlsOverlayClose){
        el.controlsCard.appendChild(el.controlsOverlayClose);
      }
      el.controlsOverlay.classList.remove("hidden");
    }
    function hideControlsModal(){
      if(!el.controlsOverlay || !el.controlsCard || !controlsCardParent) return;
      el.controlsOverlay.classList.add("hidden");
      if(controlsCardNext && controlsCardNext.parentNode === controlsCardParent){
        controlsCardParent.insertBefore(el.controlsCard, controlsCardNext);
      }else{
        controlsCardParent.appendChild(el.controlsCard);
      }
      if(el.controlsCard && window.matchMedia("(max-width: 600px)").matches){
        el.controlsCard.classList.add(CONTROLS_MOBILE_CLASS);
      }
      if(el.controlsOverlayClose){
        el.controlsOverlay.appendChild(el.controlsOverlayClose);
      }
    }

    // ✅ KST 시각 표시
    function updateKstClock(){
      if(!el.kstTime) return;
      const now = new Date();
      const opts = { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false, timeZone:"Asia/Seoul" };
      el.kstTime.textContent = now.toLocaleTimeString("ko-KR", opts);
    }

    function getViewIndices(data, view){
      const len=data.length;
      if(len===0) return {start:0,end:-1};

      if(view && view.windowMs && chartTimeHistory.length === len){
        let windowMs = view.windowMs;
        if(windowMs < CHART_WINDOW_MS_MIN) windowMs = CHART_WINDOW_MS_MIN;
        if(windowMs > CHART_WINDOW_MS_MAX) windowMs = CHART_WINDOW_MS_MAX;

        const lastTime = chartTimeHistory[len - 1] || 0;
        let startMs = view.startMs;
        if(startMs == null) startMs = lastTime - windowMs;
        const endMs = startMs + windowMs;

        let start = 0;
        while(start < len && chartTimeHistory[start] < startMs) start++;
        let end = len - 1;
        while(end > start && chartTimeHistory[end] > endMs) end--;
        return {start, end};
      }

      let windowSize=view.window||len;
      if(windowSize<2) windowSize=2;
      if(windowSize>len) windowSize=len;
      let start=view.start||0;
      if(start<0) start=0;
      if(start+windowSize>len) start=len-windowSize;
      return {start:start,end:start+windowSize-1};
    }

    function colorToRgba(hex, alpha){
      if(!hex) hex="#000000";
      if(hex[0]==="#") hex=hex.substring(1);
      if(hex.length===3) hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      const r=parseInt(hex.substring(0,2),16)||0;
      const g=parseInt(hex.substring(2,4),16)||0;
      const b=parseInt(hex.substring(4,6),16)||0;
      return "rgba("+r+","+g+","+b+","+alpha+")";
    }

    // =====================
    // 캔버스 DPR 보정
    // =====================
    function ensureCanvasSize(canvas){
      const rect = canvas.getBoundingClientRect();
      if(rect.width < 2 || rect.height < 2 || canvas.offsetParent === null){
        return null;
      }
      if(!canvas._cssInit){
        const fixedW = canvas.dataset.fixedWidth ? Number(canvas.dataset.fixedWidth) : null;
        canvas.style.width = (fixedW && fixedW > 0) ? (fixedW + "px") : "100%";
        const fixedH = canvas.dataset.fixedHeight ? Number(canvas.dataset.fixedHeight) : null;
        canvas.style.height = (fixedH && fixedH > 0) ? (fixedH + "px") : "";
        canvas._cssInit = true;
      }

      let parentContentWidth = 0;
      if(canvas.parentElement){
        const parentRect = canvas.parentElement.getBoundingClientRect();
        const parentStyle = getComputedStyle(canvas.parentElement);
        const padLeft = parseFloat(parentStyle.paddingLeft) || 0;
        const padRight = parseFloat(parentStyle.paddingRight) || 0;
        parentContentWidth = Math.max(0, parentRect.width - padLeft - padRight);
      }
      const fixedW = canvas.dataset.fixedWidth ? Number(canvas.dataset.fixedWidth) : null;
      const cssW = Math.max(160, (fixedW && fixedW > 0) ? fixedW : Math.floor(parentContentWidth || rect.width || 200));
      const fixedH = canvas.dataset.fixedHeight ? Number(canvas.dataset.fixedHeight) : null;
      const cssH = Math.max(180, (fixedH && fixedH > 0) ? fixedH : (rect.height || 220));
      const dpr  = window.devicePixelRatio || 1;

      if(canvas._cssW!==cssW || canvas._cssH!==cssH || canvas._dpr!==dpr){
        canvas.width  = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas._cssW = cssW; canvas._cssH = cssH; canvas._dpr = dpr;
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      return { w: cssW, h: cssH, ctx };
    }

    // =====================
    // 차트
    // =====================
    function drawChart(canvasId, data, color, view){
      const canvas=document.getElementById(canvasId);
      if(!canvas) return;

      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const { w:width, h:height, ctx } = size;
      ctx.clearRect(0,0,width,height);
      const padding=6;
      ctx.save();
      ctx.strokeStyle="rgba(148,163,184,0.3)";
      ctx.lineWidth=0.8;
      ctx.setLineDash([3,4]);
      for(let i=0;i<=4;i++){
        let y=padding+(height-2*padding)*(i/4);
        y=height-y;
        ctx.beginPath(); ctx.moveTo(padding,y); ctx.lineTo(width-padding,y); ctx.stroke();
      }
      ctx.setLineDash([2,6]);
      for(let i=0;i<=4;i++){
        let x=padding+(width-2*padding)*(i/4);
        ctx.beginPath(); ctx.moveTo(x,padding); ctx.lineTo(x,height-padding); ctx.stroke();
      }
      ctx.restore();

      if(!data || data.length<2){
        ctx.save();
        ctx.fillStyle="rgba(71,85,105,0.65)";
        ctx.font="12px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(t("chartNoData"), width/2, height/2);
        ctx.restore();
        return;
      }
      const indices=getViewIndices(data,view);
      if(indices.end<indices.start) return;

      const slice=data.slice(indices.start,indices.end+1);
      if(slice.length<2) return;

      let min=slice[0], max=slice[0], sum=0;
      for(let v of slice){ if(v<min) min=v; if(v>max) max=v; sum+=v; }
      const avg=sum/slice.length;

      let range=max-min; if(range===0) range=1;
      const count=slice.length;
      const stepX=(width-2*padding)/(count-1);

      function yPos(value){
        return (height-padding) - ((value-min)/range)*(height-2*padding);
      }

      ctx.beginPath();
      for(let i=0;i<slice.length;i++){
        const x=padding+i*stepX;
        const y=yPos(slice[i]);
        if(i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=color;
      ctx.lineWidth=1.4;
      ctx.stroke();

      const lastX=padding+(slice.length-1)*stepX;
      const bottomY=height-padding;
      ctx.lineTo(lastX,bottomY);
      ctx.lineTo(padding,bottomY);
      ctx.closePath();

      const grad=ctx.createLinearGradient(0,0,0,height);
      grad.addColorStop(0,colorToRgba(color,0.35));
      grad.addColorStop(0.5,colorToRgba(color,0.18));
      grad.addColorStop(1,colorToRgba(color,0));
      ctx.fillStyle=grad;
      ctx.fill();

      const yAvg=yPos(avg);
      ctx.save();
      ctx.setLineDash([6,4]);
      ctx.strokeStyle=colorToRgba(color,0.7);
      ctx.lineWidth=1.0;
      ctx.beginPath(); ctx.moveTo(padding,yAvg); ctx.lineTo(width-padding,yAvg); ctx.stroke();
      ctx.restore();

      const yMax=yPos(max);
      ctx.save();
      ctx.setLineDash([3,3]);
      ctx.strokeStyle=colorToRgba(color,0.9);
      ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(padding,yMax); ctx.lineTo(width-padding,yMax); ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font="10px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
      ctx.fillStyle=colorToRgba(color,0.9);
      ctx.textAlign="right";
      ctx.textBaseline="bottom";
      ctx.fillText("AVG "+avg.toFixed(3),width-padding-2,yAvg-2);
      ctx.textBaseline="top";
      ctx.fillText("MAX "+max.toFixed(3),width-padding-2,yMax+2);
      ctx.restore();
    }

    function drawChartMulti(canvasId, series, colors, view){
      const canvas=document.getElementById(canvasId);
      if(!canvas) return;

      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const { w:width, h:height, ctx } = size;
      ctx.clearRect(0,0,width,height);
      const padding=6;
      ctx.save();
      ctx.strokeStyle="rgba(148,163,184,0.3)";
      ctx.lineWidth=0.8;
      ctx.setLineDash([3,4]);
      for(let i=0;i<=4;i++){
        let y=padding+(height-2*padding)*(i/4);
        y=height-y;
        ctx.beginPath(); ctx.moveTo(padding,y); ctx.lineTo(width-padding,y); ctx.stroke();
      }
      ctx.setLineDash([2,6]);
      for(let i=0;i<=4;i++){
        let x=padding+(width-2*padding)*(i/4);
        ctx.beginPath(); ctx.moveTo(x,padding); ctx.lineTo(x,height-padding); ctx.stroke();
      }
      ctx.restore();

      const base = (series && series.length) ? series[0] : null;
      if(!base || base.length < 2){
        ctx.save();
        ctx.fillStyle="rgba(71,85,105,0.65)";
        ctx.font="12px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(t("chartNoData"), width/2, height/2);
        ctx.restore();
        return;
      }

      const indices=getViewIndices(base,view);
      if(indices.end<indices.start) return;

      const slices = series.map((s)=>s.slice(indices.start, indices.end+1));
      const count = slices[0].length;
      if(count < 2) return;

      let min = Infinity;
      let max = -Infinity;
      for(const arr of slices){
        for(const v of arr){
          if(!isFinite(v)) continue;
          if(v < min) min = v;
          if(v > max) max = v;
        }
      }
      if(!isFinite(min) || !isFinite(max)) return;
      let range = max - min; if(range === 0) range = 1;
      const stepX=(width-2*padding)/(count-1);

      function yPos(value){
        return (height-padding) - ((value-min)/range)*(height-2*padding);
      }

      slices.forEach((arr, idx)=>{
        const color = colors && colors[idx] ? colors[idx] : "#0f172a";
        ctx.beginPath();
        for(let i=0;i<arr.length;i++){
          const v = arr[i];
          const x=padding+i*stepX;
          const y=yPos(isFinite(v) ? v : min);
          if(i===0) ctx.moveTo(x,y);
          else ctx.lineTo(x,y);
        }
        ctx.strokeStyle=color;
        ctx.lineWidth=1.2;
        ctx.stroke();
      });
    }

    function redrawCharts(){
      const thrustDisplay=thrustBaseHistory.map(convertThrustForDisplay);
      const pressureDisplay=pressureBaseHistory.slice();
      const accelDisplay=accelMagHistory.slice();
      drawChart("thrustChart", thrustDisplay, "#ef4444", chartView);
      drawChart("pressureChart", pressureDisplay, "#3b82f6", chartView);
      drawChart("accelChart", accelDisplay, "#f59e0b", chartView);
      drawChart("accelChartFlight", accelDisplay, "#f59e0b", chartView);
      drawChartMulti("accelXYZChart",
        [accelXHistory, accelYHistory, accelZHistory],
        ["#ef4444", "#22c55e", "#3b82f6"],
        chartView);
      drawChartMulti("accelXYZChartFlight",
        [accelXHistory, accelYHistory, accelZHistory],
        ["#ef4444", "#22c55e", "#3b82f6"],
        chartView);
    }
    let chartLayoutRaf = null;
    function scheduleChartLayoutRefresh(){
      if(chartLayoutRaf) cancelAnimationFrame(chartLayoutRaf);
      chartLayoutRaf = requestAnimationFrame(()=>{
        chartLayoutRaf = null;
        refreshChartLayout();
      });
    }
    let chartSyncTimer = null;
    function syncChartHeightToControls(attempt=0){
      if(chartSyncTimer) clearTimeout(chartSyncTimer);
      refreshChartLayout();
      if(!window.matchMedia("(min-width: 1100px)").matches) return;
      const chartsCard = document.querySelector(".charts-card");
      const controlsCard = document.getElementById("controlsCard");
      if(!chartsCard || !controlsCard) return;
      const targetH = Math.round(controlsCard.getBoundingClientRect().height);
      if(targetH < 2){
        if(attempt < 8){
          chartSyncTimer = setTimeout(()=>syncChartHeightToControls(attempt + 1), 120);
        }
        return;
      }
      const currentH = Math.round(chartsCard.getBoundingClientRect().height);
      if(Math.abs(currentH - targetH) > 2 && attempt < 8){
        chartSyncTimer = setTimeout(()=>syncChartHeightToControls(attempt + 1), 120);
      }
    }
    function refreshChartLayout(){
      const row = document.querySelector(".chart-row");
      if(row) row.style.height = "";
      const chartsCard = document.querySelector(".charts-card");
      const controlsCard = document.getElementById("controlsCard");
      if(chartsCard){
        chartsCard.style.height = "";
        chartsCard.style.minHeight = "";
      }
      if(chartsCard && controlsCard && window.matchMedia("(min-width: 1100px)").matches){
        const controlsRect = controlsCard.getBoundingClientRect();
        if(controlsRect.height > 0){
          const targetHeight = Math.round(controlsRect.height);
          chartsCard.style.height = targetHeight + "px";
          chartsCard.style.minHeight = targetHeight + "px";
        }
      }
      const ids=["thrustChart","pressureChart","accelChart","accelXYZChart","accelChartFlight","accelXYZChartFlight"];
      ids.forEach((id)=>{
        const canvas=document.getElementById(id);
        if(!canvas) return;
        canvas._cssW=null;
        canvas._cssH=null;
      });
      redrawCharts();
    }

    // =====================
    // 상태/버튼
    // =====================
    function setStatusFromState(st, ignOK, aborted, lockout, seqActive){
      if(!el.statusPill||!el.statusText) return 0;
      el.statusPill.classList.remove("hidden");
      if(el.statusPillMeta) el.statusPillMeta.classList.remove("hidden");

      if(lockout){
        el.statusPill.className="status-lock";
        if(el.statusPillMeta) el.statusPillMeta.className="status-lock";
        el.statusPill.textContent = t("statusLockout");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusLockout");
        const name = relayMaskName(lockoutRelayMask);
        el.statusText.textContent = t("statusLockoutText", {name});
        syncGyroStatusFromMain();
        return 9;
      }
      if(aborted){
        el.statusPill.className="status-abort";
        if(el.statusPillMeta) el.statusPillMeta.className="status-abort";
        el.statusPill.textContent = t("statusAbort");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusAbort");
        el.statusText.textContent = t("statusAbortTextReason", {reason:getAbortReasonLabel()});
        syncGyroStatusFromMain();
        return 4;
      }
      if(st===2){
        el.statusPill.className="status-fire";
        if(el.statusPillMeta) el.statusPillMeta.className="status-fire";
        el.statusPill.textContent = t("statusIgnition");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusIgnition");
        el.statusText.textContent = t("statusIgnitionText");
        syncGyroStatusFromMain();
        return 2;
      }
      if(st===1){
        el.statusPill.className="status-count";
        if(el.statusPillMeta) el.statusPillMeta.className="status-count";
        el.statusPill.textContent = t("statusCountdown");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusCountdown");
        el.statusText.textContent = t("statusCountdownText");
        syncGyroStatusFromMain();
        return 1;
      }
      if(seqActive){
        el.statusPill.className="status-seq";
        if(el.statusPillMeta) el.statusPillMeta.className="status-seq";
        el.statusPill.textContent = t("statusSequence");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusSequence");
        el.statusText.textContent = t("statusSequenceText");
        syncGyroStatusFromMain();
        return 5;
      }
      if(loadcellErrorActive && st===0){
        el.statusPill.className="status-loadcell";
        if(el.statusPillMeta) el.statusPillMeta.className="status-loadcell";
        el.statusPill.textContent = t("statusLoadcellCheck");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusLoadcellCheck");
        el.statusText.textContent = t("statusLoadcellCheck");
        syncGyroStatusFromMain();
        return 6;
      }
      if(!ignOK){
        el.statusPill.className="status-disc";
        if(el.statusPillMeta) el.statusPillMeta.className="status-disc";
        el.statusPill.textContent = t("statusNotArmed");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusNotArmed");
        const allowSeq = !(uiSettings && uiSettings.igs);
        el.statusText.textContent = allowSeq ? t("statusNotArmedTextReady") : t("statusNotArmedTextBlocked");
        syncGyroStatusFromMain();
        return 3;
      }
      el.statusPill.className="status-ready";
      if(el.statusPillMeta) el.statusPillMeta.className="status-ready";
      el.statusPill.textContent = t("statusReady");
      if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusReady");
      el.statusText.textContent = t("statusReadyText");
      syncGyroStatusFromMain();
      return 0;
    }

    function setButtonsFromState(st, lockout, seqActive){
      if(!el.igniteBtn||!el.abortBtn){ updateControlAccessUI(st); return; }
      const running = !!(seqActive || st===1 || st===2 || localTplusActive);
      const readyEligible = !replaySourceActive && isControlUnlocked() && connOk && hasMissionSelected() && !safetyModeEnabled && !loadcellErrorActive && st === 0 && !running;
      if(replaySourceActive){
        el.igniteBtn.disabled = true;
        el.abortBtn.disabled = true;
        setIgniteButtonLabel("sequenceStartBtn");
        updateControlAccessUI(st);
        return;
      }
      if(lockout){
        el.igniteBtn.disabled=true;
        el.abortBtn.disabled=true;
        setIgniteButtonLabel("sequenceStartBtn");
        updateControlAccessUI(st);
        return;
      }
      if(!isControlUnlocked()){
        el.igniteBtn.disabled = true;
        el.abortBtn.disabled = (st===0);
        setIgniteButtonLabel("sequenceStartBtn");
        updateControlAccessUI(st);
        return;
      }
      if(loadcellErrorActive && st===0){
        el.igniteBtn.disabled=true;
        el.abortBtn.disabled=true;
        setIgniteButtonLabel("sequenceStartBtn");
        updateControlAccessUI(st);
        return;
      }
      if(st===0){
        el.igniteBtn.disabled = !readyEligible;
        el.abortBtn.disabled = true;
        setIgniteButtonLabel(readyEligible ? "sequenceReadyBtn" : "sequenceStartBtn");
      }else{
        el.igniteBtn.disabled=false;
        el.abortBtn.disabled=false;
        setIgniteButtonLabel("sequenceStartBtn");
      }
      if(safetyModeEnabled){
        el.igniteBtn.disabled = true;
        if(st===0) el.abortBtn.disabled = true;
      }
      if(running){
        el.igniteBtn.disabled = true;
        el.abortBtn.disabled = false;
        setIgniteButtonLabel("sequenceStartBtn");
      }
      updateControlAccessUI(st);
      updateMobileAbortButton();
      updateMobileSequenceStatusLabel(seqActive, st, lockout);
    }

    function updateMobileSequenceStatusLabel(seqActive, st, lockout){
      const running = !!(seqActive || st === 1 || st === 2 || localTplusActive);
      const readyEligible = !replaySourceActive && isControlUnlocked() && connOk && hasMissionSelected() && !safetyModeEnabled && !loadcellErrorActive && st === 0 && !running;
      let label = "진행 불가";
      if(lockout){
        label = "제한";
      }else if(running){
        label = "진행중";
      }else if(readyEligible){
        label = "준비";
      }
      if(el.sequenceStatusLabel) el.sequenceStatusLabel.textContent = label;
      if(el.sequenceStatusDesktop) el.sequenceStatusDesktop.textContent = label;
    }

    function setReplayStatus(text){
      if(el.replayStatusText) el.replayStatusText.textContent = String(text || "");
    }

    function setActiveDataSource(mode){
      const next = (mode === DATA_SOURCE_REPLAY) ? DATA_SOURCE_REPLAY : DATA_SOURCE_LIVE;
      if(activeDataSource === next) return;
      activeDataSource = next;
      replaySourceActive = (next === DATA_SOURCE_REPLAY);
      updateInspectionAccess();
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      updateControlAccessUI(currentSt);
      evaluateRuntimeAlarms(Date.now());
    }

    function resetReplayBuffers(){
      thrustBaseHistory = [];
      pressureBaseHistory = [];
      accelMagHistory = [];
      accelXHistory = [];
      accelYHistory = [];
      accelZHistory = [];
      chartTimeHistory = [];
      sampleHistory = [];
      logData = [];
      logDataRevision = 0;
      reportExportedRevision = 0;
      reportExportedOnce = false;
      firstSampleMs = null;
      sampleCounter = 0;
      rxWindowStartMs = 0;
      rxWindowCount = 0;
      rxHzWindow = 0;
      prevSwState = null;
      prevIcState = null;
      prevGsState = null;
      prevSmState = null;
      prevStForIgn = 0;
      ignitionAnalysis = {hasData:false,ignStartMs:null,thresholdMs:null,lastAboveMs:null,windowStartMs:null,windowEndMs:null,delaySec:null,durationSec:null,endNotified:false};
      lastBurnSeconds = null;
      lastStatusCode = -1;
      currentSt = 0;
      sequenceActive = false;
      st2StartMs = null;
      localTplusActive = false;
      localTplusStartMs = null;
      if(el.countdown) el.countdown.textContent = "T- --:--:??";
      if(el.countdownMobile) el.countdownMobile.textContent = "T- --:--:??";
      if(el.countdownBig) el.countdownBig.textContent = "T- --:--:??";
      updateAbortButtonLabel(false);
      autoScrollChart = true;
      chartView.startMs = null;
      redrawCharts();
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      updateControlAccessUI(currentSt);
      updateExportGuardUi();
    }

    function formatReplayMs(ms){
      const value = Math.max(0, Math.round(Number(ms) || 0));
      const min = Math.floor(value / 60000);
      const sec = Math.floor((value % 60000) / 1000);
      const msec = value % 1000;
      return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0") + "." + String(msec).padStart(3, "0");
    }

    function replayRelativeMsAt(index){
      if(!replayState.samples.length) return 0;
      const first = replayState.samples[0].tsMs;
      const maxIndex = replayState.samples.length - 1;
      const clamped = Math.max(0, Math.min(maxIndex, index));
      const ts = replayState.samples[clamped].tsMs;
      const rel = ts - first;
      return isFinite(rel) ? Math.max(0, rel) : 0;
    }

    function updateReplaySeekUi(overrideIndex){
      const total = replayState.samples.length;
      const maxIndex = Math.max(0, total - 1);
      const defaultIndex = (replayState.lastIndex >= 0)
        ? replayState.lastIndex
        : Math.max(0, replayState.index - 1);
      const index = (overrideIndex == null) ? defaultIndex : Math.max(0, Math.min(maxIndex, Number(overrideIndex) || 0));
      if(el.replaySeekRange){
        el.replaySeekRange.max = String(maxIndex);
        el.replaySeekRange.value = String(index);
        el.replaySeekRange.disabled = total <= 1;
      }
      if(el.replaySeekLabel){
        const currentMs = (total > 0) ? replayRelativeMsAt(index) : 0;
        const totalMs = (total > 0) ? replayRelativeMsAt(maxIndex) : 0;
        el.replaySeekLabel.textContent = formatReplayMs(currentMs) + " / " + formatReplayMs(totalMs);
      }
    }

    function updateReplaySpeedUi(){
      if(!el.replaySpeedBtns || !el.replaySpeedBtns.length) return;
      el.replaySpeedBtns.forEach(btn=>{
        const speed = Number(btn.getAttribute("data-replay-speed"));
        const active = isFinite(speed) && Math.abs(speed - replayState.speed) < 0.001;
        btn.classList.toggle("is-active", active);
      });
    }

    function updateReplayModeUi(){
      if(el.controlsCard){
        el.controlsCard.classList.toggle("replay-mode", replayUiActive);
      }
      if(el.replayPanel){
        el.replayPanel.classList.toggle("hidden", !replayUiActive);
        el.replayPanel.setAttribute("aria-hidden", replayUiActive ? "false" : "true");
      }
      if(el.replayOpenBtn){
        el.replayOpenBtn.classList.toggle("is-active", replayUiActive);
        el.replayOpenBtn.textContent = replayUiActive ? "실시간 복귀" : "Replay";
      }
      if(el.replayFileBtn){
        el.replayFileBtn.classList.toggle("is-loaded", !!replayState.fileName);
      }
      if(el.controlsCardTitle){
        el.controlsCardTitle.textContent = replayUiActive ? "DATA REPLAY" : "CONTROL PANEL";
      }
      if(el.replayDropTitle){
        el.replayDropTitle.textContent = replayState.fileName ? replayState.fileName : "Replay 파일 업로드";
      }
      if(el.replayDropGuide){
        el.replayDropGuide.textContent = replayState.fileName
          ? ("파일 변경: 클릭 또는 드래그 (" + replayState.samples.length + " samples)")
          : "파일을 드래그 하거나 클릭하여 업로드하세요.";
      }
      const hasSamples = replayState.samples.length > 0;
      const hasProgress = replayState.lastIndex >= 0 || replayState.index > 0;
      if(el.replayStartBtn){
        el.replayStartBtn.textContent = replayState.playing ? "재생 중" : (hasProgress ? "Replay 재개" : "Replay 시작");
        el.replayStartBtn.disabled = !hasSamples || replayState.playing;
      }
      if(el.replayStopBtn){
        el.replayStopBtn.disabled = !hasSamples || !replayState.playing;
      }
      if(el.replayRestartBtn){
        el.replayRestartBtn.disabled = !hasSamples;
      }
      if(el.replayTminus10Btn){
        el.replayTminus10Btn.disabled = !hasSamples;
      }
      updateReplaySeekUi();
      updateReplaySpeedUi();
    }

    function clearReplayTimer(){
      if(replayState.timer){
        clearTimeout(replayState.timer);
        replayState.timer = null;
      }
    }

    function applyReplaySampleAt(index){
      if(index < 0 || index >= replayState.samples.length) return false;
      const frame = replayState.samples[index];
      if(!frame || !frame.sample) return false;
      onIncomingSample(frame.sample, "REPLAY");
      replayState.lastIndex = index;
      updateReplaySeekUi(index);
      return true;
    }

    function scheduleReplayTick(delayMs){
      clearReplayTimer();
      if(!replayState.playing) return;
      const waitMs = Math.max(0, Math.round(Number(delayMs) || 0));
      replayState.timer = setTimeout(runReplayTick, waitMs);
    }

    function runReplayTick(){
      replayState.timer = null;
      if(!replayState.playing) return;
      const total = replayState.samples.length;
      if(total <= 0){
        replayState.playing = false;
        setReplayStatus("리플레이 데이터가 없습니다.");
        updateReplayModeUi();
        return;
      }
      if(replayState.index >= total){
        replayState.playing = false;
        setReplayStatus("리플레이가 끝났습니다.");
        updateReplayModeUi();
        notifyAlarm("REPLAY_AUTOSTOP");
        return;
      }

      const currentIndex = replayState.index;
      if(!applyReplaySampleAt(currentIndex)){
        replayState.playing = false;
        setReplayStatus("리플레이 샘플 재생에 실패했습니다.");
        updateReplayModeUi();
        return;
      }
      replayState.index = currentIndex + 1;
      updateReplayModeUi();

      if(!replayState.playing) return;
      if(replayState.index >= total){
        replayState.playing = false;
        setReplayStatus("리플레이가 끝났습니다.");
        updateReplayModeUi();
        notifyAlarm("REPLAY_AUTOSTOP");
        return;
      }

      const nowTs = replayState.samples[currentIndex].tsMs;
      const nextTs = replayState.samples[replayState.index].tsMs;
      let deltaMs = Number(nextTs) - Number(nowTs);
      if(!isFinite(deltaMs) || deltaMs < 1) deltaMs = 1;
      const speed = (isFinite(replayState.speed) && replayState.speed > 0) ? replayState.speed : 1;
      scheduleReplayTick(deltaMs / speed);
    }

    function pauseReplayPlayback(opts){
      const silent = !!(opts && opts.silent);
      clearReplayTimer();
      const wasPlaying = replayState.playing;
      replayState.playing = false;
      updateReplayModeUi();
      if(wasPlaying && !silent){
        setReplayStatus("리플레이를 정지했습니다.");
      }
    }

    function startReplayPlayback(){
      if(!replayState.samples.length){
        showToast("리플레이 파일(.xlsx)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
        return;
      }
      if(replayState.playing) return;
      if(replayState.index >= replayState.samples.length){
        replayState.index = 0;
        replayState.lastIndex = -1;
      }
      if(replayState.lastIndex < 0 && replayState.index === 0){
        resetReplayBuffers();
      }
      setActiveDataSource(DATA_SOURCE_REPLAY);
      replayState.playing = true;
      setReplayStatus("리플레이 재생 중");
      updateReplayModeUi();
      scheduleReplayTick(0);
    }

    function restartReplayPlayback(){
      if(!replayState.samples.length){
        showToast("리플레이 파일(.xlsx)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
        return;
      }
      pauseReplayPlayback({silent:true});
      setActiveDataSource(DATA_SOURCE_REPLAY);
      replayState.index = 0;
      replayState.lastIndex = -1;
      resetReplayBuffers();
      replayState.playing = true;
      setReplayStatus("리플레이를 처음부터 재생합니다.");
      updateReplayModeUi();
      scheduleReplayTick(0);
    }

    function seekReplayToIndex(targetIndex, resumePlayback){
      if(!replayState.samples.length) return;
      const maxIndex = replayState.samples.length - 1;
      const index = Math.max(0, Math.min(maxIndex, Number(targetIndex) || 0));
      const shouldResume = !!resumePlayback;
      pauseReplayPlayback({silent:true});
      setActiveDataSource(DATA_SOURCE_REPLAY);
      resetReplayBuffers();
      applyReplaySampleAt(index);
      replayState.index = index + 1;
      setReplayStatus("리플레이 시점을 이동했습니다.");
      updateReplayModeUi();
      if(shouldResume && replayState.index <= maxIndex){
        const nowTs = replayState.samples[index].tsMs;
        const nextTs = replayState.samples[replayState.index].tsMs;
        let deltaMs = Number(nextTs) - Number(nowTs);
        if(!isFinite(deltaMs) || deltaMs < 1) deltaMs = 1;
        const speed = (isFinite(replayState.speed) && replayState.speed > 0) ? replayState.speed : 1;
        replayState.playing = true;
        updateReplayModeUi();
        scheduleReplayTick(deltaMs / speed);
      }
    }

    function findReplayTminusIndex(targetMs){
      const target = Number(targetMs);
      if(!isFinite(target)) return -1;
      if(!replayState.samples.length) return -1;
      let bestIndex = -1;
      let bestDiff = Infinity;

      for(let i = 0; i < replayState.samples.length; i++){
        const frame = replayState.samples[i];
        const td = Number(frame && frame.sample ? frame.sample.td : NaN);
        if(!isFinite(td) || td >= 0) continue;
        const diff = Math.abs(td - target);
        if(diff < bestDiff){
          bestDiff = diff;
          bestIndex = i;
        }
      }
      if(bestIndex >= 0){
        return bestIndex;
      }

      let t0Ts = null;
      for(let i = 0; i < replayState.samples.length; i++){
        const frame = replayState.samples[i];
        const td = Number(frame && frame.sample ? frame.sample.td : NaN);
        if(isFinite(td) && td >= 0){
          t0Ts = Number(frame.tsMs);
          break;
        }
      }
      if(!isFinite(t0Ts)){
        for(let i = 0; i < replayState.samples.length; i++){
          const frame = replayState.samples[i];
          const st = Number(frame && frame.sample ? frame.sample.st : NaN);
          if(st === 2){
            t0Ts = Number(frame.tsMs);
            break;
          }
        }
      }
      if(!isFinite(t0Ts)){
        return -1;
      }

      const targetTs = t0Ts + target;
      let nearest = -1;
      let nearestDiff = Infinity;
      for(let i = 0; i < replayState.samples.length; i++){
        const frameTs = Number(replayState.samples[i].tsMs);
        if(!isFinite(frameTs)) continue;
        const diff = Math.abs(frameTs - targetTs);
        if(diff < nearestDiff){
          nearestDiff = diff;
          nearest = i;
        }
      }
      return nearest;
    }

    function seekReplayToTminus10(){
      if(!replayState.samples.length){
        showToast("리플레이 파일(.xlsx)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
        return;
      }
      const idx = findReplayTminusIndex(-10000);
      if(idx < 0){
        setReplayStatus("T-10 지점을 찾지 못했습니다.");
        showToast("T-10 지점을 찾지 못했습니다.", "notice", {key:"replay-tminus-missing"});
        return;
      }
      const resume = replayState.playing;
      seekReplayToIndex(idx, resume);
      setReplayStatus("T-10 지점으로 이동했습니다.");
      showToast("T-10 지점으로 이동했습니다.", "info", {key:"replay-tminus10"});
    }

    function enterReplayMode(){
      hideMobileControlsPanel();
      replayUiActive = true;
      if(!replayState.samples.length){
        showToast("리플레이 파일을 선택하세요.", "notice", {key:"replay-select-file"});
      }
      updateReplayModeUi();
    }

    function exitReplayMode(){
      replayUiActive = false;
      pauseReplayPlayback({silent:true});
      setActiveDataSource(DATA_SOURCE_LIVE);
      setReplayStatus("실시간 모드");
      updateReplayModeUi();
      updateData().catch(()=>{});
    }

    function replayNormalizeZipPath(path){
      const parts = [];
      String(path || "").replace(/\\/g, "/").split("/").forEach(part=>{
        if(!part || part === ".") return;
        if(part === ".."){
          if(parts.length) parts.pop();
          return;
        }
        parts.push(part);
      });
      return parts.join("/");
    }

    function replayResolveZipPath(baseDir, target){
      if(!target) return "";
      if(target[0] === "/") return replayNormalizeZipPath(target.slice(1));
      return replayNormalizeZipPath((baseDir ? (baseDir + "/") : "") + target);
    }

    async function replayInflateDeflateRaw(dataBytes){
      if(typeof DecompressionStream === "undefined"){
        throw new Error("브라우저에서 XLSX 압축 해제를 지원하지 않습니다. (DecompressionStream 없음)");
      }
      const stream = new Blob([dataBytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      const arrayBuffer = await new Response(stream).arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    async function replayUnzipEntries(arrayBuffer){
      const bytes = new Uint8Array(arrayBuffer);
      const view = new DataView(arrayBuffer);
      const EOCD_SIG = 0x06054b50;
      const CD_SIG = 0x02014b50;
      const LOCAL_SIG = 0x04034b50;

      let eocdOffset = -1;
      const searchStart = Math.max(0, bytes.length - 65557);
      for(let i = bytes.length - 22; i >= searchStart; i--){
        if(view.getUint32(i, true) === EOCD_SIG){
          eocdOffset = i;
          break;
        }
      }
      if(eocdOffset < 0){
        throw new Error("XLSX ZIP 구조를 찾지 못했습니다.");
      }

      const centralDirSize = view.getUint32(eocdOffset + 12, true);
      const centralDirOffset = view.getUint32(eocdOffset + 16, true);
      const centralDirEnd = centralDirOffset + centralDirSize;
      if(centralDirEnd > bytes.length){
        throw new Error("XLSX ZIP 중앙 디렉터리가 손상되었습니다.");
      }

      const decoder = new TextDecoder("utf-8");
      const entries = new Map();
      let ptr = centralDirOffset;
      while(ptr < centralDirEnd){
        if(view.getUint32(ptr, true) !== CD_SIG) break;
        const method = view.getUint16(ptr + 10, true);
        const compressedSize = view.getUint32(ptr + 20, true);
        const nameLen = view.getUint16(ptr + 28, true);
        const extraLen = view.getUint16(ptr + 30, true);
        const commentLen = view.getUint16(ptr + 32, true);
        const localHeaderOffset = view.getUint32(ptr + 42, true);
        const fileName = decoder.decode(bytes.slice(ptr + 46, ptr + 46 + nameLen));

        ptr += 46 + nameLen + extraLen + commentLen;

        if(view.getUint32(localHeaderOffset, true) !== LOCAL_SIG){
          throw new Error("XLSX 로컬 헤더가 손상되었습니다: " + fileName);
        }
        const localNameLen = view.getUint16(localHeaderOffset + 26, true);
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const dataEnd = dataStart + compressedSize;
        if(dataEnd > bytes.length){
          throw new Error("XLSX 파일 항목 범위를 벗어났습니다: " + fileName);
        }

        const raw = bytes.slice(dataStart, dataEnd);
        let decoded;
        if(method === 0){
          decoded = raw;
        }else if(method === 8){
          decoded = await replayInflateDeflateRaw(raw);
        }else{
          throw new Error("지원하지 않는 XLSX 압축 방식(" + method + "): " + fileName);
        }
        entries.set(replayNormalizeZipPath(fileName), decoded);
      }
      return entries;
    }

    function replayZipText(entries, path){
      const key = replayNormalizeZipPath(path);
      const bytes = entries.get(key);
      if(!bytes) return null;
      return new TextDecoder("utf-8").decode(bytes);
    }

    function replayParseXml(xmlText, name){
      const doc = new DOMParser().parseFromString(xmlText, "application/xml");
      if(doc.getElementsByTagName("parsererror").length){
        throw new Error("XML 파싱 오류: " + (name || "unknown"));
      }
      return doc;
    }

    function replayNodeText(node){
      if(!node) return "";
      const tNodes = Array.from(node.getElementsByTagName("t"));
      if(!tNodes.length){
        return node.textContent || "";
      }
      return tNodes.map(n=>n.textContent || "").join("");
    }

    function replayCellRefToColIndex(ref){
      const match = /^[A-Z]+/i.exec(ref || "");
      if(!match) return -1;
      const letters = match[0].toUpperCase();
      let col = 0;
      for(let i = 0; i < letters.length; i++){
        col = (col * 26) + (letters.charCodeAt(i) - 64);
      }
      return col - 1;
    }

    function replayReadSharedStrings(entries){
      const xml = replayZipText(entries, "xl/sharedStrings.xml");
      if(!xml) return [];
      const doc = replayParseXml(xml, "sharedStrings");
      return Array.from(doc.getElementsByTagName("si")).map(node=>replayNodeText(node));
    }

    function replayReadCellValue(cell, sharedStrings){
      const type = cell.getAttribute("t") || "";
      if(type === "inlineStr"){
        const isNode = cell.getElementsByTagName("is")[0];
        return replayNodeText(isNode || cell);
      }
      const vNode = cell.getElementsByTagName("v")[0];
      const raw = vNode ? String(vNode.textContent || "") : "";
      if(type === "s"){
        const idx = Number(raw);
        return (isFinite(idx) && sharedStrings[idx] != null) ? sharedStrings[idx] : "";
      }
      if(type === "b"){
        return raw === "1" ? 1 : 0;
      }
      if(raw === "") return "";
      const num = Number(raw);
      return isFinite(num) ? num : raw;
    }

    function replayReadSheetRows(sheetXml, sharedStrings){
      const doc = replayParseXml(sheetXml, "worksheet");
      const rows = [];
      const rowNodes = Array.from(doc.getElementsByTagName("row"));
      rowNodes.forEach(rowNode=>{
        const row = [];
        const cells = Array.from(rowNode.getElementsByTagName("c"));
        let fallbackCol = 0;
        cells.forEach(cell=>{
          let col = replayCellRefToColIndex(cell.getAttribute("r") || "");
          if(col < 0) col = fallbackCol;
          row[col] = replayReadCellValue(cell, sharedStrings);
          fallbackCol = col + 1;
        });
        rows.push(row);
      });
      return rows;
    }

    function replayNormalizeHeader(value){
      return String(value == null ? "" : value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9가-힣_]/g, "");
    }

    function replayFindHeaderIndex(headers, candidates){
      const normalized = headers.map(replayNormalizeHeader);
      for(const candidate of candidates){
        const token = replayNormalizeHeader(candidate);
        const idx = normalized.indexOf(token);
        if(idx >= 0) return idx;
      }
      return -1;
    }

    function replayToNumber(value, fallback){
      const num = Number(value);
      return isFinite(num) ? num : fallback;
    }

    function replayToBinary(value, fallback){
      if(typeof value === "string"){
        const token = value.trim().toLowerCase();
        if(token === "1" || token === "true" || token === "on" || token === "high" || token === "ok") return 1;
        if(token === "0" || token === "false" || token === "off" || token === "low" || token === "no") return 0;
      }
      const num = Number(value);
      if(isFinite(num)) return num ? 1 : 0;
      return fallback;
    }

    function replayExcelSerialToMs(serial){
      const n = Number(serial);
      if(!isFinite(n)) return null;
      return Math.round((n - 25569) * 86400000);
    }

    function replayBuildSamples(rows){
      if(!rows || !rows.length){
        throw new Error("시트에 데이터가 없습니다.");
      }

      let headerRow = 0;
      for(let i = 0; i < Math.min(rows.length, 12); i++){
        const row = rows[i] || [];
        const thrustIdx = replayFindHeaderIndex(row, ["thrust_kgf", "추력_kgf", "thrust", "t"]);
        const pressureIdx = replayFindHeaderIndex(row, ["pressure_v", "압력_v", "pressure", "p"]);
        if(thrustIdx >= 0 || pressureIdx >= 0){
          headerRow = i;
          break;
        }
      }

      const headers = rows[headerRow] || [];
      const col = {
        timeIso: replayFindHeaderIndex(headers, ["time_iso", "시간_iso", "timestamp", "datetime", "time"]),
        thrust: replayFindHeaderIndex(headers, ["thrust_kgf", "추력_kgf", "thrust", "t"]),
        pressure: replayFindHeaderIndex(headers, ["pressure_v", "압력_v", "pressure", "p"]),
        accelX: replayFindHeaderIndex(headers, ["accel_x_g", "가속도_x_g", "ax", "accel_x"]),
        accelY: replayFindHeaderIndex(headers, ["accel_y_g", "가속도_y_g", "ay", "accel_y"]),
        accelZ: replayFindHeaderIndex(headers, ["accel_z_g", "가속도_z_g", "az", "accel_z"]),
        gyroX: replayFindHeaderIndex(headers, ["gyro_x_dps", "자이로_x_dps", "gx", "gyro_x"]),
        gyroY: replayFindHeaderIndex(headers, ["gyro_y_dps", "자이로_y_dps", "gy", "gyro_y"]),
        gyroZ: replayFindHeaderIndex(headers, ["gyro_z_dps", "자이로_z_dps", "gz", "gyro_z"]),
        loopMs: replayFindHeaderIndex(headers, ["loop_ms", "루프_ms", "lt"]),
        hz: replayFindHeaderIndex(headers, ["hx_hz", "hz"]),
        cpuUs: replayFindHeaderIndex(headers, ["cpu_us", "cpu", "ct"]),
        sw: replayFindHeaderIndex(headers, ["switch", "스위치", "s"]),
        ic: replayFindHeaderIndex(headers, ["ign_ok", "점화_정상", "ic", "igniter"]),
        relay: replayFindHeaderIndex(headers, ["relay", "릴레이", "r"]),
        gs: replayFindHeaderIndex(headers, ["igs_mode", "igs_모드", "igs", "gs"]),
        state: replayFindHeaderIndex(headers, ["state", "상태", "st"]),
        tdMs: replayFindHeaderIndex(headers, ["td_ms", "tdms", "td"]),
        elapsedMs: replayFindHeaderIndex(headers, ["elapsed_ms", "경과_ms", "elapsed"]),
        relTimeSec: replayFindHeaderIndex(headers, ["rel_time_s", "상대시간_s", "reltime", "time_axis"])
      };

      if(col.thrust < 0 && col.pressure < 0){
        throw new Error("RAW 시트에서 추력/압력 컬럼을 찾지 못했습니다.");
      }

      const samples = [];
      let prevTs = null;
      for(let r = headerRow + 1; r < rows.length; r++){
        const row = rows[r] || [];
        if(!row.length) continue;

        const thrustVal = replayToNumber(col.thrust >= 0 ? row[col.thrust] : null, NaN);
        const pressureVal = replayToNumber(col.pressure >= 0 ? row[col.pressure] : null, NaN);
        if(!isFinite(thrustVal) && !isFinite(pressureVal)) continue;

        let tsMs = null;
        if(col.timeIso >= 0){
          const rawTs = row[col.timeIso];
          if(typeof rawTs === "number"){
            if(rawTs > 1000000000){
              tsMs = (rawTs > 1000000000000) ? rawTs : (rawTs * 1000);
            }else{
              tsMs = replayExcelSerialToMs(rawTs);
            }
          }else if(rawTs != null && rawTs !== ""){
            const parsed = Date.parse(String(rawTs));
            if(isFinite(parsed)) tsMs = parsed;
          }
        }
        if(tsMs == null && col.elapsedMs >= 0){
          const elapsed = replayToNumber(row[col.elapsedMs], NaN);
          if(isFinite(elapsed)) tsMs = elapsed;
        }
        if(tsMs == null && col.relTimeSec >= 0){
          const relSec = replayToNumber(row[col.relTimeSec], NaN);
          if(isFinite(relSec)) tsMs = relSec * 1000;
        }
        if(tsMs == null && col.hz >= 0 && prevTs != null){
          const hz = replayToNumber(row[col.hz], NaN);
          if(isFinite(hz) && hz > 0) tsMs = prevTs + (1000 / hz);
        }
        if(tsMs == null){
          tsMs = (prevTs == null) ? 0 : (prevTs + 100);
        }
        if(prevTs != null && tsMs <= prevTs){
          tsMs = prevTs + 1;
        }
        prevTs = tsMs;

        samples.push({
          tsMs,
          sample: {
            t: isFinite(thrustVal) ? thrustVal : 0,
            p: isFinite(pressureVal) ? pressureVal : 0,
            ax: replayToNumber(col.accelX >= 0 ? row[col.accelX] : null, 0),
            ay: replayToNumber(col.accelY >= 0 ? row[col.accelY] : null, 0),
            az: replayToNumber(col.accelZ >= 0 ? row[col.accelZ] : null, 0),
            gx: replayToNumber(col.gyroX >= 0 ? row[col.gyroX] : null, 0),
            gy: replayToNumber(col.gyroY >= 0 ? row[col.gyroY] : null, 0),
            gz: replayToNumber(col.gyroZ >= 0 ? row[col.gyroZ] : null, 0),
            lt: replayToNumber(col.loopMs >= 0 ? row[col.loopMs] : null, 0),
            hz: replayToNumber(col.hz >= 0 ? row[col.hz] : null, 0),
            ct: replayToNumber(col.cpuUs >= 0 ? row[col.cpuUs] : null, 0),
            s: replayToBinary(col.sw >= 0 ? row[col.sw] : null, 0),
            ic: replayToBinary(col.ic >= 0 ? row[col.ic] : null, 0),
            r: replayToNumber(col.relay >= 0 ? row[col.relay] : null, 0),
            gs: replayToBinary(col.gs >= 0 ? row[col.gs] : null, 0),
            st: replayToNumber(col.state >= 0 ? row[col.state] : null, 0),
            td: (col.tdMs >= 0) ? replayToNumber(row[col.tdMs], 0) : null
          }
        });
      }

      if(!samples.length){
        throw new Error("리플레이 가능한 샘플이 없습니다.");
      }
      return samples;
    }

    function replaySelectSheetPath(entries){
      const workbookXml = replayZipText(entries, "xl/workbook.xml");
      const relsXml = replayZipText(entries, "xl/_rels/workbook.xml.rels");
      let preferred = null;
      if(workbookXml && relsXml){
        const wbDoc = replayParseXml(workbookXml, "workbook");
        const relDoc = replayParseXml(relsXml, "workbook.rels");
        const relMap = {};
        Array.from(relDoc.getElementsByTagName("Relationship")).forEach(rel=>{
          const id = rel.getAttribute("Id");
          const target = rel.getAttribute("Target");
          if(id && target){
            relMap[id] = replayResolveZipPath("xl", target);
          }
        });
        let fallback = null;
        Array.from(wbDoc.getElementsByTagName("sheet")).forEach(sheet=>{
          const rid = sheet.getAttribute("r:id");
          const name = String(sheet.getAttribute("name") || "").trim().toLowerCase();
          const path = rid ? relMap[rid] : null;
          if(path && !fallback) fallback = path;
          if(path && (name === "raw" || name.indexOf("raw") >= 0)){
            preferred = path;
          }
        });
        if(!preferred) preferred = fallback;
      }
      return preferred ? replayNormalizeZipPath(preferred) : null;
    }

    async function parseReplayXlsx(file){
      if(!file) throw new Error("리플레이 파일이 선택되지 않았습니다.");
      const entries = await replayUnzipEntries(await file.arrayBuffer());
      const worksheetPaths = Array.from(entries.keys())
        .filter(name=>/^xl\/worksheets\/.+\.xml$/i.test(name))
        .sort();
      if(!worksheetPaths.length){
        throw new Error("XLSX 워크시트를 찾지 못했습니다.");
      }

      const preferred = replaySelectSheetPath(entries);
      const targets = preferred
        ? [preferred, ...worksheetPaths.filter(name=>name !== preferred)]
        : worksheetPaths.slice();
      const sharedStrings = replayReadSharedStrings(entries);
      let lastErr = null;
      for(const path of targets){
        try{
          const sheetXml = replayZipText(entries, path);
          if(!sheetXml) continue;
          const rows = replayReadSheetRows(sheetXml, sharedStrings);
          const samples = replayBuildSamples(rows);
          if(samples.length) return samples;
        }catch(err){
          lastErr = err;
        }
      }
      throw (lastErr || new Error("리플레이 데이터를 해석하지 못했습니다."));
    }

    // =====================
    // 통신: WebSocket 스트림
    // =====================
    function getWsUrl(){
      const proto = (location.protocol === "https:") ? "wss" : "ws";
      const host = location.host || "192.168.4.1";
      return proto + "://" + host + "/ws";
    }

    function addWsLog(msg){
      if(!wsLogSilent) addLogLine(msg, "NET");
    }

    function scheduleWsReconnect(reason){
      if(wsRetryTimer) return;
      const delay = Math.min(WS_RETRY_MAX_MS, wsRetryMs);
      wsRetryMs = Math.min(WS_RETRY_MAX_MS, Math.round(wsRetryMs * 1.6 + 80));
      wsRetryTimer = setTimeout(()=>{ wsRetryTimer = null; openWebSocket(); }, delay);

      if(reason){
        addWsLog(t("wsReconnect", {reason}));
      }
    }

    function openWebSocket(){
      const url = getWsUrl();
      addWsLog(t("wsConnecting", {url}));
      try{
        wsSocket = new WebSocket(url);
      }catch(e){
        scheduleWsReconnect("open failed");
        return;
      }

      wsSocket.onopen = ()=>{
        wsConnected = true;
        wsEverConnected = true;
        setAlarmActive("WS_DISCONNECTED", false);
        updateWsUI();
        wsRetryMs = 300;
        addWsLog(t("wsConnected", {url}));
      };

      wsSocket.onmessage = (ev)=>{
        wsLastMsgMs = Date.now();
        if(!ev || !ev.data) return;
        try{
          const obj = JSON.parse(ev.data);
          onIncomingSample(obj, "WS");
        }catch(e){
          reportSilentException("ws-json", e);
        }
      };

      wsSocket.onerror = ()=>{
        wsConnected = false;
        addWsLog(t("wsError"));
        setAlarmActive("WS_DISCONNECTED", true);
        updateWsUI();
      };

      wsSocket.onclose = (ev)=>{
        wsConnected = false;
        const code = ev?.code ?? 0;
        const reason = ev?.reason || "-";
        addWsLog(t("wsClosed", {code, reason}));
        setAlarmActive("WS_DISCONNECTED", true);
        updateWsUI();
        scheduleWsReconnect("closed");
      };
    }

    function ensureWsAlive(){
      if(replaySourceActive) return;
      if(wsConnected && (Date.now() - wsLastMsgMs) > DISCONNECT_GRACE_MS){
        failStreak = FAIL_STREAK_LIMIT;
        markDisconnectedIfNeeded(t("wsTimeout"));
        wsConnected = false;
        updateWsUI();
      }
      evaluateRuntimeAlarms(Date.now());
    }

    // =====================
    // 통신: Wi-Fi 폴링
    // =====================
    async function fetchJsonTimeout(url, timeoutMs){
      const ctrl = new AbortController();
      const t = setTimeout(()=>{ try{ ctrl.abort(); }catch(e){} }, timeoutMs);
      try{
        const resp = await fetch(url, { cache:"no-cache", signal: ctrl.signal });
        if(!resp.ok) throw new Error("HTTP " + resp.status);
        return await resp.json();
      }finally{
        clearTimeout(t);
      }
    }

    async function fetchJsonWithFallback(){
      const order = [preferredEndpoint, ...ENDPOINTS.filter(e=>e!==preferredEndpoint)];
      let lastErr = null;

      for(const url of order){
        try{
          const obj = await fetchJsonTimeout(url, 700);
          preferredEndpoint = url;
          return obj;
        }catch(e){
          lastErr = e;
        }
      }
      throw (lastErr || new Error("no valid endpoint"));
    }

    function markDisconnectedIfNeeded(reason){
      if(replaySourceActive) return;
      const now = Date.now();
      const sinceOk = now - (lastOkMs || 0);

      if(sinceOk > DISCONNECT_GRACE_MS && failStreak >= FAIL_STREAK_LIMIT){
        if(connOk){
          connOk = false;
          updateConnectionUI(false);
        }

        if(el.statusPill && el.statusText && !lockoutLatched){
          el.statusPill.className="status-disc hidden";
          el.statusPill.textContent = "";
          el.statusText.textContent = reason || t("statusNoResponse");
          syncCountdownInlineStatus();
        }

        if(!disconnectedLogged){
          if(!wsLogSilent) addLogLine(t("wsLost"), "DISC");
          disconnectedLogged = true;
        }

        if(!unstableToastShown){
          unstableToastShown = true;
          showToast(t("boardUnstable"), "warn");
        }
      }
    }

    // =====================
    // WebSerial helpers
    // =====================
    function serialSupported(){ return !!(navigator && navigator.serial); }

    async function serialConnect(){
      if(!serialSupported()){
        showToast(t("webserialUnsupported"), "notice");
        return;
      }
      try{
        serialPort = await navigator.serial.requestPort({});
        await serialPort.open({ baudRate: 460800 });
        serialWriter = serialPort.writable?.getWriter?.() || null;

        serialReadAbort = new AbortController();
        serialReader = serialPort.readable?.getReader?.({ signal: serialReadAbort.signal }) || null;
        serialConnected = true;
        updateSerialPill();
        hideDisconnectOverlay();

        addLogLine(t("webserialConnected"), "SER");
        showToast(t("webserialConnectedToast"), "success");

        if(serialReader){
          readSerialLoop().catch(err=>{
            addLogLine(t("serialReadEnded", {err:(err?.message||err)}), "SER");
          });
        }
      }catch(e){
        serialConnected = false;
        updateSerialPill();
        addLogLine(t("webserialConnectFailed", {err:(e?.message||e)}), "SER");
        showToast(t("webserialConnectFailedToast"), "error");
      }
    }

    async function serialDisconnect(){
      try{
        if(serialReadAbort){ try{ serialReadAbort.abort(); }catch(e){} serialReadAbort=null; }
        if(serialReader){ try{ await serialReader.cancel(); }catch(e){} try{ serialReader.releaseLock(); }catch(e){} serialReader=null; }
        if(serialWriter){ try{ serialWriter.releaseLock(); }catch(e){} serialWriter=null; }
        if(serialPort){ try{ await serialPort.close(); }catch(e){} serialPort=null; }
      }finally{
        serialConnected = false;
        updateSerialPill();
        addLogLine(t("webserialDisconnected"), "SER");
        if(serialEnabled) showDisconnectOverlay();
      }
    }

    async function serialWriteLine(line){
      if(!serialConnected || !serialWriter) return false;
      try{
        const data = new TextEncoder().encode(line.endsWith("\n") ? line : (line + "\n"));
        await serialWriter.write(data);
        return true;
      }catch(e){
        addLogLine(t("serialWriteFailed", {err:(e?.message||e)}), "SER");
        return false;
      }
    }

    async function readSerialLoop(){
      const decoder = new TextDecoder();
      try{
        while(serialReader){
          const { value, done } = await serialReader.read();
          if(done) break;
          if(!value) continue;

          if(!serialRxEnabled) continue;

          const chunk = decoder.decode(value, { stream:true });
          serialLineBuf += chunk;

          let idx;
          while((idx = serialLineBuf.indexOf("\n")) >= 0){
            const line = serialLineBuf.slice(0, idx).trim();
            serialLineBuf = serialLineBuf.slice(idx+1);
            if(!line) continue;
            if(line[0] === "{" && line[line.length-1] === "}"){
              try{
                const obj = JSON.parse(line);
                onIncomingSample(obj, "SER");
              }catch(e){
                reportSilentException("serial-json", e);
              }
            }
          }
        }
      } finally{
        if(serialConnected){
          serialConnected = false;
          updateSerialPill();
          addLogLine(t("webserialDisconnected"), "SER");
          if(serialEnabled) showDisconnectOverlay();
        }
      }
    }

    // =====================
    // 공통: 샘플 수신 처리
    // =====================
    function onIncomingSample(data, srcTag){
      const src = String(srcTag || "").toUpperCase();
      const isReplaySample = (src === "REPLAY");
      if(replaySourceActive){
        if(!isReplaySample) return;
      }else if(isReplaySample){
        return;
      }
      const nowOk = Date.now();
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

      if(!connOk){
        connOk = true;
        unstableToastShown = false;
        disconnectedLogged = false;
        updateConnectionUI(true);
        addLogLine(t("linkEstablished", {src:srcTag}), "NET");
        showToast(t("linkEstablishedToast", {src:srcTag}), "success", {duration:2600});
      }

      sampleCounter++;

      const nowDate=new Date();
      const timeMs=nowDate.getTime();
      const timeIso=nowDate.toISOString();
      if(firstSampleMs === null) firstSampleMs = timeMs;

      const thrustVal = Number(data.t  != null ? data.t  : (data.thrust   ?? 0));
      const thrustHasData = (data.t != null || data.thrust != null);
      loadcellErrorActive = (simEnabled && devLoadcellError) || !thrustHasData || !isFinite(thrustVal);
      if(lastLoadcellErrorActive === null){
        lastLoadcellErrorActive = loadcellErrorActive;
      }else if(loadcellErrorActive && !lastLoadcellErrorActive){
        showToast(t("loadcellErrorToast"), "error", {key:"loadcell-error", duration:6000});
        lastLoadcellErrorActive = true;
      }else if(!loadcellErrorActive){
        lastLoadcellErrorActive = false;
      }
      const thrustMissing = loadcellErrorActive;
      updateLoadcellLiveValue(thrustVal);
      const p   = Number(data.p  != null ? data.p  : (data.pressure ?? 0));
      const ax  = Number(data.ax != null ? data.ax : (data.accel_x ?? data.ax_g ?? 0));
      const ay  = Number(data.ay != null ? data.ay : (data.accel_y ?? data.ay_g ?? 0));
      const az  = Number(data.az != null ? data.az : (data.accel_z ?? data.az_g ?? 0));
      const gx  = Number(data.gx != null ? data.gx : (data.gyro_x ?? data.gx_dps ?? 0));
      const gy  = Number(data.gy != null ? data.gy : (data.gyro_y ?? data.gy_dps ?? 0));
      const gz  = Number(data.gz != null ? data.gz : (data.gyro_z ?? data.gz_dps ?? 0));
      const lt  = Number(data.lt != null ? data.lt : (data.loop ?? data.loopTime ?? 0));
      const elapsedMs = Math.max(0, timeMs - firstSampleMs);

      const hxHz = Number(data.hz != null ? data.hz : (data.hx_hz ?? 0));
      const ctUs = Number(data.ct != null ? data.ct : (data.cpu_us ?? data.cpu ?? 0));

      const sw  = (data.s  != null ? data.s  : data.sw  ?? 0);
      const ic  = (data.ic != null ? data.ic : data.ign ?? 0);
      const rly = (data.r  != null ? data.r  : data.rly ?? 0);
      const st  = Number(data.st != null ? data.st : (data.state ?? 0));
      const td  = (data.td != null ? Number(data.td) : null);
      const uw  = Number(data.uw ?? 0);
      const ab  = Number(data.ab != null ? data.ab : 0);
      const ar  = (data.ar != null ? Number(data.ar) : null);
      const gs  = Number(data.gs != null ? data.gs : data.igs ?? 0);
      const smRaw = (data.sm != null ? data.sm : (data.safe != null ? data.safe : null));
      const sm = (smRaw != null) ? Number(smRaw) : null;
      const mode = Number(data.m != null ? data.m : data.mode ?? -1);
      const wsQueueDropCount = Number(data.wq != null ? data.wq : (data.ws_queue_drop ?? 0));

      if(!isReplaySample && isFinite(wsQueueDropCount)){
        handleWsBackpressureSignal(wsQueueDropCount);
      }

      publishOverlaySample({ t: thrustVal, p, st, td, ab, ts: Date.now() });

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

      currentSt=st;
      sequenceActive = (td != null && isFinite(td) && td > 0 && st === 0);
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
      if(st===2){
        if(localTplusStartMs===null) localTplusStartMs=Date.now();
        localTplusActive = true;
      }else if(st===1){
        localTplusActive = false;
        localTplusStartMs = null;
      }else if(st===0 && localTplusStartMs!=null){
        localTplusActive = true;
      }
      latestTelemetry = {
        sw: sw?1:0,
        ic: ic?1:0,
        rly: rly?1:0,
        mode,
        gs,
        sm: (sm != null) ? (sm ? 1 : 0) : (safetyModeEnabled ? 1 : 0)
      };
      updateStatusMapFromTelemetry(data);
      const fwBoard = data.fw_board ?? data.fwBoard ?? null;
      const fwProgram = data.fw_program ?? data.fwProgram ?? null;
      const fwProtocol = data.fw_protocol ?? data.fwProtocol ?? null;
      if(fwBoard && el.hwBoardName) el.hwBoardName.textContent = String(fwBoard);
      if(fwProgram && el.hwFirmwareName) el.hwFirmwareName.textContent = String(fwProgram);
      if(fwProtocol && el.hwProtocolName) el.hwProtocolName.textContent = String(fwProtocol);

      if(st===0){
        igniterAbortSent = false;
        if(!ab) lastAbortReason = null;
      }else if(st===1 && (uiSettings && uiSettings.igs) && !ic && !igniterAbortSent){
        igniterAbortSent = true;
        lastAbortReason = "igniter";
        sendCommand({http:"/abort", ser:"ABORT"}, true);
        addLogLine(t("igniterLostAbortLog"), "ABORT");
        showToast(t("igniterLostAbortToast", {safety:safetyLineSuffix()}), "error");
      }

      thrustBaseHistory.push(thrustVal);
      pressureBaseHistory.push(p);
      const accelMagVal = Math.sqrt((ax * ax) + (ay * ay) + (az * az));
      accelMagHistory.push(accelMagVal);
      accelXHistory.push(ax);
      accelYHistory.push(ay);
      accelZHistory.push(az);
      chartTimeHistory.push(timeMs);

      const maxKeep=MAX_POINTS*4;
      if(thrustBaseHistory.length>maxKeep){
        const remove=thrustBaseHistory.length-maxKeep;
        thrustBaseHistory.splice(0,remove);
        pressureBaseHistory.splice(0,remove);
        accelMagHistory.splice(0,remove);
        accelXHistory.splice(0,remove);
        accelYHistory.splice(0,remove);
        accelZHistory.splice(0,remove);
        chartTimeHistory.splice(0,remove);
      }

      sampleHistory.push({timeMs,timeIso,t:thrustVal,p,lt,elapsed:elapsedMs,hz:hxHz,ct:ctUs,sw:sw?1:0,ic:ic?1:0,r:rly?1:0,st,td});
      if(sampleHistory.length>SAMPLE_HISTORY_MAX){
        const remove=sampleHistory.length-SAMPLE_HISTORY_MAX;
        sampleHistory.splice(0,remove);
      }

      logData.push({time:timeIso,t:thrustVal,p,ax,ay,az,gx,gy,gz,lt,elapsed:elapsedMs,hz:hxHz,ct:ctUs,s:sw?1:0,ic:ic?1:0,r:rly?1:0,gs,st,td});
      logDataRevision += 1;
      if(logData.length > RAW_LOG_MAX) logData.splice(0, logData.length - RAW_LOG_MAX);
      updateExportGuardUi();

      // ✅ LOCKOUT 반영(보드가 내보내면)
      if(lko === 1){
        if(!lockoutLatched){
          lockoutLatched = true;
          lockoutRelayMask = rm || 0;
          controlAuthority = false;
          inspectionState = "failed";

          const name = relayMaskName(lockoutRelayMask);
          setLockoutVisual(true);

          addLogLine(t("lockoutDetectedLog", {name}), "SAFE");
          notifyAlarm("RELAY_LOCKOUT", {name}, {force:true});

          showLockoutModal();
        }else{
          if(rm){
            const nextMask = (lockoutRelayMask || 0) | rm;
            if(nextMask !== lockoutRelayMask){
              lockoutRelayMask = nextMask;
              setLockoutVisual(true);
            }
          }
        }
        updateControlAccessUI(currentSt);
      }

      // 점화 분석
      if(st===2 && prevStForIgn!==2){
        ignitionAnalysis={hasData:false,ignStartMs:timeMs,thresholdMs:null,lastAboveMs:null,windowStartMs:null,windowEndMs:null,delaySec:null,durationSec:null,endNotified:false};
        lastBurnSeconds = null;
        addLogLine(t("ignitionSignal", {thr:IGN_THRUST_THRESHOLD.toFixed(2)}),"IGN");
      }

      if(ignitionAnalysis.ignStartMs!=null && thrustVal>=IGN_THRUST_THRESHOLD){
        if(ignitionAnalysis.thresholdMs==null){
          ignitionAnalysis.thresholdMs=timeMs;
          ignitionAnalysis.delaySec=(ignitionAnalysis.thresholdMs-ignitionAnalysis.ignStartMs)/1000.0;
          addLogLine(t("ignitionThresholdLog", {thr:IGN_THRUST_THRESHOLD.toFixed(2), delay:ignitionAnalysis.delaySec.toFixed(3)}),"IGN");
          showToast(t("ignitionThresholdToast", {thr:IGN_THRUST_THRESHOLD.toFixed(2), delay:ignitionAnalysis.delaySec.toFixed(3), safety:safetyLineSuffix()}),"ignite");
        }
        ignitionAnalysis.lastAboveMs=timeMs;
        ignitionAnalysis.durationSec=Math.max(0,(ignitionAnalysis.lastAboveMs-ignitionAnalysis.thresholdMs)/1000.0);
        ignitionAnalysis.hasData=true;
      }

      if(prevStForIgn===2 && st!==2 && ignitionAnalysis.ignStartMs!=null && !ignitionAnalysis.endNotified){
        ignitionAnalysis.endNotified=true;
        if(ignitionAnalysis.durationSec!=null){
          addLogLine(t("ignitionEndLog", {dur:ignitionAnalysis.durationSec.toFixed(3)}),"IGN");
          showToast(t("ignitionEndToast"),"info");
        }else{
          addLogLine(t("ignitionNoThrustLog"),"IGN");
          showToast(t("ignitionNoThrustToast", {safety:safetyLineSuffix()}),"warn");
        }
      }
      prevStForIgn=st;
      updateMotorInfoPanel();

      // UI 업데이트(스킵)
      if(sampleCounter % UI_SAMPLE_SKIP === 0){
        updateConnectionUI(true);
        disconnectedLogged=false;

        if(prevSwState===null) prevSwState=!!sw;
        else if(prevSwState!==!!sw){
          prevSwState=!!sw;
          if(prevSwState){
            if(currentSt === 0){
              localTplusStartMs = Date.now();
              localTplusActive = true;
            }
            addLogLine(t("switchHighLog"), "SW");
            if((uiSettings && uiSettings.igs) && !ic){
              showToast(t("countdownIgniterRequired", {safety:safetyLineSuffix()}), "notice");
            }else{
              showToast(t("switchHighToast", {safety:safetyLineSuffix()}),"warn");
            }
          }else{
            addLogLine(t("switchLowLog"), "SW");
            showToast(t("switchLowToast", {safety:safetyLineSuffix()}),"info");
          }
        }

        if(prevIcState===null) prevIcState=!!ic;
        else if(prevIcState!==!!ic){
          prevIcState=!!ic;
          if(prevIcState){
            addLogLine(t("igniterOkLog"), "IGN");
            showToast(t("igniterOkToast", {safety:safetyLineSuffix()}),"success");
          }else{
            addLogLine(t("igniterNoLog"), "IGN");
            showToast(t("igniterNoToast", {safety:safetyLineSuffix()}),"warn");
            if(uiSettings && uiSettings.igs){
              controlAuthority = false;
              inspectionState = "failed";
              updateInspectionPill();
              updateControlAccessUI(currentSt);
              showToast(t("inspectionRequiredToast"), "notice");
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

      if(el.thrust){
          const metric = el.thrust.closest(".status-metric");
          if(thrustMissing){
            el.thrust.innerHTML = "로드셀 시스템을<br>점검하세요";
            if(metric) metric.classList.add("is-alert");
            if(metric) metric.classList.toggle("loadcell-blink", loadcellErrorActive);
          }else{
            if(metric) metric.classList.remove("is-alert");
            if(metric) metric.classList.remove("loadcell-blink");
            el.thrust.innerHTML = `<span class="num">${thrustDisp.toFixed(3)}</span><span class="unit">${thrustUnit}</span>`;
          }
        }
        if(el.pressure) el.pressure.innerHTML = `<span class="num">${p.toFixed(3)}</span><span class="unit">V</span>`;
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
        if(gyroGl){
          const nowUi = Date.now();
          if(gyroLastUiMs === 0 || (nowUi - gyroLastUiMs) >= 120){
            const axV = isFinite(ax) ? ax : 0;
            const ayV = isFinite(ay) ? ay : 0;
            const azV = isFinite(az) ? az : 0;
            const rollDeg = Math.atan2(ayV, azV) * RAD_TO_DEG;
            const pitchDeg = Math.atan2(-axV, Math.sqrt((ayV * ayV) + (azV * azV))) * RAD_TO_DEG;
            const dtSec = (gyroLastUiMs > 0) ? ((nowUi - gyroLastUiMs) / 1000) : 0;
            if(isFinite(gz) && dtSec > 0){
              gyroYawDeg += gz * dtSec;
              gyroYawDeg = ((gyroYawDeg + 180) % 360) - 180;
            }
            const alpha = 0.22;
            gyroRollDeg += alpha * (rollDeg - gyroRollDeg);
            gyroPitchDeg += alpha * (pitchDeg - gyroPitchDeg);
            renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
            renderNavBall(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
            renderGyroPreview();
            renderNavBallPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
            updateLauncherPitchAngle(gyroPitchDeg, gy, nowUi);
            if(el.gyroRollDeg) el.gyroRollDeg.innerHTML = `<span class="num">${gyroRollDeg.toFixed(1)}</span><span class="unit">deg</span>`;
            if(el.gyroPitchDeg) el.gyroPitchDeg.innerHTML = `<span class="num">${gyroPitchDeg.toFixed(1)}</span><span class="unit">deg</span>`;
            if(el.gyroYawDeg) el.gyroYawDeg.innerHTML = `<span class="num">${gyroYawDeg.toFixed(1)}</span><span class="unit">deg</span>`;
            gyroLastUiMs = nowUi;
          }
        }
        if(el.thrustGauge){
          const maxThrust = (String(thrustUnit).toLowerCase() === "lbf") ? THRUST_GAUGE_MAX_LBF : THRUST_GAUGE_MAX_KGF;
          const thrustVal = thrustMissing ? 0 : Math.max(0, thrustDisp);
          const thrustPct = Math.min(100, (maxThrust > 0 && isFinite(thrustVal) ? (thrustVal / maxThrust) * 100 : 0));
          el.thrustGauge.style.setProperty("--gauge-pct", thrustPct.toFixed(1) + "%");
        }
        if(el.pressureGauge){
          const pressureVal = Math.max(0, p);
          const pressurePct = Math.min(100, (PRESSURE_GAUGE_MAX_V > 0 ? (pressureVal / PRESSURE_GAUGE_MAX_V) * 100 : 0));
          el.pressureGauge.style.setProperty("--gauge-pct", pressurePct.toFixed(1) + "%");
        }
        if(el.lt){
          el.lt.innerHTML = `
            <span class="lt-line"><span class="num">${lt.toFixed(0)}</span><span class="unit">ms</span></span>
            <span class="unit lt-sep">/</span>
            <span class="lt-line"><span class="num">${elapsedMs.toFixed(0)}</span><span class="unit">ms</span></span>
          `;
        }

        if(el.snapHz){
          const nowUi = Date.now();
          if((nowUi - lastSnapHzUiMs) >= 1000 || lastSnapHzUiMs === 0){
            const snapHz = rxHzWindow;
            el.snapHz.textContent = (snapHz>0 && isFinite(snapHz)) ? (snapHz.toFixed(0) + " Hz") : "-- Hz";
            lastSnapHzUiMs = nowUi;
          }
        }
        if(el.hxHz) el.hxHz.textContent = (hxHz>0 && isFinite(hxHz)) ? (hxHz.toFixed(0) + " Hz") : "-- Hz";
        if(el.quickHxHz){
          const hxNum = (hxHz>0 && isFinite(hxHz)) ? hxHz.toFixed(0) : "--";
          el.quickHxHz.innerHTML = `<span class="num">${hxNum}</span><span class="unit">Hz</span>`;
        }
        if(el.cpuUs) el.cpuUs.textContent = (ctUs>0 && isFinite(ctUs)) ? (ctUs.toFixed(0) + " us") : "-- us";

        if(el.ignDelayDisplay) el.ignDelayDisplay.textContent = (ignitionAnalysis.delaySec!=null)
          ? (t("labelDelay") + " " + ignitionAnalysis.delaySec.toFixed(3) + "s")
          : (t("labelDelay") + " --.-s");
        if(el.burnDurationDisplay) el.burnDurationDisplay.textContent = (ignitionAnalysis.durationSec!=null)
          ? (t("labelBurn") + " " + ignitionAnalysis.durationSec.toFixed(3) + "s")
          : (t("labelBurn") + " --.-s");

        if(el.modePill){
          let label="-";
          if(mode===0) label = t("modeSerial");
          else if(mode===1) label = t("modeWifi");
          else if(mode===2) label = t("modeAuto");
          el.modePill.textContent=label;
        }

        updateRelaySafePill();

        if(el.sw){
          if(sw){ el.sw.textContent = t("swHigh"); el.sw.className="pill pill-green"; }
          else { el.sw.textContent = t("swLow"); el.sw.className="pill pill-gray"; }
        }
        if(el.quickSw){
          const swLabel = (sw == null) ? "--" : (sw ? t("swHigh") : t("swLow"));
          el.quickSw.innerHTML = `<span class="num">${swLabel}</span>`;
          setQuickItemStatus(el.quickSw, (sw == null) ? null : (sw ? "ok" : "warn"));
        }

        if(el.ic){
          if(ic){ el.ic.textContent = t("icOk"); el.ic.className="pill pill-green"; }
          else { el.ic.textContent = t("icNo"); el.ic.className="pill pill-red"; }
        }
        if(el.quickIgniter){
          const icLabel = (ic == null) ? "--" : (ic ? t("icOk") : t("icNo"));
          el.quickIgniter.innerHTML = `<span class="num">${icLabel}</span>`;
          setQuickItemStatus(el.quickIgniter, (ic == null) ? null : (ic ? "ok" : "bad"));
        }

        if(el.relay){
          if(rly){ el.relay.textContent = t("relayOn"); el.relay.className="pill pill-green"; }
          else { el.relay.textContent = t("relayOff"); el.relay.className="pill pill-gray"; }
        }
        if(el.quickRelay1 || el.quickRelay2){
          const rlyMask = (rly == null) ? null : Number(rly);
          const r1On = (rlyMask == null) ? null : ((rlyMask & 1) !== 0);
          const r2On = (rlyMask == null) ? null : ((rlyMask & 2) !== 0);
          const lockMask = lockoutLatched ? (lockoutRelayMask || 0) : 0;
          const lockAll = lockoutLatched && lockMask === 0;
          const r1Lock = lockoutLatched && (lockAll || ((lockMask & 1) !== 0));
          const r2Lock = lockoutLatched && (lockAll || ((lockMask & 2) !== 0));

          if(el.quickRelay1){
            let r1Label = (r1On == null) ? "--" : (r1On ? t("relayOn") : t("relayOff"));
            let r1Status = (r1On == null) ? null : (r1On ? "ok" : "warn");
            if(r1Lock){
              r1Label = "ERROR";
              r1Status = "bad";
            }
            el.quickRelay1.innerHTML = `<span class="num">${r1Label}</span>`;
            setQuickItemStatus(el.quickRelay1, r1Status);
          }
          if(el.quickRelay2){
            let r2Label = (r2On == null) ? "--" : (r2On ? t("relayOn") : t("relayOff"));
            let r2Status = (r2On == null) ? null : (r2On ? "ok" : "warn");
            if(r2Lock){
              r2Label = "ERROR";
              r2Status = "bad";
            }
            el.quickRelay2.innerHTML = `<span class="num">${r2Label}</span>`;
            setQuickItemStatus(el.quickRelay2, r2Status);
          }
        }
        updateGyroMetaFromMain();
        if(el.quickState){
          let stateLabel="--";
          let stateStatus=null;
          let isNotArmed=false;
          if(lockoutLatched) stateLabel = t("statusLockout");
          else if(ab) stateLabel = t("statusAbort");
          else if(st===2) stateLabel = t("statusIgnition");
          else if(st===1) stateLabel = t("statusCountdown");
          else if(sequenceActive) stateLabel = t("statusSequence");
          else if(st===0){
            if(loadcellErrorActive){
              stateLabel = t("statusLoadcellCheck");
            }else{
              isNotArmed = (ic===0);
              stateLabel = isNotArmed ? t("statusNotArmed") : t("statusReady");
            }
          }
          if(lockoutLatched || ab || st===2) stateStatus = "bad";
          else if(st===1 || sequenceActive || (st===0 && (ic===0 || loadcellErrorActive))) stateStatus = "warn";
          else if(st===0) stateStatus = "ok";
          const loadcellLabel = t("statusLoadcellCheck");
          const stateHtml = (stateLabel === loadcellLabel) ? loadcellLabel.replace(" ", "<br>") : stateLabel;
          el.quickState.innerHTML = `<span class="num">${stateHtml}</span>`;
          el.quickState.classList.toggle("is-not-armed", isNotArmed);
          const quickStateItem = el.quickState.closest(".item-quick-state");
          if(quickStateItem){
            quickStateItem.classList.toggle("state-lockout", lockoutLatched);
          }
          setQuickItemStatus(el.quickState, stateStatus);
        }

        if(el.igswitch) el.igswitch.checked=!!gs;
        if(el.safeModeToggle && sm != null){
          el.safeModeToggle.checked = !!sm;
          updateTogglePill(el.safeModePill, el.safeModeToggle.checked);
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
          if(useTd && td < 0 && localTplusActive && localTplusStartMs != null){
            useTd = false;
          }

          if(useTd){
            if(td < 0){
              const msRemain = Math.max(0, Math.round(-td));
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
            }else{
              prefix = "T+ ";
              const elapsedMs = Math.max(0, Math.round(td));
              tplusActive = true;
              cdText = formatCountdown(elapsedMs);
              lastCountdownSec = null;
            }
          }else if(localTplusActive && localTplusStartMs!=null){
            prefix = "T+ ";
            const elapsedMs = Math.max(0, Date.now() - localTplusStartMs);
            tplusActive = true;
            cdText = formatCountdown(elapsedMs);
            lastCountdownSec = null;
          }else{
            lastCountdownSec = null;
          }
          const cdLabel = prefix + cdText;
          el.countdown.textContent = cdLabel;
          if(el.countdownMobile) el.countdownMobile.textContent = cdLabel;
          if(el.countdownBig) el.countdownBig.textContent = cdLabel;
        }
        updateAbortButtonLabel(tplusActive && st !== 2);
        const statusCode=setStatusFromState(st,!!ic,!!ab,lockoutLatched, sequenceActive);
        syncCountdownInlineStatus();
        if(el.countdownStatus && el.statusText){
          el.countdownStatus.textContent = el.statusText.textContent || "";
        }
        setButtonsFromState(st, lockoutLatched, sequenceActive);
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

        if(autoScrollChart){
          const len=thrustBaseHistory.length;
          const lastTime = (len > 0) ? chartTimeHistory[len - 1] : 0;
          let windowMs = chartView.windowMs || CHART_WINDOW_MS_DEFAULT;
          if(windowMs < CHART_WINDOW_MS_MIN) windowMs = CHART_WINDOW_MS_MIN;
          if(windowMs > CHART_WINDOW_MS_MAX) windowMs = CHART_WINDOW_MS_MAX;
          chartView.windowMs = windowMs;
          chartView.startMs = lastTime - windowMs;
        }

        const nowPerf=(typeof performance!=="undefined" && performance.now) ? performance.now() : Date.now();
        if(nowPerf-lastChartRedraw>=CHART_MIN_INTERVAL){
          redrawCharts();
          lastChartRedraw=nowPerf;
        }
      }

      evaluateRuntimeAlarms(nowOk);
    }

    // =====================
    // Wi-Fi 폴링 루프
    // =====================
    async function updateData(){
      if(replaySourceActive) return;
      if(simEnabled){
        onIncomingSample(buildSimSample(), "SIM");
        return;
      }
      if(isUpdating) return;
      if(wsConnected && (Date.now() - wsLastMsgMs) < WS_FRESH_MS) return;
      isUpdating=true;
      try{
        let data;
        try{
          data=await fetchJsonWithFallback();
        }catch(err){
          failStreak++;
          markDisconnectedIfNeeded(t("noResponse"));
          return;
        }
        onIncomingSample(data, "WIFI");
      }finally{
        isUpdating=false;
      }
    }

    async function fetchWifiInfo(){
      if(simEnabled) return;
      try{
        const info = await fetchJsonTimeout("/wifi_info", 700);
        wifiInfo = info;
        wifiInfoLastMs = Date.now();
        updateWifiInfoUI(info);
      }catch(e){
        if(!wifiInfo || (Date.now() - wifiInfoLastMs) > 5000){
          updateWifiInfoUI(null);
        }
      }
    }

    let pollTimer=null;
    async function pollLoop(){
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
      const extraBackoff = (sinceOk > DISCONNECT_GRACE_MS) ? 120 : 0;

      const delay = Math.max(0, (POLL_INTERVAL + extraBackoff) - dt);
      pollTimer = setTimeout(pollLoop, delay);
    }

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
    let easterOverlayEl=null;
    let easterEggOkEl=null;
    let easterEggPending=false;
    let tetrisWinOverlayEl=null;
    let tetrisWinOkEl=null;
    let tetrisWinShown=false;
    let tetrisPrizeOverlayEl=null;
    let tetrisPrizeCopyEl=null;
    let tetrisPrizeCloseEl=null;
    let tetrisPrizeCodeEl=null;

    function resetLongPressVisual(){
      if(longPressSpinnerEl) longPressSpinnerEl.style.setProperty("--lp-angle","0deg");
      if(confirmTitleEl) confirmTitleEl.textContent = t("confirmTitleReady");
    }
    function hideConfirm(){
      if(lpTimer){ clearInterval(lpTimer); lpTimer=null; }
      resetLongPressVisual();
      userWaitingLocal=false;
      setOverlayVisible(confirmOverlayEl, false);
      sendCommand({http:"/precount?uw=0&cd=0", ser:"PRECOUNT 0 0"}, false);
    }
    function showConfirm(){
      hideMobileControlsPanel();
      if(!hasMissionSelected()){
        showMissionRequired();
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
      if((uiSettings && uiSettings.igs) && latestTelemetry.ic !== 1){
        showToast(t("countdownIgniterRequired", {safety:safetyLineSuffix()}), "notice");
        return;
      }
      if(lpTimer){ clearInterval(lpTimer); lpTimer=null; }
      resetLongPressVisual();
      userWaitingLocal=true;
      lpLastSentSec=3;
      setOverlayVisible(confirmOverlayEl, true);
      sendCommand({http:"/precount?uw=1&cd=3000", ser:"PRECOUNT 1 3000"}, false);
      showToast(t("preSequenceToast", {safety:safetyLineSuffix()}),"warn");
    }

    function showEasterEggWarning(){
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
      setOverlayVisible(easterOverlayEl, false);
      if(easterEggPending){
        easterEggPending = false;
        startTetris();
      }
    }

    function showTetrisWin(){
      hideMobileControlsPanel();
      if(tetrisWinShown) return;
      tetrisWinShown = true;
      setOverlayVisible(tetrisWinOverlayEl, true);
    }
    function hideTetrisWin(){
      setOverlayVisible(tetrisWinOverlayEl, false);
    }
    function showTetrisPrize(){
      hideMobileControlsPanel();
      setOverlayVisible(tetrisPrizeOverlayEl, true);
    }
    function hideTetrisPrize(){
      setOverlayVisible(tetrisPrizeOverlayEl, false);
    }
    function copyTetrisPrizeCode(){
      const code = tetrisPrizeCodeEl ? tetrisPrizeCodeEl.textContent.trim() : "";
      if(!code) return;
      if(navigator.clipboard && window.isSecureContext){
        navigator.clipboard.writeText(code).then(()=>{
          showToast(t("tetrisPrizeCopiedToast"), "success");
        }).catch(()=>{
          showToast(t("tetrisPrizeCopyFailToast"), "error");
        });
        return;
      }
      try{
        const ta=document.createElement("textarea");
        ta.value=code; ta.style.position="fixed"; ta.style.top="-9999px";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(t("tetrisPrizeCopiedToast"), "success");
      }catch(e){
        showToast(t("tetrisPrizeCopyFailToast"), "error");
      }
    }

    function startHold(){
      if(lockoutLatched) return;
      if(!isControlUnlocked()){
        showToast(t("inspectionRequiredShort"), "notice");
        return;
      }
      if((uiSettings && uiSettings.igs) && latestTelemetry.ic !== 1){
        showToast(t("countdownIgniterRequired", {safety:safetyLineSuffix()}), "notice");
        return;
      }
      if(!el.longPressBtn || !longPressSpinnerEl || lpTimer) return;
      userWaitingLocal=true;
      lpStart=Date.now();
      lpLastSentSec=3;

      lpTimer=setInterval(()=>{
        const now=Date.now();
        const remain=LP_DURATION-(now-lpStart);
        const left=remain<0?0:remain;

        let ratio=(LP_DURATION-left)/LP_DURATION; if(ratio>1) ratio=1;
        const angle=Math.floor(360*ratio);
        longPressSpinnerEl.style.setProperty("--lp-angle",angle+"deg");

        let sec=Math.ceil(left/1000); if(sec<0) sec=0;
        if(confirmTitleEl){
          confirmTitleEl.textContent = sec>0
            ? t("confirmTitleEntering", {sec})
            : t("confirmTitleCountdown");
        }
        if(sec!==lpLastSentSec){
          lpLastSentSec=sec;
          sendCommand({http:"/precount?uw=1&cd="+left, ser:"PRECOUNT 1 "+left}, false);
        }

        if(left===0){
          clearInterval(lpTimer); lpTimer=null;
          resetLongPressVisual(); userWaitingLocal=false;
          if((uiSettings && uiSettings.igs) && latestTelemetry.ic !== 1){
            setOverlayVisible(confirmOverlayEl, false);
            sendCommand({http:"/precount?uw=0&cd=0", ser:"PRECOUNT 0 0"}, false);
            showToast(t("countdownIgniterRequired", {safety:safetyLineSuffix()}), "notice");
            return;
          }
          setOverlayVisible(confirmOverlayEl, false);
          sendCommand({http:"/precount?uw=0&cd=0", ser:"PRECOUNT 0 0"}, false);
          sendCommand({http:"/countdown_start", ser:"COUNTDOWN"}, true);
          addLogLine(t("countdownRequestedLog"),"CMD");
          suppressCountdownToastUntil = Date.now() + 3000;
          showToast(t("countdownRequestedToast", {safety:safetyLineSuffix()}),"ignite");
        }
      },40);
    }

    function endHold(){
      if(!lpTimer) return;
      clearInterval(lpTimer); lpTimer=null;
      resetLongPressVisual();
      if(userWaitingLocal){
        const cdMs=(uiSettings?uiSettings.countdownSec:10)*1000;
        lpLastSentSec=Math.ceil(cdMs/1000);
        sendCommand({http:"/precount?uw=1&cd="+cdMs, ser:"PRECOUNT 1 "+cdMs}, false);
      }
    }

    // =====================
    // 설정/발사대
    // =====================
    function showSettings(){
      hideMobileControlsPanel();
      setOverlayVisible(el.settingsOverlay, true);
    }
    function hideSettings(){
      setOverlayVisible(el.settingsOverlay, false);
    }
    function setMissionCloseLabel(isBack){
      if(!el.missionCloseBtn) return;
      el.missionCloseBtn.textContent = isBack ? "뒤로" : "닫기";
    }
    function resetMissionToPresetList(){
      if(el.missionFields) el.missionFields.classList.add("hidden");
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
      setMissionCloseLabel(false);
    }
    function hasMissionSelected(){
      return !!(
        (selectedMotorName && selectedMotorName.trim()) ||
        (el.missionName && el.missionName.value && el.missionName.value.trim())
      );
    }
    function updateExportButtonState(){
      if(!el.exportCsvBtn) return;
      const ok = hasMissionSelected();
      el.exportCsvBtn.disabled = !ok;
      el.exportCsvBtn.classList.toggle("disabled", !ok);
      updateExportGuardUi();
    }
    function isReportExportedUpToDate(){
      return !!reportExportedOnce;
    }
    function shouldWarnBeforeClose(){
      if(!hasMissionSelected()) return false;
      if(logData.length <= 0) return false;
      return !isReportExportedUpToDate();
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
    function requestLeaveWithExportGuard(onLeave){
      if(!shouldWarnBeforeClose()){
        if(typeof onLeave === "function") onLeave();
        return;
      }
      pendingExportLeaveAction = (typeof onLeave === "function") ? onLeave : null;
      if(el.exportLeaveOverlay){
        setOverlayVisible(el.exportLeaveOverlay, true);
      }else if(pendingExportLeaveAction){
        const fallback = pendingExportLeaveAction;
        pendingExportLeaveAction = null;
        fallback();
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
    function setQuickItemStatus(targetEl, status){
      if(!targetEl) return;
      const item = targetEl.closest(".item, .status-battery");
      if(!item) return;
      item.classList.remove("status-ok","status-warn","status-bad");
      if(status) item.classList.add("status-" + status);
    }
    function setMotorTimeState(valueEl, state){
      if(!valueEl) return;
      const item = valueEl.closest(".item");
      if(!item) return;
      item.classList.remove("status-time-ready","status-time-progress");
      if(state) item.classList.add("status-time-" + state);
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
      const delay = (ignitionAnalysis && ignitionAnalysis.delaySec != null)
        ? ignitionAnalysis.delaySec.toFixed(1)
        : "--.-";
      const burn = (ignitionAnalysis && ignitionAnalysis.durationSec != null)
        ? ignitionAnalysis.durationSec.toFixed(1)
        : "--.-";
      const commText = connOk ? "CONNECTED" : "DISCONNECTED";
      const batteryBlocked = !!(latestTelemetry && (latestTelemetry.ic === 1 || latestTelemetry.sw === 1));
      const pctText = batteryBlocked
        ? "N"
        : ((lastBatteryPct != null && isFinite(lastBatteryPct)) ? (Math.round(lastBatteryPct) + "%") : "--%");
      const pctValue = (!batteryBlocked && lastBatteryPct != null && isFinite(lastBatteryPct))
        ? Math.max(0, Math.min(100, Math.round(lastBatteryPct)))
        : null;

      el.batteryStatus.textContent = pctText;
      el.commStatus.innerHTML = '<span class="num">' + commText + "</span>";
      el.motorDelay.innerHTML = '<span class="num">' + delay + '</span><span class="unit">S</span>';
      el.motorBurn.innerHTML = '<span class="num">' + burn + '</span><span class="unit">S</span>';
      const delayState = (ignitionAnalysis && ignitionAnalysis.delaySec != null) ? "ready" : null;
      setMotorTimeState(el.motorDelay, delayState);
      let burnState = null;
      if(ignitionAnalysis && ignitionAnalysis.durationSec != null){
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
        el.statusBar.classList.toggle("is-online", !!connOk);
        el.statusBar.classList.toggle("is-offline", !connOk);
      }
      if(el.connStatusText){
        const snapHz = Number(rxHzWindow);
        const hzText = (snapHz > 0 && isFinite(snapHz)) ? (snapHz.toFixed(0) + " Hz") : "-- Hz";
        el.connStatusText.textContent = commText + " · " + hzText;
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
      setQuickItemStatus(el.batteryStatus, batteryState);
      setQuickItemStatus(el.commStatus, connOk ? "ok" : "bad");
      updateStatusMotor();
      updateGyroMetaFromMain();
    }
    function showMissionRequired(){
      hideMobileControlsPanel();
      setOverlayVisible(el.missionRequiredOverlay, true);
    }
    function hideMissionRequired(){
      setOverlayVisible(el.missionRequiredOverlay, false);
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
      hideMobileControlsPanel();
      setOverlayVisible(el.missionOverlay, true);
      resetMissionToPresetList();
    }
    function hideMission(){
      resetMissionToPresetList();
      setOverlayVisible(el.missionOverlay, false);
    }
    function updateLoadcellLiveValue(val){
      lastThrustKgf = val;
      if(!el.loadcellLiveValue) return;
      if(val == null || !isFinite(val)){
        el.loadcellLiveValue.textContent = "--";
        return;
      }
      el.loadcellLiveValue.textContent = Number(val).toFixed(3);
    }
    function showLoadcellModal(){
      hideMobileControlsPanel();
      setOverlayVisible(el.loadcellOverlay, true);
      if(el.loadcellDialog) el.loadcellDialog.classList.remove("show-warning");
      if(el.loadcellDialog) el.loadcellDialog.classList.remove("step-input");
      if(el.loadcellWeightInput) el.loadcellWeightInput.value = "";
      if(el.loadcellWarningTitle) el.loadcellWarningTitle.textContent = t("loadcellModalConfirmTitle");
      if(el.loadcellWarningText) el.loadcellWarningText.textContent = t("loadcellModalConfirmText", {weight:"--"});
      pendingLoadcellWeight = null;
      pendingLoadcellZero = false;
      updateLoadcellLiveValue(lastThrustKgf);
    }
    function hideLoadcellModal(){
      setOverlayVisible(el.loadcellOverlay, false);
      if(el.loadcellDialog) el.loadcellDialog.classList.remove("show-warning");
      if(el.loadcellDialog) el.loadcellDialog.classList.remove("step-input");
    }
    function showLoadcellWarning(weight){
      hideMobileControlsPanel();
      pendingLoadcellZero = false;
      if(el.loadcellDialog) el.loadcellDialog.classList.add("show-warning");
      if(el.loadcellWarningTitle) el.loadcellWarningTitle.textContent = t("loadcellModalConfirmTitle");
      if(el.loadcellWarningText){
        el.loadcellWarningText.textContent = t("loadcellModalConfirmText", {weight:weight.toFixed(3)});
      }
    }
    function showLoadcellZeroWarning(){
      hideMobileControlsPanel();
      pendingLoadcellZero = true;
      if(el.loadcellDialog) el.loadcellDialog.classList.add("show-warning");
      if(el.loadcellWarningTitle) el.loadcellWarningTitle.textContent = t("loadcellZeroConfirmTitle");
      if(el.loadcellWarningText) el.loadcellWarningText.textContent = t("loadcellZeroConfirmText");
    }
    function hideLoadcellWarning(){
      if(el.loadcellDialog) el.loadcellDialog.classList.remove("show-warning");
      pendingLoadcellZero = false;
    }
    async function saveLoadcellCalibration(weight){
      if(simEnabled){
        addLogLine(t("loadcellSaveLog", {weight:weight.toFixed(3)}), "CFG");
        showToast(t("loadcellSaveSuccessToast"), "success");
        hideLoadcellWarning();
        hideLoadcellModal();
        return;
      }
      const API_BASE = (location.protocol === "http:" || location.protocol === "https:")
          ? ""
          : "http://192.168.4.1";
      const url = (API_BASE ? API_BASE : "") + "/loadcell_cal?weight=" + encodeURIComponent(weight);
      const opt = API_BASE ? { mode:"no-cors", cache:"no-cache" } : { cache:"no-cache" };
      try{
        const res = await fetch(url, opt);
        if(!API_BASE && !res.ok) throw new Error("HTTP " + res.status);
        addLogLine(t("loadcellSaveLog", {weight:weight.toFixed(3)}), "CFG");
        showToast(t("loadcellSaveSuccessToast"), "success");
        hideLoadcellWarning();
        hideLoadcellModal();
      }catch(e){
        showToast(t("loadcellSaveFailToast"), "error");
      }
    }
    async function saveLoadcellZero(){
      if(simEnabled){
        addLogLine(t("loadcellZeroSaveLog"), "CFG");
        showToast(t("loadcellZeroSaveSuccessToast"), "success");
        hideLoadcellModal();
        return;
      }
      const API_BASE = (location.protocol === "http:" || location.protocol === "https:")
          ? ""
          : "http://192.168.4.1";
      const url = (API_BASE ? API_BASE : "") + "/loadcell_zero";
      const opt = API_BASE ? { mode:"no-cors", cache:"no-cache" } : { cache:"no-cache" };
      try{
        const res = await fetch(url, opt);
        if(!API_BASE && !res.ok) throw new Error("HTTP " + res.status);
        addLogLine(t("loadcellZeroSaveLog"), "CFG");
        showToast(t("loadcellZeroSaveSuccessToast"), "success");
        hideLoadcellModal();
      }catch(e){
        showToast(t("loadcellZeroSaveFailToast"), "error");
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
      if(!hasMissionSelected()){
        showMissionRequired();
        return;
      }
      if(lockoutLatched){
        showToast(t("lockoutForceDenied"), "error");
        return;
      }
      if(currentSt!==0){
        showToast(t("forceNotAllowed"), "notice");
        return;
      }
      if((uiSettings && uiSettings.igs) && latestTelemetry.ic !== 1){
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
    function showLauncher(){
      hideMobileControlsPanel();
      if(lockoutLatched){
        showToast(t("lockoutControlDenied"), "error");
        return;
      }
      if(!canOperateLauncher()){
        if(safetyModeEnabled) showToast(t("safetyModeOnToast"), "notice");
        return;
      }
      setOverlayVisible(launcherOverlayEl, true);
    }
    function hideLauncher(){
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

    // =====================
    // XLSX 유틸 (멀티 시트)
    // =====================
    function downloadBlobAsFile(blob, filename){
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    function escapeXmlText(text){
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }
    function toColumnName(index){
      let n = index + 1;
      let name = "";
      while(n > 0){
        const rem = (n - 1) % 26;
        name = String.fromCharCode(65 + rem) + name;
        n = Math.floor((n - 1) / 26);
      }
      return name;
    }
    function buildSheetXml(rows, drawingRelId, hiddenFromRow){
      let out = '<?xml version="1.0" encoding="UTF-8"?>';
      out += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
      if(drawingRelId){
        out += ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
      }
      out += ">";
      out += '<cols><col min="1" max="1" width="38" customWidth="1"/></cols>';
      out += "<sheetData>";
      for(let r = 0; r < rows.length; r++){
        const rowEntry = rows[r];
        const row = (rowEntry && !Array.isArray(rowEntry) && rowEntry.cells) ? rowEntry.cells : rowEntry;
        const rowStyle = (rowEntry && !Array.isArray(rowEntry) && rowEntry.style != null) ? rowEntry.style : null;
        const rowNum = r + 1;
        let rowXml = "";
        const styleId = (rowStyle != null) ? (' s="' + rowStyle + '"') : ((r === 0) ? ' s="1"' : "");
        for(let c = 0; c < row.length; c++){
          const value = row[c];
          if(value === null || value === undefined || value === "") continue;
          const cellRef = toColumnName(c) + rowNum;
          if(typeof value === "number" && isFinite(value)){
            rowXml += '<c r="' + cellRef + '" t="n"' + styleId + '><v>' + value + "</v></c>";
          }else{
            const text = String(value);
            const needsPreserve = /^\s|\s$/.test(text);
            rowXml += '<c r="' + cellRef + '" t="inlineStr"' + styleId + '><is><t' + (needsPreserve ? ' xml:space="preserve"' : "") + ">";
            rowXml += escapeXmlText(text);
            rowXml += "</t></is></c>";
          }
        }
        const hiddenAttr = (hiddenFromRow && rowNum >= hiddenFromRow) ? ' hidden="1"' : "";
        out += '<row r="' + rowNum + '"' + hiddenAttr + '>' + rowXml + "</row>";
      }
      out += "</sheetData>";
      if(drawingRelId){
        out += '<drawing r:id="' + drawingRelId + '"/>';
      }
      out += "</worksheet>";
      return out;
    }
    function buildWorkbookXml(sheets){
      let out = '<?xml version="1.0" encoding="UTF-8"?>';
      out += '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ';
      out += 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
      out += "<sheets>";
      for(let i = 0; i < sheets.length; i++){
        const name = escapeXmlText(sheets[i].name || "");
        const hiddenAttr = sheets[i].hidden ? ' state="hidden"' : "";
        out += '<sheet name="' + name + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"' + hiddenAttr + '/>';
      }
      out += "</sheets></workbook>";
      return out;
    }
    function buildWorkbookRelsXml(sheetCount){
      let out = '<?xml version="1.0" encoding="UTF-8"?>';
      out += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
      for(let i = 0; i < sheetCount; i++){
        out += '<Relationship Id="rId' + (i + 1) + '" ';
        out += 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ';
        out += 'Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      }
      out += '<Relationship Id="rId' + (sheetCount + 1) + '" ';
      out += 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ';
      out += 'Target="styles.xml"/>';
      out += "</Relationships>";
      return out;
    }
    function buildContentTypesXml(sheetCount, chartCount){
      let out = '<?xml version="1.0" encoding="UTF-8"?>';
      out += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
      out += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
      out += '<Default Extension="xml" ContentType="application/xml"/>';
      out += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
      for(let i = 0; i < sheetCount; i++){
        out += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ';
        out += 'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }
      if(chartCount > 0){
        out += '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
        for(let i = 1; i <= chartCount; i++){
          out += '<Override PartName="/xl/charts/chart' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>';
        }
      }
      out += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
      out += "</Types>";
      return out;
    }
    function buildStylesXml(){
      return '<?xml version="1.0" encoding="UTF-8"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="4">' +
          '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
          '<font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/><family val="2"/></font>' +
          '<font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
          '<font><sz val="12"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>' +
        '</fonts>' +
        '<fills count="3">' +
          '<fill><patternFill patternType="none"/></fill>' +
          '<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill>' +
          '<fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill>' +
        '</fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="4">' +
          '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
          '<xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
          '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
          '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
        '</cellXfs>' +
        "</styleSheet>";
    }
    function buildSheetRelsXml(){
      return '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
        "</Relationships>";
    }
    function buildDrawingXml(){
      const EMU_PER_INCH = 914400;
      const CHART_W_EMU = Math.round(6 * EMU_PER_INCH);
      const CHART_H_EMU = Math.round(4.5 * EMU_PER_INCH);
      const startCol = 12;
      const secondCol = startCol;
      const thirdCol = startCol;
      const startRow = 2;
      const secondRow = 24;
      const thirdRow = 46;
      return '<?xml version="1.0" encoding="UTF-8"?>' +
        '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
        '<xdr:oneCellAnchor>' +
        '<xdr:from><xdr:col>' + startCol + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + startRow + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
        '<xdr:ext cx="' + CHART_W_EMU + '" cy="' + CHART_H_EMU + '"/>' +
        '<xdr:graphicFrame macro="">' +
        '<xdr:nvGraphicFramePr>' +
        '<xdr:cNvPr id="2" name="Thrust Chart"/>' +
        '<xdr:cNvGraphicFramePr/>' +
        '</xdr:nvGraphicFramePr>' +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="' + CHART_W_EMU + '" cy="' + CHART_H_EMU + '"/></xdr:xfrm>' +
        '<a:graphic>' +
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
        '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>' +
        '</a:graphicData>' +
        '</a:graphic>' +
        '</xdr:graphicFrame>' +
        '<xdr:clientData/>' +
        '</xdr:oneCellAnchor>' +
        '<xdr:oneCellAnchor>' +
        '<xdr:from><xdr:col>' + secondCol + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + secondRow + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
        '<xdr:ext cx="' + CHART_W_EMU + '" cy="' + CHART_H_EMU + '"/>' +
        '<xdr:graphicFrame macro="">' +
        '<xdr:nvGraphicFramePr>' +
        '<xdr:cNvPr id="3" name="Thrust (N) Chart"/>' +
        '<xdr:cNvGraphicFramePr/>' +
        '</xdr:nvGraphicFramePr>' +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="' + CHART_W_EMU + '" cy="' + CHART_H_EMU + '"/></xdr:xfrm>' +
        '<a:graphic>' +
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
        '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId3"/>' +
        '</a:graphicData>' +
        '</a:graphic>' +
        '</xdr:graphicFrame>' +
        '<xdr:clientData/>' +
        '</xdr:oneCellAnchor>' +
        '<xdr:oneCellAnchor>' +
        '<xdr:from><xdr:col>' + thirdCol + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + thirdRow + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
        '<xdr:ext cx="' + CHART_W_EMU + '" cy="' + CHART_H_EMU + '"/>' +
        '<xdr:graphicFrame macro="">' +
        '<xdr:nvGraphicFramePr>' +
        '<xdr:cNvPr id="4" name="Pressure Chart"/>' +
        '<xdr:cNvGraphicFramePr/>' +
        '</xdr:nvGraphicFramePr>' +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="' + CHART_W_EMU + '" cy="' + CHART_H_EMU + '"/></xdr:xfrm>' +
        '<a:graphic>' +
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
        '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId2"/>' +
        '</a:graphicData>' +
        '</a:graphic>' +
        '</xdr:graphicFrame>' +
        '<xdr:clientData/>' +
        '</xdr:oneCellAnchor>' +
        '</xdr:wsDr>';
    }
    function buildDrawingRelsXml(){
      return '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart3.xml"/>' +
        "</Relationships>";
    }
    function buildChartXml(sheetName, startRow, endRow, chartTitle, seriesCol, seriesNameCell, axisYTitle, lineColor, majorUnit, xMajorUnit, xNumFmt, axisXTitle, xMin, xMax, yMin, yMax, xTickSkip, xLabelCol){
      const xCol = xLabelCol || "A";
      const xRange = sheetName + "!$" + xCol + "$" + startRow + ":$" + xCol + "$" + endRow;
      const seriesRange = sheetName + "!$" + seriesCol + "$" + startRow + ":$" + seriesCol + "$" + endRow;
      const titleText = escapeXmlText(chartTitle || "");
      const yTitleText = escapeXmlText(axisYTitle || "");
      const xTitleText = escapeXmlText(axisXTitle || "time");
      const lineHex = escapeXmlText(lineColor || "3B82F6");
      const unitVal = (majorUnit && isFinite(majorUnit) && majorUnit > 0) ? Number(majorUnit.toFixed(6)) : null;
      const xUnitVal = (xMajorUnit && isFinite(xMajorUnit) && xMajorUnit > 0) ? Number(xMajorUnit.toFixed(6)) : null;
      const xMinVal = (xMin != null && isFinite(xMin)) ? Number(xMin.toFixed(6)) : null;
      const xMaxVal = (xMax != null && isFinite(xMax)) ? Number(xMax.toFixed(6)) : null;
      const yMinVal = (yMin != null && isFinite(yMin)) ? Number(yMin.toFixed(6)) : null;
      const yMaxVal = (yMax != null && isFinite(yMax)) ? Number(yMax.toFixed(6)) : null;
      const xFmt = escapeXmlText(xNumFmt || "0.0");
      const axisBase = 120000 + (seriesCol.charCodeAt(0) - 64) * 10;
      const xAxisId = axisBase + 1;
      const yAxisId = axisBase + 2;
      const axisTitleXml = (text)=>{
        if(!text) return "";
        return '<c:title>' +
          '<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>' +
          '<a:rPr sz="1100"><a:solidFill><a:srgbClr val="404040"/></a:solidFill></a:rPr>' +
          '<a:t>' + text + '</a:t>' +
          '</a:r></a:p></c:rich></c:tx>' +
          '<c:overlay val="0"/>' +
          '</c:title>';
      };
      const chartTitleXml = (text)=>{
        if(!text) return "";
        return '<c:title>' +
          '<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>' +
          '<a:rPr sz="1400"><a:solidFill><a:srgbClr val="202020"/></a:solidFill></a:rPr>' +
          '<a:t>' + text + '</a:t>' +
          '</a:r></a:p></c:rich></c:tx>' +
          '<c:overlay val="0"/>' +
          '</c:title>';
      };
      const plotAreaLayout =
        '<c:layout><c:manualLayout>' +
        '<c:layoutTarget val="outer"/>' +
        '<c:xMode val="edge"/><c:yMode val="edge"/>' +
        '<c:x val="0.06"/><c:y val="0.20"/><c:w val="0.88"/><c:h val="0.70"/>' +
        '</c:manualLayout></c:layout>';
      return '<?xml version="1.0" encoding="UTF-8"?>' +
        '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
        '<c:chart>' +
        chartTitleXml(titleText) +
        '<c:autoTitleDeleted val="0"/>' +
        '<c:plotArea>' +
        plotAreaLayout +
        '<c:areaChart>' +
        '<c:grouping val="standard"/>' +
        '<c:dLbls><c:delete val="1"/></c:dLbls>' +
        '<c:ser>' +
        '<c:idx val="0"/><c:order val="0"/>' +
        '<c:tx><c:strRef><c:f>' + seriesNameCell + '</c:f></c:strRef></c:tx>' +
        '<c:cat><c:numRef><c:f>' + xRange + '</c:f></c:numRef></c:cat>' +
        '<c:val><c:numRef><c:f>' + seriesRange + '</c:f></c:numRef></c:val>' +
        '<c:spPr>' +
        '<a:gradFill rotWithShape="1">' +
        '<a:gsLst>' +
        '<a:gs pos="0"><a:srgbClr val="' + lineHex + '"><a:alpha val="32000"/></a:srgbClr></a:gs>' +
        '<a:gs pos="100000"><a:srgbClr val="' + lineHex + '"><a:alpha val="0"/></a:srgbClr></a:gs>' +
        '</a:gsLst>' +
        '<a:lin ang="5400000" scaled="1"/>' +
        '</a:gradFill>' +
        '<a:ln><a:noFill/></a:ln>' +
        '</c:spPr>' +
        '</c:ser>' +
        '<c:axId val="' + xAxisId + '"/><c:axId val="' + yAxisId + '"/>' +
        '</c:areaChart>' +
        '<c:lineChart>' +
        '<c:grouping val="standard"/>' +
        '<c:dLbls><c:delete val="1"/></c:dLbls>' +
        '<c:ser>' +
        '<c:idx val="1"/><c:order val="1"/>' +
        '<c:tx><c:strRef><c:f>' + seriesNameCell + '</c:f></c:strRef></c:tx>' +
        '<c:cat><c:numRef><c:f>' + xRange + '</c:f></c:numRef></c:cat>' +
        '<c:val><c:numRef><c:f>' + seriesRange + '</c:f></c:numRef></c:val>' +
        '<c:marker><c:symbol val="none"/></c:marker>' +
        '<c:spPr><a:ln w="19000"><a:solidFill><a:srgbClr val="' + lineHex + '"/></a:solidFill></a:ln></c:spPr>' +
        '</c:ser>' +
        '<c:axId val="' + xAxisId + '"/><c:axId val="' + yAxisId + '"/>' +
        '</c:lineChart>' +
        '<c:catAx>' +
        '<c:axId val="' + xAxisId + '"/>' +
        '<c:delete val="0"/>' +
        '<c:scaling><c:orientation val="minMax"/></c:scaling>' +
        '<c:axPos val="b"/>' +
        '<c:majorGridlines><c:spPr><a:ln w="12700"><a:solidFill><a:srgbClr val="D0D0D0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>' +
        '<c:numFmt formatCode="' + xFmt + '" sourceLinked="0"/>' +
        (xTickSkip && xTickSkip > 1 ? ('<c:tickLblSkip val="' + xTickSkip + '"/><c:tickMarkSkip val="' + xTickSkip + '"/>') : '') +
        '<c:majorTickMark val="out"/>' +
        '<c:minorTickMark val="none"/>' +
        '<c:tickLblPos val="nextTo"/>' +
        axisTitleXml(xTitleText) +
        '<c:crossAx val="' + yAxisId + '"/>' +
        '<c:crosses val="autoZero"/>' +
        '</c:catAx>' +
        '<c:valAx>' +
        '<c:axId val="' + yAxisId + '"/>' +
        '<c:delete val="0"/>' +
        '<c:scaling><c:orientation val="minMax"/>' +
        (yMinVal != null ? ('<c:min val="' + yMinVal + '"/>') : '') +
        (yMaxVal != null ? ('<c:max val="' + yMaxVal + '"/>') : '') +
        '</c:scaling>' +
        '<c:axPos val="l"/>' +
        '<c:majorGridlines><c:spPr><a:ln w="12700"><a:solidFill><a:srgbClr val="D0D0D0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>' +
        '<c:numFmt formatCode="General" sourceLinked="1"/>' +
        (unitVal ? ('<c:majorUnit val="' + unitVal + '"/>') : '') +
        '<c:majorTickMark val="out"/>' +
        '<c:minorTickMark val="none"/>' +
        '<c:tickLblPos val="nextTo"/>' +
        axisTitleXml(yTitleText) +
        '<c:crossAx val="' + xAxisId + '"/>' +
        '<c:crosses val="autoZero"/>' +
        '</c:valAx>' +
        '</c:plotArea>' +
        '<c:plotVisOnly val="1"/>' +
        '<c:dispBlanksAs val="gap"/>' +
        '</c:chart>' +
        '</c:chartSpace>';
    }
    const CRC32_TABLE = (()=>{
      const table = new Uint32Array(256);
      for(let i = 0; i < 256; i++){
        let c = i;
        for(let k = 0; k < 8; k++){
          c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
      }
      return table;
    })();
    function crc32(buf){
      let crc = 0 ^ -1;
      for(let i = 0; i < buf.length; i++){
        crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
      }
      return (crc ^ -1) >>> 0;
    }
    function buildZip(files){
      const encoder = new TextEncoder();
      const fileEntries = [];
      let localSize = 0;

      for(const file of files){
        const nameBytes = encoder.encode(file.name);
        let dataBytes = null;
        if(file.dataBytes){
          dataBytes = file.dataBytes;
        }else if(file.data instanceof Uint8Array){
          dataBytes = file.data;
        }else if(file.data && file.data.buffer instanceof ArrayBuffer){
          dataBytes = new Uint8Array(file.data);
        }else{
          dataBytes = encoder.encode(file.data);
        }
        const crc = crc32(dataBytes);
        const localHeader = new Uint8Array(30 + nameBytes.length);
        const view = new DataView(localHeader.buffer);
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, 0, true);
        view.setUint32(14, crc, true);
        view.setUint32(18, dataBytes.length, true);
        view.setUint32(22, dataBytes.length, true);
        view.setUint16(26, nameBytes.length, true);
        view.setUint16(28, 0, true);
        localHeader.set(nameBytes, 30);

        fileEntries.push({
          nameBytes,
          dataBytes,
          crc,
          localHeader,
          offset: localSize
        });

        localSize += localHeader.length + dataBytes.length;
      }

      let centralSize = 0;
      const centralParts = [];
      for(const entry of fileEntries){
        const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
        const view = new DataView(centralHeader.buffer);
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 20, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, 0, true);
        view.setUint16(14, 0, true);
        view.setUint32(16, entry.crc, true);
        view.setUint32(20, entry.dataBytes.length, true);
        view.setUint32(24, entry.dataBytes.length, true);
        view.setUint16(28, entry.nameBytes.length, true);
        view.setUint16(30, 0, true);
        view.setUint16(32, 0, true);
        view.setUint16(34, 0, true);
        view.setUint16(36, 0, true);
        view.setUint32(38, 0, true);
        view.setUint32(42, entry.offset, true);
        centralHeader.set(entry.nameBytes, 46);
        centralParts.push(centralHeader);
        centralSize += centralHeader.length;
      }

      const end = new Uint8Array(22);
      const endView = new DataView(end.buffer);
      endView.setUint32(0, 0x06054b50, true);
      endView.setUint16(4, 0, true);
      endView.setUint16(6, 0, true);
      endView.setUint16(8, fileEntries.length, true);
      endView.setUint16(10, fileEntries.length, true);
      endView.setUint32(12, centralSize, true);
      endView.setUint32(16, localSize, true);
      endView.setUint16(20, 0, true);

      const totalSize = localSize + centralSize + end.length;
      const out = new Uint8Array(totalSize);
      let offset = 0;
      for(const entry of fileEntries){
        out.set(entry.localHeader, offset);
        offset += entry.localHeader.length;
        out.set(entry.dataBytes, offset);
        offset += entry.dataBytes.length;
      }
      for(const central of centralParts){
        out.set(central, offset);
        offset += central.length;
      }
      out.set(end, offset);
      return out;
    }
    function buildXlsxBytes(sheets, chart){
      const chartCount = chart ? 3 : 0;
      const files = [];
      files.push({name:"[Content_Types].xml", data:buildContentTypesXml(sheets.length, chartCount)});
      files.push({name:"_rels/.rels", data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
      files.push({name:"xl/workbook.xml", data:buildWorkbookXml(sheets)});
      files.push({name:"xl/_rels/workbook.xml.rels", data:buildWorkbookRelsXml(sheets.length)});
      files.push({name:"xl/styles.xml", data:buildStylesXml()});
      for(let i = 0; i < sheets.length; i++){
        const drawingRelId = (chartCount > 0 && i === 0) ? "rId1" : null;
        const hiddenStart = (chartCount > 0 && i === 0 && chart && chart.hideDataFromRow) ? chart.hideDataFromRow : null;
        files.push({name:"xl/worksheets/sheet" + (i + 1) + ".xml", data:buildSheetXml(sheets[i].rows, drawingRelId, hiddenStart)});
      }
      if(chartCount > 0){
        files.push({name:"xl/worksheets/_rels/sheet1.xml.rels", data:buildSheetRelsXml()});
        files.push({name:"xl/drawings/drawing1.xml", data:buildDrawingXml()});
        files.push({name:"xl/drawings/_rels/drawing1.xml.rels", data:buildDrawingRelsXml()});
        files.push({name:"xl/charts/chart1.xml", data:buildChartXml(chart.sheetName, chart.startRow, chart.endRow, chart.titleThrust, "B", chart.seriesNameThrust, chart.axisTitleThrust, "EF4444", chart.majorUnitThrust, chart.xMajorUnit, chart.xNumFmt, chart.axisTitleX, chart.xMin, chart.xMax, chart.yMinThrust, chart.yMaxThrust, chart.xTickSkip, chart.xLabelCol)});
        files.push({name:"xl/charts/chart2.xml", data:buildChartXml(chart.sheetName, chart.startRow, chart.endRow, chart.titlePressure, "D", chart.seriesNamePressure, chart.axisTitlePressure, "3B82F6", chart.majorUnitPressure, chart.xMajorUnit, chart.xNumFmt, chart.axisTitleX, chart.xMin, chart.xMax, chart.yMinPressure, chart.yMaxPressure, chart.xTickSkip, chart.xLabelCol)});
        files.push({name:"xl/charts/chart3.xml", data:buildChartXml(chart.sheetName, chart.startRow, chart.endRow, chart.titleThrustN, "C", chart.seriesNameThrustN, chart.axisTitleThrustN, "F59E0B", chart.majorUnitThrustN, chart.xMajorUnit, chart.xNumFmt, chart.axisTitleX, chart.xMin, chart.xMax, chart.yMinThrustN, chart.yMaxThrustN, chart.xTickSkip, chart.xLabelCol)});
      }
      return buildZip(files);
    }
    function formatEngNumber(value, digits){
      if(!isFinite(value)) return "0";
      const fixed = Number(value).toFixed(digits);
      return fixed.replace(/\.?0+$/,"");
    }
    function buildEngText(rows, meta){
      const rawName = (meta.name || "ALTIS_MOTOR").trim() || "ALTIS_MOTOR";
      const rawVendor = (meta.vendor || "ALTIS").trim() || "ALTIS";
      const name = rawName.replace(/\s+/g, "_");
      const vendor = rawVendor.replace(/\s+/g, "_");
      const header = [
        name,
        formatEngNumber(meta.diameterMm, 0),
        formatEngNumber(meta.lengthMm, 0),
        formatEngNumber(meta.delaySec, 3),
        formatEngNumber(meta.propMassKg, 3),
        formatEngNumber(meta.totalMassKg, 3),
        vendor
      ].join(" ");
      const lines = [header];
      for(const row of rows){
        lines.push(formatEngNumber(row[0], 4) + " " + formatEngNumber(row[1], 3));
      }
      return lines.join("\n") + "\n";
    }

    // =====================
    // 공통 명령 전송: Wi-Fi + (옵션) Serial
    // =====================
    function handleSimCommand(cmd){
      const raw = (cmd.http || cmd.ser || "").toString().trim();
      if(!raw) return;
      let path = raw;
      if(path[0] !== "/"){
        const head = path.split(/\s+/)[0].toUpperCase();
        if(head === "FORCE") path = "/force_ignite";
        else if(head === "COUNTDOWN") path = "/countdown_start";
        else if(head === "ABORT") path = "/abort";
        else if(head === "IGNITE") path = "/ignite";
      }

      if(path.startsWith("/countdown_start")){
        simState.st = 1;
        simState.countdownTotalMs = (uiSettings ? uiSettings.countdownSec : 10) * 1000;
        simState.cdMs = simState.countdownTotalMs;
        simState.countdownStartMs = Date.now();
      }else if(path.startsWith("/force_ignite") || path.startsWith("/ignite")){
        simState.st = 2;
        simState.ignStartMs = Date.now();
        simState.countdownStartMs = null;
        simState.cdMs = 0;
        simState.countdownTotalMs = null;
      }else if(path.startsWith("/sequence_end")){
        simState.st = 0;
        simState.countdownStartMs = null;
        simState.ignStartMs = null;
        simState.cdMs = 0;
        simState.countdownTotalMs = null;
      }else if(path.startsWith("/abort")){
        simState.st = 0;
        simState.countdownStartMs = null;
        simState.ignStartMs = null;
        simState.cdMs = 0;
        simState.countdownTotalMs = null;
      }
    }
    async function sendCommand(cmd, logIt){
      if(simEnabled){
        handleSimCommand(cmd);
        if(logIt){
          addLogLine(t("cmdSentLog", {cmd:(cmd.http || cmd.ser || "?")}), "CMD");
        }
        return;
      }
      if(lockoutLatched){
        const name = relayMaskName(lockoutRelayMask);
        showToast(t("lockoutCmdDenied", {name}), "error");
        return;
      }

      const API_BASE = (location.protocol === "http:" || location.protocol === "https:")
          ? ""
          : "http://192.168.4.1";

      if(cmd.http){
        const url = API_BASE ? (API_BASE + cmd.http) : cmd.http;
        const opt = API_BASE ? { mode:"no-cors", cache:"no-cache" } : { cache:"no-cache" };
        fetch(url, opt).catch(err=>{ reportSilentException("cmd-http", err); });
      }

      let serLine = cmd.ser ? String(cmd.ser).trim() : "";
      if(serLine && serLine[0] !== "/"){
        const parts = serLine.split(/\s+/);
        const head = (parts[0] || "").toUpperCase();

        if(head === "FORCE"){
          serLine = "/force_ignite";
        }else if(head === "COUNTDOWN"){
          serLine = "/countdown_start";
        }else if(head === "ABORT"){
          serLine = "/abort";
        }else if(head === "SEQUENCE_END"){
          serLine = "/sequence_end";
        }else if(head === "IGNITE"){
          serLine = "/ignite";
        }else if(head === "PRECOUNT"){
          const uw = (parts[1] != null) ? Number(parts[1]) : 0;
          const cd = (parts[2] != null) ? Number(parts[2]) : 0;
          serLine = "/precount?uw=" + (uw ? 1 : 0) + "&cd=" + Math.max(0, Math.min(30000, cd|0));
        }else if(head === "RS"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?rs=" + v;
        }else if(head === "IGS"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?igs=" + v;
        }else if(head === "SAFE"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?safe=" + v;
        }else if(head === "IGNMS"){
          const ms = (parts[1] != null) ? (Number(parts[1])|0) : 5000;
          serLine = "/set?ign_ms=" + ms;
        }else if(head === "CDMS"){
          const ms = (parts[1] != null) ? (Number(parts[1])|0) : 10000;
          serLine = "/set?cd_ms=" + ms;
        }else if(head === "LAUNCHER"){
          const dir = (parts[1] || "STOP").toUpperCase();
          const dirValue = (dir === "UP" || dir === "DOWN") ? dir.toLowerCase() : "stop";
          serLine = "/launcher?dir=" + dirValue;
        }
      }

      if(serialEnabled && serialConnected && serialTxEnabled && serLine){
        await serialWriteLine(serLine);
      }

      if(logIt){
        addLogLine(t("cmdSentLog", {cmd:(cmd.http || cmd.ser || "?")}), "CMD");
      }
    }

    function showTerminalHelp(){
      addLogLine("Terminal commands:", "HELP");
      addLogLine("  HTTP paths: /set?... /launcher?dir=up|down|stop /countdown_start /ignite /force_ignite /abort /sequence_end /precount?uw=0|1&cd=ms", "HELP");
      addLogLine("  Shortcuts: FORCE, COUNTDOWN, ABORT, IGNITE, SEQUENCE_END", "HELP");
      addLogLine("  Params: PRECOUNT <uw> <ms>, RS <0|1>, IGS <0|1>, SAFE <0|1>", "HELP");
      addLogLine("  Timing: IGNMS <ms>, CDMS <ms>, LAUNCHER <UP|DOWN|STOP>", "HELP");
    }

    function buildTerminalCommand(rawInput){
      const raw = String(rawInput || "").trim();
      if(!raw) return null;

      let http = null;
      let ser = raw;

      if(raw[0] === "/"){
        http = raw;
        ser = raw;
        return {http, ser};
      }

      const parts = raw.split(/\s+/);
      const head = (parts[0] || "").toUpperCase();

      if(head === "FORCE"){
        http = "/force_ignite";
        ser = "FORCE";
      }else if(head === "COUNTDOWN"){
        http = "/countdown_start";
        ser = "COUNTDOWN";
      }else if(head === "ABORT"){
        http = "/abort";
        ser = "ABORT";
      }else if(head === "SEQUENCE_END"){
        http = "/sequence_end";
        ser = "SEQUENCE_END";
      }else if(head === "IGNITE"){
        http = "/ignite";
        ser = "IGNITE";
      }else if(head === "PRECOUNT"){
        const uw = (parts[1] != null) ? Number(parts[1]) : 0;
        const cd = (parts[2] != null) ? Number(parts[2]) : 0;
        const cdMs = Math.max(0, Math.min(30000, cd|0));
        http = "/precount?uw=" + (uw ? 1 : 0) + "&cd=" + cdMs;
        ser = "PRECOUNT " + (uw ? 1 : 0) + " " + cdMs;
      }else if(head === "RS"){
        const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
        http = "/set?rs=" + v;
        ser = "RS " + v;
      }else if(head === "IGS"){
        const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
        http = "/set?igs=" + v;
        ser = "IGS " + v;
      }else if(head === "SAFE"){
        const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
        http = "/set?safe=" + v;
        ser = "SAFE " + v;
      }else if(head === "IGNMS"){
        const ms = (parts[1] != null) ? (Number(parts[1])|0) : 5000;
        http = "/set?ign_ms=" + ms;
        ser = "IGNMS " + ms;
      }else if(head === "CDMS"){
        const ms = (parts[1] != null) ? (Number(parts[1])|0) : 10000;
        http = "/set?cd_ms=" + ms;
        ser = "CDMS " + ms;
      }else if(head === "LAUNCHER"){
        const dir = (parts[1] || "STOP").toUpperCase();
        const dirValue = (dir === "UP" || dir === "DOWN") ? dir.toLowerCase() : "stop";
        http = "/launcher?dir=" + dirValue;
        ser = "LAUNCHER " + dirValue.toUpperCase();
      }

      return {http, ser};
    }

    // =====================
    // DOM Ready
    // =====================
    document.addEventListener("DOMContentLoaded", async ()=>{
      // ✅ 스플래시 + 프리로드 먼저
      await runSplashAndPreload();

      el.toastContainer = document.getElementById("toastContainer");
      el.logView = document.getElementById("logView");
      el.termInput = document.getElementById("termInput");
      el.termSendBtn = document.getElementById("termSendBtn");
      el.termTitle = document.getElementById("termTitle");
      el.tetrisOverlay = document.getElementById("tetrisOverlay");
      el.tetrisScreen = document.getElementById("tetrisScreen");
      el.tetrisScore = document.getElementById("tetrisScore");
      el.tetrisLines = document.getElementById("tetrisLines");
      el.connDot = document.getElementById("conn-dot");
      el.connText = document.getElementById("conn-text");
      el.wsDot = document.getElementById("ws-dot");
      el.wsText = document.getElementById("ws-text");
      el.statusPill = document.getElementById("statusPill");
      el.statusPillMeta = document.getElementById("statusPillMeta");
      el.statusText = document.getElementById("statusText");
      el.gyroStatusPill = document.getElementById("gyroStatusPill");
      el.gyroStatusText = document.getElementById("gyroStatusText");
      el.gyroConnPill = document.getElementById("gyroConnPill");
      el.gyroConnText = document.getElementById("gyroConnText");
      el.gyroBattery = document.getElementById("gyroBattery");
      el.gyroMode = document.getElementById("gyroMode");
      el.gyroRelay = document.getElementById("gyroRelay");
      el.navBall = document.getElementById("navBall");
      el.statusMotor = document.getElementById("statusMotor");
      el.statusMotorGrain = document.getElementById("statusMotorGrain");
      el.statusMotorTest = document.getElementById("statusMotorTest");
      el.statusMap = document.getElementById("statusMap");
      el.statusMapCoordText = document.getElementById("statusMapCoordText");
      el.statusMapZoomText = document.getElementById("statusMapZoomText");
      el.statusMapRecenterBtn = document.getElementById("statusMapRecenterBtn");
      el.statusMapCopyBtn = document.getElementById("statusMapCopyBtn");
      el.countdown = document.getElementById("countdown");
      el.countdownInlineStatus = document.getElementById("countdownInlineStatus");
      el.countdownInlineStatusText = document.getElementById("countdownInlineStatusText");
      el.countdownInlineStatusPill = document.getElementById("countdownInlineStatusPill");
      el.countdownMobile = document.getElementById("countdownMobile");
      el.countdownBig = document.getElementById("countdownBig");
      el.countdownHeader = document.querySelector(".countdown-header");
      el.countdownLabel = document.getElementById("countdownLabel");
      el.viewLabel = document.getElementById("viewLabel");
      el.countdownStatus = document.getElementById("countdownStatus");
      el.lockoutBg = document.getElementById("lockoutBg");
      el.kstTime = document.getElementById("kst-time");
      el.pageTitle = document.getElementById("pageTitle");
      el.pageKicker = document.getElementById("pageKicker");
      el.homeView = document.getElementById("homeView");
      el.dashboardView = document.getElementById("dashboardView");
      el.terminalView = document.getElementById("terminalView");
      el.hardwareView = document.getElementById("hardwareView");
      el.gyroView = document.getElementById("gyroView");
      el.countdownView = document.getElementById("countdownView");
      el.controlPanelView = document.getElementById("controlPanelView");
      el.homeHeroPill = document.getElementById("homeHeroPill");
      el.homeHeroBoard = document.getElementById("homeHeroBoard");
      el.homeFirmware = document.getElementById("homeFirmware");
      el.homeProtocol = document.getElementById("homeProtocol");
      el.homeConnStatus = document.getElementById("homeConnStatus");
      el.homeWsStatus = document.getElementById("homeWsStatus");
      el.homeMode = document.getElementById("homeMode");
      el.homeStatus = document.getElementById("homeStatus");
      el.homeStatusBadge = document.getElementById("homeStatusBadge");
      el.homeConnBadge = document.getElementById("homeConnBadge");
      el.homeWsBadge = document.getElementById("homeWsBadge");
      el.homeModeBadge = document.getElementById("homeModeBadge");
      el.homeSafetyBadge = document.getElementById("homeSafetyBadge");
      el.homeSerialStatus = document.getElementById("homeSerialStatus");
      el.homeSerialBadge = document.getElementById("homeSerialBadge");
      el.homeRelay = document.getElementById("homeRelay");
      el.homeSwitch = document.getElementById("homeSwitch");
      el.homeIgniter = document.getElementById("homeIgniter");
      el.homeSafety = document.getElementById("homeSafety");
      el.homeMissionName = document.getElementById("homeMissionName");
      el.homeMissionMotor = document.getElementById("homeMissionMotor");
      el.homeMissionDelay = document.getElementById("homeMissionDelay");
      el.homeHealthBattery = document.getElementById("homeHealthBattery");
      el.homeHealthBatteryBadge = document.getElementById("homeHealthBatteryBadge");
      el.homeHealthIgniter = document.getElementById("homeHealthIgniter");
      el.homeHealthIgniterBadge = document.getElementById("homeHealthIgniterBadge");
      el.homeHealthSwitch = document.getElementById("homeHealthSwitch");
      el.homeHealthSwitchBadge = document.getElementById("homeHealthSwitchBadge");
      el.homeHealthRelay = document.getElementById("homeHealthRelay");
      el.homeHealthRelayBadge = document.getElementById("homeHealthRelayBadge");
      el.homeArmBtn = document.getElementById("homeArmBtn");
      el.homeSafeBtn = document.getElementById("homeSafeBtn");
      el.homeIgniterBtn = document.getElementById("homeIgniterBtn");
      el.homeActionHint = document.getElementById("homeActionHint");
      el.homeLog = document.getElementById("homeLog");
      el.quickSw = document.getElementById("quick-sw");
      el.quickIgniter = document.getElementById("quick-igniter");
      el.quickRelay1 = document.getElementById("quick-relay-1");
      el.quickRelay2 = document.getElementById("quick-relay-2");
      el.quickState = document.getElementById("quick-state");

      el.thrust = document.getElementById("thrust");
      el.pressure = document.getElementById("pressure");
      el.accelX = document.getElementById("accelX");
      el.accelY = document.getElementById("accelY");
      el.accelZ = document.getElementById("accelZ");
      el.accelMag = document.getElementById("accelMag");
      el.gyroX = document.getElementById("gyroX");
      el.gyroY = document.getElementById("gyroY");
      el.gyroZ = document.getElementById("gyroZ");
      el.gyroMag = document.getElementById("gyroMag");
      el.gyroRollDeg = document.getElementById("gyroRollDeg");
      el.gyroPitchDeg = document.getElementById("gyroPitchDeg");
      el.gyroYawDeg = document.getElementById("gyroYawDeg");
      el.gyroGl = document.getElementById("gyroGl");
      el.thrustGauge = document.querySelector(".status-gauge.thrust");
      el.pressureGauge = document.querySelector(".status-gauge.pressure");
      el.lt = document.getElementById("lt");
      el.batteryStatus = document.getElementById("batteryStatus");
      el.commStatus = document.getElementById("commStatus");
      el.statusBar = document.getElementById("statusBar");
      el.batteryFill = document.getElementById("batteryFill");
      el.connStatusLabel = document.getElementById("connStatusLabel");
      el.connStatusText = document.getElementById("connStatusText");
      el.motorDelay = document.getElementById("motorDelay");
      el.motorBurn = document.getElementById("motorBurn");

      el.quickHxHz = document.getElementById("quick-hx-hz");
      el.snapHz   = document.getElementById("snap-hz");
      el.hxHz     = document.getElementById("hx-hz");
      el.cpuUs    = document.getElementById("cpu-us");

      el.modePill = document.getElementById("mode-pill");
      el.relaySafePill = document.getElementById("relay-safe-pill");

      el.sw = document.getElementById("sw");
      el.ic = document.getElementById("ic");
      el.relay = document.getElementById("relay");

      el.ignDelayDisplay = document.getElementById("ignDelayDisplay");
      el.burnDurationDisplay = document.getElementById("burnDurationDisplay");

      el.igniteBtn = document.getElementById("igniteBtn");
      el.abortBtn = document.getElementById("abortBtn");
      el.forceBtn = document.getElementById("forceIgniteBtn");
      el.copyLogBtn = document.getElementById("copyLogBtn");
      el.missionOpenBtn = document.getElementById("missionOpenBtn");
      el.exportCsvBtn = document.getElementById("exportCsvBtn");

      el.controlsSettingsBtns = document.querySelectorAll(".js-controls-settings");
      el.sidebarSettingsBtns = document.querySelectorAll(".js-sidebar-settings");
      el.sidebarTerminalBtn = document.getElementById("sidebarTerminalBtn");
      el.settingsOverlay = document.getElementById("settingsOverlay");
      el.settingsClose = el.settingsOverlay ? el.settingsOverlay.querySelector("#settingsClose") : null;
      el.settingsSave = el.settingsOverlay ? el.settingsOverlay.querySelector("#settingsSave") : null;
      el.launcherAutoOverlay = document.getElementById("launcherAutoOverlay");
      el.launcherAutoConfirm = document.getElementById("launcherAutoConfirm");
      el.launcherAutoCancel = document.getElementById("launcherAutoCancel");
      el.missionOverlay = document.getElementById("missionOverlay");
      el.missionDialog = document.getElementById("missionDialog");
      el.missionClose = document.getElementById("missionClose");
      el.missionCloseBtn = document.getElementById("missionCloseBtn");
      el.missionConfirmBtn = document.getElementById("missionConfirmBtn");
      el.missionCustomBtn = document.getElementById("missionCustomBtn");
      el.missionFields = document.getElementById("missionFields");
      el.missionName = document.getElementById("missionName");
      el.missionTestCount = document.getElementById("missionTestCount");
      el.missionMotorDia = document.getElementById("missionMotorDia");
      el.missionMotorLen = document.getElementById("missionMotorLen");
      el.missionIgnDelay = document.getElementById("missionIgnDelay");
      el.missionGrainMass = document.getElementById("missionGrainMass");
      el.missionTotalMass = document.getElementById("missionTotalMass");
      el.missionVendor = document.getElementById("missionVendor");
      el.missionTestInline = document.getElementById("missionTestInline");
      el.missionTestPromptInput = document.getElementById("missionTestPromptInput");
      el.missionReview = document.getElementById("missionReview");
      el.missionReviewMotor = document.getElementById("missionReviewMotor");
      el.missionReviewTestCount = document.getElementById("missionReviewTestCount");
      el.missionReviewDia = document.getElementById("missionReviewDia");
      el.missionReviewLen = document.getElementById("missionReviewLen");
      el.missionReviewIgnDelay = document.getElementById("missionReviewIgnDelay");
      el.missionReviewGrain = document.getElementById("missionReviewGrain");
      el.missionReviewTotal = document.getElementById("missionReviewTotal");
      el.missionReviewVendor = document.getElementById("missionReviewVendor");
      el.missionTestCancel = document.getElementById("missionTestCancel");
      el.missionTestConfirm = document.getElementById("missionTestConfirm");
      el.missionBackBtn = document.getElementById("missionBackBtn");
      el.missionPresetGrid = document.getElementById("missionPresetGrid");
      el.missionPresetViewport = document.getElementById("missionPresetViewport");
      el.missionPresetDivider = document.getElementById("missionPresetDivider");
      el.missionPresetWrap = document.getElementById("missionPresetWrap");
      el.missionPresetBlock = document.getElementById("missionPresetBlock");
      el.missionScrollLeft = document.getElementById("missionScrollLeft");
      el.missionScrollRight = document.getElementById("missionScrollRight");
      el.fwLogoEaster = document.getElementById("fwLogoEaster");
      el.unitThrust = document.getElementById("unitThrust");
      el.ignTimeInput = document.getElementById("ignTimeInput");
      el.countdownSecInput = document.getElementById("countdownSecInput");
      el.ignTimeSave = document.getElementById("ignTimeSave");
      el.countdownSave = document.getElementById("countdownSave");
      el.opModeSelect = document.getElementById("opModeSelect");
      el.gyroGlPreview = document.getElementById("gyroGlPreview");
      el.navBallPreview = document.getElementById("navBallPreview");
      el.gyroPreviewSelect = document.getElementById("gyroPreviewSelect");
      if(el.gyroGlPreview){
        el.gyroGl = el.gyroGlPreview;
        gyroGl = null;
        initGyroGl();
      }
      if(el.navBallPreview) el.navBall = el.navBallPreview;

      buildMotorPresetInfo();
      initGyroGl();

      el.relaySafeToggle = document.getElementById("relaySafeToggle");
      el.igswitch = document.getElementById("igswitch");
      el.safeModeToggle = document.getElementById("safeModeToggle");
      el.serialToggle = document.getElementById("serialToggle");
      el.safeModePill = document.getElementById("safeModePill");
      el.serialTogglePill = document.getElementById("serialTogglePill");
      el.serialControlTile = document.getElementById("serialControlTile");
      el.safetyModeTile = document.getElementById("safetyModeTile");
      el.serialControlTitle = document.getElementById("serialControlTitle");
      el.serialControlSub = document.getElementById("serialControlSub");
      el.controlsCard = document.getElementById("controlsCard");
      el.controlsCardTitle = document.getElementById("controlsCardTitle");
      el.controlsHeader = document.getElementById("controlsHeader");
      el.controlsMain = document.getElementById("controlsMain");
      el.replayOpenBtn = document.getElementById("replayOpenBtn");
      el.replayPanel = document.getElementById("replayPanel");
      el.replayFileInput = document.getElementById("replayFileInput");
      el.replayFileBtn = document.getElementById("replayFileBtn");
      el.replayDropTitle = document.getElementById("replayDropTitle");
      el.replayDropGuide = document.getElementById("replayDropGuide");
      el.replayStartBtn = document.getElementById("replayStartBtn");
      el.replayStopBtn = document.getElementById("replayStopBtn");
      el.replayRestartBtn = document.getElementById("replayRestartBtn");
      el.replayTminus10Btn = document.getElementById("replayTminus10Btn");
      el.replaySeekRange = document.getElementById("replaySeekRange");
      el.replaySeekLabel = document.getElementById("replaySeekLabel");
      el.replayStatusText = document.getElementById("replayStatusText");
      el.replaySpeedBtns = document.querySelectorAll("[data-replay-speed]");
      el.devToolsPanel = document.getElementById("devToolsPanel");
      el.devToolsClose = document.getElementById("devToolsClose");
      el.devRelay1Btn = document.getElementById("devRelay1Btn");
      el.devRelay2Btn = document.getElementById("devRelay2Btn");
      el.devWsOffBtn = document.getElementById("devWsOffBtn");
      el.devLoadcellErrBtn = document.getElementById("devLoadcellErrBtn");
      el.serialRxToggle = document.getElementById("serialRxToggle");
      el.serialTxToggle = document.getElementById("serialTxToggle");
      el.simToggle = document.getElementById("simToggle");
      el.serialStatus = document.getElementById("serialStatus");
      el.serialStatusText = document.getElementById("serialStatusText");
      el.hwBoardName = document.getElementById("hwBoardName");
      el.hwFirmwareName = document.getElementById("hwFirmwareName");
      el.hwProtocolName = document.getElementById("hwProtocolName");
      el.wifiMode = document.getElementById("wifiMode");
      el.wifiSsid = document.getElementById("wifiSsid");
      el.wifiChannel = document.getElementById("wifiChannel");
      el.wifiBandwidth = document.getElementById("wifiBandwidth");
      el.wifiTxPower = document.getElementById("wifiTxPower");
      el.wifiIp = document.getElementById("wifiIp");
      el.wifiStaCount = document.getElementById("wifiStaCount");
      el.wifiRssi = document.getElementById("wifiRssi");
      el.launcherPitchAngle = document.getElementById("launcherPitchAngle");
      el.langSelect = document.getElementById("langSelect");
      el.themeToggle = document.getElementById("themeToggle");
      el.loadcellCalOpen = document.getElementById("loadcellCalOpen");
      el.loadcellOverlay = document.getElementById("loadcellOverlay");
      el.loadcellDialog = document.getElementById("loadcellDialog");
      el.loadcellClose = document.getElementById("loadcellClose");
      el.loadcellCancel = document.getElementById("loadcellCancelBtn");
      el.loadcellZero = document.getElementById("loadcellZeroBtn");
      el.loadcellApply = document.getElementById("loadcellApplyBtn");
      el.loadcellWeightInput = document.getElementById("loadcellWeightInput");
      el.loadcellLiveValue = document.getElementById("loadcellLiveValue");
      el.loadcellWarningText = document.getElementById("loadcellWarningText");
      el.loadcellWarningTitle = document.getElementById("loadcellWarningTitle");
      el.loadcellWarningProceed = document.getElementById("loadcellWarningProceed");
      el.loadcellWarningCancel = document.getElementById("loadcellWarningCancel");
      el.missionRequiredOverlay = document.getElementById("missionRequiredOverlay");
      el.missionRequiredOk = document.getElementById("missionRequiredOk");
      el.exportLeaveOverlay = document.getElementById("exportLeaveOverlay");
      el.exportLeaveConfirm = document.getElementById("exportLeaveConfirm");
      el.exportLeaveCancel = document.getElementById("exportLeaveCancel");
      el.noMotorOverlay = document.getElementById("noMotorOverlay");
      el.noMotorOk = document.getElementById("noMotorOk");
      el.forceConfirmTitle = document.querySelector("#forceOverlay .confirm-title");
      el.forceConfirmText = document.querySelector("#forceOverlay .confirm-text");

      el.launcherOpenBtns = document.querySelectorAll(".js-launcher-open");
      el.inspectionOpenBtn = document.getElementById("inspectionOpenBtn");
      el.inspectionOverlay = document.getElementById("inspectionOverlay");
      el.inspectionClose = document.getElementById("inspectionClose");
      el.inspectionStepLabel = document.getElementById("inspectionStepLabel");
      el.inspectionStepDesc = document.getElementById("inspectionStepDesc");
      el.inspectionStatusSingle = document.getElementById("inspectionStatusSingle");
      el.inspectionResult = document.getElementById("inspectionResult");
      el.inspectionRetry = document.getElementById("inspectionRetry");
      el.inspectionStatusPill = document.getElementById("inspectionStatusPill");

      el.longPressBtn = document.getElementById("longPressBtn");
      el.controlsOverlay = document.getElementById("controlsOverlay");
      el.controlsOverlaySlot = document.getElementById("controlsOverlaySlot");
      el.controlsOverlayClose = document.getElementById("controlsOverlayClose");
      el.controlsToggleBtns = document.querySelectorAll(".js-controls-open");

      el.igniteLabel = document.getElementById("igniteBtnLabel");
      el.sequenceStatusDesktop = document.getElementById("sequenceStatusDesktop");
      el.mobileControlsPanel = document.getElementById("mobileControlsPanel");
      el.mobileControlsHandle = el.mobileControlsPanel ? el.mobileControlsPanel.querySelector(".mobile-controls-handle") : null;
      el.mobileAbortBtn = document.getElementById("mobileAbortBtn");
      el.mobileAbortPanel = document.getElementById("mobileAbortPanel");
      el.mobileSequenceLabel = document.getElementById("mobileSequenceLabel");
      el.mobileControlButtons = el.mobileControlsPanel ? el.mobileControlsPanel.querySelectorAll("[data-mobile-control]") : null;
      el.mobileControlButtonMap = {};
      if(el.mobileControlButtons && el.mobileControlButtons.length){
        el.mobileControlButtons.forEach(btn=>{
          const key = btn.getAttribute("data-mobile-control");
          if(key) el.mobileControlButtonMap[key] = btn;
        });
      }
      el.mobileControlPills = {
        serial: el.mobileControlsPanel ? el.mobileControlsPanel.querySelector("[data-mobile-pill=\"serial\"]") : null,
        inspection: el.mobileControlsPanel ? el.mobileControlsPanel.querySelector("[data-mobile-pill=\"inspection\"]") : null,
        safety: el.mobileControlsPanel ? el.mobileControlsPanel.querySelector("[data-mobile-pill=\"safety\"]") : null,
      };
      el.sequenceStatusLabel = el.mobileControlsPanel ? el.mobileControlsPanel.querySelector("[data-mobile-status=\"sequence\"]") : null;

      // ✅ LOCKOUT modal elements
      el.lockoutOverlay = document.getElementById("lockoutOverlay");
      el.lockoutImg = document.getElementById("lockoutImg");
      el.lockoutTitle = document.getElementById("lockoutTitle");
      el.lockoutText = document.getElementById("lockoutText");
      el.lockoutNote = document.getElementById("lockoutNote");
      el.wsAlertOverlay = document.getElementById("wsAlertOverlay");
      el.wsAlertClose = document.getElementById("wsAlertClose");
      el.disconnectOverlay = document.getElementById("disconnectOverlay");
      el.disconnectTitle = document.getElementById("disconnectTitle");
      el.disconnectText = document.getElementById("disconnectText");
      el.disconnectOk = document.getElementById("disconnectOk");
      el.easterOverlay = document.getElementById("easterOverlay");
      el.easterEggOk = document.getElementById("easterEggOk");
      el.tetrisWinOverlay = document.getElementById("tetrisWinOverlay");
      el.tetrisWinOk = document.getElementById("tetrisWinOk");
      el.tetrisPrizeOverlay = document.getElementById("tetrisPrizeOverlay");
      el.tetrisPrizeCopy = document.getElementById("tetrisPrizeCopy");
      el.tetrisPrizeClose = document.getElementById("tetrisPrizeClose");
      el.tetrisPrizeCode = document.getElementById("tetrisPrizeCode");

      if(el.replayOpenBtn){
        el.replayOpenBtn.addEventListener("click",()=>{
          if(replayUiActive){
            exitReplayMode();
          }else{
            enterReplayMode();
          }
        });
      }
      const loadReplayFile = async (file)=>{
        if(!file) return;
        setReplayStatus("XLSX 파일을 분석 중입니다...");
        if(el.replayFileBtn) el.replayFileBtn.classList.remove("is-dragover");
        try{
          const samples = await parseReplayXlsx(file);
          pauseReplayPlayback({silent:true});
          setActiveDataSource(DATA_SOURCE_LIVE);
          replayState.samples = samples;
          replayState.fileName = file.name;
          replayState.index = 0;
          replayState.lastIndex = -1;
          updateReplayModeUi();
          setReplayStatus("");
          showToast("리플레이 파일 로딩 완료: " + samples.length + " samples", "success", {key:"replay-load"});
        }catch(err){
          const reason = (err && err.message) ? err.message : String(err || "unknown");
          replayState.samples = [];
          replayState.fileName = "";
          replayState.index = 0;
          replayState.lastIndex = -1;
          updateReplayModeUi();
          setReplayStatus("리플레이 파일 파싱 실패: " + reason);
          notifyAlarm("REPLAY_FORMAT", {reason});
        }finally{
          if(el.replayFileInput) el.replayFileInput.value = "";
        }
      };
      if(el.replayFileBtn && el.replayFileInput){
        el.replayFileBtn.addEventListener("click",()=>el.replayFileInput.click());
      }
      if(el.replayFileBtn){
        let dragDepth = 0;
        const clearDragState = ()=>{
          dragDepth = 0;
          el.replayFileBtn.classList.remove("is-dragover");
        };
        el.replayFileBtn.addEventListener("dragenter",(ev)=>{
          ev.preventDefault();
          dragDepth++;
          el.replayFileBtn.classList.add("is-dragover");
        });
        el.replayFileBtn.addEventListener("dragover",(ev)=>{
          ev.preventDefault();
          if(ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
          el.replayFileBtn.classList.add("is-dragover");
        });
        el.replayFileBtn.addEventListener("dragleave",(ev)=>{
          ev.preventDefault();
          dragDepth = Math.max(0, dragDepth - 1);
          if(dragDepth === 0){
            el.replayFileBtn.classList.remove("is-dragover");
          }
        });
        el.replayFileBtn.addEventListener("drop",(ev)=>{
          ev.preventDefault();
          clearDragState();
          const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]
            ? ev.dataTransfer.files[0]
            : null;
          if(file) loadReplayFile(file);
        });
      }
      if(el.replayFileInput){
        el.replayFileInput.addEventListener("change", async ()=>{
          const file = el.replayFileInput.files && el.replayFileInput.files[0];
          if(!file) return;
          await loadReplayFile(file);
        });
      }
      if(el.replayStartBtn){
        el.replayStartBtn.addEventListener("click",()=>startReplayPlayback());
      }
      if(el.replayStopBtn){
        el.replayStopBtn.addEventListener("click",()=>pauseReplayPlayback());
      }
      if(el.replayRestartBtn){
        el.replayRestartBtn.addEventListener("click",()=>restartReplayPlayback());
      }
      if(el.replayTminus10Btn){
        el.replayTminus10Btn.addEventListener("click",()=>seekReplayToTminus10());
      }
      if(el.replaySeekRange){
        el.replaySeekRange.addEventListener("input",()=>{
          updateReplaySeekUi(Number(el.replaySeekRange.value));
        });
        el.replaySeekRange.addEventListener("change",()=>{
          const resume = replayState.playing;
          seekReplayToIndex(Number(el.replaySeekRange.value), resume);
        });
      }
      if(el.replaySpeedBtns && el.replaySpeedBtns.length){
        el.replaySpeedBtns.forEach(btn=>{
          btn.addEventListener("click",()=>{
            const speed = Number(btn.getAttribute("data-replay-speed"));
            if(!isFinite(speed) || speed <= 0) return;
            replayState.speed = speed;
            updateReplaySpeedUi();
            if(replayState.playing){
              clearReplayTimer();
              if(replayState.lastIndex >= 0 && replayState.index < replayState.samples.length){
                const nowTs = replayState.samples[replayState.lastIndex].tsMs;
                const nextTs = replayState.samples[replayState.index].tsMs;
                let deltaMs = Number(nextTs) - Number(nowTs);
                if(!isFinite(deltaMs) || deltaMs < 1) deltaMs = 1;
                scheduleReplayTick(deltaMs / replayState.speed);
              }else{
                scheduleReplayTick(0);
              }
            }
          });
        });
      }
      updateReplayModeUi();
      setReplayStatus("");

      if(el.serialControlTile){
        el.serialControlTile.addEventListener("click",()=>{
          if(!simEnabled) return;
          setDevToolsVisible(true);
          updateDevToolsUI();
        });
        el.serialControlTile.addEventListener("keydown",(ev)=>{
          if(!simEnabled) return;
          if(ev.key === "Enter" || ev.key === " "){
            ev.preventDefault();
            setDevToolsVisible(true);
            updateDevToolsUI();
          }
        });
      }
      if(el.devToolsClose){
        el.devToolsClose.addEventListener("click",()=>setDevToolsVisible(false));
      }
      if(el.termInput){
        el.termInput.addEventListener("keydown",(ev)=>{
          if(ev.key === "Enter"){
            ev.preventDefault();
            if(el.termSendBtn) el.termSendBtn.click();
          }else if(ev.key === "Escape"){
            el.termInput.value = "";
          }
        });
      }
      if(el.termSendBtn){
        el.termSendBtn.addEventListener("click",async ()=>{
          if(!el.termInput) return;
          const rawInput = el.termInput.value;
          const trimmed = String(rawInput || "").trim();
          if(!trimmed) return;
          if(/^(\?|help)$/i.test(trimmed)){
            el.termInput.value = "";
            showTerminalHelp();
            return;
          }
          const cmd = buildTerminalCommand(trimmed);
          if(!cmd) return;
          el.termInput.value = "";
          await sendCommand(cmd, true);
        });
      }
      if(el.devRelay1Btn){
        el.devRelay1Btn.addEventListener("click",()=>{
          devRelay1Locked = !devRelay1Locked;
          updateDevToolsUI();
        });
      }
      if(el.devRelay2Btn){
        el.devRelay2Btn.addEventListener("click",()=>{
          devRelay2Locked = !devRelay2Locked;
          updateDevToolsUI();
        });
      }
      if(el.devWsOffBtn){
        el.devWsOffBtn.addEventListener("click",()=>{
          devWsOff = !devWsOff;
          updateDevToolsUI();
        });
      }
      const bindTap = (node, handler)=>{
        if(!node) return;
        let touchTs = 0;
        node.addEventListener("touchstart",(ev)=>{
          touchTs = Date.now();
          ev.preventDefault();
          handler();
        }, {passive:false});
        node.addEventListener("click",(ev)=>{
          if(Date.now() - touchTs < 600) return;
          handler(ev);
        });
      };
      if(el.devLoadcellErrBtn){
        bindTap(el.devLoadcellErrBtn, ()=>{
          devLoadcellError = !devLoadcellError;
          updateDevToolsUI();
        });
      }

      loadSettings();
      applySettingsToUI();
      initStatusMap();
      if(simEnabled) setSimEnabled(true, {silent:true});
      addLogLine(t("systemReadyLog"),"READY");
      showToast(t("dashboardStartToast", {safety:safetyLineSuffix()}),"info");
      setLockoutVisual(false);
      if(!simEnabled) resetInspectionUI();
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);

      confirmOverlayEl=document.getElementById("confirmOverlay");
      longPressSpinnerEl=document.querySelector("#longPressBtn .longpress-spinner");
      confirmTitleEl=document.querySelector("#confirmOverlay .confirm-title");
      const confirmCancelBtn=document.getElementById("confirmCancel");

      forceOverlayEl=document.getElementById("forceOverlay");
      forceSlideEl=document.getElementById("forceSlide");
      forceSlideThumbEl=document.getElementById("forceSlideThumb");
      launcherOverlayEl=document.getElementById("launcherOverlay");
      easterOverlayEl=el.easterOverlay;
      easterEggOkEl=el.easterEggOk;
      tetrisWinOverlayEl=el.tetrisWinOverlay;
      tetrisWinOkEl=el.tetrisWinOk;
      tetrisPrizeOverlayEl=el.tetrisPrizeOverlay;
      tetrisPrizeCopyEl=el.tetrisPrizeCopy;
      tetrisPrizeCloseEl=el.tetrisPrizeClose;
      tetrisPrizeCodeEl=el.tetrisPrizeCode;

      const launcherCloseBtn=document.getElementById("launcherClose");
      const launcherUpBtn=document.getElementById("launcherUpModalBtn");
      const launcherDownBtn=document.getElementById("launcherDownModalBtn");
      const launcherAutoBtn=document.getElementById("launcherAutoBtn");
      launcherAutoOverlayEl = el.launcherAutoOverlay || document.getElementById("launcherAutoOverlay");
      launcherAutoConfirmBtn = el.launcherAutoConfirm || document.getElementById("launcherAutoConfirm");
      launcherAutoCancelBtn = el.launcherAutoCancel || document.getElementById("launcherAutoCancel");
      const launcherManualBtn=document.getElementById("launcherManualBtn");
      const launcherManualControls=document.getElementById("launcherManualControls");

      if(el.relaySafeToggle){
        el.relaySafeToggle.addEventListener("change",()=>{
          relaySafeEnabled = !!el.relaySafeToggle.checked;
          uiSettings.relaySafe = relaySafeEnabled;
          saveSettings();
          updateRelaySafePill();
          sendCommand({http:"/set?rs="+(relaySafeEnabled?1:0), ser:"RS "+(relaySafeEnabled?1:0)}, true);
          showToast(relaySafeEnabled ? t("relaySafeOnToast") : t("relaySafeOffToast"),
            relaySafeEnabled?"info":"warn",{key:"relay-safe-toggle"});
        });
      }

      if(el.igswitch){
        el.igswitch.addEventListener("change",()=>{
          const val=el.igswitch.checked?1:0;
          uiSettings.igs = val;
          saveSettings();
          sendCommand({http:"/set?igs="+val, ser:"IGS "+val}, true);
          addLogLine(t("igsToggledLog", {state:(val?"ON":"OFF")}),"SAFE");
        });
      }

      if(el.safeModeToggle){
        el.safeModeToggle.addEventListener("change",()=>{
          safetyModeEnabled = !!el.safeModeToggle.checked;
          uiSettings.safetyMode = safetyModeEnabled;
          updateTogglePill(el.safeModePill, el.safeModeToggle.checked);
          saveSettings();
          sendCommand({http:"/set?safe="+(safetyModeEnabled?1:0), ser:"SAFE "+(safetyModeEnabled?1:0)}, true);
          if(safetyModeEnabled && currentSt !== 0){
            if(simEnabled){
              simState.st = 0;
              simState.countdownStartMs = null;
              simState.ignStartMs = null;
              simState.cdMs = 0;
              simState.countdownTotalMs = null;
            }else{
              sendCommand({http:"/abort", ser:"ABORT"}, true);
            }
          }
          setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
          updateControlAccessUI(currentSt);
          showToast(
            safetyModeEnabled ? t("safetyModeOnToast") : t("safetyModeOffToast"),
            safetyModeEnabled ? "info" : "warn",
          {key:"safety-mode-toggle", keep:true, duration:5000}
          );
        });
      }

      if(el.serialToggle){
        el.serialToggle.addEventListener("change",async ()=>{
          serialEnabled = !!el.serialToggle.checked;
          uiSettings.serialEnabled = serialEnabled;
          updateTogglePill(el.serialTogglePill, el.serialToggle.checked);
          saveSettings();
          updateSerialPill();

          if(serialEnabled){
            await serialConnect();
          }else{
            await serialDisconnect();
          }
        });
      }
      if(el.serialRxToggle){
        el.serialRxToggle.addEventListener("change",()=>{
          serialRxEnabled = !!el.serialRxToggle.checked;
          uiSettings.serialRx = serialRxEnabled;
          saveSettings();
          showToast(
            serialRxEnabled ? t("serialRxOnToast") : t("serialRxOffToast"),
            "info",
            {key:"serial-rx-toggle"}
          );
        });
      }
      if(el.serialTxToggle){
        el.serialTxToggle.addEventListener("change",()=>{
          serialTxEnabled = !!el.serialTxToggle.checked;
          uiSettings.serialTx = serialTxEnabled;
          saveSettings();
          showToast(
            serialTxEnabled ? t("serialTxOnToast") : t("serialTxOffToast"),
            "info",
            {key:"serial-tx-toggle"}
          );
        });
      }
      if(el.serialTogglePill && el.serialToggle){
        el.serialTogglePill.addEventListener("click",()=>{
          el.serialToggle.checked = !el.serialToggle.checked;
          el.serialToggle.dispatchEvent(new Event("change", {bubbles:true}));
        });
      }
      if(el.serialControlTile && el.serialToggle){
        el.serialControlTile.addEventListener("click",(ev)=>{
          if(simEnabled) return;
          if(ev.target && ev.target.closest(".pill-toggle")) return;
          el.serialToggle.checked = !el.serialToggle.checked;
          el.serialToggle.dispatchEvent(new Event("change", {bubbles:true}));
        });
        el.serialControlTile.addEventListener("keydown",(ev)=>{
          if(simEnabled) return;
          if(ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          el.serialToggle.checked = !el.serialToggle.checked;
          el.serialToggle.dispatchEvent(new Event("change", {bubbles:true}));
        });
      }
      if(el.safeModePill && el.safeModeToggle){
        el.safeModePill.addEventListener("click",()=>{
          el.safeModeToggle.checked = !el.safeModeToggle.checked;
          el.safeModeToggle.dispatchEvent(new Event("change", {bubbles:true}));
        });
      }
      if(el.safetyModeTile && el.safeModeToggle){
        el.safetyModeTile.addEventListener("click",(ev)=>{
          if(ev.target && ev.target.closest(".pill-toggle")) return;
          el.safeModeToggle.checked = !el.safeModeToggle.checked;
          el.safeModeToggle.dispatchEvent(new Event("change", {bubbles:true}));
        });
        el.safetyModeTile.addEventListener("keydown",(ev)=>{
          if(ev.key !== "Enter" && ev.key !== " ") return;
          if(ev.target && ev.target.closest(".pill-toggle")) return;
          ev.preventDefault();
          el.safeModeToggle.checked = !el.safeModeToggle.checked;
          el.safeModeToggle.dispatchEvent(new Event("change", {bubbles:true}));
        });
      }
      if(el.simToggle){
        el.simToggle.addEventListener("change",()=>{
          setSimEnabled(!!el.simToggle.checked);
        });
      }
      if(el.langSelect){
        el.langSelect.addEventListener("change",()=>{
          uiSettings.lang = (el.langSelect.value === "en") ? "en" : "ko";
          saveSettings();
          setLanguage(uiSettings.lang);
        });
      }
      if(el.themeToggle){
        el.themeToggle.addEventListener("change",()=>{
          uiSettings.theme = el.themeToggle.checked ? "dark" : "light";
          saveSettings();
          applyTheme(uiSettings.theme);
        });
      }

      updateExportButtonState();
      updateMotorInfoPanel();

      if(el.igniteBtn){
        el.igniteBtn.addEventListener("click",()=>{
          if(sequenceActive || currentSt===1 || currentSt===2){
            return;
          }
          if(currentSt===0 && !isControlUnlocked()){
            if(lockoutLatched){
              showToast(t("lockoutNoControl"), "error");
              return;
            }
            if(!hasMissionSelected()){
              showMissionRequired();
              return;
            }
            openInspectionFromUI();
            return;
          }
          if(currentSt===0) showConfirm();
        });
      }

      if(el.abortBtn){
        el.abortBtn.addEventListener("click",()=>{
          if(lockoutLatched){
            const name = relayMaskName(lockoutRelayMask);
          showToast(t("lockoutAbortDenied", {name}), "error");
            return;
          }
          if(tplusUiActive){
            sendCommand({http:"/sequence_end", ser:"SEQUENCE_END"}, true);
            addLogLine(t("sequenceEndLog"),"SEQ");
            showToast(t("sequenceEndToast"), "info");
            localTplusActive = false;
            localTplusStartMs = null;
            if(el.countdown) el.countdown.textContent = "T- --:--:??";
            if(el.countdownMobile) el.countdownMobile.textContent = "T- --:--:??";
            if(el.countdownBig) el.countdownBig.textContent = "T- --:--:??";
            updateAbortButtonLabel(false);
            hideConfirm();
            return;
          }
          lastAbortReason = "user";
          sendCommand({http:"/abort", ser:"ABORT"}, true);
          showToast(t("abortRequestedToast", {safety:safetyLineSuffix()}),"error");
          hideConfirm();
        });
      }

      if(confirmCancelBtn){ confirmCancelBtn.addEventListener("click",()=>hideConfirm()); }
      if(el.missionRequiredOk){
        el.missionRequiredOk.addEventListener("click",()=>hideMissionRequired());
      }
      if(el.missionRequiredOverlay){
        el.missionRequiredOverlay.addEventListener("click",(ev)=>{
          if(ev.target===el.missionRequiredOverlay) hideMissionRequired();
        });
      }
      if(el.exportLeaveCancel){
        el.exportLeaveCancel.addEventListener("click",()=>hideExportLeaveOverlay());
      }
      if(el.exportLeaveConfirm){
        el.exportLeaveConfirm.addEventListener("click",()=>confirmLeaveWithExportGuard());
      }
      if(el.exportLeaveOverlay){
        el.exportLeaveOverlay.addEventListener("click",(ev)=>{
          if(ev.target===el.exportLeaveOverlay) hideExportLeaveOverlay();
        });
      }
      if(el.noMotorOk){
        el.noMotorOk.addEventListener("click",()=>{
          hideNoMotorNotice();
          hideMission();
          updateMotorInfoPanel();
        });
      }
      if(el.noMotorOverlay){
        el.noMotorOverlay.addEventListener("click",(ev)=>{
          if(ev.target===el.noMotorOverlay){
            hideNoMotorNotice();
            hideMission();
          }
        });
      }

      if(el.longPressBtn){
        el.longPressBtn.addEventListener("pointerdown", (e)=>{ e.preventDefault(); el.longPressBtn.setPointerCapture(e.pointerId); startHold(); });
        el.longPressBtn.addEventListener("pointerup",   (e)=>{ e.preventDefault(); endHold(); });
        el.longPressBtn.addEventListener("pointercancel",(e)=>{ e.preventDefault(); endHold(); });
      }

      if(el.inspectionOpenBtn){
        el.inspectionOpenBtn.addEventListener("click", openInspectionFromUI);
        el.inspectionOpenBtn.addEventListener("keydown",(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openInspectionFromUI(); }});
      }
      if(el.inspectionRetry){
        el.inspectionRetry.addEventListener("click",()=>runInspectionSequence());
      }
      if(el.inspectionClose){
        el.inspectionClose.addEventListener("click",()=>hideInspection());
      }
      if(el.inspectionOverlay){
        el.inspectionOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.inspectionOverlay) hideInspection(); });
      }
      if(el.controlsToggleBtns && el.controlsToggleBtns.length){
        el.controlsToggleBtns.forEach(btn=>{
          btn.addEventListener("click",(ev)=>{
            ev.preventDefault();
            if(isMobileLayout() && el.mobileControlsPanel){
              showMobileControlsPanel();
              return;
            }
            showControlsModal();
          });
        });
      }
      if(el.controlsOverlayClose){
        el.controlsOverlayClose.addEventListener("click", hideControlsModal);
      }
      if(el.controlsOverlay){
        el.controlsOverlay.addEventListener("click",(ev)=>{ if(ev.target === el.controlsOverlay) hideControlsModal(); });
      }

      document.addEventListener("pointerdown",(ev)=>{
        if(!mobileControlsActive) return;
        if(el.mobileControlsPanel && el.mobileControlsPanel.contains(ev.target)) return;
        if(ev.target.closest && ev.target.closest(".js-controls-open")) return;
        hideMobileControlsPanel();
      });
      if(el.mobileAbortBtn){
        el.mobileAbortBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          if(el.abortBtn && !el.abortBtn.disabled){
            el.abortBtn.click();
          }
        });
      }

      const forceBtn=el.forceBtn;
      const forceCancel=document.getElementById("forceConfirmCancel");
      if(forceBtn && forceCancel){
        forceBtn.addEventListener("click",()=>showForceConfirm());
        forceCancel.addEventListener("click",()=>hideForceConfirm());
      }
      if(forceSlideEl && forceSlideThumbEl){
        const startSlide=(e)=>{
          if(e.button != null && e.button !== 0) return;
          e.preventDefault();
          forceSlideActive = true;
          updateMobileAbortButton();
          forceSlidePointerId = e.pointerId;
          forceSlideEl.setPointerCapture(e.pointerId);
          const thumbRect = forceSlideThumbEl.getBoundingClientRect();
          forceSlideDragOffset = e.clientX - thumbRect.left;
          const rect = forceSlideEl.getBoundingClientRect();
          const x = e.clientX - rect.left - forceSlideDragOffset;
          forceSlideEl.classList.add("dragging");
          setForceSlidePosition(x);
        };
        const moveSlide=(e)=>{
          if(!forceSlideActive || e.pointerId !== forceSlidePointerId) return;
          e.preventDefault();
          const rect = forceSlideEl.getBoundingClientRect();
          const x = e.clientX - rect.left - forceSlideDragOffset;
          setForceSlidePosition(x);
        };
        const endSlide=(e)=>{
          if(!forceSlideActive || e.pointerId !== forceSlidePointerId) return;
          e.preventDefault();
          const rect = forceSlideEl.getBoundingClientRect();
          const x = e.clientX - rect.left - forceSlideDragOffset;
          const pct = setForceSlidePosition(x);
          forceSlideEl.classList.remove("dragging");
          forceSlideActive = false;
          updateMobileAbortButton();
          forceSlidePointerId = null;
          if(pct >= 90){
            forceSlideEl.classList.add("unlocked");
            commitForceIgnite();
          }else{
            resetForceSlide();
          }
        };
        forceSlideEl.addEventListener("pointerdown", startSlide);
        forceSlideEl.addEventListener("pointermove", moveSlide);
        forceSlideEl.addEventListener("pointerup", endSlide);
        forceSlideEl.addEventListener("pointercancel", endSlide);
      }

      // ✅ LOCKOUT modal events
      const lockoutCloseBtn = document.getElementById("lockoutClose");
      const lockoutAckBtn = document.getElementById("lockoutAck");
      const lockoutCopyBtn = document.getElementById("lockoutCopy");
      if(lockoutCloseBtn) lockoutCloseBtn.addEventListener("click", ()=>hideLockoutModal());
      if(lockoutAckBtn) lockoutAckBtn.addEventListener("click", ()=>hideLockoutModal());
      if(el.lockoutOverlay){
        el.lockoutOverlay.addEventListener("click",(ev)=>{
          if(ev.target===el.lockoutOverlay) hideLockoutModal();
        });
      }
      if(lockoutCopyBtn){
        lockoutCopyBtn.addEventListener("click", ()=>{
          const name = relayMaskName(lockoutRelayMask);
          addLogLine(t("lockoutAckLog", {name}), "SAFE");
          showToast(t("lockoutAckToast", {name}), "error", {duration:7000});
        });
      }

      if(el.wsAlertClose){
        el.wsAlertClose.addEventListener("click", ()=>{
          wsAlertDismissed = true;
          if(devWsOff){
            devWsOff = false;
            updateDevToolsUI();
          }
          hideWsAlert();
        });
      }
      if(el.disconnectOk){
        el.disconnectOk.addEventListener("click", ()=>hideDisconnectOverlay());
      }
      if(easterEggOkEl){
        easterEggOkEl.addEventListener("click", ()=>hideEasterEggWarning());
      }
      if(easterOverlayEl){
        easterOverlayEl.addEventListener("click",(ev)=>{
          if(ev.target===easterOverlayEl) hideEasterEggWarning();
        });
      }
      if(tetrisWinOkEl){
        tetrisWinOkEl.addEventListener("click", ()=>{
          hideTetrisWin();32
          showTetrisPrize();
        });
      }
      if(tetrisWinOverlayEl){
        tetrisWinOverlayEl.addEventListener("click",(ev)=>{
          if(ev.target===tetrisWinOverlayEl) hideTetrisWin();
        });
      }
      if(tetrisPrizeCopyEl){
        tetrisPrizeCopyEl.addEventListener("click", ()=>copyTetrisPrizeCode());
      }
      if(tetrisPrizeCloseEl){
        tetrisPrizeCloseEl.addEventListener("click", ()=>hideTetrisPrize());
      }
      if(tetrisPrizeOverlayEl){
        tetrisPrizeOverlayEl.addEventListener("click",(ev)=>{
          if(ev.target===tetrisPrizeOverlayEl) hideTetrisPrize();
        });
      }

      if(el.fwLogoEaster){
        el.fwLogoEaster.addEventListener("click", ()=>{
          logoTapCount += 1;
          if(logoTapTimer){ clearTimeout(logoTapTimer); logoTapTimer = null; }
          if(logoTapCount >= 5){
            logoTapCount = 0;
            hideSettings();
            showEasterEggWarning();
          }else{
            logoTapTimer = setTimeout(()=>{ logoTapCount = 0; }, 1500);
          }
        });
      }

      if(el.copyLogBtn){
        el.copyLogBtn.addEventListener("click",()=>{
          const text=logLines.join("\n");
          if(navigator.clipboard && window.isSecureContext){
            navigator.clipboard.writeText(text).then(()=>{
              addLogLine(t("logCopiedLog"),"INFO");
              showToast(t("logCopiedToast"),"success");
            }).catch(()=>{
              addLogLine(t("clipboardCopyFailedLog"),"ERROR");
              showToast(t("clipboardCopyFailedToast"),"error");
            });
          }else{
            try{
              const ta=document.createElement("textarea");
              ta.value=text; ta.style.position="fixed"; ta.style.top="-9999px";
              document.body.appendChild(ta);
              ta.focus(); ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
              addLogLine(t("logCopiedLog"),"INFO");
              showToast(t("logCopiedToast"),"success");
            }catch(e){
              addLogLine(t("copyFailedLog", {err:e}),"ERROR");
              showToast(t("copyFailedToast"),"error");
            }
          }
        });
      }

      if(el.exportCsvBtn){
        el.exportCsvBtn.addEventListener("click",()=>{
          const now = new Date();
          const pad = (n)=>String(n).padStart(2,"0");
          const fnameSuffix =
            now.getFullYear().toString()+
            pad(now.getMonth()+1)+pad(now.getDate())+"_"+pad(now.getHours())+pad(now.getMinutes())+pad(now.getSeconds());
          const safeName = (s)=>String(s || "UNKNOWN").trim().replace(/\s+/g,"_").replace(/[^a-zA-Z0-9._-]/g,"");
          const motorLabel = safeName(selectedMotorName || (el.missionName && el.missionName.value) || "NO_MOTOR");
          const testLabel = safeName((el.missionTestCount && el.missionTestCount.value) || "NA");
          const filenameBase = "ALTIS_FLASH_DAQ_" + motorLabel + "_T" + testLabel + "_" + fnameSuffix + "_data";
          const filenameXlsx = filenameBase + ".xlsx";
          const filenameEng = filenameBase + ".eng";
          const filenameZip = filenameBase + ".zip";

          const hasIgnitionWindow =
            ignitionAnalysis.hasData &&
            ignitionAnalysis.ignStartMs!=null &&
            ignitionAnalysis.thresholdMs!=null &&
            ignitionAnalysis.lastAboveMs!=null;

          const windowStartMs = hasIgnitionWindow ? (ignitionAnalysis.thresholdMs - IGN_PRE_WINDOW_MS) : null;
          const windowEndMs   = hasIgnitionWindow ? (ignitionAnalysis.lastAboveMs + IGN_POST_WINDOW_MS) : null;

          const delayVal = (ignitionAnalysis.delaySec!=null) ? ignitionAnalysis.delaySec.toFixed(3) : "";
          const durVal   = (ignitionAnalysis.durationSec!=null) ? ignitionAnalysis.durationSec.toFixed(3) : "";

          const missionMotor = (selectedMotorName || (el.missionName && el.missionName.value) || "").trim();
          const missionDiameterMm = parseFloat(el.missionMotorDia && el.missionMotorDia.value);
          const missionLengthMm = parseFloat(el.missionMotorLen && el.missionMotorLen.value);
          const missionDelaySec = parseFloat(el.missionIgnDelay && el.missionIgnDelay.value);
          const missionGrainMassG = parseFloat(el.missionGrainMass && el.missionGrainMass.value);
          const missionTotalMassG = parseFloat(el.missionTotalMass && el.missionTotalMass.value);
          const missionVendor = (el.missionVendor && el.missionVendor.value) ? el.missionVendor.value.trim() : "";

          let thrustMin = Infinity;
          let thrustMax = -Infinity;
          let thrustSum = 0;
          let thrustCount = 0;
          let thrustNMin = Infinity;
          let thrustNMax = -Infinity;
          let thrustNSum = 0;
          let thrustNCount = 0;
          let pressureMin = Infinity;
          let pressureMax = -Infinity;
          let pressureSum = 0;
          let pressureCount = 0;
          let baseElapsedSec = null;
          let xMaxSec = null;
          let xDeltaSum = 0;
          let xDeltaCount = 0;
          let lastXVal = null;

          const KGF_TO_N = 9.80665;
          const t0ms = (logData && logData.length) ? Date.parse(logData[0].time) : null;
          const engRows = [];
          let engBaseSec = null;
          let engBaseMs = null;

          const summaryRows = [
            [t("hdrTimeIso"), t("hdrMessage"), t("hdrIgnWindow"), t("hdrIgnDelay"), t("hdrBurn"), t("hdrThreshold"), t("hdrAvgThrust"), t("hdrMaxThrust"), t("hdrAvgThrustN"), t("hdrMaxThrustN"), t("hdrAvgPressure"), t("hdrMaxPressure")],
            [
              now.toISOString(),
              hasIgnitionWindow ? t("ignWindowDetected") : t("ignWindowNone"),
              hasIgnitionWindow ? 1 : 0,
              delayVal !== "" ? Number(delayVal) : "",
              durVal !== "" ? Number(durVal) : "",
              Number(IGN_THRUST_THRESHOLD.toFixed(3)),
              "",
              "",
              "",
              "",
              "",
              ""
            ],
            [],
            [t("hdrElapsedMs"), t("hdrThrust"), t("hdrThrustN"), t("hdrPressure"), "time_axis"]
          ];

          const eventRows = [[t("hdrTimeIso"), t("hdrTag"), t("hdrMessage")]];
          for(const e of eventLog){
            eventRows.push([e.time || "", e.tag || "", e.message || ""]);
          }

          const rawRows = [[
            t("hdrTimeIso"), t("hdrThrust"), t("hdrThrustN"), t("hdrPressure"),
            t("hdrAccelX"), t("hdrAccelY"), t("hdrAccelZ"),
            t("hdrGyroX"), t("hdrGyroY"), t("hdrGyroZ"),
            t("hdrLoopMs"), t("hdrElapsedMs"), t("hdrHxHz"), t("hdrCpuUs"), t("hdrSwitch"), t("hdrIgnOk"), t("hdrRelay"),
            t("hdrIgs"), t("hdrState"), t("hdrTdMs"), t("hdrRelTime"), t("hdrIgnWindowFlag")
          ]];

          for(const row of logData){
            const ms = Date.parse(row.time);
            const rel = (t0ms!=null && isFinite(ms)) ? ((ms - t0ms)/1000) : "";
            const inWin = (hasIgnitionWindow && isFinite(ms) && ms>=windowStartMs && ms<=windowEndMs) ? 1 : 0;
            const tVal = Number(row.t);
            const pVal = Number(row.p);
            const tNVal = isFinite(tVal) ? (tVal * KGF_TO_N) : NaN;
            if(inWin){
              if(isFinite(tVal)){
                if(tVal < thrustMin) thrustMin = tVal;
                if(tVal > thrustMax) thrustMax = tVal;
                thrustSum += tVal;
                thrustCount += 1;
              }
              if(isFinite(tNVal)){
                if(tNVal < thrustNMin) thrustNMin = tNVal;
                if(tNVal > thrustNMax) thrustNMax = tNVal;
                thrustNSum += tNVal;
                thrustNCount += 1;
              }
              if(isFinite(pVal)){
                if(pVal < pressureMin) pressureMin = pVal;
                if(pVal > pressureMax) pressureMax = pVal;
                pressureSum += pVal;
                pressureCount += 1;
              }
              const elapsedSec = (row.elapsed != null && isFinite(Number(row.elapsed))) ? (Number(row.elapsed) / 1000) : null;
              let xVal = "";
              if(elapsedSec != null && isFinite(elapsedSec)){
                if(baseElapsedSec == null) baseElapsedSec = elapsedSec;
                xVal = elapsedSec - baseElapsedSec;
                if(isFinite(xVal)){
                  if(lastXVal != null){
                    const d = xVal - lastXVal;
                    if(isFinite(d) && d > 0){
                      xDeltaSum += d;
                      xDeltaCount += 1;
                    }
                  }
                  lastXVal = xVal;
                  if(xMaxSec == null || xVal > xMaxSec) xMaxSec = xVal;
                }else{
                  xVal = "";
                }
              }
              const xNum = (xVal !== "" ? Number(xVal.toFixed(3)) : "");
              const xLabel = (xNum !== "" && isFinite(xNum)) ? Number(xNum.toFixed(1)) : "";
              summaryRows.push([
                xNum,
                isFinite(tVal) ? Number(tVal.toFixed(3)) : "",
                isFinite(tNVal) ? Number(tNVal.toFixed(3)) : "",
                isFinite(pVal) ? Number(pVal.toFixed(3)) : "",
                xLabel
              ]);
            }
            rawRows.push([
              row.time || "",
              isFinite(tVal) ? Number(tVal.toFixed(3)) : "",
              isFinite(tNVal) ? Number(tNVal.toFixed(3)) : "",
              isFinite(pVal) ? Number(pVal.toFixed(3)) : "",
              (row.ax != null && isFinite(Number(row.ax))) ? Number(Number(row.ax).toFixed(3)) : "",
              (row.ay != null && isFinite(Number(row.ay))) ? Number(Number(row.ay).toFixed(3)) : "",
              (row.az != null && isFinite(Number(row.az))) ? Number(Number(row.az).toFixed(3)) : "",
              (row.gx != null && isFinite(Number(row.gx))) ? Number(Number(row.gx).toFixed(3)) : "",
              (row.gy != null && isFinite(Number(row.gy))) ? Number(Number(row.gy).toFixed(3)) : "",
              (row.gz != null && isFinite(Number(row.gz))) ? Number(Number(row.gz).toFixed(3)) : "",
              (row.lt ?? ""),
              (row.elapsed != null && isFinite(Number(row.elapsed)) ? Number(Number(row.elapsed).toFixed(0)) : ""),
              (row.hz ?? ""),
              (row.ct ?? ""),
              (row.s  ?? 0),
              (row.ic ?? 0),
              (row.r  ?? 0),
              (row.gs ?? 0),
              (row.st ?? 0),
              (row.td ?? 0),
              (rel !== "" ? Number(rel.toFixed(3)) : ""),
              inWin
            ]);
          }

          for(const row of logData){
            const ms = Date.parse(row.time);
            if(hasIgnitionWindow && (!isFinite(ms) || ms < windowStartMs || ms > windowEndMs)){
              continue;
            }
            const tVal = Number(row.t);
            if(!isFinite(tVal)) continue;
            let sec = null;
            if(row.elapsed != null && isFinite(Number(row.elapsed))){
              const elapsedSec = Number(row.elapsed) / 1000;
              if(engBaseSec == null) engBaseSec = elapsedSec;
              sec = elapsedSec - engBaseSec;
            }else if(isFinite(ms)){
              if(engBaseMs == null) engBaseMs = ms;
              sec = (ms - engBaseMs) / 1000;
            }
            if(sec == null || !isFinite(sec)) continue;
            engRows.push([sec, tVal * KGF_TO_N]);
          }

          const avgThrustVal = (thrustCount > 0) ? (thrustSum / thrustCount) : null;
          const avgThrustNVal = (thrustNCount > 0) ? (thrustNSum / thrustNCount) : null;
          const avgPressureVal = (pressureCount > 0) ? (pressureSum / pressureCount) : null;
          summaryRows[1][6] = (avgThrustVal != null && isFinite(avgThrustVal)) ? Number(avgThrustVal.toFixed(3)) : "";
          summaryRows[1][7] = (isFinite(thrustMax) && thrustMax !== -Infinity) ? Number(thrustMax.toFixed(3)) : "";
          summaryRows[1][8] = (avgThrustNVal != null && isFinite(avgThrustNVal)) ? Number(avgThrustNVal.toFixed(3)) : "";
          summaryRows[1][9] = (isFinite(thrustNMax) && thrustNMax !== -Infinity) ? Number(thrustNMax.toFixed(3)) : "";
          summaryRows[1][10] = (avgPressureVal != null && isFinite(avgPressureVal)) ? Number(avgPressureVal.toFixed(3)) : "";
          summaryRows[1][11] = (isFinite(pressureMax) && pressureMax !== -Infinity) ? Number(pressureMax.toFixed(3)) : "";

          if(summaryRows.length === 4){
            summaryRows.push(["","","","",""]);
          }

          const calcNiceUnit = (min, max, targetTicks)=>{
            if(!isFinite(min) || !isFinite(max)) return null;
            const range = max - min;
            if(!(range > 0)) return null;
            const rough = range / targetTicks;
            const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
            const n = rough / pow10;
            let step;
            if(n <= 1) step = 1;
            else if(n <= 2) step = 2;
            else if(n <= 5) step = 5;
            else step = 10;
            return step * pow10;
          };
          const axisMinMax = (min, max, step)=>{
            if(!isFinite(min) || !isFinite(max) || !isFinite(step) || !(step > 0)) return {min:null, max:null};
            const low = (min >= 0) ? 0 : Math.floor(min / step) * step;
            const high = Math.ceil(max / step) * step;
            return {min:low, max:high};
          };

          const thrustMajorUnit = calcNiceUnit(thrustMin, thrustMax, 6);
          const thrustNMajorUnit = calcNiceUnit(thrustNMin, thrustNMax, 6);
          const pressureMajorUnit = calcNiceUnit(pressureMin, pressureMax, 6);
          const thrustAxis = axisMinMax(thrustMin, thrustMax, thrustMajorUnit || 1);
          const thrustNAxis = axisMinMax(thrustNMin, thrustNMax, thrustNMajorUnit || 1);
          const pressureAxis = axisMinMax(pressureMin, pressureMax, pressureMajorUnit || 1);
          const xMajorUnit = 0.5;
          const avgDelta = (xDeltaCount > 0) ? (xDeltaSum / xDeltaCount) : null;
          const xTickSkip = (avgDelta && isFinite(avgDelta) && avgDelta > 0)
            ? Math.max(1, Math.round(xMajorUnit / avgDelta))
            : 1;
          const xMax = (xMaxSec != null && isFinite(xMaxSec)) ? Math.max(xMajorUnit, Math.ceil(xMaxSec / xMajorUnit) * xMajorUnit) : null;

          const chartStartRow = 5;
          const chartEndRow = summaryRows.length;
          const chartConfig = (chartEndRow >= chartStartRow)
            ? {
                sheetName:"IGN_SUMMARY",
                startRow:chartStartRow,
                endRow:chartEndRow,
                titleThrust:t("chartTitleThrust"),
                titlePressure:t("chartTitlePressure"),
                titleThrustN:t("chartTitleThrustN"),
                seriesNameThrust:"IGN_SUMMARY!$B$4",
                seriesNameThrustN:"IGN_SUMMARY!$C$4",
                seriesNamePressure:"IGN_SUMMARY!$D$4",
                axisTitleThrust:t("hdrThrust"),
                axisTitleThrustN:t("hdrThrustN"),
                axisTitlePressure:t("hdrPressure"),
                axisTitleX:"time",
                majorUnitThrust:thrustMajorUnit,
                majorUnitThrustN:thrustNMajorUnit,
                majorUnitPressure:pressureMajorUnit,
                xMajorUnit:xMajorUnit,
                xNumFmt:"0.0",
                xTickSkip:xTickSkip,
                xMin:(xMax != null ? 0 : null),
                xMax:xMax,
                yMinThrust:thrustAxis.min,
                yMaxThrust:thrustAxis.max,
                yMinThrustN:thrustNAxis.min,
                yMaxThrustN:thrustNAxis.max,
                yMinPressure:pressureAxis.min,
                yMaxPressure:pressureAxis.max,
                xLabelCol:"E"
              }
            : null;

          const infoRows = [
            {cells:["INFO SUMMARY"], style:2},
            {cells:["모터 이름: " + (missionMotor || "-")], style:3},
            {cells:["실험 회차: " + ((el.missionTestCount && el.missionTestCount.value) ? el.missionTestCount.value.trim() : "-")], style:3},
            {cells:["실험 총 평가: -"], style:3},
            {cells:["최대 추력 (kgf): " + ((isFinite(thrustMax) && thrustMax !== -Infinity) ? Number(thrustMax.toFixed(3)) : "-")], style:3},
            {cells:["평균 추력 (kgf): " + ((avgThrustVal != null && isFinite(avgThrustVal)) ? Number(avgThrustVal.toFixed(3)) : "-")], style:3},
            {cells:["최대 압력 (V): " + ((isFinite(pressureMax) && pressureMax !== -Infinity) ? Number(pressureMax.toFixed(3)) : "-")], style:3},
            {cells:["평균 압력 (V): " + ((avgPressureVal != null && isFinite(avgPressureVal)) ? Number(avgPressureVal.toFixed(3)) : "-")], style:3},
            {cells:["점화 지연 (s): " + ((delayVal !== "" ? Number(delayVal) : "-"))], style:3},
            {cells:["연소 시간 (s): " + ((durVal !== "" ? Number(durVal) : "-"))], style:3},
            {cells:["시험 날짜: " + now.toISOString()], style:3}
          ];

          const xlsxBytes = buildXlsxBytes([
            {name:"INFO", rows:infoRows},
            {name:"IGN_SUMMARY", rows:summaryRows},
            {name:"EVENT", rows:eventRows},
            {name:"RAW", rows:rawRows}
          ], chartConfig);

          const engText = buildEngText(engRows, {
            name: missionMotor,
            diameterMm: missionDiameterMm,
            lengthMm: missionLengthMm,
            delaySec: missionDelaySec,
            propMassKg: isFinite(missionGrainMassG) ? (missionGrainMassG / 1000) : null,
            totalMassKg: isFinite(missionTotalMassG) ? (missionTotalMassG / 1000) : null,
            vendor: missionVendor,
            timeIso: now.toISOString()
          });
          const zipBytes = buildZip([
            {name:filenameXlsx, dataBytes:xlsxBytes},
            {name:filenameEng, data:engText}
          ]);
          downloadBlobAsFile(new Blob([zipBytes], {type:"application/zip"}), filenameZip);

          reportExportedRevision = logDataRevision;
          reportExportedOnce = true;
          updateExportGuardUi();
          addLogLine(t("xlsxExportLog", {filename:filenameZip}), "INFO");
          showToast(t("xlsxExportToast"), "success");
        });
      }

      const navBtns=document.querySelectorAll(".settings-nav-btn");
      const panels=document.querySelectorAll(".settings-panel");
      navBtns.forEach(btn=>{
        btn.addEventListener("click",()=>{
          const target=btn.dataset.target;
          navBtns.forEach(b=>b.classList.remove("active"));
          btn.classList.add("active");
          panels.forEach(p=>p.classList.toggle("active",p.dataset.panel===target));
        });
      });

      if(el.controlsSettingsBtns && el.controlsSettingsBtns.length){
        el.controlsSettingsBtns.forEach(btn=>{
          btn.addEventListener("click",()=>showSettings());
        });
      }
      const sideNavDesktop = document.querySelector(".side-nav-desktop");
      if(sideNavDesktop){
        let navResizeTimer = null;
        let navExpandTimer = null;
        let navClickExpandTimer = null;
        const expandTemporarily = ()=>{
          sideNavDesktop.classList.add("is-expanded");
          clearTimeout(navExpandTimer);
          navExpandTimer = setTimeout(()=>{
            sideNavDesktop.classList.remove("is-expanded");
          }, 1000);
        };
        const expandOnClick = ()=>{
          sideNavDesktop.classList.add("is-expanded");
          clearTimeout(navClickExpandTimer);
          navClickExpandTimer = setTimeout(()=>{
            sideNavDesktop.classList.remove("is-expanded");
          }, 900);
        };
        const scheduleNavRefresh = ()=>{
          requestAnimationFrame(refreshChartLayout);
          clearTimeout(navResizeTimer);
          navResizeTimer = setTimeout(refreshChartLayout, 220);
        };
        sideNavDesktop.addEventListener("mouseenter", scheduleNavRefresh);
        sideNavDesktop.addEventListener("mouseleave", scheduleNavRefresh);
        sideNavDesktop.addEventListener("touchstart", expandTemporarily, {passive:true});
        sideNavDesktop.addEventListener("click", expandOnClick);
        sideNavDesktop.addEventListener("transitionend",(ev)=>{
          if(ev.propertyName === "width" || ev.propertyName === "padding-left" || ev.propertyName === "padding-right"){
            scheduleNavRefresh();
          }
        });
      }
      const sideNavItems = document.querySelectorAll(".side-nav-item");
      const setActiveView = (title)=>{
        const label = title || "Dashboard";
        const lower = label.toLowerCase();
        const displayLabel = (lower === "home") ? "Welcome to FLASH6"
          : (lower === "control" ? "Control Panel" : label);
        if(el.pageTitle) el.pageTitle.textContent = displayLabel;
        const isHome = lower === "home";
        const isTerminal = lower === "terminal";
        const isHardware = lower === "hardware";
        const isGyro = lower === "gyro";
        const isCountdown = lower === "countdown";
        const isControl = lower === "control";
        const isDashboard = !isHome && !isTerminal && !isHardware && !isGyro && !isCountdown && !isControl;
        if(el.pageKicker){
          const name = el.hwBoardName?.textContent?.trim();
          setBoardNameDisplay(el.pageKicker, name, "FLASH6");
          el.pageKicker.classList.remove("hidden");
        }
        if(el.homeView) el.homeView.classList.toggle("hidden", !isHome);
        if(el.dashboardView) el.dashboardView.classList.toggle("hidden", !isDashboard);
        if(el.terminalView) el.terminalView.classList.toggle("hidden", !isTerminal);
        if(el.hardwareView) el.hardwareView.classList.toggle("hidden", !isHardware);
        if(el.gyroView) el.gyroView.classList.toggle("hidden", !isGyro);
        if(el.countdownView) el.countdownView.classList.toggle("hidden", !isCountdown);
        if(el.controlPanelView) el.controlPanelView.classList.toggle("hidden", !isControl);
        if(el.countdownHeader) el.countdownHeader.classList.toggle("hidden", isCountdown);
        if(el.viewLabel){
          if(isCountdown){
            el.viewLabel.textContent = t("viewCountdownLabel");
            el.viewLabel.classList.remove("hidden");
          }else{
            el.viewLabel.classList.add("hidden");
          }
        }
        if(el.countdownLabel){
          let label = t("statusCountdown");
          if(isHome) label = t("viewHomeLabel");
          else if(isDashboard) label = t("viewDashboardLabel");
          else if(isHardware) label = t("viewHardwareLabel");
          else if(isTerminal) label = t("viewTerminalLabel");
          el.countdownLabel.textContent = label;
        }
        document.body.classList.toggle("countdown-view-active", isCountdown);
        document.body.classList.toggle("dashboard-view-active", isDashboard);
        if(isHome) updateHomeUI();
        if(isDashboard){
          syncChartHeightToControls(0);
          setTimeout(refreshStatusMapSize, 60);
        }
      };
      const activateNavItem = (title)=>{
        if(!sideNavItems.length){
          setActiveView(title);
          return;
        }
        const match = Array.from(sideNavItems).find(item=>{
          const label = (item.dataset.pageTitle || item.textContent || "").trim();
          return label.toLowerCase() === String(title).toLowerCase();
        });
        if(match){
          sideNavItems.forEach(btn=>btn.classList.remove("active"));
          match.classList.add("active");
        }
        setActiveView(title);
      };
      if(el.sidebarSettingsBtns && el.sidebarSettingsBtns.length){
        el.sidebarSettingsBtns.forEach(btn=>{
          btn.addEventListener("click",()=>{
            showSettings();
          });
        });
      }
      const maybeOpenSettings = ()=>{
        if(location.hash === "#settings"){
          showSettings();
        }
      };
      maybeOpenSettings();
      window.addEventListener("hashchange", maybeOpenSettings);
      if(sideNavItems.length){
        sideNavItems.forEach(item=>{
          item.addEventListener("click",()=>{
            sideNavItems.forEach(btn=>btn.classList.remove("active"));
            item.classList.add("active");
            const title = item.dataset.pageTitle || item.textContent.trim();
            setActiveView(title);
            const nav = document.querySelector(".side-nav-desktop");
            if(nav){
              nav.classList.add("is-expanded");
              clearTimeout(nav._collapseTimer);
              nav._collapseTimer = setTimeout(()=>{
                nav.classList.remove("is-expanded");
              }, 900);
            }
          });
        });
        window.addEventListener("resize", ()=>{
          resizeGyroGl();
          refreshStatusMapSize();
        });
        const active = Array.from(sideNavItems).find(item=>item.classList.contains("active"));
        setActiveView(active ? (active.dataset.pageTitle || active.textContent.trim()) : "Dashboard");
      }
      if(el.settingsClose) el.settingsClose.addEventListener("click",()=>hideSettings());
      if(el.settingsOverlay){
        el.settingsOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.settingsOverlay) hideSettings(); });
      }
      if(el.missionOpenBtn) el.missionOpenBtn.addEventListener("click",()=>showMission());
      if(el.missionClose) el.missionClose.addEventListener("click",()=>hideMission());
      if(el.missionCloseBtn){
        el.missionCloseBtn.addEventListener("click",()=>{
          if(el.missionDialog && (el.missionDialog.classList.contains("custom-mode") ||
            el.missionDialog.classList.contains("ask-test") ||
            el.missionDialog.classList.contains("review-mode"))){
            resetMissionToPresetList();
            return;
          }
          hideMission();
        });
      }
      if(el.missionOverlay){
        el.missionOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.missionOverlay) hideMission(); });
      }
      if(el.homeArmBtn){
        el.homeArmBtn.addEventListener("click",()=>{
          if(isControlUnlocked()){
            resetInspectionUI();
            setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
            updateHomeUI();
            return;
          }
          if(el.inspectionOpenBtn) el.inspectionOpenBtn.click();
        });
      }
      if(el.homeSafeBtn){
        el.homeSafeBtn.addEventListener("click",()=>toggleInput(el.safeModeToggle));
      }
      if(el.homeIgniterBtn){
        el.homeIgniterBtn.addEventListener("click",()=>toggleInput(el.igswitch));
      }
      if(el.missionBackBtn){
        el.missionBackBtn.addEventListener("click",()=>{
          resetMissionToPresetList();
        });
      }
      const mobileControlActions = {
        sequence: ()=>{ if(el.igniteBtn) el.igniteBtn.click(); },
        force: ()=>{ if(el.forceBtn) el.forceBtn.click(); },
        serial: ()=>{ toggleInput(el.serialToggle); },
        inspection: ()=>{ if(el.inspectionOpenBtn) el.inspectionOpenBtn.click(); },
        safety: ()=>{ toggleInput(el.safeModeToggle); },
        mission: ()=>{ if(el.missionOpenBtn) el.missionOpenBtn.click(); },
        export: ()=>{ if(el.exportCsvBtn) el.exportCsvBtn.click(); },
      };
      if(el.mobileControlButtons && el.mobileControlButtons.length){
        el.mobileControlButtons.forEach(btn=>{
          btn.addEventListener("click",(ev)=>{
            ev.preventDefault();
            const type = btn.getAttribute("data-mobile-control");
            const action = mobileControlActions[type];
            if(!action) return;
            if(type === "mission" || type === "export"){
              hideMobileControlsPanel();
            }
            action();
          });
        });
      }
      updateAbortButtonLabel(false);
      updateMobileControlPills();
      updateMobileAbortButton();
      if(el.mobileControlsHandle){
        let handleDragActive = false;
        let handleStartY = 0;
        const onHandlePointerMove = (ev)=>{
          if(!handleDragActive) return;
          const delta = ev.clientY - handleStartY;
          if(delta > 40){
            hideMobileControlsPanel();
            handleDragActive = false;
          }
        };
        const stopHandleDrag = (ev)=>{
          handleDragActive = false;
          if(ev.pointerId != null) el.mobileControlsHandle.releasePointerCapture(ev.pointerId);
        };
        el.mobileControlsHandle.addEventListener("pointerdown",(ev)=>{
          ev.preventDefault();
          handleDragActive = true;
          handleStartY = ev.clientY;
          if(ev.pointerId != null) el.mobileControlsHandle.setPointerCapture(ev.pointerId);
        });
        el.mobileControlsHandle.addEventListener("pointermove",onHandlePointerMove);
        el.mobileControlsHandle.addEventListener("pointerup",stopHandleDrag);
        el.mobileControlsHandle.addEventListener("pointercancel",stopHandleDrag);
      }
      const getCenteredPreset = ()=>{
        if(!el.missionPresetGrid || !el.missionPresetViewport) return null;
        const cards = Array.from(el.missionPresetGrid.querySelectorAll(".mission-preset-btn"));
        if(cards.length === 0) return null;
        const center = el.missionPresetGrid.scrollLeft + el.missionPresetViewport.clientWidth / 2;
        let best = cards[0];
        let bestDist = Infinity;
        cards.forEach(card=>{
          const mid = card.offsetLeft + card.offsetWidth / 2;
          const dist = Math.abs(mid - center);
          if(dist < bestDist){ bestDist = dist; best = card; }
        });
        return best;
      };
      const applyMotorSpec = (name)=>{
        const spec = motorSpecs[name];
        if(!spec) return;
        if(el.missionName) el.missionName.value = spec.name;
        if(el.missionMotorDia) el.missionMotorDia.value = spec.diameterMm;
        if(el.missionMotorLen) el.missionMotorLen.value = spec.lengthMm;
        if(el.missionIgnDelay) el.missionIgnDelay.value = spec.ignDelaySec;
        if(el.missionGrainMass) el.missionGrainMass.value = spec.grainMassG;
        if(el.missionTotalMass) el.missionTotalMass.value = spec.totalMassG;
        if(el.missionVendor) el.missionVendor.value = spec.vendor;
      };
      const ensureExperimentCount = (onOk)=>{
        if(!el.missionTestCount || !el.missionTestPromptInput) { onOk(); return; }
        if(el.missionTestCount.value && el.missionTestCount.value.trim() !== "") { onOk(); return; }
        pendingMissionApply = onOk;
        el.missionTestPromptInput.value = "";
        if(el.missionDialog) el.missionDialog.classList.add("ask-test");
        if(el.missionTestInline) el.missionTestInline.setAttribute("aria-hidden","false");
        setMissionCloseLabel(true);
        el.missionTestPromptInput.focus();
      };
      const setReviewValue = (target, value)=>{
        if(!target) return;
        target.textContent = (value && String(value).trim() !== "") ? String(value) : "-";
      };
      const showMissionReview = ()=>{
        const motorName = (selectedMotorName || (el.missionName && el.missionName.value) || "").trim();
        setReviewValue(el.missionReviewMotor, motorName || "CUSTOM");
        setReviewValue(el.missionReviewTestCount, el.missionTestCount && el.missionTestCount.value);
        setReviewValue(el.missionReviewDia, el.missionMotorDia && el.missionMotorDia.value ? (el.missionMotorDia.value + " mm") : "");
        setReviewValue(el.missionReviewLen, el.missionMotorLen && el.missionMotorLen.value ? (el.missionMotorLen.value + " mm") : "");
        setReviewValue(el.missionReviewIgnDelay, el.missionIgnDelay && el.missionIgnDelay.value ? (el.missionIgnDelay.value + " s") : "");
        setReviewValue(el.missionReviewGrain, el.missionGrainMass && el.missionGrainMass.value ? (el.missionGrainMass.value + " g") : "");
        setReviewValue(el.missionReviewTotal, el.missionTotalMass && el.missionTotalMass.value ? (el.missionTotalMass.value + " g") : "");
        setReviewValue(el.missionReviewVendor, el.missionVendor && el.missionVendor.value);
        if(el.missionDialog) el.missionDialog.classList.add("review-mode");
        if(el.missionReview) el.missionReview.setAttribute("aria-hidden","false");
        if(el.missionConfirmBtn) el.missionConfirmBtn.textContent = "확인";
        setMissionCloseLabel(true);
      };
      const submitMissionTestCount = ()=>{
        if(!el.missionTestPromptInput) return;
        const num = parseInt(el.missionTestPromptInput.value, 10);
        if(el.missionTestCount) el.missionTestCount.value = (isFinite(num) && num > 0) ? String(num) : "";
        if(el.missionDialog) el.missionDialog.classList.remove("ask-test");
        if(el.missionTestInline){
          el.missionTestInline.style.display = "none";
          el.missionTestInline.setAttribute("aria-hidden","true");
        }
        showMissionReview();
      };
      const updateCenteredPreset = ()=>{
        if(!el.missionPresetGrid) return;
        const cards = Array.from(el.missionPresetGrid.querySelectorAll(".mission-preset-btn"));
        const centered = getCenteredPreset();
        cards.forEach(card=>card.classList.toggle("is-center", card === centered));
      };
      const scrollToCard = (card)=>{
        if(!card || !el.missionPresetViewport || !el.missionPresetGrid) return;
        const targetLeft = card.offsetLeft - (el.missionPresetViewport.clientWidth - card.offsetWidth) / 2;
        el.missionPresetGrid.scrollTo({left: Math.max(0, targetLeft), behavior:"smooth"});
      };
      if(el.missionPresetGrid && el.missionScrollLeft && el.missionScrollRight){
        el.missionScrollLeft.addEventListener("click",()=>{
          const cards = Array.from(el.missionPresetGrid.querySelectorAll(".mission-preset-btn"));
          const current = getCenteredPreset();
          const idx = Math.max(0, cards.indexOf(current) - 1);
          scrollToCard(cards[idx]);
        });
        el.missionScrollRight.addEventListener("click",()=>{
          const cards = Array.from(el.missionPresetGrid.querySelectorAll(".mission-preset-btn"));
          const current = getCenteredPreset();
          const idx = Math.min(cards.length - 1, cards.indexOf(current) + 1);
          scrollToCard(cards[idx]);
        });
        el.missionPresetGrid.addEventListener("scroll",()=>{
          updateCenteredPreset();
        }, {passive:true});
        updateCenteredPreset();
      }
      const presetButtons=document.querySelectorAll(".mission-preset-btn");
      if(presetButtons.length && el.missionPresetGrid && el.missionPresetViewport){
        presetButtons.forEach(btn=>{
          btn.addEventListener("click",()=>{
            const cardWidth = btn.getBoundingClientRect().width;
            const viewportWidth = el.missionPresetViewport.getBoundingClientRect().width;
            const targetLeft = btn.offsetLeft - (viewportWidth - cardWidth) / 2;
            el.missionPresetGrid.scrollLeft = Math.max(0, targetLeft);
          });
        });
      }

      const showExperimentPrompt = ()=>{
        if(!el.missionTestCount || !el.missionTestPromptInput) return;
        el.missionTestPromptInput.value = "";
        if(el.missionDialog) el.missionDialog.classList.add("ask-test");
        if(el.missionTestInline){
          el.missionTestInline.style.display = "flex";
          el.missionTestInline.setAttribute("aria-hidden","false");
        }
        setMissionCloseLabel(true);
        el.missionTestPromptInput.focus();
      };
      if(el.missionConfirmBtn){
        el.missionConfirmBtn.addEventListener("click",()=>{
        if(el.missionDialog && el.missionDialog.classList.contains("review-mode")){
            if(el.missionDialog) el.missionDialog.classList.remove("review-mode");
            if(el.missionReview) el.missionReview.setAttribute("aria-hidden","true");
            if(el.missionConfirmBtn) el.missionConfirmBtn.textContent = "다음";
            setMissionCloseLabel(false);
            updateMotorInfoPanel();
            const cb = pendingMissionApply;
            pendingMissionApply = null;
            if(cb) cb();
            updateExportButtonState();
            const missionLabel = (selectedMotorName || (el.missionName && el.missionName.value) || "").trim() || "CUSTOM";
            reportExportedRevision = 0;
            reportExportedOnce = false;
            updateExportGuardUi();
            showToast("미션 지정: " + missionLabel, "success", {key:"mission-set"});
            return;
          }
          if(el.missionDialog && el.missionDialog.classList.contains("ask-test")){
            submitMissionTestCount();
            return;
          }
          if(el.missionFields && !el.missionFields.classList.contains("hidden")){
            selectedMotorName = (el.missionName && el.missionName.value) ? el.missionName.value.trim() : "CUSTOM";
            pendingMissionApply = ()=>hideMission();
            showMissionReview();
            updateExportButtonState();
            return;
          }
          const centered = getCenteredPreset();
          if(!centered) { hideMission(); return; }
          if(centered.id === "missionCustomBtn"){
            if(el.missionFields) el.missionFields.classList.remove("hidden");
            if(el.missionPresetBlock) el.missionPresetBlock.classList.add("hidden");
            if(el.missionDialog) el.missionDialog.classList.add("custom-mode");
            setMissionCloseLabel(true);
            return;
          }
          const name = centered.getAttribute("data-mission") || "";
          if(el.missionName) el.missionName.value = name;
          selectedMotorName = name;
          applyMotorSpec(name);
          pendingMissionApply = ()=>hideMission();
          if(name === "no-motor"){
            showNoMotorNotice();
          }else{
            showExperimentPrompt();
          }
          updateExportButtonState();
        });
      }
      if(el.missionTestCancel){
        el.missionTestCancel.addEventListener("click",()=>{
          if(el.missionDialog) el.missionDialog.classList.remove("ask-test");
          if(el.missionTestInline){
            el.missionTestInline.style.display = "none";
            el.missionTestInline.setAttribute("aria-hidden","true");
          }
          pendingMissionApply = null;
          setMissionCloseLabel(false);
        });
      }
      if(el.missionTestConfirm){
        el.missionTestConfirm.addEventListener("click",()=>submitMissionTestCount());
      }
      if(el.missionTestPromptInput){
        el.missionTestPromptInput.addEventListener("keydown",(ev)=>{
          if(ev.key === "Enter") submitMissionTestCount();
        });
      }
      const swUpdateBtn = document.getElementById("swUpdateBtn");
      if(swUpdateBtn){
        swUpdateBtn.addEventListener("click",()=>{
          showToast("업데이트 확인은 준비 중입니다.", "info", {key:"sw-update"});
        });
      }
      if(el.loadcellCalOpen) el.loadcellCalOpen.addEventListener("click",()=>showLoadcellModal());
      if(el.loadcellClose) el.loadcellClose.addEventListener("click",()=>hideLoadcellModal());
      if(el.loadcellCancel) el.loadcellCancel.addEventListener("click",()=>hideLoadcellModal());
      if(el.loadcellZero) el.loadcellZero.addEventListener("click",()=>showLoadcellZeroWarning());
      if(el.loadcellOverlay){
        el.loadcellOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.loadcellOverlay) hideLoadcellModal(); });
      }
      if(el.loadcellApply){
        el.loadcellApply.addEventListener("click",()=>{
          if(el.loadcellDialog && !el.loadcellDialog.classList.contains("step-input")){
            el.loadcellDialog.classList.add("step-input");
            return;
          }
          const weight = parseFloat(el.loadcellWeightInput ? el.loadcellWeightInput.value : "");
          if(!isFinite(weight) || weight <= 0){
            showToast(t("loadcellWeightInvalidToast"), "notice");
            return;
          }
          pendingLoadcellWeight = weight;
          showLoadcellWarning(weight);
        });
      }
      if(el.loadcellWarningCancel) el.loadcellWarningCancel.addEventListener("click",()=>hideLoadcellWarning());
      if(el.loadcellWarningProceed){
        el.loadcellWarningProceed.addEventListener("click",()=>{
          if(pendingLoadcellZero){
            pendingLoadcellZero = false;
            saveLoadcellZero();
            return;
          }
          const weight = (pendingLoadcellWeight != null) ? pendingLoadcellWeight : parseFloat(el.loadcellWeightInput ? el.loadcellWeightInput.value : "");
          if(!isFinite(weight) || weight <= 0){
            showToast(t("loadcellWeightInvalidToast"), "notice");
            return;
          }
          saveLoadcellCalibration(weight);
        });
      }

      updateInspectionAccess();

      const clampInt = (value, min, max, fallback)=>{
        let v = parseInt(value, 10);
        if(isNaN(v)) v = fallback;
        if(v < min) v = min;
        if(v > max) v = max;
        return v;
      };

      const applyIgnitionTime = async ()=>{
        if(!uiSettings || !el.ignTimeInput) return;
        const before = uiSettings.ignDurationSec;
        const ignSec = clampInt(el.ignTimeInput.value, 1, 10, uiSettings.ignDurationSec || 5);
        el.ignTimeInput.value = ignSec;
        uiSettings.ignDurationSec = ignSec;
        saveSettings();
        applySettingsToUI();
        await sendCommand({http:"/set?ign_ms="+(ignSec*1000), ser:"IGNMS "+(ignSec*1000)}, false);
        if(before !== uiSettings.ignDurationSec){
          showToast(t("ignTimeChangedToast", {from:before, to:uiSettings.ignDurationSec, safety:safetyLineSuffix()}),"notice");
        }
        addLogLine(t("settingsUpdatedLog", {unit:uiSettings.thrustUnit, ign:uiSettings.ignDurationSec, cd:uiSettings.countdownSec}), "CFG");
      };

      const applyCountdownTime = async ()=>{
        if(!uiSettings || !el.countdownSecInput) return;
        const before = uiSettings.countdownSec;
        const cdSec = clampInt(el.countdownSecInput.value, 3, 30, uiSettings.countdownSec || 10);
        el.countdownSecInput.value = cdSec;
        uiSettings.countdownSec = cdSec;
        saveSettings();
        applySettingsToUI();
        await sendCommand({http:"/set?cd_ms="+(cdSec*1000),  ser:"CDMS "+(cdSec*1000)}, false);
        if(before !== uiSettings.countdownSec){
          showToast(t("countdownChangedToast", {from:before, to:uiSettings.countdownSec, safety:safetyLineSuffix()}),"notice");
        }
        addLogLine(t("settingsUpdatedLog", {unit:uiSettings.thrustUnit, ign:uiSettings.ignDurationSec, cd:uiSettings.countdownSec}), "CFG");
      };

      if(el.ignTimeSave){
        el.ignTimeSave.addEventListener("click", ()=>{ applyIgnitionTime(); });
      }
      if(el.countdownSave){
        el.countdownSave.addEventListener("click", ()=>{ applyCountdownTime(); });
      }
      if(el.ignTimeInput){
        el.ignTimeInput.addEventListener("keydown",(ev)=>{
          if(ev.key === "Enter") applyIgnitionTime();
        });
      }
      if(el.countdownSecInput){
        el.countdownSecInput.addEventListener("keydown",(ev)=>{
          if(ev.key === "Enter") applyCountdownTime();
        });
      }

      if(el.unitThrust){
        el.unitThrust.addEventListener("change",()=>{
          if(!uiSettings) return;
          const before = uiSettings.thrustUnit;
          uiSettings.thrustUnit = el.unitThrust.value || "kgf";
          saveSettings();
          applySettingsToUI();
          redrawCharts();
          if(before !== uiSettings.thrustUnit){
            showToast(t("thrustUnitChangedToast", {from:before, to:uiSettings.thrustUnit, safety:safetyLineSuffix()}),"info");
          }
        });
      }
      if(el.opModeSelect){
        el.opModeSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          const before = uiSettings.opMode;
          uiSettings.opMode = el.opModeSelect.value || "daq";
          saveSettings();
          applySettingsToUI();
          if(before !== uiSettings.opMode){
            const modeLabel = (uiSettings.opMode === "flight") ? t("opModeFlight") : t("opModeDaq");
            showToast(t("opModeChangedToast", {mode:modeLabel}), "info");
          }
        });
      }
      if(el.gyroPreviewSelect){
        el.gyroPreviewSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          uiSettings.gyroPreview = el.gyroPreviewSelect.value || "3d";
          saveSettings();
          applySettingsToUI();
        });
      }

      if(el.launcherOpenBtns && el.launcherOpenBtns.length && launcherOverlayEl){
        el.launcherOpenBtns.forEach(btn=>{
          btn.addEventListener("click",()=>showLauncher());
          btn.addEventListener("keydown",(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); showLauncher(); }});
        });
      }
      if(launcherCloseBtn){ launcherCloseBtn.addEventListener("click",()=>hideLauncher()); }
      if(launcherOverlayEl){ launcherOverlayEl.addEventListener("click",(ev)=>{ if(ev.target===launcherOverlayEl) hideLauncher(); }); }

      if(launcherUpBtn || launcherDownBtn){
        const startEvents=["mousedown","touchstart"];
        const endEvents=["mouseup","mouseleave","touchend","touchcancel"];

        if(launcherUpBtn){
          startEvents.forEach(evName=>{
            launcherUpBtn.addEventListener(evName,(ev)=>{ ev.preventDefault(); launcherUpBtn.classList.add("pressed"); startLauncherHold("up"); },{passive:false});
          });
          endEvents.forEach(evName=>{
            launcherUpBtn.addEventListener(evName,(ev)=>{ ev.preventDefault(); launcherUpBtn.classList.remove("pressed"); stopLauncherHold("up"); },{passive:false});
          });
        }

        if(launcherDownBtn){
          startEvents.forEach(evName=>{
            launcherDownBtn.addEventListener(evName,(ev)=>{ ev.preventDefault(); launcherDownBtn.classList.add("pressed"); startLauncherHold("down"); },{passive:false});
          });
          endEvents.forEach(evName=>{
            launcherDownBtn.addEventListener(evName,(ev)=>{ ev.preventDefault(); launcherDownBtn.classList.remove("pressed"); stopLauncherHold("down"); },{passive:false});
          });
        }
      }
      if(launcherAutoBtn){
        launcherAutoBtn.addEventListener("click",()=>{
          showLauncherAutoConfirm();
        });
      }
      if(launcherAutoConfirmBtn){
        launcherAutoConfirmBtn.addEventListener("click",()=>{
          hideLauncherAutoConfirm();
          startLauncherAuto();
        });
      }
      if(launcherAutoCancelBtn){
        launcherAutoCancelBtn.addEventListener("click",()=>hideLauncherAutoConfirm());
      }
      if(launcherAutoOverlayEl){
        launcherAutoOverlayEl.addEventListener("click",(ev)=>{ if(ev.target===launcherAutoOverlayEl) hideLauncherAutoConfirm(); });
      }
      if(launcherManualBtn && launcherManualControls){
        launcherManualBtn.addEventListener("click",()=>{
          launcherManualControls.classList.toggle("is-hidden");
        });
      }

      const zoomOutBtn=document.getElementById("chartZoomOut");
      const zoomInBtn=document.getElementById("chartZoomIn");
      const chartLeft=document.getElementById("chartLeft");
      const chartRight=document.getElementById("chartRight");
      const chartLive=document.getElementById("chartLive");

      if(zoomOutBtn){
        zoomOutBtn.addEventListener("click",()=>{
          const base = chartView.windowMs || CHART_WINDOW_MS_DEFAULT;
          chartView.windowMs = Math.min(CHART_WINDOW_MS_MAX, Math.round(base * 1.4));
          autoScrollChart=false;
          redrawCharts();
        });
      }
      if(zoomInBtn){
        zoomInBtn.addEventListener("click",()=>{
          const base = chartView.windowMs || CHART_WINDOW_MS_DEFAULT;
          chartView.windowMs = Math.max(CHART_WINDOW_MS_MIN, Math.round(base * 0.7));
          autoScrollChart=false;
          redrawCharts();
        });
      }
      if(chartLeft){
        chartLeft.addEventListener("click",()=>{
          autoScrollChart=false;
          const base = chartView.startMs || 0;
          const step = Math.round((chartView.windowMs || CHART_WINDOW_MS_DEFAULT) * 0.2);
          chartView.startMs = base - step;
          redrawCharts();
        });
      }
      if(chartRight){      chartRight.addEventListener("click",()=>{
          autoScrollChart=false;
          const base = chartView.startMs || 0;
          const step = Math.round((chartView.windowMs || CHART_WINDOW_MS_DEFAULT) * 0.2);
          chartView.startMs = base + step;
          redrawCharts();
        });
      }
      if(chartLive){
        chartLive.addEventListener("click",()=>{ autoScrollChart=true; redrawCharts(); });
      }

      attachTouch("thrustChart");
      attachTouch("pressureChart");
      attachTouch("accelChart");
      attachTouch("accelXYZChart");
      attachTouch("accelChartFlight");
      attachTouch("accelXYZChartFlight");
      const controlsCard = document.getElementById("controlsCard");
      if(controlsCard && window.ResizeObserver){
        const ro = new ResizeObserver(()=>{ scheduleChartLayoutRefresh(); });
        ro.observe(controlsCard);
      }
      window.addEventListener("beforeunload", handleBeforeUnload);
      window.addEventListener("resize",()=>{
        refreshChartLayout();
        refreshStatusMapSize();
      });
      syncChartHeightToControls(0);
      setTimeout(()=>syncChartHeightToControls(1), 180);
      if(document.fonts && document.fonts.ready){
        document.fonts.ready.then(()=>{ setTimeout(()=>syncChartHeightToControls(2), 120); });
      }

      openWebSocket();
      updateWsUI();
      setInterval(ensureWsAlive, 500);
      setInterval(fetchWifiInfo, 2000);
      fetchWifiInfo();
      updateData().finally(()=>{ pollLoop(); });
      updateSerialPill();

      // ✅ KST 실시간 업데이트
      updateKstClock();
      setInterval(updateKstClock, 1000);
    });
