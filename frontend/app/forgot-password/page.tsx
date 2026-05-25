"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LogoWithLabel } from "@/app/components/Logo";
import ThemeToggle from "@/app/components/ThemeToggle";
import { supabase } from "@/app/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setSubmitting(false);
      return;
    }

    setSent(true);
    setSubmitting(false);
  };

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
          <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-tight text-foreground">
            Reset password
          </h1>
          <p className="mt-2 text-sm text-muted">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          {sent ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-foreground">
                Check your inbox — a password reset link is on its way to{" "}
                <strong>{email}</strong>.
              </p>
              <Link
                href="/login"
                className="block text-center w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                Back to log in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                  placeholder="you@school.edu"
                />
              </div>

              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          {!sent && (
            <p className="mt-5 text-sm text-muted">
              Remember your password?{" "}
              <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                Log in
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
