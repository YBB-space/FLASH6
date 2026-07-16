# ALTIS INTELLIGENT LINK1

ALTIS INTELLIGENT LINK1 is the ESP-NOW transport used by one ground board and up
to two Altis Intelligent 3 avionics boards. Avionics nodes are identified as
`stage 1` and `stage 2`.

## Radio Profile

- ESP-NOW, 2.4 GHz
- Fixed channel: 6
- ESP-NOW PHY rate: 1M_L
- Telemetry target: 50 Hz per avionics node
- Peer topology: one ground board with encrypted unicast peers for stage 1 and stage 2
- Ground board: Wi-Fi AP and ESP-NOW share channel 6
- Avionics board: ESP-NOW station interface only; no Wi-Fi AP

## Pairing

1. Both boards broadcast a discovery packet every 250 ms while unpaired.
2. A board accepts only a discovery packet from the opposite role.
3. The ground board installs each stage MAC in its own encrypted peer slot.
4. The avionics board starts telemetry as soon as the encrypted peer is installed;
   Hello and ACK packets then confirm the bidirectional link.
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

The packed header is 24 bytes. The current telemetry frame is 133 bytes total, below the
ESP-NOW v1 payload limit of 250 bytes.

Header `flags & 0x03` carries the sender node ID: `0` for ground, `1` for stage 1,
and `2` for stage 2. A legacy avionics sender with node ID `0` is treated as stage
1 by the ground firmware. This adds multi-node routing without changing the
frame size or protocol version.

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
- Sends packed ALTIS INTELLIGENT LINK1 telemetry at 50 Hz.
- Does not publish periodic telemetry over USB serial or Wi-Fi.

### Ground

- Does not sample or publish its local sensors in ALTIS INTELLIGENT LINK1 mode.
- Receives and decodes avionics telemetry.
- Maintains independent session, sequence, loss, RSSI, alarm, and storage state
  for stage 1 and stage 2.
- Relays the currently selected stage telemetry to the Flash6 UI:
  - Wi-Fi WebSocket: 50 Hz
  - USB serial: 100 Hz output scheduler, using the newest 50 Hz remote sample
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
