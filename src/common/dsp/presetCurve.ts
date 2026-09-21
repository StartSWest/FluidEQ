/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../constants';
import { DSP_DEFAULTS, IEqBandSettings, IEqSettings } from './chain';

/*
 * A PRESET'S TONE IS A CURVE IN THE MAIN EQ, ON EITHER ENGINE. The rack's own
 * EQ only supports the stages beside it.
 *
 * Every chain used to carry its tone in the rack's EQ, and the rack's EQ runs
 * ahead of its compressor and limiter — so the stages after it took much of
 * it back. A multiband compressor pulls each of its bands towards its
 * threshold, which is a tone control turning the other way, and each chain's
 * level was set to land beside every other's. Under Equalizer APO the same
 * filters were written as a layer of their own with nothing after them, and
 * Pop against Metal was plain to hear; through the FluidEQ Engine it was
 * barely there. The engine applies its layers after the rack, so the curve
 * now goes there on both engines: the same filters, at the same place in the
 * sound, drawn on the EQ page like every other layer.
 *
 * What stays in the rack's EQ is what supports another stage or cannot be a
 * curve at all: dynamic bands (a de-esser, the late-night bass guard), bass
 * mono, harmonic colour, and the compensation a Room copy puts in front of
 * its Room. Everything else of the rack's EQ is left to the listener's own
 * corrections.
 */

/**
 * A band that passes everything, where a band of the tone stood.
 *
 * Kept rather than dropped so the rack's EQ keeps the preset's band layout:
 * the bands are there to be used, just flat. Made a bell at 0 dB rather than
 * left as it was, because a pass or notch band at 0 dB still filters.
 */
const passing = (band: IEqBandSettings): IEqBandSettings => ({
  ...band,
  type: FilterTypeEnum.PK,
  gainDb: 0,
  dynamic: false,
});

/**
 * The tone of a chain's EQ: every static band, and the subsonic filter. None
 * when the EQ shapes nothing.
 *
 * A dynamic band is not part of it. It acts only while its own passband is
 * over its threshold, which no curve can do, so it stays in the rack.
 */
export const presetCurve = (eq: IEqSettings): IEqSettings | undefined => {
  const bands = eq.enabled
    ? eq.bands.filter((band) => band.enabled && !band.dynamic)
    : [];
  if (bands.length === 0) {
    return undefined;
  }
  return {
    ...eq,
    bands,
    sourceBands: bands.map((band) => ({ ...band })),
  };
};

/**
 * What of a chain's EQ stays in the rack: its dynamic bands, bass mono and
 * harmonic colour, switched off when it has none of them.
 *
 * The subsonic filter goes with the curve, never here too: one high pass,
 * not two. Oversampling goes as well — it was there for the top of the tone,
 * and what is left is either flat or dynamic.
 */
export const presetSupport = (eq: IEqSettings): IEqSettings => {
  const bands = eq.bands.map((band) => (band.dynamic ? band : passing(band)));
  const isNeeded =
    eq.enabled &&
    (eq.bands.some((band) => band.enabled && band.dynamic) ||
      eq.monoBelowHz > 0 ||
      eq.fuzzAmount > 0);
  return {
    ...eq,
    enabled: isNeeded,
    presetId: '',
    subsonicHz: 0,
    oversample: DSP_DEFAULTS.eq.oversample,
    bands,
    sourceBands: bands.map((band) => ({ ...band })),
  };
};
