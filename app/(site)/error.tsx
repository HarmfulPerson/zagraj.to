"use client";

import Link from "next/link";

import { primaryButton, secondaryButton } from "@/components/site/styles";
import { type ErrorBoundaryProps, useLogError } from "@/components/errors/useLogError";

/** Unexpected error on a public page: the site header and footer stay, the content offers a retry. */
export default function SiteError({ error, retry }: ErrorBoundaryProps) {
  useLogError(error);
  return (
    <section data-testid="error-boundary" className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:py-28">
      <p className="text-sm font-semibold tracking-wide text-lime-300 uppercase">Coś poszło nie tak</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">Nie udało się wczytać strony</h1>
      <p className="mt-4 text-base text-zinc-300">To chwilowy problem po naszej stronie albo z połączeniem. Spróbuj ponownie za moment.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={retry} className={primaryButton}>
          Spróbuj ponownie
        </button>
        <Link href="/" className={secondaryButton}>
          Strona główna
        </Link>
      </div>
    </section>
  );
}
