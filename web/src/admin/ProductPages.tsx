import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Dialog } from "../components/Dialog";
import { ProductPhoto } from "../components/ProductPhoto";
import { BRANDS } from "../config/brands";
import { ALT_MAX, altLength, applyOrder, canUpload, cleanAlt, moveId, nextAnnouncement, photoSizes, safeSourceLink, uploadPrecheck, withImageAdded, withImagePatched, withImageRemoved } from "../domain/photos";
import type { AdminImage, AdminProduct } from "../services/contracts";
import { admin } from "../services/http/admin";
import { useShop } from "../store/shop";
import { createSerialQueue } from "./serial-queue";

const MAX_PHOTOS = 6;
const ALT_RULE = "Teks alternatif wajib diisi (1–125 karakter).";
const errorText = (error: unknown) => (error instanceof Error && error.message ? error.message : "Permintaan gagal.");
const defaultAlt = (name: string) => [...`Foto ${name}`].slice(0, ALT_MAX).join("");
const input = "min-h-[44px] w-full rounded-ctl border border-line-strong bg-surface px-3";
const small = "btn-secondary min-h-[44px] px-3 text-[13px]";

function useProducts() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    setError(undefined);
    admin.listProducts().then(setProducts).catch((e: unknown) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);
  return { products, setProducts, error, load };
}

function LoadState({ error, retry }: { error?: string; retry: () => void }) {
  return error ? (
    <div role="alert" className="card flex flex-col items-start gap-2 p-4">
      <p className="font-semibold text-danger">{error}</p>
      <button type="button" className="btn-secondary" onClick={retry}>Muat ulang</button>
    </div>
  ) : <p role="status" className="text-sm text-muted">Memuat produk…</p>;
}

/* ---------------- /admin/products ---------------- */
export function AdminProducts() {
  const { products, error, load } = useProducts();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Produk</h1>
        <p className="text-sm text-muted">Foto produk untuk kedua toko. Foto pertama menjadi foto utama di katalog.</p>
      </div>
      {!products ? <LoadState error={error} retry={load} /> : (
        <ul className="card divide-y divide-line">
          {products.map((p) => {
            const samples = p.images.some((i) => i.source === "sample");
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="w-14 shrink-0"><ProductPhoto product={p} image={p.images[0]} sizes={photoSizes("accountRecommended")} decorative className="rounded" /></div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <b className="break-words">{p.name}</b>
                  <span className="text-[13px] text-muted">{BRANDS[p.brand].name} · {p.images.length}/{MAX_PHOTOS} foto{samples ? " · ada foto contoh" : ""}</span>
                </div>
                <Link to={`/admin/products/${encodeURIComponent(p.id)}`} className="btn-secondary min-h-[44px]">Kelola foto<span className="sr-only"> {p.name}</span></Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------- /admin/products/:id ---------------- */
/** `saving`: an alt save is pending (other actions queue behind it). `busy`: a move or delete is in flight (the row's buttons wait). */
type RowState = { draft: string; saving?: boolean; busy: boolean; error?: string; result?: "saved" | "failed" };
type Focus = { id: string; kind: "up" | "down" | "main" | "delete" } | { id: "file"; kind: "file" };

export function AdminProductPhotos() {
  const { id = "" } = useParams();
  const { products, setProducts, error, load } = useProducts();
  const product = products?.find((p) => p.id === id);
  const notify = useShop((s) => s.notify);
  const queue = useRef(createSerialQueue()).current;
  const uid = useId();

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [announce, setAnnounce] = useState("");
  const [confirm, setConfirm] = useState<AdminImage | null>(null);
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});
  const focusRefs = useRef(new Map<string, HTMLElement>());
  const [focus, setFocus] = useState<Focus | null>(null);
  const confirmRef = useRef<AdminImage | null>(null);
  confirmRef.current = confirm;
  // Stable: Dialog re-runs its focus handling whenever onClose changes. A cancelled delete returns focus to that row's "Hapus".
  const closeConfirm = useCallback(() => {
    const open = confirmRef.current;
    setConfirm(null);
    if (open) setFocus({ id: open.id, kind: "delete" });
  }, []);

  const images = product?.images ?? [];
  const row = (image: AdminImage): RowState => rows[image.id] ?? { draft: image.alt, busy: false };
  const patchRow = (imageId: string, patch: Partial<RowState>) =>
    setRows((all) => ({ ...all, [imageId]: { ...(all[imageId] ?? { draft: images.find((i) => i.id === imageId)?.alt ?? "", busy: false }), ...patch } }));
  // Async results always update the latest product, never a list captured when the request started.
  const latest = useRef<AdminProduct | undefined>(product);
  latest.current = product;
  const updateProduct = (change: (p: AdminProduct) => AdminProduct) =>
    setProducts((all) => all?.map((p) => (p.id === id ? change(p) : p)) ?? all);
  const say = (message: string) => setAnnounce((previous) => nextAnnouncement(previous, message));
  const ref = (key: string) => (el: HTMLElement | null) => { if (el) focusRefs.current.set(key, el); else focusRefs.current.delete(key); };

  useEffect(() => {
    if (!focus) return;
    focusRefs.current.get(`${focus.id}:${focus.kind}`)?.focus();
    setFocus(null);
  }, [focus, products]);

  // Closing the tab with an unsaved or failed alt text asks first.
  const dirty = images.some((img) => { const r = rows[img.id]; return !!r && (r.result === "failed" || cleanAlt(r.draft) !== img.alt); });
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  if (!products) return <LoadState error={error} retry={load} />;
  if (!product) return <div role="alert" className="card p-6"><h1 className="text-xl font-semibold">Produk tidak ditemukan</h1><Link to="/admin/products" className="underline">Kembali ke daftar produk</Link></div>;

  const total = images.length;
  const hasSamples = images.some((i) => i.source === "sample");

  const saveAlt = (image: AdminImage) => {
    const current = row(image);
    const clean = cleanAlt(current.draft);
    if (clean === image.alt) { patchRow(image.id, { draft: image.alt, error: undefined }); return; }
    const length = altLength(clean);
    if (length < 1 || length > ALT_MAX) { patchRow(image.id, { draft: image.alt, error: ALT_RULE, result: undefined }); return; }
    patchRow(image.id, { saving: true, error: undefined, result: undefined });
    void queue.enqueue(() => admin.changePhotoAlt(product.id, image.id, clean)).then((saved) => {
      updateProduct((p) => ({ ...p, images: withImagePatched(p.images, image.id, { alt: saved.alt }) }));
      patchRow(image.id, { saving: false, draft: saved.alt, result: "saved" });
    }).catch((e: unknown) => patchRow(image.id, { saving: false, result: "failed", error: errorText(e) }));
  };

  /** Queued behind any pending alt save; the new order is computed from the latest list when the request runs. */
  const reorder = (image: AdminImage, plan: (ids: string[]) => { ids: string[]; message: string } | null, focusKind: "up" | "down" | "main") => {
    if (row(image).busy) return;
    patchRow(image.id, { busy: true, error: undefined });
    let message = "";
    void queue.enqueue(async () => {
      const step = plan((latest.current?.images ?? []).map((i) => i.id));
      if (!step) return null;
      message = step.message;
      await admin.reorderPhotos(product.id, step.ids);
      return step.ids;
    }).then((ids) => {
      patchRow(image.id, { busy: false });
      if (!ids) return;
      updateProduct((p) => ({ ...p, images: applyOrder(p.images, ids) }));
      say(message);
      notify("Urutan foto disimpan");
      setFocus({ id: image.id, kind: focusKind });
    }).catch((e: unknown) => patchRow(image.id, { busy: false, error: errorText(e) }));
  };

  const move = (image: AdminImage, delta: -1 | 1) =>
    reorder(image, (ids) => {
      const index = ids.indexOf(image.id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= ids.length) return null;
      const n = index + 1;
      return { ids: moveId(ids, index, delta), message: `Foto ${n} dipindah ke urutan ${target + 1} dari ${ids.length}` };
    }, delta < 0 ? "up" : "down");

  const makeMain = (image: AdminImage) =>
    reorder(image, (ids) => (ids[0] === image.id || !ids.includes(image.id) ? null : { ids: [image.id, ...ids.filter((x) => x !== image.id)], message: "Foto dijadikan utama" }), "main");

  const remove = (image: AdminImage) => {
    patchRow(image.id, { busy: true, error: undefined });
    void queue.enqueue(() => admin.deletePhoto(product.id, image.id)).then(() => {
      const current = latest.current?.images ?? [];
      const index = current.findIndex((i) => i.id === image.id);
      const rest = current.filter((i) => i.id !== image.id);
      const next = rest[index] ?? rest[index - 1];
      setConfirm(null);
      updateProduct((p) => withImageRemoved(p, image.id));
      say(`Foto dihapus. ${rest.length} foto tersisa`);
      notify("Foto dihapus");
      setFocus(next ? { id: next.id, kind: "delete" } : { id: "file", kind: "file" });
    }).catch((e: unknown) => {
      setConfirm(null);
      patchRow(image.id, { busy: false, error: errorText(e) });
      setFocus({ id: image.id, kind: "delete" });
    });
  };

  const linkVariant = (sku: string, imageId: string | null) => {
    setVariantErrors((all) => ({ ...all, [sku]: "" }));
    void queue.enqueue(() => admin.linkVariantPhoto(sku, imageId)).then((saved) => {
      updateProduct((p) => ({ ...p, variants: p.variants.map((v) => (v.sku === sku ? { ...v, imageId: saved.imageId } : v)) }));
      notify("Foto varian disimpan");
    }).catch((e: unknown) => setVariantErrors((all) => ({ ...all, [sku]: errorText(e) })));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link to="/admin/products" className="self-start text-sm underline">Kembali ke daftar produk</Link>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="text-sm text-muted">{BRANDS[product.brand].name} · {total}/{MAX_PHOTOS} foto</p>
      </div>
      {hasSamples ? <p className="rounded-brand bg-[#FDF1DC] p-3 text-sm font-semibold text-warning">Foto contoh. Ganti dengan foto produk asli atau hapus sebelum toko diluncurkan.</p> : null}

      <UploadPanel key={product.id} product={product} full={total >= MAX_PHOTOS} fileRef={ref("file:file")} onUploaded={(image) => {
        updateProduct((p) => ({ ...p, images: withImageAdded(p.images, image) }));
        notify("Foto diunggah");
      }} />

      <section aria-labelledby={`${uid}-list`} className="card flex flex-col gap-3 p-4">
        <h2 id={`${uid}-list`} className="text-lg font-semibold">Foto ({total})</h2>
        {total === 0 ? <p className="text-sm text-muted">Belum ada foto. Foto pertama yang diunggah menjadi foto utama.</p> : (
          <ol className="flex flex-col divide-y divide-line">
            {images.map((image, index) => {
              const n = index + 1;
              const r = row(image);
              const base = `${uid}-${image.id}`;
              const source = safeSourceLink(image.sourceUrl);
              const first = index === 0;
              const last = index === total - 1;
              return (
                <li key={image.id} className="grid gap-3 py-3 sm:grid-cols-[64px_1fr]">
                  <div className="w-16 shrink-0"><ProductPhoto product={product} image={image} sizes="64px" decorative className="rounded" /></div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm font-semibold">Foto {n}{first ? " · foto utama" : ""}</p>
                    {image.source === "sample" ? (
                      <p className="text-[13px] text-muted">
                        Foto contoh · {image.licence ?? "lisensi tidak tercatat"}
                        {image.creator ? ` · ${image.creator}` : ""}
                        {" · "}
                        {source ? <a href={source} target="_blank" rel="noopener noreferrer" className="underline">Sumber</a> : <span>{image.sourceUrl ?? "sumber tidak tercatat"}</span>}
                      </p>
                    ) : null}
                    <label htmlFor={`${base}-alt`} className="text-[13px] font-semibold">Teks alternatif</label>
                    <input
                      id={`${base}-alt`}
                      value={r.draft}
                      aria-disabled={r.busy || r.saving || undefined}
                      readOnly={r.busy || r.saving}
                      aria-invalid={r.result === "failed" || !!r.error || undefined}
                      aria-describedby={`${base}-count ${base}-err`}
                      onChange={(e) => patchRow(image.id, { draft: e.target.value, result: undefined, error: undefined })}
                      onBlur={() => { if (!r.busy && !r.saving) saveAlt(image); }}
                      className={input}
                    />
                    <div className="flex flex-wrap items-center gap-3 text-[13px]">
                      <span id={`${base}-count`} className="text-muted">{altLength(cleanAlt(r.draft))}/125 karakter</span>
                      <span role="status" aria-live="polite" className="flex items-center gap-2">
                        {r.result === "saved" ? <span className="text-success">Tersimpan</span> : null}
                        {r.result === "failed" ? <><span className="text-danger">Gagal menyimpan. Coba lagi.</span><button type="button" className="btn-ghost min-h-[44px]" onClick={() => saveAlt(image)}>Coba lagi</button></> : null}
                      </span>
                    </div>
                    <p id={`${base}-err`} role="alert" className="text-[13px] font-semibold text-danger">{r.error ?? ""}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" ref={ref(`${image.id}:up`)} className={small} aria-label={`Naikkan foto ${n}`} aria-disabled={first || r.busy || undefined} onClick={() => { if (!first) move(image, -1); }}>↑</button>
                      <button type="button" ref={ref(`${image.id}:down`)} className={small} aria-label={`Turunkan foto ${n}`} aria-disabled={last || r.busy || undefined} onClick={() => { if (!last) move(image, 1); }}>↓</button>
                      <button type="button" ref={ref(`${image.id}:main`)} className={small} aria-label={first ? "Foto utama" : `Jadikan foto ${n} sebagai foto utama`} aria-disabled={first || r.busy || undefined} onClick={() => { if (!first) makeMain(image); }}>{first ? "Foto utama" : "Jadikan utama"}</button>
                      <button type="button" ref={ref(`${image.id}:delete`)} className={`${small} text-danger`} aria-label={`Hapus foto ${n}`} aria-disabled={r.busy || undefined} onClick={() => { if (!r.busy) setConfirm(image); }}>Hapus</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {product.variants.length > 1 ? (
        <section aria-labelledby={`${uid}-var`} className="card flex flex-col gap-3 p-4">
          <h2 id={`${uid}-var`} className="text-lg font-semibold">Foto per varian</h2>
          <p className="text-[13px] text-muted">Saat pembeli memilih varian ini, foto yang dipilih ditampilkan. Tanpa pilihan, foto utama yang tampil.</p>
          {product.variants.map((v) => {
            const sel = `${uid}-v-${v.sku}`;
            const err = variantErrors[v.sku];
            return (
              <div key={v.sku} className="flex flex-col gap-1">
                <label htmlFor={sel} className="text-[13px] font-semibold">{v.label || v.sku}</label>
                <select id={sel} value={v.imageId ?? ""} aria-describedby={`${sel}-err`} aria-invalid={!!err || undefined} onChange={(e) => linkVariant(v.sku, e.target.value || null)} className={input}>
                  <option value="">Foto utama (tanpa foto khusus)</option>
                  {images.map((img, i) => <option key={img.id} value={img.id}>Foto {i + 1}: {img.alt}</option>)}
                </select>
                <p id={`${sel}-err`} role="alert" className="text-[13px] font-semibold text-danger">{err ?? ""}</p>
              </div>
            );
          })}
        </section>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>

      {confirm ? (() => {
        const index = images.findIndex((i) => i.id === confirm.id);
        const n = index + 1;
        const busy = row(confirm).busy;
        return (
          <Dialog titleId={`${uid}-dlg`} onClose={closeConfirm}>
            <h2 id={`${uid}-dlg`} className="text-xl font-semibold break-words">{`Hapus foto ${n} dari ${total}: ${confirm.alt}?`}</h2>
            <p className="text-sm">Foto hilang dari toko setelah katalog dimuat ulang (sekitar 1 menit). Pengunjung yang sudah membukanya dapat masih melihatnya dari cache peramban.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" autoFocus className="btn-secondary" onClick={() => { if (!busy) closeConfirm(); }} aria-disabled={busy || undefined}>Batal</button>
              <button type="button" className="btn-primary bg-danger hover:bg-danger" aria-disabled={busy || undefined} onClick={() => { if (!busy) remove(confirm); }}>{busy ? "Menghapus…" : "Hapus foto"}</button>
            </div>
          </Dialog>
        );
      })() : null}
    </div>
  );
}

/* ---------------- Upload ---------------- */
function UploadPanel({ product, full, fileRef, onUploaded }: { product: AdminProduct; full: boolean; fileRef: (el: HTMLElement | null) => void; onUploaded: (image: AdminImage) => void }) {
  const uid = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState(() => defaultAlt(product.name));
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);

  const choose = (picked: File | null) => {
    setError(undefined);
    setFile(picked);
    if (picked) setError(uploadPrecheck(picked) ?? undefined);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    if (e.dataTransfer.files.length !== 1) { setError("Unggah satu foto per kali."); return; }
    choose(e.dataTransfer.files[0] ?? null);
  };
  const cleanedAlt = cleanAlt(alt);
  const altOk = altLength(cleanedAlt) >= 1 && altLength(cleanedAlt) <= ALT_MAX;
  const precheck = file ? uploadPrecheck(file) : null;
  const ready = canUpload(file, rights, busy) && altOk && !precheck;

  const submit = () => {
    if (!file) return;
    if (!altOk) { setError(ALT_RULE); return; }
    if (!ready) return;
    setBusy(true);
    setError(undefined);
    admin.uploadPhoto(product.id, file, cleanedAlt, rights).then((image) => {
      onUploaded(image);
      setFile(null);
      setRights(false);
      setAlt(defaultAlt(product.name));
      if (picker.current) picker.current.value = "";
    }).catch((e: unknown) => setError(errorText(e))).finally(() => setBusy(false));
  };

  return (
    <section aria-labelledby={`${uid}-h`} className="card flex flex-col gap-3 p-4">
      <h2 id={`${uid}-h`} className="text-lg font-semibold">Tambah foto</h2>
      {full ? <p className="text-sm">Sudah 6 foto. Hapus satu untuk menambah.</p> : (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col gap-2 rounded-brand border-2 border-dashed p-4 ${dragging ? "border-primary bg-primary-soft" : "border-line-strong"}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" ref={fileRef} className="btn-secondary" aria-disabled={busy || undefined} aria-describedby={`${uid}-rules`} onClick={() => { if (!busy) picker.current?.click(); }}>Pilih file</button>
              <span className="min-w-0 break-words text-sm">{file ? file.name : "atau seret satu foto ke sini"}</span>
            </div>
            <input ref={picker} id={`${uid}-file`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
            <p id={`${uid}-rules`} className="text-[13px] text-muted">JPG, PNG, WebP · maks. 10 MB · min. 480 px</p>
          </div>
          <p className="text-[13px]">Jangan unggah foto yang memuat orang yang dapat dikenali atau yang lisensinya tidak jelas. Foto yang sudah dihapus masih dapat diakses lewat tautannya selama file-nya belum terhapus dan dapat tersimpan di cache peramban hingga 1 tahun.</p>
          <label htmlFor={`${uid}-alt`} className="text-[13px] font-semibold">Teks alternatif</label>
          <input id={`${uid}-alt`} value={alt} onChange={(e) => setAlt(e.target.value)} aria-describedby={`${uid}-count`} aria-invalid={!altOk || undefined} className={input} />
          <span id={`${uid}-count`} className="text-[13px] text-muted">{altLength(cleanedAlt)}/125 karakter · jelaskan apa yang terlihat di foto</span>
          <label className="flex min-h-[44px] items-start gap-2 text-sm">
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" required />
            <span>Saya memiliki hak atau izin untuk memakai foto ini di toko.</span>
          </label>
          <p className="text-[13px] text-muted">Simpan file foto asli Anda. Toko hanya menyimpan salinan yang sudah diperkecil.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={!ready} onClick={submit}>Unggah foto</button>
            <span role="status" aria-live="polite" className="text-sm text-muted">{busy ? "Mengunggah…" : ""}</span>
          </div>
          <p role="alert" className="text-[13px] font-semibold text-danger">{error ?? ""}</p>
        </>
      )}
    </section>
  );
}
