"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoWithLabel } from "@/app/components/Logo";
import ThemeToggle from "@/app/components/ThemeToggle";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/app/lib/supabase";

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
        emailRedirectTo: `${siteUrl}/auth/callback`,
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
    return (
      <main className="h-full grid place-items-center bg-background px-6">
        <div className="rounded-xl border border-border bg-surface px-6 py-4 text-sm text-muted shadow-[var(--shadow-sm)]">
          Loading...
        </div>
      </main>
    );
  }

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
                  Open the email and click the confirmation link to activate your account.
                  Be sure to check your <strong>spam</strong> folder if you don&apos;t see it.
                </p>
                <p>
                  Once confirmed, you can log in with the password you just chose.
                </p>
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

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                    placeholder="At least 6 characters"
                  />
                </div>

                {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Creating account..." : "Create account"}
                </button>
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
        </div>
      </div>
    </main>
  );
}
