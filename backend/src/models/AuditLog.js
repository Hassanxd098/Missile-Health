import mongoose from "mongoose";

// Immutable, human-readable transaction log for the audit trail and
// reconciliation. Not meant to be edited.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorRole: String,
    action: { type: String, required: true, index: true },
    entity: { type: String }, // e.g. "prescription"
    entityId: mongoose.Schema.Types.ObjectId,
    meta: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
export default mongoose.model("AuditLog", auditLogSchema);