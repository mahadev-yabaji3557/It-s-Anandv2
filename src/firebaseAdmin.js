const admin = require("firebase-admin");

let databaseInstance;
let authInstance;
let initialized = false;
let restPushCounter = 0;

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
    return JSON.parse(decoded);
  }

  throw new Error(
    "Missing Firebase service account. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64 in .env"
  );
}

function ensureAdminApp() {
  if (initialized) return;

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    "https://smart-classroom-attendan-12911-default-rtdb.asia-southeast1.firebasedatabase.app/";

  if (!databaseURL) {
    throw new Error("Missing FIREBASE_DATABASE_URL in environment");
  }

  try {
    const serviceAccount = loadServiceAccount();
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL
      });
    }

    databaseInstance = admin.database();
    authInstance = admin.auth();
    initialized = true;
  } catch (err) {
    initialized = false;
    authInstance = null;
  }
}

function createRestDatabase() {
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    "https://smart-classroom-attendan-12911-default-rtdb.asia-southeast1.firebasedatabase.app/";
  const normalizedBase = databaseURL.replace(/\/+$/, "");
  const dbAuth = process.env.FIREBASE_DB_SECRET || process.env.FIREBASE_DB_AUTH_TOKEN;

  function buildUrl(path) {
    const cleanPath = String(path || "").replace(/^\/+/, "");
    const authSuffix = dbAuth ? `?auth=${encodeURIComponent(dbAuth)}` : "";
    return `${normalizedBase}/${cleanPath}.json${authSuffix}`;
  }

  async function readJson(path, options = {}) {
    const response = await fetch(buildUrl(path), options);
    if (!response.ok) {
      throw new Error(`Firebase REST request failed: ${response.status}`);
    }
    return response.json();
  }

  return {
    ref(path) {
      const cleanPath = String(path || "").replace(/^\/+/, "");

      return {
        async get() {
          const data = await readJson(cleanPath);
          return {
            exists: () => data !== null && data !== undefined,
            val: () => data
          };
        },
        async set(value) {
          await readJson(cleanPath, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value)
          });
        },
        async update(value) {
          await readJson(cleanPath, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value)
          });
        },
        push(value) {
          const key = `rest-${Date.now()}-${restPushCounter++}`;
          return {
            key,
            async set(payload = value) {
              await readJson(`${cleanPath}/${key}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });
            }
          };
        }
      };
    }
  };
}

function getDb() {
  ensureAdminApp();
  if (databaseInstance) return databaseInstance;
  if (!databaseInstance) {
    databaseInstance = createRestDatabase();
  }
  return databaseInstance;
}

function getAuth() {
  ensureAdminApp();
  return authInstance;
}

module.exports = { getDb, getAuth };
