import "reflect-metadata";
import { HttpException, type ExecutionContext } from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import { can } from "../domain/rbac";
import type { StaffRole } from "../domain/types";
import { MediaController } from "./media.controller";
import { StaffMediaGuard } from "./staff-media.guard";

const auth = (role: StaffRole) => ({ staff: async () => ({ id: `s_${role}`, name: "Uji", role, email: "uji@example.test" }) });
const context = (handler: unknown, request: object = { headers: { authorization: "Bearer t" } }) =>
  ({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler, getClass: () => MediaController }) as unknown as ExecutionContext;

const routes = Object.getOwnPropertyNames(MediaController.prototype)
  .filter((name) => name !== "constructor")
  .map((name) => (MediaController.prototype as unknown as Record<string, unknown>)[name])
  .filter((handler): handler is Function => typeof handler === "function" && Reflect.getMetadata(PATH_METADATA, handler) !== undefined);

describe("products.media access", () => {
  it.each(["owner", "admin", "marketing"] as const)("%s has products.media and passes the guard with an actor on the request", async (role) => {
    expect(can(role, "products.media")).toBe(true);
    const request: { headers: object; mediaActor?: unknown } = { headers: { authorization: "Bearer t" } };
    await expect(new StaffMediaGuard(auth(role)).canActivate(context(routes[0], request))).resolves.toBe(true);
    expect(request.mediaActor).toEqual({ id: `s_${role}`, label: expect.stringMatching(/^Uji \(/) });
  });

  it.each([["operations", "Operasional"], ["cs", "CS"]] as const)("%s has not products.media and gets 403 on every media route", async (role, label) => {
    expect(can(role, "products.media")).toBe(false);
    expect(routes).toHaveLength(6);
    for (const handler of routes) {
      const error = await new StaffMediaGuard(auth(role)).canActivate(context(handler)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(403);
      expect((error as HttpException).getResponse()).toEqual({ code: "FORBIDDEN", message: `Peran ${label} tidak punya izin untuk aksi ini.` });
    }
  });

  it("the guard is class-level on the controller and no route sets its own guards", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MediaController)).toContain(StaffMediaGuard);
    for (const handler of routes) expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
  });
});
