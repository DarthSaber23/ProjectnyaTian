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
  const national = digits.startsWith("62") ? digits.slice(2) : digits;
  const withoutTrunk = national.startsWith("0") ? national.slice(1) : national;
  const local = withoutTrunk.startsWith("8") ? `0${withoutTrunk}` : withoutTrunk;
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
      kelurahan: optionalText(source.kelurahan),
      label: optionalText(source.label),
      note: optionalText(source.note),
    },
  };
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
