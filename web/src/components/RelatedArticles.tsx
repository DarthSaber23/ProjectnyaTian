import { useEffect, useState } from "react";
import type { PublicArticleCard } from "../services/contracts";
import { backend } from "../services/http/backend";
import { ArticleCard } from "./ArticleCard";

/** "Artikel terkait" below a product's specifications: up to 3 live articles that link to it; nothing when none (or on error). */
export function RelatedArticles({ productSlug }: { productSlug: string }) {
  const [cards, setCards] = useState<PublicArticleCard[]>([]);
  useEffect(() => {
    let live = true;
    backend.productArticles(productSlug).then((items) => { if (live) setCards(items.slice(0, 3)); }, () => { if (live) setCards([]); });
    return () => { live = false; };
  }, [productSlug]);
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="related-articles-h" className="mt-10 flex flex-col gap-3">
      <h2 id="related-articles-h" className="text-xl font-semibold">Artikel terkait</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cards.map((c) => <ArticleCard key={c.id} card={c} lang={c.lang} compact />)}
      </div>
    </section>
  );
}
