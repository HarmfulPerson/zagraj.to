"use client";

import { useFormStatus } from "react-dom";

const base =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed sm:w-auto";
const variants = {
  primary: "bg-violet-700 text-white hover:bg-violet-800 disabled:bg-zinc-300 disabled:text-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-300",
  secondary:
    "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
};

/** Submit button of a billing form (Checkout / Customer Portal); shows a pending label while redirecting to Stripe. */
export function BillingButton({ action, label, variant = "primary", disabled = false }: {
  action: () => Promise<void>;
  label: string;
  variant?: keyof typeof variants;
  disabled?: boolean;
}) {
  return (
    <form action={action}>
      <SubmitButton label={label} variant={variant} disabled={disabled} />
    </form>
  );
}

function SubmitButton({ label, variant, disabled }: { label: string; variant: keyof typeof variants; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-disabled={disabled || pending} className={`${base} ${variants[variant]}`}>
      {pending ? "Przekierowuję do płatności…" : label}
    </button>
  );
}
