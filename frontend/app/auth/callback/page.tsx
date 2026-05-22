"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      setError("Invalid confirmation link. Please try signing up again.");
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        router.replace("/chat");
      });
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="h-full grid place-items-center bg-background px-6">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)] text-center max-w-sm w-full">
          <p className="text-sm font-medium text-foreground mb-1">Confirmation failed</p>
          <p className="text-sm text-muted mb-4">{error}</p>
          <Link
            href="/signup"
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back to sign up
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="h-full grid place-items-center bg-background px-6">
      <div className="rounded-xl border border-border bg-surface px-6 py-4 text-sm text-muted shadow-[var(--shadow-sm)]">
        Verifying your email&hellip;
      </div>
    </main>
  );
}
