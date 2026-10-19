import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PrintButton } from "@/components/panel/PrintButton";
import { QrCode } from "@/components/panel/QrCode";
import { APP_NAME, eventPanelPath } from "@/lib/app";
import { requireDj } from "@/lib/auth";
import { eventIdSchema } from "@/lib/event-validation";
import { findDjEvent } from "@/lib/events";
import { buildGuestEventUrl, displayGuestEventUrl } from "@/lib/guest-url";
import { canCustomizePoster } from "@/lib/plans";
import { posterTitleSize } from "@/lib/poster";

export const metadata: Metadata = { title: "Plakat | ZagrajTo" };

const STEPS = ["Zeskanuj kod telefonem", "Wyszukaj ulubiony utwór", "Głosuj na propozycje innych"];

async function Poster({ id }: { id: string }) {
  const dj = await requireDj();
  const parsedId = eventIdSchema.safeParse(id);
  const event = parsedId.success ? await findDjEvent(dj.id, parsedId.data) : null;
  if (!event) notFound();

  const guestUrl = buildGuestEventUrl(event.code);
  // Pro only: a text saved while on Pro is not printed after a downgrade.
  const customText = canCustomizePoster(dj) ? event.posterText : null;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <Link
            href={eventPanelPath(event.id)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-violet-700 hover:underline dark:text-violet-400"
          >
            ← Wróć do wydarzenia
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Plakat do druku</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Format A4. Wydrukuj i powieś przy konsoli albo połóż na stołach.
          </p>
        </div>
        <PrintButton />
      </div>

      <article
        data-testid="poster"
        aria-label={`Plakat wydarzenia ${event.name}`}
        className="poster-sheet mx-auto bg-white text-center text-zinc-900 shadow-xl ring-1 ring-zinc-200 print:shadow-none print:ring-0"
      >
        {/* Inner wrapper: cqw units resolve against the sheet (the container), not the viewport. */}
        <div className="flex h-full flex-col items-center px-[8cqw] pt-[6cqw] pb-[5cqw] [&>*]:shrink-0">
          <p className="rounded-full bg-violet-700 px-[3.5cqw] py-[1.2cqw] text-[2.4cqw] leading-none font-bold tracking-[0.2em] text-white uppercase">
            {APP_NAME}
          </p>

          <h2
            data-testid="poster-event-name"
            className="mt-[3.5cqw] line-clamp-3 max-w-full leading-[1.15] font-bold tracking-tight break-words"
            style={{ fontSize: posterTitleSize(event.name) }}
          >
            {event.name}
          </h2>

          <p className="mt-[2.5cqw] text-[6cqw] leading-tight font-extrabold tracking-tight text-violet-700">
            Zeskanuj i zamów piosenkę
          </p>

          {customText ? (
            <p data-testid="poster-custom-text" className="mt-[1.5cqw] line-clamp-2 max-w-full text-[3.4cqw] text-balance leading-snug font-semibold break-words text-zinc-700">
              {customText}
            </p>
          ) : null}

          <div className="mt-[3cqw] rounded-[3cqw] border-[0.6cqw] border-violet-700 bg-white p-[1.2cqw]">
            <QrCode value={guestUrl} label={`Kod QR prowadzący do strony wydarzenia ${event.name}`} testId="poster-qr" className={customText ? "w-[46cqw]" : "w-[50cqw]"} />
          </div>

          <div className="mt-[3cqw]">
            <p className="text-[2.4cqw] font-medium tracking-[0.15em] text-zinc-500 uppercase">Kod wydarzenia</p>
            <p data-testid="poster-code" className="mt-[0.8cqw] pl-[0.25em] font-mono text-[8cqw] leading-none font-bold tracking-[0.25em] text-zinc-900">
              {event.code}
            </p>
            <p className="mt-[1.8cqw] text-[2.6cqw] text-zinc-600">
              albo wejdź na <span data-testid="poster-url" className="font-semibold text-zinc-900">{displayGuestEventUrl(guestUrl)}</span>
            </p>
          </div>

          <ol className="mt-auto grid w-full grid-cols-3 gap-[3cqw] border-t-[0.3cqw] border-zinc-200 pt-[3cqw]">
            {STEPS.map((step, index) => (
              <li key={step} className="flex flex-col items-center gap-[1cqw] text-[2.3cqw] leading-snug text-zinc-700">
                <span className="flex size-[5cqw] items-center justify-center rounded-full bg-violet-100 text-[2.5cqw] font-bold text-violet-800">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </article>
    </>
  );
}

function PosterSkeleton() {
  return (
    <div aria-hidden className="mx-auto aspect-[210/297] w-full max-w-[210mm] animate-pulse rounded-sm bg-zinc-200 dark:bg-zinc-800" />
  );
}

export default function PosterPage({ params }: PageProps<"/panel/wydarzenia/[id]/plakat">) {
  return (
    <div className="mx-auto max-w-4xl print:max-w-none">
      <Suspense fallback={<PosterSkeleton />}>{params.then(({ id }) => <Poster id={id} />)}</Suspense>
    </div>
  );
}
