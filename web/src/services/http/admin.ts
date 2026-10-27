import type { Order, StaffRole } from "../../domain/types";
import type { Staff } from "../../mocks/fixtures";
import { ApiError, api } from "./client";
import { backend } from "./backend";

export function validateTracking(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  if (!value) return "Nomor resi wajib diisi.";
  if (!/^[A-Z0-9-]{8,30}$/.test(value)) return "Format resi tidak valid: 8–30 huruf/angka/tanda hubung.";
  return null;
}

type Listener = () => void;

class HttpAdmin {
  version = 0;
  private listeners = new Set<Listener>();
  draft: { percentOff: number; start: string; allowVoucher: boolean; status: "draft" | "scheduled"; reviewed: boolean } = { percentOff: 15, start: "2026-10-21T00:00:00+07:00", allowVoucher: true, status: "draft", reviewed: false };
  private reveals = new Map<string, string>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private bump(): void {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  clock(): string {
    return backend.now();
  }

  async signIn(email: string, password: string, totp: string): Promise<Staff> {
    try {
      const result = await api<{ staffId: string; name: string; role: StaffRole }>("/v1/admin/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email, password, totp }),
      });
      await backend.loadStaff(result.role);
      return { id: result.staffId, name: result.name, role: result.role, email };
    } catch (error) {
      throw new Error(error instanceof ApiError ? error.message : "Gagal masuk");
    }
  }

  /** After a page reload: the staff cookie, if still valid, signs the person back in. */
  async restoreSession(): Promise<Staff | null> {
    const { staff } = await api<{ staff: { staffId: string; name: string; email: string; role: StaffRole } | null }>("/v1/admin/auth/session");
    if (!staff) return null;
    await backend.loadStaff(staff.role);
    return { id: staff.staffId, name: staff.name, email: staff.email, role: staff.role };
  }

  async signOut(): Promise<void> {
    await api("/v1/admin/auth/sign-out", { method: "POST" });
  }

  contact(user: Staff, customerId: string): { name: string; email: string; phone: string; address: string; full: boolean; revealedUntil?: string } {
    const revealedUntil = this.reveals.get(`${user.id}:${customerId}`);
    return { name: customerId, email: "", phone: "", address: "", full: false, revealedUntil };
  }

  async loadContact(user: Staff, customerId: string): Promise<{ name: string; email: string; phone: string; address: string; full: boolean; revealedUntil?: string }> {
    const view = await api<{ name: string; email: string; phone: string; address: string; full: boolean }>("/v1/admin/customers/" + customerId + "/contact");
    return { ...view, revealedUntil: this.reveals.get(`${user.id}:${customerId}`) };
  }

  process(user: Staff, number: string): Promise<Order> {
    return this.mutate(user, `/v1/admin/orders/${number}/process`, {});
  }

  ship(user: Staff, number: string, tracking: string): Promise<Order> {
    return this.mutate(user, `/v1/admin/orders/${number}/ship`, { trackingNumber: tracking });
  }

  refund(user: Staff, number: string, amount: number, reason: string, restock: boolean): Promise<Order> {
    return this.mutate(user, `/v1/admin/orders/${number}/refunds`, { amount, reason, restock });
  }

  async reveal(user: Staff, customerId: string, reason: string, orderNumber: string): Promise<string> {
    const result = await api<{ until: string }>(`/v1/admin/customers/${customerId}/contact-reveals`, {
      method: "POST",
      body: JSON.stringify({ reason, orderNumber }),
    });
    this.reveals.set(`${user.id}:${customerId}`, result.until);
    this.bump();
    return result.until;
  }

  remask(user: Staff, customerId: string): void {
    this.reveals.delete(`${user.id}:${customerId}`);
    this.bump();
  }

  auditLog(_user: Staff) {
    return this.audit;
  }

  audit: { at: string; actor: string; code: string; action: string; object: string }[] = [];

  async loadAudit(): Promise<void> {
    this.audit = await api("/v1/admin/audit-log");
    this.bump();
  }

  draftPromotion() {
    return { kind: "price" as const, code: "CHARGER15", label: "Diskon Charger", percentOff: this.draft.percentOff, appliesTo: { categoryIds: ["charger"] }, isFlashSale: false, window: { start: this.draft.start, end: "2026-10-31T23:59:59+07:00" } };
  }

  updateDraft(_user: Staff, patch: Partial<typeof this.draft>): void {
    this.draft = { ...this.draft, ...patch, status: "draft" };
    this.bump();
  }

  schedule(_user: Staff): void {
    this.draft = { ...this.draft, status: "draft" };
    throw new Error("Penjadwalan promosi baru belum tersedia di API.");
  }

  private async mutate(user: Staff, path: string, body: unknown): Promise<Order> {
    try {
      const order = await api<Order>(path, { method: "POST", body: JSON.stringify(body) });
      await backend.loadStaff(user.role);
      this.bump();
      return order;
    } catch (error) {
      throw new Error(error instanceof ApiError ? error.message : "Aksi gagal");
    }
  }
}

export const admin = new HttpAdmin();
export function resetMocks(): void {
  backend.reset();
}
