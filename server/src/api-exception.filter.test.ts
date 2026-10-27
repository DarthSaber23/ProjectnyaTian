import { HttpException, type ArgumentsHost } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ApiExceptionFilter } from "./api-exception.filter";

function respond(exception: unknown, headersSent = false): { status: number; body: { error: { code: string; message: string } }; headers: Record<string, string> } {
  const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        headersSent,
        setHeader: (name: string, value: string) => {
          if (headersSent) throw new Error("ERR_HTTP_HEADERS_SENT");
          out.headers[name] = value;
        },
        status: (code: number) => { out.status = code; return { json: (body: unknown) => { out.body = body; } }; },
      }),
    }),
  } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return out as { status: number; body: { error: { code: string; message: string } }; headers: Record<string, string> };
}

describe("ApiExceptionFilter", () => {
  it("asks the shopper to retry when a busy moment times out a locked transaction", () => {
    const busy = new Prisma.PrismaClientKnownRequestError("Transaction API error", { code: "P2028", clientVersion: "5.22.0" });
    expect(respond(busy)).toMatchObject({ status: 503, body: { error: { code: "BUSY", message: "Sedang ramai. Coba lagi sebentar.", details: [] } } });
  });

  it("treats a write conflict or deadlock the same way", () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("write conflict", { code: "P2034", clientVersion: "5.22.0" });
    expect(respond(conflict).status).toBe(503);
  });

  it("still hides other database errors behind a 500", () => {
    const other = new Prisma.PrismaClientKnownRequestError("boom", { code: "P2010", clientVersion: "5.22.0" });
    expect(respond(other)).toMatchObject({ status: 500, body: { error: { code: "INTERNAL" } } });
  });

  it("never lets a browser or proxy keep an error, even on a public catalogue route", () => {
    expect(respond(new HttpException({ code: "NOT_FOUND", message: "Produk tidak ditemukan." }, 404)).headers["Cache-Control"]).toBe("private, no-store");
    expect(respond(new Error("boom")).headers["Cache-Control"]).toBe("private, no-store");
  });

  it("still maps the error when the response headers already went out", () => {
    expect(respond(new HttpException({ code: "NOT_FOUND", message: "x" }, 404), true).status).toBe(404);
  });
});
