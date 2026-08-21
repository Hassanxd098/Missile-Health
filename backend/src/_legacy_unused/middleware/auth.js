import { db } from "../models/db.js";

/**
 * Mock authentication — reads a patient id from the X-Patient-Id header.
 * Replace with real session/JWT auth later; every route below only
 * depends on `req.patientId` being set correctly.
 */
export function requirePatient(req, res, next) {
  const patientId = req.header("X-Patient-Id");
  if (!patientId) return res.status(401).json({ error: "Missing X-Patient-Id header" });
  const patient = db.data.patients.find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ error: "Unknown patient. Complete onboarding first." });
  req.patientId = patientId;
  req.patient = patient;
  next();
}
