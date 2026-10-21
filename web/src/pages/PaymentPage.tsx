import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SummaryRows } from "../components/Summary";
import { SimBadge } from "../components/ui";
import { DEMO_TOOLS } from "../config/brands";
import { formatIDR } from "../domain/money";
import { FULFIL_LABEL, PAYMENT_LABEL } from "../domain/orders";
import { formatWib } from "../domain/time";
import { backend } from "../services/http/backend";
import { useBackendVersion, useShop } from "../store/shop";
import { NotFound } from "./NotFound";

const METHOD_NAME = { qris: "QRIS", ewallet: "E-wallet", va: "Virtual account Bank A" } as const;

export function PaymentPage() {
  const { nomor = "" } = useParams();
  useBackendVersion();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let stop = false;
    void backend.refreshOrder(nomor).catch(() => undefined).finally(() => { if (!stop) setLoaded(true); });
    return () => { stop = true; };
  }, [nomor]);
  const order = backend.get(nomor);
  const restoreCart = useShop((s) => s.restoreCart);
  const navigate = useNavigate();
  const [message, setMessage] = useState<string>();
  if (!loaded && !order) return <p className="text-sm text-muted">Memuat pesanan…</p>;
  if (!order) return <NotFound />;
  const { payment } = order;
  const open = payment.status === "pending" || payment.status === "failed";
  const simulate = async (o: "paid" | "failed" | "expired") => {
    try {
      await backend.simulate(order.number, o);
      setMessage(o === "failed" ? `Pembayaran gagal (simulasi). Pesanan tetap menunggu sampai ${formatWib(payment.expiresAt, { withDate: false })}. Coba lagi atau ganti metode.` : undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Aksi tidak diizinkan");
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <span className="font-mono text-[12px] text-muted">/pembayaran/{order.number}</span>
      {open ? (
        <>
          <h1 className="text-3xl font-semibold">Selesaikan pembayaran</h1>
          <p className="rounded-brand bg-[#FDF1DC] p-3 text-sm text-[#6B4100]"><b>Bayar sebelum {formatWib(payment.expiresAt)}</b> · stok dicadangkan sampai saat itu.</p>
          <section className="card flex flex-col items-center gap-3 p-6 text-center">
            <span className="flex items-center gap-2 text-sm">{METHOD_NAME[payment.method]} <SimBadge /></span>
            <b className="money text-3xl">{formatIDR(order.totals.total)}</b>
            {payment.method === "qris" ? (
              <div role="img" aria-label={`Kode QR simulasi untuk pembayaran ${formatIDR(order.totals.total)}`} className="flex h-44 w-44 items-center justify-center border-2 border-dashed border-line-strong text-[12px] text-muted" style={{ background: "repeating-linear-gradient(45deg,#F2F4F7 0 8px,#fff 8px 16px)" }}>QR SIMULASI<br />tidak dapat dipindai</div>
            ) : payment.method === "va" ? (
              <><span className="money text-xl">8808 0000 0000 {order.number.slice(-4)}</span><span className="text-[12px] text-muted">Nomor VA Bank A (fiktif)</span></>
            ) : <span className="text-sm">Notifikasi dikirim ke aplikasi e-wallet (simulasi).</span>}
          </section>
          {message ? <p role="alert" className="rounded-brand bg-[#FDECEC] p-3 text-sm font-semibold text-danger">{message}</p> : null}
          {DEMO_TOOLS ? (
            <section className="sim-panel flex flex-col gap-2" aria-label="Panel simulasi gateway">
              <b className="font-mono text-[12px]">PANEL SIMULASI GATEWAY · di produksi status datang dari webhook bertanda tangan</b>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn bg-success text-white" onClick={() => simulate("paid")}>Simulasikan berhasil</button>
                <button type="button" className="btn border border-danger bg-surface text-danger" onClick={() => simulate("failed")}>Simulasikan gagal</button>
                <button type="button" className="btn-secondary" onClick={() => simulate("expired")}>Simulasikan kedaluwarsa</button>
              </div>
            </section>
          ) : null}
        </>
      ) : payment.status === "paid" ? (
        <>
          <div className="rounded-brand bg-[#E3F4EA] p-5 text-[#14532D]"><h1 className="text-2xl font-semibold">Pembayaran diterima</h1><p>{order.number} · dibayar {formatWib(payment.paidAt!)} (simulasi)</p></div>
          <p className="text-sm">Status pesanan: <b>{FULFIL_LABEL[order.fulfilment]}</b>. Pelacakan ada di Akun → Pesanan (I7).</p>
        </>
      ) : (
        <>
          <div className="card p-5"><h1 className="text-2xl font-semibold">Pesanan {PAYMENT_LABEL[payment.status].toLowerCase()}</h1><p>{order.number} tidak dibayar sampai {formatWib(payment.expiresAt)}. Stok yang dicadangkan sudah dikembalikan. Tidak ada dana yang ditarik.</p></div>
          <button type="button" className="btn-primary self-start" onClick={() => { restoreCart(order.totals.lines.filter((l) => !l.isGift).map((l) => ({ sku: l.sku, qty: l.qty }))); navigate("/keranjang"); }}>Masukkan lagi ke keranjang</button>
          <p className="text-[13px] text-muted">Harga dicek ulang; voucher perlu dipasang lagi.</p>
        </>
      )}
      <section className="card flex flex-col gap-3 p-4" aria-label="Rincian pesanan">
        {order.totals.lines.map((l) => <span key={`${l.sku}${l.isGift}`} className="flex justify-between text-sm"><span>{l.qty}× {l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</span><span className="money">{formatIDR(l.lineTotal)}</span></span>)}
        <SummaryRows totals={order.totals} stage="checkout" courierName={order.courier.service.split(" · ")[0]} />
      </section>
      <section className="card flex flex-col gap-1 p-4 text-sm" aria-label="Riwayat status">
        <b>Riwayat</b>
        {order.history.map((h, i) => <span key={i} className="flex justify-between border-t border-line pt-1"><span>{h.status}</span><span className="text-muted">{formatWib(h.at, { withYear: false })} · {h.actor}</span></span>)}
      </section>
      <Link to="/" className="btn-secondary self-start">Kembali belanja</Link>
    </div>
  );
}
