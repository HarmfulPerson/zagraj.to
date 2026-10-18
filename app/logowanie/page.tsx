import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Logowanie | ZagrajTo" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Zaloguj się"
      subtitle="Wejdź do panelu DJ-a i zarządzaj swoimi wydarzeniami."
      footer={
        <>
          Nie masz konta?{" "}
          <Link href="/rejestracja" className="font-semibold text-violet-700 underline-offset-4 hover:underline dark:text-violet-400">
            Załóż konto
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
