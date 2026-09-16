import { getEaseFactor } from './smoothing';

/**
 * What the music is doing, in four numbers, a pulse and a moment.
 *
 * The live frame carries a spectrum and a waveform and nothing else; every
 * scene that wanted a beat or a bass level has so far derived its own, in its
 * own file, with its own thresholds. This is that derivation once, pure and
 * frame-rate independent, so the GPU scenes, the ambient layer, the lamps and
 * the Studio's meters read one answer to "is this a beat".
 *
 * How it used to work, and what was wrong with it, measured over sixty
 * seconds of each of five tracks through this same pipeline:
 *
 * - A beat was the broadband mean rising a twentieth of the plot's range
 *   above a decaying envelope. That fired 192 to 287 times a minute on every
 *   track, with gaps from 0.12 s to 0.6 s: two or three times a real pulse,
 *   and irregular, because a mean over 20 Hz to 16 kHz barely moves when a
 *   kick lands and moves plenty when anything else does.
 * - The four levels were means of decibels mapped on the plot's own scale, so
 *   each band used whatever part of 0..1 that band's music happens to sit in.
 *   Treble measured 0.00 to 0.21 across those tracks - 0.00 to 0.04 on one -
 *   and the overall level never passed half. A scene asking for treble got
 *   almost nothing, whatever the song.
 *
 * So: onsets come from spectral flux - how much of the spectrum got louder
 * since the last frame, which is what an onset is - judged against its own
 * recent history rather than a fixed number, and gated on the pulse the music
 * has been keeping. Levels are mapped between a floor and a ceiling each band
 * finds for itself, so every band uses its range on every song.
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
  /**
   * A big moment - a drop, a chorus arriving, a crash - as an envelope that
   * rises over a few frames and falls away over a second and a half. Zero
   * most of the time; never more than one of them going at once.
   */
  accent: number;
  /** Counts up by one at each accent, for a scene that wants a fresh seed. */
  accentSerial: number;
}

/** A band's own floor and ceiling, which it finds from what it hears. */
interface IBandRange {
  floor: number;
  ceiling: number;
}

export interface IEnergyState {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** Milliseconds of flash remaining; negative when there is none. */
  flashLeftMs: number;
  /** The last frame's band energies, for the flux. */
  previous: number[];
  /** What flux has been running at lately, and how much it varies. */
  fluxMean: number;
  fluxVariation: number;
  /** Since the last onset, and the pulse the music has been keeping. */
  sinceBeatMs: number;
  beatGapMs: number;
  /** The accent: its envelope, how long since the last, and its count. */
  accent: number;
  sinceAccentMs: number;
  accentSerial: number;
  /** The ranges the four levels are mapped into. */
  levelRange: IBandRange;
  bassRange: IBandRange;
  midRange: IBandRange;
  trebleRange: IBandRange;
}

export const BEAT_FLASH_MS = 200;
/** No two onsets closer than this: 240 a minute is past any dance floor. */
export const BEAT_REFRACTORY_MS = 250;
/** How far above its recent run a flux has to stand to count as an onset. */
export const BEAT_FLUX_MARGIN = 1.6;
/**
 * What the flux is taken to have been running at before anything is heard.
 * Set to nothing, the first frames of any rise stood above a threshold of
 * nothing and counted as onsets - a fade-in fired ten of them. Starting the
 * memory above what music reaches lets it fall to the real level within a
 * second while nothing can beat it on the way.
 */
export const FLUX_MEMORY_START = 0.03;
export const FLUX_SPREAD_START = 0.015;
/** Below this, nothing is an onset whatever the memory says: this is silence. */
export const MIN_ONSET_FLUX = 0.002;
/** A moment has to be this much bigger than the run of onsets to be an accent. */
export const ACCENT_FLUX_MARGIN = 4.5;
export const ACCENT_GAP_MS = 7_000;
/** And the music has to be somewhere near its own loudest, not merely busy. */
export const ACCENT_LEVEL = 0.55;
export const ACCENT_FALL_MS = 1_500;
/**
 * How long the moment takes to arrive. Measured against the brightness
 * limiter every member's scene is drawn through: a scene may move the average
 * brightness of a quarter of the frame by half of full scale per second, and
 * a moment that fills a third of a cell with light has to take at least a
 * fifth of a second to do it or the limiter blends the picture into the last
 * one and the scene smears. At 90 ms, Crystal's band of light across the
 * floor measured seven times over that limit and only a seventh of each new
 * frame reached the panel.
 */
export const ACCENT_RISE_MS = 300;

/**
 * How quickly the four levels fall away. They do not rise slowly at all.
 *
 * This was one half-life for both directions, and a kick reached half its
 * height 45 ms after the analyser had already heard it — the single largest
 * delay between the music and a scene, larger than the capture, the pump and
 * the GPU put together. It also overruled every scene's own `attack`: the
 * response's attack of zero promises a rise that arrives at once, and it
 * arrived eased regardless. Replaying a recorded track through the graph
 * pipeline at 60 Hz, easing only the fall took the bass from 67 ms behind the
 * audio to 52 ms with nothing else changed.
 *
 * The fall keeps its easing because that is what the easing was for: the
 * measurement comes in steps, and a level dropping to each one would flicker.
 * A scene that wants its rises softened says so with its response's attack.
 */
const LEVEL_RELEASE_HALF_LIFE_MS = 45;

/**
 * How fast a band's floor and ceiling follow the music. Slow on purpose: they
 * are what the band's own range is, and if they chased the music the scene
 * would see a level that never moved.
 */
const RANGE_RISE_HALF_LIFE_MS = 900;
const RANGE_FALL_HALF_LIFE_MS = 4_000;
/** No band is mapped across less than this, or silence becomes loud music. */
const MIN_RANGE = 0.05;
/** How much of a level is the plain reading rather than its place in range. */
const ABSOLUTE_SHARE = 0.35;

const followLevel = (from: number, to: number, elapsedMs: number): number =>
  to >= from
    ? to
    : from + (to - from) * getEaseFactor(elapsedMs, LEVEL_RELEASE_HALF_LIFE_MS);

/**
 * Band edges in Hertz.
 *
 * Bass stops where a kick's body ends and a snare's begins; treble starts
 * where sibilance and cymbals live. Anything under 20 Hz or over 16 kHz is
 * ignored — the analyser reports it, but it is noise floor and roll-off, and
 * letting it into the mean made silence read as quiet music.
 */
export const BASS_HZ: readonly [number, number] = [20, 160];
export const MID_HZ: readonly [number, number] = [160, 2_000];
export const TREBLE_HZ: readonly [number, number] = [2_000, 16_000];

/** The bands the flux is measured over: a third of an octave each, roughly. */
const FLUX_BANDS = 24;
const FLUX_LOW_HZ = 40;
const FLUX_HIGH_HZ = 12_000;

// A band starts with the whole scale as its range and closes in on what it
// actually hears, rather than starting closed: opened from nothing, the first
// second of a song read as silence while the range grew to fit it.
const newRange = (): IBandRange => ({ floor: 0, ceiling: 1 });

export const createEnergyState = (): IEnergyState => ({
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  flashLeftMs: -1,
  previous: [],
  fluxMean: FLUX_MEMORY_START,
  fluxVariation: FLUX_SPREAD_START,
  sinceBeatMs: BEAT_REFRACTORY_MS,
  beatGapMs: 500,
  accent: 0,
  sinceAccentMs: ACCENT_GAP_MS,
  accentSerial: 0,
  levelRange: newRange(),
  bassRange: newRange(),
  midRange: newRange(),
  trebleRange: newRange(),
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
 * Where `value` stands between the floor and the ceiling this band has been
 * keeping, and those moved on to include it. The floor and the ceiling close
 * in slowly while the music sits still, so a song that goes quiet does not
 * leave the band stuck at the bottom of the loud one's range.
 */
const placeInRange = (
  range: IBandRange,
  value: number,
  elapsedMs: number,
): number => {
  const towardsValue = getEaseFactor(elapsedMs, RANGE_RISE_HALF_LIFE_MS);
  const towardsMiddle = getEaseFactor(elapsedMs, RANGE_FALL_HALF_LIFE_MS);
  if (value < range.floor) {
    range.floor += (value - range.floor) * towardsValue;
  } else {
    range.floor += (value - range.floor) * towardsMiddle * 0.5;
  }
  if (value > range.ceiling) {
    range.ceiling += (value - range.ceiling) * towardsValue;
  } else {
    range.ceiling += (value - range.ceiling) * towardsMiddle * 0.5;
  }
  // A band with almost nothing in it - the top end of a warm mix - keeps a
  // floor under its range rather than being mapped across it, so it reads as
  // the little it is doing instead of reading as zero forever.
  const depth = Math.max(MIN_RANGE, range.ceiling - range.floor);
  const placed = Math.max(0, Math.min(1, (value - range.floor) / depth));
  // Most of what a scene sees is where the band stands in its own range,
  // which is what makes it move on any song; the rest is the plain reading,
  // so silence is still nothing and a loud steady tone is still loud. All
  // range and no reading, a held note faded to zero as its range closed on
  // it; all reading and no range, the top end of a warm mix never left the
  // floor (measured at 0.00 to 0.04 over a minute).
  return ABSOLUTE_SHARE * value + (1 - ABSOLUTE_SHARE) * placed;
};

/** The spectrum in a handful of bands, each 0..1 on the plot's own scale. */
const bandEnergies = (
  points: readonly ISpectrumPoint[],
  minGain: number,
  maxGain: number,
): number[] => {
  const depth = Math.max(1e-6, maxGain - minGain);
  const sums = new Array<number>(FLUX_BANDS).fill(0);
  const counts = new Array<number>(FLUX_BANDS).fill(0);
  const span = Math.log(FLUX_HIGH_HZ / FLUX_LOW_HZ);
  points.forEach((point) => {
    if (point.x < FLUX_LOW_HZ || point.x >= FLUX_HIGH_HZ) {
      return;
    }
    const at = Math.min(
      FLUX_BANDS - 1,
      Math.floor((Math.log(point.x / FLUX_LOW_HZ) / span) * FLUX_BANDS),
    );
    sums[at] += Math.max(0, Math.min(1, (point.y - minGain) / depth));
    counts[at] += 1;
  });
  return sums.map((sum, at) => (counts[at] === 0 ? 0 : sum / counts[at]));
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
      accent: state.accent,
      accentSerial: state.accentSerial,
    };
  }
  const step = Math.max(1, Math.min(200, elapsedMs));
  const bass = meanIn(points, BASS_HZ, minGain, maxGain);
  const mid = meanIn(points, MID_HZ, minGain, maxGain);
  const treble = meanIn(points, TREBLE_HZ, minGain, maxGain);
  const mean = meanIn(points, [BASS_HZ[0], TREBLE_HZ[1]], minGain, maxGain);

  state.level = followLevel(
    state.level,
    placeInRange(state.levelRange, mean, step),
    step,
  );
  state.bass = followLevel(
    state.bass,
    placeInRange(state.bassRange, bass, step),
    step,
  );
  state.mid = followLevel(
    state.mid,
    placeInRange(state.midRange, mid, step),
    step,
  );
  state.treble = followLevel(
    state.treble,
    placeInRange(state.trebleRange, treble, step),
    step,
  );

  // The flux: how much of the spectrum got louder since the last frame, and
  // only louder - what comes off a note ending is not an onset.
  const bands = bandEnergies(points, minGain, maxGain);
  let flux = 0;
  if (state.previous.length === bands.length) {
    for (let at = 0; at < bands.length; at += 1) {
      flux += Math.max(0, bands[at] - state.previous[at]);
    }
    flux /= bands.length;
  }
  state.previous = bands;

  // What flux has been running at, and how far it usually strays: an onset is
  // a flux standing well clear of both. Judged against a fixed number instead,
  // the same threshold was every beat of a loud passage and none of a quiet
  // one.
  const memory = getEaseFactor(step, 700);
  const excess = Math.abs(flux - state.fluxMean);
  state.fluxMean += (flux - state.fluxMean) * memory;
  state.fluxVariation += (excess - state.fluxVariation) * memory;
  const bar = state.fluxMean + BEAT_FLUX_MARGIN * state.fluxVariation;

  state.sinceBeatMs += step;
  state.sinceAccentMs += step;
  // The pulse the music has been keeping, as the running middle of the gaps
  // between onsets. An onset arriving at less than two thirds of it is the
  // snare inside the beat, or a strum, and does not restart the pulse.
  const tooSoon = Math.max(BEAT_REFRACTORY_MS, state.beatGapMs * 0.66);
  const isOnset =
    flux > bar && flux > MIN_ONSET_FLUX && state.sinceBeatMs >= tooSoon;
  if (isOnset) {
    state.beatGapMs += (state.sinceBeatMs - state.beatGapMs) * 0.25;
    state.beatGapMs = Math.max(250, Math.min(1_500, state.beatGapMs));
    state.sinceBeatMs = 0;
    state.flashLeftMs = BEAT_FLASH_MS;
  } else {
    state.flashLeftMs -= step;
  }

  // An accent is an onset that dwarfs the ones around it, and they are kept
  // apart so a scene can lean on one: a chorus arriving, not every crash.
  const accentBar = state.fluxMean + ACCENT_FLUX_MARGIN * state.fluxVariation;
  if (
    isOnset &&
    flux > accentBar &&
    state.level >= ACCENT_LEVEL &&
    state.sinceAccentMs >= ACCENT_GAP_MS
  ) {
    state.sinceAccentMs = 0;
    state.accentSerial = (state.accentSerial + 1) % 4096;
  }
  // Its envelope rises over a few frames rather than in one, because a scene
  // is free to put it in an angle, and a number that goes from nothing to one
  // between two frames moves a stone as fast as the frames are short.
  const wanted = state.sinceAccentMs < ACCENT_FALL_MS ? 1 : 0;
  const shape = getEaseFactor(
    step,
    wanted > state.accent ? ACCENT_RISE_MS : ACCENT_FALL_MS / 3,
  );
  state.accent += (wanted - state.accent) * shape;
  if (state.accent < 0.002) {
    state.accent = 0;
  }

  return {
    level: state.level,
    bass: state.bass,
    mid: state.mid,
    treble: state.treble,
    beat: state.flashLeftMs > 0 ? state.flashLeftMs / BEAT_FLASH_MS : 0,
    accent: state.accent,
    accentSerial: state.accentSerial,
  };
};
