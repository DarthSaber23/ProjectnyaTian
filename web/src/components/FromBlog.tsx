import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PublicArticleCard } from "../services/contracts";
import { backend } from "../services/http/backend";
import { ArticleCard } from "./ArticleCard";

/** "Dari blog" on the home page: the 3 newest live articles; nothing when there are none (or on error). */
export function FromBlog() {
  const [cards, setCards] = useState<PublicArticleCard[]>([]);
  useEffect(() => {
    let live = true;
    backend.articles("id", 1).then((list) => { if (live) setCards(list.items.slice(0, 3)); }, () => { if (live) setCards([]); });
    return () => { live = false; };
  }, []);
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="blog-h" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="blog-h" className="text-2xl font-semibold">Dari blog</h2>
        <Link to="/blog" className="btn-ghost">Lihat semua artikel</Link>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cards.map((c) => <ArticleCard key={c.id} card={c} lang="id" />)}
      </div>
    </section>
  );
}
