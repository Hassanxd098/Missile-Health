import { Router } from "express";
import { db, nanoid, audit } from "../models/db.js";
import { requirePatient } from "../middleware/auth.js";
import { send } from "../services/notificationService.js";

const router = Router();

function suggestSpecialists(specialty, excludeDoctorId) {
  return db.data.doctors.filter(d => d.specialty === specialty && d.verified && d.id !== excludeDoctorId);
}

// FR-12: doctor-initiated referral
router.post("/doctor-refer", async (req, res) => {
  const { appointmentId, fromDoctorId, toSpecialty } = req.body;
  const appt = db.data.appointments.find(a => a.id === appointmentId);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });

  const suggestions = suggestSpecialists(toSpecialty, fromDoctorId);
  const referral = { id: nanoid(10), patientId: appt.patientId, fromDoctorId, toSpecialty, type: "doctor_referral", status: "waiting_for_referral", suggestions: suggestions.map(s => s.id), createdAt: new Date().toISOString() };
  db.data.referrals.push(referral);
  audit(appt.patientId, "referral_created", referral.id);
  await db.write();

  res.status(201).json({
    referral,
    suggestedDoctors: suggestions.length ? suggestions : [],
    note: suggestions.length ? undefined : "No in-network specialist available — flagged for admin-assisted external referral."
  });
});

// FR-13: patient-initiated second opinion
router.post("/second-opinion", requirePatient, async (req, res) => {
  const { specialty, caseNotes } = req.body;
  const suggestions = suggestSpecialists(specialty);
  const referral = {
    id: nanoid(10), patientId: req.patientId, type: "second_opinion", specialty,
    caseNotes, status: "suggested", suggestions: suggestions.map(s => s.id), createdAt: new Date().toISOString()
  };
  db.data.referrals.push(referral);
  await db.write();
  res.status(201).json({ referral, suggestedDoctors: suggestions });
});

// FR-14: patient confirms -> auto-book (re-enters Module 3 logic)
router.post("/:id/confirm", requirePatient, async (req, res) => {
  const { doctorId, date, time } = req.body;
  const referral = db.data.referrals.find(r => r.id === req.params.id);
  if (!referral) return res.status(404).json({ error: "Referral not found" });

  const doctor = db.data.doctors.find(d => d.id === doctorId);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });

  const existing = db.data.slots.find(s => s.doctorId === doctorId && s.date === date && s.time === time);
  const slot = existing || (() => {
    const s = { id: nanoid(8), doctorId, date, time, capacity: doctor.capacityPerSlot, booked: 0 };
    db.data.slots.push(s);
    return s;
  })();

  const status = slot.booked < slot.capacity ? "confirmed" : "pending";
  if (status === "confirmed") slot.booked += 1;

  const appointment = { id: nanoid(10), patientId: req.patientId, doctorId, date, time, status, source: "referral", referralId: referral.id, createdAt: new Date().toISOString() };
  db.data.appointments.push(appointment);
  referral.status = "booked";
  referral.appointmentId = appointment.id;
  send(req.patientId, `Your ${referral.type === "second_opinion" ? "second-opinion" : "referral"} appointment is ${status}.`);
  await db.write();

  res.status(201).json({ referral, appointment });
});

router.get("/mine", requirePatient, (req, res) => {
  res.json(db.data.referrals.filter(r => r.patientId === req.patientId));
});

export default router;
