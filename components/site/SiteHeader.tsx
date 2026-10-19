import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/site/Logo";
import { focusRing } from "@/components/site/styles";
import { LOGIN_PATH, PANEL_PATH, getCurrentDj } from "@/lib/auth";
import { PRICING_PATH, REGISTER_PATH } from "@/lib/site";

const textLink = `inline-flex min-h-11 items-center rounded-full px-2 text-sm font-medium text-zinc-300 transition hover:text-white sm:px-3 ${focusRing}`;
const buttonLink = `inline-flex min-h-10 items-center rounded-full bg-lime-300 px-3 text-sm font-semibold whitespace-nowrap text-zinc-950 transition hover:bg-lime-200 sm:px-4 ${focusRing}`;

/** Links for visitors without a session. */
function GuestLinks() {
  return (
    <>
      <Link href={LOGIN_PATH} className={textLink}>
        Zaloguj
      </Link>
      <Link href={REGISTER_PATH} className={buttonLink}>
        Załóż konto
      </Link>
    </>
  );
}

async function AccountLinks() {
  const dj = await getCurrentDj();
  if (!dj) return <GuestLinks />;
  return (
    <Link href={PANEL_PATH} className={buttonLink} data-testid="site-panel-link">
      Panel
    </Link>
  );
}

/** Header of the public pages. Only the account links depend on the session, so the rest stays in the static shell. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" aria-label="ZagrajTo, strona główna" className={`-m-1 rounded-xl p-1 ${focusRing}`}>
          <Logo compact />
        </Link>
        <nav aria-label="Główne menu" className="flex items-center sm:gap-2">
          <Link href={PRICING_PATH} className={textLink}>
            Cennik
          </Link>
          {/* Neutral placeholder while the session streams in: a logged-in DJ never sees "Zaloguj" flash by. */}
          <Suspense fallback={<span aria-hidden data-testid="site-account-placeholder" className="ml-1 inline-block h-10 w-36 rounded-full bg-white/5 sm:w-44" />}>
            <AccountLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
