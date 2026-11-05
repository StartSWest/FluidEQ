/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A game's own sound goes on when the game comes to the front and stays on
 * until its program ends, however often the player alt-tabs (Ivan,
 * 2026-11-02), and the music sound comes back then — by the game's own
 * process ending, never by losing the front.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { IGameSoundState, TGameSeed } from '../../../common/gaming';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import {
  addGameProfile,
  readGameProfiles,
  resetGamesEnabled,
  setGamesEnabled,
} from '../../../renderer/games/gameProfiles';
import {
  readLoadedGame,
  resetGameSoundState,
} from '../../../renderer/games/gameSoundStore';
import {
  GAME_ENDED_CHANNEL,
  GAME_FOREGROUND_CHANNEL,
  useGameSound,
} from '../../../renderer/games/useGameSound';
import {
  loadGameSound,
  unloadGameSound,
} from '../../../renderer/utils/gamingApi';

let loaded: IGameSoundState = {};

jest.mock('../../../renderer/utils/gamingApi', () => ({
  loadGameSound: jest.fn(async (gameId: string, _seed: TGameSeed) => {
    loaded = { gameId, profile: { name: 'Game copy', voicingBypassed: false } };
  }),
  unloadGameSound: jest.fn(async () => {
    loaded = { profile: { name: 'My music', voicingBypassed: true } };
  }),
  readGameSoundState: jest.fn(async () => loaded),
}));
jest.mock('../../../renderer/dsp/store', () => ({
  useDspSettings: () => DSP_DEFAULTS,
}));
jest.mock('../../../renderer/audio/songSoundSession', () => ({
  yieldSongSound: jest.fn(async () => undefined),
}));
// One function for the life of the window, as the real hook's useCallback
// gives: a new one each render would re-run every effect that depends on it.
const enterMainEditor = async () => undefined;
jest.mock('../../../renderer/utils/useMainOutputEditor', () => ({
  __esModule: true,
  default: () => enterMainEditor,
}));
jest.mock('../../../renderer/utils/useMainEditorWhile', () => ({
  useIsMainEdited: () => true,
}));
jest.mock('../../../renderer/games/gameWatchRequest', () => ({
  requestGameWatch: () => () => undefined,
}));
jest.mock('../../../renderer/utils/logger', () => ({
  reportError: jest.fn(),
}));

type TListener = (...args: unknown[]) => void;
const listeners = new Map<string, TListener>();
const holdGameProcess = jest.fn();

const GAME = 'D:\\Games\\Neon Drift\\neondrift.exe';
const BROWSER = 'C:\\Program Files\\Browser\\browser.exe';

const say = async (channel: string, ...args: unknown[]) => {
  const listener = listeners.get(channel);
  if (!listener) {
    throw new Error(`nothing listens on ${channel}`);
  }
  await act(async () => {
    listener(...args);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  resetGamesEnabled();
  resetGameSoundState();
  loaded = {};
  listeners.clear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        sendMessage: jest.fn(),
        holdGameProcess,
        on: (channel: string, listener: TListener) => {
          listeners.set(channel, listener);
          return () => listeners.delete(channel);
        },
      },
    },
  });
  addGameProfile({ name: 'Neon Drift', path: GAME, source: 'steam' });
});

const neonDrift = () => {
  const [game] = readGameProfiles();
  return game;
};

describe('the window’s own game sound switch', () => {
  it('puts a game’s sound on when it comes to the front, holding its process', async () => {
    const { result } = renderHook(() => useGameSound({ applies: true }));
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Neon Drift',
      path: GAME,
      pid: 41,
    });
    await waitFor(() => expect(result.current.switched?.kind).toBe('loaded'));
    expect(loadGameSound).toHaveBeenCalledTimes(1);
    expect(jest.mocked(loadGameSound).mock.calls[0][0]).toBe(neonDrift().id);
    expect(holdGameProcess).toHaveBeenCalledWith(41);
    expect(readLoadedGame().gameId).toBe(neonDrift().id);
    expect(result.current.sounding?.name).toBe('Neon Drift');
    expect(result.current.switched?.profile).toEqual({
      name: 'Game copy',
      voicingBypassed: false,
    });
  });

  it('keeps it through alt-tabs, and puts it on once however often the game comes back', async () => {
    renderHook(() => useGameSound({ applies: true }));
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Neon Drift',
      path: GAME,
      pid: 41,
    });
    await waitFor(() => expect(readLoadedGame().gameId).toBeDefined());
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Browser',
      path: BROWSER,
      pid: 7,
    });
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Neon Drift',
      path: GAME,
      pid: 41,
    });
    expect(loadGameSound).toHaveBeenCalledTimes(1);
    expect(unloadGameSound).not.toHaveBeenCalled();
  });

  it('gives the music sound back when the game’s process ends, and never for another one', async () => {
    const { result } = renderHook(() => useGameSound({ applies: true }));
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Neon Drift',
      path: GAME,
      pid: 41,
    });
    await waitFor(() => expect(readLoadedGame().gameId).toBeDefined());
    await say(GAME_ENDED_CHANNEL, 99);
    expect(unloadGameSound).not.toHaveBeenCalled();
    await say(GAME_ENDED_CHANNEL, 41);
    await waitFor(() => expect(result.current.switched?.kind).toBe('restored'));
    expect(unloadGameSound).toHaveBeenCalledTimes(1);
    expect(readLoadedGame().gameId).toBeUndefined();
    expect(result.current.switched?.profile).toEqual({
      name: 'My music',
      voicingBypassed: true,
    });
  });

  it('leaves alone a sound the listener put on by hand since', async () => {
    renderHook(() => useGameSound({ applies: true }));
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Neon Drift',
      path: GAME,
      pid: 41,
    });
    await waitFor(() => expect(readLoadedGame().gameId).toBeDefined());
    // Unload pressed in the Gaming Lab: the music sound is already back.
    await act(async () => {
      await unloadGameSound();
      window.dispatchEvent(new Event('fluideq-output-changed'));
    });
    await waitFor(() => expect(readLoadedGame().gameId).toBeUndefined());
    jest.mocked(unloadGameSound).mockClear();
    await say(GAME_ENDED_CHANNEL, 41);
    expect(unloadGameSound).not.toHaveBeenCalled();
  });

  it('does nothing for a program that is not one of the games', async () => {
    renderHook(() => useGameSound({ applies: true }));
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Browser',
      path: BROWSER,
      pid: 7,
    });
    expect(loadGameSound).not.toHaveBeenCalled();
    expect(holdGameProcess).not.toHaveBeenCalled();
  });

  it('gives the music sound back at once when the Lab’s switch goes off, and then hears no game', async () => {
    renderHook(() => useGameSound({ applies: true }));
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Neon Drift',
      path: GAME,
      pid: 41,
    });
    await waitFor(() => expect(readLoadedGame().gameId).toBeDefined());
    act(() => setGamesEnabled(false));
    await waitFor(() => expect(unloadGameSound).toHaveBeenCalledTimes(1));
    expect(holdGameProcess).toHaveBeenLastCalledWith(0);
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Neon Drift',
      path: GAME,
      pid: 41,
    });
    expect(loadGameSound).toHaveBeenCalledTimes(1);
  });

  it('only tells the Gaming Lab what is in front, and puts nothing on from there', async () => {
    const { result } = renderHook(() => useGameSound({ always: true }));
    await say(GAME_FOREGROUND_CHANNEL, {
      name: 'Neon Drift',
      path: GAME,
      pid: 41,
    });
    expect(result.current.playing?.name).toBe('Neon Drift');
    expect(loadGameSound).not.toHaveBeenCalled();
  });
});
