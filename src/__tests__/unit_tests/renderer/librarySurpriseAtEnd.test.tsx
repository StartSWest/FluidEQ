/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import type { ILibraryQueue } from 'common/library/queue';
import type { ILibraryTrack } from 'common/library/types';
import en from 'common/i18n/en';
import useTrackEnd from 'renderer/library/player/useTrackEnd';
import {
  surprisesAtEnd,
  useSurpriseAtEnd,
} from 'renderer/library/player/useSurpriseAtEnd';
import { LibraryUpNextFoot } from 'renderer/library/LibraryUpNextControls';

/**
 * Surprise me presses itself when the last song ends with nothing after it
 * (Ivan, 2026-11-14): the same press as the button, part of Keep playing,
 * never after a film, and a library with nothing to play stops as before.
 */

const mockReleasePlayback = jest.fn();
jest.mock('renderer/audio/playbackOwner', () => ({
  releasePlayback: (...args: unknown[]) => mockReleasePlayback(...args),
}));

const mockSession = {
  isContinuationOn: true,
  track: undefined as ILibraryTrack | undefined,
  repeat: 'off' as 'off' | 'all' | 'one',
  surprise: jest.fn<Promise<string | null>, []>(),
};
jest.mock('renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayerSession: () => mockSession,
}));

const track = (id: string, kind: ILibraryTrack['kind']): ILibraryTrack => ({
  id,
  rootId: 'r1',
  path: `C:\\Music\\${id}`,
  kind,
  isPlayable: true,
  title: id,
  album: 'Album',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
});

afterEach(() => {
  cleanup();
  mockReleasePlayback.mockClear();
});

describe('which ends Surprise me answers', () => {
  it('a song with Keep playing on', () => {
    expect(surprisesAtEnd({ isContinuationOn: true, endedKind: 'audio' })).toBe(
      true,
    );
  });

  it('never with Keep playing off, the listener asking for the list to end', () => {
    expect(
      surprisesAtEnd({ isContinuationOn: false, endedKind: 'audio' }),
    ).toBe(false);
  });

  it('never after a film, nor a song it cannot name', () => {
    expect(surprisesAtEnd({ isContinuationOn: true, endedKind: 'video' })).toBe(
      false,
    );
    expect(
      surprisesAtEnd({ isContinuationOn: true, endedKind: undefined }),
    ).toBe(false);
  });
});

describe('the end of the list pressing Surprise me', () => {
  const tracks = new Map([
    ['song', track('song', 'audio')],
    ['film', track('film', 'video')],
  ]);
  const setUp = (picked: string | null, isContinuationOn = true) => {
    const surprise = jest.fn(() => Promise.resolve(picked));
    const stop = jest.fn();
    const { result } = renderHook(() =>
      useSurpriseAtEnd({ isContinuationOn, trackById: tracks, surprise, stop }),
    );
    return { carryOn: result.current, surprise, stop };
  };

  it('asks once, carries on, and leaves the player playing the surprise', async () => {
    const { carryOn, surprise, stop } = setUp('another');
    await act(async () => {
      expect(carryOn('song')).toBe(true);
    });
    expect(surprise).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
  });

  it('stops as before when the library has nothing it can play (the control)', async () => {
    const { carryOn, surprise, stop } = setUp(null);
    await act(async () => {
      expect(carryOn('song')).toBe(true);
    });
    expect(surprise).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('leaves a film’s end and a switched-off Keep playing to stop', () => {
    const film = setUp('another');
    expect(film.carryOn('film')).toBe(false);
    expect(film.surprise).not.toHaveBeenCalled();
    const off = setUp('another', false);
    expect(off.carryOn('song')).toBe(false);
    expect(off.surprise).not.toHaveBeenCalled();
  });
});

describe('the player at the end of its list', () => {
  const queueOf = (
    repeat: ILibraryQueue['repeat'],
    position: number,
  ): ILibraryQueue => ({
    trackIds: ['a', 'b'],
    order: [0, 1],
    position,
    repeat,
    isShuffled: false,
  });
  const setUp = (queue: ILibraryQueue, carries: boolean) => {
    const element = { currentTime: 180 } as unknown as HTMLAudioElement;
    const carryOn = jest.fn(() => carries);
    const setIsPlaying = jest.fn();
    const setRetainWhenHidden = jest.fn();
    const { result } = renderHook(() =>
      useTrackEnd({
        queueRef: { current: queue },
        setQueue: jest.fn(),
        setIsPlaying,
        setRetainWhenHidden,
        trackIdRef: { current: 'b' },
        audioElementRef: { current: element },
        endedTrackRef: { current: undefined },
        naturalCrossfadeTrackRef: { current: undefined },
        programmeEdgesRef: { current: new Map() },
        hostOwnsTransportRef: { current: true },
        seekHost: jest.fn(),
        hostEnded: false,
        dspSettings: DSP_DEFAULTS,
        publishedPositionMs: 0,
        publishedDurationMs: 180_000,
        carryOnRef: { current: carryOn },
      }),
    );
    result.current(element);
    return { carryOn, setIsPlaying, setRetainWhenHidden };
  };

  it('does not stop when something carries on, and keeps playing hidden', () => {
    const { carryOn, setIsPlaying, setRetainWhenHidden } = setUp(
      queueOf('off', 1),
      true,
    );
    expect(carryOn).toHaveBeenCalledWith('b');
    expect(setIsPlaying).not.toHaveBeenCalledWith(false);
    expect(mockReleasePlayback).not.toHaveBeenCalled();
    expect(setRetainWhenHidden).toHaveBeenCalledWith(true);
  });

  it('stops when nothing carries on (the control)', () => {
    const { setIsPlaying } = setUp(queueOf('off', 1), false);
    expect(setIsPlaying).toHaveBeenCalledWith(false);
    expect(mockReleasePlayback).toHaveBeenCalledWith('library');
  });

  it('never asks while songs remain, or while repeat wraps the list', () => {
    expect(setUp(queueOf('off', 0), true).carryOn).not.toHaveBeenCalled();
    expect(setUp(queueOf('all', 1), true).carryOn).not.toHaveBeenCalled();
  });
});

describe('Up Next saying the next song will be a surprise', () => {
  beforeEach(() => {
    mockSession.isContinuationOn = true;
    mockSession.repeat = 'off';
    mockSession.track = track('song', 'audio');
  });

  it('says so while the last song plays with nothing after it', () => {
    render(<LibraryUpNextFoot isQueueEmpty />);
    expect(screen.getByText(en['library.upNext.surpriseNext'])).toBeVisible();
  });

  it('says what the button does instead when the end would just stop (the control)', () => {
    mockSession.isContinuationOn = false;
    render(<LibraryUpNextFoot isQueueEmpty />);
    expect(screen.queryByText(en['library.upNext.surpriseNext'])).toBeNull();
    expect(screen.getByText(en['library.upNext.surpriseStart'])).toBeVisible();
  });

  it('says nothing of it under a film or with repeat on', () => {
    mockSession.track = track('film', 'video');
    const { unmount } = render(<LibraryUpNextFoot isQueueEmpty />);
    expect(screen.queryByText(en['library.upNext.surpriseNext'])).toBeNull();
    unmount();
    mockSession.track = track('song', 'audio');
    mockSession.repeat = 'all';
    render(<LibraryUpNextFoot isQueueEmpty />);
    expect(screen.queryByText(en['library.upNext.surpriseNext'])).toBeNull();
  });
});
