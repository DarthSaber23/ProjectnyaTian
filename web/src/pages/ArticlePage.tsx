import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ARTICLE_SIZES, ArticleCover } from "../components/ArticleCard";
import { ProductCard } from "../components/ProductCard";
import { articleDate, articleUrl, blogUrl, readingLabel } from "../domain/articles";
import type { Product } from "../domain/types";
import type { Lang, PublicArticle } from "../services/contracts";
import { backend } from "../services/http/backend";
import { useCatalog } from "../store/hooks";
import { NotFound } from "./NotFound";

const COPY = {
  id: { home: "Beranda", products: "Produk di artikel ini", other: "English version", loading: "Memuat artikel…", failed: "Artikel belum bisa dimuat.", retry: "Coba lagi" },
  en: { home: "Home", products: "Products in this article", other: "Read in Bahasa Indonesia", loading: "Loading article…", failed: "The article could not be loaded.", retry: "Try again" },
} as const;

/** Every state fills at least one screen, so the footer starts below the fold and does not jump when content arrives (CLS). */
const FRAME = "min-h-[100svh]";

type State = { status: "loading" } | { status: "failed" } | { status: "missing" } | { status: "ready"; article: PublicArticle };

/** `/blog/{slug}` and `/en/blog/{slug}` (spec section 6, layout A): article, then its products as cards. */
export function ArticlePage({ lang }: { lang: Lang }) {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { products } = useCatalog();
  const copy = COPY[lang];
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    backend.article(lang, slug).then(
      (article) => {
        if (!live) return;
        if (!article) return setState({ status: "missing" });
        // A renamed slug: the server answered for the current one, so show that URL.
        if (article.slug !== slug) navigate(articleUrl(lang, article.slug), { replace: true });
        setState({ status: "ready", article });
      },
      () => { if (live) setState({ status: "failed" }); },
    );
    return () => { live = false; };
  }, [lang, slug, attempt, navigate]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const previous = document.title;
    document.title = state.article.seoTitle;
    return () => { document.title = previous; };
  }, [state]);

  if (state.status === "missing") return <div lang={lang} className={`${FRAME} `}><NotFound /></div>;
  if (state.status === "loading") return <div lang={lang} className={`${FRAME} text-sm text-muted`} role="status">{copy.loading}</div>;
  if (state.status === "failed") {
    return (
      <div lang={lang} className={`${FRAME} flex flex-col items-start gap-3`} role="alert">
        <p>{copy.failed}</p>
        <button type="button" className="btn-secondary" onClick={() => setAttempt((n) => n + 1)}>{copy.retry}</button>
      </div>
    );
  }

  const { article } = state;
  // Cards use the live catalogue (price, stock, photos); products no longer for sale drop out.
  const linked = article.products.map((p) => products.find((c) => c.id === p.id)).filter((p): p is Product => Boolean(p));
  const other = article.otherLang;

  return (
    <div lang={lang} className={`${FRAME} flex flex-col gap-10`}>
      <article className="mx-auto flex w-full max-w-[768px] flex-col gap-5">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
          <ol className="flex flex-wrap gap-1.5">
            <li><Link to="/" className="underline">{copy.home}</Link> /</li>
            <li><Link to={blogUrl(lang, 1)} className="underline">Blog</Link> /</li>
            <li aria-current="page" className="text-ink">{article.title}</li>
          </ol>
        </nav>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold leading-tight md:text-[2.5rem]">{article.title}</h1>
          <p className="text-[14px] text-muted">
            <time dateTime={article.publishedAt}>{articleDate(article.publishedAt, lang)}</time> · {readingLabel(article.readingMinutes, lang)}
          </p>
          {other ? (
            <Link to={articleUrl(other.lang, other.slug)} hrefLang={other.lang} lang={other.lang} className="self-start text-[14px] font-semibold text-primary-ink underline">{copy.other}</Link>
          ) : null}
        </header>
        {article.cover ? <ArticleCover image={article.cover} sizes={ARTICLE_SIZES.article} priority className="rounded-brand" /> : null}
        <div className="article-body" dangerouslySetInnerHTML={{ __html: article.html }} />
      </article>

      {linked.length > 0 ? (
        <section aria-labelledby="article-products-h" className="flex flex-col gap-3">
          <h2 id="article-products-h" className="text-2xl font-semibold">{copy.products}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {linked.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
