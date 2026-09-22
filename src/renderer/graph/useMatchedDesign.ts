/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { enginePlaysMatched } from 'common/filterDesign';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';

/**
 * Whether the engine playing now builds FluidEQ's own bands analog-matched,
 * so the graph draws the shape that is heard (`usesMatchedDesign`).
 *
 * False under Equalizer APO, which has only the cookbook, and under a FluidEQ
 * Engine older than `ENGINE_MATCHED_DESIGN_SINCE`, which reads the directive
 * as a comment; false too until the window knows which engine it has.
 */
const useMatchedDesign = (): boolean => {
  const status = useKnownAudioEngineStatus();
  return (
    status?.engine === 'fluid' && enginePlaysMatched(status.fluid.dllVersion)
  );
};

export default useMatchedDesign;
