# ALTIS INTELLIGENT3 Firmware Changelog

Firmware, build, and wire-protocol version changes are recorded here in the
same commit that changes the corresponding constants in `src/firmware/state.h`.

## 0.13.3 — v6 b81 / dual-stage flight logging

- 2단 운용에서 지상국의 비행데이터 로깅 명령을 1·2단 에비오닉스 모두에
  전달하도록 수정했습니다. 이전에는 자동 선택된 1단에만 명령이 큐잉되어
  2단 저장 사용량(%)이 증가하지 않았습니다.

Protocol unchanged: `Flash6-Intelligent-b15`

## FLASH6 UI b182 — 2026-08-01

- 시퀀스 타임의 `T-` 라벨과 카운트다운 숫자 폰트를 가볍고 정돈된 HUD
  타이포그래피로 조정해 두꺼운 기본 글꼴 느낌을 줄였습니다.

Firmware build unchanged: `0.13.3` (`v6 b81`)

Protocol unchanged: `Flash6-Intelligent-b15`

## FLASH6 UI b180 — 2026-08-01

- 미션 대기 또는 시퀀스 시작 전에 비행데이터 로깅 상태를 확인합니다.
- 1·2단 운용에서는 양쪽 로깅이 모두 켜져 있어야 진행되며, 꺼져 있거나
  상태를 확인하지 못하면 시작을 막고 경고 모달을 표시합니다.

Firmware build unchanged: `0.13.3` (`v6 b81`)

Protocol unchanged: `Flash6-Intelligent-b15`

## FLASH6 UI b181 — 2026-08-01

- 직접 2단 에비오닉스에 연결한 경우에도 카메라 상태바가 2단의 ARM·점화
  지연·PYRO·저장공간 값을 올바른 보드에서 읽도록 수정했습니다.
- 지상국/2단 운용에서는 각 차량 텔레메트리 스냅샷을 그대로 사용해 1·2단
  점화 지연 표시가 서로 섞이지 않도록 했습니다.

Firmware build unchanged: `0.13.3` (`v6 b81`)

Protocol unchanged: `Flash6-Intelligent-b15`

## FLASH6 UI b176 — 2026-08-01

- 카메라 HUD 지도를 하단 우측으로 조금 더 내리고 크기를 확장했습니다.
- 크리티컬 알림 스택을 상단 중앙에서 기존 하단 알림 영역으로 되돌렸습니다.

Firmware build unchanged: `0.13.3` (`v6 b80`)

Protocol unchanged: `Flash6-Intelligent-b15`

## FLASH6 UI b179 — 2026-08-01

- 시퀀스 시간 표시를 타임라인 바로 위 중앙으로 이동했습니다.
- 중앙에 표시되던 현재 비행 상태를 1·2단 상태바의 각 스테이지 상태로
  분리해 표시합니다.

Firmware build unchanged: `0.13.3` (`v6 b80`)

Protocol unchanged: `Flash6-Intelligent-b15`

## FLASH6 UI b178 — 2026-08-01

- HUD 상단에 표시되는 비행 알림을 오른쪽 상단으로 이동했습니다.
- 카메라 HUD 지도를 화면 하단 가장자리까지 추가로 내렸습니다.

Firmware build unchanged: `0.13.3` (`v6 b80`)

Protocol unchanged: `Flash6-Intelligent-b15`

## FLASH6 UI b177 — 2026-08-01

- 크리티컬 알림을 화면 오른쪽 하단 스택으로 정렬했습니다.
- 카메라 HUD의 미션명을 타임라인 아래 중앙으로 이동했습니다.
- 카메라 HUD 지도를 하단 가장자리 쪽으로 추가 배치했습니다.

Firmware build unchanged: `0.13.3` (`v6 b80`)

Protocol unchanged: `Flash6-Intelligent-b15`

## FLASH6 UI b175 — 2026-08-01

- 제어 센터의 `더보기`를 기본 메뉴 카드에서 분리해 독립된 펼침 버튼으로
  배치했습니다. 기본 메뉴는 대시보드·저장공간·미션·터미널·설정만
  유지합니다.
- 확장 제어의 시퀀스, 미션, 로깅, 서보, 파이로, 안전, ARM, 자이로,
  버저, 보고서, 재부팅 항목에 기능별 선형 아이콘을 복원했습니다.

Firmware build unchanged: `0.13.3` (`v6 b80`)

Protocol unchanged: `Flash6-Intelligent-b15`

## 0.13.3 — v6 b80 / dual-stage storage HUD telemetry — 2026-08-01

- 지상국의 1·2단 통합 텔레메트리 스냅샷에 각 보드의 SPI NOR 사용량,
  전체 용량, 저장 레코드 수를 추가했습니다. 2단 상태바의 STORAGE가
  데이터가 있음에도 `--`로 남던 문제를 수정했습니다.
- FLASH6는 스테이지별 저장공간 캐시가 아직 준비되지 않은 경우에도 해당
  스냅샷의 사용량과 용량으로 사용률을 직접 계산합니다.
- HUD의 고도 계기를 왼쪽 하단으로 옮기고 지도 크기를 줄였으며, 시퀀스
  미션명과 T-/T+ 시간 표시는 상단 왼쪽으로 정렬했습니다.

Protocol updated: `Flash6-Intelligent-b14` → `Flash6-Intelligent-b15`

Storage record protocol unchanged: `HWLOGV2` version `9`

## 0.13.2 — v6 b79 / addressed two-stage hardware controls — 2026-08-01

- 지상국의 2단 운용 모드에서 파이로·서보·자이로 영점·재부팅 모달에
  공통 STAGE 1 / STAGE 2 제어 대상 선택기를 추가했습니다. 1단 운용과
  에비오닉스 직접 연결에서는 선택기를 숨기고 기존 로컬 동작을 유지합니다.
- 선택한 STAGE 번호를 HTTP와 USB 시리얼 명령에 모두 포함하고, 서보·파이로·
  재부팅 시리얼 파서가 해당 노드로 A.I LINK 명령을 전달하도록 확장했습니다.
- 원격 서보 명령이 실패했을 때 노드 정보가 없는 레거시 명령으로 재시도해
  다른 단을 움직일 수 있던 위험한 폴백을 차단했습니다.

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

## 0.13.1 — v6 b78 / two-stage mission timing and buzzer parity — 2026-08-01

- 1단이 전송하는 미션 대기 동기화에 버저 음소거 상태를 포함해, 각 보드에
  따로 남아 있던 NVS 설정 때문에 2단 미션 버저만 조용해지는 문제를
  제거했습니다.
- 미션 이벤트·출력·발사 대기 버저 패턴에 통신 단절 반복 경고보다 높은
  재생 우선순위를 부여했습니다. 통신 경고는 미션음이 끝나면 자동으로
  다시 재생됩니다.
- 1단 단분리 이벤트 재전송이 매번 현재 T+를 단분리 시각으로 덮어쓰던
  문제를 수정했습니다. 2단은 최초 단분리 시각만 고정해 사용합니다.
- 보드 간 시계 오차로 단분리 시각이 잠시 미래가 되더라도 unsigned 시간
  언더플로가 2단 사출 백업을 즉시 만료시키지 않도록 검증을 추가했습니다.
  2단 서보 CH1은 단분리 후 최소 8초 전에는 어떤 자동 경로에서도
  작동할 수 없습니다.

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

## 0.13.0 — v6 b77 / in-flight reboot recovery — 2026-08-01

- T+ 권한 확정, 1단 단분리, 2단 물리 분리·점화 시점에 CRC가 포함된
  이중 슬롯 미션 체크포인트를 저장합니다. 평상시 루프에서는 플래시를
  쓰지 않고 RTC 메모리만 갱신해 저장 지연과 NVS 마모를 억제했습니다.
- 브라운아웃, 패닉, 워치독 재부팅 시 보드 S/N과 단 역할이 일치하는
  진행 중 체크포인트만 복구합니다. 정상 전원 투입·수동 재부팅·완료된
  미션에서는 복구 데이터를 폐기해 과거 비행이 재실행되지 않습니다.
- 복구 후 T+·단분리·점화 타이머를 RTC 경과시간까지 포함해 이어가며,
  이미 실행된 파이로 출력은 재인가하지 않습니다. 사출 전 상태에서는
  기존 어포지/백업 조건을 계속 감시합니다. 1단 단분리 이후 복구 시에는
  파이로와 분리해 안전하게 CH1 서보 유지 각도만 다시 인가합니다.

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

## 0.12.15 — v6 b76 / dedicated STAGE 2 Hall input — 2026-08-01

- 1단부의 ARM 입력은 PCB의 기존 GPIO2 풀다운 회로로 복원했습니다.
- 2단부에서는 GPS를 비활성화하고 기존 GPS RX인 GPIO5를 A3144 Hall
  전용 입력으로 재할당했습니다. A3144의 오픈컬렉터 출력에 맞춰 GPIO5는
  3.3V 내부 풀업을 사용하며 `LOW=장착`, `HIGH=단분리`로 판정합니다.
- 보드 단 번호를 바꾸면 GPS/Hall 핀 점유와 입력 모드를 즉시 다시
  설정합니다. 2단 점화 권한 동기화, 점화 복구 및 파이로 펄스 종료
  보강은 그대로 유지합니다.

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

## 0.12.14 — v6 b75 / persistent Hall electrical mode — 2026-08-01

- STAGE 2 A3144의 풀업과 active-low 해석을 현재 통신 역할이 아니라 영구 저장된 보드 번호에 고정했습니다.
- 보드 단 번호를 변경하는 즉시 ARM GPIO 전기 설정을 다시 적용해, 재설정 중 풀다운 상태가 남지 않도록 했습니다.
- Hall 원시 HIGH/LOW 변화와 정규화된 장착 상태를 직렬 로그에 추가했습니다.

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

## 0.12.13 — v6 b74 / A3144 Hall input correction — 2026-08-01

- STAGE 2 A3144 입력을 오픈컬렉터 출력에 맞는 `INPUT_PULLUP`으로 변경했습니다. STAGE 1 기계식 ARM 입력은 기존 `INPUT_PULLDOWN` 동작을 유지합니다.
- Hall 입력의 전기 설정과 `장착 LOW / 분리 HIGH` 극성을 지상국의 2단 운용 설정에서 분리했습니다. STAGE 2로 지정된 보드는 링크 연결 전에도 Hall 상태를 올바르게 해석합니다.
- STAGE 2 미션 실행 권한은 기존과 동일하게 지상국의 2단 운용 활성화가 필요하므로, 센서 수정이 단독으로 점화나 사출을 허용하지 않습니다.

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

## 0.12.12 — v6 b73 / stage-2 ignition authorization sync — 2026-08-01

- `2단 운용` 설정의 소유권을 지상국으로 한정했습니다. 에비오닉스는 로컬 값을 저장하거나 강제하지 않고 지상국 Discover 패킷으로 현재 운용 구성을 수신합니다.
- 1단부가 승인한 미션 대기 패킷에 안전모드·ARM 잠금·설비점검 상태를 함께 실어 2단부에 동기화합니다. 지상국 제어 대상이 1단부인 상태에서도 2단부가 미션 대기를 거부해 Hall 단분리 점화가 누락되는 문제를 수정했습니다.
- STAGE 2 점화 함수에 역할 및 안전모드 차단 로그를 추가해 점화 실패 원인이 더 이상 조용히 누락되지 않습니다.
- 미션 중 Pyro 펄스 만료를 주기적으로 처리하여 STAGE 2의 CH1 1초 출력이 정확히 OFF 되도록 보강했습니다.

## 0.12.11 — v6 b72 / stage-2 Hall ignition recovery — 2026-08-01

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 2단부 단분리 점화를 홀센서의 단일 `LOW→HIGH` 엣지에만 의존하지 않고,
  T+ 이후 디바운스가 끝난 물리적 HIGH 상태를 매 제어 틱에서 재검증하도록
  보강했습니다. 단간 이벤트와 홀센서 전환이 같은 시점에 겹쳐 엣지가
  누락되어도 단분리 상태를 복구하고 `PYRO CH1`을 즉시 1초간 출력합니다.
- 단분리 상태 기록, 단간 알림, 점화 출력을 하나의 함수로 통합해 엣지 경로와
  상태 복구 경로가 서로 다른 조건으로 동작하지 않도록 정리했습니다.

## 0.12.10 — v6 b71 / physical separation ignition and forced recovery finder — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 2단부에서 T+ 성립 후 홀센서가 `LOW→HIGH`로 확정되면, 단분리 무선
  이벤트가 누락되더라도 해당 제어 틱에서 즉시 `PYRO CH1`을 1초간
  출력합니다. 홀센서를 실제 단분리 권한과 복구 타이머 기준으로 사용합니다.
- 2단 사출 명령 후 파인딩 버저는 기존 음소거 저장값 및 이후 상태음과
  무관하게 반복 재생을 시작합니다. 사출 서보 구동 오류가 발생한 경우에도
  기체 회수를 위해 파인딩 버저를 가동합니다.
- 2단 점화 로그에 CH1 GPIO, 출력 유지시간 및 단분리 후 경과시간을 추가해
  현장 검증 시 실제 점화 경로를 바로 확인할 수 있게 했습니다.

## 0.12.9 — v6 b70 / recovery finder priority and alarm history — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 2단 사출 성공 후 반복 파인딩 버저를 시작하고, 이후 발생하는 통신 및
  상태 안내음이 회수용 버저를 덮어쓰지 못하도록 우선순위를 고정했습니다.
  명시적인 버저 정지 또는 음소거 명령은 계속 사용할 수 있습니다.
- 2단 홀센서와 단간 이벤트로 단분리를 확정한 직후 2단부 `PYRO CH1`을
  정확히 1초간 한 번만 출력하도록 점화 펄스를 미션 시퀀스에 고정했습니다.
- FLASH6 화면 최상단에 알람 목록 펼침 버튼을 추가했습니다. 세션 중 발생한
  알림을 최신순으로 누적하며, 읽지 않은 알림과 반복 알림을 함께 관리합니다.

## 0.12.8 — v6 b69 / stage-2 separation-based apogee recovery — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 2단 사출의 모든 시간 기준을 점화 시각에서 실제 1·2단 단분리 시각으로
  변경했습니다. 단간 이벤트가 끊긴 경우에는 2단 홀센서의 자석 이탈
  시각을 단분리 기준으로 사용합니다.
- 단분리 후 8.0초 이전의 어포지 전환은 조기 오검출로 한 번만 기록하고
  사출 명령에는 사용하지 않습니다. 이전에 이미 `DESCENT`로 바뀌었더라도
  8초 도달 시 재사용되지 않도록 상태가 아닌 전환 시각을 검증합니다.
- 단분리 후 8.0초부터 새로 확정된 어포지는 즉시 사출하며, 유효한 어포지가
  없으면 단분리 후 10.5초에 강제 사출합니다. 설정 최소값도 8.0초로
  제한하고 기존 5초 공장 기본값은 설정 버전 3에서 10.5초로 이전합니다.

## 0.12.7 — v6 b68 / UI finding buzzer control — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- FLASH6 컨트롤 패널에서 현재 선택한 STAGE 1/2의 파인딩 버저를 반복
  재생하고 다시 정지할 수 있도록 전용 제어를 추가했습니다.
- USB 직결과 A.I LINK 중계 경로 모두 `node`와 `loop` 인자를 처리하도록
  직렬 명령을 보강해, 지상국에서도 선택한 에비오닉스만 정확히 울립니다.

## 0.12.6 — v6 b67 / flight-controller boot chime — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 부팅음을 짧은 4단 상승 아르페지오와 고음 종지로 변경해 드론·비행
  컨트롤러 계열 장비처럼 정돈된 전원 인가음으로 다듬었습니다.
- 전체 재생 시간을 약 0.4초로 제한해 이후 A.I LINK 상태음을 가리지
  않도록 했으며, 다른 상태음과 파인딩 버저는 변경하지 않았습니다.

## 0.12.5 — v6 b66 / distinct operational buzzer cues — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 부팅, A.I LINK 모드 변경·연결·단절, 입력 확인·거부, 미션 경고,
  파이로·서보 출력, 미션 대기음을 서로 다른 음정 진행과 리듬으로
  재설계해 화면을 보지 않고도 상태를 구분할 수 있게 했습니다.
- 확인음은 짧은 단음, 거부음은 3단 하강, 출력음은 긴 단음, 미션
  경고는 고음-저음-고음, 대기 전환은 간격이 큰 상승 2음으로
  역할을 명확히 나눴습니다.
- 파인딩 버저와 회수 비콘 패턴은 변경하지 않았습니다.

## 0.12.4 — v6 b65 / link and boot sound polish — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- A.I LINK 연결음을 짧은 3단 상승형 `띠리링` 패턴으로 변경했습니다.
- 부팅 멜로디를 하드웨어 초기화 완료 후 시작하도록 옮겨, `setup()`
  실행 동안 첫 음이 길게 유지되던 문제를 제거했습니다.
- 파인딩 버저와 통신 단절 경고음은 변경하지 않았습니다.

## FLASH6 UI b168 — 2026-07-31

- A.I LINK 원격 펌웨어를 USB 지상국에 준비할 때 사용하는 Base64
  명령 청크를 레거시 보드에서도 안전한 128바이트로 제한했습니다.
- 이전 펌웨어 또는 USB 수신 한도에서 원격 업데이트가
  `LINE_TOO_LONG`으로 중단되는 문제를 수정했습니다.

## 0.12.3 — v6 b64 / operational update gate — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- USB·Wi-Fi·A.I LINK 펌웨어 업데이트의 안전모드 및 ARM 잠금 필수
  조건을 제거했습니다.
- 시퀀스 실행, 미션 대기, 파이로 출력 중에는 기존처럼 업데이트를
  차단하며 A.I LINK 직결 품질·비행 상태·S/N 검사는 유지합니다.
- 로컬 및 원격 보드 사전검사와 FLASH6 준비 상태 표시를 동일한
  운용 조건으로 통일했습니다.

## FLASH6 UI b167 — 2026-07-31

- 업데이트 준비 카드에서 안전모드·ARM 잠금 항목을 제거하고
  시퀀스 정지 및 미션 대기 해제 상태를 표시합니다.
- 최종 확인 안내와 업데이트 버튼 활성 조건도 새 운용 조건에
  맞게 변경했습니다.

## 0.12.2 — v6 b63 / unified buzzer language — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 파인딩 및 회수 비콘 패턴은 그대로 유지하고, 부팅·링크·버튼·시퀀스·
  파이로·미션 알림음을 짧은 공통 사운드 체계로 재설계했습니다.
- 정상 확인은 짧은 상승 2음, 거부·중단은 하강 2음, 일반 입력은
  짧은 단음, A.I LINK 단절은 일정 간격의 2펄스로 통일했습니다.
- 8음 부팅음과 5음 연결음을 각각 3음·2음으로 줄이고, 물리 버튼을
  길게 누른 뒤 선택 횟수를 다시 반복하던 중복 비프를 제거했습니다.
- 각 파일에 흩어진 파이로 출력·미션 경고·대기 전환 음을 의미별
  공통 함수로 묶어 이후 음향 조정을 한 곳에서 수행할 수 있습니다.

## 0.12.1 — v6 b62 / confirmed firmware update — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- USB·Wi-Fi·A.I LINK 펌웨어 업데이트에서 보드 물리 버튼 인증 조건을
  제거하고, 안전모드·ARM 잠금·비행 및 시퀀스 정지 검사는 그대로
  유지했습니다.
- A.I LINK 업데이트는 기존과 같이 대상 직결 연결, 최신 텔레메트리,
  RSSI, 손실률, 수신 Hz, 보드 S/N까지 모두 통과해야 시작됩니다.
- 업데이트 완료 시 역할 설정용 물리 인증 상태를 소비하지 않도록
  분리해 보드 역할 변경 인증과 펌웨어 업데이트를 독립시켰습니다.

## FLASH6 UI b166 — 2026-07-31

- 업데이트 시작 전에 대상 보드, 전송 경로, 펌웨어 파일을 다시
  보여주는 전용 최종 확인 화면을 추가했습니다.
- 펌웨어 업데이트 준비 화면의 물리 인증 항목과 관련 안내를 제거하고
  안전모드·ARM 잠금 상태만 명확하게 표시합니다.
- 최종 확인 후에도 펌웨어가 실제 전송 직전에 모든 안전·링크 조건을
  다시 검사하므로 상태가 바뀐 경우 업데이트를 차단합니다.

## 0.12.0 — v6 b61 / guarded A.I LINK firmware OTA — 2026-07-31

Protocol: `Flash6-Intelligent-b14`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 지상국과 바로 앞에 둔 1단·2단 에비오닉스에 A.I LINK 직결 경로로
  프로젝트 펌웨어를 전송하고, 대상 보드가 자체 검증 후 OTA
  파티션에 적용하도록 확장했습니다.
- FLASH6가 지상국에 Wi-Fi 또는 USB로 연결된 경우 모두 같은 원격
  업데이트 절차를 지원하며, 대상 선택과 전송 진행률·실측 속도·예상
  완료 시간을 펌웨어 업데이트 모달에 표시합니다.
- 전송 시작 전에 지상국과 대상의 비행·시퀀스·파이로 상태, 안전모드,
  ARM 잠금, 직결 링크, 최근 텔레메트리, RSSI, 손실률, 수신 Hz 및
  보드 S/N을 검사합니다. 조건을 만족하지 않으면 데이터를 보내기
  전에 차단 사유 모달을 표시합니다.
- 원격 업데이트 중에는 일반 텔레메트리·센서·저장 작업을 멈추고
  A.I LINK 전송과 ACK에 자원을 집중하며, 전송 구간에서는 ESP-NOW
  PHY 속도를 높였다가 완료·오류 시 원래 속도로 복구합니다.
- 기존 보드와의 단계적 업데이트 중 링크가 끊기지 않도록 A.I LINK
  기본 프레임 버전은 호환 가능한 `11`을 유지하고, 추가 패킷 코드로
  OTA 기능을 확장했습니다.
- USB 이미지 준비가 중단되면 60초 뒤 임시 버퍼와 세션을 정리하고,
  로컬 OTA와 원격 이미지 준비가 동시에 실행되지 않도록 보호합니다.

## FLASH6 UI b165 — 2026-07-31

- 펌웨어 업데이트 모달에 현재 보드·STAGE 1·STAGE 2 대상 선택과
  A.I LINK 사전 점검 차단 화면을 추가했습니다.
- 비행 중, 직결 링크 없음, RSSI 저하, 높은 손실률, 낮은 수신률,
  안전모드·ARM 잠금 미적용 등 차단 원인을 한국어로 안내합니다.
- 지상국에 이미지를 준비하는 시간과 실제 무선 전송 시간을 분리해
  진행률과 남은 시간이 잘못 섞이지 않도록 수정했습니다.

## 0.11.8 — v6 b60 / ground A.I LINK disconnect buzzer — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b13`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 지상국 경로가 조기 반환되어 A.I LINK 단절 버저 검사가 실행되지
  않던 문제를 수정했습니다.
- 지상국은 연결 이력이 있는 1단·2단 링크를 개별 감시하며, 활성
  운용 단의 텔레메트리가 단절 기준을 넘기면 경고 패턴을 반복합니다.
- 한 단의 링크가 복구되더라도 다른 단의 단절이 남아 있으면 경고를
  유지하고, 모든 단절 링크가 복구된 뒤에만 연결 멜로디로 전환합니다.
- 2단 운용을 끄거나 바인딩을 삭제하면 해당 단의 경고 이력을 함께
  정리해 의도하지 않은 잔류 버저를 방지합니다.

## FLASH6 UI b164 — 2026-07-31

- PlatformIO 업로드 전 브라우저 내부 핸드오프에 응답하지 않는 경우,
  USB 포트를 실제로 점유한 macOS 브라우저의 FLASH6 탭만 업로드 동안
  임시 해제하고 종료 후 원래 주소로 자동 복원합니다.
- 브라우저 전체를 종료하지 않으며 다른 탭에는 영향을 주지 않습니다.
- FLASH6 런타임에 명시적인 Web Serial 해제·재연결 API를 추가해
  로컬 파일 폴링과 브라우저 직접 요청이 같은 정리 절차를 사용합니다.

## FLASH6 UI b163 — 2026-07-31

- 로컬 FLASH6가 Web Serial 포트를 사용 중이어도 PlatformIO USB 업로드
  시작 신호를 감지해 reader/writer와 포트를 먼저 자동 해제합니다.
- 포트가 실제로 해제된 것을 확인한 뒤에만 esptool 업로드를 시작해
  `busy` 충돌을 방지하고, 업로드가 끝난 뒤에는 기존 시리얼 연결을
  자동으로 다시 시도합니다.

## 0.11.7 — v6 b59 / FLASH6 dual-stage gyro zero b162 — 2026-07-31

Protocol unchanged: `Flash6-Intelligent-b13`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 자이로 영점 실행 전에 1·2단부를 지면 기준 90° 수직 자세로
  고정하도록 안내하는 확인 모달을 추가했습니다.
- 지상국에서는 현재 링크 선택과 무관하게 1단과 2단에 영점 명령을
  각각 전송합니다. USB 시리얼 연결에서는 두 보드의 원격 실행
  응답을 개별 확인합니다.
- USB 시리얼 `/gyro_zero` 명령에도 `node=1|2` 대상 지정을 추가해
  HTTP 연결과 동일하게 두 단을 개별 보정할 수 있습니다.
- 리플레이의 자이로 영점은 기존처럼 현재 재생 화면에만 적용합니다.

## FLASH6 UI b161 — 2026-07-31

- 지상국의 1·2단 텔레메트리와 중계 경로에서도 직접 연결과 동일한
  자이로 UI 축 변환을 적용하도록 통일했습니다.
- 궤적 계산용 자세 쿼터니언과 기체 표시용 쿼터니언을 분리해,
  통신 경로가 전환될 때 롤·피치·요 방향이 달라지는 문제를
  제거했습니다.

## 0.11.6 — v6 b58 / FLASH6 bidirectional stage relay b160 — 2026-07-30

Protocol: `Flash6-Intelligent-b13`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 1단의 지상국 직통 링크가 끊기고 2단 직통 링크가 살아 있으면
  2단이 1단 패킷을 지상국으로 자동 역중계하도록 확장했습니다.
- 중계 보드는 중계 전용으로 전환되지 않으며 자기 텔레메트리와
  상대 단의 원본 패킷을 함께 전송합니다. 지상국은 원본 노드 ID로
  두 단의 데이터를 계속 분리합니다.
- 텔레메트리뿐 아니라 명령, ACK, 저장공간 조회와 응답도 선택된
  양방향 중계 경로를 사용합니다.
- 각 에비오닉스가 지상국 직통 경로의 생존 상태를 패킷에 표시하고,
  중계된 프레임은 재중계하지 않아 경로 루프와 불필요한 플래핑을
  방지합니다.
- FLASH6 통신 화면과 스트림에 1단/2단의 `direct`, `relay`,
  `offline` 경로 상태를 추가했습니다.

## 0.11.5 — v6 b57 / FLASH6 stage-2 apogee ejection b159 — 2026-07-30

Protocol unchanged: `Flash6-Intelligent-b12`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 2단 SERVO CH1 사출의 주 조건을 고정 점화 타이머에서 로컬 비행
  상태의 어포지 통과(`DESCENT`) 검출로 변경했습니다.
- 이론 연소시간 1.7초 중 사출되는 것을 막기 위해 2단 점화 후
  2.5초 동안 사출 명령을 금지합니다.
- 어포지가 검출되지 않으면 기존 설정값인 점화 후 5초에 백업 사출을
  실행합니다.
- 미션 알람과 직렬 로그에 어포지 사출과 백업 타이머 사출 원인을
  구분해 기록합니다.
- FLASH6 미션 설정과 미션 대기 확인 화면에서 2단 사출 시간이
  주 조건이 아니라 백업 시간임을 명확하게 표시합니다.

## FLASH6 UI b158 — 2026-07-30

- Changed the hidden replay dock restore control into a compact bottom-center pull handle.
- Kept the handle flush with the viewport edge so only a small tab protrudes above the bottom boundary without covering HUD telemetry.

## FLASH6 UI b157 — 2026-07-30

- Moved the replay dock restore control from the center HUD area to a compact right-edge tab so it no longer covers the flight-state timeline.
- Reserved a dedicated right-side control area inside the replay dock for hide and exit actions, preventing overlap with seek, speed, and alarm controls.
- Replaced the wide restore label and ambiguous minimize mark with compact directional icons.

## FLASH6 UI b156 — 2026-07-30

- 리플레이 하단 재생바를 접고 다시 펼칠 수 있는 컨트롤을 추가했습니다.
- 재생바를 숨겨도 리플레이 재생 위치와 상태는 유지됩니다.
- 카메라/자이로 화면에서는 접힌 재생바 높이를 회수해 화면을 전체
  높이로 사용합니다.

## FLASH6 UI b155 — 2026-07-30

- 리플레이 하단 재생바에 알람 이벤트 토글과 이벤트 개수 표시를
  추가했습니다.
- 리플레이 알람 목록은 기본적으로 닫혀 있으며 사용자가 토글을 켠
  경우에만 표시됩니다.
- 리플레이 재생 중 알람 토스트가 자동으로 화면을 가리지 않도록
  변경했습니다. 실시간 운용 알람 동작은 그대로 유지됩니다.

## 0.11.4 — v6 b56 — 2026-07-29

Protocol unchanged: `Flash6-Intelligent-b12`

Storage record protocol unchanged: `HWLOGV2` version `9`

- USB 명령 처리와 같은 루프에서 OTA 세션이 시작되면 루프 시작 시각이
  OTA 시작 시각보다 과거가 되어 unsigned 경과시간이 언더플로되던
  문제를 수정했습니다.
- OTA 유휴 타임아웃은 명령 처리 후의 최신 시각으로 계산됩니다. 따라서
  `/firmware/begin` 직후 첫 청크가 오기 전에 `TRANSFER_TIMEOUT`으로
  세션이 종료되지 않습니다.
- FLASH6 UI 자산 버전을 `b154`로 갱신했습니다.

## 0.11.3 — v6 b55 — 2026-07-29

Protocol unchanged: `Flash6-Intelligent-b12`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 기존 펌웨어의 256바이트 USB RX 큐에서도 Base64 명령 한 줄 전체가
  들어가도록 USB 업데이트 청크를 128바이트로 제한했습니다.
- 청크 그룹을 보내기 전부터 펌웨어 ERR 응답을 별도로 감시해 최초
  오류가 후속 `UPDATE_NOT_ACTIVE`에 가려지지 않도록 수정했습니다.
- 실패 처리 시 보드 상태와 원래 종료 사유를 먼저 조회하며, 업데이트가
  실제로 활성 상태일 때만 abort를 전송합니다.
- 새 펌웨어는 손상된 Base64 프레임과 오프셋 불일치만으로 전체 OTA
  세션을 폐기하지 않습니다. 기록 위치를 조회한 뒤 해당 지점부터
  안전하게 재개할 수 있습니다.
- FLASH6 UI 자산 버전을 `b153`으로 갱신했습니다.

## 0.11.2 — v6 b54 — 2026-07-29

Protocol unchanged: `Flash6-Intelligent-b12`

Storage record protocol unchanged: `HWLOGV2` version `9`

- USB 펌웨어 전송 확인 단위를 32KB 진행 ACK에서 2KB 상태 확인으로
  변경했습니다. 브라우저는 네 개 청크를 보낸 직후 보드가 실제 기록한
  오프셋을 확인하므로 작은 USB 큐에 데이터가 누적되지 않습니다.
- 일부만 기록된 경우 보드가 보고한 정확한 오프셋부터 이어 보내며,
  확인 응답은 최대 3회 재시도합니다. 전송 상태 조회도 유효한 활동으로
  처리하고 보드 측 유휴 제한을 60초로 늘렸습니다.
- 업데이트가 진행되는 동안 일반 설정·상태 동기화 명령이 동일한 USB
  writer에 끼어들지 못하도록 펌웨어 전송 전용 잠금을 적용했습니다.
- FLASH6 UI 자산 버전을 `b152`로 갱신했습니다.

## 0.11.1 — v6 b53 — 2026-07-29

Protocol unchanged: `Flash6-Intelligent-b12`

Storage record protocol unchanged: `HWLOGV2` version `9`

- USB 펌웨어 업데이트가 여러 Base64 청크를 한 번에 밀어 넣어 수신 큐가
  포화되고 진행 ACK가 유실되던 경로를 수정했습니다. UI는 512바이트
  청크를 순차 전송하고 짧게 페이싱합니다.
- 진행 ACK가 늦거나 유실되면 업데이트를 즉시 실패시키지 않고 보드의
  `/firmware/status`에서 실제 기록 위치를 조회해 해당 오프셋부터 최대
  3회 이어 전송합니다. 시작·전송·검증 타임아웃도 구분해 표시합니다.
- 네이티브 USB 수신 버퍼를 8KB로 확대하고 업데이트 중 시리얼 처리량을
  루프당 256바이트에서 4KB로 높였습니다. 업데이트 중에는 기존처럼
  센서·A.I LINK·로깅·주기 텔레메트리를 중단합니다.
- FLASH6 UI 자산 버전을 `b151`로 갱신했습니다.

## 0.11.0 — v6 b52 — 2026-07-29

Protocol updated: `Flash6-Intelligent-b11` → `Flash6-Intelligent-b12`

Storage record protocol unchanged: `HWLOGV2` version `9`

- FLASH6 설정에서 직접 연결된 보드의 `firmware.bin`을 업데이트하는
  로컬 펌웨어 업데이터를 추가했습니다. USB WebSerial과 지상국 Wi-Fi
  HTTP 업로드를 지원하며 A.I LINK 중계 업데이트는 허용하지 않습니다.
- 업데이트 시작 전에 ESP32-S3 이미지 매직, FLASH6 대상 문자열, 파일
  크기와 SHA-256을 검증합니다. 보드에서도 전체 이미지를 다시 해시해
  일치할 때만 OTA 파티션을 부팅 대상으로 확정합니다.
- 물리 버튼 6회 입력 후 길게 누르는 인증, 안전 모드, ARM 잠금, 유휴
  시퀀스 및 파이로 OFF 상태를 모두 만족해야 업데이트를 시작할 수
  있습니다. 전송 중에는 센서·A.I LINK·로깅·텔레메트리 출력을 멈추고
  OTA 쓰기와 검증에 처리 시간을 집중합니다.
- UI에 전송률, 전송량, 진행률과 남은 예상 시간을 표시하고 업데이트
  중 다른 조작을 차단합니다. 완료 후 보드가 자동 재부팅되며 OTA
  롤백 검증을 사용합니다.
- OTA는 애플리케이션 파티션만 교체하므로 영구 S/N, 바인드 슬롯,
  보정값, 미션 설정과 저장된 비행 데이터는 유지됩니다.
- 성공한 PlatformIO 빌드를 `FLASH6/firmware/firmware.bin`과
  `manifest.json`으로 자동 내보냅니다. 업데이트 UI는 프로젝트에
  포함된 이 펌웨어를 기본값으로 자동 불러오며, 별도 BIN 선택은 수동
  시험이 필요할 때만 사용합니다.
- FLASH6 UI 자산 버전을 `b150`으로 갱신했습니다.

## 0.10.3 — v6 b51 — 2026-07-29

Protocol unchanged: `Flash6-Intelligent-b11`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 보드 물리 버튼 6회 입력 후 길게 눌러 열린 보호 설정 모달에 로컬
  기기 S/N 초기화 기능을 추가했습니다. 별도의 2차 확인을 거친 뒤
  영구 S/N과 바인드 슬롯만 삭제하고 보드를 재부팅합니다.
- 자이로·기압·로드셀 보정값, 미션 및 시퀀스 설정은 S/N 초기화 대상에서
  제외했습니다. 재부팅 후 새 S/N이 생성되므로 지상국에서 다시
  바인드해야 합니다.
- 비행 시퀀스 또는 미션 대기 중에는 S/N 초기화를 거부하며, HTTP와
  USB 시리얼 경로 모두 물리 버튼 인증과 명시적 확인 토큰을 요구합니다.
- `BOARD_SERIAL_REGISTRY.xlsx`의 기존 등록을 모두 비웠습니다. 다음
  성공적인 펌웨어 업로드부터 새 S/N을 업로드 순서 1번으로 기록합니다.
- FLASH6 UI 자산 버전을 `b148`로 갱신했습니다.

## 0.10.2 — v6 b50 — 2026-07-29

Protocol unchanged: `Flash6-Intelligent-b11`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 보드 역할·단 위치·지상국 2단 운용 설정의 잠금 해제를 UI 버튼
  제스처에서 보드 물리 버튼 조작으로 변경했습니다. 변경하려는 보드의
  물리 버튼을 6회 누른 뒤 길게 눌러야 설정 모달이 열립니다.
- 비행 시퀀스와 미션 대기 중에는 역할 설정 잠금 해제를 거부하며,
  정상 대기 상태에서 인증된 뒤 60초 동안만 설정을 허용합니다.
- HTTP와 USB 시리얼 설정 경로도 물리 버튼 인증 상태를 확인합니다.
  UI를 우회해 역할 변경 명령을 보내도 거부하며, 설정이 적용되면 인증
  권한을 즉시 소모합니다.
- 1단 전용 지상국이 STAGE 2를 감지해 2단 운용 적용을 선택한 경우에도
  바로 변경하지 않고 지상국 물리 버튼 인증 후 설정 모달에서 최종
  확인하도록 통일했습니다.
- FLASH6 UI 자산 버전을 `b147`로 갱신했습니다.

## 0.10.1 — v6 b49 — 2026-07-29

Protocol: `Flash6-Intelligent-b11`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 각 보드가 최초 부팅 시 무작위 64비트 S/N을 한 번 생성하고 별도 NVS
  영역에 영구 저장합니다. 일반 초기화와 이후 펌웨어 업데이트에서는
  S/N을 다시 만들지 않습니다.
- A.I LINK 검색 패킷의 기기 식별자를 영구 S/N으로 전환하고, 지상국은
  STAGE 1·2 바인드 슬롯에 등록된 S/N과 일치하는 에비오닉스만 암호화
  피어로 연결합니다. 빈 바인드 슬롯은 검색만 허용합니다.
- 설정의 통신 화면에 지상국 S/N, STAGE 1·2 등록 상태, 주변 기기 S/N
  검색, 등록 및 삭제 UI를 추가했습니다. 바인드는 최대 2대로 제한하며
  같은 S/N을 두 슬롯에 중복 등록할 수 없습니다.
- HTTP와 USB 시리얼에 기기 식별·검색·바인드 API를 추가하고, 바인드가
  바뀌면 기존 피어와 대기 명령을 즉시 정리한 뒤 새 기기만 연결합니다.
- PlatformIO 업로드가 성공하면 보드의 `/identity` 응답을 읽어 프로젝트
  루트의 `BOARD_SERIAL_REGISTRY.xlsx`에 업로드 순서대로 자동 기록합니다.
  이미 존재하는 S/N은 추가하지 않고 건너뜁니다.
- S/N 등록용 업로드 후처리 함수의 인자 이름을 SCons 표준
  `target/source/env`와 일치시켜, 실제 펌웨어 기록과 검증이 끝난 뒤
  후처리 예외로 업로드 작업이 실패 표시되던 문제를 수정했습니다.
- 네이티브 앱 동기화 대상에 생성된 `flash6.runtime.js`를 포함해 Android와
  iOS가 웹 원본보다 오래된 UI 번들로 돌아가지 않도록 수정했습니다.
- VS Code Live Preview가 디스크의 최신 모듈 로더 대신 메모리에 남은
  구형 단일 `flash6.js` 번들을 응답해 신·구 UI가 섞이던 문제를
  방지했습니다. HTML은 새 `flash6-loader.js` 경로를 직접 사용하고,
  기존 파일은 오래된 배포 문서용 호환 별칭으로만 유지합니다.
- 같은 미리보기 서버가 최신 1.11 MB 스타일 대신 0.83 MB 구형
  `flash6.css`를 응답하던 문제도 새 `flash6-app.css` 경로로
  우회했습니다. 런타임과 스타일이 모두 동일 세대 파일로 로드됩니다.
- 단분리 이후 STAGE 1과 STAGE 2가 각자의 자세, 위치 및 필터 상태를
  독립적으로 누적합니다. 두 기체는 공통 상승 궤적에서 분기한 뒤 각각의
  기체와 궤적을 동시에 표시하며 동일한 공간 축척을 사용합니다.
- 지상국 릴레이 또는 USB 통신이 잠시 끊겨도 마지막 궤적과 카메라 상태를
  지우지 않고 유지합니다. 재연결 시 새 수신 지점부터 기존 궤적을 이어
  그리며, 명시적인 새 미션·리플레이·시뮬레이션 초기화에서만 지웁니다.
- 설정의 보드 역할·단 위치·2단 운용 변경을 일반 설정에서 분리했습니다.
  현재 역할 버튼을 6회 누른 뒤 길게 눌러야 보호 모달이 열리며, 모달의
  선택값은 `적용`을 누르고 보드 확인 응답을 받은 뒤에만 저장됩니다.
- 보호 모달은 지상국 역할에서 2단 운용 토글을, 에비오닉스 역할에서
  STAGE 1·2 위치 선택을 각각 노출해 서로 관계없는 설정을 숨깁니다.
- 1단 전용 지상국이 바인드된 STAGE 2 검색 신호를 감지하면 현재
  에비오닉스가 2단임을 알리고 2단 운용 적용 여부를 확인합니다. 해당
  패킷은 RX 큐에 넣지 않고 감지 시각만 기록해 1단 100 Hz 성능을
  유지하며, 주변의 미등록 보드는 경고 대상으로 취급하지 않습니다.
- FLASH6 UI 자산 버전을 `b146`으로 갱신했습니다.

## 0.9.17 — v6 b47 — 2026-07-28

Protocol unchanged: `Flash6-Intelligent-b10`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 저장공간 초기화 또는 로깅 상태 변경이 기록 쓰기와 겹쳐 일시적으로
  `BUSY`가 반환되면 A.I LINK가 명령을 버리지 않고 새 트랜잭션 번호로
  제한 횟수만큼 자동 재시도하도록 변경했습니다.
- 원격 초기화 명령에 STAGE 1/2 대상 노드를 명시해 저장공간 화면에서
  선택한 보드와 실제 초기화 대상이 달라지지 않도록 수정했습니다.
- FLASH6는 초기화 명령의 큐 등록만으로 성공 처리하지 않고 사용량,
  레코드 수, 로깅 상태가 실제 초기화 결과로 바뀔 때까지 확인합니다.
  확인이 늦으면 명령을 다시 전송하되 동일 목표 상태의 멱등 동작으로
  처리합니다.
- 비행데이터 로깅 ON/OFF는 전송 ACK 유실과 상태 반영 지연을 분리해
  실제 텔레메트리 상태를 최대 세 차례 확인하고 재요청합니다.
- FLASH6 UI 자산 버전을 `b140`으로 갱신했습니다.

## 0.9.16 — v6 b46 — 2026-07-28

Protocol unchanged: `Flash6-Intelligent-b10`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 비행데이터 로깅 명령을 A.I LINK 긴급 상태 명령으로 승격하고 같은
  목표 상태의 중복 명령을 병합합니다. 명령 ACK가 유실돼도 텔레메트리의
  저장 상태 비트로 적용 완료를 확인해 큐를 즉시 정리합니다.
- A.I LINK 원격 저장공간 상태 응답에 실제 에비오닉스의 로깅 상태를
  포함해 지상국 로컬 저장 상태와 혼동하지 않도록 수정했습니다.
- FLASH6는 명령 전송 성공만으로 ON/OFF를 확정하지 않고 실제 보드
  텔레메트리 확인을 기다립니다. 첫 확인이 지연되면 한 번 재전송하며,
  끝내 적용되지 않은 경우 기존 상태를 유지하고 원인을 명확히 알립니다.
- 저장공간 기본 화면의 바깥 오버레이·모달 본문·기록 목록 스크롤을
  모두 잠급니다. `데이터 전체 보기`를 누르면 요약과 설정은 숨기고
  전체 기록만 표시하는 확장 화면으로 전환하며 목록만 스크롤됩니다.
- 전체 기록 화면은 진입한 항목의 범위를 고정하여 APP, STAGE 1,
  STAGE 2 기록이 서로 섞이지 않도록 분리했습니다.
- 에비오닉스 저장공간 요약을 APP과 같은 평면형 3지표 구조로 통일하고
  중첩 카드와 별도 사용량 막대를 제거했습니다.
- 모달이 열린 동안 문서 스크롤과 기본 화면의 휠·터치 이동을 함께
  차단하고 전체 기록 화면의 목록에서만 세로 스크롤을 허용합니다.
- 저장공간 출처 선택 위의 중복 `저장 위치` 라벨을 제거했습니다.
- 기본 저장공간 모달을 조금 더 높이고 목록 영역을 고정 높이로 바꿔,
  기록이 없거나 개수가 달라도 모달 외곽 크기가 변하지 않게 했습니다.
- 저장공간 모달과 전체 기록 목록의 스크롤바 표시는 숨기되, 전체 기록
  화면에서는 휠과 터치 스크롤 동작을 그대로 유지합니다.
- FLASH6 UI 자산 버전을 `b139`로 갱신했습니다.

## 0.9.15 — v6 b45 — 2026-07-28

Protocol unchanged: `Flash6-Intelligent-b10`

Storage record protocol unchanged: `HWLOGV2` version `9`

- 2단 운용 시 저장공간 모달에서 `STAGE 1 / STAGE 2` 탭으로 단을
  선택하고, 선택한 에비오닉스의 용량·사용량·기록 목록만 표시합니다.
  두 단의 조회 결과는 유지하여 탭을 전환할 때 즉시 화면을 바꿉니다.
- 저장공간 상태와 기록 목록의 중복 섹션 제목·보조 문구·단별 기록 수
  헤더를 제거해 선택 탭과 실제 데이터에만 시선이 모이도록 정리했습니다.
- 기본 저장공간 모달에서는 최근 기록 3개만 표시하고 전체 스크롤을
  차단합니다. `데이터 전체 보기`를 선택한 경우에만 기록 목록 내부
  스크롤을 활성화합니다.
- A.I LINK 저장공간 목록·청크 요청에 대상 단 번호를 명시할 수 있게
  확장했습니다. 두 보드 목록은 무선 응답 슬롯 충돌을 피하도록 순차
  조회하며, 다운로드는 선택한 기록이 속한 단으로 끝까지 고정됩니다.
- 한쪽 보드가 응답하지 않아도 다른 쪽 저장공간과 기록은 계속 표시하고,
  응답이 없는 단만 독립적으로 재동기화하도록 복구 경로를 분리했습니다.
- FLASH6 UI 자산 버전을 `b132`로 갱신했습니다.

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
- 최근 비행 기록과 최근 선택 데이터는 목록에 최대 4개를 한 번에
  표시하고, 그 이상의 항목은 목록 내부 스크롤로 탐색하도록 변경했습니다.
- 리플레이 선택 모달의 `2단부 운용`을 토글로 변경했습니다. OFF에서는
  단일 파일 하나를, ON에서는 1단·2단 비행 데이터 두 개를 선택하며
  저장된 미션 동기화 정보를 검증해 하나의 리플레이로 병합합니다.
- FLASH6 UI 자산 버전을 `b128`로 갱신했습니다.

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
