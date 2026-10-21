import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBackendVersion } from "../store/shop";
import { Badge, PriceBlock, ProductArt, QtyStepper, StockNote } from "../components/ui";
import { formatIDR } from "../domain/money";
import { bestUnitPrice } from "../domain/pricing";
import { available, maxAddable } from "../domain/stock";
import { categories } from "../mocks/fixtures";
import { backend } from "../services/http/backend";
import { useBrand, useCatalog } from "../store/hooks";
import { useShop } from "../store/shop";
import { NotFound } from "./NotFound";

export function ProductPage() {
  const { slug } = useParams();
  const { catalog, promotions, products } = useCatalog();
  const product = products.find((p) => p.slug === slug);
  const firstInStock = product?.variants.find((v) => available(catalog, v.sku) > 0) ?? product?.variants[0];
  const [sku, setSku] = useState(firstInStock?.sku ?? "");
  const [qty, setQty] = useState(1);
  const addToCart = useShop((s) => s.addToCart);
  const notify = useShop((s) => s.notify);
  const session = useShop((s) => s.session);
  const navigate = useNavigate();
  useBackendVersion();
  const cart = useShop((s) => s.cart);
  const brand = useBrand();
  if (!product) return <NotFound />;
  const variant = product.variants.find((v) => v.sku === sku) ?? product.variants[0]!;
  const best = bestUnitPrice(catalog, promotions, variant.sku, backend.now());
  const stock = available(catalog, variant.sku);
  const room = maxAddable(catalog, variant.sku, cart, brand.maxQtyPerLine);
  const category = categories.find((c) => c.id === product.categoryId);
  const promo = promotions.find((p) => p.kind === "price" && p.code === best.code);
  const gift = promotions.find((p) => p.kind === "gift" && p.triggerSku === variant.sku);
  const q = Math.min(qty, Math.max(room, 1));
  const was = best.code ? best.regular : variant.compareAt;

  const add = () => {
    const { added } = addToCart(variant.sku, q);
    if (added === 0) notify("Batas stok tercapai untuk produk ini.", "error");
    else notify(`Ditambahkan: ${added}× ${product.name}${variant.label ? ` (${variant.label})` : ""}`, "info", { label: "Lihat keranjang", to: "/keranjang" });
    setQty(1);
  };

  return (
    <div className="flex flex-col gap-4 pb-24 md:pb-0">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap gap-1"><li><Link to="/" className="underline">Beranda</Link> /</li><li><Link to={`/kategori/${category?.slug}`} className="underline">{category?.name}</Link> /</li><li aria-current="page">{product.name}</li></ol>
      </nav>
      <div className="grid gap-6 md:grid-cols-2">
        <ProductArt kind={product.art.kind} bg={product.art.bg} accent={product.art.accent} label={product.name} className="rounded-brand" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {best.isFlashSale && promo?.kind === "price" ? <Badge text={`FLASH SALE · berakhir 22 Okt 23:59`} tone="flash" /> : variant.compareAt ? <Badge text={product.components ? `Hemat ${formatIDR(variant.compareAt - variant.price)}` : "HARGA CORET"} tone="strike" /> : null}
          </div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold leading-tight">{product.name}</h1>
            <WishButton productId={product.id} session={session} onGuest={() => navigate(`/masuk?alasan=wishlist&wish=${product.id}&next=${encodeURIComponent(`/produk/${product.slug}`)}`)} onToggle={(added) => notify(added ? "Disimpan ke wishlist" : "Dihapus dari wishlist")} />
          </div>
          {product.spec ? <p className="text-muted">{product.spec}</p> : null}
          <PriceBlock price={best.unit} was={was} size="lg" />
          {gift && gift.kind === "gift" ? <p className="rounded-brand bg-primary-soft p-3 text-sm text-primary-ink">{gift.code}: setiap beli {gift.triggerQty}, gratis {gift.giftQty} Travel Cleanser 30 ml. Otomatis di keranjang.</p> : null}
          {product.variants.length > 1 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-semibold">Pilih varian</legend>
              <div className="grid grid-cols-2 gap-2">
                {product.variants.map((v) => {
                  const a = available(catalog, v.sku);
                  const on = v.sku === variant.sku;
                  return (
                    <button key={v.sku} type="button" aria-pressed={on} disabled={a === 0} onClick={() => { setSku(v.sku); setQty(1); }}
                      className={`flex min-h-[52px] flex-col items-start justify-center rounded-ctl px-3 text-left ${a === 0 ? "border border-dashed border-line bg-alt text-muted line-through" : on ? "border-2 border-primary bg-primary-soft text-primary-ink" : "border border-line-strong bg-surface"}`}>
                      <span className="font-semibold">{v.label}</span>
                      <span className="text-[12px]">{a === 0 ? "Habis" : formatIDR(bestUnitPrice(catalog, promotions, v.sku, backend.now()).unit)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          {product.components ? (
            <div className="card flex flex-col gap-1 p-4 text-sm">
              <b>Isi bundel</b>
              {Object.keys(product.components).map((c) => { const hit = catalog.bySku.get(c)!; return <span key={c} className="flex justify-between"><span>{hit.product.name} {hit.variant.label}</span><span className="money">{formatIDR(hit.variant.price)}</span></span>; })}
              <span className="text-muted">Stok bundel mengikuti komponen dengan stok paling sedikit (Sunscreen).</span>
            </div>
          ) : null}
          <StockNote available={stock} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold">Jumlah</span>
            <QtyStepper value={q} max={Math.max(room, 1)} onChange={setQty} label="jumlah" />
            <span className="text-[13px] text-muted">{room === 0 ? (stock === 0 ? "" : "Semua stok tersedia sudah di keranjang") : `maks. ${room}`}</span>
          </div>
          <p className="text-[13px] text-muted">Harga sudah termasuk PPN. Ulasan belum ditampilkan di prototipe.</p>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface p-3 md:static md:border-0 md:bg-transparent md:p-0">
            <button type="button" className="btn-primary w-full md:w-auto" disabled={room === 0} onClick={add}>
              {room === 0 ? (stock === 0 ? "Stok habis" : "Batas stok tercapai") : `+ Keranjang · ${formatIDR(best.unit * q)}`}
            </button>
          </div>
          {product.specs ? (
            <table className="mt-2 w-full text-sm">
              <caption className="pb-2 text-left font-semibold">Spesifikasi</caption>
              <tbody>{Object.entries(product.specs).map(([k, v]) => <tr key={k} className="border-t border-line"><th scope="row" className="w-2/5 py-2 text-left font-normal text-muted">{k}</th><td className={v === "Tidak dicantumkan" ? "italic text-muted" : ""}>{v}</td></tr>)}</tbody>
            </table>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WishButton({ productId, session, onGuest, onToggle }: { productId: string; session: { customerId: string } | null; onGuest: () => void; onToggle: (added: boolean) => void }) {
  const brand = useShop((s) => s.brand);
  const wished = session ? backend.wishlist(session.customerId, brand).includes(productId) : false;
  return (
    <button type="button" aria-pressed={wished} aria-label={wished ? "Hapus dari wishlist" : "Simpan ke wishlist"}
      onClick={() => (session ? onToggle(backend.toggleWishlist(session.customerId, brand, productId)) : onGuest())}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong ${wished ? "bg-primary-soft" : "bg-surface"}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill={wished ? "rgb(var(--c-accent))" : "none"} stroke="rgb(var(--c-accent))" strokeWidth="1.75" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
    </button>
  );
}
