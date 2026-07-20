
constexpr char kFirmwareProgram[] = "Altis_Intelligent3_firmware1";
constexpr char kFirmwareVersion[] = "0.8.15";
constexpr char kFirmwareBuildId[] = "v6 b21";
constexpr char kFirmwareBoard[] = "Altis_Intelligent3_b3";
constexpr char kFirmwareProtocol[] = "Flash6-Intelligent-b4";

constexpr uint32_t kSerialBaud = 921600;
// Keep only a few fresh telemetry frames in USB CDC. A large queue turns
// transient host backpressure into stale attitude data and also puts control
// replies behind many already queued JSON lines.
constexpr size_t kSerialTxBufferActiveBytes = 4096;
constexpr size_t kSerialTxBufferIdleBytes = 4096;
// Bulk reads are emitted as one Base64 ACK line. Native USB CDC drains writes
// incrementally, so a larger logical chunk removes host round trips without
// requiring an equally large TinyUSB queue.
constexpr uint16_t kSerialStorageChunkBytes = 8192;
constexpr uint32_t kImuSampleHz = 200;
constexpr uint32_t kSerialStreamHz = 100;
constexpr uint32_t kWifiStreamHz = 50;
constexpr uint32_t kStorageRecordHz = 200;
constexpr uint32_t kBaroSampleHz = 50;
constexpr uint32_t kGpsTargetHz = 10;
constexpr uint32_t kGpsTargetFixIntervalMs = 1000UL / kGpsTargetHz;
constexpr uint32_t kGpsHousekeepingPeriodMs = 20;
constexpr uint32_t kI2cBusHz = 400000;
constexpr uint16_t kI2cTimeoutMs = 5;
constexpr uint32_t kSamplePeriodUs = 1000000UL / kImuSampleHz;
constexpr uint32_t kSerialPeriodUs = 1000000UL / kSerialStreamHz;
constexpr uint32_t kBaroPeriodUs = 1000000UL / kBaroSampleHz;
constexpr uint16_t kSerialRxDrainMaxBytes = 256;
// Ground stations publish the automatically active vehicle as the legacy
// top-level sample and, in dual-stage mode, both vehicle snapshots at the tail
// of the v2 frame. Keep enough room for two alarm messages without dropping it.
constexpr size_t kStreamJsonMaxBytes = 2048;
// Telemetry never consumes this tail of the TX queue, so short ACK/ERR control
// replies can be enqueued immediately while the 100 Hz stream is active.
constexpr size_t kSerialControlReserveBytes = 512;
static_assert(
  kSerialTxBufferActiveBytes >=
    kStreamJsonMaxBytes + kSerialControlReserveBytes + 1U,
  "USB telemetry TX buffer cannot hold one maximum frame plus ACK reserve");
// At 200 Hz, a 50 ms batch normally contains ten 104-byte V5 records. Larger
// contiguous writes avoid repeatedly programming the same NOR page while the
// queue still keeps several seconds of headroom.
constexpr uint32_t kStorageFlushIntervalMs = 50;
constexpr uint16_t kStorageQueueDepth = 256;
constexpr uint16_t kStorageDrainBatchMax = 12;
constexpr TickType_t kStorageLockWaitTicks = pdMS_TO_TICKS(3000);
constexpr uint16_t kStorageRecordMarker = 0xA55A;
constexpr uint8_t kStorageRecordVersionV1 = 1;
constexpr uint8_t kStorageRecordVersionV2 = 2;
constexpr uint8_t kStorageRecordVersionV3 = 3;
constexpr uint8_t kStorageRecordVersionV4 = 4;
constexpr uint8_t kStorageRecordVersionV5 = 5;
constexpr uint8_t kStorageRecordTypeSampleV1 = 1;
constexpr uint8_t kStorageRecordTypeMissionAlarmV1 = 2;
constexpr const char* kMissionProfilePath = "/mission_profile.json";
constexpr size_t kMissionProfileMaxBytes = 24576;
constexpr uint32_t kDefaultIgnitionMs = 1000;
constexpr uint32_t kDefaultCountdownMs = 10000;
constexpr uint32_t kChipTempPeriodMs = 500;
constexpr uint8_t kSequenceStateIdle = 0;
constexpr uint8_t kSequenceStateCountdown = 1;
constexpr uint8_t kSequenceStateFiring = 2;
constexpr uint8_t kSequenceStateTplus = 3;

constexpr int kI2cSda = 8;
constexpr int kI2cScl = 7;
constexpr int kLed = 4;
constexpr int kBuzzer = 1;  
constexpr int kArmSwitch = 2;
constexpr int kBootButton = 0;
constexpr int8_t kGpsRx = 5;  // ESP32-S3 RX <- GPS TX
constexpr int8_t kGpsTx = 3;  // ESP32-S3 TX -> GPS RX
constexpr int kFlashCs = 10;
constexpr int kFlashMosi = 11;
constexpr int kFlashSclk = 12;
constexpr int kFlashMiso = 13;
constexpr uint8_t kPyroChannelCount = 2;
constexpr int kPyroPins[kPyroChannelCount] = {
  48,  // PYRO SIG1 / MOSFET_SIG1PIN
  21,  // PYRO SIG2 / MOSFET_SIG2PIN
};
constexpr uint8_t kServoChannelCount = 5;
constexpr int kServoPins[kServoChannelCount] = {
  14,  // PWM1
  15,  // PWM2
  16,  // PWM3
  17,  // PWM4
  18,  // PWM5
};
constexpr uint8_t kServoLedcChannels[kServoChannelCount] = {
  2, 3, 4, 5, 6
};
constexpr uint16_t kServoHz = 50;
constexpr uint8_t kServoLedcResolutionBits = 14;
constexpr uint16_t kServoMinPulseUs = 500;
constexpr uint16_t kServoMaxPulseUs = 2500;
constexpr int hx711DoutDaq = kGpsRx;  // DAQ 모드에서 GPS RX 핀을 HX711 DOUT으로 재사용
constexpr int hx711SckDaq = kGpsTx;   // DAQ 모드에서 GPS TX 핀을 HX711 SCK로 재사용
int hx711Dout = hx711DoutDaq;
int hx711Sck = hx711SckDaq;
constexpr uint32_t kLoadcellPollPeriodUs = 250;
constexpr uint32_t kLoadcellStaleMs = 500;
constexpr uint16_t kLoadcellAutoZeroSamples = 10;
constexpr float kLoadcellDefaultScale = 6510.0f;
constexpr float kLoadcellNoiseDeadbandKg = 0.030f;
constexpr float kLoadcellFilterAlpha = 0.22f;

// W25Q256 normal-read (0x03) supports this clock; boot probing falls back to
// the highest lower rate that returns a stable JEDEC identity.
constexpr uint32_t kNorSpiHz = 40000000UL;
constexpr uint32_t kNorExpectedCapacityBytes = 32UL * 1024UL * 1024UL;
constexpr uint32_t kNorSectorBytes = 4096;
constexpr uint32_t kNorPageBytes = 256;
constexpr uint8_t kNorMetadataSlotCount = 2;
constexpr uint32_t kNorDataStartAddress = kNorSectorBytes * kNorMetadataSlotCount;
constexpr uint32_t kNorMetadataMagic = 0x364D5748UL;  // HWM6
constexpr uint32_t kNorSectorMagic = 0x36535748UL;    // HWS6
constexpr uint32_t kNorFooterMagic = 0x36465748UL;    // HWF6
constexpr uint16_t kNorFormatVersion = 1;
constexpr uint16_t kNorSessionSectorVersion = 2;
constexpr uint16_t kNorCompactSectorVersion = 3;
constexpr uint32_t kNorFooterOffset = kNorSectorBytes - 16U;
constexpr uint16_t kStorageHttpListMaxItems = 32;

constexpr uint8_t kWifiChannel = 6;
constexpr uint8_t kWifiMaxClients = 2;
constexpr char kWifiPass[] = "12345678";
constexpr uint32_t kFlashLinkMagic = 0x314B4C46UL;  // FLK1
constexpr uint8_t kFlashLinkVersion = 4;
constexpr uint8_t kFlashLinkChannel = 6;
constexpr uint8_t kFlashLinkVehicleNodeCount = 2;
constexpr uint8_t kFlashLinkNodeIdGround = 0;
constexpr uint8_t kFlashLinkNodeIdStage1 = 1;
constexpr uint8_t kFlashLinkNodeIdStage2 = 2;
constexpr uint8_t kFlashLinkNodeIdMask = 0x03U;
constexpr uint8_t kFlashLinkTargetNodeShift = 2U;
constexpr uint8_t kFlashLinkTargetNodeMask = 0x0CU;
constexpr uint8_t kFlashLinkRelayedFlag = 0x80U;
static_assert((kFlashLinkNodeIdMask & kFlashLinkTargetNodeMask) == 0U,
              "ALTIS INTELLIGENT LINK1 source/target flags overlap");
static_assert((kFlashLinkRelayedFlag &
              (kFlashLinkNodeIdMask | kFlashLinkTargetNodeMask)) == 0U,
              "ALTIS INTELLIGENT LINK1 relay flag overlaps routing flags");
constexpr uint32_t kFlashLinkSingleStageTelemetryHz = 100;
constexpr uint32_t kFlashLinkDualStageTelemetryHz = 50;
constexpr uint32_t kFlashLinkServiceMinPeriodUs = 500;
constexpr uint32_t kFlashLinkStorageStatusPeriodMs = 1000;
constexpr uint32_t kFlashLinkDiscoveryPeriodMs = 250;
constexpr uint32_t kFlashLinkLinkedDiscoveryPeriodMs = 5000;
constexpr uint32_t kFlashLinkHeartbeatPeriodMs = 1000;
constexpr uint32_t kFlashLinkTelemetryStaleMs = 1500;
constexpr uint32_t kFlashLinkRecoveryPeerResetMs = 3000;
constexpr uint32_t kFlashLinkPeerTimeoutMs = 6000;
constexpr uint32_t kFlashLinkPrimaryRouteFreshMs = 650;
constexpr uint32_t kFlashLinkRouteRecoveryHoldMs = 1200;
constexpr uint32_t kFlashLinkRouteMinDwellMs = 800;
constexpr uint8_t kFlashLinkRelayCommandAttempts = 2;
constexpr uint32_t kFlashLinkTxBusyTimeoutMs = 250;
constexpr uint8_t kFlashLinkAckHz = 5;
constexpr uint8_t kFlashLinkCapabilityStage1Relay = 1U << 4;
constexpr uint8_t kFlashLinkCapabilityStage2Direct = 1U << 5;
constexpr uint8_t kFlashLinkCapabilityDualStageMode = 1U << 6;
constexpr uint8_t kFlashLinkRxQueueDepth = 12;
constexpr uint8_t kFlashLinkTelemetryQueueSoftLimit = 4;
constexpr uint8_t kFlashLinkRxDrainLimit = kFlashLinkRxQueueDepth;
constexpr uint8_t kFlashLinkRelayTxQueueDepth = 8;
constexpr uint8_t kFlashLinkCommandQueueDepth = 8;
constexpr uint32_t kFlashLinkCommandRetryMs = 60;
constexpr uint8_t kFlashLinkCommandMaxAttempts = 8;
constexpr uint32_t kFlashLinkLongCommandRetryMs = 500;
constexpr uint8_t kFlashLinkLongCommandMaxAttempts = 60;
constexpr uint16_t kFlashLinkMaxPacketBytes = ESP_NOW_MAX_DATA_LEN;
constexpr uint16_t kFlashLinkStorageChunkBytes = 192;
constexpr uint16_t kFlashLinkStorageHttpChunkBytes = 1024;
// One host request is assembled from multiple unchanged 192-byte radio frames.
// The larger aggregate cuts browser/USB request round trips while preserving
// the ESP-NOW wire packet and the HTTP fallback response size.
constexpr uint16_t kFlashLinkStorageSerialChunkBytes = 8192;
constexpr uint8_t kFlashLinkStorageWindowDepth = 8;
// Every bulk-read packet extends this quiet period. While it is active, A.I
// LINK services only storage traffic and relay forwarding; periodic telemetry,
// heartbeats, discovery, USB JSON, and WebSocket JSON remain silent.
constexpr uint32_t kFlashLinkStorageExclusiveHoldMs = 750;
static_assert(
  kFlashLinkStorageSerialChunkBytes <= kSerialStorageChunkBytes,
  "Shared serial storage buffer is smaller than the A.I LINK aggregate");
constexpr uint8_t kFlashLinkStorageListBatchItems = 8;
constexpr uint32_t kFlashLinkStorageRequestRetryMs = 45;
constexpr uint8_t kFlashLinkStorageRequestMaxAttempts = 12;
constexpr wifi_phy_rate_t kFlashLinkEspNowRate = WIFI_PHY_RATE_1M_L;
constexpr const char* kFlashLinkEspNowRateName = "1M_L";
constexpr uint8_t kFlashLinkPmk[ESP_NOW_KEY_LEN] = {
  0x46, 0x36, 0x2D, 0x49, 0x4E, 0x54, 0x45, 0x4C,
  0x4C, 0x49, 0x4E, 0x4B, 0x2D, 0x50, 0x4D, 0x4B
};
constexpr uint8_t kFlashLinkLmk[ESP_NOW_KEY_LEN] = {
  0x41, 0x4C, 0x54, 0x49, 0x53, 0x2D, 0x46, 0x4C,
  0x41, 0x53, 0x48, 0x4C, 0x49, 0x4E, 0x4B, 0x31
};
constexpr uint8_t kFlashLinkBroadcastMac[ESP_NOW_ETH_ALEN] = {
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF
};

constexpr float kRadToDeg = 57.2957795f;
constexpr float kDegToRad = 0.01745329252f;
constexpr float kG = 9.80665f;
constexpr float kDefaultSeaLevelHpa = 1013.25f;
constexpr bool kGyroAutoBiasEnabled = true;
constexpr float kGyroAutoBiasAlphaSlow = 0.0060f;
constexpr float kGyroAutoBiasAlphaFast = 0.0400f;
constexpr float kStationaryAccTolG = 0.05f;
constexpr float kStationaryGyroTolRawDps = 1.5f;
constexpr uint16_t kStationaryFramesFastBias = 18;
constexpr uint16_t kStationaryFramesHardLock = 40;
constexpr float kGyroOutputDeadbandDps = 0.35f;
constexpr float kAttitudeInitAccMinG = 0.25f;
constexpr float kAttitudeInitAccMaxG = 2.50f;
constexpr float kAttitudeAccelTrustErrG = 0.18f;
constexpr float kAttitudeRateTrustMaxDps = 120.0f;
constexpr float kMahonyKpMotion = 1.10f;
constexpr float kMahonyKpStill = 3.80f;
constexpr float kMahonyKiMotion = 0.035f;
constexpr float kMahonyKiStill = 0.180f;
constexpr float kMahonyIntegralLimitRadS = 0.08f;
constexpr uint16_t kGpsLineMax = 128;
constexpr uint32_t kGpsFixStaleMs = 5000;
constexpr uint32_t kGpsAutodetectPeriodMs = 1500;
constexpr uint32_t kDayMs = 24UL * 60UL * 60UL * 1000UL;
constexpr uint16_t kBuzzerDefaultHz = 2200;
constexpr uint16_t kBuzzerMinHz = 40;
constexpr uint16_t kBuzzerMaxHz = 10000;
constexpr uint16_t kBuzzerMaxPulseMs = 30000;
constexpr uint8_t kBuzzerLedcChannel = 0;
constexpr uint8_t kBuzzerLedcResolutionBits = 10;
constexpr uint32_t kBootButtonDebounceMs = 35;
constexpr uint32_t kBootButtonSequenceGapMs = 1000;
constexpr uint32_t kBootButtonMaxClickMs = 600;
constexpr uint8_t kBootButtonMaxActionClicks = 5;
constexpr uint32_t kBootButtonConfirmHoldMs = 1200;
constexpr uint16_t kBootButtonMenuBeepHz = 1760;
constexpr uint16_t kBootButtonMenuBeepMs = 62;
constexpr uint16_t kBootButtonMenuBeepGapMs = 58;
constexpr uint16_t kBootButtonMenuActionDelayMs = 90;
constexpr uint32_t kButtonSequenceWarningMs = 3000;
constexpr uint32_t kButtonSequenceCountdownMs = 60000;
constexpr uint32_t kButtonSequenceBeepIntervalMs = 1000;

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
Adafruit_LSM6DSOX imu;
Adafruit_BMP280 bmp(&Wire);
HardwareSerial gpsUart(2);
Preferences prefs;
Preferences baroPrefs;
Preferences buzzerPrefs;
Preferences settingsPrefs;
Preferences loadcellPrefs;
#if defined(CONFIG_IDF_TARGET_ESP32S3)
SPIClass storageSpi(FSPI);
#elif defined(HSPI)
SPIClass storageSpi(HSPI);
#else
SPIClass storageSpi;
#endif

char apSsid[40] = "ALTIS_FLASH6_GYRO";
bool serverReady = false;
bool imuReady = false;
bool baroReady = false;
bool prefsReady = false;
bool baroPrefsReady = false;
bool buzzerPrefsReady = false;
bool settingsPrefsReady = false;
bool loadcellPrefsReady = false;
uint8_t imuAddr = 0x00;
uint8_t baroAddr = 0x00;

volatile bool serialStream = false;
volatile bool safetyMode = false;
volatile bool armLock = true;
volatile bool inspectionPassed = true;
volatile bool flightMode = true;
volatile bool flashLinkMode = false;
volatile bool flashLinkDataFlightMode = true;
volatile bool flashLinkStage2Enabled = false;
volatile bool developerMode = false;
enum class FlashLinkRole : uint8_t {
  Avionics = 0,
  Ground = 1,
};
FlashLinkRole flashLinkRole = FlashLinkRole::Avionics;
uint8_t flashLinkNodeId = kFlashLinkNodeIdStage1;
uint8_t flashLinkTargetNodeId = kFlashLinkNodeIdStage1;
volatile bool buzzerMuted = false;
volatile uint8_t sequenceState = kSequenceStateIdle;
volatile bool sequenceUserWaiting = false;
volatile bool sequenceAborted = false;
volatile uint8_t sequenceAbortReason = 0;

uint32_t lastSampleUs = 0;
uint32_t lastBaroUs = 0;
uint32_t lastBaroValidMs = 0;
uint32_t lastChipTempMs = 0;
uint32_t lastWsUs = 0;
uint32_t lastSerialUs = 0;
uint32_t lastBlinkMs = 0;
uint32_t lastStationCacheMs = 0;
uint32_t bootButtonRawChangedMs = 0;
uint32_t bootButtonLastPressMs = 0;
uint32_t bootButtonPressedAtMs = 0;
uint32_t bootMs = 0;
bool ledState = false;
bool pendingRestart = false;
uint32_t restartAtMs = 0;
uint8_t cachedStations = 0;
uint32_t wsDroppedFrames = 0;
uint32_t serialDroppedFrames = 0;
uint32_t streamFrameSequence = 0;
uint32_t baroReadErrors = 0;
uint32_t imuReadErrors = 0;
uint32_t lastImuValidMs = 0;
uint8_t imuConsecutiveErrors = 0;
uint8_t wsLastStatus = 1;
uint32_t wifiApRestarts = 0;
uint32_t wifiApStartFails = 0;
uint32_t lastWifiApWatchdogMs = 0;
uint8_t wifiApConsecutiveFailures = 0;
bool wifiApReady = false;
uint8_t bootButtonPressCount = 0;
uint8_t bootButtonHoldAction = 0;
uint8_t bootButtonPendingHoldAction = 0;
uint32_t bootButtonPendingHoldActionAtMs = 0;
bool bootButtonRawPressed = false;
bool bootButtonStablePressed = false;
bool bootButtonConfirmHoldActive = false;
bool bootButtonConfirmHoldTriggered = false;
bool buttonSequenceWarningActive = false;
uint8_t buttonSequenceWarningBeeps = 0;
uint32_t buttonSequenceWarningStartMs = 0;
uint32_t ignitionDurationMs = kDefaultIgnitionMs;
uint32_t countdownDurationMs = kDefaultCountdownMs;
uint32_t sequenceCountdownTotalMs = 0;
uint8_t daqSequencePyroChannel = 1;
uint32_t sequenceCountdownEndMs = 0;
uint8_t sequenceCountdownBeepSecond = 0;
bool sequenceCountdownSecondBeepPending = false;
uint32_t sequenceCountdownSecondBeepAtMs = 0;
uint32_t sequenceFiringStartMs = 0;
uint32_t sequenceFiringEndMs = 0;
uint32_t sequenceAbortHoldUntilMs = 0;
uint32_t sequenceRelayHoldUntilMs = 0;
uint8_t sequenceRelayMask = 0;
bool flashFsReady = false;
String missionUploadSerial;
size_t missionUploadExpectedBytes = 0;
bool missionUploadActive = false;
esp_reset_reason_t bootResetReason = ESP_RST_UNKNOWN;
bool servoReady = false;
bool servoAttached[kServoChannelCount] = {
  false,
  false,
  false,
  false,
  false,
};
int16_t servoAngles[kServoChannelCount] = {
  -1,
  -1,
  -1,
  -1,
  -1,
};

struct GpsUartConfig {
  int8_t rx;
  int8_t tx;
  uint32_t baud;
};

struct GpsState {
  float latDeg = NAN;
  float lonDeg = NAN;
  float altM = NAN;
  uint32_t utcMsOfDay = 0;
  uint32_t utcEpochDay = 0;
  uint64_t utcEpochMs = 0;
  bool ready = false;
  bool fix = false;
  bool seen = false;
  bool timeValid = false;
  bool dateValid = false;
  uint32_t ageMs = UINT32_MAX;
  uint32_t lastFixMs = 0;
  uint32_t lastSentenceMs = 0;
  uint32_t lastTimeMs = 0;
  uint32_t sentenceCount = 0;
  uint32_t parseErrors = 0;
  uint32_t rawBytes = 0;
  uint32_t baud = 0;
  int8_t rxPin = -1;
  int8_t txPin = -1;
};

enum class FlightPhase : uint8_t {
  PreFlight = 0,
  PoweredFlight = 1,
  Coasting = 2,
  Descent = 3,
  Landed = 4,
};

enum class FlightTransitionReason : uint8_t {
  None = 0,
  LaunchAcceleration = 1,
  LaunchBarometer = 2,
  BurnoutAcceleration = 3,
  ApogeeBarometer = 4,
  LandingStable = 5,
};

struct FlightPhaseRuntime {
  FlightPhase phase = FlightPhase::PreFlight;
  bool ignitionSeen = false;
  bool coastAccelLow = false;
  bool descentEvidenceLatched = false;
  bool ascentConfirmed = false;
  uint32_t phaseEnteredMs = 0;
  uint32_t transitionAtMs = 0;
  uint32_t lastTickUs = 0;
  uint32_t launchAccelSinceMs = 0;
  uint32_t launchSpeedSinceMs = 0;
  uint32_t coastSinceMs = 0;
  uint32_t descentSinceMs = 0;
  uint32_t landingSinceMs = 0;
  uint32_t lastBaroSampleMs = 0;
  uint32_t lastApogeeUpdateMs = 0;
  float lastAltitudeM = NAN;
  float rawAccelMagnitudeG = NAN;
  float coastAccelFilteredG = NAN;
  float rawVerticalSpeedMps = 0.0f;
  float fastVerticalSpeedMps = 0.0f;
  float displayVerticalSpeedMps = 0.0f;
  float phaseStartAltitudeM = 0.0f;
  float apogeeM = 0.0f;
  static constexpr uint8_t kVelocityHistoryCapacity = 24;
  float velocityAltitudeM[kVelocityHistoryCapacity] = {};
  uint32_t velocityTimestampMs[kVelocityHistoryCapacity] = {};
  uint8_t velocityHistoryHead = 0;
  uint8_t velocityHistoryCount = 0;
  static constexpr uint16_t kLandingHistoryCapacity = 256;
  float landingAltitudeM[kLandingHistoryCapacity] = {};
  uint32_t landingTimestampMs[kLandingHistoryCapacity] = {};
  uint16_t landingHistoryHead = 0;
  uint16_t landingHistoryCount = 0;
};

struct Telemetry {
  float p = 0.0f;
  float ax = 0.0f;
  float ay = 0.0f;
  float az = 0.0f;
  float gx = 0.0f;
  float gy = 0.0f;
  float gz = 0.0f;
  float roll = 0.0f;
  float pitch = 0.0f;
  float yaw = 0.0f;
  float attitudeQw = 1.0f;
  float attitudeQx = 0.0f;
  float attitudeQy = 0.0f;
  float attitudeQz = 0.0f;
  float altM = 0.0f;
  float baroTempC = 0.0f;
  float baroAltMslM = 0.0f;
  float thrustKgf = 0.0f;
  float loadcellNoiseKg = kLoadcellNoiseDeadbandKg;
  float loadcellScale = kLoadcellDefaultScale;
  int32_t loadcellRaw = 0;
  uint16_t loadcellHz = 0;
  bool loadcellReady = false;
  bool loadcellValid = false;
  bool loadcellSaturated = false;
  bool loadcellOffsetValid = false;
  float gpsLat = NAN;
  float gpsLon = NAN;
  float gpsAlt = NAN;
  uint32_t gpsUtcMs = UINT32_MAX;
  uint64_t gpsEpochMs = 0;
  bool gpsReady = false;
  bool gpsFix = false;
  bool gpsSeen = false;
  bool gpsTimeValid = false;
  bool gpsDateValid = false;
  uint32_t gpsAgeMs = UINT32_MAX;
  uint32_t gpsRawBytes = 0;
  uint32_t gpsSentenceCount = 0;
  uint32_t gpsParseErrors = 0;
  uint32_t gpsBaud = 0;
  int8_t gpsRxPin = -1;
  int8_t gpsTxPin = -1;
  bool attitudeValid = false;
  bool sampleValid = false;
  bool baroValid = false;
  uint32_t ut = 0;
  float lt = 0.0f;
  uint16_t ct = 0;
  float chipTempC = NAN;
  float imuTempC = NAN;
  float flightRawAccelMagnitudeG = NAN;
  float flightCoastAccelFilteredG = NAN;
  float flightFastVerticalSpeedMps = 0.0f;
  uint8_t flightPhase = static_cast<uint8_t>(FlightPhase::PreFlight);
  float flightVerticalSpeedMps = 0.0f;
  float flightApogeeM = 0.0f;
  uint32_t flightPhaseElapsedMs = 0;
  uint16_t flightCoastHoldMs = 0;
  uint16_t flightDescentHoldMs = 0;
  uint8_t flightTransitionReason = static_cast<uint8_t>(FlightTransitionReason::None);
  uint32_t flightTransitionAtMs = 0;
  uint32_t ignitionDelayMs = UINT32_MAX;
  uint8_t deploymentState = 0;
  uint8_t deploymentFlags = 0;
};

struct BuzzerNote {
  uint16_t hz;
  uint16_t onMs;
  uint16_t gapMs;
};

struct BuzzerPlayer {
  const BuzzerNote* notes = nullptr;
  uint8_t count = 0;
  uint8_t index = 0;
  bool active = false;
  bool steady = false;
  bool noteOn = false;
  bool loop = false;
  uint32_t nextMs = 0;
};

Telemetry snap;
Telemetry flashLinkRemoteSnap;
FlightPhaseRuntime flightPhaseRuntime;

enum class FlashLinkPacketType : uint8_t {
  Discover = 1,
  Hello = 2,
  Telemetry = 3,
  Ack = 4,
  Heartbeat = 5,
  Command = 6,
  CommandAck = 7,
  StorageStatus = 8,
  StorageReadRequest = 9,
  StorageReadResponse = 10,
  MissionAlarm = 11,
  StorageListRequest = 12,
  StorageListResponse = 13,
};

enum class FlashLinkCommandCode : uint8_t {
  SetSafety = 1,
  SetArmLock = 2,
  SetInspection = 3,
  SetMute = 4,
  SetIgnitionMs = 5,
  SetCountdownMs = 6,
  SetPyroChannel = 7,
  SetPrecount = 8,
  StartCountdown = 9,
  Ignite = 10,
  ForceIgnite = 11,
  Abort = 12,
  SequenceEnd = 13,
  PyroTest = 14,
  GyroZero = 15,
  GyroZeroReset = 16,
  BaroZero = 17,
  BuzzerTone = 18,
  BuzzerStop = 19,
  BaroReference = 20,
  BuzzerFind = 21,
  SetDataMode = 22,
  SetServo = 23,
  StorageReset = 24,
  Reboot = 25,
};

enum class FlashLinkCommandResult : uint8_t {
  Ok = 0,
  SafetyMode = 1,
  Busy = 2,
  InvalidArgument = 3,
  Unsupported = 4,
};

#pragma pack(push, 1)
struct FlashLinkHeaderV1 {
  uint32_t magic;
  uint8_t version;
  uint8_t type;
  uint8_t role;
  uint8_t flags;
  uint32_t session;
  uint32_t seq;
  uint32_t ack;
  uint16_t payloadBytes;
  uint16_t crc16;
};

struct FlashLinkDiscoveryV1 {
  uint64_t deviceId;
  uint16_t telemetryHz;
  uint8_t channel;
  uint8_t capabilities;
};

struct FlashLinkTelemetryV1 {
  uint32_t telemetrySeq;
  uint32_t uptimeMs;
  float pressureMpa;
  float altitudeM;
  int16_t axMilliG;
  int16_t ayMilliG;
  int16_t azMilliG;
  int16_t gxDeciDps;
  int16_t gyDeciDps;
  int16_t gzDeciDps;
  int16_t rollCentiDeg;
  int16_t pitchCentiDeg;
  int16_t yawCentiDeg;
  int32_t gpsLatE7;
  int32_t gpsLonE7;
  int32_t gpsAltCm;
  uint16_t gpsAgeMs;
  uint32_t gpsUtcMs;
  int16_t chipTempDeciC;
  uint16_t loopUs;
  uint16_t cpuUs;
  int32_t tdMs;
  uint16_t flags;
  uint16_t ignitionMs;
  uint16_t countdownMs;
  uint8_t relayMask;
  uint8_t state;
  uint8_t abortReason;
  uint8_t mode;
  uint8_t pyroChannel;
  int32_t thrustMilliKgf;
  int32_t loadcellRaw;
  uint16_t loadcellHz;
  uint8_t loadcellFlags;
  uint8_t flightPhase;
  uint32_t missionAlarmSeq;
  uint32_t missionAlarmTimestampMs;
  uint16_t missionAlarmBlock;
  int16_t verticalSpeedDeciMps;
  int16_t attitudeQw;
  int16_t attitudeQx;
  int16_t attitudeQy;
  int16_t attitudeQz;
  uint16_t ignitionDelayMs;
  uint8_t deploymentState;
  uint8_t deploymentFlags;
};

struct FlashLinkStorageStatusV1 {
  uint32_t usedBytes;
  uint32_t capacityBytes;
  uint32_t recordCount;
};

struct FlashLinkStorageReadRequestV1 {
  uint32_t transaction;
  uint32_t offset;
  uint16_t len;
  uint16_t reserved;
};

struct FlashLinkStorageReadResponseV1 {
  uint32_t transaction;
  uint32_t offset;
  uint16_t len;
  uint8_t status;
  uint8_t reserved;
  uint8_t data[kFlashLinkStorageChunkBytes];
};

struct FlashLinkStorageListRequestV1 {
  uint32_t transaction;
  uint16_t startOrdinal;
  uint8_t limit;
  uint8_t reserved;
};

struct FlashLinkStorageListItemV1 {
  uint32_t sessionId;
  uint32_t offsetBytes;
  uint32_t bytes;
  uint32_t records;
  uint8_t current;
  uint8_t reserved[3];
};

struct FlashLinkStorageListResponseV1 {
  uint32_t transaction;
  uint16_t totalSessions;
  uint16_t startOrdinal;
  uint8_t count;
  uint8_t status;
  uint16_t reserved;
  FlashLinkStorageListItemV1 items[kFlashLinkStorageListBatchItems];
};

struct FlashLinkMissionAlarmV1 {
  uint32_t seq;
  uint32_t timestampMs;
  uint16_t blockIndex;
  uint16_t reserved;
  char title[24];
  char message[64];
};

struct FlashLinkCommandV1 {
  uint32_t transaction;
  uint8_t code;
  uint8_t flags;
  uint16_t reserved;
  int32_t arg0;
  int32_t arg1;
  int32_t arg2;
};

struct FlashLinkCommandAckV1 {
  uint32_t transaction;
  uint8_t code;
  uint8_t result;
  uint16_t reserved;
  int32_t detail;
};

struct StorageRecordHeaderV1 {
  uint16_t marker;
  uint8_t version;
  uint8_t type;
  uint16_t payloadSize;
  uint16_t flags;
  uint32_t timestampMs;
  uint32_t seq;
};

struct StorageSamplePayloadV1 {
  float t;
  float p;
  float ax;
  float ay;
  float az;
  float gx;
  float gy;
  float gz;
  float iv;
  uint8_t bp;
  uint32_t ut;
  uint16_t lt;
  uint16_t ct;
  uint16_t hz;
  uint8_t s;
  uint8_t ic;
  uint8_t r;
  uint8_t gs;
  uint8_t st;
  int32_t td;
  uint8_t uw;
  uint8_t ab;
  uint8_t ar;
  uint8_t m;
  uint8_t rs;
  uint8_t rf;
  uint8_t rm;
  uint8_t ss;
  uint8_t sm;
  uint32_t wq;
  uint8_t we;
};

struct StorageRecordV1 {
  StorageRecordHeaderV1 header;
  StorageSamplePayloadV1 payload;
};

struct StorageSamplePayloadV2 {
  float p;
  float altM;
  int16_t axMilliG;
  int16_t ayMilliG;
  int16_t azMilliG;
  int16_t gxDeciDps;
  int16_t gyDeciDps;
  int16_t gzDeciDps;
  int16_t rollCentiDeg;
  int16_t pitchCentiDeg;
  int16_t yawCentiDeg;
  int32_t td;
  uint16_t loopUs;
  uint16_t cpuUs;
  uint16_t flags;
  uint8_t st;
  uint8_t relayMask;
  uint8_t abortReason;
  uint8_t mode;
};

struct StorageRecordV2 {
  StorageRecordHeaderV1 header;
  StorageSamplePayloadV2 payload;
};

struct StorageSamplePayloadV3 {
  float p;
  float altM;
  int16_t axMilliG;
  int16_t ayMilliG;
  int16_t azMilliG;
  int16_t gxDeciDps;
  int16_t gyDeciDps;
  int16_t gzDeciDps;
  int16_t rollCentiDeg;
  int16_t pitchCentiDeg;
  int16_t yawCentiDeg;
  int32_t td;
  uint16_t loopUs;
  uint16_t cpuUs;
  uint16_t flags;
  uint8_t st;
  uint8_t relayMask;
  uint8_t abortReason;
  uint8_t mode;
  int32_t thrustMilliKgf;
  int32_t loadcellRaw;
  uint16_t loadcellHz;
  uint16_t loadcellFlags;
};

struct StorageRecordV3 {
  StorageRecordHeaderV1 header;
  StorageSamplePayloadV3 payload;
};

struct StorageSamplePayloadV4 {
  float p;
  float altM;
  int16_t axMilliG;
  int16_t ayMilliG;
  int16_t azMilliG;
  int16_t gxDeciDps;
  int16_t gyDeciDps;
  int16_t gzDeciDps;
  int16_t rollCentiDeg;
  int16_t pitchCentiDeg;
  int16_t yawCentiDeg;
  int32_t td;
  uint16_t loopUs;
  uint16_t cpuUs;
  uint16_t flags;
  uint8_t st;
  uint8_t relayMask;
  uint8_t abortReason;
  uint8_t mode;
  int32_t thrustMilliKgf;
  int32_t loadcellRaw;
  uint16_t loadcellHz;
  uint16_t loadcellFlags;
  int32_t gpsLatE7;
  int32_t gpsLonE7;
  int32_t gpsAltCm;
  uint16_t gpsAgeMs;
  uint16_t gpsFlags;
};

struct StorageRecordV4 {
  StorageRecordHeaderV1 header;
  StorageSamplePayloadV4 payload;
};

struct StorageSamplePayloadV5 {
  float p;
  float altM;
  int16_t axMilliG;
  int16_t ayMilliG;
  int16_t azMilliG;
  int16_t gxDeciDps;
  int16_t gyDeciDps;
  int16_t gzDeciDps;
  int16_t rollCentiDeg;
  int16_t pitchCentiDeg;
  int16_t yawCentiDeg;
  int32_t td;
  uint16_t loopUs;
  uint16_t cpuUs;
  uint16_t flags;
  uint8_t st;
  uint8_t relayMask;
  uint8_t abortReason;
  uint8_t mode;
  int32_t thrustMilliKgf;
  int32_t loadcellRaw;
  uint16_t loadcellHz;
  uint16_t loadcellFlags;
  int32_t gpsLatE7;
  int32_t gpsLonE7;
  int32_t gpsAltCm;
  uint16_t gpsAgeMs;
  uint16_t gpsFlags;
  uint16_t rawAccelMilliG;
  uint16_t coastAccelMilliG;
  int16_t fastVerticalSpeedDeciMps;
  int16_t displayVerticalSpeedDeciMps;
  int32_t apogeeCm;
  uint16_t coastHoldMs;
  uint16_t descentHoldMs;
  uint16_t transitionAt10Ms;
  uint8_t transitionReason;
  uint8_t deploymentFlags;
};

struct StorageRecordV5 {
  StorageRecordHeaderV1 header;
  StorageSamplePayloadV5 payload;
};

struct StorageMissionAlarmPayloadV1 {
  uint32_t eventSeq;
  uint8_t blockIndex;
  uint8_t severity;
  char title[14];
  char message[32];
};

struct StorageMissionAlarmRecordV1 {
  StorageRecordHeaderV1 header;
  StorageMissionAlarmPayloadV1 payload;
};

struct StorageMissionAlarmPayloadV2 {
  uint32_t eventSeq;
  uint8_t blockIndex;
  uint8_t severity;
  char title[14];
  char message[32];
  uint8_t reserved[16];
};

struct StorageMissionAlarmRecordV2 {
  StorageRecordHeaderV1 header;
  StorageMissionAlarmPayloadV2 payload;
};

struct StorageMissionAlarmPayloadV3 {
  uint32_t eventSeq;
  uint8_t blockIndex;
  uint8_t severity;
  char title[14];
  char message[32];
  uint8_t reserved[36];
};

struct StorageMissionAlarmRecordV3 {
  StorageRecordHeaderV1 header;
  StorageMissionAlarmPayloadV3 payload;
};

struct StorageBinHeaderV1 {
  char magic[8];
  uint16_t version;
  uint16_t headerSize;
  uint32_t dataBytes;
  uint32_t recordCount;
  uint32_t exportedAtMs;
  uint32_t samplePeriodMs;
  uint32_t recordMarker;
  uint32_t reserved0;
  uint32_t reserved1;
};

struct NorMetadataV1 {
  uint32_t magic;
  uint16_t version;
  uint16_t headerSize;
  uint32_t generation;
  uint32_t generationInverse;
};

struct NorSectorHeaderV1 {
  uint32_t magic;
  uint16_t version;
  uint16_t headerSize;
  uint32_t generation;
  uint32_t sectorIndex;
};

struct NorSectorHeaderV2 {
  uint32_t magic;
  uint16_t version;
  uint16_t headerSize;
  uint32_t generation;
  uint32_t sectorIndex;
  uint32_t sessionId;
};

struct NorSectorHeaderV3 {
  uint32_t magic;
  uint16_t version;
  uint16_t headerSize;
  uint32_t generation;
  uint32_t sectorIndex;
  uint32_t sessionId;
  uint8_t recordVersion;
  uint8_t recordType;
  uint16_t recordSize;
};

struct NorSectorFooterV1 {
  uint32_t magic;
  uint32_t generation;
  uint16_t recordCount;
  uint16_t recordCountInverse;
  uint32_t sectorIndex;
};
#pragma pack(pop)

static_assert(sizeof(FlashLinkHeaderV1) == 24, "ALTIS INTELLIGENT LINK1 header size changed");
static_assert(sizeof(FlashLinkTelemetryV1) == 109, "ALTIS INTELLIGENT LINK1 telemetry payload size changed");
static_assert(sizeof(FlashLinkMissionAlarmV1) == 100, "ALTIS INTELLIGENT LINK1 mission alarm payload size changed");
static_assert(sizeof(FlashLinkStorageListResponseV1) == 172, "ALTIS INTELLIGENT LINK1 storage list payload size changed");
static_assert(
  sizeof(FlashLinkHeaderV1) + sizeof(FlashLinkTelemetryV1) <= ESP_NOW_MAX_DATA_LEN,
  "ALTIS INTELLIGENT LINK1 telemetry exceeds ESP-NOW payload");
static_assert(
  sizeof(FlashLinkHeaderV1) + sizeof(FlashLinkCommandV1) <= ESP_NOW_MAX_DATA_LEN,
  "ALTIS INTELLIGENT LINK1 command exceeds ESP-NOW payload");
static_assert(
  sizeof(FlashLinkHeaderV1) + sizeof(FlashLinkStorageStatusV1) <=
    ESP_NOW_MAX_DATA_LEN,
  "ALTIS INTELLIGENT LINK1 storage status exceeds ESP-NOW payload");
static_assert(
  sizeof(FlashLinkHeaderV1) + sizeof(FlashLinkStorageReadRequestV1) <=
    ESP_NOW_MAX_DATA_LEN,
  "ALTIS INTELLIGENT LINK1 storage read request exceeds ESP-NOW payload");
static_assert(
  sizeof(FlashLinkHeaderV1) + sizeof(FlashLinkStorageReadResponseV1) <=
    ESP_NOW_MAX_DATA_LEN,
  "ALTIS INTELLIGENT LINK1 storage read response exceeds ESP-NOW payload");
static_assert(
  sizeof(FlashLinkHeaderV1) + sizeof(FlashLinkMissionAlarmV1) <=
    ESP_NOW_MAX_DATA_LEN,
  "ALTIS INTELLIGENT LINK1 mission alarm exceeds ESP-NOW payload");
static_assert(
  sizeof(FlashLinkHeaderV1) + sizeof(FlashLinkStorageListResponseV1) <=
    ESP_NOW_MAX_DATA_LEN,
  "ALTIS INTELLIGENT LINK1 storage list response exceeds ESP-NOW payload");

struct FlashLinkRxSlot {
  uint8_t mac[ESP_NOW_ETH_ALEN];
  uint16_t len;
  uint8_t data[kFlashLinkMaxPacketBytes];
};

struct FlashLinkRuntime {
  bool initialized = false;
  bool peerReady = false;
  bool linked = false;
  bool linkAnnounced = false;
  bool disconnectAlarmActive = false;
  bool remoteValid = false;
  volatile bool txBusy = false;
  volatile bool lastSendOk = false;
  uint8_t peerMac[ESP_NOW_ETH_ALEN] = {};
  uint32_t session = 0;
  uint32_t peerSession = 0;
  uint32_t txSeq = 0;
  uint32_t txTelemetrySeq = 0;
  uint32_t rxTelemetrySeq = 0;
  uint32_t lastDiscoveryMs = 0;
  uint32_t lastHelloMs = 0;
  uint32_t lastHeartbeatMs = 0;
  uint32_t lastPeerRxMs = 0;
  uint32_t lastTelemetryRxMs = 0;
  uint32_t lastTelemetryTxUs = 0;
  uint32_t lastStorageStatusTxMs = 0;
  uint32_t storageTransferExclusiveUntilMs = 0;
  uint32_t lastTxStartMs = 0;
  volatile uint32_t lastMacAckMs = 0;
  uint32_t txFrames = 0;
  uint32_t txOk = 0;
  uint32_t txFail = 0;
  uint32_t txSkipped = 0;
  uint32_t rxFrames = 0;
  uint32_t rxTelemetryFrames = 0;
  uint32_t rxDropped = 0;
  uint32_t rxDuplicate = 0;
  uint32_t rxCrcErrors = 0;
  uint32_t rxQueueDrops = 0;
  volatile int8_t rssiDbm = -127;
  volatile uint32_t lastRssiMs = 0;
  uint32_t lastAckSeq = 0;
  uint32_t lastAckRxMs = 0;
  uint32_t rxRateWindowMs = 0;
  uint32_t rxRateWindowFrames = 0;
  uint32_t rxRateWindowDrops = 0;
  uint16_t rxHz = 0;
  uint16_t rxLossPermille = 0;
  bool ackPending = false;
  bool commandAckPending = false;
  FlashLinkCommandAckV1 commandAck{};
  uint8_t commandAckDestination[ESP_NOW_ETH_ALEN] = {};
  uint32_t lastCommandTransaction = 0;
  FlashLinkCommandAckV1 lastCommandAck{};
  FlashLinkCommandAckV1 commandAckCache[kFlashLinkCommandQueueDepth]{};
  uint8_t commandAckCacheCount = 0;
  uint8_t commandAckCacheNext = 0;
  uint32_t commandQueued = 0;
  uint32_t commandAcked = 0;
  uint32_t commandFailed = 0;
  uint32_t commandRetries = 0;
  uint32_t nextCommandTransaction = 0;
  uint32_t lastQueuedCommandMs = 0;
  int32_t lastQueuedArg0 = 0;
  int32_t lastQueuedArg1 = 0;
  int32_t lastQueuedArg2 = 0;
  uint8_t lastQueuedCommandCode = 0;
  uint8_t lastQueuedTargetNodeId = 0;
  uint8_t lastCommandCode = 0;
  uint8_t lastCommandResult = 0;
  uint32_t nextStorageReadTransaction = 0;
  uint32_t lastMissionAlarmTxSeq = 0;
  uint32_t lastMissionAlarmTxMs = 0;
};

struct FlashLinkStorageReadClient {
  bool pending = false;
  bool ready = false;
  uint32_t transaction = 0;
  uint32_t offset = 0;
  uint16_t requestedLen = 0;
  uint16_t len = 0;
  uint8_t status = 0;
  uint8_t data[kFlashLinkStorageChunkBytes] = {};
  uint32_t completedMs = 0;
  uint8_t targetNodeId = kFlashLinkNodeIdStage1;
};

struct FlashLinkStorageListClient {
  bool pending = false;
  bool ready = false;
  uint32_t transaction = 0;
  uint8_t targetNodeId = kFlashLinkNodeIdStage1;
  FlashLinkStorageListResponseV1 response{};
};

struct FlashLinkStorageListTx {
  bool pending = false;
  uint8_t attempts = 0;
  uint32_t queuedMs = 0;
  uint8_t destination[ESP_NOW_ETH_ALEN] = {};
  FlashLinkStorageListResponseV1 response{};
};

struct FlashLinkRemoteState {
  uint16_t flags = 0;
  uint8_t relayMask = 0;
  uint8_t state = 0;
  uint8_t abortReason = 0;
  uint8_t mode = 1;
  int32_t tdMs = 0;
  uint16_t ignitionMs = kDefaultIgnitionMs;
  uint16_t countdownMs = kDefaultCountdownMs;
  uint8_t pyroChannel = 1;
  uint32_t storageUsedBytes = 0;
  uint32_t storageCapacityBytes = 0;
  uint32_t storageRecordCount = 0;
};

struct FlashLinkGroundPeer {
  bool occupied = false;
  bool peerReady = false;
  bool linked = false;
  bool remoteValid = false;
  bool ackPending = false;
  bool relayed = false;
  bool directReady = false;
  bool relayReady = false;
  bool directLinked = false;
  bool relayLinked = false;
  bool telemetryDegraded = false;
  uint8_t nodeId = 0;
  uint8_t mac[ESP_NOW_ETH_ALEN] = {};
  uint8_t directMac[ESP_NOW_ETH_ALEN] = {};
  uint8_t relayMac[ESP_NOW_ETH_ALEN] = {};
  uint8_t ackDestination[ESP_NOW_ETH_ALEN] = {};
  uint32_t session = 0;
  uint32_t rxTelemetrySeq = 0;
  uint32_t lastPeerRxMs = 0;
  uint32_t lastTelemetryRxMs = 0;
  uint32_t lastDirectRxMs = 0;
  uint32_t lastRelayRxMs = 0;
  uint32_t lastDirectTelemetryRxMs = 0;
  uint32_t lastRelayTelemetryRxMs = 0;
  uint32_t relayHealthySinceMs = 0;
  uint32_t routeChangedMs = 0;
  uint32_t lastHelloMs = 0;
  uint32_t lastHeartbeatMs = 0;
  uint32_t rxFrames = 0;
  uint32_t rxTelemetryFrames = 0;
  uint32_t rxDropped = 0;
  uint32_t rxDuplicate = 0;
  uint32_t rxRateWindowMs = 0;
  uint32_t rxRateWindowFrames = 0;
  uint32_t rxRateWindowDrops = 0;
  uint16_t rxHz = 0;
  uint16_t rxLossPermille = 0;
  int8_t rssiDbm = -127;
  int8_t directRssiDbm = -127;
  int8_t relayRssiDbm = -127;
  uint32_t lastRssiMs = 0;
  uint32_t lastDirectRssiMs = 0;
  uint32_t lastRelayRssiMs = 0;
  Telemetry snap{};
  FlashLinkRemoteState state{};
  uint32_t alarmSeq = 0;
  uint32_t alarmTimestampMs = 0;
  uint16_t alarmBlockIndex = 0;
  char alarmTitle[24] = {};
  char alarmMessage[64] = {};
};

struct FlashLinkDirectGroundRuntime {
  bool peerReady = false;
  bool linked = false;
  bool ackPending = false;
  uint8_t mac[ESP_NOW_ETH_ALEN] = {};
  uint32_t session = 0;
  uint32_t lastRxMs = 0;
  uint32_t lastHelloMs = 0;
  uint32_t lastHeartbeatMs = 0;
  volatile uint32_t lastMacAckMs = 0;
  int8_t rssiDbm = -127;
  uint32_t lastRssiMs = 0;
  uint32_t txFrames = 0;
  uint32_t txFail = 0;
};

struct FlashLinkRelayRuntime {
  bool stage2PeerReady = false;
  bool stage2Linked = false;
  bool stage2AckPending = false;
  uint8_t stage2Mac[ESP_NOW_ETH_ALEN] = {};
  uint32_t stage2Session = 0;
  uint32_t stage2RxTelemetrySeq = 0;
  uint32_t stage2RxTelemetryFrames = 0;
  uint32_t stage2LastRxMs = 0;
  uint32_t stage2LastTelemetryRxMs = 0;
  uint32_t stage2LastDiscoveryMs = 0;
  uint32_t stage2LastHelloMs = 0;
  uint32_t stage2LastHeartbeatMs = 0;
  uint32_t forwardedUp = 0;
  uint32_t forwardedDown = 0;
  uint32_t telemetryCoalesced = 0;
  uint32_t queueDrops = 0;
};

struct FlashLinkRelayTxSlot {
  uint8_t destination[ESP_NOW_ETH_ALEN] = {};
  uint16_t len = 0;
  uint8_t data[kFlashLinkMaxPacketBytes] = {};
};

FlashLinkRuntime flashLink;
FlashLinkStorageReadClient flashLinkStorageReadClients[kFlashLinkStorageWindowDepth];
FlashLinkStorageListClient flashLinkStorageListClient;
FlashLinkStorageListTx flashLinkStorageListTx;
FlashLinkRemoteState flashLinkRemoteState;
FlashLinkGroundPeer flashLinkGroundPeers[kFlashLinkVehicleNodeCount];
FlashLinkRelayRuntime flashLinkRelay;
FlashLinkDirectGroundRuntime flashLinkDirectGround;
FlashLinkRelayTxSlot flashLinkRelayTxQueue[kFlashLinkRelayTxQueueDepth];
volatile uint8_t flashLinkRelayTxHead = 0;
volatile uint8_t flashLinkRelayTxTail = 0;
volatile uint8_t flashLinkRelayTxCount = 0;
char flashLinkRateName[16] = "1M_L";
int flashLinkRateError = 0;
FlashLinkRxSlot flashLinkRxQueue[kFlashLinkRxQueueDepth];
volatile uint8_t flashLinkRxHead = 0;
volatile uint8_t flashLinkRxTail = 0;
volatile uint8_t flashLinkRxCount = 0;
portMUX_TYPE flashLinkRxMux = portMUX_INITIALIZER_UNLOCKED;
portMUX_TYPE flashLinkStorageReadMux = portMUX_INITIALIZER_UNLOCKED;

struct FlashLinkCommandQueueEntry {
  FlashLinkCommandV1 command{};
  uint8_t targetNodeId = kFlashLinkNodeIdStage1;
  uint8_t attempts = 0;
  uint32_t lastSendMs = 0;
};

FlashLinkCommandQueueEntry flashLinkCommandQueue[kFlashLinkCommandQueueDepth];
volatile uint8_t flashLinkCommandHead = 0;
volatile uint8_t flashLinkCommandTail = 0;
volatile uint8_t flashLinkCommandCount = 0;
portMUX_TYPE flashLinkCommandMux = portMUX_INITIALIZER_UNLOCKED;

static_assert(sizeof(StorageRecordHeaderV1) == 16, "StorageRecordHeaderV1 size mismatch");
static_assert(sizeof(StorageSamplePayloadV1) == 70, "StorageSamplePayloadV1 size mismatch");
static_assert(sizeof(StorageRecordV1) == 86, "StorageRecordV1 size mismatch");
static_assert(sizeof(StorageSamplePayloadV2) == 40, "StorageSamplePayloadV2 size mismatch");
static_assert(sizeof(StorageRecordV2) == 56, "StorageRecordV2 size mismatch");
static_assert(sizeof(StorageSamplePayloadV3) == 52, "StorageSamplePayloadV3 size mismatch");
static_assert(sizeof(StorageRecordV3) == 68, "StorageRecordV3 size mismatch");
static_assert(sizeof(StorageSamplePayloadV4) == 68, "StorageSamplePayloadV4 size mismatch");
static_assert(sizeof(StorageRecordV4) == 84, "StorageRecordV4 size mismatch");
static_assert(sizeof(StorageSamplePayloadV5) == 88, "StorageSamplePayloadV5 size mismatch");
static_assert(sizeof(StorageRecordV5) == 104, "StorageRecordV5 size mismatch");
static_assert(sizeof(StorageMissionAlarmPayloadV1) == 52, "StorageMissionAlarmPayloadV1 size mismatch");
static_assert(sizeof(StorageMissionAlarmRecordV1) == 68, "StorageMissionAlarmRecordV1 size mismatch");
static_assert(sizeof(StorageMissionAlarmPayloadV2) == 68, "StorageMissionAlarmPayloadV2 size mismatch");
static_assert(sizeof(StorageMissionAlarmRecordV2) == 84, "StorageMissionAlarmRecordV2 size mismatch");
static_assert(sizeof(StorageMissionAlarmPayloadV3) == 88, "StorageMissionAlarmPayloadV3 size mismatch");
static_assert(sizeof(StorageMissionAlarmRecordV3) == 104, "StorageMissionAlarmRecordV3 size mismatch");
static_assert(sizeof(StorageBinHeaderV1) == 40, "StorageBinHeaderV1 size mismatch");
static_assert(sizeof(NorMetadataV1) == 16, "NorMetadataV1 size mismatch");
static_assert(sizeof(NorSectorHeaderV1) == 16, "NorSectorHeaderV1 size mismatch");
static_assert(sizeof(NorSectorHeaderV2) == 20, "NorSectorHeaderV2 size mismatch");
static_assert(sizeof(NorSectorHeaderV3) == 24, "NorSectorHeaderV3 size mismatch");
static_assert(sizeof(NorSectorFooterV1) == 16, "NorSectorFooterV1 size mismatch");

constexpr uint16_t kNorRecordsPerSectorV1 =
  (kNorFooterOffset - sizeof(NorSectorHeaderV2)) / sizeof(StorageRecordV1);
constexpr uint16_t kNorRecordsPerSectorV2 =
  (kNorFooterOffset - sizeof(NorSectorHeaderV3)) / sizeof(StorageRecordV2);
constexpr uint16_t kNorRecordsPerSectorV3 =
  (kNorFooterOffset - sizeof(NorSectorHeaderV3)) / sizeof(StorageRecordV3);
constexpr uint16_t kNorRecordsPerSectorV4 =
  (kNorFooterOffset - sizeof(NorSectorHeaderV3)) / sizeof(StorageRecordV4);
constexpr uint16_t kNorRecordsPerSectorV5 =
  (kNorFooterOffset - sizeof(NorSectorHeaderV3)) / sizeof(StorageRecordV5);
constexpr uint16_t kNorMaxRecordsPerSector12 =
  kNorRecordsPerSectorV2 > kNorRecordsPerSectorV1
    ? kNorRecordsPerSectorV2
    : kNorRecordsPerSectorV1;
constexpr uint16_t kNorMaxRecordsPerSector34 =
  kNorRecordsPerSectorV4 > kNorRecordsPerSectorV3
    ? kNorRecordsPerSectorV4
    : kNorRecordsPerSectorV3;
constexpr uint16_t kNorMaxRecordsPerSector45 =
  kNorRecordsPerSectorV5 > kNorRecordsPerSectorV4
    ? kNorRecordsPerSectorV5
    : kNorRecordsPerSectorV4;
constexpr uint16_t kNorMaxRecordsPerSector =
  kNorMaxRecordsPerSector12 > kNorMaxRecordsPerSector34
    ? (kNorMaxRecordsPerSector12 > kNorMaxRecordsPerSector45
        ? kNorMaxRecordsPerSector12
        : kNorMaxRecordsPerSector45)
    : (kNorMaxRecordsPerSector34 > kNorMaxRecordsPerSector45
        ? kNorMaxRecordsPerSector34
        : kNorMaxRecordsPerSector45);
constexpr uint16_t kNorDataSectorCount =
  (kNorExpectedCapacityBytes - kNorDataStartAddress) / kNorSectorBytes;
constexpr uint32_t kNorLogicalCapacityBytesV1 =
  (uint32_t)kNorDataSectorCount * (uint32_t)kNorRecordsPerSectorV1 * (uint32_t)sizeof(StorageRecordV1);
constexpr uint32_t kNorLogicalCapacityBytesV2 =
  (uint32_t)kNorDataSectorCount * (uint32_t)kNorRecordsPerSectorV2 * (uint32_t)sizeof(StorageRecordV2);
constexpr uint32_t kNorLogicalCapacityBytesV3 =
  (uint32_t)kNorDataSectorCount * (uint32_t)kNorRecordsPerSectorV3 * (uint32_t)sizeof(StorageRecordV3);
constexpr uint32_t kNorLogicalCapacityBytesV4 =
  (uint32_t)kNorDataSectorCount * (uint32_t)kNorRecordsPerSectorV4 * (uint32_t)sizeof(StorageRecordV4);
constexpr uint32_t kNorLogicalCapacityBytesV5 =
  (uint32_t)kNorDataSectorCount * (uint32_t)kNorRecordsPerSectorV5 * (uint32_t)sizeof(StorageRecordV5);
constexpr uint32_t kNorLogicalCapacityBytes =
  kNorLogicalCapacityBytesV5;

struct StorageRuntime {
  bool ready = false;
  bool busy = false;
  bool full = false;
  uint32_t capacityBytes = 0;
  uint32_t usedBytes = 0;
  uint32_t queueBytes = 0;
  uint32_t recordCount = 0;
  uint32_t droppedRecords = 0;
  uint32_t flushCount = 0;
  uint32_t writeErrors = 0;
  uint32_t sessionCount = 0;
  uint32_t startedAtMs = 0;
  uint32_t lastFlushMs = 0;
  uint32_t generation = 0;
  uint32_t sectorCount = 0;
};

struct StorageSessionInfo {
  uint32_t id = 0;
  uint32_t offsetBytes = 0;
  uint32_t bytes = 0;
  uint32_t records = 0;
  uint16_t firstSector = 0;
  uint16_t sectorCount = 0;
};

StorageRuntime storageState;
struct StorageQueueEntry {
  uint16_t size = 0;
  alignas(4) uint8_t bytes[
    sizeof(StorageRecordV1) > sizeof(StorageRecordV5)
      ? sizeof(StorageRecordV1)
      : sizeof(StorageRecordV5)
  ] = {};
};
StorageQueueEntry storageQueue[kStorageQueueDepth];
uint16_t storageQueueHead = 0;
uint16_t storageQueueTail = 0;
uint16_t storageQueueCount = 0;
uint8_t* storageSectorRecordCounts = nullptr;
uint8_t* storageSectorHeaderSizes = nullptr;
uint8_t* storageSectorRecordVersions = nullptr;
uint32_t* storageSectorPrefix = nullptr;
uint32_t* storageSectorBytePrefix = nullptr;
uint32_t* storageSectorSessionIds = nullptr;
uint8_t storageJedecMfr = 0;
uint8_t storageJedecType = 0;
uint8_t storageJedecCapacity = 0;
uint32_t storageSpiActiveHz = 1000000UL;
uint32_t storageCurrentSessionId = 1;
uint8_t storageMetadataSlot = 0;
bool storageCurrentSectorWritable = false;
TaskHandle_t loopTaskHandle = nullptr;
bool storageWaitServiceActive = false;
bool runtimeServicesReady = false;
bool sensorPinsRuntimeReady = false;
bool gpsPinsActive = false;
bool loadcellPinsActive = false;
volatile bool storageResetActive = false;
SemaphoreHandle_t storageMutex = nullptr;
SemaphoreHandle_t fileSystemMutex = nullptr;
uint32_t storageLockSkippedSamples = 0;

class StorageLock {
 public:
  explicit StorageLock(TickType_t waitTicks = kStorageLockWaitTicks)
      : locked_(storageMutex != nullptr &&
                xSemaphoreTakeRecursive(storageMutex, waitTicks) == pdTRUE) {}

  ~StorageLock() {
    if (locked_) xSemaphoreGiveRecursive(storageMutex);
  }

  explicit operator bool() const { return locked_; }

 private:
  bool locked_;
};

class FileSystemLock {
 public:
  explicit FileSystemLock(TickType_t waitTicks = pdMS_TO_TICKS(1000))
      : locked_(fileSystemMutex != nullptr &&
                xSemaphoreTakeRecursive(fileSystemMutex, waitTicks) == pdTRUE) {}

  ~FileSystemLock() {
    if (locked_) xSemaphoreGiveRecursive(fileSystemMutex);
  }

  explicit operator bool() const { return locked_; }

 private:
  bool locked_;
};

float rawRoll = 0.0f;
float rawPitch = 0.0f;
float rawYaw = 0.0f;
float zeroRoll = 0.0f;
float zeroPitch = 0.0f;
float zeroYaw = 0.0f;
float zeroQ0 = 1.0f;
float zeroQ1 = 0.0f;
float zeroQ2 = 0.0f;
float zeroQ3 = 0.0f;
uint32_t attitudeLastUs = 0;
float attitudeQ0 = 1.0f;
float attitudeQ1 = 0.0f;
float attitudeQ2 = 0.0f;
float attitudeQ3 = 0.0f;
float attitudeIntX = 0.0f;
float attitudeIntY = 0.0f;
float attitudeIntZ = 0.0f;
uint16_t gyroStillFrames = 0;

float seaLevelHpa = kDefaultSeaLevelHpa;
float baroPressureFilteredMpa = 0.0f;
float baroBasePressureMpa = 0.0f;
float baroBaseSumMpa = 0.0f;
uint8_t baroBaseSamples = 0;
bool baroFilterReady = false;
bool baroBaseReady = false;

bool loadcellReady = false;
bool loadcellFilterReady = false;
bool loadcellAutoZeroDone = false;
bool loadcellSaturated = false;
uint32_t lastLoadcellPollUs = 0;
uint32_t lastLoadcellSampleMs = 0;
uint32_t loadcellRateWindowMs = 0;
uint32_t loadcellRateWindowSamples = 0;
uint32_t loadcellReadErrors = 0;
uint16_t loadcellHz = 0;
uint16_t loadcellAutoZeroCount = 0;
int32_t loadcellRaw = 0;
int32_t loadcellOffset = 0;
int64_t loadcellAutoZeroSum = 0;
float loadcellScale = kLoadcellDefaultScale;
float loadcellFilteredKgf = 0.0f;

float gyroBiasX = 0.0f;
float gyroBiasY = 0.0f;
float gyroBiasZ = 0.0f;
float biasSumX = 0.0f;
float biasSumY = 0.0f;
float biasSumZ = 0.0f;
uint16_t biasSamples = 0;
bool bootBiasReady = false;

char serialLine[160];
uint16_t serialLineLen = 0;
char gpsLine[kGpsLineMax + 1];
uint16_t gpsLineLen = 0;
GpsState gpsState;
uint8_t gpsConfigIndex = 0;
uint32_t gpsLastAutodetectMs = 0;
uint32_t gpsSentenceCountAtSwitch = 0;
bool gpsTargetRateConfigured = false;
BuzzerPlayer buzzer;
BuzzerNote buzzerSingleNote[1] = {};
BuzzerNote bootButtonMenuCue[kBootButtonMaxActionClicks] = {};
bool buzzerToneInitialized = false;

const BuzzerNote kBootMelody[] = {
  {1319, 55, 18},
  {1976, 70, 20},
  {1568, 52, 18},
  {2637, 78, 22},
  {2093, 58, 18},
  {3136, 86, 28},
  {2349, 60, 18},
  {3520, 170, 0},
};
const BuzzerNote kFlashLinkMelody[] = {
  {1175, 65, 20}, {1568, 65, 20}, {2093, 80, 24}, {2637, 190, 0},
};
const BuzzerNote kFlashLinkConnectedMelody[] = {
  {1319, 130, 50},
  {1568, 150, 50},
  {2093, 180, 60},
  {2637, 220, 80},
  {3136, 360, 0},
};
const BuzzerNote kFlashLinkDisconnectedAlarm[] = {
  {659, 180, 100},
  {440, 300, 80},
  {0, 700, 0},
};
const BuzzerNote kFindMelody[] = {
  {1760, 120, 70}, {2349, 160, 90}, {1568, 120, 160},
  {1760, 120, 70}, {2349, 160, 90}, {3136, 220, 280},
};
const BuzzerNote kDeveloperOnMelody[] = {
  {1568, 80, 35}, {2093, 100, 0},
};
const BuzzerNote kDeveloperOffMelody[] = {
  {880, 90, 35}, {659, 140, 0},
};

const GpsUartConfig kGpsConfigs[] = {
  {kGpsRx, kGpsTx, 115200},
  {kGpsTx, kGpsRx, 115200},
  {kGpsRx, kGpsTx, 9600},
  {kGpsTx, kGpsRx, 9600},
  {kGpsRx, kGpsTx, 38400},
  {kGpsTx, kGpsRx, 38400},
};

void pollGps();
void initGps();
void stopGps();
void updateSharedSensorPins();
void syncGpsTelemetry(bool force = false);
void sequenceTick();
void sampleImu();
void sampleLoadcell();
void sampleBarometer();
void sampleChipTemperature();
void flightPhaseTick();
uint8_t sequenceRelayMaskNow(uint32_t nowMs);
void initPyroOutputs();
void applyPyroOutputs(uint32_t nowMs);
void sendPeriodicTelemetry();
void blinkStatus();
void buzzerTick();
void setupFlashLink();
void flashLinkTick();
bool wifiApShouldRun();
bool wifiApActive();
const char* wifiModeText();
bool startWifiAp(bool restart = false);
void wifiApWatchdogTick();
void flashLinkFormatMac(const uint8_t* mac, char* out, size_t outLen);
uint16_t flashLinkLossPermille();
uint32_t flashLinkPeerAgeMs();
bool flashLinkRemoteActive();
bool flashLinkOperational();
void flashLinkGroundRefreshSelectedPeer();
bool flashLinkRouteFresh(uint32_t lastRxMs, uint32_t maxAgeMs);
bool flashLinkStorageTransferActive(uint32_t nowMs);
void flashLinkHoldStorageTransfer(uint32_t nowMs);
void flashLinkGroundChooseRoute(FlashLinkGroundPeer& peer);
void flashLinkGroundAutoSelectTarget(uint32_t nowMs);
void flashLinkSetStage2Mode(bool enabled, bool persist = true);
bool flashLinkStage2RelayActive(uint32_t nowMs);
bool flashLinkStage2DirectGroundActive(uint32_t nowMs);
void saveSequenceSettings();
void saveBootOnceMode(const char* mode);
bool flashLinkQueueCommand(
  FlashLinkCommandCode code,
  int32_t arg0 = 0,
  int32_t arg1 = 0,
  int32_t arg2 = 0);
bool flashLinkGroundControlActive();
bool flashLinkCanProxyStorage();
bool flashLinkRequestStorageReadWindowed(
  uint32_t offset,
  uint16_t len,
  uint8_t* out,
  uint16_t& outLen,
  uint32_t timeoutMs = 2600);
bool flashLinkRequestStorageList(
  uint16_t startOrdinal,
  FlashLinkStorageListResponseV1& out,
  uint32_t timeoutMs = 1800);
const char* flashLinkCommandResultName(uint8_t result);
bool startCountdownRuntimeFor(uint32_t nowMs, uint32_t durationMs, bool playStartTone);
bool loadMissionRuntimeFromFlash();
void missionRuntimeTick();
