"use client";

import { FormEvent, RefObject } from "react";
import MessageList, { Message } from "./MessageList";
import InputBar from "./InputBar";
import ThemeToggle from "./ThemeToggle";
import { buildConversationTitle } from "@/app/lib/conversationTitle";

export interface UsageBannerState {
  message: string;
  tier: "premium" | "standard";
  monthlyUsage: number;
  premiumLimit: number;
}

interface ChatAreaProps {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  onSend: (e: FormEvent) => void;
  onFeedback: (messageId: string, rating: number, notes: string) => Promise<void>;
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  usageBanner: UsageBannerState | null;
  onDismissUsageBanner: () => void;
}

export default function ChatArea({
  messages,
  input,
  setInput,
  onSend,
  onFeedback,
  loading,
  scrollRef,
  usageBanner,
  onDismissUsageBanner,
}: ChatAreaProps) {
  const firstUserMsg = messages.find((m) => m.role === "user");
  const title = firstUserMsg ? buildConversationTitle(firstUserMsg.content) : "New conversation";

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md shrink-0 border-b border-border-subtle/50">
        <div className="px-6 py-3.5 flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-foreground tracking-tight truncate pr-4">
            {title}
          </h2>
          <ThemeToggle />
        </div>
      </header>

      {usageBanner?.tier === "standard" ? (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-6 py-3">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm leading-relaxed text-foreground">
              {usageBanner.message}
            </p>
            <button
              type="button"
              onClick={onDismissUsageBanner}
              className="shrink-0 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <MessageList messages={messages} loading={loading} scrollRef={scrollRef} onFeedback={onFeedback} />
      <InputBar input={input} setInput={setInput} onSend={onSend} loading={loading} />
    </main>
  );
}
