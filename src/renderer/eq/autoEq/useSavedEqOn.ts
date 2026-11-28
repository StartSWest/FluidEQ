/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from 'common/i18n';
import type { ISavedEqSummary } from 'common/songSoundMemory';
import { useSongSoundIndex } from '../../audio/songSoundIndex';
import { useLiveSongSound } from '../../audio/songSoundSession';
import { useSavedEqStates } from '../../audio/savedEqActions';
import { countText } from '../../library/libraryFormat';

/** Who follows a saved EQ: "12 songs, 1 album", or nothing. */
export const usedOf = (eq: ISavedEqSummary, t: Translate): string =>
  [
    eq.songCount > 0 ? countText(t, 'library.trackCount', eq.songCount) : '',
    eq.albumCount > 0 ? countText(t, 'library.albumCount', eq.albumCount) : '',
  ]
    .filter(Boolean)
    .join(', ');

/**
 * The saved EQs, what plays, and the one that is on — playing exactly, or
 * put on and changed since — as both of the bands toolbar's keys read them:
 * the name that loads and the disk that saves.
 */
const useSavedEqOn = () => {
  const { eqs, eqById } = useSongSoundIndex();
  const live = useLiveSongSound();
  const states = useSavedEqStates(eqs);
  const onId = states.changedId ?? states.playingId;
  const on = onId === undefined ? undefined : eqById.get(onId);
  return {
    eqs,
    live,
    states,
    on,
    isChanged: on !== undefined && on.id === states.changedId,
  };
};

export default useSavedEqOn;
