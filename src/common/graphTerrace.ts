import type { Projected } from './graphStyles';

/**
 * The shelves' heights as fractions of each band's height: the first is
 * the skyline, the rest the lower tiers. Exported so the valley can put a
 * wall under every rim.
 */
export const TERRACE_TIER_FRACTIONS = [1, 0.74, 0.48, 0.22];

/**
 * Each shelf's edge as the corners it turns, from the left end to the
 * right: a flat run at every column's height, a riser between. What the
 * paths below and the engine's terrace (`engineLooks/designed/terraceLook.ts`)
 * are both drawn from.
 */
export const terraceEdges = (
  points: readonly Projected[],
  baseline: number,
) => {
  const halfStep = (points[1][0] - points[0][0]) / 2;
  const left = points[0][0] - halfStep;
  const right = points[points.length - 1][0] + halfStep;
  const edges = TERRACE_TIER_FRACTIONS.map((fraction) => {
    const row = (y: number) => baseline - (baseline - y) * fraction;
    const corners: Projected[] = [[left, row(points[0][1])]];
    points.forEach(([x, y]) => {
      corners.push([corners[corners.length - 1][0], row(y)]);
      corners.push([x + halfStep, row(y)]);
    });
    return corners;
  });
  return { left, right, halfStep, edges };
};

/** How solid each shelf is filled, the skyline's first. */
export const terraceTierOpacity = (index: number) => 0.52 + index * 0.16;

/** Four shelves share one measured skyline; the lower edges provide depth. */
const createGraphTerrace = (points: readonly Projected[], baseline: number) => {
  if (points.length < 2) {
    return { shape: '', outline: '', tiers: [] };
  }
  const { left, right, edges: corners } = terraceEdges(points, baseline);
  const edges = corners.map(([[fromX, fromY], ...rest]) => {
    let edge = `M ${fromX.toFixed(1)},${fromY.toFixed(1)}`;
    for (let at = 0; at < rest.length; at += 2) {
      edge += ` V ${rest[at][1].toFixed(1)} H ${rest[at + 1][0].toFixed(1)}`;
    }
    return edge;
  });
  const bodies = edges.map(
    (edge) =>
      `${edge} L ${right.toFixed(1)},${baseline.toFixed(1)} H ${left.toFixed(1)} Z`,
  );
  return {
    shape: bodies[0],
    outline: edges.join(' '),
    // Even-odd fills cut each lower shelf out of the one above, so shading
    // stays within Fill's selected opacity instead of accumulating at the foot.
    tiers: bodies.map((body, index) => ({
      body: `${body} ${bodies[index + 1] ?? ''}`,
      edge: edges[index],
      opacity: terraceTierOpacity(index),
    })),
  };
};

export default createGraphTerrace;
