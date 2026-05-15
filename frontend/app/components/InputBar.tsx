"use client";

import { FormEvent, useEffect, useRef } from "react";

interface InputBarProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (e: FormEvent) => void;
  loading: boolean;
}

export default function InputBar({ input, setInput, onSend, loading }: InputBarProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(e as unknown as FormEvent);
    }
  };

  return (
    <div className="shrink-0 px-6 pb-4 pt-2 bg-background">
      <form
        onSubmit={onSend}
        className="max-w-[800px] mx-auto relative rounded-2xl border border-border-subtle bg-surface focus-within:border-border transition-all"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a debate question..."
          rows={1}
          className="w-full resize-none rounded-2xl bg-transparent px-5 py-3.5 pr-14 text-sm text-foreground placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-accent hover:bg-accent-hover hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </form>
    </div>
  );
}
