/**
 * Demo search (P8): normalisation + synonym map from MOCK_DATA_CONTRACT, all-words match,
 * length tokens ("2m", "2 m") become a length filter. Production search = Agent 02.
 */
import type { Product } from "./types";

const CATEGORY_WORDS: Record<string, string> = {
  kabel: "kabel cable", charger: "charger pengisi daya", adaptor: "adaptor adapter", hub: "hub dock",
};

export function normalise(s: string): string {
  return (" " + s.toLowerCase() + " ")
    .replace(/usb[\s-]?type[\s-]?c|type[\s-]?c|usb[\s-]?c|usbc/g, "usb-c")
    .replace(/(\d)\s?m\b/g, "$1m")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SearchResult {
  products: Product[];
  lengthM: number | null;
  synonymApplied: boolean;
}

export function search(products: Product[], query: string): SearchResult {
  const nq = normalise(query);
  const synonymApplied = /usb-c/.test(nq) && !/usb-c/.test(query.toLowerCase());
  let lengthM: number | null = null;
  const words: string[] = [];
  for (const t of nq.split(" ")) {
    const m = t.match(/^(\d)m$/);
    if (m) lengthM = Number(m[1]);
    else if (t) words.push(t);
  }
  if (!nq) return { products: [], lengthM, synonymApplied };
  const hits = products.filter((p) => {
    const index = normalise(`${p.name} ${p.spec ?? ""} ${CATEGORY_WORDS[p.categoryId] ?? p.categoryId} ${(p.tags ?? []).join(" ")}`);
    if (!words.every((w) => index.includes(w))) return false;
    if (lengthM === null) return true;
    return p.variants.some((v) => v.attrs?.lengthM === lengthM);
  });
  return { products: hits, lengthM, synonymApplied };
}
