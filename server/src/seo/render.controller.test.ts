import { afterEach, describe, expect, it, vi } from "vitest";
import { RenderController } from "./render.controller";
import type { RenderService } from "./render.service";

function reply() {
  const headers: Record<string, string> = { "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "Cache-Control": "private, no-store" };
  return {
    headers,
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    setHeader(name: string, value: string) { headers[name] = value; },
    removeHeader(name: string) { delete headers[name]; },
  };
}

afterEach(() => { delete process.env.PUBLIC_BASE_URL; });

describe("RenderController", () => {
  it("serves the rendered page with its status and headers, without the API's CSP", async () => {
    const render = { render: vi.fn(async () => ({ status: 200, body: "<html></html>", headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", ETag: '"a"' } })) };
    const res = reply();
    const body = await new RenderController(render as unknown as RenderService).page("/blog/a", "2", '"b"', res);
    expect(render.render).toHaveBeenCalledWith("/blog/a", { page: 2, ifNoneMatch: '"b"' });
    expect(body).toBe("<html></html>");
    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", ETag: '"a"' });
    expect(res.headers["Content-Security-Policy"]).toBeUndefined();
  });

  it("a missing path renders the not-found page", async () => {
    const render = { render: vi.fn(async () => ({ status: 404, body: "x", headers: {} })) };
    const res = reply();
    await new RenderController(render as unknown as RenderService).page(undefined as unknown as string, undefined as unknown as string, undefined as unknown as string, res);
    expect(render.render).toHaveBeenCalledWith("/", { page: 1, ifNoneMatch: undefined });
    expect(res.statusCode).toBe(404);
  });

  it("sitemap.xml and robots.txt have their content types and one-hour public caching", async () => {
    process.env.PUBLIC_BASE_URL = "http://shop.test";
    const render = { sitemap: vi.fn(async () => "<urlset/>") };
    const c = new RenderController(render as unknown as RenderService);
    const res = reply();
    expect(await c.sitemap(res)).toBe("<urlset/>");
    expect(res.headers).toMatchObject({ "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
    const r2 = reply();
    expect(c.robots(r2)).toContain("Sitemap: http://shop.test/sitemap.xml");
    expect(r2.headers).toMatchObject({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" });
  });
});
