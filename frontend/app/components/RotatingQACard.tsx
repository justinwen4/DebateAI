"use client";

import { useEffect, useMemo, useState } from "react";

export type SampleQA = {
  question: string;
  answer: string;
};

type RotatingQACardProps = {
  items: SampleQA[];
  intervalMs?: number;
};

export default function RotatingQACard({ items, intervalMs = 7000 }: RotatingQACardProps) {
  const safeItems = useMemo(() => (items.length > 0 ? items : [{ question: "", answer: "" }]), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const setCardIndex = (index: number) => {
    if (isAnimating || index === activeIndex) return;
    setIsAnimating(true);
    setIsVisible(false);
    window.setTimeout(() => {
      setActiveIndex(index);
      setIsVisible(true);
      setIsAnimating(false);
    }, 180);
  };

  const goToPrevious = () => {
    const nextIndex = (activeIndex - 1 + safeItems.length) % safeItems.length;
    setCardIndex(nextIndex);
  };

  const goToNext = () => {
    const nextIndex = (activeIndex + 1) % safeItems.length;
    setCardIndex(nextIndex);
  };

  useEffect(() => {
    if (safeItems.length <= 1) return;
    const cycleTimer = window.setInterval(() => {
      setCardIndex((activeIndex + 1) % safeItems.length);
    }, intervalMs);

    return () => window.clearInterval(cycleTimer);
  }, [activeIndex, intervalMs, safeItems.length]);

  const item = safeItems[activeIndex];
  const transitionClass = `transition-all duration-300 ${
    isVisible ? "qa-enter translate-x-0" : "qa-exit -translate-x-2"
  }`;

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)]">
      <div className="flex items-center justify-between border-b border-border bg-surface-hover/60 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-muted/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted/50" />
        </div>
        <span className="text-xs text-muted">
          Sample question {activeIndex + 1} of {safeItems.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevious}
            className="p-1 text-muted transition-colors hover:text-foreground"
            aria-label="Show previous sample response"
          >
            <span aria-hidden>&larr;</span>
          </button>
          <button
            type="button"
            onClick={goToNext}
            className="p-1 text-muted transition-colors hover:text-foreground"
            aria-label="Show next sample response"
          >
            <span aria-hidden>&rarr;</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-background p-5">
        <h3 className={`font-semibold text-base text-foreground ${transitionClass}`}>{item.question}</h3>

        <div className={`rounded-lg border border-l-[3px] border-l-accent border-border bg-surface p-5 ${transitionClass}`}>
          <p className="max-h-32 overflow-y-auto text-[13px] leading-relaxed text-foreground/90">{item.answer}</p>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted">Rate this response: 1 = poor · 5 = great</p>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-sm text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                {rating}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Notes (optional)"
              readOnly
              className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-muted outline-none"
            />
            <button
              type="button"
              disabled
              className="h-10 shrink-0 rounded-md bg-foreground px-5 text-sm font-semibold text-background disabled:cursor-not-allowed"
            >
              Send feedback
            </button>
            <span className="shrink-0 cursor-pointer text-sm text-muted">Skip</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted">&uarr; Sign up to ask your own questions</p>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          <span>Ask a debate question...</span>
          <svg
            className="h-4 w-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </section>
  );
}
