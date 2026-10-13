# SmartRail Hygiene - Smart Train Toilet Hygiene & Availability Monitoring System

SmartRail Hygiene is a railway operations web platform designed for monitoring passenger train toilet hygiene, water supply reserves, and availability in real time using IoT edge telemetry (ESP32 / Arduino, MQ-135 ammonia/odor sensors, JSN-SR04T waterproof ultrasonic water sensors, and magnetic door reed switches).

---

## Key Features & User Interface

1. **Public Overview Page (`/home`)**:
   - High-level railway metrics (monitored rakes, overall hygiene compliance, telemetry heartbeat).
   - Interactive 4-step IoT pipeline architecture diagram (Sensor Array &rarr; ESP32 &rarr; Firebase RTDB &rarr; Smart Operations Hub).
   - Value propositions for passengers, OBHS staff, and carriage depot administrators.

2. **Live Monitoring Dashboard (`/dashboard`)**:
   - 6 KPI metric tiles: Total Toilets, Available, Occupied, Cleaning, Out of Service, Needs Clean.
   - Live coach filters, train rake switcher (e.g. 12951 Rajdhani, 20901 Vande Bharat, 12626 Kerala Express), text search, and threshold-attention toggle.
   - Toilet cards displaying exact PPM odor rating, water tank %, usage count, door lock latch, and online IoT heartbeat.

3. **Detailed Toilet Telemetry Inspector (Modal View)**:
   - Rolling 15-point historical telemetry trend line chart for Odor (PPM) & Water (%).
   - Active faults & alert log with acknowledgment triggers.
   - Housekeeping & OBHS repair workflow dispatch controls.

4. **OBHS Operations & Maintenance Center (`/maintenance`)**:
   - Dynamically ranked priority queue based on critical severity: High Odor (>45 PPM), Low Water (<25%), High Usage (>15 trips).
   - Single-click action workflows: "Dispatch & Begin Cleaning", "Mark Sanitation Completed (Reset Counters)", and "Resolve Fault & Restore".
   - Full audit trail of past incidents and resolutions.

5. **Passenger Berth Availability Finder (`/passenger-finder`)**:
   - Intuitive, mobile-first design for train passengers.
   - Select current train & coach to view real-time vacant toilets nearby.
   - Smart recommendation engine prioritizing clean toilets with ample water in or adjacent to the passenger's coach.
   - Direct shortcut to scan QR code or lodge complaints.

6. **Passenger QR Code Feedback Portal (`/qr-feedback`)**:
   - Simulates passenger scanning physical QR sticker inside coach toilet.
   - 1-to-5 star rating for Cleanliness, Water Availability, and Odor.
   - One-touch deficiency tags: Foul Odor, Low Water, Broken Flush, Leaking Tap, Defective Lock, etc.
   - Instantly persists feedback and flags toilet for OBHS inspection if rating &le; 2 stars.

7. **Analytics, Compliance & CSV Export (`/analytics`)**:
   - Charts powered by Recharts: trips per coach, 24-hour odor/water trend curve, reported deficiency breakdown pie chart, and star rating distribution.
   - 1-Click CSV telemetry report download for railway contractor SLA audits.

8. **System Calibration & Device Gateway (`/settings`)**:
   - Interactive calibration sliders for Odor Warning (PPM), Odor Critical (PPM), Low-Water (%), and Trip Usage Limit.
   - Toggle autonomous background sensor drift simulator.
   - ESP32 JSON schema & physical pinout documentation.
   - Firebase Realtime Database rules (`database.rules.json`).

---

## How to Run Locally

### Prerequisites
- Node.js (v18+)
- npm

### Installation & Launch
```bash
# Navigate to the project directory
cd smartrail-hygiene

# Install dependencies (already installed)
npm install

# Start Vite development server
npm run dev

# Build for production
npm run build
```

---

## ESP32 Firmware Integration Guide

### 1. Hardware Pinout
- **MQ-135 Gas Sensor**: VCC &rarr; 5V, GND &rarr; GND, AOUT &rarr; ESP32 GPIO 34 (ADC1)
- **JSN-SR04T Ultrasonic**: TRIG &rarr; GPIO 5, ECHO &rarr; GPIO 18, 5V supply
- **Door Reed Switch**: Pin 1 &rarr; GPIO 4 (INPUT_PULLUP), Pin 2 &rarr; GND

### 2. Sample ESP32 JSON Payload
When publishing via Wi-Fi / SIM800L HTTP POST or Firebase RTDB REST API:
```json
{
  "trainId": "12951",
  "coachId": "B1",
  "toiletId": "B1-T1",
  "status": "Available",
  "odorLevel": 24,
  "odorRating": "Good",
  "waterLevelPercent": 85,
  "usageCount": 4,
  "doorState": "Open",
  "sensorOnline": true,
  "lastUpdated": "13:30:15"
}
```

### 3. Firebase Security Rules (`database.rules.json`)
```json
{
  "rules": {
    "smartrail": {
      "toilets": {
        ".read": true,
        ".write": "auth != null",
        "$toiletId": {
          ".validate": "newData.hasChildren(['status', 'odorLevel', 'waterLevelPercent'])"
        }
      },
      "feedbacks": {
        ".read": true,
        ".write": true,
        "$feedbackId": {
          ".validate": "newData.hasChildren(['toiletId', 'cleanlinessRating'])"
        }
      },
      "alerts": {
        ".read": true,
        ".write": "auth != null"
      }
    }
  }
}
```

---

## Dual-Mode Architecture
- **Offline / Prototype Mode**: Works right away with autonomous background sensor drift, passenger trips, and OBHS state resets clearly labelled as `DEMO DATA - SIMULATED SENSORS`.
- **Firebase Connected Mode**: Supply credentials in `.env.local` to switch seamlessly to live multi-device synchronization over Firebase Realtime Database.
