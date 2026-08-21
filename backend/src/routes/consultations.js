import { Router } from "express";
import { requireAuth, allowRoles, hospitalScope } from "../middleware/authJwt.js";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import ClinicalNote from "../models/ClinicalNote.js";
import Prescription from "../models/Prescription.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";
import { generatePrescriptionId, generateInvoiceNo } from "../services/idService.js";
import { notify } from "../services/notificationService.js";
import { logAudit } from "../services/auditService.js";

const router = Router();
router.use(requireAuth);

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const GST_RATE = 0.05; // 5% GST applied to medicine value (pharmacy invoice)

// Full patient context the doctor sees — scoped to doctor's hospital.
router.get("/doctor/patients/:patientId", allowRoles("doctor"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const patient = await User.findOne({ ...scope, _id: req.params.patientId })
      .select("name email mobile patientId profile patient emergencyContact insurance active")
      .lean();
    if (!patient || patient.role !== "patient") return res.status(404).json({ error: "Patient not found" });
    const [visits, notes, appointments] = await Promise.all([
      Appointment.find({ ...scope, patient: patient._id }).populate("doctor", "name profile.specialty profile.qualification").sort({ scheduledFor: -1 }).lean(),
      ClinicalNote.find({ ...scope, patient: patient._id, status: "published" }).populate("doctor", "name profile.specialty").sort({ createdAt: -1 }).lean(),
      Appointment.find({ ...scope, patient: patient._id, doctor: req.user._id, status: { $in: ["confirmed", "in-progress", "completed"] } }).sort({ scheduledFor: -1 }).lean(),
    ]);
    res.json({ patient, visits, notes, appointments });
  } catch (error) { next(error); }
});

// Doctor submits a full consultation — scoped to doctor's hospital.
router.put("/doctor/consultations/:appointmentId", allowRoles("doctor"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const appointment = await Appointment.findOne({ ...scope, _id: req.params.appointmentId, doctor: req.user._id, status: { $nin: ["completed", "cancelled", "missed"] } });
    if (!appointment) return res.status(404).json({ error: "Appointment not found or no longer active" });

    const {
      assessment, diagnosis, chiefComplaint, clinicalFindings, advice, followUpDate, labTests = [],
      medicines = [], doctorNotes, doctorSignature, sendToPharmacy = true,
    } = req.body;

    if (!assessment && !diagnosis) return res.status(400).json({ error: "Diagnosis or assessment is required" });

    const norm = (Array.isArray(medicines) ? medicines : []).map((m) => ({
      name: m.name?.trim(),
      morning: Boolean(m.morning),
      afternoon: Boolean(m.afternoon),
      night: Boolean(m.night),
      beforeFood: Boolean(m.beforeFood),
      afterFood: Boolean(m.afterFood),
      dosage: m.dosage || "",
      frequency: m.frequency || "",
      durationDays: Number(m.durationDays) || 0,
      quantity: Number(m.quantity) || 0,
      instructions: m.instructions || "",
    })).filter((m) => m.name);

    const doctor = await User.findById(req.user._id).lean();

    // 1. Clinical note (legacy patient reports source) — scoped to hospital.
    const note = await ClinicalNote.findOneAndUpdate(
      { ...scope, appointment: appointment._id },
      {
        $set: {
          hospitalId: req.user.hospitalId,
          patient: appointment.patient,
          doctor: req.user._id,
          assessment: assessment || diagnosis,
          prescription: norm.map(({ durationDays, ...rest }) => rest),
          status: "published",
          sentToPharmacy: Boolean(sendToPharmacy),
          pharmacyName: sendToPharmacy ? "Main Pharmacy" : "",
          diagnosis: diagnosis || "",
          chiefComplaint: chiefComplaint || "",
          clinicalFindings: clinicalFindings || "",
          advice: advice || "",
          followUpDate: followUpDate ? new Date(followUpDate) : undefined,
          labTests: (Array.isArray(labTests) ? labTests : []).map((t) => String(t).trim()).filter(Boolean),
          doctorNotes: doctorNotes || "",
          doctorSignature: doctorSignature || doctor?.name || "",
          prescribedAt: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    // 2. Formal prescription forwarded to pharmacy — scoped to hospital.
    const prescriptionId = generatePrescriptionId();
    const rx = await Prescription.create({
      hospitalId: req.user.hospitalId,
      prescriptionId,
      appointment: appointment._id,
      patient: appointment.patient,
      doctor: req.user._id,
      diagnosis: diagnosis || assessment || "",
      chiefComplaint: chiefComplaint || "",
      clinicalFindings: clinicalFindings || "",
      advice: advice || "",
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      labTests: (Array.isArray(labTests) ? labTests : []).map((t) => String(t).trim()).filter(Boolean),
      doctorNotes: doctorNotes || "",
      doctorSignature: doctorSignature || doctor?.name || "",
      medicines: norm,
      totalMedicines: norm.length,
      status: sendToPharmacy ? "sent-to-pharmacy" : "new",
      submittedToPharmacyAt: sendToPharmacy ? new Date() : undefined,
    });

    // 3. Mark appointment completed — scoped to hospital.
    await Appointment.updateOne({ ...scope, _id: appointment._id }, { $set: { status: "completed" } });

    // 4. Consultation invoice for the patient — scoped to hospital.
    const fee = money(doctor?.profile?.consultationFee || appointment.consultationFee || 0);
    const opd = money(doctor?.profile?.opdCharges || 0);
    const total = money(fee + opd);
    const invoice = await Invoice.create({
      hospitalId: req.user.hospitalId,
      invoiceNo: generateInvoiceNo(),
      patient: appointment.patient,
      doctor: req.user._id,
      appointment: appointment._id,
      prescription: rx._id,
      type: "consultation",
      consultationFee: fee,
      opdCharges: opd,
      subtotal: total,
      discount: 0,
      gstPercent: 0,
      gstAmount: 0,
      total,
      status: "pending",
    });

    // 5. Notifications — only to same-hospital pharmacy staff.
    await notify(appointment.patient, {
      title: "Prescription ready",
      body: `Your prescription ${rx.prescriptionId} from Dr. ${doctor.name} has been issued.`,
      type: "prescription",
      entity: "prescription",
      entityId: rx._id,
    });
    await notify(appointment.patient, {
      title: "Invoice ready",
      body: `Consultation invoice ${invoice.invoiceNo} for ${money(total)} is pending.`,
      type: "invoice",
      entity: "invoice",
      entityId: invoice._id,
    });
    const pharmacies = await User.find({ ...scope, role: "pharmacy", active: true }).select("_id").lean();
    await Promise.all(pharmacies.map((p) => notify(p._id, {
      title: "New prescription",
      body: `New prescription ${rx.prescriptionId} received from Dr. ${doctor.name}.`,
      type: "prescription",
      entity: "prescription",
      entityId: rx._id,
    })));

    logAudit({ actor: req.user._id, actorRole: "doctor", action: "consultation.submit", entity: "appointment", entityId: appointment._id, meta: { prescription: rx.prescriptionId, invoice: invoice.invoiceNo, hospitalId: req.user.hospitalId } });
    res.status(201).json({ note, prescription: rx, invoice });
  } catch (error) { next(error); }
});

// Prescription detail (doctor / pharmacy / patient) — scoped to hospital.
router.get("/prescriptions/:id", allowRoles("doctor", "pharmacy", "patient", "admin"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const rx = await Prescription.findOne({ ...scope, _id: req.params.id })
      .populate("patient", "name mobile patientId profile patient")
      .populate("doctor", "name profile.specialty profile.qualification profile.registrationNumber profile.licenseNumber")
      .lean();
    if (!rx) return res.status(404).json({ error: "Prescription not found" });
    // Access control: patient can read only their own.
    if (req.user.role === "patient" && String(rx.patient._id) !== String(req.user._id)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json({ prescription: rx });
  } catch (error) { next(error); }
});

// Next queue token for a doctor for a given day — scoped to hospital.
router.get("/doctor/queue/next-token", allowRoles("doctor"), async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const count = await Appointment.countDocuments({ ...scope, doctor: req.user._id, scheduledFor: { $gte: start, $lt: end }, status: { $ne: "cancelled" } });
    res.json({ nextToken: count + 1 });
  } catch (error) { next(error); }
});

export default router;
