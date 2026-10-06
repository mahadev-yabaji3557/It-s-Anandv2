#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>
#include <Adafruit_Fingerprint.h>
#include <SPI.h>
#include <FS.h>
#include <SD.h>

#include "Config.h"
#include "SystemState.h"
#include "LCDManager.h"
#include "BuzzerManager.h"
#include "OfflineQueueManager.h"
#include "AccessManager.h"
#include "AttendanceManager.h"
#include "BeamManager.h"
#include "FingerprintManager.h"
#include "WifiApiManager.h"

// ==============================================================================
// SMART CLASSROOM ATTENDANCE & ACCESS CONTROL SYSTEM (SAAC)
// PRODUCTION ESP32 FIRMWARE - INTEGRATED MODULAR ARCHITECTURE
// STRICT HARDWARE PIN MAP PRESERVED - ZERO PHYSICAL BUTTON DEPENDENCIES
// ==============================================================================

// Hardware Serial and Fingerprint Module Handle
HardwareSerial fingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fingerSerial);

// Shared Runtime System State
SystemState systemState;

// Modular System Managers (Single Active Implementations)
LCDManager lcdManager;
BuzzerManager buzzerManager(BUZZER_PIN);
OfflineQueueManager offlineQueue;
AccessManager accessManager(systemState, lcdManager, buzzerManager);
AttendanceManager attendanceManager(systemState, offlineQueue, lcdManager);
BeamManager beamManager(systemState, accessManager, attendanceManager, lcdManager, buzzerManager);
FingerprintManager fingerprintManager(&finger, systemState, accessManager, beamManager, offlineQueue, lcdManager, buzzerManager);
WifiApiManager wifiApiManager(systemState, accessManager, beamManager, offlineQueue, lcdManager, buzzerManager);

// Timing tracker for periodic offline queue sync
unsigned long lastOfflineSync = 0;

// ------------------------------------------------------------------------------
// HARDWARE INITIALIZATION
// ------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n==================================================");
  Serial.println("[BOOT] Initializing SAAC Edge Node (Firmware v2.3.0-production)");
  Serial.println("==================================================");

  // 1. Audio Signaling Initialization (Buzzer: GPIO 5)
  buzzerManager.begin();

  // 2. 16x2 I2C LCD Display Initialization (SDA: GPIO 21, SCL: GPIO 22, Addr: 0x27)
  lcdManager.begin();

  // 3. MG996R Barrier Servo (Signal: GPIO 18, 5V External PSU, Common GND)
  accessManager.begin();

  // 4. Optical Dual-Beam Sensors (Entry: GPIO 32, Exit: GPIO 33)
  // NOTE: Lasers are powered directly from 5V/GND. No ESP32 GPIO laser control.
  beamManager.begin();

  // 5. MicroSD Card (Dedicated SPI: SCK=14, MISO=19, MOSI=23, CS=13 at 1 MHz)
  if (offlineQueue.begin()) {
    systemState.sdReady = true;
  } else {
    systemState.sdReady = false;
    lcdManager.showMessage("SD CARD ERROR   ", "OFFLINE DISABLED", 2000);
  }

  // 6. R307 Optical Fingerprint Sensor (Hardware Serial 2: RX=16, TX=17 at 57600 baud)
  fingerSerial.begin(FINGERPRINT_BAUD, SERIAL_8N1, FINGERPRINT_RX_PIN, FINGERPRINT_TX_PIN);
  finger.begin(FINGERPRINT_BAUD);
  if (fingerprintManager.begin()) {
    systemState.fingerprintReady = true;
  } else {
    systemState.fingerprintReady = false;
    lcdManager.showMessage("FP SENSOR ERROR ", "CHECK HARDWARE  ", 2000);
  }

  // 7. Non-blocking Wi-Fi and Cloud API Manager Initialization
  wifiApiManager.setFingerprintManager(&fingerprintManager);
  wifiApiManager.begin();

  // Startup audio chime & transition to IDLE ready state
  buzzerManager.startPattern(2, 80, 80);
  accessManager.enterMode(MODE_IDLE, "Startup initialization complete");
}

// ------------------------------------------------------------------------------
// MAIN NON-BLOCKING EXECUTION LOOP (Section 29)
// ------------------------------------------------------------------------------
void loop() {
  unsigned long now = millis();

  // 1. Process backend commands (GET /api/esp/commands & ACK)
  wifiApiManager.updateCommands(now);

  // 2. Update Wi-Fi state & non-blocking auto-reconnect
  wifiApiManager.updateWifi(now);

  // 3. Update fingerprint state machine (scanning, verification, & enrollment)
  fingerprintManager.update(now,
    [&](const String& id, const String& status, const String& msg) {
      wifiApiManager.acknowledgeCommand(id, status, msg);
    },
    [&](int slot, const String& sId, const String& uUid, const String& cId) {
      wifiApiManager.reportEnrollResult(slot, sId, uUid, cId);
    }
  );

  // 4. Update beam / crossing state machine (unauthorized rejection & transit confirmation)
  beamManager.update(now);

  // 5. Update physical barrier servo (auto-close after hold time)
  accessManager.update(now);

  // 6. Update buzzer audio state machine (non-blocking tone generation)
  buzzerManager.update(now);

  // 7. Process offline queue synchronization when Wi-Fi is active
  if (systemState.wifiConnected && (now - lastOfflineSync >= OFFLINE_SYNC_INTERVAL_MS)) {
    lastOfflineSync = now;
    attendanceManager.syncOfflineQueue();
  }

  // 8. Send periodic device telemetry heartbeat (POST /api/esp/status)
  wifiApiManager.updateTelemetry(now);

  // 9. Update LCD display overlay hold timers and auto-restore live screen
  const char* modeText = (systemState.currentMode == MODE_BREAK) ? "SHORT BREAK" :
                         (systemState.currentMode == MODE_LECTURE) ? (systemState.activeSubject.length() ? systemState.activeSubject.c_str() : "LECTURE IN PROG") :
                         (systemState.currentMode == MODE_EMERGENCY) ? "EMERGENCY" :
                         "SCAN FINGER/OTP";
  lcdManager.update(now, systemState.occupancy, MAX_CLASSROOM_CAPACITY, modeText);
}