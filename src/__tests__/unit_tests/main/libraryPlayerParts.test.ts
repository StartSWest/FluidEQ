/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The core Library player's smaller rules: which deck plays a song, what
 * the window is told, the rack line the host runs, the levels held across a
 * fade, the presses' deck work, the session file and continuation's asks.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  appendPresetTone,
  encodeChainSettings,
} from '../../../common/dsp/chainWire';
import { DSP_DEFAULTS, type IDspSettings } from '../../../common/dsp/chain';
import { FilterTypeEnum } from '../../../common/constants';
import { buildQueue } from '../../../common/library/queue';
import {
  INITIAL_PLAYER_STATE,
  type ILibraryPlayerState,
} from '../../../common/library/playerState';
import type { IPlayerRackCopy } from '../../../common/library/playerRack';
import type { ILibraryTrack } from '../../../common/library/types';
import { createContinuationDraw } from '../../../main/libraryPlayer/continuationDraw';
import {
  deckOwnerFor,
  fadeOverAtMs,
  hostWanted,
  naturalFadeMs,
  playerChainLine,
  transitionFor,
  upcomingFor,
} from '../../../main/libraryPlayer/deckWants';
import { createPlaybackSession } from '../../../main/libraryPlayer/playbackSession';
import { runPlayerCommand } from '../../../main/libraryPlayer/playerCommands';
import {
  playerViewOf,
  publishedClockOf,
  windowDeckWantOf,
  type IPlayerSnapshot,
} from '../../../main/libraryPlayer/playerView';
import { createTrackLevels } from '../../../main/libraryPlayer/trackLevels';
import type { ISourcePublication } from '../../../main/libraryPlayer/sourcePublication';

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

const rack = (settings: Partial<IDspSettings> = {}): IPlayerRackCopy => ({
  settings: { ...DSP_DEFAULTS, ...settings },
  tone: {
    bands: [{ type: FilterTypeEnum.PK, frequency: 1_000, gain: 2, quality: 1 }],
    matched: true,
  },
  gate: {
    engine: 'fluid',
    eqEnabled: true,
    eqLoaded: true,
    engineOff: false,
    sendingRawAudio: false,
  },
});

describe('the deck a song plays on', () => {
  const base = {
    failedTrackId: undefined,
    refusedTrackId: undefined,
    hostAvailable: true,
    hostState: 'engaged' as const,
  };

  it('is the host for a song it can play', () => {
    expect(deckOwnerFor({ ...base, track: song('a') })).toBe('host');
  });

  it('is the window for a video, a refused file, no host, or a host that failed', () => {
    expect(deckOwnerFor({ ...base, track: song('v', { kind: 'video' }) })).toBe(
      'window',
    );
    expect(
      deckOwnerFor({ ...base, track: song('a'), refusedTrackId: 'a' }),
    ).toBe('window');
    expect(
      deckOwnerFor({ ...base, track: song('a'), hostAvailable: false }),
    ).toBe('window');
    expect(
      deckOwnerFor({ ...base, track: song('a'), hostState: 'failed' }),
    ).toBe('window');
  });

  it('is nobody for a song nothing can play', () => {
    expect(
      deckOwnerFor({ ...base, track: song('a', { isPlayable: false }) }),
    ).toBe('none');
    expect(
      deckOwnerFor({ ...base, track: song('a'), failedTrackId: 'a' }),
    ).toBe('none');
    expect(deckOwnerFor({ ...base, track: undefined })).toBe('none');
  });
});

describe('whether the host should be up', () => {
  const ask = (overrides: Partial<Parameters<typeof hostWanted>[0]> = {}) =>
    hostWanted({
      track: song('a'),
      hasRack: true,
      isPlaying: false,
      windowHasPlayer: true,
      isWindowSeen: true,
      ...overrides,
    });

  it('is up for a song it can play while the Library is in use', () => {
    expect(ask()).toBe(true);
    expect(ask({ windowHasPlayer: false, isPlaying: true })).toBe(true);
    expect(ask({ isWindowSeen: false, isPlaying: true })).toBe(true);
  });

  it('is down for a paused song behind a window nobody can see', () => {
    expect(ask({ isWindowSeen: false })).toBe(false);
  });

  it('is down without the rack, for a paused song with the Library away, and for a video', () => {
    expect(ask({ hasRack: false })).toBe(false);
    expect(ask({ windowHasPlayer: false })).toBe(false);
    expect(ask({ track: song('v', { kind: 'video' }) })).toBe(false);
    expect(ask({ track: undefined })).toBe(false);
  });
});

describe('the next song and the fade', () => {
  it('names the next song with its music’s start, not the song playing', () => {
    const next = song('b', {
      normalization: {
        version: 2,
        integratedLufs: -14,
        truePeakDbtp: -1,
        edges: { leadInMs: 1_200, endMs: 190_000 },
      },
    });
    expect(upcomingFor(song('a'), next)).toEqual({
      path: 'C:/music/b.flac',
      startPositionMs: 1_200,
    });
    expect(upcomingFor(song('a'), song('a'))).toBeUndefined();
    expect(
      upcomingFor(song('a'), song('v', { kind: 'video' })),
    ).toBeUndefined();
  });

  it('skips a lead-in too short to be worth a seek', () => {
    const next = song('b', {
      normalization: {
        version: 2,
        integratedLufs: -14,
        truePeakDbtp: -1,
        edges: { leadInMs: 100, endMs: 190_000 },
      },
    });
    expect(upcomingFor(song('a'), next)?.startPositionMs).toBe(0);
  });

  it('fades on Next whenever the crossfade is on, and overlaps naturally only with the rack on', () => {
    const fading = rack({
      enabled: false,
      crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
    });
    expect(transitionFor(fading, song('b'))).toMatchObject({
      durationMs: fading.settings.crossfade.durationMs,
    });
    expect(naturalFadeMs(fading)).toBeUndefined();
    expect(
      naturalFadeMs(
        rack({
          enabled: true,
          crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
        }),
      ),
    ).toBe(DSP_DEFAULTS.crossfade.durationMs);
    expect(
      transitionFor(
        rack({ crossfade: { ...DSP_DEFAULTS.crossfade, enabled: false } }),
        song('b'),
      ),
    ).toBeUndefined();
  });

  it('is over the fade’s length after the music starts', () => {
    const fading = rack({
      crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
    });
    const late = song('b', {
      normalization: {
        version: 2,
        integratedLufs: -14,
        truePeakDbtp: -1,
        edges: { leadInMs: 1_200, endMs: 190_000 },
      },
    });
    expect(fadeOverAtMs(fading, late)).toBe(
      1_200 + DSP_DEFAULTS.crossfade.durationMs,
    );
    expect(fadeOverAtMs(fading, song('b'))).toBe(
      DSP_DEFAULTS.crossfade.durationMs,
    );
    expect(
      fadeOverAtMs(
        rack({ crossfade: { ...DSP_DEFAULTS.crossfade, enabled: false } }),
        late,
      ),
    ).toBeUndefined();
  });
});

describe('the rack line the host runs', () => {
  const onRack = rack({ enabled: true });

  it('is the rack with the preset curve while the host runs it', () => {
    expect(
      playerChainLine(onRack, {
        libraryAudible: true,
        librarySourceReady: false,
      }),
    ).toEqual(
      appendPresetTone(encodeChainSettings(onRack.settings), onRack.tone),
    );
  });

  it('is switched off at the root, with no curve, once the engine took the song', () => {
    expect(
      playerChainLine(onRack, {
        libraryAudible: true,
        librarySourceReady: true,
      }),
    ).toEqual(encodeChainSettings({ ...onRack.settings, enabled: false }));
  });

  it('is switched off while the engine is not running on the output', () => {
    const off: IPlayerRackCopy = {
      ...onRack,
      gate: { ...onRack.gate, engineOff: true },
    };
    expect(
      playerChainLine(off, { libraryAudible: true, librarySourceReady: false }),
    ).toEqual(encodeChainSettings({ ...onRack.settings, enabled: false }));
  });

  it('keeps its rack under Equalizer APO with FluidEQ switched off', () => {
    const apo: IPlayerRackCopy = {
      ...onRack,
      gate: { ...onRack.gate, engine: 'apo', eqEnabled: false },
    };
    expect(
      playerChainLine(apo, { libraryAudible: true, librarySourceReady: false }),
    ).toEqual(
      appendPresetTone(encodeChainSettings(onRack.settings), onRack.tone),
    );
  });

  it('is switched off while FluidEQ is', () => {
    const off: IPlayerRackCopy = {
      ...onRack,
      gate: { ...onRack.gate, eqEnabled: false },
    };
    expect(
      playerChainLine(off, { libraryAudible: true, librarySourceReady: false }),
    ).toEqual(encodeChainSettings({ ...onRack.settings, enabled: false }));
  });
});

const snapshot = (
  overrides: Partial<IPlayerSnapshot> = {},
): IPlayerSnapshot => ({
  state: {
    ...INITIAL_PLAYER_STATE,
    queue: buildQueue(['a', 'b'], 'a', false),
    isPlaying: true,
  },
  track: song('a'),
  owner: 'host',
  hostState: 'engaged',
  clock: { trackId: 'a', positionMs: 30_000, durationMs: 0 },
  libraryGate: { libraryAudible: true, librarySourceReady: false },
  ...overrides,
});

describe('what the window is told', () => {
  it('shows the deck’s clock, the tag’s length when the deck has none', () => {
    expect(publishedClockOf(snapshot())).toEqual({
      trackId: 'a',
      positionMs: 30_000,
      durationMs: 200_000,
    });
  });

  it('shows where the listener asked to be while the host answers', () => {
    expect(
      publishedClockOf(snapshot({ pendingSeek: { targetMs: 90_000 } }))
        .positionMs,
    ).toBe(90_000);
  });

  it('shows nought for a clock that belongs to another song', () => {
    expect(
      publishedClockOf(
        snapshot({ clock: { trackId: 'b', positionMs: 5_000, durationMs: 0 } }),
      ).positionMs,
    ).toBe(0);
  });

  it('asks the element for nothing while the host plays', () => {
    expect(windowDeckWantOf(snapshot())).toBeUndefined();
  });

  it('cues a restored song on the element and says it is a restore', () => {
    const restored = snapshot({
      owner: 'window',
      state: {
        ...snapshot().state,
        isPlaying: false,
        restore: { trackId: 'a', positionMs: 42_000 },
      },
    });
    expect(windowDeckWantOf(restored)).toMatchObject({
      trackId: 'a',
      isPlaying: false,
      startMs: 42_000,
      isRestore: true,
    });
  });

  it('fades on the element only from a song the element played', () => {
    const fading = rack({
      enabled: true,
      crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
    });
    expect(
      windowDeckWantOf(
        snapshot({ owner: 'window', rack: fading, previousOwner: 'window' }),
      )?.transition,
    ).toBeDefined();
    expect(
      windowDeckWantOf(
        snapshot({ owner: 'window', rack: fading, previousOwner: 'host' }),
      )?.transition,
    ).toBeUndefined();
  });

  it('heads only the added and drawn songs the queue still holds, and calls a host coming up idle', () => {
    const state: ILibraryPlayerState = {
      ...snapshot().state,
      addedIds: new Set(['b', 'gone']),
      continuedIds: new Set(['old']),
    };
    const view = playerViewOf(snapshot({ state, hostState: 'engaging' }));
    expect(view.added).toEqual(['b']);
    expect(view.continued).toEqual([]);
    expect(view.host).toBe('idle');
  });
});

describe('a song’s levels across a fade', () => {
  const recorder = () => {
    const sent: string[] = [];
    const sources: ISourcePublication = {
      setSource: (trackId) => sent.push(`source(${trackId ?? '-'})`),
      markBoundary: () => undefined,
      setPlayback: () => undefined,
      prepareStart: () => Promise.resolve(false),
      release: () => Promise.resolve(true),
    };
    const settings: IDspSettings = {
      ...DSP_DEFAULTS,
      normalizer: { ...DSP_DEFAULTS.normalizer, mode: 'loudness' },
    };
    const levels = createTrackLevels(
      {
        setTrackGains: (input) => sent.push(`gains(${input.toFixed(1)})`),
        setNoiseProfile: (profile) =>
          sent.push(profile ? 'noise' : 'noise(none)'),
      },
      sources,
      () => settings,
    );
    return { levels, sent };
  };
  const measured = song('b', {
    normalization: { version: 2, integratedLufs: -10, truePeakDbtp: -3 },
  });

  it('are sent at once on a cut', () => {
    const { levels, sent } = recorder();
    levels.trackChanged(measured);
    expect(sent).toEqual([
      expect.stringMatching(/^gains/),
      'noise(none)',
      'source(b)',
    ]);
  });

  it('wait for the fade to be over, then go together', () => {
    const { levels, sent } = recorder();
    levels.trackChanged(measured, 4_000);
    levels.heardAt('b', 3_999);
    expect(sent).toEqual([]);
    levels.heardAt('b', 4_000);
    expect(sent).toEqual([
      expect.stringMatching(/^gains/),
      'noise(none)',
      'source(b)',
    ]);
  });

  it('keep the outgoing level for a song not measured yet, but let its floor go', () => {
    const { levels, sent } = recorder();
    levels.trackChanged(song('c'), 4_000);
    levels.heardAt('c', 5_000);
    expect(sent).toEqual(['noise(none)', 'source(c)']);
  });

  it('are not moved by the rack while held', () => {
    const { levels, sent } = recorder();
    levels.trackChanged(measured, 4_000);
    levels.settingsChanged();
    levels.measured(measured);
    expect(sent).toEqual([]);
  });
});

describe('the deck work a press asks for', () => {
  const state: ILibraryPlayerState = {
    ...INITIAL_PLAYER_STATE,
    queue: buildQueue(['a', 'b'], 'b', false),
    isPlaying: true,
  };

  it('rewinds on Previous past ten seconds, and changes song inside them', () => {
    expect(
      runPlayerCommand(
        state,
        { kind: 'skip', direction: -1 },
        { positionMs: 10_001, restartsOnPlay: false },
      ).seekMs,
    ).toBe(0);
    const inside = runPlayerCommand(
      state,
      { kind: 'skip', direction: -1 },
      { positionMs: 10_000, restartsOnPlay: false },
    );
    expect(inside.seekMs).toBeUndefined();
    expect(inside.state.queue?.position).toBe(0);
  });

  it('starts a song that ran out from the top on Play, and nothing on Pause', () => {
    const paused = { ...state, isPlaying: false };
    expect(
      runPlayerCommand(
        paused,
        { kind: 'toggle' },
        { positionMs: 0, restartsOnPlay: true },
      ).seekMs,
    ).toBe(0);
    expect(
      runPlayerCommand(
        state,
        { kind: 'toggle' },
        { positionMs: 0, restartsOnPlay: true },
      ).seekMs,
    ).toBeUndefined();
  });

  it('stops by pausing and rewinding', () => {
    const stopped = runPlayerCommand(
      state,
      { kind: 'stop' },
      { positionMs: 5_000, restartsOnPlay: false },
    );
    expect(stopped).toMatchObject({ seekMs: 0, stop: true });
    expect(stopped.state.isPlaying).toBe(false);
  });

  it('answers how many songs an add brought', () => {
    expect(
      runPlayerCommand(
        state,
        { kind: 'add', trackIds: ['x', 'b'] },
        { positionMs: 0, restartsOnPlay: false },
      ).answer,
    ).toEqual({ joined: 1 });
  });
});

describe('the session file', () => {
  const temporary = () =>
    fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-session-'));
  const log = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  it('keeps the queue and puts it back from the songs still there', () => {
    const dir = temporary();
    const session = createPlaybackSession(dir, log);
    session.keep(buildQueue(['a', 'b'], 'b', false), 42_000, true);
    const again = createPlaybackSession(dir, log);
    const restored = again.restore((ids) => ids.map((id) => song(id)));
    expect(restored).toMatchObject({ trackId: 'b', positionMs: 42_000 });
  });

  it('takes the window’s old copy only while it has none of its own', () => {
    const dir = temporary();
    const session = createPlaybackSession(dir, log);
    const legacy = {
      memory: {
        trackIds: ['x'],
        order: [0],
        position: 0,
        repeat: 'off',
        isShuffled: false,
        positionMs: 0,
      },
      keepPlaying: 'off',
    };
    expect(session.adoptLegacy(legacy)).toBe(true);
    expect(session.isContinuationOn()).toBe(false);
    expect(session.restore((ids) => ids.map((id) => song(id)))?.trackId).toBe(
      'x',
    );
    // A second copy, or one arriving after the core kept its own, is no news.
    expect(session.adoptLegacy(legacy)).toBe(false);
  });

  it('remembers Keep playing switched off, and on is the default', () => {
    const dir = temporary();
    const session = createPlaybackSession(dir, log);
    expect(session.isContinuationOn()).toBe(true);
    session.keep(undefined, 0, false);
    expect(createPlaybackSession(dir, log).isContinuationOn()).toBe(false);
  });
});

describe('Keep playing’s asks', () => {
  it('asks once per place, never for what the queue holds or was played', () => {
    const asked: (readonly string[])[] = [];
    const draw = createContinuationDraw((_seed, exclude) => {
      asked.push(exclude);
      return ['x'];
    });
    draw.played('z');
    const state: ILibraryPlayerState = {
      ...INITIAL_PLAYER_STATE,
      queue: buildQueue(['a', 'b'], 'b', false),
      isPlaying: true,
    };
    expect(draw.draw(state, song('b'))).toEqual(['x']);
    expect(draw.draw(state, song('b'))).toEqual([]);
    expect(asked).toEqual([['a', 'b', 'z']]);
  });

  it('draws nothing for a video, or before the last song', () => {
    const draw = createContinuationDraw(() => ['x']);
    const last: ILibraryPlayerState = {
      ...INITIAL_PLAYER_STATE,
      queue: buildQueue(['v'], 'v', false),
    };
    expect(draw.draw(last, song('v', { kind: 'video' }))).toEqual([]);
    const first: ILibraryPlayerState = {
      ...INITIAL_PLAYER_STATE,
      queue: buildQueue(['a', 'b'], 'a', false),
    };
    expect(draw.draw(first, song('a'))).toEqual([]);
  });
});
