import { Router } from "express";
import { db, nanoid, audit } from "../models/db.js";
import { requirePatient } from "../middleware/auth.js";
import { generateWellnessPlan } from "../services/aiEngine.js";
import { send } from "../services/notificationService.js";

const router = Router();

// FR-19: generate personalised diet/hygiene plan from verified health data
router.post("/generate", requirePatient, async (req, res) => {
  const { bmi, conditions = [], medications = [] } = req.body;
  const result = generateWellnessPlan({ bmi, conditions, medications });

  const record = {
    id: nanoid(10), patientId: req.patientId, bmi, conditions, medications,
    plan: result.plan, flaggedForReview: result.flaggedForReview,
    reminderFrequency: "weekly", createdAt: new Date().toISOString()
  };
  db.data.wellnessPlans.push(record);
  audit(req.patientId, "wellness_plan_generated", result.flaggedForReview ? "flagged_for_review" : result.category || "generated");
  await db.write();

  res.status(201).json({ record, ...result });
});

// FR-20: configurable reminder frequency + scheduled reminders
router.post("/:id/reminder-frequency", async (req, res) => {
  const { frequency } = req.body; // daily | weekly
  const plan = db.data.wellnessPlans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  plan.reminderFrequency = frequency;
  await db.write();
  res.json({ plan });
});

router.post("/:id/send-reminder", (req, res) => {
  const plan = db.data.wellnessPlans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const result = send(plan.patientId, "Reminder: keep up with your personalised diet & hygiene plan today.");
  res.json(result);
});

router.get("/mine", requirePatient, (req, res) => {
  res.json(db.data.wellnessPlans.filter(p => p.patientId === req.patientId));
});

export default router;
