import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

/**
 * The stage round the Braid form. The braid itself is unchanged: five
 * strands wound round the spectrum. This puts it somewhere.
 *
 * Below it a floor: a plane in perspective, its lines converging on a
 * horizon a little way up the plot, glowing with the bass, with the braid
 * reflected in it upside down and faint. Above it, motes: points of light
 * that lift off the strands on the beat and drift up, swaying, fading.
 * Treble cracks throw sparks between the strands, short bright zigzags
 * that live a few frames. All on the music-pace clock, all read from the
 * live frame.
 */

interface IMote {
  x: number;
  y: number;
  bornAt: number;
  seed: number;
}

interface ISpark {
  x: number;
  y: number;
  bornAt: number;
  seed: number;
}

export interface BraidStage {
  motes: IMote[];
  sparks: ISpark[];
  mean: number;
  trebleLevel: number;
  bass: number;
  thump: number;
  clock: number;
}

export const MOTE_LIFE = 2.6;
export const SPARK_LIFE = 0.18;
const MOTE_LIMIT = 48;
const SPARK_LIMIT = 10;
/** The floor takes this much of the plot from the bottom. */
export const FLOOR = 0.16;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createBraidStage = (): BraidStage => ({
  motes: [],
  sparks: [],
  mean: 0,
  trebleLevel: 0,
  bass: 0,
  thump: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

export const advanceBraidStage = (
  state: BraidStage,
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
  const beat = crack >= 0.05 && mean >= 0.15;
  if (beat) {
    state.thump = 1;
    // Motes lift off the loudest strands.
    const burst = Math.min(6, MOTE_LIMIT - state.motes.length);
    for (let i = 0; i < burst; i += 1) {
      const seed = Math.floor(seconds * 13) * 7 + i;
      const column = Math.floor(noise(seed) * columns.length);
      const [x, y] = columns[column];
      state.motes.push({ x, y: Math.max(top, y), bornAt: seconds, seed });
    }
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }
  state.motes = state.motes.filter((mote) => {
    mote.y -= dt * depth * (0.08 + noise(mote.seed) * 0.08);
    mote.x += Math.sin(seconds * 1.5 + mote.seed) * dt * depth * 0.03;
    return seconds - mote.bornAt < MOTE_LIFE;
  });

  const trebleCrack = treble - state.trebleLevel;
  const relative = trebleCrack / Math.max(0.03, state.trebleLevel);
  if (trebleCrack >= 0.02 && relative >= 0.35) {
    const burst = Math.min(3, SPARK_LIMIT - state.sparks.length);
    for (let i = 0; i < burst; i += 1) {
      const seed = Math.floor(seconds * 29) * 5 + i;
      const column = Math.floor(noise(seed) * columns.length);
      const [x, y] = columns[column];
      state.sparks.push({ x, y: Math.max(top, y), bornAt: seconds, seed });
    }
  }
  state.sparks = state.sparks.filter(
    (spark) => seconds - spark.bornAt < SPARK_LIFE,
  );
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);
};

export interface IBand {
  path: Path2D;
  alpha: number;
}

export const createBraidStagePaths = (
  state: BraidStage,
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
  const size = Math.max(0.7, Math.min(3.2, sizeHeight / 230));
  const horizon = bottom - depth * FLOOR;
  const centre = left + width / 2;

  // The floor: rows packed toward the horizon, columns converging on it.
  const floor = new Path2D();
  const rows = 7;
  for (let r = 1; r <= rows; r += 1) {
    const t = (r / rows) ** 1.7;
    const y = horizon + (bottom - horizon) * t;
    floor.moveTo(left - width, y);
    floor.lineTo(right + width, y);
  }
  const lanes = 16;
  for (let l = 0; l <= lanes; l += 1) {
    const u = (l / lanes) * 2 - 1;
    floor.moveTo(centre + u * width * 0.45, horizon);
    floor.lineTo(centre + u * width * 1.6, bottom);
  }

  // The motes and the sparks.
  const motes: IBand[] = [0.9, 0.5, 0.2].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  state.motes.forEach((mote) => {
    const age = (seconds - mote.bornAt) / MOTE_LIFE;
    const r = size * (1.4 - age * 0.8);
    const band = motes[Math.min(2, Math.floor(age * 3))];
    band.path.moveTo(mote.x + r, mote.y);
    band.path.arc(mote.x, mote.y, r, 0, Math.PI * 2);
  });
  const sparks = new Path2D();
  state.sparks.forEach((spark) => {
    const reach = size * 12;
    let x = spark.x - reach * 0.5;
    let y = spark.y + (noise(spark.seed) - 0.5) * size * 8;
    sparks.moveTo(x, y);
    for (let i = 1; i <= 5; i += 1) {
      x += reach / 5;
      y +=
        (noise(spark.seed * 3 + i + Math.floor(seconds * 40)) - 0.5) * size * 8;
      sparks.lineTo(x, y);
    }
  });

  return {
    floor,
    motes,
    sparks,
    horizon,
    bass: state.bass,
    thump: state.thump,
  };
};

export type BraidStagePaths = ReturnType<typeof createBraidStagePaths>;
