import { createGraphShape } from 'common/graphShapes';
import { getDefaultTuning } from 'common/customLooks';
import { canGraphFill, Projected } from 'common/graphStyles';

describe('rounded Ribs', () => {
  const points: Projected[] = [
    [10, 30],
    [30, 40],
    [50, 50],
  ];

  it('starts filled at full intensity with a readable release', () => {
    expect(canGraphFill('ribs')).toBe(true);
    expect(getDefaultTuning('ribs')).toMatchObject({
      filled: true,
      fillOpacity: 1,
      attackMs: 8,
      releaseMs: 180,
    });
  });

  it('closes every rounded rung and follows the measured crests', () => {
    const path = createGraphShape(points, 'ribs', 100, 3);
    const starts = path.match(/M /g) ?? [];
    expect(starts.length).toBeGreaterThan(3);
    expect(path.match(/Z/g)).toHaveLength(starts.length);
    expect(path.match(/ a /g)).toHaveLength(starts.length * 2);
    expect(path).toContain(',30.0 h');
    expect(path).not.toMatch(/NaN|Infinity/);
    expect(
      createGraphShape(
        points.map(([x]) => [x, 100]),
        'ribs',
        100,
        3,
      ),
    ).toBe('');
  });

  it('honours spacing and remains drawable in outline mode', () => {
    const wide = createGraphShape(points, 'ribs', 100, 3, [], 0);
    const narrow = createGraphShape(points, 'ribs', 100, 3, [], 0.8);
    expect(narrow).not.toBe(wide);
    expect(narrow).not.toBe('');
  });
});
