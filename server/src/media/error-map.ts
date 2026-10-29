import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { mediaError } from "./errors";

const STORAGE_ERROR_NAMES = new Set([
  "ServiceUnavailable", "NoSuchBucket", "AccessDenied", "InternalError", "SlowDown", "RequestTimeout", "TimeoutError",
  "NetworkingError", "CredentialsProviderError", "InvalidAccessKeyId", "SignatureDoesNotMatch", "NotFound",
]);
const CONNECTION_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"]);
const PIXEL_LIMIT = /pixel limit/i;
const DECODE = /unsupported image format|premature end|corrupt header|^Vips|Input (buffer|file) (contains|has|is)/i;

export function isStorageError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return STORAGE_ERROR_NAMES.has(error.name) || "$metadata" in error || (typeof code === "string" && CONNECTION_CODES.has(code));
}

/** The HttpException a media failure answers with, or the error unchanged when it is a bug (500). */
export function toMediaError(error: unknown): unknown {
  if (error instanceof HttpException) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") return mediaError("photoDeleted");
    if (error.code === "P2002") {
      const target = String(error.meta?.target ?? "");
      if (target.includes("position")) return mediaError("positionCollision");
      if (target.includes("hash")) return mediaError("duplicate");
    }
    return error;
  }
  if (isStorageError(error)) return mediaError("storageUnavailable");
  if (error instanceof Error && PIXEL_LIMIT.test(error.message)) return mediaError("tooManyPixels");
  if (error instanceof Error && DECODE.test(error.message)) return mediaError("corrupt");
  return error;
}

export function mapMediaError(error: unknown): never {
  throw toMediaError(error);
}
