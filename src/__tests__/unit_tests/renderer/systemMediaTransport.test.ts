/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { act, renderHook } from '@testing-library/react';
import type { ISystemMediaSnapshot } from '../../../main/systemMedia';
import {
  claimPlayback,
  registerPlayer,
  resetPlaybackOwner,
} from '../../../renderer/audio/playbackOwner';
import {
  resetTransportSource,
  useTransportSources,
} from '../../../renderer/audio/transportSource';
import { useSystemMediaSource } from '../../../renderer/audio/useSystemMediaSource';
import { setSinglePlayer } from '../../../renderer/utils/singlePlayer';

describe('the transport for another Windows player', () => {
  const originalElectron = window.electron;
  let publishSnapshot:
    ((snapshot: ISystemMediaSnapshot | undefined) => void) | undefined;
  const sendSystemMediaCommand = jest.fn(() => Promise.resolve());
  const pauseOtherSystemPlayers = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    resetPlaybackOwner();
    resetTransportSource();
    publishSnapshot = undefined;
    sendSystemMediaCommand.mockClear();
    pauseOtherSystemPlayers.mockClear();
    setSinglePlayer(true);
    window.electron = {
      ipcRenderer: {
        watchSystemMedia: () => Promise.resolve(),
        onSystemMedia: (
          listener: (snapshot: ISystemMediaSnapshot | undefined) => void,
        ) => {
          publishSnapshot = listener;
          return () => undefined;
        },
        sendSystemMediaCommand,
        pauseOtherSystemPlayers,
        sendMediaTransport: () => Promise.resolve(),
      },
    } as unknown as typeof window.electron;
  });

  afterEach(() => {
    window.electron = originalElectron;
    resetPlaybackOwner();
    resetTransportSource();
  });

  it('publishes Stop even when the session needs the rewind fallback', () => {
    const hook = renderHook(() => {
      useSystemMediaSource();
      return useTransportSources().system;
    });
    const snapshot: ISystemMediaSnapshot = {
      app: 'Spotify.exe',
      title: 'Song',
      artist: 'Band',
      isPlaying: true,
      positionMs: 12_000,
      durationMs: 180_000,
      canNext: true,
      canPrevious: true,
      canSeek: true,
      playing: ['Spotify.exe'],
    };

    act(() => publishSnapshot?.(snapshot));
    expect(hook.result.current?.stop).toEqual(expect.any(Function));

    act(() => hook.result.current?.stop?.());
    expect(sendSystemMediaCommand).toHaveBeenCalledWith('stop');

    hook.unmount();
  });

  it('quietens the album when a video is started over it', () => {
    // One player at a time where neither player is this app's: Spotify going,
    // a Netflix tab clicked, and nothing used to stop either of them.
    const hook = renderHook(() => useSystemMediaSource());
    const reading = (app: string, playing: string[]): ISystemMediaSnapshot => ({
      app,
      title: 'Song',
      artist: 'Band',
      isPlaying: true,
      positionMs: 0,
      durationMs: 0,
      canNext: false,
      canPrevious: false,
      canSeek: false,
      playing,
    });

    act(() => publishSnapshot?.(reading('Spotify.exe', ['Spotify.exe'])));
    expect(pauseOtherSystemPlayers).not.toHaveBeenCalled();

    act(() =>
      publishSnapshot?.(reading('Spotify.exe', ['Spotify.exe', 'Chrome'])),
    );
    expect(pauseOtherSystemPlayers).toHaveBeenCalledWith('Chrome');

    // And not again while the same one keeps playing: the watcher reports a
    // moving position, and every one of those readings still says playing.
    pauseOtherSystemPlayers.mockClear();
    act(() => publishSnapshot?.(reading('Chrome', ['Spotify.exe', 'Chrome'])));
    expect(pauseOtherSystemPlayers).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('stops the song here when a second program starts behind the first', () => {
    // The bar shows whichever session Windows listed first, so a video
    // started behind a playing Spotify changed nothing about the session the
    // rule was watching, and the song here played straight through it.
    const stopLibrary = jest.fn();
    const hook = renderHook(() => useSystemMediaSource());
    const reading = (playing: string[]): ISystemMediaSnapshot => ({
      app: 'Spotify.exe',
      title: 'Song',
      artist: 'Band',
      isPlaying: true,
      positionMs: 0,
      durationMs: 0,
      canNext: false,
      canPrevious: false,
      canSeek: false,
      playing,
    });

    act(() => {
      registerPlayer('library', stopLibrary);
      claimPlayback('library');
      publishSnapshot?.(reading(['Spotify.exe']));
    });
    stopLibrary.mockClear();

    // The same programs again — a position moving, a queue's next track — is
    // not somebody pressing play, and used to stop the song that had just
    // started here.
    act(() => publishSnapshot?.(reading(['Spotify.exe'])));
    expect(stopLibrary).not.toHaveBeenCalled();

    act(() => publishSnapshot?.(reading(['Spotify.exe', 'Chrome'])));
    expect(stopLibrary).toHaveBeenCalledTimes(1);

    hook.unmount();
  });

  it('leaves both alone when one player at a time is switched off', () => {
    setSinglePlayer(false);
    const hook = renderHook(() => useSystemMediaSource());
    act(() =>
      publishSnapshot?.({
        app: 'Spotify.exe',
        title: 'Song',
        artist: 'Band',
        isPlaying: true,
        positionMs: 0,
        durationMs: 0,
        canNext: false,
        canPrevious: false,
        canSeek: false,
        playing: ['Spotify.exe'],
      }),
    );
    act(() =>
      publishSnapshot?.({
        app: 'Spotify.exe',
        title: 'Song',
        artist: 'Band',
        isPlaying: true,
        positionMs: 0,
        durationMs: 0,
        canNext: false,
        canPrevious: false,
        canSeek: false,
        playing: ['Spotify.exe', 'Chrome'],
      }),
    );
    expect(pauseOtherSystemPlayers).not.toHaveBeenCalled();
    hook.unmount();
  });
});
