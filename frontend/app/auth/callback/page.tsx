"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type CallbackState =
  | { kind: "verifying" }
  | { kind: "already_confirmed" }
  | { kind: "error"; message: string };

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>({ kind: "verifying" });

  useEffect(() => {
    let cancelled = false;

    const next = searchParams.get("next") ?? "/chat";

    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const hashErrorCode = hashParams.get("error_code");
    const hashError = hashParams.get("error");
    const hashErrorDescription = hashParams.get("error_description");

    if (hashErrorCode === "otp_expired" || hashError === "access_denied") {
      setState({ kind: "already_confirmed" });
      return;
    }

    if (hashErrorDescription) {
      setState({ kind: "error", message: hashErrorDescription.replace(/\+/g, " ") });
      return;
    }

    const code = searchParams.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (cancelled) return;
        if (exchangeError) {
          setState({ kind: "error", message: exchangeError.message });
          return;
        }
        router.replace(next);
      });
      return;
    }

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError) {
        setState({ kind: "error", message: sessionError.message });
        return;
      }
      if (data.session) {
        router.replace(next);
        return;
      }
      setState({
        kind: "error",
        message: "Invalid confirmation link. Please try signing up again.",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (state.kind === "already_confirmed") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)] max-w-sm w-full">
        <p className="font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight text-foreground mb-2">
          You&apos;re all set
        </p>
        <p className="text-sm text-muted mb-5">
          This confirmation link has already been used &mdash; your account is active.
          Log in with the password you chose at signup.
        </p>
        <Link
          href="/login"
          className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Go to log in &rarr;
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)] text-center max-w-sm w-full">
        <p className="text-sm font-medium text-foreground mb-1">Confirmation failed</p>
        <p className="text-sm text-muted mb-4">{state.message}</p>
        <div className="flex flex-col gap-2">
          <Link
            href="/login"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Try logging in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            Back to sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-4 text-sm text-muted shadow-[var(--shadow-sm)]">
      Verifying your email&hellip;
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="h-full grid place-items-center bg-background px-6">
      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-surface px-6 py-4 text-sm text-muted shadow-[var(--shadow-sm)]">
            Verifying your email&hellip;
          </div>
        }
      >
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
