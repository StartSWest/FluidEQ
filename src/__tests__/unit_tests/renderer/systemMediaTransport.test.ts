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
import FluidEqTestProvider from '../../utils/FluidEqTestProvider';
import {
  claimPlayback,
  registerPlayer,
  resetPlaybackOwner,
} from '../../../renderer/audio/playbackOwner';
import {
  resetTransportSource,
  useTransportSources,
} from '../../../renderer/audio/transportSource';
import {
  systemBarShows,
  useSystemMediaSource,
} from '../../../renderer/audio/useSystemMediaSource';
import { setSinglePlayer } from '../../../renderer/utils/singlePlayer';

/**
 * A game registers no player with Windows, so while one played the bar said
 * nothing at all. It names the game now — but never over a player that is
 * actually playing, because the bar follows the sound.
 */
describe('what the bar says for this machine’s own sound', () => {
  const session = (isPlaying: boolean) =>
    ({
      title: 'Kind of Blue',
      artist: 'Miles Davis',
      app: 'Spotify',
      isPlaying,
      positionMs: 0,
      durationMs: 1,
      canSeek: false,
      canNext: false,
      canPrevious: false,
      playing: isPlaying ? ['Spotify'] : [],
    }) as unknown as ISystemMediaSnapshot;
  const game = { name: 'Overwatch' };

  it('names the game when nothing else is playing', () => {
    expect(systemBarShows(undefined, game)).toBe('game');
  });

  it('gives the bar to a player that is playing over the game', () => {
    expect(systemBarShows(session(true), game)).toBe('session');
  });

  it('takes the bar from a paused player, which is not what is heard', () => {
    expect(systemBarShows(session(false), game)).toBe('game');
  });

  it('says what it always said with no game at all', () => {
    expect(systemBarShows(session(false), undefined)).toBe('session');
    expect(systemBarShows(undefined, undefined)).toBe('none');
  });
});

/**
 * The app around the hook, as the window gives it: the bar asks which preset
 * is on, and under Equalizer APO that is the Preset layer's, not the rack's.
 */
const withApp = FluidEqTestProvider;

describe('the transport for another Windows player', () => {
  const originalElectron = window.electron;
  let publishSnapshot:
    ((snapshot: ISystemMediaSnapshot | undefined) => void) | undefined;
  const sendSystemMediaCommand = jest.fn(() => Promise.resolve());
  const pauseOtherSystemPlayers = jest.fn(() => Promise.resolve());
  /** Each asked-for cover, answered when a test says so. */
  const coverAnswers = new Map<string, (url: string | undefined) => void>();
  const getSystemMediaCover = jest.fn(
    (id: string) =>
      new Promise<string | undefined>((resolve) => {
        coverAnswers.set(id, resolve);
      }),
  );

  beforeEach(() => {
    resetPlaybackOwner();
    resetTransportSource();
    publishSnapshot = undefined;
    sendSystemMediaCommand.mockClear();
    pauseOtherSystemPlayers.mockClear();
    getSystemMediaCover.mockClear();
    coverAnswers.clear();
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
        getSystemMediaCover,
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
    const hook = renderHook(
      () => {
        useSystemMediaSource();
        return useTransportSources().system;
      },
      { wrapper: withApp },
    );
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
      coverId: '',
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
    const hook = renderHook(() => useSystemMediaSource(), { wrapper: withApp });
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
      coverId: '',
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
    const hook = renderHook(() => useSystemMediaSource(), { wrapper: withApp });
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
      coverId: '',
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
    const hook = renderHook(() => useSystemMediaSource(), { wrapper: withApp });
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
        coverId: '',
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
        coverId: '',
      }),
    );
    expect(pauseOtherSystemPlayers).not.toHaveBeenCalled();
    hook.unmount();
  });

  /**
   * The cover is what the bar's thumbnail and the stage behind an expanded or
   * fullscreen graph draw for another program's song. A reading names it by
   * id and the window asks for the picture once.
   */
  const songWithCover = (title: string, coverId: string) => ({
    app: 'Spotify.exe',
    title,
    artist: 'Coldplay',
    isPlaying: true,
    positionMs: 0,
    durationMs: 200_000,
    canNext: true,
    canPrevious: true,
    canSeek: true,
    playing: ['Spotify.exe'],
    coverId,
  });

  it('shows the cover the player published for the song', async () => {
    const hook = renderHook(
      () => {
        useSystemMediaSource();
        return useTransportSources().system;
      },
      { wrapper: withApp },
    );

    act(() =>
      publishSnapshot?.(songWithCover('Violet Hill', 'aaaaaaaaaaaaaaaa')),
    );
    // The next reading of the same song does not ask again.
    act(() =>
      publishSnapshot?.(songWithCover('Violet Hill', 'aaaaaaaaaaaaaaaa')),
    );
    expect(getSystemMediaCover).toHaveBeenCalledTimes(1);
    expect(hook.result.current?.artworkUrl).toBeUndefined();

    await act(async () => {
      coverAnswers.get('aaaaaaaaaaaaaaaa')?.('data:image/png;base64,AAAA');
    });

    expect(hook.result.current).toMatchObject({
      title: 'Violet Hill',
      artworkUrl: 'data:image/png;base64,AAAA',
    });
    hook.unmount();
  });

  it('never hangs a late cover on the next song', async () => {
    const hook = renderHook(
      () => {
        useSystemMediaSource();
        return useTransportSources().system;
      },
      { wrapper: withApp },
    );

    act(() =>
      publishSnapshot?.(songWithCover('Violet Hill', 'aaaaaaaaaaaaaaaa')),
    );
    act(() => publishSnapshot?.(songWithCover('Yellow', 'bbbbbbbbbbbbbbbb')));
    // The first song's picture arrives after the second has started.
    await act(async () => {
      coverAnswers.get('aaaaaaaaaaaaaaaa')?.('data:image/png;base64,AAAA');
    });

    expect(hook.result.current?.title).toBe('Yellow');
    expect(hook.result.current?.artworkUrl).toBeUndefined();

    await act(async () => {
      coverAnswers.get('bbbbbbbbbbbbbbbb')?.('data:image/png;base64,BBBB');
    });

    expect(hook.result.current?.artworkUrl).toBe('data:image/png;base64,BBBB');
    hook.unmount();
  });
});
