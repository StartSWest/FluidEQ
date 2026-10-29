/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * What a drop on the amp did, when it put nothing on Up next: nothing it
 * held was music, everything it held was already coming, or adding it
 * failed. A drop that adds songs needs no word — they appear in the list.
 *
 * A drop that visibly does nothing is a bug (CLAUDE.md), and three of them
 * did: the amp lit up for the drag and then nothing happened. The drop is
 * taken by the whole amp (`useMusicDrop`) and the word is said over the
 * queue (`QueueDeck`), so the two meet here.
 *
 * NO TIMER TAKES IT AWAY. It goes when the next thing happens — another
 * drop, the song changing, Up next changing — or when it is dismissed.
 */
export type TDropNotice = 'empty' | 'already' | 'failed';

let notice: TDropNotice | undefined;
const listeners = new Set<() => void>();

const publish = (next: TDropNotice | undefined) => {
  if (next === notice) {
    return;
  }
  notice = next;
  listeners.forEach((listener) => listener());
};

export const showDropNotice = (next: TDropNotice): void => publish(next);

export const clearDropNotice = (): void => publish(undefined);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The word to say over the queue, if a drop left one. */
export const useDropNotice = (): TDropNotice | undefined =>
  useSyncExternalStore(
    subscribe,
    () => notice,
    () => undefined,
  );
