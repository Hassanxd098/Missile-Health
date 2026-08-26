import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { requireAuth, allowRoles, hospitalScope } from "../middleware/authJwt.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Appointment from "../models/Appointment.js";
import Prescription from "../models/Prescription.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";
import { notify } from "../services/notificationService.js";
import { generateDoctorSlots } from "../services/availabilityService.js";

const router = Router();
router.use(requireAuth, allowRoles("patient"));

const doctorFields = "name email profile.specialty profile.qualification profile.location profile.consultationFee profile.availableToday profile.visitingHours profile.availability profile.slotMinutes profile.breakMinutes profile.experienceYears profile.profilePhoto hospitalId";

const dayWindow = (base) => {
  const start = new Date(base); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [start, end];
};

async function resolveHospital(input, fallbackHospitalId) {
  if (input && input !== "all") {
    const cond = mongoose.Types.ObjectId.isValid(input)
      ? { _id: input }
      : { code: String(input).toUpperCase() };
    const hospital = await Hospital.findOne({ ...cond, status: { $ne: "inactive" } }).lean();
    if (hospital) return hospital;
  }
  return fallbackHospitalId ? Hospital.findById(fallbackHospitalId).lean() : null;
}

// Comprehensive patient overview — the home dashboard payload.
router.get("/home", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const me = await User.findById(req.user._id).lean();
    const [appointments, prescriptions, invoices, doctors, notifications] = await Promise.all([
      Appointment.find({ patient: req.user._id }).populate("doctor", doctorFields).sort({ scheduledFor: -1 }).lean(),
      Prescription.find({ patient: req.user._id }).populate("doctor", "name profile.specialty").sort({ createdAt: -1 }).lean(),
      Invoice.find({ patient: req.user._id }).populate("doctor", "name profile.specialty").populate("prescription", "prescriptionId").sort({ createdAt: -1 }).lean(),
      User.find({ role: "doctor", active: true }).select(doctorFields).populate("hospitalId", "name code city state status").sort({ name: 1 }).lean(),
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const activeDoctors = (doctors || []).filter(
      (doc) => doc.hospitalId && typeof doc.hospitalId === "object" && doc.hospitalId.status !== "inactive"
    );

    const upcoming = appointments.find((a) => ["requested", "confirmed", "in-progress"].includes(a.status));
    const lastConsultation = prescriptions[0] || null;
    const pendingInvoices = invoices.filter((i) => i.status === "pending");
    const paidInvoices = invoices.filter((i) => i.status === "paid");

    res.json({
      user: { patientId: me.patientId, name: me.name, hospitalId: me.hospitalId },
      appointments,
      prescriptions,
      invoices,
      doctors: activeDoctors,
      upcoming,
      lastConsultation,
      stats: {
        doctorVisits: appointments.filter((a) => a.status === "completed").length,
        prescriptions: prescriptions.length,
        bills: invoices.length,
        pendingCount: pendingInvoices.length,
        completedCount: paidInvoices.length,
        totalPending: Math.round(pendingInvoices.reduce((s, i) => s + (i.total || 0), 0)),
      },
      notifications,
    });
  } catch (error) { next(error); }
});

// Active hospitals list
router.get("/hospitals", async (req, res, next) => {
  try {
    const hospitals = await Hospital.find({ status: { $ne: "inactive" } })
      .select("hospitalId name code city state")
      .sort({ name: 1 })
      .lean();
    res.json({ hospitals: hospitals || [] });
  } catch (error) { next(error); }
});

// Filter doctors by specialty, hospital, or retrieve all active doctors across hospitals
router.get("/doctors", async (req, res, next) => {
  try {
    const filter = { role: "doctor", active: true };

    let hospitalObj = null;
    if (req.query.hospital && req.query.hospital !== "all") {
      hospitalObj = await resolveHospital(req.query.hospital, null);
      if (hospitalObj) {
        filter.hospitalId = hospitalObj._id;
      } else {
        // Requested hospital does not exist or was deleted/deactivated
        return res.json({ hospital: null, doctors: [], specialties: [] });
      }
    }

    if (req.query.specialty && req.query.specialty !== "all") {
      filter["profile.specialty"] = new RegExp(req.query.specialty.trim(), "i");
    }

    const [rawDoctors, rawSpecialties] = await Promise.all([
      User.find(filter)
        .select(doctorFields)
        .populate("hospitalId", "name code city state status")
        .sort({ name: 1 })
        .lean(),
      User.distinct("profile.specialty", { role: "doctor", active: true }),
    ]);

    const doctors = (rawDoctors || []).filter(
      (doc) => doc.hospitalId && typeof doc.hospitalId === "object" && doc.hospitalId.status !== "inactive"
    );

    const specialties = (rawSpecialties || []).filter(Boolean).sort();

    res.json({
      hospital: hospitalObj ? { _id: hospitalObj._id, name: hospitalObj.name, code: hospitalObj.code } : null,
      doctors,
      specialties,
    });
  } catch (error) { next(error); }
});

// Patient's complete profile
router.get("/profile", async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).lean();
    res.json({ user });
  } catch (error) { next(error); }
});

router.put("/profile", async (req, res, next) => {
  try {
    const { name, email, profile = {}, patient = {}, emergencyContact = {}, insurance = {} } = req.body;
    const set = {};
    if (name) set.name = name;
    if (email) set.email = String(email).toLowerCase();
    if (Object.keys(profile).length) set.profile = { ...(req.user.profile || {}), ...profile };
    if (Object.keys(patient).length) set.patient = { ...(req.user.patient || {}), ...patient };
    if (Object.keys(emergencyContact).length) set.emergencyContact = { ...(req.user.emergencyContact || {}), ...emergencyContact };
    if (Object.keys(insurance).length) set.insurance = { ...(req.user.insurance || {}), ...insurance };
    const p = set.patient;
    if (p && p.heightCm && p.weightKg) {
      const m = p.heightCm / 100;
      p.bmi = Math.round((p.weightKg / (m * m)) * 10) / 10;
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: set }, { new: true, runValidators: true, context: "query" }).lean();
    res.json({ user });
  } catch (error) { next(error); }
});

router.put("/change-password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "Please provide your current password and a new password (at least 8 characters)" });
    }
    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(400).json({ error: "Current password is incorrect" });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (error) { next(error); }
});

// Available booking slots for a doctor on a date
router.get("/doctors/:id/slots", async (req, res, next) => {
  try {
    const hospital = await resolveHospital(req.query.hospital, req.user.hospitalId);
    const scope = hospital ? { hospitalId: hospital._id } : {};
    const doctor = await User.findOne({ ...scope, _id: req.params.id, role: "doctor", active: true });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    const date = req.query.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: "Invalid date" });

    const [start, end] = dayWindow(date);
    const gen = generateDoctorSlots(doctor, start);
    const booked = await Appointment.find({ doctor: doctor._id, scheduledFor: { $gte: start, $lt: end }, status: { $nin: ["cancelled", "missed"] } })
      .select("scheduledFor")
      .lean();
    const bookedSet = new Set(booked.map((b) => b.scheduledFor.getTime()));
    const now = Date.now();
    const slots = gen.minutes
      .map((mins) => { const d = new Date(start); d.setMinutes(mins); return d; })
      .filter((d) => d.getTime() > now && !bookedSet.has(d.getTime()))
      .map((d) => d.toISOString());

    res.json({ date: start.toISOString().slice(0, 10), slots, slotMinutes: gen.slotMinutes, breakMinutes: doctor.profile?.breakMinutes || 0, visitingHours: doctor.profile?.visitingHours || "", hasAvailability: gen.minutes.length > 0 });
  } catch (error) { next(error); }
});

// Book an appointment
router.post("/appointments", async (req, res, next) => {
  try {
    const { doctorId, scheduledFor, reason, symptoms = [], hospital: hospitalInput } = req.body;
    const hospital = await resolveHospital(hospitalInput, req.user.hospitalId);
    const doctor = await User.findOne({ _id: doctorId, role: "doctor", active: true });
    const chosen = new Date(scheduledFor);
    if (!doctor || Number.isNaN(chosen.getTime())) {
      return res.status(400).json({ error: "Choose an available doctor and a valid slot" });
    }

    const targetHospitalId = doctor.hospitalId || (hospital ? hospital._id : req.user.hospitalId);

    const [dayStart] = dayWindow(chosen);
    const gen = generateDoctorSlots(doctor, dayStart);
    const slotMinutes = gen.slotMinutes;
    const slot = new Date(chosen);
    slot.setSeconds(0, 0);
    const snapped = Math.floor((slot.getHours() * 60 + slot.getMinutes()) / slotMinutes) * slotMinutes;
    slot.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);

    if (slot.getTime() <= Date.now()) {
      return res.status(400).json({ error: "Please pick a future slot from the available times" });
    }
    if (!gen.minutes.includes(slot.getHours() * 60 + slot.getMinutes())) {
      return res.status(400).json({ error: `That time is outside Dr. ${doctor.name}'s working hours or falls in a break. Pick an available slot.` });
    }

    const slotEnd = new Date(slot.getTime() + slotMinutes * 60 * 1000);
    const clash = await Appointment.findOne({
      doctor: doctor._id,
      status: { $nin: ["cancelled", "missed"] },
      scheduledFor: { $gte: slot, $lt: slotEnd },
    });
    if (clash) return res.status(409).json({ error: `That ${slotMinutes}-minute slot is already booked. Please choose another time.` });

    const existing = await Appointment.findOne({ patient: req.user._id, doctor: doctor._id, status: { $in: ["requested", "confirmed", "in-progress"] } });
    if (existing) return res.status(400).json({ error: "You already have a pending appointment with this doctor" });

    const appointment = await Appointment.create({
      hospitalId: targetHospitalId,
      patient: req.user._id,
      doctor: doctor._id,
      scheduledFor: slot,
      reason,
      complaint: reason,
      consultationFee: doctor.profile?.consultationFee || 0,
      symptoms: Array.isArray(symptoms) ? symptoms : [],
      status: "confirmed",
    });

    const [start] = dayWindow(slot);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const seq = await Appointment.countDocuments({ doctor: doctor._id, scheduledFor: { $gte: start, $lt: end }, status: { $ne: "cancelled" } });
    appointment.token = `T${String(seq).padStart(2, "0")}`;
    await appointment.save();

    await notify(req.user._id, {
      title: "Appointment confirmed",
      body: `Your appointment with Dr. ${doctor.name} on ${slot.toLocaleString()} is confirmed. Token ${appointment.token}.`,
      type: "appointment",
      entity: "appointment",
      entityId: appointment._id,
    });
    await notify(doctor._id, {
      title: "New appointment",
      body: `A patient booked an appointment at ${slot.toLocaleString()}.`,
      type: "appointment",
      entity: "appointment",
      entityId: appointment._id,
    });
    res.status(201).json({ appointment });
  } catch (error) { next(error); }
});

// Cancel an upcoming appointment
router.patch("/appointments/:id/cancel", async (req, res, next) => {
  try {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, patient: req.user._id, status: { $in: ["requested", "confirmed", "in-progress"] } },
      { $set: { status: "cancelled", cancelledBy: "patient" } },
      { new: true },
    );
    if (!appointment) return res.status(400).json({ error: "Only an upcoming appointment can be cancelled" });
    await notify(appointment.doctor, {
      title: "Appointment cancelled",
      body: "A patient cancelled an appointment.",
      type: "appointment",
      entity: "appointment",
      entityId: appointment._id,
    });
    res.json({ appointment });
  } catch (error) { next(error); }
});

// Patient pays a pending invoice
router.post("/invoices/:id/pay", async (req, res, next) => {
  try {
    const { method = "online" } = req.body;
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, patient: req.user._id, status: "pending" },
      {
        $set: {
          status: "paid",
          paymentMethod: ["cash", "upi", "card", "insurance", "online"].includes(method) ? method : "online",
          paidAt: new Date(),
          paidBy: "patient",
          transactionRef: `TXN-${Date.now()}`,
        },
      },
      { new: true },
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found or already paid" });
    await notify(req.user._id, {
      title: "Payment successful",
      body: `You paid ₹${Math.round(invoice.total)} for ${invoice.invoiceNo}.`,
      type: "payment",
      entity: "invoice",
      entityId: invoice._id,
    });
    res.json({ invoice });
  } catch (error) { next(error); }
});

export default router;
