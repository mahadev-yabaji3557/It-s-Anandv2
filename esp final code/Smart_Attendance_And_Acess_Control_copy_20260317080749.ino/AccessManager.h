#ifndef ACCESS_MANAGER_H
#define ACCESS_MANAGER_H

#include <Arduino.h>
#include <ESP32Servo.h>
#include "Config.h"
#include "SystemState.h"
#include "LCDManager.h"
#include "BuzzerManager.h"

class AccessManager {
private:
  Servo barrierServo;
  SystemState& state;
  LCDManager& lcd;
  BuzzerManager& buzzer;
  bool barrierIsOpen;
  unsigned long barrierOpenedAt;

public:
  AccessManager(SystemState& sysState, LCDManager& lcdMgr, BuzzerManager& bzMgr)
    : state(sysState), lcd(lcdMgr), buzzer(bzMgr),
      barrierIsOpen(false), barrierOpenedAt(0) {}

  void begin() {
    barrierServo.setPeriodHertz(50);
    barrierServo.attach(SERVO_PIN, 500, 2400);
    setBarrier(false); // Locked by default (0 deg)
  }

  // --- Occupancy Bounds Enforcement (0 <= occupancy <= 80) ---
  int getOccupancy() const {
    return state.occupancy;
  }

  bool isFull() const {
    return state.occupancy >= MAX_CLASSROOM_CAPACITY;
  }

  bool incrementOccupancy() {
    if (state.occupancy < MAX_CLASSROOM_CAPACITY) {
      state.occupancy++;
      Serial.printf("[ACCESS] Occupancy incremented -> %d/%d\n", state.occupancy, MAX_CLASSROOM_CAPACITY);
      return true;
    }
    Serial.printf("[ACCESS] Denied: Classroom full -> %d/%d\n", state.occupancy, MAX_CLASSROOM_CAPACITY);
    return false;
  }

  void decrementOccupancy() {
    state.occupancy = constrain(state.occupancy - 1, MIN_CLASSROOM_CAPACITY, MAX_CLASSROOM_CAPACITY);
    Serial.printf("[ACCESS] Occupancy decremented -> %d/%d\n", state.occupancy, MAX_CLASSROOM_CAPACITY);
  }

  void setOccupancy(int occ) {
    state.occupancy = constrain(occ, MIN_CLASSROOM_CAPACITY, MAX_CLASSROOM_CAPACITY);
  }

  // --- Barrier Control (Servo on GPIO18) ---
  bool isBarrierOpen() const {
    return barrierIsOpen;
  }

  unsigned long getBarrierOpenedAt() const {
    return barrierOpenedAt;
  }

  void setBarrier(bool open) {
    barrierIsOpen = open;
    if (open) {
      barrierServo.write(SERVO_BARRIER_OPEN_DEG); // 90 deg
      barrierOpenedAt = millis();
      Serial.println("[SERVO] Barrier OPENED (90 deg).");
    } else {
      barrierServo.write(SERVO_BARRIER_LOCKED_DEG); // 0 deg
      Serial.println("[SERVO] Barrier CLOSED / LOCKED (0 deg).");
    }
  }

  void openBarrier() {
    setBarrier(true);
  }

  void closeBarrier() {
    setBarrier(false);
  }

  // --- Mode State Transitions with Emergency Priority ---
  SystemMode getMode() const {
    return state.currentMode;
  }

  SystemMode getPreviousMode() const {
    return state.previousMode;
  }

  bool isEmergency() const {
    return state.currentMode == MODE_EMERGENCY;
  }

  void enterMode(SystemMode newMode, const char* reason = "") {
    state.previousMode = state.currentMode;
    state.currentMode = newMode;
    Serial.printf("[MODE] Transition %d -> %d. Reason: %s\n", state.previousMode, state.currentMode, reason);

    switch (state.currentMode) {
      case MODE_IDLE:
        buzzer.setEmergency(false);
        setBarrier(false);
        lcd.showSystemReady(CLASSROOM_ID);
        break;

      case MODE_LECTURE:
        buzzer.setEmergency(false);
        setBarrier(false);
        lcd.showMessage("Lecture Active  ", state.activeSubject.length() ? state.activeSubject.c_str() : CLASSROOM_ID);
        break;

      case MODE_BREAK:
        buzzer.setEmergency(false);
        setBarrier(true); // Short break allows free movement without attendance
        lcd.showShortBreak();
        buzzer.beepConfirmation();
        break;

      case MODE_ADMIN_OVERRIDE:
        buzzer.setEmergency(false);
        setBarrier(true);
        lcd.showAdminOverride();
        buzzer.startPattern(2, 100, 100);
        break;

      case MODE_EMERGENCY:
        setBarrier(true); // Emergency egress barrier open immediately
        buzzer.setEmergency(true);
        lcd.showEmergency();
        break;

      case MODE_ENROLL:
        buzzer.setEmergency(false);
        setBarrier(false);
        break;
    }
  }

  // --- Non-blocking Update (Barrier Hold Timing) ---
  void update(unsigned long now) {
    if (state.currentMode == MODE_ENROLL) {
      if (barrierIsOpen) setBarrier(false); // Strictly locked at 0 deg during biometric enrollment
      return;
    }

    if (state.currentMode == MODE_EMERGENCY) {
      if (!barrierIsOpen) setBarrier(true); // Force barrier open for evacuation egress
      return;
    }

    if (state.currentMode == MODE_BREAK) {
      if (!barrierIsOpen) setBarrier(true); // Free movement during break
      return;
    }

    // Auto-close barrier after BARRIER_HOLD_TIME_MS (4000ms)
    // Note: crossing authorization remains active up to 8000ms in BeamManager
    if (barrierIsOpen) {
      if (now - barrierOpenedAt >= BARRIER_HOLD_TIME_MS) {
        closeBarrier();
        if (state.currentMode == MODE_ADMIN_OVERRIDE && !state.pendingSession.authorized) {
          enterMode(state.previousMode, "Admin override concluded");
        }
      }
    }
  }
};

#endif // ACCESS_MANAGER_H
