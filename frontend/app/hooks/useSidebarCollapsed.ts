import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "chat-sidebar-collapsed";

/** Sidebar collapsed state, persisted to localStorage. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  // Read the saved preference after mount (not in a lazy initializer) so the
  // server and first client render agree, avoiding a hydration mismatch.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
