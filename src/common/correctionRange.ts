/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_GAIN, PREAMP_MIN_GAIN, TApoFeature } from './constants';

/**
 * How far a headphone correction may reach, which is further than a band.
 *
 * ±20 dB is the editor's range: how far a slider goes, and a judgement about
 * what one band should be asked to do. A correction is not the listener's
 * judgement. It is a published measurement and fit, and it has to play as
 * published or it is a different correction (Ivan, 2026-09-23: "we just need
 * to be able to do more than that if those eq curves do it, at least for the
 * correction curves"). Held to the editor's range, and a library curve to
 * ±12 dB before that (±8 dB below 25 Hz and above 14 kHz), 822 of the bundled
 * OPRA library's 12,594 curves played something other than what they publish.
 * Eight go past ±20 dB as a whole chain, the furthest 30.7 dB (a bass-boost
 * fit), and the largest single band is -21 dB. Neither engine has a limit of
 * its own: both build whatever gain a line carries.
 *
 * What is left is a limit of arithmetic, not taste: the preamp takes back at
 * most `-PREAMP_MIN_GAIN`, so a correction past that could not play without
 * clipping even with Auto normalize on, and a number that size is a broken
 * file rather than a measurement. The graph keeps its fixed ±20 dB
 * (`gainScale`): the part of a correction past it runs off the plot, as a
 * total that adds up past it does, and plays all the same.
 */
export const MAX_CORRECTION_GAIN = -PREAMP_MIN_GAIN;

/** `clampGain`'s rule at another size: bounded, and never anything but finite. */
export const clampGainWithin = (gain: number, limit: number) =>
  Number.isFinite(gain) ? Math.min(limit, Math.max(-limit, gain)) : 0;

export const clampCorrectionGain = (gain: number) =>
  clampGainWithin(gain, MAX_CORRECTION_GAIN);

/**
 * The range a layer's bands are written and drawn within: a correction's for
 * the headphone layer, the editor's for the rest. The user's bands are set in
 * the editor's range, and the voicing, driver and Smart EQ layers are built by
 * FluidEQ inside it.
 */
export const layerGainLimit = (feature: TApoFeature | undefined): number =>
  feature === 'headphone' ? MAX_CORRECTION_GAIN : MAX_GAIN;
