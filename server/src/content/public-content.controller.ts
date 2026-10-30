import { Controller, Get, HttpException, Inject, Param, Query, Res } from "@nestjs/common";
import { siteConfig } from "../seo/site-config";
import type { Lang } from "./content.types";
import { PublicContentService } from "./public-content.service";

type Reply = { status(code: number): unknown; setHeader(name: string, value: string): unknown };
const lang = (value: unknown): Lang => (value === "en" ? "en" : "id");
const notFound = () => new HttpException({ code: "NOT_FOUND", message: "Artikel tidak ditemukan." }, 404);

/** Public article reads (spec section 5). Only the deployment's store; cached like the catalogue. */
@Controller()
export class PublicContentController {
  constructor(@Inject(PublicContentService) private readonly content: PublicContentService) {}

  @Get("articles")
  list(@Query("lang") l: string, @Query("page") page: string) {
    return this.content.list(siteConfig().brand, lang(l), Number(page) || 1);
  }

  @Get("articles/:slug")
  async article(@Param("slug") slug: string, @Query("lang") l: string, @Res({ passthrough: true }) res: Reply) {
    const found = await this.content.article(siteConfig().brand, lang(l), slug);
    if (!found) throw notFound();
    if ("redirect" in found) {
      res.status(301);
      res.setHeader("Location", `/v1/articles/${encodeURIComponent(found.redirect)}?lang=${lang(l)}`);
    }
    return found;
  }

  @Get("products/:slug/articles")
  related(@Param("slug") slug: string) {
    return this.content.forProduct(siteConfig().brand, slug);
  }
}
