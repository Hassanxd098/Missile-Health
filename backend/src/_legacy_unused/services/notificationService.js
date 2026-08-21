/**
 * Mock notification service (push/SMS/email — dependency 2.4).
 * Logs to console for now; swap `send` for a real provider (Twilio, FCM,
 * SES, etc.) — callers only depend on this one function.
 */
export function send(patientId, message) {
  console.log(`[notify -> ${patientId}] ${message}`);
  return { sent: true, channel: "mock", message };
}
