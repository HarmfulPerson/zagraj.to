import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { formatEventDate, StatusBadge } from "@/components/panel/StatusBadge";
import { eventPanelPath, NEW_EVENT_PATH } from "@/lib/app";
import { requireDj } from "@/lib/auth";
import { listDjEvents } from "@/lib/events";

export const metadata: Metadata = { title: "Panel DJ-a | ZagrajTo" };

const newEventButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700";

async function Welcome() {
  const dj = await requireDj();
  return (
    <h1 className="text-2xl font-semibold tracking-tight break-words text-zinc-900 sm:text-3xl dark:text-zinc-50">
      Cześć, {dj.displayName}!
    </h1>
  );
}

async function EventList() {
  const dj = await requireDj();
  const events = await listDjEvents(dj.id);

  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Nie masz jeszcze wydarzeń</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          Utwórz wydarzenie, a goście będą mogli dodawać życzenia muzyczne po zeskanowaniu kodu.
        </p>
        <Link href={NEW_EVENT_PATH} className={`${newEventButton} mt-6`}>
          Utwórz pierwsze wydarzenie
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Twoje wydarzenia</h2>
        <Link href={NEW_EVENT_PATH} className={newEventButton}>
          <span aria-hidden className="text-xl leading-none">+</span>
          Nowe wydarzenie
        </Link>
      </div>
      <ul className="space-y-3" aria-label="Lista wydarzeń">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              href={eventPanelPath(event.id)}
              data-testid="event-row"
              className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-700"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-base font-semibold break-words text-zinc-900 sm:text-lg dark:text-zinc-50">{event.name}</h3>
                <StatusBadge status={event.status} />
              </div>
              <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">Data</dt>
                  <dd>{formatEventDate(event.startsAt)}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt>Kod:</dt>
                  <dd className="font-mono font-semibold tracking-wider text-zinc-900 dark:text-zinc-100">{event.code}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function EventListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

export default function PanelPage() {
  return (
    <>
      <Suspense fallback={<div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />}>
        <Welcome />
      </Suspense>
      <div className="mt-8">
        <Suspense fallback={<EventListSkeleton />}>
          <EventList />
        </Suspense>
      </div>
    </>
  );
}
