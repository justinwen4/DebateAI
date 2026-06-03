"use client";

import { FormEvent, RefObject } from "react";
import MessageList, { Message } from "./MessageList";
import InputBar from "./InputBar";
import ThemeToggle from "./ThemeToggle";
import { SidebarToggleButton } from "./Sidebar";
import { buildConversationTitle } from "@/app/lib/conversationTitle";

export interface UsageBannerState {
  message: string;
  tier: "premium" | "standard";
  monthlyUsage: number;
  premiumLimit: number;
}

interface ChatAreaProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
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
  sidebarCollapsed,
  onToggleSidebar,
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
        <div className="px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {sidebarCollapsed ? (
              <SidebarToggleButton
                collapsed={sidebarCollapsed}
                onClick={onToggleSidebar}
                label="Expand sidebar"
                className="-ml-1 shrink-0"
              />
            ) : null}
            <h2 className="min-w-0 flex-1 text-[15px] font-medium text-foreground tracking-tight truncate">
              {title}
            </h2>
          </div>
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
