import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

/** Source-level wiring checks for the storefront blog (item 2 spec section 6); rendering is checked in the browser on dev. */

const src = resolve(__dirname, "..");
const read = (file: string) => readFileSync(join(src, file), "utf8");
const tsxFiles = (dir: string): string[] =>
  readdirSync(join(src, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name).replace(/\\/g, "/")] : []);

describe("storefront blog wiring", () => {
  it("routes /blog, /blog/:slug, /en/blog and /en/blog/:slug inside the shop layout", () => {
    const app = read("App.tsx");
    expect(app).toContain('<Route path="blog" element={<BlogList lang="id" />} />');
    expect(app).toContain('<Route path="blog/:slug" element={<ArticleRoute lang="id" />} />');
    expect(app).toContain('<Route path="en/blog" element={<BlogList lang="en" />} />');
    expect(app).toContain('<Route path="en/blog/:slug" element={<ArticleRoute lang="en" />} />');
    expect(app.indexOf('path="en/blog"')).toBeLessThan(app.indexOf('path="*"'));
  });

  it("article HTML is set in one place only, from the server's renderMarkdown output", () => {
    const users = [...tsxFiles("pages"), ...tsxFiles("components")].filter((f) => read(f).includes("dangerouslySetInnerHTML"));
    expect(users).toEqual(["pages/ArticlePage.tsx"]);
    expect(read("pages/ArticlePage.tsx")).toContain("dangerouslySetInnerHTML={{ __html: article.html }}");
    expect(readFileSync(resolve(src, "../../server/src/content/public-content.service.ts"), "utf8")).toContain("html: renderMarkdown(text.body)");
  });

  it("product page shows related articles after the specifications only", () => {
    const page = read("pages/ProductPage.tsx");
    const related = page.indexOf("<RelatedArticles");
    expect(related).toBeGreaterThan(page.indexOf("Spesifikasi</caption>"));
    expect(page.indexOf("<RelatedArticles")).toBe(page.lastIndexOf("<RelatedArticles"));
    expect(read("components/RelatedArticles.tsx")).toContain("Artikel terkait");
  });

  it("home has the 'Dari blog' row near the bottom, and the footer links to the blog", () => {
    const home = read("pages/Home.tsx");
    expect(home.indexOf("<FromBlog")).toBeGreaterThan(home.indexOf("Pilihan untukmu"));
    expect(read("components/FromBlog.tsx")).toContain("Dari blog");
    expect(read("components/Layout.tsx")).toMatch(/<Link to="\/blog"[^>]*>Blog<\/Link>/);
  });

  it("the header navigation is unchanged (no blog link above the footer)", () => {
    const layout = read("components/Layout.tsx");
    expect(layout.indexOf('to="/blog"')).toBeGreaterThan(layout.indexOf("<footer"));
  });

  it("the footer link is inline in the existing line, so the footer keeps its height (CLS)", () => {
    const footer = read("components/Layout.tsx").split("<footer")[1]!.split("</footer>")[0]!;
    expect(footer).not.toMatch(/min-h-\[44px\]|<nav|flex-col/);
    expect(footer).toMatch(/<Link to="\/blog"[^>]*>Blog<\/Link> · \{brand\.name\}/);
  });

  it("blog chrome copy in both languages, and empty state", () => {
    const list = read("pages/BlogList.tsx");
    const article = read("pages/ArticlePage.tsx");
    expect(list).toContain("Belum ada artikel.");
    expect(list).toContain("No articles yet.");
    expect(list).toContain("Guides and tips from");
    expect(article).toContain("Produk di artikel ini");
    expect(article).toContain("Products in this article");
    expect(article).toContain("Read in Bahasa Indonesia");
    expect(article).toContain("English version");
    expect(read("domain/articles.ts")).toContain("min read");
  });

  it("blog pages reserve a screen of height in every state, so the footer never jumps when content arrives (CLS)", () => {
    for (const file of ["pages/BlogList.tsx", "pages/ArticlePage.tsx"]) {
      const source = read(file);
      expect(source, file).toContain('const FRAME = "min-h-[100svh]"');
      const roots = source.match(/return (?:\(\s*)?<div lang=\{lang\} className=\{`\$\{FRAME\} [^`]*`\}/g) ?? [];
      const allRoots = source.match(/return (?:\(\s*)?<(?:div|p) lang=\{lang\}/g) ?? [];
      expect(roots.length, file).toBe(allRoots.length);
      expect(roots.length, file).toBeGreaterThan(0);
    }
  });

  it("article cards keep a fixed 16:9 frame with lazy loading and a brand-coloured fallback", () => {
    const card = read("components/ArticleCard.tsx");
    expect(card).toContain("aspect-video");
    expect(card).toContain("bg-primary-soft");
    expect(card).toContain('loading={priority ? "eager" : "lazy"}');
    expect(card).toContain("photoSrcSet(");
    expect(read("pages/ArticlePage.tsx")).toMatch(/<ArticleCover[^>]*priority/);
  });

  it("the blog list ignores stale loads and scrolls to the top when the page number changes", () => {
    const list = read("pages/BlogList.tsx");
    expect(list).toContain("let live = true;");
    expect(list).toMatch(/window\.scrollTo\(0, 0\)/);
    expect(list).toMatch(/\[page\]\)/);
  });
});
