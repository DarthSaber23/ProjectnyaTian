import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { can, ROLE_LABEL, type Permission } from "./rbac";

const ALL: Permission[] = [
  "dashboard.view", "analytics.view", "orders.view", "orders.fulfil", "orders.refund", "customers.contact.full", "customers.contact.reveal",
  "promotions.view", "promotions.edit", "reports.export", "audit.view", "users.manage", "products.media", "articles.manage", "seo.edit",
];

describe("SEO role (web mirror)", () => {
  it("owner and seo have articles.manage and seo.edit; others do not", () => {
    for (const role of ["owner", "seo"] as const) expect([can(role, "articles.manage"), can(role, "seo.edit")]).toEqual([true, true]);
    for (const role of ["admin", "operations", "marketing", "cs"] as const) expect([can(role, "articles.manage"), can(role, "seo.edit")]).toEqual([false, false]);
  });

  it("seo has products.media and nothing else", () => {
    expect(ALL.filter((p) => can("seo", p)).sort()).toEqual(["articles.manage", "products.media", "seo.edit"]);
    expect(ROLE_LABEL.seo).toBe("SEO");
  });

  it("the web matrix equals the server matrix", () => {
    const matrix = (file: string) => readFileSync(resolve(__dirname, file), "utf8").match(/const MATRIX[\s\S]*?\n\};/)?.[0];
    expect(matrix("./rbac.ts")).toBe(matrix("../../../server/src/domain/rbac.ts"));
  });

  it("sign-in sends a role without the dashboard but with articles to /admin/blog", () => {
    const shell = readFileSync(resolve(__dirname, "../admin/AdminShell.tsx"), "utf8");
    expect(shell.match(/can\(\w+\.role, "articles\.manage"\) \? "\/admin\/blog"/g)?.length).toBe(2);
  });
});
