/**
 * Order numbering (I9) and the payment/fulfilment state machine (M1 "States" board).
 * Illegal transitions throw, so UI bugs surface in tests instead of corrupting data.
 */
import type { FulfilmentStatus, PaymentMethod, PaymentStatus } from "./types";
import { addMinutes, yymmdd } from "./time";

export function orderNumber(createdAtIso: string, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 9999) throw new RangeError(`Order sequence out of range: ${seq}`);
  return `ORD-${yymmdd(createdAtIso)}-${String(seq).padStart(4, "0")}`;
}

/** D6: QRIS / e-wallet 15 minutes, virtual account 24 hours. */
export const PAYMENT_WINDOW_MIN: Record<PaymentMethod, number> = { qris: 15, ewallet: 15, va: 24 * 60 };

export function paymentExpiry(createdAtIso: string, method: PaymentMethod): string {
  return addMinutes(createdAtIso, PAYMENT_WINDOW_MIN[method]);
}

const PAYMENT_NEXT: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["paid", "failed", "expired"],
  failed: ["pending", "paid", "expired"], // retry keeps the order open until expiry
  paid: ["refunded", "partially_refunded"],
  partially_refunded: ["partially_refunded", "refunded"],
  expired: [],
  refunded: [],
};

const FULFIL_NEXT: Record<FulfilmentStatus, FulfilmentStatus[]> = {
  awaiting_payment: ["to_process", "cancelled"],
  to_process: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["in_transit", "delivered"],
  in_transit: ["delivered"], // "Diterima" only from a courier event (assumption 8)
  delivered: [],
  cancelled: [],
};

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!PAYMENT_NEXT[from].includes(to)) throw new Error(`Illegal payment transition ${from} → ${to}`);
}

export function assertFulfilmentTransition(from: FulfilmentStatus, to: FulfilmentStatus): void {
  if (!FULFIL_NEXT[from].includes(to)) throw new Error(`Illegal fulfilment transition ${from} → ${to}`);
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Menunggu pembayaran", paid: "Dibayar", failed: "Pembayaran gagal", expired: "Kedaluwarsa",
  refunded: "Direfund", partially_refunded: "Direfund sebagian",
};

export const FULFIL_LABEL: Record<FulfilmentStatus, string> = {
  awaiting_payment: "Menunggu pembayaran", to_process: "Perlu diproses", processing: "Diproses", shipped: "Dikirim",
  in_transit: "Dalam perjalanan", delivered: "Diterima", cancelled: "Dibatalkan",
};

/** H13 rule: shipments with no courier update for more than 72 hours are flagged to the customer. */
export const COURIER_OVERDUE_HOURS = 72;
export function isCourierOverdue(order: { fulfilment: FulfilmentStatus; history: { at: string }[] }, now: string): boolean {
  if (order.fulfilment !== "shipped" && order.fulfilment !== "in_transit") return false;
  const last = order.history[0]?.at;
  return !!last && Date.parse(now) - Date.parse(last) > COURIER_OVERDUE_HOURS * 3_600_000;
}
