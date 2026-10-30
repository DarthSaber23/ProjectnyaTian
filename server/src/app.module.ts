import { Module } from "@nestjs/common";
import { CommerceModule } from "./commerce/commerce.module";
import { ContentModule } from "./content/content.module";
import { SeoModule } from "./seo/seo.module";
import { HealthController } from "./health.controller";
import { MediaModule } from "./media/media.module";
import { PrismaModule } from "./prisma.module";
import { StorageModule } from "./storage.module";

@Module({
  imports: [PrismaModule, StorageModule, CommerceModule, MediaModule, ContentModule, SeoModule],
  controllers: [HealthController],
})
export class AppModule {}
