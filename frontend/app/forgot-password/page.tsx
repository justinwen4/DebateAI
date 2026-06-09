"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { AuthError, AuthField, AuthShell, AuthSubmitButton } from "@/app/components/AuthShell";

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
    <AuthShell>
      <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-tight text-foreground">
        Reset password
      </h1>
      <p className="mt-2 text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>

      {sent ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-foreground">
            Check your inbox — a password reset link is on its way to <strong>{email}</strong>.
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
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            required
            placeholder="you@school.edu"
          />

          <AuthError message={error} />

          <AuthSubmitButton submitting={submitting} idleLabel="Send reset link" busyLabel="Sending..." />
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
    </AuthShell>
  );
}
