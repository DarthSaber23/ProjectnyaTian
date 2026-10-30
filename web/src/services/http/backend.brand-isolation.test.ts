import { describe, expect, it, vi, beforeEach } from "vitest";
import * as client from "./client";
import { backend } from "./backend";

describe("HttpBackend brand-isolated hydration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("hydrates cart and wishlist for the requested brand instead of hardcoding sambung", async () => {
    const calls: string[] = [];
    vi.spyOn(client, "api").mockImplementation((async (path: string) => {
      calls.push(path);
      if (path === "/v1/me/orders") return [];
      if (path === "/v1/me/wishlist") return [{ productId: "A01" }];
      if (path === "/v1/me/cart?brand=halimun") return { lines: [{ sku: "A01-100", qty: 2 }] };
      if (path === "/v1/me/cart?brand=sambung") return { lines: [{ sku: "B02", qty: 1 }] };
      if (path === "/v1/me/consents") return {};
      return {};
    }) as never);

    await backend.loadCustomer("C-0001", "halimun");
    expect(calls).toContain("/v1/me/cart?brand=halimun");
    expect(backend.savedCart("C-0001", "halimun")).toEqual([{ sku: "A01-100", qty: 2 }]);
    expect(backend.wishlist("C-0001", "halimun")).toContain("A01");
  });
});
