import type { Projected } from './graphStyles';

/**
 * A heart monitor.
 *
 * The trace rests on its own line and deflects once per band — a small dip,
 * a tall spike, a smaller dip, back to rest — and loud bands beat harder.
 * A monitor also SWEEPS: a write-head crosses the screen and the trace is
 * freshest just behind it, so the geometry is handed back as vertices that
 * the renderer can cut at the head. `shape` is the whole trace as path data
 * for the static figure, the preview and the icon.
 */

/** How far above the floor the resting line sits. */
export const PULSE_REST = 30;
/** How often the head crosses the plot, in seconds of music-pace clock. */
export const SWEEP_PERIOD = 3;

const point = ([x, y]: Projected) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** The trace as vertices, left to right. `pump` scales every beat. */
export const pulseVertices = (
  points: readonly Projected[],
  baseline: number,
  pump = 1,
): Projected[] => {
  if (points.length < 2) {
    return [];
  }
  const step =
    (points[points.length - 1][0] - points[0][0]) / (points.length - 1);
  const rest = baseline - PULSE_REST;
  const width = Math.max(1.5, step * 0.16);
  const vertices: Projected[] = [[points[0][0], rest]];
  points.forEach(([x, y]) => {
    const beat = Math.max(2, (baseline - y) * 0.72) * pump;
    vertices.push(
      [x - width * 2, rest],
      [x - width, rest + beat * 0.16],
      [x, rest - beat],
      [x + width, rest + beat * 0.11],
      [x + width * 2, rest],
    );
  });
  return vertices;
};

/** Where the head is: 0 at the left edge, 1 at the right, on the clock. */
export const pulseHeadFraction = (seconds: number) =>
  (seconds / SWEEP_PERIOD) % 1;

const lerpAt = (a: Projected, b: Projected, x: number): Projected => {
  const span = b[0] - a[0];
  const t = span === 0 ? 0 : (x - a[0]) / span;
  return [x, a[1] + (b[1] - a[1]) * t];
};

/**
 * The part of a polyline between two x positions, interpolated at the cuts
 * so a slice never starts or ends in mid-air. Empty when the range is
 * outside the line.
 */
export const sliceByX = (
  vertices: readonly Projected[],
  from: number,
  to: number,
): Projected[] => {
  const out: Projected[] = [];
  for (let index = 0; index < vertices.length - 1; index += 1) {
    const a = vertices[index];
    const b = vertices[index + 1];
    if (b[0] >= from && a[0] <= to) {
      const start = a[0] < from ? lerpAt(a, b, from) : a;
      const end = b[0] > to ? lerpAt(a, b, to) : b;
      if (out.length === 0) {
        out.push(start);
      }
      out.push(end);
    }
  }
  return out;
};

export const polylinePath = (vertices: readonly Projected[]) =>
  vertices.length < 2 ? '' : `M ${vertices.map(point).join(' L ')}`;

/** The whole trace, shut against the floor when filled. */
const createGraphPulse = (
  points: readonly Projected[],
  baseline: number,
  filled: boolean,
): string => {
  const vertices = pulseVertices(points, baseline);
  if (vertices.length < 2) {
    return '';
  }
  const open = polylinePath(vertices);
  if (!filled) {
    return open;
  }
  const last = vertices[vertices.length - 1];
  return `${open} L ${last[0].toFixed(1)},${baseline.toFixed(1)} L ${vertices[0][0].toFixed(1)},${baseline.toFixed(1)} Z`;
};

export default createGraphPulse;
