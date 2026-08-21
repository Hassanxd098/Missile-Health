/**
 * Mock AI Engine
 * -----------------------------------------------------------------------
 * Stands in for the real NLP/LLM service referenced throughout the scope
 * document (FR-01, FR-03, FR-09, FR-10, FR-19). Every function below is the
 * single seam to swap in a real model call (OpenAI/Anthropic/local LLM) —
 * keep the same input/output shape and nothing else needs to change.
 * See README "Wiring in a real AI provider".
 */

// --- Module 2: Symptom Analysis (FR-03, FR-04) ---------------------------
const SYMPTOM_MAP = [
  { keywords: ["chest pain", "palpitation", "breathless", "heart"], specialty: "Cardiologist", emergency: ["severe chest pain", "crushing chest pain"] },
  { keywords: ["rash", "itch", "skin", "acne"], specialty: "Dermatologist" },
  { keywords: ["joint pain", "fracture", "back pain", "bone"], specialty: "Orthopedic" },
  { keywords: ["ear pain", "throat", "sinus", "hearing"], specialty: "ENT Specialist" },
  { keywords: ["child", "infant", "baby fever"], specialty: "Pediatrician" },
  { keywords: ["fever", "cold", "cough", "headache", "fatigue"], specialty: "General Physician" }
];

export function analyzeSymptoms(text) {
  const lower = text.toLowerCase();
  const emergencyHit = SYMPTOM_MAP.some(rule => rule.emergency?.some(e => lower.includes(e)));
  if (emergencyHit) {
    return { emergency: true, message: "These symptoms may indicate a medical emergency. Please seek immediate emergency care or call your local emergency number.", specialty: null };
  }
  const match = SYMPTOM_MAP.find(rule => rule.keywords.some(k => lower.includes(k)));
  return {
    emergency: false,
    specialty: match ? match.specialty : "General Physician",
    confidence: match ? 0.82 : 0.5,
    disclaimer: "This is an AI-assisted suggestion only, not a diagnosis. A doctor will confirm the actual condition."
  };
}

// --- Module 1: Onboarding field validation (FR-01, FR-02) -----------------
export function validateOnboardingField(field, value) {
  switch (field) {
    case "dob": {
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value) < new Date();
      return { valid, message: valid ? null : "Please provide date of birth as YYYY-MM-DD." };
    }
    case "abhaNumber": {
      const digits = value.replace(/-/g, "");
      const valid = /^\d{14}$/.test(digits);
      return { valid, message: valid ? null : "ABHA number should be 14 digits (with or without dashes)." };
    }
    case "name":
      return { valid: value.trim().length > 1, message: value.trim().length > 1 ? null : "Please share your full name." };
    case "sex":
      return { valid: ["male", "female", "other"].includes(value.toLowerCase()), message: "Please choose male, female, or other." };
    case "address":
      return { valid: value.trim().length > 5, message: value.trim().length > 5 ? null : "Please share a more complete address." };
    default:
      return { valid: true, message: null };
  }
}

// --- Module 4: Structuring clinical capture (FR-09, FR-10) -----------------
export function structureExaminationNote(rawText) {
  return {
    summary: rawText.trim(),
    confidence: rawText.length > 15 ? 0.9 : 0.55,
    lowConfidence: rawText.length <= 15
  };
}

const FREQ_PER_DAY = { od: 1, bd: 2, tds: 3, qid: 4, "once daily": 1, "twice daily": 2, "thrice daily": 3 };

export function structurePrescription(rawMedicines) {
  // rawMedicines: [{ name, frequency, durationDays }]
  return rawMedicines.map(m => {
    const perDay = FREQ_PER_DAY[m.frequency?.toLowerCase()] ?? 1;
    return {
      name: m.name,
      dosage: m.dosage || "as directed",
      frequency: m.frequency,
      durationDays: m.durationDays,
      quantity: perDay * (m.durationDays || 1)
    };
  });
}

// --- Module 6: OCR/NLP prescription extraction (FR-15) --------------------
export function mockOcrExtractPrescription(fileNameHint = "") {
  // Real implementation would call an OCR + NLP pipeline on the uploaded
  // image/PDF. This mock simulates extraction with a plausible confidence.
  const sample = [
    { name: "Paracetamol 500mg", frequency: "BD", durationDays: 5 },
    { name: "Cetirizine 10mg", frequency: "OD", durationDays: 5 }
  ];
  const confidence = fileNameHint.toLowerCase().includes("blurry") ? 0.4 : 0.93;
  return { items: structurePrescription(sample), confidence };
}

// --- Module 7: Chat document retrieval intent parsing (FR-18) --------------
export function parseDocumentRequest(text) {
  const lower = text.toLowerCase();
  const typeMatch = ["prescription", "examination report", "referral", "invoice"].find(t => lower.includes(t));
  const doctorMatch = lower.match(/dr\.?\s?([a-z]+)/i);
  return {
    type: typeMatch || null,
    doctorName: doctorMatch ? `Dr. ${doctorMatch[1][0].toUpperCase()}${doctorMatch[1].slice(1)}` : null
  };
}

// --- Module 8: Wellness plan generation (FR-19) ----------------------------
const RESTRICTED_CONDITIONS = ["diabetic", "diabetes", "renal", "kidney"];

export function generateWellnessPlan({ bmi, conditions = [], medications = [] }) {
  const flagged = conditions.some(c => RESTRICTED_CONDITIONS.some(r => c.toLowerCase().includes(r)));
  if (flagged) {
    return { flaggedForReview: true, plan: null, note: "This patient has a condition requiring specialised dietary restriction. Routed to dietitian/doctor for review before any plan is generated." };
  }
  if (!bmi) {
    return { flaggedForReview: false, plan: null, note: "Insufficient health data — BMI is required before a meaningful plan can be generated." };
  }
  let category = "normal";
  if (bmi < 18.5) category = "underweight";
  else if (bmi >= 25 && bmi < 30) category = "overweight";
  else if (bmi >= 30) category = "obese";

  const plans = {
    underweight: "Increase caloric intake with protein-rich meals 5x/day; light resistance training; hydration reminders.",
    normal: "Balanced macronutrient meals 3x/day; 30 min daily activity; standard hydration and sleep hygiene reminders.",
    overweight: "Calorie-moderated meals with increased fibre; 150 min/week moderate activity; portion-size reminders.",
    obese: "Structured calorie deficit under general guidance; low-impact daily activity; recommend in-person dietitian follow-up."
  };

  return {
    flaggedForReview: false,
    plan: plans[category],
    category,
    disclaimer: "This is general wellness support generated from your health profile, not a substitute for professional medical or nutrition advice."
  };
}
