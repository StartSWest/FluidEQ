/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISavedEqSummary } from 'common/songSoundMemory';
import type { ISavedEqStates } from '../../audio/savedEqActions';

/**
 * How the saved EQ's name lists saved EQs to load, in its short list and its
 * manage view alike: newest changed first, and the one on — playing or
 * changed — above all.
 */
export const orderSavedEqs = (
  eqs: readonly ISavedEqSummary[],
  states: ISavedEqStates,
): ISavedEqSummary[] => {
  const on = states.playingId ?? states.changedId;
  return [...eqs].sort((a, b) => {
    if (a.id === on || b.id === on) {
      return a.id === on ? -1 : 1;
    }
    return b.updatedAt - a.updatedAt;
  });
};

/** What a saved EQ's row says of it: Playing, Changed, or nothing. */
export const rowStateOf = (
  eq: ISavedEqSummary,
  states: ISavedEqStates,
): 'playing' | 'changed' | undefined => {
  if (eq.id === states.playingId) {
    return 'playing';
  }
  return eq.id === states.changedId ? 'changed' : undefined;
};
