import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  generateGuestId,
  GUEST_ID_MAX_AGE_SEC,
  guestIdCookieOptions,
  isValidGuestId,
  parseGuestId,
  readCookie,
  readGuestId,
} from "@/lib/guest";
import { proxy } from "@/proxy";

const VALID = "3f2b8c1e-9a4d-4e7f-8b6a-1c2d3e4f5a6b";

describe("guest id", () => {
  it("generates distinct v4 UUIDs that pass validation", () => {
    const a = generateGuestId();
    const b = generateGuestId();
    expect(a).not.toBe(b);
    expect(isValidGuestId(a)).toBe(true);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("treats malformed values as missing", () => {
    expect(parseGuestId(VALID)).toBe(VALID);
    for (const value of [undefined, null, "", "abc", `${VALID}0`, VALID.toUpperCase(), ` ${VALID}`, "guest-1"]) {
      expect(parseGuestId(value)).toBeNull();
    }
  });

  it("uses httpOnly, sameSite=lax, 30 days and secure only in production", () => {
    expect(GUEST_ID_MAX_AGE_SEC).toBe(30 * 24 * 60 * 60);
    expect(guestIdCookieOptions(false)).toEqual({ httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: GUEST_ID_MAX_AGE_SEC });
    expect(guestIdCookieOptions(true).secure).toBe(true);
  });

  it("reads cookies from a raw header", () => {
    expect(readCookie("a=1; guestId=x%20y; b=2", "guestId")).toBe("x y");
    expect(readCookie("a=1", "guestId")).toBeUndefined();
    expect(readCookie(null, "guestId")).toBeUndefined();
    expect(readGuestId(new Request("http://x", { headers: { cookie: `guestId=${VALID}` } }))).toBe(VALID);
    expect(readGuestId(new Request("http://x", { headers: { cookie: "guestId=nope" } }))).toBeNull();
  });
});

describe("proxy on guest pages", () => {
  const request = (path: string, cookie?: string) =>
    new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} });

  it("issues a guestId cookie on the first visit and forwards it to the page", async () => {
    const response = await proxy(request("/e/K7QX2M"));
    const issued = response.cookies.get("guestId");
    expect(isValidGuestId(issued?.value)).toBe(true);
    expect(issued).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: GUEST_ID_MAX_AGE_SEC, path: "/" });
    // The forwarded request carries the new cookie, so the page sees it during this very request.
    expect(response.headers.get("x-middleware-request-cookie") ?? "").toContain(`guestId=${issued?.value}`);
  });

  it("keeps a valid guestId and replaces an invalid one", async () => {
    expect((await proxy(request("/e/K7QX2M", `guestId=${VALID}`))).cookies.get("guestId")).toBeUndefined();
    const replaced = (await proxy(request("/e/K7QX2M", "guestId=forged"))).cookies.get("guestId");
    expect(isValidGuestId(replaced?.value)).toBe(true);
  });

  it("redirects a lowercase code to the canonical one", async () => {
    const response = await proxy(request("/e/k7qx2m", `guestId=${VALID}`));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost/e/K7QX2M");
    // Codes that cannot be valid are left to the page (404).
    expect((await proxy(request("/e/xxxxxxx", `guestId=${VALID}`))).status).toBe(200);
  });
});
