import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.altis.mobile",
  appName: "ALTIS FLASH6",
  webDir: "www",
  android: {
    allowMixedContent: true
  },
  server: {
    // iOS/Android WebView app inside field AP scenario (http://192.168.4.1)
    androidScheme: "http",
    cleartext: true,
    allowNavigation: [
      "192.168.4.1",
      "altis.local"
    ]
  }
};

export default config;
