export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
  }
}

let customerToken: string | null = null;
let staffToken: string | null = null;

export function setCustomerToken(value: string | null): void {
  customerToken = value;
}
export function setStaffToken(value: string | null): void {
  staffToken = value;
}

export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

export async function api<T>(path: string, init: RequestInit & { idempotencyKey?: string; auth?: "customer" | "staff" } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const token = init.auth === "staff" || path.startsWith("/v1/admin") ? staffToken : customerToken;
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.idempotencyKey) headers.set("idempotency-key", init.idempotencyKey);
  const response = await fetch(apiUrl(path), { ...init, headers });
  const text = await response.text();
  const json = text ? JSON.parse(text) as { error?: { code?: string; message?: string; details?: unknown[] } } : {};
  if (!response.ok) {
    throw new ApiError(json.error?.code ?? "HTTP", json.error?.message ?? response.statusText, json.error?.details ?? []);
  }
  return json as T;
}
