import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import noise from 'common/seededNoise';
import type { ISkyFrame } from './skyFrame';
import { DAY_SUN } from './nightSurfaces';
import { floorLifted } from '../utils/windowInk';
import { parseCssColour } from '../utils/oklab';
import { isLightWindow } from '../utils/windowSide';

/**
 * The night city around the Skyline form. The towers are the figure; this
 * is the light in them and the sky over them.
 *
 * Nothing is painted for the sky, so whatever is behind the graph — a video
 * playing under the window — shows straight through. Over it: a field of
 * stars that twinkle with the treble, a moon with a halo that breathes with
 * the bass, and the city itself.
 *
 * Every tower carries a grid of windows. Most are dark, a slow subset is
 * lit, and a beat turns a scatter of new ones on for a moment — a building
 * waking up rather than a bar changing colour. The tall ones carry a red
 * aircraft beacon on the mast, each blinking on its own period, and a haze
 * of city light sits along the foot of the block and brightens with the
 * bass.
 *
 * Built in scene space, so the moon is a circle and a window is a window at
 * every height setting; it is the COUNT of floors that answers the slider.
 */

export interface CitySkyline {
  mean: number;
  trebleLevel: number;
  treble: number;
  bass: number;
  thump: number;
  clock: number;
}

/**
 * The city's own colours, concrete from the street up to the roofline: the
 * window's floor lifted in lightness, a little at the street and more at the
 * roofs the moon catches, so the towers stand out of whatever background the
 * theme or a visualizer gives the window. They were fixed navies fading to
 * near-black at the roofline, and on the slate floor the towers sank into it
 * (Ivan, 2026-09-28: "skyline building too dark make it more visible").
 */
const TOWER_LIFTS = [0.07, 0.11, 0.16];

/**
 * The same concrete on a light window, where lifting the floor made white
 * towers on a white floor (1.1:1, 2026-11-19 scan): the floor taken DOWN,
 * most at the street and least at the sunlit roofs, which puts the towers
 * at 2.4-3.9:1 on white and the lit windows still clear of them.
 */
const DAY_TOWER_LIFTS = [-0.38, -0.32, -0.26];

export const cityTowerColours = (): readonly string[] =>
  floorLifted(isLightWindow() ? DAY_TOWER_LIFTS : TOWER_LIFTS);

/**
 * How far each tower's outline takes its own colour toward white on a dark
 * window and toward black on a light one (Ivan, 2026-11-27: "make Skyline
 * have borders on those buildings so it is more noticeable"). A tone of the
 * tower, never a fixed ink, so the outline wears whatever the tower wears —
 * the window's concrete, a palette's ramp, a tower's own heat colour. Mixed
 * in the same gamma-encoded channels on the page and in the engine's
 * `skylineLook.ts`, which reads these numbers, so the two draw one edge.
 */
export const TOWER_EDGE_NIGHT = 0.5;
export const TOWER_EDGE_DAY = 0.5;

/**
 * The outline's width, in device pixels: a hairline just inside each block's
 * edge, as sharp as the edge itself at any display scale.
 */
export const TOWER_EDGE_PIXELS = 1;

/**
 * The narrowest block that takes an outline, in CSS pixels: a mast is a
 * pixel or two across, and outlined it turned into a hollow tube.
 */
export const TOWER_EDGE_MIN_WIDTH = 3;

/** A tower colour as its outline paints it. */
export const towerEdgeInk = (colour: string): string => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    return colour;
  }
  const [toward, amount] = isLightWindow()
    ? [0, TOWER_EDGE_DAY]
    : [1, TOWER_EDGE_NIGHT];
  const [red, green, blue] = parsed.rgb.map((channel) =>
    Math.round((channel + (toward - channel) * amount) * 255),
  );
  return `rgba(${red}, ${green}, ${blue}, ${parsed.alpha})`;
};
export const CITY_MOON = '#f3efd8';
export const CITY_WINDOW = '#ffdf9b';
export const CITY_BEACON = '#ff4d4d';

const STARS = 200;
/** How long a window stays on before the roster is redrawn, in seconds. */
const WINDOW_SHIFT = 3.5;

export const createCitySkyline = (): CitySkyline => ({
  mean: 0,
  trebleLevel: 0,
  treble: 0,
  bass: 0,
  thump: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

export const advanceCitySkyline = (
  state: CitySkyline,
  columns: readonly Projected[],
  live: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
) => {
  if (columns.length < 2) {
    return;
  }
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;
  if (!playing) {
    return;
  }
  state.clock = seconds;
  const levels = live.map(([, y]) => levelOf(y, top, bottom));
  const mean =
    levels.reduce((sum, v) => sum + v, 0) / Math.max(1, levels.length);
  const crack = mean - state.mean;
  state.mean = mean;
  const bassTo = Math.max(1, Math.floor(levels.length * 0.3));
  const bass = levels.slice(0, bassTo).reduce((s, v) => s + v, 0) / bassTo;
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  const trebleFrom = Math.floor(levels.length * 0.6);
  const treble =
    levels.slice(trebleFrom).reduce((s, v) => s + v, 0) /
    Math.max(1, levels.length - trebleFrom);
  state.treble += (treble - state.treble) * getEaseFactor(elapsedMs, 40);
  if (crack >= 0.05 && mean >= 0.15) {
    state.thump = 1;
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 200);
  }
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);
};

export interface IBand {
  path: Path2D;
  alpha: number;
}

/**
 * How each part of the city is painted — its colour, how solid — by the
 * page's canvas and the engine's skyline alike.
 */
export const CITY_INKS = {
  star: '#fff',
  moon: { colour: CITY_MOON, alpha: 0.96 },
  crater: { colour: '#7d7a8c', alpha: 0.22 },
  /** The haze's colour, and how solid it is at the foot of the block. */
  haze: { rgb: [255, 196, 120] as const, alpha: 0.22 },
  dim: { colour: '#000', alpha: 0.35 },
  lit: CITY_WINDOW,
  beacon: { colour: CITY_BEACON, alpha: 0.9 },
};

/**
 * The city by day, on a light window: no stars, the sun where the moon
 * stood (`DAY_SUN`, and its warmth for a halo in `nightSurfaces.ts`), no
 * craters on it. The rest — the haze, the windows, the beacons — read on the
 * day towers as they are.
 */
export const CITY_DAY_INKS: typeof CITY_INKS = {
  ...CITY_INKS,
  moon: { colour: DAY_SUN, alpha: 0.96 },
  crater: { colour: CITY_INKS.crater.colour, alpha: 0 },
};

/** The city's inks for the window's side. */
export const cityInks = (): typeof CITY_INKS =>
  isLightWindow() ? CITY_DAY_INKS : CITY_INKS;

/** One tower's windows: its middle, and each floor's lit panes as bits. */
export interface ICityTower {
  x: number;
  floors: number[];
}

/**
 * The city as it stands this frame, in numbers: the moon and its craters,
 * the stars, every tower's windows, the beacons and the haze. What the
 * page's canvas and the engine's skyline
 * (`engineLooks/designed/skylineLook.ts`) both draw from.
 */
export const citySkylineLayout = (
  state: CitySkyline,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  sizeHeight: number,
  gap: number,
  frame: ISkyFrame,
) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const span = Math.max(1, right - left);
  const depth = Math.max(1, bottom - top);
  const step = span / Math.max(1, columns.length - 1);
  const width = Math.max(1, step * (1 - Math.max(0, Math.min(0.85, gap))));
  const size = Math.max(0.7, Math.min(3.2, sizeHeight / 230));
  const frameWidth = Math.max(1, frame.right - frame.left);
  const skyDepth = Math.max(1, bottom - frame.top);

  // The moon, sized from the true plot depth so the height slider neither
  // grows nor shrinks it, and clear of the tallest tower.
  const moon = {
    x: left + span * 0.78,
    y: frame.top + skyDepth * 0.18,
    r: Math.min(sizeHeight * 0.052, frameWidth * 0.026),
  };
  const craters = [
    [-0.32, -0.22, 0.2],
    [0.28, 0.26, 0.15],
    [0.22, -0.42, 0.11],
  ].map(([ox, oy, s]) => ({
    x: moon.x + ox * moon.r,
    y: moon.y + oy * moon.r,
    r: s * moon.r,
  }));

  // Stars: the bright band twinkles with the treble, the faint one holds
  // the sky still.
  const stars: { x: number; y: number; r: number; bright: boolean }[] = [];
  for (let i = 0; i < STARS; i += 1) {
    const bright = noise(i * 7 + 3) > 0.72;
    const wink = bright ? 0.5 + 0.5 * Math.sin(seconds * 3 + i) : 1;
    stars.push({
      x: frame.left + noise(i * 2 + 1) * frameWidth,
      y: frame.top + noise(i * 2 + 2) * skyDepth * 0.8,
      r: size * (bright ? 0.9 : 0.55) * wink,
      bright,
    });
  }

  /**
   * The windows.
   *
   * A grid measured off the tower's own width — three panes across, a
   * floor every two and a half panes — so a window keeps its size at
   * every wave height and a shorter tower simply has fewer floors. Which
   * ones are lit comes from stable noise plus a slow shift, so the city
   * changes without flickering; a beat lowers the threshold and a scatter
   * of extra rooms come on for as long as the thump lasts.
   */
  const pane = Math.max(1.2, width * 0.15);
  const across = Math.max(1, Math.floor(width / (pane * 2.1)));
  const pitch = pane * 2.5;
  const insetX = (width - (across * pane * 2 - pane)) / 2;
  const shift = Math.floor(seconds / WINDOW_SHIFT);
  const wake = state.thump * 0.25;
  const towers: ICityTower[] = columns.map(([x, y], index) => {
    const height = bottom - y;
    if (height < pitch * 1.6) {
      return { x, floors: [] };
    }
    const floors: number[] = [];
    const count = Math.floor((height - pane) / pitch);
    for (let floor = 0; floor < count; floor += 1) {
      let lit = 0;
      for (let column = 0; column < across; column += 1) {
        const seed = index * 977 + floor * 61 + column * 13;
        if (noise(seed + shift * 7) < 0.34 + wake) {
          lit += 2 ** column;
        }
      }
      floors.push(lit);
    }
    return { x, floors };
  });

  /**
   * The beacons: a red aircraft light on top of every mast, each on its
   * own period so they never blink together.
   *
   * The test for a mast is the silhouette's own — same seed, same
   * threshold, same length — so a beacon never floats over a flat roof.
   * See the skyline piece builder.
   */
  const beacons: { x: number; y: number; r: number }[] = [];
  columns.forEach(([x, y], index) => {
    const height = bottom - y;
    if (noise(index * 41 + 7) <= 0.72 || height <= depth * 0.35) {
      return;
    }
    const period = 1.4 + noise(index * 31) * 1.2;
    if ((seconds % period) / period > 0.32) {
      return;
    }
    const r = size * 1.5;
    beacons.push({ x, y: y - Math.max(4, width * 0.55) - r, r });
  });

  return {
    moon,
    craters,
    stars,
    starAlphas: [0.4 + state.treble * 0.5, 0.2] as const,
    /** The moon's halo breathes with the bass. */
    haloAlpha: 0.4 + state.bass * 0.5,
    windows: { width, pane, across, pitch, insetX, towers },
    litAlpha: 0.75 + state.thump * 0.25,
    beacons,
    /** How far the city's glow reaches up from the foot of the block. */
    hazeHeight: depth * (0.06 + state.bass * 0.1),
    hazeAlpha: 0.35 + state.bass * 0.5,
    bass: state.bass,
    thump: state.thump,
  };
};

export type CitySkylineLayout = ReturnType<typeof citySkylineLayout>;

export const createCitySkylinePaths = (
  state: CitySkyline,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  sizeHeight: number,
  gap: number,
  frame: ISkyFrame,
) => {
  const layout = citySkylineLayout(
    state,
    columns,
    top,
    bottom,
    seconds,
    sizeHeight,
    gap,
    frame,
  );
  const craters = new Path2D();
  layout.craters.forEach(({ x, y, r }) => {
    craters.moveTo(x + r, y);
    craters.arc(x, y, r, 0, Math.PI * 2);
  });
  const stars: IBand[] = layout.starAlphas.map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  layout.stars.forEach(({ x, y, r, bright }) => {
    stars[bright ? 0 : 1].path.rect(x - r, y - r, r * 2, r * 2);
  });

  const { width, pane, across, pitch, insetX } = layout.windows;
  const lit = new Path2D();
  const dim = new Path2D();
  layout.windows.towers.forEach(({ x, floors }) => {
    floors.forEach((mask, floor) => {
      const row = bottom - (floor + 1) * pitch;
      for (let column = 0; column < across; column += 1) {
        const wx = x - width / 2 + insetX + column * pane * 2;
        const target = Math.floor(mask / 2 ** column) % 2 === 1 ? lit : dim;
        target.rect(wx, row, pane, pane * 1.35);
      }
    });
  });

  const beacons = new Path2D();
  layout.beacons.forEach(({ x, y, r }) => {
    beacons.moveTo(x + r, y);
    beacons.arc(x, y, r, 0, Math.PI * 2);
  });

  return {
    stars,
    craters,
    lit,
    dim,
    beacons,
    moonX: layout.moon.x,
    moonY: layout.moon.y,
    moonRadius: layout.moon.r,
    hazeHeight: layout.hazeHeight,
    bass: layout.bass,
    thump: layout.thump,
    layout,
  };
};

export type CitySkylinePaths = ReturnType<typeof createCitySkylinePaths>;
