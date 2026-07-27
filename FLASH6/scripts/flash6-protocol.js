/* FLASH6 wire protocol decoders. */
    // =====================
    // 통신: WebSocket 스트림
    // =====================
    function decodeFlashLinkStageSnapshot(snapshot){
      if(!Array.isArray(snapshot) || snapshot.length < 31) return null;
      const finiteOrNull = (index)=>{
        if(snapshot[index] == null || snapshot[index] === "") return null;
        const value = Number(snapshot[index]);
        return isFinite(value) ? value : null;
      };
      const nodeId = Number(snapshot[0]);
      if(nodeId !== 1 && nodeId !== 2) return null;
      const phaseCode = finiteOrNull(15);
      const alarmSeq = Number(snapshot[26]) || 0;
      return {
        stage_node_id:nodeId,
        stage_connected:Number(snapshot[1]) ? 1 : 0,
        stage_valid:Number(snapshot[2]) ? 1 : 0,
        stage_age_ms:finiteOrNull(3),
        alt_m:finiteOrNull(4),
        ax:finiteOrNull(5),
        ay:finiteOrNull(6),
        az:finiteOrNull(7),
        gx:0,
        gy:0,
        gz:0,
        gr:finiteOrNull(8),
        gp:finiteOrNull(9),
        gyw:finiteOrNull(10),
        ga:1,
        attitude_q:[11, 12, 13, 14].every((index)=>finiteOrNull(index) != null)
          ? [finiteOrNull(11), finiteOrNull(12), finiteOrNull(13), finiteOrNull(14)]
          : null,
        flight_phase_code:phaseCode,
        flight_phase:phaseCode != null && FLIGHT_PHASE_CODE_NAMES[phaseCode]
          ? FLIGHT_PHASE_CODE_NAMES[phaseCode]
          : null,
        vertical_speed_mps:finiteOrNull(16),
        deployment_state:finiteOrNull(17) ?? 0,
        deployment_flags:finiteOrNull(18) ?? 0,
        r:finiteOrNull(19) ?? 0,
        st:finiteOrNull(20) ?? 0,
        td:finiteOrNull(21) ?? 0,
        s:Number(snapshot[22]) ? 1 : 0,
        sp:Number(snapshot[23]) ? 1 : 0,
        ignition_delay_valid:Number(snapshot[24]) ? 1 : 0,
        ignition_delay_ms:finiteOrNull(25) ?? 0,
        mission_alarm_seq:alarmSeq,
        mission_alarm_ts:0,
        mission_alarm_block:finiteOrNull(27) ?? 0,
        mission_alarm_title:snapshot[28] != null ? String(snapshot[28]) : "",
        mission_alarm_message:snapshot[29] != null ? String(snapshot[29]) : "",
        gps_lat:null,
        gps_lon:null,
        gps_alt:null,
        gps_fix:0,
        gps_seen:0,
        gps_age_ms:null,
        data_mode:"flight",
        ar:0,
        stage_rx_seq:finiteOrNull(30) ?? 0,
        stage_rx_hz:finiteOrNull(31),
        chip_temp_c:finiteOrNull(32),
        chip_temp_ok:Number(snapshot[33]) ? 1 : 0,
        lt:finiteOrNull(34),
        ct:finiteOrNull(35),
        reset_code:finiteOrNull(36),
        reset_reason:finiteOrNull(36) === 9
          ? "BROWNOUT"
          : (finiteOrNull(36) === 23 ? "POWER_GLITCH" : null),
        boot_session:finiteOrNull(37),
        stage_loss_permille:finiteOrNull(38),
        stage_rssi_dbm:finiteOrNull(39),
        stage_rssi_age_ms:finiteOrNull(40),
        data_origin:"avionics"
      };
    }
    function decodeFlash6ProtocolFrame(frame){
      if(!Array.isArray(frame)) return frame;
      if(Number(frame[0]) !== 2 || frame.length < 32) return null;
      const flags = (Number(frame[16]) || 0) & 0xFFFF;
      const bit = (index)=>((flags >>> index) & 1);
      // Builds through b18 used frame[21] for the displayed data mode. In
      // disconnected avionics A.I LINK mode that value is still FLIGHT/DAQ,
      // so treating it as the board operation mode incorrectly turns AIL OFF
      // after a reload. b19 appends the authoritative operation/data modes.
      const legacyMode = Number(frame[21]) || 0;
      const hasExplicitModes = frame.length > 95 &&
        isFinite(Number(frame[94])) &&
        isFinite(Number(frame[95]));
      const mode = hasExplicitModes ? Number(frame[94]) : legacyMode;
      const dataModeCode = hasExplicitModes ? Number(frame[95]) : legacyMode;
      const opMode = mode === 2 ? "flash_link" : (mode === 1 ? "flight" : "daq");
      const flashRoleCode = Number(frame[32]) || 0;
      const flashLinked = Number(frame[33]) || 0;
      const flashRemoteValid = Number(frame[37]) || 0;
      const linkMode = (mode === 2 || flashLinked || flashRemoteValid) ? "flash_link" : opMode;
      const dataMode = dataModeCode === 1 ? "flight" : (dataModeCode === 0 ? "daq" : null);
      const resetCode = (frame[96] != null && isFinite(Number(frame[96])))
        ? Number(frame[96])
        : null;
      const streamThrust = (frame[57] != null && isFinite(Number(frame[57]))) ? Number(frame[57]) : 0;
      const streamHxHz = (frame[58] != null && isFinite(Number(frame[58]))) ? Number(frame[58]) : 0;
      const streamLoadcellRaw = (frame[59] != null && isFinite(Number(frame[59]))) ? Number(frame[59]) : null;
      const stageTelemetry = [
        decodeFlashLinkStageSnapshot(frame[91]),
        decodeFlashLinkStageSnapshot(frame[92])
      ].filter(Boolean);
      return {
        proto:2,
        seq:Number(frame[1]) || 0,
        ut:Number(frame[2]) || 0,
        t:streamThrust,
        thrust:streamThrust,
        hz:streamHxHz,
        hx_hz:streamHxHz,
        lc_raw:streamLoadcellRaw,
        lc_raw_ok:(frame[60] != null) ? (Number(frame[60]) ? 1 : 0) : 0,
        lc_ready:(frame[61] != null) ? (Number(frame[61]) ? 1 : 0) : null,
        lc_sat:(frame[62] != null) ? (Number(frame[62]) ? 1 : 0) : 0,
        lc_offset_ok:(frame[63] != null) ? (Number(frame[63]) ? 1 : 0) : null,
        lc_noise:(frame[64] != null && isFinite(Number(frame[64]))) ? Number(frame[64]) : null,
        lc_scale:(frame[65] != null && isFinite(Number(frame[65]))) ? Number(frame[65]) : null,
        remote_storage_used_bytes:(frame[66] != null && isFinite(Number(frame[66]))) ? Number(frame[66]) : null,
        remote_storage_capacity_bytes:(frame[67] != null && isFinite(Number(frame[67]))) ? Number(frame[67]) : null,
        remote_storage_records:(frame[68] != null && isFinite(Number(frame[68]))) ? Number(frame[68]) : null,
        mission_alarm_seq:Number(frame[69]) || 0,
        mission_alarm_ts:Number(frame[70]) || 0,
        mission_alarm_block:Number(frame[71]) || 0,
        mission_alarm_title:frame[72] != null ? String(frame[72]) : "",
        mission_alarm_message:frame[73] != null ? String(frame[73]) : "",
        flight_phase_code:(frame[74] != null && isFinite(Number(frame[74]))) ? Number(frame[74]) : null,
        flight_phase:(frame[74] != null && FLIGHT_PHASE_CODE_NAMES[Number(frame[74])])
          ? FLIGHT_PHASE_CODE_NAMES[Number(frame[74])]
          : null,
        vertical_speed_mps:(frame[75] != null && isFinite(Number(frame[75]))) ? Number(frame[75]) : null,
        apogee_m:(frame[76] != null && isFinite(Number(frame[76]))) ? Number(frame[76]) : null,
        flight_phase_ms:(frame[77] != null && isFinite(Number(frame[77]))) ? Number(frame[77]) : null,
        attitude_q:(frame.length >= 82 && [78,79,80,81].every((index)=>isFinite(Number(frame[index]))))
          ? [Number(frame[78]), Number(frame[79]), Number(frame[80]), Number(frame[81])]
          : null,
        ignition_delay_ms:(frame[82] != null && isFinite(Number(frame[82]))) ? Number(frame[82]) : 0,
        ignition_delay_valid:frame[83] != null ? (Number(frame[83]) ? 1 : 0) : 0,
        deployment_state:(frame[84] != null && isFinite(Number(frame[84]))) ? Number(frame[84]) : 0,
        deployment_flags:(frame[85] != null && isFinite(Number(frame[85]))) ? Number(frame[85]) : 0,
        sp:(frame[86] != null) ? (Number(frame[86]) ? 1 : 0) : null,
        fl_node:(frame[87] != null && isFinite(Number(frame[87]))) ? Number(frame[87]) : 1,
        fl_target:(frame[88] != null && isFinite(Number(frame[88]))) ? Number(frame[88]) : 1,
        fl_stage1:(frame[89] != null) ? (Number(frame[89]) ? 1 : 0) : 0,
        fl_stage2:(frame[90] != null) ? (Number(frame[90]) ? 1 : 0) : 0,
        fl_stage2_mode:(frame[93] != null) ? (Number(frame[93]) ? 1 : 0) : null,
        reset_code:resetCode,
        reset_reason:resetCode === 9
          ? "BROWNOUT"
          : (resetCode === 23 ? "POWER_GLITCH" : null),
        boot_session:(frame[97] != null && isFinite(Number(frame[97])))
          ? Number(frame[97])
          : null,
        stage_telemetry:stageTelemetry,
        p:Number(frame[3]) || 0,
        alt_m:Number(frame[4]) || 0,
        ax:Number(frame[5]) || 0,
        ay:Number(frame[6]) || 0,
        az:Number(frame[7]) || 0,
        gx:Number(frame[8]) || 0,
        gy:Number(frame[9]) || 0,
        gz:Number(frame[10]) || 0,
        gr:Number(frame[11]) || 0,
        gp:Number(frame[12]) || 0,
        gyw:Number(frame[13]) || 0,
        lt:Number(frame[14]) || 0,
        ct:Number(frame[15]) || 0,
        ga:bit(2),
        r:Number(frame[17]) || 0,
        st:Number(frame[18]) || 0,
        td:Number(frame[19]) || 0,
        ar:Number(frame[20]) || 0,
        m:mode,
        opm:mode,
        op_mode:opMode,
        link_mode:linkMode,
        data_mode:dataMode,
        data_opm:dataMode === "flight" ? 1 : (dataMode === "daq" ? 0 : null),
        flash_link_data_mode:dataMode,
        chip_temp_c:frame[22],
        chip_temp_ok:bit(15),
        gps_lat:frame[23],
        gps_lon:frame[24],
        gps_alt:frame[25],
        gps_age_ms:Number(frame[26]) || 0,
        gps_fix:bit(3),
        gps_seen:bit(4),
        s:bit(5),
        ic:bit(6),
        uw:bit(7),
        ab:bit(8),
        sm:bit(9),
        al:bit(10),
        ip:bit(11),
        sr:bit(12),
        ss:bit(13),
        sta:bit(14),
        bo:bit(1),
        wq:Number(frame[27]) || 0,
        sq:Number(frame[28]) || 0,
        ign_ms:Number(frame[29]) || 0,
        cd_ms:Number(frame[30]) || 0,
        daq_seq_pyro:Number(frame[31]) || 1,
        fl_role_code:flashRoleCode,
        flash_link_role:flashRoleCode === 1 ? "ground" : "avionics",
        fl_link:flashLinked,
        fl_rx_hz:Number(frame[34]) || 0,
        fl_loss_permille:Number(frame[35]) || 0,
        fl_peer_age_ms:Number(frame[36]) || 0,
        fl_remote_valid:flashRemoteValid,
        fl_tx_ok:Number(frame[38]) || 0,
        fl_tx_fail:Number(frame[39]) || 0,
        fl_rx_frames:Number(frame[40]) || 0,
        fl_rx_drop:Number(frame[41]) || 0,
        fl_peer:frame[42] != null ? String(frame[42]) : "",
        fl_tx_skipped:Number(frame[43]) || 0,
        fl_crc_errors:Number(frame[44]) || 0,
        fl_queue_drops:Number(frame[45]) || 0,
        fl_cmd_pending:Number(frame[46]) || 0,
        fl_cmd_acked:Number(frame[47]) || 0,
        fl_cmd_failed:Number(frame[48]) || 0,
        fl_cmd_last_code:Number(frame[49]) || 0,
        fl_cmd_last_result:Number(frame[50]) || 0,
        fl_cmd_retries:Number(frame[51]) || 0,
        data_origin:Number(frame[52]) === 1 ? "avionics" : "local",
        gps_time_valid:(frame[53] != null) ? (Number(frame[53]) ? 1 : 0) : null,
        gps_utc_ms:(frame[54] != null && isFinite(Number(frame[54]))) ? Number(frame[54]) : null,
        fl_rssi_dbm:(frame[55] != null && isFinite(Number(frame[55]))) ? Number(frame[55]) : -127,
        fl_rssi_age_ms:(frame[56] != null && isFinite(Number(frame[56]))) ? Number(frame[56]) : 4294967295,
        fw_program:"Altis_Intelligent3_firmware1",
        fw_board:"Altis_Intelligent3_b3",
        fw_protocol:"Flash6-Intelligent-b8",
        fw_build:"v6 b39"
      };
    }
