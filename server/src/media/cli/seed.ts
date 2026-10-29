import { mediaKey } from "../public-image";
import { argValue, buildDeps, cliActor, initStorage, loadSample, readSamples, validateSamples, type CliDeps } from "./common";

/**
 * `npm run media:seed [-- --operator "<nama>"] [--repair-files]`. Run by hand, never on deploy. Validates every
 * entry before any write; adds samples only where no photo and no earlier removal exists; running twice changes
 * nothing. `--repair-files` only re-uploads missing objects of existing sample rows.
 */
export async function runSeed(deps: CliDeps, opts: { repairFiles: boolean; operator?: string }): Promise<{ exitCode: 0 | 1; added: number; skipped: number; lines: string[] }> {
  const lines: string[] = [];
  const fail = () => ({ exitCode: 1 as const, added: 0, skipped: 0, lines });
  let entries;
  try {
    entries = readSamples(deps.seedDir);
  } catch (error) {
    lines.push(`samples.json tidak terbaca (${error instanceof Error ? error.name : "Error"})`);
    return fail();
  }
  const problems = await validateSamples(entries, { prisma: deps.prisma, seedDir: deps.seedDir });
  if (problems.length) {
    lines.push("Foto contoh tidak valid; tidak ada yang ditulis:", ...problems);
    return fail();
  }
  const storageDown = await initStorage(deps.storage);
  if (storageDown) {
    lines.push(storageDown);
    return fail();
  }
  const samples = entries.map((entry) => loadSample(entry, deps.seedDir));

  if (opts.repairFiles) {
    let repaired = 0;
    const rows = await deps.prisma.productImage.findMany({ where: { source: "sample" } });
    for (const row of rows) {
      const sample = samples.find((s) => s.entry.productId === row.productId && s.hash === row.hash);
      if (!sample) continue;
      for (const copy of sample.copies) {
        const key = mediaKey(row.productId, row.hash.slice(0, 16), copy.target);
        if (await deps.storage.exists(key)) continue;
        await deps.storage.putObject(key, copy.buffer, "image/webp");
        repaired += 1;
      }
    }
    lines.push(`Dipulihkan: ${repaired} file`);
    return { exitCode: 0, added: 0, skipped: 0, lines };
  }

  const actor = cliActor(opts.operator);
  let added = 0;
  let skipped = 0;
  for (const sample of samples) {
    const outcome = await deps.media.addSample(actor, sample.entry, sample.copies);
    if (outcome === "added") added += 1;
    else {
      skipped += 1;
      lines.push(`Dilewati: ${sample.entry.productId} (sudah ada foto atau foto pernah dihapus)`);
    }
  }
  lines.push(`Ditambahkan: ${added}, dilewati: ${skipped}`, "Mulai ulang API (docker compose restart api) agar katalog memuat foto.");
  return { exitCode: 0, added, skipped, lines };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const argv = process.argv.slice(2);
  let code: 0 | 1 = 1;
  try {
    const result = await runSeed(deps, { repairFiles: argv.includes("--repair-files"), operator: argValue(argv, "--operator") });
    for (const line of result.lines) console.log(line);
    code = result.exitCode;
  } catch (error) {
    console.error(`media:seed gagal (${error instanceof Error ? error.name : "Error"}). Jalankan lagi untuk melanjutkan.`);
  } finally {
    await deps.close();
  }
  process.exit(code);
}

if (typeof require !== "undefined" && require.main === module) void main();
