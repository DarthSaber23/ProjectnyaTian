import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { DEMO_TOOLS } from "../config/brands";
import { looksLikeEmail, safeNext } from "../domain/auth";
import { formatWib } from "../domain/time";
import { DEMO_LOGIN } from "../mocks/fixtures";
import { ApiError } from "../services/http/client";
import { SIGN_IN_UNAVAILABLE, backend } from "../services/http/backend";
import { useShop } from "../store/shop";
import { PasswordInput } from "../components/PasswordInput";
import { Dialog } from "../components/Dialog";

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

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<{ name?: string; email?: string; password?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

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

  const submitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe: typeof fieldError = {};
    if (!looksLikeEmail(email)) fe.email = "Masukkan alamat email yang valid, contoh nama@domain.com.";
    if (!password) fe.password = "Masukkan kata sandi.";
    setFieldError(fe);
    if (fe.email || fe.password) return;
    setBusy(true);
    try {
      finish(await backend.signIn(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : SIGN_IN_UNAVAILABLE);
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe: typeof fieldError = {};
    if (!name.trim()) fe.name = "Masukkan nama lengkap.";
    if (!looksLikeEmail(email)) fe.email = "Masukkan alamat email yang valid.";
    if (!password || password.length < 8) fe.password = "Kata sandi minimal 8 karakter.";
    if (password !== confirmPassword) fe.confirm = "Konfirmasi kata sandi tidak cocok.";
    setFieldError(fe);
    if (fe.name || fe.email || fe.password || fe.confirm) return;
    setBusy(true);
    try {
      const res = await backend.register(name.trim(), email.trim(), password);
      finish(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pendaftaran gagal. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!looksLikeEmail(forgotEmail)) return;
    setBusy(true);
    try {
      await backend.forgotPassword(forgotEmail);
      setForgotSent(true);
      notify("Tautan atur ulang kata sandi telah dikirim ke email.");
    } catch {
      notify("Permintaan atur ulang kata sandi diproses.");
      setForgotSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex border-b border-line" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => { setMode("signin"); setError(undefined); setFieldError({}); }}
          className={`flex-1 py-3 text-center text-lg font-semibold border-b-2 ${mode === "signin" ? "border-primary text-ink" : "border-transparent text-muted"}`}
        >
          Masuk
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => { setMode("register"); setError(undefined); setFieldError({}); }}
          className={`flex-1 py-3 text-center text-lg font-semibold border-b-2 ${mode === "register" ? "border-primary text-ink" : "border-transparent text-muted"}`}
        >
          Daftar Akun Baru
        </button>
      </div>

      {reason ? <p className="rounded-brand bg-primary-soft p-3 text-sm text-primary-ink">{reason}{params.get("alasan") === "checkout" && itemCount ? ` (${itemCount} barang)` : ""}</p> : null}

      {mode === "signin" ? (
        <form onSubmit={submitSignIn} noValidate className="card flex flex-col gap-3 p-5">
          <label htmlFor="email" className="text-sm font-semibold">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldError.email} aria-describedby={fieldError.email ? "email-err" : undefined}
            className={`min-h-[44px] rounded-ctl border px-3 ${fieldError.email ? "border-2 border-danger" : "border-line-strong"}`} />
          {fieldError.email ? <span id="email-err" className="text-[13px] font-semibold text-danger">{fieldError.email}</span> : null}
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-semibold">Kata sandi</label>
            <button type="button" onClick={() => { setForgotEmail(email); setForgotSent(false); setForgotOpen(true); }} className="text-xs text-primary underline">Lupa kata sandi?</button>
          </div>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fieldError.password} aria-describedby={fieldError.password ? "pw-err" : undefined}
            className={`min-h-[44px] rounded-ctl border px-3 ${fieldError.password ? "border-2 border-danger" : "border-line-strong"}`} />
          {fieldError.password ? <span id="pw-err" className="text-[13px] font-semibold text-danger">{fieldError.password}</span> : null}
          {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
          <button type="submit" className="btn-primary" disabled={busy || locked}>{busy ? "Memeriksa…" : "Masuk"}</button>
          <button type="button" className="btn-secondary" disabled={busy || locked} onClick={async () => { try { await backend.signInWithGoogle(); } catch (e) { setError(e instanceof ApiError ? e.message : "Google belum tersedia."); } }}>Lanjut dengan Google (simulasi)</button>
        </form>
      ) : (
        <form onSubmit={submitRegister} noValidate className="card flex flex-col gap-3 p-5">
          <label htmlFor="reg-name" className="text-sm font-semibold">Nama lengkap</label>
          <input id="reg-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldError.name}
            className={`min-h-[44px] rounded-ctl border px-3 ${fieldError.name ? "border-2 border-danger" : "border-line-strong"}`} />
          {fieldError.name ? <span className="text-[13px] font-semibold text-danger">{fieldError.name}</span> : null}

          <label htmlFor="reg-email" className="text-sm font-semibold">Email</label>
          <input id="reg-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldError.email}
            className={`min-h-[44px] rounded-ctl border px-3 ${fieldError.email ? "border-2 border-danger" : "border-line-strong"}`} />
          {fieldError.email ? <span className="text-[13px] font-semibold text-danger">{fieldError.email}</span> : null}

          <label htmlFor="reg-password" className="text-sm font-semibold">Kata sandi</label>
          <PasswordInput id="reg-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fieldError.password}
            className={`min-h-[44px] rounded-ctl border px-3 ${fieldError.password ? "border-2 border-danger" : "border-line-strong"}`} />
          {fieldError.password ? <span className="text-[13px] font-semibold text-danger">{fieldError.password}</span> : null}

          <label htmlFor="reg-confirm" className="text-sm font-semibold">Konfirmasi kata sandi</label>
          <PasswordInput id="reg-confirm" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} aria-invalid={!!fieldError.confirm}
            className={`min-h-[44px] rounded-ctl border px-3 ${fieldError.confirm ? "border-2 border-danger" : "border-line-strong"}`} />
          {fieldError.confirm ? <span className="text-[13px] font-semibold text-danger">{fieldError.confirm}</span> : null}

          {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Mendaftar…" : "Buat akun"}</button>
        </form>
      )}

      {forgotOpen ? (
        <Dialog titleId="forgot-title" onClose={() => setForgotOpen(false)}>
          <h2 id="forgot-title" className="text-xl font-semibold">Atur Ulang Kata Sandi</h2>
          {forgotSent ? (
            <div className="flex flex-col gap-3 py-2">
              <p className="text-sm">Tautan atur ulang kata sandi telah dikirim ke <b>{forgotEmail}</b> (simulasi).</p>
              <button type="button" className="btn-primary" onClick={() => setForgotOpen(false)}>Selesai</button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3">
              <p className="text-sm text-muted">Masukkan email yang terdaftar untuk menerima tautan pemulihan akun.</p>
              <label htmlFor="forgot-email" className="text-sm font-semibold">Email</label>
              <input id="forgot-email" type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                className="min-h-[44px] rounded-ctl border border-line-strong px-3" />
              <div className="flex gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setForgotOpen(false)}>Batal</button>
                <button type="submit" className="btn-primary flex-1" disabled={busy}>{busy ? "Mengirim…" : "Kirim tautan"}</button>
              </div>
            </form>
          )}
        </Dialog>
      ) : null}

      {DEMO_TOOLS ? (
        <section className="sim-panel flex flex-col gap-2 text-[13px]" aria-label="Panel uji masuk">
          <b className="font-mono text-[12px]">PANEL UJI · akun demo fiktif</b>
          <span>Email <code>{DEMO_LOGIN.email}</code> · kata sandi <code>{DEMO_LOGIN.password}</code>. 5 kali salah → terkunci 15 menit (P7).</span>
          <button type="button" className="btn-secondary self-start" onClick={() => { setMode("signin"); setEmail(DEMO_LOGIN.email); setPassword(DEMO_LOGIN.password); }}>Isi kredensial demo</button>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link to="/" className="inline-flex min-h-[44px] items-center text-sm underline">Kembali belanja</Link>
        <Link to="/admin/login" className="inline-flex min-h-[44px] items-center text-sm text-muted underline">Staf toko? Masuk di halaman admin</Link>
      </div>
    </div>
  );
}
