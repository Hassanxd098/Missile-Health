import mongoose from "mongoose";

// Attendance records for hospital staff. For now cleaners are marked "present"
// by the reception desk (source "reception"); biometric readers will be plugged
// in later (source "biometric").
const attendanceSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD (local hospital date)
  status: { type: String, enum: ["present", "absent", "half-day", "leave"], default: "present" },
  checkIn: { type: String }, // HH:mm
  checkOut: { type: String }, // HH:mm
  source: { type: String, enum: ["reception", "admin", "biometric"], default: "reception" },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
}, { timestamps: true });

attendanceSchema.index({ hospitalId: 1, user: 1, date: 1 }, { unique: true });
export default mongoose.model("Attendance", attendanceSchema);