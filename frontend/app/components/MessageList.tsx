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

function FeedbackButton({
  messageId,
  onFeedback,
  showProminentPrompt,
}: {
  messageId: string;
  onFeedback: (id: string, rating: number, notes: string) => Promise<void>;
  showProminentPrompt: boolean;
}) {
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
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Feedback saved
      </div>
    );
  }

  if (state === "open" || state === "saving") {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              disabled={state === "saving"}
              title={RATING_LABELS[n]}
              className={`w-7 h-7 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                rating === n
                  ? "bg-accent text-white"
                  : "bg-surface text-muted hover:text-foreground hover:bg-surface-hover border border-border-subtle"
              }`}
            >
              {n}
            </button>
          ))}
          {rating && <span className="text-[11px] text-muted ml-1.5">{RATING_LABELS[rating]}</span>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 text-xs rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent/20"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            disabled={state === "saving"}
          />
          <button
            onClick={submit}
            disabled={state === "saving" || !rating}
            className="text-xs px-2.5 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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

  if (showProminentPrompt) {
    return (
      <div className="mt-2.5 rounded-md border border-border-subtle bg-surface px-2.5 py-2">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setState("open")}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors cursor-pointer"
            title="Rate this response"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Rate
          </button>
          <p className="text-[12px] leading-tight text-muted">
            Help us improve responses! Please rate this answer and share notes :)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setState("open")}
        className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-accent hover:text-accent-hover transition-colors cursor-pointer"
        title="Rate this response"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        Rate response
      </button>
    </div>
  );
}

export default function MessageList({ messages, loading, scrollRef, onFeedback }: MessageListProps) {
  const firstAssistantMessageId = messages.find((m) => m.role === "assistant")?.id;

  if (messages.length === 0 && !loading) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-accent text-lg font-bold">D</span>
          </div>
          <p className="text-sm text-foreground/80 font-medium mb-1">Start a conversation</p>
          <p className="text-[13px] text-muted">Ask a debate question to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="max-w-[800px] mx-auto px-6 py-5 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="message-enter">
            {m.role === "assistant" ? (
              <div className="group rounded-lg border border-border-subtle bg-surface-elevated px-5 py-4" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="text-[14px] leading-[1.75] text-foreground whitespace-pre-wrap">
                  {m.content}
                </div>
                <FeedbackButton
                  messageId={m.id}
                  onFeedback={onFeedback}
                  showProminentPrompt={m.id === firstAssistantMessageId}
                />
              </div>
            ) : (
              <div className="pl-1 py-1">
                <div className="text-[14px] leading-[1.75] text-foreground whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="message-enter">
            <div className="rounded-lg border border-border-subtle bg-surface-elevated px-5 py-4" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="flex gap-1.5 items-center py-1">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted/60" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted/60" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted/60" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
