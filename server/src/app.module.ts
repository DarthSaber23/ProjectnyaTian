import { Module } from "@nestjs/common";
import { CommerceModule } from "./commerce/commerce.module";
import { HealthController } from "./health.controller";
import { MediaModule } from "./media/media.module";
import { PrismaModule } from "./prisma.module";
import { StorageModule } from "./storage.module";

@Module({
  imports: [PrismaModule, StorageModule, CommerceModule, MediaModule],
  controllers: [HealthController],
})
export class AppModule {}
