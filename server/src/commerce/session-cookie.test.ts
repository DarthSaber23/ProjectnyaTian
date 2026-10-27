import { describe, expect, it } from "vitest";
import { bearerFromCookie, clearedCookie, corsOrigins, crossSiteWrite, isHttps, sessionCookie, withoutBrowserToken } from "./session-cookie";

describe("sessionCookie", () => {
  it("keeps the customer token away from page scripts and other sites", () => {
    expect(sessionCookie("customer", "abc", false, 604800)).toBe("tian_session=abc; Path=/v1; Max-Age=604800; HttpOnly; SameSite=Lax");
  });

  it("ends the staff cookie with the browser session and marks it Secure over HTTPS", () => {
    expect(sessionCookie("staff", "def", true)).toBe("tian_staff=def; Path=/v1/admin; HttpOnly; SameSite=Lax; Secure");
  });

  it("expires the cookie on sign-out", () => {
    expect(clearedCookie("staff", false)).toBe("tian_staff=; Path=/v1/admin; Max-Age=0; HttpOnly; SameSite=Lax");
  });
});

describe("isHttps", () => {
  it("trusts the proxy's forwarded scheme", () => {
    expect(isHttps({ protocol: "http", headers: { "x-forwarded-proto": "https" } })).toBe(true);
    expect(isHttps({ protocol: "http", headers: {} })).toBe(false);
  });
});

describe("bearerFromCookie", () => {
  const cookie = "tian_session=cust; tian_staff=staff";

  it("uses the customer cookie on storefront routes", () => {
    expect(bearerFromCookie({ path: "/v1/me/orders", cookie })).toBe("Bearer cust");
  });

  it("uses the staff cookie on admin routes", () => {
    expect(bearerFromCookie({ path: "/v1/admin/orders", cookie })).toBe("Bearer staff");
  });

  it("does not treat a look-alike path as an admin route", () => {
    expect(bearerFromCookie({ path: "/v1/administrator", cookie })).toBe("Bearer cust");
  });

  it("returns nothing without the cookie", () => {
    expect(bearerFromCookie({ path: "/v1/me/orders" })).toBeUndefined();
  });
});

describe("crossSiteWrite", () => {
  const host = "43.159.54.222";

  it("flags a write sent from another site, including a sign-in form", () => {
    expect(crossSiteWrite({ method: "POST", host, origin: "https://evil.example" })).toBe(true);
  });

  it("accepts a write from the site itself", () => {
    expect(crossSiteWrite({ method: "POST", host, origin: "http://43.159.54.222" })).toBe(false);
  });

  it("matches the site when the proxy drops the port from Host", () => {
    expect(crossSiteWrite({ method: "POST", host: "localhost", origin: "http://localhost:8081" })).toBe(false);
  });

  it("allows reads from anywhere", () => {
    expect(crossSiteWrite({ method: "GET", host, origin: "https://evil.example" })).toBe(false);
  });

  it("allows server-to-server calls such as gateway webhooks, which send no Origin", () => {
    expect(crossSiteWrite({ method: "POST", host })).toBe(false);
  });
});

describe("withoutBrowserToken", () => {
  const result = { token: "secret", customerId: "C-0001" };

  it("keeps the token out of a browser's reach", () => {
    expect(withoutBrowserToken(result, "http://43.159.54.222")).toEqual({ customerId: "C-0001" });
  });

  it("still returns the token to scripts, which send no Origin", () => {
    expect(withoutBrowserToken(result, undefined)).toEqual(result);
  });
});

describe("corsOrigins", () => {
  it("allows no cross-origin callers by default", () => {
    expect(corsOrigins(undefined)).toEqual([]);
  });

  it("reads a comma-separated list", () => {
    expect(corsOrigins(" http://localhost:5173 , https://toko.example ")).toEqual(["http://localhost:5173", "https://toko.example"]);
  });
});
