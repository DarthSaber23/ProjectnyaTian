import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ARTICLE_SIZES, ArticleCover } from "../components/ArticleCard";
import { Dialog } from "../components/Dialog";
import { BRANDS } from "../config/brands";
import { articleUrl, seoCount, snippet } from "../domain/articles";
import { renderMarkdown } from "../domain/markdown";
import { ALT_MAX, canUpload, cleanAlt, moveId, uploadPrecheck } from "../domain/photos";
import { formatWib } from "../domain/time";
import type { BrandId } from "../domain/types";
import type { AdminProduct, ArticleTextInput, ArticleView, Lang } from "../services/contracts";
import { admin } from "../services/http/admin";
import { useShop } from "../store/shop";
import { appendImage, type Drafts, emptyText, isStale, languagesLabel, mergeMeta, settleAfterSave, slugWillRedirect, STALE_MESSAGE, statusLabel, wibToIso, withTitle } from "./article-editor";
import { createSerialQueue } from "./serial-queue";

const MAX_PRODUCTS = 6;
const RIGHTS = "Saya memiliki hak atau izin untuk memakai foto ini di toko.";
const errorText = (error: unknown) => (error instanceof Error && error.message ? error.message : "Permintaan gagal.");
const input = "min-h-[44px] w-full rounded-ctl border border-line-strong bg-surface px-3";
const small = "btn-secondary min-h-[44px] px-3 text-[13px]";
const LANG_NAME: Record<Lang, string> = { id: "Bahasa Indonesia", en: "English" };

/* ---------------- /admin/blog ---------------- */
export function AdminBlogList() {
  const defaultStore = useShop((s) => s.brand);
  const [params, setParams] = useSearchParams();
  const store = (params.get("store") as BrandId | null) ?? defaultStore;
  const [articles, setArticles] = useState<ArticleView[] | null>(null);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setError(undefined);
    setArticles(null);
    admin.listArticles(store).then((list) => { if (live) setArticles(list); }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [store, attempt]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Blog</h1>
          <p className="text-sm text-muted">Artikel toko di /blog. Perubahan langsung tampil di toko dan tercatat di log audit.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Toko
            <select className={input} value={store} onChange={(e) => setParams({ store: e.target.value })}>
              {Object.values(BRANDS).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <Link to={`/admin/blog/new?store=${store}`} className="btn-primary">Tulis artikel</Link>
        </div>
      </div>
      {error ? (
        <div role="alert" className="card flex flex-col items-start gap-2 p-4">
          <p className="font-semibold text-danger">{error}</p>
          <button type="button" className="btn-secondary" onClick={() => setAttempt((n) => n + 1)}>Muat ulang</button>
        </div>
      ) : !articles ? <p role="status" className="text-sm text-muted">Memuat artikel…</p> : articles.length === 0 ? (
        <p className="card p-4 text-muted">Belum ada artikel.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {articles.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="w-24 shrink-0"><ArticleCover image={a.cover} sizes="96px" decorative className="rounded" /></div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="break-words">{a.texts.id?.title || "(tanpa judul)"}</b>
                <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  <span className="font-semibold text-ink">{statusLabel(a)}</span>
                  <span>{languagesLabel(a)}</span>
                  {a.sample ? <span className="rounded bg-alt px-2 py-0.5 text-[12px] font-semibold text-ink">Contoh</span> : null}
                  <span>Diubah {formatWib(a.updatedAt)} · ditulis {a.authorName}</span>
                </span>
              </div>
              <Link to={`/admin/blog/${encodeURIComponent(a.id)}`} className="btn-secondary min-h-[44px]">Ubah<span className="sr-only"> {a.texts.id?.title}</span></Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- /admin/blog/new and /admin/blog/:id ---------------- */
type Confirm = "delete" | "unpublish" | null;

const draftsOf = (view: ArticleView | null): Drafts => ({ id: view?.texts.id ?? emptyText(), en: view?.texts.en ?? null });
const snapshot = (drafts: Drafts, productIds: string[]) => JSON.stringify({ drafts, productIds });

export function AdminArticleEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const defaultStore = useShop((s) => s.brand);
  const notify = useShop((s) => s.notify);
  const navigate = useNavigate();
  const queue = useRef(createSerialQueue()).current;
  // The newest ArticleView the server confirmed (also a draft created by a save whose follow-up failed, so the retry
  // saves into it). Queued jobs read it when they run, so they never send the version captured at click time.
  const latestView = useRef<ArticleView | null>(null);
  const latest = useRef({ drafts: draftsOf(null), productIds: [] as string[], saved: "" });
  const uid = useId();

  const [view, setView] = useState<ArticleView | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [drafts, setDrafts] = useState<Drafts>(draftsOf(null));
  const [productIds, setProductIds] = useState<string[]>([]);
  const [saved, setSaved] = useState(snapshot(draftsOf(null), []));
  const [slugEdited, setSlugEdited] = useState<Record<Lang, boolean>>({ id: false, en: false });
  const [tab, setTab] = useState<Lang>("id");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [catalogue, setCatalogue] = useState<AdminProduct[]>([]);

  const store: BrandId = view?.store ?? (params.get("store") as BrandId | null) ?? defaultStore;

  const adopt = useCallback((next: ArticleView) => {
    const d = draftsOf(next);
    latestView.current = next;
    setView(next);
    setDrafts(d);
    setProductIds(next.productIds);
    setSaved(snapshot(d, next.productIds));
    setSlugEdited({ id: true, en: true });
    setStale(false);
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    setLoadError(undefined);
    setError(undefined);
    setStale(false);
    admin.getArticle(id).then(adopt).catch((e: unknown) => setLoadError(errorText(e)));
  }, [id, adopt]);
  useEffect(load, [load]);
  useEffect(() => { admin.listProducts().then(setCatalogue).catch(() => setCatalogue([])); }, []);

  const dirty = snapshot(drafts, productIds) !== saved;
  latest.current = { drafts, productIds, saved };
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  if (id && !view) {
    return loadError ? (
      <div role="alert" className="card flex flex-col items-start gap-2 p-4">
        <p className="font-semibold text-danger">{loadError}</p>
        <div className="flex gap-2"><button type="button" className="btn-secondary" onClick={load}>Muat ulang</button><Link to="/admin/blog" className="btn-ghost">Kembali ke daftar artikel</Link></div>
      </div>
    ) : <p role="status" className="text-sm text-muted">Memuat artikel…</p>;
  }

  const fail = (e: unknown) => {
    setBusy(false);
    setStale(isStale(e));
    setError(isStale(e) ? STALE_MESSAGE : errorText(e));
  };

  /** What a job hands back: the server's view, and the text snapshot it holds (null when no text was saved). */
  type Outcome = { view: ArticleView; sent: string | null };

  /** Saves the typed text as it is when the job runs (creating the draft first for a new article). */
  const persist = async (): Promise<Outcome> => {
    const { drafts: d, productIds: ids, saved: baseline } = latest.current;
    const sent = snapshot(d, ids);
    let current = latestView.current;
    if (!current) {
      current = await admin.createArticle(store, d.id);
      latestView.current = current;
      if (!d.en && ids.length === 0) return { view: current, sent };
    } else if (sent === baseline) return { view: current, sent };
    const texts: { id: ArticleTextInput; en?: ArticleTextInput | null } = { id: d.id };
    if (d.en) texts.en = d.en; else if (current.texts.en) texts.en = null;
    const next = await admin.saveArticle(current.id, { version: current.version, texts, tags: current.tags, productIds: ids });
    latestView.current = next;
    return { view: next, sent };
  };

  /** Runs a request with the version known at that moment (after earlier queued jobs finished). */
  const withLatest = async (sent: string | null, call: (v: ArticleView) => Promise<ArticleView>): Promise<Outcome> => {
    const next = await call(latestView.current!);
    latestView.current = next;
    return { view: next, sent };
  };

  const run = (job: () => Promise<Outcome | null>, done: string) => {
    setBusy(true);
    setError(undefined);
    const wasNew = !view;
    void queue.enqueue(job).then((out) => {
      setBusy(false);
      if (!out) return;
      const { drafts: d, productIds: ids } = latest.current;
      if (out.sent !== null && settleAfterSave(out.sent, snapshot(d, ids)) === "adopt") adopt(out.view);
      else {
        // Text typed meanwhile (or never part of this request) stays as typed and stays unsaved.
        setView((v) => (out.sent !== null ? out.view : mergeMeta(v, out.view)));
        if (out.sent !== null) setSaved(out.sent);
        setStale(false);
      }
      notify(done);
      if (wasNew) navigate(`/admin/blog/${encodeURIComponent(out.view.id)}`, { replace: true });
    }).catch(fail);
  };

  const saveDraft = () => run(persist, "Draf disimpan");
  const publish = () => run(async () => { const o = await persist(); return withLatest(o.sent, (v) => admin.publishArticle(v.id, v.version)); }, "Artikel diterbitkan");
  const schedule = () => {
    const at = wibToIso(scheduleAt);
    if (!at || Date.parse(at) <= Date.now()) { setError("Waktu terbit harus di masa depan."); return; }
    run(async () => { const o = await persist(); return withLatest(o.sent, (v) => admin.publishArticle(v.id, v.version, at)); }, `Artikel dijadwalkan ${formatWib(at)}`);
  };
  const unpublish = () => {
    if (!view) return;
    setConfirm(null);
    run(() => withLatest(null, (v) => admin.unpublishArticle(v.id, v.version)), "Artikel tidak diterbitkan lagi");
  };
  const remove = () => {
    if (!view) return;
    setBusy(true);
    void queue.enqueue(() => admin.deleteArticle(view.id)).then(() => {
      setConfirm(null);
      setSaved(snapshot(drafts, productIds));
      notify("Artikel dihapus");
      navigate(`/admin/blog?store=${view.store}`);
    }).catch((e: unknown) => { setConfirm(null); fail(e); });
  };

  const text = tab === "en" ? drafts.en : drafts.id;
  const setText = (lang: Lang, next: ArticleTextInput) => setDrafts((d) => ({ ...d, [lang]: next }));
  const canDelete = view && view.status !== "published";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to={`/admin/blog?store=${store}`} className="text-sm underline">Kembali ke daftar artikel</Link>
          <h1 className="text-2xl font-semibold break-words">{view ? drafts.id.title || "(tanpa judul)" : "Artikel baru"}</h1>
          <p className="text-sm text-muted">{BRANDS[store].name}{view ? ` · ${statusLabel(view)} · versi ${view.version}` : " · belum disimpan"}{dirty ? " · ada perubahan belum disimpan" : ""}</p>
        </div>
      </div>

      {error ? (
        <div role="alert" className="card flex flex-col items-start gap-2 border-danger p-4">
          <p className="font-semibold text-danger">{error}</p>
          {stale ? (
            <>
              <p className="text-sm">Teks yang Anda ketik masih ada di bawah. Salin dulu bila perlu, lalu muat ulang untuk melihat versi terbaru.</p>
              <button type="button" className="btn-secondary" onClick={load}>Muat ulang</button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Teks artikel" className="card flex min-w-0 flex-col gap-4 p-4">
          <div role="tablist" aria-label="Bahasa" className="flex gap-2">
            {(["id", "en"] as Lang[]).map((lang) => (
              <button key={lang} type="button" role="tab" id={`${uid}-tab-${lang}`} aria-selected={tab === lang} aria-controls={`${uid}-panel`} className={tab === lang ? "chip-on min-h-[44px]" : "chip-off min-h-[44px]"} onClick={() => setTab(lang)}>
                {LANG_NAME[lang]}{lang === "en" && !drafts.en ? " (belum ada)" : ""}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`} className="flex flex-col gap-4">
            {text ? (
              <TextFields
                key={tab}
                lang={tab}
                text={text}
                view={view}
                slugEdited={slugEdited[tab]}
                onChange={(next) => setText(tab, next)}
                onSlugEdited={() => setSlugEdited((s) => ({ ...s, [tab]: true }))}
                bodyTools={view ? <BodyImage articleId={view.id} lang={tab} queue={queue} onInsert={(lang, alt, src) => setDrafts((d) => appendImage(d, lang, alt, src))} /> : <p className="text-[13px] text-muted">Simpan draf dulu untuk menyisipkan gambar.</p>}
              />
            ) : (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-muted">Versi English bersifat opsional dan tampil di /en/blog.</p>
                <button type="button" className="btn-secondary" onClick={() => { setDrafts((d) => ({ ...d, en: emptyText() })); setSlugEdited((s) => ({ ...s, en: false })); }}>Tambah versi English</button>
              </div>
            )}
            {tab === "en" && drafts.en ? (
              <div className="flex flex-col items-start gap-1 border-t border-line pt-3">
                <button type="button" className={small} onClick={() => setDrafts((d) => ({ ...d, en: null }))}>Hapus versi English</button>
                <p className="text-[13px] text-muted">Dihapus saat disimpan; alamat /en/blog artikel ini tidak bisa dibuka lagi.</p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby={`${uid}-act`} className="card flex flex-col gap-3 p-4">
            <h2 id={`${uid}-act`} className="text-lg font-semibold">Terbitkan</h2>
            <button type="button" className="btn-secondary" disabled={busy} onClick={saveDraft}>{busy ? "Menyimpan…" : view?.live ? "Simpan perubahan" : "Simpan draf"}</button>
            {!view?.live ? (
              <>
                <button type="button" className="btn-primary" disabled={busy} onClick={publish}>Terbitkan</button>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-at`} className="text-[13px] font-semibold">Jadwal terbit (WIB)</label>
                  <div className="flex gap-2">
                    <input id={`${uid}-at`} type="datetime-local" className={input} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                    <button type="button" className={small} disabled={busy || !scheduleAt} onClick={schedule}>Jadwalkan</button>
                  </div>
                </div>
              </>
            ) : null}
            {view?.status === "published" ? <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirm("unpublish")}>Batalkan terbit</button> : null}
            {canDelete ? <button type="button" className="btn-ghost text-danger" disabled={busy} onClick={() => setConfirm("delete")}>Hapus artikel</button> : null}
            {view?.live ? <a href={articleUrl("id", view.texts.id?.slug ?? "")} target="_blank" rel="noreferrer" className="text-sm underline">Lihat di toko</a> : null}
          </section>

          {view ? <CoverPanel view={view} queue={queue} onSaved={(next) => { latestView.current = mergeMeta(latestView.current, next); setView((v) => mergeMeta(v, next)); }} /> : (
            <p className="card p-4 text-[13px] text-muted">Simpan draf dulu untuk menambah sampul.</p>
          )}

          <ProductPicker store={store} catalogue={catalogue} ids={productIds} onChange={setProductIds} />
        </div>
      </div>

      {confirm ? (
        <Dialog titleId={`${uid}-dlg`} onClose={() => { if (!busy) setConfirm(null); }}>
          <h2 id={`${uid}-dlg`} className="text-xl font-semibold">{confirm === "delete" ? "Hapus artikel ini?" : "Batalkan terbit artikel ini?"}</h2>
          <p className="text-sm">{confirm === "delete" ? "Artikel, teks dan gambarnya dihapus. Tindakan ini tercatat di log audit dan tidak bisa dibatalkan." : "Artikel hilang dari toko dan alamatnya tidak bisa dibuka sampai diterbitkan lagi."}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus className="btn-secondary" onClick={() => { if (!busy) setConfirm(null); }}>Batal</button>
            <button type="button" className="btn-primary bg-danger hover:bg-danger" aria-disabled={busy || undefined} onClick={() => { if (!busy) (confirm === "delete" ? remove() : unpublish()); }}>
              {confirm === "delete" ? (busy ? "Menghapus…" : "Hapus artikel") : "Batalkan terbit"}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function Counter({ id, value, max }: { id: string; value: string; max: number }) {
  const c = seoCount(value, max);
  return <span id={id} className={`text-[12px] ${c.over ? "font-semibold text-danger" : "text-muted"}`}>{c.label}{c.over ? " (terlalu panjang)" : ""}</span>;
}

function TextFields({ lang, text, view, slugEdited, onChange, onSlugEdited, bodyTools }: {
  lang: Lang;
  text: ArticleTextInput;
  view: ArticleView | null;
  slugEdited: boolean;
  onChange: (next: ArticleTextInput) => void;
  onSlugEdited: () => void;
  bodyTools: ReactNode;
}) {
  const uid = useId();
  const [mode, setMode] = useState<"write" | "preview">("write");
  const url = `${window.location.origin}${articleUrl(lang, text.slug || "…")}`;
  const preview = snippet(text.seoTitle || text.title, url, text.metaDescription);
  const set = (patch: Partial<ArticleTextInput>) => onChange({ ...text, ...patch });
  const field = (label: string, key: string, control: ReactNode, hint?: ReactNode) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${uid}-${key}`} className="flex items-baseline justify-between gap-2 text-[13px] font-semibold">{label}{hint}</label>
      {control}
    </div>
  );

  return (
    <>
      {field("Judul", "title", <input id={`${uid}-title`} className={input} value={text.title} onChange={(e) => onChange(withTitle(text, e.target.value, slugEdited))} />)}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-slug`} className="text-[13px] font-semibold">Slug</label>
        <input id={`${uid}-slug`} className={input} value={text.slug} aria-describedby={`${uid}-slug-url`} onChange={(e) => { onSlugEdited(); set({ slug: e.target.value }); }} />
        <span id={`${uid}-slug-url`} className="break-all text-[12px] text-muted">{url}</span>
        {view && slugWillRedirect(view, lang, text.slug) ? <p className="text-[13px] font-semibold text-warning">URL lama akan dialihkan ke URL baru.</p> : null}
      </div>
      {field("Judul SEO", "seo", <input id={`${uid}-seo`} className={input} value={text.seoTitle ?? ""} aria-describedby={`${uid}-seo-n`} onChange={(e) => set({ seoTitle: e.target.value || null })} />, <Counter id={`${uid}-seo-n`} value={text.seoTitle || text.title} max={60} />)}
      {field("Deskripsi meta", "meta", <textarea id={`${uid}-meta`} rows={3} className={`${input} py-2`} value={text.metaDescription} aria-describedby={`${uid}-meta-n`} onChange={(e) => set({ metaDescription: e.target.value })} />, <Counter id={`${uid}-meta-n`} value={text.metaDescription} max={160} />)}
      <figure className="flex flex-col gap-0.5 rounded-ctl bg-alt p-3" aria-label="Pratinjau hasil pencarian">
        <span className="break-all text-[12px] text-muted">{preview.url}</span>
        <span className="text-[17px] font-semibold text-primary-ink">{preview.title || "Judul artikel"}</span>
        <span className="text-[13px]">{preview.description || "Deskripsi meta tampil di sini."}</span>
      </figure>
      {field("Ringkasan", "summary", <textarea id={`${uid}-summary`} rows={3} className={`${input} py-2`} value={text.summary} aria-describedby={`${uid}-summary-n`} onChange={(e) => set({ summary: e.target.value })} />, <Counter id={`${uid}-summary-n`} value={text.summary} max={200} />)}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span id={`${uid}-body-l`} className="text-[13px] font-semibold">Isi</span>
          <div role="tablist" aria-labelledby={`${uid}-body-l`} className="flex gap-2">
            <button type="button" role="tab" id={`${uid}-tab-write`} aria-selected={mode === "write"} aria-controls={`${uid}-body-panel`} className={mode === "write" ? "chip-on min-h-[44px]" : "chip-off min-h-[44px]"} onClick={() => setMode("write")}>Tulis</button>
            <button type="button" role="tab" id={`${uid}-tab-preview`} aria-selected={mode === "preview"} aria-controls={`${uid}-body-panel`} className={mode === "preview" ? "chip-on min-h-[44px]" : "chip-off min-h-[44px]"} onClick={() => setMode("preview")}>Pratinjau</button>
          </div>
        </div>
        <div role="tabpanel" id={`${uid}-body-panel`} aria-labelledby={`${uid}-tab-${mode}`} className="flex flex-col gap-2">
        {mode === "write" ? (
          <>
            <textarea aria-labelledby={`${uid}-body-l`} aria-describedby={`${uid}-body-h`} rows={16} className={`${input} py-2 font-body leading-relaxed`} value={text.body} onChange={(e) => set({ body: e.target.value })} />
            <p id={`${uid}-body-h`} className="text-[12px] text-muted">Markdown: ## subjudul, ### sub-subjudul, - daftar, 1. daftar bernomor, **tebal**, *miring*, [teks](https://…).</p>
            {bodyTools}
          </>
        ) : (
          <div className="article-body rounded-ctl border border-line p-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(text.body) }} />
        )}
        </div>
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={text.noindex} onChange={(e) => set({ noindex: e.target.checked })} />
        Jangan tampilkan di mesin pencari
      </label>
      <details className="text-sm">
        <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Lanjutan</summary>
        {field("Canonical", "canonical", <input id={`${uid}-canonical`} type="url" inputMode="url" placeholder="https://" className={input} value={text.canonicalUrl ?? ""} onChange={(e) => set({ canonicalUrl: e.target.value || null })} />)}
        <p className="mt-1 text-[12px] text-muted">Isi hanya bila artikel ini salinan dari halaman lain. Kosongkan untuk memakai alamat artikel ini.</p>
      </details>
    </>
  );
}

type Queue = ReturnType<typeof createSerialQueue>;

function UploadFields({ uid, file, setFile, rights, setRights, alt, setAlt }: {
  uid: string; file: File | null; setFile: (f: File | null) => void; rights: boolean; setRights: (v: boolean) => void; alt: string; setAlt: (v: string) => void;
}) {
  const precheck = file ? uploadPrecheck(file) : null;
  return (
    <>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        File foto (JPG, PNG atau WebP, maks. 10 MB)
        <input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm font-normal" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {precheck ? <p role="alert" className="text-[13px] font-semibold text-danger">{precheck}</p> : null}
      <label htmlFor={`${uid}-alt`} className="flex items-baseline justify-between text-[13px] font-semibold">Teks alternatif<span className="font-normal text-muted">{[...alt].length}/{ALT_MAX}</span></label>
      <input id={`${uid}-alt`} className={input} value={alt} maxLength={ALT_MAX * 2} onChange={(e) => setAlt(e.target.value)} />
      <label className="flex items-start gap-2 text-[13px]">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
        {RIGHTS}
      </label>
    </>
  );
}

function CoverPanel({ view, queue, onSaved }: { view: ArticleView; queue: Queue; onSaved: (next: ArticleView) => void }) {
  const uid = useId();
  const notify = useShop((s) => s.notify);
  const [open, setOpen] = useState(!view.cover);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const clean = cleanAlt(alt);
  const altOk = [...clean].length >= 1 && [...clean].length <= ALT_MAX;
  const ready = canUpload(file, rights, busy) && altOk && !(file && uploadPrecheck(file));

  const upload = () => {
    if (!file || !ready) return;
    setBusy(true);
    setError(undefined);
    void queue.enqueue(() => admin.uploadArticleCover(view.id, file, clean, rights)).then((next) => {
      setBusy(false); setFile(null); setAlt(""); setRights(false); setOpen(false);
      onSaved(next);
      notify("Sampul disimpan");
    }).catch((e: unknown) => { setBusy(false); setError(errorText(e)); });
  };
  const removeCover = () => {
    setBusy(true);
    void queue.enqueue(() => admin.removeArticleCover(view.id)).then((next) => { setBusy(false); setOpen(true); onSaved(next); notify("Sampul dihapus"); })
      .catch((e: unknown) => { setBusy(false); setError(errorText(e)); });
  };

  return (
    <section aria-labelledby={`${uid}-h`} className="card flex flex-col gap-3 p-4">
      <h2 id={`${uid}-h`} className="text-lg font-semibold">Sampul</h2>
      {view.cover ? (
        <>
          <ArticleCover image={view.cover} sizes={ARTICLE_SIZES.featured} className="rounded" />
          <p className="text-[13px] text-muted break-words">Teks alternatif: {view.cover.alt}</p>
          <div className="flex gap-2">
            <button type="button" className={small} disabled={busy} onClick={() => setOpen((o) => !o)} aria-expanded={open}>Ganti</button>
            <button type="button" className={small} disabled={busy} onClick={removeCover}>Hapus</button>
          </div>
        </>
      ) : <p className="text-[13px] text-muted">Belum ada sampul. Tanpa sampul, kartu artikel memakai warna toko.</p>}
      {open ? (
        <div className="flex flex-col gap-2">
          <UploadFields uid={uid} file={file} setFile={setFile} rights={rights} setRights={setRights} alt={alt} setAlt={setAlt} />
          <button type="button" className="btn-primary" disabled={!ready} onClick={upload}>{busy ? "Mengunggah…" : "Unggah sampul"}</button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
    </section>
  );
}

function BodyImage({ articleId, lang, queue, onInsert }: { articleId: string; lang: Lang; queue: Queue; onInsert: (lang: Lang, alt: string, src: string) => void }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const clean = cleanAlt(alt);
  const ready = canUpload(file, rights, busy) && [...clean].length >= 1 && [...clean].length <= ALT_MAX && !(file && uploadPrecheck(file));

  const upload = () => {
    if (!file || !ready) return;
    const startedIn = lang;
    setBusy(true);
    setError(undefined);
    void queue.enqueue(() => admin.uploadArticleImage(articleId, file, rights)).then((image) => {
      onInsert(startedIn, clean, image.src);
      setBusy(false); setFile(null); setAlt(""); setRights(false); setOpen(false);
    }).catch((e: unknown) => { setBusy(false); setError(errorText(e)); });
  };

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={`${small} self-start`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>Sisipkan gambar</button>
      {open ? (
        <div className="flex flex-col gap-2 rounded-ctl bg-alt p-3">
          <UploadFields uid={uid} file={file} setFile={setFile} rights={rights} setRights={setRights} alt={alt} setAlt={setAlt} />
          <p className="text-[12px] text-muted">Gambar ditambahkan di akhir isi; pindahkan barisnya bila perlu.</p>
          <button type="button" className="btn-primary self-start" disabled={!ready} onClick={upload}>{busy ? "Mengunggah…" : "Unggah dan sisipkan"}</button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

function ProductPicker({ store, catalogue, ids, onChange }: { store: BrandId; catalogue: AdminProduct[]; ids: string[]; onChange: (ids: string[]) => void }) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const own = useMemo(() => catalogue.filter((p) => p.brand === store), [catalogue, store]);
  const name = (id: string) => own.find((p) => p.id === id)?.name ?? id;
  const q = query.trim().toLowerCase();
  const matches = q ? own.filter((p) => !ids.includes(p.id) && p.name.toLowerCase().includes(q)).slice(0, 8) : [];
  const full = ids.length >= MAX_PRODUCTS;

  return (
    <section aria-labelledby={`${uid}-h`} className="card flex flex-col gap-3 p-4">
      <h2 id={`${uid}-h`} className="text-lg font-semibold">Produk di artikel</h2>
      <p className="text-[13px] text-muted">Maksimal {MAX_PRODUCTS} produk, tampil sebagai kartu di bawah artikel. Artikel juga muncul di halaman produk ini sebagai "Artikel terkait".</p>
      {ids.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {ids.map((pid, i) => (
            <li key={pid} className="flex flex-col gap-1 rounded-ctl bg-alt p-2">
              <span className="text-sm font-semibold break-words">{i + 1}. {name(pid)}</span>
              <span className="flex gap-1">
                <button type="button" className={small} disabled={i === 0} onClick={() => onChange(moveId(ids, i, -1))} aria-label={`Naikkan ${name(pid)}`}>Naik</button>
                <button type="button" className={small} disabled={i === ids.length - 1} onClick={() => onChange(moveId(ids, i, 1))} aria-label={`Turunkan ${name(pid)}`}>Turun</button>
                <button type="button" className={small} onClick={() => onChange(ids.filter((x) => x !== pid))} aria-label={`Hapus ${name(pid)} dari artikel`}>Hapus</button>
              </span>
            </li>
          ))}
        </ol>
      ) : <p className="text-[13px]">Belum ada produk.</p>}
      <label htmlFor={`${uid}-q`} className="text-[13px] font-semibold">Cari produk {BRANDS[store].name}</label>
      <input id={`${uid}-q`} type="search" className={input} value={query} disabled={full} onChange={(e) => setQuery(e.target.value)} aria-describedby={full ? `${uid}-full` : undefined} />
      {full ? <p id={`${uid}-full`} className="text-[13px] text-muted">Sudah {MAX_PRODUCTS} produk. Hapus satu untuk menambah yang lain.</p> : null}
      {matches.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {matches.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <span className="text-sm break-words">{p.name}</span>
              <button type="button" className={small} onClick={() => { onChange([...ids, p.id]); setQuery(""); }}>Tambah<span className="sr-only"> {p.name}</span></button>
            </li>
          ))}
        </ul>
      ) : q && !full ? <p className="text-[13px] text-muted">Tidak ada produk yang cocok.</p> : null}
    </section>
  );
}
