import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

/**
 * The light on the Spikes form. The spikes themselves are unchanged — a
 * triangle a band, painted in the palette — this gives them faces.
 *
 * Each spike has a shaded right face, so it stands out of the plot as a
 * crystal rather than lying on it as a triangle. The tips glint: on the beat the loudest few throw a white
 * star that fades in a few frames, and treble cracks scatter smaller
 * ones along the tips. Under the spikes a glow along the floor breathes
 * with the bass. All on the music-pace clock, read from the live frame.
 */

interface IGlint {
  /** The column it sits on: it rides the tip as the tip moves. */
  column: number;
  bornAt: number;
  size: number;
}

export interface CrystalSpikes {
  glints: IGlint[];
  mean: number;
  trebleLevel: number;
  bass: number;
  thump: number;
  clock: number;
}

export const GLINT_LIFE = 0.35;
const GLINT_LIMIT = 24;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createCrystalSpikes = (): CrystalSpikes => ({
  glints: [],
  mean: 0,
  trebleLevel: 0,
  bass: 0,
  thump: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

export const advanceCrystalSpikes = (
  state: CrystalSpikes,
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
  const glint = (column: number, size: number) => {
    if (state.glints.length >= GLINT_LIMIT) {
      state.glints.shift();
    }
    state.glints.push({ column, bornAt: seconds, size });
  };
  if (beat) {
    state.thump = 1;
    // The four loudest tips.
    const ranked = levels
      .map((level, index) => ({ level, index }))
      .sort((a, b) => b.level - a.level)
      .slice(0, 4);
    ranked.forEach(({ index }) => glint(index, 1));
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }
  const trebleCrack = treble - state.trebleLevel;
  const relative = trebleCrack / Math.max(0.03, state.trebleLevel);
  if (trebleCrack >= 0.02 && relative >= 0.35) {
    for (let i = 0; i < 3; i += 1) {
      const seed = Math.floor(seconds * 31) * 3 + i;
      const column = Math.floor(noise(seed) * columns.length);
      if ((levels[column] ?? 0) > 0.05) {
        glint(column, 0.55);
      }
    }
  }
  state.glints = state.glints.filter(
    (g) =>
      seconds - g.bornAt < GLINT_LIFE &&
      (columns[g.column]?.[1] ?? bottom) < bottom - depth * 0.02,
  );
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);
};

export const createCrystalSpikesPaths = (
  state: CrystalSpikes,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  sizeHeight: number,
) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const step = width / Math.max(1, columns.length - 1);
  const size = Math.max(0.7, Math.min(3.2, sizeHeight / 230));
  const half = step * 0.55;

  // The shade: the right half of every spike, the same triangle the figure
  // draws, split at its centre line.
  const shade = new Path2D();
  columns.forEach(([x, y]) => {
    if (bottom - y < 1) {
      return;
    }
    shade.moveTo(x, y);
    shade.lineTo(x + half, bottom);
    shade.lineTo(x, bottom);
    shade.closePath();
  });

  // The glints: four-point stars at the tips, shrinking as they fade.
  const glints = new Path2D();
  state.glints.forEach((g) => {
    const column = columns[g.column];
    if (!column) {
      return;
    }
    const [x, tipY] = column;
    const y = Math.max(top, tipY);
    const age = (seconds - g.bornAt) / GLINT_LIFE;
    const r = size * (2 + g.size * 5) * (1 - age * 0.6);
    glints.moveTo(x - r, y);
    glints.lineTo(x + r, y);
    glints.moveTo(x, y - r);
    glints.lineTo(x, y + r);
    const d = r * 0.45;
    glints.moveTo(x - d, y - d);
    glints.lineTo(x + d, y + d);
    glints.moveTo(x + d, y - d);
    glints.lineTo(x - d, y + d);
  });

  return {
    shade,
    glints,
    /** The floor glow's height, in plot pixels, with the bass. */
    glowHeight: (bottom - top) * (0.08 + state.bass * 0.14),
    bass: state.bass,
    thump: state.thump,
  };
};

export type CrystalSpikesPaths = ReturnType<typeof createCrystalSpikesPaths>;
