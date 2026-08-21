import { Router } from "express";
import { requireAuth, allowRoles, hospitalScope } from "../middleware/authJwt.js";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import ClinicalNote from "../models/ClinicalNote.js";

const router = Router();
router.use(requireAuth);
const doctorFields = "name email profile.specialty profile.location profile.visitingHours profile.consultationFee profile.availableToday hospitalId";

// Patient dashboard — scoped to patient's hospital.
router.get("/patient", allowRoles("patient"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const [appointments, reports, doctors] = await Promise.all([
      Appointment.find({ ...scope, patient: req.user._id }).populate("doctor", doctorFields).sort({ scheduledFor: -1 }).lean(),
      ClinicalNote.find({ ...scope, patient: req.user._id, status: "published" }).populate("doctor", "name profile.specialty profile.location").sort({ createdAt: -1 }).lean(),
      User.find({ ...scope, role: "doctor", active: true }).select(doctorFields).sort({ name: 1 }).lean(),
    ]);
    res.json({ appointments, reports, doctors });
  } catch (error) { next(error); }
});

router.post("/patient/appointments", allowRoles("patient"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const { doctorId, scheduledFor, reason } = req.body;
    const doctor = await User.findOne({ ...scope, _id: doctorId, role: "doctor", active: true });
    const scheduled = new Date(scheduledFor);
    if (!doctor || Number.isNaN(scheduled.getTime()) || scheduled <= new Date()) return res.status(400).json({ error: "Choose an available doctor and a future appointment time" });
    if (doctor.profile?.availableToday === false) return res.status(400).json({ error: "This doctor is not available today" });
    const appointment = await Appointment.create({
      ...scope,
      patient: req.user._id,
      doctor: doctor._id,
      scheduledFor: scheduled,
      reason,
      consultationFee: doctor.profile?.consultationFee || 0,
    });
    res.status(201).json({ appointment });
  } catch (error) { next(error); }
});

router.patch("/patient/appointments/:id/cancel", allowRoles("patient"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const appointment = await Appointment.findOneAndUpdate(
      { ...scope, _id: req.params.id, patient: req.user._id, status: { $in: ["requested", "confirmed"] } },
      { $set: { status: "cancelled", cancelledBy: "patient" } },
      { new: true },
    );
    if (!appointment) return res.status(400).json({ error: "Only an upcoming appointment can be cancelled" });
    res.json({ appointment });
  } catch (error) { next(error); }
});

// Doctor dashboard — scoped to doctor's hospital.
router.get("/doctor", allowRoles("doctor"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const [appointments, profile] = await Promise.all([
      Appointment.find({ ...scope, doctor: req.user._id }).populate("patient", "name email profile.phone").sort({ scheduledFor: 1 }).lean(),
      User.findById(req.user._id).select("profile name hospitalId").lean(),
    ]);
    res.json({ appointments, profile });
  } catch (error) { next(error); }
});

router.patch("/doctor/appointments/:id", allowRoles("doctor"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const status = req.body.status;
    if (!["confirmed", "cancelled"].includes(status)) return res.status(400).json({ error: "Invalid appointment status" });
    const appointment = await Appointment.findOneAndUpdate(
      { ...scope, _id: req.params.id, doctor: req.user._id, status: { $in: ["requested", "confirmed"] } },
      { $set: { status, cancelledBy: status === "cancelled" ? "doctor" : null } },
      { new: true },
    );
    if (!appointment) return res.status(404).json({ error: "Appointment not found or no longer actionable" });
    res.json({ appointment });
  } catch (error) { next(error); }
});

router.put("/doctor/appointments/:id/note", allowRoles("doctor"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const appointment = await Appointment.findOne({ ...scope, _id: req.params.id, doctor: req.user._id, status: { $ne: "cancelled" } });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    const { assessment, prescription = [], publish = false, sendToPharmacy = false, pharmacyName = "" } = req.body;
    if (!assessment) return res.status(400).json({ error: "Assessment is required" });
    const note = await ClinicalNote.findOneAndUpdate(
      { ...scope, appointment: appointment._id },
      {
        $set: {
          hospitalId: req.user.hospitalId,
          patient: appointment.patient,
          doctor: req.user._id,
          assessment,
          prescription,
          status: publish ? "published" : "draft",
          sentToPharmacy: publish && sendToPharmacy,
          pharmacyName: publish && sendToPharmacy ? pharmacyName : "",
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    if (publish) await Appointment.updateOne({ ...scope, _id: appointment._id }, { $set: { status: "completed" } });
    res.json({ note });
  } catch (error) { next(error); }
});

// Admin/Hospital Admin dashboard — scoped to admin's hospital.
router.get("/admin", allowRoles("admin", "hospital_admin"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const [users, doctors, todayAppointments, recentAppointments, fees] = await Promise.all([
      User.aggregate([{ $match: { ...scope } }, { $group: { _id: "$role", count: { $sum: 1 } } }]),
      User.find({ ...scope, role: "doctor", active: true }).select(doctorFields).sort({ name: 1 }).lean(),
      Appointment.countDocuments({ ...scope, scheduledFor: { $gte: start, $lt: end }, status: { $ne: "cancelled" } }),
      Appointment.find(scope).populate("patient doctor", "name email profile.specialty profile.location").sort({ createdAt: -1 }).limit(30).lean(),
      Appointment.aggregate([{ $match: { ...scope, status: { $ne: "cancelled" } } }, { $group: { _id: "$patient", totalFees: { $sum: "$consultationFee" }, visits: { $sum: 1 } } }, { $sort: { totalFees: -1 } }]),
    ]);
    const patientNames = await User.find({ ...scope, _id: { $in: fees.map((f) => f._id) } }).select("name").lean();
    const nameById = new Map(patientNames.map((p) => [p._id.toString(), p.name]));
    res.json({ users, doctors, todayAppointments, availableToday: doctors.filter((d) => d.profile?.availableToday !== false).length, recentAppointments, patientFees: fees.map((f) => ({ ...f, patientName: nameById.get(f._id.toString()) || "Patient" })) });
  } catch (error) { next(error); }
});

router.post("/admin/doctors", allowRoles("admin", "hospital_admin"), async (req, res, next) => {
  try {
    const { name, email, password, specialty, location, visitingHours, consultationFee, availableToday = true } = req.body;
    if (!name || !email || !password || password.length < 8 || !specialty || !location || !visitingHours) return res.status(400).json({ error: "Complete all doctor details and use an 8-character password" });
    const bcrypt = await import("bcryptjs");
    const doctor = await User.create({
      name, email, passwordHash: await bcrypt.default.hash(password, 12), role: "doctor",
      hospitalId: req.user.hospitalId,
      profile: { specialty, location, visitingHours, consultationFee: Number(consultationFee) || 0, availableToday: Boolean(availableToday) },
    });
    res.status(201).json({ doctor: { _id: doctor._id, name: doctor.name } });
  } catch (error) { next(error); }
});

router.patch("/admin/appointments/:id/cancel", allowRoles("admin", "hospital_admin"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const appointment = await Appointment.findOneAndUpdate(
      { ...scope, _id: req.params.id, status: { $in: ["requested", "confirmed"] } },
      { $set: { status: "cancelled", cancelledBy: "admin" } },
      { new: true },
    );
    if (!appointment) return res.status(400).json({ error: "Only active appointments can be cancelled" });
    res.json({ appointment });
  } catch (error) { next(error); }
});

export default router;
