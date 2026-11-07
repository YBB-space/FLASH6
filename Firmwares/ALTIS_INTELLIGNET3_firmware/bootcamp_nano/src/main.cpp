// Each example is also a standalone Arduino IDE sketch.
#include <Wire.h> // Expose the dependency to PlatformIO's library finder.
#if defined(BOOTCAMP_LSM6DSO)
#include "../examples/LSM6DSO.ino"
#elif defined(BOOTCAMP_MPU6050)
#include "../examples/MPU6050.ino"
#else
#error "Select a bootcamp sensor in platformio.ini"
#endif
