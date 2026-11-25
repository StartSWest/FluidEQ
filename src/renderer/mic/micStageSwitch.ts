/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What switching one of the mic's stages over does to its rack, the same
 * from the rail's switch as from the stage's own card. The Low cut is not
 * here: its switch keeps the parts it takes off in the mic's saved entry
 * (`useMicSound.switchLowCut`), which no rack patch can carry.
 */

import type { IDspSettings } from '../../common/dsp/chain';
import { REVERB_DEFAULTS } from '../../common/dsp/reverbStage';
import { dspStageSwitch } from '../dsp/dspStageSwitch';
import { micStageOn, type TMicStage } from './MicStageRail';

const micStageSwitch = (
  stage: Exclude<TMicStage, 'lowCut' | 'own'>,
  settings: IDspSettings,
): Partial<IDspSettings> => {
  const on = micStageOn(settings, stage);
  switch (stage) {
    case 'denoise':
      // The cleaner alone: the hiss reducer is for recordings, and on a live
      // voice the cleaner already takes the room.
      return {
        denoise: {
          ...settings.denoise,
          enabled: !on,
          presetId: '',
          hiss: { ...settings.denoise.hiss, enabled: false },
          voice: { ...settings.denoise.voice, enabled: !on },
        },
      };
    case 'gate':
      return settings.voice
        ? {
            voice: { ...settings.voice, enabled: true, gateEnabled: !on },
          }
        : {};
    case 'level':
      return settings.voice
        ? {
            voice: { ...settings.voice, enabled: true, levelEnabled: !on },
          }
        : {};
    case 'reverb':
      return {
        reverb: { ...(settings.reverb ?? REVERB_DEFAULTS), enabled: !on },
      };
    default:
      // The rack's own stages, whose cards are the DSP page's
      // (`DspStageCards`): the edit their power switch makes.
      return dspStageSwitch(stage, settings).patch;
  }
};

export default micStageSwitch;
