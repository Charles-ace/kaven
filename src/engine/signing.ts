import crypto from "node:crypto";
import { SignedTradeAction, SignedTradeActionPayload } from "../types.js";

export const DEFAULT_INTERNAL_SIGNING_SECRET =
  process.env.KAVEN_INTERNAL_SECRET || "kaven_deterministic_guard_secret_2026";

/**
 * Deterministic canonical JSON serialization (RFC 8785 subset)
 * Guarantees identical byte output regardless of object key ordering.
 */
export function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k]));
  return "{" + pairs.join(",") + "}";
}

/**
 * Sign an action payload using HMAC-SHA256 over its canonical JSON representation.
 */
export function signActionPayload(
  payload: SignedTradeActionPayload,
  secret: string = DEFAULT_INTERNAL_SIGNING_SECRET
): SignedTradeAction {
  const canonical = canonicalJson(payload);
  const signature = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
  return {
    payload,
    signature
  };
}

/**
 * Verify a signed action: checks TTL expiration and verifies HMAC signature using timingSafeEqual.
 */
export function verifySignedAction(
  action: SignedTradeAction,
  secret: string = DEFAULT_INTERNAL_SIGNING_SECRET
): { valid: boolean; reason?: string } {
  if (!action || !action.payload || !action.signature) {
    return { valid: false, reason: "MALFORMED_SIGNED_ACTION: missing payload or signature" };
  }

  // 1. Check TTL expiry
  const now = Date.now();
  if (now > action.payload.expiresAt) {
    const expiredSec = ((now - action.payload.expiresAt) / 1000).toFixed(1);
    return {
      valid: false,
      reason: `ACTION_EXPIRED: Action expired at ${new Date(action.payload.expiresAt).toISOString()} (${expiredSec}s ago)`
    };
  }

  // 2. Verify HMAC-SHA256 signature
  try {
    const canonical = canonicalJson(action.payload);
    const expectedSig = crypto.createHmac("sha256", secret).update(canonical).digest("hex");

    const expectedBuf = Buffer.from(expectedSig, "hex");
    const actualBuf = Buffer.from(action.signature, "hex");

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return {
        valid: false,
        reason: "INVALID_SIGNATURE: Action payload was tampered with or signature is invalid."
      };
    }
  } catch (err: any) {
    return {
      valid: false,
      reason: `VERIFICATION_ERROR: ${err.message}`
    };
  }

  return { valid: true };
}
