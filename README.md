# Smart Attendance and Access Control (Firebase + Backend)

This project now includes:
- Frontend: `SAAC.html`
- Backend API: `server.js` (Express)
- Database: Firebase Realtime Database via Firebase Admin SDK
- Auth: Firebase Auth on the frontend when web config is provided, with backend fallback auth still supported

## 1) Firebase Setup

1. Open Firebase Console -> your project.
2. Enable **Realtime Database**.
3. Go to Project Settings -> Service Accounts -> Generate new private key (JSON).
4. Copy your database URL (example: `https://your-project-id-default-rtdb.firebaseio.com`).
   Current project URL configured: `https://smart-classroom-attendan-12911-default-rtdb.asia-southeast1.firebasedatabase.app/`.

### 1.1) ESP32 + Firebase Realtime Database (optional)

If your ESP32 hardware needs to read/write directly to the same Realtime Database, ensure the following:

- **Database URL** must match exactly (including region) and should look like:
  `https://<project-id>-default-rtdb.<region>.firebasedatabase.app/`
- If your database rules require auth, you must provide either:
  - A **Firebase Auth ID token** (from sign-in), or
  - A **legacy database secret** (for older REST auth), or
  - Set Realtime Database rules to allow public read/write for testing only:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

- Use a tested ESP32 Firebase library like `Firebase_ESP_Client`.

#### Option A — Direct Firebase RTDB (requires auth / secret)

```cpp
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

const char* ssid = "YOUR_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Use the same DB host as in FIREBASE_DATABASE_URL (no https:// and no trailing slash)
#define FIREBASE_HOST "smart-classroom-attendan-12911-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "YOUR_DB_SECRET_OR_ID_TOKEN"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH; // for legacy secret
  Firebase.begin(&config, &auth);

  if (Firebase.RTDB.setString(&fbdo, "/test/esptest", "hello")) {
    Serial.println("Write OK");
  } else {
    Serial.println("Write failed: " + fbdo.errorReason());
  }
}

void loop() {}
```

> ⚠️ Make sure your Firebase Realtime Database rules match what your ESP32 client requires (auth vs public access).

#### Option B — Use the backend as a proxy (avoids Firebase auth on ESP32)

This repo includes a helper endpoint at `POST /api/esp/write` which you can call from your ESP32. It writes to the Realtime Database using the server’s service account (no Firebase token needed on device).

1) Add this env var to your `.env`:

```
ESP_SECRET=some_secret_value
```

2) Call from ESP32 (example using HTTPClient):

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* backendURL = "http://<your-server-host>:3000/api/esp/write";
const char* espSecret = "some_secret_value";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  HTTPClient http;
  http.begin(backendURL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-esp-key", espSecret);

  const char* payload = "{\"path\": \"test/esptest\", \"value\": \"hello\"}";
  int code = http.POST(payload);
  String body = http.getString();
  Serial.printf("HTTP %d: %s\n", code, body.c_str());
  http.end();

  // If you receive HTTP 401, the response body will include a JSON "reason" field like:
  // { "error": "Unauthorized", "reason": "Invalid x-esp-key" }
}

void loop() {}
```

Using this proxy approach avoids `401` errors from Firebase because the server itself is already authenticated with the service account.
>
> ### Common 401 Unauthorized fixes for ESP32
> A `401` from Firebase means your request is **not authenticated**.
>
> 1) **If you are using database rules that require auth** (e.g., `auth != null`):
>    - You must send a **valid Firebase Auth ID token** (from signing in with email/password or anonymous sign-in).
>    - If you are sending a **legacy secret** (DB secret), ensure your rules allow it (or switch rules to public for testing).
>
> 2) **If you don’t want auth yet (quick test)**, set your rules to public while debugging (do NOT keep this in production):
> ```json
> {
>   "rules": {
>     ".read": true,
>     ".write": true
>   }
> }
> ```
>
> 3) Make sure the **DB host/URL is exactly correct** for your project (region matters).
>
> 4) If you’re still getting 401, print the full error from the ESP32 (usually `fbdo.errorReason()`) and confirm which token you are sending.

## 2) Local Backend Setup

```bash
npm install
```

Create `.env` from `.env.example` and fill values:

- `PORT=3000`
- `JWT_SECRET=your_strong_secret`
- `SEED_KEY=your_seed_secret`
- `FIREBASE_DATABASE_URL=...`
- `FIREBASE_DATABASE_URL=https://smart-classroom-attendan-12911-default-rtdb.asia-southeast1.firebasedatabase.app/`
- `FIREBASE_DB_SECRET=` (optional: only needed if DB rules require auth token for REST fallback)
- `FIREBASE_SERVICE_ACCOUNT_JSON={...}`
- `FIREBASE_API_KEY=...`
- `FIREBASE_AUTH_DOMAIN=...`
- `FIREBASE_PROJECT_ID=...`
- `FIREBASE_APP_ID=...`
- `FIREBASE_MESSAGING_SENDER_ID=...`

Then run:

```bash
npm start
```

Open: `http://localhost:3000`

## 3) Seed Realtime Database

After starting backend, call:

```bash
curl -X POST http://localhost:3000/api/admin/seed -H "x-seed-key: your_seed_secret"
```

This will create attendance data for SY, TY, BE under:
- `attendance/SY`
- `attendance/TY`
- `attendance/BE`

## 4) API Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/session`
- `POST /api/auth/sync-profile`
- `GET /api/attendance/summary/:className` (auth)
- `GET /api/attendance/students/:className?filter=present` (auth)
- `POST /api/manual-otp/verify` (student)
- `POST /api/control/command` (faculty/admin/hod)
- `GET /api/events`, `POST /api/events`
- `GET /api/analytics`
- `GET /api/classrooms/monitor`
- `POST /api/admin/seed` (header `x-seed-key`)

## 5) Deploy (Render)

1. Push this folder to GitHub.
2. Create new Render Web Service from repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables from `.env.example`.
   Required in Render:
   - `JWT_SECRET`
   - `SEED_KEY`
   - `FIREBASE_DATABASE_URL` (use your URL above)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (full service account JSON as one-line string)
6. Deploy.

After deploy, run seed endpoint on deployed URL:

```bash
curl -X POST https://YOUR-APP.onrender.com/api/admin/seed -H "x-seed-key: your_seed_secret"
```

## Notes

- Passwords are hashed with bcrypt.
- JWT token expires in 12 hours.
- Frontend now uses backend APIs (no localStorage auth).
- Backend uses Firebase Admin when service account is provided; otherwise it falls back to Firebase REST API.
