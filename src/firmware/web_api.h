uint8_t stationCount() {
  wifi_sta_list_t stations;
  if (esp_wifi_ap_get_sta_list(&stations) == ESP_OK) return stations.num;
  return WiFi.softAPgetStationNum();
}

uint8_t stationCountCached() {
  const uint32_t now = millis();
  if (lastStationCacheMs == 0 || (uint32_t)(now - lastStationCacheMs) >= 250U) {
    lastStationCacheMs = now;
    cachedStations = stationCount();
  }
  return cachedStations;
}

void addCorsHeaders(AsyncWebServerResponse* response) {
  if (!response) return;
  response->addHeader("Access-Control-Allow-Origin", "*");
  response->addHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response->addHeader("Access-Control-Allow-Headers", "Content-Type,Cache-Control,Pragma,Origin,Accept,X-Requested-With");
  response->addHeader("Access-Control-Allow-Private-Network", "true");
  response->addHeader("Cache-Control", "no-store");
}

void sendText(AsyncWebServerRequest* request, int code, const char* type, const String& body) {
  AsyncWebServerResponse* response = request->beginResponse(code, type, body);
  addCorsHeaders(response);
  request->send(response);
}

bool requestParamLong(AsyncWebServerRequest* request, const char* name, long& out) {
  return request &&
         name &&
         request->hasParam(name) &&
         parseLongStrict(request->getParam(name)->value(), out);
}

bool forwardFlashLinkHttpCommand(
  AsyncWebServerRequest* request,
  FlashLinkCommandCode code,
  int32_t arg0 = 0,
  int32_t arg1 = 0,
  int32_t arg2 = 0
) {
  if (!flashLinkGroundRole()) return false;
  if (!flashLinkQueueCommand(code, arg0, arg1, arg2)) {
    sendText(
      request,
      503,
      "application/json",
      "{\"ok\":0,\"err\":\"FLASH_LINK_COMMAND_UNAVAILABLE\"}");
    return true;
  }
  char json[80];
  snprintf(
    json,
    sizeof(json),
    "{\"ok\":1,\"queued\":1,\"command\":%u}",
    (unsigned)code);
  sendText(request, 202, "application/json", json);
  return true;
}

void formatJsonEscaped(const char* source, char* out, size_t outLen) {
  if (!out || outLen == 0) return;
  size_t write = 0;
  const char* p = source ? source : "";
  while (*p && write + 1U < outLen) {
    const unsigned char c = (unsigned char)*p++;
    if (c == '"' || c == '\\') {
      if (write + 2U >= outLen) break;
      out[write++] = '\\';
      out[write++] = (char)c;
    } else if (c == '\n' || c == '\r' || c == '\t') {
      if (write + 2U >= outLen) break;
      out[write++] = '\\';
      out[write++] = c == '\n' ? 'n' : (c == '\r' ? 'r' : 't');
    } else if (c >= 0x20U) {
      out[write++] = (char)c;
    }
  }
  out[write] = '\0';
}

size_t buildTelemetryJson(char* json, size_t jsonLen, bool full) {
  const bool remoteOutput = flashLinkGroundRole();
  const Telemetry& output = remoteOutput ? flashLinkRemoteSnap : snap;
  char gpsLat[20];
  char gpsLon[20];
  char gpsAlt[16];
  formatGpsFieldsFor(output, gpsLat, sizeof(gpsLat), gpsLon, sizeof(gpsLon), gpsAlt, sizeof(gpsAlt));
  const uint32_t nowMs = millis();
  const uint16_t remoteFlags = remoteOutput ? flashLinkRemoteState.flags : 0;
  const uint8_t st = remoteOutput ? flashLinkRemoteState.state : sequenceState;
  const int32_t td = remoteOutput ? flashLinkRemoteState.tdMs : sequenceTdMs(nowMs);
  const uint8_t ab = remoteOutput
    ? ((remoteFlags & (1U << 8)) ? 1U : 0U)
    : (sequenceAbortActive(nowMs) ? 1U : 0U);
  const uint8_t relayMask = remoteOutput
    ? flashLinkRemoteState.relayMask
    : sequenceRelayMaskNow(nowMs);
  const uint8_t abortReason = remoteOutput
    ? flashLinkRemoteState.abortReason
    : sequenceAbortReason;
  const uint32_t outputIgnitionMs = remoteOutput
    ? flashLinkRemoteState.ignitionMs
    : ignitionDurationMs;
  const uint32_t outputCountdownMs = remoteOutput
    ? flashLinkRemoteState.countdownMs
    : reportedCountdownDurationMs();
  const uint8_t outputPyroChannel = remoteOutput
    ? flashLinkRemoteState.pyroChannel
    : daqSequencePyroChannel;
  const bool remoteActive = remoteOutput && flashLinkRemoteActive();
  const uint8_t outputDataModeCode = remoteOutput
    ? (flashLinkRemoteState.mode == 1U ? 1U : 0U)
    : dataOperationModeCode();
  const uint8_t reportedModeCode = (remoteOutput && !remoteActive)
    ? 2U
    : outputDataModeCode;
  const char* outputDataModeName = dataOperationModeNameFor(outputDataModeCode);
  const char* reportedModeName = reportedModeCode == 2U
    ? "flash_link"
    : outputDataModeName;
  const uint32_t heapFree = ESP.getFreeHeap();
  const uint32_t heapMinFree = ESP.getMinFreeHeap();
  const uint32_t heapMaxAlloc = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
  const bool chipTempValid = isfinite(output.chipTempC);
  const MissionAlarmState& outputAlarm =
    remoteOutput ? missionAlarmRemote : missionAlarmLocal;
  const uint8_t outputFlightPhase = output.flightPhase <= static_cast<uint8_t>(FlightPhase::Landed)
    ? output.flightPhase
    : static_cast<uint8_t>(FlightPhase::PreFlight);
  const char* outputFlightPhaseName = flightPhaseName(static_cast<FlightPhase>(outputFlightPhase));
  const bool outputIgnitionDelayValid =
    (output.deploymentFlags & 1U) != 0U && output.ignitionDelayMs != UINT32_MAX;
  char alarmTitle[52];
  char alarmMessage[132];
  formatJsonEscaped(outputAlarm.title, alarmTitle, sizeof(alarmTitle));
  formatJsonEscaped(outputAlarm.message, alarmMessage, sizeof(alarmMessage));
  char peerMac[20];
  flashLinkFormatMac(flashLink.peerReady ? flashLink.peerMac : nullptr, peerMac, sizeof(peerMac));
  const uint32_t flashRssiAgeMs = flashLink.lastRssiMs
    ? (uint32_t)(nowMs - flashLink.lastRssiMs)
    : UINT32_MAX;
  const FlashLinkGroundPeer& stage1Peer = flashLinkGroundPeers[0];
  const FlashLinkGroundPeer& stage2Peer = flashLinkGroundPeers[1];
  const bool stage1Connected = stage1Peer.peerReady && stage1Peer.linked &&
    stage1Peer.remoteValid && stage1Peer.lastTelemetryRxMs != 0U &&
    (uint32_t)(nowMs - stage1Peer.lastTelemetryRxMs) <= kFlashLinkTelemetryStaleMs;
  const bool stage2Connected = stage2Peer.peerReady && stage2Peer.linked &&
    stage2Peer.remoteValid && stage2Peer.lastTelemetryRxMs != 0U &&
    (uint32_t)(nowMs - stage2Peer.lastTelemetryRxMs) <= kFlashLinkTelemetryStaleMs;
  char fullFields[600] = {};
  if (full) {
    const bool outputImuReady = remoteOutput ? output.sampleValid : imuReady;
    const bool outputBaroReady = remoteOutput ? output.baroValid : baroReady;
    snprintf(
      fullFields,
      sizeof(fullFields),
      ",\"fw_program\":\"Altis_Intelligent3_firmware1\","
      "\"fw_ver\":\"0.6.0\",\"fw_build\":\"v6 b2\","
      "\"fw_ver_build\":\"0.6.0+v6 b2\","
      "\"fw_board\":\"Altis_Intelligent3_b3\","
      "\"fw_protocol\":\"Flash6-Intelligent-b2\","
      "\"sample_hz\":%lu,\"serial_hz\":%lu,\"wifi_hz\":%lu,"
      "\"record_hz\":%lu,\"baro_hz\":%lu,\"gps_hz\":%lu,\"loadcell_hz\":%u,"
      "\"imu_ready\":%u,\"baro_ready\":%u,\"gps_ready\":%u,"
      "\"loadcell_ready\":%u,\"loadcell_valid\":%u",
      (unsigned long)kImuSampleHz,
      (unsigned long)kSerialStreamHz,
      (unsigned long)kWifiStreamHz,
      (unsigned long)kStorageRecordHz,
      (unsigned long)kBaroSampleHz,
      (unsigned long)kGpsTargetHz,
      (unsigned)output.loadcellHz,
      outputImuReady ? 1U : 0U,
      outputBaroReady ? 1U : 0U,
      output.gpsReady ? 1U : 0U,
      output.loadcellReady ? 1U : 0U,
      output.loadcellValid ? 1U : 0U);
  }
  const uint8_t outputLoadcellRawOk =
    (output.loadcellReady && !output.loadcellSaturated &&
     (output.loadcellValid || output.loadcellOffsetValid || output.loadcellHz > 0U))
      ? 1U
      : 0U;
  const int n = snprintf(json, jsonLen,
           "{\"t\":%.3f,\"thrust\":%.3f,"
           "\"hz\":%u,\"hx_hz\":%u,"
           "\"lc_raw\":%ld,\"lc_raw_ok\":%u,\"lc_ready\":%u,"
           "\"lc_sat\":%u,\"lc_offset_ok\":%u,"
           "\"lc_noise\":%.3f,\"lc_scale\":%.6f,"
           "\"p\":%.5f,\"alt_m\":%.2f,"
           "\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,"
           "\"gx\":%.2f,\"gy\":%.2f,\"gz\":%.2f,"
           "\"gr\":%.2f,\"gp\":%.2f,\"gyw\":%.2f,\"ga\":%u,"
           "\"gps_fix\":%u,\"gps_seen\":%u,\"gps_age_ms\":%lu,"
           "\"gps_time_valid\":%u,\"gps_utc_ms\":%ld,"
           "\"gps_raw_bytes\":%lu,\"gps_baud\":%lu,\"gps_rx_pin\":%d,\"gps_tx_pin\":%d,"
           "\"gps_lat\":%s,\"gps_lon\":%s,\"gps_alt\":%s,"
           "\"ut\":%lu,\"lt\":%.3f,\"ct\":%u,"
           "\"chip_temp_c\":%.1f,\"chip_temp_ok\":%u,"
           "\"s\":%u,\"sp\":%u,\"ic\":1,\"r\":%u,\"gs\":0,"
           "\"st\":%u,\"td\":%ld,\"uw\":%u,\"ab\":%u,\"ar\":%u,\"m\":%u,"
           "\"op_mode\":\"%s\",\"opm\":%u,\"link_mode\":\"%s\","
           "\"data_mode\":\"%s\",\"data_opm\":%u,\"flash_link_data_mode\":\"%s\","
           "\"sta\":%u,\"ss\":%u,\"dev_mode\":%u,\"sm\":%u,\"al\":%u,\"ip\":%u,\"bo\":%u,\"sr\":%u,"
           "\"ign_ms\":%lu,\"cd_ms\":%lu,\"daq_seq_pyro\":%u,"
           "\"heap_free\":%lu,\"heap_min_free\":%lu,\"heap_max_alloc\":%lu,"
           "\"wq\":%lu,\"we\":%u,\"sq\":%lu,"
           "\"fl_role\":\"%s\",\"fl_node\":%u,\"fl_target\":%u,"
           "\"fl_stage1\":%u,\"fl_stage2\":%u,"
           "\"fl_link\":%u,\"fl_remote_valid\":%u,"
           "\"fl_rx_hz\":%u,\"fl_loss_permille\":%u,\"fl_peer_age_ms\":%lu,"
           "\"fl_peer\":\"%s\",\"fl_tx_ok\":%lu,\"fl_tx_fail\":%lu,"
           "\"fl_rx_frames\":%lu,\"fl_rx_drop\":%lu,"
           "\"fl_rssi_dbm\":%d,\"fl_rssi_age_ms\":%lu,"
           "\"fl_rate\":\"%s\",\"fl_rate_err\":%d,"
           "\"fl_cmd_pending\":%u,\"fl_cmd_acked\":%lu,\"fl_cmd_failed\":%lu,"
           "\"fl_cmd_last_code\":%u,\"fl_cmd_last_result\":%u,"
           "\"fl_cmd_retries\":%lu,\"data_origin\":\"%s\","
           "\"mission_alarm_seq\":%lu,\"mission_alarm_ts\":%lu,"
           "\"mission_alarm_block\":%u,\"mission_alarm_title\":\"%s\","
           "\"mission_alarm_message\":\"%s\","
           "\"flight_phase\":\"%s\",\"flight_phase_code\":%u,"
           "\"vertical_speed_mps\":%.2f,\"apogee_m\":%.2f,\"flight_phase_ms\":%lu,"
           "\"ignition_delay_ms\":%lu,\"ignition_delay_valid\":%u,"
           "\"deployment_state\":%u,\"deployment_flags\":%u,"
           "\"attitude_q\":[%.6f,%.6f,%.6f,%.6f]%s}",
           output.loadcellValid ? output.thrustKgf : 0.0f,
           output.loadcellValid ? output.thrustKgf : 0.0f,
           (unsigned)output.loadcellHz,
           (unsigned)output.loadcellHz,
           (long)output.loadcellRaw,
           (unsigned)outputLoadcellRawOk,
           output.loadcellReady ? 1U : 0U,
           output.loadcellSaturated ? 1U : 0U,
           output.loadcellOffsetValid ? 1U : 0U,
           output.loadcellNoiseKg,
           output.loadcellScale,
           output.baroValid ? output.p : 0.0f,
           output.baroValid ? output.altM : 0.0f,
           output.ax, output.ay, output.az,
           output.gx, output.gy, output.gz,
           output.roll, output.pitch, output.yaw, output.attitudeValid ? 1U : 0U,
           output.gpsFix ? 1U : 0U,
           output.gpsSeen ? 1U : 0U,
           (unsigned long)output.gpsAgeMs,
           output.gpsTimeValid ? 1U : 0U,
           output.gpsTimeValid ? (long)output.gpsUtcMs : -1L,
           (unsigned long)output.gpsRawBytes,
           (unsigned long)output.gpsBaud,
           (int)output.gpsRxPin,
           (int)output.gpsTxPin,
           gpsLat, gpsLon, gpsAlt,
           (unsigned long)output.ut, output.lt, (unsigned)output.ct,
           chipTempValid ? output.chipTempC : 0.0f, chipTempValid ? 1U : 0U,
           remoteOutput ? ((remoteFlags >> 5) & 1U) : (armSwitchEffectiveOn() ? 1U : 0U),
           remoteOutput ? ((remoteFlags >> 13) & 1U) : (armSwitchPhysicalOn() ? 1U : 0U),
           (unsigned)relayMask,
           (unsigned)st,
           (long)td,
           remoteOutput ? ((remoteFlags >> 7) & 1U) : (sequenceUserWaiting ? 1U : 0U),
           (unsigned)ab,
           (unsigned)abortReason,
           (unsigned)reportedModeCode,
           reportedModeName,
           (unsigned)reportedModeCode,
           flashLinkMode ? "flash_link" : operationModeName(),
           outputDataModeName,
           (unsigned)outputDataModeCode,
           dataOperationModeNameFor(flashLinkDataModeCode()),
           stationCountCached() > 0 ? 1U : 0U,
           serialStream ? 1U : 0U,
           developerMode ? 1U : 0U,
           remoteOutput ? ((remoteFlags >> 9) & 1U) : (safetyMode ? 1U : 0U),
           remoteOutput ? ((remoteFlags >> 10) & 1U) : (armLock ? 1U : 0U),
           remoteOutput ? ((remoteFlags >> 11) & 1U) : (inspectionPassed ? 1U : 0U),
           output.baroValid ? 1U : 0U,
           remoteOutput ? ((remoteFlags >> 12) & 1U) : (storageState.ready ? 1U : 0U),
           (unsigned long)outputIgnitionMs,
           (unsigned long)outputCountdownMs,
           (unsigned)outputPyroChannel,
           (unsigned long)heapFree,
           (unsigned long)heapMinFree,
           (unsigned long)heapMaxAlloc,
           (unsigned long)wsDroppedFrames,
           (unsigned)wsLastStatus,
           (unsigned long)serialDroppedFrames,
           flashLinkRoleName(),
           (unsigned)flashLinkNodeId,
           (unsigned)flashLinkTargetNodeId,
           stage1Connected ? 1U : 0U,
           stage2Connected ? 1U : 0U,
           flashLinkOperational() ? 1U : 0U,
           remoteActive ? 1U : 0U,
           (unsigned)flashLink.rxHz,
           (unsigned)flashLinkLossPermille(),
           (unsigned long)flashLinkPeerAgeMs(),
           peerMac,
           (unsigned long)flashLink.txOk,
           (unsigned long)flashLink.txFail,
           (unsigned long)flashLink.rxFrames,
           (unsigned long)flashLink.rxDropped,
           (int)flashLink.rssiDbm,
           (unsigned long)flashRssiAgeMs,
           flashLinkRateName,
           flashLinkRateError,
           (unsigned)flashLinkCommandCount,
           (unsigned long)flashLink.commandAcked,
           (unsigned long)flashLink.commandFailed,
           (unsigned)flashLink.lastCommandCode,
           (unsigned)flashLink.lastCommandResult,
           (unsigned long)flashLink.commandRetries,
           remoteOutput ? "avionics" : "local",
           (unsigned long)outputAlarm.seq,
           (unsigned long)outputAlarm.timestampMs,
           (unsigned)outputAlarm.blockIndex,
           alarmTitle,
           alarmMessage,
           outputFlightPhaseName,
           (unsigned)outputFlightPhase,
           output.flightVerticalSpeedMps,
           output.flightApogeeM,
           (unsigned long)output.flightPhaseElapsedMs,
           (unsigned long)(outputIgnitionDelayValid ? output.ignitionDelayMs : 0U),
           outputIgnitionDelayValid ? 1U : 0U,
           (unsigned)output.deploymentState,
           (unsigned)output.deploymentFlags,
           output.attitudeQw,
           output.attitudeQx,
           output.attitudeQy,
           output.attitudeQz,
           fullFields);
  if (n <= 0) {
    if (jsonLen) json[0] = '\0';
    return 0;
  }
  if ((size_t)n >= jsonLen) {
    if (jsonLen) json[0] = '\0';
    return 0;
  }
  return (size_t)n;
}

String telemetryJson(bool full) {
  char json[2800];
  if (buildTelemetryJson(json, sizeof(json), full) == 0) {
    return "{\"ok\":0,\"err\":\"TELEMETRY_OVERFLOW\"}";
  }
  return String(json);
}

size_t buildStreamJsonV2(char* json, size_t jsonLen) {
  // v2 array fields:
  // [version,seq,uptime,p,alt,ax,ay,az,gx,gy,gz,roll,pitch,yaw,loop,cpu,
  //  flags,relay,state,td,abort_reason,mode,chip_temp,lat,lon,gps_alt,gps_age,
  //  ws_drop,serial_drop,ign_ms,countdown_ms,pyro_channel,
  //  flash_role,flash_link,flash_rx_hz,flash_loss_permille,flash_peer_age,
  //  flash_remote_valid,flash_tx_ok,flash_tx_fail,flash_rx_frames,flash_rx_drop,
  //  flash_peer,flash_tx_skipped,flash_crc_errors,flash_queue_drops,
  //  flash_cmd_pending,flash_cmd_acked,flash_cmd_failed,flash_cmd_last_code,
  //  flash_cmd_last_result,flash_cmd_retries,data_origin,gps_time_valid,gps_utc_ms,
  //  flash_rssi_dbm,flash_rssi_age_ms,t,hx_hz,lc_raw,lc_raw_ok,lc_ready,
  //  lc_sat,lc_offset_ok,lc_noise,lc_scale,
  //  remote_storage_used,remote_storage_capacity,remote_storage_records,
  //  mission_alarm_seq,mission_alarm_ts,mission_alarm_block,
  //  mission_alarm_title,mission_alarm_message,flight_phase,vertical_speed,
  //  apogee,flight_phase_elapsed,attitude_qw,qx,qy,qz,
  //  ignition_delay_ms,ignition_delay_valid,deployment_state,deployment_flags,
  //  arm_physical,flash_node,flash_target,stage1_connected,stage2_connected]
  const bool remoteOutput = flashLinkGroundRole();
  const Telemetry& output = remoteOutput ? flashLinkRemoteSnap : snap;
  const uint16_t remoteFlags = remoteOutput ? flashLinkRemoteState.flags : 0;
  char gpsLat[20];
  char gpsLon[20];
  char gpsAlt[16];
  char chipTemp[16];
  char peerMac[20];
  formatGpsFieldsFor(output, gpsLat, sizeof(gpsLat), gpsLon, sizeof(gpsLon), gpsAlt, sizeof(gpsAlt));
  flashLinkFormatMac(flashLink.peerReady ? flashLink.peerMac : nullptr, peerMac, sizeof(peerMac));
  const uint32_t nowMs = millis();
  const bool chipTempValid = isfinite(output.chipTempC);
  if (chipTempValid) snprintf(chipTemp, sizeof(chipTemp), "%.1f", output.chipTempC);
  else snprintf(chipTemp, sizeof(chipTemp), "null");

  uint16_t flags = remoteOutput ? remoteFlags : 0;
  if (!remoteOutput) {
    if (output.sampleValid) flags |= 1U << 0;
    if (output.baroValid) flags |= 1U << 1;
    if (output.attitudeValid) flags |= 1U << 2;
    if (output.gpsFix) flags |= 1U << 3;
    if (output.gpsSeen) flags |= 1U << 4;
    if (armSwitchEffectiveOn()) flags |= 1U << 5;
    flags |= 1U << 6;
    if (sequenceUserWaiting) flags |= 1U << 7;
    if (sequenceAbortActive(nowMs)) flags |= 1U << 8;
    if (safetyMode) flags |= 1U << 9;
    if (armLock) flags |= 1U << 10;
    if (inspectionPassed) flags |= 1U << 11;
    if (storageState.ready) flags |= 1U << 12;
  }
  flags &= (uint16_t)~((1U << 13) | (1U << 14));
  if (serialStream) flags |= 1U << 13;
  if (stationCountCached() > 0) flags |= 1U << 14;
  if (chipTempValid) flags |= 1U << 15;

  const uint8_t relayMask = remoteOutput
    ? flashLinkRemoteState.relayMask
    : sequenceRelayMaskNow(nowMs);
  const uint8_t state = remoteOutput ? flashLinkRemoteState.state : sequenceState;
  const int32_t tdMs = remoteOutput ? flashLinkRemoteState.tdMs : sequenceTdMs(nowMs);
  const uint8_t abortReason = remoteOutput
    ? flashLinkRemoteState.abortReason
    : sequenceAbortReason;
  const uint32_t outputIgnitionMs = remoteOutput
    ? flashLinkRemoteState.ignitionMs
    : ignitionDurationMs;
	  const uint32_t outputCountdownMs = remoteOutput
	    ? flashLinkRemoteState.countdownMs
	    : reportedCountdownDurationMs();
  const uint8_t outputPyroChannel = remoteOutput
    ? flashLinkRemoteState.pyroChannel
	    : daqSequencePyroChannel;
  const bool remoteActive = remoteOutput && flashLinkRemoteActive();
  const uint8_t outputDataModeCode = remoteOutput
    ? (flashLinkRemoteState.mode == 1U ? 1U : 0U)
    : dataOperationModeCode();
  const uint8_t reportedModeCode = (remoteOutput && !remoteActive)
    ? 2U
    : outputDataModeCode;
  const bool outputGpsClockValid = output.gpsTimeValid && output.gpsFix;
  const uint32_t frameSequence = ++streamFrameSequence;
  const uint32_t flashRssiAgeMs = flashLink.lastRssiMs
    ? (uint32_t)(nowMs - flashLink.lastRssiMs)
    : UINT32_MAX;
  const FlashLinkGroundPeer& streamStage1 = flashLinkGroundPeers[0];
  const FlashLinkGroundPeer& streamStage2 = flashLinkGroundPeers[1];
  const bool streamStage1Connected = streamStage1.peerReady && streamStage1.linked &&
    streamStage1.remoteValid && streamStage1.lastTelemetryRxMs != 0U &&
    (uint32_t)(nowMs - streamStage1.lastTelemetryRxMs) <= kFlashLinkTelemetryStaleMs;
  const bool streamStage2Connected = streamStage2.peerReady && streamStage2.linked &&
    streamStage2.remoteValid && streamStage2.lastTelemetryRxMs != 0U &&
    (uint32_t)(nowMs - streamStage2.lastTelemetryRxMs) <= kFlashLinkTelemetryStaleMs;
  const uint8_t outputLoadcellRawOk =
    (output.loadcellReady && !output.loadcellSaturated &&
     (output.loadcellValid || output.loadcellOffsetValid || output.loadcellHz > 0U))
      ? 1U
      : 0U;
  const MissionAlarmState& outputAlarm =
    remoteOutput ? missionAlarmRemote : missionAlarmLocal;
  const uint8_t outputFlightPhase = output.flightPhase <= static_cast<uint8_t>(FlightPhase::Landed)
    ? output.flightPhase
    : static_cast<uint8_t>(FlightPhase::PreFlight);
  const bool outputIgnitionDelayValid =
    (output.deploymentFlags & 1U) != 0U && output.ignitionDelayMs != UINT32_MAX;
  char alarmTitle[52];
  char alarmMessage[132];
  formatJsonEscaped(outputAlarm.title, alarmTitle, sizeof(alarmTitle));
  formatJsonEscaped(outputAlarm.message, alarmMessage, sizeof(alarmMessage));
	  const int n = snprintf(json, jsonLen,
           "[2,%lu,%lu,%.5f,%.2f,"
           "%.3f,%.3f,%.3f,%.2f,%.2f,%.2f,"
           "%.2f,%.2f,%.2f,%.3f,%u,"
           "%u,%u,%u,%ld,%u,%u,%s,"
           "%s,%s,%s,%lu,%lu,%lu,"
           "%lu,%lu,%u,%u,%u,%u,%u,%lu,"
           "%u,%lu,%lu,%lu,%lu,\"%s\",%lu,%lu,%lu,"
           "%u,%lu,%lu,%u,%u,%lu,%u,%u,%ld,%d,%lu,"
           "%.3f,%u,%ld,%u,%u,%u,%u,%.3f,%.6f,%lu,%lu,%lu,"
           "%lu,%lu,%u,\"%s\",\"%s\",%u,%.2f,%.2f,%lu,%.6f,%.6f,%.6f,%.6f,"
           "%lu,%u,%u,%u,%u,%u,%u,%u,%u]",
           (unsigned long)frameSequence,
           (unsigned long)output.ut,
           output.baroValid ? output.p : 0.0f,
           output.baroValid ? output.altM : 0.0f,
           output.ax, output.ay, output.az,
           output.gx, output.gy, output.gz,
           output.roll, output.pitch, output.yaw,
           output.lt, (unsigned)output.ct,
           (unsigned)flags,
           (unsigned)relayMask,
           (unsigned)state,
           (long)tdMs,
           (unsigned)abortReason,
           (unsigned)reportedModeCode,
           chipTemp,
           gpsLat, gpsLon, gpsAlt,
           (unsigned long)output.gpsAgeMs,
           (unsigned long)wsDroppedFrames,
           (unsigned long)serialDroppedFrames,
           (unsigned long)outputIgnitionMs,
           (unsigned long)outputCountdownMs,
           (unsigned)outputPyroChannel,
           (unsigned)flashLinkRoleCode(),
           flashLinkOperational() ? 1U : 0U,
           (unsigned)flashLink.rxHz,
           (unsigned)flashLinkLossPermille(),
           (unsigned long)flashLinkPeerAgeMs(),
           remoteActive ? 1U : 0U,
           (unsigned long)flashLink.txOk,
           (unsigned long)flashLink.txFail,
           (unsigned long)flashLink.rxFrames,
           (unsigned long)flashLink.rxDropped,
           peerMac,
           (unsigned long)flashLink.txSkipped,
           (unsigned long)flashLink.rxCrcErrors,
           (unsigned long)flashLink.rxQueueDrops,
           (unsigned)flashLinkCommandCount,
           (unsigned long)flashLink.commandAcked,
           (unsigned long)flashLink.commandFailed,
	           (unsigned)flashLink.lastCommandCode,
	           (unsigned)flashLink.lastCommandResult,
		           (unsigned long)flashLink.commandRetries,
		           remoteOutput ? 1U : 0U,
		           outputGpsClockValid ? 1U : 0U,
		           outputGpsClockValid ? (long)output.gpsUtcMs : -1L,
		           (int)flashLink.rssiDbm,
		           (unsigned long)flashRssiAgeMs,
               output.loadcellValid ? output.thrustKgf : 0.0f,
               (unsigned)output.loadcellHz,
               (long)output.loadcellRaw,
               (unsigned)outputLoadcellRawOk,
               output.loadcellReady ? 1U : 0U,
               output.loadcellSaturated ? 1U : 0U,
               output.loadcellOffsetValid ? 1U : 0U,
               output.loadcellNoiseKg,
               output.loadcellScale,
               (unsigned long)(remoteOutput
                 ? flashLinkRemoteState.storageUsedBytes
                 : storageState.usedBytes),
               (unsigned long)(remoteOutput
                 ? flashLinkRemoteState.storageCapacityBytes
                 : storageState.capacityBytes),
               (unsigned long)(remoteOutput
                 ? flashLinkRemoteState.storageRecordCount
                 : storageState.recordCount),
               (unsigned long)outputAlarm.seq,
               (unsigned long)outputAlarm.timestampMs,
               (unsigned)outputAlarm.blockIndex,
               alarmTitle,
               alarmMessage,
               (unsigned)outputFlightPhase,
               output.flightVerticalSpeedMps,
               output.flightApogeeM,
               (unsigned long)output.flightPhaseElapsedMs,
               output.attitudeQw,
               output.attitudeQx,
               output.attitudeQy,
               output.attitudeQz,
               (unsigned long)(outputIgnitionDelayValid ? output.ignitionDelayMs : 0U),
               outputIgnitionDelayValid ? 1U : 0U,
               (unsigned)output.deploymentState,
               (unsigned)output.deploymentFlags,
               remoteOutput ? ((remoteFlags >> 13) & 1U) : (armSwitchPhysicalOn() ? 1U : 0U),
               (unsigned)flashLinkNodeId,
               (unsigned)flashLinkTargetNodeId,
               streamStage1Connected ? 1U : 0U,
               streamStage2Connected ? 1U : 0U);
  if (n <= 0) {
    if (jsonLen) json[0] = '\0';
    return 0;
  }
  if ((size_t)n >= jsonLen) {
    if (jsonLen) json[0] = '\0';
    return 0;
  }
  return (size_t)n;
}

bool loadcellFreshRawAvailable();

struct SensorHealthSummary {
  bool ok = true;
  bool alert = false;
  uint8_t faults = 0;
  uint8_t warnings = 0;
  char issues[256] = "[]";
};

void appendSensorHealthIssue(SensorHealthSummary& health, const char* code, bool fault) {
  if (!code) return;
  const size_t used = strlen(health.issues);
  if (used < 2 || used >= sizeof(health.issues)) return;

  char next[256];
  const bool first = strcmp(health.issues, "[]") == 0;
  const int n = first
    ? snprintf(next, sizeof(next), "[\"%s\"]", code)
    : snprintf(next, sizeof(next), "%.*s,\"%s\"]", (int)(used - 1), health.issues, code);
  if (n <= 0 || (size_t)n >= sizeof(next)) return;
  strlcpy(health.issues, next, sizeof(health.issues));

  health.alert = true;
  if (fault) {
    health.ok = false;
    if (health.faults < UINT8_MAX) health.faults++;
  } else if (health.warnings < UINT8_MAX) {
    health.warnings++;
  }
}

SensorHealthSummary buildSensorHealthSummary() {
  SensorHealthSummary health{};
  const uint32_t nowMs = millis();
  const uint32_t uptimeMs = nowMs - bootMs;
  const bool bootSettled = uptimeMs >= 3000U;
  const bool localSensorsExpected = !flashLinkGroundRole();

  if (!localSensorsExpected) return health;

  const uint32_t imuAgeMs =
    (lastImuValidMs > 0U && nowMs >= lastImuValidMs) ? (nowMs - lastImuValidMs) : UINT32_MAX;
  if (bootSettled && (!imuReady || !snap.sampleValid || imuAgeMs > 1500U)) {
    appendSensorHealthIssue(health, "IMU_NO_VALID_SAMPLE", true);
  }

  const uint32_t baroAgeMs =
    (lastBaroValidMs > 0U && nowMs >= lastBaroValidMs) ? (nowMs - lastBaroValidMs) : UINT32_MAX;
  if (bootSettled && (!baroReady || !snap.baroValid || baroAgeMs > 3000U)) {
    appendSensorHealthIssue(health, "BARO_NO_VALID_SAMPLE", true);
  }

  if (gpsShouldRun()) {
    if (bootSettled && (!snap.gpsReady || !snap.gpsSeen || snap.gpsAgeMs > 5000U)) {
      appendSensorHealthIssue(health, "GPS_NO_DATA", true);
    } else if (bootSettled && !snap.gpsFix) {
      appendSensorHealthIssue(health, "GPS_NO_FIX", false);
    }
  }

  if (loadcellShouldRun()) {
    const bool fresh = loadcellFreshRawAvailable();
    if (bootSettled && (!snap.loadcellReady || !fresh)) {
      appendSensorHealthIssue(health, "LOADCELL_NO_FRESH_SAMPLE", true);
    }
    if (snap.loadcellSaturated || loadcellSaturated) {
      appendSensorHealthIssue(health, "LOADCELL_SATURATED", true);
    }
  }

  return health;
}

String healthJson() {
  StorageRuntime storage{};
  uint32_t storageSpiHz = 0;
  {
    StorageLock storageLock(0);
    if (!storageLock) return "{\"ok\":0,\"err\":\"STORAGE_BUSY\"}";
    storageRefreshStats();
    storage = storageState;
    storageSpiHz = storageSpiActiveHz;
  }
  SensorHealthSummary sensorHealth = buildSensorHealthSummary();
  char json[2048];
  IPAddress ip = WiFi.softAPIP();
  const bool chipTempValid = isfinite(snap.chipTempC);
  snprintf(json, sizeof(json),
           "{\"ok\":1,\"sensor_ok\":%u,\"agent_alert\":%u,"
           "\"sensor_faults\":%u,\"sensor_warnings\":%u,\"sensor_issues\":%s,"
           "\"ap\":%u,\"server\":%u,\"ssid\":\"%s\",\"ip\":\"%s\","
           "\"channel\":%u,\"stations\":%u,\"max_conn\":%u,\"ws_clients\":%u,"
           "\"imu_ready\":%u,\"imu_addr\":\"0x%02X\",\"imu_read_errors\":%lu,"
           "\"baro_ready\":%u,\"baro_addr\":\"0x%02X\",\"baro_read_errors\":%lu,"
           "\"loadcell_ready\":%u,\"loadcell_valid\":%u,\"loadcell_hz\":%u,"
           "\"loadcell_raw\":%ld,\"loadcell_errors\":%lu,"
           "\"gps_ready\":%u,\"gps_seen\":%u,\"gps_fix\":%u,\"gps_age_ms\":%lu,"
           "\"gps_raw_bytes\":%lu,\"gps_baud\":%lu,\"gps_rx_pin\":%d,\"gps_tx_pin\":%d,"
           "\"sample_hz\":%lu,\"serial_hz\":%lu,\"wifi_hz\":%lu,\"record_hz\":%lu,\"baro_hz\":%lu,\"loadcell_hz_setting\":%u,"
           "\"chip_temp_c\":%.1f,\"chip_temp_ok\":%u,\"imu_temp_c\":%.1f,"
           "\"heap_free\":%lu,\"heap_min_free\":%lu,\"heap_max_alloc\":%lu,"
           "\"flash_size\":%lu,\"sketch_size\":%lu,\"free_sketch_space\":%lu,"
           "\"storage_ready\":%u,\"storage_model\":\"W25Q256JVEIQ\",\"storage_kind\":\"external_spi_nor\","
           "\"storage_chip_capacity_bytes\":%lu,\"storage_capacity_bytes\":%lu,"
           "\"storage_used_bytes\":%lu,\"storage_records\":%lu,\"storage_spi_hz\":%lu,"
           "\"ign_ms\":%lu,\"cd_ms\":%lu,\"daq_seq_pyro\":%u,"
           "\"uptime_ms\":%lu}",
           sensorHealth.ok ? 1U : 0U,
           sensorHealth.alert ? 1U : 0U,
           (unsigned)sensorHealth.faults,
           (unsigned)sensorHealth.warnings,
           sensorHealth.issues,
           wifiApActive() ? 1U : 0U,
           serverReady ? 1U : 0U,
           apSsid,
           ip.toString().c_str(),
           kWifiChannel,
           stationCountCached(),
           kWifiMaxClients,
           ws.count(),
           imuReady ? 1U : 0U,
           imuAddr,
           (unsigned long)imuReadErrors,
           baroReady ? 1U : 0U,
           baroAddr,
           (unsigned long)baroReadErrors,
           snap.loadcellReady ? 1U : 0U,
           snap.loadcellValid ? 1U : 0U,
           (unsigned)snap.loadcellHz,
           (long)snap.loadcellRaw,
           (unsigned long)loadcellReadErrors,
           snap.gpsReady ? 1U : 0U,
           snap.gpsSeen ? 1U : 0U,
           snap.gpsFix ? 1U : 0U,
           (unsigned long)snap.gpsAgeMs,
           (unsigned long)snap.gpsRawBytes,
           (unsigned long)snap.gpsBaud,
           (int)snap.gpsRxPin,
           (int)snap.gpsTxPin,
           (unsigned long)kImuSampleHz,
           (unsigned long)kSerialStreamHz,
           (unsigned long)kWifiStreamHz,
           (unsigned long)kStorageRecordHz,
           (unsigned long)kBaroSampleHz,
           (unsigned)snap.loadcellHz,
           chipTempValid ? snap.chipTempC : 0.0f,
           chipTempValid ? 1U : 0U,
           isfinite(snap.imuTempC) ? snap.imuTempC : 0.0f,
           (unsigned long)ESP.getFreeHeap(),
           (unsigned long)ESP.getMinFreeHeap(),
           (unsigned long)heap_caps_get_largest_free_block(MALLOC_CAP_8BIT),
           (unsigned long)ESP.getFlashChipSize(),
           (unsigned long)ESP.getSketchSize(),
           (unsigned long)ESP.getFreeSketchSpace(),
           storage.ready ? 1U : 0U,
           (unsigned long)kNorExpectedCapacityBytes,
           (unsigned long)storage.capacityBytes,
           (unsigned long)storage.usedBytes,
           (unsigned long)storage.recordCount,
           (unsigned long)storageSpiHz,
           (unsigned long)ignitionDurationMs,
           (unsigned long)reportedCountdownDurationMs(),
           (unsigned)daqSequencePyroChannel,
           (unsigned long)(millis() - bootMs));
  return String(json);
}

String gpsJson() {
  const Telemetry& output = flashLinkGroundRole() ? flashLinkRemoteSnap : snap;
  char gpsLat[20];
  char gpsLon[20];
  char gpsAlt[16];
  formatGpsFieldsFor(output, gpsLat, sizeof(gpsLat), gpsLon, sizeof(gpsLon), gpsAlt, sizeof(gpsAlt));
  char json[520];
  snprintf(json, sizeof(json),
           "{\"ok\":1,\"ready\":%u,\"seen\":%u,\"fix\":%u,\"age_ms\":%lu,"
           "\"time_valid\":%u,\"utc_ms\":%ld,"
           "\"raw_bytes\":%lu,\"sentences\":%lu,\"parse_errors\":%lu,"
           "\"baud\":%lu,\"rx_pin\":%d,\"tx_pin\":%d,"
           "\"lat\":%s,\"lon\":%s,\"alt_m\":%s}",
           output.gpsReady ? 1U : 0U,
           output.gpsSeen ? 1U : 0U,
           output.gpsFix ? 1U : 0U,
           (unsigned long)output.gpsAgeMs,
           output.gpsTimeValid ? 1U : 0U,
           output.gpsTimeValid ? (long)output.gpsUtcMs : -1L,
           (unsigned long)output.gpsRawBytes,
           (unsigned long)output.gpsSentenceCount,
           (unsigned long)output.gpsParseErrors,
           (unsigned long)output.gpsBaud,
           (int)output.gpsRxPin,
           (int)output.gpsTxPin,
           gpsLat, gpsLon, gpsAlt);
  return String(json);
}

String ratesJson() {
  char json[220];
  snprintf(json, sizeof(json),
           "{\"ok\":1,\"sample_hz\":%lu,\"serial_hz\":%lu,\"wifi_hz\":%lu,"
           "\"record_hz\":%lu,\"baro_hz\":%lu,\"gps_hz\":%lu,\"loadcell_hz\":%u}",
           (unsigned long)kImuSampleHz,
           (unsigned long)kSerialStreamHz,
           (unsigned long)kWifiStreamHz,
           (unsigned long)kStorageRecordHz,
           (unsigned long)kBaroSampleHz,
           (unsigned long)kGpsTargetHz,
           (unsigned)snap.loadcellHz);
  return String(json);
}

String wifiInfoJson() {
  IPAddress ip = WiFi.softAPIP();
  const bool apShould = wifiApShouldRun();
  const bool apActive = wifiApActive();
  const char* publicMode = flashLinkAvionicsRole()
    ? "STA"
    : (apShould ? "AP" : "off");
  char json[520];
  snprintf(json, sizeof(json),
           "{\"mode\":\"%s\",\"wifi_mode\":\"%s\",\"ap\":%u,\"ap_ready\":%u,"
           "\"ap_ssid\":\"%s\",\"sta_ssid\":\"\","
           "\"channel\":%u,\"bandwidth\":\"HT20\",\"tx_dbm\":19.5,"
           "\"ap_ip\":\"%s\",\"sta_ip\":\"0.0.0.0\",\"sta_count\":%u,\"max_conn\":%u,"
           "\"inactive_sec\":45,\"ap_restarts\":%lu,\"ap_start_fails\":%lu,"
           "\"ap_consecutive_fails\":%u,\"rssi\":-127}",
           publicMode,
           wifiModeText(),
           apActive ? 1U : 0U,
           wifiApReady ? 1U : 0U,
           apShould ? apSsid : "",
           kWifiChannel,
           ip.toString().c_str(),
           apActive ? stationCountCached() : 0U,
           kWifiMaxClients,
           (unsigned long)wifiApRestarts,
           (unsigned long)wifiApStartFails,
           (unsigned)wifiApConsecutiveFailures);
  return String(json);
}

String baroJson() {
  char json[520];
  const uint32_t nowMs = millis();
  const uint32_t ageMs = (lastBaroValidMs > 0 && nowMs >= lastBaroValidMs) ? (nowMs - lastBaroValidMs) : 0xFFFFFFFFUL;
  snprintf(json, sizeof(json),
           "{\"ok\":1,\"ready\":%u,\"valid\":%u,\"addr\":\"0x%02X\","
           "\"pressure_mpa\":%.6f,\"alt_m\":%.2f,\"alt_msl_m\":%.2f,"
           "\"temp_c\":%.2f,\"sea_level_hpa\":%.2f,"
           "\"base_ready\":%u,\"base_pressure_mpa\":%.6f,"
           "\"age_ms\":%lu,\"errors\":%lu}",
           baroReady ? 1U : 0U,
           snap.baroValid ? 1U : 0U,
           baroAddr,
           snap.baroValid ? snap.p : 0.0f,
           snap.baroValid ? snap.altM : 0.0f,
           snap.baroValid ? snap.baroAltMslM : 0.0f,
           snap.baroValid ? snap.baroTempC : 0.0f,
           seaLevelHpa,
           baroBaseReady ? 1U : 0U,
           baroBasePressureMpa,
           (unsigned long)ageMs,
           (unsigned long)baroReadErrors);
  return String(json);
}

bool loadcellFreshRawAvailable() {
  return loadcellShouldRun() &&
         loadcellReady &&
         lastLoadcellSampleMs != 0 &&
         (uint32_t)(millis() - lastLoadcellSampleMs) <= kLoadcellStaleMs &&
         !loadcellSaturated;
}

String loadcellJson() {
  char json[520];
  const bool fresh = loadcellFreshRawAvailable();
  snprintf(json, sizeof(json),
           "{\"ok\":1,\"active\":%u,\"ready\":%u,\"valid\":%u,"
           "\"fresh_raw\":%u,\"raw\":%ld,\"raw_ok\":%u,"
           "\"t\":%.3f,\"thrust\":%.3f,\"hz\":%u,\"hx_hz\":%u,"
           "\"offset\":%ld,\"offset_ok\":%u,\"scale\":%.6f,"
           "\"noise\":%.3f,\"sat\":%u,\"errors\":%lu,"
           "\"dout_pin\":%d,\"sck_pin\":%d}",
           loadcellShouldRun() ? 1U : 0U,
           snap.loadcellReady ? 1U : 0U,
           snap.loadcellValid ? 1U : 0U,
           fresh ? 1U : 0U,
           (long)loadcellRaw,
           fresh ? 1U : 0U,
           snap.loadcellValid ? snap.thrustKgf : 0.0f,
           snap.loadcellValid ? snap.thrustKgf : 0.0f,
           (unsigned)snap.loadcellHz,
           (unsigned)snap.loadcellHz,
           (long)loadcellOffset,
           loadcellAutoZeroDone ? 1U : 0U,
           loadcellScale,
           kLoadcellNoiseDeadbandKg,
           loadcellSaturated ? 1U : 0U,
           (unsigned long)loadcellReadErrors,
           hx711Dout,
           hx711Sck);
  return String(json);
}

bool saveLoadcellZeroFromCurrent() {
  if (!loadcellFreshRawAvailable()) return false;
  return saveLoadcellOffset(loadcellRaw);
}

bool saveLoadcellScaleFromWeight(float weightKg) {
  if (!isfinite(weightKg) || weightKg <= 0.0f || !loadcellFreshRawAvailable()) return false;
  const int32_t delta = loadcellRaw - loadcellOffset;
  if (abs(delta) < 1) return false;
  return saveLoadcellScale((float)delta / weightKg);
}

String settingsJson() {
  char peerMac[20];
  flashLinkFormatMac(flashLink.peerReady ? flashLink.peerMac : nullptr, peerMac, sizeof(peerMac));
  const uint32_t nowMs = millis();
  const uint32_t flashRssiAgeMs = flashLink.lastRssiMs
    ? (uint32_t)(nowMs - flashLink.lastRssiMs)
    : UINT32_MAX;
  const FlashLinkGroundPeer& stage1 = flashLinkGroundPeers[0];
  const FlashLinkGroundPeer& stage2 = flashLinkGroundPeers[1];
  const bool stage1Connected = stage1.peerReady && stage1.linked && stage1.remoteValid &&
    stage1.lastTelemetryRxMs != 0U &&
    (uint32_t)(nowMs - stage1.lastTelemetryRxMs) <= kFlashLinkTelemetryStaleMs;
  const bool stage2Connected = stage2.peerReady && stage2.linked && stage2.remoteValid &&
    stage2.lastTelemetryRxMs != 0U &&
    (uint32_t)(nowMs - stage2.lastTelemetryRxMs) <= kFlashLinkTelemetryStaleMs;
  char json[1200];
  snprintf(json, sizeof(json),
           "{\"ok\":1,\"ign_ms\":%lu,\"cd_ms\":%lu,\"countdown_sec\":%lu,\"daq_seq_pyro\":%u,"
           "\"op_mode\":\"%s\",\"link_mode\":\"%s\",\"data_mode\":\"%s\","
           "\"flash_link_data_mode\":\"%s\",\"safe\":%u,\"arm_lock\":%u,\"inspection\":%u,"
           "\"dev_mode\":%u,\"developer_mode\":%u,\"mute\":%u,"
           "\"flash_link_role\":\"%s\",\"flash_link_protocol\":\"ALTIS INTELLIGENT LINK1\"," 
           "\"flash_link_node_id\":%u,\"flash_link_target_node_id\":%u,"
           "\"flash_link_stage1_connected\":%u,\"flash_link_stage2_connected\":%u,"
           "\"flash_link_channel\":%u,\"flash_link_rate\":\"%s\",\"flash_link_rate_err\":%d,"
           "\"flash_link_hz\":%lu,\"flash_link_connected\":%u,"
           "\"flash_link_remote_valid\":%u,\"flash_link_rx_hz\":%u,"
           "\"flash_link_loss_permille\":%u,\"flash_link_peer_age_ms\":%lu,"
           "\"flash_link_rssi_dbm\":%d,\"flash_link_rssi_age_ms\":%lu,"
           "\"flash_link_peer\":\"%s\"}",
           (unsigned long)ignitionDurationMs,
           (unsigned long)countdownDurationMs,
           (unsigned long)(countdownDurationMs / 1000U),
           (unsigned)daqSequencePyroChannel,
           operationModeName(),
           flashLinkMode ? "flash_link" : operationModeName(),
           dataOperationModeName(),
           dataOperationModeNameFor(flashLinkDataModeCode()),
           safetyMode ? 1U : 0U,
           armLock ? 1U : 0U,
           inspectionPassed ? 1U : 0U,
           developerMode ? 1U : 0U,
           developerMode ? 1U : 0U,
           buzzerMuted ? 1U : 0U,
           flashLinkRoleName(),
           (unsigned)flashLinkNodeId,
           (unsigned)flashLinkTargetNodeId,
           stage1Connected ? 1U : 0U,
           stage2Connected ? 1U : 0U,
           (unsigned)kFlashLinkChannel,
           flashLinkRateName,
           flashLinkRateError,
           (unsigned long)kFlashLinkTelemetryHz,
           flashLinkOperational() ? 1U : 0U,
           flashLinkRemoteActive() ? 1U : 0U,
           (unsigned)flashLink.rxHz,
           (unsigned)flashLinkLossPermille(),
           (unsigned long)flashLinkPeerAgeMs(),
           (int)flashLink.rssiDbm,
           (unsigned long)flashRssiAgeMs,
           peerMac);
  return String(json);
}

char* missionUploadBuffer(AsyncWebServerRequest* request) {
  if (!request) return nullptr;
  return static_cast<char*>(request->_tempObject);
}

void clearMissionUploadBuffer(AsyncWebServerRequest* request) {
  if (!request) return;
  if (request->_tempObject != nullptr) heap_caps_free(request->_tempObject);
  request->_tempObject = nullptr;
}

void handleMissionProfilePostBody(AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
  char* buffer = missionUploadBuffer(request);

  if (index == 0) {
    clearMissionUploadBuffer(request);
    if (total == 0) return;
    if (total > kMissionProfileMaxBytes) {
      sendText(request, 413, "application/json", "{\"ok\":0,\"err\":\"MISSION_TOO_LARGE\"}");
      return;
    }
    buffer = static_cast<char*>(
      heap_caps_calloc(
        total + 1U,
        sizeof(char),
        MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (!buffer) {
      buffer = static_cast<char*>(calloc(total + 1U, sizeof(char)));
    }
    if (!buffer) {
      sendText(request, 500, "application/json", "{\"ok\":0,\"err\":\"MISSION_NO_MEMORY\"}");
      return;
    }
    request->_tempObject = buffer;
  }

  if (!buffer) return;

  if (total > kMissionProfileMaxBytes || (index + len) > total) {
    clearMissionUploadBuffer(request);
    sendText(request, 413, "application/json", "{\"ok\":0,\"err\":\"MISSION_TOO_LARGE\"}");
    return;
  }

  if (len > 0 && data) memcpy(buffer + index, data, len);
  if ((index + len) != total) return;

  buffer[total] = '\0';
  if (!isLikelyJsonObject(buffer, total)) {
    clearMissionUploadBuffer(request);
    sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"MISSION_JSON_INVALID\"}");
    return;
  }
  const String profile(buffer, total);
  if (!saveMissionProfileJson(profile)) {
    clearMissionUploadBuffer(request);
    sendText(request, 500, "application/json", "{\"ok\":0,\"err\":\"MISSION_SAVE_FAILED\"}");
    return;
  }
  clearMissionUploadBuffer(request);

  char resp[128];
  snprintf(
    resp,
    sizeof(resp),
    "{\"ok\":1,\"saved\":1,\"bytes\":%u,\"runtime_blocks\":%u}",
    (unsigned)total,
    (unsigned)missionRuntimeBlockCount);
  sendText(request, 200, "application/json", resp);
}

void sendStorageChunkResponse(AsyncWebServerRequest* request, uint32_t offset, uint32_t len, bool withHeader) {
  if (!storageFlush(true)) {
    sendText(request, 500, "application/json", "{\"ok\":0,\"err\":\"FLASH_FLUSH_FAILED\"}");
    return;
  }
  uint32_t usedBytes = 0;
  uint32_t generation = 0;
  {
    StorageLock lock;
    if (!lock) {
      sendText(request, 503, "application/json", "{\"ok\":0,\"err\":\"FLASH_BUSY\"}");
      return;
    }
    storageRefreshStats();
    if (!storageState.ready) {
      sendText(request, 503, "application/json", "{\"ok\":0,\"err\":\"FLASH_NOT_READY\"}");
      return;
    }
    usedBytes = storageState.usedBytes;
    generation = storageState.generation;
  }
  if (offset > usedBytes) {
    sendText(request, 416, "application/json", "{\"ok\":0,\"err\":\"BAD_OFFSET\"}");
    return;
  }
  const uint32_t remain = usedBytes - offset;
  const uint32_t dataBytes = (len == 0 || len > remain) ? remain : len;
  if (dataBytes == 0) {
    sendText(request, 404, "application/json", "{\"ok\":0,\"err\":\"FLASH_EMPTY\"}");
    return;
  }

  StorageBinHeaderV1 hdr{};
  memcpy(hdr.magic, "HWLOGV2", 7);
  hdr.magic[7] = '\0';
  hdr.version = 2;
  hdr.headerSize = sizeof(StorageBinHeaderV1);
  hdr.dataBytes = dataBytes;
  hdr.recordCount = storageCountRecordsInRange(offset, dataBytes);
  hdr.exportedAtMs = millis() - bootMs;
  hdr.samplePeriodMs = 1000UL / kStorageRecordHz;
  hdr.recordMarker = kStorageRecordMarker;

  const size_t headerBytes = withHeader ? sizeof(StorageBinHeaderV1) : 0U;
  AsyncWebServerResponse* response = request->beginChunkedResponse(
    "application/octet-stream",
    [hdr, headerBytes, offset, dataBytes, generation](
      uint8_t* buffer,
      size_t maxLen,
      size_t index
    ) -> size_t {
      const size_t totalBytes = headerBytes + dataBytes;
      if (!buffer || maxLen == 0 || index >= totalBytes) return 0;

      size_t written = 0;
      if (headerBytes > 0 && index < headerBytes) {
        const size_t headRemain = headerBytes - index;
        const size_t headChunk = (headRemain < maxLen) ? headRemain : maxLen;
        memcpy(buffer, reinterpret_cast<const uint8_t*>(&hdr) + index, headChunk);
        written += headChunk;
      }

      if (written >= maxLen) return written;
      const size_t streamIndex = index + written;
      if (streamIndex < headerBytes) return written;

      const size_t dataOffset = streamIndex - headerBytes;
      if (dataOffset >= dataBytes) return written;
      const size_t dataRemain = dataBytes - dataOffset;
      const size_t dataChunk = ((maxLen - written) < dataRemain) ? (maxLen - written) : dataRemain;
      if (dataChunk == 0) return written;
      if (!storageRead(
            offset + (uint32_t)dataOffset,
            buffer + written,
            dataChunk,
            generation)) {
        return written;
      }
      written += dataChunk;
      return written;
    });
  response->addHeader("Content-Disposition", withHeader ? "attachment; filename=\"flash6_log.bin\"" : "inline; filename=\"flash6_chunk.bin\"");
  addCorsHeaders(response);
  request->send(response);
}

String remoteStorageStatusJson() {
  const bool active = flashLinkCanProxyStorage();
  const uint32_t capacity = flashLinkRemoteState.storageCapacityBytes;
  const uint32_t used = flashLinkRemoteState.storageUsedBytes;
  const float pct = capacity > 0
    ? ((float)used * 100.0f / (float)capacity)
    : 0.0f;
  char json[620];
  snprintf(
    json,
    sizeof(json),
    "{\"ok\":1,\"remote\":1,\"ready\":%u,\"busy\":0,\"full\":%u,"
    "\"storage_kind\":\"external_spi_nor\",\"model\":\"W25Q256JVEIQ\","
    "\"chip_capacity_bytes\":%lu,\"capacity_bytes\":%lu,"
    "\"used_bytes\":%lu,\"used_percent\":%.2f,\"record_hz\":%lu,"
    "\"selected_spi_hz\":0,\"session_count\":%u,"
    "\"record_count\":%lu,\"current_file\":\"FLASH6_AVIONICS_STORAGE\","
    "\"link_active\":%u,\"log_path\":\"ail://avionics/w25q256\"}",
    (active && capacity > 0) ? 1U : 0U,
    (capacity > 0 && used >= capacity) ? 1U : 0U,
    (unsigned long)capacity,
    (unsigned long)capacity,
    (unsigned long)used,
    pct,
    (unsigned long)kStorageRecordHz,
    used > 0 ? 1U : 0U,
    (unsigned long)flashLinkRemoteState.storageRecordCount,
    active ? 1U : 0U);
  return String(json);
}

String remoteStorageListJson() {
  const uint32_t capacity = flashLinkRemoteState.storageCapacityBytes;
  const uint32_t used = flashLinkRemoteState.storageUsedBytes;
  const bool ready = flashLinkCanProxyStorage() && capacity > 0;
  const float pct = capacity > 0
    ? ((float)used * 100.0f / (float)capacity)
    : 0.0f;
  FlashLinkStorageListResponseV1 firstBatch{};
  const bool listReady = ready && flashLinkRequestStorageList(0U, firstBatch, 2200U);
  bool listComplete = listReady;
  const uint16_t totalSessions = listReady ? firstBatch.totalSessions : 0U;
  const uint16_t firstListedSession =
    totalSessions > kStorageHttpListMaxItems
      ? (uint16_t)(totalSessions - kStorageHttpListMaxItems)
      : 0U;
  String json;
  json.reserve(4800);
  json += "{\"ok\":1,\"remote\":1,\"ready\":";
  json += ready ? "1" : "0";
  json += ",\"full\":";
  json += (capacity > 0 && used >= capacity) ? "1" : "0";
  json += ",\"capacity_bytes\":";
  json += String(capacity);
  json += ",\"chip_capacity_bytes\":";
  json += String(capacity);
  json += ",\"storage_kind\":\"external_spi_nor\",\"model\":\"W25Q256JVEIQ\"";
  json += ",\"used_bytes\":";
  json += String(used);
  json += ",\"used_percent\":";
  json += String(pct, 2);
  json += ",\"record_hz\":";
  json += String(kStorageRecordHz);
  json += ",\"selected_spi_hz\":0,\"session_count\":";
  json += String(totalSessions);
  json += ",\"listed_from\":";
  json += String(firstListedSession);
  json += ",\"list_available\":";
  json += listReady ? "1" : "0";
  json += ",\"items\":[";
  bool first = true;
  if (listReady && totalSessions > 0U) {
    uint16_t ordinal = firstListedSession;
    while (ordinal < totalSessions) {
      FlashLinkStorageListResponseV1 batch{};
      const bool reusedFirst = ordinal == 0U && firstBatch.startOrdinal == 0U;
      if (reusedFirst) {
        batch = firstBatch;
      } else if (!flashLinkRequestStorageList(ordinal, batch, 2200U)) {
        listComplete = false;
        break;
      }
      if (batch.status != 0U || batch.count == 0U || batch.startOrdinal != ordinal) {
        listComplete = false;
        break;
      }
      for (uint8_t i = 0; i < batch.count && ordinal < totalSessions; ++i, ++ordinal) {
        const FlashLinkStorageListItemV1& item = batch.items[i];
        char name[32];
        storageSessionName(item.sessionId, name, sizeof(name));
        if (!first) json += ",";
        first = false;
        json += "{\"name\":\"";
        json += name;
        json += "\",\"session_id\":";
        json += String(item.sessionId);
        json += ",\"offset\":";
        json += String(item.offsetBytes);
        json += ",\"bytes\":";
        json += String(item.bytes);
        json += ",\"records\":";
        json += String(item.records);
        json += ",\"current\":";
        json += item.current ? "1" : "0";
        json += ",\"started_at_ms\":0,\"remote\":1}";
      }
    }
  }
  json += "],\"list_complete\":";
  json += listComplete ? "1}" : "0}";
  return json;
}

void sendRemoteStorageReadResponse(AsyncWebServerRequest* request, uint32_t offset, uint32_t len) {
  if (!flashLinkCanProxyStorage()) {
    sendText(request, 503, "application/json", "{\"ok\":0,\"err\":\"FLASH_LINK_REMOTE_UNAVAILABLE\"}");
    return;
  }
  const uint16_t requestLen = (uint16_t)min<uint32_t>(
    max<uint32_t>(1U, len),
    kFlashLinkStorageHttpChunkBytes);
  uint8_t bytes[kFlashLinkStorageHttpChunkBytes];
  uint16_t totalLen = 0;
  if (!flashLinkRequestStorageReadWindowed(
        offset,
        requestLen,
        bytes,
        totalLen,
        2600)) {
    sendText(request, 504, "application/json", "{\"ok\":0,\"err\":\"FLASH_LINK_READ_TIMEOUT\"}");
    return;
  }
  if (totalLen != requestLen) {
    sendText(request, 502, "application/json", "{\"ok\":0,\"err\":\"FLASH_LINK_BAD_CHUNK\"}");
    return;
  }
  char b64[((kFlashLinkStorageHttpChunkBytes + 2U) / 3U) * 4U + 1U];
  size_t b64Len = 0;
  if (mbedtls_base64_encode(
        reinterpret_cast<unsigned char*>(b64),
        sizeof(b64),
        &b64Len,
        bytes,
        totalLen) != 0) {
    sendText(request, 500, "application/json", "{\"ok\":0,\"err\":\"BASE64_FAILED\"}");
    return;
  }
  b64[b64Len] = '\0';
  char json[460];
  snprintf(
    json,
    sizeof(json),
    "{\"ok\":1,\"remote\":1,\"off\":%lu,\"len\":%u,\"b64\":\"%s\"}",
    (unsigned long)offset,
    (unsigned)totalLen,
    b64);
  sendText(request, 200, "application/json", json);
}

void setupRoutes() {
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type,Cache-Control,Pragma,Origin,Accept,X-Requested-With");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Private-Network", "true");

  auto options = [](AsyncWebServerRequest* request) { request->send(204); };

  server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    sendText(request, 200, "application/json; charset=utf-8",
             "{\"ok\":1,\"mode\":\"GYRO_BARO_GPS\",\"hint\":\"Use /ws, /data, /baro, or /gps for FLASH6 telemetry\"}");
  });
  server.on("/data", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", telemetryJson(false)); });
  server.on("/stream", HTTP_GET, [](AsyncWebServerRequest* request) {
    char json[kStreamJsonMaxBytes];
    if (buildStreamJsonV2(json, sizeof(json)) == 0) {
      sendText(request, 500, "application/json",
               "{\"ok\":0,\"err\":\"TELEMETRY_OVERFLOW\"}");
      return;
    }
    sendText(request, 200, "application/json", String(json));
  });
  server.on("/protocol", HTTP_GET, [](AsyncWebServerRequest* request) {
    char json[2048];
    const int n = snprintf(json, sizeof(json),
             "{\"name\":\"Flash6-Intelligent-b2\",\"version\":2,\"build_id\":\"v6 b2\","
             "\"firmware\":\"Altis_Intelligent3_firmware1\",\"board\":\"Altis_Intelligent3_b3\","
             "\"fields\":[\"v\",\"seq\",\"ut\",\"p\",\"alt_m\",\"ax\",\"ay\",\"az\","
             "\"gx\",\"gy\",\"gz\",\"gr\",\"gp\",\"gyw\",\"lt\",\"ct\",\"flags\",\"r\","
             "\"st\",\"td\",\"ar\",\"m\",\"chip_temp_c\",\"gps_lat\",\"gps_lon\","
             "\"gps_alt\",\"gps_age_ms\",\"wq\",\"sq\",\"ign_ms\",\"cd_ms\",\"daq_seq_pyro\","
             "\"flash_role\",\"flash_link\",\"flash_rx_hz\",\"flash_loss_permille\","
             "\"flash_peer_age_ms\",\"flash_remote_valid\",\"flash_tx_ok\",\"flash_tx_fail\","
             "\"flash_rx_frames\",\"flash_rx_drop\",\"flash_peer\",\"flash_tx_skipped\","
             "\"flash_crc_errors\",\"flash_queue_drops\",\"flash_cmd_pending\","
             "\"flash_cmd_acked\",\"flash_cmd_failed\",\"flash_cmd_last_code\","
             "\"flash_cmd_last_result\",\"flash_cmd_retries\",\"data_origin\","
             "\"gps_time_valid\",\"gps_utc_ms\",\"flash_rssi_dbm\",\"flash_rssi_age_ms\","
             "\"t\",\"hx_hz\",\"lc_raw\",\"lc_raw_ok\",\"lc_ready\",\"lc_sat\","
             "\"lc_offset_ok\",\"lc_noise\",\"lc_scale\"],"
             "\"flags\":{\"sample\":0,\"baro\":1,\"attitude\":2,\"gps_fix\":3,\"gps_seen\":4,"
             "\"arm\":5,\"igniter\":6,\"user_wait\":7,\"abort\":8,\"safety\":9,"
             "\"arm_lock\":10,\"inspection\":11,\"storage\":12,\"serial\":13,"
             "\"station\":14,\"chip_temp\":15},"
             "\"flash_link\":{\"name\":\"ALTIS INTELLIGENT LINK1\",\"transport\":\"ESP-NOW\","
             "\"channel\":6,\"rate\":\"%s\",\"telemetry_hz\":%lu,"
             "\"pairing\":\"automatic\",\"unicast_encrypted\":1,\"ack_interval\":%u,"
             "\"command_ack\":1,\"command_retry_ms\":140,\"command_max_attempts\":12},"
             "\"storage\":{\"header\":\"HWLOGV2\",\"record_version\":4,\"record_bytes\":84,"
             "\"crc\":\"crc16-ccitt\",\"loadcell\":\"thrustMilliKgf+raw+hz+flags\"}}",
             kFlashLinkEspNowRateName,
             (unsigned long)kFlashLinkTelemetryHz,
             (unsigned)kFlashLinkAckEveryFrames);
    if (n <= 0 || (size_t)n >= sizeof(json)) {
      sendText(request, 500, "application/json",
               "{\"ok\":0,\"err\":\"PROTOCOL_OVERFLOW\"}");
      return;
    }
    sendText(request, 200, "application/json", String(json));
  });
  server.on("/data_full", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", telemetryJson(true)); });
  server.on("/graphic_data", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", telemetryJson(false)); });
  server.on("/json", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", telemetryJson(false)); });
  server.on("/health", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", healthJson()); });
  server.on("/rates", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", ratesJson()); });
  server.on("/wifi_info", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", wifiInfoJson()); });
  server.on("/baro", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", baroJson()); });
  server.on("/gps", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", gpsJson()); });
  server.on("/loadcell", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "application/json", loadcellJson()); });
  server.on("/servo", HTTP_GET, [](AsyncWebServerRequest* request) {
    const bool hasChannel = request->hasParam("ch") || request->hasParam("id") || request->hasParam("channel");
    const bool hasAngle = request->hasParam("deg") || request->hasParam("angle");
    if (!hasChannel && !hasAngle) {
      sendText(request, 200, "application/json", servoJson());
      return;
    }
    if (!hasChannel || !hasAngle) {
      sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"SERVO_REQUIRES_CH_AND_DEG\"}");
      return;
    }
    long channelRaw = 0;
    long angleRaw = 0;
    const bool channelOk =
      requestParamLong(request, "ch", channelRaw) ||
      requestParamLong(request, "id", channelRaw) ||
      requestParamLong(request, "channel", channelRaw);
    const bool angleOk =
      requestParamLong(request, "deg", angleRaw) ||
      requestParamLong(request, "angle", angleRaw);
    if (!channelOk || !angleOk) {
      sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"BAD_SERVO_ARGUMENT\"}");
      return;
    }
    if (channelRaw < 1 || channelRaw > kServoChannelCount || angleRaw < 0 || angleRaw > 180) {
      sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"BAD_SERVO_ARGUMENT\"}");
      return;
    }
    if (forwardFlashLinkHttpCommand(
          request,
          FlashLinkCommandCode::SetServo,
          channelRaw,
          angleRaw)) {
      return;
    }
    if (!setServoAngle((uint8_t)channelRaw, (uint8_t)angleRaw)) {
      sendText(request, 503, "application/json", "{\"ok\":0,\"err\":\"SERVO_NOT_READY\"}");
      return;
    }
    char json[112];
    snprintf(json, sizeof(json),
             "{\"ok\":1,\"ch\":%ld,\"id\":%ld,\"pin\":%d,\"deg\":%ld,\"angle\":%ld}",
             channelRaw,
             channelRaw,
             kServoPins[channelRaw - 1],
             angleRaw,
             angleRaw);
    sendText(request, 200, "application/json", json);
  });
  server.on("/gps_reset", HTTP_GET, [](AsyncWebServerRequest* request) {
    gpsApplyConfig(0, !serialStream);
    syncGpsTelemetry();
    sendText(request, 200, "application/json", gpsJson());
  });
  server.on("/baro_zero", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (forwardFlashLinkHttpCommand(request, FlashLinkCommandCode::BaroZero)) {
      return;
    }
    resetBaroBase();
    sendText(request, 200, "application/json", baroJson());
  });
  server.on("/baro_reference", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (request->hasParam("sea_level_hpa")) {
      const float hpa = request->getParam("sea_level_hpa")->value().toFloat();
      if (flashLinkGroundRole()) {
        if (!isfinite(hpa) || hpa < 850.0f || hpa > 1100.0f) {
          sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"BAD_SEA_LEVEL_HPA\"}");
          return;
        }
        forwardFlashLinkHttpCommand(
          request,
          FlashLinkCommandCode::BaroReference,
          (int32_t)lroundf(hpa * 100.0f));
        return;
      }
      if (!setSeaLevelHpa(hpa)) {
        sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"BAD_SEA_LEVEL_HPA\"}");
        return;
      }
    } else if (forwardFlashLinkHttpCommand(request, FlashLinkCommandCode::BaroZero)) {
      return;
    }
    resetBaroBase();
    sendText(request, 200, "application/json", baroJson());
  });
  server.on("/ping", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "text/plain", "OK"); });
  server.on("/js_boot", HTTP_GET, [](AsyncWebServerRequest* request) { request->send(204); });
  server.on("/js_boot", HTTP_POST, [](AsyncWebServerRequest* request) { request->send(204); });
  server.on("/generate_204", HTTP_GET, [](AsyncWebServerRequest* request) { request->send(204); });
  server.on("/gen_204", HTTP_GET, [](AsyncWebServerRequest* request) { request->send(204); });
  server.on("/hotspot-detect.html", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "text/html; charset=utf-8", "Success"); });
  server.on("/ncsi.txt", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "text/plain; charset=utf-8", "Microsoft NCSI"); });
  server.on("/connecttest.txt", HTTP_GET, [](AsyncWebServerRequest* request) { sendText(request, 200, "text/plain; charset=utf-8", "Microsoft NCSI"); });

  server.on("/gyro_zero", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (request->hasParam("reset") && request->getParam("reset")->value().toInt() != 0) {
      if (forwardFlashLinkHttpCommand(
            request,
            FlashLinkCommandCode::GyroZeroReset)) {
        return;
      }
      clearGyroZero();
    } else {
      float r = request->hasParam("roll") ? request->getParam("roll")->value().toFloat() : 0.0f;
      float p = request->hasParam("pitch") ? request->getParam("pitch")->value().toFloat() : 0.0f;
      float y = request->hasParam("yaw") ? request->getParam("yaw")->value().toFloat() : 0.0f;
      if (forwardFlashLinkHttpCommand(
            request,
            FlashLinkCommandCode::GyroZero,
            (int32_t)lroundf(r * 1000.0f),
            (int32_t)lroundf(p * 1000.0f),
            (int32_t)lroundf(y * 1000.0f))) {
        return;
      }
      setGyroZeroTarget(r, p, y);
    }
    char json[160];
    snprintf(json, sizeof(json),
             "{\"ok\":1,\"zero\":{\"roll\":%.2f,\"pitch\":%.2f,\"yaw\":%.2f}}",
             zeroRoll, zeroPitch, zeroYaw);
    sendText(request, 200, "application/json", json);
  });

  server.on("/set", HTTP_GET, [](AsyncWebServerRequest* request) {
    const uint8_t oldMode = operationModeCode();
    const uint8_t oldRole = flashLinkRoleCode();
    const uint8_t oldDataMode = flashLinkDataModeCode();
    const uint8_t oldNodeId = flashLinkNodeId;
    const uint8_t oldTargetNodeId = flashLinkTargetNodeId;
    const bool forwardRemote = flashLinkGroundRole();
    bool remoteRequested = false;
    bool remoteQueued = true;
    auto queueRemote = [&](FlashLinkCommandCode code, int32_t value) {
      remoteRequested = true;
      if (!flashLinkQueueCommand(code, value)) remoteQueued = false;
    };
    if (request->hasParam("stream")) {
      setSerialStreamRequested(truthy(request->getParam("stream")->value()));
    }
    if (request->hasParam("dev") ||
        request->hasParam("developer") ||
        request->hasParam("developer_mode")) {
      const String value = request->hasParam("dev")
        ? request->getParam("dev")->value()
        : (request->hasParam("developer")
            ? request->getParam("developer")->value()
            : request->getParam("developer_mode")->value());
      setDeveloperMode(truthy(value));
    }
    if (request->hasParam("safe")) {
      const bool value = truthy(request->getParam("safe")->value());
      if (forwardRemote) queueRemote(FlashLinkCommandCode::SetSafety, value ? 1 : 0);
      else safetyMode = value;
    }
    if (request->hasParam("arm_lock")) {
      const bool value = truthy(request->getParam("arm_lock")->value());
      if (forwardRemote) queueRemote(FlashLinkCommandCode::SetArmLock, value ? 1 : 0);
      else armLock = value;
    }
    if (request->hasParam("inspection") || request->hasParam("insp")) {
      const String value = request->hasParam("inspection")
        ? request->getParam("inspection")->value()
        : request->getParam("insp")->value();
      if (forwardRemote) {
        queueRemote(
          FlashLinkCommandCode::SetInspection,
          truthy(value) ? 1 : 0);
      } else {
        inspectionPassed = truthy(value);
      }
    }
    if (request->hasParam("mute")) {
      const bool value = truthy(request->getParam("mute")->value());
      if (forwardRemote) queueRemote(FlashLinkCommandCode::SetMute, value ? 1 : 0);
      else setBuzzerMuted(value);
    }
    if (request->hasParam("ign_ms")) {
      long value = 0;
      if (!requestParamLong(request, "ign_ms", value)) {
        sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"BAD_IGN_MS\"}");
        return;
      }
      if (forwardRemote) queueRemote(FlashLinkCommandCode::SetIgnitionMs, value);
      else setIgnitionDurationMs(value);
    }
    if (request->hasParam("cd_ms")) {
      long value = 0;
      if (!requestParamLong(request, "cd_ms", value)) {
        sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"BAD_CD_MS\"}");
        return;
      }
      if (forwardRemote) queueRemote(FlashLinkCommandCode::SetCountdownMs, value);
      else setCountdownDurationMs(value);
    }
    const char* pyroKey = request->hasParam("daq_seq_pyro")
      ? "daq_seq_pyro"
      : (request->hasParam("daq_pyro")
          ? "daq_pyro"
          : (request->hasParam("pyro_ch") ? "pyro_ch" : nullptr));
    if (pyroKey) {
      long value = 0;
      if (!requestParamLong(request, pyroKey, value)) {
        sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"BAD_PYRO_CH\"}");
        return;
      }
      if (forwardRemote) queueRemote(FlashLinkCommandCode::SetPyroChannel, value);
      else setDaqSequencePyroChannel(value);
    }
    if (request->hasParam("op_mode")) setOperationMode(request->getParam("op_mode")->value());
    if (request->hasParam("mode")) setOperationMode(request->getParam("mode")->value());
    if (request->hasParam("flash_link_role")) setFlashLinkRole(request->getParam("flash_link_role")->value());
    if (request->hasParam("fl_role")) setFlashLinkRole(request->getParam("fl_role")->value());
    if (request->hasParam("flash_link_node_id")) setFlashLinkNodeId(request->getParam("flash_link_node_id")->value());
    if (request->hasParam("fl_node")) setFlashLinkNodeId(request->getParam("fl_node")->value());
    if (request->hasParam("flash_link_target_node_id")) setFlashLinkTargetNodeId(request->getParam("flash_link_target_node_id")->value());
    if (request->hasParam("fl_target")) setFlashLinkTargetNodeId(request->getParam("fl_target")->value());
    const char* dataModeKey = request->hasParam("flash_link_data_mode")
      ? "flash_link_data_mode"
      : (request->hasParam("fl_data_mode")
          ? "fl_data_mode"
          : (request->hasParam("data_mode") ? "data_mode" : nullptr));
    if (dataModeKey) {
      const String dataModeValue = request->getParam(dataModeKey)->value();
      String normalizedDataMode = dataModeValue;
      normalizedDataMode.trim();
      normalizedDataMode.toLowerCase();
      normalizedDataMode.replace('-', '_');
      const bool validDataMode =
        normalizedDataMode == "flight" || normalizedDataMode == "1" ||
        normalizedDataMode == "daq" || normalizedDataMode == "0";
      if (forwardRemote && validDataMode) {
        queueRemote(
          FlashLinkCommandCode::SetDataMode,
          (normalizedDataMode == "flight" || normalizedDataMode == "1") ? 1 : 0);
      } else {
        setFlashLinkDataMode(dataModeValue);
      }
    }
    const bool modeChanged = oldMode != operationModeCode();
    const bool roleChanged = oldRole != flashLinkRoleCode();
    const bool dataModeChanged = oldDataMode != flashLinkDataModeCode();
    const bool nodeIdChanged = oldNodeId != flashLinkNodeId;
    const bool targetNodeChanged = oldTargetNodeId != flashLinkTargetNodeId;
    const bool communicationChanged = modeChanged || roleChanged || dataModeChanged ||
      nodeIdChanged || targetNodeChanged;
    const bool restartRequired =
      modeChanged ||
      dataModeChanged ||
      (nodeIdChanged && operationModeCode() == 2U && flashLinkRole == FlashLinkRole::Avionics) ||
      (roleChanged && operationModeCode() == 2U);
    if (communicationChanged) {
      saveSequenceSettings();
    }
    if (restartRequired) {
      saveBootOnceMode(operationModeName());
      pendingRestart = true;
      restartAtMs = millis() + 900U;
    }
    if (remoteRequested) {
      if (!remoteQueued) {
        sendText(
          request,
          503,
          "application/json",
          "{\"ok\":0,\"err\":\"FLASH_LINK_COMMAND_QUEUE_FULL\"}");
      } else {
        sendText(
          request,
          202,
          "application/json",
          "{\"ok\":1,\"queued\":1,\"target\":\"avionics\"}");
      }
      return;
    }
    sendText(request, 200, "text/plain", String("STREAM=") + (serialStream ? "1" : "0") +
      ", SAFE=" + (safetyMode ? "1" : "0") +
      ", ARM_LOCK=" + (armLock ? "1" : "0") +
      ", INSPECTION=" + (inspectionPassed ? "1" : "0") +
      ", DEV_MODE=" + (developerMode ? "1" : "0") +
      ", OP_MODE=" + operationModeName() +
      ", FLASH_LINK_ROLE=" + flashLinkRoleName() +
      ", FLASH_LINK_NODE=" + String(flashLinkNodeId) +
      ", FLASH_LINK_TARGET=" + String(flashLinkTargetNodeId) +
      ", FLASH_LINK_DATA_MODE=" + dataOperationModeNameFor(flashLinkDataModeCode()) +
      ", RESTART=" + (restartRequired ? "1" : "0") +
      ", MUTE=" + (buzzerMuted ? "1" : "0") +
      ", IGN_MS=" + String(ignitionDurationMs) +
      ", CD_MS=" + String(countdownDurationMs) +
      ", DAQ_SEQ_PYRO=" + String(daqSequencePyroChannel));
  });

  server.on("/buzzer", HTTP_GET, [](AsyncWebServerRequest* request) {
    String pattern = request->hasParam("pattern") ? request->getParam("pattern")->value() : "";
    pattern.toLowerCase();
    if (pattern == "find" || pattern == "finder" || pattern == "locate" || request->hasParam("find")) {
      const bool loop = request->hasParam("loop") ? truthy(request->getParam("loop")->value()) : false;
      if (forwardFlashLinkHttpCommand(
            request,
            FlashLinkCommandCode::BuzzerFind,
            loop ? 1 : 0)) {
        return;
      }
      buzzerPlayFindMelody(loop);
      char json[80];
      snprintf(json, sizeof(json), "{\"ok\":1,\"mode\":\"find\",\"loop\":%u,\"muted\":%u}", loop ? 1U : 0U, buzzerMuted ? 1U : 0U);
      sendText(request, 200, "application/json", json);
      return;
    }

    const long hzRaw = request->hasParam("hz") ? request->getParam("hz")->value().toInt() : kBuzzerDefaultHz;
    long msRaw = 0;
    if (request->hasParam("ms")) msRaw = request->getParam("ms")->value().toInt();
    else if (request->hasParam("dur")) msRaw = request->getParam("dur")->value().toInt();
    else if (request->hasParam("duration")) msRaw = request->getParam("duration")->value().toInt();
    const uint16_t hz = clampBuzzerHz(hzRaw);
    const uint16_t ms = clampBuzzerMs(msRaw);
    if (forwardFlashLinkHttpCommand(
          request,
          FlashLinkCommandCode::BuzzerTone,
          hz,
          ms)) {
      return;
    }
    buzzerPlayTone(hz, ms);
    char json[112];
    snprintf(json, sizeof(json), "{\"ok\":1,\"mode\":\"tone\",\"hz\":%u,\"ms\":%u,\"muted\":%u}", hz, ms, buzzerMuted ? 1U : 0U);
    sendText(request, 200, "application/json", json);
  });

  server.on("/buzzer_stop", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (forwardFlashLinkHttpCommand(request, FlashLinkCommandCode::BuzzerStop)) {
      return;
    }
    buzzerStop();
    sendText(request, 200, "application/json", "{\"ok\":1,\"mode\":\"stop\"}");
  });

  server.on("/settings", HTTP_GET, [](AsyncWebServerRequest* request) {
    sendText(request, 200, "application/json", settingsJson());
  });

  server.on("/chip_temp", HTTP_GET, [](AsyncWebServerRequest* request) {
    char json[144];
    const bool valid = isfinite(snap.chipTempC);
    snprintf(json, sizeof(json),
             "{\"ok\":1,\"source\":\"esp32s3_internal\",\"chip_temp_c\":%.1f,\"imu_temp_c\":%.1f,\"valid\":%u}",
             valid ? snap.chipTempC : 0.0f,
             isfinite(snap.imuTempC) ? snap.imuTempC : 0.0f,
             valid ? 1U : 0U);
    sendText(request, 200, "application/json", json);
  });

  server.on("/loadcell_zero", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!saveLoadcellZeroFromCurrent()) {
      sendText(request, 409, "text/plain", loadcellShouldRun() ? "LOADCELL_RAW_NOT_READY" : "LOADCELL_INACTIVE_DAQ_ONLY");
      return;
    }
    char text[96];
    snprintf(text, sizeof(text), "OFFSET=%ld RAW=%ld", (long)loadcellOffset, (long)loadcellRaw);
    sendText(request, 200, "text/plain", text);
  });

  server.on("/loadcell_noise_zero", HTTP_GET, [](AsyncWebServerRequest* request) {
    char text[80];
    snprintf(text, sizeof(text), "NOISE=%.3f RAW=%ld", kLoadcellNoiseDeadbandKg, (long)loadcellRaw);
    sendText(request, 200, "text/plain", text);
  });

  server.on("/loadcell_cal", HTTP_GET, [](AsyncWebServerRequest* request) {
    const float weight = request->hasParam("weight")
      ? request->getParam("weight")->value().toFloat()
      : 0.0f;
    if (!saveLoadcellScaleFromWeight(weight)) {
      sendText(request, 409, "text/plain", loadcellShouldRun() ? "LOADCELL_CAL_BAD_SAMPLE_OR_WEIGHT" : "LOADCELL_INACTIVE_DAQ_ONLY");
      return;
    }
    char text[128];
    snprintf(text, sizeof(text), "SCALE=%.6f OFFSET=%ld RAW=%ld", loadcellScale, (long)loadcellOffset, (long)loadcellRaw);
    sendText(request, 200, "text/plain", text);
  });

  server.on("/loadcell_reset", HTTP_GET, [](AsyncWebServerRequest* request) {
    resetLoadcellConfig();
    char text[112];
    snprintf(text, sizeof(text), "RESET SCALE=%.6f OFFSET=%ld NOISE=%.3f", loadcellScale, (long)loadcellOffset, kLoadcellNoiseDeadbandKg);
    sendText(request, 200, "text/plain", text);
  });

  server.on("/precount", HTTP_GET, [](AsyncWebServerRequest* request) {
    const bool requestedWaiting =
      request->hasParam("uw")
        ? truthy(request->getParam("uw")->value())
        : sequenceUserWaiting;
    uint32_t requestedCountdownMs = countdownDurationMs;
    if (request->hasParam("cd")) {
      requestedCountdownMs = clampU32(
        request->getParam("cd")->value().toInt(),
        0,
        60000,
        countdownDurationMs);
    }
    if (forwardFlashLinkHttpCommand(
          request,
          FlashLinkCommandCode::SetPrecount,
          requestedWaiting ? 1 : 0,
          (int32_t)requestedCountdownMs)) {
      return;
    }
    sequenceUserWaiting = requestedWaiting;
    if (sequenceUserWaiting && requestedCountdownMs >= 3000) {
      countdownDurationMs = requestedCountdownMs;
    }
    char json[112];
    snprintf(json, sizeof(json), "{\"ok\":1,\"uw\":%u,\"td\":%ld}", sequenceUserWaiting ? 1U : 0U, (long)sequenceTdMs(millis()));
    sendText(request, 200, "application/json", json);
  });

  server.on("/countdown_start", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (forwardFlashLinkHttpCommand(
          request,
          FlashLinkCommandCode::StartCountdown)) {
      return;
    }
    if (!startCountdownRuntime(millis())) {
      sendText(request, safetyMode ? 403 : 409, "text/plain", safetyMode ? "SAFETY_MODE" : "BUSY");
      return;
    }
    sendText(request, 200, "text/plain", "COUNTDOWN_STARTED");
  });

  server.on("/ignite", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (forwardFlashLinkHttpCommand(request, FlashLinkCommandCode::Ignite)) {
      return;
    }
    if (!startFiringRuntime(millis(), daqSequencePyroChannel)) {
      sendText(request, 403, "text/plain", "SAFETY_MODE");
      return;
    }
    sendText(request, 200, "text/plain", "IGNITION_IMMEDIATE");
  });

  server.on("/force_ignite", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (forwardFlashLinkHttpCommand(
          request,
          FlashLinkCommandCode::ForceIgnite)) {
      return;
    }
    if (!startFiringRuntime(millis(), daqSequencePyroChannel)) {
      sendText(request, 403, "text/plain", "SAFETY_MODE");
      return;
    }
    sendText(request, 200, "text/plain", "FORCE_IGNITION_OK");
  });

  server.on("/abort", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (forwardFlashLinkHttpCommand(
          request,
          FlashLinkCommandCode::Abort,
          1)) {
      return;
    }
    abortSequenceRuntime(1);
    sendText(request, 200, "text/plain", "ABORTED");
  });

  server.on("/sequence_end", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (forwardFlashLinkHttpCommand(
          request,
          FlashLinkCommandCode::SequenceEnd)) {
      return;
    }
    clearSequenceRuntime();
    sendText(request, 200, "text/plain", "SEQUENCE_ENDED");
  });

  server.on("/pyro_test", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!flashLinkGroundRole() && safetyMode) {
      sendText(request, 403, "text/plain", "SAFETY_MODE");
      return;
    }
    long chRaw = daqSequencePyroChannel;
    if (request->hasParam("ch") && !requestParamLong(request, "ch", chRaw)) {
      sendText(request, 400, "text/plain", "BAD_PYRO_ARGUMENT");
      return;
    }
    const uint8_t ch = clampPyroChannel(chRaw);
    uint32_t ms = 500;
    long msRaw = 0;
    if (request->hasParam("ms")) {
      if (!requestParamLong(request, "ms", msRaw)) {
        sendText(request, 400, "text/plain", "BAD_PYRO_ARGUMENT");
        return;
      }
      ms = clampU32(msRaw, 10, 30000, 500);
    } else if (request->hasParam("dur")) {
      if (!requestParamLong(request, "dur", msRaw)) {
        sendText(request, 400, "text/plain", "BAD_PYRO_ARGUMENT");
        return;
      }
      ms = clampU32(msRaw, 10, 30000, 500);
    } else if (request->hasParam("dur_ms")) {
      if (!requestParamLong(request, "dur_ms", msRaw)) {
        sendText(request, 400, "text/plain", "BAD_PYRO_ARGUMENT");
        return;
      }
      ms = clampU32(msRaw, 10, 30000, 500);
    }
    if (forwardFlashLinkHttpCommand(
          request,
          FlashLinkCommandCode::PyroTest,
          ch,
          (int32_t)ms)) {
      return;
    }
    const uint32_t nowMs = millis();
    sequenceRelayMask = pyroMaskForChannel(ch);
    sequenceRelayHoldUntilMs = nowMs + ms;
    applyPyroOutputs(nowMs);
    buzzerPlayTone(2200, min<uint32_t>(180U, ms));
    sendText(request, 200, "text/plain", String("PYRO_TEST CH=") + ch + " MS=" + ms);
  });

  server.on("/storage/spi_flash/status", HTTP_GET, [](AsyncWebServerRequest* request) {
    sendText(request, 200, "application/json", storageStatusJson());
  });
  server.on("/storage/spi_flash/list", HTTP_GET, [](AsyncWebServerRequest* request) {
    sendText(request, 200, "application/json", storageListJson());
  });
  server.on("/storage/spi_flash/read", HTTP_GET, [](AsyncWebServerRequest* request) {
    const long offRaw = request->hasParam("off") ? request->getParam("off")->value().toInt() : 0L;
    const long lenRaw = request->hasParam("len") ? request->getParam("len")->value().toInt() : 0L;
    const uint32_t off = offRaw > 0 ? (uint32_t)offRaw : 0U;
    const uint32_t len = lenRaw > 0 ? (uint32_t)lenRaw : 0U;
    sendStorageChunkResponse(request, off, len, false);
  });
  server.on("/storage/spi_flash/export.bin", HTTP_GET, [](AsyncWebServerRequest* request) {
    const long offRaw = request->hasParam("off") ? request->getParam("off")->value().toInt() : 0L;
    const long lenRaw = request->hasParam("len") ? request->getParam("len")->value().toInt() : 0L;
    const uint32_t off = offRaw > 0 ? (uint32_t)offRaw : 0U;
    const uint32_t len = lenRaw > 0 ? (uint32_t)lenRaw : 0U;
    sendStorageChunkResponse(request, off, len, true);
  });
  server.on("/storage/spi_flash/remote/status", HTTP_GET, [](AsyncWebServerRequest* request) {
    sendText(request, 200, "application/json", remoteStorageStatusJson());
  });
  server.on("/storage/spi_flash/remote/list", HTTP_GET, [](AsyncWebServerRequest* request) {
    sendText(request, 200, "application/json", remoteStorageListJson());
  });
  server.on("/storage/spi_flash/remote/read", HTTP_GET, [](AsyncWebServerRequest* request) {
    const long offRaw = request->hasParam("off") ? request->getParam("off")->value().toInt() : 0L;
    const long lenRaw = request->hasParam("len") ? request->getParam("len")->value().toInt() : 0L;
    const uint32_t off = offRaw > 0 ? (uint32_t)offRaw : 0U;
    const uint32_t len = lenRaw > 0 ? (uint32_t)lenRaw : kFlashLinkStorageChunkBytes;
    sendRemoteStorageReadResponse(request, off, len);
  });
  server.on("/storage/spi_flash/init", HTTP_POST, [](AsyncWebServerRequest* request) {
    if (forwardFlashLinkHttpCommand(request, FlashLinkCommandCode::StorageReset)) {
      return;
    }
    if (!storageReset()) {
      sendText(request, 500, "application/json", "{\"ok\":0,\"err\":\"FLASH_RESET_FAILED\"}");
      return;
    }
    sendText(request, 200, "application/json", "{\"ok\":1,\"msg\":\"FLASH_RESET_DONE\"}");
  });

  server.on("/mission_profile", HTTP_GET, [](AsyncWebServerRequest* request) {
    sendText(request, 200, "application/json; charset=utf-8", missionProfileJson());
  });
  server.on(
    "/mission_profile",
    HTTP_POST,
    [](AsyncWebServerRequest* request) {
      if (request->contentLength() == 0) {
        sendText(request, 400, "application/json", "{\"ok\":0,\"err\":\"MISSION_EMPTY_BODY\"}");
      }
    },
    nullptr,
    handleMissionProfilePostBody);

  const char* textOkRoutes[] = {
    "/launcher", "/ign_seq", "/easter_bgm"
  };
  for (const char* route : textOkRoutes) {
    server.on(route, HTTP_GET, [route](AsyncWebServerRequest* request) {
      sendText(request, 200, "text/plain", "GYRO_ONLY_OK");
    });
  }

  server.on("/reset", HTTP_GET, [](AsyncWebServerRequest* request) {
    pendingRestart = true;
    restartAtMs = millis() + 150;
    sendText(request, 200, "text/plain", "RESETTING");
  });

  server.onNotFound([](AsyncWebServerRequest* request) {
    if (request->method() == HTTP_OPTIONS) {
      request->send(204);
      return;
    }
    sendText(request, 404, "application/json", "{\"ok\":0,\"err\":\"NOT_FOUND\"}");
  });

  server.on("/data", HTTP_OPTIONS, options);
  server.on("/data_full", HTTP_OPTIONS, options);
  server.on("/wifi_info", HTTP_OPTIONS, options);
  server.on("/health", HTTP_OPTIONS, options);
  server.on("/rates", HTTP_OPTIONS, options);
  server.on("/settings", HTTP_OPTIONS, options);
  server.on("/chip_temp", HTTP_OPTIONS, options);
  server.on("/baro", HTTP_OPTIONS, options);
  server.on("/gps", HTTP_OPTIONS, options);
  server.on("/gps_reset", HTTP_OPTIONS, options);
  server.on("/servo", HTTP_OPTIONS, options);
  server.on("/baro_zero", HTTP_OPTIONS, options);
  server.on("/baro_reference", HTTP_OPTIONS, options);
  server.on("/mission_profile", HTTP_OPTIONS, options);
  server.on("/storage/spi_flash/status", HTTP_OPTIONS, options);
  server.on("/storage/spi_flash/list", HTTP_OPTIONS, options);
  server.on("/storage/spi_flash/read", HTTP_OPTIONS, options);
  server.on("/storage/spi_flash/export.bin", HTTP_OPTIONS, options);
  server.on("/storage/spi_flash/remote/status", HTTP_OPTIONS, options);
  server.on("/storage/spi_flash/remote/list", HTTP_OPTIONS, options);
  server.on("/storage/spi_flash/remote/read", HTTP_OPTIONS, options);
  server.on("/storage/spi_flash/init", HTTP_OPTIONS, options);
  server.on("/precount", HTTP_OPTIONS, options);
  server.on("/countdown_start", HTTP_OPTIONS, options);
  server.on("/ignite", HTTP_OPTIONS, options);
  server.on("/force_ignite", HTTP_OPTIONS, options);
  server.on("/pyro_test", HTTP_OPTIONS, options);
  server.on("/abort", HTTP_OPTIONS, options);
  server.on("/sequence_end", HTTP_OPTIONS, options);

  ws.onEvent([](AsyncWebSocket*, AsyncWebSocketClient* client, AwsEventType type, void*, uint8_t*, size_t) {
    if (type == WS_EVT_CONNECT) {
      client->setCloseClientOnQueueFull(true);
      if (client->canSend()) client->text(telemetryJson(true));
      Serial.printf("[WS] connect id=%u\n", client->id());
    } else if (type == WS_EVT_DISCONNECT) {
      Serial.printf("[WS] disconnect id=%u\n", client->id());
    }
  });
  server.addHandler(&ws);
}
