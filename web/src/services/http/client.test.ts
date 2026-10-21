import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiUrl, setCustomerToken } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  setCustomerToken(null);
});

describe("api client", () => {
  it("uses a relative /v1 path when VITE_API_URL is unset", () => {
    expect(apiUrl("/v1/catalog")).toBe("/v1/catalog");
  });

  it("throws ApiError with code and details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: { code: "STOCK_SHORTAGE", message: "Stok tidak cukup", details: [{ sku: "B07" }] },
    }), { status: 409 })));
    await expect(api("/v1/orders", { method: "POST", body: "{}" })).rejects.toMatchObject({
      code: "STOCK_SHORTAGE",
      details: [{ sku: "B07" }],
    });
    await expect(api("/v1/orders", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(ApiError);
  });

  it("sends the bearer token and Idempotency-Key", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setCustomerToken("abc");
    await api("/v1/orders", { method: "POST", body: "{}", idempotencyKey: "key-1" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer abc");
    expect(headers.get("idempotency-key")).toBe("key-1");
  });
});
