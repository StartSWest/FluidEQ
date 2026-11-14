/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook, waitFor } from '@testing-library/react';
import { useCallback, useRef, useState } from 'react';
import { ILibraryQueue, currentTrackId } from '../../../common/library/queue';
import type { ILibraryTrack } from '../../../common/library/types';
import { usePlaybackCommands } from '../../../renderer/library/player/usePlaybackCommands';
import { useSurprise } from '../../../renderer/library/player/useSurprise';
import { useUpNext } from '../../../renderer/library/player/useUpNext';

/**
 * Surprise me through the player's own commands (Ivan, 2026-11-13: "it
 * starts playing any random music, and then Up Next continues with that
 * style"): the real `playTracks`, the real Keep playing, and the store
 * stood in for by answers given per question.
 */
const queryLibrary = jest.fn();
let surprises: (string | null)[] = [];

const IDS = ['a1', 'a2', 'a3', 'p1', 'p2', 'z', 'y', 'm1', 'm2'];
const trackById = new Map<string, ILibraryTrack>(
  IDS.map((id) => [id, { id, kind: 'audio', title: id } as ILibraryTrack]),
);

const record = (ids: string[]): ILibraryQueue => ({
  trackIds: ids,
  order: ids.map((_, index) => index),
  position: 0,
  repeat: 'off',
  isShuffled: false,
});

/** The three hooks the player joins, over one queue. */
const useBench = (start: ILibraryQueue | undefined) => {
  const [queue, setQueueState] = useState(start);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const setQueue = useCallback(
    (
      update: (current: ILibraryQueue | undefined) => ILibraryQueue | undefined,
    ) => setQueueState((current) => update(current)),
    [],
  );
  const upNext = useUpNext({
    queue,
    trackId: queue ? currentTrackId(queue) : undefined,
    trackById,
    setQueue,
  });
  const { playTracks } = usePlaybackCommands({
    activeElement: () => undefined,
    audioElements: [],
    queueRef,
    hostOwnsTransportRef: { current: false },
    setQueue: setQueueState,
    setIsPlaying: () => undefined,
    setRetainWhenHidden: () => undefined,
    setAddedIds: upNext.setAddedIds,
    finishCrossfadeRef: { current: undefined },
    fadeFrameRef: { current: 0 },
    seekHost: () => undefined,
    setPositionMs: () => undefined,
    endedTrackRef: { current: undefined },
    naturalCrossfadeTrackRef: { current: undefined },
    setLoadRequest: () => undefined,
    pendingRestore: { current: undefined },
    audioElementRef: { current: undefined },
  });
  const { surprise, lastSurprise } = useSurprise({
    queueRef,
    addedIdsRef: upNext.addedIdsRef,
    playedIdsRef: upNext.playedIdsRef,
    playTracks,
    setQueue,
    setAddedIds: upNext.setAddedIds,
  });
  return { queue, upNext, surprise, lastSurprise };
};

const asks = (type: string) =>
  queryLibrary.mock.calls
    .map(([request]) => request)
    .filter((request) => request.type === type);

beforeEach(() => {
  window.localStorage.clear();
  surprises = [];
  queryLibrary.mockReset();
  queryLibrary.mockImplementation(async (request: { type: string }) => {
    if (request.type === 'surprise') {
      return surprises.shift() ?? null;
    }
    if (request.type === 'continuation') {
      return ['m1', 'm2'];
    }
    return [];
  });
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { queryLibrary },
  };
});

describe('Surprise me', () => {
  it('plays a song from elsewhere and Up Next carries on from it', async () => {
    surprises = ['z'];
    const bench = renderHook(() => useBench(record(['a1', 'a2', 'a3'])));
    let started: string | null = null;
    await act(async () => {
      started = await bench.result.current.surprise();
    });
    expect(started).toBe('z');
    // What the draw plays for.
    expect(bench.result.current.lastSurprise).toEqual({
      trackId: 'z',
      serial: 1,
    });
    expect(asks('surprise')[0]).toMatchObject({
      playing: 'a1',
      awayFrom: ['a1'],
    });
    expect(asks('surprise')[0].exclude).toEqual(
      expect.arrayContaining(['a1', 'a2', 'a3']),
    );
    await waitFor(() =>
      expect(bench.result.current.queue?.trackIds).toEqual(['z', 'm1', 'm2']),
    );
    // Keep playing seeded from the surprise, not from the record it left.
    expect(asks('continuation')).toHaveLength(1);
    expect(asks('continuation')[0]).toMatchObject({ seedId: 'z' });
    expect(
      bench.result.current.upNext.upNext.map((entry) => entry.isContinued),
    ).toEqual([true, true]);
  });

  it('keeps the listener’s own picks behind it, in their order', async () => {
    surprises = ['z'];
    const bench = renderHook(() => useBench(record(['a1', 'a2', 'p1', 'p2'])));
    act(() => bench.result.current.upNext.setAddedIds(new Set(['p1', 'p2'])));
    await act(async () => {
      await bench.result.current.surprise();
    });
    const { queue, upNext } = bench.result.current;
    expect(queue && currentTrackId(queue)).toBe('z');
    expect(
      upNext.upNext.map((entry) => [entry.trackId, entry.isAdded]),
    ).toEqual([
      ['p1', true],
      ['p2', true],
    ]);
    // The picks are still to come, so Keep playing waits for the last one.
    expect(asks('continuation')).toHaveLength(0);
  });

  it('remembers each surprise and moves the next one away from it', async () => {
    surprises = ['z', 'y'];
    const bench = renderHook(() => useBench(record(['a1', 'a2'])));
    await act(async () => {
      await bench.result.current.surprise();
    });
    await act(async () => {
      await bench.result.current.surprise();
    });
    const second = asks('surprise')[1];
    expect(second.playing).toBe('z');
    expect(second.awayFrom).toEqual(['z']);
    expect(second.exclude).toEqual(expect.arrayContaining(['z', 'a1']));
    expect(
      JSON.parse(
        window.localStorage.getItem('fluideq.library.surprises') ?? '[]',
      ),
    ).toEqual(['z', 'y']);
    expect(bench.result.current.lastSurprise).toEqual({
      trackId: 'y',
      serial: 2,
    });
  });

  it('starts nothing when the library has nothing that can play', async () => {
    surprises = [null];
    const bench = renderHook(() => useBench(record(['a1', 'a2'])));
    let started: string | null = 'not asked';
    await act(async () => {
      started = await bench.result.current.surprise();
    });
    expect(started).toBeNull();
    expect(bench.result.current.queue?.trackIds).toEqual(['a1', 'a2']);
    expect(bench.result.current.lastSurprise).toBeUndefined();
  });

  it('asks the store once for two quick presses', async () => {
    surprises = ['z', 'y'];
    const bench = renderHook(() => useBench(record(['a1'])));
    await act(async () => {
      await Promise.all([
        bench.result.current.surprise(),
        bench.result.current.surprise(),
      ]);
    });
    expect(asks('surprise')).toHaveLength(1);
  });
});
