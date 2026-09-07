import type { Projected } from './graphStyles';

/**
 * Road trip: the spectrum is a hillside with a road along its ridge, and a
 * car drives it.
 *
 * The hill is the spectrum smoothed hard — a car needs a road, not a ridge
 * of FFT bins — and compressed so there is sky above it for a far range
 * and ground below the road for the verge. The figure is the hillside,
 * shut against the floor; the asphalt is a stripe laid along its ridge.
 * Traffic runs both ways on an endless loop, several kinds of vehicle at
 * their own speeds, and never turns round. Everything is geometry from the clock and
 * the spectrum, so the same frame is the same picture.
 */

export interface ICarPose {
  x: number;
  y: number;
  /** Radians, clamped so the car never stands on its nose. */
  angle: number;
  /** +1 driving right, -1 driving left. */
  facing: 1 | -1;
  /** 0 at the turns, 1 at full cruise. */
  speed: number;
  /** Pixels per sprite unit; the sprite is drawn in a 34x18 box. */
  size: number;
}

/**
 * The asphalt's half-thickness: wide enough for two lanes at the vehicle
 * size, so the far lane can sit on the far edge and the near lane on the
 * near edge — which is the whole sense of depth a side-on road has.
 */
export const roadHalf = (size: number) => Math.max(5, 4.5 * size);
/** Lane placement across the band: the far lane up, the near lane down. */
export const FAR_LANE = -0.45;
export const NEAR_LANE = 0.45;
/** How much smaller the far lane's vehicles are drawn. */
export const FAR_LANE_SCALE = 0.72;

/** A wide local average: fourteen bins each side, weighted to the centre. */
export const smoothRoad = (points: readonly Projected[]): Projected[] =>
  points.map(([x], index) => {
    let sum = 0;
    let weight = 0;
    for (let offset = -14; offset <= 14; offset += 1) {
      const at = Math.max(0, Math.min(points.length - 1, index + offset));
      const mix = 15 - Math.abs(offset);
      sum += points[at][1] * mix;
      weight += mix;
    }
    return [x, sum / weight];
  });

/** The ridge the road runs along: 24% of the plot down, 60% of its swing. */
export const roadSurface = (
  points: readonly Projected[],
  top: number,
  bottom: number,
): Projected[] => {
  const height = Math.max(1, bottom - top);
  return smoothRoad(points).map(([x, y]) => [
    x,
    top + height * 0.24 + (y - top) * 0.6,
  ]);
};

/** A far range behind the hill: higher, flatter, the same music. */
export const farRange = (
  points: readonly Projected[],
  top: number,
  bottom: number,
): Projected[] => {
  const height = Math.max(1, bottom - top);
  return smoothRoad(points).map(([x, y]) => [
    x,
    top + height * 0.3 + (y - top) * 0.3,
  ]);
};

/** The y of a surface at `x`, by linear interpolation. */
export const surfaceAt = (surface: readonly Projected[], x: number) => {
  const left = surface[0][0];
  const step = (surface[surface.length - 1][0] - left) / (surface.length - 1);
  const at = Math.max(0, Math.min(surface.length - 1.001, (x - left) / step));
  const index = Math.floor(at);
  const mix = at - index;
  return surface[index][1] + (surface[index + 1][1] - surface[index][1]) * mix;
};

/** A vehicle type: body and cabin outlines in sprite units, nose right. */
export interface IVehicleType {
  body: Projected[];
  cabin: Projected[];
  wheels: Projected[];
  /** Where the headlight and tail light sit, in sprite units. */
  lamp: Projected;
  tail: Projected;
  /** Sprite units from nose to tail, for spacing traffic. */
  length: number;
}

const SEDAN: IVehicleType = {
  body: [
    [-16, 0],
    [-16, -5],
    [-13, -6],
    [-9, -7],
    [-5, -12],
    [7, -12],
    [12, -7],
    [16, -6],
    [17, -3],
    [17, 0],
  ],
  cabin: [
    [-3, -11],
    [-6, -7],
    [9, -7],
    [6, -11],
  ],
  wheels: [
    [-9, 0],
    [10, 0],
  ],
  lamp: [16.5, -4],
  tail: [-16, -3.5],
  length: 34,
};

const PICKUP: IVehicleType = {
  body: [
    [-19, 0],
    [-19, -8],
    [-3, -8],
    [-3, -13],
    [8, -13],
    [12, -8],
    [17, -7],
    [18, -3],
    [18, 0],
  ],
  cabin: [
    [-1, -12],
    [-1, -8],
    [10, -8],
    [7, -12],
  ],
  wheels: [
    [-12, 0],
    [11, 0],
  ],
  lamp: [17.5, -4.5],
  tail: [-19, -5],
  length: 38,
};

const VAN: IVehicleType = {
  body: [
    [-20, 0],
    [-20, -14],
    [9, -14],
    [15, -9],
    [19, -5],
    [19, 0],
  ],
  cabin: [
    [10, -13],
    [10, -8],
    [17, -8],
    [14, -12],
  ],
  wheels: [
    [-13, 0],
    [12, 0],
  ],
  lamp: [18.5, -4],
  tail: [-20, -6],
  length: 40,
};

const SPORTS: IVehicleType = {
  body: [
    [-17, 0],
    [-17, -4],
    [-12, -5],
    [-8, -9],
    [4, -9],
    [11, -5],
    [17, -4],
    [18, -2],
    [18, 0],
  ],
  cabin: [
    [-5, -8],
    [-8, -5],
    [8, -5],
    [4, -8],
  ],
  wheels: [
    [-10, 0],
    [11, 0],
  ],
  lamp: [17.5, -3],
  tail: [-17, -2.5],
  length: 36,
};

export const VEHICLE_TYPES = { SEDAN, PICKUP, VAN, SPORTS };

export interface IVehicle {
  type: IVehicleType;
  /** +1 driving right, -1 driving left. */
  facing: 1 | -1;
  /** Fraction of the base cruising speed. */
  speed: number;
  /** Where it started, as a fraction of the loop. */
  offset: number;
}

/**
 * The traffic: two lanes, one each way, on an endless loop. A vehicle that
 * leaves one edge comes back at the other, so nobody ever turns round.
 * Different speeds so they pass one another and the picture never repeats
 * in a hurry.
 */
export const TRAFFIC: IVehicle[] = [
  { type: SEDAN, facing: 1, speed: 1, offset: 0.1 },
  { type: VAN, facing: 1, speed: 0.72, offset: 0.55 },
  { type: SPORTS, facing: -1, speed: 1.3, offset: 0.3 },
  { type: PICKUP, facing: -1, speed: 0.85, offset: 0.8 },
  { type: SEDAN, facing: -1, speed: 0.95, offset: 0.05 },
];

/**
 * Sprite pixels per unit, from the plot's HEIGHT like the trees, so a
 * vehicle keeps its proportion to them from the titlebar to fullscreen.
 */
export const vehicleSize = (height: number) =>
  Math.min(3.2, Math.max(0.7, height / 230));

/** The base cruise: the plot's width in eight seconds of music-pace clock. */
const CRUISE_SECONDS = 8;

export interface IVehiclePose extends ICarPose {
  type: IVehicleType;
}

/** Where every vehicle is at this moment, by lane: left-bound first. */
export const trafficPoses = (
  road: readonly Projected[],
  seconds: number,
  left: number,
  width: number,
  height: number,
): IVehiclePose[] => {
  if (road.length < 2) {
    return [];
  }
  const size = vehicleSize(height);
  const half = roadHalf(size);
  // The loop is the plot plus a vehicle's length each side, so a vehicle
  // is fully off screen before it reappears at the other edge.
  const margin = 44 * size;
  const loop = width + margin * 2;
  return TRAFFIC.map((vehicle) => {
    const travelled =
      ((vehicle.offset + (seconds / CRUISE_SECONDS) * vehicle.speed) % 1) *
      loop;
    const x =
      vehicle.facing > 0
        ? left - margin + travelled
        : left + width + margin - travelled;
    const step = (road[road.length - 1][0] - road[0][0]) / (road.length - 1);
    const at = Math.max(
      0,
      Math.min(road.length - 1.001, (x - road[0][0]) / step),
    );
    const index = Math.floor(at);
    const from = road[index];
    const to = road[index + 1];
    const mix = at - index;
    const angle = Math.max(
      -0.45,
      Math.min(0.45, Math.atan2(to[1] - from[1], to[0] - from[0])),
    );
    // Left-bound is the far lane: up the band, smaller. Right-bound is
    // the near lane: down the band, full size.
    const lane = vehicle.facing > 0 ? NEAR_LANE : FAR_LANE;
    return {
      type: vehicle.type,
      x,
      y: from[1] + (to[1] - from[1]) * mix + half * lane,
      angle,
      facing: vehicle.facing,
      speed: vehicle.speed,
      size: vehicle.facing > 0 ? size : size * FAR_LANE_SCALE,
    };
  }).sort((a, b) => a.facing - b.facing);
};

/** A sprite point placed on the road: rotated, scaled, flipped. */
export const placeOnCar = (pose: ICarPose, [dx, dy]: Projected): Projected => {
  const fx = dx * pose.facing;
  return [
    pose.x +
      pose.size * (fx * Math.cos(pose.angle) - dy * Math.sin(pose.angle)),
    pose.y +
      pose.size * (fx * Math.sin(pose.angle) + dy * Math.cos(pose.angle)),
  ];
};

const point = ([x, y]: Projected) => `${x.toFixed(1)},${y.toFixed(1)}`;
const polygon = (vertices: readonly Projected[]) =>
  `M ${vertices.map(point).join(' L ')} Z`;

/** The hillside shut against the floor, and a still car, for the figure. */
const createGraphRoad = (
  points: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
): string => {
  if (points.length < 2) {
    return '';
  }
  const road = roadSurface(points, top, bottom);
  let path = polygon([
    ...road,
    [road[road.length - 1][0], bottom],
    [road[0][0], bottom],
  ]);
  trafficPoses(
    road,
    seconds,
    points[0][0],
    points[points.length - 1][0] - points[0][0],
    bottom - top,
  ).forEach((pose) => {
    path += ` ${polygon(pose.type.body.map((p) => placeOnCar(pose, p)))}`;
  });
  return path;
};

export default createGraphRoad;
