import { maskEmail, maskPhone } from "../domain/rbac";
import type { StaffRole } from "../domain/types";

export interface ContactRecord {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface ContactView extends ContactRecord {
  full: boolean;
}

/** C2. Full access, or a reveal whose until is still in the future, shows the raw contact. */
export function visibleContact(
  role: StaffRole,
  customer: ContactRecord,
  revealUntil: string | undefined,
  nowIso: string,
): ContactView {
  const canFull = role === "owner" || role === "admin";
  const canReveal = role === "operations" || role === "cs";
  const revealed = canReveal && !!revealUntil && Date.parse(nowIso) < Date.parse(revealUntil);
  if (canFull || revealed) return { ...customer, full: true };
  const street = customer.address.includes(",")
    ? customer.address.replace(/^[^,]+,\s*/, "Jalan disamarkan, ")
    : "Jalan disamarkan";
  return {
    ...(customer.id ? { id: customer.id } : {}),
    name: customer.name,
    email: maskEmail(customer.email),
    phone: maskPhone(customer.phone),
    address: street,
    full: false,
  };
}
