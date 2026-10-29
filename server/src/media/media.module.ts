import { Module } from "@nestjs/common";
import { CommerceModule } from "../commerce/commerce.module";
import { StorageModule } from "../storage.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { StaffMediaGuard } from "./staff-media.guard";

@Module({
  imports: [CommerceModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaService, StaffMediaGuard],
})
export class MediaModule {}
