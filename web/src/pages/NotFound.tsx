import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="card mx-auto flex max-w-lg flex-col items-start gap-3 p-8">
      <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="text-muted">Tautan mungkin salah atau produk sudah tidak dijual.</p>
      <Link to="/" className="btn-primary">Ke beranda</Link>
    </div>
  );
}
