"use client";

import { useMemo } from "react";
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
                  onClick={() => onSelectConversation(conversation.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectConversation(conversation.id);
                    }
                  }}
                  className="w-full rounded-lg px-3 py-2 pr-9 text-left cursor-pointer"
                >
                  <EditableTitle
                    value={conversation.title}
                    onSave={(title) => onRenameConversation(conversation.id, title)}
                    onActivate={() => onSelectConversation(conversation.id)}
                    editTrigger="doubleClick"
                    className="text-[13px] font-medium text-foreground hover:text-foreground/80"
                    inputClassName="text-[13px] font-medium"
                  />
                  <p className="mt-0.5 text-[11px] text-muted">{formatRelativeTime(conversation.updated_at)}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${conversation.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conversation.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface hover:text-red-600 cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
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
      </div>
    </aside>
  );
}
