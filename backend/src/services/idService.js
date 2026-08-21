import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import { nanoid } from "nanoid";

export const generateHospitalId = async (code) => {
  const suffix = nanoid(4).toUpperCase();
  const hospitalId = `${String(code || "HOSP")}-${suffix}`;
  const taken = await Hospital.exists({ hospitalId });
  if (!taken) return hospitalId;
  // Retry
  for (let i = 0; i < 5; i++) {
    const alt = `${String(code || "HOSP")}-${nanoid(5).toUpperCase()}`;
    if (!(await Hospital.exists({ hospitalId: alt }))) return alt;
  }
  const ts = Date.now().toString().slice(-6);
  return `${String(code || "HOSP")}-${ts}`;
};

// Human-friendly unique identifiers for bills and prescriptions.
const stamp = () => {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const d2 = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${d2}`;
};

export const generateInvoiceNo = () => `INV-${stamp()}-${nanoid(5).toUpperCase()}`;
export const generatePrescriptionId = () => `RX-${stamp()}-${nanoid(5).toUpperCase()}`;
export const generateToken = (n = 1) => String(n).padStart(2, "0");

const MOBILE_PATTERN = /^[+]?[0-9]{10,15}$/;

export function normalizeMobile(input = "") {
  return String(input).trim().replace(/[\s-]/g, "");
}

export function isValidMobile(input = "") {
  return MOBILE_PATTERN.test(normalizeMobile(input));
}

// Builds a permanent patient id like PAT240001-12 (year prefix + sequence),
// generated from mobile + current year + running sequence.
// Wrapped in a small retry loop to survive concurrent registration races.
const MAX_ATTEMPTS = 5;

export async function generatePatientId(mobile) {
  const normalized = normalizeMobile(mobile);
  const year = String(new Date().getFullYear()).slice(-2);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Derive a stable, deterministic seed from the mobile for consistency.
    const tail = normalized.slice(-4);
    const seed = `${year}${tail}`;

    // Running sequence: count existing patients to derive the next number. The
    // unique sparse index on patientId guarantees correctness across races.
    const existing = await User.collection.distinct("patientId", {
      patientId: { $regex: `^PAT-${seed}-` },
    });
    const next = existing.length + (attempt === 0 ? 0 : 1);
    const patientId = `PAT-${seed}-${String(next).padStart(3, "0")}`;
    const taken = await User.exists({ patientId });
    if (!taken) return patientId;
  }
  throw new Error("Unable to allocate a unique patient ID. Please retry.");
}

// Employee numbers are uppercased tokens like EMP-DOC-0004, one per hospital.
// Runs a quick collision check on-demand. The unique sparse index guarantees
// correctness across concurrent requests.
const EMPLOYEE_PREFIX = {
  doctor: "DOC",
  nurse: "NUR",
  reception: "REC",
  management: "MGT",
  security: "SEC",
  cleaner: "CLN",
  other: "OTH",
  pharmacy: "PHR",
};

// Builds a unique employee number like EMP-DOC-0004 for a staff role within a
// hospital. Fails safe after a few attempts so two admins can't collide.
const MAX_EMP_ATTEMPTS = 8;

export async function generateEmployeeNumber(hospitalId, role = "other") {
  const prefix = EMPLOYEE_PREFIX[role] || EMPLOYEE_PREFIX.other;
  for (let attempt = 0; attempt < MAX_EMP_ATTEMPTS; attempt++) {
    const existing = await User.collection.distinct("employeeNumber", {
      hospitalId,
      employeeNumber: { $regex: `^EMP-${prefix}-` },
    });
    let next = existing.length + (attempt === 0 ? 0 : 1);
    let candidate = `EMP-${prefix}-${String(next).padStart(4, "0")}`;
    const taken = await User.exists({ employeeNumber: candidate });
    if (!taken) return candidate;
  }
  // Ultimate fallback: timestamp-suffixed number, virtually collision-free.
  return `EMP-${prefix}-${Date.now().toString().slice(-5)}`;
}

export default { generateHospitalId, generateInvoiceNo, generatePrescriptionId, generateToken, generatePatientId, generateEmployeeNumber, normalizeMobile, isValidMobile };