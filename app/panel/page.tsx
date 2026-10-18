import type { Metadata } from "next";
import { Suspense } from "react";

import { requireDj } from "@/lib/auth";

export const metadata: Metadata = { title: "Panel DJ-a | ZagrajTo" };

async function Welcome() {
  const dj = await requireDj();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">Cześć, {dj.displayName}!</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">To Twój panel DJ-a.</p>
    </>
  );
}

export default function PanelPage() {
  return (
    <>
      <Suspense fallback={<div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />}>
        <Welcome />
      </Suspense>
      <section className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Nie masz jeszcze wydarzeń</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Tutaj pojawi się lista Twoich wydarzeń.</p>
      </section>
    </>
  );
}
