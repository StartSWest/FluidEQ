/* FluidEQ — GPL-3.0-or-later */

/**
 * The song a linked computer plays, carried to the listener's Auto EQ.
 *
 * The sender adds a Library song's album tags to the now-playing message it
 * already sends — once per change, to the computers it already tells — and
 * the listener's remote source carries an identity built from them, which is
 * Auto EQ's now-playing while that computer's sound plays here
 * (`useNowPlayingIdentity`). What the listener then does with it is
 * `sharedSongSound.test.ts`.
 */

import { act, renderHook } from '@testing-library/react';
import type { IRemoteNowPlaying } from 'common/remoteAudio';
import { libraryTrackIdentity } from 'common/songIdentity';
import {
  claimPlayback,
  resetPlaybackOwner,
} from 'renderer/audio/playbackOwner';
import { useNowPlayingIdentity } from 'renderer/audio/nowPlayingIdentity';
import {
  resetTransportSource,
  setTransportSource,
} from 'renderer/audio/transportSource';
import type { ITransportSource } from 'renderer/audio/transportSource';
import type { IRemoteAudioComputer } from 'renderer/remoteAudio/remoteAudioState';
import useRemoteNowPlayingBroadcast from 'renderer/remoteAudio/useRemoteNowPlayingBroadcast';
import useRemoteNowPlayingSource from 'renderer/remoteAudio/useRemoteNowPlayingSource';
import usePublishedTransport from 'renderer/library/player/usePublishedTransport';
import type { ILibraryTrack } from 'common/library/types';

const sendRemoteAudioLanSignal = jest.fn();

beforeEach(() => {
  sendRemoteAudioLanSignal.mockReset().mockResolvedValue(undefined);
  resetTransportSource();
  resetPlaybackOwner();
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        sendRemoteAudioLanSignal,
        sendSystemMediaCommand: jest.fn(),
        pauseOtherSystemPlayers: jest.fn().mockResolvedValue(undefined),
      },
    },
  });
});

const sent = (): IRemoteNowPlaying[] =>
  sendRemoteAudioLanSignal.mock.calls
    .map((call) => call[0]?.signal)
    .filter((signal) => signal?.kind === 'now-playing')
    .map((signal) => signal.playing)
    // The empty bar the sender describes as it mounts.
    .filter((playing) => playing !== undefined);

describe('the sending computer', () => {
  it('sends what its Library player publishes: the album tags, never the file', () => {
    const track: ILibraryTrack = {
      id: 'hash-of-the-path',
      rootId: 'root',
      path: 'C:\\Users\\someone\\Music\\Kind of Blue\\02 Freddie.flac',
      kind: 'audio',
      isPlayable: true,
      title: 'Freddie Freeloader',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
      albumArtist: 'Miles Davis',
      sizeBytes: 1,
      mtimeMs: 1,
      addedAt: 1,
    };
    // Stable, as the Library player's own are: the hook publishes again
    // whenever one of them changes.
    const player = {
      track,
      isPlaying: true,
      retainWhenHidden: false,
      publishedPositionMs: 0,
      publishedDurationMs: 0,
      toggle: () => undefined,
      skip: () => undefined,
      isUnplayable: false,
      seek: () => undefined,
      surprise: async () => null,
    };
    renderHook(() => {
      usePublishedTransport(player);
      useRemoteNowPlayingBroadcast(['listener']);
    });
    act(() => claimPlayback('library'));
    expect(sent()[sent().length - 1]).toMatchObject({
      title: 'Freddie Freeloader',
      artist: 'Miles Davis',
      library: { album: 'Kind of Blue', albumArtist: 'Miles Davis' },
    });
    expect(JSON.stringify(sendRemoteAudioLanSignal.mock.calls)).not.toMatch(
      /someone|flac|hash-of-the-path|root/,
    );
  });

  const librarySource = (
    title: string,
    album: string | undefined,
    positionMs = 0,
  ): ITransportSource => ({
    owner: 'library',
    title,
    subtitle: 'Miles Davis',
    isPlaying: true,
    positionMs,
    durationMs: 300_000,
    toggle: () => undefined,
    identity: libraryTrackIdentity({
      id: `C:\\Music\\${title}.flac`,
      title,
      artist: 'Miles Davis',
      album,
      kind: 'audio',
    }),
    librarySong: album === undefined ? {} : { album },
  });
  const renderSender = (peers: readonly string[] = ['listener']) =>
    renderHook(
      ({ ids }: { ids: readonly string[] }) =>
        useRemoteNowPlayingBroadcast(ids),
      { initialProps: { ids: peers } },
    );
  /** Played the way the Library plays: it claims playback as it starts. */
  const play = (source: ITransportSource) => {
    setTransportSource(source);
    claimPlayback(source.owner);
  };

  it('tells a Library song’s album, and never its path or track id', () => {
    renderSender();
    act(() => play(librarySource('Blue in Green', 'Kind of Blue')));
    const [told] = sent();
    expect(told).toMatchObject({
      title: 'Blue in Green',
      artist: 'Miles Davis',
      library: { album: 'Kind of Blue' },
    });
    expect(JSON.stringify(sendRemoteAudioLanSignal.mock.calls)).not.toMatch(
      /Music|flac|C:/,
    );
  });

  it('tells no album for a player that is not its Library', () => {
    renderSender();
    act(() =>
      setTransportSource({
        ...librarySource('Blue in Green', 'Kind of Blue'),
        owner: 'system',
      }),
    );
    expect(sent()).toHaveLength(1);
    expect(sent()[0]?.library).toBeUndefined();
  });

  it('says it again only when the song or its album changes', () => {
    renderSender();
    act(() => play(librarySource('Blue in Green', 'Kind of Blue')));
    // The position moving inside the same second is not news.
    act(() => play(librarySource('Blue in Green', 'Kind of Blue', 400)));
    act(() => play(librarySource('Blue in Green', 'Kind of Blue', 800)));
    expect(sent()).toHaveLength(1);
    // The same name on another album is another song.
    act(() => play(librarySource('Blue in Green', 'Live 1965', 800)));
    expect(sent()).toHaveLength(2);
    expect(sent()[1]?.library).toEqual({ album: 'Live 1965' });
  });

  it('tells nobody while no computer is linked to hear it', () => {
    renderSender([]);
    act(() => play(librarySource('Blue in Green', 'Kind of Blue')));
    expect(sendRemoteAudioLanSignal).not.toHaveBeenCalled();
  });
});

describe('the listening computer', () => {
  const described = (
    title: string,
    library?: IRemoteNowPlaying['library'],
  ): IRemoteNowPlaying => ({
    title,
    subtitle: 'Miles Davis',
    artist: 'Miles Davis',
    ...(library ? { library } : {}),
    isPlaying: true,
    positionMs: 1000,
    durationMs: 300_000,
    canNext: true,
    canPrevious: true,
    canStep: true,
    canStop: false,
  });
  const office = (nowPlaying?: IRemoteNowPlaying): IRemoteAudioComputer => ({
    id: 'office-peer',
    name: 'OFFICE-PC',
    nowPlaying,
  });
  /** This computer's Library holds the same album. */
  const kindOfBlue = libraryTrackIdentity({
    id: 'ours',
    title: 'So What',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    kind: 'audio',
  })?.albumKey;

  const renderListener = (computers: IRemoteAudioComputer[]) =>
    renderHook(
      ({ list }: { list: IRemoteAudioComputer[] }) => {
        useRemoteNowPlayingSource(list, [], {});
        return useNowPlayingIdentity();
      },
      { initialProps: { list: computers } },
    );

  it('makes the shared song Auto EQ’s now-playing, with this Library’s album', () => {
    const { result } = renderListener([
      office(described('Blue in Green', { album: 'Kind of Blue' })),
    ]);
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.identity).toMatchObject({
      source: 'remote',
      title: 'Blue in Green',
      fromLinkedLibrary: true,
      albumKey: kindOfBlue,
    });
  });

  it('follows the sender’s songs as they change, the last one standing', () => {
    const { result, rerender } = renderListener([
      office(described('Blue in Green', { album: 'Kind of Blue' })),
    ]);
    act(() =>
      rerender({
        list: [office(described('So What', { album: 'Kind of Blue' }))],
      }),
    );
    act(() =>
      rerender({ list: [office(described('Solar', { album: 'Walkin' }))] }),
    );
    expect(result.current.identity).toMatchObject({ title: 'Solar' });
    expect(result.current.identity?.albumKey).not.toBe(kindOfBlue);
  });

  it('hands Auto EQ back to this computer’s own player the moment the stream stops', () => {
    const { result, rerender } = renderListener([
      office(described('Blue in Green', { album: 'Kind of Blue' })),
    ]);
    act(() =>
      setTransportSource({
        owner: 'system',
        title: 'Local song',
        isPlaying: false,
        positionMs: 0,
        durationMs: 0,
        toggle: () => undefined,
      }),
    );
    // The link paused, dropped or stopped sending: it is no longer among the
    // computers heard here.
    act(() => rerender({ list: [] }));
    expect(result.current.identity).toBeUndefined();
    expect(result.current.isPlaying).toBe(false);
    act(() =>
      setTransportSource({
        owner: 'system',
        title: 'Local song',
        subtitle: 'Local artist',
        isPlaying: true,
        positionMs: 0,
        durationMs: 0,
        toggle: () => undefined,
        identity: {
          key: 'system:player:local song:local artist',
          title: 'Local song',
          artist: 'Local artist',
          source: 'system',
        },
      }),
    );
    expect(result.current.identity?.source).toBe('system');
  });

  it('drops the song when the sender’s bar empties', () => {
    const { result, rerender } = renderListener([
      office(described('Blue in Green', { album: 'Kind of Blue' })),
    ]);
    act(() => rerender({ list: [office(undefined)] }));
    expect(result.current.identity).toBeUndefined();
  });

  it('has no album from a sender older than 2.6, and the song as before', () => {
    const { result } = renderListener([office(described('Blue in Green'))]);
    expect(result.current.identity).toMatchObject({
      source: 'remote',
      title: 'Blue in Green',
    });
    expect(result.current.identity?.albumKey).toBeUndefined();
    expect(result.current.identity?.fromLinkedLibrary).toBeUndefined();
  });
});
