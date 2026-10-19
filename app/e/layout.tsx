import type { Metadata, Viewport } from "next";

import { DARK_THEME_COLOR } from "@/lib/app";

export const metadata: Metadata = {
  title: "Życzenia muzyczne | ZagrajTo",
  robots: { index: false },
};

// Guests use the page in a dark room: dark browser chrome and form controls.
export const viewport: Viewport = {
  themeColor: DARK_THEME_COLOR,
  colorScheme: "dark",
};

export default function GuestLayout({ children }: LayoutProps<"/e">) {
  return <div className="guest-theme flex flex-1 flex-col bg-zinc-950 text-zinc-100">{children}</div>;
}
