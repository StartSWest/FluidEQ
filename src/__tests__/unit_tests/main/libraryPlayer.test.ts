/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library player in the core (`main/libraryPlayer/libraryPlayer.ts`),
 * driven as the app drives it: presses from the window, the host's clock,
 * the window's element where the host cannot play. A fake host engine
 * records what it is asked and hands back the events a real one would.
 */
import { DSP_DEFAULTS, type IDspSettings } from '../../../common/dsp/chain';
import type { IPlayerRackCopy } from '../../../common/library/playerRack';
import type {
  ILibraryPlayerClock,
  ILibraryPlayerView,
} from '../../../common/library/playerWire';
import type { ILibraryTrack } from '../../../common/library/types';
import type { IHostDeckWant } from '../../../main/libraryPlayer/hostDeckTypes';
import type {
  IHostEngine,
  IHostEngineEvents,
  THostEngineState,
} from '../../../main/libraryPlayer/hostEngine';
import createLibraryPlayer from '../../../main/libraryPlayer/libraryPlayer';
import type { IPlaybackSession } from '../../../main/libraryPlayer/playbackSession';
import type { ISourcePublication } from '../../../main/libraryPlayer/sourcePublication';
import type { IPlaybackMemory } from '../../../common/library/playbackMemory';
import { restoreSession } from '../../../common/library/playbackMemory';

const song = (
  id: string,
  overrides: Partial<ILibraryTrack> = {},
): ILibraryTrack => ({
  id,
  rootId: 'r',
  path: `C:/music/${id}.flac`,
  kind: 'audio',
  isPlayable: true,
  title: id,
  durationMs: 200_000,
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...overrides,
});

const rackWith = (settings: Partial<IDspSettings> = {}): IPlayerRackCopy => ({
  settings: { ...DSP_DEFAULTS, ...settings },
  gate: {
    engine: 'fluid',
    eqEnabled: true,
    eqLoaded: true,
    engineOff: false,
    sendingRawAudio: false,
  },
});

const fadeRack = rackWith({
  enabled: true,
  crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true, durationMs: 3_000 },
});

/** A host engine that records the player's wishes and answers as told. */
const fakeHost = () => {
  let events: IHostEngineEvents | undefined;
  let state: THostEngineState = 'idle';
  const wants: IHostDeckWant[] = [];
  const seeks: number[] = [];
  const gains: [number, number][] = [];
  const engaged: boolean[] = [];
  const engine: IHostEngine = {
    setEngaged: (on) => engaged.push(on),
    state: () => state,
    sync: (want) => wants.push(want),
    seek: (positionMs) => {
      seeks.push(positionMs);
      return Promise.resolve(true);
    },
    pushChain: () => Promise.resolve(true),
    setTrackGains: (input, master) => gains.push([input, master]),
    setNoiseProfile: () => undefined,
    close: () => Promise.resolve(),
  };
  const fire = () => {
    if (!events) {
      throw new Error('no host was built');
    }
    return events;
  };
  return {
    create: (given: IHostEngineEvents) => {
      events = given;
      return engine;
    },
    wants,
    seeks,
    gains,
    engaged,
    lastWant: () => wants[wants.length - 1],
    setState: (next: THostEngineState) => {
      state = next;
      fire().onState(next);
    },
    /** The host holding `path` on the deck it plays, at this place. */
    heard: (path: string, positionMs: number, overrides = {}) => {
      fire().onActive(path);
      fire().onClock({
        hasSource: true,
        positionMs,
        durationMs: 200_000,
        ended: false,
        activeDeck: 0,
        ...overrides,
      });
    },
    /** A frame from whatever deck the host plays, without a load before it. */
    frame: (positionMs: number, overrides = {}) =>
      fire().onClock({
        hasSource: true,
        positionMs,
        durationMs: 200_000,
        ended: false,
        activeDeck: 0,
        ...overrides,
      }),
    refuse: (path: string) => fire().onRefused(path, true),
    owns: (owns: boolean) => fire().onOwnership(owns),
  };
};

const sourcesSpy = (): ISourcePublication & { sources: string[] } => {
  const sources: string[] = [];
  return {
    sources,
    setSource: (trackId) => sources.push(trackId ?? '-'),
    markBoundary: () => sources.push('boundary'),
    setPlayback: () => undefined,
    prepareStart: () => Promise.resolve(false),
    release: () => Promise.resolve(true),
  };
};

const sessionWith = (memory?: IPlaybackMemory) => {
  const kept: { positionMs: number; ids?: readonly string[] }[] = [];
  const session: IPlaybackSession = {
    isContinuationOn: () => true,
    restore: (tracks) => {
      if (!memory) {
        return undefined;
      }
      const found = tracks(memory.trackIds);
      return restoreSession(
        memory,
        new Map(found.map((track) => [track.id, track.durationMs])),
      );
    },
    keep: (queue, positionMs) =>
      kept.push({ positionMs, ...(queue ? { ids: queue.trackIds } : {}) }),
    adoptLegacy: () => false,
  };
  return { session, kept };
};

const setup = (
  options: {
    tracks?: ILibraryTrack[];
    memory?: IPlaybackMemory;
    continuation?: string[];
    noHost?: boolean;
  } = {},
) => {
  const library = new Map(
    (options.tracks ?? ['a', 'b', 'c'].map((id) => song(id))).map((track) => [
      track.id,
      track,
    ]),
  );
  const host = fakeHost();
  const sources = sourcesSpy();
  const { session, kept } = sessionWith(options.memory);
  const views: ILibraryPlayerView[] = [];
  const clocks: ILibraryPlayerClock[] = [];
  const player = createLibraryPlayer({
    library: {
      tracks: (ids) =>
        ids
          .map((id) => library.get(id))
          .filter((track): track is ILibraryTrack => track !== undefined),
      continuation: () => options.continuation ?? [],
    },
    ...(options.noHost ? {} : { createHost: host.create }),
    sources,
    session,
    window: {
      view: (view) => views.push(view),
      clock: (clock) => clocks.push(clock),
    },
  });
  // A window on screen, unless a test sends it away.
  player.windowSeen(true);
  return {
    player,
    host,
    sources,
    kept,
    library,
    view: () => views[views.length - 1],
    clock: () => clocks[clocks.length - 1],
  };
};

const drain = async (): Promise<void> => {
  for (let turn = 0; turn < 16; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- draining is sequential.
    await Promise.resolve();
  }
};

/** A player playing a, b, c from a, the host up and holding a. */
const playingA = (options: Parameters<typeof setup>[0] = {}) => {
  const made = setup(options);
  made.player.rackCopy(rackWith());
  made.player.command({
    kind: 'play',
    trackIds: ['a', 'b', 'c'],
    startTrackId: 'a',
  });
  made.host.setState('engaged');
  made.host.owns(true);
  made.host.heard('C:/music/a.flac', 1_000);
  return made;
};

describe('a press of play', () => {
  it('puts the song on the host, playing, with the next one named', () => {
    const { host, view } = playingA();
    expect(host.lastWant()).toMatchObject({
      mediaPath: 'C:/music/a.flac',
      isPlaying: true,
      upcoming: { path: 'C:/music/b.flac', startPositionMs: 0 },
    });
    expect(view()).toMatchObject({
      deck: 'host',
      host: 'engaged',
      isPlaying: true,
    });
    expect(view().track?.id).toBe('a');
  });

  it('brings the host up only once the window has handed the rack over', () => {
    const { player, host } = setup();
    player.command({ kind: 'play', trackIds: ['a'], startTrackId: 'a' });
    expect(host.engaged.filter(Boolean)).toHaveLength(0);
    player.rackCopy(rackWith());
    expect(host.engaged[host.engaged.length - 1]).toBe(true);
  });

  it('marks the Library heard from the host only once the host has the song', () => {
    const { player, host, view } = setup();
    player.rackCopy(rackWith());
    player.command({ kind: 'play', trackIds: ['a'], startTrackId: 'a' });
    host.setState('engaged');
    expect(view().libraryGate.libraryAudible).toBe(false);
    host.owns(true);
    expect(view().libraryGate.libraryAudible).toBe(true);
  });
});

describe('the clock', () => {
  it('follows the song the host plays, and ignores the deck before it', () => {
    const { host, clock } = playingA();
    expect(clock()).toMatchObject({ trackId: 'a', positionMs: 1_000 });
    // The host still describes a's deck while b is being cued.
    host.heard('C:/music/a.flac', 199_000);
    expect(clock().positionMs).toBe(199_000);
  });

  it('takes no reading for the next song until the host plays it', () => {
    const { player, host, view, clock } = playingA();
    player.rackCopy(
      rackWith({
        enabled: true,
        crossfade: {
          ...DSP_DEFAULTS.crossfade,
          enabled: true,
          durationMs: 3_000,
        },
      }),
    );
    player.command({ kind: 'jump', position: 1 });
    // The host has not loaded b yet: its frames still describe a, near its
    // end — read as b's, they would fade b out before it began.
    host.frame(199_000);
    host.frame(200_000, { ended: true });
    expect(view().track?.id).toBe('b');
    expect(clock()).toMatchObject({ trackId: 'b', positionMs: 0 });
  });

  it('holds where the listener asked to be until the host answers', async () => {
    const { player, host, clock } = playingA();
    player.command({ kind: 'seek', positionMs: 90_000 });
    expect(clock().positionMs).toBe(90_000);
    expect(host.seeks).toEqual([90_000]);
    await drain();
  });
});

describe('the end of a song', () => {
  it('moves on to the next song when the host says it ended', () => {
    const { host, view } = playingA();
    host.heard('C:/music/a.flac', 200_000, { ended: true });
    expect(view().track?.id).toBe('b');
    expect(host.lastWant()?.mediaPath).toBe('C:/music/b.flac');
  });

  it('counts a held end once', () => {
    const { host, view } = playingA();
    host.heard('C:/music/a.flac', 200_000, { ended: true });
    // b is not on the deck yet; a's held end keeps arriving.
    host.heard('C:/music/a.flac', 200_000, { ended: true });
    expect(view().track?.id).toBe('b');
  });

  it('restarts the song on its deck under repeat one, every time it ends', () => {
    const { player, host, view } = playingA();
    player.command({ kind: 'repeat' });
    player.command({ kind: 'repeat' });
    expect(view().queue?.repeat).toBe('one');
    host.heard('C:/music/a.flac', 200_000, { ended: true });
    host.heard('C:/music/a.flac', 0);
    host.heard('C:/music/a.flac', 200_000, { ended: true });
    expect(host.seeks).toEqual([0, 0]);
    expect(view().track?.id).toBe('a');
  });

  it('stops after the last song with repeat off', () => {
    const { player, host, view } = playingA();
    player.command({ kind: 'jump', position: 2 });
    host.heard('C:/music/c.flac', 200_000, { ended: true });
    expect(view().isPlaying).toBe(false);
    expect(view().track?.id).toBe('c');
  });
});

describe('the natural overlap', () => {
  it('brings the next song in before the music runs out, once', () => {
    const { player, host, view } = playingA();
    player.rackCopy(fadeRack);
    host.heard('C:/music/a.flac', 196_000);
    expect(view().track?.id).toBe('a');
    host.heard('C:/music/a.flac', 197_500);
    expect(view().track?.id).toBe('b');
    expect(host.lastWant()?.transition).toMatchObject({ durationMs: 3_000 });
  });

  it('judges the end of the music, not of the file', () => {
    const tracks = [
      song('a', {
        normalization: {
          version: 2,
          integratedLufs: -14,
          truePeakDbtp: -1,
          edges: { leadInMs: 0, endMs: 150_000 },
        },
      }),
      song('b'),
    ];
    const { player, host, view } = playingA({ tracks });
    player.rackCopy(fadeRack);
    host.heard('C:/music/a.flac', 147_500);
    expect(view().track?.id).toBe('b');
  });

  it('does not start while paused', () => {
    const { player, host, view } = playingA();
    player.rackCopy(fadeRack);
    player.command({ kind: 'toggle' });
    host.heard('C:/music/a.flac', 198_000);
    expect(view().track?.id).toBe('a');
  });

  it('runs only with the rack and its crossfade on', () => {
    const { player, host, view } = playingA();
    player.rackCopy(
      rackWith({
        enabled: false,
        crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
      }),
    );
    host.heard('C:/music/a.flac', 199_000);
    expect(view().track?.id).toBe('a');
  });

  it('holds the incoming song’s level until the fade is over', () => {
    const tracks = [
      song('a'),
      song('b', {
        normalization: { version: 2, integratedLufs: -8, truePeakDbtp: 0 },
      }),
    ];
    const { player, host } = playingA({ tracks });
    player.rackCopy({
      ...fadeRack,
      settings: {
        ...fadeRack.settings,
        normalizer: { ...fadeRack.settings.normalizer, mode: 'loudness' },
      },
    });
    const before = host.gains.length;
    host.heard('C:/music/a.flac', 198_000);
    // b came in; nothing about it is sent while a is still fading out.
    expect(host.gains.length).toBe(before);
    host.heard('C:/music/b.flac', 3_000);
    expect(host.gains.length).toBe(before + 1);
  });
});

describe('Previous', () => {
  it('rewinds past the first ten seconds, and changes song inside them', () => {
    const { player, host, view } = playingA();
    player.command({ kind: 'jump', position: 1 });
    host.heard('C:/music/b.flac', 30_000);
    player.command({ kind: 'skip', direction: -1 });
    expect(view().track?.id).toBe('b');
    expect(host.seeks).toEqual([0]);
    host.heard('C:/music/b.flac', 2_000);
    player.command({ kind: 'skip', direction: -1 });
    expect(view().track?.id).toBe('a');
  });
});

describe('stop', () => {
  it('pauses and rewinds, keeping the song and the queue', () => {
    const { player, host, view } = playingA();
    host.heard('C:/music/a.flac', 50_000);
    player.command({ kind: 'stop' });
    expect(view().isPlaying).toBe(false);
    expect(view().track?.id).toBe('a');
    expect(host.seeks).toEqual([0]);
  });

  it('starts a song that ran out again from the top on Play', () => {
    const { player, host } = playingA();
    player.command({ kind: 'jump', position: 2 });
    host.heard('C:/music/c.flac', 200_000, { ended: true });
    player.command({ kind: 'toggle' });
    expect(host.seeks).toEqual([0]);
  });
});

describe('a song the host cannot play', () => {
  it('goes to the window’s element, which reports the clock', () => {
    const { player, host, view, clock } = playingA();
    host.refuse('C:/music/a.flac');
    expect(view().deck).toBe('window');
    expect(view().windowDeck).toMatchObject({ trackId: 'a', isPlaying: true });
    player.deckReport({
      kind: 'clock',
      trackId: 'a',
      positionMs: 4_000,
      durationMs: 200_000,
    });
    expect(clock().positionMs).toBe(4_000);
  });

  it('moves on when the element says it ended', () => {
    const { player, host, view } = playingA();
    host.refuse('C:/music/a.flac');
    player.deckReport({ kind: 'ended', trackId: 'a' });
    expect(view().track?.id).toBe('b');
    expect(view().deck).toBe('host');
  });

  it('stops and says so when the element cannot play it either', () => {
    const { player, host, view } = playingA();
    host.refuse('C:/music/a.flac');
    player.deckReport({ kind: 'failed', trackId: 'a' });
    expect(view()).toMatchObject({
      deck: 'none',
      isPlaying: false,
      isUnplayable: true,
    });
  });

  it('ignores what the element says about any other song', () => {
    const { player, host, view, clock } = playingA();
    host.refuse('C:/music/a.flac');
    player.deckReport({ kind: 'ended', trackId: 'b' });
    player.deckReport({ kind: 'playing', trackId: 'b', isPlaying: false });
    player.deckReport({
      kind: 'clock',
      trackId: 'b',
      positionMs: 90_000,
      durationMs: 200_000,
    });
    expect(view().track?.id).toBe('a');
    expect(view().isPlaying).toBe(true);
    expect(clock()?.positionMs ?? 0).toBeLessThan(90_000);
    // POSITIVE CONTROL: the same about the song playing is taken.
    player.deckReport({ kind: 'playing', trackId: 'a', isPlaying: false });
    expect(view().isPlaying).toBe(false);
  });

  it('plays everything on the element where there is no host', () => {
    const { player, view } = setup({ noHost: true });
    player.command({ kind: 'play', trackIds: ['a'], startTrackId: 'a' });
    expect(view().deck).toBe('window');
  });

  it('plays a video on the element, the host idle', () => {
    const tracks = [song('v', { kind: 'video' }), song('a')];
    const { player, host, view } = setup({ tracks });
    player.rackCopy(rackWith());
    player.command({ kind: 'play', trackIds: ['v', 'a'], startTrackId: 'v' });
    expect(view().deck).toBe('window');
    expect(host.engaged[host.engaged.length - 1]).toBe(false);
  });

  it('pauses when the element was paused from outside', () => {
    const tracks = [song('v', { kind: 'video' })];
    const { player, view } = setup({ tracks });
    player.command({ kind: 'play', trackIds: ['v'], startTrackId: 'v' });
    player.deckReport({ kind: 'playing', trackId: 'v', isPlaying: false });
    expect(view().isPlaying).toBe(false);
  });
});

describe('the session across a restart', () => {
  const memory: IPlaybackMemory = {
    trackIds: ['a', 'b'],
    order: [0, 1],
    position: 1,
    repeat: 'off',
    isShuffled: false,
    positionMs: 42_000,
  };

  it('comes back cued where it was, and never starts on its own', () => {
    const { player, host, view } = setup({ memory });
    expect(view()).toMatchObject({ isPlaying: false });
    expect(view().track?.id).toBe('b');
    player.rackCopy(rackWith());
    expect(host.lastWant()).toMatchObject({
      mediaPath: 'C:/music/b.flac',
      isPlaying: false,
      positionMs: 42_000,
    });
  });

  it('starts no host at launch until the Library is in use', () => {
    const { host } = setup({ memory });
    expect(host.engaged.filter(Boolean)).toHaveLength(0);
  });

  it('lets a paused host go when the window puts the Library away', () => {
    const { player, host } = setup({ memory });
    player.rackCopy(rackWith());
    expect(host.engaged[host.engaged.length - 1]).toBe(true);
    player.away();
    expect(host.engaged[host.engaged.length - 1]).toBe(false);
  });

  it('keeps a playing host when the window goes', () => {
    const { player, host } = playingA();
    player.away();
    player.windowSeen(false);
    expect(host.engaged[host.engaged.length - 1]).toBe(true);
  });

  it('lets a paused host go behind a window nobody can see, and brings it back on Play', () => {
    const { player, host } = setup({ memory });
    player.rackCopy(rackWith());
    expect(host.engaged[host.engaged.length - 1]).toBe(true);
    player.windowSeen(false);
    expect(host.engaged[host.engaged.length - 1]).toBe(false);
    // Play from the tray or a media key: up again, cued where it was.
    player.command({ kind: 'toggle' });
    expect(host.engaged[host.engaged.length - 1]).toBe(true);
    expect(host.lastWant()).toMatchObject({
      mediaPath: 'C:/music/b.flac',
      isPlaying: true,
      positionMs: 42_000,
    });
  });

  it('brings a paused host back when the window is seen again', () => {
    const { player, host } = setup({ memory });
    player.rackCopy(rackWith());
    player.windowSeen(false);
    player.windowSeen(true);
    expect(host.engaged[host.engaged.length - 1]).toBe(true);
  });

  it('is kept with the queue and the playhead', () => {
    const { player, host, kept } = playingA();
    host.heard('C:/music/a.flac', 61_000);
    player.command({ kind: 'shuffle', isShuffled: false });
    expect(kept[kept.length - 1]).toMatchObject({
      ids: ['a', 'b', 'c'],
      positionMs: 61_000,
    });
  });
});

describe('a song gone from the library', () => {
  it('stops rather than play on with no bar', () => {
    const { player, library, view } = playingA();
    library.delete('a');
    player.tracksChanged(undefined);
    expect(view().isPlaying).toBe(false);
  });

  it('picks up a measurement kept for the song playing', () => {
    const { player, library, view } = playingA();
    const measured = song('a', {
      normalization: { version: 2, integratedLufs: -12, truePeakDbtp: -1 },
    });
    library.set('a', measured);
    player.tracksChanged(['a']);
    expect(view().track?.normalization?.integratedLufs).toBe(-12);
  });
});

describe('Keep playing', () => {
  it('draws more once the last song plays, and asks once for that place', () => {
    const tracks = ['a', 'b', 'x', 'y'].map((id) => song(id));
    const made = setup({ tracks, continuation: ['x', 'y'] });
    made.player.command({
      kind: 'play',
      trackIds: ['a', 'b'],
      startTrackId: 'b',
    });
    expect(made.view().queue?.trackIds).toEqual(['a', 'b', 'x', 'y']);
    expect(made.view().continued).toEqual(['x', 'y']);
  });
});
