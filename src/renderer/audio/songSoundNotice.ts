/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { ISongIdentity } from 'common/songIdentity';
import type { TSongSoundOwner } from 'common/songSoundEvents';

/**
 * The card Auto EQ's song and album sounds put up (`SongSoundNotice`,
 * `SongSoundSaveNotice`): one at a time, the latest belonging to the song and
 * the editor that raised it. Apart from the session that raises it
 * (`songSoundSession.ts`), which says when.
 */
export type TSongSoundNoticeContent =
  | {
      kind: 'lent';
      identity: ISongIdentity;
      owner: TSongSoundOwner;
      presetId: string;
      albumTitle?: string;
    }
  | {
      kind: 'willSave';
      identity: ISongIdentity;
      presetId: string;
      owner: TSongSoundOwner;
    };

export type TSongSoundNotice = TSongSoundNoticeContent & { id: number };

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

export const showSongSoundNotice = (next: TSongSoundNoticeContent): void => {
  // The same preset again for the same song — the picker's curve and its rack
  // landing a render apart — is the same news, and keeps the card it has.
  if (
    next.kind === 'willSave' &&
    notice?.kind === 'willSave' &&
    notice.identity.key === next.identity.key &&
    notice.presetId === next.presetId
  ) {
    return;
  }
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
