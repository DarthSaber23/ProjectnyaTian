import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Req, UploadedFile, UseFilters, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { mediaError } from "./errors";
import { MAX_UPLOAD_BYTES } from "./limits";
import { MediaService } from "./media.service";
import type { MediaActor } from "./media.types";
import { StaffMediaGuard } from "./staff-media.guard";
import { UploadExceptionFilter } from "./upload-exception.filter";

type MediaRequest = { mediaActor: MediaActor };
type Fields = Record<string, unknown> | undefined;
const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/** Admin photo endpoints. The class-level guard covers every route; responses stay `private, no-store`. */
@Controller("admin")
@UseGuards(StaffMediaGuard)
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get("products")
  list() {
    return this.media.list();
  }

  @Post("products/:id/images")
  @UseInterceptors(FileInterceptor("file", { limits: { files: 1, fields: 2, parts: 4, fileSize: MAX_UPLOAD_BYTES } }))
  @UseFilters(UploadExceptionFilter)
  upload(@Req() req: MediaRequest, @Param("id") id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: Fields) {
    if (!file || !Buffer.isBuffer(file.buffer)) throw mediaError("noFile");
    return this.media.upload(
      req.mediaActor,
      id,
      { buffer: file.buffer, originalname: file.originalname, size: file.size },
      { alt: text(body?.alt), rightsConfirmed: text(body?.rightsConfirmed) },
    );
  }

  @Patch("products/:id/images/:imageId")
  changeAlt(@Req() req: MediaRequest, @Param("id") id: string, @Param("imageId") imageId: string, @Body() body: Fields) {
    return this.media.changeAlt(req.mediaActor, id, imageId, body?.alt);
  }

  @Put("products/:id/images/order")
  reorder(@Req() req: MediaRequest, @Param("id") id: string, @Body() body: Fields) {
    return this.media.reorder(req.mediaActor, id, body?.ids);
  }

  @Put("variants/:sku/image")
  linkVariant(@Req() req: MediaRequest, @Param("sku") sku: string, @Body() body: Fields) {
    const imageId = body?.imageId ?? null;
    if (imageId !== null && typeof imageId !== "string") throw mediaError("notThisProducts");
    return this.media.linkVariant(req.mediaActor, sku, imageId);
  }

  @Delete("products/:id/images/:imageId")
  remove(@Req() req: MediaRequest, @Param("id") id: string, @Param("imageId") imageId: string) {
    return this.media.remove(req.mediaActor, id, imageId);
  }
}
