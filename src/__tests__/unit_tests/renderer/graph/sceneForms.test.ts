import {
  canonicalGraphStyle,
  GRAPH_STYLE_LABELS,
  resolveGraphPalette,
  SELECTABLE_GRAPH_STYLES,
} from 'common/graphStyles';
import type { Projected } from 'common/graphStyles';
import {
  advanceStoneArcade,
  ARCH_HALF_LIFE_MS,
  createStoneArcade,
  createStoneArcadePaths,
  riverTop,
} from 'renderer/graph/stoneArcade';
import {
  advanceBonfire,
  createBonfire,
  createBonfirePaths,
} from 'renderer/graph/bonfire';
import {
  advanceRainstorm,
  createRainstorm,
  createRainstormPaths,
  SHAKE_LIFE,
  stormShake,
  waterTop,
} from 'renderer/graph/rainstorm';
import {
  advanceCountryFence,
  createCountryFence,
  createCountryFencePaths,
  GROUND,
  TREES,
} from 'renderer/graph/countryFence';

const columns: Projected[] = Array.from({ length: 12 }, (_, i) => [
  20 + i * 20,
  i % 4 === 0 ? 60 : 140,
]);
const quiet: Projected[] = columns.map(([x]) => [x, 160]);

const fakePath = () => ({
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  ellipse: jest.fn(),
  rect: jest.fn(),
  quadraticCurveTo: jest.fn(),
  closePath: jest.fn(),
  addPath: jest.fn(),
});
beforeAll(() => {
  Object.assign(globalThis, { Path2D: jest.fn(fakePath) });
});
afterAll(() => {
  Object.assign(globalThis, { Path2D: undefined });
});

describe('the picker after the review', () => {
  it('retires Warp speed to the line and keeps the scenes on their own ramps', () => {
    expect(canonicalGraphStyle('starfield')).toBe('line');
    expect(SELECTABLE_GRAPH_STYLES).not.toContain('starfield');
    expect(canonicalGraphStyle('stalactites')).toBe('area');
    expect(SELECTABLE_GRAPH_STYLES).not.toContain('stalactites');
    expect(canonicalGraphStyle('racer')).toBe('area');
    expect(SELECTABLE_GRAPH_STYLES).not.toContain('racer');
    expect(canonicalGraphStyle('rain')).toBe('area');
    expect(SELECTABLE_GRAPH_STYLES).not.toContain('rain');
    expect(SELECTABLE_GRAPH_STYLES).toContain('arches');
    expect(GRAPH_STYLE_LABELS.flames).toBe('Dancing flames');
    expect(resolveGraphPalette('arches', 'auto')).toBe('level');
    expect(resolveGraphPalette('flames', 'auto')).toBe('level');
    expect(resolveGraphPalette('rain', 'auto')).toBe('level');
    expect(resolveGraphPalette('fence', 'auto')).toBe('level');
  });
});

describe('the aqueduct', () => {
  const run = (
    state: ReturnType<typeof createStoneArcade>,
    live: readonly Projected[],
    seconds: number,
    playing = true,
  ) => advanceStoneArcade(state, columns, live, 20, 160, seconds, playing);

  it('eases the arches up from the water on their own half-life', () => {
    const state = createStoneArcade();
    const water = riverTop(20, 160);
    expect(water).toBeCloseTo(160 - 140 * 0.14);
    // A loud column's arch rises toward its level, halfway after one
    // half-life, and a column at the floor stays a stub.
    // The rise follows the eased trace, not the live frame: start from a
    // quiet trace, then hand it the loud one for one half-life.
    advanceStoneArcade(state, quiet, quiet, 20, 160, 0, true);
    expect(state.rise[0]).toBeLessThan(1);
    advanceStoneArcade(
      state,
      columns,
      columns,
      20,
      160,
      ARCH_HALF_LIFE_MS / 1000,
      true,
    );
    const target = (water - 60) * 0.92;
    expect(state.rise[0]).toBeGreaterThan(0);
    expect(state.rise[0]).toBeLessThan(target);
    expect(state.rise[1]).toBeLessThan(1);
  });

  it('flares a lantern when its own band hits, and holds while paused', () => {
    const state = createStoneArcade();
    run(state, quiet, 0);
    const hit: Projected[] = columns.map(([x], i) => [x, i === 5 ? 40 : 160]);
    run(state, hit, 0.02);
    expect(state.flareAt[5]).toBe(0.02);
    expect(state.flareAt[4]).toBe(-1);
    const rise = [...state.rise];
    run(state, columns, 5, false);
    expect(state.rise).toEqual(rise);
    const paths = createStoneArcadePaths(state, columns, 20, 160, 0.02, 140);
    expect(paths.water).toBe(riverTop(20, 160));
    expect(paths.embers).toHaveLength(3);
  });
});

describe('the fire', () => {
  const run = (
    state: ReturnType<typeof createBonfire>,
    live: readonly Projected[],
    seconds: number,
    playing = true,
  ) => advanceBonfire(state, columns, live, 20, 160, seconds, playing);

  it('keeps the tongues under four fifths of the plot and throws sparks on the beat', () => {
    const state = createBonfire();
    run(state, quiet, 0);
    // Reach is bent: a column at full level gets 80% of the depth, and a
    // column at 60 on a 20..160 plot is under that.
    state.reach.forEach((reach) => {
      expect(reach).toBeLessThanOrEqual(140 * 0.8);
    });
    expect(state.sparks).toHaveLength(0);
    run(state, columns, 0.02);
    expect(state.sparks.length).toBeGreaterThan(0);
    expect(state.thump).toBe(1);
    // Sparks come off burning tongues only: every one sits above the floor.
    state.sparks.forEach((spark) => {
      expect(spark.y).toBeLessThan(160);
    });
  });

  it('puffs smoke on the clock while the fire is up and freezes while paused', () => {
    const state = createBonfire();
    run(state, columns, 0);
    for (let t = 0.05; t < 1.2; t += 0.05) {
      run(state, columns, t);
    }
    expect(state.puffs.length).toBeGreaterThanOrEqual(3);
    const puffs = state.puffs.map((puff) => puff.y);
    run(state, columns, 3, false);
    expect(state.puffs.map((puff) => puff.y)).toEqual(puffs);
    const paths = createBonfirePaths(state, columns, 20, 160, 1.2, 140);
    expect(paths.smoke).toHaveLength(2);
    expect(paths.sparks).toHaveLength(3);
  });
});

describe('the storm', () => {
  const run = (
    state: ReturnType<typeof createRainstorm>,
    live: readonly Projected[],
    seconds: number,
    playing = true,
  ) => advanceRainstorm(state, columns, live, 20, 160, seconds, playing);

  it('hangs the cloud lower where the band is loud and rains out of it', () => {
    const state = createRainstorm();
    run(state, columns, 0);
    expect(state.hang[0]).toBeGreaterThan(state.hang[1]);
    expect(state.drops).toHaveLength(columns.length * 4);
    expect(waterTop(20, 160)).toBeCloseTo(160 - 14);
    for (let t = 0.05; t < 2; t += 0.05) {
      run(state, columns, t);
    }
    // Drops off the loud columns have landed and rung the water.
    expect(state.rings.length).toBeGreaterThan(0);
    state.rings.forEach((ring) => {
      expect(ring.y).toBeGreaterThanOrEqual(waterTop(20, 160));
    });
  });

  it('strikes lightning on a big hit, flashes and shakes, then lets it go', () => {
    const state = createRainstorm();
    run(state, quiet, 0);
    const hit: Projected[] = columns.map(([x], i) => [x, i < 8 ? 30 : 160]);
    run(state, hit, 0.02);
    expect(state.bolt).toBeDefined();
    expect(state.flash).toBe(1);
    const shake = stormShake(state, 0.03);
    expect(Math.abs(shake.x) + Math.abs(shake.y)).toBeGreaterThan(0);
    expect(stormShake(state, 0.02 + SHAKE_LIFE)).toEqual({ x: 0, y: 0 });
    const struck = createRainstormPaths(state, columns, 20, 160, 0.05, 140);
    expect(struck.boltLife).toBeGreaterThan(0);
    // The flash fades over a few frames on the clock, and the bolt is let
    // go once its life is up.
    for (let t = 0.05; t < 1; t += 0.03) {
      run(state, hit, t);
    }
    expect(state.bolt).toBeUndefined();
    expect(state.flash).toBeLessThan(0.05);
  });
});

describe('the countryside', () => {
  const run = (
    state: ReturnType<typeof createCountryFence>,
    live: readonly Projected[],
    seconds: number,
    playing = true,
  ) => advanceCountryFence(state, columns, live, 20, 160, seconds, playing);

  it('keeps a picket in every band and leans the wind on the bass', () => {
    const state = createCountryFence();
    run(state, quiet, 0);
    // A silent band still has a short picket: a fence with gaps is broken.
    state.rise.forEach((rise) => {
      expect(rise).toBeGreaterThanOrEqual(140 * 0.08 - 1);
    });
    const still = state.wind;
    const kick: Projected[] = columns.map(([x], i) => [x, i < 4 ? 30 : 160]);
    for (let t = 0.05; t < 0.6; t += 0.05) {
      run(state, kick, t);
    }
    expect(state.wind).toBeGreaterThan(still);
  });

  it('lights fireflies on a treble crack and builds the scene past the ends', () => {
    const state = createCountryFence();
    run(state, quiet, 0);
    const hat: Projected[] = columns.map(([x], i) => [x, i >= 8 ? 40 : 160]);
    run(state, hat, 0.02);
    expect(state.fireflies.length).toBeGreaterThan(0);
    state.fireflies.forEach((fly) => {
      expect(fly.y).toBeGreaterThan(160 - 140 * GROUND - 1);
    });
    const paths = createCountryFencePaths(state, columns, 20, 160, 0.02, 140);
    expect(paths.ground).toBeCloseTo(160 - 140 * GROUND);
    expect(paths.skyFrom).toBeLessThan(20);
    expect(paths.skyTo).toBeGreaterThan(240);
    const trunks = paths.trunks as unknown as { closePath: jest.Mock };
    expect(trunks.closePath).toHaveBeenCalledTimes(TREES);
    expect(paths.fireflies).toHaveLength(2);
  });
});
