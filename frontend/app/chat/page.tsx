"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { ConversationSummary } from "@/app/components/Sidebar";
import ChatArea from "@/app/components/ChatArea";
import { Message } from "@/app/components/MessageList";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/app/lib/supabase";
import { DEFAULT_CONVERSATION_TITLE, provisionalConversationTitle } from "@/app/lib/conversationTitle";
import { apiFetch } from "@/app/lib/api";
import { streamGenerate } from "@/app/lib/streamGenerate";
import { createScrollScheduler } from "@/app/lib/scrollToBottom";
import { createSmoothStreamReveal } from "@/app/lib/smoothStreamReveal";
import type { UsageBannerState } from "@/app/components/ChatArea";

interface DatabaseMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface TitleApiResponse {
  title: string;
}

async function persistMessage(conversationId: string, role: "user" | "assistant", content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const res = await apiFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content: trimmed }),
  });

  if (!res.ok) {
    throw new Error(`Failed to save message (${res.status})`);
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [usageBanner, setUsageBanner] = useState<UsageBannerState | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollSchedulerRef = useRef(createScrollScheduler(() => scrollRef.current));
  const conversationsRef = useRef(conversations);
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (localStorage.getItem("chat-sidebar-collapsed") === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("chat-sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (streamingMessageId) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, streamingMessageId]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    const nextMessages = ((data ?? []) as DatabaseMessage[]).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }));
    setMessages(nextMessages);
    setInput("");
    setStreamingMessageId(null);
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConversations(true);
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, title_locked, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      setLoadingConversations(false);
      throw error;
    }

    const list = (data ?? []) as ConversationSummary[];
    setConversations(list);
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setLoadingConversations(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void loadConversations();
  }, [loadConversations, user]);

  const createConversation = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: DEFAULT_CONVERSATION_TITLE,
        title_locked: false,
        updated_at: new Date().toISOString(),
      })
      .select("id, title, title_locked, updated_at")
      .single();

    if (error || !data) throw error ?? new Error("Failed to create conversation");
    const conversation = data as ConversationSummary;
    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(conversation.id);
    setMessages([]);
    setInput("");
    return conversation.id;
  }, [user]);

  const touchConversation = useCallback(async (conversationId: string) => {
    const updatedAt = new Date().toISOString();
    await supabase
      .from("conversations")
      .update({ updated_at: updatedAt })
      .eq("id", conversationId);
    setConversations((prev) =>
      prev
        .map((conversation) =>
          conversation.id === conversationId ? { ...conversation, updated_at: updatedAt } : conversation,
        )
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    );
  }, []);

  const updateConversationTitle = useCallback(
    (conversationId: string, title: string, titleLocked?: boolean) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                title,
                ...(titleLocked === undefined ? {} : { title_locked: titleLocked }),
              }
            : conversation,
        ),
      );
    },
    [],
  );

  const handleRenameConversation = useCallback(
    async (conversationId: string, title: string) => {
      const { error } = await supabase
        .from("conversations")
        .update({ title, title_locked: true })
        .eq("id", conversationId);

      if (error) return;
      updateConversationTitle(conversationId, title, true);
    },
    [updateConversationTitle],
  );

  const generateConversationTitle = useCallback(
    async (conversationId: string, userMessage: string, assistantMessage: string) => {
      const conversation = conversationsRef.current.find((item) => item.id === conversationId);
      if (!conversation || conversation.title_locked) return;

      try {
        const res = await apiFetch("/generate-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_message: userMessage.slice(0, 500),
            assistant_message: assistantMessage.slice(0, 500),
          }),
        });

        if (!res.ok) return;

        const data = (await res.json()) as TitleApiResponse;
        const latest = conversationsRef.current.find((item) => item.id === conversationId);
        if (!latest || latest.title_locked) return;

        const { error } = await supabase
          .from("conversations")
          .update({ title: data.title })
          .eq("id", conversationId)
          .eq("title_locked", false);

        if (error) return;
        updateConversationTitle(conversationId, data.title);
      } catch {
        // Keep the provisional title if generation fails.
      }
    },
    [updateConversationTitle],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || !user) return;

      let conversationId = activeConversationId;
      if (!conversationId) {
        conversationId = await createConversation();
      }

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const isFirstExchange = !messages.some((m) => m.role === "user");
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        await persistMessage(conversationId, "user", trimmed);
      } catch {
        // Keep chatting even if persistence fails; message is still in local state.
      }

      if (isFirstExchange) {
        const title = provisionalConversationTitle(trimmed);
        void supabase
          .from("conversations")
          .update({ title })
          .eq("id", conversationId)
          .eq("title_locked", false);
        updateConversationTitle(conversationId, title);
      }

      const botId = crypto.randomUUID();
      let streamStarted = false;

      const syncBotMessage = (text: string) => {
        setMessages((prev) => {
          if (!prev.some((message) => message.id === botId)) {
            return [...prev, { id: botId, role: "assistant", content: text }];
          }
          return prev.map((message) => (message.id === botId ? { ...message, content: text } : message));
        });
        scrollSchedulerRef.current.schedule();
      };

      const reveal = createSmoothStreamReveal(syncBotMessage);
      let doneReceived = false;

      try {
        for await (const event of streamGenerate({ prompt: trimmed, history })) {
          if (event.type === "chunk") {
            if (!streamStarted) {
              streamStarted = true;
              setLoading(false);
              setStreamingMessageId(botId);
            }
            reveal.push(event.text);
            continue;
          }

          if (event.type === "error") {
            reveal.cancel();
            if (event.status === 429) {
              throw new Error("Daily limit reached. Try again tomorrow.");
            }
            throw new Error(event.detail);
          }

          if (event.type === "done") {
            doneReceived = true;
            reveal.flush();
            setStreamingMessageId(null);

            if (event.model_tier === "standard") {
              setUsageBanner({
                tier: "standard",
                monthlyUsage: event.monthly_usage,
                premiumLimit: event.premium_monthly_limit,
                message:
                  event.notice ??
                  `You've used ${event.monthly_usage}/${event.premium_monthly_limit} premium responses this month. Continuing on our standard model (Haiku) until your limit resets.`,
              });
            }

            const finalText = reveal.getTarget();
            try {
              await persistMessage(conversationId, "assistant", finalText);
            } catch {
              // Keep local response even if persistence fails.
            }
            if (isFirstExchange && finalText) {
              void generateConversationTitle(conversationId, trimmed, finalText);
            }
          }
        }

        // Stream ended without a done event (network drop, server timeout, etc.).
        // Persist whatever text was accumulated so the reply isn't lost on reload.
        if (streamStarted && !doneReceived) {
          reveal.flush();
          setStreamingMessageId(null);
          const finalText = reveal.getTarget();
          if (finalText) {
            try {
              await persistMessage(conversationId, "assistant", finalText);
            } catch {
              // Keep local response even if persistence fails.
            }
            if (isFirstExchange) {
              void generateConversationTitle(conversationId, trimmed, finalText);
            }
          }
        }
      } catch (err) {
        reveal.cancel();
        setStreamingMessageId(null);
        const fallbackText =
          err instanceof Error && err.message.includes("Daily limit")
            ? err.message
            : "Something went wrong — the backend may be unreachable.";
        setLoading(false);
        if (streamStarted) {
          syncBotMessage(fallbackText);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: botId, role: "assistant", content: fallbackText },
          ]);
        }
        try {
          await persistMessage(conversationId, "assistant", fallbackText);
        } catch {
          // Keep local error message even if persistence fails.
        }
      } finally {
        setLoading(false);
        setStreamingMessageId(null);
        void touchConversation(conversationId);
      }
    },
    [
      activeConversationId,
      createConversation,
      generateConversationTitle,
      loading,
      messages,
      touchConversation,
      updateConversationTitle,
      user,
    ],
  );

  const send = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await sendMessage(input);
    },
    [input, sendMessage],
  );

  const handleFeedback = useCallback(
    async (messageId: string, rating: number, notes: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const assistantMsg = messages[idx];
      const userMsg = messages
        .slice(0, idx)
        .reverse()
        .find((m) => m.role === "user");
      if (!userMsg) return;
      const firstUserMsg = messages.find((m) => m.role === "user");
      const curationEligible = firstUserMsg?.id === userMsg.id;

      const res = await apiFetch("/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMsg.content,
          output: assistantMsg.content,
          rating,
          notes,
          curation_eligible: curationEligible,
        }),
      });
      if (!res.ok) throw new Error(`Feedback error ${res.status}`);
    },
    [messages],
  );

  const handleNewChat = useCallback(async () => {
    try {
      await createConversation();
    } catch {
      // Keep the current thread if a new conversation cannot be created.
    }
  }, [createConversation]);

  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      if (conversationId === activeConversationId) return;
      setActiveConversationId(conversationId);
      try {
        await loadConversationMessages(conversationId);
      } catch {
        setMessages([]);
      }
    },
    [activeConversationId, loadConversationMessages],
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
      if (error) return;

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
        setInput("");
      }
    },
    [activeConversationId],
  );

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      setMessages([]);
      setConversations([]);
      setActiveConversationId(null);
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }, [router, signOut, signingOut]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  if (authLoading || loadingConversations || !user) {
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
          void handleNewChat();
        }}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(conversationId) => {
          void handleSelectConversation(conversationId);
        }}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={(conversationId) => {
          void handleDeleteConversation(conversationId);
        }}
        userEmail={user.email}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      />
      <ChatArea
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        conversationTitle={activeConversation?.title ?? DEFAULT_CONVERSATION_TITLE}
        canRenameTitle={Boolean(activeConversationId)}
        onRenameTitle={(title) => {
          if (!activeConversationId) return;
          void handleRenameConversation(activeConversationId, title);
        }}
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={send}
        onSendMessage={sendMessage}
        onFeedback={handleFeedback}
        loading={loading}
        streamingMessageId={streamingMessageId}
        scrollRef={scrollRef}
        usageBanner={usageBanner}
        onDismissUsageBanner={() => setUsageBanner(null)}
      />
    </div>
  );
}
