import createGraphSawtooth from 'common/graphSawtooth';
import { isGraphScene } from 'common/graphScenes';
import { getDefaultTuning } from 'common/customLooks';
import type { Projected } from 'common/graphStyles';
import {
  advanceSawtoothScope,
  createSawtoothScope,
  createSparkPath,
  FLARE_LIFE,
  GHOST_EVERY,
  GHOST_LIFE,
  ghostGlow,
  sawtoothFlare,
  SPARK_LIFE,
} from 'renderer/graph/sawtoothScope';

const quiet: Projected[] = [
  [20, 160],
  [60, 160],
  [100, 160],
];
const loud: Projected[] = [
  [20, 80],
  [60, 60],
  [100, 90],
];

describe('the sawtooth wave', () => {
  it('runs as a scene and slides its drop leftwards on the clock', () => {
    expect(isGraphScene('sawtooth')).toBe(true);
    const at = (seconds: number) => {
      const { shape } = createGraphSawtooth(loud, 160, seconds);
      // The drop is the only vertical edge: two points sharing an x.
      const match = shape.match(/L (\d+\.\d),60\.0 L \1,160\.0/);
      if (!match) {
        throw new Error(`no drop in ${shape}`);
      }
      return Number(match[1]);
    };
    const first = at(0.1);
    const later = at(0.3);
    expect(later).toBeLessThan(first);
  });

  it('draws the beam as one open line and never breaks it for the gap', () => {
    const { trace } = createGraphSawtooth(loud, 160, 0.2);
    expect(trace.match(/M /g)).toHaveLength(1);
    expect(trace).not.toMatch(/NaN|Infinity/);
    expect(createGraphSawtooth([loud[0]], 160, 0)).toEqual({
      shape: '',
      trace: '',
    });
  });

  it('keeps a dim body under the beam', () => {
    expect(getDefaultTuning('sawtooth').fillOpacity).toBe(0.28);
  });
});

describe('the scope', () => {
  const fakePath = () => ({ arc: jest.fn(), moveTo: jest.fn() });
  beforeAll(() => {
    Object.assign(globalThis, { Path2D: jest.fn(fakePath) });
  });
  afterAll(() => {
    Object.assign(globalThis, { Path2D: undefined });
  });
  const beam = () => new Path2D();

  it('flares and throws sparks on a beat, on the clock, once', () => {
    const scope = createSawtoothScope();
    advanceSawtoothScope(scope, beam(), quiet, 20, 160, 1, true);
    expect(sawtoothFlare(scope, 1)).toBe(0);
    advanceSawtoothScope(scope, beam(), loud, 20, 160, 1.1, true);
    expect(sawtoothFlare(scope, 1.1)).toBe(1);
    expect(sawtoothFlare(scope, 1.1 + FLARE_LIFE / 2)).toBeCloseTo(0.5);
    expect(sawtoothFlare(scope, 1.1 + FLARE_LIFE + 0.01)).toBe(0);
    // Three sparks per loud tooth, all three teeth loud.
    expect(scope.sparks).toHaveLength(9);
    // Holding the level is not another beat.
    advanceSawtoothScope(scope, beam(), loud, 20, 160, 1.15, true);
    expect(scope.sparks).toHaveLength(9);
    expect(scope.flareAt).toBe(1.1);
  });

  it('lets the sparks fall and die, and draws none once they are gone', () => {
    const scope = createSawtoothScope();
    advanceSawtoothScope(scope, beam(), quiet, 20, 160, 1, true);
    advanceSawtoothScope(scope, beam(), loud, 20, 160, 1.1, true);
    const live = createSparkPath(scope, 1.2, 160, 20) as unknown as ReturnType<
      typeof fakePath
    >;
    expect(live.arc).toHaveBeenCalledTimes(9);
    advanceSawtoothScope(
      scope,
      beam(),
      loud,
      20,
      160,
      1.1 + SPARK_LIFE + 0.01,
      true,
    );
    expect(scope.sparks).toEqual([]);
  });

  it('keeps ghosts spaced out on the clock and fades them over their life', () => {
    const scope = createSawtoothScope();
    advanceSawtoothScope(scope, beam(), loud, 20, 160, 1, true);
    advanceSawtoothScope(scope, beam(), loud, 20, 160, 1.01, true);
    expect(scope.ghosts).toHaveLength(1);
    advanceSawtoothScope(scope, beam(), loud, 20, 160, 1 + GHOST_EVERY, true);
    expect(scope.ghosts).toHaveLength(2);
    expect(ghostGlow(scope.ghosts[1], 1 + GHOST_LIFE / 2)).toBeCloseTo(0.5);
    advanceSawtoothScope(
      scope,
      beam(),
      loud,
      20,
      160,
      1 + GHOST_LIFE + 0.01,
      true,
    );
    expect(scope.ghosts).toHaveLength(2);
    expect(scope.ghosts.every((ghost) => ghost.at > 1)).toBe(true);
  });

  it('decides nothing while paused', () => {
    const scope = createSawtoothScope();
    advanceSawtoothScope(scope, beam(), loud, 20, 160, 1, false);
    expect(scope.ghosts).toEqual([]);
    expect(scope.sparks).toEqual([]);
    expect(sawtoothFlare(scope, 1)).toBe(0);
  });
});
