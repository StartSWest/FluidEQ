/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { dspVoicingPresetId } from '../../common/dsp/presetVoicing';
import { isVoicingActive } from '../../common/voicing';
import { presetLayerName } from '../dsp/dspPresetCatalog';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';

export interface IPlayingGamePreset {
  /** As the Preset chip names it: "Competitive", "Any game". */
  name: string;
  /** What `VoicingIcon` draws it as. */
  glyph: string;
}

/**
 * The preset a game's own sound is playing, as the Preset chip shows it
 * (Ivan, 2026-11-03: "we need to show the current game preset that is
 * playing ... with icon").
 *
 * Read from the Preset layer that is on, never from the profile the game
 * started from: a curve taken off its chip, switched out on its chip or
 * turned to nothing plays nothing, and is not shown as playing. The layers'
 * slice moves only when something is picked, never while a band is dragged.
 */
const usePlayingGamePreset = (): IPlayingGamePreset | undefined => {
  const { t } = useTranslation();
  const { voicing, bypassed } = useFluidEqLayers();
  const glyph = dspVoicingPresetId(voicing);
  if (
    glyph === undefined ||
    !isVoicingActive(voicing) ||
    (bypassed ?? []).includes('voicing')
  ) {
    return undefined;
  }
  const name = presetLayerName(voicing, t);
  return name ? { name, glyph } : undefined;
};

export default usePlayingGamePreset;
