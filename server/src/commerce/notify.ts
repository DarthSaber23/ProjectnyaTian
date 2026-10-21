export type Channel = "email" | "whatsapp";
export type Purpose = "transactional" | "marketing";

export interface ConsentFlags {
  emailPromo: boolean;
  waOrderInfo: boolean;
}

/** C11. Checked at send time. WhatsApp marketing is never allowed. */
export function maySend(channel: Channel, purpose: Purpose, consent: ConsentFlags): boolean {
  if (channel === "whatsapp" && purpose === "marketing") return false;
  if (channel === "email" && purpose === "transactional") return true;
  if (channel === "whatsapp" && purpose === "transactional") return consent.waOrderInfo;
  if (channel === "email" && purpose === "marketing") return consent.emailPromo;
  return false;
}
