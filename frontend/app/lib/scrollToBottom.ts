/** Coalesce scroll-to-bottom to one layout pass per animation frame. */
export function createScrollScheduler(getContainer: () => HTMLElement | null) {
  let frameId: number | null = null;

  return {
    schedule() {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        const el = getContainer();
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
    cancel() {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
  };
}
