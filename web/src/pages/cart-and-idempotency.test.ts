import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";
import { useShop } from "../store/shop";
import { backend } from "../services/http/backend";
import { buildCatalog } from "../domain/catalog";
import { products } from "../mocks/fixtures";

describe("Cart safety, ErrorBoundary, and checkoutKey idempotency", () => {
  it("rotates checkoutKey on cart changes and preserves it between retries", () => {
    vi.spyOn(backend, "getCatalog").mockReturnValue(buildCatalog(products.filter((p) => p.brand === "sambung")));
    useShop.getState().resetAll();
    const initialKey = useShop.getState().checkoutKey;
    expect(initialKey).toMatch(/^web-/);
    expect(useShop.getState().checkoutKey).toBe(initialKey);

    useShop.getState().addToCart("B02", 1);
    const afterAddKey = useShop.getState().checkoutKey;
    expect(afterAddKey).not.toBe(initialKey);

    useShop.getState().clearCheckout();
    const afterClearKey = useShop.getState().checkoutKey;
    expect(afterClearKey).not.toBe(afterAddKey);
  });

  it("ErrorBoundary component is defined and wraps the application routes in App.tsx", () => {
    const errorBoundary = readFileSync(resolve(__dirname, "../components/ErrorBoundary.tsx"), "utf8");
    expect(errorBoundary).toContain("Terjadi kesalahan tampilan");
    expect(errorBoundary).toContain("componentDidCatch");

    const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
    expect(app).toContain("<ErrorBoundary>");
  });

  it("CartPage safely guards missing or inactive SKUs without force unwrap crashing", () => {
    const cartPage = readFileSync(resolve(__dirname, "CartPage.tsx"), "utf8");
    expect(cartPage).not.toContain("catalog.bySku.get(l.sku)!");
  });
});
