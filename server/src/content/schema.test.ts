import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const model = (name: string) => Prisma.dmmf.datamodel.models.find((m) => m.name === name);

describe("Prisma schema for articles", () => {
  it("has the five content models", () => {
    for (const name of ["Article", "ArticleText", "ArticleProduct", "SlugRedirect", "SeoOverride"]) expect(model(name), name).toBeDefined();
  });

  it("slugs are unique per store and language; texts and links cascade with the article", () => {
    const text = model("ArticleText")!;
    expect(text.uniqueFields).toContainEqual(["storeId", "lang", "slug"]);
    expect(text.primaryKey?.fields).toEqual(["articleId", "lang"]);
    expect(text.fields.find((f) => f.name === "article")!.relationOnDelete).toBe("Cascade");
    expect(model("ArticleProduct")!.fields.find((f) => f.name === "article")!.relationOnDelete).toBe("Cascade");
    expect(model("ArticleProduct")!.primaryKey?.fields).toEqual(["articleId", "productId"]);
  });

  it("redirects are unique per store, kind, language and old slug; overrides keyed by store, kind and key", () => {
    expect(model("SlugRedirect")!.uniqueFields).toContainEqual(["storeId", "kind", "lang", "fromSlug"]);
    expect(model("SeoOverride")!.primaryKey?.fields).toEqual(["storeId", "kind", "key"]);
  });

  it("Article carries version, sample, schedule and cover fields", () => {
    const names = model("Article")!.fields.map((f) => f.name);
    for (const f of ["storeId", "status", "publishAt", "publishedAt", "updatedAt", "version", "authorId", "coverHash", "coverAlt", "coverSizes", "tags", "sample"]) {
      expect(names, f).toContain(f);
    }
  });
});
