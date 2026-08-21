import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireAuth, allowRoles, hospitalScope } from "../middleware/authJwt.js";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import Prescription from "../models/Prescription.js";
import Attendance from "../models/Attendance.js";
import Invoice from "../models/Invoice.js";
import { notify } from "../services/notificationService.js";
import { logAudit } from "../services/auditService.js";
import { generatePatientId, isValidMobile, generateToken } from "../services/idService.js";
import { slotStarts, doctorWindows } from "../services/availabilityService.js";

const router = Router();
router.use(requireAuth, allowRoles("reception", "admin", "hospital_admin"));

const doctorFields = "name email profile.specialty profile.qualification profile.consultationFee profile.availability profile.visitingHours profile.slotMinutes profile.breakMinutes hospitalId";
const patientFields = "name mobile patientId profile.patient profile.age profile.gender profile.address email active blocked hospitalId";
const staffFields = "name role profile.designation profile.salary profile.specialty pharmacy.storeName active hospitalId";

const dayWindow = (base = new Date()) => {
  const start = new Date(base); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [start, end];
};
const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Reception home: today's appointments, doctors + their open slots — scoped to hospital.
router.get("/home", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const [start, end] = dayWindow();
    const [appointments, doctors, cash] = await Promise.all([
      Appointment.find({ ...scope, scheduledFor: { $gte: start, $lt: end }, status: { $nin: ["cancelled", "missed"] } })
        .populate("patient", "name patientId mobile profile.age profile.gender")
        .populate("doctor", "name profile.specialty")
        .sort({ scheduledFor: 1 })
        .lean(),
      User.find({ ...scope, role: "doctor", active: true }).select(doctorFields).sort({ name: 1 }).lean(),
      Appointment.aggregate([
        { $match: { ...scope, paidAt: { $gte: start, $lt: end }, status: { $nin: ["cancelled", "missed"] } } },
        { $group: { _id: "$paymentMode", count: { $sum: 1 }, total: { $sum: "$consultationFee" } } },
      ]),
    ]);

    const doctorsWithSlots = await Promise.all(doctors.map(async (doctor) => {
      const { times } = slotStarts(doctor, start);
      const booked = await Appointment.find({ ...scope, doctor: doctor._id, scheduledFor: { $gte: start, $lt: end }, status: { $nin: ["cancelled", "missed"] } }).select("scheduledFor").lean();
      const taken = new Set(booked.map((b) => b.scheduledFor.getTime()));
      return { ...doctor, freeToday: times.filter((t) => !taken.has(t.getTime())).length, windows: doctorWindows(doctor) };
    }));

    res.json({
      date: dayStr(),
      appointments,
      doctors: doctorsWithSlots,
      cashCollected: cash.reduce((s, c) => s + c.total, 0),
      cashByMode: cash,
      stats: { todayAppointments: appointments.length, paidToday: cash.reduce((s, c) => s + c.count, 0) },
    });
  } catch (error) { next(error); }
});

// Doctor's free slots for a date — scoped to hospital.
router.get("/doctors/:id/slots", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const doctor = await User.findOne({ ...scope, _id: req.params.id, role: "doctor", active: true });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    const date = req.query.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: "Invalid date" });
    const [start] = dayWindow(date);
    const { times, slotMinutes } = slotStarts(doctor, start);
    const booked = await Appointment.find({ ...scope, doctor: doctor._id, scheduledFor: { $gte: start, $lt: new Date(start.getTime() + 86400000) }, status: { $nin: ["cancelled", "missed"] } }).select("scheduledFor").lean();
    const taken = new Set(booked.map((b) => b.scheduledFor.getTime()));
    res.json({
      date: dayStr(start),
      slots: times.filter((t) => !taken.has(t.getTime())).map((t) => t.toISOString()),
      slotMinutes,
      consultationFee: doctor.profile?.consultationFee || 0,
      visitingHours: doctor.profile?.visitingHours || "",
      hasAvailability: times.length > 0,
    });
  } catch (error) { next(error); }
});

// Look up patients by patientId, name or mobile — scoped to hospital.
router.get("/patients", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const q = String(req.query.q || "").trim();
    const query = { ...scope, role: "patient" };
    if (q) query.$or = [{ patientId: new RegExp(q, "i") }, { name: new RegExp(q, "i") }, { mobile: new RegExp(q, "i") }];
    const list = await User.find(query).select(patientFields).sort({ name: 1 }).limit(20).lean();
    const ids = list.map((p) => p._id);
    const active = ids.length ? await Appointment.find({ ...scope, patient: { $in: ids }, status: { $in: ["confirmed", "in-progress", "requested"] } }).sort({ scheduledFor: 1 }).lean() : [];
    const activeCount = new Map();
    active.forEach((a) => activeCount.set(String(a.patient), (activeCount.get(String(a.patient)) || 0) + 1));
    res.json({ patients: list.map((p) => ({ ...p, activeAppointments: activeCount.get(String(p._id)) || 0 })) });
  } catch (error) { next(error); }
});

// Walk-in: register a patient on the spot — scoped to hospital.
router.post("/patients", async (req, res, next) => {
  try {
    const { name, mobile, age, gender, address } = req.body;
    if (!isValidMobile(mobile)) return res.status(400).json({ error: "A valid 10-digit mobile number is required" });
    const normalizedMobile = mobile.replace(/[\s-]/g, "");
    const existing = await User.findOne({ mobile: normalizedMobile, role: "patient", hospitalId: req.user.hospitalId }).select(patientFields).lean();
    if (existing) return res.json({ patient: existing, created: false });
    if (!name) return res.status(400).json({ error: "New patient needs a name" });
    const loginPassword = normalizedMobile.slice(-6) || "guest1234";
    const patientId = await generatePatientId(normalizedMobile);
    const user = await User.create({
      name,
      mobile: normalizedMobile,
      email: `${normalizedMobile}@patient.local`,
      passwordHash: await bcrypt.hash(loginPassword, 10),
      role: "patient",
      hospitalId: req.user.hospitalId,
      patientId,
      profile: { age, gender, address },
    });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "reception.patient.create", entity: "user", entityId: user._id, meta: { patientId, hospitalId: req.user.hospitalId } });
    res.status(201).json({
      patient: { ...user.toObject(), ...user.profile, passwordHash: undefined },
      created: true,
      // Hand these to the walk-in so they can sign in later and see their
      // prescriptions, bills and visit records in the patient portal.
      loginEmail: `${normalizedMobile}@patient.local`,
      loginPassword,
    });
  } catch (error) { next(error); }
});

// A patient's full visit record — appointments, prescriptions and bills —
// so the desk can hand walk-in patients receipts for their medicines and visits.
router.get("/appointments", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const patient = await User.findOne({ ...scope, patientId: new RegExp(`^${String(req.query.patientId || "").trim()}$`, "i"), role: "patient" }).select("_id name patientId mobile").lean();
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    const [appointments, prescriptions, invoices] = await Promise.all([
      Appointment.find({ ...scope, patient: patient._id })
        .populate("doctor", "name profile.specialty")
        .sort({ scheduledFor: -1 })
        .limit(30)
        .lean(),
      Prescription.find({ ...scope, patient: patient._id })
        .populate("doctor", "name profile.specialty")
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      Invoice.find({ ...scope, patient: patient._id })
        .populate("doctor", "name profile.specialty")
        .populate("prescription", "prescriptionId")
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
    ]);
    res.json({ patient, appointments, prescriptions, invoices });
  } catch (error) { next(error); }
});

// Book on behalf of a patient — patient and doctor must be in the same hospital.
router.post("/appointments", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const { patientId, doctorId, scheduledFor, reason = "", paymentMode = "cash", amount } = req.body;
    const patient = await User.findOne({ ...scope, patientId: new RegExp(`^${String(patientId || "").trim()}$`, "i"), role: "patient", active: true });
    const doctor = await User.findOne({ ...scope, _id: doctorId, role: "doctor", active: true });
    const chosen = new Date(scheduledFor);
    if (!patient || !doctor || Number.isNaN(chosen.getTime())) {
      return res.status(400).json({ error: "Patient and doctor and a valid slot are required" });
    }

    const slot = new Date(chosen); slot.setSeconds(0, 0);
    const gen = slotStarts(doctor, slot);
    const snapped = Math.floor((slot.getHours() * 60 + slot.getMinutes()) / gen.slotMinutes) * gen.slotMinutes;
    slot.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
    if (slot.getTime() <= Date.now()) return res.status(400).json({ error: "Please pick a future slot" });
    if (!gen.times.some((t) => t.getTime() === slot.getTime())) {
      return res.status(400).json({ error: `That time is outside Dr. ${doctor.name}'s working hours or falls in a break. Pick an available slot.` });
    }
    const slotEnd = new Date(slot.getTime() + gen.slotMinutes * 60000);
    const clash = await Appointment.findOne({ ...scope, doctor: doctor._id, status: { $nin: ["cancelled", "missed"] }, scheduledFor: { $gte: slot, $lt: slotEnd } });
    if (clash) return res.status(409).json({ error: `That ${gen.slotMinutes}-minute slot is already booked.` });

    const existing = await Appointment.findOne({ ...scope, patient: patient._id, doctor: doctor._id, status: { $in: ["requested", "confirmed", "in-progress"] } });
    if (existing) return res.status(400).json({ error: "This patient already has a pending appointment with the doctor" });

    const fee = Number(amount) || doctor.profile?.consultationFee || 0;
    const appointment = await Appointment.create({
      hospitalId: req.user.hospitalId,
      patient: patient._id,
      doctor: doctor._id,
      scheduledFor: slot,
      reason,
      complaint: reason,
      consultationFee: fee,
      status: "confirmed",
      source: "reception",
      paidAt: new Date(),
      paymentMode: ["cash", "upi", "card"].includes(paymentMode) ? paymentMode : "cash",
      paymentCollectedBy: req.user._id,
    });
    const [start] = dayWindow(slot);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const seq = await Appointment.countDocuments({ ...scope, doctor: doctor._id, scheduledFor: { $gte: start, $lt: end }, status: { $ne: "cancelled" } });
    appointment.token = `T${generateToken(seq)}`;
    await appointment.save();

    await notify(patient._id, {
      title: "Appointment booked at reception",
      body: `Your appointment with Dr. ${doctor.name} on ${slot.toLocaleString()} is confirmed. Cash ${fee} collected. Token ${appointment.token}.`,
      type: "appointment",
      entity: "appointment",
      entityId: appointment._id,
    });
    await notify(doctor._id, {
      title: "New reception booking",
      body: `A receptionist booked ${patient.name} at ${slot.toLocaleString()}.`,
      type: "appointment",
      entity: "appointment",
      entityId: appointment._id,
    });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "reception.appointment.book", entity: "appointment", entityId: appointment._id, meta: { patientId: patient.patientId, fee, hospitalId: req.user.hospitalId } });
    res.status(201).json({ appointment });
  } catch (error) { next(error); }
});

// Daily cash collection report — scoped to hospital.
router.get("/cash", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const [start, end] = dayWindow(date);
    const appointments = await Appointment.find({ ...scope, paidAt: { $gte: start, $lt: end } })
      .populate("patient", "name patientId mobile")
      .populate("doctor", "name profile.specialty")
      .sort({ paidAt: 1 })
      .lean();
    res.json({ date: dayStr(start), count: appointments.length, total: appointments.reduce((s, a) => s + (a.consultationFee || 0), 0), appointments });
  } catch (error) { next(error); }
});

// Cleaners / staff marked present at the desk — scoped to hospital.
router.put("/attendance", async (req, res, next) => {
  try {
    const { userId, date, status = "present", checkIn = "09:00", checkOut = "" } = req.body;
    const target = await User.findOne({ _id: userId, role: { $in: ["cleaner", "reception", "nurse", "management", "security", "other", "pharmacy", "doctor"] }, hospitalId: req.user.hospitalId });
    if (!target) return res.status(404).json({ error: "Staff member not found" });
    const record = await Attendance.findOneAndUpdate(
      { user: target._id, hospitalId: req.user.hospitalId, date: dayStr(date ? new Date(date) : new Date()) },
      { $set: { user: target._id, hospitalId: req.user.hospitalId, date: dayStr(date ? new Date(date) : new Date()), status, checkIn, checkOut, source: "reception", recordedBy: req.user._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ record });
  } catch (error) { next(error); }
});

// Staff list — scoped to hospital.
router.get("/staff", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const staff = await User.find({ ...scope, role: { $in: ["cleaner", "reception", "nurse", "management", "security", "other"] }, active: true }).select(staffFields).sort({ name: 1 }).lean();
    res.json({ staff });
  } catch (error) { next(error); }
});

export default router;
