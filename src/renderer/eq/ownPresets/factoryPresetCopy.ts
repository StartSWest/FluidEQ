/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_PRESETS } from '../../../common/dsp/presets';
import type { Translate } from '../../../common/i18n';
import {
  dspPresetName,
  resolveDspPreset,
  resolveDspPresetCurve,
} from '../../dsp/dspPresetCatalog';
import { readDspSettings } from '../../dsp/store';
import {
  addUserDspPreset,
  type IUserDspPreset,
} from '../../dsp/userDspPresets';

/**
 * A preset of the listener's own made from a factory one: its rack as a pick
 * of it puts the rack on, and its curve as the Preset layer plays it — the
 * two halves New preset starts from when "{name}'s rack" and "{name},
 * playing" are chosen (`newPresetStarts`) — under "{name} (copy)", numbered
 * when a preset of theirs already has that name, and at the top of Yours.
 *
 * The factory preset is read and never written: nothing here reaches
 * `DSP_PRESETS`, and what is edited afterwards is the copy (Ivan, 2026-11-26:
 * "create a copy of default presets and edit them, not the original but the
 * copy"). Undefined for an id that is no factory preset.
 */
const addFactoryPresetCopy = async (
  presetId: string,
  t: Translate,
): Promise<IUserDspPreset | undefined> => {
  const factory = DSP_PRESETS.find((preset) => preset.id === presetId);
  const rack = factory && resolveDspPreset(factory.id, readDspSettings());
  if (!factory || !rack) {
    return undefined;
  }
  return addUserDspPreset(
    t('eq.own.copyName', { name: dspPresetName(factory, t) }),
    rack,
    resolveDspPresetCurve(factory.id),
  );
};

export default addFactoryPresetCopy;
