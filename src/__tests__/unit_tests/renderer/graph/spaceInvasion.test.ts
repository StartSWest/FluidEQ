import {
  BUNKER,
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
  BUBBLE_LIFE,
  BUBBLE_RECHARGE,
  createSpaceInvasion,
  createSpaceInvasionPaths,
  invasionShake,
  SHAKE_LIFE,
  SHIP_LANE,
  STARS,
  VOLLEY_COOLDOWN,
} from 'renderer/graph/spaceInvasion';
import {
  advanceInvaderCabinet,
  ALIEN_SCORES,
  bunkerTop,
  createInvaderCabinet,
  strikeBunker,
} from 'renderer/graph/invaderCabinet';

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

  /**
   * One fight: its state and its cabinet, kept for as long as each other
   * the way the canvas keeps them. A cabinet made afresh every frame has
   * shelters that never keep a hole.
   */
  const fight = () => {
    const state = createSpaceInvasion();
    const cabinet = createInvaderCabinet();
    const run = (live: readonly Projected[], seconds: number, playing = true) =>
      advanceSpaceInvasion(
        state,
        cabinet,
        columns,
        live,
        20,
        160,
        seconds,
        playing,
        140,
      );
    return { state, cabinet, run };
  };
  /** Every column quiet but these, at the top of the plot. */
  const jump = (lit: (index: number) => boolean): Projected[] =>
    columns.map(([x], i) => [x, lit(i) ? 30 : 160]);

  it('keeps the aliens between the saucer lane and the ship', () => {
    const unit = invaderUnit(140, 20);
    expect(alienY(0, 20, 160, unit)).toBeGreaterThan(20);
    expect(alienY(200, 20, 160, unit)).toBeLessThan(160 - 140 * 0.2);
  });

  it('fires on the beat at the bands that jumped, wherever they are', () => {
    const { state, run } = fight();
    run(quiet, 0);
    // The treble end jumps: the shots go there, not to the bass.
    const hit = jump((i) => i >= 10);
    run(hit, 0.02);
    expect(state.shots).toHaveLength(2);
    state.shots.forEach((shot) => {
      expect(shot.column).toBeGreaterThanOrEqual(10);
      expect(shot.dx).toBeGreaterThan(0);
    });
    // The beat steps the formation's march along.
    expect(state.marchPhase).toBe(1);
    expect(state.shipTarget).toBeGreaterThanOrEqual(columns[10][0]);
    // The shots fly on the clock and are spent inside a second, on an
    // alien or on a shelter standing in the way.
    for (let t = 0.05; t < 1; t += 0.03) {
      run(hit, t);
    }
    expect(state.shots).toHaveLength(0);
  });

  it('brings down the aliens it has a clear line to, and scores them', () => {
    const { state, cabinet, run } = fight();
    run(quiet, 0);
    // The middle two bands jump, straight over the ship: the shots climb
    // through the gap between the middle shelters.
    const hit = jump((i) => i === 5 || i === 6);
    run(hit, 0.02);
    for (let t = 0.05; t < 1; t += 0.03) {
      run(hit, t);
    }
    expect(state.hitAt[5]).toBeGreaterThan(0);
    expect(state.hitAt[6]).toBeGreaterThan(0);
    expect(cabinet.score).toBe(
      ALIEN_SCORES[kindForColumn(5, 12)] + ALIEN_SCORES[kindForColumn(6, 12)],
    );
    // Nothing in the way was touched.
    expect(cabinet.bunkers.every((bunker) => bunker.gone.size === 0)).toBe(
      true,
    );
  });

  it('volleys at the ship on a hard bass hit, no more often than the cooldown', () => {
    const { state, run } = fight();
    run(quiet, 0);
    const kick = jump((i) => i < 4);
    run(kick, 0.02);
    const volley = state.bolts.filter((bolt) => bolt.aimed).length;
    expect(volley).toBeGreaterThan(0);
    // The same hit again inside the cooldown adds nothing.
    run(quiet, 0.5);
    run(kick, 0.52);
    expect(state.volleyAt).toBe(0.02);
    expect(state.bolts.filter((bolt) => bolt.aimed).length).toBeLessThanOrEqual(
      volley,
    );
    // Past it, the next hard hit brings the next volley.
    for (let t = 0.55; t < 0.02 + VOLLEY_COOLDOWN; t += 0.05) {
      run(quiet, t);
    }
    const next = 0.05 + VOLLEY_COOLDOWN;
    run(kick, next);
    expect(state.volleyAt).toBe(next);
  });

  it('raises the bubble on the first bolt to arrive, and only a bolt that lands while it charges costs a ship', () => {
    const { state, cabinet, run } = fight();
    run(quiet, 0);
    // A bolt just over the ship, below the shelters and in the gap between
    // the middle two, so this is about the bubble and not about aim.
    const shipY = 160 - 140 * SHIP_LANE;
    const drop = (seconds: number) => {
      state.bolts.push({
        x: state.shipX,
        y: shipY - 12,
        seed: 1,
        aimed: true,
        boss: false,
      });
      run(quiet, seconds);
    };
    drop(0.03);
    expect(state.bubbleUntil).toBeCloseTo(0.03 + BUBBLE_LIFE);
    expect(state.shakeAt).toBe(-1);
    // While it is up, a bolt pops on its skin and changes nothing.
    drop(1);
    expect(state.bubbleUntil).toBeCloseTo(0.03 + BUBBLE_LIFE);
    expect(state.shakeAt).toBe(-1);
    run(quiet, 1.03);
    expect(cabinet.lives).toBe(3);

    // Dropped, and charging: this one gets through and shakes the screen.
    const hitAt = 0.03 + BUBBLE_LIFE + 1;
    expect(hitAt).toBeLessThan(0.03 + BUBBLE_LIFE + BUBBLE_RECHARGE);
    drop(hitAt);
    expect(state.shakeAt).toBe(hitAt);
    const shake = invasionShake(state, hitAt + 0.02);
    expect(Math.abs(shake.x) + Math.abs(shake.y)).toBeGreaterThan(0);
    expect(invasionShake(state, hitAt + SHAKE_LIFE + 0.01)).toEqual({
      x: 0,
      y: 0,
    });
    run(quiet, hitAt + 0.03);
    expect(cabinet.lives).toBe(2);
    // ...and raises the bubble, so the rest of a volley costs nothing more.
    drop(hitAt + 0.3);
    run(quiet, hitAt + 0.33);
    expect(cabinet.lives).toBe(2);
    expect(state.shakeAt).toBe(hitAt);
  });

  it('freezes while paused and builds the scene past the plot', () => {
    const { state, run } = fight();
    run(columns, 0);
    const stars = state.stars.map((star) => star.v);
    run(columns, 1, false);
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

describe('the shelters', () => {
  const unit = 2;
  const shipY = 400;
  const map = BUNKER.frames[0];
  const cells = map
    .join('')
    .split('')
    .filter((cell) => cell === 'X').length;
  /** The shelter's own cells still standing, whatever `gone` holds. */
  const standing = (gone: ReadonlySet<number>) =>
    map.reduce(
      (count, row, r) =>
        count +
        [...row].filter(
          (cell, c) => cell === 'X' && !gone.has(r * row.length + c),
        ).length,
      0,
    );
  /** A cabinet with its shelters laid out along a 600px plot. */
  const laidOut = () => {
    const cabinet = createInvaderCabinet();
    advanceInvaderCabinet(cabinet, 0, 600, unit, -1);
    return cabinet;
  };
  // Inside the shelters' rows: which face a shot meets is its side's.
  const within = bunkerTop(shipY, unit) + unit;

  it('lets the laser bore up through an arch, and the hole stays a hole', () => {
    const cabinet = laidOut();
    const { centreX, gone } = cabinet.bunkers[0];
    let swallowed = 0;
    for (
      let shot = 0;
      shot < 20 && strikeBunker(cabinet, centreX, within, unit, shipY, true);
      shot += 1
    ) {
      swallowed += 1;
    }
    // A few shots to bore through, then the rest go up the hole...
    expect(swallowed).toBeGreaterThan(1);
    expect(swallowed).toBeLessThan(20);
    expect(strikeBunker(cabinet, centreX, within, unit, shipY, true)).toBe(
      false,
    );
    // ...and it is a hole, not a shelter gone.
    expect(standing(gone)).toBeGreaterThan(cells / 2);
  });

  it('takes a bolt on the roof, and nothing between shelters or above them', () => {
    const cabinet = laidOut();
    const [first, second] = cabinet.bunkers;
    expect(
      strikeBunker(cabinet, first.centreX, within, unit, shipY, false),
    ).toBe(true);
    const rows = [...first.gone].map((index) =>
      Math.floor(index / map[0].length),
    );
    expect(Math.min(...rows)).toBe(0);
    expect(Math.max(...rows)).toBeLessThanOrEqual(1);
    expect(second.gone.size).toBe(0);
    const between = (first.centreX + second.centreX) / 2;
    expect(strikeBunker(cabinet, between, within, unit, shipY, false)).toBe(
      false,
    );
    const above = bunkerTop(shipY, unit) - unit;
    expect(
      strikeBunker(cabinet, first.centreX, above, unit, shipY, false),
    ).toBe(false);
  });

  it('comes back whole only once fire has left less than a third of it', () => {
    const cabinet = laidOut();
    const { centreX, gone } = cabinet.bunkers[0];
    let before = cells;
    let replaced = false;
    for (let pass = 0; pass < 40 && !replaced; pass += 1) {
      for (let step = -7; step <= 7 && !replaced; step += 1) {
        const standingBefore = standing(gone);
        strikeBunker(
          cabinet,
          centreX + step * unit,
          within,
          unit,
          shipY,
          false,
        );
        if (gone.size === 0 && standingBefore < cells) {
          replaced = true;
          before = standingBefore;
        }
      }
    }
    expect(replaced).toBe(true);
    // The strike that brought the new one took the last of the third that
    // has to stand: one blast takes at most the nine cells around it.
    expect(before - 9).toBeLessThan(cells * 0.34);
  });
});
