"use client";

import { FormEvent, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type FormStatus = "idle" | "submitting" | "success" | "error";

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
    <section className="bg-[#111b28] text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="space-y-3 border-l-2 border-accent pl-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Improve DebateAI</p>
            <h3 className="font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-tight text-white sm:text-5xl">
              Help us train smarter
            </h3>
            <p className="text-[1.05rem] leading-relaxed text-white/70 sm:text-[1.15rem]">
              Got a topic you wish DebateAI knew better? Tell us what areas you&apos;d like to see more training on — or
              drop a file with examples — and we&apos;ll use it to improve future updates.
            </p>
          </div>

          {status === "success" ? (
            <div className="rounded-xl border border-accent/30 bg-white/5 px-6 py-5">
              <p className="font-medium text-white">Thanks for helping us improve!</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                We&apos;ve received your suggestion. The more specific you are, the better we can train on what matters
                to the circuit.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-4 text-sm font-medium text-accent transition-colors hover:text-white"
              >
                Submit another suggestion
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="training-area" className="block text-sm font-medium text-white/90">
                  What should we train on?
                </label>
                <textarea
                  id="training-area"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  rows={4}
                  placeholder="e.g. Kantian ethics, plan-inclusive counterplans, disclosure theory..."
                  className="w-full resize-y rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-white/35 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  disabled={status === "submitting"}
                />
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-white/90">Supporting file (optional)</span>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center transition-colors hover:border-accent/50 hover:bg-white/[0.07]">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.doc,.docx"
                    className="sr-only"
                    disabled={status === "submitting"}
                    onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                  />
                  <span className="text-sm text-white/80">
                    {fileName ? fileName : "Click to attach a brief, card file, or notes"}
                  </span>
                  <span className="mt-1 text-xs text-white/45">PDF, TXT, MD, DOC</span>
                </label>
              </div>

              {status === "error" && errorMessage ? (
                <p className="text-sm text-red-300" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
