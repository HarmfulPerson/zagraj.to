import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/site/Logo";
import { primaryButton, secondaryButton } from "@/components/site/styles";
import { PRICING_PATH } from "@/lib/site";

export const metadata: Metadata = { title: "Nie znaleziono strony | ZagrajTo" };

/** 404 for any unknown address (dark, like the public site). Event pages have their own not-found messages. */
export default function NotFound() {
  return (
    <main data-testid="not-found" className="site-theme flex flex-1 flex-col items-center justify-center bg-zinc-950 px-4 py-16 text-center text-zinc-100">
      <Link href="/" aria-label="ZagrajTo, strona główna" className="rounded-xl p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300">
        <Logo />
      </Link>
      <p className="mt-12 font-mono text-sm font-semibold tracking-widest text-lime-300">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">Nie ma takiej strony</h1>
      <p className="mt-4 max-w-md text-base text-zinc-300">
        Adres jest nieaktualny albo zawiera literówkę. Jeśli szukasz imprezy, zeskanuj kod QR jeszcze raz.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={primaryButton}>
          Strona główna
        </Link>
        <Link href={PRICING_PATH} className={secondaryButton}>
          Cennik
        </Link>
      </div>
    </main>
  );
}
