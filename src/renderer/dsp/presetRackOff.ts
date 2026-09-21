/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { resolveDspPreset } from './dspPresetCatalog';
import { releaseRackHold } from './rackHeldForApo';
import { applyDspSettings, persistDspSettings, readDspSettings } from './store';

/**
 * A preset's rack, switched off with the preset.
 *
 * What None does to the rack in either picker, for the other way a preset is
 * taken away: the × on its Preset pill. The pill is the preset — its curve on
 * the EQ page, its rack on the DSP page — and taking the curve alone left the
 * rack playing a preset nothing on the EQ page named any more.
 *
 * Off rather than reset, as None leaves it: the stages keep what they were
 * set to for the next time the rack is switched on. And the hold Equalizer
 * APO put on it goes too, or the next switch to the FluidEQ Engine would put
 * back the rack of a preset that had been taken away (`RackFollowsEngine`).
 */
const switchPresetRackOff = (): void => {
  releaseRackHold();
  const current = readDspSettings();
  if (!current.enabled) {
    return;
  }
  const next = resolveDspPreset('none', current);
  if (next) {
    applyDspSettings(next);
    persistDspSettings();
  }
};

export default switchPresetRackOff;
