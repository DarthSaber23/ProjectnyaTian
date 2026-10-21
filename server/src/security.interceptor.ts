import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<{ setHeader: (name: string, value: string) => void }>();
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    const request = context.switchToHttp().getRequest<{ protocol?: string; headers?: Record<string, string | undefined> }>();
    const forwarded = request.headers?.["x-forwarded-proto"];
    if (request.protocol === "https" || forwarded === "https") {
      response.setHeader("Strict-Transport-Security", "max-age=15552000");
    }
    return next.handle();
  }
}
