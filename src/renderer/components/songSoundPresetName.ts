/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from 'common/i18n';
import { DSP_PRESETS } from 'common/dsp/presets';
import { dspPresetName } from '../dsp/dspPresetCatalog';
import { findUserDspPreset } from '../dsp/userDspPresets';

/**
 * A song's preset as the picker names it, for the song memory's cards: a
 * saved chain by its own name, a factory one by its label, and nothing for
 * None or a rack with no name, which the cards then say without a name.
 */
const songSoundPresetName = (id: string, t: Translate): string | undefined => {
  const saved = findUserDspPreset(id);
  if (saved) {
    return saved.name;
  }
  const factory = DSP_PRESETS.find((preset) => preset.id === id);
  return factory ? dspPresetName(factory, t) : undefined;
};

export default songSoundPresetName;
