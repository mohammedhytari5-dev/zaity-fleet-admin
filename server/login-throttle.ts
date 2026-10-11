import { FixedWindowRateLimiter, rateLimitKey } from "./_core/rateLimit";

/**
 * Credential-attempt throttling for the username/password login.
 *
 * Two windows are enforced together:
 *   * per (address, username) - catches guessing against a single account;
 *   * per address             - catches spraying one password across many
 *                               accounts, which the first window would miss.
 *
 * Rejections are decided before the password is hashed, so a blocked attempt
 * costs no CPU. The limits are intentionally generous enough for a person
 * mistyping a password but far too small for automated guessing.
 */
const WINDOW_MS = 15 * 60_000;
const PER_ACCOUNT_LIMIT = 8;
const PER_ADDRESS_LIMIT = 30;

const perAccount = new FixedWindowRateLimiter(WINDOW_MS, PER_ACCOUNT_LIMIT);
const perAddress = new FixedWindowRateLimiter(WINDOW_MS, PER_ADDRESS_LIMIT);

export const loginRateLimit = {
  /**
   * Records an attempt and returns how long the caller must wait, in
   * milliseconds. Zero means the attempt may proceed.
   */
  retryAfterMs(ip: string, username: string): number {
    const account = perAccount.check(rateLimitKey(ip, username));
    const address = perAddress.check(rateLimitKey(ip));
    return Math.max(
      account.allowed ? 0 : account.retryAfterMs,
      address.allowed ? 0 : address.retryAfterMs
    );
  },

  /** Clears the per-account window after a successful sign-in. */
  reset(ip: string, username: string): void {
    perAccount.reset(rateLimitKey(ip, username));
  },

  /** Test seam. */
  clear(): void {
    perAccount.clear();
    perAddress.clear();
  },
};
