# FLASH6 UI Structure

FLASH6 is the external dashboard source, not a firmware payload.
The ESP32 firmware exposes telemetry/control APIs, while this UI runs from the browser/dev host or from the native app wrapper.

## Runtime files

- `flash6.html` - document shell, boot scripts, and dashboard markup.
- `flash6.js` - lightweight classic-script manifest loader. It owns the shared
  `window.Flash6` runtime, application lifecycle scope, telemetry store, and
  ordered module loading.
- `flash6.runtime.js` - generated single-request deployment bundle. Run
  `node scripts/build-flash6-runtime.cjs` after changing a runtime source
  module.
- `scripts/flash6-i18n.js` - translation table loaded before the runtime.
- `scripts/flash6-zip.js` - shared ZIP readers for 3MF preview and XLSX replay import.
- `scripts/flash6-mesh.js` - pure STL/3MF mesh parsers for 3D previews.
- `scripts/flash6-export.js` - pure ZIP/XLSX builders used by report exports.
- `scripts/flash6-core.js` - shared state, numerical helpers, alarms, and 3D
  attitude/trajectory foundations.
- `scripts/flash6-shell.js` - screen, modal, map, settings, and shell-level UI
  behavior.
- `scripts/flash6-views.js` - shared view rendering and DOM presentation
  helpers.
- `scripts/flash6-charts-replay.js` - chart rendering, replay parsing, and replay
  navigation.
- `scripts/flash6-protocol.js` - wire-frame and stage-snapshot decoders.
- `scripts/flash6-transport.js` - WebSocket, HTTP fallback, and WebSerial
  transports.
- `scripts/flash6-telemetry.js` - the single incoming-sample pipeline and derived
  telemetry publication.
- `scripts/flash6-storage.js` - browser recording plus local/remote avionics
  storage listing, reset, and download flows.
- `scripts/flash6-polling.js` - fallback telemetry polling loop.
- `scripts/flash6-interactions.js` - touch, hold, and sequence confirmation
  interactions.
- `scripts/flash6-mission.js` - settings and mission authoring/runtime controls.
- `scripts/flash6-hardware.js` - hardware status, calibration, and control
  features.
- `scripts/flash6-report.js` - report, workbook, and document export runtime.
- `scripts/flash6-command.js` - shared command normalization, safety gating, and
  Serial/HTTP command routing.
- `scripts/flash6-bootstrap.js` - DOM binding and ordered application startup.
- `scripts/flash6-watchdog.js` - boot failure guard and fallback connectivity
  probe.
- `styles/src/` - ordered stylesheet source layers.
- `styles/flash6.css` - generated single-request application stylesheet. Run
  `node scripts/build-flash6-css.cjs` after editing a source layer.
- `overlay.html` - standalone overlay/streaming view.
- `manifest.webmanifest` - app metadata for browser/native wrapper previews.

## Runtime order

`flash6.js` loads the generated runtime bundle by default. Adding
`?runtime_modules=1` to the page URL loads the source modules directly for
diagnosis; those requests start together but execute in manifest order. Do not
reorder the source list casually: the classic-script global lexical
environment is part of the current compatibility contract for local files,
static hosting, the ESP32 AP, and the Capacitor wrapper.

All live input transports decode into the same `onIncomingSample` pipeline.
Current telemetry is also published through `window.Flash6.telemetryStore` so
new views can subscribe without adding more work directly to the transport
handlers.

Application-lifetime listeners and intervals should be registered through
`window.Flash6.appScope`. Feature-specific temporary resources should use a
dedicated scope created with `window.Flash6.createScope(name)` and dispose it
when the view closes.

## Checks

- `node scripts/check-flash6-runtime.cjs` validates manifest order, combined
  JavaScript parsing, generated runtime/CSS freshness, watchdog wiring, and the
  absence of inline DOM handlers.
- `node scripts/benchmark-flash6-runtime.cjs 25` reports repeatable median and
  p95 parser cost for the manifest, combined runtime, and individual modules.
- Browser regression should cover HTTP/static hosting, direct `file://`
  preview, a mobile viewport, and at least one simulator sample before
  packaging.

## Assets

- `img/`, `mp3/`, `3d/`, `tiles/`, `vendor/` are runtime asset folders.
- `vendor/leaflet/` is intentionally vendored for offline map support.

## App wrappers

- `mobile_app_native/` is the Capacitor native wrapper. Treat `www/` as a packaged copy of the web runtime, and sync it from the root runtime files before native packaging.
- `mobile_app_native/build/` is generated output and should not be kept in source.

## Cleanup policy

- Delete OS/editor artifacts such as `.DS_Store`, `.textClipping`, and accidental `* 2.*` duplicate files.
- Do not remove `old.html` until its behavior has been checked against the current dashboard.
- Prefer adding new UI modules under `scripts/` or `styles/` instead of growing `flash6.html`.
- Keep split runtime files loadable without ES modules so local preview, static hosts, and native wrappers can all use the same files.
- Do not edit generated `styles/flash6.css` directly. Edit the matching ordered
  layer in `styles/src/`, rebuild it, and keep the generated file committed for
  one-request AP delivery.
- Do not edit generated `flash6.runtime.js` directly. Edit the responsibility
  module under `scripts/`, rebuild it, and keep the generated bundle committed
  for one-request delivery.
- Keep transport-specific parsing out of views. Decode in `flash6-protocol.js`,
  route in `flash6-transport.js`/`flash6-command.js`, publish in
  `flash6-telemetry.js`, and render from the resulting state.
