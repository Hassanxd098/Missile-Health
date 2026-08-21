import { Low } from "lowdb";
import { Memory } from "lowdb";
import { nanoid } from "nanoid";

// Using lowdb's in-memory adapter — swap for JSONFile/Postgres later without
// touching any route or service code (see README "Swapping the data layer").
const defaultData = {
  patients: [],
  doctors: [
    { id: "doc_001", name: "Dr. Ananya Rao", specialty: "General Physician", hospitalId: "hosp_001", capacityPerSlot: 3, rating: 4.7, verified: true, lat: 11.664, lng: 78.146 },
    { id: "doc_002", name: "Dr. Vikram Sethi", specialty: "Cardiologist", hospitalId: "hosp_001", capacityPerSlot: 2, rating: 4.8, verified: true, lat: 11.667, lng: 78.150 },
    { id: "doc_003", name: "Dr. Priya Nambiar", specialty: "Dermatologist", hospitalId: "hosp_002", capacityPerSlot: 2, rating: 4.6, verified: true, lat: 11.660, lng: 78.140 },
    { id: "doc_004", name: "Dr. Suresh Iyer", specialty: "Orthopedic", hospitalId: "hosp_002", capacityPerSlot: 2, rating: 4.5, verified: true, lat: 11.658, lng: 78.142 },
    { id: "doc_005", name: "Dr. Meera Joseph", specialty: "Pediatrician", hospitalId: "hosp_001", capacityPerSlot: 4, rating: 4.9, verified: true, lat: 11.665, lng: 78.148 },
    { id: "doc_006", name: "Dr. Arjun Kapoor", specialty: "ENT Specialist", hospitalId: "hosp_003", capacityPerSlot: 2, rating: 4.4, verified: true, lat: 11.670, lng: 78.155 }
  ],
  hospitals: [
    { id: "hosp_001", name: "Missile General Hospital", lat: 11.664, lng: 78.146 },
    { id: "hosp_002", name: "Salem Care Multispeciality", lat: 11.660, lng: 78.140 },
    { id: "hosp_003", name: "Northside Health Centre", lat: 11.670, lng: 78.155 }
  ],
  slots: [], // { id, doctorId, date, time, capacity, booked, status }
  appointments: [], // { id, patientId, doctorId, date, time, status, source }
  visitReports: [], // { id, appointmentId, patientId, doctorId, findings, prescription, status, version, createdAt }
  referrals: [], // { id, patientId, fromDoctorId, toDoctorId, type, status, reportIds }
  medicineCatalog: [
    { name: "Paracetamol 500mg", available: true, price: 20 },
    { name: "Amoxicillin 500mg", available: true, price: 65 },
    { name: "Cetirizine 10mg", available: true, price: 15 },
    { name: "Metformin 500mg", available: true, price: 40 },
    { name: "Atorvastatin 10mg", available: false, price: 80 },
    { name: "Azithromycin 500mg", available: true, price: 90 }
  ],
  orders: [], // { id, patientId, prescriptionId, items: [{name, qty, needsReview}], status }
  documents: [], // { id, patientId, type, doctorName, date, refId }
  wellnessPlans: [], // { id, patientId, bmi, plan, reminderFrequency, flaggedForReview }
  auditLog: [] // { id, patientId, action, detail, timestamp }
};

const db = new Low(new Memory(), defaultData);
await db.read();
db.data ||= structuredClone(defaultData);
await db.write();

export function audit(patientId, action, detail) {
  db.data.auditLog.push({ id: nanoid(8), patientId, action, detail, timestamp: new Date().toISOString() });
}

export { db, nanoid };
