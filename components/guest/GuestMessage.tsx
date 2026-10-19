import type { ReactNode } from "react";

import { Brand } from "@/components/guest/Brand";

/** Full-screen message for guests: unknown code, party not started yet or already over. */
export function GuestMessage({
  icon,
  eyebrow,
  title,
  children,
  testId,
}: {
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-10">
      <Brand />
      <section data-testid={testId} className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <div aria-hidden className="grid size-20 place-items-center rounded-full bg-zinc-900 text-violet-300 ring-1 ring-zinc-800">
          {icon}
        </div>
        {eyebrow ? <p className="mt-6 max-w-full text-sm font-medium break-words text-zinc-400">{eyebrow}</p> : null}
        <h1 className={`${eyebrow ? "mt-1" : "mt-6"} text-2xl font-bold tracking-tight text-zinc-50`}>{title}</h1>
        <div className="mt-3 max-w-xs text-base leading-relaxed text-zinc-300">{children}</div>
      </section>
    </main>
  );
}

export const ClockIcon = (
  <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const MoonIcon = (
  <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);

export const QuestionIcon = (
  <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
  </svg>
);

export const WarningIcon = (
  <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17h.01" />
  </svg>
);
