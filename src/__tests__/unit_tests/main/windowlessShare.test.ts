/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import {
  NO_PLAYER_VIEW,
  type ILibraryPlayerView,
} from '../../../common/library/playerWire';
import type { ILibraryTrack } from '../../../common/library/types';
import type {
  ILanRemoteAudioSignal,
  IRemoteNowPlaying,
} from '../../../common/remoteAudio';
import {
  createWindowlessShare,
  type IWindowlessPeer,
} from '../../../main/shareAudio/windowlessShare';
import type { ISystemMediaSnapshot } from '../../../main/systemMedia';

/**
 * Share Audio with the window let go in the tray: what plays here told to
 * the linked computers, their presses carried out here, and one player at a
 * time across the wire — main's, by the window's rules, so a link no longer
 * keeps the whole window loaded.
 */

const track: ILibraryTrack = {
  id: 't1',
  rootId: 'r',
  path: 'C:\\music\\song.flac',
  kind: 'audio',
  isPlayable: true,
  title: 'Song',
  artist: 'Band',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
};

const playingSong = (isPlaying: boolean): ILibraryPlayerView => ({
  ...NO_PLAYER_VIEW,
  track,
  isPlaying,
  deck: 'host',
});

const media = (isPlaying: boolean): ISystemMediaSnapshot => ({
  app: 'Spotify.exe',
  title: 'Tune',
  artist: 'Singer',
  isPlaying,
  positionMs: 30_000,
  durationMs: 200_000,
  canNext: true,
  canPrevious: true,
  canSeek: true,
  playing: isPlaying ? ['Spotify.exe'] : [],
  coverId: '',
});

const theirSong = (isPlaying: boolean): IRemoteNowPlaying => ({
  title: 'Theirs',
  isPlaying,
  positionMs: 0,
  durationMs: 100_000,
  canNext: false,
  canPrevious: false,
  canStep: false,
  canStop: false,
});

const linkedPeer = (id: string, overrides: Partial<IWindowlessPeer> = {}) => ({
  id,
  paused: false,
  heardHere: true,
  joined: true,
  ...overrides,
});

const setUp = (singlePlayer = true) => {
  const sent: ILanRemoteAudioSignal[] = [];
  const deps = {
    send: (message: ILanRemoteAudioSignal) => sent.push(message),
    library: jest.fn(),
    system: jest.fn(),
    pauseOtherPlayers: jest.fn(),
    isSinglePlayer: () => singlePlayer,
    setSinglePlayer: jest.fn(),
  };
  const share = createWindowlessShare(deps);
  // The page was there and has just gone: this decides from here.
  share.pageSaid();
  share.pageLeft();
  const nowPlaying = () =>
    sent.filter(({ signal }) => signal.kind === 'now-playing');
  const pausesTo = () =>
    sent
      .filter(
        ({ signal }) =>
          signal.kind === 'transport' && signal.command === 'pause',
      )
      .map(({ peerId }) => peerId);
  return { share, deps, sent, nowPlaying, pausesTo };
};

describe('this computer’s player, told to the linked computers', () => {
  it('a song started here is a press, and pauses the computers playing here', () => {
    const { share, nowPlaying, pausesTo } = setUp();
    share.linked([linkedPeer('a'), linkedPeer('b')]);
    share.heard({
      peerId: 'a',
      signal: { kind: 'now-playing', playing: theirSong(true) },
    });

    share.libraryViewed(playingSong(true));

    const told = nowPlaying().filter(
      ({ signal }) =>
        signal.kind === 'now-playing' && signal.playing?.title === 'Song',
    );
    expect(told.map(({ peerId }) => peerId)).toEqual(['a', 'b']);
    told.forEach(({ signal }) =>
      expect(signal).toMatchObject({ started: true }),
    );
    expect(pausesTo()).toEqual(['a']);
  });

  it('what was already playing when the page left is told, never as a press', () => {
    const sent: ILanRemoteAudioSignal[] = [];
    const share = createWindowlessShare({
      send: (message) => sent.push(message),
      library: jest.fn(),
      system: jest.fn(),
      pauseOtherPlayers: jest.fn(),
      isSinglePlayer: () => true,
      setSinglePlayer: jest.fn(),
    });
    share.pageSaid();
    share.linked([linkedPeer('a')]);
    share.libraryViewed(playingSong(true));
    // The page decides while it is there.
    expect(sent).toHaveLength(0);

    share.pageLeft();
    expect(sent).toHaveLength(1);
    expect(sent[0].signal).toMatchObject({
      kind: 'now-playing',
      playing: { title: 'Song', isPlaying: true },
    });
    expect(sent[0].signal).not.toHaveProperty('started');
  });

  it('says it again at most once a second, and to a paused link never', () => {
    const { share, nowPlaying } = setUp();
    share.linked([linkedPeer('a'), linkedPeer('p', { paused: true })]);
    share.libraryViewed(playingSong(true));
    share.libraryClock({ trackId: 't1', positionMs: 1_000, durationMs: 9_000 });
    const before = nowPlaying().length;
    share.libraryClock({ trackId: 't1', positionMs: 1_400, durationMs: 9_000 });
    expect(nowPlaying()).toHaveLength(before);
    share.libraryClock({ trackId: 't1', positionMs: 2_000, durationMs: 9_000 });
    expect(nowPlaying()).toHaveLength(before + 1);
    expect(nowPlaying().some(({ peerId }) => peerId === 'p')).toBe(false);
  });
});

describe('a press on a linked computer', () => {
  it('stops the Library and the machine’s players, and pauses the others', () => {
    const { share, deps, pausesTo } = setUp();
    share.linked([linkedPeer('a'), linkedPeer('b')]);
    share.libraryViewed(playingSong(true));
    share.systemSaid(media(true));
    share.heard({
      peerId: 'b',
      signal: { kind: 'now-playing', playing: theirSong(true) },
    });

    share.heard({
      peerId: 'a',
      signal: { kind: 'now-playing', playing: theirSong(true), started: true },
    });

    expect(deps.library).toHaveBeenCalledWith({
      kind: 'setPlaying',
      isPlaying: false,
    });
    expect(deps.pauseOtherPlayers).toHaveBeenCalled();
    expect(pausesTo()).toContain('b');
    expect(pausesTo()).not.toContain('a');
  });

  it('stops nothing with the one-player switch off', () => {
    // POSITIVE CONTROL for the case above: the same press, switch off.
    const { share, deps } = setUp(false);
    share.linked([linkedPeer('a')]);
    share.libraryViewed(playingSong(true));
    share.heard({
      peerId: 'a',
      signal: { kind: 'now-playing', playing: theirSong(true), started: true },
    });
    expect(deps.library).not.toHaveBeenCalled();
  });

  it('stops nothing from a paused link, or while the page decides', () => {
    const { share, deps } = setUp();
    share.linked([linkedPeer('a', { paused: true })]);
    share.libraryViewed(playingSong(true));
    share.heard({
      peerId: 'a',
      signal: { kind: 'now-playing', playing: theirSong(true), started: true },
    });
    expect(deps.library).not.toHaveBeenCalled();

    share.linked([linkedPeer('a')]);
    share.pageSaid();
    share.heard({
      peerId: 'a',
      signal: { kind: 'now-playing', playing: theirSong(true), started: true },
    });
    expect(deps.library).not.toHaveBeenCalled();
  });

  it('on its bar is carried out on the player this computer describes', () => {
    const { share, deps } = setUp();
    share.linked([linkedPeer('a')]);
    share.libraryViewed(playingSong(true));
    share.libraryClock({ trackId: 't1', positionMs: 5_000, durationMs: 9_000 });

    share.heard({
      peerId: 'a',
      signal: { kind: 'transport', command: 'toggle' },
    });
    share.heard({
      peerId: 'a',
      signal: { kind: 'transport', command: 'next' },
    });
    share.heard({
      peerId: 'a',
      signal: { kind: 'transport', command: 'nudge', deltaMs: 60_000 },
    });
    expect(deps.library.mock.calls).toEqual([
      [{ kind: 'toggle' }],
      [{ kind: 'skip', direction: 1 }],
      // Never past the end.
      [{ kind: 'seek', positionMs: 9_000 }],
    ]);

    share.libraryViewed(playingSong(false));
    share.systemSaid(media(true));
    share.heard({
      peerId: 'a',
      signal: { kind: 'transport', command: 'toggle' },
    });
    share.heard({
      peerId: 'a',
      signal: { kind: 'transport', command: 'nudge', deltaMs: -5_000 },
    });
    expect(deps.system.mock.calls).toEqual([['pause'], ['seek', 25_000]]);
  });
});

describe('one player at a time, on sight', () => {
  it('a computer that joined this one is paused when it turns up playing over ours', () => {
    const { share, pausesTo } = setUp();
    share.linked([
      linkedPeer('joinedUs', { joined: false }),
      linkedPeer('weJoined', { joined: true }),
    ]);
    share.libraryViewed(playingSong(true));
    share.heard({
      peerId: 'joinedUs',
      signal: { kind: 'now-playing', playing: theirSong(true) },
    });
    share.heard({
      peerId: 'weJoined',
      signal: { kind: 'now-playing', playing: theirSong(true) },
    });
    expect(pausesTo()).toEqual(['joinedUs']);
  });
});

describe('the one-player switch, changed on a linked computer', () => {
  it('goes on to the others, never back, and waits once for the next page', () => {
    const { share, deps, nowPlaying } = setUp();
    share.linked([linkedPeer('a'), linkedPeer('b')]);
    share.heard({
      peerId: 'a',
      signal: {
        kind: 'now-playing',
        playing: theirSong(false),
        singlePlayer: false,
      },
    });
    expect(deps.setSinglePlayer).toHaveBeenCalledWith(false);
    const forwarded = nowPlaying().filter(
      ({ signal }) =>
        signal.kind === 'now-playing' && signal.singlePlayer === false,
    );
    expect(forwarded.map(({ peerId }) => peerId)).toEqual(['b']);
    expect(share.takeSwitchFromLink()).toEqual({ isOn: false, peerId: 'a' });
    expect(share.takeSwitchFromLink()).toBeUndefined();
  });
});
