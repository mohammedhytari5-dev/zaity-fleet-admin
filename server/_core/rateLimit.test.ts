import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, rateLimitKey } from "./rateLimit";

describe("fixed window rate limiter", () => {
  it("allows attempts up to the limit and then blocks", () => {
    const limiter = new FixedWindowRateLimiter(60_000, 3);
    expect(limiter.check("a", 1000).allowed).toBe(true);
    expect(limiter.check("a", 1001).allowed).toBe(true);
    const third = limiter.check("a", 1002);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = limiter.check("a", 1003);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(60_000 - 3);
  });

  it("tracks keys independently", () => {
    const limiter = new FixedWindowRateLimiter(60_000, 1);
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 0).allowed).toBe(false);
    expect(limiter.check("b", 0).allowed).toBe(true);
  });

  it("reopens the window once it expires", () => {
    const limiter = new FixedWindowRateLimiter(1000, 1);
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 999).allowed).toBe(false);
    expect(limiter.check("a", 1000).allowed).toBe(true);
  });

  it("resets a key after a successful login", () => {
    const limiter = new FixedWindowRateLimiter(60_000, 1);
    limiter.check("a", 0);
    expect(limiter.check("a", 0).allowed).toBe(false);
    limiter.reset("a");
    expect(limiter.check("a", 0).allowed).toBe(true);
  });

  it("keeps memory bounded under a flood of distinct keys", () => {
    // An unbounded key map would itself be a memory-exhaustion vector.
    const limiter = new FixedWindowRateLimiter(60_000, 5, 100);
    for (let i = 0; i < 5_000; i += 1) limiter.check(`key-${i}`, 1000);
    expect(limiter.size).toBeLessThanOrEqual(100);
  });

  it("drops expired buckets without a background timer", () => {
    const limiter = new FixedWindowRateLimiter(1000, 5, 100);
    for (let i = 0; i < 50; i += 1) limiter.check(`key-${i}`, 0);
    expect(limiter.size).toBe(50);
    limiter.check("trigger", 5000);
    expect(limiter.size).toBe(1);
  });

  it("rejects nonsensical configuration", () => {
    expect(() => new FixedWindowRateLimiter(0, 5)).toThrow();
    expect(() => new FixedWindowRateLimiter(1000, 0)).toThrow();
  });
});

describe("rate limit keys", () => {
  it("normalises case and whitespace and joins parts", () => {
    expect(rateLimitKey(" 10.0.0.1 ", "Admin ")).toBe("10.0.0.1|admin");
  });

  it("tolerates missing parts", () => {
    expect(rateLimitKey(undefined, null, "x")).toBe("||x");
  });
});
