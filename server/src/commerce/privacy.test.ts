import { describe, expect, it } from "vitest";
import { visibleContact } from "./privacy";

const customer = {
  name: "Citra W.",
  email: "citra@example.com",
  phone: "081200003356",
  address: "Jl. Anggrek No. 3, Kec. Tebet",
};

describe("visibleContact", () => {
  it("shows the owner the full contact", () => {
    expect(visibleContact("owner", customer, undefined, "2026-10-21T10:00:00+07:00").full).toBe(true);
  });

  it("masks CS without a reveal", () => {
    const view = visibleContact("cs", customer, undefined, "2026-10-21T10:00:00+07:00");
    expect(view.full).toBe(false);
    expect(view.email).not.toBe(customer.email);
  });

  it("shows CS the full contact only before until", () => {
    expect(visibleContact("cs", customer, "2026-10-21T10:01:00+07:00", "2026-10-21T10:00:00+07:00").full).toBe(true);
    expect(visibleContact("cs", customer, "2026-10-21T09:59:00+07:00", "2026-10-21T10:00:00+07:00").full).toBe(false);
  });

  it("does not unmask Marketing even with a reveal", () => {
    expect(visibleContact("marketing", customer, "2026-10-21T10:01:00+07:00", "2026-10-21T10:00:00+07:00").full).toBe(false);
  });

  it("masks a street that has no comma", () => {
    const view = visibleContact("cs", { ...customer, address: "Jl. Anggrek No. 3" }, undefined, "2026-10-21T10:00:00+07:00");
    expect(view.address).toBe("Jalan disamarkan");
  });
});
