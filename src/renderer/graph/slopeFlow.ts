import type { Projected } from 'common/graphStyles';
import { createGraphShape } from 'common/graphShapes';

/** Sample the live contour at travelling positions; never translate the whole wave. */
const createSlopeFlow = (
  points: readonly Projected[],
  phase: number,
  baseline: number,
  gap: number,
) => {
  const pathAt = (offset: number) => {
    const fraction = ((offset % 1) + 1) % 1;
    const moving: Projected[] = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const [x, y] = points[index];
      const [nextX, nextY] = points[index + 1];
      moving.push([x + (nextX - x) * fraction, y + (nextY - y) * fraction]);
    }
    return createGraphShape(
      moving,
      'slope',
      baseline,
      moving.length,
      undefined,
      gap,
    );
  };
  return {
    path: pathAt(phase),
    trails: [3, 2, 1].map((age) => ({
      path: pathAt(phase - age * 0.14),
      opacity: [0, 0.2, 0.1, 0.04][age],
      width: 1 - age * 0.16,
    })),
  };
};

export default createSlopeFlow;
