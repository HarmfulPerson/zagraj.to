import type { SessionOptions } from "iron-session";

/** Data stored in the encrypted DJ session cookie. Keep it minimal: only the user id. */
export type SessionData = {
  djId?: string;
};

export const SESSION_COOKIE_NAME = "zagrajto_session";
/** 14 days. iron-session sets the cookie max-age slightly below this. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
/** iron-session requires a password of at least 32 characters. */
export const MIN_SESSION_SECRET_LENGTH = 32;

// Used only outside production (dev server, tests, e2e) when SESSION_SECRET is not set.
const DEV_FALLBACK_SECRET = "zagrajto-dev-only-insecure-session-secret-do-not-use";

type SessionEnv = { SESSION_SECRET?: string; NODE_ENV?: string };

/**
 * Returns the secret used to encrypt the session cookie.
 * In production SESSION_SECRET is required; elsewhere a dev-only fallback is used.
 */
export function resolveSessionSecret(env: SessionEnv = process.env): string {
  const secret = env.SESSION_SECRET;
  if (secret) {
    if (secret.length < MIN_SESSION_SECRET_LENGTH) {
      throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters long`);
    }
    return secret;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return DEV_FALLBACK_SECRET;
}

export function buildSessionOptions(env: SessionEnv = process.env): SessionOptions {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: resolveSessionSecret(env),
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}
