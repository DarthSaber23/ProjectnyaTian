# SITEMAP

Source: canvas page "M1 — Information Architecture", boards 11 and 12. Access: Public · Login (redirect to `/masuk?next=…`) · Owner (only the ordering customer).

## Storefront (43 screens)
| ID | Page | URL | Access | Indexed |
|---|---|---|---|---|
| S01 | Beranda | `/` | Public | Yes |
| S02 | Kategori / subkategori | `/kategori/{kategori}[/{sub}]` | Public | Yes (filters → canonical to unfiltered) |
| S03 | Filter & sort sheet | query params on S02 | Public | — |
| S37 | Koleksi | `/koleksi/{slug}` | Public | Yes |
| S36 | Kampanye | `/promo/{slug}` | Public | Yes |
| S04 | Autocomplete overlay | any page | Public | — |
| S05 | Hasil pencarian | `/cari?q=` | Public | No |
| S08 | Bandingkan | `/bandingkan?id=a,b,c` | Public | No |
| S06 / S07 | Detail produk (A / B) | `/produk/{slug}` | Public | Yes |
| S09 | Cart drawer | any page | Public | — |
| S10 | Keranjang | `/keranjang` | Public | No |
| S11 | Masuk + Google (mock) | `/masuk?next=` | Public | No |
| S12 | Daftar | `/daftar?next=` | Public | No |
| S13 | Lupa / atur ulang kata sandi | `/lupa-kata-sandi`, `/atur-ulang-kata-sandi` | Public | No |
| S14 | Pemulihan akun | `/pemulihan-akun` | Public | No |
| S15–S16 | Checkout 1 Pengiriman | `/checkout/pengiriman` | Login | No |
| S17–S18 | Checkout 2 Ringkasan | `/checkout/ringkasan` | Login | No |
| S19 | Checkout 3 Pembayaran | `/checkout/pembayaran` | Login | No |
| S20–S21 | Instruksi & hasil pembayaran | `/pembayaran/{nomor-pesanan}` | Owner | No |
| S22 | Pesanan berhasil | `/pesanan/{nomor-pesanan}/berhasil` | Owner | No |
| S23 | Dasbor akun | `/akun` | Login | No |
| S24 | Profil | `/akun/profil` | Login | No |
| S25 | Buku alamat | `/akun/alamat` | Login | No |
| S26 | Riwayat pesanan | `/akun/pesanan` | Login | No |
| S27 | Detail & lacak pesanan | `/akun/pesanan/{nomor-pesanan}` | Owner | No |
| S28 | Wishlist | `/akun/wishlist` | Login | No |
| S29 | Preferensi komunikasi | `/akun/preferensi` | Login | No |
| S30 | Tentang | `/tentang` | Public | Yes |
| S31 | Kontak | `/kontak` | Public | Yes |
| S32 | Pembelian grosir | `/grosir` | Public | Yes |
| S33 | FAQ | `/faq` | Public | Yes |
| S34 | Blog | `/blog` | Public | Yes |
| S35 | Artikel | `/blog/{slug}` | Public | Yes |
| S38 | Info pengiriman | `/info/pengiriman` | Public | Yes |
| S39 | Kebijakan privasi | `/kebijakan-privasi` | Public | Yes |
| S40 | Syarat & ketentuan | `/syarat-ketentuan` | Public | Yes |
| S41 | Pengembalian | `/pengembalian` | Public | Yes |
| S42 | 404 | unknown URL | System | No |
| S43 | Error / unavailable | 500 / 503 | System | No |

Technical (specification only): `/sitemap.xml`, `/robots.txt`.

## Admin (23 screens, all require an admin session)
| ID | Page | URL | Fidelity |
|---|---|---|---|
| A01 | Dasbor | `/admin` | Hi-fi |
| A02 | Produk | `/admin/products` | Hi-fi |
| A03 | Tambah / ubah produk | `/admin/products/new`, `/admin/products/{id}` | Hi-fi |
| A04 | Kategori | `/admin/categories` | Hi-fi |
| A05 | Inventaris | `/admin/inventory` | Hi-fi |
| A06 | Pesanan | `/admin/orders` | Hi-fi |
| A07 | Detail pesanan | `/admin/orders/{nomor}` | Hi-fi |
| A08 | Promosi | `/admin/promotions` | Hi-fi |
| A09 | Tambah / ubah promosi | `/admin/promotions/new`, `/{id}` | Hi-fi |
| A10 | Konten | `/admin/content` | Hi-fi |
| A11 | Editor blok | `/admin/content/{id}/edit` | Hi-fi |
| A12 | Panel SEO | panel inside A03 and A11 | Hi-fi |
| A13 | Pelanggan | `/admin/customers` | Hi-fi |
| A14 | Profil pelanggan | `/admin/customers/{id}` | Hi-fi |
| A15 | Analitik | `/admin/analytics` | Hi-fi |
| A16 | Laporan lanjutan | `/admin/reports` | Wireframe |
| A17 | Pengguna & peran | `/admin/settings/users` | Wireframe |
| A18 | Toko | `/admin/settings/store` | Wireframe |
| A19 | Pengiriman | `/admin/settings/shipping` | Wireframe |
| A20 | Pembayaran | `/admin/settings/payments` | Wireframe |
| A21 | Notifikasi | `/admin/settings/notifications` | Wireframe |
| A22 | Log aktivitas | `/admin/audit-log` | Wireframe |
| A23 | Masuk admin | `/admin/login` | Wireframe |

The role access matrix is on canvas board 12.
