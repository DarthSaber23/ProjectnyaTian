import { Link, useNavigate } from "react-router-dom";
import { DEMO_TOOLS } from "../config/brands";
import { backend } from "../services/http/backend";
import { categories } from "../mocks/fixtures";
import { FromBlog } from "../components/FromBlog";
import { ProductCard } from "../components/ProductCard";
import { useBrand, useCatalog } from "../store/hooks";
import { useShop } from "../store/shop";

const CONCERNS = [
  { id: "sensitif", label: "Kulit sensitif" },
  { id: "kering", label: "Kulit kering" },
  { id: "kusam", label: "Tampak kusam" },
  { id: "perlindungan", label: "Perlindungan harian" },
];

export function Home() {
  const brand = useBrand();
  const { products } = useCatalog();
  const navigate = useNavigate();
  const restoreCart = useShop((s) => s.restoreCart);
  const cats = categories.filter((c) => c.brand === brand.id);
  const featured = brand.id === "sambung" ? products.filter((p) => ["B03", "B01", "B02", "B04"].includes(p.id)) : products.filter((p) => ["A01", "BND-PAGI", "A03", "A02"].includes(p.id));

  return (
    <div className="flex flex-col gap-10">
      <section className={`flex flex-col gap-4 rounded-brand p-6 md:p-10 ${brand.id === "sambung" ? "bg-ink text-white" : "bg-alt"}`}>
        <span className={`text-[12px] font-semibold tracking-widest ${brand.id === "sambung" ? "text-accent" : "text-muted"}`}>{brand.id === "sambung" ? "FLASH SALE · 20–22 OKT" : "MULAI DARI KEBUTUHAN KULITMU"}</span>
        <h1 className={`max-w-2xl text-3xl leading-tight md:text-5xl ${brand.id === "halimun" ? "font-medium" : "font-semibold"}`}>{brand.copy.heroTitle}</h1>
        <div className="flex flex-wrap gap-3">
          <Link to="/kategori/semua" className="btn-primary">{brand.copy.heroCta}</Link>
          {brand.id === "sambung" ? <Link to="/produk/charger-gan-65w-3-port" className="btn border border-white/60 text-white hover:bg-white/10">Charger GaN 65W · Rp299.250</Link> : null}
        </div>
      </section>

      {brand.features.concerns ? (
        <section aria-labelledby="concern-h" className="flex flex-col gap-3">
          <h2 id="concern-h" className="text-2xl font-medium">Pilih kebutuhan kulit</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {CONCERNS.map((c) => {
              const n = products.filter((p) => p.tags?.includes(c.id)).length;
              return (
                <Link key={c.id} to={`/kategori/semua?kebutuhan=${c.id}`} className="flex min-h-[96px] flex-col justify-end gap-0.5 rounded-brand bg-alt p-4 hover:bg-primary-soft">
                  <span className="text-[16px] font-semibold">{c.label}</span>
                  <span className="text-[13px] text-muted">{n} produk</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <section aria-labelledby="cat-h" className="flex flex-col gap-3">
          <h2 id="cat-h" className="text-2xl font-semibold">Kategori</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cats.map((c) => (
              <Link key={c.id} to={`/kategori/${c.slug}`} className="flex min-h-[72px] items-center justify-between rounded-brand border border-line bg-alt px-4 font-semibold hover:border-primary">
                {c.name}<span className="text-sm font-normal text-muted">{products.filter((p) => p.categoryId === c.id).length}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="feat-h" className="flex flex-col gap-3">
        <h2 id="feat-h" className="text-2xl font-semibold">Pilihan untukmu</h2>
        {backend.loading && products.length === 0 ? <p className="text-sm text-muted">Memuat katalog…</p> : <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{featured.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
      </section>

      <FromBlog />

      {DEMO_TOOLS && brand.id === "sambung" ? (
        <section className="sim-panel flex flex-col gap-2 text-[14px]" aria-label="Panel uji">
          <b className="font-mono text-[12px]">PANEL UJI · bukan bagian dari toko</b>
          <span>Skenario baku W00: 2× Kabel USB-C 100W 2 m Hitam + 1× Charger GaN 65W.</span>
          <button type="button" className="btn-secondary self-start" onClick={() => { restoreCart([{ sku: "B01-2M-BLK", qty: 2 }, { sku: "B03", qty: 1 }]); navigate("/keranjang"); }}>
            Isi keranjang skenario baku
          </button>
        </section>
      ) : null}
    </div>
  );
}
