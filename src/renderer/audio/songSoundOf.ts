/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { AutoEqFormat } from 'common/constants';
import type { IDspSettings } from 'common/dsp/chain';
import type { ISongSound, TSongSoundLanded } from 'common/songSound';
import { toTone } from 'common/tone';
import { NONE_CHAIN_ID, activeDspPresetId } from '../dsp/dspPresetCatalog';

/**
 * The sound playing, as the song memory reads it (`songSound.ts`): the
 * preset the equaliser's picker shows, the Tone and the bands.
 *
 * Nothing while the bands are not the EQ — a GraphicEQ curve or an impulse
 * imported in their place plays something the bands only approximate, and a
 * song filed or lent from them would be a different sound from the one
 * heard. The memory then neither files nor lends.
 *
 * The preset by the picker's own rule, `activeDspPresetId` named the way the
 * picker names it, so what a song remembers is what the picker said while it
 * played: the None chain the DSP page may have put on is None, as it is there.
 */
const songSoundOf = (
  eq: TSongSoundLanded,
  rack: IDspSettings,
): ISongSound | undefined => {
  if (eq.eqFormat !== undefined && eq.eqFormat !== AutoEqFormat.PARAMETRIC) {
    return undefined;
  }
  const chosen = activeDspPresetId(rack, eq.voicing);
  const tone = toTone(eq.tone);
  return {
    presetId:
      chosen === undefined || chosen === NONE_CHAIN_ID ? 'none' : chosen,
    ...(tone ? { tone } : {}),
    filters: eq.filters,
  };
};

export default songSoundOf;
