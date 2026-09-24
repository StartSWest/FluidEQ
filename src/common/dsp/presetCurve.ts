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
 * ahead of its limiter — so the stages after it took much of it back (the
 * multiband compressor the rack carried then pulled each of its bands towards
 * its threshold, a tone control turning the other way), and each chain's
 * level was set to land beside every other's. Under Equalizer APO the same
 * filters were written as a layer of their own with nothing after them, and
 * Pop against Metal was plain to hear; through the FluidEQ Engine it was
 * barely there. The engine applies its layers after the rack, so the curve
 * now goes there on both engines: the same filters, at the same place in the
 * sound, drawn on the EQ page like every other layer.
 *
 * What stays in the rack's EQ is what supports another stage or cannot be a
 * curve at all: dynamic bands (a de-esser, the late-night bass guard), bass
 * mono, harmonic colour, the subsonic filter, and the compensation a Room
 * copy puts in front of its Room. Everything else of the rack's EQ is left to
 * the listener's own corrections.
 *
 * Playing after the rack means playing after its Maximizer, and an EQ after a
 * limiter puts back peaks the limiter took off. The Maximizer is told the
 * curve it is followed by (`presetTone.ts`) and limits as if the curve were
 * already applied, so the preset reaches the ceiling once the layer has
 * played rather than before.
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
 * The tone of a chain's EQ: every static band. None when the EQ shapes
 * nothing.
 *
 * A dynamic band is not part of it. It acts only while its own passband is
 * over its threshold, which no curve can do, so it stays in the rack. Nor is
 * the subsonic filter: see `presetSupport`.
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
    subsonicHz: 0,
    bands,
    sourceBands: bands.map((band) => ({ ...band })),
  };
};

/**
 * What of a chain's EQ stays in the rack: its dynamic bands, bass mono,
 * harmonic colour and the subsonic filter, switched off when it has none of
 * them.
 *
 * The subsonic filter stays here, in front of the Maximizer, because a high
 * pass played after it puts back the peaks it took off: it turns the phase of
 * everything under a hundred hertz, and a limited master's peaks are its bass
 * and its top arriving in step. It went with the curve until 2026-09-23, and
 * on loud masters the 20-25 Hz high pass alone lifted the peaks leaving the
 * rack at -1 dBTP to +1.5 to +2.4 — which Auto normalize then answered by
 * turning the whole chain down. One high pass, not two, as before; only its
 * place moved. Oversampling goes — it was there for the top of the tone, and
 * what is left is flat, dynamic or a high pass at the bottom.
 */
export const presetSupport = (eq: IEqSettings): IEqSettings => {
  const bands = eq.bands.map((band) => (band.dynamic ? band : passing(band)));
  const isNeeded =
    eq.enabled &&
    (eq.bands.some((band) => band.enabled && band.dynamic) ||
      eq.monoBelowHz > 0 ||
      eq.fuzzAmount > 0 ||
      eq.subsonicHz > 0);
  return {
    ...eq,
    enabled: isNeeded,
    presetId: '',
    oversample: DSP_DEFAULTS.eq.oversample,
    bands,
    sourceBands: bands.map((band) => ({ ...band })),
  };
};
