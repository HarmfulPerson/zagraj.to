import { afterEach, describe, expect, it, vi } from "vitest";

import { eventPosterPath, guestEventPath } from "@/lib/app";
import { buildGuestEventUrl, DEFAULT_APP_URL, displayGuestEventUrl, getAppUrl } from "@/lib/guest-url";

describe("getAppUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://zagrajto.pl");
    expect(getAppUrl()).toBe("https://zagrajto.pl");
  });

  it("falls back to localhost when the variable is missing or blank", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(getAppUrl()).toBe(DEFAULT_APP_URL);
    expect(getAppUrl(undefined)).toBe(DEFAULT_APP_URL);
    expect(getAppUrl("   ")).toBe(DEFAULT_APP_URL);
    expect(DEFAULT_APP_URL).toBe("http://localhost:3000");
  });

  it("strips trailing slashes and whitespace", () => {
    expect(getAppUrl(" https://zagrajto.pl/// ")).toBe("https://zagrajto.pl");
  });
});

describe("buildGuestEventUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("builds ${NEXT_PUBLIC_APP_URL}/e/<code>", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://zagrajto.pl");
    expect(buildGuestEventUrl("ABC234")).toBe("https://zagrajto.pl/e/ABC234");
  });

  it("accepts an explicit base URL, with or without a trailing slash", () => {
    expect(buildGuestEventUrl("XYZ789", "http://localhost:3100/")).toBe("http://localhost:3100/e/XYZ789");
    expect(buildGuestEventUrl("XYZ789", "https://example.com/app")).toBe("https://example.com/app/e/XYZ789");
  });

  it("uses the localhost fallback without env", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(buildGuestEventUrl("ABC234")).toBe("http://localhost:3000/e/ABC234");
  });

  it("encodes unexpected characters in the code", () => {
    expect(buildGuestEventUrl("A B/C", "https://zagrajto.pl")).toBe("https://zagrajto.pl/e/A%20B%2FC");
  });
});

describe("path helpers", () => {
  it("builds guest and poster paths", () => {
    expect(guestEventPath("ABC234")).toBe("/e/ABC234");
    expect(eventPosterPath("evt_1")).toBe("/panel/wydarzenia/evt_1/plakat");
  });

  it("displays the guest URL without the protocol", () => {
    expect(displayGuestEventUrl("https://zagrajto.pl/e/ABC234")).toBe("zagrajto.pl/e/ABC234");
    expect(displayGuestEventUrl("http://localhost:3000/e/ABC234")).toBe("localhost:3000/e/ABC234");
  });
});
