import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

/**
 * What makes the sawtooth a scope and not a drawing of one.
 *
 * Phosphor: the beam leaves ghosts of its last few positions behind it, so
 * a moving wave has a tail. A beat flares the beam wide and white for a
 * moment, and every loud tooth throws sparks off its tip — the way a real
 * tube arcs when it is overdriven. All of it is decided once per frame on
 * the music-pace clock, before the curves, so a mirrored wave shows the
 * same flare and sparks without deciding them twice.
 */

/**
 * Phosphor persistence: a ghost is kept every 60ms of clock and fades over
 * 600ms. Keeping every frame put seven ghosts under the beam itself, since
 * the wave moves a fraction of a pixel between frames; spaced out, the tail
 * trails the beam by a visible distance.
 */
export const GHOST_EVERY = 0.06;
export const GHOST_LIFE = 0.6;
/** A flare is over in 220ms; sparks live half a second. */
export const FLARE_LIFE = 0.22;
export const SPARK_LIFE = 0.5;

interface IGhost {
  path: Path2D;
  at: number;
}

interface ISpark {
  x: number;
  y: number;
  /** Pixels per second of clock, in plot space. */
  vx: number;
  vy: number;
  at: number;
}

export const createSawtoothScope = () => ({
  ghosts: [] as IGhost[],
  beatLevel: 0,
  /** The clock at the last decision, for a frame-rate-free tracker. */
  trackedAt: -1,
  flareAt: -1,
  sparks: [] as ISpark[],
});
export type SawtoothScope = ReturnType<typeof createSawtoothScope>;

/** A cheap deterministic hash in [0, 1). */
const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const advanceSawtoothScope = (
  state: SawtoothScope,
  trace: Path2D,
  points: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
) => {
  if (!playing) {
    return;
  }
  state.ghosts = state.ghosts.filter(
    (ghost) => seconds - ghost.at <= GHOST_LIFE && seconds >= ghost.at,
  );
  const newest = state.ghosts[0];
  if (!newest || seconds - newest.at >= GHOST_EVERY) {
    state.ghosts.unshift({ path: trace, at: seconds });
  }
  state.sparks = state.sparks.filter(
    (spark) => seconds - spark.at <= SPARK_LIFE && seconds >= spark.at,
  );
  const depth = Math.max(1, bottom - top);
  const levels = points.map(([, y]) =>
    Math.max(0, Math.min(1, (bottom - y) / depth)),
  );
  const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  if (mean - state.beatLevel >= 0.05) {
    state.flareAt = seconds;
    // Sparks off every loud tooth: three each, thrown up and a little
    // sideways, with the throw seeded from the band and the beat so the
    // same beat does not produce the same fan twice.
    points.forEach(([x, y], band) => {
      if (levels[band] < 0.3) {
        return;
      }
      for (let spark = 0; spark < 3; spark += 1) {
        const seed = band * 7 + spark * 13 + seconds * 31;
        state.sparks.push({
          x,
          y,
          vx: (noise(seed) - 0.5) * depth * 0.6,
          vy: -(0.4 + noise(seed + 1) * 0.8) * depth,
          at: seconds,
        });
      }
    });
  }
  // The tracker releases on the clock, not per frame: a per-frame factor
  // decayed three times faster at 60Hz than at the analyser's 22Hz, and the
  // beat threshold then meant a different thing on every machine.
  const elapsedMs =
    state.trackedAt < 0 ? 0 : Math.max(0, seconds - state.trackedAt) * 1000;
  state.trackedAt = seconds;
  state.beatLevel = Math.max(
    mean,
    state.beatLevel * (1 - getEaseFactor(elapsedMs, 110)),
  );
};

/** 0 when the beam is at rest, 1 at the peak of a flare. */
export const sawtoothFlare = (state: SawtoothScope, seconds: number) => {
  const age = (seconds - state.flareAt) / FLARE_LIFE;
  if (state.flareAt < 0 || age < 0 || age > 1) {
    return 0;
  }
  return 1 - age;
};

/** The sparks as one path of small dots, with gravity pulling them back. */
export const createSparkPath = (
  state: SawtoothScope,
  seconds: number,
  bottom: number,
  top: number,
) => {
  const path = new Path2D();
  const gravity = Math.max(1, bottom - top) * 2.4;
  state.sparks.forEach((spark) => {
    const t = seconds - spark.at;
    if (t < 0 || t > SPARK_LIFE) {
      return;
    }
    const x = spark.x + spark.vx * t;
    const y = spark.y + spark.vy * t + 0.5 * gravity * t * t;
    // A spark shrinks as it cools.
    const size = Math.max(0.5, 1.8 * (1 - t / SPARK_LIFE));
    path.moveTo(x + size, y);
    path.arc(x, y, size, 0, Math.PI * 2);
  });
  return path;
};

/** How strongly a ghost still glows: 1 fresh, 0 at the end of its life. */
export const ghostGlow = (ghost: IGhost, seconds: number) =>
  Math.max(0, 1 - (seconds - ghost.at) / GHOST_LIFE);
