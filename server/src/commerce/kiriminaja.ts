import type { FulfilmentStatus, ShippingQuote } from "../domain/types";
import { shippingQuotes } from "../data/fixtures";

/** Sample district ids from KiriminAja's public pricing example. Not a live coverage claim. */
export const DEMO_ORIGIN_DISTRICT = 5783;
export const DEMO_DESTINATION_DISTRICT = 5507;

export const KIRIMINAJA_DUMMY_API_KEY = "KA-dummy";

export function kiriminAjaApiKey(env: Record<string, string | undefined> = process.env): string {
  return env.KIRIMINAJA_API_KEY?.trim() || KIRIMINAJA_DUMMY_API_KEY;
}

export interface ShippingPriceRequest {
  origin: number;
  destination: number;
  weight: number;
  item_value: number;
  courier?: string[];
}

export interface ShippingPriceResult {
  service: string;
  service_name: string;
  service_type: string;
  cost: string;
  etd: string;
  cod: boolean;
  group: string;
  drop: boolean;
}

/** Response shape of POST /api/mitra/v6.1/shipping_price. Costs are the fictional W00 quotes. */
export function shippingPrice(input: ShippingPriceRequest): { status: boolean; method: string; text: string; results: ShippingPriceResult[] } {
  const wanted = new Set(input.courier ?? []);
  const results = shippingQuotes
    .filter((quote) => quote.cost !== null && (wanted.size === 0 || wanted.has(quote.courierId)))
    .map((quote) => ({
      service: quote.courierId,
      service_name: quote.service,
      service_type: serviceType(quote.courierId),
      cost: String(quote.cost),
      etd: etd(quote.courierId),
      cod: false,
      group: quote.courierId === "kurir-c" ? "express" : "regular",
      drop: true,
    }));
  return { status: true, method: "shipping_price", text: "Success", results };
}

export function toStorefrontQuotes(): ShippingQuote[] {
  const priced = new Map(shippingPrice({ origin: DEMO_ORIGIN_DISTRICT, destination: DEMO_DESTINATION_DISTRICT, weight: 1000, item_value: 0 }).results.map((row) => [row.service, row]));
  return shippingQuotes.map((quote) => {
    const row = priced.get(quote.courierId);
    return row ? { ...quote, cost: Number(row.cost), etaText: `Estimasi ${row.etd} hari`, service: row.service_name } : quote;
  });
}

export type CourierEvent = "processed_packages" | "shipped_packages" | "finished_packages" | "canceled_packages" | "problem_packages";

export function fulfilmentFor(event: CourierEvent, current: FulfilmentStatus): FulfilmentStatus | null {
  if (event === "processed_packages" && (current === "to_process" || current === "awaiting_payment")) return "processing";
  if (event === "shipped_packages" && current === "processing") return "shipped";
  if (event === "shipped_packages" && current === "shipped") return "in_transit";
  if (event === "finished_packages" && (current === "shipped" || current === "in_transit")) return "delivered";
  if (event === "canceled_packages" && current !== "delivered") return "cancelled";
  return null;
}

function serviceType(courierId: string): string {
  if (courierId === "kurir-b") return "HEMAT";
  if (courierId === "kurir-c") return "KILAT";
  return "REG";
}

function etd(courierId: string): string {
  if (courierId === "kurir-b") return "3-5";
  if (courierId === "kurir-c") return "1";
  return "2-3";
}
