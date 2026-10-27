import type { ArgumentsHost } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ApiExceptionFilter } from "./api-exception.filter";

function respond(exception: unknown): { status: number; body: { error: { code: string; message: string } } } {
  const out = { status: 0, body: undefined as unknown };
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status: (code: number) => { out.status = code; return { json: (body: unknown) => { out.body = body; } }; } }) }),
  } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return out as { status: number; body: { error: { code: string; message: string } } };
}

describe("ApiExceptionFilter", () => {
  it("asks the shopper to retry when a busy moment times out a locked transaction", () => {
    const busy = new Prisma.PrismaClientKnownRequestError("Transaction API error", { code: "P2028", clientVersion: "5.22.0" });
    expect(respond(busy)).toEqual({ status: 503, body: { error: { code: "BUSY", message: "Sedang ramai. Coba lagi sebentar.", details: [] } } });
  });

  it("treats a write conflict or deadlock the same way", () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("write conflict", { code: "P2034", clientVersion: "5.22.0" });
    expect(respond(conflict).status).toBe(503);
  });

  it("still hides other database errors behind a 500", () => {
    const other = new Prisma.PrismaClientKnownRequestError("boom", { code: "P2010", clientVersion: "5.22.0" });
    expect(respond(other)).toMatchObject({ status: 500, body: { error: { code: "INTERNAL" } } });
  });
});
