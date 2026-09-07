import { createGraphShape } from 'common/graphShapes';
import { getDefaultTuning } from 'common/customLooks';
import { Projected } from 'common/graphStyles';

describe('Topography contour bands', () => {
  it('starts at 74% fill with a flowing release', () => {
    expect(getDefaultTuning('contour')).toMatchObject({
      filled: true,
      fillOpacity: 0.74,
      attackMs: 24,
      releaseMs: 240,
    });
  });

  it('interpolates crossings between samples and closes rounded ends', () => {
    const points: Projected[] = [
      [0, 100],
      [100, 0],
      [200, 100],
    ];
    const path = createGraphShape(points, 'contour', 100);
    // The first level is 84: crossings are x=16 and x=184, not whole bins.
    expect(path).toContain('M 17.5,82.5 h 165.0');
    expect(path.match(/Z/g)).toHaveLength(6);
    expect(path.match(/ a /g)).toHaveLength(12);
    expect(path).not.toMatch(/NaN|Infinity/);
    const shifted = createGraphShape(
      [
        [0, 100],
        [100, 1],
        [200, 100],
      ],
      'contour',
      100,
    );
    expect(shifted).not.toBe(path);
    expect(shifted).toContain('M 17.7,82.5');
  });
});
