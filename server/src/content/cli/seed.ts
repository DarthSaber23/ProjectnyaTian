import { userInfo } from "os";
import { hashPassword } from "../../commerce/crypto";
import { argValue, initStorage } from "../../media/cli/common";
import { buildContentDeps, coverFile, DEMO_SEO, readArticles, seedActor, validateArticles, type ContentCliDeps } from "./common";

/** Same demo password as the other demo staff (auth.service seed); remove demo accounts before launch. */
const DEMO_STAFF_PASSWORD = "demo-staff-2026";

/**
 * `npm run content:seed [-- --operator "<nama>"]`. Run by hand, never on deploy. Validates every entry before any
 * write; adds the demo SEO account when missing; adds each article whose Bahasa slug is free in its store, marked
 * `sample`, published now. Existing articles (staff-written or earlier samples) are never touched, so running twice
 * changes nothing.
 */
export async function runContentSeed(deps: ContentCliDeps, opts: { operator?: string }): Promise<{ exitCode: 0 | 1; added: number; skipped: number; lines: string[] }> {
  const lines: string[] = [];
  const fail = () => ({ exitCode: 1 as const, added: 0, skipped: 0, lines });
  let entries;
  try {
    entries = readArticles(deps.articlesFile);
  } catch (error) {
    lines.push(`articles.json tidak terbaca (${error instanceof Error ? error.name : "Error"})`);
    return fail();
  }
  const problems = await validateArticles(entries, { prisma: deps.prisma, mediaDir: deps.mediaDir });
  if (problems.length) {
    lines.push("Artikel contoh tidak valid; tidak ada yang ditulis:", ...problems);
    return fail();
  }
  if (entries.some((e) => e.cover)) {
    const storageDown = await initStorage(deps.storage);
    if (storageDown) {
      lines.push(storageDown);
      return fail();
    }
  }

  const actor = seedActor(opts.operator, userInfo().username);
  let added = 0;
  let skipped = 0;
  for (const entry of entries) {
    const { id: idText, en } = entry.texts;
    const taken = await deps.prisma.articleText.findFirst({ where: { storeId: entry.store, lang: "id", slug: idText.slug } });
    if (taken) {
      skipped += 1;
      lines.push(`Dilewati: ${entry.store}/${idText.slug} (slug sudah dipakai)`);
      continue;
    }
    if (added === 0) {
      await deps.prisma.staffAccount.upsert({
        where: { id: DEMO_SEO.id },
        create: { ...DEMO_SEO, passwordHash: hashPassword(DEMO_STAFF_PASSWORD) },
        update: {},
      });
    }
    let view = await deps.articles.create(actor, entry.store, idText, { sample: true });
    try {
      view = await deps.articles.save(actor, view.id, { version: view.version, texts: en ? { id: idText, en } : { id: idText }, tags: entry.tags, productIds: entry.productIds });
      const cover = entry.cover ? coverFile(deps.mediaDir, entry.cover.productId) : null;
      if (entry.cover && cover) view = await deps.articles.setCover(actor, view.id, cover, { alt: entry.cover.alt, rightsConfirmed: "true" });
      await deps.articles.publish(actor, view.id, { version: view.version });
    } catch (error) {
      // Leave no half-made draft that would block the next run.
      await deps.articles.remove(actor, view.id).catch(() => undefined);
      throw error;
    }
    added += 1;
  }
  lines.push(`Ditambahkan: ${added}, dilewati: ${skipped}`, "Mulai ulang API (docker compose restart api) agar halaman blog dimuat ulang.");
  return { exitCode: 0, added, skipped, lines };
}

async function main(): Promise<void> {
  const deps = buildContentDeps();
  let code: 0 | 1 = 1;
  try {
    const result = await runContentSeed(deps, { operator: argValue(process.argv.slice(2), "--operator") });
    for (const line of result.lines) console.log(line);
    code = result.exitCode;
  } catch (error) {
    console.error(`content:seed gagal (${error instanceof Error ? error.name : "Error"}). Jalankan lagi untuk melanjutkan.`);
  } finally {
    await deps.close();
  }
  process.exit(code);
}

if (typeof require !== "undefined" && require.main === module) void main();
