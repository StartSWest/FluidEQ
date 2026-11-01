/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongEqEntry } from './songEq';
import type { ISongIdentity } from './songIdentity';

/**
 * The Smart EQ song memory between the window and the app's core, which
 * runs it (`main/songEqMemory.ts`): what the badge, the switch and the
 * "we remembered this" card draw, and what their buttons ask.
 */

/**
 * The "we remembered this" card, and which one it is: the card reports its
 * own end by `id` (`SongEqNotice.scss`'s linger), so a card raised while
 * another is up is not taken down by the earlier one's end.
 */
export interface ISongEqNotice {
  id: number;
  identity: ISongIdentity;
  entry: ISongEqEntry;
}

export interface ISongEqStatus {
  isSaveOn: boolean;
  /**
   * Ms listened to the song open now, including the run in progress, to the
   * second — what the badge and the switch count down from. Zero with
   * nothing open.
   */
  listenedMs: number;
  title?: string;
  /**
   * Whether listening on, exactly as things stand, ends in a saved entry —
   * so a song with saving on but no Smart EQ layer at all says honestly that
   * nothing here can ever be saved.
   */
  willSave: boolean;
  notice?: ISongEqNotice;
  /**
   * A song is open and the core cannot hear the output to count its time:
   * the window's players say when time passes instead.
   */
  needsClock: boolean;
}

export const NO_SONG_EQ_STATUS: ISongEqStatus = {
  isSaveOn: false,
  listenedMs: 0,
  willSave: false,
  needsClock: false,
};

export type TSongEqAction =
  | { kind: 'undo' }
  | { kind: 'forget' }
  | { kind: 'endNotice'; id: number }
  | { kind: 'setSaveOn'; isSaveOn: boolean };

export const SONG_EQ_CHANNEL = {
  /** Core to window: the status, whenever it draws differently. */
  status: 'song-eq-status',
  /** Window to core: the status now, answered on `status`. */
  ask: 'song-eq-ask',
  /** Window to core: time passed, while the status asks for a clock. */
  tick: 'song-eq-tick',
  /** Window to core: a `TSongEqAction`. */
  action: 'song-eq-action',
} as const;
