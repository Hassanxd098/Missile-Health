import mongoose from "mongoose";

// Hashed refresh tokens enable "remember me" sessions, silent token refresh,
// and forced log-out on rotation. Tokens are stored hashed so a DB leak does
// not leak usable credentials.
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    remember: { type: Boolean, default: false }, // long-lived when true
    expiresAt: { type: Date, required: true },
    userAgent: String,
    ip: String,
    revoked: { type: Boolean, default: false },
    revokedAt: Date,
    replacedBy: String,
  },
  { timestamps: true },
);

refreshTokenSchema.index({ user: 1, revoked: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL cleanup
export default mongoose.model("RefreshToken", refreshTokenSchema);