import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal (WCAG 2.1.2 / 2.4.3): moves focus in, traps Tab/Shift+Tab, closes on Escape,
 * returns focus to the element that opened it, and hides the page behind from pointer use.
 */
export function Dialog({ titleId, onClose, children, placement = "center" }: { titleId: string; onClose: () => void; children: ReactNode; placement?: "center" | "sheet" }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = box.current;
    const focusables = () => (el ? [...el.querySelectorAll<HTMLElement>(FOCUSABLE)] : []);
    (el?.querySelector<HTMLElement>("[autofocus]") ?? focusables()[0] ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) { e.preventDefault(); return; }
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);
  return (
    <div className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/50 ${placement === "sheet" ? "items-end md:items-center md:p-4" : "items-start p-4 pt-16"}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`flex w-full max-w-lg flex-col gap-3 bg-surface p-5 ${placement === "sheet" ? "rounded-t-brand md:rounded-brand" : "rounded-brand border border-line"}`}>
        {children}
      </div>
    </div>
  );
}
