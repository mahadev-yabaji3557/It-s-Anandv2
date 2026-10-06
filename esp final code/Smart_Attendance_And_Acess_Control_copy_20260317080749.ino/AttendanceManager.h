#ifndef ATTENDANCE_MANAGER_H
#define ATTENDANCE_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "Config.h"
#include "SystemState.h"
#include "OfflineQueueManager.h"
#include "LCDManager.h"

class AttendanceManager {
private:
  SystemState& state;
  OfflineQueueManager& offlineQueue;
  LCDManager& lcd;

public:
  AttendanceManager(SystemState& sysState, OfflineQueueManager& queueMgr, LCDManager& lcdMgr)
    : state(sysState), offlineQueue(queueMgr), lcd(lcdMgr) {}

  // --- Record Confirmed Attendance (CALLED ONLY AFTER PHYSICAL CROSSING) ---
  void recordAttendanceEvent(const String& studentId, const String& name, const String& rollNo, const String& mode) {
    // Generate idempotent unique eventId
    String eventId = "att_" + String(DEVICE_ID) + "_" + String(millis()) + "_" + String(random(1000, 9999));

    StaticJsonDocument<512> doc;
    doc["classroom"] = CLASSROOM_ID;
    doc["fingerprintId"] = studentId;
    doc["studentId"] = studentId;
    doc["name"] = name;
    doc["rollNo"] = rollNo;
    doc["attendanceMode"] = mode;
    doc["crossingConfirmed"] = true; // Confirmed dual-beam transit
    doc["timestamp"] = String(millis());
    doc["eventId"] = eventId;
    doc["deviceId"] = DEVICE_ID;

    String body;
    serializeJson(doc, body);

    bool delivered = false;
    if (state.wifiConnected) {
      HTTPClient http;
      http.begin(String(BACKEND_BASE_URL) + "/api/esp/attendance");
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-esp-key", ESP_SECRET_KEY);
      int code = http.POST(body);
      if (code == 200 || code == 201) {
        delivered = true;
        Serial.println("[ATT] Attendance delivered to backend successfully.");
        lcd.showAttendanceSaved(rollNo.c_str());
      } else {
        Serial.printf("[ATT] Cloud post returned HTTP %d. Falling back to SD queue.\n", code);
      }
      http.end();
    }

    // Offline-first queueing if WiFi is unavailable or HTTP failed
    if (!delivered) {
      if (offlineQueue.enqueueEvent(body)) {
        lcd.showSdSaved();
      }
    }
  }

  // --- Record Access Event (Admin override, exit, timeout, unauthorized attempts) ---
  void recordAccessEvent(const String& eventType, const String& referenceId, const String& notes) {
    String eventId = "acc_" + String(DEVICE_ID) + "_" + String(millis()) + "_" + String(random(1000, 9999));

    StaticJsonDocument<512> doc;
    doc["classroom"] = CLASSROOM_ID;
    doc["eventType"] = eventType;
    doc["referenceId"] = referenceId;
    doc["notes"] = notes;
    doc["occupancy"] = state.occupancy;
    doc["deviceId"] = DEVICE_ID;
    doc["timestamp"] = String(millis());
    doc["eventId"] = eventId;

    String body;
    serializeJson(doc, body);

    if (state.wifiConnected) {
      HTTPClient http;
      http.begin(String(BACKEND_BASE_URL) + "/api/esp/access-event");
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-esp-key", ESP_SECRET_KEY);
      int code = http.POST(body);
      Serial.printf("[ACCESS_EVENT] Logged '%s' -> HTTP %d\n", eventType.c_str(), code);
      http.end();
    }
  }

  // --- Sync offline events to cloud when connection restored ---
  void syncOfflineQueue() {
    if (!state.wifiConnected || !offlineQueue.isReady()) return;

    offlineQueue.syncQueue([](const String& line) -> bool {
      HTTPClient http;
      http.begin(String(BACKEND_BASE_URL) + "/api/esp/attendance");
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-esp-key", ESP_SECRET_KEY);
      int code = http.POST(line);
      http.end();
      return (code == 200 || code == 201);
    });
  }
};

#endif // ATTENDANCE_MANAGER_H
