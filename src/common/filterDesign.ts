/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TApoFeature } from './constants';
import { engineAtLeast } from './engineHealth';

/**
 * The directive that lets the FluidEQ Engine build a layer's bands
 * analog-matched instead of from the cookbook, as that layer's group of the
 * EQ mode menu's Treble choice says (`TREBLE_DESIGN_FILENAMES`).
 *
 * The cookbook (the RBJ bilinear formulas Equalizer APO also uses) squeezes
 * everything between a band and Nyquist into less than an octave, so at 44.1
 * and 48 kHz treble bands play narrower and weaker than they are drawn: the
 * five treble bands of Ivan's own EQ measured 2.98 dB under their drawn shape
 * at 48 kHz, and 0.31 dB matched (`feq_biquad_coefficients_matched`). Every
 * layer file carries it, the headphone correction's included, so the choice
 * reaches every layer the menu names. Written as a comment line, so Equalizer
 * APO and an engine older than 1.13 read past it and keep the cookbook.
 */
export const MATCHED_DESIGN_DIRECTIVE = '# FluidEQFilterDesign: MATCHED';

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

/**
 * The Treble choice in the EQ mode menu, per group: Precise builds the
 * group's bands matched, as they are drawn; Classic keeps them on the
 * cookbook, the way Equalizer APO plays them, narrower and weaker near the
 * top.
 *
 * A headphone correction is a curve like the others and follows the Curves
 * row (Ivan, 2026-09-22: "make sure precise and classic work for curves and
 * I see the changes visually in the curve too"). Classic is also how AutoEQ
 * fits one, with the cookbook at 44.1 kHz, so it plays a correction closest
 * to its fit: measured on a BlackShark V2 Pro correction at 48 kHz, 0.14 dB
 * from the fit that way and 0.89 dB matched. Precise plays the shape its
 * bands draw.
 */
export const TREBLE_DESIGNS = ['precise', 'classic'] as const;
export type TTrebleDesign = (typeof TREBLE_DESIGNS)[number];
export const DEFAULT_TREBLE_DESIGN: TTrebleDesign = 'precise';

/**
 * The two groups the choice is made for, as the engine tells them apart: the
 * layer written with `# FluidEQEqLayer: ON` is Your EQ, and every other layer
 * of FluidEQ's own is a curve (`deviceProfiles.ts`).
 */
export const TREBLE_SCOPES = ['eq', 'curves'] as const;
export type TTrebleScope = (typeof TREBLE_SCOPES)[number];

export interface ITrebleDesigns {
  eq: TTrebleDesign;
  curves: TTrebleDesign;
}

export const DEFAULT_TREBLE_DESIGNS: Readonly<ITrebleDesigns> = {
  eq: DEFAULT_TREBLE_DESIGN,
  curves: DEFAULT_TREBLE_DESIGN,
};

export const isTrebleDesign = (value: unknown): value is TTrebleDesign =>
  value === 'precise' || value === 'classic';

export const isTrebleScope = (value: unknown): value is TTrebleScope =>
  value === 'eq' || value === 'curves';

/**
 * Where the choice lives: beside the phase files in the FluidEQ Engine's
 * folder, read by the engine itself — only the exact word `classic` counts
 * (`config.cpp`) — so a change reaches the sound without a layer file being
 * rewritten.
 */
export const TREBLE_DESIGN_FILENAMES: Readonly<Record<TTrebleScope, string>> = {
  eq: 'fluideq-eq-treble.txt',
  curves: 'fluideq-curve-treble.txt',
};

/** The first FluidEQ Engine that reads the Treble files (`engine.rc`). */
export const ENGINE_TREBLE_CHOICE_SINCE: readonly [number, number] = [1, 14];

export const engineTakesTrebleChoice = (
  dllVersion: string | undefined,
): boolean => engineAtLeast(dllVersion, ENGINE_TREBLE_CHOICE_SINCE);

/**
 * Which group's choice decides how a layer's bands are built: Your EQ's for
 * the EQ layer, the Curves row's for every other one, the headphone
 * correction's included.
 */
export const trebleScopeOf = (feature: TApoFeature): TTrebleScope =>
  feature === 'eq' ? 'eq' : 'curves';

/**
 * Whether a group's bands play analog-matched on a FluidEQ Engine of this
 * version: from `ENGINE_MATCHED_DESIGN_SINCE` on, unless the group is set to
 * Classic on an engine that reads the choice. An engine older than the
 * choice plays what it always did whatever the file says, and the graph
 * draws that.
 */
export const groupPlaysMatched = (
  dllVersion: string | undefined,
  choice: TTrebleDesign,
): boolean =>
  enginePlaysMatched(dllVersion) &&
  !(choice === 'classic' && engineTakesTrebleChoice(dllVersion));
