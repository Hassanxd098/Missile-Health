/**
 * Mock ABHA / ABDM verification service (FR-02, dependency 2.4).
 * Swap the body of `verifyAbha` for a real NDHM/ABDM API call — the
 * function signature and return shape are the integration contract.
 */
export async function verifyAbha(abhaNumber) {
  const digits = abhaNumber.replace(/-/g, "");
  if (!/^\d{14}$/.test(digits)) {
    return { verified: false, reason: "invalid_format" };
  }
  // Simulate an occasional service outage so the "unverified fallback"
  // business rule (2.3) has something real to exercise.
  if (digits.endsWith("0000")) {
    return { verified: false, reason: "service_unavailable" };
  }
  return { verified: true, abhaId: `abha_${digits}` };
}
