import { Router } from "express";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import { requireAuth, allowRoles } from "../middleware/authJwt.js";
import { publicUser, issueSession, rotateRefreshToken, issueAccessToken } from "../services/tokenService.js";
import { generatePatientId, isValidMobile } from "../services/idService.js";
import { logAudit } from "../services/auditService.js";

const router = Router();
const OWNER_FIELDS = "name email mobile role patientId employeeNumber profile active blocked hospitalId";

// Patient registration — a real hospital registers each patient once.
// If ?hospitalId=HOSP_CODE is provided, the patient is scoped to that hospital.
// Otherwise it defaults to the "Existing Hospital" (DEFAULT) for legacy support.
// Mobile number is the primary unique key within the hospital.
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, mobile, password, profile = {} } = req.body;
    const { hospitalCode = "DEFAULT" } = req.query;

    if (!name || !password || password.length < 8) {
      return res.status(400).json({ error: "Name and an 8-character password are required" });
    }
    if (!isValidMobile(mobile)) {
      return res.status(400).json({ error: "A valid 10-digit mobile number is required" });
    }
    const normalizedMobile = mobile.replace(/[\s-]/g, "");

    // Resolve hospital by code (trusted identifier), default to DEFAULT.
    let hospital = await Hospital.findOne({ code: hospitalCode.toUpperCase() });
    if (!hospital) hospital = await Hospital.findOne({ code: "DEFAULT" });
    if (!hospital) return res.status(400).json({ error: "Hospital not found" });

    // The auto-generated portal email and Patient ID are globally unique, so a
    // repeat registration — or an email already used by any account — must
    // return a clear message instead of a raw duplicate-key error.
    const normalizedEmail = (email || "").trim().toLowerCase() || `${normalizedMobile}@patient.local`;
    const exists = await User.findOne({
      $or: [{ mobile: normalizedMobile }, { email: normalizedEmail }],
      role: "patient",
    });
    if (exists) {
      return res.status(409).json({
        error: exists.mobile === normalizedMobile
          ? "Patient already exists. Please login with your Patient ID."
          : "This email is already registered. Please login.",
        alreadyPatient: true,
      });
    }

    // The email might belong to a doctor / admin / staff account — tell the user.
    const emailTaken = await User.exists({ email: normalizedEmail });
    if (emailTaken) {
      return res.status(409).json({ error: "An account with this email already exists. Please login or use a different email." });
    }

    // Auto-generate a permanent Patient ID (mobile + year + running sequence).
    const patientId = await generatePatientId(normalizedMobile);
    let user;
    try {
      user = await User.create({
        name,
        email: normalizedEmail,
        mobile: normalizedMobile,
        passwordHash: await bcrypt.hash(password, 12),
        role: "patient",
        hospitalId: hospital._id,
        patientId,
        profile,
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        return res.status(409).json({ error: "A record with this mobile or email already exists. Please login." });
      }
      throw createErr;
    }
    logAudit({ actor: user._id, actorRole: "patient", action: "patient.register", entity: "user", entityId: user._id, meta: { hospitalId: hospital._id } });
    const session = await issueSession(user, { remember: false });
    const pubUser = publicUser(user);
    pubUser.hospitalId = hospital._id;
    pubUser.hospitalName = hospital.name;
    res.status(201).json({ accessToken: session.accessToken, refreshToken: session.refreshToken, remember: false, user: pubUser });
  } catch (error) { next(error); }
});

// Login — patients sign in with their Patient ID (portal) and password;
// every staff member (doctor, reception, pharmacy, admin) signs in once with
// their email and password via the shared "staff" entry point.
router.post("/login", async (req, res, next) => {
  try {
    const { identifier, mobile, email, password, role = "patient", remember = false } = req.body;
    const lookUp = (email || (role === "patient" ? mobile?.replace(/[\s-]/g, "") : null) || identifier || "").toLowerCase().trim();
    if (!password || !lookUp) return res.status(400).json({ error: "Provide your Patient ID / email and password" });
    const allowedRoles = ["patient", "doctor", "hospital_admin", "admin", "superadmin", "pharmacy", "reception", "staff"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const staffRoles = ["doctor", "hospital_admin", "admin", "pharmacy", "reception"];
    let query;
    if (role === "staff") {
      // A single staff login — everyone who uses an email + password signs in here.
      query = { email: lookUp, role: { $in: staffRoles } };
    } else if (role === "patient") {
      // Patient ID is the primary identifier; mobile/email still work as a fallback.
      query = { role: "patient", $or: [{ mobile: lookUp }, { email: lookUp }, { patientId: lookUp.toUpperCase() }] };
    } else {
      query = { email: lookUp, role };
    }

    const user = await User.findOne(query).select("+passwordHash");
    if (!user) return res.status(401).json({ error: "Invalid credentials for the selected role" });
    if (!(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ error: "Invalid mobile, email or password" });
    }
    if (!user.active) return res.status(403).json({ error: "This account is inactive" });
    if (user.blocked) return res.status(403).json({ error: "This account has been blocked. Contact the administrator." });

    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    logAudit({ actor: user._id, actorRole: user.role, action: "auth.login", entity: "user", entityId: user._id, ip: req.ip });
    const session = await issueSession(user, { remember, userAgent: req.headers["user-agent"], ip: req.ip });
    res.json({ accessToken: session.accessToken, refreshToken: session.refreshToken, remember, user: publicUser(user) });
  } catch (error) { next(error); }
});

// Rotate refresh token -> new access + refresh token (single-use rotation).
router.post("/refresh", async (req, res, next) => {
  try {
    const rawRefresh = (req.body.refreshToken || "").trim();
    if (!rawRefresh) return res.status(401).json({ error: "A refresh token is required" });
    const stored = await rotateRefreshToken(rawRefresh, { userAgent: req.headers["user-agent"], ip: req.ip });
    if (!stored) return res.status(401).json({ error: "Session has expired. Please sign in again." });
    const user = await User.findById(stored.user).lean();
    if (!user || !user.active || user.blocked) return res.status(401).json({ error: "Session is no longer valid" });
    const session = await issueSession(user, { remember: stored.remember, userAgent: req.headers["user-agent"], ip: req.ip });
    logAudit({ actor: user._id, actorRole: user.role, action: "auth.refresh", entity: "user", entityId: user._id });
    res.json({ accessToken: session.accessToken, refreshToken: session.refreshToken, remember: session.remember, user: publicUser(user) });
  } catch (error) { next(error); }
});

// Log out — revoke the supplied refresh token.
router.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) await rotateRefreshToken(refreshToken);
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// Who am I — returns the cached user + a fresh access token if provided.
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id).select(OWNER_FIELDS).lean();
  const payload = { user: publicUser(user || req.user) };
  if (req.accessToken && req.header("x-need-token") === "1") payload.accessToken = req.accessToken;
  res.json(payload);
});

// Only admins create operational staff. Super admins create admin accounts via
// the dedicated /admin/admins endpoint. Hospital admins create staff within
// their own hospital scope — hospitalId is derived from the authenticated user,
// never from the request body.
router.post("/staff", requireAuth, allowRoles("admin", "hospital_admin"), async (req, res, next) => {
  try {
    if (req.user.role === "hospital_admin" && ["admin", "hospital_admin"].includes(req.body.role)) {
      return res.status(403).json({ error: "Hospital admins cannot create admin accounts" });
    }
    const { name, email, password, role, profile = {}, pharmacy } = req.body;
    const allowed = ["doctor", "pharmacy", "reception"];
    if (!allowed.includes(role) || !name || !email || !password || password.length < 8) {
      return res.status(400).json({ error: "Valid staff details are required" });
    }
    const exists = await User.exists({ email: String(email).toLowerCase(), hospitalId: req.user.hospitalId });
    if (exists) return res.status(409).json({ error: "A staff account with this email already exists" });

    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role,
      hospitalId: req.user.hospitalId,
      profile,
      pharmacy: role === "pharmacy" ? profile.pharmacy || {} : undefined,
    });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "staff.create", entity: "user", entityId: user._id, meta: { role } });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

export default router;
