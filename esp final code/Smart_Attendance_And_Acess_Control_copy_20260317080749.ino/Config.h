#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ==============================================================================
// SMART CLASSROOM ATTENDANCE & ACCESS CONTROL SYSTEM (SAAC) - ESP32 CONFIG
// HARDWARE / SOFTWARE ARCHITECTURE: 100% SOFTWARE BUTTONS ONLY
// ZERO PHYSICAL CONTROL BUTTON DEPENDENCIES
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. HARDWARE MODULE PIN DEFINITIONS (ESP32 DevKit V1) - LOCKED
// ------------------------------------------------------------------------------

// R307 Optical Fingerprint Sensor (Hardware Serial 2)
#define FINGERPRINT_RX_PIN          16   // ESP32 RX <- R307 TX
#define FINGERPRINT_TX_PIN          17   // ESP32 TX -> R307 RX
#define FINGERPRINT_BAUD            57600

// MG996R High-Torque Servo Motor (Classroom Entry Barrier)
// Dedicated 5V-6V external PSU required. Common GND with ESP32.
#define SERVO_PIN                   18   // PWM control signal pin
#define SERVO_BARRIER_LOCKED_DEG    0    // Barrier closed / locked
#define SERVO_BARRIER_OPEN_DEG      90   // Barrier open / passage allowed

// 16x2 I2C LCD Display
#define LCD_I2C_ADDR                0x27 // Default I2C address
#define LCD_COLS                    16
#define LCD_ROWS                    2
#define I2C_SDA_PIN                 21
#define I2C_SCL_PIN                 22

// MicroSD Card Module (Dedicated SPI Interface)
#define SD_CS_PIN                   13   // Chip Select (GPIO 13)
#define SD_SCK_PIN                  14   // Dedicated SPI SCK (GPIO 14)
#define SD_MISO_PIN                 19   // Dedicated SPI MISO (GPIO 19)
#define SD_MOSI_PIN                 23   // Dedicated SPI MOSI (GPIO 23)
#define SD_SPI_SPEED_HZ             1000000 // 1 MHz dedicated SPI clock

// Optical Crossing Sensors (Bi-directional Dual-Beam Detection)
// Direction Model:
// - ENTRY: Beam 1 (Entry LDR GPIO32) interrupted FIRST -> Beam 2 (Exit LDR GPIO33) interrupted SECOND
// - EXIT:  Beam 2 (Exit LDR GPIO33) interrupted FIRST -> Beam 1 (Entry LDR GPIO32) interrupted SECOND
// NOTE: Optical lasers are connected directly to 5V and GND. There is NO ESP32 GPIO laser control.
#define SENSOR_LDR_ENTRY_PIN        32   // Entry LDR1 / ADC1 (Wi-Fi safe)
#define SENSOR_LDR_EXIT_PIN         33   // Exit LDR2 / ADC1 (Wi-Fi safe)
#define LDR_BEAM_BREAK_THRESHOLD    1800 // ADC threshold indicating optical beam interruption

// Audio Signaling
#define BUZZER_PIN                  5    // Piezo Buzzer output (GPIO 5)

// Hard Classroom Capacity Bounds
#define MAX_CLASSROOM_CAPACITY      80   // Hard upper bound
#define MIN_CLASSROOM_CAPACITY      0    // Never allow negative occupancy

// ------------------------------------------------------------------------------
// 2. NETWORK & BACKEND CLOUD CONFIGURATION
// ------------------------------------------------------------------------------
#define WIFI_SSID                   "TechTitans"
#define WIFI_PASSWORD               "1234567890"

// Render Backend URL and Classroom identifier
#define BACKEND_BASE_URL            "https://smart-classroom-attendan-12911.onrender.com"
#define CLASSROOM_ID                "CSE-A"
#define DEVICE_ID                   "esp32_01"
#define FIRMWARE_VERSION            "2.3.0-production"

// Pre-shared secret header for authenticated ESP32 <-> Backend communication
#define ESP_SECRET_KEY              "PdmaQedcTAKUc2aWK2VfpFeAnb1b2AVeLC9fK69plz0="

// ------------------------------------------------------------------------------
// 3. SYSTEM TIMEOUTS AND INTERVALS (Milliseconds)
// ------------------------------------------------------------------------------
#define CROSSING_TIMEOUT_MS         8000  // Single Source of Truth: Max time allowed for crossing after authorization
#define BEAM_TIMEOUT_MS             CROSSING_TIMEOUT_MS // Reconciled single source of truth alias
#define BEAM_SEQUENCE_WINDOW_MS     3000  // Max time between breaking Beam 1 and Beam 2 during transit
#define CROSSING_SEQUENCE_WINDOW_MS BEAM_SEQUENCE_WINDOW_MS // Alias
#define BARRIER_HOLD_TIME_MS        4000  // How long barrier stays open before auto-closing (independent of 8s crossing timeout)
#define COMMAND_POLL_INTERVAL_MS    2000  // Poll backend command queue every 2 seconds
#define TELEMETRY_HEARTBEAT_MS      30000 // Send device telemetry every 30 seconds
#define OFFLINE_SYNC_INTERVAL_MS    15000 // Retry offline queue flush every 15 seconds

// ------------------------------------------------------------------------------
// 4. MICROSD STORAGE FILE PATHS
// ------------------------------------------------------------------------------
#define SD_ROOT_DIR                 "/SAAC"
#define SD_QUEUE_FILE               "/SAAC/offline_queue.jsonl"
#define SD_USERS_CACHE_FILE         "/SAAC/users_cache.json"
#define SD_TIMETABLE_CACHE_FILE     "/SAAC/timetable_cache.json"
#define SD_CONFIG_FILE              "/SAAC/config.json"
#define SD_FINGERPRINTS_FILE        "/SAAC/fingerprints.json"

#endif // CONFIG_H
