import { Logger } from "@nestjs/common";

export type MediaEvent =
  | "media_upload_ok"
  | "media_upload_rejected"
  | "media_processing_failed"
  | "storage_unavailable"
  | "media_delete_ok"
  | "media_delete_files_failed"
  | "media_compensation_failed";

const logger = new Logger("Media");
const ERROR_EVENTS = new Set<MediaEvent>(["media_delete_files_failed", "media_compensation_failed"]);

/**
 * One structured line per upload, delete or compensation. Callers pass ids, sizes, durations, error classes and
 * keys only: never file contents, client filenames, alt text or credentials.
 */
export function logMedia(event: MediaEvent, fields: Record<string, unknown>): void {
  const parts = [`event=${event}`];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    parts.push(`${key}=${Array.isArray(value) ? value.join(",") : String(value)}`);
  }
  const line = parts.join(" ");
  if (ERROR_EVENTS.has(event)) logger.error(line);
  else logger.log(line);
}
