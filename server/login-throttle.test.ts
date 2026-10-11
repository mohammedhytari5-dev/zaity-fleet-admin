import { beforeEach, describe, expect, it } from "vitest";
import { loginRateLimit } from "./login-throttle";

beforeEach(() => {
  loginRateLimit.clear();
});

describe("login attempt throttling", () => {
  it("allows a normal number of attempts", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(loginRateLimit.retryAfterMs("10.0.0.1", "admin")).toBe(0);
    }
  });

  it("blocks repeated guessing against one account", () => {
    const ip = "10.0.0.2";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      loginRateLimit.retryAfterMs(ip, "admin");
    }
    // The ninth attempt against the same account is refused.
    expect(loginRateLimit.retryAfterMs(ip, "admin")).toBeGreaterThan(0);
  });

  it("blocks password spraying across many accounts from one address", () => {
    // The per-account window alone would miss this: each username is tried once.
    const ip = "10.0.0.3";
    for (let attempt = 0; attempt < 30; attempt += 1) {
      loginRateLimit.retryAfterMs(ip, `user-${attempt}`);
    }
    expect(loginRateLimit.retryAfterMs(ip, "user-999")).toBeGreaterThan(0);
  });

  it("does not let one address's failures block another address", () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      loginRateLimit.retryAfterMs("10.0.0.4", "admin");
    }
    expect(loginRateLimit.retryAfterMs("10.0.0.5", "admin")).toBe(0);
  });

  it("clears the account window after a successful sign-in", () => {
    const ip = "10.0.0.6";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      loginRateLimit.retryAfterMs(ip, "admin");
    }
    expect(loginRateLimit.retryAfterMs(ip, "admin")).toBeGreaterThan(0);

    loginRateLimit.reset(ip, "admin");
    expect(loginRateLimit.retryAfterMs(ip, "admin")).toBe(0);
  });

  it("reports a minute-scale wait so the message can be actionable", () => {
    const ip = "10.0.0.7";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      loginRateLimit.retryAfterMs(ip, "admin");
    }
    const wait = loginRateLimit.retryAfterMs(ip, "admin");
    expect(wait).toBeGreaterThan(60_000);
    expect(wait).toBeLessThanOrEqual(15 * 60_000);
  });
});
