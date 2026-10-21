export function bootShop(deps: { show: () => void; loadCatalog: () => Promise<void> }): void {
  deps.show();
  void deps.loadCatalog().catch(() => undefined);
}

export function pageAvailability(loading: boolean, found: boolean): "loading" | "missing" | "ready" {
  if (found) return "ready";
  if (loading) return "loading";
  return "missing";
}
