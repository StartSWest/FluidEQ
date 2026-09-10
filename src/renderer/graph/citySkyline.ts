import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import type { ISkyFrame } from './terraceValley';

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

/** The city's own colours: concrete from the street up to the roofline. */
export const CITY_TOWER_COLOURS = ['#33465f', '#1b2637', '#0d131d'];
export const CITY_MOON = '#f3efd8';
export const CITY_WINDOW = '#ffdf9b';
export const CITY_BEACON = '#ff4d4d';

const STARS = 200;
/** How long a window stays on before the roster is redrawn, in seconds. */
const WINDOW_SHIFT = 3.5;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

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
  const moonX = left + span * 0.78;
  const moonY = frame.top + skyDepth * 0.18;
  const moonRadius = Math.min(sizeHeight * 0.052, frameWidth * 0.026);
  const craters = new Path2D();
  [
    [-0.32, -0.22, 0.2],
    [0.28, 0.26, 0.15],
    [0.22, -0.42, 0.11],
  ].forEach(([ox, oy, s]) => {
    const cx = moonX + ox * moonRadius;
    const cy = moonY + oy * moonRadius;
    craters.moveTo(cx + s * moonRadius, cy);
    craters.arc(cx, cy, s * moonRadius, 0, Math.PI * 2);
  });

  // Stars: the bright band twinkles with the treble, the faint one holds
  // the sky still.
  const stars: IBand[] = [
    { path: new Path2D(), alpha: 0.4 + state.treble * 0.5 },
    { path: new Path2D(), alpha: 0.2 },
  ];
  for (let i = 0; i < STARS; i += 1) {
    const sx = frame.left + noise(i * 2 + 1) * frameWidth;
    const sy = frame.top + noise(i * 2 + 2) * skyDepth * 0.8;
    const bright = noise(i * 7 + 3) > 0.72;
    const wink = bright ? 0.5 + 0.5 * Math.sin(seconds * 3 + i) : 1;
    const r = size * (bright ? 0.9 : 0.55) * wink;
    stars[bright ? 0 : 1].path.rect(sx - r, sy - r, r * 2, r * 2);
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
  const lit = new Path2D();
  const dim = new Path2D();
  const shift = Math.floor(seconds / WINDOW_SHIFT);
  const wake = state.thump * 0.25;
  columns.forEach(([x, y], index) => {
    const height = bottom - y;
    if (height < pitch * 1.6) {
      return;
    }
    const floors = Math.floor((height - pane) / pitch);
    const insetX = (width - (across * pane * 2 - pane)) / 2;
    for (let floor = 0; floor < floors; floor += 1) {
      const row = bottom - (floor + 1) * pitch;
      for (let column = 0; column < across; column += 1) {
        const wx = x - width / 2 + insetX + column * pane * 2;
        const seed = index * 977 + floor * 61 + column * 13;
        const roll = noise(seed + shift * 7);
        const target = roll < 0.34 + wake ? lit : dim;
        target.rect(wx, row, pane, pane * 1.35);
      }
    }
  });

  /**
   * The beacons: a red aircraft light on top of every mast, each on its
   * own period so they never blink together.
   *
   * The test for a mast is the silhouette's own — same seed, same
   * threshold, same length — so a beacon never floats over a flat roof.
   * See the skyline piece builder.
   */
  const beacons = new Path2D();
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
    const mastY = y - Math.max(4, width * 0.55) - r;
    beacons.moveTo(x + r, mastY);
    beacons.arc(x, mastY, r, 0, Math.PI * 2);
  });

  return {
    stars,
    craters,
    lit,
    dim,
    beacons,
    moonX,
    moonY,
    moonRadius,
    /** How far the city's glow reaches up from the foot of the block. */
    hazeHeight: depth * (0.06 + state.bass * 0.1),
    bass: state.bass,
    thump: state.thump,
  };
};

export type CitySkylinePaths = ReturnType<typeof createCitySkylinePaths>;
