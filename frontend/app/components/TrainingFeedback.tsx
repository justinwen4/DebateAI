"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { apiFetch } from "@/app/lib/api";

type FormStatus = "idle" | "submitting" | "success" | "error";

export default function TrainingFeedback() {
  const { user, loading: authLoading } = useAuth();
  const [area, setArea] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedArea = area.trim();
    if (!trimmedArea) {
      setStatus("error");
      setErrorMessage("Please describe the area you'd like us to train on.");
      return;
    }

    if (!user) {
      setStatus("error");
      setErrorMessage("Please sign in to submit a training suggestion.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("area", trimmedArea);

    const file = fileInputRef.current?.files?.[0];
    if (file) {
      formData.append("file", file);
    }

    try {
      const res = await apiFetch("/training-request", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "Something went wrong. Please try again.");
      }

      setArea("");
      setFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <section className="border-y border-border-subtle bg-surface/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="space-y-3 border-l-2 border-accent pl-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Improve DebateAI</p>
            <h3 className="font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-tight text-foreground sm:text-5xl">
              Help us train smarter
            </h3>
            <p className="text-[1.05rem] leading-relaxed text-foreground/80 sm:text-[1.15rem]">
              Got a topic you wish DebateAI knew better? Tell us what areas you&apos;d like to see more training on — or
              drop a file with examples — and we&apos;ll use it to improve future updates.
            </p>
          </div>

          {status === "success" ? (
            <div className="rounded-xl border border-border bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
              <p className="font-medium text-foreground">Thanks for helping us improve!</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                We&apos;ve received your suggestion. The more specific you are, the better we can train on what matters
                to the circuit.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-4 text-sm font-medium text-accent transition-colors hover:text-foreground"
              >
                Submit another suggestion
              </button>
            </div>
          ) : !authLoading && !user ? (
            <div className="rounded-xl border border-border bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
              <p className="font-medium text-foreground">Sign in to submit suggestions</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                Training suggestions are tied to your account so we can follow up if needed.
              </p>
              <Link
                href="/login?next=/"
                className="mt-4 inline-block text-sm font-medium text-accent transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label
                  htmlFor="training-area"
                  className="block text-[1.05rem] font-medium leading-relaxed text-foreground sm:text-[1.15rem]"
                >
                  What should we train on?
                </label>
                <textarea
                  id="training-area"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  rows={4}
                  placeholder="e.g. Kantian ethics, plan-inclusive counterplans, disclosure theory..."
                  className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-4 text-[1.05rem] leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-[1.15rem]"
                  disabled={status === "submitting"}
                />
              </div>

              <div className="space-y-3">
                <span className="block text-[1.05rem] font-medium leading-relaxed text-foreground sm:text-[1.15rem]">
                  Supporting file (optional)
                </span>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-4 py-7 text-center shadow-[var(--shadow-sm)] transition-colors hover:border-accent/50 hover:bg-surface-hover">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.doc,.docx"
                    className="sr-only"
                    disabled={status === "submitting"}
                    onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                  />
                  <span className="text-[1.05rem] leading-relaxed text-foreground/80 sm:text-[1.15rem]">
                    {fileName ? fileName : "Click to attach a brief, card file, or notes"}
                  </span>
                  <span className="mt-1.5 text-sm text-muted">PDF, TXT, MD, DOC</span>
                </label>
              </div>

              {status === "error" && errorMessage ? (
                <p className="text-[1.05rem] leading-relaxed text-red-600 dark:text-red-400 sm:text-[1.15rem]" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="rounded-xl bg-foreground px-6 py-3 text-base font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Sending..." : "Submit feedback"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
