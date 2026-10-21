export type ProviderName = "midtrans" | "duitku" | "biteship";

const KEYS: Record<ProviderName, string> = {
  midtrans: "MIDTRANS_SERVER_KEY",
  duitku: "DUITKU_API_KEY",
  biteship: "BITESHIP_API_KEY",
};

/** Refuse a live provider call until the owner supplies that provider's server key. */
export function assertProviderConfigured(name: ProviderName, env: Record<string, string | undefined>): void {
  const key = KEYS[name];
  if (!env[key]?.trim()) throw new Error(`${key} is not set`);
}
