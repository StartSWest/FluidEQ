import { ACCENT_STYLES } from 'common/graphShapes';
import { getDefaultTuning, normalizeTuning } from 'common/customLooks';
import {
  advanceGraphAccent,
  createAccentState,
  paintGraphAccent,
} from 'renderer/graph/graphAccents';

const marks = ACCENT_STYLES.filter((style) => style !== 'wave');
const makeContext = () => ({
  getTransform: jest.fn(() => ({ a: 1, d: 1 })),
  translate: jest.fn(),
  scale: jest.fn((x: number, y: number) => ({ x, y })),
  globalAlpha: 0.8,
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  quadraticCurveTo: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  createLinearGradient: jest.fn(),
});

describe('peak presentation', () => {
  it.each([0.2, 0.5, 1, -0.2, -0.5, -1])(
    'keeps ripple circles and ring widths round at wave scale %s',
    (scale) => {
      const state = createAccentState();
      const peaks = [{ x: 100, y: 120, size: 8, energy: 0.8 }];
      advanceGraphAccent({
        state,
        peaks,
        heights: [0.8],
        behaviour: 'ripple',
        deltaMs: 0,
      });
      const context = makeContext();
      context.getTransform.mockReturnValue({ a: 2, d: 2 * scale });
      paintGraphAccent({
        context: context as unknown as CanvasRenderingContext2D,
        state,
        peaks,
        heights: [0.8],
        positions: [100],
        behaviour: 'ripple',
        baseline: 400,
        top: 40,
        left: 40,
        right: 300,
        weight: 1,
        paint: '#55aacc',
      });
      expect(context.arc).toHaveBeenCalledTimes(2);
      expect(context.translate).toHaveBeenCalledWith(100, 120);
      context.scale.mock.calls.forEach(([x, y]) => {
        expect(Math.abs(2 * scale * y)).toBeCloseTo(2 * x, 10);
      });
      expect(context.restore.mock.calls.length).toBe(
        context.save.mock.calls.length,
      );
    },
  );

  it.each(marks)(
    '%s supports filled and outlined marks without repainting state',
    (behaviour) => {
      const state = createAccentState();
      const peaks = [{ x: 100, y: 120, size: 8, energy: 0.8 }];
      advanceGraphAccent({
        state,
        peaks,
        heights: [0.8, 0.6],
        behaviour,
        deltaMs: 0,
      });
      advanceGraphAccent({
        state,
        peaks,
        heights: [0.2, 0.1],
        behaviour,
        deltaMs: 240,
      });
      const before = JSON.stringify(state);
      [true, false].forEach((filled) => {
        const context = makeContext();
        paintGraphAccent({
          context: context as unknown as CanvasRenderingContext2D,
          state,
          behaviour,
          peaks,
          heights: [0.2, 0.1],
          positions: [100, 200],
          baseline: 400,
          top: 40,
          left: 40,
          right: 300,
          weight: 1.5,
          filled,
          paint: '#55aacc',
        });
        const fills =
          context.fill.mock.calls.length + context.fillRect.mock.calls.length;
        const strokes =
          context.stroke.mock.calls.length +
          context.strokeRect.mock.calls.length;
        expect(filled ? fills : strokes).toBeGreaterThan(0);
        expect(filled ? 0 : fills).toBe(0);
        expect(context.createLinearGradient).not.toHaveBeenCalled();
        expect(context.restore.mock.calls.length).toBe(
          context.save.mock.calls.length,
        );
        expect(JSON.stringify(state)).toBe(before);
      });
    },
  );

  it('holds a transient briefly before falling, independent of refresh rate', () => {
    const levels = [30, 60, 144].map((hz) => {
      const state = createAccentState();
      advanceGraphAccent({
        state,
        peaks: [],
        heights: [1],
        behaviour: 'fall',
        deltaMs: 0,
      });
      advanceGraphAccent({
        state,
        peaks: [],
        heights: [0],
        behaviour: 'fall',
        deltaMs: 100,
      });
      expect(state.held[0]).toBe(1);
      for (let i = 0; i < hz; i += 1) {
        advanceGraphAccent({
          state,
          peaks: [],
          heights: [0],
          behaviour: 'fall',
          deltaMs: 1000 / hz,
        });
      }
      return state.held[0];
    });
    expect(levels[0]).toBeLessThan(1);
    expect(levels[0]).toBeCloseTo(levels[1], 10);
    expect(levels[0]).toBeCloseTo(levels[2], 10);
  });

  it('retains peak fill and layer independently of the figure through normalization', () => {
    const tuning = normalizeTuning(
      {
        filled: true,
        accentFilled: false,
        accentBehind: true,
        accentStyle: 'live',
      },
      'blocks',
    );
    expect(tuning).toMatchObject({
      filled: true,
      accentFilled: false,
      accentBehind: true,
      accentStyle: 'live',
    });
    expect(
      normalizeTuning(JSON.parse(JSON.stringify(tuning)), 'blocks'),
    ).toEqual(tuning);
    expect(getDefaultTuning('fluid').accentFilled).toBe(false);
    expect(normalizeTuning({}, 'bars').accentBehind).toBe(false);
  });
});
