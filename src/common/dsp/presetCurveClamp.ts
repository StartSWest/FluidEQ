/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_NUM_FILTERS } from '../constants';
import {
  FALLBACK_EQ_BAND,
  IEqSettings,
  clampDspSettings,
  clampEqBand,
} from './chain';

/**
 * How many bands a preset's curve may hold: the main EQ's own ceiling.
 *
 * A preset's curve plays in the main EQ, as its Preset layer
 * (`presetCurve.ts`), not in the rack, so the rack's budget
 * (`EQ_MAX_BAND_COUNT`, 64) is not its limit. A curve started from Your EQ
 * may hold as many bands as Your EQ does, and cutting it at the rack's
 * sixty-four would drop the top of a 128-band tuning without a word.
 */
export const PRESET_CURVE_MAX_BANDS = MAX_NUM_FILTERS;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * A preset's curve from anywhere — a saved preset, a shared file, the
 * window's live edit — with every field bounded exactly as the rack's EQ
 * bounds it (`clampDspSettings`), except the number of bands. An entry that
 * is not a band at all is left out rather than replaced with a silent one.
 */
export const clampPresetCurve = (curve: unknown): IEqSettings => {
  const value = isRecord(curve) ? curve : {};
  const bandsOf = (list: unknown) =>
    (Array.isArray(list) ? list : [])
      .filter(isRecord)
      .slice(0, PRESET_CURVE_MAX_BANDS)
      .map((band) => clampEqBand(band, FALLBACK_EQ_BAND));
  // Every field but the bands, bounded where the rack's EQ is.
  const rest = clampDspSettings({
    eq: { ...value, bands: [], sourceBands: [] },
  }).eq;
  return {
    ...rest,
    bands: bandsOf(value.bands),
    sourceBands: bandsOf(value.sourceBands),
  };
};
