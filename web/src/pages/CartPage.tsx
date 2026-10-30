import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SummaryRows } from "../components/Summary";
import { ProductPhoto } from "../components/ProductPhoto";
import { QtyStepper } from "../components/ui";
import { photoForVariant, photoSizes } from "../domain/photos";
import { DEMO_TOOLS } from "../config/brands";
import { formatIDR } from "../domain/money";
import { available, maxAddable } from "../domain/stock";
import { useBrand, useCatalog, useTotals } from "../store/hooks";
import { useShop } from "../store/shop";

export function CartPage() {
  const brand = useBrand();
  const { catalog, promotions } = useCatalog();
  const s = useShop();
  const totals = useTotals(false);
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  if (s.cart.length === 0) {
    return (
      <div className="card mx-auto flex max-w-lg flex-col items-start gap-3 p-8">
        <h1 className="text-2xl font-semibold">Keranjang masih kosong</h1>
        <p className="text-muted">Mulai dari kategori{DEMO_TOOLS && brand.id === "sambung" ? " atau isi skenario baku dari panel uji di beranda" : ""}.</p>
        <Link to="/kategori/semua" className="btn-primary">Lihat produk</Link>
      </div>
    );
  }

  const voucherCodes = promotions.filter((p) => p.kind === "order" || p.kind === "shipping").map((p) => p.code);
  const overStock = s.cart.filter((l) => l.qty > available(catalog, l.sku));
  const submit = (e: React.FormEvent) => { e.preventDefault(); s.applyVoucher(code); setCode(""); };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-labelledby="cart-h" className="flex flex-col gap-4">
        <h1 id="cart-h" className="text-3xl font-semibold">Keranjang ({totals.itemCount})</h1>
        {overStock.length ? <p role="alert" className="rounded-brand bg-[#FDECEC] p-3 text-sm font-semibold text-danger">Stok berubah untuk {overStock.length} barang. Kurangi jumlah sebelum checkout.</p> : null}
        <ul className="flex flex-col gap-3">
          {totals.lines.map((l) => {
            const entry = catalog.bySku.get(l.sku);
            if (!entry) {
              return (
                <li key={`${l.sku}-${l.isGift}`} className="card flex items-center justify-between gap-3 p-4">
                  <div className="flex flex-col">
                    <b className="text-[15px]">{l.name || l.sku}</b>
                    <span className="text-[13px] text-muted">Produk tidak lagi tersedia</span>
                  </div>
                  <button type="button" className="btn-secondary text-[13px] text-danger" onClick={() => { s.remove(l.sku); s.notify("Barang dihapus dari keranjang"); }}>Hapus</button>
                </li>
              );
            }
            const { product } = entry;
            const others = s.cart.filter((c) => c.sku !== l.sku);
            const cap = l.isGift ? l.qty : maxAddable(catalog, l.sku, others, brand.maxQtyPerLine);
            return (
              <li key={`${l.sku}-${l.isGift}`} className="card grid grid-cols-[80px_1fr] gap-3 p-3">
                <ProductPhoto product={product} image={photoForVariant(product, l.sku)} sizes={photoSizes("cartRow")} decorative className="rounded-brand" />
                <div className="flex min-w-0 flex-col gap-1">
                  <b className="text-[15px]">{l.name}</b>
                  <span className="text-[13px] text-muted">{l.variantLabel ? `${l.variantLabel} · ` : ""}{l.isGift ? "Gratis" : formatIDR(l.unitPrice)}{l.appliedPriceCode && !l.isGift ? ` · ${l.appliedPriceCode}` : ""}</span>
                  {l.isFlashSale ? <span className="text-[12.5px] text-warning">Harga flash sale s/d 22 Okt · tidak dapat voucher pesanan</span> : null}
                  {l.isGift ? <span className="text-[12.5px] text-success">Otomatis dari {l.appliedPriceCode}</span> : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {l.isGift ? <span className="money">{l.qty}×</span> : <QtyStepper value={l.qty} max={cap} onChange={(n) => s.setQty(l.sku, n)} label={`jumlah ${l.name}`} />}
                    <span className="money font-semibold">{l.isGift ? <><s className="mr-2 text-muted">{formatIDR(l.regularUnit * l.qty)}</s>Rp0</> : formatIDR(l.lineTotal)}</span>
                  </div>
                  {!l.isGift ? <button type="button" className="self-start py-1 text-[13px] text-danger underline" onClick={() => { s.remove(l.sku); s.notify("Barang dihapus dari keranjang"); }}>Hapus</button> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <section aria-labelledby="voucher-h" className="card flex flex-col gap-3 p-4">
          <h2 id="voucher-h" className="font-body text-[16px] font-semibold">Voucher</h2>
          <p className="text-[13px] text-muted">Maks. 1 voucher pesanan + 1 voucher ongkir. Voucher pesanan tidak berlaku untuk barang flash sale.</p>
          <form onSubmit={submit} className="flex gap-2">
              <label className="sr-only" htmlFor="voucher">Kode voucher</label>
              <input id="voucher" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Masukkan kode" autoComplete="off"
                className="min-h-[44px] flex-1 rounded-ctl border border-line-strong px-3 font-mono uppercase" />
              <button type="submit" className="btn-secondary" disabled={!code.trim()}>Pakai</button>
            </form>
          {DEMO_TOOLS && voucherCodes.length ? (
            <div className="flex flex-wrap gap-2" aria-label="Kode demo">
              {[...voucherCodes, "DISKON99"].map((c) => <button key={c} type="button" onClick={() => s.applyVoucher(c)} className="chip-off font-mono">{c}</button>)}
            </div>
          ) : null}
          {s.voucherMessage ? <p role="status" className={`text-[13px] font-semibold ${s.voucherMessage.tone === "error" ? "text-danger" : "text-success"}`}>{s.voucherMessage.text}</p> : null}
          {[totals.orderVoucher && { kind: "order" as const, ...totals.orderVoucher }, s.shippingVoucher && { kind: "shipping" as const, code: s.shippingVoucher, status: totals.shippingVoucher?.status ?? { ok: true, discount: 0, message: "Dihitung setelah pilih kurir" } }]
            .filter(Boolean).map((v) => v && (
              <div key={v.code} className={`flex items-center justify-between gap-2 rounded-ctl px-3 py-2 text-[13px] ${v.status.ok ? "bg-[#E3F4EA] text-[#14532D]" : "bg-[#FDF1DC] text-[#6B4100]"}`}>
                <span className="flex flex-col"><b className="font-mono">{v.code}</b><span>{v.status.message}</span></span>
                <button type="button" onClick={() => s.removeVoucher(v.kind)} className="min-h-[40px] underline" aria-label={`Lepas voucher ${v.code}`}>Lepas</button>
              </div>
            ))}
        </section>
        <section className="card flex flex-col gap-3 p-4" aria-label="Ringkasan">
          <SummaryRows totals={totals} stage="cart" />
          <button type="button" className="btn-primary w-full" disabled={overStock.length > 0} onClick={() => navigate("/checkout/pengiriman")}>Lanjut ke pengiriman</button>
        </section>
      </aside>
    </div>
  );
}
