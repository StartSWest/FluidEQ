import createGraphRoad, {
  FAR_LANE_SCALE,
  roadSurface,
  surfaceAt,
  TRAFFIC,
  trafficPoses,
  vehicleSize,
} from 'common/graphRoad';
import { isGraphScene } from 'common/graphScenes';
import { resolveGraphPalette } from 'common/graphStyles';
import type { Projected } from 'common/graphStyles';
import {
  advanceRoadTrip,
  createRoadTrip,
  createRoadTripPaths,
  HILL_HALF_LIFE_MS,
  highBeam,
  ROAD_COLUMNS,
} from 'renderer/graph/roadTrip';

const points: Projected[] = Array.from({ length: 24 }, (_, i) => [
  20 + i * 10,
  i % 6 === 0 ? 60 : 140,
]);

describe('the road', () => {
  it('is a running scene painted by level under auto', () => {
    expect(isGraphScene('racer')).toBe(true);
    expect(resolveGraphPalette('racer', 'auto')).toBe('level');
    expect(ROAD_COLUMNS).toBe(96);
  });

  it('smooths the spectrum into a ridge inside the plot', () => {
    const road = roadSurface(points, 20, 160);
    const ys = road.map(([, y]) => y);
    // Smoothed: no ridge point reaches the raw spikes, none the raw floor.
    expect(Math.min(...ys)).toBeGreaterThan(20 + 140 * 0.24);
    expect(Math.max(...ys)).toBeLessThan(160);
    expect(surfaceAt(road, 25)).toBeCloseTo((road[0][1] + road[1][1]) / 2);
  });

  it('runs two lanes of traffic on an endless loop at two depths', () => {
    const road = roadSurface(points, 20, 160);
    const now = trafficPoses(road, 3, 20, 230, 140);
    expect(now).toHaveLength(TRAFFIC.length);
    const near = now.filter((pose) => pose.facing > 0);
    const far = now.filter((pose) => pose.facing < 0);
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    // The far lane is smaller and painted first.
    expect(far[0].size).toBeCloseTo(near[0].size * FAR_LANE_SCALE);
    expect(now.indexOf(far[0])).toBeLessThan(now.indexOf(near[0]));
    // Time moves the near lane right and the far lane left, and nobody turns.
    const later = trafficPoses(road, 3.5, 20, 230, 140);
    later.forEach((pose, index) => {
      expect(pose.facing).toBe(now[index].facing);
      const moved = (pose.x - now[index].x) * pose.facing;
      // Forward, unless it has just wrapped round the loop.
      expect(moved > 0 || moved < -200).toBe(true);
    });
  });

  it('scales vehicles from the plot height so they keep pace with the trees', () => {
    expect(vehicleSize(230)).toBe(1);
    expect(vehicleSize(1000)).toBeGreaterThan(vehicleSize(300));
    expect(vehicleSize(100000)).toBe(3.2);
    expect(createGraphRoad(points, 20, 160, 1)).toMatch(/Z/);
    expect(createGraphRoad([points[0]], 20, 160, 1)).toBe('');
  });
});

describe('the trip', () => {
  const fakePath = () => ({
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    closePath: jest.fn(),
  });
  beforeAll(() => {
    Object.assign(globalThis, { Path2D: jest.fn(fakePath) });
  });
  afterAll(() => {
    Object.assign(globalThis, { Path2D: undefined });
  });

  it('rolls the hillside toward the music on the clock and flashes on a beat', () => {
    const state = createRoadTrip();
    const quiet: Projected[] = points.map(([x]) => [x, 160]);
    advanceRoadTrip(state, quiet, 20, 160, 1, true);
    const floor = [...state.hill];
    advanceRoadTrip(state, points, 20, 160, 1 + HILL_HALF_LIFE_MS / 1000, true);
    // Half-way there after one half-life, not all the way.
    const target = roadSurface(points, 20, 160)[0][1];
    expect(state.hill[0]).toBeLessThan(floor[0]);
    expect(state.hill[0]).toBeGreaterThan(target);
    expect(highBeam(state, 1 + HILL_HALF_LIFE_MS / 1000)).toBe(1);
    expect(highBeam(state, 2)).toBe(0);
  });

  it('builds the scene without text and idles while paused', () => {
    const state = createRoadTrip();
    advanceRoadTrip(state, points, 20, 160, 1, false);
    expect(state.flashAt).toBe(-1);
    const paths = createRoadTripPaths(state, points, 20, 160, 1);
    expect(paths.traffic).toHaveLength(TRAFFIC.length);
    expect(paths.nearLane.beams.length + paths.farLane.beams.length).toBe(
      TRAFFIC.length,
    );
    expect(paths.half).toBeGreaterThanOrEqual(5);
  });
});
