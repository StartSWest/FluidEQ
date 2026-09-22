/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { resolveDspPreset } from './dspPresetCatalog';
import { releaseRackHold } from './rackHeldForApo';
import { applyDspSettings, persistDspSettings, readDspSettings } from './store';

/**
 * A preset's rack, taken away with the preset.
 *
 * What None does on the equaliser's picker, for the other way a preset is
 * taken away: the × on its Preset pill. The pill is the preset — its curve on
 * the EQ page, its rack on the DSP page — and taking the curve alone left the
 * rack playing a preset nothing on the EQ page named any more.
 *
 * None on the rack and the rack off, as None leaves it, whether the rack was
 * running or held off: the DSP page then names None rather than the chain
 * that went. And the hold Equalizer APO put on it goes too, or the next
 * switch to the FluidEQ Engine would put back the rack of a preset that had
 * been taken away (`RackFollowsEngine`).
 */
const switchPresetRackOff = (): void => {
  releaseRackHold();
  const next = resolveDspPreset('none', readDspSettings());
  if (next) {
    applyDspSettings(next);
    persistDspSettings();
  }
};

export default switchPresetRackOff;
