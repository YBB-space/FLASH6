# FLASH6 bundled firmware

`firmware.bin` is the ESP32-S3 application image compiled from
`Firmwares/ALTIS_INTELLIGNET3_firmware/src`. FLASH6 loads this bundled image by
default when the firmware-update screen opens.

Do not edit the binary or `manifest.json` manually. A successful
`platformio run` from the firmware project refreshes both files through
`Firmwares/ALTIS_INTELLIGNET3_firmware/tools/export_firmware_bundle.py`.

The updater writes only the OTA application partition. Persistent board S/N,
binding slots, calibration, settings, and stored flight records remain intact.
