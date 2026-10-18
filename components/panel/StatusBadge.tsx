import { EVENT_STATUS_LABELS, type EventStatus } from "@/lib/event-status";

const STYLES: Record<EventStatus, { badge: string; dot: string }> = {
  DRAFT: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
    dot: "bg-amber-500",
  },
  LIVE: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
    dot: "bg-emerald-500 animate-pulse",
  },
  CLOSED: {
    badge: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    dot: "bg-zinc-400",
  },
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const style = STYLES[status];
  return (
    <span
      data-testid="event-status"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.badge}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${style.dot}`} />
      {EVENT_STATUS_LABELS[status]}
    </span>
  );
}

const dateFormatter = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Event dates are stored as midnight UTC (see `lib/event-validation.ts`), so they are formatted in UTC. */
export function formatEventDate(date: Date | null): string {
  return date ? dateFormatter.format(date) : "Bez daty";
}
