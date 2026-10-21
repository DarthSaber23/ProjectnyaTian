import type { Totals } from "../domain/types";
import { formatIDR } from "../domain/money";

/** Order summary rows. `stage` controls whether shipping is known yet. */
export function SummaryRows({ totals, stage, courierName }: { totals: Totals; stage: "cart" | "checkout"; courierName?: string }) {
  const gifts = totals.lines.filter((l) => l.isGift);
  return (
    <dl className="flex flex-col gap-1.5 text-[14px]">
      <Row label={`Subtotal (${totals.itemCount} barang)`} value={formatIDR(totals.subtotal)} />
      {gifts.map((g) => <Row key={g.sku} label={`${g.appliedPriceCode} · ${g.qty}× ${g.name} gratis`} value={`Rp0 (senilai ${formatIDR(g.regularUnit * g.qty)})`} tone="success" />)}
      {totals.orderVoucher ? <Row label={`Voucher ${totals.orderVoucher.code}`} value={totals.orderVoucher.status.ok ? `−${formatIDR(totals.orderVoucher.status.discount)}` : "tidak berlaku"} tone={totals.orderVoucher.status.ok ? "success" : "warning"} /> : null}
      {stage === "cart" ? <Row label="Ongkir" value="dihitung saat checkout" tone="muted" /> : (
        <>
          <Row label={`Ongkir${courierName ? ` · ${courierName}` : ""}`} value={totals.shipping !== undefined ? formatIDR(totals.shipping) : "pilih kurir"} />
          {totals.shippingVoucher ? <Row label={`Voucher ${totals.shippingVoucher.code}`} value={totals.shippingVoucher.status.ok ? `−${formatIDR(totals.shippingVoucher.status.discount)}` : "tidak berlaku"} tone={totals.shippingVoucher.status.ok ? "success" : "warning"} /> : null}
        </>
      )}
      <div className="mt-1 flex justify-between border-t border-line pt-2 text-[16px] font-bold">
        <dt>{stage === "cart" ? "Total sementara" : "Total (termasuk PPN)"}</dt>
        <dd className="money">{formatIDR(totals.total)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "muted" }) {
  const c = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "muted" ? "text-muted" : "";
  return (
    <div className={`flex justify-between gap-4 ${c}`}>
      <dt>{label}</dt>
      <dd className="money text-right">{value}</dd>
    </div>
  );
}
