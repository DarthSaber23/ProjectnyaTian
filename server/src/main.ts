import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./api-exception.filter";
import { SecurityInterceptor } from "./security.interceptor";
import { bearerFromCookie, corsOrigins, crossSiteWrite } from "./commerce/session-cookie";
import { siteConfig } from "./seo/site-config";

type CookieRequest = { method: string; path: string; headers: Record<string, string | string[] | undefined> };
type JsonResponse = { status(code: number): { json(body: unknown): void } };

async function bootstrap(): Promise<void> {
  // A wrong SITE_BRAND or PUBLIC_BASE_URL stops the start here, not on the first page request.
  siteConfig();
  const app = await NestFactory.create(AppModule);
  const origins = corsOrigins(process.env.CORS_ORIGINS);
  if (origins.length) app.enableCors({ origin: origins, credentials: true });
  app.use((req: CookieRequest, res: JsonResponse, next: () => void) => {
    const origin = header(req.headers.origin);
    if (crossSiteWrite({ method: req.method, host: header(req.headers.host), origin }) && !origins.includes(origin ?? "")) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Permintaan dari situs lain ditolak.", details: [] } });
      return;
    }
    if (!req.headers.authorization) {
      const bearer = bearerFromCookie({ path: req.path, cookie: header(req.headers.cookie) });
      if (bearer) req.headers.authorization = bearer;
    }
    next();
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new SecurityInterceptor());
  app.setGlobalPrefix("v1", { exclude: ["health", "render", "sitemap.xml", "robots.txt"] });
  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port, "0.0.0.0");
}

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

void bootstrap();
