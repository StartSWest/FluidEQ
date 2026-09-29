/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS } from './chain';
import type { IEqPresetSetup } from './eqPresets';

// The setups the factory EQ presets are built on: the default preset's
// id, the setup a preset gets for anything it leaves out, and the protected
// floor most of them start from.

/** First in the list, and the way back: everything to its default. */
export const EQ_DEFAULT_PRESET_ID = 'default';

/**
 * What every preset is measured against, and what the reset button applies.
 *
 * Read off the rack's own defaults rather than restated, so "default" cannot
 * come to mean one thing in the preset list and another in the settings.
 */
export const DEFAULT_SETUP: Required<IEqPresetSetup> = {
  model: DSP_DEFAULTS.eq.model,
  modelAmount: DSP_DEFAULTS.eq.modelAmount,
  engine: DSP_DEFAULTS.eq.engine,
  phase: DSP_DEFAULTS.eq.phase,
  oversample: DSP_DEFAULTS.eq.oversample,
  stereo: DSP_DEFAULTS.eq.stereo,
  subsonicHz: DSP_DEFAULTS.eq.subsonicHz,
  fuzzAmount: DSP_DEFAULTS.eq.fuzzAmount,
  monoBelowHz: DSP_DEFAULTS.eq.monoBelowHz,
};

/**
 * A protective pair most music benefits from and nothing musical misses.
 *
 * 20 Hz is below hearing on any normal speaker, and the excursion spent down
 * there is excursion unavailable to bass that can be heard. 40 Hz of mono keeps
 * the very bottom from depending on the two channels agreeing, which is what
 * makes a mix survive a phone speaker.
 */
export const PROTECTED: IEqPresetSetup = { subsonicHz: 20, monoBelowHz: 40 };
