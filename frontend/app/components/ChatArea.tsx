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

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "the",
  "to",
  "we",
  "what",
  "when",
  "where",
  "why",
  "you",
]);

function toTitleCase(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function buildConversationTitle(content: string) {
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word));

  const uniqueWords: string[] = [];
  for (const word of words) {
    if (!uniqueWords.includes(word)) uniqueWords.push(word);
    if (uniqueWords.length === 3) break;
  }

  if (uniqueWords.length === 0) return "Conversation";
  return uniqueWords.map(toTitleCase).join(" ");
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
  const firstUserMsg = messages.find((m) => m.role === "user");
  const title = firstUserMsg ? buildConversationTitle(firstUserMsg.content) : "New conversation";

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md shrink-0 border-b border-border-subtle/50">
        <div className="px-6 py-3.5 flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-foreground tracking-tight truncate pr-4">
            {title}
          </h2>
          <ThemeToggle />
        </div>
      </header>

      <MessageList messages={messages} loading={loading} scrollRef={scrollRef} onFeedback={onFeedback} />
      <InputBar input={input} setInput={setInput} onSend={onSend} loading={loading} />
    </main>
  );
}
