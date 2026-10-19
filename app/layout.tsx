import type { Metadata } from "next";

import { APP_NAME, APP_TAGLINE } from "@/lib/app";
import { getAppUrl } from "@/lib/guest-url";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: APP_NAME,
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  openGraph: { type: "website", locale: "pl_PL", siteName: APP_NAME, title: APP_NAME, description: APP_TAGLINE },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
