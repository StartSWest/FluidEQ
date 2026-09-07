import createGraphStalactites from 'common/graphStalactites';
import { getDefaultTuning } from 'common/customLooks';
import type { Projected } from 'common/graphStyles';

describe('mineral Stalactites', () => {
  const points: Projected[] = [
    [20, 40],
    [60, 80],
    [100, 120],
  ];
  it('uses stable irregular silhouettes with bounded shade and highlight layers', () => {
    const layers = createGraphStalactites(points, 160, 20, 0.08);
    expect(createGraphStalactites(points, 160, 20, 0.08)).toEqual(layers);
    Object.values(layers).forEach((path) => {
      expect(path.match(/Z/g)).toHaveLength(3);
      expect(path).not.toMatch(/NaN|Infinity/);
      const rows = [...path.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
      expect(Math.min(...rows)).toBe(20);
      expect(Math.max(...rows)).toBeLessThanOrEqual(140);
    });
    // The body and its shade reach the tip; the wet highlight stops short
    // of it, where the bead of water sits.
    const tipOf = (path: string) =>
      Math.max(...[...path.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1])));
    expect(tipOf(layers.shape)).toBe(140);
    expect(tipOf(layers.shade)).toBe(140);
    expect(tipOf(layers.light)).toBeLessThan(140);
    expect(layers.shade).not.toBe(layers.shape);
    expect(layers.light).not.toBe(layers.shade);
  });

  it('honours the floor, spacing, and slower default response', () => {
    expect(
      createGraphStalactites(
        points.map(([x]) => [x, 160]),
        160,
        20,
        0.08,
      ),
    ).toEqual({ shape: '', shade: '', light: '' });
    expect(createGraphStalactites(points, 160, 20, 0.8).shape).not.toBe(
      createGraphStalactites(points, 160, 20, 0.08).shape,
    );
    expect(getDefaultTuning('stalactites')).toMatchObject({
      columns: 36,
      attackMs: 45,
      releaseMs: 320,
      fillOpacity: 0.74,
      gap: 0.08,
    });
  });
});
