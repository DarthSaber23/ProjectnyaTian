import { describe, expect, it } from "vitest";
import { UploadRateLimiter } from "./rate-limit";

describe("UploadRateLimiter", () => {
  it("allows 20 uploads per staff member in 10 minutes and refuses the 21st", () => {
    const limiter = new UploadRateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 20; i++) expect(limiter.hit("s1", t0 + i)).toBe(true);
    expect(limiter.hit("s1", t0 + 20)).toBe(false);
  });

  it("an upload older than 10 minutes leaves the window", () => {
    const limiter = new UploadRateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 20; i++) limiter.hit("s1", t0);
    expect(limiter.hit("s1", t0 + 599_999)).toBe(false);
    expect(limiter.hit("s1", t0 + 600_000)).toBe(true);
  });

  it("counts staff members separately", () => {
    const limiter = new UploadRateLimiter();
    for (let i = 0; i < 20; i++) limiter.hit("s1", 5);
    expect(limiter.hit("s1", 6)).toBe(false);
    expect(limiter.hit("s2", 6)).toBe(true);
  });
});
