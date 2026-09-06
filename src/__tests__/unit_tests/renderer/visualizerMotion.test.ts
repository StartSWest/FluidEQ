import {
  createGraphMotionState,
  createMovingGraphShape,
} from 'renderer/graph/graphMotion';
import {
  advanceGraphAccent,
  createAccentState,
  paintGraphAccent,
} from 'renderer/graph/graphAccents';
import { advanceSpectrumBars, advanceWaveform } from 'renderer/waveformPaint';
import { createGraphShape } from 'common/graphShapes';
import {
  canonicalGraphStyle,
  GRAPH_FORM_LOOKS,
  GRAPH_STYLES,
  SELECTABLE_GRAPH_STYLES,
  getGraphBallistics,
  nextGraphStyle,
  Projected,
} from 'common/graphStyles';

const points: Projected[] = Array.from({ length: 64 }, (_, i) => [
  40 + i * 8,
  100 + Math.sin(i) * 25,
]);

describe('visualizer timing', () => {
  it.each(['rain', 'starfield'] as const)(
    '%s travels at the same speed at 30, 60 and 144 Hz and freezes while paused',
    (style) => {
      const runs = [30, 60, 144].map((hz) => {
        const state = createGraphMotionState();
        const args = {
          state,
          points,
          style,
          columns: 32,
          top: 20,
          bottom: 300,
          playing: true,
          filled: false,
        };
        let result = createMovingGraphShape({ ...args, deltaMs: 0 });
        const initial = result.path;
        for (let frame = 0; frame < hz; frame += 1) {
          result = createMovingGraphShape({ ...args, deltaMs: 1000 / hz });
        }
        expect(result.path).not.toBe(initial);
        expect(result.moving).toBe(true);
        expect(
          createMovingGraphShape({ ...args, playing: false, deltaMs: 1000 })
            .path,
        ).toBe(result.path);
        return state.travel;
      });
      runs[0].forEach((value, i) => {
        expect(runs[1][i]).toBeCloseTo(value, 10);
        expect(runs[2][i]).toBeCloseTo(value, 10);
      });
    },
  );

  it('echo retains earlier audio and eventually settles with bounded history', () => {
    const state = createGraphMotionState();
    const args = {
      state,
      style: 'echo' as const,
      columns: 32,
      top: 20,
      bottom: 300,
      playing: true,
      filled: false,
    };
    const low: Projected[] = [
      [40, 290],
      [100, 280],
      [200, 290],
    ];
    const high: Projected[] = [
      [40, 90],
      [100, 30],
      [200, 90],
    ];
    createMovingGraphShape({ ...args, points: low, deltaMs: 0 });
    const first = createMovingGraphShape({
      ...args,
      points: high,
      deltaMs: 33,
    });
    expect(first.path).toContain('100.00,284.80');
    let last = first;
    for (let i = 0; i < 400; i += 1) {
      last = createMovingGraphShape({
        ...args,
        points: high,
        deltaMs: 1000 / 144,
      });
    }
    expect(last.path).not.toBe(first.path);
    expect(last.moving).toBe(false);
    expect(state.history.length).toBeLessThanOrEqual(256);
  });

  it('waveform smoothing initializes the buffer and respects Edit rates', () => {
    const fast: number[] = [];
    const slow: number[] = [];
    advanceWaveform(fast, [0.2, 0.8], 20, { attackMs: 5, releaseMs: 90 });
    advanceWaveform(slow, [0.2, 0.8], 20, { attackMs: 60, releaseMs: 90 });
    expect(fast).toHaveLength(2);
    expect(fast[1]).toBeGreaterThan(slow[1]);
    expect(slow[1]).toBeGreaterThan(0);
  });

  it('Fluid reads silence as zero and full scale as one, with editable release', () => {
    const bars = [0, 0];
    advanceSpectrumBars(
      bars,
      [{ y: -20 }, { y: 20 }],
      -20,
      100,
      { attackMs: 4, releaseMs: 100 },
      40,
    );
    expect(bars[0]).toBe(0);
    expect(bars[1]).toBeGreaterThan(0.99);
    const slower = bars.slice();
    advanceSpectrumBars(
      bars,
      [{ y: -20 }, { y: -20 }],
      -20,
      50,
      { attackMs: 4, releaseMs: 50 },
      40,
    );
    advanceSpectrumBars(
      slower,
      [{ y: -20 }, { y: -20 }],
      -20,
      50,
      { attackMs: 4, releaseMs: 200 },
      40,
    );
    expect(slower[1]).toBeGreaterThan(bars[1]);
  });
});

describe('peak animation', () => {
  it.each(['ripple', 'sparks', 'drip'] as const)(
    '%s emits on a rise, not each frame or each mirror paint',
    (behaviour) => {
      const results = [30, 144].map((hz) => {
        const state = createAccentState();
        const args = {
          state,
          behaviour,
          heights: [0.8],
          peaks: [{ x: 60, y: 30, size: 4, energy: 0.8 }],
        };
        advanceGraphAccent({ ...args, deltaMs: 0 });
        for (let i = 0; i < hz / 2; i += 1) {
          advanceGraphAccent({ ...args, deltaMs: 1000 / hz });
        }
        expect(state.motes).toHaveLength(1);
        const context = {
          globalAlpha: 0.5,
          save: jest.fn(),
          restore: jest.fn(),
          beginPath: jest.fn(),
          arc: jest.fn(),
          stroke: jest.fn(),
          fill: jest.fn(),
        } as unknown as CanvasRenderingContext2D;
        const before = JSON.stringify(state.motes);
        const paint = {
          ...args,
          context,
          positions: [60],
          baseline: 300,
          left: 40,
          right: 200,
          weight: 1,
          paint: '#ffffff',
        };
        paintGraphAccent(paint);
        paintGraphAccent(paint);
        expect(JSON.stringify(state.motes)).toBe(before);
        return state.motes[0];
      });
      expect(results[0].life).toBeCloseTo(results[1].life, 10);
      expect(results[0].y).toBeCloseTo(results[1].y, 10);
    },
  );

  it('keeps drawing a falling hold and ghost after the spectrum stops moving', () => {
    (['fall', 'ghost'] as const).forEach((behaviour) => {
      const state = createAccentState();
      advanceGraphAccent({
        state,
        behaviour,
        heights: [1],
        peaks: [],
        deltaMs: 0,
      });
      expect(
        advanceGraphAccent({
          state,
          behaviour,
          heights: [0],
          peaks: [],
          deltaMs: 33,
        }),
      ).toBe(true);
    });
  });
});

describe('curated forms and settings', () => {
  it('removes duplicates from both picker and cycle without breaking old custom forms', () => {
    expect(GRAPH_FORM_LOOKS).toHaveLength(54);
    expect(SELECTABLE_GRAPH_STYLES).not.toEqual(
      expect.arrayContaining(['ridge', 'pillars', 'wave-ribbon']),
    );
    (['ridge', 'pillars', 'wave-ribbon'] as const).forEach((style) => {
      expect(createGraphShape(points, style, 300)).not.toBe('');
      expect(nextGraphStyle(style)).toBe(
        nextGraphStyle(canonicalGraphStyle(style)),
      );
    });
  });

  it('keeps the formerly frantic forms readable between audio frames', () => {
    (['ecg', 'slope', 'spikes', 'starfield', 'wave-line'] as const).forEach(
      (style) => {
        expect(getGraphBallistics(style).releaseMs).toBeGreaterThanOrEqual(90);
        expect(getGraphBallistics(style).attackMs).toBeLessThan(
          getGraphBallistics(style).releaseMs,
        );
      },
    );
  });

  it.each(GRAPH_STYLES)(
    '%s handles both drawing modes and the full Pieces/Gap range',
    (style) => {
      [8, 64, 160].forEach((columns) => {
        [0, 0.85].forEach((gap) => {
          [false, true].forEach((filled) => {
            const path = createGraphShape(
              points,
              style,
              300,
              columns,
              [0.2, 0.6, 0.3],
              gap,
              20,
              filled,
            );
            expect(path.length).toBeGreaterThan(0);
            expect(path).not.toMatch(/NaN|Infinity/);
          });
        });
      });
    },
  );
});
