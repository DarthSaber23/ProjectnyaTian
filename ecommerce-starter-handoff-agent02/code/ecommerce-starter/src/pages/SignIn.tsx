import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { DEMO_TOOLS } from "../config/brands";
import { looksLikeEmail, safeNext } from "../domain/auth";
import { formatWib } from "../domain/time";
import { DEMO_LOGIN } from "../mocks/fixtures";
import { backend } from "../services/mock/backend";
import { useShop } from "../store/shop";

const REASONS: Record<string, string> = {
  checkout: "Masuk untuk lanjut checkout. Keranjangmu aman dan akan digabung ke akun.",
  wishlist: "Masuk untuk menyimpan produk ke wishlist (I6).",
  akun: "Masuk untuk melihat akunmu.",
};

export function SignIn() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const reason = REASONS[params.get("alasan") ?? ""];
  const pendingWish = params.get("wish");
  const session = useShop((s) => s.session);
  const signedIn = useShop((s) => s.signedIn);
  const notify = useShop((s) => s.notify);
  const brand = useShop((s) => s.brand);
  const itemCount = useShop((s) => s.cart.reduce((n, l) => n + l.qty, 0));
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  if (session) return <Navigate to={next} replace />;

  const finish = (res: Awaited<ReturnType<typeof backend.signIn>>) => {
    if (res.ok) {
      const { capped } = signedIn(res.session);
      if (pendingWish) backend.toggleWishlist(res.session.customerId, brand, pendingWish);
      notify(
        pendingWish ? "Masuk berhasil · produk disimpan ke wishlist" :
          itemCount ? `Masuk berhasil · keranjang tamu (${itemCount} barang) digabung ke akun${capped ? `, ${capped} barang dibatasi stok` : ""}` : "Masuk berhasil",
      );
      navigate(next, { replace: true });
      return;
    }
    if (res.reason === "locked") {
      setLocked(true);
      setError(`Terlalu banyak percobaan. Coba lagi setelah ${formatWib(res.until, { withDate: false })} atau atur ulang kata sandi.`);
    } else {
      setError(`Email atau kata sandi salah. Sisa ${res.remaining} percobaan.`);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe: typeof fieldError = {};
    if (!looksLikeEmail(email)) fe.email = "Masukkan alamat email yang valid, contoh nama@domain.com.";
    if (!password) fe.password = "Masukkan kata sandi.";
    setFieldError(fe);
    if (fe.email || fe.password) return;
    setBusy(true);
    try { finish(await backend.signIn(email, password)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-3xl font-semibold">Masuk</h1>
      {reason ? <p className="rounded-brand bg-primary-soft p-3 text-sm text-primary-ink">{reason}{params.get("alasan") === "checkout" && itemCount ? ` (${itemCount} barang)` : ""}</p> : null}
      <form onSubmit={submit} noValidate className="card flex flex-col gap-3 p-5">
        <label htmlFor="email" className="text-sm font-semibold">Email</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldError.email} aria-describedby={fieldError.email ? "email-err" : undefined}
          className={`min-h-[44px] rounded-ctl border px-3 ${fieldError.email ? "border-2 border-danger" : "border-line-strong"}`} />
        {fieldError.email ? <span id="email-err" className="text-[13px] font-semibold text-danger">{fieldError.email}</span> : null}
        <label htmlFor="password" className="text-sm font-semibold">Kata sandi</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fieldError.password} aria-describedby={fieldError.password ? "pw-err" : undefined}
          className={`min-h-[44px] rounded-ctl border px-3 ${fieldError.password ? "border-2 border-danger" : "border-line-strong"}`} />
        {fieldError.password ? <span id="pw-err" className="text-[13px] font-semibold text-danger">{fieldError.password}</span> : null}
        {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={busy || locked}>{busy ? "Memeriksa…" : "Masuk"}</button>
        <button type="button" className="btn-secondary" disabled={busy || locked} onClick={async () => finish(await backend.signInWithGoogle())}>Lanjut dengan Google (simulasi)</button>
        <span className="text-[13px] text-muted">Lupa kata sandi? Desain pemulihan ada di H15 (belum interaktif). Belum punya akun? Pendaftaran menyusul.</span>
      </form>
      {DEMO_TOOLS ? (
        <section className="sim-panel flex flex-col gap-2 text-[13px]" aria-label="Panel uji masuk">
          <b className="font-mono text-[12px]">PANEL UJI · akun demo fiktif</b>
          <span>Email <code>{DEMO_LOGIN.email}</code> · kata sandi <code>{DEMO_LOGIN.password}</code>. 5 kali salah → terkunci 15 menit (P7).</span>
          <button type="button" className="btn-secondary self-start" onClick={() => { setEmail(DEMO_LOGIN.email); setPassword(DEMO_LOGIN.password); }}>Isi kredensial demo</button>
        </section>
      ) : null}
      <Link to="/" className="text-sm underline">Kembali belanja</Link>
    </div>
  );
}
