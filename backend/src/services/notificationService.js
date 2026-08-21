import Notification from "../models/Notification.js";

// Deliver a notification to a user. Non-blocking — persists even if creating
// other records later fails.
export function notify(userId, { title, body = "", type = "info", entity, entityId }) {
  if (!userId) return Promise.resolve();
  return Notification.create({ user: userId, title, body, type, entity, entityId }).catch(() => null);
}

export const createNotification = notify;