/** Reveal streamed text at a steady cadence, smoothing bursty network delivery. */
export function createSmoothStreamReveal(onReveal: (displayed: string) => void) {
  let target = "";
  let displayed = "";
  let frameId: number | null = null;
  let lastTime = 0;

  const cancelFrame = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    lastTime = 0;
  };

  const charsThisFrame = (behind: number, dt: number) => {
    if (behind <= 0) return 0;
    if (behind <= 2) return 1;
    const charsPerSec = Math.min(480, 48 + behind * 10);
    return Math.max(1, Math.round(charsPerSec * dt));
  };

  const tick = (time: number) => {
    if (lastTime === 0) lastTime = time;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    const behind = target.length - displayed.length;
    if (behind <= 0) {
      cancelFrame();
      return;
    }

    displayed = target.slice(0, displayed.length + charsThisFrame(behind, dt));
    onReveal(displayed);

    if (displayed.length < target.length) {
      frameId = requestAnimationFrame(tick);
    } else {
      cancelFrame();
    }
  };

  const schedule = () => {
    if (frameId === null) {
      frameId = requestAnimationFrame(tick);
    }
  };

  return {
    push(text: string) {
      target += text;
      schedule();
    },
    flush() {
      cancelFrame();
      displayed = target;
      onReveal(displayed);
    },
    cancel() {
      cancelFrame();
    },
    getTarget() {
      return target;
    },
  };
}
