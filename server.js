require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { getDb, getAuth } = require("./src/firebaseAdmin");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change_this_in_env";
const DEFAULT_CLASSROOM = "CSE-A";
const DASHBOARD_ROLES = ["student", "faculty", "cc", "admin", "hod"];
const COMMANDS = [
  "open_class",
  "end_lecture",
  "short_break",
  "emergency",
  "generate_otp",
  "start_seminar",
  "half_day"
];

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeRole(value) {
  const role = normalizeText(value).toLowerCase();
  return DASHBOARD_ROLES.includes(role) ? role : "student";
}

function normalizeClass(value) {
  const cls = normalizeText(value);
  if (!cls) return null;
  if (!/^[a-zA-Z0-9 _-]{1,40}$/.test(cls)) return null;
  return cls;
}

function normalizeClassToken(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeFingerprint(value) {
  const id = normalizeText(value);
  if (!id) return "";
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
}

function isStrongPassword(value) {
  const password = String(value || "");
  return password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

function mapFilterStatus(filter) {
  const map = {
    total: null,
    present: ["On Time", "Late Mark", "Present"],
    absent: ["Absent"],
    onTime: ["On Time"],
    lateMark: ["Late Mark"],
    od: ["On Duty"],
    leave: ["Leave"]
  };
  return map[filter] ?? null;
}

function normalizeStatus(value) {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return "Absent";
  if (["on time", "ontime", "present", "p"].includes(raw)) return "On Time";
  if (["late mark", "late", "l"].includes(raw)) return "Late Mark";
  if (["absent", "a"].includes(raw)) return "Absent";
  if (["on duty", "od"].includes(raw)) return "On Duty";
  if (["leave", "lv"].includes(raw)) return "Leave";
  return normalizeText(value);
}

function sanitizeForPath(value, fallback = "item") {
  const clean = normalizeText(value).replace(/[^a-zA-Z0-9_-]/g, "_");
  return clean || fallback;
}

function clampNumber(value, min, max, fallback = 0) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function normalizeIsoDate(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function sortByMostRecentDate(a, b) {
  const aTime = new Date(`${normalizeIsoDate(a?.date) || "1970-01-01"}T00:00:00`).getTime();
  const bTime = new Date(`${normalizeIsoDate(b?.date) || "1970-01-01"}T00:00:00`).getTime();
  if (bTime !== aTime) return bTime - aTime;
  return String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || ""));
}

function normalizeDailyUpdates(value) {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value)
      : [];

  return rows
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      date: normalizeIsoDate(entry.date || entry.sessionDate || entry.updatedAt),
      topic: normalizeText(entry.topic),
      unit: normalizeText(entry.unit),
      notes: normalizeText(entry.notes),
      blockers: normalizeText(entry.blockers),
      pace: normalizeText(entry.pace),
      faculty: normalizeText(entry.faculty),
      className: normalizeText(entry.className || entry.semester),
      coveredToday: clampNumber(entry.coveredToday, 0, 100, 0),
      progress: clampNumber(entry.progress, 0, 100, 0),
      updatedAt: entry.updatedAt || "",
      updatedBy: normalizeText(entry.updatedBy),
      updatedByRole: normalizeRole(entry.updatedByRole)
    }))
    .sort(sortByMostRecentDate);
}

function calculateExpectedProgress(startDate, targetDate, referenceDate = new Date()) {
  const startIso = normalizeIsoDate(startDate);
  const targetIso = normalizeIsoDate(targetDate);
  if (!startIso || !targetIso) return 0;

  const start = new Date(`${startIso}T00:00:00`);
  const target = new Date(`${targetIso}T00:00:00`);
  const current = new Date(`${normalizeIsoDate(referenceDate) || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const duration = Math.max(1, Math.round((target - start) / 86400000) + 1);
  const elapsed = Math.max(0, Math.min(duration, Math.round((current - start) / 86400000) + 1));
  return clampNumber((elapsed / duration) * 100, 0, 100, 0);
}

function mapSyllabusRecord(id, value = {}) {
  const dailyUpdates = normalizeDailyUpdates(value.dailyUpdates);
  const lastUpdate = dailyUpdates[0] || {};
  const progress = clampNumber(value.progress ?? lastUpdate.progress, 0, 100, 0);
  const expectedProgress = Math.round(calculateExpectedProgress(value.startDate, value.targetDate));
  const remaining = Math.max(0, 100 - progress);
  const coveredToday = clampNumber(value.coveredToday ?? lastUpdate.coveredToday, 0, 100, 0);
  const averageDailyCoverage = dailyUpdates.length
    ? Number((dailyUpdates.reduce((sum, entry) => sum + clampNumber(entry.coveredToday, 0, 100, 0), 0) / dailyUpdates.length).toFixed(1))
    : coveredToday;
  const varianceToPlan = Number((progress - expectedProgress).toFixed(1));
  let paceTone = "On Track";
  if (varianceToPlan < -15) paceTone = "Delayed";
  else if (varianceToPlan < -5) paceTone = "Watch";

  return {
    id,
    subject: normalizeText(value.subject || id),
    code: normalizeText(value.code),
    unit: normalizeText(value.unit),
    topic: normalizeText(value.topic || lastUpdate.topic),
    faculty: normalizeText(value.faculty || lastUpdate.faculty),
    semester: normalizeText(value.semester || value.className || lastUpdate.className),
    className: normalizeText(value.className || value.semester || lastUpdate.className),
    startDate: normalizeIsoDate(value.startDate),
    targetDate: normalizeIsoDate(value.targetDate),
    progress,
    coveredToday,
    remaining,
    averageDailyCoverage,
    expectedProgress,
    varianceToPlan,
    paceTone,
    paceValue: normalizeText(value.pace || lastUpdate.pace || paceTone),
    notes: normalizeText(value.notes || lastUpdate.notes),
    blockers: normalizeText(value.blockers || lastUpdate.blockers),
    lastSessionDate: normalizeIsoDate(lastUpdate.date || value.sessionDate || value.updatedAt),
    lastUpdatedAt: lastUpdate.updatedAt || value.updatedAt || "",
    updatedAt: value.updatedAt || "",
    dailyUpdates,
    updatesCount: dailyUpdates.length
  };
}

function normalizeStudentsPayload(studentsVal, className) {
  if (!studentsVal) return [];

  const entries = Array.isArray(studentsVal)
    ? studentsVal.map((item, index) => [String(index + 1), item])
    : Object.entries(studentsVal);

  return entries
    .filter(([, value]) => value && typeof value === "object")
    .map(([key, value], index) => {
      const rollNo =
        value.rollNo ||
        value.roll_no ||
        value.roll ||
        value.id ||
        `${className}-${String(index + 1).padStart(2, "0")}`;
      const name =
        value.name ||
        value.studentName ||
        value.student_name ||
        value.fullName ||
        "Unknown Student";
      const time =
        value.time ||
        value.timestamp ||
        value.scanTime ||
        value.fingerprintTime ||
        "-";

      return {
        rollNo: String(rollNo),
        name: String(name),
        status: normalizeStatus(value.status || value.attendanceStatus || value.attendance),
        time: String(time)
      };
    });
}

function buildSummaryFromStudents(students, fallbackSummary = {}) {
  const summary = {
    total: students.length,
    present: 0,
    onTime: 0,
    lateMark: 0,
    absent: 0,
    od: 0,
    leave: 0,
    faculty: fallbackSummary.faculty || "-",
    updatedAt: new Date().toISOString()
  };

  students.forEach((student) => {
    switch (student.status) {
      case "On Time":
        summary.onTime += 1;
        summary.present += 1;
        break;
      case "Late Mark":
        summary.lateMark += 1;
        summary.present += 1;
        break;
      case "On Duty":
        summary.od += 1;
        break;
      case "Leave":
        summary.leave += 1;
        break;
      default:
        summary.absent += 1;
        break;
    }
  });

  return summary;
}

function studentsFromUsers(usersVal, className) {
  if (!usersVal || typeof usersVal !== "object") return [];

  const targetClass = normalizeClassToken(className);
  return Object.values(usersVal)
    .filter((u) => u && typeof u === "object")
    .filter((u) => normalizeRole(u.role) === "student")
    .filter((u) => normalizeClassToken(u.class || u.className) === targetClass)
    .map((u, index) => ({
      rollNo: String(u.id || u.rollNo || `${className}-${String(index + 1).padStart(2, "0")}`),
      name: String(u.name || u.studentName || "Unknown Student"),
      status: normalizeStatus(u.status || u.attendanceStatus || "Absent"),
      time: String(u.time || u.timestamp || "-")
    }));
}

async function dbGet(pathName, fallback = null) {
  const snapshot = await getDb().ref(pathName).get();
  return snapshot.exists() ? snapshot.val() : fallback;
}

async function dbSet(pathName, value) {
  await getDb().ref(pathName).set(value);
}

async function dbRemove(pathName) {
  await getDb().ref(pathName).set(null);
}

async function dbUpdate(pathName, value) {
  const ref = getDb().ref(pathName);
  if (typeof ref.update === "function") {
    await ref.update(value);
    return;
  }

  const current = (await dbGet(pathName, {})) || {};
  await ref.set({ ...current, ...value });
}

async function dbPush(pathName, value) {
  const ref = getDb().ref(pathName).push();
  await ref.set(value);
  return ref.key;
}

async function logActivity(action, actor = {}, meta = {}) {
  await dbPush("activity_log", {
    action,
    actorUid: actor.uid || null,
    actorName: actor.name || actor.email || "Unknown User",
    actorRole: actor.role || "guest",
    meta,
    timestamp: new Date().toISOString()
  });
}

async function findUserByEmail(email) {
  const users = (await dbGet("users", {})) || {};
  return (
    Object.entries(users).find(([, user]) => normalizeEmail(user.email) === normalizeEmail(email)) || [null, null]
  );
}

async function findUserByFingerprint(fingerprintId) {
  const normalizedId = normalizeFingerprint(fingerprintId);
  if (!normalizedId) return [null, null];

  const users = (await dbGet("users", {})) || {};
  return (
    Object.entries(users).find(
      ([, user]) => normalizeFingerprint(user.fingerprintEnrollmentId || user.fingerprintId) === normalizedId
    ) || [null, null]
  );
}

async function findUserByIdentifier(identifier) {
  const users = (await dbGet("users", {})) || {};
  const clean = normalizeText(identifier).toLowerCase();
  return (
    Object.entries(users).find(([uid, user]) => {
      if (!user || typeof user !== "object") return false;
      const username = normalizeText(user.username || uid).toLowerCase();
      const email = normalizeEmail(user.email);
      return username === clean || email === clean;
    }) || [null, null]
  );
}

async function ensurePlatformDefaults() {
  const db = getDb();
  const now = new Date().toISOString();

  const defaults = [
    {
      path: "classroom_status",
      value: {
        [DEFAULT_CLASSROOM]: {
          classroom: DEFAULT_CLASSROOM,
          studentsPresent: 48,
          studentsInside: 44,
          doorStatus: "Locked",
          lectureStatus: "Idle",
          alerts: "No active alerts",
          currentLecture: "Digital Signal Processing",
          temperature: 24,
          humidity: 58,
          updatedAt: now
        }
      }
    },
    {
      path: "manual_otp",
      value: {
        [DEFAULT_CLASSROOM]: {
          code: "482913",
          status: "active",
          generatedAt: now,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        }
      }
    },
    {
      path: "alerts",
      value: {
        default_alert: {
          title: "Biometric fallback ready",
          message: "Manual OTP attendance is enabled when fingerprint recognition fails.",
          severity: "info",
          classroom: DEFAULT_CLASSROOM,
          createdAt: now
        }
      }
    },
    {
      path: "events",
      value: {
        seminar_launch: {
          classroom: DEFAULT_CLASSROOM,
          event_type: "Seminar",
          start_time: "10:30",
          end_time: "12:00",
          approved_by: "HOD",
          status: "Scheduled",
          createdAt: now
        }
      }
    },
    {
      path: "timetable",
      value: {
        SY: {
          Monday: [
            { time: "09:00", subject: "Mathematics III", faculty: "Prof. Kulkarni", classroom: DEFAULT_CLASSROOM },
            { time: "10:00", subject: "Data Structures", faculty: "Prof. Shah", classroom: DEFAULT_CLASSROOM }
          ]
        },
        TY: {
          Monday: [
            { time: "09:00", subject: "Embedded Systems", faculty: "Prof. More", classroom: DEFAULT_CLASSROOM },
            { time: "11:00", subject: "IoT Lab", faculty: "Dr. Patil", classroom: DEFAULT_CLASSROOM }
          ]
        },
        BE: {
          Monday: [
            { time: "09:30", subject: "Machine Learning", faculty: "Dr. Deshmukh", classroom: DEFAULT_CLASSROOM },
            { time: "11:30", subject: "Project Review", faculty: "Prof. Chavan", classroom: DEFAULT_CLASSROOM }
          ]
        }
      }
    },
    {
      path: "syllabus",
      value: {
        sy: { subject: "Data Structures", progress: 62, faculty: "Prof. Shah", updatedAt: now },
        ty: { subject: "Embedded Systems", progress: 74, faculty: "Dr. Patil", updatedAt: now },
        be: { subject: "Machine Learning", progress: 81, faculty: "Dr. Deshmukh", updatedAt: now }
      }
    }
  ];

  for (const item of defaults) {
    const existing = await db.ref(item.path).get();
    if (!existing.exists()) {
      await db.ref(item.path).set(item.value);
    }
  }
}

function issueSessionToken(user) {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      role: normalizeRole(user.role),
      name: user.name,
      department: user.department || "",
      className: user.className || user.class || ""
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

async function verifyFirebaseBearerToken(token) {
  const auth = getAuth();
  if (!auth || !token) return null;

  try {
    return await auth.verifyIdToken(token);
  } catch (err) {
    return null;
  }
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (jwtErr) {
    const firebaseDecoded = await verifyFirebaseBearerToken(token);
    if (!firebaseDecoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const [uid, profile] = await findUserByEmail(firebaseDecoded.email || "");
    if (!uid || !profile) {
      return res.status(401).json({ error: "User profile not found in database" });
    }

    req.user = {
      uid,
      email: profile.email,
      name: profile.name,
      role: normalizeRole(profile.role),
      department: profile.department || "",
      className: profile.className || profile.class || ""
    };
    return next();
  }
}

function requireRoles(roles) {
  return (req, res, next) => {
    const role = normalizeRole(req.user?.role);
    if (!roles.includes(role)) {
      return res.status(403).json({ error: "Access denied for this role" });
    }
    next();
  };
}

function isStudent(user) {
  return normalizeRole(user?.role) === "student";
}

function isClassCoordinator(user) {
  return normalizeRole(user?.role) === "cc";
}

function getUserClass(user) {
  return normalizeClass(user?.className || user?.class || "") || "";
}

async function resolveAccessibleClass(requestedClass, user) {
  if (isStudent(user) || isClassCoordinator(user)) {
    return getUserClass(user);
  }
  return await resolveClassKey(requestedClass || getUserClass(user) || DEFAULT_CLASSROOM);
}

function filterItemsByClassroom(items, user) {
  if (!isStudent(user) && !isClassCoordinator(user)) return items;

  const userClass = getUserClass(user);
  return items.filter((item) => {
    const classroom = normalizeText(item.classroom || "");
    return !classroom || classroom === DEFAULT_CLASSROOM || classroom === userClass;
  });
}

async function resolveClassKey(requestedClass) {
  const normalized = normalizeClass(requestedClass);
  if (!normalized) return null;

  const attendanceObj = (await dbGet("attendance", {})) || {};
  const keys = Object.keys(attendanceObj);
  if (!keys.length) return normalized;

  const exact = keys.find((k) => k === normalized);
  if (exact) return exact;

  const lower = normalized.toLowerCase();
  return keys.find((k) => String(k).toLowerCase() === lower) || normalized;
}

async function buildAttendanceSummary(className) {
  const [summary, studentsVal, usersVal] = await Promise.all([
    dbGet(`attendance/${className}/summary`, {}),
    dbGet(`attendance/${className}/students`, {}),
    dbGet("users", {})
  ]);

  const students = Object.keys(studentsVal || {}).length
    ? normalizeStudentsPayload(studentsVal, className)
    : studentsFromUsers(usersVal, className);
  const computedSummary = buildSummaryFromStudents(students, summary || {});

  return {
    summary: {
      ...(summary || {}),
      ...computedSummary,
      faculty: (summary || {}).faculty || computedSummary.faculty || "-"
    },
    students
  };
}

async function getTodayTimetable(className) {
  const timetable = (await dbGet(`timetable/${className}`, {})) || {};
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  return timetable[dayName] || [];
}

function getTodayName() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
}

async function getAlertsList() {
  const alerts = (await dbGet("alerts", {})) || {};
  return Object.entries(alerts)
    .map(([id, value]) => ({ id, ...(value || {}) }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

async function getEventsList() {
  const events = (await dbGet("events", {})) || {};
  return Object.entries(events)
    .map(([id, value]) => ({ id, ...(value || {}) }))
    .sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));
}

async function getUsersList() {
  const users = (await dbGet("users", {})) || {};
  return Object.entries(users).map(([uid, user]) => ({
    uid,
    ...user,
    role: normalizeRole(user.role)
  }));
}

async function getSyllabusList() {
  const syllabus = (await dbGet("syllabus", {})) || {};
  return Object.entries(syllabus).map(([id, value]) => mapSyllabusRecord(id, value || {}));
}

async function getFeedbackConfig() {
  const config = (await dbGet("feedback/config", {})) || {};
  return {
    enabled: Boolean(config.enabled),
    title: config.title || "Class Feedback",
    prompt: config.prompt || "",
    suggestions: Array.isArray(config.suggestions) ? config.suggestions : []
  };
}

async function getFeedbackEntries() {
  const entries = (await dbGet("feedback/entries", {})) || {};
  return Object.entries(entries)
    .map(([id, value]) => ({ id, ...(value || {}) }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

async function getOdRequests() {
  const requests = (await dbGet("od_requests", {})) || {};
  return Object.entries(requests)
    .map(([id, value]) => ({ id, ...(value || {}) }))
    .sort((a, b) => String(b.requestedAt || "").localeCompare(String(a.requestedAt || "")));
}

function toUiTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

async function getAttendanceLogs(className) {
  const safeClass = className || DEFAULT_CLASSROOM;
  const students = (await dbGet(`attendance/${safeClass}/students`, {})) || {};
  return normalizeStudentsPayload(students, safeClass)
    .map((student) => ({
      rollNo: student.rollNo,
      name: student.name,
      status: student.status,
      time: student.time
    }))
    .sort((a, b) => String(a.rollNo).localeCompare(String(b.rollNo)));
}

function isVerificationRecord(key, value) {
  const text = `${key} ${JSON.stringify(value || {})}`;
  return /connect_test_|student_\d+@example\.com|cc_\d+@example\.com|hod_\d+@example\.com|admin_\d+@example\.com|Connectivity Test|Student Verify|CC Verify|HOD Verify|Admin Verify|Verification OD|Connectivity Alert|Verification Subject|FP_student_|FP_cc_|FP_hod_|FP_admin_/i.test(text);
}

async function getDashboardPayload(user) {
  const userRole = normalizeRole(user.role);
  const className = user.className || DEFAULT_CLASSROOM;
  const [allAlerts, events, syllabus, users, status] = await Promise.all([
    getAlertsList(),
    getEventsList(),
    getSyllabusList(),
    getUsersList(),
    dbGet(`classroom_status/${DEFAULT_CLASSROOM}`, {})
  ]);
  const alerts = filterItemsByClassroom(allAlerts, user);

  if (userRole === "student") {
    const { summary } = await buildAttendanceSummary(className);
    return {
      metrics: {
        attendancePercentage: Math.round(((summary.present || 0) / Math.max(summary.total || 1, 1)) * 100),
        lectureStatus: status.lectureStatus || "Idle",
        manualOtpStatus: ((await dbGet(`manual_otp/${DEFAULT_CLASSROOM}`, {})) || {}).status || "inactive",
        notifications: alerts.length
      },
      timetable: await getTodayTimetable(className),
      alerts: alerts.slice(0, 5),
      lectureStatus: status
    };
  }

  if (userRole === "faculty") {
    const logs = await getAttendanceLogs(className);
    return {
      actions: COMMANDS,
      attendanceLogs: logs.slice(0, 12),
      lectureProgress: syllabus.filter((item) => normalizeText(item.faculty) === normalizeText(user.name)),
      summary: (await buildAttendanceSummary(className)).summary
    };
  }

  if (userRole === "hod") {
    const facultyUsers = users.filter((entry) => entry.role === "faculty");
    return {
      facultyWorkload: facultyUsers.map((entry, index) => ({
        faculty: entry.name,
        lectures: 12 + index * 2,
        department: entry.department || user.department || "General"
      })),
      approvals: events.filter((item) => normalizeText(item.status) !== "Approved"),
      syllabus,
      attendanceAnalytics: await Promise.all(
        ["SY", "TY", "BE"].map(async (cls) => {
          const { summary } = await buildAttendanceSummary(cls);
          return { className: cls, attendance: Math.round(((summary.present || 0) / Math.max(summary.total || 1, 1)) * 100) };
        })
      )
    };
  }

  if (userRole === "cc") {
    const { summary } = await buildAttendanceSummary(className);
    return {
      timetable: await getTodayTimetable(className),
      alerts: alerts.filter((item) => normalizeText(item.classroom || "") === className).slice(0, 10),
      summary,
      lectureStatus: status
    };
  }

  return {
    users,
    events,
    alerts,
    monitor: status,
    timetable: await dbGet("timetable", {}),
    syllabus
  };
}

app.get("/api/health", async (_, res) => {
  await ensurePlatformDefaults();
  res.json({ ok: true, service: "saac-backend" });
});

app.get("/api/config", (_, res) => {
  res.json({
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY || "",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
      databaseURL: process.env.FIREBASE_DATABASE_URL || "",
      projectId: process.env.FIREBASE_PROJECT_ID || "",
      appId: process.env.FIREBASE_APP_ID || "",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || ""
    }
  });
});

app.get("/api/fingerprint/:fingerprintId", async (req, res) => {
  try {
    const [uid, user] = await findUserByFingerprint(req.params.fingerprintId);
    if (!uid || !user) {
      return res.json({ exists: false });
    }

    return res.json({
      exists: true,
      user: {
        uid,
        name: user.name || "",
        role: normalizeRole(user.role),
        department: user.department || "",
        className: user.className || user.class || "",
        email: user.email || ""
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to lookup fingerprint", details: err.message });
  }
});

app.post("/api/auth/session", async (req, res) => {
  try {
    const expectedRole = normalizeRole(req.body?.expectedRole || req.body?.role || "");
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const decoded = await verifyFirebaseBearerToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid Firebase token" });
    }

    const [uid, profile] = await findUserByEmail(decoded.email || "");
    if (!uid || !profile) {
      return res.status(404).json({ error: "User profile not found. Complete signup first." });
    }
    if (expectedRole && normalizeRole(profile.role) !== expectedRole) {
      return res.status(403).json({ error: `This account is registered as ${normalizeRole(profile.role).toUpperCase()}, not ${expectedRole.toUpperCase()}.` });
    }

    const sessionToken = issueSessionToken({ uid, ...profile });
    await logActivity("session_created", { uid, ...profile }, {});
    return res.json({
      token: sessionToken,
      user: {
        uid,
        ...profile,
        role: normalizeRole(profile.role)
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create session", details: err.message });
  }
});

app.post("/api/auth/sync-profile", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const decoded = await verifyFirebaseBearerToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid Firebase token" });
    }

    const body = req.body || {};
    const fingerprintId = normalizeFingerprint(body.fingerprintEnrollmentId);
    const [existingUid, fingerprintProfile] = fingerprintId ? await findUserByFingerprint(fingerprintId) : [null, null];
    const uid = existingUid || decoded.uid;
    const email = normalizeEmail(decoded.email || body.email || "");
    const role = fingerprintProfile ? normalizeRole(fingerprintProfile.role) : normalizeRole(body.role);
    const className = normalizeClass(body.className || body.class) || "";
    const profile = {
      uid,
      name: fingerprintProfile?.name || normalizeText(body.name),
      email,
      role,
      fingerprintEnrollmentId: fingerprintId,
      department: fingerprintProfile?.department || normalizeText(body.department),
      className: fingerprintProfile?.className || fingerprintProfile?.class || className,
      class: fingerprintProfile?.className || fingerprintProfile?.class || className,
      username: normalizeText(body.username || email.split("@")[0]),
      passwordHash: body.password ? await bcrypt.hash(String(body.password), 10) : undefined,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    const current = (await dbGet(`users/${uid}`, {})) || {};
    if (!profile.name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!profile.department) {
      return res.status(400).json({ error: "Department is required" });
    }

    await dbSet(`users/${uid}`, {
      ...current,
      ...profile,
      passwordHash: profile.passwordHash || current.passwordHash || ""
    });

    await logActivity("user_profile_synced", { uid, ...profile }, { role, className: profile.className });
    return res.status(201).json({
      message: "Profile synced",
      user: {
        uid,
        ...profile
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to sync profile", details: err.message });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, username, email, department, password, role, fingerprintEnrollmentId, className } = req.body || {};
    if (!name || !email || !department || !password) {
      return res.status(400).json({ error: "Name, email, department and password are required" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters and include alphabets, numbers, and special characters." });
    }

    const cleanEmail = normalizeEmail(email);
    const cleanRole = normalizeRole(role || "admin");
    const [uidFromEmail, existingEmail] = await findUserByEmail(cleanEmail);
    if (uidFromEmail && existingEmail) {
      return res.status(409).json({ error: "Account already exists" });
    }

    const uid = sanitizeForPath(username || cleanEmail.split("@")[0], `user_${Date.now()}`);
    const fingerprintId = normalizeFingerprint(fingerprintEnrollmentId);
    const [, fingerprintProfile] = fingerprintId ? await findUserByFingerprint(fingerprintId) : [null, null];

    await dbSet(`users/${uid}`, {
      uid,
      name: fingerprintProfile?.name || normalizeText(name),
      username: sanitizeForPath(username || uid),
      email: cleanEmail,
      department: fingerprintProfile?.department || normalizeText(department),
      passwordHash: await bcrypt.hash(String(password), 10),
      role: fingerprintProfile?.role || cleanRole,
      className: fingerprintProfile?.className || fingerprintProfile?.class || normalizeClass(className) || "",
      class: fingerprintProfile?.className || fingerprintProfile?.class || normalizeClass(className) || "",
      fingerprintEnrollmentId: fingerprintId,
      createdAt: new Date().toISOString()
    });

    await logActivity("user_signed_up_fallback", { uid, email: cleanEmail, role: cleanRole, name }, {});
    return res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    return res.status(500).json({ error: "Signup failed", details: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const expectedRole = normalizeRole(req.body?.expectedRole || req.body?.role || "");
    if (!username || !password) {
      return res.status(400).json({ error: "Username/email and password are required" });
    }

    const [uid, account] = await findUserByIdentifier(username);
    if (!uid || !account) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(String(password), account.passwordHash || "");
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (expectedRole && normalizeRole(account.role) !== expectedRole) {
      return res.status(403).json({ error: `This account is registered as ${normalizeRole(account.role).toUpperCase()}, not ${expectedRole.toUpperCase()}.` });
    }

    const token = issueSessionToken({ uid, ...account });
    await dbUpdate(`users/${uid}`, { lastLoginAt: new Date().toISOString() });
    await logActivity("user_logged_in_fallback", { uid, ...account }, {});

    return res.json({
      token,
      user: {
        uid,
        ...account,
        role: normalizeRole(account.role)
      },
      admin: {
        name: account.name,
        username: account.username,
        email: account.email,
        department: account.department
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Login failed", details: err.message });
  }
});

app.get("/api/me", authMiddleware, async (req, res) => {
  const [uid, profile] = await findUserByEmail(req.user.email || "");
  if (!uid || !profile) {
    return res.status(404).json({ error: "User profile not found" });
  }

  return res.json({
    user: {
      uid,
      ...profile,
      role: normalizeRole(profile.role)
    }
  });
});

app.get("/api/dashboard", authMiddleware, async (req, res) => {
  try {
    const payload = await getDashboardPayload(req.user);
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load dashboard", details: err.message });
  }
});

app.get("/api/attendance/summary/:className", authMiddleware, async (req, res) => {
  try {
    const className = await resolveAccessibleClass(req.params.className, req.user);
    if (!className) return res.status(400).json({ error: "Invalid class" });
    const data = await buildAttendanceSummary(className);
    return res.json(data.summary);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch summary", details: err.message });
  }
});

app.get("/api/attendance/students/:className", authMiddleware, async (req, res) => {
  try {
    const filter = String(req.query.filter || "present");
    const className = await resolveAccessibleClass(req.params.className, req.user);
    if (!className) return res.status(400).json({ error: "Invalid class" });

    const data = await buildAttendanceSummary(className);
    const statuses = mapFilterStatus(filter);
    let filtered = statuses ? data.students.filter((s) => statuses.includes(s.status)) : data.students;

    if (isStudent(req.user)) {
      const normalizedUserName = normalizeText(req.user.name);
      const studentKey = sanitizeForPath(req.user.uid, sanitizeForPath(req.user.email, "student")).toUpperCase();
      filtered = filtered.filter((student) => {
        const rollNo = normalizeText(student.rollNo).toUpperCase();
        return rollNo === studentKey || normalizeText(student.name) === normalizedUserName;
      });
    }

    return res.json({
      filter,
      className,
      students: filtered
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch students", details: err.message });
  }
});

app.get("/api/attendance/classes", authMiddleware, async (req, res) => {
  try {
    if (isStudent(req.user) || isClassCoordinator(req.user)) {
      const userClass = getUserClass(req.user);
      return res.json({ classes: userClass ? [userClass] : [] });
    }

    const [attendanceObj, usersObj] = await Promise.all([dbGet("attendance", {}), dbGet("users", {})]);
    const classes = new Set();

    Object.keys(attendanceObj || {})
      .filter((item) => normalizeClass(item))
      .forEach((item) => classes.add(item));

    Object.values(usersObj || {})
      .filter((user) => normalizeClass(user.className || user.class))
      .forEach((user) => classes.add(normalizeText(user.className || user.class)));

    const classList = Array.from(classes).sort((a, b) => String(a).localeCompare(String(b)));
    return res.json({ classes: classList.length ? classList : ["SY", "TY", "BE"] });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch classes", details: err.message });
  }
});

app.get("/api/attendance/logs", authMiddleware, async (req, res) => {
  try {
    const className = await resolveAccessibleClass(req.query.className, req.user);
    if (!className) return res.status(400).json({ error: "Invalid class" });
    return res.json({ logs: await getAttendanceLogs(className) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch attendance logs", details: err.message });
  }
});

app.post("/api/manual-otp/verify", authMiddleware, requireRoles(["student"]), async (req, res) => {
  try {
    const { classroom = DEFAULT_CLASSROOM, otp } = req.body || {};
    const otpData = (await dbGet(`manual_otp/${classroom}`, null)) || null;
    if (!otpData || otpData.status !== "active") {
      return res.status(400).json({ error: "No active OTP found" });
    }

    if (String(otpData.code) !== String(otp || "")) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (otpData.expiresAt && new Date(otpData.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "OTP expired" });
    }

    const userClass = req.user.className || "SY";
    const studentKey = sanitizeForPath(req.user.uid, sanitizeForPath(req.user.email, "student"));
    await dbUpdate(`attendance/${userClass}/students/${studentKey}`, {
      rollNo: studentKey.toUpperCase(),
      name: req.user.name,
      status: "Present",
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      attendanceMode: "manual_otp"
    });

    const attendance = await buildAttendanceSummary(userClass);
    await dbSet(`attendance/${userClass}/summary`, attendance.summary);
    await dbUpdate(`manual_otp/${classroom}`, { status: "used", usedBy: req.user.uid, usedAt: new Date().toISOString() });
    await logActivity("manual_otp_verified", req.user, { classroom, className: userClass });
    return res.json({ message: "Manual attendance marked successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to verify OTP", details: err.message });
  }
});

app.post("/api/control/command", authMiddleware, async (req, res) => {
  try {
    const { command, classroom = DEFAULT_CLASSROOM } = req.body || {};
    if (!COMMANDS.includes(command)) {
      return res.status(400).json({ error: "Unsupported command" });
    }

    const role = normalizeRole(req.user?.role);
    const canIssueCommand = ["faculty", "admin", "hod"].includes(role);
    const canIssueStudentOtp = role === "student" && command === "generate_otp";
    if (!canIssueCommand && !canIssueStudentOtp) {
      return res.status(403).json({ error: "Access denied for this command" });
    }

    const payload = {
      command,
      classroom,
      issuedBy: req.user.name,
      role,
      status: "queued",
      timestamp: new Date().toISOString()
    };

    await dbSet(`commands/${command}`, payload);

    if (command === "generate_otp") {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      await dbSet(`manual_otp/${classroom}`, {
        code: otp,
        status: "active",
        generatedBy: req.user.name,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      });
    }

    const statusPatch = {
      updatedAt: new Date().toISOString()
    };
    if (command === "open_class") statusPatch.doorStatus = "Unlocked";
    if (command === "end_lecture") statusPatch.lectureStatus = "Completed";
    if (command === "short_break") statusPatch.lectureStatus = "Short Break";
    if (command === "emergency") statusPatch.alerts = "Emergency alert triggered";
    if (command === "start_seminar") statusPatch.lectureStatus = "Seminar";
    if (command === "half_day") statusPatch.lectureStatus = "Half Day";
    await dbUpdate(`classroom_status/${classroom}`, statusPatch);

    await logActivity("command_issued", req.user, { command, classroom });
    return res.json({ message: "Command queued", payload });
  } catch (err) {
    return res.status(500).json({ error: "Failed to queue command", details: err.message });
  }
});

app.get("/api/control/status", authMiddleware, requireRoles(["faculty", "admin", "hod"]), async (_, res) => {
  try {
    const status = (await dbGet("classroom_status", {})) || {};
    const commands = (await dbGet("commands", {})) || {};
    const otp = (await dbGet("manual_otp", {})) || {};
    return res.json({ classrooms: status, commands, manualOtp: otp });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch control status", details: err.message });
  }
});

app.get("/api/events", authMiddleware, async (req, res) => {
  try {
    return res.json({ events: filterItemsByClassroom(await getEventsList(), req.user) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch events", details: err.message });
  }
});

app.post("/api/events", authMiddleware, requireRoles(["admin", "hod", "cc"]), async (req, res) => {
  try {
    const body = req.body || {};
    const event = {
      classroom: normalizeText(body.classroom || DEFAULT_CLASSROOM),
      event_type: normalizeText(body.event_type || body.eventType),
      start_time: normalizeText(body.start_time || body.startTime),
      end_time: normalizeText(body.end_time || body.endTime),
      approved_by: normalizeText(body.approved_by || req.user.name),
      status: normalizeText(body.status || "Scheduled"),
      createdAt: new Date().toISOString()
    };

    if (!event.event_type || !event.start_time || !event.end_time) {
      return res.status(400).json({ error: "Event type, start time and end time are required" });
    }

    const id = await dbPush("events", event);
    await logActivity("event_scheduled", req.user, { eventId: id, eventType: event.event_type });
    return res.status(201).json({ id, event });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create event", details: err.message });
  }
});

app.get("/api/timetable", authMiddleware, async (req, res) => {
  try {
    const className = await resolveAccessibleClass(req.query.className, req.user);
    if (!className) return res.status(400).json({ error: "Invalid class name" });
    const full = (await dbGet(`timetable/${className}`, {})) || {};
    const approval = full.approval || null;
    const schedule = await getTodayTimetable(className);
    return res.json({
      className,
      schedule,
      full,
      approval: approval
        ? {
            status: approval.approved ? "Approved by HOD" : approval.status || "Sent to HOD for approval",
            updatedBy: approval.approvedBy || approval.updatedBy || "-",
            timestamp: approval.approvedAt || approval.timestamp || "-"
          }
        : null,
      summary: schedule.length ? "Timetable loaded from database." : "No timetable entries available for today."
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch timetable", details: err.message });
  }
});

app.post("/api/timetable", authMiddleware, requireRoles(["admin", "hod", "cc"]), async (req, res) => {
  try {
    const body = req.body || {};
    const className = await resolveAccessibleClass(body.className, req.user);
    if (!className) return res.status(400).json({ error: "Invalid class name" });

    const entry = {
      time: normalizeText(body.time),
      subject: normalizeText(body.subject),
      faculty: normalizeText(body.faculty),
      classroom: normalizeText(body.classroom || className)
    };
    if (!entry.time || !entry.subject || !entry.faculty || !entry.classroom) {
      return res.status(400).json({ error: "Time, subject, faculty and classroom are required" });
    }

    const dayName = getTodayName();
    const existing = (await dbGet(`timetable/${className}/${dayName}`, [])) || [];
    const nextRows = Array.isArray(existing) ? [...existing, entry] : [entry];
    await dbSet(`timetable/${className}/${dayName}`, nextRows);
    await logActivity("timetable_entry_added", req.user, { className, dayName, subject: entry.subject });
    return res.status(201).json({ message: "Timetable entry added", entry });
  } catch (err) {
    return res.status(500).json({ error: "Failed to add timetable entry", details: err.message });
  }
});

app.post("/api/timetable/approval", authMiddleware, requireRoles(["faculty", "admin", "hod", "cc"]), async (req, res) => {
  try {
    const { className, approved = true } = req.body || {};
    const cleanClass = await resolveAccessibleClass(className, req.user);
    if (!cleanClass) {
      return res.status(400).json({ error: "Invalid class name" });
    }

    const role = normalizeRole(req.user.role);
    const approval = {
      approved: role === "hod" ? Boolean(approved) : false,
      approvedBy: req.user.name,
      updatedBy: req.user.name,
      approvedAt: new Date().toISOString(),
      timestamp: toUiTimestamp(),
      status: role === "hod" ? "Approved by HOD" : "Sent to HOD for approval",
      role
    };
    await dbUpdate(`timetable/${cleanClass}`, {
      approval
    });

    await logActivity("timetable_approved", req.user, { className: cleanClass, approved: approval.approved, status: approval.status });
    return res.json({ message: "Timetable approval updated", approval });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update timetable approval", details: err.message });
  }
});

app.get("/api/syllabus", authMiddleware, async (_, res) => {
  try {
    return res.json({ syllabus: await getSyllabusList() });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch syllabus", details: err.message });
  }
});

app.get("/api/feedback/config", authMiddleware, async (_, res) => {
  try {
    return res.json(await getFeedbackConfig());
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch feedback config", details: err.message });
  }
});

app.post("/api/feedback/config", authMiddleware, requireRoles(["hod"]), async (req, res) => {
  try {
    const body = req.body || {};
    const config = {
      enabled: Boolean(body.enabled),
      title: normalizeText(body.title) || "Class Feedback",
      prompt: normalizeText(body.prompt),
      suggestions: Array.isArray(body.suggestions)
        ? body.suggestions.map((item) => normalizeText(item)).filter(Boolean)
        : []
    };
    await dbSet("feedback/config", config);
    await logActivity("feedback_config_updated", req.user, { enabled: config.enabled });
    return res.json({ ok: true, config });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update feedback config", details: err.message });
  }
});

app.get("/api/feedback", authMiddleware, async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const className = getUserClass(req.user);
    let entries = await getFeedbackEntries();
    if (role === "student") {
      entries = entries.filter((item) => normalizeText(item.student) === normalizeText(req.user.name));
    } else if (role === "cc") {
      entries = entries.filter((item) => normalizeClassToken(item.className) === normalizeClassToken(className));
    }
    return res.json({ entries });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch feedback", details: err.message });
  }
});

app.post("/api/feedback", authMiddleware, requireRoles(["student"]), async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [req.body || {}];
    const className = getUserClass(req.user);
    const saved = [];
    for (const item of entries) {
      const subject = normalizeText(item.subject);
      if (!subject) continue;
      const row = {
        student: req.user.name,
        className,
        subject,
        rating: Math.max(1, Math.min(Number(item.rating || 0), 5)),
        comment: normalizeText(item.comment) || "No additional comments.",
        createdAt: new Date().toISOString()
      };
      const id = await dbPush("feedback/entries", row);
      saved.push({ id, ...row });
    }
    await logActivity("feedback_submitted", req.user, { count: saved.length, className });
    return res.status(201).json({ ok: true, entries: saved });
  } catch (err) {
    return res.status(500).json({ error: "Failed to submit feedback", details: err.message });
  }
});

app.post("/api/syllabus/update", authMiddleware, requireRoles(["faculty", "cc", "admin", "hod"]), async (req, res) => {
  try {
    const {
      key,
      subject,
      code,
      unit,
      topic,
      faculty,
      semester,
      className,
      startDate,
      targetDate,
      progress,
      coveredToday,
      pace,
      notes,
      blockers,
      sessionDate
    } = req.body || {};
    const targetKey = sanitizeForPath(key || subject, "syllabus");
    const normalizedClass = normalizeText(className || semester || req.user.className || req.user.class);
    const normalizedProgress = clampNumber(progress, 0, 100, 0);
    const normalizedCoveredToday = clampNumber(coveredToday, 0, 100, 0);
    const updateDate = normalizeIsoDate(sessionDate) || new Date().toISOString().slice(0, 10);
    const patch = {
      subject: normalizeText(subject || targetKey),
      code: normalizeText(code),
      unit: normalizeText(unit),
      topic: normalizeText(topic),
      faculty: normalizeText(faculty || req.user.name),
      semester: normalizeText(semester || normalizedClass),
      className: normalizedClass,
      startDate: normalizeIsoDate(startDate),
      targetDate: normalizeIsoDate(targetDate),
      progress: normalizedProgress,
      coveredToday: normalizedCoveredToday,
      pace: normalizeText(pace),
      notes: normalizeText(notes),
      blockers: normalizeText(blockers),
      sessionDate: updateDate,
      updatedAt: new Date().toISOString()
    };
    const dailyUpdate = {
      date: updateDate,
      topic: patch.topic,
      unit: patch.unit,
      notes: patch.notes,
      blockers: patch.blockers,
      pace: patch.pace,
      faculty: patch.faculty,
      className: patch.className,
      coveredToday: normalizedCoveredToday,
      progress: normalizedProgress,
      updatedAt: patch.updatedAt,
      updatedBy: req.user.name,
      updatedByRole: req.user.role
    };
    await dbUpdate(`syllabus/${targetKey}`, patch);
    await dbPush(`syllabus/${targetKey}/dailyUpdates`, dailyUpdate);
    await logActivity("syllabus_updated", req.user, { ...patch, coveredToday: normalizedCoveredToday, sessionDate: updateDate });
    return res.json({ message: "Daily syllabus update saved", patch: mapSyllabusRecord(targetKey, { ...patch, dailyUpdates: [dailyUpdate] }) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update syllabus", details: err.message });
  }
});

app.get("/api/alerts", authMiddleware, async (req, res) => {
  try {
    return res.json({ alerts: filterItemsByClassroom(await getAlertsList(), req.user) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch alerts", details: err.message });
  }
});

app.get("/api/od/requests", authMiddleware, async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const className = getUserClass(req.user);
    let rows = await getOdRequests();
    if (role === "student") {
      rows = rows.filter((item) => normalizeText(item.student) === normalizeText(req.user.name));
    } else if (role === "cc") {
      rows = rows.filter((item) => normalizeClassToken(item.className) === normalizeClassToken(className));
    }
    return res.json({ requests: rows });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch OD requests", details: err.message });
  }
});

app.post("/api/od/request", authMiddleware, requireRoles(["student"]), async (req, res) => {
  try {
    const reason = normalizeText(req.body?.reason);
    const date = normalizeText(req.body?.date) || new Date().toISOString().slice(0, 10);
    if (!reason) return res.status(400).json({ error: "OD reason is required." });

    const className = getUserClass(req.user);
    const rows = await getAttendanceLogs(className);
    const studentRow = rows.find((row) => normalizeText(row.name) === normalizeText(req.user.name));
    const entry = {
      student: req.user.name,
      rollNo: studentRow?.rollNo || sanitizeForPath(req.user.uid, "student").toUpperCase(),
      className,
      date,
      reason,
      status: "Pending",
      requestedBy: req.user.name,
      requestedAt: new Date().toISOString(),
      approvedBy: "",
      approvedRole: "",
      approvedAt: ""
    };
    const id = await dbPush("od_requests", entry);
    await logActivity("od_requested", req.user, { id, className, date });
    return res.status(201).json({ ok: true, request: { id, ...entry } });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create OD request", details: err.message });
  }
});

app.post("/api/od/request/:requestId/decision", authMiddleware, requireRoles(["cc", "hod"]), async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const requestId = normalizeText(req.params.requestId);
    const action = normalizeText(req.body?.action).toLowerCase();
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Invalid OD decision." });
    }

    const current = (await dbGet(`od_requests/${requestId}`, null)) || null;
    if (!current) return res.status(404).json({ error: "OD request not found." });
    if (role === "cc" && normalizeClassToken(current.className) !== normalizeClassToken(getUserClass(req.user))) {
      return res.status(403).json({ error: "CC can only process OD requests for their own class." });
    }

    const patch = {
      status: action === "approve" ? "Approved" : "Rejected",
      approvedBy: req.user.name,
      approvedRole: role,
      approvedAt: new Date().toISOString()
    };
    await dbUpdate(`od_requests/${requestId}`, patch);
    await logActivity("od_request_decided", req.user, { requestId, action, className: current.className });
    return res.json({ ok: true, request: { id: requestId, ...current, ...patch } });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process OD request", details: err.message });
  }
});

app.get("/api/od/report", authMiddleware, requireRoles(["cc", "hod"]), async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const requestedClass = normalizeText(req.query.className);
    const effectiveClass = role === "cc" ? getUserClass(req.user) : requestedClass;
    const rows = (await getOdRequests())
      .filter((item) => normalizeText(item.status) === "Approved")
      .filter((item) => !effectiveClass || normalizeClassToken(item.className) === normalizeClassToken(effectiveClass))
      .map((item) => ({
        id: item.id,
        student: item.student,
        rollNo: item.rollNo,
        className: item.className,
        date: item.date,
        reason: item.reason,
        approvedBy: item.approvedBy,
        approvedAt: item.approvedAt
      }));
    return res.json({
      rows,
      className: effectiveClass || "All Classes",
      generatedOn: toUiTimestamp()
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate OD report", details: err.message });
  }
});

app.post("/api/alerts", authMiddleware, requireRoles(["admin", "hod"]), async (req, res) => {
  try {
    const body = req.body || {};
    const alert = {
      title: normalizeText(body.title),
      message: normalizeText(body.message),
      severity: normalizeText(body.severity || "info"),
      classroom: normalizeText(body.classroom || DEFAULT_CLASSROOM),
      createdAt: new Date().toISOString(),
      createdBy: req.user.name
    };

    if (!alert.title || !alert.message) {
      return res.status(400).json({ error: "Alert title and message are required" });
    }

    const id = await dbPush("alerts", alert);
    await logActivity("alert_created", req.user, { alertId: id, severity: alert.severity });
    return res.status(201).json({ id, alert });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create alert", details: err.message });
  }
});

app.get("/api/users", authMiddleware, requireRoles(["admin", "hod"]), async (_, res) => {
  try {
    return res.json({ users: await getUsersList() });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch users", details: err.message });
  }
});

app.get("/api/activity-log", authMiddleware, requireRoles(["admin", "hod"]), async (_, res) => {
  try {
    const activity = (await dbGet("activity_log", {})) || {};
    const rows = Object.entries(activity)
      .map(([id, value]) => ({ id, ...(value || {}) }))
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))
      .slice(0, 40);
    return res.json({ activity: rows });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch activity log", details: err.message });
  }
});

app.get("/api/analytics", authMiddleware, requireRoles(["faculty", "cc", "admin", "hod"]), async (_, res) => {
  try {
    const classes = ["SY", "TY", "BE"];
    const attendance = await Promise.all(
      classes.map(async (className) => {
        const { summary } = await buildAttendanceSummary(className);
        return {
          className,
          percentage: Math.round(((summary.present || 0) / Math.max(summary.total || 1, 1)) * 100)
        };
      })
    );

    const syllabus = await getSyllabusList();
    const users = await getUsersList();
    const facultyUsers = users.filter((item) => item.role === "faculty");
    const events = await getEventsList();

    return res.json({
      attendance,
      syllabus: syllabus.map((item) => ({
        id: item.id,
        subject: item.subject || item.id,
        code: item.code || "",
        unit: item.unit || "",
        topic: item.topic || "",
        faculty: item.faculty || "",
        semester: item.semester || "",
        className: item.className || item.semester || "",
        startDate: item.startDate || "",
        targetDate: item.targetDate || "",
        progress: Number(item.progress || 0),
        coveredToday: Number(item.coveredToday || 0),
        remaining: Number(item.remaining || 0),
        averageDailyCoverage: Number(item.averageDailyCoverage || 0),
        expectedProgress: Number(item.expectedProgress || 0),
        varianceToPlan: Number(item.varianceToPlan || 0),
        paceTone: item.paceTone || "On Track",
        paceValue: item.paceValue || item.paceTone || "",
        notes: item.notes || "",
        blockers: item.blockers || "",
        updatesCount: Number(item.updatesCount || 0),
        lastSessionDate: item.lastSessionDate || "",
        lastUpdatedAt: item.lastUpdatedAt || item.updatedAt || "",
        dailyUpdates: Array.isArray(item.dailyUpdates) ? item.dailyUpdates : []
      })),
      facultyWorkload: facultyUsers.map((item, index) => ({
        faculty: item.name,
        workload: 14 + index * 3
      })),
      lectureCompletion: [
        { label: "Completed", value: events.filter((item) => normalizeText(item.status) === "Completed").length || 3 },
        { label: "Scheduled", value: events.filter((item) => normalizeText(item.status) === "Scheduled").length || 7 }
      ]
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch analytics", details: err.message });
  }
});

app.get("/api/classrooms/monitor", authMiddleware, requireRoles(["faculty", "admin", "hod"]), async (_, res) => {
  try {
    return res.json({
      classrooms: (await dbGet("classroom_status", {})) || {},
      alerts: await getAlertsList()
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch monitoring data", details: err.message });
  }
});

function generateClassSeed(className, cfg) {
  const names = [
    "Aarav Joshi",
    "Anaya Patil",
    "Neel Desai",
    "Ishita More",
    "Sahil Pawar",
    "Mira Kulkarni",
    "Rohan Shinde",
    "Pooja Gaikwad",
    "Atharva Jadhav",
    "Sneha Chavan",
    "Harsh Vaidya",
    "Rutuja Kale",
    "Pratik Shah",
    "Kavya Gite",
    "Omkar Mane",
    "Tanvi Patankar",
    "Aditya Wagh",
    "Saniya Bhosale",
    "Yash Khedekar",
    "Vaishnavi Salunkhe",
    "Chinmay Kadam",
    "Tejaswini Shelar",
    "Swaraj Sawant",
    "Mansi Bendre"
  ];

  const students = {};
  for (let i = 0; i < cfg.total; i += 1) {
    const rollNo = `${className}-${String(i + 1).padStart(2, "0")}`;
    students[rollNo] = {
      rollNo,
      name: names[i % names.length],
      status: "Absent",
      time: "-"
    };
  }

  let idx = 1;
  for (let i = 0; i < cfg.onTime; i += 1, idx += 1) {
    const rollNo = `${className}-${String(idx).padStart(2, "0")}`;
    students[rollNo].status = "On Time";
    students[rollNo].time = `09:${String(2 + (i % 18)).padStart(2, "0")} AM`;
  }
  for (let i = 0; i < cfg.lateMark; i += 1, idx += 1) {
    const rollNo = `${className}-${String(idx).padStart(2, "0")}`;
    students[rollNo].status = "Late Mark";
    students[rollNo].time = `09:${String(21 + (i % 30)).padStart(2, "0")} AM`;
  }
  for (let i = 0; i < cfg.od; i += 1, idx += 1) {
    const rollNo = `${className}-${String(idx).padStart(2, "0")}`;
    students[rollNo].status = "On Duty";
    students[rollNo].time = "Approved";
  }
  for (let i = 0; i < cfg.leave; i += 1, idx += 1) {
    const rollNo = `${className}-${String(idx).padStart(2, "0")}`;
    students[rollNo].status = "Leave";
    students[rollNo].time = "Approved";
  }

  return {
    summary: {
      total: cfg.total,
      present: cfg.present,
      onTime: cfg.onTime,
      lateMark: cfg.lateMark,
      absent: cfg.absent,
      od: cfg.od,
      leave: cfg.leave,
      faculty: cfg.faculty,
      updatedAt: new Date().toISOString()
    },
    students
  };
}

// ESP32 / edge device helper endpoint
// Allows authenticating using a simple shared secret instead of requiring Firebase tokens.
app.post("/api/esp/write", async (req, res) => {
  try {
    // Support multiple header variants and fallback query param for devices that can't set headers reliably
    const key =
      req.headers["x-esp-key"] ||
      req.headers["x-api-key"] ||
      (req.headers.authorization && String(req.headers.authorization).replace(/^Bearer\s+/i, "")) ||
      req.query.esp_key ||
      req.query.api_key;

    const espSecret = process.env.ESP_SECRET || process.env.ESP_KEY;

    if (!espSecret) {
      console.error("ESP_SECRET is not set on the server. Set ESP_SECRET in .env.");
      return res.status(500).json({ error: "Server misconfigured: missing ESP_SECRET" });
    }

    if (!key) {
      return res.status(401).json({ error: "Unauthorized", reason: "Missing esp key (expected x-esp-key, x-api-key, Authorization: Bearer, or esp_key query)" });
    }

    // Log for debugging without leaking full key
    const maskedKey = `${String(key).slice(0, 3)}...(${String(key).length})`;
    console.log(`[ESP WRITE] key=${maskedKey} path=${req.body?.path || req.query?.path || "(none)"}`);

    if (key !== espSecret) {
      return res.status(401).json({ error: "Unauthorized", reason: "Invalid esp key", expectedLength: espSecret.length, receivedLength: String(key).length });
    }

    const { path, value } = req.body || {};
    if (!path || typeof path !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'path' in request body" });
    }

    // Prevent writing outside expected root (optional)
    const cleanPath = String(path).replace(/^\/+/, "");

    await dbSet(cleanPath, value);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Write failed", details: err.message });
  }
});

app.post("/api/admin/seed", async (req, res) => {
  try {
    const key = req.headers["x-seed-key"];
    if (!process.env.SEED_KEY || key !== process.env.SEED_KEY) {
      return res.status(403).json({ error: "Unauthorized seed request" });
    }

    const seedData = {
      SY: generateClassSeed("SY", {
        total: 72,
        present: 63,
        onTime: 54,
        lateMark: 9,
        absent: 6,
        od: 2,
        leave: 1,
        faculty: "Prof. R. Kulkarni"
      }),
      TY: generateClassSeed("TY", {
        total: 68,
        present: 58,
        onTime: 47,
        lateMark: 11,
        absent: 7,
        od: 2,
        leave: 1,
        faculty: "Dr. S. Patil"
      }),
      BE: generateClassSeed("BE", {
        total: 61,
        present: 52,
        onTime: 44,
        lateMark: 8,
        absent: 6,
        od: 1,
        leave: 2,
        faculty: "Prof. N. Deshmukh"
      })
    };

    await dbSet("attendance", seedData);
    await ensurePlatformDefaults();
    return res.json({ message: "Attendance seed uploaded" });
  } catch (err) {
    return res.status(500).json({ error: "Seed failed", details: err.message });
  }
});

app.post("/api/admin/cleanup-test-data", async (req, res) => {
  try {
    const key = req.headers["x-seed-key"];
    if (!process.env.SEED_KEY || key !== process.env.SEED_KEY) {
      return res.status(403).json({ error: "Unauthorized cleanup request" });
    }

    const removed = {
      users: [],
      od_requests: [],
      feedback_entries: [],
      events: [],
      alerts: [],
      activity_log: [],
      attendance_students: [],
      timetable_rows: []
    };

    const users = (await dbGet("users", {})) || {};
    for (const [id, user] of Object.entries(users)) {
      if (isVerificationRecord(id, user)) {
        await dbRemove(`users/${id}`);
        removed.users.push(id);

        const className = normalizeClass(user.className || user.class || "");
        if (className) {
          const studentKey = sanitizeForPath(id, sanitizeForPath(user.email, "student"));
          await dbRemove(`attendance/${className}/students/${studentKey}`);
          removed.attendance_students.push(`${className}/${studentKey}`);
          const attendance = await buildAttendanceSummary(className);
          await dbSet(`attendance/${className}/summary`, attendance.summary);
        }
      }
    }

    const odRequests = (await dbGet("od_requests", {})) || {};
    for (const [id, row] of Object.entries(odRequests)) {
      if (isVerificationRecord(id, row)) {
        await dbRemove(`od_requests/${id}`);
        removed.od_requests.push(id);
      }
    }

    const feedbackEntries = (await dbGet("feedback/entries", {})) || {};
    for (const [id, row] of Object.entries(feedbackEntries)) {
      if (isVerificationRecord(id, row)) {
        await dbRemove(`feedback/entries/${id}`);
        removed.feedback_entries.push(id);
      }
    }

    const events = (await dbGet("events", {})) || {};
    for (const [id, row] of Object.entries(events)) {
      if (isVerificationRecord(id, row)) {
        await dbRemove(`events/${id}`);
        removed.events.push(id);
      }
    }

    const alerts = (await dbGet("alerts", {})) || {};
    for (const [id, row] of Object.entries(alerts)) {
      if (isVerificationRecord(id, row)) {
        await dbRemove(`alerts/${id}`);
        removed.alerts.push(id);
      }
    }

    const activity = (await dbGet("activity_log", {})) || {};
    for (const [id, row] of Object.entries(activity)) {
      if (isVerificationRecord(id, row)) {
        await dbRemove(`activity_log/${id}`);
        removed.activity_log.push(id);
      }
    }

    const className = "SY";
    const dayName = getTodayName();
    const dayRows = (await dbGet(`timetable/${className}/${dayName}`, [])) || [];
    if (Array.isArray(dayRows)) {
      const filtered = dayRows.filter((row) => !isVerificationRecord("", row));
      if (filtered.length !== dayRows.length) {
        await dbSet(`timetable/${className}/${dayName}`, filtered);
        removed.timetable_rows.push(`${className}/${dayName}`);
      }
    }

    const approval = (await dbGet(`timetable/${className}/approval`, null)) || null;
    if (approval && isVerificationRecord("", approval)) {
      await dbRemove(`timetable/${className}/approval`);
    }

    return res.json({ message: "Test data cleanup completed", removed });
  } catch (err) {
    return res.status(500).json({ error: "Cleanup failed", details: err.message });
  }
});

app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "SAAC.html"));
});

function startServer(preferredPort) {
  const server = app.listen(preferredPort, async () => {
    await ensurePlatformDefaults();
    console.log(`SAAC backend running on port ${preferredPort}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      const nextPort = Number(preferredPort) + 1;
      console.warn(`Port ${preferredPort} is busy. Retrying on ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    console.error("Server failed to start:", err.message);
    process.exit(1);
  });
}

startServer(PORT);
