import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireAuth, allowRoles, requireSuperAdmin } from "../middleware/authJwt.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import Invoice from "../models/Invoice.js";
import { generateHospitalId } from "../services/idService.js";
import { notify } from "../services/notificationService.js";
import { logAudit } from "../services/auditService.js";
import { publicUser, issueSession } from "../services/tokenService.js";

const router = Router();

// Super Admin authentication — separate from hospital staff login.
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });

    const user = await User.findOne({ email: String(email).toLowerCase(), role: "superadmin" }).select("+passwordHash");
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    if (!user.active) return res.status(403).json({ success: false, message: "Account is inactive" });

    const { issueSession } = await import("../services/tokenService.js");
    const session = await issueSession(user, {
      remember: false,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    logAudit({ actor: user._id, actorRole: "superadmin", action: "superadmin.login", entity: "user", entityId: user._id, ip: req.ip });
    res.json({ accessToken: session.accessToken, refreshToken: session.refreshToken, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

// All hospital-management routes require Super Admin.
router.use(requireAuth, requireSuperAdmin());

// List hospitals with filtering, search, and statistics.
router.get("/hospitals", async (req, res, next) => {
  try {
    const { status, search = "", page = 1, limit = 25 } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;
    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { hospitalId: new RegExp(search, "i") },
        { code: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
        { city: new RegExp(search, "i") },
        { state: new RegExp(search, "i") },
      ];
    }

    const total = await Hospital.countDocuments(query);
    const hospitals = await Hospital.find(query)
      .populate("admin", "name email")
      .sort({ createdAt: -1 })
      .skip((Math.max(Number(page), 1) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    // Gather per-hospital statistics in parallel.
    const stats = await Promise.all(
      hospitals.map(async (h) => {
        const [doctors, patients, appointments, pharmacies] = await Promise.all([
          User.countDocuments({ hospitalId: h._id, role: "doctor" }),
          User.countDocuments({ hospitalId: h._id, role: "patient" }),
          Promise.resolve(0), // appointments model import would be heavy here; computed in detail instead
          User.countDocuments({ hospitalId: h._id, role: "pharmacy" }),
        ]);
        return { hospitalId: h._id, doctors, patients, pharmacies };
      }),
    );
    const byHospital = new Map(stats.map((s) => [String(s.hospitalId), s]));

    res.json({
      hospitals: hospitals.map((h) => ({
        ...h,
        stats: byHospital.get(String(h._id)) || { doctors: 0, patients: 0, appointments: 0, pharmacies: 0 },
      })),
      total,
      page: Number(page),
    });
  } catch (error) {
    next(error);
  }
});

// Create a new hospital + its Hospital Admin account.
router.post("/hospitals", async (req, res, next) => {
  try {
    const {
      name, code, email, phone, address, city, state, country, status,
      adminName, adminEmail, adminMobile, adminPassword,
    } = req.body;

    if (!name || !code || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ success: false, message: "Hospital name, code, admin name, email, and password are required" });
    }
    if (adminPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Admin password must be at least 8 characters" });
    }

    const normalizedCode = String(code).toUpperCase().trim();
    const exists = await Hospital.exists({ $or: [{ hospitalId: { $regex: `^${normalizedCode}-`, $options: "i" } }, { code: normalizedCode }] });
    if (exists) return res.status(409).json({ success: false, message: "A hospital with this code already exists" });

    const adminExists = await User.exists({ email: String(adminEmail).toLowerCase() });
    if (adminExists) return res.status(409).json({ success: false, message: "An admin account with this email already exists" });

    // Generate unique hospitalId: CODE-TIMESTAMP-SEQUENCE
    const hospitalId = await generateHospitalId(normalizedCode);

    const session = await User.startSession();
    session.startTransaction();
    try {
      const hospital = await Hospital.create(
        [{
          hospitalId,
          code: normalizedCode,
          name, email, phone, address, city, state, country, status: status || "active",
          admin: null, // filled below
        }],
        { session },
      ).then((r) => r[0]);

      const adminUser = await User.create(
        [{
          name: adminName,
          email: String(adminEmail).toLowerCase(),
          mobile: adminMobile || "",
          passwordHash: await bcrypt.hash(adminPassword, 12),
          role: "hospital_admin",
          hospitalId: hospital._id,
        }],
        { session },
      ).then((r) => r[0]);

      hospital.admin = adminUser._id;
      await hospital.save({ session });

      await session.commitTransaction();
      session.endSession();

      logAudit({
        actor: req.user._id,
        actorRole: "superadmin",
        action: "hospital.create",
        entity: "hospital",
        entityId: hospital._id,
        meta: { hospitalId, adminEmail: String(adminEmail).toLowerCase() },
      });

      res.status(201).json({
        hospital: {
          _id: hospital._id,
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          code: hospital.code,
          status: hospital.status,
          admin: { _id: adminUser._id, name: adminUser.name, email: adminUser.email },
        },
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// View / manage a specific hospital.
router.get("/hospitals/:id", async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id).populate("admin", "name email mobile lastLoginAt").lean();
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    const [doctors, patients, pharmacies, receptionists, cleaners, appointments] = await Promise.all([
      User.countDocuments({ hospitalId: hospital._id, role: "doctor" }),
      User.countDocuments({ hospitalId: hospital._id, role: "patient" }),
      User.countDocuments({ hospitalId: hospital._id, role: "pharmacy" }),
      User.countDocuments({ hospitalId: hospital._id, role: "reception" }),
      User.countDocuments({ hospitalId: hospital._id, role: "cleaner" }),
      Appointment.countDocuments({ hospitalId: hospital._id }),
    ]);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

    const [todayAppointments, pendingBills] = await Promise.all([
      Appointment.countDocuments({ hospitalId: hospital._id, scheduledFor: { $gte: todayStart, $lt: todayEnd }, status: { $ne: "cancelled" } }),
      Invoice.countDocuments({ hospitalId: hospital._id, status: "pending" }),
    ]);

    res.json({
      hospital,
      stats: { doctors, patients, pharmacies, receptionists, cleaners, appointments, todayAppointments, pendingBills },
      createdBy: req.user.name,
    });
  } catch (error) {
    next(error);
  }
});

// Update hospital profile.
router.patch("/hospitals/:id", async (req, res, next) => {
  try {
    const { name, email, phone, address, city, state, country, status } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (email !== undefined) set.email = String(email).toLowerCase();
    if (phone !== undefined) set.phone = phone;
    if (address !== undefined) set.address = address;
    if (city !== undefined) set.city = city;
    if (state !== undefined) set.state = state;
    if (country !== undefined) set.country = country;
    if (status !== undefined && ["active", "inactive"].includes(status)) set.status = status;

    const hospital = await Hospital.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    logAudit({ actor: req.user._id, actorRole: "superadmin", action: "hospital.update", entity: "hospital", entityId: hospital._id, meta: set });
    res.json({ hospital });
  } catch (error) {
    next(error);
  }
});

// Toggle hospital active/inactive.
router.patch("/hospitals/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const hospital = await Hospital.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    // Cascade deactivation to hospital users.
    if (status === "inactive") {
      await User.updateMany({ hospitalId: hospital._id, role: { $in: ["hospital_admin", "doctor", "pharmacy", "reception", "cleaner", "patient"] } }, { $set: { active: false } });
    }

    logAudit({ actor: req.user._id, actorRole: "superadmin", action: "hospital.status", entity: "hospital", entityId: hospital._id, meta: { status } });
    res.json({ hospital });
  } catch (error) {
    next(error);
  }
});

// Reset / create the Hospital Admin account for a hospital.
router.post("/hospitals/:id/admin", async (req, res, next) => {
  try {
    const { name, email, password, mobile } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ success: false, message: "Name, email, and an 8-character password are required" });
    }

    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    const emailLower = String(email).toLowerCase();

    // If an admin already exists for this hospital, reset it; otherwise create.
    let admin = await User.findOne({ email: emailLower, hospitalId: hospital._id, role: "hospital_admin" });
    if (!admin) {
      // Allow reassignment of an existing email that belongs to another hospital —
      // the super admin may be fixing up an admin account.
      const global = await User.findOne({ email: emailLower });
      if (global) {
        return res.status(409).json({ success: false, message: "This email is already used by another account" });
      }
      admin = await User.create({
        name, email: emailLower, mobile,
        passwordHash: await bcrypt.hash(password, 12),
        role: "hospital_admin", hospitalId: hospital._id,
      });
    } else {
      admin.passwordHash = await bcrypt.hash(password, 12);
      admin.name = name;
      admin.mobile = mobile || admin.mobile;
      admin.active = true;
      admin.blocked = false;
      await admin.save();
    }

    hospital.admin = admin._id;
    await hospital.save();

    logAudit({ actor: req.user._id, actorRole: "superadmin", action: "hospital.admin.create", entity: "user", entityId: admin._id, meta: { hospitalId: hospital.hospitalId } });
    res.status(201).json({ admin: { _id: admin._id, name: admin.name, email: admin.email, mobile: admin.mobile, role: admin.role, hospitalId: admin.hospitalId } });
  } catch (error) {
    next(error);
  }
});

// Deactivate a hospital admin.
router.patch("/hospitals/:id/admin/deactivate", async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    if (hospital.admin) {
      await User.updateOne({ _id: hospital.admin, role: "hospital_admin" }, { $set: { active: false } });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Super Admin platform-level dashboard statistics.
router.get("/dashboard", async (req, res, next) => {
  try {
    const [hospitals, activeHospitals, inactiveHospitals] = await Promise.all([
      Hospital.countDocuments(),
      Hospital.countDocuments({ status: "active" }),
      Hospital.countDocuments({ status: "inactive" }),
    ]);

    const [totalDoctors, totalPatients, totalPharmacy, totalReception, totalCleaners] = await Promise.all([
      User.countDocuments({ role: "doctor" }),
      User.countDocuments({ role: "patient" }),
      User.countDocuments({ role: "pharmacy" }),
      User.countDocuments({ role: "reception" }),
      User.countDocuments({ role: "cleaner" }),
    ]);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

    const [todayAppointments] = await Promise.all([
      Appointment.countDocuments({ scheduledFor: { $gte: todayStart, $lt: todayEnd }, status: { $ne: "cancelled" } }),
      Invoice.aggregate([
        { $match: { status: "paid", paidAt: { $gte: todayStart, $lt: todayEnd } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    res.json({
      hospitals,
      activeHospitals,
      inactiveHospitals,
      totalDoctors,
      totalPatients,
      totalPharmacy,
      totalReception,
      totalCleaners,
      todayAppointments,
    });
  } catch (error) {
    next(error);
  }
});

// Search / filter hospitals.
router.get("/hospitals/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ hospitals: [] });
    const regex = new RegExp(q, "i");
    const hospitals = await Hospital.find({
      $or: [{ name: regex }, { hospitalId: regex }, { code: regex }, { email: regex }, { phone: regex }, { city: regex }, { state: regex }],
    }).populate("admin", "name email").limit(20).lean();
    res.json({ hospitals });
  } catch (error) {
    next(error);
  }
});

// Delete hospital & deactivate associated users.
router.delete("/hospitals/:id", async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    if (hospital.code === "DEFAULT") {
      return res.status(400).json({ success: false, message: "Cannot delete the default system hospital" });
    }

    // Deactivate all users belonging to this hospital so orphaned records don't appear anywhere
    await User.updateMany({ hospitalId: hospital._id }, { $set: { active: false } });

    // Delete hospital document
    await Hospital.findByIdAndDelete(req.params.id);

    logAudit({ actor: req.user._id, actorRole: "superadmin", action: "hospital.delete", entity: "hospital", entityId: hospital._id, meta: { name: hospital.name, code: hospital.code } });

    res.json({ success: true, message: "Hospital deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
