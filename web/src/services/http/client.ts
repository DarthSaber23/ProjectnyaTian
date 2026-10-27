export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
  }
}

export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

/** The session rides in an HttpOnly cookie set by the API, so page scripts never hold a token. */
export async function api<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const { idempotencyKey, ...request } = init;
  const headers = new Headers(request.headers);
  if (request.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  const response = await fetch(apiUrl(path), { ...request, headers, credentials: "include" });
  const text = await response.text();
  const json = text ? JSON.parse(text) as { error?: { code?: string; message?: string; details?: unknown[] } } : {};
  if (!response.ok) {
    throw new ApiError(json.error?.code ?? "HTTP", json.error?.message ?? response.statusText, json.error?.details ?? []);
  }
  return json as T;
}
