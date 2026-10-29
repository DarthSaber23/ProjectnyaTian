import { describe, expect, it } from "vitest";
import { MediaBusyException } from "./errors";
import { ImageJobLimiter } from "./limiter";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
};

describe("ImageJobLimiter", () => {
  it("runs 2 jobs at once and queues the rest", async () => {
    const limiter = new ImageJobLimiter(2, 5_000);
    const gates = [deferred(), deferred(), deferred()];
    let running = 0;
    let peak = 0;
    const jobs = gates.map((g) => limiter.run(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await g.promise;
      running -= 1;
    }));
    await new Promise((r) => setTimeout(r, 10));
    expect(running).toBe(2);
    gates.forEach((g) => g.resolve());
    await Promise.all(jobs);
    expect(peak).toBe(2);
  });

  it("rejects with MediaBusyException when a job cannot start within the wait (waitMs=50 in the test)", async () => {
    const limiter = new ImageJobLimiter(1, 50);
    const gate = deferred();
    const first = limiter.run(() => gate.promise);
    await expect(limiter.run(async () => "late")).rejects.toBeInstanceOf(MediaBusyException);
    gate.resolve();
    await first;
  });

  it("frees the slot when a job throws", async () => {
    const limiter = new ImageJobLimiter(1, 1_000);
    await expect(limiter.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(limiter.run(async () => "next")).resolves.toBe("next");
  });
});
