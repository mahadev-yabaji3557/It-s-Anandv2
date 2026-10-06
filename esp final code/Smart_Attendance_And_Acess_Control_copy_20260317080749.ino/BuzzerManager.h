#ifndef BUZZER_MANAGER_H
#define BUZZER_MANAGER_H

#include <Arduino.h>
#include "Config.h"

class BuzzerManager {
private:
  uint8_t pin;
  bool active;
  bool pinState;
  int beepsRemaining;
  unsigned long onDuration;
  unsigned long offDuration;
  unsigned long nextToggleTime;
  bool emergencyMode;
  unsigned long lastEmergencyToggle;

public:
  BuzzerManager(uint8_t buzzerPin = BUZZER_PIN)
    : pin(buzzerPin), active(false), pinState(false),
      beepsRemaining(0), onDuration(0), offDuration(0),
      nextToggleTime(0), emergencyMode(false), lastEmergencyToggle(0) {}

  void begin() {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
    pinState = false;
    active = false;
  }

  void startPattern(int count, unsigned long onMs, unsigned long offMs) {
    if (emergencyMode) return; // Emergency siren has priority
    if (count <= 0) return;

    beepsRemaining = count;
    onDuration = onMs;
    offDuration = offMs;
    active = true;

    pinState = true;
    digitalWrite(pin, HIGH);
    nextToggleTime = millis() + onDuration;
  }

  void beepGrant() {
    startPattern(1, 100, 0);
  }

  void beepDenied() {
    startPattern(3, 80, 50);
  }

  void beepConfirmation() {
    startPattern(1, 70, 0);
  }

  void beepTimeout() {
    startPattern(2, 100, 100);
  }

  void setEmergency(bool enabled) {
    emergencyMode = enabled;
    if (!enabled) {
      digitalWrite(pin, LOW);
      pinState = false;
      active = false;
    }
  }

  void update(unsigned long now) {
    if (emergencyMode) {
      if (now - lastEmergencyToggle >= 250) {
        lastEmergencyToggle = now;
        pinState = !pinState;
        digitalWrite(pin, pinState ? HIGH : LOW);
      }
      return;
    }

    if (!active) return;

    if (now >= nextToggleTime) {
      if (pinState) {
        // Turning OFF current beep
        pinState = false;
        digitalWrite(pin, LOW);
        beepsRemaining--;

        if (beepsRemaining > 0 && offDuration > 0) {
          nextToggleTime = now + offDuration;
        } else if (beepsRemaining > 0) {
          // No off duration, immediately start next beep
          pinState = true;
          digitalWrite(pin, HIGH);
          nextToggleTime = now + onDuration;
        } else {
          active = false;
        }
      } else {
        // Starting next beep
        pinState = true;
        digitalWrite(pin, HIGH);
        nextToggleTime = now + onDuration;
      }
    }
  }
};

#endif // BUZZER_MANAGER_H
