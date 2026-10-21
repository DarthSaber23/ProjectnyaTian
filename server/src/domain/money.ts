import type { Rupiah } from "./types";

/** "Rp1.250.000" — Indonesian grouping with dots, no decimals, no space (D4). */
export function formatIDR(amount: Rupiah): string {
  assertInteger(amount);
  const sign = amount < 0 ? "−" : "";
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}Rp${digits}`;
}

/** Percentage of a unit price, floored to whole Rupiah (D4: floor per unit). */
export function percentOfUnit(unit: Rupiah, percent: number): Rupiah {
  assertInteger(unit);
  if (percent < 0 || percent > 100) throw new RangeError(`percent out of range: ${percent}`);
  // Integer arithmetic avoids float drift (e.g. 159000 * 0.1).
  return Math.floor((unit * Math.round(percent * 100)) / 10000);
}

/** Unit price after a percentage discount: regular − floor(regular × p%). */
export function discountedUnit(unit: Rupiah, percent: number): Rupiah {
  // Floor the *price* (customer pays the lower whole Rupiah), matching approved boards:
  // 399.000 −25% = 299.250; 399.000 −15% = 339.150.
  return Math.floor((unit * (10000 - Math.round(percent * 100))) / 10000);
}

export function assertInteger(n: number): void {
  if (!Number.isInteger(n)) throw new TypeError(`Money must be an integer Rupiah amount, got ${n}`);
}
