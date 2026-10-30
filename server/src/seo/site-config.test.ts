import { afterEach, describe, expect, it, vi } from "vitest";
import { siteConfig } from "./site-config";

afterEach(() => { vi.unstubAllEnvs(); delete process.env.PUBLIC_BASE_URL; });

describe("siteConfig PUBLIC_BASE_URL (findings 20/26)", () => {
  it("accepts http(s) origins with an optional port and trims trailing slashes", () => {
    for (const [value, expected] of [
      ["http://43.159.54.222", "http://43.159.54.222"],
      ["https://shop.example.co.id/", "https://shop.example.co.id"],
      [" http://localhost:5173// ", "http://localhost:5173"],
    ] as const) {
      process.env.PUBLIC_BASE_URL = value;
      expect(siteConfig().baseUrl).toBe(expected);
    }
  });

  it("refuses a value that is not a bare http(s) origin, naming the variable", () => {
    for (const value of ["shop.example.com", "ftp://shop.test", "http://shop.test/blog", "http://shop.test?x=1", "http://", "https://shop.test:abc", "http://user@shop.test", "http://shop test"]) {
      process.env.PUBLIC_BASE_URL = value;
      expect(() => siteConfig(), value).toThrow(/PUBLIC_BASE_URL/);
    }
  });

  it("falls back to http://localhost outside production when unset or empty", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(siteConfig().baseUrl).toBe("http://localhost");
    process.env.PUBLIC_BASE_URL = "  ";
    expect(siteConfig().baseUrl).toBe("http://localhost");
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.PUBLIC_BASE_URL;
    expect(siteConfig().baseUrl).toBe("http://localhost");
  });

  it("in production a missing or empty value is an error naming PUBLIC_BASE_URL; a valid one works", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => siteConfig()).toThrow(/PUBLIC_BASE_URL/);
    process.env.PUBLIC_BASE_URL = "";
    expect(() => siteConfig()).toThrow(/PUBLIC_BASE_URL/);
    process.env.PUBLIC_BASE_URL = "http://43.159.54.222";
    expect(siteConfig().baseUrl).toBe("http://43.159.54.222");
  });
});
