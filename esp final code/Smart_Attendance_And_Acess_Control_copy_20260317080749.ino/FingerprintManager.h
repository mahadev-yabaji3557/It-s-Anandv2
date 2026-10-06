#ifndef FINGERPRINT_MANAGER_H
#define FINGERPRINT_MANAGER_H

#include <Arduino.h>
#include <Adafruit_Fingerprint.h>
#include <ArduinoJson.h>
#include "Config.h"
#include "SystemState.h"
#include "AccessManager.h"
#include "BeamManager.h"
#include "OfflineQueueManager.h"
#include "LCDManager.h"
#include "BuzzerManager.h"

class FingerprintManager {
private:
  Adafruit_Fingerprint* finger;
  SystemState& state;
  AccessManager& accessManager;
  BeamManager& beamManager;
  OfflineQueueManager& offlineQueue;
  LCDManager& lcd;
  BuzzerManager& buzzer;

  bool ready;
  unsigned long lastScanAttempt;

  // Enrollment State Machine Variables (Section 5)
  bool enrollmentActive;
  int enrollStep;
  int targetEnrollSlot;
  String enrollStudentId;
  String enrollUserUid;
  String enrollCommandId;
  unsigned long enrollTimeoutAt;

public:
  FingerprintManager(Adafruit_Fingerprint* fingerPtr, SystemState& sysState,
                     AccessManager& am, BeamManager& bm, OfflineQueueManager& oq,
                     LCDManager& lcdMgr, BuzzerManager& bzMgr)
    : finger(fingerPtr), state(sysState), accessManager(am), beamManager(bm),
      offlineQueue(oq), lcd(lcdMgr), buzzer(bzMgr),
      ready(false), lastScanAttempt(0),
      enrollmentActive(false), enrollStep(0), targetEnrollSlot(-1),
      enrollTimeoutAt(0) {}

  bool begin() {
    if (!finger) return false;
    if (finger->verifyPassword()) {
      ready = true;
      state.fingerprintReady = true;
      Serial.println("[R307] Biometric sensor verified successfully.");
    } else {
      ready = false;
      state.fingerprintReady = false;
      Serial.println("[R307] Biometric sensor communication failed.");
    }
    return ready;
  }

  bool isReady() const {
    return ready;
  }

  bool isEnrollmentActive() const {
    return enrollmentActive;
  }

  Adafruit_Fingerprint* getSensor() {
    return finger;
  }

  // --- Preferred Architecture: scanAndAuthorize() ---
  // Identity verification -> Authorization -> Pending Session -> Open Barrier -> Await Transit
  void scanAndAuthorize() {
    if (!ready || !finger) return;
    if (accessManager.isEmergency() || state.currentMode == MODE_BREAK || beamManager.isAwaitingCrossing()) {
      return;
    }

    unsigned long now = millis();
    if (now - lastScanAttempt < 150) return;
    lastScanAttempt = now;

    // 1. Capture Image (non-blocking test)
    uint8_t p = finger->getImage();
    if (p != FIMG_OK) return; // No finger placed

    // 2. Convert Raw Image to Characteristic File
    p = finger->image2Tz();
    if (p != FIMG_OK) {
      Serial.println("[R307] Image conversion failed.");
      return;
    }

    // 3. Pre-authorization Room Capacity Check
    if (accessManager.isFull()) {
      Serial.printf("[R307] Entry denied: Classroom at capacity %d/%d.\n", state.occupancy, MAX_CLASSROOM_CAPACITY);
      lcd.showClassFull(state.occupancy, MAX_CLASSROOM_CAPACITY);
      buzzer.beepDenied();
      return;
    }

    lcd.showVerifying();

    // 4. On-chip Biometric Hardware Search
    p = finger->fingerSearch();
    if (p == FIMG_OK) {
      int matchedSlot = finger->fingerID;
      int confidence = finger->confidence;
      Serial.printf("[R307] Match: Slot ID %d, Confidence %d\n", matchedSlot, confidence);

      // Re-verify room capacity
      if (accessManager.isFull()) {
        lcd.showClassFull(state.occupancy, MAX_CLASSROOM_CAPACITY);
        buzzer.beepDenied();
        return;
      }

      String studentId = String(matchedSlot);
      String rollNo = String(matchedSlot);
      String studentName = "Student #" + String(matchedSlot);

      // Attempt to resolve name/roll from local SD user cache if available
      String cachedUsers = offlineQueue.readCache(SD_USERS_CACHE_FILE);
      if (cachedUsers.length() > 0) {
        DynamicJsonDocument udoc(4096);
        if (!deserializeJson(udoc, cachedUsers)) {
          if (udoc.containsKey(studentId)) {
            studentName = udoc[studentId]["name"].as<String>();
            rollNo = udoc[studentId]["rollNo"].as<String>();
          }
        }
      }

      // CRITICAL:
      // Store pending access session in BeamManager
      beamManager.setPendingSession(studentId, studentName, rollNo, String(matchedSlot), METHOD_FINGERPRINT);

      // Open physical barrier
      accessManager.openBarrier();

      // Audio & Visual signaling
      lcd.showAccessGranted(studentName.c_str());
      buzzer.beepGrant();

      // IMPORTANT:
      // Occupancy increment and attendance marking are STRICTLY DEFERRED
      // until BeamManager confirms dual-beam optical crossing!
    } else if (p == FIMG_NOTFOUND) {
      Serial.println("[R307] Fingerprint not recognized.");
      lcd.showAccessDenied("USE OTP FALLBACK");
      buzzer.beepDenied();
    }
  }

  // Backward compatible alias
  void scanAndOpen() {
    scanAndAuthorize();
  }

  // --- Start Admin-Driven Fingerprint Enrollment (Section 5) ---
  void startEnrollment(int slot, const String& studentId, const String& userUid, const String& cmdId) {
    if (accessManager.isEmergency()) {
      Serial.println("[ENROLL] Blocked: Emergency active.");
      return;
    }

    targetEnrollSlot = (slot > 0 && slot <= 1000) ? slot : (random(10, 200));
    enrollStudentId = studentId;
    enrollUserUid = userUid;
    enrollCommandId = cmdId;

    enrollmentActive = true;
    enrollStep = 1;
    enrollTimeoutAt = millis() + 60000; // 60s timeout

    accessManager.enterMode(MODE_ENROLL, "Admin initiated enrollment");
    lcd.showEnrollFinger();
    buzzer.beepGrant();
    Serial.printf("[ENROLL] Started for Student %s in Slot %d\n", studentId.c_str(), targetEnrollSlot);
  }

  // --- Non-blocking Enrollment Step Machine ---
  void handleEnrollmentStep(unsigned long now,
                           std::function<void(const String&, const String&, const String&)> ackCallback = nullptr,
                           std::function<void(int, const String&, const String&, const String&)> resultCallback = nullptr) {
    if (!enrollmentActive) return;

    if (now > enrollTimeoutAt) {
      Serial.println("[ENROLL] Enrollment session timed out.");
      lcd.showEnrollFailed("TIMEOUT EXPIRED");
      buzzer.beepDenied();
      if (ackCallback) {
        ackCallback(enrollCommandId, "failed", "Fingerprint enrollment timed out");
      }
      enrollmentActive = false;
      accessManager.enterMode(accessManager.getPreviousMode(), "Enrollment timed out");
      return;
    }

    uint8_t p;
    if (enrollStep == 1) { // Place finger first time
      p = finger->getImage();
      if (p == FIMG_OK) {
        p = finger->image2Tz(1);
        if (p == FIMG_OK) {
          Serial.println("[ENROLL] Image 1 converted. Lift finger.");
          lcd.showMessage("REMOVE FINGER   ", "PLEASE LIFT     ");
          buzzer.beepConfirmation();
          enrollStep = 2;
        }
      }
    } else if (enrollStep == 2) { // Wait for finger removal
      p = finger->getImage();
      if (p == FIMG_NOFINGER) {
        lcd.showMessage("PLACE AGAIN     ", "SAME FINGER     ");
        enrollStep = 3;
      }
    } else if (enrollStep == 3) { // Place finger second time
      p = finger->getImage();
      if (p == FIMG_OK) {
        p = finger->image2Tz(2);
        if (p == FIMG_OK) {
          p = finger->createModel();
          if (p == FIMG_OK) {
            p = finger->storeModel(targetEnrollSlot);
            if (p == FIMG_OK) {
              Serial.printf("[ENROLL] SUCCESS: Registered in slot %d\n", targetEnrollSlot);
              lcd.showEnrollSuccess(targetEnrollSlot);
              buzzer.startPattern(2, 100, 100);

              // Backup slot-to-student mapping to SD
              String fpCache = offlineQueue.readCache(SD_FINGERPRINTS_FILE);
              DynamicJsonDocument fpDoc(4096);
              if (fpCache.length() > 0) {
                deserializeJson(fpDoc, fpCache);
              }
              fpDoc[String(targetEnrollSlot)] = enrollStudentId;
              String updatedFp;
              serializeJson(fpDoc, updatedFp);
              offlineQueue.saveCache(SD_FINGERPRINTS_FILE, updatedFp);

              // Notify backend via callback
              if (resultCallback) {
                resultCallback(targetEnrollSlot, enrollStudentId, enrollUserUid, enrollCommandId);
              }
              if (ackCallback) {
                ackCallback(enrollCommandId, "executed", "Template saved in slot " + String(targetEnrollSlot));
              }

              enrollmentActive = false;
              accessManager.enterMode(accessManager.getPreviousMode(), "Enrollment complete");
              return;
            }
          }
        }
        // Match failure
        Serial.println("[ENROLL] Fingerprint model creation/matching failed.");
        lcd.showEnrollFailed("NO MATCH");
        buzzer.beepDenied();
        if (ackCallback) {
          ackCallback(enrollCommandId, "failed", "Fingerprint prints did not match");
        }
        enrollmentActive = false;
        accessManager.enterMode(accessManager.getPreviousMode(), "Enrollment match failure");
      }
    }
  }

  // --- Main Non-blocking Update ---
  void update(unsigned long now) {
    if (enrollmentActive) {
      handleEnrollmentStep(now);
      return;
    }

    scanAndAuthorize();
  }
};

#endif // FINGERPRINT_MANAGER_H
