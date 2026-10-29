/**
 * Runs one product's photo requests one at a time in the order issued, so an alt save never overlaps a
 * full-order request. A failed job rejects its own caller and does not block the next one.
 */
export function createSerialQueue(): { enqueue<T>(job: () => Promise<T>): Promise<T> } {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    enqueue<T>(job: () => Promise<T>): Promise<T> {
      const run = tail.then(job);
      tail = run.catch(() => undefined);
      return run;
    },
  };
}
