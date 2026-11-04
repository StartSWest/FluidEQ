/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { engineRunsDynamics, engineRunsFootsteps } from '../engineHealth';
import { withoutDynamics, withoutFootsteps } from './chainWire';

/** Trailers the installed engine understands; unknown trailers bypass its rack. */
export interface IEngineReads {
  footsteps: boolean;
  dynamics: boolean;
}
export const ENGINE_READS_ALL: IEngineReads = {
  footsteps: true,
  dynamics: true,
};
export const ENGINE_READS_NONE: IEngineReads = {
  footsteps: false,
  dynamics: false,
};
export const engineReadsOf = (version: string | undefined): IEngineReads => ({
  footsteps: engineRunsFootsteps(version),
  dynamics: engineRunsDynamics(version),
});
/** Keep the rest of the rack audible on an engine older than either stage. */
export const lineForEngine = (
  values: number[],
  reads: IEngineReads,
): number[] => {
  const line = reads.dynamics ? values : withoutDynamics(values);
  return reads.footsteps ? line : withoutFootsteps(line);
};
