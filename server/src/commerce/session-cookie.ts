/**
 * Browser sessions ride in HttpOnly cookies so a page reload keeps the customer or staff member signed in
 * and page scripts never see the token. Scripts and tests may still send `Authorization: Bearer`.
 */
export type SessionKind = "customer" | "staff";

const NAME: Record<SessionKind, string> = { customer: "tian_session", staff: "tian_staff" };
const PATH: Record<SessionKind, string> = { customer: "/v1", staff: "/v1/admin" };
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Without maxAgeSeconds the cookie ends with the browser session (used for staff, who can reach PII and refunds). */
export function sessionCookie(kind: SessionKind, token: string, secure: boolean, maxAgeSeconds?: number): string {
  const maxAge = maxAgeSeconds === undefined ? "" : `; Max-Age=${maxAgeSeconds}`;
  return `${NAME[kind]}=${token}; Path=${PATH[kind]}${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearedCookie(kind: SessionKind, secure: boolean): string {
  return sessionCookie(kind, "", secure, 0);
}

export function isHttps(request: { protocol?: string; headers?: Record<string, string | string[] | undefined> }): boolean {
  return request.protocol === "https" || request.headers?.["x-forwarded-proto"] === "https";
}

/** Turns the session cookie for this route into a bearer header. */
export function bearerFromCookie(request: { path: string; cookie?: string }): string | undefined {
  const kind: SessionKind = /^\/v1\/admin(\/|$)/.test(request.path) ? "staff" : "customer";
  const token = readCookie(request.cookie, NAME[kind]);
  return token ? `Bearer ${token}` : undefined;
}

/**
 * A write whose Origin is another site (CSRF, including a forged sign-in form). Server-to-server calls
 * such as gateway webhooks send no Origin and pass. SameSite=Lax is the first line; this is the second.
 */
export function crossSiteWrite(request: { method: string; host?: string; origin?: string }): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase()) || !request.origin) return false;
  return originHost(request.origin) !== hostname(request.host);
}

/** Browsers send Origin on sign-in; they get the cookie only. Scripts (no Origin) still get the bearer token. */
export function withoutBrowserToken<T extends { token: string }>(result: T, origin: string | undefined): Omit<T, "token"> | T {
  if (!origin) return result;
  const { token: _token, ...rest } = result;
  return rest;
}

/** CORS stays off unless CORS_ORIGINS lists callers (e.g. a local Vite dev server). nginx serves the shop on the same origin. */
export function corsOrigins(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || undefined;
  }
  return undefined;
}

/** Hostname only: cookies are shared across ports, and nginx's `$host` drops the port. */
function originHost(origin: string): string | undefined {
  try {
    return new URL(origin).hostname;
  } catch {
    return undefined;
  }
}

function hostname(host: string | undefined): string | undefined {
  return host?.replace(/:\d+$/, "");
}
