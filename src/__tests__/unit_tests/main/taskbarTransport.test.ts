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
import {
  ITaskbarTransportState,
  TASKBAR_TRANSPORT_STATE,
} from 'common/taskbarTransport';

const handlers = new Map<string, (event: unknown, state: unknown) => void>();
const theme = Object.assign(new EventEmitter(), {
  shouldUseDarkColorsForSystemIntegratedUI: true,
});
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

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
let buttons: ThumbarButton[];
let updates: number;
let delivered: unknown[][];
let accept: boolean;
let window: BrowserWindow;
const state: ITaskbarTransportState = {
  canToggle: true,
  canPrevious: true,
  canNext: true,
  isPlaying: false,
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
  Object.defineProperty(process, 'platform', { value: 'win32' });
  handlers.clear();
  buttons = [];
  updates = 0;
  delivered = [];
  accept = true;
  theme.shouldUseDarkColorsForSystemIntegratedUI = true;
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: {},
    isDestroyed: () => false,
    send: (...args: unknown[]) => delivered.push(args),
  });
  window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false,
    setThumbarButtons: (next: ThumbarButton[]) => {
      buttons = next;
      updates += 1;
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
  expect(buttons).toHaveLength(3);
  buttons.forEach((button) => button.click?.());
  expect(delivered).toEqual([]);
  publish();
  buttons.forEach((button) => button.click?.());
  expect(delivered).toEqual([
    ['taskbar-transport-action', 'previous'],
    ['taskbar-transport-action', 'toggle'],
    ['taskbar-transport-action', 'next'],
  ]);
  expect(buttons[1].tooltip).toBe('Play');
  const oldToggle = buttons[1].click;
  publish({ ...state, canToggle: false, canNext: false, isPlaying: true });
  expect(buttons[1].tooltip).toBe('Pause');
  expect(buttons[2].flags).toEqual(['disabled']);
  oldToggle?.();
  expect(delivered).toHaveLength(3);
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
  ].forEach((invalid) => publish(invalid));
  expect(updates).toBe(1);
  expect(buttons[1].tooltip).toBe('Play');
});

it('deduplicates state, changes glyph contrast with Windows, and localizes karaoke arrows', () => {
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
  expect(buttons[1].tooltip).toBe('Reproducir');
  expect(buttons[0].tooltip).not.toBe('Previous');
  expect(buttons[2].tooltip).not.toBe('Next');
});

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
  expect(buttons.every((button) => button.flags?.includes('disabled'))).toBe(
    true,
  );
  publish();
  window.webContents.emit('render-process-gone');
  expect(buttons.every((button) => button.flags?.includes('disabled'))).toBe(
    true,
  );
  window.emit('closed');
  expect(handlers.size).toBe(0);
  expect(theme.listenerCount('updated')).toBe(0);
});
