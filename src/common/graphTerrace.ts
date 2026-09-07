import type { Projected } from './graphStyles';

/** Four shelves share one measured skyline; the lower edges provide depth. */
const createGraphTerrace = (points: readonly Projected[], baseline: number) => {
  if (points.length < 2) {
    return { shape: '', outline: '', tiers: [] };
  }
  const halfStep = (points[1][0] - points[0][0]) / 2;
  const left = points[0][0] - halfStep;
  const right = points[points.length - 1][0] + halfStep;
  const edges = [1, 0.74, 0.48, 0.22].map((fraction) => {
    const row = (y: number) => baseline - (baseline - y) * fraction;
    let edge = `M ${left.toFixed(1)},${row(points[0][1]).toFixed(1)}`;
    points.forEach(([x, y]) => {
      edge += ` V ${row(y).toFixed(1)} H ${(x + halfStep).toFixed(1)}`;
    });
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
      opacity: 0.52 + index * 0.16,
    })),
  };
};

export default createGraphTerrace;
