import { Router } from "express";
import { db, nanoid, audit } from "../models/db.js";
import { requirePatient } from "../middleware/auth.js";
import { structureExaminationNote, structurePrescription } from "../services/aiEngine.js";

const router = Router();

function getOrCreateReport(appointmentId) {
  let report = db.data.visitReports.find(r => r.appointmentId === appointmentId);
  if (!report) {
    const appt = db.data.appointments.find(a => a.id === appointmentId);
    report = { id: nanoid(10), appointmentId, patientId: appt?.patientId, doctorId: appt?.doctorId, findings: null, prescription: [], status: "draft", version: 1, history: [], createdAt: new Date().toISOString() };
    db.data.visitReports.push(report);
  }
  return report;
}

router.post("/:appointmentId/checkin", async (req, res) => {
  const appt = db.data.appointments.find(a => a.id === req.params.appointmentId);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  appt.checkedIn = true;
  await db.write();
  res.json({ appointment: appt });
});

// FR-09: capture examination findings via voice/tablet -> structured
router.post("/:appointmentId/examination", async (req, res) => {
  const { rawText } = req.body;
  if (!rawText) return res.status(400).json({ error: "rawText is required" });
  const report = getOrCreateReport(req.params.appointmentId);
  const structured = structureExaminationNote(rawText);
  if (report.findings) report.history.push({ findings: report.findings, prescription: report.prescription, versionedAt: new Date().toISOString() });
  report.findings = structured;
  report.version += 1;
  await db.write();
  res.json({ report, lowConfidence: structured.lowConfidence });
});

// FR-10: capture prescribed medicines -> structured prescription
router.post("/:appointmentId/prescription", async (req, res) => {
  const { medicines } = req.body; // [{ name, dosage, frequency, durationDays }]
  if (!Array.isArray(medicines) || medicines.length === 0) return res.status(400).json({ error: "medicines array is required" });
  const report = getOrCreateReport(req.params.appointmentId);
  report.prescription = structurePrescription(medicines);
  report.version += 1;
  await db.write();
  res.json({ report });
});

// Business rule: doctor review/approval before it becomes an official record
router.post("/:appointmentId/approve", async (req, res) => {
  const report = db.data.visitReports.find(r => r.appointmentId === req.params.appointmentId);
  if (!report) return res.status(404).json({ error: "Report not found" });
  report.status = "approved";
  report.approvedAt = new Date().toISOString();
  audit(report.patientId, "visit_report_approved", report.id);

  // publish to patient's document repository (feeds Module 7)
  db.data.documents.push({ id: nanoid(8), patientId: report.patientId, type: "examination report", doctorName: db.data.doctors.find(d => d.id === report.doctorId)?.name, date: report.approvedAt.slice(0, 10), refId: report.id });
  if (report.prescription.length) {
    db.data.documents.push({ id: nanoid(8), patientId: report.patientId, type: "prescription", doctorName: db.data.doctors.find(d => d.id === report.doctorId)?.name, date: report.approvedAt.slice(0, 10), refId: report.id });
  }
  await db.write();
  res.json({ report });
});

router.get("/mine", requirePatient, (req, res) => {
  const list = db.data.visitReports.filter(r => r.patientId === req.patientId && r.status === "approved");
  res.json(list);
});

export default router;
