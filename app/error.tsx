"use client";

import Link from "next/link";

import { type ErrorBoundaryProps, useLogError } from "@/components/errors/useLogError";

/** Fallback for pages without their own boundary (sign-in, registration). */
export default function AppError({ error, retry }: ErrorBoundaryProps) {
  useLogError(error);
  return (
    <main data-testid="error-boundary" className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 text-center dark:bg-zinc-950">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Coś poszło nie tak</h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">Nie udało się wczytać strony. Spróbuj ponownie za chwilę.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-base font-medium text-violet-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 dark:text-violet-400"
          >
            Strona główna
          </Link>
        </div>
      </div>
    </main>
  );
}
