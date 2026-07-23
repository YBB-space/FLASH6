# ALTIS INTELLIGENT3 Firmware Changelog

Firmware, build, and wire-protocol version changes are recorded here in the
same commit that changes the corresponding constants in `src/firmware/state.h`.

## FLASH6 replay HUD clipping fix b68 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Anchored the replay camera/gyro viewport directly above the transport strip
  so late parent-layout changes cannot move HUD instruments behind the dock.
- Moved the boundary fade from the high-layer transport element into the camera
  viewport beneath the HUD instruments, preventing intermittent gauge clipping.

## FLASH6 replay gyro zero b67 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Routed replay gyro-zero through the local attitude-reference path instead of
  attempting to calibrate a live avionics board.
- The selected replay frame now becomes the visual zero reference and its
  offsets remain applied as subsequent replay samples are rendered.

## FLASH6 replay dock compact b66 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Reduced the desktop replay transport strip to 82 px and compacted its file
  selector to remove unnecessary vertical space.
- Extended and strengthened the upper fade so the HUD transitions visibly but
  smoothly into the replay transport surface.

## FLASH6 replay dock fade b65 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Replaced the replay dock's upper border with a soft transparent-to-surface
  gradient transition.
- Removed the remaining hard edge and drop shadow while preserving the compact
  transport height and centered control layout.

## FLASH6 replay dock density b64 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Reduced the reserved replay transport height and vertically centered every
  playback control within the lower strip.
- Removed the pronounced card boundary and heavy upper shadow so the replay
  strip blends into the camera HUD gradient.
- Returned additional vertical space to the telemetry viewport without
  allowing the transport to overlap the lower flight instruments.

## FLASH6 replay viewport dock b63 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Reserved a dedicated lower viewport strip for the desktop replay transport
  instead of overlaying it on the camera/gyro HUD.
- Reduced the replay camera canvas height so the lower velocity, acceleration,
  and altitude instruments remain fully visible above the transport.
- Expanded the playback dock edge-to-edge across the lower screen area and
  re-centered the navigation and replay tools within the remaining HUD height.

## FLASH6 replay view interaction b62 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Prevented clicks outside the bottom playback dock from closing replay mode.
- Gyro-preview camera interaction and other dashboard pointer controls now
  remain usable while replay playback is active.
- Replay exit remains available through the dedicated close control.

## FLASH6 replay tools panel b61 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Re-enabled the control-panel navigation action while replay mode is active.
- Moved replay gyro-zero and Excel/Word report actions out of the bottom
  transport and into a dedicated replay control panel.
- Connected the replay gyro-zero action to the shared live/simulation gyro
  reference handler and kept playback controls focused on transport only.

## FLASH6 replay bottom dock b60 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Replaced the desktop replay side drawer with a fixed bottom playback dock
  while preserving the existing replay engine and data interfaces.
- Gave the seek timeline the primary horizontal space and grouped file change,
  playback, speed, gyro-zero, and report export actions into one compact
  transport surface.
- Kept the mobile and tablet replay control surfaces separate and unchanged,
  and added a dedicated desktop replay-exit control.

## FLASH6 replay home exit b59 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Closing the replay control surface now stops playback, restores the live data
  source, and returns the desktop UI to the FLASH6 welcome screen.
- Applied the same close behavior to the close button, outside click, Escape
  key, desktop drawer toggle, mobile modal, and tablet panel.
- Preserved a verified physical board connection while clearing replay-only
  welcome readiness when no board is connected.

## FLASH6 actual-speed quick metric b58 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Changed the flight-mode Quick Data secondary metric from barometric altitude
  rate to actual speed, prioritizing a 3-axis velocity vector, GPS displacement,
  and the existing attitude/IMU fusion estimate.
- Updated the shared expanded map and gyro HUD label from `Altitude Speed` to
  `Speed`; flight-phase detection continues to use its dedicated vertical-speed
  path independently. Vertical speed remains only as a compatibility fallback
  for legacy replay data without an actual-speed source.

## FLASH6 replay controls visibility b57 — 2026-07-23

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Restored the replay control surface after selecting a replay data file.
- Replay mode now opens the existing desktop control drawer, mobile control
  modal, or tablet control panel for the active layout.
- Kept playback, seeking, speed, gyro-zero, and report export controls on the
  shared replay control implementation.

## FLASH6 direct-avionics connection compatibility b56 — 2026-07-23

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Kept telemetry-based board verification while allowing both supported
  `GROUND` and `AVIONICS` roles over Wi-Fi and WebSerial.
- Removed the welcome-screen ground-only gate that rejected a directly
  connected avionics board after a valid settings handshake.
- Kept transport ownership stable after connection and display the verified
  board role on the welcome screen instead of treating every board as ground.
- Generalized mobile connection waiting and stale-port recovery copy to cover
  either a ground-station or direct-avionics connection.

## FLASH6 ground-station connection stabilization b55 — 2026-07-23

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Changed welcome-screen discovery to require a valid FLASH6 telemetry frame
  from a board reporting the `GROUND` role. A generic HTTP `/ping` response no
  longer marks the ground station as connected.
- Ranked and inspected every previously authorized ESP32 WebSerial port instead
  of blindly opening the first one. Non-ground avionics ports are rejected
  before their telemetry stream is enabled.
- Required both the ground-role settings ACK and a live telemetry sample before
  exposing `Start`, and removed the stale 30-second connection-ready latch.
- Limited Wi-Fi/USB discovery switching to the welcome screen. After dashboard
  entry, WebSocket and WebSerial retain their own reconnect paths without the
  discovery loop changing transport underneath them.
- Added a 6.5-second serial inactivity watchdog that closes stale handles and
  reopens the last verified ground-station transport.

## 0.9.3 — v6 b33 — 2026-07-23

Protocol: `Flash6-Intelligent-b7` (unchanged; ESP-NOW wire version `7`)

- Added role-aware ARM polarity for the stage-2 Hall sensor. Stage 2 now treats
  raw LOW as separation mechanism installed (magnet near) and raw HIGH as
  separated (magnet departed), while stage 1 keeps HIGH=installed and
  LOW=released.
- Changed stage-2 ignition authorization to the debounced LOW-to-HIGH Hall
  transition and changed stage 1's relayed telemetry fallback to recognize the
  same separation state.
- Kept the existing public telemetry contract by normalizing physical/effective
  ARM fields to ON=installed and OFF=released on both stages. FLASH6 and stored
  records therefore do not need stage-specific polarity guesses.
- Stage-2 standby now rejects a missing magnet/high Hall input and fails closed
  through the existing safety-mode, ARM-lock, and inspection warning path.

## 0.9.2 — v6 b32 — 2026-07-22

Protocol: `Flash6-Intelligent-b7` (unchanged; ESP-NOW wire version `7`)

- Made a configured stage-2 board mission-inert unless two-stage operation is
  explicitly enabled. Countdown, ignition, mission standby, forced mission,
  stage-2 ARM monitoring, and built-in stage-2 actions are all gated together.
- Removed the unsafe fallback where a stage-2 node with two-stage operation
  disabled could be interpreted as a single-stage/stage-1 mission node.
- Disabling two-stage operation during an existing stage-2 countdown or
  mission now clears pending relay output and sequence state on the next tick.

## 0.9.1 — v6 b31 — 2026-07-22

Protocol: `Flash6-Intelligent-b7` (unchanged; ESP-NOW wire version `7`)

- Extended ARM contact-chatter monitoring from mission standby to every
  vehicle operating state. Three raw transitions inside one second now raise
  the existing high-risk inspection modal even while the board is idle.
- Pre-launch and post-flight chatter still fail closed by revoking inspection
  authority and enabling safety mode plus ARM lock. Chatter detected after T+
  is reported immediately without cancelling the active recovery sequence.
- Updated the FLASH6 warning copy so idle faults no longer claim they occurred
  during standby, while an in-flight fault clearly states that recovery logic
  remains active.
- Localized the built-in firmware mission-alarm titles and messages in FLASH6,
  including fixed-buffer truncation handling, so hardware alarms no longer
  expose English wire text in the Korean operator UI.

## 0.9.0 — v6 b30 — 2026-07-22

Protocol: `Flash6-Intelligent-b7` (ESP-NOW wire version `7`)

Compatibility: ground, stage 1, and stage 2 must all run wire version `7`.

- Rebuilt launch control around separate absolute, ignition, and mission
  sequences. A stable stage-1 physical ARM release now establishes T+ and
  transfers control to the mission immediately, including from automatic
  ignition standby.
- Added `WAITING_LAUNCH` after automatic ignition output. If stage-1 ARM is
  still not released after the configurable grace period, the firmware keeps
  monitoring but raises a high-risk launch-detection fault instead of
  fabricating T+.
- Added a 50 ms ARM debounce and a pre-launch chatter interlock. Repeated ARM
  transitions revoke mission authority, enable safety mode and ARM lock, and
  raise an inspection warning for the connector, sensor, and wiring.
- Stage 1 now separates at filtered coasting or the configurable T+ backup,
  commands SERVO CH1 to 80 degrees, and waits for confirmed stage-2 physical
  ARM release before the configurable SERVO CH2 ejection delay.
- Added a latched interstage-loss fallback: when stage 1 and stage 2 cannot
  communicate, stage-1 ejection is timed from separation instead of waiting
  indefinitely for the remote ARM event.
- Stage 2 now receives repeated idempotent standby, T+, separation, and ARM
  events directly from stage 1. With the link available, PYRO CH1 requires
  both stage-1 separation and stable local ARM release; with the link lost,
  sustained powered-flight acceleration establishes local T+ and local ARM
  release authorizes ignition.
- ABORT now propagates across the interstage link for one second using repeated
  sequence-scoped events, while the receiving board applies the stop locally
  without creating an event loop.
- Added configurable stage-1 separation backup, stage-1 ejection delay,
  stage-2 ejection delay, launch-detection grace, and interstage-link timeout.
  Values persist in NVS, synchronize from stage 1 to stage 2, and are included
  in A.I LINK telemetry so FLASH6 reviews the actual active-board settings.
- Added a FLASH6 pre-standby mission review, desktop/mobile layouts, explicit
  `WAITING LAUNCH` and `LAUNCH FAULT` status handling, and high-risk ARM-contact
  and launch-detection warnings. Existing deployment-state and flag meanings
  remain compatible with HUD, replay, storage reports, and exports.

## 0.8.23 — v6 b29 — 2026-07-22

Protocol: `Flash6-Intelligent-b6` (ESP-NOW wire version `6`)

- Added wired-ignition mission standby. The firmware keeps every pyro output
  off, waits for a physically armed stage-1 launch plus confirmed motion, and
  starts the onboard T+ clock at that detected launch timestamp.
- Rejected standby when the physical ARM input is already released, revoked
  mission inspection authority, enabled safety mode and ARM lock, and returned
  an explicit high-risk result to FLASH6.
- Added HTTP, USB serial, and reliable A.I LINK command 27 support for mission
  standby, with distinct ARM-unsafe and permission-denied ACK results.
- Added desktop and mobile mission-standby controls plus a stage-aware ARM-risk
  warning. The dashboard control card now opens as a compact drawer attached to
  the right navigation instead of occupying dashboard chart space.

## FLASH6 real-time replay catch-up b42 — 2026-07-21

Firmware build: `v6 b28` (unchanged)
Protocol: `Flash6-Intelligent-b5` (unchanged)

- Locked replay progress to wall-clock media time even when dense 200 Hz BIN
  records exceed the browser's per-sample rendering capacity.
- Coalesced already-due samples to a maximum display cadence of roughly 60 Hz
  instead of allowing an unbounded playback queue to run at about half speed.
- Preserved mission alarms contained in coalesced records and continued to
  forward the newest timestamped sample to board mission simulation.

## FLASH6 wall-clock replay scheduler b41 — 2026-07-21

Firmware build: `v6 b28` (unchanged)
Protocol: `Flash6-Intelligent-b5` (unchanged)

- Replaced chained relative replay timers with an absolute media deadline so
  chart and HUD processing time no longer accumulates into every sample gap.
- Rebased the media clock after pause, seek, restart, and playback-speed
  changes to avoid jumps while preserving the selected 0.5x/1x/2x/4x rate.
- Limited replay-only control redraws to roughly 30 Hz while continuing to
  consume and forward every recorded sample at its source timestamp cadence.

## FLASH6 replay file drag-and-drop b40 — 2026-07-21

Firmware build: `v6 b28` (unchanged)
Protocol: `Flash6-Intelligent-b5` (unchanged)

- Added drag-and-drop loading to the replay file picker while retaining the
  existing BIN, CSV, and XLSX parser and validation path.
- Added a restrained drop-target state so the modal clearly confirms when a
  desktop file can be released without changing the mobile picker layout.

## 0.8.22 — v6 b28 — 2026-07-21

Protocol: `Flash6-Intelligent-b5` (ESP-NOW wire version `5`, unchanged)

- Added an avionics-side response queue for windowed A.I LINK storage reads so
  a burst of requests no longer loses every reply received while ESP-NOW is
  still busy transmitting the previous packet.
- Kept queued storage replies ahead of telemetry and relay background traffic,
  while preserving the existing 8 KiB host chunk and eight-packet radio window.
- Retried the same validated offset from FLASH6 after transient remote chunk
  timeouts instead of aborting the entire BIN download on the first lost burst.
- Extended only the remote storage transaction deadline; flight telemetry,
  command timing, packet layout, and recorded data format are unchanged.

## 0.8.21 — v6 b27 — 2026-07-21

Protocol: `Flash6-Intelligent-b5` (ESP-NOW wire version `5`, unchanged)

- Read the ESP32-S3 ROM reset reason in addition to the high-level ESP-IDF
  reason so short supply interruptions reported as raw `POWER_GLITCH (23)` are
  no longer missed.
- Classified both `BROWNOUT (9)` and `POWER_GLITCH (23)` as power-fault
  restarts in FLASH6 while continuing to exclude ordinary `POWERON (1)`.
- Added the raw ROM reset code to boot and storage diagnostics without changing
  the A.I LINK packet layout.

## 0.8.20 — v6 b26 — 2026-07-21

Protocol: `Flash6-Intelligent-b5` (ESP-NOW wire version `5`)

- Added the ESP32 hardware reset reason and a per-boot session identifier to
  direct, serial, WebSocket, and A.I LINK telemetry.
- Propagated the avionics reset reason through the A.I LINK telemetry payload,
  allowing a ground station to distinguish a real brownout from a manual or
  normal restart after the vehicle reconnects.
- Added a one-time FLASH6 brownout warning modal that asks the operator to
  inspect battery voltage, connectors, wiring, and the regulator before
  resuming operation.
- Suppressed duplicate warnings for the same board boot session and excluded
  simulation, replay, software resets, and normal power-on resets.

## FLASH6 live storage critical alarm b36 — 2026-07-21

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Evaluated the sequence storage guard whenever local or relayed avionics
  storage telemetry changes, rather than only after an explicit status refresh
  or sequence-start attempt.
- Raised the persistent storage critical alarm once on transition into the
  70% lockout range and automatically cleared it when storage returns to a
  non-critical state.
- Added a dedicated `저장공간 상태` alarm title and suppressed live critical
  notifications during replay.

## FLASH6 top critical alert refinement b35 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Moved persistent critical alarms from the viewport center to the upper center.
- Removed the red edge rail and manual close control for a quieter warning
  surface that remains governed by alarm state.
- Placed the alarm title directly beside the `CRITICAL` label and simplified
  the remaining content hierarchy.

## FLASH6 critical alert routing correction b34 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Restored ordinary `error` notifications to the existing transient toast
  flow instead of promoting every failure to a persistent critical alarm.
- Marked the sequence storage lockout conditions explicitly as critical, while
  retaining persistent routing for alarms classified as critical by the alarm
  engine.

## FLASH6 compact centered critical alert b33 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Moved persistent critical alerts to the center of the viewport and reduced
  them to the same compact footprint as the existing warning toast.
- Removed the oversized signal, gradient, glow, and decorative warning rail;
  retained only a restrained red edge and `CRITICAL` label.

## FLASH6 critical alert routing fix b32 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Routed legacy `error` notifications into the persistent critical alert rail
  in addition to explicit `critical` alarms.
- Added lazy creation of the critical alert container so early runtime errors
  cannot be lost during the initial DOM binding window.

## FLASH6 persistent critical alert rail b31 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Routed critical alarms out of the transient toast queue into a persistent,
  top-right warning rail with a dedicated high-visibility design.
- Kept critical alerts visible until the alarm clears or the operator closes
  them, including while dialogs and alternate views are open.
- Deduplicated repeated critical alarms by key and updated the existing alert
  with an occurrence count.

## FLASH6 servo modal density pass b30 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Matched the servo modal to the compact pyro modal frame on desktop, narrow
  desktop windows, and touch devices.
- Replaced the mobile channel drop-down with the same clear PWM tab selector
  used on desktop.
- Removed the oversized active-servo card in favor of one divider and bounded
  internal scrolling without changing servo commands.

## FLASH6 pyro modal note alignment b29 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Centered the pyro safety note below the action button without changing the
  modal control layout.

## FLASH6 pyro modal density pass b28 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Removed the oversized nested CH1/CH2 control card and safety-note box from
  the pyro modal.
- Replaced stacked borders with one divider, tighter spacing, and a narrower
  desktop dialog while keeping the existing safety action flow unchanged.

## FLASH6 pyro modal responsive fix b27 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Kept the desktop pyro control modal centered when a desktop window is narrow
  instead of switching it to the touch bottom-sheet layout.
- Added bounded internal scrolling so the channel, duration, presets, action,
  and safety note are never clipped by the viewport.
- Restored an unambiguous selected state for CH1/CH2 on desktop and touch
  layouts.

## FLASH6 UI runtime structure b26 — 2026-07-20

Firmware build: `v6 b25` (unchanged)
Protocol: `Flash6-Intelligent-b4` (unchanged)

- Replaced the 1.7 MB monolithic dashboard runtime with an ordered classic
  script manifest and 15 responsibility-based modules covering state, views,
  charts/replay, protocol decoding, transports, telemetry, storage, polling,
  mission, hardware, reports, commands, and bootstrap.
- Added a shared `window.Flash6` lifecycle scope and telemetry store. Global
  listeners, periodic network/status jobs, and the polling loop now have
  explicit cleanup ownership without changing the board API or telemetry
  schema.
- Added a generated single-request runtime bundle for normal static/native/AP
  delivery. Direct module mode remains available for diagnostics and starts
  transfers together while retaining manifest-order execution.
- Split stylesheet sources into four ordered layers while retaining one
  generated `styles/flash6.css` request for the ESP32 AP and native wrapper.
- Moved the non-critical boot watchdog out of HTML, removed the remaining
  inline DOM event handler, and removed nonexistent legacy runtime fallback
  candidates.
- Added repeatable runtime/CSS structure checks and synchronized the packaged
  native web runtime.

## 0.8.19 — v6 b25 — 2026-07-20

Protocol: `Flash6-Intelligent-b4` (ESP-NOW wire version `4`, unchanged)

- Replaced the recovery beacon's single 4 kHz cadence with a repeating
  three-tone 1.8/2.3/2.8 kHz pattern that is easier to hear and identify.
- Kept long tone-on periods, short inter-tone gaps, and the PWM driver's
  existing maximum 50% square-wave duty so the average acoustic output remains
  high without blocking telemetry, storage, or mission processing.

## 0.8.18 — v6 b24 — 2026-07-20

Protocol: `Flash6-Intelligent-b4` (ESP-NOW wire version `4`, unchanged)

- Added a firmware-owned forced timed mission command over HTTP, USB serial,
  and A.I LINK. It creates a virtual T+ clock without energizing either pyro
  output, then drives the built-in deployment servos at CH1 T+2.0 seconds and
  CH2 T+3.0 seconds.
- The command is rejected while Safety Mode or another sequence is active.
  ABORT/STOP now also clears the pending built-in deployment runtime so a
  cancelled timed test cannot actuate a servo later.
- Added deployment telemetry flag bit 7 and mission alarms to identify a
  forced timed run in live telemetry and stored flight records.

## 0.8.17 — v6 b23 — 2026-07-20

Protocol: `Flash6-Intelligent-b4` (ESP-NOW wire version `4`, unchanged)

- Added a dedicated recovery finding-beacon pattern at the piezo's measured
  peak acoustic band near 4 kHz.
- Start the repeating two-short/one-long recovery beacon immediately after
  the CH2 servo deployment command and its mission event are recorded. The
  pattern runs asynchronously, so flight-state, telemetry, and storage work
  remain uninterrupted.

## 0.8.16 — v6 b22 — 2026-07-20

Protocol: `Flash6-Intelligent-b4` (ESP-NOW wire version `4`, unchanged)

- Declared the onboard launch/deployment sequence as the authoritative built-in
  mission and disabled loading or executing user-authored runtime blocks, so a
  stored block profile cannot overlap CH1/CH2 deployment commands.
- Rejected mission-profile writes over both HTTP and USB serial with an
  explicit firmware-lock result. Existing profile data remains untouched but
  is never armed by this firmware build.
- Added mission capability metadata to HTTP profile/telemetry responses and
  the serial settings handshake. Desktop and native-mobile UIs now show the
  built-in-mission notice and disable block, metadata, import, and save edits.
- Replaced the desktop dock's countdown shortcut with a storage shortcut,
  grouped beside the launcher controls and wired directly to the storage
  record browser.

## 0.8.15 — v6 b21 — 2026-07-20

Protocol: `Flash6-Intelligent-b4` (ESP-NOW wire version `4`, unchanged)

- Replaced the raw-sample burnout gate with a clipped 60 ms low-pass
  acceleration magnitude, 0.55/0.85 G Schmitt hysteresis, a 900 ms minimum
  powered-flight interval, and a 140 ms confirmation hold. A single vibration
  spike can no longer restart the complete burnout delay.
- Separated the causal 320 ms barometric slope used for apogee detection from
  the 450 ms display velocity and the UI report's existing 2.4 s trend.
- Replaced the inherently slow 2 m plus 500 ms descent gate with a
  multi-condition apogee confirmation: no recent peak update, at least 0.45 m
  below the recorded peak, fast vertical speed below -0.55 m/s, Schmitt
  release thresholds, and a 140 ms hold.
- Kept the T+2.0 primary and delayed-secondary deployment timers independent
  from the phase detector so missed sensor detections still retain the
  existing backup path.
- Added storage record V5 diagnostics for raw and filtered acceleration,
  fast and display vertical speed, recent apogee, coast/descent hold time,
  transition reason/time, and deployment backup flags. V1 through V4 BIN
  replay remains supported.
- Added deterministic regression scenarios covering nominal burnout with
  vibration, launch-like impact without flight, missing ignition, and a
  transient pressure dip during ascent.

## 0.8.14 — v6 b20 — 2026-07-20

Protocol: `Flash6-Intelligent-b4` (ESP-NOW wire version `4`, unchanged)

- Added an exclusive A.I LINK storage-transfer mode. While a wireless BIN read
  is active, avionics, relay, and ground nodes stop periodic telemetry,
  heartbeat, discovery, USB JSON, and WebSocket JSON output so ESP-NOW airtime
  and CPU time are reserved for storage requests, responses, and relay frames.
- Increased the remote storage pipeline from four to eight simultaneous
  192-byte radio reads and reduced the per-frame retry interval from 70 ms to
  45 ms. Host-side 8 KiB aggregates and all wire packet layouts remain
  unchanged.
- Separated transport liveness from telemetry freshness so intentionally
  paused telemetry no longer clears an active storage transfer after 1.5
  seconds. A transport is now removed only after its existing six-second peer
  timeout.
- Added route hysteresis: failed relay paths fall back immediately, while a
  recovered relay must remain healthy for 1.2 seconds before becoming primary
  again. Storage responses refresh route health even while telemetry is
  intentionally silent.
- Added a smoothed-throughput ETA to the locked storage-download progress
  dialog, with calculating, transfer-complete, and interrupted states.

## 0.8.13 — v6 b19 — 2026-07-20

Protocol: `Flash6-Intelligent-b4` (ESP-NOW wire version `4`, unchanged)

- Appended authoritative board operation-mode and displayed data-mode fields
  to the backward-compatible compact USB/WebSocket telemetry tail.
- Fixed disconnected avionics A.I LINK boards being decoded as FLIGHT or DAQ
  after a browser refresh even though their persisted operation mode remained
  `flash_link`.
- Updated desktop and native-mobile decoders to use the explicit b19 fields
  while retaining the legacy b18 frame layout as a compatibility fallback.

## 0.8.12 — v6 b18 — 2026-07-17

Protocol: `Flash6-Intelligent-b4` (wire version `4`)

- Added A.I LINK command `25` for a targeted avionics reboot.
- Changed HTTP and USB serial `/reset` handling on a ground-role board to
  forward the reboot to the selected avionics node instead of restarting the
  ground station.
- Made the reboot command urgent and delayed the avionics restart by 450 ms so
  its completion ACK can leave the radio before shutdown.
- Prevented the UI from closing the ground WebSocket while remote avionics
  reboots, and prevented duplicate serial-plus-HTTP reboot submissions.
- Rebuilt the desktop reboot confirmation as a compact cockpit dialog while
  keeping the mobile modal styling independent.
- Published the `FLASH6` web application at the `flash6.kro.kr` domain root
  through a dedicated GitHub Pages workflow instead of the repository root.
- Added commit-specific browser asset versions and moved interface preferences
  to settings schema `v3`, preventing stale light-theme CSS and legacy
  dashboard modes from overriding the current local UI after deployment.
- Refined the desktop entry screen with a quieter live-status label.
- Removed the entry-screen brand hero and centered the avionics connection
  card as the only primary surface.
- Replaced the entry action with an icon-free `보드 연결` button that changes
  to `시작하기` after a verified link, keeping the entry screen visible until
  the operator explicitly opens the dashboard.
- Kept entry-screen Wi-Fi discovery concurrent while allowing 1.2 seconds for
  the first board ping, preventing false failures while the AP route and ARP
  cache are still settling.
- Preserved the browser's required user gesture for first-time Web Serial
  permission by opening the explicit USB connection step when no previously
  authorized board is available.
- Prefer Espressif ESP32-S3 native USB/JTAG serial devices when multiple
  previously authorized serial ports exist, instead of selecting an unrelated
  port by browser enumeration order.
- Extended the verified-link handoff window to 30 seconds so the `시작하기`
  action remains available while WebSocket telemetry finishes connecting.
- Made board-mode switching transactional: the UI now commits DAQ, FLIGHT, or
  A.I LINK state only after the board ACK or post-restart telemetry confirms
  the requested `OP_MODE`.
- Prevented repeated mode-toggle submissions while a change is in flight,
  preserved the last confirmed UI mode when a command fails, and added an
  eight-second telemetry grace period for the board restart window.
- Allowed communication-mode configuration during a latched relay lockout
  while keeping all hazardous control commands blocked.

## 0.8.11 — v6 b17 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Increased local and A.I LINK USB-serial storage aggregates to 8 KiB while
  continuing to accept the smaller chunks returned by older firmware and the
  HTTP fallback.
- Increased the A.I LINK storage request window from three to four packets and
  removed the unnecessary global retry gap between independent in-flight
  reads.
- Temporarily reduced avionics telemetry from 100 Hz to 20 Hz only while a
  storage read is active, preserving link freshness while prioritizing binary
  transfer airtime.
- Paused ground USB telemetry during A.I LINK downloads and restored it after
  completion, so Base64 data no longer competes with 100 Hz JSON frames.
- Removed Base64 payloads and per-chunk commands from the browser log hot path,
  replaced regex-wide chunk parsing with fixed-field parsing, and assembled the
  output in one preallocated buffer.
- Flushes local W25Q queued records once per contiguous export instead of once
  per chunk. ESP-NOW packet fields, serial command/response fields, and storage
  record layout remain unchanged.

## 0.8.10 — v6 b16 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Fixed the USB-serial SPI Flash download encoder capacity passed to mbedTLS,
  which previously rejected exact-size 1,024-byte remote chunks with
  `SPI_FLASH_REMOTE_CHUNK B64_FAILED`.
- Applied the same boundary fix to direct-board serial Flash downloads so
  full-size 1,536-byte chunks remain valid.
- Kept the wire protocol, storage record layout, and download response format
  unchanged.

## 0.8.9 — v6 b15 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Added a USB-serial proxy for A.I LINK storage session listing and binary
  reads, removing the hidden dependency on the PC being connected to the
  ground station Wi-Fi AP.
- Kept ESP-NOW RX/TX service running while a loop-task serial storage request
  waits, so its wireless response can be consumed without a self-deadlock.
- Made the storage UI prefer the active Web Serial transport for remote lists
  and downloads, matching the rest of the ground-station control path.

## 0.8.8 — v6 b14 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Queued A.I LINK storage-list responses ahead of 100 Hz telemetry so a busy
  ESP-NOW transmitter no longer drops the response that backs the storage UI.
- Added bounded automatic list retries in the UI and cleared transient error
  state as soon as a later response succeeds.
- Replaced the stale dual-board firmware warning with retry progress and a
  single A.I LINK diagnostic that also matches one-stage operation.

## 0.8.7 — v6 b13 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Appended per-stage receive rate, chip temperature, loop time, and CPU time to
  the browser stream's stage snapshots without changing the ESP-NOW packet.
- Moved LINK, CHIP, PERF, and power availability into the corresponding STAGE
  1/STAGE 2 dashboard cards and removed the ambiguous shared status strip while
  dual-stage telemetry is displayed.

## 0.8.6 — v6 b12 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Reused the IMU acceleration magnitude already computed by the 200 Hz sampler
  and restricted accelerometer roll/pitch trigonometry to attitude startup.
- Removed the redundant sample-record zero-fill while preserving every field
  assignment and CRC, eliminating 17.2 KiB/s of queue memory writes.
- Cached slow-changing GPS, chip-temperature, and peer-MAC text used by the
  100 Hz stream without changing its array layout or serialized values.
- Separated 100 Hz telemetry ingestion from UI rendering, cached dual-stage DOM
  nodes, and skipped unchanged text/class writes while retaining every raw
  sample, event, chart history, and report row.
- Removed one full top-level object copy from the single-stage fallback path and
  changed Web Serial chunk parsing from repeated tail slicing to one final trim.
- Added a deterministic hot-path benchmark and hardware A/B measurement guide
  in `benchmarks/performance_hotpaths.mjs` and `PERFORMANCE.md`.

## 0.8.5 — v6 b11 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Kept stage-1 radio and USB telemetry at 100 Hz while removing the duplicate
  stage-1 tail snapshot; the top-level sample already carries the same data.
- Reduced the active USB CDC transmit queue from 16 KiB to 4 KiB so temporary
  host backpressure cannot turn into roughly one second of stale attitude.
- Sized each USB telemetry write from its actual serialized length and reserved
  512 bytes for control replies, allowing button ACK/ERR messages to bypass
  telemetry pressure without blocking the control loop.
- Coalesced USB telemetry in the browser to the newest sample per display frame,
  keeping the gyro preview current while ACK parsing stays independent of heavy
  map and chart rendering.

## 0.8.4 — v6 b10 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Split USB control handling into immediate ground-node queue receipt and later
  avionics execution confirmation, so a valid in-flight command no longer
  reports a false serial timeout.
- Removed the 700 ms duplicate safety/ARM retransmission from the UI and keep a
  successfully written request pending for telemetry or completion-ACK
  confirmation.
- Suppressed identical safety/ARM transactions that are already on the radio
  queue while still allowing a newer opposite-state request to follow them.
- Prioritized command completion ACKs ahead of relay telemetry and enriched the
  USB queue receipt with command code and requested value for precise matching.
- Treat matching remote safety/ARM telemetry as authoritative completion when
  the dedicated radio ACK is lost, eliminating an error after the requested
  state has already been applied.
- Removed the obsolete desktop navigation expansion timer and chart reflow
  hooks that shifted the page for 900 ms after every dock-button click.

## 0.8.3 — v6 b9 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Kept USB safety-mode and ARM-lock requests open until the avionics execution
  acknowledgement arrives instead of treating the ground queue receipt as the
  final result.
- Added one bounded serial retry and applied a matching completion ACK directly
  to the control UI, removing dependence on a later telemetry frame.
- Promoted safety-mode and ARM-lock commands ahead of unsent background work in
  the radio queue while preserving the queue head for any in-flight ACK.
- Coalesced unsent state toggles to the newest operator value and now reports an
  explicit serial error if a state command exhausts its radio retries.
- Stabilized map wheel zoom and fullscreen expansion by preserving the map
  center, batching tile updates, and removing repeated forced redraw/recenter
  passes that discarded already loaded tiles.
- Delayed map-offline fallback until a complete slow tile cycle has had time to
  settle, preventing normal zoom transitions from flashing the fallback map.

## 0.8.2 — v6 b8 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Added explicit USB serial completion acknowledgements when remote safety-mode
  and ARM-lock commands have actually executed on the avionics node.
- Prevented stale 100 Hz telemetry frames from immediately reverting safety and
  ARM controls while their USB/AIL commands are still awaiting confirmation.
- Made the UI restore the last confirmed board value on transport failure or
  confirmation timeout instead of leaving a false optimistic state.
- Made gyro zero and intelligent calibration stay on the selected serial
  transport and report disconnected/TX-disabled states instead of silently
  falling through to HTTP.
- Extended gyro-zero acknowledgement time for the ground-to-avionics relay path.
- Made the desktop dashboard open directly into the full gyro 3D preview and
  reserved `Shift+C` for toggling the camera canvas on demand.
- Stopped hidden camera capture while the gyro dashboard is active and placed
  the live flight map above the altitude and dynamics charts in one taller,
  equal-height data rail.
- Enabled direct click-drag camera movement in the default gyro scene and
  removed the old click-to-open gyro-only transition from the preview surface.
- Extended the gyro dashboard zoom-in range and temporarily holds manual wheel
  zoom before returning to automatic trajectory framing.
- Kept the map and both telemetry charts fixed as one rail when the floating
  navigation dock is hovered or focused.
- Preserved the rocket 3MF's four source material tones in the gyro renderer
  and added restrained CFRP satin and edge response so fins, rings, fasteners,
  and stage joints remain visible without washing the vehicle into flat gray.

## 0.8.1 — v6 b7 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Fixed AIL ground-to-avionics activation when operation mode, board role,
  node ID, stage-2 mode, and avionics data mode are applied in one request.
- Communication configuration requests are now handled atomically as local
  board settings instead of deciding remote forwarding from the board's old
  role and failing after the role changes mid-request.
- Applied the same routing fix to HTTP and USB serial `/set` paths.
- Kept the desktop navigation rail visible when `Shift+C` toggles the camera
  3D+ view, and constrained the canvas to the remaining dashboard width.

## 0.8.0 — v6 b6 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Added a persistent 2-stage operation toggle. The new default is stage-1-only
  for the revised launch plan; the existing relay/direct-backup topology remains
  available when the toggle is enabled.
- Raised stage-1-only ESP-NOW telemetry, ground WebSocket, and ground USB
  telemetry from 50 Hz to 100 Hz. Dual-stage mode remains at 50 Hz per node.
- Advertised the network mode through the existing discovery capability byte so
  stage 1 follows the ground setting automatically without a separate selector.
- Disabled stage-2 discovery, relay queues, direct-backup servicing, peer scans,
  and UI snapshot generation in stage-1-only mode.
- Dropped disabled stage-2 frames before the firmware RX queue and kept telemetry
  ACK airtime fixed at five acknowledgements per second (20 frames at 100 Hz,
  10 frames at 50 Hz).
- Updated Flash6 settings, link status, rate alarms, active-stage behavior, and
  topology details for both network modes.

## 0.7.1 — v6 b5 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`, unchanged)

- Removed manual stage targeting from desktop, settings, mobile controls, and
  the mobile target-selection dialog.
- Added automatic active-stage selection: stage 1 before separation, stage 2
  after confirmed separation or when stage-1 telemetry is lost.
- Reduced relay-to-direct failover detection from 1.2 s to 650 ms.
- Cancelled stale commands and remote-storage requests when the active stage
  changes so an unavailable node cannot block subsequent control traffic.
- Forced the newly active stage quaternion into the gyro preview immediately
  on an automatic switch.

## 0.7.0 — v6 b4 — 2026-07-17

Protocol: `Flash6-Intelligent-b3` (wire version `3`)

Compatibility: ground, stage 1, and stage 2 must all run wire version `3`.

- Added a direct encrypted stage-2-to-ground standby link.
- Kept stage 2 → stage 1 → ground as the primary telemetry and control route.
- Added automatic direct fallback after the primary route is stale for 1.2 s,
  with automatic return to the relay after recovery.
- Added per-path direct/relay state, RSSI, freshness, command retry routing, and
  cross-path telemetry deduplication at the ground node.
- Kept direct standby traffic to Hello, ACK, and heartbeat frames during normal
  operation so telemetry is not transmitted twice.
- Updated the Flash6 communication topology view and protocol metadata for the
  primary and backup routes.

## 0.6.1 — v6 b3 — 2026-07-17

Protocol: `Flash6-Intelligent-b2` (wire version `2`)

- Optimized the ESP-NOW receive and stage-relay queues by replacing delayed
  telemetry with the newest sample under backlog.
- Reduced hot-path storage overhead with batched NOR writes, pipelined remote
  reads, and faster validated flash-bus operation.
- Added independent stage-1/stage-2 ground state and selected-stage routing.
