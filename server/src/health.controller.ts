import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { ObjectStorage } from "./storage.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorage,
  ) {}

  @Get()
  async check(): Promise<{ ok: true; service: string; databaseUser: string; storage: string; bucket: string }> {
    const rows = await this.prisma.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;
    const marker = new Date().toISOString();
    await this.storage.putText("health/ping.txt", marker);
    const readBack = await this.storage.getText("health/ping.txt");
    if (readBack !== marker) throw new Error("MinIO readback did not match the write");
    return {
      ok: true,
      service: "tian-api",
      databaseUser: rows[0]?.current_user ?? "",
      storage: "minio",
      bucket: this.storage.bucket,
    };
  }
}
