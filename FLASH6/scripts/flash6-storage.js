/* FLASH6 application-data and avionics-storage runtime. */
    function formatDurationHms(totalSec){
      const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if(h > 0) return h + "h " + m + "m " + s + "s";
      if(m > 0) return m + "m " + s + "s";
      return s + "s";
    }
    function normalizeDataOrigin(data){
      const settingsMode = getSettingsOperationModeValue();
      const raw = String(
        data && (
          data.data_origin ??
          data.origin ??
          data.telemetry_origin ??
          ""
        ) || ""
      ).trim().toLowerCase();
      if(raw === "avionics" || raw === "remote" || raw === "1") return "avionics";
      const mode = normalizeOperationModeValue(
        data && (data.op_mode ?? data.operation_mode ?? settingsMode)
      );
      const linkMode = normalizeOperationModeValue(
        data && (
          data.link_mode ??
          data.transport_mode ??
          data.op_mode ??
          data.operation_mode ??
          settingsMode
        )
      );
      const role = normalizeFlashLinkRole(
        data && (
          data.flash_link_role ??
          data.fl_role ??
          (uiSettings && uiSettings.flashLinkRole)
        )
      );
      const remoteValidRaw = data && (
        data.fl_remote_valid ??
        data.flash_link_remote_valid
      );
      const remoteValid = remoteValidRaw == null
        ? !!flashLinkUiRemoteValid
        : Number(remoteValidRaw) !== 0;
      const linkedRaw = data && (data.fl_link ?? data.flash_link_connected);
      const linked = linkedRaw == null
        ? !!flashLinkUiLinked
        : Number(linkedRaw) !== 0;
      const linkActive = linkMode === "flash_link" || mode === "flash_link" || linked;
      if(linkActive && role === "avionics") return "avionics";
      if(linkActive && role === "ground" && remoteValid) return "avionics";
      if(raw === "local" || raw === "ground" || raw === "0") return "local";
      return "local";
    }

    function dataOriginLabel(origin){
      return String(origin || "").toLowerCase() === "avionics"
        ? "AVIONICS"
        : "LOCAL";
    }

    function getPreferredDataListOrigin(){
      const flashLinkActive = getSettingsOperationModeValue() === "flash_link";
      return flashLinkActive || String(currentDataOrigin || "").toLowerCase() === "avionics"
        ? "avionics"
        : "app";
    }

    function getDataListView(raw){
      return String(raw || "").toLowerCase() === "avionics" ? "avionics" : "app";
    }

    function openAppDataDb(){
      if(appDataDbPromise) return appDataDbPromise;
      appDataDbPromise = new Promise((resolve, reject)=>{
        if(typeof indexedDB === "undefined"){
          reject(new Error("INDEXED_DB_UNAVAILABLE"));
          return;
        }
        const request = indexedDB.open(APP_DATA_DB_NAME, APP_DATA_DB_VERSION);
        request.onupgradeneeded = ()=>{
          const db = request.result;
          if(!db.objectStoreNames.contains("sessions")){
            db.createObjectStore("sessions", {keyPath:"id"});
          }
          if(!db.objectStoreNames.contains("chunks")){
            const chunks = db.createObjectStore("chunks", {keyPath:"id"});
            chunks.createIndex("sessionId", "sessionId", {unique:false});
          }
        };
        request.onsuccess = ()=>resolve(request.result);
        request.onerror = ()=>reject(request.error || new Error("INDEXED_DB_OPEN_FAILED"));
      }).catch((err)=>{
        appDataDbPromise = null;
        throw err;
      });
      return appDataDbPromise;
    }

    function appDataRequest(request){
      return new Promise((resolve, reject)=>{
        request.onsuccess = ()=>resolve(request.result);
        request.onerror = ()=>reject(request.error || new Error("INDEXED_DB_REQUEST_FAILED"));
      });
    }

    async function appDataPut(storeName, value){
      const db = await openAppDataDb();
      const tx = db.transaction(storeName, "readwrite");
      const result = await appDataRequest(tx.objectStore(storeName).put(value));
      await new Promise((resolve, reject)=>{
        tx.oncomplete = ()=>resolve();
        tx.onerror = ()=>reject(tx.error || new Error("INDEXED_DB_TRANSACTION_FAILED"));
        tx.onabort = ()=>reject(tx.error || new Error("INDEXED_DB_TRANSACTION_ABORTED"));
      });
      return result;
    }

    async function appDataGetAll(storeName){
      const db = await openAppDataDb();
      const tx = db.transaction(storeName, "readonly");
      return await appDataRequest(tx.objectStore(storeName).getAll());
    }

    async function appDataGetSessionChunks(sessionId){
      const db = await openAppDataDb();
      const tx = db.transaction("chunks", "readonly");
      const index = tx.objectStore("chunks").index("sessionId");
      return await appDataRequest(index.getAll(IDBKeyRange.only(sessionId)));
    }

    function makeAppDataSession(origin, transport, nowMs){
      const id = "APP_" + String(nowMs) + "_" +
        Math.random().toString(36).slice(2, 8).toUpperCase();
      return {
        id,
        kind:"app",
        origin,
        transport:String(transport || "UNKNOWN").toUpperCase(),
        startedAt:nowMs,
        endedAt:nowMs,
        sampleCount:0,
        chunkCount:0,
        bytes:0,
        recordBytes:REPLAY_BIN_APP_RECORD_V6_BYTES,
        recordVersion:6,
        format:"HWLOGV2",
        protocolVersion:REPLAY_PROTOCOL_COMPATIBLE_MAX,
        missionTimebaseVersion:1,
        metadataFlags:1,
        firmwareBuildNumber:37,
        samplePeriodMs:0,
        lastReceivedAt:0
      };
    }

    function compactAppDataSample(data, transport, origin, receivedAt){
      const numberOrNull = (value)=>{
        const n = Number(value);
        return isFinite(n) ? n : null;
      };
      let actualSpeedMps = readTelemetryActualSpeedMps(data);
      if(!isFinite(actualSpeedMps) && gyroPathState && gyroPathState.fusionReady){
        actualSpeedMps = Math.hypot(
          Number(gyroPathState.fusionVelX),
          Number(gyroPathState.fusionVelY),
          Number(gyroPathState.fusionVelZ)
        );
      }
      return {
        received_at:receivedAt,
        origin,
        transport:String(transport || "UNKNOWN").toUpperCase(),
        seq:numberOrNull(data && data.seq),
        ut:numberOrNull(data && (data.ut ?? data.uptime_ms)),
        t:numberOrNull(data && (data.t ?? data.thrust)),
        p:numberOrNull(data && data.p),
        alt_m:numberOrNull(data && (data.alt_m ?? data.altitude_m)),
        ax:numberOrNull(data && data.ax),
        ay:numberOrNull(data && data.ay),
        az:numberOrNull(data && data.az),
        gx:numberOrNull(data && data.gx),
        gy:numberOrNull(data && data.gy),
        gz:numberOrNull(data && data.gz),
        roll:numberOrNull(data && data.gr),
        pitch:numberOrNull(data && data.gp),
        yaw:numberOrNull(data && data.gyw),
        ga:numberOrNull(data && data.ga),
        lt:numberOrNull(data && data.lt),
        ct:numberOrNull(data && data.ct),
        st:numberOrNull(data && data.st),
        td:numberOrNull(data && data.td),
        flight_phase:data && data.flight_phase ? String(data.flight_phase) : null,
        flight_phase_code:numberOrNull(data && data.flight_phase_code),
        speed_mps:isFinite(actualSpeedMps) ? Math.max(0, actualSpeedMps) : null,
        vertical_speed_mps:numberOrNull(data && (data.vertical_speed_mps ?? data.verticalSpeedMps)),
        relay:numberOrNull(data && data.r),
        safety:numberOrNull(data && data.sm),
        arm:numberOrNull(data && data.s),
        arm_physical:numberOrNull(data && (data.sp ?? data.arm_physical)),
        user_wait:numberOrNull(data && data.uw),
        abort:numberOrNull(data && data.ab),
        abort_reason:numberOrNull(data && data.ar),
        mode:numberOrNull(data && (data.m ?? data.opm)),
        serial_stream:numberOrNull(data && data.ss),
        baro_valid:numberOrNull(data && data.bo),
        hx_hz:numberOrNull(data && (data.hx_hz ?? data.hz)),
        lc_raw:numberOrNull(data && data.lc_raw),
        lc_raw_ok:numberOrNull(data && data.lc_raw_ok),
        lc_ready:numberOrNull(data && data.lc_ready),
        lc_sat:numberOrNull(data && data.lc_sat),
        lc_offset_ok:numberOrNull(data && data.lc_offset_ok),
        gps_lat:numberOrNull(data && (data.gps_lat ?? data.gpsLat ?? data.lat)),
        gps_lon:numberOrNull(data && (data.gps_lon ?? data.gps_lng ?? data.gpsLon ?? data.gpsLng ?? data.lon ?? data.lng)),
        gps_alt:numberOrNull(data && (data.gps_alt ?? data.gpsAlt ?? data.alt)),
        gps_age_ms:numberOrNull(data && (data.gps_age_ms ?? data.gpsAgeMs)),
        gps_fix:numberOrNull(data && (data.gps_fix ?? data.gpsFix ?? data.fix)),
        gps_seen:numberOrNull(data && (data.gps_seen ?? data.gpsSeen)),
        gps_ready:numberOrNull(data && (data.gps_ready ?? data.gpsReady)),
        gps_time_valid:numberOrNull(data && (data.gps_time_valid ?? data.gpsTimeValid)),
        fl_link:numberOrNull(data && (data.fl_link ?? data.flash_link_connected)),
        fl_remote_valid:numberOrNull(data && (data.fl_remote_valid ?? data.flash_link_remote_valid)),
        fl_rx_hz:numberOrNull(data && (data.fl_rx_hz ?? data.flash_link_rx_hz)),
        fl_loss_permille:numberOrNull(data && (data.fl_loss_permille ?? data.flash_link_loss_permille)),
        fl_rssi_dbm:numberOrNull(data && (data.fl_rssi_dbm ?? data.flash_link_rssi_dbm)),
        fl_rssi_age_ms:numberOrNull(data && (data.fl_rssi_age_ms ?? data.flash_link_rssi_age_ms)),
        fl_stage1:numberOrNull(data && (data.fl_stage1 ?? data.flash_link_stage1_connected)),
        fl_stage2:numberOrNull(data && (data.fl_stage2 ?? data.flash_link_stage2_connected)),
        fl_role_code:numberOrNull(data && data.fl_role_code)
      };
    }

    function clampInt(value, lo, hi, scale){
      const n = Number(value);
      if(!isFinite(n)) return 0;
      return Math.max(lo, Math.min(hi, Math.round(n * scale)));
    }

    function buildAppDataRecordV6(sample, sequence){
      const record = new Uint8Array(REPLAY_BIN_APP_RECORD_V6_BYTES);
      const dv = new DataView(record.buffer);
      const payloadOffset = 16;
      const p = Number(sample && sample.p);
      const alt = Number(sample && sample.alt_m);
      const thrust = Number(sample && sample.t);
      const hxHz = Number(sample && (sample.hx_hz ?? sample.hz));
      const lcRaw = Number(sample && sample.lc_raw);
      const timestamp = Number(sample && sample.ut);
      const receivedAt = Number(sample && sample.received_at);
      const loopMs = Number(sample && sample.lt);
      const cpuUs = Number(sample && sample.ct);
      const gpsLat = Number(sample && sample.gps_lat);
      const gpsLon = Number(sample && sample.gps_lon);
      const gpsAlt = Number(sample && sample.gps_alt);
      const gpsAgeMs = Number(sample && sample.gps_age_ms);
      const gpsFix = Number(sample && sample.gps_fix);
      const gpsSeen = Number(sample && sample.gps_seen);
      const gpsReady = Number(sample && sample.gps_ready);
      const gpsTimeValid = Number(sample && sample.gps_time_valid);
      const hasGpsLatLon = isFinite(gpsLat) && isFinite(gpsLon);

      dv.setUint16(0, REPLAY_BIN_RECORD_MARKER, true);
      dv.setUint8(2, 6);
      dv.setUint8(3, 1);
      dv.setUint16(4, REPLAY_BIN_SAMPLE_APP_V6_PAYLOAD_BYTES, true);
      dv.setUint16(6, 0, true);
      dv.setUint32(
        8,
        (isFinite(timestamp) && timestamp >= 0
          ? timestamp
          : (isFinite(receivedAt) ? receivedAt : Date.now())) >>> 0,
        true
      );
      dv.setUint32(12, Math.max(1, Number(sequence) || 1) >>> 0, true);

      dv.setFloat32(payloadOffset + 0, isFinite(p) ? p : 0, true);
      dv.setFloat32(payloadOffset + 4, isFinite(alt) ? alt : 0, true);
      dv.setInt16(payloadOffset + 8, clampInt(sample && sample.ax, -32767, 32767, 1000), true);
      dv.setInt16(payloadOffset + 10, clampInt(sample && sample.ay, -32767, 32767, 1000), true);
      dv.setInt16(payloadOffset + 12, clampInt(sample && sample.az, -32767, 32767, 1000), true);
      dv.setInt16(payloadOffset + 14, clampInt(sample && sample.gx, -32767, 32767, 10), true);
      dv.setInt16(payloadOffset + 16, clampInt(sample && sample.gy, -32767, 32767, 10), true);
      dv.setInt16(payloadOffset + 18, clampInt(sample && sample.gz, -32767, 32767, 10), true);
      dv.setInt16(payloadOffset + 20, clampInt(sample && sample.roll, -32767, 32767, 100), true);
      dv.setInt16(payloadOffset + 22, clampInt(sample && sample.pitch, -32767, 32767, 100), true);
      dv.setInt16(payloadOffset + 24, clampInt(sample && sample.yaw, -32767, 32767, 100), true);
      dv.setInt32(payloadOffset + 26, isFinite(Number(sample && sample.td)) ? Math.round(Number(sample.td)) : 0, true);
      dv.setUint16(
        payloadOffset + 30,
        isFinite(loopMs) && loopMs > 0
          ? Math.max(1, Math.min(65535, Math.round(loopMs * 1000)))
          : 10000,
        true
      );
      dv.setUint16(
        payloadOffset + 32,
        isFinite(cpuUs) ? Math.max(0, Math.min(65535, Math.round(cpuUs))) : 0,
        true
      );

      let flags = 0;
      if((sample && sample.baro_valid) || (isFinite(p) && p > 0)) flags |= 1 << 0;
      if((sample && sample.ga) || isFinite(Number(sample && sample.roll))) flags |= 1 << 1;
      if(Number(sample && sample.arm)) flags |= 1 << 2;
      if(Number(sample && sample.arm_physical)) flags |= 1 << 13;
      const deploymentState = Math.max(0, Math.min(7, Math.round(Number(sample && sample.deployment_state) || 0)));
      if(deploymentState & 0x01) flags |= 1 << 11;
      if(deploymentState & 0x02) flags |= 1 << 12;
      if(deploymentState & 0x04) flags |= 1 << 14;
      if(Number(sample && sample.user_wait)) flags |= 1 << 3;
      if(Number(sample && sample.abort)) flags |= 1 << 4;
      if(Number(sample && sample.safety)) flags |= 1 << 5;
      if(Number(sample && sample.serial_stream)) flags |= 1 << 6;
      flags |= 1 << 7;
      const storedFlightPhaseName = String((sample && sample.flight_phase) || "").toUpperCase();
      const rawStoredFlightPhaseCode = sample ? sample.flight_phase_code : null;
      const storedFlightPhaseCode = rawStoredFlightPhaseCode != null && Number.isInteger(Number(rawStoredFlightPhaseCode))
        ? Number(rawStoredFlightPhaseCode)
        : FLIGHT_PHASE_CODE_NAMES.indexOf(storedFlightPhaseName);
      if(storedFlightPhaseCode >= 0 && storedFlightPhaseCode < FLIGHT_PHASE_CODE_NAMES.length){
        flags |= (storedFlightPhaseCode & 0x07) << 8;
        flags |= 1 << 15;
      }
      dv.setUint16(payloadOffset + 34, flags, true);
      dv.setUint8(payloadOffset + 36, Math.max(0, Math.min(255, Number(sample && sample.st) || 0)));
      dv.setUint8(payloadOffset + 37, Math.max(0, Math.min(255, Number(sample && sample.relay) || 0)));
      dv.setUint8(payloadOffset + 38, Math.max(0, Math.min(255, Number(sample && sample.abort_reason) || 0)));
      dv.setUint8(payloadOffset + 39, Math.max(0, Math.min(255, Number(sample && sample.mode) || 0)));
      dv.setInt32(
        payloadOffset + 40,
        isFinite(thrust)
          ? Math.max(-2147483647, Math.min(2147483647, Math.round(thrust * 1000)))
          : -2147483648,
        true
      );
      dv.setInt32(payloadOffset + 44, isFinite(lcRaw) ? Math.round(lcRaw) : 0, true);
      dv.setUint16(payloadOffset + 48, isFinite(hxHz) ? Math.max(0, Math.min(65535, Math.round(hxHz))) : 0, true);
      let lcFlags = 0;
      if(Number(sample && sample.lc_ready)) lcFlags |= 1 << 0;
      if(Number(sample && sample.lc_raw_ok)) lcFlags |= 1 << 1;
      if(Number(sample && sample.lc_sat)) lcFlags |= 1 << 2;
      if(Number(sample && sample.lc_offset_ok)) lcFlags |= 1 << 3;
      dv.setUint16(payloadOffset + 50, lcFlags, true);
      dv.setInt32(
        payloadOffset + 52,
        hasGpsLatLon ? Math.max(-900000000, Math.min(900000000, Math.round(gpsLat * 10000000))) : -2147483648,
        true
      );
      dv.setInt32(
        payloadOffset + 56,
        hasGpsLatLon ? Math.max(-1800000000, Math.min(1800000000, Math.round(gpsLon * 10000000))) : -2147483648,
        true
      );
      dv.setInt32(
        payloadOffset + 60,
        isFinite(gpsAlt) ? Math.max(-2147483647, Math.min(2147483647, Math.round(gpsAlt * 100))) : -2147483648,
        true
      );
      dv.setUint16(payloadOffset + 64, isFinite(gpsAgeMs) ? Math.max(0, Math.min(65535, Math.round(gpsAgeMs))) : 65535, true);
      let gpsFlags = 0;
      if((isFinite(gpsFix) ? gpsFix !== 0 : hasGpsLatLon)) gpsFlags |= 1 << 0;
      if((isFinite(gpsSeen) ? gpsSeen !== 0 : hasGpsLatLon)) gpsFlags |= 1 << 1;
      if((isFinite(gpsReady) ? gpsReady !== 0 : hasGpsLatLon)) gpsFlags |= 1 << 2;
      if(isFinite(gpsTimeValid) && gpsTimeValid !== 0) gpsFlags |= 1 << 3;
      dv.setUint16(payloadOffset + 66, gpsFlags, true);

      const rawLinkRxHz = sample && sample.fl_rx_hz;
      const rawLinkLossPermille = sample && sample.fl_loss_permille;
      const rawLinkRssiDbm = sample && sample.fl_rssi_dbm;
      const rawLinkRssiAgeMs = sample && sample.fl_rssi_age_ms;
      const linkRxHz = Number(rawLinkRxHz);
      const linkLossPermille = Number(rawLinkLossPermille);
      const linkRssiDbm = Number(rawLinkRssiDbm);
      const linkRssiAgeMs = Number(rawLinkRssiAgeMs);
      const linkRxValid = rawLinkRxHz != null && isFinite(linkRxHz);
      const linkLossValid = rawLinkLossPermille != null && isFinite(linkLossPermille);
      const linkRssiValid = rawLinkRssiDbm != null && isFinite(linkRssiDbm) && linkRssiDbm > -127;
      const linkRssiAgeValid = rawLinkRssiAgeMs != null && isFinite(linkRssiAgeMs);
      dv.setUint16(
        payloadOffset + 68,
        linkRxValid
          ? Math.max(0, Math.min(65535, Math.round(linkRxHz * 10)))
          : 0,
        true
      );
      dv.setUint16(
        payloadOffset + 70,
        linkLossValid
          ? Math.max(0, Math.min(65535, Math.round(linkLossPermille)))
          : 0,
        true
      );
      dv.setInt16(
        payloadOffset + 72,
        linkRssiValid
          ? Math.max(-32767, Math.min(32767, Math.round(linkRssiDbm * 10)))
          : -32768,
        true
      );
      dv.setUint16(
        payloadOffset + 74,
        linkRssiAgeValid
          ? Math.max(0, Math.min(65534, Math.round(linkRssiAgeMs)))
          : 0xFFFF,
        true
      );
      let linkFlags = 0;
      if(Number(sample && sample.fl_link)) linkFlags |= 1 << 0;
      if(Number(sample && sample.fl_remote_valid)) linkFlags |= 1 << 1;
      if(Number(sample && sample.fl_stage1)) linkFlags |= 1 << 2;
      if(Number(sample && sample.fl_stage2)) linkFlags |= 1 << 3;
      if(Number(sample && sample.fl_role_code)) linkFlags |= 1 << 4;
      if(linkRssiValid) linkFlags |= 1 << 5;
      if(linkRxValid) linkFlags |= 1 << 6;
      if(linkLossValid) linkFlags |= 1 << 7;
      dv.setUint16(payloadOffset + 76, linkFlags, true);
      const actualSpeedMps = Number(sample && sample.speed_mps);
      const encodedActualSpeed = isFinite(actualSpeedMps)
        ? Math.max(0, Math.min(0x7FFE, Math.round(actualSpeedMps * 10)))
        : null;
      dv.setUint16(
        payloadOffset + 78,
        encodedActualSpeed == null ? 0 : (0x8000 | encodedActualSpeed),
        true
      );

      dv.setUint16(
        6,
        replayCrc16Ccitt(
          new DataView(record.buffer, payloadOffset, REPLAY_BIN_SAMPLE_APP_V6_PAYLOAD_BYTES),
          0,
          REPLAY_BIN_SAMPLE_APP_V6_PAYLOAD_BYTES
        ),
        true
      );
      return record;
    }

    function encodeAppDataSamples(samples, firstSequence){
      const list = Array.isArray(samples) ? samples : [];
      const records = new Uint8Array(list.length * REPLAY_BIN_APP_RECORD_V6_BYTES);
      list.forEach((sample, index)=>{
        records.set(
          buildAppDataRecordV6(sample, Number(firstSequence || 1) + index),
          index * REPLAY_BIN_APP_RECORD_V6_BYTES
        );
      });
      return records;
    }

    function flushAppDataSamples(){
      if(!appDataSession || !appDataPendingSamples.length) return appDataFlushPromise;
      const session = Object.assign({}, appDataSession);
      const samples = appDataPendingSamples.splice(0, appDataPendingSamples.length);
      const chunkIndex = session.chunkCount;
      const firstSequence = session.sampleCount + 1;
      const records = encodeAppDataSamples(samples, firstSequence);
      session.chunkCount += 1;
      session.sampleCount += samples.length;
      session.endedAt = samples[samples.length - 1].received_at;
      session.bytes += records.byteLength;
      appDataSession = session;
      appDataFlushPromise = appDataFlushPromise.then(async()=>{
        await appDataPut("chunks", {
          id:session.id + ":" + String(chunkIndex).padStart(8, "0"),
          sessionId:session.id,
          index:chunkIndex,
          format:"HWLOGV2_RECORD_V6",
          recordCount:samples.length,
          firstSequence,
          data:records.buffer
        });
        await appDataPut("sessions", session);
      }).catch((err)=>{
        reportSilentException("app-data-save", err);
      });
      return appDataFlushPromise;
    }

    function finalizeAppDataSession(){
      flushAppDataSamples();
      appDataSession = null;
      appDataLastStoredAtMs = 0;
    }

    function recordIncomingSampleToApp(data, transport, isReplaySample){
      if(isReplaySample || simEnabled || !data || !flightDataLoggingEnabled) return;
      const nowMs = Date.now();
      const origin = normalizeDataOrigin(data);
      if(
        !appDataSession ||
        appDataSession.origin !== origin ||
        (appDataLastStoredAtMs > 0 &&
         (nowMs - appDataLastStoredAtMs) > APP_DATA_SESSION_GAP_MS)
      ){
        finalizeAppDataSession();
        appDataSession = makeAppDataSession(origin, transport, nowMs);
      }
      if(
        appDataSession.lastReceivedAt > 0 &&
        nowMs > appDataSession.lastReceivedAt
      ){
        const deltaMs = nowMs - appDataSession.lastReceivedAt;
        appDataSession.samplePeriodMs = appDataSession.samplePeriodMs > 0
          ? ((appDataSession.samplePeriodMs * 0.9) + (deltaMs * 0.1))
          : deltaMs;
      }
      appDataSession.lastReceivedAt = nowMs;
      appDataLastStoredAtMs = nowMs;
      appDataPendingSamples.push(
        compactAppDataSample(data, transport, origin, nowMs)
      );
      if(appDataPendingSamples.length >= APP_DATA_CHUNK_SAMPLES){
        flushAppDataSamples();
      }
    }

    async function listAppDataSessions(){
      try{
        const sessions = await appDataGetAll("sessions");
        return (Array.isArray(sessions) ? sessions : [])
          .filter((item)=>item && item.id)
          .sort((a, b)=>Number(b.startedAt || 0) - Number(a.startedAt || 0));
      }catch(err){
        reportSilentException("app-data-list", err);
        return [];
      }
    }

    async function buildAppDataSessionFile(session){
      await flushAppDataSamples();
      const chunks = await appDataGetSessionChunks(session.id);
      chunks.sort((a, b)=>Number(a.index || 0) - Number(b.index || 0));
      const recordParts = [];
      let recordCount = 0;
      let nextSequence = 1;
      chunks.forEach((chunk)=>{
        if(chunk && chunk.data instanceof ArrayBuffer){
          const bytes = new Uint8Array(chunk.data);
          if(bytes.byteLength > 0){
            recordParts.push(bytes);
            const recordBytes = Math.max(1, Number(session.recordBytes || REPLAY_BIN_APP_RECORD_V4_BYTES));
            const count = Math.max(
              0,
              Number(chunk.recordCount || 0) || Math.floor(bytes.byteLength / recordBytes)
            );
            recordCount += count;
            nextSequence += count;
          }
          return;
        }
        if(chunk && Array.isArray(chunk.samples)){
          const records = encodeAppDataSamples(chunk.samples, nextSequence);
          if(records.byteLength > 0){
            recordParts.push(records);
            recordCount += chunk.samples.length;
            nextSequence += chunk.samples.length;
          }
        }
      });
      if(!recordParts.length || recordCount <= 0) throw new Error("APP_DATA_EMPTY");
      const dataBytes = recordParts.reduce((sum, part)=>sum + part.byteLength, 0);
      const header = buildSpiFlashBinHeader({
        used_bytes:dataBytes,
        record_count:recordCount,
        sample_period_ms:
          Number(session.samplePeriodMs) > 0
            ? Math.max(1, Math.round(Number(session.samplePeriodMs)))
            : Math.max(
                1,
                Math.round(
                  (Number(session.endedAt || 0) - Number(session.startedAt || 0)) /
                  Math.max(1, recordCount - 1)
                )
              ),
        data_origin_code:String(session.origin || "").toLowerCase() === "avionics" ? 1 : 0,
        app_source_tag:REPLAY_BIN_APP_SOURCE_TAG,
        protocol:Math.max(0, Number(session.protocolVersion || 0)),
        timebase:Math.max(0, Number(session.missionTimebaseVersion || 0)),
        meta:Math.max(0, Number(session.metadataFlags || 0)),
        build:Math.max(0, Number(session.firmwareBuildNumber || 0))
      });
      const started = new Date(Number(session.startedAt || Date.now()));
      const stamp = started.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
      const filename =
        "ALTIS_APP_" + dataOriginLabel(session.origin) + "_" + stamp + ".bin";
      return new File([header, ...recordParts], filename, {type:"application/octet-stream"});
    }

    async function downloadAppDataSession(session){
      const file = await buildAppDataSessionFile(session);
      downloadBlobAsFile(file, file.name);
    }

    function estimateSpiFlashRemainingSec(info){
      const usedBytes = Number(info && info.used_bytes || 0);
      const capBytes = Number(info && info.capacity_bytes || 0);
      const queuedBytes = Number(info && info.queue_bytes || 0);
      const recordCount = Number(info && info.record_count || 0);
      const recordHz = Math.max(1, Number(info && info.record_hz || 200));

      const remainingBytes = Math.max(0, capBytes - usedBytes - queuedBytes);
      const fallbackBytesPerRecord = Math.max(1, Number(info && info.current_record_bytes || 56));
      const bytesPerRecord = (recordCount > 0 && usedBytes > 0)
        ? Math.max(1, usedBytes / recordCount)
        : fallbackBytesPerRecord;
      const remainRecords = remainingBytes / bytesPerRecord;
      const remainSec = remainRecords / recordHz;
      return Math.max(0, Math.floor(remainSec));
    }

    function getSpiFlashUsedPercent(info){
      const target = info || latestSpiFlashStorageInfo;
      if(!target || !target.ready) return NaN;
      const reported = Number(target.used_percent);
      if(isFinite(reported)) return Math.max(0, Math.min(100, reported));
      const usedBytes = Number(target.used_bytes || 0);
      const capBytes = Number(target.capacity_bytes || 0);
      return capBytes > 0 ? Math.max(0, Math.min(100, (usedBytes / capBytes) * 100)) : NaN;
    }

    function isFlashLinkGroundStorageUi(){
      return getSettingsOperationModeValue() === "flash_link" &&
        normalizeFlashLinkRole(uiSettings && uiSettings.flashLinkRole) === "ground";
    }

    function getSpiFlashResetTarget(opts){
      const origin = String(opts && opts.origin || "").toLowerCase();
      const remote =
        isFlashLinkGroundStorageUi() &&
        (origin === "avionics" || (!origin && !simEnabled));
      const avionics = remote || origin === "avionics";
      const requestedStage = normalizeStorageStageNode(opts && opts.stageNode);
      const activeStage = normalizeStorageStageNode(
        typeof flashLinkTargetNodeId !== "undefined" ? flashLinkTargetNodeId : 0
      );
      const stageNode = remote ? (requestedStage || activeStage || 1) : 0;
      const stageLabel = stageNode ? (" STAGE " + stageNode) : "";
      return {
        remote,
        stageNode,
        origin: avionics ? "avionics" : "local",
        label: avionics ? ("에비오닉스" + stageLabel + " 저장공간") : "수신기 저장공간",
        statusLabel: avionics ? ("에비오닉스" + stageLabel + " 저장공간") : "SPI Flash 저장소"
      };
    }

    function getActiveStoragePreviewInfo(){
      if(simEnabled){
        return {
          ready:true,
          used_bytes:0,
          capacity_bytes:1,
          used_percent:0
        };
      }
      // The ground status bar represents the primary (stage 1) avionics.
      // Previously this used whichever remote board replied last, so a stage
      // 2 refresh could make the percentage jump or disappear.
      return isFlashLinkGroundStorageUi()
        ? (latestAvionicsStorageByStage[1] || latestAvionicsStorageInfo || latestSpiFlashStorageInfo)
        : latestSpiFlashStorageInfo;
    }

    function syncStoragePreview(text, force){
      const targets = [el.mobilePreviewFlash, el.storageStatusPill].filter(Boolean);
      if(!targets.length) return;
      const setText = (nextText)=>{
        targets.forEach((target)=>{ target.textContent = nextText; });
      };
      const nowMs = Date.now();
      if(text != null){
        const nextText = text || "--";
        const canUpdate =
          force ||
          nextText !== storagePreviewLastText ||
          (nowMs - storagePreviewLastUiMs) >= 500 ||
          targets.some((target)=>!target.textContent.trim());
        if(canUpdate && (nextText !== "--" || force || targets.some((target)=>!target.textContent.trim()))){
          setText(nextText);
          storagePreviewLastText = nextText;
          storagePreviewLastUiMs = nowMs;
        }
        return;
      }
      const pct = getSpiFlashUsedPercent(getActiveStoragePreviewInfo());
      const pctText = isFinite(pct) ? (pct.toFixed(1) + "%") : "--";
      const canUpdate =
        force ||
        pctText !== storagePreviewLastText ||
        (nowMs - storagePreviewLastUiMs) >= 500 ||
        targets.some((target)=>!target.textContent.trim());
      if(canUpdate && (pctText !== "--" || force || targets.some((target)=>!target.textContent.trim()))){
        setText(pctText);
        storagePreviewLastText = pctText;
        storagePreviewLastUiMs = nowMs;
      }
    }

    function syncFlightDataLoggingUi(){
      const stageSummary = getFlightDataLoggingStageSummary();
      const partial = stageSummary.known.length > 0 &&
        stageSummary.enabled.length > 0 &&
        stageSummary.disabled.length > 0;
      const controls = [
        [el.flightLoggingBtn, el.flightLoggingStatus],
        [el.mobileFlightLoggingBtn, el.mobileFlightLoggingStatus]
      ];
      controls.forEach(([button, status])=>{
        if(button){
          button.classList.toggle("is-recording", flightDataLoggingEnabled);
          button.classList.toggle("is-pending", flightDataLoggingPending);
          button.setAttribute("aria-pressed", flightDataLoggingEnabled ? "true" : "false");
          button.disabled = !!flightDataLoggingPending;
        }
        if(status){
          status.textContent = flightDataLoggingPending
            ? "확인 중"
            : (partial ? "부분 ON" : (flightDataLoggingEnabled ? "ON" : "OFF"));
          status.classList.remove("pill-gray", "pill-green", "pill-blue");
          status.classList.add(
            flightDataLoggingPending
              ? "pill-blue"
              : (flightDataLoggingEnabled ? "pill-green" : "pill-gray")
          );
        }
      });
    }

    function updateFlightDataLoggingStageTelemetry(stageId, raw){
      const id = Number(stageId) === 2 ? 2 : (Number(stageId) === 1 ? 1 : 0);
      if(!id || raw == null || raw === "" || !isFinite(Number(raw))) return;
      flightDataLoggingByStage[id] = Number(raw) !== 0;
    }

    function getFlightDataLoggingRequiredStages(){
      if(simEnabled) return [1];
      const ground = isFlashLinkGroundStorageUi();
      const configuredDual = !!(
        flashLinkUiStage2Mode ||
        (uiSettings && uiSettings.flashLinkStage2Mode)
      );
      const configuredNode = Number(
        flashLinkUiNodeId || (uiSettings && uiSettings.flashLinkNodeId) || 1
      ) === 2 ? 2 : 1;
      return ground ? (configuredDual ? [1, 2] : [1]) : [configuredNode];
    }

    function getFlightDataLoggingStageSummary(expected){
      const required = getFlightDataLoggingRequiredStages();
      const known = [];
      const unknown = [];
      const enabled = [];
      const disabled = [];
      required.forEach((stageId)=>{
        let value = flightDataLoggingByStage[stageId];
        // A directly connected avionics frame can omit its node id. Only a
        // single-board, non-ground session may use the legacy global value.
        if(
          value == null &&
          required.length === 1 &&
          !isFlashLinkGroundStorageUi() &&
          flightDataLoggingKnown
        ) value = flightDataLoggingEnabled;
        if(value == null){
          unknown.push(stageId);
          return;
        }
        known.push(stageId);
        (value ? enabled : disabled).push(stageId);
      });
      const matchesExpected = expected == null
        ? false
        : unknown.length === 0 && required.every((stageId)=>
            flightDataLoggingByStage[stageId] === !!expected ||
            (!isFlashLinkGroundStorageUi() && required.length === 1 &&
              flightDataLoggingByStage[stageId] == null &&
              flightDataLoggingKnown && flightDataLoggingEnabled === !!expected)
          );
      return {required, known, unknown, enabled, disabled, matchesExpected};
    }

    function commitFlightDataLoggingState(enabled){
      const changed = !!enabled !== flightDataLoggingEnabled;
      flightDataLoggingKnown = true;
      flightDataLoggingPending = false;
      flightDataLoggingDesired = null;
      flightDataLoggingEnabled = !!enabled;
      if(changed && !enabled) finalizeAppDataSession();
      syncFlightDataLoggingUi();
    }

    function syncFlightDataLoggingAggregate(){
      const summary = getFlightDataLoggingStageSummary();
      if(summary.unknown.length) return false;
      const enabled = summary.enabled.length === summary.required.length;
      if(flightDataLoggingPending && flightDataLoggingDesired != null){
        if(!summary.matchesExpected) return false;
        commitFlightDataLoggingState(flightDataLoggingDesired);
        return true;
      }
      commitFlightDataLoggingState(enabled);
      return true;
    }

    function applyFlightDataLoggingTelemetry(data, stageId){
      if(!data) return;
      const raw = data.storage_logging != null ? data.storage_logging : data.sl;
      if(raw == null || raw === "" || !isFinite(Number(raw))) return;
      const resolvedStageId = normalizeStorageStageNode(
        stageId != null ? stageId : (data.stage_node_id ?? data.stage_node ?? data.flash_link_node_id)
      );
      // In ground mode the top-level storage flag belongs to the ground board,
      // not to either avionics node. Accept only stage-tagged relay telemetry or
      // explicit remote storage status so it cannot overwrite the stage result.
      if(isFlashLinkGroundStorageUi() && !resolvedStageId) return;
      updateFlightDataLoggingStageTelemetry(resolvedStageId, raw);
      const enabled = Number(raw) !== 0;
      if(resolvedStageId){
        syncFlightDataLoggingAggregate();
        return;
      }
      if(
        flightDataLoggingPending &&
        flightDataLoggingDesired != null &&
        enabled !== flightDataLoggingDesired
      ) return;
      commitFlightDataLoggingState(enabled);
    }

    function getFlightLoggingGuardStatus(){
      if(simEnabled){
        return {ready:true, required:[1], missing:[], unknown:[], dual:false};
      }
      const configuredDual = !!(
        flashLinkUiStage2Mode ||
        (uiSettings && uiSettings.flashLinkStage2Mode)
      );
      const required = getFlightDataLoggingRequiredStages();
      const missing = [];
      const unknown = [];
      required.forEach((stageId)=>{
        let value = flightDataLoggingByStage[stageId];
        // Direct avionics mode does not always include stage_node_id in its
        // first telemetry frame, so use the established single-board flag as
        // a fallback for that one required board only.
        if(
          value == null && required.length === 1 &&
          !isFlashLinkGroundStorageUi() && flightDataLoggingKnown
        ){
          value = flightDataLoggingEnabled;
        }
        if(value == null) unknown.push(stageId);
        else if(!value) missing.push(stageId);
      });
      return {
        ready:missing.length === 0 && unknown.length === 0,
        required,
        missing,
        unknown,
        dual:configuredDual
      };
    }

    function showFlightLoggingGuardModal(actionLabel){
      const status = getFlightLoggingGuardStatus();
      const ids = status.missing.concat(status.unknown);
      const stageText = ids.length
        ? ids.map((id)=>id + "단부").join(", ")
        : "에비오닉스";
      const unknownOnly = status.missing.length === 0 && status.unknown.length > 0;
      if(el.flightLoggingGuardText){
        el.flightLoggingGuardText.textContent = unknownOnly
          ? stageText + " 비행데이터 로깅 상태를 확인하지 못했습니다. 로깅 상태와 연결을 확인한 뒤 다시 시도하세요."
          : stageText + " 비행데이터 로깅이 켜져 있지 않습니다. " +
            (actionLabel || "미션") + " 전에 비행 로깅을 시작하세요.";
      }
      if(el.flightLoggingGuardDetail){
        el.flightLoggingGuardDetail.textContent = status.dual
          ? "2단 운용에서는 1단·2단 로깅이 모두 ON이어야 합니다."
          : "비행 데이터가 저장되지 않으면 해당 비행을 복구하거나 분석할 수 없습니다.";
      }
      setOverlayVisible(el.flightLoggingGuardOverlay, true);
    }

    async function ensureFlightLoggingForMission(actionLabel){
      if(simEnabled) return true;
      if(flightLoggingGuardCheckPromise) return flightLoggingGuardCheckPromise;

      flightLoggingGuardCheckPromise = (async()=>{
        let status = getFlightLoggingGuardStatus();
        if(status.ready) return true;

        // A mission button can be pressed while the logging command is still
        // travelling through the ground relay. Do not reject it from the old
        // cache: wait for every required board to report the requested ON.
        if(flightDataLoggingPending && flightDataLoggingDesired === true){
          if(await waitForFlightDataLoggingConfirmation(true, 6200)) return true;
        }else if(!(flightDataLoggingPending && flightDataLoggingDesired === false)){
          // On a freshly reloaded UI the board may already be logging while
          // the per-stage cache is still empty. Probe and allow one complete
          // A.I LINK storage-status period before showing a warning.
          await refreshFlightDataLoggingConfirmationStatus();
          status = getFlightLoggingGuardStatus();
          if(status.ready) return true;
          if(await waitForFlightDataLoggingConfirmation(true, 2600)) return true;
        }

        showFlightLoggingGuardModal(actionLabel);
        return false;
      })();

      try{
        return await flightLoggingGuardCheckPromise;
      }finally{
        flightLoggingGuardCheckPromise = null;
      }
    }

    async function refreshFlightDataLoggingConfirmationStatus(){
      if(isFlashLinkGroundStorageUi()){
        const required = getFlightDataLoggingRequiredStages();
        for(const stageId of required){
          await refreshRemoteSpiFlashStatus(stageId);
          await delay(80);
        }
        return;
      }
      await fetchSpiFlashStatus({force:true});
    }

    async function waitForFlightDataLoggingConfirmation(expected, timeoutMs){
      const deadline = Date.now() + Math.max(250, Number(timeoutMs) || 2500);
      let nextProbeAt = 0;
      while(Date.now() < deadline){
        const summary = getFlightDataLoggingStageSummary(expected);
        if(summary.matchesExpected){
          commitFlightDataLoggingState(expected);
          return true;
        }
        if(Date.now() >= nextProbeAt){
          await refreshFlightDataLoggingConfirmationStatus();
          nextProbeAt = Date.now() + 450;
          const refreshed = getFlightDataLoggingStageSummary(expected);
          if(refreshed.matchesExpected){
            commitFlightDataLoggingState(expected);
            return true;
          }
        }
        await delay(100);
      }
      return false;
    }

    async function toggleFlightDataLogging(){
      if(flightDataLoggingPending) return;
      if(!simEnabled && !(connOk || wsConnected || serialConnected)){
        showToast("보드 연결 후 비행데이터 로깅을 시작할 수 있습니다.", "warn");
        return;
      }
      const previous = flightDataLoggingEnabled;
      const next = !previous;
      const requiredStages = getFlightDataLoggingRequiredStages();
      // A cached ON/OFF value must not confirm a new command. Each required
      // board has to report its state again after this request.
      requiredStages.forEach((stageId)=>{
        flightDataLoggingByStage[stageId] = null;
      });
      flightDataLoggingPending = true;
      flightDataLoggingDesired = next;
      syncFlightDataLoggingUi();

      if(simEnabled){
        flightDataLoggingKnown = true;
        flightDataLoggingPending = false;
        flightDataLoggingDesired = null;
        flightDataLoggingEnabled = next;
        if(!next) finalizeAppDataSession();
        syncFlightDataLoggingUi();
        showToast(next ? "시뮬레이션 비행데이터 로깅을 시작했습니다." : "시뮬레이션 비행데이터 로깅을 종료했습니다.", "success");
        return;
      }

      const command = {
          http:"/set?storage_logging=" + (next ? 1 : 0),
          ser:"/set?storage_logging=" + (next ? 1 : 0)
      };
      let result = await sendCommand(command, true);
      let commandAccepted = !!(result && result.ok);
      let confirmed = await waitForFlightDataLoggingConfirmation(next, 6800);
      // One idempotent retry is enough for a transient relay queue failure;
      // repeated blind retries previously caused duplicate board beeps and
      // made the UI race against old telemetry.
      if(!confirmed){
        flightDataLoggingPending = true;
        flightDataLoggingDesired = next;
        result = await sendCommand(command, false);
        commandAccepted = commandAccepted || !!(result && result.ok);
        confirmed = await waitForFlightDataLoggingConfirmation(next, 5200);
      }

      if(!confirmed){
        flightDataLoggingPending = false;
        flightDataLoggingDesired = null;
        const summary = getFlightDataLoggingStageSummary();
        flightDataLoggingEnabled = summary.unknown.length === 0
          ? summary.enabled.length === summary.required.length
          : previous;
        flightDataLoggingKnown = summary.unknown.length === 0;
        syncFlightDataLoggingUi();
        const unresolved = summary.required.filter((stageId)=>
          flightDataLoggingByStage[stageId] !== next
        );
        const stageText = unresolved.length
          ? unresolved.map((stageId)=>stageId + "단부").join(", ") + " 상태 확인 실패"
          : "상태 확인 실패";
        showToast(
          commandAccepted
            ? stageText + ": 저장공간과 A.I LINK를 확인하세요."
            : "비행데이터 로깅 명령을 전송하지 못했습니다. 연결을 확인하세요.",
          "error"
        );
        return;
      }

      showToast(
        next
          ? "비행데이터 로깅을 시작했습니다. 새 기록 세션이 생성됩니다."
          : "비행데이터 로깅을 종료하고 기록을 안전하게 닫았습니다.",
        "success"
      );
    }

    function getSequenceStorageGuard(){
      if(simEnabled){
        return {level:"ok", pct:0, blocked:false, label:"시뮬레이션 저장공간"};
      }
      const groundMode =
        getSettingsOperationModeValue() === "flash_link" &&
        normalizeFlashLinkRole(uiSettings && uiSettings.flashLinkRole) === "ground";
      const storageInfo = groundMode
        ? latestAvionicsStorageInfo
        : latestSpiFlashStorageInfo;
      const pct = getSpiFlashUsedPercent(storageInfo);
      if(!isFinite(pct)){
        return {
          level:"unknown",
          pct:NaN,
          blocked:groundMode,
          label:groundMode ? "에비오닉스 저장공간 확인 필요" : ""
        };
      }
      if(pct >= 70) return {level:"red", pct, blocked:true, label:"저장공간 초기화 필요"};
      if(pct >= 50) return {level:"orange", pct, blocked:false, label:"저장공간 경고"};
      if(pct >= 30) return {level:"green", pct, blocked:false, label:"저장공간 확인"};
      return {level:"ok", pct, blocked:false, label:""};
    }

    function showSequenceStorageGuardToast(force){
      const guard = getSequenceStorageGuard();
      if(guard.level === "unknown" && guard.blocked){
        showToast("에비오닉스 저장공간 상태를 확인할 수 없어 시퀀스를 시작할 수 없습니다. A.I LINK 연결과 양쪽 펌웨어를 확인하세요.", "critical", {
          key:"sequence-storage-unknown",
          keep:true,
          duration:7000,
          title:"저장공간 상태"
        });
        return true;
      }
      if(!isFinite(guard.pct) || guard.level === "ok") return false;
      const pctText = guard.pct.toFixed(1) + "%";
      if(guard.level === "red"){
        showToast("저장공간 " + pctText + " 사용 중입니다. 데이터 유실 방지를 위해 시퀀스 권한을 해제했습니다. 저장공간을 초기화하세요.", "critical", {
          key:"sequence-storage-red",
          keep:true,
          duration:7000,
          title:"저장공간 상태"
        });
        return true;
      }
      if(guard.level === "orange"){
        showToast("저장공간 " + pctText + " 사용 중입니다. 시퀀스 전 초기화를 권장합니다.", "warn", {key:"sequence-storage-orange", keep:!!force, duration:6000});
        return true;
      }
      if(guard.level === "green"){
        showToast("저장공간 " + pctText + " 사용 중입니다. 꼭 필요하진 않지만 데이터 유실 방지를 위해 초기화하면 좋습니다.", "success", {key:"sequence-storage-green", keep:!!force, duration:5200});
        return true;
      }
      return false;
    }

    function syncSequenceStorageGuardUi(){
      const guard = getSequenceStorageGuard();
      const levelClass = guard.level && guard.level !== "ok" && guard.level !== "unknown"
        ? "storage-guard-" + guard.level
        : "";
      const targets = [
        el.sequenceStatusDesktop,
        el.mobileSequenceWideStatus,
        el.mobileSequenceStatusPill
      ];
      targets.forEach((node)=>{
        if(!node) return;
        node.classList.remove("storage-guard-green", "storage-guard-orange", "storage-guard-red");
        if(levelClass) node.classList.add(levelClass);
      });
      [el.igniteBtn, el.mobileSequenceStartBtn, el.mobileSequenceWideBtn].forEach((node)=>{
        if(!node) return;
        node.classList.remove("storage-guard-green", "storage-guard-orange", "storage-guard-red");
        if(levelClass) node.classList.add(levelClass);
      });
    }

    function processSequenceStorageGuardUpdate(options){
      const opts = options || {};
      const guard = getSequenceStorageGuard();
      const previousLevel = lastSequenceStorageGuardLevel;
      const levelChanged = guard.level !== previousLevel;

      if(!levelChanged) return guard;

      lastSequenceStorageGuardLevel = guard.level;
      syncSequenceStorageGuardUi();
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);

      if(guard.level !== "red"){
        dismissToastByKey("sequence-storage-red");
      }
      if(!(guard.level === "unknown" && guard.blocked)){
        dismissToastByKey("sequence-storage-unknown");
      }
      if(opts.notifyCritical !== false && guard.level === "red"){
        showSequenceStorageGuardToast(true);
      }
      return guard;
    }

    function updateSpiFlashStatusUi(info, errMsg){
      if(errMsg){
        const cachedInfo = getActiveStoragePreviewInfo();
        if(cachedInfo && isFinite(getSpiFlashUsedPercent(cachedInfo))){
          if(el.spiFlashStatusLine){
            const cachedAt = cachedInfo === latestAvionicsStorageInfo
              ? latestAvionicsStorageOkMs
              : latestSpiFlashStorageOkMs;
            const ageMs = Math.max(
              0,
              cachedAt ? (Date.now() - cachedAt) : 0
            );
            const ageText = ageMs < 15000 ? "방금 전" : Math.round(ageMs / 1000) + "초 전";
            el.spiFlashStatusLine.textContent =
              "FLASH 상태 확인 지연: " + String(errMsg) + " · 마지막값 유지(" + ageText + ")";
          }
          syncStoragePreview();
          syncSequenceStorageGuardUi();
          return;
        }
        latestSpiFlashStorageInfo = null;
        if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "FLASH 상태 확인 실패: " + String(errMsg);
        syncStoragePreview("--", true);
        processSequenceStorageGuardUpdate({notifyCritical:false});
        return;
      }
      if(!info || !info.ready){
        latestSpiFlashStorageInfo = null;
        spiFlashReadyState = false;
        if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "FLASH NOT READY";
        syncStoragePreview("--", !isFlashLinkGroundStorageUi());
        processSequenceStorageGuardUpdate({notifyCritical:false});
        return;
      }
      latestSpiFlashStorageInfo = Object.assign({}, info, {updated_at:Date.now()});
      latestSpiFlashStorageOkMs = Date.now();
      spiFlashReadyState = true;
      if(!isFlashLinkGroundStorageUi() && info.logging != null){
        applyFlightDataLoggingTelemetry({storage_logging:info.logging});
      }
      const usedBytes = Number(info.used_bytes || 0);
      const capBytes = Number(info.capacity_bytes || 0);
      const chipBytes = Number(info.chip_capacity_bytes || capBytes);
      const queuedBytes = Number(info.queue_bytes || 0);
      const recordCount = Number(info.record_count || 0);
      const usedMb = (usedBytes / (1024 * 1024)).toFixed(2);
      const capMb = (capBytes / (1024 * 1024)).toFixed(2);
      const chipMb = (chipBytes / (1024 * 1024)).toFixed(2);
      const usedPercent = capBytes > 0 ? Math.max(0, Math.min(100, (usedBytes / capBytes) * 100)) : NaN;
      syncStoragePreview();
      const mfrHex = Number(info.jedec && info.jedec.mfr || 0).toString(16).toUpperCase().padStart(2, "0");
      const capCodeHex = Number(info.jedec && info.jedec.cap_code || 0).toString(16).toUpperCase().padStart(2, "0");
      const remainSec = estimateSpiFlashRemainingSec(info);
      const remainHms = formatDurationHms(remainSec);
      if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent =
        "W25Q256JVEIQ " + chipMb + "MB · 기록영역 " + usedMb + "MB / " + capMb + "MB" +
        (isFinite(usedPercent) ? " (" + usedPercent.toFixed(1) + "%)" : "") + " · records " + recordCount +
        " · queue " + queuedBytes + "B · 남은 약 " + remainSec + "초 (" + remainHms + ")" +
        " · JEDEC " + mfrHex + ".." + capCodeHex;
      processSequenceStorageGuardUpdate({notifyCritical:true});
    }

    const SPI_FLASH_REMOTE_CHUNK_BYTES = 8192;

    function normalizeRemoteSpiFlashInfo(info){
      if(!info || typeof info !== "object") return null;
      const capacityBytes = Math.max(0, Number(info.capacity_bytes || info.chip_capacity_bytes || 0));
      const usedBytes = Math.max(0, Number(info.used_bytes || 0));
      const records = Math.max(0, Number(info.record_count || info.records || 0));
      const ready = !!Number(info.ready || 0) || (capacityBytes > 0 && usedBytes >= 0);
      const pct = capacityBytes > 0 ? Math.max(0, Math.min(100, (usedBytes / capacityBytes) * 100)) : 0;
      return Object.assign({}, info, {
        ok:1,
        remote:1,
        ready,
        storage_kind:info.storage_kind || "external_spi_nor",
        model:info.model || "W25Q256JVEIQ",
        capacity_bytes:capacityBytes,
        chip_capacity_bytes:Math.max(capacityBytes, Number(info.chip_capacity_bytes || 0)),
        used_bytes:usedBytes,
        used_percent:isFinite(Number(info.used_percent)) ? Number(info.used_percent) : pct,
        record_count:records,
        record_hz:Math.max(1, Number(info.record_hz || 200)),
        updated_at:Date.now()
      });
    }

    function normalizeStorageStageNode(value){
      const node = Math.floor(Number(value) || 0);
      return node === 1 || node === 2 ? node : 0;
    }

    function remoteStorageStageNodes(){
      if(uiSettings && uiSettings.flashLinkStage2Mode === true) return [1, 2];
      const selected = normalizeStorageStageNode(
        typeof flashLinkTargetNodeId !== "undefined" ? flashLinkTargetNodeId : 0
      );
      return [selected || 1];
    }

    function selectedRemoteStorageStage(overlay){
      const stageNodes = remoteStorageStageNodes();
      const current = normalizeStorageStageNode(
        overlay && overlay._selectedStorageStage
      );
      const selected = stageNodes.indexOf(current) >= 0
        ? current
        : (stageNodes[0] || 1);
      if(overlay) overlay._selectedStorageStage = selected;
      return selected;
    }

    function syncRemoteStorageStageSelector(overlay){
      if(!overlay) return;
      const selector = overlay.querySelector("[data-storage-stage-selector]");
      const stageNodes = remoteStorageStageNodes();
      const boardView = getDataListView(overlay._originFilter) === "avionics";
      const visible = boardView &&
        isFlashLinkGroundStorageUi() &&
        stageNodes.length > 1;
      if(selector) selector.hidden = !visible;
      const selected = selectedRemoteStorageStage(overlay);
      overlay.querySelectorAll("[data-storage-stage]").forEach((button)=>{
        const stageNode = normalizeStorageStageNode(
          button.getAttribute("data-storage-stage")
        );
        const active = visible && stageNode === selected;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    function updateRemoteSpiFlashInfo(info, requestedNodeId){
      const normalized = normalizeRemoteSpiFlashInfo(info);
      if(!normalized) return null;
      const stageNode = normalizeStorageStageNode(
        requestedNodeId || normalized.stage_node
      );
      if(stageNode){
        normalized.stage_node = stageNode;
        latestAvionicsStorageByStage[stageNode] = Object.assign(
          {},
          latestAvionicsStorageByStage[stageNode] || {},
          normalized
        );
      }
      // Keep the legacy single-value cache pinned to stage 1. Stage 2 still
      // has its own cache and selector, but can no longer overwrite the
      // primary status shown in the HUD and mission storage guard.
      const primaryStorageUpdate = stageNode === 1 || !stageNode;
      if(primaryStorageUpdate){
        latestAvionicsStorageInfo = stageNode
          ? latestAvionicsStorageByStage[stageNode]
          : normalized;
        latestAvionicsStorageOkMs = Date.now();
      }
      if(normalized.logging != null){
        applyFlightDataLoggingTelemetry({storage_logging:normalized.logging}, stageNode);
      }
      syncStoragePreview();
      processSequenceStorageGuardUpdate({notifyCritical:true});
      return normalized;
    }

    async function fetchSpiFlashRemoteDataList(requestedNodeId){
      if(!isFlashLinkGroundStorageUi()){
        throw new Error("FLASH_LINK_REMOTE_NOT_ACTIVE");
      }
      const stageNode = normalizeStorageStageNode(requestedNodeId);
      if(canUseSerialForSpiFlash()){
        try{
          return await fetchSpiFlashRemoteDataListViaSerial(stageNode);
        }catch(serialErr){
          if(serialEnabled) throw serialErr;
        }
      }else if(serialEnabled){
        if(!serialConnected) throw new Error("SERIAL_DISCONNECTED");
        if(!serialTxEnabled) throw new Error("SERIAL_TX_DISABLED");
        throw new Error("SERIAL_NOT_READY");
      }
      const API_BASE = getApiBaseForCommands();
      const nodeQuery = stageNode ? ("?node=" + stageNode) : "";
      const url = (API_BASE ? API_BASE : "") + "/storage/spi_flash/remote/list" + nodeQuery;
      const ctrl = createAbortControllerSafe();
      const timer = ctrl ? setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, 12000) : null;
      const opt = API_BASE
        ? Object.assign({cache:"no-store", mode:"cors"}, ctrl ? {signal:ctrl.signal} : {})
        : Object.assign({cache:"no-store"}, ctrl ? {signal:ctrl.signal} : {});
      try{
        const res = await fetch(url, opt);
        if(!res.ok) throw new Error("HTTP " + res.status);
        const info = await res.json();
        if(Number(info.list_available) === 0 || Number(info.list_complete) === 0){
          throw new Error("REMOTE_SESSION_LIST_UNAVAILABLE");
        }
        const normalized = updateRemoteSpiFlashInfo(info, stageNode) || info;
        const items = Array.isArray(info.items) ? info.items : [];
        return Object.assign({}, normalized, {
          stage_node:stageNode || normalizeStorageStageNode(info.stage_node),
          items
        });
      }catch(err){
        throw err;
      }finally{
        if(timer) clearTimeout(timer);
      }
    }

    async function fetchSpiFlashDataList(){
      if(canUseSerialForSpiFlash()){
        try{
          return await fetchSpiFlashDataListViaSerial();
        }catch(serialErr){
          if(serialEnabled) throw serialErr;
        }
      }else if(serialEnabled){
        if(!serialConnected) throw new Error("SERIAL_DISCONNECTED");
        if(!serialTxEnabled) throw new Error("SERIAL_TX_DISABLED");
        throw new Error("SERIAL_NOT_READY");
      }
      const API_BASE = getApiBaseForCommands();
      const url = (API_BASE ? API_BASE : "") + "/storage/spi_flash/list";
      const ctrl = createAbortControllerSafe();
      const timer = ctrl ? setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, 3500) : null;
      const opt = API_BASE
        ? Object.assign({cache:"no-store", mode:"cors"}, ctrl ? {signal:ctrl.signal} : {})
        : Object.assign({cache:"no-store"}, ctrl ? {signal:ctrl.signal} : {});
      try{
        const res = await fetch(url, opt);
        if(!res.ok) throw new Error("HTTP " + res.status);
        const info = await res.json();
        updateSpiFlashStatusUi(info, null);
        return info;
      }catch(err){
        const status = await fetchSpiFlashStatus().catch(()=>null);
        if(status && status.ready){
          return Object.assign({}, status, {items:[], list_unavailable:true});
        }
        throw err;
      }finally{
        if(timer) clearTimeout(timer);
      }
    }

    function formatBytesCompact(bytes){
      const n = Number(bytes || 0);
      if(!isFinite(n) || n <= 0) return "0 B";
      if(n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + " MB";
      if(n >= 1024) return (n / 1024).toFixed(1) + " KB";
      return Math.round(n) + " B";
    }

    let dataListLiveTimer = null;
    let dataListLivePending = false;

    function normalizeRemoteDataListItems(info, requestedNodeId){
      const items = info && Array.isArray(info.items) ? info.items : [];
      const infoStage = normalizeStorageStageNode(
        requestedNodeId || (info && info.stage_node)
      );
      return items.map((item)=>{
        const recordedStage = normalizeStorageStageNode(item && item.stage_node);
        const storageStage = infoStage || recordedStage;
        return Object.assign({}, item, {
          kind:"board",
          origin:"avionics",
          remote:true,
          storageStage,
          stage_node:recordedStage || storageStage,
          dataKey:"board-remote-s" + String(storageStage || 0) + ":" + String(item.offset || 0)
        });
      });
    }

    function rebuildRemoteBoardItems(overlay){
      const stageInfos = overlay && overlay._remoteStageInfo || {};
      const items = [];
      [1, 2].forEach((stageNode)=>{
        if(stageInfos[stageNode]){
          items.push.apply(items, normalizeRemoteDataListItems(stageInfos[stageNode], stageNode));
        }
      });
      return items.concat(Array.isArray(overlay && overlay._localBoardItems)
        ? overlay._localBoardItems
        : []);
    }

    function applyRemoteDataListResult(overlay, summary, info, requestedNodeId){
      if(!overlay || !info) return;
      const stageNode = normalizeStorageStageNode(
        requestedNodeId || info.stage_node
      ) || 1;
      overlay._remoteStageInfo = overlay._remoteStageInfo || {};
      overlay._remoteStageError = overlay._remoteStageError || {};
      overlay._remoteStageInfo[stageNode] = info;
      overlay._remoteStageError[stageNode] = null;
      overlay._remoteBoardInfo = info;
      overlay._remoteBoardError = null;
      overlay._remoteListFailureCount = 0;
      overlay._remoteListRetryAt = 0;
      overlay._boardItems = rebuildRemoteBoardItems(overlay);
      renderDataListSummary(
        summary,
        info,
        Array.isArray(overlay._appSessions) ? overlay._appSessions : [],
        overlay._originFilter,
        overlay._remoteStageInfo,
        overlay._remoteStageError
      );
      renderDataListItems(overlay);
    }

    function renderStorageStageSummary(stageNode, info, error){
      const boardInfo = normalizeRemoteSpiFlashInfo(info) || {};
      const capacity = Math.max(0, Number(boardInfo.capacity_bytes || 0));
      const used = Math.max(0, Number(boardInfo.used_bytes || 0));
      const records = Math.max(0, Number(boardInfo.record_count || 0));
      const pct = capacity > 0
        ? Math.max(0, Math.min(100, (used / capacity) * 100))
        : 0;
      const ready = !error && capacity > 0;
      const status = error ? "LINK WAIT" : (ready ? "A.I LINK" : "SYNC WAIT");
      const model = String(boardInfo.model || "W25Q256JVEIQ");
      return '<div class="data-storage-avionics-summary' + (ready ? ' is-ready' : ' is-waiting') + '">' +
        '<div class="data-storage-summary-heading">' +
          '<span class="data-storage-title">STAGE ' + stageNode + '</span>' +
          '<span class="data-storage-total">' + status + '</span>' +
        '</div>' +
        '<div class="data-storage-metrics">' +
          '<div><span>전체 용량</span><strong>' + (capacity > 0 ? formatBytesCompact(capacity) : '--') + '</strong></div>' +
          '<div><span>사용량</span><strong>' + (capacity > 0 ? formatBytesCompact(used) : '--') + '</strong></div>' +
          '<div><span>저장 기록</span><strong>' + (capacity > 0 ? records.toLocaleString("ko-KR") : '--') + '</strong></div>' +
        '</div>' +
        '<div class="data-storage-spec">' + model + ' · SPI NOR · ' +
          (capacity > 0 ? pct.toFixed(1) + '% 사용' : '에비오닉스 응답 대기') +
        '</div>' +
      '</div>';
    }

    function renderDataListSummary(
      summary,
      info,
      appSessions,
      originFilter,
      remoteStageInfo,
      remoteStageError
    ){
      if(!summary) return;
      info = info || {};
      appSessions = Array.isArray(appSessions) ? appSessions : [];
      const selectedView = getDataListView(originFilter);
      const filteredAppSessions = selectedView === "app" ? appSessions : [];
      const appBytes = filteredAppSessions.reduce(
        (sum, item)=>sum + Math.max(0, Number(item && item.bytes || 0)),
        0
      );
      const appSamples = filteredAppSessions.reduce(
        (sum, item)=>sum + Math.max(0, Number(item && item.sampleCount || 0)),
        0
      );
      const appSummary =
        '<div class="data-storage-summary-heading">' +
          '<span class="data-storage-title">APP</span>' +
          '<span class="data-storage-total">LOCAL CAPTURE</span>' +
        '</div>' +
        '<div class="data-storage-metrics">' +
          '<div><span>세션</span><strong>' + filteredAppSessions.length.toLocaleString("ko-KR") + '</strong></div>' +
          '<div><span>사용량</span><strong>' + formatBytesCompact(appBytes) + '</strong></div>' +
          '<div><span>샘플</span><strong>' + appSamples.toLocaleString("ko-KR") + '</strong></div>' +
        '</div>' +
        '<div class="data-storage-spec">HWLOGV2 BIN · 수신 데이터를 원본 형식으로 저장</div>';
      if(selectedView === "app"){
        summary.innerHTML = appSummary;
        return;
      }
      const stageNodes = remoteStorageStageNodes();
      if(isFlashLinkGroundStorageUi() && stageNodes.length > 1){
        const infos = remoteStageInfo || {};
        const errors = remoteStageError || {};
        const overlay = summary.closest("#dataListOverlay");
        const stageNode = selectedRemoteStorageStage(overlay);
        summary.innerHTML = renderStorageStageSummary(
          stageNode,
          infos[stageNode] || latestAvionicsStorageByStage[stageNode],
          errors[stageNode]
        );
        syncRemoteStorageStageSelector(overlay);
        return;
      }
      const remoteInfo = isFlashLinkGroundStorageUi()
        ? (normalizeRemoteSpiFlashInfo(latestAvionicsStorageInfo) || null)
        : null;
      const boardInfo = remoteInfo || info || {};
      const remoteCapacity = Math.max(0, Number(boardInfo && boardInfo.capacity_bytes || 0));
      const remoteUsed = Math.max(0, Number(boardInfo && boardInfo.used_bytes || 0));
      const remoteRecords = Math.max(0, Number(boardInfo && boardInfo.record_count || 0));
      const model = String(boardInfo && boardInfo.model || "W25Q256JVEIQ");
      const liveText = remoteInfo || isFlashLinkGroundStorageUi()
        ? "A.I LINK 실시간 동기화"
        : "직접 연결";
        const remotePct = remoteCapacity > 0
          ? Math.max(0, Math.min(100, (remoteUsed / remoteCapacity) * 100))
          : 0;
      const stageNode = normalizeStorageStageNode(boardInfo.stage_node) ||
        selectedRemoteStorageStage(summary.closest("#dataListOverlay"));
      summary.innerHTML =
        '<div class="data-storage-summary-heading">' +
          '<span class="data-storage-title">STAGE ' + String(stageNode || 1) + '</span>' +
          '<span class="data-storage-total">' + (remoteCapacity > 0 ? (remoteInfo ? 'A.I LINK' : 'DIRECT') : 'SYNC WAIT') + '</span>' +
        '</div>' +
        '<div class="data-storage-metrics">' +
          '<div><span>전체 용량</span><strong>' + (remoteCapacity > 0 ? formatBytesCompact(remoteCapacity) : '--') + '</strong></div>' +
          '<div><span>사용량</span><strong>' + formatBytesCompact(remoteUsed) + '</strong></div>' +
          '<div><span>저장 기록</span><strong>' + remoteRecords.toLocaleString("ko-KR") + '</strong></div>' +
        '</div>' +
        '<div class="data-storage-spec">' + model + ' · SPI NOR · ' + remotePct.toFixed(1) + '% 사용 · ' + liveText + '</div>';
    }

    function stopDataListLiveStatus(){
      if(dataListLiveTimer){
        clearTimeout(dataListLiveTimer);
        dataListLiveTimer = null;
      }
    }

    function startDataListLiveStatus(overlay, summary){
      stopDataListLiveStatus();
      const refresh = async()=>{
        if(!overlay.classList.contains("is-open")) return;
        const view = getDataListView(overlay._originFilter);
        if(view === "app"){
          renderDataListSummary(
            summary,
            overlay._boardInfo || {},
            Array.isArray(overlay._appSessions) ? overlay._appSessions : [],
            overlay._originFilter,
            overlay._remoteStageInfo,
            overlay._remoteStageError
          );
          syncDataStorageActionButtons();
          if(overlay.classList.contains("is-open")) dataListLiveTimer = setTimeout(refresh, 1600);
          return;
        }
        if(isFlashLinkGroundStorageUi()){
          renderDataListSummary(
            summary,
            latestAvionicsStorageInfo || {},
            Array.isArray(overlay._appSessions) ? overlay._appSessions : [],
            overlay._originFilter,
            overlay._remoteStageInfo,
            overlay._remoteStageError
          );
          const nowMs = Date.now();
          const retryNode = remoteStorageStageNodes().find((stageNode)=>{
            const error = overlay._remoteStageError && overlay._remoteStageError[stageNode];
            const retryAt = overlay._remoteStageRetryAt && overlay._remoteStageRetryAt[stageNode];
            return !!error && nowMs >= Number(retryAt || 0);
          });
          if(retryNode && !overlay._remoteListPending){
            overlay._remoteListPending = true;
            renderDataListItems(overlay);
            try{
              const refreshed = await fetchSpiFlashRemoteDataList(retryNode);
              if(overlay.classList.contains("is-open")){
                applyRemoteDataListResult(overlay, summary, refreshed, retryNode);
              }
            }catch(error){
              overlay._remoteBoardError = error;
              overlay._remoteStageError = overlay._remoteStageError || {};
              overlay._remoteStageFailureCount = overlay._remoteStageFailureCount || {};
              overlay._remoteStageRetryAt = overlay._remoteStageRetryAt || {};
              overlay._remoteStageError[retryNode] = error;
              const failures = Math.min(
                8,
                Math.max(0, Number(overlay._remoteStageFailureCount[retryNode] || 0)) + 1
              );
              overlay._remoteStageFailureCount[retryNode] = failures;
              overlay._remoteStageRetryAt[retryNode] =
                Date.now() + Math.min(6000, 800 * Math.pow(2, Math.min(3, failures - 1)));
              overlay._remoteListFailureCount = failures;
              if(overlay.classList.contains("is-open")) renderDataListItems(overlay);
            }finally{
              overlay._remoteListPending = false;
            }
          }
          syncDataStorageActionButtons();
          if(overlay.classList.contains("is-open")) dataListLiveTimer = setTimeout(refresh, 1000);
          return;
        }
        syncDataStorageActionButtons();
        if(!dataListLivePending){
          dataListLivePending = true;
          try{
            const info = await fetchSpiFlashStatus({background:true});
            if(info && overlay.classList.contains("is-open")){
              renderDataListSummary(
                summary,
                info,
                Array.isArray(overlay._appSessions) ? overlay._appSessions : [],
                overlay._originFilter,
                overlay._remoteStageInfo,
                overlay._remoteStageError
              );
            }
          }finally{
            dataListLivePending = false;
          }
        }
        if(overlay.classList.contains("is-open")) dataListLiveTimer = setTimeout(refresh, 1000);
      };
      dataListLiveTimer = setTimeout(refresh, 1000);
    }

    function canUseDataStorageActions(){
      if(serialEnabled) return !!(serialConnected && serialTxEnabled);
      return !!(wsConnected || connOk);
    }

    function syncDataStorageActionButtons(){
      const overlay = document.getElementById("dataListOverlay");
      if(!overlay) return;
      const canUse = canUseDataStorageActions();
      const downloadBtn = overlay.querySelector("#dataStorageDownloadBtn");
      const resetBtn = overlay.querySelector("#dataStorageResetBtn");
      const actions = overlay.querySelector(".data-storage-actions");
      const items = Array.isArray(overlay._dataItems) ? overlay._dataItems : [];
      const view = getDataListView(overlay._originFilter);
      const boardView = view === "avionics";
      const title = canUse ? "" : "보드 저장공간 기능은 연결 후 사용할 수 있습니다.";
      if(downloadBtn){
        downloadBtn.disabled = items.length === 0;
        downloadBtn.title = items.length ? "" : "저장된 데이터가 없습니다.";
      }
      if(resetBtn){
        resetBtn.hidden = !boardView;
        resetBtn.disabled = !canUse;
        resetBtn.title = title;
        resetBtn.textContent = "에비오닉스 초기화";
      }
      if(actions) actions.classList.toggle("is-app-only", !boardView);
    }

    function ensureDataResetConfirmOverlay(){
      let overlay = document.getElementById("dataResetConfirmOverlay");
      if(overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "dataResetConfirmOverlay";
      overlay.className = "mobile-chart-picker-overlay hidden";
      overlay.style.display = "none";
      overlay.innerHTML =
        '<div class="mobile-chart-picker-dialog agent-help-dialog" role="dialog" aria-modal="true" aria-labelledby="dataResetConfirmTitle" aria-describedby="dataResetConfirmText">' +
          '<div class="mobile-chart-picker-head">' +
            '<div id="dataResetConfirmTitle" class="mobile-chart-picker-title">저장공간 초기화</div>' +
            '<button id="dataResetConfirmClose" class="mobile-chart-picker-close" type="button" aria-label="닫기">×</button>' +
          '</div>' +
          '<div class="mobile-chart-picker-body">' +
            '<p id="dataResetConfirmText" class="data-reset-warning">플래시 저장공간의 모든 기록을 정말 초기화하시겠습니까?</p>' +
            '<p class="data-reset-note">저장된 데이터는 모두 삭제되며 복구할 수 없습니다. 초기화가 끝날 때까지 보드 전원과 USB 연결을 유지하세요.</p>' +
            '<div class="data-reset-actions">' +
              '<button id="dataResetHoldBtn" class="data-reset-hold pyro-hold-button" type="button"><span>3초간 길게 눌러 초기화</span></button>' +
              '<button id="dataResetCancelBtn" class="data-reset-cancel" type="button">취소</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      const holdBtn = overlay.querySelector("#dataResetHoldBtn");
      const holdLabel = holdBtn ? holdBtn.querySelector("span") : null;
      const cancelBtn = overlay.querySelector("#dataResetCancelBtn");
      const closeBtn = overlay.querySelector("#dataResetConfirmClose");
      const durationMs = 3000;
      let holdTimer = null;
      let holdStartedAt = 0;
      let activePointerId = null;
      let resetRunning = false;

      const setProgress = (ratio)=>{
        if(holdBtn) holdBtn.style.setProperty("--pyro-hold-progress", String(Math.max(0, Math.min(1, ratio))));
      };
      const cancelHold = ()=>{
        if(holdTimer){ clearInterval(holdTimer); holdTimer = null; }
        activePointerId = null;
        if(holdBtn) holdBtn.classList.remove("is-holding");
        if(!resetRunning) setProgress(0);
      };
      const close = ()=>{
        if(resetRunning) return;
        cancelHold();
        overlay.classList.remove("is-open");
        setTimeout(()=>{
          if(overlay.classList.contains("is-open")) return;
          overlay.classList.add("hidden");
          overlay.style.display = "none";
        }, 220);
      };
      const completeReset = async()=>{
        if(resetRunning) return;
        resetRunning = true;
        cancelHold();
        setProgress(1);
        if(holdBtn) holdBtn.disabled = true;
        if(cancelBtn) cancelBtn.disabled = true;
        if(closeBtn) closeBtn.disabled = true;
        const runningTarget = overlay._resetTarget || getSpiFlashResetTarget();
        if(holdLabel) holdLabel.textContent = runningTarget.label + " 초기화 중… 0초";
        stopDataListLiveStatus();
        const resetStartedAt = Date.now();
        const elapsedTimer = setInterval(()=>{
          const target = overlay._resetTarget || getSpiFlashResetTarget();
          if(holdLabel) holdLabel.textContent = target.label + " 초기화 중… " + Math.max(1, Math.floor((Date.now() - resetStartedAt) / 1000)) + "초";
        }, 500);
        let ok = false;
        try{
          ok = await resetSpiFlashStorage(overlay._resetTarget || {});
        }finally{
          clearInterval(elapsedTimer);
          resetRunning = false;
        }
        if(holdBtn) holdBtn.disabled = false;
        if(cancelBtn) cancelBtn.disabled = false;
        if(closeBtn) closeBtn.disabled = false;
        setProgress(0);
        if(holdLabel) holdLabel.textContent = "3초간 길게 눌러 초기화";
        if(ok){
          close();
          await showDataListOverlay();
        }
      };
      const tick = ()=>{
        const ratio = (Date.now() - holdStartedAt) / durationMs;
        setProgress(ratio);
        if(ratio < 1) return;
        cancelHold();
        completeReset();
      };
      const startHold = (ev)=>{
        if(!holdBtn || holdTimer || resetRunning || holdBtn.disabled) return;
        ev.preventDefault();
        if(typeof ev.pointerId === "number"){
          activePointerId = ev.pointerId;
          try{ holdBtn.setPointerCapture(ev.pointerId); }catch(_e){}
        }
        holdStartedAt = Date.now();
        holdBtn.classList.add("is-holding");
        setProgress(0);
        holdTimer = setInterval(tick, 32);
      };
      const stopHold = (ev)=>{
        if(activePointerId !== null && typeof ev.pointerId === "number" && ev.pointerId !== activePointerId) return;
        cancelHold();
      };
      if(holdBtn){
        holdBtn.addEventListener("pointerdown", startHold);
        holdBtn.addEventListener("pointerup", stopHold);
        holdBtn.addEventListener("pointercancel", stopHold);
        holdBtn.addEventListener("lostpointercapture", stopHold);
        holdBtn.addEventListener("keydown", (ev)=>{
          if((ev.key === "Enter" || ev.key === " ") && !ev.repeat) startHold(ev);
        });
        holdBtn.addEventListener("keyup", (ev)=>{
          if(ev.key === "Enter" || ev.key === " ") stopHold(ev);
        });
        holdBtn.addEventListener("contextmenu", (ev)=>ev.preventDefault());
      }
      if(cancelBtn) cancelBtn.addEventListener("click", close);
      if(closeBtn) closeBtn.addEventListener("click", close);
      overlay.addEventListener("click", (ev)=>{ if(ev.target === overlay) close(); });
      overlay._resetDialog = {cancelHold, holdBtn, holdLabel, cancelBtn, closeBtn};
      return overlay;
    }

    function showDataResetConfirmOverlay(opts){
      const overlay = ensureDataResetConfirmOverlay();
      const desktopDialog = isDesktopLayout() && !isMobileLayout();
      overlay.classList.toggle("is-desktop-reset-dialog", desktopDialog);
      overlay.classList.toggle("is-mobile-reset-dialog", !desktopDialog);
      const target = getSpiFlashResetTarget(opts);
      const state = overlay._resetDialog || {};
      overlay._resetTarget = target;
      const title = overlay.querySelector("#dataResetConfirmTitle");
      const text = overlay.querySelector("#dataResetConfirmText");
      const note = overlay.querySelector(".data-reset-note");
      if(title) title.textContent = target.label + " 초기화";
      if(text) text.textContent =
        target.label + "의 모든 기록을 정말 초기화하시겠습니까?";
      if(note) note.textContent = target.remote
        ? "에비오닉스 보드의 저장 데이터가 모두 삭제됩니다. 초기화가 끝날 때까지 양쪽 보드 전원을 유지하세요."
        : "저장 데이터가 모두 삭제됩니다. 초기화가 끝날 때까지 보드 전원과 USB 연결을 유지하세요.";
      if(state.cancelHold) state.cancelHold();
      if(state.holdBtn) state.holdBtn.disabled = false;
      if(state.cancelBtn) state.cancelBtn.disabled = false;
      if(state.closeBtn) state.closeBtn.disabled = false;
      if(state.holdLabel) state.holdLabel.textContent = "3초간 길게 눌러 초기화";
      overlay.classList.remove("hidden");
      overlay.style.display = "flex";
      requestAnimationFrame(()=>overlay.classList.add("is-open"));
    }

    function getDataListItemDownloadLabel(item){
      if(!item) return {title:"저장 기록", note:""};
      if(item.kind === "app"){
        const started = new Date(Number(item.startedAt || 0));
        const title = isNaN(started.getTime())
          ? String(item.id || "APP BIN")
          : started.toLocaleString("ko-KR");
        return {
          title,
          note:"APP BIN · 샘플 " + Math.max(0, Number(item.sampleCount || 0)).toLocaleString("ko-KR") + "개 · " + formatBytesCompact(item.bytes || 0)
        };
      }
      const stageNode = normalizeStorageStageNode(item.storageStage || item.stage_node);
      return {
        title:String(item.name || "BOARD BIN"),
        note:(stageNode ? ("STAGE " + stageNode + " · ") : "") +
          "AVIONICS BIN · 레코드 " +
          Math.max(0, Number(item.records || 0)).toLocaleString("ko-KR") +
          "개 · " + formatBytesCompact(item.bytes || 0)
      };
    }

    const storageDownloadProgressState = {
      active:false,
      startedAt:0,
      lastPercent:-1,
      lastRenderAt:0,
      lastLoadedBytes:0,
      lastSampleAt:0,
      smoothedBytesPerSec:0,
      speedSampleCount:0
    };

    function formatStorageDownloadEta(seconds){
      const value = Math.max(0, Math.ceil(Number(seconds) || 0));
      if(value <= 1) return "곧 완료";
      if(value < 60) return "약 " + value + "초";
      if(value < 3600){
        const minutes = Math.floor(value / 60);
        const remainSeconds = value % 60;
        return remainSeconds > 0
          ? "약 " + minutes + "분 " + remainSeconds + "초"
          : "약 " + minutes + "분";
      }
      const hours = Math.floor(value / 3600);
      const remainMinutes = Math.ceil((value % 3600) / 60);
      return remainMinutes > 0
        ? "약 " + hours + "시간 " + remainMinutes + "분"
        : "약 " + hours + "시간";
    }

    function updateStorageDownloadSpeedEstimate(loaded, now){
      const state = storageDownloadProgressState;
      if(loaded < state.lastLoadedBytes){
        state.lastLoadedBytes = loaded;
        state.lastSampleAt = now;
        state.smoothedBytesPerSec = 0;
        state.speedSampleCount = 0;
        return;
      }
      if(state.lastSampleAt <= 0){
        state.lastLoadedBytes = loaded;
        state.lastSampleAt = now;
        return;
      }
      const elapsedMs = now - state.lastSampleAt;
      const deltaBytes = loaded - state.lastLoadedBytes;
      if(deltaBytes <= 0 || elapsedMs < 40) return;
      const instantBytesPerSec = (deltaBytes * 1000) / elapsedMs;
      if(isFinite(instantBytesPerSec) && instantBytesPerSec > 0){
        if(state.smoothedBytesPerSec <= 0){
          state.smoothedBytesPerSec = instantBytesPerSec;
        }else{
          const lower = state.smoothedBytesPerSec * 0.25;
          const upper = state.smoothedBytesPerSec * 4;
          const bounded = Math.max(lower, Math.min(upper, instantBytesPerSec));
          state.smoothedBytesPerSec =
            state.smoothedBytesPerSec * 0.76 + bounded * 0.24;
        }
        state.speedSampleCount += 1;
      }
      state.lastLoadedBytes = loaded;
      state.lastSampleAt = now;
    }

    function blockStorageDownloadInteraction(ev){
      if(!storageDownloadProgressState.active) return;
      const overlay = document.getElementById("storageDownloadProgressOverlay");
      if(ev.type === "focusin" && overlay && overlay.contains(ev.target)) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if(ev.type === "focusin"){
        const dialog = overlay && overlay.querySelector(".storage-download-progress-dialog");
        if(dialog){
          try{ dialog.focus({preventScroll:true}); }catch(_e){ dialog.focus(); }
        }
      }
    }

    function ensureStorageDownloadProgressOverlay(){
      let overlay = document.getElementById("storageDownloadProgressOverlay");
      if(overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "storageDownloadProgressOverlay";
      overlay.className = "storage-download-progress-overlay hidden";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML =
        '<section class="storage-download-progress-dialog" role="alertdialog" aria-modal="true" aria-labelledby="storageDownloadProgressTitle" aria-describedby="storageDownloadProgressStatus" tabindex="-1">' +
          '<div class="storage-download-progress-kicker">STORAGE TRANSFER</div>' +
          '<div class="storage-download-progress-heading">' +
            '<h2 id="storageDownloadProgressTitle">저장 기록 다운로드</h2>' +
            '<strong id="storageDownloadProgressPercent">0%</strong>' +
          '</div>' +
          '<div id="storageDownloadProgressFile" class="storage-download-progress-file">저장 기록</div>' +
          '<div id="storageDownloadProgressBar" class="storage-download-progress-track" role="progressbar" aria-label="다운로드 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
            '<span id="storageDownloadProgressFill"></span>' +
          '</div>' +
          '<div class="storage-download-progress-meta">' +
            '<span id="storageDownloadProgressStatus">다운로드 준비 중…</span>' +
            '<span id="storageDownloadProgressBytes">0 B / 0 B</span>' +
          '</div>' +
          '<div class="storage-download-progress-estimate">' +
            '<span>예상 남은 시간</span>' +
            '<strong id="storageDownloadProgressEta" aria-live="polite">계산 중…</strong>' +
          '</div>' +
          '<p class="storage-download-progress-note">완료될 때까지 보드 전원과 연결을 유지하세요.</p>' +
        '</section>';
      overlay.addEventListener("click", (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
      });
      document.body.appendChild(overlay);
      document.addEventListener("keydown", blockStorageDownloadInteraction, true);
      document.addEventListener("keyup", blockStorageDownloadInteraction, true);
      document.addEventListener("focusin", blockStorageDownloadInteraction, true);
      return overlay;
    }

    function updateStorageDownloadProgress(loadedBytes, totalBytes, statusText, force){
      if(!storageDownloadProgressState.active) return;
      const overlay = ensureStorageDownloadProgressOverlay();
      const total = Math.max(0, Math.floor(Number(totalBytes) || 0));
      const loaded = Math.max(0, Math.min(total || Number.MAX_SAFE_INTEGER, Math.floor(Number(loadedBytes) || 0)));
      const percent = total > 0
        ? Math.max(0, Math.min(100, Math.floor((loaded * 100) / total)))
        : 0;
      const now = typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
      updateStorageDownloadSpeedEstimate(loaded, now);
      const shouldRender =
        !!force ||
        percent !== storageDownloadProgressState.lastPercent ||
        (now - storageDownloadProgressState.lastRenderAt) >= 180;
      if(!shouldRender) return;
      storageDownloadProgressState.lastPercent = percent;
      storageDownloadProgressState.lastRenderAt = now;
      const percentEl = overlay.querySelector("#storageDownloadProgressPercent");
      const fill = overlay.querySelector("#storageDownloadProgressFill");
      const bar = overlay.querySelector("#storageDownloadProgressBar");
      const status = overlay.querySelector("#storageDownloadProgressStatus");
      const bytes = overlay.querySelector("#storageDownloadProgressBytes");
      const eta = overlay.querySelector("#storageDownloadProgressEta");
      if(percentEl) percentEl.textContent = percent + "%";
      if(fill) fill.style.width = percent + "%";
      if(bar) bar.setAttribute("aria-valuenow", String(percent));
      if(status && statusText) status.textContent = String(statusText);
      if(bytes) bytes.textContent =
        formatBytesCompact(loaded) + " / " + (total > 0 ? formatBytesCompact(total) : "--");
      if(eta){
        if(overlay.classList.contains("is-failed")){
          eta.textContent = "중단됨";
        }else if(total > 0 && loaded >= total){
          eta.textContent = "전송 완료";
        }else{
          const remaining = Math.max(0, total - loaded);
          const speed = storageDownloadProgressState.smoothedBytesPerSec;
          const estimateReady =
            total > 0 &&
            loaded > 0 &&
            speed > 0 &&
            storageDownloadProgressState.speedSampleCount >= 2;
          eta.textContent = estimateReady
            ? formatStorageDownloadEta(remaining / speed)
            : "계산 중…";
        }
      }
    }

    function showStorageDownloadProgress(item, statusText){
      const overlay = ensureStorageDownloadProgressOverlay();
      const label = getDataListItemDownloadLabel(item);
      const total = Math.max(0, Math.floor(Number(item && item.bytes) || 0));
      storageDownloadProgressState.active = true;
      storageDownloadProgressState.startedAt = Date.now();
      storageDownloadProgressState.lastPercent = -1;
      storageDownloadProgressState.lastRenderAt = 0;
      storageDownloadProgressState.lastLoadedBytes = 0;
      storageDownloadProgressState.lastSampleAt = 0;
      storageDownloadProgressState.smoothedBytesPerSec = 0;
      storageDownloadProgressState.speedSampleCount = 0;
      const file = overlay.querySelector("#storageDownloadProgressFile");
      const dialog = overlay.querySelector(".storage-download-progress-dialog");
      if(file) file.textContent = label.title;
      overlay.classList.remove("is-complete", "is-failed", "hidden");
      overlay.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("storage-download-active");
      updateStorageDownloadProgress(0, total, statusText || "다운로드 준비 중…", true);
      requestAnimationFrame(()=>{
        overlay.classList.add("is-open");
        if(dialog){
          try{ dialog.focus({preventScroll:true}); }catch(_e){ dialog.focus(); }
        }
      });
    }

    async function finishStorageDownloadProgress(success, totalBytes){
      if(!storageDownloadProgressState.active) return;
      const overlay = ensureStorageDownloadProgressOverlay();
      const total = Math.max(0, Math.floor(Number(totalBytes) || 0));
      overlay.classList.toggle("is-complete", !!success);
      overlay.classList.toggle("is-failed", !success);
      updateStorageDownloadProgress(
        success ? total : Math.max(0, Math.floor(total * Math.max(0, storageDownloadProgressState.lastPercent) / 100)),
        total,
        success ? "다운로드 완료" : "다운로드 실패",
        true
      );
      if(success && total === 0){
        const percentEl = overlay.querySelector("#storageDownloadProgressPercent");
        const fill = overlay.querySelector("#storageDownloadProgressFill");
        const bar = overlay.querySelector("#storageDownloadProgressBar");
        if(percentEl) percentEl.textContent = "100%";
        if(fill) fill.style.width = "100%";
        if(bar) bar.setAttribute("aria-valuenow", "100");
      }
      const minVisibleMs = success ? 420 : 760;
      const elapsed = Date.now() - storageDownloadProgressState.startedAt;
      if(elapsed < minVisibleMs) await delay(minVisibleMs - elapsed);
      overlay.classList.remove("is-open");
      await delay(180);
      storageDownloadProgressState.active = false;
      storageDownloadProgressState.startedAt = 0;
      storageDownloadProgressState.lastLoadedBytes = 0;
      storageDownloadProgressState.lastSampleAt = 0;
      storageDownloadProgressState.smoothedBytesPerSec = 0;
      storageDownloadProgressState.speedSampleCount = 0;
      overlay.classList.add("hidden");
      overlay.classList.remove("is-complete", "is-failed");
      overlay.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("storage-download-active");
    }

    function ensureDataDownloadConfirmOverlay(){
      let overlay = document.getElementById("dataDownloadConfirmOverlay");
      if(overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "dataDownloadConfirmOverlay";
      overlay.className = "mobile-chart-picker-overlay hidden";
      overlay.style.display = "none";
      overlay.innerHTML =
        '<div class="mobile-chart-picker-dialog agent-help-dialog data-download-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dataDownloadConfirmTitle" aria-describedby="dataDownloadConfirmText">' +
          '<div class="mobile-chart-picker-head">' +
            '<div id="dataDownloadConfirmTitle" class="mobile-chart-picker-title">저장 기록 다운로드</div>' +
            '<button id="dataDownloadConfirmClose" class="mobile-chart-picker-close" type="button" aria-label="닫기">×</button>' +
          '</div>' +
          '<div class="mobile-chart-picker-body">' +
            '<p id="dataDownloadConfirmText" class="data-reset-warning">이 저장 기록을 다운로드할까요?</p>' +
            '<p id="dataDownloadConfirmNote" class="data-reset-note"></p>' +
            '<div class="data-reset-actions">' +
              '<button id="dataDownloadConfirmOk" class="data-reset-hold" type="button">다운로드</button>' +
              '<button id="dataDownloadConfirmCancel" class="data-reset-cancel" type="button">취소</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      return overlay;
    }

    function confirmDataListDownload(item){
      const overlay = ensureDataDownloadConfirmOverlay();
      const desktopDialog = isDesktopLayout() && !isMobileLayout();
      overlay.classList.toggle("is-desktop-download-dialog", desktopDialog);
      overlay.classList.toggle("is-mobile-download-dialog", !desktopDialog);
      const label = getDataListItemDownloadLabel(item);
      const text = overlay.querySelector("#dataDownloadConfirmText");
      const note = overlay.querySelector("#dataDownloadConfirmNote");
      const okBtn = overlay.querySelector("#dataDownloadConfirmOk");
      const cancelBtn = overlay.querySelector("#dataDownloadConfirmCancel");
      const closeBtn = overlay.querySelector("#dataDownloadConfirmClose");
      if(text) text.textContent = "\"" + label.title + "\" 저장 기록을 다운로드할까요?";
      if(note) note.textContent = label.note;
      overlay.classList.remove("hidden");
      overlay.style.display = "flex";
      requestAnimationFrame(()=>overlay.classList.add("is-open"));
      return new Promise((resolve)=>{
        let done = false;
        const finish = (ok)=>{
          if(done) return;
          done = true;
          overlay.classList.remove("is-open");
          setTimeout(()=>{
            if(overlay.classList.contains("is-open")) return;
            overlay.classList.add("hidden");
            overlay.style.display = "none";
          }, 220);
          if(okBtn) okBtn.onclick = null;
          if(cancelBtn) cancelBtn.onclick = null;
          if(closeBtn) closeBtn.onclick = null;
          overlay.onclick = null;
          resolve(!!ok);
        };
        if(okBtn) okBtn.onclick = ()=>finish(true);
        if(cancelBtn) cancelBtn.onclick = ()=>finish(false);
        if(closeBtn) closeBtn.onclick = ()=>finish(false);
        overlay.onclick = (ev)=>{ if(ev.target === overlay) finish(false); };
      });
    }

    function renderDataListItems(overlay){
      if(!overlay) return;
      const body = overlay.querySelector("#dataListBody");
      if(!body) return;
      const selectedView = getDataListView(overlay._originFilter);
      const detailsOpen = !!overlay._dataListDetailsOpen || !!overlay._downloadSelectMode;
      let boardItems = (Array.isArray(overlay._boardItems) ? overlay._boardItems : [])
        .filter((item)=>selectedView === "avionics" && String(item && item.origin || "").toLowerCase() === "avionics");
      const stageNodes = remoteStorageStageNodes();
      const stageSelectionActive =
        isFlashLinkGroundStorageUi() &&
        stageNodes.length > 1;
      const selectedStage = selectedRemoteStorageStage(overlay);
      if(stageSelectionActive){
        boardItems = boardItems.filter((item)=>
          normalizeStorageStageNode(item.storageStage || item.stage_node) === selectedStage
        );
      }
      let appItems = (Array.isArray(overlay._appItems) ? overlay._appItems : [])
        .filter(()=>selectedView === "app");
      const defaultGroup = selectedView === "app"
        ? "app"
        : ("board-stage-" + String(selectedStage || 1));
      const expandedGroup = detailsOpen
        ? String(overlay._dataListExpandedGroup || defaultGroup)
        : "";
      if(detailsOpen){
        overlay._dataListExpandedGroup = expandedGroup;
        if(expandedGroup === "app"){
          boardItems = [];
        }else{
          appItems = [];
          const groupStageMatch = expandedGroup.match(/^board-stage-([12])$/);
          const groupStage = groupStageMatch
            ? normalizeStorageStageNode(groupStageMatch[1])
            : 0;
          if(groupStage){
            boardItems = boardItems.filter((item)=>{
              const itemStage = normalizeStorageStageNode(item.storageStage || item.stage_node);
              return itemStage === groupStage || (!itemStage && stageNodes.length === 1);
            });
          }
        }
      }
      const visibleItems = boardItems.concat(appItems);
      overlay._dataItems = visibleItems;
      const previewLimit = 3;
      overlay.classList.toggle("is-data-list-expanded", detailsOpen);
      const title = overlay.querySelector("#dataListTitle");
      const back = overlay.querySelector("#dataListBackBtn");
      if(title){
        const expandedStageMatch = expandedGroup.match(/^board-stage-([12])$/);
        title.textContent = !detailsOpen
          ? "저장공간"
          : (expandedGroup === "app"
              ? "APP 비행 데이터"
              : ("STAGE " + String(expandedStageMatch ? expandedStageMatch[1] : selectedStage || 1) + " 비행 데이터"));
      }
      if(back) back.hidden = !detailsOpen;
      if(!detailsOpen) body.scrollTop = 0;

      const escapeHtml = (text)=>String(text).replace(/[&<>"']/g, (ch)=>({
        "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
      }[ch]));
      const renderMoreButton = (hiddenCount, group)=>{
        if(detailsOpen || hiddenCount <= 0) return "";
        return '<button class="data-list-more" type="button" data-data-list-more="' + escapeHtml(group) + '">' +
          '데이터 전체 보기' +
        '</button>';
      };
      const boardEmptyTextFor = (stageNode)=>{
        const stageError = stageNode &&
          overlay._remoteStageError &&
          overlay._remoteStageError[stageNode];
        if(stageError) return stageNode + '단 저장 기록을 다시 동기화하는 중입니다…';
        if(overlay._boardError) return '에비오닉스 보드 저장공간은 연결 후 확인할 수 있습니다.';
        return stageNode
          ? stageNode + '단 저장공간에 저장된 기록이 없습니다.'
          : '에비오닉스 저장공간에 저장된 기록이 없습니다.';
      };
      const renderBoardRows = (items, stageNode)=>{
        if(!items.length){
          return '<p class="data-storage-empty data-storage-empty--stage">' +
            escapeHtml(boardEmptyTextFor(stageNode)) +
          '</p>';
        }
        const visible = items.slice().reverse().slice(0, detailsOpen ? items.length : previewLimit);
        return visible.map((item)=>{
          const name = String(item.name || "DATA");
          const records = Math.max(0, Number(item.records || 0));
          const bytes = formatBytesCompact(item.bytes || 0);
          const itemStage = normalizeStorageStageNode(item.storageStage || item.stage_node);
          const stageText = itemStage ? ("STAGE " + itemStage + " · ") : "";
          const currentText = Number(item.current || 0) ? " · 현재 기록 중" : "";
          return '<button class="agent-help-issue data-list-item" type="button" data-data-key="' + escapeHtml(item.dataKey) + '">' +
            '<span class="agent-help-dot" aria-hidden="true"></span><span>' +
            '<span class="agent-help-issue-title">' + escapeHtml(name) + '</span>' +
            '<span class="agent-help-issue-sub">' + stageText + 'AVIONICS BIN · 레코드 ' + records.toLocaleString("ko-KR") + '개 · ' + bytes + currentText + '</span>' +
            '</span><span class="agent-help-chevron" aria-hidden="true">›</span></button>';
        }).join("") +
          renderMoreButton(Math.max(0, items.length - previewLimit), "board-stage-" + String(stageNode || 0));
      };
      const boardHtml = renderBoardRows(
        boardItems,
        stageSelectionActive ? selectedStage : 0
      );
      const appHtml = appItems.length
        ? appItems.slice(0, detailsOpen ? appItems.length : previewLimit).map((item)=>{
            const started = new Date(Number(item.startedAt || 0));
            const title = isNaN(started.getTime())
              ? String(item.id)
              : started.toLocaleString("ko-KR");
            const currentText = appDataSession && appDataSession.id === item.id
              ? " · 현재 기록 중"
              : "";
            return '<button class="agent-help-issue data-list-item" type="button" data-data-key="' + escapeHtml(item.dataKey) + '">' +
              '<span class="agent-help-dot" aria-hidden="true"></span><span>' +
              '<span class="agent-help-issue-title">' + escapeHtml(title) + '</span>' +
              '<span class="agent-help-issue-sub">APP BIN · 샘플 ' + Math.max(0, Number(item.sampleCount || 0)).toLocaleString("ko-KR") + '개 · ' + formatBytesCompact(item.bytes || 0) + currentText + '</span>' +
              '</span><span class="agent-help-chevron" aria-hidden="true">›</span></button>';
          }).join("") +
          renderMoreButton(Math.max(0, appItems.length - previewLimit), "app")
        : '<p class="data-storage-empty">APP BIN이 없습니다.</p>';
      body.innerHTML = selectedView === "app" ? appHtml : boardHtml;

      overlay.querySelectorAll("[data-data-origin-filter]").forEach((button)=>{
        const active =
          getDataListView(button.getAttribute("data-data-origin-filter")) === selectedView;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      syncRemoteStorageStageSelector(overlay);
      syncDataStorageActionButtons();
    }

    function ensureDataListOverlay(){
      let overlay = document.getElementById("dataListOverlay");
      if(overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "dataListOverlay";
      overlay.className = "mobile-chart-picker-overlay hidden";
      overlay.style.display = "none";
      overlay.innerHTML =
        '<div class="mobile-chart-picker-dialog agent-help-dialog data-storage-dialog" role="dialog" aria-modal="true" aria-label="저장공간">' +
          '<div class="mobile-chart-picker-head">' +
            '<button id="dataListBackBtn" class="data-list-back" type="button" aria-label="저장공간 요약으로 돌아가기" hidden>‹</button>' +
            '<div id="dataListTitle" class="mobile-chart-picker-title">저장공간</div>' +
            '<button id="dataListCloseBtn" class="mobile-chart-picker-close" type="button" aria-label="닫기">×</button>' +
          '</div>' +
          '<div class="mobile-chart-picker-body data-storage-dialog-body">' +
            '<div class="data-storage-selector">' +
              '<div class="data-origin-filter" role="tablist" aria-label="저장공간 출처">' +
                '<button type="button" role="tab" aria-selected="false" data-data-origin-filter="app">APP</button>' +
                '<button class="is-active" type="button" role="tab" aria-selected="true" data-data-origin-filter="avionics">에비오닉스</button>' +
              '</div>' +
            '</div>' +
            '<section class="data-storage-surface">' +
              '<div class="data-storage-stage-selector" data-storage-stage-selector role="tablist" aria-label="에비오닉스 단 선택" hidden>' +
                '<button class="is-active" type="button" role="tab" aria-selected="true" data-storage-stage="1">STAGE 1</button>' +
                '<button type="button" role="tab" aria-selected="false" data-storage-stage="2">STAGE 2</button>' +
              '</div>' +
              '<div id="dataListSummary" class="agent-help-summary">저장공간 목록을 불러오는 중…</div>' +
              '<div id="dataListBody" class="agent-help-list" aria-live="polite"></div>' +
              '<div class="data-storage-actions">' +
                '<button id="dataStorageDownloadBtn" class="data-storage-download" type="button">다운로드</button>' +
                '<button id="dataStorageResetBtn" class="data-storage-reset" type="button">보드 초기화</button>' +
              '</div>' +
            '</section>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay._originFilter = "avionics";
      const setDocumentScrollLocked = (locked)=>{
        document.documentElement.classList.toggle("data-storage-modal-open", !!locked);
        if(document.body) document.body.classList.toggle("data-storage-modal-open", !!locked);
      };
      const close = ()=>{
        stopDataListLiveStatus();
        setDocumentScrollLocked(false);
        overlay._downloadSelectMode = false;
        overlay._dataListDetailsOpen = false;
        overlay._dataListExpandedGroup = "";
        overlay.classList.remove("is-data-list-expanded");
        overlay.classList.remove("is-open");
        setTimeout(()=>{
          overlay.classList.add("hidden");
          overlay.style.display = "none";
        }, 220);
      };
      overlay.addEventListener("click", (ev)=>{ if(ev.target === overlay) close(); });
      const preventOverviewScroll = (ev)=>{
        const expanded = overlay.classList.contains("is-data-list-expanded");
        const recordList = ev.target && ev.target.closest
          ? ev.target.closest("#dataListBody")
          : null;
        if(expanded && recordList) return;
        ev.preventDefault();
      };
      overlay.addEventListener("wheel", preventOverviewScroll, {passive:false});
      overlay.addEventListener("touchmove", preventOverviewScroll, {passive:false});
      overlay._setDocumentScrollLocked = setDocumentScrollLocked;
      const closeBtn = overlay.querySelector("#dataListCloseBtn");
      if(closeBtn) closeBtn.addEventListener("click", close);
      const backBtn = overlay.querySelector("#dataListBackBtn");
      if(backBtn){
        backBtn.addEventListener("click", ()=>{
          overlay._downloadSelectMode = false;
          overlay._dataListDetailsOpen = false;
          overlay._dataListExpandedGroup = "";
          const download = overlay.querySelector("#dataStorageDownloadBtn");
          if(download) download.textContent = "다운로드";
          renderDataListSummary(
            overlay.querySelector("#dataListSummary"),
            overlay._boardInfo || {},
            Array.isArray(overlay._appSessions) ? overlay._appSessions : [],
            overlay._originFilter,
            overlay._remoteStageInfo,
            overlay._remoteStageError
          );
          renderDataListItems(overlay);
        });
      }
      overlay.querySelectorAll("[data-data-origin-filter]").forEach((button)=>{
        button.addEventListener("click", ()=>{
          overlay._originFilter =
            button.getAttribute("data-data-origin-filter") === "avionics"
              ? "avionics"
              : "app";
          overlay._downloadSelectMode = false;
          overlay._dataListDetailsOpen = false;
          overlay._dataListExpandedGroup = "";
          const download = overlay.querySelector("#dataStorageDownloadBtn");
          if(download) download.textContent = "다운로드";
          renderDataListSummary(
            overlay.querySelector("#dataListSummary"),
            overlay._boardInfo || {},
            Array.isArray(overlay._appSessions) ? overlay._appSessions : [],
            overlay._originFilter,
            overlay._remoteStageInfo,
            overlay._remoteStageError
          );
          renderDataListItems(overlay);
        });
      });
      overlay.querySelectorAll("[data-storage-stage]").forEach((button)=>{
        button.addEventListener("click", ()=>{
          const stageNode = normalizeStorageStageNode(
            button.getAttribute("data-storage-stage")
          );
          if(!stageNode || stageNode === selectedRemoteStorageStage(overlay)) return;
          overlay._selectedStorageStage = stageNode;
          overlay._downloadSelectMode = false;
          overlay._dataListDetailsOpen = false;
          overlay._dataListExpandedGroup = "";
          const download = overlay.querySelector("#dataStorageDownloadBtn");
          if(download) download.textContent = "다운로드";
          renderDataListSummary(
            overlay.querySelector("#dataListSummary"),
            overlay._boardInfo || {},
            Array.isArray(overlay._appSessions) ? overlay._appSessions : [],
            overlay._originFilter,
            overlay._remoteStageInfo,
            overlay._remoteStageError
          );
          renderDataListItems(overlay);
        });
      });
      const downloadBtn = overlay.querySelector("#dataStorageDownloadBtn");
      if(downloadBtn){
        downloadBtn.addEventListener("click", ()=>{
          if(downloadBtn.disabled) return;
          const items = Array.isArray(overlay._dataItems) ? overlay._dataItems : [];
          if(!items.length){
            showToast("다운로드할 저장 기록이 없습니다.", "notice", {key:"storage-download-empty"});
            return;
          }
          stopDataListLiveStatus();
          overlay._downloadSelectMode = true;
          overlay._dataListDetailsOpen = true;
          overlay._dataListExpandedGroup = getDataListView(overlay._originFilter) === "app"
            ? "app"
            : ("board-stage-" + String(selectedRemoteStorageStage(overlay) || 1));
          renderDataListItems(overlay);
          downloadBtn.textContent = "저장 기록을 선택하세요";
          const summary = overlay.querySelector("#dataListSummary");
          if(summary) summary.textContent = "다운로드할 저장 기록을 선택하세요.";
          overlay.querySelectorAll(".data-list-item").forEach(item=>item.classList.add("is-download-select"));
        });
      }
      const body = overlay.querySelector("#dataListBody");
      if(body){
        body.addEventListener("click", async(ev)=>{
          const moreBtn = ev.target && ev.target.closest ? ev.target.closest("[data-data-list-more]") : null;
          if(moreBtn){
            overlay._dataListDetailsOpen = true;
            overlay._dataListExpandedGroup = String(
              moreBtn.getAttribute("data-data-list-more") || ""
            );
            renderDataListItems(overlay);
            const listBody = overlay.querySelector("#dataListBody");
            if(listBody) listBody.scrollTop = 0;
            return;
          }
          const row = ev.target && ev.target.closest ? ev.target.closest(".data-list-item") : null;
          if(!row) return;
          const key = String(row.getAttribute("data-data-key") || "");
          const items = Array.isArray(overlay._dataItems) ? overlay._dataItems : [];
          const selected = items.find(item=>String(item && item.dataKey || "") === key);
          if(!selected) return;
          const confirmed = await confirmDataListDownload(selected);
          if(!confirmed) return;
          overlay._downloadSelectMode = false;
          overlay.querySelectorAll(".data-list-item").forEach(item=>item.classList.remove("is-download-select"));
          if(downloadBtn){
            downloadBtn.disabled = true;
            downloadBtn.textContent = "다운로드 준비 중…";
          }
          const totalBytes = Math.max(0, Math.floor(Number(selected && selected.bytes) || 0));
          let downloadSucceeded = false;
          showStorageDownloadProgress(
            selected,
            selected.kind === "app" ? "APP 기록 구성 중…" : "보드 연결 확인 중…"
          );
          try{
            if(selected.kind === "app"){
              updateStorageDownloadProgress(0, totalBytes, "APP 기록 구성 중…", true);
              await downloadAppDataSession(selected);
              updateStorageDownloadProgress(totalBytes, totalBytes, "파일 저장 준비 완료", true);
              downloadSucceeded = true;
            }else{
              downloadSucceeded = await downloadSpiFlashDump(selected);
            }
          }catch(err){
            const reason = (err && err.message) ? err.message : String(err || "unknown");
            const prefix = selected.kind === "app" ? "APP BIN" : "저장 기록";
            showToast(prefix + " 다운로드 실패: " + reason, "error", {key:"data-download-unhandled-fail"});
          }finally{
            await finishStorageDownloadProgress(downloadSucceeded, totalBytes);
            if(downloadBtn){
              downloadBtn.disabled = false;
              downloadBtn.textContent = "다운로드";
            }
            await showDataListOverlay();
          }
        });
      }
      const resetBtn = overlay.querySelector("#dataStorageResetBtn");
      if(resetBtn){
        resetBtn.addEventListener("click", ()=>{
          if(resetBtn.disabled || !canUseDataStorageActions()) return;
          showDataResetConfirmOverlay({
            origin:overlay._originFilter,
            stageNode:selectedRemoteStorageStage(overlay)
          });
        });
      }
      syncDataStorageActionButtons();
      return overlay;
    }

    async function showDataListOverlay(opts){
      const options = opts || {};
      const overlay = ensureDataListOverlay();
      const summary = overlay.querySelector("#dataListSummary");
      const body = overlay.querySelector("#dataListBody");
      const preferredOrigin = options.origin ? getDataListView(options.origin) : getPreferredDataListOrigin();
      const appOnly = false;
      overlay._originFilter = preferredOrigin;
      overlay._originLocked = false;
      overlay.classList.remove("is-avionics-only");
      overlay.classList.remove("hidden");
      overlay.style.display = "flex";
      if(typeof overlay._setDocumentScrollLocked === "function"){
        overlay._setDocumentScrollLocked(true);
      }
      overlay.scrollTop = 0;
      const dialogBody = overlay.querySelector(".data-storage-dialog-body");
      if(dialogBody) dialogBody.scrollTop = 0;
      if(body) body.scrollTop = 0;
      requestAnimationFrame(()=>overlay.classList.add("is-open"));
      syncDataStorageActionButtons();
      if(summary) summary.textContent = "저장공간 목록을 불러오는 중…";
      if(summary) summary.classList.remove("is-message");
      if(body) body.innerHTML = "";
      await flushAppDataSamples();
      const shouldLoadRemoteBoard = !appOnly && isFlashLinkGroundStorageUi();
      const shouldLoadLocalBoard = !appOnly && !shouldLoadRemoteBoard;
      const remoteNodes = shouldLoadRemoteBoard ? remoteStorageStageNodes() : [];
      const requestedStage = normalizeStorageStageNode(options.stage);
      if(remoteNodes.length > 1){
        const currentStage = normalizeStorageStageNode(overlay._selectedStorageStage);
        overlay._selectedStorageStage =
          remoteNodes.indexOf(requestedStage) >= 0
            ? requestedStage
            : (remoteNodes.indexOf(currentStage) >= 0 ? currentStage : remoteNodes[0]);
      }else if(remoteNodes.length === 1){
        overlay._selectedStorageStage = remoteNodes[0];
      }
      const remoteResultsPromise = (async()=>{
        const stageResults = {};
        for(const stageNode of remoteNodes){
          try{
            stageResults[stageNode] = {
              info:await fetchSpiFlashRemoteDataList(stageNode),
              error:null
            };
          }catch(error){
            stageResults[stageNode] = {info:null, error};
          }
        }
        return stageResults;
      })();
      const results = await Promise.all([
        shouldLoadLocalBoard
          ? fetchSpiFlashDataList()
              .then((info)=>({info, error:null}))
              .catch((error)=>({info:null, error}))
          : Promise.resolve({info:null, error:null}),
        listAppDataSessions(),
        remoteResultsPromise
      ]);
      const boardResult = results[0];
      const appSessions = results[1];
      const remoteStageResults = results[2] || {};
      const primaryRemoteNode = remoteNodes[0] || 1;
      const remoteBoardResult = remoteStageResults[primaryRemoteNode] || {info:null, error:null};
      const info = boardResult.info || {};
      const localBoardItems = shouldLoadLocalBoard ? (Array.isArray(info.items) ? info.items : []).map((item)=>Object.assign({}, item, {
        kind:"board",
        origin:"avionics",
        dataKey:"board-avionics:" + String(item.offset || 0)
      })) : [];
      const remoteInfo = remoteBoardResult.info || {};
      const remoteStageInfo = {};
      const remoteStageError = {};
      const remoteStageFailureCount = {};
      const remoteStageRetryAt = {};
      remoteNodes.forEach((stageNode)=>{
        const result = remoteStageResults[stageNode] || {info:null, error:null};
        if(result.info) remoteStageInfo[stageNode] = result.info;
        remoteStageError[stageNode] = result.error || null;
        remoteStageFailureCount[stageNode] = result.error ? 1 : 0;
        remoteStageRetryAt[stageNode] = result.error ? Date.now() + 800 : 0;
      });
      const remoteBoardItems = [];
      remoteNodes.forEach((stageNode)=>{
        if(remoteStageInfo[stageNode]){
          remoteBoardItems.push.apply(
            remoteBoardItems,
            normalizeRemoteDataListItems(remoteStageInfo[stageNode], stageNode)
          );
        }
      });
      const appItems = appSessions.map((item)=>Object.assign({}, item, {
        kind:"app",
        dataKey:"app:" + String(item.id)
      }));
      overlay._boardInfo = info;
      overlay._boardError = boardResult.error;
      overlay._remoteBoardInfo = remoteInfo;
      overlay._remoteBoardError = remoteBoardResult.error;
      overlay._remoteStageInfo = remoteStageInfo;
      overlay._remoteStageError = remoteStageError;
      overlay._remoteStageFailureCount = remoteStageFailureCount;
      overlay._remoteStageRetryAt = remoteStageRetryAt;
      overlay._remoteListPending = false;
      overlay._remoteListFailureCount = remoteBoardResult.error ? 1 : 0;
      overlay._remoteListRetryAt = remoteBoardResult.error ? Date.now() + 800 : 0;
      overlay._localBoardItems = localBoardItems;
      overlay._boardItems = remoteBoardItems.concat(localBoardItems);
      overlay._appItems = appItems;
      overlay._appSessions = appSessions;
      overlay._downloadSelectMode = false;
      overlay._dataListDetailsOpen = false;
      overlay._dataListExpandedGroup = "";
      overlay.classList.remove("is-data-list-expanded");
      renderDataListSummary(
        summary,
        info,
        appSessions,
        overlay._originFilter,
        overlay._remoteStageInfo,
        overlay._remoteStageError
      );
      if(shouldLoadRemoteBoard || boardResult.info || remoteBoardResult.info){
        startDataListLiveStatus(overlay, summary);
      }
      renderDataListItems(overlay);
    }

    function canUseSerialForSpiFlash(){
      return !!(serialConnected && serialTxEnabled);
    }

    const SPI_FLASH_SERIAL_CHUNK_BYTES = 8192;

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
        full: parseNumber("full", 0) ? 1 : 0,
        jedec: {
          mfr: parseNumber("mfr", 0),
          type: parseNumber("type", 0),
          cap_code: parseNumber("cap_code", 0)
        },
        capacity_bytes: parseNumber("capacity", 0),
        chip_capacity_bytes: parseNumber("chip_capacity", 0),
        model: String(fields.model || "W25Q256JVEIQ"),
        storage_kind: String(fields.kind || "external_spi_nor"),
        used_bytes: parseNumber("used", 0),
        queue_bytes: parseNumber("queue", 0),
        record_count: parseNumber("records", 0),
        dropped_records: parseNumber("dropped", 0),
        flush_count: parseNumber("flush", 0),
        session_count: parseNumber("sessions", 0),
        current_session_id: parseNumber("current_session", 0),
        current_file: String(fields.current_file || ""),
        record_hz: parseNumber("record_hz", 0),
        current_record_version: parseNumber("record_ver", 3),
        current_record_bytes: parseNumber("record_bytes", 68),
        selected_spi_hz: parseNumber("spi_hz", 0)
      };
    }

    function parseSpiFlashItemAckMessage(message){
      const raw = String(message || "").trim();
      const prefix = "SPI_FLASH_ITEM";
      if(raw.indexOf(prefix) !== 0) return null;
      const fields = {};
      const kvRegex = /([A-Za-z0-9_]+)=([^\s]+)/g;
      let match;
      while((match = kvRegex.exec(raw.slice(prefix.length)))){
        fields[String(match[1] || "").toLowerCase()] = String(match[2] || "");
      }
      const num = (key, fallback)=>{
        const value = Number(fields[key]);
        return isFinite(value) ? value : fallback;
      };
      const count = Math.max(0, Math.floor(num("count", 0)));
      if(count === 0) return {count, idx:0, item:null};
      const idx = Math.max(0, Math.floor(num("idx", 0)));
      return {
        count,
        idx,
        item:{
          name:String(fields.name || ("DATA-" + String(idx + 1).padStart(4, "0"))),
          offset:Math.max(0, Math.floor(num("off", 0))),
          bytes:Math.max(0, Math.floor(num("bytes", 0))),
          records:Math.max(0, Math.floor(num("records", 0))),
          session_id:Math.max(0, Math.floor(num("session", 0))),
          current:num("current", 0) ? 1 : 0,
          protocol:Math.max(0, Math.floor(num("protocol", 0))),
          timebase:Math.max(0, Math.floor(num("timebase", 0))),
          meta:Math.max(0, Math.floor(num("meta", 0))),
          build:Math.max(0, Math.floor(num("build", 0))),
          started_at_ms:Math.max(0, Math.floor(num("started", 0))),
          sync_id:Math.max(0, Math.floor(num("sync_id", 0))),
          sync_anchor_ms:Math.max(0, Math.floor(num("sync_anchor", 0))),
          stage_node:Math.max(0, Math.floor(num("stage_node", 0))),
          sync_version:Math.max(0, Math.floor(num("sync_version", 0))),
          sync_flags:Math.max(0, Math.floor(num("sync_flags", 0)))
        }
      };
    }

    function parseSpiFlashRemoteItemAckMessage(message){
      const raw = String(message || "").trim();
      const prefix = "SPI_FLASH_REMOTE_ITEM";
      if(raw.indexOf(prefix) !== 0) return null;
      const fields = {};
      const kvRegex = /([A-Za-z0-9_]+)=([^\s]+)/g;
      let match;
      while((match = kvRegex.exec(raw.slice(prefix.length)))){
        fields[String(match[1] || "").toLowerCase()] = String(match[2] || "");
      }
      const num = (key, fallback)=>{
        const value = Number(fields[key]);
        return isFinite(value) ? value : fallback;
      };
      const count = Math.max(0, Math.floor(num("count", 0)));
      const idx = Math.max(0, Math.floor(num("idx", 0)));
      const status = {
        stage_node:Math.max(0, Math.floor(num("node", 0))),
        ready:num("ready", 0) ? 1 : 0,
        capacity_bytes:Math.max(0, Math.floor(num("capacity", 0))),
        chip_capacity_bytes:Math.max(0, Math.floor(num("capacity", 0))),
        used_bytes:Math.max(0, Math.floor(num("used", 0))),
        record_count:Math.max(0, Math.floor(num("total_records", num("records", 0)))),
        record_hz:Math.max(1, Math.floor(num("record_hz", 200)))
      };
      if(count === 0) return {count, idx:0, item:null, status};
      return {
        count,
        idx,
        status,
        item:{
          name:String(fields.name || ("FLASH6_REMOTE_" + String(idx + 1).padStart(4, "0"))),
          offset:Math.max(0, Math.floor(num("off", 0))),
          bytes:Math.max(0, Math.floor(num("bytes", 0))),
          records:Math.max(0, Math.floor(num("records", 0))),
          session_id:Math.max(0, Math.floor(num("session", 0))),
          current:num("current", 0) ? 1 : 0,
          protocol:Math.max(0, Math.floor(num("protocol", 0))),
          timebase:Math.max(0, Math.floor(num("timebase", 0))),
          meta:Math.max(0, Math.floor(num("meta", 0))),
          build:Math.max(0, Math.floor(num("build", 0))),
          started_at_ms:Math.max(0, Math.floor(num("started", 0))),
          sync_id:Math.max(0, Math.floor(num("sync_id", 0))),
          sync_anchor_ms:Math.max(0, Math.floor(num("sync_anchor", 0))),
          stage_node:Math.max(0, Math.floor(num("stage_node", 0))),
          sync_version:Math.max(0, Math.floor(num("sync_version", 0))),
          sync_flags:Math.max(0, Math.floor(num("sync_flags", 0))),
          remote:true
        }
      };
    }

    async function fetchSpiFlashItemViaSerial(idx){
      const wantedIdx = Math.max(0, Math.floor(Number(idx) || 0));
      const waiter = createSerialAckWaiter((evt)=>{
        if(evt.kind === "err") return true;
        if(evt.kind !== "ack") return false;
        const parsed = parseSpiFlashItemAckMessage(evt.message);
        return !!parsed && (parsed.count === 0 || parsed.idx === wantedIdx);
      }, 2000);
      const wrote = await serialWriteLine("/storage/spi_flash/list?idx=" + wantedIdx);
      if(!wrote){
        cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
        throw new Error("SERIAL_WRITE_FAIL");
      }
      const reply = await waiter.promise;
      if(!reply.ok) throw new Error(reply.message || "SERIAL_LIST_FAIL");
      const parsed = parseSpiFlashItemAckMessage(reply.message);
      if(!parsed) throw new Error("SERIAL_LIST_PARSE_FAIL");
      return parsed;
    }

    async function fetchSpiFlashDataListViaSerial(){
      const info = await fetchSpiFlashStatusViaSerial();
      const first = await fetchSpiFlashItemViaSerial(0);
      const items = [];
      const totalCount = Math.max(0, first.count);
      const firstIdx = Math.max(0, totalCount - 32);
      if(first.item && firstIdx === 0) items.push(first.item);
      for(let idx = Math.max(1, firstIdx); idx < totalCount; idx++){
        const next = await fetchSpiFlashItemViaSerial(idx);
        if(next.item) items.push(next.item);
      }
      return Object.assign({}, info, {items, session_count:totalCount, listed_from:firstIdx});
    }

    async function fetchSpiFlashRemoteItemViaSerial(idx, requestedNodeId){
      const wantedIdx = Math.max(0, Math.floor(Number(idx) || 0));
      const stageNode = normalizeStorageStageNode(requestedNodeId);
      const waiter = createSerialAckWaiter((evt)=>{
        if(evt.kind === "err") return true;
        if(evt.kind !== "ack") return false;
        const parsed = parseSpiFlashRemoteItemAckMessage(evt.message);
        return !!parsed &&
          (!stageNode || Number(parsed.status && parsed.status.stage_node || 0) === stageNode) &&
          (parsed.count === 0 || parsed.idx === wantedIdx);
      }, 4200);
      const wrote = await serialWriteLine(
        "/storage/spi_flash/remote/list?idx=" + wantedIdx +
        (stageNode ? ("&node=" + stageNode) : "")
      );
      if(!wrote){
        cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
        throw new Error("SERIAL_WRITE_FAIL");
      }
      const reply = await waiter.promise;
      if(!reply.ok) throw new Error(reply.message || "SERIAL_REMOTE_LIST_FAIL");
      const parsed = parseSpiFlashRemoteItemAckMessage(reply.message);
      if(!parsed) throw new Error("SERIAL_REMOTE_LIST_PARSE_FAIL");
      return parsed;
    }

    async function fetchSpiFlashRemoteDataListViaSerial(requestedNodeId){
      const stageNode = normalizeStorageStageNode(requestedNodeId);
      const first = await fetchSpiFlashRemoteItemViaSerial(0, stageNode);
      const items = [];
      const totalCount = Math.max(0, first.count);
      const firstIdx = Math.max(0, totalCount - 32);
      if(first.item && firstIdx === 0) items.push(first.item);
      for(let idx = Math.max(1, firstIdx); idx < totalCount; idx++){
        const next = await fetchSpiFlashRemoteItemViaSerial(idx, stageNode);
        if(next.item) items.push(next.item);
      }
      const rawInfo = Object.assign({}, first.status || {}, {
        ok:1,
        remote:1,
        list_available:1,
        list_complete:1,
        stage_node:stageNode,
        session_count:totalCount,
        listed_from:firstIdx
      });
      const info = updateRemoteSpiFlashInfo(rawInfo, stageNode) || rawInfo;
      return Object.assign({}, info, {items});
    }

    function parseSpiFlashBulkChunkAckMessage(message, prefix){
      const raw = String(message || "").trim();
      if(raw.indexOf(prefix) !== 0) return null;
      const tail = raw.slice(prefix.length).trim();
      const b64Marker = " b64=";
      const b64At = tail.indexOf(b64Marker);
      if(b64At < 0) return null;
      const meta = tail.slice(0, b64At);
      const b64 = tail.slice(b64At + b64Marker.length).trim();
      const offMatch = meta.match(/(?:^|\s)off=(\d+)/);
      const lenMatch = meta.match(/(?:^|\s)len=(\d+)/);
      const off = offMatch ? Number(offMatch[1]) : NaN;
      const len = lenMatch ? Number(lenMatch[1]) : NaN;
      if(!isFinite(off) || off < 0 || !isFinite(len) || len <= 0 || !b64) return null;
      return {off:Math.floor(off), len:Math.floor(len), b64};
    }

    function parseSpiFlashChunkAckMessage(message){
      return parseSpiFlashBulkChunkAckMessage(message, "SPI_FLASH_CHUNK");
    }

    function parseSpiFlashRemoteChunkAckMessage(message){
      return parseSpiFlashBulkChunkAckMessage(message, "SPI_FLASH_REMOTE_CHUNK");
    }

    function decodeBase64ToBytes(b64, expectedBytes){
      const text = String(b64 || "").trim();
      if(!text) return new Uint8Array(0);
      const expected = Math.max(0, Math.floor(Number(expectedBytes) || 0));
      const expectedEncodedLength = expected > 0 ? (Math.ceil(expected / 3) * 4) : 0;
      if(
        (expectedEncodedLength > 0 && text.length !== expectedEncodedLength) ||
        (text.length % 4) !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(text) ||
        text.slice(0, -2).indexOf("=") >= 0
      ){
        throw new Error("SERIAL_CHUNK_BASE64_INVALID");
      }
      let bin = "";
      try{
        bin = atob(text);
      }catch(_err){
        throw new Error("SERIAL_CHUNK_BASE64_INVALID");
      }
      const out = new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++){
        out[i] = bin.charCodeAt(i) & 0xFF;
      }
      if(expected > 0 && out.length !== expected){
        throw new Error("SERIAL_CHUNK_SIZE_FAIL");
      }
      return out;
    }

    function buildSpiFlashBinHeader(info){
      const headerSize = 80;
      const dataBytes = Math.max(0, Number(info && info.used_bytes || 0)) >>> 0;
      const recordCount = Math.max(0, Number(info && info.record_count || 0)) >>> 0;
      let samplePeriodMs = Math.max(
        1,
        Number(info && info.sample_period_ms || 0) || 10
      );
      if(!(info && info.sample_period_ms) && Array.isArray(sampleHistory) && sampleHistory.length){
        const tail = sampleHistory[sampleHistory.length - 1];
        const lt = Number(tail && tail.lt);
        if(isFinite(lt) && lt > 0) samplePeriodMs = Math.max(1, Math.round(lt));
      }

      const header = new Uint8Array(headerSize);
      const dv = new DataView(header.buffer);
      const magic = "HWLOGV2";
      for(let i=0;i<magic.length;i++) header[i] = magic.charCodeAt(i);
      header[7] = 0;
      dv.setUint16(8, 4, true); // v4 adds dual-stage mission synchronization metadata
      dv.setUint16(10, headerSize, true);
      dv.setUint32(12, dataBytes, true);
      dv.setUint32(16, recordCount, true);
      dv.setUint32(20, (Date.now() >>> 0), true); // exportedAtMs
      dv.setUint32(24, (samplePeriodMs >>> 0), true);
      dv.setUint32(28, (REPLAY_BIN_RECORD_MARKER >>> 0), true);
      dv.setUint32(32, Math.max(0, Number(info && info.data_origin_code || 0)) >>> 0, true);
      dv.setUint32(36, Math.max(0, Number(info && info.app_source_tag || 0)) >>> 0, true);
      const protocolVersion = Math.max(
        0,
        Math.min(65535, Math.floor(Number(info && (info.protocol ?? info.protocol_version) || 0)))
      );
      const metadataFlags = Math.max(
        0,
        Math.min(65535, Math.floor(Number(info && (info.meta ?? info.metadata_flags) || 0)))
      );
      const metadataValid = protocolVersion > 0 && (metadataFlags & 1) !== 0;
      dv.setUint32(40, 0x32544D48, true); // HMT2
      const syncId = Math.max(0, Number(info && (info.sync_id ?? info.syncId) || 0)) >>> 0;
      const syncAnchorMs = Math.max(
        0,
        Number(info && (info.sync_anchor_ms ?? info.syncLocalAnchorMs) || 0)
      ) >>> 0;
      const stageNode = Math.max(
        0,
        Math.min(255, Math.floor(Number(info && (info.stage_node ?? info.stageNodeId) || 0)))
      );
      const syncVersion = Math.max(
        0,
        Math.min(255, Math.floor(Number(info && (info.sync_version ?? info.syncVersion) || 0)))
      );
      const syncFlags = Math.max(
        0,
        Math.min(65535, Math.floor(Number(info && (info.sync_flags ?? info.syncFlags) || 0)))
      );
      const syncValid = syncId > 0 && syncAnchorMs > 0 &&
        (stageNode === 1 || stageNode === 2) && syncVersion > 0;
      dv.setUint16(44, 2, true);
      dv.setUint16(46, (metadataValid ? 1 : 0) | (syncValid ? 2 : 0), true);
      dv.setUint32(
        48,
        metadataValid
          ? (Math.max(0, Number(info && (info.session_id ?? info.sessionId) || 0)) >>> 0)
          : 0,
        true
      );
      dv.setUint16(52, metadataValid ? protocolVersion : 0, true);
      dv.setUint16(
        54,
        metadataValid
          ? Math.max(0, Math.min(65535, Math.floor(Number(info && info.build || 0))))
          : 0,
        true
      );
      dv.setUint8(
        56,
        metadataValid
          ? Math.max(0, Math.min(255, Math.floor(Number(info && info.timebase || 0))))
          : 0
      );
      dv.setUint8(57, REPLAY_PROTOCOL_COMPATIBLE_MIN);
      dv.setUint8(58, REPLAY_PROTOCOL_COMPATIBLE_MAX);
      dv.setUint32(64, syncValid ? syncId : 0, true);
      dv.setUint32(68, syncValid ? syncAnchorMs : 0, true);
      dv.setUint8(72, syncValid ? stageNode : 0);
      dv.setUint8(73, syncValid ? syncVersion : 0);
      dv.setUint16(74, syncValid ? syncFlags : 0, true);
      dv.setUint32(76, 0, true);
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
      let lastErr = null;
      for(let attempt = 0; attempt < 4; attempt++){
        const waiter = createSerialAckWaiter((evt)=>{
          const message = String(evt.message || "");
          if(evt.kind === "err"){
            return message.indexOf("SPI_FLASH_READ") === 0 ||
              message.indexOf("SPI_FLASH_CHUNK") === 0;
          }
          return evt.kind === "ack" && message.indexOf("SPI_FLASH_CHUNK") === 0;
        }, 6500);
        const wrote = await serialWriteLine(cmd, {log:false, timeoutMs:2400});
        if(!wrote){
          cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
        }
        const reply = await waiter.promise;
        try{
          if(!reply.ok){
            throw new Error(reply.message || reply.kind || "SERIAL_CHUNK_FAIL");
          }
          const chunk = parseSpiFlashChunkAckMessage(reply.message);
          if(!chunk) throw new Error("SERIAL_CHUNK_PARSE_FAIL");
          if(chunk.off !== offInt || chunk.len <= 0 || chunk.len > lenInt){
            throw new Error("SERIAL_CHUNK_MISMATCH");
          }
          return decodeBase64ToBytes(chunk.b64, chunk.len);
        }catch(err){
          lastErr = err;
          const reason = String(err && err.message || err || "");
          if(
            reason.indexOf("SERIAL_DISCONNECTED") >= 0 ||
            reason.indexOf("SERIAL_NOT_READY") >= 0 ||
            reason.indexOf("SERIAL_TX_DISABLED") >= 0
          ){
            throw err;
          }
          if(attempt < 3){
            if(el.spiFlashStatusLine){
              el.spiFlashStatusLine.textContent =
                "손상된 USB 청크 재요청 중... " + (attempt + 2) + "/4";
            }
            await delay(60 + attempt * 100);
          }
        }
      }
      throw (lastErr || new Error("SERIAL_CHUNK_FAIL"));
    }

    async function fetchSpiFlashRemoteChunkViaSerial(off, len, requestedNodeId){
      if(!canUseSerialForSpiFlash()){
        throw new Error("SERIAL_NOT_READY");
      }
      const offInt = Math.max(0, Math.floor(Number(off) || 0));
      const lenInt = Math.max(1, Math.min(SPI_FLASH_REMOTE_CHUNK_BYTES, Math.floor(Number(len) || 0)));
      const stageNode = normalizeStorageStageNode(requestedNodeId);
      const cmd = "/storage/spi_flash/remote/read?off=" + offInt + "&len=" + lenInt +
        (stageNode ? ("&node=" + stageNode) : "");
      let lastErr = null;
      for(let attempt = 0; attempt < 4; attempt++){
        const waiter = createSerialAckWaiter((evt)=>{
          const message = String(evt.message || "");
          if(evt.kind === "err"){
            return message.indexOf("SPI_FLASH_REMOTE_CHUNK") === 0;
          }
          return evt.kind === "ack" &&
            message.indexOf("SPI_FLASH_REMOTE_CHUNK") === 0;
        }, 6500);
        const wrote = await serialWriteLine(cmd, {log:false, timeoutMs:2400});
        if(!wrote){
          cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
        }
        const reply = await waiter.promise;
        try{
          if(!reply.ok){
            throw new Error(reply.message || reply.kind || "SERIAL_REMOTE_CHUNK_FAIL");
          }
          const chunk = parseSpiFlashRemoteChunkAckMessage(reply.message);
          if(!chunk) throw new Error("SERIAL_REMOTE_CHUNK_PARSE_FAIL");
          if(chunk.off !== offInt || chunk.len <= 0 || chunk.len > lenInt){
            throw new Error("SERIAL_REMOTE_CHUNK_MISMATCH");
          }
          const bytes = decodeBase64ToBytes(chunk.b64, chunk.len);
          return bytes;
        }catch(err){
          lastErr = err;
          const reason = String(err && err.message || err || "");
          if(
            reason.indexOf("SERIAL_DISCONNECTED") >= 0 ||
            reason.indexOf("SERIAL_NOT_READY") >= 0 ||
            reason.indexOf("SERIAL_TX_DISABLED") >= 0
          ){
            throw err;
          }
          if(attempt < 3){
            if(el.spiFlashStatusLine){
              el.spiFlashStatusLine.textContent =
                "A.I LINK 청크 재요청 중... " + (attempt + 2) + "/4";
            }
            await delay(90 + attempt * 140);
          }
        }
      }
      throw (lastErr || new Error("SERIAL_REMOTE_CHUNK_FAIL"));
    }

    async function downloadSpiFlashDumpViaSerial(selectedItem){
      const info = await fetchSpiFlashStatusViaSerial();
      const dataBytes = Math.max(0, Number(selectedItem && selectedItem.bytes || 0));
      const baseOffset = Math.max(0, Number(selectedItem && selectedItem.offset || 0));
      const recordCount = Math.max(0, Number(selectedItem && selectedItem.records || 0));
      if(!dataBytes) throw new Error("EMPTY_DATA");
      const header = buildSpiFlashBinHeader(Object.assign(
        {},
        info,
        selectedItem || {},
        {used_bytes:dataBytes, record_count:recordCount}
      ));
      const fileBytes = new Uint8Array(header.byteLength + dataBytes);
      fileBytes.set(header, 0);
      let off = 0;
      const dataDownloadBtn = document.getElementById("dataStorageDownloadBtn");
      updateStorageDownloadProgress(0, dataBytes, "USB 시리얼 전송 중…", true);
      while(off < dataBytes){
        const len = Math.min(SPI_FLASH_SERIAL_CHUNK_BYTES, dataBytes - off);
        const bytes = await fetchSpiFlashChunkViaSerial(baseOffset + off, len);
        if(!bytes.byteLength) throw new Error("SERIAL_EMPTY_CHUNK");
        fileBytes.set(bytes, header.byteLength + off);
        off += bytes.byteLength;
        const pct = dataBytes > 0 ? Math.floor((off * 100) / dataBytes) : 100;
        if(dataDownloadBtn) dataDownloadBtn.textContent = "다운로드 " + pct + "%";
        if(el.spiFlashStatusLine){
          el.spiFlashStatusLine.textContent = "SPI Flash BIN 시리얼 다운로드 중... " + pct + "%";
        }
        updateStorageDownloadProgress(off, dataBytes, "USB 시리얼 전송 중…");
      }

      updateStorageDownloadProgress(dataBytes, dataBytes, "파일 생성 중…", true);
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const blob = new Blob([fileBytes], {type:"application/octet-stream"});
      const safeName = String(selectedItem && selectedItem.name || "DATA").replace(/[^A-Za-z0-9_-]+/g, "_");
      downloadBlobAsFile(blob, safeName + "_" + ts + ".bin");
      showToast("SPI Flash BIN(Serial) 다운로드 완료", "success", {key:"spi-flash-dump-serial"});
    }

    async function fetchSpiFlashRemoteChunk(off, len, requestedNodeId){
      const stageNode = normalizeStorageStageNode(requestedNodeId);
      if(canUseSerialForSpiFlash()){
        try{
          return await fetchSpiFlashRemoteChunkViaSerial(off, len, stageNode);
        }catch(serialErr){
          if(serialEnabled) throw serialErr;
        }
      }else if(serialEnabled){
        if(!serialConnected) throw new Error("SERIAL_DISCONNECTED");
        if(!serialTxEnabled) throw new Error("SERIAL_TX_DISABLED");
        throw new Error("SERIAL_NOT_READY");
      }
      const API_BASE = getApiBaseForCommands();
      const offInt = Math.max(0, Math.floor(Number(off) || 0));
      const lenInt = Math.max(1, Math.min(SPI_FLASH_REMOTE_CHUNK_BYTES, Math.floor(Number(len) || 0)));
      const url = (API_BASE ? API_BASE : "") + "/storage/spi_flash/remote/read?off=" + offInt +
        "&len=" + lenInt + (stageNode ? ("&node=" + stageNode) : "");
      let lastErr = null;
      for(let attempt = 0; attempt < 4; attempt++){
        const ctrl = createAbortControllerSafe();
        const timer = ctrl ? setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, 5500) : null;
        const opt = API_BASE
          ? Object.assign({cache:"no-store", mode:"cors"}, ctrl ? {signal:ctrl.signal} : {})
          : Object.assign({cache:"no-store"}, ctrl ? {signal:ctrl.signal} : {});
        try{
          const res = await fetch(url, opt);
          if(!res.ok){
            const text = await res.text();
            throw new Error(text || ("HTTP " + res.status));
          }
          const json = await res.json();
          const gotOff = Math.max(0, Number(json && json.off || 0));
          const gotLen = Math.max(0, Number(json && json.len || 0));
          if(gotOff !== offInt || gotLen <= 0 || gotLen > lenInt || !json.b64){
            throw new Error("REMOTE_CHUNK_MISMATCH");
          }
          const bytes = decodeBase64ToBytes(json.b64, gotLen);
          return bytes;
        }catch(err){
          lastErr = err;
          await delay(60 + attempt * 120);
        }finally{
          if(timer) clearTimeout(timer);
        }
      }
      throw (lastErr || new Error("REMOTE_CHUNK_FAIL"));
    }

    async function downloadSpiFlashDumpViaFlashLink(selectedItem){
      const dataBytes = Math.max(0, Number(selectedItem && selectedItem.bytes || 0));
      const baseOffset = Math.max(0, Number(selectedItem && selectedItem.offset || 0));
      const recordCount = Math.max(0, Number(selectedItem && selectedItem.records || 0));
      const stageNode = normalizeStorageStageNode(
        selectedItem && (selectedItem.storageStage || selectedItem.stage_node)
      );
      if(!dataBytes) throw new Error("EMPTY_DATA");
      const stageStorageInfo = stageNode
        ? latestAvionicsStorageByStage[stageNode]
        : latestAvionicsStorageInfo;
      const recordHz = Math.max(1, Number((stageStorageInfo && stageStorageInfo.record_hz) || 200));
      const header = buildSpiFlashBinHeader(Object.assign(
        {},
        stageStorageInfo || {},
        selectedItem || {},
        {
          used_bytes:dataBytes,
          record_count:recordCount,
          sample_period_ms:Math.max(1, Math.round(1000 / recordHz)),
          data_origin_code:1
        }
      ));
      const fileBytes = new Uint8Array(header.byteLength + dataBytes);
      fileBytes.set(header, 0);
      const dataDownloadBtn = document.getElementById("dataStorageDownloadBtn");
      let off = 0;
      updateStorageDownloadProgress(0, dataBytes, "A.I LINK 데이터 수신 중…", true);
      while(off < dataBytes){
        const len = Math.min(SPI_FLASH_REMOTE_CHUNK_BYTES, dataBytes - off);
        const bytes = await fetchSpiFlashRemoteChunk(baseOffset + off, len, stageNode);
        if(!bytes.byteLength) throw new Error("REMOTE_EMPTY_CHUNK");
        fileBytes.set(bytes, header.byteLength + off);
        off += bytes.byteLength;
        const pct = dataBytes > 0 ? Math.floor((off * 100) / dataBytes) : 100;
        if(dataDownloadBtn) dataDownloadBtn.textContent = "무선 다운로드 " + pct + "%";
        if(el.spiFlashStatusLine){
          el.spiFlashStatusLine.textContent = "에비오닉스 BIN 무선 다운로드 중... " + pct + "%";
        }
        updateStorageDownloadProgress(off, dataBytes, "A.I LINK 데이터 수신 중…");
        if((off % (SPI_FLASH_REMOTE_CHUNK_BYTES * 12)) === 0) await delay(0);
      }

      updateStorageDownloadProgress(dataBytes, dataBytes, "파일 생성 중…", true);
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const blob = new Blob([fileBytes], {type:"application/octet-stream"});
      const safeName = String(selectedItem && selectedItem.name || "FLASH6_AVIONICS").replace(/[^A-Za-z0-9_-]+/g, "_");
      downloadBlobAsFile(blob, safeName + "_" + ts + ".bin");
      showToast("에비오닉스 BIN 무선 다운로드 완료", "success", {key:"spi-flash-dump-remote"});
    }

    async function fetchSpiFlashStatus(opts){
      const force = !!(opts && opts.force);
      const recentSerialStream =
        serialEnabled &&
        serialConnected &&
        lastSerialSampleAt > 0 &&
        (Date.now() - lastSerialSampleAt) < 1800;
      if(!force && recentSerialStream){
        const cachedInfo = latestSpiFlashStorageInfo;
        if(cachedInfo && isFinite(getSpiFlashUsedPercent(cachedInfo))){
          syncStoragePreview();
          return cachedInfo;
        }
        return null;
      }
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
      const ctrl = createAbortControllerSafe();
      const timer = ctrl ? setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, 3500) : null;
      const opt = API_BASE
        ? Object.assign({cache:"no-store", mode:"cors"}, ctrl ? {signal:ctrl.signal} : {})
        : Object.assign({cache:"no-store"}, ctrl ? {signal:ctrl.signal} : {});
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
        if(timer) clearTimeout(timer);
      }
    }

    function ensureSpiFlashStateKnown(){
      if(spiFlashReadyState != null) return;
      const now = Date.now();
      if(spiFlashProbePending) return;
      if((now - spiFlashProbeLastMs) < 5000) return;
      spiFlashProbePending = true;
      spiFlashProbeLastMs = now;
      fetchSpiFlashStatus({background:true}).catch(()=>{}).finally(()=>{ spiFlashProbePending = false; });
    }

    function spiFlashResetStateComplete(info){
      if(!info || !info.ready) return false;
      const used = Math.max(0, Number(info.used_bytes || 0));
      const records = Math.max(0, Number(info.record_count || info.records || 0));
      const loggingKnown = info.logging != null && isFinite(Number(info.logging));
      return used === 0 && records === 0 &&
        (!loggingKnown || Number(info.logging) === 0);
    }

    async function refreshRemoteSpiFlashStatus(stageNode){
      const node = normalizeStorageStageNode(stageNode);
      const API_BASE = getApiBaseForCommands();
      const nodeQuery = node ? ("?node=" + node) : "";
      const url = (API_BASE ? API_BASE : "") +
        "/storage/spi_flash/remote/status" + nodeQuery;
      const ctrl = createAbortControllerSafe();
      const timer = ctrl
        ? setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, 3000)
        : null;
      const opt = API_BASE
        ? Object.assign(
            {cache:"no-store", mode:"cors"},
            ctrl ? {signal:ctrl.signal} : {}
          )
        : Object.assign(
            {cache:"no-store"},
            ctrl ? {signal:ctrl.signal} : {}
          );
      try{
        const res = await fetch(url, opt);
        if(!res.ok) return null;
        const info = await res.json();
        return updateRemoteSpiFlashInfo(info, node);
      }catch(_err){
        return null;
      }finally{
        if(timer) clearTimeout(timer);
      }
    }

    async function waitForSpiFlashResetCompletion(target, timeoutMs){
      const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 8000);
      let nextRemoteProbeAt = 0;
      while(Date.now() < deadline){
        let info = null;
        if(target.remote){
          info = target.stageNode
            ? latestAvionicsStorageByStage[target.stageNode]
            : latestAvionicsStorageInfo;
          if(Date.now() >= nextRemoteProbeAt){
            nextRemoteProbeAt = Date.now() + 700;
            info = await refreshRemoteSpiFlashStatus(target.stageNode) || info;
          }
        }else{
          info = await fetchSpiFlashStatus({force:true});
        }
        if(spiFlashResetStateComplete(info)) return true;
        await delay(target.remote ? 280 : 180);
      }
      return false;
    }

    async function sendSpiFlashResetSerial(target){
      const waiter = createSerialAckWaiter((evt)=>{
        if(evt.kind === "err") return true;
        if(evt.kind !== "ack") return false;
        const message = String(evt.message || "");
        if(message.indexOf("SPI_FLASH_INIT_OK") === 0) return true;
        return target.remote &&
          message.indexOf("FLASH_LINK_COMMAND_QUEUED") === 0;
      }, target.remote ? 5500 : 180000);
      const nodeQuery = target.remote && target.stageNode
        ? ("?node=" + target.stageNode)
        : "";
      const wrote = await serialWriteLine(
        "/storage/spi_flash/init" + nodeQuery
      );
      if(!wrote){
        cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
        throw new Error("SERIAL_WRITE_FAIL");
      }
      const reply = await waiter.promise;
      if(!reply.ok){
        throw new Error(reply.message || reply.kind || "SERIAL_FAIL");
      }
      return true;
    }

    async function sendSpiFlashResetHttp(target){
      const API_BASE = getApiBaseForCommands();
      const nodeQuery = target.remote && target.stageNode
        ? ("?node=" + target.stageNode)
        : "";
      const url = (API_BASE ? API_BASE : "") +
        "/storage/spi_flash/init" + nodeQuery;
      const ctrl = createAbortControllerSafe();
      const timeoutMs = target.remote ? 6500 : 180000;
      const timer = ctrl
        ? setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, timeoutMs)
        : null;
      const opt = API_BASE
        ? Object.assign(
            {method:"POST", mode:"cors"},
            ctrl ? {signal:ctrl.signal} : {}
          )
        : Object.assign(
            {method:"POST"},
            ctrl ? {signal:ctrl.signal} : {}
          );
      try{
        const res = await fetch(url, opt);
        if(!res.ok){
          const text = await res.text();
          throw new Error(text || ("HTTP " + res.status));
        }
        return true;
      }finally{
        if(timer) clearTimeout(timer);
      }
    }

    async function resetSpiFlashStorage(opts){
      const target = getSpiFlashResetTarget(opts);
      let streamPaused = false;
      let lastReason = "";
      try{
        if(canUseSerialForSpiFlash() && !target.remote){
          await setSerialStreamState(false);
          streamPaused = true;
          await delay(80);
        }

        for(let attempt = 0; attempt < 3; attempt++){
          let accepted = false;
          if(el.spiFlashStatusLine){
            el.spiFlashStatusLine.textContent =
              target.statusLabel + " 초기화 요청 중… " +
              (attempt + 1) + "/3";
          }

          if(canUseSerialForSpiFlash()){
            try{
              accepted = await sendSpiFlashResetSerial(target);
            }catch(err){
              lastReason = (err && err.message)
                ? err.message
                : String(err || "SERIAL_ERROR");
            }
          }

          if(!accepted){
            try{
              accepted = await sendSpiFlashResetHttp(target);
            }catch(err){
              const reason = (err && err.name === "AbortError")
                ? "HTTP_TIMEOUT"
                : ((err && err.message) ? err.message : String(err || "HTTP_ERROR"));
              lastReason = lastReason
                ? (lastReason + " / " + reason)
                : reason;
            }
          }

          if(accepted){
            if(el.spiFlashStatusLine){
              el.spiFlashStatusLine.textContent =
                target.statusLabel + " 초기화 적용 확인 중…";
            }
            const confirmed = await waitForSpiFlashResetCompletion(
              target,
              target.remote ? 9000 : 3500
            );
            if(confirmed){
              syncStoragePreview("0.0%", true);
              showToast(
                target.statusLabel + "를 초기화했습니다.",
                "success",
                {key:"spi-flash-init"}
              );
              return true;
            }
            lastReason = "RESET_STATE_NOT_CONFIRMED";
          }

          if(attempt < 2) await delay(250 + attempt * 250);
        }

        const reason = lastReason || "RESET_COMMAND_FAILED";
        showToast(
          target.label + " 초기화 실패: " + reason,
          "error",
          {key:"spi-flash-init-fail"}
        );
        if(!target.remote) updateSpiFlashStatusUi(null, reason);
        return false;
      }finally{
        if(streamPaused) await setSerialStreamState(true);
      }
    }

    async function readStorageDownloadResponseBlob(response, expectedBytes){
      const expected = Math.max(
        0,
        Math.floor(
          Number(response && response.headers && response.headers.get("Content-Length")) ||
          Number(expectedBytes) ||
          0
        )
      );
      if(!response.body || typeof response.body.getReader !== "function"){
        updateStorageDownloadProgress(0, expected, "파일 데이터 수신 중…", true);
        const blob = await response.blob();
        updateStorageDownloadProgress(blob.size, expected || blob.size, "파일 생성 중…", true);
        return blob;
      }
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      updateStorageDownloadProgress(0, expected, "파일 데이터 수신 중…", true);
      while(true){
        const result = await reader.read();
        if(result.done) break;
        if(result.value && result.value.byteLength){
          chunks.push(result.value);
          received += result.value.byteLength;
          updateStorageDownloadProgress(received, expected || received, "파일 데이터 수신 중…");
        }
      }
      const total = expected || received;
      updateStorageDownloadProgress(total, total, "파일 생성 중…", true);
      return new Blob(chunks, {
        type:String(response.headers.get("Content-Type") || "application/octet-stream")
      });
    }

    async function downloadSpiFlashDump(selectedItem){
      if(!selectedItem || !(Number(selectedItem.bytes) > 0)){
        showToast("다운로드할 저장 기록을 선택하세요.", "notice", {key:"storage-download-select"});
        return false;
      }
      const remoteTarget =
        !!(selectedItem && selectedItem.remote) ||
        (
          isFlashLinkGroundStorageUi() &&
          String(selectedItem && selectedItem.origin || "").toLowerCase() === "avionics"
        );
      if(remoteTarget){
        let streamPaused = false;
        try{
          if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "에비오닉스 BIN 무선 다운로드 준비 중...";
          if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = true;
          if(canUseSerialForSpiFlash()){
            streamPaused = await setSerialStreamState(false, {
              timeoutMs:1600,
              writeTimeoutMs:1200
            });
            if(streamPaused) await delay(25);
          }
          await downloadSpiFlashDumpViaFlashLink(selectedItem);
          return true;
        }catch(err){
          const reason = (err && err.name === "AbortError")
            ? "TIMEOUT - A.I LINK 연결 상태를 확인하세요"
            : ((err && err.message) ? err.message : String(err || "unknown"));
          showToast("에비오닉스 BIN 무선 다운로드 실패: " + reason, "error", {key:"spi-flash-dump-remote-fail"});
          if(el.spiFlashStatusLine){
            el.spiFlashStatusLine.textContent = "에비오닉스 BIN 무선 다운로드 실패: " + reason;
          }
          return false;
        }finally{
          if(streamPaused){
            await setSerialStreamState(true, {
              timeoutMs:1600,
              writeTimeoutMs:1200
            });
          }
          if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = false;
        }
      }
      if(canUseSerialForSpiFlash()){
        try{
          if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "SPI Flash BIN 시리얼 다운로드 준비 중...";
          if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = true;
          await setSerialStreamState(false);
          await delay(80);
          await downloadSpiFlashDumpViaSerial(selectedItem);
          return true;
        }catch(err){
          const reason = (err && err.message) ? err.message : String(err || "unknown");
          showToast("SPI Flash BIN(Serial) 다운로드 실패: " + reason, "error", {key:"spi-flash-dump-serial-fail"});
          if(el.spiFlashStatusLine){
            el.spiFlashStatusLine.textContent = "SPI Flash BIN(Serial) 다운로드 실패: " + reason;
          }
          return false;
        }finally{
          await setSerialStreamState(true);
          if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = false;
        }
      }

      const API_BASE = getApiBaseForCommands();
      const selectedOffset = Math.max(0, Math.floor(Number(selectedItem.offset) || 0));
      const selectedBytes = Math.max(0, Math.floor(Number(selectedItem.bytes) || 0));
      const url = (API_BASE ? API_BASE : "") + "/storage/spi_flash/export.bin?off=" + selectedOffset + "&len=" + selectedBytes;
      const ctrl = createAbortControllerSafe();
      const timeoutMs = 180000;
      const timer = ctrl ? setTimeout(()=>{ try{ ctrl.abort(); }catch(_e){} }, timeoutMs) : null;
      const opt = API_BASE
        ? Object.assign({cache:"no-store", mode:"cors"}, ctrl ? {signal:ctrl.signal} : {})
        : Object.assign({cache:"no-store"}, ctrl ? {signal:ctrl.signal} : {});
      try{
        if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "SPI Flash BIN 다운로드 준비 중...";
        if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = true;
        const dataDownloadBtn = document.getElementById("dataStorageDownloadBtn");
        if(dataDownloadBtn) dataDownloadBtn.textContent = "다운로드 중…";
        const res = await fetch(url, opt);
        if(!res.ok){
          const text = await res.text();
          throw new Error(text || ("HTTP " + res.status));
        }
        if(el.spiFlashStatusLine) el.spiFlashStatusLine.textContent = "SPI Flash BIN 다운로드 중...";
        const blob = await readStorageDownloadResponseBlob(res, selectedBytes);
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const safeName = String(selectedItem.name || "DATA").replace(/[^A-Za-z0-9_-]+/g, "_");
        downloadBlobAsFile(blob, safeName + "_" + ts + ".bin");
        showToast("SPI Flash BIN 다운로드 완료", "success", {key:"spi-flash-dump"});
        await fetchSpiFlashStatus({force:true});
        return true;
      }catch(err){
        const isAbort = !!(err && (err.name === "AbortError"));
        const reason = isAbort
          ? "TIMEOUT(180s) - 보드 Wi-Fi 연결 또는 192.168.4.1 접근 상태를 확인하세요"
          : ((err && err.message) ? err.message : String(err || "unknown"));
        showToast("SPI Flash BIN 다운로드 실패: " + reason, "error", {key:"spi-flash-dump-fail"});
        if(el.spiFlashStatusLine){
          el.spiFlashStatusLine.textContent = "SPI Flash BIN 다운로드 실패: " + reason;
        }
        return false;
      }finally{
        if(timer) clearTimeout(timer);
        if(el.spiFlashDumpBtn) el.spiFlashDumpBtn.disabled = false;
      }
    }
