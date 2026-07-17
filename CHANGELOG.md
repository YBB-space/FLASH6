# ALTIS INTELLIGENT3 Firmware Changelog

Firmware, build, and wire-protocol version changes are recorded here in the
same commit that changes the corresponding constants in `src/firmware/state.h`.

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
