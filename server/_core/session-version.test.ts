import { describe, expect, it } from "vitest";
import { MIN_SESSION_SECRET_LENGTH } from "@shared/const";
import { ENV } from "./env";
import { LEGACY_SESSION_VERSION, sdk } from "./sdk";

const GOOD_SECRET = "s".repeat(MIN_SESSION_SECRET_LENGTH);
const originalSecret = ENV.cookieSecret;

function withSecret(): void {
  ENV.cookieSecret = GOOD_SECRET;
}

describe("session version claims", () => {
  it("stamps the account's current session version into the token", async () => {
    withSecret();
    const token = await sdk.signSession({
      openId: "u1",
      appId: "app",
      name: "n",
      sessionVersion: 7,
    });
    await expect(sdk.verifySession(token)).resolves.toMatchObject({
      openId: "u1",
      sessionVersion: 7,
    });
  });

  it("treats tokens without a version claim as version 1", async () => {
    // Tokens issued before revocation support must keep working, and must still
    // be revocable: any later bump moves the account off version 1.
    withSecret();
    const token = await sdk.createSessionToken("u1", { name: "n" });
    await expect(sdk.verifySession(token)).resolves.toMatchObject({
      sessionVersion: LEGACY_SESSION_VERSION,
    });
  });

  it("lets the caller pass the version when creating a token", async () => {
    withSecret();
    const token = await sdk.createSessionToken("u1", { name: "n", sessionVersion: 3 });
    const session = await sdk.verifySession(token);
    expect(session?.sessionVersion).toBe(3);
  });

  it("ignores a non-integer version claim instead of trusting it", async () => {
    withSecret();
    // A malformed claim must not be able to masquerade as a higher version.
    const token = await sdk.signSession({
      openId: "u1",
      appId: "app",
      name: "n",
      sessionVersion: Number.NaN,
    });
    const session = await sdk.verifySession(token);
    expect(session?.sessionVersion).toBe(LEGACY_SESSION_VERSION);
  });

  it("rejects a token signed with a different secret regardless of version", async () => {
    withSecret();
    const token = await sdk.signSession({ openId: "u1", appId: "app", name: "n", sessionVersion: 2 });
    ENV.cookieSecret = "t".repeat(MIN_SESSION_SECRET_LENGTH);
    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });

  it("restores the configured secret", () => {
    ENV.cookieSecret = originalSecret;
    expect(ENV.cookieSecret).toBe(originalSecret);
  });
});

describe("session revocation decision", () => {
  /**
   * Mirrors the comparison `authenticateRequest` performs. Kept as a direct
   * expression so the rule is documented where it is tested.
   */
  const isRevoked = (tokenVersion: number, accountVersion: number) =>
    tokenVersion !== accountVersion;

  it("accepts a token whose version matches the account", () => {
    expect(isRevoked(1, 1)).toBe(false);
    expect(isRevoked(5, 5)).toBe(false);
  });

  it("revokes a token after the account version is bumped", () => {
    // Login issued version 1; a password reset bumped the account to 2.
    expect(isRevoked(1, 2)).toBe(true);
  });

  it("revokes every earlier token, not just the previous one", () => {
    // Two devices signed in at versions 1 and 2; a third bump must drop both.
    expect(isRevoked(1, 3)).toBe(true);
    expect(isRevoked(2, 3)).toBe(true);
  });

  it("does not resurrect a token issued for a future version", () => {
    expect(isRevoked(9, 3)).toBe(true);
  });
});
