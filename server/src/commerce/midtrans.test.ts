import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { grossAmount, midtransServerKey, notificationFor, signatureKey, verifyNotification } from "./midtrans";

describe("Midtrans notification", () => {
  const key = "SB-Midtrans-dummy";

  it("builds the documented SHA512 signature", () => {
    const gross = grossAmount(100000);
    expect(gross).toBe("100000.00");
    expect(signatureKey("1111", "200", gross, key)).toBe(createHash("sha512").update(`1111200${gross}${key}`).digest("hex"));
  });

  it("accepts settlement only when status, fraud, and amount match", () => {
    const note = notificationFor("ORD-1", 87000, "paid", key);
    expect(verifyNotification(note, 87000, key)).toBe("paid");
    expect(() => verifyNotification({ ...note, signature_key: "nope" }, 87000, key)).toThrow(/INVALID_SIGNATURE/);
    expect(() => verifyNotification(note, 1000, key)).toThrow(/AMOUNT_MISMATCH/);
  });

  it("maps expire and deny", () => {
    expect(verifyNotification(notificationFor("ORD-1", 87000, "expired", key), 87000, key)).toBe("expired");
    expect(verifyNotification(notificationFor("ORD-1", 87000, "failed", key), 87000, key)).toBe("failed");
  });

  it("uses the env server key when set", () => {
    expect(midtransServerKey({ MIDTRANS_SERVER_KEY: "real-key" })).toBe("real-key");
    expect(midtransServerKey({})).toBe("SB-Midtrans-dummy");
  });
});
