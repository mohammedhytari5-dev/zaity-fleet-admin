import { afterEach, describe, expect, it } from "vitest";
import { databaseAccessAllowed, getDb } from "./db";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalAllowFlag = process.env.ALLOW_TEST_DATABASE;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalAllowFlag === undefined) delete process.env.ALLOW_TEST_DATABASE;
  else process.env.ALLOW_TEST_DATABASE = originalAllowFlag;
});

describe("database access during tests", () => {
  it("refuses to open a connection while running under a test runner", () => {
    // Regression guard: exporting DATABASE_URL (easy to do from a shell or a
    // wrapper script) previously let the suite query the real database, which
    // silently mixed production data into assertions.
    process.env.DATABASE_URL = "mysql://user:pass@example.invalid:3306/db";
    delete process.env.ALLOW_TEST_DATABASE;
    expect(process.env.VITEST).toBeTruthy();
    expect(databaseAccessAllowed()).toBe(false);
  });

  it("returns no handle even when a connection string is present", async () => {
    process.env.DATABASE_URL = "mysql://user:pass@example.invalid:3306/db";
    delete process.env.ALLOW_TEST_DATABASE;
    await expect(getDb()).resolves.toBeNull();
  });

  it("requires an explicit opt-in for an integration run", () => {
    process.env.DATABASE_URL = "mysql://user:pass@example.invalid:3306/db";
    process.env.ALLOW_TEST_DATABASE = "true";
    expect(databaseAccessAllowed()).toBe(true);
  });

  it("still reports no access when no connection string is configured", () => {
    delete process.env.DATABASE_URL;
    delete process.env.ALLOW_TEST_DATABASE;
    expect(databaseAccessAllowed()).toBe(false);
  });
});
