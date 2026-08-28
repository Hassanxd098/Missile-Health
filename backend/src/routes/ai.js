// import { Router } from "express";
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { config } from "../config.js";
// import { requireAuth, allowRoles } from "../middleware/authJwt.js";

// const router = Router();

// const systemPrompt = `
// You are an AI medical documentation assistant.

// Your job is ONLY to convert what the doctor says into structured
// clinical documentation.

// IMPORTANT RULES:
// - Do not invent patient information.
// - Do not invent symptoms.
// - Do not invent vitals.
// - Do not invent medicines.
// - Do not independently diagnose the patient.
// - Do not recommend a medicine that the doctor did not mention.
// - If information was not stated, return an empty string, empty array,
//   false, or null as appropriate.
// - The doctor must review everything before saving.
// - Return ONLY valid JSON.
// `;

// router.post(
//   "/medical-scribe",
//   requireAuth,
//   allowRoles("doctor"),
//   async (req, res, next) => {
//     try {
//       if (!config.geminiApiKey) {
//         return res.status(503).json({
//           error: "Gemini AI is not configured. Add GEMINI_API_KEY to backend/.env",
//         });
//       }

//       const transcript = String(req.body.transcript || "").trim();

//       if (!transcript) {
//         return res.status(400).json({
//           error: "Transcript is required",
//         });
//       }

//       if (transcript.length > 15000) {
//         return res.status(400).json({
//           error: "Transcript is too long",
//         });
//       }

//       const genAI = new GoogleGenerativeAI(config.geminiApiKey);

//       const model = genAI.getGenerativeModel({
//         model: config.geminiModel,
//         systemInstruction: systemPrompt,
//       });

//       const prompt = `
// Convert this doctor's consultation transcript into the following JSON structure.

// TRANSCRIPT:
// ${transcript}

// Return exactly this JSON structure:

// {
//   "diagnosis": "",
//   "clinicalFindings": "",
//   "advice": "",
//   "followUpDate": "",
//   "doctorNotes": "",
//   "labTests": [],
//   "medicines": [
//     {
//       "name": "",
//       "dosage": "",
//       "morning": false,
//       "afternoon": false,
//       "night": false,
//       "beforeFood": false,
//       "afterFood": false,
//       "durationDays": 0,
//       "quantity": 0,
//       "instructions": ""
//     }
//   ]
// }

// Rules for medicines:

// - Only include medicines explicitly mentioned by the doctor.
// - Do not suggest or add medicines.
// - If dosage is not mentioned, use an empty string.
// - If duration is not mentioned, use 0.
// - If quantity is not mentioned, use 0.
// - morning/afternoon/night must only be true if the doctor clearly states it.
// - beforeFood/afterFood must only be true if the doctor clearly states it.

// For followUpDate:
// - Return YYYY-MM-DD only if the doctor gives a specific date.
// - If the doctor only says something like "follow up after 5 days",
//   put that information inside doctorNotes instead and leave followUpDate empty.

// Return JSON only.
// `;

//       const result = await model.generateContent(prompt);

//       const text = result.response.text().trim();

//       // Remove accidental markdown fences.
//       const cleanJson = text
//         .replace(/^```json\s*/i, "")
//         .replace(/^```\s*/i, "")
//         .replace(/\s*```$/i, "")
//         .trim();

//       let parsed;

//       try {
//         parsed = JSON.parse(cleanJson);
//       } catch (parseError) {
//         console.error("Gemini returned invalid JSON:", text);

//         return res.status(502).json({
//           error: "AI returned an invalid consultation format. Please try again.",
//         });
//       }

//       res.json({
//         success: true,
//         data: {
//           diagnosis: parsed.diagnosis || "",
//           clinicalFindings: parsed.clinicalFindings || "",
//           advice: parsed.advice || "",
//           followUpDate: parsed.followUpDate || "",
//           doctorNotes: parsed.doctorNotes || "",
//           labTests: Array.isArray(parsed.labTests)
//             ? parsed.labTests
//             : [],
//           medicines: Array.isArray(parsed.medicines)
//             ? parsed.medicines.map((medicine) => ({
//                 name: medicine.name || "",
//                 dosage: medicine.dosage || "",
//                 morning: Boolean(medicine.morning),
//                 afternoon: Boolean(medicine.afternoon),
//                 night: Boolean(medicine.night),
//                 beforeFood: Boolean(medicine.beforeFood),
//                 afterFood: Boolean(medicine.afterFood),
//                 durationDays: Number(medicine.durationDays) || 0,
//                 quantity: Number(medicine.quantity) || 0,
//                 instructions: medicine.instructions || "",
//               }))
//             : [],
//         },
//       });
//     } catch (error) {
//       console.error("Medical scribe error:", error);
//       next(error);
//     }
//   },
// );

// // Keep your existing support endpoint.
// router.post("/support", requireAuth, async (req, res, next) => {
//   try {
//     const message = String(req.body.message || "").trim();

//     if (!message || message.length > 4000) {
//       return res.status(400).json({
//         error: "A message up to 4,000 characters is required",
//       });
//     }

//     if (!config.geminiApiKey) {
//       return res.status(503).json({
//         error: "AI support is not configured",
//       });
//     }

//     const genAI = new GoogleGenerativeAI(config.geminiApiKey);

//     const model = genAI.getGenerativeModel({
//       model: config.geminiModel,
//       systemInstruction: `
// You are Missile Health's support assistant.
// Provide concise health-navigation information.
// Do not diagnose or prescribe medication.
//       `,
//     });

//     const result = await model.generateContent(
//       `Authenticated user role: ${req.user.role}. User message: ${message}`,
//     );

//     res.json({
//       reply:
//         result.response.text() ||
//         "I couldn't generate a response right now.",
//     });
//   } catch (error) {
//     next(error);
//   }
// });

// export default router;

import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { config } from "../config.js";
import {
  requireAuth,
  allowRoles,
} from "../middleware/authJwt.js";

import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Prescription from "../models/Prescription.js";
import Invoice from "../models/Invoice.js";
import ClinicalNote from "../models/ClinicalNote.js";
import Appointment from "../models/Appointment.js";

const router = Router();

/* =========================================================
   SUPPORT
========================================================= */

const supportPrompt = `
You are Missile Health's support assistant.

Provide concise and empathetic health-navigation information.

Rules:
- Do not diagnose.
- Do not prescribe medication.
- Do not change medication.
- Do not claim clinical certainty.
- For medical decisions, advise the user to contact a licensed clinician.
`;

/* =========================================================
   LIGHTWEIGHT IN-MEMORY RATE LIMITER
========================================================= */

// Small fixed-window limiter used only for the paid Gemini assistant endpoint.
// Keyed by the authenticated user id, so anonymous traffic cannot touch it.
function createRateLimiter({ windowMs = 60_000, limit = 8 }) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const key = String(req.user?._id || req.ip);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });

      if (hits.size > 5000) {
        for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
      }

      return next();
    }

    entry.count += 1;

    if (entry.count > limit) {
      return res.status(429).json({
        success: false,
        error: "You're asking too quickly. Please wait a moment and try again.",
      });
    }

    return next();
  };
}

/* =========================================================
   ROLE-AWARE MISSILE AI SYSTEM PROMPT
========================================================= */

const ASSISTANT_SAFETY_RULES = `
STRICT SAFETY RULES FOR A HEALTHCARE PLATFORM:

- You are a platform navigation assistant, NOT a doctor.
- NEVER diagnose diseases or conditions.
- NEVER prescribe medicines.
- NEVER recommend medication dosage or change a doctor's prescription.
- NEVER invent patient information, symptoms, vitals, or medical records.
- NEVER expose private healthcare information unless the authenticated user is authorized to access it.
- NEVER reveal another user's data, prescriptions, bills, or records.
- NEVER reveal secrets: passwords, OTPs, API keys, JWT tokens, payment credentials, UPI PIN, CVV, or card numbers.
- NEVER request secrets from the user.
- If a user asks for sensitive patient information you cannot verify they own, tell them the data is protected and advise contacting the hospital.
- If a user asks a medical question that requires professional judgment, clearly state you are an AI platform assistant — not a replacement for a licensed doctor — and recommend consulting a qualified healthcare professional.
- Answer only according to the authenticated user's role.
- Keep answers concise, friendly, professional, and practical.
- When explaining Missile Health features, give clear step-by-step instructions.
`;

const roleContext = {
  patient: {
    label: "patient",
    features: `
The user is a PATIENT inside Missile Health.

Helpful platform areas:
- Dashboard: /app/patient
- My Profile: /app/patient/profile
- Appointments: /app/patient/appointments — book a new appointment, view upcoming/status, see the assigned token
- Prescriptions: /app/patient/prescriptions — view issued prescriptions
- Bills & Payments: /app/patient/bills — consultation fee, medicine bills, invoice status, payment modes
- Appointments are booked with an available doctor from a slot grid; a token is issued on confirmation.
- Consultation workflow: the doctor conducts the visit, writes the prescription, and it is forwarded to the pharmacy.
- Pharmacy: the pharmacy prepares medicines from the prescription; the patient pays against the generated bill.

Useful detail for answers:
- Booking: pick a doctor → pick a free time slot → confirm. A future slot is required.
- Token: shown on the appointment; queue vs consultation uses the token.
- Prescriptions become visible after the doctor approves the consultation.
- Bills are generated for the consultation fee and medicine totals (5% GST).`,
  },

  doctor: {
    label: "doctor",
    features: `
The user is a DOCTOR inside Missile Health.

Helpful platform areas:
- Today & Queue dashboard: /app/doctor — today's patient queue, start or continue consultations
- Consultation: /app/doctor/consult/:appointmentId → full consultation form with vitals, clinical findings, diagnosis, advice, lab tests, doctor notes and the Smart Prescription (medicines with dosage, frequency, duration, timing).
- AI Medical Scribe: from the consultation screen, the doctor dictates or pastes a transcript and clicks "Process with Gemini". Gemini structures it into editable clinical fields (reason/chief complaint, diagnosis, clinical findings, advice, lab tests, medicines, follow-up). The doctor must review every field before approving. It never invents data.
- My Prescriptions: /app/doctor/prescriptions — ledger of prescriptions the doctor issued.
- On approval ("Approve & complete") the consultation is published, the prescription is forwarded to the pharmacy (sendToPharmacy), the appointment is completed, and the patient gets a consultation invoice.
- Queue controls: mark status, delay queue.

Useful detail for answers:
- The AI Medical Scribe is a documentation assistant only; the doctor remains responsible for the final record.
- A prescription is forwarded to pharmacy when the doctor submits the consultation with "forward to pharmacy" enabled.`,
  },

  pharmacy: {
    label: "pharmacy",
    features: `
The user is a PHARMACY staff member inside Missile Health.

Helpful platform areas:
- Prescriptions dashboard: /app/pharmacy — incoming prescriptions ("sent-to-pharmacy") with statuses: new → sent-to-pharmacy → preparing → ready → delivered → dispensed
- Invoices & Billing: /app/pharmacy/invoices — consultation and medicine invoices, create/complete medicine bills, mark cash payments, payment modes
- Prescriptions arrive automatically when a doctor completes a consultation and forwards them to the pharmacy.
- Payment workflow: patient pays the medicine invoice; the pharmacist marks the payment mode (e.g. cash) and completes the bill.

Useful detail for answers:
- Process a prescription by moving its status forward (prepare the medicines, mark ready, hand over, dispense).
- Bills include consultation fee and medicine cost with 5% GST applied on the medicine value.`,
  },

  admin: {
    label: "admin",
    features: `
The user is an ADMIN (hospital admin) inside Missile Health.

Helpful platform areas:
- Dashboard: /app/admin (analytics, revenue, doctors, patients, pharmacy, appointments)
- Appointments: /app/admin/appointments — manage and confirm/cancel appointments
- Patients: /app/admin/patients — manage patients and their status
- Staff / Employees: /app/admin/employees — manage doctors, nurses, reception, management, security, other staff, pharmacy staff
- Pharmacy Staff: /app/admin/pharmacy
- Attendance: /app/admin/attendance
- Reports & Revenue: /app/admin/reports — patient growth, appointments, prescriptions, revenue by type, top doctors, payments

Useful detail for answers:
- Register a doctor by creating a staff record with role "doctor" and their profile (specialty, consultation fee, working hours/availability).
- The system seeds hospital admins, legacy admins and a default hospital.`,
  },

  hospital_admin: {
    label: "hospital admin",
    features: `
The user is a HOSPITAL ADMIN inside Missile Health.

Helpful platform areas (under /app/hospital):
- Dashboard: /app/hospital/dashboard
- Appointments: /app/hospital/appointments
- Patients: /app/hospital/patients
- Staff / Employees: /app/hospital/employees, doctors, nurses, reception, management, security, other staff, pharmacy staff
- Attendance: /app/hospital/attendance
- Reports & Revenue: /app/hospital/reports`,
  },
};

/* =========================================================
   LIVE RAG CONTEXT RETRIEVAL (HOSPITAL & ROLE SCOPED)
========================================================= */

async function buildHospitalRAGContext(user) {
  if (!user) return "";

  const role = user.role;
  const userId = user._id;
  const hospitalId = user.hospitalId;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  let hospitalName = "Missile Health Platform";
  let registeredHospitals = [];
  try {
    registeredHospitals = await Hospital.find({ status: { $ne: "inactive" } }).select("name code city state").lean();
    if (hospitalId) {
      const hosp = registeredHospitals.find((h) => String(h._id) === String(hospitalId));
      if (hosp) hospitalName = `${hosp.name}${hosp.city ? ` (${hosp.city})` : ""}`;
    }
  } catch {
    // Fallback
  }

  let ragContext = `\n=== LIVE REAL-TIME DATABASE CONTEXT (RAG) ===\nCurrent User Hospital: ${hospitalName}\nUser Name: ${user.name || "User"}\nUser Role: ${role ? role.toUpperCase() : "UNKNOWN"}\nToday's Date: ${todayStart.toISOString().slice(0, 10)}\n\n`;

  if (registeredHospitals.length) {
    ragContext += `REGISTERED HOSPITALS IN PLATFORM (${registeredHospitals.length}):\n`;
    registeredHospitals.forEach((h, idx) => {
      ragContext += `${idx + 1}. ${h.name}${h.city ? ` (${h.city})` : ""} | Code: ${h.code || "N/A"}\n`;
    });
    ragContext += `\n`;
  }

  try {
    if (role === "doctor") {
      const [doctorProfile, todayAppts] = await Promise.all([
        User.findById(userId).select("name profile hospitalId").lean(),
        Appointment.find({ doctor: userId, scheduledFor: { $gte: todayStart, $lt: todayEnd } })
          .populate("patient", "name patientId mobile profile.age profile.gender")
          .sort({ scheduledFor: 1 })
          .lean(),
      ]);

      const confirmedWaiting = todayAppts.filter((a) => a.status === "confirmed");
      const inProgress = todayAppts.filter((a) => a.status === "in-progress");
      const completedToday = todayAppts.filter((a) => a.status === "completed");

      ragContext += `DOCTOR PROFILE:\n- Name: Dr. ${doctorProfile?.name || user.name}\n- Specialty: ${doctorProfile?.profile?.specialty || "Specialist"}\n- Fee: ₹${doctorProfile?.profile?.consultationFee || 0}\n- Hours: ${doctorProfile?.profile?.visitingHours || "OPD Hours"}\n\n`;

      ragContext += `DOCTOR'S TODAY APPOINTMENT SUMMARY:\n`;
      ragContext += `- Total Appointments Scheduled Today: ${todayAppts.length}\n`;
      ragContext += `- Patients Currently Waiting / Confirmed: ${confirmedWaiting.length}\n`;
      ragContext += `- Consultations Currently In-Progress: ${inProgress.length}\n`;
      ragContext += `- Consultations Completed Today: ${completedToday.length}\n\n`;

      ragContext += `DETAILED PATIENT QUEUE FOR DR. ${doctorProfile?.name || user.name} TODAY:\n`;
      if (todayAppts.length) {
        todayAppts.forEach((a, idx) => {
          const pt = a.patient || {};
          const timeStr = new Date(a.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          ragContext += `${idx + 1}. Token ${a.token || "T" + (idx + 1)}: ${pt.name || "Patient"} (ID: ${pt.patientId || "PAT-N/A"}) | Scheduled Time: ${timeStr} | Status: ${a.status.toUpperCase()} | Reason: ${a.reason || a.complaint || "Routine visit"}\n`;
        });
      } else {
        ragContext += `No patients are scheduled for Dr. ${doctorProfile?.name || user.name} today.\n`;
      }

    } else if (role === "patient") {
      const scope = (hospitalId && String(hospitalId).length > 5) ? { hospitalId } : {};

      let [patientUser, upcomingAppts, availableDoctors, recentRx, pendingBills] = await Promise.all([
        User.findById(userId).select("name patientId profile patient emergencyContact insurance").lean(),
        Appointment.find({ patient: userId, scheduledFor: { $gte: todayStart } })
          .populate("doctor", "name profile.specialty profile.location profile.consultationFee")
          .sort({ scheduledFor: 1 })
          .lean(),
        User.find({ ...scope, role: "doctor", active: true })
          .select("name profile.specialty profile.consultationFee profile.visitingHours profile.location profile.availableToday hospitalId")
          .populate("hospitalId", "name code city state")
          .sort({ name: 1 })
          .lean(),
        Prescription.find({ patient: userId }).populate("doctor", "name").sort({ createdAt: -1 }).limit(5).lean(),
        Invoice.find({ patient: userId, status: "pending" }).lean(),
      ]);

      // Fallback: If no doctors found with hospitalId filter, fetch all active doctors
      if (!availableDoctors || !availableDoctors.length) {
        availableDoctors = await User.find({ role: "doctor", active: true })
          .select("name profile.specialty profile.consultationFee profile.visitingHours profile.location profile.availableToday hospitalId")
          .populate("hospitalId", "name code city state")
          .sort({ name: 1 })
          .lean();
      }

      ragContext += `PATIENT ACCOUNT:\n- Name: ${patientUser?.name || user.name}\n- Patient ID: ${patientUser?.patientId || "PAT-N/A"}\n\n`;

      ragContext += `PATIENT'S UPCOMING APPOINTMENTS:\n`;
      if (upcomingAppts.length) {
        upcomingAppts.forEach((a, idx) => {
          const doc = a.doctor || {};
          const dateStr = new Date(a.scheduledFor).toLocaleString();
          ragContext += `${idx + 1}. Dr. ${doc.name || "Doctor"} (${doc.profile?.specialty || "Specialist"}) | Date: ${dateStr} | Token: ${a.token || "N/A"} | Status: ${a.status.toUpperCase()} | Reason: ${a.reason || "Routine visit"}\n`;
        });
      } else {
        ragContext += `You have no upcoming appointments scheduled.\n`;
      }

      ragContext += `\nAVAILABLE DOCTORS ACROSS HOSPITALS (${availableDoctors.length} active doctors registered):\n`;
      if (availableDoctors && availableDoctors.length) {
        availableDoctors.forEach((d, idx) => {
          const spec = d.profile?.specialty || "General Physician";
          const fee = d.profile?.consultationFee || 0;
          const hours = d.profile?.visitingHours || "Available during OPD hours";
          const hospName = d.hospitalId?.name || hospitalName;
          const hospCity = d.hospitalId?.city ? ` (${d.hospitalId.city})` : "";
          ragContext += `${idx + 1}. Dr. ${d.name} | Specialty: ${spec} | Hospital: ${hospName}${hospCity} | Consultation Fee: ₹${fee} | Visiting/Working Hours: ${hours} | Status: Available Today\n`;
        });
      } else {
        ragContext += `No active doctors are listed in the database.\n`;
      }

      const totalPendingAmount = pendingBills.reduce((s, b) => s + (b.total || 0), 0);
      ragContext += `\nBILLING & PRESCRIPTIONS SUMMARY:\n- Pending Unpaid Bills: ${pendingBills.length} bill(s) (Total Amount Due: ₹${totalPendingAmount})\n- Prescriptions on file: ${recentRx.length} recent prescription(s)\n`;

    } else if (role === "admin" || role === "hospital_admin") {
      const scope = hospitalId ? { hospitalId } : {};

      const [doctorsList, patientsCount, todayAppts, pendingInvoices] = await Promise.all([
        User.find({ ...scope, role: "doctor", active: true }).select("name profile.specialty profile.consultationFee profile.visitingHours").lean(),
        User.countDocuments({ ...scope, role: "patient" }),
        Appointment.find({ ...scope, scheduledFor: { $gte: todayStart, $lt: todayEnd } }).select("doctor status consultationFee").lean(),
        Invoice.find({ ...scope, status: "pending" }).select("total").lean(),
      ]);

      const completedToday = todayAppts.filter((a) => a.status === "completed").length;
      const cancelledToday = todayAppts.filter((a) => a.status === "cancelled").length;
      const revenueToday = todayAppts.filter((a) => a.status === "completed").reduce((s, a) => s + (a.consultationFee || 0), 0);
      const pendingRevenue = pendingInvoices.reduce((s, i) => s + (i.total || 0), 0);

      ragContext += `HOSPITAL ADMINISTRATIVE OVERVIEW:\n`;
      ragContext += `- Active Doctors: ${doctorsList.length}\n`;
      ragContext += `- Registered Patients: ${patientsCount}\n`;
      ragContext += `- Today's Total Appointments: ${todayAppts.length} (Completed: ${completedToday}, Cancelled: ${cancelledToday})\n`;
      ragContext += `- Revenue Collected Today: ₹${revenueToday}\n`;
      ragContext += `- Pending Invoice Collections: ${pendingInvoices.length} bill(s) (₹${pendingRevenue})\n\n`;

      ragContext += `ACTIVE DOCTORS DIRECTORY:\n`;
      doctorsList.forEach((d, idx) => {
        const docTodayCount = todayAppts.filter((a) => String(a.doctor) === String(d._id)).length;
        ragContext += `${idx + 1}. Dr. ${d.name} (${d.profile?.specialty || "Specialist"}) | Fee: ₹${d.profile?.consultationFee || 0} | Hours: ${d.profile?.visitingHours || "OPD"} | Today's Bookings: ${docTodayCount}\n`;
      });

    } else if (role === "reception") {
      const scope = hospitalId ? { hospitalId } : {};

      const [doctorsList, todayAppts] = await Promise.all([
        User.find({ ...scope, role: "doctor", active: true }).select("name profile.specialty profile.consultationFee profile.visitingHours").lean(),
        Appointment.find({ ...scope, scheduledFor: { $gte: todayStart, $lt: todayEnd } }).populate("patient", "name patientId").populate("doctor", "name").lean(),
      ]);

      ragContext += `RECEPTION DESK OVERVIEW:\n`;
      ragContext += `- Total Appointments Scheduled Today: ${todayAppts.length}\n`;
      ragContext += `- Available Doctors Today: ${doctorsList.length}\n\n`;
      ragContext += `TODAY'S APPOINTMENT QUEUE:\n`;
      todayAppts.forEach((a, idx) => {
        ragContext += `${idx + 1}. Token ${a.token || "T" + (idx + 1)}: Patient ${a.patient?.name || "Patient"} (Dr. ${a.doctor?.name || "Doctor"}) | Status: ${a.status.toUpperCase()}\n`;
      });

    } else if (role === "pharmacy") {
      const scope = hospitalId ? { hospitalId } : {};

      const [pendingRx, pendingInv] = await Promise.all([
        Prescription.find({ ...scope, status: { $in: ["sent-to-pharmacy", "preparing"] } }).populate("patient", "name patientId").populate("doctor", "name").lean(),
        Invoice.find({ ...scope, status: "pending", type: "pharmacy" }).populate("patient", "name").lean(),
      ]);

      ragContext += `PHARMACY QUEUE OVERVIEW:\n`;
      ragContext += `- Pending Prescriptions To Process: ${pendingRx.length}\n`;
      ragContext += `- Pending Medicine Invoices: ${pendingInv.length}\n\n`;
      if (pendingRx.length) {
        ragContext += `PENDING PRESCRIPTIONS LIST:\n`;
        pendingRx.forEach((rx, idx) => {
          ragContext += `${idx + 1}. Rx ID ${rx.prescriptionId || rx._id} | Patient: ${rx.patient?.name || "Patient"} | Dr. ${rx.doctor?.name || "Doctor"} | Status: ${rx.status.toUpperCase()}\n`;
        });
      }
    }

    ragContext += `=================================================\n`;
    return ragContext;
  } catch (err) {
    console.error("RAG context retrieval error:", err);
    return `\n=== LIVE REAL-TIME DATABASE CONTEXT (RAG) ===\nHospital: ${hospitalName}\nUser Role: ${role}\nContext retrieval fallback.\n=================================================\n`;
  }
}

function buildAssistantSystemPrompt(user, ragContext = "") {
  const role = user?.role || "patient";
  const ctx = roleContext[role] || roleContext.patient;

  return `You are Missile AI, the intelligent, hospital-grounded assistant for Missile Health.

Assisting Authenticated User: ${user?.name || "User"}
User's Role: ${ctx.label.toUpperCase()}

MULTI-HOSPITAL & DOCTOR SEARCH INSTRUCTIONS:
- Missile Health is a multi-hospital healthcare platform managing multiple hospitals (including Shifa Clinic Hospital, Missile Health Hospital, and all hospitals listed in the RAG context).
- ALL HOSPITALS AND DOCTORS LISTED IN THE LIVE DATABASE CONTEXT BELOW ARE PART OF THIS SYSTEM.
- NEVER state "I do not have access to records for [Hospital Name]" or "I am integrated exclusively with [One Hospital]". You HAVE full access to all registered hospitals and doctors listed in the context below.
- When a user asks about doctors at ANY hospital (e.g. "Shifa Clinic", "Shifa Clinic Hospital", "Missile Health Hospital", etc.):
  1. Inspect the "AVAILABLE DOCTORS ACROSS HOSPITALS" and "REGISTERED HOSPITALS" in the context below.
  2. Match the requested hospital name or specialty (e.g. "Shifa Clinic Hospital" matches doctors whose hospital is Shifa Clinic Hospital).
  3. List the EXACT Doctor Names (e.g. Dr. [Name]), Specialty, Hospital Name, Consultation Fee (e.g. ₹180 or ₹500), and exact Visiting Hours.
  4. Note: "General Physician", "General Medicine", "General Doctor", "Internal Medicine", and default doctors are all General Doctors.
  5. If the user asks for doctors at a specific hospital (e.g. Shifa Clinic Hospital), filter and show the doctors for that specific hospital first.

STRICT HOSPITAL DOMAIN BOUNDARY & RAG GROUNDING RULES:
1. YOU ARE AN EXCLUSIVE HEALTHCARE AND HOSPITAL ASSISTANT FOR MISSILE HEALTH.
2. YOU MUST ONLY ANSWER QUESTIONS RELATED TO HOSPITALS, CLINICAL CARE, PATIENT RECORDS, DOCTOR SCHEDULES, APPOINTMENTS, PRESCRIPTIONS, PHARMACY, BILLING, AND PLATFORM NAVIGATION.
3. DO NOT ANSWER QUESTIONS UNRELATED TO HOSPITALS OR HEALTHCARE (e.g. general sports, movies, gaming, world politics, general non-medical trivia, programming tutorials outside health).
   - IF ASKED AN UNRELATED NON-HOSPITAL QUESTION, RESPOND POLITELY:
     "I am Missile AI, specialized exclusively in hospital management, patient care, and clinical workflows for your hospital. I cannot answer questions outside the healthcare and hospital domain. How can I assist you with your appointments, patients, or hospital records?"
4. GROUND YOUR ANSWERS STRICTLY IN THE LIVE REAL-TIME DATABASE CONTEXT (RAG) PROVIDED BELOW.
   - For a Doctor: Answer questions about patients, appointments, and waiting queue using ONLY the doctor's specific queue data in the context block below. DO NOT make up patients or appointments that are not in the context.
   - For a Patient: Answer questions about available doctors, appointments, prescriptions, and bills using ONLY the patient's context block below.
   - For an Admin/Reception/Pharmacy: Use ONLY the live context data provided.
   - Never invent or hallucinate data that is not present in the live context block.

${ctx.features}

${ASSISTANT_SAFETY_RULES}

${ragContext}

Provide concise, friendly, and precise answers strictly based on the live context above.`;
}

/* =========================================================
   MEDICAL SCRIBE PROMPT
========================================================= */

const scribePrompt = `
You are an AI Medical Documentation Assistant for a doctor.

Your ONLY job is to convert the doctor's consultation transcript
into structured clinical documentation.

STRICT RULES:

1. Never invent patient information.
2. Never invent symptoms.
3. Never invent vitals.
4. Never invent diagnoses.
5. Never invent medicines.
6. Never invent dosage.
7. Never invent duration.
8. Never recommend medicines.
9. Never change medicines.
10. Only use information explicitly stated in the transcript.
11. If something was not mentioned, return an empty value.
12. The doctor must review everything before saving.
13. Return ONLY JSON.
14. Do not return markdown.
15. Do not explain anything outside JSON.
16. Do not infer a diagnosis from symptoms.
17. A diagnosis can only be added if the doctor explicitly states it.

Return exactly:

{
  "chiefComplaint": "",
  "diagnosis": "",
  "clinicalFindings": "",
  "advice": "",
  "doctorNotes": "",
  "followUpDate": "",
  "followUpInstruction": "",
  "labTests": [],
  "medicines": [
    {
      "name": "",
      "dosage": "",
      "frequency": "",
      "morning": false,
      "afternoon": false,
      "night": false,
      "beforeFood": false,
      "afterFood": false,
      "durationDays": 0,
      "quantity": 0,
      "instructions": ""
    }
  ]
}

Medicine rules:

- Only include medicines explicitly mentioned by the doctor.
- Never create a medicine.
- Never guess dosage.
- Never guess duration.
- Never guess frequency.
- Only mark morning/afternoon/night when explicitly stated.
- Only mark beforeFood/afterFood when explicitly stated.

Follow-up rules:

- If an exact calendar date is spoken, use YYYY-MM-DD.
- If the doctor says "follow up after 5 days", leave followUpDate empty.
- Put relative follow-up instructions into followUpInstruction.
`;

/* =========================================================
   JSON CLEANER
========================================================= */

function parseGeminiJson(text) {
  let cleaned = String(text || "").trim();

  cleaned = cleaned
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace =
      cleaned.indexOf("{");

    const lastBrace =
      cleaned.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1 ||
      lastBrace <= firstBrace
    ) {
      throw new Error(
        "Gemini did not return valid JSON",
      );
    }

    return JSON.parse(
      cleaned.slice(
        firstBrace,
        lastBrace + 1,
      ),
    );
  }
}

/* =========================================================
   NORMALIZE AI RESPONSE
========================================================= */

function normalizeDraft(raw = {}) {
  const medicines =
    Array.isArray(raw.medicines)
      ? raw.medicines
      : [];

  return {
    chiefComplaint:
      String(
        raw.chiefComplaint || "",
      ).trim(),

    diagnosis:
      String(
        raw.diagnosis || "",
      ).trim(),

    clinicalFindings:
      String(
        raw.clinicalFindings || "",
      ).trim(),

    advice:
      String(
        raw.advice || "",
      ).trim(),

    doctorNotes:
      String(
        raw.doctorNotes || "",
      ).trim(),

    followUpDate:
      raw.followUpDate
        ? String(
            raw.followUpDate,
          ).slice(0, 10)
        : "",

    followUpInstruction:
      String(
        raw.followUpInstruction ||
          "",
      ).trim(),

    labTests:
      Array.isArray(
        raw.labTests,
      )
        ? raw.labTests
            .map((item) =>
              String(
                item || "",
              ).trim(),
            )
            .filter(Boolean)
        : [],

    medicines:
      medicines
        .map((medicine) => ({
          name:
            String(
              medicine?.name ||
                "",
            ).trim(),

          dosage:
            String(
              medicine?.dosage ||
                "",
            ).trim(),

          frequency:
            String(
              medicine?.frequency ||
                "",
            ).trim(),

          morning:
            medicine?.morning ===
            true,

          afternoon:
            medicine?.afternoon ===
            true,

          night:
            medicine?.night ===
            true,

          beforeFood:
            medicine?.beforeFood ===
            true,

          afterFood:
            medicine?.afterFood ===
            true,

          durationDays:
            Number(
              medicine?.durationDays,
            ) || 0,

          quantity:
            Number(
              medicine?.quantity,
            ) || 0,

          instructions:
            String(
              medicine?.instructions ||
                "",
            ).trim(),
        }))
        .filter(
          (medicine) =>
            medicine.name,
        ),
  };
}

/* =========================================================
   AI MEDICAL SCRIBE
========================================================= */

router.post(
  "/medical-scribe",
  requireAuth,
  allowRoles("doctor"),
  async (req, res, next) => {
    try {
      /* -----------------------------------------------------
         CHECK GEMINI KEY
      ----------------------------------------------------- */

      if (!config.geminiApiKey) {
        return res.status(503).json({
          success: false,
          error:
            "Gemini AI is not configured. Please check GEMINI_API_KEY in backend/.env",
        });
      }

      /* -----------------------------------------------------
         INPUT
      ----------------------------------------------------- */

      const transcript =
        String(
          req.body.transcript ||
            "",
        ).trim();

      const appointmentId =
        String(
          req.body.appointmentId ||
            "",
        ).trim();

      if (transcript.length < 5) {
        return res.status(400).json({
          success: false,
          error:
            "Please provide a valid consultation transcript.",
        });
      }

      if (transcript.length > 12000) {
        return res.status(400).json({
          success: false,
          error:
            "Transcript is too long. Please process a shorter consultation.",
        });
      }

      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          error:
            "Appointment ID is required.",
        });
      }

      /* -----------------------------------------------------
         VERIFY APPOINTMENT
      ----------------------------------------------------- */

      const appointment =
        await Appointment.findOne({
          _id: appointmentId,

          doctor: req.user._id,

          hospitalId:
            req.user.hospitalId,

          status: {
            $nin: [
              "completed",
              "cancelled",
              "missed",
            ],
          },
        })
          .populate(
            "patient",
            "name patientId profile",
          )
          .lean();

      if (!appointment) {
        return res.status(404).json({
          success: false,
          error:
            "Appointment not found or no longer active.",
        });
      }

      /* -----------------------------------------------------
         GEMINI
      ----------------------------------------------------- */

      const genAI =
        new GoogleGenerativeAI(
          config.geminiApiKey,
        );

      const model =
        genAI.getGenerativeModel({
          model:
            config.geminiModel,

          systemInstruction:
            scribePrompt,

          generationConfig: {
            temperature: 0.1,

            responseMimeType:
              "application/json",
          },
        });

      /* -----------------------------------------------------
         PROMPT
      ----------------------------------------------------- */

      const prompt = `
Create a structured consultation draft from this doctor's transcript.

Do NOT guess or invent anything.

TRANSCRIPT:

${transcript}

Return ONLY the JSON structure requested by the system instructions.
`;

      /* -----------------------------------------------------
         GEMINI REQUEST
      ----------------------------------------------------- */

      const result =
        await model.generateContent(
          prompt,
        );

      const response =
        result.response;

      const text =
        response
          .text()
          .trim();

      if (!text) {
        return res.status(502).json({
          success: false,
          error:
            "Gemini returned an empty response.",
        });
      }

      console.log(
        "Gemini medical scribe response:",
        text,
      );

      /* -----------------------------------------------------
         PARSE JSON
      ----------------------------------------------------- */

      let raw;

      try {
        raw =
          parseGeminiJson(text);
      } catch (parseError) {
        console.error(
          "Gemini JSON parsing failed:",
          parseError,
        );

        return res.status(502).json({
          success: false,
          error:
            "Gemini returned an invalid consultation format. Please try again.",
        });
      }

      /* -----------------------------------------------------
         NORMALIZE
      ----------------------------------------------------- */

      const draft =
        normalizeDraft(raw);

      /* -----------------------------------------------------
         RETURN EXACT SHAPE EXPECTED BY FRONTEND
      ----------------------------------------------------- */

      return res.json({
        success: true,

        data: draft,

        message:
          "AI consultation draft generated successfully.",

        safety:
          "AI-generated content must be reviewed and approved by the doctor before submission.",
      });
    } catch (error) {
      console.error(
        "Medical scribe error:",
        error,
      );

      return res.status(500).json({
        success: false,

        error:
          error?.message ||
          "Gemini could not process the consultation.",
      });
    }
  },
);

/* =========================================================
   SUPPORT
========================================================= */

router.post(
  "/support",
  requireAuth,
  async (req, res, next) => {
    try {
      const message =
        String(
          req.body.message ||
            "",
        ).trim();

      if (
        !message ||
        message.length > 4000
      ) {
        return res.status(400).json({
          error:
            "A message up to 4,000 characters is required",
        });
      }

      if (!config.geminiApiKey) {
        return res.status(503).json({
          error:
            "AI support is not configured",
        });
      }

      const genAI =
        new GoogleGenerativeAI(
          config.geminiApiKey,
        );

      const model =
        genAI.getGenerativeModel({
          model:
            config.geminiModel,

          systemInstruction:
            supportPrompt,
        });

      const result =
        await model.generateContent(
          `User message: ${message}`,
        );

      return res.json({
        reply:
          result.response.text() ||
          "I couldn't generate a response right now.",
      });
    } catch (error) {
      next(error);
    }
  },
);

/* =========================================================
   GEMINI ERROR CLASSIFICATION
========================================================= */

// Free-tier Gemini models intermittently return 503 (overloaded /
// high demand). Those usually recover within seconds, so we retry
// a few times with backoff. A 429 quota-exhaustion error, however,
// does NOT recover within seconds — retrying only wastes the user's
// time, so we surface it immediately with a clear message.
const TRANSIENT_STATUS_CODES = new Set([500, 502, 503, 504]);
const TRANSIENT_ERROR_HINTS =
  /UNAVAILABLE|high demand|overloaded|server error/i;
const QUOTA_ERROR_HINTS =
  /quota|RATE_LIMIT|RESOURCE_EXHAUSTED|Too Many Requests|limit/i;

function classifyGeminiError(error) {
  if (!error) return "unknown";

  const status = Number(
    error.status ||
      error?.response?.status ||
      error?.response?.data?.error?.status ||
      0,
  );

  if (status === 429) return "quota";

  const message = String(
    error.message ||
      error?.response?.data?.error?.message ||
      "",
  );

  if (QUOTA_ERROR_HINTS.test(message)) return "quota";

  if (TRANSIENT_STATUS_CODES.has(status)) return "transient";

  if (TRANSIENT_ERROR_HINTS.test(message)) return "transient";

  return "unknown";
}

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function withGeminiRetry(task, options = {}) {
  const { attempts = 4, delayMs = 1000, backoff = 1.8 } = options;

  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      // Quota errors won't recover within seconds — fail fast.
      if (classifyGeminiError(error) === "quota") {
        throw error;
      }

      if (attempt === attempts) {
        throw error;
      }

      await sleep(delayMs * Math.pow(backoff, attempt - 1));
    }
  }

  throw lastError;
}

/* =========================================================
   DASHBOARD MISSILE AI ASSISTANT
========================================================= */

const assistantRateLimit =
  createRateLimiter({
    windowMs: 60_000,
    limit: 8,
  });

router.post(
  "/dashboard-assistant",
  requireAuth,
  assistantRateLimit,
  async (req, res) => {
    try {
      if (!config.geminiApiKey) {
        return res.status(503).json({
          success: false,
          error:
            "AI assistant is not configured yet.",
        });
      }

      /* -----------------------------------------------------
         INPUT
      ----------------------------------------------------- */

      const message =
        String(
          req.body.message || "",
        ).trim();

      if (!message) {
        return res.status(400).json({
          success: false,
          error:
            "Message is required.",
        });
      }

      if (message.length > 2000) {
        return res.status(400).json({
          success: false,
          error:
            "Message is too long. Please shorten it and try again.",
        });
      }

      /*
       * Accept a small, bounded conversation so follow-up
       * questions have context. Never accept unbounded history.
       */
      const rawHistory = Array.isArray(
        req.body.history,
      )
        ? req.body.history
        : [];

      const history = rawHistory
        .slice(-8)
        .map((turn) => {
          const text = String(
            turn?.content || "",
          )
            .trim()
            .slice(0, 4000);

          if (!text) return null;

          const role =
            turn?.role === "assistant"
              ? "model"
              : "user";

          return {
            role,
            parts: [{ text }],
          };
        })
        .filter(Boolean);

      /* -----------------------------------------------------
         ROLE-AWARE & RAG GROUNDED SYSTEM PROMPT
      ----------------------------------------------------- */

      const ragContext = await buildHospitalRAGContext(req.user);

      const genAI =
        new GoogleGenerativeAI(
          config.geminiApiKey,
        );

      const model =
        genAI.getGenerativeModel({
          model: config.geminiModel,

          systemInstruction:
            buildAssistantSystemPrompt(
              req.user,
              ragContext,
            ),

          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1000,
          },
        });

      /* -----------------------------------------------------
         GEMINI
      ----------------------------------------------------- */

      const chat =
        model.startChat({
          history,
        });

      const result =
        await withGeminiRetry(
          () => chat.sendMessage(message),
          {
            attempts: 4,
            delayMs: 1000,
            backoff: 1.8,
          },
        );

      const reply =
        result.response
          .text()
          .trim();

      if (!reply) {
        return res.status(502).json({
          success: false,
          error:
            "The assistant returned an empty response. Please try again.",
        });
      }

      return res.json({
        success: true,
        reply,
      });
    } catch (error) {
      console.error(
        "Dashboard assistant error:",
        error.message || error,
      );

      if (classifyGeminiError(error) === "quota") {
        return res.status(503).json({
          success: false,
          error:
            "Missile AI is temporarily unavailable because its usage quota is exhausted. Please try again in a little while.",
        });
      }

      return res.status(502).json({
        success: false,
        error:
          "Sorry, I'm having trouble connecting right now. Please try again.",
      });
    }
  },
);
/* =========================================================
   PATIENT AI MEDICAL ASSISTANT ENDPOINT (7 MODES)
========================================================= */

const PATIENT_AI_DISCLAIMER =
  "Important: AI output is generated for draft and decision support purposes only. All summaries, records, and instructions must be reviewed and confirmed by a licensed medical doctor who makes the final clinical decision.";

const patientModePrompts = {
  summarize_consultation: `
You are an expert AI Medical Assistant. Your goal is to convert doctor-patient consultation notes or uploaded documents into an easy-to-understand summary.

STRICT SCOPE RULE: ONLY explain what is explicitly mentioned in the user's uploaded document or input text. Do NOT add unmentioned clinical sections or unrequested extra healthcare tips.
LANGUAGE RULE: Explain by default in simple, clear English. BUT if the user's input text is written in another language (e.g. Tamil, Hindi) or explicitly requests a specific language, respond in that exact language.

Structure your response clearly:
- 📌 **Consultation Overview**: Short 2-sentence summary of what was actually documented.
- 🩺 **Doctor Findings**: Stated findings explained in simple everyday terms.
- 💊 **Prescribed Treatment**: Summary of prescribed medications or procedures listed in the document.
- 🕒 **Follow-up Notes**: Any follow-up date or specific warning stated in the document.
`,

  structured_record: `
You are an AI Clinical Structuring Assistant. Your task is to EXTRACT medical details from the provided doctor notes, document, or consultation text into a structured JSON record.

STRICT SCOPE RULE:
- ONLY populate fields that are explicitly present in the input text or document.
- If a specific field is not mentioned in the text, leave it as an empty string (""). Do NOT invent symptoms, vitals, or extra tips.
- LANGUAGE RULE: Explain by default in simple English. If the user writes or asks in Tamil, Hindi, or another language, populate string values in that language.

Return ONLY valid JSON matching this structure:
{
  "chiefComplaint": "extracted complaint or symptoms if present",
  "vitals": "extracted vitals if present",
  "clinicalFindings": "extracted physical exam or clinical notes if present",
  "diagnosis": "extracted diagnosis if present",
  "treatmentPlan": "extracted treatment or medicines if present",
  "followUp": "extracted follow-up instructions if present"
}
`,

  prescription_instructions: `
You are an AI Pharmacy & Prescription Assistant. Extract all prescribed medications from the input text or document and create a simple, direct medication schedule.

STRICT SCOPE RULE:
- ONLY explain medications explicitly listed in the document. Do NOT add extra unprescribed drugs or general healthcare advice not in the document.
- Write simple, direct instructions (e.g. "Calpol 500mg: Take 1 tablet morning and night after food for 5 days.").
- LANGUAGE RULE: Default to simple English unless the input text is written or requested in another language (e.g. Tamil, Hindi).

Return ONLY valid JSON matching this structure:
{
  "summary": "Simple 1-line overview of prescribed medicines listed",
  "medicines": [
    {
      "name": "Medicine Name e.g. Calpol 500mg",
      "dosage": "e.g. 1 tablet",
      "schedule": "e.g. Morning and Night",
      "foodTiming": "e.g. After food",
      "precautions": "e.g. Take daily for 5 days"
    }
  ],
  "generalAdvice": "Only specific precautions listed on the prescription, otherwise empty string"
}
`,

  patient_history: `
You are an AI Medical History Analyst. Synthesize the provided medical notes into a clear patient history summary based strictly on the uploaded document.

STRICT SCOPE RULE: ONLY include history items explicitly stated in the document.
- 🏥 **Active Conditions**: Stated health issues.
- 🏥 **Past Procedures**: Historical surgeries or hospital stays listed.
- ⚠️ **Allergies**: Stated allergies.
`,

  explain_lab_report: `
You are an AI Pathology & Lab Report Interpreter. Analyze ONLY the provided lab report test values.

STRICT SCOPE RULE:
- ONLY explain the specific lab test metrics listed in the uploaded document. Do NOT add unrequested extra health tips or unrelated medical sections.
- Explain elevated or low values in simple, everyday words.
- LANGUAGE RULE: Default to simple English. If the input text is written or requested in another language (e.g. Tamil, Hindi), explain in that language.

Return ONLY valid JSON matching this structure:
{
  "summary": "Simple 2-sentence explanation of the lab tests conducted",
  "normalResults": ["Summary of normal test values listed"],
  "abnormalResults": ["Summary of elevated or low test values explained in simple everyday words"],
  "doctorQuestions": [],
  "labMetrics": [
    {
      "name": "Test Name e.g. Hemoglobin",
      "value": 11.2,
      "minRef": 12.0,
      "maxRef": 16.5,
      "unit": "g/dL",
      "status": "low"
    }
  ]
}
Never provide a definitive medical diagnosis.
`,

  discharge_summary: `
You are an AI Hospital Discharge Summary Specialist. Format ONLY the provided hospital stay notes into a simple discharge summary.

Structure your response clearly:
- 🏥 **Admission & Discharge**: Stated admission reason and dates.
- 🩺 **Procedures**: Stated procedures performed.
- 💊 **Discharge Medications**: List of medications to continue.
`,

  voice_scribe: `
You are an AI Medical Voice Scribe. Convert spoken consultation audio transcript strictly into structured clinical notes.
`,
};

router.post(
  "/patient-assistant",
  requireAuth,
  allowRoles("patient", "doctor", "admin", "superadmin", "hospital_admin"),
  assistantRateLimit,
  async (req, res, next) => {
    try {
      if (!config.geminiApiKey) {
        return res.status(503).json({
          success: false,
          error: "Gemini AI is not configured. Please add GEMINI_API_KEY to backend/.env",
        });
      }

      const mode = String(req.body.mode || "summarize_consultation").trim();
      const inputText = String(req.body.inputText || "").trim();
      const documentText = String(req.body.documentText || "").trim();
      const imageData = req.body.imageData;

      const combinedText = [inputText, documentText].filter(Boolean).join("\n\n--- DOCUMENT CONTENT ---\n\n");

      if (!combinedText && (!imageData || !imageData.base64)) {
        return res.status(400).json({
          success: false,
          error: "Please provide clinical text or upload a prescription image/document to analyze.",
        });
      }

      if (combinedText.length > 20000) {
        return res.status(400).json({
          success: false,
          error: "Input text is too long. Please shorten it or select a smaller document section.",
        });
      }

      const systemInstruction = patientModePrompts[mode] || patientModePrompts.summarize_consultation;

      const isJsonMode = ["structured_record", "prescription_instructions", "explain_lab_report"].includes(mode);

      const genAI = new GoogleGenerativeAI(config.geminiApiKey);

      const model = genAI.getGenerativeModel({
        model: config.geminiModel,
        systemInstruction,
        generationConfig: {
          temperature: 0.2,
          ...(isJsonMode ? { responseMimeType: "application/json" } : {}),
        },
      });

      const promptText = `
Analyze the following medical text/notes/prescription document:

${combinedText || "Prescription image attached for clinical OCR and reading."}

${isJsonMode ? "Return ONLY valid JSON matching the requested schema." : "Format the output cleanly in markdown with emojis."}
`;

      const promptParts = [];
      if (imageData && imageData.base64) {
        const cleanBase64 = String(imageData.base64).replace(/^data:image\/\w+;base64,/, "").trim();
        const mimeType = String(imageData.mimeType || "image/jpeg").toLowerCase();
        promptParts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType,
          },
        });
      }
      promptParts.push(promptText);

      const result = await withGeminiRetry(() => model.generateContent(promptParts), {
        attempts: 3,
        delayMs: 1000,
        backoff: 1.8,
      });

      const outputText = result.response.text().trim();

      let parsedData = null;
      if (isJsonMode) {
        try {
          parsedData = parseGeminiJson(outputText);
        } catch (e) {
          console.warn("Patient AI JSON parse fallback for mode:", mode);
        }
      }

      res.json({
        success: true,
        mode,
        output: outputText,
        data: parsedData,
        disclaimer: PATIENT_AI_DISCLAIMER,
      });
    } catch (error) {
      console.error("Patient AI Assistant Error:", error);
      if (classifyGeminiError(error) === "quota") {
        return res.status(503).json({
          success: false,
          error: "AI Assistant quota is temporarily exhausted. Please wait a moment and try again.",
        });
      }
      next(error);
    }
  }
);

/* =========================================================
   SPECIALIZED PRESCRIPTION OCR SCANNER ENDPOINT
========================================================= */

const PRESCRIPTION_OCR_PROMPT = `
You are an advanced Medical OCR Engine specializing in reading handwritten and printed doctor prescriptions, clinic slips, and hospital discharge medications.

Your task is to scan and extract all text from the attached prescription image with maximum precision into a clean, structured JSON format.

STRICT OCR RULES:
1. Extract ALL text present in the image (Doctor details, Patient details, Date, Diagnosis, Medicines, Advice, Lab Tests, Follow-up).
2. Carefully decipher handwritten medical shorthand and abbreviations:
   - "OD" -> Once Daily
   - "BD" / "BID" -> Twice Daily (Morning & Night)
   - "TDS" / "TID" -> Three Times Daily (Morning, Afternoon & Night)
   - "QID" -> Four Times Daily
   - "HS" -> Bedtime / Night
   - "BBF" / "AC" -> Before Food
   - "PC" / "AF" -> After Food
   - "Tab" -> Tablet, "Cap" -> Capsule, "Syr" -> Syrup, "Inj" -> Injection, "Oint" -> Ointment
3. Do NOT invent medicines or symptoms that are not in the image.
4. If a field is not present in the image, return empty string or empty array.

Return ONLY valid JSON matching this exact structure:
{
  "doctor": {
    "name": "",
    "specialty": "",
    "hospital": ""
  },
  "patient": {
    "name": "",
    "age": "",
    "gender": "",
    "date": ""
  },
  "diagnosis": "",
  "chiefComplaint": "",
  "clinicalFindings": "",
  "advice": "",
  "followUpDate": "",
  "labTests": [],
  "medicines": [
    {
      "name": "",
      "dosage": "",
      "frequency": "",
      "morning": false,
      "afternoon": false,
      "night": false,
      "beforeFood": false,
      "afterFood": false,
      "durationDays": 0,
      "quantity": 0,
      "instructions": ""
    }
  ],
  "rawOcrText": ""
}
`;

router.post(
  "/ocr-prescription",
  requireAuth,
  assistantRateLimit,
  async (req, res, next) => {
    try {
      if (!config.geminiApiKey) {
        return res.status(503).json({
          success: false,
          error: "Gemini AI OCR is not configured. Please add GEMINI_API_KEY to backend/.env",
        });
      }

      const { imageData } = req.body;
      if (!imageData || !imageData.base64) {
        return res.status(400).json({
          success: false,
          error: "Please upload or capture a prescription image to scan.",
        });
      }

      const cleanBase64 = String(imageData.base64).replace(/^data:image\/\w+;base64,/, "").trim();
      const mimeType = String(imageData.mimeType || "image/jpeg").toLowerCase();

      const genAI = new GoogleGenerativeAI(config.geminiApiKey);
      const model = genAI.getGenerativeModel({
        model: config.geminiModel,
        systemInstruction: PRESCRIPTION_OCR_PROMPT,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      const promptParts = [
        {
          inlineData: {
            data: cleanBase64,
            mimeType,
          },
        },
        "Scan and extract all clinical details from this prescription image into structured JSON.",
      ];

      const result = await withGeminiRetry(() => model.generateContent(promptParts), {
        attempts: 3,
        delayMs: 1000,
        backoff: 1.8,
      });

      const outputText = result.response.text().trim();
      const parsedData = parseGeminiJson(outputText);

      res.json({
        success: true,
        data: parsedData,
        rawOutput: outputText,
        disclaimer: PATIENT_AI_DISCLAIMER,
      });
    } catch (error) {
      console.error("Prescription OCR Error:", error);
      if (classifyGeminiError(error) === "quota") {
        return res.status(503).json({
          success: false,
          error: "AI OCR quota is temporarily exhausted. Please wait a moment and try again.",
        });
      }
      next(error);
    }
  }
);

export default router;