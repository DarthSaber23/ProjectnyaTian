import { argValue, cliActor } from "../../media/cli/common";
import { buildContentDeps, type ContentCliDeps } from "./common";

/**
 * `npm run content:remove-samples -- --operator "<nama>"`. Deletes every `sample` article through the same
 * ArticleService as staff (unpublish first when live, then delete; both audited). Their URLs then answer 404.
 * Staff-written articles are never touched.
 */
export async function runContentRemoveSamples(deps: ContentCliDeps, opts: { operator?: string }): Promise<{ exitCode: 0 | 1; removed: number; lines: string[] }> {
  const lines: string[] = [];
  if (!opts.operator) {
    lines.push('Wajib diisi: --operator "<nama>" (perintah ini menghapus artikel).');
    return { exitCode: 1, removed: 0, lines };
  }
  const actor = cliActor(opts.operator);
  const rows = await deps.prisma.article.findMany({ where: { sample: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  let removed = 0;
  for (const row of rows) {
    const view = await deps.articles.get(row.id);
    if (view.status === "published") await deps.articles.unpublish(actor, row.id, { version: view.version });
    await deps.articles.remove(actor, row.id);
    removed += 1;
  }
  lines.push(`Dihapus: ${removed}`, "Mulai ulang API (docker compose restart api) agar halaman blog dimuat ulang.");
  return { exitCode: 0, removed, lines };
}

async function main(): Promise<void> {
  const deps = buildContentDeps();
  let code: 0 | 1 = 1;
  try {
    const result = await runContentRemoveSamples(deps, { operator: argValue(process.argv.slice(2), "--operator") });
    for (const line of result.lines) console.log(line);
    code = result.exitCode;
  } catch (error) {
    console.error(`content:remove-samples gagal (${error instanceof Error ? error.name : "Error"}). Jalankan lagi untuk melanjutkan.`);
  } finally {
    await deps.close();
  }
  process.exit(code);
}

if (typeof require !== "undefined" && require.main === module) void main();
