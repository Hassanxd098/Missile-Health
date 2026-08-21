import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    type: {
      type: String,
      default: "info",
      enum: ["info", "appointment", "prescription", "invoice", "payment", "medicine", "reminder", "report", "alert"],
    },
    read: { type: Boolean, default: false },
    entity: String,
    entityId: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
export default mongoose.model("Notification", notificationSchema);