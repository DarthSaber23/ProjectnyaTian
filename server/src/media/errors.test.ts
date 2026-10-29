import { describe, expect, it } from "vitest";
import { MediaBusyException, mediaError, type MediaErrorKey } from "./errors";

const TABLE: Array<[MediaErrorKey, number, string, string]> = [
  ["unsupportedFormat", 415, "UNSUPPORTED_MEDIA", "Format tidak didukung. Gunakan JPG, PNG, atau WebP."],
  ["heic", 415, "UNSUPPORTED_MEDIA", "Foto iPhone (HEIC) belum didukung. Ekspor sebagai JPG lalu unggah lagi."],
  ["tooLarge", 413, "TOO_LARGE", "Ukuran file maksimal 10 MB."],
  ["noFile", 422, "VALIDATION", "Pilih satu file foto."],
  ["corrupt", 422, "VALIDATION", "File foto rusak atau tidak bisa dibaca."],
  ["tooSmall", 422, "VALIDATION", "Foto terlalu kecil. Sisi terpendek minimal 480 px."],
  ["tooManyPixels", 422, "VALIDATION", "Foto terlalu besar untuk diproses (maks. 40 megapiksel)."],
  ["altInvalid", 422, "VALIDATION", "Teks alternatif wajib diisi (1–125 karakter)."],
  ["rightsRequired", 422, "VALIDATION", "Konfirmasi hak foto wajib dicentang."],
  ["orderInvalid", 422, "VALIDATION", "Daftar urutan foto tidak valid."],
  ["notThisProducts", 422, "VALIDATION", "Foto tidak milik produk ini."],
  ["notFound", 404, "NOT_FOUND", "Produk, varian atau foto tidak ditemukan."],
  ["limitReached", 409, "LIMIT_REACHED", "Maksimal 6 foto per produk."],
  ["duplicate", 409, "CONFLICT", "Foto ini sudah ada di produk ini."],
  ["positionCollision", 409, "CONFLICT", "Foto lain sedang diunggah. Coba lagi."],
  ["orderChanged", 409, "CONFLICT", "Urutan foto berubah. Muat ulang halaman."],
  ["photoDeleted", 409, "CONFLICT", "Foto baru saja dihapus. Muat ulang halaman."],
  ["rateLimited", 429, "RATE_LIMITED", "Terlalu banyak unggahan. Coba lagi nanti."],
  ["storageUnavailable", 503, "STORAGE_UNAVAILABLE", "Penyimpanan foto sedang tidak tersedia. Coba lagi sebentar."],
];

describe("mediaError", () => {
  it.each(TABLE)("mediaError(%s) has the status, code and exact message of the spec table", (key, status, code, message) => {
    const error = mediaError(key);
    expect(error.getStatus()).toBe(status);
    expect(error.getResponse()).toEqual({ code, message });
  });

  it("MediaBusyException is 503 STORAGE_UNAVAILABLE with retryAfterSeconds 10", () => {
    const busy = new MediaBusyException();
    expect(busy.getStatus()).toBe(503);
    expect(busy.getResponse()).toMatchObject({ code: "STORAGE_UNAVAILABLE" });
    expect(busy.retryAfterSeconds).toBe(10);
  });
});
