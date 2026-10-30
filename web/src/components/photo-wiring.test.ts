import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

/** Source-level wiring checks (node only); the rendered behaviour is checked in the browser on dev. */

const src = resolve(__dirname, "..");
const read = (file: string) => readFileSync(join(src, file), "utf8");
const tsxFiles = (dir: string): string[] =>
  readdirSync(join(src, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name).replace(/\\/g, "/")] : []);

describe("product photo wiring", () => {
  it("ProductArt is rendered only inside ProductPhoto", () => {
    const users = [...tsxFiles("pages"), ...tsxFiles("components"), ...tsxFiles("admin")].filter((f) => read(f).includes("<ProductArt"));
    expect(users.filter((f) => f !== "components/ui.tsx")).toEqual(["components/ProductPhoto.tsx"]);
  });

  it.each([
    ["pages/Catalog.tsx", 'photoSizes("catalogCard")'],
    ["components/ProductCard.tsx", 'photoSizes("homeCard")'],
    ["pages/SearchPage.tsx", 'photoSizes("searchCard")'],
    ["pages/CartPage.tsx", 'photoSizes("cartRow")'],
    ["pages/Account.tsx", 'photoSizes("accountRecommended")'],
    ["pages/Account.tsx", 'photoSizes("accountWishlist")'],
    ["components/ProductGallery.tsx", 'photoSizes("productMain")'],
    ["components/ProductGallery.tsx", 'photoSizes("productThumb")'],
  ])("%s uses %s", (file, call) => {
    expect(read(file)).toContain(call);
  });

  it("cart row uses photoForVariant and decorative; the product page uses ProductGallery", () => {
    const cart = read("pages/CartPage.tsx");
    expect(cart).toContain("photoForVariant(product, l.sku)");
    expect(cart).toMatch(/<ProductPhoto[^>]*decorative/);
    expect(read("pages/ProductPage.tsx")).toContain("<ProductGallery");
    for (const file of ["components/ProductCard.tsx", "pages/Account.tsx"]) expect(read(file)).toMatch(/<ProductPhoto[^>]*decorative/);
  });

  it("ProductPhoto img has width, height, decoding async and the square classes", () => {
    const photo = read("components/ProductPhoto.tsx");
    for (const part of ["aspect-square", "object-cover", "absolute inset-0 h-full w-full", 'decoding="async"', "width={image.width}", "height={image.height}", "onError", 'loading={priority ? "eager" : "lazy"}']) {
      expect(photo).toContain(part);
    }
  });

  it("the gallery uses a labelled group of pressed buttons and shows 'Foto contoh' for samples", () => {
    const gallery = read("components/ProductGallery.tsx");
    for (const part of ['role="group"', 'aria-label="Galeri foto"', "aria-pressed", "thumbLabel(", "Foto contoh", "showThumbnails(product)", "galleryPick("]) {
      expect(gallery).toContain(part);
    }
  });

  it("the account recommendation photo sits in a fixed-width box, so the name never wraps one letter per line", () => {
    const account = read("pages/Account.tsx");
    expect(account).toMatch(/<div className="w-14 shrink-0"><ProductPhoto [^>]*photoSizes\("accountRecommended"\)[^>]*\/><\/div>/);
    expect(account).not.toMatch(/<ProductPhoto [^>]*className="[^"]*w-14/);
  });
});
