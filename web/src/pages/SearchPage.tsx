import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { photoSizes } from "../domain/photos";
import { search } from "../domain/search";
import { categories } from "../mocks/fixtures";
import { useBrand, useCatalog } from "../store/hooks";
import { useShop } from "../store/shop";

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const brand = useBrand();
  const { products } = useCatalog();
  const recent = useShop((s) => s.recentSearches);
  const clearRecent = useShop((s) => s.clearRecentSearches);
  const addRecent = useShop((s) => s.addRecentSearch);
  const navigate = useNavigate();
  const res = search(products, q);
  const go = (t: string) => { addRecent(t); navigate(`/cari?q=${encodeURIComponent(t)}`); };
  const cats = categories.filter((c) => c.brand === brand.id);

  return (
    <div className="flex flex-col gap-5">
      {!q ? (
        <section className="flex flex-col gap-3" aria-labelledby="recent-h">
          <div className="flex items-center justify-between">
            <h1 id="recent-h" className="text-2xl font-semibold">Pencarian terakhir</h1>
            {recent.length ? <button type="button" className="btn-ghost" onClick={clearRecent}>Hapus riwayat</button> : null}
          </div>
          {recent.length ? (
            <div className="flex flex-wrap gap-2">{recent.map((t) => <button key={t} type="button" className="chip-off" onClick={() => go(t)}>{t}</button>)}</div>
          ) : <p className="text-muted">Riwayat pencarian kosong. Riwayat hanya disimpan di sesi ini.</p>}
        </section>
      ) : (
        <>
          <div aria-live="polite">
            <h1 className="text-2xl font-semibold">{res.products.length} hasil untuk “{q}”</h1>
            {res.synonymApplied || res.lengthM ? (
              <p className="text-sm text-primary-ink">{res.synonymApplied ? "Juga dicari sebagai “USB Type-C”" : ""}{res.synonymApplied && res.lengthM ? " · " : ""}{res.lengthM ? `panjang ${res.lengthM} m` : ""}</p>
            ) : null}
          </div>
          {res.products.length === 0 ? (
            <div className="card flex flex-col items-start gap-3 p-6">
              <b>Tidak ada produk yang cocok</b>
              <span className="text-sm text-muted">Periksa ejaan atau coba kategori:</span>
              <div className="flex flex-wrap gap-2">{cats.map((c) => <Link key={c.id} to={`/kategori/${c.slug}`} className="chip-off">{c.name}</Link>)}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{res.products.map((p) => <ProductCard key={p.id} product={p} lengthM={res.lengthM ?? undefined} sizes={photoSizes("searchCard")} />)}</div>
          )}
        </>
      )}
    </div>
  );
}
