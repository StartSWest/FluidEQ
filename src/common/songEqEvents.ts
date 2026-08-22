/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ISmartEqSettings } from './constants';
import { ISongEqEntry } from './songEq';
import { ISongIdentity } from './songIdentity';

/**
 * What a recording session is made of, and every event and effect the reducer
 * speaks in — the vocabulary, with none of the rules.
 *
 * Split out of `songEqRecorder.ts` for the same reason `songEqTiming.ts` was:
 * to keep that file under its line ceiling. It is also what breaks the cycle
 * those two were in, since `songEqTiming.ts` needs these types and
 * `songEqRecorder.ts` needs its functions — both now depend on this, and this
 * depends on neither.
 *
 * `songEqRecorder.ts` re-exports everything here, so nothing outside needs to
 * know the declarations moved.
 */

export type TSongEqPhase = 'settling' | 'recording' | 'suspended';

export interface ISongEqSession {
  phase: TSongEqPhase;
  identity: ISongIdentity;
  /** Wall-clock ms accumulated while playing. Never derived from a reported
   * position: players republish those erratically and a seek would inflate it. */
  listenedMs: number;
  /** When the current playing run began; absent while not playing. */
  playingSince?: number;
  /** When `settling` began. */
  settlingSince: number;
  /** When `suspended` began. */
  suspendedSince?: number;
  /** Whether the two-minute checkpoint has already been written. */
  hasCheckpointed: boolean;
  /**
   * Set by a 'forget' event. The session keeps timing — the badge stays
   * honest about a song still playing — but `close` in `songEqTiming.ts`
   * must never commit one marked this way, however long it plays afterwards,
   * or "forget" would just be a way to re-file the same curve a moment
   * later.
   */
  forgotten?: boolean;
  /**
   * What the layer held before a match was applied, and whether there is one.
   *
   * `hasLoan` is separate from `loanLayer` because "there was no layer" is a
   * value worth restoring and is indistinguishable from "no loan" otherwise.
   */
  hasLoan: boolean;
  loanLayer?: ISmartEqSettings;
  /** The exact layer this recorder last put into the chain, so a write from
   * anywhere else is recognisable. */
  written?: ISmartEqSettings;
}

export interface ISongEqRecorderState {
  session?: ISongEqSession;
  deviceId: string;
  isSaveOn: boolean;
  /**
   * Whether one of the automatic Smart EQ modes is chosen, switched on and
   * not bypassed — see `useIsAutoEqRunning`, which is where the shell works
   * it out and the only thing that reports it here.
   *
   * Saving a song means filing the Smart EQ layer that mode is refining for
   * it, and nothing else in the app ever writes one. So this is a condition
   * on saving at all, not a detail of it: with no automatic mode running
   * there is no measurement to file, and `saveToggled` refuses to go on.
   */
  isAutoEqRunning: boolean;
  /** The Smart EQ layer as it currently stands. */
  liveLayer?: ISmartEqSettings;
}

export type TSongEqEvent =
  | { kind: 'nowPlaying'; identity?: ISongIdentity; isPlaying: boolean }
  | { kind: 'tick' }
  /** A layer this recorder did not write. Drops the loan — see the case. */
  | { kind: 'layerChanged'; layer?: ISmartEqSettings }
  /**
   * A layer the continuous Smart EQ engine has just written, announced by the
   * writer itself.
   *
   * The loan survives it, and that is the entire point. Ticking the switch on
   * starts a continuous mode, which then writes a fresh measured layer every
   * few seconds into the same context state `layerChanged` watches; each of
   * those looked exactly like a preset load, so the loan was dropped within
   * seconds of every match and the end-of-song restore never ran — leaving
   * one song's curve equalising the next.
   *
   * Announcement rather than comparison, deliberately. An earlier round of
   * this feature guessed at authorship by comparing layers, and a comparison
   * cannot recognise one the main process rebuilt or sanitised on the way
   * back; `isSameLayer` is the backstop for the echo of our own write, not
   * the mechanism.
   */
  | { kind: 'ownWrite'; layer?: ISmartEqSettings }
  | { kind: 'deviceChanged'; deviceId: string }
  | { kind: 'saveToggled'; isSaveOn: boolean }
  /**
   * An automatic Smart EQ mode has been switched on, or off.
   *
   * Reported on every change of `useIsAutoEqRunning` and on no other
   * occasion; the shell does not decide what it means, which is why the
   * event carries the new state rather than an instruction.
   */
  | { kind: 'autoEqChanged'; isRunning: boolean }
  | { kind: 'matched'; identity: ISongIdentity; entry?: ISongEqEntry }
  | { kind: 'undo' }
  | { kind: 'closing' }
  /**
   * Forget whatever this output remembers about the song the notice names.
   *
   * `identity` is the notice's own, and it WINS over the session's: the toast
   * lingers about six seconds and the next song settles into a session after
   * two, so for four of those seconds preferring the session would delete a
   * song the button the user is looking at does not name. The session is only
   * the fallback for a notice that has already gone.
   */
  | { kind: 'forget'; identity?: ISongIdentity };

export type TSongEqEffect =
  | { kind: 'lookup'; identity: ISongIdentity; deviceId: string }
  | { kind: 'applyLayer'; settings?: ISmartEqSettings }
  | {
      kind: 'checkpoint';
      identity: ISongIdentity;
      deviceId: string;
      layer: ISmartEqSettings;
    }
  | {
      kind: 'commit';
      identity: ISongIdentity;
      deviceId: string;
      layer: ISmartEqSettings;
    }
  | { kind: 'notice'; identity: ISongIdentity; entry: ISongEqEntry }
  /**
   * Delete whatever this output remembers about this song — the storage side
   * of a 'forget' event, once the reducer has decided whose song it is.
   *
   * The whole identity rather than its key, because the entry is very often
   * filed under a different one: a curve learned from a library file and
   * matched from Spotify lives under `library:<id>`, and a key-only delete
   * asked the store to remove a `system:` entry that was never there — and
   * was answered with a success.
   */
  | { kind: 'forget'; deviceId: string; identity: ISongIdentity };

export const getInitialRecorderState = (): ISongEqRecorderState => ({
  deviceId: '',
  isSaveOn: false,
  isAutoEqRunning: false,
});
