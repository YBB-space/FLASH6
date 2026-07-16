# FLASH6 Program Diagram

This document summarizes the current `flash6` program structure (external UI + firmware API integration) as Mermaid diagrams.

## 1) System Architecture

```mermaid
flowchart LR
  subgraph Browser["Operator Browser"]
    UI["flash6.html + styles/ + scripts/ + flash6.js"]
    Overlay["overlay.html"]
  end

  subgraph ESP32["ESP32 Firmware"]
    Web["web_api.cpp<br/>HTTP + WebSocket /ws"]
    Sampler["SamplerTask<br/>(5ms period)"]
    Control["ControlTask<br/>(sequence/relay/tone)"]
    Stream["WebSocketTask<br/>(stream push)"]
    Mission["mission_runtime.cpp"]
    Storage["spi_storage.cpp"]
    State["state.cpp"]
  end

  subgraph HW["Hardware"]
    IMU["IMU + Baro"]
    Loadcell["Loadcell"]
    Relays["Pyro Relays CH1..CH4"]
    Servo["Servo PWM CH1..CH4"]
    Flash["W25Q SPI Flash"]
  end

  UI -->|GET /data, /graphic_data| Web
  UI -->|Command HTTP| Web
  UI <-->|WebSocket /ws| Web
  Overlay <-->|BroadcastChannel + /ws| UI

  Web --> State
  Web --> Mission
  Web --> Storage
  Stream --> Web

  Sampler --> State
  Sampler --> Mission
  Sampler --> Storage
  Sampler --> Stream
  Control --> State

  Sampler --> IMU
  Sampler --> Loadcell
  Control --> Relays
  Control --> Servo
  Storage --> Flash
```

## 2) Runtime Data Flow (Telemetry)

```mermaid
flowchart TD
  Sensors["IMU/Baro/Loadcell/Switch"] --> Sampler["SamplerTask"]
  Sampler --> Snap["SampleSnap build"]
  Snap --> MissionTick["missionRuntimeTick()"]
  Snap --> LogQ["spiStorageEnqueueSample()"]
  Snap --> WsBuf["last sample buffer"]
  WsBuf --> WsTask["WebSocketTask"]
  WsTask --> WsClients["/ws clients (flash6.js, overlay.html)"]
  WsClients --> UIRender["UI update + charts + status pills"]
```

## 3) Command / Control Path

```mermaid
sequenceDiagram
  participant U as User
  participant F as flash6.js
  participant W as web_api.cpp
  participant S as state.cpp
  participant C as ControlTask
  participant R as Relay outputs

  U->>F: click "SEQUENCE START"
  F->>W: GET /countdown_start
  W->>S: startCountdownNow()
  C->>S: read currentState
  C->>C: ST_COUNTDOWN timing
  C->>S: ST_FIRING transition
  C->>R: ignition relay ON
  C->>S: ignition end -> ST_IDLE
  F->>W: GET /abort (optional)
  W->>S: setIdleAbort()
  C->>R: all relay OFF
```

## 4) Firmware State Machine (Sequence Core)

```mermaid
stateDiagram-v2
  [*] --> ST_IDLE
  ST_IDLE --> ST_COUNTDOWN: /countdown_start\n(or /ign_seq)
  ST_COUNTDOWN --> ST_FIRING: countdown elapsed
  ST_COUNTDOWN --> ST_IDLE: /abort or safety
  ST_FIRING --> ST_IDLE: ignition duration elapsed
  ST_FIRING --> ST_IDLE: /abort or /sequence_end
```

## 5) Main HTTP/WS Interfaces Used by flash6

```mermaid
flowchart LR
  F["flash6.js"] --> D["GET /data or /graphic_data"]
  F <--> WS["WebSocket /ws"]
  F --> Set["GET /set?..."]
  F --> Cd["GET /countdown_start"]
  F --> Ig["GET /ignite or /force_ignite"]
  F --> Ab["GET /abort, /sequence_end"]
  F --> Servo["GET /servo?ch=&deg="]
  F --> Pyro["GET /pyro_test?ch=&ms="]
  F --> Mission["GET/POST /mission_profile"]
  F --> Store["GET/POST /storage/spi_flash/*"]
  F --> Gyro["GET /gyro_zero?..."]
```

## Source Anchors

- UI: `flash6/flash6.html`, `flash6/flash6.js`, `flash6/overlay.html`
- API routes: `src/web_api.cpp` (`server.on(...)` and `AsyncWebSocket ws("/ws")`)
- Runtime tasks: `src/tasks.cpp` (`SamplerTask`, `ControlTask`, `WebSocketTask`, `startTasks`)
- State and mission: `src/state.cpp`, `src/mission_runtime.cpp`
- Storage logging: `src/spi_storage.cpp`
