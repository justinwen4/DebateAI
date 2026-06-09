"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { AuthError, AuthField, AuthShell, AuthSubmitButton } from "@/app/components/AuthShell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    router.replace("/chat");
  };

  return (
    <AuthShell>
      <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-tight text-foreground">
        New password
      </h1>
      <p className="mt-2 text-sm text-muted">Choose a new password for your account.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <AuthField
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          required
          minLength={6}
          placeholder="At least 6 characters"
        />

        <AuthField
          id="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          required
          minLength={6}
          placeholder="Re-enter your password"
        />

        <AuthError message={error} />

        <AuthSubmitButton submitting={submitting} idleLabel="Set new password" busyLabel="Saving..." />
      </form>
    </AuthShell>
  );
}
