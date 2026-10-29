import { describe, expect, it } from "vitest";
import { createSerialQueue } from "./serial-queue";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe("createSerialQueue", () => {
  it("runs jobs one at a time in the order issued", async () => {
    const queue = createSerialQueue();
    const log: string[] = [];
    const first = deferred<string>();
    const a = queue.enqueue(async () => { log.push("a start"); const v = await first.promise; log.push("a end"); return v; });
    const b = queue.enqueue(async () => { log.push("b start"); return "b"; });
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(["a start"]);
    first.resolve("a");
    expect(await a).toBe("a");
    expect(await b).toBe("b");
    expect(log).toEqual(["a start", "a end", "b start"]);
  });

  it("a failed job rejects its caller and does not block the next", async () => {
    const queue = createSerialQueue();
    const failing = queue.enqueue(async () => { throw new Error("gagal"); });
    const next = queue.enqueue(async () => "lanjut");
    await expect(failing).rejects.toThrow("gagal");
    await expect(next).resolves.toBe("lanjut");
  });
});
