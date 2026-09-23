/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import {
  DEFAULT_TREBLE_DESIGN,
  groupPlaysMatched,
  TTrebleScope,
} from 'common/filterDesign';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { useTrebleDesigns } from '../utils/useTrebleDesigns';

/** Per group, whether its bands play analog-matched. */
export type TMatchedDesign = Readonly<Record<TTrebleScope, boolean>>;

/**
 * Whether the engine playing now builds each group's bands analog-matched,
 * so the graph draws the shape that is heard (`groupPlaysMatched`).
 *
 * False under Equalizer APO, which has only the cookbook; under a FluidEQ
 * Engine older than `ENGINE_MATCHED_DESIGN_SINCE`, which reads the directive
 * as a comment; and for a group whose Treble choice is Classic on an engine
 * that reads it. False too until the window knows which engine it has. Until
 * the choice itself has been read, a group is drawn as the default, which is
 * what an absent file plays.
 */
const useMatchedDesign = (): TMatchedDesign => {
  const status = useKnownAudioEngineStatus();
  const treble = useTrebleDesigns();
  const fluid = status?.engine === 'fluid';
  const dllVersion = status?.fluid.dllVersion;
  const eq =
    fluid && groupPlaysMatched(dllVersion, treble?.eq ?? DEFAULT_TREBLE_DESIGN);
  const curves =
    fluid &&
    groupPlaysMatched(dllVersion, treble?.curves ?? DEFAULT_TREBLE_DESIGN);
  // One object per answer: the graph's curves are memoised on it.
  return useMemo(() => ({ eq, curves }), [eq, curves]);
};

export default useMatchedDesign;
