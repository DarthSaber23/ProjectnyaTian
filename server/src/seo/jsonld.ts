/** schema.org structured data (spec section 5). Plain objects; head.ts serialises them safely. */

const CONTEXT = "https://schema.org";

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
  };
}

export function articleJsonLd(a: { headline: string; description: string; url: string; image?: string; datePublished: string; dateModified: string; author: string; publisher: string; lang: string }) {
  return {
    "@context": CONTEXT,
    "@type": "BlogPosting",
    headline: a.headline,
    description: a.description,
    ...(a.image ? { image: [a.image] } : {}),
    datePublished: a.datePublished,
    dateModified: a.dateModified,
    author: { "@type": "Person", name: a.author },
    publisher: { "@type": "Organization", name: a.publisher },
    mainEntityOfPage: a.url,
    inLanguage: a.lang,
  };
}

export function productJsonLd(p: { name: string; description: string; url: string; images: string[]; sku: string; brand: string; price: number; inStock: boolean }) {
  return {
    "@context": CONTEXT,
    "@type": "Product",
    name: p.name,
    description: p.description,
    ...(p.images.length ? { image: p.images } : {}),
    sku: p.sku,
    brand: { "@type": "Brand", name: p.brand },
    offers: { "@type": "Offer", priceCurrency: "IDR", price: p.price, availability: `https://schema.org/${p.inStock ? "InStock" : "OutOfStock"}`, url: p.url },
  };
}

export function collectionJsonLd(c: { name: string; description: string; url: string; items: { name: string; url: string }[] }) {
  return {
    "@context": CONTEXT,
    "@type": "CollectionPage",
    name: c.name,
    description: c.description,
    url: c.url,
    mainEntity: { "@type": "ItemList", itemListElement: c.items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, url: item.url })) },
  };
}
