/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { createLayerLines, type TEqModeSettings } from '../../graph/layerLines';
import useMatchedDesign from '../../graph/useMatchedDesign';
import { useFluidEqLayers } from '../../utils/FluidEqContext';
import useOutputRate from '../../utils/useOutputRate';
import type { IPresetCurveDesign } from './presetCardDrawing';

/**
 * How the Preset tab's cards draw their curves: the main graph's own reading
 * of the EQ mode menu, the engine's treble design and the output's rate
 * (`useResponseCurves`), so a card and the graph draw one preset the same.
 *
 * Read once by the tab and handed to every card: a rate read per card would
 * be eighty-odd questions to main for one answer.
 */
const usePresetCurveDesign = (): IPresetCurveDesign => {
  const {
    eqMode,
    curveEqMode,
    isEqDoubleOn,
    mainBandQ,
    eqBandQ,
    curveBandQ,
    curveSmoothing,
  } = useFluidEqLayers();
  const matchedDesign = useMatchedDesign();
  const sampleRate = useOutputRate('editor');
  return useMemo(() => {
    const settings: TEqModeSettings = {
      eqMode,
      curveEqMode,
      isEqDoubleOn,
      mainBandQ,
      eqBandQ,
      curveBandQ,
      curveSmoothing,
    };
    const lines = createLayerLines(settings, matchedDesign, sampleRate);
    return {
      key: JSON.stringify([
        settings,
        lines.matchedFor('voicing'),
        sampleRate ?? null,
      ]),
      lines,
    };
  }, [
    eqMode,
    curveEqMode,
    isEqDoubleOn,
    mainBandQ,
    eqBandQ,
    curveBandQ,
    curveSmoothing,
    matchedDesign,
    sampleRate,
  ]);
};

export default usePresetCurveDesign;
