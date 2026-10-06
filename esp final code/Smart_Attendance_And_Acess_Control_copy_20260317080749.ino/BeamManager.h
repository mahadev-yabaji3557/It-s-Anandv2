#ifndef BEAM_MANAGER_H
#define BEAM_MANAGER_H

#include <Arduino.h>
#include "Config.h"
#include "SystemState.h"
#include "AccessManager.h"
#include "AttendanceManager.h"
#include "LCDManager.h"
#include "BuzzerManager.h"

class BeamManager {
private:
  SystemState& state;
  AccessManager& accessManager;
  AttendanceManager& attendanceManager;
  LCDManager& lcd;
  BuzzerManager& buzzer;

  BeamState beamState;
  unsigned long sequenceStartedAt;
  unsigned long lastUnauthorizedAlertAt;

public:
  BeamManager(SystemState& sysState, AccessManager& am, AttendanceManager& attm, LCDManager& lcdMgr, BuzzerManager& bzMgr)
    : state(sysState), accessManager(am), attendanceManager(attm), lcd(lcdMgr), buzzer(bzMgr),
      beamState(BEAM_IDLE), sequenceStartedAt(0), lastUnauthorizedAlertAt(0) {}

  void begin() {
    pinMode(SENSOR_LDR_ENTRY_PIN, INPUT);
    pinMode(SENSOR_LDR_EXIT_PIN, INPUT);
    beamState = BEAM_IDLE;
    sequenceStartedAt = 0;
    lastUnauthorizedAlertAt = 0;
  }

  BeamState getBeamState() const {
    return beamState;
  }

  bool isAwaitingCrossing() const {
    return state.pendingSession.authorized;
  }

  // --- Register Pending Access Session (Section 8) ---
  void setPendingSession(const String& studentId, const String& name, const String& rollNo,
                         const String& fingerprintId, AccessMethod method, const String& commandId = "") {
    state.pendingSession.studentId = studentId;
    state.pendingSession.studentName = name;
    state.pendingSession.rollNo = rollNo;
    state.pendingSession.fingerprintId = fingerprintId;
    state.pendingSession.accessMethod = method;
    state.pendingSession.authorizationTime = millis();
    state.pendingSession.directionCandidate = DIR_ENTRY;
    state.pendingSession.eventId = "att_" + String(DEVICE_ID) + "_" + String(millis()) + "_" + String(random(1000, 9999));
    state.pendingSession.commandId = commandId;
    state.pendingSession.authorized = true;

    Serial.printf("[BEAM] Session registered: ID=%s, Roll=%s, Method=%d, Expires in %lu ms\n",
                  studentId.c_str(), rollNo.c_str(), method, (unsigned long)CROSSING_TIMEOUT_MS);
  }

  // Backward compatible alias
  void setPendingStudent(const String& studentId, const String& name, const String& rollNo,
                         AccessMethod method = METHOD_FINGERPRINT, const String& eventId = "") {
    setPendingSession(studentId, name, rollNo, studentId, method, "");
    if (eventId.length() > 0) {
      state.pendingSession.eventId = eventId;
    }
  }

  void setPendingAdminOverride(const String& cmdId) {
    setPendingSession("", "Administrator", "", "", METHOD_ADMIN_OVERRIDE, cmdId);
  }

  void clearPending() {
    state.pendingSession.clear();
  }

  // --- Non-blocking Directional Crossing State Machine (Section 6 & 7) ---
  void update(unsigned long now) {
    // 1. Emergency safety priority: optical logic disabled
    if (accessManager.isEmergency()) {
      if (state.pendingSession.authorized) clearPending();
      beamState = BEAM_IDLE;
      return;
    }

    // 2. Authorization-to-Crossing Timeout Check (8000 ms)
    if (state.pendingSession.authorized && state.pendingSession.isExpired(now)) {
      handleAccessTimeout();
      return;
    }

    // 3. Inter-beam Sequence Window Timeout (3000 ms)
    if ((beamState == ENTRY_WAIT_SECOND_BEAM || beamState == EXIT_WAIT_SECOND_BEAM) &&
        (now - sequenceStartedAt > BEAM_SEQUENCE_WINDOW_MS)) {
      Serial.println("[BEAM] Sequence window expired (3000ms). Resetting to BEAM_IDLE.");
      beamState = BEAM_IDLE;
    }

    // 4. Sample Dual Optical LDR Sensors (ADC1 on GPIO32 and GPIO33)
    int entryVal = analogRead(SENSOR_LDR_ENTRY_PIN);
    int exitVal = analogRead(SENSOR_LDR_EXIT_PIN);

    bool beamEntryBroken = (entryVal < LDR_BEAM_BREAK_THRESHOLD);
    bool beamExitBroken = (exitVal < LDR_BEAM_BREAK_THRESHOLD);

    // 5. State Machine Evaluation
    switch (beamState) {
      case BEAM_IDLE:
        if (beamEntryBroken && !beamExitBroken) {
          // Entry Beam (GPIO 32) broken first.
          // Check authorization: only an active pending session or break mode can start entry
          bool isAuthorized = (state.pendingSession.authorized && state.pendingSession.directionCandidate == DIR_ENTRY) ||
                              (state.currentMode == MODE_BREAK);

          if (!isAuthorized) {
            // UNAUTHORIZED BEAM BREAK (Section 11)
            if (now - lastUnauthorizedAlertAt >= 2000) {
              lastUnauthorizedAlertAt = now;
              Serial.println("[SECURITY] Unauthorized beam break at Entry (GPIO32)! Denying sequence.");
              accessManager.closeBarrier();
              lcd.showUnauthorized();
              buzzer.beepDenied();
              attendanceManager.recordAccessEvent("unauthorized_entry_attempt",
                                                  String(now),
                                                  "Beam 1 broken without authorization");
            }
            return;
          }

          // Authorized Entry sequence begins
          beamState = ENTRY_WAIT_SECOND_BEAM;
          sequenceStartedAt = now;
          Serial.println("[BEAM] Entry Beam 1 (GPIO32) broken. Awaiting Exit Beam 2 (GPIO33)...");
          lcd.showCrossing();
        } else if (beamExitBroken && !beamEntryBroken) {
          // Exit Beam (GPIO 33) broken first. Egress sequence initiated.
          beamState = EXIT_WAIT_SECOND_BEAM;
          sequenceStartedAt = now;
          Serial.println("[BEAM] Exit Beam 2 (GPIO33) broken. Awaiting Entry Beam 1 (GPIO32)...");
          lcd.showCrossing();
        }
        break;

      case ENTRY_WAIT_SECOND_BEAM:
        if (beamExitBroken) {
          // Completed ENTRY sequence: Beam 1 (GPIO32) -> Beam 2 (GPIO33)
          Serial.println("[BEAM] Beam 2 interrupted! ENTRY CONFIRMED.");
          beamState = ENTRY_CONFIRMED;
          handleConfirmedEntry();
          beamState = BEAM_IDLE;
        }
        break;

      case EXIT_WAIT_SECOND_BEAM:
        if (beamEntryBroken) {
          // Completed EXIT sequence: Beam 2 (GPIO33) -> Beam 1 (GPIO32)
          Serial.println("[BEAM] Beam 1 interrupted! EXIT CONFIRMED.");
          beamState = EXIT_CONFIRMED;
          handleConfirmedExit();
          beamState = BEAM_IDLE;
        }
        break;

      default:
        beamState = BEAM_IDLE;
        break;
    }
  }

  // --- Confirmed Entry Handler (Section 9) ---
  void handleConfirmedEntry() {
    // 1. Student Entry (Fingerprint or OTP)
    if (state.pendingSession.authorized &&
        (state.pendingSession.accessMethod == METHOD_FINGERPRINT || state.pendingSession.accessMethod == METHOD_OTP)) {

      // Check Classroom Capacity constraint
      if (accessManager.isFull()) {
        Serial.printf("[CAPACITY] Entry rejected: Classroom full (%d/%d).\n", state.occupancy, MAX_CLASSROOM_CAPACITY);
        lcd.showClassFull(state.occupancy, MAX_CLASSROOM_CAPACITY);
        buzzer.beepDenied();
        attendanceManager.recordAccessEvent("capacity_exceeded", state.pendingSession.studentId, "Entry rejected: room full");
        clearPending();
        accessManager.closeBarrier();
        return;
      }

      // ONLY NOW increment occupancy
      accessManager.incrementOccupancy();

      // ONLY NOW record attendance event
      String methodStr = (state.pendingSession.accessMethod == METHOD_OTP) ? "manual_otp" : "fingerprint";
      attendanceManager.recordAttendanceEvent(state.pendingSession.studentId,
                                             state.pendingSession.studentName,
                                             state.pendingSession.rollNo,
                                             methodStr);

      lcd.showEntryOk(state.pendingSession.rollNo.c_str());
      buzzer.beepConfirmation();

      clearPending();
      accessManager.setBarrier(true); // Keep open briefly for physical transit clearance
      return;
    }

    // 2. Admin Override Entry (No student attendance created)
    if (state.pendingSession.authorized && state.pendingSession.accessMethod == METHOD_ADMIN_OVERRIDE) {
      accessManager.incrementOccupancy();
      attendanceManager.recordAccessEvent("admin_override", state.pendingSession.commandId, "Admin override entry confirmed");
      lcd.showMessage("ADMIN OVERRIDE  ", "ENTRY CONFIRMED ", 2000);
      buzzer.beepConfirmation();

      clearPending();
      accessManager.enterMode(state.previousMode, "Admin override transit completed");
      return;
    }

    // 3. Short Break Entry
    if (state.currentMode == MODE_BREAK) {
      accessManager.incrementOccupancy();
      lcd.showShortBreak();
      return;
    }

    // 4. Unauthorized Entry that managed to complete both beams
    Serial.println("[SECURITY] Crossing sequence completed without active authorization. Discarding.");
    attendanceManager.recordAccessEvent("unauthorized_crossing", String(millis()), "Completed entry sequence without authorization");
    lcd.showUnauthorized();
    buzzer.beepDenied();
    accessManager.closeBarrier();
  }

  // --- Confirmed Exit Handler (Section 10) ---
  void handleConfirmedExit() {
    // Momentarily unlock barrier if locked to allow physical egress
    if (!accessManager.isBarrierOpen() && !accessManager.isEmergency()) {
      accessManager.setBarrier(true);
    }

    accessManager.decrementOccupancy(); // Guaranteed never below zero
    buzzer.beepConfirmation();
    lcd.showExitOk();
    attendanceManager.recordAccessEvent("exit", String(millis()), "Physical exit confirmed via optical sequence");
  }

  // --- Crossing Timeout Handler (Section 6 & 8) ---
  void handleAccessTimeout() {
    Serial.println("[TIMEOUT] Crossing authorization expired without physical transit.");
    beamState = ACCESS_TIMEOUT;
    accessManager.closeBarrier();

    if (state.pendingSession.accessMethod == METHOD_ADMIN_OVERRIDE) {
      attendanceManager.recordAccessEvent("admin_override_timeout", state.pendingSession.commandId, "Admin override timed out");
      accessManager.enterMode(state.previousMode, "Admin override timed out");
    } else {
      attendanceManager.recordAccessEvent("crossing_timeout", state.pendingSession.eventId, "Authorization expired: no crossing");
      lcd.showCrossingTimeout();
      buzzer.beepTimeout();
    }

    // Clear pending authorization: NO occupancy change, NO attendance
    clearPending();
    beamState = BEAM_IDLE;
  }
};

#endif // BEAM_MANAGER_H
