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
  // A FormData body gets its multipart boundary from the browser; setting content-type here would break it.
  if (request.body && !(request.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  const response = await fetch(apiUrl(path), { ...request, headers, credentials: "include" });
  // nginx answers an oversize upload itself, possibly as HTML.
  if (response.status === 413) throw new ApiError("TOO_LARGE", "Ukuran file maksimal 10 MB.");
  const text = await response.text();
  let json: { error?: { code?: string; message?: string; details?: unknown[] } } = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw response.ok
        ? new ApiError("BAD_RESPONSE", "Respons server tidak dapat dibaca.")
        : new ApiError("HTTP", response.statusText || "Permintaan gagal.");
    }
  }
  if (!response.ok) {
    throw new ApiError(json.error?.code ?? "HTTP", json.error?.message ?? (response.statusText || "Permintaan gagal."), json.error?.details ?? []);
  }
  return json as T;
}
