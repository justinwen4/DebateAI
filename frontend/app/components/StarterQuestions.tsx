"use client";

const STARTER_QUESTIONS = [
  "What is theory in LD debate?",
  "What is a kritik and how does it work?",
  "How do I answer topicality?",
  "What is a framework in LD?",
  "Why are PICs good?",
  "How do I respond to \"fiat is illusory\"?",
];

interface StarterQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export default function StarterQuestions({ onSelect, disabled }: StarterQuestionsProps) {
  return (
    <div className="shrink-0 px-6 pb-2">
      <div className="max-w-[800px] mx-auto">
        <p className="mb-2.5 text-center text-xs font-medium text-muted">Start here</p>
        <div className="flex flex-wrap justify-center gap-2">
          {STARTER_QUESTIONS.map((question) => (
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
      </div>
    </div>
  );
}
