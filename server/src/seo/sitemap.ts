export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  alternates?: { hreflang: string; href: string }[];
}

const xml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** sitemaps.org XML with xhtml:link language alternates (spec section 5). */
export function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((e) => [
    "  <url>",
    `    <loc>${xml(e.loc)}</loc>`,
    ...(e.lastmod ? [`    <lastmod>${xml(e.lastmod)}</lastmod>`] : []),
    ...(e.alternates ?? []).map((a) => `    <xhtml:link rel="alternate" hreflang="${xml(a.hreflang)}" href="${xml(a.href)}"/>`),
    "  </url>",
  ].join("\n"));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
