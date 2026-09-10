import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

/**
 * The storm behind the Rainfall form.
 *
 * The spectrum is the cloud: a bank of cumulus along the top whose base
 * hangs lower where its band is loud, so the loud end of the spectrum is
 * the heavy, low, dark end of the sky. The cloud is the figure and takes
 * the palette; under Auto it is a grey-blue ramp, dark at the base and
 * pale at the tops. Out of every cloud falls rain, denser and faster where
 * the cloud is heavy, leaning with a wind that gusts on the bass, each
 * drop a streak with a bright head. The drops land on water along the
 * floor and each landing is a splash and a ring that widens and fades;
 * the water glows with the bass.
 *
 * A big hit is lightning: a jagged bolt from the heaviest cloud to the
 * water with a fork or two, the whole sky flashing white for a frame and
 * settling, and the screen shaking with the thunder.
 *
 * All of it runs on the music-pace clock and reads the beat from the live
 * frame.
 */

interface IDrop {
  column: number;
  /** 0..1 down the fall, from the cloud base to the water. */
  fall: number;
  seed: number;
}

interface IRing {
  x: number;
  y: number;
  bornAt: number;
}

interface IBolt {
  bornAt: number;
  column: number;
  seed: number;
}

export interface Rainstorm {
  /** Per column: the eased cloud-base height, in scene pixels from the top. */
  hang: number[];
  drops: IDrop[];
  rings: IRing[];
  bolt: IBolt | undefined;
  wind: number;
  flash: number;
  shakeAt: number;
  mean: number;
  bass: number;
  thump: number;
  clock: number;
}

/** The storm's own colours, for Auto: the cloud ramp, base to top, and the rest. */
// The ramp runs up the plot: the cloud base hangs around the middle, so
// the middle stop is the dark underside and the top stop the lit crown.
export const STORM_CLOUD_COLOURS = ['#3a475a', '#161e2a', '#55657c'];
export const STORM_RAIN = '#9fd0ff';
export const STORM_WATER = '#1c3d5a';
export const STORM_BOLT = '#f4f8ff';

export const CLOUD_HALF_LIFE_MS = 90;
export const RING_LIFE = 1.1;
export const BOLT_LIFE = 0.32;
export const SHAKE_LIFE = 0.45;
/** Drops per column at full level, and the floor of the water, in depths. */
const DROPS_PER_COLUMN = 4;
export const WATER_DEPTH = 0.1;
const RING_LIMIT = 28;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createRainstorm = (): Rainstorm => ({
  hang: [],
  drops: [],
  rings: [],
  bolt: undefined,
  wind: 0,
  flash: 0,
  shakeAt: -1,
  mean: 0,
  bass: 0,
  thump: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

export const waterTop = (top: number, bottom: number) =>
  bottom - (bottom - top) * WATER_DEPTH;

/** The thunder: a decaying shake after a bolt. */
export const stormShake = (state: Rainstorm, seconds: number) => {
  const age = seconds - state.shakeAt;
  if (state.shakeAt < 0 || age >= SHAKE_LIFE) {
    return { x: 0, y: 0 };
  }
  const fade = (1 - age / SHAKE_LIFE) ** 2;
  return { x: Math.sin(age * 80) * 5 * fade, y: Math.cos(age * 65) * 3 * fade };
};

export const advanceRainstorm = (
  state: Rainstorm,
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
  // The cloud base hangs down a fraction of the sky with the band's level:
  // a silent band is a thin high haze, a loud one a low black ceiling.
  const target = columns.map(
    ([, y]) => depth * (0.06 + levelOf(y, top, bottom) * 0.42),
  );
  if (state.hang.length !== columns.length) {
    state.hang = target.slice();
    state.drops = [];
    columns.forEach((_, column) => {
      for (let i = 0; i < DROPS_PER_COLUMN; i += 1) {
        const seed = column * 31 + i * 7;
        state.drops.push({ column, fall: noise(seed), seed });
      }
    });
  }
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;
  if (!playing) {
    // A pause holds the rain where it is, but not a strike: the clock stops
    // with it, and a flash caught mid-frame stayed as a white wash over the
    // whole plot until the music came back.
    state.bolt = undefined;
    state.flash = 0;
    state.shakeAt = -1;
    return;
  }
  state.clock = seconds;
  const settle = getEaseFactor(elapsedMs, CLOUD_HALF_LIFE_MS);
  target.forEach((value, index) => {
    state.hang[index] += (value - state.hang[index]) * settle;
  });

  const levels = live.map(([, y]) => levelOf(y, top, bottom));
  const mean =
    levels.reduce((sum, v) => sum + v, 0) / Math.max(1, levels.length);
  const crack = mean - state.mean;
  state.mean = mean;
  const bassTo = Math.max(1, Math.floor(levels.length * 0.3));
  const bass = levels.slice(0, bassTo).reduce((s, v) => s + v, 0) / bassTo;
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  const beat = crack >= 0.05 && mean >= 0.15;
  if (beat) {
    state.thump = 1;
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }
  // The wind: a steady lean that gusts on the bass and swings slowly.
  const gust = Math.sin(seconds * 0.4) * 0.3 + state.bass * 0.5;
  state.wind += (gust - state.wind) * getEaseFactor(elapsedMs, 300);
  state.flash *= 1 - getEaseFactor(elapsedMs, 60);

  // The rain falls, faster where the cloud is heavy; a drop that reaches
  // the water rings it and starts again at the cloud.
  const water = waterTop(top, bottom);
  state.drops.forEach((drop) => {
    const level = levels[drop.column] ?? 0;
    const speed = 0.6 + level * 1.6 + state.bass * 0.4;
    drop.fall += dt * speed * (0.8 + noise(drop.seed) * 0.4);
    if (drop.fall >= 1) {
      drop.fall -= 1;
      if (level > 0.04) {
        if (state.rings.length >= RING_LIMIT) {
          state.rings.shift();
        }
        const [x] = columns[drop.column];
        state.rings.push({
          x: x + state.wind * (water - top) * 0.2,
          y:
            water + (bottom - water) * (0.1 + noise(drop.seed + seconds) * 0.6),
          bornAt: seconds,
        });
      }
    }
  });
  state.rings = state.rings.filter((ring) => seconds - ring.bornAt < RING_LIFE);

  // Lightning on a big hit, from the heaviest cloud.
  const boltDone = !state.bolt || seconds - state.bolt.bornAt > BOLT_LIFE;
  if (crack >= 0.1 && mean >= 0.45 && boltDone) {
    let heaviest = 0;
    levels.forEach((level, index) => {
      if (level > levels[heaviest]) {
        heaviest = index;
      }
    });
    state.bolt = {
      bornAt: seconds,
      column: heaviest,
      seed: Math.floor(seconds * 50),
    };
    state.flash = 1;
    state.shakeAt = seconds;
  } else if (boltDone) {
    state.bolt = undefined;
  }
};

export interface IBand {
  path: Path2D;
  alpha: number;
}

export const createRainstormPaths = (
  state: Rainstorm,
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
  const water = waterTop(top, bottom);
  const reach = width * 0.15;

  // The cloud: the figure. One bank across the sky whose base follows the
  // hang of each column. It is built as ONE silhouette — the lower edge
  // of a row of overlapping lobes, three a column, sampled across the
  // plot — rather than as the lobes themselves, so that filled it is one
  // body and stroked it is one scalloped line; a stroke of every lobe
  // read as a heap of wire rings. The top runs off the panel.
  const shape = new Path2D();
  {
    interface ILobe {
      cx: number;
      cy: number;
      r: number;
    }
    const lobes: ILobe[] = [];
    const lobesAt = (x: number, hang: number, seed: number) => {
      const base = top + hang;
      const r = Math.max(step * 0.6, hang * 0.32);
      [
        [0, 0, 1],
        [-0.55, -0.35, 0.8],
        [0.5, -0.45, 0.75],
      ].forEach(([ox, oy, scale], i) => {
        const wobble = 1 + Math.sin(seconds * 0.7 + seed * 3 + i) * 0.06;
        lobes.push({
          cx: x + ox * r,
          cy: base - r + oy * r,
          r: r * scale * wobble,
        });
      });
    };
    lobesAt(left - step, state.hang[0] ?? 0, -1);
    columns.forEach(([x], index) => lobesAt(x, state.hang[index] ?? 0, index));
    lobesAt(right + step, state.hang[columns.length - 1] ?? 0, columns.length);
    // The lower edge: at every sample the lowest point of any lobe over it.
    const from = left - reach;
    const to = right + reach;
    const samples = Math.max(24, Math.round((to - from) / 3));
    shape.moveTo(from, top - depth);
    for (let s = 0; s <= samples; s += 1) {
      const x = from + ((to - from) * s) / samples;
      let edge = top;
      lobes.forEach((lobe) => {
        const dx = x - lobe.cx;
        if (Math.abs(dx) < lobe.r) {
          edge = Math.max(edge, lobe.cy + Math.sqrt(lobe.r * lobe.r - dx * dx));
        }
      });
      shape.lineTo(x, edge);
    }
    shape.lineTo(to, top - depth);
    shape.closePath();
  }

  // The rain: a streak per drop from cloud base toward the water, leaning
  // with the wind, its head brighter — two bands, the heads white.
  const rain = new Path2D();
  const heads = new Path2D();
  const lean = state.wind * 0.25;
  state.drops.forEach((drop) => {
    const [x] = columns[drop.column];
    const hang = state.hang[drop.column] ?? 0;
    const level = Math.max(0, (hang / depth - 0.06) / 0.42);
    if (level < 0.06) {
      return;
    }
    const start = top + hang;
    const span = water - start;
    const y = start + span * drop.fall;
    const dx =
      lean * span * drop.fall + (noise(drop.seed + 1) - 0.5) * step * 0.8;
    const length = size * (4 + level * 14) * (0.7 + state.bass * 0.5);
    rain.moveTo(x + dx - lean * length, y - length);
    rain.lineTo(x + dx, y);
    heads.rect(x + dx - size * 0.4, y - size * 0.8, size * 0.8, size * 1.6);
  });

  // The water: its body to past the floor, its surface, the rings and
  // splashes of every landing in three bands by age.
  const pool = new Path2D();
  pool.rect(left - width, water, width * 3, bottom - water + depth);
  const surface = new Path2D();
  surface.moveTo(left - width, water);
  surface.lineTo(right + width, water);
  const rings: IBand[] = [0.8, 0.45, 0.18].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  const splashes = new Path2D();
  state.rings.forEach((ring) => {
    const age = (seconds - ring.bornAt) / RING_LIFE;
    const rx = size * (1.5 + age * 16);
    const band = rings[Math.min(2, Math.floor(age * 3))];
    band.path.moveTo(ring.x + rx, ring.y);
    band.path.ellipse(ring.x, ring.y, rx, rx * 0.28, 0, 0, Math.PI * 2);
    if (age < 0.2) {
      const up = size * 5 * Math.sin((age / 0.2) * Math.PI);
      [-1, 1].forEach((side) => {
        splashes.moveTo(ring.x, ring.y);
        splashes.lineTo(ring.x + side * size * 1.6, ring.y - up);
      });
    }
  });

  // The lightning: a bolt from the cloud base to the water, jagging on
  // the way with a fork, alive for BOLT_LIFE and fading in the canvas.
  const bolt = new Path2D();
  const fork = new Path2D();
  let boltLife = 0;
  if (state.bolt) {
    const age = seconds - state.bolt.bornAt;
    boltLife = Math.max(0, 1 - age / BOLT_LIFE);
    const [x] = columns[state.bolt.column];
    const start = top + (state.hang[state.bolt.column] ?? 0);
    const steps = 9;
    let px = x;
    let py = start;
    bolt.moveTo(px, py);
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      px = x + (noise(state.bolt.seed + i) - 0.5) * step * 2.5 * (1 - t * 0.5);
      py = start + (water - start) * t;
      bolt.lineTo(px, py);
      if (i === 3 || i === 6) {
        const side = i === 3 ? -1 : 1;
        fork.moveTo(px, py);
        fork.lineTo(px + side * step * 1.2, py + step * 0.9);
        fork.lineTo(px + side * step * 1.6, py + step * 2.2);
      }
    }
  }

  return {
    shape,
    rain,
    heads,
    pool,
    surface,
    rings,
    splashes,
    bolt,
    fork,
    boltLife,
    flash: state.flash,
    water,
    bass: state.bass,
    thump: state.thump,
  };
};

export type RainstormPaths = ReturnType<typeof createRainstormPaths>;
