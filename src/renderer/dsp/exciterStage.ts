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
  createExciterTransientState,
  exciterTransientSample,
  resetExciterTransientState,
} from './analogDiode';
import {
  IHarmonicState,
  createHarmonicState,
  harmonicSample,
  resetHarmonicState,
} from './harmonics';
import {
  IOversamplerState,
  createOversampler,
  downsample,
  oversampleFactorForSampleRate,
  upsample,
} from './oversample';
import {
  IExciterGuardState,
  createExciterGuard,
  exciterReturnGain,
  guardExciterReturn,
} from './exciterGuard';

/**
 * Three parallel Aural Exciter sidechains.
 *
 * Each path is a phase-shifting band filter followed by a harmonic generator
 * whose depth does not follow the input level — see `harmonics.ts` for what
 * that replaced and why. As in US 4,150,253, the return carries both the
 * filtered fundamentals and their low-order harmonics, but the fundamentals are
 * ATTENUATED rather than passed at unity: a return that is mostly a copy of its
 * own band is an equaliser, and it measured as a 1.3 dB midrange veil. That
 * return is mixed beneath untouched dry, and Isolate plays the same return
 * alone.
 */
const MAX_OVERSAMPLE = 4;
const FILTER_Q = Math.SQRT1_2;
const BAND_EDGE_MIN_HZ = 21;
const BAND_EDGE_MAX_HZ = 19_900;
const PARAMETER_SMOOTHING_MS = 18;
const DC_POLE = 0.9974;
const LOW_TRANSIENT_HARMONIC_LIFT = 0.35;
const MID_TRANSIENT_HARMONIC_LIFT = 0.3;
const HIGH_TRANSIENT_HARMONIC_LIFT = 0.22;

/**
 * A quiet, phase-shifted copy of the band, under the harmonics it made.
 *
 * US 4,150,253's attenuated sidechain carries the filtered fundamentals as well
 * as their harmonics, and that continuous component is what stops the harmonics
 * being heard as detached fizz. ATTENUATED is the word that was missing here:
 * Low and Mid used to return the whole filtered band at unity, so what the
 * Amount dial mostly did was add a copy of 20 Hz - 3 kHz back on top of itself.
 * Measured at the shipping defaults that was +1.28 dB across the midrange and
 * +2.81 dB at full Amount — a veil, from a control that is not supposed to be
 * an equaliser. High already used 0.18 and was the band nobody complained
 * about; all three use it now.
 */
const FOUNDATION_LEVEL = 0.18;

/**
 * How much harmonic content each band makes, relative to its own level.
 *
 * These are ratios rather than gains, which is the whole point of the change:
 * `depth` survives to the output as the harmonic-to-fundamental amplitude, so
 * each figure below is a decibel value a test can assert and a listener can
 * expect to hear at any playback level. Low carries the most because bass
 * harmonics are integrated by the ear rather than heard as separate tones, and
 * Mid the least because the midrange is where harmonic content stops being
 * warmth and becomes harshness.
 *
 * These were roughly twice this and it was too much. The measurement that
 * justified the larger figures was taken at -6 dBFS, where the shaper this
 * replaced looked tame — but that one followed the input level, so on ordinary
 * material near -20 dBFS it produced far less, while this one produces the same
 * ratio everywhere. Matching at the peak meant about ten decibels more harmonic
 * content than before on everything that is not a peak.
 */
const BAND_DEPTH = [0.44, 0.32, 0.47] as const;
/** Drive's floor: the gentlest setting still has a character, just a quiet one. */
const MIN_DEPTH = 0.18;
const DRIVE_SPAN = 2.5;

/**
 * What Texture actually moves: the interval, not the amount.
 *
 * Even orders sit an octave above the root and read as body — and on a speaker
 * that cannot reach the fundamental, as the fundamental itself. Odd orders sit
 * a twelfth above and read as edge and definition. Every band sweeps from
 * mostly-even to more-odd, but none of them reaches either extreme: pure even
 * is an octave doubler that loses the root, and pure odd is a fuzz box.
 */
const EVEN_WEIGHT_WARM = [0.92, 0.86, 0.85] as const;
const EVEN_WEIGHT_PRESENT = [0.58, 0.34, 0.26] as const;

/**
 * How far above its own band a band's harmonics may reach.
 *
 * The second order of the top of the Mid band lands at 6 kHz and the third at
 * 9 kHz, which is not body — it is the exact region a mix is usually fighting.
 * One octave of reach keeps every band's octave intact everywhere and rolls the
 * twelfth off the top, so each band stays the thing it is named after.
 */
const RESIDUE_REACH_OCTAVES = 1;

/** How much return the three bands may ask for together. See `addBand`. */
const RETURN_CEILING = 2;

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
  /** Where this band's own harmonics are allowed to reach. */
  residue: IBiquadCoefficients;
}

export interface IExciterChannelState {
  /** One two-pole highpass and lowpass per independently movable band. */
  bandFilters: IBiquadState[][];
  bandCoefficients: IBandCoefficientCache[];
  bands: Float32Array[];
  wetReturn: Float32Array;
  oversamplers: IOversamplerState[];
  highGuard: IExciterGuardState;
  residueFilters: IBiquadState[];
  wide: Float32Array;
  wideDry: Float32Array;
  drive: number[];
  texture: number[];
  mix: number[];
  transients: IExciterTransientState[];
  harmonics: IHarmonicState[];
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
    residue: IDENTITY_COEFFICIENTS,
  })),
  bands: [0, 1, 2].map(() => new Float32Array(blockSize)),
  wetReturn: new Float32Array(blockSize),
  oversamplers: [0, 1, 2].map(() => createOversampler(blockSize)),
  highGuard: createExciterGuard(),
  residueFilters: [0, 1, 2].map(() => createBiquadState()),
  wide: new Float32Array(blockSize * MAX_OVERSAMPLE),
  wideDry: new Float32Array(blockSize * MAX_OVERSAMPLE),
  drive: [0, 0, 0],
  texture: [0, 0, 0],
  mix: [0, 0, 0],
  transients: [0, 1, 2].map(() => createExciterTransientState()),
  harmonics: [0, 1, 2].map(() => createHarmonicState()),
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
/** Drive sets the harmonic ratio, which no longer depends on the input level. */
const bandDepth = (band: number, drive: number): number => {
  const normalised = Math.max(0, Math.min(1, (drive - 1) / DRIVE_SPAN));
  return BAND_DEPTH[band] * (MIN_DEPTH + normalised * (1 - MIN_DEPTH));
};

const bandEvenWeight = (band: number, texture: number): number => {
  const normalised = Math.max(
    0,
    Math.min(1, texture / ANALOG_DIODE_MAX_CHARACTER),
  );
  return (
    EVEN_WEIGHT_WARM[band] +
    (EVEN_WEIGHT_PRESENT[band] - EVEN_WEIGHT_WARM[band]) * normalised
  );
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
    /**
     * Where the harmonics this band makes are allowed to go.
     *
     * High is the band whose generated orders are the POINT of it, and whose
     * carrier is not: cutting at the band centre lets the air through while the
     * source frequencies fall away, so it is an upper-harmonic return rather
     * than a louder copy of its own source. Low and Mid are the opposite — they
     * are named after where they belong, so their harmonics are held to an
     * octave above their own top edge.
     */
    const reach = 2 ** RESIDUE_REACH_OCTAVES;
    if (band === 2) {
      cached.residue = biquadCoefficients(
        {
          type: FilterTypeEnum.HPQ,
          frequency: setup.freqHz,
          gainDb: 0,
          quality: FILTER_Q,
        },
        sampleRate,
      );
    } else {
      cached.residue =
        highHz * reach < BAND_EDGE_MAX_HZ
          ? biquadCoefficients(
              {
                type: FilterTypeEnum.LPQ,
                frequency: highHz * reach,
                gainDb: 0,
                quality: FILTER_Q,
              },
              sampleRate,
            )
          : IDENTITY_COEFFICIENTS;
    }
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
    // Harmonics only. The foundation is linear, so it is added below at the
    // base rate rather than being carried through the resampler twice.
    state.wide[i] = harmonicSample(
      state.harmonics[band],
      filteredSample,
      bandDepth(band, state.drive[band]) * transientHarmonicGain,
      bandEvenWeight(band, state.texture[band]),
      wideRate,
    );
  }
  downsample(state.oversamplers[band], state.wide, state.wetReturn, oversample);
  blockDc(state.dcState[band], state.wetReturn);
  processBiquad(
    state.residueFilters[band],
    state.wetReturn,
    state.bandCoefficients[band].residue,
  );

  // Restored from the already-filtered source rather than through the FIR round
  // trip: sending it that way made this additive return comb-filter the mix.
  // One buffer for the whole return, so Isolate cannot present a different
  // signal from the one added beneath the dry programme.
  for (let sample = 0; sample < state.wetReturn.length; sample += 1) {
    state.wetReturn[sample] += source[sample] * FOUNDATION_LEVEL;
  }

  if (band === 2) {
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
  const enabledMix = exciterReturnGain(setup.mix) * returnScale;
  const targetMix = processorEnabled && setup.enabled ? enabledMix : 0;
  if (targetMix <= 0 && state.mix[band] <= 0.0001) {
    state.mix[band] = 0;
    resetExciterTransientState(state.transients[band]);
    // The level follower too, or the band comes back holding the level of
    // whatever was playing when it was switched off.
    resetHarmonicState(state.harmonics[band]);
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

  /**
   * The three independently movable bands may overlap. Each processed path
   * needs enough return to be audible, but their foundations must never add up
   * to several full copies of the filtered programme, so the set is normalised
   * when the requested returns exceed the ceiling together.
   *
   * The ceiling is two, not one. One was right when a return WAS a full copy of
   * its band: three of those at unity is three copies, and the rule existed to
   * stop that. A return is 18% of its band now, so three at unity is half a
   * copy — and holding the sum to one meant three bands at full Amount each got
   * a third of what one band at full Amount gets, which reads as the dial doing
   * less the more of it you use.
   */
  const requestedReturn = settings.bands.reduce(
    (total, band) =>
      total +
      (settings.enabled && band.enabled ? exciterReturnGain(band.mix) : 0),
    0,
  );
  const returnScale =
    requestedReturn > RETURN_CEILING ? RETURN_CEILING / requestedReturn : 1;

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
