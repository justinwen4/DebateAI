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
    <div className="shrink-0 px-6 pb-5 pt-3 bg-background">
      <form
        onSubmit={onSend}
        className="max-w-3xl mx-auto relative rounded-2xl border border-border-subtle bg-surface focus-within:border-border transition-all"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a debate question..."
          rows={1}
          className="w-full resize-none rounded-2xl bg-transparent px-5 py-3.5 pr-14 text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
