import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

describe("session cookie options", () => {
  it("uses a first-party lax cookie for local HTTP", () => {
    const options = getSessionCookieOptions({ protocol: "http", headers: {} } as any);
    expect(options).toMatchObject({ httpOnly: true, path: "/", sameSite: "lax", secure: false });
  });

  it("uses a secure cross-site cookie behind an HTTPS proxy", () => {
    const options = getSessionCookieOptions({ protocol: "http", headers: { "x-forwarded-proto": "https" } } as any);
    expect(options).toMatchObject({ httpOnly: true, path: "/", sameSite: "none", secure: true });
  });
});
