// FLASH6 bootcamp: Arduino Nano (ATmega328P) + MPU6050.
// SDA -> A4, SCL -> A5, GND -> GND. Check module supply/logic voltage.
// Serial: 115200 baud, 20 samples/second. Acceleration in g, gyro in deg/s.
// Register reference: https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Register-Map1.pdf
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
  for (uint8_t address = 0x68; address <= 0x69; ++address) {
    uint8_t id = 0;
    if (readRegisters(address, 0x75, &id, 1) && id == 0x68) {
      sensorAddress = address;
      if (!writeRegister(0x6B, 0x80)) continue; // Device reset.
      delay(100);
      // X gyro PLL clock; ~44 Hz filter, 100 Hz sampling, +/-250 dps, +/-2 g.
      if (writeRegister(0x6B, 0x01) && writeRegister(0x6C, 0x00) && writeRegister(0x1A, 0x03) &&
          writeRegister(0x19, 0x09) && writeRegister(0x1B, 0x00) &&
          writeRegister(0x1C, 0x00)) {
        delay(100);
        return true;
      }
    }
  }
  sensorAddress = 0;
  return false;
}

int16_t bigEndian(const uint8_t *data) {
  return (int16_t)(((uint16_t)data[0] << 8) | data[1]);
}

void announceReady() {
  Serial.println(F("{\"type\":\"ready\",\"board\":\"nano\",\"sensor\":\"MPU6050\",\"protocol\":1}"));
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
  if (millis() - lastProbe >= 2000) {
    lastProbe = millis();
    announceReady();
    if (!sensorAddress && !beginSensor()) {
      Serial.println(F("{\"type\":\"error\",\"sensor\":\"MPU6050\",\"message\":\"SENSOR_NOT_FOUND\"}"));
    }
  }
  if (!sensorAddress || millis() - lastSample < 50) return;
  lastSample = millis();
  uint8_t data[14];
  if (!readRegisters(sensorAddress, 0x3B, data, sizeof(data))) {
    sensorAddress = 0;
    Serial.println(F("{\"type\":\"error\",\"sensor\":\"MPU6050\",\"message\":\"I2C_READ_FAILED\"}"));
    return;
  }
  Serial.print(F("{\"type\":\"telemetry\",\"sensor\":\"MPU6050\",\"ms\":"));
  Serial.print(lastSample);
  Serial.print(F(",\"ax\":")); Serial.print(bigEndian(data) / 16384.0f, 4);
  Serial.print(F(",\"ay\":")); Serial.print(bigEndian(data + 2) / 16384.0f, 4);
  Serial.print(F(",\"az\":")); Serial.print(bigEndian(data + 4) / 16384.0f, 4);
  Serial.print(F(",\"gx\":")); Serial.print(bigEndian(data + 8) / 131.0f, 3);
  Serial.print(F(",\"gy\":")); Serial.print(bigEndian(data + 10) / 131.0f, 3);
  Serial.print(F(",\"gz\":")); Serial.print(bigEndian(data + 12) / 131.0f, 3);
  Serial.println('}');
}
