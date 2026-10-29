import { UPLOAD_LIMIT, UPLOAD_WINDOW_MS } from "./limits";

/** Sliding window of upload attempts per staff member (20 per 10 minutes). In process memory; a restart clears it. */
export class UploadRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit = UPLOAD_LIMIT,
    private readonly windowMs = UPLOAD_WINDOW_MS,
  ) {}

  /** Records an attempt and answers whether it is allowed. A refused attempt is not recorded. */
  hit(staffId: string, now = Date.now()): boolean {
    const recent = (this.hits.get(staffId) ?? []).filter((t) => now - t < this.windowMs);
    const allowed = recent.length < this.limit;
    if (allowed) recent.push(now);
    this.hits.set(staffId, recent);
    return allowed;
  }
}
