#ifndef OFFLINE_QUEUE_MANAGER_H
#define OFFLINE_QUEUE_MANAGER_H

#include <Arduino.h>
#include <SPI.h>
#include <FS.h>
#include <SD.h>
#include <functional>
#include "Config.h"

class OfflineQueueManager {
private:
  SPIClass sdSPI;
  bool ready;

public:
  OfflineQueueManager()
    : sdSPI(HSPI), ready(false) {}

  bool begin() {
    sdSPI.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);
    if (SD.begin(SD_CS_PIN, sdSPI, SD_SPI_SPEED_HZ)) {
      ready = true;
      Serial.println("[SD] MicroSD mounted successfully at 1 MHz dedicated SPI.");
      if (!SD.exists(SD_ROOT_DIR)) {
        SD.mkdir(SD_ROOT_DIR);
      }
      if (!SD.exists(SD_QUEUE_FILE)) {
        File f = SD.open(SD_QUEUE_FILE, FILE_WRITE);
        if (f) f.close();
      }
    } else {
      ready = false;
      Serial.println("[SD] MicroSD mount failed. Offline queue unavailable.");
    }
    return ready;
  }

  bool isReady() const {
    return ready;
  }

  // --- Append event to offline queue ---
  bool enqueueEvent(const String& jsonLine) {
    if (!ready) return false;

    File queue = SD.open(SD_QUEUE_FILE, FILE_APPEND);
    if (queue) {
      queue.println(jsonLine);
      queue.close();
      Serial.println("[SD] Event appended to " + String(SD_QUEUE_FILE));
      return true;
    }
    Serial.println("[SD] Failed to open offline queue for appending.");
    return false;
  }

  // --- Non-destructive queue synchronization ---
  // Only records acknowledged by backend callback are pruned.
  bool syncQueue(std::function<bool(const String&)> sendCallback) {
    if (!ready) return false;
    if (!SD.exists(SD_QUEUE_FILE)) return true;

    File queue = SD.open(SD_QUEUE_FILE, FILE_READ);
    if (!queue || queue.size() == 0) {
      if (queue) queue.close();
      return true;
    }

    Serial.println("[OFFLINE] Synchronizing pending offline events to backend...");
    String tempPath = String(SD_ROOT_DIR) + "/offline_temp.jsonl";
    File temp = SD.open(tempPath.c_str(), FILE_WRITE);

    int syncedCount = 0;
    int failedCount = 0;

    while (queue.available()) {
      String line = queue.readStringUntil('\n');
      line.trim();
      if (line.length() == 0) continue;

      bool acked = sendCallback(line);
      if (acked) {
        syncedCount++;
      } else {
        failedCount++;
        if (temp) temp.println(line); // Retain unsynced event for next retry
      }
    }

    queue.close();
    if (temp) temp.close();

    SD.remove(SD_QUEUE_FILE);
    if (SD.exists(tempPath.c_str())) {
      SD.rename(tempPath.c_str(), SD_QUEUE_FILE);
    }

    Serial.printf("[OFFLINE] Sync finished: %d synced, %d remaining.\n", syncedCount, failedCount);
    return (failedCount == 0);
  }

  // --- Local Cache File Helpers ---
  bool saveCache(const char* path, const String& content) {
    if (!ready) return false;
    File f = SD.open(path, FILE_WRITE);
    if (f) {
      f.print(content);
      f.close();
      return true;
    }
    return false;
  }

  String readCache(const char* path) {
    if (!ready || !SD.exists(path)) return "";
    File f = SD.open(path, FILE_READ);
    if (!f) return "";
    String content = f.readString();
    f.close();
    return content;
  }
};

#endif // OFFLINE_QUEUE_MANAGER_H
