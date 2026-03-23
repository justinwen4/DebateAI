"use client";

import { RefObject } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export default function MessageList({ messages, loading, scrollRef }: MessageListProps) {
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
