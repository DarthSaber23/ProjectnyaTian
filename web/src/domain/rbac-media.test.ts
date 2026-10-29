import { describe, expect, it } from "vitest";
import { can } from "./rbac";

describe("products.media", () => {
  it("owner, admin and marketing have products.media; operations and cs do not", () => {
    for (const role of ["owner", "admin", "marketing"] as const) expect(can(role, "products.media")).toBe(true);
    for (const role of ["operations", "cs"] as const) expect(can(role, "products.media")).toBe(false);
  });
});
