import { BadRequestException, Catch, PayloadTooLargeException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import { ApiExceptionFilter } from "../api-exception.filter";
import { MediaBusyException, mediaError } from "./errors";

/**
 * Upload route only. Nest's FileInterceptor turns Multer's size limit into a plain PayloadTooLargeException and
 * other multipart faults into BadRequestException, both without a `code`; this gives them the spec's codes.
 * Everything else goes to the unchanged global ApiExceptionFilter.
 */
@Catch()
export class UploadExceptionFilter implements ExceptionFilter {
  private readonly fallback = new ApiExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost): void {
    let error = exception;
    if (exception instanceof PayloadTooLargeException) error = mediaError("tooLarge");
    else if (exception instanceof BadRequestException) error = mediaError("noFile");
    if (exception instanceof MediaBusyException) {
      const response = host.switchToHttp().getResponse<{ headersSent: boolean; setHeader(name: string, value: string): void }>();
      if (!response.headersSent) response.setHeader("Retry-After", String(exception.retryAfterSeconds));
    }
    this.fallback.catch(error, host);
  }
}
