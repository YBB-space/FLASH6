# ALTIS FLASH6 Mobile Native

FLASH6 웹앱을 iOS/Android 앱으로 감싼 Capacitor 프로젝트입니다.

## 최초 1회

```bash
cd FLASH6/mobile_app_native
npm install
```

## 웹앱 변경 반영

루트 `FLASH6/flash6.html`, `FLASH6/flash6.js`, `scripts/`, `styles/`, 자산 폴더를 `www/`로 복사하고 네이티브 프로젝트에 동기화합니다.

```bash
npm run cap:sync
```

`node_modules/`, Android build output, iOS DerivedData, and native copied web assets are generated and intentionally not kept in source. Recreate them with `npm install` and the sync commands above.

## Android

Android 프로젝트가 없으면 최초 1회 생성합니다.

```bash
npm run android:add
```

변경 사항 동기화:

```bash
npm run android:sync
```

Android Studio 열기:

```bash
npm run android:open
```

디버그 APK 빌드:

```bash
npm run android:build
```

이 스크립트는 Homebrew `openjdk@21`을 `JAVA_HOME`으로 지정해서 실행합니다.

빌드 결과:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## iOS

```bash
npm run ios:sync
npm run ios:open
```

## 네트워크

Capacitor 설정에서 cleartext HTTP를 허용합니다. 필드 AP 환경의 `http://192.168.4.1` 및 `ws://192.168.4.1/ws` 접근을 위한 설정입니다.
