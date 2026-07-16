# ALTIS INTELLIGENT3 Firmware Changelog

Firmware, build, and wire-protocol version changes are recorded here in the
same commit that changes the corresponding constants in `src/firmware/state.h`.

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
