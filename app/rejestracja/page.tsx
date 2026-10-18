import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Załóż konto | ZagrajTo" };

export default function RegisterPage() {
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
      <RegisterForm />
    </AuthCard>
  );
}
