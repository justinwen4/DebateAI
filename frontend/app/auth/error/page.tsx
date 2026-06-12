"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const reason =
    searchParams.get("reason") ?? "Something went wrong confirming your email. Please try again.";

  if (code === "otp_expired") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)] max-w-sm w-full">
        <p className="font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight text-foreground mb-2">
          You&apos;re all set
        </p>
        <p className="text-sm text-muted mb-5">
          This confirmation link has already been used &mdash; your account is active. Log in with
          the password you chose at signup.
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

  const isPkceError = reason.toLowerCase().includes("pkce code verifier");

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)] text-center max-w-sm w-full">
      <p className="text-sm font-medium text-foreground mb-1">Confirmation failed</p>
      <p className="text-sm text-muted mb-4">
        {isPkceError
          ? "Open the confirmation link in the same browser where you signed up, or log in if your account is already active."
          : reason}
      </p>
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

export default function AuthErrorPage() {
  return (
    <main className="h-full grid place-items-center bg-background px-6">
      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-surface px-6 py-4 text-sm text-muted shadow-[var(--shadow-sm)]">
            Loading&hellip;
          </div>
        }
      >
        <AuthErrorContent />
      </Suspense>
    </main>
  );
}
