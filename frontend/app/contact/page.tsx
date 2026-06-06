"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LogoWithLabel } from "@/app/components/Logo";
import { supabase } from "@/app/lib/supabase";

const categories = [
  { value: "general", label: "General Question" },
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
] as const;

type Category = (typeof categories)[number]["value"];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("contact_submissions").insert({
      name: name.trim(),
      email: email.trim(),
      category,
      message: message.trim(),
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <main className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <LogoWithLabel />
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-[#1a2332] text-white">
        <div className="mx-auto w-full max-w-2xl space-y-10 px-6 py-16 md:py-20">
          <div className="space-y-3 border-l-2 border-accent pl-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Contact</p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-tight text-white sm:text-5xl">
              Get in touch
            </h1>
            <p className="max-w-xl text-[1.05rem] leading-relaxed text-white/70 sm:text-[1.15rem]">
              Questions, bug reports, or feedback — we read every submission.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-white">Message sent</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Thanks for reaching out. We&apos;ll get back to you as soon as we can.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-white"
              >
                ← Back to DebateAI
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium text-white/90">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-accent/60"
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-white/90">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-accent/60"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="category" className="text-sm font-medium text-white/90">
                  Category
                </label>
                <select
                  id="category"
                  required
                  value={category}
                  onChange={(event) => setCategory(event.target.value as Category)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-accent/60"
                >
                  {categories.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#1a2332] text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="message" className="text-sm font-medium text-white/90">
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-accent/60"
                  placeholder="Describe your question, bug, or suggestion..."
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send message"}
              </button>
            </form>
          )}

          {!submitted ? (
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-white"
            >
              ← Back to DebateAI
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
