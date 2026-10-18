import { unsealData } from "iron-session";
import { NextResponse, type NextRequest } from "next/server";

import { buildSessionOptions, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, type SessionData } from "@/lib/session-config";

/**
 * Optimistic check for DJ pages: no valid session cookie means a redirect to /logowanie.
 * Pages still call `requireDj()`, which also verifies the user exists in the database.
 */
export async function proxy(request: NextRequest) {
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
  matcher: ["/panel", "/panel/:path*"],
};
