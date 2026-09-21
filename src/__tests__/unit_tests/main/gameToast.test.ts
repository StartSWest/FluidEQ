/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window the desktop card is drawn in.
 *
 * Two failures this holds, and both shipped. The card was drawn blank twice:
 * the first time its page refused its own script, and the second time the
 * page was fixed and the card still came up empty, because the window was
 * opened in the app's own session and the app puts its content policy on
 * every document in that session — a policy that refuses inline script,
 * whatever the page says about itself. Neither is visible in the markup or
 * the page's own test; only the window's session says it.
 *
 * And the card wore one theme's cyan on one theme's navy whatever the window
 * looked like, so the window's own colours now travel to it — and only
 * colours, and only the five the page declares.
 */

const mockFromPartition = jest.fn();
const mockLoadFile = jest.fn(() => Promise.resolve());
const mockCreated: { options?: Record<string, unknown> }[] = [];

jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation((options) => {
    mockCreated.push({ options });
    return {
      setAlwaysOnTop: jest.fn(),
      setVisibleOnAllWorkspaces: jest.fn(),
      setIgnoreMouseEvents: jest.fn(),
      once: jest.fn(),
      on: jest.fn(),
      isDestroyed: () => false,
      close: jest.fn(),
      showInactive: jest.fn(),
      loadFile: mockLoadFile,
    };
  }),
  screen: {
    getDisplayNearestPoint: () => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    }),
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
  },
  session: { fromPartition: mockFromPartition },
}));

jest.mock('electron-log', () => ({ info: jest.fn() }));

// eslint-disable-next-line import/first
import { createGameToasts } from '../../../main/gameToast';

const ownSession = {
  setPermissionRequestHandler: jest.fn(),
  setPermissionCheckHandler: jest.fn(),
};

const searchOf = (): URLSearchParams => {
  const [, options] = mockLoadFile.mock.calls[
    mockLoadFile.mock.calls.length - 1
  ] as unknown as [string, { search: string }];
  return new URLSearchParams(options.search);
};

beforeEach(() => {
  mockCreated.length = 0;
  mockLoadFile.mockClear();
  mockFromPartition.mockReset();
  mockFromPartition.mockReturnValue(ownSession);
});

describe('the window the game card is drawn in', () => {
  it('is never the app’s own session, whose policy refuses the card’s script', () => {
    createGameToasts().show({ what: 'Loaded Gaming', game: 'for Overwatch' });
    expect(mockFromPartition).toHaveBeenCalledWith('fluideq-game-card');
    const preferences = mockCreated[0].options?.webPreferences as {
      session?: unknown;
    };
    // The control that makes this mean something: without a session of its
    // own, Electron puts a window in the default one — the app's.
    expect(preferences.session).toBe(ownSession);
  });

  it('grants that session nothing: no camera, no microphone, no files', () => {
    createGameToasts().show({ what: 'Loaded Gaming', game: 'for Overwatch' });
    const [[ask]] = ownSession.setPermissionRequestHandler.mock.calls as [
      [
        (
          contents: unknown,
          permission: string,
          answer: (ok: boolean) => void,
        ) => void,
      ],
    ];
    const answer = jest.fn();
    ask(undefined, 'media', answer);
    expect(answer).toHaveBeenCalledWith(false);
  });

  it('carries the window’s own colours, and only the five the page knows', () => {
    createGameToasts().show({
      what: 'Loaded Gaming',
      game: 'for Overwatch',
      colors: {
        accent: '#fab1fb',
        panel: '#1b021c',
        base: 'rgb(14, 1, 15)',
        text: '#ecf5fb',
        muted: '#d6e9f7',
        other: '#ffffff',
      },
    });
    const said = searchOf();
    expect(said.get('accent')).toBe('#fab1fb');
    expect(said.get('panel')).toBe('#1b021c');
    expect(said.get('base')).toBe('rgb(14, 1, 15)');
    expect(said.get('text')).toBe('#ecf5fb');
    expect(said.get('muted')).toBe('#d6e9f7');
    expect(said.has('other')).toBe(false);
  });

  it('drops anything that is not plainly a colour', () => {
    createGameToasts().show({
      what: 'Loaded Gaming',
      game: 'for Overwatch',
      colors: {
        accent: 'red; background: url(https://example.com/)',
        panel: 'var(--x)',
        base: '',
        text: '#ecf5fb',
      },
    });
    const said = searchOf();
    expect(said.has('accent')).toBe(false);
    expect(said.has('panel')).toBe(false);
    expect(said.has('base')).toBe(false);
    // The positive control beside the refusals: a colour still goes through.
    expect(said.get('text')).toBe('#ecf5fb');
  });
});
