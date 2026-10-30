import { describe, expect, it } from "vitest";
import { buildHead, injectShell, jsonLdScript } from "./head";
import { articleJsonLd, breadcrumbJsonLd, productJsonLd } from "./jsonld";
import { renderRobots } from "./robots";
import { renderSitemap } from "./sitemap";

const SHELL = '<!doctype html>\n<html lang="id">\n  <head>\n    <meta charset="UTF-8" />\n    <title>E-Commerce Starter · prototipe</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/assets/index.js"></script>\n  </body>\n</html>';
const head = (over: Partial<Parameters<typeof buildHead>[0]> = {}) => buildHead({
  title: "Judul", description: "Deskripsi", canonical: "http://shop.test/blog/a", lang: "id", alternates: [], noindex: false, ogType: "article", siteName: "Sambung", jsonLd: [], ...over,
});

describe("head and shell", () => {
  it("builds title, description, canonical, og, twitter and robots tags", () => {
    const html = head({ image: "http://shop.test/media/articles/a/0123456789abcdef-1600.webp", noindex: true });
    expect(html).toContain("<title>Judul</title>");
    expect(html).toContain('<meta name="description" content="Deskripsi">');
    expect(html).toContain('<link rel="canonical" href="http://shop.test/blog/a">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta property="og:locale" content="id_ID">');
    expect(html).toContain('<meta property="og:image" content="http://shop.test/media/articles/a/0123456789abcdef-1600.webp">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(head()).toContain('<meta name="twitter:card" content="summary">');
    expect(head()).not.toContain("robots");
  });

  it("hreflang alternates and the verification tag appear only when given", () => {
    const html = head({ alternates: [{ hreflang: "id", href: "http://shop.test/blog/a" }, { hreflang: "en", href: "http://shop.test/en/blog/a-en" }, { hreflang: "x-default", href: "http://shop.test/blog/a" }], verification: "abc" });
    expect(html).toContain('<link rel="alternate" hreflang="en" href="http://shop.test/en/blog/a-en">');
    expect(html).toContain('<meta name="google-site-verification" content="abc">');
    expect(head()).not.toContain("hreflang");
  });

  it("Review Focus 4: </script>, quotes, & and long titles are escaped in tags and JSON-LD", () => {
    const nasty = `Kabel "100W" & </script><script>alert(1)</script> ${"x".repeat(300)}`;
    const html = head({ title: nasty, description: nasty, jsonLd: [{ headline: nasty }] });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&quot;100W&quot; &amp; &lt;/script&gt;");
    const ld = html.slice(html.indexOf('<script type="application/ld+json">'));
    expect(ld.slice(0, ld.indexOf("</script>"))).not.toContain("</script");
    expect(jsonLdScript({ a: "</script>" })).toBe('<script type="application/ld+json">{"a":"\\u003c/script>"}</script>');
  });

  it("injectShell sets the html lang, replaces the title, adds the head and fills #ssr", () => {
    const out = injectShell(SHELL, { lang: "en", head: "<title>Baru</title>", ssr: "<h1>Hai</h1>" });
    expect(out).toContain('<html lang="en">');
    expect(out).not.toContain("E-Commerce Starter · prototipe");
    expect(out).toContain("<title>Baru</title>\n  </head>");
    expect(out).toContain('<div id="root"><div id="ssr"><h1>Hai</h1></div></div>');
    expect(out).toContain('<script type="module" src="/assets/index.js"></script>');
    expect(() => injectShell("<html></html>", { lang: "id", head: "", ssr: "" })).toThrow();
  });

  it("injectShell inserts head and text literally, even with $&, $', $` and $$ in them", () => {
    const out = injectShell(SHELL, { lang: "id", head: "<title>A $& B $' C $` D $$</title>", ssr: "<p>$& $' $` $$</p>" });
    expect(out).toContain("<title>A $& B $' C $` D $$</title>\n  </head>");
    expect(out).toContain('<div id="root"><div id="ssr"><p>$& $\' $` $$</p></div></div>');
    expect(out.match(/<\/head>/g)).toHaveLength(1);
  });
});

describe("JSON-LD builders", () => {
  it("article, product and breadcrumb carry the schema.org fields", () => {
    expect(articleJsonLd({ headline: "H", description: "D", url: "u", datePublished: "2026-10-30T10:00:00+07:00", dateModified: "2026-10-30T11:00:00+07:00", author: "Sinta P.", publisher: "Sambung", lang: "id" }))
      .toMatchObject({ "@context": "https://schema.org", "@type": "BlogPosting", headline: "H", author: { "@type": "Person", name: "Sinta P." }, publisher: { "@type": "Organization", name: "Sambung" }, inLanguage: "id" });
    expect(productJsonLd({ name: "Kabel", description: "D", url: "u", images: ["i"], sku: "B01-1M", brand: "Sambung", price: 129000, inStock: false }))
      .toMatchObject({ "@type": "Product", sku: "B01-1M", offers: { "@type": "Offer", priceCurrency: "IDR", price: 129000, availability: "https://schema.org/OutOfStock" } });
    expect(breadcrumbJsonLd([{ name: "Beranda", url: "a" }, { name: "Blog", url: "b" }]).itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Beranda", item: "a" }, { "@type": "ListItem", position: 2, name: "Blog", item: "b" },
    ]);
  });
});

describe("sitemap and robots", () => {
  it("sitemap lists urls with lastmod and xhtml alternates, escaped, as valid XML", () => {
    const xml = renderSitemap([
      { loc: "http://shop.test/" },
      { loc: "http://shop.test/blog/a?x=1&y=2", lastmod: "2026-10-30T10:00:00+07:00", alternates: [{ hreflang: "id", href: "http://shop.test/blog/a" }, { hreflang: "en", href: "http://shop.test/en/blog/b" }] },
    ]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain("<loc>http://shop.test/blog/a?x=1&amp;y=2</loc>");
    expect(xml).toContain("<lastmod>2026-10-30T10:00:00+07:00</lastmod>");
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="en" href="http://shop.test/en/blog/b"/>');
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml.match(/<\/url>/g)).toHaveLength(2);
  });

  it("robots disallows private paths and names the sitemap", () => {
    expect(renderRobots("http://shop.test")).toBe([
      "User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /akun", "Disallow: /keranjang", "Disallow: /checkout",
      "Disallow: /pembayaran", "Disallow: /masuk", "Disallow: /cari", "Disallow: /bandingkan", "Disallow: /v1/", "", "Sitemap: http://shop.test/sitemap.xml", "",
    ].join("\n"));
  });
});
