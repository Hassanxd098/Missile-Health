import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config, requireConfig } from "./config.js";
import User from "./models/User.js";
import Hospital from "./models/Hospital.js";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiRoutes from "./routes/ai.js";
import patientRoutes from "./routes/patients.js";
import doctorRoutes from "./routes/doctor.js";
import adminRoutes from "./routes/admin.js";
import pharmacyRoutes from "./routes/pharmacy.js";
import consultationRoutes from "./routes/consultations.js";
import notificationRoutes from "./routes/notifications.js";
import receptionRoutes from "./routes/reception.js";
import superAdminRoutes from "./routes/superAdmin.js";
import publicRoutes from "./routes/public.js";
import { generateHospitalId } from "./services/idService.js";

requireConfig("mongoUri", "jwtSecret");
const app = express();
app.use(cors({ origin: true, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

let connectPromise = null;
async function ensureDBConnected() {
  if (mongoose.connection.readyState === 1) return;
  if (!connectPromise) {
    connectPromise = mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 })
      .then(async (m) => {
        await seedSuperAdmin().catch((e) => console.warn("Seed superadmin:", e.message));
        const hospital = await seedDefaultHospital().catch((e) => console.warn("Seed hospital:", e.message));
        if (hospital) {
          await migrateExistingData(hospital._id).catch(() => { });
          await backfillDoctorAvailability().catch(() => { });
        }
        return m;
      })
      .catch((err) => {
        connectPromise = null;
        throw err;
      });
  }
  await connectPromise;
}

app.use(async (req, res, next) => {
  if (req.path === "/api/health") return next();
  try {
    await ensureDBConnected();
    next();
  } catch (err) {
    console.error("Database connection failure:", err);
    res.status(500).json({ error: "Database connection failed. Please check MONGODB_URI." });
  }
});
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Missile Health Backend API is running",
  });
});

app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  }),
);
// API root
// app.get("/api", (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: "Missile Health Backend API is running",
//   });
// });

// // Health check - no database connection required
// app.get("/api/health", (req, res) => {
//   res.status(200).json({
//     status: "ok",
//     database:
//       mongoose.connection.readyState === 1
//         ? "connected"
//         : "disconnected",
//   });
// });

// // Connect to MongoDB for all other API requests
// app.use(async (req, res, next) => {
//   try {
//     await ensureDBConnected();
//     next();
//   } catch (err) {
//     console.error("Database connection failure:", err);

//     res.status(500).json({
//       error: "Database connection failed. Please check MONGODB_URI.",
//     });
//   }
// });

// app.get("/api/health", (req, res) =>
//   res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }),
// );

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reception", receptionRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/public", publicRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use((err, req, res, next) => {
  console.error("Express App Error:", err);
  if (err.name === "ValidationError" || err.name === "CastError")
    return res.status(400).json({ success: false, error: err.message || "Invalid request data" });
  if (err.code === 11000) return res.status(409).json({ success: false, error: "A record with that value already exists" });
  res.status(500).json({ success: false, error: err.message || "Internal server error" });
});

// Seed a Super Admin from env (SUPER_ADMIN_* or legacy ADMIN_*).
async function seedSuperAdmin() {
  try {
    const { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } = process.env;
    const useEnv = SUPER_ADMIN_EMAIL && SUPER_ADMIN_PASSWORD;
    const email = (useEnv ? SUPER_ADMIN_EMAIL : process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const password = (useEnv ? SUPER_ADMIN_PASSWORD : process.env.ADMIN_PASSWORD) || "";
    const name = process.env.SUPER_ADMIN_NAME || process.env.ADMIN_NAME || "System Super Admin";
    if (!email || !password) return;
    if (password.length < 8) throw new Error("SUPER_ADMIN_PASSWORD/ADMIN_PASSWORD must be at least 8 characters");
    if (await User.exists({ role: "superadmin" })) return;

    const existing = await User.findOne({ email });
    if (!existing) {
      await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: "superadmin" });
      console.log("Super admin account created.");
      return;
    }
    if (existing.role === "admin" || existing.role === "hospital_admin") {
      await User.updateOne({ _id: existing._id }, { $set: { role: "superadmin", passwordHash: await bcrypt.hash(password, 12) } });
      console.log("Existing admin promoted to super admin.");
      return;
    }
    console.warn(`Skipped super admin seed: "${email}" is already in use by a non-admin account.`);
  } catch (error) {
    console.warn("Super admin seed skipped:", error.message);
  }
}

// Create the default "Existing Hospital" so legacy records can be migrated.
// The Hospital Admin must be a DIFFERENT account from the Super Admin.
// If the env ADMIN_EMAIL was used to seed the super admin, we create a separate
// hospital admin from DEFAULT_HOSPITAL_ADMIN_* env vars (or a fallback).
async function seedDefaultHospital() {
  try {
    const existing = await Hospital.findOne({ code: "DEFAULT" });
    if (existing) return existing;

    const hospitalId = await generateHospitalId("DEFAULT");
    const hospital = await Hospital.create({
      hospitalId,
      name: "Existing Hospital",
      code: "DEFAULT",
      status: "active",
    });

    // The hospital admin email MUST be different from the super admin email.
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase().trim();
    const adminEmail = (process.env.DEFAULT_HOSPITAL_ADMIN_EMAIL || "hospital.admin@example.com").toLowerCase().trim();
    const adminPassword = process.env.DEFAULT_HOSPITAL_ADMIN_PASSWORD || "Admin@321";
    const adminName = process.env.DEFAULT_HOSPITAL_ADMIN_NAME || "Hospital Admin";

    if (adminEmail === superAdminEmail) {
      throw new Error("DEFAULT_HOSPITAL_ADMIN_EMAIL must differ from the super admin email");
    }

    let admin = await User.findOne({ email: adminEmail });
    if (admin) {
      // Reuse an existing account but ensure it's hospital_admin-scoped, never superadmin.
      if (admin.role === "superadmin") {
        await User.updateOne({ _id: admin._id }, { $set: { passwordHash: await bcrypt.hash(adminPassword, 12), hospitalId: hospital._id, active: true, blocked: false } });
      } else {
        await User.updateOne({ _id: admin._id }, { $set: { role: "hospital_admin", hospitalId: hospital._id, active: true, blocked: false } });
      }
    } else {
      admin = await User.create({
        name: adminName,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "hospital_admin",
        hospitalId: hospital._id,
      });
    }
    try {
      const legacyAdminEmail = (process.env.LEGACY_ADMIN_EMAIL || "legacy.admin@example.com").toLowerCase().trim();
      const legacyAdminPassword = process.env.LEGACY_ADMIN_PASSWORD || "LegacyAdmin@123";
      const legacyAdminName = process.env.LEGACY_ADMIN_NAME || "Legacy Administrator";

      if (legacyAdminEmail !== superAdminEmail && legacyAdminEmail !== adminEmail) {
        let legacyAdmin = await User.findOne({ email: legacyAdminEmail });
        if (legacyAdmin) {
          await User.updateOne({ _id: legacyAdmin._id }, { $set: { role: "admin", hospitalId: hospital._id, passwordHash: await bcrypt.hash(legacyAdminPassword, 12), active: true, blocked: false } });
        } else {
          legacyAdmin = await User.create({
            name: legacyAdminName,
            email: legacyAdminEmail,
            passwordHash: await bcrypt.hash(legacyAdminPassword, 12),
            role: "admin",
            hospitalId: hospital._id,
          });
        }
        console.log("Legacy admin account seeded.");
      }
    } catch (legacyErr) {
      console.warn("Legacy admin seed skipped:", legacyErr.message);
    }

    hospital.admin = admin._id;
    await hospital.save();

    console.log("Default hospital and admin seeded.");
    return hospital;
  } catch (error) {
    console.warn("Default hospital seed skipped:", error.message);
  }
}

// Migration: assign hospitalId to existing records that don't have one.
async function migrateExistingData(defaultHospitalId) {
  try {
    let migrated = 0;

    const res = await User.updateMany(
      { hospitalId: { $exists: false }, role: { $ne: "superadmin" } },
      { $set: { hospitalId: defaultHospitalId } },
    );
    migrated += res.modifiedCount || 0;

    // Use the existing ObjectId directly — it's already from a MongoDB document.
    const oid = new mongoose.Types.ObjectId(defaultHospitalId);
    const collections = ["appointments", "prescriptions", "clinicalnotes", "invoices", "attendances"];
    for (const coll of collections) {
      const r = await mongoose.connection.db.collection(coll).updateMany(
        { hospitalId: { $exists: false } },
        { $set: { hospitalId: oid } },
      );
      migrated += r.modifiedCount || 0;
    }

    if (migrated) console.log(`Migrated ${migrated} record(s) to default hospital.`);
  } catch (error) {
    console.warn("Data migration skipped:", error.message);
  }
}

// Ensure every doctor in the default hospital has working-hours plan.
async function backfillDoctorAvailability() {
  try {
    const { defaultAvailability } = await import("./services/availabilityService.js");
    const doctors = await User.find({ role: "doctor", "profile.availability": { $exists: false } }).select("_id").lean();
    let updated = 0;
    for (const doctor of doctors) {
      await User.updateOne({ _id: doctor._id }, { $set: { "profile.availability": defaultAvailability() } });
      updated++;
    }
    if (updated) console.log(`Backfilled default availability for ${updated} doctor(s).`);
  } catch (error) {
    console.warn("Doctor availability backfill skipped:", error.message);
  }
}

if (!process.env.VERCEL) {
  app.listen(config.port, () => console.log(`Missile Health API listening on port ${config.port}`));
}

mongoose
  .connect(config.mongoUri)
  .then(async () => {
    console.log("Connected to MongoDB Atlas successfully.");
    await seedSuperAdmin().catch((e) => console.warn("Seed superadmin:", e.message));
    const hospital = await seedDefaultHospital().catch((e) => console.warn("Seed hospital:", e.message));
    if (hospital) {
      await migrateExistingData(hospital._id).catch(() => { });
      await backfillDoctorAvailability().catch(() => { });
    }
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });

export default app;
