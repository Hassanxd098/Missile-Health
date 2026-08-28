import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  scheduledFor: { type: Date, required: true, index: true },
  reason: { type: String, trim: true, maxlength: 1000 },
  consultationFee: { type: Number, min: 0, default: 0 },

  // Queue / OPD fields
  token: { type: String },
  priority: { type: String, enum: ["normal", "high", "emergency"], default: "normal", index: true },
  complaint: { type: String, trim: true, maxlength: 1000 },
  symptoms: [{ type: String }],
  notes: { type: String, trim: true, maxlength: 2000 },

  cancelledBy: { type: String, enum: ["patient", "doctor", "admin", "reception", null], default: null },
  status: {
    type: String,
    enum: ["requested", "confirmed", "in-progress", "completed", "cancelled", "missed"],
    default: "requested",
    index: true,
  },

  // Who created the booking ("self" = patient portal, "reception" = desk, "doctor" / "doctor-followup" = doctor).
  source: { type: String, enum: ["self", "reception", "doctor", "doctor-followup", "referral"], default: "self" },

  // Cash collected at the desk when a receptionist books an appointment.
  paidAt: { type: Date },
  paymentMode: { type: String, enum: ["cash", "upi", "card", null], default: null },
  paymentCollectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

appointmentSchema.index({ hospitalId: 1, doctor: 1, scheduledFor: 1 });
appointmentSchema.index({ hospitalId: 1, doctor: 1, status: 1 });
appointmentSchema.index({ hospitalId: 1, patient: 1, createdAt: -1 });
export default mongoose.model("Appointment", appointmentSchema);