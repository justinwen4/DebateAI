"use client";

import { RefObject, useState } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onFeedback: (messageId: string, rating: number, notes: string) => Promise<void>;
}

const RATING_LABELS = ["", "Poor", "Weak", "Mixed", "Good", "Strong"] as const;

function FeedbackButton({ messageId, onFeedback }: { messageId: string; onFeedback: (id: string, rating: number, notes: string) => Promise<void> }) {
  const [state, setState] = useState<"idle" | "open" | "saving" | "saved">("idle");
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!rating) return;
    setState("saving");
    onFeedback(messageId, rating, notes)
      .then(() => setState("saved"))
      .catch(() => setState("open"));
  };

  if (state === "saved") {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Feedback saved
      </div>
    );
  }

  if (state === "open" || state === "saving") {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              disabled={state === "saving"}
              title={RATING_LABELS[n]}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors cursor-pointer ${
                rating === n
                  ? "bg-accent text-white"
                  : "bg-surface text-muted hover:text-foreground hover:bg-surface/80 border border-border"
              }`}
            >
              {n}
            </button>
          ))}
          {rating && <span className="text-xs text-muted ml-1">{RATING_LABELS[rating]}</span>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 text-xs rounded border border-border bg-surface px-2 py-1 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            disabled={state === "saving"}
          />
          <button
            onClick={submit}
            disabled={state === "saving" || !rating}
            className="text-xs px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {state === "saving" ? "..." : "Send"}
          </button>
          <button
            onClick={() => { setState("idle"); setRating(null); setNotes(""); }}
            className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setState("open")}
      className="mt-1.5 p-1 rounded text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
      title="Rate this response"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}

export default function MessageList({ messages, loading, scrollRef, onFeedback }: MessageListProps) {
  if (messages.length === 0 && !loading) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-accent text-base font-bold">D</span>
          </div>
          <p className="text-sm text-muted">Ask a debate question to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-1">
        {messages.map((m) => (
          <div key={m.id} className="message-enter">
            <div className={`px-4 py-3.5 rounded-lg ${m.role === "user" ? "bg-surface" : ""}`}>
              <div className="flex items-center gap-2 mb-1">
                {m.role === "assistant" && (
                  <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center">
                    <span className="text-accent text-[10px] font-bold">D</span>
                  </div>
                )}
                <span className="text-xs font-medium text-muted">
                  {m.role === "user" ? "You" : "DebateAI"}
                </span>
              </div>
              <div className="text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">
                {m.content}
              </div>
              {m.role === "assistant" && (
                <FeedbackButton messageId={m.id} onFeedback={onFeedback} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-enter px-4 py-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center">
                <span className="text-accent text-[10px] font-bold">D</span>
              </div>
              <span className="text-xs font-medium text-muted">DebateAI</span>
            </div>
            <div className="flex gap-1.5 items-center">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
