import { Module } from "@nestjs/common";
import { CommerceModule } from "../commerce/commerce.module";
import { ContentModule } from "../content/content.module";
import { RenderController } from "./render.controller";
import { RenderService } from "./render.service";
import { SHELL_SOURCE, ShellSource } from "./shell";

@Module({
  imports: [CommerceModule, ContentModule],
  controllers: [RenderController],
  providers: [RenderService, { provide: SHELL_SOURCE, useClass: ShellSource }],
})
export class SeoModule {}
