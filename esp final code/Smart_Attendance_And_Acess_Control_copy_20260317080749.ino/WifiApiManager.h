#ifndef WIFI_API_MANAGER_H
#define WIFI_API_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "Config.h"
#include "SystemState.h"
#include "AccessManager.h"
#include "BeamManager.h"
#include "OfflineQueueManager.h"
#include "LCDManager.h"
#include "BuzzerManager.h"

// Forward declaration of FingerprintManager to prevent circular dependency
class FingerprintManager;

class WifiApiManager {
private:
  SystemState& state;
  AccessManager& accessManager;
  BeamManager& beamManager;
  OfflineQueueManager& offlineQueue;
  LCDManager& lcd;
  BuzzerManager& buzzer;
  FingerprintManager* fingerprintManager;

  unsigned long lastCommandPoll;
  unsigned long lastTelemetry;
  unsigned long lastWifiRetry;
  bool lastWifiStatus;

public:
  WifiApiManager(SystemState& sysState, AccessManager& am, BeamManager& bm,
                 OfflineQueueManager& oq, LCDManager& lcdMgr, BuzzerManager& bzMgr)
    : state(sysState), accessManager(am), beamManager(bm), offlineQueue(oq),
      lcd(lcdMgr), buzzer(bzMgr), fingerprintManager(nullptr),
      lastCommandPoll(0), lastTelemetry(0), lastWifiRetry(0), lastWifiStatus(false) {}

  void setFingerprintManager(FingerprintManager* fpMgr) {
    fingerprintManager = fpMgr;
  }

  void begin() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.println("[WIFI] Initiated non-blocking station connection.");
  }

  // --- Non-blocking Wi-Fi Monitoring & Reconnection (Section 24) ---
  void updateWifi(unsigned long now) {
    bool currentConnected = (WiFi.status() == WL_CONNECTED);
    state.wifiConnected = currentConnected;

    if (currentConnected != lastWifiStatus) {
      lastWifiStatus = currentConnected;
      if (currentConnected) {
        Serial.print("[WIFI] Connected! Assigned IP: ");
        Serial.println(WiFi.localIP());
        lcd.showMessage("WIFI CONNECTED  ", WiFi.localIP().toString().substring(0, 16).c_str(), 2000);
        // Refresh timetable & users cache from backend
        fetchTimetableCache();
        fetchUsersCache();
      } else {
        Serial.println("[WIFI] Connection lost. Engaging offline mode.");
        lcd.showOfflineMode();
      }
    }

    // Auto-reconnect attempt every 10 seconds if disconnected
    if (!currentConnected && (now - lastWifiRetry >= 10000)) {
      lastWifiRetry = now;
      WiFi.reconnect();
    }
  }

  // --- Command Polling & Execution (Section 16 & 17) ---
  void updateCommands(unsigned long now);

  // --- Telemetry Reporting (Section 25) ---
  void updateTelemetry(unsigned long now) {
    if (!state.wifiConnected) return;
    if (now - lastTelemetry < TELEMETRY_HEARTBEAT_MS) return;
    lastTelemetry = now;

    HTTPClient http;
    http.begin(String(BACKEND_BASE_URL) + "/api/esp/status");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-esp-key", ESP_SECRET_KEY);

    StaticJsonDocument<512> doc;
    doc["deviceId"] = DEVICE_ID;
    doc["classroom"] = CLASSROOM_ID;
    doc["firmwareVersion"] = FIRMWARE_VERSION;
    doc["ip"] = WiFi.localIP().toString();
    doc["freeHeap"] = ESP.getFreeHeap();
    doc["rssi"] = WiFi.RSSI();
    doc["occupancy"] = state.occupancy;
    doc["maxCapacity"] = MAX_CLASSROOM_CAPACITY;
    doc["barrierState"] = accessManager.isBarrierOpen() ? "Open" : "Locked";
    doc["lectureState"] = state.activeLectureStatus;
    doc["wifiConnected"] = state.wifiConnected;
    doc["sdReady"] = state.sdReady;
    doc["fingerprintReady"] = state.fingerprintReady;
    doc["emergencyState"] = accessManager.isEmergency();

    String body;
    serializeJson(doc, body);
    http.POST(body);
    http.end();
  }

  // --- Command Acknowledgment ---
  void acknowledgeCommand(const String& cmdId, const String& status, const String& message) {
    if (!state.wifiConnected || cmdId.length() == 0) return;

    HTTPClient http;
    http.begin(String(BACKEND_BASE_URL) + "/api/esp/command-ack");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-esp-key", ESP_SECRET_KEY);

    StaticJsonDocument<512> doc;
    doc["commandId"] = cmdId;
    doc["classroom"] = CLASSROOM_ID;
    doc["status"] = status;
    doc["message"] = message;
    doc["deviceId"] = DEVICE_ID;

    String body;
    serializeJson(doc, body);
    http.POST(body);
    http.end();
  }

  // --- Report Enrollment Result ---
  void reportEnrollResult(int slot, const String& studentId, const String& uid, const String& cmdId) {
    if (!state.wifiConnected) return;

    HTTPClient http;
    http.begin(String(BACKEND_BASE_URL) + "/api/esp/enroll-result");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-esp-key", ESP_SECRET_KEY);

    StaticJsonDocument<512> doc;
    doc["commandId"] = cmdId;
    doc["studentId"] = studentId;
    doc["uid"] = uid;
    doc["fingerprintId"] = String(slot);
    doc["status"] = "success";
    doc["deviceId"] = DEVICE_ID;

    String body;
    serializeJson(doc, body);
    http.POST(body);
    http.end();
  }

  // --- Cache Fetching ---
  void fetchTimetableCache() {
    if (!state.wifiConnected) return;
    HTTPClient http;
    http.begin(String(BACKEND_BASE_URL) + "/api/esp/timetable?classroom=" + String(CLASSROOM_ID));
    http.addHeader("x-esp-key", ESP_SECRET_KEY);
    int code = http.GET();
    if (code == 200) {
      String payload = http.getString();
      offlineQueue.saveCache(SD_TIMETABLE_CACHE_FILE, payload);
      Serial.println("[CACHE] Timetable cache updated on SD.");
    }
    http.end();
  }

  void fetchUsersCache() {
    if (!state.wifiConnected) return;
    HTTPClient http;
    http.begin(String(BACKEND_BASE_URL) + "/api/esp/users?classroom=" + String(CLASSROOM_ID));
    http.addHeader("x-esp-key", ESP_SECRET_KEY);
    int code = http.GET();
    if (code == 200) {
      String payload = http.getString();
      offlineQueue.saveCache(SD_USERS_CACHE_FILE, payload);
      Serial.println("[CACHE] Users cache updated on SD.");
    }
    http.end();
  }
};

#endif // WIFI_API_MANAGER_H
