import { Router } from "express";
import multer from "multer";
import { db, nanoid, audit } from "../models/db.js";
import { requirePatient } from "../middleware/auth.js";
import { mockOcrExtractPrescription } from "../services/aiEngine.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CONFIDENCE_THRESHOLD = 0.7;

// FR-15: upload prescription (photo/PDF) -> OCR/NLP extraction
router.post("/upload", requirePatient, upload.single("file"), (req, res) => {
  const fileName = req.file?.originalname || req.body.fileNameHint || "";
  if (!req.file && !req.body.fileNameHint) return res.status(400).json({ error: "file (or fileNameHint for demo) is required" });

  const { items, confidence } = mockOcrExtractPrescription(fileName);
  if (confidence < 0.5) {
    return res.status(422).json({ error: "Image quality too low to extract reliably", action: "Please re-upload a clearer photo or enter medicines manually." });
  }

  const cart = items.map(item => {
    const catalogItem = db.data.medicineCatalog.find(m => m.name.toLowerCase() === item.name.toLowerCase());
    return {
      ...item,
      available: catalogItem?.available ?? false,
      price: catalogItem?.price ?? null,
      needsReview: confidence < CONFIDENCE_THRESHOLD,
      substituteSuggested: catalogItem && !catalogItem.available
    };
  });

  res.json({ confidence, needsManualConfirmation: confidence < CONFIDENCE_THRESHOLD, cart });
});

// FR-16/17: patient reviews/edits, confirms, proceeds to "payment"
router.post("/confirm", requirePatient, async (req, res) => {
  const { items } = req.body; // reviewed/edited cart
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array is required" });

  const unavailable = items.filter(i => i.available === false);
  const order = {
    id: nanoid(10),
    patientId: req.patientId,
    items,
    status: unavailable.length ? "confirmed_with_flags" : "confirmed",
    createdAt: new Date().toISOString()
  };
  db.data.orders.push(order);
  audit(req.patientId, "medicine_order_confirmed", order.id);
  await db.write();
  res.status(201).json({ order, message: unavailable.length ? "Order confirmed — some items are flagged unavailable and need a substitute." : "Order confirmed. Proceed to checkout." });
});

router.get("/mine", requirePatient, (req, res) => {
  res.json(db.data.orders.filter(o => o.patientId === req.patientId));
});

router.get("/catalog", (req, res) => res.json(db.data.medicineCatalog));

export default router;
