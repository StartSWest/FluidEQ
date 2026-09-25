/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { IGameProgram } from 'common/games';
import en from 'common/i18n/en';
import GameSound from 'renderer/games/GameSound';
import GamesPanel from 'renderer/games/GamesPanel';
import { readGameProfiles } from 'renderer/games/gameProfiles';
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
jest.mock('renderer/utils/equalizerApi', () => ({ setVoicing: jest.fn() }));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('__tests__/utils/fluidEqHookMocks').eqHooksFrom(() => ({
    isEnabled: true,
    isBlockingError: false,
    voicing: undefined,
    setVoicing: () => undefined,
    setGlobalError: () => undefined,
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
  showGameToast: jest.fn(),
  holdGameProcess: jest.fn(),
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

/** What main would send when Windows puts a program in front. */
const comesToTheFront = (program: IGameProgram) =>
  tell('game-foreground', program);

/** What main would send when the program it was holding has ended. */
const theGameEnds = (pid: number) => tell('game-ended', pid);

/**
 * The page and the window's own switcher, as the app mounts them: the page
 * shows and edits, `GameSound` is the one that applies. They are separate
 * because a game comes to the front while FluidEQ is behind it.
 */
const show = async () => {
  render(
    <>
      <GameSound />
      <GamesPanel />
    </>,
  );
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

beforeEach(() => {
  listeners = [];
  resetGameWatchRequests();
  resetGameSounding();
  resetTransportSource();
  saySession = undefined;
  window.localStorage.clear();
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

  it('plays a game’s sound until the game ends, not until it loses the front', async () => {
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

    comesToTheFront(OVERWATCH_RUNNING);
    await waitFor(() => expect(readDspSettings().presetId).toBe('gaming'));
    expect(screen.getByText(en['games.row.inFront'])).toBeInTheDocument();
    // Main is asked to be told the end of that very process.
    expect(bridge.holdGameProcess).toHaveBeenCalledWith(4242);
    // And it says so where somebody playing can see it: on the desktop,
    // drawn by main, because this window is behind the game by then.
    await waitFor(() =>
      expect(bridge.showGameToast).toHaveBeenCalledWith(
        expect.objectContaining({
          what: en['games.toast.loaded'].replace('{preset}', 'Gaming'),
          game: en['games.toast.forGame'].replace('{game}', 'Overwatch'),
          icon: OVERWATCH_ICON,
        }),
      ),
    );

    // Alt-tabbing out changes nothing: the sound is still the game's, and
    // the row says so rather than going dark.
    comesToTheFront(CHROME);
    expect(readDspSettings().presetId).toBe('gaming');
    expect(screen.getByText(en['games.row.sounding'])).toBeInTheDocument();
    expect(
      screen.getByText(
        en['games.front.sounding'].replace('{name}', 'Overwatch'),
      ),
    ).toBeInTheDocument();

    // The end of some other program is not the end of the game.
    theGameEnds(5150);
    expect(readDspSettings().presetId).toBe('gaming');

    // The game closing is what puts the sound back — and says so.
    theGameEnds(4242);
    await waitFor(() => expect(readDspSettings().presetId).toBe('music'));
    expect(
      screen.queryByText(en['games.row.sounding']),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(bridge.showGameToast).toHaveBeenLastCalledWith(
        expect.objectContaining({
          game: en['games.toast.afterGame'].replace('{game}', 'Overwatch'),
          icon: OVERWATCH_ICON,
        }),
      ),
    );
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
    comesToTheFront(OVERWATCH_RUNNING);
    await waitFor(() =>
      expect(screen.getByTestId('bar')).toHaveTextContent('Overwatch'),
    );
    // Still the game's while somebody is tabbed out of it.
    comesToTheFront(CHROME);
    expect(screen.getByTestId('bar')).toHaveTextContent('Overwatch');

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

    theGameEnds(4242);
    await waitFor(() =>
      expect(screen.getByTestId('bar')).toHaveTextContent('Kind of Blue'),
    );
  });

  /**
   * Somebody with the rack switched off starts a game: its sound goes on,
   * and when the game ends the rack goes back off. That has no chain name,
   * so the card says what happened instead of inventing one.
   */
  it('puts the rack back off after the game, and says so without naming a chain', async () => {
    applyDspSettings({ ...DSP_DEFAULTS, enabled: false, presetId: 'music' });
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
    comesToTheFront(OVERWATCH_RUNNING);
    await waitFor(() => expect(readDspSettings().enabled).toBe(true));

    theGameEnds(4242);
    await waitFor(() => expect(readDspSettings().enabled).toBe(false));
    await waitFor(() =>
      expect(bridge.showGameToast).toHaveBeenLastCalledWith(
        expect.objectContaining({
          what: en['games.toast.restoredNone'],
          game: en['games.toast.afterGame'].replace('{game}', 'Overwatch'),
        }),
      ),
    );
  });

  it('leaves a chain chosen during the game alone when the game ends, and says nothing', async () => {
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
    comesToTheFront(OVERWATCH_RUNNING);
    await waitFor(() => expect(readDspSettings().presetId).toBe('gaming'));
    await waitFor(() => expect(bridge.showGameToast).toHaveBeenCalledTimes(1));
    comesToTheFront(CHROME);
    // The control: while the sound is the game's, the row says so.
    expect(screen.getByText(en['games.row.sounding'])).toBeInTheDocument();

    // The listener picks their own chain mid-game.
    act(() => {
      applyDspSettings({ ...readDspSettings(), presetId: 'late-night' });
    });
    // No longer the game's sound, so the row no longer claims it is.
    expect(
      screen.queryByText(en['games.row.sounding']),
    ).not.toBeInTheDocument();

    theGameEnds(4242);
    expect(readDspSettings().presetId).toBe('late-night');
    expect(bridge.showGameToast).toHaveBeenCalledTimes(1);
  });

  it('leaves the sound alone for a program with no profile, and says nothing about it', async () => {
    await show();
    addFromMenu('Overwatch');
    comesToTheFront(CHROME);
    expect(readDspSettings().presetId).toBe('music');
    // The line at the top is for this listener's own games. Narrating every
    // window somebody opens is noise on a page nobody has asked a question.
    expect(screen.queryByText(/Google Chrome/)).not.toBeInTheDocument();
  });

  it('leaves the sound alone with the page open and nothing else mounted', async () => {
    render(<GamesPanel />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: en['games.add'] }),
      ).toBeEnabled(),
    );
    addFromMenu('Overwatch');
    comesToTheFront(OVERWATCH);
    // The page is a page: it says what is in front and changes nothing.
    expect(readDspSettings().presetId).toBe('music');
  });

  it('watches only while there is something to match, and stops with the page', async () => {
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

/*
 * The switcher is mounted for the life of the window and re-renders with it.
 * It held the chain catalogue for the card a game raises, and holding it read
 * every saved chain and the stars out of storage on each of those renders.
 */
describe('the window’s own switcher', () => {
  it('reads no saved chain while it only renders', () => {
    const view = render(<GameSound />);
    const getItem = jest.spyOn(Storage.prototype, 'getItem');

    view.rerender(<GameSound />);
    view.rerender(<GameSound />);

    expect(
      getItem.mock.calls.filter(([key]) =>
        [
          'fluideq.dsp.userChainPresets.v1',
          'fluideq.dsp.favouritePresets.v1',
        ].includes(key),
      ),
    ).toEqual([]);
    getItem.mockRestore();
    view.unmount();
  });
});
