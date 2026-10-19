import type { Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { logoutAction } from "@/app/auth-actions";
import { APP_NAME, PANEL_DARK_HEADER_COLOR, SUBSCRIPTION_PATH } from "@/lib/app";
import { requireDj } from "@/lib/auth";
import { getPlanLimits } from "@/lib/plans";

// Browser chrome matches the panel header (white, or zinc-900 in dark mode). The live board overrides it (always dark).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: PANEL_DARK_HEADER_COLOR },
  ],
};

async function DjMenu() {
  const dj = await requireDj();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="hidden truncate text-sm text-zinc-600 sm:inline dark:text-zinc-400" data-testid="dj-name">
        {dj.displayName}
      </span>
      <Link
        href={SUBSCRIPTION_PATH}
        data-testid="plan-badge"
        title="Twój plan"
        className={`inline-flex min-h-8 shrink-0 items-center rounded-full px-3 text-xs font-semibold ring-1 transition ring-inset ${
          dj.plan === "PRO"
            ? "bg-violet-700 text-white ring-violet-700 hover:bg-violet-800"
            : "bg-zinc-100 text-zinc-700 ring-zinc-300 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-700"
        }`}
      >
        Plan: {getPlanLimits(dj.plan).name}
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          className="min-h-11 rounded-lg border board:min-h-9 board:px-3 border-zinc-300 px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Wyloguj się
        </button>
      </form>
    </div>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 print:bg-white dark:bg-zinc-950">
      <header className="print:hidden [@media(max-height:500px)]:board:hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 board:min-h-12 board:max-w-none board:px-3 sm:board:px-5">
          <Link href="/panel" className="text-xl font-bold tracking-tight text-violet-700 dark:text-violet-400">
            {APP_NAME}
          </Link>
          <Suspense fallback={<div className="h-11 w-28 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />}>
            <DjMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 board:max-w-none board:px-3 board:py-3 sm:board:px-5 sm:board:py-4 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
