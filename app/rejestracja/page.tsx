import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { PLAN_LIMITS } from "@/lib/plans";
import { parseRegisterPlanIntent, REGISTER_PLAN_PARAM } from "@/lib/site";

export const metadata: Metadata = { title: "Załóż konto | ZagrajTo" };

/** Keeps the plan picked on the pricing page (`?plan=pro`, allowlisted) so the DJ lands on the subscription page. */
async function PlanIntentField({ searchParams }: { searchParams: PageProps<"/rejestracja">["searchParams"] }) {
  const intent = parseRegisterPlanIntent((await searchParams)[REGISTER_PLAN_PARAM]);
  if (!intent) return null;
  return (
    <>
      <input type="hidden" name={REGISTER_PLAN_PARAM} value={intent} />
      <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:bg-violet-500/10 dark:text-violet-200" data-testid="register-plan-intent">
        Po założeniu konta przejdziesz do aktywacji planu {PLAN_LIMITS.PRO.name} (płatność w następnym kroku).
      </p>
    </>
  );
}

export default function RegisterPage({ searchParams }: PageProps<"/rejestracja">) {
  return (
    <AuthCard
      title="Załóż konto DJ-a"
      subtitle="Zbieraj życzenia muzyczne od gości na swoich imprezach."
      footer={
        <>
          Masz już konto?{" "}
          <Link href="/logowanie" className="font-semibold text-violet-700 underline-offset-4 hover:underline dark:text-violet-400">
            Zaloguj się
          </Link>
        </>
      }
    >
      <RegisterForm>
        <Suspense fallback={null}>
          <PlanIntentField searchParams={searchParams} />
        </Suspense>
      </RegisterForm>
    </AuthCard>
  );
}
