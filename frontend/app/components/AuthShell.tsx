"use client";

import Link from "next/link";
import { ChangeEvent, ReactNode } from "react";
import { LogoWithLabel } from "@/app/components/Logo";
import ThemeToggle from "@/app/components/ThemeToggle";

/** Shared chrome for the auth pages: logo + theme header and the card surface. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-full bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/">
            <LogoWithLabel labelClassName="text-[15px] font-semibold tracking-tight text-foreground" />
          </Link>
          <ThemeToggle />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
          {children}
        </div>
      </div>
    </main>
  );
}

/** Full-screen loading card used while an auth session resolves. */
export function AuthLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <main className="h-full grid place-items-center bg-background px-6">
      <div className="rounded-xl border border-border bg-surface px-6 py-4 text-sm text-muted shadow-[var(--shadow-sm)]">
        {message}
      </div>
    </main>
  );
}

interface AuthFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  labelAccessory?: ReactNode;
}

/** Labeled text input matching the shared auth form styling. */
export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  minLength,
  labelAccessory,
}: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {labelAccessory}
      </div>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
      />
    </div>
  );
}

/** Error message row shown beneath auth form fields. */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

/** Primary submit button with an idle/busy label pair. */
export function AuthSubmitButton({
  submitting,
  idleLabel,
  busyLabel,
}: {
  submitting: boolean;
  idleLabel: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
    >
      {submitting ? busyLabel : idleLabel}
    </button>
  );
}
