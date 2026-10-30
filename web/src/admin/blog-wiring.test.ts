import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

/** Source-level wiring and copy checks for the admin Blog and SEO screens (item 2 spec section 3). */

const src = resolve(__dirname, "..");
const read = (file: string) => readFileSync(join(src, file), "utf8");
const tsxFiles = (dir: string): string[] =>
  readdirSync(join(src, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name).replace(/\\/g, "/")] : []);

describe("admin blog and SEO wiring", () => {
  it("menu entries are guarded by their permissions", () => {
    const shell = read("admin/AdminShell.tsx");
    expect(shell).toContain('{ to: "/admin/blog", label: "Blog", perm: "articles.manage" }');
    expect(shell).toContain('{ to: "/admin/seo", label: "SEO", perm: "seo.edit" }');
  });

  it("routes for the list, a new article, an article and the SEO screen", () => {
    const app = read("App.tsx");
    for (const route of ['<Route path="blog" element={<AdminBlogList />} />', '<Route path="blog/new" element={<AdminArticleEditor />} />', '<Route path="blog/:id" element={<AdminArticleEditor />} />', '<Route path="seo" element={<AdminSeo />} />']) {
      expect(app).toContain(route);
    }
  });

  it("pages talk to the server only through services/http (no mocks)", () => {
    for (const file of ["admin/BlogPages.tsx", "admin/SeoPage.tsx"]) {
      const source = read(file);
      expect(source).not.toMatch(/from "\.\.\/mocks\//);
      expect(source).not.toMatch(/services\/mock/);
      expect(source).toContain('from "../services/http/admin"');
    }
  });

  it("the only HTML set by admin pages is the preview, from renderMarkdown", () => {
    const users = tsxFiles("admin").filter((f) => read(f).includes("dangerouslySetInnerHTML"));
    expect(users).toEqual(["admin/BlogPages.tsx"]);
    const source = read("admin/BlogPages.tsx");
    expect(source.match(/dangerouslySetInnerHTML/g)).toHaveLength(1);
    expect(source).toContain("dangerouslySetInnerHTML={{ __html: renderMarkdown(");
  });

  it("article requests run one at a time per article", () => {
    expect(read("admin/BlogPages.tsx")).toContain("createSerialQueue()");
  });

  it("editor copy per spec section 3", () => {
    const source = read("admin/BlogPages.tsx");
    for (const text of [
      "Tulis artikel", "Belum ada artikel.", "Contoh", "Bahasa Indonesia", "English", "Tambah versi English", "Hapus versi English",
      "Judul", "Slug", "Judul SEO", "Deskripsi meta", "Ringkasan", "Isi", "Tulis", "Pratinjau", "Jangan tampilkan di mesin pencari", "Canonical",
      "Saya memiliki hak atau izin untuk memakai foto ini di toko.", "Sisipkan gambar", "Simpan draf", "Terbitkan", "Jadwalkan", "Batalkan terbit", "Hapus artikel",
      "URL lama akan dialihkan ke URL baru.", "Ganti", "Hapus",
    ]) expect(source, text).toContain(text);
    expect(source).toContain("seoCount(");
    expect(source).toContain("snippet(");
    expect(source).toContain('"beforeunload"');
    expect(source).toContain("MAX_PRODUCTS = 6");
  });

  it("SEO screen copy", () => {
    const source = read("admin/SeoPage.tsx");
    for (const text of ["Produk", "Kategori", "otomatis", "khusus", "Ubah", "Kembalikan ke otomatis"]) expect(source, text).toContain(text);
    expect(source).toContain("seoCount(");
    expect(source).toContain("snippet(");
  });

  describe("editor behaviour (review findings)", () => {
    const source = () => read("admin/BlogPages.tsx");

    it("queued jobs read the latest version when they run, not when the button was clicked", () => {
      const s = source();
      expect(s).toContain("latestView");
      expect(s).not.toContain("created.current");
      expect(s).not.toMatch(/admin\.unpublishArticle\(view\.id, view\.version\)/);
      expect(s).not.toMatch(/admin\.publishArticle\(s\.id, s\.version/);
    });

    it("the body image goes into the language the upload started in, on the latest drafts", () => {
      const s = source();
      expect(s).toContain("appendImage(");
      expect(s).toMatch(/setDrafts\(\(d\) => appendImage\(d, lang/);
      expect(s).not.toMatch(/insertImage\(current\.body/);
    });

    it("actions that save no text keep the typed drafts", () => {
      const s = source();
      expect(s).toContain("mergeMeta(");
      expect(s).toContain("settleAfterSave(");
    });

    it("load and fail reset the error and the stale flag", () => {
      const s = source();
      expect(s).toMatch(/setLoadError\(undefined\);\s*setError\(undefined\);\s*setStale\(false\);/);
      expect(s).toContain("setStale(isStale(e));");
    });

    it("the list ignores a response for a store that is no longer shown", () => {
      const s = source();
      expect(s).toMatch(/let live = true;[\s\S]*admin\.listArticles\(store\)[\s\S]*if \(live\)[\s\S]*live = false/);
    });

    it("write and preview tabs are 44px tall and linked to a tabpanel", () => {
      const s = source();
      expect(s).toContain('min-h-[44px]" : "chip-off min-h-[44px]"');
      expect(s).toContain("`${uid}-tab-write`");
      expect(s).toContain("aria-controls={`${uid}-body-panel`}");
      expect(s).toMatch(/role="tabpanel" id=\{`\$\{uid\}-body-panel`\} aria-labelledby=\{`\$\{uid\}-tab-\$\{mode\}`\}/);
    });

    it("a live article offers no publish or schedule, and its save button says Simpan perubahan", () => {
      const s = source();
      expect(s).toContain("Simpan perubahan");
      expect(s).toContain("Simpan draf");
      expect(s).toMatch(/!view\?\.live \? \(\s*<>/);
    });
  });
});
