import { Router } from "express";
import { requireAuth, allowRoles, hospitalScope } from "../middleware/authJwt.js";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import Prescription from "../models/Prescription.js";
import ClinicalNote from "../models/ClinicalNote.js";
import Invoice from "../models/Invoice.js";
import { logAudit } from "../services/auditService.js";
import { slotStarts } from "../services/availabilityService.js";
import { notify } from "../services/notificationService.js";

const router = Router();
router.use(requireAuth, allowRoles("doctor"));

const patientFields = "name email mobile patientId profile.gender profile.age profile.bloodGroup profile.bloodPressure profile.sugarLevel profile.heightCm profile.weightKg profile.bmi patient.hospitalId patient.bloodGroup patient.heightCm patient.weightKg patient.bmi patient.bloodPressure patient.sugarLevel patient.allergies patient.existingDiseases patient.medicalHistory patient.currentMedicines active blocked";
const doctorFields = "name email profile.specialty profile.qualification profile.location profile.consultationFee profile.availableToday profile.opdCharges hospitalId";

const dayRange = (offset = 0) => {
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + offset);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [start, end];
};

const lastNDays = (n) => {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(end); start.setDate(start.getDate() - (n - 1)); start.setHours(0, 0, 0, 0);
  return [start, end];
};

// Doctor home: queue, today's stats, revenue, charts — all scoped to the doctor's hospital.
router.get("/home", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const doctorId = req.user._id;
    const [start, end] = dayRange();
    const [weekStart, weekEnd] = lastNDays(7);

    const [profile, today, upcoming, allAppointments, patientsSeen, weeklyAppointments, weeklyRevenue, recentNotes] = await Promise.all([
      User.findById(doctorId).select("name profile hospitalId").lean(),
      Appointment.find({ doctor: doctorId, scheduledFor: { $gte: start, $lt: end } })
        .populate("patient", patientFields)
        .sort({ scheduledFor: 1 })
        .lean(),
      Appointment.find({ doctor: doctorId, scheduledFor: { $gte: start }, status: { $in: ["confirmed", "in-progress"] } })
        .populate("patient", patientFields)
        .sort({ scheduledFor: 1 })
        .lean(),
      Appointment.find({ doctor: doctorId })
        .populate("patient", patientFields)
        .sort({ scheduledFor: 1 })
        .lean(),
      Appointment.countDocuments({ doctor: doctorId, status: "completed" }),
      Appointment.aggregate([
        { $match: { doctor: doctorId, scheduledFor: { $gte: weekStart, $lt: weekEnd } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledFor" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Appointment.aggregate([
        { $match: { doctor: doctorId, status: "completed", scheduledFor: { $gte: weekStart, $lt: weekEnd } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledFor" } }, revenue: { $sum: "$consultationFee" } } },
        { $sort: { _id: 1 } },
      ]),
      ClinicalNote.find({ doctor: doctorId, status: "published" }).populate("patient", "name patientId").sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    const completedToday = today.filter((a) => a.status === "completed").length;
    const pendingToday = today.filter((a) => ["confirmed", "in-progress"].includes(a.status)).length;
    const pendingTotal = allAppointments.filter((a) => ["confirmed", "in-progress"].includes(a.status)).length;
    const totalAppointments = allAppointments.length;
    const revenueToday = today.filter((a) => a.status === "completed").reduce((s, a) => s + (a.consultationFee || 0), 0);
    const totalRevenue = allAppointments.filter((a) => a.status === "completed").reduce((s, a) => s + (a.consultationFee || 0), 0);
    const next = upcoming.find((a) => a.status !== "in-progress") || upcoming[0] || null;

    res.json({
      profile,
      today,
      upcoming,
      allAppointments,
      next,
      recentNotes,
      stats: {
        completedToday,
        pendingToday,
        pendingTotal,
        totalAppointments,
        revenueToday,
        totalRevenue,
        totalVisits: patientsSeen
      },
      charts: { weeklyAppointments, weeklyRevenue },
    });
  } catch (error) { next(error); }
});

// Full queue for a date (default today) with search/filter/pagination.
router.get("/queue", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const doctorId = req.user._id;
    const { date, status = "all", search = "", page = 1, limit = 25 } = req.query;
    const base = date ? new Date(date) : new Date();
    const [start, end] = dayRangeFrom(base);
    const query = { ...scope, doctor: doctorId, scheduledFor: { $gte: start, $lt: end } };
    if (status && status !== "all") query.status = status;
    if (search) {
      const patient = await User.findOne({ ...scope, $or: [{ name: new RegExp(search, "i") }, { patientId: new RegExp(search, "i") }, { mobile: new RegExp(search, "i") }] }).select("_id").lean();
      if (patient) query.patient = patient._id; else return res.json({ appointments: [], total: 0 });
    }
    const total = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
      .populate("patient", patientFields)
      .sort({ scheduledFor: 1 })
      .skip((Math.max(Number(page), 1) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    res.json({ appointments, total, page: Number(page) });
  } catch (error) { next(error); }
});

const dayRangeFrom = (base) => {
  const start = new Date(base); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [start, end];
};

// Advance a patient's queue status (in-progress / completed).
router.patch("/appointments/:id", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["confirmed", "in-progress", "completed", "cancelled", "missed"].includes(status)) {
      return res.status(400).json({ error: "Invalid appointment status" });
    }
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, doctor: req.user._id, hospitalId: req.user.hospitalId, status: { $in: ["requested", "confirmed", "in-progress"] } },
      { $set: { status, cancelledBy: status === "cancelled" ? "doctor" : null } },
      { new: true },
    );
    if (!appointment) return res.status(404).json({ error: "Appointment not found or no longer actionable" });
    res.json({ appointment });
  } catch (error) { next(error); }
});

// Delay a patient in the queue.
router.post("/appointments/:id/delay", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const minutes = Number(req.body.minutes);
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 240) {
      return res.status(400).json({ error: "Provide a delay between 1 and 240 minutes" });
    }
    const pivot = await Appointment.findOne({ ...scope, _id: req.params.id, doctor: req.user._id, status: { $in: ["confirmed", "in-progress"] } });
    if (!pivot) return res.status(404).json({ error: "Appointment not found or no longer actionable" });

    const [start, end] = dayRangeFrom(pivot.scheduledFor);
    const all = await Appointment.find({ ...scope, doctor: req.user._id, scheduledFor: { $gte: start, $lt: end }, status: { $nin: ["cancelled", "missed"] } })
      .select("scheduledFor patient status")
      .sort({ scheduledFor: 1 })
      .lean();

    const moving = all.filter((a) => a.scheduledFor.getTime() >= pivot.scheduledFor.getTime());
    if (!moving.length) return res.status(400).json({ error: "Nothing to delay for this appointment" });

    const movingIds = new Set(moving.map((a) => String(a._id)));
    const fixed = new Set(all.filter((a) => !movingIds.has(String(a._id))).map((a) => a.scheduledFor.getTime()));

    const { times } = slotStarts(req.user, start);
    const baseTarget = pivot.scheduledFor.getTime() + minutes * 60000;
    let idx = times.findIndex((t) => t.getTime() >= baseTarget);
    while (idx < times.length && fixed.has(times[idx].getTime())) idx++;
    if (idx < 0) idx = 0;
    if (idx + moving.length > times.length) {
      return res.status(400).json({ error: "No room left in this day's schedule for the delay — end the day or reduce the delay." });
    }

    const shifts = [];
    for (let i = 0; i < moving.length; i++) {
      const ap = moving[i];
      let j = idx + i;
      while (j < times.length && fixed.has(times[j].getTime())) j++;
      const oldTime = ap.scheduledFor;
      await Appointment.updateOne({ _id: ap._id }, { $set: { scheduledFor: times[j] } });
      shifts.push({ appointmentId: ap._id, old: oldTime.toISOString(), to: times[j].toISOString() });
      if (String(ap._id) !== String(pivot._id) && ap.patient) {
        await notify(ap.patient, {
          title: "Appointment time updated",
          body: `Dr. ${req.user.name} is running behind — your visit is now scheduled for ${times[j].toLocaleString()}.`,
          type: "appointment",
          entity: "appointment",
          entityId: ap._id,
        });
      }
    }
    logAudit({ actor: req.user._id, actorRole: "doctor", action: "doctor.delay", entity: "appointment", entityId: pivot._id, meta: { minutes, shifted: shifts.length, hospitalId: req.user.hospitalId } });
    res.json({ shifted: shifts.length, pivot: pivot._id, shifts });
  } catch (error) { next(error); }
});

// Set/update consultation fee.
router.put("/profile/fee", async (req, res, next) => {
  try {
    const fee = Number(req.body.consultationFee);
    if (Number.isNaN(fee) || fee < 0) return res.status(400).json({ error: "Invalid consultation fee" });
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { "profile.consultationFee": fee } }, { new: true }).select("name profile").lean();
    logAudit({ actor: req.user._id, actorRole: "doctor", action: "doctor.fee", entity: "user", entityId: req.user._id, meta: { fee, hospitalId: req.user.hospitalId } });
    res.json({ profile: user.profile });
  } catch (error) { next(error); }
});

// Doctor's weekly availability windows.
router.put("/profile/availability", async (req, res, next) => {
  try {
    const { availability = [], slotMinutes = 15, breakMinutes = 0, visitingHours } = req.body || {};
    const clean = (Array.isArray(availability) ? availability : [])
      .map((a) => ({ day: Number(a?.day), start: String(a?.start || ""), end: String(a?.end || "") }))
      .filter((a) => Number.isInteger(a.day) && a.day >= 0 && a.day <= 6 && /^\d{1,2}:\d{2}$/.test(a.start) && /^\d{1,2}:\d{2}$/.test(a.end));
    const set = {
      "profile.availability": clean,
      "profile.slotMinutes": Math.max(15, Number(slotMinutes) || 15),
      "profile.breakMinutes": Math.max(0, Number(breakMinutes) || 0),
    };
    if (visitingHours !== undefined) set["profile.visitingHours"] = visitingHours;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: set }, { new: true }).select("name profile").lean();
    logAudit({ actor: req.user._id, actorRole: "doctor", action: "doctor.availability", entity: "user", entityId: req.user._id, meta: { slots: clean.length, slotMinutes: set["profile.slotMinutes"], hospitalId: req.user.hospitalId } });
    res.json({ profile: user.profile });
  } catch (error) { next(error); }
});

// Full patient dossier for a consultation — scoped to the doctor's hospital.
router.get("/patients/:id", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const patient = await User.findOne({ ...scope, _id: req.params.id, role: "patient" }).select(
      "name email mobile patientId profile patient emergencyContact insurance active hospitalId",
    ).lean();
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    const [visits, notes, invoices] = await Promise.all([
      Appointment.find({ ...scope, patient: patient._id }).populate("doctor", "name profile.specialty profile.qualification").sort({ scheduledFor: -1 }).lean(),
      ClinicalNote.find({ ...scope, patient: patient._id, status: "published" }).populate("doctor", "name profile.specialty").sort({ createdAt: -1 }).lean(),
      Invoice.find({ ...scope, patient: patient._id }).populate("doctor", "name").sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ patient, visits, notes, invoices });
  } catch (error) { next(error); }
});

// Full patient dossier, scoped by appointment — doctor and appointment must be in same hospital.
router.get("/consult/:appointmentId", async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({ _id: req.params.appointmentId, doctor: req.user._id }).lean();
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Enforce 1-hour start rule: Doctor can only enter consultation room if appointment is within 1 hour or past scheduled time
    const now = Date.now();
    const apptTime = new Date(appointment.scheduledFor).getTime();
    const oneHourMs = 60 * 60 * 1000;
    if (appointment.status === "confirmed" && (apptTime - now) > oneHourMs) {
      const timeStr = new Date(appointment.scheduledFor).toLocaleString();
      return res.status(400).json({
        error: `Consultation room is locked. This appointment is scheduled for ${timeStr}. You can only start consultations within 1 hour of the scheduled time.`
      });
    }
    const patientFields = "name email mobile patientId profile patient emergencyContact insurance active";
    // Prefer the hospital-scoped lookup, but fall back to a global lookup so a
    // legacy/migrated patient (missing or mismatched hospitalId) still shows
    // their name and Patient ID instead of a blank header.
    let patient = await User.findOne({ ...scope, _id: appointment.patient }).select(patientFields).lean();
    if (!patient) {
      patient = await User.findOne({ _id: appointment.patient }).select(patientFields).lean();
    }
    const [visits, notes, invoices] = await Promise.all([
      Appointment.find({ ...scope, patient: appointment.patient }).populate("doctor", "name profile.specialty profile.qualification").sort({ scheduledFor: -1 }).lean(),
      ClinicalNote.find({ ...scope, patient: appointment.patient, status: "published" }).populate("doctor", "name profile.specialty").sort({ createdAt: -1 }).lean(),
      Invoice.find({ ...scope, patient: appointment.patient }).populate("doctor", "name").sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ appointment, patient, visits, notes, invoices });
  } catch (error) { next(error); }
});

// Doctor's own prescriptions ledger — scoped to the doctor's hospital.
router.get("/prescriptions", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const prescriptions = await Prescription.find({ ...scope, doctor: req.user._id })
      .populate("patient", "name patientId mobile")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ prescriptions });
  } catch (error) { next(error); }
});

export default router;
