/**
 * Admin access matrix (A17 / decision C8). Least privilege: anything not listed is denied.
 * Server-side enforcement is mandatory in production (Agent 02); the UI only mirrors it.
 */
import type { StaffRole } from "./types";

export type Permission =
  | "dashboard.view" | "analytics.view"
  | "orders.view" | "orders.fulfil" | "orders.refund"
  | "customers.contact.full" | "customers.contact.reveal"
  | "promotions.view" | "promotions.edit"
  | "reports.export" | "audit.view" | "users.manage";

const MATRIX: Record<StaffRole, Permission[]> = {
  owner: ["dashboard.view", "analytics.view", "orders.view", "orders.fulfil", "orders.refund", "customers.contact.full", "promotions.view", "promotions.edit", "reports.export", "audit.view", "users.manage"],
  admin: ["dashboard.view", "analytics.view", "orders.view", "orders.fulfil", "orders.refund", "customers.contact.full", "promotions.view", "promotions.edit", "reports.export", "audit.view"],
  operations: ["dashboard.view", "analytics.view", "orders.view", "orders.fulfil", "customers.contact.reveal"],
  marketing: ["dashboard.view", "analytics.view", "promotions.view", "promotions.edit"],
  cs: ["orders.view", "customers.contact.reveal"],
};

export function can(role: StaffRole | undefined, p: Permission): boolean {
  return !!role && MATRIX[role].includes(p);
}

export const ROLE_LABEL: Record<StaffRole, string> = { owner: "Owner", admin: "Admin", operations: "Operasional", marketing: "Marketing", cs: "CS" };

/** C2: contact reveal requires one of these reasons and lasts 60 seconds. */
export const REVEAL_REASONS = ["Konfirmasi pengiriman pesanan", "Tindak lanjut tiket bantuan", "Verifikasi refund"] as const;
export const REVEAL_SECONDS = 60;

export function maskEmail(e: string): string {
  const [user = "", domain = ""] = e.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}
export function maskPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  return `${digits.slice(0, 4)}-****-${digits.slice(-4)}`;
}
