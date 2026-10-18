import type { Metadata } from "next";
import Link from "next/link";

import { createEventAction } from "@/app/panel/event-actions";
import { EventForm } from "@/components/panel/EventForm";
import { PANEL_PATH } from "@/lib/auth";

export const metadata: Metadata = { title: "Nowe wydarzenie | ZagrajTo" };

// The panel layout already verifies the session (requireDj) and the action checks it again on submit.
export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-xl">
      <Link href={PANEL_PATH} className="inline-flex min-h-11 items-center text-sm font-medium text-violet-700 hover:underline dark:text-violet-400">
        ← Wszystkie wydarzenia
      </Link>
      <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Nowe wydarzenie</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Po utworzeniu wydarzenie dostanie unikalny kod dla gości. Zacznie się jako szkic.
        </p>
        <div className="mt-6">
          <EventForm action={createEventAction} mode="create" cancelHref={PANEL_PATH} />
        </div>
      </div>
    </div>
  );
}
