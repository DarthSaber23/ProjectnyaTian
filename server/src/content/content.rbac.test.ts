import "reflect-metadata";
import { HttpException, type ExecutionContext } from "@nestjs/common";
import { GUARDS_METADATA, INTERCEPTORS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import type { StaffRole } from "../domain/types";
import { AdminContentController } from "./admin-content.controller";
import { PermissionGuard } from "./permission.guard";

const proto = AdminContentController.prototype as unknown as Record<string, unknown>;
const routes = Object.getOwnPropertyNames(proto)
  .filter((name) => name !== "constructor" && typeof proto[name] === "function" && Reflect.getMetadata(PATH_METADATA, proto[name] as object) !== undefined)
  .map((name) => ({ name, handler: proto[name] as () => void }));
const articleRoutes = ["list", "create", "get", "save", "publish", "unpublish", "remove", "setCover", "removeCover", "addImage"];
const seoRoutes = ["seoRows", "setSeo", "clearSeo"];

const guard = (role?: StaffRole) => new PermissionGuard({
  staff: async () => {
    if (!role) throw new HttpException({ code: "UNAUTHORIZED", message: "Sesi tidak berlaku." }, 401);
    return { id: "s", name: "Uji", role, email: "u@toko.example" };
  },
}, new Reflector());
const context = (handler: () => void) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: "Bearer t" } }) }), getHandler: () => handler, getClass: () => AdminContentController }) as unknown as ExecutionContext;
const status = (p: Promise<unknown>) => p.then(() => 200, (e: unknown) => (e instanceof HttpException ? e.getStatus() : 500));

describe("admin content routes: access", () => {
  it("has exactly the 13 routes of spec section 3", () => {
    expect(routes.map((r) => r.name).sort()).toEqual([...articleRoutes, ...seoRoutes].sort());
  });

  it("the guard is class-level and no route sets its own guard; uploads have their interceptor at method level", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminContentController)).toContain(PermissionGuard);
    for (const r of routes) expect(Reflect.getMetadata(GUARDS_METADATA, r.handler)).toBeUndefined();
    for (const name of ["setCover", "addImage"]) expect(Reflect.getMetadata(INTERCEPTORS_METADATA, proto[name] as object)).toHaveLength(1);
  });

  it.each(["owner", "seo"] as const)("%s reaches every route", async (role) => {
    for (const r of routes) expect(await status(guard(role).canActivate(context(r.handler))), r.name).toBe(200);
  });

  it.each(["admin", "marketing", "operations", "cs"] as const)("%s gets 403 on every route", async (role) => {
    for (const r of routes) expect(await status(guard(role).canActivate(context(r.handler))), r.name).toBe(403);
  });

  it("no session gets 401 on every route", async () => {
    for (const r of routes) expect(await status(guard().canActivate(context(r.handler))), r.name).toBe(401);
  });
});
