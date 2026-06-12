"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/app/lib/supabase";
import { AuthError, AuthField, AuthLoading, AuthShell, AuthSubmitButton } from "@/app/components/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/chat");
    }
  }, [authLoading, router, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Must match a Supabase redirect URL; the email template adds token_hash (see README).
        emailRedirectTo: `${siteUrl}/auth/callback?next=/chat`,
      },
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    if (data.session) {
      router.replace("/chat");
      return;
    }

    setSent(true);
    setSubmitting(false);
  };

  if (authLoading || user) {
    return <AuthLoading />;
  }

  return (
    <AuthShell>
      {sent ? (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-tight text-foreground">
            Email sent
          </h1>
          <p className="mt-2 text-sm text-muted">
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
          </p>

          <div className="mt-6 space-y-4 text-sm text-foreground">
            <p>
              Open the email and click the confirmation link to activate your account. Be sure to
              check your <strong>spam</strong> folder if you don&apos;t see it.
            </p>
            <p>Once confirmed, you can log in with the password you just chose.</p>
          </div>

          <Link
            href="/login"
            className="mt-6 block w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Go to log in &rarr;
          </Link>

          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-3 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            Use a different email
          </button>
        </>
      ) : (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-tight text-foreground">
            Create account
          </h1>
          <p className="mt-2 text-sm text-muted">Start using DebateAI in under a minute.</p>

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

            <AuthField
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              required
              minLength={6}
              placeholder="At least 6 characters"
            />

            <AuthError message={error} />

            <AuthSubmitButton
              submitting={submitting}
              idleLabel="Create account"
              busyLabel="Creating account..."
            />
          </form>

          <p className="mt-5 text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Log in
            </Link>
            .
          </p>
        </>
      )}
    </AuthShell>
  );
}
