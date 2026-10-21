import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { SummaryRows } from "../components/Summary";
import { RadioCard, SimBadge } from "../components/ui";
import { formatIDR } from "../domain/money";
import { PAYMENT_WINDOW_MIN } from "../domain/orders";
import type { PaymentMethod } from "../domain/types";
import { demoCustomer, shippingQuotes } from "../mocks/fixtures";
import { backend } from "../services/mock/backend";
import { useTotals } from "../store/hooks";
import { useShop } from "../store/shop";

const STEPS = [
  { slug: "pengiriman", label: "Pengiriman" },
  { slug: "ringkasan", label: "Ringkasan" },
  { slug: "pembayaran", label: "Pembayaran" },
] as const;

const METHODS: { id: PaymentMethod; label: string; note: string }[] = [
  { id: "qris", label: "QRIS", note: `Bayar dalam ${PAYMENT_WINDOW_MIN.qris} menit` },
  { id: "ewallet", label: "E-wallet", note: `Bayar dalam ${PAYMENT_WINDOW_MIN.ewallet} menit` },
  { id: "va", label: "Virtual account Bank A", note: "Bayar dalam 24 jam" },
];

export function Checkout() {
  const { step = "pengiriman" } = useParams();
  const idx = STEPS.findIndex((s) => s.slug === step);
  const s = useShop();
  const totals = useTotals(true);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (s.cart.length === 0) return <Navigate to="/keranjang" replace />;
  if (!s.session) return <Navigate to={`/masuk?alasan=checkout&next=${encodeURIComponent(`/checkout/${step}`)}`} replace />; // no guest checkout
  const session = s.session;
  if (idx < 0) return <Navigate to="/checkout/pengiriman" replace />;

  const address = demoCustomer.addresses.find((a) => a.id === s.addressId)!;
  const courier = shippingQuotes.find((q) => q.courierId === s.courierId)!;

  const placeOrder = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const res = await backend.create({
        brand: s.brand, customerId: session.customerId, lines: s.cart, addressId: s.addressId, courierId: s.courierId,
        paymentMethod: s.paymentMethod, orderVoucherCode: s.orderVoucher, shippingVoucherCode: s.shippingVoucher,
      });
      if (!res.ok) {
        setError(res.reason === "stock" ? `Stok tidak cukup untuk ${res.details.map((d) => `${d.sku} (tersedia ${d.available})`).join(", ")}. Ubah keranjang.` : res.message);
        return;
      }
      s.clearCheckout();
      navigate(`/pembayaran/${res.order.number}`);
    } catch (e) {
      setError("Pesanan gagal dibuat. Coba lagi. (" + (e instanceof Error ? e.message : "kesalahan tidak diketahui") + ")");
    } finally {
      setBusy(false);
    }
  };

  const next = () => (idx < 2 ? navigate(`/checkout/${STEPS[idx + 1]!.slug}`) : void placeOrder());
  const ctaLabel = idx === 0 ? `Lanjut ke ringkasan · ${formatIDR(totals.total)}` : idx === 1 ? "Lanjut ke pembayaran" : `Buat pesanan · ${formatIDR(totals.total)}`;

  return (
    <div className="flex flex-col gap-5 pb-28 lg:pb-0">
      <ol aria-label="Langkah checkout" className="flex gap-2 text-[13px]">
        {STEPS.map((st, i) => (
          <li key={st.slug} aria-current={i === idx ? "step" : undefined} className={`flex flex-1 items-center gap-2 ${i === idx ? "font-bold" : i < idx ? "" : "text-muted"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${i === idx ? "bg-primary text-white" : i < idx ? "bg-success text-white" : "border border-line-strong"}`}>{i < idx ? "✓" : i + 1}</span>
            {i < idx ? <Link to={`/checkout/${st.slug}`} className="underline">{st.label}</Link> : st.label}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          {idx === 0 ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 font-display text-xl font-semibold">Alamat pengiriman</legend>
                {demoCustomer.addresses.map((a) => (
                  <RadioCard key={a.id} name="address" checked={s.addressId === a.id} onChange={() => s.setAddress(a.id)}>
                    <b>{a.label}{a.isPrimary ? " (utama)" : ""}</b>
                    <span className="text-[13px]">{a.recipient} · {a.phone}</span>
                    <span className="text-[13px] text-muted">{a.line}, {a.city} {a.postalCode}</span>
                  </RadioCard>
                ))}
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 flex items-center gap-2 font-display text-xl font-semibold">Kurir <SimBadge /></legend>
                {shippingQuotes.map((q) => (
                  <RadioCard key={q.courierId} name="courier" checked={s.courierId === q.courierId} disabled={q.cost === null} onChange={() => s.setCourier(q.courierId)}
                    aside={<b className="money">{q.cost === null ? "—" : formatIDR(q.cost)}</b>}>
                    <b>{q.service}</b><span className="text-[13px] text-muted">{q.etaText}</span>
                  </RadioCard>
                ))}
                <p className="text-[13px] text-muted">Tarif contoh sama untuk semua alamat demo (penyederhanaan prototipe).</p>
              </fieldset>
            </>
          ) : null}
          {idx === 1 ? (
            <>
              <h1 className="text-2xl font-semibold">Periksa pesanan</h1>
              <section className="card flex flex-col gap-2 p-4 text-sm">
                <b>Barang ({totals.itemCount})</b>
                {totals.lines.map((l) => <span key={`${l.sku}${l.isGift}`} className="flex justify-between gap-3"><span>{l.qty}× {l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}{l.isGift ? " (gratis)" : ""}</span><span className="money">{formatIDR(l.lineTotal)}</span></span>)}
              </section>
              <section className="card flex flex-col gap-1 p-4 text-sm">
                <span className="flex justify-between"><b>Dikirim ke</b><Link to="/checkout/pengiriman" className="text-primary-ink underline">Ubah</Link></span>
                <span>{address.label} · {address.recipient}</span>
                <span className="text-muted">{address.line}, {address.city} {address.postalCode}</span>
                <span>{courier.service} · {courier.etaText}</span>
              </section>
              <p className="text-[13px] text-muted">Harga dan stok dicek ulang saat "Buat pesanan" (I4).</p>
            </>
          ) : null}
          {idx === 2 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 flex items-center gap-2 font-display text-xl font-semibold">Metode pembayaran <SimBadge /></legend>
              {METHODS.map((m) => (
                <RadioCard key={m.id} name="method" checked={s.paymentMethod === m.id} onChange={() => s.setPaymentMethod(m.id)}>
                  <b>{m.label}</b><span className="text-[13px] text-muted">{m.note}</span>
                </RadioCard>
              ))}
              <p className="text-[13px] text-muted">Setelah "Buat pesanan", stok dicadangkan sampai batas bayar (D6).</p>
            </fieldset>
          ) : null}
          {error ? <p role="alert" className="rounded-brand bg-[#FDECEC] p-3 text-sm font-semibold text-danger">{error}</p> : null}
        </div>
        <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface p-3 lg:static lg:self-start lg:rounded-brand lg:border lg:p-4">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-3">
            <div className="hidden lg:block"><SummaryRows totals={totals} stage="checkout" courierName={courier.service.split(" · ")[0]} /></div>
            <div className="flex justify-between text-sm font-bold lg:hidden"><span>Total</span><span className="money">{formatIDR(totals.total)}</span></div>
            <button type="button" className="btn-primary w-full" disabled={busy} onClick={next}>{busy ? "Membuat pesanan…" : ctaLabel}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
