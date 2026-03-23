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
    <div className="shrink-0 border-t border-border bg-background px-6 py-3">
      <form onSubmit={onSend} className="max-w-3xl mx-auto flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a debate question..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="shrink-0 h-10 w-10 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
