import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { compareRows, COMPARE_MAX, NOT_LISTED } from "../domain/compare";
import { formatIDR } from "../domain/money";
import { bestUnitPrice } from "../domain/pricing";
import { available } from "../domain/stock";
import type { Product } from "../domain/types";
import { backend } from "../services/mock/backend";
import { useCatalog } from "../store/hooks";
import { useShop } from "../store/shop";

export function ComparePage() {
  const { catalog, promotions, products } = useCatalog();
  const ids = useShop((s) => s.compare);
  const toggle = useShop((s) => s.toggleCompare);
  const clear = useShop((s) => s.clearCompare);
  const [diffOnly, setDiffOnly] = useState(false);
  const [view, setView] = useState<"cols" | "list">("cols");
  const [page, setPage] = useState(1);
  const list = ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);

  if (list.length < 2) {
    return (
      <div className="card mx-auto flex max-w-lg flex-col items-start gap-3 p-8">
        <h1 className="text-2xl font-semibold">Pilih minimal 2 produk</h1>
        <p className="text-muted">Centang "Bandingkan" di kartu produk (maks. {COMPARE_MAX}, kategori sama).</p>
        <Link to="/kategori/kabel" className="btn-primary">Lihat kabel</Link>
      </div>
    );
  }

  const price = (p: Product) => {
    const units = p.variants.map((v) => bestUnitPrice(catalog, promotions, v.sku, backend.now()).unit);
    const min = Math.min(...units);
    return (new Set(units).size > 1 ? "mulai " : "") + formatIDR(min);
  };
  const stock = (p: Product) => {
    const a = p.variants.map((v) => available(catalog, v.sku));
    const total = a.reduce((x, y) => x + y, 0);
    if (total === 0) return "Stok habis";
    if (p.variants.length > 1) return `${a.filter((x) => x > 0).length} dari ${p.variants.length} varian`;
    return total <= 10 ? `Sisa ${total}` : "Tersedia";
  };
  const length = (p: Product) => {
    const ls = [...new Set(p.variants.map((v) => v.attrs?.lengthM).filter((x) => x !== undefined))];
    return ls.length ? ls.map((l) => `${l} m`).join(" / ") : NOT_LISTED;
  };
  const rows = compareRows(list, { Panjang: length, Harga: price, Ketersediaan: stock }).filter((r) => !diffOnly || r.differs);
  const pages = list.length - 1;
  const pg = Math.min(page, pages);
  const cell = (v: string, differs: boolean) => `${v === NOT_LISTED ? "italic text-muted" : ""} ${differs ? "bg-primary-soft font-semibold" : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold">Bandingkan {list.length} produk</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={diffOnly} className={diffOnly ? "chip-on" : "chip-off"} onClick={() => setDiffOnly(!diffOnly)}>Hanya perbedaan</button>
          <span className="md:hidden">
            {(["cols", "list"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} className={`${view === v ? "chip-on" : "chip-off"} mr-2`} onClick={() => setView(v)}>{v === "cols" ? "Kolom" : "Daftar"}</button>)}
          </span>
          <button type="button" className="btn-ghost" onClick={clear}>Kosongkan</button>
        </div>
      </div>

      {/* Desktop: full table, attribute column sticky */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">Perbandingan spesifikasi</caption>
          <thead>
            <tr><th scope="col" className="sticky left-0 w-48 bg-surface p-3 text-left">Atribut</th>
              {list.map((p) => <th key={p.id} scope="col" className="p-3 text-left align-top"><Link to={`/produk/${p.slug}`} className="underline">{p.name}</Link><button type="button" onClick={() => toggle(p.id)} className="mt-1 block text-[12px] font-normal text-danger underline">Hapus</button></th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <th scope="row" className="sticky left-0 bg-surface p-3 text-left font-normal text-muted">{r.key}{r.differs ? <span className="ml-1 text-[11px] font-semibold text-primary-ink">· beda</span> : null}</th>
                {r.values.map((v, i) => <td key={i} className={`p-3 ${cell(v, r.differs)}`}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile (L3): first product pinned, others paged; or list view */}
      <div className="md:hidden">
        {view === "cols" ? (
          <>
            <div className="mb-2 flex items-center justify-between text-[13px] text-muted">
              <span>Kolom kiri disematkan</span>
              <span className="flex items-center gap-2">
                <button type="button" aria-label="Produk sebelumnya" disabled={pg <= 1} onClick={() => setPage(pg - 1)} className="h-10 w-10 rounded-ctl border border-line-strong">‹</button>
                <span aria-live="polite">{pg} / {pages}</span>
                <button type="button" aria-label="Produk berikutnya" disabled={pg >= pages} onClick={() => setPage(pg + 1)} className="h-10 w-10 rounded-ctl border border-line-strong">›</button>
              </span>
            </div>
            <table className="w-full table-fixed border-collapse text-[13px]">
              <thead><tr><th scope="col" className="bg-alt p-2 text-left align-top">{list[0]!.name}</th><th scope="col" className="p-2 text-left align-top">{list[pg]!.name}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.key}>
                    <tr><th scope="colgroup" colSpan={2} className="border-t border-line px-2 pt-2 text-left text-[11px] uppercase tracking-wide text-muted">{r.key}{r.differs ? " · beda" : ""}</th></tr>
                    <tr><td className={`bg-alt p-2 align-top ${cell(r.values[0]!, r.differs)}`}>{r.values[0]}</td><td className={`p-2 align-top ${cell(r.values[pg]!, r.differs)}`}>{r.values[pg]}</td></tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((p, i) => (
              <section key={p.id} className="card p-3" aria-labelledby={`cmp-${p.id}`}>
                <h2 id={`cmp-${p.id}`} className="font-body text-[15px] font-semibold">{p.name}</h2>
                <dl className="mt-2 grid grid-cols-[40%_60%] gap-x-2 gap-y-1 text-[13px]">
                  {rows.map((r) => <div key={r.key} className="contents"><dt className="text-muted">{r.key}</dt><dd className={cell(r.values[i]!, r.differs)}>{r.values[i]}</dd></div>)}
                </dl>
              </section>
            ))}
          </div>
        )}
      </div>
      <p className="text-[13px] text-muted">"Tidak dicantumkan" = data spesifikasi belum diisi penjual; bukan berarti fitur tidak ada. Rating belum ditampilkan di prototipe.</p>
    </div>
  );
}
