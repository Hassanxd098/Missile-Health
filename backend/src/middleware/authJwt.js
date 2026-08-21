import jwt from "jsonwebtoken";
import { config } from "../config.js";
import User from "../models/User.js";

export const TOKEN_REFRESH_HEADER = "x-refresh-token";

export async function requireAuth(req, res, next) {
  try {
    const token = req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.active || user.blocked) {
      return res.status(401).json({ success: false, message: "Session is no longer valid" });
    }
    if (user.hospitalId && !user.hospitalName && payload.hospitalName) {
      user.hospitalName = payload.hospitalName;
    }
    req.user = user;
    req.accessToken = token;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ success: false, message: "Session expired" });
    return res.status(401).json({ success: false, message: "Invalid or expired session" });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission for this action" });
    }
    next();
  };
}

export function preventBlocked(req, res, next) {
  if (req.user?.blocked) return res.status(403).json({ success: false, message: "This account has been blocked" });
  return next();
}

// Hospital users (admin / doctor / pharmacy / patient / reception / cleaner)
// must always be scoped to a hospital. Super admins bypass this.
export function requireHospitalContext() {
  return (req, res, next) => {
    if (req.user.role === "superadmin" || req.user.role === "hospital_admin") {
      if (!req.user.hospitalId) {
        return res.status(403).json({ success: false, message: "Account is not assigned to a hospital" });
      }
    }
    if (req.user.hospitalId) {
      req.hospitalId = req.user.hospitalId;
    }
    next();
  };
}

export function requireSuperAdmin() {
  return (req, res, next) => {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Super admin access required" });
    }
    next();
  };
}

// Helper: scope a Mongoose query to the authenticated user's hospital.
// Super admins return null (unscoped) so they can manage across hospitals.
export function hospitalScope(user) {
  if (!user?.hospitalId) return null;
  return { hospitalId: user.hospitalId };
}
