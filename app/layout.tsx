import type { Metadata, Viewport } from "next";

import { APP_NAME, APP_TAGLINE, DARK_THEME_COLOR } from "@/lib/app";
import { getAppUrl } from "@/lib/guest-url";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: APP_NAME,
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  openGraph: { type: "website", locale: "pl_PL", siteName: APP_NAME, title: APP_NAME, description: APP_TAGLINE },
  // Added to the home screen (iOS reads these instead of the manifest): full-screen, with the app name under the icon.
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
};

// Pages that follow the system theme (sign-in, panel) get matching browser chrome; the always-dark
// screens (public site, guest page, DJ board) override this with the dark colour.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: DARK_THEME_COLOR },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
