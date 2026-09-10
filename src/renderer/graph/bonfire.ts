import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

/**
 * The fire behind the Flames form.
 *
 * Every band is a tongue of flame standing on a bed of logs, as tall as
 * its band is loud. A tongue is three nested layers — the outer flame,
 * a hotter middle, a white-hot core — each a smooth curve whose width
 * swells and narrows on the way up and whose tip leans and licks on the
 * clock, so the fire waves rather than stands. The outer layer is the
 * figure and takes the palette; under Auto it is a fire ramp, yellow at
 * the base through orange to red at the tips.
 *
 * The beat throws sparks off the tips that drift up, sway and wink out;
 * treble cracks throw more. Smoke puffs rise off the tallest tongues and
 * spread as they fade. Under it all the logs, dark with cracks of coal
 * that brighten with the bass, and a ground glow that breathes with it.
 *
 * All of it runs on the music-pace clock and reads the beat from the
 * live frame.
 */

interface ISpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
  seed: number;
}

interface IPuff {
  x: number;
  y: number;
  bornAt: number;
  seed: number;
}

export interface Bonfire {
  /** Per column: the eased tongue height in scene pixels. */
  reach: number[];
  sparks: ISpark[];
  puffs: IPuff[];
  puffedAt: number;
  mean: number;
  trebleLevel: number;
  bass: number;
  thump: number;
  clock: number;
}

/** The fire's own colours, for Auto: a level ramp from the base up. */
export const FIRE_COLOURS = ['#fff2a8', '#ff9a1f', '#ff3b1a'];
export const FIRE_CORE = '#fff8d6';
export const FIRE_MID = '#ffc857';
export const LOG_COLOUR = '#4a2e1c';
export const BARK_COLOUR = '#24140b';
export const GRAIN_COLOUR = '#8a5f3c';
export const COAL_COLOUR = '#ff6a1f';
export const SMOKE_COLOUR = '#9a9a9a';

export const TONGUE_HALF_LIFE_MS = 35;
export const SPARK_LIFE = 1.3;
export const PUFF_LIFE = 3.2;
const SPARK_LIMIT = 90;
const PUFF_LIMIT = 14;
/** A puff of smoke this often, in clock seconds, while the fire is up. */
const PUFF_EVERY = 0.35;
/** Samples up each side of a tongue. */
const TONGUE_STEPS = 6;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createBonfire = (): Bonfire => ({
  reach: [],
  sparks: [],
  puffs: [],
  puffedAt: -1,
  mean: 0,
  trebleLevel: 0,
  bass: 0,
  thump: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

export const advanceBonfire = (
  state: Bonfire,
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
  const target = columns.map(([, y]) => {
    const level = Math.max(0, Math.min(1, (bottom - y) / depth));
    return depth * 0.8 * level ** 1.3;
  });
  if (state.reach.length !== columns.length) {
    state.reach = target.slice();
  }
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;
  if (!playing) {
    return;
  }
  state.clock = seconds;
  const settle = getEaseFactor(elapsedMs, TONGUE_HALF_LIFE_MS);
  target.forEach((value, index) => {
    state.reach[index] += (value - state.reach[index]) * settle;
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

  // Sparks: a handful off the tips on the beat, more on a treble crack.
  const trebleCrack = treble - state.trebleLevel;
  const relative = trebleCrack / Math.max(0.03, state.trebleLevel);
  const crackle = trebleCrack >= 0.02 && relative >= 0.35;
  if (beat || crackle) {
    const burst = Math.min(beat ? 6 : 10, SPARK_LIMIT - state.sparks.length);
    for (let i = 0; i < burst; i += 1) {
      const seed = Math.floor(seconds * 17) * 11 + i;
      // Off a tongue that is burning, not a cold one.
      const column = Math.floor(noise(seed) * columns.length);
      const [x] = columns[column];
      const reach = state.reach[column] ?? 0;
      if (reach >= depth * 0.05) {
        state.sparks.push({
          x: x + (noise(seed + 1) - 0.5) * depth * 0.02,
          y: bottom - reach * (0.7 + noise(seed + 2) * 0.3),
          vx: (noise(seed + 3) - 0.5) * depth * 0.2,
          vy: -depth * (0.25 + noise(seed + 4) * 0.35),
          bornAt: seconds,
          seed,
        });
      }
    }
  }
  state.sparks = state.sparks.filter((spark) => {
    spark.x +=
      spark.vx * dt + Math.sin(seconds * 6 + spark.seed) * dt * depth * 0.05;
    spark.y += spark.vy * dt;
    spark.vy *= 1 - dt * 0.6;
    return seconds - spark.bornAt < SPARK_LIFE;
  });

  // Smoke: a puff off the tallest tongue every PUFF_EVERY while it burns.
  if (seconds - state.puffedAt >= PUFF_EVERY && mean > 0.05) {
    state.puffedAt = seconds;
    let tallest = 0;
    state.reach.forEach((reach, index) => {
      if (reach > state.reach[tallest]) {
        tallest = index;
      }
    });
    const seed = Math.floor(seconds * 3);
    const column =
      noise(seed) < 0.6
        ? tallest
        : Math.floor(noise(seed + 1) * columns.length);
    const [x] = columns[column];
    if (state.puffs.length >= PUFF_LIMIT) {
      state.puffs.shift();
    }
    state.puffs.push({
      x,
      y: bottom - (state.reach[column] ?? 0),
      bornAt: seconds,
      seed,
    });
  }
  state.puffs = state.puffs.filter((puff) => {
    puff.y -= dt * depth * 0.12;
    puff.x += Math.sin(seconds * 0.8 + puff.seed) * dt * depth * 0.03;
    return seconds - puff.bornAt < PUFF_LIFE;
  });
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);
};

export interface IBand {
  path: Path2D;
  alpha: number;
}

/**
 * One tongue: TONGUE_STEPS samples up each side, the width swelling and
 * narrowing on the way up, the whole thing leaning and licking on the
 * clock, joined by quadratics through the midpoints so it is a curve.
 */
const tongue = (
  path: Path2D,
  x: number,
  bottom: number,
  reach: number,
  half: number,
  seed: number,
  seconds: number,
) => {
  const side = (dir: number): Projected[] =>
    Array.from({ length: TONGUE_STEPS + 1 }, (_, i) => {
      const t = i / TONGUE_STEPS;
      // Fire flickers fast: these rates are what read as flame rather
      // than as seaweed.
      const swell = 1 + 0.4 * Math.sin(t * 7 + seconds * 14 + seed * 3);
      const width = half * (1 - t) ** 0.75 * swell;
      const lean =
        Math.sin(seconds * 9 + seed * 9 + t * 3) * half * 0.9 * t * t +
        Math.sin(seconds * 23 + seed * 5 + t * 9) * half * 0.2 * t;
      return [x + lean + dir * width, bottom - reach * t];
    });
  const left = side(-1);
  const right = side(1).reverse();
  const outline = [...left, ...right];
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length - 1; i += 1) {
    const [px, py] = outline[i];
    const [qx, qy] = outline[i + 1];
    path.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
  }
  path.closePath();
};

export const createBonfirePaths = (
  state: Bonfire,
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
  // Wider than a column, so neighbours overlap into one fire.
  const half = step * 0.8;
  // The pile sits inside the plot and the flames rise out of it: the
  // tongues stand on the logs, not on the panel's edge.
  const logHeight = Math.max(6, depth * 0.1);
  // Six percent up from the floor: in fullscreen the floor is the screen edge
  // under the transport bar, and a pile on it was out of sight.
  const bed = bottom - depth * 0.06;
  const hearth = bed - logHeight * 0.55;
  // The fire breathes with the bass: a little taller on a kick.
  const breath = 1 + state.bass * 0.12;

  // The three layers, outer to core.
  const shape = new Path2D();
  const mid = new Path2D();
  const core = new Path2D();
  columns.forEach(([x], index) => {
    const reach = (state.reach[index] ?? 0) * breath;
    if (reach < 1) {
      return;
    }
    tongue(shape, x, hearth, reach, half, index, seconds);
    tongue(mid, x, hearth, reach * 0.68, half * 0.62, index + 0.5, seconds);
    tongue(core, x, hearth, reach * 0.4, half * 0.32, index + 0.25, seconds);
  });

  // The sparks, three brightness bands by age, each a small square that
  // shrinks as it cools; the white ones are the freshest.
  const sparks: IBand[] = [1, 0.6, 0.25].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  state.sparks.forEach((spark) => {
    const age = (seconds - spark.bornAt) / SPARK_LIFE;
    const wink = Math.sin(seconds * 25 + spark.seed) > -0.6;
    if (!wink) {
      return;
    }
    const r = size * (1.4 - age);
    sparks[Math.min(2, Math.floor(age * 3))].path.rect(
      spark.x - r / 2,
      spark.y - r / 2,
      r,
      r,
    );
  });

  // The smoke: puffs that grow and fade, two bands.
  const smoke: IBand[] = [0.16, 0.07].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  state.puffs.forEach((puff) => {
    const age = (seconds - puff.bornAt) / PUFF_LIFE;
    const r = size * (4 + age * 26);
    const band = smoke[age < 0.5 ? 0 : 1];
    [
      [0, 0, 1],
      [0.7, -0.4, 0.7],
      [-0.6, -0.5, 0.65],
    ].forEach(([ox, oy, scale]) => {
      const cx = puff.x + ox * r;
      const cy = puff.y + oy * r;
      band.path.moveTo(cx + r * scale, cy);
      band.path.arc(cx, cy, r * scale, 0, Math.PI * 2);
    });
  });

  // The logs: a pile of four, thick, crossing at different angles and
  // heights, each a body with bark lines along it, an end cut showing its
  // growth rings, and glowing cracks that pulse with the bass; under them
  // a bed of coals. Every part is stable: nothing here moves but the glow.
  const logs = new Path2D();
  const bark = new Path2D();
  const rings = new Path2D();
  const cracks = new Path2D();
  const coals = new Path2D();
  (
    [
      // Six short logs laid along the fire, overlapping, two of them
      // resting on the others: a pile, not a plank.
      [0.0, 0.26, -0.1, 0.0, 1],
      [0.22, 0.5, 0.12, 0.0, 0.9],
      [0.47, 0.74, -0.06, 0.0, 1],
      [0.72, 1.0, 0.09, 0.0, 0.85],
      [0.12, 0.4, 0.05, 0.6, 0.75],
      [0.58, 0.86, -0.08, 0.6, 0.7],
    ] as const
  ).forEach(([from, to, tilt, lift, thick], index) => {
    const x0 = left + width * from;
    const x1 = left + width * to;
    const r = logHeight * 0.5 * thick;
    const yc = bed - r - logHeight * lift;
    const y0 = yc + tilt * (x1 - x0) * 0.5;
    const y1 = yc - tilt * (x1 - x0) * 0.5;
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const nx = -Math.sin(angle) * r;
    const ny = Math.cos(angle) * r;
    logs.moveTo(x0 + nx, y0 + ny);
    logs.lineTo(x1 + nx, y1 + ny);
    logs.arc(x1, y1, r, angle + Math.PI / 2, angle - Math.PI / 2, true);
    logs.lineTo(x0 - nx, y0 - ny);
    logs.arc(x0, y0, r, angle - Math.PI / 2, angle + Math.PI / 2, true);
    logs.closePath();
    // Bark: three lines along the body, broken into segments so they read
    // as grain rather than as stripes.
    [-0.55, -0.1, 0.4].forEach((band, k) => {
      const ox = nx * band;
      const oy = ny * band;
      for (let s = 0; s < 6; s += 1) {
        const a = (s + 0.1 + noise(index * 7 + k * 3 + s) * 0.3) / 6;
        const b = (s + 0.7 + noise(index * 5 + k * 2 + s) * 0.3) / 6;
        bark.moveTo(x0 + (x1 - x0) * a + ox, y0 + (y1 - y0) * a + oy);
        bark.lineTo(x0 + (x1 - x0) * b + ox, y0 + (y1 - y0) * b + oy);
      }
    });
    // The end cut, on the end nearer the middle: the rings.
    const [ex, ey] = index % 2 === 0 ? [x1, y1] : [x0, y0];
    [0.75, 0.45, 0.18].forEach((ring) => {
      rings.moveTo(ex + r * ring, ey);
      rings.ellipse(ex, ey, r * ring * 0.55, r * ring, 0, 0, Math.PI * 2);
    });
    // Glowing cracks: short lines across the grain on the underside.
    for (let c = 0; c < 4; c += 1) {
      const a = 0.12 + noise(index * 11 + c) * 0.76;
      const cx = x0 + (x1 - x0) * a;
      const cy = y0 + (y1 - y0) * a;
      cracks.moveTo(cx - nx * 0.2, cy - ny * 0.2);
      cracks.lineTo(cx - nx * 0.8 + ny * 0.3, cy - ny * 0.8 - nx * 0.3);
    }
  });
  // The bed of coals under the pile.
  for (let i = 0; i < 40; i += 1) {
    const cx = left + noise(i * 3 + 1) * width;
    const cy = bed - noise(i * 3 + 2) * logHeight * 0.5;
    const cr = size * (0.8 + noise(i * 3 + 3) * 1.6);
    coals.moveTo(cx + cr, cy);
    coals.arc(cx, cy, cr, 0, Math.PI * 2);
  }

  return {
    shape,
    mid,
    core,
    sparks,
    smoke,
    logs,
    bark,
    rings,
    cracks,
    coals,
    glowRadius: Math.max(width, depth) * (0.25 + state.bass * 0.2),
    glowX: left + width / 2,
    bass: state.bass,
    thump: state.thump,
  };
};

export type BonfirePaths = ReturnType<typeof createBonfirePaths>;
