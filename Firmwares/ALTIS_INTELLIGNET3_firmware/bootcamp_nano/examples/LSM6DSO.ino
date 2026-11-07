// FLASH6 bootcamp: Arduino Nano (ATmega328P) + LSM6DSO.
// SDA -> A4, SCL -> A5, GND -> GND. Check module supply/logic voltage.
// Serial: 115200 baud, 20 samples/second. Acceleration in g, gyro in deg/s.
// Register reference: https://www.st.com/resource/en/datasheet/lsm6dso.pdf
#include <Arduino.h>
#include <Wire.h>

uint8_t sensorAddress = 0;
unsigned long lastSample = 0;
unsigned long lastProbe = 0;

bool readRegisters(uint8_t address, uint8_t reg, uint8_t *data, uint8_t count) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(address, count) != count) return false;
  for (uint8_t i = 0; i < count; ++i) data[i] = Wire.read();
  return true;
}

bool writeRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(sensorAddress);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool beginSensor() {
  for (uint8_t address = 0x6A; address <= 0x6B; ++address) {
    uint8_t id = 0;
    if (readRegisters(address, 0x0F, &id, 1) && id == 0x6C) {
      sensorAddress = address;
      if (!writeRegister(0x12, 0x01)) continue; // Restore register defaults.
      delay(50);
      // Block data update + register auto-increment; 104 Hz, +/-2 g, +/-250 dps.
      if (writeRegister(0x12, 0x44) && writeRegister(0x10, 0x40) &&
          writeRegister(0x11, 0x40)) {
        delay(100);
        return true;
      }
    }
  }
  sensorAddress = 0;
  return false;
}

int16_t littleEndian(const uint8_t *data) {
  return (int16_t)((uint16_t)data[0] | ((uint16_t)data[1] << 8));
}

void announceReady() {
  Serial.println(F("{\"type\":\"ready\",\"board\":\"nano\",\"sensor\":\"LSM6DSO\",\"protocol\":1}"));
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(100000);
  Wire.setWireTimeout(25000, true);
  announceReady();
  beginSensor();
}

void loop() {
  // Periodic identity also lets the browser recognize an already running sketch.
  if (millis() - lastProbe >= 2000) {
    lastProbe = millis();
    announceReady();
    if (!sensorAddress && !beginSensor()) {
      Serial.println(F("{\"type\":\"error\",\"sensor\":\"LSM6DSO\",\"message\":\"SENSOR_NOT_FOUND\"}"));
    }
  }
  if (!sensorAddress || millis() - lastSample < 50) return;
  lastSample = millis();
  uint8_t data[12];
  if (!readRegisters(sensorAddress, 0x22, data, sizeof(data))) {
    sensorAddress = 0;
    Serial.println(F("{\"type\":\"error\",\"sensor\":\"LSM6DSO\",\"message\":\"I2C_READ_FAILED\"}"));
    return;
  }
  Serial.print(F("{\"type\":\"telemetry\",\"sensor\":\"LSM6DSO\",\"ms\":"));
  Serial.print(lastSample);
  Serial.print(F(",\"ax\":")); Serial.print(littleEndian(data + 6) * 0.000061f, 4);
  Serial.print(F(",\"ay\":")); Serial.print(littleEndian(data + 8) * 0.000061f, 4);
  Serial.print(F(",\"az\":")); Serial.print(littleEndian(data + 10) * 0.000061f, 4);
  Serial.print(F(",\"gx\":")); Serial.print(littleEndian(data) * 0.00875f, 3);
  Serial.print(F(",\"gy\":")); Serial.print(littleEndian(data + 2) * 0.00875f, 3);
  Serial.print(F(",\"gz\":")); Serial.print(littleEndian(data + 4) * 0.00875f, 3);
  Serial.println('}');
}
