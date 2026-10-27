import { describe, expect, it } from "vitest";
import type { PrismaService } from "../prisma.service";
import { AuthService } from "./auth.service";
import { sha256 } from "./crypto";

const later = "2099-01-01T00:00:00+07:00";
const sessions = new Map([
  [sha256("cust-token"), { tokenHash: sha256("cust-token"), kind: "customer", subjectId: "C-0001", expiresAt: later }],
  [sha256("staff-token"), { tokenHash: sha256("staff-token"), kind: "staff", subjectId: "U-01", expiresAt: later }],
]);
const prisma = {
  sessionToken: { findUnique: async ({ where }: { where: { tokenHash: string } }) => sessions.get(where.tokenHash) ?? null },
  customerAccount: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === "C-0001" ? { id: "C-0001", name: "Rina Pratama", email: "rina@example.com" } : null) },
  staffAccount: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === "U-01" ? { id: "U-01", name: "Andi S.", email: "andi@toko.example", role: "owner" } : null) },
} as unknown as PrismaService;
const auth = new AuthService(prisma);

describe("AuthService sessions", () => {
  it("restores no customer when the browser has no session", async () => {
    expect(await auth.customerSession(undefined)).toBeNull();
  });

  it("does not accept a staff token as a customer session", async () => {
    expect(await auth.customerSession("Bearer staff-token")).toBeNull();
  });

  it("restores the signed-in customer", async () => {
    expect(await auth.customerSession("Bearer cust-token")).toEqual({ customerId: "C-0001", name: "Rina Pratama", email: "rina@example.com" });
  });

  it("restores the signed-in staff member with their role", async () => {
    expect(await auth.staffSession("Bearer staff-token")).toEqual({ staffId: "U-01", name: "Andi S.", email: "andi@toko.example", role: "owner" });
  });

  it("reports a database failure instead of treating the customer as signed out", async () => {
    const down = new AuthService({
      sessionToken: { findUnique: async () => { throw new Error("connection refused"); } },
    } as unknown as PrismaService);
    await expect(down.customerSession("Bearer cust-token")).rejects.toThrow("connection refused");
  });
});
