import { Controller, Get, Headers, Inject, Query, Res } from "@nestjs/common";
import { RenderService } from "./render.service";
import { renderRobots } from "./robots";
import { siteConfig } from "./site-config";

type Reply = { status(code: number): unknown; setHeader(name: string, value: string): unknown; removeHeader(name: string): unknown };

/** Matches no page route, so the renderer answers with its 404 page. */
const NOT_FOUND_PATH = "/404";

/**
 * The page address from nginx's `X-Render-Uri` (the raw request line, still percent-encoded, with its query):
 * decoded once here. A malformed escape is a 404 page, never an error.
 */
function fromRenderUri(value: string): { path: string; page: number } {
  try {
    const url = new URL(value, "http://x");
    return { path: decodeURIComponent(url.pathname), page: Number(url.searchParams.get("page")) || 1 };
  } catch {
    return { path: NOT_FOUND_PATH, page: 1 };
  }
}

/**
 * Outside the /v1 prefix and reached only through nginx: `/render` for blog, product and category URLs,
 * plus `/sitemap.xml` and `/robots.txt`. The API's own CSP (`default-src 'none'`) is removed from the HTML,
 * which is the storefront page and must load its scripts and styles.
 */
@Controller()
export class RenderController {
  constructor(@Inject(RenderService) private readonly render: RenderService) {}

  /** nginx sends `X-Render-Uri`; the `path` and `page` query parameters serve direct calls. */
  @Get("render")
  async page(
    @Query("path") path: string,
    @Query("page") page: string,
    @Headers("if-none-match") ifNoneMatch: string,
    @Res({ passthrough: true }) res: Reply,
    @Headers("x-render-uri") renderUri?: string,
  ) {
    const target = renderUri ? fromRenderUri(renderUri) : { path: path || "/", page: Number(page) || 1 };
    const rendered = await this.render.render(target.path, { page: target.page, ifNoneMatch: ifNoneMatch || undefined });
    res.removeHeader("Content-Security-Policy");
    res.status(rendered.status);
    for (const [name, value] of Object.entries(rendered.headers)) res.setHeader(name, value);
    return rendered.body;
  }

  @Get("sitemap.xml")
  async sitemap(@Res({ passthrough: true }) res: Reply) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return this.render.sitemap();
  }

  @Get("robots.txt")
  robots(@Res({ passthrough: true }) res: Reply) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return renderRobots(siteConfig().baseUrl);
  }
}
