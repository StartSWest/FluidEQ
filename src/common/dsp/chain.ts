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
  clampCrossfadeShape,
  defaultCrossfadeShape,
  ICrossfadeShape,
} from './crossfadeShape';
import { NOISE_HUM_MAX_HARMONICS } from './noiseProfile';

/**
 * What the DSP chain is, as data.
 *
 * Declarative because two very different things build from it: the live
 * `AudioContext` graph the player hears, and the `OfflineAudioContext` that
 * renders a file. A single shape both of them read is the only thing that
 * keeps those two from drifting apart, and a drift there is silent — the
 * exported file simply does not sound like what was auditioned.
 *
 * None of this reaches Equalizer APO, and it cannot. Every APO command is
 * linear, and neither compression nor a generated harmonic is. That is the
 * reason this module exists rather than another layer in `apoRender.ts`.
 *
 * Everything defaults to bypassed. A DSP tab that colours the sound the
 * moment it is opened is one the user did not ask for.
 */

/**
 * What `range` means, in octaves either side of `freqHz`.
 *
 * Half an octave at 0 is narrow enough to work on one region without touching
 * its neighbours; ten at 1 is wider than the audible band, so the top of the
 * dial genuinely means "everything" rather than "nearly everything". Shared
 * between the audio, the graph and the migration so all three agree about
 * where a band actually is.
 */
export const EXCITER_MIN_OCTAVES = 0.5;

export const EXCITER_OCTAVE_SPAN = 9.5;

/** The edges a band's centre and width work out to, in Hz. */
export const exciterBandEdges = (
  freqHz: number,
  range: number,
): { lowHz: number; highHz: number } => {
  const octaves = EXCITER_MIN_OCTAVES + range * EXCITER_OCTAVE_SPAN;
  const half = 2 ** (octaves / 2);
  return {
    lowHz: Math.max(20, freqHz / half),
    highHz: Math.min(20_000, freqHz * half),
  };
};

export interface IExciterBandSettings {
  enabled: boolean;
  /**
   * Where this band sits and how far it reaches, EITHER SIDE of that centre.
   *
   * A centre and a width rather than two edges, and rather than the shared
   * crossover corners before them. The corners made the three bands strictly
   * adjacent — moving one moved its neighbour's, and no band could be widened
   * without narrowing the one beside it. That is right for a COMPRESSOR, where
   * the bands are taken apart and put back together and an overlap would be
   * counted twice.
   *
   * It is wrong here. These bands are not a decomposition: the dry signal
   * passes through untouched and each band only ADDS what it made, so two
   * bands over the same octave simply means that octave gets both lots of
   * harmonics. Nothing stops them crossing.
   *
   * Symmetric in OCTAVES, not in hertz, which is the only way a width dial
   * behaves the same at 80 Hz and at 8 kHz: range 0.3 is the same musical
   * interval either side wherever the band is put.
   */
  freqHz: number;
  range: number;
  /** Soft-diode drive. 1 is gentle; 3.5 is deliberately obvious. */
  drive: number;
  /** How much of the shaped band is mixed back, 0-1. */
  mix: number;
  /**
   * Which harmonics this band favours: 0 is warm/even, 0.7 is airy/odd.
   *
   * The axis the single-band exciter never had, and the one that decides what
   * a band is FOR. Even orders sit an octave above the fundamental and read as
   * body, which is what a low or mid band wants. Odd orders read as edge and
   * air, which is what a high band wants — and is what the old exciter did
   * everywhere, because its curve was symmetric and a symmetric curve has no
   * choice.
   */
  texture: number;
}

/**
 * Absolute regions the named Exciter bands are allowed to cover.
 *
 * They deliberately overlap, but Low cannot become an air band and High
 * cannot be dragged over the sub-bass. Range is reduced as needed near an edge
 * so resizing cannot escape through a centre that is still technically valid.
 */
export const EXCITER_BAND_LIMITS = [
  { minHz: 20, maxHz: 700 },
  { minHz: 150, maxHz: 7_000 },
  { minHz: 2_500, maxHz: 20_000 },
] as const;

/** Largest valid symmetric width at this band's current centre. */
export const maximumExciterBandRangeAtFrequency = (
  bandIndex: number,
  freqHz: number,
): number => {
  const limits = EXCITER_BAND_LIMITS[bandIndex] ?? {
    minHz: 20,
    maxHz: 20_000,
  };
  const minimumHalf = 2 ** (EXCITER_MIN_OCTAVES / 2);
  const safeFrequency = Math.max(
    limits.minHz * minimumHalf,
    Math.min(limits.maxHz / minimumHalf, freqHz),
  );
  const availableOctaves = Math.max(
    EXCITER_MIN_OCTAVES,
    Math.min(
      2 * Math.log2(safeFrequency / limits.minHz),
      2 * Math.log2(limits.maxHz / safeFrequency),
    ),
  );
  return Math.max(
    0,
    Math.min(1, (availableOctaves - EXCITER_MIN_OCTAVES) / EXCITER_OCTAVE_SPAN),
  );
};

export const constrainExciterBandPosition = (
  bandIndex: number,
  freqHz: number,
  range: number,
): { freqHz: number; range: number } => {
  const limits = EXCITER_BAND_LIMITS[bandIndex] ?? {
    minHz: 20,
    maxHz: 20_000,
  };
  const minimumHalf = 2 ** (EXCITER_MIN_OCTAVES / 2);
  const minimumCentre = limits.minHz * minimumHalf;
  const maximumCentre = limits.maxHz / minimumHalf;
  const safeFrequency = Math.max(
    minimumCentre,
    Math.min(maximumCentre, freqHz),
  );
  return {
    freqHz: safeFrequency,
    range: Math.max(
      0,
      Math.min(
        Math.min(1, range),
        maximumExciterBandRangeAtFrequency(bandIndex, safeFrequency),
      ),
    ),
  };
};

export const exciterBandEdgesForIndex = (
  bandIndex: number,
  freqHz: number,
  range: number,
): { lowHz: number; highHz: number } => {
  const position = constrainExciterBandPosition(bandIndex, freqHz, range);
  return exciterBandEdges(position.freqHz, position.range);
};

export interface IOrganicSettings {
  enabled: boolean;
  /** How much body, 0-1. Drives asymmetry and level together. */
  amount: number;
  /** Centre of the band it works on, Hz. */
  focusHz: number;
  /**
   * Width of the focused body band: 0 is tight, 1 is several octaves wide.
   *
   * It deliberately never blends in the unfiltered full-range signal. Applying
   * one non-linearity to bass, mids and cymbals together creates difference
   * products between them, which is heard as grain rather than body.
   */
  range: number;
}

/** Range mapped to a musical bandpass width without reaching broadband. */
export const organicRangeQ = (range: number): number =>
  1.2 - Math.max(0, Math.min(1, range)) * 1.02;

/** Approximate half-power edges of the Organic band, shared with its graph. */
export const organicBandEdges = (
  focusHz: number,
  range: number,
): { lowHz: number; highHz: number } => {
  const quality = organicRangeQ(range);
  const inverseQ = 1 / quality;
  const ratio = (Math.sqrt(4 + inverseQ * inverseQ) + inverseQ) / 2;
  return {
    lowHz: Math.max(20, focusHz / ratio),
    highHz: Math.min(20_000, focusHz * ratio),
  };
};

/**
 * The stage that adds nothing and changes everything. @see phaseAlign.ts
 *
 * No harmonics and no generated signal — it delays the lower bands against
 * the higher ones, following the timing half of the classic three-way enhancer
 * topology. Because it is a time relationship rather than a tone control, the
 * UI exposes one depth control and keeps the hardware-style split points fixed.
 */
export interface IPhaseAlignSettings {
  enabled: boolean;
  /** 0 is off exactly, 1 is 2.5 ms on the low band. */
  amount: number;
}

export interface IExciterSettings {
  enabled: boolean;
  /** Stable processor-local profile id, or empty after a hand edit. */
  presetId: string;
  /** Which part of the stereo image the entire Exciter processes. */
  stereo: TEqStereo;
  /**
   * Three bands, each with its own span. Not a crossover. @see lowHz
   */
  bands: readonly IExciterBandSettings[];
  /** @see IOrganicSettings */
  organic: IOrganicSettings;
  /** @see IPhaseAlignSettings */
  align: IPhaseAlignSettings;
  /**
   * Hear ONLY what this stage made, with the dry signal dropped.
   *
   * A harmonic generator is the hardest stage in a rack to judge, because a
   * good setting sounds like "slightly bigger" and that is indistinguishable
   * from expecting it to. This removes the doubt: what is left is exactly what
   * the stage is adding, and nothing else.
   *
   * Deliberately NOT restored from storage — `clampDspSettings` forces it
   * false. It is a monitoring mode, and quitting with it on and coming back to
   * a rack that plays only harmonics is a bug report rather than a setting.
   */
  isolate: boolean;
}

export interface IBandSettings {
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
}

export interface ICompressorSettings {
  enabled: boolean;
  /** The two crossover corners that make three bands, Hz, ascending. */
  crossoverHz: readonly [number, number];
  /** Per band, low to high. Always three. */
  bands: readonly IBandSettings[];
}

/**
 * Generates low end rather than shaping what the source already has — the
 * difference between this and an EQ boost, which can only raise a
 * fundamental that survived onto the recording in the first place.
 *
 * There is deliberately no mono control on this stage. An earlier design
 * migrated `eq.monoBelowHz` into it; roughly twenty EQ presets reference that
 * field, and an EQ preset cannot reach into another stage's settings, so the
 * migration would have silently dropped the mono-maker from every one of
 * them. Forge instead generates from `(low[0] + low[1]) / 2` as a
 * construction of the stage itself, and the mono-maker stays in the EQ.
 */
export interface IBassForgeSettings {
  enabled: boolean;
  /**
   * Hear what this stage adds, with the programme dropped.
   *
   * A subtraction like the EQ's and Denoise's, so at a mix of zero it is
   * silence rather than the low band soloed — a band plays whether the stage
   * is working or not, and a monitor that cannot tell you the difference is
   * not one.
   *
   * Deliberately NOT persisted, and the drop belongs in `readStored` rather
   * than here: this function also runs on every patch and every settings
   * message, so forcing it false here strips the value between the button and
   * the audio, which is what once stopped the Exciter's isolate working.
   */
  isolate: boolean;
  /** Stable processor-local profile id, or empty after a hand edit. */
  presetId: string;
  /** Below this, the band Forge builds its low end from. */
  splitHz: number;
  driveDb: number;
  /** 0 to 2, not 0 to 1 like `mix`. @see RANGES.bassForgeAmount */
  subAmount: number;
  /** 0 to 2, not 0 to 1 like `mix`. @see RANGES.bassForgeAmount */
  presenceAmount: number;
  /** Spans further than the Exciter's does. @see RANGES.bassForgeTexture */
  texture: number;
  mix: number;
}

/**
 * Shapes how the low end hits rather than generating it, which is why this
 * carries its own `splitHz` instead of sharing Forge's — the two stages do
 * different jobs and a user may want either without the other.
 */
export interface IBassPunchSettings {
  enabled: boolean;
  /**
   * Hear what this stage adds, with the programme dropped.
   *
   * This stage generates nothing, so its contribution IS the monitor: the
   * transient shaping, the bloom tail and the ducking, and nothing else. With
   * every dial at rest that is exactly silence, which is the honest reading of
   * a stage doing nothing rather than a fault.
   *
   * Not persisted, and dropped in `readStored` rather than here — see the note
   * on Forge's above for why this function is the wrong place.
   */
  isolate: boolean;
  /** Stable processor-local profile id, or empty after a hand edit. */
  presetId: string;
  splitHz: number;
  attack: number;
  sustain: number;
  bloomAmount: number;
  bloomDecayMs: number;
  duck: number;
}

/**
 * Stereo width, per band, that survives being summed to mono.
 *
 * The processor touches the SIDE signal and nothing else, so `(L+R)/2` — which
 * is what a phone, a laptop speaker or a club PA plays — comes out exactly as
 * it went in whatever these are set to. That is a property of the arithmetic
 * rather than a tuning, and `dimension_test.cpp` asserts it as an equality.
 *
 * This has no TypeScript implementation. It was written in C++ first, so the
 * chain parity corpus covers the chain WITHOUT it; the stage is held to
 * properties in its own native test instead. Fixtures leave it disabled, where
 * it is a bit-exact bypass, so the two engines still agree.
 */
export interface IDimensionSettings {
  enabled: boolean;
  /** Which profile this came from, or empty once the user has edited it. */
  presetId: string;
  /** Bass is narrowed or left alone. See the header for why never widened. */
  lowWidth: number;
  midWidth: number;
  highWidth: number;
  lowHz: number;
  highHz: number;
  /**
   * How much of the side is replaced by a phase-decorrelated copy of itself.
   *
   * Width alone can only scale what the mix already had. The all-pass network
   * this drives makes the sides stop being a louder copy of the middle, which
   * is the difference between a wider picture and a thinner one — and being
   * confined to the side, it costs the mono listener nothing.
   */
  decorrelation: number;
}

export interface IMaximizerSettings {
  enabled: boolean;
  /**
   * Which profile these four numbers came from, or `''` for a hand-made set.
   *
   * Renderer state and storage only — it is deliberately absent from the wire,
   * because the engine is told the four values and has no use for their name.
   */
  presetId: string;
  /**
   * Gain into the ceiling, which is the control that makes this a maximizer.
   *
   * Without it the stage could only ever turn peaks DOWN: there was no gain
   * term anywhere in it or in the limiter it drives, so switching it on made
   * things quieter or did nothing, and the always-on output safety already
   * guaranteed nothing could clip. That is a limiter, and this is named after
   * the other thing — every maximizer is gain into a ceiling, and this one had
   * the ceiling and no gain.
   *
   * Louder comes out of the gap between the two: raise Drive and the peaks meet
   * the ceiling sooner, so what is under them comes up while the ceiling holds
   * the top still.
   */
  driveDb: number;
  /** Reconstructed output ceiling in dBTP. Never reaches digital full scale. */
  ceilingDb: number;
  /**
   * Look-ahead in milliseconds.
   *
   * Not cosmetic: it is the entire difference between a limiter that has
   * already turned down when the transient arrives and one that clips it.
   */
  lookAheadMs: number;
  releaseMs: number;
}

/** Below these, limiting becomes clipping or audible low-rate modulation. */
export const MAXIMIZER_MIN_LOOK_AHEAD_MS = 1;

/**
 * The longest look-ahead the dial offers, and the size of the delay both
 * engines build for it.
 *
 * Load-bearing rather than a dial limit: the ring is allocated once at this
 * length so the look-ahead can move without the delay being rebuilt. A ring
 * sized from the CURRENT setting has to be replaced every time the dial steps,
 * and a replacement arrives full of zeros — which is the crackle while the dial
 * moves and the silence while it is dragged. `kMaximizerMaxLookAheadMs` in
 * `chain_internal.h` is the same number for the native engine.
 */
export const MAXIMIZER_MAX_LOOK_AHEAD_MS = 20;
export const MAXIMIZER_MIN_RELEASE_MS = 40;
export const MAXIMIZER_MAX_CEILING_DB = -0.1;

/** The library source's constant, track-wide gain policy. */
export type TNormalizerMode = 'off' | 'truePeak' | 'loudness';

export const NORMALIZER_MODES: readonly TNormalizerMode[] = [
  'off',
  'truePeak',
  'loudness',
];

/**
 * Prevention before the first creative processor, never restoration.
 *
 * True Peak only attenuates a hot source. Loudness may raise or lower the
 * whole track toward its integrated target, but the same constant gain is
 * capped by the true-peak ceiling. No follower lives here, so the stage
 * cannot pump or change the balance between left and right.
 */
export interface IInputNormalizerSettings {
  mode: TNormalizerMode;
  truePeakDbtp: number;
  targetLufs: number;
}

/** Where the hiss module's floor estimate comes from. */
export type TDenoiseProfileSource = 'scanned' | 'adaptive';

export const DENOISE_PROFILE_SOURCES: readonly TDenoiseProfileSource[] = [
  'scanned',
  'adaptive',
];

/** The mains frequency, chosen or measured. */
export type TDenoiseHumMode = 'auto' | 'fifty' | 'sixty';

export const DENOISE_HUM_MODES: readonly TDenoiseHumMode[] = [
  'auto',
  'fifty',
  'sixty',
];

/**
 * Broadband suppression against a measured floor.
 *
 * `floorDb` is the one control that decides whether this sounds like a
 * restoration or like a broken gate. It caps how far any single bin may be
 * attenuated, so a low level of the original noise always survives — and that
 * survivor is what masks the isolated bins the estimator leaves behind. Driven
 * to negative infinity the module measurably removes more noise and audibly
 * sounds worse, which is why the dial stops at -40 rather than at silence.
 */
export interface IDenoiseHissSettings {
  enabled: boolean;
  amount: number;
  floorDb: number;
  sensitivityDb: number;
  smoothing: number;
}

/**
 * A comb of notches at the measured mains fundamental and its partials.
 *
 * `harmonics` is a ceiling, not a count: the scan reports which partials stand
 * above the local floor and only those are placed. A notch at a harmonic where
 * there is no hum removes music and removes no buzz.
 */
export interface IDenoiseHumSettings {
  enabled: boolean;
  mode: TDenoiseHumMode;
  harmonics: number;
  depthDb: number;
  quality: number;
}

/**
 * Impulsive-outlier repair.
 *
 * `maxRepairSamples` is a safety limit rather than a tuning control. The
 * failure mode of every click repairer is eating percussion, and the property
 * that separates a click from a snare is width: a click is a handful of
 * samples, a transient keeps going. A repair allowed to run long enough stops
 * being a repair and becomes an interpolation over music.
 */
export interface IDenoiseClickSettings {
  enabled: boolean;
  sensitivity: number;
  maxRepairSamples: number;
}

/**
 * The neural module, which only exists once its model has been downloaded.
 *
 * `enabled` is what the user asked for and not what is running: with no model
 * present the stage reports itself unavailable rather than silently passing
 * audio through a control that reads as on.
 */
export interface IDenoiseVoiceSettings {
  enabled: boolean;
  amount: number;
}

/**
 * Restoration, above every creative stage and below the input gain.
 *
 * Below the input gain because the Normalizer's constant gain is derived from a
 * cached whole-file true peak: altering the waveform above it makes that
 * measurement describe a signal that no longer exists, and the ceiling stops
 * holding without anything reporting it. Above the Exciter and the EQ because
 * the alternative is generating harmonics from hiss, or boosting it past the
 * profile, and then trying to remove the result.
 *
 * Four modules rather than one engine with mode flags. They share the point in
 * the chain and the scan that feeds them, and nothing else — a listener with
 * mains buzz must not pay the spectral module's latency to remove it.
 */
export interface IDenoiseSettings {
  enabled: boolean;
  /** Which processor-local cleanup profile is loaded, or '' after an edit. */
  presetId: string;
  /** Monitor what is being removed instead of what is kept. */
  isolate: boolean;
  profileSource: TDenoiseProfileSource;
  hiss: IDenoiseHissSettings;
  hum: IDenoiseHumSettings;
  click: IDenoiseClickSettings;
  voice: IDenoiseVoiceSettings;
}

export type TCrossfadeCurve = 'equalPower' | 'smooth' | 'linear' | 'custom';

/**
 * Append-only: the wire carries an index into this list, so an insert would
 * renumber every curve the host already knows and hand a saved setting to the
 * wrong one.
 */
export const CROSSFADE_CURVES: readonly TCrossfadeCurve[] = [
  'equalPower',
  'smooth',
  'linear',
  'custom',
];

/** A source transition after per-track normalization and before Exciter. */
export interface ICrossfadeSettings {
  enabled: boolean;
  durationMs: number;
  curve: TCrossfadeCurve;
  /**
   * The dragged shape, kept whether or not `custom` is the selected curve.
   *
   * Switching away to Equal power and back must return the curve the user
   * drew; storing it only while it is selected would quietly discard the one
   * setting in this card that takes real work to make.
   */
  shape: ICrossfadeShape;
}

/**
 * The transparent output stage after every creative processor.
 *
 * `outputTrimDb` is deliberately not called a preamp: it changes the finished
 * chain rather than the level that drives a nonlinear stage. LUFS maximize
 * owns the final true-peak boundary: average-loudness makeup cannot be safe
 * without peak control, and disabling it returns the complete stage to unity.
 */
export interface IMasterSettings {
  enabled: boolean;
  /** The chosen delivery target, or '' once any of its numbers is moved. */
  presetId: string;
  outputTrimDb: number;
  /** Constant source-LUFS gain with its required true-peak control last. */
  loudnessMaximize: boolean;
  loudnessTargetLufs: number;
  /** User ceiling in dBTP, applied only while LUFS maximize is enabled. */
  ceilingDb: number;
  releaseMs: number;
  /**
   * How much gain reduction the loudness target is allowed to buy, in dB.
   *
   * The makeup used to be capped at the true-peak room the track had left,
   * which under the shipped defaults — the Normalizer holding peaks at
   * -1 dBTP and this stage's ceiling also at -1 dBTP — is exactly zero
   * decibels on every commercially mastered record. The target was therefore
   * unreachable by construction, and on quiet material it landed somewhere
   * different for every track, which is why the loudness still moved.
   *
   * Auto Headroom is the look-ahead true-peak limiter that runs immediately
   * before the master gain, and only while LUFS maximize is on. It already
   * reserves the gain still to come, so makeup beyond the peak room is safe —
   * it costs limiting, not clipping. This says how much of that cost the
   * target may incur. At 0 the old peak-safe behaviour returns exactly.
   */
  peakLimitingDb: number;
  /**
   * Play the maximized result at the loudness it had before maximizing.
   *
   * The limiting is unchanged and only the final level moves, so A/B against a
   * bypassed Master compares the sound rather than the volume. Without it the
   * louder side wins every comparison, which is the oldest way to be wrong
   * about a master.
   */
  matchedBypass: boolean;
}

/** Signed whole-track correction accepted by the renderer/worklet boundary. */
export const MASTER_LOUDNESS_GAIN_MIN_DB = -48;
export const MASTER_LOUDNESS_GAIN_MAX_DB = 12;

/**
 * One EQ band.
 *
 * `type` is `FilterTypeEnum`'s string, not the enum itself — this shape is
 * JSON in `localStorage` and crosses a worklet port, and a stored string that
 * no longer names a member has to survive being read by a later build.
 * `clampEqBand` is what turns it back into something trusted.
 */
export interface IEqBandSettings {
  enabled: boolean;
  type: string;
  frequency: number;
  gainDb: number;
  quality: number;
  /**
   * Act only when there is something here to act on.
   *
   * A static band is honest and blunt: a cut at 6 kHz to tame one singer's
   * sibilance also dulls every cymbal in the record, because the filter cannot
   * tell them apart. A dynamic band applies the SAME gain, but only while the
   * energy in its own passband is above `thresholdDb` — so it takes the
   * sibilant and leaves the cymbals alone.
   *
   * Per band rather than per rack, which is the whole point: a curve is
   * normally two or three bands that need to react and a dozen that must not.
   * Off by default, so every rack that existed before this behaves as it did.
   */
  dynamic: boolean;
  /**
   * Where a dynamic band starts working, in dBFS of its own passband.
   *
   * Measured on the band's input rather than its output, so moving the gain
   * dial does not move the point at which it engages — otherwise the two
   * controls fight and neither can be set.
   */
  thresholdDb: number;
}

/**
 * Which processing renders the bands.
 *
 * The same curve through different machinery, which is the whole point: dials
 * set identically sound like a different equaliser. `clean` is RBJ's cookbook
 * and is what Equalizer APO renders, so it stays the default and an exported
 * curve behaves the same on both paths. `proportional` narrows each band as it
 * is driven — the focused console character. `wide` spreads them so they
 * overlap into a tilt rather than a row of bumps.
 *
 * Named for what they do, not for the equipment they resemble: this app is
 * sold, and a mode named after somebody's console is a trademark problem
 * rather than a technical one.
 */
export type TEqModel = 'clean' | 'proportional' | 'wide';

export const EQ_MODELS: readonly TEqModel[] = ['clean', 'proportional', 'wide'];

/**
 * How the bands are put against the audio, which is a different question from
 * what shape each band is.
 *
 * `serial` cascades them — each band filters the previous band's output, so
 * phase shifts accumulate down the chain and overlapping bands depend on their
 * order. `parallel` filters the original signal with every band and adds what
 * each one changed, so no band hears another's phase and order stops
 * mattering. Same curve on the dials, a different thing done to the audio.
 */
export type TEqEngine = 'serial' | 'parallel';

/**
 * Which part of the stereo image the bands act on.
 *
 * `stereo` filters left and right alike, which is what an equaliser normally
 * does. The other two convert to mid and side first — what both speakers share,
 * and what they differ by — filter one of them, and convert back.
 *
 * That is the thing a stereo equaliser cannot do at all: brightening a centred
 * vocal without touching the reverb around it, or clearing bass out of the
 * sides while leaving the middle whole.
 */
export type TEqStereo = 'stereo' | 'mid' | 'side';

export const EQ_STEREO_MODES: readonly TEqStereo[] = ['stereo', 'mid', 'side'];

export const EQ_ENGINES: readonly TEqEngine[] = ['serial', 'parallel'];

/**
 * Whether the bands are allowed to shift phase where they change amplitude.
 *
 * `minimum` is every biquad equaliser there has ever been, and the shift is
 * not a defect: it is what makes a causal filter causal, which is why the two
 * cannot be had at once. `linear` replaces the cascade with a symmetric FIR of
 * the same magnitude, so no frequency is delayed relative to another — at the
 * cost of latency, and of ringing symmetrically about a transient instead of
 * behind it. Neither is the better one; they are two different trades.
 */
export type TEqPhase = 'minimum' | 'linear';

export const EQ_PHASE_MODES: readonly TEqPhase[] = ['minimum', 'linear'];

/** 1 is off. Four is the most the two-stage oversampler is built for. */
export const OVERSAMPLE_FACTORS: readonly number[] = [1, 2, 4];

export interface IEqSettings {
  enabled: boolean;
  /**
   * Hear only the curve and colour this EQ changes.
   *
   * The monitor is magnitude-matched across phase modes and its dry reference
   * carries the same input gain, so phase rotation and preset headroom cannot
   * masquerade as a copy of the song.
   */
  isolate: boolean;
  /** @see TEqModel */
  model: TEqModel;
  /**
   * How much of the chosen character to apply, 0 to 1.
   *
   * Each character shipped at one fixed strength, so "a bit focused" was not
   * something the rack could be asked for. At 0 every character collapses to
   * the cookbook, which makes this an off switch that costs nothing.
   */
  modelAmount: number;
  /** @see TEqEngine */
  engine: TEqEngine;
  /** @see TEqPhase */
  phase: TEqPhase;
  /** @see TEqStereo */
  stereo: TEqStereo;
  /**
   * Sum everything below this frequency to mono, in Hz, or 0 for off.
   *
   * The fix for phase cancellation, and the one place it actually bites. Bass
   * recorded or widened out of phase disappears the moment the two channels are
   * summed — which is what a phone speaker, a mono PA and most Bluetooth
   * speakers do — so a mix can sound enormous on headphones and gutless
   * everywhere else.
   *
   * Removing the SIDE content below the corner leaves the middle untouched, so
   * the bass stops depending on the two channels agreeing. Above the corner the
   * stereo image is left exactly as it was: width is worth keeping where it
   * cannot cancel.
   */
  monoBelowHz: number;
  /**
   * Run the bands at twice the rate.
   *
   * Orthogonal to the engine on purpose: it is not a third topology, it is the
   * same topology given room. A biquad is linear and cannot alias, so this buys
   * no headroom — it buys distance from Nyquist, where the bilinear transform
   * squeezes a high band's upper skirt flat. Measured at 44.1 kHz, a 16 kHz
   * bell asked for +6 dB carries 0.6 dB an octave below and 0.03 above; at
   * double rate those come back together.
   *
   * Off by default, because it costs roughly double the EQ's arithmetic plus a
   * 63-tap filter each way for a difference that lives in the top octave.
   */
  /**
   * How many times the base rate the bands run at: 1, 2 or 4.
   *
   * Four is two halvings rather than one longer filter, so each stage only has
   * to reject the octave above it.
   */
  oversample: number;
  /**
   * A high pass below the audible band, in Hz, or 0 for none.
   *
   * Not tone shaping — cone protection and headroom. Rumble, DC offset and
   * footfall below about 20 Hz are inaudible on any normal speaker but still
   * cost real excursion: the woofer is moving that far for content nobody can
   * hear, and every millimetre spent there is unavailable to the bass that can
   * be. Removing it makes the same amplifier sound tighter without touching
   * anything audible, which is why mastering chains and PA processors have had
   * this switch for decades.
   */
  subsonicHz: number;
  /**
   * A little harmonic colour, 0 to 1, and 0 costs nothing.
   *
   * The one thing no arrangement of filters can produce: biquads cannot invent
   * a frequency that was not already there. A fixed "warm" mode was built and
   * rejected for being too much of it — an amount is the same idea with the
   * decision left where it belongs.
   *
   * Asymmetric, so it makes EVEN harmonics as well as odd. Even ones read as
   * warmth; odd alone reads as edge.
   */
  fuzzAmount: number;
  /**
   * `EQ_BAND_COUNT` by default, and as many as an imported file asked for up
   * to `EQ_MAX_BAND_COUNT`.
   */
  bands: readonly IEqBandSettings[];
  /**
   * The curve the rack sizes are resampled FROM, rather than from each other.
   *
   * Resampling the live rack each time compounds its own error: ten bands read
   * down to six lose the detail between them, and reading those six back up to
   * thirty-one cannot invent it again — so a round trip through a smaller rack
   * quietly flattened an imported curve, and going back to the size it came in
   * at did not restore it.
   *
   * This holds the last curve somebody actually authored — what was imported,
   * what a preset supplied, or what they dialled in by hand — and every rack
   * change interpolates from here. Switching 10 → 6 → 31 → 10 now ends where
   * it started.
   *
   * Empty means "the bands are the source", which is what a stored setting
   * from before this existed looks like.
   */
  sourceBands: readonly IEqBandSettings[];
  /**
   * The factory preset last applied, or empty for a hand-made curve.
   *
   * Stored rather than derived so it survives a reload: the bands alone cannot
   * say whether a curve came from "Rock" or was dialled in by hand, and coming
   * back to a session with the picker blank makes the app look like it forgot.
   * Cleared the moment a band is touched, because at that point it did.
   */
  presetId: string;
}

/**
 * Fifteen is what the rack starts with.
 *
 * A mixing-desk spread that gives every band somewhere useful to start. It is
 * no longer a ceiling: a published correction file decides its own band count,
 * and truncating one to fifteen threw away filters the author put there — the
 * curve that came out was not the curve on the page.
 *
 * Fifteen cascaded biquads is well within budget — 15 × 2 channels × 5
 * multiply-adds is about 7 million operations a second at 48 kHz, against a
 * render quantum's budget of far more — and each one keeps its state in a
 * JavaScript number, which is float64. Precision does not degrade down the
 * chain the way it would in a 32-bit fixed-point cascade.
 */
export const EQ_BAND_COUNT = 15;

/**
 * One setting changed, and the preset picker told the truth about it.
 *
 * A preset carries the character, the topology, the oversampling and the
 * protective filters as well as the fifteen gains, so touching any of them
 * means the rack is no longer the preset it is still labelled with. Only a band
 * edit used to clear the label, which was right while a preset was nothing but
 * gains and became a lie the moment it was more.
 *
 * Not for the preamp: that is headroom rather than part of the curve, and
 * trimming it must not make the picker claim the preset was abandoned.
 */
export const eqEdited = (
  eq: IEqSettings,
  next: Partial<IEqSettings>,
): IEqSettings => ({ ...eq, ...next, presetId: '' });

/**
 * The ceiling an import cannot cross.
 *
 * Not a format limit — it is a budget. Published curves run to about twenty
 * filters and the longest seen is in the thirties, so sixty-four leaves room
 * without letting a malformed file allocate a biquad per line and stall the
 * audio thread.
 */
export const EQ_MAX_BAND_COUNT = 64;

export interface IDspSettings {
  /** Root bypass. Individual processor states remain untouched underneath. */
  enabled: boolean;
  /** Which whole-rack profile is loaded, or '' after any stage is edited. */
  presetId: string;
  normalizer: IInputNormalizerSettings;
  denoise: IDenoiseSettings;
  crossfade: ICrossfadeSettings;
  eq: IEqSettings;
  exciter: IExciterSettings;
  bassForge: IBassForgeSettings;
  bassPunch: IBassPunchSettings;
  dimension: IDimensionSettings;
  compressor: ICompressorSettings;
  maximizer: IMaximizerSettings;
  master: IMasterSettings;
}

interface IRange {
  min: number;
  max: number;
}

const RANGES = {
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
  /**
   * Forge's two generators reach two; every other bass dial stays a blend.
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
  compressorLowHz: { min: 60, max: 600 },
  compressorHighHz: { min: 1_000, max: 10_000 },
  thresholdDb: { min: -60, max: 0 },
  ratio: { min: 1, max: 20 },
  attackMs: { min: 0.1, max: 200 },
  releaseMs: { min: 5, max: 2_000 },
  makeupDb: { min: 0, max: 24 },
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
} as const satisfies Record<string, IRange>;

const clampNumber = (
  value: unknown,
  range: IRange,
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : fallback;

const clampBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const DEFAULT_BAND: IBandSettings = {
  thresholdDb: -18,
  ratio: 2,
  attackMs: 10,
  releaseMs: 120,
  makeupDb: 0,
};

/**
 * The six bands, spread the way a mixing desk lays them out.
 *
 * Shelves at the ends and bells between, spaced roughly two octaves apart so
 * every band starts somewhere useful and none of them start on top of each
 * other. All at 0 dB, so opening the EQ changes nothing until something is
 * moved.
 */
const DEFAULT_EQ_BANDS: readonly IEqBandSettings[] = [
  {
    enabled: true,
    type: 'LSC',
    frequency: 32,
    gainDb: 0,
    quality: 0.7,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 50,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 80,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 125,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 200,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 315,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 500,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 800,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 1_250,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 2_000,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 3_150,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 5_000,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 8_000,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 12_500,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'HSC',
    frequency: 16_000,
    gainDb: 0,
    quality: 0.7,
    dynamic: false,
    thresholdDb: -24,
  },
];

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
 * Q for a rack whose bands sit `octaves` apart.
 *
 * The standard relation, Q = 1 / (2^(n/2) - 2^(-n/2)). It is what makes a
 * graphic EQ's bands meet at their skirts instead of leaving holes between
 * them (Q too high) or piling three bands onto one frequency (Q too low), and
 * it is why a 31-band rack wants Q≈4.3 where a 10-band wants Q≈1.4.
 */
const qForSpacing = (octaves: number): number =>
  Math.round((1 / (2 ** (octaves / 2) - 2 ** (-octaves / 2))) * 100) / 100;

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
  // Total span in octaves divided by the gaps between bands.
  const octaves =
    Math.log2(frequencies[frequencies.length - 1] / frequencies[0]) /
    Math.max(1, frequencies.length - 1);
  const quality = qForSpacing(octaves);
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
    presetId: '',
    splitHz: 110,
    attack: 0,
    sustain: 0,
    bloomAmount: 0,
    bloomDecayMs: 120,
    duck: 0,
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
  compressor: {
    enabled: false,
    crossoverHz: [200, 3_000],
    bands: [DEFAULT_BAND, DEFAULT_BAND, DEFAULT_BAND],
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
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clampBand = (value: unknown, fallback: IBandSettings): IBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    thresholdDb: clampNumber(
      value.thresholdDb,
      RANGES.thresholdDb,
      fallback.thresholdDb,
    ),
    ratio: clampNumber(value.ratio, RANGES.ratio, fallback.ratio),
    attackMs: clampNumber(value.attackMs, RANGES.attackMs, fallback.attackMs),
    releaseMs: clampNumber(
      value.releaseMs,
      RANGES.releaseMs,
      fallback.releaseMs,
    ),
    makeupDb: clampNumber(value.makeupDb, RANGES.makeupDb, fallback.makeupDb),
  };
};

const clampExciterBand = (
  value: unknown,
  fallback: IExciterBandSettings,
  bandIndex: number,
): IExciterBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  const band = {
    enabled: clampBoolean(value.enabled, fallback.enabled),
    freqHz:
      typeof value.freqHz === 'number' && Number.isFinite(value.freqHz)
        ? value.freqHz
        : fallback.freqHz,
    range: clampNumber(value.range, RANGES.exciterBandRange, fallback.range),
    drive: clampNumber(value.drive, RANGES.exciterDrive, fallback.drive),
    mix: clampNumber(value.mix, RANGES.exciterMix, fallback.mix),
    texture: clampNumber(
      value.texture,
      RANGES.exciterTexture,
      fallback.texture,
    ),
  };
  return {
    ...band,
    ...constrainExciterBandPosition(bandIndex, band.freqHz, band.range),
  };
};

/**
 * Read a settings blob from anywhere and return something usable.
 *
 * Clamps rather than rejects, and falls back field by field rather than
 * wholesale: a preset saved by a later build carrying one value this build
 * does not understand should cost the user that value, not every other
 * setting sitting beside it.
 */
/** The filter shapes an EQ band may claim to be. */
const EQ_TYPES = ['PK', 'NO', 'LSC', 'HSC', 'LPQ', 'HPQ', 'BP'] as const;

/** For a stored band past the default rack, which has no counterpart there. */
const FALLBACK_EQ_BAND: IEqBandSettings = {
  enabled: true,
  type: 'PK',
  frequency: 1_000,
  gainDb: 0,
  dynamic: false,
  thresholdDb: -24,
  quality: 1.4,
};

const clampEqBand = (
  value: unknown,
  fallback: IEqBandSettings,
): IEqBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    enabled: clampBoolean(value.enabled, fallback.enabled),
    // A stored string that no longer names a shape falls back rather than
    // reaching the coefficient maths, where an unknown type would silently
    // become a high shelf.
    type:
      typeof value.type === 'string' &&
      (EQ_TYPES as readonly string[]).includes(value.type)
        ? value.type
        : fallback.type,
    frequency: clampNumber(
      value.frequency,
      RANGES.eqFrequency,
      fallback.frequency,
    ),
    gainDb: clampNumber(value.gainDb, RANGES.eqGainDb, fallback.gainDb),
    quality: clampNumber(value.quality, RANGES.eqQuality, fallback.quality),
    dynamic: clampBoolean(value.dynamic, fallback.dynamic),
    thresholdDb: clampNumber(
      value.thresholdDb,
      RANGES.eqThresholdDb,
      fallback.thresholdDb,
    ),
  };
};

export const clampDspSettings = (value: unknown): IDspSettings => {
  if (!isRecord(value)) {
    return DSP_DEFAULTS;
  }
  const normalizer = isRecord(value.normalizer) ? value.normalizer : {};
  const denoise = isRecord(value.denoise) ? value.denoise : {};
  const denoiseHiss = isRecord(denoise.hiss) ? denoise.hiss : {};
  const denoiseHum = isRecord(denoise.hum) ? denoise.hum : {};
  const denoiseClick = isRecord(denoise.click) ? denoise.click : {};
  const denoiseVoice = isRecord(denoise.voice) ? denoise.voice : {};
  const crossfade = isRecord(value.crossfade) ? value.crossfade : {};
  const eq = isRecord(value.eq) ? value.eq : {};
  const storedEqBands = Array.isArray(eq.bands) ? eq.bands : [];
  const exciter = isRecord(value.exciter) ? value.exciter : {};
  const bassForge = isRecord(value.bassForge) ? value.bassForge : {};
  const bassPunch = isRecord(value.bassPunch) ? value.bassPunch : {};
  const dimension = isRecord(value.dimension) ? value.dimension : {};
  const compressor = isRecord(value.compressor) ? value.compressor : {};
  const maximizer = isRecord(value.maximizer) ? value.maximizer : {};
  const master = isRecord(value.master) ? value.master : {};
  const storedBands = Array.isArray(compressor.bands) ? compressor.bands : [];
  const storedCorners = Array.isArray(compressor.crossoverHz)
    ? compressor.crossoverHz
    : [];
  const storedOrganic = isRecord(exciter.organic) ? exciter.organic : {};
  const storedAlign = isRecord(exciter.align) ? exciter.align : {};
  let exciterStereo = DSP_DEFAULTS.exciter.stereo;
  if (EQ_STEREO_MODES.includes(storedOrganic.stereo as TEqStereo)) {
    exciterStereo = storedOrganic.stereo as TEqStereo;
  }
  if (EQ_STEREO_MODES.includes(exciter.stereo as TEqStereo)) {
    exciterStereo = exciter.stereo as TEqStereo;
  }

  /**
   * Two shapes of stored exciter get carried forward rather than discarded.
   *
   * The FIRST was one crossover, one drive and one mix. All three still exist
   * — they are the high band — and the old corner was "the frequency above
   * which harmonics are generated", which is exactly what that band's lower
   * edge means, so it carries across without reinterpretation.
   *
   * The SECOND had three bands sharing a pair of crossover corners. Those
   * corners were the boundaries between adjacent bands, so they become the
   * edges the bands started adjacent AT — the same three spans, now owned
   * individually and free to move apart or overlap.
   *
   * Falling back to the defaults instead would quietly discard settings
   * somebody tuned by ear, on upgrade, where nobody is watching for it.
   */
  const legacyCorner =
    typeof exciter.crossoverHz === 'number' ? exciter.crossoverHz : undefined;
  const legacyPair = Array.isArray(exciter.crossoverHz)
    ? (exciter.crossoverHz as unknown[])
    : undefined;
  const asHz = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const splitLow = asHz(legacyPair?.[0], 300);
  const splitHigh = asHz(legacyPair?.[1], 3_000);

  const storedExciterBands: unknown[] = Array.isArray(exciter.bands)
    ? exciter.bands
    : [undefined, undefined, undefined];

  /**
   * A stored pair of edges, as the centre and width that now describe it.
   *
   * Geometric centre and width in octaves, which is the pair the audio reads,
   * so a migrated band covers exactly the span it covered before.
   */
  const asSpan = (low: number, high: number) => ({
    freqHz: Math.sqrt(Math.max(20, low) * Math.min(20_000, high)),
    range: Math.max(
      0,
      Math.min(
        1,
        (Math.log2(Math.min(20_000, high) / Math.max(20, low)) -
          EXCITER_MIN_OCTAVES) /
          EXCITER_OCTAVE_SPAN,
      ),
    ),
  });

  /** The span a stored band should end up with, if it carries none itself. */
  const inheritedSpan = (index: number) => {
    if (legacyCorner !== undefined && index === 2) {
      return asSpan(legacyCorner, 20_000);
    }
    if (legacyPair) {
      return [
        asSpan(20, splitLow),
        asSpan(splitLow, splitHigh),
        asSpan(splitHigh, 20_000),
      ][index];
    }
    const fallback = DSP_DEFAULTS.exciter.bands[index];
    return { freqHz: fallback.freqHz, range: fallback.range };
  };

  /* A pre-band exciter's drive and mix belong to the high band. */
  if (legacyCorner !== undefined && !Array.isArray(exciter.bands)) {
    storedExciterBands[2] = {
      ...DSP_DEFAULTS.exciter.bands[2],
      drive: exciter.drive,
      mix: exciter.mix,
    };
  }

  return {
    enabled: clampBoolean(value.enabled, DSP_DEFAULTS.enabled),
    presetId:
      typeof value.presetId === 'string'
        ? value.presetId
        : DSP_DEFAULTS.presetId,
    normalizer: {
      mode: NORMALIZER_MODES.includes(normalizer.mode as TNormalizerMode)
        ? (normalizer.mode as TNormalizerMode)
        : DSP_DEFAULTS.normalizer.mode,
      truePeakDbtp: clampNumber(
        normalizer.truePeakDbtp,
        RANGES.normalizerTruePeakDbtp,
        DSP_DEFAULTS.normalizer.truePeakDbtp,
      ),
      targetLufs: clampNumber(
        normalizer.targetLufs,
        RANGES.normalizerTargetLufs,
        DSP_DEFAULTS.normalizer.targetLufs,
      ),
    },
    denoise: {
      enabled: clampBoolean(denoise.enabled, DSP_DEFAULTS.denoise.enabled),
      presetId:
        typeof denoise.presetId === 'string'
          ? denoise.presetId
          : DSP_DEFAULTS.denoise.presetId,
      isolate: clampBoolean(denoise.isolate, DSP_DEFAULTS.denoise.isolate),
      profileSource: DENOISE_PROFILE_SOURCES.includes(
        denoise.profileSource as TDenoiseProfileSource,
      )
        ? (denoise.profileSource as TDenoiseProfileSource)
        : DSP_DEFAULTS.denoise.profileSource,
      hiss: {
        enabled: clampBoolean(
          denoiseHiss.enabled,
          DSP_DEFAULTS.denoise.hiss.enabled,
        ),
        amount: clampNumber(
          denoiseHiss.amount,
          RANGES.denoiseAmount,
          DSP_DEFAULTS.denoise.hiss.amount,
        ),
        floorDb: clampNumber(
          denoiseHiss.floorDb,
          RANGES.denoiseFloorDb,
          DSP_DEFAULTS.denoise.hiss.floorDb,
        ),
        sensitivityDb: clampNumber(
          denoiseHiss.sensitivityDb,
          RANGES.denoiseSensitivityDb,
          DSP_DEFAULTS.denoise.hiss.sensitivityDb,
        ),
        smoothing: clampNumber(
          denoiseHiss.smoothing,
          RANGES.denoiseSmoothing,
          DSP_DEFAULTS.denoise.hiss.smoothing,
        ),
      },
      hum: {
        enabled: clampBoolean(
          denoiseHum.enabled,
          DSP_DEFAULTS.denoise.hum.enabled,
        ),
        mode: DENOISE_HUM_MODES.includes(denoiseHum.mode as TDenoiseHumMode)
          ? (denoiseHum.mode as TDenoiseHumMode)
          : DSP_DEFAULTS.denoise.hum.mode,
        // Rounded, because this counts notches. A stored 6.5 would otherwise
        // place six and leave the seventh half-built.
        harmonics: Math.round(
          clampNumber(
            denoiseHum.harmonics,
            RANGES.denoiseHumHarmonics,
            DSP_DEFAULTS.denoise.hum.harmonics,
          ),
        ),
        depthDb: clampNumber(
          denoiseHum.depthDb,
          RANGES.denoiseHumDepthDb,
          DSP_DEFAULTS.denoise.hum.depthDb,
        ),
        quality: clampNumber(
          denoiseHum.quality,
          RANGES.denoiseHumQuality,
          DSP_DEFAULTS.denoise.hum.quality,
        ),
      },
      click: {
        enabled: clampBoolean(
          denoiseClick.enabled,
          DSP_DEFAULTS.denoise.click.enabled,
        ),
        sensitivity: clampNumber(
          denoiseClick.sensitivity,
          RANGES.denoiseClickSensitivity,
          DSP_DEFAULTS.denoise.click.sensitivity,
        ),
        // A sample count, and the repair loop indexes with it.
        maxRepairSamples: Math.round(
          clampNumber(
            denoiseClick.maxRepairSamples,
            RANGES.denoiseClickRepairSamples,
            DSP_DEFAULTS.denoise.click.maxRepairSamples,
          ),
        ),
      },
      voice: {
        enabled: clampBoolean(
          denoiseVoice.enabled,
          DSP_DEFAULTS.denoise.voice.enabled,
        ),
        amount: clampNumber(
          denoiseVoice.amount,
          RANGES.denoiseAmount,
          DSP_DEFAULTS.denoise.voice.amount,
        ),
      },
    },
    crossfade: {
      enabled: clampBoolean(crossfade.enabled, DSP_DEFAULTS.crossfade.enabled),
      durationMs: clampNumber(
        crossfade.durationMs,
        RANGES.crossfadeDurationMs,
        DSP_DEFAULTS.crossfade.durationMs,
      ),
      curve: CROSSFADE_CURVES.includes(crossfade.curve as TCrossfadeCurve)
        ? (crossfade.curve as TCrossfadeCurve)
        : DSP_DEFAULTS.crossfade.curve,
      shape: clampCrossfadeShape(crossfade.shape),
    },
    eq: {
      enabled: clampBoolean(eq.enabled, DSP_DEFAULTS.eq.enabled),
      isolate: clampBoolean(eq.isolate, DSP_DEFAULTS.eq.isolate),
      // A stored name that no longer exists falls back rather than reaching
      // the coefficient maths, where an unknown model would silently become
      // whichever branch happens to be last.
      model: EQ_MODELS.includes(eq.model as TEqModel)
        ? (eq.model as TEqModel)
        : 'clean',
      modelAmount: clampNumber(eq.modelAmount, { min: 0, max: 1 }, 1),
      engine: EQ_ENGINES.includes(eq.engine as TEqEngine)
        ? (eq.engine as TEqEngine)
        : 'serial',
      phase: EQ_PHASE_MODES.includes(eq.phase as TEqPhase)
        ? (eq.phase as TEqPhase)
        : 'minimum',
      stereo: EQ_STEREO_MODES.includes(eq.stereo as TEqStereo)
        ? (eq.stereo as TEqStereo)
        : 'stereo',
      // Zero is off. Above 300 Hz this stops being a safety measure and starts
      // collapsing the image somewhere people can hear it.
      monoBelowHz:
        typeof eq.monoBelowHz === 'number' && eq.monoBelowHz > 0
          ? Math.min(300, Math.max(40, eq.monoBelowHz))
          : 0,
      // A stored `true` predates the factor and meant twice, so it still does.
      oversample: OVERSAMPLE_FACTORS.includes(eq.oversample as number)
        ? (eq.oversample as number)
        : (eq.oversample === true && 2) || 1,
      // Zero means off, and any other value is pulled into a range where a
      // high pass is protective rather than audible.
      subsonicHz:
        typeof eq.subsonicHz === 'number' && eq.subsonicHz > 0
          ? Math.min(40, Math.max(10, eq.subsonicHz))
          : 0,
      fuzzAmount: clampNumber(eq.fuzzAmount, { min: 0, max: 1 }, 0),
      presetId: typeof eq.presetId === 'string' ? eq.presetId : '',
      // The stored rack decides its own length now, so an imported ten-filter
      // curve comes back as ten bands rather than being padded out to fifteen
      // with silent ones. A band past the default rack has no fallback of its
      // own, so it borrows the generic bell — reached only when a stored entry
      // is corrupt, since a sound one supplies every field itself.
      bands: Array.from(
        {
          length: Math.min(
            EQ_MAX_BAND_COUNT,
            Math.max(1, storedEqBands.length || DSP_DEFAULTS.eq.bands.length),
          ),
        },
        (_, index) =>
          clampEqBand(
            storedEqBands[index],
            DSP_DEFAULTS.eq.bands[index] ?? FALLBACK_EQ_BAND,
          ),
      ),
      sourceBands: (Array.isArray(eq.sourceBands) ? eq.sourceBands : [])
        .slice(0, EQ_MAX_BAND_COUNT)
        .map((band) => clampEqBand(band, FALLBACK_EQ_BAND)),
    },
    exciter: {
      enabled: clampBoolean(exciter.enabled, DSP_DEFAULTS.exciter.enabled),
      presetId: typeof exciter.presetId === 'string' ? exciter.presetId : '',
      // An Organic-only mode from the previous build becomes the whole-stage
      // mode rather than being discarded during migration.
      stereo: exciterStereo,
      bands: DSP_DEFAULTS.exciter.bands.map((fallback, index) =>
        clampExciterBand(
          storedExciterBands[index],
          {
            ...fallback,
            ...inheritedSpan(index),
          },
          index,
        ),
      ),
      organic: {
        enabled: clampBoolean(
          storedOrganic.enabled,
          DSP_DEFAULTS.exciter.organic.enabled,
        ),
        amount: clampNumber(
          storedOrganic.amount,
          RANGES.organicAmount,
          DSP_DEFAULTS.exciter.organic.amount,
        ),
        focusHz: clampNumber(
          storedOrganic.focusHz,
          RANGES.organicFocusHz,
          DSP_DEFAULTS.exciter.organic.focusHz,
        ),
        range: clampNumber(
          storedOrganic.range,
          RANGES.organicRange,
          DSP_DEFAULTS.exciter.organic.range,
        ),
      },
      align: {
        enabled: clampBoolean(
          storedAlign.enabled,
          DSP_DEFAULTS.exciter.align.enabled,
        ),
        amount: clampNumber(
          storedAlign.amount,
          RANGES.alignAmount,
          DSP_DEFAULTS.exciter.align.amount,
        ),
      },
      // Clamped like any other flag, and NOT forced false here.
      //
      // Forcing it here is what stopped isolate working at all. This function
      // is not only a storage reader: it runs on every patch AND on every
      // settings message the worklet receives, so a value forced false here is
      // stripped between the button and the audio. Not persisting it is a fact
      // about STORAGE, and it belongs where storage is read — `readStored` in
      // `store.ts` drops it there, which is the only place it should be
      // dropped.
      isolate: clampBoolean(exciter.isolate, DSP_DEFAULTS.exciter.isolate),
    },
    bassForge: {
      enabled: clampBoolean(bassForge.enabled, DSP_DEFAULTS.bassForge.enabled),
      isolate: clampBoolean(bassForge.isolate, DSP_DEFAULTS.bassForge.isolate),
      presetId:
        typeof bassForge.presetId === 'string' ? bassForge.presetId : '',
      splitHz: clampNumber(
        bassForge.splitHz,
        RANGES.bassSplitHz,
        DSP_DEFAULTS.bassForge.splitHz,
      ),
      driveDb: clampNumber(
        bassForge.driveDb,
        RANGES.bassForgeDriveDb,
        DSP_DEFAULTS.bassForge.driveDb,
      ),
      subAmount: clampNumber(
        bassForge.subAmount,
        RANGES.bassForgeAmount,
        DSP_DEFAULTS.bassForge.subAmount,
      ),
      presenceAmount: clampNumber(
        bassForge.presenceAmount,
        RANGES.bassForgeAmount,
        DSP_DEFAULTS.bassForge.presenceAmount,
      ),
      texture: clampNumber(
        bassForge.texture,
        RANGES.bassForgeTexture,
        DSP_DEFAULTS.bassForge.texture,
      ),
      mix: clampNumber(
        bassForge.mix,
        RANGES.bassAmount,
        DSP_DEFAULTS.bassForge.mix,
      ),
    },
    bassPunch: {
      enabled: clampBoolean(bassPunch.enabled, DSP_DEFAULTS.bassPunch.enabled),
      isolate: clampBoolean(bassPunch.isolate, DSP_DEFAULTS.bassPunch.isolate),
      presetId:
        typeof bassPunch.presetId === 'string' ? bassPunch.presetId : '',
      splitHz: clampNumber(
        bassPunch.splitHz,
        RANGES.bassSplitHz,
        DSP_DEFAULTS.bassPunch.splitHz,
      ),
      attack: clampNumber(
        bassPunch.attack,
        RANGES.bassPunchShape,
        DSP_DEFAULTS.bassPunch.attack,
      ),
      sustain: clampNumber(
        bassPunch.sustain,
        RANGES.bassPunchShape,
        DSP_DEFAULTS.bassPunch.sustain,
      ),
      bloomAmount: clampNumber(
        bassPunch.bloomAmount,
        RANGES.bassAmount,
        DSP_DEFAULTS.bassPunch.bloomAmount,
      ),
      bloomDecayMs: clampNumber(
        bassPunch.bloomDecayMs,
        RANGES.bassPunchBloomDecayMs,
        DSP_DEFAULTS.bassPunch.bloomDecayMs,
      ),
      duck: clampNumber(
        bassPunch.duck,
        RANGES.bassAmount,
        DSP_DEFAULTS.bassPunch.duck,
      ),
    },
    dimension: {
      enabled: clampBoolean(dimension.enabled, DSP_DEFAULTS.dimension.enabled),
      presetId:
        typeof dimension.presetId === 'string' ? dimension.presetId : '',
      lowWidth: clampNumber(
        dimension.lowWidth,
        RANGES.dimensionLowWidth,
        DSP_DEFAULTS.dimension.lowWidth,
      ),
      midWidth: clampNumber(
        dimension.midWidth,
        RANGES.dimensionWidth,
        DSP_DEFAULTS.dimension.midWidth,
      ),
      highWidth: clampNumber(
        dimension.highWidth,
        RANGES.dimensionWidth,
        DSP_DEFAULTS.dimension.highWidth,
      ),
      lowHz: clampNumber(
        dimension.lowHz,
        RANGES.dimensionLowHz,
        DSP_DEFAULTS.dimension.lowHz,
      ),
      highHz: clampNumber(
        dimension.highHz,
        RANGES.dimensionHighHz,
        DSP_DEFAULTS.dimension.highHz,
      ),
      decorrelation: clampNumber(
        dimension.decorrelation,
        RANGES.dimensionDecorrelation,
        DSP_DEFAULTS.dimension.decorrelation,
      ),
    },
    compressor: {
      enabled: clampBoolean(
        compressor.enabled,
        DSP_DEFAULTS.compressor.enabled,
      ),
      crossoverHz: [
        clampNumber(
          storedCorners[0],
          RANGES.compressorLowHz,
          DSP_DEFAULTS.compressor.crossoverHz[0],
        ),
        clampNumber(
          storedCorners[1],
          RANGES.compressorHighHz,
          DSP_DEFAULTS.compressor.crossoverHz[1],
        ),
      ],
      bands: DSP_DEFAULTS.compressor.bands.map((fallback, index) =>
        clampBand(storedBands[index], fallback),
      ),
    },
    maximizer: {
      enabled: clampBoolean(maximizer.enabled, DSP_DEFAULTS.maximizer.enabled),
      presetId:
        typeof maximizer.presetId === 'string' ? maximizer.presetId : '',
      driveDb: clampNumber(
        maximizer.driveDb,
        RANGES.maximizerDriveDb,
        DSP_DEFAULTS.maximizer.driveDb,
      ),
      ceilingDb: clampNumber(
        maximizer.ceilingDb,
        RANGES.ceilingDb,
        DSP_DEFAULTS.maximizer.ceilingDb,
      ),
      lookAheadMs: clampNumber(
        maximizer.lookAheadMs,
        RANGES.lookAheadMs,
        DSP_DEFAULTS.maximizer.lookAheadMs,
      ),
      releaseMs: clampNumber(
        maximizer.releaseMs,
        RANGES.maximizerReleaseMs,
        DSP_DEFAULTS.maximizer.releaseMs,
      ),
    },
    master: {
      enabled: clampBoolean(master.enabled, DSP_DEFAULTS.master.enabled),
      presetId: typeof master.presetId === 'string' ? master.presetId : '',
      outputTrimDb: clampNumber(
        master.outputTrimDb,
        RANGES.masterOutputTrimDb,
        DSP_DEFAULTS.master.outputTrimDb,
      ),
      loudnessMaximize: clampBoolean(
        master.loudnessMaximize,
        DSP_DEFAULTS.master.loudnessMaximize,
      ),
      loudnessTargetLufs: clampNumber(
        master.loudnessTargetLufs,
        RANGES.masterLoudnessTargetLufs,
        DSP_DEFAULTS.master.loudnessTargetLufs,
      ),
      ceilingDb: clampNumber(
        master.ceilingDb,
        RANGES.masterCeilingDb,
        DSP_DEFAULTS.master.ceilingDb,
      ),
      releaseMs: clampNumber(
        master.releaseMs,
        RANGES.masterReleaseMs,
        DSP_DEFAULTS.master.releaseMs,
      ),
      peakLimitingDb: clampNumber(
        master.peakLimitingDb,
        RANGES.masterPeakLimitingDb,
        DSP_DEFAULTS.master.peakLimitingDb,
      ),
      matchedBypass: clampBoolean(
        master.matchedBypass,
        DSP_DEFAULTS.master.matchedBypass,
      ),
    },
  };
};
