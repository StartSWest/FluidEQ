/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createRhythmClock,
  followClock,
  holdOnset,
  keepOnset,
  restartClock,
  type IRhythmClock,
} from './rhythmClock';
import {
  bandRises,
  beatStrength,
  drumFeatures,
  followBandTops,
  gateRises,
  keepBandFrame,
  stepRises,
  tempoStrength,
  type IBandFrame,
} from './rhythmDrums';
import {
  createDrumKit,
  HAT_HALF_LIFE_MS,
  hearKit,
  KICK_HALF_LIFE_MS,
  quietKit,
  restartKit,
  SNARE_HALF_LIFE_MS,
  type TDrumKit,
} from './rhythmKit';
import {
  createSectionState,
  DROP_HALF_LIFE_MS,
  followSection,
  intensityOf,
  quietSection,
  type ISectionState,
} from './rhythmSection';
import {
  createSpectrumDrumState,
  readSpectrumDrums,
  type IRhythmSpectrum,
  type ISpectrumDrumState,
} from './rhythmSpectrum';
import { estimateTempo, MAX_TEMPO, MIN_TEMPO, OSS_HOP_MS } from './rhythmTempo';
import { getEaseFactor } from './smoothing';

export {
  DROP_HALF_LIFE_MS,
  estimateTempo,
  HAT_HALF_LIFE_MS,
  KICK_HALF_LIFE_MS,
  MAX_TEMPO,
  MIN_TEMPO,
  OSS_HOP_MS,
  SNARE_HALF_LIFE_MS,
};

/**
 * The music's time, for scenes that dance to it: the tempo, a clock that
 * lands on the beat instead of after it, where the bar is, the drums one by
 * one, and how intense, building or dropping the song is.
 *
 * The beat a scene had before this (`ISpectrumEnergy.beat`) is a flash that
 * starts when an onset is HEARD, so anything a scene moves with it moves
 * after the beat, by the length of the flash's rise. A dancer who steps after
 * the beat looks drunk. So this keeps a clock: an oscillator at the song's
 * tempo whose phase reaches 1 exactly where the next beat is expected, and
 * runs on through a fill or a quiet bar the way a drummer counts through it.
 *
 * Everything is worked out from the sound as it is read every ten
 * milliseconds (`soundHops.ts`), whatever the screen is doing: the drums by a
 * detector each in its own part of the spectrum, shown only while they die
 * away as drums do (`rhythmKit.ts`); the tempo from the autocorrelation of the
 * onsets over the last ten seconds, and where the beat falls by laying a grid
 * of that tempo over the same seconds (`rhythmTempo.ts`); the clock steered
 * onto that grid, never pulled onto single kicks; the bar by which beat of
 * four carries the heaviest kick; the song's shape from its loudness
 * (`rhythmSection.ts`). None of it is certain, and `confidence` says how sure
 * it is: a scene fades what it hangs on the tempo by that, and in silence
 * the clock holds still and the confidence falls, so a scene that forgets to
 * is still calm between songs.
 */

export interface ISceneRhythm {
  /** 0 on a beat, rising evenly to 1 where the next beat is expected. */
  beatPhase: number;
  /** 0 on the first beat of a bar of four, rising evenly to 1 at the next. */
  barPhase: number;
  /** Beats a minute; 0 until one has been heard. */
  tempo: number;
  /** How sure the tempo and both phases are, 0..1. */
  confidence: number;
  /** Each drum as an envelope: 1 at its hit, falling away quickly. */
  kick: number;
  snare: number;
  hat: number;
  /** How intense this part of the song is against the rest of it, 0..1. */
  intensity: number;
  /** 0..1 while the music is building towards something. */
  build: number;
  /** 1 when a drop lands - the song arriving after a build or a break. */
  drop: number;
  /** Counts the drops, so each one can look different. */
  dropSerial: number;
  /**
   * Whether the clock is moving now: music playing and heard. Not given to
   * scenes; it tells a drawing that repeats this reading between readings
   * whether to carry the phases on by the tempo, or hold them.
   */
  running: boolean;
}

export const SILENT_RHYTHM: ISceneRhythm = {
  beatPhase: 0,
  barPhase: 0,
  tempo: 0,
  confidence: 0,
  kick: 0,
  snare: 0,
  hat: 0,
  intensity: 0,
  build: 0,
  drop: 0,
  dropSerial: 0,
  running: false,
};

/** One step of the music, as `advanceRhythm` hears it. */
export interface IRhythmHeard {
  /** The rhythm's 24 bands, absolute: 0..1 over 100 dB (`soundHops.ts`). */
  bands: readonly number[];
  /**
   * The two windows' own bins, which the drums are heard in. Without them -
   * music sent from another computer, which comes as a spectrum only - the
   * drums are heard in the bands.
   */
  spectrum?: IRhythmSpectrum;
}

/** What the last step heard, for the pulse and the accent (`spectrumEnergy.ts`). */
export interface IRhythmStep {
  /** A kick or a snare shown hitting in this step. */
  kick: boolean;
  snare: boolean;
  /** Since a kick or a snare was last shown, in music time. */
  drumsSinceMs: number;
  /** How much of the spectrum rose over the last 25 ms, all bands alike. */
  broad: number;
}

export interface IRhythmState extends IRhythmClock {
  /** Music time since the start, for measuring the bands' rises. */
  clockMs: number;
  /** The last band frames, for each band's rise. */
  frames: IBandFrame[];
  /** How loud each band has been at its loudest lately (`gateRises`). */
  bandTops: Float32Array;
  /**
   * How long nothing has played. Past NEW_SONG_QUIET_MS what comes next is
   * taken as a new song: its own onsets only, and its tempo taken at once.
   */
  quietMs: number;
  /** The kick, the snare and the hats (`rhythmKit.ts`). */
  kit: TDrumKit;
  section: ISectionState;
  /** The last frames of the two windows' bins, for the drums' rises. */
  spectrumDrums: ISpectrumDrumState;
  /** What the last step heard. */
  step: IRhythmStep;
}

/**
 * The longest step taken at once. Past it time was lost - the window hidden
 * while the music played on, the page stalled - and the clock no longer knows
 * where the beat is: it is set onto the onsets again once they are heard.
 */
const MAX_STEP_MS = 200;
/** How quickly the certainty and what was heard fade with nothing playing. */
const SILENT_FADE_MS = 1_000;

/** How sure the clock has to be before the drums lean on their patterns. */
const PATTERN_SURE = 0.4;

/**
 * The quietest a band can be with music still playing: -80 dBFS on the
 * bands' scale. Over fifteen songs the loudest band never fell below -78 in a
 * minute of each, while the music's level - its place between the quietest
 * and loudest it has lately been - fell under the threshold this used to be
 * judged by in up to one frame in ten: every quiet moment of a bar, the last
 * third of a beat in a hip-hop groove, stopped the clock, and it spent the
 * beats after catching up, up to 200 ms behind the drums.
 */
const AUDIBLE = 0.2;

/** The loudest of the bands. */
const loudestOf = (bands: readonly number[]) => {
  let loudest = 0;
  bands.forEach((band) => {
    loudest = Math.max(loudest, band);
  });
  return loudest;
};

/**
 * Nothing heard for this long is the gap between two songs: the clock holds,
 * and the next song's tempo is its own, heard from its own onsets, and taken
 * without a vote. A shorter silence is a rest inside the song, counted
 * through.
 */
const NEW_SONG_QUIET_MS = 1_500;

export const createRhythmState = (): IRhythmState => ({
  ...createRhythmClock(),
  clockMs: 0,
  frames: [],
  bandTops: new Float32Array(24),
  quietMs: 0,
  kit: createDrumKit(),
  section: createSectionState(),
  spectrumDrums: createSpectrumDrumState(),
  step: { kick: false, snare: false, drumsSinceMs: 60_000, broad: 0 },
});

const read = (state: IRhythmState, running: boolean): ISceneRhythm => {
  const inBar = (((state.beats - state.downSlot) % 4) + 4) % 4;
  return {
    beatPhase: state.phase,
    barPhase: (inBar + state.phase) / 4,
    tempo: state.tempo,
    confidence: state.confidence,
    kick: state.kit.kick.envelope,
    snare: state.kit.snare.envelope,
    hat: state.kit.hat.envelope,
    intensity: intensityOf(state.section),
    build: state.section.build,
    drop: state.section.drop,
    dropSerial: state.section.dropSerial,
    running,
  };
};

/**
 * The next song, after a gap: its tempo from its own onsets alone, and its
 * rises measured from its own first step, against its own levels; its own
 * drums, range and builds. The drops keep counting.
 */
const startSong = (state: IRhythmState) => {
  restartClock(state);
  state.frames.length = 0;
  state.bandTops.fill(0);
  state.spectrumDrums = createSpectrumDrumState();
  restartKit(state.kit);
  state.section = {
    ...createSectionState(),
    dropSerial: state.section.dropSerial,
  };
};

/**
 * The kit's step: each drum judged against where it has been playing, once
 * the clock is sure enough for "where in the bar" to mean something - the
 * clock as it will stand at the end of this step.
 */
const listenToDrums = (
  state: IRhythmState,
  features: { kick: number; snare: number; hat: number },
  bands: readonly number[],
  step: number,
) => {
  const sure = state.tempo > 0 && state.confidence >= PATTERN_SURE;
  const shown = hearKit(
    state.kit,
    features,
    bands,
    state.clockMs,
    sure
      ? {
          beats: state.beats,
          phase: state.phase + (step * state.tempo) / 60_000,
          tempo: state.tempo,
        }
      : undefined,
    step,
  );
  state.step.kick = shown.kick;
  state.step.snare = shown.snare;
  state.step.drumsSinceMs = Math.min(
    state.kit.kick.shownSinceMs,
    state.kit.snare.shownSinceMs,
  );
};

/**
 * A paused song, or the music stopped: the clock holds where it is, and what
 * was heard fades - the drums, a drop, a build, and the certainty, so a
 * dancer weighed by it comes to rest instead of freezing mid step. The rises
 * start again from the next sound: measured against the last one heard
 * before the silence, whatever came after it rose by the whole difference in
 * a single step, and the first beat of a song after a pause was a hit on
 * every drum.
 */
const holdQuiet = (state: IRhythmState, quietMs: number): ISceneRhythm => {
  if (quietMs > 0) {
    const keep = 1 - getEaseFactor(quietMs, SILENT_FADE_MS);
    state.confidence *= keep;
    quietSection(state.section, quietMs, keep);
    quietKit(state.kit, quietMs);
  }
  state.frames.length = 0;
  state.spectrumDrums.frames.length = 0;
  return read(state, false);
};

/**
 * One step of the music: `heard` is what it sounded like, undefined when
 * nothing was; `elapsedMs` how much music time the step stands for.
 * `playing` false holds everything where it is, as a paused song holds its
 * picture.
 */
export const advanceRhythm = (
  state: IRhythmState,
  heard: IRhythmHeard | undefined,
  elapsedMs: number,
  playing: boolean,
): ISceneRhythm => {
  state.step.kick = false;
  state.step.snare = false;
  state.step.broad = 0;
  const quiet = Math.max(0, elapsedMs);
  if (!playing || !heard) {
    state.quietMs += quiet;
    return holdQuiet(state, quiet);
  }
  const { bands } = heard;
  const audible = loudestOf(bands) >= AUDIBLE;
  if (!audible) {
    state.quietMs += quiet;
    if (state.quietMs >= NEW_SONG_QUIET_MS) {
      return holdQuiet(state, quiet);
    }
    // A rest inside the music: counted through, the way a drummer counts
    // through a stop.
  }
  if (elapsedMs > MAX_STEP_MS) {
    state.aligned = false;
  }
  const step = Math.max(1, Math.min(MAX_STEP_MS, elapsedMs));
  if (audible) {
    if (state.quietMs >= NEW_SONG_QUIET_MS) {
      startSong(state);
    }
    state.quietMs = 0;
  }
  state.clockMs += step;

  followBandTops(state.bandTops, bands, step);
  const rises = gateRises(
    bandRises(state.frames, state.clockMs, bands),
    bands,
    state.bandTops,
  );
  const stepped = gateRises(
    stepRises(state.frames, bands),
    bands,
    state.bandTops,
  );
  keepBandFrame(state.frames, state.clockMs, bands);
  const drums = drumFeatures(rises);
  state.step.broad = drums.broad;
  listenToDrums(
    state,
    heard.spectrum
      ? readSpectrumDrums(state.spectrumDrums, state.clockMs, heard.spectrum)
      : drums,
    bands,
    step,
  );
  holdOnset(state.tempoOnsets, tempoStrength(rises, bands), step);
  keepOnset(
    state.beatOnsets,
    beatStrength(
      stepped,
      state.kit.kick.detector.peak,
      state.kit.snare.detector.peak,
    ),
    step,
  );
  // How hard, not whether: every kick's envelope is 1 at its hit, and the
  // bar's first beat is told by the kick that lands heaviest.
  followClock(state, step, drums.kick - 0.5 * drums.snare);
  followSection(
    state.section,
    bands,
    step,
    audible,
    state.kit.kick.detector.sinceMs < 500,
  );
  return read(state, true);
};
