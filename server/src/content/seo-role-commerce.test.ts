import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { StaffRole } from "../domain/types";
import { AdminService } from "../commerce/admin.service";
import type { AuthService } from "../commerce/auth.service";
import type { CatalogService } from "../commerce/catalog.service";
import { CommerceController } from "../commerce/commerce.controller";
import type { PrismaService } from "../prisma.service";

// Spec section 9: the SEO role (demo account U-05) must be shut out of every commerce admin route.
const tables = {
  orderRecord: { findMany: async () => [], findUnique: async () => null, findFirst: async () => null },
  promotion: { findFirst: async () => ({ rule: { code: "HEMAT10" } }) },
  auditRecord: { findMany: async () => [] },
  revealGrant: { findFirst: async () => null },
};
const prisma = new Proxy(tables, {
  get: (target, key) => (key in target ? target[key as keyof typeof target] : () => { throw new Error("db reached"); }),
}) as unknown as PrismaService;

const controllerFor = (role: StaffRole) => {
  const auth = { staff: async () => ({ id: role === "seo" ? "U-05" : "U-01", name: "Uji", role, email: "u@toko.example" }) } as unknown as AuthService;
  const admin = new AdminService(prisma, auth, {} as CatalogService);
  return new CommerceController({} as never, {} as never, auth, admin, {} as never);
};

const status = (p: Promise<unknown> | unknown) =>
  Promise.resolve(p).then(() => 200, (e: unknown) => (e instanceof HttpException ? e.getStatus() : 500));

// Third column: a role that holds the permission (owner sees full contact, so only ops/cs may use the reveal flow).
const calls: [string, (c: CommerceController) => unknown, StaffRole][] = [
  ["GET admin/orders", (c) => c.adminOrders("Bearer t"), "owner"],
  ["GET admin/customers", (c) => c.adminCustomers("Bearer t"), "owner"],
  ["GET admin/promotions/:code", (c) => c.adminPromotion("Bearer t", "HEMAT10"), "owner"],
  ["GET admin/audit-log", (c) => c.audit("Bearer t"), "owner"],
  ["GET admin/metrics", (c) => c.metrics("Bearer t", "2026-10-14", "2026-10-20", "1240"), "owner"],
  ["POST admin/orders/:number/process", (c) => c.process("Bearer t", "ORD-261027-0002"), "owner"],
  ["POST admin/orders/:number/ship", (c) => c.ship("Bearer t", "ORD-261027-0002", { trackingNumber: "JNE123" }), "owner"],
  ["POST admin/orders/:number/refunds", (c) => c.refund("Bearer t", "ORD-261027-0002", { amount: 1000, reason: "Uji", restock: false }), "owner"],
  ["GET admin/customers/:id/contact", (c) => c.contact("Bearer t", "C-0001"), "owner"],
  ["POST admin/customers/:id/contact-reveals", (c) => c.reveal("Bearer t", "C-0001", { reason: "Konfirmasi alamat", orderNumber: "ORD-261027-0002" }), "operations"],
];

describe("seo role on commerce admin routes", () => {
  it.each(calls)("seo gets 403 on %s", async (_name, call) => {
    expect(await status(call(controllerFor("seo")))).toBe(403);
  });

  it.each(calls)("a permitted role gets past the permission check on %s", async (_name, call, allowed) => {
    expect(await status(call(controllerFor(allowed)))).not.toBe(403);
  });

  it("the 403 carries the FORBIDDEN code", async () => {
    const err = await Promise.resolve(controllerFor("seo").adminOrders("Bearer t")).catch((e: unknown) => e);
    expect((err as HttpException).getResponse()).toMatchObject({ code: "FORBIDDEN" });
  });
});
