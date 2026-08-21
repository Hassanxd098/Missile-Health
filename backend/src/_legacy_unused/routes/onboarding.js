import { Router } from "express";
import { db, nanoid, audit } from "../models/db.js";
import { validateOnboardingField } from "../services/aiEngine.js";
import { verifyAbha } from "../services/abhaService.js";

const router = Router();

// FR-01: validate one field at a time, conversational style
router.post("/validate-field", (req, res) => {
  const { field, value } = req.body;
  if (!field) return res.status(400).json({ error: "field is required" });
  res.json(validateOnboardingField(field, value ?? ""));
});

// Edge case: patient abandons mid-flow — save partial progress, resumable by draftId
router.post("/draft", (req, res) => {
  const draftId = req.body.draftId || nanoid(10);
  db.data.drafts ||= {};
  db.data.drafts[draftId] = { ...(db.data.drafts[draftId] || {}), ...req.body.fields, updatedAt: new Date().toISOString() };
  res.json({ draftId, fields: db.data.drafts[draftId] });
});

router.get("/draft/:draftId", (req, res) => {
  const draft = db.data.drafts?.[req.params.draftId];
  if (!draft) return res.status(404).json({ error: "No saved draft found" });
  res.json({ draftId: req.params.draftId, fields: draft });
});

// FR-01/FR-02: complete onboarding — validate all fields, verify ABHA, create profile
router.post("/complete", async (req, res) => {
  const { name, sex, dob, abhaNumber, address } = req.body;
  const fields = { name, sex, dob, abhaNumber: abhaNumber || "", address };
  const errors = {};
  for (const [field, value] of Object.entries(fields)) {
    if (field === "abhaNumber") continue; // handled separately below (has its own fallback path)
    const result = validateOnboardingField(field, value ?? "");
    if (!result.valid) errors[field] = result.message;
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: "Mandatory fields incomplete or invalid", details: errors });
  }

  let abhaStatus = { verified: false, reason: "not_provided" };
  if (abhaNumber) abhaStatus = await verifyAbha(abhaNumber);

  const patientId = nanoid(10);
  const patient = {
    id: patientId,
    name, sex, dob,
    address,
    abha: abhaStatus.verified ? { number: abhaNumber, status: "verified" } : { number: abhaNumber || null, status: "unverified" },
    createdAt: new Date().toISOString()
  };
  db.data.patients.push(patient);
  audit(patientId, "onboarding_complete", `ABHA status: ${patient.abha.status}`);
  await db.write();

  res.status(201).json({
    patient,
    message: abhaStatus.verified
      ? "Profile created and ABHA verified."
      : abhaStatus.reason === "service_unavailable"
        ? "Profile created. ABHA verification service was unavailable — queued for retry; your profile remains usable in the meantime."
        : "Profile created without ABHA verification. You can retry linking your ABHA account anytime from settings."
  });
});

export default router;
