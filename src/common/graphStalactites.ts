import type { Projected } from './graphStyles';

/** Stable mineral ridges: no random geometry or new noise on each audio frame. */
const createGraphStalactites = (
  points: readonly Projected[],
  baseline: number,
  top: number,
  gap: number,
) => {
  let shape = '';
  let shade = '';
  let light = '';
  const spacing =
    points.length > 1
      ? (points[points.length - 1][0] - points[0][0]) / (points.length - 1)
      : 1;
  const width = Math.max(2, spacing * (1 - gap));
  const polygon = (vertices: Projected[]) =>
    `${vertices
      .map(
        ([x, y], index) =>
          `${index ? 'L' : 'M'} ${x.toFixed(1)},${y.toFixed(1)}`,
      )
      .join(' ')} Z`;
  points.forEach(([x, y], index) => {
    const length = Math.max(0, Math.min(baseline - top, baseline - y));
    if (length < 1) {
      return;
    }
    const lean = Math.sin(index * 2.4) * width * 0.12;
    const left: Projected[] = [];
    const right: Projected[] = [];
    const ridge: Projected[] = [];
    [0, 0.12, 0.28, 0.46, 0.66, 0.84, 1].forEach((t, level) => {
      const centre = x + lean * t;
      const half = width * 0.5 * (1 - t) ** 0.8;
      const irregularity = 0.85 + Math.sin(index * 4.7 + level * 2.1) * 0.15;
      const row = top + length * t;
      left.push([centre - half * irregularity, row]);
      right.push([centre + half * (1.7 - irregularity), row]);
      ridge.push([centre - half * 0.18, row]);
    });
    shape += polygon([...left, ...right.slice().reverse()]);
    shade += polygon([...ridge, ...right.slice().reverse()]);
    const glint = ridge.map(
      ([rx, ry], level) =>
        [rx + width * 0.09 * (1 - level / 6), ry] as Projected,
    );
    light += polygon([...ridge, ...glint.reverse()]);
  });
  return { shape, shade, light };
};

export default createGraphStalactites;
