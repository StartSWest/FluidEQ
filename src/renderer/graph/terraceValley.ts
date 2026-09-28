import { TERRACE_TIER_FRACTIONS } from 'common/graphTerrace';
import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

/**
 * The valley round the Terrace form, at night. The tiers and the jumper
 * are as they were; this is what stands behind, between and on them.
 *
 * Night, and NOTHING PAINTED FOR THE SKY: a field of stars that twinkle
 * on the treble, a moon whose halo breathes with the bass and a few
 * clouds drifting on the clock, all over whatever is behind the graph —
 * a video playing under the window shows straight through. Mist lies in
 * two bands between the tiers, thicker when the music is quiet and
 * burning off as it gets loud.
 *
 * All of it covers the whole window rather than the plot, because the
 * height slider moves the tiers and nothing else.
 *
 * The tiers are paddies: every shelf has a retaining wall under its rim,
 * the rim catches the moon, and the water on the flats glints — short
 * flashes that run along the flats on the clock and brighten on the beat.
 * Fireflies rise off the tiers on treble cracks; a big hit sends a flight
 * of night birds across the moon.
 *
 * Everything is built in scene space — the wave's vertical stretch undone
 * — so the moon is a circle at every height setting and never an oval.
 */

interface IFirefly {
  x: number;
  y: number;
  bornAt: number;
  seed: number;
}

export interface TerraceValley {
  fireflies: IFirefly[];
  birdsAt: number;
  mean: number;
  trebleLevel: number;
  bass: number;
  thump: number;
  treble: number;
  clock: number;
}

/** The valley's own colours. There is no sky: see the note above. */
export const TERRACE_MOON = '#f3efd8';
export const TERRACE_CLOUD = '#b9c6e8';
export const TERRACE_FIREFLY = '#d9ff6e';

/**
 * How each part of the valley is painted — its colour, how solid, how
 * wide — by the page's canvas and the engine's terrace alike.
 */
export const VALLEY_INKS = {
  star: '#fff',
  moon: { colour: TERRACE_MOON, alpha: 0.96 },
  crater: { colour: '#7d7a8c', alpha: 0.22 },
  // Light, not dark: with no sky behind them the clouds have to stand
  // against whatever is there.
  cloud: { colour: TERRACE_CLOUD, alpha: 0.22 },
  // A retaining wall in shadow under every shelf, and the rim above it
  // catching the moon — brighter on the beat.
  wall: { colour: '#000', alpha: 0.38 },
  rim: { colour: TERRACE_MOON, width: 1 },
  glint: { colour: '#fff', width: 1 },
  // Lit and dim, winking on their own phase.
  firefly: { colour: TERRACE_FIREFLY, alphas: [0.95, 0.4] },
  bird: { colour: '#10131f', width: 1.4, alpha: 0.9 },
};

/** A shelf's edge: the skyline's bright and heavy, the lower ones faint. */
export const terraceEdgeStroke = (index: number) =>
  index === 0 ? { alpha: 0.85, width: 1.6 } : { alpha: 0.3, width: 1 };

export const FIREFLY_LIFE = 2.2;
export const BIRDS_CROSSING = 7;
const FIREFLY_LIMIT = 40;
const STARS = 220;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createTerraceValley = (): TerraceValley => ({
  fireflies: [],
  birdsAt: -1,
  mean: 0,
  trebleLevel: 0,
  bass: 0,
  thump: 0,
  treble: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

export const advanceTerraceValley = (
  state: TerraceValley,
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
  const depth = Math.max(1, bottom - top);
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
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }
  const trebleCrack = treble - state.trebleLevel;
  const relative = trebleCrack / Math.max(0.03, state.trebleLevel);
  if (trebleCrack >= 0.02 && relative >= 0.35) {
    const burst = Math.min(4, FIREFLY_LIMIT - state.fireflies.length);
    for (let i = 0; i < burst; i += 1) {
      const seed = Math.floor(seconds * 19) * 5 + i;
      const column = Math.floor(noise(seed) * columns.length);
      const [x, y] = columns[column];
      state.fireflies.push({
        x,
        y: Math.max(top, y) - depth * 0.02,
        bornAt: seconds,
        seed,
      });
    }
  }
  state.fireflies = state.fireflies.filter((fly) => {
    fly.x += Math.sin(seconds * 2 + fly.seed) * dt * depth * 0.05;
    fly.y -= dt * depth * 0.03;
    return seconds - fly.bornAt < FIREFLY_LIFE;
  });
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);
  if (crack >= 0.1 && mean >= 0.5 && seconds - state.birdsAt > BIRDS_CROSSING) {
    state.birdsAt = seconds;
  }
};

export interface IBand {
  path: Path2D;
  alpha: number;
}

/** The sky's box in scene space: the whole screen, not the plot. */
export interface ISkyFrame {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A circle of the night: a crater, a puff of cloud. */
export interface INightCircle {
  x: number;
  y: number;
  r: number;
}

/** A star, a firefly: where it is, how big, and which of two bands. */
export interface INightSpeck {
  x: number;
  y: number;
  r: number;
  bright: boolean;
}

/**
 * The valley as it stands this frame, in numbers: the moon and its
 * craters, the stars, the clouds, where each column's walls stand, the
 * glints on the flats, the fireflies and the birds. What the page's canvas
 * and the engine's terrace (`engineLooks/designed/terraceLook.ts`) both
 * draw from.
 */
export const terraceValleyLayout = (
  state: TerraceValley,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  sizeHeight: number,
  frame: ISkyFrame,
) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const depth = Math.max(1, bottom - top);
  const step = width / Math.max(1, columns.length - 1);
  const half = step / 2;
  const size = Math.max(0.7, Math.min(3.2, sizeHeight / 230));
  const frameWidth = Math.max(1, frame.right - frame.left);
  const skyDepth = Math.max(1, bottom - frame.top);

  // The moon, high on the right, sized from the TRUE plot depth
  // (sizeHeight) — `depth` here is the rendered one, which the height
  // slider shrinks, and the moon must not shrink with the tiers.
  const moon = {
    x: left + width * 0.74,
    y: frame.top + skyDepth * 0.2,
    r: Math.min(sizeHeight * 0.052, frameWidth * 0.026),
  };
  const craters: INightCircle[] = [
    [-0.35, -0.2, 0.22],
    [0.25, 0.3, 0.16],
    [0.3, -0.4, 0.12],
  ].map(([ox, oy, s]) => ({
    x: moon.x + ox * moon.r,
    y: moon.y + oy * moon.r,
    r: s * moon.r,
  }));

  // The stars: two bands, so the bright ones twinkle on the treble while
  // the faint ones only hold the sky. Laid out from noise over the whole
  // sky; the ones off screen cost a rect each and nothing to paint.
  const stars: INightSpeck[] = [];
  for (let i = 0; i < STARS; i += 1) {
    const bright = noise(i * 7 + 3) > 0.7;
    const wink = bright ? 0.5 + 0.5 * Math.sin(seconds * 3 + i) : 1;
    stars.push({
      x: frame.left + noise(i * 2 + 1) * frameWidth,
      y: frame.top + noise(i * 2 + 2) * skyDepth * 0.85,
      r: size * (bright ? 0.9 : 0.55) * wink,
      bright,
    });
  }

  // The clouds, dark against the sky.
  const clouds: INightCircle[] = [];
  for (let c = 0; c < 3; c += 1) {
    const drift =
      ((seconds * 0.008 * (1 + c * 0.4) + noise(c * 7)) % 1.3) - 0.15;
    const cx = frame.left + frameWidth * drift;
    const cy = frame.top + skyDepth * (0.1 + noise(c * 3) * 0.2);
    const r = size * (9 + noise(c * 5) * 10);
    [
      [0, 0, 1],
      [-0.8, 0.15, 0.7],
      [0.85, 0.2, 0.75],
      [0.2, -0.35, 0.65],
    ].forEach(([ox, oy, s]) => {
      clouds.push({ x: cx + ox * r, y: cy + oy * r, r: r * s });
    });
  }

  // The walls: under every shelf of every tier a retaining wall — a dark
  // band a few percent of the plot tall — with its top at the shelf's rim.
  // Only where the shelf has the height to stand on. Sized from the true
  // depth like the moon: a wall is a wall whatever the slider says, and a
  // shelf too low to hold one simply has none.
  const wallHeight = sizeHeight * 0.028;
  const walls = columns.map(([, y]) =>
    TERRACE_TIER_FRACTIONS.map((fraction) => (bottom - y) * fraction)
      .filter((rise) => rise >= wallHeight)
      .map((rise) => bottom - rise),
  );

  // The paddies' glints: on the top tier's flats, a short flash per column
  // that slides along the flat on the clock, only where the tier has any
  // height.
  const glints = columns.map(([x, y], index) => {
    if (bottom - y < depth * 0.04) {
      return undefined;
    }
    const along = (seconds * 0.35 + noise(index * 3)) % 1;
    return {
      x: x - half + step * 0.15 + step * 0.7 * along,
      y: y + size,
      length: step * 0.18,
    };
  });

  // The fireflies, two bands: lit and dim, winking on their own phase.
  const fireflies: INightSpeck[] = state.fireflies.map((fly) => {
    const age = (seconds - fly.bornAt) / FIREFLY_LIFE;
    return {
      x: fly.x,
      y: fly.y,
      r: size * (0.8 + (1 - age) * 0.8),
      bright: Math.sin(seconds * 8 + fly.seed) > 0,
    };
  });

  // The birds, crossing at the moon's height: a wing, the body, a wing.
  const birds: Projected[][] = [];
  const flight = seconds - state.birdsAt;
  if (state.birdsAt >= 0 && flight < BIRDS_CROSSING) {
    const bx = left - width * 0.2 + (flight / BIRDS_CROSSING) * width * 1.4;
    const by = moon.y;
    for (let i = 0; i < 5; i += 1) {
      const ox = bx - Math.abs(i - 2) * size * 9;
      const oy =
        by + Math.abs(i - 2) * size * 4 + Math.sin(seconds * 5 + i) * size;
      const flap = Math.sin(seconds * 9 + i) * size * 2;
      birds.push([
        [ox - size * 4, oy - flap],
        [ox, oy + size],
        [ox + size * 4, oy - flap],
      ]);
    }
  }

  return {
    moon,
    craters,
    stars,
    starAlphas: [0.35 + state.treble * 0.5, 0.18] as const,
    clouds,
    half,
    step,
    wallHeight,
    walls,
    glints,
    fireflies,
    birds,
    /** Mist thins as the music gets loud. */
    mist: Math.max(0, 0.5 - state.mean * 0.6),
    /** The moon's halo breathes with the bass; the rims and glints flash. */
    haloAlpha: 0.45 + state.bass * 0.55,
    rimAlpha: 0.28 + state.thump * 0.3,
    glintAlpha: 0.35 + state.thump * 0.4,
    bass: state.bass,
    thump: state.thump,
  };
};

export type TerraceValleyLayout = ReturnType<typeof terraceValleyLayout>;

/** Circles as one path, so where they overlap they are one shape. */
const circlesPath = (circles: readonly INightCircle[]) => {
  const path = new Path2D();
  circles.forEach(({ x, y, r }) => {
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);
  });
  return path;
};

export const createTerraceValleyPaths = (
  state: TerraceValley,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  sizeHeight: number,
  frame: ISkyFrame,
) => {
  const layout = terraceValleyLayout(
    state,
    columns,
    top,
    bottom,
    seconds,
    sizeHeight,
    frame,
  );
  const { half, step, wallHeight } = layout;
  const stars: IBand[] = layout.starAlphas.map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  layout.stars.forEach(({ x, y, r, bright }) => {
    stars[bright ? 0 : 1].path.rect(x - r, y - r, r * 2, r * 2);
  });

  // The walls and the rims: the rim along each wall's top edge catching
  // the moon.
  const walls = new Path2D();
  const rims = new Path2D();
  columns.forEach(([x], index) => {
    layout.walls[index].forEach((row) => {
      walls.rect(x - half, row, step, wallHeight);
      rims.moveTo(x - half, row);
      rims.lineTo(x + half, row);
    });
  });

  const glints = new Path2D();
  layout.glints.forEach((glint) => {
    if (glint) {
      glints.moveTo(glint.x, glint.y);
      glints.lineTo(glint.x + glint.length, glint.y);
    }
  });

  const fireflies: IBand[] = VALLEY_INKS.firefly.alphas.map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  layout.fireflies.forEach(({ x, y, r, bright }) => {
    const { path } = fireflies[bright ? 0 : 1];
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);
  });

  const birds = new Path2D();
  layout.birds.forEach(([[fromX, fromY], ...rest]) => {
    birds.moveTo(fromX, fromY);
    rest.forEach(([x, y]) => birds.lineTo(x, y));
  });

  return {
    stars,
    clouds: circlesPath(layout.clouds),
    craters: circlesPath(layout.craters),
    walls,
    rims,
    glints,
    fireflies,
    birds,
    moonX: layout.moon.x,
    moonY: layout.moon.y,
    moonRadius: layout.moon.r,
    mist: layout.mist,
    bass: layout.bass,
    thump: layout.thump,
    layout,
  };
};

export type TerraceValleyPaths = ReturnType<typeof createTerraceValleyPaths>;
