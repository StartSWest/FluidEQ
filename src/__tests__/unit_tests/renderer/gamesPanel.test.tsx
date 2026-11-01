/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Games page: the list, what Windows has in front, and the game whose
 * sound the core has on. Switching the sound is the core's
 * (`main/gameSound.ts`, held by `gameSound.test.ts`); the page shows what
 * the core says and changes nothing itself.
 */
import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { DSP_DEFAULTS, IDspSettings } from 'common/dsp/chain';
import { dspPresetSettings } from 'common/dsp/presets';
import { IGameProgram } from 'common/games';
import en from 'common/i18n/en';
import GamesPanel from 'renderer/games/GamesPanel';
import {
  readGameProfiles,
  resetGamesEnabled,
} from 'renderer/games/gameProfiles';
import { resetGameWatchRequests } from 'renderer/games/gameWatchRequest';
import { resetGameSounding } from 'renderer/games/useGameSound';
import { useSystemMediaSource } from 'renderer/audio/useSystemMediaSource';
import {
  resetTransportSource,
  useTransportSources,
} from 'renderer/audio/transportSource';
import { applyDspSettings, readDspSettings } from 'renderer/dsp/store';
import { toggleFavouriteDspPreset } from 'renderer/dsp/favouriteDspPresets';

jest.mock('renderer/dsp/systemChain', () => ({
  sendSystemDspChain: jest.fn(),
  readSystemDspChainResult: () => undefined,
  subscribeSystemDspChainResult: () => () => undefined,
}));
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useKnownAudioEngineStatus: () => ({ engine: 'fluid' }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  pickDspPreset: jest.fn(),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('__tests__/utils/fluidEqHookMocks').eqHooksFrom(() => ({
    isEnabled: true,
    isBlockingError: false,
    voicing: undefined,
    setVoicing: () => undefined,
    setGlobalError: () => undefined,
    refreshState: async () => undefined,
  })),
}));

/** A few bytes that pass for what Windows draws for the program. */
const OVERWATCH_ICON = 'data:image/png;base64,iVBORw0KGgo=';

const OVERWATCH: IGameProgram = {
  name: 'Overwatch',
  path: 'D:\\GAMES\\Overwatch',
  source: 'battlenet',
  icon: OVERWATCH_ICON,
};
/** The same game as the watcher reports it: running, with its process. */
const OVERWATCH_RUNNING: IGameProgram = {
  name: 'Overwatch',
  path: 'D:\\GAMES\\Overwatch\\_retail_\\Overwatch.exe',
  source: 'running',
  pid: 4242,
};
const CHROME: IGameProgram = {
  name: 'Google Chrome',
  path: 'C:\\Program Files\\Google\\Chrome\\chrome.exe',
  source: 'running',
  pid: 5150,
};

type TListener = (...args: unknown[]) => void;
let listeners: { channel: string; listener: TListener }[] = [];

/** Windows' own media session, as `useSystemMediaSource` is told of it. */
let saySession: ((snapshot: unknown) => void) | undefined;

const bridge = {
  gamePrograms: jest.fn(() =>
    Promise.resolve({ installed: [OVERWATCH], running: [CHROME] }),
  ),
  watchGames: jest.fn(),
  chooseGameProgram: jest.fn(),
  askGameSounding: jest.fn(),
  watchSystemMedia: jest.fn(() => Promise.resolve()),
  onSystemMedia: (listener: (snapshot: unknown) => void) => {
    saySession = listener;
    return () => {
      saySession = undefined;
    };
  },
  pauseOtherSystemPlayers: jest.fn(() => Promise.resolve()),
  on: (channel: string, listener: TListener) => {
    listeners.push({ channel, listener });
    return () => {
      listeners = listeners.filter((one) => one.listener !== listener);
    };
  },
};

const tell = (channel: string, ...args: unknown[]) =>
  act(() => {
    listeners
      .filter((one) => one.channel === channel)
      .forEach((one) => one.listener(...args));
  });

/** What main sends when Windows puts a program in front. */
const comesToTheFront = (program: IGameProgram) =>
  tell('game-foreground', program);

const rack = (id: string): IDspSettings => ({
  ...(dspPresetSettings(id, DSP_DEFAULTS) as IDspSettings),
  enabled: true,
});

/**
 * What the core does when Overwatch comes forward: Gaming on the rack, and
 * the window told whose sound it is. `null` when the game has ended.
 */
const coreSays = (presetId: string | null) => {
  const [overwatch] = readGameProfiles();
  act(() => {
    if (presetId !== null) {
      applyDspSettings(rack(presetId));
    }
  });
  tell(
    'game-sounding',
    presetId === null ? null : { gameId: overwatch.id, presetId },
  );
};

const show = async () => {
  render(<GamesPanel />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: en['games.add'] })).toBeEnabled(),
  );
};

const addFromMenu = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: en['games.add'] }));
  fireEvent.click(
    screen.getByRole('menuitemradio', { name: new RegExp(name) }),
  );
};

/** Overwatch on the list, playing the Gaming chain. */
const overwatchOnGaming = async () => {
  await show();
  addFromMenu('Overwatch');
  fireEvent.click(
    screen.getByRole('button', {
      name: en['games.row.sound'].replace('{name}', 'Overwatch'),
    }),
  );
  fireEvent.click(
    screen.getByRole('menuitemradio', { name: /^Gaming(?!\s·)/ }),
  );
};

beforeEach(() => {
  listeners = [];
  resetGameWatchRequests();
  resetGameSounding();
  resetTransportSource();
  saySession = undefined;
  window.localStorage.clear();
  resetGamesEnabled();
  jest.clearAllMocks();
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: bridge,
  };
  applyDspSettings({ ...DSP_DEFAULTS, enabled: true, presetId: 'music' });
});

describe('the Games page', () => {
  it('offers what the launchers installed and what is open, and keeps what is added', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: en['games.add'] }));
    expect(screen.getByText(en['games.group.installed'])).toBeInTheDocument();
    // The heading, and the line under the row it holds, say the same words.
    expect(
      screen.getAllByText(en['games.group.running']).length,
    ).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Overwatch/ }));
    // With its icon: the list read it from Windows and used to drop it on the
    // way into the saved row, so every row and every desktop card wore the
    // same gamepad.
    expect(readGameProfiles()).toEqual([
      expect.objectContaining({
        name: 'Overwatch',
        path: OVERWATCH.path,
        icon: OVERWATCH_ICON,
      }),
    ]);
    // And it leaves the menu, because it is on the page now.
    fireEvent.click(screen.getByRole('button', { name: en['games.add'] }));
    expect(
      screen.queryByRole('menuitemradio', { name: /Overwatch/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the game in front, and the game whose sound the core has on for as long as its chain plays', async () => {
    await overwatchOnGaming();
    // Asked once which game's sound is on: a window opened mid-game shows it.
    expect(bridge.askGameSounding).toHaveBeenCalledTimes(1);

    comesToTheFront(OVERWATCH_RUNNING);
    expect(screen.getByText(en['games.row.inFront'])).toBeInTheDocument();
    coreSays('gaming');

    // Tabbed out of it, the row still says the sound is the game's.
    comesToTheFront(CHROME);
    expect(screen.getByText(en['games.row.sounding'])).toBeInTheDocument();
    expect(
      screen.getByText(
        en['games.front.sounding'].replace('{name}', 'Overwatch'),
      ),
    ).toBeInTheDocument();

    // The listener picks their own chain mid-game: no longer the game's.
    act(() => {
      applyDspSettings({ ...readDspSettings(), presetId: 'late-night' });
    });
    expect(
      screen.queryByText(en['games.row.sounding']),
    ).not.toBeInTheDocument();

    // POSITIVE CONTROL: the game's chain back, and the core saying the game
    // ended, which is what takes the claim away.
    act(() => applyDspSettings(rack('gaming')));
    expect(screen.getByText(en['games.row.sounding'])).toBeInTheDocument();
    coreSays(null);
    expect(
      screen.queryByText(en['games.row.sounding']),
    ).not.toBeInTheDocument();
  });

  /**
   * The bar at the foot of the window speaks for the machine's own sound, and
   * a game registers no player with Windows — so it said nothing at all while
   * one played. It names the game while its sound is on, steps aside for a
   * player that is actually playing, and lets go when the game ends.
   */
  it('names the game on the bar, unless something is really playing over it', async () => {
    const BarTitle = () => {
      useSystemMediaSource();
      return (
        <p data-testid="bar">{useTransportSources().system?.title ?? ''}</p>
      );
    };
    render(<BarTitle />);
    await overwatchOnGaming();
    comesToTheFront(OVERWATCH_RUNNING);
    coreSays('gaming');
    await waitFor(() =>
      expect(screen.getByTestId('bar')).toHaveTextContent('Overwatch'),
    );

    const song = {
      title: 'Kind of Blue',
      artist: 'Miles Davis',
      app: 'Spotify',
      positionMs: 0,
      durationMs: 1,
      canSeek: false,
      canNext: false,
      canPrevious: false,
    };
    act(() => saySession?.({ ...song, isPlaying: true, playing: ['Spotify'] }));
    expect(screen.getByTestId('bar')).toHaveTextContent('Kind of Blue');
    act(() => saySession?.({ ...song, isPlaying: false, playing: [] }));
    expect(screen.getByTestId('bar')).toHaveTextContent('Overwatch');

    coreSays(null);
    await waitFor(() =>
      expect(screen.getByTestId('bar')).toHaveTextContent('Kind of Blue'),
    );
  });

  it('says nothing about a program with no profile', async () => {
    await show();
    addFromMenu('Overwatch');
    comesToTheFront(CHROME);
    // The line at the top is for this listener's own games. Narrating every
    // window somebody opens is noise on a page nobody has asked a question.
    expect(screen.queryByText(/Google Chrome/)).not.toBeInTheDocument();
  });

  it('changes nothing about the sound itself', async () => {
    await overwatchOnGaming();
    comesToTheFront(OVERWATCH_RUNNING);
    // The page is a page: it says what is in front; the core switches.
    expect(readDspSettings().presetId).toBe('music');
  });

  it('watches while the page is open, and stops with the page', async () => {
    const { unmount } = render(<GamesPanel />);
    await waitFor(() => expect(bridge.watchGames).toHaveBeenCalledWith(true));
    unmount();
    expect(bridge.watchGames).toHaveBeenLastCalledWith(false);
  });

  it('removes a game, and says so when the list is empty', async () => {
    await show();
    addFromMenu('Overwatch');
    fireEvent.click(
      screen.getByRole('button', {
        name: en['games.row.remove'].replace('{name}', 'Overwatch'),
      }),
    );
    expect(readGameProfiles()).toEqual([]);
    expect(screen.getByText(en['games.empty.title'])).toBeInTheDocument();
  });

  // The starred chains lead every other picker in the app; a game's was the
  // one place they were missing, so somebody who had starred their own chain
  // had to hunt for it under a group heading.
  it('leads a game’s sound with the chains this listener has starred', async () => {
    toggleFavouriteDspPreset('speech', ['speech']);
    await show();
    addFromMenu('Overwatch');
    fireEvent.click(
      screen.getByRole('button', {
        name: en['games.row.sound'].replace('{name}', 'Overwatch'),
      }),
    );
    expect(screen.getByText(en['dsp.favorites.title'])).toBeInTheDocument();
    const offered = screen
      .getAllByRole('menuitemradio')
      .map((item) => item.getAttribute('data-id') ?? item.textContent ?? '');
    // Straight after "leave it alone", and listed once rather than twice.
    expect(offered[1]).toContain(en['dsp.preset.speech']);
    expect(
      offered.filter((name) => name.includes(en['dsp.preset.speech'])).length,
    ).toBe(1);
  });
});

describe('the Games page’s own switch', () => {
  const gamesSwitch = () =>
    screen.getByRole('checkbox', { name: en['tabs.games'] });

  it('switched off, the page watches nothing and shows no front, and the list stays', async () => {
    await overwatchOnGaming();
    expect(gamesSwitch()).toBeChecked();

    fireEvent.click(gamesSwitch());
    expect(gamesSwitch()).not.toBeChecked();
    expect(screen.getByText(en['games.front.off'])).toBeInTheDocument();
    expect(bridge.watchGames).toHaveBeenLastCalledWith(false);
    // A front reported anyway — one already on its way — is not shown.
    comesToTheFront(OVERWATCH_RUNNING);
    expect(screen.queryByText(en['games.row.inFront'])).not.toBeInTheDocument();
    // The games somebody set up are still theirs.
    expect(readGameProfiles()).toEqual([
      expect.objectContaining({ name: 'Overwatch' }),
    ]);

    // On again, the page watches and shows what is in front.
    fireEvent.click(gamesSwitch());
    expect(bridge.watchGames).toHaveBeenLastCalledWith(true);
    comesToTheFront(OVERWATCH_RUNNING);
    expect(screen.getByText(en['games.row.inFront'])).toBeInTheDocument();
  });

  it('stays off after a restart, and is on for every list saved before it existed', async () => {
    await show();
    expect(gamesSwitch()).toBeChecked();
    fireEvent.click(gamesSwitch());
    cleanup();
    // A fresh window reads it from storage.
    resetGamesEnabled();
    await show();
    expect(gamesSwitch()).not.toBeChecked();
    expect(screen.getByText(en['games.front.off'])).toBeInTheDocument();
  });
});
