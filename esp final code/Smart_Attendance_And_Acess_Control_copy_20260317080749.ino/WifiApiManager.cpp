#include "WifiApiManager.h"
#include "FingerprintManager.h"

void WifiApiManager::updateCommands(unsigned long now) {
  if (!state.wifiConnected) return;
  if (now - lastCommandPoll < COMMAND_POLL_INTERVAL_MS) return;
  lastCommandPoll = now;

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/api/esp/commands?classroom=" + String(CLASSROOM_ID) + "&limit=5";
  http.begin(url);
  http.addHeader("x-esp-key", ESP_SECRET_KEY);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(4096);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc["ok"].as<bool>()) {
      JsonArray commands = doc["commands"].as<JsonArray>();
      for (JsonObject cmdObj : commands) {
        String cmdId = cmdObj["commandId"].as<String>();
        String command = cmdObj["command"].as<String>();
        JsonObject p = cmdObj["payload"];

        Serial.printf("[CMD] Processing: %s (ID: %s)\n", command.c_str(), cmdId.c_str());

        // 1. EMERGENCY COMMAND (Software Activated - Highest Priority)
        if (command == "emergency") {
          beamManager.clearPending();
          accessManager.enterMode(MODE_EMERGENCY, "Dashboard emergency command");
          acknowledgeCommand(cmdId, "executed", "Emergency evacuation activated");
        }
        // 2. RESET EMERGENCY COMMAND
        else if (command == "reset_emergency") {
          accessManager.enterMode(MODE_IDLE, "Emergency reset from dashboard");
          acknowledgeCommand(cmdId, "executed", "Emergency cleared. System ready");
        }
        // 3. ADMIN OVERRIDE COMMAND (Software Activated)
        else if (command == "admin_override") {
          if (!accessManager.isEmergency()) {
            accessManager.enterMode(MODE_ADMIN_OVERRIDE, "Admin override from dashboard");
            beamManager.setPendingAdminOverride(cmdId);
            accessManager.openBarrier();
            acknowledgeCommand(cmdId, "executed", "Barrier opened under Admin Override");
          } else {
            acknowledgeCommand(cmdId, "failed", "Cannot override while Emergency is active");
          }
        }
        // 4. SHORT BREAK COMMAND (Start / End)
        else if (command == "start_short_break" || command == "short_break") {
          if (!accessManager.isEmergency()) {
            accessManager.enterMode(MODE_BREAK, "Short break initiated by Faculty/HOD");
            acknowledgeCommand(cmdId, "executed", "Short break mode engaged");
          } else {
            acknowledgeCommand(cmdId, "failed", "Emergency active; break denied");
          }
        } else if (command == "end_short_break") {
          if (accessManager.getMode() == MODE_BREAK) {
            accessManager.enterMode(state.activeLectureStatus == "In Progress" ? MODE_LECTURE : MODE_IDLE, "Short break concluded");
            acknowledgeCommand(cmdId, "executed", "Short break ended");
          } else {
            acknowledgeCommand(cmdId, "failed", "Not currently in short break mode");
          }
        }
        // 5. LECTURE LIFECYCLE (Start / End)
        else if (command == "start_lecture") {
          state.activeLectureStatus = "In Progress";
          state.activeSubject = p["subject"].as<String>();
          state.activeFaculty = p["faculty"].as<String>();
          accessManager.enterMode(MODE_LECTURE, "Lecture started");
          acknowledgeCommand(cmdId, "executed", "Lecture session active");
        } else if (command == "end_lecture") {
          state.activeLectureStatus = "Completed";
          state.activeSubject = "";
          state.activeFaculty = "";
          accessManager.enterMode(MODE_IDLE, "Lecture completed");
          acknowledgeCommand(cmdId, "executed", "Lecture session ended");
        }
        // 6. STUDENT OTP ACCESS AUTHORIZATION (Follows Physical Crossing Rule)
        else if (command == "otp_access") {
          if (!accessManager.isEmergency()) {
            // Check capacity first
            if (accessManager.isFull()) {
              acknowledgeCommand(cmdId, "failed", "Classroom full; OTP entry denied");
              lcd.showClassFull(state.occupancy, MAX_CLASSROOM_CAPACITY);
              buzzer.beepDenied();
              continue;
            }

            String studentUid = p["studentUid"].as<String>();
            String studentName = p["studentName"].as<String>();
            String rollNo = p["rollNo"].as<String>();

            // CRITICAL:
            // Registers pending authorization and opens barrier.
            // Attendance is NOT marked here. It is strictly deferred until confirmed physical crossing!
            beamManager.setPendingSession(studentUid, studentName, rollNo, "", METHOD_OTP, cmdId);
            accessManager.openBarrier();
            lcd.showMessage("OTP VERIFIED    ", "PLEASE ENTER    ", 2000);
            buzzer.beepGrant();

            acknowledgeCommand(cmdId, "executed", "OTP access granted. Barrier open awaiting crossing.");
          } else {
            acknowledgeCommand(cmdId, "failed", "Cannot grant OTP entry during emergency.");
          }
        }
        // 7. FINGERPRINT ENROLLMENT (Software Initiated from Admin Dashboard)
        else if (command == "enroll_fingerprint") {
          if (!accessManager.isEmergency()) {
            int slot = p["slot"].as<int>();
            String studentId = p["studentId"].as<String>();
            String uid = p["uid"].as<String>();

            if (fingerprintManager) {
              fingerprintManager->startEnrollment(slot, studentId, uid, cmdId);
            }
          } else {
            acknowledgeCommand(cmdId, "failed", "Enrollment blocked by active emergency");
          }
        }
        // 8. FINGERPRINT DELETION (Software Initiated from Admin Dashboard)
        else if (command == "delete_fingerprint") {
          int slot = p["slot"].as<int>();
          if (fingerprintManager && fingerprintManager->getSensor()) {
            fingerprintManager->getSensor()->deleteModel(slot);
            acknowledgeCommand(cmdId, "executed", "Template deleted from slot " + String(slot));
          }
        }
      }
    }
  }
  http.end();
}
