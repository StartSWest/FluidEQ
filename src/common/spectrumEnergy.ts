import { getEaseFactor } from './smoothing';

/**
 * What the music is doing, in four numbers and a pulse.
 *
 * The live frame carries a spectrum and a waveform and nothing else; every
 * scene that wanted a beat or a bass level has so far derived its own, in its
 * own file, with its own thresholds. This is that derivation once, pure and
 * frame-rate independent, so the GPU scenes and — later, if wanted — the 2D
 * ones read one answer to "is this a beat".
 *
 * The beat detector is lifted from the road trip scene, where it was tuned by
 * ear: a beat is the mean level rising a twentieth of the range above a
 * slowly-decaying envelope. The envelope decays with a 110 ms half-life so a
 * sustained loud passage stops registering after the first hit, and the flash
 * itself lasts a fifth of a second — long enough to see, short enough that a
 * 140 BPM kick reads as separate hits.
 */

export interface ISpectrumPoint {
  /** Hertz. */
  x: number;
  /** Decibels, on the plot's gain scale. */
  y: number;
}

export interface ISpectrumEnergy {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** 1 at the beat, 0 once the flash is over. */
  beat: number;
}

export interface IEnergyState {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  beatLevel: number;
  /** Milliseconds of flash remaining; negative when there is none. */
  flashLeftMs: number;
}

export const BEAT_THRESHOLD = 0.05;
export const BEAT_ENVELOPE_HALF_LIFE_MS = 110;
export const BEAT_FLASH_MS = 200;
/** How quickly the four levels follow the measurement. */
const LEVEL_HALF_LIFE_MS = 45;

/**
 * Band edges in Hertz.
 *
 * Bass stops where a kick's body ends and a snare's begins; treble starts
 * where sibilance and cymbals live. Anything under 20 Hz or over 16 kHz is
 * ignored — the analyser reports it, but it is noise floor and roll-off, and
 * letting it into the mean made silence read as quiet music.
 */
const BASS_HZ: readonly [number, number] = [20, 160];
const MID_HZ: readonly [number, number] = [160, 2_000];
const TREBLE_HZ: readonly [number, number] = [2_000, 16_000];

export const createEnergyState = (): IEnergyState => ({
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beatLevel: 0,
  flashLeftMs: -1,
});

const meanIn = (
  points: readonly ISpectrumPoint[],
  range: readonly [number, number],
  minGain: number,
  maxGain: number,
): number => {
  const depth = Math.max(1e-6, maxGain - minGain);
  let sum = 0;
  let count = 0;
  points.forEach((point) => {
    if (point.x >= range[0] && point.x < range[1]) {
      sum += Math.max(0, Math.min(1, (point.y - minGain) / depth));
      count += 1;
    }
  });
  return count === 0 ? 0 : sum / count;
};

/**
 * One step. Returns the eased values; mutates `state` to carry them forward.
 *
 * `playing` false freezes everything where it is rather than decaying to
 * silence — a paused song should hold its picture, and the caller already
 * stops the frame loop when nothing is moving.
 */
export const advanceEnergy = (
  state: IEnergyState,
  points: readonly ISpectrumPoint[],
  minGain: number,
  maxGain: number,
  elapsedMs: number,
  playing: boolean,
): ISpectrumEnergy => {
  if (!playing) {
    return {
      level: state.level,
      bass: state.bass,
      mid: state.mid,
      treble: state.treble,
      beat: state.flashLeftMs > 0 ? state.flashLeftMs / BEAT_FLASH_MS : 0,
    };
  }
  const bass = meanIn(points, BASS_HZ, minGain, maxGain);
  const mid = meanIn(points, MID_HZ, minGain, maxGain);
  const treble = meanIn(points, TREBLE_HZ, minGain, maxGain);
  const mean = meanIn(points, [BASS_HZ[0], TREBLE_HZ[1]], minGain, maxGain);

  const follow = getEaseFactor(elapsedMs, LEVEL_HALF_LIFE_MS);
  state.level += (mean - state.level) * follow;
  state.bass += (bass - state.bass) * follow;
  state.mid += (mid - state.mid) * follow;
  state.treble += (treble - state.treble) * follow;

  if (mean - state.beatLevel >= BEAT_THRESHOLD) {
    state.flashLeftMs = BEAT_FLASH_MS;
  } else {
    state.flashLeftMs -= elapsedMs;
  }
  state.beatLevel = Math.max(
    mean,
    state.beatLevel *
      (1 - getEaseFactor(elapsedMs, BEAT_ENVELOPE_HALF_LIFE_MS)),
  );

  return {
    level: state.level,
    bass: state.bass,
    mid: state.mid,
    treble: state.treble,
    beat: state.flashLeftMs > 0 ? state.flashLeftMs / BEAT_FLASH_MS : 0,
  };
};
