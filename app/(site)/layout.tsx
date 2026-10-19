import type { Viewport } from "next";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { DARK_THEME_COLOR } from "@/lib/app";

export const viewport: Viewport = { themeColor: DARK_THEME_COLOR, colorScheme: "dark" };

/** Public marketing pages (landing, pricing): always dark, with the shared header and footer. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="site-theme flex flex-1 flex-col bg-zinc-950 text-zinc-100">
      <a
        href="#tresc"
        className="sr-only z-50 rounded-full bg-lime-300 px-4 py-2 font-semibold text-zinc-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Przejdź do treści
      </a>
      <SiteHeader />
      <main id="tresc" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
