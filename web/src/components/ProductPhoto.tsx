import { useState } from "react";
import { fetchPriorityAttr, photoSrcSet } from "../domain/photos";
import type { Product, ProductImage } from "../domain/types";
import { ProductArt } from "./ui";

/**
 * A product photo in the same square frame as the drawing. Falls back to `ProductArt` when there is no photo or
 * the file fails to load. `decorative` where the product name is already text beside it (alt="" and a hidden
 * drawing); otherwise the photo's own alt text, or the drawing's "Ilustrasi {nama}" label.
 */
export function ProductPhoto({ product, image, sizes, decorative = false, priority = false, className = "", onSettled }: {
  product: Pick<Product, "art" | "name">;
  image?: ProductImage | null;
  sizes: string;
  decorative?: boolean;
  priority?: boolean;
  className?: string;
  onSettled?: () => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!image || failedSrc === image.src) {
    return <ProductArt kind={product.art.kind} bg={product.art.bg} accent={product.art.accent} label={product.name} className={className} decorative={decorative} />;
  }
  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-alt ${className}`}>
      <img
        className="absolute inset-0 h-full w-full object-cover"
        loading={priority ? "eager" : "lazy"}
        src={image.src}
        srcSet={photoSrcSet(image)}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={decorative ? "" : image.alt}
        decoding="async"
        {...fetchPriorityAttr(priority ? "high" : undefined)}
        onLoad={() => onSettled?.()}
        onError={() => {
          setFailedSrc(image.src);
          onSettled?.();
        }}
      />
    </div>
  );
}
