import { buildCatalog } from "../domain/catalog";
import { paymentExpiry } from "../domain/orders";
import { computeTotals } from "../domain/pricing";
import { addMinutes } from "../domain/time";
import type { FulfilmentStatus, Order } from "../domain/types";
import { demoCustomer, products, seedOrder0003, seedOrders, shippingQuotes } from "../data/fixtures";

const FULFILMENT: Record<string, FulfilmentStatus> = {
  delivered: "delivered",
  in_transit: "in_transit",
  processing: "processing",
  to_process: "to_process",
  expired: "cancelled",
  refunded: "cancelled",
};

/** Historical W00 orders. Stock in the catalogue already includes them, so seeding must not reserve again. */
export function w00Orders(): Order[] {
  const catalog = buildCatalog(products.filter((p) => p.brand === "sambung"));
  const courier = shippingQuotes.find((q) => q.courierId === "kurir-a")!;
  const orders: Order[] = [];
  const first = seedOrder0003;
  orders.push({
    number: first.number,
    customerId: demoCustomer.id,
    createdAt: first.createdAt,
    totals: computeTotals({ catalog, promotions: [], now: first.createdAt, lines: first.lines, shippingCost: courier.cost }),
    addressId: "rumah",
    courier,
    payment: {
      method: first.method,
      status: "paid",
      expiresAt: paymentExpiry(first.createdAt, first.method),
      paidAt: first.paidAt,
      reference: first.reference,
    },
    fulfilment: "in_transit",
    trackingNumber: first.tracking,
    refunded: 0,
    history: first.history,
  });
  for (const so of seedOrders) {
    const history: Order["history"] = [{ at: so.createdAt, status: "Pesanan dibuat", actor: "Pelanggan" }];
    if (so.paidAt) history.unshift({ at: so.paidAt, status: "Dibayar", actor: "Event gateway (simulasi)" });
    if (so.outcome === "processing") history.unshift({ at: "2026-10-18T09:10:00+07:00", status: "Diproses", actor: "Dewi O. (Operasional)" });
    if (so.outcome === "delivered") history.unshift({ at: addMinutes(so.createdAt, 2 * 24 * 60), status: `Diterima · resi ${so.tracking}`, actor: "Event kurir (simulasi)" });
    if (so.outcome === "expired") history.unshift({ at: paymentExpiry(so.createdAt, so.method), status: "Kedaluwarsa · stok dikembalikan", actor: "Sistem" });
    if (so.refund) history.unshift({ at: so.refund.at, status: "Dibatalkan · refund penuh Rp237.000", actor: so.refund.actor });
    orders.push({
      number: so.number,
      customerId: so.customerId,
      createdAt: so.createdAt,
      totals: computeTotals({ catalog, promotions: [], now: so.createdAt, lines: so.lines, shippingCost: courier.cost }),
      addressId: "utama",
      courier,
      payment: {
        method: so.method,
        status: so.outcome === "expired" ? "expired" : so.outcome === "refunded" ? "refunded" : "paid",
        expiresAt: paymentExpiry(so.createdAt, so.method),
        paidAt: so.paidAt,
        reference: so.paidAt ? `SIM-PAY-${so.number.slice(4)}` : undefined,
      },
      fulfilment: FULFILMENT[so.outcome] ?? "to_process",
      trackingNumber: so.tracking,
      refunded: so.refund?.amount ?? 0,
      refunds: so.refund ? [so.refund] : undefined,
      history,
    });
  }
  return orders;
}
