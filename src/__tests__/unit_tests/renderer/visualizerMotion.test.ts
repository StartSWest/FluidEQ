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
import { resolveLookWaveform } from 'renderer/graph/lookPreview';
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
  it('previews a wave against a silent capture and eases back to real silence', () => {
    const live = [
      { x: 20, y: -20 },
      { x: 20000, y: -20 },
    ];
    const preview = [
      { x: 20, y: 20 },
      { x: 20000, y: -10 },
    ];
    const silence = new Array<number>(96).fill(0);
    expect(resolveLookWaveform(live, live, silence)).toBe(silence);
    const target = resolveLookWaveform(preview, live, silence);
    expect(target).toHaveLength(silence.length);
    expect(Math.max(...target)).toBe(1);
    const current: number[] = [];
    const rates = { attackMs: 10, releaseMs: 100 };
    advanceWaveform(current, target, 100, rates);
    const full = Math.max(...current);
    advanceWaveform(
      current,
      resolveLookWaveform(live, live, silence),
      100,
      rates,
    );
    expect(Math.max(...current)).toBeGreaterThan(0);
    expect(Math.max(...current)).toBeLessThan(full);
    expect(resolveLookWaveform(live, live, [0.2, 0.8])).toEqual([0.2, 0.8]);
  });

  it.each(['flames', 'braid', 'bubbles', 'racer', 'invaders'] as const)(
    '%s moves continuously at every refresh rate and freezes on pause',
    (style) => {
      const paths = [30, 60, 144].map((hz) => {
        const args = {
          state: createGraphMotionState(),
          points,
          style,
          columns: 32,
          top: 20,
          bottom: 300,
          playing: true,
          filled: true,
          gap: 0.3,
        };
        const first = createMovingGraphShape({ ...args, deltaMs: 0 });
        let last = first;
        for (let frame = 0; frame < hz; frame += 1) {
          last = createMovingGraphShape({ ...args, deltaMs: 1000 / hz });
        }
        expect(last.path).not.toBe(first.path);
        expect(last.moving).toBe(true);
        expect(last.path).not.toMatch(/NaN|Infinity/);
        expect(
          createMovingGraphShape({ ...args, playing: false, deltaMs: 80 }).path,
        ).toBe(last.path);
        return last.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      });
      expect(paths[0].length).toBeGreaterThan(0);
      paths.slice(1).forEach((path) => {
        expect(path).toHaveLength(paths[0].length);
        path.forEach((value, index) =>
          expect(value).toBeCloseTo(paths[0][index], 2),
        );
      });
    },
  );

  it.each([
    'rain',
    'starfield',
    'flames',
    'braid',
    'bubbles',
    'racer',
    'invaders',
    'echo',
  ] as const)(
    '%s responds to audio, stops scheduling in silence, and handles resized plots',
    (style) => {
      const args = {
        state: createGraphMotionState(),
        points,
        style,
        columns: 8,
        top: 20,
        bottom: 300,
        playing: true,
        filled: false,
      };
      const loud = createMovingGraphShape({ ...args, deltaMs: 0 });
      const quietPoints: Projected[] = points.map(([x]) => [x, 300]);
      let quiet = loud;
      for (let i = 0; i < 10; i += 1) {
        quiet = createMovingGraphShape({
          ...args,
          points: quietPoints,
          deltaMs: 100,
        });
      }
      expect(quiet.moving).toBe(false);
      expect(quiet.path).not.toBe(loud.path);
      const resized = createMovingGraphShape({
        ...args,
        columns: 160,
        top: 80,
        bottom: 500,
        filled: true,
        deltaMs: 16,
      });
      expect(resized.path.length).toBeGreaterThan(0);
      expect(resized.path).not.toMatch(/NaN|Infinity/);
    },
  );

  it.each(['bubbles', 'invaders'] as const)(
    '%s preserves the editable gap during animation',
    (style) => {
      const args = {
        points,
        style,
        columns: 32,
        top: 20,
        bottom: 300,
        playing: true,
        filled: true,
        deltaMs: 30,
      };
      const wide = createMovingGraphShape({
        ...args,
        state: createGraphMotionState(),
        gap: 0,
      });
      const narrow = createMovingGraphShape({
        ...args,
        state: createGraphMotionState(),
        gap: 0.85,
      });
      expect(wide.path).not.toBe(narrow.path);
    },
  );

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
    // The oldest trace still contains the quiet frame while the front is loud.
    expect(first.path).toContain('102.16,233.20');
    expect(first.path).toContain('100.00,30.00');
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
          getTransform: jest.fn(() => ({ a: 1, d: 1 })),
          translate: jest.fn(),
          scale: jest.fn(),
          globalAlpha: 0.5,
          save: jest.fn(),
          restore: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          quadraticCurveTo: jest.fn(),
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
  it('removes retired entries from picker and cycle without breaking saved custom forms', () => {
    expect(GRAPH_FORM_LOOKS).toHaveLength(48);
    expect(SELECTABLE_GRAPH_STYLES).toContain('bars');
    expect(SELECTABLE_GRAPH_STYLES).toContain('blocks');
    (
      [
        'ridge',
        'pillars',
        'wave-ribbon',
        'candles',
        'honeycomb',
        'barcode',
        'caps',
        'crown',
        'weave',
      ] as const
    ).forEach((style) => {
      expect(SELECTABLE_GRAPH_STYLES).not.toContain(style);
      expect(GRAPH_FORM_LOOKS.some((look) => look.style === style)).toBe(false);
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
