import { Link } from "react-router-dom";
import { bestUnitPrice } from "../domain/pricing";
import { available } from "../domain/stock";
import type { Product } from "../domain/types";
import { categories } from "../mocks/fixtures";
import { backend } from "../services/http/backend";
import { useBrand, useCatalog, useProductView } from "../store/hooks";
import { useShop } from "../store/shop";
import { photoSizes } from "../domain/photos";
import { ProductPhoto } from "./ProductPhoto";
import { Badge, PriceBlock } from "./ui";

/** `lengthM` (from search) shows the matching length variant's price and stock. */
export function ProductCard({ product, lengthM, sizes = photoSizes("homeCard") }: { product: Product; lengthM?: number; sizes?: string }) {
  const view = useProductView(product);
  const brand = useBrand();
  const { catalog, promotions } = useCatalog();
  const inCompare = useShop((s) => s.compare.includes(product.id));
  const toggleCompare = useShop((s) => s.toggleCompare);
  const multi = product.variants.length > 1;
  const lenVariant = lengthM && multi ? product.variants.find((v) => v.attrs?.lengthM === lengthM && available(catalog, v.sku) > 0) ?? product.variants.find((v) => v.attrs?.lengthM === lengthM) : undefined;
  const lenPrice = lenVariant ? bestUnitPrice(catalog, promotions, lenVariant.sku, backend.now()).unit : undefined;
  const stock =
    view.totalAvailable === 0 ? { t: "Stok habis", c: "text-danger" }
      : multi ? { t: `${view.inStockVariants} dari ${product.variants.length} varian`, c: "text-success" }
        : view.totalAvailable <= 10 ? { t: `Sisa ${view.totalAvailable}`, c: "text-warning" } : { t: "Tersedia", c: "text-success" };
  const category = categories.find((c) => c.id === product.categoryId)?.name;
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link to={`/produk/${product.slug}`} className="group flex flex-1 flex-col gap-1.5 pb-3 focus-visible:outline-offset-[-3px]">
        <ProductPhoto product={product} image={product.images?.[0]} sizes={sizes} decorative />
        <span className="flex min-h-[22px] gap-1 px-3 pt-1">{view.badge ? <Badge text={view.badge.text} tone={view.badge.tone} /> : null}</span>
        <span className="px-3 text-[12px] text-muted">{category}</span>
        <h3 className="px-3 font-body text-[15px] font-semibold leading-snug group-hover:underline">{product.name}</h3>
        <span className="px-3">
          {lenVariant && lenPrice !== undefined ? <PriceBlock price={lenPrice} /> : <PriceBlock price={view.fromPrice} was={view.wasPrice} from={multi && new Set(product.variants.map((v) => v.price)).size > 1} />}
        </span>
        <span className={`px-3 text-[12.5px] font-semibold ${stock.c}`}>{lenVariant ? `${lenVariant.label} · ${available(catalog, lenVariant.sku) ? `sisa ${available(catalog, lenVariant.sku)}` : "habis"}` : stock.t}</span>
      </Link>
      {brand.features.compare ? (
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 border-t border-line px-3 text-[13px] font-semibold">
          <input type="checkbox" checked={inCompare} onChange={() => toggleCompare(product.id)} className="h-5 w-5" />
          Bandingkan<span className="sr-only"> {product.name}</span>
        </label>
      ) : null}
    </article>
  );
}
