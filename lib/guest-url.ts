import { guestEventPath } from "@/lib/app";

export const DEFAULT_APP_URL = "http://localhost:3000";

/** Public base URL of the app without a trailing slash; falls back to localhost when unset or blank. */
export function getAppUrl(raw: string | undefined = process.env.NEXT_PUBLIC_APP_URL): string {
  const trimmed = raw?.trim().replace(/\/+$/, "");
  return trimmed ? trimmed : DEFAULT_APP_URL;
}

/** The link guests open (and the QR code encodes): `${NEXT_PUBLIC_APP_URL}/e/<code>`. */
export function buildGuestEventUrl(code: string, appUrl: string = getAppUrl()): string {
  return `${getAppUrl(appUrl)}${guestEventPath(encodeURIComponent(code))}`;
}

/** The guest URL without the protocol, for printing as readable text (e.g. `zagrajto.pl/e/ABC234`). */
export function displayGuestEventUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
