import { Body, Controller, Delete, Get, HttpException, Inject, Param, Post, Put, Query, Req, UploadedFile, UseFilters, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { BrandId } from "../domain/types";
import { mediaError } from "../media/errors";
import { MAX_UPLOAD_BYTES } from "../media/limits";
import type { MediaActor } from "../media/media.types";
import { UploadExceptionFilter } from "../media/upload-exception.filter";
import { ArticleService } from "./article.service";
import type { ArticleTextInput, Lang } from "./content.types";
import { PermissionGuard, RequirePermission } from "./permission.guard";
import { SeoService, type SeoKind } from "./seo.service";

type StaffRequest = { staffActor: MediaActor };
type Body = Record<string, unknown> | undefined;
const UPLOAD = FileInterceptor("file", { limits: { files: 1, fields: 2, parts: 4, fileSize: MAX_UPLOAD_BYTES } });
const invalid = (message: string) => new HttpException({ code: "VALIDATION", message }, 422);
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const optional = (v: unknown) => (typeof v === "string" ? v : null);

function store(value: unknown): BrandId {
  if (value !== "sambung" && value !== "halimun") throw invalid("Toko tidak dikenal.");
  return value;
}

function text(value: unknown): ArticleTextInput {
  if (!isRecord(value)) throw invalid("Isi artikel tidak valid.");
  return {
    slug: str(value.slug), title: str(value.title), seoTitle: optional(value.seoTitle), metaDescription: str(value.metaDescription),
    summary: str(value.summary), body: str(value.body), noindex: value.noindex === true, canonicalUrl: optional(value.canonicalUrl),
  };
}

function version(body: Body): number {
  const v = body?.version;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) throw invalid("Versi artikel wajib dikirim.");
  return v;
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Admin blog and SEO endpoints (spec section 3). The class guard runs before Multer reads any upload. */
@Controller("admin")
@UseGuards(PermissionGuard)
export class AdminContentController {
  constructor(
    @Inject(ArticleService) private readonly articles: ArticleService,
    @Inject(SeoService) private readonly seo: SeoService,
  ) {}

  @Get("articles")
  @RequirePermission("articles.manage")
  list(@Query("store") storeId: string) {
    return this.articles.list(store(storeId));
  }

  @Post("articles")
  @RequirePermission("articles.manage")
  create(@Req() req: StaffRequest, @Body() body: Body) {
    return this.articles.create(req.staffActor, store(body?.store), text(body?.text));
  }

  @Get("articles/:id")
  @RequirePermission("articles.manage")
  get(@Param("id") id: string) {
    return this.articles.get(id);
  }

  @Put("articles/:id")
  @RequirePermission("articles.manage")
  save(@Req() req: StaffRequest, @Param("id") id: string, @Body() body: Body) {
    const v = version(body);
    if (!isRecord(body?.texts)) throw invalid("Isi artikel tidak valid.");
    const texts: Partial<Record<Lang, ArticleTextInput | null>> = {};
    for (const lang of ["id", "en"] as const) {
      const value = body!.texts[lang];
      if (value === null) texts[lang] = null;
      else if (value !== undefined) texts[lang] = text(value);
    }
    return this.articles.save(req.staffActor, id, { version: v, texts, tags: strings(body?.tags), productIds: strings(body?.productIds) });
  }

  @Post("articles/:id/publish")
  @RequirePermission("articles.manage")
  publish(@Req() req: StaffRequest, @Param("id") id: string, @Body() body: Body) {
    return this.articles.publish(req.staffActor, id, { version: version(body), publishAt: optional(body?.publishAt) });
  }

  @Post("articles/:id/unpublish")
  @RequirePermission("articles.manage")
  unpublish(@Req() req: StaffRequest, @Param("id") id: string, @Body() body: Body) {
    return this.articles.unpublish(req.staffActor, id, { version: version(body) });
  }

  @Delete("articles/:id")
  @RequirePermission("articles.manage")
  remove(@Req() req: StaffRequest, @Param("id") id: string) {
    return this.articles.remove(req.staffActor, id);
  }

  @Post("articles/:id/cover")
  @RequirePermission("articles.manage")
  @UseInterceptors(UPLOAD)
  @UseFilters(UploadExceptionFilter)
  setCover(@Req() req: StaffRequest, @Param("id") id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: Body) {
    if (!file || !Buffer.isBuffer(file.buffer)) throw mediaError("noFile");
    return this.articles.setCover(req.staffActor, id, { buffer: file.buffer, originalname: file.originalname, size: file.size }, { alt: optional(body?.alt) ?? undefined, rightsConfirmed: optional(body?.rightsConfirmed) ?? undefined });
  }

  @Delete("articles/:id/cover")
  @RequirePermission("articles.manage")
  removeCover(@Req() req: StaffRequest, @Param("id") id: string) {
    return this.articles.removeCover(req.staffActor, id);
  }

  @Post("articles/:id/images")
  @RequirePermission("articles.manage")
  @UseInterceptors(UPLOAD)
  @UseFilters(UploadExceptionFilter)
  addImage(@Req() req: StaffRequest, @Param("id") id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: Body) {
    if (!file || !Buffer.isBuffer(file.buffer)) throw mediaError("noFile");
    return this.articles.addBodyImage(req.staffActor, id, { buffer: file.buffer, originalname: file.originalname, size: file.size }, { rightsConfirmed: optional(body?.rightsConfirmed) ?? undefined });
  }

  @Get("seo")
  @RequirePermission("seo.edit")
  seoRows(@Query("store") storeId: string, @Query("kind") kind: string) {
    return this.seo.rows(store(storeId), kind as SeoKind);
  }

  @Put("seo/:kind/:key")
  @RequirePermission("seo.edit")
  setSeo(@Req() req: StaffRequest, @Param("kind") kind: string, @Param("key") key: string, @Body() body: Body) {
    return this.seo.set(req.staffActor, store(body?.store), kind as SeoKind, key, { seoTitle: optional(body?.seoTitle), metaDescription: optional(body?.metaDescription) });
  }

  @Delete("seo/:kind/:key")
  @RequirePermission("seo.edit")
  clearSeo(@Req() req: StaffRequest, @Param("kind") kind: string, @Param("key") key: string, @Query("store") storeId: string) {
    return this.seo.clear(req.staffActor, store(storeId), kind as SeoKind, key);
  }
}
