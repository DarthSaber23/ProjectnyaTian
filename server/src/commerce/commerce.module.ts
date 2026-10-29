import { Module } from "@nestjs/common";
import { AccountApi } from "./account.api";
import { AdminService } from "./admin.service";
import { AuthService } from "./auth.service";
import { BootstrapService } from "./bootstrap.service";
import { CatalogService } from "./catalog.service";
import { CommerceController } from "./commerce.controller";
import { OrderService } from "./order.service";
import { ReservationSweeper } from "./reservation-sweeper";

@Module({
  controllers: [CommerceController],
  providers: [CatalogService, AuthService, OrderService, AdminService, AccountApi, BootstrapService, ReservationSweeper],
  exports: [CatalogService, AuthService],
})
export class CommerceModule {}
