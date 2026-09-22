/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TApoFeature } from './constants';
import { engineAtLeast } from './engineHealth';

/**
 * The directive that asks the FluidEQ Engine to build a layer's bands
 * analog-matched instead of from the cookbook.
 *
 * The cookbook (the RBJ bilinear formulas Equalizer APO also uses) squeezes
 * everything between a band and Nyquist into less than an octave, so at 44.1
 * and 48 kHz treble bands play narrower and weaker than they are drawn: the
 * five treble bands of Ivan's own EQ measured 2.98 dB under their drawn shape
 * at 48 kHz, and 0.31 dB matched (`feq_biquad_coefficients_matched`). Written
 * as a comment line, so Equalizer APO and an engine older than 1.13 read past
 * it and keep the cookbook.
 */
export const MATCHED_DESIGN_DIRECTIVE = '# FluidEQFilterDesign: MATCHED';

/**
 * Whether a layer's bands mean the analog shape the graph draws.
 *
 * Everything FluidEQ designs itself does — the user's own bands, the voicings,
 * the driver-type curves, Smart EQ — because each was shaped on a graph of
 * the analog response. A headphone correction does not: AutoEQ fits its
 * filters with the cookbook itself at 44.1 kHz, and the graph tools at
 * 48 kHz, so the cookbook is what plays one back as fitted. Measured on a
 * BlackShark V2 Pro correction at 48 kHz: 0.14 dB from its fit with the
 * cookbook, 0.89 dB matched.
 */
export const usesMatchedDesign = (feature: TApoFeature): boolean =>
  feature !== 'headphone';

/**
 * The first FluidEQ Engine that reads `MATCHED_DESIGN_DIRECTIVE` — the binary
 * version in `native/system-apo/src/engine.rc`, as the setup helper reports
 * it for the installed DLL (`dllVersion`).
 *
 * The graph draws the matched shape only from this engine on: an older one
 * plays the cookbook whatever the file says, and a graph drawn ahead of it
 * would show treble bands up to 3 dB fuller than they are heard.
 */
export const ENGINE_MATCHED_DESIGN_SINCE: readonly [number, number] = [1, 13];

export const enginePlaysMatched = (dllVersion: string | undefined): boolean =>
  engineAtLeast(dllVersion, ENGINE_MATCHED_DESIGN_SINCE);
