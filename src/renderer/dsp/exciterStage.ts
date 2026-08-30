/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../common/constants';
import {
  IExciterBandSettings,
  IExciterSettings,
  exciterBandEdgesForIndex,
} from '../../common/dsp/chain';
import {
  IBiquadCoefficients,
  IBiquadState,
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from './biquad';
import {
  ANALOG_DIODE_MAX_CHARACTER,
  IExciterTransientState,
  analogDiodeExcitedSample,
  analogDiodeOctaveSample,
  createExciterTransientState,
  exciterTransientSample,
  limitExciterCurrent,
  resetExciterTransientState,
} from './analogDiode';
import {
  IOversamplerState,
  createOversampler,
  downsample,
  oversampleFactorForSampleRate,
  upsample,
} from './oversample';
import {
  IExciterGuardState,
  bandExciterReturnGain,
  createExciterGuard,
  guardExciterReturn,
} from './exciterGuard';

/**
 * Three parallel Aural Exciter sidechains.
 *
 * Each path is a phase-shifting band filter followed by a smooth, driven
 * harmonic creator. As in US 4,150,253, the excited return contains both the
 * filtered fundamentals and their low-order harmonics. That complete return is
 * attenuated beneath untouched dry, and Isolate plays the same return alone.
 */
const MAX_OVERSAMPLE = 4;
const FILTER_Q = Math.SQRT1_2;
const BAND_EDGE_MIN_HZ = 21;
const BAND_EDGE_MAX_HZ = 19_900;
const PARAMETER_SMOOTHING_MS = 18;
const DC_POLE = 0.9974;
const SIDECHAIN_LEVEL = 1;
const BAND_HARMONIC_GAIN = [1.8, 2.4] as const;
const LOW_TRANSIENT_HARMONIC_LIFT = 0.35;
const MID_TRANSIENT_HARMONIC_LIFT = 0.3;
const HIGH_TRANSIENT_HARMONIC_LIFT = 0.22;
/** High keeps a quiet carrier for continuity; the residue supplies the air. */
const HIGH_FOUNDATION_LEVEL = 0.18;
const HIGH_HARMONIC_GAIN = 1.65;
const HIGH_MIN_CHARACTER = 0.28;
const HIGH_MAX_EFFECTIVE_DRIVE = 2.85;

const IDENTITY_COEFFICIENTS: IBiquadCoefficients = {
  b0: 1,
  b1: 0,
  b2: 0,
  a1: 0,
  a2: 0,
};

interface IDcState {
  x: number;
  y: number;
}

interface IBandCoefficientCache {
  lowHz: number;
  highHz: number;
  sampleRate: number;
  highpass: IBiquadCoefficients;
  lowpass: IBiquadCoefficients;
}

export interface IExciterChannelState {
  /** One two-pole highpass and lowpass per independently movable band. */
  bandFilters: IBiquadState[][];
  bandCoefficients: IBandCoefficientCache[];
  bands: Float32Array[];
  wetReturn: Float32Array;
  oversamplers: IOversamplerState[];
  highGuard: IExciterGuardState;
  highHarmonicFilter: IBiquadState;
  highHarmonicCoefficients: IBiquadCoefficients;
  highHarmonicHz: number;
  highHarmonicSampleRate: number;
  wide: Float32Array;
  wideDry: Float32Array;
  drive: number[];
  texture: number[];
  mix: number[];
  transients: IExciterTransientState[];
  /** Unity normally; smoothly reaches zero for the Isolate monitor. */
  dryMix: number;
  dcState: IDcState[];
  dry: Float32Array;
  report: { bands: number[] };
}

export const createExciterChannel = (
  blockSize: number,
): IExciterChannelState => ({
  bandFilters: [0, 1, 2].map(() => [createBiquadState(), createBiquadState()]),
  bandCoefficients: [0, 1, 2].map(() => ({
    lowHz: 0,
    highHz: 0,
    sampleRate: 0,
    highpass: IDENTITY_COEFFICIENTS,
    lowpass: IDENTITY_COEFFICIENTS,
  })),
  bands: [0, 1, 2].map(() => new Float32Array(blockSize)),
  wetReturn: new Float32Array(blockSize),
  oversamplers: [0, 1, 2].map(() => createOversampler(blockSize)),
  highGuard: createExciterGuard(),
  highHarmonicFilter: createBiquadState(),
  highHarmonicCoefficients: IDENTITY_COEFFICIENTS,
  highHarmonicHz: 0,
  highHarmonicSampleRate: 0,
  wide: new Float32Array(blockSize * MAX_OVERSAMPLE),
  wideDry: new Float32Array(blockSize * MAX_OVERSAMPLE),
  drive: [0, 0, 0],
  texture: [0, 0, 0],
  mix: [0, 0, 0],
  transients: [0, 1, 2].map(() => createExciterTransientState()),
  dryMix: 1,
  dcState: [0, 1, 2].map(() => ({ x: 0, y: 0 })),
  dry: new Float32Array(blockSize),
  report: { bands: [0, 0, 0] },
});

const resize = (state: IExciterChannelState, frames: number): void => {
  if (state.wetReturn.length === frames) {
    return;
  }
  state.bands = [0, 1, 2].map(() => new Float32Array(frames));
  state.wetReturn = new Float32Array(frames);
  state.wide = new Float32Array(frames * MAX_OVERSAMPLE);
  state.wideDry = new Float32Array(frames * MAX_OVERSAMPLE);
  state.dry = new Float32Array(frames);
};

const smoothing = (milliseconds: number, sampleRate: number): number =>
  1 - Math.exp(-1 / ((milliseconds / 1_000) * sampleRate));

const blockDc = (state: IDcState, buffer: Float32Array): void => {
  for (let i = 0; i < buffer.length; i += 1) {
    const x = buffer[i];
    const y = x - state.x + DC_POLE * state.y;
    state.x = x;
    state.y = y;
    buffer[i] = y;
  }
};

/**
 * Excited sidechain made by a biased soft diode pair.
 *
 * Its tangent is normalised rather than removed: the phase-shaped filtered
 * fundamental is the smooth foundation, and the curvature adds low-order
 * harmonics around it. Texture changes richness without a gate or block
 * measurement moving the waveform beneath the user's hands. The internal
 * transient detector can scale the curvature separately, leaving the
 * foundation and wet amount fixed.
 */
export const exciterSidechainSample = (
  sample: number,
  drive: number,
  texture: number,
  harmonicGain = 1,
  baseHarmonicGain: number = BAND_HARMONIC_GAIN[1],
): number =>
  analogDiodeExcitedSample(
    sample,
    drive,
    texture,
    SIDECHAIN_LEVEL,
    harmonicGain * baseHarmonicGain,
  );

/**
 * How far the low band leans on the octave, at rest and fully textured.
 *
 * Not 1 even at its warmest: a purely even shape is a pure octave doubler and
 * loses the root of the note. Keeping a quarter of the odd shape is what stops
 * it sounding like a different instrument playing along.
 */
const LOW_EVEN_WEIGHT_WARM = 0.75;
const LOW_EVEN_WEIGHT_PRESENT = 0.3;

/**
 * The low band, weighted toward the octave, with Texture as the lever.
 *
 * Bass is the one range where the harmonic that matters is not a matter of
 * taste. The ear infers a fundamental from its overtones, so a speaker that
 * cannot reproduce 60 Hz still hears "60 Hz" from a strong 120 — which is why a
 * low exciter exists at all. That effect is carried by the EVEN orders; the odd
 * ones sit a twelfth and a seventeenth above the root, where they are heard as
 * hardness rather than weight.
 *
 * Texture moves the interval rather than only the amount. At rest it is nearly
 * all octave: round, and the reason a small speaker finds the note. Turned up it
 * lets the odd orders back in, which is where definition and the sense of the
 * bass cutting through a mix come from.
 */
export const lowExciterHarmonicSample = (
  sample: number,
  drive: number,
  texture: number,
  harmonicGain = 1,
): number => {
  const normalisedTexture = Math.max(
    0,
    Math.min(1, texture / ANALOG_DIODE_MAX_CHARACTER),
  );
  const evenWeight =
    LOW_EVEN_WEIGHT_WARM +
    (LOW_EVEN_WEIGHT_PRESENT - LOW_EVEN_WEIGHT_WARM) * normalisedTexture;
  return analogDiodeOctaveSample(
    sample,
    drive,
    texture,
    SIDECHAIN_LEVEL,
    harmonicGain * BAND_HARMONIC_GAIN[0],
    evenWeight,
  );
};

/**
 * Which shape each band uses, in one place.
 *
 * The three are genuinely different instruments rather than one curve with
 * three sets of numbers: High generates air above a quiet carrier, Low leans on
 * the octave because that is what bass warmth is, and Mid is the plain excited
 * sidechain between them.
 */
const bandHarmonicSample = (
  band: number,
  sample: number,
  drive: number,
  texture: number,
  harmonicGain: number,
): number => {
  if (band === 2) {
    return highExciterHarmonicSample(sample, drive, texture, harmonicGain);
  }
  if (band === 0) {
    return lowExciterHarmonicSample(sample, drive, texture, harmonicGain);
  }
  return exciterSidechainSample(
    sample,
    drive,
    texture,
    harmonicGain,
    BAND_HARMONIC_GAIN[band],
  );
};

const normaliseHighDrive = (drive: number): number => {
  const normalised = Math.max(0, Math.min(1, (drive - 1) / 2.5));
  // High harmonics become brittle before Low/Mid do. Give the first half of
  // the dial useful travel, then compress its last half into a protected 2.85x
  // ceiling rather than allowing a manual setting to become fuzz.
  return 1 + normalised ** 0.85 * (HIGH_MAX_EFFECTIVE_DRIVE - 1);
};

const highCharacter = (texture: number): number => {
  const normalised = Math.max(
    0,
    Math.min(1, texture / ANALOG_DIODE_MAX_CHARACTER),
  );
  // A High band must remain an air/presence generator at the warm end. Low
  // and Mid can lean fully into even body; High starts mixed and travels to
  // the odd-rich edge without crossing into a second body control.
  return (
    HIGH_MIN_CHARACTER +
    normalised ** 0.9 * (ANALOG_DIODE_MAX_CHARACTER - HIGH_MIN_CHARACTER)
  );
};

/**
 * High-specific excited return.
 *
 * Limiting the complete waveform made Drive erase the filtered foundation:
 * measured at 4.5 kHz, the old maximum Drive left only 11% of the fundamental
 * present at minimum Drive. Keep the quiet foundation explicit and protect
 * only the nonlinear residue. Drive can then increase harmonic density,
 * Texture can change its family, and neither control secretly becomes Amount.
 */
export const highExciterSample = (
  sample: number,
  drive: number,
  texture: number,
  transientHarmonicGain = 1,
): number => {
  return (
    sample * HIGH_FOUNDATION_LEVEL +
    highExciterHarmonicSample(sample, drive, texture, transientHarmonicGain)
  );
};

const highExciterHarmonicSample = (
  sample: number,
  drive: number,
  texture: number,
  transientHarmonicGain: number,
): number => {
  const normalisedTexture = Math.max(
    0,
    Math.min(1, texture / ANALOG_DIODE_MAX_CHARACTER),
  );
  const complete = analogDiodeExcitedSample(
    sample,
    normaliseHighDrive(drive),
    highCharacter(texture),
    SIDECHAIN_LEVEL,
  );
  // As odd harmonics move upward, more of them leave the audible band. A
  // modest static lift keeps Texture's airy end present without following the
  // programme or changing the user-authored Amount.
  const textureCompensation = 0.9 + normalisedTexture * 0.25;
  const residue =
    (complete - sample * SIDECHAIN_LEVEL) *
    HIGH_HARMONIC_GAIN *
    textureCompensation *
    transientHarmonicGain;
  return limitExciterCurrent(residue);
};

const transientHarmonicLift = (band: number): number => {
  if (band === 2) {
    return HIGH_TRANSIENT_HARMONIC_LIFT;
  }
  return band === 1 ? MID_TRANSIENT_HARMONIC_LIFT : LOW_TRANSIENT_HARMONIC_LIFT;
};

const extractBand = (
  state: IExciterChannelState,
  band: number,
  setup: IExciterBandSettings,
  sampleRate: number,
): Float32Array => {
  const source = state.bands[band];
  source.set(state.dry);
  const filters = state.bandFilters[band];
  const { lowHz, highHz } = exciterBandEdgesForIndex(
    band,
    setup.freqHz,
    setup.range,
  );
  const cached = state.bandCoefficients[band];
  if (
    cached.lowHz !== lowHz ||
    cached.highHz !== highHz ||
    cached.sampleRate !== sampleRate
  ) {
    cached.lowHz = lowHz;
    cached.highHz = highHz;
    cached.sampleRate = sampleRate;
    cached.highpass =
      lowHz > BAND_EDGE_MIN_HZ
        ? biquadCoefficients(
            {
              type: FilterTypeEnum.HPQ,
              frequency: lowHz,
              gainDb: 0,
              quality: FILTER_Q,
            },
            sampleRate,
          )
        : IDENTITY_COEFFICIENTS;
    cached.lowpass =
      highHz < BAND_EDGE_MAX_HZ
        ? biquadCoefficients(
            {
              type: FilterTypeEnum.LPQ,
              frequency: highHz,
              gainDb: 0,
              quality: FILTER_Q,
            },
            sampleRate,
          )
        : IDENTITY_COEFFICIENTS;
  }
  processBiquad(filters[0], source, cached.highpass);
  processBiquad(filters[1], source, cached.lowpass);
  return source;
};

const shapeBand = (
  state: IExciterChannelState,
  band: number,
  source: Float32Array,
  setup: IExciterBandSettings,
  sampleRate: number,
): void => {
  const oversample = oversampleFactorForSampleRate(sampleRate);
  const wideLength = source.length * oversample;
  upsample(state.oversamplers[band], source, state.wideDry, oversample);
  const wideRate = sampleRate * oversample;
  const smooth = smoothing(PARAMETER_SMOOTHING_MS, wideRate);
  const transientLift = transientHarmonicLift(band);
  if (state.drive[band] === 0) {
    state.drive[band] = setup.drive;
    state.texture[band] = setup.texture;
  }

  for (let i = 0; i < wideLength; i += 1) {
    state.drive[band] += (setup.drive - state.drive[band]) * smooth;
    state.texture[band] += (setup.texture - state.texture[band]) * smooth;
    const filteredSample = state.wideDry[i];
    const transient = exciterTransientSample(
      state.transients[band],
      filteredSample,
      wideRate,
    );
    const transientHarmonicGain = 1 + transient * transientLift;
    const protectedCurrent = bandHarmonicSample(
      band,
      filteredSample,
      state.drive[band],
      state.texture[band],
      transientHarmonicGain,
    );
    // The fixed curve returns the whole excited sidechain. Keeping it in one
    // buffer guarantees Isolate cannot present a different signal from the one
    // that is added beneath the dry programme.
    state.wide[i] = protectedCurrent;
  }
  downsample(state.oversamplers[band], state.wide, state.wetReturn, oversample);
  blockDc(state.dcState[band], state.wetReturn);
  if (band === 2) {
    if (
      state.highHarmonicHz !== setup.freqHz ||
      state.highHarmonicSampleRate !== sampleRate
    ) {
      state.highHarmonicHz = setup.freqHz;
      state.highHarmonicSampleRate = sampleRate;
      state.highHarmonicCoefficients = biquadCoefficients(
        {
          type: FilterTypeEnum.HPQ,
          frequency: setup.freqHz,
          gainDb: 0,
          quality: FILTER_Q,
        },
        sampleRate,
      );
    }
    // High is an upper-harmonic return, not a louder copy of its source band.
    // The region centre separates the extracted presence from the air it
    // creates, so generated orders pass while source-frequency carrier falls.
    processBiquad(
      state.highHarmonicFilter,
      state.wetReturn,
      state.highHarmonicCoefficients,
    );
    // The foundation is linear and does not need oversampling. Restoring it
    // from the already-filtered source keeps it aligned with dry; sending it
    // through the FIR round trip made this additive return comb-filter the mix.
    for (let sample = 0; sample < state.wetReturn.length; sample += 1) {
      state.wetReturn[sample] += source[sample] * HIGH_FOUNDATION_LEVEL;
    }
    guardExciterReturn(state.highGuard, state.wetReturn, sampleRate);
  }
};

const addBand = (
  state: IExciterChannelState,
  band: number,
  target: Float32Array,
  source: Float32Array,
  setup: IExciterBandSettings,
  returnScale: number,
  processorEnabled: boolean,
  sampleRate: number,
): number => {
  const enabledMix = bandExciterReturnGain(setup.mix, band) * returnScale;
  const targetMix = processorEnabled && setup.enabled ? enabledMix : 0;
  if (targetMix <= 0 && state.mix[band] <= 0.0001) {
    state.mix[band] = 0;
    resetExciterTransientState(state.transients[band]);
    return 0;
  }

  shapeBand(state, band, source, setup, sampleRate);
  const smooth = smoothing(PARAMETER_SMOOTHING_MS, sampleRate);
  let meanMix = 0;
  for (let i = 0; i < target.length; i += 1) {
    state.mix[band] += (targetMix - state.mix[band]) * smooth;
    // This is the complete excited return Isolate plays: the quiet filtered
    // foundation and the low-order harmonics created around it.
    target[i] += state.wetReturn[i] * state.mix[band];
    meanMix += state.mix[band];
  }
  return target.length > 0 ? meanMix / target.length : 0;
};

export const exciterChannelIsActive = (state: IExciterChannelState): boolean =>
  state.mix[0] > 0.0001 ||
  state.mix[1] > 0.0001 ||
  state.mix[2] > 0.0001 ||
  Math.abs(1 - state.dryMix) > 0.0001;

/** Run one channel in place and report the contribution meters. */
export const runExciterChannel = (
  state: IExciterChannelState,
  target: Float32Array,
  settings: IExciterSettings,
  sampleRate: number,
): { bands: number[] } => {
  resize(state, target.length);
  const { report } = state;
  report.bands.fill(0);
  state.dry.set(target);
  if (!settings.enabled && !exciterChannelIsActive(state)) {
    return report;
  }

  const targetDryMix = settings.enabled && settings.isolate ? 0 : 1;
  const drySmooth = smoothing(PARAMETER_SMOOTHING_MS, sampleRate);
  for (let i = 0; i < target.length; i += 1) {
    state.dryMix += (targetDryMix - state.dryMix) * drySmooth;
    target[i] = state.dry[i] * state.dryMix;
  }

  // The three independently movable bands may overlap. Each processed path
  // needs enough return to be audible, but their foundations must never add up
  // to several full copies of the filtered programme. Preserve every authored
  // balance and normalise only when the requested parallel returns exceed
  // unity together. Adjacent/default bands are unaffected.
  const requestedReturn = settings.bands.reduce(
    (total, band, index) =>
      total +
      (settings.enabled && band.enabled
        ? bandExciterReturnGain(band.mix, index)
        : 0),
    0,
  );
  const returnScale = requestedReturn > 1 ? 1 / requestedReturn : 1;

  for (let band = 0; band < 3; band += 1) {
    const setup = settings.bands[band];
    if (setup) {
      const source = extractBand(state, band, setup, sampleRate);
      report.bands[band] = addBand(
        state,
        band,
        target,
        source,
        setup,
        returnScale,
        settings.enabled,
        sampleRate,
      );
    }
  }

  return report;
};
