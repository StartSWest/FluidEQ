import { prefersReducedMotion } from '../utils/bandReveal';

export const LOOK_TRANSITION_MS = 320;

/** Crossfade pixels, not two running visualizers. No readback or second loop. */
export class GraphLookTransition {
  private lookId: string | null = null;

  private snapshot: HTMLCanvasElement | null = null;

  private startedAt = 0;

  reset() {
    if (this.snapshot) {
      // Release the backing store when the fade ends, including at high DPI.
      this.snapshot.width = 0;
      this.snapshot.height = 0;
      this.snapshot = null;
    }
    this.lookId = null;
  }

  /** Call before clearing the live canvas, after any resize. */
  prepare(canvas: HTMLCanvasElement, lookId: string, now: number) {
    if (this.lookId === lookId) {
      return;
    }
    const hadLook = this.lookId !== null;
    this.lookId = lookId;
    if (!hadLook || prefersReducedMotion()) {
      this.reset();
      this.lookId = lookId;
      return;
    }
    const snapshot = this.snapshot ?? document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    const context = snapshot.getContext('2d');
    if (!context) {
      this.reset();
      this.lookId = lookId;
      return;
    }
    // Rapid switching captures the current blend, so it cannot jump back to
    // an older look. This is the only copy, taken once per selection.
    context.drawImage(canvas, 0, 0);
    this.snapshot = snapshot;
    this.startedAt = now;
  }

  /** Call after painting the new look. True keeps the existing loop awake. */
  paint(context: CanvasRenderingContext2D, now: number): boolean {
    if (!this.snapshot) {
      return false;
    }
    const progress = Math.min(
      1,
      Math.max(0, (now - this.startedAt) / LOOK_TRANSITION_MS),
    );
    if (progress === 1) {
      const { lookId } = this;
      this.reset();
      this.lookId = lookId;
      return false;
    }
    const mix = progress * progress * (3 - 2 * progress);
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    // Add premultiplied pixels after scaling the incoming drawing's alpha.
    // Source-over would dim overlapping strokes halfway through the fade.
    context.globalCompositeOperation = 'destination-in';
    context.globalAlpha = mix;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = 1 - mix;
    context.drawImage(this.snapshot, 0, 0);
    context.restore();
    return true;
  }
}
