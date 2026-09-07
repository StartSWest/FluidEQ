import createGraphStalactites, {
  stalactiteProfiles,
} from 'common/graphStalactites';
import {
  canGraphFill,
  isFilledGraphStyle,
  resolveGraphPalette,
} from 'common/graphStyles';
import type { Projected } from 'common/graphStyles';
import {
  advanceCaveDrips,
  CAVE_ROCK_COLOURS,
  createCaveDrips,
  createCaveDripsPaths,
  POOL_DEPTH,
} from 'renderer/graph/caveDrips';

const columns: Projected[] = Array.from({ length: 12 }, (_, i) => [
  20 + i * 20,
  i % 4 === 0 ? 60 : 140,
]);
const quiet: Projected[] = columns.map(([x]) => [x, 160]);

describe('the rock', () => {
  it('is filled by default, in limestone under auto', () => {
    expect(isFilledGraphStyle('stalactites')).toBe(true);
    expect(canGraphFill('stalactites')).toBe(true);
    expect(resolveGraphPalette('stalactites', 'auto')).toBe('level');
    expect(CAVE_ROCK_COLOURS).toHaveLength(3);
  });

  it('hangs a stable, knobby pendant from every column with any length', () => {
    const profiles = stalactiteProfiles(columns, 160, 20, 0.08);
    expect(profiles).toHaveLength(columns.length);
    expect(stalactiteProfiles(columns, 160, 20, 0.08)).toEqual(profiles);
    expect(stalactiteProfiles(quiet, 160, 20, 0.08)).toHaveLength(0);
    const [first] = profiles;
    // A column at 60 on a 20..160 plot hangs 100px: its tip is at 120.
    expect(first.tip[1]).toBe(120);
    expect(first.outline[0][1]).toBe(20);
    // Calcite builds in bands: the flank swells and narrows on the way
    // down rather than tapering in a straight line.
    const halves = first.outline
      .slice(0, 12)
      .map(([x], i) => first.outline[23 - i][0] - x);
    const widening = halves.some((h, i) => i > 0 && h > halves[i - 1]);
    expect(widening).toBe(true);
    expect(halves[11]).toBe(0);
  });

  it('still answers the picker with closed path strings', () => {
    const layers = createGraphStalactites(columns, 160, 20, 0.08);
    expect(layers.shape.match(/Z/g)).toHaveLength(columns.length);
    expect(layers.shape).not.toMatch(/NaN|Infinity/);
    // The wet highlight stops short of the tip, where the bead sits.
    const rows = (path: string) =>
      [...path.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...rows(layers.shape))).toBe(120);
    expect(Math.max(...rows(layers.light))).toBeLessThan(120);
  });
});

describe('the drips', () => {
  const fakePath = () => ({
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    ellipse: jest.fn(),
    rect: jest.fn(),
    closePath: jest.fn(),
  });
  beforeAll(() => {
    Object.assign(globalThis, { Path2D: jest.fn(fakePath) });
  });
  afterAll(() => {
    Object.assign(globalThis, { Path2D: undefined });
  });

  const run = (
    state: ReturnType<typeof createCaveDrips>,
    live: readonly Projected[],
    seconds: number,
    playing = true,
  ) =>
    advanceCaveDrips(
      state,
      columns,
      live,
      20,
      160,
      seconds,
      playing,
      0.08,
      140,
    );

  it('keeps the tips above the pool', () => {
    const state = createCaveDrips();
    run(state, columns, 0);
    expect(state.poolTop).toBeCloseTo(160 - 140 * POOL_DEPTH);
    state.profiles.forEach((profile) => {
      expect(profile.tip[1]).toBeLessThan(state.poolTop);
    });
  });

  it('grows a bead on every tip and lets it fall when it is heavy', () => {
    const state = createCaveDrips();
    run(state, columns, 0);
    expect(state.drips).toHaveLength(0);
    // Loud bands grow beads faster; a few seconds of steady sound and the
    // first ones let go on their own.
    for (let t = 0.05; t < 3; t += 0.05) {
      run(state, columns, t);
    }
    expect(state.drips.length + state.ripples.length).toBeGreaterThan(0);
  });

  it('shakes a grown bead loose on a hit in its band', () => {
    const state = createCaveDrips();
    run(state, columns, 0);
    state.hangs = state.hangs.map(() => 0.5);
    state.levels = columns.map(() => 0);
    // The live frame jumps on the first column only. (The columns at the
    // floor have no stalactite, so nothing there to shake.)
    const hit: Projected[] = columns.map(([x], i) => [x, i === 0 ? 40 : 160]);
    run(state, hit, 0.02);
    expect(state.drips).toHaveLength(1);
    expect(state.drips[0].x).toBeCloseTo(state.profiles[0].tip[0]);
  });

  it('turns a landing into a ripple that ages out, and idles while paused', () => {
    const state = createCaveDrips();
    run(state, columns, 0);
    state.drips.push({
      x: 100,
      y: state.poolTop - 1,
      vy: 400,
      radius: 2,
      landing: state.poolTop + 2,
    });
    run(state, columns, 0.05);
    expect(state.drips).toHaveLength(0);
    expect(state.ripples).toHaveLength(1);
    expect(state.ripples[0].x).toBe(100);
    run(state, columns, 0.05 + 2, false);
    // Paused: nothing ages, so the ripple is still there.
    expect(state.ripples).toHaveLength(1);
    run(state, columns, 0.05 + 2.1, true);
    expect(state.ripples).toHaveLength(0);
  });

  it('builds the scene past both ends of the plot', () => {
    const state = createCaveDrips();
    run(state, columns, 0);
    const paths = createCaveDripsPaths(state, columns, 20, 160, 0, 140);
    const pool = paths.pool as unknown as { rect: jest.Mock };
    const [x, , width] = pool.rect.mock.calls[0];
    expect(x).toBeLessThan(20);
    expect(x + width).toBeGreaterThan(240);
    expect(paths.ripples).toHaveLength(3);
    expect(paths.poolTop).toBe(state.poolTop);
  });
});
