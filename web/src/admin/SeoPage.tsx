import { useCallback, useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog } from "../components/Dialog";
import { BRANDS } from "../config/brands";
import { seoCount, snippet } from "../domain/articles";
import type { BrandId } from "../domain/types";
import type { SeoKind, SeoRow } from "../services/contracts";
import { admin } from "../services/http/admin";
import { useShop } from "../store/shop";

const errorText = (error: unknown) => (error instanceof Error && error.message ? error.message : "Permintaan gagal.");
const input = "min-h-[44px] w-full rounded-ctl border border-line-strong bg-surface px-3";
const KIND_LABEL: Record<SeoKind, string> = { product: "Produk", category: "Kategori" };

/* ---------------- /admin/seo ---------------- */
export function AdminSeo() {
  const defaultStore = useShop((s) => s.brand);
  const notify = useShop((s) => s.notify);
  const [params, setParams] = useSearchParams();
  const store = (params.get("store") as BrandId | null) ?? defaultStore;
  const kind: SeoKind = params.get("kind") === "category" ? "category" : "product";
  const uid = useId();
  const [rows, setRows] = useState<SeoRow[] | null>(null);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<SeoRow | null>(null);

  const load = useCallback(() => {
    setError(undefined);
    setRows(null);
    admin.seoRows(store, kind).then(setRows).catch((e: unknown) => setError(errorText(e)));
  }, [store, kind]);
  useEffect(load, [load]);
  const reset = (row: SeoRow) => {
    admin.clearSeo(store, kind, row.key).then(() => { notify("Kembali ke teks otomatis"); load(); }).catch((e: unknown) => setError(errorText(e)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">SEO</h1>
          <p className="text-sm text-muted">Judul dan deskripsi yang dibaca mesin pencari. Tanpa teks khusus, toko memakai teks otomatis dari nama dan deskripsi.</p>
        </div>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Toko
          <select className={input} value={store} onChange={(e) => setParams({ store: e.target.value, kind })}>
            {Object.values(BRANDS).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      </div>

      <div role="tablist" aria-label="Jenis halaman" className="flex gap-2">
        {(["product", "category"] as SeoKind[]).map((k) => (
          <button key={k} type="button" role="tab" id={`${uid}-tab-${k}`} aria-selected={kind === k} aria-controls={`${uid}-panel`} className={kind === k ? "chip-on min-h-[44px]" : "chip-off min-h-[44px]"} onClick={() => setParams({ store, kind: k })}>{KIND_LABEL[k]}</button>
        ))}
      </div>

      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${kind}`}>
        {error ? (
          <div role="alert" className="card flex flex-col items-start gap-2 p-4">
            <p className="font-semibold text-danger">{error}</p>
            <button type="button" className="btn-secondary" onClick={load}>Muat ulang</button>
          </div>
        ) : !rows ? <p role="status" className="text-sm text-muted">Memuat…</p> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Teks SEO {KIND_LABEL[kind].toLowerCase()}</caption>
              <thead className="bg-alt text-left text-[13px]">
                <tr><th scope="col" className="p-3">{KIND_LABEL[kind]}</th><th scope="col" className="p-3">Judul dan deskripsi</th><th scope="col" className="p-3"><span className="sr-only">Aksi</span></th></tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const title = row.override?.seoTitle ?? row.auto.title;
                  const description = row.override?.metaDescription ?? row.auto.description;
                  return (
                    <tr key={row.key} className="border-t border-line align-top">
                      <th scope="row" className="p-3 text-left font-semibold">{row.name}</th>
                      <td className="max-w-[560px] p-3">
                        <span className="mb-1 inline-block rounded bg-alt px-2 py-0.5 text-[12px] font-semibold">{row.override ? "khusus" : "otomatis"}</span>
                        <p className="font-semibold">{title}</p>
                        <p className="text-muted">{description}</p>
                      </td>
                      <td className="whitespace-nowrap p-3 text-right">
                        <button type="button" className="btn-secondary min-h-[44px] px-3 text-[13px]" onClick={() => setEditing(row)}>Ubah<span className="sr-only"> {row.name}</span></button>
                        {row.override ? <button type="button" className="btn-ghost min-h-[44px] text-[13px]" onClick={() => reset(row)}>Kembalikan ke otomatis<span className="sr-only"> untuk {row.name}</span></button> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing ? (
        <SeoDialog
          row={editing}
          url={`${window.location.origin}${editing.path}`}
          onClose={() => setEditing(null)}
          onSave={async (seoTitle, metaDescription) => {
            await admin.setSeo(store, kind, editing.key, seoTitle, metaDescription);
            setEditing(null);
            notify("Teks SEO disimpan");
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function SeoDialog({ row, url, onClose, onSave }: { row: SeoRow; url: string; onClose: () => void; onSave: (seoTitle: string | null, metaDescription: string | null) => Promise<void> }) {
  const uid = useId();
  const [title, setTitle] = useState(row.override?.seoTitle ?? "");
  const [description, setDescription] = useState(row.override?.metaDescription ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const shownTitle = title.trim() || row.auto.title;
  const shownDescription = description.trim() || row.auto.description;
  const preview = snippet(shownTitle, url, shownDescription);
  const titleCount = seoCount(shownTitle, 60);
  const descriptionCount = seoCount(shownDescription, 160);

  const save = () => {
    setBusy(true);
    setError(undefined);
    onSave(title.trim() || null, description.trim() || null).catch((e: unknown) => { setBusy(false); setError(errorText(e)); });
  };

  return (
    <Dialog titleId={`${uid}-h`} onClose={() => { if (!busy) onClose(); }}>
      <h2 id={`${uid}-h`} className="text-xl font-semibold break-words">Teks SEO: {row.name}</h2>
      <p className="text-[13px] text-muted">Kosongkan kolom untuk memakai teks otomatis.</p>
      <label htmlFor={`${uid}-t`} className="flex items-baseline justify-between text-[13px] font-semibold">Judul SEO<span className={titleCount.over ? "font-semibold text-danger" : "font-normal text-muted"}>{titleCount.label}</span></label>
      <input id={`${uid}-t`} className={input} value={title} placeholder={row.auto.title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor={`${uid}-d`} className="flex items-baseline justify-between text-[13px] font-semibold">Deskripsi meta<span className={descriptionCount.over ? "font-semibold text-danger" : "font-normal text-muted"}>{descriptionCount.label}</span></label>
      <textarea id={`${uid}-d`} rows={3} className={`${input} py-2`} value={description} placeholder={row.auto.description} onChange={(e) => setDescription(e.target.value)} />
      <figure className="flex flex-col gap-0.5 rounded-ctl bg-alt p-3" aria-label="Pratinjau hasil pencarian">
        <span className="break-all text-[12px] text-muted">{preview.url}</span>
        <span className="text-[17px] font-semibold text-primary-ink">{preview.title}</span>
        <span className="text-[13px]">{preview.description}</span>
      </figure>
      {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" autoFocus className="btn-secondary" onClick={() => { if (!busy) onClose(); }}>Batal</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan"}</button>
      </div>
    </Dialog>
  );
}
