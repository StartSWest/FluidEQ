import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import { ECHO_SQUEEZE, projectEchoWave } from 'common/graphEcho';

/**
 * The waves rolling away.
 *
 * Every tenth of a second of music-pace clock a copy of the live wave is let
 * go, and from then on it recedes: its depth grows from 0 to 1 over its
 * life, and `projectEchoWave` turns that depth into where it stands. A wave
 * let go on a beat is marked with the beat's strength and stays brighter
 * and heavier all the way back, so the rhythm reads as a row of bright
 * crests marching into the distance among the quiet ones.
 *
 * The waves rolled across nothing, which left the form as a stack of lines
 * on black. They now roll across a PLANE: rails running from the front edge
 * to the vanishing point, so the distance the projection describes is
 * actually visible, with a bloom on the horizon that swells with the bass
 * and a haze above it so the far half is sky rather than a void.
 *
 * Decided once per frame, before the curves, so a mirrored wave shows the
 * same rows without deciding them twice.
 */

/** Waves are let go every 100ms of clock and reach the horizon in 2.6s. */
export const EMIT_EVERY = 0.14;
export const WAVE_LIFE = 2.6;
/**
 * How many rows stand behind the live one.
 *
 * Each is a filled band the width of the scene, and the blending is what
 * this look costs to raster. Eighteen rows reach the horizon at the same
 * spacing and cost a third less than thirty did.
 */
const WAVE_LIMIT = 18;
/**
 * A snapshot keeps 72 columns of the wave, not the full trace. Thirty
 * waves of a few hundred points each, rebuilt every frame, was the frame;
 * at 72 columns a receding wave still has every crest it needs, and the
 * paths are written straight into Path2D rather than through text.
 */
export const SNAPSHOT_COLUMNS = 72;

/** How many rails run back to the vanishing point. */
const RAILS = 18;

/**
 * A row as STEPS, optionally shut against a floor.
 *
 * Every row is drawn the way the Staircase form draws: a flat run at each
 * column's own height and a riser between one column and the next. A
 * sloped polyline is a different drawing — it reads as a wire, and no
 * amount of resolution makes it read as blocks. This is where the blocks
 * come from; they are geometry, not a coarse raster.
 */
const trace = (wave: readonly Projected[], floor?: number) => {
  const path = new Path2D();
  if (wave.length < 2) {
    return path;
  }
  path.moveTo(wave[0][0], wave[0][1]);
  for (let index = 1; index < wave.length; index += 1) {
    path.lineTo(wave[index][0], wave[index - 1][1]);
    path.lineTo(wave[index][0], wave[index][1]);
  }
  if (floor !== undefined) {
    path.lineTo(wave[wave.length - 1][0], floor);
    path.lineTo(wave[0][0], floor);
    path.closePath();
  }
  return path;
};

export interface IEchoWave {
  points: Projected[];
  at: number;
  /** 0 for a quiet wave; up to 1 for one let go on a hard beat. */
  strength: number;
}

export const createEchoWaves = () => ({
  waves: [] as IEchoWave[],
  beatLevel: 0,
  /** The bass, eased, for the horizon's bloom. */
  bass: 0,
  trebleLevel: 0,
  trackedAt: -1,
  /** The beat strength waiting for the next wave to carry it. */
  pending: 0,
});
export type EchoWaves = ReturnType<typeof createEchoWaves>;

export const advanceEchoWaves = (
  state: EchoWaves,
  points: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
) => {
  if (!playing) {
    return;
  }
  state.waves = state.waves.filter(
    (wave) => seconds - wave.at <= WAVE_LIFE && seconds >= wave.at,
  );
  const depth = Math.max(1, bottom - top);
  const mean =
    points.reduce(
      (sum, [, y]) => sum + Math.max(0, Math.min(1, (bottom - y) / depth)),
      0,
    ) / Math.max(1, points.length);
  const levels = points.map(([, y]) =>
    Math.max(0, Math.min(1, (bottom - y) / depth)),
  );
  const bassTo = Math.max(1, Math.floor(levels.length * 0.3));
  const bass = levels.slice(0, bassTo).reduce((s, v) => s + v, 0) / bassTo;
  const trebleFrom = Math.floor(levels.length * 0.6);
  const treble =
    levels.slice(trebleFrom).reduce((s, v) => s + v, 0) /
    Math.max(1, levels.length - trebleFrom);
  const jump = mean - state.beatLevel;
  if (jump >= 0.05) {
    state.pending = Math.max(state.pending, Math.min(1, jump / 0.2));
  }
  // Released on the clock, not per frame — see the bubble storm's tracker.
  const elapsedMs =
    state.trackedAt < 0 ? 0 : Math.max(0, seconds - state.trackedAt) * 1000;
  state.trackedAt = seconds;
  state.beatLevel = Math.max(
    mean,
    state.beatLevel * (1 - getEaseFactor(elapsedMs, 110)),
  );
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  state.trebleLevel = Math.max(
    treble,
    state.trebleLevel * (1 - getEaseFactor(elapsedMs, 110)),
  );
  const newest = state.waves[0];
  if (!newest || seconds - newest.at >= EMIT_EVERY) {
    state.waves.unshift({
      points: points.map(([x, y]) => [x, y]),
      at: seconds,
      strength: state.pending,
    });
    state.pending = 0;
    if (state.waves.length > WAVE_LIMIT) {
      state.waves.length = WAVE_LIMIT;
    }
  }
};

export interface IEchoWavePaths {
  line: Path2D;
  /** Only built for a filled look; a stroked one never reads it. */
  body?: Path2D;
  /** 0 fresh, 1 at the horizon. */
  depth: number;
  strength: number;
}

/**
 * The frame's waves, oldest first so the painter draws back to front, and
 * the live wave shut against the floor as the figure.
 */
export const createEchoWavePaths = (
  state: EchoWaves,
  points: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  filled: boolean,
) => {
  const left = points[0]?.[0] ?? 0;
  const right = points[points.length - 1]?.[0] ?? 1;
  const height = Math.max(1, bottom - top);
  const waves: IEchoWavePaths[] = [];
  for (let index = state.waves.length - 1; index >= 0; index -= 1) {
    const wave = state.waves[index];
    const depth = (seconds - wave.at) / WAVE_LIFE;
    if (depth >= 0 && depth <= 1) {
      const projected = projectEchoWave(
        wave.points,
        depth,
        left,
        right,
        bottom,
        height,
      );
      waves.push({
        line: trace(projected.wave),
        body: filled ? trace(projected.wave, projected.floor) : undefined,
        depth,
        strength: wave.strength,
      });
    }
  }
  const live = projectEchoWave(points, 0, left, right, bottom, height);
  const horizon = bottom - height * 0.6;
  const centre = (left + right) / 2;

  /**
   * The plane the waves roll across: rails from the front edge back to
   * where the waves themselves end up. They take the projection's own
   * squeeze rather than meeting at a point, so a rail and the end of a
   * far row land on the same place — which is what perspective means and
   * what the two of them disagreeing looked like.
   */
  const rails = new Path2D();
  for (let rail = 0; rail <= RAILS; rail += 1) {
    const at = left + ((right - left) * rail) / RAILS;
    rails.moveTo(at, bottom);
    rails.lineTo(centre + (at - centre) * (1 - ECHO_SQUEEZE), horizon);
  }

  return {
    waves,
    shape: trace(live.wave, live.floor),
    horizon,
    rails,
    /** How far the horizon's bloom reaches, in pixels. */
    bloom: height * (0.05 + state.bass * 0.12),
    bass: state.bass,
  };
};
