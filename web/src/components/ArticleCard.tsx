import { useState } from "react";
import { Link } from "react-router-dom";
import { articleDate, articleUrl, readingLabel } from "../domain/articles";
import { fetchPriorityAttr, photoSrcSet } from "../domain/photos";
import type { ProductImage } from "../domain/types";
import type { Lang, PublicArticleCard } from "../services/contracts";
import { ProductPhoto } from "./ProductPhoto";

/** `sizes` per place, matching each 16:9 frame's rendered width. */
export const ARTICLE_SIZES = {
  grid: "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw",
  featured: "(min-width: 768px) 50vw, 100vw",
  article: "(min-width: 816px) 768px, 100vw",
} as const;

/** The product square inside a 16:9 frame is as tall as the frame: about 56% of the frame's width. */
const PRODUCT_IN_FRAME = "(min-width: 1024px) 19vw, (min-width: 768px) 28vw, 56vw";

/**
 * An article cover in a fixed 16:9 frame (no layout shift). Without a cover, or when the file fails to load, the
 * frame shows the article's first product (its photo or drawing) on the brand colour, so it never looks like a
 * broken image; with no product either, a plain brand-coloured panel. `decorative` where the title is text beside it.
 */
export function ArticleCover({ image, product = null, sizes, decorative = false, priority = false, className = "" }: {
  image: ProductImage | null;
  product?: PublicArticleCard["coverProduct"];
  sizes: string;
  decorative?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const show = image && failedSrc !== image.src;
  return (
    <div className={`relative aspect-video w-full overflow-hidden bg-primary-soft ${className}`}>
      {show ? (
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
          onError={() => setFailedSrc(image.src)}
        />
      ) : product ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="aspect-square h-full"><ProductPhoto product={product} image={product.image} sizes={PRODUCT_IN_FRAME} decorative /></div>
        </div>
      ) : null}
    </div>
  );
}

/** Grid card: cover, title, then summary and date unless `compact` (related articles: cover, title, reading time). */
export function ArticleCard({ card, lang, compact = false, headingLevel = 3 }: { card: PublicArticleCard; lang: Lang; compact?: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link to={articleUrl(lang, card.slug)} className="group flex flex-1 flex-col gap-2 pb-4 focus-visible:outline-offset-[-3px]">
        <ArticleCover image={card.cover} product={card.coverProduct} sizes={ARTICLE_SIZES.grid} decorative />
        <Heading className="px-4 pt-2 text-[17px] font-semibold leading-snug group-hover:underline">{card.title}</Heading>
        {compact ? null : <p className="line-clamp-3 px-4 text-[15px] leading-relaxed">{card.summary}</p>}
        <p className="mt-auto px-4 text-[13px] text-muted">
          {compact ? readingLabel(card.readingMinutes, lang) : `${articleDate(card.publishedAt, lang)} · ${readingLabel(card.readingMinutes, lang)}`}
        </p>
      </Link>
    </article>
  );
}

/** The newest article on page 1 of the blog: cover left, text right; stacked on phone. */
export function FeaturedArticle({ card, lang }: { card: PublicArticleCard; lang: Lang }) {
  return (
    <article className="card overflow-hidden">
      <Link to={articleUrl(lang, card.slug)} className="group grid focus-visible:outline-offset-[-3px] md:grid-cols-2">
        <ArticleCover image={card.cover} product={card.coverProduct} sizes={ARTICLE_SIZES.featured} decorative priority />
        <div className="flex flex-col justify-center gap-3 p-5 md:p-8">
          <h2 className="text-2xl font-semibold leading-tight group-hover:underline md:text-3xl">{card.title}</h2>
          <p className="text-[16px] leading-relaxed">{card.summary}</p>
          <p className="text-[13px] text-muted">{articleDate(card.publishedAt, lang)} · {readingLabel(card.readingMinutes, lang)}</p>
        </div>
      </Link>
    </article>
  );
}
