"use client";

import { useMemo } from "react";

interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

interface SidebarProps {
  onNewChat: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  userEmail?: string;
  onSignOut: () => Promise<void>;
  signingOut?: boolean;
}

function formatRelativeTime(isoValue: string) {
  const date = new Date(isoValue);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export default function Sidebar({
  onNewChat,
  conversations,
  activeConversationId,
  onSelectConversation,
  userEmail,
  onSignOut,
  signingOut = false,
}: SidebarProps) {
  const emailLabel = useMemo(() => {
    if (!userEmail) return "Signed in";
    return userEmail;
  }, [userEmail]);

  return (
    <aside className="w-60 shrink-0 border-r border-border-subtle bg-surface flex flex-col h-full">
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center text-background font-semibold text-[11px]">
            D
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-foreground">
            DebateAI
          </span>
        </div>
      </div>

      <div className="px-3 mb-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg border border-border bg-surface text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-2 space-y-1.5">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-[12px] text-muted/70">No conversations yet</p>
          </div>
        ) : (
          conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            return (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                  active
                    ? "border-border bg-surface-hover"
                    : "border-transparent bg-transparent hover:border-border-subtle hover:bg-surface-hover/70"
                }`}
              >
                <p className="truncate text-[13px] font-medium text-foreground">{conversation.title}</p>
                <p className="mt-0.5 text-[11px] text-muted">{formatRelativeTime(conversation.updated_at)}</p>
              </button>
            );
          })
        )}
      </div>

      <div className="px-3 py-3 border-t border-border-subtle space-y-2">
        <p className="text-[12px] text-muted truncate px-1">{emailLabel}</p>
        <button
          onClick={() => {
            void onSignOut();
          }}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] font-medium text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60 transition-colors cursor-pointer"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
