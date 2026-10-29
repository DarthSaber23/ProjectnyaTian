import { useEffect, useState } from "react";
import { fetchPriorityAttr, galleryPick, photoSizes, photoSrcSet, showThumbnails, thumbLabel } from "../domain/photos";
import type { Product, ProductImage, Variant } from "../domain/types";
import { ProductPhoto } from "./ProductPhoto";

/**
 * Product page photos: the main photo and, once it has loaded, a row of thumbnail buttons. A variant with a linked
 * photo switches the main photo; pressing a thumbnail never changes the variant.
 */
export function ProductGallery({ product, variant }: { product: Product; variant: Variant }) {
  const images = product.images ?? [];
  const [currentId, setCurrentId] = useState<string | null>(() => galleryPick(product, variant, undefined));
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setCurrentId((prev) => galleryPick(product, variant, prev ?? undefined));
  }, [product, variant]);

  const shown = images.find((i) => i.id === currentId) ?? images[0] ?? null;

  return (
    <div className="flex flex-col gap-2">
      <ProductPhoto product={product} image={shown} sizes={photoSizes("productMain")} priority className="rounded-brand" onSettled={() => setSettled(true)} />
      {shown?.sample ? <p className="text-[13px] text-muted">Foto contoh</p> : null}
      {settled && showThumbnails(product) ? (
        <div role="group" aria-label="Galeri foto" className="flex flex-wrap gap-2">
          {images.map((image, i) => {
            const pressed = image.id === shown?.id;
            return (
              <button
                key={image.id}
                type="button"
                aria-pressed={pressed}
                aria-label={thumbLabel(i, images.length)}
                onClick={() => setCurrentId(image.id)}
                className={`h-12 w-12 shrink-0 overflow-hidden rounded ${pressed ? "border-2 border-ink" : "border border-line"}`}
              >
                <Thumb product={product} image={image} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Thumbnails load last and never compete with the main photo; a failed one shows the drawing. */
function Thumb({ product, image }: { product: Product; image: ProductImage }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ProductPhoto product={product} image={null} sizes={photoSizes("productThumb")} decorative />;
  return (
    <img
      className="h-full w-full object-cover"
      loading="lazy"
      src={image.src}
      srcSet={photoSrcSet(image)}
      sizes={photoSizes("productThumb")}
      width={image.width}
      height={image.height}
      alt=""
      decoding="async"
      {...fetchPriorityAttr("low")}
      onError={() => setFailed(true)}
    />
  );
}
