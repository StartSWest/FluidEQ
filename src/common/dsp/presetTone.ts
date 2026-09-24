/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A preset's curve, told to the rack's Maximizer.
 *
 * The curve plays after the rack, as the Preset layer of the main EQ
 * (`presetCurve.ts`), and an EQ after a limiter puts back the peaks the
 * limiter took off. Measured over the genre chains on real records, the curve
 * took the output 2 to 5 dB past the Maximizer's ceiling, and Auto normalize
 * then took the whole level down by as much: a preset driven louder came out
 * quieter than the same preset with its Maximizer off, and pumped where the
 * guard moved. Told the curve, the Maximizer limits the programme as it will
 * be once the layer has played (`FeqChainToneSettings`), so what leaves the
 * layer sits on the ceiling instead of over it.
 *
 * The bands are the layer's as the writer builds them (`apoRender.ts`): its
 * group's strength and band shape (`layerGroupOf`), twice over in Double, with
 * the numbers the file carries, and analog-matched only where the engine
 * playing builds that group so. Only bells and shelves travel, being the bands
 * with an exact inverse; a preset's curve has had nothing else since its
 * subsonic filter moved into the rack.
 */

import { clampFrequency, clampQuality, IState } from '../constants';
import { layerGainLimit } from '../correctionRange';
import { engineAtLeast } from '../engineHealth';
import {
  getBandQ,
  getCurveEqMode,
  getEqMode,
  getStudioEqFilters,
} from '../eqMode';
import { shapeEqFilters } from '../eqShape';
import { layerGroupOf, TTrebleScope } from '../filterDesign';
import { getVoicingFilters } from '../voicing';
import type { IPresetTone, IPresetToneBand } from './chainWire';
import { dspVoicingPresetId } from './presetVoicing';

/**
 * The first FluidEQ Engine that reads a curve after the rack's line
 * (`native/system-apo/src/engine.rc`). An older one refuses a line longer
 * than it knows and bypasses the whole rack, so main takes the curve off for
 * it (`SET_SYSTEM_DSP_CHAIN`); the Library player's host is built with the
 * app and always reads it.
 */
export const ENGINE_PRESET_TONE_SINCE: readonly [number, number] = [1, 16];

export const engineTakesPresetTone = (
  dllVersion: string | undefined,
): boolean => engineAtLeast(dllVersion, ENGINE_PRESET_TONE_SINCE);

/** What the writer reads to build the Preset layer. */
export type TPresetToneState = Pick<
  IState,
  | 'isEnabled'
  | 'voicing'
  | 'bypassed'
  | 'eqMode'
  | 'curveEqMode'
  | 'isEqDoubleOn'
  | 'eqBandQ'
  | 'curveBandQ'
>;

/** `apoRender.ts`'s `configNumber`: the precision a layer file carries. */
const asWritten = (value: number) => Math.round(value * 100) / 100;

/**
 * The curve the Preset layer plays, or nothing while no preset's curve does:
 * FluidEQ switched off, another voicing chosen, or the layer bypassed on its
 * chip.
 *
 * `matchedDesign` is which groups the engine playing builds analog-matched
 * (`useMatchedDesign`): false for both under Equalizer APO, which has only
 * the cookbook.
 */
export const presetToneOf = (
  state: TPresetToneState,
  matchedDesign: Readonly<Record<TTrebleScope, boolean>>,
): IPresetTone | undefined => {
  if (
    !state.isEnabled ||
    dspVoicingPresetId(state.voicing) === undefined ||
    (state.bypassed ?? []).includes('voicing')
  ) {
    return undefined;
  }
  const group = layerGroupOf('voicing');
  const mode = group === 'eq' ? getEqMode(state) : getCurveEqMode(state);
  const shape = getBandQ(state, group);
  const limit = layerGainLimit('voicing');
  const filters = getVoicingFilters(state.voicing).filter(
    ({ frequency, gain, quality }) =>
      Number.isFinite(frequency) &&
      Number.isFinite(gain) &&
      Number.isFinite(quality),
  );
  const shaped =
    mode === 'studio'
      ? getStudioEqFilters(filters, shape, limit)
      : shapeEqFilters(filters, shape);
  const gainLimit = mode === 'studio' ? limit * 1.5 : limit;
  const bands: IPresetToneBand[] = shaped.map((filter) => ({
    type: filter.type,
    frequency: clampFrequency(filter.frequency),
    gain: asWritten(Math.max(-gainLimit, Math.min(gainLimit, filter.gain))),
    quality: asWritten(clampQuality(filter.quality)),
  }));
  if (bands.length === 0) {
    return undefined;
  }
  return {
    bands: mode === 'double' ? [...bands, ...bands] : bands,
    matched: matchedDesign[group],
  };
};

/** Whether two curves would put the same line on the wire. */
export const samePresetTone = (
  first: IPresetTone | undefined,
  second: IPresetTone | undefined,
): boolean =>
  first === second ||
  (first !== undefined &&
    second !== undefined &&
    first.matched === second.matched &&
    first.bands.length === second.bands.length &&
    first.bands.every((band, index) => {
      const other = second.bands[index];
      return (
        band.type === other.type &&
        band.frequency === other.frequency &&
        band.gain === other.gain &&
        band.quality === other.quality
      );
    }));
