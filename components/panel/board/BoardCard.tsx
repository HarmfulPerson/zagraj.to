"use client";

import { votesLabel } from "@/components/guest/GuestRequestList";
import { Cover } from "@/components/guest/TrackParts";
import { formatAgo, spotifySearchUrl } from "@/lib/board-view";
import type { BoardItem } from "@/lib/dj-board";
import { REQUEST_ACTION_LABELS, type RequestStatus } from "@/lib/request-status";

type Props = {
  item: BoardItem;
  /** Target statuses offered as buttons (empty: read-only board). */
  actions: readonly RequestStatus[];
  isNew: boolean;
  pending: boolean;
  /** Current time for "5 min temu"; null until the page is hydrated (server and browser clocks differ). */
  now: number | null;
  /** Played and rejected tracks: smaller, dimmed card. */
  muted?: boolean;
  onAction: (item: BoardItem, to: RequestStatus) => void;
};

const ACTION_STYLES: Record<RequestStatus, string> = {
  ACCEPTED: "bg-emerald-700 text-white hover:bg-emerald-600 focus-visible:outline-emerald-400",
  PLAYED: "bg-violet-600 text-white hover:bg-violet-500 focus-visible:outline-violet-400",
  REJECTED: "bg-zinc-800 text-red-300 ring-1 ring-inset ring-zinc-700 hover:bg-red-950 hover:text-red-200 focus-visible:outline-red-400",
  PENDING: "bg-zinc-800 text-zinc-200 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-700 focus-visible:outline-zinc-300",
};

function ActionIcon({ to }: { to: RequestStatus }) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    className: "size-5 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (to) {
    case "ACCEPTED":
      return (
        <svg {...common}>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      );
    case "PLAYED":
      return (
        <svg {...common} strokeWidth={0} fill="currentColor">
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
        </svg>
      );
    case "REJECTED":
      return (
        <svg {...common}>
          <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
        </svg>
      );
    case "PENDING":
      return (
        <svg {...common} strokeWidth={2.5}>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      );
  }
}

/** "7 min temu", with "temu" dropped on narrow cards so the number stays readable. */
function AgoText({ text }: { text: string }) {
  if (!text.endsWith(" temu")) return text;
  return (
    <>
      {text.slice(0, -" temu".length)}
      <span className="hidden @[19rem]:inline"> temu</span>
    </>
  );
}

function SpotifyIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.62.62 0 0 1-.86.2c-2.35-1.43-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.81-.87 7.09-.5 9.72 1.11.3.18.39.57.2.86Zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.69-1.65-6.78-2.13-9.96-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.57 11.23 1.33.37.22.48.7.25 1.07Zm.1-2.83c-3.22-1.91-8.54-2.09-11.62-1.16a.94.94 0 1 1-.54-1.8c3.53-1.07 9.4-.86 13.1 1.34a.94.94 0 0 1-.94 1.62Z" />
    </svg>
  );
}

/** One request on the DJ board: big title and vote count, when it was added, Spotify link and large action buttons. */
export function BoardCard({ item, actions, isNew, pending, now, muted = false, onAction }: Props) {
  const label = `${item.title} – ${item.artist}`;
  const compactLabels = actions.length >= 3;
  return (
    <li
      data-testid="board-card"
      data-request-id={item.id}
      data-new={isNew ? "true" : undefined}
      aria-busy={pending || undefined}
      className={`@container relative rounded-2xl p-3 ring-1 transition-[background-color,box-shadow,opacity] ring-inset ${
        isNew
          ? "bg-amber-400/10 shadow-[0_0_0_2px_rgba(251,191,36,0.85)] ring-amber-300/60"
          : muted
            ? "bg-zinc-900/60 ring-zinc-800/80"
            : "bg-zinc-900 ring-zinc-800"
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className={`@max-[17rem]:*:size-11 ${muted ? "opacity-70" : ""}`}>
          <Cover url={item.coverUrl} size={muted ? "sm" : "md"} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`line-clamp-2 leading-tight font-bold break-words ${muted ? "text-base text-zinc-300" : "text-lg text-white"}`}
            title={item.title}
          >
            {isNew ? (
              <span className="mr-1.5 inline-block translate-y-[-0.1em] rounded-md bg-amber-400 px-1.5 py-0.5 align-middle text-[0.7rem] leading-none font-black tracking-wider text-zinc-950 uppercase">
                Nowe<span className="sr-only">:</span>
              </span>
            ) : null}
            <span data-testid="board-title">{item.title}</span>
          </p>
          <p className={`mt-0.5 truncate ${muted ? "text-sm text-zinc-400" : "text-base text-zinc-400"}`} title={item.artist}>
            {item.artist}
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1 text-sm">
            <svg aria-hidden viewBox="0 0 24 24" className="size-3.5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <time dateTime={item.createdAt} className="min-w-0 truncate text-zinc-400 tabular-nums" suppressHydrationWarning>
              {now === null ? (
                "\u00a0"
              ) : (
                <>
                  <span className="sr-only">dodano </span>
                  <AgoText text={formatAgo(item.createdAt, now)} />
                </>
              )}
            </time>
            <a
              href={spotifySearchUrl(item.artist, item.title)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Otwórz w Spotify: ${label}`}
              title="Otwórz w Spotify"
              data-testid="spotify-link"
              className="-my-1.5 inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-lg px-1.5 font-semibold text-emerald-400 transition hover:bg-emerald-400/10 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              <SpotifyIcon className="size-[1.1rem]" />
              <span className="hidden @[20rem]:inline">Spotify</span>
            </a>
          </div>
        </div>
        <div
          className={`flex shrink-0 flex-col items-center rounded-xl px-2 py-1 ${muted ? "text-zinc-400" : "bg-zinc-800/80 text-white"}`}
          aria-label={votesLabel(item.votes)}
          role="img"
        >
          <svg aria-hidden viewBox="0 0 24 24" className={`size-4 ${muted ? "text-zinc-500" : "text-pink-400"}`} fill="currentColor">
            <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.5 3.4 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4Z" />
          </svg>
          <span data-testid="board-votes" className={`leading-none font-black tabular-nums ${muted ? "text-lg" : "text-2xl"}`}>
            {item.votes}
          </span>
        </div>
      </div>

      {actions.length > 0 ? (
        <div className="mt-2 flex gap-2">
          {actions.map((to) => (
            <button
              key={to}
              type="button"
              disabled={pending}
              onClick={() => onAction(item, to)}
              aria-label={`${REQUEST_ACTION_LABELS[to]}: ${label}`}
              data-testid={`action-${to.toLowerCase()}`}
              className={`flex min-w-0 flex-auto items-center justify-center rounded-xl px-2 font-bold transition select-none focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97] disabled:cursor-wait ${
                muted ? "min-h-11 gap-1.5 text-sm" : "min-h-13"
              } ${compactLabels ? "flex-col gap-0.5 text-xs @[21rem]:flex-row @[21rem]:gap-1.5 @[21rem]:text-[0.95rem]" : "gap-1.5 text-base"} ${ACTION_STYLES[to]}`}
            >
              <ActionIcon to={to} />
              <span className="max-w-full truncate">{compactLabels && to === "PENDING" ? "Cofnij" : REQUEST_ACTION_LABELS[to]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
