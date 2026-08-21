import mongoose from "mongoose";

const medicineLineSchema = new mongoose.Schema(
  {
    name: String,
    morning: Boolean,
    afternoon: Boolean,
    night: Boolean,
    beforeFood: Boolean,
    afterFood: Boolean,
    duration: String,
    durationDays: Number,
    dosage: String,
    quantity: Number,
    unitPrice: Number,
    instructions: String,
  },
  { _id: false },
);

// A formal prescription authored by a doctor and forwarded to the pharmacy.
const prescriptionSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    prescriptionId: { type: String, unique: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    diagnosis: String,
    chiefComplaint: String,
    clinicalFindings: String,
    advice: String,
    followUpDate: Date,
    labTests: [String],
    doctorNotes: String,
    doctorSignature: String,

    medicines: [medicineLineSchema],

    status: {
      type: String,
      enum: ["new", "sent-to-pharmacy", "preparing", "ready", "delivered", "dispensed"],
      default: "new",
      index: true,
    },

    totalMedicines: { type: Number, default: 0 },
    medicineCost: { type: Number, min: 0, default: 0 },
    submittedToPharmacyAt: Date,
  },
  { timestamps: true },
);

prescriptionSchema.index({ hospitalId: 1, patient: 1, createdAt: -1 });
prescriptionSchema.index({ hospitalId: 1, doctor: 1, createdAt: -1 });
prescriptionSchema.index({ hospitalId: 1, status: 1 });
export default mongoose.model("Prescription", prescriptionSchema);