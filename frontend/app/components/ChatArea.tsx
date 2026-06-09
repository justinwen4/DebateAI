"use client";

import { FormEvent, RefObject } from "react";
import MessageList, { Message } from "./MessageList";
import InputBar from "./InputBar";
import StarterQuestions from "./StarterQuestions";
import ThemeToggle from "./ThemeToggle";
import { SidebarToggleButton } from "./Sidebar";
import EditableTitle from "./EditableTitle";
import { DEFAULT_CONVERSATION_TITLE } from "@/app/lib/conversationTitle";

export interface UsageBannerState {
  message: string;
  tier: "premium" | "standard";
  monthlyUsage: number;
  premiumLimit: number;
}

interface ChatAreaProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  conversationTitle: string;
  canRenameTitle: boolean;
  onRenameTitle: (title: string) => void | Promise<void>;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  onSend: (e: FormEvent) => void;
  onSendMessage: (text: string) => void;
  onFeedback: (messageId: string, rating: number, notes: string) => Promise<void>;
  loading: boolean;
  streamingMessageId?: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  usageBanner: UsageBannerState | null;
  onDismissUsageBanner: () => void;
  errorBanner?: string | null;
  onDismissError?: () => void;
  onRetry?: () => void;
}

export default function ChatArea({
  sidebarCollapsed,
  onToggleSidebar,
  conversationTitle,
  canRenameTitle,
  onRenameTitle,
  messages,
  input,
  setInput,
  onSend,
  onSendMessage,
  onFeedback,
  loading,
  streamingMessageId = null,
  scrollRef,
  usageBanner,
  onDismissUsageBanner,
  errorBanner = null,
  onDismissError,
  onRetry,
}: ChatAreaProps) {
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
            <EditableTitle
              value={conversationTitle || DEFAULT_CONVERSATION_TITLE}
              onSave={onRenameTitle}
              disabled={!canRenameTitle}
              editTrigger="click"
              className="min-w-0 flex-1 text-[15px] font-medium text-foreground tracking-tight hover:text-foreground/80"
              inputClassName="text-[15px] font-medium tracking-tight"
            />
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

      {errorBanner ? (
        <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-6 py-3">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm leading-relaxed text-foreground">{errorBanner}</p>
            <div className="flex shrink-0 items-center gap-3">
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Retry
                </button>
              ) : null}
              {onDismissError ? (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="text-xs font-medium text-muted transition-colors hover:text-foreground"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <MessageList
        messages={messages}
        loading={loading}
        streamingMessageId={streamingMessageId}
        scrollRef={scrollRef}
        onFeedback={onFeedback}
      />
      {messages.length === 0 ? (
        <StarterQuestions onSelect={onSendMessage} disabled={loading || !!streamingMessageId} />
      ) : null}
      <InputBar input={input} setInput={setInput} onSend={onSend} loading={loading || !!streamingMessageId} />
    </main>
  );
}
