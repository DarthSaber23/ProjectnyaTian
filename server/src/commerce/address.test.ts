import { describe, expect, it } from "vitest";
import { validateAddress } from "./address";

const valid = {
  recipient: "Rina Pratama",
  phone: "0812-0000-1234",
  province: "Jawa Barat",
  city: "Kota Bandung",
  district: "Coblong",
  postalCode: "40132",
  detail: "Jl. Melati No. 12",
};

describe("validateAddress", () => {
  it("accepts a D13 address and normalises the phone", () => {
    const result = validateAddress(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.phone).toBe("081200001234");
  });

  it("rejects a missing province", () => {
    const result = validateAddress({ ...valid, province: " " });
    expect(result.ok).toBe(false);
  });

  it("rejects a short phone", () => {
    expect(validateAddress({ ...valid, phone: "123" }).ok).toBe(false);
  });

  it("accepts +62 and rejects a landline", () => {
    const accepted = validateAddress({ ...valid, phone: "+6281200001234" });
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.value.phone).toBe("081200001234");
    expect(validateAddress({ ...valid, phone: "0217654321" }).ok).toBe(false);
  });
});
