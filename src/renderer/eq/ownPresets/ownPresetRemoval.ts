/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IVoicingSettings } from '../../../common/constants';
import type { IDspSettings } from '../../../common/dsp/chain';
import { dspVoicingPresetId } from '../../../common/dsp/presetVoicing';
import { unstarDspPreset } from '../../dsp/favouriteDspPresets';
import { removeUserDspPreset } from '../../dsp/userDspPresets';

/** Whether a preset is heard now: its rack chosen, or its curve the layer. */
export const isOwnPresetPlaying = (
  id: string,
  settings: IDspSettings,
  voicing: IVoicingSettings | undefined,
): boolean => settings.presetId === id || dspVoicingPresetId(voicing) === id;

/**
 * One of the listener's presets deleted, from the EQ page's Preset tab or
 * the DSP page. One that is playing is taken off first — `takeOff` is the
 * None pick, the layer away and the rack off — rather than left behind as a
 * curve and a rack nobody can name, which the pickers would call Custom.
 * Its star goes with it.
 */
export const removeOwnPreset = async (
  id: string,
  takeOff: (() => Promise<void>) | undefined,
): Promise<void> => {
  if (takeOff) {
    await takeOff();
  }
  await removeUserDspPreset(id);
  unstarDspPreset(id);
};
