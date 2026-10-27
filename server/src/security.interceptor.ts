import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { cachePolicy } from "./cache-policy";
import { isHttps } from "./commerce/session-cookie";

@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<{ setHeader: (name: string, value: string) => void }>();
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    const request = context.switchToHttp().getRequest<{ method: string; originalUrl?: string; url?: string; protocol?: string; headers?: Record<string, string | undefined> }>();
    const path = (request.originalUrl ?? request.url ?? "").split("?")[0] ?? "";
    response.setHeader("Cache-Control", cachePolicy(request.method, path));
    if (isHttps(request)) {
      response.setHeader("Strict-Transport-Security", "max-age=15552000");
    }
    return next.handle();
  }
}
