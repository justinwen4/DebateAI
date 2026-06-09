"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import ChatArea from "@/app/components/ChatArea";
import type { UsageBannerState } from "@/app/components/ChatArea";
import { useAuth } from "@/app/context/AuthContext";
import { DEFAULT_CONVERSATION_TITLE } from "@/app/lib/conversationTitle";
import { createScrollScheduler } from "@/app/lib/scrollToBottom";
import { useSidebarCollapsed } from "@/app/hooks/useSidebarCollapsed";
import { useConversations } from "@/app/hooks/useConversations";
import { useSendMessage } from "@/app/hooks/useSendMessage";

export default function ChatPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const [usageBanner, setUsageBanner] = useState<UsageBannerState | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollSchedulerRef = useRef(createScrollScheduler(() => scrollRef.current));
  const scheduleScroll = useCallback(() => scrollSchedulerRef.current.schedule(), []);

  const conv = useConversations(user);
  const { loading, sendMessage, submitFeedback } = useSendMessage({
    user,
    messages: conv.messages,
    setMessages: conv.setMessages,
    setInput: conv.setInput,
    activeConversationId: conv.activeConversationId,
    createConversation: conv.createConversation,
    updateConversationTitle: conv.updateConversationTitle,
    touchConversation: conv.touchConversation,
    generateConversationTitle: conv.generateConversationTitle,
    setStreamingMessageId: conv.setStreamingMessageId,
    scheduleScroll,
    setUsageBanner,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (conv.streamingMessageId) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [conv.messages, loading, conv.streamingMessageId]);

  const send = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await sendMessage(conv.input);
    },
    [conv.input, sendMessage],
  );

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      conv.resetForSignOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }, [conv, router, signOut, signingOut]);

  const activeConversation = useMemo(
    () => conv.conversations.find((c) => c.id === conv.activeConversationId) ?? null,
    [conv.activeConversationId, conv.conversations],
  );

  if (authLoading || conv.loadingConversations || !user) {
    return (
      <main className="h-full grid place-items-center bg-background px-6">
        <div className="rounded-xl border border-border bg-surface px-6 py-4 text-sm text-muted shadow-[var(--shadow-sm)]">
          Loading your workspace...
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        onNewChat={() => {
          void conv.handleNewChat();
        }}
        conversations={conv.conversations}
        activeConversationId={conv.activeConversationId}
        onSelectConversation={(conversationId) => {
          void conv.handleSelectConversation(conversationId);
        }}
        onRenameConversation={conv.handleRenameConversation}
        onDeleteConversation={(conversationId) => {
          void conv.handleDeleteConversation(conversationId);
        }}
        userEmail={user.email}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      />
      <ChatArea
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        conversationTitle={activeConversation?.title ?? DEFAULT_CONVERSATION_TITLE}
        canRenameTitle={Boolean(conv.activeConversationId)}
        onRenameTitle={(title) => {
          if (!conv.activeConversationId) return;
          void conv.handleRenameConversation(conv.activeConversationId, title);
        }}
        messages={conv.messages}
        input={conv.input}
        setInput={conv.setInput}
        onSend={send}
        onSendMessage={sendMessage}
        onFeedback={submitFeedback}
        loading={loading}
        streamingMessageId={conv.streamingMessageId}
        scrollRef={scrollRef}
        usageBanner={usageBanner}
        onDismissUsageBanner={() => setUsageBanner(null)}
        errorBanner={conv.error}
        onDismissError={conv.clearError}
        onRetry={() => {
          void conv.retry();
        }}
      />
    </div>
  );
}
