import { HttpException } from "@nestjs/common";

/** The spec's error table (section "Error messages"): status, code and exact Bahasa message per case. */
const TABLE = {
  unsupportedFormat: [415, "UNSUPPORTED_MEDIA", "Format tidak didukung. Gunakan JPG, PNG, atau WebP."],
  heic: [415, "UNSUPPORTED_MEDIA", "Foto iPhone (HEIC) belum didukung. Ekspor sebagai JPG lalu unggah lagi."],
  tooLarge: [413, "TOO_LARGE", "Ukuran file maksimal 10 MB."],
  noFile: [422, "VALIDATION", "Pilih satu file foto."],
  corrupt: [422, "VALIDATION", "File foto rusak atau tidak bisa dibaca."],
  tooSmall: [422, "VALIDATION", "Foto terlalu kecil. Sisi terpendek minimal 480 px."],
  tooManyPixels: [422, "VALIDATION", "Foto terlalu besar untuk diproses (maks. 40 megapiksel)."],
  altInvalid: [422, "VALIDATION", "Teks alternatif wajib diisi (1–125 karakter)."],
  rightsRequired: [422, "VALIDATION", "Konfirmasi hak foto wajib dicentang."],
  orderInvalid: [422, "VALIDATION", "Daftar urutan foto tidak valid."],
  notThisProducts: [422, "VALIDATION", "Foto tidak milik produk ini."],
  notFound: [404, "NOT_FOUND", "Produk, varian atau foto tidak ditemukan."],
  limitReached: [409, "LIMIT_REACHED", "Maksimal 6 foto per produk."],
  duplicate: [409, "CONFLICT", "Foto ini sudah ada di produk ini."],
  positionCollision: [409, "CONFLICT", "Foto lain sedang diunggah. Coba lagi."],
  orderChanged: [409, "CONFLICT", "Urutan foto berubah. Muat ulang halaman."],
  photoDeleted: [409, "CONFLICT", "Foto baru saja dihapus. Muat ulang halaman."],
  rateLimited: [429, "RATE_LIMITED", "Terlalu banyak unggahan. Coba lagi nanti."],
  storageUnavailable: [503, "STORAGE_UNAVAILABLE", "Penyimpanan foto sedang tidak tersedia. Coba lagi sebentar."],
} as const;

export type MediaErrorKey = keyof typeof TABLE;

export function mediaError(key: MediaErrorKey): HttpException {
  const [status, code, message] = TABLE[key];
  return new HttpException({ code, message }, status);
}

/** The image limiter could not start the job in time; the controller adds a Retry-After header. */
export class MediaBusyException extends HttpException {
  readonly retryAfterSeconds = 10;

  constructor() {
    const [status, code, message] = TABLE.storageUnavailable;
    super({ code, message }, status);
  }
}
