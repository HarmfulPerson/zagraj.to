import { unsealData } from "iron-session";
import { NextResponse, type NextRequest } from "next/server";

import { guestEventPath } from "@/lib/app";
import { isValidEventCode, normalizeEventCode } from "@/lib/event-code";
import { GUEST_ID_COOKIE_NAME, generateGuestId, guestIdCookieOptions, parseGuestId } from "@/lib/guest";
import { buildSessionOptions, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, type SessionData } from "@/lib/session-config";

const GUEST_PAGE_PATTERN = /^\/e\/([^/]+)\/?$/;

export async function proxy(request: NextRequest) {
  return request.nextUrl.pathname.startsWith("/e/") ? guestProxy(request) : djProxy(request);
}

/**
 * Guest pages: redirects a lowercase code to its canonical form (`/e/k7qx2m` → `/e/K7QX2M`) and makes sure
 * the guest has a server-issued `guestId` cookie. A new id is also put on the forwarded request,
 * so the page rendering this very request already sees it.
 */
function guestProxy(request: NextRequest) {
  const match = GUEST_PAGE_PATTERN.exec(request.nextUrl.pathname);
  if (match) {
    let raw: string;
    try {
      raw = decodeURIComponent(match[1]);
    } catch {
      raw = match[1];
    }
    const code = normalizeEventCode(raw);
    if (code !== raw && isValidEventCode(code)) {
      const url = request.nextUrl.clone();
      url.pathname = guestEventPath(code);
      return NextResponse.redirect(url, 308);
    }
  }

  if (parseGuestId(request.cookies.get(GUEST_ID_COOKIE_NAME)?.value)) return NextResponse.next();

  const guestId = generateGuestId();
  request.cookies.set(GUEST_ID_COOKIE_NAME, guestId);
  const response = NextResponse.next({ request: { headers: new Headers(request.headers) } });
  response.cookies.set(GUEST_ID_COOKIE_NAME, guestId, guestIdCookieOptions());
  return response;
}

/**
 * Optimistic check for DJ pages: no valid session cookie means a redirect to /logowanie.
 * Pages still call `requireDj()`, which also verifies the user exists in the database.
 */
async function djProxy(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie) {
    const { password } = buildSessionOptions();
    const session = await unsealData<SessionData>(cookie, { password, ttl: SESSION_TTL_SECONDS }).catch(
      (): SessionData => ({}),
    );
    if (session.djId) return NextResponse.next();
  }

  const response = NextResponse.redirect(new URL("/logowanie", request.url));
  if (cookie) response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ["/panel", "/panel/:path*", "/e/:path*"],
};
