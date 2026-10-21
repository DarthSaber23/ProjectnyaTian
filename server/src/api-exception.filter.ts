import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<JsonResponse>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "object" && body && "code" in body) {
        const structured = body as { code: string; message?: string; details?: unknown[] };
        res.status(status).json({
          error: { code: structured.code, message: structured.message ?? exception.message, details: structured.details ?? [] },
        });
        return;
      }
      const message = typeof body === "string" ? body : (body as { message?: string | string[] }).message;
      const text = Array.isArray(message) ? message.join(", ") : message ?? exception.message;
      res.status(status).json({ error: { code: status === 404 ? "NOT_FOUND" : "VALIDATION", message: text, details: [] } });
      return;
    }
    const message = exception instanceof Error ? exception.message : "Unexpected error";
    const unknownSku = message.startsWith("Unknown SKU");
    const invalid = exception instanceof RangeError || exception instanceof TypeError;
    const status = unknownSku ? HttpStatus.NOT_FOUND : invalid ? HttpStatus.UNPROCESSABLE_ENTITY : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = unknownSku ? "NOT_FOUND" : invalid ? "VALIDATION" : "INTERNAL";
    const publicMessage = status === 500 ? "Terjadi kesalahan pada server." : message;
    res.status(status).json({ error: { code, message: publicMessage, details: [] } });
  }
}
