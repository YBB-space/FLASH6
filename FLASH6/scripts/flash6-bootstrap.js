/* FLASH6 runtime module: flash6-bootstrap.js. Loaded in manifest order by flash6.js. */
    // =====================
    // DOM Ready
    // =====================
    const bootAfterDomReady = async ()=>{
      bootBeacon("dom_ready_start");
      try{
        const appScope = (typeof window !== "undefined" && window.Flash6)
          ? window.Flash6.appScope
          : null;
        const listenApp = (target, type, listener, options)=>{
          if(appScope) return appScope.listen(target, type, listener, options);
          target.addEventListener(type, listener, options);
          return listener;
        };
        const intervalApp = (callback, delay)=>{
          return appScope ? appScope.interval(callback, delay) : setInterval(callback, delay);
        };
        // ✅ 스플래시 + 프리로드 먼저
        await runSplashAndPreload();
        bootBeacon("dom_ready_after_preload");
        removeLegacyLuceText();
        setTimeout(removeLegacyLuceText, 400);
        setTimeout(removeLegacyLuceText, 1200);

      el.toastContainer = document.getElementById("toastContainer");
      el.criticalAlertStack = document.getElementById("criticalAlertStack");
      el.desktopCameraBtn = document.getElementById("desktopCameraBtn");
      el.webcamPanel = document.getElementById("webcamPanel");
      el.webcamVideo = document.getElementById("webcamVideo");
      el.webcamSimImage = document.getElementById("webcamSimImage");
      el.webcamPlaceholder = document.getElementById("webcamPlaceholder");
      el.webcamPlaceholderTitle = document.getElementById("webcamPlaceholderTitle");
      el.webcamPlaceholderDesc = document.getElementById("webcamPlaceholderDesc");
      el.cameraOpenSettingsBtn = document.getElementById("cameraOpenSettingsBtn");
      el.logView = document.getElementById("logView");
      el.termInput = document.getElementById("termInput");
      el.termSendBtn = document.getElementById("termSendBtn");
      el.termTitle = document.getElementById("termTitle");
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
      el.cameraMapMount = document.getElementById("cameraMapMount");
      el.mobilePreviewCarousel = document.getElementById("mobilePreviewCarousel");
      el.mobileMapPreviewMount = document.getElementById("mobileMapPreviewMount");
      el.mobileMockupCanvas = document.getElementById("mobileMockupCanvas");
      el.mobilePreviewDots = document.querySelectorAll(".mobile-preview-dots span");
      el.mobileChartPreviewSlide = document.querySelector(".mobile-chart-preview-slide");
      el.mobileChartSelectBtn = document.getElementById("mobileChartSelectBtn");
      el.mobileChartPreviewCanvas = document.getElementById("mobileChartPreviewCanvas");
      el.mobileChartPreviewTitle = document.getElementById("mobileChartPreviewTitle");
      el.mobileChartPreviewState = document.getElementById("mobileChartPreviewState");
      el.mobileChartPreviewMessage = document.getElementById("mobileChartPreviewMessage");
      el.mobileChartPreviewLegend = document.getElementById("mobileChartPreviewLegend");
      el.mobileChartPickerOverlay = document.getElementById("mobileChartPickerOverlay");
      el.mobileChartPickerClose = document.getElementById("mobileChartPickerClose");
      el.mobileChartPickerReset = document.getElementById("mobileChartPickerReset");
      el.mobileChartPickerApply = document.getElementById("mobileChartPickerApply");
      el.mobileChartOptions = document.querySelectorAll("[data-mobile-chart-option]");
      el.replayDataPickerOverlay = document.getElementById("replayDataPickerOverlay");
      el.replayDataPickerClose = document.getElementById("replayDataPickerClose");
      el.replayRecentList = document.getElementById("replayRecentList");
      el.replayRecentCount = document.getElementById("replayRecentCount");
      el.replayBrowseFileBtn = document.getElementById("replayBrowseFileBtn");
      initMobilePreviewCarousel();
      initMobileChartPicker();
      initMobileMockup3d();
      el.statusMapCoordText = document.getElementById("statusMapCoordText");
      el.statusMapZoomText = document.getElementById("statusMapZoomText");
      el.statusMapExpandBtn = document.getElementById("statusMapExpandBtn");
      el.statusMapReturnGyroBtn = document.getElementById("statusMapReturnGyroBtn");
      el.statusMapPreviewExpandBtn = document.getElementById("statusMapPreviewExpandBtn");
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
      el.statusMapHudClockSourceCompact = document.getElementById("statusMapHudClockSourceCompact");
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
      el.mobileBoardHeader = document.getElementById("mobileBoardHeader");
      el.mobileBoardSelectBtn = document.getElementById("mobileBoardSelectBtn");
      el.mobileBoardPanelBtn = document.getElementById("mobileBoardPanelBtn");
      el.mobileBoardConnectBtn = document.getElementById("mobileBoardConnectBtn");
      el.mobileBoardAddBtn = document.getElementById("mobileBoardAddBtn");
      el.mobileBoardConnectLabel = document.getElementById("mobileBoardConnectLabel");
      el.mobileBoardConnectIcon = document.getElementById("mobileBoardConnectIcon");
      el.mobileBoardConnectSection = document.getElementById("mobileBoardConnectSection");
      el.mobileBoardConnectSummary = document.getElementById("mobileBoardConnectSummary");
      el.mobileConnectMethodUsbBtn = document.getElementById("mobileConnectMethodUsbBtn");
      el.mobileConnectMethodSimBtn = document.getElementById("mobileConnectMethodSimBtn");
      el.mobileConnectInfoBtn = document.getElementById("mobileConnectInfoBtn");
      el.mobileBoardPanel = document.getElementById("mobileBoardPanel");
      el.mobileBoardName = document.getElementById("mobileBoardName");
      el.mobileBoardStatus = document.getElementById("mobileBoardStatus");
      el.mobileBoardPanelName = document.getElementById("mobileBoardPanelName");
      el.mobileBoardPanelStatus = document.getElementById("mobileBoardPanelStatus");
      el.mobileBoardRow = document.getElementById("mobileBoardRow");
      el.mobileBoardSearchInput = document.getElementById("mobileBoardSearchInput");
      initMobileBoardHeader();
      syncMobileBoardHeader();
      el.mobileSequenceStatusText = document.getElementById("mobileSequenceStatusText");
      el.mobileSequenceStatusPill = document.getElementById("mobileSequenceStatusPill");
      el.mobileSequenceTime = document.getElementById("mobileSequenceTime");
      el.mobileSequenceNavTime = document.getElementById("mobileSequenceNavTime");
      el.mobileSequenceNavAbortBtn = document.getElementById("mobileSequenceNavAbortBtn");
      el.mobileSequenceClock = document.getElementById("mobileSequenceClock");
      el.mobileSequenceClockSource = document.getElementById("mobileSequenceClockSource");
      el.mobileSequenceBarFill = document.getElementById("mobileSequenceBarFill");
      el.mobileSequenceStartBtn = document.getElementById("mobileSequenceStartBtn");
      el.mobileSequenceStartLabel = document.getElementById("mobileSequenceStartLabel");
      el.mobileSequencePauseBtn = document.getElementById("mobileSequencePauseBtn");
      el.mobileSequenceStopBtn = document.getElementById("mobileSequenceStopBtn");
      updateMobileSequenceCardButtons(currentSt);
      el.pageTitle = document.getElementById("pageTitle");
      el.pageKicker = document.getElementById("pageKicker");
      el.homeView = document.getElementById("homeView");
      renderHomeViewLayout();
      el.cameraView = document.getElementById("cameraView");
      el.cameraHud = el.cameraView ? el.cameraView.querySelector(".camera-hud") : null;
      el.cameraGyroPlusStage = document.getElementById("cameraGyroPlusStage");
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
      el.gyro3dHudClockSourceCompact = document.getElementById("gyro3dHudClockSourceCompact");
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
      el.cameraHudFlightGauges = document.getElementById("cameraHudFlightGauges");
      el.cameraSequenceDock = document.getElementById("cameraSequenceDock");
      el.cameraSequenceMissionName = document.getElementById("cameraSequenceMissionName");
      el.cameraHudStageSource = document.getElementById("cameraHudStageSource");
      el.cameraBroadcastAlert = document.getElementById("cameraBroadcastAlert");
      el.cameraBroadcastAlertLabel = document.getElementById("cameraBroadcastAlertLabel");
      el.cameraBroadcastAlertTitle = document.getElementById("cameraBroadcastAlertTitle");
      el.cameraBroadcastAlertText = document.getElementById("cameraBroadcastAlertText");
      el.cameraControlMenuLayer = document.getElementById("cameraControlMenuLayer");
      el.cameraControlMenu = document.getElementById("cameraControlMenu");
      el.cameraControlMenuClose = document.getElementById("cameraControlMenuClose");
      el.cameraControlLinkState = document.getElementById("cameraControlLinkState");
      el.cameraControlFlightState = document.getElementById("cameraControlFlightState");
      el.cameraMenuStageTestBtn = document.getElementById("cameraMenuStageTestBtn");
      el.cameraMenuGyroZeroBtn = document.getElementById("cameraMenuGyroZeroBtn");
      el.cameraMenuDashboardBtn = document.getElementById("cameraMenuDashboardBtn");
      el.cameraMenuAbortBtn = document.getElementById("cameraMenuAbortBtn");
      el.cameraMenuExitBtn = document.getElementById("cameraMenuExitBtn");
      el.dashboardDrawerClose = document.getElementById("dashboardDrawerClose");
      el.cameraMenuDeviceSelect = document.getElementById("cameraMenuDeviceSelect");
      el.cameraHudState = document.getElementById("cameraHudState");
      el.cameraHudStatePill = document.getElementById("cameraHudStatePill");
      el.cameraHudStatePillText = document.getElementById("cameraHudStatePillText");
      el.cameraHudLinkPill = document.getElementById("cameraHudLinkPill");
      el.cameraHudCountdown = document.getElementById("cameraHudCountdown");
      el.cameraHudTimerTag = document.getElementById("cameraHudTimerTag");
      el.cameraHudSpeedGauge = document.getElementById("cameraHudSpeedGauge");
      el.cameraHudSpeedProg = document.getElementById("cameraHudSpeedProg");
      el.cameraHudGforceGauge = document.getElementById("cameraHudGforceGauge");
      el.cameraHudGforceProg = document.getElementById("cameraHudGforceProg");
      el.cameraHudAltitudeGauge = document.getElementById("cameraHudAltitudeGauge");
      el.cameraHudAltitudeProg = document.getElementById("cameraHudAltitudeProg");
      el.cameraHudArm = document.getElementById("cameraHudArm");
      el.cameraHudIgnitionDelay = document.getElementById("cameraHudIgnitionDelay");
      el.cameraHudPyro = document.getElementById("cameraHudPyro");
      el.cameraHudStorage = document.getElementById("cameraHudStorage");
      el.cameraHudLink = document.getElementById("cameraHudLink");
      el.cameraAltitudeChart = document.getElementById("cameraAltitudeChart");
      el.cameraDynamicsChart = document.getElementById("cameraDynamicsChart");
      el.cameraChartAltitude = document.getElementById("cameraChartAltitude");
      el.cameraChartSpeed = document.getElementById("cameraChartSpeed");
      el.cameraChartGforce = document.getElementById("cameraChartGforce");
      el.cameraGyroPreviewMount = document.getElementById("cameraGyroPreviewMount");
      el.cameraGyroPlusMount = document.getElementById("cameraGyroPlusMount");
      el.cameraHudAttitudeGroup = document.getElementById("cameraHudAttitudeGroup");
      el.cameraHudTimelineRail = document.getElementById("cameraHudTimelineRail");
      el.cameraHudTimelineItems = document.querySelectorAll(".camera-timeline-item");
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
      el.quickMetricDelay = document.getElementById("quickMetricDelay");
      el.quickMetricDelayLabel = document.getElementById("quickMetricDelayLabel");
      el.quickMetricPyro = document.getElementById("quickMetricPyro");
      el.quickState = document.getElementById("quick-state");
      el.quickMetricPrimaryLabel = document.getElementById("quickMetricPrimaryLabel");
      el.quickMetricSecondaryLabel = document.getElementById("quickMetricSecondaryLabel");
      el.stageTelemetryDeck = document.getElementById("stageTelemetryDeck");
      ensureHardwareServoChannelUi();
      el.hardwareServoQuickCh1Btn = document.getElementById("hardwareServoQuickCh1Btn");
      el.hardwareServoQuickCh2Btn = document.getElementById("hardwareServoQuickCh2Btn");
      el.hardwareServoQuickCh3Btn = document.getElementById("hardwareServoQuickCh3Btn");
      el.hardwareServoQuickCh4Btn = document.getElementById("hardwareServoQuickCh4Btn");
      el.hardwareServoQuickCh5Btn = document.getElementById("hardwareServoQuickCh5Btn");
      el.hardwareServoDialog = document.getElementById("hardwareServoDialog");
      el.pyroControlOverlay = document.getElementById("pyroControlOverlay");
      el.pyroControlDialog = document.getElementById("pyroControlDialog");
      el.pyroControlClose = document.getElementById("pyroControlClose");
      el.pyroControlDurationInput = document.getElementById("pyroControlDurationInput");
      el.pyroControlRunBtn = document.getElementById("pyroControlRunBtn");
      el.pyroControlConfirmTitle = document.getElementById("pyroControlConfirmTitle");
      el.pyroControlConfirmDesc = document.getElementById("pyroControlConfirmDesc");
      el.pyroControlConfirmOk = document.getElementById("pyroControlConfirmOk");
      el.pyroControlConfirmCancel = document.getElementById("pyroControlConfirmCancel");
      el.hardwarePyroDurationInput = document.getElementById("hardwarePyroDurationInput");
      el.hardwarePyroFireCh1Btn = document.getElementById("hardwarePyroFireCh1Btn");
      el.hardwarePyroFireCh2Btn = document.getElementById("hardwarePyroFireCh2Btn");

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
      el.chipTempWrap = document.getElementById("chipTempWrap");
      el.chipTempStatus = document.getElementById("chipTempStatus");
      el.mobilePreviewChipTemp = document.getElementById("mobilePreviewChipTemp");
      el.perfWrap = document.getElementById("perfWrap");
      el.perfStatus = document.getElementById("perfStatus");
      el.mobilePreviewPerf = document.getElementById("mobilePreviewPerf");
      el.mobilePreviewState = document.getElementById("mobilePreviewState");
      el.mobilePreviewFlash = document.getElementById("mobilePreviewFlash");
      el.mobilePreviewArm = document.getElementById("mobilePreviewArm");
      el.mobilePreviewBattery = document.getElementById("mobilePreviewBattery");
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
      el.desktopNavAbortBtn = document.getElementById("desktopNavAbortBtn");
      el.virtualMissionBtn = document.getElementById("virtualMissionBtn");
      el.virtualMissionBtnLabel = document.getElementById("virtualMissionBtnLabel");
      el.virtualMissionBtnStatus = document.getElementById("virtualMissionBtnStatus");
      el.mobileVirtualMissionBtn = document.getElementById("mobileVirtualMissionBtn");
      el.mobileVirtualMissionStatus = document.getElementById("mobileVirtualMissionStatus");
      el.missionStandbyBtn = document.getElementById("missionStandbyBtn");
      el.missionStandbyBtnLabel = document.getElementById("missionStandbyBtnLabel");
      el.missionStandbyBtnStatus = document.getElementById("missionStandbyBtnStatus");
      el.mobileMissionStandbyBtn = document.getElementById("mobileMissionStandbyBtn");
      el.mobileMissionStandbyStatus = document.getElementById("mobileMissionStandbyStatus");
      el.missionArmRiskOverlay = document.getElementById("missionArmRiskOverlay");
      el.missionArmRiskTitle = document.getElementById("missionArmRiskTitle");
      el.missionArmRiskText = document.getElementById("missionArmRiskText");
      el.missionArmRiskStage = document.getElementById("missionArmRiskStage");
      el.missionArmRiskNote = document.getElementById("missionArmRiskNote");
      el.missionArmRiskConfirm = document.getElementById("missionArmRiskConfirm");
      el.missionForceOverlay = document.getElementById("missionForceOverlay");
      el.missionForceConfirm = document.getElementById("missionForceConfirm");
      el.missionForceS1Time = document.getElementById("missionForceS1Time");
      el.missionForceS2Time = document.getElementById("missionForceS2Time");
      el.missionForceCancel = document.getElementById("missionForceCancel");
      updateMissionStandbyButtonUi();
      updateVirtualMissionButtonUi();
      el.forceBtn = document.getElementById("forceIgniteBtn");
      el.copyLogBtn = document.getElementById("copyLogBtn");
      el.gyroZeroBtn = document.getElementById("gyroZeroBtn");
      el.dashboardServoPanelBtn = document.getElementById("dashboardServoPanelBtn");
      el.dashboardPyroPanelBtn = document.getElementById("dashboardPyroPanelBtn");
      el.missionOpenBtn = document.getElementById("missionOpenBtn");
      el.missionViewOpenBtn = document.getElementById("missionViewOpenBtn");
      el.missionViewMount = document.getElementById("missionViewMount");
      el.exportCsvBtn = document.getElementById("exportCsvBtn");
      el.exportDocxBtn = document.getElementById("exportDocxBtn");
      el.rebootBoardBtn = document.getElementById("rebootBoardBtn");

      el.controlsSettingsBtns = document.querySelectorAll(".js-controls-settings");
      el.sidebarSettingsBtns = document.querySelectorAll(".js-sidebar-settings");
      el.sidebarTerminalBtn = document.getElementById("sidebarTerminalBtn");
      el.sidebarStorageBtn = document.getElementById("sidebarStorageBtn");
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
      el.brownoutWarningOverlay = document.getElementById("brownoutWarningOverlay");
      el.brownoutWarningConfirm = document.getElementById("brownoutWarningConfirm");
      if(el.brownoutWarningOverlay && el.brownoutWarningOverlay.parentElement !== document.body){
        document.body.appendChild(el.brownoutWarningOverlay);
      }
      el.hardwareServoOverlay = document.getElementById("hardwareServoOverlay");
      el.hardwareServoClose = document.getElementById("hardwareServoClose");
      el.missionOverlay = document.getElementById("missionOverlay");
      el.missionDialog = document.getElementById("missionDialog");
      el.missionFirmwareLockNotice = document.getElementById("missionFirmwareLockNotice");
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
      el.missionS1SeparationMs = document.getElementById("missionS1SeparationMs");
      el.missionS1EjectionMs = document.getElementById("missionS1EjectionMs");
      el.missionS2EjectionMs = document.getElementById("missionS2EjectionMs");
      el.missionLaunchGraceMs = document.getElementById("missionLaunchGraceMs");
      el.missionLinkLossMs = document.getElementById("missionLinkLossMs");
      el.missionTimingSave = document.getElementById("missionTimingSave");
      el.missionStandbyReviewOverlay = document.getElementById("missionStandbyReviewOverlay");
      el.missionStandbyReviewCancel = document.getElementById("missionStandbyReviewCancel");
      el.missionStandbyReviewConfirm = document.getElementById("missionStandbyReviewConfirm");
      el.missionReviewS1Separation = document.getElementById("missionReviewS1Separation");
      el.missionReviewS1Ejection = document.getElementById("missionReviewS1Ejection");
      el.missionReviewLinkFallback = document.getElementById("missionReviewLinkFallback");
      el.missionReviewLinkLoss = document.getElementById("missionReviewLinkLoss");
      el.missionReviewLaunchGrace = document.getElementById("missionReviewLaunchGrace");
      el.missionReviewS2Ejection = document.getElementById("missionReviewS2Ejection");
      el.ignTimeSave = document.getElementById("ignTimeSave");
      el.countdownSave = document.getElementById("countdownSave");
      el.opModeSelect = document.getElementById("opModeSelect");
      el.flashLinkEnabledPill = document.getElementById("flashLinkEnabledPill");
      el.flashLinkStage2ModePill = document.getElementById("flashLinkStage2ModePill");
      el.flashLinkStage2ModeRow = document.getElementById("flashLinkStage2ModeRow");
      el.flashLinkStatusHint = document.getElementById("flashLinkStatusHint");
      el.flashLinkRoleSelect = document.getElementById("flashLinkRoleSelect");
      el.flashLinkNodeRow = document.getElementById("flashLinkNodeRow");
      el.flashLinkNodeSelect = document.getElementById("flashLinkNodeSelect");
      el.flashLinkTargetRow = document.getElementById("flashLinkTargetRow");
      el.flashLinkStageStatus = document.getElementById("flashLinkStageStatus");
      el.flashLinkDataModeRow = document.getElementById("flashLinkDataModeRow");
      el.flashLinkDataModeSelect = document.getElementById("flashLinkDataModeSelect");
      el.flashLinkStatus = document.getElementById("flashLinkStatus");
      el.flashLinkStatusText = document.getElementById("flashLinkStatusText");
      el.flashLinkRate = document.getElementById("flashLinkRate");
      el.flashLinkLoss = document.getElementById("flashLinkLoss");
      el.flashLinkRssi = document.getElementById("flashLinkRssi");
      el.flashLinkChartTabs = document.querySelectorAll("[data-fl-chart-metric]");
      el.flashLinkQualityChart = document.getElementById("flashLinkQualityChart");
      el.flashLinkChartValue = document.getElementById("flashLinkChartValue");
      el.flashLinkPeer = document.getElementById("flashLinkPeer");
      el.flashLinkCommandStatus = document.getElementById("flashLinkCommandStatus");
      el.flashLinkTopologyOverlay = document.getElementById("flashLinkTopologyOverlay");
      el.flashTopologyModeDescription = document.getElementById("flashTopologyModeDescription");
      el.flashTopologyStage1Role = document.getElementById("flashTopologyStage1Role");
      el.flashLinkTopologyClose = document.getElementById("flashLinkTopologyClose");
      el.flashTopologyOverall = document.getElementById("flashTopologyOverall");
      el.flashTopologyRate = document.getElementById("flashTopologyRate");
      el.flashTopologyLoss = document.getElementById("flashTopologyLoss");
      el.flashTopologyRssi = document.getElementById("flashTopologyRssi");
      el.flashTopologyPeer = document.getElementById("flashTopologyPeer");
      el.flashLinkReportBtn = document.getElementById("flashLinkReportBtn");
      el.flashLinkReportStatus = document.getElementById("flashLinkReportStatus");
      el.flashLinkReportOverlay = document.getElementById("flashLinkReportOverlay");
      el.flashLinkReportTitle = document.getElementById("flashLinkReportTitle");
      el.flashLinkReportStep = document.getElementById("flashLinkReportStep");
      el.flashLinkReportVisual = document.getElementById("flashLinkReportVisual");
      el.flashLinkReportText = document.getElementById("flashLinkReportText");
      el.flashLinkReportSteps = document.getElementById("flashLinkReportSteps");
      el.flashLinkReportProgress = document.getElementById("flashLinkReportProgress");
      el.flashLinkReportClose = document.getElementById("flashLinkReportClose");
      el.flashLinkReportStart = document.getElementById("flashLinkReportStart");
      el.flashLinkReportCancel = document.getElementById("flashLinkReportCancel");
      initFlashLinkQualityChart();
      updateFlashLinkReportUi();
      syncFlashLinkTopologyUi();
      el.gyro3dViewport = document.getElementById("gyro3dViewport");
      el.gyro3dMapOpenBtn = document.getElementById("gyro3dMapOpenBtn");
      el.gyro3dMapCloseBtn = document.getElementById("gyro3dMapCloseBtn");
      el.gyro3dExpandBtn = document.getElementById("gyro3dExpandBtn");
      el.gyroGlPreview = document.getElementById("gyroGlPreview");
      el.navBallPreview = document.getElementById("navBallPreview");
      el.gyroPreviewSelect = document.getElementById("gyroPreviewSelect");
      el.mobileHudPreviewToggle = document.getElementById("mobileHudPreviewToggle");
      el.mobileFullscreenToggle = document.getElementById("mobileFullscreenToggle");
      el.cameraEnabledToggle = document.getElementById("cameraEnabledToggle");
      el.intelligentMobileReturn = document.getElementById("intelligentMobileReturn");
      el.intelligentMobileReturnBtn = document.getElementById("intelligentMobileReturnBtn");
      el.gyroGl = el.gyroGlPreview || el.gyroGlHidden;
      if(el.navBallPreview) el.navBall = el.navBallPreview;
      syncDesktopGyroPreviewMount();

      buildMotorPresetInfo();
      renderMissionBlocksEditor(missionBlocksState);
      setMissionPresetSelectionUi(selectedMotorName || (el.missionName && el.missionName.value) || "");
      initGyroGl();

      el.relaySafeToggle = document.getElementById("relaySafeToggle");
      el.refreshGuardToggle = document.getElementById("refreshGuardToggle");
      el.igswitch = document.getElementById("igswitch");
      el.safeModeToggle = document.getElementById("safeModeToggle");
      el.armLockToggle = document.getElementById("armLockToggle");
      el.serialToggle = document.getElementById("serialToggle");
      el.safeModePill = document.getElementById("safeModePill");
      el.armLockPill = document.getElementById("armLockPill");
      el.connectModeSelect = document.getElementById("connectModeSelect");
      el.connectActionBtn = document.getElementById("connectActionBtn");
      el.serialControlTile = document.getElementById("serialControlTile");
      el.servoControlTile = document.getElementById("servoControlTile");
      el.pyroControlTile = document.getElementById("pyroControlTile");
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
      el.mobileServoPanel = document.getElementById("mobileServoPanel");
      el.mobileServoPanelMount = document.getElementById("mobileServoPanelMount");
      el.mobileServoBackBtn = document.getElementById("mobileServoBackBtn");
      el.mobileMissionPanel = document.getElementById("mobileMissionPanel");
      el.mobileInspectionPanel = document.getElementById("mobileInspectionPanel");
      el.mobileMissionPanelMount = document.getElementById("mobileMissionPanelMount");
      el.mobileInspectionPanelMount = document.getElementById("mobileInspectionPanelMount");
      el.launcherPitchAngleTablet = document.getElementById("launcherPitchAngleTablet");
      el.replayOpenBtns = document.querySelectorAll(".js-replay-open");
      el.replayPanel = document.getElementById("replayPanel");
      el.replayCloseBtn = document.getElementById("replayCloseBtn");
      el.replayToolsPanel = document.getElementById("replayToolsPanel");
      el.replayToolsCloseBtn = document.getElementById("replayToolsCloseBtn");
      el.replayGyroZeroBtn = document.getElementById("replayGyroZeroBtn");
      if(el.replayToolsPanel && el.replayToolsPanel.parentNode !== document.body){
        document.body.appendChild(el.replayToolsPanel);
      }
      el.replayFileInput = document.getElementById("replayFileInput");
      el.replayFileBtn = document.getElementById("replayFileBtn");
      el.replayDropTitle = document.getElementById("replayDropTitle");
      el.replayDropGuide = document.getElementById("replayDropGuide");
      el.replayStartBtn = document.getElementById("replayStartBtn");
      el.replayRestartBtn = document.getElementById("replayRestartBtn");
      el.replayEndBtn = document.getElementById("replayEndBtn");
      el.replayTminus10Btn = document.getElementById("replayTminus10Btn");
      el.replayConvertBtn = document.getElementById("replayConvertBtn");
      el.replayDocxBtn = document.getElementById("replayDocxBtn");
      el.replaySeekRange = document.getElementById("replaySeekRange");
      el.replaySeekLabel = document.getElementById("replaySeekLabel");
      el.replayStatusText = document.getElementById("replayStatusText");
      el.replayAlarmEventsPanel = document.getElementById("replayAlarmEventsPanel");
      el.replayAlarmEventsCount = document.getElementById("replayAlarmEventsCount");
      el.replayAlarmEventsList = document.getElementById("replayAlarmEventsList");
      el.replaySeekOverlay = document.getElementById("replaySeekOverlay");
      el.replaySeekOverlayText = document.getElementById("replaySeekOverlayText");
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
      el.muteModeToggle = document.getElementById("muteModeToggle");
      el.serialStatus = document.getElementById("serialStatus");
      el.serialStatusText = document.getElementById("serialStatusText");
      el.hwBoardName = document.getElementById("hwBoardName");
      syncMobileBoardHeader();
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
      updateLoadcellCalibrationCapabilityUi();
      el.chipTempOverlay = document.getElementById("chipTempOverlay");
      el.chipTempDialog = document.getElementById("chipTempDialog");
      el.chipTempClose = document.getElementById("chipTempClose");
      el.chipTempChart = document.getElementById("chipTempChart");
      el.chipTempNowValue = document.getElementById("chipTempNowValue");
      el.chipTempMinValue = document.getElementById("chipTempMinValue");
      el.chipTempMaxValue = document.getElementById("chipTempMaxValue");
      el.chipTempAvgValue = document.getElementById("chipTempAvgValue");
      el.chipTempStateValue = document.getElementById("chipTempStateValue");
      el.chipTempChartNote = document.getElementById("chipTempChartNote");
      el.perfOverlay = document.getElementById("perfOverlay");
      el.perfDialog = document.getElementById("perfDialog");
      el.perfClose = document.getElementById("perfClose");
      el.perfChart = document.getElementById("perfChart");
      el.perfNowValue = document.getElementById("perfNowValue");
      el.perfMinValue = document.getElementById("perfMinValue");
      el.perfMaxValue = document.getElementById("perfMaxValue");
      el.perfAvgValue = document.getElementById("perfAvgValue");
      el.perfStateValue = document.getElementById("perfStateValue");
      el.perfCpuNow = document.getElementById("perfCpuNow");
      el.perfLoopNow = document.getElementById("perfLoopNow");
      el.perfChartNote = document.getElementById("perfChartNote");
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
      el.storageOpenBtn = document.getElementById("storageOpenBtn");
      el.storageStatusPill = document.getElementById("storageStatusPill");
      el.inspectionOverlay = document.getElementById("inspectionOverlay");
      el.inspectionClose = document.getElementById("inspectionClose");
      el.inspectionStepLabel = document.getElementById("inspectionStepLabel");
      el.inspectionStepDesc = document.getElementById("inspectionStepDesc");
      el.inspectionStatusSingle = document.getElementById("inspectionStatusSingle");
      el.inspectionResult = document.getElementById("inspectionResult");
      el.inspectionRetry = document.getElementById("inspectionRetry");
      el.inspectionPanelResults = document.querySelectorAll("[data-inspection-panel-result]");

      el.longPressBtn = document.getElementById("longPressBtn");
      el.controlsOverlay = document.getElementById("controlsOverlay");
      el.controlsOverlaySlot = document.getElementById("controlsOverlaySlot");
      el.controlsOverlayClose = document.getElementById("controlsOverlayClose");
      el.desktopControlDrawerMount = document.getElementById("desktopControlDrawerMount");
      el.controlsToggleBtns = document.querySelectorAll(".js-controls-open");
      if(el.controlsCard && !controlsCardParent){
        controlsCardParent = el.controlsCard.parentNode || null;
        controlsCardNext = el.controlsCard.nextSibling || null;
      }

      el.igniteLabel = document.getElementById("igniteBtnLabel");
      el.sequenceStatusDesktop = document.getElementById("sequenceStatusDesktop");
      el.mobileControlsPanel = document.getElementById("mobileControlsPanel");
      el.mobileControlsHandle = el.mobileControlsPanel ? el.mobileControlsPanel.querySelector(".mobile-controls-handle") : null;
      el.mobileAbortBtn = document.getElementById("mobileAbortBtn");
      el.mobileAbortPanel = document.getElementById("mobileAbortPanel");
      el.mobileSequenceWideBtn = document.getElementById("mobileSequenceWideBtn");
      el.mobileSequenceWideLabel = document.getElementById("mobileSequenceWideLabel");
      el.mobileSequenceWideStatus = document.getElementById("mobileSequenceWideStatus");
      syncMobileSequencePrimaryLabels();
      el.mobileArmLockWideBtn = document.getElementById("mobileArmLockWideBtn");
      el.mobileMissionWideBtn = document.getElementById("mobileMissionWideBtn");
      el.mobileAgentBtn = document.getElementById("mobileAgentBtn");
      el.mobileIntelligentCalibrationBtn = document.getElementById("mobileIntelligentCalibrationBtn");
      el.intelligentCalibrationOverlay = document.getElementById("intelligentCalibrationOverlay");
      el.intelligentCalibrationCloseBtn = document.getElementById("intelligentCalibrationCloseBtn");
      el.intelligentCalibrationRunBtn = document.getElementById("intelligentCalibrationRunBtn");
      el.intelligentCalibrationStatus = document.getElementById("intelligentCalibrationStatus");
      el.intelligentCalibrationMap = document.getElementById("intelligentCalibrationMap");
      el.intelligentCalibrationMapEmpty = document.getElementById("intelligentCalibrationMapEmpty");
      el.intelligentCalibrationCoordText = document.getElementById("intelligentCalibrationCoordText");
      el.tabletAbortBtn = document.getElementById("tabletAbortBtn");
      el.mobileSequenceLabel = document.getElementById("mobileSequenceLabel");
      el.mobileControlsHeadTitle = el.mobileControlsPanel ? el.mobileControlsPanel.querySelector(".mobile-controls-head-title") : null;
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
      el.groundStationGuideBtn = document.getElementById("groundStationGuideBtn");
      el.connectionGuideOverlay = document.getElementById("connectionGuideOverlay");
      el.connectionGuideCloseBtn = document.getElementById("connectionGuideCloseBtn");
      el.connectionGuideActionBtn = document.getElementById("connectionGuideActionBtn");
      el.connectionGuideTabs = document.querySelectorAll("[data-connection-guide-tab]");
      el.connectionGuidePanels = document.querySelectorAll("[data-connection-guide-panel]");
      el.welcomeConnectScreen = document.getElementById("welcomeConnectScreen");
      el.welcomeConnectStatus = document.getElementById("welcomeConnectStatus");
      el.welcomeConnectHelp = document.getElementById("welcomeConnectHelp");
      el.welcomeBoardSearchBtn = document.getElementById("welcomeBoardSearchBtn");
      el.welcomeBoardSearchLabel = document.getElementById("welcomeBoardSearchLabel");
      el.welcomeReplayBtn = document.getElementById("welcomeReplayBtn");
      el.welcomeUsbConnectBtn = document.getElementById("welcomeUsbConnectBtn");
      el.welcomeWifiConnectBtn = document.getElementById("welcomeWifiConnectBtn");
      el.welcomeSimConnectBtn = document.getElementById("welcomeSimConnectBtn");
      el.wifiConnectOverlay = document.getElementById("wifiConnectOverlay");
      el.wifiConnectTitle = document.getElementById("wifiConnectTitle");
      el.wifiConnectDesc = document.getElementById("wifiConnectDesc");
      el.wifiConnectHint = document.getElementById("wifiConnectHint");
      el.wifiConnectSpinner = document.getElementById("wifiConnectSpinner");
      el.wifiConnectNextBtn = document.getElementById("wifiConnectNextBtn");
      el.wifiConnectCancelBtn = document.getElementById("wifiConnectCancelBtn");
      el.wifiConnectCloseBtn = document.getElementById("wifiConnectCloseBtn");
      el.connectMethodOverlay = document.getElementById("connectMethodOverlay");
      el.connectMethodUsbBtn = document.getElementById("connectMethodUsbBtn");
      el.connectMethodWifiBtn = document.getElementById("connectMethodWifiBtn");
      el.connectMethodSimBtn = document.getElementById("connectMethodSimBtn");
      el.connectMethodCancelBtn = document.getElementById("connectMethodCancelBtn");
      syncMobileBoardHeader();
      el.serialConnectOverlay = document.getElementById("serialConnectOverlay");
      el.serialConnectTitle = document.getElementById("serialConnectTitle");
      el.serialConnectDesc = document.getElementById("serialConnectDesc");
      el.serialConnectHint = document.getElementById("serialConnectHint");
      el.serialConnectSpinner = document.getElementById("serialConnectSpinner");
      el.serialConnectNextBtn = document.getElementById("serialConnectNextBtn");
      el.serialConnectCancelBtn = document.getElementById("serialConnectCancelBtn");
      el.serialConnectCloseBtn = document.getElementById("serialConnectCloseBtn");
      el.gpsHelpOverlay = document.getElementById("gpsHelpOverlay");
      el.gpsHelpCloseBtn = document.getElementById("gpsHelpCloseBtn");
      el.gpsHelpOkBtn = document.getElementById("gpsHelpOkBtn");
      el.agentHelpOverlay = document.getElementById("agentHelpOverlay");
      el.agentHelpCloseBtn = document.getElementById("agentHelpCloseBtn");
      el.agentHelpList = document.getElementById("agentHelpList");
      el.agentHelpEmpty = document.getElementById("agentHelpEmpty");
      el.agentIssueOverlay = document.getElementById("agentIssueOverlay");
      el.agentIssueCloseBtn = document.getElementById("agentIssueCloseBtn");
      el.agentIssueDetailTitle = document.getElementById("agentIssueDetailTitle");
      el.agentIssueDetailText = document.getElementById("agentIssueDetailText");
      el.agentIssueImageWrap = document.getElementById("agentIssueImageWrap");
      el.agentIssueImageTrack = document.getElementById("agentIssueImageTrack");
      el.agentIssueImageDots = document.getElementById("agentIssueImageDots");
      el.easterOverlay = document.getElementById("easterOverlay");
      el.easterEggOk = document.getElementById("easterEggOk");

      if(el.replayOpenBtns && el.replayOpenBtns.length){
        el.replayOpenBtns.forEach(btn=>{
          btn.addEventListener("click",()=>{
            if(replayUiActive) return;
            showReplayDataPicker();
          });
        });
      }
      replayFileLoader = async (file)=>{
        if(!file) return;
        cancelReplaySeekProcessing();
        setReplayStatus("Replay 파일 자동 분석 중... (XLSX/CSV/BIN)");
        if(el.replayFileBtn) el.replayFileBtn.classList.remove("is-dragover");
        try{
          const parsed = await parseReplayFileAuto(file);
          const samples = parsed.samples;
          const replayDataMode = inferReplayDataMode(samples) || "flight";
          pauseReplayPlayback({silent:true});
          setActiveDataSource(DATA_SOURCE_LIVE);
          replayState.samples = samples;
          replayState.fileName = file.name;
          replayState.parserLabel = parsed.parserLabel;
          replayState.dataMode = replayDataMode;
          replayState.index = 0;
          replayState.lastIndex = -1;
          setActiveDataSource(DATA_SOURCE_REPLAY);
          setFlashLinkDisplayDataMode(replayDataMode);
          renderReplayAlarmEvents();
          updateReplayModeUi();
          updateExportButtonState();
          setReplayStatus("");
          showToast(
            "리플레이 파일 로딩 완료 (" + parsed.parserLabel + "): " + samples.length + " samples",
            "success",
            {key:"replay-load"}
          );
          activateReplayModeAfterSelection();
          setReplayDataPickerVisible(false);
        }catch(err){
          const reason = (err && err.message) ? err.message : String(err || "unknown");
          replayState.samples = [];
          replayState.fileName = "";
          replayState.parserLabel = "";
          replayState.dataMode = null;
          replayState.index = 0;
          replayState.lastIndex = -1;
          renderReplayAlarmEvents();
          updateReplayModeUi();
          updateExportButtonState();
          setReplayStatus("리플레이 파일 파싱 실패: " + reason);
          notifyAlarm("REPLAY_FORMAT", {reason});
        }finally{
          if(el.replayFileInput) el.replayFileInput.value = "";
        }
      };
      const loadReplayFile = (file)=>replayFileLoader(file);
      if(el.replayDataPickerClose){
        el.replayDataPickerClose.addEventListener("click",()=>setReplayDataPickerVisible(false));
      }
      if(el.replayDataPickerOverlay){
        el.replayDataPickerOverlay.addEventListener("click",(event)=>{
          if(event.target === el.replayDataPickerOverlay) setReplayDataPickerVisible(false);
        });
      }
      if(el.replayBrowseFileBtn && el.replayFileInput){
        el.replayBrowseFileBtn.addEventListener("click",()=>el.replayFileInput.click());
      }
      if(el.replayFileBtn && el.replayFileInput){
        el.replayFileBtn.addEventListener("click",()=>showReplayDataPicker());
      }
      const bindReplayFileDropTarget = (target)=>{
        if(!target) return;
        const hasDraggedFiles = (ev)=>{
          const transfer = ev && ev.dataTransfer;
          if(!transfer) return false;
          if(transfer.files && transfer.files.length) return true;
          return Array.from(transfer.types || []).indexOf("Files") >= 0;
        };
        const clearDragState = ()=>{
          target.classList.remove("is-dragover");
        };
        target.addEventListener("dragenter",(ev)=>{
          if(!hasDraggedFiles(ev)) return;
          ev.preventDefault();
          target.classList.add("is-dragover");
        });
        target.addEventListener("dragover",(ev)=>{
          if(!hasDraggedFiles(ev)) return;
          ev.preventDefault();
          if(ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
          target.classList.add("is-dragover");
        });
        target.addEventListener("dragleave",(ev)=>{
          const nextTarget = ev.relatedTarget;
          if(nextTarget && target.contains(nextTarget)) return;
          clearDragState();
        });
        target.addEventListener("drop",(ev)=>{
          if(!hasDraggedFiles(ev)) return;
          ev.preventDefault();
          ev.stopPropagation();
          clearDragState();
          const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]
            ? ev.dataTransfer.files[0]
            : null;
          if(file) loadReplayFile(file);
        });
      };
      bindReplayFileDropTarget(el.replayFileBtn);
      bindReplayFileDropTarget(el.replayBrowseFileBtn);
      if(el.replayFileInput){
        el.replayFileInput.addEventListener("change", async ()=>{
          const file = el.replayFileInput.files && el.replayFileInput.files[0];
          if(!file) return;
          await loadReplayFile(file);
        });
      }
      if(el.replayStartBtn){
        el.replayStartBtn.addEventListener("click",()=>{
          if(replayState.playing) pauseReplayPlayback();
          else startReplayPlayback();
        });
      }
      if(el.replayRestartBtn){
        el.replayRestartBtn.addEventListener("click",()=>{
          if(!replayState.samples.length){
            showToast("리플레이 파일(.xlsx/.csv/.bin)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
            return;
          }
          seekReplayToIndex(0, false);
          setReplayStatus("처음 지점으로 이동했습니다.");
        });
      }
      if(el.replayEndBtn){
        el.replayEndBtn.addEventListener("click",()=>{
          if(!replayState.samples.length){
            showToast("리플레이 파일(.xlsx/.csv/.bin)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
            return;
          }
          const last = Math.max(0, replayState.samples.length - 1);
          seekReplayToIndex(last, false);
          setReplayStatus("끝 지점으로 이동했습니다.");
        });
      }
      if(el.replayTminus10Btn){
        el.replayTminus10Btn.addEventListener("click",()=>seekReplayToTminus10());
      }
      if(el.replayAlarmEventsList){
        el.replayAlarmEventsList.addEventListener("click",(ev)=>{
          const row = ev.target && ev.target.closest
            ? ev.target.closest(".replay-event-item")
            : null;
          if(!row) return;
          const targetIndex = Number(row.getAttribute("data-replay-alarm-index"));
          if(!isFinite(targetIndex) || targetIndex < 0 || !replayState.samples.length) return;
          const eventKey = String(row.getAttribute("data-replay-alarm-key") || "");
          const event = replayAlarmEvents.find((item)=>item && item.key === eventKey) ||
            replayAlarmEvents.find((item)=>item && item.index === targetIndex);
          const resume = replayState.playing;
          seekReplayToIndex(targetIndex, resume);
          setReplayStatus(
            "알람 이벤트 시점으로 이동했습니다" +
            (event && event.title ? ": " + event.title : ".")
          );
        });
      }
      if(el.replayConvertBtn){
        el.replayConvertBtn.addEventListener("click",()=>{
          if(!replayState.samples.length){
            showToast("리플레이 파일(.xlsx/.csv/.bin)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
            return;
          }
          if(el.exportCsvBtn) el.exportCsvBtn.click();
        });
      }
      if(el.replayDocxBtn){
        el.replayDocxBtn.addEventListener("click",()=>{
          if(!replayState.samples.length){
            showToast("리플레이 파일(.xlsx/.csv/.bin)을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
            return;
          }
          if(el.exportCsvBtn){
            el.exportCsvBtn.dataset.reportFormat = "docx";
            el.exportCsvBtn.click();
          }
        });
      }
      if(el.exportDocxBtn){
        el.exportDocxBtn.addEventListener("click",()=>{
          if(!el.exportCsvBtn) return;
          el.exportCsvBtn.dataset.reportFormat = "docx";
          el.exportCsvBtn.click();
        });
      }
      if(el.replaySeekRange){
        const finishSeekInteraction = (force)=>{
          if(!replaySeekInteracting && !force) return;
          replaySeekInteracting = false;
          const resume = replayState.playing;
          seekReplayToIndex(Number(el.replaySeekRange.value), resume);
        };
        el.replaySeekRange.addEventListener("pointerdown",()=>{
          replaySeekInteracting = true;
        });
        el.replaySeekRange.addEventListener("mousedown",()=>{
          replaySeekInteracting = true;
        });
        el.replaySeekRange.addEventListener("touchstart",()=>{
          replaySeekInteracting = true;
        }, {passive:true});
        el.replaySeekRange.addEventListener("pointerup", ()=>finishSeekInteraction(false));
        el.replaySeekRange.addEventListener("pointercancel", ()=>finishSeekInteraction(false));
        el.replaySeekRange.addEventListener("mouseup", ()=>finishSeekInteraction(false));
        el.replaySeekRange.addEventListener("touchend", ()=>finishSeekInteraction(false));
        el.replaySeekRange.addEventListener("touchcancel", ()=>finishSeekInteraction(false));
        el.replaySeekRange.addEventListener("blur", ()=>finishSeekInteraction(false));
        el.replaySeekRange.addEventListener("input",()=>{
          updateReplaySeekUi(Number(el.replaySeekRange.value));
        });
        el.replaySeekRange.addEventListener("change",()=>{
          finishSeekInteraction(true);
        });
        el.replaySeekRange.addEventListener("click",()=>{
          finishSeekInteraction(true);
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
                scheduleReplayTick(
                  replayPlaybackDelayBetween(replayState.lastIndex, replayState.index),
                  {rebase:true}
                );
              }else{
                scheduleReplayTick(0, {rebase:true});
              }
            }
          });
        });
      }
      updateReplayModeUi();
      setReplayStatus("");

      if(el.spiFlashRefreshBtn){
        el.spiFlashRefreshBtn.addEventListener("click", ()=>{ fetchSpiFlashStatus({force:true}); });
      }
      if(el.spiFlashInitBtn){
        el.spiFlashInitBtn.addEventListener("click", ()=>{ resetSpiFlashStorage(); });
      }
      if(el.spiFlashDumpBtn){
        el.spiFlashDumpBtn.addEventListener("click", ()=>{ showDataListOverlay(); });
      }
      fetchSpiFlashStatus({force:true});

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
      brownoutWarningOverlayEl = el.brownoutWarningOverlay || document.getElementById("brownoutWarningOverlay");
      brownoutWarningConfirmEl = el.brownoutWarningConfirm || document.getElementById("brownoutWarningConfirm");
      pyroConfirmOverlayEl = document.getElementById("pyroConfirmOverlay");
      pyroConfirmTitleEl = document.getElementById("pyroConfirmTitle");
      pyroConfirmDescEl = document.getElementById("pyroConfirmDesc");
      pyroConfirmHintEl = document.getElementById("pyroConfirmHint");
      pyroConfirmOkBtnEl = document.getElementById("pyroConfirmOkBtn");
      pyroConfirmCancelBtnEl = document.getElementById("pyroConfirmCancelBtn");
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

      if(el.refreshGuardToggle){
        el.refreshGuardToggle.addEventListener("change",()=>{
          uiSettings.refreshGuard = !!el.refreshGuardToggle.checked;
          saveSettings();
          showToast(
            uiSettings.refreshGuard ? t("refreshGuardOnToast") : t("refreshGuardOffToast"),
            uiSettings.refreshGuard ? "info" : "warn",
            {key:"refresh-guard-toggle"}
          );
        });
      }

      if(el.cameraEnabledToggle){
        el.cameraEnabledToggle.addEventListener("change", async ()=>{
          uiSettings.cameraEnabled = !!el.cameraEnabledToggle.checked;
          saveSettings();
          if(!uiSettings.cameraEnabled){
            stopWebcam({preserveSim:cameraSimSourceActive});
            showToast("카메라가 꺼졌습니다.", "info", {key:"camera-enabled-toggle"});
            return;
          }
          syncCameraEnabledState();
          showToast(
            cameraSimSourceActive ? "SIM 카메라 화면을 사용 중입니다." : "카메라를 켰습니다. 영상 권한을 허용해주세요.",
            "info",
            {key:"camera-enabled-toggle"}
          );
          if(document.body.classList.contains("camera-view-active") &&
             !document.body.classList.contains("camera-gyro-plus-layout")) await startWebcam();
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
        el.safeModeToggle.addEventListener("change",async ()=>{
          const previous = !!safetyModeEnabled;
          const requested = !!el.safeModeToggle.checked;
          const pending = beginBoardControlPending("safety", requested, previous);
          safetyModeEnabled = requested;
          uiSettings.safetyMode = requested;
          updateTogglePill(el.safeModePill, el.safeModeToggle.checked);
          updateMobileDashboardSafetyArmState();
          saveSettings();
          setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
          updateControlAccessUI(currentSt);
          showToast(
            requested ? "안전 모드 적용 확인 중" : "안전 모드 해제 확인 중",
            "info",
            {key:"safety-mode-toggle", duration:2600}
          );
          const result = await sendBoardToggleCommand("safety", requested);
          if(!result.ok){
            rejectBoardControlPending("safety", pending, result.reason);
            return;
          }
          if(result.confirmed){
            confirmBoardControlPending("safety", pending, requested);
          }
          if(pendingBoardControls.safety && pendingBoardControls.safety !== pending) return;
          if(safetyModeEnabled !== requested) return;
          if(requested && currentSt !== 0){
            if(simEnabled){
              resetSimState();
              resetGyroPathTracking();
            }else{
              sendCommand({http:"/abort", ser:"ABORT"}, true);
            }
          }
        });
      }
      if(el.armLockToggle){
        el.armLockToggle.addEventListener("change",async ()=>{
          const previous = !!uiSettings.armLock;
          const armLockEnabled = !!el.armLockToggle.checked;
          const pending = beginBoardControlPending("armLock", armLockEnabled, previous);
          uiSettings.armLock = armLockEnabled;
          saveSettings();
          updateTogglePill(el.armLockPill, armLockEnabled);
          updateMobileArmLockWideButton();
          showToast(
            armLockEnabled ? "ARM ON LOCK 적용 확인 중" : "ARM ON LOCK 해제 확인 중",
            "info",
            {key:"arm-lock-toggle", duration:2600}
          );
          const result = await sendBoardToggleCommand("armLock", armLockEnabled);
          if(!result.ok){
            rejectBoardControlPending("armLock", pending, result.reason);
            return;
          }
          if(result.confirmed){
            confirmBoardControlPending("armLock", pending, armLockEnabled);
          }
        });
      }

      if(el.serialToggle){
        el.serialToggle.addEventListener("change",async ()=>{
          const nextMode = el.serialToggle.checked ? "serial" : "wifi";
          await setConnectTransportMode(nextMode, {toast:true});
        });
      }
      if(el.connectModeSelect){
        el.connectModeSelect.addEventListener("change", async ()=>{
          const nextMode = (el.connectModeSelect.value === "serial") ? "serial" : "wifi";
          await setConnectTransportMode(nextMode, {toast:true});
        });
      }
      if(el.connectActionBtn){
        el.connectActionBtn.addEventListener("click", async (ev)=>{
          ev.preventDefault();
          await handleConnectAction();
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
      if(el.muteModeToggle){
        el.muteModeToggle.addEventListener("change",()=>{
          const muteEnabled = !!el.muteModeToggle.checked;
          uiSettings.muteMode = muteEnabled;
          saveSettings();
          sendCommand({http:"/set?mute="+(muteEnabled?1:0), ser:"/set?mute="+(muteEnabled?1:0)}, true);
          showToast(
            muteEnabled ? "무음 모드 켜짐. 버저 출력이 차단됩니다." : "무음 모드 꺼짐. 버저 출력이 활성화됩니다.",
            "info",
            {key:"mute-mode-toggle"}
          );
        });
      }
      if(el.serialControlTile){
        el.serialControlTile.addEventListener("click",async (ev)=>{
          if(ev.target && (ev.target.closest("select") || ev.target.closest("button") || ev.target.closest("input"))){
            return;
          }
          await handleConnectAction();
        });
        el.serialControlTile.addEventListener("keydown",async (ev)=>{
          if(ev.key !== "Enter" && ev.key !== " ") return;
          if(ev.target && (ev.target.closest("select") || ev.target.closest("button") || ev.target.closest("input"))){
            return;
          }
          ev.preventDefault();
          await handleConnectAction();
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
          if(sequenceActive || isFirmwareSequenceRunningState(currentSt)){
            return;
          }
          if(currentSt===0 && !isControlUnlocked()){
            if(lockoutLatched){
              showToast(t("lockoutNoControl"), "error");
              return;
            }
            openInspectionFromUI();
            return;
          }
          if(currentSt===0) showConfirm();
        });
      }
      if(el.virtualMissionBtn){
        el.virtualMissionBtn.addEventListener("click", toggleVirtualMission);
      }
      if(el.missionStandbyBtn){
        el.missionStandbyBtn.addEventListener("click", startMissionStandbyFromUi);
      }
      if(el.missionArmRiskConfirm){
        el.missionArmRiskConfirm.addEventListener("click", hideMissionArmRiskWarning);
      }
      if(el.missionArmRiskOverlay){
        el.missionArmRiskOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.missionArmRiskOverlay) hideMissionArmRiskWarning();
        });
      }
      if(el.missionForceConfirm){
        el.missionForceConfirm.addEventListener("click", confirmForcedTimedMission);
      }
      if(el.missionForceCancel){
        el.missionForceCancel.addEventListener("click", hideMissionForceConfirm);
      }
      if(el.missionForceOverlay){
        el.missionForceOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.missionForceOverlay) hideMissionForceConfirm();
        });
      }

      if(el.abortBtn){
        el.abortBtn.addEventListener("click",()=>{
          if(lockoutLatched){
            const name = relayMaskName(lockoutRelayMask);
          showToast(t("lockoutAbortDenied", {name}), "error");
            return;
          }
          if(isFirmwareTplusState(currentSt) || tplusUiActive){
            sendCommand({http:"/sequence_end", ser:"SEQUENCE_END"}, true);
            if(virtualMissionActive) stopVirtualMission("user");
            addLogLine(t("sequenceEndLog"),"SEQ");
            showToast(t("sequenceEndToast"), "info");
            hideConfirm();
            return;
          }
          lastAbortReason = "user";
          sendCommand({http:"/abort", ser:"ABORT"}, true);
          showToast(t("abortRequestedToast", {safety:safetyLineSuffix()}),"error");
          hideConfirm();
        });
      }
      if(el.desktopNavAbortBtn){
        el.desktopNavAbortBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          if(el.abortBtn && !el.abortBtn.disabled) el.abortBtn.click();
        });
        window.addEventListener("resize",()=>{
          requestAnimationFrame(updateDesktopNavAbortButton);
        }, {passive:true});
        const desktopNav = document.querySelector(".side-nav-desktop");
        if(desktopNav && window.ResizeObserver){
          const abortNavObserver = new ResizeObserver(()=>{
            requestAnimationFrame(updateDesktopNavAbortButton);
          });
          abortNavObserver.observe(desktopNav);
        }
        updateDesktopNavAbortButton();
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
      if(el.wifiConnectNextBtn){
        el.wifiConnectNextBtn.addEventListener("click", ()=>{
          if(wifiConnectStage === "guide"){
            startWifiConnectWait();
            return;
          }
          if(wifiConnectStage === "success"){
            closeWifiConnectWizard();
            return;
          }
          if(wifiConnectStage === "fail"){
            startWifiConnectWait();
            return;
          }
        });
      }
      if(el.wifiConnectCancelBtn){
        el.wifiConnectCancelBtn.addEventListener("click", ()=>{
          closeWifiConnectWizard();
        });
      }
      if(el.wifiConnectCloseBtn){
        el.wifiConnectCloseBtn.addEventListener("click", ()=>{
          closeWifiConnectWizard();
        });
      }
      if(el.wifiConnectOverlay){
        el.wifiConnectOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.wifiConnectOverlay){
            closeWifiConnectWizard();
          }
        });
      }
      if(el.welcomeBoardSearchBtn){
        el.welcomeBoardSearchBtn.addEventListener("click", ()=>{
          handleWelcomePrimaryAction().catch(err=>{
            setWelcomeBoardSearchBusy(false);
            setWelcomeConnectStatus("idle", "보드를 찾지 못했습니다");
            reportSilentException("welcome-primary-action", err);
          });
        });
      }
      if(el.welcomeReplayBtn){
        el.welcomeReplayBtn.addEventListener("click", ()=>{
          try{
            startWelcomeReplay();
          }catch(err){
            setWelcomeConnectStatus("idle", "리플레이 시작 실패");
            reportSilentException("welcome-replay", err);
          }
        });
      }
      if(el.welcomeUsbConnectBtn){
        el.welcomeUsbConnectBtn.addEventListener("click", ()=>{
          startWelcomeUsbConnect().catch(err=>{
            setWelcomeConnectStatus("idle", "USB 연결 실패");
            reportSilentException("welcome-usb-connect", err);
          });
        });
      }
      if(el.welcomeWifiConnectBtn){
        el.welcomeWifiConnectBtn.addEventListener("click", ()=>{
          startWelcomeWifiConnect().catch(err=>{
            setWelcomeConnectStatus("idle", "Wi-Fi 연결 실패");
            reportSilentException("welcome-wifi-connect", err);
          });
        });
      }
      if(el.welcomeSimConnectBtn){
        el.welcomeSimConnectBtn.addEventListener("click", ()=>{
          try{
            startWelcomeSimulation();
          }catch(err){
            setWelcomeConnectStatus("idle", "시뮬레이션 시작 실패");
            reportSilentException("welcome-sim-connect", err);
          }
        });
      }
      if(el.connectMethodUsbBtn){
        el.connectMethodUsbBtn.addEventListener("click", ()=>{
          startConnectMethod("serial");
        });
      }
      if(el.connectMethodWifiBtn){
        el.connectMethodWifiBtn.addEventListener("click", ()=>{
          startConnectMethod("wifi");
        });
      }
      if(el.connectMethodSimBtn){
        el.connectMethodSimBtn.addEventListener("click", ()=>{
          hideConnectMethodModal();
          startWelcomeSimulation();
        });
      }
      if(el.connectMethodCancelBtn){
        el.connectMethodCancelBtn.addEventListener("click", ()=>{
          hideConnectMethodModal();
        });
      }
      if(el.connectMethodOverlay){
        el.connectMethodOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.connectMethodOverlay){
            hideConnectMethodModal();
          }
        });
      }
      if(el.serialConnectNextBtn){
        el.serialConnectNextBtn.addEventListener("click", async ()=>{
          if(serialConnectStage === "success"){
            closeSerialConnectWizard();
            return;
          }
          await startSerialConnectFromWizard();
        });
      }
      if(el.serialConnectCancelBtn){
        el.serialConnectCancelBtn.addEventListener("click", ()=>{
          closeSerialConnectWizard();
        });
      }
      if(el.serialConnectCloseBtn){
        el.serialConnectCloseBtn.addEventListener("click", ()=>{
          closeSerialConnectWizard();
        });
      }
      if(el.serialConnectOverlay){
        el.serialConnectOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.serialConnectOverlay){
            closeSerialConnectWizard();
          }
        });
      }
      if(el.gpsHelpCloseBtn){
        el.gpsHelpCloseBtn.addEventListener("click", ()=>{
          hideGpsHelpModal();
        });
      }
      if(el.gpsHelpOkBtn){
        el.gpsHelpOkBtn.addEventListener("click", ()=>{
          hideGpsHelpModal();
        });
      }
      if(el.gpsHelpOverlay){
        el.gpsHelpOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.gpsHelpOverlay){
            hideGpsHelpModal();
          }
        });
      }
      if(el.mobileAgentBtn){
        el.mobileAgentBtn.addEventListener("click", (ev)=>{
          ev.preventDefault();
          showAgentHelpModal();
        });
      }
      if(el.mobileIntelligentCalibrationBtn) el.mobileIntelligentCalibrationBtn.addEventListener("click", ()=>{
        document.documentElement.classList.add("intelligent-calibration-open");
        if(el.intelligentCalibrationStatus){
          el.intelligentCalibrationStatus.textContent = "GPS가 있으면 해면기압 기준까지 저장하고, 없으면 자이로 영점만 보정합니다.";
        }
        updateIntelligentCalibrationMap();
        setOverlayVisible(el.intelligentCalibrationOverlay, true);
        requestAnimationFrame(()=>{
          if(el.intelligentCalibrationOverlay) el.intelligentCalibrationOverlay.classList.add("is-open");
          updateIntelligentCalibrationMap();
          scheduleIntelligentCalibrationMapRefresh();
        });
      });
      const closeIntelligentCalibration = ()=>{
        document.documentElement.classList.remove("intelligent-calibration-open");
        if(intelligentCalibrationMapState.retryTimer){
          clearTimeout(intelligentCalibrationMapState.retryTimer);
          intelligentCalibrationMapState.retryTimer = null;
        }
        if(intelligentCalibrationMapState.tileFallbackTimer){
          clearTimeout(intelligentCalibrationMapState.tileFallbackTimer);
          intelligentCalibrationMapState.tileFallbackTimer = null;
        }
        if(el.intelligentCalibrationOverlay) el.intelligentCalibrationOverlay.classList.remove("is-open");
        setOverlayVisible(el.intelligentCalibrationOverlay, false);
      };
      if(el.intelligentCalibrationCloseBtn) el.intelligentCalibrationCloseBtn.addEventListener("click", closeIntelligentCalibration);
      if(el.intelligentCalibrationRunBtn) el.intelligentCalibrationRunBtn.addEventListener("click", runIntelligentCalibration);
      if(el.intelligentCalibrationOverlay) el.intelligentCalibrationOverlay.addEventListener("click", ev=>{ if(ev.target === el.intelligentCalibrationOverlay) closeIntelligentCalibration(); });
      if(el.agentHelpCloseBtn){
        el.agentHelpCloseBtn.addEventListener("click", ()=>{
          hideAgentHelpModal();
        });
      }
      if(el.agentHelpOverlay){
        el.agentHelpOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.agentHelpOverlay){
            hideAgentHelpModal();
          }
        });
      }
      if(el.agentIssueCloseBtn){
        el.agentIssueCloseBtn.addEventListener("click", ()=>{
          hideAgentIssueModal();
        });
      }
      if(el.agentIssueOverlay){
        el.agentIssueOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.agentIssueOverlay){
            hideAgentIssueModal();
          }
        });
      }
      if(el.agentIssueImageTrack){
        el.agentIssueImageTrack.addEventListener("scroll", updateAgentIssueImageDots, { passive:true });
      }

      if(el.longPressBtn){
        el.longPressBtn.addEventListener("pointerdown", (e)=>{
          e.preventDefault();
          longPressPointerId = e.pointerId;
          try{ el.longPressBtn.setPointerCapture(e.pointerId); }catch(_err){}
          startHold();
        });
        el.longPressBtn.addEventListener("pointerup",   (e)=>{ e.preventDefault(); endHold(); });
        el.longPressBtn.addEventListener("pointercancel",(e)=>{ e.preventDefault(); endHold(); });
        el.longPressBtn.addEventListener("lostpointercapture", ()=>{
          longPressPointerId = null;
          endHold();
        });
      }

      if(el.storageOpenBtn){
        el.storageOpenBtn.addEventListener("click", ()=>{ showDataListOverlay(); });
        el.storageOpenBtn.addEventListener("keydown",(e)=>{
          if(e.key === "Enter" || e.key === " "){
            e.preventDefault();
            showDataListOverlay();
          }
        });
      }
      if(el.sidebarStorageBtn){
        el.sidebarStorageBtn.addEventListener("click", (e)=>{
          e.preventDefault();
          showDataListOverlay();
        });
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
            setLauncherPanelVisible(false);
            setMissionPanelVisible(false);
            setInspectionPanelVisible(false);
            if(replayUiActive){
              toggleReplayToolsPanel();
              return;
            }
            if(isMobileLayout() && el.mobileControlsPanel){
              ensureDashboardViewForPanels();
              showMobileControlsPanel();
              return;
            }
            toggleDesktopControlDrawer();
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
          if(isDesktopControlDrawerOpen()){
            setDesktopControlDrawerOpen(false);
            return;
          }
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
      if(el.replayCloseBtn){
        el.replayCloseBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          if(isMobileLayout()){
            hideControlsModal();
          }else if(isTabletControlsLayout()){
            hideTabletControlsPanel();
          }else{
            setDesktopControlDrawerOpen(false);
          }
        });
      }
      if(el.replayToolsCloseBtn){
        el.replayToolsCloseBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          setReplayToolsPanelOpen(false);
        });
      }
      if(el.controlsOverlay){
        el.controlsOverlay.addEventListener("click",(ev)=>{ if(ev.target === el.controlsOverlay) hideControlsModal(); });
      }

      document.addEventListener("pointerdown",(ev)=>{
        if(replayUiActive && isReplayToolsPanelOpen()){
          const navButton = document.getElementById("desktopControlPanelNavBtn");
          if(el.replayToolsPanel && el.replayToolsPanel.contains(ev.target)) return;
          if(navButton && navButton.contains(ev.target)) return;
          setReplayToolsPanelOpen(false);
          return;
        }
        if(isDesktopControlDrawerOpen()){
          const navButton = document.getElementById("desktopControlPanelNavBtn");
          if(el.controlsCard && el.controlsCard.contains(ev.target)) return;
          if(navButton && navButton.contains(ev.target)) return;
          setDesktopControlDrawerOpen(false);
        }
        if(!mobileControlsActive) return;
        if(el.mobileControlsPanel && el.mobileControlsPanel.contains(ev.target)) return;
        if(ev.target.closest && ev.target.closest(".js-controls-open")) return;
        hideMobileControlsPanel();
      });
      document.addEventListener("keydown",(ev)=>{
        if(ev.key === "Escape" && isDesktopControlDrawerOpen()){
          setDesktopControlDrawerOpen(false);
          return;
        }
        if(ev.key === "Escape" && tabletControlsOpen && isTabletControlsLayout()){
          hideTabletControlsPanel();
        }
      });
      applyTabletControlsLayout();
      applyPhoneLandscapeLayout();
      if(isMobileLayout()){
        hideControlsModal();
        if(el.controlsCard){
          el.controlsCard.classList.add(CONTROLS_MOBILE_CLASS);
        }
        if(el.controlsOverlay){
          el.controlsOverlay.classList.add("hidden");
        }
      }
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
      if(el.groundStationGuideBtn){
        el.groundStationGuideBtn.addEventListener("click", ()=>{
          openConnectionGuide("wifi");
        });
      }
      if(el.connectionGuideCloseBtn){
        el.connectionGuideCloseBtn.addEventListener("click", ()=>closeConnectionGuide());
      }
      if(el.connectionGuideOverlay){
        el.connectionGuideOverlay.addEventListener("click", (ev)=>{
          if(ev.target === el.connectionGuideOverlay) closeConnectionGuide();
        });
      }
      if(el.connectionGuideTabs && el.connectionGuideTabs.length){
        el.connectionGuideTabs.forEach((button)=>{
          button.addEventListener("click", ()=>{
            setConnectionGuideTab(button.getAttribute("data-connection-guide-tab"));
          });
        });
      }
      if(el.connectionGuideActionBtn){
        el.connectionGuideActionBtn.addEventListener("click", ()=>{
          const next = connectionGuideTab;
          closeConnectionGuide(false);
          if(next === "serial") openSerialConnectWizard();
          else openWifiConnectWizard();
        });
      }
      if(easterEggOkEl){
        easterEggOkEl.addEventListener("click", ()=>hideEasterEggWarning());
      }
      if(easterOverlayEl){
        easterOverlayEl.addEventListener("click",(ev)=>{
          if(ev.target===easterOverlayEl) hideEasterEggWarning();
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
          const requestedReportFormat = el.exportCsvBtn.dataset.reportFormat === "docx" ? "docx" : "xlsx";
          delete el.exportCsvBtn.dataset.reportFormat;
          const now = new Date();
          const pad = (n)=>String(n).padStart(2,"0");
          const fileDateSuffix = (date)=>
            date.getFullYear().toString()+
            pad(date.getMonth()+1)+pad(date.getDate())+"_"+pad(date.getHours())+pad(date.getMinutes())+pad(date.getSeconds());
          const safeName = (s)=>String(s || "UNKNOWN").trim().replace(/\s+/g,"_").replace(/[^a-zA-Z0-9._-]/g,"");
          const usingReplayExport = !!(replayUiActive && replayState && Array.isArray(replayState.samples) && replayState.samples.length > 0);
          const sourceExportRows = usingReplayExport ? buildReplayExportRows() : (Array.isArray(logData) ? logData.slice() : []);
          if(!sourceExportRows.length){
            showToast("내보낼 데이터가 없습니다. (실시간 로그 또는 Replay 파일 필요)", "warn");
            return;
          }
          const replayExportMode = usingReplayExport
            ? (replayState.dataMode || inferReplayDataMode(replayState.samples))
            : null;
          const hasRecordedFlightPhase = sourceExportRows.some(row=>flightPhaseCodeFromExportRow(row) >= 1);
          const flightExportMode = isFlightModeUi() || replayExportMode === "flight" || hasRecordedFlightPhase;
          const motorLabel = safeName(selectedMotorName || (el.missionName && el.missionName.value) || "NO_MOTOR");
          const testLabel = safeName((el.missionTestCount && el.missionTestCount.value) || "NA");
          const exportDigits = getStorageExportDigits();
          const exportMetric = (value)=>{
            const rounded = roundFixedNumber(value, exportDigits);
            return rounded == null ? "" : rounded;
          };
          const exportMetricText = (value)=>{
            const rounded = roundFixedNumber(value, exportDigits);
            return rounded == null ? "-" : rounded;
          };
          const flightRecordWindow = flightExportMode ? selectFlightRecordWindow(sourceExportRows) : null;
          const exportRows = flightExportMode ? flightRecordWindow.rows : sourceExportRows;
          if(flightExportMode && !exportRows.length){
            showToast("ARM OFF 또는 실제 비행 시작 시점을 찾지 못해 보고서를 만들 수 없습니다.", "warn", {key:"flight-export-window"});
            return;
          }
          if(flightExportMode && !flightRecordWindow.landed){
            showToast("LANDED 상태가 없어 마지막 수신 데이터까지 포함합니다.", "notice", {key:"flight-export-incomplete"});
          }
          const exportStartMs = Date.parse(exportRows[0].time);
          const exportEndMs = Date.parse(exportRows[exportRows.length - 1].time);
          const hasRecordedCalendarTime = isFinite(exportStartMs);
          const reportReferenceDate = flightExportMode && hasRecordedCalendarTime
            ? new Date(exportStartMs)
            : now;
          const fnameSuffix = flightExportMode && !hasRecordedCalendarTime
            ? "NO_DATE"
            : fileDateSuffix(reportReferenceDate);
          const filenamePrefix = flightExportMode ? "ALTIS_FLASH_FLIGHT_" : "ALTIS_FLASH_DAQ_";
          const filenameSubject = flightExportMode ? "AVIONICS" : motorLabel;
          const filenameBase = filenamePrefix + filenameSubject + "_T" + testLabel + "_" + fnameSuffix + "_data";
          const filenameXlsx = filenameBase + ".xlsx";
          const filenameDocx = filenameBase + ".docx";
          const filenameEng = filenameBase + ".eng";
          const filenameZip = filenameBase + ".zip";

          const hasIgnitionWindowLive =
            ignitionAnalysis &&
            ignitionAnalysis.windowStartMs!=null &&
            ignitionAnalysis.windowEndMs!=null &&
            ignitionAnalysis.thresholdMs!=null &&
            ignitionAnalysis.lastAboveMs!=null;
          const hasIgnitionWindow = hasIgnitionWindowLive || usingReplayExport;

          const windowStartMs = hasIgnitionWindowLive
            ? ignitionAnalysis.windowStartMs
            : (isFinite(exportStartMs) ? exportStartMs : null);
          const windowEndMs = hasIgnitionWindowLive
            ? ignitionAnalysis.windowEndMs
            : (isFinite(exportEndMs) ? exportEndMs : null);
          const windowStartElapsedMs = (hasIgnitionWindowLive && isFinite(Number(firstSampleMs)))
            ? Math.max(0, Number(windowStartMs) - Number(firstSampleMs))
            : null;
          const windowEndElapsedMs = (hasIgnitionWindowLive && isFinite(Number(firstSampleMs)))
            ? Math.max(0, Number(windowEndMs) - Number(firstSampleMs))
            : null;
          const rowInIgnitionWindow = (row, parsedMs)=>{
            if(!hasIgnitionWindow) return false;
            if(hasIgnitionWindowLive){
              const elapsed = Number(row && row.elapsed);
              if(
                isFinite(elapsed) &&
                windowStartElapsedMs != null &&
                windowEndElapsedMs != null &&
                isFinite(windowStartElapsedMs) &&
                isFinite(windowEndElapsedMs)
              ){
                return elapsed >= windowStartElapsedMs && elapsed <= windowEndElapsedMs;
              }
            }
            return isFinite(parsedMs) && parsedMs>=windowStartMs && parsedMs<=windowEndMs;
          };

          const delayRounded = roundFixedNumber(ignitionAnalysis.delaySec, exportDigits);
          const durRounded = roundFixedNumber(ignitionAnalysis.durationSec, exportDigits);

          const missionMotor = (selectedMotorName || (el.missionName && el.missionName.value) || "").trim();
          const missionDiameterMm = parseFloat(el.missionMotorDia && el.missionMotorDia.value);
          const missionLengthMm = parseFloat(el.missionMotorLen && el.missionMotorLen.value);
          const missionDelaySec = parseFloat(el.missionIgnDelay && el.missionIgnDelay.value);
          const missionGrainMassG = parseFloat(el.missionGrainMass && el.missionGrainMass.value);
          const missionTotalMassG = parseFloat(el.missionTotalMass && el.missionTotalMass.value);
          const missionVendor = (el.missionVendor && el.missionVendor.value) ? el.missionVendor.value.trim() : "";
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
          const t0ms = Date.parse(exportRows[0].time);
          const rowRelSeconds = (row, parsedMs)=>{
            if(row && row.elapsed != null && isFinite(Number(row.elapsed))){
              return Number(row.elapsed) / 1000;
            }
            if(t0ms!=null && isFinite(parsedMs)) return (parsedMs - t0ms) / 1000;
            return "";
          };
          const rowFiniteOrNaN = (value)=>{
            if(value == null) return NaN;
            const n = Number(value);
            return isFinite(n) ? n : NaN;
          };
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
              exportMetric(IGN_PRESSURE_BURN_THRESHOLD_MPA),
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
            t("hdrTimeIso"), "ORIGIN", t("hdrThrust"), t("hdrThrustN"), t("hdrPressure"),
            t("hdrGpsLat"), t("hdrGpsLon"), t("hdrGpsAlt"),
            t("hdrAltitudeM"), t("hdrSpeedMps"),
            t("hdrAccelX"), t("hdrAccelY"), t("hdrAccelZ"),
            t("hdrGyroX"), t("hdrGyroY"), t("hdrGyroZ"),
            t("hdrLoopMs"), t("hdrElapsedMs"), t("hdrHxHz"), t("hdrCpuUs"), t("hdrSwitch"), t("hdrIgnOk"), t("hdrRelay"),
            t("hdrIgs"), t("hdrState"), t("hdrTdMs"), t("hdrRelTime"), t("hdrIgnWindowFlag")
          ]];

          if(flightExportMode){
            let altMin = Infinity;
            let altMax = -Infinity;
            let speedMin = Infinity;
            let speedMax = -Infinity;
            let ascentAccelMin = Infinity;
            let ascentAccelMax = -Infinity;
            let gyroMin = Infinity;
            let gyroMax = -Infinity;
            let maxAltitude = null;
            let maxSpeed = null;
            let baseElapsedSec = null;
            let xMaxSec = null;
            let xDeltaSum = 0;
            let xDeltaCount = 0;
            let lastXVal = null;
            const flightRows = [[
              t("hdrElapsedMs"), t("hdrAltitudeM"), "FLIGHT_ACCEL_G", "ALTITUDE_SPEED_MPS",
              "DESCENT_SPEED_MPS", "TERMINAL_SPEED_MPS", "time_axis",
              "GYRO_X_DPS", "GYRO_Y_DPS", "GYRO_Z_DPS"
            ]];
            const flightEventRows = buildStoredFlightEventRows(sourceExportRows, flightRecordWindow);
            const flightRawRows = [[
              t("hdrTimeIso"), "ORIGIN", "BARO_PRESSURE_MPA",
              t("hdrGpsLat"), t("hdrGpsLon"), t("hdrGpsAlt"),
              t("hdrAltitudeM"), "ALTITUDE_SPEED_MPS", "DESCENT_SPEED_MPS", "TERMINAL_SPEED_MPS",
              t("hdrAccelX"), t("hdrAccelY"), t("hdrAccelZ"),
              t("hdrGyroX"), t("hdrGyroY"), t("hdrGyroZ"),
              t("hdrLoopMs"), t("hdrElapsedMs"), t("hdrCpuUs"),
              "ARM_PHYSICAL", "ARM_EFFECTIVE", t("hdrIgnOk"), t("hdrRelay"),
              t("hdrState"), t("hdrTdMs"), "FLIGHT_PHASE", "DEPLOYMENT_STATE", "DEPLOYMENT_FLAGS",
              "FLIGHT_ACCEL_RAW_G", "COAST_ACCEL_FILTERED_G",
              "FAST_VERTICAL_SPEED_MPS", "DISPLAY_VERTICAL_SPEED_MPS",
              "RECENT_APOGEE_M", "COAST_HOLD_MS", "DESCENT_HOLD_MS",
              "TRANSITION_REASON", "TRANSITION_AT_MS", "BACKUP_EXECUTED"
            ]];

            let reportGpsAltBase = null;
            const reportTimeMsValues = exportRows.map((row, index)=>{
              if(row && row.elapsed != null && isFinite(Number(row.elapsed))){
                return Number(row.elapsed);
              }
              const parsedMs = Date.parse(row && row.time);
              return isFinite(parsedMs) ? parsedMs : (index * 10);
            });
            const reportAltitudeMValues = exportRows.map((row)=>{
              const directAltitudeM = rowFiniteOrNaN(row && row.alt_m);
              if(isFinite(directAltitudeM)) return directAltitudeM;
              const gpsAltitudeM = rowFiniteOrNaN(row && row.gps_alt);
              if(!isFinite(gpsAltitudeM)) return NaN;
              if(reportGpsAltBase == null) reportGpsAltBase = gpsAltitudeM;
              return gpsAltitudeM - reportGpsAltBase;
            });
            const reportAltitudeRateMps = deriveAltitudeSpeedSeries(
              reportTimeMsValues,
              reportAltitudeMValues,
              2400
            );
            const reportAltitudeSpeedMps = reportAltitudeRateMps.map((rateMps)=>{
              const rate = Number(rateMps);
              return isFinite(rate) ? rate : NaN;
            });
            let reportApogeeIndex = -1;
            let reportApogeeAltitudeM = -Infinity;
            reportAltitudeMValues.forEach((altitudeM, index)=>{
              const altitude = Number(altitudeM);
              if(isFinite(altitude) && altitude > reportApogeeAltitudeM){
                reportApogeeAltitudeM = altitude;
                reportApogeeIndex = index;
              }
            });
            let reportDescentSpeedMps = reportAltitudeSpeedMps.map((speedMps, index)=>{
              const speed = Number(speedMps);
              if(!isFinite(speed) || speed >= 0) return NaN;
              const phaseCode = flightPhaseCodeFromExportRow(exportRows[index]);
              const phaseConfirmsDescent = phaseCode === 3;
              const phaseUnavailable = phaseCode < 0;
              const afterApogee = reportApogeeIndex >= 0 && index >= reportApogeeIndex;
              return (phaseConfirmsDescent || (phaseUnavailable && afterApogee)) ? Math.abs(speed) : NaN;
            });
            let terminalSpeedMps = reportDescentSpeedMps.reduce((maxValue, speedMps)=>{
              const speed = Number(speedMps);
              return isFinite(speed) ? Math.max(maxValue, speed) : maxValue;
            }, 0);
            if(!(terminalSpeedMps > 0)){
              reportDescentSpeedMps = reportAltitudeSpeedMps.map((speedMps, index)=>{
                const speed = Number(speedMps);
                const afterApogee = reportApogeeIndex >= 0 && index >= reportApogeeIndex;
                return isFinite(speed) && speed < 0 && afterApogee ? Math.abs(speed) : NaN;
              });
              terminalSpeedMps = reportAltitudeSpeedMps.reduce((maxValue, speedMps, index)=>{
                const speed = Number(speedMps);
                const afterApogee = reportApogeeIndex >= 0 && index >= reportApogeeIndex;
                return isFinite(speed) && speed < 0 && afterApogee
                  ? Math.max(maxValue, Math.abs(speed))
                  : maxValue;
              }, 0);
            }
            const reportTerminalSpeedMps = reportDescentSpeedMps.map((speedMps)=>
              isFinite(Number(speedMps)) && terminalSpeedMps > 0 ? terminalSpeedMps : NaN
            );
            const launchTimeIso = hasRecordedCalendarTime ? new Date(exportStartMs).toISOString() : "";
            const trajectory3d = buildFlightTrajectory3dArtifact(exportRows, reportAltitudeMValues, launchTimeIso);

            for(let rowIndex = 0; rowIndex < exportRows.length; rowIndex++){
              const row = exportRows[rowIndex];
              const ms = Date.parse(row.time);
              const rel = rowRelSeconds(row, ms);
              const altVal = reportAltitudeMValues[rowIndex];
              const speedVal = reportAltitudeSpeedMps[rowIndex];
              const descentSpeedVal = reportDescentSpeedMps[rowIndex];
              const terminalSpeedVal = reportTerminalSpeedMps[rowIndex];
              const axVal = rowFiniteOrNaN(row.ax);
              const ayVal = rowFiniteOrNaN(row.ay);
              const azVal = rowFiniteOrNaN(row.az);
              const gxVal = rowFiniteOrNaN(row.gx);
              const gyVal = rowFiniteOrNaN(row.gy);
              const gzVal = rowFiniteOrNaN(row.gz);
              const ascentAccelVal = calcAscentAccelG(axVal, ayVal, azVal);
              const pVal = rowFiniteOrNaN(row.p);

              let xVal = "";
              if(row.elapsed != null && isFinite(Number(row.elapsed))){
                const elapsedSec = Number(row.elapsed) / 1000;
                if(baseElapsedSec == null) baseElapsedSec = elapsedSec;
                xVal = elapsedSec - baseElapsedSec;
              }else if(isFinite(ms) && isFinite(exportStartMs)){
                xVal = (ms - exportStartMs) / 1000;
              }
              if(xVal !== "" && isFinite(xVal)){
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
              const xNum = (xVal !== "" ? Number(xVal.toFixed(3)) : "");
              const xLabel = "";

              if(isFinite(altVal)){
                if(altVal < altMin) altMin = altVal;
                if(altVal > altMax) altMax = altVal;
                if(maxAltitude == null || altVal > maxAltitude) maxAltitude = altVal;
              }
              if(isFinite(speedVal)){
                if(speedVal < speedMin) speedMin = speedVal;
                if(speedVal > speedMax) speedMax = speedVal;
                if(maxSpeed == null || speedVal > maxSpeed) maxSpeed = speedVal;
              }
              if(isFinite(ascentAccelVal)){
                if(ascentAccelVal < ascentAccelMin) ascentAccelMin = ascentAccelVal;
                if(ascentAccelVal > ascentAccelMax) ascentAccelMax = ascentAccelVal;
              }
              [gxVal, gyVal, gzVal].forEach((gyroValue)=>{
                if(!isFinite(gyroValue)) return;
                if(gyroValue < gyroMin) gyroMin = gyroValue;
                if(gyroValue > gyroMax) gyroMax = gyroValue;
              });

              flightRows.push([
                xNum,
                (isFinite(altVal) ? Number(altVal.toFixed(2)) : ""),
                (isFinite(ascentAccelVal) ? Number(ascentAccelVal.toFixed(3)) : ""),
                (isFinite(speedVal) ? Number(speedVal.toFixed(2)) : ""),
                (isFinite(descentSpeedVal) ? Number(descentSpeedVal.toFixed(2)) : ""),
                (isFinite(terminalSpeedVal) ? Number(terminalSpeedVal.toFixed(2)) : ""),
                xLabel,
                (isFinite(gxVal) ? Number(gxVal.toFixed(3)) : ""),
                (isFinite(gyVal) ? Number(gyVal.toFixed(3)) : ""),
                (isFinite(gzVal) ? Number(gzVal.toFixed(3)) : "")
              ]);

              flightRawRows.push([
                row.time || "",
                dataOriginLabel(row.origin || currentDataOrigin),
                exportMetric(pVal),
                (row.gps_lat != null && isFinite(Number(row.gps_lat))) ? Number(Number(row.gps_lat).toFixed(7)) : "",
                (row.gps_lon != null && isFinite(Number(row.gps_lon))) ? Number(Number(row.gps_lon).toFixed(7)) : "",
                (row.gps_alt != null && isFinite(Number(row.gps_alt))) ? Number(Number(row.gps_alt).toFixed(2)) : "",
                isFinite(altVal) ? Number(altVal.toFixed(2)) : "",
                isFinite(speedVal) ? Number(speedVal.toFixed(2)) : "",
                isFinite(descentSpeedVal) ? Number(descentSpeedVal.toFixed(2)) : "",
                isFinite(terminalSpeedVal) ? Number(terminalSpeedVal.toFixed(2)) : "",
                (row.ax != null && isFinite(Number(row.ax))) ? Number(Number(row.ax).toFixed(3)) : "",
                (row.ay != null && isFinite(Number(row.ay))) ? Number(Number(row.ay).toFixed(3)) : "",
                (row.az != null && isFinite(Number(row.az))) ? Number(Number(row.az).toFixed(3)) : "",
                (row.gx != null && isFinite(Number(row.gx))) ? Number(Number(row.gx).toFixed(3)) : "",
                (row.gy != null && isFinite(Number(row.gy))) ? Number(Number(row.gy).toFixed(3)) : "",
                (row.gz != null && isFinite(Number(row.gz))) ? Number(Number(row.gz).toFixed(3)) : "",
                (row.lt ?? ""),
                (row.elapsed != null && isFinite(Number(row.elapsed)) ? Number(Number(row.elapsed).toFixed(0)) : ""),
                (row.ct ?? ""),
                (row.sp ?? ""),
                (row.s  ?? 0),
                (row.ic ?? 0),
                (row.r  ?? 0),
                (row.st ?? 0),
                (row.td ?? 0),
                row.flight_phase || (flightPhaseCodeFromExportRow(row) >= 0
                  ? FLIGHT_PHASE_CODE_NAMES[flightPhaseCodeFromExportRow(row)]
                  : ""),
                (row.deployment_state != null && isFinite(Number(row.deployment_state)))
                  ? Number(row.deployment_state)
                  : "",
                (row.deployment_flags != null && isFinite(Number(row.deployment_flags)))
                  ? Number(row.deployment_flags)
                  : "",
                (row.flight_accel_raw_g != null && isFinite(Number(row.flight_accel_raw_g)))
                  ? Number(Number(row.flight_accel_raw_g).toFixed(3))
                  : (isFinite(axVal) && isFinite(ayVal) && isFinite(azVal)
                    ? Number(Math.sqrt((axVal * axVal) + (ayVal * ayVal) + (azVal * azVal)).toFixed(3))
                    : ""),
                (row.flight_accel_filtered_g != null && isFinite(Number(row.flight_accel_filtered_g)))
                  ? Number(Number(row.flight_accel_filtered_g).toFixed(3))
                  : "",
                (row.flight_fast_vertical_speed_mps != null && isFinite(Number(row.flight_fast_vertical_speed_mps)))
                  ? Number(Number(row.flight_fast_vertical_speed_mps).toFixed(2))
                  : "",
                (row.flight_display_vertical_speed_mps != null && isFinite(Number(row.flight_display_vertical_speed_mps)))
                  ? Number(Number(row.flight_display_vertical_speed_mps).toFixed(2))
                  : "",
                (row.apogee_m != null && isFinite(Number(row.apogee_m)))
                  ? Number(Number(row.apogee_m).toFixed(2))
                  : "",
                (row.coast_hold_ms != null && isFinite(Number(row.coast_hold_ms)))
                  ? Number(row.coast_hold_ms)
                  : "",
                (row.descent_hold_ms != null && isFinite(Number(row.descent_hold_ms)))
                  ? Number(row.descent_hold_ms)
                  : "",
                (row.flight_transition_reason != null && isFinite(Number(row.flight_transition_reason)))
                  ? (FLIGHT_TRANSITION_REASON_NAMES[Number(row.flight_transition_reason)] ||
                    ("REASON_" + Number(row.flight_transition_reason)))
                  : "",
                (row.flight_transition_at_ms != null && isFinite(Number(row.flight_transition_at_ms)))
                  ? Number(row.flight_transition_at_ms)
                  : "",
                (row.backup_executed != null && isFinite(Number(row.backup_executed)))
                  ? Number(row.backup_executed)
                  : (((Number(row.deployment_flags) || 0) & (1 << 2)) ? 1 : 0)
              ]);
            }

            const altUnit = calcNiceUnit(altMin, altMax, 6);
            const speedUnit = calcNiceUnit(speedMin, speedMax, 6);
            const ascentAccelUnit = calcNiceUnit(ascentAccelMin, ascentAccelMax, 6);
            const gyroUnit = calcNiceUnit(gyroMin, gyroMax, 6);
            const terminalSpeedUnit = calcNiceUnit(0, terminalSpeedMps, 6);
            const altAxis = axisMinMax(altMin, altMax, altUnit || 1);
            const speedAxis = axisMinMax(speedMin, speedMax, speedUnit || 1);
            const ascentAccelAxis = axisMinMax(ascentAccelMin, ascentAccelMax, ascentAccelUnit || 1);
            const gyroAxis = (isFinite(gyroMin) && isFinite(gyroMax) && gyroMax === gyroMin)
              ? {min:Math.min(0, gyroMin - 1), max:Math.max(0, gyroMax + 1)}
              : axisMinMax(gyroMin, gyroMax, gyroUnit || 1);
            const terminalSpeedAxis = axisMinMax(0, terminalSpeedMps, terminalSpeedUnit || 1);
            const xMajorUnit = 0.5;
            const minLabelIntervalSec = 5.0;
            const xLabelIntervalSec = (xMaxSec != null && isFinite(xMaxSec) && xMaxSec > 0)
              ? Math.max(minLabelIntervalSec, xMaxSec / 10)
              : minLabelIntervalSec;
            const avgDelta = (xDeltaCount > 0) ? (xDeltaSum / xDeltaCount) : null;
            const xTickSkip = (avgDelta && isFinite(avgDelta) && avgDelta > 0)
              ? Math.max(1, Math.round(xLabelIntervalSec / avgDelta))
              : 1;
            let lastLabelX = null;
            for(let i = 1; i < flightRows.length; i++){
              const x = Number(flightRows[i][0]);
              if(!isFinite(x)){
                flightRows[i][6] = "";
                continue;
              }
              const shouldShow = ((i - 1) % xTickSkip) === 0 || i === (flightRows.length - 1);
              if(!shouldShow){
                flightRows[i][6] = "";
                continue;
              }
              if(lastLabelX != null && Math.abs(x - lastLabelX) < (xLabelIntervalSec * 0.5)){
                flightRows[i][6] = "";
                continue;
              }
              flightRows[i][6] = Number(x.toFixed(1));
              lastLabelX = x;
            }
            const xMax = (xMaxSec != null && isFinite(xMaxSec)) ? Math.max(xMajorUnit, Math.ceil(xMaxSec / xMajorUnit) * xMajorUnit) : null;
            const flightChartTimesSec = flightRows.slice(1).map((row)=>row[0]);
            const flightTelemetryChartImages = buildFlightTelemetryChartImages(
              flightChartTimesSec,
              [
                {
                  title:"ALTITUDE PROFILE",
                  subtitle:"BAROMETRIC ALTITUDE · FLIGHT TIME",
                  axisYTitle:"ALTITUDE (m)",
                  yMin:altAxis.min,
                  yMax:altAxis.max,
                  summaryUnit:" m",
                  series:[{label:"ALTITUDE", color:"#10b981", values:flightRows.slice(1).map((row)=>row[1])}]
                },
                {
                  title:"VERTICAL SPEED",
                  subtitle:"ALTITUDE-DERIVED RATE · POSITIVE UP / NEGATIVE DOWN",
                  axisYTitle:"VERTICAL SPEED (m/s)",
                  yMin:speedAxis.min,
                  yMax:speedAxis.max,
                  summaryUnit:" m/s",
                  series:[{label:"VERTICAL SPEED", color:"#3b82f6", values:flightRows.slice(1).map((row)=>row[3])}]
                },
                {
                  title:"FLIGHT ACCELERATION",
                  subtitle:"NET ACCELERATION · GRAVITY-REMOVED MAGNITUDE",
                  axisYTitle:"NET ACCELERATION (g)",
                  yMin:ascentAccelAxis.min,
                  yMax:ascentAccelAxis.max,
                  summaryUnit:" g",
                  series:[{label:"ACCELERATION", color:"#f59e0b", values:flightRows.slice(1).map((row)=>row[2])}]
                },
                {
                  title:"FLIGHT DYNAMICS",
                  subtitle:"ALTITUDE / VERTICAL SPEED / ACCELERATION",
                  axisYTitle:"NORMALIZED PROFILE (%)",
                  normalizeSeries:true,
                  series:[
                    {label:"ALTITUDE", color:"#10b981", values:flightRows.slice(1).map((row)=>row[1])},
                    {label:"VERTICAL SPEED", color:"#3b82f6", values:flightRows.slice(1).map((row)=>row[3])},
                    {label:"ACCELERATION", color:"#f59e0b", values:flightRows.slice(1).map((row)=>row[2])}
                  ]
                },
                {
                  title:"DESCENT PERFORMANCE",
                  subtitle:"DESCENT SPEED / TERMINAL SPEED",
                  axisYTitle:"DOWNWARD SPEED (m/s)",
                  yMin:Math.max(0, terminalSpeedAxis.min),
                  yMax:terminalSpeedAxis.max,
                  series:[
                    {label:"DESCENT SPEED", color:"#0ea5e9", values:flightRows.slice(1).map((row)=>row[4])},
                    {label:"TERMINAL SPEED", color:"#ef4444", dashed:true, values:flightRows.slice(1).map((row)=>row[5])}
                  ]
                },
                {
                  title:"GYROSCOPE",
                  subtitle:"ANGULAR VELOCITY · X / Y / Z",
                  axisYTitle:"ANGULAR VELOCITY (dps)",
                  yMin:gyroAxis.min,
                  yMax:gyroAxis.max,
                  series:[
                    {label:"GYRO X", color:"#ef4444", values:flightRows.slice(1).map((row)=>row[7])},
                    {label:"GYRO Y", color:"#22c55e", values:flightRows.slice(1).map((row)=>row[8])},
                    {label:"GYRO Z", color:"#3b82f6", values:flightRows.slice(1).map((row)=>row[9])}
                  ]
                }
              ],
              launchTimeIso
            );
            const chartConfig = (flightRows.length >= 3) ? {
              sheetName:"FLIGHT_RECORD",
              drawingSheetName:"INFO",
              drawingColumns:1,
              cardStyle:"flightCard",
              renderChartsAsImages:true,
              chartImages:flightTelemetryChartImages,
              trajectoryFirst:true,
              startRow:2,
              endRow:flightRows.length,
              axisTitleX:"FLIGHT TIME (s)",
              hideXGridlines:true,
              xMajorUnit:xMajorUnit,
              xNumFmt:"0.0",
              xTickSkip:xTickSkip,
              xMin:(xMax != null ? 0 : null),
              xMax:xMax,
              xLabelCol:"G",
              trajectoryImage:trajectory3d.pngBytes,
              chart1:{
                title:"ALTITUDE PROFILE",
                subtitle:"BAROMETRIC ALTITUDE · FLIGHT TIME",
                axisYTitle:"ALTITUDE (m)",
                majorUnit:altUnit,
                yMin:altAxis.min,
                yMax:altAxis.max,
                series:[{col:"B", nameCell:"FLIGHT_RECORD!$B$1", color:"10B981"}]
              },
              chart2:{
                title:"VERTICAL SPEED",
                subtitle:"ALTITUDE-DERIVED RATE · POSITIVE UP / NEGATIVE DOWN",
                axisYTitle:"VERTICAL SPEED (m/s)",
                majorUnit:speedUnit,
                yMin:speedAxis.min,
                yMax:speedAxis.max,
                series:[{col:"D", nameCell:"FLIGHT_RECORD!$D$1", color:"3B82F6"}]
              },
              chart3:{
                title:"FLIGHT ACCELERATION",
                subtitle:"NET ACCELERATION · GRAVITY-REMOVED MAGNITUDE",
                axisYTitle:"NET ACCELERATION (g)",
                majorUnit:ascentAccelUnit,
                yMin:ascentAccelAxis.min,
                yMax:ascentAccelAxis.max,
                series:[
                  {col:"C", nameCell:"FLIGHT_RECORD!$C$1", color:"F59E0B"}
                ]
              },
              chart4:{
                title:"FLIGHT DYNAMICS",
                subtitle:"ALTITUDE / VERTICAL SPEED / ACCELERATION",
                axisYTitle:"VALUE",
                majorUnit:null,
                yMin:null,
                yMax:null,
                series:[
                  {col:"B", nameCell:"FLIGHT_RECORD!$B$1", color:"10B981"},
                  {col:"D", nameCell:"FLIGHT_RECORD!$D$1", color:"3B82F6"},
                  {col:"C", nameCell:"FLIGHT_RECORD!$C$1", color:"F59E0B"}
                ]
              },
              chart5:{
                title:"DESCENT PERFORMANCE",
                subtitle:"DESCENT SPEED / TERMINAL SPEED",
                axisYTitle:"DOWNWARD SPEED (m/s)",
                majorUnit:terminalSpeedUnit,
                yMin:Math.max(0, terminalSpeedAxis.min),
                yMax:terminalSpeedAxis.max,
                series:[
                  {col:"E", nameCell:"FLIGHT_RECORD!$E$1", color:"0EA5E9"},
                  {col:"F", nameCell:"FLIGHT_RECORD!$F$1", color:"EF4444"}
                ]
              },
              chart6:{
                title:"GYROSCOPE",
                subtitle:"ANGULAR VELOCITY · X / Y / Z",
                axisYTitle:"ANGULAR VELOCITY (dps)",
                majorUnit:gyroUnit,
                yMin:gyroAxis.min,
                yMax:gyroAxis.max,
                series:[
                  {col:"H", nameCell:"FLIGHT_RECORD!$H$1", color:"EF4444"},
                  {col:"I", nameCell:"FLIGHT_RECORD!$I$1", color:"22C55E"},
                  {col:"J", nameCell:"FLIGHT_RECORD!$J$1", color:"3B82F6"}
                ]
              }
            } : null;
            const infoMaxAltitude = (maxAltitude != null && isFinite(maxAltitude)) ? maxAltitude : 0;
            const infoMaxSpeed = (maxSpeed != null && isFinite(maxSpeed)) ? maxSpeed : 0;
            const formatInfoEventTPlus = (value)=>value != null && isFinite(Number(value))
              ? ("T+" + Number(value).toFixed(3) + "초")
              : "기록 없음";
            const infoRows = [
              {cells:["FLIGHT RECORD"], style:2},
              {cells:["운용 모드: AVIONICS"], style:3},
              {cells:["실험 회차: " + ((el.missionTestCount && el.missionTestCount.value) ? el.missionTestCount.value.trim() : "-")], style:3},
              {cells:["기록 범위: ARM OFF → " + (flightRecordWindow.landed ? "LANDED" : "LAST SAMPLE")], style:3},
              {cells:["시작 판정: " + flightRecordWindow.startReason], style:3},
              {cells:["포함 샘플: " + exportRows.length], style:3},
              {cells:["최대 고도 (m): " + exportMetricText(infoMaxAltitude)], style:3},
              {cells:["최대 고도 속도 (m/s): " + exportMetricText(infoMaxSpeed)], style:3},
              {cells:["고도 속도 계산: 고도 기반 2.4초 추세 미분"], style:3},
              {cells:["종단 속도 (최대 하강 속력, m/s): " + exportMetricText(terminalSpeedMps)], style:3},
              {cells:["3D 비행 궤적: " + (
                trajectory3d.positionMode === "IMU_LOCAL"
                  ? "자이로·가속도 로컬 추정 + 기압 고도"
                  : (trajectory3d.positionMode === "IMU_GPS_FUSION"
                  ? "초기 IMU 추정 + GPS 결합 + 기압 고도"
                  : (trajectory3d.gpsAvailable ? "GPS + 고도" : "GPS 없음 · 수직 고도 프로파일"))
              )], style:3},
              {cells:["초기 수평 궤적: " + (
                trajectory3d.positionMode === "IMU_LOCAL"
                  ? "발사 자세 기준 로컬 X/Z · 절대 방위 미사용"
                  : (trajectory3d.positionMode === "IMU_GPS_FUSION"
                  ? ("IMU 추정 후 T+" + Number(trajectory3d.imuAssistEndElapsedSec || 0).toFixed(3) + "초부터 GPS에 점진 수렴")
                  : "GPS 좌표 사용")
              )], style:3},
              {cells:["궤적 기울기 판정: 발사 자세 대비 3° 초과부터 횡가속도 반영"], style:3},
              {cells:["궤적 동기화: 기압 고도를 시간축 기준으로 사용 · GPS는 원본 참고값만 보존"], style:3},
              {cells:["단분리 시점 (서보 CH1): " + formatInfoEventTPlus(trajectory3d.stageSeparationTPlusSec)], style:3},
              {cells:["사출 시점 (서보 CH2): " + formatInfoEventTPlus(trajectory3d.ejectionTPlusSec)], style:3},
              {cells:["이벤트 원본: BIN/텔레메트리 저장 레코드"], style:3},
              {cells:["발사 시각 (ARM OFF): " + (launchTimeIso || "절대 날짜 미기록 · T+ 기준")], style:3}
            ];
            if(requestedReportFormat === "docx"){
              const reportDateText = reportReferenceDate.getFullYear() + "-" +
                pad(reportReferenceDate.getMonth() + 1) + "-" + pad(reportReferenceDate.getDate()) + " " +
                pad(reportReferenceDate.getHours()) + ":" + pad(reportReferenceDate.getMinutes()) + ":" + pad(reportReferenceDate.getSeconds());
              const maximumAccelerationG = isFinite(ascentAccelMax) ? Math.max(0, ascentAccelMax) : null;
              const flightDurationSec = xMaxSec != null && isFinite(xMaxSec) ? Math.max(0, xMaxSec) : null;
              const docxEventRows = [["Sequence (T+)", "이벤트", "비고"]];
              flightEventRows.slice(1, 13).forEach((row)=>{
                docxEventRows.push([row[1] || "", row[2] || "", row[3] || ""]);
              });
              while(docxEventRows.length < 7) docxEventRows.push(["", "", ""]);
              const selectedDocxCharts = [flightTelemetryChartImages[0], flightTelemetryChartImages[2]]
                .filter((entry)=>entry && entry.pngBytes instanceof Uint8Array && entry.pngBytes.length > 0);
              const docxBytes = buildDocxBytes({
                title:"ALTIS FLASH FLIGHT T" + testLabel + " FIRST STAGE REPORT",
                subtitle:"모델 로켓 1단부 비행 데이터 보고서",
                dateText:reportDateText,
                sourceText:"Avionics Flash Memory Flight Record (bin / telemetry)",
                createdDate:reportReferenceDate,
                overviewRows:[
                  ["항목", "결과"],
                  ["최고고도", exportMetricText(infoMaxAltitude) + " m"],
                  ["최고속도", exportMetricText(infoMaxSpeed) + " m/s"],
                  ["최대가속도", maximumAccelerationG == null ? "" : (exportMetricText(maximumAccelerationG) + " G")],
                  ["총 비행시간", flightDurationSec == null ? "" : (exportMetricText(flightDurationSec) + " s")],
                  ["데이터 기록", flightRecordWindow.landed ? "정상" : "마지막 수신 데이터까지"],
                  ["이벤트 기록", flightEventRows.length > 1 ? "정상" : "기록 없음"]
                ],
                chartImages:selectedDocxCharts,
                eventRows:docxEventRows,
                stageRows:[
                  ["항목", "결과"],
                  ["시점", formatInfoEventTPlus(trajectory3d.stageSeparationTPlusSec)],
                  ["고도", ""],
                  ["상승속도", ""]
                ],
                ejectionRows:[
                  ["항목", "결과"],
                  ["시점", formatInfoEventTPlus(trajectory3d.ejectionTPlusSec)],
                  ["고도", ""],
                  ["상승속도", ""]
                ]
              });
              downloadBlobAsFile(
                new Blob([docxBytes], {type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),
                filenameDocx
              );
              reportExportedRevision = logDataRevision;
              reportExportedOnce = true;
              updateExportGuardUi();
              addLogLine("Flight DOCX export: " + filenameDocx, "INFO");
              showToast("Flight 데이터를 Word 보고서로 내보냈습니다.", "success");
              return;
            }
            const xlsxBytes = buildXlsxBytes([
              {name:"INFO", rows:infoRows},
              {name:"FLIGHT_RECORD", rows:flightRows},
              {name:"TRAJECTORY_3D", rows:trajectory3d.rows},
              {name:"EVENT", rows:flightEventRows},
              {name:"RAW", rows:flightRawRows}
            ], chartConfig);
            downloadBlobAsFile(
              new Blob([xlsxBytes], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),
              filenameXlsx
            );
            reportExportedRevision = logDataRevision;
            reportExportedOnce = true;
            updateExportGuardUi();
            addLogLine("Flight XLSX export: " + filenameXlsx, "INFO");
            showToast("Flight 데이터를 XLSX로 내보냈습니다.", "success");
            return;
          }

          if(requestedReportFormat === "docx"){
            showToast("Word 보고서는 Flight 모드 데이터에서 내보낼 수 있습니다.", "notice", {key:"docx-flight-only"});
            return;
          }

          for(const row of exportRows){
            const ms = Date.parse(row.time);
            const rel = rowRelSeconds(row, ms);
            const inWin = rowInIgnitionWindow(row, ms) ? 1 : 0;
            const tVal = rowFiniteOrNaN(row.t);
            const pVal = rowFiniteOrNaN(row.p);
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
              dataOriginLabel(row.origin || currentDataOrigin),
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

          for(const row of exportRows){
            const ms = Date.parse(row.time);
            if(hasIgnitionWindow && !rowInIgnitionWindow(row, ms)){
              continue;
            }
            const tVal = rowFiniteOrNaN(row.t);
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

      window.addEventListener("resize",()=>{
        if(!el.flashLinkTopologyOverlay || el.flashLinkTopologyOverlay.classList.contains("hidden")) return;
        syncFlashLinkTopologyUi();
      }, {passive:true});

      if(el.flashLinkReportBtn){
        el.flashLinkReportBtn.addEventListener("click",(ev)=>{
          if(ev && ev.__flashLinkReportHandled) return;
          handleFlashLinkReportControl("flashLinkReportBtn");
        });
      }
      if(el.flashLinkReportStart){
        el.flashLinkReportStart.addEventListener("click",(ev)=>{
          if(ev && ev.__flashLinkReportHandled) return;
          handleFlashLinkReportControl("flashLinkReportStart");
        });
      }
      if(el.flashLinkReportCancel){
        el.flashLinkReportCancel.addEventListener("click",(ev)=>{
          if(ev && ev.__flashLinkReportHandled) return;
          handleFlashLinkReportControl("flashLinkReportCancel");
        });
      }
      if(el.flashLinkReportClose){
        el.flashLinkReportClose.addEventListener("click",(ev)=>{
          if(ev && ev.__flashLinkReportHandled) return;
          handleFlashLinkReportControl("flashLinkReportClose");
        });
      }
      document.addEventListener("click",(ev)=>{
        const target = ev.target && ev.target.closest
          ? ev.target.closest("#flashLinkReportBtn,#flashLinkReportStart,#flashLinkReportCancel,#flashLinkReportClose")
          : null;
        if(!target) return;
        ev.preventDefault();
        ev.__flashLinkReportHandled = true;
        handleFlashLinkReportControl(target.id);
      }, true);
      if(el.flashLinkReportOverlay){
        el.flashLinkReportOverlay.addEventListener("click",(ev)=>{
          if(ev.target !== el.flashLinkReportOverlay) return;
          if(flashLinkReportState.phase === "idle") hideFlashLinkReportOverlay();
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
          if(target === "communication") scheduleFlashLinkChartRender();
        });
      });
      document.querySelectorAll("[data-settings-mobile-target]").forEach((btn)=>{
        btn.addEventListener("click",()=>{
          openMobileSettingsSection(btn.dataset.settingsMobileTarget, btn.dataset.settingsMobileTitle || "설정");
        });
      });

      if(el.controlsSettingsBtns && el.controlsSettingsBtns.length){
        el.controlsSettingsBtns.forEach(btn=>{
          btn.addEventListener("click",()=>showSettings());
        });
      }
      const sideNavDesktop = document.querySelector(".side-nav-desktop");
      // The current desktop navigation is a fixed icon dock. The legacy
      // click-to-expand timer changed the layout for 900 ms and forced chart
      // reflow even though the dock itself no longer expands.
      if(sideNavDesktop) sideNavDesktop.classList.remove("is-expanded");
      const sideNavItems = document.querySelectorAll(".side-nav-item");
      const setActiveView = (title, options = {})=>{
        closeIgnitionModals();
        setDesktopControlDrawerOpen(false);
        const label = title || "Dashboard";
        const lower = label.toLowerCase();
        const dashboardUsesCamera = lower === "dashboard" && isDesktopLayout();
        const displayLabel = (lower === "home") ? "Welcome to FLASH6"
          : (lower === "control" ? "Control Panel" : label);
        if(el.pageTitle) el.pageTitle.textContent = displayLabel;
        const isHome = lower === "home";
        const isTerminal = lower === "terminal";
        const isHardware = lower === "hardware";
        const isGyro = lower === "gyro";
        const isCountdown = lower === "countdown";
        const isMission = lower === "mission";
        const isCamera = lower === "camera" || dashboardUsesCamera;
        const isControl = lower === "control";
        const isDashboard = !isHome && !isTerminal && !isHardware && !isGyro && !isCountdown && !isMission && !isCamera && !isControl;
        setDashboardDrawerOpen(false, true);
        if(!isDashboard) setMobileBoardPanelOpen(false);
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
        syncMobileSequenceStatus();
        if(el.homeView) el.homeView.classList.toggle("hidden", !isHome);
        if(el.cameraView) el.cameraView.classList.toggle("hidden", !isCamera);
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
          else if(isCamera) label = "CAMERA";
          el.countdownLabel.textContent = label;
        }
        document.body.classList.toggle("countdown-view-active", isCountdown);
        document.body.classList.toggle("dashboard-view-active", isDashboard);
        document.body.classList.toggle("hardware-view-active", isHardware);
        document.body.classList.toggle("terminal-view-active", isTerminal);
        document.body.classList.toggle("home-view-active", isHome);
        document.body.classList.toggle("mission-view-active", isMission);
        document.body.classList.toggle("camera-view-active", isCamera);
        document.body.classList.toggle("camera-dashboard-default", dashboardUsesCamera);
        if(dashboardUsesCamera && !options.preserveCameraVideo){
          document.body.classList.add("camera-gyro-plus-layout");
        }
        if(!isCamera) document.body.classList.remove("camera-gyro-plus-layout");
        if(!isCamera) setCameraControlMenuOpen(false);
        document.body.classList.toggle("mobile-board-header-active", isDashboard || isHardware || isTerminal);
        syncMobileBoardHeaderScrollState();
        syncCameraGyroPreviewMount();
        syncDesktopGyroPreviewMount();
        syncCameraMapPreviewMount();
        syncMobileMapPreviewMount();
        if(isCamera){
          syncCameraHud();
          if(document.body.classList.contains("camera-gyro-plus-layout")){
            if(webcamStream) stopWebcam({preserveSim:true});
            else syncCameraEnabledState();
          }else if(isCameraUseEnabled() || cameraSimSourceActive){
            startWebcam();
          }else{
            syncCameraEnabledState();
          }
        }else if(webcamStream){
          stopWebcam();
        }
        if(isHome) updateHomeUI();
        if(isDashboard || isCamera){
          syncChartHeightToControls(0);
          scheduleStatusMapRefresh();
        }
        if(isHardware){
          fetchSpiFlashStatus({background:true});
        }
      };
      const activateNavItem = (title, options = {})=>{
        if(!sideNavItems.length){
          setActiveView(title, options);
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
        setActiveView(title, options);
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
      window.addEventListener("keydown", (ev)=>{
        if(ev.key === "Escape" && document.body.classList.contains("dashboard-drawer-open")){
          ev.preventDefault();
          setDashboardDrawerOpen(false);
          return;
        }
        if(ev.key === "Escape" && el.cameraControlMenuLayer && !el.cameraControlMenuLayer.classList.contains("hidden")){
          ev.preventDefault();
          setCameraControlMenuOpen(false);
          return;
        }
        if(ev.repeat) return;
        const isSKey = ev.code === "KeyS" || String(ev.key || "").toLowerCase() === "s";
        const isMKey = ev.code === "KeyM" || String(ev.key || "").toLowerCase() === "m";
        const isCKey = ev.code === "KeyC" || String(ev.key || "").toLowerCase() === "c";
        if(!ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey || (!isSKey && !isMKey && !isCKey)) return;
        const active = document.activeElement;
        const tag = active && active.tagName ? active.tagName.toLowerCase() : "";
        if(tag === "input" || tag === "textarea" || tag === "select" || (active && active.isContentEditable)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if(isCKey){
          if(!isDesktopLayout()) return;
          const openingCamera = document.body.classList.contains("camera-gyro-plus-layout");
          if(openingCamera){
            document.body.classList.remove("camera-gyro-plus-layout");
            activateNavItem("Dashboard", {preserveCameraVideo:true});
            syncCameraGyroPreviewMount();
            return;
          }
          document.body.classList.add("camera-gyro-plus-layout");
          if(uiSettings){
            uiSettings.gyroPreview = "3d";
            saveSettings();
            applySettingsToUI();
          }
          // Dashboard is gyro-first; Shift+C only opens the camera temporarily.
          activateNavItem("Dashboard");
          ensureGyroTerrainForGeo(getGyroTerrainReferenceGeo());
          syncCameraGyroPreviewMount();
          return;
        }
        if(!document.body.classList.contains("camera-view-active")) return;
        if(isMKey){
          const open = el.cameraControlMenuLayer && el.cameraControlMenuLayer.classList.contains("hidden");
          setCameraControlMenuOpen(open);
          return;
        }
        startCameraStageSeparationCountdown();
      }, true);
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
            const title = item.dataset.pageTitle || item.textContent.trim();
            const opensCameraDashboard = (
              String(title || "").toLowerCase() === "dashboard" &&
              !!item.closest(".side-nav-desktop") &&
              document.body.classList.contains("camera-view-active") &&
              document.body.classList.contains("camera-dashboard-default")
            );
            if(opensCameraDashboard){
              setDashboardDrawerOpen(true);
              return;
            }
            if(replayUiActive && String(title || "").toLowerCase() === "dashboard"){
              exitReplayMode();
            }
            sideNavItems.forEach(btn=>btn.classList.remove("active"));
            item.classList.add("active");
            setActiveView(title);
          });
        });
        window.addEventListener("resize", ()=>{
          applyPhoneLandscapeLayout();
          syncDesktopGyroPreviewMount();
          syncCameraMapPreviewMount();
          syncMobileMapPreviewMount();
          resizeMobileMockup3d();
          resizeGyroGl();
          if(gyroGl) renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          refreshStatusMapSize();
          renderChipTempModal();
        });
        const activeScope = isMobileLayout() ? ".side-nav-mobile" : ".side-nav-desktop";
        const active = Array.from(sideNavItems).find(item=>item.classList.contains("active") && item.closest(activeScope))
          || Array.from(sideNavItems).find(item=>item.classList.contains("active"));
        setActiveView(active ? (active.dataset.pageTitle || active.textContent.trim()) : "Dashboard");
      }
      if(el.settingsClose) el.settingsClose.addEventListener("click",()=>{
        if(isMobileSettingsNavigation() && el.settingsOverlay && el.settingsOverlay.classList.contains("mobile-settings-detail")){
          setMobileSettingsLanding();
          return;
        }
        hideSettings();
      });
      if(el.settingsOverlay){
        el.settingsOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.settingsOverlay) hideSettings(); });
      }
      async function handleGyroZero(){
        if(simEnabled){
          if(!applyGyroZeroReference()){
            showToast(t("gyroZeroUnavailableToast"), "warn");
            return;
          }
          showToast(t("gyroZeroDoneToast"), "success");
          renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderNavBall(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderGyroPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderNavBallPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          return;
        }

        const path = "/gyro_zero?roll=0&pitch=0&yaw=0";
        try{
          const result = await sendGyroZeroCommand(path);
          if(!result.ok){
            const reason = String(result.reason || "");
            if(reason.indexOf("GYRO_NOT_READY") >= 0){
              showToast(t("gyroZeroUnavailableToast"), "warn");
            }else{
              showToast("자이로 영점 저장 실패: " + (reason || "UNKNOWN"), "error");
            }
            return;
          }
          // Board now publishes zeroed attitude; keep UI local zero neutral.
          clearLocalGyroZeroReference();
          showToast(t("gyroZeroDoneToast"), "success");
          renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderNavBall(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderGyroPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderNavBallPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        }catch(err){
          const msg = (err && err.message) ? err.message : "UNKNOWN";
          showToast("자이로 영점 저장 실패: " + msg, "error");
        }
      }
      if(el.gyroZeroBtn){
        el.gyroZeroBtn.addEventListener("click", handleGyroZero);
      }
      if(el.replayGyroZeroBtn){
        el.replayGyroZeroBtn.addEventListener("click", handleGyroZero);
      }
      if(el.cameraControlMenuClose){
        el.cameraControlMenuClose.addEventListener("click",()=>setCameraControlMenuOpen(false));
      }
      if(el.cameraControlMenuLayer){
        el.cameraControlMenuLayer.addEventListener("click",(ev)=>{
          if(ev.target === el.cameraControlMenuLayer) setCameraControlMenuOpen(false);
        });
      }
      if(el.cameraMenuStageTestBtn){
        el.cameraMenuStageTestBtn.addEventListener("click",()=>{
          setCameraControlMenuOpen(false);
          startCameraStageSeparationCountdown();
        });
      }
      if(el.cameraMenuGyroZeroBtn){
        el.cameraMenuGyroZeroBtn.addEventListener("click",()=>{
          setCameraControlMenuOpen(false);
          handleGyroZero();
        });
      }
      if(el.cameraMenuDashboardBtn){
        el.cameraMenuDashboardBtn.addEventListener("click",()=>{
          setCameraControlMenuOpen(false);
          setDashboardDrawerOpen(true);
        });
      }
      if(el.dashboardDrawerClose){
        el.dashboardDrawerClose.addEventListener("click",()=>setDashboardDrawerOpen(false));
      }
      if(el.cameraMenuAbortBtn){
        el.cameraMenuAbortBtn.addEventListener("click",()=>{
          if(!el.abortBtn || el.abortBtn.disabled) return;
          setCameraControlMenuOpen(false);
          el.abortBtn.click();
        });
      }
      if(el.cameraMenuExitBtn){
        el.cameraMenuExitBtn.addEventListener("click",()=>{
          setCameraControlMenuOpen(false);
          activateNavItem("Dashboard");
        });
      }
      if(el.cameraMenuDeviceSelect){
        el.cameraMenuDeviceSelect.addEventListener("change",()=>{
          selectWebcamDevice(el.cameraMenuDeviceSelect.value);
        });
      }
      if(el.cameraOpenSettingsBtn){
        el.cameraOpenSettingsBtn.addEventListener("click",()=>{
          showSettings();
          const interfaceTitle = t("settingsNavInterface");
          if(isMobileSettingsNavigation()) openMobileSettingsSection("units", interfaceTitle);
          else setActiveSettingsPanel("units", interfaceTitle);
          setTimeout(()=>{
            if(el.cameraEnabledToggle) el.cameraEnabledToggle.focus({preventScroll:true});
          }, 80);
        });
      }
      if(navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function"){
        navigator.mediaDevices.addEventListener("devicechange",()=>{
          if(isCameraUseEnabled() && document.body.classList.contains("camera-view-active")) refreshWebcamDeviceOptions();
        });
      }
      if(el.missionOpenBtn) el.missionOpenBtn.addEventListener("click",()=>showMission());
      if(el.dashboardServoPanelBtn){
        el.dashboardServoPanelBtn.addEventListener("click",()=>{
          showServoControl();
        });
      }
      if(el.dashboardPyroPanelBtn){
        el.dashboardPyroPanelBtn.addEventListener("click",()=>{
          showPyroControl();
        });
      }
      {
        const mobileServoControlBtn = document.getElementById("mobileServoControlBtn");
        const mobilePyroControlBtn = document.getElementById("mobilePyroControlBtn");
        const mobileReportBtn = document.getElementById("mobileReportBtn");
        const mobileSafetyModeBtn = document.getElementById("mobileSafetyModeBtn");
        const mobileArmUnlockBtn = document.getElementById("mobileArmUnlockBtn");
        if(mobileServoControlBtn){
          mobileServoControlBtn.addEventListener("click", ()=>{
            showServoControl();
          });
        }
        if(mobilePyroControlBtn){
          mobilePyroControlBtn.addEventListener("click", ()=>{
            showPyroControl();
          });
        }
        if(mobileReportBtn){
          mobileReportBtn.addEventListener("click", ()=>{
            showDataListOverlay();
          });
        }
        if(mobileSafetyModeBtn){
          mobileSafetyModeBtn.addEventListener("click", ()=>{
            toggleInput(el.safeModeToggle);
          });
        }
        if(mobileArmUnlockBtn){
          mobileArmUnlockBtn.addEventListener("click", ()=>{
            if(!el.armLockToggle) return;
            el.armLockToggle.checked = !el.armLockToggle.checked;
            el.armLockToggle.dispatchEvent(new Event("change", {bubbles:true}));
          });
        }
      }
      if(el.servoControlTile){
        el.servoControlTile.addEventListener("click",(ev)=>{
          if(ev.target && ev.target.closest("button")) return;
          showServoControl();
        });
        el.servoControlTile.addEventListener("keydown",(ev)=>{
          if(ev.key !== "Enter" && ev.key !== " ") return;
          if(ev.target && ev.target.closest("button")) return;
          ev.preventDefault();
          showServoControl();
        });
      }
      if(el.pyroControlTile){
        el.pyroControlTile.addEventListener("click",(ev)=>{
          if(ev.target && ev.target.closest("button")) return;
          showPyroControl();
        });
        el.pyroControlTile.addEventListener("keydown",(ev)=>{
          if(ev.key !== "Enter" && ev.key !== " ") return;
          if(ev.target && ev.target.closest("button")) return;
          ev.preventDefault();
          showPyroControl();
        });
      }
      if(el.hardwareServoClose){
        el.hardwareServoClose.addEventListener("click",()=>{
          hideServoControl();
        });
      }
      if(el.hardwareServoOverlay){
        el.hardwareServoOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.hardwareServoOverlay){
            hideServoControl();
          }
        });
      }
      if(el.pyroControlClose){
        el.pyroControlClose.addEventListener("click",()=>{
          hidePyroControl();
        });
      }
      if(el.pyroControlOverlay){
        el.pyroControlOverlay.addEventListener("click",(ev)=>{
          if(ev.target === el.pyroControlOverlay){
            hidePyroControl();
          }
        });
      }
      if(el.mobileServoBackBtn){
        el.mobileServoBackBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          hideServoControl();
        });
      }
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
          openInspectionFromUI();
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
          sendCommand({http:"/buzzer?pattern=find", ser:"FIND_BUZZER"}, false);
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
        mission_standby: ()=>{ startMissionStandbyFromUi(); },
        virtual_mission: ()=>{ toggleVirtualMission(); },
        serial: ()=>{ handleConnectAction(); },
        inspection: ()=>{ openInspectionFromUI(); },
        safety: ()=>{ toggleInput(el.safeModeToggle); },
        launcher: ()=>{ ensureDashboardViewForPanels(); showLauncher(); },
        export: ()=>{ showDataListOverlay(); },
        servo: ()=>{ showServoControl(); },
        gyro_zero: ()=>{ handleGyroZero(); },
      };
      if(el.mobileControlButtons && el.mobileControlButtons.length){
        el.mobileControlButtons.forEach(btn=>{
          btn.addEventListener("click",(ev)=>{
            ev.preventDefault();
            const type = btn.getAttribute("data-mobile-control");
            const action = mobileControlActions[type];
            if(!action) return;
            if(type === "export"){
              hideMobileControlsPanel();
            }
            action();
          });
        });
      }
      if(el.mobileSequenceWideBtn){
        el.mobileSequenceWideBtn.addEventListener("click", async (ev)=>{
          ev.preventDefault();
          if(el.mobileSequenceWideBtn.disabled) return;
          await startSequenceFromMobileCard();
        });
      }
      if(el.mobileSequenceStartBtn){
        el.mobileSequenceStartBtn.addEventListener("click", async (ev)=>{
          ev.preventDefault();
          if(el.mobileSequenceStartBtn.disabled) return;
          await startSequenceFromMobileCard();
        });
      }
      if(el.mobileSequenceStatusPill){
        el.mobileSequenceStatusPill.addEventListener("click", (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          showSequenceInfoOverlay();
        });
      }
      if(el.mobileSequenceNavAbortBtn){
        el.mobileSequenceNavAbortBtn.addEventListener("click", (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          stopSequenceFromMobileCard();
        });
      }
      if(el.mobileSequencePauseBtn){
        el.mobileSequencePauseBtn.addEventListener("click", (ev)=>{
          ev.preventDefault();
          if(el.mobileSequencePauseBtn.disabled) return;
          pauseSequenceFromMobileCard();
        });
      }
      if(el.mobileSequenceStopBtn){
        el.mobileSequenceStopBtn.addEventListener("click", (ev)=>{
          ev.preventDefault();
          if(el.mobileSequenceStopBtn.disabled) return;
          stopSequenceFromMobileCard();
        });
      }
      if(el.mobileMissionWideBtn){
        el.mobileMissionWideBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          if(el.mobileMissionWideBtn.disabled) return;
          if(isMobileLayout() && el.mobileControlsPanel){
            ensureDashboardViewForPanels();
            setLauncherPanelVisible(false);
            setInspectionPanelVisible(false);
            setMissionPanelVisible(false);
            setMobileLauncherPanelVisible(false);
            setMobileInspectionPanelVisible(false);
            setMobileMissionPanelVisible(true);
            return;
          }
          showMission();
        });
      }
      if(el.mobileArmLockWideBtn){
        el.mobileArmLockWideBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          if(el.mobileArmLockWideBtn.disabled || !el.armLockToggle) return;
          el.armLockToggle.checked = !el.armLockToggle.checked;
          el.armLockToggle.dispatchEvent(new Event("change", {bubbles:true}));
        });
      }
      updateAbortButtonLabel(false);
      updateMobileControlPills();
      updateMobileAbortButton();
      updateMobileArmLockWideButton();
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
          showToast("모터 프리셋 추가 문의: ybb1833@naver.com", "info", {key:"mission-motor-support"});
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
      const setHardwareServoInlineActive = (channel)=>{
        const ch = Math.max(1, Math.min(SERVO_CHANNELS.length, Math.round(Number(channel) || 1)));
        const servoRoot = el.hardwareServoOverlay || document;
        servoRoot.querySelectorAll(".hardware-servo-inline-wrap .hardware-servo-row[data-servo-channel]").forEach((row)=>{
          const rowCh = Number(row.getAttribute("data-servo-channel"));
          row.classList.toggle("is-active", rowCh === ch);
          row.style.display = (rowCh === ch) ? "grid" : "none";
        });
        const btns = [el.hardwareServoQuickCh1Btn, el.hardwareServoQuickCh2Btn, el.hardwareServoQuickCh3Btn, el.hardwareServoQuickCh4Btn, el.hardwareServoQuickCh5Btn];
        btns.forEach((btn, idx)=>{
          if(!btn) return;
          btn.classList.toggle("is-active", (idx + 1) === ch);
        });
        const mobileChannelSelect = document.getElementById("hardwareServoMobileChannelSelect");
        if(mobileChannelSelect && mobileChannelSelect.value !== String(ch)){
          mobileChannelSelect.value = String(ch);
        }
      };
      if(el.hardwareServoQuickCh1Btn) el.hardwareServoQuickCh1Btn.addEventListener("click", ()=>setHardwareServoInlineActive(1));
      if(el.hardwareServoQuickCh2Btn) el.hardwareServoQuickCh2Btn.addEventListener("click", ()=>setHardwareServoInlineActive(2));
      if(el.hardwareServoQuickCh3Btn) el.hardwareServoQuickCh3Btn.addEventListener("click", ()=>setHardwareServoInlineActive(3));
      if(el.hardwareServoQuickCh4Btn) el.hardwareServoQuickCh4Btn.addEventListener("click", ()=>setHardwareServoInlineActive(4));
      if(el.hardwareServoQuickCh5Btn) el.hardwareServoQuickCh5Btn.addEventListener("click", ()=>setHardwareServoInlineActive(5));
      {
        const mobileChannelSelect = document.getElementById("hardwareServoMobileChannelSelect");
        if(mobileChannelSelect){
          mobileChannelSelect.addEventListener("change", ()=>{
            setHardwareServoInlineActive(mobileChannelSelect.value);
          });
        }
      }

      const servoRoot = el.hardwareServoOverlay || document;
      const servoRows = servoRoot.querySelectorAll(".hardware-servo-inline-wrap .hardware-servo-row[data-servo-channel]");
      if(servoRows && servoRows.length){
        servoRows.forEach(row=>{
          const ch = Number(row.getAttribute("data-servo-channel"));
          if(!isFinite(ch) || SERVO_CHANNELS.indexOf(ch) < 0) return;
          const range = row.querySelector("[data-servo-range]");
          const value = row.querySelector("[data-servo-value]");
          const currentAngle = row.querySelector("[data-servo-current-angle]");
          const pin = row.querySelector("[data-servo-pin]");
          const applyBtn = row.querySelector("[data-servo-apply]");
          const centerBtn = row.querySelector("[data-servo-center]");
          servoUiMap[ch] = {
            range,
            value,
            currentAngle,
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
        servoRoot.querySelectorAll("[data-servo-mobile-nudge]").forEach(btn=>{
          btn.addEventListener("click", ()=>{
            const direction = btn.getAttribute("data-servo-mobile-nudge") === "up" ? 1 : -1;
            const activeRow = servoRoot.querySelector(".hardware-servo-inline-wrap .hardware-servo-row.is-active[data-servo-channel]");
            const ch = activeRow ? Number(activeRow.getAttribute("data-servo-channel")) : 1;
            const ui = servoUiMap[ch];
            if(!ui || !ui.range) return;
            const current = clampServoAngle(ui.range.value);
            const nextDeg = clampServoAngle(current + direction * 5);
            setServoUiAngle(ch, nextDeg);
            applyServoAngle(ch, { showFeedback:true, logIt:true, force:true });
          });
        });
        setHardwareServoInlineActive(1);
      }
      const bindThreeSecondPyroHold = (button, onComplete)=>{
        if(!button) return ()=>{};
        const durationMs = 3000;
        let timer = null;
        let startedAt = 0;
        let activePointerId = null;
        let completed = false;
        const setProgress = (ratio)=>{
          button.style.setProperty("--pyro-hold-progress", String(Math.max(0, Math.min(1, ratio))));
        };
        const cancel = ()=>{
          if(timer){ clearInterval(timer); timer = null; }
          activePointerId = null;
          button.classList.remove("is-holding");
          if(!completed) setProgress(0);
        };
        const tick = ()=>{
          const ratio = (Date.now() - startedAt) / durationMs;
          setProgress(ratio);
          if(ratio < 1) return;
          completed = true;
          cancel();
          setProgress(1);
          onComplete();
        };
        const start = (ev)=>{
          if(timer || completed || button.disabled) return;
          ev.preventDefault();
          if(typeof ev.pointerId === "number"){
            activePointerId = ev.pointerId;
            try{ button.setPointerCapture(ev.pointerId); }catch(_e){}
          }
          startedAt = Date.now();
          button.classList.add("is-holding");
          setProgress(0);
          timer = setInterval(tick, 32);
        };
        const stop = (ev)=>{
          if(activePointerId !== null && typeof ev.pointerId === "number" && ev.pointerId !== activePointerId) return;
          if(!completed) cancel();
        };
        const onKeyDown = (ev)=>{
          if((ev.key === "Enter" || ev.key === " ") && !ev.repeat) start(ev);
        };
        const onKeyUp = (ev)=>{
          if(ev.key === "Enter" || ev.key === " ") stop(ev);
        };
        button.addEventListener("pointerdown", start);
        button.addEventListener("pointerup", stop);
        button.addEventListener("pointercancel", stop);
        button.addEventListener("lostpointercapture", stop);
        button.addEventListener("keydown", onKeyDown);
        button.addEventListener("keyup", onKeyUp);
        return ()=>{
          cancel();
          button.removeEventListener("pointerdown", start);
          button.removeEventListener("pointerup", stop);
          button.removeEventListener("pointercancel", stop);
          button.removeEventListener("lostpointercapture", stop);
          button.removeEventListener("keydown", onKeyDown);
          button.removeEventListener("keyup", onKeyUp);
          setProgress(0);
        };
      };
      const askHardwarePyroConfirm = (ch, durMs)=>{
        const pyroInlineOpen = !!(
          el.pyroControlOverlay &&
          !el.pyroControlOverlay.classList.contains("hidden") &&
          el.pyroControlDialog &&
          el.pyroControlClose &&
          el.pyroControlConfirmTitle &&
          el.pyroControlConfirmDesc &&
          el.pyroControlConfirmOk &&
          el.pyroControlConfirmCancel
        );
        if(pyroInlineOpen){
          el.pyroControlConfirmTitle.textContent = "CH" + ch + " 동작 확인";
          el.pyroControlConfirmDesc.textContent = "파이로 제어는 고위험 동작 입니다!\nCH" + ch + " / 지속시간 " + durMs + " ms로 실행할까요?";
          el.pyroControlDialog.classList.add("is-confirming");
          return new Promise((resolve)=>{
            let settled = false;
            let disposeHold = ()=>{};
            const finish = (ok)=>{
              if(settled) return;
              settled = true;
              disposeHold();
              el.pyroControlConfirmCancel.removeEventListener("click", onCancel);
              el.pyroControlClose.removeEventListener("click", onCancel);
              el.pyroControlOverlay.removeEventListener("click", onOverlay);
              if(el.pyroControlDialog) el.pyroControlDialog.classList.remove("is-confirming");
              resolve(!!ok);
            };
            const onOk = ()=>finish(true);
            const onCancel = ()=>finish(false);
            const onOverlay = (ev)=>{ if(ev.target === el.pyroControlOverlay) finish(false); };
            disposeHold = bindThreeSecondPyroHold(el.pyroControlConfirmOk, onOk);
            el.pyroControlConfirmCancel.addEventListener("click", onCancel);
            el.pyroControlClose.addEventListener("click", onCancel);
            el.pyroControlOverlay.addEventListener("click", onOverlay);
          });
        }
        let overlay = pyroConfirmOverlayEl || document.getElementById("pyroConfirmOverlay");
        if(!overlay){
          const host = document.createElement("div");
          host.innerHTML =
            "<div id=\"pyroConfirmOverlay\" class=\"reboot-overlay hidden\" style=\"display:none;\">" +
              "<div class=\"confirm-dialog reboot-dialog wifi-connect-dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"pyroConfirmTitle\" aria-describedby=\"pyroConfirmDesc\">" +
                "<div id=\"pyroConfirmTitle\" class=\"disconnect-title\">파이로 동작 확인</div>" +
                "<div id=\"pyroConfirmDesc\" class=\"disconnect-text\">CH1 동작을 실행할까요?</div>" +
                "<div class=\"ignition-warning-illustration pyro-control-confirm-illustration\" aria-hidden=\"true\"><img src=\"img/pyro-lipo-safety.png\" alt=\"\"></div>" +
                "<div id=\"pyroConfirmHint\" class=\"confirm-note\">지속시간: 500 ms\n긴 인가는 에비오닉스에 손상을 줄 수 있습니다.</div>" +
                "<div class=\"reboot-actions wifi-connect-actions\">" +
                  "<button id=\"pyroConfirmOkBtn\" class=\"disconnect-ok reboot-confirm pyro-hold-button\" type=\"button\"><span>3초간 길게 누르기</span></button>" +
                  "<button id=\"pyroConfirmCancelBtn\" class=\"confirm-cancel\" type=\"button\">취소</button>" +
                "</div>" +
              "</div>" +
            "</div>";
          overlay = host.firstElementChild;
          if(overlay) document.body.appendChild(overlay);
          pyroConfirmOverlayEl = overlay || null;
        }
        const titleEl = pyroConfirmTitleEl || document.getElementById("pyroConfirmTitle");
        const descEl = pyroConfirmDescEl || document.getElementById("pyroConfirmDesc");
        const hintEl = pyroConfirmHintEl || document.getElementById("pyroConfirmHint");
        const okBtn = pyroConfirmOkBtnEl || document.getElementById("pyroConfirmOkBtn");
        const cancelBtn = pyroConfirmCancelBtnEl || document.getElementById("pyroConfirmCancelBtn");
        if(!overlay || !titleEl || !descEl || !hintEl || !okBtn || !cancelBtn){
          showToast("확인 모달을 열 수 없습니다.", "error", {key:"pyro-confirm-open-fail"});
          return Promise.resolve(false);
        }
        titleEl.textContent = "파이로 동작 확인";
        descEl.textContent = "파이로 제어는 고위험 동작 입니다! CH" + ch + " 동작을 실행할까요? 주변에 위험 요소가 없는지 꼭 확인하세요.";
        hintEl.textContent = "지속시간: " + durMs + " ms - 긴 인가는 에비오닉스에 손상을 줄 수 있습니다.";
        setOverlayVisible(overlay, true);
        return new Promise((resolve)=>{
          let settled = false;
          let disposeHold = ()=>{};
          const finish = (ok)=>{
            if(settled) return;
            settled = true;
            disposeHold();
            cancelBtn.removeEventListener("click", onCancel);
            overlay.removeEventListener("click", onOverlay);
            setOverlayVisible(overlay, false);
            resolve(!!ok);
          };
          const onOk = ()=>finish(true);
          const onCancel = ()=>finish(false);
          const onOverlay = (ev)=>{ if(ev.target === overlay) finish(false); };
          disposeHold = bindThreeSecondPyroHold(okBtn, onOk);
          cancelBtn.addEventListener("click", onCancel);
          overlay.addEventListener("click", onOverlay);
        });
      };
      const runHardwarePyroTest = async (channel, durationOverrideMs)=>{
        const ch = normalizePyroChannel(channel, 1);
        let durMs = Math.round(toFiniteNumber(durationOverrideMs, NaN));
        if(!isFinite(durMs)){
          durMs = Math.round(toFiniteNumber(el.hardwarePyroDurationInput ? el.hardwarePyroDurationInput.value : NaN, NaN));
        }
        if(!isFinite(durMs)){
          durMs = Math.round(toFiniteNumber(el.pyroControlDurationInput ? el.pyroControlDurationInput.value : NaN, NaN));
        }
        if(!isFinite(durMs)){
          durMs = Math.round(Number((uiSettings && uiSettings.ignDurationMs) || 1000));
        }
        durMs = Math.max(10, Math.min(30000, durMs));
        if(el.hardwarePyroDurationInput) el.hardwarePyroDurationInput.value = String(durMs);
        if(el.pyroControlDurationInput) el.pyroControlDurationInput.value = String(durMs);
        const ok = await askHardwarePyroConfirm(ch, durMs);
        if(!ok) return;
        showToast("파이로 CH" + ch + " 테스트: " + durMs + "ms", "warn", {key:"hardware-pyro-fire-ch" + ch, duration:2400});
        await sendCommand({http:"/pyro_test?ch=" + ch + "&ms=" + durMs, ser:"/pyro_test?ch=" + ch + "&ms=" + durMs}, true);
        addLogLine("Hardware PYRO CH" + ch + " → ON " + durMs + "ms", "CMD");
      };
      const forceHardwarePyroRowLayout = ()=>{
        try{
          const ch1 = el.hardwarePyroFireCh1Btn || document.getElementById("hardwarePyroFireCh1Btn");
          if(!ch1) return;
          const wrap = ch1.parentElement;
          if(!wrap) return;
          wrap.classList.add("hardware-action-wrap", "hardware-action-wrap-pyro");
          wrap.style.display = "grid";
          wrap.style.gridTemplateColumns = "repeat(4,minmax(0,1fr))";
          wrap.style.gap = "8px";
          wrap.style.alignItems = "stretch";
          wrap.style.justifyContent = "stretch";
          const input = el.hardwarePyroDurationInput || document.getElementById("hardwarePyroDurationInput");
          if(input){
            input.style.gridColumn = "1 / -1";
            input.style.width = "100%";
          }
          [el.hardwarePyroFireCh1Btn, el.hardwarePyroFireCh2Btn].forEach(btn=>{
            if(!btn) return;
            btn.style.gridColumn = "auto";
            btn.style.width = "100%";
            btn.style.minWidth = "0";
          });
        }catch(_e){}
      };
      forceHardwarePyroRowLayout();
      window.addEventListener("resize", forceHardwarePyroRowLayout);
      if(el.hardwarePyroFireCh1Btn){
        el.hardwarePyroFireCh1Btn.addEventListener("click", async ()=>{ await runHardwarePyroTest(1); });
      }
      if(el.hardwarePyroFireCh2Btn){
        el.hardwarePyroFireCh2Btn.addEventListener("click", async ()=>{ await runHardwarePyroTest(2); });
      }
      document.querySelectorAll("[data-pyro-ms]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          if(!el.hardwarePyroDurationInput) return;
          const ms = Math.round(Number(btn.getAttribute("data-pyro-ms") || 0));
          if(!isFinite(ms) || ms <= 0) return;
          el.hardwarePyroDurationInput.value = String(ms);
          if(el.pyroControlDurationInput) el.pyroControlDurationInput.value = String(ms);
        });
      });
      document.querySelectorAll("[data-pyro-modal-ms]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const ms = Math.round(Number(btn.getAttribute("data-pyro-modal-ms") || 0));
          if(!isFinite(ms) || ms <= 0) return;
          if(el.pyroControlDurationInput) el.pyroControlDurationInput.value = String(ms);
          if(el.hardwarePyroDurationInput) el.hardwarePyroDurationInput.value = String(ms);
        });
      });
      if(el.pyroControlDurationInput){
        el.pyroControlDurationInput.addEventListener("blur", ()=>{
          let durMs = Math.round(toFiniteNumber(el.pyroControlDurationInput.value, NaN));
          if(!isFinite(durMs)){
            durMs = Math.round(Number((uiSettings && uiSettings.ignDurationMs) || 1000));
          }
          durMs = Math.max(10, Math.min(30000, durMs));
          el.pyroControlDurationInput.value = String(durMs);
          if(el.hardwarePyroDurationInput) el.hardwarePyroDurationInput.value = String(durMs);
        });
        el.pyroControlDurationInput.addEventListener("keydown", (ev)=>{
          if(ev.key === "Enter"){
            ev.preventDefault();
            el.pyroControlDurationInput.blur();
          }
        });
      }
      document.querySelectorAll("[data-pyro-modal-channel]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          syncPyroControlChannelUi(btn.getAttribute("data-pyro-modal-channel") || 1);
        });
      });
      if(el.pyroControlRunBtn){
        el.pyroControlRunBtn.addEventListener("click", async ()=>{
          const ch = pyroControlSelectedChannel;
          let durMs = Math.round(toFiniteNumber(el.pyroControlDurationInput ? el.pyroControlDurationInput.value : NaN, NaN));
          if(!isFinite(durMs)){
            durMs = Math.round(Number((uiSettings && uiSettings.ignDurationMs) || 1000));
          }
          durMs = Math.max(10, Math.min(30000, durMs));
          if(el.pyroControlDurationInput) el.pyroControlDurationInput.value = String(durMs);
          if(el.hardwarePyroDurationInput){
            el.hardwarePyroDurationInput.value = String(durMs);
          }
          await runHardwarePyroTest(ch, durMs);
          syncPyroControlDurationFromHardware();
        });
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
      if(el.chipTempWrap){
        el.chipTempWrap.addEventListener("click", ()=>showChipTempModal());
        el.chipTempWrap.addEventListener("keydown",(ev)=>{
          if(ev.key === "Enter" || ev.key === " "){
            ev.preventDefault();
            showChipTempModal();
          }
        });
      }
      if(el.chipTempClose){
        el.chipTempClose.addEventListener("click", ()=>hideChipTempModal());
      }
      if(el.chipTempOverlay){
        el.chipTempOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.chipTempOverlay) hideChipTempModal(); });
      }
      if(el.perfWrap){
        el.perfWrap.addEventListener("click", ()=>showPerfModal());
        el.perfWrap.addEventListener("keydown",(ev)=>{
          if(ev.key === "Enter" || ev.key === " "){
            ev.preventDefault();
            showPerfModal();
          }
        });
      }
      if(el.perfClose){
        el.perfClose.addEventListener("click", ()=>hidePerfModal());
      }
      if(el.perfOverlay){
        el.perfOverlay.addEventListener("click",(ev)=>{ if(ev.target===el.perfOverlay) hidePerfModal(); });
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

      const applyMissionTimingSettings = async ()=>{
        if(!uiSettings) return;
        const s1Sep = clampInt(el.missionS1SeparationMs && el.missionS1SeparationMs.value, 500, 15000, 2000);
        const s1Eject = clampInt(el.missionS1EjectionMs && el.missionS1EjectionMs.value, 100, 10000, 1000);
        const s2Eject = clampInt(el.missionS2EjectionMs && el.missionS2EjectionMs.value, 500, 30000, 5000);
        const launchGrace = clampInt(el.missionLaunchGraceMs && el.missionLaunchGraceMs.value, 1000, 30000, 5000);
        const linkLoss = clampInt(el.missionLinkLossMs && el.missionLinkLossMs.value, 200, 5000, 500);
        uiSettings.missionStage1SeparationBackupMs = s1Sep;
        uiSettings.missionStage1EjectionDelayMs = s1Eject;
        uiSettings.missionStage2EjectionDelayMs = s2Eject;
        uiSettings.missionLaunchGraceMs = launchGrace;
        uiSettings.missionLinkLossMs = linkLoss;
        saveSettings();
        applySettingsToUI();
        const query = "mission_s1_sep_backup_ms=" + s1Sep +
          "&mission_s1_eject_delay_ms=" + s1Eject +
          "&mission_s2_eject_delay_ms=" + s2Eject +
          "&mission_launch_grace_ms=" + launchGrace +
          "&mission_link_loss_ms=" + linkLoss;
        const result = await sendCommand({http:"/set?" + query, ser:"/set?" + query}, false);
        showToast(result && result.ok ? "내장 미션 타이밍을 보드에 저장했습니다." : "미션 타이밍 저장 응답을 확인하지 못했습니다.", result && result.ok ? "success" : "error", {key:"mission-timing-save"});
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
      if(el.missionTimingSave){
        el.missionTimingSave.addEventListener("click", ()=>{ applyMissionTimingSettings(); });
      }
      if(el.missionStandbyReviewCancel){
        el.missionStandbyReviewCancel.addEventListener("click", ()=>setOverlayVisible(el.missionStandbyReviewOverlay, false));
      }
      if(el.missionStandbyReviewConfirm){
        el.missionStandbyReviewConfirm.addEventListener("click", ()=>{ confirmMissionStandbyFromUi(); });
      }
      if(el.missionStandbyReviewOverlay){
        el.missionStandbyReviewOverlay.addEventListener("click", ev=>{
          if(ev.target === el.missionStandbyReviewOverlay) setOverlayVisible(el.missionStandbyReviewOverlay, false);
        });
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
          if(!uiSettings || operationModeChangeBusy){
            applySettingsToUI();
            return;
          }
          const next = el.opModeSelect.value || "daq";
          el.opModeSelect.value = getSettingsOperationModeValue();
          void applyOperationModeChange(next);
        });
      }
      if(el.flashLinkEnabledPill){
        el.flashLinkEnabledPill.addEventListener("click", ()=>{
          const enabled = getSettingsOperationModeValue() === "flash_link";
          setFlashLinkEnabled(!enabled);
        });
      }
      if(el.flashLinkStage2ModePill){
        el.flashLinkStage2ModePill.addEventListener("click", ()=>{
          if(!uiSettings || getSettingsOperationModeValue() !== "flash_link") return;
          const enabled = uiSettings.flashLinkStage2Mode !== true;
          uiSettings.flashLinkStage2Mode = enabled;
          flashLinkUiStage2Mode = enabled;
          if(!enabled){
            flashLinkStage2Connected = false;
            cameraHudStageSwitchLatched = false;
            setAutomaticActiveStage(1, "STAGE 1 ONLY");
          }
          saveSettings();
          applySettingsToUI();
          updateStageTelemetryDashboard();
          syncFlashLinkTopologyUi();
          syncFlashLinkStage2ModeToBoard(false);
          showToast(
            enabled ? "2단 운용 ON · 50Hz" : "1단 전용 ON · 100Hz",
            enabled ? "info" : "success",
            {key:"flash-link-stage-mode", duration:3200}
          );
        });
      }
      if(el.flashLinkRoleSelect){
        el.flashLinkRoleSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          const before = normalizeFlashLinkRole(uiSettings.flashLinkRole);
          uiSettings.flashLinkRole = normalizeFlashLinkRole(el.flashLinkRoleSelect.value);
          saveSettings();
          applySettingsToUI();
          if(before !== uiSettings.flashLinkRole){
            syncFlashLinkRoleToBoard(false);
            const roleLabel = uiSettings.flashLinkRole === "ground"
              ? t("flashLinkRoleGround")
              : t("flashLinkRoleAvionics");
            showToast("ALTIS INTELLIGENT LINK1: " + roleLabel, "info");
          }
        });
      }
      if(el.flashLinkNodeSelect){
        el.flashLinkNodeSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          const before = normalizeFlashLinkNodeId(uiSettings.flashLinkNodeId);
          uiSettings.flashLinkNodeId = normalizeFlashLinkNodeId(el.flashLinkNodeSelect.value);
          saveSettings();
          applySettingsToUI();
          if(before !== uiSettings.flashLinkNodeId){
            syncFlashLinkNodeSelectionToBoard(false);
            showToast((currentLang === "ko" ? "에비오닉스 위치: " : "Avionics position: ") +
              (uiSettings.flashLinkNodeId === 2 ? t("flashLinkStage2") : t("flashLinkStage1")), "info");
          }
        });
      }
      if(el.flashLinkDataModeSelect){
        el.flashLinkDataModeSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          const before = normalizeDataModeValue(uiSettings.flashLinkDataMode, "flight");
          const next = normalizeDataModeValue(el.flashLinkDataModeSelect.value, before);
          uiSettings.flashLinkDataMode = next;
          saveSettings();
          applySettingsToUI();
          if(before !== next){
            syncFlashLinkDataModeToBoard(false);
            const modeLabel = next === "flight" ? t("flashLinkDataModeFlight") : t("flashLinkDataModeDaq");
            showToast("ALTIS INTELLIGENT LINK1 data: " + modeLabel, "info");
          }
        });
      }
      if(el.gyroPreviewSelect){
        el.gyroPreviewSelect.addEventListener("change",()=>{
          if(!uiSettings) return;
          uiSettings.gyroPreview = normalizeGyroPreviewMode(el.gyroPreviewSelect.value || "3d");
          saveSettings();
          applySettingsToUI();
          if(uiSettings.gyroPreview === "3d"){
            ensureGyroTerrainForGeo(getGyroTerrainReferenceGeo());
          }
          renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        });
      }
      if(el.mobileHudPreviewToggle){
        el.mobileHudPreviewToggle.addEventListener("change",()=>{
          if(!uiSettings) return;
          intelligentMobileSessionActive = false;
          setIntelligentMobileReturnVisible(false);
          uiSettings.mobileHudPreview = !!el.mobileHudPreviewToggle.checked;
          saveSettings();
          applySettingsToUI();
        });
      }
      if(el.intelligentMobileReturnBtn){
        el.intelligentMobileReturnBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          exitIntelligentMobile();
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
      if(brownoutWarningConfirmEl){
        brownoutWarningConfirmEl.addEventListener("click",()=>acknowledgeBrownoutWarning());
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
          chartView.allowSmallWindow=false;
          redrawCharts();
        });
      }
      if(zoomInBtn){
        zoomInBtn.addEventListener("click",()=>{
          const base = chartView.windowMs || CHART_WINDOW_MS_DEFAULT;
          chartView.windowMs = Math.max(CHART_WINDOW_MS_MIN, Math.round(base * 0.7));
          autoScrollChart=false;
          chartView.allowSmallWindow=false;
          redrawCharts();
        });
      }
      if(chartLeft){
        chartLeft.addEventListener("click",()=>{
          autoScrollChart=false;
          chartView.allowSmallWindow=false;
          const base = chartView.startMs || 0;
          const step = Math.round((chartView.windowMs || CHART_WINDOW_MS_DEFAULT) * 0.2);
          chartView.startMs = base - step;
          redrawCharts();
        });
      }
      if(chartRight){      chartRight.addEventListener("click",()=>{
          autoScrollChart=false;
          chartView.allowSmallWindow=false;
          const base = chartView.startMs || 0;
          const step = Math.round((chartView.windowMs || CHART_WINDOW_MS_DEFAULT) * 0.2);
          chartView.startMs = base + step;
          redrawCharts();
        });
      }
      if(chartLive){
        chartLive.addEventListener("click",()=>{ autoScrollChart=true; chartView.allowSmallWindow=false; redrawCharts(); });
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
        if(appScope) appScope.add(()=>ro.disconnect());
      }
      listenApp(window, "beforeunload", (ev)=>{
        stopWebcam();
        return handleBeforeUnload(ev);
      });
      listenApp(window, "keydown", blockUiRefreshShortcut, true);
      listenApp(window, "online", ()=>{
        if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("browser online");
        updateData();
      });
      listenApp(window, "focus", ()=>{
        if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("window focus");
      });
      listenApp(document, "visibilitychange", ()=>{
        if(document.hidden){
          flushAppDataSamples();
        }else{
          if(!wsConnected && !wsRetryTimer) scheduleWsReconnect("tab visible");
          updateData();
        }
      });
      listenApp(window, "pagehide", ()=>{
        flushAppDataSamples();
      });
      listenApp(window, "resize",()=>{
        applyPhoneLandscapeLayout();
        syncDesktopGyroPreviewMount();
        syncCameraMapPreviewMount();
        syncMobileMapPreviewMount();
        resizeMobileMockup3d();
        if(gyroGl){
          resizeGyroGl();
          renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        }
        refreshChartLayout();
        scheduleStatusMapRefresh();
        renderChipTempModal();
        syncWelcomeConnectScreen(connOk || serialConnected || wsConnected);
      });
      listenApp(window, "orientationchange",()=>{
        applyPhoneLandscapeLayout();
        syncDesktopGyroPreviewMount();
        syncCameraMapPreviewMount();
        syncMobileMapPreviewMount();
        resizeMobileMockup3d();
        scheduleStatusMapRefresh();
      });
      listenApp(window, "pageshow",()=>{
        applyTabletControlsLayout();
        applyPhoneLandscapeLayout();
        syncDesktopGyroPreviewMount();
        syncCameraMapPreviewMount();
        syncMobileMapPreviewMount();
        resizeMobileMockup3d();
        if(isMobileLayout()){
          hideControlsModal();
          if(el.controlsCard){
            el.controlsCard.classList.add(CONTROLS_MOBILE_CLASS);
          }
          if(el.controlsOverlay){
            el.controlsOverlay.classList.add("hidden");
          }
        }
        updateNavActionState();
        syncWelcomeConnectScreen(connOk || serialConnected || wsConnected);
      });
      syncChartHeightToControls(0);
      setTimeout(()=>syncChartHeightToControls(1), 180);
      if(document.fonts && document.fonts.ready){
        document.fonts.ready.then(()=>{ setTimeout(()=>syncChartHeightToControls(2), 120); });
      }

      bootBeacon("net_bootstrap_start");
      if(navigator.storage && typeof navigator.storage.persist === "function"){
        navigator.storage.persist().catch(()=>false);
      }
      openAppDataDb().catch((err)=>{
        reportSilentException("app-data-init", err);
      });
      initSerialPortEvents();
      startAutoWifiConnectLoop();
      openWebSocket();
      updateWsUI();
      intervalApp(ensureWsAlive, 500);
      intervalApp(ensureSerialAlive, 500);
      intervalApp(fetchWifiInfo, 2000);
      intervalApp(fetchServoInfo, 2000);
      intervalApp(()=>{ fetchSpiFlashStatus({background:true}).catch(()=>{}); }, 5000);
      fetchWifiInfo();
      fetchServoInfo();
      fetchSpiFlashStatus({background:true}).catch(()=>{});
      loadMissionProfileFromBoard();
      pollLoopStopped = false;
      if(appScope) appScope.add(stopPollLoop);
      updateData().finally(()=>{ pollLoop(); });
      updateSerialPill();
      syncWelcomeConnectScreen(connOk || serialConnected || wsConnected);
      updateMissionEditLockUI();
      bootBeacon("net_bootstrap_done");

      // KST 실시간 업데이트
      updateKstClock();
      intervalApp(updateKstClock, 1000);

      if (typeof window !== "undefined" && window.__flashBoot) {
        window.__flashBoot.jsReady = true;
        window.__flashBoot.phase = "app_ready";
      }
      bootBeacon("app_ready");
      }catch(err){
        const msg = (err && err.message) ? err.message : String(err || "dom_ready_error");
        bootBeacon("dom_ready_fail", msg);
        try{
          if (typeof window !== "undefined" && window.__flashBoot) {
            window.__flashBoot.lastError = msg;
            window.__flashBoot.phase = "dom_ready_fail";
          }
        }catch(_e){}
        try{
          if(typeof window !== "undefined" && typeof window.__flashForceOpenApp === "function"){
            window.__flashForceOpenApp("dom_ready_fail");
          }
          if(typeof window !== "undefined" &&
             window.__flashBoot &&
             typeof window.__flashBoot.showBootError === "function"){
            window.__flashBoot.showBootError("app init failed: " + msg);
          }
        }catch(_e){}
        console.error("[FLASH6][BOOT] DOM init failed:", err);
      }
    };
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", bootAfterDomReady, {once:true});
    }else{
      bootAfterDomReady();
    }
    function mapServoUiToHwChannel(channel){
      const ch = Math.max(1, Math.min(SERVO_CHANNELS.length, Math.round(Number(channel) || 1)));
      const mapped = Number(SERVO_UI_TO_HW_CHANNEL[ch]);
      if(isFinite(mapped) && SERVO_CHANNELS.indexOf(mapped) >= 0) return mapped;
      return ch;
    }
    function mapServoHwToUiChannel(channel){
      const hw = Math.max(1, Math.min(SERVO_CHANNELS.length, Math.round(Number(channel) || 1)));
      for(let ui = 1; ui <= SERVO_CHANNELS.length; ui++){
        if(Number(SERVO_UI_TO_HW_CHANNEL[ui]) === hw) return ui;
      }
      return hw;
    }
