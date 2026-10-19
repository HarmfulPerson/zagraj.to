"use client";

import { type ErrorBoundaryProps, useLogError } from "@/components/errors/useLogError";

import "./globals.css";

/** Last-resort boundary when the root layout itself fails: renders its own document (Polish, dark). */
export default function GlobalError({ error, retry }: ErrorBoundaryProps) {
  useLogError(error);
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="site-theme flex min-h-full flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-100">
        <title>Coś poszło nie tak | ZagrajTo</title>
        <h1 className="text-2xl font-bold tracking-tight text-white">Coś poszło nie tak</h1>
        <p className="mt-2 max-w-md text-base text-zinc-300">Nie udało się wczytać aplikacji. Spróbuj ponownie za chwilę.</p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-lime-300 px-6 text-base font-semibold text-zinc-950 hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
        >
          Spróbuj ponownie
        </button>
      </body>
    </html>
  );
}
