import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { applyBrand, BRANDS, DEMO_TOOLS } from "../config/brands";
import { categories } from "../mocks/fixtures";
import { useBrand } from "../store/hooks";
import { useShop } from "../store/shop";
import { Toaster } from "./ui";

export function DemoBar() {
  const brand = useShop((s) => s.brand);
  const setBrand = useShop((s) => s.setBrand);
  const resetAll = useShop((s) => s.resetAll);
  const navigate = useNavigate();
  if (!DEMO_TOOLS) return null;
  return (
    <div className="border-b-2 border-dashed border-[#7D8796] bg-[#F2F4F7] px-4 py-2 text-[12.5px] text-[#0E1726]" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2">
        <b className="font-mono">DEMO</b>
        <span>Data fiktif · waktu simulasi 20 Okt 2026, 10:15 WIB · pembayaran &amp; pengiriman disimulasikan</span>
        <span className="ml-auto flex items-center gap-2" role="group" aria-label="Pilih brand demo">
          {(["sambung", "halimun"] as const).map((b) => (
            <button key={b} type="button" aria-pressed={brand === b} onClick={() => { setBrand(b); navigate("/"); }}
              className={`min-h-[32px] rounded border px-2 font-semibold ${brand === b ? "border-[#1F5AE0] bg-[#EAF0FD] text-[#1747B5]" : "border-[#7D8796] bg-white"}`}>
              {BRANDS[b].name}
            </button>
          ))}
          <button type="button" onClick={() => navigate("/admin")} className="min-h-[32px] rounded border border-[#7D8796] bg-white px-2 font-semibold">Admin</button>
          <button type="button" onClick={() => navigate("/")} className="min-h-[32px] rounded border border-[#7D8796] bg-white px-2 font-semibold">Toko</button>
          <button type="button" onClick={() => { resetAll(); navigate("/"); }} className="min-h-[32px] rounded border border-[#7D8796] bg-white px-2 font-semibold">Atur ulang</button>
        </span>
      </div>
    </div>
  );
}

function SearchBox() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const addRecent = useShop((s) => s.addRecentSearch);
  return (
    <form role="search" className="order-last w-full md:order-none md:ml-auto md:w-72" onSubmit={(e) => { e.preventDefault(); if (q.trim()) addRecent(q); navigate(q.trim() ? `/cari?q=${encodeURIComponent(q.trim())}` : "/cari"); }}>
      <label htmlFor="site-search" className="sr-only">Cari produk</label>
      <input id="site-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => { if (!q) navigate("/cari"); }} placeholder="Cari produk…"
        className="min-h-[44px] w-full rounded-ctl border border-line-strong bg-surface px-3 text-sm" />
    </form>
  );
}

function CompareTray() {
  const brand = useBrand();
  const ids = useShop((s) => s.compare);
  const msg = useShop((s) => s.compareMessage);
  const clear = useShop((s) => s.clearCompare);
  const { pathname } = useLocation();
  const listing = pathname === "/" || pathname.startsWith("/kategori") || pathname.startsWith("/cari");
  if (!brand.features.compare || (ids.length === 0 && !msg) || !listing) return null;
  return (
    <>
    <div aria-hidden="true" className="h-28" />
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]" aria-label="Perbandingan">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3">
        {msg ? <span role="status" className="w-full text-[13px] font-semibold text-warning">{msg}</span> : null}
        <span className="flex-1 text-sm">{ids.length} produk dipilih{ids.length < 2 ? " · pilih minimal 2" : ""}</span>
        <button type="button" className="btn-secondary" onClick={clear}>Kosongkan</button>
        <Link to="/bandingkan" aria-disabled={ids.length < 2} className={`btn-primary ${ids.length < 2 ? "pointer-events-none opacity-50" : ""}`}>Bandingkan ({ids.length}/4)</Link>
      </div>
    </div>
    </>
  );
}

export function Layout() {
  const brand = useBrand();
  const count = useShop((s) => s.cart.reduce((n, l) => n + l.qty, 0));
  const session = useShop((s) => s.session);
  const { pathname } = useLocation();
  useEffect(() => applyBrand(brand), [brand]);
  // Braces keep the effect from returning scrollTo's result: newer Chrome returns a Promise, which React then calls as a cleanup and crashes on route change.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const cats = categories.filter((c) => c.brand === brand.id);
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:p-2">Lewati ke konten</a>
      <DemoBar />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <Link to="/" className={`text-xl font-bold ${brand.id === "halimun" ? "font-display text-2xl font-medium" : "font-display"}`} aria-label={`${brand.name}, beranda`}>
            {brand.id === "sambung" ? <>SAMBUNG<span className="text-primary">/</span></> : brand.wordmark}
          </Link>
          <nav aria-label="Kategori" className="hidden gap-1 md:flex">
            {cats.map((c) => (
              <NavLink key={c.id} to={`/kategori/${c.slug}`} className={({ isActive }) => `rounded-ctl px-3 py-2 text-sm font-medium ${isActive ? "bg-primary-soft text-primary-ink" : "text-ink hover:bg-alt"}`}>
                {c.name}
              </NavLink>
            ))}
          </nav>
          <SearchBox />
          <Link to={session ? "/akun" : "/masuk"} className="ml-auto inline-flex min-h-[44px] items-center px-2 text-sm font-semibold md:ml-0">{session ? `Hai, ${session.name.split(" ")[0]}` : "Masuk"}</Link>
          <Link to="/akun/wishlist" className="inline-flex h-11 w-11 items-center justify-center" aria-label="Wishlist">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
          </Link>
          <Link to="/keranjang" className="relative inline-flex h-11 w-11 items-center justify-center" aria-label={`Keranjang, ${count} barang`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="M3 4h2l2.4 11h11.2L21 8H6.2" /><circle cx="9" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></svg>
            {count > 0 ? <span className="absolute right-0 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">{count}</span> : null}
          </Link>
        </div>
        <nav aria-label="Kategori (ponsel)" className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden">
          {cats.map((c) => (
            <NavLink key={c.id} to={`/kategori/${c.slug}`} className={({ isActive }) => (isActive ? "chip-on" : "chip-off")}>{c.name}</NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-surface">
        {/* The Blog link sits inline so the footer keeps its height (a taller footer makes the loading-state jump larger). */}
        <div className="mx-auto max-w-[1280px] px-4 py-6 text-[13px] text-muted">
          <Link to="/blog" className="py-1 text-ink underline">Blog</Link> · {brand.name} · {brand.tagline}. Harga sudah termasuk PPN. Nama brand adalah nama kerja (belum dicek merek).
        </div>
      </footer>
      <CompareTray />
      <Toaster />
    </div>
  );
}
