import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { fakeContentDb } from "./fake-content-db";

const text = (articleId: string, lang: string, slug: string) => ({
  articleId, lang, storeId: "sambung", slug, title: slug, seoTitle: null, metaDescription: "", summary: "", body: "", noindex: false, canonicalUrl: null,
});
const article = (id: string, over: object = {}) => ({
  id, storeId: "sambung", status: "draft", publishAt: null, publishedAt: null, updatedAt: "t", version: 1, authorId: "U-05",
  coverHash: null, coverWidth: null, coverHeight: null, coverSizes: [], coverAlt: null, tags: [], sample: false, createdAt: "t", createdBy: "x", ...over,
});

describe("fakeContentDb", () => {
  it("slug is unique per store and language: P2002 with target storeId, lang, slug", async () => {
    const { prisma } = fakeContentDb({ articles: [article("a1"), article("a2")], texts: [text("a1", "id", "kabel")] });
    const error = await prisma.articleText.create({ data: text("a2", "id", "kabel") }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).meta?.target).toEqual(["storeId", "lang", "slug"]);
    await expect(prisma.articleText.create({ data: text("a2", "en", "kabel") })).resolves.toMatchObject({ lang: "en" });
  });

  it("updateMany with a version condition updates only the matching row and counts it", async () => {
    const { prisma, state } = fakeContentDb({ articles: [article("a1", { version: 3 })] });
    expect(await prisma.article.updateMany({ where: { id: "a1", version: 2 }, data: { version: { increment: 1 } } })).toEqual({ count: 0 });
    expect(await prisma.article.updateMany({ where: { id: "a1", version: 3 }, data: { version: { increment: 1 }, status: "published" } })).toEqual({ count: 1 });
    expect(state.articles[0]).toMatchObject({ version: 4, status: "published" });
  });

  it("findMany filters with equality, in, lte and not-null, includes texts and products, orders", async () => {
    const { prisma } = fakeContentDb({
      articles: [article("a1", { status: "published", publishAt: "2026-10-01" }), article("a2", { status: "published", publishAt: "2026-12-01" }), article("a3")],
      texts: [text("a1", "id", "satu"), text("a2", "id", "dua")],
      links: [{ articleId: "a1", productId: "B01", position: 0 }],
    });
    const live = await prisma.article.findMany({ where: { storeId: "sambung", status: "published", publishAt: { lte: "2026-10-30" } }, include: { texts: true, products: true }, orderBy: { publishAt: "desc" } });
    expect(live.map((a) => a.id)).toEqual(["a1"]);
    expect(live[0]!.texts.map((t) => t.slug)).toEqual(["satu"]);
    expect(live[0]!.products).toEqual([{ articleId: "a1", productId: "B01", position: 0 }]);
    expect((await prisma.article.findMany({ where: { id: { in: ["a2", "a3"] }, publishAt: { not: null } } })).map((a) => a.id)).toEqual(["a2"]);
  });

  it("a throwing transaction rolls back every table, audit included", async () => {
    const { prisma, state } = fakeContentDb({ articles: [article("a1")], texts: [text("a1", "id", "satu")] });
    const before = JSON.stringify(state);
    await prisma.$transaction(async (tx) => {
      await tx.articleText.update({ where: { articleId_lang: { articleId: "a1", lang: "id" } }, data: { slug: "baru-sekali" } });
      await tx.slugRedirect.create({ data: { storeId: "sambung", kind: "article", lang: "id", fromSlug: "satu", toArticleId: "a1" } });
      await tx.articleProduct.createMany({ data: [{ articleId: "a1", productId: "B01", position: 0 }] });
      await tx.seoOverride.upsert({ where: { storeId_kind_key: { storeId: "sambung", kind: "product", key: "B01" } }, create: { storeId: "sambung", kind: "product", key: "B01", seoTitle: "x", metaDescription: null, updatedAt: "t", updatedBy: "u" }, update: {} });
      await tx.auditRecord.create({ data: { at: "t", actor: "a", code: "ARTICLE_UPDATED", action: "x", object: "a1", after: {} } });
      throw new Error("boom");
    }).catch(() => undefined);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("deleteMany with a not condition removes only matching articles, cascades, and counts them", async () => {
    const { prisma, state } = fakeContentDb({
      articles: [article("a1"), { ...article("a2"), status: "published" }], texts: [text("a1", "id", "satu"), text("a2", "id", "dua")],
    });
    expect(await prisma.article.deleteMany({ where: { id: "a2", status: { not: "published" } } })).toEqual({ count: 0 });
    expect(await prisma.article.deleteMany({ where: { id: "a1", status: { not: "published" } } })).toEqual({ count: 1 });
    expect(state.articles.map((a) => a.id)).toEqual(["a2"]);
    expect(state.texts.map((t) => t.articleId)).toEqual(["a2"]);
  });

  it("deleting an article cascades to texts, links and redirects", async () => {
    const { prisma, state } = fakeContentDb({
      articles: [article("a1")], texts: [text("a1", "id", "satu")], links: [{ articleId: "a1", productId: "B01", position: 0 }],
      redirects: [{ id: "r1", storeId: "sambung", kind: "article", lang: "id", fromSlug: "lama", toArticleId: "a1" }],
    });
    await prisma.article.delete({ where: { id: "a1" } });
    expect([state.texts.length, state.links.length, state.redirects.length]).toEqual([0, 0, 0]);
  });

  it("inject.failNextWrite makes the next write throw once", async () => {
    const { prisma, inject } = fakeContentDb({ articles: [article("a1")] });
    inject.failNextWrite = true;
    await expect(prisma.article.update({ where: { id: "a1" }, data: { status: "published" } })).rejects.toThrow("injected write failure");
    await expect(prisma.article.update({ where: { id: "a1" }, data: { status: "published" } })).resolves.toMatchObject({ status: "published" });
  });
});
