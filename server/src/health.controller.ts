import { randomUUID } from "crypto";
import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { ObjectStorage } from "./storage.service";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
  ) {}

  /** Storage trouble never fails health: photos degrade, checkout keeps working (spec section 1). */
  @Get()
  async check(): Promise<{ ok: true; service: string; databaseUser: string; storage: string; bucket: string }> {
    const rows = await this.prisma.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;
    return {
      ok: true,
      service: "tian-api",
      databaseUser: rows[0]?.current_user ?? "",
      storage: (await this.storageRoundTrip()) ? "minio" : "degraded",
      bucket: this.storage.bucket,
    };
  }

  private async storageRoundTrip(): Promise<boolean> {
    if (!this.storage.ready) return false;
    // One key per probe, so two overlapping probes never read each other's marker.
    const key = `health/ping-${randomUUID()}.txt`;
    try {
      const marker = new Date().toISOString();
      await this.storage.putText(key, marker);
      return (await this.storage.getText(key)) === marker;
    } catch {
      return false;
    } finally {
      await this.storage.deleteObjects([key]).catch(() => undefined);
    }
  }
}
