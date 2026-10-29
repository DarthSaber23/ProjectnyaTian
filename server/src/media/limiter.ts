import { MediaBusyException } from "./errors";
import { LIMITER_JOBS, LIMITER_WAIT_MS } from "./limits";

/**
 * Bounds image work in the API process, which also serves checkout: at most `jobs` at once, and a job that cannot
 * start within `waitMs` is refused with 503 instead of queueing without limit.
 */
export class ImageJobLimiter {
  private active = 0;
  private readonly waiting: Array<{ start: () => void; timer: NodeJS.Timeout }> = [];

  constructor(
    private readonly jobs = LIMITER_JOBS,
    private readonly waitMs = LIMITER_WAIT_MS,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.jobs) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const entry = {
        start: () => {
          clearTimeout(entry.timer);
          this.active += 1;
          resolve();
        },
        timer: setTimeout(() => {
          const index = this.waiting.indexOf(entry);
          if (index >= 0) this.waiting.splice(index, 1);
          reject(new MediaBusyException());
        }, this.waitMs),
      };
      this.waiting.push(entry);
    });
  }

  private release(): void {
    this.active -= 1;
    this.waiting.shift()?.start();
  }
}
