"use client";

import { useState } from "react";

function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function StarIcon({ filled, hovered }: { filled: boolean; hovered: boolean }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill={filled || hovered ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="transition-all duration-100"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function AppRating() {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="bg-[#1a2332] border-t border-white/10">
      <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 py-16 md:grid-cols-2 md:gap-10">

        {/* GitHub Star */}
        <article className="space-y-4 border-l-2 border-accent pl-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Open Source</p>
          <h3 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-white">
            Star on GitHub
          </h3>
          <p className="max-w-md text-[1.1rem] leading-relaxed text-white/70">
            DebateAI is built in the open. If it&apos;s helped your prep, a GitHub star goes a long way toward keeping the project alive.
          </p>
          <a
            href="https://github.com/justinwen4/DebateAI"
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-2 inline-flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition-all hover:border-white/40 hover:bg-white/15"
          >
            <GitHubIcon className="transition-transform group-hover:scale-110" />
            Star on GitHub
            <span className="ml-1 text-white/40">★</span>
          </a>
        </article>

        {/* Star Rating */}
        <article className="space-y-4 border-l-2 border-accent pl-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Rate DebateAI</p>
          <h3 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-white">
            How are we doing?
          </h3>
          <p className="max-w-md text-[1.1rem] leading-relaxed text-white/70">
            Your rating helps us understand what&apos;s working and shapes what we build next.
          </p>

          {submitted ? (
            <div className="space-y-2 pt-1">
              <div className="flex gap-1 text-accent">
                {[1, 2, 3, 4, 5].map((s) => (
                  <StarIcon key={s} filled={s <= selected} hovered={false} />
                ))}
              </div>
              <p className="text-sm font-medium text-white/80">
                {selected >= 4
                  ? "Thanks — that means a lot to the team."
                  : "Thanks for the honest feedback. We'll keep improving."}
              </p>
              <button
                type="button"
                onClick={() => { setSubmitted(false); setSelected(0); setHovered(0); }}
                className="text-xs text-white/40 transition-colors hover:text-white/70"
              >
                Change rating
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div
                className="flex gap-1"
                onMouseLeave={() => setHovered(0)}
                role="group"
                aria-label="Rate DebateAI from 1 to 5 stars"
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                    onClick={() => { setSelected(star); setSubmitted(true); }}
                    onMouseEnter={() => setHovered(star)}
                    className={`cursor-pointer transition-colors ${
                      star <= (hovered || selected)
                        ? "text-accent"
                        : "text-white/25 hover:text-white/50"
                    }`}
                  >
                    <StarIcon filled={star <= selected} hovered={star <= hovered} />
                  </button>
                ))}
              </div>
              {hovered > 0 && (
                <p className="text-sm text-white/60 transition-opacity">{LABELS[hovered]}</p>
              )}
            </div>
          )}
        </article>

      </div>
    </section>
  );
}
