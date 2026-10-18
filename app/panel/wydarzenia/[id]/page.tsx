import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { changeEventStatusAction, updateEventAction } from "@/app/panel/event-actions";
import { EventForm } from "@/components/panel/EventForm";
import { EventStatusControls } from "@/components/panel/EventStatusControls";
import { formatEventDate, StatusBadge } from "@/components/panel/StatusBadge";
import { PANEL_PATH, requireDj } from "@/lib/auth";
import { formatRequestCount } from "@/lib/event-status";
import { eventIdSchema } from "@/lib/event-validation";
import { findDjEvent } from "@/lib/events";

export const metadata: Metadata = { title: "Wydarzenie | ZagrajTo" };

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900";

async function EventDetails({ id }: { id: string }) {
  const dj = await requireDj();
  const parsedId = eventIdSchema.safeParse(id);
  // Someone else's event looks exactly like a missing one.
  const event = parsedId.success ? await findDjEvent(dj.id, parsedId.data) : null;
  if (!event) notFound();

  return (
    <>
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {event.name}
          </h1>
          <StatusBadge status={event.status} />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Kod dla gości</dt>
            <dd data-testid="event-code" className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] text-violet-700 dark:text-violet-400">
              {event.code}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Data</dt>
            <dd className="mt-1 text-base font-medium text-zinc-900 dark:text-zinc-100">{formatEventDate(event.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Limit na gościa</dt>
            <dd className="mt-1 text-base font-medium text-zinc-900 dark:text-zinc-100">{formatRequestCount(event.maxRequestsPerGuest)}</dd>
          </div>
        </dl>
      </section>

      <section className={card} aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Status wydarzenia</h2>
        <div className="mt-2">
          <EventStatusControls key={event.status} status={event.status} action={changeEventStatusAction.bind(null, event.id)} />
        </div>
      </section>

      <section className={card} aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Edycja</h2>
        <div className="mt-4">
          <EventForm
            mode="edit"
            action={updateEventAction.bind(null, event.id)}
            defaults={{ name: event.name, maxRequestsPerGuest: event.maxRequestsPerGuest }}
          />
        </div>
      </section>
    </>
  );
}

function DetailsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-40 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export default function EventPage({ params }: PageProps<"/panel/wydarzenia/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={PANEL_PATH} className="inline-flex min-h-11 items-center text-sm font-medium text-violet-700 hover:underline dark:text-violet-400">
        ← Wszystkie wydarzenia
      </Link>
      <div className="mt-2 space-y-4">
        <Suspense fallback={<DetailsSkeleton />}>{params.then(({ id }) => <EventDetails id={id} />)}</Suspense>
      </div>
    </div>
  );
}
