import { createGraphScatter } from 'common/graphShapes';
import { Projected } from 'common/graphStyles';
import { getDefaultTuning, normalizeTuning } from 'common/customLooks';
import {
  advanceGraphAccent,
  createAccentState,
} from 'renderer/graph/graphAccents';

describe('Scatter satellites', () => {
  const points: Projected[] = [
    [0, 20],
    [10, 80],
    [20, 30],
    [30, 90],
  ];

  it('places smaller squares at measured troughs, retaining their band crests', () => {
    const scatter = createGraphScatter(points, 2, 0.5);
    expect(scatter.satellites).toEqual([
      { x: 7.5, y: 80, size: 4.35, crest: 20 },
      { x: 22.5, y: 90, size: 4.35, crest: 30 },
    ]);
    expect(scatter.primary).not.toBe('');
    expect(scatter.secondary).not.toBe('');
    expect(scatter.shape).toBe(scatter.primary + scatter.secondary);
  });

  it('merges flat bands and preserves gap and density controls', () => {
    expect(
      createGraphScatter(
        points.map(([x]) => [x, 20]),
        2,
        0.5,
      ).satellites,
    ).toEqual([]);
    expect(createGraphScatter(points, 4, 0.5).satellites).toEqual([]);
    expect(createGraphScatter(points, 2, 0).satellites[0].size).toBeCloseTo(
      8.7,
    );
  });

  it('persists the new mark and starts Scatter with it enabled', () => {
    const tuning = getDefaultTuning('scatter');
    expect(tuning.accents).toBe(true);
    expect(tuning.accentStyle).toBe('blink');
    expect(
      normalizeTuning(JSON.parse(JSON.stringify(tuning)), 'scatter'),
    ).toEqual(tuning);
  });
});

describe('music-driven blinking', () => {
  it.each([30, 60, 144])(
    'fades consistently at %s Hz and rearms after a musical fall',
    (hz) => {
      const state = createAccentState();
      const frame = (energy: number, deltaMs: number) =>
        advanceGraphAccent({
          state,
          behaviour: 'blink',
          peaks: [{ x: 20, y: 80, size: 4, energy }],
          heights: [energy],
          deltaMs,
        });
      frame(0.8, 0);
      expect(state.blinks.get(20)).toBe(1);
      for (let i = 0; i < hz; i += 1) {
        frame(0.8, 320 / hz);
      }
      expect(state.blinks.get(20)).toBeCloseTo(0.0625, 8);
      frame(0.8, 1000);
      expect(state.blinks.size).toBe(0);
      frame(0.5, 16);
      frame(0.8, 16);
      expect(state.blinks.get(20)).toBe(1);
      expect(state.motes).toHaveLength(0);
      advanceGraphAccent({
        state,
        behaviour: 'bead',
        peaks: [],
        heights: [],
        deltaMs: 0,
      });
      expect(state.blinks.size).toBe(0);
    },
  );
});
