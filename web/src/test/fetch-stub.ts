import { vi } from "vitest";

/** Test helper: answers "METHOD /path" keys, 404 for anything else, and records every call. */
export function serve(routes: Record<string, { status?: number; body: unknown }>): string[] {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    calls.push(key);
    const hit = routes[key];
    if (!hit) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: `No stub for ${key}` } }), { status: 404 });
    return new Response(JSON.stringify(hit.body), { status: hit.status ?? 200 });
  }));
  return calls;
}
