"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CONVERSATION_TITLE,
  normalizeConversationTitle,
} from "@/app/lib/conversationTitle";

interface EditableTitleProps {
  value: string;
  onSave: (title: string) => void | Promise<void>;
  editTrigger?: "click" | "doubleClick";
  onActivate?: () => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  title?: string;
}

export default function EditableTitle({
  value,
  onSave,
  editTrigger = "click",
  onActivate,
  disabled = false,
  className = "",
  inputClassName = "",
  title: ariaTitle,
}: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  }, [disabled, value]);

  const cancelEditing = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const commitEditing = useCallback(async () => {
    const nextTitle = normalizeConversationTitle(draft);
    setEditing(false);
    if (nextTitle !== value) {
      await onSave(nextTitle);
    }
  }, [draft, onSave, value]);

  const handleDisplayClick = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return;
      if (editTrigger === "click") {
        event.stopPropagation();
        startEditing();
        return;
      }
      onActivate?.();
    },
    [disabled, editTrigger, onActivate, startEditing],
  );

  const handleDisplayDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (disabled || editTrigger !== "doubleClick") return;
      event.stopPropagation();
      startEditing();
    },
    [disabled, editTrigger, startEditing],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void commitEditing();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
      }
    },
    [cancelEditing, commitEditing],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          void commitEditing();
        }}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
        maxLength={120}
        aria-label="Conversation title"
        placeholder={DEFAULT_CONVERSATION_TITLE}
        className={`w-full min-w-0 rounded-md border border-border bg-background px-2 py-0.5 text-foreground outline-none ring-1 ring-transparent focus:ring-accent/40 ${inputClassName}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleDisplayClick}
      onDoubleClick={handleDisplayDoubleClick}
      disabled={disabled}
      title={ariaTitle ?? (editTrigger === "doubleClick" ? "Double-click to rename" : "Click to rename")}
      className={`block w-full min-w-0 truncate text-left cursor-pointer disabled:cursor-default ${className}`}
    >
      {value || DEFAULT_CONVERSATION_TITLE}
    </button>
  );
}
