import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Message } from "@/app/components/MessageList";
import type { ConversationSummary } from "@/app/components/Sidebar";
import { supabase } from "@/app/lib/supabase";
import { DEFAULT_CONVERSATION_TITLE } from "@/app/lib/conversationTitle";
import { apiFetch } from "@/app/lib/api";

interface DatabaseMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface TitleApiResponse {
  title: string;
}

const CONVERSATION_PARAM = "c";

/** Reflect the active conversation in the URL (?c=<id>) without a navigation,
 * so a refresh restores the same thread. */
function setConversationParam(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set(CONVERSATION_PARAM, id);
  } else {
    url.searchParams.delete(CONVERSATION_PARAM);
  }
  window.history.replaceState(window.history.state, "", url);
}

function readConversationParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(CONVERSATION_PARAM);
}

/**
 * Owns the conversation list, the on-screen messages, and all conversation
 * CRUD. Surfaces user-actionable failures via `error` instead of swallowing
 * them, and keeps the active conversation in the URL.
 */
export function useConversations(user: User | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const clearError = useCallback(() => setError(null), []);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const { data, error: loadError } = await supabase
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (loadError) throw loadError;
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
    setError(null);
    try {
      const { data, error: listError } = await supabase
        .from("conversations")
        .select("id, title, title_locked, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (listError) throw listError;

      const list = (data ?? []) as ConversationSummary[];
      setConversations(list);

      // Restore the active conversation from the URL if it still exists.
      const desired = readConversationParam();
      const match = desired ? list.find((c) => c.id === desired) : undefined;
      if (match) {
        setActiveConversationId(match.id);
        try {
          await loadConversationMessages(match.id);
        } catch {
          setMessages([]);
          setError("We couldn't open your last conversation. Pick one from the sidebar to retry.");
        }
      } else {
        setActiveConversationId(null);
        setMessages([]);
        setInput("");
        if (desired) setConversationParam(null);
      }
    } catch {
      setError("We couldn't load your conversations.");
    } finally {
      setLoadingConversations(false);
    }
  }, [user, loadConversationMessages]);

  useEffect(() => {
    if (!user) return;
    void loadConversations();
  }, [loadConversations, user]);

  const createConversation = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");
    const { data, error: createError } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: DEFAULT_CONVERSATION_TITLE,
        title_locked: false,
        updated_at: new Date().toISOString(),
      })
      .select("id, title, title_locked, updated_at")
      .single();

    if (createError || !data) throw createError ?? new Error("Failed to create conversation");
    const conversation = data as ConversationSummary;
    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(conversation.id);
    setConversationParam(conversation.id);
    setMessages([]);
    setInput("");
    return conversation.id;
  }, [user]);

  const touchConversation = useCallback(async (conversationId: string) => {
    const updatedAt = new Date().toISOString();
    await supabase.from("conversations").update({ updated_at: updatedAt }).eq("id", conversationId);
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
      const { error: renameError } = await supabase
        .from("conversations")
        .update({ title, title_locked: true })
        .eq("id", conversationId);

      if (renameError) {
        setError("We couldn't rename that conversation.");
        return;
      }
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

        const { error: titleError } = await supabase
          .from("conversations")
          .update({ title: data.title })
          .eq("id", conversationId)
          .eq("title_locked", false);

        if (titleError) return;
        updateConversationTitle(conversationId, data.title);
      } catch {
        // Keep the provisional title if generation fails — not user-actionable.
      }
    },
    [updateConversationTitle],
  );

  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      if (conversationId === activeConversationId) return;
      setActiveConversationId(conversationId);
      setConversationParam(conversationId);
      try {
        await loadConversationMessages(conversationId);
      } catch {
        setMessages([]);
        setError("We couldn't open that conversation.");
      }
    },
    [activeConversationId, loadConversationMessages],
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      const { error: deleteError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);
      if (deleteError) {
        setError("We couldn't delete that conversation.");
        return;
      }

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setConversationParam(null);
        setMessages([]);
        setInput("");
      }
    },
    [activeConversationId],
  );

  const handleNewChat = useCallback(async () => {
    try {
      await createConversation();
    } catch {
      setError("We couldn't start a new chat. Please try again.");
    }
  }, [createConversation]);

  const resetForSignOut = useCallback(() => {
    setMessages([]);
    setConversations([]);
    setActiveConversationId(null);
    setConversationParam(null);
  }, []);

  return {
    // state
    messages,
    setMessages,
    input,
    setInput,
    streamingMessageId,
    setStreamingMessageId,
    conversations,
    activeConversationId,
    loadingConversations,
    error,
    clearError,
    retry: loadConversations,
    // conversation ops
    createConversation,
    touchConversation,
    updateConversationTitle,
    generateConversationTitle,
    handleRenameConversation,
    handleSelectConversation,
    handleDeleteConversation,
    handleNewChat,
    resetForSignOut,
  };
}
