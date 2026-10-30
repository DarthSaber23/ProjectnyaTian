import type { Lang, PublicArticle, PublicArticleCard } from "../content/content.types";
import { formatIDR } from "../domain/money";
import type { Product } from "../domain/types";
import { escapeHtml as e } from "./head";

/** The readable page inside #ssr: plain, crawlable HTML. Shoppers never see it (index.html hides it once JS runs). */

const minPrice = (product: Product) => Math.min(...product.variants.map((v) => v.price));
const productItem = (p: Product) => `<li><a href="/produk/${e(p.slug)}">${e(p.name)}</a> ${formatIDR(minPrice(p))}</li>`;

export function ssrArticle(page: PublicArticle, lang: Lang): string {
  const cover = page.cover ? `<img src="${e(page.cover.src)}" alt="${e(page.cover.alt)}" width="${page.cover.width}" height="${page.cover.height}">` : "";
  const products = page.products.length
    ? `<h2>${lang === "en" ? "Products in this article" : "Produk di artikel ini"}</h2><ul>${page.products.map(productItem).join("")}</ul>`
    : "";
  return `<article><h1>${e(page.title)}</h1><p>${e(page.publishedAt.slice(0, 10))}</p>${cover}${page.html}${products}</article>`;
}

export function ssrProduct(product: Product, inStock: boolean): string {
  const photos = (product.images ?? []).map((i) => `<img src="${e(i.src)}" alt="${e(i.alt)}" width="${i.width}" height="${i.height}">`).join("");
  return `<article><h1>${e(product.name)}</h1>${product.spec ? `<p>${e(product.spec)}</p>` : ""}<p>${formatIDR(minPrice(product))} · ${inStock ? "Tersedia" : "Stok habis"}</p>${photos}</article>`;
}

export function ssrList(title: string, description: string, links: { href: string; name: string; text?: string }[]): string {
  const items = links.map((l) => `<li><a href="${e(l.href)}">${e(l.name)}</a>${l.text ? ` ${e(l.text)}` : ""}</li>`).join("");
  return `<h1>${e(title)}</h1><p>${e(description)}</p><ul>${items}</ul>`;
}

export const cardLinks = (cards: PublicArticleCard[], lang: Lang) =>
  cards.map((c) => ({ href: `${lang === "en" ? "/en" : ""}/blog/${c.slug}`, name: c.title, text: c.summary }));
