import AuditLog from "../models/AuditLog.js";

// Structured, non-blocking audit trail used across the management routes.
export function logAudit({ actor, actorRole, action, entity, entityId, meta, ip } = {}) {
  return AuditLog.create({ actor, actorRole, action, entity, entityId, meta, ip }).catch(() => null);
}

export function ipFrom(req) {
  return req.ip || req.headers?.["x-forwarded-for"] || "";
}