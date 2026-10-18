import Link from "next/link";

import { PANEL_PATH } from "@/lib/auth";

export default function EventNotFound() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Nie znaleziono wydarzenia</h1>
      <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        To wydarzenie nie istnieje albo należy do innego konta.
      </p>
      <Link
        href={PANEL_PATH}
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-violet-800"
      >
        Wróć do listy wydarzeń
      </Link>
    </section>
  );
}
