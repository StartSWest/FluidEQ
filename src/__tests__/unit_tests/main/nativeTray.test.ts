/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ-Tray as the app uses it: what `tray.ts` decided, in the tray's
 * words; the quit recipe kept current with the engine's folder; and the
 * starts that leave the tray to Electron.
 */

import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import log from 'electron-log';
import {
  nativeTraySurface,
  trayHostStateOf,
} from '../../../main/nativeTray/nativeTray';
import { startNativeTray } from '../../../main/nativeTray/startNativeTray';
import type {
  ITrayHost,
  ITrayHostParts,
} from '../../../main/nativeTray/trayHostProcess';
import type { ITrayView } from '../../../main/trayView';

jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const VIEW: ITrayView = {
  icon: 'C:\\app\\icon-update.ico',
  tooltip: 'FluidEQ — update ready to install',
  menu: [
    {
      id: 'install-update',
      label: 'Install update and restart',
      mark: 'update',
      separatorAfter: true,
    },
    { id: 'open', label: 'Open FluidEQ', mark: 'app' },
    { id: 'quit', label: 'Quit FluidEQ' },
  ],
  marks: { plain: 'C:\\app\\icon.ico', update: 'C:\\app\\icon-update.ico' },
};

describe("the tray's view in FluidEQ-Tray's words", () => {
  it('gives each mark its .ico, and a bare item none', () => {
    expect(trayHostStateOf(VIEW)).toEqual({
      tooltip: 'FluidEQ — update ready to install',
      icon: 'C:\\app\\icon-update.ico',
      menu: [
        {
          id: 'install-update',
          label: 'Install update and restart',
          icon: 'C:\\app\\icon-update.ico',
          separatorAfter: true,
        },
        { id: 'open', label: 'Open FluidEQ', icon: 'C:\\app\\icon.ico' },
        { id: 'quit', label: 'Quit FluidEQ' },
      ],
    });
  });

  it("wears the drawn icon on the app's own item while it is on", () => {
    const tinted = {
      ...VIEW,
      marks: {
        ...VIEW.marks,
        tinted: { file: 'C:\\data\\taskbar-icon.ico', drawings: [] },
      },
    };
    expect(trayHostStateOf(tinted).menu[1].icon).toBe(
      'C:\\data\\taskbar-icon.ico',
    );
    // The badge is the update's alone.
    expect(trayHostStateOf(tinted).menu[0].icon).toBe(
      'C:\\app\\icon-update.ico',
    );
  });

  it('shows through the host, hears its presses, and closes it', () => {
    const shown: unknown[] = [];
    let press: ((action: 'open') => void) | undefined;
    const host = {
      show: (state: unknown) => shown.push(state),
      onPressed: (listener: (action: 'open') => void) => {
        press = listener;
      },
      close: jest.fn(),
    } as unknown as ITrayHost;
    const pressed = jest.fn();
    const surface = nativeTraySurface(host)(pressed);
    surface?.show(VIEW);
    expect(shown).toEqual([trayHostStateOf(VIEW)]);
    press?.('open');
    expect(pressed).toHaveBeenCalledWith('open');
    surface?.destroy();
    expect(host.close).toHaveBeenCalled();
  });
});

/** A tray that is ready and says hello at once, whose lines are recorded. */
const answeringParts = (ownerPipe: boolean) => {
  const written: string[] = [];
  const socket = Object.assign(new EventEmitter(), {
    write: (text: string) => written.push(text),
    destroy: () => undefined,
  });
  const parts: ITrayHostParts = {
    start: () => {
      const stdout = new PassThrough();
      stdout.write('ready\n');
      return Object.assign(new EventEmitter(), {
        stdout,
        unref: () => undefined,
      });
    },
    connect: () => {
      process.nextTick(() =>
        socket.emit(
          'data',
          Buffer.from(`{"type":"hello","pid":3,"ownerPipe":${ownerPipe}}\n`),
        ),
      );
      return socket;
    },
  };
  const messages = () =>
    written.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { parts, socket, messages };
};

describe('starting FluidEQ-Tray from main', () => {
  const realPlatform = process.platform;
  const onPlatform = (platform: string) =>
    Object.defineProperty(process, 'platform', { value: platform });
  afterEach(() => onPlatform(realPlatform));

  it('tells the tray what a quit undoes, and again whenever the folder moves', async () => {
    onPlatform('win32');
    const { parts, messages } = answeringParts(true);
    const tray = await startNativeTray({
      userDataDir: 'C:\\data',
      ownerPipe: '\\\\.\\pipe\\FluidEQ-Engine-Owner',
      configPath: 'C:\\ProgramData\\FluidEQ\\engine\\config',
      onLost: () => undefined,
      find: () => 'C:\\app\\FluidEQ-Tray.exe',
      parts,
    });
    expect(tray).toBeDefined();
    tray?.setConfigPath('');
    tray?.setConfigPath('C:\\Program Files\\EqualizerAPO\\config');
    const recipes = messages().map(
      (message) =>
        (message.recipe as { configDir?: string } | undefined)?.configDir,
    );
    expect(recipes).toEqual([
      'C:\\ProgramData\\FluidEQ\\engine\\config',
      undefined,
      'C:\\Program Files\\EqualizerAPO\\config',
    ]);
    expect(messages().every((message) => message.type === 'recipe')).toBe(true);
  });

  it('says plainly when the tray could not hold the engine line', async () => {
    onPlatform('win32');
    const { parts } = answeringParts(false);
    await startNativeTray({
      userDataDir: 'C:\\data',
      ownerPipe: '\\\\.\\pipe\\FluidEQ-Engine-Owner',
      configPath: '',
      onLost: () => undefined,
      find: () => 'tray.exe',
      parts,
    });
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot see FluidEQ end'),
    );
  });

  it('hands the loss of the tray to main', async () => {
    onPlatform('win32');
    const { parts, socket } = answeringParts(true);
    const onLost = jest.fn();
    await startNativeTray({
      userDataDir: 'C:\\data',
      configPath: '',
      onLost,
      find: () => 'tray.exe',
      parts,
    });
    socket.emit('close');
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('leaves the tray to Electron off Windows and where the program is missing', async () => {
    const start = jest.fn();
    const parts = { start, connect: jest.fn() } as unknown as ITrayHostParts;
    onPlatform('linux');
    await expect(
      startNativeTray({
        userDataDir: 'C:\\data',
        configPath: '',
        onLost: () => undefined,
        find: () => 'tray.exe',
        parts,
      }),
    ).resolves.toBeUndefined();
    onPlatform('win32');
    await expect(
      startNativeTray({
        userDataDir: 'C:\\data',
        configPath: '',
        onLost: () => undefined,
        find: () => undefined,
        parts,
      }),
    ).resolves.toBeUndefined();
    expect(start).not.toHaveBeenCalled();
  });
});
