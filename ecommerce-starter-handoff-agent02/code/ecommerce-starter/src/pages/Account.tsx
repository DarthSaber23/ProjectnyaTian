import { useCallback, useState } from "react";
import { Dialog } from "../components/Dialog";
import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { SummaryRows } from "../components/Summary";
import { ProductArt, StockNote } from "../components/ui";
import { formatIDR } from "../domain/money";
import { FULFIL_LABEL, isCourierOverdue, PAYMENT_LABEL } from "../domain/orders";
import { bestUnitPrice } from "../domain/pricing";
import { available } from "../domain/stock";
import { formatWib } from "../domain/time";
import type { Order } from "../domain/types";
import { demoCustomer, type ConsentKey } from "../mocks/fixtures";
import { backend } from "../services/mock/backend";
import { useBrand, useCatalog } from "../store/hooks";
import { useBackendVersion, useShop } from "../store/shop";
import { NotFound } from "./NotFound";

/** Guards routes that need a signed-in customer; keeps the target so sign-in can return there. */
export function RequireAuth({ reason = "akun" }: { reason?: string }) {
  const session = useShop((s) => s.session);
  const { pathname } = useLocation();
  if (!session) return <Navigate to={`/masuk?alasan=${reason}&next=${encodeURIComponent(pathname)}`} replace />;
  return <Outlet />;
}

const MENU = [
  { to: "/akun", label: "Ringkasan", end: true },
  { to: "/akun/pesanan", label: "Pesanan" },
  { to: "/akun/wishlist", label: "Wishlist" },
  { to: "/akun/alamat", label: "Buku alamat" },
  { to: "/akun/preferensi", label: "Preferensi komunikasi" },
];

export function AccountLayout() {
  const session = useShop((s) => s.session)!;
  const signOut = useShop((s) => s.signOut);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-2">
        <div><b className="block font-display text-xl">Hai, {session.name.split(" ")[0]}</b><span className="text-[13px] text-muted">{session.email}</span></div>
        <nav aria-label="Menu akun" className="flex gap-2 overflow-x-auto md:flex-col md:gap-1">
          {MENU.map((m) => <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => `whitespace-nowrap rounded-ctl px-3 py-2 text-sm ${isActive ? "bg-primary-soft font-semibold text-primary-ink" : "hover:bg-alt"}`}>{m.label}</NavLink>)}
        </nav>
        <button type="button" className="btn-ghost self-start" onClick={signOut}>Keluar</button>
      </aside>
      <div className="min-w-0"><Outlet /></div>
    </div>
  );
}

function StatusChip({ order }: { order: Order }) {
  const label = order.payment.status === "paid" ? FULFIL_LABEL[order.fulfilment] : PAYMENT_LABEL[order.payment.status];
  const tone = order.payment.status === "pending" ? "bg-[#FDF1DC] text-warning" : order.fulfilment === "in_transit" || order.fulfilment === "shipped" ? "bg-primary-soft text-primary-ink" : order.payment.status === "paid" ? "bg-[#E3F4EA] text-success" : "bg-alt text-ink";
  return <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${tone}`}>{label}</span>;
}

function useOrders() {
  const session = useShop((s) => s.session)!;
  const brand = useShop((s) => s.brand);
  useBackendVersion();
  return backend.list(session.customerId, brand);
}

export function AccountHome() {
  const orders = useOrders();
  const brand = useBrand();
  const { products, catalog, promotions } = useCatalog();
  const consents = backend.consents();
  const session = useShop((s) => s.session)!;
  const wish = backend.wishlist(session.customerId, brand.id);
  const personalised = consents.personalised.granted;
  const recs = personalised
    ? [...wish.map((id) => products.find((p) => p.id === id)!).filter((p) => p && p.variants.some((v) => available(catalog, v.sku) > 0)), ...products.filter((p) => !wish.includes(p.id))].slice(0, 3)
    : products.slice(0, 3);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-semibold">Akun</h1>
      <section className="card flex flex-col gap-2 p-4" aria-labelledby="ord-h">
        <div className="flex justify-between"><h2 id="ord-h" className="font-body text-[16px] font-semibold">Pesanan terbaru</h2><Link to="/akun/pesanan" className="text-sm underline">Semua pesanan</Link></div>
        {orders.length === 0 ? <p className="text-sm text-muted">Belum ada pesanan di toko ini.</p> : orders.slice(0, 2).map((o) => <OrderRow key={o.number} order={o} />)}
      </section>
      <section className="card flex flex-col gap-2 p-4" aria-labelledby="rec-h">
        <h2 id="rec-h" className="font-body text-[16px] font-semibold">{personalised ? "Rekomendasi untukmu" : "Produk populer"}</h2>
        <p className="text-[13px] text-muted">{personalised ? "Berdasarkan wishlist dan pesanan di situs ini (izin rekomendasi pribadi: aktif)." : "Rekomendasi pribadi dimatikan, jadi daftar ini sama untuk semua orang."}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {recs.map((p) => (
            <Link key={p.id} to={`/produk/${p.slug}`} className="flex min-w-0 items-center gap-3 rounded-brand border border-line p-2 hover:bg-alt">
              <ProductArt kind={p.art.kind} bg={p.art.bg} accent={p.art.accent} label={p.name} className="w-14 shrink-0 rounded" />
              <span className="flex min-w-0 flex-col break-words text-[13px]"><b>{p.name}</b><span className="money">{formatIDR(Math.min(...p.variants.map((v) => bestUnitPrice(catalog, promotions, v.sku, backend.now()).unit)))}</span>
                {personalised && wish.includes(p.id) ? <span className="text-muted">Ada di wishlist kamu</span> : null}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const overdue = isCourierOverdue(order, backend.now());
  return (
    <Link to={`/akun/pesanan/${order.number}`} className="flex flex-col gap-1 border-t border-line pt-2 hover:bg-alt">
      <span className="flex flex-wrap items-center justify-between gap-2"><b className="money text-[13px]">{order.number}</b><StatusChip order={order} /></span>
      <span className="text-[13px] text-muted">{formatWib(order.createdAt)} · {order.totals.itemCount} barang · {formatIDR(order.totals.total)}</span>
      {overdue ? <span className="text-[13px] font-semibold text-warning">Belum ada pembaruan kurir sejak {formatWib(order.history[0]!.at, { withYear: false })}</span> : null}
      {order.payment.status === "pending" ? <span className="text-[13px] font-semibold text-warning">Bayar sebelum {formatWib(order.payment.expiresAt, { withYear: false })}</span> : null}
    </Link>
  );
}

export function OrdersPage() {
  const orders = useOrders();
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold">Pesanan</h1>
      <div className="card flex flex-col gap-2 p-4">{orders.length ? orders.map((o) => <OrderRow key={o.number} order={o} />) : <p className="text-muted">Belum ada pesanan.</p>}</div>
    </div>
  );
}

const STEPS = ["Dibayar", "Diproses", "Dikirim", "Dalam perjalanan", "Diterima"];
const STEP_INDEX: Record<string, number> = { to_process: 1, processing: 2, shipped: 3, in_transit: 4, delivered: 5 };

export function OrderDetailPage() {
  const { nomor = "" } = useParams();
  const session = useShop((s) => s.session)!;
  const notify = useShop((s) => s.notify);
  const [waOpen, setWaOpen] = useState(false);
  const closeWa = useCallback(() => setWaOpen(false), []);
  useBackendVersion();
  const order = backend.get(nomor);
  if (!order || order.customerId !== session.customerId) return <NotFound />; // never reveal other customers' orders
  const address = demoCustomer.addresses.find((a) => a.id === order.addressId);
  const done = order.payment.status === "paid" ? STEP_INDEX[order.fulfilment] ?? 0 : 0;
  const overdue = isCourierOverdue(order, backend.now());
  const copy = async () => {
    try { await navigator.clipboard.writeText(order.trackingNumber ?? ""); notify("Nomor resi disalin"); }
    catch { notify(`Salin manual: ${order.trackingNumber}`); }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2"><h1 className="money text-2xl font-semibold">{order.number}</h1><StatusChip order={order} /></div>
      <p className="text-sm text-muted">Dipesan {formatWib(order.createdAt)} · {order.courier.service}</p>
      {order.trackingNumber ? <p className="flex flex-wrap items-center gap-2 text-sm">Resi <b className="money">{order.trackingNumber}</b><button type="button" className="btn-secondary min-h-[36px] px-3 text-[13px]" onClick={copy}>Salin</button></p> : null}
      {order.payment.status === "paid" ? (
        <ol aria-label="Tahap pesanan" className="grid grid-cols-5 gap-1 text-[11px] sm:text-[12px]">
          {STEPS.map((t, i) => <li key={t} aria-current={i === done - 1 ? "step" : undefined} className="flex flex-col gap-1"><span className={`h-1.5 rounded ${i < done ? "bg-primary" : "bg-line"}`} /><span className={i < done ? "font-semibold" : "text-muted"}>{t}</span></li>)}
        </ol>
      ) : null}
      {overdue ? (
        <div role="status" className="flex flex-col gap-2 rounded-brand bg-[#FDF1DC] p-4 text-sm text-[#6B4100]">
          <b>Belum ada pembaruan dari kurir sejak {formatWib(order.history[0]!.at)}</b>
          <span>Lebih dari 72 jam. Tim kami bisa membantu menanyakan ke kurir.</span>
          <button type="button" className="btn-primary self-start" onClick={() => setWaOpen(true)}>Hubungi CS via WhatsApp</button>
        </div>
      ) : null}
      {order.payment.status === "pending" ? <Link to={`/pembayaran/${order.number}`} className="btn-primary self-start">Lanjutkan pembayaran</Link> : null}
      <section className="card flex flex-col gap-1 p-4 text-sm" aria-label="Riwayat status">
        <b>Riwayat status</b>
        {order.history.map((h, i) => <span key={i} className="flex flex-col border-t border-line pt-1"><span className="font-semibold">{h.status}</span><span className="text-muted">{formatWib(h.at)} · {h.actor}</span></span>)}
      </section>
      <section className="card flex flex-col gap-3 p-4" aria-label="Rincian">
        {order.totals.lines.map((l) => <span key={`${l.sku}${l.isGift}`} className="flex justify-between text-sm"><span>{l.qty}× {l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</span><span className="money">{formatIDR(l.lineTotal)}</span></span>)}
        <SummaryRows totals={order.totals} stage="checkout" courierName={order.courier.service.split(" · ")[0]} />
        <span className="text-[13px] text-muted">{address ? `${address.recipient} · ${address.line}, ${address.city} ${address.postalCode}` : ""}</span>
      </section>
      {waOpen ? (
        <Dialog titleId="wa-t" onClose={closeWa} placement="sheet">
            <h2 id="wa-t" className="text-xl font-semibold">Buka WhatsApp CS?</h2>
            <p className="text-sm">Pesan yang akan terisi otomatis:</p>
            <p className="rounded-brand bg-alt p-3 text-sm">Halo, saya ingin menanyakan pesanan {order.number}.</p>
            <p className="text-[13px] text-muted">Hanya nomor pesanan yang dikirim. Nomor WhatsApp CS diisi pemilik toko (D16). Di prototipe tidak ada yang dibuka.</p>
            <div className="flex gap-2"><button type="button" autoFocus className="btn-secondary flex-1" onClick={() => setWaOpen(false)}>Batal</button><button type="button" className="btn-primary flex-1" onClick={() => { setWaOpen(false); notify("WhatsApp dibuka (simulasi) · tidak ada pesan terkirim"); }}>Buka WhatsApp</button></div>
        </Dialog>
      ) : null}
    </div>
  );
}

export function WishlistPage() {
  const session = useShop((s) => s.session)!;
  const brand = useShop((s) => s.brand);
  const addToCart = useShop((s) => s.addToCart);
  const notify = useShop((s) => s.notify);
  const { products, catalog, promotions } = useCatalog();
  const ids = backend.wishlist(session.customerId, brand);
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold">Wishlist</h1>
      {ids.length === 0 ? <p className="text-muted">Belum ada produk tersimpan. Ketuk ikon hati di halaman produk.</p> : null}
      {ids.map((id) => {
        const p = products.find((x) => x.id === id);
        if (!p) return null;
        const v = p.variants[0]!;
        const a = available(catalog, v.sku);
        return (
          <div key={id} className="card grid grid-cols-[72px_1fr] items-center gap-3 p-3">
            <ProductArt kind={p.art.kind} bg={p.art.bg} accent={p.art.accent} label={p.name} className="rounded-brand" />
            <div className="flex flex-col gap-1">
              <Link to={`/produk/${p.slug}`} className="font-semibold underline">{p.name}</Link>
              <span className="money">{formatIDR(bestUnitPrice(catalog, promotions, v.sku, backend.now()).unit)}</span>
              <StockNote available={a} />
              <div className="flex flex-wrap gap-3">
                {p.variants.length > 1 ? <Link to={`/produk/${p.slug}`} className="btn-secondary min-h-[40px]">Pilih varian</Link> : (
                  <button type="button" className="btn-primary min-h-[40px]" disabled={a === 0} onClick={() => { const r = addToCart(v.sku, 1); notify(r.added ? `Ditambahkan: ${p.name}` : "Batas stok tercapai", r.added ? "info" : "error", r.added ? { label: "Lihat keranjang", to: "/keranjang" } : undefined); }}>{a === 0 ? "Stok habis" : "+ Keranjang"}</button>
                )}
                <button type="button" className="text-[13px] text-danger underline" onClick={() => { backend.toggleWishlist(session.customerId, brand, id); notify("Dihapus dari wishlist"); }}>Hapus</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AddressesPage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold">Buku alamat</h1>
      {demoCustomer.addresses.map((a) => (
        <div key={a.id} className={`card flex flex-col gap-0.5 p-4 ${a.isPrimary ? "border-2 border-primary" : ""}`}>
          <b>{a.label}{a.isPrimary ? " · utama" : ""}</b><span className="text-sm">{a.recipient} · {a.phone}</span><span className="text-[13px] text-muted">{a.line}, {a.city} {a.postalCode}</span>
        </div>
      ))}
      <p className="text-[13px] text-muted">Formulir tambah/ubah alamat (field D13) mengikuti desain H14; interaktif di batch berikutnya bila diperlukan.</p>
    </div>
  );
}

const PREFS: { key: ConsentKey; title: string; desc: string; offNote?: string }[] = [
  { key: "emailPromo", title: "Email promo & produk baru", desc: "Maks. 2 email per bulan." },
  { key: "waOrderInfo", title: "Info pesanan lewat WhatsApp", desc: "Pembayaran diterima, resi, dan kendala pengiriman.", offNote: "Info pesanan tetap dikirim lewat email." },
  { key: "personalised", title: "Rekomendasi pribadi", desc: "Saran berdasarkan pesanan dan wishlist di situs ini.", offNote: "Rekomendasi di akun diganti produk populer umum." },
];

export function PreferencesPage() {
  const session = useShop((s) => s.session)!;
  const notify = useShop((s) => s.notify);
  useBackendVersion();
  const saved = backend.consents();
  const [draft, setDraft] = useState<Record<ConsentKey, boolean>>({ emailPromo: saved.emailPromo.granted, waOrderInfo: saved.waOrderInfo.granted, personalised: saved.personalised.granted });
  const dirty = PREFS.some((p) => draft[p.key] !== saved[p.key].granted);
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); backend.updateConsents(session.customerId, draft); notify("Preferensi disimpan dengan waktu perubahan."); }}>
      <h1 className="text-3xl font-semibold">Preferensi komunikasi</h1>
      <p className="text-sm text-muted">Pilihanmu disimpan beserta waktunya sebagai bukti persetujuan. Bisa diubah kapan saja.</p>
      {PREFS.map((p) => {
        const on = draft[p.key];
        const changed = on !== saved[p.key].granted;
        return (
          <div key={p.key} className="card flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="flex flex-col"><b id={`pf-${p.key}`}>{p.title}</b><span className="text-[13px] text-muted">{p.desc}</span></span>
              <button type="button" role="switch" aria-checked={on} aria-labelledby={`pf-${p.key}`} onClick={() => setDraft({ ...draft, [p.key]: !on })}
                className={`relative h-7 w-12 shrink-0 rounded-full ${on ? "bg-primary" : "bg-line-strong"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "right-1" : "left-1"}`} />
              </button>
            </div>
            <span className="font-mono text-[12px] text-muted">{changed ? "Belum disimpan" : `${saved[p.key].granted ? "Diizinkan" : "Tidak diizinkan"} · ${formatWib(saved[p.key].changedAt)} · ${saved[p.key].source}`}</span>
            {!on && p.offNote ? <span className="text-[13px] text-warning">{p.offNote}</span> : null}
          </div>
        );
      })}
      <div className="flex gap-2"><button type="button" className="btn-secondary" disabled={!dirty} onClick={() => setDraft({ emailPromo: saved.emailPromo.granted, waOrderInfo: saved.waOrderInfo.granted, personalised: saved.personalised.granted })}>Batal</button><button type="submit" className="btn-primary" disabled={!dirty}>Simpan</button></div>
    </form>
  );
}
