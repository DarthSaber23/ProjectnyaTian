import { Module } from "@nestjs/common";
import { CommerceModule } from "./commerce/commerce.module";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma.module";
import { ObjectStorage } from "./storage.service";

@Module({
  imports: [PrismaModule, CommerceModule],
  controllers: [HealthController],
  providers: [ObjectStorage],
})
export class AppModule {}
