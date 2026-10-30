import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { contentHarness, enText, idText, META } from "../../test/content-harness";
import { makeSeedDir } from "../../test/sample-seed";
import type { ContentSeedEntry } from "./common";
import { runContentRemoveSamples } from "./remove-samples";
import { runContentSeed } from "./seed";

type Harness = ReturnType<typeof contentHarness>;

const sambung: ContentSeedEntry = {
  store: "sambung", tags: ["kabel"], productIds: ["B01", "B02"], cover: { productId: "B01", alt: "Kabel USB-C di atas meja" },
  texts: { id: idText(), en: enText() },
};
const halimun: ContentSeedEntry = {
  store: "halimun", tags: [], productIds: ["A01"], cover: null,
  texts: { id: idText({ slug: "rutinitas-pagi", title: "Rutinitas pagi", summary: "Bersihkan, lembapkan, lindungi.", body: "## Pagi\n\nMulai dari pembersih." }) },
};

async function files(entries: ContentSeedEntry[]) {
  const media = await makeSeedDir([{ productId: "B01", n: 1 }]);
  const dir = mkdtempSync(path.join(tmpdir(), "tian-content-"));
  const articlesFile = path.join(dir, "articles.json");
  writeFileSync(articlesFile, JSON.stringify(entries));
  return { articlesFile, mediaDir: media.dir };
}

const deps = (h: Harness, f: { articlesFile: string; mediaDir: string }) => ({
  prisma: h.prisma as never, storage: h.storage, articles: h.service, articlesFile: f.articlesFile, mediaDir: f.mediaDir,
});

describe("content:seed", () => {
  it("adds published sample articles once, by the demo SEO account; a second run changes nothing", async () => {
    const h = contentHarness({ staff: [] });
    const f = await files([sambung, halimun]);
    const first = await runContentSeed(deps(h, f), { operator: "Rina" });
    expect(first).toMatchObject({ exitCode: 0, added: 2, skipped: 0 });
    expect(h.state.staff.map((s) => [s.id, s.role, s.name])).toEqual([["U-05", "seo", "Sinta P."]]);
    const views = await Promise.all(h.state.articles.map((a) => h.service.get(a.id as string)));
    expect(views.map((v) => [v.store, v.status, v.live, v.sample, v.authorId, Object.keys(v.texts).sort().join("+"), v.productIds.join(",")])).toEqual([
      ["sambung", "published", true, true, "U-05", "en+id", "B01,B02"],
      ["halimun", "published", true, true, "U-05", "id", "A01"],
    ]);
    expect(views[0]!.cover?.alt).toBe("Kabel USB-C di atas meja");
    expect(views[1]!.cover).toBeNull();
    expect(h.state.audit.every((a) => a.actor === "CLI: Rina")).toBe(true);
    const audits = h.state.audit.length;
    const objects = h.storage.objects.size;

    const second = await runContentSeed(deps(h, f), { operator: "Rina" });
    expect(second).toMatchObject({ exitCode: 0, added: 0, skipped: 2 });
    expect(h.state.articles).toHaveLength(2);
    expect(h.state.audit).toHaveLength(audits);
    expect(h.storage.objects.size).toBe(objects);
  });

  it("an invalid entry stops the run before anything is written", async () => {
    const h = contentHarness();
    const f = await files([sambung, { ...halimun, texts: { id: { ...halimun.texts.id, metaDescription: "Terlalu pendek." } } }]);
    const result = await runContentSeed(deps(h, f), {});
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("halimun/rutinitas-pagi (id): Deskripsi meta minimal 50 karakter.");
    expect(h.state.articles).toHaveLength(0);
    expect(h.state.audit).toHaveLength(0);
    expect(h.storage.objects.size).toBe(0);
  });

  it.each([
    [{ ...sambung, productIds: ["A01"] }, "sambung/cara-memilih-kabel: produk A01 tidak ada di toko ini"],
    [{ ...sambung, productIds: ["B01", "B01", "B01", "B01", "B01", "B01", "B01"] }, "sambung/cara-memilih-kabel: maksimal 6 produk"],
    [{ ...sambung, cover: { productId: "B02", alt: "x" } }, "sambung/cara-memilih-kabel: tidak ada foto contoh untuk B02"],
    [{ ...sambung, cover: { productId: "B01", alt: "" } }, "sambung/cara-memilih-kabel: teks alternatif sampul wajib diisi"],
    [{ ...sambung, texts: { id: idText({ body: "" }) } }, "sambung/cara-memilih-kabel (id): Lengkapi Isi sebelum terbit."],
  ])("rejects %#", async (entry, message) => {
    const h = contentHarness();
    const result = await runContentSeed(deps(h, await files([entry as ContentSeedEntry])), {});
    expect(result.exitCode).toBe(1);
    expect(result.lines).toContain(message);
    expect(h.state.articles).toHaveLength(0);
  });

  it("never touches a staff-written article with the same slug", async () => {
    const h = contentHarness();
    const staff = await h.service.create({ id: "U-05", label: "Sinta P. (SEO)" }, "sambung", idText({ metaDescription: META, title: "Tulisan staf" }));
    const f = await files([sambung]);
    expect(await runContentSeed(deps(h, f), {})).toMatchObject({ exitCode: 0, added: 0, skipped: 1 });
    expect((await h.service.get(staff.id)).texts.id?.title).toBe("Tulisan staf");
    expect(h.state.articles).toHaveLength(1);
  });
});

describe("content:remove-samples", () => {
  it("requires --operator", async () => {
    const h = contentHarness();
    const result = await runContentRemoveSamples(deps(h, await files([])), {});
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toContain("--operator");
  });

  it("unpublishes and deletes only sample articles, audited", async () => {
    const h = contentHarness();
    const f = await files([sambung, halimun]);
    await runContentSeed(deps(h, f), {});
    const staff = await h.service.create({ id: "U-05", label: "Sinta P. (SEO)" }, "sambung", idText({ slug: "tulisan-staf" }));
    const before = h.state.audit.length;
    const result = await runContentRemoveSamples(deps(h, f), { operator: "Rina" });
    expect(result).toMatchObject({ exitCode: 0, removed: 2 });
    expect(h.state.articles.map((a) => a.id)).toEqual([staff.id]);
    expect(h.state.audit.slice(before).map((a) => [a.code, a.actor])).toEqual([
      ["ARTICLE_UNPUBLISHED", "CLI: Rina"], ["ARTICLE_DELETED", "CLI: Rina"], ["ARTICLE_UNPUBLISHED", "CLI: Rina"], ["ARTICLE_DELETED", "CLI: Rina"],
    ]);
    expect(await runContentRemoveSamples(deps(h, f), { operator: "Rina" })).toMatchObject({ exitCode: 0, removed: 0 });
  });
});
