import createSlopeFlow from 'renderer/graph/slopeFlow';
import { getDefaultTuning } from 'common/customLooks';
import type { Projected } from 'common/graphStyles';

describe('travelling Slope field', () => {
  const points: Projected[] = [
    [0, 40],
    [40, 40],
    [80, 40],
    [120, 40],
  ];
  it('moves forward over the contour and wraps without accumulating trails', () => {
    const first = createSlopeFlow(points, 0.2, 150, 0.25);
    const next = createSlopeFlow(points, 0.4, 150, 0.25);
    const firstX = Number(first.path.match(/^M (-?[\d.]+)/)?.[1]);
    const nextX = Number(next.path.match(/^M (-?[\d.]+)/)?.[1]);
    expect(nextX - firstX).toBeCloseTo(8);
    expect(createSlopeFlow(points, 1.2, 150, 0.25)).toEqual(first);
    expect(first.trails).toHaveLength(3);
    expect(first.trails.map((trail) => trail.opacity)).toEqual([
      0.04, 0.1, 0.2,
    ]);
    first.trails.forEach((trail) => {
      expect(trail.path).not.toBe(first.path);
      expect(trail.path).not.toMatch(/NaN|Infinity/);
    });
  });

  it('retains pause state, spacing, and the chosen musical response', () => {
    const a = createSlopeFlow(points, 0.5, 150, 0);
    expect(createSlopeFlow(points, 0.5, 150, 0)).toEqual(a);
    expect(createSlopeFlow(points, 0.5, 150, 0.8).path).not.toBe(a.path);
    expect(getDefaultTuning('slope')).toMatchObject({
      attackMs: 8,
      releaseMs: 220,
      strokeWidth: 3,
      gap: 0.25,
      accents: true,
      accentStyle: 'sparks',
    });
  });
});
