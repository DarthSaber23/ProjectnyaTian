/**
 * Shows the shop at once, then loads the catalogue. The session restore waits for the catalogue
 * because the saved cart is merged against it, and runs even if the catalogue fails.
 */
export function bootShop(deps: { show: () => void; loadCatalog: () => Promise<void>; restoreSession: () => Promise<void> }): void {
  deps.show();
  void deps.loadCatalog()
    .catch(() => undefined)
    .then(() => deps.restoreSession())
    .catch(() => undefined);
}

export function pageAvailability(loading: boolean, found: boolean): "loading" | "missing" | "ready" {
  if (found) return "ready";
  if (loading) return "loading";
  return "missing";
}
