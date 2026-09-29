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

import { ICrossfadeShape } from './crossfadeShape';
import type { TEqStereo } from './chainSettings';

// The settings of the rack's stages before the EQ and after it - exciter,
// organic, phase align, Bass Forge and Punch, Dimension, the Maximizer, the
// input normalizer, restoration and crossfade - with the tables and limits
// they are read against. chain.ts re-exports all of it.

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
  /** 0 is dry; 1 is normal; 2 doubles additions and deepens cuts in decibels. */
  mix: number;
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

export type TDenoiseVoiceMode = 'voice' | 'background';

/**
 * Legacy values retained because the native wire carries the index.
 *
 * Background was removed from the product: this is a speech denoiser, not a
 * stem separator. Settings now normalise the slot to Voice and the native
 * engine ignores it, but the second value cannot be renumbered out of old
 * presets or automation messages.
 */
export const DENOISE_VOICE_MODES: readonly TDenoiseVoiceMode[] = [
  'voice',
  'background',
];

/**
 * The neural module, which only exists once its model has been downloaded.
 *
 * `enabled` is what the user asked for and not what is running: with no model
 * present the stage reports itself unavailable rather than silently passing
 * audio through a control that reads as on.
 */
export interface IDenoiseVoiceSettings {
  enabled: boolean;
  /** Legacy wire slot. The speech denoiser always keeps its cleaned output. */
  mode: TDenoiseVoiceMode;
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
