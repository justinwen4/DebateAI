"use client";

interface SidebarProps {
  onNewChat: () => void;
}

export default function Sidebar({ onNewChat }: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col h-full">
      <div className="px-4 py-4 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white font-semibold text-xs">
          D
        </div>
        <span className="font-semibold text-sm tracking-tight text-foreground">DebateAI</span>
      </div>

      <div className="px-3 mb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-2">
        <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-muted">
          History
        </p>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted">v0.1.0</p>
      </div>
    </aside>
  );
}
