import { describe, expect, it } from "vitest";
import { getMysqlConnectionOptions } from "./db-connection";

describe("getMysqlConnectionOptions", () => {
  it("enables encrypted transport for ssl-mode=REQUIRED", () => {
    const options = getMysqlConnectionOptions("mysql://user:pass@db.example:3306/fleet?ssl-mode=REQUIRED");

    expect(options).toMatchObject({
      host: "db.example",
      port: 3306,
      user: "user",
      password: "pass",
      database: "fleet",
      ssl: { rejectUnauthorized: false },
    });
    expect("ssl-mode" in options).toBe(false);
  });

  it("enables certificate verification for VERIFY_CA and VERIFY_IDENTITY", () => {
    expect(getMysqlConnectionOptions("mysql://user:pass@db.example/fleet?ssl-mode=VERIFY_CA").ssl)
      .toEqual({ rejectUnauthorized: true });
    expect(getMysqlConnectionOptions("mysql://user:pass@db.example/fleet?ssl-mode=VERIFY_IDENTITY").ssl)
      .toEqual({ rejectUnauthorized: true });
  });

  it("does not silently accept unsupported SSL modes", () => {
    expect(() => getMysqlConnectionOptions("mysql://user:pass@db.example/fleet?ssl-mode=INVALID"))
      .toThrow("Unsupported MySQL ssl-mode: INVALID");
  });
});
