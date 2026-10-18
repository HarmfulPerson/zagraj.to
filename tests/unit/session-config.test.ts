import { describe, expect, it } from "vitest";

import { buildSessionOptions, resolveSessionSecret, SESSION_COOKIE_NAME } from "@/lib/session-config";

const secret = "x".repeat(32);

describe("resolveSessionSecret", () => {
  it("uses SESSION_SECRET when set", () => {
    expect(resolveSessionSecret({ SESSION_SECRET: secret, NODE_ENV: "production" })).toBe(secret);
  });

  it("throws in production when SESSION_SECRET is missing", () => {
    expect(() => resolveSessionSecret({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
  });

  it("throws when SESSION_SECRET is too short", () => {
    expect(() => resolveSessionSecret({ SESSION_SECRET: "short", NODE_ENV: "development" })).toThrow(/32/);
  });

  it("falls back to a dev-only secret outside production", () => {
    expect(resolveSessionSecret({ NODE_ENV: "test" }).length).toBeGreaterThanOrEqual(32);
  });
});

describe("buildSessionOptions", () => {
  it("uses an httpOnly, lax cookie that is secure only in production", () => {
    const dev = buildSessionOptions({ NODE_ENV: "development" });
    expect(dev.cookieName).toBe(SESSION_COOKIE_NAME);
    expect(dev.cookieOptions).toMatchObject({ httpOnly: true, secure: false, sameSite: "lax" });

    const prod = buildSessionOptions({ NODE_ENV: "production", SESSION_SECRET: secret });
    expect(prod.cookieOptions).toMatchObject({ httpOnly: true, secure: true });
  });
});
