"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import { Message } from "./components/MessageList";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || loading) return;

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch(`${API_URL}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });

        if (!res.ok) throw new Error(`API error ${res.status}`);

        const data = await res.json();
        const botMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: data.output };
        setMessages((prev) => [...prev, botMsg]);
      } catch {
        const errMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Something went wrong — the backend may be unreachable.",
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading],
  );

  const handleFeedback = useCallback(
    async (messageId: string, rating: number, notes: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const assistantMsg = messages[idx];
      const userMsg = messages.slice(0, idx).reverse().find((m) => m.role === "user");
      if (!userMsg) return;

      await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg.content, output: assistantMsg.content, rating, notes }),
      });
    },
    [messages],
  );

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar onNewChat={handleNewChat} />
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
