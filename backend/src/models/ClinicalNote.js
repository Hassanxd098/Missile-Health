import mongoose from "mongoose";

// A consultation is stored as a ClinicalNote for backward compatibility with
// the existing patient `reports` endpoint, but extended with the full set of
// structured clinical fields a modern hospital records.
const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    morning: { type: Boolean, default: false },
    afternoon: { type: Boolean, default: false },
    night: { type: Boolean, default: false },
    beforeFood: { type: Boolean, default: false },
    afterFood: { type: Boolean, default: false },
    frequency: String, // e.g. "Twice daily"
    dosage: String,     // e.g. "500 mg"
    durationDays: Number,
    quantity: Number,
    instructions: String,
  },
  { _id: false },
);

const clinicalNoteSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, unique: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

  // Legacy/backward-compatible fields
  assessment: { type: String, trim: true, maxlength: 5000 },
  prescription: [medicineSchema],
  status: { type: String, enum: ["draft", "published"], default: "draft" },
  sentToPharmacy: { type: Boolean, default: false },
  pharmacyName: { type: String, trim: true, maxlength: 120 },

  // Production-grade consultation fields
  chiefComplaint: { type: String, trim: true, maxlength: 5000 },
  diagnosis: { type: String, trim: true, maxlength: 5000 },
  clinicalFindings: { type: String, trim: true, maxlength: 5000 },
  advice: { type: String, trim: true, maxlength: 5000 },
  followUpDate: Date,
  labTests: [{ type: String }],
  doctorNotes: { type: String, trim: true, maxlength: 5000 },
  doctorSignature: { type: String, trim: true, maxlength: 300 },

  // Consultation outcome flags
  prescribedAt: Date,
}, { timestamps: true });

clinicalNoteSchema.index({ hospitalId: 1, patient: 1, createdAt: -1 });
clinicalNoteSchema.index({ hospitalId: 1, doctor: 1, createdAt: -1 });
export default mongoose.model("ClinicalNote", clinicalNoteSchema);
