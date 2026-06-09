import { Dispatch, SetStateAction, useCallback, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Message } from "@/app/components/MessageList";
import type { UsageBannerState } from "@/app/components/ChatArea";
import { supabase } from "@/app/lib/supabase";
import { provisionalConversationTitle } from "@/app/lib/conversationTitle";
import { apiFetch } from "@/app/lib/api";
import { streamGenerate } from "@/app/lib/streamGenerate";
import { createSmoothStreamReveal } from "@/app/lib/smoothStreamReveal";
import { persistMessage } from "@/app/lib/persistMessage";

interface UseSendMessageParams {
  user: User | null;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setInput: (value: string) => void;
  activeConversationId: string | null;
  createConversation: () => Promise<string>;
  updateConversationTitle: (conversationId: string, title: string, titleLocked?: boolean) => void;
  touchConversation: (conversationId: string) => Promise<void>;
  generateConversationTitle: (
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
  ) => Promise<void>;
  setStreamingMessageId: (id: string | null) => void;
  scheduleScroll: () => void;
  setUsageBanner: (banner: UsageBannerState | null) => void;
}

/** Owns the streaming send pipeline and message feedback submission. */
export function useSendMessage({
  user,
  messages,
  setMessages,
  setInput,
  activeConversationId,
  createConversation,
  updateConversationTitle,
  touchConversation,
  generateConversationTitle,
  setStreamingMessageId,
  scheduleScroll,
  setUsageBanner,
}: UseSendMessageParams) {
  const [loading, setLoading] = useState(false);

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
        scheduleScroll();
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
          setMessages((prev) => [...prev, { id: botId, role: "assistant", content: fallbackText }]);
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
      scheduleScroll,
      setInput,
      setMessages,
      setStreamingMessageId,
      setUsageBanner,
      touchConversation,
      updateConversationTitle,
      user,
    ],
  );

  const submitFeedback = useCallback(
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

  return { loading, sendMessage, submitFeedback };
}
