import { APP_NAME } from "@/lib/app";

/** Wordmark of the public site: the note icon (same as on guest pages) and the name. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`flex items-center font-bold tracking-tight text-white ${compact ? "gap-1.5 text-base sm:gap-2 sm:text-lg" : "gap-2 text-lg"}`}>
      <span aria-hidden className={`grid shrink-0 ${compact ? "size-7 sm:size-8" : "size-8"} place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white`}>
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M9 17.5a2.5 2.5 0 1 1-2-2.45V5.6a1 1 0 0 1 .76-.97l9-2.25A1 1 0 0 1 18 3.35v11.15a2.5 2.5 0 1 1-2-2.45V6.03l-7 1.75z" />
        </svg>
      </span>
      {APP_NAME}
    </span>
  );
}
