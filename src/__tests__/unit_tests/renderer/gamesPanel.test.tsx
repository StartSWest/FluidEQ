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
import { applyDspSettings, readDspSettings } from 'renderer/dsp/store';

jest.mock('renderer/dsp/systemChain', () => ({
  sendSystemDspChain: jest.fn(),
  readSystemDspChainResult: () => undefined,
  subscribeSystemDspChainResult: () => () => undefined,
}));
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useAudioEngineStatus: () => ({ status: { engine: 'fluid' } }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({ setVoicing: jest.fn() }));
jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({
    isEnabled: true,
    isBlockingError: false,
    voicing: undefined,
    setVoicing: () => undefined,
    setGlobalError: () => undefined,
  }),
}));

const OVERWATCH: IGameProgram = {
  name: 'Overwatch',
  path: 'D:\\GAMES\\Overwatch',
  source: 'battlenet',
};
const CHROME: IGameProgram = {
  name: 'Google Chrome',
  path: 'C:\\Program Files\\Google\\Chrome\\chrome.exe',
  source: 'running',
};

let listeners: ((...args: unknown[]) => void)[] = [];

const bridge = {
  gamePrograms: jest.fn(() =>
    Promise.resolve({ installed: [OVERWATCH], running: [CHROME] }),
  ),
  watchGames: jest.fn(),
  chooseGameProgram: jest.fn(),
  showGameToast: jest.fn(),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    if (channel === 'game-foreground') {
      listeners.push(listener);
    }
    return () => {
      listeners = listeners.filter((one) => one !== listener);
    };
  },
};

/** What main would send when Windows puts a program in front. */
const comesToTheFront = (program: IGameProgram) =>
  act(() => {
    listeners.forEach((listener) => listener(program));
  });

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
    expect(readGameProfiles()).toEqual([
      expect.objectContaining({ name: 'Overwatch', path: OVERWATCH.path }),
    ]);
    // And it leaves the menu, because it is on the page now.
    fireEvent.click(screen.getByRole('button', { name: en['games.add'] }));
    expect(
      screen.queryByRole('menuitemradio', { name: /Overwatch/ }),
    ).not.toBeInTheDocument();
  });

  it('plays a game’s sound when it comes to the front and puts it back after', async () => {
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

    comesToTheFront(OVERWATCH);
    await waitFor(() => expect(readDspSettings().presetId).toBe('gaming'));
    expect(screen.getByText(en['games.row.inFront'])).toBeInTheDocument();
    // And it says so where somebody playing can see it: on the desktop,
    // drawn by main, because this window is behind the game by then.
    await waitFor(() =>
      expect(bridge.showGameToast).toHaveBeenCalledWith({
        what: en['games.toast.loaded'].replace('{preset}', 'Gaming'),
        game: en['games.toast.forGame'].replace('{game}', 'Overwatch'),
      }),
    );

    comesToTheFront(CHROME);
    await waitFor(() => expect(readDspSettings().presetId).toBe('music'));
    expect(screen.queryByText(en['games.row.inFront'])).not.toBeInTheDocument();
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
});
