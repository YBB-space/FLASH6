# FLASH6 Nano bootcamp

Set `window.FLASH6_BOOTCAMP_MODE` in `flash6.html`: `0` opens normal FLASH6;
`1` opens the bootcamp. Each lesson page fits the viewport.

Flow: welcome -> sensor -> Nano -> wiring diagram -> USB connection -> code
upload -> sensor data -> actual FLASH6 rocket model. Upload success requires
reading back every programmed page. Fresh, valid sensor data must arrive for
two seconds before the automatic 3D transition.

The 3D page mounts the original `#cameraView` dashboard, its `#gyro3dViewport`,
canvas, system status bar, data rail, two charts and four broadcast gauges.
The gauges show roll, pitch, acceleration magnitude and angular rate; charts
show the measured acceleration and gyro axes. The existing camera/grid and
orbit/zoom interactions are retained. A local attitude-zero button sits on
the right. The control center and mission controls are not initialized.
The same `3d/assembly.model`/3MF parser and IMU attitude functions are used.
Yaw is relative because these are six-axis sensors.

## Browser and USB

Use a desktop browser supporting Web Serial (Chrome, Edge or Whale), served over
HTTPS or localhost. The first connection requires the browser's port picker.
Previously permitted Nano ports reconnect automatically; ambiguous devices
require selection. Close Arduino IDE's serial monitor before connecting.

Uploads support ATmega328P Nano bootloaders at 115200 and 57600 baud, with
automatic DTR/RTS reset. The MCU signature is checked before writing. Only the
application area below 30720 bytes is written; bootloader/fuses are untouched.
After upload, the port reopens at 115200 baud to receive the selected sketch's
20 Hz JSON telemetry. No online compiler or separate upload service is needed.

## Source and generated assets

Firmware source of truth:
`Firmwares/ALTIS_INTELLIGNET3_firmware/bootcamp_nano/examples/*.ino`.
Both sketches use the bundled Arduino `Wire` library and probe the sensor's
two supported I2C addresses. The exported `.ino`, `.hex` and `manifest.json`
in `bootcamp/firmware` are generated; edit the firmware source and rebuild.

From `GCS_Projects/FLASH6`:

```sh
node scripts/build-flash6-bootcamp.cjs
node scripts/build-flash6-css.cjs
node scripts/build-flash6-runtime.cjs
node scripts/check-flash6-runtime.cjs
node scripts/check-flash6-bootcamp.cjs
```

The firmware builder invokes PlatformIO with its working directory set to
`Firmwares/ALTIS_INTELLIGNET3_firmware`. Set `FLASH6_PIO` to override the detected
PlatformIO executable. The protocol check uses a fragmented-stream Nano
emulator and checks both exported examples, old-bootloader fallback, readback
corruption, wrong MCU, unplug handling and reconnection. Physical USB upload
and WebGL display still require a connected Nano and a real browser.

Nano artwork: https://docs.arduino.cc/static/83bc6779ced774f96416b055b74fc552/image.svg
Pin locations: https://docs.arduino.cc/resources/pinouts/A000005-full-pinout.pdf
Serial API: https://developer.chrome.com/docs/capabilities/serial/
Bootloader protocol: https://github.com/arduino/ArduinoCore-avr/tree/master/bootloaders
