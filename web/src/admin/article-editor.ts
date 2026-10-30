/**
 * Pure helpers for the admin article editor (item 2 spec section 3). No React, no network.
 */
import { slugFromTitle } from "../domain/articles";
import { formatWib } from "../domain/time";
import type { ArticleTextInput, ArticleView, Lang } from "../services/contracts";
import { ApiError } from "../services/http/client";

export const STALE_MESSAGE = "Artikel diubah orang lain. Muat ulang halaman.";

export function emptyText(): ArticleTextInput {
  return { slug: "", title: "", seoTitle: null, metaDescription: "", summary: "", body: "", noindex: false, canonicalUrl: null };
}

export function statusLabel(view: ArticleView): string {
  if (view.status === "draft") return "Draf";
  if (view.status === "unpublished") return "Tidak terbit";
  if (!view.live && view.publishAt) return `Terjadwal ${formatWib(view.publishAt)}`;
  return "Terbit";
}

export function languagesLabel(view: Pick<ArticleView, "texts">): string {
  return view.texts.en ? "ID + EN" : "ID";
}

/** New title; the slug follows it until the editor changed the slug by hand. */
export function withTitle(text: ArticleTextInput, title: string, slugEdited: boolean): ArticleTextInput {
  return { ...text, title, slug: slugEdited ? text.slug : slugFromTitle(title) };
}

/** `datetime-local` value read as WIB, e.g. "2026-11-01T08:00" → "2026-11-01T08:00:00+07:00"; null when empty or malformed. */
export function wibToIso(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : null;
}

/** The 409 that means another editor saved first: the typed text stays and the editor asks for a reload. */
export function isStale(error: unknown): boolean {
  return error instanceof ApiError && error.code === "CONFLICT" && error.message === STALE_MESSAGE;
}

/** True when saving would rename a live URL (the server then redirects the old slug). */
export function slugWillRedirect(view: ArticleView, lang: Lang, draftSlug: string): boolean {
  const saved = view.texts[lang]?.slug;
  return view.live && !!saved && saved !== draftSlug;
}

/** Inserts `![alt](src)` as its own paragraph at the cursor; returns the new body and the cursor after it. */
export function insertImage(body: string, cursor: number, alt: string, src: string): { body: string; cursor: number } {
  const before = body.slice(0, cursor).replace(/\n+$/, "");
  const after = body.slice(cursor).replace(/^\n+/, "");
  const head = `${before}${before ? "\n\n" : ""}![${alt.replace(/[[\]]/g, "")}](${src})\n\n`;
  return { body: head + after, cursor: head.length };
}

export type Drafts = { id: ArticleTextInput; en: ArticleTextInput | null };

/**
 * Adds an uploaded image at the end of the latest body of `lang` (the language the upload started in).
 * Returns the same object when that language no longer exists, so a removed English text does not come back.
 */
export function appendImage(drafts: Drafts, lang: Lang, alt: string, src: string): Drafts {
  const current = drafts[lang];
  if (!current) return drafts;
  return { ...drafts, [lang]: { ...current, body: insertImage(current.body, current.body.length, alt, src).body } };
}

/** The view after a request that saved no text (unpublish, cover): status, version and cover move, the typed text is untouched. */
export function mergeMeta(prev: ArticleView | null, next: ArticleView): ArticleView {
  return prev ? { ...prev, cover: next.cover, version: next.version, updatedAt: next.updatedAt, status: next.status, publishAt: next.publishAt, publishedAt: next.publishedAt, live: next.live } : next;
}

/** After a save: take the server copy only when nothing was typed since the request was built; otherwise keep the drafts. */
export function settleAfterSave(sent: string, current: string): "adopt" | "keep" {
  return sent === current ? "adopt" : "keep";
}
