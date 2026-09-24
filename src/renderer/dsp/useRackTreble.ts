/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IRackTrebleContext } from '../../common/dsp/rackTreble';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { useRackGate } from './rackPlacement';

/**
 * What decides whether the rack EQ's Treble choice is heard, from what the
 * window already holds: where the rack runs (`rackPlacement.ts`) and the
 * installed engine's version from the status it last read — never a new
 * ask of its own.
 */
const useRackTreble = (): IRackTrebleContext => {
  const gate = useRackGate();
  const status = useKnownAudioEngineStatus();
  return {
    engine: gate.engine,
    libraryAudible: gate.libraryAudible,
    dllVersion: status?.fluid.dllVersion,
  };
};

export default useRackTreble;
