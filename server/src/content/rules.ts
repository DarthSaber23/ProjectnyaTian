import type { ArticleTextInput } from "./content.types";
import { plainText } from "./markdown";

/** Article rules (spec sections 2 and 7). Lengths are Unicode code points. */

export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["baru", "halaman", "en", "tag", "penulis"]);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const length = (text: string) => [...text].length;

export function isValidSlug(slug: string): boolean {
  return SLUG.test(slug) && slug.length >= 3 && slug.length <= 80 && !RESERVED_SLUGS.has(slug);
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

export function readingMinutes(body: string): number {
  const words = plainText(body).match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(words / 200));
}

/** Whole words within `max` code points; a single over-long word is cut hard. */
export function cutAtWord(text: string, max: number): string {
  const points = [...text];
  if (points.length <= max) return text;
  const cut = points.slice(0, max).join("");
  if (/\s/.test(points[max]!)) return cut.trimEnd();
  const space = cut.search(/\s\S*$/);
  return space > 0 ? cut.slice(0, space).trimEnd() : cut;
}

export function autoProductSeo(product: { name: string; spec?: string | null }, brandName: string): { title: string; description: string } {
  return {
    title: `${product.name} | ${brandName}`,
    description: product.spec ? cutAtWord(product.spec, 160) : `Beli ${product.name} di ${brandName}.`,
  };
}

export function autoCategorySeo(category: { name: string }, brandName: string): { title: string; description: string } {
  return { title: `${category.name} | ${brandName}`, description: `Belanja ${category.name} di ${brandName}.` };
}

const FIELDS: { key: keyof ArticleTextInput; label: string; max: number; required: boolean }[] = [
  { key: "title", label: "Judul", max: 120, required: true },
  { key: "seoTitle", label: "Judul SEO", max: 60, required: false },
  { key: "metaDescription", label: "Deskripsi meta", max: 160, required: true },
  { key: "summary", label: "Ringkasan", max: 200, required: true },
  { key: "body", label: "Isi", max: 50_000, required: true },
];

/** Problems with one language's text, as Bahasa messages. Drafts only check maximums and formats. */
export function checkLengths(text: ArticleTextInput, forPublish: boolean): string[] {
  const problems: string[] = [];
  if (!text.slug) {
    if (forPublish) problems.push("Lengkapi Slug sebelum terbit.");
  } else if (RESERVED_SLUGS.has(text.slug)) {
    problems.push("Slug ini tidak boleh dipakai.");
  } else if (!isValidSlug(text.slug)) {
    problems.push("Slug hanya huruf kecil, angka dan tanda hubung (3–80 karakter).");
  }
  for (const field of FIELDS) {
    const value = ((text[field.key] as string | null | undefined) ?? "").trim();
    if (!value) {
      if (forPublish && field.required) problems.push(`Lengkapi ${field.label} sebelum terbit.`);
    } else if (length(value) > field.max) {
      problems.push(`${field.label} maksimal ${field.max} karakter.`);
    } else if (field.key === "metaDescription" && forPublish && length(value) < 50) {
      problems.push("Deskripsi meta minimal 50 karakter.");
    }
  }
  const canonical = text.canonicalUrl?.trim();
  if (canonical && !/^https:\/\/[^\s/]+\.[^\s]*$/.test(canonical)) problems.push("Canonical harus berupa URL https://.");
  return problems;
}
