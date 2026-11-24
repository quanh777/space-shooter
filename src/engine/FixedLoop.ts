import { FIXED_DT, MAX_FRAME_DT } from '../config/constants';

export class FixedLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  private fpsFrames = 0;
  private fpsTimer = 0;
  public currentFps = 60;

  constructor(
    private readonly onFixedUpdate: (dt: number) => void,
    private readonly onRender: (alpha: number, frameDt: number) => void,
    private readonly onVisibilityPause?: () => void
  ) {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.accumulator = 0;
      this.onVisibilityPause?.();
    } else {
      this.lastTime = performance.now();
    }
  };

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const rawDt = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const frameDt = Math.min(rawDt, MAX_FRAME_DT);

    this.fpsFrames++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }

    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 4) {
      this.onFixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === 4) {
      this.accumulator = 0;
    }

    const alpha = this.accumulator / FIXED_DT;
    this.onRender(alpha, frameDt);
  };
}
