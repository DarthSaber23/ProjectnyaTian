import { describe, expect, it } from "vitest";
import { assertProviderConfigured } from "./providers";

describe("assertProviderConfigured", () => {
  it("throws when the Midtrans server key is missing", () => {
    expect(() => assertProviderConfigured("midtrans", {})).toThrow(/MIDTRANS_SERVER_KEY/);
  });

  it("rejects a blank key", () => {
    expect(() => assertProviderConfigured("duitku", { DUITKU_API_KEY: " " })).toThrow(/DUITKU_API_KEY/);
    expect(() => assertProviderConfigured("duitku", { DUITKU_API_KEY: "" })).toThrow(/DUITKU_API_KEY/);
  });

  it("returns when the key is present", () => {
    expect(() => assertProviderConfigured("biteship", { BITESHIP_API_KEY: "sandbox" })).not.toThrow();
  });
});
