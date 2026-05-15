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
  onFeedback: (messageId: string, rating: number, notes: string) => Promise<void>;
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export default function ChatArea({
  messages,
  input,
  setInput,
  onSend,
  onFeedback,
  loading,
  scrollRef,
}: ChatAreaProps) {
  return (
    <main className="flex-1 flex flex-col min-w-0 bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md shrink-0 border-b border-border-subtle/50">
        <div className="max-w-[680px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-foreground tracking-tight">
            {messages.length > 0 ? "Conversation" : "New conversation"}
          </h2>
          <ThemeToggle />
        </div>
      </header>

      <MessageList messages={messages} loading={loading} scrollRef={scrollRef} onFeedback={onFeedback} />
      <InputBar input={input} setInput={setInput} onSend={onSend} loading={loading} />
    </main>
  );
}
