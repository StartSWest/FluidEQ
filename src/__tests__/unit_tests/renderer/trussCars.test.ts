import createTrussRoad from 'common/graphTruss';
import { createGraphShape } from 'common/graphShapes';
import { getDefaultTuning } from 'common/customLooks';
import paintTrussCars from 'renderer/graph/trussCars';
import type { Projected } from 'common/graphStyles';

describe('Truss bridge traffic', () => {
  const points: Projected[] = [
    [0, 90],
    [100, 20],
    [200, 80],
    [300, 100],
  ];
  const road = createTrussRoad(points);

  it('rounds the road without overshooting and retains bridge supports', () => {
    expect(road).toHaveLength(25);
    expect(road[0][0]).toBe(0);
    expect(road[24][0]).toBe(300);
    road.forEach(([, y]) => {
      expect(y).toBeGreaterThanOrEqual(20);
      expect(y).toBeLessThanOrEqual(100);
    });
    expect(createGraphShape(points, 'truss', 150, 4)).toContain('V 150.0');
    expect(getDefaultTuning('truss')).toMatchObject({
      columns: 28,
      attackMs: 45,
      releaseMs: 320,
      strokeWidth: 3,
    });
  });

  it.each([0.25, 1, 2, -0.5])(
    'keeps four cars on the road and undistorted at scale %s',
    (scaleY) => {
      const context = {
        getTransform: () => ({ a: 2, d: 2 * scaleY }),
        save: jest.fn(),
        restore: jest.fn(),
        translate: jest.fn(),
        scale: jest.fn(),
        rotate: jest.fn(),
        fillRect: jest.fn(),
        beginPath: jest.fn(),
        arc: jest.fn(),
        moveTo: jest.fn(),
        fill: jest.fn(),
      };
      const paint = (phase: number) =>
        paintTrussCars(
          context as unknown as CanvasRenderingContext2D,
          road,
          phase,
        );
      paint(0.1);
      expect(context.translate).toHaveBeenCalledTimes(4);
      const first = [...context.translate.mock.calls];
      context.scale.mock.calls.forEach(([x, y]) =>
        expect(Math.abs(y * scaleY)).toBeCloseTo(x),
      );
      paint(1.1);
      context.translate.mock.calls.slice(4).forEach(([x, y], index) => {
        expect(x).toBeCloseTo(first[index][0]);
        expect(y).toBeCloseTo(first[index][1]);
      });
      paint(0.2);
      expect(context.translate.mock.calls[8][0]).toBeGreaterThan(first[0][0]);
      expect(context.restore).toHaveBeenCalledTimes(12);
    },
  );
});
