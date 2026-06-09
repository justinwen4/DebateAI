"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/app/lib/supabase";
import { AuthError, AuthField, AuthLoading, AuthShell, AuthSubmitButton } from "@/app/components/AuthShell";

/** Validated post-login destination from `?next=` (set by the route guard).
 * Only same-site absolute paths are allowed — never protocol-relative URLs. */
function safeNextPath(): string {
  if (typeof window === "undefined") return "/chat";
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/chat";
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(safeNextPath());
    }
  }, [authLoading, router, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    router.replace(safeNextPath());
  };

  if (authLoading || user) {
    return <AuthLoading />;
  }

  return (
    <AuthShell>
      <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-tight text-foreground">
        Log in
      </h1>
      <p className="mt-2 text-sm text-muted">Continue to your debate workspace.</p>

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
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
          placeholder="Enter your password"
          labelAccessory={
            <Link
              href="/forgot-password"
              className="text-xs text-muted underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          }
        />

        <AuthError message={error} />

        <AuthSubmitButton submitting={submitting} idleLabel="Log in" busyLabel="Logging in..." />
      </form>

      <p className="mt-5 text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
        .
      </p>
    </AuthShell>
  );
}
