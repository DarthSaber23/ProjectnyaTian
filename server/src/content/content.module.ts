import { Module } from "@nestjs/common";
import { CommerceModule } from "../commerce/commerce.module";
import { StorageModule } from "../storage.module";
import { AdminContentController } from "./admin-content.controller";
import { ArticleService } from "./article.service";
import { ContentEvents } from "./content-events";
import { PermissionGuard } from "./permission.guard";
import { PublicContentController } from "./public-content.controller";
import { PublicContentService } from "./public-content.service";
import { SeoService } from "./seo.service";

@Module({
  imports: [CommerceModule, StorageModule],
  controllers: [AdminContentController, PublicContentController],
  providers: [ArticleService, SeoService, ContentEvents, PermissionGuard, PublicContentService],
  exports: [ArticleService, SeoService, ContentEvents, PublicContentService],
})
export class ContentModule {}
