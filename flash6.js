    if (typeof window !== "undefined") {
      window.__flashBoot = window.__flashBoot || {};
      window.__flashBoot.jsReady = true;
    }

    // =====================
    // 상태/버퍼
    // =====================

    let logLines = [];
    let logData = [];
    let eventLog = [];
    let thrustBaseHistory = [];
    let pressureBaseHistory = [];
    let quickAltitudeHistory = [];
    let gyroSpeedHistory = [];
    let accelMagHistory = [];
    let accelXHistory = [];
    let accelYHistory = [];
    let accelZHistory = [];
    let gyroXHistory = [];
    let gyroYHistory = [];
    let gyroZHistory = [];
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
    let missionProfileDoc = null;
    let missionBlocksState = [];
    let missionBoardSavePending = false;
    let replayMissionRuntime = null;
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
    const GYRO_TRAIL_MAX_POINTS = 6000;
    const GYRO_TRAIL_BASE_METERS_PER_UNIT_XZ = 4.2;
    const GYRO_TRAIL_BASE_METERS_PER_UNIT_Y = 1.6;
    const GYRO_TRAIL_HALF_SPAN_XZ = 2.2;
    const GYRO_TRAIL_HALF_SPAN_Y = 3.2;
    const GYRO_TRAIL_ZOOM_OUT_SMOOTH = 0.11;
    const GYRO_TRAIL_ZOOM_IN_SMOOTH = 0.025;
    const GYRO_WORLD_ALTITUDE_BASE = 0.23;
    const GYRO_FOV_DEG = 44;
    const GYRO_CAMERA_DEFAULT = Object.freeze({yawDeg:42, pitchDeg:24, distance:1.95});
    const GYRO_CAMERA_MIN_DISTANCE = 1.9;
    const GYRO_CAMERA_MAX_DISTANCE = 30;
    const GYRO_CAMERA_TARGET_SMOOTH = 0.16;
    const GYRO_CAMERA_DISTANCE_SMOOTH = 0.12;
    const GYRO_CAMERA_PAN_LIMIT = 9.5;
    const GYRO_PREVIEW_TRACK_TARGET_X = 0.52;
    const GYRO_PREVIEW_TRACK_TARGET_Y = 0.34;
    const GYRO_PREVIEW_TRACK_SMOOTH = 0.26;
    const GYRO_PREVIEW_TRACK_DEADBAND = 0.018;
    const GYRO_PREVIEW_TRACK_MAX_SHIFT_RATIO = 0.92;
    const GYRO_GRID_MIN_SPAN = 10.5;
    const GYRO_GRID_MAX_SPAN = 140;
    const GYRO_ROCKET_SCALE = 0.3;
    const GYRO_ROCKET_STL_PATH = "3d/Gyro_model_rocket.stl";
    const GYRO_ROCKET_STL_TARGET_LENGTH = 1.56;
    const GYRO_ROCKET_STL_Y_OFFSET = 0.16;
    const GYRO_ROCKET_STL_COLOR = [0.9,0.94,0.99,1];
    const GYRO_ROCKET_RENDER_PITCH_UPRIGHT_DEG = 0;
    const GYRO_TRAIL_FILTER_ALPHA = 0.16;
    const GYRO_TRAIL_FILTER_ALPHA_ALT = 0.22;
    const GYRO_TRAIL_MIN_STEP_M = 0.45;
    const GYRO_TRAIL_MIN_STEP_M_IMU = 0.035;
    const GYRO_TRAIL_IDLE_HOLD_MS = 700;
    const GYRO_TRAIL_IDLE_HOLD_MS_IMU = 240;
    const GYRO_TRAIL_IDLE_DRIFT_M = 0.16;
    const GYRO_TRAIL_IDLE_DRIFT_M_IMU = 0.02;
    const GYRO_TRAIL_JUMP_REJECT_M = 48;
    const GYRO_TRAIL_JUMP_REJECT_M_IMU = 12;
    const GYRO_TRAIL_JUMP_REJECT_MS = 1200;
    const GYRO_TRAIL_JUMP_REJECT_MS_IMU = 600;
    const GYRO_ALTITUDE_DEADBAND_M = 0.05;
    const GYRO_ATTITUDE_ACCEL_BLEND = 0.08;
    const GYRO_ATTITUDE_ACCEL_BLEND_SIM = 0.12;
    const GYRO_ATTITUDE_ACCEL_UNTRUSTED_ERR_G = 0.28;
    const GYRO_ATTITUDE_RATE_UNTRUSTED_DPS = 220;
    const GYRO_IMU_MAX_DT_SEC = 0.18;
    const GYRO_IMU_GRAVITY_MPS2 = 9.80665;
    const GYRO_IMU_ACCEL_FILTER_ALPHA = 0.26;
    const GYRO_IMU_ACCEL_DEADBAND_G = 0.018;
    const GYRO_IMU_ACCEL_CLAMP_G = 1.6;
    const GYRO_IMU_ACTIVE_ACCEL_MPS2 = 0.38;
    const GYRO_IMU_DRAG_ACTIVE = 0.85;
    const GYRO_IMU_DRAG_IDLE = 3.8;
    const GYRO_IMU_VEL_EPS_MPS = 0.015;
    const GYRO_IMU_RANGE_LIMIT_M = 260;
    const GYRO_IMU_ALT_MIN_M = -60;
    const GYRO_IMU_ALT_MAX_M = 420;
    const GYRO_ALTGYRO_MIN_DT_SEC = 0.03;
    const GYRO_ALTGYRO_MAX_DT_SEC = 0.45;
    const GYRO_ALTGYRO_MIN_SIN_PITCH = 0.16;
    const GYRO_ALTGYRO_VSPEED_FILTER_ALPHA = 0.28;
    const GYRO_ALTGYRO_MAX_HSPEED_MPS = 48;

    // ✅ 너무 빡센 폴링(30ms)은 ESP 쪽 응답 흔들림(간헐 타임아웃/큐 적체)을 만들 수 있어서 완화
    const POLL_INTERVAL      = 80;

    const UI_SAMPLE_SKIP     = 3;
    const CHART_MIN_INTERVAL = 50;
    const PARACHUTE_STATUS_HOLD_MS = 18000;

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
    let gyroAttitudeLastMs = 0;
    let gyroAttitudeReady = false;
    let gyroYawDeg = 0;
    let gyroPitchDeg = 0;
    let gyroRollDeg = 0;
    let gyroAttitudeQuat = [1,0,0,0];
    let gyroZeroRollOffsetDeg = 0;
    let gyroZeroPitchOffsetDeg = 0;
    let gyroZeroYawOffsetDeg = 0;
    let gyroZeroQuat = [1,0,0,0];
    let gyroGl = null;
    let gyroRocketMeshPromise = null;
    let gyroViewportBindingsReady = false;
    let statusMapViewportBindingsReady = false;
    let statusMapResizeObserver = null;
    let statusMapRefreshRaf = null;
    let statusMapRefreshTimers = [];
    const gyroCameraState = {
      yawDeg: GYRO_CAMERA_DEFAULT.yawDeg,
      pitchDeg: GYRO_CAMERA_DEFAULT.pitchDeg,
      distance: GYRO_CAMERA_DEFAULT.distance,
      desiredDistance: GYRO_CAMERA_DEFAULT.distance,
      panX: 0,
      panY: 0,
      panZ: 0,
      targetX: 0,
      targetY: GYRO_WORLD_ALTITUDE_BASE,
      targetZ: 0,
      previewRocketX: 0.5,
      previewRocketY: 0.5,
      previewRocketValid: false,
      previewSmoothX: 0.5,
      previewSmoothY: 0.5,
      drag: null
    };
    const gyroViewportPortalState = {
      homeParent: null,
      homeNextSibling: null,
      mountedToBody: false
    };
    const statusMapViewportPortalState = {
      homeParent: null,
      homeNextSibling: null,
      mountedToBody: false
    };
    const mobileAbortPanelPortalState = {
      homeParent: null,
      homeNextSibling: null,
      mountedToBody: false
    };
    const mobileControlsPanelPortalState = {
      homeParent: null,
      homeNextSibling: null,
      mountedToBody: false
    };
    let gyroPathState = {
      originLat: null,
      originLon: null,
      originAlt: null,
      source: "none",
      gpsOffsetX: 0,
      gpsOffsetY: 0,
      gpsOffsetZ: 0,
      points: [],
      lastFixMs: 0,
      renderScaleXZ: GYRO_TRAIL_BASE_METERS_PER_UNIT_XZ,
      renderScaleY: GYRO_TRAIL_BASE_METERS_PER_UNIT_Y,
      smoothPath: [],
      filteredX: null,
      filteredY: null,
      filteredZ: null,
      imuLastMs: 0,
      imuPosX: 0,
      imuPosY: 0,
      imuPosZ: 0,
      imuVelX: 0,
      imuVelY: 0,
      imuVelZ: 0,
      imuFiltX: 0,
      imuFiltY: 0,
      imuFiltZ: 0,
      imuFiltReady: false,
      altOffsetY: 0,
      altAnchorX: 0,
      altAnchorZ: 0,
      altGyroLastAlt: NaN,
      altGyroLastMs: 0,
      altGyroPosX: 0,
      altGyroPosZ: 0,
      altGyroVSpeedMps: 0
    };
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
        const ai0 = a[i];
        const ai1 = a[i+4];
        const ai2 = a[i+8];
        const ai3 = a[i+12];
        o[i]    = ai0*b[0]  + ai1*b[1]  + ai2*b[2]  + ai3*b[3];
        o[i+4]  = ai0*b[4]  + ai1*b[5]  + ai2*b[6]  + ai3*b[7];
        o[i+8]  = ai0*b[8]  + ai1*b[9]  + ai2*b[10] + ai3*b[11];
        o[i+12] = ai0*b[12] + ai1*b[13] + ai2*b[14] + ai3*b[15];
      }
      return o;
    }
    function mat4Perspective(fov, aspect, near, far){
      const f = 1 / Math.tan(fov / 2);
      const nf = 1 / (near - far);
      return [
        f / aspect,0,0,0,
        0,f,0,0,
        0,0,(far + near) * nf,-1,
        0,0,(2 * far * near) * nf,0
      ];
    }
    function mat4LookAt(eye, center, up){
      const zx = eye[0] - center[0];
      const zy = eye[1] - center[1];
      const zz = eye[2] - center[2];
      let zLen = Math.hypot(zx, zy, zz) || 1;
      const z0 = zx / zLen;
      const z1 = zy / zLen;
      const z2 = zz / zLen;
      const xx = (up[1] * z2) - (up[2] * z1);
      const xy = (up[2] * z0) - (up[0] * z2);
      const xz = (up[0] * z1) - (up[1] * z0);
      let xLen = Math.hypot(xx, xy, xz) || 1;
      const x0 = xx / xLen;
      const x1 = xy / xLen;
      const x2 = xz / xLen;
      const y0 = (z1 * x2) - (z2 * x1);
      const y1 = (z2 * x0) - (z0 * x2);
      const y2 = (z0 * x1) - (z1 * x0);
      return [
        x0,y0,z0,0,
        x1,y1,z1,0,
        x2,y2,z2,0,
        -((x0 * eye[0]) + (x1 * eye[1]) + (x2 * eye[2])),
        -((y0 * eye[0]) + (y1 * eye[1]) + (y2 * eye[2])),
        -((z0 * eye[0]) + (z1 * eye[1]) + (z2 * eye[2])),
        1
      ];
    }
    function mat4Translate(tx, ty, tz){
      return [1,0,0,0,
              0,1,0,0,
              0,0,1,0,
              tx,ty,tz,1];
    }
    function mat4Scale(sx, sy, sz){
      return [sx,0,0,0,
              0,sy,0,0,
              0,0,sz,0,
              0,0,0,1];
    }
    function mat4TransformVec4(m, x, y, z, w){
      return [
        (m[0] * x) + (m[4] * y) + (m[8] * z) + (m[12] * w),
        (m[1] * x) + (m[5] * y) + (m[9] * z) + (m[13] * w),
        (m[2] * x) + (m[6] * y) + (m[10] * z) + (m[14] * w),
        (m[3] * x) + (m[7] * y) + (m[11] * z) + (m[15] * w)
      ];
    }
    function vec3Sub(a, b){
      return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    }
    function vec3Scale(v, s){
      return [v[0] * s, v[1] * s, v[2] * s];
    }
    function vec3Cross(a, b){
      return [
        (a[1] * b[2]) - (a[2] * b[1]),
        (a[2] * b[0]) - (a[0] * b[2]),
        (a[0] * b[1]) - (a[1] * b[0])
      ];
    }
    function vec3Length(v){
      return Math.hypot(v[0], v[1], v[2]);
    }
    function vec3Normalize(v){
      const len = vec3Length(v) || 1;
      return [v[0] / len, v[1] / len, v[2] / len];
    }
    function quatNormalize(q){
      const qw = isFinite(q && q[0]) ? Number(q[0]) : 1;
      const qx = isFinite(q && q[1]) ? Number(q[1]) : 0;
      const qy = isFinite(q && q[2]) ? Number(q[2]) : 0;
      const qz = isFinite(q && q[3]) ? Number(q[3]) : 0;
      const len = Math.hypot(qw, qx, qy, qz) || 1;
      return [qw / len, qx / len, qy / len, qz / len];
    }
    function quatMul(a, b){
      const aw = a[0], ax = a[1], ay = a[2], az = a[3];
      const bw = b[0], bx = b[1], by = b[2], bz = b[3];
      return [
        (aw * bw) - (ax * bx) - (ay * by) - (az * bz),
        (aw * bx) + (ax * bw) + (ay * bz) - (az * by),
        (aw * by) - (ax * bz) + (ay * bw) + (az * bx),
        (aw * bz) + (ax * by) - (ay * bx) + (az * bw)
      ];
    }
    function quatConjugate(q){
      return [q[0], -q[1], -q[2], -q[3]];
    }
    function quatFromAxisAngle(axis, angleRad){
      const v = vec3Normalize(axis || [1,0,0]);
      const half = (isFinite(angleRad) ? angleRad : 0) * 0.5;
      const s = Math.sin(half);
      return quatNormalize([Math.cos(half), v[0] * s, v[1] * s, v[2] * s]);
    }
    function quatToMat4(q){
      const nq = quatNormalize(q);
      const w = nq[0], x = nq[1], y = nq[2], z = nq[3];
      const xx = x * x, yy = y * y, zz = z * z;
      const xy = x * y, xz = x * z, yz = y * z;
      const wx = w * x, wy = w * y, wz = w * z;
      return [
        1 - (2 * (yy + zz)), 2 * (xy + wz),       2 * (xz - wy),       0,
        2 * (xy - wz),       1 - (2 * (xx + zz)), 2 * (yz + wx),       0,
        2 * (xz + wy),       2 * (yz - wx),       1 - (2 * (xx + yy)), 0,
        0,                   0,                   0,                   1
      ];
    }
    function quatFromRenderEuler(pitchDeg, yawDeg, rollDeg){
      // Keep the 3D model aligned with the UI/board labels directly:
      // X=roll, Y=pitch, Z=yaw.
      const qx = quatFromAxisAngle([1,0,0], (Number(rollDeg) || 0) * DEG_TO_RAD);
      const qy = quatFromAxisAngle([0,1,0], (Number(pitchDeg) || 0) * DEG_TO_RAD);
      const qz = quatFromAxisAngle([0,0,1], (Number(yawDeg) || 0) * DEG_TO_RAD);
      return quatNormalize(quatMul(qz, quatMul(qy, qx)));
    }
    function getGyroDisplayRollDeg(value){
      const base = (value == null) ? gyroRollDeg : Number(value);
      return normalizeAngleDeg((isFinite(base) ? base : 0) + gyroZeroRollOffsetDeg);
    }
    function getGyroDisplayPitchDeg(value){
      const base = (value == null) ? gyroPitchDeg : Number(value);
      return clampLocal((isFinite(base) ? base : 0) + gyroZeroPitchOffsetDeg, -90, 90);
    }
    function getGyroDisplayYawDeg(value){
      const base = (value == null) ? gyroYawDeg : Number(value);
      return normalizeAngleDeg((isFinite(base) ? base : 0) + gyroZeroYawOffsetDeg);
    }
    function applyGyroZeroReference(){
      if(!gyroAttitudeReady) return false;
      const targetPitchDeg = 90;
      const targetYawDeg = 0;
      const targetRollDeg = 0;
      gyroZeroRollOffsetDeg = targetRollDeg - gyroRollDeg;
      gyroZeroPitchOffsetDeg = targetPitchDeg - gyroPitchDeg;
      gyroZeroYawOffsetDeg = -gyroYawDeg;
      const targetQuat = quatFromRenderEuler(targetPitchDeg, targetYawDeg, targetRollDeg);
      gyroZeroQuat = quatNormalize(quatMul(targetQuat, quatConjugate(quatNormalize(gyroAttitudeQuat))));
      return true;
    }
    function getGyroRocketModelQuat(){
      const baseQuat = quatFromAxisAngle([1,0,0], GYRO_ROCKET_RENDER_PITCH_UPRIGHT_DEG * DEG_TO_RAD);
      const zeroedQuat = quatNormalize(quatMul(gyroZeroQuat, gyroAttitudeQuat));
      return quatNormalize(quatMul(zeroedQuat, baseQuat));
    }
    function resetGyroAttitudeState(){
      gyroLastUiMs = 0;
      gyroAttitudeLastMs = 0;
      gyroAttitudeReady = false;
      gyroYawDeg = 0;
      gyroPitchDeg = 0;
      gyroRollDeg = 0;
      gyroAttitudeQuat = [1,0,0,0];
      gyroZeroRollOffsetDeg = 0;
      gyroZeroPitchOffsetDeg = 0;
      gyroZeroYawOffsetDeg = 0;
      gyroZeroQuat = [1,0,0,0];
    }
    function clampLocal(value, min, max){
      return Math.max(min, Math.min(max, value));
    }
    function normalizeAngleDeg(angle){
      if(!isFinite(angle)) return 0;
      let wrapped = angle % 360;
      if(wrapped <= -180) wrapped += 360;
      if(wrapped > 180) wrapped -= 360;
      return wrapped;
    }
    function angleDeltaDeg(fromDeg, toDeg){
      return normalizeAngleDeg(toDeg - fromDeg);
    }
    function lerpAngleDeg(fromDeg, toDeg, alpha){
      const a = clampLocal(isFinite(alpha) ? alpha : 0, 0, 1);
      return normalizeAngleDeg(fromDeg + (angleDeltaDeg(fromDeg, toDeg) * a));
    }
    function triNormal(a, b, c){
      return vec3Normalize(vec3Cross(vec3Sub(b, a), vec3Sub(c, a)));
    }
    function compileGyroShader(gl, type, src){
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
        const msg = gl.getShaderInfoLog(sh) || "gyro shader compile failed";
        gl.deleteShader(sh);
        throw new Error(msg);
      }
      return sh;
    }
    function createGyroProgram(gl, vsSrc, fsSrc){
      const vs = compileGyroShader(gl, gl.VERTEX_SHADER, vsSrc);
      const fs = compileGyroShader(gl, gl.FRAGMENT_SHADER, fsSrc);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
        const msg = gl.getProgramInfoLog(prog) || "gyro program link failed";
        gl.deleteProgram(prog);
        throw new Error(msg);
      }
      return prog;
    }
    function createGyroArrayBuffer(gl, data, usage){
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage || gl.STATIC_DRAW);
      return buf;
    }
    function pushGyroLine(lineData, x1, y1, z1, x2, y2, z2, r, g, b, a){
      lineData.pos.push(x1,y1,z1, x2,y2,z2);
      lineData.col.push(r,g,b,a, r,g,b,a);
    }
    function pushSolidTri(mesh, a, b, c, color, na, nb, nc){
      const faceN = triNormal(a, b, c);
      const n0 = na || faceN;
      const n1 = nb || faceN;
      const n2 = nc || faceN;
      mesh.pos.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
      mesh.norm.push(n0[0],n0[1],n0[2], n1[0],n1[1],n1[2], n2[0],n2[1],n2[2]);
      mesh.col.push(color[0],color[1],color[2],color[3],
                    color[0],color[1],color[2],color[3],
                    color[0],color[1],color[2],color[3]);
      mesh.count += 3;
    }
    function pushSolidQuad(mesh, a, b, c, d, color, na, nb, nc, nd){
      pushSolidTri(mesh, a, b, c, color, na, nb, nc);
      pushSolidTri(mesh, a, c, d, color, na, nc, nd);
    }

    function buildGyroLineGeometry(){
      const data = {pos:[], col:[]};
      const sections = {};

      sections.gridStart = 0;
      const div = 48;
      for(let i=0;i<=div;i++){
        const u = -1 + ((2 * i) / div);
        const major = (i % 6) === 0;
        const c = major ? [0.56,0.65,0.8,0.46] : [0.42,0.5,0.64,0.24];
        pushGyroLine(data, -1,0,u, 1,0,u, c[0],c[1],c[2],c[3]);
        pushGyroLine(data, u,0,-1, u,0,1, c[0],c[1],c[2],c[3]);
      }
      sections.gridCount = (data.pos.length / 3) - sections.gridStart;

      sections.axisStart = data.pos.length / 3;
      const axisLen = 1.45;
      const axisTail = 0.9;
      const arrow = 0.13;
      const tipMarker = 0.06;
      pushGyroLine(data, -axisTail,0,0, axisLen,0,0, 0.95,0.37,0.35,0.95);
      pushGyroLine(data, 0,-axisTail,0, 0,axisLen,0, 0.23,0.84,0.48,0.95);
      pushGyroLine(data, 0,0,-axisTail, 0,0,axisLen, 0.26,0.66,0.98,0.95);
      pushGyroLine(data, axisLen,0,0, axisLen-arrow, arrow*0.55,0, 0.95,0.37,0.35,0.95);
      pushGyroLine(data, axisLen,0,0, axisLen-arrow,-arrow*0.55,0, 0.95,0.37,0.35,0.95);
      pushGyroLine(data, axisLen, tipMarker,0, axisLen,-tipMarker,0, 1,0.48,0.44,0.98);
      pushGyroLine(data, axisLen,0,tipMarker, axisLen,0,-tipMarker, 1,0.48,0.44,0.98);
      pushGyroLine(data, 0,axisLen,0, arrow*0.55,axisLen-arrow,0, 0.23,0.84,0.48,0.95);
      pushGyroLine(data, 0,axisLen,0,-arrow*0.55,axisLen-arrow,0, 0.23,0.84,0.48,0.95);
      pushGyroLine(data, tipMarker,axisLen,0, -tipMarker,axisLen,0, 0.38,0.92,0.56,0.98);
      pushGyroLine(data, 0,axisLen,tipMarker, 0,axisLen,-tipMarker, 0.38,0.92,0.56,0.98);
      pushGyroLine(data, 0,0,axisLen, 0,arrow*0.55,axisLen-arrow, 0.26,0.66,0.98,0.95);
      pushGyroLine(data, 0,0,axisLen, 0,-arrow*0.55,axisLen-arrow, 0.26,0.66,0.98,0.95);
      pushGyroLine(data, tipMarker,0,axisLen, -tipMarker,0,axisLen, 0.37,0.74,1,0.98);
      pushGyroLine(data, 0,tipMarker,axisLen, 0,-tipMarker,axisLen, 0.37,0.74,1,0.98);
      sections.axisCount = (data.pos.length / 3) - sections.axisStart;

      sections.bodyStart = data.pos.length / 3;
      const bodyAxisLen = 0.88;
      pushGyroLine(data, 0,0,0, bodyAxisLen,0,0, 0.98,0.28,0.22,0.98);
      pushGyroLine(data, 0,0,0, 0,bodyAxisLen,0, 0.13,0.86,0.42,0.98);
      pushGyroLine(data, 0,0,0, 0,0,bodyAxisLen, 0.25,0.58,1,0.98);
      // Heading cue on body
      pushGyroLine(data, 0.04,0.36,0, 0.34,0.36,0, 1,0.82,0.22,0.96);
      pushGyroLine(data, 0.34,0.36,0, 0.27,0.41,0, 1,0.82,0.22,0.96);
      pushGyroLine(data, 0.34,0.36,0, 0.27,0.31,0, 1,0.82,0.22,0.96);
      sections.bodyCount = (data.pos.length / 3) - sections.bodyStart;

      return {pos:data.pos, col:data.col, sections};
    }

    function buildGyroSolidGeometry(){
      const floor = {pos:[], norm:[], col:[], count:0};
      const rocket = {pos:[], norm:[], col:[], count:0};

      const floorN = [0,1,0];
      pushSolidQuad(floor,
        [-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],
        [0.12,0.16,0.22,0.94],
        floorN,floorN,floorN,floorN
      );

      const seg = 24;
      const bodyRadius = 0.16;
      const bodyBottomY = -0.62;
      const bodyTopY = 0.48;
      const bodyCol = [0.75,0.8,0.9,1];
      for(let i=0;i<seg;i++){
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        const c0 = Math.cos(a0), s0 = Math.sin(a0);
        const c1 = Math.cos(a1), s1 = Math.sin(a1);
        const p0 = [c0 * bodyRadius, bodyBottomY, s0 * bodyRadius];
        const p1 = [c1 * bodyRadius, bodyBottomY, s1 * bodyRadius];
        const p2 = [c1 * bodyRadius, bodyTopY,    s1 * bodyRadius];
        const p3 = [c0 * bodyRadius, bodyTopY,    s0 * bodyRadius];
        const n0 = [c0,0,s0];
        const n1 = [c1,0,s1];
        pushSolidTri(rocket, p0, p1, p2, bodyCol, n0, n1, n1);
        pushSolidTri(rocket, p0, p2, p3, bodyCol, n0, n1, n0);
      }

      const baseCenter = [0,bodyBottomY,0];
      const baseCol = [0.28,0.34,0.45,1];
      for(let i=0;i<seg;i++){
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        const p0 = [Math.cos(a0) * bodyRadius, bodyBottomY, Math.sin(a0) * bodyRadius];
        const p1 = [Math.cos(a1) * bodyRadius, bodyBottomY, Math.sin(a1) * bodyRadius];
        const n = [0,-1,0];
        pushSolidTri(rocket, baseCenter, p1, p0, baseCol, n, n, n);
      }

      const noseBaseY = bodyTopY;
      const noseTipY = 0.94;
      const noseRadius = 0.13;
      const noseCol = [0.98,0.45,0.24,1];
      for(let i=0;i<seg;i++){
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        const p0 = [Math.cos(a0) * noseRadius, noseBaseY, Math.sin(a0) * noseRadius];
        const p1 = [Math.cos(a1) * noseRadius, noseBaseY, Math.sin(a1) * noseRadius];
        const tip = [0, noseTipY, 0];
        const n = triNormal(p0, p1, tip);
        pushSolidTri(rocket, p0, p1, tip, noseCol, n, n, n);
      }

      const bandBot = 0.28;
      const bandTop = 0.34;
      const bandR = bodyRadius * 1.04;
      const bandCol = [0.2,0.26,0.36,1];
      for(let i=0;i<seg;i++){
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        const c0 = Math.cos(a0), s0 = Math.sin(a0);
        const c1 = Math.cos(a1), s1 = Math.sin(a1);
        const p0 = [c0 * bandR, bandBot, s0 * bandR];
        const p1 = [c1 * bandR, bandBot, s1 * bandR];
        const p2 = [c1 * bandR, bandTop, s1 * bandR];
        const p3 = [c0 * bandR, bandTop, s0 * bandR];
        const n0 = [c0,0,s0];
        const n1 = [c1,0,s1];
        pushSolidTri(rocket, p0, p1, p2, bandCol, n0, n1, n1);
        pushSolidTri(rocket, p0, p2, p3, bandCol, n0, n1, n0);
      }

      const finCol = [0.24,0.43,0.78,1];
      const finRootTopY = bodyBottomY + 0.17;
      const finRootBottomY = bodyBottomY + 0.01;
      const finSpan = 0.25;
      const finRearY = bodyBottomY - 0.16;
      const dirs = [[1,0],[0,1],[-1,0],[0,-1]];
      for(let i=0;i<dirs.length;i++){
        const dx = dirs[i][0];
        const dz = dirs[i][1];
        const rootTop = [dx * bodyRadius * 0.97, finRootTopY, dz * bodyRadius * 0.97];
        const rootBottom = [dx * bodyRadius * 0.97, finRootBottomY, dz * bodyRadius * 0.97];
        const tip = [dx * (bodyRadius + finSpan), bodyBottomY - 0.08, dz * (bodyRadius + finSpan)];
        const rear = [dx * (bodyRadius + finSpan * 0.64), finRearY, dz * (bodyRadius + finSpan * 0.64)];
        const sideN = vec3Normalize([dx,0,dz]);
        const backN = vec3Scale(sideN, -1);
        pushSolidTri(rocket, rootTop, tip, rootBottom, finCol, sideN, sideN, sideN);
        pushSolidTri(rocket, rootBottom, tip, rear, finCol, sideN, sideN, sideN);
        pushSolidTri(rocket, rootTop, rootBottom, tip, finCol, backN, backN, backN);
        pushSolidTri(rocket, rootBottom, rear, tip, finCol, backN, backN, backN);
      }

      const markerCol = [1,0.84,0.26,1];
      pushSolidTri(rocket,
        [bodyRadius * 0.96, 0.44, 0],
        [bodyRadius + 0.22, 0.38, 0.03],
        [bodyRadius + 0.22, 0.38, -0.03],
        markerCol
      );
      pushSolidTri(rocket,
        [bodyRadius * 0.96, 0.3, 0],
        [bodyRadius + 0.17, 0.24, 0.03],
        [bodyRadius + 0.17, 0.24, -0.03],
        markerCol
      );

      return {floor, rocket};
    }

    function parseGyroBinaryStlMesh(arrayBuffer){
      const view = new DataView(arrayBuffer);
      if(view.byteLength < 84) throw new Error("STL too small");
      const triCount = view.getUint32(80, true);
      const expectedSize = 84 + (triCount * 50);
      if(triCount <= 0 || expectedSize !== view.byteLength){
        throw new Error("Unsupported STL layout");
      }

      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      let offset = 84;
      for(let i=0;i<triCount;i++){
        offset += 12;
        for(let v=0;v<3;v++){
          const x = view.getFloat32(offset, true);
          const y = view.getFloat32(offset + 4, true);
          const z = view.getFloat32(offset + 8, true);
          if(x < minX) minX = x;
          if(y < minY) minY = y;
          if(z < minZ) minZ = z;
          if(x > maxX) maxX = x;
          if(y > maxY) maxY = y;
          if(z > maxZ) maxZ = z;
          offset += 12;
        }
        offset += 2;
      }

      const spanX = maxX - minX;
      const spanY = maxY - minY;
      const spanZ = maxZ - minZ;
      const maxSpan = Math.max(spanX, spanY, spanZ);
      if(!(maxSpan > 0.00001)) throw new Error("Invalid STL bounds");

      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const cz = (minZ + maxZ) * 0.5;
      const scale = GYRO_ROCKET_STL_TARGET_LENGTH / maxSpan;
      const color = GYRO_ROCKET_STL_COLOR;

      const mesh = {pos:[], norm:[], col:[], count:0};
      const rotatePos = (x, y, z)=>{
        const lx = (x - cx) * scale;
        const ly = (y - cy) * scale;
        const lz = (z - cz) * scale;
        return [lx, lz + GYRO_ROCKET_STL_Y_OFFSET, -ly];
      };
      const rotateNorm = (x, y, z)=>{
        const n = vec3Normalize([x, z, -y]);
        return n;
      };

      offset = 84;
      for(let i=0;i<triCount;i++){
        const nxRaw = view.getFloat32(offset, true);
        const nyRaw = view.getFloat32(offset + 4, true);
        const nzRaw = view.getFloat32(offset + 8, true);
        offset += 12;

        const v0 = rotatePos(
          view.getFloat32(offset, true),
          view.getFloat32(offset + 4, true),
          view.getFloat32(offset + 8, true)
        );
        offset += 12;
        const v1 = rotatePos(
          view.getFloat32(offset, true),
          view.getFloat32(offset + 4, true),
          view.getFloat32(offset + 8, true)
        );
        offset += 12;
        const v2 = rotatePos(
          view.getFloat32(offset, true),
          view.getFloat32(offset + 4, true),
          view.getFloat32(offset + 8, true)
        );
        offset += 12;
        offset += 2;

        const fileNormalLen = Math.hypot(nxRaw, nyRaw, nzRaw);
        const n = (fileNormalLen > 0.00001)
          ? rotateNorm(nxRaw, nyRaw, nzRaw)
          : triNormal(v0, v1, v2);

        pushSolidTri(mesh, v0, v1, v2, color, n, n, n);
      }

      return mesh;
    }

    function requestGyroRocketMeshFromStl(){
      if(gyroRocketMeshPromise) return gyroRocketMeshPromise;
      const src = new URL(GYRO_ROCKET_STL_PATH, window.location.href).href;
      gyroRocketMeshPromise = fetch(src)
        .then((res)=>{
          if(!res.ok) throw new Error("STL fetch failed: " + res.status);
          return res.arrayBuffer();
        })
        .then((buf)=> parseGyroBinaryStlMesh(buf))
        .catch((err)=>{
          console.warn("[gyro] STL rocket load failed:", err);
          return null;
        });
      return gyroRocketMeshPromise;
    }

    function applyGyroRocketMeshToGl(mesh){
      if(!gyroGl || !gyroGl.gl || !gyroGl.solid || !mesh || !mesh.count) return false;
      const gl = gyroGl.gl;
      const solid = gyroGl.solid;
      const prevPos = solid.rocketPosBuf;
      const prevNorm = solid.rocketNormBuf;
      const prevCol = solid.rocketColBuf;
      solid.rocketPosBuf = createGyroArrayBuffer(gl, mesh.pos, gl.STATIC_DRAW);
      solid.rocketNormBuf = createGyroArrayBuffer(gl, mesh.norm, gl.STATIC_DRAW);
      solid.rocketColBuf = createGyroArrayBuffer(gl, mesh.col, gl.STATIC_DRAW);
      solid.rocketCount = mesh.count;
      if(prevPos) gl.deleteBuffer(prevPos);
      if(prevNorm) gl.deleteBuffer(prevNorm);
      if(prevCol) gl.deleteBuffer(prevCol);
      return true;
    }

    function isGyroViewportExpanded(){
      return !!(el.gyro3dViewport && el.gyro3dViewport.classList.contains("is-expanded"));
    }

    function moveGyroViewportToBody(){
      if(!el.gyro3dViewport || gyroViewportPortalState.mountedToBody) return;
      const parent = el.gyro3dViewport.parentNode;
      if(!parent) return;
      gyroViewportPortalState.homeParent = parent;
      gyroViewportPortalState.homeNextSibling = el.gyro3dViewport.nextSibling;
      document.body.appendChild(el.gyro3dViewport);
      gyroViewportPortalState.mountedToBody = true;
    }

    function restoreGyroViewportFromBody(){
      if(!el.gyro3dViewport || !gyroViewportPortalState.mountedToBody) return;
      const parent = gyroViewportPortalState.homeParent;
      const nextSibling = gyroViewportPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.gyro3dViewport, nextSibling);
        }else{
          parent.appendChild(el.gyro3dViewport);
        }
      }
      gyroViewportPortalState.homeParent = null;
      gyroViewportPortalState.homeNextSibling = null;
      gyroViewportPortalState.mountedToBody = false;
    }

    function updateGyroExpandedViewportBounds(){
      if(!el.gyro3dViewport || !isGyroViewportExpanded()) return;
      const pageWrap = document.querySelector(".page-wrap");
      let left = 0;
      let top = 0;
      let right = 0;
      let bottom = 0;
      if(pageWrap){
        const rect = pageWrap.getBoundingClientRect();
        if(rect.width > 32 && rect.height > 32){
          left = Math.max(0, Math.round(rect.left));
          top = Math.max(0, Math.round(rect.top));
          right = Math.max(0, Math.round(window.innerWidth - rect.right));
          bottom = Math.max(0, Math.round(window.innerHeight - rect.bottom));
        }
      }
      el.gyro3dViewport.style.setProperty("--gyro3d-expand-left", left + "px");
      el.gyro3dViewport.style.setProperty("--gyro3d-expand-top", top + "px");
      el.gyro3dViewport.style.setProperty("--gyro3d-expand-right", right + "px");
      el.gyro3dViewport.style.setProperty("--gyro3d-expand-bottom", bottom + "px");
      el.gyro3dViewport.style.setProperty("position", "fixed", "important");
      el.gyro3dViewport.style.setProperty("left", left + "px", "important");
      el.gyro3dViewport.style.setProperty("top", top + "px", "important");
      el.gyro3dViewport.style.setProperty("right", right + "px", "important");
      el.gyro3dViewport.style.setProperty("bottom", bottom + "px", "important");
      el.gyro3dViewport.style.setProperty("width", "auto", "important");
      el.gyro3dViewport.style.setProperty("height", "auto", "important");
      el.gyro3dViewport.style.setProperty("z-index", "4200", "important");
      el.gyro3dViewport.style.setProperty("border-radius", "0", "important");
      el.gyro3dViewport.style.setProperty("cursor", "grab", "important");

      let hudLeft = window.innerWidth <= 900 ? 12 : 14;
      if(window.innerWidth > 900){
        const sideNavDesktop = document.querySelector(".side-nav-desktop");
        if(sideNavDesktop){
          const navRect = sideNavDesktop.getBoundingClientRect();
          if(navRect.width > 20){
            hudLeft = Math.max(hudLeft, Math.round(navRect.right + 2));
          }
        }
      }
      el.gyro3dViewport.style.setProperty("--gyro3d-hud-left", hudLeft + "px");
    }
    function syncGyroExpandButton(){
      if(!el.gyro3dExpandBtn) return;
      const expanded = isGyroViewportExpanded();
      el.gyro3dExpandBtn.textContent = expanded ? "↙ Close" : "⛶";
      el.gyro3dExpandBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    }

    function setGyroViewportExpanded(on){
      if(!el.gyro3dViewport) return;
      const next = !!on;
      if(next && isStatusMapViewportExpanded()){
        setStatusMapViewportExpanded(false);
      }
      if(next){
        moveGyroViewportToBody();
      }
      el.gyro3dViewport.classList.toggle("is-expanded", next);
      document.documentElement.classList.toggle("gyro3d-expanded", next);
      if(el.gyro3dExpandedHud){
        el.gyro3dExpandedHud.setAttribute("aria-hidden", next ? "false" : "true");
      }
      if(next){
        gyroViewportExpandedAt = Date.now();
        gyroViewportLastTapAt = 0;
        el.gyro3dViewport.style.setProperty("position", "fixed", "important");
        el.gyro3dViewport.style.setProperty("left", "0px", "important");
        el.gyro3dViewport.style.setProperty("top", "0px", "important");
        el.gyro3dViewport.style.setProperty("right", "0px", "important");
        el.gyro3dViewport.style.setProperty("bottom", "0px", "important");
        el.gyro3dViewport.style.setProperty("width", "auto", "important");
        el.gyro3dViewport.style.setProperty("height", "auto", "important");
        el.gyro3dViewport.style.setProperty("z-index", "4200", "important");
        el.gyro3dViewport.style.setProperty("border-radius", "0", "important");
        updateGyroExpandedViewportBounds();
        syncExpandedHud();
      }else{
        gyroViewportExpandedAt = 0;
        gyroViewportLastTapAt = 0;
        el.gyro3dViewport.style.removeProperty("--gyro3d-expand-left");
        el.gyro3dViewport.style.removeProperty("--gyro3d-expand-top");
        el.gyro3dViewport.style.removeProperty("--gyro3d-expand-right");
        el.gyro3dViewport.style.removeProperty("--gyro3d-expand-bottom");
        el.gyro3dViewport.style.removeProperty("--gyro3d-hud-left");
        el.gyro3dViewport.style.removeProperty("position");
        el.gyro3dViewport.style.removeProperty("left");
        el.gyro3dViewport.style.removeProperty("top");
        el.gyro3dViewport.style.removeProperty("right");
        el.gyro3dViewport.style.removeProperty("bottom");
        el.gyro3dViewport.style.removeProperty("width");
        el.gyro3dViewport.style.removeProperty("height");
        el.gyro3dViewport.style.removeProperty("z-index");
        el.gyro3dViewport.style.removeProperty("border-radius");
        el.gyro3dViewport.style.removeProperty("cursor");
        restoreGyroViewportFromBody();
      }
      if(!next){
        gyroCameraState.drag = null;
        setGyroViewportDragActive(false);
      }
      syncGyroExpandButton();
      resizeGyroGl();
    }

    function setGyroViewportDragActive(on){
      if(!el.gyro3dViewport) return;
      el.gyro3dViewport.classList.toggle("is-dragging", !!on);
    }

    function resetGyroCameraPose(resetPan){
      gyroCameraState.yawDeg = GYRO_CAMERA_DEFAULT.yawDeg;
      gyroCameraState.pitchDeg = GYRO_CAMERA_DEFAULT.pitchDeg;
      gyroCameraState.distance = GYRO_CAMERA_DEFAULT.distance;
      gyroCameraState.desiredDistance = GYRO_CAMERA_DEFAULT.distance;
      gyroCameraState.previewRocketX = 0.5;
      gyroCameraState.previewRocketY = 0.5;
      gyroCameraState.previewRocketValid = false;
      gyroCameraState.previewSmoothX = 0.5;
      gyroCameraState.previewSmoothY = 0.5;
      if(resetPan){
        gyroCameraState.panX = 0;
        gyroCameraState.panY = 0;
        gyroCameraState.panZ = 0;
      }
    }

    function getGyroCameraBasis(){
      const yawRad = gyroCameraState.yawDeg * DEG_TO_RAD;
      const pitchRad = clampLocal(gyroCameraState.pitchDeg, -84, 84) * DEG_TO_RAD;
      const cosPitch = Math.cos(pitchRad);
      const orbitDir = [
        Math.sin(yawRad) * cosPitch,
        Math.sin(pitchRad),
        Math.cos(yawRad) * cosPitch
      ];
      const forward = vec3Normalize(vec3Scale(orbitDir, -1));
      let right = vec3Cross(forward, [0,1,0]);
      if(vec3Length(right) < 0.0001) right = [1,0,0];
      right = vec3Normalize(right);
      const up = vec3Normalize(vec3Cross(right, forward));
      return {orbitDir, forward, right, up};
    }
    function panGyroCameraByScreenDelta(dxPx, dyPx){
      const basis = getGyroCameraBasis();
      const pxToWorld = (gyroCameraState.distance * Math.tan((GYRO_FOV_DEG * DEG_TO_RAD) * 0.5) * 2) / Math.max(140, (gyroGl ? gyroGl.height : 240));
      const sx = -dxPx * pxToWorld;
      const sy = dyPx * pxToWorld;
      gyroCameraState.panX += (basis.right[0] * sx) + (basis.up[0] * sy);
      gyroCameraState.panY += (basis.right[1] * sx) + (basis.up[1] * sy);
      gyroCameraState.panZ += (basis.right[2] * sx) + (basis.up[2] * sy);
      const panLen = Math.hypot(gyroCameraState.panX, gyroCameraState.panY, gyroCameraState.panZ);
      if(panLen > GYRO_CAMERA_PAN_LIMIT){
        const ratio = GYRO_CAMERA_PAN_LIMIT / panLen;
        gyroCameraState.panX *= ratio;
        gyroCameraState.panY *= ratio;
        gyroCameraState.panZ *= ratio;
      }
    }
    function panGyroCameraByWorldDelta(dx, dy, dz){
      gyroCameraState.panX += dx;
      gyroCameraState.panY += dy;
      gyroCameraState.panZ += dz;
      const panLen = Math.hypot(gyroCameraState.panX, gyroCameraState.panY, gyroCameraState.panZ);
      if(panLen > GYRO_CAMERA_PAN_LIMIT){
        const ratio = GYRO_CAMERA_PAN_LIMIT / panLen;
        gyroCameraState.panX *= ratio;
        gyroCameraState.panY *= ratio;
        gyroCameraState.panZ *= ratio;
      }
    }

    function isPhoneLandscapeLayout(){
      return document.documentElement.classList.contains("phone-landscape-layout");
    }
    function shouldUseGyro3dPreview(){
      if(isPhoneLandscapeLayout()) return true;
      if(document.documentElement.classList.contains("preview-3d")) return true;
      if(document.documentElement.classList.contains("preview-navball")) return false;
      if(el.gyro3dViewport){
        const style = window.getComputedStyle(el.gyro3dViewport);
        return style.display !== "none" && style.visibility !== "hidden";
      }
      return true;
    }
    function shouldUseNavBallPreview(){
      if(isPhoneLandscapeLayout()) return false;
      if(document.documentElement.classList.contains("preview-navball")) return true;
      if(document.documentElement.classList.contains("preview-3d")) return false;
      if(el.navBallPreview){
        const style = window.getComputedStyle(el.navBallPreview);
        return style.display !== "none" && style.visibility !== "hidden";
      }
      return false;
    }
    function normalizeGyroPreviewMode(mode){
      const raw = String(mode == null ? "" : mode).trim().toLowerCase();
      if(raw === "navball") return "navball";
      if(raw === "3d_basic" || raw === "3dbasic" || raw === "3d-basic") return "3d_basic";
      if(raw === "3d_plus" || raw === "3dplus" || raw === "3d-plus") return "3d";
      return "3d";
    }
    function getGyroPreviewMode(){
      return normalizeGyroPreviewMode(uiSettings && uiSettings.gyroPreview);
    }
    function isGyroPreview3dPlusMode(){
      return getGyroPreviewMode() === "3d";
    }
    function isGyroPreview3dBasicMode(){
      return getGyroPreviewMode() === "3d_basic";
    }
    function isInteractiveViewportTarget(node){
      if(!(node instanceof Element)) return false;
      const closestInteractive = node.closest("button, a, input, select, textarea, label, [role='button'], .js-sidebar-settings, .status-map-btn, .status-gyro-btn");
      if(!closestInteractive) return false;
      if(el.gyro3dViewport && closestInteractive === el.gyro3dViewport) return false;
      return true;
    }

    function bindGyroViewportInteractions(){
      if(gyroViewportBindingsReady || !el.gyro3dViewport) return;
      const view = el.gyro3dViewport;
      const redraw = ()=>{
        if(!gyroGl) return;
        renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
      };
      const closeExpandedMapFromGyro = (ev)=>{
        if(ev){
          ev.preventDefault();
          ev.stopPropagation();
        }
        if(!isStatusMapViewportExpanded()) return;
        setStatusMapViewportExpanded(false);
        redraw();
      };
      if(el.gyro3dExpandBtn){
        const toggleExpandedFromButton = (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          if(isGyroViewportExpanded()){
            setGyroViewportExpanded(false);
          }else{
            setGyroViewportExpanded(true);
          }
          redraw();
        };
        el.gyro3dExpandBtn.addEventListener("pointerdown", toggleExpandedFromButton);
      }
      if(el.gyro3dMapCloseBtn){
        el.gyro3dMapCloseBtn.addEventListener("pointerdown", (ev)=>{
          closeExpandedMapFromGyro(ev);
        });
      }
      const canControl = ()=>{
        return shouldUseGyro3dPreview() && (isGyroViewportExpanded() || isPhoneLandscapeLayout());
      };
      view.addEventListener("click", (ev)=>{
        if(isInteractiveViewportTarget(ev.target)) return;
        if(!shouldUseGyro3dPreview()) return;
        if(isPhoneLandscapeLayout()) return;
        if(!isGyroViewportExpanded()){
          setGyroViewportExpanded(true);
          redraw();
          return;
        }
        if(Date.now() - gyroViewportExpandedAt < 420) return;
        const now = Date.now();
        const dx = (ev.clientX || 0) - gyroViewportLastTapX;
        const dy = (ev.clientY || 0) - gyroViewportLastTapY;
        const isDoubleTap = (now - gyroViewportLastTapAt) < 360 && Math.hypot(dx, dy) < 28;
        gyroViewportLastTapAt = now;
        gyroViewportLastTapX = ev.clientX || 0;
        gyroViewportLastTapY = ev.clientY || 0;
        if(isDoubleTap){
          gyroViewportLastTapAt = 0;
          setGyroViewportExpanded(false);
          redraw();
        }
      });
      view.addEventListener("keydown", (ev)=>{
        if(!shouldUseGyro3dPreview()) return;
        if(isPhoneLandscapeLayout()) return;
        if(ev.key === "Enter" || ev.key === " "){
          ev.preventDefault();
          if(!isGyroViewportExpanded()){
            setGyroViewportExpanded(true);
            redraw();
          }
        }
      });
      document.addEventListener("keydown", (ev)=>{
        if(!isGyroViewportExpanded()) return;
        if(ev.key === "Escape"){
          setGyroViewportExpanded(false);
          redraw();
          return;
        }
        if(!shouldUseGyro3dPreview()) return;
        const activeEl = document.activeElement;
        const tag = activeEl && activeEl.tagName ? activeEl.tagName.toLowerCase() : "";
        if(tag === "input" || tag === "textarea" || tag === "select" || (activeEl && activeEl.isContentEditable)) return;
        const key = ev.key;
        const basis = getGyroCameraBasis();
        const step = (ev.shiftKey ? 0.22 : 0.12) * Math.max(1, gyroCameraState.distance * 0.2);
        let handled = false;
        if(key === "ArrowLeft"){
          panGyroCameraByWorldDelta(-basis.right[0] * step, -basis.right[1] * step, -basis.right[2] * step);
          handled = true;
        }else if(key === "ArrowRight"){
          panGyroCameraByWorldDelta(basis.right[0] * step, basis.right[1] * step, basis.right[2] * step);
          handled = true;
        }else if(key === "ArrowUp"){
          if(ev.shiftKey){
            panGyroCameraByWorldDelta(0, step, 0);
          }else{
            panGyroCameraByWorldDelta(basis.forward[0] * step, basis.forward[1] * step, basis.forward[2] * step);
          }
          handled = true;
        }else if(key === "ArrowDown"){
          if(ev.shiftKey){
            panGyroCameraByWorldDelta(0, -step, 0);
          }else{
            panGyroCameraByWorldDelta(-basis.forward[0] * step, -basis.forward[1] * step, -basis.forward[2] * step);
          }
          handled = true;
        }else if(key === "PageUp"){
          panGyroCameraByWorldDelta(0, step, 0);
          handled = true;
        }else if(key === "PageDown"){
          panGyroCameraByWorldDelta(0, -step, 0);
          handled = true;
        }else if(key === "+" || key === "="){
          gyroCameraState.desiredDistance = clampLocal(gyroCameraState.desiredDistance * 0.9, GYRO_CAMERA_MIN_DISTANCE, GYRO_CAMERA_MAX_DISTANCE);
          handled = true;
        }else if(key === "-" || key === "_"){
          gyroCameraState.desiredDistance = clampLocal(gyroCameraState.desiredDistance * 1.1, GYRO_CAMERA_MIN_DISTANCE, GYRO_CAMERA_MAX_DISTANCE);
          handled = true;
        }else if(key === "0"){
          resetGyroCameraPose(true);
          handled = true;
        }
        if(handled){
          ev.preventDefault();
          redraw();
        }
      });
      view.addEventListener("contextmenu", (ev)=>{
        if(isInteractiveViewportTarget(ev.target)) return;
        if(canControl()) ev.preventDefault();
      });
      view.addEventListener("pointerdown", (ev)=>{
        if(isInteractiveViewportTarget(ev.target)) return;
        if(!shouldUseGyro3dPreview()) return;
        if(!isPhoneLandscapeLayout() && !isGyroViewportExpanded()){
          ev.preventDefault();
          setGyroViewportExpanded(true);
          redraw();
          return;
        }
        if(!canControl()) return;
        if(ev.button !== 0 && ev.button !== 1 && ev.button !== 2) return;
        ev.preventDefault();
        const panMode = (ev.button === 1) || (ev.button === 2) || ev.shiftKey || ev.altKey || ev.ctrlKey;
        gyroCameraState.drag = {
          pointerId: ev.pointerId,
          panMode,
          lastX: ev.clientX,
          lastY: ev.clientY
        };
        setGyroViewportDragActive(true);
        view.setPointerCapture(ev.pointerId);
      });
      view.addEventListener("pointermove", (ev)=>{
        const drag = gyroCameraState.drag;
        if(!drag || drag.pointerId !== ev.pointerId) return;
        ev.preventDefault();
        const dx = ev.clientX - drag.lastX;
        const dy = ev.clientY - drag.lastY;
        drag.lastX = ev.clientX;
        drag.lastY = ev.clientY;
        if(drag.panMode){
          panGyroCameraByScreenDelta(dx, dy);
        }else{
          gyroCameraState.yawDeg -= dx * 0.26;
          gyroCameraState.pitchDeg = clampLocal(gyroCameraState.pitchDeg - (dy * 0.22), -84, 84);
        }
        redraw();
      });
      const endDrag = (ev)=>{
        if(!gyroCameraState.drag) return;
        const drag = gyroCameraState.drag;
        if(ev && drag.pointerId !== ev.pointerId) return;
        gyroCameraState.drag = null;
        setGyroViewportDragActive(false);
        if(ev && view.hasPointerCapture(ev.pointerId)){
          view.releasePointerCapture(ev.pointerId);
        }
      };
      view.addEventListener("pointerup", endDrag);
      view.addEventListener("pointercancel", endDrag);
      view.addEventListener("pointerleave", endDrag);
      view.addEventListener("wheel", (ev)=>{
        if(!canControl()) return;
        ev.preventDefault();
        const factor = Math.exp(ev.deltaY * 0.00125);
        gyroCameraState.desiredDistance = clampLocal(gyroCameraState.desiredDistance * factor, GYRO_CAMERA_MIN_DISTANCE, GYRO_CAMERA_MAX_DISTANCE);
        redraw();
      }, {passive:false});
      view.addEventListener("dblclick", (ev)=>{
        if(isInteractiveViewportTarget(ev.target)) return;
        if(!canControl()) return;
        ev.preventDefault();
        if(Date.now() - gyroViewportExpandedAt < 420) return;
        gyroViewportLastTapAt = 0;
        setGyroViewportExpanded(false);
        redraw();
      });
      const sideNavDesktop = document.querySelector(".side-nav-desktop");
      if(sideNavDesktop){
        const refreshExpandedHudInset = ()=>{
          if(isGyroViewportExpanded()) updateGyroExpandedViewportBounds();
        };
        sideNavDesktop.addEventListener("mouseenter", refreshExpandedHudInset);
        sideNavDesktop.addEventListener("mouseleave", refreshExpandedHudInset);
        sideNavDesktop.addEventListener("transitionend", refreshExpandedHudInset);
      }
      gyroViewportBindingsReady = true;
    }

    function initGyroGl(){
      if(!el.gyroGl) return;
      let gl = null;
      try{
        gl = el.gyroGl.getContext("webgl", {alpha:true, antialias:true, premultipliedAlpha:true});
      }catch(_err){
        gl = null;
      }
      if(!gl) return;

      const lineVs = `
        attribute vec3 aPos;
        attribute vec4 aCol;
        uniform mat4 uMvp;
        varying vec4 vCol;
        void main(){
          gl_Position = uMvp * vec4(aPos, 1.0);
          vCol = aCol;
        }`;
      const lineFs = `
        precision mediump float;
        varying vec4 vCol;
        void main(){
          gl_FragColor = vCol;
        }`;
      const solidVs = `
        attribute vec3 aPos;
        attribute vec3 aNorm;
        attribute vec4 aCol;
        uniform mat4 uModel;
        uniform mat4 uView;
        uniform mat4 uProj;
        uniform vec3 uLightDir;
        uniform float uAmbient;
        varying vec4 vCol;
        varying float vShade;
        varying float vDepth;
        void main(){
          vec4 worldPos = uModel * vec4(aPos, 1.0);
          vec3 worldN = normalize((uModel * vec4(aNorm, 0.0)).xyz);
          float lit = max(dot(worldN, normalize(uLightDir)), 0.0);
          vShade = uAmbient + ((1.0 - uAmbient) * lit);
          vCol = aCol;
          vec4 viewPos = uView * worldPos;
          vDepth = -viewPos.z;
          gl_Position = uProj * viewPos;
        }`;
      const solidFs = `
        precision mediump float;
        varying vec4 vCol;
        varying float vShade;
        varying float vDepth;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        void main(){
          float fogT = clamp((uFogFar - vDepth) / max(0.0001, (uFogFar - uFogNear)), 0.0, 1.0);
          vec3 lit = vCol.rgb * vShade;
          vec3 outCol = mix(uFogColor, lit, fogT);
          gl_FragColor = vec4(outCol, vCol.a);
        }`;

      let lineProg;
      let solidProg;
      try{
        lineProg = createGyroProgram(gl, lineVs, lineFs);
        solidProg = createGyroProgram(gl, solidVs, solidFs);
      }catch(err){
        console.warn("[gyro] shader init failed:", err);
        return;
      }

      const lineGeom = buildGyroLineGeometry();
      const solidGeom = buildGyroSolidGeometry();

      gyroGl = {
        gl,
        canvas: el.gyroGl,
        line: {
          prog: lineProg,
          aPos: gl.getAttribLocation(lineProg, "aPos"),
          aCol: gl.getAttribLocation(lineProg, "aCol"),
          uMvp: gl.getUniformLocation(lineProg, "uMvp"),
          staticPosBuf: createGyroArrayBuffer(gl, lineGeom.pos, gl.STATIC_DRAW),
          staticColBuf: createGyroArrayBuffer(gl, lineGeom.col, gl.STATIC_DRAW),
          trailPosBuf: gl.createBuffer(),
          trailColBuf: gl.createBuffer(),
          headingPosBuf: gl.createBuffer(),
          headingColBuf: gl.createBuffer()
        },
        solid: {
          prog: solidProg,
          aPos: gl.getAttribLocation(solidProg, "aPos"),
          aNorm: gl.getAttribLocation(solidProg, "aNorm"),
          aCol: gl.getAttribLocation(solidProg, "aCol"),
          uModel: gl.getUniformLocation(solidProg, "uModel"),
          uView: gl.getUniformLocation(solidProg, "uView"),
          uProj: gl.getUniformLocation(solidProg, "uProj"),
          uLightDir: gl.getUniformLocation(solidProg, "uLightDir"),
          uAmbient: gl.getUniformLocation(solidProg, "uAmbient"),
          uFogColor: gl.getUniformLocation(solidProg, "uFogColor"),
          uFogNear: gl.getUniformLocation(solidProg, "uFogNear"),
          uFogFar: gl.getUniformLocation(solidProg, "uFogFar"),
          floorPosBuf: createGyroArrayBuffer(gl, solidGeom.floor.pos, gl.STATIC_DRAW),
          floorNormBuf: createGyroArrayBuffer(gl, solidGeom.floor.norm, gl.STATIC_DRAW),
          floorColBuf: createGyroArrayBuffer(gl, solidGeom.floor.col, gl.STATIC_DRAW),
          floorCount: solidGeom.floor.count,
          rocketPosBuf: createGyroArrayBuffer(gl, solidGeom.rocket.pos, gl.STATIC_DRAW),
          rocketNormBuf: createGyroArrayBuffer(gl, solidGeom.rocket.norm, gl.STATIC_DRAW),
          rocketColBuf: createGyroArrayBuffer(gl, solidGeom.rocket.col, gl.STATIC_DRAW),
          rocketCount: solidGeom.rocket.count
        },
        sections: lineGeom.sections,
        proj: mat4Identity(),
        width: 0,
        height: 0
      };
      resetGyroCameraPose(true);
      bindGyroViewportInteractions();
      resizeGyroGl();
      renderGyroGl(0,0,0);
      requestGyroRocketMeshFromStl().then((mesh)=>{
        if(!mesh) return;
        if(!applyGyroRocketMeshToGl(mesh)) return;
        renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
      });
    }

    function resizeGyroGl(){
      if(!gyroGl || !gyroGl.canvas) return;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      let w = Math.round(gyroGl.canvas.clientWidth * dpr);
      let h = Math.round(gyroGl.canvas.clientHeight * dpr);
      if((w <= 0 || h <= 0) && el.gyro3dViewport){
        const fallbackW = Math.round(el.gyro3dViewport.clientWidth * dpr);
        const fallbackH = Math.round(el.gyro3dViewport.clientHeight * dpr);
        if(fallbackW > 0 && fallbackH > 0){
          w = fallbackW;
          h = fallbackH;
        }
      }
      w = Math.max(1, w);
      h = Math.max(1, h);
      if(gyroGl.width === w && gyroGl.height === h) return;
      gyroGl.width = w;
      gyroGl.height = h;
      gyroGl.canvas.width = w;
      gyroGl.canvas.height = h;
      gyroGl.proj = mat4Perspective(GYRO_FOV_DEG * DEG_TO_RAD, w / h, 0.05, 80);
      gyroGl.gl.viewport(0, 0, w, h);
    }

    function resetGyroPathTracking(){
      gyroPathState.originLat = null;
      gyroPathState.originLon = null;
      gyroPathState.originAlt = null;
      gyroPathState.source = "none";
      gyroPathState.gpsOffsetX = 0;
      gyroPathState.gpsOffsetY = 0;
      gyroPathState.gpsOffsetZ = 0;
      gyroPathState.points = [];
      gyroPathState.smoothPath = [];
      gyroPathState.lastFixMs = 0;
      gyroPathState.renderScaleXZ = GYRO_TRAIL_BASE_METERS_PER_UNIT_XZ;
      gyroPathState.renderScaleY = GYRO_TRAIL_BASE_METERS_PER_UNIT_Y;
      gyroPathState.filteredX = null;
      gyroPathState.filteredY = null;
      gyroPathState.filteredZ = null;
      gyroPathState.imuLastMs = 0;
      gyroPathState.imuPosX = 0;
      gyroPathState.imuPosY = 0;
      gyroPathState.imuPosZ = 0;
      gyroPathState.imuVelX = 0;
      gyroPathState.imuVelY = 0;
      gyroPathState.imuVelZ = 0;
      gyroPathState.imuFiltX = 0;
      gyroPathState.imuFiltY = 0;
      gyroPathState.imuFiltZ = 0;
      gyroPathState.imuFiltReady = false;
      gyroPathState.altOffsetY = 0;
      gyroPathState.altAnchorX = 0;
      gyroPathState.altAnchorZ = 0;
      gyroPathState.altGyroLastAlt = NaN;
      gyroPathState.altGyroLastMs = 0;
      gyroPathState.altGyroPosX = 0;
      gyroPathState.altGyroPosZ = 0;
      gyroPathState.altGyroVSpeedMps = 0;
    }

    function getGyroPathLastPoint(){
      const pts = gyroPathState.points;
      return (pts && pts.length) ? pts[pts.length - 1] : null;
    }

    function getGyroPathSourceMeta(){
      const source = String(gyroPathState.source || "none");
      if(source === "gps"){
        return { show:true, label:"PATH GPS", confidence:"HIGH", lowConfidence:false };
      }
      if(source === "alt_gyro"){
        return { show:true, label:"PATH ALT+GYRO", confidence:"LOW", lowConfidence:true };
      }
      if(source === "imu"){
        return { show:true, label:"PATH IMU", confidence:"LOW", lowConfidence:true };
      }
      if(source === "alt"){
        return { show:true, label:"PATH ALT", confidence:"LOW", lowConfidence:true };
      }
      return { show:false, label:"", confidence:"", lowConfidence:false };
    }

    function syncGyroImuAnchorToLatestPoint(){
      const last = getGyroPathLastPoint();
      if(last){
        gyroPathState.imuPosX = last.x;
        gyroPathState.imuPosY = last.y;
        gyroPathState.imuPosZ = last.z;
      }else{
        gyroPathState.imuPosX = 0;
        gyroPathState.imuPosY = 0;
        gyroPathState.imuPosZ = 0;
      }
      gyroPathState.imuVelX = 0;
      gyroPathState.imuVelY = 0;
      gyroPathState.imuVelZ = 0;
      gyroPathState.imuFiltReady = false;
      gyroPathState.imuLastMs = 0;
    }

    function pushGyroPathMeters(eastM, upM, northM, nowMs, opt){
      if(!isFinite(eastM) || !isFinite(upM) || !isFinite(northM)) return false;
      const now = nowMs || Date.now();
      const opts = opt || {};
      const alphaX = clampLocal(isFinite(opts.alphaX) ? opts.alphaX : GYRO_TRAIL_FILTER_ALPHA, 0.01, 1);
      const alphaY = clampLocal(isFinite(opts.alphaY) ? opts.alphaY : GYRO_TRAIL_FILTER_ALPHA_ALT, 0.01, 1);
      const alphaZ = clampLocal(isFinite(opts.alphaZ) ? opts.alphaZ : GYRO_TRAIL_FILTER_ALPHA, 0.01, 1);
      const minStepM = Math.max(0, isFinite(opts.minStepM) ? opts.minStepM : GYRO_TRAIL_MIN_STEP_M);
      const idleHoldMs = Math.max(0, isFinite(opts.idleHoldMs) ? opts.idleHoldMs : GYRO_TRAIL_IDLE_HOLD_MS);
      const idleDriftM = Math.max(0, isFinite(opts.idleDriftM) ? opts.idleDriftM : GYRO_TRAIL_IDLE_DRIFT_M);
      const jumpRejectM = Math.max(0, isFinite(opts.jumpRejectM) ? opts.jumpRejectM : GYRO_TRAIL_JUMP_REJECT_M);
      const jumpRejectMs = Math.max(1, isFinite(opts.jumpRejectMs) ? opts.jumpRejectMs : GYRO_TRAIL_JUMP_REJECT_MS);
      const altDeadband = Math.max(0, isFinite(opts.altDeadbandM) ? opts.altDeadbandM : GYRO_ALTITUDE_DEADBAND_M);

      if(gyroPathState.filteredX == null){
        gyroPathState.filteredX = eastM;
        gyroPathState.filteredY = upM;
        gyroPathState.filteredZ = northM;
      }else{
        gyroPathState.filteredX += (eastM - gyroPathState.filteredX) * alphaX;
        gyroPathState.filteredY += (upM - gyroPathState.filteredY) * alphaY;
        gyroPathState.filteredZ += (northM - gyroPathState.filteredZ) * alphaZ;
      }
      if(Math.abs(gyroPathState.filteredY) < altDeadband){
        gyroPathState.filteredY = 0;
      }
      const next = {
        x: gyroPathState.filteredX,
        y: gyroPathState.filteredY,
        z: gyroPathState.filteredZ,
        ms: now
      };
      const pts = gyroPathState.points;
      const last = pts.length ? pts[pts.length - 1] : null;
      if(last){
        const dx = next.x - last.x;
        const dy = next.y - last.y;
        const dz = next.z - last.z;
        const distSq = (dx * dx) + (dy * dy) + (dz * dz);
        const dtMs = Math.max(1, now - last.ms);
        const jumpRejectSq = jumpRejectM * jumpRejectM;
        if(distSq > jumpRejectSq && dtMs < jumpRejectMs){
          gyroPathState.lastFixMs = now;
          return false;
        }
        const minStepSq = minStepM * minStepM;
        if(distSq < minStepSq && dtMs < idleHoldMs){
          gyroPathState.lastFixMs = now;
          return false;
        }
        if(distSq < (idleDriftM * idleDriftM)){
          gyroPathState.lastFixMs = now;
          return false;
        }
      }
      pts.push(next);
      if(pts.length > GYRO_TRAIL_MAX_POINTS){
        pts.splice(0, pts.length - GYRO_TRAIL_MAX_POINTS);
      }
      gyroPathState.lastFixMs = now;
      return true;
    }

    function updateGyroPathFromGeo(geo, nowMs){
      if(!geo || !isFinite(geo.lat) || !isFinite(geo.lon)) return false;
      const now = nowMs || Date.now();
      const alt = isFinite(geo.alt) ? geo.alt : 0;
      if(gyroPathState.originLat == null || gyroPathState.originLon == null){
        gyroPathState.originLat = geo.lat;
        gyroPathState.originLon = geo.lon;
        gyroPathState.originAlt = alt;
      }
      const latAvg = ((geo.lat + gyroPathState.originLat) * 0.5) * DEG_TO_RAD;
      const rawNorthM = (geo.lat - gyroPathState.originLat) * 111320;
      const rawEastM = (geo.lon - gyroPathState.originLon) * (111320 * Math.cos(latAvg));
      const rawUpM = alt - gyroPathState.originAlt;

      if(gyroPathState.source !== "gps"){
        const last = getGyroPathLastPoint();
        if(last){
          gyroPathState.gpsOffsetX = last.x - rawEastM;
          gyroPathState.gpsOffsetY = last.y - rawUpM;
          gyroPathState.gpsOffsetZ = last.z - rawNorthM;
        }else{
          gyroPathState.gpsOffsetX = 0;
          gyroPathState.gpsOffsetY = 0;
          gyroPathState.gpsOffsetZ = 0;
        }
        gyroPathState.source = "gps";
      }
      const eastM = rawEastM + gyroPathState.gpsOffsetX;
      const upM = rawUpM + gyroPathState.gpsOffsetY;
      const northM = rawNorthM + gyroPathState.gpsOffsetZ;
      const pushed = pushGyroPathMeters(eastM, upM, northM, now, {
        alphaX: GYRO_TRAIL_FILTER_ALPHA,
        alphaY: GYRO_TRAIL_FILTER_ALPHA_ALT,
        alphaZ: GYRO_TRAIL_FILTER_ALPHA,
        minStepM: GYRO_TRAIL_MIN_STEP_M,
        idleHoldMs: GYRO_TRAIL_IDLE_HOLD_MS,
        idleDriftM: GYRO_TRAIL_IDLE_DRIFT_M,
        jumpRejectM: GYRO_TRAIL_JUMP_REJECT_M,
        jumpRejectMs: GYRO_TRAIL_JUMP_REJECT_MS,
        altDeadbandM: GYRO_ALTITUDE_DEADBAND_M
      });
      if(pushed){
        gyroPathState.imuPosX = eastM;
        gyroPathState.imuPosY = upM;
        gyroPathState.imuPosZ = northM;
      }
      return pushed;
    }

    function updateGyroPathFromImuSample(sample, nowMs){
      if(!sample) return false;
      const now = nowMs || Date.now();
      const ax = Number(sample.ax);
      const ay = Number(sample.ay);
      const az = Number(sample.az);
      if(!isFinite(ax) || !isFinite(ay) || !isFinite(az)) return false;
      const accNorm = Math.hypot(ax, ay, az);
      if(!isFinite(accNorm) || accNorm < 0.18 || accNorm > 5) return false;

      if(gyroPathState.source !== "imu"){
        gyroPathState.source = "imu";
        syncGyroImuAnchorToLatestPoint();
        gyroPathState.imuLastMs = now;
        return false;
      }

      const dtSec = (gyroPathState.imuLastMs > 0) ? ((now - gyroPathState.imuLastMs) / 1000) : 0;
      gyroPathState.imuLastMs = now;
      if(!isFinite(dtSec) || dtSec <= 0 || dtSec > GYRO_IMU_MAX_DT_SEC) return false;

      const rollRad = gyroRollDeg * DEG_TO_RAD;
      const pitchRad = gyroPitchDeg * DEG_TO_RAD;
      const gravX = -Math.sin(pitchRad);
      const gravY = Math.sin(rollRad) * Math.cos(pitchRad);
      const gravZ = Math.cos(rollRad) * Math.cos(pitchRad);
      const linX = ax - gravX;
      const linY = ay - gravY;
      const linZ = az - gravZ;

      if(!gyroPathState.imuFiltReady){
        gyroPathState.imuFiltX = linX;
        gyroPathState.imuFiltY = linY;
        gyroPathState.imuFiltZ = linZ;
        gyroPathState.imuFiltReady = true;
      }else{
        const a = GYRO_IMU_ACCEL_FILTER_ALPHA;
        gyroPathState.imuFiltX += (linX - gyroPathState.imuFiltX) * a;
        gyroPathState.imuFiltY += (linY - gyroPathState.imuFiltY) * a;
        gyroPathState.imuFiltZ += (linZ - gyroPathState.imuFiltZ) * a;
      }
      let accForwardG = gyroPathState.imuFiltX;
      let accRightG = gyroPathState.imuFiltY;
      let accUpG = gyroPathState.imuFiltZ;
      if(Math.abs(accForwardG) < GYRO_IMU_ACCEL_DEADBAND_G) accForwardG = 0;
      if(Math.abs(accRightG) < GYRO_IMU_ACCEL_DEADBAND_G) accRightG = 0;
      if(Math.abs(accUpG) < (GYRO_IMU_ACCEL_DEADBAND_G * 0.8)) accUpG = 0;
      accForwardG = clampLocal(accForwardG, -GYRO_IMU_ACCEL_CLAMP_G, GYRO_IMU_ACCEL_CLAMP_G);
      accRightG = clampLocal(accRightG, -GYRO_IMU_ACCEL_CLAMP_G, GYRO_IMU_ACCEL_CLAMP_G);
      accUpG = clampLocal(accUpG, -GYRO_IMU_ACCEL_CLAMP_G, GYRO_IMU_ACCEL_CLAMP_G);

      const yawRad = gyroYawDeg * DEG_TO_RAD;
      const sinY = Math.sin(yawRad);
      const cosY = Math.cos(yawRad);
      const accForward = accForwardG * GYRO_IMU_GRAVITY_MPS2;
      const accRight = accRightG * GYRO_IMU_GRAVITY_MPS2;
      const accUp = accUpG * GYRO_IMU_GRAVITY_MPS2;
      const accWorldX = (sinY * accForward) + (cosY * accRight);
      const accWorldZ = (cosY * accForward) - (sinY * accRight);
      const accWorldY = accUp;
      const accelMag = Math.hypot(accWorldX, accWorldY, accWorldZ);
      const stateVal = Number(sample.st != null ? sample.st : (sample.state ?? currentSt));
      const moving = (stateVal === 2) || (accelMag > GYRO_IMU_ACTIVE_ACCEL_MPS2);
      const drag = moving ? GYRO_IMU_DRAG_ACTIVE : GYRO_IMU_DRAG_IDLE;
      const damp = Math.exp(-drag * dtSec);

      gyroPathState.imuVelX = (gyroPathState.imuVelX + (accWorldX * dtSec)) * damp;
      gyroPathState.imuVelY = (gyroPathState.imuVelY + (accWorldY * dtSec)) * damp;
      gyroPathState.imuVelZ = (gyroPathState.imuVelZ + (accWorldZ * dtSec)) * damp;
      if(Math.abs(gyroPathState.imuVelX) < GYRO_IMU_VEL_EPS_MPS) gyroPathState.imuVelX = 0;
      if(Math.abs(gyroPathState.imuVelY) < GYRO_IMU_VEL_EPS_MPS) gyroPathState.imuVelY = 0;
      if(Math.abs(gyroPathState.imuVelZ) < GYRO_IMU_VEL_EPS_MPS) gyroPathState.imuVelZ = 0;

      gyroPathState.imuPosX += gyroPathState.imuVelX * dtSec;
      gyroPathState.imuPosY += gyroPathState.imuVelY * dtSec;
      gyroPathState.imuPosZ += gyroPathState.imuVelZ * dtSec;
      const horizLen = Math.hypot(gyroPathState.imuPosX, gyroPathState.imuPosZ);
      if(horizLen > GYRO_IMU_RANGE_LIMIT_M){
        const ratio = GYRO_IMU_RANGE_LIMIT_M / horizLen;
        gyroPathState.imuPosX *= ratio;
        gyroPathState.imuPosZ *= ratio;
      }
      gyroPathState.imuPosY = clampLocal(gyroPathState.imuPosY, GYRO_IMU_ALT_MIN_M, GYRO_IMU_ALT_MAX_M);

      return pushGyroPathMeters(
        gyroPathState.imuPosX,
        gyroPathState.imuPosY,
        gyroPathState.imuPosZ,
        now,
        
        {
          alphaX: 0.44,
          alphaY: 0.56,
          alphaZ: 0.44,
          minStepM: GYRO_TRAIL_MIN_STEP_M_IMU,
          idleHoldMs: GYRO_TRAIL_IDLE_HOLD_MS_IMU,
          idleDriftM: GYRO_TRAIL_IDLE_DRIFT_M_IMU,
          jumpRejectM: GYRO_TRAIL_JUMP_REJECT_M_IMU,
          jumpRejectMs: GYRO_TRAIL_JUMP_REJECT_MS_IMU,
          altDeadbandM: 0.012
        }
      );
    }

    function updateGyroPathFromAltGyro(altitudeM, nowMs){
      if(!isFinite(altitudeM)) return false;
      const now = nowMs || Date.now();
      const last = getGyroPathLastPoint();

      if(gyroPathState.source !== "alt_gyro"){
        if(last){
          gyroPathState.altGyroPosX = last.x;
          gyroPathState.altGyroPosZ = last.z;
          gyroPathState.altOffsetY = last.y - altitudeM;
        }else{
          gyroPathState.altGyroPosX = 0;
          gyroPathState.altGyroPosZ = 0;
          gyroPathState.altOffsetY = 0;
        }
        gyroPathState.altGyroLastAlt = altitudeM;
        gyroPathState.altGyroLastMs = now;
        gyroPathState.altGyroVSpeedMps = 0;
        gyroPathState.source = "alt_gyro";
      }else{
        const dtSec = (gyroPathState.altGyroLastMs > 0) ? ((now - gyroPathState.altGyroLastMs) / 1000) : 0;
        const dAlt = altitudeM - gyroPathState.altGyroLastAlt;
        gyroPathState.altGyroLastAlt = altitudeM;
        gyroPathState.altGyroLastMs = now;

        if(isFinite(dtSec) && dtSec >= GYRO_ALTGYRO_MIN_DT_SEC && dtSec <= GYRO_ALTGYRO_MAX_DT_SEC){
          let verticalSpeedMps = dAlt / dtSec;
          if(!isFinite(verticalSpeedMps)) verticalSpeedMps = 0;
          const a = GYRO_ALTGYRO_VSPEED_FILTER_ALPHA;
          gyroPathState.altGyroVSpeedMps += (verticalSpeedMps - gyroPathState.altGyroVSpeedMps) * a;

          if(gyroAttitudeReady){
            const pitchRad = gyroPitchDeg * DEG_TO_RAD;
            const yawRad = gyroYawDeg * DEG_TO_RAD;
            const sinPitchAbs = Math.max(GYRO_ALTGYRO_MIN_SIN_PITCH, Math.abs(Math.sin(pitchRad)));
            const cosPitchAbs = Math.abs(Math.cos(pitchRad));
            let hSpeedMps = Math.abs(gyroPathState.altGyroVSpeedMps) * (cosPitchAbs / sinPitchAbs);
            if(Math.abs(gyroPathState.altGyroVSpeedMps) < 0.08) hSpeedMps *= 0.15;
            hSpeedMps = clampLocal(hSpeedMps, 0, GYRO_ALTGYRO_MAX_HSPEED_MPS);
            const hDist = hSpeedMps * dtSec;
            if(hDist > 0){
              const sinY = Math.sin(yawRad);
              const cosY = Math.cos(yawRad);
              gyroPathState.altGyroPosX += sinY * hDist;
              gyroPathState.altGyroPosZ += cosY * hDist;
              const horizLen = Math.hypot(gyroPathState.altGyroPosX, gyroPathState.altGyroPosZ);
              if(horizLen > GYRO_IMU_RANGE_LIMIT_M){
                const ratio = GYRO_IMU_RANGE_LIMIT_M / horizLen;
                gyroPathState.altGyroPosX *= ratio;
                gyroPathState.altGyroPosZ *= ratio;
              }
            }
          }
        }
      }

      const pushed = pushGyroPathMeters(
        gyroPathState.altGyroPosX,
        altitudeM + gyroPathState.altOffsetY,
        gyroPathState.altGyroPosZ,
        now,
        {
          alphaX: 0.26,
          alphaY: 0.34,
          alphaZ: 0.26,
          minStepM: 0.03,
          idleHoldMs: 90,
          idleDriftM: 0.01,
          jumpRejectM: 180,
          jumpRejectMs: 2400,
          altDeadbandM: 0.008
        }
      );
      if(pushed){
        gyroPathState.imuPosX = gyroPathState.altGyroPosX;
        gyroPathState.imuPosY = altitudeM + gyroPathState.altOffsetY;
        gyroPathState.imuPosZ = gyroPathState.altGyroPosZ;
      }
      return pushed;
    }

    function updateGyroAttitudeEstimate(axRaw, ayRaw, azRaw, gxRaw, gyRaw, gzRaw, nowMs){
      const now = nowMs || Date.now();
      const ax = isFinite(axRaw) ? Number(axRaw) : 0;
      const ay = isFinite(ayRaw) ? Number(ayRaw) : 0;
      const az = isFinite(azRaw) ? Number(azRaw) : 0;
      const gx = isFinite(gxRaw) ? Number(gxRaw) : 0;
      const gy = isFinite(gyRaw) ? Number(gyRaw) : 0;
      const gz = isFinite(gzRaw) ? Number(gzRaw) : 0;
      let dtSec = (gyroAttitudeLastMs > 0) ? ((now - gyroAttitudeLastMs) / 1000) : 0;
      if(!isFinite(dtSec) || dtSec < 0 || dtSec > 0.35) dtSec = 0;
      gyroAttitudeLastMs = now;

      const accelNorm = Math.hypot(ax, ay, az);
      const accelRollDeg = Math.atan2(ay, az) * RAD_TO_DEG;
      const accelPitchDeg = Math.atan2(-ax, Math.sqrt((ay * ay) + (az * az))) * RAD_TO_DEG;

      if(!gyroAttitudeReady){
        if(!isFinite(accelNorm) || accelNorm < 0.18 || accelNorm > 5) return;
        gyroRollDeg = normalizeAngleDeg(accelRollDeg);
        gyroPitchDeg = clampLocal(accelPitchDeg, -89.5, 89.5);
        gyroYawDeg = normalizeAngleDeg(gyroYawDeg);
        gyroAttitudeQuat = quatFromRenderEuler(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        gyroAttitudeReady = true;
        return;
      }

      if(dtSec > 0){
        const omegaLocal = [
          -(gy * DEG_TO_RAD),
          (gz * DEG_TO_RAD),
          (gx * DEG_TO_RAD)
        ];
        const omegaMag = Math.hypot(omegaLocal[0], omegaLocal[1], omegaLocal[2]);
        if(omegaMag > 1e-6){
          const dq = quatFromAxisAngle([
            omegaLocal[0] / omegaMag,
            omegaLocal[1] / omegaMag,
            omegaLocal[2] / omegaMag
          ], omegaMag * dtSec);
          gyroAttitudeQuat = quatNormalize(quatMul(gyroAttitudeQuat, dq));
        }
        gyroRollDeg = normalizeAngleDeg(gyroRollDeg + (gx * dtSec));
        gyroPitchDeg = clampLocal(gyroPitchDeg + (gy * dtSec), -89.5, 89.5);
        gyroYawDeg = normalizeAngleDeg(gyroYawDeg + (gz * dtSec));
      }

      if(accelNorm > 0.01){
        const gravityErr = Math.abs(accelNorm - 1);
        const rateMag = Math.hypot(gx, gy, gz);
        const trustFromG = 1 - clampLocal((gravityErr - 0.02) / GYRO_ATTITUDE_ACCEL_UNTRUSTED_ERR_G, 0, 1);
        const trustFromRate = 1 - clampLocal((rateMag - 10) / GYRO_ATTITUDE_RATE_UNTRUSTED_DPS, 0, 1);
        const trust = clampLocal(trustFromG * trustFromRate, 0, 1);
        const baseBlend = simEnabled ? GYRO_ATTITUDE_ACCEL_BLEND_SIM : GYRO_ATTITUDE_ACCEL_BLEND;
        const blend = baseBlend * trust;
        if(blend > 0.0005){
          gyroRollDeg = lerpAngleDeg(gyroRollDeg, accelRollDeg, blend);
          gyroPitchDeg = clampLocal(gyroPitchDeg + ((accelPitchDeg - gyroPitchDeg) * blend), -89.5, 89.5);
        }
      }
    }

    function applyFirmwareGyroAttitudeEstimate(rollRaw, pitchRaw, yawRaw, nowMs){
      const rollDeg = isFinite(rollRaw) ? Number(rollRaw) : NaN;
      const pitchDeg = isFinite(pitchRaw) ? Number(pitchRaw) : NaN;
      const yawDeg = isFinite(yawRaw) ? Number(yawRaw) : NaN;
      if(!isFinite(rollDeg) || !isFinite(pitchDeg) || !isFinite(yawDeg)) return false;
      gyroRollDeg = normalizeAngleDeg(rollDeg);
      gyroPitchDeg = clampLocal(pitchDeg, -89.5, 89.5);
      gyroYawDeg = normalizeAngleDeg(yawDeg);
      gyroAttitudeQuat = quatFromRenderEuler(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
      gyroAttitudeReady = true;
      gyroAttitudeLastMs = nowMs || Date.now();
      return true;
    }

    function getGyroPathRenderData(){
      const baseResult = {
        current: {x:0, y:GYRO_WORLD_ALTITUDE_BASE, z:0},
        trailPos: [],
        trailCol: [],
        trailGlowCol: [],
        trailAuraCol: [],
        trailHotCol: [],
        trailWorldPoints: [],
        trailVertexCount: 0,
        gridSpan: GYRO_GRID_MIN_SPAN,
        gridCenter: {x:0, z:0},
        lookTarget: {x:0, y:GYRO_WORLD_ALTITUDE_BASE, z:0},
        cameraDistance: GYRO_CAMERA_DEFAULT.distance
      };
      const pts = gyroPathState.points;
      if(!pts || !pts.length){
        gyroPathState.renderScaleXZ += (GYRO_TRAIL_BASE_METERS_PER_UNIT_XZ - gyroPathState.renderScaleXZ) * GYRO_TRAIL_ZOOM_IN_SMOOTH;
        gyroPathState.renderScaleY += (GYRO_TRAIL_BASE_METERS_PER_UNIT_Y - gyroPathState.renderScaleY) * GYRO_TRAIL_ZOOM_IN_SMOOTH;
        gyroPathState.smoothPath = [];
        return baseResult;
      }

      const subset = pts.slice(Math.max(0, pts.length - GYRO_TRAIL_MAX_POINTS));
      const currentRaw = subset[subset.length - 1];
      let maxAbsX = 0;
      let maxAbsY = 0;
      let maxAbsZ = 0;
      for(let i=0;i<subset.length;i++){
        const p = subset[i];
        maxAbsX = Math.max(maxAbsX, Math.abs(p.x));
        maxAbsY = Math.max(maxAbsY, Math.abs(p.y));
        maxAbsZ = Math.max(maxAbsZ, Math.abs(p.z));
      }
      const targetScaleXZ = Math.max(
        GYRO_TRAIL_BASE_METERS_PER_UNIT_XZ,
        maxAbsX / GYRO_TRAIL_HALF_SPAN_XZ,
        maxAbsZ / GYRO_TRAIL_HALF_SPAN_XZ
      );
      const targetScaleY = Math.max(
        GYRO_TRAIL_BASE_METERS_PER_UNIT_Y,
        maxAbsY / GYRO_TRAIL_HALF_SPAN_Y
      );
      const smoothXZ = (targetScaleXZ > gyroPathState.renderScaleXZ) ? GYRO_TRAIL_ZOOM_OUT_SMOOTH : GYRO_TRAIL_ZOOM_IN_SMOOTH;
      const smoothY = (targetScaleY > gyroPathState.renderScaleY) ? GYRO_TRAIL_ZOOM_OUT_SMOOTH : GYRO_TRAIL_ZOOM_IN_SMOOTH;
      gyroPathState.renderScaleXZ += (targetScaleXZ - gyroPathState.renderScaleXZ) * smoothXZ;
      gyroPathState.renderScaleY += (targetScaleY - gyroPathState.renderScaleY) * smoothY;

      const worldPoints = subset.map((p)=>({
        x: p.x / gyroPathState.renderScaleXZ,
        y: GYRO_WORLD_ALTITUDE_BASE + (p.y / gyroPathState.renderScaleY),
        z: p.z / gyroPathState.renderScaleXZ
      }));
      const currentWorld = {
        x: currentRaw.x / gyroPathState.renderScaleXZ,
        y: GYRO_WORLD_ALTITUDE_BASE + (currentRaw.y / gyroPathState.renderScaleY),
        z: currentRaw.z / gyroPathState.renderScaleXZ
      };
      if(worldPoints.length) worldPoints[worldPoints.length - 1] = currentWorld;

      const smoothPath = [];
      if(worldPoints.length){
        smoothPath.push(worldPoints[0]);
      }
      for(let i=1;i<worldPoints.length;i++){
        const prev = worldPoints[i - 1];
        const cur = worldPoints[i];
        const segLen = Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
        const steps = clampLocal(Math.round(segLen * 4), 1, 4);
        for(let s=1;s<=steps;s++){
          const t = s / steps;
          smoothPath.push({
            x: prev.x + ((cur.x - prev.x) * t),
            y: prev.y + ((cur.y - prev.y) * t),
            z: prev.z + ((cur.z - prev.z) * t)
          });
        }
      }
      gyroPathState.smoothPath = smoothPath;

      const trailPos = [];
      const trailCol = [];
      const trailGlowCol = [];
      const trailAuraCol = [];
      const trailHotCol = [];
      const trailR = 0.98;
      const trailG = 0.24;
      const trailB = 0.2;
      let minWX = Infinity, minWY = Infinity, minWZ = Infinity;
      let maxWX = -Infinity, maxWY = -Infinity, maxWZ = -Infinity;
      for(let i=0;i<smoothPath.length;i++){
        const p = smoothPath[i];
        trailPos.push(p.x, p.y, p.z);
        trailCol.push(trailR, trailG, trailB, 0.98);
        trailGlowCol.push(trailR, trailG, trailB, 0.92);
        trailAuraCol.push(trailR, trailG, trailB, 0.86);
        trailHotCol.push(trailR, trailG, trailB, 0.84);
        if(p.x < minWX) minWX = p.x;
        if(p.y < minWY) minWY = p.y;
        if(p.z < minWZ) minWZ = p.z;
        if(p.x > maxWX) maxWX = p.x;
        if(p.y > maxWY) maxWY = p.y;
        if(p.z > maxWZ) maxWZ = p.z;
      }

      if(!isFinite(minWX)){
        minWX = maxWX = 0;
        minWY = maxWY = GYRO_WORLD_ALTITUDE_BASE;
        minWZ = maxWZ = 0;
      }
      const centerX = (minWX + maxWX) * 0.5;
      const centerY = (minWY + maxWY) * 0.5;
      const centerZ = (minWZ + maxWZ) * 0.5;
      const extent = Math.max(
        Math.abs(minWX), Math.abs(maxWX),
        Math.abs(minWZ), Math.abs(maxWZ),
        0.45
      );
      const gridSpan = clampLocal(extent * 6.8, GYRO_GRID_MIN_SPAN, GYRO_GRID_MAX_SPAN);
      const heightSpread = Math.max(0.12, maxWY - minWY);
      const cameraDistance = clampLocal(3.1 + (extent * 1.2) + (heightSpread * 0.55), GYRO_CAMERA_MIN_DISTANCE + 0.15, GYRO_CAMERA_MAX_DISTANCE - 2.2);
      const lookTargetYMin = GYRO_WORLD_ALTITUDE_BASE + 0.08;
      const lookTargetYMax = Math.max(2.65, currentWorld.y + 0.42);
      const lookTarget = {
        x: clampLocal(centerX * 0.4, -1.45, 1.45),
        y: clampLocal(centerY + ((currentWorld.y - centerY) * 0.5), lookTargetYMin, lookTargetYMax),
        z: clampLocal(centerZ * 0.4, -1.45, 1.45)
      };
      return {
        current: currentWorld,
        trailPos,
        trailCol,
        trailGlowCol,
        trailAuraCol,
        trailHotCol,
        trailWorldPoints: smoothPath,
        trailVertexCount: Math.floor(trailPos.length / 3),
        gridSpan,
        gridCenter: {
          x: clampLocal(centerX * 0.2, -(gridSpan * 0.16), gridSpan * 0.16),
          z: clampLocal(centerZ * 0.2, -(gridSpan * 0.16), gridSpan * 0.16)
        },
        lookTarget,
        cameraDistance
      };
    }

    function bindLineAttributes(posBuf, colBuf){
      const gl = gyroGl.gl;
      const line = gyroGl.line;
      gl.useProgram(line.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(line.aPos);
      gl.vertexAttribPointer(line.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.enableVertexAttribArray(line.aCol);
      gl.vertexAttribPointer(line.aCol, 4, gl.FLOAT, false, 0, 0);
    }

    function drawLineBatch(posBuf, colBuf, mode, count, mvp){
      if(!count || count < 2) return;
      const gl = gyroGl.gl;
      bindLineAttributes(posBuf, colBuf);
      gl.uniformMatrix4fv(gyroGl.line.uMvp, false, new Float32Array(mvp));
      gl.drawArrays(mode, 0, count);
    }

    function bindSolidAttributes(posBuf, normBuf, colBuf){
      const gl = gyroGl.gl;
      const solid = gyroGl.solid;
      gl.useProgram(solid.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(solid.aPos);
      gl.vertexAttribPointer(solid.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
      gl.enableVertexAttribArray(solid.aNorm);
      gl.vertexAttribPointer(solid.aNorm, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.enableVertexAttribArray(solid.aCol);
      gl.vertexAttribPointer(solid.aCol, 4, gl.FLOAT, false, 0, 0);
    }

    function drawSolidBatch(posBuf, normBuf, colBuf, count, model, view, style){
      if(!count || count < 3) return;
      const gl = gyroGl.gl;
      const solid = gyroGl.solid;
      bindSolidAttributes(posBuf, normBuf, colBuf);
      const fogColor = (style && style.fogColor) ? style.fogColor : [0.035, 0.055, 0.09];
      const fogNear = (style && isFinite(style.fogNear)) ? style.fogNear : 4.8;
      const fogFar = (style && isFinite(style.fogFar)) ? style.fogFar : 34;
      const ambient = (style && isFinite(style.ambient)) ? style.ambient : 0.34;
      const lightDir = (style && style.lightDir) ? style.lightDir : [0.34, 0.88, 0.29];
      gl.uniformMatrix4fv(solid.uModel, false, new Float32Array(model));
      gl.uniformMatrix4fv(solid.uView, false, new Float32Array(view));
      gl.uniformMatrix4fv(solid.uProj, false, new Float32Array(gyroGl.proj));
      gl.uniform3f(solid.uLightDir, lightDir[0], lightDir[1], lightDir[2]);
      gl.uniform1f(solid.uAmbient, ambient);
      gl.uniform3f(solid.uFogColor, fogColor[0], fogColor[1], fogColor[2]);
      gl.uniform1f(solid.uFogNear, fogNear);
      gl.uniform1f(solid.uFogFar, fogFar);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }
    function buildGyroTrailRibbonGeometry(points, eye, width, colorFn){
      const outPos = [];
      const outCol = [];
      if(!points || points.length < 2) return {pos:outPos, col:outCol, count:0};
      const halfW = Math.max(0.0005, Number(width) || 0.01);
      const total = points.length;
      for(let i=0;i<total;i++){
        const cur = points[i];
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(total - 1, i + 1)];
        const p = [cur.x, cur.y, cur.z];
        const tangent = vec3Normalize([next.x - prev.x, next.y - prev.y, next.z - prev.z]);
        let toEye = vec3Normalize([eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]]);
        let side = vec3Cross(toEye, tangent);
        let sideLen = vec3Length(side);
        if(sideLen < 1e-5){
          side = vec3Cross([0,1,0], tangent);
          sideLen = vec3Length(side);
        }
        if(sideLen < 1e-5){
          side = [1,0,0];
          sideLen = 1;
        }
        const s = halfW / sideLen;
        const off = [side[0] * s, side[1] * s, side[2] * s];
        const t = (total <= 1) ? 0 : (i / (total - 1));
        const rgba = (typeof colorFn === "function") ? (colorFn(t, i, total) || [1,1,1,1]) : [1,1,1,1];
        outPos.push(p[0] - off[0], p[1] - off[1], p[2] - off[2]);
        outCol.push(rgba[0], rgba[1], rgba[2], rgba[3]);
        outPos.push(p[0] + off[0], p[1] + off[1], p[2] + off[2]);
        outCol.push(rgba[0], rgba[1], rgba[2], rgba[3]);
      }
      return {pos:outPos, col:outCol, count:Math.floor(outPos.length / 3)};
    }
    function buildGyroTrailArrowGeometry(points, eye){
      const outPos = [];
      const outCol = [];
      if(!points || points.length < 7) return {pos:outPos, col:outCol, count:0};
      const step = clampLocal(Math.floor(points.length / 8), 10, 28);
      for(let i=(step + 1); i<(points.length - 2); i+=step){
        const cur = points[i];
        const prev = points[Math.max(0, i - 2)];
        const next = points[Math.min(points.length - 1, i + 2)];
        const p = [cur.x, cur.y, cur.z];
        const tangent = vec3Normalize([next.x - prev.x, next.y - prev.y, next.z - prev.z]);
        let toEye = vec3Normalize([eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]]);
        let side = vec3Cross(toEye, tangent);
        let sideLen = vec3Length(side);
        if(sideLen < 1e-5){
          side = vec3Cross([0,1,0], tangent);
          sideLen = vec3Length(side);
        }
        if(sideLen < 1e-5){
          side = [1,0,0];
          sideLen = 1;
        }
        const nx = side[0] / sideLen;
        const ny = side[1] / sideLen;
        const nz = side[2] / sideLen;
        const t = i / Math.max(1, points.length - 1);
        const base = 0.01 + (0.005 * t);
        const tip = [
          p[0] + (tangent[0] * base * 1.95),
          p[1] + (tangent[1] * base * 1.95),
          p[2] + (tangent[2] * base * 1.95)
        ];
        const left = [
          p[0] - (tangent[0] * base * 0.62) + (nx * base),
          p[1] - (tangent[1] * base * 0.62) + (ny * base),
          p[2] - (tangent[2] * base * 0.62) + (nz * base)
        ];
        const right = [
          p[0] - (tangent[0] * base * 0.62) - (nx * base),
          p[1] - (tangent[1] * base * 0.62) - (ny * base),
          p[2] - (tangent[2] * base * 0.62) - (nz * base)
        ];
        outPos.push(
          tip[0], tip[1], tip[2],
          left[0], left[1], left[2],
          right[0], right[1], right[2]
        );
        const alpha = 0.34 + (0.42 * t);
        for(let k=0;k<3;k++){
          outCol.push(1, 1, 1, alpha);
        }
      }
      return {pos:outPos, col:outCol, count:Math.floor(outPos.length / 3)};
    }

    function renderGyroGl(pitchDeg, yawDeg, rollDeg){
      if(!gyroGl) return;
      yawDeg = getGyroDisplayYawDeg(yawDeg);
      resizeGyroGl();
      const gl = gyroGl.gl;
      const pathRender = getGyroPathRenderData();
      const previewMode = getGyroPreviewMode();
      const showWorldDecor = (previewMode === "3d");
      const simpleRocketPos = {x:0, y:GYRO_WORLD_ALTITUDE_BASE + 0.34, z:0};
      const rocketRenderPos = showWorldDecor ? pathRender.current : simpleRocketPos;
      const lookTargetSource = showWorldDecor
        ? pathRender.lookTarget
        : {x:0, y:GYRO_WORLD_ALTITUDE_BASE + 0.46, z:0};
      const inExpanded = isGyroViewportExpanded();
      if(inExpanded){
        updateGyroExpandedViewportBounds();
        resizeGyroGl();
      }
      const darkTheme = document.documentElement.getAttribute("data-theme") === "dark";
      const renderStyle = darkTheme ? {
        fogColor:[0.035,0.055,0.09],
        fogNear:4.8,
        fogFar:34,
        ambient:0.34,
        lightDir:[0.34,0.88,0.29],
        clear:[0.02,0.03,0.05,0.96]
      } : {
        fogColor:[0.76,0.82,0.89],
        fogNear:5.2,
        fogFar:36,
        ambient:0.4,
        lightDir:[0.25,0.92,0.24],
        clear:[0.84,0.89,0.95,0.98]
      };

      if(!inExpanded){
        const panDamp = showWorldDecor ? 0.88 : 0.82;
        const autoDistance = showWorldDecor ? pathRender.cameraDistance : (GYRO_CAMERA_DEFAULT.distance + 0.34);
        const distanceEase = showWorldDecor ? 0.1 : 0.16;
        gyroCameraState.panX *= panDamp;
        gyroCameraState.panY *= panDamp;
        gyroCameraState.panZ *= panDamp;
        gyroCameraState.desiredDistance += (autoDistance - gyroCameraState.desiredDistance) * distanceEase;
      }
      gyroCameraState.desiredDistance = clampLocal(gyroCameraState.desiredDistance, GYRO_CAMERA_MIN_DISTANCE, GYRO_CAMERA_MAX_DISTANCE);
      gyroCameraState.distance += (gyroCameraState.desiredDistance - gyroCameraState.distance) * GYRO_CAMERA_DISTANCE_SMOOTH;

      const targetX = lookTargetSource.x + gyroCameraState.panX;
      const targetY = lookTargetSource.y + gyroCameraState.panY;
      const targetZ = lookTargetSource.z + gyroCameraState.panZ;
      gyroCameraState.targetX += (targetX - gyroCameraState.targetX) * GYRO_CAMERA_TARGET_SMOOTH;
      gyroCameraState.targetY += (targetY - gyroCameraState.targetY) * GYRO_CAMERA_TARGET_SMOOTH;
      gyroCameraState.targetZ += (targetZ - gyroCameraState.targetZ) * GYRO_CAMERA_TARGET_SMOOTH;

      const basis = getGyroCameraBasis();
      const eye = [
        gyroCameraState.targetX + (basis.orbitDir[0] * gyroCameraState.distance),
        gyroCameraState.targetY + (basis.orbitDir[1] * gyroCameraState.distance),
        gyroCameraState.targetZ + (basis.orbitDir[2] * gyroCameraState.distance)
      ];
      const center = [gyroCameraState.targetX, gyroCameraState.targetY, gyroCameraState.targetZ];
      const view = mat4LookAt(eye, center, [0,1,0]);
      const viewProj = mat4Mul(gyroGl.proj, view);
      const rocketClip = mat4TransformVec4(
        viewProj,
        rocketRenderPos.x,
        rocketRenderPos.y,
        rocketRenderPos.z,
        1
      );
      const clipW = rocketClip[3];
      if(isFinite(clipW) && Math.abs(clipW) > 1e-5){
        const invW = 1 / clipW;
        const ndcX = rocketClip[0] * invW;
        const ndcY = rocketClip[1] * invW;
        gyroCameraState.previewRocketX = clampLocal((ndcX * 0.5) + 0.5, -0.5, 1.5);
        gyroCameraState.previewRocketY = clampLocal(0.5 - (ndcY * 0.5), -0.5, 1.5);
        gyroCameraState.previewRocketValid = true;
      }else{
        gyroCameraState.previewRocketValid = false;
      }

      gl.clearColor(renderStyle.clear[0], renderStyle.clear[1], renderStyle.clear[2], renderStyle.clear[3]);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      if(showWorldDecor){
        const floorModel = mat4Mul(
          mat4Translate(pathRender.gridCenter.x, 0, pathRender.gridCenter.z),
          mat4Scale(pathRender.gridSpan, 1, pathRender.gridSpan)
        );
        drawSolidBatch(
          gyroGl.solid.floorPosBuf,
          gyroGl.solid.floorNormBuf,
          gyroGl.solid.floorColBuf,
          gyroGl.solid.floorCount,
          floorModel,
          view,
          renderStyle
        );

        const mvpGrid = mat4Mul(viewProj, floorModel);
        drawLineBatch(
          gyroGl.line.staticPosBuf,
          gyroGl.line.staticColBuf,
          gl.LINES,
          gyroGl.sections.gridCount,
          mvpGrid
        );
      }

      const axisModel = mat4Identity();
      const axisMvp = mat4Mul(viewProj, axisModel);
      bindLineAttributes(gyroGl.line.staticPosBuf, gyroGl.line.staticColBuf);
      gl.uniformMatrix4fv(gyroGl.line.uMvp, false, new Float32Array(axisMvp));
      gl.drawArrays(gl.LINES, gyroGl.sections.axisStart, gyroGl.sections.axisCount);

      if(showWorldDecor && pathRender.trailWorldPoints && pathRender.trailWorldPoints.length >= 2){
        const trailMvp = viewProj;
        const trailPts = pathRender.trailWorldPoints;
        const phase = Date.now() * 0.0058;
        const drawTrailPrimitive = (geom, mode, additive)=>{
          const needMin = (mode === gl.TRIANGLES) ? 3 : 4;
          if(!geom || geom.count < needMin) return;
          gl.bindBuffer(gl.ARRAY_BUFFER, gyroGl.line.trailPosBuf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geom.pos), gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, gyroGl.line.trailColBuf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geom.col), gl.DYNAMIC_DRAW);
          gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
          drawLineBatch(
            gyroGl.line.trailPosBuf,
            gyroGl.line.trailColBuf,
            mode,
            geom.count,
            trailMvp
          );
        };
        gl.disable(gl.DEPTH_TEST);
        const shellGeom = buildGyroTrailRibbonGeometry(trailPts, eye, 0.032, (t, i)=>{
          const pulse = 0.82 + (0.18 * Math.sin((i * 0.28) + phase));
          return [0.02, 0.02, 0.03, (0.22 + (0.55 * t)) * pulse];
        });
        const glowGeom = buildGyroTrailRibbonGeometry(trailPts, eye, 0.024, (t, i)=>{
          const pulse = 0.76 + (0.24 * Math.sin((i * 0.34) + phase));
          return [1.0, 0.12 + (0.18 * t), 0.1 + (0.12 * t), (0.08 + (0.36 * t)) * pulse];
        });
        const coreGeom = buildGyroTrailRibbonGeometry(trailPts, eye, 0.015, (t)=>{
          const ease = t * t * (3 - (2 * t));
          return [0.88 + (0.1 * ease), 0.05 + (0.1 * ease), 0.08 + (0.07 * ease), 0.66 + (0.32 * ease)];
        });
        const hotGeom = buildGyroTrailRibbonGeometry(trailPts, eye, 0.008, (t, i)=>{
          const head = clampLocal((t - 0.74) / 0.26, 0, 1);
          const pulse = 0.72 + (0.28 * Math.sin((i * 0.42) + phase));
          return [1.0, 0.72, 0.42, (0.05 + (0.9 * head * head)) * pulse];
        });
        drawTrailPrimitive(shellGeom, gl.TRIANGLE_STRIP, false);
        drawTrailPrimitive(glowGeom, gl.TRIANGLE_STRIP, true);
        drawTrailPrimitive(coreGeom, gl.TRIANGLE_STRIP, false);
        drawTrailPrimitive(hotGeom, gl.TRIANGLE_STRIP, true);
        const arrowGeom = buildGyroTrailArrowGeometry(trailPts, eye);
        drawTrailPrimitive(arrowGeom, gl.TRIANGLES, false);
        gl.enable(gl.DEPTH_TEST);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      if(showWorldDecor){
        const yawRad = yawDeg * DEG_TO_RAD;
        const headingDir = [Math.sin(yawRad), 0, Math.cos(yawRad)];
        const headingSide = [-headingDir[2], 0, headingDir[0]];
        const currentY = rocketRenderPos.y;
        const h0 = [0, 0.04, 0];
        const h1 = [headingDir[0] * 1.36, 0.04, headingDir[2] * 1.36];
        const ha = [h1[0] - (headingDir[0] * 0.24) + (headingSide[0] * 0.12), 0.04, h1[2] - (headingDir[2] * 0.24) + (headingSide[2] * 0.12)];
        const hb = [h1[0] - (headingDir[0] * 0.24) - (headingSide[0] * 0.12), 0.04, h1[2] - (headingDir[2] * 0.24) - (headingSide[2] * 0.12)];
        const markerPos = [
          h0[0],h0[1],h0[2], h1[0],h1[1],h1[2],
          h1[0],h1[1],h1[2], ha[0],ha[1],ha[2],
          h1[0],h1[1],h1[2], hb[0],hb[1],hb[2],
          0,currentY,0, 0,0.04,0,
          -0.08,currentY,0, 0.08,currentY,0,
          0,currentY,-0.08, 0,currentY,0.08
        ];
        const markerCol = [];
        for(let i=0;i<markerPos.length/3;i++){
          if(i < 6) markerCol.push(1,0.84,0.24,0.92);
          else markerCol.push(0.34,0.86,0.98,0.74);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, gyroGl.line.headingPosBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(markerPos), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, gyroGl.line.headingColBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(markerCol), gl.DYNAMIC_DRAW);
        drawLineBatch(
          gyroGl.line.headingPosBuf,
          gyroGl.line.headingColBuf,
          gl.LINES,
          markerPos.length / 3,
          viewProj
        );
      }

      const rot = quatToMat4(getGyroRocketModelQuat());
      const rocketModel = mat4Mul(
        mat4Translate(rocketRenderPos.x, rocketRenderPos.y, rocketRenderPos.z),
        mat4Mul(rot, mat4Scale(GYRO_ROCKET_SCALE, GYRO_ROCKET_SCALE, GYRO_ROCKET_SCALE))
      );
      drawSolidBatch(
        gyroGl.solid.rocketPosBuf,
        gyroGl.solid.rocketNormBuf,
        gyroGl.solid.rocketColBuf,
        gyroGl.solid.rocketCount,
        rocketModel,
        view,
        renderStyle
      );

      bindLineAttributes(gyroGl.line.staticPosBuf, gyroGl.line.staticColBuf);
      gl.uniformMatrix4fv(gyroGl.line.uMvp, false, new Float32Array(mat4Mul(viewProj, rocketModel)));
      gl.drawArrays(gl.LINES, gyroGl.sections.bodyStart, gyroGl.sections.bodyCount);
    }

    function pathGyroPreviewRoundRect(ctx, x, y, w, h, r){
      const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    }

    function renderGyroPreview(pitchDeg, yawDeg, rollDeg){
      if(!el.gyroGlPreview || !el.gyroGl) return;
      if(el.gyroGlPreview === el.gyroGl) return;
      if(!isFlightModeUi() && !isPhoneLandscapeLayout()) return;
      if(!shouldUseGyro3dPreview()) return;
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
      const frameRadius = Math.max(12, Math.round(Math.min(w, h) * 0.08));
      const framePad = Math.max(3, Math.round(Math.min(w, h) * 0.03));
      const innerX = framePad;
      const innerY = framePad;
      const innerW = Math.max(12, w - framePad * 2);
      const innerH = Math.max(12, h - framePad * 2);

      ctx.save();
      pathGyroPreviewRoundRect(ctx, 0, 0, w, h, frameRadius);
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0,0,w,h);
      ctx.restore();

      ctx.save();
      pathGyroPreviewRoundRect(ctx, innerX, innerY, innerW, innerH, Math.max(8, frameRadius - 4));
      ctx.clip();
      const zoom = 1.08;
      const drawW = innerW * zoom;
      const drawH = innerH * zoom;
      const overflowX = Math.max(0, (drawW - innerW) * 0.5);
      const overflowY = Math.max(0, (drawH - innerH) * 0.5);
      let dx = innerX - overflowX;
      let dy = innerY - overflowY;
      if(gyroCameraState.previewRocketValid){
        gyroCameraState.previewSmoothX += (gyroCameraState.previewRocketX - gyroCameraState.previewSmoothX) * GYRO_PREVIEW_TRACK_SMOOTH;
        gyroCameraState.previewSmoothY += (gyroCameraState.previewRocketY - gyroCameraState.previewSmoothY) * GYRO_PREVIEW_TRACK_SMOOTH;
      }else{
        gyroCameraState.previewSmoothX += (0.5 - gyroCameraState.previewSmoothX) * 0.1;
        gyroCameraState.previewSmoothY += (0.5 - gyroCameraState.previewSmoothY) * 0.1;
      }
      const desiredX = innerX + (innerW * GYRO_PREVIEW_TRACK_TARGET_X);
      const desiredY = innerY + (innerH * GYRO_PREVIEW_TRACK_TARGET_Y);
      const rocketX = dx + (gyroCameraState.previewSmoothX * drawW);
      const rocketY = dy + (gyroCameraState.previewSmoothY * drawH);
      let shiftX = desiredX - rocketX;
      let shiftY = desiredY - rocketY;
      const deadbandX = innerW * GYRO_PREVIEW_TRACK_DEADBAND;
      const deadbandY = innerH * GYRO_PREVIEW_TRACK_DEADBAND;
      if(Math.abs(shiftX) < deadbandX) shiftX = 0;
      if(Math.abs(shiftY) < deadbandY) shiftY = 0;
      const maxShiftX = overflowX * GYRO_PREVIEW_TRACK_MAX_SHIFT_RATIO;
      const maxShiftY = overflowY * GYRO_PREVIEW_TRACK_MAX_SHIFT_RATIO;
      dx += clampLocal(shiftX, -maxShiftX, maxShiftX);
      dy += clampLocal(shiftY, -maxShiftY, maxShiftY);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(el.gyroGl, dx, dy, drawW, drawH);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(203,213,225,0.72)";
      ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.005));
      pathGyroPreviewRoundRect(ctx, 0.5, 0.5, w - 1, h - 1, frameRadius);
      ctx.stroke();
      ctx.restore();
    }

    function renderNavBallPreview(pitchDeg, yawDeg, rollDeg){
      if(!el.navBallPreview) return;
      if(el.navBallPreview === el.navBall) return;
      if(!isFlightModeUi() && !isPhoneLandscapeLayout()) return;
      if(!shouldUseNavBallPreview()) return;
      renderNavBallToCanvas(el.navBallPreview, pitchDeg, yawDeg, rollDeg);
    }

    function renderNavBall(pitchDeg, yawDeg, rollDeg){
      if(!el.navBall) return;
      renderNavBallToCanvas(el.navBall, pitchDeg, yawDeg, rollDeg);
    }

    function renderNavBallToCanvas(canvas, pitchDeg, yawDeg, rollDeg){
      const size = ensureCanvasSize(canvas);
      if(!size) return;
      pitchDeg = getGyroDisplayPitchDeg(pitchDeg);
      yawDeg = getGyroDisplayYawDeg(yawDeg);
      rollDeg = getGyroDisplayRollDeg(rollDeg);
      const { w: width, h: height, ctx } = size;
      ctx.clearRect(0,0,width,height);
      const cx = width / 2;
      const cy = height / 2;
      const half = Math.max(40, Math.min(width, height) / 2);
      const radius = half;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();

      const pitchClamped = Math.max(-45, Math.min(45, pitchDeg || 0));
      const pitchOffset = (pitchClamped / 45) * (radius * 0.65);
      const rollRad = -(rollDeg || 0) * DEG_TO_RAD;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rollRad);
      ctx.translate(0, pitchOffset);

      const skyGrad = ctx.createLinearGradient(0, -radius, 0, 0);
      skyGrad.addColorStop(0, "#3f6c96");
      skyGrad.addColorStop(1, "#4c7fb0");
      const groundGrad = ctx.createLinearGradient(0, 0, 0, radius);
      groundGrad.addColorStop(0, "#835744");
      groundGrad.addColorStop(1, "#694535");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-radius * 2.4, -radius * 2.4, radius * 4.8, radius * 2.4);
      ctx.fillStyle = groundGrad;
      ctx.fillRect(-radius * 2.4, 0, radius * 4.8, radius * 2.4);

      ctx.strokeStyle = "rgba(226,232,240,0.86)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-radius * 1.2, 0);
      ctx.lineTo(radius * 1.2, 0);
      ctx.stroke();

      // Horizon ladder: major + minor ticks (like ruler half-step marks)
      for(let p = -30; p <= 30; p += 5){
        if(p === 0) continue;
        const y = -(p / 45) * (radius * 0.65);
        const isMajor = (p % 10) === 0;
        const w = isMajor ? radius * 0.72 : radius * 0.38;
        ctx.strokeStyle = isMajor ? "rgba(203,213,225,0.58)" : "rgba(203,213,225,0.32)";
        ctx.lineWidth = isMajor ? 1.05 : 0.85;
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Extra short center ticks for denser instrument look
      ctx.strokeStyle = "rgba(226,232,240,0.22)";
      ctx.lineWidth = 0.9;
      for(let p = -25; p <= 25; p += 5){
        if(p === 0) continue;
        const y = -(p / 45) * (radius * 0.65);
        const inner = radius * 0.08;
        const outer = radius * 0.19;
        ctx.beginPath();
        ctx.moveTo(-outer, y);
        ctx.lineTo(-inner, y);
        ctx.moveTo(inner, y);
        ctx.lineTo(outer, y);
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = "rgba(148,163,184,0.84)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-6, 0);
      ctx.moveTo(6, 0);
      ctx.lineTo(18, 0);
      ctx.stroke();
      ctx.restore();
    }

    function updateLauncherPitchAngle(pitchDeg, gyroPitchRate, nowMs){
      if(!el.launcherPitchAngle && !el.launcherPitchAngleTablet && !el.launcherPitchAngleMobile) return;
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
      const text = (value == null) ? "--°" : (value.toFixed(1) + "°");
      if(el.launcherPitchAngle) el.launcherPitchAngle.textContent = text;
      if(el.launcherPitchAngleTablet) el.launcherPitchAngleTablet.textContent = text;
      if(el.launcherPitchAngleMobile) el.launcherPitchAngleMobile.textContent = text;
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
    let devParachuteDrop = false;
    let parachuteDeployLatched = false;
    let parachuteDeployAtMs = 0;
    let parachuteDeployChannel = 0;
    let lastRelayMaskForParachute = 0;
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
    let serialRxDisabledWarned = false;
    let simEnabled = false;
    let simState = createSimState();

    // ✅ 설비 점검/제어 권한
    let controlAuthority = false;
    let inspectionState = "idle";
    let inspectionRunning = false;
    let inspectionLastFailedKeys = [];
    let latestTelemetry = {sw:null, ic:null, rly:null, mode:null, uw:null, al:null};
    const STATUS_MAP_DEFAULT = Object.freeze({lat:35.154244, lon:128.09293, zoom:12});
    const STATUS_MAP_KR_BOUNDS = Object.freeze({south:33.0, west:124.5, north:38.9, east:131.9});
    const STATUS_MAP_TILE_SOURCES = Object.freeze([
      Object.freeze({
        id: "local",
        url: "/tiles/{z}/{x}/{y}.png",
        attribution: "Offline tiles"
      }),
      Object.freeze({
        id: "carto",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        subdomains: "abcd",
        attribution: "&copy; OSM contributors &copy; CARTO"
      })
    ]);
    const statusMapState = {
      lat: STATUS_MAP_DEFAULT.lat,
      lon: STATUS_MAP_DEFAULT.lon,
      zoom: STATUS_MAP_DEFAULT.zoom,
      map: null,
      marker: null,
      userMarker: null,
      userAccuracyCircle: null,
      userWatchId: null,
      markerExpanded: false,
      tileLayer: null,
      tileLoadCount: 0,
      tileErrorCount: 0,
      tileOffline: false,
      tileProbeTimer: null,
      tileSourceIndex: -1,
      leafletLoadInFlight: false,
      leafletLoadFailed: false,
      uiBound: false,
      hasLiveFix: false,
      lastUpdateMs: 0
    };
    let lastBatteryV = null;
    let lastBatteryPct = null;
    let spiFlashReadyState = null;
    let localSdDirHandle = null;
    let localSdDirLabel = "";
    let localSdBusy = false;
    let lastThrustKgf = null;
    const THRUST_GAUGE_MAX_KGF = 10;
    const THRUST_GAUGE_MAX_LBF = 22;
    const PRESSURE_GAUGE_MAX_MPA = 10.0;
    const SEA_LEVEL_PRESSURE_MPA = 0.1024; // 1024 hPa
    const PRESSURE_LEGACY_VOLT_FULL_SCALE = 3.3;
    const quickFlightMetrics = {
      originAlt: NaN,
      originPressureMpa: NaN,
      lastLat: NaN,
      lastLon: NaN,
      lastAlt: NaN,
      lastMs: 0,
      speedMps: NaN
    };
    let pendingLoadcellWeight = null;
    let pendingLoadcellZero = false;
    let lastLoadcellCalWeight = null;
    let lastLoadcellNoiseDeadband = null;
    let lastLoadcellScale = null;
    let lastLoadcellOffset = null;
    let lastLoadcellRaw = null;
    let lastLoadcellRawValid = false;
    let lastLoadcellReadyFlag = null;
    let lastLoadcellSaturated = false;
    let lastLoadcellOffsetValid = null;
    let lastLoadcellHz = 0;
    let lastLoadcellHzDisplay = 0;
    let lastLoadcellHzDisplayMs = 0;
    let loadcellTelemetryHasRaw = false;
    const LOADCELL_MODAL_STAGE_STABILIZE = "stabilize";
    const LOADCELL_MODAL_STAGE_NOISE = "noise";
    const LOADCELL_MODAL_STAGE_WEIGHT = "weight";
    const LOADCELL_MODAL_STAGE_COMPLETE = "complete";
    const LOADCELL_STABILIZE_MIN_MS = 5000;
    const LOADCELL_STABILIZE_WINDOW_MS = 5000;
    const LOADCELL_STABILIZE_MIN_SAMPLES = 8;
    const LOADCELL_STABILITY_JUMP_GUARD_MS = 1200;
    const LOADCELL_STABILITY_JUMP_MIN_SAMPLES = 18;
    const LOADCELL_HZ_FAULT_MIN = 1;
    const LOADCELL_HZ_FAULT_GRACE_MS = 2500;
    const LOADCELL_HZ_FAULT_HOLD_MS = 4000;
    const LOADCELL_HZ_DISPLAY_HOLD_MS = 1500;
    const LOADCELL_ERROR_TOAST_HOLD_MS = 2500;
    const LOADCELL_ERROR_TOAST_DEBOUNCE_MS = 30000;
    const REBOOT_WAIT_MIN_VISIBLE_MS = 1200;
    let loadcellModalStage = LOADCELL_MODAL_STAGE_STABILIZE;
    let loadcellWarningMode = "";
    let loadcellStabilitySamples = [];
    let loadcellStabilityStartedMs = 0;
    let loadcellStabilizedAtMs = 0;
    let loadcellStabilityFailed = false;
    let loadcellRateLowSinceMs = 0;
    let loadcellErrorSinceMs = 0;
    let lastLoadcellErrorToastMs = 0;
    let lastBurnSeconds = null;
    const SERVO_MIN_DEG = 0;
    const SERVO_MAX_DEG = 180;
    const SERVO_DEFAULT_DEG = 90;
    const SERVO_AUTO_APPLY_DELAY_MS = 140;
    const SERVO_SERIAL_REPLY_TIMEOUT_MS = 1200;
    const LOADCELL_SERIAL_REPLY_TIMEOUT_MS = 3000;
    const MISSION_SERIAL_REPLY_TIMEOUT_MS = 3200;
    const MISSION_SERIAL_CHUNK_B64_SIZE = 128;
    const MISSION_CANVAS_ZOOM_MIN = 0.5;
    const MISSION_CANVAS_ZOOM_MAX = 2.0;
    const MISSION_CANVAS_ZOOM_STEP = 0.1;
    const MISSION_DRAG_AUTOSCROLL_ZONE_PX = 56;
    const MISSION_DRAG_AUTOSCROLL_MAX_STEP = 26;
    const MISSION_BLOCK_POS_LIMIT = 6000;
    const MISSION_RUNTIME_MAX_BLOCKS = 64;
    const LOADCELL_SCALE_FALLBACK = 6510.0;
    const LOADCELL_NOISE_DB_FALLBACK = 0.03;
    const SERIAL_BAUD_RATE = 460800;
    const SERIAL_BAUD_CANDIDATES = [SERIAL_BAUD_RATE, 250000, 115200];
    const SERIAL_PROBE_TIMEOUT_MS = 2200;
    const SERIAL_PARSE_ERROR_LOG_LIMIT = 3;
    const SERVO_CHANNELS = [1, 2, 3, 4];
    const servoUiMap = {};
    let servoInfo = null;
    let servoInfoLastMs = 0;
    let servoInfoWarned = false;
    let serialCurrentBaud = SERIAL_BAUD_RATE;
    let serialParseErrorCount = 0;
    let serialAckWaiters = [];
    let serialConnectBusy = false;
    let missionCanvasZoom = 1;
    let missionCanvasPanState = null;
    let missionDragAutoScrollRaf = 0;
    let missionDragAutoScrollStep = 0;
    function isIgniterCheckEnabled(){
      if(latestTelemetry && latestTelemetry.gs != null) return !!latestTelemetry.gs;
      return !!(uiSettings && uiSettings.igs);
    }
    const INSPECTION_STEPS = [
      {key:"link",    check:()=>connOk},
      {key:"serial",  check:()=>(!serialEnabled) || serialConnected},
      {key:"igniter", check:()=> isIgniterCheckEnabled() ? (latestTelemetry.ic===1) : true},
      {key:"loadcell", check:()=> (lastThrustKgf != null && isFinite(lastThrustKgf) && !loadcellErrorActive)},
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
    const missionDialogDockState = {
      homeParent: null,
      homeNextSibling: null
    };
    const inspectionDialogDockState = {
      homeParent: null,
      homeNextSibling: null
    };
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
    const BOARD_FALLBACK_HTTP = "http://192.168.4.1";
    let wsEverConnected = false;
    let wsAlertDismissed = false;
    let lastWsAlertActive = false;
    const wsLogSilent = (
      location.protocol === "file:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1"
    );
    function isLocalPreviewHost(){
      const host = String(location.hostname || "").toLowerCase();
      if(!host) return true;
      if(host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;
      if(host.indexOf("vscode") >= 0) return true;
      return false;
    }
    function getApiBaseForCommands(){
      return isLocalPreviewHost() ? BOARD_FALLBACK_HTTP : "";
    }
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
      return Math.max(1, Math.min(4, channel));
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
        ignDurationMs:1000,
        countdownSec:10,
        daqSequencePyroChannel:1,
        opMode:"daq",
        gyroPreview:"3d",
        mobileHudPreview:false,
        mobileImmersive:false,
        relaySafe: true,
        safetyMode: false,
        armLock: true,
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
        uiSettings.gyroPreview = normalizeGyroPreviewMode(uiSettings.gyroPreview);
      }
      relaySafeEnabled = !!uiSettings.relaySafe;
      safetyModeEnabled = !!uiSettings.safetyMode;
      uiSettings.armLock = !!uiSettings.armLock;

      serialEnabled = !!uiSettings.serialEnabled;
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
        labelAltitude:"고도",
        labelSpeed:"속도",
        labelSwitch:"ARM",
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
        controlOpModeSub:"Flight / DAQ 전환",
        controlRebootBtn:"재부팅",
        gyroZeroBtn:"자이로 영점",
        gyroZeroDoneToast:"자이로 영점이 설정되었습니다.",
        gyroZeroUnavailableToast:"자이로 데이터가 아직 준비되지 않았습니다.",
        rebootConfirmTitle:"보드를 재부팅할까요?",
        rebootConfirmText:"재부팅 중에는 실시간 데이터 수신이 잠시 중단됩니다.<br>진행하시겠습니까?",
        rebootPendingTitle:"재부팅 대기중",
        rebootPendingText:"보드가 재부팅 중입니다.<br>잠시만 기다려주세요.",
        rebootConfirmBtn:"재부팅",
        controlLauncherLabel:"발사대",
        controlLauncherSub:"발사대 모터/액추에이터제어",
        missionToolbarBtn:"미션 지정",
        devToolsTitle:"DEV TOOLS",
        devRelayStatus:"SIM ER",
        devRelay1Btn:"1번 릴레이 오류",
        devRelay2Btn:"2번 릴레이 오류",
        devWsOffBtn:"WS 오류",
        devLoadcellErrBtn:"로드셀 오류",
        devParachuteBtn:"낙하산 실험 (SIM)",
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
        settingsPressureUnitHint:"현재는 MPa 기준입니다. 센서 보정은 config.h의 압력 변환 상수로 조정하세요.",
        settingsQuickDigitsLabel:"퀵데이터 소수 자릿수",
        settingsQuickDigitsHint:"추력/압력, Delay/Burn 카드 표시 자릿수입니다.",
        settingsLoadcellChartDigitsLabel:"로드셀 차트 소수 자릿수",
        settingsLoadcellChartDigitsHint:"차트의 AVG/MAX 추력 표시 자릿수입니다.",
        settingsStorageExportDigitsLabel:"SD/내보내기 소수 자릿수",
        settingsStorageExportDigitsHint:"SD 데이터 확인용 보고서와 Flash 내보내기 파일의 추력/압력 값 자릿수입니다. 시간축 정밀도는 유지됩니다.",
        settingsGyroPreviewLabel:"자이로 프리뷰",
        settingsGyroPreviewHint:"플라이트 모드 프리뷰 형태를 선택합니다.",
        settingsGyroPreview3dBasic:"3D",
        settingsGyroPreview3d:"3D PLUS",
        settingsGyroPreviewNav:"Navball",
        settingsMobileHudPreviewLabel:"모바일 HUD 미리보기",
        settingsMobileHudPreviewHint:"데스크톱이나 태블릿에서도 휴대폰 가로 인터페이스를 강제로 표시합니다.",
        settingsMobileFullscreenLabel:"모바일 전체화면",
        settingsMobileFullscreenHint:"지원 브라우저에서 휴대폰 가로 HUD를 전체화면으로 표시합니다.",
        langOptionKo:"한국어",
        langOptionEn:"영어",
        settingsGroupSequence:"점화 시퀀스",
        settingsIgnitionTimeLabel:"점화 시간 (릴레이 ON)",
        settingsIgnitionTimeHint:"보드에 <span class=\"mono\">/set?ign_ms=...</span> 전송. 과열/인가 시간에 주의.",
        settingsIgnitionTimeRange:"100~3000ms",
        settingsDaqSequencePyroLabel:"DAQ 시퀀스 파이로 채널",
        settingsDaqSequencePyroHint:"DAQ 모드에서 시퀀스 점화 시 사용할 기본 채널입니다.",
        settingsGroupCountdown:"카운트다운",
        settingsCountdownTimeLabel:"카운트다운 시간",
        settingsCountdownTimeHint:"보드에 <span class=\"mono\">/set?cd_ms=...</span> 전송. 인원 통제 시간을 충분히 확보.",
        settingsCountdownTimeRange:"3~60초",
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
        devParachuteOnToast:"낙하산 하강 시뮬레이션 시작 (T-0, 6층 높이).",
        devParachuteOffToast:"낙하산 하강 시뮬레이션 해제.",
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
        inspectionLabelSwitch:"ARM",
        inspectionDescSwitch:"저전위(LOW) 안전 상태",
        inspectionDescRelay:"비정상 릴레이 HIGH 여부",
        inspectionRetry:"다시 점검",
        footerMeta:"2026 ALTIS 추진팀 윤보배 - HANWOOL",
        inspectionFailText:"점검 실패 항목이 있습니다.",
        inspectionFailItemsLabel:"문제 항목",
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
        chartAxisTime:"시간",
        chartAxisValue:"값",
        labelDelay:"delay",
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
        hdrAvgPressure:"평균압력_mpa",
        hdrMaxThrust:"최대추력_kgf",
        hdrMaxPressure:"최대압력_mpa",
        hdrAvgThrustN:"평균추력_N",
        hdrMaxThrustN:"최대추력_N",
        hdrTag:"태그",
        hdrThrust:"추력_kgf",
        hdrThrustN:"추력_N",
        hdrPressure:"압력_mpa",
        hdrGpsLat:"gps_위도_deg",
        hdrGpsLon:"gps_경도_deg",
        hdrGpsAlt:"gps_고도_m",
        hdrAltitudeM:"고도_m",
        hdrSpeedMps:"속도_mps",
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
        hdrSwitch:"ARM",
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
        statusParachute:"PARACHUTE",
        statusSequence:"SEQUENCE",
        statusLockoutText:"비정상적인 릴레이 HIGH 감지 ({name})",
        statusAbortText:"시퀀스가 중단되었습니다.",
        statusAbortTextReason:"시퀀스가 중단되었습니다. ({reason})",
        statusIgnitionText:"점화 중입니다.",
        statusCountdownText:"카운트다운 진행 중",
        statusParachuteText:"낙하산 사출 감지 (CH{ch})",
        statusSequenceText:"시퀀스 진행 중",
        statusNotArmedTextReady:"이그나이터 미연결 / 점화 시퀀스 가능",
        statusNotArmedTextBlocked:"이그나이터 미연결 / 점화 시퀀스 제한",
        statusReadyText:"시스템 준비 완료",
        statusParachuteLog:"낙하산 사출 감지 (CH{ch})",
        statusParachuteToast:"낙하산 사출 감지 (CH{ch})",
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
        webserialInsecureToast:"WebSerial은 HTTPS 또는 localhost에서만 동작합니다. PC 크롬에서 localhost로 접속해 주세요.",
        webserialConnected:"WebSerial 연결됨.",
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
        switchHighLog:"ARM 변경: HIGH(ON).",
        switchHighToast:"ARM이 HIGH(ON) 상태입니다. 시퀀스 조건/주변 안전을 재확인하세요. {safety}",
        switchLowLog:"ARM 변경: LOW(OFF).",
        switchLowToast:"ARM이 LOW(OFF) 상태입니다. 안전 상태로 유지하세요. {safety}",
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
        ignTimeChangedToast:"점화 시간이 {from}ms → {to}ms 로 변경되었습니다. 과열/인가 시간에 주의하세요. {safety}",
        countdownChangedToast:"카운트다운 시간이 {from}s → {to}s 로 변경되었습니다. 인원 통제 시간을 충분히 두세요. {safety}",
        settingsUpdatedLog:"설정 업데이트: thrustUnit={unit}, ignDuration={ign}ms, countdown={cd}s",
        loadcellSettingsTitle:"로드셀 보정",
        loadcellSettingsLabel:"로드셀 보정",
        loadcellSettingsHint:"영점/스케일/노이즈 를 보정하고 데이터를 보드에 저장합니다.",
        loadcellOpenBtn:"로드셀 보정",
        loadcellResetLabel:"로드셀 초기화",
        loadcellResetHint:"영점/스케일/노이즈 저장값을 처음 상태로 초기화합니다.",
        loadcellResetBtn:"로드셀 초기화",
        loadcellModalTitle:"로드셀 보정",
        loadcellModalBadge:"Calibration",
        loadcellModalGuide:"무게추를 올려놓고 값을 확인하세요. 다음을 누르세요.",
        loadcellGuideStabilizing:"잠시만 대기해주세요. 로드셀 데이터 안정화중입니다. 로드셀을 건들이지 마세요!",
        loadcellGuideStableReady:"안정화가 완료되었습니다. 영점 저장 버튼을 눌러주세요.",
        loadcellGuideNoiseReady:"영점이 저장되었습니다! 무부하 상태 그대로 노이즈 영점을 저장해주세요.",
        loadcellGuidePlaceWeight:"무게추를 올린 후 무게를 입력후 다음버튼을 클릭하세요.",
        loadcellGuideComplete:"로드셀 보정이 완료되었습니다!",
        loadcellModalValueLabel:"현재 측정값 (kg)",
        loadcellModalValueHint:"보정은 kg 기준으로 저장됩니다.",
        loadcellModalInputLabel:"중량 입력 (kg)",
        loadcellModalInputHint:"1Kg = 1000g",
        loadcellModalNote:"이 값은 보드에 저장됩니다.",
        loadcellCalcTitle:"보정 계산 값",
        loadcellCalcWeightLabel:"입력 중량",
        loadcellCalcScaleLabel:"계산 스케일",
        loadcellCalcOffsetLabel:"영점 오프셋",
        loadcellCompleteTitle:"로드셀 보정 완료",
        loadcellCompleteText:"로드셀 보정이 완료되었습니다!",
        loadcellCompleteCloseBtn:"확인",
        loadcellStabilityFailTitle:"로드셀 안정화 실패",
        loadcellStabilityFailText:"값이 갑자기 크게 변했습니다. 로드셀을 건드리거나 하중이 바뀐 것으로 판단됩니다.",
        loadcellStabilityFailSub:"하중을 모두 제거한 뒤 5~10초 정도 다시 기다려주세요. 로드셀과 지그를 만지지 마세요.",
        loadcellRetryBtn:"다시 측정",
        loadcellModalApply:"다음",
        loadcellModalCancel:"취소",
        loadcellZeroSaveBtn:"영점 저장",
        loadcellNoiseSaveBtn:"노이즈 영점 저장",
        loadcellModalConfirmTitle:"보정값을 저장할까요?",
        loadcellModalConfirmText:"입력한 중량 {weight} kg로 보정값을 저장합니다. 이전 값은 삭제됩니다.",
        loadcellModalConfirmSub:"저장 후 측정 기준이 변경됩니다. 보정에 사용한 무게추를 제거한 뒤 값을 확인하세요.",
        loadcellModalConfirmProceed:"진행",
        loadcellModalConfirmCancel:"취소",
        loadcellZeroConfirmTitle:"영점을 저장할까요?",
        loadcellZeroConfirmText:"현재 상태를 영점으로 저장합니다. 이전 영점은 덮어씁니다.",
        loadcellWeightInvalidToast:"중량을 올바르게 입력하세요.",
        loadcellZeroSaveSuccessToast:"영점이 저장되었습니다!",
        loadcellZeroSaveFailToast:"로드셀 영점 저장에 실패했습니다.",
        loadcellNoiseSaveSuccessToast:"로드셀 노이즈 영점이 저장되었습니다!",
        loadcellNoiseSaveFailToast:"로드셀 노이즈 영점 저장에 실패했습니다.",
        loadcellSaveSuccessToast:"로드셀 보정이 완료되었습니다!",
        loadcellSaveFailToast:"로드셀 보정 저장에 실패했습니다.",
        loadcellResetSuccessToast:"로드셀 초기화가 완료되었습니다!",
        loadcellResetFailToast:"로드셀 초기화에 실패했습니다.",
        loadcellZeroSaveLog:"로드셀 영점 저장 요청",
        loadcellNoiseSaveLog:"로드셀 노이즈 영점 저장 요청",
        loadcellSaveLog:"로드셀 보정 저장 요청 (weight={weight} kg)",
        loadcellResetLog:"로드셀 초기화 요청",
        loadcellErrorToast:"로드셀 데이터 수신 오류입니다. 센서/배선을 점검하세요.",
        loadcellStabilityFailToast:"로드셀 값이 크게 변해 안정화에 실패했습니다. 하중을 제거하고 다시 시도하세요."
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
        labelAltitude:"Altitude",
        labelSpeed:"Speed",
        labelSwitch:"ARM",
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
        controlOpModeSub:"Switch Flight / DAQ",
        controlRebootBtn:"Reboot",
        gyroZeroBtn:"Gyro Zero",
        gyroZeroDoneToast:"Gyro zero applied.",
        gyroZeroUnavailableToast:"Gyro data is not ready yet.",
        rebootConfirmTitle:"Reboot the board?",
        rebootConfirmText:"Real-time data streaming will pause briefly during reboot.<br>Do you want to continue?",
        rebootPendingTitle:"Waiting for reboot",
        rebootPendingText:"The board is rebooting.<br>Please wait a moment.",
        rebootConfirmBtn:"Reboot",
        controlLauncherLabel:"Launcher",
        controlLauncherSub:"Launcher motor/actuator control",
        missionToolbarBtn:"Mission",
        devToolsTitle:"DEV TOOLS",
        devRelayStatus:"Relay Status",
        devRelay1Btn:"Relay 1",
        devRelay2Btn:"Relay 2",
        devWsOffBtn:"WS OFF (SIM)",
        devLoadcellErrBtn:"LOADCELL ERROR (SIM)",
        devParachuteBtn:"PARACHUTE DROP (SIM)",
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
        settingsPressureUnitHint:"Pressure is now shown in MPa. Tune conversion constants in config.h for your sensor.",
        settingsQuickDigitsLabel:"Quick data decimals",
        settingsQuickDigitsHint:"Controls decimal places for thrust/pressure and Delay/Burn cards.",
        settingsLoadcellChartDigitsLabel:"Loadcell chart decimals",
        settingsLoadcellChartDigitsHint:"Controls decimal places for AVG/MAX thrust labels on the chart.",
        settingsStorageExportDigitsLabel:"SD/export decimals",
        settingsStorageExportDigitsHint:"Controls decimal places for thrust/pressure values in SD review reports and Flash exports. Time-axis precision stays unchanged.",
        settingsGyroPreviewLabel:"Gyro preview",
        settingsGyroPreviewHint:"Choose the preview for Flight mode.",
        settingsGyroPreview3dBasic:"3D",
        settingsGyroPreview3d:"3D PLUS",
        settingsGyroPreviewNav:"Navball",
        settingsMobileHudPreviewLabel:"Mobile HUD Preview",
        settingsMobileHudPreviewHint:"Force the phone landscape interface even on desktop or tablet.",
        settingsMobileFullscreenLabel:"Mobile fullscreen",
        settingsMobileFullscreenHint:"Show the phone landscape HUD in fullscreen on supported browsers.",
        langOptionKo:"Korean",
        langOptionEn:"English",
        settingsGroupSequence:"Ignition Sequence",
        settingsIgnitionTimeLabel:"Ignition time (relay ON)",
        settingsIgnitionTimeHint:"Sends <span class=\"mono\">/set?ign_ms=...</span> to the board. Watch heat/energizing duration.",
        settingsIgnitionTimeRange:"100-3000 ms",
        settingsDaqSequencePyroLabel:"DAQ sequence pyro channel",
        settingsDaqSequencePyroHint:"Default channel used for sequence/immediate ignition in DAQ mode. Default is PYRO1.",
        settingsGroupCountdown:"Countdown",
        settingsCountdownTimeLabel:"Countdown time",
        settingsCountdownTimeHint:"Sends <span class=\"mono\">/set?cd_ms=...</span> to the board. Allow enough time to clear personnel.",
        settingsCountdownTimeRange:"3–60 s",
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
        devParachuteOnToast:"Parachute descent simulation started (T-0, 6-floor height).",
        devParachuteOffToast:"Parachute descent simulation disabled.",
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
        inspectionLabelSwitch:"ARM",
        inspectionDescSwitch:"LOW safety state",
        inspectionDescRelay:"Abnormal relay HIGH status",
        inspectionRetry:"Recheck",
        footerMeta:"2026 ALTIS Propulsion Team Yoon Bobae - HANWOOL",
        inspectionFailText:"Some inspection items failed.",
        inspectionFailItemsLabel:"Failed items",
        inspectionPassText:"All checks passed. Control authority granted.",
        loadcellSettingsTitle:"Loadcell Calibration",
        loadcellSettingsLabel:"Loadcell Zero/Calibration",
        loadcellSettingsHint:"Save zero/calibration value to the board.",
        loadcellOpenBtn:"Adjust Loadcell Zero",
        loadcellResetLabel:"Loadcell Reset",
        loadcellResetHint:"Reset zero/scale/noise values back to the initial state.",
        loadcellResetBtn:"Reset Loadcell",
        loadcellModalTitle:"Loadcell Zero Adjust",
        loadcellModalBadge:"Calibration",
        loadcellModalGuide:"Place the weight and check the value. Tap Next.",
        loadcellGuideStabilizing:"Please wait. Stabilizing loadcell data. Do not touch the loadcell.",
        loadcellGuideStableReady:"Stabilization complete. Press Save Zero.",
        loadcellGuidePlaceWeight:"Place the reference weight, enter its mass, then tap Next.",
        loadcellGuideComplete:"Loadcell calibration is complete.",
        loadcellModalValueLabel:"Current value (kg)",
        loadcellModalValueHint:"Calibration is saved in kg.",
        loadcellModalInputLabel:"Enter weight (kg)",
        loadcellModalInputHint:"1 kg = 1000 g",
        loadcellModalNote:"This value will be saved to the board.",
        loadcellCalcTitle:"Calibration Result",
        loadcellCalcWeightLabel:"Input weight",
        loadcellCalcScaleLabel:"Calculated scale",
        loadcellCalcOffsetLabel:"Zero offset",
        loadcellCompleteTitle:"Calibration Complete",
        loadcellCompleteText:"Loadcell calibration is complete.",
        loadcellCompleteCloseBtn:"Close",
        loadcellStabilityFailTitle:"Loadcell Stabilization Failed",
        loadcellStabilityFailText:"The value changed too abruptly. The loadcell or fixture was likely touched or the load changed.",
        loadcellStabilityFailSub:"Remove all load and wait 5–10 seconds again. Do not touch the loadcell or jig.",
        loadcellRetryBtn:"Retry",
        loadcellModalApply:"Next",
        loadcellModalCancel:"Cancel",
        loadcellModalConfirmTitle:"Save calibration value?",
        loadcellModalConfirmText:"Save calibration with {weight} kg. Previous value will be removed.",
        loadcellModalConfirmSub:"After saving, the measurement reference changes. Remove the calibration weight and check the value.",
        loadcellModalConfirmProceed:"Proceed",
        loadcellModalConfirmCancel:"Cancel",
        loadcellWeightInvalidToast:"Enter a valid weight.",
        loadcellZeroSaveSuccessToast:"Zero saved.",
        loadcellZeroSaveFailToast:"Failed to save loadcell zero.",
        loadcellSaveSuccessToast:"Loadcell calibration is complete.",
        loadcellSaveFailToast:"Failed to save loadcell calibration.",
        loadcellResetSuccessToast:"Loadcell reset is complete.",
        loadcellResetFailToast:"Failed to reset the loadcell.",
        loadcellSaveLog:"Loadcell calibration save request (weight={weight} kg)",
        loadcellResetLog:"Loadcell reset requested",
        loadcellErrorToast:"Loadcell data error. Check sensor and wiring.",
        loadcellStabilityFailToast:"Loadcell value jumped too much. Remove the load and retry.",
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
        chartAxisTime:"Time",
        chartAxisValue:"Value",
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
        hdrAvgPressure:"avg_pressure_mpa",
        hdrMaxThrust:"max_thrust_kgf",
        hdrMaxPressure:"max_pressure_mpa",
        hdrAvgThrustN:"avg_thrust_n",
        hdrMaxThrustN:"max_thrust_n",
        hdrTag:"tag",
        hdrThrust:"thrust_kgf",
        hdrThrustN:"thrust_n",
        hdrPressure:"pressure_mpa",
        hdrGpsLat:"gps_lat",
        hdrGpsLon:"gps_lon",
        hdrGpsAlt:"gps_alt",
        hdrAltitudeM:"altitude_m",
        hdrSpeedMps:"speed_mps",
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
        hdrSwitch:"arm",
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
        statusParachute:"PARACHUTE",
        statusSequence:"SEQUENCE",
        statusLockoutText:"Abnormal relay HIGH detected ({name}). Control revoked. Restart the board.",
        statusAbortText:"Sequence aborted.",
        statusAbortTextReason:"Sequence aborted. ({reason})",
        statusIgnitionText:"Igniter firing.",
        statusCountdownText:"Launch countdown in progress",
        statusParachuteText:"Parachute deployment detected (CH{ch})",
        statusSequenceText:"Sequence in progress",
        statusNotArmedTextReady:"Igniter open / ignition sequence allowed",
        statusNotArmedTextBlocked:"Igniter open / ignition sequence blocked",
        statusReadyText:"System ready",
        statusParachuteLog:"Parachute deployment detected (CH{ch})",
        statusParachuteToast:"Parachute deployment detected (CH{ch})",
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
        webserialInsecureToast:"WebSerial requires HTTPS or localhost. Open this dashboard from localhost on desktop Chrome/Edge.",
        webserialConnected:"WebSerial connected.",
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
        switchHighLog:"ARM changed: HIGH (ON).",
        switchHighToast:"ARM is HIGH (ON). Recheck sequence conditions and safety. {safety}",
        switchLowLog:"ARM changed: LOW (OFF).",
        switchLowToast:"ARM is LOW (OFF). Keep safe state. {safety}",
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
        ignTimeChangedToast:"Ignition time changed {from}ms → {to}ms. Watch heating/drive time. {safety}",
        countdownChangedToast:"Countdown changed {from}s → {to}s. Allow enough clearance time. {safety}",
        settingsUpdatedLog:"Settings updated: thrustUnit={unit}, ignDuration={ign}ms, countdown={cd}s",
        loadcellSettingsTitle:"Loadcell Calibration",
        loadcellSettingsLabel:"Loadcell zero/calibration",
        loadcellSettingsHint:"Save zero/calibration values to the board.",
        loadcellOpenBtn:"Loadcell Zero Adjust",
        loadcellResetLabel:"Loadcell Reset",
        loadcellResetHint:"Reset zero/scale/noise values back to the initial state.",
        loadcellResetBtn:"Reset Loadcell",
        loadcellModalTitle:"Loadcell Zero Adjust",
        loadcellModalBadge:"Calibration",
        loadcellModalGuide:"Place the weight, verify the reading, then tap Next.",
        loadcellGuideStabilizing:"Please wait. Stabilizing loadcell data. Do not touch the loadcell.",
        loadcellGuideStableReady:"Stabilization complete. Press Save Zero.",
        loadcellGuideNoiseReady:"Zero saved. Keep the loadcell unloaded and save the noise zero next.",
        loadcellGuidePlaceWeight:"Place the reference weight, enter its mass, then tap Next.",
        loadcellGuideComplete:"Loadcell calibration is complete.",
        loadcellModalValueLabel:"Current reading (kg)",
        loadcellModalValueHint:"Calibration is stored in kg.",
        loadcellModalInputLabel:"Enter weight (kg)",
        loadcellModalInputHint:"e.g. 1.250",
        loadcellModalNote:"This value is saved to the board.",
        loadcellCalcTitle:"Calibration Result",
        loadcellCalcWeightLabel:"Input weight",
        loadcellCalcScaleLabel:"Calculated scale",
        loadcellCalcOffsetLabel:"Zero offset",
        loadcellCompleteTitle:"Calibration Complete",
        loadcellCompleteText:"Loadcell calibration is complete.",
        loadcellCompleteCloseBtn:"Close",
        loadcellStabilityFailTitle:"Loadcell Stabilization Failed",
        loadcellStabilityFailText:"The value changed too abruptly. The loadcell or fixture was likely touched or the load changed.",
        loadcellStabilityFailSub:"Remove all load and wait 5–10 seconds again. Do not touch the loadcell or jig.",
        loadcellRetryBtn:"Retry",
        loadcellModalApply:"Next",
        loadcellModalCancel:"Cancel",
        loadcellZeroSaveBtn:"Save Zero",
        loadcellNoiseSaveBtn:"Save Noise Zero",
        loadcellModalConfirmTitle:"Save calibration?",
        loadcellModalConfirmText:"Save calibration using {weight} kg. Previous data will be overwritten.",
        loadcellModalConfirmSub:"Measurement baseline will change after saving. Remove the weight and verify the reading.",
        loadcellModalConfirmProceed:"Proceed",
        loadcellModalConfirmCancel:"Cancel",
        loadcellZeroConfirmTitle:"Save zero?",
        loadcellZeroConfirmText:"Save current state as zero. Previous zero will be overwritten.",
        loadcellWeightInvalidToast:"Enter a valid weight.",
        loadcellZeroSaveSuccessToast:"Zero saved.",
        loadcellZeroSaveFailToast:"Failed to save loadcell zero.",
        loadcellNoiseSaveSuccessToast:"Loadcell noise zero saved.",
        loadcellNoiseSaveFailToast:"Failed to save loadcell noise zero.",
        loadcellSaveSuccessToast:"Loadcell calibration is complete.",
        loadcellSaveFailToast:"Failed to save loadcell calibration.",
        loadcellResetSuccessToast:"Loadcell reset is complete.",
        loadcellResetFailToast:"Failed to reset the loadcell.",
        loadcellZeroSaveLog:"Loadcell zero save requested",
        loadcellNoiseSaveLog:"Loadcell noise zero save requested",
        loadcellSaveLog:"Loadcell calibration requested (weight={weight} kg)",
        loadcellResetLog:"Loadcell reset requested",
        loadcellStabilityFailToast:"Loadcell value jumped too much. Remove the load and retry."
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
      updateQuickMetricLabels();
      updateSerialControlTile();
      updateExportGuardUi();
      updateRebootConfirmUi();
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
      if(el.ignTimeInput) el.ignTimeInput.value = uiSettings.ignDurationMs;
      if(el.hardwarePyroDurationInput){
        const ignMs = Math.max(10, Math.min(30000, Math.round(Number(uiSettings.ignDurationMs || 1000))));
        el.hardwarePyroDurationInput.value = String(ignMs);
      }
      if(el.countdownSecInput) el.countdownSecInput.value = uiSettings.countdownSec;
      if(el.daqSequencePyroSelect) el.daqSequencePyroSelect.value = String(normalizePyroChannel(uiSettings.daqSequencePyroChannel, 1));
      if(el.opModeSelect) el.opModeSelect.value = uiSettings.opMode || "daq";
      const previewMode = getGyroPreviewMode();
      if(el.gyroPreviewSelect) el.gyroPreviewSelect.value = previewMode;
      if(el.mobileHudPreviewToggle) el.mobileHudPreviewToggle.checked = !!uiSettings.mobileHudPreview;
      if(el.mobileFullscreenToggle) el.mobileFullscreenToggle.checked = !!uiSettings.mobileImmersive;

      if(el.relaySafeToggle) el.relaySafeToggle.checked = !!uiSettings.relaySafe;
      if(el.safeModeToggle){
        el.safeModeToggle.checked = !!uiSettings.safetyMode;
        updateTogglePill(el.safeModePill, el.safeModeToggle.checked);
      }
      if(el.armLockToggle){
        el.armLockToggle.checked = !!uiSettings.armLock;
        updateTogglePill(el.armLockPill, el.armLockToggle.checked);
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
      document.documentElement.classList.toggle("preview-3d", previewMode !== "navball");
      document.documentElement.classList.toggle("preview-navball", previewMode === "navball");
      if(uiSettings.opMode !== "flight"){
        resetQuickFlightMetricsState();
      }
      if((uiSettings.opMode !== "flight" || previewMode === "navball") && isGyroViewportExpanded()){
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
      refreshStatusMapMarkerContent();
      refreshStatusMapSize();
      applyPhoneLandscapeLayout();
    }
    function updateControlsToolbarLabels(){
      if(el.missionOpenBtn){
        el.missionOpenBtn.setAttribute("title", t("missionToolbarBtn"));
        el.missionOpenBtn.setAttribute("aria-label", t("missionToolbarBtn"));
      }
      if(el.gyroZeroBtn){
        el.gyroZeroBtn.setAttribute("title", t("gyroZeroBtn"));
        el.gyroZeroBtn.setAttribute("aria-label", t("gyroZeroBtn"));
      }
      if(el.exportCsvBtn){
        el.exportCsvBtn.setAttribute("title", t("exportXlsx"));
        el.exportCsvBtn.setAttribute("aria-label", t("exportXlsx"));
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
      if(rebootConfirmWaiting){
        hideRebootConfirm();
      }
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

    function createSimState(){
      return {
        st:0,
        cdMs:0,
        countdownStartMs:null,
        ignStartMs:null,
        countdownTotalMs:null,
        flightStartMs:null,
        lastGeo:null,
        physicsLastMs:0,
        posE:0,
        posN:0,
        altM:0,
        velE:0,
        velN:0,
        velU:0,
        accE:0,
        accN:0,
        accU:0,
        rollDeg:0,
        pitchDeg:82,
        yawDeg:34,
        apogeeMs:null,
        drogueDeployed:false,
        mainDeployed:false,
        landed:false,
        landedMs:null,
        gpsNextMs:0,
        gpsLat:null,
        gpsLon:null,
        gpsAlt:null,
        gpsPhase:0
      };
    }

    function resetSimState(){
      simState = createSimState();
    }
    function setSimEnabled(enabled, opts){
      const silent = !!(opts && opts.silent);
      simEnabled = !!enabled;
      resetParachuteDeployState();
      if(uiSettings){
        uiSettings.simEnabled = simEnabled;
        saveSettings();
      }
      if(simEnabled){
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
      const gMps2 = 9.80665;
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
            targetForwardMps = 0.08 + (0.18 * clampLocal(tFlight / Math.max(0.5, burnSec), 0, 1));
          }else if(!simState.drogueDeployed){
            targetForwardMps = 0.22;
          }else if(!simState.mainDeployed){
            targetForwardMps = 0.16;
          }else{
            targetForwardMps = 0.08;
          }
          if(tFlight < 1.2){
            targetForwardMps *= 0.35;
          }

          const altFactor = clampLocal(simState.altM / 600, 0, 1);
          let windE = 0;
          let windN = 0;
          if(!simState.landed){
            windE = (0.012 + (0.018 * altFactor)) * Math.sin((tFlight * 0.08) + 0.8);
            windN = (0.01 + (0.015 * altFactor)) * Math.cos((tFlight * 0.07) + 1.6);
            if(tFlight < 1.2){
              windE *= 0.3;
              windN *= 0.3;
            }
          }
          const yawRadVel = simState.yawDeg * DEG_TO_RAD;
          const targetVelE = (Math.sin(yawRadVel) * targetForwardMps) + windE;
          const targetVelN = (Math.cos(yawRadVel) * targetForwardMps) + windN;
          const horizTau = simState.landed ? 0.52 : (simState.mainDeployed ? 0.78 : (simState.drogueDeployed ? 0.96 : 1.12));
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
              120
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
        const gyroNoiseAmp = burnNow ? 0.7 : (simState.mainDeployed ? 0.16 : 0.3);
        gx = angleDeltaDeg(rollStart, simState.rollDeg) / dtRate;
        gy = (simState.pitchDeg - pitchStart) / dtRate;
        gz = angleDeltaDeg(yawStart, simState.yawDeg) / dtRate;
        gx += gyroNoiseAmp * Math.sin((tSec * 18.0) + 0.2);
        gy += (gyroNoiseAmp * 0.5) * Math.cos((tSec * 16.0) + 0.7);
        gz += (gyroNoiseAmp * 0.45) * Math.sin((tSec * 15.0) + 1.1);
        gx = clampLocal(gx, -140, 140);
        gy = clampLocal(gy, -140, 140);
        gz = clampLocal(gz, -140, 140);

        const yawRad = simState.yawDeg * DEG_TO_RAD;
        const forwardMps2 = (simState.accE * Math.sin(yawRad)) + (simState.accN * Math.cos(yawRad));
        const rightMps2 = (simState.accE * Math.cos(yawRad)) - (simState.accN * Math.sin(yawRad));
        const upMps2 = simState.accU;
        const forwardG = forwardMps2 / gMps2;
        const rightG = rightMps2 / gMps2;
        const upG = upMps2 / gMps2;
        const rollRad = simState.rollDeg * DEG_TO_RAD;
        const pitchRad = simState.pitchDeg * DEG_TO_RAD;
        const gravX = -Math.sin(pitchRad);
        const gravY = Math.sin(rollRad) * Math.cos(pitchRad);
        const gravZ = Math.cos(rollRad) * Math.cos(pitchRad);
        const vibeAmp = burnNow ? 0.012 : (simState.mainDeployed ? 0.002 : 0.005);
        const vibe = vibeAmp * (
          Math.sin((tSec * 34) + 0.4) +
          (0.6 * Math.sin((tSec * 47) + 0.9)) +
          (0.3 * Math.sin((tSec * 68) + 1.4))
        );
        ax = gravX + forwardG + vibe;
        ay = gravY + rightG + (vibe * 0.56);
        az = gravZ + upG + (vibe * 0.32);
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
        const rollRad = padRollNow * DEG_TO_RAD;
        const pitchRad = padPitchNow * DEG_TO_RAD;
        const gravX = -Math.sin(pitchRad);
        const gravY = Math.sin(rollRad) * Math.cos(pitchRad);
        const gravZ = Math.cos(rollRad) * Math.cos(pitchRad);
        ax = gravX;
        ay = gravY;
        az = gravZ;
        gx = 0;
        gy = 0;
        gz = 0;
        simLat = baseLat;
        simLon = baseLon;
        simAlt = baseAlt;
        pressure = 0.22 + (0.01 * Math.sin((tSec * 1.3) + 0.2));
        thrust = 0.12 + (0.005 * Math.sin((tSec * 1.9) + 0.4));
      }
      simState.lastGeo = {lat:simLat, lon:simLon, alt:simAlt, ms:now};

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
        m: 2,
        gps_lat: simLat,
        gps_lon: simLon,
        gps_alt: simAlt
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
    function clearStatusMapTileProbeTimer(){
      if(statusMapState.tileProbeTimer){
        clearTimeout(statusMapState.tileProbeTimer);
        statusMapState.tileProbeTimer = null;
      }
    }
    function getStatusMapOfflineMarkerPosition(){
      const lonRange = STATUS_MAP_KR_BOUNDS.east - STATUS_MAP_KR_BOUNDS.west;
      const latRange = STATUS_MAP_KR_BOUNDS.north - STATUS_MAP_KR_BOUNDS.south;
      if(!(lonRange > 0) || !(latRange > 0)){
        return {left: 50, top: 50};
      }
      const lonNorm = (statusMapState.lon - STATUS_MAP_KR_BOUNDS.west) / lonRange;
      const latNorm = (STATUS_MAP_KR_BOUNDS.north - statusMapState.lat) / latRange;
      return {
        left: Math.max(8, Math.min(92, lonNorm * 100)),
        top: Math.max(8, Math.min(92, latNorm * 100))
      };
    }
    function ensureStatusMapOfflineLayer(){
      if(!el.statusMap) return null;
      let layer = el.statusMap.querySelector(".status-map-offline");
      if(layer) return layer;
      layer = document.createElement("div");
      layer.className = "status-map-offline";
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML =
        "<div class=\"status-map-offline-kr\"></div>" +
        "<div class=\"status-map-offline-jeju\"></div>" +
        "<div class=\"status-map-offline-marker\" aria-hidden=\"true\">🚀</div>" +
        "<div class=\"status-map-offline-label\">Offline map</div>";
      el.statusMap.appendChild(layer);
      return layer;
    }
    function updateStatusMapOfflineMarker(){
      if(!el.statusMap) return;
      const layer = el.statusMap.querySelector(".status-map-offline");
      if(!layer) return;
      const marker = layer.querySelector(".status-map-offline-marker");
      if(!marker) return;
      const pos = getStatusMapOfflineMarkerPosition();
      marker.style.left = pos.left.toFixed(2) + "%";
      marker.style.top = pos.top.toFixed(2) + "%";
    }
    function setStatusMapTileOffline(offline){
      const next = !!offline;
      statusMapState.tileOffline = next;
      if(!el.statusMap) return;
      el.statusMap.classList.toggle("status-map-canvas--offline", next);
      if(next){
        ensureStatusMapOfflineLayer();
        updateStatusMapOfflineMarker();
      }else{
        const layer = el.statusMap.querySelector(".status-map-offline");
        if(layer) layer.remove();
      }
      updateStatusMapHud();
    }
    function scheduleStatusMapTileProbe(){
      clearStatusMapTileProbeTimer();
      statusMapState.tileProbeTimer = setTimeout(()=>{
        statusMapState.tileProbeTimer = null;
        if(statusMapState.tileLoadCount > 0){
          setStatusMapTileOffline(false);
          return;
        }
        setStatusMapTileOffline(true);
      }, 2600);
    }
    function getStatusMapTileSource(index){
      const idx = Number(index);
      if(!Number.isInteger(idx)) return null;
      if(idx < 0 || idx >= STATUS_MAP_TILE_SOURCES.length) return null;
      return STATUS_MAP_TILE_SOURCES[idx];
    }
    function attachStatusMapTileLayer(map, koreaBounds, sourceIndex){
      if(!map || typeof window.L === "undefined") return false;
      const source = getStatusMapTileSource(sourceIndex);
      if(!source) return false;
      clearStatusMapTileProbeTimer();
      if(statusMapState.tileLayer){
        try{
          statusMapState.tileLayer.off();
          statusMapState.tileLayer.remove();
        }catch(e){}
        statusMapState.tileLayer = null;
      }
      statusMapState.tileLoadCount = 0;
      statusMapState.tileErrorCount = 0;
      statusMapState.tileSourceIndex = sourceIndex;
      const layerOptions = {
        bounds: koreaBounds,
        noWrap: true,
        minZoom: 6,
        maxZoom: 19,
        attribution: source.attribution || ""
      };
      if(source.subdomains) layerOptions.subdomains = source.subdomains;
      const tileLayer = window.L.tileLayer(source.url, layerOptions);
      const tryFallback = ()=>{
        if(statusMapState.tileLoadCount > 0) return false;
        const nextIndex = sourceIndex + 1;
        const nextSource = getStatusMapTileSource(nextIndex);
        if(!nextSource) return false;
        console.warn("[MAP] tile source fallback -> " + nextSource.id);
        return attachStatusMapTileLayer(map, koreaBounds, nextIndex);
      };
      tileLayer.on("loading", ()=>{
        scheduleStatusMapTileProbe();
      });
      tileLayer.on("tileload", ()=>{
        statusMapState.tileLoadCount += 1;
        if(statusMapState.tileOffline){
          setStatusMapTileOffline(false);
        }
      });
      tileLayer.on("tileerror", ()=>{
        statusMapState.tileErrorCount += 1;
        if(statusMapState.tileLoadCount > 0) return;
        if(statusMapState.tileErrorCount >= 2){
          if(!tryFallback()){
            setStatusMapTileOffline(true);
          }
        }
      });
      tileLayer.on("load", ()=>{
        if(statusMapState.tileLoadCount > 0){
          setStatusMapTileOffline(false);
          return;
        }
        if(statusMapState.tileErrorCount > 0){
          if(!tryFallback()){
            setStatusMapTileOffline(true);
          }
        }
      });
      tileLayer.addTo(map);
      statusMapState.tileLayer = tileLayer;
      scheduleStatusMapTileProbe();
      return true;
    }
    function syncStatusMapInteractionMode(){
      if(!statusMapState.map) return;
      const expanded = isStatusMapViewportExpanded();
      const lockCollapsed = isPhoneLandscapeLayout() && !expanded;
      const allow = !lockCollapsed;
      const map = statusMapState.map;
      const setLeafletHandler = (handler, on)=>{
        if(!handler || typeof handler.enable !== "function" || typeof handler.disable !== "function") return;
        if(on) handler.enable();
        else handler.disable();
      };
      setLeafletHandler(map.dragging, allow);
      setLeafletHandler(map.touchZoom, allow);
      setLeafletHandler(map.doubleClickZoom, allow);
      setLeafletHandler(map.scrollWheelZoom, allow);
      setLeafletHandler(map.boxZoom, allow);
      setLeafletHandler(map.keyboard, allow);
      if(map.tap) setLeafletHandler(map.tap, allow);
      if(lockCollapsed && statusMapState.hasLiveFix){
        const zoomVal = isFinite(map.getZoom()) ? map.getZoom() : statusMapState.zoom;
        map.setView([statusMapState.lat, statusMapState.lon], zoomVal, {animate:false});
      }
    }
    function updateStatusMapUserLocationMarker(lat, lon, accuracyM){
      if(!statusMapState.map || typeof window.L === "undefined") return;
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if(!isFinite(latNum) || !isFinite(lonNum)) return;
      const ll = [latNum, lonNum];
      const acc = Math.max(6, Math.min(4000, Number(accuracyM) || 16));
      if(!statusMapState.userAccuracyCircle){
        statusMapState.userAccuracyCircle = window.L.circle(ll, {
          radius: acc,
          color: "rgba(56,189,248,0.75)",
          weight: 1,
          fillColor: "rgba(56,189,248,0.26)",
          fillOpacity: 0.26,
          interactive: false
        }).addTo(statusMapState.map);
      }else{
        statusMapState.userAccuracyCircle.setLatLng(ll);
        statusMapState.userAccuracyCircle.setRadius(acc);
      }
      if(!statusMapState.userMarker){
        statusMapState.userMarker = window.L.circleMarker(ll, {
          radius: 5,
          color: "rgba(191,219,254,0.96)",
          weight: 2,
          fillColor: "#2563eb",
          fillOpacity: 0.95,
          interactive: false
        }).addTo(statusMapState.map);
      }else{
        statusMapState.userMarker.setLatLng(ll);
      }
      if(statusMapState.marker && statusMapState.marker.getElement){
        const markerEl = statusMapState.marker.getElement();
        if(markerEl && markerEl.parentNode && markerEl.parentNode.appendChild){
          markerEl.parentNode.appendChild(markerEl);
        }
      }
    }
    function startStatusMapUserLocationWatch(){
      if(!statusMapState.map) return;
      if(statusMapState.userWatchId != null) return;
      if(!navigator.geolocation || !window.isSecureContext) return;
      try{
        statusMapState.userWatchId = navigator.geolocation.watchPosition((pos)=>{
          if(!pos || !pos.coords) return;
          updateStatusMapUserLocationMarker(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        }, ()=>{
          statusMapState.userWatchId = null;
        }, {
          enableHighAccuracy: true,
          maximumAge: 12000,
          timeout: 14000
        });
      }catch(e){
        statusMapState.userWatchId = null;
      }
    }
    function isStatusMapViewportExpanded(){
      return !!(el.statusMapViewport && el.statusMapViewport.classList.contains("is-expanded"));
    }
    function moveStatusMapViewportToBody(){
      if(!el.statusMapViewport || statusMapViewportPortalState.mountedToBody) return;
      const parent = el.statusMapViewport.parentNode;
      if(!parent) return;
      statusMapViewportPortalState.homeParent = parent;
      statusMapViewportPortalState.homeNextSibling = el.statusMapViewport.nextSibling;
      document.body.appendChild(el.statusMapViewport);
      statusMapViewportPortalState.mountedToBody = true;
    }
    function restoreStatusMapViewportFromBody(){
      if(!el.statusMapViewport || !statusMapViewportPortalState.mountedToBody) return;
      const parent = statusMapViewportPortalState.homeParent;
      const nextSibling = statusMapViewportPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.statusMapViewport, nextSibling);
        }else{
          parent.appendChild(el.statusMapViewport);
        }
      }
      statusMapViewportPortalState.homeParent = null;
      statusMapViewportPortalState.homeNextSibling = null;
      statusMapViewportPortalState.mountedToBody = false;
    }
    function updateStatusMapExpandedViewportBounds(){
      if(!el.statusMapViewport || !isStatusMapViewportExpanded()) return;
      el.statusMapViewport.style.setProperty("--status-map-expand-left", "0px");
      el.statusMapViewport.style.setProperty("--status-map-expand-top", "0px");
      el.statusMapViewport.style.setProperty("--status-map-expand-right", "0px");
      el.statusMapViewport.style.setProperty("--status-map-expand-bottom", "0px");

      let hudLeft = window.innerWidth <= 900 ? 12 : 16;
      if(window.innerWidth > 900){
        const sideNavDesktop = document.querySelector(".side-nav-desktop");
        if(sideNavDesktop){
          const navRect = sideNavDesktop.getBoundingClientRect();
          if(navRect.width > 20){
            hudLeft = Math.max(hudLeft, Math.round(navRect.right + 10));
          }
        }
      }
      el.statusMapViewport.style.setProperty("--status-map-hud-left", hudLeft + "px");
    }
    function syncStatusMapExpandButton(){
      if(!el.statusMapExpandBtn) return;
      const expanded = isStatusMapViewportExpanded();
      el.statusMapExpandBtn.textContent = expanded ? "↙ Close" : "⛶";
      el.statusMapExpandBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
    function setStatusMapViewportExpanded(on){
      if(!el.statusMapViewport) return;
      const next = !!on;
      if(next && isGyroViewportExpanded()){
        setGyroViewportExpanded(false);
      }
      if(next){
        moveStatusMapViewportToBody();
        if(isPhoneLandscapeLayout()){
          moveGyroViewportToBody();
        }
      }
      el.statusMapViewport.classList.toggle("is-expanded", next);
      document.documentElement.classList.toggle("status-map-expanded", next);
      if(el.statusMapExpandedHud){
        el.statusMapExpandedHud.setAttribute("aria-hidden", next ? "false" : "true");
      }
      if(next){
        updateStatusMapExpandedViewportBounds();
        syncExpandedHud();
      }else{
        if(statusMapState.hasLiveFix){
          statusMapSetMarker(statusMapState.lat, statusMapState.lon, {recenter:true});
        }
        el.statusMapViewport.style.removeProperty("--status-map-expand-left");
        el.statusMapViewport.style.removeProperty("--status-map-expand-top");
        el.statusMapViewport.style.removeProperty("--status-map-expand-right");
        el.statusMapViewport.style.removeProperty("--status-map-expand-bottom");
        el.statusMapViewport.style.removeProperty("--status-map-hud-left");
        restoreStatusMapViewportFromBody();
        if(isPhoneLandscapeLayout() && !isGyroViewportExpanded()){
          restoreGyroViewportFromBody();
        }
      }
      syncStatusMapInteractionMode();
      syncStatusMapExpandButton();
      syncGyroExpandButton();
      refreshStatusMapSize();
      scheduleStatusMapRefresh();
      if(isPhoneLandscapeLayout()){
        requestAnimationFrame(()=>{
          resizeGyroGl();
          renderGyroPreview();
        });
      }
    }
    function bindStatusMapViewportInteractions(){
      if(statusMapViewportBindingsReady || !el.statusMapViewport) return;
      if(el.statusMapExpandBtn){
        el.statusMapExpandBtn.addEventListener("click", (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          setStatusMapViewportExpanded(!isStatusMapViewportExpanded());
        });
      }
      document.addEventListener("keydown", (ev)=>{
        if(!isStatusMapViewportExpanded()) return;
        if(ev.key === "Escape"){
          ev.preventDefault();
          setStatusMapViewportExpanded(false);
        }
      });
      const sideNavDesktop = document.querySelector(".side-nav-desktop");
      if(sideNavDesktop){
        const refreshExpandedHudInset = ()=>{
          if(isStatusMapViewportExpanded()) updateStatusMapExpandedViewportBounds();
        };
        sideNavDesktop.addEventListener("mouseenter", refreshExpandedHudInset);
        sideNavDesktop.addEventListener("mouseleave", refreshExpandedHudInset);
        sideNavDesktop.addEventListener("transitionend", refreshExpandedHudInset);
      }
      syncStatusMapExpandButton();
      statusMapViewportBindingsReady = true;
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
    function ensureStatusMapLeafletCss(){
      if(document.getElementById("statusMapLeafletCssFallback")) return;
      const link = document.createElement("link");
      link.id = "statusMapLeafletCssFallback";
      link.rel = "stylesheet";
      link.href = "vendor/leaflet/leaflet.css";
      document.head.appendChild(link);
    }
    function tryLoadStatusMapLeafletScript(){
      if(typeof window.L !== "undefined") return;
      if(statusMapState.leafletLoadInFlight) return;
      statusMapState.leafletLoadInFlight = true;
      statusMapState.leafletLoadFailed = false;
      const sources = [
        "vendor/leaflet/leaflet.js",
        "/vendor/leaflet/leaflet.js",
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      ];
      let idx = 0;
      const tryNext = ()=>{
        if(typeof window.L !== "undefined"){
          statusMapState.leafletLoadInFlight = false;
          statusMapState.leafletLoadFailed = false;
          initStatusMap();
          return;
        }
        if(idx >= sources.length){
          statusMapState.leafletLoadInFlight = false;
          statusMapState.leafletLoadFailed = true;
          setStatusMapTileOffline(true);
          updateStatusMapHud();
          return;
        }
        const src = sources[idx++];
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = ()=>{
          tryNext();
        };
        script.onerror = ()=>{
          if(script.parentNode) script.parentNode.removeChild(script);
          tryNext();
        };
        document.head.appendChild(script);
      };
      tryNext();
    }
    function updateStatusMapHud(){
      if(!el.statusMapCoordText || !el.statusMapZoomText) return;
      if(statusMapState.hasLiveFix){
        el.statusMapCoordText.textContent = formatStatusMapCoord(statusMapState.lat) + " , " + formatStatusMapCoord(statusMapState.lon);
      }else{
        el.statusMapCoordText.textContent = "-- , --";
      }
      if(!statusMapState.map && typeof window.L === "undefined"){
        if(statusMapState.leafletLoadInFlight){
          el.statusMapZoomText.textContent = "map loading...";
        }else if(statusMapState.leafletLoadFailed){
          el.statusMapZoomText.textContent = "map unavailable";
        }else{
          el.statusMapZoomText.textContent = "zoom " + String(statusMapState.zoom);
        }
        return;
      }
      if(statusMapState.tileOffline){
        el.statusMapZoomText.textContent = "offline map";
        return;
      }
      const zoomVal = (statusMapState.map && isFinite(statusMapState.map.getZoom())) ? statusMapState.map.getZoom() : statusMapState.zoom;
      el.statusMapZoomText.textContent = "zoom " + String(zoomVal);
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
    function isFlightModeUi(){
      return getStatusMapPopupMode() === "flight";
    }
    function syncOperationModeToBoard(logIt){
      const mode = isFlightModeUi() ? "flight" : "daq";
      sendCommand({http:"/set?op_mode=" + mode, ser:"/set?op_mode=" + mode}, !!logIt);
    }
    function syncDaqSequencePyroChannelToBoard(logIt){
      const channel = normalizePyroChannel(uiSettings && uiSettings.daqSequencePyroChannel, 1);
      sendCommand({http:"/set?daq_seq_pyro=" + channel, ser:"/set?daq_seq_pyro=" + channel}, !!logIt);
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
      updateStatusMapOfflineMarker();
      if(opt && opt.recenter && statusMapState.map){
        const zoomVal = isFinite(Number(opt.zoom)) ? Number(opt.zoom) : statusMapState.map.getZoom();
        statusMapState.map.setView([clamped.lat, clamped.lon], zoomVal);
      }
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
    function extractTelemetryGeo(data, opt){
      if(!data || typeof data !== "object") return null;
      const gps = (data.gps && typeof data.gps === "object") ? data.gps : null;
      const latRaw = data.gps_lat ?? data.gpsLat ?? data.gpsLatitude ?? data.nav_lat ?? (gps ? (gps.lat ?? gps.latitude ?? null) : null);
      const lonRaw = data.gps_lon ?? data.gps_lng ?? data.gpsLon ?? data.gpsLng ?? data.gpsLongitude ?? data.nav_lon ?? data.nav_lng ?? (gps ? (gps.lon ?? gps.lng ?? gps.longitude ?? null) : null);
      const latNum = Number(latRaw);
      const lonNum = Number(lonRaw);
      if(!isFinite(latNum) || !isFinite(lonNum)) return null;
      if(Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) return null;
      if(Math.abs(latNum) < 1e-7 && Math.abs(lonNum) < 1e-7) return null;
      if(opt && opt.koreaOnly && !isStatusMapInKorea(latNum, lonNum)) return null;
      const altRaw = data.gps_alt ?? data.gpsAlt ?? data.gpsAltitude ?? data.nav_alt ??
        (gps ? (gps.alt ?? gps.altitude ?? null) : null);
      const altNum = Number(altRaw);
      return {
        lat: latNum,
        lon: lonNum,
        alt: isFinite(altNum) ? altNum : NaN
      };
    }
    function extractTelemetryLatLon(data){
      const geo = extractTelemetryGeo(data, {koreaOnly:true});
      if(!geo) return null;
      return {lat:geo.lat, lon:geo.lon};
    }
    function updateStatusMapFromTelemetry(data){
      const pos = extractTelemetryLatLon(data);
      if(!pos) return;
      const now = Date.now();
      if((now - statusMapState.lastUpdateMs) < 700 && statusMapState.hasLiveFix) return;
      statusMapState.lastUpdateMs = now;
      const shouldRecenter = !isStatusMapViewportExpanded() || !statusMapState.hasLiveFix;
      statusMapState.hasLiveFix = true;
      statusMapSetMarker(pos.lat, pos.lon, {recenter: shouldRecenter});
    }
    function updateGyroPathFromTelemetry(data, nowMs, imuSample){
      const stateHint = Number(
        (imuSample && imuSample.st != null)
          ? imuSample.st
          : (data && typeof data === "object"
              ? (data.st != null ? data.st : (data.state ?? currentSt))
              : currentSt)
      );
      const motionActive = localTplusActive || (stateHint === 2);
      if(!motionActive){
        return;
      }
      const geo = extractTelemetryGeo(data, {koreaOnly:false}) ||
        (simEnabled && !replaySourceActive && simState && simState.lastGeo ? simState.lastGeo : null);
      const now = nowMs || Date.now();
      if(geo){
        updateGyroPathFromGeo(geo, now);
        return;
      }
      const flight = getQuickFlightMetrics(data, now);
      const altitudeOnlyM = Number(flight && flight.altitudeM);
      if(isFinite(altitudeOnlyM)){
        updateGyroPathFromAltGyro(altitudeOnlyM, now);
        return;
      }
      let sample = imuSample || null;
      if(!sample && data && typeof data === "object"){
        sample = {
          ax: Number(data.ax != null ? data.ax : (data.accel_x ?? data.ax_g ?? 0)),
          ay: Number(data.ay != null ? data.ay : (data.accel_y ?? data.ay_g ?? 0)),
          az: Number(data.az != null ? data.az : (data.accel_z ?? data.az_g ?? 0)),
          st: Number(data.st != null ? data.st : (data.state ?? currentSt))
        };
      }
      updateGyroPathFromImuSample(sample, now);
    }
    function resetQuickFlightMetricsState(){
      quickFlightMetrics.originAlt = NaN;
      quickFlightMetrics.originPressureMpa = SEA_LEVEL_PRESSURE_MPA;
      quickFlightMetrics.lastLat = NaN;
      quickFlightMetrics.lastLon = NaN;
      quickFlightMetrics.lastAlt = NaN;
      quickFlightMetrics.lastMs = 0;
      quickFlightMetrics.speedMps = NaN;
    }
    function readQuickTelemetrySpeedMps(data){
      if(!data || typeof data !== "object") return NaN;
      const candidates = [
        data.gps_speed_mps, data.gpsSpeedMps,
        data.ground_speed_mps, data.groundSpeedMps,
        data.speed_mps, data.speedMps,
        data.gps_speed, data.gpsSpeed,
        data.speed, data.spd, data.vel, data.v
      ];
      for(let i=0;i<candidates.length;i++){
        const val = Number(candidates[i]);
        if(isFinite(val)) return Math.max(0, val);
      }
      return NaN;
    }
    function getQuickFlightMetrics(data, nowMs){
      const now = nowMs || Date.now();
      let altitudeM = NaN;
      let speedMps = readQuickTelemetrySpeedMps(data);
      const useSimFlightMetrics = !!(simEnabled && !replaySourceActive && simState);

      if(useSimFlightMetrics){
        if(isFinite(simState.altM)) altitudeM = simState.altM;
        const vE = Number(simState.velE);
        const vN = Number(simState.velN);
        const vU = Number(simState.velU);
        if(!isFinite(speedMps) && isFinite(vE) && isFinite(vN) && isFinite(vU)){
          speedMps = Math.hypot(vE, vN, vU);
        }
      }
      if(!isFinite(altitudeM) && data && typeof data === "object"){
        const altCandidates = [
          data.alt_m, data.altitude_m, data.altitude, data.alt,
          data.gps_alt, data.gpsAlt, data.nav_alt
        ];
        let altAbs = NaN;
        for(let i=0;i<altCandidates.length;i++){
          const val = Number(altCandidates[i]);
          if(isFinite(val)){
            altAbs = val;
            break;
          }
        }
        if(isFinite(altAbs)){
          if(!isFinite(quickFlightMetrics.originAlt)) quickFlightMetrics.originAlt = altAbs;
          if(isFinite(quickFlightMetrics.originAlt)){
            altitudeM = altAbs - quickFlightMetrics.originAlt;
          }else{
            altitudeM = altAbs;
          }
        }
      }

      // Fallback: derive relative altitude from absolute barometric pressure (BMP388).
      if(!isFinite(altitudeM) && data && typeof data === "object"){
        const pressureMpa = parsePressureMpa(data);
        if(isFinite(pressureMpa) && pressureMpa > 0.03 && pressureMpa < 0.2){
          const p0 = quickFlightMetrics.originPressureMpa;
          if(isFinite(p0) && p0 > 0){
            const ratio = pressureMpa / p0;
            if(isFinite(ratio) && ratio > 0){
              const h = 44330.0 * (1.0 - Math.pow(ratio, 0.19029495718363465));
              if(isFinite(h)){
                altitudeM = (Math.abs(h) < 0.05) ? 0 : h;
              }
            }
          }
        }
      }

      const geo = extractTelemetryGeo(data, {koreaOnly:false}) ||
        (useSimFlightMetrics && simState && simState.lastGeo ? simState.lastGeo : null);
      if(geo){
        if(!isFinite(quickFlightMetrics.originAlt)) quickFlightMetrics.originAlt = geo.alt;
        if(isFinite(quickFlightMetrics.originAlt)){
          altitudeM = geo.alt - quickFlightMetrics.originAlt;
        }else if(isFinite(geo.alt)){
          altitudeM = geo.alt;
        }

        if(
          isFinite(quickFlightMetrics.lastLat) &&
          isFinite(quickFlightMetrics.lastLon) &&
          quickFlightMetrics.lastMs > 0
        ){
          const dtSec = (now - quickFlightMetrics.lastMs) / 1000;
          if(isFinite(dtSec) && dtSec > 0.08 && dtSec < 4){
            const latAvg = ((geo.lat + quickFlightMetrics.lastLat) * 0.5) * DEG_TO_RAD;
            const dNorth = (geo.lat - quickFlightMetrics.lastLat) * 111320;
            const dEast = (geo.lon - quickFlightMetrics.lastLon) * (111320 * Math.cos(latAvg));
            const dUp = (isFinite(geo.alt) && isFinite(quickFlightMetrics.lastAlt))
              ? (geo.alt - quickFlightMetrics.lastAlt)
              : 0;
            const rawSpeed = Math.hypot(dNorth, dEast, dUp) / dtSec;
            if(isFinite(rawSpeed)){
              if(isFinite(quickFlightMetrics.speedMps)){
                quickFlightMetrics.speedMps += (rawSpeed - quickFlightMetrics.speedMps) * 0.34;
              }else{
                quickFlightMetrics.speedMps = rawSpeed;
              }
              if(!isFinite(speedMps)) speedMps = quickFlightMetrics.speedMps;
            }
          }
        }

        quickFlightMetrics.lastLat = geo.lat;
        quickFlightMetrics.lastLon = geo.lon;
        quickFlightMetrics.lastAlt = isFinite(geo.alt) ? geo.alt : NaN;
        quickFlightMetrics.lastMs = now;
      }

      if(!isFinite(speedMps) && isFinite(quickFlightMetrics.speedMps)){
        speedMps = quickFlightMetrics.speedMps;
      }
      return {altitudeM, speedMps};
    }
    function updateQuickMetricLabels(){
      const inFlightMode = isFlightModeUi();
      const primaryLabel = inFlightMode ? "Altitude" : "Thrust";
      const secondaryLabel = inFlightMode ? "Speed" : "Pressure";
      if(el.quickMetricPrimaryLabel){
        el.quickMetricPrimaryLabel.textContent = primaryLabel;
      }
      if(el.quickMetricSecondaryLabel){
        el.quickMetricSecondaryLabel.textContent = secondaryLabel;
      }
      if(el.statusMapHudMetricPrimaryLabel) el.statusMapHudMetricPrimaryLabel.textContent = primaryLabel;
      if(el.statusMapHudMetricSecondaryLabel) el.statusMapHudMetricSecondaryLabel.textContent = secondaryLabel;
      if(el.gyro3dHudMetricPrimaryLabel) el.gyro3dHudMetricPrimaryLabel.textContent = primaryLabel;
      if(el.gyro3dHudMetricSecondaryLabel) el.gyro3dHudMetricSecondaryLabel.textContent = secondaryLabel;
    }
    function formatQuickGyroDeg(value){
      const deg = Number(value);
      if(!isFinite(deg)){
        return `<span class="num">0.0</span><span class="unit">deg</span>`;
      }
      return `<span class="num">${deg.toFixed(1)}</span><span class="unit">deg</span>`;
    }
    function updateQuickAuxLabels(){
      const inFlightMode = isFlightModeUi();
      const quickRelay2Item = el.quickRelay2 ? el.quickRelay2.closest(".item") : null;
      const quickNull3Item = el.quickNull3Value ? el.quickNull3Value.closest(".item") : null;
      if(el.quickDelayLabel){
        el.quickDelayLabel.innerHTML = `<span class="label-icon"></span>${t("labelDelay")}`;
      }
      if(el.quickBurnLabel){
        el.quickBurnLabel.innerHTML = `<span class="label-icon"></span>${inFlightMode ? "GYRO Y" : "Burn"}`;
      }
      if(el.quickRelay1Label){
        el.quickRelay1Label.innerHTML = `<span class="label-icon"></span>PYRO`;
      }
      if(el.quickRelay2Label){
        el.quickRelay2Label.innerHTML = `<span class="label-icon"></span>GYRO X`;
      }
      if(el.quickHxHzLabel){
        el.quickHxHzLabel.innerHTML = `<span class="label-icon"></span>${inFlightMode ? "NULL" : "LOADCELL"}`;
      }
      if(el.quickNullLabel){
        el.quickNullLabel.innerHTML = `<span class="label-icon"></span>${inFlightMode ? "GYRO Z" : "SD CARD"}`;
      }
      if(el.quickNull2Label){
        el.quickNull2Label.innerHTML = `<span class="label-icon"></span>NULL`;
      }
      if(el.quickNull3Label){
        el.quickNull3Label.innerHTML = `<span class="label-icon"></span>NULL`;
      }
      if(quickRelay2Item){
        quickRelay2Item.classList.toggle("hidden", !inFlightMode);
      }
      if(quickNull3Item){
        quickNull3Item.classList.toggle("hidden", inFlightMode);
      }
      if(inFlightMode){
        if(el.quickRelay2) el.quickRelay2.innerHTML = formatQuickGyroDeg(NaN);
        if(el.quickHxHz) el.quickHxHz.innerHTML = `<span class="num">null</span>`;
        if(el.quickNullValue) el.quickNullValue.innerHTML = formatQuickGyroDeg(NaN);
        if(el.quickNull2Value) el.quickNull2Value.innerHTML = `<span class="num">null</span>`;
        if(el.quickNull3Value) el.quickNull3Value.innerHTML = `<span class="num">null</span>`;
      }else{
        if(el.quickHxHz) el.quickHxHz.innerHTML = `<span class="num">--</span><span class="unit">Hz</span>`;
        if(el.quickNullValue){
          el.quickNullValue.innerHTML = `<span class="num">--</span>`;
        }
        if(el.quickNull2Value){
          el.quickNull2Value.innerHTML = `<span class="num">null</span>`;
        }
        if(el.quickNull3Value){
          el.quickNull3Value.innerHTML = `<span class="num">null</span>`;
        }
      }
    }
    function buildPhoneLandscapeMetricCaption(metricHtml, fallback){
      if(!metricHtml) return fallback || "--";
      const temp = document.createElement("div");
      temp.innerHTML = metricHtml;
      const num = temp.querySelector(".num") ? temp.querySelector(".num").textContent.trim() : temp.textContent.trim();
      const unit = temp.querySelector(".unit") ? temp.querySelector(".unit").textContent.trim().toLowerCase() : "";
      const value = [num, unit].filter(Boolean).join(" ").trim();
      return value ? ("max " + value) : (fallback || "--");
    }
    function syncExpandedQuickMetrics(){
      const primaryHtml = el.thrust ? el.thrust.innerHTML : "--";
      const secondaryHtml = el.pressure ? el.pressure.innerHTML : "--";
      const primaryAlert = !!(el.thrust && el.thrust.closest(".status-metric") && el.thrust.closest(".status-metric").classList.contains("is-alert"));
      const secondaryAlert = !!(el.pressure && el.pressure.closest(".status-metric") && el.pressure.closest(".status-metric").classList.contains("is-alert"));
      const phoneFlightMode = isPhoneLandscapeLayout() && isFlightModeUi();

      if(el.statusMapHudMetricPrimaryValue) el.statusMapHudMetricPrimaryValue.innerHTML = primaryHtml;
      if(el.statusMapHudMetricSecondaryValue) el.statusMapHudMetricSecondaryValue.innerHTML = secondaryHtml;
      if(el.gyro3dHudMetricPrimaryValue) el.gyro3dHudMetricPrimaryValue.innerHTML = primaryHtml;
      if(el.gyro3dHudMetricSecondaryValue) el.gyro3dHudMetricSecondaryValue.innerHTML = secondaryHtml;

      if(phoneFlightMode){
        const primaryCaption = buildPhoneLandscapeMetricCaption(primaryHtml, "max --");
        const secondaryCaption = buildPhoneLandscapeMetricCaption(secondaryHtml, "max --");
        if(el.statusMapHudMetricPrimaryLabel) el.statusMapHudMetricPrimaryLabel.textContent = primaryCaption;
        if(el.statusMapHudMetricSecondaryLabel) el.statusMapHudMetricSecondaryLabel.textContent = secondaryCaption;
        if(el.gyro3dHudMetricPrimaryLabel) el.gyro3dHudMetricPrimaryLabel.textContent = primaryCaption;
        if(el.gyro3dHudMetricSecondaryLabel) el.gyro3dHudMetricSecondaryLabel.textContent = secondaryCaption;
      }

      if(el.statusMapHudMetricPrimaryCard) el.statusMapHudMetricPrimaryCard.classList.toggle("is-alert", primaryAlert);
      if(el.statusMapHudMetricSecondaryCard) el.statusMapHudMetricSecondaryCard.classList.toggle("is-alert", secondaryAlert);
      if(el.gyro3dHudMetricPrimaryCard) el.gyro3dHudMetricPrimaryCard.classList.toggle("is-alert", primaryAlert);
      if(el.gyro3dHudMetricSecondaryCard) el.gyro3dHudMetricSecondaryCard.classList.toggle("is-alert", secondaryAlert);
    }
    function syncExpandedHud(){
      updateQuickMetricLabels();
      syncExpandedQuickMetrics();
      syncGyroExpandedHud();
      syncStatusMapExpandedHud();
    }
    function refreshStatusMapSize(){
      if(isStatusMapViewportExpanded()){
        updateStatusMapExpandedViewportBounds();
      }
      if(!statusMapState.map) return;
      try{ statusMapState.map.invalidateSize(); }catch(e){}
    }
    function scheduleStatusMapRefresh(){
      if(statusMapRefreshRaf) cancelAnimationFrame(statusMapRefreshRaf);
      statusMapRefreshRaf = requestAnimationFrame(()=>{
        statusMapRefreshRaf = null;
        refreshStatusMapSize();
      });
      if(statusMapRefreshTimers.length){
        statusMapRefreshTimers.forEach(timer=>clearTimeout(timer));
      }
      statusMapRefreshTimers = [120, 320, 720].map(delay=>setTimeout(refreshStatusMapSize, delay));
    }
    function initStatusMap(){
      if(!el.statusMap || statusMapState.map) return;
      bindStatusMapViewportInteractions();
      bindStatusMapControls();
      ensureStatusMapLeafletCss();
      if(typeof window.L === "undefined"){
        tryLoadStatusMapLeafletScript();
        console.warn("Status map init pending: Leaflet unavailable.");
        updateStatusMapHud();
        return;
      }
      statusMapState.leafletLoadFailed = false;
      statusMapState.tileLoadCount = 0;
      statusMapState.tileErrorCount = 0;
      statusMapState.tileLayer = null;
      clearStatusMapTileProbeTimer();
      setStatusMapTileOffline(false);
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
      if(!attachStatusMapTileLayer(map, koreaBounds, 0)){
        setStatusMapTileOffline(true);
      }
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
      syncStatusMapInteractionMode();
      startStatusMapUserLocationWatch();
      updateStatusMapHud();
      scheduleStatusMapRefresh();
      if(window.ResizeObserver && el.statusMapViewport && !statusMapResizeObserver){
        statusMapResizeObserver = new ResizeObserver(()=>{ scheduleStatusMapRefresh(); });
        statusMapResizeObserver.observe(el.statusMapViewport);
      }
    }

    function syncCountdownInlineStatus(){
      if(!el.countdownInlineStatus || !el.countdownInlineStatusText || !el.countdownInlineStatusPill) return;
      const statusTextRaw = (el.statusText && el.statusText.textContent) ? el.statusText.textContent.trim() : "";
      const statusText = resolveMobileHudStatusText(statusTextRaw);
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
      syncExpandedHud();
    }

    function syncGyroExpandedHud(){
      if(!el.gyro3dHudCountdown || !el.gyro3dHudStatusText || !el.gyro3dHudStatusPill || !el.gyro3dHudConn || !el.gyro3dHudBattery) return;
      if(el.gyro3dHudTitle) el.gyro3dHudTitle.textContent = "DASHBOARD";

      const countdownText = (el.countdown && el.countdown.textContent) ? el.countdown.textContent.trim() : "T- --:--:--";
      const statusTextRaw = (el.statusText && el.statusText.textContent) ? el.statusText.textContent.trim() : "";
      const statusText = resolveMobileHudStatusText(statusTextRaw);
      const pillTextRaw = (el.statusPill && el.statusPill.textContent) ? el.statusPill.textContent.trim() : "";
      const connText = (el.connStatusText && el.connStatusText.textContent) ? el.connStatusText.textContent.trim() : (connOk ? "CONNECTED · -- Hz" : "DISCONNECTED · -- Hz");
      const pathMeta = getGyroPathSourceMeta();
      const battText = (el.batteryStatus && el.batteryStatus.textContent) ? el.batteryStatus.textContent.trim() : "--%";
      const compactConnText = connOk ? (((rxHzWindow > 0 && isFinite(rxHzWindow)) ? rxHzWindow.toFixed(0) : "--") + "Hz") : "--Hz";
      const compactBatteryText = battText.replace(/[^0-9]/g, "").slice(0, 3) || "--";
      const compactTimeText = getCompactHudClockText();
      const showCompactClock = !!(sequenceActive || currentSt === 1 || currentSt === 2 || localTplusActive);
      const pathText = pathMeta.show ? (pathMeta.label + " " + pathMeta.confidence) : "";
      const statusDisplayText = pathText ? ((statusText || "--") + " · " + pathText) : (statusText || "--");
      const connDisplayText = pathMeta.lowConfidence ? ((connText || "--") + " · EST") : (connText || "--");

      el.gyro3dHudCountdown.textContent = countdownText || "T- --:--:--";
      el.gyro3dHudStatusText.textContent = statusDisplayText;
      el.gyro3dHudConn.textContent = connDisplayText;
      el.gyro3dHudBattery.textContent = battText || "--%";
      if(el.gyro3dHudConnCompact) el.gyro3dHudConnCompact.textContent = compactConnText;
      if(el.gyro3dHudBatteryCompact) el.gyro3dHudBatteryCompact.textContent = compactBatteryText;
      if(el.gyro3dHudTimeCompact) el.gyro3dHudTimeCompact.textContent = compactTimeText;
      if(el.gyro3dHudClockCompact) el.gyro3dHudClockCompact.classList.toggle("hidden", !showCompactClock);

      const pillClasses = ["countdown-inline-status-pill", "gyro3d-expanded-hud-pill"];
      if(el.statusPill){
        const clsList = (el.statusPill.className || "").split(/\s+/);
        for(const cls of clsList){
          if(!cls || cls === "hidden") continue;
          if(/^status-/.test(cls)) pillClasses.push(cls);
        }
      }
      el.gyro3dHudStatusPill.className = pillClasses.join(" ");
      if(pillTextRaw){
        el.gyro3dHudStatusPill.textContent = pillTextRaw;
        el.gyro3dHudStatusPill.classList.remove("hidden");
      }else{
        el.gyro3dHudStatusPill.textContent = "--";
        el.gyro3dHudStatusPill.classList.add("hidden");
      }
      if(el.gyro3dHudStatusInline){
        const hasContent = !!(statusText || pillTextRaw);
        el.gyro3dHudStatusInline.classList.toggle("hidden", !hasContent);
      }
      if(el.gyro3dHudStatusBar){
        el.gyro3dHudStatusBar.className = "status-bar gyro3d-expanded-statusbar";
        const online = !!(el.statusBar && el.statusBar.classList.contains("is-online"));
        el.gyro3dHudStatusBar.classList.add(online ? "is-online" : "is-offline");
      }
      if(el.gyro3dHudBatteryWrap){
        el.gyro3dHudBatteryWrap.className = "status-battery";
        const sourceBatteryWrap = el.batteryStatus ? el.batteryStatus.closest(".status-battery") : null;
        if(sourceBatteryWrap){
          if(sourceBatteryWrap.classList.contains("status-ok")) el.gyro3dHudBatteryWrap.classList.add("status-ok");
          else if(sourceBatteryWrap.classList.contains("status-warn")) el.gyro3dHudBatteryWrap.classList.add("status-warn");
          else if(sourceBatteryWrap.classList.contains("status-bad")) el.gyro3dHudBatteryWrap.classList.add("status-bad");
        }
      }
      if(el.gyro3dHudBatteryFill){
        let fillWidth = "";
        if(el.batteryFill && el.batteryFill.style && el.batteryFill.style.width){
          fillWidth = el.batteryFill.style.width.trim();
        }
        if(!fillWidth) fillWidth = "45%";
        el.gyro3dHudBatteryFill.style.width = fillWidth;
      }
    }
    function syncStatusMapExpandedHud(){
      if(!el.statusMapHudCountdown || !el.statusMapHudStatusText || !el.statusMapHudStatusPill || !el.statusMapHudConn || !el.statusMapHudBattery) return;
      if(el.statusMapHudTitle) el.statusMapHudTitle.textContent = "DASHBOARD";

      const countdownText = (el.countdown && el.countdown.textContent) ? el.countdown.textContent.trim() : "T- --:--:--";
      const statusTextRaw = (el.statusText && el.statusText.textContent) ? el.statusText.textContent.trim() : "";
      const statusText = resolveMobileHudStatusText(statusTextRaw);
      const pillTextRaw = (el.statusPill && el.statusPill.textContent) ? el.statusPill.textContent.trim() : "";
      const connText = (el.connStatusText && el.connStatusText.textContent) ? el.connStatusText.textContent.trim() : (connOk ? "CONNECTED · -- Hz" : "DISCONNECTED · -- Hz");
      const pathMeta = getGyroPathSourceMeta();
      const battText = (el.batteryStatus && el.batteryStatus.textContent) ? el.batteryStatus.textContent.trim() : "--%";
      const compactConnText = connOk ? (((rxHzWindow > 0 && isFinite(rxHzWindow)) ? rxHzWindow.toFixed(0) : "--") + "Hz") : "--Hz";
      const compactBatteryText = battText.replace(/[^0-9]/g, "").slice(0, 3) || "--";
      const compactTimeText = getCompactHudClockText();
      const showCompactClock = !!(sequenceActive || currentSt === 1 || currentSt === 2 || localTplusActive);
      const pathText = pathMeta.show ? (pathMeta.label + " " + pathMeta.confidence) : "";
      const statusDisplayText = pathText ? ((statusText || "--") + " · " + pathText) : (statusText || "--");
      const connDisplayText = pathMeta.lowConfidence ? ((connText || "--") + " · EST") : (connText || "--");

      el.statusMapHudCountdown.textContent = countdownText || "T- --:--:--";
      el.statusMapHudStatusText.textContent = statusDisplayText;
      el.statusMapHudConn.textContent = connDisplayText;
      el.statusMapHudBattery.textContent = battText || "--%";
      if(el.statusMapHudConnCompact) el.statusMapHudConnCompact.textContent = compactConnText;
      if(el.statusMapHudBatteryCompact) el.statusMapHudBatteryCompact.textContent = compactBatteryText;
      if(el.statusMapHudTimeCompact) el.statusMapHudTimeCompact.textContent = compactTimeText;
      if(el.statusMapHudClockCompact) el.statusMapHudClockCompact.classList.toggle("hidden", !showCompactClock);

      const pillClasses = ["countdown-inline-status-pill", "gyro3d-expanded-hud-pill"];
      if(el.statusPill){
        const clsList = (el.statusPill.className || "").split(/\s+/);
        for(const cls of clsList){
          if(!cls || cls === "hidden") continue;
          if(/^status-/.test(cls)) pillClasses.push(cls);
        }
      }
      el.statusMapHudStatusPill.className = pillClasses.join(" ");
      if(pillTextRaw){
        el.statusMapHudStatusPill.textContent = pillTextRaw;
        el.statusMapHudStatusPill.classList.remove("hidden");
      }else{
        el.statusMapHudStatusPill.textContent = "--";
        el.statusMapHudStatusPill.classList.add("hidden");
      }
      if(el.statusMapHudStatusInline){
        const hasContent = !!(statusText || pillTextRaw);
        el.statusMapHudStatusInline.classList.toggle("hidden", !hasContent);
      }
      if(el.statusMapHudStatusBar){
        el.statusMapHudStatusBar.className = "status-bar gyro3d-expanded-statusbar";
        const online = !!(el.statusBar && el.statusBar.classList.contains("is-online"));
        el.statusMapHudStatusBar.classList.add(online ? "is-online" : "is-offline");
      }
      if(el.statusMapHudBatteryWrap){
        el.statusMapHudBatteryWrap.className = "status-battery";
        const sourceBatteryWrap = el.batteryStatus ? el.batteryStatus.closest(".status-battery") : null;
        if(sourceBatteryWrap){
          if(sourceBatteryWrap.classList.contains("status-ok")) el.statusMapHudBatteryWrap.classList.add("status-ok");
          else if(sourceBatteryWrap.classList.contains("status-warn")) el.statusMapHudBatteryWrap.classList.add("status-warn");
          else if(sourceBatteryWrap.classList.contains("status-bad")) el.statusMapHudBatteryWrap.classList.add("status-bad");
        }
      }
      if(el.statusMapHudBatteryFill){
        let fillWidth = "";
        if(el.batteryFill && el.batteryFill.style && el.batteryFill.style.width){
          fillWidth = el.batteryFill.style.width.trim();
        }
        if(!fillWidth) fillWidth = "45%";
        el.statusMapHudBatteryFill.style.width = fillWidth;
      }
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
    function clampServoAngle(value){
      let deg = Number(value);
      if(!isFinite(deg)) deg = SERVO_DEFAULT_DEG;
      if(deg < SERVO_MIN_DEG) deg = SERVO_MIN_DEG;
      if(deg > SERVO_MAX_DEG) deg = SERVO_MAX_DEG;
      return Math.round(deg);
    }
    function setServoUiAngle(channel, angleDeg){
      const row = servoUiMap[channel];
      if(!row) return;
      const deg = clampServoAngle(angleDeg);
      if(row.range) row.range.value = String(deg);
      if(row.value) row.value.textContent = deg + "°";
    }
    function setServoUiPin(channel, pin){
      const row = servoUiMap[channel];
      if(!row || !row.pin) return;
      if(pin == null || !isFinite(Number(pin))) row.pin.textContent = "-";
      else row.pin.textContent = String(Math.round(Number(pin)));
    }
    function updateServoInfoUI(info){
      if(!info || !Array.isArray(info.channels)) return;
      for(const item of info.channels){
        const ch = Number(item && (item.id != null ? item.id : item.ch));
        if(!isFinite(ch) || SERVO_CHANNELS.indexOf(ch) < 0) continue;
        setServoUiPin(ch, item.pin);
        setServoUiAngle(ch, item.angle);
      }
    }
    async function fetchServoInfo(){
      if(simEnabled) return;
      if(isLocalPreviewHost()) return;
      try{
        const info = await fetchJsonTimeout("/servo", 700);
        servoInfo = info;
        servoInfoLastMs = Date.now();
        servoInfoWarned = false;
        updateServoInfoUI(info);
      }catch(e){
        if(!servoInfo || (Date.now() - servoInfoLastMs) > 5000){
          updateServoInfoUI(null);
          if(!servoInfoWarned){
            servoInfoWarned = true;
            showToast("서보 API 응답이 없습니다. 펌웨어/업로드 상태를 확인하세요.", "warn", {
              key:"servo-api-offline",
              duration:2800
            });
          }
        }
      }
    }
    async function sendServoCommand(channel, deg){
      const path = "/servo?ch=" + channel + "&deg=" + deg;
      if(simEnabled){
        handleSimCommand({ http:path, ser:"SERVO " + channel + " " + deg });
        return { ok:true, reason:"SIM" };
      }

      const serialMode = !!serialEnabled;
      const canSerial = !!(serialMode && serialConnected && serialTxEnabled);
      let serialReason = "";
      if(canSerial){
        try{
          const ackPattern = new RegExp("^PWM" + String(channel) + "\\s*=\\s*(-?\\d+)$", "i");
          const sendOneSerialServo = async (lineToSend)=>{
            const waiter = createSerialAckWaiter((evt)=>{
              if(evt.kind === "err") return true;
              if(evt.kind !== "ack") return false;
              const msg = String(evt.message || "").trim();
              return ackPattern.test(msg);
            }, SERVO_SERIAL_REPLY_TIMEOUT_MS);
            const wrote = await serialWriteLine(lineToSend);
            if(!wrote){
              cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
              return { ok:false, reason:"SERIAL_WRITE_FAIL" };
            }
            const reply = await waiter.promise;
            if(!reply.ok){
              return { ok:false, reason:reply.message || "SERIAL_NO_REPLY" };
            }
            const m = String(reply.message || "").trim().match(ackPattern);
            const appliedDeg = m ? clampServoAngle(Number(m[1])) : deg;
            return { ok:true, reason:"SERIAL_ACK", appliedDeg };
          };

          // 1차: REST 형태(/servo?...), 2차: 레거시(SERVO ch deg) 폴백
          let serialResult = await sendOneSerialServo(path);
          if(!serialResult.ok){
            serialResult = await sendOneSerialServo("SERVO " + channel + " " + deg);
          }
          if(serialResult.ok){
            return { ok:true, reason:serialResult.reason || "SERIAL_ACK", appliedDeg:serialResult.appliedDeg };
          }
          serialReason = serialResult.reason || "SERIAL_NO_REPLY";
        }catch(e){
          serialReason = (e && e.message) ? e.message : "SERIAL_ERROR";
        }
      }else if(serialMode && !serialConnected){
        serialReason = "SERIAL_DISCONNECTED";
      }else if(serialMode && serialConnected && !serialTxEnabled){
        serialReason = "SERIAL_TX_DISABLED";
      }

      if(serialMode){
        return { ok:false, reason:serialReason || "SERIAL_NOT_READY" };
      }

      const API_BASE = getApiBaseForCommands();
      const url = API_BASE ? (API_BASE + path) : path;
      const opt = API_BASE ? { mode:"no-cors", cache:"no-cache" } : { cache:"no-cache" };

      try{
        const res = await fetch(url, opt);
        if(!API_BASE && !res.ok){
          let bodyText = "";
          try{ bodyText = (await res.text()) || ""; }catch(e){}
          const reason = bodyText.trim() || ("HTTP " + res.status);
          if(serialReason){
            return { ok:false, reason:serialReason + " / " + reason };
          }
          return { ok:false, reason };
        }
      }catch(err){
        reportSilentException("servo-http", err);
        const reason = (err && err.message) ? err.message : "NETWORK_ERROR";
        if(serialReason){
          return { ok:false, reason:serialReason + " / " + reason };
        }
        return { ok:false, reason };
      }
      return { ok:true, reason:"HTTP" };
    }
    function scheduleServoAutoApply(channel, delayMs){
      const row = servoUiMap[channel];
      if(!row) return;
      if(row.autoTimer){
        clearTimeout(row.autoTimer);
        row.autoTimer = null;
      }
      row.autoTimer = setTimeout(()=>{
        row.autoTimer = null;
        applyServoAngle(channel, { showFeedback:false, logIt:false });
      }, Math.max(0, Number(delayMs) || 0));
    }
    async function applyServoAngle(channel, options){
      const row = servoUiMap[channel];
      if(!row || !row.range) return;
      const opts = options || {};
      const showFeedback = (opts.showFeedback !== false);
      const logIt = (opts.logIt !== false);
      const force = !!opts.force;
      if(row.autoTimer){
        clearTimeout(row.autoTimer);
        row.autoTimer = null;
      }
      const deg = clampServoAngle(row.range.value);
      setServoUiAngle(channel, deg);
      if(!force && row.lastAppliedDeg === deg) return;
      const result = await sendServoCommand(channel, deg);
      if(!result.ok){
        if(showFeedback){
          const reason = String(result.reason || "UNKNOWN");
          showToast("PWM" + channel + " 전송 실패: " + reason, "error", {
            key:"servo-set-fail-" + channel,
            duration:3200
          });
        }
        return;
      }
      const appliedDeg = clampServoAngle(result.appliedDeg != null ? result.appliedDeg : deg);
      row.lastAppliedDeg = appliedDeg;
      setServoUiAngle(channel, appliedDeg);
      if(logIt){
        addLogLine("PWM" + channel + " servo -> " + appliedDeg + "°", "SERVO");
      }
      if(showFeedback){
        showToast("PWM" + channel + " 각도 " + appliedDeg + "° 적용", "info", {
          key:"servo-set-" + channel,
          duration:1800
        });
      }
      fetchServoInfo();
    }
    function renderHomeViewLayout(){
      const homeView = document.getElementById("homeView");
      if(!homeView || homeView.children.length) return;
      homeView.innerHTML = `
        <div class="home-ref-shell">
          <aside class="home-ref-left">
            <div class="home-ref-search" aria-hidden="true">
              <span class="home-ref-search-icon">⌕</span>
              <input type="text" value="" placeholder="Search" readonly>
            </div>

            <button id="homeFlyCardBtn" class="home-ref-fly" type="button">
              <div class="home-ref-fly-title">Before You Fly</div>
              <div class="home-ref-fly-sub" id="homeStatus">No Fly Spots available nearby</div>
              <div class="home-ref-fly-zone">
                <span class="home-ref-zone-dot"></span>
                <span>Recommended Zone</span>
              </div>
            </button>

            <section class="home-ref-tools">
              <button id="homeDataExtractBtn" class="home-ref-tool home-ref-tool-compact" type="button">
                <span class="home-ref-tool-icon">⇩</span>
                <span class="home-ref-tool-label">Data Export</span>
              </button>
              <button id="homeFindSoundBtn" class="home-ref-tool home-ref-tool-compact" type="button">
                <span class="home-ref-tool-icon">◉</span>
                <span class="home-ref-tool-label">Find Sound</span>
              </button>
            </section>
          </aside>

          <section class="home-ref-right">
            <header class="home-ref-head">
              <div class="home-ref-title-wrap">
                <h2 id="homeHeroBoard">ALTIS PCB PRO</h2>
                <span id="homeHeroPill" class="home-ref-live is-offline">OFFLINE</span>
              </div>
              <div class="home-ref-head-icons"><span>⌖</span><span>☰</span></div>
            </header>

            <div class="home-ref-update">
              <span>FlySafe requires update</span>
              <strong>Update</strong>
            </div>

            <div class="home-ref-stage">
              <img src="img/altis_logo1.png" alt="ALTIS Board">
            </div>

            <div class="home-ref-foot-icons">▲  ◔  ↔  ▭</div>
            <button id="homeArmBtn" class="home-ref-go" type="button">GO FLY</button>
          </section>
        </div>

        <nav class="home-ref-bottom-nav" aria-hidden="true">
          <span>Create</span>
          <span>SkyPixel</span>
          <span>Service</span>
          <span>Profile</span>
        </nav>

        <div class="home-ref-hidden" aria-hidden="true">
          <span id="homeActionHint">점검 후 ARM 가능</span>
          <span id="homeLog">-</span>
          <button id="homeSafeBtn" type="button" tabindex="-1">SAFE</button>
          <button id="homeIgniterBtn" type="button" tabindex="-1">IGNITER</button>
          <span id="homeFirmware">--</span>
          <span id="homeProtocol">--</span>
          <span id="homeConnStatus">--</span>
          <span id="homeWsStatus">--</span>
          <span id="homeMode">--</span>
          <span id="homeSerialStatus">--</span>
          <span id="homeRelay">--</span>
          <span id="homeSwitch">--</span>
          <span id="homeIgniter">--</span>
          <span id="homeSafety">--</span>
          <span id="homeStatusBadge">OFF</span>
          <span id="homeConnBadge">OFF</span>
          <span id="homeWsBadge">OFF</span>
          <span id="homeModeBadge">OFF</span>
          <span id="homeSafetyBadge">OFF</span>
          <span id="homeSerialBadge">OFF</span>
          <span id="homeMissionName">--</span>
          <span id="homeMissionMotor">--</span>
          <span id="homeMissionDelay">--</span>
          <span id="homeHealthBattery">--</span>
          <span id="homeHealthBatteryBadge">--</span>
          <span id="homeHealthIgniter">--</span>
          <span id="homeHealthIgniterBadge">--</span>
          <span id="homeHealthSwitch">--</span>
          <span id="homeHealthSwitchBadge">--</span>
          <span id="homeHealthRelay">--</span>
          <span id="homeHealthRelayBadge">--</span>
        </div>
      `;
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
    function removeLegacyLuceText(){
      const needles = [
        "Luce in ALTIS",
        "ALTIS 안의 빛",
        "작은 점화 하나가",
        "우주로 향하는 길이 됩니다"
      ];
      const nodes = document.querySelectorAll("body *");
      nodes.forEach(node=>{
        if(!node || node.children.length) return;
        const text = String(node.textContent || "");
        if(!text) return;
        if(needles.some(k => text.indexOf(k) >= 0)){
          node.textContent = "";
        }
      });
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
        const isRefHome = el.homeArmBtn.classList.contains("home-ref-go");
        el.homeArmBtn.textContent = armed ? "DISARM" : (isRefHome ? "GO FLY" : "ARM");
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

    function compactMobileHudAlertText(message, toastType){
      const raw = String(message || "").replace(/\s+/g, " ").trim();
      if(!raw) return "";
      if(/(inspection|점검).*(완료|통과|ok|passed)/i.test(raw)) return "시스템 준비 완료";
      if(/(sequence|시퀀스).*(완료|complete)/i.test(raw)) return "시스템 준비 완료";
      if(/(lockout|락아웃)/i.test(raw)) return "LOCKOUT 감지";
      if(/(abort|중단)/i.test(raw)) return "시퀀스 중단";
      if(/(countdown|카운트다운)/i.test(raw)) return "카운트다운 시작";
      if(/(ignite|ignition|점화)/i.test(raw)) return "점화 진행";
      if(/(parachute|낙하산|사출)/i.test(raw)) return "낙하산 사출";
      if(/(disconnected|연결 해제|연결 끊)/i.test(raw)) return "연결 끊김";
      if(/(connected|연결됨|연결 완료)/i.test(raw)) return "연결됨";
      if(toastType === "success") return "시스템 준비 완료";
      let shortText = raw.split(/[.!?\n]/)[0].split("·")[0].trim();
      if(shortText.length > 20) shortText = shortText.slice(0, 19).trim() + "…";
      return shortText || "알림";
    }

    function resolveMobileHudStatusText(defaultText){
      if(!isMobileLayout()) return defaultText;
      if(!mobileHudAlertText || Date.now() > mobileHudAlertUntilMs) return defaultText;
      return mobileHudAlertText;
    }

    function showMobileHudAlert(message, toastType, durationMs){
      if(!isMobileLayout()) return false;
      const shortText = compactMobileHudAlertText(message, toastType);
      if(!shortText) return false;
      const holdMs = clampLocal(durationMs || 1500, 900, 2600);
      mobileHudAlertText = shortText;
      mobileHudAlertUntilMs = Date.now() + holdMs;
      if(mobileHudAlertTimer){
        clearTimeout(mobileHudAlertTimer);
        mobileHudAlertTimer = null;
      }
      mobileHudAlertTimer = setTimeout(()=>{
        mobileHudAlertText = "";
        mobileHudAlertUntilMs = 0;
        mobileHudAlertTimer = null;
        syncCountdownInlineStatus();
      }, holdMs + 40);
      syncCountdownInlineStatus();
      return true;
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
      const forceToast = !!(opts && opts.forceToast);

      if(!forceToast && !sticky && showMobileHudAlert(message, toastType, duration)){
        return;
      }

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
    function isSequenceBusyForPanelModes(){
      return sequenceActive || currentSt === 1 || currentSt === 2 || localTplusActive || tplusUiActive;
    }
    function isTabletPanelModeBlocked(){
      return isTabletControlsLayout() && isSequenceBusyForPanelModes();
    }
    function showTabletPanelBlockedToast(mode){
      const label = mode === "launcher" ? "발사대" : "리플레이";
      showToast("시퀀스 진행 중에는 " + label + "를 열 수 없습니다.", "notice", {key:"tablet-panel-lock-" + mode});
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
      if(el.replayOpenBtns && el.replayOpenBtns.length){
        const blocked = isTabletPanelModeBlocked();
        el.replayOpenBtns.forEach(btn=>{
          btn.classList.toggle("disabled", blocked);
          btn.setAttribute("aria-disabled", blocked ? "true" : "false");
        });
      }
      updateInspectionPill();
      updateMobileControlPills();
      syncMobileControlButtons();
      updateMobileSequenceStatusLabel(sequenceActive, state, lockoutLatched);
      updateMissionEditLockUI();
    }

    const MOBILE_PANEL_MEDIA = window.matchMedia("(max-width: 900px) and (orientation: landscape), (max-width: 600px)");
    const PHONE_LANDSCAPE_MEDIA = window.matchMedia("(orientation: landscape) and (max-width: 900px)");
    const TABLET_CONTROLS_MEDIA = window.matchMedia("(min-width: 768px) and (max-width: 1440px)");
    let mobileControlsActive = false;
    let tabletControlsOpen = false;
    let gyroViewportExpandedAt = 0;
    let gyroViewportLastTapAt = 0;
    let gyroViewportLastTapX = 0;
    let gyroViewportLastTapY = 0;
    let launcherPanelActive = false;
    let missionPanelActive = false;
    let inspectionPanelActive = false;
    let mobileHudAlertText = "";
    let mobileHudAlertUntilMs = 0;
    let mobileHudAlertTimer = null;

    function isForcedMobileHudPreview(){
      return !!(uiSettings && uiSettings.mobileHudPreview);
    }
    function getFullscreenElement(){
      return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
    }
    function isDocumentFullscreen(){
      return !!getFullscreenElement();
    }
    function requestDocumentFullscreen(){
      const root = document.documentElement;
      if(!root) return Promise.resolve(false);
      const fn = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
      if(typeof fn !== "function") return Promise.resolve(false);
      try{
        const ret = fn.call(root);
        if(ret && typeof ret.then === "function"){
          return ret.then(()=>true).catch(()=>false);
        }
        return Promise.resolve(true);
      }catch(e){
        return Promise.resolve(false);
      }
    }
    function exitDocumentFullscreen(){
      const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if(typeof fn !== "function") return Promise.resolve(false);
      try{
        const ret = fn.call(document);
        if(ret && typeof ret.then === "function"){
          return ret.then(()=>true).catch(()=>false);
        }
        return Promise.resolve(true);
      }catch(e){
        return Promise.resolve(false);
      }
    }
    function isMobileImmersiveEnabled(){
      return !!(uiSettings && uiSettings.mobileImmersive);
    }
    function shouldUseMobileImmersive(){
      if(!isMobileImmersiveEnabled()) return false;
      return document.documentElement.classList.contains("phone-landscape-layout");
    }
    function applyMobileImmersiveMode(fromUserGesture){
      if(shouldUseMobileImmersive()){
        if(!isDocumentFullscreen() && fromUserGesture){
          requestDocumentFullscreen();
        }
        return;
      }
      if(isDocumentFullscreen()){
        exitDocumentFullscreen();
      }
    }
    function syncMobileImmersiveToggleState(){
      if(!uiSettings || !el.mobileFullscreenToggle) return;
      if(uiSettings.mobileImmersive && !isDocumentFullscreen()){
        uiSettings.mobileImmersive = false;
        saveSettings();
      }
      el.mobileFullscreenToggle.checked = !!uiSettings.mobileImmersive;
    }
    function moveMobileAbortPanelToBody(){
      if(!el.mobileAbortPanel || mobileAbortPanelPortalState.mountedToBody) return;
      const parent = el.mobileAbortPanel.parentNode;
      if(!parent) return;
      mobileAbortPanelPortalState.homeParent = parent;
      mobileAbortPanelPortalState.homeNextSibling = el.mobileAbortPanel.nextSibling;
      document.body.appendChild(el.mobileAbortPanel);
      mobileAbortPanelPortalState.mountedToBody = true;
    }
    function restoreMobileAbortPanelFromBody(){
      if(!el.mobileAbortPanel || !mobileAbortPanelPortalState.mountedToBody) return;
      const parent = mobileAbortPanelPortalState.homeParent;
      const nextSibling = mobileAbortPanelPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.mobileAbortPanel, nextSibling);
        }else{
          parent.appendChild(el.mobileAbortPanel);
        }
      }
      mobileAbortPanelPortalState.homeParent = null;
      mobileAbortPanelPortalState.homeNextSibling = null;
      mobileAbortPanelPortalState.mountedToBody = false;
    }
    function moveMobileControlsPanelToBody(){
      if(!el.mobileControlsPanel || mobileControlsPanelPortalState.mountedToBody) return;
      const parent = el.mobileControlsPanel.parentNode;
      if(!parent) return;
      mobileControlsPanelPortalState.homeParent = parent;
      mobileControlsPanelPortalState.homeNextSibling = el.mobileControlsPanel.nextSibling;
      document.body.appendChild(el.mobileControlsPanel);
      mobileControlsPanelPortalState.mountedToBody = true;
    }
    function restoreMobileControlsPanelFromBody(){
      if(!el.mobileControlsPanel || !mobileControlsPanelPortalState.mountedToBody) return;
      const parent = mobileControlsPanelPortalState.homeParent;
      const nextSibling = mobileControlsPanelPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.mobileControlsPanel, nextSibling);
        }else{
          parent.appendChild(el.mobileControlsPanel);
        }
      }
      mobileControlsPanelPortalState.homeParent = null;
      mobileControlsPanelPortalState.homeNextSibling = null;
      mobileControlsPanelPortalState.mountedToBody = false;
    }
    function isMobileLayout(){
      return isForcedMobileHudPreview() || (MOBILE_PANEL_MEDIA.matches && isTouchCapableDevice());
    }
    function isTouchCapableDevice(){
      return (navigator.maxTouchPoints || 0) > 0 || ("ontouchstart" in window);
    }
    function isTabletControlsLayout(){
      return !isMobileLayout() && TABLET_CONTROLS_MEDIA.matches && isTouchCapableDevice();
    }
    function isLauncherOverlayVisible(){
      return !!(launcherOverlayEl && !launcherOverlayEl.classList.contains("hidden"));
    }
    function isMissionOverlayVisible(){
      return !!(el.missionOverlay && !el.missionOverlay.classList.contains("hidden"));
    }
    function isInspectionOverlayVisible(){
      return !!(el.inspectionOverlay && !el.inspectionOverlay.classList.contains("hidden"));
    }
    function cacheDialogDockHome(dialogEl, dockState){
      if(!dialogEl || !dockState || dockState.homeParent) return;
      dockState.homeParent = dialogEl.parentNode || null;
      dockState.homeNextSibling = dialogEl.nextSibling || null;
    }
    function mountDialogToPanel(dialogEl, mountEl, dockState){
      if(!dialogEl || !mountEl || !dockState) return false;
      cacheDialogDockHome(dialogEl, dockState);
      if(dialogEl.parentNode !== mountEl){
        mountEl.appendChild(dialogEl);
      }
      dialogEl.classList.add("is-embedded-panel");
      return true;
    }
    function restoreDialogFromPanel(dialogEl, dockState){
      if(!dialogEl || !dockState) return;
      dialogEl.classList.remove("is-embedded-panel");
      const parent = dockState.homeParent;
      if(!parent) return;
      if(dialogEl.parentNode === parent) return;
      const nextSibling = dockState.homeNextSibling;
      if(nextSibling && nextSibling.parentNode === parent){
        parent.insertBefore(dialogEl, nextSibling);
      }else{
        parent.appendChild(dialogEl);
      }
    }
    function isMobileLauncherPanelVisible(){
      return !!(el.mobileControlsPanel && el.mobileControlsPanel.classList.contains("is-launcher-view"));
    }
    function isMobileMissionPanelVisible(){
      return !!(el.mobileControlsPanel && el.mobileControlsPanel.classList.contains("is-mission-view"));
    }
    function isMobileInspectionPanelVisible(){
      return !!(el.mobileControlsPanel && el.mobileControlsPanel.classList.contains("is-inspection-view"));
    }
    function getControlsPanelTitle(){
      if(replayUiActive) return "DATA REPLAY";
      if(launcherPanelActive || isMobileLauncherPanelVisible()) return "LAUNCHER CONTROL";
      if(missionPanelActive || isMobileMissionPanelVisible()) return "MISSION PROFILE";
      if(inspectionPanelActive || isMobileInspectionPanelVisible()) return "INSPECTION";
      return "CONTROL PANEL";
    }
    function syncControlsPanelTitle(){
      if(el.controlsCardTitle){
        el.controlsCardTitle.textContent = getControlsPanelTitle();
      }
    }
    function setMobileLauncherPanelVisible(show){
      if(!el.mobileControlsPanel) return;
      const next = !!show;
      if(next){
        setMobileMissionPanelVisible(false);
        setMobileInspectionPanelVisible(false);
      }
      el.mobileControlsPanel.classList.toggle("is-launcher-view", next);
      if(el.mobileLauncherPanel){
        el.mobileLauncherPanel.setAttribute("aria-hidden", next ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function setMobileMissionPanelVisible(show){
      if(!el.mobileControlsPanel) return;
      const next = !!show;
      if(next){
        setMobileLauncherPanelVisible(false);
        setMobileInspectionPanelVisible(false);
        setOverlayVisible(el.missionOverlay, false);
        resetMissionToPresetList();
      }
      el.mobileControlsPanel.classList.toggle("is-mission-view", next);
      if(el.mobileMissionPanel){
        el.mobileMissionPanel.setAttribute("aria-hidden", next ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function setMobileInspectionPanelVisible(show){
      if(!el.mobileControlsPanel) return;
      const next = !!show;
      if(next){
        setMobileLauncherPanelVisible(false);
        setMobileMissionPanelVisible(false);
        setOverlayVisible(el.inspectionOverlay, false);
      }
      el.mobileControlsPanel.classList.toggle("is-inspection-view", next);
      if(el.mobileInspectionPanel){
        el.mobileInspectionPanel.setAttribute("aria-hidden", next ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function updateNavActionState(){
      const replayActive = !!replayUiActive;
      const launcherActive = !!launcherPanelActive || isLauncherOverlayVisible() || isMobileLauncherPanelVisible();
      const missionActive = !!missionPanelActive || isMissionOverlayVisible() || isMobileMissionPanelVisible();
      const inspectionActive = !!inspectionPanelActive || isInspectionOverlayVisible() || isMobileInspectionPanelVisible();
      const panelModeActive = replayActive || launcherActive || missionActive || inspectionActive;
      const controlsActive = isMobileLayout()
        ? false
        : (isTabletControlsLayout()
            ? (tabletControlsOpen && !panelModeActive)
            : (!panelModeActive));
      if(el.replayOpenBtns && el.replayOpenBtns.length){
        el.replayOpenBtns.forEach(btn=>btn.classList.toggle("is-active", replayActive));
      }
      if(el.controlsToggleBtns && el.controlsToggleBtns.length){
        el.controlsToggleBtns.forEach(btn=>btn.classList.toggle("is-active", controlsActive));
      }
      if(el.launcherOpenBtns && el.launcherOpenBtns.length){
        el.launcherOpenBtns.forEach(btn=>btn.classList.toggle("is-active", launcherActive));
      }
    }
    function setLauncherPanelVisible(show){
      launcherPanelActive = !!show;
      if(launcherPanelActive){
        setMissionPanelVisible(false);
        setInspectionPanelVisible(false);
        if(replayUiActive){
          exitReplayMode();
        }
        if(el.controlsCard){
          el.controlsCard.classList.remove("devtools-mode");
        }
        if(el.controlsHeader){
          el.controlsHeader.classList.remove("hidden");
        }
      }
      if(el.controlsCard){
        el.controlsCard.classList.toggle("launcher-mode", launcherPanelActive);
      }
      if(el.launcherPanel){
        el.launcherPanel.setAttribute("aria-hidden", launcherPanelActive ? "false" : "true");
      }
      syncControlsPanelTitle();
      if(!launcherPanelActive){
        launcherAutoActive = false;
        launcherPitchEst = null;
        launcherPitchEstMs = 0;
        stopLauncherHold("up");
        stopLauncherHold("down");
      }
      updateNavActionState();
    }
    function setMissionPanelVisible(show){
      missionPanelActive = !!show;
      if(missionPanelActive){
        setOverlayVisible(el.missionOverlay, false);
        setLauncherPanelVisible(false);
        setInspectionPanelVisible(false);
        if(replayUiActive){
          exitReplayMode();
        }
        if(el.controlsCard){
          el.controlsCard.classList.remove("devtools-mode");
        }
        if(el.controlsHeader){
          el.controlsHeader.classList.remove("hidden");
        }
        resetMissionToPresetList();
      }
      if(el.controlsCard){
        el.controlsCard.classList.toggle("mission-mode", missionPanelActive);
      }
      if(el.missionPanel){
        el.missionPanel.setAttribute("aria-hidden", missionPanelActive ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function setInspectionPanelVisible(show){
      inspectionPanelActive = !!show;
      if(inspectionPanelActive){
        setOverlayVisible(el.inspectionOverlay, false);
        setLauncherPanelVisible(false);
        setMissionPanelVisible(false);
        if(replayUiActive){
          exitReplayMode();
        }
        if(el.controlsCard){
          el.controlsCard.classList.remove("devtools-mode");
        }
        if(el.controlsHeader){
          el.controlsHeader.classList.remove("hidden");
        }
      }
      if(el.controlsCard){
        el.controlsCard.classList.toggle("inspection-mode", inspectionPanelActive);
      }
      if(el.inspectionPanel){
        el.inspectionPanel.setAttribute("aria-hidden", inspectionPanelActive ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function resetControlsModesOnClose(){
      if(replayUiActive){
        exitReplayMode();
      }
      setMissionPanelVisible(false);
      setInspectionPanelVisible(false);
      setLauncherPanelVisible(false);
    }
    function applyTabletControlsLayout(){
      if(!el.controlsCard) return;
      const active = isTabletControlsLayout();
      document.documentElement.classList.toggle("tablet-controls-layout", active);
      document.documentElement.classList.toggle("tablet-controls-open", active && tabletControlsOpen);
      if(!active){
        tabletControlsOpen = false;
        el.controlsCard.classList.remove("tablet-collapsed");
        el.controlsCard.setAttribute("aria-expanded", "true");
        document.documentElement.classList.remove("tablet-controls-open");
        resetControlsModesOnClose();
        setTimeout(()=>{
          refreshChartLayout();
          redrawCharts();
        }, 0);
        updateControlAccessUI(currentSt);
        updateNavActionState();
        updateTabletAbortButton();
        return;
      }
      el.controlsCard.classList.toggle("tablet-collapsed", !tabletControlsOpen);
      el.controlsCard.setAttribute("aria-expanded", tabletControlsOpen ? "true" : "false");
      setTimeout(()=>{
        refreshChartLayout();
        redrawCharts();
      }, 0);
      updateControlAccessUI(currentSt);
      updateNavActionState();
      updateTabletAbortButton();
    }
    function showTabletControlsPanel(){
      if(!isTabletControlsLayout()) return;
      closeIgnitionModals();
      tabletControlsOpen = true;
      applyTabletControlsLayout();
    }
    function hideTabletControlsPanel(){
      if(!isTabletControlsLayout()) return;
      tabletControlsOpen = false;
      resetControlsModesOnClose();
      applyTabletControlsLayout();
    }
    function toggleTabletControlsPanel(){
      if(!isTabletControlsLayout()) return;
      const nextOpen = !tabletControlsOpen;
      if(nextOpen) closeIgnitionModals();
      tabletControlsOpen = nextOpen;
      applyTabletControlsLayout();
    }

    function applyPhoneLandscapeLayout(){
      const active = isForcedMobileHudPreview() || (PHONE_LANDSCAPE_MEDIA.matches && isTouchCapableDevice());
      const wasActive = document.documentElement.classList.contains("phone-landscape-layout");
      document.documentElement.classList.toggle("phone-landscape-layout", active);
      if(active && !wasActive){
        setMissionPanelVisible(false);
        setInspectionPanelVisible(false);
      }
      if(active){
        moveMobileAbortPanelToBody();
        moveMobileControlsPanelToBody();
      }else{
        setMobileLauncherPanelVisible(false);
        setMobileMissionPanelVisible(false);
        setMobileInspectionPanelVisible(false);
        restoreMobileAbortPanelFromBody();
        restoreMobileControlsPanelFromBody();
      }
      if(active && isGyroViewportExpanded()){
        setGyroViewportExpanded(false);
      }
      if(wasActive !== active){
        setTimeout(()=>{
          resizeGyroGl();
          if(gyroGl){
            renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          }
          renderGyroPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderNavBallPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          scheduleStatusMapRefresh();
          refreshChartLayout();
          redrawCharts();
          syncExpandedHud();
        }, 0);
      }else if(active){
        setTimeout(()=>{
          scheduleStatusMapRefresh();
          syncExpandedHud();
        }, 0);
      }
      updateNavActionState();
      updateMobileAbortButton();
      applyMobileImmersiveMode(false);
      syncControlsToggleButtonsForSettings();
      syncStatusMapInteractionMode();
      if(!active && !isMobileLayout()){
        hideMobileControlsPanel();
      }
    }

    function showMobileControlsPanel(){
      if(!el.mobileControlsPanel || mobileControlsActive) return;
      closeIgnitionModals();
      updateMobileControlPills();
      syncMobileControlButtons();
      updateMobileSequenceStatusLabel(sequenceActive, currentSt, lockoutLatched);
      setMobileLauncherPanelVisible(false);
      setMobileMissionPanelVisible(false);
      setMobileInspectionPanelVisible(false);
      mobileControlsActive = true;
      el.mobileControlsPanel.classList.add("is-open");
      el.mobileControlsPanel.setAttribute("aria-hidden","false");
      document.documentElement.classList.add("mobile-controls-active");
    }

    function hideMobileControlsPanel(){
      if(!el.mobileControlsPanel || !mobileControlsActive) return;
      setMobileLauncherPanelVisible(false);
      setMobileMissionPanelVisible(false);
      setMobileInspectionPanelVisible(false);
      mobileControlsActive = false;
      el.mobileControlsPanel.classList.remove("is-open");
      el.mobileControlsPanel.setAttribute("aria-hidden","true");
      document.documentElement.classList.remove("mobile-controls-active");
    }

    if(MOBILE_PANEL_MEDIA.addEventListener){
      MOBILE_PANEL_MEDIA.addEventListener("change",(event)=>{
        if(!event.matches) hideMobileControlsPanel();
        applyPhoneLandscapeLayout();
      });
    }else if(MOBILE_PANEL_MEDIA.addListener){
      MOBILE_PANEL_MEDIA.addListener((event)=>{
        if(!event.matches) hideMobileControlsPanel();
        applyPhoneLandscapeLayout();
      });
    }
    if(PHONE_LANDSCAPE_MEDIA.addEventListener){
      PHONE_LANDSCAPE_MEDIA.addEventListener("change",()=>{
        applyPhoneLandscapeLayout();
      });
    }else if(PHONE_LANDSCAPE_MEDIA.addListener){
      PHONE_LANDSCAPE_MEDIA.addListener(()=>{
        applyPhoneLandscapeLayout();
      });
    }
    if(TABLET_CONTROLS_MEDIA.addEventListener){
      TABLET_CONTROLS_MEDIA.addEventListener("change",()=>{
        applyTabletControlsLayout();
        applyPhoneLandscapeLayout();
      });
    }else if(TABLET_CONTROLS_MEDIA.addListener){
      TABLET_CONTROLS_MEDIA.addListener(()=>{
        applyTabletControlsLayout();
        applyPhoneLandscapeLayout();
      });
    }
    const FULLSCREEN_EVENTS = ["fullscreenchange", "webkitfullscreenchange", "MSFullscreenChange"];
    FULLSCREEN_EVENTS.forEach((evtName)=>{
      document.addEventListener(evtName, ()=>{
        syncMobileImmersiveToggleState();
      });
    });

    function updateMobileControlPills(){
      if(!el.mobileControlsPanel) return;
      const setMobileQuickIconTone = (type, toneClass)=>{
        if(!el.mobileControlButtonMap) return;
        const btn = el.mobileControlButtonMap[type];
        if(!btn || !btn.querySelector) return;
        const icon = btn.querySelector(".mobile-quick-icon");
        if(!icon) return;
        icon.classList.remove("tone-green", "tone-red", "tone-gray", "tone-blue");
        if(toneClass) icon.classList.add(toneClass);
      };
      const setMobileQuickPillTone = (node, tone)=>{
        if(!node) return;
        node.classList.remove("pill-green", "pill-red", "pill-gray");
        node.classList.add("mobile-quick-state", "pill");
        if(tone) node.classList.add(tone);
      };
      const serialPill = el.mobileControlPills ? el.mobileControlPills.serial : null;
      if(serialPill){
        const serialLabel = serialEnabled
          ? (serialConnected ? t("serialConnected") : t("serialDisconnected"))
          : t("serialOff");
        serialPill.textContent = serialLabel;
        setMobileQuickPillTone(serialPill, serialEnabled ? (serialConnected ? "pill-green" : "pill-red") : "pill-gray");
        setMobileQuickIconTone("serial", serialEnabled ? (serialConnected ? "tone-green" : "tone-red") : "tone-gray");
      }
      const safetyPill = el.mobileControlPills ? el.mobileControlPills.safety : null;
      if(safetyPill){
        const safetyOn = el.safeModeToggle ? el.safeModeToggle.checked : safetyModeEnabled;
        safetyPill.textContent = safetyOn ? "ON" : "OFF";
        setMobileQuickPillTone(safetyPill, safetyOn ? "pill-green" : "pill-gray");
        setMobileQuickIconTone("safety", safetyOn ? "tone-green" : "tone-gray");
      }
      const inspectionPill = el.mobileControlPills ? el.mobileControlPills.inspection : null;
      if(inspectionPill && el.inspectionStatusPill){
        inspectionPill.textContent = el.inspectionStatusPill.textContent;
        let tone = "pill-gray";
        if(el.inspectionStatusPill.classList.contains("pill-green")) tone = "pill-green";
        else if(el.inspectionStatusPill.classList.contains("pill-red")) tone = "pill-red";
        setMobileQuickPillTone(inspectionPill, tone);
        setMobileQuickIconTone("inspection", tone === "pill-green" ? "tone-green" : (tone === "pill-red" ? "tone-red" : "tone-gray"));
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
      const inspectionDisabled = !!(el.inspectionOpenBtn && el.inspectionOpenBtn.classList.contains("disabled"));
      const missionDisabled = !isMissionEditableNow();
      setMobileControlButtonState("sequence", sequenceDisabled);
      setMobileControlButtonState("inspection", inspectionDisabled);
      setMobileControlButtonState("mission", missionDisabled);
    }

    function shouldShowMobileAbortButton(){
      if(!isMobileLayout() || !el.mobileAbortBtn) return false;
      return sequenceActive || currentSt === 1 || currentSt === 2 || localTplusActive;
    }
    function shouldShowTabletAbortButton(){
      if(!isTabletControlsLayout() || !el.tabletAbortBtn) return false;
      return sequenceActive || currentSt === 1 || currentSt === 2 || localTplusActive || tplusUiActive;
    }
    function updateMobileAbortButton(){
      if(!el.mobileAbortBtn) return;
      const show = shouldShowMobileAbortButton();
      el.mobileAbortBtn.classList.toggle("is-visible", show);
      if(el.mobileAbortPanel) el.mobileAbortPanel.classList.toggle("is-visible", show);
      el.mobileAbortBtn.disabled = !!(el.abortBtn && el.abortBtn.disabled);
      updateTabletAbortButton();
    }
    function updateTabletAbortButton(){
      if(!el.tabletAbortBtn) return;
      const show = shouldShowTabletAbortButton();
      el.tabletAbortBtn.classList.toggle("hidden", !show);
      el.tabletAbortBtn.disabled = !!(el.abortBtn && el.abortBtn.disabled);
    }

    function updateAbortButtonLabel(isTplus){
      const label = isTplus ? "STOP" : "ABORT";
      tplusUiActive = !!isTplus;
      if(el.abortBtn) el.abortBtn.textContent = label;
      if(el.mobileAbortBtn) el.mobileAbortBtn.textContent = label;
      if(el.tabletAbortBtn) el.tabletAbortBtn.textContent = label;
      updateTabletAbortButton();
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
    function getInspectionStepLabel(key){
      const info = INSPECTION_STEP_INFO[key] || {};
      return info.labelKey ? t(info.labelKey) : (info.label || key || "-");
    }
    function buildInspectionFailMessage(failedKeys){
      const base = t("inspectionFailText");
      if(!failedKeys || !failedKeys.length){
        return base;
      }
      const labels = failedKeys.map(getInspectionStepLabel).filter(Boolean);
      if(!labels.length){
        return base;
      }
      return base + "<br>" + t("inspectionFailItemsLabel") + ": " + labels.join(", ");
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
      const targets = [];
      if(el.inspectionResult) targets.push(el.inspectionResult);
      if(el.inspectionPanelResults && el.inspectionPanelResults.length){
        el.inspectionPanelResults.forEach(node=>{ if(node) targets.push(node); });
      }
      if(!targets.length) return;
      targets.forEach(node=>{
        node.classList.remove("ok","error","running");
        if(state) node.classList.add(state);
        node.textContent = text;
      });
    }

    function resetInspectionUI(){
      inspectionRunning=false;
      controlAuthority=false;
      inspectionState="idle";
      inspectionLastFailedKeys = [];
      if(INSPECTION_STEPS.length){
        setInspectionItemState(INSPECTION_STEPS[0].key,"", t("inspectionWait"));
      }
      setInspectionResult(t("inspectionIdleText"),"neutral");
      updateInspectionPill();
      updateControlAccessUI(currentSt);
    }

    async function runInspectionSequence(){
      if(inspectionRunning) return;
      hideInspectionWarning();
      inspectionRunning=true;
      inspectionState="running";
      controlAuthority=false;
      inspectionLastFailedKeys = [];
      updateInspectionPill();
      setInspectionResult(t("inspectionRunningText"),"running");
      updateControlAccessUI(currentSt);

      let hasFail=false;
      const failedKeys = [];
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
        if(!ok && !skipped){
          hasFail=true;
          failedKeys.push(step.key);
        }
        await delay(180);
      }

      inspectionRunning=false;
      inspectionState = hasFail ? "failed" : "passed";
      inspectionLastFailedKeys = hasFail ? failedKeys.slice() : [];

      if(hasFail){
        controlAuthority=false;
        setInspectionResult(t("inspectionFailText"),"error");
        showToast(t("inspectFailToast"),"notice");
        showInspectionWarning(inspectionLastFailedKeys);
        const failLabels = inspectionLastFailedKeys.map(getInspectionStepLabel).filter(Boolean).join(", ");
        addLogLine(failLabels ? (t("inspectFailLog") + " (" + failLabels + ")") : t("inspectFailLog"),"SAFE");
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
      return !hasFail;
    }

    function openInspectionFromUI(){
      if(!connOk){
        showToast(t("inspectionOpenToast"), "notice");
        return;
      }
      showInspection();
    }

    function showInspection(){
      hideInspectionWarning();
      setInspectionPanelVisible(false);
      setMobileInspectionPanelVisible(false);
      setOverlayVisible(el.inspectionOverlay, false);
      resetInspectionUI();
      runInspectionSequence();
    }
    function hideInspection(){
      hideInspectionWarning();
      if(isMobileInspectionPanelVisible()){
        setMobileInspectionPanelVisible(false);
      }
      if(inspectionPanelActive){
        setInspectionPanelVisible(false);
      }
      setOverlayVisible(el.inspectionOverlay, false);
    }

    function showControlsModal(){
      hideMobileControlsPanel();
      closeIgnitionModals();
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
      updateNavActionState();
    }
    function hideControlsModal(){
      if(!el.controlsOverlay || !el.controlsCard || !controlsCardParent) return;
      resetControlsModesOnClose();
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
      updateNavActionState();
    }

    // ✅ KST 시각 표시
    function getCompactHudClockText(){
      const now = new Date();
      const opts = { hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"Asia/Seoul" };
      return now.toLocaleTimeString("ko-KR", opts);
    }

    function updateKstClock(){
      if(!el.kstTime) return;
      const now = new Date();
      const opts = { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false, timeZone:"Asia/Seoul" };
      el.kstTime.textContent = now.toLocaleTimeString("ko-KR", opts);
      const compactTimeText = getCompactHudClockText();
      if(el.statusMapHudTimeCompact) el.statusMapHudTimeCompact.textContent = compactTimeText;
      if(el.gyro3dHudTimeCompact) el.gyro3dHudTimeCompact.textContent = compactTimeText;
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
    function getChartAxisDigits(canvasId, min, max){
      if(canvasId === "thrustChart") return getLoadcellChartDigits();
      if(canvasId === "pressureChart") return 3;
      const span = Math.abs(Number(max || 0) - Number(min || 0));
      const absMax = Math.max(Math.abs(Number(min || 0)), Math.abs(Number(max || 0)));
      if(canvasId === "accelChartFlight") return absMax >= 100 ? 0 : 1;
      if(canvasId === "accelXYZChart" || canvasId === "accelXYZChartFlight") return absMax >= 100 ? 0 : 1;
      if(span >= 50 || absMax >= 100) return 0;
      if(span >= 5 || absMax >= 10) return 1;
      if(span >= 0.5 || absMax >= 1) return 2;
      return 3;
    }

    function getChartPlotBox(width, height){
      return {
        left: Math.max(24, Math.min(32, Math.round(width * 0.058))),
        top: 4,
        right: Math.max(4, Math.min(12, Math.round(width * 0.02))),
        bottom: 16
      };
    }

    function getNiceStep(rawStep){
      if(!(rawStep > 0) || !isFinite(rawStep)) return 1;
      const exp = Math.floor(Math.log10(rawStep));
      const base = rawStep / Math.pow(10, exp);
      let niceBase = 1;
      if(base <= 1) niceBase = 1;
      else if(base <= 2) niceBase = 2;
      else if(base <= 2.5) niceBase = 2.5;
      else if(base <= 5) niceBase = 5;
      else niceBase = 10;
      return niceBase * Math.pow(10, exp);
    }

    function buildNiceTicks(min, max, targetCount){
      let safeMin = Number(min);
      let safeMax = Number(max);
      if(!isFinite(safeMin) || !isFinite(safeMax)){
        return {ticks:[], min:0, max:1, step:1};
      }
      if(safeMin === safeMax){
        const pad = Math.abs(safeMin) > 0 ? Math.abs(safeMin) * 0.25 : 1;
        safeMin -= pad;
        safeMax += pad;
      }
      const span = safeMax - safeMin;
      const step = getNiceStep(span / Math.max(2, Number(targetCount) || 4));
      const niceMin = Math.floor(safeMin / step) * step;
      const niceMax = Math.ceil(safeMax / step) * step;
      const ticks = [];
      for(let value = niceMin, i = 0; value <= niceMax + (step * 0.5) && i < 32; value += step, i++){
        ticks.push(Number(value.toFixed(10)));
      }
      return {ticks, min:niceMin, max:niceMax, step};
    }

    function expandChartValueRange(min, max){
      let safeMin = Number(min);
      let safeMax = Number(max);
      if(!isFinite(safeMin) || !isFinite(safeMax)){
        return {min:0, max:1};
      }
      if(safeMin === safeMax){
        const pad = Math.abs(safeMin) > 0 ? Math.abs(safeMin) * 0.18 : 1;
        return {min:safeMin - pad, max:safeMax + pad};
      }
      const pad = (safeMax - safeMin) * 0.08;
      return {min:safeMin - pad, max:safeMax + pad};
    }

    function getChartTimeMeta(dataLength, indices){
      if(chartTimeHistory.length !== dataLength) return null;
      if(indices.start < 0 || indices.end >= chartTimeHistory.length || indices.end <= indices.start) return null;
      const originMs = isFinite(Number(firstSampleMs)) ? Number(firstSampleMs) : Number(chartTimeHistory[0] || 0);
      const timesSec = [];
      for(let i = indices.start; i <= indices.end; i++){
        const ms = Number(chartTimeHistory[i]);
        if(!isFinite(ms)) return null;
        timesSec.push((ms - originMs) / 1000);
      }
      if(timesSec.length < 2) return null;
      const min = timesSec[0];
      const max = timesSec[timesSec.length - 1];
      return {
        values: timesSec,
        min,
        max: (max > min) ? max : (min + 1)
      };
    }

    function formatChartAxisNumber(value, digits){
      const out = formatFixedDisplay(value, digits, "--");
      return /^-0(?:\.0+)?$/.test(out) ? out.slice(1) : out;
    }

    function formatChartTimeTick(sec, stepSec){
      const step = Math.abs(Number(stepSec) || 0);
      let digits = 0;
      if(step > 0 && step < 0.2) digits = 2;
      else if(step > 0 && step < 1) digits = 1;
      const abs = Math.abs(Number(sec) || 0);
      if(abs >= 60 && digits === 0){
        const sign = sec < 0 ? "-" : "";
        const totalSec = Math.abs(sec);
        const minutes = Math.floor(totalSec / 60);
        const seconds = Math.round(totalSec % 60);
        return sign + minutes + ":" + String(seconds).padStart(2, "0");
      }
      return formatChartAxisNumber(sec, digits) + "s";
    }

    function drawChartAxes(ctx, width, height, plotBox, xTicks, yTicks, formatX, formatY){
      const plotLeft = plotBox.left;
      const plotTop = plotBox.top;
      const plotRight = width - plotBox.right;
      const plotBottom = height - plotBox.bottom;

      ctx.save();
      ctx.strokeStyle = "rgba(148,163,184,0.26)";
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3,5]);
      yTicks.forEach((tick)=>{
        ctx.beginPath();
        ctx.moveTo(plotLeft, tick.px);
        ctx.lineTo(plotRight, tick.px);
        ctx.stroke();
      });
      ctx.setLineDash([2,6]);
      xTicks.forEach((tick)=>{
        ctx.beginPath();
        ctx.moveTo(tick.px, plotTop);
        ctx.lineTo(tick.px, plotBottom);
        ctx.stroke();
      });
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(100,116,139,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, plotTop);
      ctx.lineTo(plotLeft, plotBottom);
      ctx.lineTo(plotRight, plotBottom);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = "10px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
      ctx.fillStyle = "rgba(71,85,105,0.82)";
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      yTicks.forEach((tick)=>{
        ctx.fillText(formatY(tick.value), plotLeft - 3, tick.px);
      });
      ctx.textBaseline = "top";
      xTicks.forEach((tick, index)=>{
        if(index === 0) ctx.textAlign = "left";
        else if(index === xTicks.length - 1) ctx.textAlign = "right";
        else ctx.textAlign = "center";
        ctx.fillText(formatX(tick.value), tick.px, plotBottom + 4);
      });
      ctx.restore();
    }

    function drawChart(canvasId, data, color, view){
      const canvas=document.getElementById(canvasId);
      if(!canvas) return;

      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const { w:width, h:height, ctx } = size;
      ctx.clearRect(0,0,width,height);

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
      const timeMeta = getChartTimeMeta(data.length, indices);
      const plotBox = getChartPlotBox(width, height);
      const plotLeft = plotBox.left;
      const plotTop = plotBox.top;
      const plotRight = width - plotBox.right;
      const plotBottom = height - plotBox.bottom;
      const plotWidth = Math.max(24, plotRight - plotLeft);
      const plotHeight = Math.max(24, plotBottom - plotTop);

      let min=slice[0], max=slice[0], sum=0;
      for(let v of slice){ if(v<min) min=v; if(v>max) max=v; sum+=v; }
      const avg=sum/slice.length;
      const displayRange = expandChartValueRange(min, max);
      const yAxis = buildNiceTicks(displayRange.min, displayRange.max, height < 220 ? 4 : 5);
      const yMin = yAxis.min;
      const yMax = yAxis.max;
      const ySpan = (yMax - yMin) || 1;
      const xMin = timeMeta ? timeMeta.min : 0;
      const xMax = timeMeta ? timeMeta.max : Math.max(1, slice.length - 1);
      const xSpan = (xMax - xMin) || 1;
      const xAxis = buildNiceTicks(xMin, xMax, width < 260 ? 3 : (width < 420 ? 4 : 5));
      const xTicks = xAxis.ticks.map((value)=>{
        const px = plotLeft + (((value - xMin) / xSpan) * plotWidth);
        return {value, px};
      }).filter((tick)=>tick.px >= (plotLeft - 1) && tick.px <= (plotRight + 1));
      const yTicks = yAxis.ticks.map((value)=>{
        const px = plotBottom - (((value - yMin) / ySpan) * plotHeight);
        return {value, px};
      }).filter((tick)=>tick.px >= (plotTop - 1) && tick.px <= (plotBottom + 1));
      const valueDigits = getChartAxisDigits(canvasId, yMin, yMax);
      drawChartAxes(
        ctx,
        width,
        height,
        plotBox,
        xTicks,
        yTicks,
        (value)=>formatChartTimeTick(value, xAxis.step),
        (value)=>formatChartAxisNumber(value, valueDigits)
      );

      const count=slice.length;

      function yPos(value){
        return plotBottom - ((value-yMin)/ySpan)*plotHeight;
      }
      function xPos(index){
        const xValue = timeMeta ? timeMeta.values[index] : index;
        return plotLeft + (((xValue - xMin) / xSpan) * plotWidth);
      }

      ctx.beginPath();
      for(let i=0;i<slice.length;i++){
        const x=xPos(i);
        const y=yPos(slice[i]);
        if(i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=color;
      ctx.lineWidth=1.4;
      ctx.stroke();

      const lastX=xPos(slice.length-1);
      const bottomY=plotBottom;
      ctx.lineTo(lastX,bottomY);
      ctx.lineTo(plotLeft,bottomY);
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
      ctx.beginPath(); ctx.moveTo(plotLeft,yAvg); ctx.lineTo(plotRight,yAvg); ctx.stroke();
      ctx.restore();

      const yMaxLine=yPos(max);
      ctx.save();
      ctx.setLineDash([3,3]);
      ctx.strokeStyle=colorToRgba(color,0.9);
      ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(plotLeft,yMaxLine); ctx.lineTo(plotRight,yMaxLine); ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font="10px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
      ctx.fillStyle=colorToRgba(color,0.9);
      ctx.textAlign="right";
      ctx.textBaseline="bottom";
      ctx.fillText("AVG "+formatFixedDisplay(avg, valueDigits, "--"),width-4,Math.max(plotTop + 10, yAvg - 2));
      ctx.textBaseline="top";
      ctx.fillText("MAX "+formatFixedDisplay(max, valueDigits, "--"),width-4,Math.min(plotBottom - 10, yMaxLine + 2));
      ctx.restore();
    }

    function drawChartMulti(canvasId, series, colors, view){
      const canvas=document.getElementById(canvasId);
      if(!canvas) return;

      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const { w:width, h:height, ctx } = size;
      ctx.clearRect(0,0,width,height);

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
      const timeMeta = getChartTimeMeta(base.length, indices);
      const plotBox = getChartPlotBox(width, height);
      const plotLeft = plotBox.left;
      const plotTop = plotBox.top;
      const plotRight = width - plotBox.right;
      const plotBottom = height - plotBox.bottom;
      const plotWidth = Math.max(24, plotRight - plotLeft);
      const plotHeight = Math.max(24, plotBottom - plotTop);
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
      const displayRange = expandChartValueRange(min, max);
      const yAxis = buildNiceTicks(displayRange.min, displayRange.max, height < 220 ? 4 : 5);
      const yMin = yAxis.min;
      const yMax = yAxis.max;
      const ySpan = (yMax - yMin) || 1;
      const xMin = timeMeta ? timeMeta.min : 0;
      const xMax = timeMeta ? timeMeta.max : Math.max(1, count - 1);
      const xSpan = (xMax - xMin) || 1;
      const xAxis = buildNiceTicks(xMin, xMax, width < 260 ? 3 : (width < 420 ? 4 : 5));
      const xTicks = xAxis.ticks.map((value)=>{
        const px = plotLeft + (((value - xMin) / xSpan) * plotWidth);
        return {value, px};
      }).filter((tick)=>tick.px >= (plotLeft - 1) && tick.px <= (plotRight + 1));
      const yTicks = yAxis.ticks.map((value)=>{
        const px = plotBottom - (((value - yMin) / ySpan) * plotHeight);
        return {value, px};
      }).filter((tick)=>tick.px >= (plotTop - 1) && tick.px <= (plotBottom + 1));
      const valueDigits = getChartAxisDigits(canvasId, yMin, yMax);
      drawChartAxes(
        ctx,
        width,
        height,
        plotBox,
        xTicks,
        yTicks,
        (value)=>formatChartTimeTick(value, xAxis.step),
        (value)=>formatChartAxisNumber(value, valueDigits)
      );

      function yPos(value){
        return plotBottom - ((value-yMin)/ySpan)*plotHeight;
      }
      function xPos(index){
        const xValue = timeMeta ? timeMeta.values[index] : index;
        return plotLeft + (((xValue - xMin) / xSpan) * plotWidth);
      }

      slices.forEach((arr, idx)=>{
        const color = colors && colors[idx] ? colors[idx] : "#0f172a";
        ctx.beginPath();
        for(let i=0;i<arr.length;i++){
          const v = arr[i];
          const x=xPos(i);
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
      const altitudeDisplay=quickAltitudeHistory.slice();
      const accelDisplay=accelMagHistory.slice();
      drawChart("thrustChart", thrustDisplay, "#ef4444", chartView);
      drawChart("pressureChart", pressureDisplay, "#3b82f6", chartView);
      drawChart("accelChart", accelDisplay, "#f59e0b", chartView);
      drawChart("accelChartFlight", altitudeDisplay, "#16a34a", chartView);
      drawChartMulti("accelXYZChart",
        [gyroXHistory, gyroYHistory, gyroZHistory],
        ["#ef4444", "#22c55e", "#3b82f6"],
        chartView);
      drawChartMulti("accelXYZChartFlight",
        [gyroXHistory, gyroYHistory, gyroZHistory],
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
      if(isTabletControlsLayout()) return;
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
      const rowBottom = document.querySelector(".row-bottom");
      const tabletLayoutActive = isTabletControlsLayout();
      if(chartsCard){
        chartsCard.style.height = "";
        chartsCard.style.minHeight = "";
      }
      if(rowBottom){
        rowBottom.style.minHeight = "";
      }
      if(chartsCard && tabletLayoutActive){
        chartsCard.style.height = "var(--chart-height)";
        chartsCard.style.minHeight = "var(--chart-height)";
      }
      if(rowBottom && tabletLayoutActive){
        rowBottom.style.minHeight = "var(--chart-height)";
      }
      if(chartsCard && controlsCard && !tabletLayoutActive && window.matchMedia("(min-width: 1100px)").matches){
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
    function setStatusFromState(st, ignOK, aborted, lockout, seqActive, parachuteActive){
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
      if(parachuteActive){
        const chuteCh = parachuteDeployChannel || normalizePyroChannel(uiSettings && uiSettings.daqSequencePyroChannel, 1);
        el.statusPill.className="status-parachute";
        if(el.statusPillMeta) el.statusPillMeta.className="status-parachute";
        el.statusPill.textContent = t("statusParachute");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusParachute");
        el.statusText.textContent = t("statusParachuteText", {ch:chuteCh});
        syncGyroStatusFromMain();
        return 7;
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
      const readyEligible = !replaySourceActive && isControlUnlocked() && connOk && hasSequenceMissionRequirement() && !safetyModeEnabled && !loadcellErrorActive && st === 0 && !running;
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
      const readyEligible = !replaySourceActive && isControlUnlocked() && connOk && hasSequenceMissionRequirement() && !safetyModeEnabled && !loadcellErrorActive && st === 0 && !running;
      let label = "불가";
      let iconTone = "tone-gray";
      if(lockout){
        label = "제한";
        iconTone = "tone-red";
      }else if(running){
        label = "진행중";
        iconTone = "tone-blue";
      }else if(readyEligible){
        label = "준비";
        iconTone = "tone-green";
      }
      if(el.sequenceStatusLabel) el.sequenceStatusLabel.textContent = label;
      if(el.sequenceStatusDesktop) el.sequenceStatusDesktop.textContent = label;
      if(el.mobileControlButtonMap && el.mobileControlButtonMap.sequence){
        const icon = el.mobileControlButtonMap.sequence.querySelector(".mobile-quick-icon");
        if(icon){
          icon.classList.remove("tone-green", "tone-red", "tone-gray", "tone-blue");
          icon.classList.add(iconTone);
        }
      }
    }

    function createReplayMissionRuntimeState(){
      return {
        prepared: false,
        enabled: false,
        blocks: [],
        blockState: {},
        pending: [],
        vars: [0,0,0,0,0,0,0,0],
        varsNamed: {},
        lastSwitch: 0,
        lastState: 0,
        firingStartMs: null,
        lastSampleMs: 0,
        lastSensorCtx: {},
        sensorHistory: {},
        varPrev: [null,null,null,null,null,null,null,null],
        varUpCount: [0,0,0,0,0,0,0,0],
        varDownCount: [0,0,0,0,0,0,0,0],
        varNamedPrev: {},
        varNamedUpCount: {},
        varNamedDownCount: {}
      };
    }

    const MISSION_SENSOR_HISTORY_MAX = 10;
    const MISSION_SENSOR_KEYS = [
      "altitude_m",
      "time_after_firing_ms",
      "gyro_x_deg",
      "gyro_y_deg",
      "gyro_z_deg",
      "thrust_kgf",
      "pressure_mpa",
      "acc_x_g",
      "acc_y_g",
      "acc_z_g",
      "gyro_x_dps",
      "gyro_y_dps",
      "gyro_z_dps",
      "switch_state"
    ];

    function resetReplayMissionRuntime(){
      replayMissionRuntime = createReplayMissionRuntimeState();
    }

    function replayMissionRuntimeBlocks(){
      const editorBlocks = buildMissionBlocksFromUi();
      const compiled = compileMissionRuntimeBlocks(editorBlocks);
      if(!Array.isArray(compiled)) return [];
      return compiled.filter((block)=>block && block.enabled !== false);
    }

    function prepareReplayMissionRuntime(){
      const runtimeBlocks = replayMissionRuntimeBlocks();
      resetReplayMissionRuntime();
      replayMissionRuntime.blocks = runtimeBlocks;
      replayMissionRuntime.prepared = true;
      replayMissionRuntime.enabled = runtimeBlocks.length > 0;
      const modeLabel = replaySourceActive ? "Replay avionics" : "Mission runtime";
      if(replayMissionRuntime.enabled){
        addLogLine(modeLabel + " armed: " + runtimeBlocks.length + " mission blocks", replaySourceActive ? "RPL-MSN" : "MSN");
      }else{
        addLogLine(modeLabel + ": no mission blocks to run", replaySourceActive ? "RPL-MSN" : "MSN");
      }
    }

    function replayMissionCompare(left, right, cmp){
      const a = Number(left);
      const b = Number(right);
      if(!isFinite(a) || !isFinite(b)) return false;
      const op = normalizeMissionComparator(cmp, "");
      if(op === "lt") return a <= b;
      if(op === "eq") return Math.abs(a - b) <= 1e-6;
      return a >= b;
    }
    function replayMissionGetVarValue(rt, varName, channel){
      const named = normalizeMissionVarName(varName);
      if(named){
        const val = Number(rt && rt.varsNamed ? rt.varsNamed[named] : 0);
        return isFinite(val) ? val : 0;
      }
      const slot = Math.max(1, Math.min(8, Math.round(Number(channel || 1)))) - 1;
      const val = Number(rt && rt.vars ? rt.vars[slot] : 0);
      return isFinite(val) ? val : 0;
    }
    function replayMissionSetVarValue(rt, varName, channel, nextVal){
      const value = Math.round(Number(nextVal) || 0);
      const slot = Math.max(1, Math.min(8, Math.round(Number(channel || 1)))) - 1;
      if(rt && Array.isArray(rt.vars)){
        rt.vars[slot] = value;
      }
      const named = normalizeMissionVarName(varName);
      if(named){
        if(!rt.varsNamed || typeof rt.varsNamed !== "object") rt.varsNamed = {};
        rt.varsNamed[named] = value;
      }
      return value;
    }
    function replayMissionUpdateVarChangeCounters(rt){
      if(!rt) return;
      if(!Array.isArray(rt.varPrev)) rt.varPrev = [null,null,null,null,null,null,null,null];
      if(!Array.isArray(rt.varUpCount)) rt.varUpCount = [0,0,0,0,0,0,0,0];
      if(!Array.isArray(rt.varDownCount)) rt.varDownCount = [0,0,0,0,0,0,0,0];
      for(let i = 0; i < 8; i++){
        const curr = Number((rt.vars && rt.vars[i]) || 0);
        const prev = rt.varPrev[i];
        if(isFinite(prev)){
          if(curr >= prev){
            rt.varUpCount[i] = Math.min(65535, Math.round(Number(rt.varUpCount[i] || 0) + 1));
          }else{
            rt.varUpCount[i] = 0;
          }
          if(curr <= prev){
            rt.varDownCount[i] = Math.min(65535, Math.round(Number(rt.varDownCount[i] || 0) + 1));
          }else{
            rt.varDownCount[i] = 0;
          }
        }else{
          rt.varUpCount[i] = 0;
          rt.varDownCount[i] = 0;
        }
        rt.varPrev[i] = curr;
      }
      if(!rt.varNamedPrev || typeof rt.varNamedPrev !== "object") rt.varNamedPrev = {};
      if(!rt.varNamedUpCount || typeof rt.varNamedUpCount !== "object") rt.varNamedUpCount = {};
      if(!rt.varNamedDownCount || typeof rt.varNamedDownCount !== "object") rt.varNamedDownCount = {};
      const named = (rt.varsNamed && typeof rt.varsNamed === "object") ? rt.varsNamed : {};
      Object.keys(named).forEach((key)=>{
        const name = normalizeMissionVarName(key);
        if(!name) return;
        const curr = Number(named[key] || 0);
        const prev = Number(rt.varNamedPrev[name]);
        if(isFinite(prev)){
          if(curr >= prev){
            rt.varNamedUpCount[name] = Math.min(65535, Math.round(Number(rt.varNamedUpCount[name] || 0) + 1));
          }else{
            rt.varNamedUpCount[name] = 0;
          }
          if(curr <= prev){
            rt.varNamedDownCount[name] = Math.min(65535, Math.round(Number(rt.varNamedDownCount[name] || 0) + 1));
          }else{
            rt.varNamedDownCount[name] = 0;
          }
        }else{
          rt.varNamedUpCount[name] = 0;
          rt.varNamedDownCount[name] = 0;
        }
        rt.varNamedPrev[name] = curr;
      });
    }
    function replayMissionGetVarChangeCount(rt, varName, channel, trendCmp){
      const direction = normalizeMissionComparator(trendCmp, "var_change_count");
      const named = normalizeMissionVarName(varName);
      if(named){
        if(direction === "lt"){
          return Math.max(0, Math.round(Number((rt && rt.varNamedDownCount) ? rt.varNamedDownCount[named] : 0)));
        }
        return Math.max(0, Math.round(Number((rt && rt.varNamedUpCount) ? rt.varNamedUpCount[named] : 0)));
      }
      const slot = Math.max(1, Math.min(8, Math.round(Number(channel || 1)))) - 1;
      if(direction === "lt"){
        return Math.max(0, Math.round(Number(rt && rt.varDownCount ? rt.varDownCount[slot] : 0)));
      }
      return Math.max(0, Math.round(Number(rt && rt.varUpCount ? rt.varUpCount[slot] : 0)));
    }
    function replayMissionGetSensorValue(rt, sensorType){
      const key = normalizeMissionExprSensorType(sensorType);
      const s = (rt && rt.lastSensorCtx && typeof rt.lastSensorCtx === "object") ? rt.lastSensorCtx : {};
      if(key === "altitude_m") return Number(s.altitudeM);
      if(key === "time_after_firing_ms") return Number(s.timeAfterFiringMs);
      if(key === "gyro_x_deg") return Number(s.gyroXDeg);
      if(key === "gyro_y_deg") return Number(s.gyroYDeg);
      if(key === "gyro_z_deg") return Number(s.gyroZDeg);
      if(key === "thrust_kgf") return Number(s.thrustKgf);
      if(key === "pressure_mpa") return Number(s.pressureMpa);
      if(key === "acc_x_g") return Number(s.axG);
      if(key === "acc_y_g") return Number(s.ayG);
      if(key === "acc_z_g") return Number(s.azG);
      if(key === "gyro_x_dps") return Number(s.gxDps);
      if(key === "gyro_y_dps") return Number(s.gyDps);
      if(key === "gyro_z_dps") return Number(s.gzDps);
      if(key === "switch_state") return Number(s.switchState);
      return 0;
    }
    function replayMissionPushSensorHistory(rt){
      if(!rt) return;
      if(!rt.sensorHistory || typeof rt.sensorHistory !== "object"){
        rt.sensorHistory = {};
      }
      MISSION_SENSOR_KEYS.forEach((sensorKey)=>{
        const value = Number(replayMissionGetSensorValue(rt, sensorKey));
        if(!isFinite(value)) return;
        let list = rt.sensorHistory[sensorKey];
        if(!Array.isArray(list)){
          list = [];
          rt.sensorHistory[sensorKey] = list;
        }
        list.push(value);
        if(list.length > MISSION_SENSOR_HISTORY_MAX){
          list.splice(0, list.length - MISSION_SENSOR_HISTORY_MAX);
        }
      });
    }
    function replayMissionSensorAverage(rt, sensorType, sampleCount){
      const key = normalizeMissionExprSensorType(sensorType);
      const count = Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, Math.round(Number(sampleCount || 1))));
      const list = (rt && rt.sensorHistory && Array.isArray(rt.sensorHistory[key])) ? rt.sensorHistory[key] : [];
      if(!list.length){
        const fallback = Number(replayMissionGetSensorValue(rt, key));
        return Math.round(isFinite(fallback) ? fallback : 0);
      }
      const take = Math.max(1, Math.min(count, list.length));
      let sum = 0;
      for(let i = list.length - take; i < list.length; i++){
        const v = Number(list[i]);
        sum += isFinite(v) ? v : 0;
      }
      return Math.round(sum / take);
    }
    function replayMissionEvalThenValue(rt, then, fallbackChannel){
      const action = (then && typeof then === "object") ? then : {};
      const baseValue = Math.round(Number(action.value || 0));
      const targetChannel = Math.max(1, Math.min(8, Math.round(Number(fallbackChannel || action.channel || 1))));
      const expr = normalizeMissionExprObject(action.expr, baseValue, targetChannel);
      if(!expr.enabled){
        return normalizeMissionExprValue(baseValue, 0);
      }
      return evaluateMissionExprValue(expr, (varName, channel)=>replayMissionGetVarValue(
        rt,
        varName,
        Math.max(1, Math.min(8, Math.round(Number(channel || targetChannel))))
      ), baseValue, (sensor)=>replayMissionGetSensorValue(rt, sensor));
    }

    function replayMissionSingleWhenSatisfied(when, ctx, rt){
      const cond = when && typeof when === "object" ? when : {};
      const type = String(cond.type || "");
      const cmp = cond.cmp;
      let threshold = Number(cond.value);
      if(type === "var_value"){
        const rhsType = normalizeMissionVarWhenRhsType(cond.rhsType);
        if(rhsType === "var"){
          threshold = replayMissionGetVarValue(rt, cond.rhsVarName, cond.pin);
        }else{
          threshold = Number(cond.rhsValue != null ? cond.rhsValue : cond.value);
        }
      }

      if(type === "switch_rising") return !!ctx.switchRising;
      if(type === "switch_falling") return !!ctx.switchFalling;
      if(type === "boot") return true;
      if(type === "altitude_gte") return replayMissionCompare(ctx.altitudeM, threshold, cmp);
      if(type === "time_after_firing_ms") return replayMissionCompare(ctx.timeAfterFiringMs, threshold, cmp);
      if(type === "gyro_x_deg") return replayMissionCompare(ctx.gyroXDeg, threshold, cmp);
      if(type === "gyro_y_deg") return replayMissionCompare(ctx.gyroYDeg, threshold, cmp);
      if(type === "gyro_z_deg") return replayMissionCompare(ctx.gyroZDeg, threshold, cmp);
      if(type === "var_value"){
        const val = replayMissionGetVarValue(rt, cond.varName, cond.pin);
        return replayMissionCompare(val, threshold, cmp);
      }
      if(type === "var_change_count"){
        const trendCmp = normalizeMissionComparator(cmp, "var_change_count");
        const count = replayMissionGetVarChangeCount(rt, cond.varName, cond.pin, trendCmp);
        const need = Math.max(1, Math.round(Number(cond.value || 1)));
        return count >= need;
      }
      return false;
    }

    function replayMissionWhenSatisfied(block, ctx, rt){
      const whenAll = Array.isArray(block && block.whenAll) ? block.whenAll : null;
      const chain = (whenAll && whenAll.length) ? whenAll : [((block && block.when) ? block.when : {})];
      if(!chain.length) return false;
      for(let i = 0; i < chain.length; i++){
        if(!replayMissionSingleWhenSatisfied(chain[i], ctx, rt)){
          return false;
        }
      }
      return true;
    }

    function missionActionDispatchGate(actionType){
      const type = String(actionType || "");
      if(type === "pyro"){
        if(lockoutLatched){
          return {ok:false, reason:"LOCKOUT"};
        }
        if(safetyModeEnabled){
          return {ok:false, reason:"SAFETY_MODE"};
        }
      }
      return {ok:true, reason:""};
    }

    function replayMissionExecuteAction(item){
      const rt = replayMissionRuntime;
      if(!rt) return;
      const then = (item && item.then) ? item.then : {};
      const type = String(then.type || "");
      const blockNo = Math.max(1, Number(item.blockIndex) + 1);
      const ch = Math.max(1, Math.round(Number(then.channel || 1)));
      const applyHardware = !!(item && item.applyHardware);
      const isReplayItem = !!(item && item.isReplay);
      const logTag = isReplayItem ? "RPL-MSN" : "MSN";
      const logPrefix = isReplayItem ? "Replay" : "Mission";
      if(type === "servo"){
        const servoCh = Math.max(1, Math.min(4, ch));
        const angle = clampServoAngle(then.angle);
        setServoUiAngle(servoCh, angle);
        if(applyHardware){
          sendCommand({http:"/servo?ch=" + servoCh + "&deg=" + angle, ser:"SERVO " + servoCh + " " + angle}, false);
          if(isReplayItem){
            addLogLine("Replay block #" + blockNo + " → SERVO CH" + servoCh + " = " + angle + "° (HW)", logTag);
          }else{
            addLogLine("Mission block #" + blockNo + " → SERVO CH" + servoCh + " = " + angle + "°", logTag);
          }
        }else{
          addLogLine("Replay block #" + blockNo + " → SERVO CH" + servoCh + " = " + angle + "°", logTag);
        }
        return;
      }
      if(type === "pyro"){
        const pyroCh = Math.max(1, Math.min(4, ch));
        const durationMs = Math.max(10, Math.round(Number(then.durationMs || 300)));
        if(applyHardware){
          sendCommand({http:"/pyro_test?ch=" + pyroCh + "&ms=" + durationMs, ser:"PYRO " + pyroCh + " " + durationMs}, false);
          if(isReplayItem){
            addLogLine("Replay block #" + blockNo + " → PYRO CH" + pyroCh + " for " + durationMs + "ms (HW)", logTag);
          }else{
            addLogLine("Mission block #" + blockNo + " → PYRO CH" + pyroCh + " for " + durationMs + "ms", logTag);
          }
        }else{
          addLogLine("Replay block #" + blockNo + " → PYRO CH" + pyroCh + " for " + durationMs + "ms", logTag);
        }
        return;
      }
      if(type === "buzzer"){
        const hz = Math.max(1, Math.min(10000, Math.round(Number(then.value || then.hz || 2000))));
        if(applyHardware){
          sendCommand({http:"/buzzer?hz=" + hz, ser:"BEEP " + hz}, false);
          if(isReplayItem){
            addLogLine("Replay block #" + blockNo + " → BUZZER " + hz + "Hz (HW)", logTag);
          }else{
            addLogLine("Mission block #" + blockNo + " → BUZZER " + hz + "Hz", logTag);
          }
        }else{
          playTone(hz, 220, 0);
          addLogLine("Replay block #" + blockNo + " → BUZZER " + hz + "Hz", logTag);
        }
        return;
      }
      if(type === "find_buzzer"){
        if(applyHardware){
          addLogLine("Mission block #" + blockNo + " → FIND_BUZZER pattern", logTag);
        }else{
          playTone(1760, 120, 0);
          setTimeout(()=>playTone(2349, 160, 0), 220);
          setTimeout(()=>playTone(1568, 120, 0), 500);
          addLogLine("Replay block #" + blockNo + " → FIND_BUZZER pattern", logTag);
        }
        return;
      }
      if(type === "notone"){
        if(applyHardware){
          sendCommand({http:"/buzzer_stop", ser:"NOTONE"}, false);
          if(isReplayItem){
            addLogLine("Replay block #" + blockNo + " → NOTONE (HW)", logTag);
          }else{
            addLogLine("Mission block #" + blockNo + " → NOTONE", logTag);
          }
        }else{
          addLogLine("Replay block #" + blockNo + " → NOTONE", logTag);
        }
        return;
      }
      if(type === "alarm"){
        const title = normalizeMissionAlarmTitle(then.title);
        const message = normalizeMissionAlarmMessage(then.message) || "알람이 발생했습니다.";
        showToast(message, "notice", {
          key:"mission-alarm-" + blockNo + "-" + Date.now(),
          title:title
        });
        addLogLine(logPrefix + " block #" + blockNo + " → ALARM \"" + title + "\" : " + message, logTag);
        return;
      }
      if(type === "var_set"){
        const nextVal = replayMissionEvalThenValue(rt, then, ch);
        const saved = replayMissionSetVarValue(rt, then.varName, ch, nextVal);
        const named = normalizeMissionVarName(then.varName);
        const label = named ? named : ("VAR" + Math.max(1, Math.min(8, ch)));
        addLogLine(logPrefix + " block #" + blockNo + " → " + label + " = " + saved, logTag);
        return;
      }
      if(type === "var_add"){
        const delta = replayMissionEvalThenValue(rt, then, ch);
        const base = replayMissionGetVarValue(rt, then.varName, ch);
        const next = Math.round(base + delta);
        const saved = replayMissionSetVarValue(rt, then.varName, ch, next);
        const named = normalizeMissionVarName(then.varName);
        const label = named ? named : ("VAR" + Math.max(1, Math.min(8, ch)));
        addLogLine(logPrefix + " block #" + blockNo + " → " + label + " += " + delta + " (" + saved + ")", logTag);
        return;
      }
      if(type === "var_avg"){
        const sampleCount = Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, Math.round(Number(then.avgCount || then.samples || 1))));
        const sensorType = normalizeMissionExprSensorType(then.sensor != null ? then.sensor : then.sensorType);
        const avg = replayMissionSensorAverage(rt, sensorType, sampleCount);
        const saved = replayMissionSetVarValue(rt, then.varName, ch, avg);
        const named = normalizeMissionVarName(then.varName);
        const label = named ? named : ("VAR" + Math.max(1, Math.min(8, ch)));
        addLogLine(logPrefix + " block #" + blockNo + " → " + label + " = AVG(" + sensorType + ", " + sampleCount + ") = " + saved, logTag);
      }
    }

    function replayMissionFlushPending(sampleTimeMs){
      const rt = replayMissionRuntime;
      if(!rt || !rt.pending.length) return;
      rt.pending.sort((a, b)=>a.execAtMs - b.execAtMs);
      while(rt.pending.length && rt.pending[0].execAtMs <= sampleTimeMs){
        const item = rt.pending.shift();
        replayMissionExecuteAction(item);
      }
    }

    function processReplayMissionRuntime(sample, ctx, isReplayMode){
      if(!replayMissionRuntime) resetReplayMissionRuntime();
      if(!replayMissionRuntime.prepared) prepareReplayMissionRuntime();
      const rt = replayMissionRuntime;
      if(!rt.enabled) return;
      const isReplay = !!isReplayMode;

      const sampleTimeMsRaw = Number(ctx && ctx.sampleTimeMs);
      const sampleTimeMs = isFinite(sampleTimeMsRaw) ? sampleTimeMsRaw : Date.now();
      const swNow = Number(ctx && ctx.sw) ? 1 : 0;
      const stNow = Math.round(Number(ctx && ctx.st));
      const thrustNow = Number(ctx && ctx.thrustKgf);
      const tdNow = Number(ctx && ctx.tdMs);
      const switchRising = (rt.lastSwitch === 0 && swNow === 1);
      const switchFalling = (rt.lastSwitch === 1 && swNow === 0);

      if((stNow === 2 || (isFinite(thrustNow) && thrustNow >= IGN_THRUST_THRESHOLD)) && rt.firingStartMs == null){
        rt.firingStartMs = sampleTimeMs;
      }
      let timeAfterFiringMs = NaN;
      if(isFinite(tdNow) && tdNow >= 0){
        timeAfterFiringMs = tdNow;
      }else if(rt.firingStartMs != null){
        timeAfterFiringMs = Math.max(0, sampleTimeMs - rt.firingStartMs);
      }

      rt.lastSensorCtx = {
        switchState: swNow,
        thrustKgf: isFinite(thrustNow) ? thrustNow : Number(sample && sample.t),
        pressureMpa: Number(sample && sample.p),
        altitudeM: Number(ctx && ctx.altitudeM),
        timeAfterFiringMs: isFinite(timeAfterFiringMs) ? timeAfterFiringMs : 0,
        gyroXDeg: Number(ctx && ctx.gyroXDeg),
        gyroYDeg: Number(ctx && ctx.gyroYDeg),
        gyroZDeg: Number(ctx && ctx.gyroZDeg),
        axG: Number(sample && sample.ax),
        ayG: Number(sample && sample.ay),
        azG: Number(sample && sample.az),
        gxDps: Number(sample && sample.gx),
        gyDps: Number(sample && sample.gy),
        gzDps: Number(sample && sample.gz)
      };
      replayMissionPushSensorHistory(rt);

      replayMissionFlushPending(sampleTimeMs);
      replayMissionUpdateVarChangeCounters(rt);

      const condCtx = {
        switchRising,
        switchFalling,
        altitudeM: Number(ctx && ctx.altitudeM),
        timeAfterFiringMs,
        gyroXDeg: Number(ctx && ctx.gyroXDeg),
        gyroYDeg: Number(ctx && ctx.gyroYDeg),
        gyroZDeg: Number(ctx && ctx.gyroZDeg)
      };

      for(let i = 0; i < rt.blocks.length; i++){
        const block = rt.blocks[i];
        if(!block || block.enabled === false) continue;
        if(!rt.blockState[i]){
          rt.blockState[i] = { lastWhen: false, fired: false, lastGateReason: "" };
        }
        const state = rt.blockState[i];
        if(block.once && state.fired){
          state.lastWhen = false;
          continue;
        }
        const whenNow = replayMissionWhenSatisfied(block, condCtx, rt);
        const actionType = String(((block && block.then) ? block.then.type : "") || "");
        if(!whenNow){
          state.lastWhen = false;
          state.lastGateReason = "";
          continue;
        }
        const gate = missionActionDispatchGate(actionType);
        if(!gate.ok){
          const blockedReason = String(gate.reason || "BLOCKED");
          if(state.lastGateReason !== blockedReason){
            addLogLine((isReplay ? "Replay" : "Mission") + " block #" + (i + 1) + " blocked: " + blockedReason, isReplay ? "RPL-MSN" : "MSN");
            state.lastGateReason = blockedReason;
          }
          // Keep edge unconsumed so action can fire when gate is cleared.
          state.lastWhen = false;
          continue;
        }
        state.lastGateReason = "";
        const triggered = !state.lastWhen;
        state.lastWhen = true;
        if(!triggered) continue;
        const delayMs = Math.max(0, Math.round(Number(block.delayMs || 0)));
        rt.pending.push({
          blockIndex: i,
          execAtMs: sampleTimeMs + delayMs,
          then: block.then || {},
          // Live mission: always hardware apply.
          // Replay mission: allow SERVO/PYRO action to drive real hardware for ground test.
          applyHardware: (!isReplay) || (actionType === "servo") || (actionType === "pyro"),
          isReplay: isReplay
        });
        if(rt.pending.length > 64){
          rt.pending.splice(0, rt.pending.length - 64);
        }
        if(block.once) state.fired = true;
      }

      replayMissionFlushPending(sampleTimeMs);
      rt.lastSwitch = swNow;
      rt.lastState = isFinite(stNow) ? stNow : 0;
      rt.lastSampleMs = sampleTimeMs;
    }

    function setReplayStatus(text){
      if(el.replayStatusText) el.replayStatusText.textContent = String(text || "");
    }

    function setActiveDataSource(mode){
      const next = (mode === DATA_SOURCE_REPLAY) ? DATA_SOURCE_REPLAY : DATA_SOURCE_LIVE;
      if(activeDataSource === next) return;
      activeDataSource = next;
      replaySourceActive = (next === DATA_SOURCE_REPLAY);
      if(replaySourceActive){
        prepareReplayMissionRuntime();
      }else{
        resetReplayMissionRuntime();
      }
      updateInspectionAccess();
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      updateControlAccessUI(currentSt);
      evaluateRuntimeAlarms(Date.now());
    }

    function resetReplayBuffers(){
      thrustBaseHistory = [];
      pressureBaseHistory = [];
      quickAltitudeHistory = [];
      gyroSpeedHistory = [];
      accelMagHistory = [];
      accelXHistory = [];
      accelYHistory = [];
      accelZHistory = [];
      gyroXHistory = [];
      gyroYHistory = [];
      gyroZHistory = [];
      chartTimeHistory = [];
      sampleHistory = [];
      logData = [];
      logDataRevision = 0;
      reportExportedRevision = 0;
      reportExportedOnce = false;
      firstSampleMs = null;
      sampleCounter = 0;
      resetGyroAttitudeState();
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
      resetQuickFlightMetricsState();
      lastStatusCode = -1;
      currentSt = 0;
      sequenceActive = false;
      st2StartMs = null;
      localTplusActive = false;
      localTplusStartMs = null;
      resetParachuteDeployState();
      resetGyroPathTracking();
      resetReplayMissionRuntime();
      if(el.countdown) el.countdown.textContent = "T- --:--:--";
      if(el.countdownMobile) el.countdownMobile.textContent = "T- --:--:--";
      if(el.countdownBig) el.countdownBig.textContent = "T- --:--:--";
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
      if(el.replayOpenBtns && el.replayOpenBtns.length){
        el.replayOpenBtns.forEach(btn=>{
          btn.setAttribute("aria-label", "Replay");
          btn.setAttribute("title", "Replay");
        });
      }
      if(el.replayFileBtn){
        el.replayFileBtn.classList.toggle("is-loaded", !!replayState.fileName);
      }
      syncControlsPanelTitle();
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
      updateNavActionState();
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
      const replaySample = Object.assign({}, frame.sample, {_replayTsMs: frame.tsMs});
      onIncomingSample(replaySample, "REPLAY");
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
        showToast("리플레이 파일(.xlsx/.csv/.bin)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
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
        showToast("리플레이 파일(.xlsx/.csv/.bin)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
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
        showToast("리플레이 파일(.xlsx/.csv/.bin)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
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
      if(isTabletPanelModeBlocked()){
        showTabletPanelBlockedToast("replay");
        return;
      }
      if(isTabletControlsLayout()){
        showTabletControlsPanel();
      }
      setLauncherPanelVisible(false);
      setMissionPanelVisible(false);
      setInspectionPanelVisible(false);
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

    function replayConvertThrustToKgf(headerNorm, value){
      const v = Number(value);
      if(!isFinite(v)) return NaN;
      const h = String(headerNorm || "");
      if(h.includes("thrustn") || h.includes("motorthrustn")){
        return v / 9.80665;
      }
      return v;
    }

    function replayConvertPressureToMpa(headerNorm, value){
      const v = Number(value);
      if(!isFinite(v)) return NaN;
      const h = String(headerNorm || "");
      if(h.includes("pressurev") || h === "pv"){
        return pressureVoltToMpa(v);
      }
      if(h.includes("pressurepa")){
        return v / 1000000;
      }
      if(h.includes("pressurekpa")){
        return v / 1000;
      }
      if(h.includes("pressurebar")){
        return v * 0.1;
      }
      return v;
    }

    function replayConvertAccelToG(headerNorm, value){
      const v = Number(value);
      if(!isFinite(v)) return NaN;
      const h = String(headerNorm || "");
      if(h.includes("ms2")){
        return v / 9.80665;
      }
      return v;
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
        const thrustIdx = replayFindHeaderIndex(row, [
          "thrust_kgf", "추력_kgf", "thrustkgf", "thrustn", "motorthrustn", "thrust", "t"
        ]);
        const pressureIdx = replayFindHeaderIndex(row, [
          "pressure_mpa", "압력_mpa", "pressure_v", "압력_v", "airpressurepa",
          "airpressurekpa", "airpressurebar", "airpressure",
          "pressurepa", "pressurekpa", "pressurebar", "pressure", "p"
        ]);
        const timeIdx = replayFindHeaderIndex(row, [
          "time_iso", "timestamp", "datetime", "time", "times", "timesec", "timesecs", "time_s", "time_sec"
        ]);
        const altIdx = replayFindHeaderIndex(row, [
          "altitude_m", "altitudem", "altitude", "alt_m", "alt"
        ]);
        if(thrustIdx >= 0 || pressureIdx >= 0 || timeIdx >= 0 || altIdx >= 0){
          headerRow = i;
          break;
        }
      }

      const headers = rows[headerRow] || [];
      const col = {
        timeIso: replayFindHeaderIndex(headers, [
          "time_iso", "시간_iso", "timestamp", "datetime", "utc_time", "time_iso8601", "date", "datetimeutc"
        ]),
        thrust: replayFindHeaderIndex(headers, [
          "thrust_kgf", "추력_kgf", "thrustkgf", "thrustn", "motorthrustn", "thrust", "t"
        ]),
        pressure: replayFindHeaderIndex(headers, [
          "pressure_mpa", "압력_mpa", "pressure_v", "압력_v", "pv",
          "airpressurepa", "airpressurekpa", "airpressurebar", "airpressure",
          "pressurepa", "pressurekpa", "pressurebar", "pressure", "p"
        ]),
        gpsLat: replayFindHeaderIndex(headers, [
          "gps_lat", "gpslat", "gpslatitude", "nav_lat", "latitude", "lat",
          "gps_위도_deg", "위도_deg", "위도"
        ]),
        gpsLon: replayFindHeaderIndex(headers, [
          "gps_lon", "gpslng", "gpslong", "gpslongitude", "nav_lon", "nav_lng", "longitude", "lon", "lng",
          "gps_경도_deg", "경도_deg", "경도"
        ]),
        gpsAlt: replayFindHeaderIndex(headers, [
          "gps_alt", "gpsalt", "gpsaltitude", "nav_alt", "altitude_gps_m",
          "gps_고도_m", "고도_gps_m"
        ]),
        altitudeM: replayFindHeaderIndex(headers, [
          "altitude_m", "고도_m", "alt_m", "altitude", "alt", "gps_alt",
          "altitude_msl", "altitudem", "고도m", "고도"
        ]),
        speedMps: replayFindHeaderIndex(headers, [
          "speed_mps", "속도_mps", "gps_speed_mps", "ground_speed_mps", "velocity_mps", "speed",
          "velocity", "speedms", "speedmps", "verticalvelocity", "verticalvelocityms", "totalvelocityms",
          "velocityzms", "속도"
        ]),
        accelX: replayFindHeaderIndex(headers, [
          "accel_x_g", "가속도_x_g", "ax", "accel_x", "accelerationxms2", "accelerationx"
        ]),
        accelY: replayFindHeaderIndex(headers, [
          "accel_y_g", "가속도_y_g", "ay", "accel_y", "accelerationyms2", "accelerationy"
        ]),
        accelZ: replayFindHeaderIndex(headers, [
          "accel_z_g", "가속도_z_g", "az", "accel_z", "accelerationzms2", "accelerationz", "accelerationtotalms2"
        ]),
        gyroX: replayFindHeaderIndex(headers, [
          "gyro_x_dps", "자이로_x_dps", "gx", "gyro_x", "rotationratex", "rotationratexs", "rotationratexdegs", "rollratedegs", "rollrate"
        ]),
        gyroY: replayFindHeaderIndex(headers, [
          "gyro_y_dps", "자이로_y_dps", "gy", "gyro_y", "rotationratey", "rotationrateys", "rotationrateydegs", "pitchratedegs", "pitchrate"
        ]),
        gyroZ: replayFindHeaderIndex(headers, [
          "gyro_z_dps", "자이로_z_dps", "gz", "gyro_z", "rotationratez", "rotationratezs", "rotationratezdegs", "yawratedegs", "yawrate"
        ]),
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
        relTimeSec: replayFindHeaderIndex(headers, [
          "rel_time_s", "상대시간_s", "reltime", "time_axis", "time", "times", "timesec", "timesecs", "timesseconds",
          "time_s", "time_sec", "time_seconds"
        ])
      };

      const hasFallbackSignal =
        (col.timeIso >= 0 || col.relTimeSec >= 0 || col.elapsedMs >= 0) ||
        (col.altitudeM >= 0 || col.speedMps >= 0) ||
        (col.accelX >= 0 || col.accelY >= 0 || col.accelZ >= 0) ||
        (col.gyroX >= 0 || col.gyroY >= 0 || col.gyroZ >= 0) ||
        (col.gpsLat >= 0 || col.gpsLon >= 0 || col.gpsAlt >= 0);
      if(col.thrust < 0 && col.pressure < 0 && !hasFallbackSignal){
        throw new Error("리플레이 컬럼을 찾지 못했습니다. (추력/압력/시간/고도)");
      }

      const thrustHeaderNorm = (col.thrust >= 0) ? replayNormalizeHeader(headers[col.thrust]) : "";
      const pressureHeaderNorm = (col.pressure >= 0) ? replayNormalizeHeader(headers[col.pressure]) : "";
      const accelXHeaderNorm = (col.accelX >= 0) ? replayNormalizeHeader(headers[col.accelX]) : "";
      const accelYHeaderNorm = (col.accelY >= 0) ? replayNormalizeHeader(headers[col.accelY]) : "";
      const accelZHeaderNorm = (col.accelZ >= 0) ? replayNormalizeHeader(headers[col.accelZ]) : "";

      const samples = [];
      let prevTs = null;
      for(let r = headerRow + 1; r < rows.length; r++){
        const row = rows[r] || [];
        if(!row.length) continue;

        const thrustRaw = replayToNumber(col.thrust >= 0 ? row[col.thrust] : null, NaN);
        const thrustVal = replayConvertThrustToKgf(thrustHeaderNorm, thrustRaw);
        const pressureRaw = replayToNumber(col.pressure >= 0 ? row[col.pressure] : null, NaN);
        const pressureVal = replayConvertPressureToMpa(pressureHeaderNorm, pressureRaw);

        const latReplay = replayToNumber(col.gpsLat >= 0 ? row[col.gpsLat] : null, NaN);
        const lonReplay = replayToNumber(col.gpsLon >= 0 ? row[col.gpsLon] : null, NaN);
        const gpsAltReplay = replayToNumber(col.gpsAlt >= 0 ? row[col.gpsAlt] : null, NaN);
        const altReplay = replayToNumber(col.altitudeM >= 0 ? row[col.altitudeM] : null, NaN);
        const speedReplay = replayToNumber(col.speedMps >= 0 ? row[col.speedMps] : null, NaN);

        const accelXVal = replayConvertAccelToG(
          accelXHeaderNorm,
          replayToNumber(col.accelX >= 0 ? row[col.accelX] : null, NaN)
        );
        const accelYVal = replayConvertAccelToG(
          accelYHeaderNorm,
          replayToNumber(col.accelY >= 0 ? row[col.accelY] : null, NaN)
        );
        const accelZVal = replayConvertAccelToG(
          accelZHeaderNorm,
          replayToNumber(col.accelZ >= 0 ? row[col.accelZ] : null, NaN)
        );
        const gyroXVal = replayToNumber(col.gyroX >= 0 ? row[col.gyroX] : null, NaN);
        const gyroYVal = replayToNumber(col.gyroY >= 0 ? row[col.gyroY] : null, NaN);
        const gyroZVal = replayToNumber(col.gyroZ >= 0 ? row[col.gyroZ] : null, NaN);

        const hasPayload =
          isFinite(thrustVal) || isFinite(pressureVal) ||
          isFinite(latReplay) || isFinite(lonReplay) || isFinite(gpsAltReplay) ||
          isFinite(altReplay) || isFinite(speedReplay) ||
          isFinite(accelXVal) || isFinite(accelYVal) || isFinite(accelZVal) ||
          isFinite(gyroXVal) || isFinite(gyroYVal) || isFinite(gyroZVal);
        if(!hasPayload) continue;

        let tsMs = null;
        if(col.timeIso >= 0){
          const rawTs = row[col.timeIso];
          if(typeof rawTs === "number"){
            if(rawTs > 1000000000000){
              tsMs = rawTs;
            }else if(rawTs > 1000000000){
              tsMs = rawTs * 1000;
            }else if(rawTs > 30000){
              tsMs = replayExcelSerialToMs(rawTs);
            }else if(rawTs >= 0){
              tsMs = rawTs * 1000;
            }else{
              tsMs = (rawTs > 1000000000000) ? rawTs : (rawTs * 1000);
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
            gps_lat: isFinite(latReplay) ? latReplay : null,
            gps_lon: isFinite(lonReplay) ? lonReplay : null,
            gps_alt: isFinite(gpsAltReplay) ? gpsAltReplay : null,
            alt_m: isFinite(altReplay) ? altReplay : null,
            speed_mps: isFinite(speedReplay) ? speedReplay : null,
            ax: isFinite(accelXVal) ? accelXVal : 0,
            ay: isFinite(accelYVal) ? accelYVal : 0,
            az: isFinite(accelZVal) ? accelZVal : 0,
            gx: isFinite(gyroXVal) ? gyroXVal : 0,
            gy: isFinite(gyroYVal) ? gyroYVal : 0,
            gz: isFinite(gyroZVal) ? gyroZVal : 0,
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

    function replayDetectCsvDelimiter(line){
      const text = String(line || "");
      const candidates = [",", ";", "\t", "|"];
      let best = ",";
      let bestScore = -1;
      for(const d of candidates){
        let inQuotes = false;
        let score = 0;
        for(let i = 0; i < text.length; i++){
          const ch = text[i];
          if(ch === "\""){
            if(inQuotes && text[i + 1] === "\""){
              i += 1;
            }else{
              inQuotes = !inQuotes;
            }
            continue;
          }
          if(!inQuotes && ch === d){
            score += 1;
          }
        }
        if(score > bestScore){
          bestScore = score;
          best = d;
        }
      }
      return best;
    }

    function replayParseCsvLine(line, delimiter){
      const delim = delimiter || ",";
      const src = String(line == null ? "" : line);
      const out = [];
      let cur = "";
      let inQuotes = false;
      for(let i = 0; i < src.length; i++){
        const ch = src[i];
        if(ch === "\""){
          if(inQuotes && src[i + 1] === "\""){
            cur += "\"";
            i += 1;
          }else{
            inQuotes = !inQuotes;
          }
          continue;
        }
        if(!inQuotes && ch === delim){
          out.push(cur.trim());
          cur = "";
          continue;
        }
        cur += ch;
      }
      out.push(cur.trim());
      return out;
    }

    function replayParseCsvText(csvText){
      const text = String(csvText || "").replace(/^\uFEFF/, "");
      const lines = text.split(/\r\n|\n|\r/).filter((line)=>String(line || "").trim() !== "");
      if(!lines.length){
        throw new Error("CSV 데이터가 비어 있습니다.");
      }
      const delimiter = replayDetectCsvDelimiter(lines[0]);
      const rows = [];
      for(const line of lines){
        rows.push(replayParseCsvLine(line, delimiter));
      }
      return rows;
    }

    async function parseReplayCsv(file){
      if(!file) throw new Error("리플레이 CSV 파일이 선택되지 않았습니다.");
      const text = await file.text();
      const rows = replayParseCsvText(text);
      return replayBuildSamples(rows);
    }

    const REPLAY_BIN_HEADER_MIN_BYTES = 40;
    const REPLAY_BIN_RECORD_HEADER_BYTES = 16;
    const REPLAY_BIN_SAMPLE_PAYLOAD_BYTES = 70;
    const REPLAY_BIN_RECORD_MARKER = 0xA55A;

    function replayReadMagicText(dv, offset, len){
      let out = "";
      for(let i = 0; i < len; i++){
        const c = dv.getUint8(offset + i);
        if(c === 0) break;
        out += String.fromCharCode(c);
      }
      return out;
    }

    function replayIsLikelyRawRecordStream(dv, startOffset, endOffset, marker){
      if(!(dv instanceof DataView)) return false;
      const start = Math.max(0, Number(startOffset) || 0);
      const end = Math.min(dv.byteLength, Number(endOffset) || dv.byteLength);
      if((start + REPLAY_BIN_RECORD_HEADER_BYTES) > end) return false;

      const mk = dv.getUint16(start + 0, true);
      const recVersion = dv.getUint8(start + 2);
      const payloadSize = dv.getUint16(start + 4, true);
      const nextOffset = start + REPLAY_BIN_RECORD_HEADER_BYTES + payloadSize;

      if(mk !== marker) return false;
      if(recVersion !== 1) return false;
      if(payloadSize === 0 || payloadSize > 2048) return false;
      if(nextOffset > end) return false;
      return true;
    }

    function replayParseBinRecordRange(dv, startOffset, endOffset, marker){
      const start = Math.max(0, Number(startOffset) || 0);
      const end = Math.min(dv.byteLength, Number(endOffset) || dv.byteLength);
      const samples = [];
      let offset = start;
      let prevTs = null;

      while((offset + REPLAY_BIN_RECORD_HEADER_BYTES) <= end){
        const mk = dv.getUint16(offset + 0, true);
        const recVersion = dv.getUint8(offset + 2);
        const recType = dv.getUint8(offset + 3);
        const payloadSize = dv.getUint16(offset + 4, true);
        let tsMs = dv.getUint32(offset + 8, true);
        const payloadOffset = offset + REPLAY_BIN_RECORD_HEADER_BYTES;
        const nextOffset = payloadOffset + payloadSize;

        if(payloadSize === 0){
          offset += 1;
          continue;
        }
        if(nextOffset > end){
          if(samples.length > 0) break;
          throw new Error("BIN 레코드 경계가 손상되었습니다.");
        }
        if(mk !== marker){
          if(samples.length > 0) break;
          throw new Error("BIN 레코드 마커 오류");
        }
        if(recVersion !== 1){
          if(samples.length > 0){
            offset = nextOffset;
            continue;
          }
          throw new Error("지원되지 않는 BIN 레코드 버전: " + recVersion);
        }

        if(recType === 1 && payloadSize >= REPLAY_BIN_SAMPLE_PAYLOAD_BYTES){
          const base = payloadOffset;
          const sample = {
            t: dv.getFloat32(base + 0, true),
            p: dv.getFloat32(base + 4, true),
            ax: dv.getFloat32(base + 8, true),
            ay: dv.getFloat32(base + 12, true),
            az: dv.getFloat32(base + 16, true),
            gx: dv.getFloat32(base + 20, true),
            gy: dv.getFloat32(base + 24, true),
            gz: dv.getFloat32(base + 28, true),
            iv: dv.getFloat32(base + 32, true),
            bp: dv.getUint8(base + 36),
            ut: dv.getUint32(base + 37, true),
            lt: dv.getUint16(base + 41, true),
            ct: dv.getUint16(base + 43, true),
            hz: dv.getUint16(base + 45, true),
            s: dv.getUint8(base + 47),
            ic: dv.getUint8(base + 48),
            r: dv.getUint8(base + 49),
            gs: dv.getUint8(base + 50),
            st: dv.getUint8(base + 51),
            td: dv.getInt32(base + 52, true),
            uw: dv.getUint8(base + 56),
            ab: dv.getUint8(base + 57),
            ar: dv.getUint8(base + 58),
            m: dv.getUint8(base + 59),
            rs: dv.getUint8(base + 60),
            rf: dv.getUint8(base + 61),
            rm: dv.getUint8(base + 62),
            ss: dv.getUint8(base + 63),
            sm: dv.getUint8(base + 64),
            wq: dv.getUint32(base + 65, true),
            we: dv.getUint8(base + 69)
          };

          if(prevTs != null && tsMs <= prevTs){
            tsMs = prevTs + 1;
          }
          prevTs = tsMs;
          samples.push({tsMs, sample});
        }

        offset = nextOffset;
      }

      if(!samples.length){
        throw new Error("BIN 파일에 리플레이 샘플이 없습니다.");
      }
      return samples;
    }

    function replayBuildSamplesFromBin(arrayBuffer){
      if(!(arrayBuffer instanceof ArrayBuffer)){
        throw new Error("BIN 버퍼가 유효하지 않습니다.");
      }
      if(arrayBuffer.byteLength < REPLAY_BIN_HEADER_MIN_BYTES){
        throw new Error("BIN 헤더 길이가 너무 짧습니다.");
      }

      const dv = new DataView(arrayBuffer);
      const magic = replayReadMagicText(dv, 0, 8);
      if(magic === "HWLOGV1"){
        const version = dv.getUint16(8, true);
        const headerSize = dv.getUint16(10, true);
        const dataBytes = dv.getUint32(12, true);
        const declaredMarker = dv.getUint32(28, true) & 0xFFFF;
        const marker = declaredMarker || REPLAY_BIN_RECORD_MARKER;
        if(version !== 1){
          throw new Error("지원되지 않는 BIN 버전: " + version);
        }
        if(headerSize < REPLAY_BIN_HEADER_MIN_BYTES){
          throw new Error("BIN 헤더 크기가 잘못되었습니다.");
        }

        const dataStart = headerSize;
        const dataEnd = dataStart + dataBytes;
        if(dataEnd > arrayBuffer.byteLength){
          throw new Error("BIN 데이터 길이가 손상되었습니다.");
        }
        return replayParseBinRecordRange(dv, dataStart, dataEnd, marker);
      }

      if(replayIsLikelyRawRecordStream(dv, 0, arrayBuffer.byteLength, REPLAY_BIN_RECORD_MARKER)){
        return replayParseBinRecordRange(dv, 0, arrayBuffer.byteLength, REPLAY_BIN_RECORD_MARKER);
      }

      const scanLimit = Math.min(arrayBuffer.byteLength - 2, 4096);
      for(let i = 0; i <= scanLimit; i++){
        if(dv.getUint16(i, true) !== REPLAY_BIN_RECORD_MARKER) continue;
        if(replayIsLikelyRawRecordStream(dv, i, arrayBuffer.byteLength, REPLAY_BIN_RECORD_MARKER)){
          return replayParseBinRecordRange(dv, i, arrayBuffer.byteLength, REPLAY_BIN_RECORD_MARKER);
        }
      }

      throw new Error("지원되지 않는 BIN 매직입니다.");
    }

    async function parseReplayBin(file){
      if(!file) throw new Error("리플레이 BIN 파일이 선택되지 않았습니다.");
      const arrayBuffer = await file.arrayBuffer();
      return replayBuildSamplesFromBin(arrayBuffer);
    }

    function getReplayParserCandidates(file){
      const lowerName = String((file && file.name) || "").toLowerCase();
      const fileType = String((file && file.type) || "").toLowerCase();
      const candidates = [];
      const push = (id, label, parser)=>{
        if(candidates.some((item)=>item.id === id)) return;
        candidates.push({id, label, parser});
      };

      const isCsvExt = lowerName.endsWith(".csv");
      const isBinExt = lowerName.endsWith(".bin");
      const isXlsxExt = (
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xlsm") ||
        lowerName.endsWith(".xls")
      );
      const csvMime = fileType.includes("csv") || fileType.includes("text/plain");
      const binMime = fileType.includes("octet-stream");

      if(isBinExt || binMime){
        push("bin", "BIN", parseReplayBin);
        push("csv", "CSV", parseReplayCsv);
        push("xlsx", "XLSX", parseReplayXlsx);
      }else if(isCsvExt || csvMime){
        push("csv", "CSV", parseReplayCsv);
        push("xlsx", "XLSX", parseReplayXlsx);
        push("bin", "BIN", parseReplayBin);
      }else if(isXlsxExt){
        push("xlsx", "XLSX", parseReplayXlsx);
        push("csv", "CSV", parseReplayCsv);
        push("bin", "BIN", parseReplayBin);
      }else{
        push("xlsx", "XLSX", parseReplayXlsx);
        push("csv", "CSV", parseReplayCsv);
        push("bin", "BIN", parseReplayBin);
      }

      return candidates;
    }

    async function parseReplayFileAuto(file){
      if(!file) throw new Error("리플레이 파일이 선택되지 않았습니다.");
      const candidates = getReplayParserCandidates(file);
      const reasons = [];
      for(const candidate of candidates){
        try{
          const samples = await candidate.parser(file);
          return {samples, parserLabel: candidate.label};
        }catch(err){
          const reason = (err && err.message) ? err.message : String(err || "unknown");
          reasons.push(candidate.label + ": " + reason);
        }
      }
      throw new Error("자동 판별 실패 (" + reasons.join(" | ") + ")");
    }

    // =====================
    // 통신: WebSocket 스트림
    // =====================
    function getWsUrl(){
      const useFallback = isLocalPreviewHost();
      const proto = (!useFallback && location.protocol === "https:") ? "wss" : "ws";
      const host = useFallback ? "192.168.4.1" : (location.host || "192.168.4.1");
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
        syncOperationModeToBoard(false);
        syncDaqSequencePyroChannelToBoard(false);
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
      const API_BASE = getApiBaseForCommands();
      const order = [preferredEndpoint, ...ENDPOINTS.filter(e=>e!==preferredEndpoint)];
      let lastErr = null;

      for(const path of order){
        const url = API_BASE ? (API_BASE + path) : path;
        try{
          const obj = await fetchJsonTimeout(url, 700);
          preferredEndpoint = path;
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

    function serialBaudCandidates(){
      const out = [];
      const seen = new Set();
      for(const raw of SERIAL_BAUD_CANDIDATES){
        const baud = Math.round(Number(raw));
        if(!isFinite(baud) || baud <= 0) continue;
        if(seen.has(baud)) continue;
        seen.add(baud);
        out.push(baud);
      }
      if(!out.length){
        out.push(SERIAL_BAUD_RATE);
      }
      return out;
    }

    async function closeSerialHandles(opts){
      const closePort = !opts || opts.closePort !== false;
      if(serialReadAbort){ try{ serialReadAbort.abort(); }catch(e){} serialReadAbort = null; }
      if(serialReader){ try{ await serialReader.cancel(); }catch(e){} try{ serialReader.releaseLock(); }catch(e){} serialReader = null; }
      if(serialWriter){ try{ serialWriter.releaseLock(); }catch(e){} serialWriter = null; }
      if(closePort && serialPort){ try{ await serialPort.close(); }catch(e){} }
      serialLineBuf = "";
    }

    function removeSerialAckWaiter(waiter){
      if(!waiter) return;
      const idx = serialAckWaiters.indexOf(waiter);
      if(idx >= 0) serialAckWaiters.splice(idx, 1);
    }

    function settleSerialAckWaiter(waiter, result){
      if(!waiter || waiter.done) return;
      waiter.done = true;
      if(waiter.timer){
        clearTimeout(waiter.timer);
        waiter.timer = null;
      }
      removeSerialAckWaiter(waiter);
      waiter.resolve(result);
    }

    function cancelSerialAckWaiter(waiter, reason){
      settleSerialAckWaiter(waiter, {
        ok:false,
        kind:"cancel",
        message:reason || "SERIAL_CANCELLED"
      });
    }

    function flushSerialAckWaiters(reason){
      const pending = serialAckWaiters.slice();
      for(const waiter of pending){
        cancelSerialAckWaiter(waiter, reason || "SERIAL_DISCONNECTED");
      }
    }

    function createSerialAckWaiter(matchFn, timeoutMs){
      const safeMatch = (typeof matchFn === "function") ? matchFn : (()=>true);
      const waiter = {
        done:false,
        match:safeMatch,
        resolve:null,
        timer:null,
        promise:null
      };
      waiter.promise = new Promise(resolve=>{
        waiter.resolve = resolve;
      });
      serialAckWaiters.push(waiter);
      const waitMs = Math.max(120, Number(timeoutMs) || 800);
      waiter.timer = setTimeout(()=>{
        settleSerialAckWaiter(waiter, {
          ok:false,
          kind:"timeout",
          message:"SERIAL_TIMEOUT"
        });
      }, waitMs);
      return waiter;
    }

    function dispatchSerialAck(kind, message, rawLine){
      if(!serialAckWaiters.length) return;
      const waiters = serialAckWaiters.slice();
      for(const waiter of waiters){
        let matched = false;
        try{
          matched = !!waiter.match({
            kind,
            message:String(message || ""),
            raw:String(rawLine || "")
          });
        }catch(e){
          reportSilentException("serial-ack-match", e);
        }
        if(matched){
          settleSerialAckWaiter(waiter, {
            ok:(kind === "ack"),
            kind,
            message:String(message || ""),
            raw:String(rawLine || "")
          });
        }
      }
    }

    function handleSerialTextLine(line){
      const raw = String(line || "").trim();
      if(!raw) return;
      const upper = raw.toUpperCase();
      if(upper.startsWith("ACK ")){
        const msg = raw.slice(4).trim();
        const scale = parseLoadcellReplyValue(msg, "SCALE");
        if(scale != null){
          lastLoadcellScale = scale;
          updateLoadcellCalcPanel(lastLoadcellCalWeight);
        }
        const offset = parseLoadcellReplyValue(msg, "OFFSET");
        if(offset != null){
          lastLoadcellOffset = offset;
          updateLoadcellCalcPanel(lastLoadcellCalWeight);
        }
        const spiStatusInfo = parseSpiFlashStatusAckMessage(msg);
        if(spiStatusInfo){
          updateSpiFlashStatusUi(spiStatusInfo, null);
        }
        addLogLine("ACK " + msg, "SER");
        dispatchSerialAck("ack", msg, raw);
        return;
      }
      if(upper.startsWith("ERR ")){
        const msg = raw.slice(4).trim();
        addLogLine("ERR " + msg, "SER");
        dispatchSerialAck("err", msg, raw);
        return;
      }
      if(upper.startsWith("[SERVO]") || upper.startsWith("[BOOT]") || upper.startsWith("[WS]")){
        addLogLine(raw, "SER");
        return;
      }
      if(upper.indexOf("[SPI-STORAGE]") === 0){
        if(upper.indexOf("SD REMOVED") >= 0 || upper.indexOf("MOUNT FAILED") >= 0){
          spiFlashReadyState = false;
          updateMotorInfoPanel();
        }else if(upper.indexOf("SD READY") >= 0){
          spiFlashReadyState = true;
          updateMotorInfoPanel();
        }
        addLogLine(raw, "SER");
        return;
      }
      addLogLine(raw, "SER");
    }

    function isLikelyReadableSerialLine(line){
      const raw = String(line || "").trim();
      if(!raw) return false;
      if(!/^[\x09\x20-\x7E]+$/.test(raw)) return false;
      const upper = raw.toUpperCase();
      if(raw[0] === "[") return true;
      if(upper.startsWith("ACK ") || upper.startsWith("ERR ")) return true;
      if(upper.startsWith("=== ")) return true;
      if(upper.indexOf("BOOT") >= 0 || upper.indexOf("WIFI") >= 0) return true;
      return false;
    }

    async function setSerialStreamState(enabled){
      if(!serialConnected || !serialWriter) return false;
      const wrote = await serialWriteLine("/set?stream=" + (enabled ? "1" : "0"));
      if(!wrote){
        addLogLine("SER stream " + (enabled ? "ON" : "OFF") + " request failed", "SER");
      }
      return wrote;
    }

    async function serialProbeIncoming(timeoutMs){
      if(!serialReader){
        return { ok:false, reason:"NO_READER", sample:null, leftover:"" };
      }
      const decoder = new TextDecoder();
      let probeBuf = "";
      let sawReadableText = false;
      const endAt = Date.now() + Math.max(600, Number(timeoutMs) || SERIAL_PROBE_TIMEOUT_MS);
      while(Date.now() < endAt){
        const remain = Math.max(1, endAt - Date.now());
        const result = await Promise.race([
          serialReader.read(),
          new Promise(resolve=>setTimeout(()=>resolve({ __timeout:true }), remain))
        ]);
        if(result && result.__timeout){
          return { ok:sawReadableText, reason:(sawReadableText ? "TEXT" : "TIMEOUT"), sample:null, leftover:probeBuf };
        }
        const value = result ? result.value : null;
        const done = !!(result && result.done);
        if(done){
          return { ok:sawReadableText, reason:(sawReadableText ? "TEXT" : "DONE"), sample:null, leftover:probeBuf };
        }
        if(!value) continue;

        probeBuf += decoder.decode(value, { stream:true }).replace(/\r/g, "\n");
        let idx;
        while((idx = probeBuf.indexOf("\n")) >= 0){
          const line = probeBuf.slice(0, idx).trim();
          probeBuf = probeBuf.slice(idx + 1);
          if(!line) continue;
          if(line[0] === "{" && line[line.length - 1] === "}"){
            try{
              const sample = JSON.parse(line);
              return { ok:true, reason:"JSON", sample, leftover:probeBuf };
            }catch(e){}
          }
          if(isLikelyReadableSerialLine(line)){
            sawReadableText = true;
          }
        }
      }
      return { ok:sawReadableText, reason:(sawReadableText ? "TEXT" : "TIMEOUT"), sample:null, leftover:probeBuf };
    }

    async function serialConnect(){
      if(serialConnectBusy){
        addLogLine("WebSerial connect already in progress", "SER");
        return;
      }
      serialConnectBusy = true;
      if(!window.isSecureContext && !isLocalPreviewHost()){
        showToast(t("webserialInsecureToast"), "notice");
        addLogLine("WebSerial blocked: insecure context (" + location.origin + ")", "SER");
        serialConnectBusy = false;
        return;
      }
      if(!serialSupported()){
        showToast(t("webserialUnsupported"), "notice");
        serialConnectBusy = false;
        return;
      }
      try{
        await closeSerialHandles({ closePort:true });
        const selectedPort = await navigator.serial.requestPort({});
        if(!selectedPort){
          throw new Error("SERIAL_PORT_UNAVAILABLE");
        }
        serialPort = selectedPort;
        serialCurrentBaud = SERIAL_BAUD_RATE;
        serialParseErrorCount = 0;
        serialRxDisabledWarned = false;

        let probeSample = null;
        let selected = false;
        let lastProbeErr = null;
        const candidates = serialBaudCandidates();
        for(const baud of candidates){
          try{
            await selectedPort.open({ baudRate: baud });
            serialWriter = serialPort.writable?.getWriter?.() || null;
            serialReadAbort = new AbortController();
            serialReader = serialPort.readable?.getReader?.() || null;
            if(!serialReader){
              throw new Error("SERIAL_READER_UNAVAILABLE");
            }
            const probe = await serialProbeIncoming(SERIAL_PROBE_TIMEOUT_MS);
            serialLineBuf = String(probe.leftover || "");
            if(probe.ok){
              serialCurrentBaud = baud;
              probeSample = probe.sample || null;
              selected = true;
              break;
            }
            await closeSerialHandles({ closePort:true });
          }catch(err){
            lastProbeErr = err;
            await closeSerialHandles({ closePort:true });
          }
        }

        if(!selected){
          await selectedPort.open({ baudRate: SERIAL_BAUD_RATE });
          serialWriter = serialPort.writable?.getWriter?.() || null;
          serialReadAbort = new AbortController();
          serialReader = serialPort.readable?.getReader?.() || null;
          serialCurrentBaud = SERIAL_BAUD_RATE;
          addLogLine("SER probe timeout, fallback baud " + serialCurrentBaud + "bps", "SER");
          if(lastProbeErr){
            reportSilentException("serial-probe", lastProbeErr);
          }
        }

        serialConnected = true;
        updateSerialPill();
        hideDisconnectOverlay();

        addLogLine(t("webserialConnected") + " @" + serialCurrentBaud + "bps", "SER");
        showToast(t("webserialConnectedToast"), "success");
        await setSerialStreamState(true);
        if(probeSample){
          onIncomingSample(probeSample, "SER");
        }
        syncOperationModeToBoard(false);
        syncDaqSequencePyroChannelToBoard(false);

        if(serialReader){
          readSerialLoop().catch(err=>{
            addLogLine(t("serialReadEnded", {err:(err?.message||err)}), "SER");
          });
        }
      }catch(e){
        await closeSerialHandles({ closePort:true });
        serialPort = null;
        serialConnected = false;
        updateSerialPill();
        addLogLine(t("webserialConnectFailed", {err:(e?.message||e)}), "SER");
        showToast(t("webserialConnectFailedToast"), "error");
      }finally{
        serialConnectBusy = false;
      }
    }

    async function serialDisconnect(){
      try{
        if(serialConnected && serialWriter){
          await setSerialStreamState(false);
        }
        await closeSerialHandles({ closePort:true });
        serialPort = null;
      }finally{
        flushSerialAckWaiters("SERIAL_DISCONNECTED");
        serialConnected = false;
        serialParseErrorCount = 0;
        serialRxDisabledWarned = false;
        updateSerialPill();
        addLogLine(t("webserialDisconnected"), "SER");
        if(serialEnabled) showDisconnectOverlay();
      }
    }

    async function serialWriteLine(line){
      if(!serialConnected || !serialWriter) return false;
      try{
        const outLine = String(line || "").trim();
        const data = new TextEncoder().encode(outLine.endsWith("\n") ? outLine : (outLine + "\n"));
        await serialWriter.write(data);
        if(outLine) addLogLine("TX " + outLine, "SER");
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

          const chunk = decoder.decode(value, { stream:true }).replace(/\r/g, "\n");
          serialLineBuf += chunk;

          let idx;
          while((idx = serialLineBuf.indexOf("\n")) >= 0){
            const line = serialLineBuf.slice(0, idx).trim();
            serialLineBuf = serialLineBuf.slice(idx+1);
            if(!line) continue;
            if(line[0] === "{" && line[line.length-1] === "}"){
              if(!serialRxEnabled){
                if(!serialRxDisabledWarned){
                  serialRxDisabledWarned = true;
                  addLogLine("SER JSON received but RX parsing is OFF", "SER");
                }
                continue;
              }
              try{
                const obj = JSON.parse(line);
                serialParseErrorCount = 0;
                serialRxDisabledWarned = false;
                onIncomingSample(obj, "SER");
              }catch(e){
                serialParseErrorCount += 1;
                if(serialParseErrorCount <= SERIAL_PARSE_ERROR_LOG_LIMIT){
                  addLogLine("SER JSON parse failed #" + serialParseErrorCount + " @" + serialCurrentBaud + "bps", "SER");
                }
                reportSilentException("serial-json", e);
              }
              continue;
            }
            handleSerialTextLine(line);
          }
        }
      } finally{
        flushSerialAckWaiters("SERIAL_DISCONNECTED");
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
      if(
        rebootConfirmWaiting &&
        !isReplaySample &&
        rebootConfirmStartedMs > 0 &&
        (nowOk - rebootConfirmStartedMs) >= REBOOT_WAIT_MIN_VISIBLE_MS
      ){
        hideRebootConfirm();
      }

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
      const elapsedMs = Math.max(0, timeMs - firstSampleMs);

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
      lastLoadcellRawValid = lcRawOk && isFinite(lcRawNum);
      lastLoadcellRaw = lastLoadcellRawValid ? lcRawNum : null;
      lastLoadcellReadyFlag = (lcReadyRaw != null && isFinite(lcReadyRaw)) ? (lcReadyRaw !== 0 ? 1 : 0) : null;
      lastLoadcellSaturated = !!(lcSatRaw != null && isFinite(lcSatRaw) && lcSatRaw !== 0);
      lastLoadcellOffsetValid = (lcOffsetOkRaw != null && isFinite(lcOffsetOkRaw)) ? (lcOffsetOkRaw !== 0 ? 1 : 0) : null;
      lastLoadcellNoiseDeadband = (lcNoiseRaw != null && isFinite(lcNoiseRaw)) ? lcNoiseRaw : lastLoadcellNoiseDeadband;
      lastLoadcellHz = isFinite(hxHz) ? hxHz : 0;
      if(isFinite(hxHz) && hxHz > 0){
        lastLoadcellHzDisplay = hxHz;
        lastLoadcellHzDisplayMs = timeMs;
      }
      const hzDisplayHoldAlive =
        (!isReplaySample) &&
        ((timeMs - lastLoadcellHzDisplayMs) <= LOADCELL_HZ_DISPLAY_HOLD_MS) &&
        (lcRawOk || lastLoadcellRawValid) &&
        isFinite(lastLoadcellHzDisplay) &&
        lastLoadcellHzDisplay > 0;
      const hxHzDisplay = (isFinite(hxHz) && hxHz > 0) ? hxHz : (hzDisplayHoldAlive ? lastLoadcellHzDisplay : 0);
      const hasHxHz = (data.hz != null || data.hx_hz != null);
      const loadcellRateLowNow = !isReplaySample && hasHxHz && elapsedMs >= LOADCELL_HZ_FAULT_GRACE_MS && isFinite(hxHz) && hxHz <= LOADCELL_HZ_FAULT_MIN;
      if(loadcellRateLowNow){
        if(loadcellRateLowSinceMs === 0) loadcellRateLowSinceMs = timeMs;
      }else{
        loadcellRateLowSinceMs = 0;
      }
      const loadcellRateFault = loadcellRateLowSinceMs !== 0 && (timeMs - loadcellRateLowSinceMs) >= LOADCELL_HZ_FAULT_HOLD_MS;
      const loadcellOffsetFault = !isReplaySample && elapsedMs >= LOADCELL_HZ_FAULT_GRACE_MS && lastLoadcellOffsetValid === 0;
      const loadcellHardFault = !thrustHasData || !isFinite(thrustVal) || lastLoadcellSaturated || loadcellOffsetFault;
      const loadcellStreamFault = loadcellRateFault && !lastLoadcellRawValid;
      loadcellErrorActive = (simEnabled && devLoadcellError) || loadcellHardFault || loadcellStreamFault;
      if(loadcellErrorActive){
        if(loadcellErrorSinceMs === 0) loadcellErrorSinceMs = timeMs;
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
        loadcellErrorActive &&
        loadcellErrorSinceMs !== 0 &&
        (timeMs - loadcellErrorSinceMs) >= LOADCELL_ERROR_TOAST_HOLD_MS &&
        (timeMs - lastLoadcellErrorToastMs) >= LOADCELL_ERROR_TOAST_DEBOUNCE_MS
      ){
        showToast(t("loadcellErrorToast"), "error", {key:"loadcell-error", duration:6000});
        lastLoadcellErrorToastMs = timeMs;
      }
      const thrustMissing = loadcellErrorActive;
      updateLoadcellLiveValue(loadcellErrorActive ? null : thrustVal);
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
      const lt  = Number(data.lt != null ? data.lt : (data.loop ?? data.loopTime ?? 0));
      const ctUs = Number(data.ct != null ? data.ct : (data.cpu_us ?? data.cpu ?? 0));

      const swRaw  = (data.s  != null ? data.s  : data.sw  ?? 0);
      const icRaw  = (data.ic != null ? data.ic : data.ign ?? 0);
      const rlyRaw = (data.r  != null ? data.r  : data.rly ?? 0);
      const sw = Number(swRaw);
      const ic = Number(icRaw);
      const rly = Number(rlyRaw);
      const swOn = !!(Number.isFinite(sw) && sw !== 0);
      const icOn = !!(Number.isFinite(ic) && ic !== 0);
      const relayMask = Number.isFinite(rly) ? Math.max(0, Math.trunc(rly)) : 0;
      const st  = Number(data.st != null ? data.st : (data.state ?? 0));
      const td  = (data.td != null ? Number(data.td) : null);
      const uw  = Number(data.uw ?? 0);
      const ab  = Number(data.ab != null ? data.ab : 0);
      const ar  = (data.ar != null ? Number(data.ar) : null);
      const gs  = Number(data.gs != null ? data.gs : data.igs ?? 0);
      const smRaw = (data.sm != null ? data.sm : (data.safe != null ? data.safe : null));
      const sm = (smRaw != null) ? Number(smRaw) : null;
      const alRaw = (data.al != null ? data.al : (data.arm_lock != null ? data.arm_lock : null));
      const al = (alRaw != null) ? Number(alRaw) : null;
      const srRaw = (data.sr != null) ? data.sr : (data.storage_ready != null ? data.storage_ready : null);
      const sr = (srRaw != null) ? Number(srRaw) : null;
      const mode = Number(data.m != null ? data.m : data.mode ?? -1);
      const wsQueueDropCount = Number(data.wq != null ? data.wq : (data.ws_queue_drop ?? 0));

      if(sr != null && Number.isFinite(sr)){
        spiFlashReadyState = (sr !== 0);
      }

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
      updateParachuteDeployState(st, relayMask, !!ab, timeMs);
      latestTelemetry = {
        sw: swOn ? 1 : 0,
        ic: icOn ? 1 : 0,
        rly: relayMask,
        mode,
        gs,
        uw: uw?1:0,
        sm: (sm != null) ? (sm ? 1 : 0) : (safetyModeEnabled ? 1 : 0),
        al: (al != null) ? (al ? 1 : 0) : null,
        lc_raw: lastLoadcellRaw,
        lc_raw_ok: lastLoadcellRawValid ? 1 : 0,
        lc_ready: lastLoadcellReadyFlag,
        lc_sat: lastLoadcellSaturated ? 1 : 0,
        lc_offset_ok: lastLoadcellOffsetValid
      };
      const telemetryGeo = extractTelemetryGeo(data, {koreaOnly:false}) ||
        ((simEnabled && !replaySourceActive && simState && simState.lastGeo) ? simState.lastGeo : null);
      updateStatusMapFromTelemetry(data);
      if(!(ga !== 0 && applyFirmwareGyroAttitudeEstimate(gr, gp, gyw, timeMs))){
        updateGyroAttitudeEstimate(ax, ay, az, gx, gy, gz, timeMs);
      }
      updateGyroPathFromTelemetry(data, timeMs, {ax, ay, az, st});
      const quickFlight = getQuickFlightMetrics(data, timeMs);
      const quickAltitudeM = isFinite(quickFlight.altitudeM)
        ? ((Math.abs(quickFlight.altitudeM) < 0.05) ? 0 : quickFlight.altitudeM)
        : NaN;
      const quickSpeedMps = isFinite(quickFlight.speedMps) ? Math.max(0, quickFlight.speedMps) : NaN;
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
      quickAltitudeHistory.push(isFinite(quickAltitudeM) ? quickAltitudeM : 0);
      const gyroSpeedDps = Math.sqrt((gx * gx) + (gy * gy) + (gz * gz));
      gyroSpeedHistory.push(isFinite(gyroSpeedDps) ? gyroSpeedDps : 0);
      const accelMagVal = Math.sqrt((ax * ax) + (ay * ay) + (az * az));
      accelMagHistory.push(accelMagVal);
      accelXHistory.push(ax);
      accelYHistory.push(ay);
      accelZHistory.push(az);
      gyroXHistory.push(gx);
      gyroYHistory.push(gy);
      gyroZHistory.push(gz);
      chartTimeHistory.push(timeMs);

      const maxKeep=MAX_POINTS*4;
      if(thrustBaseHistory.length>maxKeep){
        const remove=thrustBaseHistory.length-maxKeep;
        thrustBaseHistory.splice(0,remove);
        pressureBaseHistory.splice(0,remove);
        quickAltitudeHistory.splice(0,remove);
        gyroSpeedHistory.splice(0,remove);
        accelMagHistory.splice(0,remove);
        accelXHistory.splice(0,remove);
        accelYHistory.splice(0,remove);
        accelZHistory.splice(0,remove);
        gyroXHistory.splice(0,remove);
        gyroYHistory.splice(0,remove);
        gyroZHistory.splice(0,remove);
        chartTimeHistory.splice(0,remove);
      }

      sampleHistory.push({timeMs,timeIso,t:thrustVal,p,lt,elapsed:elapsedMs,hz:hxHz,ct:ctUs,sw:swOn?1:0,ic:icOn?1:0,r:relayMask,st,td});
      if(sampleHistory.length>SAMPLE_HISTORY_MAX){
        const remove=sampleHistory.length-SAMPLE_HISTORY_MAX;
        sampleHistory.splice(0,remove);
      }

      logData.push({
        time:timeIso,t:thrustVal,p,alt_m:quickAltitudeM,speed_mps:quickSpeedMps,
        gps_lat:(telemetryGeo && isFinite(Number(telemetryGeo.lat))) ? Number(telemetryGeo.lat) : null,
        gps_lon:(telemetryGeo && isFinite(Number(telemetryGeo.lon))) ? Number(telemetryGeo.lon) : null,
        gps_alt:(telemetryGeo && isFinite(Number(telemetryGeo.alt))) ? Number(telemetryGeo.alt) : null,
        ax,ay,az,gx,gy,gz,lt,elapsed:elapsedMs,hz:hxHz,ct:ctUs,s:swOn?1:0,ic:icOn?1:0,r:relayMask,gs,st,td
      });
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

      // UI 업데이트(시뮬레이션 모드에서는 더 부드럽게 갱신)
      const shouldRefreshUi = simEnabled || (sampleCounter % UI_SAMPLE_SKIP === 0);
      if(shouldRefreshUi){
        updateConnectionUI(true);
        disconnectedLogged=false;

        if(prevSwState===null) prevSwState=swOn;
        else if(prevSwState!==swOn){
          prevSwState=swOn;
          if(prevSwState){
            addLogLine(t("switchHighLog"), "SW");
            if((uiSettings && uiSettings.igs) && !icOn){
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
        const inFlightMode = isFlightModeUi();
        updateQuickMetricLabels();
        updateQuickAuxLabels();
        if(inFlightMode){
          const altVal = quickAltitudeM;
          const speedVal = quickSpeedMps;
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
            el.pressure.innerHTML = isFinite(speedVal)
              ? `<span class="num">${speedVal.toFixed(1)}</span><span class="unit">m/s</span>`
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
          const gyroUiIntervalMs = simEnabled ? 40 : 80;
          if(gyroLastUiMs === 0 || (nowUi - gyroLastUiMs) >= gyroUiIntervalMs){
            const displayRollDeg = getGyroDisplayRollDeg();
            const displayPitchDeg = getGyroDisplayPitchDeg();
            const displayYawDeg = getGyroDisplayYawDeg();
            renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
            renderNavBall(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
            renderGyroPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
            renderNavBallPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
            updateLauncherPitchAngle(displayPitchDeg, gy, nowUi);
            if(el.gyroRollDeg) el.gyroRollDeg.innerHTML = `<span class="num">${displayRollDeg.toFixed(1)}</span><span class="unit">deg</span>`;
            if(el.gyroPitchDeg) el.gyroPitchDeg.innerHTML = `<span class="num">${displayPitchDeg.toFixed(1)}</span><span class="unit">deg</span>`;
            if(el.gyroYawDeg) el.gyroYawDeg.innerHTML = `<span class="num">${displayYawDeg.toFixed(1)}</span><span class="unit">deg</span>`;
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
          const pressurePct = Math.min(100, (PRESSURE_GAUGE_MAX_MPA > 0 ? (pressureVal / PRESSURE_GAUGE_MAX_MPA) * 100 : 0));
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
        if(el.hxHz) el.hxHz.textContent = (hxHzDisplay>0 && isFinite(hxHzDisplay)) ? (hxHzDisplay.toFixed(0) + " Hz") : "-- Hz";
        if(el.quickHxHz){
          if(inFlightMode){
            el.quickHxHz.innerHTML = `<span class="num">null</span>`;
            setQuickItemStatus(el.quickHxHz, null);
          }else{
            const hxNum = (hxHzDisplay>0 && isFinite(hxHzDisplay)) ? hxHzDisplay.toFixed(0) : "--";
            el.quickHxHz.innerHTML = `<span class="num">${hxNum}</span><span class="unit">Hz</span>`;
            setQuickItemStatus(el.quickHxHz, null);
          }
        }
        if(el.quickNullValue){
          if(inFlightMode){
            const displayYawDeg = getGyroDisplayYawDeg();
            el.quickNullValue.innerHTML = formatQuickGyroDeg(displayYawDeg);
            setQuickItemStatus(el.quickNullValue, null);
          }else{
            const sdText = (spiFlashReadyState == null) ? "--" : (spiFlashReadyState ? "READY" : "NOT READY");
            el.quickNullValue.innerHTML = `<span class="num">${sdText}</span>`;
            setQuickItemStatus(el.quickNullValue, (spiFlashReadyState == null) ? null : (spiFlashReadyState ? "ok" : "warn"));
          }
        }
        if(el.quickNull2Value){
          el.quickNull2Value.innerHTML = `<span class="num">null</span>`;
          setQuickItemStatus(el.quickNull2Value, null);
        }
        if(el.quickNull3Value){
          el.quickNull3Value.innerHTML = `<span class="num">null</span>`;
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
          const swLabel = (sw == null || !Number.isFinite(sw)) ? "--" : (swOn ? "ON" : "OFF");
          el.quickSw.innerHTML = `<span class="num">${swLabel}</span>`;
          setQuickItemStatus(el.quickSw, (sw == null || !Number.isFinite(sw)) ? null : (swOn ? "ok" : "warn"));
        }

        if(el.ic){
          if(icOn){ el.ic.textContent = t("icOk"); el.ic.className="pill pill-green"; }
          else { el.ic.textContent = t("icNo"); el.ic.className="pill pill-red"; }
        }
        if(el.relay){
          if(relayMask){ el.relay.textContent = t("relayOn"); el.relay.className="pill pill-green"; }
          else { el.relay.textContent = t("relayOff"); el.relay.className="pill pill-gray"; }
        }
        if(el.quickRelay1 || el.quickRelay2){
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
            el.quickRelay1.innerHTML = `<span class="num">${pyroLabel}</span>`;
            setQuickItemStatus(el.quickRelay1, pyroStatus);
          }
          if(el.quickRelay2){
            if(inFlightMode){
              const displayRollDeg = getGyroDisplayRollDeg();
              el.quickRelay2.innerHTML = formatQuickGyroDeg(displayRollDeg);
              setQuickItemStatus(el.quickRelay2, null);
            }else{
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
        }
        updateGyroMetaFromMain();
        const parachuteStatusActive = isParachuteDeployStatusActive(st, !!ab);
        if(el.quickState){
          let stateLabel="--";
          let stateStatus=null;
          let isNotArmed=false;
          if(lockoutLatched) stateLabel = t("statusLockout");
          else if(ab) stateLabel = t("statusAbort");
          else if(st===2) stateLabel = t("statusIgnition");
          else if(st===1) stateLabel = t("statusCountdown");
          else if(parachuteStatusActive) stateLabel = t("statusParachute");
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
          else if(parachuteStatusActive) stateStatus = "ok";
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
        if(el.armLockToggle && al != null){
          el.armLockToggle.checked = !!al;
          updateTogglePill(el.armLockPill, el.armLockToggle.checked);
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
        const statusCode=setStatusFromState(st,!!ic,!!ab,lockoutLatched, sequenceActive, parachuteStatusActive);
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
        const API_BASE = getApiBaseForCommands();
        const url = (API_BASE ? API_BASE : "") + "/wifi_info";
        const info = await fetchJsonTimeout(url, 700);
        wifiInfo = info;
        wifiInfoLastMs = Date.now();
        updateWifiInfoUI(info);
      }catch(e){
        if(!wifiInfo || (Date.now() - wifiInfoLastMs) > 5000){
          updateWifiInfoUI(null);
        }
      }
    }

    function formatDurationHms(totalSec){
      const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if(h > 0) return h + "h " + m + "m " + s + "s";
      if(m > 0) return m + "m " + s + "s";
      return s + "s";
    }

    function estimateSpiFlashRemainingSec(info){
      const usedBytes = Number(info && info.used_bytes || 0);
      const capBytes = Number(info && info.capacity_bytes || 0);
      const queuedBytes = Number(info && info.queue_bytes || 0);
      const recordCount = Number(info && info.record_count || 0);

      const remainingBytes = Math.max(0, capBytes - usedBytes - queuedBytes);
      const fallbackBytesPerRecord = 86; // header(16) + sample payload(70)
      const bytesPerRecord = (recordCount > 0 && usedBytes > 0)
        ? Math.max(1, usedBytes / recordCount)
        : fallbackBytesPerRecord;

      let samplePeriodMs = 10; // firmware SAMPLE_PERIOD_MS fallback
      if(Array.isArray(sampleHistory) && sampleHistory.length){
        const tail = sampleHistory[sampleHistory.length - 1];
        const lt = Number(tail && tail.lt);
        if(isFinite(lt) && lt > 0) samplePeriodMs = lt;
      }
      const remainRecords = remainingBytes / bytesPerRecord;
      const remainSec = remainRecords * (samplePeriodMs / 1000.0);
      return Math.max(0, Math.floor(remainSec));
    }

    function updateSpiFlashStatusUi(info, errMsg){
      if(!el.spiFlashStatusLine) return;
      if(errMsg){
        spiFlashReadyState = null;
        el.spiFlashStatusLine.textContent = "SD CARD 상태 확인 실패: " + String(errMsg);
        return;
      }
      if(!info || !info.ready){
        spiFlashReadyState = false;
        el.spiFlashStatusLine.textContent = "SD CARD NOT READY";
        return;
      }
      spiFlashReadyState = true;
      const usedBytes = Number(info.used_bytes || 0);
      const capBytes = Number(info.capacity_bytes || 0);
      const queuedBytes = Number(info.queue_bytes || 0);
      const recordCount = Number(info.record_count || 0);
      const usedMb = (usedBytes / (1024 * 1024)).toFixed(2);
      const capMb = (capBytes / (1024 * 1024)).toFixed(2);
      const mfrHex = Number(info.jedec && info.jedec.mfr || 0).toString(16).toUpperCase().padStart(2, "0");
      const capCodeHex = Number(info.jedec && info.jedec.cap_code || 0).toString(16).toUpperCase().padStart(2, "0");
      const remainSec = estimateSpiFlashRemainingSec(info);
      const remainHms = formatDurationHms(remainSec);
      el.spiFlashStatusLine.textContent =
        "SD CARD READY · " + usedMb + "MB / " + capMb + "MB · records " + recordCount +
        " · queue " + queuedBytes + "B · 남은 약 " + remainSec + "초 (" + remainHms + ")" +
        " · JEDEC " + mfrHex + ".." + capCodeHex;
    }

    function canUseSerialForSpiFlash(){
      return !!(serialEnabled && serialConnected && serialTxEnabled);
    }

    function localSdSupported(){
      return !!(
        typeof window !== "undefined" &&
        window.isSecureContext &&
        typeof window.showDirectoryPicker === "function"
      );
    }

    function ensureLocalSdToolsCss(){
      if(document.getElementById("localSdToolsStyle")) return;
      const style = document.createElement("style");
      style.id = "localSdToolsStyle";
      style.textContent = [
        ".local-sd-tools{margin-top:10px;padding:10px 12px;border:1px solid rgba(148,163,184,.32);border-radius:12px;background:rgba(148,163,184,.06)}",
        ".local-sd-tools-title{font-size:12px;letter-spacing:.08em;font-weight:700;color:#64748b;margin-bottom:6px}",
        ".local-sd-tools-actions{display:flex;flex-wrap:wrap;gap:6px}",
        ".local-sd-btn{border:1px solid rgba(100,116,139,.35);background:#fff;border-radius:9px;padding:7px 10px;font-size:12px;font-weight:600;color:#334155;cursor:pointer}",
        ".local-sd-btn:disabled{opacity:.45;cursor:not-allowed}",
        ".local-sd-status{margin-top:7px;font-size:12px;line-height:1.35;color:#475569;word-break:break-word}",
        ".local-sd-status[data-tone=\"ok\"]{color:#166534}",
        ".local-sd-status[data-tone=\"warn\"]{color:#92400e}",
        ".local-sd-status[data-tone=\"error\"]{color:#b91c1c}",
        ".local-sd-note{margin-top:4px;font-size:11px;color:#94a3b8}",
        ".local-sd-input{display:none}"
      ].join("");
      document.head.appendChild(style);
    }

    function setLocalSdStatus(text, tone){
      if(!el.localSdStatusLine) return;
      el.localSdStatusLine.textContent = String(text || "");
      if(tone){
        el.localSdStatusLine.setAttribute("data-tone", String(tone));
      }else{
        el.localSdStatusLine.removeAttribute("data-tone");
      }
    }

    function refreshLocalSdControls(){
      const supported = localSdSupported();
      const hasDir = !!localSdDirHandle;
      if(el.localSdPickBtn) el.localSdPickBtn.disabled = localSdBusy || !supported;
      if(el.localSdUploadBtn) el.localSdUploadBtn.disabled = localSdBusy || !supported || !hasDir;
      if(el.localSdUploadFolderBtn) el.localSdUploadFolderBtn.disabled = localSdBusy || !supported || !hasDir;
      if(el.localSdDeployBtn) el.localSdDeployBtn.disabled = localSdBusy || !supported || !hasDir;
      if(el.localSdFormatBtn) el.localSdFormatBtn.disabled = localSdBusy || !supported || !hasDir;
      if(el.localSdNote){
        el.localSdNote.textContent = supported
          ? "PC Chrome/Edge(HTTPS)에서 동작합니다. iPhone Safari는 제한될 수 있습니다."
          : "이 브라우저는 SD 폴더 직접 쓰기를 지원하지 않습니다. (Chrome/Edge 권장)";
      }
    }

    function setLocalSdBusy(next){
      localSdBusy = !!next;
      refreshLocalSdControls();
    }

    function pickVisibleNode(nodes){
      const list = Array.from(nodes || []).filter(Boolean);
      if(!list.length) return null;
      for(let i = 0; i < list.length; i++){
        const node = list[i];
        if(node.offsetParent || node.getClientRects().length){
          return node;
        }
      }
      return list[0] || null;
    }

    function findVisibleById(id){
      if(!id) return null;
      return pickVisibleNode(document.querySelectorAll("#" + id));
    }

    function normalizeLocalSdTargetPath(path){
      const normalized = replayNormalizeZipPath(String(path || "").replace(/^\/+/, ""));
      return normalized || "";
    }

    function githubPagesRepoPrefix(){
      const host = String(location && location.hostname || "").toLowerCase();
      if(host.indexOf(".github.io") < 0) return "";
      const parts = String(location && location.pathname || "").split("/").filter(Boolean);
      if(!parts.length) return "";
      if(parts[0].indexOf(".") >= 0) return "";
      return parts[0] + "/";
    }

    function mapUrlPathToLocalSdTarget(pathname){
      const rawPath = String(pathname || "");
      const endedWithSlash = /\/$/.test(rawPath);
      let path = normalizeLocalSdTargetPath(rawPath);
      if(!path) return "index.html";
      const repoPrefix = githubPagesRepoPrefix();
      if(repoPrefix){
        const repoNameOnly = repoPrefix.slice(0, -1);
        if(path === repoNameOnly){
          path = "";
        }else if(path.indexOf(repoPrefix) === 0){
          path = path.slice(repoPrefix.length);
        }
      }
      if(!path) return "index.html";
      if(endedWithSlash) return path + "/index.html";
      return path;
    }

    async function localSdEnsureReadWritePermission(handle){
      if(!handle) return false;
      let usedPermissionApi = false;
      try{
        if(typeof handle.queryPermission === "function"){
          usedPermissionApi = true;
          const state = await handle.queryPermission({mode:"readwrite"});
          if(state === "granted") return true;
        }
      }catch(_e){}
      try{
        if(typeof handle.requestPermission === "function"){
          usedPermissionApi = true;
          const state = await handle.requestPermission({mode:"readwrite"});
          return state === "granted";
        }
      }catch(_e){}
      return !usedPermissionApi;
    }

    async function localSdResolveDir(rootHandle, relDirPath){
      let dirHandle = rootHandle;
      const dir = normalizeLocalSdTargetPath(relDirPath);
      if(!dir) return dirHandle;
      const segments = dir.split("/");
      for(let i = 0; i < segments.length; i++){
        const seg = String(segments[i] || "").trim();
        if(!seg) continue;
        dirHandle = await dirHandle.getDirectoryHandle(seg, {create:true});
      }
      return dirHandle;
    }

    async function localSdWriteBytes(rootHandle, relPath, bytes){
      const path = normalizeLocalSdTargetPath(relPath);
      if(!path) return false;
      const parts = path.split("/");
      const fileName = parts.pop();
      if(!fileName) return false;
      const dirPath = parts.join("/");
      const dirHandle = await localSdResolveDir(rootHandle, dirPath);
      const fileHandle = await dirHandle.getFileHandle(fileName, {create:true});
      const writable = await fileHandle.createWritable();
      try{
        await writable.write(bytes);
      }finally{
        await writable.close();
      }
      return true;
    }

    async function pickLocalSdDirectory(){
      if(!localSdSupported()){
        setLocalSdStatus("브라우저 미지원: Chrome/Edge(HTTPS)에서 실행해 주세요.", "error");
        showToast("이 브라우저는 로컬 SD 폴더 쓰기를 지원하지 않습니다.", "notice", {key:"local-sd-unsupported"});
        return;
      }
      try{
        setLocalSdBusy(true);
        setLocalSdStatus("SD 폴더 선택 중...", null);
        const handle = await window.showDirectoryPicker({mode:"readwrite"});
        const granted = await localSdEnsureReadWritePermission(handle);
        if(!granted){
          setLocalSdStatus("쓰기 권한이 거부되었습니다.", "error");
          showToast("SD 폴더 쓰기 권한이 필요합니다.", "warn", {key:"local-sd-perm-denied"});
          return;
        }
        localSdDirHandle = handle;
        localSdDirLabel = String(handle.name || "SD");
        setLocalSdStatus("선택됨: " + localSdDirLabel, "ok");
        showToast("SD 폴더 선택 완료: " + localSdDirLabel, "success", {key:"local-sd-picked"});
      }catch(err){
        if(err && err.name === "AbortError"){
          setLocalSdStatus("SD 폴더 선택이 취소되었습니다.", "warn");
          return;
        }
        const reason = (err && err.message) ? err.message : String(err || "unknown");
        setLocalSdStatus("SD 폴더 선택 실패: " + reason, "error");
        showToast("SD 폴더 선택 실패: " + reason, "error", {key:"local-sd-pick-fail"});
      }finally{
        setLocalSdBusy(false);
      }
    }

    async function writeLocalSdFiles(fileList){
      if(!localSdDirHandle){
        showToast("먼저 SD 폴더를 선택하세요.", "notice", {key:"local-sd-no-dir"});
        setLocalSdStatus("SD 폴더가 아직 선택되지 않았습니다.", "warn");
        return;
      }
      const granted = await localSdEnsureReadWritePermission(localSdDirHandle);
      if(!granted){
        showToast("SD 폴더 쓰기 권한이 없습니다.", "warn", {key:"local-sd-perm-no"});
        setLocalSdStatus("쓰기 권한이 없어 업로드를 중단했습니다.", "error");
        return;
      }

      const files = Array.from(fileList || []).filter(Boolean);
      if(!files.length){
        showToast("업로드할 파일을 선택해 주세요.", "notice", {key:"local-sd-no-files"});
        return;
      }

      setLocalSdBusy(true);
      let writtenCount = 0;
      let writtenBytes = 0;
      try{
        for(let i = 0; i < files.length; i++){
          const file = files[i];
          const fileName = String(file && file.name || "").trim();
          if(!fileName) continue;
          setLocalSdStatus(
            "SD 업로드 중... " + (i + 1) + "/" + files.length + " · " + fileName,
            null
          );

          const lowerName = fileName.toLowerCase();
          if(lowerName.endsWith(".zip")){
            const entries = await replayUnzipEntries(await file.arrayBuffer());
            for(const [entryPath, entryBytes] of entries.entries()){
              const rel = normalizeLocalSdTargetPath(entryPath);
              if(!rel || rel[rel.length - 1] === "/") continue;
              if(rel.indexOf("__macosx/") === 0) continue;
              await localSdWriteBytes(localSdDirHandle, rel, entryBytes);
              writtenCount++;
              writtenBytes += Number(entryBytes && entryBytes.byteLength || entryBytes && entryBytes.length || 0);
            }
            continue;
          }

          const relPathRaw = String(file.webkitRelativePath || fileName || "");
          const relPath = normalizeLocalSdTargetPath(relPathRaw);
          if(!relPath) continue;
          const bytes = new Uint8Array(await file.arrayBuffer());
          await localSdWriteBytes(localSdDirHandle, relPath, bytes);
          writtenCount++;
          writtenBytes += bytes.byteLength;
        }
        const kb = (writtenBytes / 1024).toFixed(1);
        setLocalSdStatus("업로드 완료: " + writtenCount + "개 파일 · " + kb + "KB", "ok");
        showToast("SD 업로드 완료: " + writtenCount + "개 파일", "success", {key:"local-sd-upload-ok"});
      }catch(err){
        const reason = (err && err.message) ? err.message : String(err || "unknown");
        setLocalSdStatus("업로드 실패: " + reason, "error");
        showToast("SD 업로드 실패: " + reason, "error", {key:"local-sd-upload-fail"});
      }finally{
        setLocalSdBusy(false);
      }
    }

    function collectLocalSdAutoDeployAssets(){
      const targets = new Map();
      const addAsset = (rawUrl)=>{
        if(!rawUrl) return;
        let url;
        try{
          url = new URL(rawUrl, location.href);
        }catch(_e){
          return;
        }
        if(url.origin !== location.origin) return;
        const target = mapUrlPathToLocalSdTarget(url.pathname || "/");
        if(!target) return;
        if(!targets.has(target)){
          targets.set(target, url.toString());
        }
      };

      addAsset(location.href);
      const selector = "script[src],link[href],img[src],source[src],audio[src],video[src]";
      document.querySelectorAll(selector).forEach(node=>{
        if(node.hasAttribute("src")) addAsset(node.getAttribute("src"));
        if(node.hasAttribute("href")) addAsset(node.getAttribute("href"));
      });

      ["flash6.html","index.html","flash6.js","dashboard.js","manifest.webmanifest","sw.js","favicon.ico"].forEach(path=>{
        addAsset(path);
      });

      return Array.from(targets.entries()).map(([target, url])=>({target, url}));
    }

    async function deployCurrentWebAssetsToLocalSd(){
      if(!localSdDirHandle){
        showToast("먼저 SD 폴더를 선택하세요.", "notice", {key:"local-sd-no-dir"});
        setLocalSdStatus("SD 폴더가 아직 선택되지 않았습니다.", "warn");
        return;
      }
      const granted = await localSdEnsureReadWritePermission(localSdDirHandle);
      if(!granted){
        showToast("SD 폴더 쓰기 권한이 없습니다.", "warn", {key:"local-sd-perm-no"});
        setLocalSdStatus("쓰기 권한이 없어 자동 배포를 중단했습니다.", "error");
        return;
      }

      const assets = collectLocalSdAutoDeployAssets();
      if(!assets.length){
        setLocalSdStatus("자동 배포할 웹 파일을 찾지 못했습니다.", "warn");
        showToast("자동 배포할 파일 목록이 비어 있습니다.", "notice", {key:"local-sd-deploy-empty"});
        return;
      }

      setLocalSdBusy(true);
      let okCount = 0;
      let failCount = 0;
      let totalBytes = 0;
      try{
        for(let i = 0; i < assets.length; i++){
          const item = assets[i];
          setLocalSdStatus(
            "자동 배포 중... " + (i + 1) + "/" + assets.length + " · " + item.target,
            null
          );
          try{
            const resp = await fetch(item.url, {cache:"no-store"});
            if(!resp.ok){
              throw new Error("HTTP " + resp.status);
            }
            const bytes = new Uint8Array(await resp.arrayBuffer());
            await localSdWriteBytes(localSdDirHandle, item.target, bytes);
            okCount++;
            totalBytes += bytes.byteLength;
          }catch(_assetErr){
            failCount++;
          }
        }

        const kb = (totalBytes / 1024).toFixed(1);
        if(okCount > 0 && failCount === 0){
          setLocalSdStatus("자동 배포 완료: " + okCount + "개 파일 · " + kb + "KB", "ok");
          showToast("SD 자동 배포 완료: " + okCount + "개 파일", "success", {key:"local-sd-deploy-ok"});
        }else if(okCount > 0){
          setLocalSdStatus("자동 배포 부분 완료: 성공 " + okCount + " / 실패 " + failCount, "warn");
          showToast("자동 배포 부분 완료: 성공 " + okCount + " / 실패 " + failCount, "warn", {key:"local-sd-deploy-partial"});
        }else{
          setLocalSdStatus("자동 배포 실패: 다운로드 가능한 파일이 없습니다.", "error");
          showToast("자동 배포 실패: 같은 도메인 웹파일 확인 필요", "error", {key:"local-sd-deploy-fail"});
        }
      }catch(err){
        const reason = (err && err.message) ? err.message : String(err || "unknown");
        setLocalSdStatus("자동 배포 실패: " + reason, "error");
        showToast("자동 배포 실패: " + reason, "error", {key:"local-sd-deploy-fail"});
      }finally{
        setLocalSdBusy(false);
      }
    }

    async function formatLocalSdDirectory(){
      if(!localSdDirHandle){
        showToast("먼저 SD 폴더를 선택하세요.", "notice", {key:"local-sd-no-dir"});
        return;
      }
      const ok = window.confirm("선택한 SD 폴더의 모든 파일을 삭제할까요? (되돌릴 수 없음)");
      if(!ok) return;

      const granted = await localSdEnsureReadWritePermission(localSdDirHandle);
      if(!granted){
        showToast("SD 폴더 쓰기 권한이 없습니다.", "warn", {key:"local-sd-perm-no"});
        setLocalSdStatus("쓰기 권한이 없어 포맷을 중단했습니다.", "error");
        return;
      }

      setLocalSdBusy(true);
      let removed = 0;
      let skipped = 0;
      let failed = 0;
      const failedNames = [];
      try{
        const names = [];
        for await (const [name] of localSdDirHandle.entries()){
          names.push(name);
        }
        for(let i = 0; i < names.length; i++){
          const name = names[i];
          setLocalSdStatus("포맷 중... " + (i + 1) + "/" + names.length + " · " + name, null);

          // Some SD root metadata folders are protected by OS and should be skipped.
          if(
            name === ".Spotlight-V100" ||
            name === ".Trashes" ||
            name === ".fseventsd" ||
            name === "System Volume Information" ||
            name === "$RECYCLE.BIN"
          ){
            skipped++;
            continue;
          }

          try{
            await localSdDirHandle.removeEntry(name, {recursive:true});
            removed++;
          }catch(err){
            failed++;
            failedNames.push(name);
          }
        }

        if(failed === 0){
          const suffix = skipped > 0 ? (" · 시스템 항목 " + skipped + "개 제외") : "";
          setLocalSdStatus("포맷 완료: " + removed + "개 항목 삭제" + suffix, "ok");
          showToast("SD 폴더 포맷 완료: " + removed + "개 항목 삭제", "success", {key:"local-sd-format-ok"});
        }else if(removed > 0){
          const preview = failedNames.slice(0, 2).join(", ");
          setLocalSdStatus(
            "포맷 부분 완료: 삭제 " + removed + "개 / 실패 " + failed + "개" +
            (skipped > 0 ? (" / 제외 " + skipped + "개") : "") +
            (preview ? (" · 실패 예: " + preview) : ""),
            "warn"
          );
          showToast("SD 포맷 부분 완료 (삭제 " + removed + ", 실패 " + failed + ")", "warn", {key:"local-sd-format-partial"});
        }else{
          const preview = failedNames.slice(0, 2).join(", ");
          const msg = "SD 포맷 실패: 쓰기 금지 또는 잠금 상태일 수 있습니다" + (preview ? (" (" + preview + ")") : "");
          setLocalSdStatus(msg, "error");
          showToast(msg, "error", {key:"local-sd-format-fail"});
        }
      }catch(err){
        const reason = (err && err.message) ? err.message : String(err || "unknown");
        setLocalSdStatus("포맷 실패: " + reason, "error");
        showToast("SD 포맷 실패: " + reason, "error", {key:"local-sd-format-fail"});
      }finally{
        setLocalSdBusy(false);
      }
    }

    function ensureLocalSdToolsUi(){
      ensureLocalSdToolsCss();

      if(!el.localSdToolsWrap){
        const existing = document.getElementById("localSdToolsWrap");
        if(existing){
          el.localSdToolsWrap = existing;
          el.localSdPickBtn = document.getElementById("localSdPickBtn");
          el.localSdUploadBtn = document.getElementById("localSdUploadBtn");
          el.localSdUploadFolderBtn = document.getElementById("localSdUploadFolderBtn");
          el.localSdDeployBtn = document.getElementById("localSdDeployBtn");
          el.localSdFormatBtn = document.getElementById("localSdFormatBtn");
          el.localSdStatusLine = document.getElementById("localSdStatusLine");
          el.localSdNote = document.getElementById("localSdNote");
          el.localSdUploadInput = document.getElementById("localSdUploadInput");
          el.localSdUploadFolderInput = document.getElementById("localSdUploadFolderInput");
        }
      }
      if(el.localSdToolsWrap){
        refreshLocalSdControls();
        return;
      }

      const visibleStatus = findVisibleById("spiFlashStatusLine") || el.spiFlashStatusLine || null;
      const statusHost = (visibleStatus && visibleStatus.parentElement) ? visibleStatus.parentElement : null;
      const rowHost = visibleStatus
        ? (visibleStatus.closest(".hardware-row") || visibleStatus.closest(".hardware-item") || null)
        : null;
      const actionHostBtn = findVisibleById("spiFlashRefreshBtn") || findVisibleById("spiFlashDumpBtn") || null;
      const actionHost = actionHostBtn
        ? (actionHostBtn.closest(".hardware-row") || actionHostBtn.closest(".hardware-item") || actionHostBtn.parentElement || null)
        : null;
      const fallbackHardwareHost = (el.hardwareView && el.hardwareView.nodeType === 1) ? el.hardwareView : null;
      const host = statusHost || actionHost || fallbackHardwareHost || null;
      if(!host && !rowHost && !actionHost) return;

      const wrap = document.createElement("section");
      wrap.id = "localSdToolsWrap";
      wrap.className = "local-sd-tools";

      const title = document.createElement("div");
      title.className = "local-sd-tools-title";
      title.textContent = "LOCAL SD CARD (PC SLOT/HUB)";
      wrap.appendChild(title);

      const actions = document.createElement("div");
      actions.className = "local-sd-tools-actions";
      wrap.appendChild(actions);

      const baseBtnClass = String((el.spiFlashRefreshBtn && el.spiFlashRefreshBtn.className) || "").trim();
      const makeBtn = (id, label)=>{
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = id;
        btn.classList.add("local-sd-btn");
        if(baseBtnClass){
          baseBtnClass.split(/\s+/).forEach(cls=>{ if(cls) btn.classList.add(cls); });
        }
        btn.textContent = label;
        actions.appendChild(btn);
        return btn;
      };

      const pickBtn = makeBtn("localSdPickBtn", "SD 폴더 선택");
      const uploadBtn = makeBtn("localSdUploadBtn", "파일 업로드");
      const uploadFolderBtn = makeBtn("localSdUploadFolderBtn", "폴더 업로드");
      const deployBtn = makeBtn("localSdDeployBtn", "웹파일 자동배포");
      const formatBtn = makeBtn("localSdFormatBtn", "포맷(전체삭제)");

      const statusLine = document.createElement("div");
      statusLine.id = "localSdStatusLine";
      statusLine.className = "local-sd-status";
      statusLine.textContent = "SD 폴더를 선택하면 업로드를 시작할 수 있습니다.";
      wrap.appendChild(statusLine);

      const note = document.createElement("div");
      note.id = "localSdNote";
      note.className = "local-sd-note";
      wrap.appendChild(note);

      const uploadInput = document.createElement("input");
      uploadInput.id = "localSdUploadInput";
      uploadInput.className = "local-sd-input";
      uploadInput.type = "file";
      uploadInput.multiple = true;
      wrap.appendChild(uploadInput);

      const uploadFolderInput = document.createElement("input");
      uploadFolderInput.id = "localSdUploadFolderInput";
      uploadFolderInput.className = "local-sd-input";
      uploadFolderInput.type = "file";
      uploadFolderInput.multiple = true;
      uploadFolderInput.setAttribute("webkitdirectory", "");
      uploadFolderInput.setAttribute("directory", "");
      wrap.appendChild(uploadFolderInput);

      const insertAfterRow = rowHost || actionHost;
      if(insertAfterRow && insertAfterRow.parentElement){
        if(insertAfterRow.nextSibling){
          insertAfterRow.parentElement.insertBefore(wrap, insertAfterRow.nextSibling);
        }else{
          insertAfterRow.parentElement.appendChild(wrap);
        }
      }else if(host){
        host.appendChild(wrap);
      }else{
        document.body.appendChild(wrap);
      }

      el.localSdToolsWrap = wrap;
      el.localSdPickBtn = pickBtn;
      el.localSdUploadBtn = uploadBtn;
      el.localSdUploadFolderBtn = uploadFolderBtn;
      el.localSdDeployBtn = deployBtn;
      el.localSdFormatBtn = formatBtn;
      el.localSdStatusLine = statusLine;
      el.localSdNote = note;
      el.localSdUploadInput = uploadInput;
      el.localSdUploadFolderInput = uploadFolderInput;

      refreshLocalSdControls();
    }

    function bindLocalSdToolsUiEvents(){
      if(el.localSdPickBtn && !el.localSdPickBtn.dataset.bound){
        el.localSdPickBtn.dataset.bound = "1";
        el.localSdPickBtn.addEventListener("click", ()=>{ pickLocalSdDirectory(); });
      }
      if(el.localSdUploadBtn && el.localSdUploadInput && !el.localSdUploadBtn.dataset.bound){
        el.localSdUploadBtn.dataset.bound = "1";
        el.localSdUploadBtn.addEventListener("click", ()=>{
          if(!localSdDirHandle){
            showToast("먼저 SD 폴더를 선택하세요.", "notice", {key:"local-sd-no-dir"});
            return;
          }
          el.localSdUploadInput.click();
        });
      }
      if(el.localSdUploadFolderBtn && el.localSdUploadFolderInput && !el.localSdUploadFolderBtn.dataset.bound){
        el.localSdUploadFolderBtn.dataset.bound = "1";
        el.localSdUploadFolderBtn.addEventListener("click", ()=>{
          if(!localSdDirHandle){
            showToast("먼저 SD 폴더를 선택하세요.", "notice", {key:"local-sd-no-dir"});
            return;
          }
          el.localSdUploadFolderInput.click();
        });
      }
      if(el.localSdUploadInput && !el.localSdUploadInput.dataset.bound){
        el.localSdUploadInput.dataset.bound = "1";
        el.localSdUploadInput.addEventListener("change", async ()=>{
          const files = el.localSdUploadInput.files;
          try{
            await writeLocalSdFiles(files);
          }finally{
            el.localSdUploadInput.value = "";
          }
        });
      }
      if(el.localSdUploadFolderInput && !el.localSdUploadFolderInput.dataset.bound){
        el.localSdUploadFolderInput.dataset.bound = "1";
        el.localSdUploadFolderInput.addEventListener("change", async ()=>{
          const files = el.localSdUploadFolderInput.files;
          try{
            await writeLocalSdFiles(files);
          }finally{
            el.localSdUploadFolderInput.value = "";
          }
        });
      }
      if(el.localSdDeployBtn && !el.localSdDeployBtn.dataset.bound){
        el.localSdDeployBtn.dataset.bound = "1";
        el.localSdDeployBtn.addEventListener("click", ()=>{ deployCurrentWebAssetsToLocalSd(); });
      }
      if(el.localSdFormatBtn && !el.localSdFormatBtn.dataset.bound){
        el.localSdFormatBtn.dataset.bound = "1";
        el.localSdFormatBtn.addEventListener("click", ()=>{ formatLocalSdDirectory(); });
      }
    }

    const SPI_FLASH_SERIAL_CHUNK_BYTES = 96;

    function parseSpiFlashStatusAckMessage(message){
      const raw = String(message || "").trim();
      const prefix = "SPI_FLASH_STATUS";
      if(raw.indexOf(prefix) !== 0) return null;

      const fields = {};
      const tail = raw.slice(prefix.length).trim();
      const kvRegex = /([A-Za-z0-9_]+)=([^\s]+)/g;
      let match;
      while((match = kvRegex.exec(tail))){
        const key = String(match[1] || "").toLowerCase();
        const value = String(match[2] || "");
        fields[key] = value;
      }
      const parseNumber = (key, fallback)=>{
        const v = fields[key];
        if(v == null || v === "") return fallback;
        const n = Number(v);
        return isFinite(n) ? n : fallback;
      };

      return {
        ok: 1,
        ready: parseNumber("ready", 0) ? 1 : 0,
        busy: parseNumber("busy", 0) ? 1 : 0,
        jedec: {
          mfr: parseNumber("mfr", 0),
          type: parseNumber("type", 0),
          cap_code: parseNumber("cap_code", 0)
        },
        capacity_bytes: parseNumber("capacity", 0),
        used_bytes: parseNumber("used", 0),
        queue_bytes: parseNumber("queue", 0),
        record_count: parseNumber("records", 0),
        dropped_records: parseNumber("dropped", 0),
        flush_count: parseNumber("flush", 0)
      };
    }

    function parseSpiFlashChunkAckMessage(message){
      const raw = String(message || "").trim();
      const prefix = "SPI_FLASH_CHUNK";
      if(raw.indexOf(prefix) !== 0) return null;
      const tail = raw.slice(prefix.length).trim();

      let off = NaN;
      let len = NaN;
      let b64 = "";
      const kvRegex = /([A-Za-z0-9_]+)=([^\s]+)/g;
      let match;
      while((match = kvRegex.exec(tail))){
        const key = String(match[1] || "").toLowerCase();
        const value = String(match[2] || "");
        if(key === "off") off = Number(value);
        else if(key === "len") len = Number(value);
        else if(key === "b64") b64 = value;
      }

      if(!isFinite(off) || off < 0) return null;
      if(!isFinite(len) || len <= 0) return null;
      if(!b64) return null;
      return {off:Math.floor(off), len:Math.floor(len), b64};
    }

    function decodeBase64ToBytes(b64){
      const text = String(b64 || "").trim();
      if(!text) return new Uint8Array(0);
      const bin = atob(text);
      const out = new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++){
        out[i] = bin.charCodeAt(i) & 0xFF;
      }
      return out;
    }

    function buildSpiFlashBinHeader(info){
      const headerSize = 40;
      const dataBytes = Math.max(0, Number(info && info.used_bytes || 0)) >>> 0;
      const recordCount = Math.max(0, Number(info && info.record_count || 0)) >>> 0;
      let samplePeriodMs = 10;
      if(Array.isArray(sampleHistory) && sampleHistory.length){
        const tail = sampleHistory[sampleHistory.length - 1];
        const lt = Number(tail && tail.lt);
        if(isFinite(lt) && lt > 0) samplePeriodMs = Math.max(1, Math.round(lt));
      }

      const header = new Uint8Array(headerSize);
      const dv = new DataView(header.buffer);
      const magic = "HWLOGV1";
      for(let i=0;i<magic.length;i++) header[i] = magic.charCodeAt(i);
      header[7] = 0;
      dv.setUint16(8, 1, true); // version
      dv.setUint16(10, headerSize, true);
      dv.setUint32(12, dataBytes, true);
      dv.setUint32(16, recordCount, true);
      dv.setUint32(20, (Date.now() >>> 0), true); // exportedAtMs
      dv.setUint32(24, (samplePeriodMs >>> 0), true);
      dv.setUint32(28, (REPLAY_BIN_RECORD_MARKER >>> 0), true);
      dv.setUint32(32, 0, true);
      dv.setUint32(36, 0, true);
      return header;
    }

    async function fetchSpiFlashStatusViaSerial(){
      if(!canUseSerialForSpiFlash()){
        throw new Error("SERIAL_NOT_READY");
      }
      const waiter = createSerialAckWaiter((evt)=>{
        if(evt.kind === "err") return true;
        return evt.kind === "ack" && String(evt.message || "").indexOf("SPI_FLASH_STATUS") === 0;
      }, 1600);
      const wrote = await serialWriteLine("/storage/spi_flash/status");
      if(!wrote){
        cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
        throw new Error("SERIAL_WRITE_FAIL");
      }
      const reply = await waiter.promise;
      if(!reply.ok){
        throw new Error(reply.message || reply.kind || "SERIAL_FAIL");
      }
      const info = parseSpiFlashStatusAckMessage(reply.message);
      if(!info){
        throw new Error("SERIAL_PARSE_FAIL");
      }
      updateSpiFlashStatusUi(info, null);
      return info;
    }

    async function fetchSpiFlashChunkViaSerial(off, len){
      if(!canUseSerialForSpiFlash()){
        throw new Error("SERIAL_NOT_READY");
      }
      const offInt = Math.max(0, Math.floor(Number(off) || 0));
      const lenInt = Math.max(1, Math.min(SPI_FLASH_SERIAL_CHUNK_BYTES, Math.floor(Number(len) || 0)));
      const cmd = "/storage/spi_flash/read?off=" + offInt + "&len=" + lenInt;
      const waiter = createSerialAckWaiter((evt)=>{
        if(evt.kind === "err") return true;
        return evt.kind === "ack" && String(evt.message || "").indexOf("SPI_FLASH_CHUNK") === 0;
      }, 2400);
      const wrote = await serialWriteLine(cmd);
      if(!wrote){
        cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
        throw new Error("SERIAL_WRITE_FAIL");
      }
      const reply = await waiter.promise;
      if(!reply.ok){
        throw new Error(reply.message || reply.kind || "SERIAL_FAIL");
      }
      const chunk = parseSpiFlashChunkAckMessage(reply.message);
      if(!chunk){
        throw new Error("SERIAL_CHUNK_PARSE_FAIL");
      }
      if(chunk.off !== offInt || chunk.len !== lenInt){
        throw new Error("SERIAL_CHUNK_MISMATCH");
      }
      const bytes = decodeBase64ToBytes(chunk.b64);
      if(bytes.length !== lenInt){
        throw new Error("SERIAL_CHUNK_SIZE_FAIL");
      }
      return bytes;
    }

    async function downloadSpiFlashDumpViaSerial(){
      const info = await fetchSpiFlashStatusViaSerial();
      const dataBytes = Math.max(0, Number(info && info.used_bytes || 0));
      const header = buildSpiFlashBinHeader(info);
      const chunks = [header];
      let off = 0;
      while(off < dataBytes){
        const len = Math.min(SPI_FLASH_SERIAL_CHUNK_BYTES, dataBytes - off);
        const bytes = await fetchSpiFlashChunkViaSerial(off, len);
        chunks.push(bytes);
        off += len;
        if(el.spiFlashStatusLine){
          const pct = dataBytes > 0 ? Math.floor((off * 100) / dataBytes) : 100;
          el.spiFlashStatusLine.textContent = "SPI Flash BIN 시리얼 다운로드 중... " + pct + "%";
        }
      }

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const blob = new Blob(chunks, {type:"application/octet-stream"});
      downloadBlobAsFile(blob, "spi_flash_log_" + ts + ".bin");
      showToast("SPI Flash BIN(Serial) 다운로드 완료", "success", {key:"spi-flash-dump-serial"});
      await fetchSpiFlashStatus();
    }

    async function fetchSpiFlashStatus(){
      let serialReason = "";
      if(canUseSerialForSpiFlash()){
        try{
          return await fetchSpiFlashStatusViaSerial();
        }catch(err){
          serialReason = (err && err.message) ? err.message : String(err || "SERIAL_ERROR");
        }
      }
      const API_BASE = getApiBaseForCommands();
      const url = (API_BASE ? API_BASE : "") + "/storage/spi_flash/status";
      const ctrl = new AbortController();
      const timer = setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, 3500);
      const opt = API_BASE
        ? {cache:"no-store", mode:"cors", signal:ctrl.signal}
        : {cache:"no-store", signal:ctrl.signal};
      try{
        const res = await fetch(url, opt);
        if(!res.ok){
          throw new Error("HTTP " + res.status);
        }
        const info = await res.json();
        updateSpiFlashStatusUi(info, null);
        return info;
      }catch(err){
        const httpReason = (err && err.name === "AbortError")
          ? "TIMEOUT(3.5s)"
          : ((err && err.message) ? err.message : String(err || "unknown"));
        const reason = serialReason ? ("SERIAL " + serialReason + " / HTTP " + httpReason) : httpReason;
        updateSpiFlashStatusUi(null, reason);
        return null;
      }finally{
        clearTimeout(timer);
      }
    }

    async function resetSpiFlashStorage(){
      let serialReason = "";
      if(canUseSerialForSpiFlash()){
        try{
          if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "SPI Flash 저장소 초기화 중...(Serial)";
          const waiter = createSerialAckWaiter((evt)=>{
            if(evt.kind === "err") return true;
            return evt.kind === "ack" && String(evt.message || "").indexOf("SPI_FLASH_INIT_OK") === 0;
          }, 2400);
          const wrote = await serialWriteLine("/storage/spi_flash/init");
          if(!wrote){
            cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
            throw new Error("SERIAL_WRITE_FAIL");
          }
          const reply = await waiter.promise;
          if(!reply.ok){
            throw new Error(reply.message || reply.kind || "SERIAL_FAIL");
          }
          await fetchSpiFlashStatus();
          showToast("SPI Flash 저장소를 초기화했습니다.", "success", {key:"spi-flash-init"});
          return;
        }catch(err){
          serialReason = (err && err.message) ? err.message : String(err || "SERIAL_ERROR");
        }
      }
      const API_BASE = getApiBaseForCommands();
      const url = (API_BASE ? API_BASE : "") + "/storage/spi_flash/init";
      const ctrl = new AbortController();
      const timer = setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, 5000);
      const opt = API_BASE
        ? {method:"POST", mode:"cors", signal:ctrl.signal}
        : {method:"POST", signal:ctrl.signal};
      try{
        if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "SPI Flash 저장소 초기화 중...";
        const res = await fetch(url, opt);
        if(!res.ok){
          const text = await res.text();
          throw new Error(text || ("HTTP " + res.status));
        }
        await fetchSpiFlashStatus();
        showToast("SPI Flash 저장소를 초기화했습니다.", "success", {key:"spi-flash-init"});
      }catch(err){
        const httpReason = (err && err.name === "AbortError")
          ? "TIMEOUT(5s)"
          : ((err && err.message) ? err.message : String(err || "unknown"));
        const reason = serialReason ? ("SERIAL " + serialReason + " / HTTP " + httpReason) : httpReason;
        showToast("SPI Flash 초기화 실패: " + reason, "error", {key:"spi-flash-init-fail"});
        updateSpiFlashStatusUi(null, reason);
      }finally{
        clearTimeout(timer);
      }
    }

    async function downloadSpiFlashDump(){
      if(canUseSerialForSpiFlash()){
        try{
          if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "SPI Flash BIN 시리얼 다운로드 준비 중...";
          if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = true;
          await downloadSpiFlashDumpViaSerial();
        }catch(err){
          const reason = (err && err.message) ? err.message : String(err || "unknown");
          showToast("SPI Flash BIN(Serial) 다운로드 실패: " + reason, "error", {key:"spi-flash-dump-serial-fail"});
          if(el.spiFlashStatusLine){
            el.spiFlashStatusLine.textContent = "SPI Flash BIN(Serial) 다운로드 실패: " + reason;
          }
        }finally{
          if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = false;
        }
        return;
      }

      const API_BASE = getApiBaseForCommands();
      const url = (API_BASE ? API_BASE : "") + "/storage/spi_flash/export.bin";
      const ctrl = new AbortController();
      const timeoutMs = 30000;
      const timer = setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, timeoutMs);
      const opt = API_BASE
        ? {cache:"no-store", mode:"cors", signal:ctrl.signal}
        : {cache:"no-store", signal:ctrl.signal};
      try{
        if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "SPI Flash BIN 다운로드 준비 중...";
        if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = true;
        const res = await fetch(url, opt);
        if(!res.ok){
          const text = await res.text();
          throw new Error(text || ("HTTP " + res.status));
        }
        if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "SPI Flash BIN 다운로드 중...";
        const blob = await res.blob();
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        downloadBlobAsFile(blob, "spi_flash_log_" + ts + ".bin");
        showToast("SPI Flash BIN 다운로드 완료", "success", {key:"spi-flash-dump"});
        await fetchSpiFlashStatus();
      }catch(err){
        const isAbort = !!(err && (err.name === "AbortError"));
        const reason = isAbort
          ? "TIMEOUT(30s) - 보드 Wi-Fi 연결 또는 192.168.4.1 접근 상태를 확인하세요"
          : ((err && err.message) ? err.message : String(err || "unknown"));
        showToast("SPI Flash BIN 다운로드 실패: " + reason, "error", {key:"spi-flash-dump-fail"});
        if(el.spiFlashStatusLine){
          el.spiFlashStatusLine.textContent = "SPI Flash BIN 다운로드 실패: " + reason;
        }
      }finally{
        clearTimeout(timer);
        if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = false;
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
    let rebootConfirmOverlayEl=null;
    let rebootConfirmBtnEl=null;
    let rebootConfirmCancelBtnEl=null;
    let rebootConfirmTitleEl=null;
    let rebootConfirmTextEl=null;
    let rebootConfirmActionsEl=null;
    let rebootConfirmWaiting=false;
    let rebootConfirmStartedMs=0;
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
      if(!hasSequenceMissionRequirement()){
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
      if(latestTelemetry.sw === 1){
        showToast(t("switchHighToast", {safety:safetyLineSuffix()}), "notice");
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
      const cdMs = Math.max(3000, Math.min(60000, ((uiSettings ? uiSettings.countdownSec : 10) * 1000)));
      sendCommand({http:"/precount?uw=1&cd="+cdMs, ser:"PRECOUNT 1 "+cdMs}, false);
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
      if(latestTelemetry.sw === 1){
        showToast(t("switchHighToast", {safety:safetyLineSuffix()}), "notice");
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
      const configuredCdMs = Math.max(3000, Math.min(60000, ((uiSettings ? uiSettings.countdownSec : 10) * 1000)));

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
        }

        if(left===0){
          clearInterval(lpTimer); lpTimer=null;
          resetLongPressVisual(); userWaitingLocal=false;
          if(latestTelemetry.sw === 1){
            setOverlayVisible(confirmOverlayEl, false);
            sendCommand({http:"/precount?uw=0&cd=0", ser:"PRECOUNT 0 0"}, false);
            showToast(t("switchHighToast", {safety:safetyLineSuffix()}), "notice");
            return;
          }
          if((uiSettings && uiSettings.igs) && latestTelemetry.ic !== 1){
            setOverlayVisible(confirmOverlayEl, false);
            sendCommand({http:"/precount?uw=0&cd=0", ser:"PRECOUNT 0 0"}, false);
            showToast(t("countdownIgniterRequired", {safety:safetyLineSuffix()}), "notice");
            return;
          }
          setOverlayVisible(confirmOverlayEl, false);
          sendCommand({http:"/precount?uw=0&cd="+configuredCdMs, ser:"PRECOUNT 0 "+configuredCdMs}, false);
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
        const cdMs = Math.max(3000, Math.min(60000, ((uiSettings ? uiSettings.countdownSec : 10) * 1000)));
        lpLastSentSec=Math.ceil(cdMs/1000);
        sendCommand({http:"/precount?uw=1&cd="+cdMs, ser:"PRECOUNT 1 "+cdMs}, false);
      }
    }

    // =====================
    // 설정/발사대
    // =====================
    function showSettings(){
      if(isStatusMapViewportExpanded()){
        setStatusMapViewportExpanded(false);
      }
      closeIgnitionModals();
      hideMobileControlsPanel();
      document.documentElement.classList.add("settings-open");
      syncControlsToggleButtonsForSettings();
      setOverlayVisible(el.settingsOverlay, true);
    }
    function hideSettings(){
      document.documentElement.classList.remove("settings-open");
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
    function hasSequenceMissionRequirement(){
      // DAQ 모드에서는 미션명이 없어도 시퀀스/강제점화를 허용.
      if(!isFlightModeUi()) return true;
      return hasMissionSelected();
    }
    function isMissionEditableNow(){
      if(replaySourceActive) return false;
      if(currentSt !== 0) return false;
      return !(latestTelemetry && latestTelemetry.uw === 1);
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
        block.then = {type:"alarm", title:"미션 알람", message:"알람이 발생했습니다."};
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
        String(whenType || "") === "boot"
      ){
        return "eq";
      }
      return "gt";
    }
    function normalizeMissionTriggerValue(whenType, raw){
      const t = String(whenType || "");
      const n = toFiniteNumber(raw, 0);
      if(t === "switch_falling" || t === "switch_rising" || t === "boot") return 0;
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
        t === "switch_rising" || t === "time_after_firing_ms" ||
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
        out.then.channel = Math.max(1, Math.min(4, out.then.channel));
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
        out.then.channel = Math.max(1, Math.min(4, out.then.channel));
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
          let max = 4;
          if(actionType === "pyro") max = 4;
          if(actionType === "var_set" || actionType === "var_add" || actionType === "var_avg") max = 8;
          for(let i = 1; i <= max; i++){
            const option = document.createElement("option");
            option.value = String(i);
            option.textContent = String(i);
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
        next.then.channel = Math.max(1, Math.min(4, actionChannelRaw));
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
        next.then.channel = Math.max(1, Math.min(4, actionChannelRaw));
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
        k === "cond_altitude" || k === "cond_start_arm_off" || k === "cond_switch_falling" ||
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
      return k === "cond_altitude" || k === "cond_start_arm_off" || k === "cond_switch_falling" ||
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
        const empty = document.createElement("div");
        empty.className = "mission-block-empty";
        empty.textContent = "왼쪽 팔레트에서 블록을 드래그해 시퀀스를 만들어보세요.";
        stage.appendChild(empty);
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
      const profile = (doc.profile && typeof doc.profile === "object") ? doc.profile : doc;
      const motor = (profile.motor && typeof profile.motor === "object") ? profile.motor : {};

      const missionName = sanitizeMissionName(profile.missionName || profile.name);
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
    async function saveMissionProfileViaSerial(body, bodyBytes){
      const canSerialSave = !!(serialEnabled && serialConnected && serialTxEnabled);
      if(!canSerialSave) return { ok:false, reason:"SERIAL_NOT_READY" };

      const beginRes = await sendMissionSerialAckCommand(
        "/mission_profile_begin?len=" + String(Math.max(0, bodyBytes || 0)),
        "MISSION_PROFILE_BEGIN",
        2200
      );
      if(!beginRes.ok) return beginRes;

      const bytes = new TextEncoder().encode(String(body || ""));
      const b64 = base64FromUtf8Bytes(bytes);
      if(!b64){
        await sendMissionSerialAckCommand("/mission_profile_cancel", "MISSION_PROFILE_CANCEL", 1200);
        return { ok:false, reason:"SERIAL_B64_ENCODE_FAIL" };
      }

      for(let i = 0; i < b64.length; i += MISSION_SERIAL_CHUNK_B64_SIZE){
        const chunk = b64.slice(i, i + MISSION_SERIAL_CHUNK_B64_SIZE);
        const chunkRes = await sendMissionSerialAckCommand(
          "/mission_profile_chunk?b64=" + chunk,
          "MISSION_PROFILE_CHUNK",
          2600
        );
        if(!chunkRes.ok){
          await sendMissionSerialAckCommand("/mission_profile_cancel", "MISSION_PROFILE_CANCEL", 1200);
          return chunkRes;
        }
      }

      const endRes = await sendMissionSerialAckCommand("/mission_profile_end", "MISSION_PROFILE_SAVED", 5000);
      return endRes;
    }
    async function saveMissionProfileToBoard(){
      if(missionBoardSavePending){
        showToast("보드 저장이 진행 중입니다. 잠시만 기다리세요.", "notice", {
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
      if(canSerialMissionSave){
        const serialRes = await saveMissionProfileViaSerial(body, bodyBytes);
        if(serialRes.ok){
          missionProfileDoc = payload;
          showToast("미션이 보드 플래시에 저장되었습니다.", "success", {key:"mission-board-save"});
          missionBoardSavePending = false;
          return true;
        }
        addLogLine("Mission save via SERIAL failed: " + serialRes.reason, "ERR");
        showToast("보드 저장 실패(SERIAL): " + (serialRes.reason || "SERIAL_FAIL"), "error", {
          key:"mission-board-save-fail",
          forceToast:true
        });
        missionBoardSavePending = false;
        return false;
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
        showToast("파일 읽기에 실패했습니다.", "error", {key:"mission-import-read-fail"});
        if(el.missionImportInput) el.missionImportInput.value = "";
      };
      reader.readAsText(file);
    }
    function updateMissionEditLockUI(){
      const editable = isMissionEditableNow();
      if(el.missionOpenBtn){
        el.missionOpenBtn.disabled = false;
        el.missionOpenBtn.setAttribute("aria-disabled", editable ? "false" : "true");
        el.missionOpenBtn.title = editable ? "" : "IDLE(시퀀스 전)에서만 미션 편집 가능";
      }
      if(el.missionViewOpenBtn){
        el.missionViewOpenBtn.disabled = false;
        el.missionViewOpenBtn.setAttribute("aria-disabled", editable ? "false" : "true");
        el.missionViewOpenBtn.title = editable ? "" : "IDLE(시퀀스 전)에서만 미션 편집 가능";
      }
      if(el.missionSaveBoardBtn){
        // Always clickable so the user can see lock/fail reason toast.
        el.missionSaveBoardBtn.disabled = false;
        el.missionSaveBoardBtn.classList.remove("disabled");
        el.missionSaveBoardBtn.setAttribute("aria-disabled", "false");
        el.missionSaveBoardBtn.title = editable ? "" : "IDLE(시퀀스 전)에서만 저장 가능";
      }
      if(el.missionImportInput){
        el.missionImportInput.disabled = !editable;
      }
      if(el.missionBlockAddServoBtn) el.missionBlockAddServoBtn.disabled = !editable;
      if(el.missionBlockAddPyroBtn) el.missionBlockAddPyroBtn.disabled = !editable;
      if(el.missionBlockClearBtn) el.missionBlockClearBtn.disabled = !editable;
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
      setMobileControlButtonState("mission", !editable);
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
      const delayText = Number.isFinite(delaySec) ? formatQuickTimeDisplay(delaySec) : "--";
      el.motorDelay.innerHTML = '<span class="num">' + delayText + '</span><span class="unit">S</span>';
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
      syncGyroExpandedHud();
      syncStatusMapExpandedHud();
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
      if(!isMissionEditableNow()){
        showToast("시퀀스 중에는 미션 편집만 잠깁니다.", "notice", {key:"mission-edit-lock"});
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
      while(loadcellStabilitySamples.length && (now - loadcellStabilitySamples[0].ts) > LOADCELL_STABILIZE_WINDOW_MS){
        loadcellStabilitySamples.shift();
      }

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
    function updateLoadcellLiveValue(val){
      lastThrustKgf = val;
      const modalDisplayZero = isLoadcellModalVisible() && lastLoadcellOffsetValid === 0;
      const displayValue = modalDisplayZero ? 0 : val;
      if(el.loadcellLiveValue){
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
      const opt = API_BASE ? { mode:"no-cors", cache:"no-cache" } : { cache:"no-cache" };
      try{
        const res = await fetch(url, opt);
        if(!API_BASE && !res.ok){
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
      if(!hasSequenceMissionRequirement()){
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
    function closeIgnitionModals(){
      const sequenceModalOpen = !!(confirmOverlayEl && !confirmOverlayEl.classList.contains("hidden"));
      const forceModalOpen = !!(forceOverlayEl && !forceOverlayEl.classList.contains("hidden"));
      if(sequenceModalOpen) hideConfirm();
      if(forceModalOpen) hideForceConfirm();
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
      }
    }
    function showRebootConfirm(){
      hideMobileControlsPanel();
      rebootConfirmWaiting = false;
      rebootConfirmStartedMs = 0;
      updateRebootConfirmUi();
      setOverlayVisible(rebootConfirmOverlayEl, true);
    }
    function hideRebootConfirm(){
      rebootConfirmWaiting = false;
      rebootConfirmStartedMs = 0;
      updateRebootConfirmUi();
      setOverlayVisible(rebootConfirmOverlayEl, false);
    }
    function setRebootConfirmWaiting(){
      rebootConfirmWaiting = true;
      rebootConfirmStartedMs = Date.now();
      updateRebootConfirmUi();
      setOverlayVisible(rebootConfirmOverlayEl, true);
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
        resetSimState();
        simState.st = 1;
        simState.countdownTotalMs = (uiSettings ? uiSettings.countdownSec : 10) * 1000;
        simState.cdMs = simState.countdownTotalMs;
        simState.countdownStartMs = Date.now();
        resetGyroPathTracking();
      }else if(path.startsWith("/force_ignite") || path.startsWith("/ignite")){
        if(simState.flightStartMs == null || simState.landed){
          resetSimState();
        }
        simState.st = 2;
        simState.ignStartMs = Date.now();
        if(simState.flightStartMs == null){
          simState.flightStartMs = simState.ignStartMs;
          simState.physicsLastMs = 0;
          resetGyroPathTracking();
        }
        simState.countdownStartMs = null;
        simState.cdMs = 0;
        simState.countdownTotalMs = null;
      }else if(path.startsWith("/sequence_end")){
        resetSimState();
        resetGyroPathTracking();
      }else if(path.startsWith("/abort")){
        resetSimState();
        resetGyroPathTracking();
      }else if(path.startsWith("/servo")){
        const chMatch = path.match(/[?&](?:ch|id)=([0-9]+)/i);
        const degMatch = path.match(/[?&](?:deg|angle)=(-?[0-9]+)/i);
        const ch = chMatch ? Number(chMatch[1]) : NaN;
        const deg = degMatch ? clampServoAngle(degMatch[1]) : NaN;
        if(isFinite(ch) && isFinite(deg) && SERVO_CHANNELS.indexOf(ch) >= 0){
          setServoUiAngle(ch, deg);
        }
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
          serLine = "/precount?uw=" + (uw ? 1 : 0) + "&cd=" + Math.max(0, Math.min(60000, cd|0));
        }else if(head === "RS"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?rs=" + v;
        }else if(head === "IGS"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?igs=" + v;
        }else if(head === "SAFE"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?safe=" + v;
        }else if(head === "ARMLOCK"){
          const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
          serLine = "/set?arm_lock=" + v;
        }else if(head === "IGNMS"){
          const ms = (parts[1] != null) ? (Number(parts[1])|0) : 1000;
          serLine = "/set?ign_ms=" + ms;
        }else if(head === "CDMS"){
          const ms = (parts[1] != null) ? (Number(parts[1])|0) : 10000;
          serLine = "/set?cd_ms=" + ms;
        }else if(head === "LAUNCHER"){
          const dir = (parts[1] || "STOP").toUpperCase();
          const dirValue = (dir === "UP" || dir === "DOWN") ? dir.toLowerCase() : "stop";
          serLine = "/launcher?dir=" + dirValue;
        }else if(head === "SERVO"){
          const chRaw = (parts[1] != null) ? (Number(parts[1])|0) : 1;
          const ch = Math.max(1, Math.min(4, chRaw));
          const degRaw = (parts[2] != null) ? Number(parts[2]) : SERVO_DEFAULT_DEG;
          const deg = clampServoAngle(degRaw);
          serLine = "/servo?ch=" + ch + "&deg=" + deg;
        }else if(head === "PYRO"){
          const chRaw = (parts[1] != null) ? (Number(parts[1])|0) : 1;
          const ch = Math.max(1, Math.min(4, chRaw));
          const msRaw = (parts[2] != null) ? (Number(parts[2])|0) : 500;
          const ms = Math.max(10, Math.min(30000, msRaw));
          serLine = "/pyro_test?ch=" + ch + "&ms=" + ms;
	        }
	      }

      const normalizedPath = (cmd.http && String(cmd.http).trim())
        ? String(cmd.http).trim()
        : ((serLine && serLine[0] === "/") ? serLine : "");
      const isLockoutBypassCmd =
        normalizedPath.startsWith("/abort") ||
        normalizedPath.startsWith("/sequence_end") ||
        normalizedPath.startsWith("/set?safe=") ||
        normalizedPath.startsWith("/set?arm_lock=");
      if(lockoutLatched && !isLockoutBypassCmd){
        const name = relayMaskName(lockoutRelayMask);
        showToast(t("lockoutCmdDenied", {name}), "error");
        return;
      }

	      const canSerialTx = !!(serialEnabled && serialConnected && serialTxEnabled && serLine);
	      const API_BASE = getApiBaseForCommands();

	      if(cmd.http && !canSerialTx){
	        const url = API_BASE ? (API_BASE + cmd.http) : cmd.http;
	        const isPostCommand = String(cmd.http || "").indexOf("/storage/spi_flash/init") === 0;
	        const opt = API_BASE
	          ? (isPostCommand ? { method:"POST", mode:"no-cors", cache:"no-cache" } : { mode:"no-cors", cache:"no-cache" })
	          : (isPostCommand ? { method:"POST", cache:"no-cache" } : { cache:"no-cache" });
	        fetch(url, opt).catch(err=>{ reportSilentException("cmd-http", err); });
	      }

	      if(canSerialTx){
	        await serialWriteLine(serLine);
	      }

      if(logIt){
        addLogLine(t("cmdSentLog", {cmd:(cmd.http || cmd.ser || "?")}), "CMD");
      }
    }

    function showTerminalHelp(){
      addLogLine("Terminal commands:", "HELP");
      addLogLine("  HTTP paths: /set?... /launcher?dir=up|down|stop /servo?ch=1~4&deg=0~360 /pyro_test?ch=1~4&ms=10~30000 /countdown_start /ignite /force_ignite /abort /sequence_end /precount?uw=0|1&cd=ms", "HELP");
      addLogLine("  SPI Flash: /storage/spi_flash/status /storage/spi_flash/init", "HELP");
      addLogLine("  Shortcuts: FORCE, COUNTDOWN, ABORT, IGNITE, SEQUENCE_END", "HELP");
      addLogLine("  Params: PRECOUNT <uw> <ms>, RS <0|1>, IGS <0|1>, SAFE <0|1>, ARMLOCK <0|1>", "HELP");
      addLogLine("  Timing: IGNMS <ms>, CDMS <ms>, LAUNCHER <UP|DOWN|STOP>, SERVO <1-4> <0-360>, PYRO <1-4> <10-30000ms>, SPI_STATUS, SPI_INIT", "HELP");
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
        const cdMs = Math.max(0, Math.min(60000, cd|0));
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
      }else if(head === "ARMLOCK"){
        const v = (parts[1] != null) ? (Number(parts[1]) ? 1 : 0) : 0;
        http = "/set?arm_lock=" + v;
        ser = "ARMLOCK " + v;
      }else if(head === "IGNMS"){
        const ms = (parts[1] != null) ? (Number(parts[1])|0) : 1000;
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
      }else if(head === "SERVO"){
        const chRaw = (parts[1] != null) ? (Number(parts[1])|0) : 1;
        const ch = Math.max(1, Math.min(4, chRaw));
        const degRaw = (parts[2] != null) ? Number(parts[2]) : SERVO_DEFAULT_DEG;
        const deg = clampServoAngle(degRaw);
        http = "/servo?ch=" + ch + "&deg=" + deg;
        ser = "SERVO " + ch + " " + deg;
      }else if(head === "PYRO"){
        const chRaw = (parts[1] != null) ? (Number(parts[1])|0) : 1;
        const ch = Math.max(1, Math.min(4, chRaw));
        const msRaw = (parts[2] != null) ? (Number(parts[2])|0) : 500;
        const ms = Math.max(10, Math.min(30000, msRaw));
        http = "/pyro_test?ch=" + ch + "&ms=" + ms;
        ser = "PYRO " + ch + " " + ms;
      }else if(head === "SPI_STATUS"){
        http = "/storage/spi_flash/status";
        ser = "/storage/spi_flash/status";
      }else if(head === "SPI_INIT"){
        http = "/storage/spi_flash/init";
        ser = "/storage/spi_flash/init";
      }

      return {http, ser};
    }

    // =====================
    // DOM Ready
    // =====================
    document.addEventListener("DOMContentLoaded", async ()=>{
      // ✅ 스플래시 + 프리로드 먼저
      await runSplashAndPreload();
      removeLegacyLuceText();
      setTimeout(removeLegacyLuceText, 400);
      setTimeout(removeLegacyLuceText, 1200);

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
      el.statusMapViewport = document.getElementById("statusMapViewport");
      el.statusMapCoordText = document.getElementById("statusMapCoordText");
      el.statusMapZoomText = document.getElementById("statusMapZoomText");
      el.statusMapExpandBtn = document.getElementById("statusMapExpandBtn");
      el.statusMapRecenterBtn = document.getElementById("statusMapRecenterBtn");
      el.statusMapCopyBtn = document.getElementById("statusMapCopyBtn");
      el.statusMapExpandedHud = document.getElementById("statusMapExpandedHud");
      el.statusMapHudTitle = document.getElementById("statusMapHudTitle");
      el.statusMapHudCountdown = document.getElementById("statusMapHudCountdown");
      el.statusMapHudStatusInline = document.getElementById("statusMapHudStatusInline");
      el.statusMapHudStatusText = document.getElementById("statusMapHudStatusText");
      el.statusMapHudStatusPill = document.getElementById("statusMapHudStatusPill");
      el.statusMapHudStatusBar = document.getElementById("statusMapHudStatusBar");
      el.statusMapHudConn = document.getElementById("statusMapHudConn");
      el.statusMapHudConnCompact = document.getElementById("statusMapHudConnCompact");
      el.statusMapHudClockCompact = document.getElementById("statusMapHudClockCompact");
      el.statusMapHudTimeCompact = document.getElementById("statusMapHudTimeCompact");
      el.statusMapHudBatteryWrap = document.getElementById("statusMapHudBatteryWrap");
      el.statusMapHudBatteryFill = document.getElementById("statusMapHudBatteryFill");
      el.statusMapHudBattery = document.getElementById("statusMapHudBattery");
      el.statusMapHudBatteryCompact = document.getElementById("statusMapHudBatteryCompact");
      el.statusMapHudMetricPrimaryCard = document.getElementById("statusMapHudMetricPrimaryCard");
      el.statusMapHudMetricPrimaryLabel = document.getElementById("statusMapHudMetricPrimaryLabel");
      el.statusMapHudMetricPrimaryValue = document.getElementById("statusMapHudMetricPrimaryValue");
      el.statusMapHudMetricSecondaryCard = document.getElementById("statusMapHudMetricSecondaryCard");
      el.statusMapHudMetricSecondaryLabel = document.getElementById("statusMapHudMetricSecondaryLabel");
      el.statusMapHudMetricSecondaryValue = document.getElementById("statusMapHudMetricSecondaryValue");
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
      renderHomeViewLayout();
      el.dashboardView = document.getElementById("dashboardView");
      el.terminalView = document.getElementById("terminalView");
      el.hardwareView = document.getElementById("hardwareView");
      el.gyroView = document.getElementById("gyroView");
      el.countdownView = document.getElementById("countdownView");
      el.missionView = document.getElementById("missionView");
      el.controlPanelView = document.getElementById("controlPanelView");
      el.gyro3dExpandedHud = document.getElementById("gyro3dExpandedHud");
      el.gyro3dHudTitle = document.getElementById("gyro3dHudTitle");
      el.gyro3dHudCountdown = document.getElementById("gyro3dHudCountdown");
      el.gyro3dHudStatusInline = document.getElementById("gyro3dHudStatusInline");
      el.gyro3dHudStatusText = document.getElementById("gyro3dHudStatusText");
      el.gyro3dHudStatusPill = document.getElementById("gyro3dHudStatusPill");
      el.gyro3dHudStatusBar = document.getElementById("gyro3dHudStatusBar");
      el.gyro3dHudConn = document.getElementById("gyro3dHudConn");
      el.gyro3dHudConnCompact = document.getElementById("gyro3dHudConnCompact");
      el.gyro3dHudClockCompact = document.getElementById("gyro3dHudClockCompact");
      el.gyro3dHudTimeCompact = document.getElementById("gyro3dHudTimeCompact");
      el.gyro3dHudBatteryWrap = document.getElementById("gyro3dHudBatteryWrap");
      el.gyro3dHudBatteryFill = document.getElementById("gyro3dHudBatteryFill");
      el.gyro3dHudBattery = document.getElementById("gyro3dHudBattery");
      el.gyro3dHudBatteryCompact = document.getElementById("gyro3dHudBatteryCompact");
      el.gyro3dHudMetricPrimaryCard = document.getElementById("gyro3dHudMetricPrimaryCard");
      el.gyro3dHudMetricPrimaryLabel = document.getElementById("gyro3dHudMetricPrimaryLabel");
      el.gyro3dHudMetricPrimaryValue = document.getElementById("gyro3dHudMetricPrimaryValue");
      el.gyro3dHudMetricSecondaryCard = document.getElementById("gyro3dHudMetricSecondaryCard");
      el.gyro3dHudMetricSecondaryLabel = document.getElementById("gyro3dHudMetricSecondaryLabel");
      el.gyro3dHudMetricSecondaryValue = document.getElementById("gyro3dHudMetricSecondaryValue");
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
      el.homeFlyCardBtn = document.getElementById("homeFlyCardBtn");
      el.homeDataExtractBtn = document.getElementById("homeDataExtractBtn");
      el.homeFindSoundBtn = document.getElementById("homeFindSoundBtn");
      el.quickSw = document.getElementById("quick-sw");
      el.quickRelay1 = document.getElementById("quick-relay-1");
      el.quickRelay1Label = document.getElementById("quick-relay-1-label");
      el.quickRelay2 = document.getElementById("quick-relay-2");
      el.quickRelay2Label = document.getElementById("quick-relay-2-label");
      el.quickState = document.getElementById("quick-state");
      el.quickMetricPrimaryLabel = document.getElementById("quickMetricPrimaryLabel");
      el.quickMetricSecondaryLabel = document.getElementById("quickMetricSecondaryLabel");
      el.hardwarePyroDurationInput = document.getElementById("hardwarePyroDurationInput");
      el.hardwarePyroFireCh1Btn = document.getElementById("hardwarePyroFireCh1Btn");
      el.hardwarePyroFireCh2Btn = document.getElementById("hardwarePyroFireCh2Btn");
      el.hardwarePyroFireCh3Btn = document.getElementById("hardwarePyroFireCh3Btn");
      el.hardwarePyroFireCh4Btn = document.getElementById("hardwarePyroFireCh4Btn");

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
      el.gyroGlHidden = document.getElementById("gyroGl");
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
      el.quickDelayLabel = document.getElementById("quick-delay-label");
      el.quickBurnLabel = document.getElementById("quick-burn-label");

      el.quickHxHz = document.getElementById("quick-hx-hz");
      el.quickHxHzLabel = document.getElementById("quick-hx-hz-label");
      el.quickNullLabel = document.getElementById("quick-null-label");
      el.quickNullValue = document.getElementById("quick-null-value");
      el.quickNull2Label = document.getElementById("quick-null-2-label");
      el.quickNull2Value = document.getElementById("quick-null-2-value");
      el.quickNull3Label = document.getElementById("quick-null-3-label");
      el.quickNull3Value = document.getElementById("quick-null-3-value");
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
      el.gyroZeroBtn = document.getElementById("gyroZeroBtn");
      el.missionOpenBtn = document.getElementById("missionOpenBtn");
      el.missionViewOpenBtn = document.getElementById("missionViewOpenBtn");
      el.missionViewMount = document.getElementById("missionViewMount");
      el.exportCsvBtn = document.getElementById("exportCsvBtn");
      el.rebootBoardBtn = document.getElementById("rebootBoardBtn");

      el.controlsSettingsBtns = document.querySelectorAll(".js-controls-settings");
      el.sidebarSettingsBtns = document.querySelectorAll(".js-sidebar-settings");
      el.sidebarTerminalBtn = document.getElementById("sidebarTerminalBtn");
      el.settingsOverlay = document.getElementById("settingsOverlay");
      el.settingsClose = el.settingsOverlay ? el.settingsOverlay.querySelector("#settingsClose") : null;
      el.settingsSave = el.settingsOverlay ? el.settingsOverlay.querySelector("#settingsSave") : null;
      el.launcherAutoOverlay = document.getElementById("launcherAutoOverlay");
      el.launcherAutoConfirm = document.getElementById("launcherAutoConfirm");
      el.launcherAutoCancel = document.getElementById("launcherAutoCancel");
      el.rebootConfirmOverlay = document.getElementById("rebootConfirmOverlay");
      el.rebootConfirmBtn = document.getElementById("rebootConfirmBtn");
      el.rebootConfirmCancel = document.getElementById("rebootConfirmCancel");
      el.rebootConfirmTitle = document.getElementById("rebootConfirmTitle");
      el.rebootConfirmText = document.getElementById("rebootConfirmText");
      el.rebootConfirmActions = document.getElementById("rebootConfirmActions");
      el.missionOverlay = document.getElementById("missionOverlay");
      el.missionDialog = document.getElementById("missionDialog");
      el.inspectionDialog = document.getElementById("inspectionDialog");
      el.missionClose = document.getElementById("missionClose");
      el.missionCloseBtn = document.getElementById("missionCloseBtn");
      el.missionConfirmBtn = document.getElementById("missionConfirmBtn");
      el.missionExportBtn = document.getElementById("missionExportBtn");
      el.missionImportInput = document.getElementById("missionImportInput");
      el.missionSaveBoardBtn = document.getElementById("missionSaveBoardBtn");
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
      el.missionBlockEditor = document.getElementById("missionBlockEditor");
      el.missionBlockPalette = document.getElementById("missionBlockPalette");
      el.missionBlockCanvas = document.getElementById("missionBlockCanvas");
      el.missionBlockCount = document.getElementById("missionBlockCount");
      el.missionCanvasZoomOut = document.getElementById("missionCanvasZoomOut");
      el.missionCanvasZoomIn = document.getElementById("missionCanvasZoomIn");
      el.missionCanvasZoomReset = document.getElementById("missionCanvasZoomReset");
      el.missionBlockList = document.getElementById("missionBlockList");
      el.missionBlockStage = document.getElementById("missionBlockStage");
      el.missionBlockAddServoBtn = document.getElementById("missionBlockAddServoBtn");
      el.missionBlockAddPyroBtn = document.getElementById("missionBlockAddPyroBtn");
      el.missionBlockClearBtn = document.getElementById("missionBlockClearBtn");
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
      el.quickDataDigitsSelect = document.getElementById("quickDataDigitsSelect");
      el.loadcellChartDigitsSelect = document.getElementById("loadcellChartDigitsSelect");
      el.storageExportDigitsSelect = document.getElementById("storageExportDigitsSelect");
      el.ignTimeInput = document.getElementById("ignTimeInput");
      el.countdownSecInput = document.getElementById("countdownSecInput");
      el.daqSequencePyroSelect = document.getElementById("daqSequencePyroSelect");
      el.ignTimeSave = document.getElementById("ignTimeSave");
      el.countdownSave = document.getElementById("countdownSave");
      el.opModeSelect = document.getElementById("opModeSelect");
      el.gyro3dViewport = document.getElementById("gyro3dViewport");
      el.gyro3dMapCloseBtn = document.getElementById("gyro3dMapCloseBtn");
      el.gyro3dExpandBtn = document.getElementById("gyro3dExpandBtn");
      el.gyroGlPreview = document.getElementById("gyroGlPreview");
      el.navBallPreview = document.getElementById("navBallPreview");
      el.gyroPreviewSelect = document.getElementById("gyroPreviewSelect");
      el.mobileHudPreviewToggle = document.getElementById("mobileHudPreviewToggle");
      el.mobileFullscreenToggle = document.getElementById("mobileFullscreenToggle");
      el.gyroGl = el.gyroGlPreview || el.gyroGlHidden;
      if(el.navBallPreview) el.navBall = el.navBallPreview;

      buildMotorPresetInfo();
      renderMissionBlocksEditor(missionBlocksState);
      setMissionPresetSelectionUi(selectedMotorName || (el.missionName && el.missionName.value) || "");
      initGyroGl();

      el.relaySafeToggle = document.getElementById("relaySafeToggle");
      el.igswitch = document.getElementById("igswitch");
      el.safeModeToggle = document.getElementById("safeModeToggle");
      el.armLockToggle = document.getElementById("armLockToggle");
      el.serialToggle = document.getElementById("serialToggle");
      el.safeModePill = document.getElementById("safeModePill");
      el.armLockPill = document.getElementById("armLockPill");
      el.serialTogglePill = document.getElementById("serialTogglePill");
      el.serialControlTile = document.getElementById("serialControlTile");
      el.safetyModeTile = document.getElementById("safetyModeTile");
      el.armLockTile = document.getElementById("armLockTile");
      el.serialControlTitle = document.getElementById("serialControlTitle");
      el.serialControlSub = document.getElementById("serialControlSub");
      el.controlsCard = document.getElementById("controlsCard");
      el.tabletControlsFab = document.getElementById("tabletControlsFab");
      el.tabletControlsClose = document.getElementById("tabletControlsClose");
      el.controlsCardTitle = document.getElementById("controlsCardTitle");
      el.controlsHeader = document.getElementById("controlsHeader");
      el.controlsMain = document.getElementById("controlsMain");
      el.launcherPanel = document.getElementById("launcherPanel");
      el.missionPanel = document.getElementById("missionPanel");
      el.inspectionPanel = document.getElementById("inspectionPanel");
      el.missionPanelMount = document.getElementById("missionPanelMount");
      el.inspectionPanelMount = document.getElementById("inspectionPanelMount");
      el.mobileLauncherPanel = document.getElementById("mobileLauncherPanel");
      el.mobileMissionPanel = document.getElementById("mobileMissionPanel");
      el.mobileInspectionPanel = document.getElementById("mobileInspectionPanel");
      el.mobileMissionPanelMount = document.getElementById("mobileMissionPanelMount");
      el.mobileInspectionPanelMount = document.getElementById("mobileInspectionPanelMount");
      el.launcherPitchAngleTablet = document.getElementById("launcherPitchAngleTablet");
      el.replayOpenBtns = document.querySelectorAll(".js-replay-open");
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
      el.devParachuteBtn = document.getElementById("devParachuteBtn");
      el.serialRxToggle = document.getElementById("serialRxToggle");
      el.serialTxToggle = document.getElementById("serialTxToggle");
      el.simToggle = document.getElementById("simToggle");
      el.serialStatus = document.getElementById("serialStatus");
      el.serialStatusText = document.getElementById("serialStatusText");
      el.hwBoardName = document.getElementById("hwBoardName");
      el.hwFirmwareName = document.getElementById("hwFirmwareName");
      el.hwProtocolName = document.getElementById("hwProtocolName");
      el.spiFlashStatusLine = document.getElementById("spiFlashStatusLine");
      el.spiFlashRefreshBtn = document.getElementById("spiFlashRefreshBtn");
      el.spiFlashInitBtn = document.getElementById("spiFlashInitBtn");
      el.spiFlashDumpBtn = document.getElementById("spiFlashDumpBtn");
      el.wifiMode = document.getElementById("wifiMode");
      el.wifiSsid = document.getElementById("wifiSsid");
      el.wifiChannel = document.getElementById("wifiChannel");
      el.wifiBandwidth = document.getElementById("wifiBandwidth");
      el.wifiTxPower = document.getElementById("wifiTxPower");
      el.wifiIp = document.getElementById("wifiIp");
      el.wifiStaCount = document.getElementById("wifiStaCount");
      el.wifiRssi = document.getElementById("wifiRssi");
      el.launcherPitchAngle = document.getElementById("launcherPitchAngle");
      el.launcherPitchAngleMobile = document.getElementById("launcherPitchAngleMobile");
      el.langSelect = document.getElementById("langSelect");
      el.themeToggle = document.getElementById("themeToggle");
      el.loadcellCalOpen = document.getElementById("loadcellCalOpen");
      el.loadcellResetBtn = document.getElementById("loadcellResetBtn");
      el.loadcellOverlay = document.getElementById("loadcellOverlay");
      el.loadcellDialog = document.getElementById("loadcellDialog");
      el.loadcellClose = document.getElementById("loadcellClose");
      el.loadcellCancel = document.getElementById("loadcellCancelBtn");
      el.loadcellZero = document.getElementById("loadcellZeroBtn");
      el.loadcellApply = document.getElementById("loadcellApplyBtn");
      el.loadcellWeightInput = document.getElementById("loadcellWeightInput");
      el.loadcellGuide = document.getElementById("loadcellGuide");
      el.loadcellLiveValue = document.getElementById("loadcellLiveValue");
      el.loadcellCompleteTitle = document.getElementById("loadcellCompleteTitle");
      el.loadcellCompleteText = document.getElementById("loadcellCompleteText");
      el.loadcellWarningText = document.getElementById("loadcellWarningText");
      el.loadcellWarningTitle = document.getElementById("loadcellWarningTitle");
      el.loadcellWarningSub = document.getElementById("loadcellWarningSub");
      el.loadcellWarningProceed = document.getElementById("loadcellWarningProceed");
      el.loadcellWarningCancel = document.getElementById("loadcellWarningCancel");
      el.missionRequiredOverlay = document.getElementById("missionRequiredOverlay");
      el.missionRequiredOk = document.getElementById("missionRequiredOk");
      el.inspectionWarnOverlay = document.getElementById("inspectionWarnOverlay");
      el.inspectionWarnOk = document.getElementById("inspectionWarnOk");
      el.inspectionWarnText = document.getElementById("inspectionWarnText");
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
      el.inspectionPanelResults = document.querySelectorAll("[data-inspection-panel-result]");
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
      el.tabletAbortBtn = document.getElementById("tabletAbortBtn");
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

      if(el.replayOpenBtns && el.replayOpenBtns.length){
        el.replayOpenBtns.forEach(btn=>{
          btn.addEventListener("click",()=>{
            if(replayUiActive) return;
            ensureDashboardViewForPanels();
            enterReplayMode();
          });
        });
      }
      const loadReplayFile = async (file)=>{
        if(!file) return;
        setReplayStatus("Replay 파일 자동 분석 중... (XLSX/CSV/BIN)");
        if(el.replayFileBtn) el.replayFileBtn.classList.remove("is-dragover");
        try{
          const parsed = await parseReplayFileAuto(file);
          const samples = parsed.samples;
          pauseReplayPlayback({silent:true});
          setActiveDataSource(DATA_SOURCE_LIVE);
          replayState.samples = samples;
          replayState.fileName = file.name;
          replayState.index = 0;
          replayState.lastIndex = -1;
          updateReplayModeUi();
          setReplayStatus("");
          showToast(
            "리플레이 파일 로딩 완료 (" + parsed.parserLabel + "): " + samples.length + " samples",
            "success",
            {key:"replay-load"}
          );
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

      if(el.spiFlashRefreshBtn){
        el.spiFlashRefreshBtn.addEventListener("click", ()=>{ fetchSpiFlashStatus(); });
      }
      if(el.spiFlashInitBtn){
        el.spiFlashInitBtn.addEventListener("click", ()=>{ resetSpiFlashStorage(); });
      }
      if(el.spiFlashDumpBtn){
        el.spiFlashDumpBtn.addEventListener("click", ()=>{ downloadSpiFlashDump(); });
      }
      ensureLocalSdToolsUi();
      bindLocalSdToolsUiEvents();
      fetchSpiFlashStatus();
      setInterval(()=>{
        if(!el.hardwareView || el.hardwareView.classList.contains("hidden")) return;
        ensureLocalSdToolsUi();
        bindLocalSdToolsUiEvents();
      }, 2000);

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
      if(el.devParachuteBtn){
        bindTap(el.devParachuteBtn, ()=>{
          devParachuteDrop = !devParachuteDrop;
          resetSimState();
          resetGyroPathTracking();
          if(simEnabled){
            onIncomingSample(buildSimSample(), "SIMULATION");
          }
          updateDevToolsUI();
          showToast(devParachuteDrop ? t("devParachuteOnToast") : t("devParachuteOffToast"), "info", {key:"dev-parachute-toggle"});
        });
      }

      loadSettings();
      applySettingsToUI();
      refreshPrecisionSensitiveUi();
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
      const launcherUpPanelBtn=document.getElementById("launcherUpPanelBtn");
      const launcherDownPanelBtn=document.getElementById("launcherDownPanelBtn");
      const launcherAutoPanelBtn=document.getElementById("launcherAutoPanelBtn");
      const launcherUpMobileBtn=document.getElementById("launcherUpMobileBtn");
      const launcherDownMobileBtn=document.getElementById("launcherDownMobileBtn");
      const launcherAutoMobileBtn=document.getElementById("launcherAutoMobileBtn");
      const mobileLauncherBackBtn=document.getElementById("mobileLauncherBackBtn");
      const mobileMissionBackBtn=document.getElementById("mobileMissionBackBtn");
      const mobileInspectionBackBtn=document.getElementById("mobileInspectionBackBtn");
      launcherAutoOverlayEl = el.launcherAutoOverlay || document.getElementById("launcherAutoOverlay");
      launcherAutoConfirmBtn = el.launcherAutoConfirm || document.getElementById("launcherAutoConfirm");
      launcherAutoCancelBtn = el.launcherAutoCancel || document.getElementById("launcherAutoCancel");
      rebootConfirmOverlayEl = el.rebootConfirmOverlay || document.getElementById("rebootConfirmOverlay");
      rebootConfirmBtnEl = el.rebootConfirmBtn || document.getElementById("rebootConfirmBtn");
      rebootConfirmCancelBtnEl = el.rebootConfirmCancel || document.getElementById("rebootConfirmCancel");
      rebootConfirmTitleEl = el.rebootConfirmTitle || document.getElementById("rebootConfirmTitle");
      rebootConfirmTextEl = el.rebootConfirmText || document.getElementById("rebootConfirmText");
      rebootConfirmActionsEl = el.rebootConfirmActions || document.getElementById("rebootConfirmActions");
      updateRebootConfirmUi();
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
              resetSimState();
              resetGyroPathTracking();
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
      if(el.armLockToggle){
        el.armLockToggle.addEventListener("change",()=>{
          const armLockEnabled = !!el.armLockToggle.checked;
          uiSettings.armLock = armLockEnabled;
          saveSettings();
          updateTogglePill(el.armLockPill, armLockEnabled);
          sendCommand({http:"/set?arm_lock="+(armLockEnabled?1:0), ser:"ARMLOCK "+(armLockEnabled?1:0)}, true);
          showToast(
            armLockEnabled ? "ARM ON LOCK 켜짐 (스위치 무시)" : "ARM ON LOCK 해제 (스위치 따름)",
            armLockEnabled ? "warn" : "info",
            {key:"arm-lock-toggle", keep:true, duration:4500}
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
      if(el.armLockPill && el.armLockToggle){
        el.armLockPill.addEventListener("click",()=>{
          el.armLockToggle.checked = !el.armLockToggle.checked;
          el.armLockToggle.dispatchEvent(new Event("change", {bubbles:true}));
        });
      }
      if(el.armLockTile && el.armLockToggle){
        el.armLockTile.addEventListener("click",(ev)=>{
          if(ev.target && ev.target.closest(".pill-toggle")) return;
          el.armLockToggle.checked = !el.armLockToggle.checked;
          el.armLockToggle.dispatchEvent(new Event("change", {bubbles:true}));
        });
        el.armLockTile.addEventListener("keydown",(ev)=>{
          if(ev.key !== "Enter" && ev.key !== " ") return;
          if(ev.target && ev.target.closest(".pill-toggle")) return;
          ev.preventDefault();
          el.armLockToggle.checked = !el.armLockToggle.checked;
          el.armLockToggle.dispatchEvent(new Event("change", {bubbles:true}));
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
            if(!hasSequenceMissionRequirement()){
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
            if(el.countdown) el.countdown.textContent = "T- --:--:--";
            if(el.countdownMobile) el.countdownMobile.textContent = "T- --:--:--";
            if(el.countdownBig) el.countdownBig.textContent = "T- --:--:--";
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
      if(el.inspectionWarnOk){
        el.inspectionWarnOk.addEventListener("click", ()=>hideInspectionWarning());
      }
      if(el.inspectionWarnOverlay){
        el.inspectionWarnOverlay.addEventListener("click",(ev)=>{
          if(ev.target===el.inspectionWarnOverlay) hideInspectionWarning();
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
            ensureDashboardViewForPanels();
            setLauncherPanelVisible(false);
            setMissionPanelVisible(false);
            setInspectionPanelVisible(false);
            if(replayUiActive){
              exitReplayMode();
            }
            if(isMobileLayout() && el.mobileControlsPanel){
              showMobileControlsPanel();
              return;
            }
            if(isTabletControlsLayout()){
              showTabletControlsPanel();
              return;
            }
            showControlsModal();
          });
        });
      }
      if(el.tabletControlsFab){
        el.tabletControlsFab.addEventListener("click",(ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          toggleTabletControlsPanel();
        });
      }
      if(el.tabletControlsClose){
        el.tabletControlsClose.addEventListener("click",(ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          if(isTabletControlsLayout()){
            hideTabletControlsPanel();
            return;
          }
          if(replayUiActive){
            exitReplayMode();
            return;
          }
          if(launcherPanelActive){
            hideLauncher();
            return;
          }
          if(missionPanelActive){
            hideMission();
            return;
          }
          if(inspectionPanelActive){
            hideInspection();
            return;
          }
          if(el.controlsCard && el.controlsCard.classList.contains("devtools-mode")){
            setDevToolsVisible(false);
          }
        });
      }
      if(el.controlsCard){
        el.controlsCard.addEventListener("click",(ev)=>{
          if(!isTabletControlsLayout()) return;
          if(!el.controlsCard.classList.contains("tablet-collapsed")) return;
          ev.preventDefault();
          showTabletControlsPanel();
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
      document.addEventListener("keydown",(ev)=>{
        if(ev.key === "Escape" && tabletControlsOpen && isTabletControlsLayout()){
          hideTabletControlsPanel();
        }
      });
      applyTabletControlsLayout();
      applyPhoneLandscapeLayout();
      updateNavActionState();
      if(el.mobileAbortBtn){
        el.mobileAbortBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          if(el.abortBtn && !el.abortBtn.disabled){
            el.abortBtn.click();
          }
        });
      }
      if(el.tabletAbortBtn){
        el.tabletAbortBtn.addEventListener("click",(ev)=>{
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
          const exportDigits = getStorageExportDigits();
          const exportMetric = (value)=>{
            const rounded = roundFixedNumber(value, exportDigits);
            return rounded == null ? "" : rounded;
          };
          const exportMetricText = (value)=>{
            const rounded = roundFixedNumber(value, exportDigits);
            return rounded == null ? "-" : rounded;
          };

          const hasIgnitionWindow =
            ignitionAnalysis.hasData &&
            ignitionAnalysis.ignStartMs!=null &&
            ignitionAnalysis.thresholdMs!=null &&
            ignitionAnalysis.lastAboveMs!=null;

          const windowStartMs = hasIgnitionWindow ? (ignitionAnalysis.thresholdMs - IGN_PRE_WINDOW_MS) : null;
          const windowEndMs   = hasIgnitionWindow ? (ignitionAnalysis.lastAboveMs + IGN_POST_WINDOW_MS) : null;

          const delayRounded = roundFixedNumber(ignitionAnalysis.delaySec, exportDigits);
          const durRounded = roundFixedNumber(ignitionAnalysis.durationSec, exportDigits);

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
              delayRounded != null ? delayRounded : "",
              durRounded != null ? durRounded : "",
              exportMetric(IGN_THRUST_THRESHOLD),
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
            t("hdrGpsLat"), t("hdrGpsLon"), t("hdrGpsAlt"),
            t("hdrAltitudeM"), t("hdrSpeedMps"),
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
                exportMetric(tVal),
                exportMetric(tNVal),
                exportMetric(pVal),
                xLabel
              ]);
            }
            rawRows.push([
              row.time || "",
              exportMetric(tVal),
              exportMetric(tNVal),
              exportMetric(pVal),
              (row.gps_lat != null && isFinite(Number(row.gps_lat))) ? Number(Number(row.gps_lat).toFixed(7)) : "",
              (row.gps_lon != null && isFinite(Number(row.gps_lon))) ? Number(Number(row.gps_lon).toFixed(7)) : "",
              (row.gps_alt != null && isFinite(Number(row.gps_alt))) ? Number(Number(row.gps_alt).toFixed(2)) : "",
              (row.alt_m != null && isFinite(Number(row.alt_m))) ? Number(Number(row.alt_m).toFixed(2)) : "",
              (row.speed_mps != null && isFinite(Number(row.speed_mps))) ? Number(Number(row.speed_mps).toFixed(2)) : "",
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
          summaryRows[1][6] = exportMetric(avgThrustVal);
          summaryRows[1][7] = exportMetric((isFinite(thrustMax) && thrustMax !== -Infinity) ? thrustMax : null);
          summaryRows[1][8] = exportMetric(avgThrustNVal);
          summaryRows[1][9] = exportMetric((isFinite(thrustNMax) && thrustNMax !== -Infinity) ? thrustNMax : null);
          summaryRows[1][10] = exportMetric(avgPressureVal);
          summaryRows[1][11] = exportMetric((isFinite(pressureMax) && pressureMax !== -Infinity) ? pressureMax : null);

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
            {cells:["최대 추력 (kgf): " + exportMetricText((isFinite(thrustMax) && thrustMax !== -Infinity) ? thrustMax : null)], style:3},
            {cells:["평균 추력 (kgf): " + exportMetricText(avgThrustVal)], style:3},
            {cells:["최대 압력 (MPa): " + exportMetricText((isFinite(pressureMax) && pressureMax !== -Infinity) ? pressureMax : null)], style:3},
            {cells:["평균 압력 (MPa): " + exportMetricText(avgPressureVal)], style:3},
            {cells:["점화 지연 (s): " + exportMetricText(delayRounded)], style:3},
            {cells:["연소 시간 (s): " + exportMetricText(durRounded)], style:3},
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
          }, {valueDigits:exportDigits});
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
        closeIgnitionModals();
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
        const isMission = lower === "mission";
        const isControl = lower === "control";
        const isDashboard = !isHome && !isTerminal && !isHardware && !isGyro && !isCountdown && !isMission && !isControl;
        if(!isDashboard && isStatusMapViewportExpanded()){
          setStatusMapViewportExpanded(false);
        }
        if(!isDashboard && isGyroViewportExpanded()){
          setGyroViewportExpanded(false);
        }
        if(el.pageKicker){
          const name = el.hwBoardName?.textContent?.trim();
          setBoardNameDisplay(el.pageKicker, name, "FLASH6");
          el.pageKicker.classList.remove("hidden");
        }
        if(el.homeView) el.homeView.classList.toggle("hidden", !isHome);
        if(el.dashboardView) el.dashboardView.classList.toggle("hidden", !isDashboard);
        if(el.terminalView) el.terminalView.classList.toggle("hidden", !isTerminal);
        if(el.hardwareView) el.hardwareView.classList.toggle("hidden", !isHardware);
        if(el.missionView) el.missionView.classList.toggle("hidden", !isMission);
        if(el.gyroView) el.gyroView.classList.toggle("hidden", !isGyro);
        if(el.countdownView) el.countdownView.classList.toggle("hidden", !isCountdown);
        if(el.controlPanelView) el.controlPanelView.classList.toggle("hidden", !isControl);
        if(el.countdownHeader) el.countdownHeader.classList.toggle("hidden", isCountdown);
        if(isMission){
          setOverlayVisible(el.missionOverlay, false);
          if(el.missionDialog && el.missionViewMount){
            mountDialogToPanel(el.missionDialog, el.missionViewMount, missionDialogDockState);
            openMissionCustomEditor();
            updateMissionEditLockUI();
          }
        }else if(el.missionDialog && el.missionViewMount && el.missionDialog.parentNode === el.missionViewMount){
          restoreDialogFromPanel(el.missionDialog, missionDialogDockState);
        }
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
          else if(isMission) label = "MISSION";
          el.countdownLabel.textContent = label;
        }
        document.body.classList.toggle("countdown-view-active", isCountdown);
        document.body.classList.toggle("dashboard-view-active", isDashboard);
        document.body.classList.toggle("home-view-active", isHome);
        if(isHome) updateHomeUI();
        if(isDashboard){
          syncChartHeightToControls(0);
          scheduleStatusMapRefresh();
        }
        if(isHardware){
          ensureLocalSdToolsUi();
          bindLocalSdToolsUiEvents();
          fetchSpiFlashStatus();
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
      const ensureDashboardViewForPanels = ()=>{
        const active = Array.from(sideNavItems).find(item=>item.classList.contains("active"));
        const activeTitle = (active && (active.dataset.pageTitle || active.textContent || "").trim().toLowerCase()) || "";
        if(activeTitle === "dashboard") return;
        activateNavItem("Dashboard");
      };
      if(el.sidebarSettingsBtns && el.sidebarSettingsBtns.length){
        el.sidebarSettingsBtns.forEach(btn=>{
          btn.addEventListener("pointerdown",(ev)=>{
            ev.stopPropagation();
          });
          btn.addEventListener("click",(ev)=>{
            ev.preventDefault();
            ev.stopPropagation();
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
          applyPhoneLandscapeLayout();
          resizeGyroGl();
          if(gyroGl) renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          refreshStatusMapSize();
        });
        const active = Array.from(sideNavItems).find(item=>item.classList.contains("active"));
        setActiveView(active ? (active.dataset.pageTitle || active.textContent.trim()) : "Dashboard");
      }
      if(el.settingsClose) el.settingsClose.addEventListener("click",()=>hideSettings());
      if(el.settingsOverlay){
        el.settingsOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.settingsOverlay) hideSettings(); });
      }
      if(el.gyroZeroBtn){
        el.gyroZeroBtn.addEventListener("click", ()=>{
          if(!applyGyroZeroReference()){
            showToast(t("gyroZeroUnavailableToast"), "warn");
            return;
          }
          showToast(t("gyroZeroDoneToast"), "success");
          renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderNavBall(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderGyroPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderNavBallPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        });
      }
      if(el.missionOpenBtn) el.missionOpenBtn.addEventListener("click",()=>showMission());
      if(el.rebootBoardBtn){
        el.rebootBoardBtn.addEventListener("click",()=>{
          showRebootConfirm();
        });
      }
      if(el.missionViewOpenBtn) el.missionViewOpenBtn.addEventListener("click",()=>showMission());
      if(el.missionClose) el.missionClose.addEventListener("click",()=>hideMission());
      if(el.missionCloseBtn){
        el.missionCloseBtn.addEventListener("click",()=>{
          hideMission();
        });
      }
      if(el.missionOverlay){
        el.missionOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.missionOverlay) hideMission(); });
      }
      window.flash6OpenMission = ()=>{ showMission(); };
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
      if(el.homeFlyCardBtn){
        el.homeFlyCardBtn.addEventListener("click",()=>{
          activateNavItem("Dashboard");
          setTimeout(()=>{
            setStatusMapViewportExpanded(true);
            scheduleStatusMapRefresh();
          }, 60);
        });
      }
      if(el.homeDataExtractBtn){
        el.homeDataExtractBtn.addEventListener("click",()=>{
          if(el.exportCsvBtn){
            el.exportCsvBtn.click();
            return;
          }
          showToast("데이터 추출 버튼을 찾을 수 없습니다.", "warn");
        });
      }
      if(el.homeFindSoundBtn){
        el.homeFindSoundBtn.addEventListener("click",()=>{
          playBeepPattern([
            {freq:880, dur:120, gap:60},
            {freq:1046, dur:120, gap:60},
            {freq:1318, dur:160, gap:60},
            {freq:1568, dur:220, gap:0}
          ]);
          showToast("Find Sound 재생", "info", {duration:1200});
        });
      }
      if(el.missionBackBtn){
        el.missionBackBtn.addEventListener("click",()=>{
          resetMissionToPresetList();
        });
      }
      if(el.missionExportBtn){
        el.missionExportBtn.addEventListener("click",()=>{
          downloadMissionProfileJson();
        });
      }
      if(el.missionImportInput){
        el.missionImportInput.addEventListener("change",(ev)=>{
          const file = ev && ev.target && ev.target.files ? ev.target.files[0] : null;
          importMissionProfileFromFile(file);
        });
      }
      if(el.missionSaveBoardBtn){
        el.missionSaveBoardBtn.addEventListener("click",(ev)=>{
          if(ev){
            ev.preventDefault();
            ev.stopPropagation();
          }
          saveMissionProfileToBoard();
        });
      }
      if(el.missionBlockAddServoBtn){
        el.missionBlockAddServoBtn.addEventListener("click",()=>{
          addMissionBlock("act_servo");
        });
      }
      if(el.missionBlockAddPyroBtn){
        el.missionBlockAddPyroBtn.addEventListener("click",()=>{
          addMissionBlock("act_pyro");
        });
      }
      if(el.missionBlockClearBtn){
        el.missionBlockClearBtn.addEventListener("click",()=>{
          clearMissionBlocks();
        });
      }
      if(el.missionBlockPalette){
        const paletteBtns = el.missionBlockPalette.querySelectorAll("[data-add-kind]");
        paletteBtns.forEach((btn)=>{
          const kind = String(btn.getAttribute("data-add-kind") || "");
          if(!isMissionPaletteKind(kind)) return;
          btn.addEventListener("click",()=>{
            addMissionBlock(kind);
          });
          btn.addEventListener("dragstart",(ev)=>{
            if(!isMissionEditableNow()){
              ev.preventDefault();
              return;
            }
            if(ev.dataTransfer){
              ev.dataTransfer.effectAllowed = "copyMove";
              ev.dataTransfer.setData("text/x-mission-palette-kind", kind);
              ev.dataTransfer.setData("text/plain", "palette:" + kind);
              if(ev.dataTransfer.setDragImage){
                const ghost = btn.cloneNode(true);
                ghost.style.position = "fixed";
                ghost.style.left = "-10000px";
                ghost.style.top = "-10000px";
                ghost.style.width = Math.max(180, Math.round(btn.getBoundingClientRect().width)) + "px";
                ghost.style.pointerEvents = "none";
                ghost.style.transform = "translateZ(0)";
                ghost.classList.add("is-dragging");
                document.body.appendChild(ghost);
                btn._missionDragGhost = ghost;
                ev.dataTransfer.setDragImage(ghost, 24, 16);
              }
            }
            if(el.missionBlockList) el.missionBlockList.classList.add("is-dragging");
            if(el.missionBlockCanvas) el.missionBlockCanvas.classList.add("drop-active");
          });
          btn.addEventListener("dragend",()=>{
            clearMissionBranchDropActive();
            stopMissionDragAutoScroll();
            if(el.missionBlockList) el.missionBlockList.classList.remove("is-dragging");
            if(btn._missionDragGhost && btn._missionDragGhost.parentNode){
              btn._missionDragGhost.parentNode.removeChild(btn._missionDragGhost);
            }
            btn._missionDragGhost = null;
            if(el.missionBlockCanvas) el.missionBlockCanvas.classList.remove("drop-active");
          });
        });
      }
      if(el.missionBlockCanvas){
        el.missionBlockCanvas.addEventListener("dragover",(ev)=>{
          if(!isMissionEditableNow()) return;
          const paletteKind = missionPaletteKindFromTransfer(ev);
          const idx = missionDragIndexFromTransfer(ev);
          if(!paletteKind && idx == null) return;
          missionUpdateDragAutoScroll(ev.clientY);
          const branchTarget = missionResolveBranchDropTarget(ev, missionCanSnapToBranchFromEvent(ev));
          missionSetBranchDropActive(branchTarget);
          ev.preventDefault();
          el.missionBlockCanvas.classList.add("drop-active");
        });
        el.missionBlockCanvas.addEventListener("dragleave",(ev)=>{
          const related = ev.relatedTarget;
          if(related && el.missionBlockCanvas.contains(related)) return;
          clearMissionBranchDropActive();
          stopMissionDragAutoScroll();
          el.missionBlockCanvas.classList.remove("drop-active");
        });
        el.missionBlockCanvas.addEventListener("drop",(ev)=>{
          if(!isMissionEditableNow()) return;
          stopMissionDragAutoScroll();
          const rowTarget = ev.target && ev.target.closest ? ev.target.closest(".mission-block-row") : null;
          if(rowTarget) return;
          const branchTarget = missionResolveBranchDropTarget(ev, missionCanSnapToBranchFromEvent(ev));
          ev.preventDefault();
          clearMissionBranchDropActive();
          el.missionBlockCanvas.classList.remove("drop-active");
          const current = buildMissionBlocksFromUi();
          if(branchTarget){
            let targetIdx = missionBranchInsertIndexFromTarget(branchTarget, current.length);
            const parentCondIdx = parseInt(String(branchTarget.getAttribute("data-cond-index") || ""), 10);
            const nestedLevel = normalizeMissionLevel(missionRowLevelFromIndex(parentCondIdx) + 1);
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
      const mobileControlActions = {
        sequence: ()=>{ if(el.igniteBtn) el.igniteBtn.click(); },
        serial: ()=>{ toggleInput(el.serialToggle); },
        inspection: ()=>{ if(el.inspectionOpenBtn) el.inspectionOpenBtn.click(); },
        safety: ()=>{ toggleInput(el.safeModeToggle); },
        launcher: ()=>{ ensureDashboardViewForPanels(); showLauncher(); },
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
            if(type === "export" ||
              (type === "mission" && !isPhoneLandscapeLayout())){
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
      const assignMissionQuick = (name, options)=>{
        const opts = (options && typeof options === "object") ? options : {};
        const missionName = String(name || "").trim();
        if(!missionName) return;
        if(missionName === "motor-support"){
          showToast("모터 추가는 ybb1833@naver.com 으로 문의해주세요.", "info", {key:"mission-motor-support"});
          setMissionPresetSelectionUi("");
          return;
        }
        if(el.missionName){
          el.missionName.value = missionName === "no-motor" ? "" : missionName;
        }
        if(missionName === "no-motor"){
          selectedMotorName = "no-motor";
          if(el.missionMotorDia) el.missionMotorDia.value = "";
          if(el.missionMotorLen) el.missionMotorLen.value = "";
          if(el.missionIgnDelay) el.missionIgnDelay.value = "";
          if(el.missionGrainMass) el.missionGrainMass.value = "";
          if(el.missionTotalMass) el.missionTotalMass.value = "";
          if(el.missionVendor) el.missionVendor.value = "";
        }else{
          selectedMotorName = missionName;
          applyMotorSpec(missionName);
        }
        setMissionPresetSelectionUi(selectedMotorName || missionName);
        if(el.missionTestCount && (!el.missionTestCount.value || !el.missionTestCount.value.trim())){
          el.missionTestCount.value = "1";
        }
        reportExportedRevision = 0;
        reportExportedOnce = false;
        updateExportGuardUi();
        updateMotorInfoPanel();
        updateExportButtonState();
        resetMissionToPresetList();
        if(opts.keepMissionOpen !== true){
          if(isMobileMissionPanelVisible()) setMobileMissionPanelVisible(false);
          if(missionPanelActive) setMissionPanelVisible(false);
        }
        const label = missionName === "no-motor" ? "메타데이터 없음" : missionName;
        if(opts.showToast !== false){
          showToast("미션 지정: " + label, "success", {key:"mission-set"});
        }
      };
      const missionQuickButtons = document.querySelectorAll("[data-mission-quick]");
      if(missionQuickButtons.length){
        missionQuickButtons.forEach(btn=>{
          btn.addEventListener("click", ()=>{
            const missionName = btn.getAttribute("data-mission-quick");
            assignMissionQuick(missionName);
          });
        });
      }
      const inspectionPanelActionButtons = document.querySelectorAll("[data-inspection-action]");
      if(inspectionPanelActionButtons.length){
        inspectionPanelActionButtons.forEach(btn=>{
          btn.addEventListener("click", ()=>{
            const action = (btn.getAttribute("data-inspection-action") || "").trim();
            if(action === "run" || action === "retry"){
              resetInspectionUI();
              runInspectionSequence();
              return;
            }
            if(action === "close"){
              if(isMobileInspectionPanelVisible()) setMobileInspectionPanelVisible(false);
              if(inspectionPanelActive) setInspectionPanelVisible(false);
            }
          });
        });
      }
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
            const missionName = String(btn.getAttribute("data-mission") || "").trim();
            if(missionName){
              assignMissionQuick(missionName, {keepMissionOpen:true, showToast:false});
              const label = missionName === "no-motor" ? "메타데이터 없음" : missionName;
              showToast("프리셋 적용: " + label, "success", {key:"mission-preset-apply"});
              return;
            }
            if(btn.id === "missionCustomBtn"){
              selectedMotorName = sanitizeMissionName(el.missionName && el.missionName.value) || "CUSTOM";
              setMissionPresetSelectionUi("");
            }
          });
        });
      }
      const missionMetaInputs = [
        el.missionName,
        el.missionMotorDia,
        el.missionMotorLen,
        el.missionIgnDelay,
        el.missionGrainMass,
        el.missionTotalMass,
        el.missionVendor
      ].filter(Boolean);
      missionMetaInputs.forEach((node)=>{
        node.addEventListener("input",()=>{
          const preset = sanitizeMissionName(selectedMotorName).toLowerCase();
          if(!preset || preset === "no-motor" || !motorSpecs[selectedMotorName]) return;
          selectedMotorName = sanitizeMissionName(el.missionName && el.missionName.value) || "CUSTOM";
          setMissionPresetSelectionUi("");
          updateExportButtonState();
          updateMotorInfoPanel();
        });
      });

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
            if(el.missionPresetBlock) el.missionPresetBlock.classList.remove("hidden");
            if(el.missionDialog) el.missionDialog.classList.remove("custom-mode");
            selectedMotorName = sanitizeMissionName(el.missionName && el.missionName.value) || "CUSTOM";
            setMissionPresetSelectionUi("");
            setMissionCloseLabel(false);
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
      const servoRows = document.querySelectorAll(".hardware-servo-row[data-servo-channel]");
      if(servoRows && servoRows.length){
        servoRows.forEach(row=>{
          const ch = Number(row.getAttribute("data-servo-channel"));
          if(!isFinite(ch) || SERVO_CHANNELS.indexOf(ch) < 0) return;
          const range = row.querySelector("[data-servo-range]");
          const value = row.querySelector("[data-servo-value]");
          const pin = row.querySelector("[data-servo-pin]");
          const applyBtn = row.querySelector("[data-servo-apply]");
          const centerBtn = row.querySelector("[data-servo-center]");
          servoUiMap[ch] = {
            range,
            value,
            pin,
            applyBtn,
            centerBtn,
            autoTimer:null,
            lastAppliedDeg:SERVO_DEFAULT_DEG
          };
          setServoUiPin(ch, null);
          setServoUiAngle(ch, SERVO_DEFAULT_DEG);

          if(range){
            range.addEventListener("input", ()=>{
              setServoUiAngle(ch, range.value);
              scheduleServoAutoApply(ch, SERVO_AUTO_APPLY_DELAY_MS);
            });
            range.addEventListener("change", ()=>{
              applyServoAngle(ch, { showFeedback:true, logIt:true, force:true });
            });
          }
          if(applyBtn){
            applyBtn.addEventListener("click", ()=>{
              applyServoAngle(ch, { showFeedback:true, logIt:true, force:true });
            });
          }
          if(centerBtn){
            centerBtn.addEventListener("click", ()=>{
              setServoUiAngle(ch, SERVO_DEFAULT_DEG);
              applyServoAngle(ch, { showFeedback:true, logIt:true, force:true });
            });
          }
          const presetApplyBtns = row.querySelectorAll("[data-servo-preset-apply]");
          if(presetApplyBtns && presetApplyBtns.length){
            presetApplyBtns.forEach(btn=>{
              const slot = btn.getAttribute("data-servo-preset-apply");
              const input = row.querySelector("[data-servo-preset-input=\"" + slot + "\"]");
              const applyPreset = ()=>{
                if(!input) return;
                const deg = clampServoAngle(input.value);
                input.value = String(deg);
                setServoUiAngle(ch, deg);
                applyServoAngle(ch, { showFeedback:true, logIt:true, force:true });
              };
              btn.addEventListener("click", applyPreset);
              if(input){
                input.addEventListener("keydown",(ev)=>{
                  if(ev.key === "Enter"){
                    ev.preventDefault();
                    applyPreset();
                  }
                });
                input.addEventListener("blur", ()=>{
                  input.value = String(clampServoAngle(input.value));
                });
              }
            });
          }
        });
      }
      const runHardwarePyroTest = async (channel)=>{
        const ch = Math.max(1, Math.min(4, Math.round(Number(channel) || 1)));
        let durMs = Math.round(toFiniteNumber(el.hardwarePyroDurationInput ? el.hardwarePyroDurationInput.value : NaN, NaN));
        if(!isFinite(durMs)){
          durMs = Math.round(Number((uiSettings && uiSettings.ignDurationMs) || 1000));
        }
        durMs = Math.max(10, Math.min(30000, durMs));
        if(el.hardwarePyroDurationInput) el.hardwarePyroDurationInput.value = String(durMs);
        showToast("파이로 CH" + ch + " 테스트: " + durMs + "ms", "warn", {key:"hardware-pyro-fire-ch" + ch, duration:2400});
        await sendCommand({http:"/pyro_test?ch=" + ch + "&ms=" + durMs, ser:"PYRO " + ch + " " + durMs}, true);
        addLogLine("Hardware PYRO CH" + ch + " → ON " + durMs + "ms", "CMD");
      };
      if(el.hardwarePyroFireCh1Btn){
        el.hardwarePyroFireCh1Btn.addEventListener("click", async ()=>{ await runHardwarePyroTest(1); });
      }
      if(el.hardwarePyroFireCh2Btn){
        el.hardwarePyroFireCh2Btn.addEventListener("click", async ()=>{ await runHardwarePyroTest(2); });
      }
      if(el.hardwarePyroFireCh3Btn){
        el.hardwarePyroFireCh3Btn.addEventListener("click", async ()=>{ await runHardwarePyroTest(3); });
      }
      if(el.hardwarePyroFireCh4Btn){
        el.hardwarePyroFireCh4Btn.addEventListener("click", async ()=>{ await runHardwarePyroTest(4); });
      }
      if(el.loadcellCalOpen) el.loadcellCalOpen.addEventListener("click",()=>showLoadcellModal());
      if(el.loadcellResetBtn) el.loadcellResetBtn.addEventListener("click",()=>resetLoadcellCalibration());
      if(el.loadcellClose) el.loadcellClose.addEventListener("click",()=>hideLoadcellModal());
      if(el.loadcellCancel) el.loadcellCancel.addEventListener("click",()=>hideLoadcellModal());
      if(el.loadcellZero){
        el.loadcellZero.addEventListener("click",()=>{
          if(el.loadcellZero.disabled) return;
          if(loadcellModalStage === LOADCELL_MODAL_STAGE_STABILIZE){
            saveLoadcellZero();
            return;
          }
          if(loadcellModalStage === LOADCELL_MODAL_STAGE_NOISE){
            saveLoadcellNoiseZero();
          }
        });
      }
      if(el.loadcellOverlay){
        el.loadcellOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.loadcellOverlay) hideLoadcellModal(); });
      }
      if(el.loadcellApply){
        el.loadcellApply.addEventListener("click",()=>{
          if(loadcellModalStage === LOADCELL_MODAL_STAGE_COMPLETE){
            hideLoadcellModal();
            return;
          }
          if(loadcellModalStage !== LOADCELL_MODAL_STAGE_WEIGHT) return;
          refreshLoadcellInputPreview();
          const weight = parseFloat(el.loadcellWeightInput ? el.loadcellWeightInput.value : "");
          if(!isFinite(weight) || weight <= 0){
            showToast(t("loadcellWeightInvalidToast"), "notice");
            return;
          }
          saveLoadcellCalibration(weight);
        });
      }
      if(el.loadcellWeightInput){
        const syncPreview = ()=>refreshLoadcellInputPreview();
        el.loadcellWeightInput.addEventListener("input", syncPreview);
        el.loadcellWeightInput.addEventListener("change", syncPreview);
        el.loadcellWeightInput.addEventListener("keyup", syncPreview);
        el.loadcellWeightInput.addEventListener("blur", syncPreview);
      }
      if(el.loadcellWarningCancel){
        el.loadcellWarningCancel.addEventListener("click",()=>{
          if(loadcellWarningMode === "stability"){
            hideLoadcellModal();
            return;
          }
          hideLoadcellWarning();
        });
      }
      if(el.loadcellWarningProceed){
        el.loadcellWarningProceed.addEventListener("click",()=>{
          if(loadcellWarningMode === "stability"){
            startLoadcellStabilizationStep();
            return;
          }
          hideLoadcellWarning();
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
        const before = uiSettings.ignDurationMs;
        const ignMs = clampInt(el.ignTimeInput.value, 100, 3000, uiSettings.ignDurationMs || 1000);
        el.ignTimeInput.value = ignMs;
        uiSettings.ignDurationMs = ignMs;
        saveSettings();
        applySettingsToUI();
        await sendCommand({http:"/set?ign_ms="+ignMs, ser:"IGNMS "+ignMs}, false);
        if(before !== uiSettings.ignDurationMs){
          showToast(t("ignTimeChangedToast", {from:before, to:uiSettings.ignDurationMs, safety:safetyLineSuffix()}),"notice");
        }
        addLogLine(t("settingsUpdatedLog", {unit:uiSettings.thrustUnit, ign:uiSettings.ignDurationMs, cd:uiSettings.countdownSec}), "CFG");
      };

      const applyCountdownTime = async ()=>{
        if(!uiSettings || !el.countdownSecInput) return;
        const before = uiSettings.countdownSec;
        const cdSec = clampInt(el.countdownSecInput.value, 3, 60, uiSettings.countdownSec || 10);
        el.countdownSecInput.value = cdSec;
        uiSettings.countdownSec = cdSec;
        saveSettings();
        applySettingsToUI();
        await sendCommand({http:"/set?cd_ms="+(cdSec*1000),  ser:"CDMS "+(cdSec*1000)}, false);
        if(before !== uiSettings.countdownSec){
          showToast(t("countdownChangedToast", {from:before, to:uiSettings.countdownSec, safety:safetyLineSuffix()}),"notice");
        }
        addLogLine(t("settingsUpdatedLog", {unit:uiSettings.thrustUnit, ign:uiSettings.ignDurationMs, cd:uiSettings.countdownSec}), "CFG");
      };
      const applyDaqSequencePyroChannel = ()=>{
        if(!uiSettings || !el.daqSequencePyroSelect) return;
        const before = normalizePyroChannel(uiSettings.daqSequencePyroChannel, 1);
        const next = normalizePyroChannel(el.daqSequencePyroSelect.value, before);
        el.daqSequencePyroSelect.value = String(next);
        uiSettings.daqSequencePyroChannel = next;
        saveSettings();
        applySettingsToUI();
        syncDaqSequencePyroChannelToBoard(false);
        if(before !== next){
          showToast("DAQ 시퀀스 채널: PYRO" + next, "info", {key:"daq-sequence-pyro-channel"});
          addLogLine("DAQ sequence pyro -> CH" + next, "CFG");
        }
      };

      if(el.ignTimeSave){
        el.ignTimeSave.addEventListener("click", ()=>{ applyIgnitionTime(); });
      }
      if(el.countdownSave){
        el.countdownSave.addEventListener("click", ()=>{ applyCountdownTime(); });
      }
      if(el.daqSequencePyroSelect){
        el.daqSequencePyroSelect.addEventListener("change",()=>{ applyDaqSequencePyroChannel(); });
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
          refreshPrecisionSensitiveUi();
          redrawCharts();
          if(before !== uiSettings.thrustUnit){
            showToast(t("thrustUnitChangedToast", {from:before, to:uiSettings.thrustUnit, safety:safetyLineSuffix()}),"info");
          }
        });
      }
      if(el.quickDataDigitsSelect){
        el.quickDataDigitsSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          uiSettings.quickDataDigits = normalizeDecimalDigits(el.quickDataDigitsSelect.value, getQuickDataDigits());
          saveSettings();
          applySettingsToUI();
          refreshPrecisionSensitiveUi();
        });
      }
      if(el.loadcellChartDigitsSelect){
        el.loadcellChartDigitsSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          uiSettings.loadcellChartDigits = normalizeDecimalDigits(el.loadcellChartDigitsSelect.value, getLoadcellChartDigits());
          saveSettings();
          applySettingsToUI();
          redrawCharts();
        });
      }
      if(el.storageExportDigitsSelect){
        el.storageExportDigitsSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          uiSettings.storageExportDigits = normalizeDecimalDigits(el.storageExportDigitsSelect.value, getStorageExportDigits());
          saveSettings();
          applySettingsToUI();
        });
      }
      if(el.opModeSelect){
        el.opModeSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          const before = uiSettings.opMode;
          uiSettings.opMode = el.opModeSelect.value || "daq";
          if(before !== uiSettings.opMode){
            resetQuickFlightMetricsState();
          }
          saveSettings();
          applySettingsToUI();
          syncOperationModeToBoard(false);
          syncDaqSequencePyroChannelToBoard(false);
          if(before !== uiSettings.opMode){
            const modeLabel = (uiSettings.opMode === "flight") ? t("opModeFlight") : t("opModeDaq");
            showToast(t("opModeChangedToast", {mode:modeLabel}), "info");
          }
        });
      }
      if(el.gyroPreviewSelect){
        el.gyroPreviewSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          uiSettings.gyroPreview = normalizeGyroPreviewMode(el.gyroPreviewSelect.value || "3d");
          saveSettings();
          applySettingsToUI();
        });
      }
      if(el.mobileHudPreviewToggle){
        el.mobileHudPreviewToggle.addEventListener("change",()=>{
          if(!uiSettings) return;
          uiSettings.mobileHudPreview = !!el.mobileHudPreviewToggle.checked;
          saveSettings();
          applySettingsToUI();
        });
      }
      if(el.mobileFullscreenToggle){
        el.mobileFullscreenToggle.addEventListener("change",()=>{
          if(!uiSettings) return;
          uiSettings.mobileImmersive = !!el.mobileFullscreenToggle.checked;
          saveSettings();
          applySettingsToUI();
          applyMobileImmersiveMode(true);
          setTimeout(syncMobileImmersiveToggleState, 250);
        });
      }

      if(el.launcherOpenBtns && el.launcherOpenBtns.length){
        el.launcherOpenBtns.forEach(btn=>{
          btn.addEventListener("click",()=>{
            ensureDashboardViewForPanels();
            showLauncher();
          });
          btn.addEventListener("keydown",(e)=>{
            if(e.key==="Enter"||e.key===" "){
              e.preventDefault();
              ensureDashboardViewForPanels();
              showLauncher();
            }
          });
        });
      }
      if(launcherCloseBtn){ launcherCloseBtn.addEventListener("click",()=>hideLauncher()); }
      if(launcherOverlayEl){ launcherOverlayEl.addEventListener("click",(ev)=>{ if(ev.target===launcherOverlayEl) hideLauncher(); }); }

      if(launcherUpBtn || launcherDownBtn || launcherUpPanelBtn || launcherDownPanelBtn || launcherUpMobileBtn || launcherDownMobileBtn){
        const startEvents=["mousedown","touchstart"];
        const endEvents=["mouseup","mouseleave","touchend","touchcancel"];
        const bindLauncherHold = (node, dir)=>{
          if(!node) return;
          startEvents.forEach(evName=>{
            node.addEventListener(evName,(ev)=>{ ev.preventDefault(); node.classList.add("pressed"); startLauncherHold(dir); },{passive:false});
          });
          endEvents.forEach(evName=>{
            node.addEventListener(evName,(ev)=>{ ev.preventDefault(); node.classList.remove("pressed"); stopLauncherHold(dir); },{passive:false});
          });
        };

        bindLauncherHold(launcherUpBtn, "up");
        bindLauncherHold(launcherDownBtn, "down");
        bindLauncherHold(launcherUpPanelBtn, "up");
        bindLauncherHold(launcherDownPanelBtn, "down");
        bindLauncherHold(launcherUpMobileBtn, "up");
        bindLauncherHold(launcherDownMobileBtn, "down");
      }
      if(launcherAutoBtn){
        launcherAutoBtn.addEventListener("click",()=>{
          showLauncherAutoConfirm();
        });
      }
      if(launcherAutoPanelBtn){
        launcherAutoPanelBtn.addEventListener("click",()=>{
          showLauncherAutoConfirm();
        });
      }
      if(launcherAutoMobileBtn){
        launcherAutoMobileBtn.addEventListener("click",()=>{
          showLauncherAutoConfirm();
        });
      }
      if(mobileLauncherBackBtn){
        mobileLauncherBackBtn.addEventListener("click",()=>{
          hideLauncher();
        });
      }
      if(mobileMissionBackBtn){
        mobileMissionBackBtn.addEventListener("click",()=>{
          hideMission();
        });
      }
      if(mobileInspectionBackBtn){
        mobileInspectionBackBtn.addEventListener("click",()=>{
          hideInspection();
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
      if(rebootConfirmBtnEl){
        rebootConfirmBtnEl.addEventListener("click",()=>{
          setRebootConfirmWaiting();
          sendCommand({http:"/reset", ser:"/reset"}, true);
        });
      }
      if(rebootConfirmCancelBtnEl){
        rebootConfirmCancelBtnEl.addEventListener("click",()=>hideRebootConfirm());
      }
      if(rebootConfirmOverlayEl){
        rebootConfirmOverlayEl.addEventListener("click",(ev)=>{
          if(ev.target===rebootConfirmOverlayEl && !rebootConfirmWaiting) hideRebootConfirm();
        });
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
        applyPhoneLandscapeLayout();
        if(gyroGl){
          resizeGyroGl();
          renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        }
        refreshChartLayout();
        scheduleStatusMapRefresh();
      });
      window.addEventListener("orientationchange",()=>{
        applyPhoneLandscapeLayout();
        scheduleStatusMapRefresh();
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
      setInterval(fetchServoInfo, 2000);
      fetchWifiInfo();
      fetchServoInfo();
      loadMissionProfileFromBoard();
      updateData().finally(()=>{ pollLoop(); });
      updateSerialPill();
      updateMissionEditLockUI();

      // ✅ KST 실시간 업데이트
      updateKstClock();
      setInterval(updateKstClock, 1000);
    });
