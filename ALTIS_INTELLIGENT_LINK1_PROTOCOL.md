# ALTIS INTELLIGENT LINK1

ALTIS INTELLIGENT LINK1 is the ESP-NOW transport used by one ground board and up
to two Altis Intelligent 3 avionics boards. Avionics nodes are identified as
`stage 1` and `stage 2`.

## Radio Profile

- ESP-NOW, 2.4 GHz
- Fixed channel: 6
- ESP-NOW PHY rate: 1M_L
- Telemetry target: 50 Hz per avionics node
- Primary peer topology: stage 2 ↔ stage 1 ↔ ground. Stage 1 is the encrypted
  radio relay and is always preferred by stage 2.
- Backup peer topology: stage 2 ↔ ground. This direct encrypted link remains on
  standby and carries vehicle traffic only while the primary relay is stale.
- Ground board: Wi-Fi AP and ESP-NOW share channel 6
- Avionics board: ESP-NOW station interface only; no Wi-Fi AP

## Pairing

1. Unpaired nodes broadcast a discovery packet every 250 ms.
2. The ground board accepts stage 1 and a standby direct stage-2 peer, while
   stage 1 separately accepts stage 2 as the primary route.
3. Stage 1 preserves the stage 2 source/session fields while forwarding its
   packets, so the ground board maintains independent virtual stage slots.
4. Stage 2 keeps the direct-ground route warm with Hello/ACK/heartbeat traffic,
   but sends telemetry through stage 1 while the relay is fresh.
5. Short telemetry gaps retain the peer and last remote sample for 1.5 seconds.
6. A peer is discarded after 6 seconds without received traffic or a successful
   unicast MAC acknowledgement, then discovery starts again.

Discovery is broadcast and unencrypted. Telemetry, hello, heartbeat, and ACK
packets are encrypted unicast packets using the ALTIS INTELLIGENT LINK1 PMK/LMK.

## Frame

All multibyte values use the ESP32 little-endian representation.

| Field | Size |
| --- | ---: |
| Magic `FLK1` | 4 |
| Protocol version | 1 |
| Packet type | 1 |
| Sender role | 1 |
| Flags | 1 |
| Boot session ID | 4 |
| Packet sequence | 4 |
| ACK sequence | 4 |
| Payload size | 2 |
| CRC16-CCITT | 2 |

The packed header is 24 bytes. The current wire protocol value is `3`; the
version field itself occupies one byte. The current telemetry frame is 133 bytes total, below the
ESP-NOW v1 payload limit of 250 bytes.

Header `flags & 0x03` carries the sender node ID: `0` for ground, `1` for stage 1,
and `2` for stage 2. Bits `2..3` carry the target node ID and bit `7` marks a
stage-1-relayed frame. A legacy avionics sender with node ID `0` is treated as
stage 1 by the ground firmware.

Packet types:

- `1`: discovery
- `2`: hello
- `3`: telemetry
- `4`: ACK
- `5`: heartbeat
- `6`: control command
- `7`: control command ACK
- `8`: storage status
- `9`: storage read request
- `10`: storage read response
- `11`: mission alarm detail
- `12`: storage session-list request
- `13`: storage session-list response

## Telemetry Policy

Telemetry uses a dedicated sequence number, independent from discovery and
heartbeat traffic. The ground board calculates actual missing telemetry frames
from this sequence.

The UI stream appends GPS clock metadata after the stable 53-field compact frame:
`gps_time_valid` and `gps_utc_ms`. Older decoders can ignore these trailing
fields.

The ground board ACKs every 10 telemetry frames per stage. Telemetry is not retransmitted:
the newest state is more valuable than a delayed old state. Send
failures, sequence gaps, duplicate frames, CRC failures, queue drops, receive
rate, and peer age are tracked separately.

Receive and relay queues coalesce delayed telemetry by source stage once a
backlog forms. Commands, command ACKs, alarms, discovery, and storage packets
remain ordered; only an older unsent telemetry snapshot can be replaced by a
newer snapshot from the same stage. This bounds UI latency during radio bursts.

Stage 2 uses only one telemetry uplink at a time. The stage-1 relay is the
primary route. If no primary-route packet is received for 1.2 seconds, stage 2
switches telemetry to its direct-ground standby before the 1.5-second telemetry
stale deadline. When the relay becomes fresh again, stage 2 automatically moves
traffic back to stage 1. Ground deduplicates the stage-2 session and telemetry
sequence across both physical paths during a transition.

Mission alarm sequence, timestamp, and block index remain in telemetry. Alarm
title and message are sent in a separate encrypted mission-alarm packet when
they change, and are repeated periodically while active. This keeps the hot
telemetry path small without changing the UI-facing `mission_alarm_*` fields.

Sequence state values carried by telemetry:

- `0`: idle
- `1`: countdown (`td` is negative milliseconds remaining)
- `2`: ignition output active (`td` is milliseconds after T0)
- `3`: T+ sequence active with ignition output off (`td` continues increasing)

State `3` remains active until an abort or sequence-end command. This makes the
firmware the sequence clock source and lets the UI restore T+ after a refresh
or reconnect.

## Reliable Control Channel

The ground board forwards UI and USB serial controls to the selected avionics stage.
Commands use encrypted unicast frames and a 32-bit transaction ID.

Each queued command and storage request captures its target stage ID. Changing
the UI target while a request is in flight cannot redirect its ACK or storage
response to the other stage.

- One command is active on the radio at a time.
- An unacknowledged command is retried every 60 ms, up to 8 attempts.
- Stage-2 commands use the stage-1 relay first. If the first two attempts are
  unanswered, the ground retries through the direct standby route. Storage
  list/read requests follow the same route fallback policy.
- The avionics board caches the eight most recent transaction results, so a
  retransmission returns the previous ACK without executing the action twice.
- Identical commands arriving from the UI's serial and HTTP paths are
  coalesced while pending and for 500 ms after enqueue.
- Safety-critical commands (`abort`, `sequence_end`, and `force_ignite`) are
  inserted at the head of the command queue. If the queue is full, a lower
  priority pending command may be dropped so the urgent command can be sent.
- Pending commands are discarded if the peer times out. A stale ignition or
  pyro command is never retained for a later reconnection.
- Telemetry continues while commands are retried. Command ACKs have priority
  over telemetry ACKs and new telemetry frames.

Command ACK result codes:

- `0`: accepted and executed
- `1`: rejected because safety mode is active
- `2`: busy or unable to enter the requested sequence state
- `3`: invalid argument
- `4`: unsupported command

Supported controls:

- Safety mode, arm lock, inspection state, and buzzer mute
- Ignition duration, countdown duration, and sequence pyro channel
- Pre-count state, countdown start, immediate ignition, abort, and sequence end
- Pyro test
- Gyro zero/reset and barometer zero/reference pressure
- Buzzer tone, finder pattern, and stop

## Role Behavior

### Avionics

- Samples local IMU, barometer, GPS, and chip state.
- Writes local records to the external W25Q256 flash at the configured rate.
- Buffers samples while NOR page-program or sector-erase operations are busy,
  then writes larger contiguous batches to reduce repeated page programs.
- Probes the W25Q256 bus up to 40 MHz at boot and falls back to the highest
  lower clock with a stable JEDEC identity.
- Sends packed ALTIS INTELLIGENT LINK1 telemetry at 50 Hz.
- Stage 2 sends that telemetry through stage 1 whenever the relay is healthy;
  the direct-ground peer carries only standby control traffic until failover.
- Does not publish periodic telemetry over USB serial or Wi-Fi.

### Ground

- Does not sample or publish its local sensors in ALTIS INTELLIGENT LINK1 mode.
- Receives and decodes avionics telemetry.
- Maintains independent session, sequence, loss, RSSI, alarm, and storage state
  for stage 1 and stage 2, plus direct and relayed path state for stage 2.
- Prefers the stage-1 relay for stage-2 traffic and activates the direct path
  only when the primary path is stale.
- Relays the currently selected stage telemetry to the Flash6 UI:
  - Wi-Fi WebSocket: 50 Hz
  - USB serial: 50 Hz output scheduler, using the newest remote sample
- Reports link state, receive rate, loss, peer age, and peer MAC to the UI.
- Accepts controls from Wi-Fi HTTP or USB serial and forwards them to avionics.
- Reports pending, acknowledged, failed, retried, and last-result command
  counters to the UI.
- Sends telemetry ACKs every 10 received telemetry frames to reduce reverse-link
  airtime while still detecting sequence gaps.
- Reads remote W25Q storage through up to three pipelined 192-byte ESP-NOW read
  requests per HTTP chunk. Busy responses are retried within the request window.
- Requests storage sessions in batches of up to eight entries. Each entry carries
  its session ID, logical offset, byte length, record count, and current-session flag,
  allowing the UI to download only the selected session range.

## Data Origin

Every UI telemetry frame includes a data-origin field:

- `local` / compact value `0`: sensors and state from the board directly
  connected to the UI.
- `avionics` / compact value `1`: remote avionics telemetry received by the
  ground board through ALTIS INTELLIGENT LINK1.

The Flash6 UI keeps this origin on charts, exports, and app-side recordings so
ground-board data cannot be confused with vehicle data.

## App Recording

The Flash6 web and Capacitor apps record live received telemetry as binary
`HWLOGV2` record chunks in IndexedDB. Records are committed in batches to avoid
blocking the UI at high stream rates.

- Local direct telemetry is stored as `APP · LOCAL`.
- Ground-station relayed telemetry is stored as `APP · AVIONICS`.
- Every frame delivered to the app is recorded. The app does not apply an
  additional recording-Hz limit or downsampling stage.
- A source change or a receive gap longer than five seconds starts a new
  recording session.
- App sessions remain available after closing or restarting the app and export
  as replay-compatible `.bin` files even while the board is offline.
- App BIN headers retain the `LOCAL` or `AVIONICS` origin. The replay UI can
  later convert the loaded BIN into XLSX reports.
- Board W25Q storage remains separate and is shown as `BOARD · LOCAL`.
- The data browser uses `LOCAL` and `AVIONICS` source buttons and only lists
  files for the selected source.

## Configuration

The ALTIS INTELLIGENT LINK1 role, avionics stage ID, and ground control target are
stored in ESP32 Preferences. Entering ALTIS INTELLIGENT LINK1 uses a
one-time boot reservation so the automatic restart can initialize the radio.
That reservation is consumed during startup. A later manual reboot or power
cycle always returns the board to Flight mode while preserving its role.

Ground role enables ALTIS INTELLIGENT LINK1, USB serial telemetry, and the Wi-Fi AP for UI
clients. Avionics role disables the Wi-Fi AP and web server while keeping the
STA radio active for ESP-NOW ALTIS INTELLIGENT LINK1.

Developer mode is stored in ESP32 Preferences and can be toggled by pressing
the boot button three times and then holding it. In ALTIS INTELLIGENT LINK1 avionics role,
USB serial telemetry is available only when developer mode is enabled.

Protocol keys are compile-time firmware material in this revision. Production
revisions should rotate keys per fleet or per paired board.

## Firmware Revision

- Firmware version: `0.7.0`
- Build ID: `v6 b4`
- Wire protocol: `Flash6-Intelligent-b3` / numeric version `3`
- Storage record format: version `4` (unchanged and backward compatible)
- Compatibility: all three radio nodes must be updated together; wire-version
  `2` and `3` frames are intentionally not mixed in one flight network.
