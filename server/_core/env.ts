import { MIN_SESSION_SECRET_LENGTH } from "@shared/const";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

/**
 * Local-only escape hatch for the synthetic `/api/oauth/mock` administrator.
 * It must be opted into explicitly: relying on `NODE_ENV=development` alone
 * meant that running `pnpm dev` against a real database exposed a route that
 * minted a year-long administrator session with no credentials.
 */
export const ALLOW_MOCK_OAUTH_FLAG = "ALLOW_MOCK_OAUTH";

export function isMockOAuthAllowed(): boolean {
  return (
    process.env[ALLOW_MOCK_OAUTH_FLAG] === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

/**
 * Problems that make session tokens forgeable or unusable. Evaluated on every
 * call so that a corrected `ENV` (or a test) observes the current state.
 */
export function sessionSecretIssues(): string[] {
  const issues: string[] = [];
  if (!ENV.cookieSecret) {
    issues.push("JWT_SECRET is not set");
  } else if (ENV.cookieSecret.length < MIN_SESSION_SECRET_LENGTH) {
    issues.push(
      `JWT_SECRET is too short (${ENV.cookieSecret.length} characters, minimum ${MIN_SESSION_SECRET_LENGTH})`
    );
  }
  return issues;
}

/**
 * Refuse to boot a production server whose session secret is missing or weak.
 * Without this the process starts happily and signs every session with an
 * empty or guessable key, which makes forged administrator tokens trivial.
 * Development and test only warn, so local tooling keeps working.
 */
export function assertProductionEnv(): void {
  if (!ENV.isProduction) return;
  const failures: string[] = [...sessionSecretIssues()];
  if (!ENV.databaseUrl) failures.push("DATABASE_URL is not set");
  if (failures.length) {
    throw new Error(
      `Refusing to start in production: ${failures.join("; ")}.`
    );
  }
}
