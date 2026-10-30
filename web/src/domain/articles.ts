/**
 * Article helpers for the blog pages and the editor (item 2 spec). Pure: no React, no network.
 * slugFromTitle is a copy of server/src/content/rules.ts.
 */
import type { Lang } from "../services/contracts";

export function articleUrl(lang: Lang, slug: string): string {
  return `${lang === "en" ? "/en" : ""}/blog/${slug}`;
}

export function blogUrl(lang: Lang, page: number): string {
  return `${lang === "en" ? "/en" : ""}/blog${page > 1 ? `?page=${page}` : ""}`;
}

export function readingLabel(minutes: number, lang: Lang): string {
  return lang === "en" ? `${minutes} min read` : `${minutes} menit baca`;
}

const MONTHS: Record<Lang, string[]> = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** "30 Okt 2026" from a WIB ISO timestamp (the date part is already in WIB). */
export function articleDate(iso: string, lang: Lang): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day} ${MONTHS[lang][(month ?? 1) - 1]} ${year}`;
}

export function slugFromTitle(title: string): string {
  let slug = title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length > 80) {
    const head = slug.slice(0, 81);
    const cut = head.lastIndexOf("-");
    slug = (cut > 0 ? head.slice(0, cut) : slug.slice(0, 80)).replace(/-+$/, "");
  }
  return slug;
}

export function seoCount(text: string, max: number): { count: number; over: boolean; label: string } {
  const count = [...text].length;
  return { count, over: count > max, label: `${count}/${max}` };
}

const cut = (text: string, max: number) => {
  const points = [...text];
  return points.length <= max ? text : `${points.slice(0, max - 1).join("").trimEnd()}…`;
};

/** How a search result would show the page: title within 60, description within 160 code points. */
export function snippet(title: string, url: string, description: string): { title: string; url: string; description: string } {
  return { title: cut(title, 60), url, description: cut(description, 160) };
}
