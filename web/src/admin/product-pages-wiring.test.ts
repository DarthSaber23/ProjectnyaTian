import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

/** Source-level checks (node only); the screens are exercised in the browser on dev. */

const read = (file: string) => readFileSync(resolve(__dirname, "..", file), "utf8");

describe("Produk admin wiring", () => {
  it("NAV has the Produk item with products.media and App.tsx routes products and products/:id", () => {
    expect(read("admin/AdminShell.tsx")).toContain('{ to: "/admin/products", label: "Produk", perm: "products.media" }');
    const app = read("App.tsx");
    expect(app).toContain('<Route path="products" element={<AdminProducts />} />');
    expect(app).toContain('<Route path="products/:id" element={<AdminProductPhotos />} />');
  });

  it("ProductPages imports only from services/http and never from services/mock or dangerouslySetInnerHTML", () => {
    const pages = read("admin/ProductPages.tsx");
    expect(pages).not.toMatch(/services\/mock|mocks\//);
    expect(pages).not.toContain("dangerouslySetInnerHTML");
    expect(pages).toMatch(/from "\.\.\/services\/http(\/admin)?"/);
  });

  it("async results update the latest product, actions queue behind an alt save, and focus returns on cancel", () => {
    const pages = read("admin/ProductPages.tsx");
    expect(pages).not.toContain("setImages(");
    for (const part of ["updateProduct((p) => ({ ...p, images: applyOrder(p.images, ids) }))", "withImageRemoved(p, image.id)", "withImageAdded(p.images, image)", "withImagePatched(p.images, image.id", "latest.current?.images", "nextAnnouncement(previous, message)", 'setFocus({ id: open.id, kind: "delete" })', "saving: true"]) {
      expect(pages, part).toContain(part);
    }
  });

  it("ProductPages contains the spec copy", () => {
    const pages = read("admin/ProductPages.tsx");
    for (const copy of [
      "JPG, PNG, WebP · maks. 10 MB · min. 480 px",
      "Jangan unggah foto yang memuat orang yang dapat dikenali atau yang lisensinya tidak jelas. Foto yang sudah dihapus masih dapat diakses lewat tautannya selama file-nya belum terhapus dan dapat tersimpan di cache peramban hingga 1 tahun.",
      "Saya memiliki hak atau izin untuk memakai foto ini di toko.",
      "Simpan file foto asli Anda. Toko hanya menyimpan salinan yang sudah diperkecil.",
      "Foto contoh. Ganti dengan foto produk asli atau hapus sebelum toko diluncurkan.",
      "Belum ada foto. Foto pertama yang diunggah menjadi foto utama.",
      "Sudah 6 foto. Hapus satu untuk menambah.",
      "Unggah satu foto per kali.",
      "Mengunggah…",
      "Tersimpan",
      "Gagal menyimpan. Coba lagi.",
      "Foto per varian",
      'accept="image/jpeg,image/png,image/webp"',
      "`Hapus foto ${n} dari ${total}: ${",
      "`Foto ${n} dipindah ke urutan ${",
      '"Foto dijadikan utama"',
      "`Foto dihapus. ${",
      "`Naikkan foto ${n}`",
      "`Turunkan foto ${n}`",
      "`Jadikan foto ${n} sebagai foto utama`",
      "`Hapus foto ${n}`",
      "/125 karakter",
      'rel="noopener noreferrer"',
      "safeSourceLink(",
      "beforeunload",
    ]) {
      expect(pages, copy).toContain(copy);
    }
  });
});
