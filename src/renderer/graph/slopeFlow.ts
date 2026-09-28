import type { Projected } from 'common/graphStyles';
import { createGraphShape } from 'common/graphShapes';

/** How far behind the arrows each of their trails is, and how it is drawn. */
const TRAILS = [3, 2, 1].map((age) => ({
  age,
  opacity: [0, 0.2, 0.1, 0.04][age],
  width: 1 - age * 0.16,
}));

/**
 * The arrows' points at a travelling position: every column moved that far
 * toward the next, so the contour is sampled where it is rather than the
 * whole wave translated.
 */
const pointsAt = (points: readonly Projected[], offset: number) => {
  const fraction = ((offset % 1) + 1) % 1;
  const moving: Projected[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x, y] = points[index];
    const [nextX, nextY] = points[index + 1];
    moving.push([x + (nextX - x) * fraction, y + (nextY - y) * fraction]);
  }
  return moving;
};

/**
 * The slope's arrows this frame and the trails behind them, as the points
 * each set of arrows stands on. What the page's paths below and the
 * engine's slope (`engineLooks/designed/slopeLook.ts`) are both drawn from.
 */
export const slopeFlowSets = (points: readonly Projected[], phase: number) => ({
  figure: pointsAt(points, phase),
  trails: TRAILS.map(({ age, opacity, width }) => ({
    points: pointsAt(points, phase - age * 0.14),
    opacity,
    width,
  })),
});

export type SlopeFlowSets = ReturnType<typeof slopeFlowSets>;

/** Sample the live contour at travelling positions; never translate the whole wave. */
const createSlopeFlow = (
  points: readonly Projected[],
  phase: number,
  baseline: number,
  gap: number,
) => {
  const sets = slopeFlowSets(points, phase);
  const pathOf = (moving: Projected[]) =>
    createGraphShape(moving, 'slope', baseline, moving.length, undefined, gap);
  return {
    path: pathOf(sets.figure),
    trails: sets.trails.map(({ points: moving, opacity, width }) => ({
      path: pathOf(moving),
      opacity,
      width,
    })),
    sets,
  };
};

export default createSlopeFlow;
