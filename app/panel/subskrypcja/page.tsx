import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { openPortalAction, startCheckoutAction } from "@/app/panel/billing-actions";
import { SubscriptionView } from "@/components/panel/SubscriptionView";
import { PANEL_PATH, requireDj } from "@/lib/auth";
import { getBillingStatus, parseReturnStatus } from "@/lib/billing";
import { isBillingConfigured } from "@/lib/stripe";

export const metadata: Metadata = { title: "Subskrypcja | ZagrajTo" };

async function Subscription({ searchParams }: { searchParams: PageProps<"/panel/subskrypcja">["searchParams"] }) {
  const dj = await requireDj();
  const status = await getBillingStatus(dj.id);
  if (!status) return null;
  return (
    <SubscriptionView
      status={status}
      returnStatus={parseReturnStatus((await searchParams).status)}
      configured={isBillingConfigured()}
      checkoutAction={startCheckoutAction}
      portalAction={openPortalAction}
    />
  );
}

function SubscriptionSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-48 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-64 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export default function SubscriptionPage({ searchParams }: PageProps<"/panel/subskrypcja">) {
  return (
    <div className="mx-auto max-w-xl">
      <Link href={PANEL_PATH} className="inline-flex min-h-11 items-center text-sm font-medium text-violet-700 hover:underline dark:text-violet-400">
        ← Wszystkie wydarzenia
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">Subskrypcja</h1>
      <Suspense fallback={<SubscriptionSkeleton />}>
        <Subscription searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
