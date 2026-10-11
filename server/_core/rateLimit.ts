/**
 * Small in-process rate limiter used to protect credential endpoints.
 *
 * `express-rate-limit` covers the HTTP surface, but the login procedure is a
 * tRPC call whose URL can be batched (`/api/trpc/a,b`), so a path-mounted
 * limiter is not a reliable guard. This limiter is applied inside the procedure
 * and keyed on both the caller's address and the attempted username, which is
 * what actually stops credential stuffing and the event-loop stalls caused by
 * repeated password hashing.
 *
 * Deliberately dependency-free and bounded: an unbounded key map would itself
 * become a memory-exhaustion vector, so the number of tracked keys is capped
 * and expired buckets are pruned on every check.
 */

type Bucket = { count: number; resetAt: number };

export type RateLimitDecision = {
  allowed: boolean;
  /** Milliseconds until the window resets; 0 when the call is allowed. */
  retryAfterMs: number;
  remaining: number;
};

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
    private readonly maxTrackedKeys = 10_000
  ) {
    if (windowMs <= 0) throw new Error("windowMs must be positive");
    if (max <= 0) throw new Error("max must be positive");
  }

  /**
   * Records an attempt and reports whether it is allowed. Callers should check
   * *before* performing the expensive work so a rejected attempt costs nothing.
   */
  check(key: string, now: number = Date.now()): RateLimitDecision {
    this.prune(now);

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0, remaining: this.max - 1 };
    }

    if (existing.count >= this.max) {
      return {
        allowed: false,
        retryAfterMs: existing.resetAt - now,
        remaining: 0,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: this.max - existing.count,
    };
  }

  /** Clears a key's window, e.g. after a successful login. */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  get size(): number {
    return this.buckets.size;
  }

  clear(): void {
    this.buckets.clear();
  }

  /**
   * Drops expired buckets, and if the map is still at its cap, the entries
   * closest to expiring. Keeps memory bounded without a background timer.
   */
  private prune(now: number): void {
    if (this.buckets.size === 0) return;

    // Collected with forEach rather than `for..of` so this file compiles under
    // the project's pre-ES2015 `target` without `downlevelIteration`.
    const expired: string[] = [];
    this.buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) expired.push(key);
    });
    for (const key of expired) this.buckets.delete(key);

    if (this.buckets.size < this.maxTrackedKeys) return;

    const entries: Array<[string, Bucket]> = [];
    this.buckets.forEach((bucket, key) => entries.push([key, bucket]));
    const overflow = entries.length - this.maxTrackedKeys + 1;
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < overflow; i += 1) {
      const entry = entries[i];
      if (entry) this.buckets.delete(entry[0]);
    }
  }
}

/** Builds a stable limiter key; IPv6-safe because it is a plain string join. */
export function rateLimitKey(...parts: Array<string | undefined | null>): string {
  return parts.map(part => (part ?? "").trim().toLowerCase()).join("|");
}
