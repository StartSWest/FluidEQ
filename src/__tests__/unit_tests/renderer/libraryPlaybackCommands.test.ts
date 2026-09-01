/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { ILibraryQueue } from '../../../common/library/queue';
import {
  claimPlayback,
  getPlaybackOwner,
  resetPlaybackOwner,
  stopAllPlayback,
} from '../../../renderer/audio/playbackOwner';
import { usePlaybackCommands } from '../../../renderer/library/player/usePlaybackCommands';

const renderNativeLibrary = () => {
  const element = {
    paused: true,
    pause: jest.fn(),
  } as unknown as HTMLAudioElement;

  const rendered = renderHook(() => {
    const [queue, setQueue] = useState<ILibraryQueue | undefined>(undefined);
    const [isPlaying, setIsPlaying] = useState(true);
    const [, setRetainWhenHidden] = useState(false);
    const [, setAddedIds] = useState<ReadonlySet<string>>(new Set());
    const [, setLoadRequest] = useState(0);
    const [, setPositionMs] = useState(0);
    const queueRef = useRef<ILibraryQueue | undefined>(queue);
    queueRef.current = queue;
    const hostOwnsTransportRef = useRef(true);
    const pendingRestore = useRef<
      { trackId: string; positionMs: number } | undefined
    >(undefined);
    const audioElementRef = useRef<HTMLAudioElement | undefined>(element);
    const finishCrossfadeRef = useRef<(() => void) | undefined>(undefined);
    const fadeFrameRef = useRef(0);
    const volumeRef = useRef(1);
    const endedTrackRef = useRef<string | undefined>(undefined);
    const naturalCrossfadeTrackRef = useRef<string | undefined>(undefined);

    usePlaybackCommands({
      activeElement: () => element,
      audioElements: [element],
      queueRef,
      hostOwnsTransportRef,
      setQueue,
      setIsPlaying,
      setRetainWhenHidden,
      setAddedIds,
      finishCrossfadeRef,
      fadeFrameRef,
      seekHost: () => {},
      setPositionMs,
      volumeRef,
      endedTrackRef,
      naturalCrossfadeTrackRef,
      setLoadRequest,
      pendingRestore,
      audioElementRef,
    });

    return { isPlaying };
  });

  return { ...rendered, element };
};

describe('native Library playback ownership', () => {
  beforeEach(() => resetPlaybackOwner());

  it('pauses the native transport when Online Media starts', () => {
    const { result, element } = renderNativeLibrary();
    act(() => claimPlayback('library'));
    expect(result.current.isPlaying).toBe(true);

    act(() => claimPlayback('media'));

    expect(result.current.isPlaying).toBe(false);
    expect(element.pause).not.toHaveBeenCalled();
    expect(getPlaybackOwner()).toBe('media');
  });

  it('pauses the native transport when an outside player starts', () => {
    const { result } = renderNativeLibrary();
    act(() => claimPlayback('library'));
    expect(result.current.isPlaying).toBe(true);

    act(() => stopAllPlayback());

    expect(result.current.isPlaying).toBe(false);
    expect(getPlaybackOwner()).toBeUndefined();
  });
});
