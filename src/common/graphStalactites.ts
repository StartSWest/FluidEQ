import type { Projected } from './graphStyles';

/**
 * Stalactites: the spectrum hung from the ceiling as calcite, each column a
 * pendant of rock as long as its band is loud.
 *
 * Every shape here is a pure function of the column and its length: no
 * random geometry and no new noise on an audio frame, so a stalactite keeps
 * its knobs and its lean from one frame to the next and only grows or
 * shrinks. Real ones are not cones: calcite builds in bands, so the flank
 * swells and narrows on the way down, the whole thing leans a little, and
 * the tip is a rounded bulb where the drip forms rather than a needle.
 */

/** Stable per-column noise in [0, 1). */
const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * The profile levels from the ceiling (0) to the tip (1), packed toward the
 * tip where the taper turns fastest; a straight cut there read as a spike.
 */
const LEVELS = [
  0, 0.06, 0.14, 0.24, 0.36, 0.5, 0.64, 0.76, 0.86, 0.93, 0.975, 1,
];

export interface IStalactite {
  column: number;
  /** The outline: down the left flank to the tip and back up the right. */
  outline: Projected[];
  /** The tip, where a drip forms and falls from. */
  tip: Projected;
  /** The flank away from the light: a polygon from the ridge to the right edge. */
  shade: Projected[];
  /** The wet highlight running down the lit flank. */
  light: Projected[];
  length: number;
}

const stalactiteAt = (
  column: number,
  x: number,
  top: number,
  length: number,
  width: number,
): IStalactite => {
  const seed = column * 1.618 + 0.37;
  const lean = (noise(seed) - 0.5) * width * 0.35;
  const left: Projected[] = [];
  const right: Projected[] = [];
  const ridge: Projected[] = [];
  const litOuter: Projected[] = [];
  const litInner: Projected[] = [];
  LEVELS.forEach((t) => {
    const centre = x + lean * t * t;
    const taper = (1 - t) ** 0.65;
    // Two slow bulges down the length, the way calcite builds in bands, and
    // a rounded bulb at the tip.
    const knob =
      1 +
      0.16 * Math.sin(t * 7.3 + seed * 2.1) +
      0.09 * Math.sin(t * 19 + seed * 5.7);
    let half = width * 0.5 * taper * knob;
    if (t >= 0.975 && t < 1) {
      half = Math.max(half, width * 0.07);
    }
    if (t >= 1) {
      half = 0;
    }
    const asym = 0.12 * Math.sin(seed * 4.7 + t * 3);
    const row = top + length * t;
    left.push([centre - half * (1 + asym), row]);
    right.push([centre + half * (1 - asym), row]);
    ridge.push([centre - half * 0.1, row]);
    if (t <= 0.9) {
      litOuter.push([centre - half * 0.6, row]);
      litInner.push([centre - half * 0.38, row]);
    }
  });
  const tipCentre = x + lean;
  return {
    column,
    outline: [...left, ...right.slice().reverse()],
    tip: [tipCentre, top + length],
    shade: [...ridge, ...right.slice().reverse()],
    light: [...litOuter, ...litInner.slice().reverse()],
    length,
  };
};

/**
 * One stalactite per column that has any length: the column's level from
 * `floor` up is its length down from `top`. Columns at the floor are bare
 * ceiling.
 */
export const stalactiteProfiles = (
  points: readonly Projected[],
  floor: number,
  top: number,
  gap: number,
): IStalactite[] => {
  const spacing =
    points.length > 1
      ? (points[points.length - 1][0] - points[0][0]) / (points.length - 1)
      : 1;
  const width = Math.max(2, spacing * (1 - gap));
  const profiles: IStalactite[] = [];
  points.forEach(([x, y], index) => {
    const length = Math.max(0, Math.min(floor - top, floor - y));
    if (length >= 1) {
      profiles.push(stalactiteAt(index, x, top, length, width));
    }
  });
  return profiles;
};

const polygon = (vertices: readonly Projected[]) =>
  `${vertices
    .map(
      ([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(1)},${y.toFixed(1)}`,
    )
    .join(' ')} Z`;

/** The same rock as SVG path strings, for the picker's still preview. */
const createGraphStalactites = (
  points: readonly Projected[],
  baseline: number,
  top: number,
  gap: number,
) => {
  let shape = '';
  let shade = '';
  let light = '';
  stalactiteProfiles(points, baseline, top, gap).forEach((profile) => {
    shape += polygon(profile.outline);
    shade += polygon(profile.shade);
    light += polygon(profile.light);
  });
  return { shape, shade, light };
};

export default createGraphStalactites;
