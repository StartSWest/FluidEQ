/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { ISongIdentity } from 'common/songIdentity';
import type { TSongSoundOwner } from 'common/songSoundEvents';

/**
 * The card Auto EQ's song and album sounds put up (`SongSoundNotice`): one
 * at a time, the latest belonging to the song and the editor that raised it.
 * Apart from the session that raises it (`songSoundSession.ts`), which says
 * when. There is no card for a change about to be saved any more: a change is
 * saved only by a press (Save changes), and the panel and the EQ page say it
 * is not saved yet.
 */
export interface ISongSoundNoticeContent {
  identity: ISongIdentity;
  owner: TSongSoundOwner;
  presetId: string;
  albumTitle?: string;
}

export type TSongSoundNotice = ISongSoundNoticeContent & { id: number };

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

let notice: TSongSoundNotice | undefined;
let lastNoticeId = 0;

export const showSongSoundNotice = (next: ISongSoundNoticeContent): void => {
  lastNoticeId += 1;
  notice = { ...next, id: lastNoticeId };
  emit();
};

export const useSongSoundNotice = (): TSongSoundNotice | undefined =>
  useSyncExternalStore(
    subscribe,
    () => notice,
    () => undefined,
  );

/** The notice named by `id` has been up for its whole moment. */
export const endSongSoundNotice = (id: number): void => {
  if (notice?.id !== id) {
    return;
  }
  notice = undefined;
  emit();
};

/** Whatever card is up, taken down. */
export const dismissSongSoundNotice = (): void => {
  if (notice === undefined) {
    return;
  }
  notice = undefined;
  emit();
};
