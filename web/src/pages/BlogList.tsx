import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArticleCard, FeaturedArticle } from "../components/ArticleCard";
import { blogUrl } from "../domain/articles";
import type { Lang, PublicArticleCard } from "../services/contracts";
import { backend } from "../services/http/backend";
import { useBrand } from "../store/hooks";

/** What each store writes about, for the line under the heading. */
const TOPIC: Record<string, string> = { sambung: "aksesori komputer", halimun: "perawatan kulit" };

const COPY = {
  id: { intro: (brand: string, topic?: string) => `Panduan dan tips ${topic ? `${topic} ` : ""}dari ${brand}.`, empty: "Belum ada artikel.", loading: "Memuat artikel…", failed: "Artikel belum bisa dimuat.", retry: "Coba lagi", pages: "Halaman blog" },
  en: { intro: (brand: string) => `Guides and tips from ${brand}.`, empty: "No articles yet.", loading: "Loading articles…", failed: "Articles could not be loaded.", retry: "Try again", pages: "Blog pages" },
} as const;

/** Every state fills at least one screen, so the footer starts below the fold and does not jump when content arrives (CLS). */
const FRAME = "min-h-[100svh]";

type State = { status: "loading" } | { status: "failed" } | { status: "ready"; page: number; pages: number; items: PublicArticleCard[] };

/** `/blog` and `/en/blog` (spec section 6, layout B): on page 1 the newest article featured, then a grid; 12 per page. */
export function BlogList({ lang }: { lang: Lang }) {
  const brand = useBrand();
  const copy = COPY[lang];
  const [params] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    backend.articles(lang, page).then(
      (list) => { if (live) setState({ status: "ready", ...list }); },
      () => { if (live) setState({ status: "failed" }); },
    );
    return () => { live = false; };
  }, [lang, page, attempt]);

  // Layout scrolls to the top on a path change only; a page-number change is a query change.
  const shownPage = useRef(page);
  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    window.scrollTo(0, 0);
  }, [page]);

  const featured = state.status === "ready" && state.page === 1 ? state.items[0] : undefined;
  const grid = state.status === "ready" ? (featured ? state.items.slice(1) : state.items) : [];

  return (
    <div lang={lang} className={`${FRAME} flex flex-col gap-6`}>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold md:text-4xl">Blog</h1>
        <p className="text-[16px] text-muted">{copy.intro(brand.name, TOPIC[brand.id])}</p>
      </header>

      {state.status === "loading" ? <p className="text-sm text-muted" role="status">{copy.loading}</p> : null}
      {state.status === "failed" ? (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p>{copy.failed}</p>
          <button type="button" className="btn-secondary" onClick={() => setAttempt((n) => n + 1)}>{copy.retry}</button>
        </div>
      ) : null}
      {state.status === "ready" && state.items.length === 0 ? <p className="text-muted">{copy.empty}</p> : null}

      {featured ? <FeaturedArticle card={featured} lang={lang} /> : null}
      {grid.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {grid.map((c) => <ArticleCard key={c.id} card={c} lang={lang} headingLevel={2} />)}
        </div>
      ) : null}

      {state.status === "ready" && state.pages > 1 ? (
        <nav aria-label={copy.pages} className="flex flex-wrap gap-2">
          {Array.from({ length: state.pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} to={blogUrl(lang, n)} aria-current={n === state.page ? "page" : undefined} className={`inline-flex h-11 min-w-[44px] items-center justify-center ${n === state.page ? "chip-on" : "chip-off"}`}>
              {n}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
