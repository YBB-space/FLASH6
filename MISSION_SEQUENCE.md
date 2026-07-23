# FLASH6 Built-in Mission Sequence

Firmware `0.9.4` / build `v6 b34` / protocol `Flash6-Intelligent-b8`

## Sequence authority

Control priority is safety/abort, ignition sequence, mission sequence, then
manual control. A stable stage-1 physical ARM release is the authoritative
launch event: it establishes absolute T+0, turns off any remaining ignition
output, and transfers control to the mission sequence immediately.

Automatic ignition runs the configured T- countdown and PYRO output. If its
output ends before stage-1 ARM release, the board enters `WAITING_LAUNCH`. It
continues watching ARM; after the configured grace period it raises a launch
detection fault without inventing a launch timestamp. A later valid ARM release
still establishes T+.

Wired ignition bypasses automatic ignition. The operator enters mission
standby from FLASH6, reviews the settings stored on the active avionics board,
and the same stage-1 ARM release rule starts T+.

## Stage 1

1. Enter standby only while physical ARM is ON and safety/inspection permits.
2. Stable ARM ON-to-OFF establishes T+ and is repeated to stage 2.
3. Filtered coasting or the configured T+ backup commands SERVO CH1 to the
   configured stage-1 separation angle (default 80°).
4. With a healthy interstage link, wait for stable stage-2 ARM release, then
   wait the configured stage-1 ejection delay and command SERVO CH2 to the
   configured stage-1 ejection angle (default 80°).
5. If the interstage link is continuously stale for the configured timeout,
   latch fallback and command SERVO CH2 after the same delay measured from
   stage-1 separation. Link recovery does not undo the latched fallback.

## Stage 2

1. Receive standby and the active mission settings from stage 1.
2. Receive repeated T+ and stage-1 separation events.
3. Treat the Hall input as LOW while the separation magnet is near and the
   mechanism is installed. A debounced LOW-to-HIGH transition means the magnet
   has departed and stage-2 separation is confirmed.
4. When both stage-1 separation and this stable local Hall separation are
   present, start PYRO CH1 immediately for the configured ignition duration.
5. After the configured stage-2 ejection delay, command SERVO CH1 to the
   configured stage-2 ejection angle (default 0°).
6. If the stage-1 link is lost, sustained powered-flight acceleration provides
   a local T+ backup. In that fallback only, stable local ARM release replaces
   the missing remote separation event and authorizes ignition.

## Safety interlocks

- A standby request with the release mechanism already open is rejected. This
  means raw LOW on stage 1 and raw HIGH on the stage-2 Hall input. Safety mode
  and ARM lock are enabled and inspection authority is revoked.
- Telemetry and stored records remain role-normalized: physical ARM ON means
  installed and OFF means released on both stages, regardless of pin polarity.
- Three raw ARM transitions inside one second before T+ are treated as contact
  chatter. Mission authority is revoked and connector/sensor/wiring inspection
  is required.
- ARM bounce cannot return a latched T+ to standby or idle.
- Interstage mission events are idempotent and retransmitted while relevant.
- ABORT is sequence-scoped and repeated across the interstage link for one
  second; both boards shut down local outputs without echoing an event loop.
- The built-in mission remains locked against UI block-code replacement.

## Persistent mission settings

- Stage-1 separation backup: 500–15000 ms, default 2000 ms
- Stage-1 ejection delay: 100–10000 ms, default 1000 ms
- Stage-2 ejection delay: 500–30000 ms, default 5000 ms
- Launch-detection grace: 1000–30000 ms, default 5000 ms
- Interstage link-loss threshold: 200–5000 ms, default 500 ms
- Stage-1 separation angle: 0–180°, default 80°
- Stage-1 ejection angle: 0–180°, default 80°
- Stage-2 ejection angle: 0–180°, default 0°
