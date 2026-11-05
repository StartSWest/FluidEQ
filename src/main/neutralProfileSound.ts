/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  AutoEqFormat,
  getDefaultFilters,
  IPresetV2,
} from '../common/constants';
import { defaultOutputSound } from './outputSoundPersistence';

/**
 * The sound a new profile starts with, as a profile, without touching the
 * live sound: every band of the default layout flat, no preamp, no layer —
 * no Tone, preset curve, correction, driver, Smart EQ or impulse — nothing
 * switched off, and the rack, the cuts and the designs at their defaults.
 *
 * It is `resetStateToDefaults` (`profileStore.ts`) done to a profile rather
 * than to the state; a layer that reset learns to clear, this has to leave
 * out too. A game's copy from a ready-made Gaming profile is built on it, so
 * each profile has its own sound to start from and to reset to, never the
 * music's (Ivan, 2026-11-03: "each game profile should have their own
 * default curves to restore to").
 */
const neutralProfileSound = (): IPresetV2 => ({
  ...defaultOutputSound(),
  filters: getDefaultFilters(),
  preAmp: 0,
  isFlat: true,
  isEqDoubleOn: false,
  eqMode: 'normal',
  curveEqMode: 'normal',
  eqFormat: AutoEqFormat.PARAMETRIC,
});

export default neutralProfileSound;
