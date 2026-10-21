import { useEffect, useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatIDR } from "../domain/money";
import type { ArtKind } from "../domain/types";
import { useShop } from "../store/shop";

/** Original placeholder illustration (no product photos in the starter). Decorative: alt via label. */
export function ProductArt({ kind, bg, accent, label, className = "" }: { kind: ArtKind; bg: string; accent: string; label: string; className?: string }) {
  const ink = "#1A2233";
  const shape: Record<ArtKind, ReactNode> = {
    cable: (<><path d="M30 70 C30 40, 70 40, 70 30" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" /><rect x="22" y="68" width="16" height="14" rx="3" fill={ink} /><rect x="62" y="18" width="16" height="14" rx="3" fill={ink} /></>),
    charger: (<><rect x="30" y="28" width="40" height="44" rx="8" fill={ink} /><rect x="38" y="40" width="10" height="4" rx="2" fill={accent} /><rect x="52" y="40" width="10" height="4" rx="2" fill={accent} /><rect x="42" y="54" width="16" height="5" rx="1" fill="#fff" /></>),
    adapter: (<><rect x="24" y="40" width="52" height="20" rx="6" fill={ink} /><rect x="76" y="45" width="10" height="10" rx="2" fill={accent} /><path d="M24 50 H12" stroke={accent} strokeWidth="4" strokeLinecap="round" /></>),
    hub: (<><rect x="18" y="38" width="64" height="24" rx="6" fill={ink} />{[26, 38, 50, 62].map((x) => <rect key={x} x={x} y="47" width="8" height="6" rx="1" fill={accent} />)}</>),
    bottle: (<><rect x="38" y="20" width="24" height="10" rx="2" fill={ink} /><rect x="30" y="30" width="40" height="52" rx="10" fill="#fff" stroke={ink} strokeWidth="2" /><rect x="36" y="48" width="28" height="12" rx="2" fill={accent} /></>),
    jar: (<><rect x="26" y="34" width="48" height="12" rx="3" fill={ink} /><rect x="24" y="46" width="52" height="34" rx="8" fill="#fff" stroke={ink} strokeWidth="2" /><rect x="34" y="56" width="32" height="10" rx="2" fill={accent} /></>),
    tube: (<><path d="M34 22 H66 L60 74 H40 Z" fill="#fff" stroke={ink} strokeWidth="2" /><rect x="42" y="74" width="16" height="8" rx="2" fill={ink} /><rect x="40" y="36" width="20" height="14" rx="2" fill={accent} /></>),
    dropper: (<><rect x="44" y="14" width="12" height="16" rx="5" fill={ink} /><rect x="34" y="30" width="32" height="50" rx="8" fill="#fff" stroke={ink} strokeWidth="2" /><rect x="40" y="48" width="20" height="12" rx="2" fill={accent} /></>),
  };
  return (
    <div className={`flex aspect-square w-full items-center justify-center ${className}`} style={{ background: bg }} role="img" aria-label={`Ilustrasi ${label}`}>
      <svg viewBox="0 0 100 100" className="h-3/5 w-3/5" aria-hidden="true">{shape[kind]}</svg>
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
