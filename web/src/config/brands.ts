/**
 * Brand configuration. A client fork normally keeps ONE brand and edits this file
 * (tokens mirror /tokens/brand-a.json and brand-b.json from M3).
 * Names are working names, NOT trademark-screened (D15).
 */
import type { BrandId } from "../domain/types";

export interface BrandConfig {
  id: BrandId;
  name: string;
  wordmark: string;
  tagline: string;
  /** Colours as hex; converted to RGB CSS variables at runtime. */
  colors: Record<
    "bg" | "surface" | "alt" | "text" | "muted" | "border" | "border-strong" | "primary" | "primary-soft" | "primary-ink" |
    "accent" | "on-accent" | "success" | "warning" | "danger" | "focus",
    string
  >;
  fonts: { display: string; body: string; mono: string };
  radius: string;
  radiusControl: string;
  /** Prototype limit for lines whose stock is not specified in W00 (P6). */
  maxQtyPerLine: number;
  features: { compare: boolean; concerns: boolean; filterLayout: "sidebar" | "topbar" };
  copy: { heroTitle: string; heroCta: string };
}

export const BRANDS: Record<BrandId, BrandConfig> = {
  sambung: {
    id: "sambung",
    name: "Sambung",
    wordmark: "SAMBUNG/",
    tagline: "Aksesori komputer dengan spesifikasi yang jelas",
    colors: {
      bg: "#FFFFFF", surface: "#FFFFFF", alt: "#F2F4F7", text: "#0E1726", muted: "#4A5568", border: "#CBD2DC", "border-strong": "#7D8796",
      primary: "#1F5AE0", "primary-soft": "#EAF0FD", "primary-ink": "#1747B5", accent: "#F5A524", "on-accent": "#0E1726",
      success: "#1E7A45", warning: "#8A5300", danger: "#C0262D", focus: "#1F5AE0",
    },
    fonts: { display: "'Space Grotesk', system-ui, sans-serif", body: "'IBM Plex Sans', system-ui, sans-serif", mono: "'JetBrains Mono', ui-monospace, monospace" },
    radius: "6px",
    radiusControl: "6px",
    maxQtyPerLine: 99,
    features: { compare: true, concerns: false, filterLayout: "sidebar" },
    copy: { heroTitle: "Kabel, charger, dan hub yang cocok dengan perangkatmu", heroCta: "Lihat semua produk" },
  },
  halimun: {
    id: "halimun",
    name: "Halimun",
    wordmark: "halimun",
    tagline: "Perawatan kulit sederhana sesuai kebutuhan",
    colors: {
      bg: "#F7F4EF", surface: "#FFFFFF", alt: "#EFE6DC", text: "#23201D", muted: "#6B625A", border: "#D9CFC4", "border-strong": "#8C8279",
      primary: "#4F6B57", "primary-soft": "#E7EEE8", "primary-ink": "#2F4A37", accent: "#8C3B2E", "on-accent": "#FFFFFF",
      success: "#2F6B3F", warning: "#8A5300", danger: "#A3302A", focus: "#2B5FA8",
    },
    fonts: { display: "'Newsreader', Georgia, serif", body: "'Figtree', system-ui, sans-serif", mono: "'Figtree', system-ui, sans-serif" },
    radius: "16px",
    radiusControl: "999px",
    maxQtyPerLine: 10,
    features: { compare: false, concerns: true, filterLayout: "topbar" },
    copy: { heroTitle: "Rutinitas sederhana, dipilih sesuai kebutuhan kulit", heroCta: "Lihat semua produk" },
  },
};

function hexToRgb(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Invalid colour token ${hex}`);
  const n = parseInt(m[1]!, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Writes brand tokens as CSS custom properties on <html>. */
export function applyBrand(brand: BrandConfig, root: HTMLElement = document.documentElement): void {
  for (const [k, v] of Object.entries(brand.colors)) root.style.setProperty(`--c-${k}`, hexToRgb(v));
  root.style.setProperty("--font-display", brand.fonts.display);
  root.style.setProperty("--font-body", brand.fonts.body);
  root.style.setProperty("--font-mono", brand.fonts.mono);
  root.style.setProperty("--radius", brand.radius);
  root.style.setProperty("--radius-ctl", brand.radiusControl);
  root.dataset.brand = brand.id;
}

export const DEFAULT_BRAND: BrandId = import.meta.env.VITE_BRAND === "halimun" ? "halimun" : "sambung";
/** Demo tools (brand switch, reset, payment simulator). Must be false in a client deployment. */
export const DEMO_TOOLS = import.meta.env.VITE_DEMO_TOOLS !== "false";
