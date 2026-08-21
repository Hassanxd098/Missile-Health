import { Router } from "express";
import { db, nanoid, audit } from "../models/db.js";
import { requirePatient } from "../middleware/auth.js";
import { send } from "../services/notificationService.js";

const router = Router();
const DEFAULT_TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

function ensureSlots(doctorId, date) {
  const doctor = db.data.doctors.find(d => d.id === doctorId);
  if (!doctor) return [];
  const existing = db.data.slots.filter(s => s.doctorId === doctorId && s.date === date);
  if (existing.length > 0) return existing;
  const created = DEFAULT_TIMES.map(time => ({ id: nanoid(8), doctorId, date, time, capacity: doctor.capacityPerSlot, booked: 0 }));
  db.data.slots.push(...created);
  return created;
}

// FR-05: real-time slot availability for a doctor/date
router.get("/slots", (req, res) => {
  const { doctorId, date } = req.query;
  if (!doctorId || !date) return res.status(400).json({ error: "doctorId and date are required" });
  const slots = ensureSlots(doctorId, date);
  res.json(slots.map(s => ({ ...s, available: s.capacity - s.booked })));
});

// FR-06/FR-07: book — auto-confirm if capacity allows, else mark Pending
router.post("/book", requirePatient, async (req, res) => {
  const { doctorId, date, time, source = "manual_selection" } = req.body;
  if (!doctorId || !date || !time) return res.status(400).json({ error: "doctorId, date, time are required" });

  const slots = ensureSlots(doctorId, date);
  const slot = slots.find(s => s.time === time);
  if (!slot) return res.status(404).json({ error: "Slot no longer exists", alternatives: slots.filter(s => s.capacity - s.booked > 0) });

  const status = slot.booked < slot.capacity ? "confirmed" : "pending";
  if (status === "confirmed") slot.booked += 1;

  const appointment = {
    id: nanoid(10),
    patientId: req.patientId,
    doctorId,
    date, time, status, source,
    createdAt: new Date().toISOString()
  };
  db.data.appointments.push(appointment);
  audit(req.patientId, "appointment_booked", `${status} with ${doctorId} on ${date} ${time}`);
  send(req.patientId, `Your appointment on ${date} at ${time} is ${status}.`);
  await db.write();

  res.status(201).json({
    appointment,
    message: status === "confirmed" ? "Appointment auto-confirmed." : "Slot is at capacity — request marked Pending for admin/doctor review."
  });
});

router.get("/mine", requirePatient, (req, res) => {
  const list = db.data.appointments
    .filter(a => a.patientId === req.patientId)
    .map(a => ({ ...a, doctor: db.data.doctors.find(d => d.id === a.doctorId) }));
  res.json(list);
});

// Admin override queue (FR-07)
router.get("/admin/pending", (req, res) => {
  const list = db.data.appointments
    .filter(a => a.status === "pending")
    .map(a => ({ ...a, doctor: db.data.doctors.find(d => d.id === a.doctorId) }));
  res.json(list);
});

router.post("/admin/:id/override", async (req, res) => {
  const { action, date, time } = req.body; // action: approve | reject | reschedule
  const appt = db.data.appointments.find(a => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });

  if (action === "approve") {
    appt.status = "confirmed";
  } else if (action === "reject") {
    appt.status = "rejected";
  } else if (action === "reschedule") {
    if (!date || !time) return res.status(400).json({ error: "date and time required for reschedule" });
    const slots = ensureSlots(appt.doctorId, date);
    const slot = slots.find(s => s.time === time);
    if (!slot || slot.booked >= slot.capacity) return res.status(409).json({ error: "Target slot unavailable" });
    slot.booked += 1;
    appt.date = date; appt.time = time; appt.status = "confirmed";
  } else {
    return res.status(400).json({ error: "action must be approve, reject, or reschedule" });
  }
  send(appt.patientId, `Your appointment status changed to ${appt.status}.`);
  await db.write();
  res.json({ appointment: appt });
});

export default router;
