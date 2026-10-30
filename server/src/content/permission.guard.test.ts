import "reflect-metadata";
import { HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { can, ROLE_LABEL, type Permission } from "../domain/rbac";
import type { StaffRole } from "../domain/types";
import { PermissionGuard, RequirePermission } from "./permission.guard";

class Routes {
  @RequirePermission("articles.manage")
  articles() {}

  @RequirePermission("orders.view")
  orders() {}
}

const auth = (role?: StaffRole) => ({
  staff: async () => {
    if (!role) throw new HttpException({ code: "UNAUTHORIZED", message: "Sesi tidak berlaku." }, 401);
    return { id: `s_${role}`, name: "Sinta P.", role, email: "sinta@toko.example" };
  },
});
const context = (handler: () => void, request: object) =>
  ({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler, getClass: () => Routes }) as unknown as ExecutionContext;
const guard = (role?: StaffRole) => new PermissionGuard(auth(role), new Reflector());
const status = async (p: Promise<unknown>) => p.then(() => 200, (e: unknown) => (e instanceof HttpException ? e.getStatus() : 500));

const ALL: Permission[] = [
  "dashboard.view", "analytics.view", "orders.view", "orders.fulfil", "orders.refund", "customers.contact.full", "customers.contact.reveal",
  "promotions.view", "promotions.edit", "reports.export", "audit.view", "users.manage", "products.media", "articles.manage", "seo.edit",
];

describe("SEO role and content permissions", () => {
  it.each(["owner", "seo"] as const)("%s has articles.manage and seo.edit", (role) => {
    expect(can(role, "articles.manage")).toBe(true);
    expect(can(role, "seo.edit")).toBe(true);
  });

  it.each(["admin", "operations", "marketing", "cs"] as const)("%s has neither", (role) => {
    expect(can(role, "articles.manage")).toBe(false);
    expect(can(role, "seo.edit")).toBe(false);
  });

  it("seo has products.media and nothing else", () => {
    expect(ALL.filter((p) => can("seo", p)).sort()).toEqual(["articles.manage", "products.media", "seo.edit"]);
    expect(ROLE_LABEL.seo).toBe("SEO");
  });
});

describe("PermissionGuard", () => {
  it("no session gives 401", async () => {
    expect(await status(guard().canActivate(context(Routes.prototype.articles, { headers: {} })))).toBe(401);
  });

  it("seo on a route marked orders.view gives 403 with the role message", async () => {
    const error = await guard("seo").canActivate(context(Routes.prototype.orders, { headers: { authorization: "Bearer t" } })).catch((e: unknown) => e);
    expect((error as HttpException).getStatus()).toBe(403);
    expect((error as HttpException).getResponse()).toEqual({ code: "FORBIDDEN", message: "Peran SEO tidak punya izin untuk aksi ini." });
  });

  it("seo on articles.manage passes and sets staffActor", async () => {
    const request: { headers: object; staffActor?: unknown } = { headers: { authorization: "Bearer t" } };
    await expect(guard("seo").canActivate(context(Routes.prototype.articles, request))).resolves.toBe(true);
    expect(request.staffActor).toEqual({ id: "s_seo", label: "Sinta P. (SEO)" });
  });

  it("a route without @RequirePermission is refused (deny by default)", async () => {
    expect(await status(guard("owner").canActivate(context(function bare() {}, { headers: { authorization: "Bearer t" } })))).toBe(403);
  });
});
