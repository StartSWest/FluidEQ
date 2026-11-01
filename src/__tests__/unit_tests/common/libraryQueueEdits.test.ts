/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The presses that rearrange what is coming, as the core's Library player
 * runs them (`common/library/queueEdits.ts`, `playerState.ts`). The cases are
 * the ones the window's player was held to before the player moved; only
 * the harness changed.
 *
 * A press aims the queue at the list it was made in (`retargetQueue`), and a
 * change of song only tops it up from that same list (`topUpQueue`) — never
 * from whatever list is on screen, which replaced a playlist started from the
 * amp with the Library's Songs shelf (Ivan, 2026-10-25). The list is handed
 * over as a window around the playing song, which slides on with every song
 * once the list is longer than it, so the list is named and the same list
 * only tops up.
 */
import {
  buildQueue,
  currentTrackId,
  type ILibraryQueue,
} from '../../../common/library/queue';
import {
  INITIAL_PLAYER_STATE,
  type ILibraryPlayerState,
  jumpTo,
  playTracks,
  skip,
} from '../../../common/library/playerState';
import {
  addToQueue,
  moveUpNext,
  removeUpNextAt,
  retargetQueue,
  topUpQueue,
} from '../../../common/library/queueEdits';

const shelf = ['a', 'b', 'c', 'd'];

/** The rules over one state, each press applied to the last. */
const controls = (
  start: ILibraryQueue = buildQueue(shelf, 'a', false),
  continued: readonly string[] = [],
  added: readonly string[] = [],
) => {
  let state: ILibraryPlayerState = {
    ...INITIAL_PLAYER_STATE,
    queue: start,
    isPlaying: true,
    continuedIds: new Set(continued),
    addedIds: new Set(added),
  };
  const held = {
    get queue() {
      return state.queue;
    },
  };
  const api = () => ({
    moveUpNext: (from: number, to: number) => {
      state = moveUpNext(state, from, to);
    },
    removeUpNextAt: (position: number) => {
      state = removeUpNextAt(state, position);
    },
    retargetQueue: (ids: readonly string[], key: string) => {
      state = retargetQueue(state, ids, key);
    },
    topUpQueue: (ids: readonly string[], key: string) => {
      state = topUpQueue(state, ids, key);
    },
    jumpToQueuePosition: (position: number) => {
      state = jumpTo(state, position);
    },
    skip: (direction: 1 | -1) => {
      state = skip(state, direction);
    },
    insertIntoQueue: (ids: readonly string[], beforeIds: readonly string[]) => {
      const result = addToQueue(state, ids, beforeIds);
      state = result.state;
      return result.joined;
    },
    appendToQueue: (ids: readonly string[]) => {
      const result = addToQueue(state, ids);
      state = result.state;
      return result.joined;
    },
  });
  return { held, api, state: () => state };
};

/** The ids in the order they will play, from the playhead onwards. */
const upNext = (queue: ILibraryQueue | undefined) =>
  (queue?.order ?? [])
    .slice((queue?.position ?? 0) + 1)
    .map((index) => queue?.trackIds[index]);

/** Where a song stands in the play order, for moving and jumping by name. */
const at = (queue: ILibraryQueue | undefined, id: string) =>
  (queue?.order ?? []).findIndex((index) => queue?.trackIds[index] === id);

describe('re-aiming the queue', () => {
  it('keeps an order the listener made when the shelf has not changed', () => {
    const { held, api } = controls();
    expect(upNext(held.queue)).toEqual(['b', 'c', 'd']);

    // Drag the last one to the front of Up Next.
    api().moveUpNext(3, 1);
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);

    // The same shelf arriving again, twice.
    api().retargetQueue(shelf, 'songs');
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);
    api().retargetQueue(shelf, 'songs');
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);
  });

  // The positive control: without it the test above passes as well for a
  // re-aim that never does anything at all.
  it('still re-aims when the shelf really is sorted differently', () => {
    const { held, api } = controls();
    api().moveUpNext(3, 1);
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);

    api().retargetQueue(['a', 'd', 'c', 'b'], 'songs by title');
    expect(upNext(held.queue)).toEqual(['d', 'c', 'b']);
  });
});

describe('a long list handed over as a sliding window', () => {
  // Twelve songs, handed over five at a time around the playing one, the way
  // the library's store hands over a list too long to send whole.
  const long = 'abcdefghijkl'.split('');
  const windowAround = (id: string) => {
    const index = long.indexOf(id);
    const from = Math.max(0, index - 2);
    return long.slice(from, from + 5);
  };
  const aimedAt = (id: string, continued: readonly string[] = []) => {
    const made = controls(buildQueue(windowAround(id), id, false), continued);
    made.api().retargetQueue(windowAround(id), 'songs');
    return made;
  };
  const nextSong = ({ held, api }: ReturnType<typeof controls>) => {
    api().jumpToQueuePosition((held.queue?.position ?? 0) + 1);
    const playing = held.queue ? currentTrackId(held.queue) : undefined;
    api().topUpQueue(windowAround(playing ?? ''), 'songs');
  };

  it('keeps the order the listener made as the window slides on', () => {
    const made = aimedAt('c');
    expect(upNext(made.held.queue)).toEqual(['d', 'e']);
    made.api().moveUpNext(at(made.held.queue, 'e'), at(made.held.queue, 'd'));
    expect(upNext(made.held.queue)).toEqual(['e', 'd']);

    // e plays, and the window around it brings f and g: the order made by
    // hand is still there, and what is new joins behind it.
    nextSong(made);
    expect(made.held.queue && currentTrackId(made.held.queue)).toBe('e');
    expect(upNext(made.held.queue)).toEqual(['d', 'f', 'g']);
  });

  it('never brings back a song taken out of Up Next', () => {
    const made = aimedAt('c');
    made.api().removeUpNextAt(at(made.held.queue, 'd'));
    expect(upNext(made.held.queue)).toEqual(['e']);

    nextSong(made);
    expect(upNext(made.held.queue)).toEqual(['f', 'g']);
  });

  it('drops what continuation drew once the list brings more songs', () => {
    const start = buildQueue([...windowAround('c'), 'x', 'y'], 'c', false);
    const made = controls(start, ['x', 'y']);
    made.api().topUpQueue(windowAround('c'), 'songs');
    // Nothing aimed yet, so a top-up asks nothing of it.
    expect(upNext(made.held.queue)).toEqual(['d', 'e', 'x', 'y']);
    made.api().retargetQueue(windowAround('c'), 'songs');
    expect(upNext(made.held.queue)).toEqual(['d', 'e']);

    nextSong(made);
    expect(upNext(made.held.queue)).toEqual(['e', 'f']);
  });

  it('tops a shuffled queue up without reshuffling what it held', () => {
    const made = controls(buildQueue(windowAround('c'), 'c', true));
    made.api().retargetQueue(windowAround('c'), 'songs');
    const before = upNext(made.held.queue);

    nextSong(made);
    const playing = made.held.queue && currentTrackId(made.held.queue);
    const after = upNext(made.held.queue);
    const kept = before.filter((id) => id !== playing);
    expect(after.filter((id) => kept.includes(id))).toEqual(kept);
    const window = windowAround(playing ?? '');
    window
      .filter((id) => id !== playing)
      .forEach((id) => {
        expect(
          made.held.queue?.trackIds.filter((held) => held === id),
        ).toHaveLength(1);
      });
    expect(new Set(made.held.queue?.trackIds)).toEqual(
      new Set([...windowAround('c'), ...window]),
    );
  });

  it('leaves the queue as it was when the window brings nothing new', () => {
    const made = aimedAt('c');
    const before = made.held.queue;
    made.api().retargetQueue(windowAround('c'), 'songs');
    expect(made.held.queue).toBe(before);
  });
});

describe('adding to Up next', () => {
  it('inserts dropped songs before their anchor without changing the playing song', () => {
    const { held, api } = controls();
    expect(api().insertIntoQueue(['x', 'c', 'y', 'x'], ['c', 'd'])).toBe(2);
    expect(upNext(held.queue)).toEqual(['b', 'x', 'y', 'c', 'd']);
    expect(held.queue && currentTrackId(held.queue)).toBe('a');
    expect(api().insertIntoQueue(['x', 'a'], ['b'])).toBe(0);
    expect(upNext(held.queue)).toEqual(['b', 'x', 'y', 'c', 'd']);
  });

  it('retains a drop’s target across intervening playback and queue edits', () => {
    const { held, api } = controls();
    // Captured when a folder was dropped before c; its scan resolves later.
    const beforeIds = ['c', 'd'];
    api().moveUpNext(3, 1);
    api().jumpToQueuePosition(1);
    api().removeUpNextAt(3);
    expect(api().insertIntoQueue(['x', 'y'], beforeIds)).toBe(2);
    expect(upNext(held.queue)).toEqual(['b', 'x', 'y']);
    expect(held.queue && currentTrackId(held.queue)).toBe('d');
  });

  it('puts the songs at the end, says how many joined, and never twice', () => {
    const { held, api } = controls();
    expect(api().appendToQueue(['x', 'c', 'y', 'x'])).toBe(2);
    expect(upNext(held.queue)).toEqual(['b', 'c', 'd', 'x', 'y']);
    // The same songs again, and the one playing: nothing joins.
    expect(api().appendToQueue(['x', 'y', 'a'])).toBe(0);
    expect(upNext(held.queue)).toEqual(['b', 'c', 'd', 'x', 'y']);
  });

  it('remembers what joined by hand, for Up Next to head', () => {
    const made = controls();
    made.api().appendToQueue(['x', 'c']);
    expect([...made.state().addedIds]).toEqual(['x']);
  });

  it('lands after the last song, taking Keep playing’s draws away', () => {
    const { held, api } = controls(
      buildQueue(['a', 'b', 'x', 'y'], 'b', false),
      ['x', 'y'],
    );
    api().appendToQueue(['z']);
    expect(upNext(held.queue)).toEqual(['z']);
  });

  it('starts the list on an empty player, every song of it counted once', () => {
    const empty = { ...INITIAL_PLAYER_STATE };
    const added = addToQueue(empty, ['p', 'q', 'p']);
    expect(added.joined).toBe(2);
    expect(added.state.queue?.trackIds).toEqual(['p', 'q']);
    expect(added.state.isPlaying).toBe(true);
  });
});

describe('a press re-aiming the queue', () => {
  it('keeps what the listener added, at the end, after the new list', () => {
    const { held, api } = controls(
      buildQueue(['a', 'p', 'q'], 'a', false),
      [],
      ['p', 'q'],
    );
    api().retargetQueue(['z', 'a', 'b', 'c'], 'album');
    expect(upNext(held.queue)).toEqual(['b', 'c', 'p', 'q']);
  });

  it('takes the same list twice in the list once', () => {
    const { held, api } = controls(buildQueue(['a'], 'a', false));
    api().retargetQueue(['a', 'b', 'a', 'c', 'b'], 'playlist');
    expect(upNext(held.queue)).toEqual(['b', 'c']);
  });
});

describe('a change of song', () => {
  it('tops up only the list the queue plays, never another one', () => {
    const made = controls();
    made.api().retargetQueue(shelf, 'playlist');
    const aimed = made.held.queue;
    made.api().topUpQueue(['z', 'a', 'y'], 'songs');
    expect(made.held.queue).toBe(aimed);
    made.api().topUpQueue([...shelf, 'e'], 'playlist');
    expect(upNext(made.held.queue)).toEqual(['b', 'c', 'd', 'e']);
  });
});

describe('moving the playhead back', () => {
  const lastSongWithDraws = (): ILibraryQueue =>
    buildQueue(['a', 'b', 'x', 'y'], 'b', false);

  it('drops Keep playing’s draws once the listener’s songs are ahead again', () => {
    const { held, api } = controls(lastSongWithDraws(), ['x', 'y']);
    expect(upNext(held.queue)).toEqual(['x', 'y']);
    api().jumpToQueuePosition(0);
    expect(upNext(held.queue)).toEqual(['b']);
  });

  it('keeps them for a jump within them', () => {
    const { held, api } = controls(
      buildQueue(['a', 'b', 'x', 'y', 'w'], 'b', false),
      ['x', 'y', 'w'],
    );
    api().jumpToQueuePosition(at(held.queue, 'x'));
    expect(upNext(held.queue)).toEqual(['y', 'w']);
  });

  it('takes them away on Previous too', () => {
    const { held, api } = controls(lastSongWithDraws(), ['x', 'y']);
    api().skip(-1);
    expect(held.queue?.position).toBe(0);
    expect(upNext(held.queue)).toEqual(['b']);
  });

  it('leaves them for Next, which only moves on into them', () => {
    const { held, api } = controls(lastSongWithDraws(), ['x', 'y']);
    api().skip(1);
    expect(upNext(held.queue)).toEqual(['y']);
  });
});

describe('playing a list', () => {
  it('queues each song of it once, in the order it first appears', () => {
    const state = playTracks(
      INITIAL_PLAYER_STATE,
      ['a', 'b', 'a', 'c', 'b'],
      'b',
    );
    expect(state.queue?.trackIds).toEqual(['a', 'b', 'c']);
    expect(state.queue && currentTrackId(state.queue)).toBe('b');
  });
});
