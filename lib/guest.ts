/** Cookie holding the anonymous guest id: a server-issued UUID (see `proxy.ts` and the requests API). */
export const GUEST_ID_COOKIE_NAME = "guestId";

/** The guest id cookie lives for 30 days, long enough for a wedding weekend plus the next party. */
export const GUEST_ID_MAX_AGE_SEC = 30 * 24 * 60 * 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True for a well-formed (lowercase) UUID, the only format the server issues. */
export function isValidGuestId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** The guest id from a raw cookie value, or `null` when missing or malformed (treated as a new guest). */
export function parseGuestId(value: string | null | undefined): string | null {
  return isValidGuestId(value) ? value : null;
}

export function generateGuestId(): string {
  return crypto.randomUUID();
}

/** Cookie attributes for the guest id: httpOnly, sameSite=lax, secure in production, 30 days. */
export function guestIdCookieOptions(production: boolean = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: production,
    path: "/",
    maxAge: GUEST_ID_MAX_AGE_SEC,
  };
}

/** Reads one cookie from a raw `Cookie` header (URL-decoded when possible); `undefined` when absent or empty. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1 || part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw) || undefined;
    } catch {
      return raw || undefined;
    }
  }
  return undefined;
}

/** The valid guest id sent with a request, or `null`. */
export function readGuestId(request: Request): string | null {
  return parseGuestId(readCookie(request.headers.get("cookie"), GUEST_ID_COOKIE_NAME));
}
