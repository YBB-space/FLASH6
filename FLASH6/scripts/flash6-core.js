/* FLASH6 runtime module: flash6-core.js. Loaded in manifest order by flash6.js. */
/* FLASH6 application runtime. Translations live in scripts/flash6-i18n.js. */
if (typeof window !== "undefined") {
      try{
        if(typeof sessionStorage !== "undefined"){
          sessionStorage.removeItem("flash6_boot_js_retry");
        }
      }catch(_e){}
      window.__flashBoot = window.__flashBoot || {};
      window.__flashBoot.jsReady = false;
      window.__flashBoot.jsLoaded = true;
    }

    function bootBeacon(stage, detail){
      try{
        if(typeof window !== "undefined" &&
           window.__flashBoot &&
           typeof window.__flashBoot.emit === "function"){
          window.__flashBoot.emit(stage, detail);
          return;
        }
        const s = encodeURIComponent(String(stage || "-").slice(0, 48));
        const dRaw = String(detail || "").slice(0, 120);
        const d = dRaw ? ("&detail=" + encodeURIComponent(dRaw)) : "";
        const url = "/js_boot?stage=" + s + d;
        fetch(url, {method:"GET", cache:"no-store", keepalive:true}).catch(()=>{});
      }catch(_e){}
    }

    function createAbortControllerSafe(){
      try{
        if(typeof AbortController === "undefined") return null;
        return new AbortController();
      }catch(_e){
        return null;
      }
    }

    bootBeacon("js_loaded", (typeof location !== "undefined" ? location.pathname : "/"));

    function isIgnorableRuntimeNoise(msg){
      const lower = String(msg || "").toLowerCase();
      return (
        lower.indexOf("_fadeanimated") >= 0 ||
        lower.indexOf("response.result") >= 0 ||
        lower.indexOf("getcenter") >= 0 ||
        lower.indexOf("cannot read properties of null") >= 0 && lower.indexOf("getcenter") >= 0
      );
    }

    if (typeof window !== "undefined") {
      window.addEventListener("error", (ev)=>{
        const msg = ev && (ev.message || (ev.error && ev.error.message) || "window_error");
        if(isIgnorableRuntimeNoise(msg)){
          try{ ev.preventDefault(); }catch(_e){}
          return;
        }
        bootBeacon("js_error", msg);
      });
      window.addEventListener("unhandledrejection", (ev)=>{
        const reason = ev && ev.reason;
        let msg = "promise_reject";
        if (reason && typeof reason === "object" && reason.message) msg = reason.message;
        else if (reason != null) msg = String(reason);
        if(isIgnorableRuntimeNoise(msg)){
          try{ ev.preventDefault(); }catch(_e){}
          return;
        }
        bootBeacon("js_reject", msg);
      });
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
    let quickAltitudeRateHistory = [];
    let quickVelocityHistory = [];
    let quickSpeedHistory = [];
    const CAMERA_CHART_VISIBLE_POINTS = 1000;
    let cameraChartLastDrawAt = 0;
    let cameraStageSeparationProgress = 0;
    let cameraStageSeparationFallbackAt = 0;
    let cameraStageSeparationLatched = false;
    let cameraStageSeparationAutoRaf = 0;
    let cameraStageSeparationManualAt = 0;
    let cameraStageSeparationManualRaf = 0;
    let cameraStageSeparationCountdownUntil = 0;
    let cameraStageSeparationTriggerAt = 0;
    let cameraStageSeparationCountdownTimer = 0;
    let cameraBroadcastAlertTimer = 0;
    let cameraBroadcastAlertHideTimer = 0;
    let cameraEventStateText = "";
    let cameraEventStateUntil = 0;
    let cameraLastEventStateKey = "";
    let gyroSpeedHistory = [];
    let accelMagHistory = [];
    let ascentAccelHistory = [];
    let accelXHistory = [];
    let accelYHistory = [];
    let accelZHistory = [];
    let gyroXHistory = [];
    let gyroYHistory = [];
    let gyroZHistory = [];
    let chipTempHistory = [];
    let perfLoadHistory = [];
    let batteryPctHistory = [];
    let chipPerfUiLastUpdateMs = 0;
    let chipTempUiDisplayText = "--°C";
    let perfUiDisplayText = "--%";
    let chipTempModalLastRenderMs = 0;
    let perfModalLastRenderMs = 0;
    let chartTimeHistory = [];
    let sampleHistory = [];
    let mobileChartSelectedKeys = [];
    const SAMPLE_HISTORY_MAX = 10000;
    const EVENT_LOG_MAX = 5000;
    const RAW_LOG_MAX   = 20000;
    const HISTORY_TRIM_CHUNK = 256;
    const LOG_TRIM_CHUNK = 128;
    const APP_DATA_DB_NAME = "altis_flash6_app_data";
    const APP_DATA_DB_VERSION = 1;
    const APP_DATA_SESSION_GAP_MS = 5000;
    const APP_DATA_CHUNK_SAMPLES = 200;
    let appDataDbPromise = null;
    let appDataSession = null;
    let appDataPendingSamples = [];
    let appDataLastStoredAtMs = 0;
    let appDataFlushPromise = Promise.resolve();
    let flightDataLoggingEnabled = false;
    let flightDataLoggingPending = false;
    let flightDataLoggingKnown = false;
    let flightDataLoggingDesired = null;
    let flightDataLoggingCommandStartedAt = 0;

    const IGN_THRUST_THRESHOLD = 10.0;  // kgf, ignition delay threshold
    const IGN_PRESSURE_WINDOW_THRESHOLD_MPA = 0.3;
    const IGN_PRESSURE_BURN_THRESHOLD_MPA = 0.1;
    const IGN_PRE_WINDOW_MS    = 2000;
    const IGN_POST_WINDOW_MS   = 1000;

    let prevStForIgn = 0;
    let ignitionAnalysis = createIgnitionAnalysis(null);
    const DEFAULT_MISSION_NAME = "PIONEER-I test flight4 MISSION";
    let selectedMotorName = DEFAULT_MISSION_NAME;
    let pendingMissionApply = null;
    let missionProfileDoc = null;
    let missionBlocksState = [];
    let missionBoardSavePending = false;
    let missionFirmwareLocked = false;
    let missionFirmwareSource = "";
    let missionFirmwareLockReason = "";
    let replayMissionRuntime = null;
    let replayHasStoredMissionAlarms = false;
    const missionAlarmEventKeys = new Set();
    let replayAlarmEvents = [];

    function createIgnitionAnalysis(startMs){
      return {
        hasData:false,
        ignStartMs:(startMs != null && isFinite(Number(startMs))) ? Number(startMs) : null,
        thresholdMs:null,
        lastAboveMs:null,
        windowTriggerMs:null,
        windowCloseMs:null,
        windowStartMs:null,
        windowEndMs:null,
        delaySec:null,
        durationSec:null,
        endNotified:false
      };
    }

    function applyIgnitionChartWindow(){
      if(!ignitionAnalysis) return;
      const start = Number(ignitionAnalysis.windowStartMs);
      const end = Number(ignitionAnalysis.windowEndMs);
      if(!isFinite(start) || !isFinite(end) || end <= start) return;
      chartView.startMs = Math.max(0, start);
      chartView.windowMs = Math.max(1000, Math.min(CHART_WINDOW_MS_MAX, end - chartView.startMs));
      chartView.allowSmallWindow = true;
      autoScrollChart = false;
    }
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
          img.src = "img/altis_logo1.png";
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
            msg.textContent = "모터 프리셋 추가 문의: ybb1833@naver.com";
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
    const GYRO_TRAIL_RENDER_MAX_POINTS = 1600;
    const GYRO_TRAIL_BASE_METERS_PER_UNIT = 4.2;
    // Preserve true metric proportions in both the live preview and reports.
    // Earlier builds widened the UI trail by 2.8x for readability, which made
    // a modest model-rocket drift look like a long-range ballistic flight.
    const GYRO_TRAIL_HORIZONTAL_EXAGGERATION = 1.0;
    const GYRO_PREVIEW_ASCENT_VERTICAL_HOLD_M = 7;
    const GYRO_PREVIEW_ASCENT_CURVE_FULL_M = 28;
    const GYRO_PREVIEW_ASCENT_MIN_HORIZONTAL_BLEND = 0.12;
    const GYRO_TRAIL_HALF_SPAN_XZ = 2.2;
    const GYRO_TRAIL_HALF_SPAN_Y = 3.2;
    const GYRO_TRAIL_ZOOM_OUT_SMOOTH = 0.11;
    const GYRO_TRAIL_ZOOM_IN_SMOOTH = 0.025;
    const GYRO_WORLD_ALTITUDE_BASE = 0.23;
    const GYRO_FOV_DEG = 44;
    const GYRO_CAMERA_DEFAULT = Object.freeze({yawDeg:42, pitchDeg:24, distance:1.95});
    const GYRO_CAMERA_PREVIEW_DISTANCE = 0.9;
    const GYRO_CAMERA_PREVIEW_TARGET_Y_OFFSET = 0;
    const GYRO_CAMERA_MIN_DISTANCE = 1.9;
    const GYRO_CAMERA_MAX_DISTANCE = 30;
    const GYRO_CAMERA_MAX_DISTANCE_3D_PLUS = 500;
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
    const GYRO_ROCKET_3MF_PATH = "3d/assembly.3mf";
    const GYRO_ROCKET_MODEL_PATH = "3d/assembly.model";
    const GYRO_ROCKET_3MF_MAX_TRIANGLES = 100000;
    const GYRO_ROCKET_TARGET_LENGTH = 1.56;
    const GYRO_ROCKET_ACTUAL_HEIGHT_M = 1.9;
    // Absolute heading is not available yet. Keep terrain/map loading disabled
    // until a trustworthy heading source such as a magnetometer is present.
    const GYRO_TERRAIN_ENABLED = false;
    const GYRO_ABSOLUTE_TRAJECTORY_ENABLED = false;
    const GYRO_TERRAIN_ZOOM = 15;
    const GYRO_TERRAIN_MAP_ZOOM = 15;
    const GYRO_TERRAIN_MAP_TILE_SIZE = 512;
    const GYRO_TERRAIN_SPAN_M = 4000;
    const GYRO_TERRAIN_GRID_SIZE = 161;
    const GYRO_TERRAIN_TEXTURE_SIZE = 2048;
    const GYRO_TERRAIN_EXAGGERATION = 1.6;
    const GYRO_TERRAIN_VERTICAL_COMPRESSION = 2.4;
    const GYRO_TERRAIN_DEFAULT_CAMERA_DISTANCE = 2.4;
    const GYRO_TERRAIN_RETRY_MS = 30000;
    const GYRO_TERRAIN_BUILDING_RADIUS_M = 500;
    const GYRO_TERRAIN_BUILDING_TIMEOUT_MS = 10000;
    const GYRO_TERRAIN_BUILDING_URL = "https://api.openstreetmap.org/api/0.6/map";
    const GYRO_TERRAIN_ELEVATION_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
    const GYRO_TERRAIN_MAP_URL = "https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png";
    const MOBILE_MOCKUP_3MF_PATH = "3d/ALTIS INTELLIGNET3b3 Mockup.3mf";
    const MOBILE_MOCKUP_PREVIEW_PATH = "3d/ALTIS_INTELLIGNET3b3_Mockup.preview.json";
    const MOBILE_MOCKUP_MAX_TRIANGLES = 16000;
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
    const GYRO_ALTGYRO_ALT_DEADBAND_M = 0.03;
    const GYRO_ALTGYRO_MIN_VSPEED_FOR_HMOVE_MPS = 0.18;
    const GYRO_ALTGYRO_IDLE_VSPEED_DAMP = 0.55;
    const GYRO_ALTGYRO_MAX_HSPEED_MPS = 48;
    const GYRO_FUSION_MAX_DT_SEC = 0.5;
    const GYRO_FUSION_STEP_SEC = 0.025;
    const GYRO_FUSION_ACCEL_DEADBAND_MPS2 = 0.18;
    const GYRO_FUSION_ACCEL_CLAMP_MPS2 = 220;
    const GYRO_FUSION_GPS_DEFAULT_ACCURACY_M = 3.5;
    const GYRO_FUSION_GPS_MIN_ACCURACY_M = 0.18;
    const GYRO_FUSION_GPS_MAX_ACCURACY_M = 35;
    const GYRO_FUSION_GPS_STALE_MS = 2200;
    const GYRO_FUSION_BARO_STALE_MS = 1200;
    const GYRO_FUSION_STATIONARY_HOLD_MS = 320;
    const GYRO_FUSION_MAX_SPEED_MPS = 420;
    const GYRO_FUSION_RANGE_LIMIT_M = 12000;
    const GYRO_FUSION_ALT_MIN_M = -500;
    const GYRO_FUSION_ALT_MAX_M = 12000;
    // Model-rocket prior: the airframe is rail-constrained first, then remains
    // strongly directionally stable while it accelerates. In the launch-local
    // frame this means early horizontal travel must stay close to zero unless
    // GPS confirms otherwise.
    const GYRO_FUSION_RAIL_LENGTH_M = 1.2;
    const GYRO_FUSION_STABLE_LAUNCH_ALT_M = 7;
    const GYRO_FUSION_RAIL_HOLD_SEC = 0.18;
    const GYRO_FUSION_RAIL_RELEASE_SEC = 0.68;
    const GYRO_LOCAL_PHASE_DYNAMICS = Object.freeze({
      PRE_FLIGHT:     {accelGain:0.00, accelTau:0.45, maxAccel:0,   linearDrag:9.0,  quadraticDrag:0,      processNoise:0.12, maxSpeed:0},
      // IMU lateral acceleration is deliberately a correction, not the main
      // motion source. Barometric vertical motion and GPS dominate the model.
      POWERED_FLIGHT:{accelGain:0.34, accelTau:0.15, maxAccel:5.0, linearDrag:0.065,quadraticDrag:0.0023, processNoise:2.5,  maxSpeed:10},
      COASTING:       {accelGain:0.00, accelTau:0.22, maxAccel:0,   linearDrag:0.055,quadraticDrag:0.0018, processNoise:2.0,  maxSpeed:35},
      DESCENT:        {accelGain:0.00, accelTau:0.28, maxAccel:0,   linearDrag:0.30, quadraticDrag:0.012,  processNoise:1.5,  maxSpeed:18},
      LANDED:         {accelGain:0.00, accelTau:0.35, maxAccel:0,   linearDrag:12.0, quadraticDrag:0,      processNoise:0.08, maxSpeed:0}
    });
    function getModelRocketLaunchHorizontalAcceptance(poweredAgeSec, launchAltitudeM){
      const releaseSpanSec = Math.max(
        0.01,
        GYRO_FUSION_RAIL_RELEASE_SEC - GYRO_FUSION_RAIL_HOLD_SEC
      );
      const timeRatio = clampLocal(
        (Math.max(0, Number(poweredAgeSec) || 0) - GYRO_FUSION_RAIL_HOLD_SEC) /
          releaseSpanSec,
        0,
        1
      );
      const altitudeRatio = clampLocal(
        (Math.max(0, Number(launchAltitudeM) || 0) - GYRO_FUSION_RAIL_LENGTH_M) /
          Math.max(
            0.1,
            GYRO_FUSION_STABLE_LAUNCH_ALT_M - GYRO_FUSION_RAIL_LENGTH_M
          ),
        0,
        1
      );
      const smooth = (ratio)=>ratio * ratio * (3 - (2 * ratio));
      return Math.min(smooth(timeRatio), smooth(altitudeRatio));
    }
    function getModelRocketHorizontalRangeLimitM(input){
      const sample = input || {};
      const phase = String(sample.phase || FLIGHT_PHASES.PRE_FLIGHT);
      const altitudeM = Math.max(0, Number(sample.altitudeM) || 0);
      const apogeeAltitudeM = Math.max(
        altitudeM,
        Number(sample.apogeeAltitudeM) || 0
      );
      const timeSinceApogeeSec = Math.max(
        0,
        Number(sample.timeSinceApogeeSec) || 0
      );
      // A rail-launched, fin-stabilized model rocket should stay close to the
      // pad during ascent. Descent gets a separate wind-drift allowance.
      const ascentLimitM = Math.max(2.5, 1.5 + (apogeeAltitudeM * 0.11));
      const modelLimitM = (
        phase === FLIGHT_PHASES.DESCENT ||
        phase === FLIGHT_PHASES.LANDED
      )
        ? ascentLimitM + (timeSinceApogeeSec * 2.2)
        : Math.max(2.5, 1.5 + (altitudeM * 0.11));
      const gpsRangeEnvelopeM = Number(sample.gpsRangeEnvelopeM);
      if(!isFinite(gpsRangeEnvelopeM) || gpsRangeEnvelopeM < 0){
        return modelLimitM;
      }
      const gpsAccuracyM = clampLocal(
        Number(sample.gpsAccuracyM) || GYRO_FUSION_GPS_DEFAULT_ACCURACY_M,
        GYRO_FUSION_GPS_MIN_ACCURACY_M,
        GYRO_FUSION_GPS_MAX_ACCURACY_M
      );
      // GPS supplies only a scalar envelope. Its heading and interpolated
      // coordinate shape never enter the reconstructed local trajectory.
      const gpsLimitM = gpsRangeEnvelopeM + Math.max(2.5, gpsAccuracyM * 1.25);
      return Math.max(2.5, Math.min(modelLimitM, gpsLimitM));
    }
    function updateModelRocketHorizontalMotion(state, input){
      const motion = state || {};
      const sample = input || {};
      const dt = Math.max(0.001, Math.min(0.05, Number(sample.dtSec) || 0.01));
      const phase = String(sample.phase || FLIGHT_PHASES.PRE_FLIGHT);
      let velocityX = isFinite(Number(motion.velocityX)) ? Number(motion.velocityX) : 0;
      let velocityZ = isFinite(Number(motion.velocityZ)) ? Number(motion.velocityZ) : 0;
      let positionX = isFinite(Number(motion.positionX)) ? Number(motion.positionX) : 0;
      let positionZ = isFinite(Number(motion.positionZ)) ? Number(motion.positionZ) : 0;

      if(phase === FLIGHT_PHASES.PRE_FLIGHT || phase === FLIGHT_PHASES.LANDED){
        velocityX = 0;
        velocityZ = 0;
        return {velocityX, velocityZ, positionX, positionZ};
      }

      const verticalSpeedMps = Number(sample.verticalSpeedMps);
      const acceptance = clampLocal(Number(sample.horizontalAcceptance) || 0, 0, 1);
      if(phase === FLIGHT_PHASES.POWERED_FLIGHT){
        const axisX = Number(sample.axisX) || 0;
        const axisZ = Number(sample.axisZ) || 0;
        const axisUp = Number(sample.axisUp);
        const safeAxisUp = isFinite(axisUp) ? Math.max(0.55, axisUp) : 1;
        let ratioX = axisX / safeAxisUp;
        let ratioZ = axisZ / safeAxisUp;
        const ratioMagnitude = Math.hypot(ratioX, ratioZ);
        const maxTiltRatio = Math.tan(18 * DEG_TO_RAD);
        if(ratioMagnitude > maxTiltRatio){
          const ratioScale = maxTiltRatio / ratioMagnitude;
          ratioX *= ratioScale;
          ratioZ *= ratioScale;
        }
        const positiveVerticalSpeedMps = Math.max(0, isFinite(verticalSpeedMps)
          ? verticalSpeedMps
          : 0);
        const targetLimitMps = Math.min(
          8,
          Math.max(0.55, (positiveVerticalSpeedMps * 0.22) + 0.35)
        );
        let targetVelocityX = positiveVerticalSpeedMps * ratioX * acceptance;
        let targetVelocityZ = positiveVerticalSpeedMps * ratioZ * acceptance;
        const targetSpeedMps = Math.hypot(targetVelocityX, targetVelocityZ);
        if(targetSpeedMps > targetLimitMps){
          const targetScale = targetLimitMps / targetSpeedMps;
          targetVelocityX *= targetScale;
          targetVelocityZ *= targetScale;
        }

        // During powered flight a fin-stabilized model rocket's velocity vector
        // follows its longitudinal axis. Attitude therefore provides a much
        // safer horizontal constraint than unrestricted double integration.
        const steeringAlpha = 1 - Math.exp(-dt / 0.24);
        velocityX += (targetVelocityX - velocityX) * steeringAlpha;
        velocityZ += (targetVelocityZ - velocityZ) * steeringAlpha;

        // Retain only a small lateral-IMU correction. This captures genuine
        // weathercocking while preventing vibration/bias from creating range.
        velocityX += clampLocal(Number(sample.accelX) || 0, -5, 5) *
          0.08 * acceptance * dt;
        velocityZ += clampLocal(Number(sample.accelZ) || 0, -5, 5) *
          0.08 * acceptance * dt;
      }

      const dragRate = phase === FLIGHT_PHASES.POWERED_FLIGHT
        ? 0.055
        : (phase === FLIGHT_PHASES.COASTING ? 0.09 : 0.32);
      const dragFactor = Math.exp(-dragRate * dt);
      velocityX *= dragFactor;
      velocityZ *= dragFactor;

      const phaseSpeedLimitMps = phase === FLIGHT_PHASES.POWERED_FLIGHT
        ? 8
        : (phase === FLIGHT_PHASES.COASTING ? 10 : 8);
      const horizontalSpeedMps = Math.hypot(velocityX, velocityZ);
      if(horizontalSpeedMps > phaseSpeedLimitMps){
        const speedScale = phaseSpeedLimitMps / horizontalSpeedMps;
        velocityX *= speedScale;
        velocityZ *= speedScale;
      }
      positionX += velocityX * dt;
      positionZ += velocityZ * dt;
      const rangeLimitM = Number(sample.horizontalRangeLimitM);
      const anchorX = isFinite(Number(sample.anchorX)) ? Number(sample.anchorX) : 0;
      const anchorZ = isFinite(Number(sample.anchorZ)) ? Number(sample.anchorZ) : 0;
      let relativeX = positionX - anchorX;
      let relativeZ = positionZ - anchorZ;
      let horizontalRangeM = Math.hypot(relativeX, relativeZ);
      if(isFinite(rangeLimitM) && rangeLimitM > 0 && horizontalRangeM > rangeLimitM){
        const nx = relativeX / horizontalRangeM;
        const nz = relativeZ / horizontalRangeM;
        positionX = anchorX + (nx * rangeLimitM);
        positionZ = anchorZ + (nz * rangeLimitM);
        const outwardSpeedMps = (velocityX * nx) + (velocityZ * nz);
        if(outwardSpeedMps > 0){
          velocityX -= outwardSpeedMps * nx;
          velocityZ -= outwardSpeedMps * nz;
        }
        relativeX = positionX - anchorX;
        relativeZ = positionZ - anchorZ;
        horizontalRangeM = rangeLimitM;
      }
      const rangeTargetM = Number(sample.horizontalRangeTargetM);
      if(isFinite(rangeTargetM) && rangeTargetM >= 0 && horizontalRangeM > 0.02){
        const boundedTargetM = isFinite(rangeLimitM) && rangeLimitM > 0
          ? Math.min(rangeTargetM, rangeLimitM)
          : rangeTargetM;
        const correctionAlpha = clampLocal(
          Number(sample.rangeCorrectionAlpha) || 0,
          0,
          0.2
        );
        const correctedRangeM = horizontalRangeM +
          ((boundedTargetM - horizontalRangeM) * correctionAlpha);
        const rangeScale = correctedRangeM / horizontalRangeM;
        positionX = anchorX + (relativeX * rangeScale);
        positionZ = anchorZ + (relativeZ * rangeScale);
      }
      return {velocityX, velocityZ, positionX, positionZ};
    }
    const GYRO_CAPTURE_SPRING = 7.5;
    const GYRO_CAPTURE_DRAG_ACTIVE = 2.6;
    const GYRO_CAPTURE_DRAG_IDLE = 6.5;
    const GYRO_CAPTURE_RANGE_M = 2.5;

    // HTTP polling is only a fallback; WebSocket carries the high-rate stream.
    const POLL_INTERVAL      = 500;
    const SIM_SAMPLE_HZ      = 100;
    const SIM_SAMPLE_INTERVAL_MS = 1000 / SIM_SAMPLE_HZ;

    // Keep the main console and OBS HUD on the same visible sample cadence.
    // 50 Hz live telemetry becomes 25 Hz UI, while 60 fps replay rendering
    // settles near 30 Hz without running the full DOM path for every packet.
    const UI_SAMPLE_SKIP     = 2;
    const CHART_MIN_INTERVAL = 40;
    const PARACHUTE_STATUS_HOLD_MS = 18000;

    let lastChartRedraw = 0;
    let sampleCounter = 0;
    let telemetryUiSampleCounter = 0;
    let isUpdating = false;
    let chartView = { startMs: null, windowMs: CHART_WINDOW_MS_DEFAULT, allowSmallWindow:false };
    let autoScrollChart = true;
    let disconnectedLogged = false;
    let lastStatusCode = -1;
    let currentSt = 0;
    function isFirmwareSequenceRunningState(value){
      const state = Number(value);
      return state === 1 || state === 2 || state === 3 || state === 4 || state === 5;
    }
    function isFirmwareTplusState(value){
      return Number(value) === 3;
    }
    function isSequenceMobileWheelMode(){
      const root = document.documentElement;
      if(!root.classList.contains("sequence-running")) return false;
      if(root.classList.contains("status-map-expanded") || root.classList.contains("gyro3d-expanded")) return false;
      if(root.classList.contains("phone-landscape-layout")) return true;
      return !!(window.matchMedia && window.matchMedia("(max-width: 900px)").matches);
    }
    function normalizedWheelDeltaY(ev, owner){
      let delta = Number(ev && ev.deltaY);
      if(!Number.isFinite(delta) || delta === 0) return 0;
      if(ev.deltaMode === 1) delta *= 16;
      else if(ev.deltaMode === 2) delta *= Math.max(1, owner ? owner.clientHeight * 0.9 : window.innerHeight * 0.9);
      return delta;
    }
    function canWheelScrollElement(node, delta){
      if(!node || !Number.isFinite(delta) || delta === 0) return false;
      if(node !== document.scrollingElement){
        const overflowY = window.getComputedStyle ? window.getComputedStyle(node).overflowY : "";
        if(overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") return false;
      }
      const maxScroll = Math.max(0, Number(node.scrollHeight) - Number(node.clientHeight));
      if(maxScroll <= 1) return false;
      const top = Number(node.scrollTop) || 0;
      return delta > 0 ? top < (maxScroll - 1) : top > 1;
    }
    function sequenceWheelScrollOwner(target, rawDelta){
      const candidates = [];
      const seen = new Set();
      const addCandidate = (node)=>{
        if(!node || seen.has(node)) return;
        seen.add(node);
        candidates.push(node);
      };

      const panel = document.getElementById("mobileControlsPanel");
      if(panel && panel.classList.contains("is-open")) addCandidate(panel);

      let node = target instanceof Element ? target : null;
      while(node && node !== document.body && node !== document.documentElement){
        addCandidate(node);
        node = node.parentElement;
      }

      addCandidate(document.querySelector(".page-wrap"));
      addCandidate(document.scrollingElement);
      addCandidate(document.documentElement);
      addCandidate(document.body);

      for(const candidate of candidates){
        const delta = normalizedWheelDeltaY(rawDelta, candidate);
        if(canWheelScrollElement(candidate, delta)) return {node:candidate, delta};
      }
      return null;
    }
    function routeSequenceMobileWheel(ev){
      if(!isSequenceMobileWheelMode() || ev.defaultPrevented || ev.ctrlKey || ev.metaKey) return;
      if(Math.abs(Number(ev.deltaY) || 0) < Math.abs(Number(ev.deltaX) || 0)) return;
      const owner = sequenceWheelScrollOwner(ev.target, ev);
      if(!owner) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      owner.node.scrollTop += owner.delta;
    }
    document.addEventListener("wheel", routeSequenceMobileWheel, {capture:true, passive:false});

    function syncSequenceInteractionState(value){
      const running = isFirmwareSequenceRunningState(value);
      document.documentElement.classList.toggle("sequence-running", running);
      if(!running) return;

      document.documentElement.style.removeProperty("touch-action");
      document.body.style.removeProperty("touch-action");
      if(!document.documentElement.classList.contains("status-map-expanded") &&
         !document.documentElement.classList.contains("gyro3d-expanded") &&
         !document.documentElement.classList.contains("phone-landscape-layout")){
        document.documentElement.style.removeProperty("overflow");
        document.body.style.removeProperty("overflow");
      }
    }
    let lastSnapHzUiMs = 0;
    let rxWindowStartMs = 0;
    let rxWindowCount = 0;
    let rxHzWindow = 0;
    let sampleRateWindowStartMs = 0;
    let sampleRateWindowCount = 0;
    let sampleRateHzWindow = 0;
    let lastSampleTimelineMs = NaN;
    let gyroLastUiMs = 0;
    let liveGyroRenderRaf = 0;
    let liveGyroLastRateY = 0;
    let offlineGyroPreviewRenderRaf = 0;
    let lastMobilePreviewOnline = null;
    let gyroAttitudeLastMs = 0;
    let gyroAttitudeReady = false;
    let gyroYawDeg = 0;
    let gyroPitchDeg = 0;
    let gyroRollDeg = 0;
    let gyroAttitudeQuat = [1,0,0,0];
    let gyroUiAttitudeQuat = [1,0,0,0];
    let gyroUiAttitudeReady = false;
    let gyroZeroRollOffsetDeg = 0;
    let gyroZeroPitchOffsetDeg = 0;
    let gyroZeroYawOffsetDeg = 0;
    let gyroZeroQuat = [1,0,0,0];
    let gyroGl = null;
    let gyroRocketMeshPromise = null;
    let mobileMockup3d = null;
    let mobileMockup3dPromise = null;
    let mobileMockup3dRaf = 0;
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
      manualZoomUntilMs: 0,
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
    const desktopGyroPreviewPortalState = {
      homeParent: null,
      homeNextSibling: null,
      mounted: false
    };
    const cameraGyroPreviewPortalState = {
      homeParent: null,
      homeNextSibling: null,
      mounted: false
    };
    const gyroTerrainState = {
      status: "idle",
      key: "",
      requestToken: 0,
      retryAt: 0,
      originLat: NaN,
      originLon: NaN,
      centerElevationM: 0,
      mesh: null
    };
    const statusMapViewportPortalState = {
      homeParent: null,
      homeNextSibling: null,
      mountedToBody: false
    };
    const mobileMapPreviewPortalState = {
      homeParent: null,
      homeNextSibling: null,
      mounted: false
    };
    const cameraMapPreviewPortalState = {
      homeParent: null,
      homeNextSibling: null,
      mounted: false
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
      renderScaleXZ: GYRO_TRAIL_BASE_METERS_PER_UNIT / GYRO_TRAIL_HORIZONTAL_EXAGGERATION,
      renderScaleY: GYRO_TRAIL_BASE_METERS_PER_UNIT,
      smoothPath: [],
      smoothPathMeters: [],
      cachedLastMs: -1,
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
      altGyroVSpeedMps: 0,
      fusionReady: false,
      fusionFlightTracking: false,
      fusionLastMs: 0,
      fusionPosX: 0,
      fusionPosY: 0,
      fusionPosZ: 0,
      fusionVelX: 0,
      fusionVelY: 0,
      fusionVelZ: 0,
      fusionAccelX: 0,
      fusionAccelZ: 0,
      fusionAccelReady: false,
      fusionAccelBiasX: 0,
      fusionAccelBiasZ: 0,
      fusionPhase: "PRE_FLIGHT",
      fusionPoweredStartMs: 0,
      fusionLaunchAnchorX: 0,
      fusionLaunchAnchorZ: 0,
      fusionRailLocked: false,
      fusionStationarySinceMs: 0,
      fusionStationaryLocked: false,
      fusionAnchorX: 0,
      fusionAnchorZ: 0,
      fusionMotionScore: 0,
      fusionGpsLastLat: NaN,
      fusionGpsLastLon: NaN,
      fusionGpsLastX: NaN,
      fusionGpsLastY: NaN,
      fusionGpsLastZ: NaN,
      fusionGpsLastMs: 0,
      fusionGpsVelX: 0,
      fusionGpsVelZ: 0,
      fusionGpsValidMs: 0,
      fusionGpsAccuracyM: GYRO_FUSION_GPS_DEFAULT_ACCURACY_M,
      fusionGpsRejectCount: 0,
      fusionGpsRangeEnvelopeM: NaN,
      fusionCovP00: 16,
      fusionCovP01: 0,
      fusionCovP11: 25,
      fusionImuYawOffsetRad: 0,
      fusionImuYawReady: false,
      fusionLocalVelX: 0,
      fusionLocalVelZ: 0,
      fusionBaroOriginM: NaN,
      fusionBaroAltM: NaN,
      fusionBaroLastM: NaN,
      fusionBaroLastMs: 0,
      fusionBaroVelMps: 0,
      fusionBaroValidMs: 0,
      fusionApogeeAltitudeM: 0,
      fusionApogeeMs: 0
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
      nextDeadlineMs: NaN,
      lastUiUpdateMs: 0,
      lastRenderMs: 0,
      playing: false,
      speed: 1,
      virtualCountdownActive: false,
      virtualCountdownStartedAtMs: NaN,
      virtualCountdownDurationMs: 15000,
      virtualCountdownLaunchIndex: -1,
      virtualCountdownLaunchTsMs: NaN,
      virtualCountdownBaseSample: null,
      fileName: "",
      sourceFiles: [],
      parserLabel: "",
      dataMode: null,
      synchronizedStages: false,
      syncId: 0,
      appCommunicationRecorded: false,
      linkQualityAvailable: false,
      linkSamples: [],
      linkSeries: {rssi:[], loss:[], hz:[]},
      linkDefinitions: null
    };
    let replayLinkChartMetric = "rssi";
    let replayLinkStatusOpen = false;
    let replayLinkChartRaf = 0;
    let replayLinkChartResizeObserver = null;
    let replaySeekInteracting = false;
    let replaySeekProcessing = false;
    let replaySeekTaskToken = 0;
    let replaySeekDisplayIndex = -1;
    let replayFileLoader = null;
    let replayPickerRequestId = 0;
    let replayPickerTab = "flight";
    let replayPickerSessions = [];
    let replayRecentFileSelections = [];
    const REPLAY_SEEK_REBUILD_CHUNK = 900;
    const REPLAY_MIN_FRAME_DELAY_MS = 1;
    const REPLAY_MAX_FRAME_DELAY_MS = 120;
    const REPLAY_DEFAULT_FRAME_DELAY_MS = 10;
    // BIN recordings can contain 200 Hz telemetry. Rendering every stored
    // sample overloads the browser and makes media time fall behind wall time.
    const REPLAY_MIN_RENDER_INTERVAL_MS = 16;
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
      GPS_FIX_LOST: {
        level: ALERT_LEVEL.WARNING,
        textKey: "alarmGpsFixLost",
        clearKey: "alarmGpsFixRecovered",
        sticky: true,
        rateLimitMs: 8000
      },
      GPS_FIX_RECOVERED: {
        level: ALERT_LEVEL.INFO,
        textKey: "alarmGpsFixRecovered",
        rateLimitMs: 4000
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
    function quatSlerpShortest(fromQuat, toQuat, amount){
      const from = quatNormalize(fromQuat);
      let to = quatNormalize(toQuat);
      let dot = (from[0] * to[0]) + (from[1] * to[1]) +
        (from[2] * to[2]) + (from[3] * to[3]);
      if(dot < 0){
        to = [-to[0], -to[1], -to[2], -to[3]];
        dot = -dot;
      }
      const t = clampLocal(Number(amount) || 0, 0, 1);
      if(dot > 0.9995){
        return quatNormalize([
          from[0] + ((to[0] - from[0]) * t),
          from[1] + ((to[1] - from[1]) * t),
          from[2] + ((to[2] - from[2]) * t),
          from[3] + ((to[3] - from[3]) * t)
        ]);
      }
      const theta = Math.acos(clampLocal(dot, -1, 1));
      const sinTheta = Math.sin(theta);
      if(Math.abs(sinTheta) < 1e-6) return to;
      const a = Math.sin((1 - t) * theta) / sinTheta;
      const b = Math.sin(t * theta) / sinTheta;
      return quatNormalize([
        (from[0] * a) + (to[0] * b),
        (from[1] * a) + (to[1] * b),
        (from[2] * a) + (to[2] * b),
        (from[3] * a) + (to[3] * b)
      ]);
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
    function quatRotateVector(q, vector){
      const nq = quatNormalize(q);
      const w = nq[0], x = nq[1], y = nq[2], z = nq[3];
      const vx = Number(vector && vector[0]) || 0;
      const vy = Number(vector && vector[1]) || 0;
      const vz = Number(vector && vector[2]) || 0;
      const tx = 2 * ((y * vz) - (z * vy));
      const ty = 2 * ((z * vx) - (x * vz));
      const tz = 2 * ((x * vy) - (y * vx));
      return [
        vx + (w * tx) + (y * tz) - (z * ty),
        vy + (w * ty) + (z * tx) - (x * tz),
        vz + (w * tz) + (x * ty) - (y * tx)
      ];
    }
    function quatFromRenderEuler(pitchDeg, yawDeg, rollDeg){
      const qX = quatFromAxisAngle([1,0,0], (Number(rollDeg) || 0) * DEG_TO_RAD);
      const qY = quatFromAxisAngle([0,1,0], (Number(pitchDeg) || 0) * DEG_TO_RAD);
      const qZ = quatFromAxisAngle([0,0,1], (Number(yawDeg) || 0) * DEG_TO_RAD);
      const sensorQuat = quatNormalize(quatMul(qZ, quatMul(qY, qX)));
      // Keep attitude and mesh in the exact same basis used by the 3MF parser:
      // source/sensor X -> render X, Y -> -Z, Z -> render Y.
      return quatNormalize([
        sensorQuat[0],
        sensorQuat[1],
        sensorQuat[3],
        -sensorQuat[2]
      ]);
    }
    function quatFromFirmwareAttitude(rawQuat){
      let values = null;
      if(Array.isArray(rawQuat) || ArrayBuffer.isView(rawQuat)){
        values = rawQuat;
      }else if(rawQuat && typeof rawQuat === "object"){
        values = [
          rawQuat.w ?? rawQuat.qw,
          rawQuat.x ?? rawQuat.qx,
          rawQuat.y ?? rawQuat.qy,
          rawQuat.z ?? rawQuat.qz
        ];
      }
      if(!values || values.length < 4) return null;
      const qw = Number(values[0]);
      const qx = Number(values[1]);
      const qy = Number(values[2]);
      const qz = Number(values[3]);
      const norm = Math.hypot(qw, qx, qy, qz);
      if(!isFinite(norm) || norm < 0.5 || norm > 1.5) return null;
      // Firmware quaternion is sensor X/Y/Z. Convert it once into the render
      // X/-Z/Y basis. This avoids reconstructing a quaternion from Euler
      // angles at the pitch singularity during launch.
      return quatNormalize([qw, qx, qz, -qy]);
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
      const targetPitchDeg = 0;
      const targetYawDeg = 0;
      const targetRollDeg = 0;
      gyroZeroRollOffsetDeg = targetRollDeg - gyroRollDeg;
      gyroZeroPitchOffsetDeg = targetPitchDeg - gyroPitchDeg;
      gyroZeroYawOffsetDeg = -gyroYawDeg;
      const targetQuat = quatFromRenderEuler(targetPitchDeg, targetYawDeg, targetRollDeg);
      gyroZeroQuat = quatNormalize(quatMul(targetQuat, quatConjugate(quatNormalize(gyroAttitudeQuat))));
      updateGyroUiAttitudeFromEuler(gyroRollDeg, gyroPitchDeg, gyroYawDeg, false);
      return true;
    }
    function quatFromVehicleUiEuler(rollDeg, pitchDeg, yawDeg){
      const qRoll = quatFromAxisAngle([1,0,0], (Number(rollDeg) || 0) * DEG_TO_RAD);
      const qPitch = quatFromAxisAngle([0,0,-1], (Number(pitchDeg) || 0) * DEG_TO_RAD);
      const qYaw = quatFromAxisAngle([0,1,0], (Number(yawDeg) || 0) * DEG_TO_RAD);
      return quatNormalize(quatMul(qYaw, quatMul(qPitch, qRoll)));
    }
    function updateGyroUiAttitudeFromEuler(rollDeg, pitchDeg, yawDeg, smooth){
      const target = quatFromVehicleUiEuler(
        getGyroDisplayRollDeg(rollDeg),
        getGyroDisplayPitchDeg(pitchDeg),
        getGyroDisplayYawDeg(yawDeg)
      );
      if(smooth && gyroUiAttitudeReady){
        const current = quatNormalize(gyroUiAttitudeQuat);
        const dot = Math.abs(
          (current[0] * target[0]) + (current[1] * target[1]) +
          (current[2] * target[2]) + (current[3] * target[3])
        );
        const angleDeg = 2 * Math.acos(clampLocal(dot, -1, 1)) * RAD_TO_DEG;
        const response = angleDeg > 35 ? 0.58 : (angleDeg > 8 ? 0.38 : 0.24);
        gyroUiAttitudeQuat = quatSlerpShortest(current, target, response);
      }else{
        gyroUiAttitudeQuat = target;
      }
      gyroUiAttitudeReady = true;
    }
    function getGyroRocketModelQuat(){
      const baseQuat = quatFromAxisAngle([1,0,0], GYRO_ROCKET_RENDER_PITCH_UPRIGHT_DEG * DEG_TO_RAD);
      return quatNormalize(quatMul(gyroUiAttitudeQuat, baseQuat));
    }
    function resetGyroAttitudeState(){
      gyroLastUiMs = 0;
      gyroAttitudeLastMs = 0;
      gyroAttitudeReady = false;
      gyroYawDeg = 0;
      gyroPitchDeg = 0;
      gyroRollDeg = 0;
      gyroAttitudeQuat = [1,0,0,0];
      gyroUiAttitudeQuat = [1,0,0,0];
      gyroUiAttitudeReady = false;
      gyroZeroRollOffsetDeg = 0;
      gyroZeroPitchOffsetDeg = 0;
      gyroZeroYawOffsetDeg = 0;
      gyroZeroQuat = [1,0,0,0];
    }
    function clearLocalGyroZeroReference(){
      gyroZeroRollOffsetDeg = 0;
      gyroZeroPitchOffsetDeg = 0;
      gyroZeroYawOffsetDeg = 0;
      gyroZeroQuat = [1,0,0,0];
      updateGyroUiAttitudeFromEuler(gyroRollDeg, gyroPitchDeg, gyroYawDeg, false);
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

    function gyroTerrainTileUrl(template, z, x, y){
      return template.replace("{z}", z).replace("{x}", x).replace("{y}", y);
    }

    function gyroTerrainWorldPixel(lat, lon, zoom){
      const scale = 256 * Math.pow(2, zoom);
      const safeLat = clampLocal(Number(lat), -85.05112878, 85.05112878);
      const sinLat = Math.sin(safeLat * DEG_TO_RAD);
      return {
        x: ((Number(lon) + 180) / 360) * scale,
        y: (0.5 - (Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))) * scale
      };
    }

    async function loadGyroTerrainTile(url){
      const response = await fetch(url, {mode:"cors", cache:"default"});
      if(!response.ok) throw new Error("tile " + response.status);
      const blob = await response.blob();
      if(typeof createImageBitmap === "function") return createImageBitmap(blob);
      return new Promise((resolve, reject)=>{
        const image = new Image();
        const objectUrl = URL.createObjectURL(blob);
        image.onload = ()=>{
          URL.revokeObjectURL(objectUrl);
          resolve(image);
        };
        image.onerror = ()=>{
          URL.revokeObjectURL(objectUrl);
          reject(new Error("tile image decode failed"));
        };
        image.src = objectUrl;
      });
    }

    function decodeTerrariumHeight(r, g, b){
      return (r * 256) + g + (b / 256) - 32768;
    }

    async function requestGyroBuildingFootprints(lat, lon){
      const latDelta = GYRO_TERRAIN_BUILDING_RADIUS_M / 111320;
      const lonDelta = GYRO_TERRAIN_BUILDING_RADIUS_M /
        Math.max(1, 111320 * Math.cos(Number(lat) * DEG_TO_RAD));
      const bbox = [
        Number(lon) - lonDelta,
        Number(lat) - latDelta,
        Number(lon) + lonDelta,
        Number(lat) + latDelta
      ].map((value)=>value.toFixed(7)).join(",");
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller ? setTimeout(()=>controller.abort(), GYRO_TERRAIN_BUILDING_TIMEOUT_MS) : 0;
      try{
        const response = await fetch(
          GYRO_TERRAIN_BUILDING_URL + "?bbox=" + encodeURIComponent(bbox),
          {mode:"cors", cache:"default", signal:controller ? controller.signal : undefined}
        );
        if(!response.ok) throw new Error("building " + response.status);
        const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
        if(xml.querySelector("parsererror")) throw new Error("building XML parse failed");
        const nodes = new Map();
        xml.querySelectorAll("node").forEach((node)=>{
          nodes.set(node.getAttribute("id"), {
            lat:Number(node.getAttribute("lat")),
            lon:Number(node.getAttribute("lon"))
          });
        });
        const buildings = [];
        xml.querySelectorAll("way").forEach((way)=>{
          const tags = {};
          way.querySelectorAll(":scope > tag").forEach((tag)=>{
            tags[tag.getAttribute("k")] = tag.getAttribute("v");
          });
          if(!tags.building && !tags["building:part"]) return;
          const geometry = [];
          way.querySelectorAll(":scope > nd").forEach((nd)=>{
            const point = nodes.get(nd.getAttribute("ref"));
            if(point && isFinite(point.lat) && isFinite(point.lon)) geometry.push(point);
          });
          if(geometry.length >= 4) buildings.push({tags, geometry});
        });
        return buildings.slice(0, 1500);
      }finally{
        if(timer) clearTimeout(timer);
      }
    }

    function triangulateBuildingRing(ring){
      if(!Array.isArray(ring) || ring.length < 3) return [];
      const indices = ring.map((_, index)=>index);
      const triangles = [];
      const cross2 = (a, b, c)=>
        ((b.x - a.x) * (c.z - a.z)) - ((b.z - a.z) * (c.x - a.x));
      const pointInTriangle = (p, a, b, c)=>{
        const c1 = cross2(a, b, p);
        const c2 = cross2(b, c, p);
        const c3 = cross2(c, a, p);
        return c1 >= -0.0001 && c2 >= -0.0001 && c3 >= -0.0001;
      };
      let guard = ring.length * ring.length;
      while(indices.length > 3 && guard-- > 0){
        let clipped = false;
        for(let i=0;i<indices.length;i++){
          const prev = indices[(i + indices.length - 1) % indices.length];
          const curr = indices[i];
          const next = indices[(i + 1) % indices.length];
          const a = ring[prev], b = ring[curr], c = ring[next];
          if(cross2(a, b, c) <= 0.0001) continue;
          let containsPoint = false;
          for(let j=0;j<indices.length;j++){
            const test = indices[j];
            if(test === prev || test === curr || test === next) continue;
            if(pointInTriangle(ring[test], a, b, c)){
              containsPoint = true;
              break;
            }
          }
          if(containsPoint) continue;
          triangles.push([prev, curr, next]);
          indices.splice(i, 1);
          clipped = true;
          break;
        }
        if(!clipped) break;
      }
      if(indices.length === 3) triangles.push([indices[0], indices[1], indices[2]]);
      return triangles;
    }

    function buildGyroBuildingMesh(elements, originLat, originLon, heights, centerElevationM){
      const mesh = {pos:[], norm:[], col:[], count:0};
      if(!Array.isArray(elements) || !heights || !heights.length) return mesh;
      const size = GYRO_TERRAIN_GRID_SIZE;
      const halfSpan = GYRO_TERRAIN_SPAN_M * 0.5;
      const stepM = GYRO_TERRAIN_SPAN_M / (size - 1);
      const metersPerLon = 111320 * Math.cos(Number(originLat) * DEG_TO_RAD);
      const groundAt = (eastM, northM)=>{
        const col = clampLocal(Math.round((eastM + halfSpan) / stepM), 0, size - 1);
        const row = clampLocal(Math.round((halfSpan - northM) / stepM), 0, size - 1);
        return heights[(row * size) + col] - centerElevationM;
      };
      const parseHeight = (tags)=>{
        const explicit = parseFloat(String(tags && tags.height != null ? tags.height : "").replace(",", "."));
        if(isFinite(explicit) && explicit > 0) return clampLocal(explicit, 2.5, 70);
        const levels = parseFloat(String(tags && tags["building:levels"] != null ? tags["building:levels"] : ""));
        if(isFinite(levels) && levels > 0) return clampLocal(levels * 3.15, 2.5, 70);
        const kind = String(tags && (tags.building || tags["building:part"]) || "").toLowerCase();
        if(kind === "shed" || kind === "garage" || kind === "garages") return 4.2;
        if(kind === "house" || kind === "residential" || kind === "detached") return 7.2;
        if(kind === "industrial" || kind === "warehouse") return 10.5;
        return 8.5;
      };
      elements.forEach((element)=>{
        const geometry = Array.isArray(element && element.geometry) ? element.geometry : [];
        if(geometry.length < 4) return;
        let ring = geometry.map((point)=>{
          const pointLat = Number(point && point.lat);
          const pointLon = Number(point && point.lon);
          if(!isFinite(pointLat) || !isFinite(pointLon)) return null;
          return {
            x:(pointLon - originLon) * metersPerLon,
            z:(pointLat - originLat) * 111320
          };
        }).filter(Boolean);
        if(ring.length < 4) return;
        if(Math.hypot(ring[0].x - ring[ring.length - 1].x, ring[0].z - ring[ring.length - 1].z) < 0.2){
          ring.pop();
        }
        if(ring.length < 3) return;
        let signedArea = 0;
        for(let i=0;i<ring.length;i++){
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          signedArea += (a.x * b.z) - (b.x * a.z);
        }
        if(signedArea < 0) ring = ring.slice().reverse();
        const buildingHeight = parseHeight(element.tags || {});
        let centerX = 0, centerZ = 0, centerGround = 0;
        ring.forEach((point)=>{
          centerX += point.x;
          centerZ += point.z;
          centerGround += groundAt(point.x, point.z);
        });
        centerX /= ring.length;
        centerZ /= ring.length;
        centerGround /= ring.length;
        const baseGround = centerGround - 0.18;
        const toneVariation = (Math.sin((centerX * 0.031) + (centerZ * 0.023)) + 1) * 0.025;
        const wallTone = 0.42 + toneVariation;
        const roofTone = Math.min(0.68, wallTone + 0.15);
        const wallColor = [wallTone, wallTone + 0.008, wallTone + 0.014, 1];
        const roofColor = [roofTone, roofTone, roofTone - 0.008, 1];
        for(let i=0;i<ring.length;i++){
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          const a0 = [a.x, baseGround, a.z];
          const b0 = [b.x, baseGround, b.z];
          const a1 = [a.x, baseGround + buildingHeight, a.z];
          const b1 = [b.x, baseGround + buildingHeight, b.z];
          const wallNormal = vec3Normalize([b.z - a.z, 0, -(b.x - a.x)]);
          pushSolidTri(mesh, a0, b0, b1, wallColor, wallNormal, wallNormal, wallNormal);
          pushSolidTri(mesh, a0, b1, a1, wallColor, wallNormal, wallNormal, wallNormal);
        }
        const roofY = baseGround + buildingHeight;
        const roofTriangles = triangulateBuildingRing(ring);
        for(const triangle of roofTriangles){
          const a = ring[triangle[0]];
          const b = ring[triangle[1]];
          const c = ring[triangle[2]];
          pushSolidTri(
            mesh,
            [a.x, roofY, a.z],
            [b.x, roofY, b.z],
            [c.x, roofY, c.z],
            roofColor,
            [0,1,0], [0,1,0], [0,1,0]
          );
        }
      });
      return mesh;
    }

    function buildGyroTerrainMesh(heightData, textureCanvas, metersPerPixel, sourceLeft, sourceTop, sourceSpanPx){
      const size = GYRO_TERRAIN_GRID_SIZE;
      const halfSpan = GYRO_TERRAIN_SPAN_M * 0.5;
      const stepM = GYRO_TERRAIN_SPAN_M / (size - 1);
      const heights = new Float32Array(size * size);
      const sampleHeight = (sourceX, sourceY)=>{
        const x = clampLocal(Math.round(sourceX), 0, heightData.width - 1);
        const y = clampLocal(Math.round(sourceY), 0, heightData.height - 1);
        const i = ((y * heightData.width) + x) * 4;
        return decodeTerrariumHeight(heightData.data[i], heightData.data[i + 1], heightData.data[i + 2]);
      };
      for(let row=0;row<size;row++){
        for(let col=0;col<size;col++){
          const sourceX = sourceLeft + ((col / (size - 1)) * sourceSpanPx);
          const sourceY = sourceTop + ((row / (size - 1)) * sourceSpanPx);
          heights[(row * size) + col] = sampleHeight(sourceX, sourceY);
        }
      }
      const centerElevationM = heights[((size >> 1) * size) + (size >> 1)];
      const vertex = (row, col)=>{
        const index = (row * size) + col;
        const left = heights[(row * size) + Math.max(0, col - 1)];
        const right = heights[(row * size) + Math.min(size - 1, col + 1)];
        const north = heights[(Math.max(0, row - 1) * size) + col];
        const south = heights[(Math.min(size - 1, row + 1) * size) + col];
        const dxDen = stepM * (col > 0 && col < size - 1 ? 2 : 1);
        const dzDen = stepM * (row > 0 && row < size - 1 ? 2 : 1);
        const dhdx = (right - left) / Math.max(0.001, dxDen);
        const dhdz = (north - south) / Math.max(0.001, dzDen);
        const normal = vec3Normalize([
          -dhdx,
          1,
          -dhdz
        ]);
        return {
          pos:[
            -halfSpan + (col * stepM),
            heights[index] - centerElevationM,
            halfSpan - (row * stepM)
          ],
          norm:normal,
          uv:[col / (size - 1), row / (size - 1)]
        };
      };
      const positions = [];
      const normals = [];
      const uvs = [];
      const push = (v)=>{
        positions.push(v.pos[0], v.pos[1], v.pos[2]);
        normals.push(v.norm[0], v.norm[1], v.norm[2]);
        uvs.push(v.uv[0], v.uv[1]);
      };
      for(let row=0;row<size-1;row++){
        for(let col=0;col<size-1;col++){
          const a = vertex(row, col);
          const b = vertex(row + 1, col);
          const c = vertex(row + 1, col + 1);
          const d = vertex(row, col + 1);
          push(a); push(b); push(c);
          push(a); push(c); push(d);
        }
      }
      return {
        pos:positions,
        norm:normals,
        uv:uvs,
        count:positions.length / 3,
        textureCanvas,
        centerElevationM,
        metersPerPixel,
        heightGrid:heights
      };
    }

    async function requestGyroTerrainMesh(lat, lon, token){
      const zoom = GYRO_TERRAIN_ZOOM;
      const buildingPromise = requestGyroBuildingFootprints(lat, lon).catch((error)=>{
        console.warn("[gyro] 3D buildings unavailable:", error);
        return [];
      });
      const centerPx = gyroTerrainWorldPixel(lat, lon, zoom);
      const earthCircumferenceM = 40075016.686;
      const metersPerPixel = Math.cos(Number(lat) * DEG_TO_RAD) * earthCircumferenceM /
        (256 * Math.pow(2, zoom));
      const sourceSpanPx = GYRO_TERRAIN_SPAN_M / Math.max(0.01, metersPerPixel);
      const worldLeft = centerPx.x - (sourceSpanPx * 0.5);
      const worldTop = centerPx.y - (sourceSpanPx * 0.5);
      const worldRight = worldLeft + sourceSpanPx;
      const worldBottom = worldTop + sourceSpanPx;
      const minTileX = Math.floor(worldLeft / 256);
      const maxTileX = Math.floor(worldRight / 256);
      const minTileY = Math.floor(worldTop / 256);
      const maxTileY = Math.floor(worldBottom / 256);
      const tileCols = (maxTileX - minTileX) + 1;
      const tileRows = (maxTileY - minTileY) + 1;
      const elevationCanvas = document.createElement("canvas");
      elevationCanvas.width = tileCols * 256;
      elevationCanvas.height = tileRows * 256;
      const elevationCtx = elevationCanvas.getContext("2d", {willReadFrequently:true});
      if(!elevationCtx) throw new Error("terrain canvas unavailable");
      const tasks = [];
      for(let tileY=minTileY;tileY<=maxTileY;tileY++){
        for(let tileX=minTileX;tileX<=maxTileX;tileX++){
          const dx = (tileX - minTileX) * 256;
          const dy = (tileY - minTileY) * 256;
          tasks.push((async ()=>{
            const elevation = await loadGyroTerrainTile(gyroTerrainTileUrl(
              GYRO_TERRAIN_ELEVATION_URL, zoom, tileX, tileY
            ));
            if(token !== gyroTerrainState.requestToken) return;
            elevationCtx.drawImage(elevation, dx, dy, 256, 256);
            if(typeof elevation.close === "function") elevation.close();
          })());
        }
      }
      await Promise.all(tasks);
      if(token !== gyroTerrainState.requestToken) throw new Error("terrain request superseded");
      const localLeft = worldLeft - (minTileX * 256);
      const localTop = worldTop - (minTileY * 256);
      const heightData = elevationCtx.getImageData(0, 0, elevationCanvas.width, elevationCanvas.height);
      const mapZoom = GYRO_TERRAIN_MAP_ZOOM;
      const mapCenterPx = gyroTerrainWorldPixel(lat, lon, mapZoom);
      const mapMetersPerPixel = Math.cos(Number(lat) * DEG_TO_RAD) * earthCircumferenceM /
        (256 * Math.pow(2, mapZoom));
      const mapSourceSpanPx = GYRO_TERRAIN_SPAN_M / Math.max(0.01, mapMetersPerPixel);
      const mapWorldLeft = mapCenterPx.x - (mapSourceSpanPx * 0.5);
      const mapWorldTop = mapCenterPx.y - (mapSourceSpanPx * 0.5);
      const mapMinTileX = Math.floor(mapWorldLeft / 256);
      const mapMaxTileX = Math.floor((mapWorldLeft + mapSourceSpanPx) / 256);
      const mapMinTileY = Math.floor(mapWorldTop / 256);
      const mapMaxTileY = Math.floor((mapWorldTop + mapSourceSpanPx) / 256);
      const mapCanvas = document.createElement("canvas");
      mapCanvas.width = ((mapMaxTileX - mapMinTileX) + 1) * GYRO_TERRAIN_MAP_TILE_SIZE;
      mapCanvas.height = ((mapMaxTileY - mapMinTileY) + 1) * GYRO_TERRAIN_MAP_TILE_SIZE;
      const mapCtx = mapCanvas.getContext("2d");
      const mapTasks = [];
      let mapTileCount = 0;
      for(let tileY=mapMinTileY;tileY<=mapMaxTileY;tileY++){
        for(let tileX=mapMinTileX;tileX<=mapMaxTileX;tileX++){
          const dx = (tileX - mapMinTileX) * GYRO_TERRAIN_MAP_TILE_SIZE;
          const dy = (tileY - mapMinTileY) * GYRO_TERRAIN_MAP_TILE_SIZE;
          mapTasks.push((async ()=>{
            const mapImage = await loadGyroTerrainTile(gyroTerrainTileUrl(
              GYRO_TERRAIN_MAP_URL, mapZoom, tileX, tileY
            ));
            if(token !== gyroTerrainState.requestToken) return;
            if(mapCtx) mapCtx.drawImage(
              mapImage,
              dx,
              dy,
              GYRO_TERRAIN_MAP_TILE_SIZE,
              GYRO_TERRAIN_MAP_TILE_SIZE
            );
            mapTileCount++;
            if(typeof mapImage.close === "function") mapImage.close();
          })());
        }
      }
      try{
        await Promise.all(mapTasks);
      }catch(_mapError){}
      const mapTileScale = GYRO_TERRAIN_MAP_TILE_SIZE / 256;
      const mapLocalLeft = (mapWorldLeft - (mapMinTileX * 256)) * mapTileScale;
      const mapLocalTop = (mapWorldTop - (mapMinTileY * 256)) * mapTileScale;
      const mapTextureSpanPx = mapSourceSpanPx * mapTileScale;
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = GYRO_TERRAIN_TEXTURE_SIZE;
      textureCanvas.height = GYRO_TERRAIN_TEXTURE_SIZE;
      const textureCtx = textureCanvas.getContext("2d");
      if(!textureCtx) throw new Error("terrain texture canvas unavailable");
      if(mapTileCount === mapTasks.length && mapCtx){
        textureCtx.drawImage(
          mapCanvas,
          mapLocalLeft, mapLocalTop, mapTextureSpanPx, mapTextureSpanPx,
          0, 0, textureCanvas.width, textureCanvas.height
        );
      }else{
        const gradient = textureCtx.createLinearGradient(0, 0, textureCanvas.width, textureCanvas.height);
        gradient.addColorStop(0, "#27362f");
        gradient.addColorStop(0.5, "#18251f");
        gradient.addColorStop(1, "#101a18");
        textureCtx.fillStyle = gradient;
        textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
      }
      const terrainMesh = buildGyroTerrainMesh(
        heightData,
        textureCanvas,
        metersPerPixel,
        localLeft,
        localTop,
        sourceSpanPx
      );
      terrainMesh.buildingPromise = buildingPromise.then((buildingElements)=>buildGyroBuildingMesh(
        buildingElements,
        Number(lat),
        Number(lon),
        terrainMesh.heightGrid,
        terrainMesh.centerElevationM
      ));
      return terrainMesh;
    }

    function releaseGyroTerrainGlResources(){
      if(!gyroGl || !gyroGl.gl || !gyroGl.terrain) return;
      const gl = gyroGl.gl;
      const terrain = gyroGl.terrain;
      if(terrain.posBuf) gl.deleteBuffer(terrain.posBuf);
      if(terrain.normBuf) gl.deleteBuffer(terrain.normBuf);
      if(terrain.uvBuf) gl.deleteBuffer(terrain.uvBuf);
      if(terrain.texture) gl.deleteTexture(terrain.texture);
      if(terrain.buildingPosBuf) gl.deleteBuffer(terrain.buildingPosBuf);
      if(terrain.buildingNormBuf) gl.deleteBuffer(terrain.buildingNormBuf);
      if(terrain.buildingColBuf) gl.deleteBuffer(terrain.buildingColBuf);
      terrain.posBuf = null;
      terrain.normBuf = null;
      terrain.uvBuf = null;
      terrain.texture = null;
      terrain.count = 0;
      terrain.buildingPosBuf = null;
      terrain.buildingNormBuf = null;
      terrain.buildingColBuf = null;
      terrain.buildingCount = 0;
    }

    function applyGyroTerrainMeshToGl(mesh){
      if(!gyroGl || !gyroGl.gl || !gyroGl.terrain || !mesh || !mesh.count) return false;
      const gl = gyroGl.gl;
      const terrain = gyroGl.terrain;
      releaseGyroTerrainGlResources();
      terrain.posBuf = createGyroArrayBuffer(gl, mesh.pos, gl.STATIC_DRAW);
      terrain.normBuf = createGyroArrayBuffer(gl, mesh.norm, gl.STATIC_DRAW);
      terrain.uvBuf = createGyroArrayBuffer(gl, mesh.uv, gl.STATIC_DRAW);
      terrain.count = mesh.count;
      terrain.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, terrain.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mesh.textureCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
      const cameraAtDefaultDistance = Math.abs(gyroCameraState.distance - GYRO_CAMERA_DEFAULT.distance) < 0.18 &&
        Math.abs(gyroCameraState.desiredDistance - GYRO_CAMERA_DEFAULT.distance) < 0.18;
      if(cameraAtDefaultDistance){
        gyroCameraState.pitchDeg = 20;
        gyroCameraState.distance = GYRO_TERRAIN_DEFAULT_CAMERA_DISTANCE;
        gyroCameraState.desiredDistance = GYRO_TERRAIN_DEFAULT_CAMERA_DISTANCE;
      }
      return true;
    }

    function applyGyroBuildingsToGl(buildings){
      if(!gyroGl || !gyroGl.gl || !gyroGl.terrain) return false;
      const gl = gyroGl.gl;
      const terrain = gyroGl.terrain;
      if(terrain.buildingPosBuf) gl.deleteBuffer(terrain.buildingPosBuf);
      if(terrain.buildingNormBuf) gl.deleteBuffer(terrain.buildingNormBuf);
      if(terrain.buildingColBuf) gl.deleteBuffer(terrain.buildingColBuf);
      terrain.buildingPosBuf = null;
      terrain.buildingNormBuf = null;
      terrain.buildingColBuf = null;
      terrain.buildingCount = 0;
      if(buildings && buildings.count){
        terrain.buildingPosBuf = createGyroArrayBuffer(gl, buildings.pos, gl.STATIC_DRAW);
        terrain.buildingNormBuf = createGyroArrayBuffer(gl, buildings.norm, gl.STATIC_DRAW);
        terrain.buildingColBuf = createGyroArrayBuffer(gl, buildings.col, gl.STATIC_DRAW);
        terrain.buildingCount = buildings.count;
      }
      return terrain.buildingCount > 0;
    }

    function resetGyroTerrain(){
      gyroTerrainState.requestToken++;
      gyroTerrainState.status = "idle";
      gyroTerrainState.key = "";
      gyroTerrainState.retryAt = 0;
      gyroTerrainState.originLat = NaN;
      gyroTerrainState.originLon = NaN;
      gyroTerrainState.centerElevationM = 0;
      gyroTerrainState.mesh = null;
      releaseGyroTerrainGlResources();
      document.documentElement.classList.remove("gyro-terrain-ready");
    }

    function getGyroTerrainReferenceGeo(){
      if(latestTelemetryGeo &&
         isFinite(Number(latestTelemetryGeo.lat)) &&
         isFinite(Number(latestTelemetryGeo.lon))){
        return latestTelemetryGeo;
      }
      if(statusMapState &&
         isFinite(Number(statusMapState.lat)) &&
         isFinite(Number(statusMapState.lon))){
        return {lat:Number(statusMapState.lat), lon:Number(statusMapState.lon)};
      }
      return {lat:STATUS_MAP_DEFAULT.lat, lon:STATUS_MAP_DEFAULT.lon};
    }

    function ensureGyroTerrainForGeo(geo){
      if(!GYRO_TERRAIN_ENABLED){
        if(gyroTerrainState.status !== "idle" || gyroTerrainState.mesh){
          resetGyroTerrain();
        }else{
          document.documentElement.classList.remove("gyro-terrain-ready");
        }
        return;
      }
      if(!geo || !isFinite(Number(geo.lat)) || !isFinite(Number(geo.lon))) return;
      if(getGyroPreviewMode() !== "3d") return;
      const lat = Number(gyroPathState.originLat != null ? gyroPathState.originLat : geo.lat);
      const lon = Number(gyroPathState.originLon != null ? gyroPathState.originLon : geo.lon);
      const key = lat.toFixed(5) + "," + lon.toFixed(5) + "@" + GYRO_TERRAIN_ZOOM;
      if(gyroTerrainState.status === "ready" && gyroTerrainState.key === key) return;
      if(gyroTerrainState.status === "loading" && gyroTerrainState.key === key) return;
      if(gyroTerrainState.status === "error" && gyroTerrainState.key === key && Date.now() < gyroTerrainState.retryAt) return;
      const token = ++gyroTerrainState.requestToken;
      gyroTerrainState.status = "loading";
      gyroTerrainState.key = key;
      gyroTerrainState.originLat = lat;
      gyroTerrainState.originLon = lon;
      document.documentElement.classList.remove("gyro-terrain-ready");
      requestGyroTerrainMesh(lat, lon, token).then((mesh)=>{
        if(token !== gyroTerrainState.requestToken) return;
        gyroTerrainState.mesh = mesh;
        gyroTerrainState.centerElevationM = mesh.centerElevationM;
        if(!applyGyroTerrainMeshToGl(mesh)) throw new Error("terrain GPU upload failed");
        gyroTerrainState.status = "ready";
        document.documentElement.classList.add("gyro-terrain-ready");
        renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        if(mesh.buildingPromise){
          mesh.buildingPromise.then((buildings)=>{
            if(token !== gyroTerrainState.requestToken) return;
            applyGyroBuildingsToGl(buildings);
            renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          });
        }
      }).catch((error)=>{
        if(token !== gyroTerrainState.requestToken) return;
        gyroTerrainState.status = "error";
        gyroTerrainState.retryAt = Date.now() + GYRO_TERRAIN_RETRY_MS;
        gyroTerrainState.mesh = null;
        document.documentElement.classList.remove("gyro-terrain-ready");
        console.warn("[gyro] terrain unavailable, using grid fallback:", error);
      });
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

function requestGyroRocketMesh(){
      if(gyroRocketMeshPromise) return gyroRocketMeshPromise;
      const modelCandidates = [
        new URL(GYRO_ROCKET_MODEL_PATH, window.location.href).href,
        new URL("./3d/assembly.model", window.location.href).href,
        new URL("/3d/assembly.model", window.location.origin).href,
        new URL("/flash6/3d/assembly.model", window.location.origin).href
      ];
      const sourceCandidates = [
        new URL(GYRO_ROCKET_3MF_PATH, window.location.href).href,
        new URL("./3d/assembly.3mf", window.location.href).href,
        new URL("/3d/assembly.3mf", window.location.origin).href,
        new URL("/flash6/3d/assembly.3mf", window.location.origin).href
      ];
      gyroRocketMeshPromise = (async ()=>{
        const api = (typeof window !== "undefined") ? window.FLASH6_MESH : null;
        if(!api || typeof api.parseMobileMockup3mfMesh !== "function") return null;
        for(const src of Array.from(new Set(modelCandidates))){
          try{
            const res = await fetch(src, {cache:"no-store"});
            if(!res.ok) continue;
            const xml = await res.text();
            return api.parseMobileMockup3mfMesh(xml, {
              maxTriangles: GYRO_ROCKET_3MF_MAX_TRIANGLES,
              targetSpan: GYRO_ROCKET_TARGET_LENGTH,
              splitSourceZ:924
            });
          }catch(err){
            console.warn("[gyro] assembly.model load failed:", src, err);
          }
        }
        for(const src of Array.from(new Set(sourceCandidates))){
          try{
            const res = await fetch(src, {cache:"no-store"});
            if(!res.ok) continue;
            const buf = await res.arrayBuffer();
            const xml = await readZipTextEntry(buf, ["3D/3dmodel.model", "3d/3dmodel.model"]);
            return api.parseMobileMockup3mfMesh(xml, {
              maxTriangles: GYRO_ROCKET_3MF_MAX_TRIANGLES,
              targetSpan: GYRO_ROCKET_TARGET_LENGTH,
              splitSourceZ:924
            });
          }catch(err){
            console.warn("[gyro] assembly.3mf load failed:", src, err);
          }
        }
        console.warn("[gyro] assembly model failed to load");
        return null;
      })();
      return gyroRocketMeshPromise;
    }

    function gyroMeshBoundsCenter(positionSets){
      const sets = Array.isArray(positionSets) ? positionSets : [positionSets];
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      sets.forEach((positions)=>{
        if(!positions) return;
        for(let i=0;i+2<positions.length;i+=3){
          const x = Number(positions[i]);
          const y = Number(positions[i + 1]);
          const z = Number(positions[i + 2]);
          if(!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        }
      });
      if(!isFinite(minX) || !isFinite(maxX)) return [0,0,0];
      return [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5];
    }

    function gyroMeshVisualCenter(positions){
      if(!positions || positions.length < 9) return gyroMeshBoundsCenter(positions);
      let weightedX = 0;
      let weightedY = 0;
      let weightedZ = 0;
      let totalArea = 0;
      for(let i=0;i+8<positions.length;i+=9){
        const ax = Number(positions[i]);
        const ay = Number(positions[i + 1]);
        const az = Number(positions[i + 2]);
        const bx = Number(positions[i + 3]);
        const by = Number(positions[i + 4]);
        const bz = Number(positions[i + 5]);
        const cx = Number(positions[i + 6]);
        const cy = Number(positions[i + 7]);
        const cz = Number(positions[i + 8]);
        if(![ax,ay,az,bx,by,bz,cx,cy,cz].every(isFinite)) continue;
        const abx = bx - ax;
        const aby = by - ay;
        const abz = bz - az;
        const acx = cx - ax;
        const acy = cy - ay;
        const acz = cz - az;
        const crossX = (aby * acz) - (abz * acy);
        const crossY = (abz * acx) - (abx * acz);
        const crossZ = (abx * acy) - (aby * acx);
        const area = Math.hypot(crossX, crossY, crossZ) * 0.5;
        if(!isFinite(area) || area <= 1e-10) continue;
        weightedX += ((ax + bx + cx) / 3) * area;
        weightedY += ((ay + by + cy) / 3) * area;
        weightedZ += ((az + bz + cz) / 3) * area;
        totalArea += area;
      }
      if(totalArea <= 1e-10) return gyroMeshBoundsCenter(positions);
      return [weightedX / totalArea, weightedY / totalArea, weightedZ / totalArea];
    }

    function gyroMeshFocusSamples(positions, maxPoints){
      if(!positions || positions.length < 3) return [];
      const pointCount = Math.floor(positions.length / 3);
      const stride = Math.max(1, Math.floor(pointCount / Math.max(1, maxPoints || 1800)));
      const samples = [];
      for(let pointIndex=0;pointIndex<pointCount;pointIndex+=stride){
        const i = pointIndex * 3;
        const x = Number(positions[i]);
        const y = Number(positions[i + 1]);
        const z = Number(positions[i + 2]);
        if(isFinite(x) && isFinite(y) && isFinite(z)) samples.push(x, y, z);
      }
      return samples;
    }

    function applyGyroRocketMeshToGl(mesh){
      if(!gyroGl || !gyroGl.gl || !gyroGl.solid || !mesh || !mesh.count) return false;
      const gl = gyroGl.gl;
      const solid = gyroGl.solid;
      const prevPos = solid.rocketPosBuf;
      const prevNorm = solid.rocketNormBuf;
      const prevCol = solid.rocketColBuf;
      const previousStages = solid.rocketStages;
      if(mesh.groups && mesh.groups.stage1 && mesh.groups.stage2){
        const makeStage = (group)=>({
          posBuf:createGyroArrayBuffer(gl, group.pos, gl.STATIC_DRAW),
          normBuf:createGyroArrayBuffer(gl, group.norm, gl.STATIC_DRAW),
          colBuf:createGyroArrayBuffer(gl, group.col, gl.STATIC_DRAW),
          count:group.count,
          visualCenter:gyroMeshVisualCenter(group.pos),
          focusSamples:gyroMeshFocusSamples(group.pos, 1800)
        });
        solid.rocketStages = {
          stage1:makeStage(mesh.groups.stage1),
          stage2:makeStage(mesh.groups.stage2)
        };
        solid.rocketVisualCenter = gyroMeshBoundsCenter([mesh.groups.stage1.pos, mesh.groups.stage2.pos]);
        solid.rocketPosBuf = null;
        solid.rocketNormBuf = null;
        solid.rocketColBuf = null;
        solid.rocketCount = 0;
      }else{
        solid.rocketStages = null;
        solid.rocketVisualCenter = gyroMeshBoundsCenter(mesh.pos);
        solid.rocketPosBuf = createGyroArrayBuffer(gl, mesh.pos, gl.STATIC_DRAW);
        solid.rocketNormBuf = createGyroArrayBuffer(gl, mesh.norm, gl.STATIC_DRAW);
        solid.rocketColBuf = createGyroArrayBuffer(gl, mesh.col, gl.STATIC_DRAW);
        solid.rocketCount = mesh.count;
      }
      if(prevPos) gl.deleteBuffer(prevPos);
      if(prevNorm) gl.deleteBuffer(prevNorm);
      if(prevCol) gl.deleteBuffer(prevCol);
      if(previousStages){
        [previousStages.stage1, previousStages.stage2].forEach((stage)=>{
          if(!stage) return;
          if(stage.posBuf) gl.deleteBuffer(stage.posBuf);
          if(stage.normBuf) gl.deleteBuffer(stage.normBuf);
          if(stage.colBuf) gl.deleteBuffer(stage.colBuf);
        });
      }
      return true;
    }

async function readZipTextEntry(arrayBuffer, wantedNames){
      const api = (typeof window !== "undefined") ? window.FLASH6_ZIP : null;
      if(!api || typeof api.readTextEntry !== "function"){
        throw new Error("FLASH6 ZIP helper missing");
      }
      return await api.readTextEntry(arrayBuffer, wantedNames);
    }

    function parseMobileMockup3mfMesh(xmlText){
      const api = (typeof window !== "undefined") ? window.FLASH6_MESH : null;
      if(!api || typeof api.parseMobileMockup3mfMesh !== "function"){
        throw new Error("FLASH6 mesh helper missing");
      }
      return api.parseMobileMockup3mfMesh(xmlText, {
        maxTriangles: MOBILE_MOCKUP_MAX_TRIANGLES
      });
    }

function requestMobileMockup3dMesh(){
      if(mobileMockup3dPromise) return mobileMockup3dPromise;
      const previewCandidates = [
        new URL(MOBILE_MOCKUP_PREVIEW_PATH, window.location.href).href,
        new URL("./3d/ALTIS_INTELLIGNET3b3_Mockup.preview.json", window.location.href).href,
        new URL("/3d/ALTIS_INTELLIGNET3b3_Mockup.preview.json", window.location.origin).href,
        new URL("/flash6/3d/ALTIS_INTELLIGNET3b3_Mockup.preview.json", window.location.origin).href
      ];
      const sourceCandidates = [
        new URL(MOBILE_MOCKUP_3MF_PATH, window.location.href).href,
        new URL("./3d/ALTIS INTELLIGNET3b3 Mockup.3mf", window.location.href).href,
        new URL("/3d/ALTIS INTELLIGNET3b3 Mockup.3mf", window.location.origin).href,
        new URL("/flash6/3d/ALTIS INTELLIGNET3b3 Mockup.3mf", window.location.origin).href
      ];
      mobileMockup3dPromise = (async ()=>{
        for(const src of Array.from(new Set(previewCandidates))){
          try{
            const res = await fetch(src, {cache:"no-store"});
            if(!res.ok) continue;
            const mesh = await res.json();
            if(mesh && mesh.count && mesh.pos && mesh.norm){
              return {
                pos: mesh.pos,
                norm: mesh.norm,
                col: mesh.col,
                count: mesh.count
              };
            }
          }catch(err){
            console.warn("[mobile mockup] preview mesh load failed:", src, err);
          }
        }
        for(const src of Array.from(new Set(sourceCandidates))){
          try{
            const res = await fetch(src, {cache:"no-store"});
            if(!res.ok) continue;
            const buf = await res.arrayBuffer();
            const xml = await readZipTextEntry(buf, ["3D/3dmodel.model", "3d/3dmodel.model"]);
            return parseMobileMockup3mfMesh(xml);
          }catch(err){
            console.warn("[mobile mockup] 3MF load failed:", src, err);
          }
        }
        return null;
      })();
      return mobileMockup3dPromise;
    }

    function buildMobileMockupColorArray(vertexCount){
      const count = Math.max(0, Math.round(Number(vertexCount) || 0));
      const out = new Array(count * 4);
      for(let i=0;i<count;i++){
        const j = i * 4;
        out[j] = 0.78;
        out[j + 1] = 0.78;
        out[j + 2] = 0.72;
        out[j + 3] = 1;
      }
      return out;
    }

    function resizeMobileMockup3d(){
      if(!mobileMockup3d || !mobileMockup3d.canvas) return;
      const canvas = mobileMockup3d.canvas;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if(canvas.width !== w || canvas.height !== h){
        canvas.width = w;
        canvas.height = h;
      }
      mobileMockup3d.width = w;
      mobileMockup3d.height = h;
    }

    function renderMobileMockup3d(ts){
      if(!mobileMockup3d || !mobileMockup3d.gl) return;
      resizeMobileMockup3d();
      const gl = mobileMockup3d.gl;
      const w = mobileMockup3d.width || 1;
      const h = mobileMockup3d.height || 1;
      gl.viewport(0, 0, w, h);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if(mobileMockup3d.meshCount > 0){
        const aspect = w / Math.max(1, h);
        const proj = mat4Perspective(42 * DEG_TO_RAD, aspect, 0.05, 80);
        const view = mat4LookAt([2.55, 1.55, 4.65], [0, 0.02, 0], [0, 1, 0]);
        const now = Number(ts) || 0;
        if(mobileMockup3d.autoSpin && !mobileMockup3d.dragging){
          const lastTs = mobileMockup3d.lastTs || now;
          const dt = Math.max(0, Math.min(48, now - lastTs));
          mobileMockup3d.yaw += dt * 0.00024;
        }
        mobileMockup3d.lastTs = now;
        const yaw = mobileMockup3d.yaw;
        const pitch = mobileMockup3d.pitch;
        const model = mat4Mul(
          mat4Translate(0, 0.12, 0),
          mat4Mul(
            quatToMat4(quatMul(
              quatFromAxisAngle([0,1,0], yaw),
              quatFromAxisAngle([1,0,0], pitch)
            )),
            mat4Scale(1.2,1.2,1.2)
          )
        );
        const p = mobileMockup3d.prog;
        gl.useProgram(p.prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, mobileMockup3d.posBuf);
        gl.enableVertexAttribArray(p.aPos);
        gl.vertexAttribPointer(p.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, mobileMockup3d.normBuf);
        gl.enableVertexAttribArray(p.aNorm);
        gl.vertexAttribPointer(p.aNorm, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, mobileMockup3d.colBuf);
        gl.enableVertexAttribArray(p.aCol);
        gl.vertexAttribPointer(p.aCol, 4, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(p.uModel, false, new Float32Array(model));
        gl.uniformMatrix4fv(p.uView, false, new Float32Array(view));
        gl.uniformMatrix4fv(p.uProj, false, new Float32Array(proj));
        gl.uniform3f(p.uLightDir, -0.42, 0.96, 0.58);
        gl.uniform3f(p.uCameraPos, 2.55, 1.55, 4.65);
        gl.uniform1f(p.uAmbient, 0.72);
        gl.drawArrays(gl.TRIANGLES, 0, mobileMockup3d.meshCount);
      }
      mobileMockup3dRaf = requestAnimationFrame(renderMobileMockup3d);
    }

    function attachMobileMockup3dInteraction(){
      if(!mobileMockup3d || !mobileMockup3d.canvas || mobileMockup3d.interactionReady) return;
      const canvas = mobileMockup3d.canvas;
      const clampPitch = (value)=>Math.max(0.42, Math.min(1.46, Number(value) || 1));
      const startDrag = (ev)=>{
        if(!mobileMockup3d) return;
        mobileMockup3d.dragging = true;
        mobileMockup3d.autoSpin = false;
        mobileMockup3d.pointerId = ev.pointerId;
        mobileMockup3d.lastX = ev.clientX;
        mobileMockup3d.lastY = ev.clientY;
        canvas.classList.add("is-dragging");
        if(canvas.setPointerCapture && ev.pointerId != null){
          try{ canvas.setPointerCapture(ev.pointerId); }catch(_e){}
        }
        ev.preventDefault();
      };
      const moveDrag = (ev)=>{
        if(!mobileMockup3d || !mobileMockup3d.dragging) return;
        if(mobileMockup3d.pointerId != null && ev.pointerId !== mobileMockup3d.pointerId) return;
        const dx = Number(ev.clientX) - Number(mobileMockup3d.lastX || ev.clientX);
        const dy = Number(ev.clientY) - Number(mobileMockup3d.lastY || ev.clientY);
        mobileMockup3d.lastX = ev.clientX;
        mobileMockup3d.lastY = ev.clientY;
        mobileMockup3d.yaw += dx * 0.010;
        mobileMockup3d.pitch = clampPitch(mobileMockup3d.pitch + dy * 0.0075);
        ev.preventDefault();
      };
      const endDrag = (ev)=>{
        if(!mobileMockup3d || !mobileMockup3d.dragging) return;
        if(mobileMockup3d.pointerId != null && ev && ev.pointerId !== mobileMockup3d.pointerId) return;
        mobileMockup3d.dragging = false;
        mobileMockup3d.autoSpin = true;
        mobileMockup3d.lastTs = 0;
        mobileMockup3d.pointerId = null;
        canvas.classList.remove("is-dragging");
        if(canvas.releasePointerCapture && ev && ev.pointerId != null){
          try{ canvas.releasePointerCapture(ev.pointerId); }catch(_e){}
        }
      };
      canvas.addEventListener("pointerdown", startDrag, {passive:false});
      canvas.addEventListener("pointermove", moveDrag, {passive:false});
      canvas.addEventListener("pointerup", endDrag, {passive:true});
      canvas.addEventListener("pointercancel", endDrag, {passive:true});
      canvas.addEventListener("lostpointercapture", endDrag, {passive:true});
      mobileMockup3d.interactionReady = true;
    }

    function initMobileMockup3d(){
      if(!el.mobileMockupCanvas || mobileMockup3d) return;
      let gl = null;
      try{
        gl = el.mobileMockupCanvas.getContext("webgl", {alpha:true, antialias:true, premultipliedAlpha:false});
      }catch(_e){
        gl = null;
      }
      if(!gl) return;
      const vs = `
        attribute vec3 aPos;
        attribute vec3 aNorm;
        attribute vec4 aCol;
        uniform mat4 uModel;
        uniform mat4 uView;
        uniform mat4 uProj;
        uniform vec3 uLightDir;
        uniform float uAmbient;
        varying vec4 vCol;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main(){
          vec4 worldPos = uModel * vec4(aPos, 1.0);
          vNormal = normalize((uModel * vec4(aNorm, 0.0)).xyz);
          vWorldPos = worldPos.xyz;
          vCol = aCol;
          gl_Position = uProj * uView * worldPos;
        }`;
      const fs = `
        precision mediump float;
        varying vec4 vCol;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        uniform vec3 uLightDir;
        uniform vec3 uCameraPos;
        uniform float uAmbient;
        void main(){
          vec3 n = normalize(vNormal);
          vec3 l = normalize(uLightDir);
          vec3 l2 = normalize(vec3(0.72, 0.38, -0.64));
          vec3 v = normalize(uCameraPos - vWorldPos);
          vec3 h = normalize(l + v);
          vec3 h2 = normalize(l2 + v);
          vec3 baseCol = max(vCol.rgb, vec3(0.13));
          float luma = dot(baseCol, vec3(0.299, 0.587, 0.114));
          baseCol = mix(vec3(0.26), baseCol, smoothstep(0.06, 0.32, luma));
          float key = max(dot(n, l), 0.0);
          float fill = max(dot(n, l2), 0.0);
          float gloss = 0.18 + (1.0 - smoothstep(0.18, 0.62, luma)) * 0.20;
          float spec = pow(max(dot(n, h), 0.0), 30.0) * gloss;
          spec += pow(max(dot(n, h2), 0.0), 76.0) * gloss * 0.62;
          float rim = pow(1.0 - max(dot(n, v), 0.0), 2.15) * 0.20;
          float shade = uAmbient + (key * 0.42) + (fill * 0.16);
          vec3 col = (baseCol * shade) + (vec3(0.92, 0.96, 1.0) * spec) + (vec3(0.50, 0.56, 0.62) * rim);
          col = pow(clamp(col, 0.0, 1.0), vec3(0.92));
          gl_FragColor = vec4(col, vCol.a);
        }`;
      let prog;
      try{
        const linked = createGyroProgram(gl, vs, fs);
        prog = {
          prog: linked,
          aPos: gl.getAttribLocation(linked, "aPos"),
          aNorm: gl.getAttribLocation(linked, "aNorm"),
          aCol: gl.getAttribLocation(linked, "aCol"),
          uModel: gl.getUniformLocation(linked, "uModel"),
          uView: gl.getUniformLocation(linked, "uView"),
          uProj: gl.getUniformLocation(linked, "uProj"),
          uLightDir: gl.getUniformLocation(linked, "uLightDir"),
          uCameraPos: gl.getUniformLocation(linked, "uCameraPos"),
          uAmbient: gl.getUniformLocation(linked, "uAmbient")
        };
      }catch(err){
        console.warn("[mobile mockup] shader init failed:", err);
        return;
      }
      mobileMockup3d = {
        canvas: el.mobileMockupCanvas,
        gl,
        prog,
        posBuf: null,
        normBuf: null,
        colBuf: null,
        meshCount: 0,
        width: 0,
        height: 0,
        yaw: -0.54,
        pitch: 1,
        lastTs: 0,
        autoSpin: true,
        dragging: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
        interactionReady: false
      };
      attachMobileMockup3dInteraction();
      const slide = el.mobileMockupCanvas.closest(".mobile-device-preview-slide");
      if(slide) slide.classList.add("is-loading");
      requestMobileMockup3dMesh().then((mesh)=>{
        if(!mobileMockup3d || !mesh || !mesh.count) return;
        mobileMockup3d.posBuf = createGyroArrayBuffer(gl, mesh.pos, gl.STATIC_DRAW);
        mobileMockup3d.normBuf = createGyroArrayBuffer(gl, mesh.norm, gl.STATIC_DRAW);
        mobileMockup3d.colBuf = createGyroArrayBuffer(gl, (mesh.col && mesh.col.length) ? mesh.col : buildMobileMockupColorArray(mesh.count), gl.STATIC_DRAW);
        mobileMockup3d.meshCount = mesh.count;
        if(slide){
          slide.classList.remove("is-loading");
          slide.classList.add("is-3d-ready");
        }
      });
      if(!mobileMockup3dRaf) mobileMockup3dRaf = requestAnimationFrame(renderMobileMockup3d);
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
        if(getGyroPreviewMode() === "3d"){
          gyroCameraState.panX = 0;
          gyroCameraState.panY = 0;
          gyroCameraState.panZ = 0;
          gyroCameraState.distance = GYRO_TERRAIN_DEFAULT_CAMERA_DISTANCE;
          gyroCameraState.desiredDistance = GYRO_TERRAIN_DEFAULT_CAMERA_DISTANCE;
        }
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
      gyroCameraState.manualZoomUntilMs = 0;
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
      if(el.gyro3dViewport && el.gyro3dViewport.classList.contains("is-camera-preview-mounted")) return true;
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
      if(el.gyro3dViewport && el.gyro3dViewport.classList.contains("is-camera-gyro-plus-mounted")) return "3d";
      if(el.gyro3dViewport && el.gyro3dViewport.classList.contains("is-camera-preview-mounted")) return "3d_basic";
      return normalizeGyroPreviewMode(uiSettings && uiSettings.gyroPreview);
    }
    function isGyroPreview3dPlusMode(){
      return getGyroPreviewMode() === "3d";
    }
    function isGyroPreview3dBasicMode(){
      return getGyroPreviewMode() === "3d_basic";
    }
    function getGyroCameraMaxDistance(){
      return getGyroPreviewMode() === "3d"
        ? GYRO_CAMERA_MAX_DISTANCE_3D_PLUS
        : GYRO_CAMERA_MAX_DISTANCE;
    }
    function getGyroCameraMinDistance(){
      if(el.gyro3dViewport && el.gyro3dViewport.classList.contains("is-camera-gyro-plus-mounted")){
        return 0.78;
      }
      if(el.gyro3dViewport && el.gyro3dViewport.classList.contains("is-camera-preview-mounted")){
        return 0.68;
      }
      return GYRO_CAMERA_MIN_DISTANCE;
    }
    function holdGyroManualZoom(){
      gyroCameraState.manualZoomUntilMs = Date.now() + 6000;
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
      const openIntelligentMobileFromPreview = (ev)=>{
        if(!isMobileLayout() || !isPhoneLandscapeLayout()) return false;
        if(ev){
          ev.preventDefault();
          ev.stopPropagation();
        }
        enterIntelligentMobileFromGyroPreview();
        redraw();
        return true;
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
      if(el.gyro3dMapOpenBtn){
        el.gyro3dMapOpenBtn.addEventListener("pointerdown", (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          if(isMobileLayout()){
            scrollMobilePreviewTo(1);
            return;
          }
          setStatusMapViewportExpanded(true);
        });
      }
      if(el.statusMapReturnGyroBtn){
        el.statusMapReturnGyroBtn.addEventListener("pointerdown", (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          scrollMobilePreviewTo(0);
        });
      }
      if(el.statusMapPreviewExpandBtn){
        el.statusMapPreviewExpandBtn.addEventListener("pointerdown", (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          setStatusMapViewportExpanded(true);
        });
      }
      const canControl = ()=>{
        const isGyroDashboard = document.body.classList.contains("camera-gyro-plus-layout") &&
          view.classList.contains("is-camera-gyro-plus-mounted");
        return shouldUseGyro3dPreview() &&
          (isGyroViewportExpanded() || isPhoneLandscapeLayout() || isGyroDashboard);
      };
      view.addEventListener("click", (ev)=>{
        if(isInteractiveViewportTarget(ev.target)) return;
        if(!shouldUseGyro3dPreview()) return;
        if(!isGyroViewportExpanded()) return;
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
        if(ev.key === "Enter" || ev.key === " "){
          ev.preventDefault();
        }
      });
      if(el.navBallPreview){
        el.navBallPreview.addEventListener("click", (ev)=>{
          openIntelligentMobileFromPreview(ev);
        });
        el.navBallPreview.addEventListener("keydown", (ev)=>{
          if(ev.key === "Enter" || ev.key === " "){
            openIntelligentMobileFromPreview(ev);
          }
        });
      }
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
          holdGyroManualZoom();
          gyroCameraState.desiredDistance = clampLocal(gyroCameraState.desiredDistance * 0.9, getGyroCameraMinDistance(), getGyroCameraMaxDistance());
          handled = true;
        }else if(key === "-" || key === "_"){
          holdGyroManualZoom();
          gyroCameraState.desiredDistance = clampLocal(gyroCameraState.desiredDistance * 1.1, getGyroCameraMinDistance(), getGyroCameraMaxDistance());
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
        if(isSequenceMobileWheelMode()) return;
        if(!canControl()) return;
        ev.preventDefault();
        holdGyroManualZoom();
        const factor = Math.exp(ev.deltaY * 0.00125);
        gyroCameraState.desiredDistance = clampLocal(gyroCameraState.desiredDistance * factor, getGyroCameraMinDistance(), getGyroCameraMaxDistance());
        redraw();
      }, {passive:false});
      view.addEventListener("dblclick", (ev)=>{
        if(isInteractiveViewportTarget(ev.target)) return;
        if(!canControl() || !isGyroViewportExpanded()) return;
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
        varying float vLight;
        varying float vDepth;
        varying vec3 vModelPos;
        varying vec3 vViewNormal;
        void main(){
          vec4 worldPos = uModel * vec4(aPos, 1.0);
          vec3 worldN = normalize((uModel * vec4(aNorm, 0.0)).xyz);
          float lit = max(dot(worldN, normalize(uLightDir)), 0.0);
          vLight = lit;
          vShade = uAmbient + ((1.0 - uAmbient) * lit);
          vCol = aCol;
          vec4 viewPos = uView * worldPos;
          vDepth = -viewPos.z;
          vModelPos = aPos;
          vViewNormal = normalize((uView * vec4(worldN, 0.0)).xyz);
          gl_Position = uProj * viewPos;
        }`;
      const solidFs = `
        precision mediump float;
        varying vec4 vCol;
        varying float vShade;
        varying float vLight;
        varying float vDepth;
        varying vec3 vModelPos;
        varying vec3 vViewNormal;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform float uColorLift;
        uniform float uSheen;
        uniform float uMaterialDetail;
        uniform float uOpacity;
        void main(){
          float fogT = clamp((uFogFar - vDepth) / max(0.0001, (uFogFar - uFogNear)), 0.0, 1.0);
          float sourceLuma = dot(vCol.rgb, vec3(0.2126, 0.7152, 0.0722));
          float cfrpMask = (1.0 - smoothstep(0.18, 0.48, sourceLuma)) * uMaterialDetail;
          vec3 liftedColor = mix(vCol.rgb, vec3(1.0), uColorLift);
          // Keep the composite body black while giving its satin surface enough
          // variation to reveal rings, fasteners, and fin junctions.
          float axialSatin = 1.0 + (sin(vModelPos.y * 92.0) * 0.012 * cfrpMask);
          liftedColor *= axialSatin;
          float rim = pow(1.0 - clamp(abs(normalize(vViewNormal).z), 0.0, 1.0), 2.4);
          vec3 materialRim = vec3(0.13, 0.16, 0.18) * rim * cfrpMask * 0.52;
          vec3 lit = (liftedColor * vShade) +
            vec3(pow(vLight, 6.0) * uSheen) + materialRim;
          vec3 outCol = mix(uFogColor, lit, fogT);
          gl_FragColor = vec4(outCol, vCol.a * uOpacity);
        }`;
      const terrainVs = `
        attribute vec3 aPos;
        attribute vec3 aNorm;
        attribute vec2 aUv;
        uniform mat4 uModel;
        uniform mat4 uView;
        uniform mat4 uProj;
        uniform vec3 uLightDir;
        uniform vec3 uModelScale;
        uniform float uCenterElevationM;
        uniform float uAmbient;
        varying vec2 vUv;
        varying float vShade;
        varying float vDepth;
        varying float vElevationM;
        varying float vSlope;
        varying float vSun;
        varying float vSky;
        void main(){
          vec4 worldPos = uModel * vec4(aPos, 1.0);
          vec3 worldN = normalize(vec3(
            aNorm.x / max(0.0001, uModelScale.x),
            aNorm.y / max(0.0001, uModelScale.y),
            aNorm.z / max(0.0001, uModelScale.z)
          ));
          float directSun = dot(worldN, normalize(uLightDir));
          float coolFill = max(dot(worldN, normalize(vec3(0.44, 0.48, -0.76))), 0.0);
          vSun = smoothstep(-0.18, 0.82, directSun);
          vSky = clamp((worldN.y * 0.72) + (coolFill * 0.28), 0.0, 1.0);
          vShade = clamp((uAmbient * 0.72) + (vSun * 0.72) + (coolFill * 0.12), 0.26, 1.16);
          vSlope = clamp(length(worldN.xz) * 1.45, 0.0, 1.0);
          vUv = aUv;
          vElevationM = aPos.y;
          vec4 viewPos = uView * worldPos;
          vDepth = -viewPos.z;
          gl_Position = uProj * viewPos;
        }`;
      const terrainFs = `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform float uCenterElevationM;
        varying vec2 vUv;
        varying float vShade;
        varying float vDepth;
        varying float vElevationM;
        varying float vSlope;
        varying float vSun;
        varying float vSky;
        void main(){
          vec4 mapColor = texture2D(uTexture, vUv);
          float fogT = clamp((uFogFar - vDepth) / max(0.0001, (uFogFar - uFogNear)), 0.0, 1.0);
          float mapLuma = dot(mapColor.rgb, vec3(0.299, 0.587, 0.114));
          float absoluteElevationM = vElevationM + uCenterElevationM;
          float waterBlueSignal = min(mapColor.b - mapColor.r, mapColor.b - mapColor.g);
          float waterTintSignal = smoothstep(0.018, 0.105, waterBlueSignal);
          float seaLevelSignal = 1.0 - smoothstep(0.5, 4.0, absoluteElevationM);
          float seaMask = clamp(waterTintSignal * seaLevelSignal, 0.0, 1.0);
          float lowlandT = smoothstep(8.0, 85.0, absoluteElevationM);
          float highlandT = smoothstep(90.0, 330.0, absoluteElevationM);
          float alpineT = smoothstep(300.0, 720.0, absoluteElevationM);
          vec3 lowland = vec3(0.82, 0.84, 0.82);
          vec3 highland = vec3(0.70, 0.71, 0.68);
          vec3 rock = vec3(0.58, 0.59, 0.57);
          vec3 elevationColor = mix(lowland, highland, lowlandT);
          elevationColor = mix(elevationColor, rock, max(highlandT * 0.68, alpineT));
          vec3 mapChroma = mapColor.rgb - vec3(mapLuma);
          float compressedLuma = 0.48 + (mapLuma * 0.47);
          vec3 mapToned = clamp(vec3(compressedLuma) + (mapChroma * 0.52), 0.0, 0.96);
          vec3 landColor = mix(elevationColor, mapToned, 0.82);
          landColor = mix(landColor, elevationColor * 0.86, vSlope * 0.26);
          vec3 waterColor = mix(vec3(0.055, 0.25, 0.36), mapColor.rgb, 0.24);
          vec3 terrainBase = mix(landColor, waterColor, seaMask);
          float valleyLight = mix(0.76, 1.0, smoothstep(-55.0, 125.0, vElevationM));
          float slopeOcclusion = 1.0 - (vSlope * (1.0 - vSun) * 0.30);
          float reliefLight = clamp(vShade * valleyLight * slopeOcclusion, 0.34, 1.12);
          vec3 relief = terrainBase * reliefLight;
          vec3 coolBounce = vec3(0.12, 0.19, 0.23) * (1.0 - vSun) * vSlope * 0.18;
          relief += coolBounce * vSky;
          float waterGlint = pow(max(vSun, 0.0), 7.0) * (1.0 - vSlope) * seaMask;
          relief += vec3(0.18, 0.27, 0.31) * waterGlint * 0.34;
          float majorDistance = abs(fract((abs(vElevationM) / 10.0) + 0.5) - 0.5);
          float minorDistance = abs(fract((abs(vElevationM) / 2.0) + 0.5) - 0.5);
          float majorContour = 1.0 - smoothstep(0.0, 0.055, majorDistance);
          float minorContour = 1.0 - smoothstep(0.0, 0.032, minorDistance);
          float contourMix = ((majorContour * 0.22) + (minorContour * 0.035)) * vSlope * (1.0 - seaMask);
          relief = mix(relief, vec3(0.12, 0.17, 0.16), contourMix);
          vec3 outColor = mix(uFogColor, relief, fogT);
          gl_FragColor = vec4(outColor, 1.0);
        }`;

      let lineProg;
      let solidProg;
      let terrainProg;
      try{
        lineProg = createGyroProgram(gl, lineVs, lineFs);
        solidProg = createGyroProgram(gl, solidVs, solidFs);
        terrainProg = createGyroProgram(gl, terrainVs, terrainFs);
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
          uColorLift: gl.getUniformLocation(solidProg, "uColorLift"),
          uSheen: gl.getUniformLocation(solidProg, "uSheen"),
          uMaterialDetail: gl.getUniformLocation(solidProg, "uMaterialDetail"),
          uOpacity: gl.getUniformLocation(solidProg, "uOpacity"),
          floorPosBuf: createGyroArrayBuffer(gl, solidGeom.floor.pos, gl.STATIC_DRAW),
          floorNormBuf: createGyroArrayBuffer(gl, solidGeom.floor.norm, gl.STATIC_DRAW),
          floorColBuf: createGyroArrayBuffer(gl, solidGeom.floor.col, gl.STATIC_DRAW),
          floorCount: solidGeom.floor.count,
          rocketPosBuf: createGyroArrayBuffer(gl, solidGeom.rocket.pos, gl.STATIC_DRAW),
          rocketNormBuf: createGyroArrayBuffer(gl, solidGeom.rocket.norm, gl.STATIC_DRAW),
          rocketColBuf: createGyroArrayBuffer(gl, solidGeom.rocket.col, gl.STATIC_DRAW),
          rocketCount: solidGeom.rocket.count,
          rocketStages:null,
          rocketVisualCenter:[0,0,0]
        },
        terrain: {
          prog: terrainProg,
          aPos: gl.getAttribLocation(terrainProg, "aPos"),
          aNorm: gl.getAttribLocation(terrainProg, "aNorm"),
          aUv: gl.getAttribLocation(terrainProg, "aUv"),
          uModel: gl.getUniformLocation(terrainProg, "uModel"),
          uView: gl.getUniformLocation(terrainProg, "uView"),
          uProj: gl.getUniformLocation(terrainProg, "uProj"),
          uLightDir: gl.getUniformLocation(terrainProg, "uLightDir"),
          uModelScale: gl.getUniformLocation(terrainProg, "uModelScale"),
          uCenterElevationM: gl.getUniformLocation(terrainProg, "uCenterElevationM"),
          uAmbient: gl.getUniformLocation(terrainProg, "uAmbient"),
          uFogColor: gl.getUniformLocation(terrainProg, "uFogColor"),
          uFogNear: gl.getUniformLocation(terrainProg, "uFogNear"),
          uFogFar: gl.getUniformLocation(terrainProg, "uFogFar"),
          uTexture: gl.getUniformLocation(terrainProg, "uTexture"),
          posBuf:null,
          normBuf:null,
          uvBuf:null,
          texture:null,
          count:0,
          buildingPosBuf:null,
          buildingNormBuf:null,
          buildingColBuf:null,
          buildingCount:0
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
      requestGyroRocketMesh().then((mesh)=>{
        if(!mesh) return;
        if(!applyGyroRocketMeshToGl(mesh)) return;
        renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
      });
      setTimeout(()=>{
        ensureGyroTerrainForGeo(getGyroTerrainReferenceGeo());
      }, 2500);
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
      gyroGl.proj = mat4Perspective(GYRO_FOV_DEG * DEG_TO_RAD, w / h, 0.05, 950);
      gyroGl.gl.viewport(0, 0, w, h);
    }

    function resetGyroPathTracking(){
      resetGyroTerrain();
      gyroPathState.originLat = null;
      gyroPathState.originLon = null;
      gyroPathState.originAlt = null;
      gyroPathState.source = "none";
      gyroPathState.gpsOffsetX = 0;
      gyroPathState.gpsOffsetY = 0;
      gyroPathState.gpsOffsetZ = 0;
      gyroPathState.points = [];
      gyroPathState.smoothPath = [];
      gyroPathState.smoothPathMeters = [];
      gyroPathState.cachedLastMs = -1;
      gyroPathState.lastFixMs = 0;
      gyroPathState.renderScaleXZ = GYRO_TRAIL_BASE_METERS_PER_UNIT / GYRO_TRAIL_HORIZONTAL_EXAGGERATION;
      gyroPathState.renderScaleY = GYRO_TRAIL_BASE_METERS_PER_UNIT;
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
      gyroPathState.fusionReady = false;
      gyroPathState.fusionFlightTracking = false;
      gyroPathState.fusionLastMs = 0;
      gyroPathState.fusionPosX = 0;
      gyroPathState.fusionPosY = 0;
      gyroPathState.fusionPosZ = 0;
      gyroPathState.fusionVelX = 0;
      gyroPathState.fusionVelY = 0;
      gyroPathState.fusionVelZ = 0;
      gyroPathState.fusionAccelX = 0;
      gyroPathState.fusionAccelZ = 0;
      gyroPathState.fusionAccelReady = false;
      gyroPathState.fusionAccelBiasX = 0;
      gyroPathState.fusionAccelBiasZ = 0;
      gyroPathState.fusionPhase = "PRE_FLIGHT";
      gyroPathState.fusionPoweredStartMs = 0;
      gyroPathState.fusionLaunchAnchorX = 0;
      gyroPathState.fusionLaunchAnchorZ = 0;
      gyroPathState.fusionRailLocked = false;
      gyroPathState.fusionStationarySinceMs = 0;
      gyroPathState.fusionStationaryLocked = false;
      gyroPathState.fusionAnchorX = 0;
      gyroPathState.fusionAnchorZ = 0;
      gyroPathState.fusionMotionScore = 0;
      gyroPathState.fusionGpsLastLat = NaN;
      gyroPathState.fusionGpsLastLon = NaN;
      gyroPathState.fusionGpsLastX = NaN;
      gyroPathState.fusionGpsLastY = NaN;
      gyroPathState.fusionGpsLastZ = NaN;
      gyroPathState.fusionGpsLastMs = 0;
      gyroPathState.fusionGpsVelX = 0;
      gyroPathState.fusionGpsVelZ = 0;
      gyroPathState.fusionGpsValidMs = 0;
      gyroPathState.fusionGpsAccuracyM = GYRO_FUSION_GPS_DEFAULT_ACCURACY_M;
      gyroPathState.fusionGpsRejectCount = 0;
      gyroPathState.fusionGpsRangeEnvelopeM = NaN;
      gyroPathState.fusionCovP00 = 16;
      gyroPathState.fusionCovP01 = 0;
      gyroPathState.fusionCovP11 = 25;
      gyroPathState.fusionImuYawOffsetRad = 0;
      gyroPathState.fusionImuYawReady = false;
      gyroPathState.fusionLocalVelX = 0;
      gyroPathState.fusionLocalVelZ = 0;
      gyroPathState.fusionBaroOriginM = NaN;
      gyroPathState.fusionBaroAltM = NaN;
      gyroPathState.fusionBaroLastM = NaN;
      gyroPathState.fusionBaroLastMs = 0;
      gyroPathState.fusionBaroVelMps = 0;
      gyroPathState.fusionBaroValidMs = 0;
      gyroPathState.fusionApogeeAltitudeM = 0;
      gyroPathState.fusionApogeeMs = 0;
      if(gyroGl){
        setTimeout(()=>{
          ensureGyroTerrainForGeo(getGyroTerrainReferenceGeo());
        }, 80);
      }
    }

    function getGyroPathLastPoint(){
      const pts = gyroPathState.points;
      return (pts && pts.length) ? pts[pts.length - 1] : null;
    }

    function getGyroPathSourceMeta(){
      const source = String(gyroPathState.source || "none");
      if(source === "fusion"){
        const gpsFresh =
          gyroPathState.fusionGpsValidMs > 0 &&
          (Date.now() - gyroPathState.fusionGpsValidMs) <= GYRO_FUSION_GPS_STALE_MS;
        const baroFresh =
          gyroPathState.fusionBaroValidMs > 0 &&
          (Date.now() - gyroPathState.fusionBaroValidMs) <= GYRO_FUSION_BARO_STALE_MS;
        if(gpsFresh && baroFresh){
          return { show:true, label:"PATH FUSED", confidence:"HIGH", lowConfidence:false };
        }
        if(gpsFresh){
          return { show:true, label:"PATH GPS", confidence:"HIGH", lowConfidence:false };
        }
        if(baroFresh){
          return { show:true, label:"PATH LOCAL", confidence:"EST", lowConfidence:true };
        }
        return { show:false, label:"", confidence:"", lowConfidence:false };
      }
      if(source === "gps"){
        return { show:true, label:"PATH GPS", confidence:"HIGH", lowConfidence:false };
      }
      if(source === "alt_gyro"){
        return { show:true, label:"PATH BARO", confidence:"LOW", lowConfidence:true };
      }
      if(source === "imu"){
        return { show:false, label:"", confidence:"", lowConfidence:false };
      }
      if(source === "alt"){
        return { show:true, label:"PATH BARO", confidence:"LOW", lowConfidence:true };
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
      const minIntervalMs = Math.max(0, isFinite(opts.minIntervalMs) ? opts.minIntervalMs : 0);
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
          return false;
        }
        if(dtMs < minIntervalMs) return false;
        const minStepSq = minStepM * minStepM;
        if(distSq < minStepSq && dtMs < idleHoldMs){
          return false;
        }
        if(distSq < (idleDriftM * idleDriftM)){
          return false;
        }
      }
      if(!last && Math.hypot(next.x, next.y, next.z) > 0.001){
        // A flight may be detected after the first moving sample arrives.
        // Keep an explicit pad anchor so the trail never starts in mid-air.
        pts.push({x:0, y:0, z:0, ms:Math.max(0, now - 1)});
      }
      pts.push(next);
      if(pts.length > GYRO_TRAIL_MAX_POINTS){
        // Preserve the launch and recent sections. Older path samples are
        // decimated instead of discarded so long flights retain their origin.
        const recentCount = Math.max(400, Math.floor(GYRO_TRAIL_MAX_POINTS * 0.35));
        const recentStart = Math.max(1, pts.length - recentCount);
        const compacted = [pts[0]];
        for(let i=1; i<recentStart; i+=2){
          compacted.push(pts[i]);
        }
        for(let i=recentStart; i<pts.length; i++){
          compacted.push(pts[i]);
        }
        gyroPathState.points = compacted;
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
      ensureGyroTerrainForGeo(geo);
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
        let dAlt = altitudeM - gyroPathState.altGyroLastAlt;
        if(Math.abs(dAlt) < GYRO_ALTGYRO_ALT_DEADBAND_M){
          dAlt = 0;
        }
        gyroPathState.altGyroLastAlt = altitudeM;
        gyroPathState.altGyroLastMs = now;

        if(isFinite(dtSec) && dtSec >= GYRO_ALTGYRO_MIN_DT_SEC && dtSec <= GYRO_ALTGYRO_MAX_DT_SEC){
          let verticalSpeedMps = dAlt / dtSec;
          if(!isFinite(verticalSpeedMps)) verticalSpeedMps = 0;
          if(Math.abs(verticalSpeedMps) < GYRO_ALTGYRO_MIN_VSPEED_FOR_HMOVE_MPS){
            gyroPathState.altGyroVSpeedMps *= GYRO_ALTGYRO_IDLE_VSPEED_DAMP;
            if(Math.abs(gyroPathState.altGyroVSpeedMps) < 0.03){
              gyroPathState.altGyroVSpeedMps = 0;
            }
          }else{
            const a = GYRO_ALTGYRO_VSPEED_FILTER_ALPHA;
            gyroPathState.altGyroVSpeedMps += (verticalSpeedMps - gyroPathState.altGyroVSpeedMps) * a;
          }

          if(gyroAttitudeReady && Math.abs(gyroPathState.altGyroVSpeedMps) >= GYRO_ALTGYRO_MIN_VSPEED_FOR_HMOVE_MPS){
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
          minStepM: 0.05,
          idleHoldMs: 90,
          idleDriftM: 0.018,
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

    function readGyroFusionBaroAltitude(data){
      if(!data || typeof data !== "object") return NaN;
      const baroValidRaw = data.bo ?? data.baro_valid ?? data.baroValid;
      if(baroValidRaw != null && Number(baroValidRaw) === 0) return NaN;
      const candidates = [
        data.alt_m,
        data.altitude_m,
        data.baro_alt_m,
        data.baroAltitudeM
      ];
      for(let i = 0; i < candidates.length; i++){
        const raw = candidates[i];
        if(raw == null || (typeof raw === "string" && raw.trim() === "")) continue;
        const value = Number(raw);
        if(isFinite(value)) return value;
      }
      const pressureMpa = parseBaroPressureMpa(data);
      if(!isFinite(pressureMpa) || pressureMpa <= 0.03 || pressureMpa >= 0.2){
        return NaN;
      }
      if(!isFinite(quickFlightMetrics.originPressureMpa) ||
         quickFlightMetrics.originPressureMpa <= 0){
        quickFlightMetrics.originPressureMpa = pressureMpa;
        return 0;
      }
      const ratio = pressureMpa / quickFlightMetrics.originPressureMpa;
      if(!isFinite(ratio) || ratio <= 0) return NaN;
      return 44330.0 * (1.0 - Math.pow(ratio, 0.19029495718363465));
    }

    function getGyroFusionGeo(data){
      if(!data || typeof data !== "object") return null;
      const geo = extractTelemetryGeo(data, {koreaOnly:false});
      if(!geo) return null;
      const gps = (data.gps && typeof data.gps === "object") ? data.gps : null;
      const fixRaw = data.gps_fix ?? data.gpsFix ?? data.fix ?? (gps ? gps.fix : null);
      const seenRaw = data.gps_seen ?? data.gpsSeen ?? data.gps_ready ?? data.gpsReady ?? (gps ? (gps.seen ?? gps.ready ?? null) : null);
      const fixNum = Number(fixRaw);
      const seenNum = Number(seenRaw);
      if(fixRaw != null && isFinite(fixNum) && fixNum <= 0) return null;
      if(seenRaw != null && isFinite(seenNum) && seenNum <= 0) return null;
      const ageRaw = data.gps_age_ms ?? data.gpsAgeMs ??
        (gps ? gps.age_ms : null);
      const ageMs = Number(ageRaw);
      if(isFinite(ageMs) && ageMs > GYRO_FUSION_GPS_STALE_MS) return null;
      return geo;
    }

    function readGyroFusionGpsAccuracyM(data){
      const gps = (data && data.gps && typeof data.gps === "object") ? data.gps : null;
      const accuracyCandidates = [
        data && (data.gps_accuracy_m ?? data.gpsAccuracyM ?? data.horizontal_accuracy_m ?? data.horizontalAccuracyM),
        gps && (gps.accuracy_m ?? gps.horizontal_accuracy_m ?? gps.h_accuracy_m)
      ];
      for(let i=0;i<accuracyCandidates.length;i++){
        const value = Number(accuracyCandidates[i]);
        if(isFinite(value) && value > 0){
          return clampLocal(value, GYRO_FUSION_GPS_MIN_ACCURACY_M, GYRO_FUSION_GPS_MAX_ACCURACY_M);
        }
      }
      const hdop = Number(data && (data.gps_hdop ?? data.gpsHdop ?? (gps ? gps.hdop : null)));
      if(isFinite(hdop) && hdop > 0){
        return clampLocal(hdop * 2.4, GYRO_FUSION_GPS_MIN_ACCURACY_M, GYRO_FUSION_GPS_MAX_ACCURACY_M);
      }
      if(data && String(data.data_origin || data.dataOrigin || "").toLowerCase() === "simulation"){
        return 0.22;
      }
      return GYRO_FUSION_GPS_DEFAULT_ACCURACY_M;
    }

    function readGyroFusionHorizontalVelocity(data){
      if(!data || typeof data !== "object") return null;
      const east = Number(data.velocity_e_mps ?? data.velocityEastMps ?? data.vel_e_mps ?? data.velEastMps);
      const north = Number(data.velocity_n_mps ?? data.velocityNorthMps ?? data.vel_n_mps ?? data.velNorthMps);
      if(!isFinite(east) || !isFinite(north)) return null;
      const speed = Math.hypot(east, north);
      if(!isFinite(speed) || speed > GYRO_FUSION_MAX_SPEED_MPS) return null;
      return {x:east, z:north, direct:true};
    }

    function normalizeGyroFusionAngleRad(value){
      let angle = Number(value) || 0;
      while(angle <= -Math.PI) angle += Math.PI * 2;
      while(angle > Math.PI) angle -= Math.PI * 2;
      return angle;
    }

    function rotateGyroFusionHorizontal(x, z, angleRad){
      const c = Math.cos(angleRad || 0);
      const s = Math.sin(angleRad || 0);
      return {x:(x * c) - (z * s), z:(x * s) + (z * c)};
    }

    function gyroFusionWorldAccelerationFromImu(ax, ay, az, attitudeQuat){
      if(!isFinite(ax) || !isFinite(ay) || !isFinite(az)) return null;
      // Sensor X/Y/Z -> render-local X/-Z/Y.
      const localSpecificForceG = [Number(ax), Number(az), -Number(ay)];
      const worldSpecificForceG = quatRotateVector(
        attitudeQuat,
        localSpecificForceG
      );
      return {
        x:worldSpecificForceG[0] * GYRO_IMU_GRAVITY_MPS2,
        y:(worldSpecificForceG[1] - 1) * GYRO_IMU_GRAVITY_MPS2,
        z:worldSpecificForceG[2] * GYRO_IMU_GRAVITY_MPS2
      };
    }

    function warpGyroPathTailForGps(correctionX, correctionZ, nowMs){
      const magnitude = Math.hypot(correctionX, correctionZ);
      const points = gyroPathState.points;
      if(!(magnitude > 0.005) || !points || points.length < 2) return;
      const now = Number(nowMs) || Date.now();
      const horizonMs = clampLocal(2200 + (magnitude * 180), 2200, 8000);
      const startMs = now - horizonMs;
      for(let i=1;i<points.length;i++){
        const point = points[i];
        if(!point || point.ms < startMs) continue;
        const ratio = clampLocal((point.ms - startMs) / horizonMs, 0, 1);
        const blend = ratio * ratio * (3 - (2 * ratio));
        point.x += correctionX * blend;
        point.z += correctionZ * blend;
      }
      // Keep the input low-pass state in the corrected frame. Otherwise the
      // next sample would draw a second correction chord back to the old frame.
      if(isFinite(gyroPathState.filteredX)) gyroPathState.filteredX += correctionX;
      if(isFinite(gyroPathState.filteredZ)) gyroPathState.filteredZ += correctionZ;
      gyroPathState.cachedLastMs = -1;
    }

    function predictGyroFusionCovariance(dtSec, processNoise){
      if(!(dtSec > 0)) return;
      const dt2 = dtSec * dtSec;
      const dt3 = dt2 * dtSec;
      const dt4 = dt2 * dt2;
      const p00 = Math.max(0.001, Number(gyroPathState.fusionCovP00) || 0.001);
      const p01 = Number(gyroPathState.fusionCovP01) || 0;
      const p11 = Math.max(0.001, Number(gyroPathState.fusionCovP11) || 0.001);
      const q = Math.max(0.001, Number(processNoise) || 0.001);
      gyroPathState.fusionCovP00 = clampLocal(
        p00 + (2 * dtSec * p01) + (dt2 * p11) + (0.25 * dt4 * q),
        0.001,
        250000
      );
      gyroPathState.fusionCovP01 = clampLocal(
        p01 + (dtSec * p11) + (0.5 * dt3 * q),
        -250000,
        250000
      );
      gyroPathState.fusionCovP11 = clampLocal(
        p11 + (dt2 * q),
        0.001,
        250000
      );
    }

    function updateGyroFusionGps(geo, data, nowMs, allowPositionCorrection, phase){
      if(!geo) return false;
      const now = nowMs || Date.now();
      if(gyroPathState.originLat == null || gyroPathState.originLon == null){
        gyroPathState.originLat = geo.lat;
        gyroPathState.originLon = geo.lon;
        gyroPathState.originAlt = null;
        gyroPathState.gpsOffsetX = gyroPathState.fusionPosX;
        gyroPathState.gpsOffsetY = 0;
        gyroPathState.gpsOffsetZ = gyroPathState.fusionPosZ;
      }
      const latAvg = ((geo.lat + gyroPathState.originLat) * 0.5) * DEG_TO_RAD;
      const gpsX = ((geo.lon - gyroPathState.originLon) *
        (111320 * Math.cos(latAvg))) + gyroPathState.gpsOffsetX;
      const gpsZ = ((geo.lat - gyroPathState.originLat) * 111320) +
        gyroPathState.gpsOffsetZ;
      const lastMs = gyroPathState.fusionGpsLastMs;
      const coordsChanged =
        !isFinite(gyroPathState.fusionGpsLastX) ||
        Math.abs(gpsX - gyroPathState.fusionGpsLastX) > 0.001 ||
        Math.abs(gpsZ - gyroPathState.fusionGpsLastZ) > 0.001;
      if(!coordsChanged && lastMs > 0) return false;

      const dtSec = lastMs > 0 ? (now - lastMs) / 1000 : 0;
      const directVelocity = readGyroFusionHorizontalVelocity(data);
      let measuredVelocity = directVelocity;
      if(isFinite(dtSec) && dtSec > 0.04 && dtSec < 4 &&
         isFinite(gyroPathState.fusionGpsLastX) &&
         isFinite(gyroPathState.fusionGpsLastZ)){
        const dx = gpsX - gyroPathState.fusionGpsLastX;
        const dz = gpsZ - gyroPathState.fusionGpsLastZ;
        const rawVx = dx / dtSec;
        const rawVz = dz / dtSec;
        const speed = Math.hypot(rawVx, rawVz);
        if(!measuredVelocity && isFinite(speed) && speed <= GYRO_FUSION_MAX_SPEED_MPS){
          measuredVelocity = {x:rawVx, z:rawVz, direct:false};
        }
      }

      const accuracyM = readGyroFusionGpsAccuracyM(data);
      const innovationX = gpsX - gyroPathState.fusionPosX;
      const innovationZ = gpsZ - gyroPathState.fusionPosZ;
      const innovationM = Math.hypot(innovationX, innovationZ);
      const predictedSigmaM = Math.sqrt(Math.max(0.001, gyroPathState.fusionCovP00));
      const velocityMps = Math.hypot(gyroPathState.fusionVelX, gyroPathState.fusionVelZ);
      const gateM = Math.max(
        10,
        (accuracyM * 5) + (predictedSigmaM * 3),
        (isFinite(dtSec) ? Math.min(2, dtSec) : 0) * Math.max(12, velocityMps * 0.55)
      );
      const hasPreviousFix = lastMs > 0 && isFinite(gyroPathState.fusionGpsLastX);
      if(hasPreviousFix && innovationM > gateM){
        gyroPathState.fusionGpsRejectCount++;
        return false;
      }

      gyroPathState.fusionGpsLastLat = geo.lat;
      gyroPathState.fusionGpsLastLon = geo.lon;
      gyroPathState.fusionGpsLastX = gpsX;
      gyroPathState.fusionGpsLastY = NaN;
      gyroPathState.fusionGpsLastZ = gpsZ;
      gyroPathState.fusionGpsLastMs = now;
      gyroPathState.fusionGpsValidMs = Date.now();
      gyroPathState.fusionGpsAccuracyM = accuracyM;
      gyroPathState.fusionGpsRejectCount = 0;
      if(phase !== FLIGHT_PHASES.PRE_FLIGHT){
        const rangeFromLaunchM = Math.hypot(
          gpsX - gyroPathState.fusionLaunchAnchorX,
          gpsZ - gyroPathState.fusionLaunchAnchorZ
        );
        if(isFinite(rangeFromLaunchM)){
          gyroPathState.fusionGpsRangeEnvelopeM = isFinite(
            gyroPathState.fusionGpsRangeEnvelopeM
          )
            ? Math.max(gyroPathState.fusionGpsRangeEnvelopeM, rangeFromLaunchM)
            : rangeFromLaunchM;
        }
      }
      if(!gyroPathState.fusionReady){
        gyroPathState.fusionPosX = gpsX;
        gyroPathState.fusionPosZ = gpsZ;
        return true;
      }
      if(gyroPathState.fusionStationaryLocked){
        gyroPathState.fusionGpsVelX = 0;
        gyroPathState.fusionGpsVelZ = 0;
        return true;
      }
      if(!GYRO_ABSOLUTE_TRAJECTORY_ENABLED){
        // Keep only the accepted scalar range envelope. Without an absolute
        // heading source, GPS east/north must not rotate or bend the local
        // model-rocket path shown in the UI.
        return true;
      }

      if(measuredVelocity){
        const gpsSpeed = Math.hypot(measuredVelocity.x, measuredVelocity.z);
        const localSpeed = Math.hypot(
          gyroPathState.fusionLocalVelX,
          gyroPathState.fusionLocalVelZ
        );
        if(gpsSpeed > 1.2 && localSpeed > 1.2 &&
           phase !== FLIGHT_PHASES.DESCENT && phase !== FLIGHT_PHASES.LANDED){
          const targetOffset = normalizeGyroFusionAngleRad(
            Math.atan2(measuredVelocity.z, measuredVelocity.x) -
            Math.atan2(gyroPathState.fusionLocalVelZ, gyroPathState.fusionLocalVelX)
          );
          if(!gyroPathState.fusionImuYawReady){
            gyroPathState.fusionImuYawOffsetRad = targetOffset;
            gyroPathState.fusionImuYawReady = true;
          }else{
            const error = normalizeGyroFusionAngleRad(
              targetOffset - gyroPathState.fusionImuYawOffsetRad
            );
            gyroPathState.fusionImuYawOffsetRad = normalizeGyroFusionAngleRad(
              gyroPathState.fusionImuYawOffsetRad + (error * 0.08)
            );
          }
        }
      }

      if(!allowPositionCorrection) return true;
      const r = accuracyM * accuracyM;
      const p00 = Math.max(0.001, gyroPathState.fusionCovP00);
      const p01 = gyroPathState.fusionCovP01;
      const p11 = Math.max(0.001, gyroPathState.fusionCovP11);
      const innovationVariance = Math.max(0.001, p00 + r);
      const maxPositionGain = accuracyM <= 0.5 ? 0.92 : 0.55;
      const positionGain = clampLocal(p00 / innovationVariance, 0.015, maxPositionGain);
      const velocityGain = clampLocal(p01 / innovationVariance, 0, 1.5);
      let correctionX = innovationX * positionGain;
      let correctionZ = innovationZ * positionGain;
      const correctionMagnitude = Math.hypot(correctionX, correctionZ);
      const maxCorrectionM = Math.max(
        0.75,
        accuracyM * 1.5,
        Math.min(10, Math.max(0, dtSec) * Math.max(1, velocityMps) * 0.22)
      );
      if(correctionMagnitude > maxCorrectionM){
        const correctionScale = maxCorrectionM / correctionMagnitude;
        correctionX *= correctionScale;
        correctionZ *= correctionScale;
      }
      gyroPathState.fusionPosX += correctionX;
      gyroPathState.fusionPosZ += correctionZ;
      warpGyroPathTailForGps(correctionX, correctionZ, now);
      let velocityCorrectionX = innovationX * velocityGain;
      let velocityCorrectionZ = innovationZ * velocityGain;
      const velocityCorrectionMagnitude = Math.hypot(
        velocityCorrectionX,
        velocityCorrectionZ
      );
      const maxVelocityCorrectionMps = phase === FLIGHT_PHASES.POWERED_FLIGHT
        ? 10
        : (phase === FLIGHT_PHASES.COASTING ? 12 : 6);
      if(velocityCorrectionMagnitude > maxVelocityCorrectionMps){
        const velocityCorrectionScale =
          maxVelocityCorrectionMps / velocityCorrectionMagnitude;
        velocityCorrectionX *= velocityCorrectionScale;
        velocityCorrectionZ *= velocityCorrectionScale;
      }
      gyroPathState.fusionVelX += velocityCorrectionX;
      gyroPathState.fusionVelZ += velocityCorrectionZ;
      gyroPathState.fusionCovP00 = Math.max(0.001, (1 - positionGain) * p00);
      gyroPathState.fusionCovP01 = (1 - positionGain) * p01;
      gyroPathState.fusionCovP11 = Math.max(0.001, p11 - (velocityGain * p01));

      if(measuredVelocity){
        const velocityAlpha = measuredVelocity.direct
          ? 0.72
          : clampLocal(dtSec / (1.4 + dtSec), 0.08, 0.42);
        gyroPathState.fusionGpsVelX +=
          (measuredVelocity.x - gyroPathState.fusionGpsVelX) * velocityAlpha;
        gyroPathState.fusionGpsVelZ +=
          (measuredVelocity.z - gyroPathState.fusionGpsVelZ) * velocityAlpha;
        const velocitySigma = measuredVelocity.direct
          ? 0.35
          : Math.max(0.8, (Math.SQRT2 * accuracyM) / Math.max(0.12, dtSec));
        const velocityMeasurementGain = clampLocal(
          gyroPathState.fusionCovP11 /
            (gyroPathState.fusionCovP11 + (velocitySigma * velocitySigma)),
          0.025,
          measuredVelocity.direct ? 0.86 : 0.48
        );
        gyroPathState.fusionVelX +=
          (gyroPathState.fusionGpsVelX - gyroPathState.fusionVelX) * velocityMeasurementGain;
        gyroPathState.fusionVelZ +=
          (gyroPathState.fusionGpsVelZ - gyroPathState.fusionVelZ) * velocityMeasurementGain;
        gyroPathState.fusionCovP11 = Math.max(
          0.001,
          (1 - velocityMeasurementGain) * gyroPathState.fusionCovP11
        );
      }
      return true;
    }

    function updateGyroFusionBaro(rawAltitudeM, verticalSpeedMps, nowMs, phase, options){
      if(!isFinite(rawAltitudeM)) return false;
      const now = nowMs || Date.now();
      const opts = options || {};
      const altitudeAlreadyRelative = !!opts.relativeAltitude;
      if(!isFinite(gyroPathState.fusionBaroOriginM)){
        gyroPathState.fusionBaroOriginM =
          (replaySourceActive || altitudeAlreadyRelative) ? 0 : rawAltitudeM;
      }
      const relativeAlt = altitudeAlreadyRelative
        ? rawAltitudeM
        : (rawAltitudeM - gyroPathState.fusionBaroOriginM);
      const lastMs = gyroPathState.fusionBaroLastMs;
      const changed =
        !isFinite(gyroPathState.fusionBaroLastM) ||
        Math.abs(relativeAlt - gyroPathState.fusionBaroLastM) > 0.0005;
      if(!changed && lastMs > 0 && (now - lastMs) < 100) return false;
      const dtSec = lastMs > 0 ? (now - lastMs) / 1000 : 0;
      if(isFinite(dtSec) && dtSec >= 0.005 && dtSec < 1.5 &&
         isFinite(gyroPathState.fusionBaroLastM)){
        const maxVerticalSpeed = phase === FLIGHT_PHASES.POWERED_FLIGHT ? 520 : 260;
        const maxDeltaM = 8 + (maxVerticalSpeed * dtSec);
        if(Math.abs(relativeAlt - gyroPathState.fusionBaroLastM) > maxDeltaM){
          return false;
        }
      }
      if(!isFinite(gyroPathState.fusionBaroAltM)){
        gyroPathState.fusionBaroAltM = relativeAlt;
        gyroPathState.fusionBaroVelMps = isFinite(verticalSpeedMps)
          ? clampLocal(Number(verticalSpeedMps), -500, 500)
          : 0;
      }else{
        const validDt = isFinite(dtSec) && dtSec >= 0.01 && dtSec <= 1.5;
        const filterDt = validDt ? dtSec : 0.04;
        const tau = phase === FLIGHT_PHASES.POWERED_FLIGHT ? 0.055 :
          (phase === FLIGHT_PHASES.PRE_FLIGHT || phase === FLIGHT_PHASES.LANDED ? 0.24 : 0.12);
        const alpha = clampLocal(1 - Math.exp(-filterDt / tau), 0.08, 0.82);
        const beta = clampLocal((alpha * alpha) / Math.max(0.2, 2 - alpha), 0.015, 0.46);
        const predictedAltitude = gyroPathState.fusionBaroAltM +
          (gyroPathState.fusionBaroVelMps * filterDt);
        const innovation = clampLocal(relativeAlt - predictedAltitude, -80, 80);
        gyroPathState.fusionBaroAltM = predictedAltitude + (innovation * alpha);
        if(validDt){
          gyroPathState.fusionBaroVelMps += (innovation * beta) / filterDt;
        }
        if(isFinite(verticalSpeedMps)){
          const measuredVelocity = clampLocal(Number(verticalSpeedMps), -500, 500);
          const directGain = phase === FLIGHT_PHASES.POWERED_FLIGHT ? 0.48 : 0.32;
          gyroPathState.fusionBaroVelMps +=
            (measuredVelocity - gyroPathState.fusionBaroVelMps) * directGain;
        }
        gyroPathState.fusionBaroVelMps = clampLocal(
          gyroPathState.fusionBaroVelMps,
          -500,
          500
        );
      }
      gyroPathState.fusionBaroLastM = relativeAlt;
      gyroPathState.fusionBaroLastMs = now;
      gyroPathState.fusionBaroValidMs = Date.now();
      if(opts.syncPosition){
        // The altitude chart already owns the canonical, filtered altitude
        // series. Keep the 3D path on that exact Y sample instead of filtering
        // it a second time and shifting apogee/descent timing.
        gyroPathState.fusionBaroAltM = relativeAlt;
      }
      gyroPathState.fusionPosY = gyroPathState.fusionBaroAltM;
      gyroPathState.fusionVelY = gyroPathState.fusionBaroVelMps;
      return true;
    }

    function isGyroAltitudeLaunchActive(stateValue, firmwarePhase){
      const state = Number(stateValue);
      if(localTplusActive || tplusUiActive) return true;
      if(firmwarePhase && firmwarePhase !== FLIGHT_PHASES.PRE_FLIGHT) return true;
      if(state === 0 || state === 1) return false;
      if(state === 2 || state === 3) return true;
      return !!(
        derivedFlightPhase &&
        derivedFlightPhase.phase !== FLIGHT_PHASES.PRE_FLIGHT
      );
    }

    function updateGyroPathFusion(data, nowMs, chartSample){
      const now = nowMs || Date.now();
      const canonicalSample = chartSample && typeof chartSample === "object"
        ? chartSample
        : null;
      const previousMs = gyroPathState.fusionLastMs;
      let dtSec = previousMs > 0 ? (now - previousMs) / 1000 : 0;
      if(!isFinite(dtSec) || dtSec <= 0) dtSec = 0;
      else if(dtSec > 2) dtSec = 0;
      else dtSec = Math.min(dtSec, GYRO_FUSION_MAX_DT_SEC);
      const stateValue = Number(data && (data.st != null ? data.st : (data.state ?? currentSt)));
      const firmwarePhaseInfo = readFirmwareFlightPhase(data);
      let phase = canonicalSample && canonicalSample.phase
        ? canonicalSample.phase
        : (firmwarePhaseInfo && firmwarePhaseInfo.phase
        ? firmwarePhaseInfo.phase
        : (derivedFlightPhase && derivedFlightPhase.phase
          ? derivedFlightPhase.phase
          : FLIGHT_PHASES.PRE_FLIGHT));
      const altitudeLaunchActive = isGyroAltitudeLaunchActive(
        stateValue,
        phase);
      if(phase === FLIGHT_PHASES.PRE_FLIGHT && altitudeLaunchActive){
        phase = FLIGHT_PHASES.POWERED_FLIGHT;
      }
      gyroPathState.fusionLastMs = now;
      const geo = getGyroFusionGeo(data);
      const chartAltitudeM = Number(canonicalSample && canonicalSample.altitudeM);
      let baroAltitudeM = isFinite(chartAltitudeM)
        ? chartAltitudeM
        : readGyroFusionBaroAltitude(data);
      if(!isFinite(baroAltitudeM) && geo && isFinite(geo.alt)) baroAltitudeM = geo.alt;
      const chartVerticalSpeedMps = Number(
        canonicalSample && canonicalSample.verticalSpeedMps
      );
      const telemetryVerticalSpeedMps = isFinite(chartVerticalSpeedMps)
        ? chartVerticalSpeedMps
        : readTelemetryVerticalSpeedMps(data);
      const baroUpdated = updateGyroFusionBaro(
        baroAltitudeM,
        telemetryVerticalSpeedMps,
        now,
        phase,
        {
          relativeAltitude:isFinite(chartAltitudeM),
          syncPosition:isFinite(chartAltitudeM)
        }
      );
      const hasBaro =
        gyroPathState.fusionBaroValidMs > 0 &&
        (Date.now() - gyroPathState.fusionBaroValidMs) <= GYRO_FUSION_BARO_STALE_MS;

      if(!gyroPathState.fusionReady){
        gyroPathState.fusionReady = isFinite(gyroPathState.fusionBaroAltM);
      }
      if(!gyroPathState.fusionReady) return false;
      const dynamics = GYRO_LOCAL_PHASE_DYNAMICS[phase] ||
        GYRO_LOCAL_PHASE_DYNAMICS.PRE_FLIGHT;
      const previousPhase = gyroPathState.fusionPhase;
      const enteringFlight =
        previousPhase === FLIGHT_PHASES.PRE_FLIGHT &&
        phase !== FLIGHT_PHASES.PRE_FLIGHT;
      if(phase === FLIGHT_PHASES.PRE_FLIGHT){
        gyroPathState.fusionPoweredStartMs = 0;
        gyroPathState.fusionRailLocked = false;
      }else if(
        phase === FLIGHT_PHASES.POWERED_FLIGHT &&
        (previousPhase !== FLIGHT_PHASES.POWERED_FLIGHT ||
         !(gyroPathState.fusionPoweredStartMs > 0))
      ){
        gyroPathState.fusionPoweredStartMs = now;
        gyroPathState.fusionLaunchAnchorX = gyroPathState.fusionPosX;
        gyroPathState.fusionLaunchAnchorZ = gyroPathState.fusionPosZ;
        gyroPathState.fusionRailLocked = true;
      }else if(phase !== FLIGHT_PHASES.POWERED_FLIGHT){
        gyroPathState.fusionRailLocked = false;
      }
      let poweredHorizontalAcceptance = 1;
      let poweredAgeSec = 0;
      if(phase === FLIGHT_PHASES.POWERED_FLIGHT){
        poweredAgeSec = Math.max(
          0,
          (now - gyroPathState.fusionPoweredStartMs) / 1000
        );
        const launchAltitudeM = Math.max(0, gyroPathState.fusionPosY);
        poweredHorizontalAcceptance = getModelRocketLaunchHorizontalAcceptance(
          poweredAgeSec,
          launchAltitudeM
        );
        gyroPathState.fusionRailLocked =
          launchAltitudeM < GYRO_FUSION_RAIL_LENGTH_M && poweredAgeSec < 0.6;
        if(gyroPathState.fusionRailLocked) poweredHorizontalAcceptance = 0;
      }

      const ax = Number(data && data.ax);
      const ay = Number(data && data.ay);
      const az = Number(data && data.az);
      const accelNormG = Math.hypot(ax, ay, az);
      let measuredAccelX = 0;
      let measuredAccelZ = 0;
      if(phase !== FLIGHT_PHASES.LANDED &&
         gyroAttitudeReady && isFinite(accelNormG) && accelNormG >= 0.03 && accelNormG <= 25){
        // Sensor X/Y/Z maps to render-local X/-Z/Y. Rotate the full specific
        // force vector into the launch frame; horizontal axes need no gravity
        // subtraction. The raw attitude is intentional: the UI zero button is
        // a display calibration and must not bend the physical trajectory.
        const worldAcceleration = gyroFusionWorldAccelerationFromImu(
          ax,
          ay,
          az,
          gyroAttitudeQuat,
        );
        if(worldAcceleration){
          measuredAccelX = worldAcceleration.x;
          measuredAccelZ = worldAcceleration.z;
        }
      }

      if(phase === FLIGHT_PHASES.PRE_FLIGHT){
        const biasAlpha = dtSec > 0 ? 1 - Math.exp(-dtSec / 0.8) : 0.04;
        gyroPathState.fusionAccelBiasX +=
          (measuredAccelX - gyroPathState.fusionAccelBiasX) * biasAlpha;
        gyroPathState.fusionAccelBiasZ +=
          (measuredAccelZ - gyroPathState.fusionAccelBiasZ) * biasAlpha;
      }
      measuredAccelX -= gyroPathState.fusionAccelBiasX;
      measuredAccelZ -= gyroPathState.fusionAccelBiasZ;
      if(Math.abs(measuredAccelX) < GYRO_FUSION_ACCEL_DEADBAND_MPS2) measuredAccelX = 0;
      if(Math.abs(measuredAccelZ) < GYRO_FUSION_ACCEL_DEADBAND_MPS2) measuredAccelZ = 0;
      const measuredMagnitude = Math.hypot(measuredAccelX, measuredAccelZ);
      if(measuredMagnitude > GYRO_FUSION_ACCEL_CLAMP_MPS2){
        const accelScale = GYRO_FUSION_ACCEL_CLAMP_MPS2 / measuredMagnitude;
        measuredAccelX *= accelScale;
        measuredAccelZ *= accelScale;
      }
      if(dtSec > 0){
        gyroPathState.fusionLocalVelX +=
          measuredAccelX * poweredHorizontalAcceptance * dtSec;
        gyroPathState.fusionLocalVelZ +=
          measuredAccelZ * poweredHorizontalAcceptance * dtSec;
        const localVelocityLimit = GYRO_FUSION_MAX_SPEED_MPS * 1.4;
        const localSpeed = Math.hypot(
          gyroPathState.fusionLocalVelX,
          gyroPathState.fusionLocalVelZ
        );
        if(localSpeed > localVelocityLimit){
          const scale = localVelocityLimit / localSpeed;
          gyroPathState.fusionLocalVelX *= scale;
          gyroPathState.fusionLocalVelZ *= scale;
        }
      }
      if(gyroPathState.fusionImuYawReady){
        const aligned = rotateGyroFusionHorizontal(
          measuredAccelX,
          measuredAccelZ,
          gyroPathState.fusionImuYawOffsetRad
        );
        measuredAccelX = aligned.x;
        measuredAccelZ = aligned.z;
      }
      if(!gyroPathState.fusionAccelReady){
        gyroPathState.fusionAccelX = measuredAccelX;
        gyroPathState.fusionAccelZ = measuredAccelZ;
        gyroPathState.fusionAccelReady = true;
      }else{
        const accelAlpha = dtSec > 0
          ? 1 - Math.exp(-dtSec / dynamics.accelTau)
          : 0.04;
        gyroPathState.fusionAccelX +=
          (measuredAccelX - gyroPathState.fusionAccelX) * accelAlpha;
        gyroPathState.fusionAccelZ +=
          (measuredAccelZ - gyroPathState.fusionAccelZ) * accelAlpha;
      }

      if(enteringFlight){
        const gpsFresh = gyroPathState.fusionGpsValidMs > 0 &&
          (Date.now() - gyroPathState.fusionGpsValidMs) <= GYRO_FUSION_GPS_STALE_MS;
        if(!gpsFresh){
          gyroPathState.fusionVelX = 0;
          gyroPathState.fusionVelZ = 0;
        }
        gyroPathState.fusionLocalVelX = 0;
        gyroPathState.fusionLocalVelZ = 0;
        gyroPathState.fusionFlightTracking = true;
      }
      gyroPathState.fusionPhase = phase;

      if(phase === FLIGHT_PHASES.PRE_FLIGHT){
        gyroPathState.fusionFlightTracking = false;
        gyroPathState.fusionPosX = 0;
        gyroPathState.fusionPosZ = 0;
        gyroPathState.fusionVelX = 0;
        gyroPathState.fusionVelZ = 0;
        gyroPathState.fusionPosY = 0;
        gyroPathState.fusionVelY = 0;
        gyroPathState.fusionBaroVelMps = 0;
        gyroPathState.filteredY = 0;
        gyroPathState.fusionApogeeAltitudeM = 0;
        gyroPathState.fusionApogeeMs = 0;
        gyroPathState.fusionGpsRangeEnvelopeM = NaN;
      }else if(dtSec > 0){
        if(
          !isFinite(gyroPathState.fusionApogeeAltitudeM) ||
          gyroPathState.fusionPosY >= gyroPathState.fusionApogeeAltitudeM
        ){
          gyroPathState.fusionApogeeAltitudeM = Math.max(
            0,
            gyroPathState.fusionPosY
          );
          gyroPathState.fusionApogeeMs = now;
        }
        const timeSinceApogeeSec = gyroPathState.fusionApogeeMs > 0
          ? Math.max(0, (now - gyroPathState.fusionApogeeMs) / 1000)
          : 0;
        const horizontalRangeLimitM = getModelRocketHorizontalRangeLimitM({
          phase,
          altitudeM:Math.max(0, gyroPathState.fusionPosY),
          apogeeAltitudeM:gyroPathState.fusionApogeeAltitudeM,
          timeSinceApogeeSec,
          gpsRangeEnvelopeM:gyroPathState.fusionGpsRangeEnvelopeM,
          gpsAccuracyM:gyroPathState.fusionGpsAccuracyM
        });
        if(gyroPathState.fusionRailLocked){
          gyroPathState.fusionPosX = gyroPathState.fusionLaunchAnchorX;
          gyroPathState.fusionPosZ = gyroPathState.fusionLaunchAnchorZ;
          gyroPathState.fusionVelX = 0;
          gyroPathState.fusionVelZ = 0;
        }
        const steps = Math.max(1, Math.ceil(dtSec / GYRO_FUSION_STEP_SEC));
        const stepDt = dtSec / steps;
        for(let step=0;step<steps;step++){
          let rocketAxisWorld = gyroAttitudeReady
            ? quatRotateVector(gyroAttitudeQuat, [0, 1, 0])
            : [0, 1, 0];
          if(gyroPathState.fusionImuYawReady){
            const alignedAxis = rotateGyroFusionHorizontal(
              rocketAxisWorld[0],
              rocketAxisWorld[2],
              gyroPathState.fusionImuYawOffsetRad
            );
            rocketAxisWorld = [alignedAxis.x, rocketAxisWorld[1], alignedAxis.z];
          }
          const horizontalMotion = updateModelRocketHorizontalMotion(
            {
              velocityX:gyroPathState.fusionVelX,
              velocityZ:gyroPathState.fusionVelZ,
              positionX:gyroPathState.fusionPosX,
              positionZ:gyroPathState.fusionPosZ
            },
            {
              dtSec:stepDt,
              phase,
              verticalSpeedMps:gyroPathState.fusionVelY,
              axisX:rocketAxisWorld[0],
              axisZ:rocketAxisWorld[2],
              axisUp:rocketAxisWorld[1],
              accelX:gyroPathState.fusionAccelX,
              accelZ:gyroPathState.fusionAccelZ,
              horizontalAcceptance:gyroPathState.fusionRailLocked
                ? 0
                : poweredHorizontalAcceptance,
              horizontalRangeLimitM,
              horizontalRangeTargetM:gyroPathState.fusionGpsRangeEnvelopeM,
              rangeCorrectionAlpha:1 - Math.exp(-stepDt / 0.9),
              anchorX:gyroPathState.fusionLaunchAnchorX,
              anchorZ:gyroPathState.fusionLaunchAnchorZ
            }
          );
          gyroPathState.fusionVelX = horizontalMotion.velocityX;
          gyroPathState.fusionVelZ = horizontalMotion.velocityZ;
          gyroPathState.fusionPosX = horizontalMotion.positionX;
          gyroPathState.fusionPosZ = horizontalMotion.positionZ;
        }
        predictGyroFusionCovariance(dtSec, dynamics.processNoise);
        if(phase === FLIGHT_PHASES.LANDED){
          gyroPathState.fusionVelX = 0;
          gyroPathState.fusionVelZ = 0;
        }
      }

      updateGyroFusionGps(
        geo,
        data,
        now,
        phase !== FLIGHT_PHASES.PRE_FLIGHT && !gyroPathState.fusionRailLocked,
        phase
      );
      if(gyroPathState.fusionRailLocked){
        gyroPathState.fusionPosX = gyroPathState.fusionLaunchAnchorX;
        gyroPathState.fusionPosZ = gyroPathState.fusionLaunchAnchorZ;
        gyroPathState.fusionVelX = 0;
        gyroPathState.fusionVelZ = 0;
      }

      const gyroRateDps = Math.hypot(
        Number(data && data.gx) || 0,
        Number(data && data.gy) || 0,
        Number(data && data.gz) || 0
      );
      const motionMeasurement =
        (isFinite(accelNormG) ? Math.abs(accelNormG - 1) * GYRO_IMU_GRAVITY_MPS2 : 0) +
        (gyroRateDps * 0.012) +
        (Math.abs(gyroPathState.fusionVelY) * 0.08);
      const motionAlpha = dtSec > 0 ? 1 - Math.exp(-dtSec / 0.3) : 0.05;
      gyroPathState.fusionMotionScore +=
        (motionMeasurement - gyroPathState.fusionMotionScore) * motionAlpha;
      if(phase === FLIGHT_PHASES.LANDED && gyroPathState.fusionMotionScore < 0.42){
        if(!gyroPathState.fusionStationarySinceMs){
          gyroPathState.fusionStationarySinceMs = now;
          gyroPathState.fusionAnchorX = gyroPathState.fusionPosX;
          gyroPathState.fusionAnchorZ = gyroPathState.fusionPosZ;
        }
        const stationaryAgeMs = now - gyroPathState.fusionStationarySinceMs;
        gyroPathState.fusionVelX *= Math.exp(-Math.max(0, dtSec) * 7);
        gyroPathState.fusionVelZ *= Math.exp(-Math.max(0, dtSec) * 7);
        if(stationaryAgeMs >= GYRO_FUSION_STATIONARY_HOLD_MS){
          gyroPathState.fusionStationaryLocked = true;
          const capture = dtSec > 0 ? 1 - Math.exp(-dtSec * 8) : 0.2;
          gyroPathState.fusionPosX +=
            (gyroPathState.fusionAnchorX - gyroPathState.fusionPosX) * capture;
          gyroPathState.fusionPosZ +=
            (gyroPathState.fusionAnchorZ - gyroPathState.fusionPosZ) * capture;
        }
      }else{
        gyroPathState.fusionStationarySinceMs = 0;
        gyroPathState.fusionStationaryLocked = false;
      }

      const horizontalDistance = Math.hypot(
        gyroPathState.fusionPosX,
        gyroPathState.fusionPosZ
      );
      if(horizontalDistance > GYRO_FUSION_RANGE_LIMIT_M){
        const scale = GYRO_FUSION_RANGE_LIMIT_M / horizontalDistance;
        gyroPathState.fusionPosX *= scale;
        gyroPathState.fusionPosZ *= scale;
      }
      gyroPathState.fusionPosY = clampLocal(
        gyroPathState.fusionPosY,
        GYRO_FUSION_ALT_MIN_M,
        GYRO_FUSION_ALT_MAX_M
      );
      gyroPathState.source = "fusion";
      const gpsFresh = gyroPathState.fusionGpsValidMs > 0 &&
        (Date.now() - gyroPathState.fusionGpsValidMs) <= GYRO_FUSION_GPS_STALE_MS;
      if(!hasBaro && !gpsFresh) return false;
      if(!baroUpdated && !gpsFresh && dtSec <= 0 && gyroPathState.points.length > 0) return false;

      const horizontalPathAlpha = phase === FLIGHT_PHASES.POWERED_FLIGHT
        ? 0.26
        : (phase === FLIGHT_PHASES.COASTING
          ? 0.42
          : (phase === FLIGHT_PHASES.DESCENT ? 0.56 : 0.32));
      return pushGyroPathMeters(
        gyroPathState.fusionPosX,
        gyroPathState.fusionPosY,
        gyroPathState.fusionPosZ,
        now,
        {
          alphaX:horizontalPathAlpha,
          // Match the altitude chart sample-for-sample. Horizontal axes keep
          // their own smoothing because GPS/IMU noise does not affect chart Y.
          alphaY:1.0,
          alphaZ:horizontalPathAlpha,
          minStepM:0.06,
          minIntervalMs:30,
          idleHoldMs:180,
          idleDriftM:0.018,
          jumpRejectM:80,
          jumpRejectMs:700,
          altDeadbandM:0.01
        }
      );
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
        updateGyroUiAttitudeFromEuler(gyroRollDeg, gyroPitchDeg, gyroYawDeg, false);
        return;
      }

      if(dtSec > 0){
        // Match the 3MF basis: Quick X/Y/Z -> render X/-Z/Y.
        const omegaLocal = [
          (gx * DEG_TO_RAD),
          (gz * DEG_TO_RAD),
          -(gy * DEG_TO_RAD)
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
      updateGyroUiAttitudeFromEuler(gyroRollDeg, gyroPitchDeg, gyroYawDeg, false);
    }

    function applyFirmwareGyroAttitudeEstimate(
      rollRaw,
      pitchRaw,
      yawRaw,
      nowMs,
      gxRaw,
      gyRaw,
      gzRaw,
      attitudeQuatRaw,
      options
    ){
      const rollDeg = isFinite(rollRaw) ? Number(rollRaw) : NaN;
      const pitchDeg = isFinite(pitchRaw) ? Number(pitchRaw) : NaN;
      const yawDeg = isFinite(yawRaw) ? Number(yawRaw) : NaN;
      if(!isFinite(rollDeg) || !isFinite(pitchDeg) || !isFinite(yawDeg)) return false;
      const now = nowMs || Date.now();
      // New firmware publishes the already calibrated attitude quaternion.
      // Prefer it for physics because rebuilding it from Euler angles loses
      // information close to +/-90 degrees. Older logs still use the fallback.
      const firmwareQuat = quatFromFirmwareAttitude(attitudeQuatRaw);
      const targetQuat = firmwareQuat ||
        quatFromRenderEuler(pitchDeg, yawDeg, rollDeg);
      const smoothRelayedQuat = !!(options && options.smoothRelayedQuat);
      if(firmwareQuat){
        // It has already passed the firmware's Mahony filter and gyro bias
        // correction. A second rate limiter here caused the physics attitude
        // to lag the IMU sample during the high-g launch transient.
        gyroAttitudeQuat = firmwareQuat;
      }else if(!gyroAttitudeReady){
        gyroAttitudeQuat = targetQuat;
      }else{
        let dtSec = (gyroAttitudeLastMs > 0) ? ((now - gyroAttitudeLastMs) / 1000) : 0.02;
        if(!isFinite(dtSec) || dtSec < 0.005 || dtSec > 0.2) dtSec = 0.02;
        const rateMagDps = Math.hypot(
          isFinite(Number(gxRaw)) ? Number(gxRaw) : 0,
          isFinite(Number(gyRaw)) ? Number(gyRaw) : 0,
          isFinite(Number(gzRaw)) ? Number(gzRaw) : 0
        );
        const current = quatNormalize(gyroAttitudeQuat);
        const target = quatNormalize(targetQuat);
        const dot = Math.abs(
          (current[0] * target[0]) + (current[1] * target[1]) +
          (current[2] * target[2]) + (current[3] * target[3])
        );
        const angleRad = 2 * Math.acos(clampLocal(dot, -1, 1));
        const lowMotion = rateMagDps < 5;
        const maxStepDeg = lowMotion
          ? 1.5
          : clampLocal((rateMagDps * dtSec * 1.7) + 3, 5, 80);
        const rateLimit = angleRad > 1e-6
          ? Math.min(1, (maxStepDeg * DEG_TO_RAD) / angleRad)
          : 1;
        const response = lowMotion ? 0.24 : 0.72;
        gyroAttitudeQuat = quatSlerpShortest(current, target, Math.min(1, rateLimit * response));
      }
      gyroRollDeg = normalizeAngleDeg(rollDeg);
      gyroPitchDeg = clampLocal(pitchDeg, -89.5, 89.5);
      gyroYawDeg = normalizeAngleDeg(yawDeg);
      gyroAttitudeReady = true;
      gyroAttitudeLastMs = now;
      updateGyroUiAttitudeFromEuler(
        gyroRollDeg,
        gyroPitchDeg,
        gyroYawDeg,
        smoothRelayedQuat
      );
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
        const currentScale = gyroPathState.renderScaleY;
        const nextScale = currentScale +
          (GYRO_TRAIL_BASE_METERS_PER_UNIT - currentScale) * GYRO_TRAIL_ZOOM_IN_SMOOTH;
        gyroPathState.renderScaleXZ = nextScale / GYRO_TRAIL_HORIZONTAL_EXAGGERATION;
        gyroPathState.renderScaleY = nextScale;
        gyroPathState.smoothPath = [];
        return baseResult;
      }

      const sourcePoints = pts.slice(
        Math.max(0, pts.length - GYRO_TRAIL_MAX_POINTS)
      );
      let subset = sourcePoints;
      if(sourcePoints.length > GYRO_TRAIL_RENDER_MAX_POINTS){
        const stride = Math.ceil(
          sourcePoints.length / GYRO_TRAIL_RENDER_MAX_POINTS
        );
        subset = [];
        for(let i = 0; i < sourcePoints.length; i += stride){
          subset.push(sourcePoints[i]);
        }
        const finalPoint = sourcePoints[sourcePoints.length - 1];
        if(subset[subset.length - 1] !== finalPoint) subset.push(finalPoint);
      }
      let maxAbsX = 0;
      let maxAbsY = 0;
      let maxAbsZ = 0;
      for(let i=0;i<subset.length;i++){
        const p = subset[i];
        const ax = Math.abs(p.x), ay = Math.abs(p.y), az = Math.abs(p.z);
        if(ax > maxAbsX) maxAbsX = ax;
        if(ay > maxAbsY) maxAbsY = ay;
        if(az > maxAbsZ) maxAbsZ = az;
      }
      // Use one animated master scale with a fixed horizontal presentation ratio.
      // This keeps lateral motion readable without reshaping earlier trail segments.
      const targetScale = Math.max(
        GYRO_TRAIL_BASE_METERS_PER_UNIT,
        (maxAbsX * GYRO_TRAIL_HORIZONTAL_EXAGGERATION) / GYRO_TRAIL_HALF_SPAN_XZ,
        (maxAbsZ * GYRO_TRAIL_HORIZONTAL_EXAGGERATION) / GYRO_TRAIL_HALF_SPAN_XZ,
        maxAbsY / GYRO_TRAIL_HALF_SPAN_Y
      );
      const currentScale = gyroPathState.renderScaleY;
      const scaleSmooth = (targetScale > currentScale)
        ? GYRO_TRAIL_ZOOM_OUT_SMOOTH
        : GYRO_TRAIL_ZOOM_IN_SMOOTH;
      const nextScale = currentScale + (targetScale - currentScale) * scaleSmooth;
      gyroPathState.renderScaleXZ = nextScale / GYRO_TRAIL_HORIZONTAL_EXAGGERATION;
      gyroPathState.renderScaleY = nextScale;

      if(gyroPathState.cachedLastMs !== gyroPathState.lastFixMs){
        gyroPathState.cachedLastMs = gyroPathState.lastFixMs;
        let apogeeIndex = 0;
        for(let i=1;i<subset.length;i++){
          if(subset[i].y > subset[apogeeIndex].y) apogeeIndex = i;
        }
        const launchPoint = subset[0];
        const apogeeRiseM = Math.max(0, subset[apogeeIndex].y - launchPoint.y);
        const verticalHoldM = Math.min(
          GYRO_PREVIEW_ASCENT_VERTICAL_HOLD_M,
          apogeeRiseM * 0.18
        );
        const curveFullM = Math.max(
          verticalHoldM + 0.5,
          Math.min(GYRO_PREVIEW_ASCENT_CURVE_FULL_M, apogeeRiseM * 0.55)
        );
        let ascentPeakM = 0;
        gyroPathState.smoothPathMeters = subset.map((point, index)=>{
          let x = point.x;
          let z = point.z;
          if(index <= apogeeIndex && apogeeRiseM > 0.5){
            ascentPeakM = Math.max(ascentPeakM, point.y - launchPoint.y);
            const ratio = clampLocal(
              (ascentPeakM - verticalHoldM) /
                Math.max(0.5, curveFullM - verticalHoldM),
              0,
              1
            );
            const smoothRatio = ratio * ratio * (3 - (2 * ratio));
            const curveBlend = GYRO_PREVIEW_ASCENT_MIN_HORIZONTAL_BLEND +
              ((1 - GYRO_PREVIEW_ASCENT_MIN_HORIZONTAL_BLEND) * smoothRatio);
            x = launchPoint.x + ((point.x - launchPoint.x) * curveBlend);
            z = launchPoint.z + ((point.z - launchPoint.z) * curveBlend);
          }
          return {x, y:point.y, z};
        });
      }

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

      const scaleXZ = gyroPathState.renderScaleXZ;
      const scaleY = gyroPathState.renderScaleY;
      const smoothPath = [];
      const smoothPathMeters = gyroPathState.smoothPathMeters || [];

      for(let i=0;i<smoothPathMeters.length;i++){
        const m = smoothPathMeters[i];
        const wx = m.x / scaleXZ;
        const wy = GYRO_WORLD_ALTITUDE_BASE + (m.y / scaleY);
        const wz = m.z / scaleXZ;
        smoothPath.push({x: wx, y: wy, z: wz});
        trailPos.push(wx, wy, wz);
        trailCol.push(trailR, trailG, trailB, 0.98);
        trailGlowCol.push(trailR, trailG, trailB, 0.92);
        trailAuraCol.push(trailR, trailG, trailB, 0.86);
        trailHotCol.push(trailR, trailG, trailB, 0.84);
        if(wx < minWX) minWX = wx;
        if(wy < minWY) minWY = wy;
        if(wz < minWZ) minWZ = wz;
        if(wx > maxWX) maxWX = wx;
        if(wy > maxWY) maxWY = wy;
        if(wz > maxWZ) maxWZ = wz;
      }

      gyroPathState.smoothPath = smoothPath;

      const currentRaw = subset[subset.length - 1];
      const currentWorld = {
        x: currentRaw.x / scaleXZ,
        y: GYRO_WORLD_ALTITUDE_BASE + (currentRaw.y / scaleY),
        z: currentRaw.z / scaleXZ
      };
      if(smoothPath.length) smoothPath[smoothPath.length - 1] = currentWorld;

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
      const cameraDistance = clampLocal(3.1 + (extent * 1.2) + (heightSpread * 0.55), GYRO_CAMERA_MIN_DISTANCE + 0.15, getGyroCameraMaxDistance() - 2.2);
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
      const colorLift = (style && isFinite(style.colorLift)) ? Math.max(0, Math.min(1, style.colorLift)) : 0;
      const sheen = (style && isFinite(style.sheen)) ? Math.max(0, Math.min(1, style.sheen)) : 0;
      const materialDetail = (style && isFinite(style.materialDetail))
        ? Math.max(0, Math.min(1, style.materialDetail))
        : 0;
      const opacity = (style && isFinite(style.opacity)) ? Math.max(0, Math.min(1, style.opacity)) : 1;
      const lightDir = (style && style.lightDir) ? style.lightDir : [0.34, 0.88, 0.29];
      gl.uniformMatrix4fv(solid.uModel, false, new Float32Array(model));
      gl.uniformMatrix4fv(solid.uView, false, new Float32Array(view));
      gl.uniformMatrix4fv(solid.uProj, false, new Float32Array(gyroGl.proj));
      gl.uniform3f(solid.uLightDir, lightDir[0], lightDir[1], lightDir[2]);
      gl.uniform1f(solid.uAmbient, ambient);
      gl.uniform3f(solid.uFogColor, fogColor[0], fogColor[1], fogColor[2]);
      gl.uniform1f(solid.uFogNear, fogNear);
      gl.uniform1f(solid.uFogFar, fogFar);
      gl.uniform1f(solid.uColorLift, colorLift);
      gl.uniform1f(solid.uSheen, sheen);
      gl.uniform1f(solid.uMaterialDetail, materialDetail);
      gl.uniform1f(solid.uOpacity, opacity);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }

    function drawGyroTerrain(model, view, style, modelScale){
      if(!gyroGl || !gyroGl.terrain || !gyroGl.terrain.count || !gyroGl.terrain.texture) return false;
      const gl = gyroGl.gl;
      const terrain = gyroGl.terrain;
      gl.useProgram(terrain.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, terrain.posBuf);
      gl.enableVertexAttribArray(terrain.aPos);
      gl.vertexAttribPointer(terrain.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, terrain.normBuf);
      gl.enableVertexAttribArray(terrain.aNorm);
      gl.vertexAttribPointer(terrain.aNorm, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, terrain.uvBuf);
      gl.enableVertexAttribArray(terrain.aUv);
      gl.vertexAttribPointer(terrain.aUv, 2, gl.FLOAT, false, 0, 0);
      const fogColor = style && style.fogColor ? style.fogColor : [0.035,0.055,0.09];
      const lightDir = style && style.lightDir ? style.lightDir : [0.34,0.88,0.29];
      gl.uniformMatrix4fv(terrain.uModel, false, new Float32Array(model));
      gl.uniformMatrix4fv(terrain.uView, false, new Float32Array(view));
      gl.uniformMatrix4fv(terrain.uProj, false, new Float32Array(gyroGl.proj));
      gl.uniform3f(terrain.uLightDir, lightDir[0], lightDir[1], lightDir[2]);
      const scale = modelScale || [1,1,1];
      gl.uniform3f(terrain.uModelScale, scale[0], scale[1], scale[2]);
      gl.uniform1f(terrain.uCenterElevationM, isFinite(gyroTerrainState.centerElevationM) ? gyroTerrainState.centerElevationM : 0);
      gl.uniform1f(terrain.uAmbient, 0.38);
      gl.uniform3f(terrain.uFogColor, fogColor[0], fogColor[1], fogColor[2]);
      // Terrain supports a much wider zoom range than the rocket view. Keep
      // atmospheric fade beyond the usable camera range so zooming out does
      // not turn the entire map into the sky color.
      gl.uniform1f(terrain.uFogNear, 320);
      gl.uniform1f(terrain.uFogFar, 1400);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, terrain.texture);
      gl.uniform1i(terrain.uTexture, 0);
      gl.drawArrays(gl.TRIANGLES, 0, terrain.count);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return true;
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
      const inExpanded = isGyroViewportExpanded();
      const inCameraPreview = !!(el.gyro3dViewport &&
        el.gyro3dViewport.classList.contains("is-camera-preview-mounted") &&
        !el.gyro3dViewport.classList.contains("is-camera-gyro-plus-mounted"));
      const rocketDisplayScale = showWorldDecor
        ? Math.max(
          0.08,
          GYRO_ROCKET_ACTUAL_HEIGHT_M /
            (GYRO_ROCKET_TARGET_LENGTH * Math.max(0.1, gyroPathState.renderScaleY))
        )
        : GYRO_ROCKET_SCALE * (inCameraPreview ? 1.2 : 1);
      const worldRocketLift = showWorldDecor
        ? Math.max(0.08, (rocketDisplayScale * 0.78) - GYRO_WORLD_ALTITUDE_BASE + 0.03)
        : 0;
      const rocketRenderPos = showWorldDecor
        ? {x:pathRender.current.x, y:pathRender.current.y + worldRocketLift, z:pathRender.current.z}
        : simpleRocketPos;
      const separation = Math.max(0, Math.min(1, cameraStageSeparationProgress));
      const cameraFocusEase = 1 - Math.pow(1 - separation, 4);
      const rocketRotation = quatToMat4(getGyroRocketModelQuat());
      const stages = gyroGl.solid.rocketStages;
      const fullVisualCenter = gyroGl.solid.rocketVisualCenter || [0,0,0];
      const stage1VisualCenter = stages && stages.stage1 && stages.stage1.visualCenter
        ? stages.stage1.visualCenter
        : fullVisualCenter;
      const focusCenter = [
        fullVisualCenter[0] + ((stage1VisualCenter[0] - fullVisualCenter[0]) * cameraFocusEase),
        fullVisualCenter[1] + ((stage1VisualCenter[1] - fullVisualCenter[1]) * cameraFocusEase),
        fullVisualCenter[2] + ((stage1VisualCenter[2] - fullVisualCenter[2]) * cameraFocusEase)
      ];
      const visualCenterOffset = mat4TransformVec4(
        rocketRotation,
        focusCenter[0] * rocketDisplayScale,
        focusCenter[1] * rocketDisplayScale,
        focusCenter[2] * rocketDisplayScale,
        0
      );
      const rocketLookTarget = {
        x:rocketRenderPos.x + visualCenterOffset[0],
        y:rocketRenderPos.y + visualCenterOffset[1],
        z:rocketRenderPos.z + visualCenterOffset[2]
      };
      const lookTargetSource = (inCameraPreview || showWorldDecor)
        ? {
            x:rocketLookTarget.x,
            y:rocketLookTarget.y + (inCameraPreview ? GYRO_CAMERA_PREVIEW_TARGET_Y_OFFSET : 0),
            z:rocketLookTarget.z
          }
        : {x:0, y:GYRO_WORLD_ALTITUDE_BASE + 0.46, z:0};
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
      if(showWorldDecor){
        renderStyle.ambient = darkTheme ? 0.61 : 0.54;
        renderStyle.lightDir = [-0.58,0.66,0.48];
        renderStyle.colorLift = darkTheme ? 0.055 : 0.035;
        renderStyle.sheen = darkTheme ? 0.19 : 0.14;
        renderStyle.materialDetail = 1;
        // Terrain uses a daylight atmosphere regardless of the surrounding UI
        // theme. The short attitude-view fog made the map edge look black.
        renderStyle.fogColor = darkTheme
          ? [0.48,0.57,0.64]
          : [0.66,0.73,0.79];
        renderStyle.clear = darkTheme
          ? [0.48,0.57,0.64,1]
          : [0.66,0.73,0.79,1];
        renderStyle.fogNear = 42;
        renderStyle.fogFar = 220;
      }
      if(inCameraPreview){
        renderStyle.clear = [0.01,0.018,0.03,0.03];
        renderStyle.ambient = 0.71;
        renderStyle.lightDir = [-0.32,0.88,0.36];
        renderStyle.colorLift = 0.065;
        renderStyle.sheen = 0.12;
        renderStyle.materialDetail = 1;
      }

      const manualZoomActive = Date.now() < Number(gyroCameraState.manualZoomUntilMs || 0);
      if(!inExpanded && !manualZoomActive){
        const panDamp = showWorldDecor ? 0.88 : 0.82;
        const terrainOverviewActive = showWorldDecor &&
          gyroTerrainState.status === "ready" &&
          (!gyroPathState.points || gyroPathState.points.length === 0);
        const autoDistance = inCameraPreview
          ? (GYRO_CAMERA_PREVIEW_DISTANCE - (0.18 * cameraFocusEase))
          : (showWorldDecor
              ? (terrainOverviewActive ? GYRO_TERRAIN_DEFAULT_CAMERA_DISTANCE : pathRender.cameraDistance)
              : (GYRO_CAMERA_DEFAULT.distance + 0.34));
        const distanceEase = showWorldDecor ? 0.1 : 0.16;
        gyroCameraState.panX *= panDamp;
        gyroCameraState.panY *= panDamp;
        gyroCameraState.panZ *= panDamp;
        gyroCameraState.desiredDistance += (autoDistance - gyroCameraState.desiredDistance) * distanceEase;
      }
      const cameraMinDistance = getGyroCameraMinDistance();
      gyroCameraState.desiredDistance = clampLocal(gyroCameraState.desiredDistance, cameraMinDistance, getGyroCameraMaxDistance());
      const cameraDistanceSmooth = (inCameraPreview && separation > 0) ? 0.24 : GYRO_CAMERA_DISTANCE_SMOOTH;
      gyroCameraState.distance += (gyroCameraState.desiredDistance - gyroCameraState.distance) * cameraDistanceSmooth;

      const targetX = lookTargetSource.x + gyroCameraState.panX;
      const targetY = lookTargetSource.y + gyroCameraState.panY;
      const targetZ = lookTargetSource.z + gyroCameraState.panZ;
      const targetSmooth = (inCameraPreview && separation > 0)
        ? 1
        : (inCameraPreview ? 0.36 : (showWorldDecor ? 0.34 : GYRO_CAMERA_TARGET_SMOOTH));
      gyroCameraState.targetX += (targetX - gyroCameraState.targetX) * targetSmooth;
      gyroCameraState.targetY += (targetY - gyroCameraState.targetY) * targetSmooth;
      gyroCameraState.targetZ += (targetZ - gyroCameraState.targetZ) * targetSmooth;

      const rocketModel = mat4Mul(
        mat4Translate(rocketRenderPos.x, rocketRenderPos.y, rocketRenderPos.z),
        mat4Mul(rocketRotation, mat4Scale(rocketDisplayScale, rocketDisplayScale, rocketDisplayScale))
      );
      const basis = getGyroCameraBasis();
      let eye = [
        gyroCameraState.targetX + (basis.orbitDir[0] * gyroCameraState.distance),
        gyroCameraState.targetY + (basis.orbitDir[1] * gyroCameraState.distance),
        gyroCameraState.targetZ + (basis.orbitDir[2] * gyroCameraState.distance)
      ];
      let center = [gyroCameraState.targetX, gyroCameraState.targetY, gyroCameraState.targetZ];
      let view = mat4LookAt(eye, center, [0,1,0]);
      let viewProj = mat4Mul(gyroGl.proj, view);
      const stage1FocusSamples = stages && stages.stage1 && stages.stage1.focusSamples;
      if(inCameraPreview && separation > 0.001 && stage1FocusSamples && stage1FocusSamples.length >= 3){
        const stage1Mvp = mat4Mul(viewProj, rocketModel);
        let minNdcX = Infinity, minNdcY = Infinity;
        let maxNdcX = -Infinity, maxNdcY = -Infinity;
        for(let i=0;i+2<stage1FocusSamples.length;i+=3){
          const clip = mat4TransformVec4(
            stage1Mvp,
            stage1FocusSamples[i],
            stage1FocusSamples[i + 1],
            stage1FocusSamples[i + 2],
            1
          );
          if(!isFinite(clip[3]) || clip[3] <= 1e-5) continue;
          const ndcX = clip[0] / clip[3];
          const ndcY = clip[1] / clip[3];
          if(!isFinite(ndcX) || !isFinite(ndcY)) continue;
          minNdcX = Math.min(minNdcX, ndcX); maxNdcX = Math.max(maxNdcX, ndcX);
          minNdcY = Math.min(minNdcY, ndcY); maxNdcY = Math.max(maxNdcY, ndcY);
        }
        if(isFinite(minNdcX) && isFinite(minNdcY)){
          const projectedCenterX = (minNdcX + maxNdcX) * 0.5;
          const projectedCenterY = (minNdcY + maxNdcY) * 0.5;
          const correctionStrength = 0.82 * cameraFocusEase;
          const halfWidthAtTarget = gyroCameraState.distance / Math.max(1e-5, gyroGl.proj[0]);
          const halfHeightAtTarget = gyroCameraState.distance / Math.max(1e-5, gyroGl.proj[5]);
          const correctionX = clampLocal(projectedCenterX * halfWidthAtTarget * correctionStrength, -0.08, 0.08);
          const correctionY = clampLocal(projectedCenterY * halfHeightAtTarget * correctionStrength, -0.08, 0.08);
          const cameraRight = [view[0], view[4], view[8]];
          const cameraUp = [view[1], view[5], view[9]];
          gyroCameraState.targetX += (cameraRight[0] * correctionX) + (cameraUp[0] * correctionY);
          gyroCameraState.targetY += (cameraRight[1] * correctionX) + (cameraUp[1] * correctionY);
          gyroCameraState.targetZ += (cameraRight[2] * correctionX) + (cameraUp[2] * correctionY);
          center = [gyroCameraState.targetX, gyroCameraState.targetY, gyroCameraState.targetZ];
          eye = [
            center[0] + (basis.orbitDir[0] * gyroCameraState.distance),
            center[1] + (basis.orbitDir[1] * gyroCameraState.distance),
            center[2] + (basis.orbitDir[2] * gyroCameraState.distance)
          ];
          view = mat4LookAt(eye, center, [0,1,0]);
          viewProj = mat4Mul(gyroGl.proj, view);
        }
      }
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
        const terrainReady = gyroTerrainState.status === "ready" &&
          gyroGl.terrain && gyroGl.terrain.count > 0;
        if(terrainReady){
          const terrainScaleXZ = 1 / Math.max(0.1, gyroPathState.renderScaleXZ);
          const terrainScaleY = GYRO_TERRAIN_EXAGGERATION /
            Math.max(0.1, gyroPathState.renderScaleXZ * GYRO_TERRAIN_VERTICAL_COMPRESSION);
          const terrainModel = mat4Mul(
            mat4Translate(0, 0, 0),
            mat4Scale(terrainScaleXZ, terrainScaleY, terrainScaleXZ)
          );
          drawGyroTerrain(
            terrainModel,
            view,
            renderStyle,
            [terrainScaleXZ, terrainScaleY, terrainScaleXZ]
          );
          if(gyroGl.terrain.buildingCount > 0){
            const buildingStyle = Object.assign({}, renderStyle, {
              ambient:0.34,
              colorLift:0,
              materialDetail:0,
              lightDir:[-0.58,0.66,0.48],
              fogNear:320,
              fogFar:1400
            });
            drawSolidBatch(
              gyroGl.terrain.buildingPosBuf,
              gyroGl.terrain.buildingNormBuf,
              gyroGl.terrain.buildingColBuf,
              gyroGl.terrain.buildingCount,
              terrainModel,
              view,
              buildingStyle
            );
          }
        }else{
          const floorModel = mat4Mul(
            mat4Translate(pathRender.gridCenter.x, 0, pathRender.gridCenter.z),
            mat4Scale(pathRender.gridSpan, 1, pathRender.gridSpan)
          );
          const floorStyle = Object.assign({}, renderStyle, {materialDetail:0});
          drawSolidBatch(
            gyroGl.solid.floorPosBuf,
            gyroGl.solid.floorNormBuf,
            gyroGl.solid.floorColBuf,
            gyroGl.solid.floorCount,
            floorModel,
            view,
            floorStyle
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
      }

      if(!inCameraPreview){
        const axisModel = mat4Identity();
        const axisMvp = mat4Mul(viewProj, axisModel);
        bindLineAttributes(gyroGl.line.staticPosBuf, gyroGl.line.staticColBuf);
        gl.uniformMatrix4fv(gyroGl.line.uMvp, false, new Float32Array(axisMvp));
        gl.drawArrays(gl.LINES, gyroGl.sections.axisStart, gyroGl.sections.axisCount);
      }

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
        const shellGeom = buildGyroTrailRibbonGeometry(trailPts, eye, 0.02, (t, i)=>{
          const pulse = 0.82 + (0.18 * Math.sin((i * 0.28) + phase));
          return [0.02, 0.02, 0.03, (0.22 + (0.55 * t)) * pulse];
        });
        const glowGeom = buildGyroTrailRibbonGeometry(trailPts, eye, 0.014, (t, i)=>{
          const pulse = 0.76 + (0.24 * Math.sin((i * 0.34) + phase));
          return [1.0, 0.12 + (0.18 * t), 0.1 + (0.12 * t), (0.08 + (0.36 * t)) * pulse];
        });
        const coreGeom = buildGyroTrailRibbonGeometry(trailPts, eye, 0.009, (t)=>{
          const ease = t * t * (3 - (2 * t));
          return [0.88 + (0.1 * ease), 0.05 + (0.1 * ease), 0.08 + (0.07 * ease), 0.66 + (0.32 * ease)];
        });
        const hotGeom = buildGyroTrailRibbonGeometry(trailPts, eye, 0.0048, (t, i)=>{
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

      const drawStage = (stage, model, style)=>{
        if(!stage || !stage.count) return;
        drawSolidBatch(stage.posBuf, stage.normBuf, stage.colBuf, stage.count, model, view, style);
      };
      if(stages){
        if(separation > 0.001){
          const moveEase = 1 - Math.pow(1 - separation, 3);
          const fadeProgress = Math.max(0, Math.min(1, (separation - 0.22) / 0.78));
          const fadeEase = fadeProgress * fadeProgress * (3 - (2 * fadeProgress));
          drawStage(stages.stage1, rocketModel, renderStyle);
          const secondStageVisibility = Math.max(0, 1 - fadeEase);
          if(secondStageVisibility > 0.01){
            const blurRadius = fadeEase * 0.032;
            const blurSamples = [
              [0, 0, 0, 1 - (.42 * fadeEase)],
              [blurRadius, 0, 0, .16 * fadeEase],
              [-blurRadius, 0, 0, .16 * fadeEase],
              [0, 0, blurRadius, .16 * fadeEase],
              [0, 0, -blurRadius, .16 * fadeEase],
              [0, -blurRadius * .8, 0, .11 * fadeEase],
              [0, blurRadius * .55, 0, .08 * fadeEase]
            ];
            gl.depthMask(false);
            blurSamples.forEach((sample)=>{
              const sampleOpacity = secondStageVisibility * sample[3];
              if(sampleOpacity <= 0.001) return;
              const secondStageStyle = Object.assign({}, renderStyle, {opacity:sampleOpacity});
              const secondStageModel = mat4Mul(
                mat4Translate(rocketRenderPos.x, rocketRenderPos.y, rocketRenderPos.z),
                mat4Mul(
                  rocketRotation,
                  mat4Mul(
                    mat4Translate(sample[0], (moveEase * 0.22) + sample[1], sample[2]),
                    mat4Scale(rocketDisplayScale, rocketDisplayScale, rocketDisplayScale)
                  )
                )
              );
              drawStage(stages.stage2, secondStageModel, secondStageStyle);
            });
            gl.depthMask(true);
          }
        }else{
          drawStage(stages.stage1, rocketModel, renderStyle);
          drawStage(stages.stage2, rocketModel, renderStyle);
        }
      }else{
        drawSolidBatch(gyroGl.solid.rocketPosBuf, gyroGl.solid.rocketNormBuf, gyroGl.solid.rocketColBuf, gyroGl.solid.rocketCount, rocketModel, view, renderStyle);
      }

      if(!inCameraPreview){
        bindLineAttributes(gyroGl.line.staticPosBuf, gyroGl.line.staticColBuf);
        gl.uniformMatrix4fv(gyroGl.line.uMvp, false, new Float32Array(mat4Mul(viewProj, rocketModel)));
        gl.drawArrays(gl.LINES, gyroGl.sections.bodyStart, gyroGl.sections.bodyCount);
      }
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

    function scheduleLiveGyroRender(gyroRateY){
      const rateY = Number(gyroRateY);
      if(isFinite(rateY)) liveGyroLastRateY = rateY;
      if(!gyroGl) return;
      if(liveGyroRenderRaf) return;
      liveGyroRenderRaf = requestAnimationFrame(()=>{
        liveGyroRenderRaf = 0;
        if(!gyroGl) return;
        const nowUi = Date.now();
        const displayRollDeg = getGyroDisplayRollDeg();
        const displayPitchDeg = getGyroDisplayPitchDeg();
        const displayYawDeg = getGyroDisplayYawDeg();
        renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        renderNavBall(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        renderGyroPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        renderNavBallPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        updateLauncherPitchAngle(displayPitchDeg, liveGyroLastRateY, nowUi);
        if(gyroLastUiMs === 0 || (nowUi - gyroLastUiMs) >= 80){
          if(el.gyroRollDeg) el.gyroRollDeg.innerHTML = `<span class="num">${displayRollDeg.toFixed(1)}</span><span class="unit">deg</span>`;
          if(el.gyroPitchDeg) el.gyroPitchDeg.innerHTML = `<span class="num">${displayPitchDeg.toFixed(1)}</span><span class="unit">deg</span>`;
          if(el.gyroYawDeg) el.gyroYawDeg.innerHTML = `<span class="num">${displayYawDeg.toFixed(1)}</span><span class="unit">deg</span>`;
          gyroLastUiMs = nowUi;
        }
      });
    }

    function scheduleOfflineGyroDefaultPreview(){
      if(offlineGyroPreviewRenderRaf) return;
      offlineGyroPreviewRenderRaf = requestAnimationFrame(()=>{
        offlineGyroPreviewRenderRaf = 0;
        if(isDeviceUiOnline() || simEnabled || replaySourceActive) return;
        resetGyroAttitudeState();
        resetGyroPathTracking();
        resetGyroCameraPose(true);
        if(gyroGl) renderGyroGl(0, 0, 0);
        renderNavBall(0, 0, 0);
        renderGyroPreview(0, 0, 0);
        renderNavBallPreview(0, 0, 0);
      });
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
    const VIRTUAL_MISSION_CH1_MS = 2000;
    const VIRTUAL_MISSION_CH2_MS = 3000;
    const VIRTUAL_MISSION_COMPLETE_MS = 4500;
    let virtualMissionActive = false;
    let virtualMissionStartMs = 0;
    let virtualMissionTimer = null;
    let virtualMissionCh1Logged = false;
    let virtualMissionCh2Logged = false;

    // ✅ RelaySafe/LOCKOUT
    let relaySafeEnabled = true;
    let safetyModeEnabled = false;
    const BOARD_CONTROL_CONFIRM_TIMEOUT_MS = 5000;
    const pendingBoardControls = {
      safety:null,
      armLock:null
    };
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
    let serialSessionId = 0;
    let serialPortEventsBound = false;
    let serialLineBuf = "";
    let serialConnected = false;
    let serialConnectedRole = "";
    let lastSerialSampleAt = 0;
    let lastSerialActivityAt = 0;
    let pendingSerialTelemetrySample = null;
    let serialTelemetryFrameHandle = 0;
    let serialRxDisabledWarned = false;
    let wifiConnectStage = "idle";
    let wifiConnectWaitTimer = null;
    let wifiConnectWaitUntilMs = 0;
    let wifiConnectLastProbeError = "";
    let autoWifiConnectBusy = false;
    let autoWifiConnectTimer = null;
    let serialConnectStage = "idle";
    let serialConnectRequireGround = false;
    let serialGroundRequired = false;
    let lastAutoSerialScanMs = 0;
    let welcomeConnectCompleted = false;
    let welcomeConnectionVerifiedAtMs = 0;
    let welcomeConnectAttempted = false;
    let welcomeDashboardEntered = false;
    let welcomeBoardSearchBusy = false;
    let groundStationConnectionEstablished = false;
    let groundStationWaitStartedAt = 0;
    let groundStationWaitTimer = null;
    let connectionGuideTab = "wifi";
    let simEnabled = false;
    function createSimState(){
      return {
        st:0,
        cdMs:0,
        countdownStartMs:null,
        ignStartMs:null,
        countdownTotalMs:null,
        missionStandby:false,
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
        pitchDeg:88.6,
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
        gpsPhase:0,
        apogeeM:0,
        flightPhase:"PRE_FLIGHT",
        flightPhaseStartedMs:0,
        stageSeparated:false,
        stageSeparationStartedMs:null,
        stageSeparationAltitudeM:null,
        stageSeparationAnnounced:false
      };
    }
    let simState = createSimState();
    const WIFI_CONNECT_WAIT_TIMEOUT_MS = 20000;
    const GROUND_STATION_WAIT_MIN_MS = 2000;

    // ✅ 설비 점검/제어 권한
    let controlAuthority = false;
    let inspectionState = "idle";
    let inspectionRunning = false;
    let inspectionLastFailedKeys = [];
    let inspectionSyncPendingValue = null;
    let inspectionSyncPendingUntilMs = 0;
    let latestTelemetry = {sw:null, ic:null, rly:null, mode:null, uw:null, al:null, gs:0};
    let latestTelemetryGeo = null;
    const STAGE_TELEMETRY_HISTORY_MAX = 1100;
    function createStageTelemetryState(stageId){
      return {
        stageId,
        connected:false,
        valid:false,
        updatedAt:0,
        rxSeq:0,
        attitudeRevision:0,
        gyroAppliedRevision:0,
        data:null,
        altitudeM:NaN,
        speedMps:NaN,
        gforceG:NaN,
        lastEvent:"--",
        timeHistory:[],
        altitudeHistory:[],
        speedHistory:[],
        gforceHistory:[],
        ascentAccelHistory:[]
      };
    }
    const stageTelemetryStore = {
      1:createStageTelemetryState(1),
      2:createStageTelemetryState(2)
    };
    let stageTelemetryModeActive = false;
    let dashboardTelemetryStageId = 1;
    let cameraHudActiveStageId = 1;
    let cameraHudStageSwitchLatched = false;
    let lastMissionStandbyAckKey = "";
    let gpsFixAlarmState = null;
    const STATUS_MAP_DEFAULT = Object.freeze({lat:34.96601, lon:127.83238, zoom:12});
    const STATUS_MAP_KR_BOUNDS = Object.freeze({south:33.0, west:124.5, north:38.9, east:131.9});
    const STATUS_MAP_TILE_SOURCES = Object.freeze([
      Object.freeze({
        id: "carto",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        subdomains: "abcd",
        attribution: "&copy; OSM contributors &copy; CARTO"
      }),
      Object.freeze({
        id: "local",
        url: "/tiles/{z}/{x}/{y}.png",
        attribution: "Offline tiles"
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
      tileCycleLoadCount: 0,
      tileCycleErrorCount: 0,
      tileOffline: false,
      tileProbeTimer: null,
      tileSourceIndex: -1,
      leafletLoadInFlight: false,
      leafletLoadFailed: false,
      uiBound: false,
      hasLiveFix: false,
      lastUpdateMs: 0
    };
    const intelligentCalibrationMapState = {
      map: null,
      marker: null,
      tileLayer: null,
      lastLat: NaN,
      lastLon: NaN,
      refreshTimers: [],
      retryTimer: null,
      tileSourceIndex: -1,
      tileLoadCount: 0,
      tileErrorCount: 0,
      tileFallbackTimer: null
    };
    let lastBatteryV = null;
    let lastBatteryPct = null;
    let lastChipTempC = null;
    let lastChipTempSampleMs = 0;
    // PERF load is an instant ratio (ct/lt) sampled at high rate.
    // Light smoothing avoids visually misleading 100%/40% flapping.
    const PERF_LOAD_EMA_ALPHA = 0.18;
    let lastPerfLoadRawPct = null;
    let lastPerfLoadPct = null;
    let lastPerfCpuUs = null;
    let lastPerfLoopUs = null;
    let lastPerfSampleMs = 0;
    let spiFlashReadyState = null;
    let spiFlashProbePending = false;
    let spiFlashProbeLastMs = 0;
    let latestSpiFlashStorageInfo = null;
    let latestSpiFlashStorageOkMs = 0;
    let storagePreviewLastText = "";
    let storagePreviewLastUiMs = 0;
    let lastSequenceStorageGuardLevel = "unknown";
    let lastThrustKgf = null;
    const THRUST_GAUGE_MAX_KGF = 10;
    const THRUST_GAUGE_MAX_LBF = 22;
    const PRESSURE_GAUGE_MAX_MPA = 10.0;
    const CAMERA_SPEED_GAUGE_MAX_MPS = 300;
    const CAMERA_G_FORCE_GAUGE_MAX = 16;
    const CAMERA_ALT_GAUGE_MAX_M = 1000;
    const SEA_LEVEL_PRESSURE_MPA = 0.1024; // 1024 hPa
    const PRESSURE_LEGACY_VOLT_FULL_SCALE = 3.3;
    const FLIGHT_PHASE_GRAVITY_MPS2 = 9.80665;
    const FLIGHT_PHASE_STABLE_SAMPLES = 3;
    const FLIGHT_PHASES = Object.freeze({
      PRE_FLIGHT: "PRE_FLIGHT",
      POWERED_FLIGHT: "POWERED_FLIGHT",
      COASTING: "COASTING",
      DESCENT: "DESCENT",
      LANDED: "LANDED"
    });
    const FLIGHT_PHASE_LABELS = Object.freeze({
      PRE_FLIGHT: "PRE_FLIGHT",
      POWERED_FLIGHT: "POWERED_FLIGHT",
      COASTING: "COASTING",
      DESCENT: "DESCENT",
      LANDED: "LANDED"
    });
    const FLIGHT_PHASE_STATUS = Object.freeze({
      PRE_FLIGHT: "warn",
      POWERED_FLIGHT: "bad",
      COASTING: "ok",
      DESCENT: "warn",
      LANDED: "ok"
    });
    const FLIGHT_PHASE_CODE_NAMES = Object.freeze([
      FLIGHT_PHASES.PRE_FLIGHT,
      FLIGHT_PHASES.POWERED_FLIGHT,
      FLIGHT_PHASES.COASTING,
      FLIGHT_PHASES.DESCENT,
      FLIGHT_PHASES.LANDED
    ]);
    const FLIGHT_TRANSITION_REASON_NAMES = Object.freeze([
      "NONE",
      "LAUNCH_ACCEL",
      "LAUNCH_BARO",
      "BURNOUT_ACCEL_FILTERED",
      "APOGEE_FAST_BARO",
      "LANDING_STABLE"
    ]);
    const quickFlightMetrics = {
      originGeoAlt: NaN,
      originPressureMpa: NaN,
      lastLat: NaN,
      lastLon: NaN,
      lastAlt: NaN,
      lastMs: 0,
      speedMps: NaN
    };
    const derivedFlightPhase = {
      phase: FLIGHT_PHASES.PRE_FLIGHT,
      candidate: "",
      candidateCount: 0,
      lastAltM: NaN,
      lastMs: 0,
      verticalSpeedMps: NaN
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
    const REBOOT_WAIT_AUTO_HIDE_MS = 5000;
    const REBOOT_RECOVERY_POLL_MS = 650;
    const REBOOT_RECOVERY_FIRST_PING_MS = 900;
    const REBOOT_RECOVERY_PING_TIMEOUT_MS = 800;
    const REBOOT_RECOVERY_HARD_RELOAD_MS = 10000;
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
    const GYRO_ZERO_SERIAL_REPLY_TIMEOUT_MS = 3200;
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
    const LOADCELL_CALIBRATION_SUPPORTED = true;
    const SERIAL_BAUD_RATE = 921600;
    const SERIAL_BAUD_CANDIDATES = [SERIAL_BAUD_RATE, 460800, 115200];
    const SERIAL_PROBE_TIMEOUT_MS = 2200;
    const SERIAL_PARSE_ERROR_LOG_LIMIT = 3;
    const SERIAL_LINK_STALE_MS = 6500;
    const SERVO_CHANNELS = [1, 2, 3, 4, 5];
    const PYRO_CHANNELS = [1, 2];
    // UI channel label -> board servo channel remap.
    const SERVO_UI_TO_HW_CHANNEL = [0, 1, 2, 3, 4, 5];
    const servoUiMap = {};
    let servoInfo = null;
    let servoInfoLastMs = 0;
    let servoInfoWarned = false;
    let serialCurrentBaud = SERIAL_BAUD_RATE;
    let serialParseErrorCount = 0;
    let serialAckWaiters = [];
    let serialConnectBusy = false;
    let serialStaleRecoveryBusy = false;
    let serialAutoReconnectTimer = null;
    let serialAutoReconnectAttempts = 0;
    let missionCanvasZoom = 1;
    let missionCanvasPanState = null;
    let missionDragAutoScrollRaf = 0;
    let missionDragAutoScrollStep = 0;
    function isIgniterCheckEnabled(){
      if(latestTelemetry && latestTelemetry.gs != null) return !!latestTelemetry.gs;
      return !!(uiSettings && uiSettings.igs);
    }
    const INSPECTION_STEPS = [
      {key:"link",    check:()=>simEnabled || connOk},
      {key:"serial",  check:()=>simEnabled || (!serialEnabled) || serialConnected},
      {key:"relay",   check:()=>!lockoutLatched},
    ];
    const INSPECTION_STEP_INFO = {
      link:{labelKey:"inspectionLabelLink", descKey:"inspectionDescLink"},
      serial:{label:"WebSerial", descKey:"inspectionDescSerial"},
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
    const homeGyroDockState = {
      homeParent: null,
      homeNextSibling: null,
      mountedToHome: false
    };
    const inspectionDialogDockState = {
      homeParent: null,
      homeNextSibling: null
    };
    const servoDialogDockState = {
      homeParent: null,
      homeNextSibling: null
    };
    const CONTROLS_MOBILE_CLASS = "controls-mobile-hidden";
    const MAX_VISIBLE_LOG = 500;
    const ENABLE_EASTER_TETRIS = false;
    let logoTapCount = 0;
    let logoTapTimer = null;
    let webcamStream = null;
    let webcamRequestGeneration = 0;
    let selectedWebcamDeviceId = "";
    const CAMERA_SIM_SOURCE_ID = "__flash6_sim__";
    let cameraSimSourceActive = true;

    // ✅ 연결 상태 안정화(히스테리시스) - CONNECT/DISCONNECT 깜빡임 방지
    let connOk = false;
    let lastOkMs = Date.now();          // 마지막 정상 샘플 수신 시각
    let failStreak = 0;                // 연속 실패 횟수
    let unstableToastShown = false;
    let flashLinkUiRole = "avionics";
    let flashLinkUiLinked = false;
    let flashLinkUiRemoteValid = false;
    let flashLinkUiRxHz = 0;
    let flashLinkUiLossPermille = 0;
    let flashLinkUiRssiDbm = NaN;
    let flashLinkUiRssiValid = false;
    let flashLinkUiPeer = "--";
    let flashLinkUiHasStatus = false;
    let flashLinkUiNodeId = 1;
    let flashLinkUiTargetNodeId = 1;
    let flashLinkUiStage2Mode = false;
    let flashLinkStage1Connected = false;
    let flashLinkStage2Connected = false;
    let flashLinkStage2Route = "relay";
    let flashLinkStage2DirectConnected = false;
    let flashLinkStage2RelayConnected = false;
    let flashLinkDisplayDataMode = null;
    let flashLinkGroundBlanked = false;
    const FLASH_LINK_CHART_WINDOW_MS = 30000;
    const FLASH_LINK_CHART_SAMPLE_MS = 200;
    const FLASH_LINK_CHART_MAX_POINTS = Math.ceil(FLASH_LINK_CHART_WINDOW_MS / FLASH_LINK_CHART_SAMPLE_MS) + 12;
    const FLASH_LINK_CHART_STORAGE_KEY = "flash6_flash_link_chart_metric";
    let flashLinkChartSamples = [];
    let flashLinkChartMetric = "rssi";
    const dashboardStageLinkChartSamples = {1:[], 2:[]};
    const dashboardStageLinkChartMetrics = {1:"rssi", 2:"rssi"};
    const dashboardStageLinkChartLastSampleMs = {1:0, 2:0};
    let dashboardSectionView = "telemetry";
    let flashLinkChartLastSampleMs = 0;
    let flashLinkChartRaf = 0;
    let flashLinkChartResizeObserver = null;
    let pendingOperationModeConfirm = null;
    let operationModeChangeBusy = false;
    let lastConfirmedOperationMode = null;
    const FLASH_LINK_REPORT_DURATION_MS = 60000;
    const FLASH_LINK_REPORT_COUNTDOWN_SEC = 3;
    const FLASH_LINK_REPORT_SAMPLE_MS = 200;
    const flashLinkReportState = {
      phase: "idle",
      introStep: 1,
      samples: [],
      startedAtMs: 0,
      endsAtMs: 0,
      countdownEndsAtMs: 0,
      timer: null,
      lastSampleMs: 0,
      lastExportName: ""
    };
    let currentDataOrigin = "local";
    let latestAvionicsStorageInfo = null;
    let latestAvionicsStorageOkMs = 0;

    const DISCONNECT_GRACE_MS = 5000;  // 이 시간 동안 샘플이 없으면 끊김 후보
    const FAIL_STREAK_LIMIT   = 20;    // 연속 실패가 이 이상이고, grace도 지났으면 DISCONNECTED
    function targetStreamHz(){ return flashLinkUiStage2Mode ? 50 : 100; }
    function rxHzWarnThreshold(){ return flashLinkUiStage2Mode ? 35 : 75; }
    function rxHzRecoverThreshold(){ return flashLinkUiStage2Mode ? 45 : 90; }
    const DATA_TIMEOUT_ALARM_MS = 4500;
    let lastWsQueueDropCount = 0;

    // ✅ 엔드포인트 “기억” (매번 3개 다 두드리지 않게)
    let preferredEndpoint = "/stream";
    const ENDPOINTS = ["/stream", "/data"];

    // ✅ WebSocket 스트림
    let wsSocket = null;
    let wsConnected = false;
    let wsRetryTimer = null;
    let wsRetryMs = 300;
    let wsLastMsgMs = 0;
    let wsConnectStartedMs = 0;
    let wsLastOpenAttemptMs = 0;
    const WS_FRESH_MS = 1800;
    const WS_RETRY_MAX_MS = 1600;
    const WS_CONNECT_TIMEOUT_MS = 2800;
    const BOARD_FALLBACK_HTTP = "http://192.168.4.1";
    const API_BASE_STORAGE_KEY = "flash6_api_base";
    let wsEverConnected = false;
    let wsBootOpenBeaconSent = false;
    let wsBootErrorBeaconSent = false;
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
    function normalizeApiBase(raw){
      let v = String(raw == null ? "" : raw).trim();
      if(!v) return "";
      if(/^wss?:\/\//i.test(v)){
        v = v.replace(/^wss?:\/\//i, (m)=> m.toLowerCase().startsWith("wss") ? "https://" : "http://");
      }else if(!/^https?:\/\//i.test(v)){
        if(v.startsWith("//")) v = "http:" + v;
        else v = "http://" + v;
      }
      v = v.replace(/\/+$/, "");
      return v;
    }
    function readApiBaseFromQuery(){
      try{
        const usp = new URLSearchParams(location.search || "");
        const raw = usp.get("api_base") || usp.get("api") || usp.get("board") || "";
        return normalizeApiBase(raw);
      }catch(_e){
        return "";
      }
    }
    function resolveStoredApiBase(){
      try{
        return normalizeApiBase(localStorage.getItem(API_BASE_STORAGE_KEY) || "");
      }catch(_e){
        return "";
      }
    }
    function isLoopbackHost(host){
      const h = String(host || "").toLowerCase();
      return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h.indexOf("vscode") >= 0;
    }
    function isNativeCapacitorPlatform(platformName){
      try{
        const cap = (typeof window !== "undefined") ? window.Capacitor : null;
        if(!cap) return false;
        if(typeof cap.getPlatform === "function"){
          return String(cap.getPlatform() || "").toLowerCase() === String(platformName || "").toLowerCase();
        }
      }catch(_e){}
      return false;
    }
    function getCapacitorHttpPlugin(){
      try{
        const cap = (typeof window !== "undefined") ? window.Capacitor : null;
        const plugins = cap && cap.Plugins ? cap.Plugins : null;
        return (plugins && plugins.CapacitorHttp) ||
          (typeof window !== "undefined" ? window.CapacitorHttp : null) ||
          null;
      }catch(_e){
        return null;
      }
    }
    function isPrivateBoardHost(host){
      const h = String(host || "").toLowerCase();
      if(!h) return false;
      if(h === "192.168.4.1" || h === "altis.local") return true;
      if(/^\d+\.\d+\.\d+\.\d+$/.test(h)){
        const parts = h.split(".").map((v)=>Number(v));
        if(parts.length === 4 && parts.every((v)=>isFinite(v) && v >= 0 && v <= 255)){
          if(parts[0] === 10) return true;
          if(parts[0] === 192 && parts[1] === 168) return true;
          if(parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
          if(parts[0] === 169 && parts[1] === 254) return true;
        }
      }
      return false;
    }
    function shouldUseNativeBoardHttp(url){
      if(!isNativeCapacitorPlatform("android")) return false;
      if(!getCapacitorHttpPlugin()) return false;
      try{
        const u = new URL(String(url || ""), location.origin || "http://localhost");
        if(u.protocol !== "http:" && u.protocol !== "https:") return false;
        return isPrivateBoardHost(u.hostname) && !isLoopbackHost(u.hostname);
      }catch(_e){
        return false;
      }
    }
    async function nativeBoardHttpGet(url, timeoutMs, responseType){
      const Http = getCapacitorHttpPlugin();
      if(!Http || typeof Http.get !== "function") throw new Error("CapacitorHttp unavailable");
      const requestUrl = new URL(String(url || ""), location.origin || "http://localhost").href;
      const waitMs = Math.max(400, Number(timeoutMs) || 1600);
      const response = await Http.get({
        url: requestUrl,
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        responseType: responseType || "json",
        connectTimeout: waitMs,
        readTimeout: waitMs,
        disableRedirects: true
      });
      const status = Number(response && response.status);
      if(!isFinite(status) || status < 200 || status >= 300){
        throw new Error("HTTP " + (isFinite(status) ? status : 0));
      }
      return response ? response.data : null;
    }
    function getApiBaseHost(base){
      try{
        const u = new URL(String(base || ""));
        return String(u.hostname || "").toLowerCase();
      }catch(_e){
        return "";
      }
    }
    function isUsableStoredApiBase(base){
      const norm = normalizeApiBase(base);
      if(!norm) return false;
      const host = getApiBaseHost(norm);
      if(!host) return false;
      if(isLoopbackHost(host)) return false;
      if(isPrivateBoardHost(host)) return true;
      // In local app host mode, avoid stale public/unknown hosts.
      if(isLocalPreviewHost()) return false;
      return true;
    }
    function resolveApiBaseOverride(){
      const fromQuery = readApiBaseFromQuery();
      if(fromQuery){
        try{ localStorage.setItem(API_BASE_STORAGE_KEY, fromQuery); }catch(_e){}
        return fromQuery;
      }
      if(isLocalPreviewHost()){
        const stored = resolveStoredApiBase();
        if(isUsableStoredApiBase(stored)) return stored;
        return "";
      }
      const host = String(location.hostname || "").toLowerCase();
      if(host === "192.168.4.1" || host === "altis.local") return "";
      return resolveStoredApiBase();
    }
    function autoApiBase(){
      if(isLocalPreviewHost()) return BOARD_FALLBACK_HTTP;
      const host = String(location.hostname || "").toLowerCase();
      if(!host) return BOARD_FALLBACK_HTTP;
      if(host === "192.168.4.1" || host === "altis.local") return "";
      if(host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return BOARD_FALLBACK_HTTP;
      return BOARD_FALLBACK_HTTP;
    }
    function saveApiBaseToStorage(base){
      const norm = normalizeApiBase(base);
      if(!norm) return;
      try{ localStorage.setItem(API_BASE_STORAGE_KEY, norm); }catch(_e){}
    }
    function baseKey(base){
      const norm = normalizeApiBase(base);
      return norm || "__same_origin__";
    }
    let API_BASE_OVERRIDE = resolveApiBaseOverride();
    if(typeof window !== "undefined"){
      window.__flashBoot = window.__flashBoot || {};
      window.__flashBoot.apiBase = API_BASE_OVERRIDE || autoApiBase() || "";
    }
    function setApiBaseOverride(nextBase, persist){
      const norm = normalizeApiBase(nextBase);
      API_BASE_OVERRIDE = norm;
      if(typeof window !== "undefined"){
        window.__flashBoot = window.__flashBoot || {};
        window.__flashBoot.apiBase = norm || autoApiBase() || "";
      }
      if(persist && norm){
        saveApiBaseToStorage(norm);
      }
    }
    function getApiBaseForCommands(){
      return API_BASE_OVERRIDE || autoApiBase();
    }
    function getApiBaseCandidates(){
      const out = [];
      const seen = new Set();
      const push = (raw)=>{
        const key = baseKey(raw);
        if(seen.has(key)) return;
        seen.add(key);
        out.push(normalizeApiBase(raw));
      };
      const current = getApiBaseForCommands();
      // In embedded/local host mode, prefer board AP fallback first.
      if(isLocalPreviewHost()){
        push(BOARD_FALLBACK_HTTP);
        push(current);
      }else{
        push(current);
        push(BOARD_FALLBACK_HTTP);
      }
      if(!isLocalPreviewHost()) push("");
      return out;
    }
    let suppressCountdownToastUntil = 0;
    let suppressIgnitionToastUntil = 0;
