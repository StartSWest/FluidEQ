/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import type { BrowserWindow, ThumbarButton } from 'electron';
import { loadLocale } from 'common/i18n';
import {
  ITaskbarTransportState,
  TASKBAR_TRANSPORT_STATE,
} from 'common/taskbarTransport';

const handlers = new Map<string, (event: unknown, state: unknown) => void>();
const theme = Object.assign(new EventEmitter(), {
  shouldUseDarkColorsForSystemIntegratedUI: true,
});
jest.mock('../../../main/taskbarMessages', () => jest.fn());
// No listening group unless a case says so, as the real module answers
// before a group has installed its forwarder.
jest.mock('../../../main/groupMediaKeys', () => ({
  forwardGroupMediaCommand: jest.fn(() => false),
}));
jest.mock('electron', () => ({
  ipcMain: {
    handle: (
      channel: string,
      handler: (event: unknown, state: unknown) => void,
    ) => handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
  nativeTheme: theme,
  nativeImage: {
    createFromPath: (file: string) => ({
      file,
      isEmpty: () => !fs.existsSync(file),
    }),
  },
}));
// eslint-disable-next-line import/first -- install the Electron boundary before loading the controller
import installTaskbarTransport from '../../../main/taskbarTransport';
// eslint-disable-next-line import/first -- the mock installed above
import allowTaskbarMessages from '../../../main/taskbarMessages';
// eslint-disable-next-line import/first -- the mock installed above
import { forwardGroupMediaCommand } from '../../../main/groupMediaKeys';

/** What reached the shell, in order: the message filter and each toolbar. */
let shellCalls: string[];

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
let buttons: ThumbarButton[];
let updates: number;
let delivered: unknown[][];
let accept: boolean;
let visible: boolean;
let minimized: boolean;
let window: BrowserWindow;
const state: ITaskbarTransportState = {
  canToggle: true,
  canPrevious: true,
  canNext: true,
  isPlaying: false,
  // The Library owns the transport: all four buttons do something.
  canSurprise: true,
  locale: 'en',
  navigation: 'tracks',
};
const publish = (next: unknown = state, event: unknown = undefined) =>
  handlers.get(TASKBAR_TRANSPORT_STATE)?.(
    event ?? {
      sender: window.webContents,
      senderFrame: window.webContents.mainFrame,
    },
    next,
  );

beforeEach(() => {
  shellCalls = [];
  (allowTaskbarMessages as jest.Mock).mockReset();
  (forwardGroupMediaCommand as jest.Mock).mockReset();
  (forwardGroupMediaCommand as jest.Mock).mockReturnValue(false);
  (allowTaskbarMessages as jest.Mock).mockImplementation(() => {
    shellCalls.push('allow');
  });
  Object.defineProperty(process, 'platform', { value: 'win32' });
  handlers.clear();
  buttons = [];
  updates = 0;
  delivered = [];
  accept = true;
  visible = true;
  minimized = false;
  theme.shouldUseDarkColorsForSystemIntegratedUI = true;
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: {},
    isDestroyed: () => false,
    send: (...args: unknown[]) => delivered.push(args),
  });
  window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false,
    isVisible: () => visible,
    isMinimized: () => minimized,
    getNativeWindowHandle: () => Buffer.alloc(8),
    setThumbarButtons: (next: ThumbarButton[]) => {
      // Electron 43's GetThumbarButtonFlags accepts these strings only.
      // Its TypeScript "enabled" option silently rejects the whole toolbar.
      const supportedFlags = [
        'disabled',
        'dismissonclick',
        'nobackground',
        'hidden',
        'noninteractive',
      ];
      if (
        next.some((button) =>
          button.flags?.some((flag) => !supportedFlags.includes(flag)),
        )
      ) {
        return false;
      }
      buttons = next;
      updates += 1;
      shellCalls.push('buttons');
      return accept;
    },
  }) as unknown as BrowserWindow;
  installTaskbarTransport(
    window,
    path.resolve(__dirname, '../../../../assets'),
  );
});
afterEach(() => {
  window.emit('closed');
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
});

it('draws native controls with real packaged assets and dispatches only enabled actions', () => {
  window.emit('ready-to-show');
  expect(buttons).toHaveLength(4);
  buttons.forEach((button) => button.click?.());
  expect(delivered).toEqual([]);
  publish();
  buttons.forEach((button) => button.click?.());
  expect(delivered).toEqual([
    ['taskbar-transport-action', 'previous'],
    ['taskbar-transport-action', 'toggle'],
    ['taskbar-transport-action', 'next'],
    ['taskbar-transport-action', 'surprise'],
  ]);
  expect(buttons[1].tooltip).toBe('Play');
  expect(buttons[3].tooltip).toBe('Surprise me');
  expect(buttons[3].icon).toMatchObject({
    file: expect.stringContaining('surprise-light.png'),
  });
  const oldToggle = buttons[1].click;
  publish({ ...state, canToggle: false, canNext: false, isPlaying: true });
  expect(buttons[1].tooltip).toBe('Pause');
  expect(buttons[2].flags).toEqual(['disabled']);
  oldToggle?.();
  expect(delivered).toHaveLength(4);
});

it('hides Surprise me, never greys it, while the Library does not own the transport', () => {
  // Another player owns the transport: its three buttons work, the fourth
  // keeps its place in the shell's list but is not shown.
  publish({ ...state, canSurprise: false });
  expect(buttons).toHaveLength(4);
  expect(
    buttons.slice(0, 3).every((button) => button.flags?.length === 0),
  ).toBe(true);
  expect(buttons[3].flags).toEqual(['hidden']);
  buttons[3].click?.();
  expect(delivered).toEqual([]);

  // The control: the Library takes the transport and the button is shown.
  publish();
  expect(buttons[3].flags).toEqual([]);
  buttons[3].click?.();
  expect(delivered).toEqual([['taskbar-transport-action', 'surprise']]);
});

it('forwards the transport to a listening group, but never Surprise me', () => {
  publish();
  (forwardGroupMediaCommand as jest.Mock).mockReturnValue(true);
  buttons[1].click?.();
  // The control: the group took the toggle, so the window heard nothing.
  expect(forwardGroupMediaCommand).toHaveBeenCalledWith({ command: 'toggle' });
  expect(delivered).toEqual([]);

  buttons[3].click?.();
  expect(forwardGroupMediaCommand).toHaveBeenCalledTimes(1);
  expect(delivered).toEqual([['taskbar-transport-action', 'surprise']]);
});

it('rejects other frames and malformed state without changing the toolbar', () => {
  publish();
  publish(
    { ...state, isPlaying: true },
    { sender: window.webContents, senderFrame: {} },
  );
  publish(
    { ...state, isPlaying: true },
    { sender: {}, senderFrame: window.webContents.mainFrame },
  );
  [
    null,
    {},
    { ...state, canToggle: 'yes' },
    { ...state, navigation: 'arbitrary' },
    { ...state, canSurprise: 'yes' },
  ].forEach((invalid) => publish(invalid));
  expect(updates).toBe(1);
  expect(buttons[1].tooltip).toBe('Play');
});

it('registers enabled controls using flags accepted by the Electron native parser', () => {
  publish();
  expect(updates).toBe(1);
  expect(buttons).toHaveLength(4);
  expect(buttons.every((button) => button.flags?.length === 0)).toBe(true);
});

it('waits for a taskbar entry and reinstalls unchanged controls after hiding to tray', () => {
  visible = false;
  publish();
  window.emit('ready-to-show');
  expect(updates).toBe(0);
  visible = true;
  window.emit('show');
  expect(updates).toBe(1);
  visible = false;
  window.emit('hide');
  buttons = []; // Windows removes the toolbar when the window is hidden.
  publish({ ...state, isPlaying: true });
  expect(updates).toBe(1);
  visible = true;
  window.emit('show');
  expect(buttons).toHaveLength(4);
  expect(buttons[1].tooltip).toBe('Pause');
  expect(updates).toBe(2);
  visible = false;
  window.emit('hide');
  buttons = [];
  visible = true;
  window.emit('show');
  expect(buttons).toHaveLength(4);
  expect(updates).toBe(3);
});

it('registers controls when starting minimized and keeps playback state current', () => {
  visible = false;
  publish();
  expect(updates).toBe(0);
  minimized = true;
  window.emit('minimize');
  expect(updates).toBe(1);
  publish({ ...state, isPlaying: true });
  expect(buttons[1].tooltip).toBe('Pause');
  expect(updates).toBe(2);
});

it('deduplicates state, changes glyph contrast with Windows, and localizes karaoke arrows', async () => {
  publish();
  publish();
  expect(updates).toBe(1);
  expect(buttons[1].icon).toMatchObject({
    file: expect.stringContaining('play-light.png'),
  });
  theme.shouldUseDarkColorsForSystemIntegratedUI = false;
  theme.emit('updated');
  expect(buttons[1].icon).toMatchObject({
    file: expect.stringContaining('play-dark.png'),
  });
  publish({ ...state, locale: 'es', navigation: 'boundaries' });
  // Main holds only English until a language is asked for: the buttons go up
  // in English and are written again once the dictionary has loaded.
  expect(buttons[1].tooltip).toBe('Play');
  await loadLocale('es');
  expect(buttons[1].tooltip).toBe('Reproducir');
  expect(buttons[0].tooltip).not.toBe('Previous');
  expect(buttons[2].tooltip).not.toBe('Next');
});

/**
 * The toolbar a dead or navigating page leaves: the transport greyed, and
 * Surprise me hidden, as it always is while nothing offers it.
 */
const expectClearedToolbar = () => {
  expect(buttons.map((button) => button.flags)).toEqual([
    ['disabled'],
    ['disabled'],
    ['disabled'],
    ['hidden'],
  ]);
};

it('retries a refused shell write on show and clears stale controls on navigation/crash', () => {
  accept = false;
  publish();
  accept = true;
  window.emit('show');
  expect(updates).toBe(2);
  window.webContents.emit('did-start-navigation', {
    isMainFrame: false,
    isSameDocument: false,
  });
  expect(updates).toBe(2);
  window.webContents.emit('did-start-navigation', {
    isMainFrame: true,
    isSameDocument: false,
  });
  expectClearedToolbar();
  publish();
  window.webContents.emit('render-process-gone');
  expectClearedToolbar();
  window.emit('closed');
  expect(handlers.size).toBe(0);
  expect(theme.listenerCount('updated')).toBe(0);
});

it("lets Explorer's clicks through at the window's first show, ahead of the buttons, and once", () => {
  // Installed with the page, not before it is on screen: koffi stays unloaded
  // for as long as there is no taskbar entry to put buttons on.
  visible = false;
  publish();
  window.emit('ready-to-show');
  expect(allowTaskbarMessages).not.toHaveBeenCalled();
  visible = true;
  window.emit('show');
  expect(shellCalls).toEqual(['allow', 'buttons']);
  window.emit('hide');
  window.emit('show');
  publish({ ...state, isPlaying: true });
  expect(allowTaskbarMessages).toHaveBeenCalledTimes(1);
});

it('lets the clicks through at a first minimize too, and keeps the buttons when that fails', () => {
  (allowTaskbarMessages as jest.Mock).mockImplementation(() => {
    shellCalls.push('allow');
    throw new Error('refused');
  });
  visible = false;
  publish();
  expect(allowTaskbarMessages).not.toHaveBeenCalled();
  minimized = true;
  window.emit('minimize');
  expect(shellCalls).toEqual(['allow', 'buttons']);
  window.emit('minimize');
  expect(allowTaskbarMessages).toHaveBeenCalledTimes(1);
});
