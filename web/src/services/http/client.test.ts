import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiUrl } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("a FormData body sends no content-type header and keeps credentials include", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("alt", "Kabel");
    await api("/v1/admin/products/B01/images", { method: "POST", body: form });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("content-type")).toBeNull();
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(form);
  });

  it("a JSON string body still gets application/json", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await api("/v1/cart/price", { method: "POST", body: "{}" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("a non-JSON error body yields an ApiError, not a SyntaxError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" })));
    await expect(api("/v1/catalog")).rejects.toMatchObject({ code: "HTTP", message: "Bad Gateway" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html></html>", { status: 500 })));
    await expect(api("/v1/catalog")).rejects.toMatchObject({ code: "HTTP", message: "Permintaan gagal." });
  });

  it("a non-JSON success body yields BAD_RESPONSE; an empty body stays {}", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html></html>", { status: 200 })));
    await expect(api("/v1/catalog")).rejects.toMatchObject({ code: "BAD_RESPONSE", message: "Respons server tidak dapat dibaca." });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));
    await expect(api("/v1/catalog")).resolves.toEqual({});
  });

  it("a 413 maps to TOO_LARGE with the Bahasa message whatever the body", async () => {
    for (const body of ["<html>413 Request Entity Too Large</html>", JSON.stringify({ error: { code: "X", message: "y" } })]) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 413 })));
      await expect(api("/v1/admin/products/B01/images", { method: "POST", body: new FormData() }))
        .rejects.toMatchObject({ code: "TOO_LARGE", message: "Ukuran file maksimal 10 MB." });
    }
  });

  it("sends the session cookie and Idempotency-Key, never a token page scripts could read", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await api("/v1/orders", { method: "POST", body: "{}", idempotencyKey: "key-1" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(init.credentials).toBe("include");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("idempotency-key")).toBe("key-1");
  });
});
