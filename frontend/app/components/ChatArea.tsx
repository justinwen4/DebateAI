"use client";

import { FormEvent, RefObject } from "react";
import MessageList, { Message } from "./MessageList";
import InputBar from "./InputBar";
import ThemeToggle from "./ThemeToggle";

interface ChatAreaProps {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  onSend: (e: FormEvent) => void;
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export default function ChatArea({
  messages,
  input,
  setInput,
  onSend,
  loading,
  scrollRef,
}: ChatAreaProps) {
  return (
    <main className="flex-1 flex flex-col min-w-0">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background shrink-0">
        <h2 className="text-sm font-medium text-muted">
          {messages.length > 0 ? "Conversation" : "New conversation"}
        </h2>
        <ThemeToggle />
      </header>

      <MessageList messages={messages} loading={loading} scrollRef={scrollRef} />
      <InputBar input={input} setInput={setInput} onSend={onSend} loading={loading} />
    </main>
  );
}
