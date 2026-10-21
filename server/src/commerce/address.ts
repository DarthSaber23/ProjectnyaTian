export interface AddressInput {
  recipient: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  detail: string;
  kelurahan?: string;
  label?: string;
  note?: string;
}

export type AddressResult = { ok: true; value: AddressInput } | { ok: false; message: string };

const REQUIRED: Array<keyof AddressInput> = ["recipient", "phone", "province", "city", "district", "postalCode", "detail"];

/** D13 and D16. Phone is 08 or +62, 10–13 digits. */
export function validateAddress(input: Partial<AddressInput> | undefined): AddressResult {
  const source = input ?? {};
  for (const field of REQUIRED) {
    const value = source[field];
    if (typeof value !== "string" || value.trim() === "") {
      return { ok: false, message: `Field ${field} wajib diisi.` };
    }
  }
  const digits = String(source.phone).replace(/\D/g, "");
  const local = digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
  if (!/^08\d{8,11}$/.test(local)) {
    return { ok: false, message: "Nomor telepon harus diawali 08 atau +62 dan berisi 10–13 digit." };
  }
  if (!/^\d{5}$/.test(String(source.postalCode).trim())) {
    return { ok: false, message: "Kode pos harus 5 digit." };
  }
  return {
    ok: true,
    value: {
      recipient: source.recipient!.trim(),
      phone: local,
      province: source.province!.trim(),
      city: source.city!.trim(),
      district: source.district!.trim(),
      postalCode: source.postalCode!.trim(),
      detail: source.detail!.trim(),
      kelurahan: source.kelurahan?.trim() || undefined,
      label: source.label?.trim() || undefined,
      note: source.note?.trim() || undefined,
    },
  };
}
