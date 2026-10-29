import { describe, expect, it } from "vitest";
import { cachePolicy } from "./cache-policy";

const CATALOGUE = "public, max-age=15, stale-while-revalidate=45";
const CONTENT = "public, max-age=300";
const NO_STORE = "private, no-store";

describe("cachePolicy", () => {
  it("lets browsers reuse catalogue reads for a few seconds", () => {
    expect(cachePolicy("GET", "/v1/catalog")).toBe(CATALOGUE);
    expect(cachePolicy("GET", "/v1/products/kabel-usb-c-100w-braided")).toBe(CATALOGUE);
    expect(cachePolicy("GET", "/v1/promotions/active")).toBe(CATALOGUE);
    expect(cachePolicy("HEAD", "/v1/catalog")).toBe(CATALOGUE);
  });

  it("keeps content pages for five minutes", () => {
    expect(cachePolicy("GET", "/v1/pages")).toBe(CONTENT);
    expect(cachePolicy("GET", "/v1/pages/tentang")).toBe(CONTENT);
  });

  it("never stores account, admin or sign-in responses", () => {
    for (const path of ["/v1/me/orders", "/v1/me/addresses", "/v1/admin/orders", "/v1/admin/customers/C-0001/contact", "/v1/auth/session"]) {
      expect(cachePolicy("GET", path)).toBe(NO_STORE);
    }
  });

  it("never stores writes, even on a catalogue path", () => {
    expect(cachePolicy("POST", "/v1/cart/price")).toBe(NO_STORE);
    expect(cachePolicy("POST", "/v1/webhooks/payment/midtrans")).toBe(NO_STORE);
    expect(cachePolicy("POST", "/v1/catalog")).toBe(NO_STORE);
  });

  it("admin media routes stay private, no-store", () => {
    expect(cachePolicy("GET", "/v1/admin/products")).toBe(NO_STORE);
    expect(cachePolicy("POST", "/v1/admin/products/B01/images")).toBe(NO_STORE);
    expect(cachePolicy("PUT", "/v1/admin/products/B01/images/order")).toBe(NO_STORE);
    expect(cachePolicy("PUT", "/v1/admin/variants/B01-1M/image")).toBe(NO_STORE);
  });

  it("does not treat look-alike or nested paths as public", () => {
    expect(cachePolicy("GET", "/v1/catalog/extra")).toBe(NO_STORE);
    expect(cachePolicy("GET", "/v1/products/a/b")).toBe(NO_STORE);
    expect(cachePolicy("GET", "/health")).toBe(NO_STORE);
  });
});
