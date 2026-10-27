/**
 * Cache-Control for every API response. Only reads that are the same for every visitor may be reused;
 * anything personal, admin, session or a write is never stored by a browser or proxy (PII).
 * Catalogue stock may then lag about a minute on screen; checkout re-checks it under lock.
 */
export const NO_STORE = "private, no-store";
const CATALOGUE = /^\/v1\/(catalog|promotions\/active|products\/[^/]+)$/;
const CONTENT = /^\/v1\/pages(\/[^/]+)?$/;

export function cachePolicy(method: string, path: string): string {
  const read = method === "GET" || method === "HEAD";
  if (read && CATALOGUE.test(path)) return "public, max-age=15, stale-while-revalidate=45";
  if (read && CONTENT.test(path)) return "public, max-age=300";
  return NO_STORE;
}
