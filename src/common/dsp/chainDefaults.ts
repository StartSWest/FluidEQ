/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  MAXIMIZER_MAX_CEILING_DB,
  MAXIMIZER_MAX_LOOK_AHEAD_MS,
  MAXIMIZER_MIN_LOOK_AHEAD_MS,
  MAXIMIZER_MIN_RELEASE_MS,
} from './chainStageSettings';
import { NOISE_HUM_MAX_HARMONICS } from './noiseProfile';
import {
  EQ_BAND_COUNT,
  IDspSettings,
  IEqBandSettings,
  IRange,
} from './chainSettings';
import { qualityForRack } from '../bandQuality';
import { defaultCrossfadeShape } from './crossfadeShape';
import { DEFAULT_TREBLE_DESIGN } from '../filterDesign';
import { BASS_PUNCH_PRESET_BY_ID } from './bassPunchPresets';

// The rack as it starts - DSP_DEFAULTS and the EQ rack it is built on - and
// the ranges every setting is held to when it is read (clampDspSettings, in
// chain.ts). chain.ts re-exports what was public.

export const RANGES = {
  crossfadeDurationMs: { min: 250, max: 12_000 },
  exciterBandRange: { min: 0, max: 1 },
  alignAmount: { min: 0, max: 1 },
  /**
   * The drive dial cannot reach distortion, and that is the point.
   *
   * It used to stop at 10, where `tanh` is a hard clipper. Hard-clipping three
   * octaves of music does not make harmonics, it makes intermodulation — the
   * sum and difference of every pair of partials, which is hash. So the top
   * two thirds of the dial produced distortion, and anybody trying to hear
   * what the control does turned it up and found exactly that. Reported, at
   * length, and correctly.
   *
   * A Type C cannot be driven there. Its knee belongs to a diode and the
   * control only moves the signal into it; there is no position of any front
   * panel control that turns it into a fuzz box. 3.5 is where the curve here
   * stops being a colour and starts being a clipper, so that is where the dial
   * stops. Every position of it is now usable, which is the property a control
   * on a piece of audio equipment is supposed to have.
   */
  exciterDrive: { min: 1, max: 3.5 },
  exciterMix: { min: 0, max: 1 },
  /**
   * Texture stops short of fully symmetric, for the same kind of reason.
   *
   * At 1 the curve is symmetric and produces ODD harmonics only, and odd
   * harmonics in the top octaves are the harshness rather than the sparkle —
   * it is the setting that sounds worst and it sat at the end of the dial
   * where people naturally try it. The Type C's non-linearity is one-sided and
   * cannot be made symmetric at all, so 0.7 keeps a real spread of characters
   * while always leaving some even order in the result.
   */
  exciterTexture: { min: 0, max: 0.7 },
  organicAmount: { min: 0, max: 1 },
  organicRange: { min: 0, max: 1 },
  // The focus can sit anywhere in the audible band, even though the processing
  // around that focus deliberately remains band-limited.
  //
  // It started at 150-2500 on the reasoning that a thin midrange is what this
  // stage is for. That reasoning was right about the common case and wrong as
  // a limit: a driver can be hollow anywhere, and refusing to put body under
  // 150 Hz or above 2.5k is answering a question the user was asking. Range
  // widens the chosen region without combining unrelated ends of the spectrum
  // inside one non-linearity.
  organicFocusHz: { min: 40, max: 16_000 },
  bassSplitHz: { min: 40, max: 200 },
  bassForgeDriveDb: { min: 0, max: 12 },
  bassAmount: { min: 0, max: 1 },
  bassPunchMix: { min: 0, max: 2 },
  /**
   * Forge's two generators allow extra synthesis gain.
   *
   * Separate from `bassAmount` rather than a widening of it, because that
   * range also bounds Forge's `mix` and Punch's `bloomAmount` and `duck` —
   * all three are fractions of something that already exists, and a fraction
   * above one is not a bigger effect, it is a fraction that stopped meaning
   * what it says.
   *
   * Sub and Presence are not fractions. They are how much NEW content the
   * generators make relative to the band, and they are multiplied by `mix`
   * before they arrive. The catalogue's profiles mix around 0.5, so a ceiling
   * of one meant the top of both dials delivered half of what the stage can
   * do. `kMaxAmount` in `bass_forge.cpp` holds the measurement, including why
   * the ceiling is two and not four and why the level rule survives it.
   */
  bassForgeAmount: { min: 0, max: 2 },
  /**
   * The full even-to-odd span, unlike the Exciter's 0.7 ceiling.
   *
   * That ceiling is about `band_even_weight`, which drives a diode character
   * curve whose far end is symmetric and harsh across presence and air. This
   * maps straight to `feq_harmonic_sample`'s `even_weight`, where 1 is pure
   * second order -- the octave up, which IS the phantom fundamental this
   * control exists for and the good end for bass. The odd end tops out at the
   * third of a 200 Hz band, which is 600 Hz, nowhere near what that ceiling
   * protects.
   */
  bassForgeTexture: { min: 0, max: 1 },
  bassPunchShape: { min: -1, max: 1 },
  bassPunchBloomDecayMs: { min: 40, max: 250 },
  // Down to where a quiet passage lives and up to just under full scale.
  // Below -60 nothing musical ever falls under the threshold, so the band
  // would be permanently engaged and indistinguishable from a static one.
  eqThresholdDb: { min: -60, max: 0 },
  /**
   * Twelve decibels of drive, which is as far as this is worth going.
   *
   * Past about 12 dB into a ceiling the limiter is holding the signal down for
   * most of its length, and what that sounds like is the dynamics leaving
   * rather than the track getting louder. The dial stops where it stops being
   * a loudness control.
   */
  dimensionLowWidth: { min: 0, max: 1 },
  dimensionWidth: { min: 0, max: 2 },
  dimensionLowHz: { min: 60, max: 600 },
  dimensionHighHz: { min: 1_000, max: 10_000 },
  dimensionDecorrelation: { min: 0, max: 1 },
  maximizerDriveDb: { min: 0, max: 12 },
  ceilingDb: { min: -12, max: MAXIMIZER_MAX_CEILING_DB },
  lookAheadMs: {
    min: MAXIMIZER_MIN_LOOK_AHEAD_MS,
    max: MAXIMIZER_MAX_LOOK_AHEAD_MS,
  },
  maximizerReleaseMs: { min: MAXIMIZER_MIN_RELEASE_MS, max: 1_000 },
  masterOutputTrimDb: { min: -24, max: 6 },
  masterCeilingDb: { min: -12, max: -0.1 },
  /**
   * A peak limiter's release, not a level rider's.
   *
   * Seconds here are what made Auto Headroom duck the whole programme for a
   * phrase after one transient. The stage looks ahead and catches the peak
   * now, so recovery belongs between peaks; a stored value from the old range
   * clamps into this one.
   */
  masterReleaseMs: { min: 40, max: 400 },
  /**
   * Down to cinema, not merely down to quiet streaming.
   *
   * -18 was the floor while the stage could only ever raise a track toward a
   * target. It has always been able to lower one, and the quiet end is where
   * the specifications with legal or contractual weight behind them live: EBU
   * R128 at -23, ATSC A/85 at -24, streaming video at -27. A floor above the
   * target somebody has been handed is a dial that cannot do its job.
   */
  masterLoudnessTargetLufs: { min: -30, max: -6 },
  masterPeakLimitingDb: { min: 0, max: 12 },
  normalizerTruePeakDbtp: { min: -12, max: -0.1 },
  normalizerTargetLufs: { min: -24, max: -5 },
  denoiseAmount: { min: 0, max: 1 },
  /**
   * The reduction limit stops at -40 rather than at silence, deliberately.
   *
   * Past roughly -30 the surviving noise is too quiet to mask what the
   * estimator leaves in the bins it could not decide about, and those isolated
   * survivors warbling frame to frame is the artefact this whole module is
   * arranged to avoid. The dial's deep end is already past where it stops
   * being an improvement; there is no reason to extend it to where it is
   * plainly worse.
   */
  denoiseFloorDb: { min: -40, max: -3 },
  denoiseSensitivityDb: { min: -6, max: 12 },
  denoiseSmoothing: { min: 0, max: 1 },
  denoiseHumHarmonics: { min: 1, max: NOISE_HUM_MAX_HARMONICS },
  denoiseHumDepthDb: { min: 6, max: 48 },
  /**
   * Q from 5 to 60. At 50 Hz that is a notch between 10 Hz and 0.8 Hz wide.
   *
   * The wide end is for hum that drifts with the supply; the narrow end is for
   * a fundamental the scan pinned exactly. Wider than 5 stops being a hum
   * filter and starts being a shelf on the bottom octave.
   */
  denoiseHumQuality: { min: 5, max: 60 },
  denoiseClickSensitivity: { min: 0, max: 1 },
  denoiseClickRepairSamples: { min: 8, max: 128 },
  eqFrequency: { min: 20, max: 20_000 },
  eqGainDb: { min: -24, max: 24 },
  eqQuality: { min: 0.1, max: 18 },
  roomSizeM: { min: 2, max: 12 },
  roomWalls: { min: 0, max: 1 },
  roomDistanceM: { min: 0.5, max: 6 },
  roomDb: { min: -12, max: 12 },
  roomAngleDeg: { min: -180, max: 180 },
  roomLevelDb: { min: -24, max: 12 },
  roomCrossoverHz: { min: 40, max: 200 },
  roomUpmixAmount: { min: 0, max: 1 },
  roomEarlyReflectionDb: { min: -60, max: 0 },
  roomAmbienceMix: { min: 0, max: 1 },
  roomAmbienceDecayS: { min: 0.1, max: 1.8 },
  roomAmbienceDampingHz: { min: 1000, max: 12000 },
} as const satisfies Record<string, IRange>;

export const clampNumber = (
  value: unknown,
  range: IRange,
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : fallback;

export const clampBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/**
 * The rack this EQ opens with: shelves at the ends and thirteen bells
 * between, two thirds of an octave apart, all at 0 dB so opening the page
 * changes nothing until something is moved.
 *
 * Where the fifteen bands sit and what each one is, which is what the factory
 * curves are written against. Their WIDTH is not written here: it comes from
 * the spacing (`bandQuality.ts`), the same way every other rack size gets
 * theirs, so the one number that decides how much neighbouring bands overlap
 * cannot drift between the two equalisers.
 */
const DEFAULT_EQ_LAYOUT: readonly (readonly [number, string])[] = [
  [32, 'LSC'],
  [50, 'PK'],
  [80, 'PK'],
  [125, 'PK'],
  [200, 'PK'],
  [315, 'PK'],
  [500, 'PK'],
  [800, 'PK'],
  [1250, 'PK'],
  [2000, 'PK'],
  [3150, 'PK'],
  [5000, 'PK'],
  [8000, 'PK'],
  [12500, 'PK'],
  [16000, 'HSC'],
];

/** Bells take the rack's own width; shelves keep the Butterworth 0.7. */
const DEFAULT_BELL_QUALITY = qualityForRack(
  DEFAULT_EQ_LAYOUT.map(([frequency]) => frequency),
);

const DEFAULT_EQ_BANDS: readonly IEqBandSettings[] = DEFAULT_EQ_LAYOUT.map(
  ([frequency, type]) => ({
    enabled: true,
    type,
    frequency,
    gainDb: 0,
    quality: type === 'PK' ? DEFAULT_BELL_QUALITY : 0.7,
    dynamic: false,
    thresholdDb: -24,
  }),
);

/**
 * The rack sizes offered, and the ISO centres each one lands on.
 *
 * Not arbitrary counts with the range divided up: these are the frequencies
 * graphic equalisers have used for fifty years, so a curve set here looks the
 * same as the same curve set anywhere else. Ten is the ISO octave series,
 * thirty-one the third-octave series, and fifteen is the two-thirds-octave
 * spread the rack already shipped with — left exactly as it was, because the
 * factory presets are fifteen gains written against these frequencies.
 */
const RACK_FREQUENCIES: Record<number, readonly number[]> = {
  6: [63, 160, 400, 1_000, 4_000, 12_000],
  10: [31.5, 63, 125, 250, 500, 1_000, 2_000, 4_000, 8_000, 16_000],
  15: DEFAULT_EQ_BANDS.map((band) => band.frequency),
  31: [
    20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
    800, 1_000, 1_250, 1_600, 2_000, 2_500, 3_150, 4_000, 5_000, 6_300, 8_000,
    10_000, 12_500, 16_000, 20_000,
  ],
};

export const EQ_RACK_SIZES = [6, 10, 15, 31] as const;

/**
 * A full rack at one of the offered sizes.
 *
 * Bells throughout, which is both what a real graphic equaliser is and what
 * the measurements in the roadmap force. A rack ending in a high shelf would
 * put that shelf at 16 kHz on the ten-band and 20 kHz on the thirty-one, and
 * `dspBiquad.test.ts` records what the cookbook does there: a 16 kHz shelf
 * asked for +6 dB delivers between 3 and 6, because the response is forced
 * flat at Nyquist and a shelf that high has nowhere left to rise. At 20 kHz
 * against a 44.1 kHz rate it would deliver almost nothing at all — a control
 * that visibly moves and inaudibly does nothing.
 *
 * The fifteen-band rack keeps its shelves and is not built here: its
 * frequencies are what the factory presets are written against, and its top
 * shelf is a known cost recorded in the roadmap rather than a new one.
 */
export const buildEqRack = (count: number): readonly IEqBandSettings[] => {
  const frequencies = RACK_FREQUENCIES[count];
  if (!frequencies) {
    return DEFAULT_EQ_BANDS;
  }
  if (count === EQ_BAND_COUNT) {
    return DEFAULT_EQ_BANDS;
  }
  const quality = qualityForRack(frequencies);
  return frequencies.map((frequency) => ({
    enabled: true,
    dynamic: false,
    thresholdDb: -24,
    type: 'PK',
    frequency,
    gainDb: 0,
    quality,
  }));
};

export const DSP_DEFAULTS: IDspSettings = {
  enabled: true,
  presetId: '',
  normalizer: {
    mode: 'truePeak',
    truePeakDbtp: -1,
    targetLufs: -14,
  },
  denoise: {
    enabled: false,
    presetId: 'default',
    isolate: false,
    profileSource: 'scanned',
    hiss: {
      enabled: true,
      amount: 0.15,
      // Enabling the stage must not make clean material sound processed. At
      // this amount the worst-bin gain remains above 0.87 (-1.2 dB), while a
      // user with an actual noise problem can deliberately choose a deeper
      // profile. The old 50% / -18 dB start was the sound-quality complaint.
      floorDb: -6,
      sensitivityDb: -1,
      smoothing: 0.95,
    },
    hum: {
      // A hum comb is repair for a measured fault, not part of general noise
      // reduction. Starting it speculatively removes musical fundamentals.
      enabled: false,
      mode: 'auto',
      harmonics: 6,
      // A notch rather than a null. Removing a partial completely takes the
      // music sharing that frequency with it, and mains hum does not need to
      // be gone to stop being audible.
      depthDb: 24,
      quality: 30,
    },
    click: {
      // Click repair is equally problem-specific: even a guarded detector has
      // no reason to interpolate clean transients until the user asks it to.
      enabled: false,
      sensitivity: 0.5,
      maxRepairSamples: 32,
    },
    voice: {
      // Off even inside an enabled stage: the model is a download the user has
      // not necessarily made, and this module is wrong for music.
      enabled: false,
      mode: 'voice',
      amount: 1,
    },
  },
  crossfade: {
    enabled: false,
    durationMs: 2_000,
    curve: 'equalPower',
    shape: defaultCrossfadeShape(),
  },
  eq: {
    enabled: false,
    isolate: false,
    model: 'clean',
    modelAmount: 1,
    engine: 'serial',
    phase: 'minimum',
    stereo: 'stereo',
    monoBelowHz: 0,
    oversample: 1,
    subsonicHz: 0,
    fuzzAmount: 0,
    treble: DEFAULT_TREBLE_DESIGN,
    bands: DEFAULT_EQ_BANDS,
    sourceBands: [],
    presetId: '',
  },
  exciter: {
    enabled: false,
    presetId: '',
    stereo: 'stereo',
    // They START adjacent at 300 Hz and 3 kHz — the classic body / presence /
    // air split, and the three regions a listener describes without being
    // taught them. Adjacent is only where they begin: each edge moves on its
    // own from here, and two bands may cover the same octave.
    /**
     * The Amounts are read differently since the harmonic generator landed.
     *
     * They used to scale a return that was a full copy of its own filtered
     * band, so 0.1 bought a couple of decibels of level and the harmonics came
     * along behind it — which is why every Amount in this file and in the
     * profile catalogue was small. A return is harmonics over an 18% carrier
     * now, so the same 0.1 is nearly inaudible. Each figure below is chosen
     * against a measured harmonic level rather than against a level boost.
     */
    bands: [
      // Low: a small, even-dominant return for rounded impact rather than grit.
      {
        enabled: true,
        // 20-300 Hz, as its geometric centre and its width in octaves — the
        // same span the crossover gave this band, so nothing about the default
        // sound moved when the shape of the setting did.
        freqHz: 77,
        range: 0.3568123043805345,
        drive: 1.8,
        // Second order 24 dB under the note: the octave is present as weight
        // without the bass reading as a separate instrument playing along.
        mix: 0.15,
        texture: 0.05,
      },
      // Mid: soft second-harmonic body, deliberately below the high return.
      {
        enabled: true,
        // 300 Hz - 3 kHz.
        freqHz: 950,
        range: 0.3,
        drive: 2,
        mix: 0.2,
        texture: 0.18,
      },
      // High: mostly odd, which is what the old single-band exciter was, and
      // it was right about this band — odd orders up here read as air.
      {
        enabled: true,
        // 3 kHz - 20 kHz.
        freqHz: 7_700,
        range: 0.23727782085891017,
        drive: 2.6,
        mix: 0.38,
        texture: 0.6,
      },
    ],
    // A little wider than the focus band by default: a stage that arrives
    // audibly working on one narrow slice reads as a resonance rather than as
    // body, and body is the point.
    organic: {
      enabled: false,
      amount: 0.35,
      focusHz: 700,
      range: 0.3,
    },
    align: { enabled: false, amount: 0.45 },
    isolate: false,
  },
  bassForge: {
    enabled: false,
    isolate: false,
    presetId: '',
    splitHz: 90,
    driveDb: 0,
    subAmount: 0,
    presenceAmount: 0,
    texture: 0.8,
    mix: 0,
  },
  bassPunch: {
    enabled: false,
    isolate: false,
    presetId: 'default',
    ...BASS_PUNCH_PRESET_BY_ID.default.settings,
  },
  /**
   * Off, but not at unity — switching it on should do the tasteful thing.
   *
   * A little narrower at the bottom, which is right on every mix ever made,
   * and generous only up top where the ear can actually place a source.
   */
  dimension: {
    enabled: false,
    presetId: 'default',
    lowWidth: 0.9,
    midWidth: 1.05,
    highWidth: 1.25,
    lowHz: 200,
    highHz: 3_000,
    decorrelation: 0.25,
  },
  maximizer: {
    enabled: false,
    presetId: '',
    // Unity: switching the stage in cannot change the level until Drive is
    // moved, so it arrives as the protection it used to be and becomes a
    // loudness tool only when asked.
    driveDb: 0,
    ceilingDb: -1,
    lookAheadMs: 5,
    releaseMs: 100,
  },
  // Disabled and exactly unity by default: adding this stage cannot change a
  // saved chain until its owner deliberately switches it in.
  master: {
    enabled: false,
    presetId: 'default',
    outputTrimDb: 0,
    loudnessMaximize: false,
    /**
     * -14 rather than the -9 this shipped with, and the gain law is why.
     *
     * While the makeup was capped at a track's remaining peak room, the target
     * was unreachable and its value barely mattered — the stage applied 0.0 dB
     * whatever the dial said. Now that it arrives, -9 asks a limiter for five
     * or six decibels on the very first ordinary record somebody switches this
     * on for, and the first thing they would hear is the limiter rather than
     * the feature. -14 is where nearly everything played through this has
     * already been normalized to, so the honest default is the one that mostly
     * leaves a modern master alone and lifts the quiet ones.
     */
    loudnessTargetLufs: -14,
    ceilingDb: -1,
    releaseMs: 200,
    /**
     * Nine, measured, and it is the only number that decides whether a library
     * arrives at one loudness or nearly.
     *
     * Six was chosen as "a normal amount of work" and it is — for a delivery.
     * As a player default it was the whole of the residual spread: rendered
     * through the real chain against five sources each peaking within 1.5 dB
     * of full scale, a 20 LU input spread came out at 3.0 LU, and every one of
     * those three decibels was one wide-dynamic record stopped at the
     * allowance rather than at the target. At nine the same corpus lands
     * inside 0.86 LU, and twelve — the top of the dial — measures identically,
     * so the last three decibels buy nothing and only widen the worst case.
     *
     * It is affordable because makeup past the peak room is nearly free in
     * loudness: +6.00 dB asked of Auto Headroom measured 5.81 LU delivered on
     * dense programme, about a fifth of a decibel of cost for every six it
     * holds. The -23 LUFS source that needed the whole nine came out at -14.86
     * LUFS and -1.08 dBTP, under the ceiling — the limiter absorbed 8.5 dB
     * without the peak escaping, which is the property that makes the
     * allowance safe to spend rather than merely permitted.
     *
     * `MASTER_PRESET_BY_ID.default` carries the same nine and has to: it is
     * where Reset lands. The `streaming` profile deliberately keeps six —
     * that one is a delivery specification, and this one is how a player
     * behaves.
     */
    peakLimitingDb: 9,
    matchedBypass: false,
  },
  // Off until it is asked for: it folds every output onto the front pair,
  // which is only right on headphones. The living room is the room the
  // dials describe when it is switched on.
  room: {
    enabled: false,
    presetId: 'livingRoom',
    rendererVersion: 1,
    earlyReflectionDb: 0,
    ambienceMix: 0,
    ambienceDecayS: 0.5,
    ambienceDampingHz: 6000,
    preservePosition: false,
    compareOriginal: false,
    sourceAlreadySpatial: false,
    sizeM: 4.2,
    walls: 0.55,
    distanceM: 1.8,
    centreDb: 0,
    subDb: 0,
    head: 'medium',
    angles: [-30, 30, 0, -100, 100, -140, 140],
    levels: [0, 0, 0, 0, 0, 0, 0],
    bassManagement: true,
    crossoverHz: 80,
    musicUpmix: false,
    upmixAmount: 0.6,
    distances: [1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
    mutes: [false, false, false, false, false, false, false, false],
  },
  // On by default: a 5.1 or 7.1 output follows what Windows is set to, and
  // the rack on two of its channels was a surprise on every one of them.
  surround: {
    allChannels: true,
  },
  gameMode: false,
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
