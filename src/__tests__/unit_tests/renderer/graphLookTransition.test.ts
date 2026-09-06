import {
  GraphLookTransition,
  LOOK_TRANSITION_MS,
} from 'renderer/graph/graphLookTransition';
import { prefersReducedMotion } from 'renderer/utils/bandReveal';

jest.mock('renderer/utils/bandReveal', () => ({
  prefersReducedMotion: jest.fn(() => false),
}));

describe('visualizer crossfade', () => {
  const capture = jest.fn();
  let canvas: HTMLCanvasElement;
  let transition: GraphLookTransition;
  const blends: { operation: string; alpha: number; source?: unknown }[] = [];
  let context: CanvasRenderingContext2D;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(prefersReducedMotion).mockReturnValue(false);
    canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 900;
    transition = new GraphLookTransition();
    blends.length = 0;
    context = {
      canvas,
      save: jest.fn(),
      restore: jest.fn(),
      setTransform: jest.fn(),
      fillRect: jest.fn(() => {
        blends.push({
          operation: context.globalCompositeOperation,
          alpha: context.globalAlpha,
        });
      }),
      drawImage: jest.fn((source: unknown) => {
        blends.push({
          operation: context.globalCompositeOperation,
          alpha: context.globalAlpha,
          source,
        });
      }),
    } as unknown as CanvasRenderingContext2D;
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: capture,
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => jest.restoreAllMocks());

  it('allocates nothing on arrival or steady frames, including edits to the same look', () => {
    transition.prepare(canvas, 'bars', 0);
    transition.prepare(canvas, 'bars', 1000);
    expect(transition.paint(context, 1000)).toBe(false);
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
    expect(context.drawImage).not.toHaveBeenCalled();
  });

  it('holds the outgoing picture on the first frame and blends without dimming overlaps', () => {
    transition.prepare(canvas, 'bars', 0);
    transition.prepare(canvas, 'flames', 100);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(canvas, 0, 0);
    expect(transition.paint(context, 100)).toBe(true);
    expect(blends[0]).toEqual({ operation: 'destination-in', alpha: 0 });
    expect(blends[1]).toMatchObject({ operation: 'lighter', alpha: 1 });
    blends.length = 0;
    expect(transition.paint(context, 100 + LOOK_TRANSITION_MS / 2)).toBe(true);
    expect(blends[0]).toEqual({ operation: 'destination-in', alpha: 0.5 });
    expect(blends[1]).toMatchObject({ operation: 'lighter', alpha: 0.5 });
    expect(context.save).toHaveBeenCalledTimes(2);
    expect(context.restore).toHaveBeenCalledTimes(2);
  });

  it.each([30, 60, 144])(
    'finishes at the same deadline at %i Hz and releases its bitmap',
    (hz) => {
      transition.prepare(canvas, 'bars', 0);
      transition.prepare(canvas, 'flames', 100);
      transition.paint(context, 100);
      const snapshot = blends[1].source as HTMLCanvasElement;
      expect([snapshot.width, snapshot.height]).toEqual([1600, 900]);
      for (let time = 1000 / hz; time < LOOK_TRANSITION_MS; time += 1000 / hz) {
        expect(transition.paint(context, 100 + time)).toBe(true);
      }
      expect(transition.paint(context, 100 + LOOK_TRANSITION_MS)).toBe(false);
      expect([snapshot.width, snapshot.height]).toEqual([0, 0]);
      const calls = blends.length;
      transition.prepare(canvas, 'flames', 1000);
      expect(transition.paint(context, 1000)).toBe(false);
      expect(blends).toHaveLength(calls);
      expect(capture).toHaveBeenCalledTimes(1);
    },
  );

  it('reuses one bitmap on rapid switches and captures the currently displayed blend', () => {
    transition.prepare(canvas, 'bars', 0);
    transition.prepare(canvas, 'flames', 100);
    transition.paint(context, 200);
    const first = blends[1].source;
    transition.prepare(canvas, 'braid', 200);
    transition.paint(context, 200);
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenLastCalledWith(canvas, 0, 0);
    expect(blends[3].source).toBe(first);
    expect(blends[3].alpha).toBe(1);
    expect(transition.paint(context, 100 + LOOK_TRANSITION_MS)).toBe(true);
    expect(transition.paint(context, 200 + LOOK_TRANSITION_MS)).toBe(false);
  });

  it('discards a stale bitmap when resizing or detaching the live canvas', () => {
    transition.prepare(canvas, 'bars', 0);
    transition.prepare(canvas, 'flames', 100);
    transition.paint(context, 100);
    const snapshot = blends[1].source as HTMLCanvasElement;
    transition.reset();
    canvas.width = 800;
    transition.prepare(canvas, 'flames', 200);
    expect(transition.paint(context, 200)).toBe(false);
    expect(snapshot.width).toBe(0);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('switches directly when reduced motion is requested', () => {
    transition.prepare(canvas, 'bars', 0);
    jest.mocked(prefersReducedMotion).mockReturnValue(true);
    transition.prepare(canvas, 'flames', 100);
    expect(transition.paint(context, 100)).toBe(false);
    expect(capture).not.toHaveBeenCalled();
  });
});
