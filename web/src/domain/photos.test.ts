import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES, altLength, applyOrder, buildUploadInit, canUpload, cleanAlt, galleryPick, moveId, nextAnnouncement, photoForVariant, photoSizes, photoSrcSet,
  safeSourceLink, showThumbnails, thumbLabel, uploadPrecheck, withImageAdded, withImagePatched, withImageRemoved, type PhotoPlace,
} from "./photos";
import type { Product, ProductImage, Variant } from "./types";

const image = (id: string, hash = "1a2b3c4d5e6f7a8b"): ProductImage => ({
  id, alt: `Foto ${id}`, width: 1600, height: 1600,
  src: `/media/products/B01/${hash}-960.webp`,
  srcset: `/media/products/B01/${hash}-480.webp 480w, /media/products/B01/${hash}-960.webp 960w, /media/products/B01/${hash}-1600.webp 1600w`,
});
const variant = (sku: string, imageId?: string): Variant => ({ sku, label: sku, price: 100_000, onHand: 5, reserved: 0, ...(imageId ? { imageId } : {}) });
const product = (images: ProductImage[] | undefined, variants: Variant[] = [variant("B01-1M")]): Product => ({
  id: "B01", brand: "sambung", slug: "kabel", name: "Kabel", categoryId: "kabel", art: { kind: "cable", bg: "#fff", accent: "#000" }, variants, images,
});

const SIZES: Record<PhotoPlace, string> = {
  catalogCard: "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw",
  homeCard: "(min-width: 768px) 25vw, 50vw",
  searchCard: "(min-width: 1024px) 25vw, 50vw",
  productMain: "(min-width: 768px) 50vw, 100vw",
  productThumb: "48px",
  cartRow: "80px",
  accountRecommended: "56px",
  accountWishlist: "72px",
};

describe("photos", () => {
  it("srcset descriptors equal the targets in the file names", () => {
    for (const part of photoSrcSet(image("a"))!.split(", ")) {
      const [url, descriptor] = part.split(" ");
      expect(descriptor).toBe(`${/-(\d+)\.webp$/.exec(url!)![1]}w`);
    }
  });

  it.each(Object.keys(SIZES) as PhotoPlace[])("photoSizes(%s) is never empty and equals the spec table value", (place) => {
    expect(photoSizes(place)).toBe(SIZES[place]);
    expect(photoSizes(place).length).toBeGreaterThan(0);
  });

  it("photoForVariant: the variant's photo, else the main photo, else null", () => {
    const p = product([image("a"), image("b")], [variant("V1", "b"), variant("V2"), variant("V3", "gone")]);
    expect(photoForVariant(p, "V1")?.id).toBe("b");
    expect(photoForVariant(p, "V2")?.id).toBe("a");
    expect(photoForVariant(p, "V3")?.id).toBe("a");
    expect(photoForVariant(product([]), "B01-1M")).toBeNull();
  });

  it("galleryPick first render: default variant's linked photo if present, else position 0", () => {
    const p = product([image("a"), image("b")]);
    expect(galleryPick(p, variant("V", "b"), undefined)).toBe("b");
    expect(galleryPick(p, variant("V"), undefined)).toBe("a");
    expect(galleryPick(product([]), variant("V"), undefined)).toBeNull();
  });

  it("galleryPick keeps the current photo when the variant has no imageId or its imageId is not in images", () => {
    const p = product([image("a"), image("b")]);
    expect(galleryPick(p, variant("V"), "b")).toBe("b");
    expect(galleryPick(p, variant("V", "gone"), "b")).toBe("b");
  });

  it("galleryPick switches to a linked photo; a one-photo product returns that photo even when a variant links to it", () => {
    expect(galleryPick(product([image("a"), image("b")]), variant("V", "b"), "a")).toBe("b");
    expect(galleryPick(product([image("a")]), variant("V", "a"), "a")).toBe("a");
  });

  it("showThumbnails is false for 0 or 1 photo, true for 2", () => {
    expect(showThumbnails(product(undefined))).toBe(false);
    expect(showThumbnails(product([image("a")]))).toBe(false);
    expect(showThumbnails(product([image("a"), image("b")]))).toBe(true);
  });

  it("thumbLabel(1, 4) is 'Foto 2 dari 4' and contains no alt text", () => {
    expect(thumbLabel(1, 4)).toBe("Foto 2 dari 4");
  });

  it("altLength counts code points: 125 emoji give 125; same cleaning vectors as the server", () => {
    expect(altLength("😀".repeat(125))).toBe(125);
    expect(cleanAlt("\u200B a\n\tb \u00A0")).toBe("a b");
    expect(cleanAlt("\uFEFFKabel\u200D")).toBe("Kabel");
    expect(cleanAlt("<b>Kabel</b>")).toBe("<b>Kabel</b>");
  });

  it.each([["U+2060", "\u2060"], ["U+200E", "\u200E"], ["U+200F", "\u200F"], ["U+180E", "\u180E"], ["U+034F", "\u034F"]])("cleanAlt strips %s like the server", (_n, ch) => {
    expect(cleanAlt(`${ch}Kabel${ch}`)).toBe("Kabel");
    expect(altLength(cleanAlt(ch))).toBe(0);
  });

  it("uploadPrecheck accepts by MIME type or by extension", () => {
    expect(uploadPrecheck({ name: "foto.jpg", type: "", size: 10 })).toBeNull();
    expect(uploadPrecheck({ name: "foto.PNG", type: "application/octet-stream", size: 10 })).toBeNull();
    expect(uploadPrecheck({ name: "foto", type: "image/webp", size: 10 })).toBeNull();
    expect(uploadPrecheck({ name: "anim.gif", type: "", size: 10 })).toBe("Format tidak didukung. Gunakan JPG, PNG, atau WebP.");
  });

  it("moveId clamps: first up and last down return the same order; middle swaps", () => {
    const ids = ["a", "b", "c"];
    expect(moveId(ids, 0, -1)).toEqual(ids);
    expect(moveId(ids, 2, 1)).toEqual(ids);
    expect(moveId(ids, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveId(ids, 1, 1)).toEqual(["a", "c", "b"]);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("canUpload is false without a file, without the rights box, or while busy", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    expect(canUpload(null, true, false)).toBe(false);
    expect(canUpload(file, false, false)).toBe(false);
    expect(canUpload(file, true, true)).toBe(false);
    expect(canUpload(file, true, false)).toBe(true);
  });

  it("buildUploadInit returns POST with a FormData body (file, alt, rightsConfirmed 'true') and no headers", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const init = buildUploadInit(file, "Kabel", true);
    expect(init.method).toBe("POST");
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("file")).toBeInstanceOf(File);
    expect(form.get("alt")).toBe("Kabel");
    expect(form.get("rightsConfirmed")).toBe("true");
  });

  it.each([["javascript:alert(1)"], ["http://example.com"], [""], [null], [undefined], ["https//x"]])("safeSourceLink(%s) is null", (url) => {
    expect(safeSourceLink(url)).toBeNull();
  });

  it("safeSourceLink returns an https URL unchanged", () => {
    expect(safeSourceLink("https://commons.wikimedia.org/wiki/File:X.jpg")).toBe("https://commons.wikimedia.org/wiki/File:X.jpg");
  });

  it("uploadPrecheck: size and type messages in Bahasa", () => {
    expect(uploadPrecheck({ name: "a.jpg", type: "image/jpeg", size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(uploadPrecheck({ name: "a.jpg", type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 })).toBe("Ukuran file maksimal 10 MB.");
    expect(uploadPrecheck({ name: "a.gif", type: "image/gif", size: 10 })).toBe("Format tidak didukung. Gunakan JPG, PNG, atau WebP.");
    expect(uploadPrecheck({ name: "a.svg", type: "image/svg+xml", size: 10 })).toBe("Format tidak didukung. Gunakan JPG, PNG, atau WebP.");
    expect(uploadPrecheck({ name: "IMG_1.HEIC", type: "", size: 10 })).toBe("Foto iPhone (HEIC) belum didukung. Ekspor sebagai JPG lalu unggah lagi.");
    expect(uploadPrecheck({ name: "a.png", type: "image/png", size: 10 })).toBeNull();
    expect(uploadPrecheck({ name: "a.webp", type: "image/webp", size: 10 })).toBeNull();
  });

  it("Review Focus 5: photoSrcSet returns undefined for an empty or missing srcset, and photoForVariant tolerates a product without images", () => {
    expect(photoSrcSet({ ...image("a"), srcset: "" })).toBeUndefined();
    expect(photoSrcSet({ ...image("a"), srcset: undefined as unknown as string })).toBeUndefined();
    expect(() => photoForVariant(product(undefined), "B01-1M")).not.toThrow();
    expect(photoForVariant(product(undefined), "nope")).toBeNull();
  });
});

describe("photo manager state helpers (always applied to the latest list)", () => {
  const img = (id: string, position: number, alt = `Foto ${id}`) => ({ id, position, alt });
  const product = () => ({
    images: [img("a", 0), img("b", 1), img("c", 2)],
    variants: [{ sku: "V1", label: "1 m", imageId: "b" as string | null }, { sku: "V2", label: "2 m", imageId: null as string | null }],
  });

  it("applyOrder keeps the latest objects (a newer alt survives), renumbers, and drops ids no longer present", () => {
    const latest = withImagePatched(product().images, "a", { alt: "Alt baru" });
    const ordered = applyOrder(latest, ["c", "gone", "a", "b"]);
    expect(ordered.map((i) => [i.id, i.position, i.alt])).toEqual([["c", 0, "Foto c"], ["a", 1, "Alt baru"], ["b", 2, "Foto b"]]);
  });

  it("applyOrder keeps photos missing from the id list at the end instead of losing them", () => {
    expect(applyOrder(product().images, ["b", "a"]).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("withImageAdded appends once and renumbers; withImageRemoved renumbers and clears variant links", () => {
    const added = withImageAdded(product().images, img("d", 9));
    expect(added.map((i) => [i.id, i.position])).toEqual([["a", 0], ["b", 1], ["c", 2], ["d", 3]]);
    expect(withImageAdded(added, img("d", 9))).toHaveLength(4);
    const removed = withImageRemoved(product(), "b");
    expect(removed.images.map((i) => [i.id, i.position])).toEqual([["a", 0], ["c", 1]]);
    expect(removed.variants.map((v) => v.imageId)).toEqual([null, null]);
  });

  it("nextAnnouncement makes a repeated message differ so the live region speaks it again", () => {
    const first = nextAnnouncement("", "Foto dijadikan utama");
    const second = nextAnnouncement(first, "Foto dijadikan utama");
    expect(first.trim()).toBe("Foto dijadikan utama");
    expect(second).not.toBe(first);
    expect(second.replace(/\u00A0/g, "").trim()).toBe("Foto dijadikan utama");
    expect(nextAnnouncement(second, "Foto dihapus. 2 foto tersisa")).toBe("Foto dihapus. 2 foto tersisa");
  });
});
