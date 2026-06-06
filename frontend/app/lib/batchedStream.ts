/** Coalesce rapid stream chunks to one React update per animation frame. */
export function createFrameBatcher(onFlush: () => void) {
  let frameId: number | null = null;

  const cancel = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  return {
    schedule() {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        onFlush();
      });
    },
    flush() {
      cancel();
      onFlush();
    },
    cancel,
  };
}
