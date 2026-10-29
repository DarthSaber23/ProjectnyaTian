import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { photoSizes } from "../domain/photos";
import { bestUnitPrice } from "../domain/pricing";
import { available } from "../domain/stock";
import { categories } from "../mocks/fixtures";
import { backend } from "../services/http/backend";
import { useBrand, useCatalog } from "../store/hooks";
import { NotFound } from "./NotFound";

const PAGE_SIZE = 24; // D9
const CONCERNS: Record<string, string> = { sensitif: "Kulit sensitif", kering: "Kulit kering", kusam: "Tampak kusam", perlindungan: "Perlindungan harian" };
type Sort = "rekomendasi" | "termurah" | "termahal";

export function Catalog() {
  const { slug = "semua" } = useParams();
  const [params, setParams] = useSearchParams();
  const brand = useBrand();
  const { catalog, promotions, products } = useCatalog();
  const [sort, setSort] = useState<Sort>("rekomendasi");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  const cats = categories.filter((c) => c.brand === brand.id);
  const category = cats.find((c) => c.slug === slug);
  const concern = params.get("kebutuhan") ?? "";

  const list = useMemo(() => {
    const price = (id: string) => Math.min(...products.find((p) => p.id === id)!.variants.map((v) => bestUnitPrice(catalog, promotions, v.sku, backend.now()).unit));
    let l = products.filter((p) => (!category || p.categoryId === category.id) && (!concern || p.tags?.includes(concern)));
    if (inStockOnly) l = l.filter((p) => p.variants.some((v) => available(catalog, v.sku) > 0));
    if (sort !== "rekomendasi") l = [...l].sort((a, b) => (sort === "termurah" ? price(a.id) - price(b.id) : price(b.id) - price(a.id)));
    return l;
  }, [products, category, concern, inStockOnly, sort, catalog, promotions]);

  if (slug !== "semua" && !category) return <NotFound />;
  const title = category?.name ?? (concern ? CONCERNS[concern] : "Semua produk");

  const filters = (
    <div className="flex flex-col gap-4">
      {brand.features.concerns ? (
        <div role="group" aria-label="Kebutuhan kulit" className="flex flex-wrap gap-2">
          {["", ...Object.keys(CONCERNS)].map((k) => (
            <button key={k || "all"} type="button" aria-pressed={concern === k} className={concern === k ? "chip-on" : "chip-off"}
              onClick={() => { const p = new URLSearchParams(params); if (k) p.set("kebutuhan", k); else p.delete("kebutuhan"); setParams(p); }}>
              {k ? CONCERNS[k] : "Semua"} {products.filter((p) => !k || p.tags?.includes(k)).length}
            </button>
          ))}
        </div>
      ) : (
        <nav aria-label="Kategori" className="flex flex-col gap-1">
          <h2 className="font-body text-[13px] font-semibold uppercase tracking-wide text-muted">Kategori</h2>
          {[{ slug: "semua", name: "Semua produk", id: "" }, ...cats].map((c) => (
            <Link key={c.slug} to={`/kategori/${c.slug}`} aria-current={c.slug === slug ? "page" : undefined}
              className={`flex justify-between rounded-ctl px-3 py-2 text-sm ${c.slug === slug ? "bg-primary-soft font-semibold text-primary-ink" : "hover:bg-alt"}`}>
              {c.name}<span className="text-muted">{products.filter((p) => !c.id || p.categoryId === c.id).length}</span>
            </Link>
          ))}
        </nav>
      )}
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-5 w-5" /> Hanya yang tersedia
      </label>
    </div>
  );

  return (
    <div className={`grid gap-6 ${brand.features.filterLayout === "sidebar" ? "md:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
      {brand.features.filterLayout === "sidebar" ? <aside className="md:pt-12">{filters}</aside> : null}
      <section className="flex flex-col gap-4" aria-labelledby="cat-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="cat-title" className="text-3xl font-semibold">{title}</h1>
            <p className="text-sm text-muted" aria-live="polite">{list.length} produk</p>
          </div>
          <label className="flex items-center gap-2 text-sm">Urutkan
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-[44px] rounded-ctl border border-line-strong bg-surface px-3">
              <option value="rekomendasi">Rekomendasi</option><option value="termurah">Harga terendah</option><option value="termahal">Harga tertinggi</option>
            </select>
          </label>
        </div>
        {brand.features.filterLayout === "topbar" ? filters : null}
        {list.length === 0 ? (
          <div className="card flex flex-col items-start gap-3 p-6"><b>Tidak ada produk yang cocok</b><span className="text-sm text-muted">Coba hapus filter.</span>
            <button type="button" className="btn-secondary" onClick={() => { setInStockOnly(false); setParams(new URLSearchParams()); }}>Hapus filter</button></div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">{list.slice(0, shown).map((p) => <ProductCard key={p.id} product={p} sizes={photoSizes("catalogCard")} />)}</div>
        )}
        {list.length > shown ? <button type="button" className="btn-secondary self-center" onClick={() => setShown((n) => n + PAGE_SIZE)}>Muat lebih banyak</button> : null}
      </section>
    </div>
  );
}
