import { afterEach, describe, expect, it, vi } from "vitest";
import { serve } from "../../test/fetch-stub";
import { admin } from "./admin";
import { backend } from "./backend";

const rina = { customerId: "C-0001", name: "Rina Pratama", email: "rina@example.com" };
const rinaData = {
  "GET /v1/me/orders": { body: [] },
  "GET /v1/me/wishlist": { body: [] },
  "GET /v1/me/cart?brand=sambung": { body: { lines: [] } },
  "GET /v1/me/consents": { body: {} },
};
const metrics = { "GET /v1/admin/metrics?from=2026-10-14&to=2026-10-20&sessions=1240": { body: { netRevenue: 2097000, paidOrders: 8, aov: 262125, conversionPct: 88.9 } } };
const serverError = { status: 500, body: { error: { code: "INTERNAL", message: "Internal server error" } } };

afterEach(() => vi.unstubAllGlobals());

describe("customer sign-in", () => {
  it("reports wrong credentials with the attempts left", async () => {
    serve({ "POST /v1/auth/sign-in": { status: 401, body: { error: { code: "INVALID_CREDENTIALS", message: "Email atau kata sandi salah.", details: [{ remaining: 3 }] } } } });
    expect(await backend.signIn("rina@example.com", "salah")).toEqual({ ok: false, reason: "invalid", remaining: 3 });
  });

  it("does not call a server failure a wrong password", async () => {
    serve({ "POST /v1/auth/sign-in": serverError });
    await expect(backend.signIn("rina@example.com", "demo-rina-2026")).rejects.toThrow("Akun belum bisa dimuat");
  });

  it("does not call a failed account load a wrong password", async () => {
    serve({ "POST /v1/auth/sign-in": { body: { token: "t", ...rina } }, ...rinaData, "GET /v1/me/orders": serverError });
    await expect(backend.signIn("rina@example.com", "demo-rina-2026")).rejects.toThrow("Akun belum bisa dimuat");
  });
});

describe("session restore after a reload", () => {
  it("finds no customer for a guest", async () => {
    serve({ "GET /v1/auth/session": { body: { customer: null } } });
    expect(await backend.restoreSession()).toBeNull();
  });

  it("restores the customer from the session cookie", async () => {
    serve({ "GET /v1/auth/session": { body: { customer: rina } }, ...rinaData });
    expect(await backend.restoreSession()).toEqual({ ...rina, method: "password" });
  });

  it("restores the staff member", async () => {
    serve({
      "GET /v1/admin/auth/session": { body: { staff: { staffId: "U-01", name: "Andi S.", email: "andi@toko.example", role: "owner" } } },
      "GET /v1/admin/orders": { body: [] },
      ...metrics,
    });
    expect(await admin.restoreSession()).toEqual({ id: "U-01", name: "Andi S.", email: "andi@toko.example", role: "owner" });
  });
});

describe("staff sign-in loads only what the role may see", () => {
  it("lets CS sign in without dashboard access", async () => {
    const calls = serve({
      "POST /v1/admin/auth/sign-in": { body: { token: "t", staffId: "U-04", name: "Akun CS demo", role: "cs" } },
      "GET /v1/admin/orders": { body: [] },
    });
    await expect(admin.signIn("cs@toko.example", "demo-staff-2026", "123456")).resolves.toMatchObject({ role: "cs" });
    expect(calls.some((call) => call.includes("/v1/admin/metrics"))).toBe(false);
  });

  it("lets Marketing sign in without order access", async () => {
    const calls = serve({
      "POST /v1/admin/auth/sign-in": { body: { token: "t", staffId: "U-03", name: "Rina M.", role: "marketing" } },
      ...metrics,
    });
    await expect(admin.signIn("rina.m@toko.example", "demo-staff-2026", "123456")).resolves.toMatchObject({ role: "marketing" });
    expect(calls).not.toContain("GET /v1/admin/orders");
  });
});
