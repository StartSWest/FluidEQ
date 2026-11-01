/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A press, as the step it makes on the player's state and what it asks of
 * the deck beyond that — a seek, which is the deck's and not the list's.
 * Pure: the player (`libraryPlayer.ts`) applies the answer.
 */
import {
  type ILibraryPlayerState,
  PREVIOUS_RESTART_THRESHOLD_MS,
  jumpTo,
  playTracks,
  setPlaying,
  skip,
} from '../../common/library/playerState';
import {
  addToQueue,
  cycleRepeat,
  moveUpNext,
  removeUpNextAt,
  retargetQueue,
  setContinuation,
  setShuffle,
  topUpQueue,
} from '../../common/library/queueEdits';
import type {
  ILibraryPlayerAnswer,
  TLibraryPlayerCommand,
} from '../../common/library/playerWire';

export interface IPlayerCommandResult {
  state: ILibraryPlayerState;
  answer: ILibraryPlayerAnswer;
  /** Move the playhead of the song playing here. */
  seekMs?: number;
  /** Stop: the marks a song's end and its overlap left are let go. */
  stop?: boolean;
}

export interface IPlayerCommandContext {
  /** Where the song playing is, as the bar shows it. */
  positionMs: number;
  /** The song ran out on its deck: Play starts it again, as an element does. */
  restartsOnPlay: boolean;
}

export const runPlayerCommand = (
  state: ILibraryPlayerState,
  command: TLibraryPlayerCommand,
  context: IPlayerCommandContext,
): IPlayerCommandResult => {
  const step = (next: ILibraryPlayerState): IPlayerCommandResult => ({
    state: next,
    answer: {},
  });
  switch (command.kind) {
    case 'play':
      return step(playTracks(state, command.trackIds, command.startTrackId));
    case 'toggle': {
      const next = setPlaying(state, !state.isPlaying);
      return next.isPlaying && !state.isPlaying && context.restartsOnPlay
        ? { state: next, answer: {}, seekMs: 0 }
        : step(next);
    }
    case 'setPlaying': {
      const next = setPlaying(state, command.isPlaying);
      return next.isPlaying && !state.isPlaying && context.restartsOnPlay
        ? { state: next, answer: {}, seekMs: 0 }
        : step(next);
    }
    case 'stop': {
      // Pauses and rewinds, keeping the song and the queue: Play starts the
      // same song again from its beginning.
      const { restore: _restore, ...rest } = setPlaying(state, false);
      return { state: rest, answer: {}, seekMs: 0, stop: true };
    }
    case 'skip':
      // Previous past the first ten seconds rewinds rather than changing
      // song, asked of the clock that follows whatever is audible.
      return command.direction === -1 &&
        context.positionMs > PREVIOUS_RESTART_THRESHOLD_MS
        ? { state, answer: {}, seekMs: 0 }
        : step(skip(state, command.direction));
    case 'seek':
      return { state, answer: {}, seekMs: command.positionMs };
    case 'jump':
      return step(jumpTo(state, command.position));
    case 'add': {
      const added = addToQueue(state, command.trackIds, command.beforeIds);
      return { state: added.state, answer: { joined: added.joined } };
    }
    case 'remove':
      return step(removeUpNextAt(state, command.position));
    case 'move':
      return step(moveUpNext(state, command.from, command.to));
    case 'shuffle':
      return step(setShuffle(state, command.isShuffled));
    case 'repeat':
      return step(cycleRepeat(state));
    case 'retarget':
      return step(retargetQueue(state, command.trackIds, command.listKey));
    case 'topUp':
      return step(topUpQueue(state, command.trackIds, command.listKey));
    case 'continuation':
      return step(setContinuation(state, command.isOn));
    default: {
      const unknown: never = command;
      throw new Error(`Not a Library press: ${JSON.stringify(unknown)}`);
    }
  }
};
