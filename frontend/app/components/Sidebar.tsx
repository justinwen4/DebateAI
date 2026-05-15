"use client";

interface SidebarProps {
  onNewChat: () => void;
}

export default function Sidebar({ onNewChat }: SidebarProps) {
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

      <div className="flex-1 overflow-y-auto px-3 pt-2">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-[12px] text-muted/70">No conversations yet</p>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border-subtle">
        <p className="text-[11px] text-muted/50 font-mono">v0.1.0</p>
      </div>
    </aside>
  );
}
