/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One chain, as the flat array of doubles the native host decodes.
 *
 * There is exactly one encoder for this, and it lives here rather than beside
 * any of its three callers. The renderer builds a snapshot to send; the parity
 * fixture generator builds the same snapshot to hold the native chain to the
 * TypeScript worklet; the end-to-end smoke test builds one to prove the wire
 * carries it. Three encoders would agree until a field was added to one of
 * them, and the failure mode of that is not a crash — it is every EQ band
 * shifted by one field and still decoding into something plausible.
 *
 * `feq_chain_settings_decode` in `chain_decode.cpp` reads it. Neither side can
 * ask the other what the layout is, so both assert the lead: a scalar added
 * above and forgotten in the C++ is caught by a length check rather than by a
 * user noticing their Q values have become thresholds.
 */
import { FilterTypeEnum } from '../constants';
import {
  EQ_ENGINES,
  EQ_MODELS,
  EQ_PHASE_MODES,
  EQ_STEREO_MODES,
  IDspSettings,
} from './chain';

/**
 * Scalars before the variable-length band array. Must equal
 * `FEQ_CHAIN_PARAM_LEAD` in `fluideq/chain.h`.
 */
export const CHAIN_PARAM_LEAD = 78;

/** Fields per EQ band. Must equal `FEQ_CHAIN_BAND_PARAMS`. */
export const CHAIN_BAND_PARAMS = 7;

/**
 * The order the wire uses for a band's type, which is the protocol's and not
 * the app enum's. Append-only: the wire carries an index into this list, so
 * reordering it re-points every band a running host is holding.
 */
export const CHAIN_FILTER_TYPES: readonly FilterTypeEnum[] = [
  FilterTypeEnum.PK,
  FilterTypeEnum.NO,
  FilterTypeEnum.LSC,
  FilterTypeEnum.HSC,
  FilterTypeEnum.LPQ,
  FilterTypeEnum.HPQ,
  FilterTypeEnum.BP,
];

export interface IChainWireOptions {
  /**
   * The A/B that proves the safety net is the net and not the sound.
   *
   * Carried in the snapshot rather than left to a build flag because the whole
   * value of it is switching while the same audio plays.
   */
  outputSafetyEnabled?: boolean;
}

export const encodeChainSettings = (
  settings: IDspSettings,
  options: IChainWireOptions = {},
): number[] => {
  const { exciter, eq, dimension, compressor, maximizer, master } = settings;
  const values: number[] = [
    settings.enabled ? 1 : 0,
    options.outputSafetyEnabled === false ? 0 : 1,
    exciter.enabled ? 1 : 0,
    exciter.isolate ? 1 : 0,
    EQ_STEREO_MODES.indexOf(exciter.stereo),
    exciter.align.enabled ? 1 : 0,
    exciter.align.amount,
    exciter.organic.enabled ? 1 : 0,
    exciter.organic.amount,
    exciter.organic.focusHz,
    exciter.organic.range,
  ];
  for (let band = 0; band < 3; band += 1) {
    const source = exciter.bands[band];
    values.push(
      source.enabled ? 1 : 0,
      source.freqHz,
      source.range,
      source.drive,
      source.mix,
      source.texture,
    );
  }
  values.push(
    eq.enabled ? 1 : 0,
    eq.isolate ? 1 : 0,
    EQ_MODELS.indexOf(eq.model),
    eq.modelAmount,
    EQ_ENGINES.indexOf(eq.engine),
    EQ_PHASE_MODES.indexOf(eq.phase),
    EQ_STEREO_MODES.indexOf(eq.stereo),
    eq.monoBelowHz,
    eq.oversample,
    eq.subsonicHz,
    eq.fuzzAmount,
    compressor.enabled ? 1 : 0,
    compressor.crossoverHz[0],
    compressor.crossoverHz[1],
  );
  for (let band = 0; band < 3; band += 1) {
    const source = compressor.bands[band];
    values.push(
      source.thresholdDb,
      source.ratio,
      source.attackMs,
      source.releaseMs,
      source.makeupDb,
    );
  }
  values.push(
    dimension.enabled ? 1 : 0,
    dimension.lowWidth,
    dimension.midWidth,
    dimension.highWidth,
    dimension.lowHz,
    dimension.highHz,
    dimension.decorrelation,
    maximizer.enabled ? 1 : 0,
    maximizer.driveDb,
    maximizer.ceilingDb,
    maximizer.lookAheadMs,
    maximizer.releaseMs,
    master.enabled ? 1 : 0,
    master.outputTrimDb,
    master.loudnessMaximize ? 1 : 0,
    master.loudnessTargetLufs,
    master.ceilingDb,
    master.releaseMs,
    master.matchedBypass ? 1 : 0,
    eq.bands.length,
  );
  if (values.length !== CHAIN_PARAM_LEAD) {
    // The lead is a constant on both sides of the wire. A field added above and
    // not accounted for here would push every band along by one and still
    // decode into something plausible, which is the worst kind of wrong.
    throw new Error(
      `chain wire: lead is ${values.length}, expected ${CHAIN_PARAM_LEAD}`,
    );
  }
  eq.bands.forEach((band) => {
    values.push(
      band.enabled ? 1 : 0,
      CHAIN_FILTER_TYPES.indexOf(band.type as FilterTypeEnum),
      band.frequency,
      band.gainDb,
      band.quality,
      band.dynamic ? 1 : 0,
      band.thresholdDb,
    );
  });
  return values;
};

/** What a well-formed snapshot for this many bands must be. */
export const chainWireLength = (bandCount: number): number =>
  CHAIN_PARAM_LEAD + bandCount * CHAIN_BAND_PARAMS;

/**
 * Whether a value could be one, checked at the IPC boundary.
 *
 * The renderer is the only side that builds these and main is the only side
 * that forwards them, but main validates anyway: the boundary is where a
 * malformed message stops, and "the only caller is ours" is a property of
 * today's code rather than of the channel.
 */
export const isChainWirePayload = (value: unknown): value is number[] => {
  if (!Array.isArray(value) || value.length < CHAIN_PARAM_LEAD) {
    return false;
  }
  if (
    !value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  ) {
    return false;
  }
  const bands = value[CHAIN_PARAM_LEAD - 1];
  return Number.isInteger(bands) && value.length === chainWireLength(bands);
};
