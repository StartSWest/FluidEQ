import { Projected } from 'common/graphStyles';
import { createGraphConnector } from 'common/graphShapes';

/** Pre-scale centres, then paint in uniform canvas space so rims stay round too. */
const createDotPaths = (
  points: readonly Projected[],
  baseline: number,
  top: number,
  gap: number,
  scaleY: number,
  connected: boolean,
) => {
  const depth = Math.max(1, baseline - top);
  const span =
    points.length > 1 ? points[points.length - 1][0] - points[0][0] : 1;
  const step = Math.max(1, span / Math.max(1, points.length - 1));
  const reach = Math.min(
    Math.max(1.6, step * (1 - Math.max(0, Math.min(0.85, gap)))) / 2,
    depth * 0.08,
  );
  const beads = new Path2D();
  points.forEach(([x, y]) => {
    const energy = Math.max(0, Math.min(1, (baseline - y) / depth));
    const radius = reach * (0.48 + 0.52 * Math.sqrt(energy));
    beads.moveTo(x + radius, y * scaleY);
    // Match the ribbon's winding so a connector crossing a bead cannot cut
    // a transparent stripe through it under the nonzero fill rule.
    beads.arc(x, y * scaleY, radius, 0, Math.PI * 2, true);
    beads.closePath();
  });
  const shape = new Path2D(beads);
  if (connected) {
    shape.addPath(
      new Path2D(
        createGraphConnector(
          points.map(([x, y]) => [x, y * scaleY]),
          Math.min(0.8, reach * 0.12),
        ),
      ),
    );
  }
  return { beads, shape };
};

export default createDotPaths;
