import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

/**
 * The countryside behind the Fence form.
 *
 * The spectrum is a picket fence: every band a picket as tall as it is
 * loud, pointed caps, two rails behind, a thicker post every eighth
 * picket, the wood grained and knotted. The pickets are the figure and
 * take the palette; under Auto they are pale weathered wood.
 *
 * Behind the fence, golden hour: a sky that warms toward the horizon, a
 * low sun whose glow breathes with the bass, a few clouds drifting on the
 * clock, two ranges of rolling hills and a line of trees on the near one.
 * The trees sway in a wind that gusts on the bass, and rustle on the
 * beat. In front of the fence, grass: a field of blades that bend with
 * the same wind, each on its own phase. A big hit sends birds across the
 * sky; treble cracks light fireflies in the grass.
 *
 * All of it runs on the music-pace clock and reads the beat from the
 * live frame. The trees, the hills and the grass are laid out once from
 * stable noise, so nothing but the wind moves them.
 */

interface IFirefly {
  x: number;
  y: number;
  bornAt: number;
  seed: number;
}

export interface CountryFence {
  /** Per column: the eased picket height in scene pixels. */
  rise: number[];
  wind: number;
  fireflies: IFirefly[];
  birdsAt: number;
  mean: number;
  trebleLevel: number;
  bass: number;
  thump: number;
  clock: number;
}

/** The scene's own colours, for Auto. The wood is a level ramp, base up. */
export const FENCE_WOOD_COLOURS = ['#c9a570', '#e9d9b5', '#f4ecd5'];
export const FENCE_SKY_TOP = '#5a7fb8';
export const FENCE_SKY_HORIZON = '#ffb36b';
export const FENCE_SUN = '#fff1c4';
export const FENCE_HILL_FAR = '#7fa35a';
export const FENCE_HILL_NEAR = '#4f8a3a';
export const FENCE_TREE_LIGHT = '#4f8a3a';
export const FENCE_TREE_DARK = '#2f5a24';
export const FENCE_TRUNK = '#5a3d24';
export const FENCE_GRASS = '#3f7a2a';
export const FENCE_GRASS_LIT = '#7fbf4a';
export const FENCE_RAIL = '#b8956a';
export const FENCE_GRAIN = '#8f6f45';
export const FENCE_FIREFLY = '#e8ff8a';

export const PICKET_HALF_LIFE_MS = 60;
export const FIREFLY_LIFE = 1.6;
export const BIRDS_CROSSING = 8;
const FIREFLY_LIMIT = 30;
/** Blades of grass across the plot, and trees along the near hill. */
export const GRASS_BLADES = 170;
export const TREES = 7;
/** How much of the plot the ground takes from the floor, for the fence's foot. */
export const GROUND = 0.16;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createCountryFence = (): CountryFence => ({
  rise: [],
  wind: 0,
  fireflies: [],
  birdsAt: -1,
  mean: 0,
  trebleLevel: 0,
  bass: 0,
  thump: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

export const advanceCountryFence = (
  state: CountryFence,
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
  // A picket stands on the ground and reaches up with its band; even a
  // silent band keeps a short picket, because a fence with gaps is a
  // broken fence.
  const target = columns.map(
    ([, y]) => depth * (0.08 + levelOf(y, top, bottom) * 0.55),
  );
  if (state.rise.length !== columns.length) {
    state.rise = target.slice();
  }
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;
  if (!playing) {
    return;
  }
  state.clock = seconds;
  const settle = getEaseFactor(elapsedMs, PICKET_HALF_LIFE_MS);
  target.forEach((value, index) => {
    state.rise[index] += (value - state.rise[index]) * settle;
  });

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
  const beat = crack >= 0.05 && mean >= 0.15;
  if (beat) {
    state.thump = 1;
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }
  // The wind: a slow swing, gusting on the bass.
  const gust = Math.sin(seconds * 0.5) * 0.35 + state.bass * 0.65;
  state.wind += (gust - state.wind) * getEaseFactor(elapsedMs, 250);

  // Fireflies on a treble crack, measured against the treble's own level.
  const trebleCrack = treble - state.trebleLevel;
  const relative = trebleCrack / Math.max(0.03, state.trebleLevel);
  if (trebleCrack >= 0.02 && relative >= 0.35) {
    const burst = Math.min(4, FIREFLY_LIMIT - state.fireflies.length);
    const left = columns[0][0];
    const width = columns[columns.length - 1][0] - left;
    for (let i = 0; i < burst; i += 1) {
      const seed = Math.floor(seconds * 19) * 5 + i;
      state.fireflies.push({
        x: left + noise(seed) * width,
        y: bottom - depth * GROUND * (0.2 + noise(seed + 1) * 0.9),
        bornAt: seconds,
        seed,
      });
    }
  }
  state.fireflies = state.fireflies.filter((fly) => {
    fly.x += Math.sin(seconds * 2 + fly.seed) * dt * depth * 0.04;
    fly.y -= dt * depth * 0.02;
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

/** A rolling hill: a smooth ridge from `from` to `to` over a closed body. */
const hill = (
  path: Path2D,
  from: number,
  to: number,
  ridge: (x: number) => number,
  bottomY: number,
) => {
  const steps = 28;
  path.moveTo(from, bottomY);
  let [px, py] = [from, ridge(from)];
  path.lineTo(px, py);
  for (let s = 1; s <= steps; s += 1) {
    const x = from + ((to - from) * s) / steps;
    const y = ridge(x);
    path.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
    [px, py] = [x, y];
  }
  path.lineTo(to, py);
  path.lineTo(to, bottomY);
  path.closePath();
};

export const createCountryFencePaths = (
  state: CountryFence,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  sizeHeight: number,
) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const depth = Math.max(1, bottom - top);
  const step = width / Math.max(1, columns.length - 1);
  const size = Math.max(0.7, Math.min(3.2, sizeHeight / 230));
  const reach = width;
  const from = left - reach;
  const to = right + reach;
  const ground = bottom - depth * GROUND;
  const { wind } = state;

  // The sun, low over the far hills, and the clouds drifting.
  const sunX = left + width * 0.72;
  const sunY = top + depth * 0.36;
  const clouds = new Path2D();
  for (let c = 0; c < 4; c += 1) {
    const drift = ((seconds * 0.01 * (1 + c * 0.3) + noise(c * 7)) % 1.4) - 0.2;
    const cx = from + (to - from) * drift;
    const cy = top + depth * (0.1 + noise(c * 3) * 0.2);
    const r = size * (10 + noise(c * 5) * 12);
    [
      [0, 0, 1],
      [-0.8, 0.15, 0.7],
      [0.85, 0.2, 0.75],
      [0.2, -0.35, 0.7],
    ].forEach(([ox, oy, s]) => {
      clouds.moveTo(cx + ox * r + r * s, cy + oy * r);
      clouds.arc(cx + ox * r, cy + oy * r, r * s, 0, Math.PI * 2);
    });
  }

  // The hills: a far range and a near one, ridges from stable noise.
  const farHill = new Path2D();
  const nearHill = new Path2D();
  const farRidge = (x: number) =>
    top +
    depth * 0.52 +
    Math.sin(x * 0.004) * depth * 0.05 +
    Math.sin(x * 0.011 + 2) * depth * 0.025;
  const nearRidge = (x: number) =>
    top +
    depth * 0.66 +
    Math.sin(x * 0.006 + 1) * depth * 0.04 +
    Math.sin(x * 0.015 + 4) * depth * 0.02;
  hill(farHill, from, to, farRidge, bottom + depth);
  hill(nearHill, from, to, nearRidge, bottom + depth);

  // The trees along the near ridge: a tapered trunk and a canopy of lumpy
  // lobes in two greens, swaying with the wind and rustling on the beat.
  const trunks = new Path2D();
  const canopyDark = new Path2D();
  const canopyLight = new Path2D();
  for (let i = 0; i < TREES; i += 1) {
    const tx =
      from + ((to - from) * (i + 0.5 + (noise(i * 3) - 0.5) * 0.6)) / TREES;
    const scale = 0.7 + noise(i * 3 + 1) * 0.6;
    const height = depth * 0.22 * scale;
    const baseY = nearRidge(tx) + depth * 0.02;
    const sway = wind * height * 0.12 + Math.sin(seconds * 1.3 + i) * size;
    const rustle = 1 + state.thump * 0.04;
    trunks.moveTo(tx - size * 2.2 * scale, baseY);
    trunks.lineTo(tx + size * 2.2 * scale, baseY);
    trunks.lineTo(tx + size * 1.1 * scale + sway * 0.4, baseY - height * 0.55);
    trunks.lineTo(tx - size * 1.1 * scale + sway * 0.4, baseY - height * 0.55);
    trunks.closePath();
    const cy = baseY - height * 0.62;
    const r = height * 0.32 * rustle;
    const lobes: [number, number, number, Path2D][] = [
      [0, 0, 1, canopyDark],
      [-0.75, 0.25, 0.7, canopyDark],
      [0.75, 0.25, 0.72, canopyDark],
      [-0.35, -0.5, 0.75, canopyLight],
      [0.4, -0.45, 0.7, canopyLight],
      [0.05, 0.3, 0.6, canopyLight],
    ];
    lobes.forEach(([ox, oy, s, target]) => {
      const lx = tx + sway + ox * r;
      const ly = cy + oy * r;
      target.moveTo(lx + r * s, ly);
      target.arc(lx, ly, r * s, 0, Math.PI * 2);
    });
  }

  // The fence: pickets are the figure, with a pointed cap; two rails
  // behind them; a post every eighth picket; grain and a knot on each.
  const shape = new Path2D();
  const grain = new Path2D();
  const knots = new Path2D();
  const posts = new Path2D();
  const half = step * 0.32;
  const approach = Math.ceil(reach / step);
  const picketAt = (x: number, rise: number, index: number) => {
    const y = ground - rise;
    const cap = half * 0.9;
    shape.moveTo(x - half, ground + size * 2);
    shape.lineTo(x - half, y + cap);
    shape.lineTo(x, y);
    shape.lineTo(x + half, y + cap);
    shape.lineTo(x + half, ground + size * 2);
    shape.closePath();
    [-0.45, 0.1, 0.5].forEach((band, k) => {
      const gx = x + half * band;
      const gy0 = y + cap + rise * (0.1 + noise(index * 3 + k) * 0.2);
      const gy1 = ground - rise * noise(index * 5 + k) * 0.3;
      grain.moveTo(gx, gy0);
      grain.lineTo(gx + (noise(index + k) - 0.5) * size, gy1);
    });
    if (noise(index * 11) > 0.6) {
      const kx = x + (noise(index * 13) - 0.5) * half;
      const ky = y + cap + rise * (0.3 + noise(index * 17) * 0.5);
      knots.moveTo(kx + size * 0.9, ky);
      knots.ellipse(kx, ky, size * 0.9, size * 1.3, 0, 0, Math.PI * 2);
    }
    // A post every eighth picket, standing in the gap AFTER it, a fixed
    // height whatever the pickets do — a post is the frame, not a band —
    // with a square cap. Drawn behind a picket at the picket's height it
    // read as a shadow on the picket.
    if (index % 8 === 0) {
      const px = x + step / 2;
      const postTop = ground - depth * 0.42;
      posts.rect(
        px - half * 0.9,
        postTop,
        half * 1.8,
        ground - postTop + size * 2,
      );
      posts.rect(
        px - half * 1.15,
        postTop - size * 2.5,
        half * 2.3,
        size * 2.5,
      );
    }
  };
  for (let i = approach; i >= 1; i -= 1) {
    picketAt(left - i * step, state.rise[0] ?? 0, -i);
  }
  columns.forEach(([x], index) => picketAt(x, state.rise[index] ?? 0, index));
  for (let i = 1; i <= approach; i += 1) {
    picketAt(
      right + i * step,
      state.rise[columns.length - 1] ?? 0,
      columns.length + i,
    );
  }
  const rails = new Path2D();
  const railHeight = Math.max(3, size * 3);
  [0.28, 0.62].forEach((f) => {
    const y = ground - depth * 0.55 * f * 0.55;
    rails.rect(from, y - railHeight / 2, to - from, railHeight);
  });

  // The grass in front: blades bending with the wind, each on its own
  // phase, two greens; the fireflies among them; and the birds.
  const grass = new Path2D();
  const grassLit = new Path2D();
  const blades = Math.round(GRASS_BLADES * ((to - from) / width));
  for (let b = 0; b < blades; b += 1) {
    const bx = from + noise(b * 3 + 1) * (to - from);
    const by = ground + depth * GROUND * (0.15 + noise(b * 3 + 2) * 0.85);
    const h =
      size *
      (7 + noise(b * 3 + 3) * 12) *
      (0.6 + ((by - ground) / (depth * GROUND)) * 0.6);
    const bend = (wind * 0.9 + Math.sin(seconds * 2.2 + b) * 0.25) * h * 0.6;
    const target = noise(b * 7) > 0.5 ? grassLit : grass;
    target.moveTo(bx, by);
    target.quadraticCurveTo(bx + bend * 0.3, by - h * 0.6, bx + bend, by - h);
  }
  const fireflies: IBand[] = [0.95, 0.5].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  state.fireflies.forEach((fly) => {
    const age = (seconds - fly.bornAt) / FIREFLY_LIFE;
    const lit = Math.sin(seconds * 9 + fly.seed) > 0;
    const band = fireflies[lit ? 0 : 1];
    const r = size * (0.8 + (1 - age) * 0.8);
    band.path.moveTo(fly.x + r, fly.y);
    band.path.arc(fly.x, fly.y, r, 0, Math.PI * 2);
  });
  const birds = new Path2D();
  const flight = seconds - state.birdsAt;
  if (state.birdsAt >= 0 && flight < BIRDS_CROSSING) {
    const bx = from + (flight / BIRDS_CROSSING) * (to - from);
    const by = top + depth * 0.14;
    for (let i = 0; i < 5; i += 1) {
      const ox = bx - Math.abs(i - 2) * size * 9;
      const oy =
        by + Math.abs(i - 2) * size * 4 + Math.sin(seconds * 5 + i) * size;
      const flap = Math.sin(seconds * 9 + i) * size * 2;
      birds.moveTo(ox - size * 4, oy - flap);
      birds.lineTo(ox, oy + size);
      birds.lineTo(ox + size * 4, oy - flap);
    }
  }

  return {
    shape,
    grain,
    knots,
    posts,
    rails,
    clouds,
    farHill,
    nearHill,
    trunks,
    canopyDark,
    canopyLight,
    grass,
    grassLit,
    fireflies,
    birds,
    sunX,
    sunY,
    sunRadius: depth * (0.07 + state.bass * 0.02),
    ground,
    skyFrom: from,
    skyTo: to,
    bass: state.bass,
    thump: state.thump,
  };
};

export type CountryFencePaths = ReturnType<typeof createCountryFencePaths>;
