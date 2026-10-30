import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { DemoBar } from "../components/Layout";
import { PasswordInput } from "../components/PasswordInput";
import { Toaster } from "../components/ui";
import { applyBrand, BRANDS, DEMO_TOOLS } from "../config/brands";
import { can, ROLE_LABEL, type Permission } from "../domain/rbac";
import { formatWib } from "../domain/time";
import { staff } from "../mocks/fixtures";
import { admin } from "../services/http/admin";
import { useAdmin, useAdminData } from "../store/admin";
import { useShop } from "../store/shop";

const NAV: { to: string; label: string; perm: Permission }[] = [
  { to: "/admin", label: "Dasbor", perm: "dashboard.view" },
  { to: "/admin/orders", label: "Pesanan", perm: "orders.view" },
  { to: "/admin/promotions", label: "Promosi", perm: "promotions.view" },
  { to: "/admin/products", label: "Produk", perm: "products.media" },
  { to: "/admin/blog", label: "Blog", perm: "articles.manage" },
  { to: "/admin/seo", label: "SEO", perm: "seo.edit" },
  { to: "/admin/audit-log", label: "Log audit", perm: "audit.view" },
];

/** Demo staff password (fictional, mock only). Production: SSO or server auth + TOTP (C9). */
export const DEMO_STAFF_PASSWORD = "demo-staff-2026";

export function AdminLogin() {
  const signIn = useAdmin((s) => s.signIn);
  const user = useAdmin((s) => s.user);
  const check = useAdmin((s) => s.check);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => applyBrand(BRANDS.sambung), []);
  useEffect(() => { void check(); }, [check]); // a still-valid staff cookie skips this form
  if (user) return <Navigate to={can(user.role, "dashboard.view") ? "/admin" : can(user.role, "articles.manage") ? "/admin/blog" : "/admin/orders"} replace />;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    void admin.signIn(email, password, code).then((person) => {
      signIn(person);
      navigate(can(person.role, "dashboard.view") ? "/admin" : can(person.role, "articles.manage") ? "/admin/blog" : "/admin/orders");
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal masuk"));
  };
  return (
    <div className="min-h-screen bg-alt">
      <DemoBar />
      <main id="main" className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-semibold">SAMBUNG<span className="text-primary">/</span> Admin</h1>
        <form onSubmit={submit} noValidate className="card flex flex-col gap-3 p-5">
          <label htmlFor="a-email" className="text-sm font-semibold">Email</label>
          <input id="a-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[44px] rounded-ctl border border-line-strong px-3" />
          <label htmlFor="a-pw" className="text-sm font-semibold">Kata sandi</label>
          <PasswordInput id="a-pw" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-[44px] rounded-ctl border border-line-strong px-3" />
          <label htmlFor="a-otp" className="text-sm font-semibold">Kode autentikator (6 digit)</label>
          <input id="a-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="min-h-[44px] rounded-ctl border border-line-strong px-3 font-mono tracking-widest" />
          {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
          <button type="submit" className="btn-primary">Masuk</button>
          <span className="text-[13px] text-muted">Lupa kata sandi? Hubungi Owner (tidak ada reset mandiri untuk admin, C9).</span>
        </form>
        {DEMO_TOOLS ? (
          <section className="sim-panel flex flex-col gap-2 text-[13px]" aria-label="Panel uji staf">
            <b className="font-mono text-[12px]">PANEL UJI · staf fiktif · kata sandi {DEMO_STAFF_PASSWORD} · kode 6 digit apa pun (simulasi)</b>
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => <button key={s.id} type="button" className="btn-secondary min-h-[40px] text-[13px]" onClick={() => { setEmail(s.email); setPassword(DEMO_STAFF_PASSWORD); setCode("123456"); }}>{s.name} · {ROLE_LABEL[s.role]}</button>)}
            </div>
          </section>
        ) : null}
        <Link to="/" className="text-sm underline">Ke toko</Link>
      </main>
    </div>
  );
}

export function AdminShell() {
  const user = useAdmin((s) => s.user);
  const checked = useAdmin((s) => s.checked);
  const check = useAdmin((s) => s.check);
  const signOut = useAdmin((s) => s.signOut);
  const brand = useShop((s) => s.brand);
  const a = useAdminData();
  const { pathname } = useLocation();
  useEffect(() => applyBrand(BRANDS.sambung), [brand]); // admin data is the Sambung store in this prototype
  useEffect(() => { void check(); }, [check]);
  if (!user && !checked) return <div className="min-h-screen bg-alt p-6"><p role="status" className="text-sm text-muted">Memuat akun staf…</p></div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  const nav = NAV.filter((n) => can(user.role, n.perm));
  const allowed = nav.some((n) => (n.to === "/admin" ? pathname === "/admin" : pathname.startsWith(n.to)));
  return (
    <div className="flex min-h-screen flex-col bg-alt">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:p-2">Lewati ke konten</a>
      <DemoBar />
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-line bg-surface p-3 md:w-56 md:shrink-0 md:border-b-0 md:border-r">
          <div className="mb-3 px-2 font-display text-lg font-bold">SAMBUNG<span className="text-primary">/</span> <span className="text-sm font-normal text-muted">Admin</span></div>
          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col">
            {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.to === "/admin"} className={({ isActive }) => `whitespace-nowrap rounded-ctl px-3 py-2 text-sm ${isActive ? "bg-primary-soft font-semibold text-primary-ink" : "hover:bg-alt"}`}>{n.label}</NavLink>)}
          </nav>
          <p className="mt-4 hidden px-2 text-[12px] text-muted md:block">Peran {ROLE_LABEL[user.role]}: menu hanya menampilkan modul yang diizinkan (A17).</p>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2 text-sm">
            <span className="font-mono text-[12px] text-muted">Jam simulasi {formatWib(a.clock(), { withDate: false })}</span>
            <span className="flex items-center gap-3"><b>{user.name}</b><span className="rounded bg-alt px-2 py-0.5 text-[12px]">{ROLE_LABEL[user.role]}</span><button type="button" className="btn-ghost min-h-[40px]" onClick={signOut}>Keluar</button></span>
          </header>
          <main id="main" className="flex-1 p-4 md:p-6">
            {allowed ? <Outlet /> : <div role="alert" className="card p-6"><h1 className="text-xl font-semibold">Tidak ada akses</h1><p className="text-muted">Peran {ROLE_LABEL[user.role]} tidak dapat membuka halaman ini (A17).</p></div>}
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
