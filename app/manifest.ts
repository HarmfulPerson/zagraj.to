import type { MetadataRoute } from "next";

import { APP_NAME, APP_TAGLINE, DARK_THEME_COLOR } from "@/lib/app";

/**
 * Web app manifest (/manifest.webmanifest): the DJ can add the panel to the home screen of a phone or tablet
 * and open it full-screen. There is no service worker on purpose: every screen shows live data (polling every 3 s),
 * so an offline cache would only show a stale list; the pages show "Brak połączenia" instead.
 */
/** Same as PANEL_PATH in lib/auth.ts (not imported, so this static route does not pull in the session and database code). */
const PANEL_PATH = "/panel";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: PANEL_PATH,
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    lang: "pl",
    dir: "ltr",
    start_url: PANEL_PATH,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: DARK_THEME_COLOR,
    theme_color: DARK_THEME_COLOR,
    categories: ["music", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
