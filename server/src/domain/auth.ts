/**
 * Sign-in throttling (P7, mirrors admin rule C9): 5 failed attempts → locked 15 minutes.
 * The message never says whether the email or the password was wrong (no account enumeration).
 * Production authentication, hashing and rate limiting are Agent 02's responsibility.
 */
import { addMinutes } from "./time";

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export interface AttemptState {
  failures: number;
  lockedUntil?: string;
}

export type SignInOutcome =
  | { ok: true; state: AttemptState }
  | { ok: false; reason: "invalid"; remaining: number; state: AttemptState }
  | { ok: false; reason: "locked"; until: string; state: AttemptState };

export function evaluateAttempt(state: AttemptState, credentialsValid: boolean, now: string): SignInOutcome {
  if (state.lockedUntil && Date.parse(now) < Date.parse(state.lockedUntil)) {
    return { ok: false, reason: "locked", until: state.lockedUntil, state };
  }
  const base = state.lockedUntil ? { failures: 0 } : state; // lock expired → fresh counter
  if (credentialsValid) return { ok: true, state: { failures: 0 } };
  const failures = base.failures + 1;
  if (failures >= MAX_ATTEMPTS) {
    const until = addMinutes(now, LOCK_MINUTES);
    return { ok: false, reason: "locked", until, state: { failures, lockedUntil: until } };
  }
  return { ok: false, reason: "invalid", remaining: MAX_ATTEMPTS - failures, state: { failures } };
}

/** Basic email shape check for UI feedback only (the server decides). */
export function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/**
 * Only allow internal paths as post-sign-in redirect targets (prevents open redirects).
 * Rejects "//host", backslashes (browsers treat "/\\host" like "//host") and control characters.
 */
export function safeNext(raw: string | null, fallback = "/akun"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
