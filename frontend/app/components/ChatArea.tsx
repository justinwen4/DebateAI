"use client";

import { FormEvent, RefObject } from "react";
import MessageList, { Message } from "./MessageList";
import InputBar from "./InputBar";
import ThemeToggle from "./ThemeToggle";
import CategorySelector, { Category } from "./CategorySelector";

interface ChatAreaProps {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  onSend: (e: FormEvent) => void;
  onFeedback: (messageId: string, rating: number, notes: string) => Promise<void>;
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  category: Category;
  setCategory: (category: Category) => void;
}

export default function ChatArea({
  messages,
  input,
  setInput,
  onSend,
  onFeedback,
  loading,
  scrollRef,
  category,
  setCategory,
}: ChatAreaProps) {
  return (
    <main className="flex-1 flex flex-col min-w-0">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium text-muted">
            {messages.length > 0 ? "Conversation" : "New conversation"}
          </h2>
          <CategorySelector value={category} onChange={setCategory} />
        </div>
        <ThemeToggle />
      </header>

      <MessageList messages={messages} loading={loading} scrollRef={scrollRef} onFeedback={onFeedback} />
      <InputBar input={input} setInput={setInput} onSend={onSend} loading={loading} />
    </main>
  );
}
