import type { BrandId } from "../domain/types";

const ORIGIN = /^https?:\/\/(\[[0-9a-fA-F:.]+\]|[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?)(:\d{1,5})?$/;

/**
 * The deployment's public identity (spec section 5): one brand per deployment, matching the web build's
 * VITE_BRAND, and the absolute origin used for canonical URLs, the sitemap and Open Graph.
 */
export function siteConfig(): { baseUrl: string; brand: BrandId; verification?: string } {
  const brand = process.env.SITE_BRAND ?? "sambung";
  if (brand !== "sambung" && brand !== "halimun") throw new Error(`SITE_BRAND must be sambung or halimun, got "${brand}"`);
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!configured && process.env.NODE_ENV === "production") throw new Error("PUBLIC_BASE_URL must be set in production, e.g. https://shop.example.com");
  const baseUrl = configured || "http://localhost";
  if (!ORIGIN.test(baseUrl)) throw new Error(`PUBLIC_BASE_URL must be an http(s) origin without a path, got "${baseUrl}"`);
  const verification = process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined;
  return { baseUrl, brand, ...(verification ? { verification } : {}) };
}
