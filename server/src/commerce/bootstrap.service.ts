import { Injectable, OnModuleInit } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CatalogService } from "./catalog.service";

@Injectable()
export class BootstrapService implements OnModuleInit {
  constructor(
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.catalog.reload();
    await this.auth.seedIfEmpty();
  }
}
