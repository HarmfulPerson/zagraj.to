"use client";

import Link from "next/link";

import { type ErrorBoundaryProps, useLogError } from "@/components/errors/useLogError";

/** Unexpected error in the DJ panel. The panel header (and logout) stays above it. */
export default function PanelError({ error, retry }: ErrorBoundaryProps) {
  useLogError(error);
  return (
    <section
      data-testid="error-boundary"
      className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Coś poszło nie tak</h1>
      <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        Nie udało się wczytać tej strony. Sprawdź połączenie z internetem i spróbuj ponownie.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={retry}
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
        >
          Spróbuj ponownie
        </button>
        <Link
          href="/panel"
          className="inline-flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-800 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Wróć do listy wydarzeń
        </Link>
      </div>
    </section>
  );
}
