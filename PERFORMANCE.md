# ALTIS INTELLIGNET3 성능 검증 가이드

## 확인된 주요 병목

1. IMU 200 Hz 경로에서 이미 계산한 가속도 벡터 크기를 자세 필터가 다시 계산했고, 초기 자세에만 필요한 `atan2` 두 번과 `sqrt` 한 번을 정상 비행 중에도 매 샘플 실행했습니다.
2. 200 Hz 저장 레코드는 CRC 전에 모든 필드를 덮어쓰면서도 86바이트 큐 슬롯 전체를 매번 `memset`했습니다.
3. UI는 샘플 저장과 화면 렌더가 한 함수에 섞여 있어 100 Hz 수신마다 다단 카드 DOM 조회, 모바일 헤더 동기화, 차트 프리뷰 Canvas 렌더, 모달 렌더를 반복했습니다.
4. 단일 단계 텔레메트리를 다단 상태로 옮길 때 큰 최상위 객체를 샘플당 두 번 복사했습니다.
5. Web Serial 수신기는 한 USB 청크에 여러 줄이 있으면 매 줄마다 남은 전체 문자열을 다시 잘랐습니다.

## 적용한 최적화와 불변 조건

- 자세 필터는 `sampleImu()`가 구한 `accMag`를 재사용하며 초기 롤/피치 계산은 `attitudeValid == false`일 때만 수행합니다. Mahony 보정, 쿼터니언, 축 매핑과 출력값 계산식은 그대로입니다.
- 샘플 레코드의 전 필드 대입과 CRC 순서는 유지하면서 선행 zero-fill만 제거했습니다. 미션 알람처럼 예약/문자열 필드가 있는 레코드의 초기화는 유지합니다.
- 100 Hz 원시 데이터 저장, 이벤트 감지, 로그와 보고서 데이터는 유지하고 DOM/Canvas만 기존 `UI_SAMPLE_SKIP=6` 주기에 맞춰 분리했습니다.
- 다단 카드 DOM 노드를 최초 한 번 캐시하고 값 또는 클래스가 달라질 때만 씁니다.
- Flash Link 상태/보고서 샘플은 매 프레임 갱신하지만 무거운 모바일 헤더·토폴로지·차트 렌더는 UI 프레임에서만 실행합니다.
- 텔레메트리 배열 규격, JSON 필드 순서, 명령 문자열, HTTP/WebSocket/Web Serial 인터페이스는 변경하지 않았습니다.

## 호스트 핫패스 벤치마크

```bash
node --expose-gc benchmarks/performance_hotpaths.mjs
```

반복 횟수를 늘리려면 다음처럼 실행합니다.

```bash
BENCH_ITERATIONS=2000000 node --expose-gc benchmarks/performance_hotpaths.mjs
```

스크립트는 기존/개선 알고리즘을 같은 입력으로 실행하고 다단 병합과 시리얼 파싱 결과 체크섬이 다르면 실패합니다. JavaScript JIT과 호스트 상태에 따라 절대 시간은 달라지므로 `speedup`과 반복 실행 중앙값을 비교하십시오.

## 펌웨어 빌드 자원 비교

```bash
/Users/yunbobae/.platformio/penv/bin/pio run
```

PlatformIO 출력의 RAM/Flash 사용량을 이전 커밋과 비교합니다. 이번 변경 전 기준은 RAM 96,928바이트(29.6%), Flash 1,120,817바이트(21.4%)이고, `v6 b12` 빌드는 RAM 97,056바이트(29.6%), Flash 1,121,285바이트(21.4%)입니다. 느리게 변하는 직렬화 문자열 캐시에 RAM 128바이트, 코드에 Flash 468바이트를 추가로 사용합니다.

## 실제 보드 A/B 측정

동일 보드와 센서 상태에서 이전 커밋과 현재 커밋을 각각 60초 이상 측정합니다.

1. USB 921,600 baud, 단일 단계 100 Hz, 저장 200 Hz를 동일하게 설정합니다.
2. 정지 20초, 각 축 회전 20초, Flash Link 송수신 20초 순서로 같은 시험을 수행합니다.
3. 텔레메트리 `ct`(IMU 처리 µs), `lt`(샘플 주기 ms), `serial_drop`, `ws_drop`, `fl_rx_hz`, `fl_loss_permille`를 CSV로 저장합니다.
4. `ct`의 평균/p95/p99, `lt`의 5 ms 이탈률, 드롭 증가량, 명령 ACK 왕복시간을 비교합니다.
5. Chrome DevTools Performance에서 30초 기록 후 Main thread scripting/rendering 시간, Long Task 수, FPS를 비교합니다.

기대 기준은 정상 자세 상태에서 초기화용 초월함수 400회/초와 중복 제곱근 400회/초 제거, 샘플 큐 zero-fill 17.2 KB/초 제거, 다단 대시보드 selector 조회의 워밍업 이후 제거, 최악 기준 텍스트 쓰기 약 91.7% 감소입니다. 실제 보드 수치는 센서 I2C 시간과 브라우저/USB 환경을 포함하므로 위 절차로 최종 판정합니다.
