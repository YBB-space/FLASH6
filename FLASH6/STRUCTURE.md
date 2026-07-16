# FLASH6 UI Structure

FLASH6 is the external dashboard source, not a firmware payload.
The ESP32 firmware exposes telemetry/control APIs, while this UI runs from the browser/dev host or from the native app wrapper.

## Runtime files

- `flash6.html` - document shell, boot scripts, and dashboard markup.
- `flash6.js` - dashboard application runtime. This is still the main split target.
- `scripts/flash6-i18n.js` - translation table loaded before the runtime.
- `scripts/flash6-zip.js` - shared ZIP readers for 3MF preview and XLSX replay import.
- `scripts/flash6-mesh.js` - pure STL/3MF mesh parsers for 3D previews.
- `scripts/flash6-export.js` - pure ZIP/XLSX builders used by report exports.
- `styles/flash6.css` - extracted application CSS, preserving the original cascade order.
- `overlay.html` - standalone overlay/streaming view.
- `manifest.webmanifest` - app metadata for browser/native wrapper previews.

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
