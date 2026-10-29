import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { mapMediaError } from "./error-map";

const prisma = (code: string, target?: unknown) =>
  new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "5.22.0", meta: target === undefined ? undefined : { target } });
const named = (name: string, extra: object = {}) => Object.assign(new Error("x"), { name }, extra);

function caught(error: unknown): unknown {
  try {
    mapMediaError(error);
  } catch (thrown) {
    return thrown;
  }
  throw new Error("mapMediaError returned");
}

describe("mapMediaError", () => {
  it.each([
    ["P2002 on position", prisma("P2002", ["productId", "position"]), 409, "Foto lain sedang diunggah. Coba lagi."],
    ["P2002 on hash (string target)", prisma("P2002", "ProductImage_productId_hash_key"), 409, "Foto ini sudah ada di produk ini."],
    ["P2003", prisma("P2003"), 409, "Foto baru saja dihapus. Muat ulang halaman."],
    ["sharp decode", new Error("Input buffer contains unsupported image format"), 422, "File foto rusak atau tidak bisa dibaca."],
    ["libvips decode", new Error("VipsJpeg: Premature end of input file"), 422, "File foto rusak atau tidak bisa dibaca."],
    ["sharp pixel limit", new Error("Input image exceeds pixel limit"), 422, "Foto terlalu besar untuk diproses (maks. 40 megapiksel)."],
    ["S3 error name", named("NoSuchBucket"), 503, "Penyimpanan foto sedang tidak tersedia. Coba lagi sebentar."],
    ["S3 $metadata", named("Whatever", { $metadata: { httpStatusCode: 500 } }), 503, "Penyimpanan foto sedang tidak tersedia. Coba lagi sebentar."],
    ["ECONNREFUSED", named("Error", { code: "ECONNREFUSED" }), 503, "Penyimpanan foto sedang tidak tersedia. Coba lagi sebentar."],
    ["ETIMEDOUT", named("Error", { code: "ETIMEDOUT" }), 503, "Penyimpanan foto sedang tidak tersedia. Coba lagi sebentar."],
  ])("%s", (_name, input, status, message) => {
    const out = caught(input);
    expect(out).toBeInstanceOf(HttpException);
    expect((out as HttpException).getStatus()).toBe(status);
    expect((out as HttpException).getResponse()).toMatchObject({ message });
  });

  it("an HttpException passes through as the same instance", () => {
    const original = new HttpException({ code: "X", message: "y" }, 418);
    expect(caught(original)).toBe(original);
  });

  it("any other P2002 is rethrown unchanged (a bug, so 500)", () => {
    const original = prisma("P2002", ["email"]);
    expect(caught(original)).toBe(original);
  });

  it("an unknown error is rethrown unchanged", () => {
    const original = new Error("db down");
    expect(caught(original)).toBe(original);
  });
});
