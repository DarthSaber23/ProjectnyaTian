/**
 * Metric definitions M1–M8 (docs/ANALYTICS_METRICS.md). Days are WIB; paid orders count on the
 * payment day, refunds on the refund day (D12). Sessions are mock numbers, not GA4.
 */
import type { Order, Rupiah } from "./types";
import { toWibIso } from "./time";

const day = (iso: string) => toWibIso(new Date(Date.parse(iso))).slice(0, 10);
const everPaid = (o: Order) => !!o.payment.paidAt;

export interface DailyRow { date: string; paidOrders: number; gross: Rupiah; refunds: Rupiah; net: Rupiah }

export interface Metrics {
  netRevenue: Rupiah;          // M1
  paidOrders: number;          // M2
  aov: Rupiah;                 // M3 (floored)
  conversionPct: number;       // M4, 2 decimals
  refunds: Rupiah;             // M5
  paymentCompletionPct: number;// M6, 1 decimal
  repeatBuyers: { repeat: number; buyers: number }; // M7 (all-time, C7)
  daily: DailyRow[];
}

export function computeMetrics(orders: Order[], fromDate: string, toDate: string, sessions: number): Metrics {
  const dates: string[] = [];
  for (let t = Date.parse(`${fromDate}T00:00:00+07:00`); t <= Date.parse(`${toDate}T00:00:00+07:00`); t += 86_400_000) dates.push(day(new Date(t).toISOString()));
  const inRange = (iso?: string) => !!iso && dates.includes(day(iso));
  const daily: DailyRow[] = dates.map((d) => ({ date: d, paidOrders: 0, gross: 0, refunds: 0, net: 0 }));
  const row = (iso: string) => daily.find((r) => r.date === day(iso))!;
  let paid = 0, gross = 0, refunds = 0, expired = 0;
  for (const o of orders) {
    if (everPaid(o) && inRange(o.payment.paidAt)) { paid++; gross += o.totals.total; const r = row(o.payment.paidAt!); r.paidOrders++; r.gross += o.totals.total; }
    for (const rf of o.refunds ?? []) if (inRange(rf.at)) { refunds += rf.amount; row(rf.at).refunds += rf.amount; }
    if (o.payment.status === "expired" && inRange(o.payment.expiresAt)) expired++;
  }
  daily.forEach((r) => (r.net = r.gross - r.refunds));
  const net = gross - refunds;
  const byCustomer = new Map<string, number>();
  for (const o of orders) if (everPaid(o)) byCustomer.set(o.customerId, (byCustomer.get(o.customerId) ?? 0) + 1);
  return {
    netRevenue: net, paidOrders: paid, aov: paid ? Math.floor(net / paid) : 0,
    conversionPct: sessions ? Math.round((paid / sessions) * 10000) / 100 : 0,
    refunds, paymentCompletionPct: paid + expired ? Math.round((paid / (paid + expired)) * 1000) / 10 : 0,
    repeatBuyers: { repeat: [...byCustomer.values()].filter((n) => n >= 2).length, buyers: byCustomer.size },
    daily,
  };
}
