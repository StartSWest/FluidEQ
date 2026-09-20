/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { renderHook } from '@testing-library/react';
import { buildQueue, type ILibraryQueue } from '../../../common/library/queue';
import { useQueueControls } from '../../../renderer/library/player/useQueueControls';

/**
 * The queue is re-aimed on every track change as well as on a real change of
 * shelf, and rebuilding the run from the shelf's order on a track change put
 * the shelf's order back — so a row dragged in Up Next went home the moment
 * the song ended. What a listener adds by hand already survived that rebuild
 * by name; the order they put the rest in did not.
 */
const shelf = ['a', 'b', 'c', 'd'];

const controls = () => {
  let queue: ILibraryQueue | undefined = buildQueue(shelf, 'a', false);
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
      continuedIdsRef: { current: new Set<string>() },
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

describe('re-aiming the queue', () => {
  it('keeps an order the listener made when the shelf has not changed', () => {
    const { held, api } = controls();
    expect(upNext(held.queue)).toEqual(['b', 'c', 'd']);

    // Drag the last one to the front of Up Next.
    api().moveUpNext(3, 1);
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);

    // What a track change does: the same shelf arriving again.
    api().retargetQueue(shelf);
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);
    // And again, because the callback runs on every one of them.
    api().retargetQueue(shelf);
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);
  });

  // The positive control. Without it the test above passes just as well for a
  // re-aim that never does anything at all, which would be its own bug: this
  // is the whole point of the callback.
  it('still re-aims when the shelf really is sorted differently', () => {
    const { held, api } = controls();
    api().moveUpNext(3, 1);
    expect(upNext(held.queue)).toEqual(['d', 'b', 'c']);

    api().retargetQueue(['a', 'd', 'c', 'b']);
    expect(upNext(held.queue)).toEqual(['d', 'c', 'b']);
  });
});
