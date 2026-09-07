import {
  advanceBubbleStorm,
  BOLT_LIFE,
  bubbleShake,
  bubbleTarget,
  createBubbleStorm,
  POP_LIFE,
  REGROW_AFTER,
  SHAKE_LIFE,
} from 'renderer/graph/bubbleStorm';
import createBubblePaths from 'renderer/graph/bubblePaths';
import type { Projected } from 'common/graphStyles';
import { getDefaultTuning } from 'common/customLooks';

const quiet: Projected[] = [
  [20, 160],
  [60, 160],
  [100, 160],
];
const hit: Projected[] = [
  [20, 160],
  [60, 80],
  [100, 160],
];

describe('the bubble storm', () => {
  it('strikes once on a sharp rise and bursts both ends of the bolt', () => {
    const storm = createBubbleStorm();
    advanceBubbleStorm(storm, quiet, 20, 160, 1, true);
    expect(storm.bolts).toEqual([]);
    expect(storm.pops.size).toBe(0);

    advanceBubbleStorm(storm, hit, 20, 160, 1.1, true);
    // One fork each way: to the band below and to the band above.
    expect(storm.bolts).toEqual([
      { at: 1.1, from: 3, to: bubbleTarget(1, 1.1, 0) },
      { at: 1.1, from: 3, to: bubbleTarget(1, 1.1, 2) },
    ]);
    expect(storm.pops.get(3)).toBe(1.1);
    storm.bolts.forEach((bolt) => expect(storm.pops.get(bolt.to)).toBe(1.1));

    // Holding the level is not a second hit.
    advanceBubbleStorm(storm, hit, 20, 160, 1.15, true);
    expect(storm.bolts).toHaveLength(2);
  });

  it('fires a volley across the loud bands when the whole spectrum jumps', () => {
    const storm = createBubbleStorm();
    const frame = (loud: number, quietLevel: number): Projected[] =>
      Array.from({ length: 9 }, (_, i) => [
        i * 10,
        160 - 140 * (i === 3 || i === 6 ? loud : quietLevel),
      ]);
    // Bands 3 and 6 climb to 30% in steps too small to strike on their own.
    for (let step = 0; step <= 5; step += 1) {
      advanceBubbleStorm(
        storm,
        frame(step * 0.06, 0),
        20,
        160,
        1 + step * 0.3,
        true,
      );
    }
    expect(storm.bolts).toEqual([]);
    // Every band up by 6%: below any band's own threshold, above the mean's,
    // so of bands 0, 3 and 6 the two carrying energy strike.
    advanceBubbleStorm(storm, frame(0.36, 0.06), 20, 160, 2.8, true);
    const sources = new Set(storm.bolts.map((bolt) => bolt.from));
    expect(sources).toEqual(new Set([9, 18]));
  });

  it('lets a bolt die and a popped bubble regrow on the same clock', () => {
    const storm = createBubbleStorm();
    advanceBubbleStorm(storm, quiet, 20, 160, 1, true);
    advanceBubbleStorm(storm, hit, 20, 160, 1.1, true);
    advanceBubbleStorm(storm, hit, 20, 160, 1.1 + BOLT_LIFE + 0.01, true);
    expect(storm.bolts).toEqual([]);
    expect(storm.pops.has(3)).toBe(true);
    advanceBubbleStorm(
      storm,
      hit,
      20,
      160,
      1.1 + POP_LIFE + REGROW_AFTER + 0.81,
      true,
    );
    expect(storm.pops.has(3)).toBe(false);
  });

  it('decides nothing while paused and resets when the band count changes', () => {
    const storm = createBubbleStorm();
    advanceBubbleStorm(storm, quiet, 20, 160, 1, true);
    advanceBubbleStorm(storm, hit, 20, 160, 1.1, false);
    expect(storm.bolts).toEqual([]);
    advanceBubbleStorm(storm, hit, 20, 160, 1.2, true);
    expect(storm.bolts).toHaveLength(2);
    advanceBubbleStorm(storm, hit.slice(0, 2), 20, 160, 1.3, true);
    // The old bolts are dropped; the hit is then measured afresh from zero.
    expect(storm.bolts.every((bolt) => bolt.at === 1.3)).toBe(true);
    expect(storm.levels).toHaveLength(2);
  });

  it('shakes the room only when three or more bands strike together', () => {
    const storm = createBubbleStorm();
    advanceBubbleStorm(storm, quiet, 20, 160, 1, true);
    advanceBubbleStorm(storm, hit, 20, 160, 1.1, true);
    expect(bubbleShake(storm, 1.1)).toEqual({ x: 0, y: 0 });

    const volley = createBubbleStorm();
    const wide: Projected[] = Array.from({ length: 9 }, (_, i) => [
      i * 10,
      160,
    ]);
    advanceBubbleStorm(volley, wide, 20, 160, 1, true);
    advanceBubbleStorm(
      volley,
      wide.map(([x]) => [x, 60]),
      20,
      160,
      1.1,
      true,
    );
    const shaken = bubbleShake(volley, 1.12);
    expect(Math.hypot(shaken.x, shaken.y)).toBeGreaterThan(0);
    expect(Math.abs(shaken.x)).toBeLessThanOrEqual(7);
    expect(bubbleShake(volley, 1.1 + SHAKE_LIFE)).toEqual({ x: 0, y: 0 });
  });

  it('keeps the slower default response', () => {
    expect(getDefaultTuning('bubbles')).toMatchObject({
      attackMs: 12,
      releaseMs: 190,
    });
  });
});

describe('the bubble paths', () => {
  const makePath = () => {
    const calls: string[] = [];
    const path = {
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      arc: () => calls.push('arc'),
      ellipse: () => calls.push('ellipse'),
      closePath: () => calls.push('closePath'),
      calls,
    };
    return path;
  };
  const fakePath2D = jest.fn(makePath);
  beforeAll(() => {
    Object.assign(globalThis, { Path2D: fakePath2D });
  });
  afterAll(() => {
    Object.assign(globalThis, { Path2D: undefined });
  });

  it('draws a bolt only while one is live, and a burst only while it pops', () => {
    const storm = createBubbleStorm();
    advanceBubbleStorm(storm, quiet, 20, 160, 1, true);
    advanceBubbleStorm(storm, hit, 20, 160, 1.1, true);
    const live = createBubblePaths(hit, 20, 160, 1, 1.12, 0.1, false, storm);
    const bolts = live.bolts as unknown as ReturnType<typeof makePath>[];
    expect(bolts.some((batch) => batch.calls.includes('lineTo'))).toBe(true);
    const rings = live.rings as unknown as ReturnType<typeof makePath>[];
    expect(rings.some((batch) => batch.calls.includes('arc'))).toBe(true);

    const later = createBubblePaths(hit, 20, 160, 1, 3, 0.1, false, storm);
    const laterBolts = later.bolts as unknown as ReturnType<typeof makePath>[];
    expect(laterBolts.every((batch) => batch.calls.length === 0)).toBe(true);
    const laterRings = later.rings as unknown as ReturnType<typeof makePath>[];
    expect(laterRings.every((batch) => batch.calls.length === 0)).toBe(true);
  });
});
