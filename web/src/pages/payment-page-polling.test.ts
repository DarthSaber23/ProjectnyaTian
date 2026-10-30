import { describe, expect, it } from "vitest";
import { computeCountdownSeconds, formatCountdown, PAYMENT_POLL_INTERVAL_MS } from "./PaymentPage";

describe("PaymentPage polling and countdown", () => {
  it("computes countdown remaining seconds accurately", () => {
    const now = 1700000000000;
    const expiresAt = new Date(now + 95000).toISOString();
    expect(computeCountdownSeconds(expiresAt, now)).toBe(95);
    expect(formatCountdown(95)).toBe("1m 35s");
  });

  it("handles expired orders gracefully by returning 0", () => {
    const now = 1700000000000;
    const expiresAt = new Date(now - 1000).toISOString();
    expect(computeCountdownSeconds(expiresAt, now)).toBe(0);
    expect(formatCountdown(0)).toBe("0m 00s");
  });

  it("verifies 3000ms polling configuration", () => {
    expect(PAYMENT_POLL_INTERVAL_MS).toBe(3000);
  });
});
