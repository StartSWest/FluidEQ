/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  engineRunsDynamics,
  engineRunsFootsteps,
  engineRunsGame,
} from '../engineHealth';
import {
  asFootstepsAlone,
  withoutDynamics,
  withoutFootsteps,
} from './chainWire';

/**
 * What the installed FluidEQ Engine reads of the rack's newer trailers. An
 * engine refuses a line carrying one it does not know and bypasses the whole
 * rack, so each trailer is taken off, or cut down, for an engine older than
 * it: the rack then plays without that stage rather than not at all.
 */
export interface IEngineReads {
  /** The Game filter whole (1.26), Footsteps alone (1.25), or nothing. */
  game: 'game' | 'footsteps' | 'none';
  /** Dynamics (1.27). */
  dynamics: boolean;
}

/** An engine as new as the app: the line as written. */
export const ENGINE_READS_ALL: IEngineReads = { game: 'game', dynamics: true };

/** Nothing known about the engine: the line every engine reads. */
export const ENGINE_READS_NONE: IEngineReads = {
  game: 'none',
  dynamics: false,
};

export const engineReadsOf = (dllVersion: string | undefined): IEngineReads => {
  let game: IEngineReads['game'] = 'none';
  if (engineRunsGame(dllVersion)) {
    game = 'game';
  } else if (engineRunsFootsteps(dllVersion)) {
    game = 'footsteps';
  }
  return { game, dynamics: engineRunsDynamics(dllVersion) };
};

/** The line as the engine that `reads` describes can read it. */
export const lineForEngine = (
  values: number[],
  reads: IEngineReads,
): number[] => {
  const line = reads.dynamics ? values : withoutDynamics(values);
  if (reads.game === 'game') {
    return line;
  }
  return reads.game === 'footsteps'
    ? asFootstepsAlone(line)
    : withoutFootsteps(line);
};
