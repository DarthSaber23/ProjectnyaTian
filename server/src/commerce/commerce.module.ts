import { Module } from "@nestjs/common";
import { AccountApi } from "./account.api";
import { AdminService } from "./admin.service";
import { AuthService } from "./auth.service";
import { BootstrapService } from "./bootstrap.service";
import { CatalogService } from "./catalog.service";
import { CommerceController } from "./commerce.controller";
import { OrderService } from "./order.service";

@Module({
  controllers: [CommerceController],
  providers: [CatalogService, AuthService, OrderService, AdminService, AccountApi, BootstrapService],
})
export class CommerceModule {}
