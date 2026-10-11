import { afterEach, describe, expect, it } from "vitest";
import { MIN_SESSION_SECRET_LENGTH } from "@shared/const";
import { assertProductionEnv, ENV, isMockOAuthAllowed, sessionSecretIssues } from "./env";
import { sdk } from "./sdk";

const original = {
  cookieSecret: ENV.cookieSecret,
  databaseUrl: ENV.databaseUrl,
  isProduction: ENV.isProduction,
};
const originalNodeEnv = process.env.NODE_ENV;
const originalMockFlag = process.env.ALLOW_MOCK_OAUTH;
const GOOD_SECRET = "a".repeat(MIN_SESSION_SECRET_LENGTH);

afterEach(() => {
  ENV.cookieSecret = original.cookieSecret;
  ENV.databaseUrl = original.databaseUrl;
  ENV.isProduction = original.isProduction;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalMockFlag === undefined) delete process.env.ALLOW_MOCK_OAUTH;
  else process.env.ALLOW_MOCK_OAUTH = originalMockFlag;
});

describe("session secret configuration", () => {
  it("reports a missing secret", () => {
    ENV.cookieSecret = "";
    expect(sessionSecretIssues()).toContain("JWT_SECRET is not set");
  });

  it("reports a secret shorter than the minimum length", () => {
    ENV.cookieSecret = "short";
    const issues = sessionSecretIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("too short");
  });

  it("accepts a secret at exactly the minimum length", () => {
    ENV.cookieSecret = GOOD_SECRET;
    expect(sessionSecretIssues()).toEqual([]);
  });
});

describe("production startup assertions", () => {
  it("refuses to start in production without a session secret", () => {
    ENV.isProduction = true;
    ENV.cookieSecret = "";
    ENV.databaseUrl = "mysql://user:pass@host:3306/db";
    expect(() => assertProductionEnv()).toThrow(/JWT_SECRET is not set/);
  });

  it("refuses to start in production with a weak session secret", () => {
    ENV.isProduction = true;
    ENV.cookieSecret = "too-short";
    ENV.databaseUrl = "mysql://user:pass@host:3306/db";
    expect(() => assertProductionEnv()).toThrow(/too short/);
  });

  it("refuses to start in production without a database url", () => {
    ENV.isProduction = true;
    ENV.cookieSecret = GOOD_SECRET;
    ENV.databaseUrl = "";
    expect(() => assertProductionEnv()).toThrow(/DATABASE_URL is not set/);
  });

  it("starts in production when the configuration is complete", () => {
    ENV.isProduction = true;
    ENV.cookieSecret = GOOD_SECRET;
    ENV.databaseUrl = "mysql://user:pass@host:3306/db";
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("never blocks development or test on a missing secret", () => {
    ENV.isProduction = false;
    ENV.cookieSecret = "";
    ENV.databaseUrl = "";
    expect(() => assertProductionEnv()).not.toThrow();
  });
});

describe("session signing fails closed", () => {
  it("refuses to sign a session token without a secret", async () => {
    ENV.cookieSecret = "";
    await expect(sdk.signSession({ openId: "u1", appId: "app", name: "n" })).rejects.toThrow(
      /JWT_SECRET is not configured/
    );
  });

  it("refuses to sign a session token with a weak secret", async () => {
    ENV.cookieSecret = "weak";
    await expect(sdk.signSession({ openId: "u1", appId: "app", name: "n" })).rejects.toThrow(
      /at least 32 characters/
    );
  });

  it("signs and verifies a token when the secret is strong", async () => {
    ENV.cookieSecret = GOOD_SECRET;
    const token = await sdk.signSession({ openId: "u1", appId: "app", name: "n" });
    await expect(sdk.verifySession(token)).resolves.toMatchObject({ openId: "u1" });
  });

  it("treats a token signed with a different secret as unverifiable", async () => {
    ENV.cookieSecret = GOOD_SECRET;
    const token = await sdk.signSession({ openId: "u1", appId: "app", name: "n" });
    ENV.cookieSecret = "b".repeat(MIN_SESSION_SECRET_LENGTH);
    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });

  it("returns null instead of throwing when the secret is unusable", async () => {
    ENV.cookieSecret = "";
    await expect(sdk.verifySession("some.jwt.value")).resolves.toBeNull();
  });
});

describe("mock OAuth opt-in", () => {
  it("stays disabled even in development unless explicitly enabled", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_MOCK_OAUTH;
    expect(isMockOAuthAllowed()).toBe(false);
  });

  it("cannot be enabled in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_MOCK_OAUTH = "true";
    expect(isMockOAuthAllowed()).toBe(false);
  });

  it("is enabled by an explicit opt-in outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_MOCK_OAUTH = "true";
    expect(isMockOAuthAllowed()).toBe(true);
  });
});
