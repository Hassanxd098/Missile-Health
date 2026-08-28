import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    hospitalId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 32 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 100 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    // Branch Network & Approval Fields
    isBranch: { type: Boolean, default: false, index: true },
    parentHospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", index: true },
    approvalStatus: { type: String, enum: ["approved", "pending", "rejected"], default: "approved", index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true },
);

hospitalSchema.index({ name: 1 });
hospitalSchema.index({ status: 1, createdAt: -1 });
hospitalSchema.index({ approvalStatus: 1, createdAt: -1 });

export default mongoose.model("Hospital", hospitalSchema);
