/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the song memories and Smart EQ are told is playing, by the window
 * while it is there and by main while it is not (`nowPlayingFeed.ts`).
 */
import type { ILibraryPlayerView } from '../../../common/library/playerWire';
import { NO_PLAYER_VIEW } from '../../../common/library/playerWire';
import type { ILibraryTrack } from '../../../common/library/types';
import { buildSongIdentity } from '../../../common/songIdentity';
import { createNowPlayingFeed } from '../../../main/nowPlayingFeed';
import type { ISystemMediaSnapshot } from '../../../main/systemMedia';

const spotify = (isPlaying: boolean, title = 'Song'): ISystemMediaSnapshot => ({
  app: 'Spotify.exe',
  title,
  artist: 'Band',
  isPlaying,
  positionMs: 0,
  durationMs: 0,
  canNext: false,
  canPrevious: false,
  canSeek: false,
  playing: isPlaying ? ['Spotify.exe'] : [],
  coverId: '',
});

const track = { id: 't1', title: 'Track', artist: 'Ana' } as ILibraryTrack;

const onHost = (isPlaying: boolean): ILibraryPlayerView => ({
  ...NO_PLAYER_VIEW,
  track,
  deck: 'host',
  isPlaying,
});

const SPOTIFY = buildSongIdentity('system', 'Spotify.exe', 'Song', 'Band');
const LIBRARY = buildSongIdentity('library', 't1', 'Track', 'Ana');

const feed = () => {
  const told = jest.fn();
  return { told, nowPlaying: createNowPlayingFeed(told) };
};

describe('what plays, with no window to say', () => {
  it('names the machine’s player and the Library on its host', () => {
    const { told, nowPlaying } = feed();
    nowPlaying.systemSaid(spotify(true));
    expect(told).toHaveBeenLastCalledWith({
      identity: SPOTIFY,
      isPlaying: true,
      isLibrary: false,
    });

    // A player of ours playing comes first, as it does in the window.
    nowPlaying.libraryViewed(onHost(true));
    expect(told).toHaveBeenLastCalledWith({
      identity: LIBRARY,
      isPlaying: true,
      isLibrary: true,
    });
  });

  it('keeps a pause a pause of what was last heard', () => {
    const { told, nowPlaying } = feed();
    nowPlaying.systemSaid(spotify(true));
    nowPlaying.systemSaid(spotify(false));
    expect(told).toHaveBeenLastCalledWith({
      identity: SPOTIFY,
      isPlaying: false,
      isLibrary: false,
    });
  });

  it('tells each change once, not every reading', () => {
    const { told, nowPlaying } = feed();
    nowPlaying.systemSaid(spotify(true));
    nowPlaying.systemSaid(spotify(true));
    nowPlaying.libraryViewed(NO_PLAYER_VIEW);
    expect(told).toHaveBeenCalledTimes(1);
  });

  it('never counts the page’s own element, which went with the page', () => {
    const { told, nowPlaying } = feed();
    nowPlaying.libraryViewed({ ...onHost(true), deck: 'window' });
    expect(told).toHaveBeenLastCalledWith({
      identity: undefined,
      isPlaying: false,
      isLibrary: false,
    });
  });
});

describe('the window and main taking turns', () => {
  it('lets the page speak for itself while it is there', () => {
    const { told, nowPlaying } = feed();
    const video = buildSongIdentity('media', 'https://v', 'Clip');
    nowPlaying.pageSaid({ identity: video, isPlaying: true, isLibrary: false });
    nowPlaying.systemSaid(spotify(false));
    expect(told).toHaveBeenLastCalledWith({
      identity: video,
      isPlaying: true,
      isLibrary: false,
    });
  });

  it('takes over when the page goes, with what plays now', () => {
    const { told, nowPlaying } = feed();
    nowPlaying.pageSaid({
      identity: SPOTIFY,
      isPlaying: true,
      isLibrary: false,
    });
    nowPlaying.systemSaid(spotify(true, 'Next song'));
    expect(told).toHaveBeenCalledTimes(1);

    nowPlaying.pageLeft();
    expect(told).toHaveBeenLastCalledWith({
      identity: buildSongIdentity('system', 'Spotify.exe', 'Next song', 'Band'),
      isPlaying: true,
      isLibrary: false,
    });
  });

  it('keeps the page’s paused song when the page goes with nothing playing', () => {
    const { told, nowPlaying } = feed();
    const video = buildSongIdentity('media', 'https://v', 'Clip');
    nowPlaying.pageSaid({
      identity: video,
      isPlaying: false,
      isLibrary: false,
    });
    told.mockClear();
    nowPlaying.pageLeft();
    expect(told).not.toHaveBeenCalled();
  });

  it('does not let a page that has heard nothing yet end the song', () => {
    // A window opened from the tray says "nothing" before its players and
    // the media watcher's reading reach it.
    const { told, nowPlaying } = feed();
    nowPlaying.systemSaid(spotify(true));
    told.mockClear();
    nowPlaying.pageSaid({
      identity: undefined,
      isPlaying: false,
      isLibrary: false,
    });
    expect(told).not.toHaveBeenCalled();

    // Once it has named something, its word is its own, a stop included.
    nowPlaying.pageSaid({
      identity: SPOTIFY,
      isPlaying: true,
      isLibrary: false,
    });
    nowPlaying.pageSaid({
      identity: undefined,
      isPlaying: false,
      isLibrary: false,
    });
    expect(told).toHaveBeenLastCalledWith({
      identity: undefined,
      isPlaying: false,
      isLibrary: false,
    });
  });
});
