import { describe, expect, it } from "vitest";
import { harness, seededImage } from "../../test/media-harness";
import { cliDeps, makeSeedDir } from "../../test/sample-seed";
import { runRemoveSamples } from "./remove-samples";
import { runSeed } from "./seed";

describe("media:remove-samples", () => {
  it("refuses without --operator", async () => {
    const h = harness([{ ...seededImage("s0", 0), source: "sample" }]);
    const result = await runRemoveSamples(cliDeps(h, "unused"), {});
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("--operator");
    expect(h.state.images).toHaveLength(1);
  });

  it("deletes only sample photos; uploads move to positions 0 and 1; one PRODUCT_IMAGE_REMOVED per photo by 'CLI: {operator}'", async () => {
    const h = harness([
      { ...seededImage("s0", 0), source: "sample" },
      seededImage("u1", 1),
      { ...seededImage("s2", 2), source: "sample" },
      seededImage("u3", 3),
    ]);
    const result = await runRemoveSamples(cliDeps(h, "unused"), { operator: "Rina" });
    expect(result).toMatchObject({ exitCode: 0, removed: 2 });
    expect(result.lines.join("\n")).toContain("Dihapus: 2");
    expect(h.state.images.map((i) => [i.id, i.position]).sort()).toEqual([["u1", 0], ["u3", 1]]);
    const removed = h.state.audit.filter((a) => a.code === "PRODUCT_IMAGE_REMOVED");
    expect(removed.map((a) => [a.actor, (a.after as { actorId: string }).actorId])).toEqual([["CLI: Rina", "cli"], ["CLI: Rina", "cli"]]);

    const again = await runRemoveSamples(cliDeps(h, "unused"), { operator: "Rina" });
    expect(again).toMatchObject({ exitCode: 0, removed: 0 });
    expect(h.state.audit).toHaveLength(removed.length);
  });

  it("seed, remove-samples, seed again leaves zero photos", async () => {
    const seed = await makeSeedDir([{ productId: "B01", n: 1 }, { productId: "A01", n: 2 }]);
    const h = harness();
    await runSeed(cliDeps(h, seed.dir), { repairFiles: false });
    expect(h.state.images).toHaveLength(2);
    await runRemoveSamples(cliDeps(h, seed.dir), { operator: "Rina" });
    expect(await runSeed(cliDeps(h, seed.dir), { repairFiles: false })).toMatchObject({ added: 0, skipped: 2 });
    expect(h.state.images).toHaveLength(0);
    expect(h.storage.objects.size).toBe(0);
  });
});
