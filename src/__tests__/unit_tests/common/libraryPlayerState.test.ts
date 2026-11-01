/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The transport's rules in the core's Library player: what a press, the end
 * of a song and the overlap do to what plays (`common/library/playerState.ts`).
 */
import { buildQueue, currentTrackId } from '../../../common/library/queue';
import {
  INITIAL_PLAYER_STATE,
  type ILibraryPlayerState,
  crossfadeDue,
  isGuessIn,
  jumpTo,
  mayCrossfadeOut,
  nextRepeat,
  playTracks,
  restoreCued,
  setPlaying,
  skip,
  trackEnded,
  trackFailed,
  wantsContinuation,
} from '../../../common/library/playerState';
import {
  continuationDrawn,
  setContinuation,
} from '../../../common/library/queueEdits';

const playing = (
  ids: readonly string[],
  start: string,
  overrides: Partial<ILibraryPlayerState> = {},
): ILibraryPlayerState => ({
  ...INITIAL_PLAYER_STATE,
  queue: buildQueue(ids, start, false),
  isPlaying: true,
  ...overrides,
});

const at = (state: ILibraryPlayerState) =>
  state.queue ? currentTrackId(state.queue) : undefined;

describe('playing a list', () => {
  it('keeps the listener’s shuffle and repeat, and forgets what was added', () => {
    const before = playing(['a', 'b'], 'a', { addedIds: new Set(['b']) });
    const shuffledRepeat = {
      ...before,
      queue: before.queue
        ? { ...before.queue, repeat: 'all' as const }
        : undefined,
    };
    const next = playTracks(shuffledRepeat, ['x', 'y', 'z'], 'y');
    expect(at(next)).toBe('y');
    expect(next.queue?.repeat).toBe('all');
    expect(next.addedIds.size).toBe(0);
    expect(next.isPlaying).toBe(true);
  });

  it('lets go of a restored place and of a song that failed', () => {
    const restored = playing(['a'], 'a', {
      isPlaying: false,
      restore: { trackId: 'a', positionMs: 40_000 },
      failedTrackId: 'a',
    });
    const next = playTracks(restored, ['a', 'b'], 'a');
    expect(next.restore).toBeUndefined();
    expect(next.failedTrackId).toBeUndefined();
  });
});

describe('play and pause', () => {
  it('has nothing to play with nothing queued', () => {
    expect(setPlaying(INITIAL_PLAYER_STATE, true).isPlaying).toBe(false);
  });

  it('does not start a song no deck could play', () => {
    const failed = trackFailed(playing(['a'], 'a'), 'a');
    expect(failed.isPlaying).toBe(false);
    expect(setPlaying(failed, true).isPlaying).toBe(false);
  });

  it('pauses and plays what is queued', () => {
    const paused = setPlaying(playing(['a'], 'a'), false);
    expect(paused.isPlaying).toBe(false);
    expect(setPlaying(paused, true).isPlaying).toBe(true);
  });
});

describe('a change of song', () => {
  it('is a song asked for: Next pressed while paused plays the next one', () => {
    const paused = playing(['a', 'b'], 'a', { isPlaying: false });
    const next = skip(paused, 1);
    expect(at(next)).toBe('b');
    expect(next.isPlaying).toBe(true);
  });

  it('forgets the restored place, which was the song before’s', () => {
    const restored = playing(['a', 'b'], 'a', {
      isPlaying: false,
      restore: { trackId: 'a', positionMs: 30_000 },
    });
    expect(jumpTo(restored, 1).restore).toBeUndefined();
  });

  it('leaves the state alone for a jump outside the queue', () => {
    const state = playing(['a', 'b'], 'a');
    expect(jumpTo(state, 9)).toBe(state);
    expect(jumpTo(state, -1)).toBe(state);
  });
});

describe('the end of a song', () => {
  it('restarts it under repeat one, and moves nothing', () => {
    const state = playing(['a', 'b'], 'a');
    const repeating = {
      ...state,
      queue: state.queue
        ? { ...state.queue, repeat: 'one' as const }
        : undefined,
    };
    const ended = trackEnded(repeating);
    expect(ended.restart).toBe(true);
    expect(ended.state).toBe(repeating);
  });

  it('moves on to the next song, still playing', () => {
    const ended = trackEnded(playing(['a', 'b'], 'a'));
    expect(ended.restart).toBe(false);
    expect(at(ended.state)).toBe('b');
    expect(ended.state.isPlaying).toBe(true);
  });

  it('stops at the last song with repeat off, rather than replay it', () => {
    const ended = trackEnded(playing(['a', 'b'], 'b'));
    expect(at(ended.state)).toBe('b');
    expect(ended.state.isPlaying).toBe(false);
  });

  it('goes round to the first song under repeat all', () => {
    const state = playing(['a', 'b'], 'b');
    const ended = trackEnded({
      ...state,
      queue: state.queue ? { ...state.queue, repeat: 'all' } : undefined,
    });
    expect(at(ended.state)).toBe('a');
    expect(ended.state.isPlaying).toBe(true);
  });
});

describe('the natural overlap', () => {
  it('moves on to the next song', () => {
    expect(at(crossfadeDue(playing(['a', 'b'], 'a')))).toBe('b');
  });

  it('does not start from the last song with repeat off, nor under repeat one', () => {
    expect(mayCrossfadeOut(playing(['a', 'b'], 'a'))).toBe(true);
    expect(mayCrossfadeOut(playing(['a', 'b'], 'b'))).toBe(false);
    const state = playing(['a', 'b'], 'b');
    const all = {
      ...state,
      queue: state.queue
        ? { ...state.queue, repeat: 'all' as const }
        : undefined,
    };
    expect(mayCrossfadeOut(all)).toBe(true);
    const one = {
      ...state,
      queue: state.queue
        ? { ...state.queue, repeat: 'one' as const }
        : undefined,
    };
    expect(mayCrossfadeOut(one)).toBe(false);
    // Repeat one in the middle of the list too: the song plays again, so
    // nothing may fade in over its end.
    const early = playing(['a', 'b'], 'a');
    const oneEarly = {
      ...early,
      queue: early.queue
        ? { ...early.queue, repeat: 'one' as const }
        : undefined,
    };
    expect(mayCrossfadeOut(oneEarly)).toBe(false);
    expect(mayCrossfadeOut(INITIAL_PLAYER_STATE)).toBe(false);
  });
});

describe('Keep playing', () => {
  it('asks only once the last song of the list plays, with repeat off', () => {
    expect(wantsContinuation(playing(['a', 'b'], 'a'))).toBe(false);
    expect(wantsContinuation(playing(['a', 'b'], 'b'))).toBe(true);
    const off = playing(['a', 'b'], 'b', { isContinuationOn: false });
    expect(wantsContinuation(off)).toBe(false);
    const state = playing(['a', 'b'], 'b');
    expect(
      wantsContinuation({
        ...state,
        queue: state.queue ? { ...state.queue, repeat: 'all' } : undefined,
      }),
    ).toBe(false);
  });

  it('appends its draw under the last song, marked as its own', () => {
    const drawn = continuationDrawn(playing(['a', 'b'], 'b'), ['x', 'y']);
    expect(drawn.queue?.trackIds).toEqual(['a', 'b', 'x', 'y']);
    expect(drawn.queue?.order).toEqual([0, 1, 2, 3]);
    expect(isGuessIn(drawn)('x')).toBe(true);
    expect(isGuessIn(drawn)('a')).toBe(false);
  });

  it('takes its draws away when switched off, and leaves the song playing', () => {
    const drawn = continuationDrawn(playing(['a', 'b'], 'b'), ['x', 'y']);
    const off = setContinuation(drawn, false);
    expect(off.queue?.order).toEqual([0, 1]);
    expect(at(off)).toBe('b');
    expect(off.isContinuationOn).toBe(false);
  });

  it('is no longer a guess once the listener picked it', () => {
    const drawn = continuationDrawn(playing(['a', 'b'], 'b'), ['x']);
    const picked = { ...drawn, addedIds: new Set(['x']) };
    expect(isGuessIn(picked)('x')).toBe(false);
  });
});

describe('a restored session', () => {
  it('lets go of its place once the deck has the song cued', () => {
    const restored = playing(['a'], 'a', {
      isPlaying: false,
      restore: { trackId: 'a', positionMs: 12_000 },
    });
    expect(restoreCued(restored, 'b')).toBe(restored);
    expect(restoreCued(restored, 'a').restore).toBeUndefined();
  });
});

describe('repeat', () => {
  it('goes round off, all, one', () => {
    expect(nextRepeat('off')).toBe('all');
    expect(nextRepeat('all')).toBe('one');
    expect(nextRepeat('one')).toBe('off');
  });
});
