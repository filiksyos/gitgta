const STEP = 1 / 60;
const MAX_FRAME = 0.05;

export function createLoop(
  simulate: (dt: number) => void,
  render: (alpha: number, dt: number) => void,
): { start: () => void; stop: () => void } {
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  let running = false;

  const tick = (now: number): void => {
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    acc += dt;
    while (acc >= STEP) {
      simulate(STEP);
      acc -= STEP;
    }
    render(acc / STEP, dt);
    raf = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
