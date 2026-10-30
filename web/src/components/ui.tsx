import { useEffect, useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatIDR } from "../domain/money";
import type { ArtKind } from "../domain/types";
import { useShop } from "../store/shop";

/** Specimen fallback presentation, shown when a product has no photo. `decorative` hides it when the name is already beside it. */
export function ProductArt({ kind, bg, accent, label, className = "", decorative = false }: { kind: ArtKind; bg: string; accent: string; label: string; className?: string; decorative?: boolean }) {
  const shortKind = kind.toUpperCase();
  return (
    <div
      className={`relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden border border-line/40 p-4 transition-all ${className}`}
      style={{ background: bg || "var(--c-alt)" }}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `Spesimen ${label}` })}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-current opacity-30" style={{ color: accent }}>
        <span className="font-mono text-xs font-bold uppercase">{shortKind.slice(0, 2)}</span>
      </div>
      <span className="mt-3 font-mono text-[11px] font-medium uppercase tracking-widest opacity-60" style={{ color: accent }}>
        {kind}
      </span>
      <span className="mt-1 line-clamp-1 max-w-[85%] text-center font-display text-[12px] opacity-75">
        {label}
      </span>
    </div>
  );
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`money ${className}`}>{formatIDR(value)}</span>;
}

export function PriceBlock({ price, was, from, size = "md" }: { price: number; was?: number; from?: boolean; size?: "md" | "lg" }) {
  return (
    <span className="flex flex-wrap items-baseline gap-2">
      <span className={`money font-semibold ${size === "lg" ? "text-2xl" : "text-base"}`}>{from ? "mulai " : ""}{formatIDR(price)}</span>
      {was && was > price ? <s className="text-sm text-muted"><span className="sr-only">harga sebelumnya </span>{formatIDR(was)}</s> : null}
    </span>
  );
}

export function Badge({ text, tone }: { text: string; tone: "flash" | "strike" | "promo" | "neutral" }) {
  const cls = { flash: "bg-accent text-on-accent", strike: "bg-primary-soft text-primary-ink", promo: "bg-accent text-on-accent", neutral: "bg-alt text-ink" }[tone];
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold tracking-wide ${cls}`}>{text}</span>;
}

export function StockNote({ available, low = 10 }: { available: number; low?: number }) {
  if (available <= 0) return <span className="text-[13px] font-semibold text-danger">Stok habis</span>;
  if (available <= low) return <span className="text-[13px] font-semibold text-warning">Sisa {available}</span>;
  return <span className="text-[13px] font-semibold text-success">Tersedia</span>;
}

export function QtyStepper({ value, min = 1, max, onChange, label }: { value: number; min?: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-ctl border border-line-strong" role="group" aria-label={label}>
      <button type="button" className="h-11 w-11 text-lg" aria-label={`Kurangi ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span className="money min-w-[2rem] text-center" aria-live="polite">{value}</span>
      <button type="button" className="h-11 w-11 text-lg" aria-label={`Tambah ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

export function RadioCard({ name, checked, disabled, onChange, children, aside }: { name: string; checked: boolean; disabled?: boolean; onChange: () => void; children: ReactNode; aside?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-center gap-3 rounded-brand p-3.5 ${disabled ? "cursor-not-allowed border border-dashed border-line text-muted" : checked ? "border-2 border-primary bg-primary-soft" : "border border-line-strong bg-surface"}`}>
      <input id={id} type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="h-5 w-5 accent-[rgb(var(--c-primary))]" />
      <span className="flex flex-1 flex-col gap-0.5">{children}</span>
      {aside}
    </label>
  );
}

export function SimBadge() {
  return <span className="rounded bg-[#FDF1DC] px-1.5 py-0.5 text-[11px] font-bold text-warning">SIMULASI</span>;
}

export function Toaster() {
  const toast = useShop((s) => s.toast);
  const dismiss = useShop((s) => s.dismissToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-3 bottom-24 z-50 flex justify-center md:bottom-6">
      {toast ? (
        <div className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-brand px-4 py-3 text-sm text-white shadow-lg ${toast.tone === "error" ? "bg-danger" : "bg-ink"}`}>
          <span>{toast.text}</span>
          {toast.action ? <Link to={toast.action.to} onClick={dismiss} className="font-semibold underline">{toast.action.label}</Link> : null}
          <button type="button" aria-label="Tutup notifikasi" onClick={dismiss} className="ml-1 h-8 w-8">✕</button>
        </div>
      ) : null}
    </div>
  );
}
