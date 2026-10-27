import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";
import { SecurityInterceptor } from "./security.interceptor";

async function headersFor(method: string, originalUrl: string, request: Record<string, unknown> = { originalUrl }): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const context = {
    switchToHttp: () => ({
      getResponse: () => ({ setHeader: (name: string, value: string) => { headers[name] = value; } }),
      getRequest: () => ({ method, headers: {}, ...request }),
    }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(null) };
  await lastValueFrom(new SecurityInterceptor().intercept(context, next));
  return headers;
}

describe("SecurityInterceptor cache header", () => {
  it("marks a catalogue read as briefly reusable, ignoring the query string", async () => {
    expect((await headersFor("GET", "/v1/catalog?brand=sambung"))["Cache-Control"]).toBe("public, max-age=15, stale-while-revalidate=45");
  });

  it("marks an account read as never stored", async () => {
    expect((await headersFor("GET", "/v1/me/orders"))["Cache-Control"]).toBe("private, no-store");
  });

  it("reads the path from url when the adapter gives no originalUrl", async () => {
    expect((await headersFor("GET", "", { url: "/v1/pages/tentang" }))["Cache-Control"]).toBe("public, max-age=300");
  });
});
