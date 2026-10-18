"use client";

import { Cover } from "@/components/guest/TrackParts";
import type { GuestList, GuestListItem } from "@/lib/guest-list";

/** Polish plural: `one` for 1, `few` for 2–4, 22–24…, `many` otherwise (0, 5–21, 25…). */
export function polishPlural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `1 ${one}`;
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  const isFew = lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14);
  return `${count} ${isFew ? few : many}`;
}

export const votesLabel = (count: number) => polishPlural(count, "głos", "głosy", "głosów");

type Props = {
  list: GuestList;
  /** The last refresh failed; the shown list may be out of date. */
  stale: boolean;
  requestsOpen: boolean;
  onToggleVote: (item: GuestListItem) => void;
};

/** The live wish list for guests: the queue by votes with hearts, then the "Zagrane" section. */
export function GuestRequestList({ list, stale, requestsOpen, onToggleVote }: Props) {
  return (
    <div className="mt-5" data-testid="guest-list">
      <section aria-labelledby="queue-heading">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="queue-heading" className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
            Lista życzeń
          </h2>
          <span className="text-xs text-zinc-500 tabular-nums">
            {list.queue.length > 0 ? polishPlural(list.queue.length, "utwór", "utwory", "utworów") : null}
          </span>
        </div>
        {stale ? (
          <p role="status" className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-100 ring-1 ring-amber-400/25">
            Nie udało się odświeżyć listy. Próbujemy dalej…
          </p>
        ) : null}

        {list.queue.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-zinc-800 px-5 py-8 text-center" data-testid="guest-list-empty">
            <p className="text-base font-medium text-zinc-200">Lista jest jeszcze pusta</p>
            <p className="mt-1 text-sm text-zinc-400">
              {requestsOpen
                ? "Zaproponuj pierwszy utwór: wpisz tytuł albo wykonawcę, np. „sanah” lub „Dancing Queen”."
                : "Gdy pojawią się propozycje, zobaczysz je tutaj."}
            </p>
          </div>
        ) : (
          <ol className="mt-2 divide-y divide-zinc-800/70" data-testid="guest-queue">
            {list.queue.map((item, index) => (
              <QueueRow key={item.id} item={item} position={index + 1} onToggleVote={() => onToggleVote(item)} />
            ))}
          </ol>
        )}
      </section>

      {list.played.length > 0 ? (
        <section aria-labelledby="played-heading" className="mt-8" data-testid="guest-played">
          <h2 id="played-heading" className="px-1 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
            Zagrane
          </h2>
          <ol className="mt-2 divide-y divide-zinc-800/50">
            {list.played.map((item) => (
              <PlayedRow key={item.id} item={item} />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function MineBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-500/20 px-2 py-0.5 text-[0.7rem] leading-4 font-semibold text-violet-200 ring-1 ring-violet-400/30 ring-inset">
      Twoje
    </span>
  );
}

function QueueRow({ item, position, onToggleVote }: { item: GuestListItem; position: number; onToggleVote: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5" data-testid="guest-request" data-request-id={item.id}>
      <span aria-hidden className="w-5 shrink-0 text-center text-sm font-semibold text-zinc-500 tabular-nums">
        {position}
      </span>
      <Cover url={item.coverUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-semibold text-white" title={item.title}>
          {item.title}
        </p>
        <p className="truncate text-sm text-zinc-400">{item.artist}</p>
        {item.mine || item.status === "ACCEPTED" ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {item.mine ? <MineBadge /> : null}
            {item.status === "ACCEPTED" ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-400/15 py-0.5 pr-2 pl-1.5 text-[0.7rem] leading-4 font-semibold text-emerald-200 ring-1 ring-emerald-400/30 ring-inset">
                <svg aria-hidden viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                Zaakceptowane
              </span>
            ) : null}
          </div>
        ) : null}
        <span className="sr-only">, {votesLabel(item.votes)}</span>
      </div>
      <button
        type="button"
        onClick={onToggleVote}
        aria-pressed={item.votedByMe}
        aria-label={`Polub: ${item.title} – ${item.artist}`}
        data-testid="vote-button"
        className={`flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl ring-1 transition select-none ring-inset active:scale-90 ${
          item.votedByMe
            ? "bg-pink-500/15 text-pink-400 ring-pink-400/40"
            : "bg-zinc-900 text-zinc-300 ring-zinc-800 hover:text-white hover:ring-zinc-700"
        }`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill={item.votedByMe ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.5 3.4 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4Z" />
        </svg>
        <span data-testid="vote-count" className={`text-xs leading-none font-bold tabular-nums ${item.votedByMe ? "text-pink-300" : "text-zinc-300"}`}>
          {item.votes}
        </span>
      </button>
    </li>
  );
}

function PlayedRow({ item }: { item: GuestListItem }) {
  return (
    <li className="flex items-center gap-3 py-2" data-testid="guest-played-request">
      <span aria-hidden className="grid w-5 shrink-0 place-items-center text-emerald-400/80">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <div className="opacity-60">
        <Cover url={item.coverUrl} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-medium text-zinc-300" title={item.title}>
          {item.title}
        </p>
        <p className="truncate text-sm text-zinc-500">{item.artist}</p>
        {item.mine ? (
          <div className="mt-1 flex">
            <MineBadge />
          </div>
        ) : null}
      </div>
      <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{votesLabel(item.votes)}</span>
    </li>
  );
}
