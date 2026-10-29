import { describe, expect, it, vi } from "vitest";
import { HealthController } from "./health.controller";
import type { PrismaService } from "./prisma.service";
import { fakeStorage } from "./test/fake-storage";

const prisma = { $queryRaw: async () => [{ current_user: "tian_app" }] } as unknown as PrismaService;

describe("HealthController", () => {
  it("reports storage degraded with the normal result when not ready and does not call putText", async () => {
    const storage = fakeStorage();
    storage.ready = false;
    const putText = vi.spyOn(storage, "putText");
    const result = await new HealthController(prisma, storage).check();
    expect(result).toMatchObject({ ok: true, databaseUser: "tian_app", storage: "degraded" });
    expect(putText).not.toHaveBeenCalled();
  });

  it("reports degraded instead of throwing when the MinIO write fails", async () => {
    const storage = fakeStorage();
    storage.failAll = true;
    await expect(new HealthController(prisma, storage).check()).resolves.toMatchObject({ ok: true, storage: "degraded" });
  });

  it("reports minio when storage is ready and the round trip works", async () => {
    await expect(new HealthController(prisma, fakeStorage()).check()).resolves.toMatchObject({ storage: "minio", bucket: "tian-media" });
  });

  it("two overlapping probes both report minio and leave no probe object behind", async () => {
    const storage = fakeStorage();
    const controller = new HealthController(prisma, storage);
    const [a, b] = await Promise.all([controller.check(), controller.check()]);
    expect([a.storage, b.storage]).toEqual(["minio", "minio"]);
    expect([...storage.objects.keys()].filter((k) => k.startsWith("health/"))).toEqual([]);
  });
});
