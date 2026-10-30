import type { BrandId, Product, ProductImage } from "../domain/types";

export type Lang = "id" | "en";
export type ArticleStatus = "draft" | "published" | "unpublished";

/** One language of an article as the editor sends it. */
export interface ArticleTextInput {
  slug: string;
  title: string;
  seoTitle?: string | null;
  metaDescription: string;
  summary: string;
  body: string;
  noindex: boolean;
  canonicalUrl?: string | null;
}

/** Admin view of an article. */
export interface ArticleView {
  id: string;
  store: BrandId;
  status: ArticleStatus;
  publishAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  version: number;
  authorId: string;
  authorName: string;
  cover: (ProductImage & { alt: string }) | null;
  tags: string[];
  sample: boolean;
  texts: Partial<Record<Lang, ArticleTextInput>>;
  productIds: string[];
  live: boolean;
}

/** Card on /blog, "Artikel terkait" and "Dari blog". */
export interface PublicArticleCard {
  id: string;
  lang: Lang;
  slug: string;
  title: string;
  summary: string;
  cover: ProductImage | null;
  readingMinutes: number;
  publishedAt: string;
}

/** A live article for its page. */
export interface PublicArticle extends PublicArticleCard {
  seoTitle: string;
  metaDescription: string;
  html: string;
  plain: string;
  noindex: boolean;
  canonicalUrl: string | null;
  updatedAt: string;
  authorName: string;
  otherLang: { lang: Lang; slug: string } | null;
  products: Product[];
}
