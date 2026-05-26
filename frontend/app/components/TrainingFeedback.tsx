"use client";

import { FormEvent, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type FormStatus = "idle" | "submitting" | "success" | "error";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

export default function TrainingFeedback() {
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

    setStatus("submitting");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("area", trimmedArea);

    const file = fileInputRef.current?.files?.[0];
    if (file) {
      formData.append("file", file);
    }

    try {
      const res = await fetch(`${API_URL}/training-request`, {
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
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-16 md:grid-cols-[1.1fr_1fr] md:items-start">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Improve DebateAI</p>
          <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-4xl leading-tight tracking-tight text-foreground sm:text-[3.2rem]">
            Help us train smarter
          </h2>
          <p className="text-lg leading-relaxed text-foreground/80">
            Got a topic you wish DebateAI knew better? Tell us what areas you&apos;d like to see more training on — or
            drop a file with examples — and we&apos;ll use it to improve future updates.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
          {status === "success" ? (
            <div className="space-y-3">
              <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-foreground">
                Thanks for helping us improve!
              </p>
              <p className="text-sm leading-relaxed text-muted">
                We&apos;ve received your suggestion. The more specific you are, the better we can train on what matters
                to the circuit.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="text-sm font-medium text-accent underline-offset-4 transition-colors hover:text-accent-hover hover:underline"
              >
                Submit another suggestion
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="training-area" className="text-sm font-medium text-foreground">
                  What should we train on?
                </label>
                <textarea
                  id="training-area"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  rows={4}
                  placeholder="e.g. Kantian ethics, plan-inclusive counterplans, disclosure theory..."
                  className={`${inputClassName} min-h-[7.5rem] resize-y leading-relaxed`}
                  disabled={status === "submitting"}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="training-file" className="text-sm font-medium text-foreground">
                  Supporting file <span className="font-normal text-muted">(optional)</span>
                </label>
                <label
                  htmlFor="training-file"
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:border-accent/40"
                >
                  <span className={`truncate ${fileName ? "text-foreground" : "text-muted"}`}>
                    {fileName ?? "Attach a brief, card file, or notes"}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-accent">Browse</span>
                  <input
                    ref={fileInputRef}
                    id="training-file"
                    type="file"
                    accept=".pdf,.txt,.md,.doc,.docx"
                    className="sr-only"
                    disabled={status === "submitting"}
                    onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                  />
                </label>
                <p className="text-xs text-muted">PDF, TXT, MD, DOC</p>
              </div>

              {status === "error" && errorMessage ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
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
