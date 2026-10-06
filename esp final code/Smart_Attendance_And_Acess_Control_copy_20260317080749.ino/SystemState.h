#ifndef SYSTEM_STATE_H
#define SYSTEM_STATE_H

#include <Arduino.h>
#include "Config.h"

// ------------------------------------------------------------------------------
// OPERATIONAL SYSTEM MODES (Priority State Machine)
// MODE_EMERGENCY > MODE_ADMIN_OVERRIDE > MODE_BREAK > MODE_ENROLL > MODE_LECTURE > MODE_IDLE
// ------------------------------------------------------------------------------
enum SystemMode {
  MODE_IDLE = 0,             // Normal standby, awaiting access or lecture
  MODE_LECTURE,              // Active lecture session
  MODE_BREAK,                // Faculty/HOD short break (free movement without attendance)
  MODE_ADMIN_OVERRIDE,       // Administrator manual physical override
  MODE_EMERGENCY,            // Emergency evacuation (HIGHEST PRIORITY: barrier open, buzzer on)
  MODE_ENROLL                // Software-directed fingerprint enrollment
};

// ------------------------------------------------------------------------------
// ACCESS AUTHORIZATION METHODS
// ------------------------------------------------------------------------------
enum AccessMethod {
  METHOD_NONE = 0,
  METHOD_FINGERPRINT,
  METHOD_OTP,
  METHOD_ADMIN_OVERRIDE,
  METHOD_EMERGENCY
};

// ------------------------------------------------------------------------------
// DIRECTION CANDIDATES
// ------------------------------------------------------------------------------
enum DirectionCandidate {
  DIR_NONE = 0,
  DIR_ENTRY,
  DIR_EXIT
};

// ------------------------------------------------------------------------------
// BEAM STATE MACHINE STATES (Section 7)
// ------------------------------------------------------------------------------
enum BeamState {
  BEAM_IDLE = 0,
  ENTRY_WAIT_SECOND_BEAM,
  EXIT_WAIT_SECOND_BEAM,
  ENTRY_CONFIRMED,
  EXIT_CONFIRMED,
  ACCESS_TIMEOUT
};

// ------------------------------------------------------------------------------
// PENDING ACCESS SESSION (Section 8)
// Created upon identity verification. Physical crossing required before attendance.
// ------------------------------------------------------------------------------
struct PendingAccessSession {
  String studentId;
  String rollNo;
  String fingerprintId;
  AccessMethod accessMethod;
  unsigned long authorizationTime;
  DirectionCandidate directionCandidate;
  String eventId;
  bool authorized;
  String studentName;
  String commandId;

  PendingAccessSession() {
    clear();
  }

  void clear() {
    studentId = "";
    rollNo = "";
    fingerprintId = "";
    accessMethod = METHOD_NONE;
    authorizationTime = 0;
    directionCandidate = DIR_NONE;
    eventId = "";
    authorized = false;
    studentName = "";
    commandId = "";
  }

  bool isExpired(unsigned long now) const {
    if (!authorized) return true;
    return (now - authorizationTime >= CROSSING_TIMEOUT_MS);
  }
};

// ------------------------------------------------------------------------------
// SHARED SYSTEM RUNTIME STATE
// ------------------------------------------------------------------------------
struct SystemState {
  int occupancy;
  SystemMode currentMode;
  SystemMode previousMode;
  bool wifiConnected;
  bool sdReady;
  bool fingerprintReady;
  String activeLectureStatus;
  String activeSubject;
  String activeFaculty;
  PendingAccessSession pendingSession;

  SystemState()
    : occupancy(0),
      currentMode(MODE_IDLE),
      previousMode(MODE_IDLE),
      wifiConnected(false),
      sdReady(false),
      fingerprintReady(false),
      activeLectureStatus("Idle"),
      activeSubject(""),
      activeFaculty("") {}
};

#endif // SYSTEM_STATE_H
