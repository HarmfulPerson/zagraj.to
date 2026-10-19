import Link from "next/link";

import { Logo } from "@/components/site/Logo";
import { focusRing } from "@/components/site/styles";
import { APP_TAGLINE } from "@/lib/app";
import { LOGIN_PATH } from "@/lib/auth";
import { PRICING_PATH, REGISTER_PATH } from "@/lib/site";

const footerLink = `rounded text-sm text-zinc-400 transition hover:text-white ${focusRing}`;

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-zinc-400">{APP_TAGLINE}</p>
        </div>
        <nav aria-label="Stopka">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href={PRICING_PATH} className={footerLink}>
                Cennik
              </Link>
            </li>
            <li>
              <Link href={LOGIN_PATH} className={footerLink}>
                Zaloguj się
              </Link>
            </li>
            <li>
              <Link href={REGISTER_PATH} className={footerLink}>
                Załóż konto
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
