#ifndef LCD_MANAGER_H
#define LCD_MANAGER_H

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "Config.h"

class LCDManager {
private:
  LiquidCrystal_I2C lcd;
  char cachedLine1[17];
  char cachedLine2[17];
  unsigned long messageHoldUntil;
  bool isOverlayActive;

public:
  LCDManager()
    : lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS),
      messageHoldUntil(0),
      isOverlayActive(false) {
    memset(cachedLine1, 0, sizeof(cachedLine1));
    memset(cachedLine2, 0, sizeof(cachedLine2));
  }

  void begin() {
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    lcd.init();
    lcd.backlight();
    showMessage("SAAC System v2.3", "Booting up...   ");
  }

  // --- Core display method with 16-character truncation & change caching ---
  void showMessage(const char* line1, const char* line2, unsigned long holdMs = 0) {
    char buf1[17];
    char buf2[17];
    snprintf(buf1, sizeof(buf1), "%-16.16s", line1 ? line1 : "");
    snprintf(buf2, sizeof(buf2), "%-16.16s", line2 ? line2 : "");

    bool changed = false;
    if (strncmp(cachedLine1, buf1, 16) != 0) {
      lcd.setCursor(0, 0);
      lcd.print(buf1);
      strncpy(cachedLine1, buf1, 16);
      cachedLine1[16] = '\0';
      changed = true;
    }

    if (strncmp(cachedLine2, buf2, 16) != 0) {
      lcd.setCursor(0, 1);
      lcd.print(buf2);
      strncpy(cachedLine2, buf2, 16);
      cachedLine2[16] = '\0';
      changed = true;
    }

    if (holdMs > 0) {
      messageHoldUntil = millis() + holdMs;
      isOverlayActive = true;
    }
  }

  bool isHoldingOverlay() const {
    return isOverlayActive && (millis() < messageHoldUntil);
  }

  void clearOverlay() {
    isOverlayActive = false;
    messageHoldUntil = 0;
  }

  // --- Predefined System Status Displays (Strictly <= 16 chars per line) ---
  void showSystemReady(const char* detail = nullptr) {
    if (isHoldingOverlay()) return;
    showMessage("SYSTEM READY    ", detail ? detail : CLASSROOM_ID);
  }

  void showScanFinger() {
    if (isHoldingOverlay()) return;
    showMessage("SCAN FINGER     ", "PLACE ON SENSOR ");
  }

  void showVerifying() {
    showMessage("VERIFYING...    ", "CHECKING BIOMETR");
  }

  void showAccessGranted(const char* name = nullptr) {
    showMessage("ACCESS GRANTED  ", name ? name : "PLEASE ENTER    ", 2000);
  }

  void showAccessDenied(const char* reason = nullptr) {
    showMessage("ACCESS DENIED   ", reason ? reason : "UNAUTHORIZED    ", 2500);
  }

  void showClassFull(int occ = 80, int maxCap = 80) {
    char buf[17];
    snprintf(buf, sizeof(buf), "CAPACITY %d/%d ", occ, maxCap);
    showMessage("CLASS FULL      ", buf, 2500);
  }

  void showCrossing() {
    showMessage("CROSSING...     ", "PLEASE PROCEED  ");
  }

  void showEntryOk(const char* detail = nullptr) {
    showMessage("ENTRY OK        ", detail ? detail : "WELCOME         ", 2000);
  }

  void showExitOk() {
    showMessage("EXIT OK         ", "THANK YOU       ", 2000);
  }

  void showAttendanceSaved(const char* roll = nullptr) {
    char buf[17];
    if (roll) snprintf(buf, sizeof(buf), "ROLL: %-10.10s", roll);
    else snprintf(buf, sizeof(buf), "RECORD CONFIRMED");
    showMessage("ATTENDANCE SAVED", buf, 2000);
  }

  void showOfflineMode() {
    showMessage("OFFLINE MODE    ", "SD CACHE ACTIVE ");
  }

  void showSdSaved() {
    showMessage("SD SAVED        ", "QUEUED OFFLINE  ", 1500);
  }

  void showSyncing() {
    showMessage("SYNCING...      ", "UPLOADING QUEUE ");
  }

  void showEmergency() {
    showMessage("!!! EMERGENCY !!", "  FOLLOW EXIT   ");
  }

  void showShortBreak() {
    showMessage(" SHORT BREAK    ", " ACCESS ALLOWED ");
  }

  void showAdminOverride() {
    showMessage("ADMIN OVERRIDE  ", "BARRIER UNLOCKED");
  }

  void showEnrollFinger() {
    showMessage("ENROLL FINGER   ", "PLACE FINGER    ");
  }

  void showEnrollSuccess(int slot) {
    char buf[17];
    snprintf(buf, sizeof(buf), "SLOT ID: %d", slot);
    showMessage("ENROLL SUCCESS  ", buf, 2500);
  }

  void showEnrollFailed(const char* reason = nullptr) {
    showMessage("ENROLL FAILED   ", reason ? reason : "NO MATCH        ", 2500);
  }

  void showCrossingTimeout() {
    showMessage("CROSSING TIMEOUT", "NO ATTENDANCE   ", 2500);
  }

  void showUnauthorized() {
    showMessage("UNAUTHORIZED!   ", "ACCESS DENIED   ", 2500);
  }

  void update(unsigned long now) {
    if (isOverlayActive && now >= messageHoldUntil) {
      isOverlayActive = false;
    }
  }
};

#endif // LCD_MANAGER_H
