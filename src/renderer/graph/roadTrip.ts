import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import {
  farRange,
  ICarPose,
  IVehiclePose,
  placeOnCar,
  roadHalf,
  roadSurface,
  surfaceAt,
  trafficPoses,
  vehicleSize,
} from 'common/graphRoad';

/**
 * The road trip in motion: what the still hillside in `graphRoad` does not
 * carry.
 *
 * Two speeds. The hillside and the far range ease toward the music with a
 * 380ms half-life on top of the look's own ballistics, so the road ROLLS —
 * hills that followed every transient threw the car about and read as a
 * seismograph. Everything living on the landscape answers the fast signal:
 * every tree stands on a band and grows with that band's level, so the
 * bass trees on the left and the treble trees on the right dance to their
 * own part; the traffic glows, bounces on its springs and flashes its high
 * beams on a beat; tail lights breathe with the level; and the trees a
 * headlight beam is sweeping light up.
 *
 * Above it, a night sky: seeded stars that twinkle, and a moon whose halo
 * swells with the level.
 *
 * Depth. The road is wide enough for two lanes: the left-bound lane runs
 * along its far edge with vehicles drawn smaller and dimmer, the
 * right-bound lane along its near edge at full size, so the two ways read
 * as two distances rather than two directions on one line. The far range
 * is shaded like something seen through air — lighter at the ridge,
 * sinking into haze — and the hillside like ground: lit at the ridge,
 * dark at the foot, with tufts of grass on the verge.
 *
 * Back to front: sky, far range and its trees, the hillside (the figure),
 * the asphalt and its markings, the far lane, the verge trees, the near
 * lane.
 *
 * COST. The landscape runs on 96 columns, not the trace: in fullscreen the
 * trace is over a thousand points, and every hill, range, edge and
 * contour line was a polyline of all of them. At 96 the whole scene is
 * under three hundred small polygons, written straight into Path2D every
 * frame, no text.
 */

/** Verge trees every ~110px of road, far ones every ~48px of ridge. */
const NEAR_SPACING = 110;
const FAR_SPACING = 48;
/** The far line drifts at 22% of the car's travel. */
const PARALLAX = 0.22;
const STARS = 56;
/** Grass tufts on the verge, seeded, so the same hill has the same grass. */
const TUFTS = 90;
/** How many columns the landscape is built on, whatever the trace has. */
export const ROAD_COLUMNS = 96;
export const FLASH_LIFE = 0.25;
/** How long the landscape takes to close half the distance to the music. */
export const HILL_HALF_LIFE_MS = 380;

export const createRoadTrip = () => ({
  beatLevel: 0,
  trackedAt: -1,
  flashAt: -1,
  /** The mean level, eased so the lights breathe rather than flicker. */
  glow: 0,
  /** The hillside's eased heights, one per point, in plot pixels. */
  hill: [] as number[],
});
export type RoadTrip = ReturnType<typeof createRoadTrip>;

export const advanceRoadTrip = (
  state: RoadTrip,
  points: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
) => {
  const target = roadSurface(points, top, bottom);
  if (state.hill.length !== target.length) {
    state.hill = target.map(([, y]) => y);
  }
  if (!playing) {
    return;
  }
  const elapsedMs =
    state.trackedAt < 0 ? 0 : Math.max(0, seconds - state.trackedAt) * 1000;
  state.trackedAt = seconds;
  const roll = getEaseFactor(elapsedMs, HILL_HALF_LIFE_MS);
  target.forEach(([, y], index) => {
    state.hill[index] += (y - state.hill[index]) * roll;
  });
  const depth = Math.max(1, bottom - top);
  const mean =
    points.reduce(
      (sum, [, y]) => sum + Math.max(0, Math.min(1, (bottom - y) / depth)),
      0,
    ) / Math.max(1, points.length);
  if (mean - state.beatLevel >= 0.05) {
    state.flashAt = seconds;
  }
  state.beatLevel = Math.max(
    mean,
    state.beatLevel * (1 - getEaseFactor(elapsedMs, 110)),
  );
  state.glow += (mean - state.glow) * getEaseFactor(elapsedMs, 90);
};

/** 1 at the flash, 0 once it is over. */
export const highBeam = (state: RoadTrip, seconds: number) => {
  const age = (seconds - state.flashAt) / FLASH_LIFE;
  return state.flashAt < 0 || age < 0 || age > 1 ? 0 : 1 - age;
};

/** A cheap deterministic hash in [0, 1). */
const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

const polygon = (path: Path2D, vertices: readonly Projected[]) => {
  path.moveTo(vertices[0][0], vertices[0][1]);
  for (let index = 1; index < vertices.length; index += 1) {
    path.lineTo(vertices[index][0], vertices[index][1]);
  }
  path.closePath();
};

const polyline = (path: Path2D, vertices: readonly Projected[]) => {
  path.moveTo(vertices[0][0], vertices[0][1]);
  for (let index = 1; index < vertices.length; index += 1) {
    path.lineTo(vertices[index][0], vertices[index][1]);
  }
};

/** A conifer `tall` pixels high: a trunk and three stacked canopies. */
const tree = (path: Path2D, x: number, ground: number, tall: number) => {
  const half = tall * 0.28;
  polygon(path, [
    [x - tall * 0.05, ground],
    [x + tall * 0.05, ground],
    [x + tall * 0.05, ground - tall * 0.3],
    [x - tall * 0.05, ground - tall * 0.3],
  ]);
  [
    [0.2, 0.62, 1],
    [0.42, 0.8, 0.78],
    [0.62, 1, 0.55],
  ].forEach(([foot, tip, spread]) => {
    polygon(path, [
      [x - half * spread, ground - tall * foot],
      [x + half * spread, ground - tall * foot],
      [x, ground - tall * tip],
    ]);
  });
};

/** The level, 0..1, of the band under `x`. */
const levelAt = (
  points: readonly Projected[],
  x: number,
  top: number,
  bottom: number,
) => {
  const left = points[0][0];
  const step = (points[points.length - 1][0] - left) / (points.length - 1);
  const index = Math.max(
    0,
    Math.min(points.length - 1, Math.round((x - left) / step)),
  );
  return Math.max(
    0,
    Math.min(1, (bottom - points[index][1]) / Math.max(1, bottom - top)),
  );
};

/**
 * One lane of traffic as paths: bodies, cabins, wheels with a turning spoke,
 * lamps, tail lights, a glow halo per vehicle and a headlight beam each.
 * Shared with the bridge, which runs the same traffic on its deck. A beat
 * (`thump`, 0..1) bounces every vehicle a little on its springs.
 */
export const createLanePaths = (
  poses: readonly IVehiclePose[],
  seconds: number,
  glow: number,
  thump: number,
  beamReach: number,
) => {
  const body = new Path2D();
  const cabin = new Path2D();
  const wheels = new Path2D();
  const wheelRims = new Path2D();
  const hubs = new Path2D();
  const lamps = new Path2D();
  const tail = new Path2D();
  const halo = new Path2D();
  const beams: { path: Path2D; from: Projected; to: Projected }[] = [];
  poses.forEach((pose, order) => {
    const sprung: IVehiclePose = {
      ...pose,
      y: pose.y - thump * 3 * pose.size,
    };
    polygon(
      body,
      pose.type.body.map((p) => placeOnCar(sprung, p)),
    );
    polygon(
      cabin,
      pose.type.cabin.map((p) => placeOnCar(sprung, p)),
    );
    pose.type.wheels.forEach((wheel) => {
      const [wx, wy] = placeOnCar(pose, wheel);
      wheels.moveTo(wx + 3.2 * pose.size, wy);
      wheels.arc(wx, wy, 3.2 * pose.size, 0, Math.PI * 2);
      // A spoke that turns with the wheel, so it is seen to roll.
      const spin = seconds * 9 * pose.speed * pose.facing + order;
      wheelRims.moveTo(wx, wy);
      wheelRims.lineTo(
        wx + Math.cos(spin) * 2.6 * pose.size,
        wy + Math.sin(spin) * 2.6 * pose.size,
      );
      hubs.moveTo(wx + 1.1 * pose.size, wy);
      hubs.arc(wx, wy, 1.1 * pose.size, 0, Math.PI * 2);
    });
    const [hx, hy] = placeOnCar(sprung, [0, -6]);
    const haloR = pose.size * (14 + glow * 12 + thump * 8);
    halo.moveTo(hx + haloR, hy);
    halo.arc(hx, hy, haloR, 0, Math.PI * 2);
    // The beam: a cone from the nose, longer and brighter with the music.
    const reach = beamReach;
    const [nx, ny] = pose.type.lamp;
    const beam = new Path2D();
    polygon(beam, [
      placeOnCar(sprung, [nx, ny - 2]),
      placeOnCar(sprung, [nx + reach, ny - 2 - reach * 0.3]),
      placeOnCar(sprung, [nx + reach, ny + 3 + reach * 0.22]),
      placeOnCar(sprung, [nx, ny + 2]),
    ]);
    beams.push({
      path: beam,
      from: placeOnCar(sprung, [nx, ny]),
      to: placeOnCar(sprung, [nx + reach, ny]),
    });
    const [lx, ly] = placeOnCar(sprung, pose.type.lamp);
    lamps.moveTo(lx + 1.5 * pose.size, ly);
    lamps.arc(lx, ly, 1.5 * pose.size, 0, Math.PI * 2);
    const [tx, ty] = placeOnCar(sprung, pose.type.tail);
    tail.moveTo(tx + 1.3 * pose.size, ty);
    tail.arc(tx, ty, 1.3 * pose.size, 0, Math.PI * 2);
  });
  return { body, cabin, wheels, wheelRims, hubs, lamps, tail, halo, beams };
};
export type RoadLane = ReturnType<typeof createLanePaths>;

export const createRoadTripPaths = (
  state: RoadTrip,
  points: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  /**
   * The plot's true depth, for sizing what must not stretch. The points
   * and the top and bottom may be in a scaled space — see the canvas —
   * and a tree or a car sized from that would squash with the wave.
   */
  sizeHeight = bottom - top,
) => {
  const left = points[0]?.[0] ?? 0;
  const right = points[points.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  // The rolling landscape: the eased heights on the points' own x.
  const road: Projected[] = points.map(([x], index) => [
    x,
    state.hill[index] ?? bottom,
  ]);
  const range = farRange(road, top, bottom).map(([x, y]): Projected => [
    x,
    // The eased road is already compressed; undo half of that so the range
    // keeps its own, flatter, relation to the plot.
    top + (y - top) * 0.8,
  ]);
  const traffic = trafficPoses(road, seconds, left, width, sizeHeight);
  const size = vehicleSize(sizeHeight);
  const half = roadHalf(size);
  const thump = highBeam(state, seconds);
  // The far line drifts against the right-bound lane's lead vehicle.
  const lead = traffic.find((pose) => pose.facing > 0) ?? traffic[0];

  // The sky: stars that twinkle, and a moon.
  const stars = new Path2D();
  const brightStars = new Path2D();
  for (let star = 0; star < STARS; star += 1) {
    const x = left + noise(star * 3 + 1) * width;
    const y = top + noise(star * 3 + 2) * height * 0.28;
    const size = 0.6 + noise(star * 3 + 3) * 1;
    // Each star has its own twinkle rate; the phase is the clock.
    const twinkle = Math.sin(seconds * (1.5 + noise(star) * 3) + star) > 0.55;
    const target = twinkle ? brightStars : stars;
    target.moveTo(x + size, y);
    target.arc(x, y, size, 0, Math.PI * 2);
  }
  const moon = new Path2D();
  const moonX = left + width * 0.82;
  // Low enough that the fullscreen header never clips it.
  const moonY = top + height * 0.2;
  // The moon itself swells on a beat, a quarter larger at the hit.
  const moonR =
    Math.max(6, sizeHeight * 0.045) * (1 + thump * 0.25 + state.glow * 0.1);
  moon.moveTo(moonX + moonR, moonY);
  moon.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  const moonHalo = new Path2D();
  // The moon breathes with the level and throbs on the beat.
  const haloR = moonR * (1.8 + state.glow * 1.4 + thump * 1.2);
  moonHalo.moveTo(moonX + haloR, moonY);
  moonHalo.arc(moonX, moonY, haloR, 0, Math.PI * 2);

  // The hillside is the figure; the far range a dim silhouette behind it.
  const hill = new Path2D();
  const far = new Path2D();
  const asphalt = new Path2D();
  const edges = new Path2D();
  const dashes = new Path2D();
  if (road.length >= 2) {
    polygon(hill, [...road, [right, bottom], [left, bottom]]);
    polygon(far, [...range, [right, bottom], [left, bottom]]);
    polyline(asphalt, road);
    polyline(
      edges,
      road.map(([x, y]): Projected => [x, y - half]),
    );
    polyline(
      edges,
      road.map(([x, y]): Projected => [x, y + half]),
    );
    // Centre-line dashes between the lanes, sized with the road.
    const dash = 12 * size;
    for (let x = left + dash; x < right - dash; x += dash * 2.3) {
      dashes.moveTo(x, surfaceAt(road, x));
      dashes.lineTo(x + dash, surfaceAt(road, x + dash));
    }
  }

  // Grass on the verge: short strokes on the hillside below the road,
  // leaning the way the wind of the nearest vehicle blows.
  const tufts = new Path2D();
  if (road.length >= 2) {
    for (let tuft = 0; tuft < TUFTS; tuft += 1) {
      const x = left + noise(tuft * 5 + 7) * width;
      const below = half + 4 + noise(tuft * 5 + 8) * height * 0.3;
      const y = surfaceAt(road, x) + below;
      if (y < bottom - 2) {
        const blade = 2.5 + noise(tuft * 5 + 9) * 3.5;
        tufts.moveTo(x, y);
        tufts.lineTo(x - blade * 0.5, y - blade);
        tufts.moveTo(x, y);
        tufts.lineTo(x + blade * 0.6, y - blade * 1.2);
      }
    }
  }
  // Where the shading gradients run: from the highest ridge to the floor.
  const ridgeTop = road.reduce((min, [, y]) => Math.min(min, y), bottom);
  const rangeTop = range.reduce((min, [, y]) => Math.min(min, y), bottom);

  // Trees on the far ridge, drifting against the car: small and many,
  // each grown by the band under it.
  const farTrees = new Path2D();
  const drift = lead ? (lead.x - (left + width / 2)) * PARALLAX : 0;
  const farTall = sizeHeight * 0.07;
  if (range.length >= 2) {
    for (let slot = 0; slot * FAR_SPACING < width * 1.3; slot += 1) {
      const base =
        slot * FAR_SPACING + (noise(slot * 5 + 3) - 0.5) * FAR_SPACING;
      const x = left + ((((base - drift) % width) + width) % width);
      const grow = 1 + levelAt(points, x, top, bottom) * 0.3;
      tree(
        farTrees,
        x,
        surfaceAt(range, x) + 1,
        farTall * (0.6 + noise(slot * 11 + 4) * 0.7) * grow,
      );
    }
  }

  // Trees on the verge below the road, feet on the hillside, each dancing
  // to its own band. Seeded by slot, so the same road has the same trees.
  const near = new Path2D();
  const lit = new Path2D();
  const nearTall = sizeHeight * 0.13;
  const beamReach = 50 + state.glow * 120 + thump * 60;
  if (road.length >= 2) {
    for (let slot = 0; slot * NEAR_SPACING < width; slot += 1) {
      const jitter = (noise(slot * 7 + 1) - 0.5) * NEAR_SPACING * 0.5;
      const x = left + slot * NEAR_SPACING + NEAR_SPACING / 2 + jitter;
      if (x > left + 6 && x < right - 6) {
        const grow = 1 + levelAt(points, x, top, bottom) * 0.5;
        const tall = nearTall * (0.65 + noise(slot * 3 + 2) * 0.6) * grow;
        const ground = surfaceAt(road, x) + half + tall * 0.45;
        tree(near, x, ground, tall);
        // In a beam: ahead of a vehicle, the way it faces, within reach.
        const inBeam = traffic.some((pose) => {
          const ahead = (x - pose.x) * pose.facing;
          return ahead > 0 && ahead < beamReach * pose.size;
        });
        if (inBeam) {
          tree(lit, x, ground, tall);
        }
      }
    }
  }

  // Built per lane, because the far lane is painted before the verge
  // trees and dimmer, the near lane after them and at full strength.
  const lane = (facing: 1 | -1) =>
    createLanePaths(
      traffic.filter((pose) => pose.facing === facing),
      seconds,
      state.glow,
      thump,
      beamReach,
    );
  const farLane = lane(-1);
  const nearLane = lane(1);

  return {
    shape: hill,
    stars,
    brightStars,
    moon,
    moonHalo,
    moonCentre: [moonX, moonY, haloR] as const,
    far,
    farTrees,
    rangeTop,
    ridgeTop,
    tufts,
    asphalt,
    edges,
    dashes,
    near,
    lit,
    farLane,
    nearLane,
    half,
    traffic,
    thump,
  };
};

export type RoadTripPaths = ReturnType<typeof createRoadTripPaths>;
export type { ICarPose };
