import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config.js";
import RefreshToken from "../models/RefreshToken.js";

export const TOKEN_LIFETIMES = {
  access: "15m", // short-lived session token
  refreshRemember: "30d",
  refreshDefault: "8h",
};

// Deterministic single-token family so both access + refresh prove identity.
// hospitalId and hospitalName are included so the backend can derive tenant
// scope from the JWT and never trust the frontend for hospital context.
const familyToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), role: user.role, hospitalId: user.hospitalId?.toString() || null, hospitalName: user.hospitalName || null },
    config.jwtSecret,
  );

export function issueAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, hospitalId: user.hospitalId?.toString() || null, hospitalName: user.hospitalName || null },
    config.jwtSecret,
    { expiresIn: TOKEN_LIFETIMES.access },
  );
}

export async function issueRefreshToken(user, { remember = false, userAgent, ip } = {}) {
  const token = crypto.randomBytes(48).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const ttl = remember ? TOKEN_LIFETIMES.refreshRemember : TOKEN_LIFETIMES.refreshDefault;
  const expiresAt = new Date(Date.now() + (remember ? 30 : 1) * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ user: user._id, tokenHash: hash, remember, expiresAt, userAgent, ip });
  return { token, expiresAt, remember };
}

export async function rotateRefreshToken(rawToken, { userAgent, ip } = {}) {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const stored = await RefreshToken.findOne({ tokenHash: hash, revoked: false, expiresAt: { $gt: new Date() } });
  if (!stored) return null;
  // Single-use rotation: revoke this token and mint a successor.
  stored.revoked = true;
  stored.revokedAt = new Date();
  await stored.save();
  return stored;
}

export function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    patientId: user.patientId || null,
    profile: user.profile,
    blocked: user.blocked,
    active: user.active,
    hospitalId: user.hospitalId || null,
    hospitalName: user.hospitalName || null,
  };
}

// Wrapper used by routes that need both a fresh access token + refreshed
// refresh token in a single response.
export async function issueSession(user, opts) {
  const accessToken = issueAccessToken(user);
  const refresh = await issueRefreshToken(user, opts);
  return { accessToken, refreshToken: refresh.token, remember: refresh.remember };
}