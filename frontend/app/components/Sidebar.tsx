"use client";

import { useMemo, useState, useCallback } from "react";
import { LogoWithLabel } from "@/app/components/Logo";
import EditableTitle from "@/app/components/EditableTitle";

export interface ConversationSummary {
  id: string;
  title: string;
  title_locked: boolean;
  updated_at: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void | Promise<void>;
  onDeleteConversation: (conversationId: string) => void;
  userEmail?: string;
  onSignOut: () => Promise<void>;
  signingOut?: boolean;
}

function SidebarPanelIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d={open ? "M9 3v18" : "M9 3v18M15 9l-3 3 3 3"} />
    </svg>
  );
}

export function SidebarToggleButton({
  collapsed,
  onClick,
  className = "",
  label,
}: {
  collapsed: boolean;
  onClick: () => void;
  className?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={!collapsed}
      className={`rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground cursor-pointer ${className}`}
    >
      <SidebarPanelIcon open={!collapsed} />
    </button>
  );
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
  collapsed,
  onToggleCollapsed,
  onNewChat,
  conversations,
  activeConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  userEmail,
  onSignOut,
  signingOut = false,
}: SidebarProps) {
  const emailLabel = useMemo(() => {
    if (!userEmail) return "Signed in";
    return userEmail;
  }, [userEmail]);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, conversationId: string) => {
      e.stopPropagation();
      if (pendingDeleteId === conversationId) {
        onDeleteConversation(conversationId);
        setPendingDeleteId(null);
      } else {
        setPendingDeleteId(conversationId);
      }
    },
    [pendingDeleteId, onDeleteConversation],
  );

  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      setPendingDeleteId(null);
      onSelectConversation(conversationId);
    },
    [onSelectConversation],
  );

  return (
    <aside
      className={`shrink-0 border-r border-border-subtle bg-surface flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-0 border-r-0" : "w-60"
      }`}
      aria-hidden={collapsed}
    >
      <div className="flex w-60 min-w-60 flex-col h-full">
        <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4">
          <LogoWithLabel size={28} labelClassName="font-semibold text-[15px] tracking-tight text-foreground" />
          <SidebarToggleButton
            collapsed={collapsed}
            onClick={onToggleCollapsed}
            label="Collapse sidebar"
          />
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
            const pendingDelete = pendingDeleteId === conversation.id;
            return (
              <div
                key={conversation.id}
                className={`group relative w-full rounded-lg border transition-colors ${
                  active
                    ? "border-border bg-surface-hover"
                    : "border-transparent bg-transparent hover:border-border-subtle hover:bg-surface-hover/70"
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleConversationSelect(conversation.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleConversationSelect(conversation.id);
                    }
                  }}
                  className="w-full rounded-lg px-3 py-2 pr-9 text-left cursor-pointer"
                >
                  <EditableTitle
                    value={conversation.title}
                    onSave={(title) => onRenameConversation(conversation.id, title)}
                    onActivate={() => handleConversationSelect(conversation.id)}
                    editTrigger="doubleClick"
                    className="text-[13px] font-medium text-foreground hover:text-foreground/80"
                    inputClassName="text-[13px] font-medium"
                  />
                  <p className="mt-0.5 text-[11px] text-muted">{formatRelativeTime(conversation.updated_at)}</p>
                </div>
                {/*
                  Mobile: only render the button when this conversation is active,
                  so inactive rows have no invisible tap target that can cause
                  accidental deletes. Desktop: keep the existing hover reveal.
                  Two-tap confirmation prevents fat-finger deletes on all devices.
                */}
                {(active || !("ontouchstart" in globalThis)) && (
                  <button
                    type="button"
                    aria-label={
                      pendingDelete
                        ? `Confirm delete ${conversation.title}`
                        : `Delete ${conversation.title}`
                    }
                    onClick={(e) => handleDeleteClick(e, conversation.id)}
                    onBlur={() => {
                      if (pendingDeleteId === conversation.id) setPendingDeleteId(null);
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition-all cursor-pointer
                      ${pendingDelete
                        ? "opacity-100 bg-red-100 text-red-600 dark:bg-red-900/40"
                        : "text-muted hover:bg-surface hover:text-red-600"
                      }
                      ${active
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none md:pointer-events-auto md:group-hover:opacity-100"
                      }`}
                  >
                    {pendingDelete ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
        </div>

        <div className="px-3 py-3 border-t border-border-subtle space-y-2">
          <a
            href="https://github.com/justinwen4/DebateAI"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
            </svg>
            Star on GitHub
          </a>
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
      </div>
    </aside>
  );
}
