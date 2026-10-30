import { describe, expect, it } from "vitest";
import { BRANDS } from "./brands";

describe("Brand Halimun anti-slop design tokens", () => {
  it("uses botanical slate palette without banned third-wave cream/terracotta tells", () => {
    const halimun = BRANDS.halimun;
    expect(halimun.colors.bg).toBe("#F9F9FB");
    expect(halimun.colors.primary).toBe("#234132");
    expect(halimun.colors.accent).toBe("#945D3B");
  });

  it("uses clean humanist sans typography instead of editorial cosplay serif", () => {
    const halimun = BRANDS.halimun;
    expect(halimun.fonts.display).toContain("Plus Jakarta Sans");
    expect(halimun.fonts.body).toContain("Plus Jakarta Sans");
  });
});
