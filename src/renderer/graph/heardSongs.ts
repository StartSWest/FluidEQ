/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { createSongJournal } from 'common/songJournal';

/**
 * The songs this window has heard for the member's AI (hear_the_music,
 * `useStudioAgent.ts`): one journal for the life of the page, fed while the
 * Studio listens for the AI (`useSongListening.ts`). A capture can end and
 * the next begin in the middle of a song, and the song goes on through both.
 */

const listeners = new Set<() => void>();

export const heardSongs = createSongJournal(() =>
  listeners.forEach((listener) => listener()),
);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const seconds = () => heardSongs.seconds();
const sounding = () => heardSongs.sounding();

/** Whole seconds heard of the song playing now; renders once a second at most. */
export const useHeardSeconds = () =>
  useSyncExternalStore(subscribe, seconds, seconds);

/** Whether music is being heard right now. */
export const useHeardSounding = () =>
  useSyncExternalStore(subscribe, sounding, sounding);
