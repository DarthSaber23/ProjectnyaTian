import { afterEach, describe, expect, it, vi } from "vitest";
import { admin } from "../services/http/admin";

afterEach(() => vi.unstubAllGlobals());

function stub(body: unknown = {}) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return () => fetchMock.mock.calls.map(([url, init]) => [url, init] as unknown as [string, RequestInit]);
}

describe("admin photo client", () => {
  it("listProducts GETs /v1/admin/products", async () => {
    const calls = stub([]);
    await expect(admin.listProducts()).resolves.toEqual([]);
    expect(calls()[0]![0]).toBe("/v1/admin/products");
  });

  it("uploadPhoto posts multipart to /v1/admin/products/B01/images with credentials include and no content-type", async () => {
    const calls = stub({ id: "img1" });
    await admin.uploadPhoto("B01", new File(["x"], "a.jpg", { type: "image/jpeg" }), "Kabel", true);
    const [url, init] = calls()[0]!;
    expect(url).toBe("/v1/admin/products/B01/images");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBeInstanceOf(FormData);
    expect(new Headers(init.headers).get("content-type")).toBeNull();
    expect((init.body as FormData).get("rightsConfirmed")).toBe("true");
  });

  it("reorderPhotos PUTs { ids }; linkVariantPhoto PUTs { imageId }; deletePhoto DELETEs; changePhotoAlt PATCHes { alt }", async () => {
    const calls = stub({});
    await admin.reorderPhotos("B01", ["b", "a"]);
    await admin.linkVariantPhoto("B01-2M", null);
    await admin.deletePhoto("B01", "a");
    await admin.changePhotoAlt("B01", "b", "Kabel baru");
    const seen = calls().map(([url, init]) => [url, init.method, init.body ?? null]);
    expect(seen).toEqual([
      ["/v1/admin/products/B01/images/order", "PUT", JSON.stringify({ ids: ["b", "a"] })],
      ["/v1/admin/variants/B01-2M/image", "PUT", JSON.stringify({ imageId: null })],
      ["/v1/admin/products/B01/images/a", "DELETE", null],
      ["/v1/admin/products/B01/images/b", "PATCH", JSON.stringify({ alt: "Kabel baru" })],
    ]);
  });

  it("encodes path segments", async () => {
    const calls = stub({});
    await admin.deletePhoto("B 01", "a/b");
    expect(calls()[0]![0]).toBe("/v1/admin/products/B%2001/images/a%2Fb");
  });
});
