import { APP_NAME } from "@/lib/app";

/** Small app wordmark shown at the top of guest pages. */
export function Brand() {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-300">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M9 17.5a2.5 2.5 0 1 1-2-2.45V5.6a1 1 0 0 1 .76-.97l9-2.25A1 1 0 0 1 18 3.35v11.15a2.5 2.5 0 1 1-2-2.45V6.03l-7 1.75z" />
        </svg>
      </span>
      {APP_NAME}
    </p>
  );
}
