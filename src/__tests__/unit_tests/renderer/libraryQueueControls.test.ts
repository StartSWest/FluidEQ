/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { renderHook } from '@testing-library/react';
import {
  buildQueue,
  currentTrackId,
  type ILibraryQueue,
} from '../../../common/library/queue';
import { useQueueControls } from '../../../renderer/library/player/useQueueControls';

/**
 * The queue is re-aimed on every track change as well as on a real change of
 * shelf, and rebuilding the run from the shelf's order on a track change put
 * the shelf's order back — so a row dragged in Up Next went home the moment
 * the song ended. What a listener adds by hand already survived that rebuild
 * by name; the order they put the rest in did not.
 *
 * The library then began handing its list over as a window around the playing
 * song, which slides on with every song once the list is longer than it, and
 * the same bug came back on every long list: a slid window compared as a
 * changed shelf. The list is named now, and the same list only tops up.
 */
const shelf = ['a', 'b', 'c', 'd'];

const controls = (
  start: ILibraryQueue = buildQueue(shelf, 'a', false),
  continued: readonly string[] = [],
) => {
  let queue: ILibraryQueue | undefined = start;
  const held = {
    get queue() {
      return queue;
    },
  };
  const setQueue = (
    update: (current: ILibraryQueue | undefined) => ILibraryQueue | undefined,
  ) => {
    queue = update(queue);
  };
  const hook = renderHook(() =>
    useQueueControls({
      setQueue,
      queueRef: {
        get current() {
          return queue;
        },
        set current(next) {
          queue = next;
        },
      },
      addedIdsRef: { current: new Set<string>() },
      continuedIdsRef: { current: new Set<string>(continued) },
      setAddedIds: () => undefined,
      playTracks: () => undefined,
    }),
  );
  return { held, api: () => hook.result.current };
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

    // What a track change does: the same shelf arriving again.
    api().retargetQueue(shelf, 'songs');
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);
    // And again, because the callback runs on every one of them.
    api().retargetQueue(shelf, 'songs');
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);
  });

  // The positive control. Without it the test above passes just as well for a
  // re-aim that never does anything at all, which would be its own bug: this
  // is the whole point of the callback.
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
  /** Aimed at the list around `id` the way the Library does, then played on
   * to the next entry of the play order, which asks for the list again. */
  const aimedAt = (id: string, continued: readonly string[] = []) => {
    const start = buildQueue(windowAround(id), id, false);
    const made = controls(start, continued);
    made.api().retargetQueue(windowAround(id), 'songs');
    return made;
  };
  const nextSong = ({ held, api }: ReturnType<typeof controls>) => {
    api().jumpToQueuePosition((held.queue?.position ?? 0) + 1);
    const playing = held.queue ? currentTrackId(held.queue) : undefined;
    api().retargetQueue(windowAround(playing ?? ''), 'songs');
  };

  it('keeps the order the listener made as the window slides on', () => {
    const made = aimedAt('c');
    expect(upNext(made.held.queue)).toEqual(['d', 'e']);
    // Drag e in front of d.
    made.api().moveUpNext(at(made.held.queue, 'e'), at(made.held.queue, 'd'));
    expect(upNext(made.held.queue)).toEqual(['e', 'd']);

    // e plays, and the window around it brings f and g: the order made by
    // hand is still there, and what is new joins behind it. Rebuilt from
    // the window, as it was, d was simply gone.
    nextSong(made);
    expect(made.held.queue && currentTrackId(made.held.queue)).toBe('e');
    expect(upNext(made.held.queue)).toEqual(['d', 'f', 'g']);
  });

  it('never brings back a song taken out of Up Next', () => {
    const made = aimedAt('c');
    made.api().removeUpNextAt(at(made.held.queue, 'd'));
    expect(upNext(made.held.queue)).toEqual(['e']);

    nextSong(made);
    // e is playing; f and g are new, d was taken out and stays out.
    expect(upNext(made.held.queue)).toEqual(['f', 'g']);
  });

  it('keeps what continuation drew after all of the list', () => {
    const start = buildQueue([...windowAround('c'), 'x', 'y'], 'c', false);
    const made = controls(start, ['x', 'y']);
    made.api().retargetQueue([...windowAround('c'), 'x', 'y'], 'songs');
    expect(upNext(made.held.queue)).toEqual(['d', 'e', 'x', 'y']);

    nextSong(made);
    expect(upNext(made.held.queue)).toEqual(['e', 'f', 'x', 'y']);
  });

  it('tops a shuffled queue up without reshuffling what it held', () => {
    const start = buildQueue(windowAround('c'), 'c', true);
    const made = controls(start);
    made.api().retargetQueue(windowAround('c'), 'songs');
    const before = upNext(made.held.queue);

    nextSong(made);
    const playing = made.held.queue && currentTrackId(made.held.queue);
    const after = upNext(made.held.queue);
    // What was ahead is still ahead, in the order it was dealt.
    const kept = before.filter((id) => id !== playing);
    expect(after.filter((id) => kept.includes(id))).toEqual(kept);
    // Each song of the new window is there once, and nothing else joined.
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
