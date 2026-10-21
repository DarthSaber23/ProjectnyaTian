import { useCallback, useEffect, useState } from "react";
import { Dialog } from "../components/Dialog";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { computeMetrics } from "../domain/analytics";
import { formatIDR } from "../domain/money";
import { FULFIL_LABEL, PAYMENT_LABEL } from "../domain/orders";
import { bestUnitPrice } from "../domain/pricing";
import { can, REVEAL_REASONS } from "../domain/rbac";
import { formatWib } from "../domain/time";
import type { FulfilmentStatus, Order } from "../domain/types";
import { customers, MOCK_SESSIONS_14_20_OKT } from "../mocks/fixtures";
import { backend } from "../services/mock";
import { MockAdmin } from "../services/mock/admin";
import { useAdmin, useAdminData } from "../store/admin";
import { useShop } from "../store/shop";

const chip = "inline-flex rounded px-2 py-0.5 text-[12px] font-semibold";
function PayChip({ o }: { o: Order }) {
  const t = o.payment.status === "paid" ? "bg-[#E3F4EA] text-success" : o.payment.status === "pending" ? "bg-[#FDF1DC] text-warning" : "bg-[#FDECEC] text-danger";
  return <span className={`${chip} ${t}`}>{PAYMENT_LABEL[o.payment.status]}</span>;
}
function FulChip({ o }: { o: Order }) {
  const t: Record<FulfilmentStatus, string> = { awaiting_payment: "bg-alt", to_process: "bg-[#FDF1DC] text-warning", processing: "bg-primary-soft text-primary-ink", shipped: "bg-[#E3F4EA] text-success", in_transit: "bg-primary-soft text-primary-ink", delivered: "bg-[#E3F4EA] text-success", cancelled: "bg-alt" };
  return <span className={`${chip} ${t[o.fulfilment]}`}>{FULFIL_LABEL[o.fulfilment]}</span>;
}
const custName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;

/* ---------------- Dashboard (A01 + A15 summary) ---------------- */
export function AdminDashboard() {
  useAdminData();
  const orders = backend.allOrders();
  const m = computeMetrics(orders, "2026-10-14", "2026-10-20", MOCK_SESSIONS_14_20_OKT);
  const max = Math.max(...m.daily.map((d) => d.net), 1);
  const todo = orders.filter((o) => o.fulfilment === "to_process").length;
  const pending = orders.filter((o) => o.payment.status === "pending").length;
  const kpis = [
    { id: "M1", l: "Pendapatan bersih", v: formatIDR(m.netRevenue), f: "dibayar − refund (D12)" },
    { id: "M2", l: "Pesanan dibayar", v: String(m.paidOrders), f: "termasuk yang direfund" },
    { id: "M3", l: "Rata-rata nilai pesanan", v: formatIDR(m.aov), f: "M1 ÷ M2, dibulatkan ke bawah" },
    { id: "M4", l: "Konversi", v: `${m.conversionPct.toLocaleString("id-ID")}%`, f: `${m.paidOrders} ÷ ${MOCK_SESSIONS_14_20_OKT.toLocaleString("id-ID")} sesi (mock)` },
    { id: "M5", l: "Refund", v: formatIDR(m.refunds), f: "menurut tanggal refund" },
    { id: "M6", l: "Tingkat pembayaran", v: `${m.paymentCompletionPct.toLocaleString("id-ID")}%`, f: "dibayar ÷ (dibayar + kedaluwarsa)" },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold">Dasbor</h1>
        <span className="text-sm text-muted">14–20 Okt 2026 · WIB · angka mengikuti aksi demo · <span className="font-semibold text-warning">sesi = mock, bukan GA4</span></span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {kpis.map((k) => <div key={k.id} className="card flex flex-col gap-1 p-3"><span className="text-[12px] text-muted">{k.l} ({k.id})</span><b className="money text-lg">{k.v}</b><span className="text-[11.5px] text-muted">{k.f}</span></div>)}
      </div>
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="card flex flex-col gap-3 p-4" aria-labelledby="daily-h">
          <h2 id="daily-h" className="font-body text-[16px] font-semibold">Pendapatan bersih per hari</h2>
          <div aria-hidden="true" className="flex h-36 items-end gap-3 border-b border-ink px-1">
            {m.daily.map((d) => <div key={d.date} className="flex-1 rounded-t bg-primary" style={{ height: `${Math.max(2, Math.round((Math.max(d.net, 0) / max) * 136))}px` }} />)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[13px]">
              <caption className="pb-1 text-left text-[12px] text-muted">Data bagan</caption>
              <thead><tr className="bg-alt text-left text-[12px] text-muted"><th scope="col" className="p-2">Tanggal</th><th scope="col" className="p-2 text-right">Dibayar</th><th scope="col" className="p-2 text-right">Kotor</th><th scope="col" className="p-2 text-right">Refund</th><th scope="col" className="p-2 text-right">Bersih</th></tr></thead>
              <tbody>{m.daily.map((d) => <tr key={d.date} className="border-t border-line"><th scope="row" className="p-2 text-left font-normal">{Number(d.date.slice(8))} Okt</th><td className="money p-2 text-right">{d.paidOrders}</td><td className="money p-2 text-right">{formatIDR(d.gross)}</td><td className="money p-2 text-right">{formatIDR(d.refunds)}</td><td className="money p-2 text-right font-semibold">{formatIDR(d.net)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="card flex flex-col gap-2 p-4 text-sm" aria-labelledby="todo-h">
          <h2 id="todo-h" className="font-body text-[16px] font-semibold">Perlu tindakan</h2>
          <Link to="/admin/orders?tab=to_process" className="flex justify-between border-t border-line pt-2 underline-offset-2 hover:underline"><span>Dibayar, siap diproses</span><b>{todo}</b></Link>
          <span className="flex justify-between border-t border-line pt-2"><span>Menunggu pembayaran</span><b>{pending}</b></span>
          <span className="flex justify-between border-t border-line pt-2"><span>Pembeli berulang (M7, semua waktu)</span><b>{m.repeatBuyers.repeat} dari {m.repeatBuyers.buyers}</b></span>
          <p className="mt-2 text-[12px] text-muted">Definisi metrik: docs/ANALYTICS_METRICS.md. Angka di prototipe bukan klaim kinerja.</p>
        </section>
      </div>
    </div>
  );
}

/* ---------------- Orders list (A06) ---------------- */
const TABS: { id: string; label: string; f: (o: Order) => boolean }[] = [
  { id: "all", label: "Semua", f: () => true },
  { id: "to_process", label: "Perlu diproses", f: (o) => o.fulfilment === "to_process" },
  { id: "processing", label: "Diproses", f: (o) => o.fulfilment === "processing" },
  { id: "shipped", label: "Dikirim", f: (o) => ["shipped", "in_transit", "delivered"].includes(o.fulfilment) },
  { id: "pending", label: "Menunggu bayar", f: (o) => o.payment.status === "pending" },
  { id: "cancelled", label: "Dibatalkan", f: (o) => o.fulfilment === "cancelled" },
];

export function AdminOrders() {
  useAdminData();
  const orders = backend.allOrders();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "all";
  const setTab = (id: string) => setParams(id === "all" ? {} : { tab: id }, { replace: true });
  const t = TABS.find((x) => x.id === tab) ?? TABS[0]!;
  const list = orders.filter(t.f);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Pesanan</h1>
      <div role="tablist" aria-label="Status pesanan" className="flex gap-4 overflow-x-auto border-b border-line text-sm">
        {TABS.map((x) => <button key={x.id} role="tab" type="button" aria-selected={x.id === t.id} onClick={() => setTab(x.id)} className={`min-h-[44px] whitespace-nowrap ${x.id === t.id ? "border-b-[3px] border-primary font-semibold" : "text-muted"}`}>{x.label} {orders.filter(x.f).length}</button>)}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <caption className="sr-only">Daftar pesanan, tab {t.label}</caption>
          <thead><tr className="bg-alt text-left text-[12px] text-muted"><th scope="col" className="p-3">Pesanan</th><th scope="col" className="p-3">Pelanggan</th><th scope="col" className="p-3 text-right">Total</th><th scope="col" className="p-3">Pembayaran</th><th scope="col" className="p-3">Pemenuhan</th><th scope="col" className="p-3">Dibuat</th></tr></thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.number} className="border-t border-line">
                <td className="p-3"><Link to={`/admin/orders/${o.number}`} className="money font-semibold text-primary-ink underline">{o.number}</Link></td>
                <td className="p-3">{custName(o.customerId)}</td>
                <td className="money p-3 text-right">{formatIDR(o.totals.total)}</td>
                <td className="p-3"><PayChip o={o} /></td>
                <td className="p-3"><FulChip o={o} /></td>
                <td className="p-3 text-muted">{formatWib(o.createdAt, { withYear: false })}</td>
              </tr>
            ))}
            {list.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted">Tidak ada pesanan di tab ini.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Order detail (A07): process, ship, refund, contact reveal ---------------- */
type Dialog = null | "ship" | "refund" | "reveal";

export function AdminOrderDetail() {
  const { nomor = "" } = useParams();
  const a = useAdminData();
  const user = useAdmin((s) => s.user)!;
  const notify = useShop((s) => s.notify);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string>();
  const [resi, setResi] = useState("");
  const [amountMode, setAmountMode] = useState<"full" | "items" | "custom">("full");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [revealReason, setRevealReason] = useState("");
  const order = backend.get(nomor);
  const contact = order ? a.contact(user, order.customerId) : undefined;

  const closeDlg = useCallback(() => { setDialog(null); setError(undefined); }, []);

  // C2: re-mask after 60 seconds of real time as well as simulated time.
  useEffect(() => {
    if (!contact?.revealedUntil || !order) return;
    const t = setTimeout(() => a.remask(user, order.customerId), 60_000);
    return () => clearTimeout(t);
  }, [contact?.revealedUntil, order, a, user]);

  if (!order) return <div className="card p-6"><h1 className="text-xl font-semibold">Pesanan tidak ditemukan</h1><Link to="/admin/orders" className="underline">Kembali</Link></div>;
  const run = (fn: () => void, ok: string) => { try { fn(); setError(undefined); setDialog(null); notify(ok); } catch (e) { setError(e instanceof Error ? e.message : "Aksi gagal"); } };
  const shipping = order.totals.shipping ?? 0;
  const remaining = order.totals.total - order.refunded;
  const amount = amountMode === "full" ? remaining : amountMode === "items" ? Math.max(0, Math.min(remaining, order.totals.total - shipping)) : Number(amountText.replace(/\D/g, "")) || 0;
  const canFulfil = can(user.role, "orders.fulfil");
  const canRefund = can(user.role, "orders.refund");
  const shippedLike = ["shipped", "in_transit", "delivered"].includes(order.fulfilment);
  const blockedMsg = (msg: string) => () => setError(msg);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/admin/orders" className="text-sm underline">← Pesanan</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2"><h1 className="money text-2xl font-semibold">{order.number}</h1><PayChip o={order} /><FulChip o={order} /></div>
        <div className="flex flex-wrap gap-2">
          {order.fulfilment === "to_process" ? <button type="button" className={canFulfil ? "btn-primary" : "btn-secondary opacity-60"} onClick={canFulfil ? () => run(() => a.process(user, order.number), "Pesanan diproses.") : blockedMsg("Peran ini hanya dapat melihat pesanan (A17).")}>Proses pesanan</button> : null}
          {order.fulfilment === "processing" ? <button type="button" className={canFulfil ? "btn-primary" : "btn-secondary opacity-60"} onClick={canFulfil ? () => { setResi(""); setError(undefined); setDialog("ship"); } : blockedMsg("Peran ini hanya dapat melihat pesanan (A17).")}>Kirim…</button> : null}
          {order.payment.status === "paid" || order.payment.status === "partially_refunded" ? (
            shippedLike ? <span className="text-[13px] text-muted">Refund setelah dikirim: lewat retur (di luar prototipe, P10)</span> :
              <button type="button" className="btn-secondary" onClick={canRefund ? () => { setAmountMode("full"); setReason(""); setError(undefined); setDialog("refund"); } : blockedMsg("Refund hanya oleh Owner/Admin (I8, A17).")}>Catat refund…</button>
          ) : null}
        </div>
      </div>
      {error && !dialog ? <p role="alert" className="rounded-brand bg-[#FDF1DC] p-3 text-sm font-semibold text-warning">{error}</p> : null}

      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="card flex flex-col gap-2 p-4 text-sm" aria-label="Barang">
          <div className="overflow-x-auto"><table className="w-full min-w-[420px]"><thead><tr className="bg-alt text-left text-[12px] text-muted"><th scope="col" className="p-2">Barang</th><th scope="col" className="p-2">SKU</th><th scope="col" className="p-2 text-right">Jumlah</th><th scope="col" className="p-2 text-right">Subtotal</th></tr></thead>
            <tbody>{order.totals.lines.map((l) => <tr key={`${l.sku}${l.isGift}`} className="border-t border-line"><td className="p-2">{l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</td><td className="money p-2 text-[12px]">{l.sku}</td><td className="p-2 text-right">×{l.qty}</td><td className="money p-2 text-right">{formatIDR(l.lineTotal)}</td></tr>)}</tbody></table></div>
          <span className="flex justify-between"><span>Ongkir · {order.courier.service}</span><span className="money">{formatIDR(shipping)}</span></span>
          <span className="flex justify-between border-t border-line pt-2 font-bold"><span>Total dibayar</span><span className="money">{formatIDR(order.totals.total)}</span></span>
          {(order.refunds ?? []).map((r, i) => <span key={i} className="flex justify-between font-semibold text-danger"><span>Refund {formatWib(r.at, { withYear: false })} · {r.reason}</span><span className="money">−{formatIDR(r.amount)}</span></span>)}
          <span className="text-[12px] text-muted">{order.payment.method.toUpperCase()} · {order.payment.paidAt ? `dibayar ${formatWib(order.payment.paidAt)}` : PAYMENT_LABEL[order.payment.status]}{order.payment.reference ? ` · ref. ${order.payment.reference}` : ""}</span>
          {order.trackingNumber ? <span>Resi <b className="money">{order.trackingNumber}</b></span> : null}
        </section>
        <div className="flex flex-col gap-4">
          <section className="card flex flex-col gap-1 p-4 text-sm" aria-label="Pelanggan">
            <b>Pelanggan · {order.customerId}</b>
            <span>{contact?.name}</span>
            <span className="money">{contact?.email}<br />{contact?.phone}</span>
            <span className="text-muted">{contact?.address}</span>
            {contact && !contact.full ? <button type="button" className="btn-secondary mt-1 self-start min-h-[40px]" onClick={() => { setRevealReason(""); setError(undefined); setDialog("reveal"); }}>Tampilkan kontak (dicatat di log)</button> : null}
            {contact?.revealedUntil ? <span className="text-[12px] font-semibold text-warning">Terbuka sampai {formatWib(contact.revealedUntil, { withDate: false })} (60 detik)</span> : null}
            {contact?.revealedUntil ? <button type="button" className="sim-panel mt-1 self-start p-2 text-[12px] font-semibold" onClick={() => a.remask(user, order.customerId)}>Panel uji: simulasikan 60 detik berlalu</button> : null}
            {can(user.role, "customers.contact.full") ? <span className="text-[12px] text-muted">Owner/Admin melihat kontak penuh (A17).</span> : null}
          </section>
          <section className="card flex flex-col gap-1 p-4 text-sm" aria-label="Riwayat status">
            <b>Riwayat status</b>
            {order.history.map((h, i) => <span key={i} className="flex flex-col border-t border-line pt-1"><span className="font-semibold">{h.status}</span><span className="text-[12px] text-muted">{formatWib(h.at)} · {h.actor}</span></span>)}
          </section>
        </div>
      </div>

      {dialog ? (
        <Dialog titleId="dlg-t" onClose={closeDlg}>
            <h2 id="dlg-t" className="text-xl font-semibold">{dialog === "ship" ? `Kirim ${order.number}` : dialog === "refund" ? `Catat refund ${order.number}` : "Tampilkan kontak?"}</h2>
            {dialog === "ship" ? (
              <>
                <p className="text-sm">Kurir pilihan pelanggan: <b>{order.courier.service}</b></p>
                <label htmlFor="resi" className="text-sm font-semibold">Nomor resi *</label>
                <input id="resi" autoFocus value={resi} onChange={(e) => setResi(e.target.value)} placeholder="contoh: SIM-KA-88213010" aria-invalid={!!error} aria-describedby={error ? "dlg-err" : undefined} className="min-h-[44px] rounded-ctl border border-line-strong px-3 font-mono" />
                <button type="button" className="sim-panel self-start p-2 text-[12px] font-semibold" onClick={() => setResi("SIM-KA-88213010")}>Panel uji: isi resi contoh</button>
                <p className="text-[12px] text-muted">Status jadi Dikirim dan pelanggan melihat resi. "Diterima" hanya dari event kurir.</p>
              </>
            ) : null}
            {dialog === "refund" ? (
              <>
                <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-semibold">Jumlah refund *</legend>
                  <div className="flex flex-wrap gap-2">
                    {([["full", `Sisa penuh ${formatIDR(remaining)}`], ["items", `Barang saja ${formatIDR(Math.max(0, Math.min(remaining, order.totals.total - shipping)))}`], ["custom", "Jumlah lain"]] as const).map(([id, l]) => <button key={id} type="button" aria-pressed={amountMode === id} className={amountMode === id ? "chip-on" : "chip-off"} onClick={() => setAmountMode(id)}>{l}</button>)}
                  </div>
                </fieldset>
                {amountMode === "custom" ? <><label htmlFor="amt" className="text-sm font-semibold">Jumlah (Rupiah, angka saja)</label><input id="amt" inputMode="numeric" value={amountText} onChange={(e) => setAmountText(e.target.value)} className="min-h-[44px] rounded-ctl border border-line-strong px-3 font-mono" /></> : null}
                <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-semibold">Alasan *</legend>
                  <div className="flex flex-wrap gap-2">{["Pelanggan membatalkan", "Stok tidak tersedia", "Barang rusak"].map((r) => <button key={r} type="button" aria-pressed={reason === r} className={reason === r ? "chip-on" : "chip-off"} onClick={() => setReason(r)}>{r}</button>)}</div>
                </fieldset>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="h-5 w-5" /> Kembalikan stok (hanya jika refund penuh)</label>
                <p className="rounded-brand bg-alt p-3 text-[12.5px]">Dana dikembalikan ke metode bayar asal (simulasi). Laporan: pendapatan 20 Okt berkurang {formatIDR(amount)} (D12, menurut tanggal refund).</p>
              </>
            ) : null}
            {dialog === "reveal" ? (
              <>
                <p className="text-sm">Email dan telepon {contact?.name} terlihat 60 detik lalu disamarkan lagi. Aksi ini dicatat di log audit.</p>
                <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-semibold">Alasan (wajib)</legend>
                  {REVEAL_REASONS.map((r) => <label key={r} className={`flex min-h-[44px] items-center gap-2 rounded-ctl px-3 text-sm ${revealReason === r ? "border-2 border-primary bg-primary-soft" : "border border-line"}`}><input type="radio" name="reveal" checked={revealReason === r} onChange={() => setRevealReason(r)} className="h-5 w-5" />{r}</label>)}
                </fieldset>
              </>
            ) : null}
            {error ? <p id="dlg-err" role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={closeDlg}>Batal</button>
              {dialog === "ship" ? <button type="button" className="btn-primary" onClick={() => { const e = MockAdmin.validateTracking(resi); if (e) return setError(e); run(() => a.ship(user, order.number, resi), "Pesanan ditandai Dikirim."); }}>Tandai Dikirim</button> : null}
              {dialog === "refund" ? <button type="button" className="btn bg-danger text-white" onClick={() => run(() => a.refund(user, order.number, amount, reason, restock), "Refund dicatat.")}>Catat refund {formatIDR(amount)}</button> : null}
              {dialog === "reveal" ? <button type="button" className="btn-primary" onClick={() => run(() => { a.reveal(user, order.customerId, revealReason, order.number); }, "Kontak ditampilkan · dicatat di log.")}>Tampilkan</button> : null}
            </div>
        </Dialog>
      ) : null}
    </div>
  );
}

/* ---------------- Promotions (A08/A09, P06) ---------------- */
export function AdminPromotions() {
  const a = useAdminData();
  const user = useAdmin((s) => s.user)!;
  const notify = useShop((s) => s.notify);
  const [error, setError] = useState<string>();
  const editable = can(user.role, "promotions.edit");
  const catalog = backend.getCatalog("sambung");
  const active = backend.getPromotions("sambung");
  const d = a.draft;
  const promos = [...active, a.draftPromotion()];
  const at = (day: string) => bestUnitPrice(catalog, promos, "B03", `${day}T12:00:00+07:00`);
  const fs = bestUnitPrice(catalog, active, "B03", "2026-10-21T12:00:00+07:00").unit;
  const startDay = Number(d.start.slice(8, 10));
  const segs = [];
  if (startDay <= 22) { const r = at(`2026-10-${String(startDay).padStart(2, "0")}`); segs.push({ label: `${startDay}–22 Okt`, fs: formatIDR(fs), c: formatIDR(Math.floor((399000 * (100 - d.percentOff)) / 100)), win: `${formatIDR(r.unit)} · ${r.code}`, voucher: r.isFlashSale ? "Tidak berlaku (harga flash sale)" : d.allowVoucher ? "Berlaku" : "Tidak berlaku (diatur di promo ini)", warn: !r.isFlashSale }); }
  const r23 = at(`2026-10-${String(Math.max(startDay, 23)).padStart(2, "0")}`);
  segs.push({ label: `${Math.max(startDay, 23)}–31 Okt`, fs: "—", c: formatIDR(r23.unit), win: `${formatIDR(r23.unit)} · ${r23.code}`, voucher: d.allowVoucher ? "Berlaku" : "Tidak berlaku (diatur di promo ini)", warn: false });
  const upd = (patch: Parameters<MockAdmin["updateDraft"]>[1]) => { try { a.updateDraft(user, patch); setError(undefined); } catch (e) { setError(e instanceof Error ? e.message : "Gagal"); } };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Promosi</h1>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <caption className="p-3 text-left text-[12px] text-muted">Aturan D3: per barang 1 promo harga (terendah); per pesanan 1 voucher pesanan + 1 voucher ongkir; voucher pesanan tidak untuk barang flash sale.</caption>
          <thead><tr className="bg-alt text-left text-[12px] text-muted"><th scope="col" className="p-3">Kode</th><th scope="col" className="p-3">Jenis</th><th scope="col" className="p-3">Aturan</th><th scope="col" className="p-3">Status</th></tr></thead>
          <tbody>
            {active.map((p) => <tr key={p.code} className="border-t border-line"><td className="money p-3 font-semibold">{p.code}</td><td className="p-3">{{ price: "Promo harga", order: "Voucher pesanan", shipping: "Voucher ongkir", gift: "Hadiah" }[p.kind]}</td><td className="p-3">{p.label}</td><td className="p-3"><span className={`${chip} bg-[#E3F4EA] text-success`}>Aktif</span></td></tr>)}
            <tr className="border-t border-line"><td className="money p-3 font-semibold">CHARGER15</td><td className="p-3">Promo harga</td><td className="p-3">Kategori Charger −{d.percentOff}%</td><td className="p-3"><span className={`${chip} ${d.status === "scheduled" ? "bg-[#E3F4EA] text-success" : "bg-alt"}`}>{d.status === "scheduled" ? "Terjadwal" : "Draf"}</span></td></tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="card flex flex-col gap-3 p-4" aria-labelledby="edit-h">
          <h2 id="edit-h" className="font-body text-[16px] font-semibold">CHARGER15 · pengaturan</h2>
          {!editable ? <p role="status" className="rounded-brand bg-[#FDF1DC] p-2 text-[13px] text-warning">Hanya-baca untuk peran ini (A17).</p> : null}
          <fieldset disabled={!editable} className="flex flex-col gap-2"><legend className="mb-1 text-sm font-semibold">Diskon</legend>
            <div className="flex flex-wrap gap-2">{[10, 15, 20, 25, 30].map((p) => <button key={p} type="button" aria-pressed={d.percentOff === p} className={d.percentOff === p ? "chip-on" : "chip-off"} onClick={() => upd({ percentOff: p })}>−{p}% → {formatIDR(Math.floor((399000 * (100 - p)) / 100))}</button>)}</div>
          </fieldset>
          <fieldset disabled={!editable} className="flex flex-col gap-2"><legend className="mb-1 text-sm font-semibold">Mulai</legend>
            <div className="flex flex-wrap gap-2">{["2026-10-20", "2026-10-21", "2026-10-23"].map((day) => { const iso = `${day}T00:00:00+07:00`; return <button key={day} type="button" aria-pressed={d.start === iso} className={d.start === iso ? "chip-on" : "chip-off"} onClick={() => upd({ start: iso })}>{Number(day.slice(8))} Okt 00:00</button>; })}</div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} checked={d.allowVoucher} onChange={(e) => upd({ allowVoucher: e.target.checked })} className="h-5 w-5" /> Boleh digabung dengan voucher pesanan</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} checked={d.reviewed} onChange={(e) => upd({ reviewed: e.target.checked })} className="h-5 w-5" /> Saya sudah meninjau hasil pengecekan konflik</label>
          {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
          <button type="button" disabled={!editable || d.status === "scheduled"} className="btn-primary self-start" onClick={() => { try { a.schedule(user); setError(undefined); notify("CHARGER15 dijadwalkan."); } catch (e) { setError(e instanceof Error ? e.message : "Gagal"); } }}>{d.status === "scheduled" ? "Sudah dijadwalkan" : "Jadwalkan"}</button>
        </section>
        <section className="card flex flex-col gap-3 p-4" aria-labelledby="conf-h">
          <h2 id="conf-h" className="font-body text-[16px] font-semibold">Pengecekan konflik · Charger GaN 65W (harga normal Rp399.000)</h2>
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-[13px]">
            <thead><tr className="bg-alt text-left text-[12px] text-muted"><th scope="col" className="p-2">Tanggal</th><th scope="col" className="p-2 text-right">FS-WEEKEND</th><th scope="col" className="p-2 text-right">CHARGER15</th><th scope="col" className="p-2">Harga dipakai (D3)</th><th scope="col" className="p-2">Voucher pesanan</th></tr></thead>
            <tbody>{segs.map((s) => <tr key={s.label} className="border-t border-line"><th scope="row" className="p-2 text-left font-normal">{s.label}</th><td className="money p-2 text-right">{s.fs}</td><td className="money p-2 text-right">{s.c}</td><td className={`p-2 font-semibold ${s.warn ? "text-danger" : ""}`}>{s.win}</td><td className="p-2">{s.voucher}</td></tr>)}</tbody>
          </table></div>
          {segs.some((s) => s.warn) ? <p role="alert" className="rounded-brand bg-[#FDECEC] p-3 text-[13px] font-semibold text-danger">CHARGER15 lebih murah dari flash sale pada {segs[0]!.label}: harga flash sale tidak dipakai dan voucher pesanan menjadi berlaku untuk barang ini.</p> : startDay <= 22 ? <p className="rounded-brand bg-[#FDF1DC] p-3 text-[13px] text-warning">Pada {segs[0]!.label} flash sale lebih murah (atau sama), jadi CHARGER15 tidak berpengaruh. Harga sama: promo yang sudah aktif dipertahankan (P12).</p> : null}
          {startDay === 20 ? <p className="text-[13px] font-semibold text-warning">Mulai 20 Okt 00:00 sudah lewat; menjadwalkan akan ditolak.</p> : null}
        </section>
      </div>
    </div>
  );
}

/* ---------------- Audit log (A22) ---------------- */
export function AdminAudit() {
  const a = useAdminData();
  const user = useAdmin((s) => s.user)!;
  const log = a.auditLog(user);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Log audit</h1>
      <p className="text-sm text-muted">Hanya-tambah: tidak ada aksi ubah atau hapus. Setiap baris menyimpan pelaku, waktu (WIB), aksi, dan objek (ALCOA+).</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <caption className="sr-only">Log audit</caption>
          <thead><tr className="bg-alt text-left text-[12px] text-muted"><th scope="col" className="p-3">Waktu</th><th scope="col" className="p-3">Pengguna</th><th scope="col" className="p-3">Kode</th><th scope="col" className="p-3">Aksi</th><th scope="col" className="p-3">Objek</th></tr></thead>
          <tbody>{log.map((e, i) => <tr key={i} className="border-t border-line align-top"><td className="money whitespace-nowrap p-3">{formatWib(e.at, { withYear: false })}</td><td className="p-3">{e.actor}</td><td className="money p-3 text-[12px]">{e.code}</td><td className="p-3">{e.action}</td><td className="money p-3 text-[12px]">{e.object}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
