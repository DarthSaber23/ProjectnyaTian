import { describe, expect, it } from "vitest";
import { maySend } from "./notify";

const none = { emailPromo: false, waOrderInfo: false };
const both = { emailPromo: true, waOrderInfo: true };

describe("maySend", () => {
  it("always allows transactional email", () => {
    expect(maySend("email", "transactional", none)).toBe(true);
  });

  it("never allows WhatsApp marketing", () => {
    expect(maySend("whatsapp", "marketing", both)).toBe(false);
  });

  it("allows transactional WhatsApp only with waOrderInfo", () => {
    expect(maySend("whatsapp", "transactional", none)).toBe(false);
    expect(maySend("whatsapp", "transactional", { emailPromo: false, waOrderInfo: true })).toBe(true);
  });

  it("allows marketing email only with emailPromo", () => {
    expect(maySend("email", "marketing", none)).toBe(false);
    expect(maySend("email", "marketing", { emailPromo: true, waOrderInfo: false })).toBe(true);
  });
});
