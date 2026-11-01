/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  ISongMemoryStatus,
  NO_SONG_MEMORY_STATUS,
  SONG_MEMORY_CHANNEL,
  TSongMemoryAction,
  TSongMemoryNotice,
} from 'common/songMemoryStatus';

export type TSongSoundNotice = TSongMemoryNotice;

/**
 * The window's view of the song memory, which runs in the app's core
 * (`main/songMemory.ts`): its switch and its cards as the core says them,
 * and the buttons that answer them.
 */

let status: ISongMemoryStatus = NO_SONG_MEMORY_STATUS;

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const setStatus = (next: ISongMemoryStatus): void => {
  status = next;
  emit();
};

/** Optional, like every bridge call: a test's partial bridge has none. */
const send = (channel: string, args: unknown[]): void =>
  window.electron?.ipcRenderer?.sendMessage?.(channel, args);

const act = (action: TSongMemoryAction): void =>
  send(SONG_MEMORY_CHANNEL.action, [action]);

const isStatus = (value: unknown): value is ISongMemoryStatus =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ISongMemoryStatus).isOn === 'boolean' &&
  typeof (value as ISongMemoryStatus).needsClock === 'boolean';

/** Where a window from before the core kept the switch wrote it down. */
const OLD_SWITCH_KEY = 'fluideq.songSound';

/**
 * The switch from before, handed to the core once and forgotten here. Read
 * and removed before it is sent: a store that will not give it up would hand
 * an old switch over at every launch.
 */
const handOverOldSwitch = (): void => {
  if (!window.electron?.ipcRenderer?.sendMessage) {
    return;
  }
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(OLD_SWITCH_KEY);
    window.localStorage.removeItem(OLD_SWITCH_KEY);
  } catch {
    // A store that cannot be read holds nothing to hand over.
    return;
  }
  if (stored === 'true' || stored === 'false') {
    send(SONG_MEMORY_CHANNEL.handOver, [stored === 'true']);
  }
};

/** Follow what the core says from now on: asked once, then told. */
export const followSongMemory = (): (() => void) => {
  const off = window.electron?.ipcRenderer?.on?.(
    SONG_MEMORY_CHANNEL.status,
    (payload) => {
      if (isStatus(payload)) {
        setStatus(payload);
      }
    },
  );
  handOverOldSwitch();
  send(SONG_MEMORY_CHANNEL.ask, []);
  return () => off?.();
};

/** Time passed for the window's players, while the core cannot hear it. */
export const reportTick = (): void => send(SONG_MEMORY_CHANNEL.tick, []);

/* --- the switch --- */

export const isSongSoundOn = (): boolean => status.isOn;

export const setSongSoundOn = (isOn: boolean): void => {
  if (isOn === status.isOn) {
    return;
  }
  // Shown at once; the core's own word follows.
  setStatus({ ...status, isOn });
  act({ kind: 'setOn', isOn });
};

export const useSongSoundOn = (): boolean =>
  useSyncExternalStore(subscribe, isSongSoundOn, () => false);

/** Whether the core asks the window's players for its clock. */
export const useSongMemoryNeedsClock = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => status.needsClock,
    () => false,
  );

/* --- the notice --- */

export const useSongSoundNotice = (): TSongSoundNotice | undefined =>
  useSyncExternalStore(
    subscribe,
    () => status.notice,
    () => undefined,
  );

const dismissNotice = (): void => {
  if (status.notice === undefined) {
    return;
  }
  const { notice: _dismissed, ...rest } = status;
  setStatus(rest);
};

/** The notice named by `id` has been up for its whole moment. */
export const endSongSoundNotice = (id: number): void => {
  if (status.notice?.id !== id) {
    return;
  }
  dismissNotice();
  act({ kind: 'endNotice', id });
};

/** This play only: the listener's own sound back, the memory kept. */
export const undoSongSound = (): void => {
  dismissNotice();
  act({ kind: 'undo' });
};

/** This song not filed this play, whatever it ends with. */
export const dontSaveSongSound = (): void => {
  dismissNotice();
  act({ kind: 'dontSave' });
};

/** The song the notice names forgotten, and its sound taken off it. */
export const forgetNoticedSongSound = (): void => {
  dismissNotice();
  act({ kind: 'forget' });
};

/** Back to nothing heard from the core, between isolated tests. */
export const resetSongSoundSession = (): void => {
  setStatus(NO_SONG_MEMORY_STATUS);
};
