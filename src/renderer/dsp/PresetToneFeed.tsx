/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo } from 'react';
import { presetToneOf } from '../../common/dsp/presetTone';
import useMatchedDesign from '../graph/useMatchedDesign';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { setDspPresetTone } from './store';

/**
 * Tells the rack what the Preset layer plays after it, so its Maximizer
 * limits the preset's sound as it is heard (`presetTone.ts`).
 *
 * Headless, beside the window's other always-on engines: the curve changes
 * with a preset picked on any page, with the Preset chip's bypass, and with
 * the EQ mode menu's strength, band shape and Treble — none of which is the
 * DSP page's to watch. Read from the state on screen, which is the output
 * being tuned; the rack is one for every output.
 */
const PresetToneFeed = () => {
  const {
    isEnabled,
    voicing,
    bypassed,
    eqMode,
    curveEqMode,
    isEqDoubleOn,
    eqBandQ,
    curveBandQ,
  } = useFluidEqLayers();
  const matchedDesign = useMatchedDesign();
  const tone = useMemo(
    () =>
      presetToneOf(
        {
          isEnabled,
          voicing,
          bypassed,
          eqMode,
          curveEqMode,
          isEqDoubleOn,
          eqBandQ,
          curveBandQ,
        },
        matchedDesign,
      ),
    [
      isEnabled,
      voicing,
      bypassed,
      eqMode,
      curveEqMode,
      isEqDoubleOn,
      eqBandQ,
      curveBandQ,
      matchedDesign,
    ],
  );

  useEffect(() => {
    setDspPresetTone(tone);
  }, [tone]);

  return null;
};

export default PresetToneFeed;
