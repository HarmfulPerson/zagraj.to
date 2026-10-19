import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { changeEventStatusAction, updateEventAction } from "@/app/panel/event-actions";
import { DjBoard } from "@/components/panel/board/DjBoard";
import { CopyLinkButton } from "@/components/panel/CopyLinkButton";
import { EventForm } from "@/components/panel/EventForm";
import { EventStatusControls } from "@/components/panel/EventStatusControls";
import { ExportControls } from "@/components/panel/ExportControls";
import { QrCode } from "@/components/panel/QrCode";
import { formatEventDate } from "@/components/panel/StatusBadge";
import { eventPosterPath } from "@/lib/app";
import { requireDj } from "@/lib/auth";
import { buildBoardColumns, loadBoardRows } from "@/lib/dj-board";
import { formatRequestCount } from "@/lib/event-status";
import { eventIdSchema } from "@/lib/event-validation";
import { type DjEvent, findDjEvent } from "@/lib/events";
import { buildGuestEventUrl } from "@/lib/guest-url";

export const metadata: Metadata = { title: "Tablica na żywo | ZagrajTo" };

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const label = "text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400";

/** Event management around the board: details, QR for guests, start/close, edit and export of the list. */
function ManageEvent({ event }: { event: DjEvent }) {
  const guestUrl = buildGuestEventUrl(event.code);
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <section className={card} aria-labelledby="qr-heading">
        <h2 id="qr-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Kod QR dla gości
        </h2>
        <div className="mt-3 flex items-start gap-4">
          <QrCode
            value={guestUrl}
            label={`Kod QR prowadzący do strony wydarzenia ${event.name}`}
            testId="event-qr"
            className="w-32 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-700"
          />
          <dl className="min-w-0 flex-1 space-y-2">
            <div>
              <dt className={label}>Kod dla gości</dt>
              <dd data-testid="event-code" className="font-mono text-2xl font-bold tracking-[0.2em] text-violet-700 dark:text-violet-400">
                {event.code}
              </dd>
            </div>
            <div>
              <dt className={label}>Data</dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{formatEventDate(event.startsAt)}</dd>
            </div>
            <div>
              <dt className={label}>Limit na gościa</dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{formatRequestCount(event.maxRequestsPerGuest)}</dd>
            </div>
          </dl>
        </div>
        <p className={`${label} mt-3`}>Link dla gości</p>
        <p data-testid="guest-url" className="mt-1 font-mono text-sm break-all text-zinc-900 dark:text-zinc-100">
          {guestUrl}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <CopyLinkButton url={guestUrl} />
          <Link
            href={eventPosterPath(event.id)}
            className="flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
          >
            Plakat do druku
          </Link>
        </div>
      </section>

      <section className={card} aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Status wydarzenia
        </h2>
        <div className="mt-2">
          <EventStatusControls key={event.status} status={event.status} action={changeEventStatusAction.bind(null, event.id)} />
        </div>
      </section>

      <section className={card} aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Edycja
        </h2>
        <div className="mt-3">
          <EventForm
            mode="edit"
            action={updateEventAction.bind(null, event.id)}
            defaults={{ name: event.name, maxRequestsPerGuest: event.maxRequestsPerGuest }}
          />
        </div>
      </section>

      <ExportControls eventId={event.id} />
    </div>
  );
}

async function EventBoard({ id }: { id: string }) {
  const dj = await requireDj();
  const parsedId = eventIdSchema.safeParse(id);
  // Someone else's event looks exactly like a missing one.
  const event = parsedId.success ? await findDjEvent(dj.id, parsedId.data) : null;
  if (!event) notFound();
  const board = {
    event: { id: event.id, status: event.status, requestsOpen: event.requestsOpen },
    columns: buildBoardColumns(await loadBoardRows(event.id)),
  };

  return (
    <DjBoard eventId={event.id} name={event.name} code={event.code} initialBoard={board} manage={<ManageEvent event={event} />} />
  );
}

function BoardSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-16 animate-pulse rounded-2xl bg-zinc-900" />
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((column) => (
          <div key={column} className="space-y-2">
            <div className="h-6 w-32 animate-pulse rounded bg-zinc-900" />
            <div className="h-36 animate-pulse rounded-2xl bg-zinc-900" />
            <div className="h-36 animate-pulse rounded-2xl bg-zinc-900" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventPage({ params }: PageProps<"/panel/wydarzenia/[id]">) {
  return (
    // `dj-board-theme` turns the whole panel dark while the board is shown (see globals.css).
    <div className="dj-board-theme">
      <Suspense fallback={<BoardSkeleton />}>{params.then(({ id }) => <EventBoard id={id} />)}</Suspense>
    </div>
  );
}
