/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongIdentity } from './songIdentity';
import type { ISongSoundEntry } from './songSound';

/*
 * The song memory runs in the app's core (`main/songMemory.ts`); the window
 * shows what it says and tells it what the window's own players play. Names
 * alone, and the shapes that cross, so the preload pulls in no memory code.
 */

/** What a card says: a song's own sound put on, or a preset it will keep. */
export type TSongMemoryNoticeContent =
  | { kind: 'lent'; identity: ISongIdentity; entry: ISongSoundEntry }
  | { kind: 'willSave'; identity: ISongIdentity; presetId: string };

/** New each time, so the same news twice is shown twice. */
export type TSongMemoryNotice = TSongMemoryNoticeContent & { id: number };

export interface ISongMemoryStatus {
  /** The listener's switch, whatever a game is doing. */
  isOn: boolean;
  notice?: TSongMemoryNotice;
  /**
   * A song is settling or paused and the core cannot hear the output to
   * count the time: the window's players say when time passes instead.
   */
  needsClock: boolean;
}

export const NO_SONG_MEMORY_STATUS: ISongMemoryStatus = {
  isOn: false,
  needsClock: false,
};

/** What the window asks of the memory, from its cards and its switch. */
export type TSongMemoryAction =
  | { kind: 'undo' }
  | { kind: 'dontSave' }
  | { kind: 'forget' }
  | { kind: 'endNotice'; id: number }
  | { kind: 'setOn'; isOn: boolean };

export const SONG_MEMORY_CHANNEL = {
  /** Main to window: the status, whenever it changes. */
  status: 'song-memory-status',
  /** Window to main: the status now, answered on `status`. */
  ask: 'song-memory-ask',
  /** Window to main: what the window's players play. */
  nowPlaying: 'song-memory-now-playing',
  /** Window to main: time passed, while the status asks for a clock. */
  tick: 'song-memory-tick',
  /** Window to main: a `TSongMemoryAction`. */
  action: 'song-memory-action',
  /**
   * Window to main, once: the switch as a window from before the core kept
   * it wrote it down. Kept only where the core has never had one.
   */
  handOver: 'song-memory-hand-over',
} as const;

/** The switch as the core keeps it: undefined where it was never chosen. */
export const parseSongMemorySwitch = (raw: unknown): boolean | undefined =>
  typeof raw === 'boolean' ? raw : undefined;
