/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ILibraryQueue } from '../../../common/library/queue';
import type { ILibraryTrack } from '../../../common/library/types';
import { useUpNext } from '../../../renderer/library/player/useUpNext';

/**
 * Keep playing draws "More like this" only once the last song queued is
 * playing, and only while it is on (Ivan, 2026-10-25: "only when a song
 * reaches its last position it shows more similar things"). It drew with
 * three songs still to come, so a short playlist carried ten strangers
 * under it from its first song.
 */
const queryLibrary = jest.fn();

const trackById = new Map<string, ILibraryTrack>(
  ['a', 'b', 'c'].map((id) => [
    id,
    { id, kind: 'audio', title: id } as unknown as ILibraryTrack,
  ]),
);

const queueAt = (position: number): ILibraryQueue => ({
  trackIds: ['a', 'b', 'c'],
  order: [0, 1, 2],
  position,
  repeat: 'off',
  isShuffled: false,
});

/** The hook over a queue it can change, rendered again with each change. */
const mount = (start: ILibraryQueue) => {
  let queue: ILibraryQueue | undefined = start;
  const setQueue = (
    update: (current: ILibraryQueue | undefined) => ILibraryQueue | undefined,
  ) => {
    queue = update(queue);
  };
  const hook = renderHook(
    ({ current }: { current: ILibraryQueue | undefined }) =>
      useUpNext({
        queue: current,
        trackId: current?.trackIds[current.order[current.position] ?? -1],
        trackById,
        setQueue,
      }),
    {
      initialProps: { current: queue } as {
        current: ILibraryQueue | undefined;
      },
    },
  );
  return {
    hook,
    queue: () => queue,
    redraw: () => hook.rerender({ current: queue }),
  };
};

const continuationAsks = () =>
  queryLibrary.mock.calls.filter(
    ([request]) => request.type === 'continuation',
  );

beforeEach(() => {
  window.localStorage.clear();
  queryLibrary.mockReset();
  queryLibrary.mockResolvedValue(['x', 'y']);
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { queryLibrary },
  };
});

describe('Keep playing', () => {
  it('draws nothing while songs of the list are still to come', async () => {
    mount(queueAt(1));
    await act(async () => undefined);
    expect(continuationAsks()).toHaveLength(0);
  });

  it('draws more like the last song once it is playing, after it', async () => {
    const made = mount(queueAt(2));
    await waitFor(() => expect(continuationAsks()).toHaveLength(1));
    expect(continuationAsks()[0][0]).toMatchObject({ seedId: 'c' });
    await waitFor(() =>
      expect(made.queue()?.trackIds).toEqual(['a', 'b', 'c', 'x', 'y']),
    );
    made.redraw();
    expect(made.hook.result.current.upNext.map((e) => e.isContinued)).toEqual([
      true,
      true,
    ]);
  });

  it('draws nothing while it is switched off', async () => {
    window.localStorage.setItem('fluideq.library.keepPlaying', 'off');
    mount(queueAt(2));
    await act(async () => undefined);
    expect(continuationAsks()).toHaveLength(0);
  });

  it('takes what it drew away when it is switched off', async () => {
    const made = mount(queueAt(2));
    await waitFor(() => expect(made.queue()?.order).toHaveLength(5));
    made.redraw();
    act(() => made.hook.result.current.setIsContinuationOn(false));
    expect(made.queue()?.order).toEqual([0, 1, 2]);
  });
});
