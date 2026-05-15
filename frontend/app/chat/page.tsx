"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import ChatArea from "@/app/components/ChatArea";
import { Message } from "@/app/components/MessageList";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/app/lib/supabase";
import { buildConversationTitle } from "@/app/lib/conversationTitle";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

interface DatabaseMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

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
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConversations(true);
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      setLoadingConversations(false);
      throw error;
    }

    const list = (data ?? []) as ConversationSummary[];
    setConversations(list);
    const firstConversationId = list[0]?.id ?? null;
    setActiveConversationId(firstConversationId);
    if (firstConversationId) {
      await loadConversationMessages(firstConversationId);
    } else {
      setMessages([]);
      setInput("");
    }
    setLoadingConversations(false);
  }, [loadConversationMessages, user]);

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
        title: "New conversation",
        updated_at: new Date().toISOString(),
      })
      .select("id, title, updated_at")
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

  const send = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || loading || !user) return;

      let conversationId = activeConversationId;
      if (!conversationId) {
        conversationId = await createConversation();
      }

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const hasUserMessage = messages.some((m) => m.role === "user");
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: text,
      });

      if (!hasUserMessage) {
        const title = buildConversationTitle(text);
        await supabase.from("conversations").update({ title }).eq("id", conversationId);
        setConversations((prev) =>
          prev.map((conversation) => (conversation.id === conversationId ? { ...conversation, title } : conversation)),
        );
      }

      try {
        const res = await fetch(`${API_URL}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, history }),
        });

        if (!res.ok) throw new Error(`API error ${res.status}`);

        const data = await res.json();
        const botText = data.output as string;
        const botMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: botText };
        setMessages((prev) => [...prev, botMsg]);
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: botText,
        });
      } catch {
        const fallbackText = "Something went wrong — the backend may be unreachable.";
        const errMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fallbackText,
        };
        setMessages((prev) => [...prev, errMsg]);
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fallbackText,
        });
      } finally {
        await touchConversation(conversationId);
        setLoading(false);
      }
    },
    [activeConversationId, createConversation, input, loading, messages, touchConversation, user],
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

      const res = await fetch(`${API_URL}/feedback`, {
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
        onNewChat={() => {
          void handleNewChat();
        }}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(conversationId) => {
          void handleSelectConversation(conversationId);
        }}
        userEmail={user.email}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      />
      <ChatArea
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={send}
        onFeedback={handleFeedback}
        loading={loading}
        scrollRef={scrollRef}
      />
    </div>
  );
}
