import { Injectable, OnModuleInit } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CatalogService } from "./catalog.service";
import { seedDummyExtras } from "./dummy-seed";
import { PrismaService } from "../prisma.service";

@Injectable()
export class BootstrapService implements OnModuleInit {
  constructor(
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.catalog.reload();
    await this.auth.seedIfEmpty();
    await seedDummyExtras(this.prisma);
  }
}
