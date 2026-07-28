# ALTIS INTELLIGENT3 Firmware Changelog

Firmware, build, and wire-protocol version changes are recorded here in the
same commit that changes the corresponding constants in `src/firmware/state.h`.

## 0.9.14 — v6 b44 — 2026-07-28

Protocol: `Flash6-Intelligent-b10`

Storage record protocol: `HWLOGV2` version `9` (native compatibility `8–9`)

- 2단 운용 중 `미션 대기`를 시작하면 기존 단간 `STANDBY` 이벤트의
  공통 시퀀스 ID를 비행 기록 동기화 ID로 함께 사용합니다. 1단은 명령
  수락 시각, 2단은 같은 이벤트 수신 시각을 각 보드의 로컬 기준점으로
  저장합니다.
- SPI NOR 세션 헤더와 내보낸 BIN 헤더에 동기화 ID, 로컬 기준시각,
  단 번호 및 동기화 형식 버전을 추가했습니다. 기존 version 8 기록은
  계속 읽을 수 있으며 새 메타데이터가 없는 로그는 단일 파일로
  재생됩니다.
- 저장 기록 목록의 HTTP·USB 시리얼·A.I LINK 프록시 경로 모두에서
  동기화 메타데이터가 유실되지 않도록 전송 규격을 확장했습니다.
- 리플레이 파일 선택에서 1단·2단 BIN 두 개를 동시에 선택하거나
  드래그하면 공통 동기화 ID를 검증한 뒤 각 보드의 로컬 시간축을
  자동 정렬하여 하나의 2단 텔레메트리 리플레이로 병합합니다.
- 리플레이 데이터 선택 모달을 왼쪽 비행 데이터 요약과 오른쪽 기록
  라이브러리로 재구성했습니다. 오른쪽에서는 `최근 비행 기록`과
  `최근 선택 데이터`를 토글할 수 있습니다.
- 파일을 고른 직후 리플레이 화면으로 자동 전환하지 않고, 요약 아래의
  `리플레이 진행하기`를 눌렀을 때만 선택 데이터를 재생하도록 변경했습니다.
- FLASH6 UI 자산 버전을 `b125`로 갱신했습니다.

## 0.9.13 — v6 b43 — 2026-07-28

Protocol: `Flash6-Intelligent-b9`

Storage record protocol unchanged: `HWLOGV2` version `8`

- 부팅 직후 자동으로 시작하던 에비오닉스 SPI NOR 기록을 중단하고,
  컨트롤 패널의 `비행데이터 로깅` 버튼을 눌렀을 때만 새 기록 세션을
  시작하도록 변경했습니다.
- 로깅을 끄면 신규 샘플 수집을 먼저 막고 대기 중인 기록 큐를 모두
  플러시한 뒤 현재 세션을 닫습니다. 기존 저장 기록과 BIN 형식은
  변경하거나 삭제하지 않습니다.
- 동일한 버튼으로 브라우저 APP 수신 기록과 에비오닉스 200 Hz 플래시
  기록을 함께 제어하며, 보드가 회신한 실제 로깅 상태를 데스크톱과
  모바일 UI에 동기화합니다.
- A.I LINK 명령 `SetStorageLogging(36)`과 텔레메트리
  `storage_logging` 상태 필드를 추가했습니다. 지상국 경유 연결에서도
  선택된 에비오닉스의 기록 상태를 확인하고 제어할 수 있습니다.
- FLASH6 UI 자산 버전을 `b123`으로 갱신했습니다.

## FLASH6 replay virtual countdown b122 — 2026-07-28

Firmware build unchanged: `0.9.12` (`v6 b42`)

Protocol unchanged: `Flash6-Intelligent-b8`

- QUICK 실행 시 기록 파일에 T-15 샘플이 있는지와 관계없이
  `T-15 → T-0` 가상 카운트다운을 실제 15초 동안 재생합니다.
- 가상 카운트다운 프레임을 메인 HUD와 OBS HUD LIVE에 동일하게
  전달하며, T-15~T-10 구간의 HUD LIVE 프리롤도 함께 동작합니다.
- T-0 도달 시 기록에서 복원한 실제 발사 프레임으로 이동해 리플레이를
  자동 재생합니다.
- 일시정지, 시점 이동, 리플레이 종료 시 진행 중인 가상 카운트다운도
  함께 취소되도록 재생 상태를 통합했습니다.

## FLASH6 replay QUICK T-15 fix b121 — 2026-07-28

Firmware build unchanged: `0.9.12` (`v6 b42`)

Protocol unchanged: `Flash6-Intelligent-b8`

- PRE_FLIGHT에서도 미션 시간이 `0`인 점을 고려하지 않고 첫
  `td >= 0` 프레임을 발사로 오인하던 QUICK 탐색을 수정했습니다.
- 실제 `TPLUS(3)` 상태를 최우선으로 사용하고 저장된 T+ 경과시간을
  역산해 발사 시각을 복원합니다. 추력 비행 상태와 미션 시간 증가는
  순서대로 보조 근거로 사용합니다.
- 기록 자체가 T-15 이후에 시작된 경우 파일 첫 프레임으로 잘못
  이동하지 않고 T-15 데이터가 없음을 안내합니다.

## FLASH6 OBS local HUD relay b120 — 2026-07-28

Firmware build unchanged: `0.9.12` (`v6 b42`)

Protocol unchanged: `Flash6-Intelligent-b8`

- OBS와 메인 콘솔이 서로 다른 Chromium 프로필을 사용해
  `BroadcastChannel`·`localStorage`를 공유하지 못하던 구조를
  제거했습니다.
- 의존성 없는 loopback 전용 HUD 중계를 추가했습니다. 메인 리플레이가
  최신 표시 프레임을 `127.0.0.1:4177`에 전송하고 OBS는 SSE로 즉시
  수신합니다.
- 로컬 중계와 기존 지상국 `/hud_ws` 중계를 동시에 유지해, 어느 한
  경로가 준비되지 않아도 다른 경로로 자동 복구합니다.
- VS Code 폴더 자동 실행 태스크와 macOS용
  `FLASH6/start-hud-live.command` 실행기를 추가했습니다.
- HUD LIVE 안내에서 로컬 중계의 실제 ONLINE/OFFLINE 상태를
  확인하도록 했으며 OBS URL 캐시 키를 `b120`으로 갱신했습니다.

## FLASH6 HUD display-clock sync b119 — 2026-07-28

Firmware build unchanged: `0.9.12` (`v6 b42`)

Protocol unchanged: `Flash6-Intelligent-b8`

- 메인 콘솔의 표시 주기를 8~10Hz에서 라이브 약 25Hz, 리플레이 약
  30Hz로 높였습니다.
- HUD LIVE는 별도 샘플을 앞서 전송하지 않고 메인 콘솔이 실제 표시한
  동일 프레임만 전송합니다. 재생, 일시정지 직전, 탐색 및 QUICK 이동
  후의 시간·상태·계기 값이 같은 프레임을 기준으로 맞춰집니다.
- HUD URL 캐시 키를 `b119`로 갱신했습니다.

## FLASH6 OBS HUD streaming b118 — 2026-07-28

Firmware: `0.9.12` (`v6 b42`)

Protocol unchanged: `Flash6-Intelligent-b8`

- OBS의 독립 브라우저 프로필에서도 보드 WebSocket 압축 프레임을 직접
  해석하도록 경량 HUD 디코더를 추가했습니다.
- HUD LIVE 복사 링크에 메인 콘솔이 실제 사용 중인 WebSocket 주소를
  포함해 잘못된 기본 보드 주소로 연결되던 문제를 수정했습니다.
- 메인 미리보기와 OBS WebSocket 송신 주기를 20ms(최대 50Hz)로
  단축했습니다. 동기식 저장소 기록은 100ms로 분리해 메인 UI 부하를
  억제합니다. OBS에서는
  백그라운드 `animation frame`이 약 1Hz로 제한될 수 있어 WebSocket
  샘플을 수신 즉시 반영하도록 분리했습니다.
- 리플레이 HUD 샘플을 지상국 WebSocket에서 OBS로 중계하는 제한된
  전용 프레임을 추가했습니다. 파이로·미션 명령 경로와는 분리됩니다.
- HUD LIVE 링크에 렌더러 버전을 포함해 OBS가 이전 오버레이 문서를
  캐시에서 재사용하지 않도록 했습니다.
- OBS 리플레이 전용 `/hud_ws` 채널을 추가했습니다. 일반 `/ws`의
  50Hz 보드 프레임과 리플레이 HUD 프레임이 같은 송신 큐에서
  경쟁하지 않으며, 중계 송신자에게 프레임을 되돌려 보내지 않습니다.

## FLASH6 HUD LIVE streaming b115 — 2026-07-27

Firmware build unchanged, protocol unchanged.

- OBS HUD 텔레메트리 송신을 대시보드 DOM 렌더링 조건에서 분리했습니다.
- 일반 센서 샘플에서도 80ms 주기로 고도·속도·가속도·T+ 상태를 연속 발행합니다.
- 이벤트가 발생할 때만 HUD 값이 갱신되던 현상을 수정했습니다.

## FLASH6 replay HUD pre-roll b114 — 2026-07-27

Firmware build unchanged, protocol unchanged.

- Changed the replay `QUICK` action from T-10 to T-15 relative to the detected
  launch point.
- Added a five-second HUD LIVE pre-roll presentation from T-15 through T-10,
  with a large absolute-sequence countdown before the normal flight HUD fades
  back in.
- Aligned the OBS overlay with the main HUD coordinate system and anchored the
  lower state/timeline group to the exact viewport center.
- Moved the stage link indicator to the upper-left and added a lightweight
  sync-record poll so embedded HUD LIVE telemetry updates without reloading.
- Kept playback, seeking, and viewpoint control in the main replay interface.

## FLASH6 replay HUD LIVE b113 — 2026-07-27

Firmware build unchanged, protocol unchanged.

- Rebuilt `overlay.html` as a transparent, display-only OBS HUD using the
  current FLASH6 flight HUD visual language without menus or camera controls.
- Added a replay Control Panel action that generates and copies the OBS
  Browser Source URL, with a dedicated setup guide and preview action.
- Synchronized the selected stage, replay time, mission state, speed, G-force,
  altitude, ARM, pyro, and storage status from the main console to HUD LIVE.
- Kept replay, stage selection, and 3D viewpoint control exclusively in the
  main FLASH6 interface.

## 0.9.10 — v6 b40 / FLASH6 mission backup b112 — 2026-07-27

Protocol: `Flash6-Intelligent-b8` (unchanged)

- Increased the Stage 1 separation backup default from T+2.0 s to T+2.5 s,
  preserving additional confirmation margin after the theoretical 1.7 s
  motor burn.
- Migrated only the legacy persisted 2000 ms factory setting to 2500 ms;
  explicitly configured alternative timings remain unchanged.
- Gave confirmed coasting priority when coasting and the backup deadline are
  observed in the same mission tick.
- Updated FLASH6 mission-setting defaults and firmware build metadata.

## FLASH6 dashboard telemetry refinement b111 — 2026-07-27

Firmware build unchanged, protocol unchanged.

- Kept the established dashboard geometry while rebuilding the selected-stage readout hierarchy.
- Changed secondary telemetry from squeezed inline rows to compact label-over-value instruments.
- Increased primary value presence and prevented state, delay, and attitude values from being visually truncated.

## FLASH6 dashboard telemetry rebuild b110 — 2026-07-27

Firmware build: `v6 b39` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Preserved the original Stage 1 / Stage 2 / selected telemetry geometry and
  rebuilt only the selected-stage panel as a dedicated desktop component.
- Removed the desktop layout overrides that repurposed mobile Quick Data
  elements and caused compressed, overlapping telemetry values.
- Kept mobile and direct-board Quick Data independent while synchronizing the
  new panel with the selected vehicle, charts, storage, ARM, pyro, and gyro.

## FLASH6 dashboard quick-data header b108 — 2026-07-27

Firmware build: `v6 b39` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed the redundant Quick Data title row while the dual-stage telemetry
  selector is active and allowed its metrics to use the reclaimed height.
- Preserved the connection-status header for direct single-board operation.

## FLASH6 dashboard stage selector b107 — 2026-07-27

Firmware build: `v6 b39` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Turned the Stage 1 and Stage 2 overview cards into accessible telemetry
  selectors without changing the active HUD or vehicle-control target.
- Switched Quick Data, flight altitude, and acceleration/altitude charts to
  the selected vehicle immediately, including an explicit no-data state for
  an unavailable stage.
- Added independent per-stage chart timelines and acceleration histories so
  relayed Stage 2 samples no longer reuse Stage 1 chart data.

## 0.9.9 — v6 b39 / FLASH6 stage-2 link quality b106 — 2026-07-27

Protocol: `Flash6-Intelligent-b8` (unchanged)

- Kept the relayed stage-2 route RSSI synchronized with the physical
  stage-1-to-ground hop, including the discovery-order race that previously
  left stage 2 at the invalid `-127 dBm` sentinel.
- Added a route-aware FLASH6 fallback for older ground builds: while stage 2
  is using the relay route, its chart uses the fresh relay-hop RSSI instead of
  remaining empty despite a healthy stage-2 RX rate.
- Fed the resolved per-stage metrics back into each dashboard history buffer,
  so the stage-2 value card and chart are sourced from the same snapshot.

## FLASH6 link quality sample merge b105 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Merged parallel stage-telemetry and A.I LINK status metrics within each
  200 ms chart slot instead of discarding the later source.
- Prevented an empty relay snapshot from blocking a valid RSSI sample while
  the current metric cards still showed a healthy link value.
- Rendered the first valid sample immediately as a point instead of showing
  the waiting message until a second sample arrived.

## FLASH6 unified dashboard geometry b104 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Replaced communication-only desktop drawer exceptions with one shared
  dashboard geometry for both telemetry and communication tabs.
- Both tabs now use identical drawer bounds, padding, gap, tab height, and
  clipping; only their content-row definitions differ.

## FLASH6 communication bottom cleanup b103 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Restored the communication drawer's original viewport height instead of
  extending the drawer to the bottom edge.
- Removed only the drawer's unused inner bottom padding and suppressed the
  covered camera HUD while the communication dashboard is open.

## FLASH6 communication drawer bottom fit b102 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed the communication drawer's reserved bottom viewport gap that exposed
  the camera background and lower HUD as a stray box below the dashboard.
- Attached the communication drawer cleanly to the viewport bottom while
  retaining its upper rounded corners.

## FLASH6 continuous communication chart b101 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed the renderer's six-second RSSI gap split that could break a healthy
  link chart into disconnected line fragments.
- The communication chart now connects all valid samples in the visible
  30-second window while link availability remains visible in the node state.

## FLASH6 telemetry drawer fit b100 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Converted the desktop telemetry drawer into a fixed three-row workspace for
  the section tabs, telemetry overview, and trend charts.
- Removed inherited fixed card heights and drawer scrolling; the overview and
  chart rows now share the available viewport height and shrink responsively.

## FLASH6 communication drawer fit b99 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed the communication view's forced full width, which overrode the
  camera dashboard drawer's reserved right-side navigation clearance.
- Converted the desktop camera drawer interior to fixed header, section-tab,
  and responsive content rows so the communication workspace stays entirely
  inside the drawer without covering the navigation.

## FLASH6 responsive communication visibility b98 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed the zero-height flex basis that could collapse the complete dashboard
  when the communication tab was selected.
- Kept parent-driven responsive sizing with shrinkable auto heights and an
  explicit parent-height ceiling.

## FLASH6 responsive communication workspace b97 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed JavaScript viewport-height injection from the dashboard communication
  workspace. The page, dashboard, shell, and communication card now divide the
  actual remaining height through a parent-driven responsive flex chain.
- Added compact height and width breakpoints so topology nodes, metrics, and
  both stage charts remain inside the card without page or inner scrolling.
- Kept brief RSSI reception gaps visually continuous while retaining a break
  for interruptions longer than six seconds.

## FLASH6 communication workspace fit b96 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Reserved a fixed visible lower inset when fitting the communication
  workspace so its border, chart axes, and labels remain inside the viewport.
- Joined brief missing RSSI samples into one readable trend while preserving a
  visible break for actual link interruptions longer than 1.4 seconds.

## FLASH6 communication workspace v3 b95 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Rebuilt the dashboard communication section with isolated markup and styles
  instead of inheriting the telemetry card's accumulated height constraints.
- Added an exact visible-viewport measurement so the communication workspace
  ends above the dashboard's lower padding without page or inner scrolling.
- Rebalanced the topology and two independent stage-quality plots into a
  single fixed two-column workspace; both charts now share the available
  height and remain visible together.
- Preserved all live link-state, per-stage metric selection, and chart data
  interfaces while replacing only the presentation structure.

## FLASH6 communication viewport flex b94 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Replaced the communication view's viewport subtraction with a parent-driven
  flex layout so browser zoom, tab height, and dashboard padding cannot create
  page overflow.
- The communication card now consumes only the height actually left below the
  dashboard tabs; both per-stage charts divide that remaining space equally.
- Disabled the dashboard page scroll owner only while the desktop communication
  section is active.

## FLASH6 communication viewport balance b93 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed the oversized minimum communication height that forced desktop
  scrolling on scaled or shorter displays.
- Compacted the duplicated per-stage headers, metric strips, and padding while
  preserving the chart area; both stages now fit inside the available viewport.
- Sized the communication body from the actual dynamic viewport and leaves a
  small lower margin instead of clipping or adding internal empty space.

## FLASH6 communication natural-height layout b92 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Made the communication card itself grow to the normal two-chart content
  height instead of forcing both quality panels into a shorter clipped box.
- Reserved a 220 px minimum plot height per stage and uses additional viewport
  height for both plots; short desktops scroll the dashboard instead of
  compressing or clipping Stage 2.
- Kept the topology height synchronized with the combined quality column.

## FLASH6 communication card fill b91 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed viewport-based chart compression and restored the original minimum
  chart height for both Stage 1 and Stage 2 quality panels.
- Made the topology and both quality charts flex into the communication card's
  remaining height so the lower empty area is used instead of left blank.

## FLASH6 communication header removal b90 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed the redundant Network/Communication title bar and overall-link badge
  so the communication topology and per-stage quality panels begin directly
  below the dashboard section switcher.
- Removed the corresponding inactive DOM update and styling code.

## FLASH6 communication viewport fit b89 — 2026-07-26

Firmware build: `v6 b38` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Made the two per-stage link-quality panels and topology scale together with
  the available desktop viewport height so the Stage 2 chart is not clipped.
- Removed the zero-dBm artifact caused by treating missing chart samples as
  numeric zero; missing RSSI samples now render as gaps or a waiting state.

## 0.9.8 — v6 b38 / FLASH6 per-stage link quality b88 — 2026-07-26

Protocol: `Flash6-Intelligent-b8` (ESP-NOW/storage wire version `8`, unchanged)

- Extended the backward-compatible Ground-to-FLASH6 stage snapshot tail with
  per-stage receive loss, RSSI, and RSSI age. Existing snapshot indexes and
  the radio/storage wire formats remain unchanged.
- Split the Dashboard communication quality view into independent Stage 1 and
  Stage 2 metric panels and 30-second chart buffers.
- Increased the topology workspace height to align with the two stacked
  quality panels and remove the unused lower area.
- Kept the Stage 2 direct Ground backup route green while it remains available
  behind the preferred Stage 1 relay route.

## FLASH6 visible stage-2 direct-backup route b87 — 2026-07-26

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Increased the contrast of standby communication paths so the stage 2 to
  Ground direct-backup capability remains visible while relay is active.
- Added compact live route labels for relay, direct backup, and the stage 1
  primary uplink, including active and standby states.

## FLASH6 dashboard communication workspace b86 — 2026-07-26

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Added top-level Telemetry and Communication dashboard sections with a
  segmented switch that replaces the dashboard body instead of stacking it.
- Added a dedicated Communication workspace containing live topology plus
  switchable RSSI, packet-loss, and receive-rate history.
- Added live stage 1, stage 2, Ground, PC, and mobile link-route states using
  the existing A.I LINK telemetry and transport status.
- Reused the existing 30-second communication sample buffer and chart renderer
  for both Settings and Dashboard without duplicating telemetry collection.
- Kept the new workspace aligned with the restrained FLASH6 dark surface,
  typography, borders, and segmented-control language.

## FLASH6 trajectory ground plane and event labels b85 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Expanded the trajectory ground reference grid independently from the measured
  X/Z bounds while preserving one true metric projection scale for all axes.
- Kept the exact corrected-apogee sample in the decimated trajectory data.
- Added altitude to stage-separation, ejection, and end markers.
- Added T+ time to the apogee marker.

## FLASH6 pressure-robust flight altitude b84 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Separated raw barometric altitude from the corrected altitude used by flight
  charts, scalar-speed reconstruction, and the 3D trajectory.
- Added a 900 ms centered time-median envelope and a single-apogee isotonic
  flight constraint to reject separation/ejection pressure shocks without
  shifting or lowering the real apogee.
- Applied the same corrected altitude to replay HUD charts while retaining the
  original `alt_m` sample for auditing.
- Added `BARO_ALTITUDE_RAW_M` and `ALTITUDE_CORRECTED_M` columns to the raw
  flight export.
- Added regression coverage for multi-sample pressure shocks, false early
  apogee rejection, monotonic ascent/descent, and raw-data preservation.

## FLASH6 range-guarded shared trajectory b83 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Applied the same conservative model-rocket horizontal-motion model to the
  exported trajectory and live/replay gyro preview.
- Reduced the powered-flight tilt prior from 35° to 18°, lowered horizontal
  speed limits, and increased coast/descent damping to reject IMU integration
  drift.
- Kept GPS east/north coordinates out of the path shape and absolute heading,
  while using only the accepted scalar GPS distance envelope to keep estimated
  range consistent with observed flight extent.
- Removed the remaining 2.8x horizontal visual exaggeration from the UI gyro
  trail and kept X/Z/altitude at one metric scale.
- Added GPS range-envelope and model range-limit diagnostics to `TRAJECTORY_3D`.

## FLASH6 metric-scale trajectory rendering b82 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Changed the 3D trajectory renderer to use one shared metres-to-pixels scale
  for local X/Z and altitude.
- Removed the visual horizontal exaggeration that made a roughly 36 m ground
  span look comparable to a roughly 140 m ascent.
- Kept GPS completely outside the reconstructed path; GPS remains available
  only in reference columns for post-flight auditing.

## FLASH6 GPS-free trajectory and ballistic coast b81 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed GPS position and GPS-derived velocity from trajectory and scalar-speed
  reconstruction. GPS latitude/longitude and local offsets remain only as
  reference columns for auditing.
- Enforced immediate ballistic deceleration after IMU-confirmed burnout so a
  delayed barometric rise cannot hold the vehicle at a false constant speed.
- Kept the measured-apogee energy envelope in powered flight only, preventing
  ejection pressure transients from collapsing the coasting speed estimate.
- Added regressions proving that noisy GPS cannot change trajectory mode and
  that coast speed drops by at least gravity rather than forming a plateau.

## FLASH6 model-rocket motion estimator b80 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Replaced unrestricted lateral acceleration integration with one shared
  model-rocket motion prior for the live gyro preview and exported trajectory.
  The estimator holds the rocket on the rail, follows the measured attitude
  gradually during powered flight, and preserves center-of-mass inertia after
  burnout instead of steering the path with later attitude changes.
- Made barometric altitude authoritative, bounded ascent speed by the measured
  apogee energy envelope, and added a Hampel pass so an isolated pressure
  glitch cannot become a speed spike.
- Reprocesses app-derived V6 speed values from the original altitude/IMU/GPS
  samples. Only direct/imported speed remains authoritative.
- Added horizontal, vertical, scalar-speed, and speed-source diagnostics to the
  `TRAJECTORY_3D` sheet so trajectory and speed calculations can be audited.

## FLASH6 fused-speed transient correction b79 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Replaced the hard barometric-speed clamp that caused an instantaneous speed
  jump at T+ with an acceleration-limited continuous estimator.
- Added an independent IMU burnout latch for legacy records. Once burnout is
  sustained, positive ascent speed can no longer form a second propulsion
  peak from pressure noise or vibration.
- Kept barometric altitude velocity authoritative while limiting acceleration
  to short-term phase response and added regressions for both transient cases.

## FLASH6 replay speed source correction b78 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Prevented replay rendering from writing a UI-derived temporary speed back
  into the source sample as if that value had existed in the BIN.
- Added explicit actual-speed provenance. Reports trust replay speed only when
  the app V6 in-band validity marker or an imported speed column confirms it;
  legacy BIN files always use the altitude/IMU fused estimator.
- Bounded acceleration lead around the robust barometric velocity estimate so
  launch vibration cannot accumulate into a non-physical speed spike.

## FLASH6 legacy speed spike correction b77 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Removed scalar-speed estimation by differentiating corrected 3D trajectory
  positions, which amplified GPS/trajectory corrections into false spikes.
- Legacy BIN reports now use a complementary velocity estimator: gyro-aligned
  acceleration provides fast vertical/horizontal response and a 600 ms
  barometric altitude slope corrects vertical integration drift. New app V6
  records continue to use their explicit scalar-speed field unchanged.
- Added a regression case with deliberately discontinuous reconstructed
  positions to ensure coordinate corrections cannot alter the speed chart.

## FLASH6 flight speed/timebase correction b76 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Stopped aliasing barometric vertical speed as vehicle speed in relayed
  telemetry and HUD/replay fallbacks. Actual speed now comes from an explicit
  sample, GPS/3D motion, or the inertial trajectory estimator.
- Stored actual scalar speed in the reserved tail word of new app V6 records
  with an in-band validity bit, preserving older V6 and V4 compatibility.
- Changed XLSX `FLIGHT_RECORD` speed to scalar vehicle speed while keeping
  descent/terminal-speed calculations on the separate vertical-speed series.
- Made the firmware `st=3`/`td` mission timebase authoritative for report T+.
  Thrust-first records now retain their original thrust timestamp even when
  physical ARM confirms mission authority later.

## FLASH6 flight-record phase column b75 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Added a localized flight-state column immediately after elapsed time in the
  XLSX `FLIGHT_RECORD` sheet.
- Shifted the sheet's chart source columns and time-label column together so
  every existing altitude, speed, acceleration, descent, and gyro chart keeps
  its original data series.

## FLASH6 replay communication status b74 — 2026-07-25

Firmware build: `v6 b37` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Added a replay control-panel action for app-saved avionics communication
  recordings, with RSSI, packet-loss, and receive-rate charts synchronized to
  the replay position.
- Extended new app recording records to V6 so link quality and link state are
  stored alongside flight telemetry without changing the external wire
  protocol.
- Preserved V4 app-record compatibility. Earlier app recordings still open and
  show an explicit legacy no-data state because those files never stored link
  quality samples.

## 0.9.7 — v6 b37 — 2026-07-25

Protocol: `Flash6-Intelligent-b8` (ESP-NOW wire version `8`, unchanged)

- Added legacy BIN timebase reconstruction using the same launch evidence as
  current firmware: debounced physical ARM release or IMU acceleration above
  1.5 G for 100 ms, whichever occurs first.
- Preserved ARM-first authority when thrust evidence is absent, and preserved
  the original thrust timestamp when ARM confirms within the 1000 ms window.
- Reconstructs a failed thrust-first launch as provisional T+ followed by
  `MISSION_STANDBY` when physical ARM never confirms.
- Prevented a late ARM transition from silently restarting a launch after the
  1000 ms validation fault; a new operator standby command is now required.
- Modern protocol-b8 BIN timebases remain byte-for-byte authoritative and are
  never rewritten by the compatibility decoder.

## FLASH6 replay activation fix b72 — 2026-07-25

Firmware build: `v6 b36` (unchanged)
Protocol: `Flash6-Intelligent-b8` (unchanged)

- Changed the legacy BIN notice from a blocking parse gate to an informational
  modal so a covered or unacknowledged notice can never strand replay on Home.
- Moved successful replay activation ahead of secondary display updates and
  made Home dismissal recover from an already-active replay state.
- Updated the web asset cache key and added a regression assertion that legacy
  BIN parsing resolves without a modal click.

## 0.9.6 — v6 b36 — 2026-07-25

Protocol: `Flash6-Intelligent-b8` (ESP-NOW wire version `8`, unchanged)

- Added protocol, mission-timebase, and firmware-build metadata to each newly
  created NOR flight-data session without changing existing V1–V3 sectors.
- Extended exported `HWLOGV2` BIN headers from the stable 40-byte prefix to a
  64-byte v3 header that records the source session protocol and compatibility
  range.
- Reused the three reserved storage-list bytes for protocol metadata, keeping
  the A.I LINK packet size and external command interfaces unchanged.
- Added an explicit replay decoder compatibility range (`b8` through `b8`).
  Missing or out-of-range metadata is opened through the legacy decoder only
  after FLASH6 displays an earlier-data-protocol notice.
- Preserved old BIN and raw-record decoding, including sessions written before
  protocol metadata was introduced.

## 0.9.5 — v6 b35 — 2026-07-25

Protocol: `Flash6-Intelligent-b8` (ESP-NOW wire version `8`, unchanged)

- Changed stage-1 launch timing to use the first valid physical ARM release or
  sustained thrust-flight evidence as the T+ timestamp.
- Added a 1000 ms physical-ARM authority window for thrust-first launches.
  Deployment outputs and stage-2 T+ transmission remain blocked until ARM
  confirms the original thrust timestamp.
- Added fail-closed recovery for an unconfirmed thrust launch: outputs are
  cleared, provisional T+ is discarded, mission standby is restored, and
  FLASH6 displays a localized high-risk validation modal.
- Decoupled powered-flight detection from the physical ARM input so thrust
  evidence is preserved even when it arrives before launcher-cable release.
- Preserved ARM-first operation as the primary safety path: ARM release still
  establishes an immediately authorized T+ and the mission continues even if
  thrust detection is unavailable.

## 0.9.4 — v6 b34 — 2026-07-24

Protocol: `Flash6-Intelligent-b8` (ESP-NOW wire version `8`)

- Added persistent sequence settings for the stage-1 separation, stage-1
  ejection, and stage-2 ejection servo target angles.
- Routed configured angles through USB serial, Wi-Fi, A.I LINK telemetry,
  remote commands, and interstage standby synchronization.
- Replaced the mission runtime's fixed `80° / 80° / 0°` targets with the
  configured `0–180°` values and exposed them in FLASH6 sequence settings.
- Corrected the sequence settings input clamp so timer values are no longer
  interpreted as scaled numbers when they are saved.

## FLASH6 replay dock alignment b70 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Aligned the replay close control to the same 50 px outer inset used by the
  left-side replay content.

## FLASH6 replay dock spacing b69 — 2026-07-24

Firmware build: `v6 b33` (unchanged)
Protocol: `Flash6-Intelligent-b7` (unchanged)

- Equalized the desktop replay dock's left and right content padding.
- Reduced the transport content and replay file selector widths for a tighter,
  visually centered layout.

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
