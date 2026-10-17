/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IVoicingSettings } from '../constants';
import type { IDspSettings } from './chain';
import { dspPresetCurve, isDspPresetId } from './presets';
import { dspPresetVoicing, dspVoicingPresetId } from './presetVoicing';

/**
 * The Preset layer an output's saved rack goes with.
 *
 * A preset is two things saved side by side in an output's profile: its rack
 * (`dsp`, whose `presetId` the preset picker shows) and its tone, a curve in
 * the main EQ (`voicing`, `dsp:<id>`). A pick writes both. But the one-time
 * copy of the old app-wide rack into every profile without one
 * (`migrateLegacyOutputDsp`) wrote the rack alone, so a profile could come
 * back with the rack of one preset and the curve of another: switching to
 * the BlackShark showed Music on the picker while the Curves list played
 * Podcast (Ivan, 2026-10-15: "an old crap was loaded that doesn't match the
 * presets"). The rack is what the picker names, so a Preset layer naming a
 * different factory preset is replaced by the rack's own curve, at the
 * strength it was playing at.
 *
 * Nothing else is touched: no layer is added where there is none (a curve
 * taken off its chip stays off), any other voicing stays (it replaces the
 * Preset layer on purpose), and a rack switched off, edited away from its
 * preset, or saved by the listener — whose curve main cannot read — keeps
 * the layer as it is.
 */
const presetLayerForRack = (
  voicing: IVoicingSettings | undefined,
  dsp: IDspSettings | undefined,
): IVoicingSettings | undefined => {
  const playing = dspVoicingPresetId(voicing);
  if (
    voicing === undefined ||
    playing === undefined ||
    !dsp?.enabled ||
    playing === dsp.presetId ||
    !isDspPresetId(dsp.presetId)
  ) {
    return voicing;
  }
  const curve = dspPresetCurve(dsp.presetId);
  return curve
    ? { ...dspPresetVoicing(dsp.presetId, curve), intensity: voicing.intensity }
    : undefined;
};

export default presetLayerForRack;
