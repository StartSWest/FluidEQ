import {
  createGraphInvaders,
  invaderUnit,
  kindForColumn,
  SHIP,
  spriteRects,
} from 'common/graphInvaders';
import { isGraphScene } from 'common/graphScenes';
import { resolveGraphPalette } from 'common/graphStyles';
import type { Projected } from 'common/graphStyles';
import {
  advanceSpaceInvasion,
  alienY,
  createSpaceInvasion,
  createSpaceInvasionPaths,
  invasionShake,
  SHAKE_LIFE,
  STARS,
} from 'renderer/graph/spaceInvasion';

const columns: Projected[] = Array.from({ length: 12 }, (_, i) => [
  20 + i * 20,
  i % 4 === 0 ? 60 : 140,
]);
const quiet: Projected[] = columns.map(([x]) => [x, 160]);

describe('the sprites', () => {
  it('lays the arcade rows along the spectrum and stays a scene', () => {
    expect(isGraphScene('invaders')).toBe(true);
    expect(resolveGraphPalette('invaders', 'auto')).toBe('rainbow');
    expect(kindForColumn(0, 12)).toBe('octopus');
    expect(kindForColumn(6, 12)).toBe('crab');
    expect(kindForColumn(11, 12)).toBe('squid');
  });

  it('merges pixel runs, picks a layer by glyph and shears rows to bank', () => {
    // The hull's widest rows are one rectangle each; the canopy is its own
    // layer of the same bitmap, so the two always line up.
    const hull = spriteRects(SHIP.frames[0], 100, 0, 2);
    const solid = hull.filter(([, , w]) => w === SHIP.width * 2);
    expect(solid.length).toBeGreaterThan(0);
    const canopy = spriteRects(SHIP.frames[0], 100, 0, 2, 'C');
    expect(canopy.length).toBeGreaterThan(0);
    expect(canopy.every(([, , w]) => w === 2)).toBe(true);
    const banked = spriteRects(SHIP.frames[0], 100, 0, 2, 'X', 0.5);
    expect(banked[0][0]).not.toBe(hull[0][0]);
    expect(banked[banked.length - 1][0]).not.toBe(hull[hull.length - 1][0]);
  });

  it('sizes a pixel from the depth and never wider than a column', () => {
    expect(invaderUnit(900, 70)).toBe(5);
    expect(invaderUnit(900, 200)).toBe(6);
    expect(invaderUnit(100, 200)).toBe(1.5);
  });

  it('still gives the picker a closed path per alien', () => {
    const path = createGraphInvaders(columns, 20, 160);
    expect(path.match(/Z/g)?.length).toBeGreaterThanOrEqual(columns.length);
    expect(path).not.toMatch(/NaN/);
  });
});

describe('the fight', () => {
  const fakePath = () => ({
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn(),
    closePath: jest.fn(),
    addPath: jest.fn(),
  });
  beforeAll(() => {
    Object.assign(globalThis, { Path2D: jest.fn(fakePath) });
  });
  afterAll(() => {
    Object.assign(globalThis, { Path2D: undefined });
  });

  const run = (
    state: ReturnType<typeof createSpaceInvasion>,
    live: readonly Projected[],
    seconds: number,
    playing = true,
  ) =>
    advanceSpaceInvasion(state, columns, live, 20, 160, seconds, playing, 140);

  it('keeps the aliens between the saucer lane and the ship', () => {
    const unit = invaderUnit(140, 20);
    expect(alienY(0, 20, 160, unit)).toBeGreaterThan(20);
    expect(alienY(200, 20, 160, unit)).toBeLessThan(160 - 140 * 0.2);
  });

  it('fires on the beat at the bands that jumped, wherever they are', () => {
    const state = createSpaceInvasion();
    run(state, quiet, 0);
    // The treble end jumps: the shots go there, not to the bass.
    const hit: Projected[] = columns.map(([x], i) => [x, i >= 10 ? 30 : 160]);
    run(state, hit, 0.02);
    expect(state.shots).toHaveLength(2);
    state.shots.forEach((shot) => {
      expect(shot.column).toBeGreaterThanOrEqual(10);
      expect(shot.dx).toBeGreaterThan(0);
    });
    expect(state.frame).toBe(1);
    expect(state.shipTarget).toBeGreaterThanOrEqual(columns[10][0]);
    // The shots fly on the clock and land as a burst and a flash.
    for (let t = 0.05; t < 1; t += 0.03) {
      run(state, hit, t);
    }
    expect(state.shots).toHaveLength(0);
    expect(state.hitAt.some((at) => at > 0)).toBe(true);
  });

  it('volleys at the ship on a hard bass hit, with a cooldown, and shakes on a landing', () => {
    const state = createSpaceInvasion();
    run(state, quiet, 0);
    const kick: Projected[] = columns.map(([x], i) => [x, i < 4 ? 30 : 160]);
    run(state, kick, 0.02);
    const volley = state.bolts.filter((bolt) => bolt.aimed).length;
    expect(volley).toBeGreaterThan(0);
    // The same hit again inside the cooldown adds nothing.
    run(state, quiet, 0.5);
    run(state, kick, 0.52);
    expect(state.volleyAt).toBe(0.02);
    expect(state.bolts.filter((bolt) => bolt.aimed).length).toBeLessThanOrEqual(
      volley,
    );
    for (let t = 0.55; t < 2; t += 0.03) {
      run(state, kick, t);
    }
    expect(state.shakeAt).toBeGreaterThan(0);
    const shake = invasionShake(state, state.shakeAt + 0.02);
    expect(Math.abs(shake.x) + Math.abs(shake.y)).toBeGreaterThan(0);
    expect(invasionShake(state, state.shakeAt + SHAKE_LIFE)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('freezes while paused and builds the scene past the plot', () => {
    const state = createSpaceInvasion();
    run(state, columns, 0);
    const stars = state.stars.map((star) => star.v);
    run(state, columns, 1, false);
    expect(state.stars.map((star) => star.v)).toEqual(stars);
    const paths = createSpaceInvasionPaths(state, columns, 20, 160, 0, 140);
    expect(paths.stars).toHaveLength(3);
    const drawn = paths.stars.reduce(
      (sum, band) =>
        sum +
        (band.path as unknown as { moveTo: jest.Mock }).moveTo.mock.calls
          .length,
      0,
    );
    expect(drawn).toBe(STARS);
    const shape = paths.shape as unknown as { rect: jest.Mock };
    expect(shape.rect.mock.calls.length).toBeGreaterThan(columns.length);
  });
});
