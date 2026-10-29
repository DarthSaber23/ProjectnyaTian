import { argValue, buildDeps, cliActor, initStorage, type CliDeps } from "./common";

/**
 * `npm run media:remove-samples -- --operator "<nama>"`. Deletes every `source: "sample"` photo through the same
 * MediaService.remove as staff deletes (audit, link clearing, renumbering). A run that changes nothing writes nothing.
 */
export async function runRemoveSamples(deps: CliDeps, opts: { operator?: string }): Promise<{ exitCode: 0 | 1; removed: number; lines: string[] }> {
  const lines: string[] = [];
  if (!opts.operator) {
    lines.push('Wajib diisi: --operator "<nama>" (perintah ini menghapus foto).');
    return { exitCode: 1, removed: 0, lines };
  }
  const storageDown = await initStorage(deps.storage);
  if (storageDown) {
    lines.push(storageDown);
    return { exitCode: 1, removed: 0, lines };
  }
  const actor = cliActor(opts.operator);
  const rows = await deps.prisma.productImage.findMany({ where: { source: "sample" }, orderBy: [{ productId: "asc" }, { position: "asc" }], select: { id: true, productId: true } });
  let removed = 0;
  for (const row of rows) {
    await deps.media.remove(actor, row.productId, row.id);
    removed += 1;
  }
  lines.push(`Dihapus: ${removed}`, "Mulai ulang API (docker compose restart api) agar katalog kembali ke gambar ilustrasi.");
  return { exitCode: 0, removed, lines };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  let code: 0 | 1 = 1;
  try {
    const result = await runRemoveSamples(deps, { operator: argValue(process.argv.slice(2), "--operator") });
    for (const line of result.lines) console.log(line);
    code = result.exitCode;
  } catch (error) {
    console.error(`media:remove-samples gagal (${error instanceof Error ? error.name : "Error"}). Jalankan lagi untuk melanjutkan.`);
  } finally {
    await deps.close();
  }
  process.exit(code);
}

if (typeof require !== "undefined" && require.main === module) void main();
