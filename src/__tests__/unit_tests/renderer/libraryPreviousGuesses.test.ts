/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook } from '@testing-library/react';
import type { ILibraryQueue } from '../../../common/library/queue';
import { useTransportControls } from '../../../renderer/library/player/useTransportControls';

/**
 * Previous from the last song puts one of the listener's songs ahead again,
 * and Keep playing's draws go with it: they belong after the last song
 * queued, and only while it plays (Ivan, 2026-10-25).
 */
const mount = (start: ILibraryQueue, drawn: readonly string[]) => {
  let queue: ILibraryQueue | undefined = start;
  const isGuess = (id: string) => drawn.includes(id);
  const hook = renderHook(() =>
    useTransportControls({
      activeElement: () => undefined,
      seekQuietly: () => undefined,
      finishCrossfadeRef: { current: undefined },
      hostOwnsTransportRef: { current: false },
      seekHost: () => undefined,
      // At the top of the song, so Previous steps back rather than rewinds.
      publishedPositionMs: 0,
      setPositionMs: () => undefined,
      setQueue: (update) => {
        queue = update(queue);
      },
      isGuess,
    }),
  );
  return { hook, queue: () => queue };
};

const coming = (queue: ILibraryQueue | undefined) =>
  (queue?.order ?? [])
    .slice((queue?.position ?? 0) + 1)
    .map((index) => queue?.trackIds[index]);

const lastSongWithDraws: ILibraryQueue = {
  trackIds: ['a', 'b', 'x', 'y'],
  order: [0, 1, 2, 3],
  position: 1,
  repeat: 'off',
  isShuffled: false,
};

describe('Previous', () => {
  it('takes Keep playing’s draws away once a song of the list is ahead again', () => {
    const made = mount(lastSongWithDraws, ['x', 'y']);
    act(() => made.hook.result.current.skip(-1));
    expect(made.queue()?.position).toBe(0);
    expect(coming(made.queue())).toEqual(['b']);
  });

  it('leaves them for Next, which only moves on into them', () => {
    const made = mount(lastSongWithDraws, ['x', 'y']);
    act(() => made.hook.result.current.skip(1));
    expect(coming(made.queue())).toEqual(['y']);
  });
});
