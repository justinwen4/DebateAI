"use client";

import { useState, useEffect, useCallback } from "react";

const STARTER_QUESTIONS = [
  "What is theory in LD debate?",
  "What is a kritik and how does it work?",
  "How do I answer topicality?",
  "What is a framework in LD?",
  "Why are PICs good?",
  'How do I respond to "fiat is illusory"?',
];

const PAIR_COUNT = Math.ceil(STARTER_QUESTIONS.length / 2);
const ROTATE_MS = 4000;
const FADE_MS = 250;

interface StarterQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export default function StarterQuestions({ onSelect, disabled }: StarterQuestionsProps) {
  const [pairIndex, setPairIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const goTo = useCallback((index: number) => {
    setVisible(false);
    setTimeout(() => {
      setPairIndex(index);
      setVisible(true);
    }, FADE_MS);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      goTo((pairIndex + 1) % PAIR_COUNT);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [pairIndex, goTo]);

  const visibleQuestions = [
    STARTER_QUESTIONS[pairIndex * 2],
    STARTER_QUESTIONS[pairIndex * 2 + 1],
  ].filter(Boolean);

  return (
    <div className="shrink-0 px-6 pb-2">
      <div className="max-w-[800px] mx-auto">
        <p className="mb-2.5 text-center text-xs font-medium text-muted">Start here</p>

        <div
          style={{ transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease` }}
          className={`flex flex-wrap justify-center gap-2 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
          }`}
        >
          {visibleQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onSelect(question)}
              disabled={disabled}
              className="rounded-full border border-border-subtle bg-surface px-3.5 py-1.5 text-[13px] text-foreground/90 shadow-[var(--shadow-sm)] transition-all hover:border-accent/30 hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {question}
            </button>
          ))}
        </div>

        <div className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: PAIR_COUNT }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show question set ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                i === pairIndex
                  ? "w-4 bg-accent/70"
                  : "w-1 bg-muted/30 hover:bg-muted/60"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
