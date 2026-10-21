/** Time helpers. All business times are Asia/Jakarta (WIB, UTC+7, no DST). */

const OFFSET_MIN = 7 * 60;

export function addMinutes(iso: string, minutes: number): string {
  return toWibIso(new Date(Date.parse(iso) + minutes * 60_000));
}

/** Format a Date as ISO 8601 with an explicit +07:00 offset. */
export function toWibIso(d: Date): string {
  const local = new Date(d.getTime() + OFFSET_MIN * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}+07:00`
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "20 Okt 2026, 10:21 WIB" */
export function formatWib(iso: string, opts: { withDate?: boolean; withYear?: boolean } = {}): string {
  const { withDate = true, withYear = true } = opts;
  const local = new Date(Date.parse(iso) + OFFSET_MIN * 60_000);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  if (!withDate) return `${hh}:${mm} WIB`;
  const date = `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}${withYear ? " " + local.getUTCFullYear() : ""}`;
  return `${date}, ${hh}:${mm} WIB`;
}

/** YYMMDD in WIB, used by order numbers (I9). */
export function yymmdd(iso: string): string {
  return toWibIso(new Date(Date.parse(iso))).slice(2, 10).replace(/-/g, "");
}

export function isWithin(iso: string, window?: { start: string; end: string }): boolean {
  if (!window) return true;
  const t = Date.parse(iso);
  return t >= Date.parse(window.start) && t <= Date.parse(window.end);
}
