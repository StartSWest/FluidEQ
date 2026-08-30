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
  DENOISE_HUM_MODES,
  DENOISE_PROFILE_SOURCES,
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
export const CHAIN_PARAM_LEAD = 110;

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
  const {
    exciter,
    eq,
    bassForge,
    bassPunch,
    dimension,
    compressor,
    maximizer,
    master,
    denoise,
  } = settings;
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
    denoise.enabled ? 1 : 0,
    denoise.isolate ? 1 : 0,
    DENOISE_PROFILE_SOURCES.indexOf(denoise.profileSource),
    denoise.hiss.enabled ? 1 : 0,
    denoise.hiss.amount,
    denoise.hiss.floorDb,
    denoise.hiss.sensitivityDb,
    denoise.hiss.smoothing,
    denoise.hum.enabled ? 1 : 0,
    DENOISE_HUM_MODES.indexOf(denoise.hum.mode),
    denoise.hum.harmonics,
    denoise.hum.depthDb,
    denoise.hum.quality,
    denoise.click.enabled ? 1 : 0,
    denoise.click.sensitivity,
    denoise.click.maxRepairSamples,
    denoise.voice.enabled ? 1 : 0,
    denoise.voice.amount,
    // Both bass stages go here rather than at the end, and the position is the
    // whole point: `isChainWirePayload` sizes the band array from the LAST lead
    // slot, so anything appended after `eq.bands.length` moves the band count
    // without moving the length check, and every band decodes one slot along
    // into something that still looks like a band.
    //
    // `presetId` is renderer and storage only. It names a profile in a
    // catalogue the native side does not have, so it never goes on the wire.
    bassForge.enabled ? 1 : 0,
    bassForge.splitHz,
    bassForge.driveDb,
    bassForge.subAmount,
    bassForge.presenceAmount,
    bassForge.texture,
    bassForge.mix,
    bassPunch.enabled ? 1 : 0,
    bassPunch.splitHz,
    bassPunch.attack,
    bassPunch.sustain,
    bassPunch.bloomAmount,
    bassPunch.bloomDecayMs,
    bassPunch.duck,
    // Last in the lead, and it has to stay last: `isChainWirePayload` and
    // `feq_chain_settings_decode` both read the band count from
    // `CHAIN_PARAM_LEAD - 1` to know how long the tail is. A scalar appended
    // after this one moves the count out from under both of them.
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
