# FLASH6 code map

Use this map before opening a large file.

| Area | Source file |
| --- | --- |
| Page markup and DAQ panels | `flash6.html` |
| DAQ mock state, sequence, event log | `scripts/flash6-shell.js` |
| DOM bindings and button events | `scripts/flash6-bootstrap.js` |
| Control center and view state | `scripts/flash6-views.js` |
| Telemetry processing | `scripts/flash6-telemetry.js` |
| Storage and replay data | `scripts/flash6-storage.js`, `scripts/flash6-charts-replay.js` |
| DAQ and component styles | `styles/src/03-components.css` |
| Global consistency and control center styles | `styles/src/04-consistency.css` |

Generated outputs:

- `flash6.runtime.js` is built from `scripts/flash6-*.js`.
- `styles/flash6-app.css` is built from `styles/src/*.css`.
- Never patch generated outputs directly.

For DAQ work, search the `daq-` class or the exact element ID first. Read only a small matching range, edit the source, rebuild, and run the runtime checker.
