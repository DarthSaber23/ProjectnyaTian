import type { Lang } from "../content/content.types";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** JSON-LD with `<` written as \u003c, so no text can close the script element. */
export function jsonLdScript(data: object): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

export interface HeadInput {
  title: string;
  description: string;
  canonical?: string;
  lang: Lang;
  alternates: { hreflang: string; href: string }[];
  noindex: boolean;
  ogType: "website" | "article" | "product";
  image?: string;
  siteName: string;
  jsonLd: object[];
  verification?: string;
}

/** The tags the server adds to <head> (spec section 5). Every value is escaped. */
export function buildHead(h: HeadInput): string {
  const e = escapeHtml;
  const tags = [
    `<title>${e(h.title)}</title>`,
    `<meta name="description" content="${e(h.description)}">`,
    h.noindex ? '<meta name="robots" content="noindex">' : "",
    h.canonical ? `<link rel="canonical" href="${e(h.canonical)}">` : "",
    ...h.alternates.map((a) => `<link rel="alternate" hreflang="${e(a.hreflang)}" href="${e(a.href)}">`),
    `<meta property="og:type" content="${h.ogType}">`,
    `<meta property="og:title" content="${e(h.title)}">`,
    `<meta property="og:description" content="${e(h.description)}">`,
    h.canonical ? `<meta property="og:url" content="${e(h.canonical)}">` : "",
    `<meta property="og:site_name" content="${e(h.siteName)}">`,
    `<meta property="og:locale" content="${h.lang === "en" ? "en_US" : "id_ID"}">`,
    h.image ? `<meta property="og:image" content="${e(h.image)}">` : "",
    `<meta name="twitter:card" content="${h.image ? "summary_large_image" : "summary"}">`,
    h.verification ? `<meta name="google-site-verification" content="${e(h.verification)}">` : "",
    ...h.jsonLd.map(jsonLdScript),
  ];
  return tags.filter(Boolean).join("\n    ");
}

/** Puts the head tags and the readable page into the built index.html. Throws if the shell is not the app's.
 *  Replacements are functions: a replacement string would expand `$&`, `$'` and `$$` found in titles and text. */
export function injectShell(shell: string, parts: { lang: Lang; head: string; ssr: string }): string {
  if (!shell.includes("</head>") || !shell.includes('<div id="root"></div>')) throw new Error("unexpected shell");
  return shell
    .replace(/<html lang="[^"]*">/, () => `<html lang="${parts.lang}">`)
    .replace(/\s*<title>[\s\S]*?<\/title>/, "")
    .replace("</head>", () => `    ${parts.head}\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root"><div id="ssr">${parts.ssr}</div></div>`);
}
