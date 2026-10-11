import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

function request(overrides: Record<string, unknown>) {
  return { protocol: "http", headers: {}, secure: false, ...overrides } as any;
}

describe("session cookie options", () => {
  it("uses a first-party lax cookie for local HTTP", () => {
    const options = getSessionCookieOptions(request({}));
    expect(options).toMatchObject({ httpOnly: true, path: "/", sameSite: "lax", secure: false });
  });

  it("uses a secure cross-site cookie on a direct HTTPS request", () => {
    expect(getSessionCookieOptions(request({ protocol: "https", secure: true }))).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });

  it("uses a secure cookie when Express reports a secure request behind a trusted proxy", () => {
    // With `trust proxy` configured, Express derives req.protocol/req.secure
    // from X-Forwarded-Proto for the configured number of hops.
    expect(getSessionCookieOptions(request({ protocol: "https", secure: true }))).toMatchObject({
      sameSite: "none",
      secure: true,
    });
  });

  it("ignores an untrusted X-Forwarded-Proto header", () => {
    // Regression guard: the cookie policy used to read this header directly, so
    // any client could claim HTTPS and be issued a SameSite=None cookie over a
    // plaintext connection.
    const options = getSessionCookieOptions(
      request({ protocol: "http", secure: false, headers: { "x-forwarded-proto": "https" } })
    );
    expect(options).toMatchObject({ sameSite: "lax", secure: false });
  });

  it("ignores a spoofed forwarded header list", () => {
    const options = getSessionCookieOptions(
      request({
        protocol: "http",
        secure: false,
        headers: { "x-forwarded-proto": "https, https" },
      })
    );
    expect(options.secure).toBe(false);
  });
});
