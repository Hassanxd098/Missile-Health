import { Router } from "express";
import { db, audit } from "../models/db.js";
import { requirePatient } from "../middleware/auth.js";
import { parseDocumentRequest } from "../services/aiEngine.js";

const router = Router();

// FR-18: retrieve exact requested document for the authenticated patient only
router.post("/query", requirePatient, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  const intent = parseDocumentRequest(text);
  let matches = db.data.documents.filter(d => d.patientId === req.patientId);
  if (intent.type) matches = matches.filter(d => d.type === intent.type);
  if (intent.doctorName) matches = matches.filter(d => d.doctorName?.toLowerCase().includes(intent.doctorName.toLowerCase()));

  audit(req.patientId, "document_retrieval_query", text);

  if (matches.length === 0) {
    const related = db.data.documents.filter(d => d.patientId === req.patientId).slice(0, 3);
    return res.json({ found: false, message: "I couldn't find a document matching that request.", relatedSuggestions: related });
  }
  if (matches.length > 1) {
    return res.json({ found: true, ambiguous: true, message: "I found more than one matching document — which one did you mean?", options: matches });
  }
  res.json({ found: true, ambiguous: false, document: matches[0] });
});

router.get("/documents/mine", requirePatient, (req, res) => {
  res.json(db.data.documents.filter(d => d.patientId === req.patientId));
});

export default router;
