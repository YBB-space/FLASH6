# ALTIS INTELLIGENT3 Firmware Changelog

Firmware, build, and wire-protocol version changes are recorded here in the
same commit that changes the corresponding constants in `src/firmware/state.h`.

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
