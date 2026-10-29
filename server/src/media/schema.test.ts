import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Prisma schema for product images", () => {
  it("ProductImage has both unique keys and Variant.imageId is SetNull", () => {
    const models = Prisma.dmmf.datamodel.models;
    const image = models.find((m) => m.name === "ProductImage")!;
    expect(image.uniqueFields).toEqual(expect.arrayContaining([["productId", "position"], ["productId", "hash"]]));
    expect(models.find((m) => m.name === "Variant")!.fields.find((f) => f.name === "image")!.relationOnDelete).toBe("SetNull");
    expect(image.fields.find((f) => f.name === "product")!.relationOnDelete).toBe("Cascade");
  });
});
