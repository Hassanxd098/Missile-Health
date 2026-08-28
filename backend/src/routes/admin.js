import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { requireAuth, allowRoles, hospitalScope } from "../middleware/authJwt.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Appointment from "../models/Appointment.js";
import Prescription from "../models/Prescription.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";
import Attendance from "../models/Attendance.js";
import { notify } from "../services/notificationService.js";
import { logAudit } from "../services/auditService.js";
import { visitingTextToSlots, defaultAvailability } from "../services/availabilityService.js";
import { generateEmployeeNumber, generateHospitalId } from "../services/idService.js";

const router = Router();
router.use(requireAuth, allowRoles("admin", "hospital_admin"));

const staffFields = "name email mobile role employeeNumber profile pharmacy active blocked createdAt lastLoginAt hospitalId";
const patientFields = "name email mobile patientId profile patient active blocked createdAt hospitalId";
// passwordHash included only to detect which employees hold a live login account.
const employeeFields = "name email mobile role employeeNumber passwordHash profile pharmacy active blocked createdAt hospitalId";

// Hospital employees tracked by the Admin → Staff directory. Pharmacy staff are
// managed on their own dedicated page and are intentionally excluded here.
const EMPLOYEE_CATEGORIES = {
  all: ["doctor", "nurse", "reception", "management", "security", "other", "cleaner"],
  doctor: ["doctor"],
  nurse: ["nurse"],
  reception: ["reception"],
  management: ["management"],
  security: ["security"],
  other: ["other", "cleaner"],
};
const EMPLOYEE_ROLES = EMPLOYEE_CATEGORIES.all;
// Employee types that also hold a usable login account.
const LOGIN_EMPLOYEE_ROLES = ["doctor", "reception"];
// All staff eligible for attendance / unified staff operations.
const staffRoles = ["doctor", "pharmacy", "reception", "nurse", "management", "security", "other", "cleaner"];
const STAFF_TYPE_LABELS = { doctor: "Doctor", nurse: "Nurse", reception: "Reception", management: "Management", security: "Security", other: "Other", cleaner: "Cleaner" };

const dayRange = () => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [start, end];
};
const monthRange = () => {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(end); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
  return [start, end];
};

// Admin / Hospital Admin dashboard: cards + revenue growth + medicine sales + performance.
// All queries are strictly scoped to the authenticated user's hospitalId.
router.get("/home", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const [start, end] = dayRange();
    const [ms, me] = monthRange();
    const [doctors, patients, pharmacy, reception, nurses, management, security, otherStaff, cleaners, appointments, todayAppointments, cancelledToday, pendingBills, invoices, recent, revenue] = await Promise.all([
      User.countDocuments({ ...scope, role: "doctor", active: true }),
      User.countDocuments({ ...scope, role: "patient", active: true }),
      User.countDocuments({ ...scope, role: "pharmacy", active: true }),
      User.countDocuments({ ...scope, role: "reception", active: true }),
      User.countDocuments({ ...scope, role: "nurse", active: true }),
      User.countDocuments({ ...scope, role: "management", active: true }),
      User.countDocuments({ ...scope, role: "security", active: true }),
      User.countDocuments({ ...scope, role: "other", active: true }),
      User.countDocuments({ ...scope, role: "cleaner", active: true }),
      Appointment.countDocuments(scope),
      Appointment.countDocuments({ ...scope, scheduledFor: { $gte: start, $lt: end }, status: { $ne: "cancelled" } }),
      Appointment.countDocuments({ ...scope, scheduledFor: { $gte: start, $lt: end }, status: "cancelled" }),
      Invoice.countDocuments({ ...scope, status: "pending" }),
      Invoice.find({ ...scope, paidAt: { $gte: ms, $lte: me } }).lean(),
      Appointment.find(scope).populate("patient doctor", "name profile.specialty").sort({ createdAt: -1 }).limit(12).lean(),
      Invoice.aggregate([
        { $match: { ...scope, status: "paid", paidAt: { $gte: ms, $lte: me } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } }, total: { $sum: "$total" } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const medicineSales = await Invoice.aggregate([
      { $match: { ...scope, status: "paid", type: "pharmacy" } },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.name", units: { $sum: "$lines.quantity" }, revenue: { $sum: "$lines.amount" } } },
      { $sort: { units: -1 } },
      { $limit: 10 },
    ]);
    const revenueToday = invoices.filter((i) => i.paidAt >= start && i.paidAt < end).reduce((s, i) => s + (i.total || 0), 0);
    const totalRevenue = invoices.reduce((s, i) => s + (i.total || 0), 0);

    res.json({
      counts: {
        doctors, patients, pharmacy, reception, nurses, management, security, otherStaff, cleaners, appointments,
        employees: doctors + nurses + reception + management + security + otherStaff + cleaners + pharmacy,
        todayAppointments, cancelledToday, pendingBills,
      },
      revenueToday,
      totalRevenue,
      charts: { revenue, medicineSales },
      recent,
    });
  } catch (error) { next(error); }
});

// ---------- Doctor management ----------
router.get("/doctors", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const [doctors, total] = await Promise.all([
      User.find({ ...scope, role: "doctor" }).select(staffFields).sort({ createdAt: -1 }).lean(),
      User.countDocuments({ ...scope, role: "doctor" }),
    ]);
    res.json({ doctors, total });
  } catch (error) { next(error); }
});

router.post("/doctors", async (req, res, next) => {
  try {
    const { name, email, password, profile = {}, consultationFee, availableToday = true } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ error: "Name, email, and an 8-character password are required" });
    }
    const exists = await User.exists({ email: String(email).toLowerCase(), hospitalId: req.user.hospitalId });
    if (exists) return res.status(409).json({ error: "A doctor with this email already exists" });

    const createdProfile = {
      ...profile,
      specialty: profile.specialty || "",
      location: profile.location || "",
      visitingHours: profile.visitingHours || "",
      consultationFee: Number(consultationFee) || 0,
      availableToday: Boolean(availableToday),
    };
    if (!(createdProfile.availability && createdProfile.availability.length)) {
      createdProfile.availability = createdProfile.visitingHours
        ? visitingTextToSlots(createdProfile.visitingHours)
        : defaultAvailability();
    }
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: "doctor",
      hospitalId: req.user.hospitalId,
      profile: createdProfile,
    });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "doctor.create", entity: "user", entityId: user._id, meta: { hospitalId: req.user.hospitalId } });
    res.status(201).json({ user: { _id: user._id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});

router.patch("/doctors/:id", async (req, res, next) => {
  try {
    const allowedProfile = ["specialty", "qualification", "location", "visitingHours", "consultationFee", "opdCharges", "availableToday", "experienceYears"];
    const { profile, ...rest } = req.body || {};
    const set = {};
    // Never allow the frontend to change hospitalId.
    set.hospitalId = req.user.hospitalId;
    if (rest.name !== undefined) set.name = rest.name;
    if (rest.active !== undefined) set.active = rest.active;
    if (profile && typeof profile === "object") {
      for (const [k, v] of Object.entries(profile)) if (allowedProfileIncludes(k)) set[`profile.${k}`] = v;
    }
    if (set["profile.visitingHours"] !== undefined && set["profile.availability"] === undefined && set["profile.visitingHours"]) {
      set["profile.availability"] = visitingTextToSlots(set["profile.visitingHours"]);
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "doctor", hospitalId: req.user.hospitalId },
      { $set: set },
      { new: true },
    ).select(staffFields).lean();
    if (!user) return res.status(404).json({ error: "Doctor not found" });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "doctor.update", entity: "user", entityId: user._id, meta: set });
    res.json({ user });
  } catch (error) { next(error); }
});
const allowedProfileIncludes = (k) => ["specialty", "qualification", "location", "visitingHours", "consultationFee", "opdCharges", "availableToday", "experienceYears"].includes(k);

router.post("/doctors/:id/reset-password", async (req, res, next) => {
  try {
    const password = req.body.password;
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: ["doctor", "pharmacy"] }, hospitalId: req.user.hospitalId },
      { $set: { passwordHash: await bcrypt.hash(password, 12) } },
      { new: true },
    ).select("_id name role");
    if (!user) return res.status(404).json({ error: "Staff account not found" });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "staff.reset-password", entity: "user", entityId: user._id });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// ---------- Patient management ----------
router.get("/patients", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const { search = "", page = 1, limit = 25 } = req.query;
    const query = { ...scope, role: "patient" };
    if (search) {
      query.$or = [{ name: new RegExp(search, "i") }, { patientId: new RegExp(search, "i") }, { mobile: new RegExp(search, "i") }, { email: new RegExp(search, "i") }];
    }
    const total = await User.countDocuments(query);
    const patients = await User.find(query).select(patientFields).sort({ createdAt: -1 }).skip((Math.max(Number(page), 1) - 1) * Number(limit)).limit(Number(limit)).lean();
    res.json({ patients, total, page: Number(page) });
  } catch (error) { next(error); }
});

router.patch("/patients/:id/status", async (req, res, next) => {
  try {
    const { active, blocked } = req.body;
    const set = {};
    if (typeof active === "boolean") set.active = active;
    if (typeof blocked === "boolean") set.blocked = blocked;
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "patient", hospitalId: req.user.hospitalId },
      { $set: set },
      { new: true },
    ).select(patientFields).lean();
    if (!user) return res.status(404).json({ error: "Patient not found" });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "patient.status", entity: "user", entityId: user._id, meta: { ...set, hospitalId: req.user.hospitalId } });
    res.json({ user });
  } catch (error) { next(error); }
});

// ---------- Pharmacy staff management ----------
router.get("/pharmacy", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const pharmacy = await User.find({ ...scope, role: "pharmacy" }).select(staffFields).sort({ createdAt: -1 }).lean();
    res.json({ pharmacy });
  } catch (error) { next(error); }
});

router.post("/pharmacy", async (req, res, next) => {
  try {
    const { name, email, password, storeName = "" } = req.body;
    if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: "Name, email, and an 8-character password are required" });
    const exists = await User.exists({ email: String(email).toLowerCase(), hospitalId: req.user.hospitalId });
    if (exists) return res.status(409).json({ error: "A pharmacy account with this email already exists" });
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: "pharmacy",
      hospitalId: req.user.hospitalId,
      pharmacy: { storeName },
    });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "pharmacy.create", entity: "user", entityId: user._id, meta: { hospitalId: req.user.hospitalId } });
    res.status(201).json({ user: { _id: user._id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});

router.patch("/pharmacy/:id", async (req, res, next) => {
  try {
    const set = {};
    if (req.body.name) set.name = req.body.name;
    if (req.body.active !== undefined) set.active = Boolean(req.body.active);
    if (req.body.storeName) set["pharmacy.storeName"] = req.body.storeName;
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "pharmacy", hospitalId: req.user.hospitalId },
      { $set: set },
      { new: true },
    ).select(staffFields).lean();
    if (!user) return res.status(404).json({ error: "Pharmacy account not found" });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "pharmacy.update", entity: "user", entityId: user._id, meta: set });
    res.json({ user });
  } catch (error) { next(error); }
});

// ---------- Unified staff management (doctors, pharmacy, reception + employees) ----------
router.get("/staff-groups", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const [doctors, pharmacy, reception, nurses, management, security, other, cleaners] = await Promise.all([
      User.find({ ...scope, role: "doctor" }).select(staffFields).sort({ name: 1 }).lean(),
      User.find({ ...scope, role: "pharmacy" }).select(staffFields).sort({ name: 1 }).lean(),
      User.find({ ...scope, role: "reception" }).select(staffFields).sort({ name: 1 }).lean(),
      User.find({ ...scope, role: "nurse" }).select(staffFields).sort({ name: 1 }).lean(),
      User.find({ ...scope, role: "management" }).select(staffFields).sort({ name: 1 }).lean(),
      User.find({ ...scope, role: "security" }).select(staffFields).sort({ name: 1 }).lean(),
      User.find({ ...scope, role: "other" }).select(staffFields).sort({ name: 1 }).lean(),
      User.find({ ...scope, role: "cleaner" }).select(staffFields).sort({ name: 1 }).lean(),
    ]);
    res.json({ groups: { doctors, pharmacy, reception, nurses, management, security, other, cleaners } });
  } catch (error) { next(error); }
});

// ---------- Hospital Network & Branch Directory ----------
router.get("/my-branches", async (req, res, next) => {
  try {
    let parentId = req.user.hospitalId;
    if (!parentId) {
      const parentDoc = (await Hospital.findOne({ admin: req.user._id, isBranch: false })) || (await Hospital.findOne({ admin: req.user._id }));
      if (parentDoc) parentId = parentDoc._id;
    }

    const branches = await Hospital.find({
      $or: [
        ...(parentId ? [{ _id: parentId }, { parentHospital: parentId }] : []),
        { admin: req.user._id },
        { requestedBy: req.user._id },
      ],
      status: "active",
    }).select("name code city isBranch parentHospital").sort({ isBranch: 1, name: 1 }).lean();

    res.json({ branches, mainHospitalId: parentId });
  } catch (error) {
    next(error);
  }
});

// ---------- Employee directory (Admin → Staff / Employees) ----------
// Shapes a User record into a uniform employee payload for the staff directory.
const employeeJson = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  mobile: u.mobile,
  role: u.role,
  staffType: u.role,
  staffTypeLabel: STAFF_TYPE_LABELS[u.role] || u.role,
  employeeNumber: u.employeeNumber || null,
  hospitalId: u.hospitalId || null,
  isLogin: LOGIN_EMPLOYEE_ROLES.includes(u.role) && !!u.passwordHash,
  photo: u.profile?.profilePhoto || "",
  designation: u.profile?.designation || "",
  department: u.profile?.department || "",
  phone: u.profile?.phone || u.mobile || "",
  gender: u.profile?.gender || "",
  address: u.profile?.address || "",
  joinDate: u.profile?.joinDate ? new Date(u.profile.joinDate).toISOString().slice(0, 10) : null,
  salary: u.profile?.salary || 0,
  specialty: u.profile?.specialty || "",
  location: u.profile?.location || "",
  visitingHours: u.profile?.visitingHours || "",
  consultationFee: u.profile?.consultationFee || 0,
  qualification: u.profile?.qualification || "",
  active: u.active !== false,
  blocked: !!u.blocked,
  createdAt: u.createdAt,
});

// Guarantee every staff record carries an employee number (auto-assigns any
// that predate the field), so the directory is always complete.
async function ensureEmployeeNumbers(scope) {
  const missing = await User.find({ ...scope, role: { $in: EMPLOYEE_ROLES }, employeeNumber: { $exists: false } }).select("_id role").lean();
  for (const u of missing) {
    const employeeNumber = await generateEmployeeNumber(scope.hospitalId, u.role);
    await User.updateOne({ _id: u._id }, { $set: { employeeNumber } });
  }
}

// List employees with category / search / status / hospital branch filters.
router.get("/employees", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    await ensureEmployeeNumbers(scope);
    const { type = "all", q = "", status = "all", hospitalId, page = 1, limit = 100 } = req.query;
    const roles = EMPLOYEE_CATEGORIES[type] || EMPLOYEE_CATEGORIES.all;
    const query = { ...scope, role: { $in: roles } };

    if (hospitalId && hospitalId !== "all" && mongoose.Types.ObjectId.isValid(hospitalId)) {
      query.hospitalId = hospitalId;
    }

    if (status === "active") query.active = true;
    if (status === "inactive") query.active = { $ne: true };
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: rx }, { employeeNumber: rx }, { mobile: rx }, { email: rx }, { "profile.designation": rx }, { "profile.department": rx }];
    }
    const [employees, total] = await Promise.all([
      User.find(query).select(employeeFields).populate("hospitalId", "name code city isBranch").sort({ name: 1 }).skip((Math.max(Number(page), 1) - 1) * Number(limit)).limit(Number(limit)).lean(),
      User.countDocuments(query),
    ]);
    res.json({ employees: employees.map(employeeJson), total, type, page: Number(page) });
  } catch (error) { next(error); }
});

function employeeProfileFrom(body) {
  const salary = Number(body.salary);
  const isDoctor = body.staffType === "doctor" || body.role === "doctor";
  return {
    designation: isDoctor ? "" : String(body.designation || "").trim(),
    department: String(body.department || "").trim(),
    phone: String(body.phone || "").trim(),
    gender: String(body.gender || "").trim(),
    address: String(body.address || "").trim(),
    salary: Number.isFinite(salary) && salary > 0 ? salary : 0,
    profilePhoto: String(body.profilePhoto || "").trim(),
    joinDate: body.joinDate ? new Date(body.joinDate) : undefined,
    // Doctor-specific fields (kept even for other roles so the form round-trips).
    specialty: String(body.specialty || "").trim(),
    location: String(body.location || "").trim(),
    visitingHours: String(body.visitingHours || "").trim(),
    qualification: String(body.qualification || "").trim(),
    consultationFee: Math.max(Number(body.consultationFee) || 0, 0),
  };
}

function isUniqueMongoError(e) {
  return e && e.code === 11000;
}

// Verify an employee number is free within the hospital (excluding self on edit).
async function assertEmployeeNumberFree(hospitalId, employeeNumber, excludeId) {
  const normalized = String(employeeNumber || "").toUpperCase().trim();
  if (!normalized) return normalized;
  const clash = await User.exists({ hospitalId, employeeNumber: normalized, _id: { $ne: excludeId } });
  if (clash) {
    const error = new Error("That employee number is already in use. Employee numbers must be unique.");
    error.status = 409;
    throw error;
  }
  return normalized;
}

// Add an employee. Doctor & Reception get a login account; all other employee
// types are directory-only records (no login).
router.post("/employees", async (req, res, next) => {
  try {
    const { name, staffType, employeeNumber, email, password, hospitalId: bodyHospitalId } = req.body;
    if (!name || !EMPLOYEE_CATEGORIES.all.includes(staffType)) {
      return res.status(400).json({ error: "Employee name and a valid staff type are required" });
    }

    let targetHospitalId = bodyHospitalId || req.user.hospitalId;
    if (targetHospitalId && String(targetHospitalId) !== String(req.user.hospitalId) && mongoose.Types.ObjectId.isValid(targetHospitalId)) {
      const isAuthorized = await Hospital.exists({
        _id: targetHospitalId,
        $or: [
          { _id: req.user.hospitalId },
          { parentHospital: req.user.hospitalId },
          { admin: req.user._id },
        ],
      });
      if (!isAuthorized && req.user.role !== "superadmin") {
        targetHospitalId = req.user.hospitalId;
      }
    }

    if (LOGIN_EMPLOYEE_ROLES.includes(staffType)) {
      if (!email || !password || password.length < 8) {
        return res.status(400).json({ error: `${STAFF_TYPE_LABELS[staffType]} employees need an email and an 8-character password so they can log in` });
      }
    }
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalized = await assertEmployeeNumberFree(targetHospitalId, employeeNumber);
    const finalNumber = normalized || await generateEmployeeNumber(targetHospitalId, staffType);
    // Directory-only records may skip email; derive a hospital-scoped placeholder
    // so the global email unique index is never violated while staying unique.
    const placeholderEmail = normalizedEmail || `staff.${finalNumber.toLowerCase()}@${targetHospitalId}.local`;
    if (await User.exists({ email: placeholderEmail })) {
      const error = new Error(normalizedEmail ? "An employee with this email already exists" : "Could not assign a unique email. Please set one manually.");
      error.status = 409;
      throw error;
    }
    const profile = employeeProfileFrom(req.body);
    if (staffType === "doctor" && !(profile.availability && profile.availability.length)) {
      profile.availability = profile.visitingHours ? visitingTextToSlots(profile.visitingHours) : defaultAvailability();
    }
    const user = await User.create({
      name: String(name).trim(),
      email: placeholderEmail,
      mobile: String(req.body.phone || "").trim(),
      passwordHash: await bcrypt.hash(password || `emp-${Date.now()}-secret`, 12),
      role: staffType,
      employeeNumber: finalNumber,
      hospitalId: targetHospitalId,
      profile,
    });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "employee.create", entity: "user", entityId: user._id, meta: { staffType, employeeNumber: finalNumber, hospitalId: targetHospitalId } });
    res.status(201).json({ employee: employeeJson(await User.findById(user._id).select(employeeFields).populate("hospitalId", "name code city isBranch").lean()) });
  } catch (error) {
    if (isUniqueMongoError(error)) return res.status(409).json({ error: "A record with that employee number or email already exists" });
    res.status(error.status || 500).json({ error: error.message || "Could not add employee" });
  }
});

// Edit an employee (name, number, profile, status, optional login password).
router.patch("/employees/:id", async (req, res, next) => {
  try {
    const user0 = await User.findOne({ _id: req.params.id, role: { $in: EMPLOYEE_ROLES }, hospitalId: req.user.hospitalId });
    if (!user0) return res.status(404).json({ error: "Employee not found" });
    const body = req.body || {};
    const set = {};
    if (typeof body.name === "string" && body.name.trim()) set.name = body.name.trim();
    if (typeof body.active === "boolean") set.active = body.active;
    if (typeof body.blocked === "boolean") set.blocked = body.blocked;
    if (typeof body.employeeNumber === "string" && body.employeeNumber.trim() && body.employeeNumber.trim() !== (user0.employeeNumber || "")) {
      set.employeeNumber = await assertEmployeeNumberFree(req.user.hospitalId, body.employeeNumber, user0._id);
    }
    if (typeof body.email === "string" && body.email.trim() && body.email.toLowerCase().trim() !== user0.email) {
      const clash = await User.exists({ email: body.email.toLowerCase().trim(), _id: { $ne: user0._id } });
      if (clash) return res.status(409).json({ error: "An employee with this email already exists" });
      set.email = body.email.toLowerCase().trim();
    }
    const p = employeeProfileFrom(body);
    for (const key of ["designation", "department", "phone", "gender", "address", "salary", "profilePhoto", "joinDate", "specialty", "location", "visitingHours", "qualification", "consultationFee"]) {
      if (body[key] !== undefined && body[key] !== "") set[`profile.${key}`] = p[key];
    }
    if (set["profile.visitingHours"] !== undefined && set["profile.availability"] === undefined && set["profile.visitingHours"]) {
      set["profile.availability"] = visitingTextToSlots(set["profile.visitingHours"]);
    }
    if (typeof body.password === "string" && body.password.length >= 8) {
      set.passwordHash = await bcrypt.hash(body.password, 12);
    }
    const user = await User.findOneAndUpdate({ _id: user0._id, hospitalId: req.user.hospitalId }, { $set: set }, { new: true }).select(employeeFields).lean();
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "employee.update", entity: "user", entityId: user._id, meta: { keys: Object.keys(set) } });
    res.json({ employee: employeeJson(user) });
  } catch (error) {
    if (isUniqueMongoError(error)) return res.status(409).json({ error: "A record with that employee number or email already exists" });
    res.status(error.status || 500).json({ error: error.message || "Could not update employee" });
  }
});

// Delete an employee record (admin only — enforced at the router level).
router.delete("/employees/:id", async (req, res, next) => {
  try {
    const user0 = await User.findOne({ _id: req.params.id, role: { $in: EMPLOYEE_ROLES }, hospitalId: req.user.hospitalId });
    if (!user0) return res.status(404).json({ error: "Employee not found" });
    await Attendance.deleteMany({ hospitalId: req.user.hospitalId, user: user0._id });
    await User.deleteOne({ _id: user0._id });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "employee.delete", entity: "user", entityId: user0._id, meta: { name: user0.name, employeeNumber: user0.employeeNumber } });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/staff", async (req, res, next) => {
  try {
    const { name, email, password, role, profile = {}, pharmacy, salary = 0, designation = "" } = req.body;
    const accountRoles = ["doctor", "pharmacy", "reception"];
    if (!accountRoles.includes(role) || !name || !email || !password || password.length < 8) {
      return res.status(400).json({ error: "Valid staff details are required" });
    }
    const exists = await User.exists({ email: String(email).toLowerCase(), hospitalId: req.user.hospitalId });
    if (exists) return res.status(409).json({ error: "A staff account with this email already exists" });
    const base = { ...profile };
    if (salary) base.salary = Number(salary) || 0;
    if (designation) base.designation = designation;
    if (role === "doctor" && !(base.availability && base.availability.length)) {
      base.availability = base.visitingHours ? visitingTextToSlots(base.visitingHours) : defaultAvailability();
    }
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role,
      hospitalId: req.user.hospitalId,
      profile: base,
      pharmacy: role === "pharmacy" ? pharmacy || {} : undefined,
    });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "staff.create", entity: "user", entityId: user._id, meta: { role, hospitalId: req.user.hospitalId } });
    res.status(201).json({ user: { _id: user._id, name: user.name, email: user.email, role } });
  } catch (error) { next(error); }
});

router.patch("/staff/:id", async (req, res, next) => {
  try {
    const { name, active, profile = {}, pharmacy = {} } = req.body || {};
    const user0 = await User.findOne({ _id: req.params.id, role: { $in: staffRoles }, hospitalId: req.user.hospitalId });
    if (!user0) return res.status(404).json({ error: "Staff member not found" });
    const set = {};
    if (name) set.name = name;
    if (typeof active === "boolean") set.active = active;
    for (const key of ["salary", "designation", "specialty", "visitingHours", "location", "consultationFee"]) {
      if (profile[key] !== undefined) set[`profile.${key}`] = profile[key];
    }
    if (profile.availability !== undefined) set["profile.availability"] = profile.availability;
    if (profile.visitingHours !== undefined && profile.availability === undefined && profile.visitingHours) {
      set["profile.availability"] = visitingTextToSlots(profile.visitingHours);
    }
    if (user0.role === "pharmacy" && pharmacy.storeName) set["pharmacy.storeName"] = pharmacy.storeName;
    const user = await User.findOneAndUpdate(
      { _id: user0._id, hospitalId: req.user.hospitalId },
      { $set: set },
      { new: true },
    ).select(staffFields).lean();
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "staff.update", entity: "user", entityId: user._id, meta: set });
    res.json({ user });
  } catch (error) { next(error); }
});

router.post("/staff/:id/reset-password", async (req, res, next) => {
  try {
    const password = req.body.password;
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: staffRoles, hospitalId: req.user.hospitalId },
      { $set: { passwordHash: await bcrypt.hash(password, 12) } },
      { new: true },
    ).select("_id name role");
    if (!user) return res.status(404).json({ error: "Staff account not found" });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "staff.reset-password", entity: "user", entityId: user._id });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// ---------- Attendance ----------
const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

router.put("/attendance", async (req, res, next) => {
  try {
    const { userId, date, status = "present", checkIn = "", checkOut = "", source = "reception" } = req.body;
    const target = await User.findOne({ _id: userId, role: { $in: staffRoles }, hospitalId: req.user.hospitalId });
    if (!target) return res.status(404).json({ error: "Staff member not found" });
    const record = await Attendance.findOneAndUpdate(
      { user: target._id, hospitalId: req.user.hospitalId, date: date || dayStr() },
      { $set: { user: target._id, hospitalId: req.user.hospitalId, date: date || dayStr(), status, checkIn, checkOut, source, recordedBy: req.user._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "attendance.update", entity: "user", entityId: target._id, meta: { date, status, hospitalId: req.user.hospitalId } });
    res.json({ record });
  } catch (error) { next(error); }
});

router.get("/attendance", async (req, res, next) => {
  try {
    const { date, month } = req.query;
    const prefix = month || date || dayStr();
    const scope = hospitalScope(req.user);
    const records = await Attendance.find({ ...scope, date: new RegExp(`^${prefix.replace(/-/g, "-")}`) })
      .populate("user", "name role profile.designation profile.salary profile.specialty pharmacy.storeName")
      .sort({ date: 1, "user.name": 1 })
      .lean();
    const users = await User.find({ ...scope, role: { $in: staffRoles } }).select("name role profile.specialty profile.designation profile.salary pharmacy.storeName active").sort({ name: 1 }).lean();
    const byUser = {};
    records.forEach((r) => {
      (byUser[r.user?._id?.toString?.() || String(r.user)] = byUser[r.user?._id?.toString?.() || String(r.user)] || []).push(r);
    });
    const rollup = users.map((u) => {
      const list = byUser[u._id.toString()] || [];
      return { user: u, records: list, presentDays: list.filter((r) => r.status === "present").length, totalDays: list.length };
    });
    res.json({ date: prefix, records, rollup });
  } catch (error) { next(error); }
});

// ---------- Appointments management ----------
router.get("/appointments", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const { status = "all", page = 1, limit = 25 } = req.query;
    const query = { ...scope };
    if (status && status !== "all") query.status = status;
    const total = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
      .populate("patient", "name patientId mobile")
      .populate("doctor", "name profile.specialty")
      .sort({ createdAt: -1 })
      .skip((Math.max(Number(page), 1) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    res.json({ appointments, total, page: Number(page) });
  } catch (error) { next(error); }
});

router.patch("/appointments/:id", async (req, res, next) => {
  try {
    const { status, scheduledFor } = req.body;
    const set = { hospitalId: req.user.hospitalId };
    if (["confirmed", "cancelled"].includes(status)) { set.status = status; set.cancelledBy = status === "cancelled" ? "admin" : null; }
    if (scheduledFor) { set.scheduledFor = new Date(scheduledFor); set.status = "confirmed"; }
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, hospitalId: req.user.hospitalId },
      { $set: set },
      { new: true },
    ).populate("patient doctor", "name").lean();
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    const pid = appointment.patient?._id?.toString?.() || appointment.patient?.toString?.();
    if (set.status === "confirmed" && pid) await notify(pid, { title: "Appointment confirmed", body: "Your appointment has been approved.", type: "appointment" });
    if (set.status === "cancelled" && pid) await notify(pid, { title: "Appointment cancelled", body: "Your appointment was cancelled by the hospital.", type: "appointment" });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "appointment.update", entity: "appointment", entityId: appointment._id, meta: set });
    res.json({ appointment });
  } catch (error) { next(error); }
});

// ---------- Reports (scoped) ----------
router.get("/reports", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const { from, to } = req.query;
    const start = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = to ? new Date(to) : new Date(Date.now() + 86400000);
    end.setHours(23, 59, 59, 999);

    const [patientGrowth, appointments, prescriptions, revenueByType, topDoctors, payments] = await Promise.all([
      User.aggregate([{ $match: { ...scope, role: "patient" } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Appointment.countDocuments({ ...scope, createdAt: { $gte: start, $lte: end } }),
      Prescription.countDocuments({ ...scope, createdAt: { $gte: start, $lte: end } }),
      Invoice.aggregate([{ $match: { ...scope, status: "paid", paidAt: { $gte: start, $lte: end } } }, { $group: { _id: "$type", total: { $sum: "$total" }, count: { $sum: 1 } } }]),
      Invoice.aggregate([
        { $match: { ...scope, status: "paid", paidAt: { $gte: start, $lte: end }, doctor: { $ne: null } } },
        { $group: { _id: "$doctor", revenue: { $sum: "$total" }, visits: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
      Invoice.aggregate([{ $match: { ...scope, paidAt: { $gte: start, $lte: end } } }, { $group: { _id: "$status", total: { $sum: "$total" }, count: { $sum: 1 } } }]),
    ]);
    const doctorNames = await User.find({ ...scope, _id: { $in: topDoctors.map((d) => d._id) } }).select("name").lean();
    const nameById = new Map(doctorNames.map((d) => [d._id.toString(), d.name]));
    const totalRevenue = revenueByType.reduce((s, r) => s + r.total, 0);

    const revenueReport = { revenueByType, totalRevenue, topDoctors: topDoctors.map((d) => ({ ...d, doctorName: nameById.get(d._id.toString()) || "Unknown" })), payments, from: start, to: end };
    if (req.user.role === "superadmin") return res.json(revenueReport);
    res.json({ patientGrowth, appointments, prescriptions, ...revenueReport });
  } catch (error) { next(error); }
});

// ---------- Hospital Branch Requests (Hospital Admin) ----------
router.post("/branch-requests", async (req, res, next) => {
  try {
    const { name, code, email, phone, address, city, state, country } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, error: "Branch name and branch code are required", message: "Branch name and branch code are required" });
    }

    const normalizedCode = String(code).toUpperCase().trim();
    const exists = await Hospital.exists({ code: normalizedCode });
    if (exists) {
      return res.status(409).json({ success: false, error: `A hospital or branch with code '${normalizedCode}' already exists`, message: `A hospital or branch with code '${normalizedCode}' already exists` });
    }

    let parentHospitalId = req.user.hospitalId;
    if (!parentHospitalId) {
      const parentDoc = (await Hospital.findOne({ admin: req.user._id, isBranch: false })) || (await Hospital.findOne({ admin: req.user._id }));
      if (parentDoc) parentHospitalId = parentDoc._id;
    }

    const hospitalId = await generateHospitalId(normalizedCode);

    const branchData = {
      hospitalId,
      code: normalizedCode,
      name: String(name).trim(),
      email: email ? String(email).trim() : "",
      phone: phone ? String(phone).trim() : "",
      address: address ? String(address).trim() : "",
      city: city ? String(city).trim() : "",
      state: state ? String(state).trim() : "",
      country: country ? String(country).trim() : "",
      status: "inactive",
      admin: req.user._id,
      isBranch: true,
      approvalStatus: "pending",
      requestedBy: req.user._id,
    };

    if (parentHospitalId && mongoose.Types.ObjectId.isValid(parentHospitalId)) {
      branchData.parentHospital = parentHospitalId;
    }

    const branch = await Hospital.create(branchData);

    try {
      logAudit({
        actor: req.user._id,
        actorRole: req.user.role || "hospital_admin",
        action: "hospital_branch.request",
        entity: "hospital",
        entityId: branch._id,
        meta: { name: branch.name, code: branch.code, parentHospital: parentHospitalId },
      });
    } catch {
      /* audit non-blocking */
    }

    res.status(201).json({ success: true, branchRequest: branch, branch });
  } catch (error) {
    next(error);
  }
});

router.get("/branch-requests", async (req, res, next) => {
  try {
    let parentHospitalId = req.user.hospitalId;
    if (!parentHospitalId) {
      const parentDoc = (await Hospital.findOne({ admin: req.user._id, isBranch: false })) || (await Hospital.findOne({ admin: req.user._id }));
      if (parentDoc) parentHospitalId = parentDoc._id;
    }

    const query = {
      $or: [
        ...(parentHospitalId ? [{ parentHospital: parentHospitalId }] : []),
        { admin: req.user._id },
        { requestedBy: req.user._id },
      ],
      isBranch: true,
    };

    const branches = await Hospital.find(query)
      .populate("parentHospital", "name code city")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ branchRequests: branches });
  } catch (error) {
    next(error);
  }
});

export default router;
