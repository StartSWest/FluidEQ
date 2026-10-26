/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { TASKBAR_ICON_CHANNEL, TASKBAR_ICON_SIZES } from 'common/taskbarIcon';
import { encodeIco, registerTaskbarIconIpc } from 'main/taskbarIcon';

type THandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;
const mockHandlers = new Map<string, THandler>();

jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: THandler) =>
      mockHandlers.set(channel, handler),
    removeHandler: (channel: string) => mockHandlers.delete(channel),
  },
}));

/** One drawing whose every pixel is (r, g, b, a). */
const solid = (size: number, rgba: [number, number, number, number]) => {
  const pixels = new Uint8Array(size * size * 4);
  for (let at = 0; at < pixels.length; at += 4) {
    pixels.set(rgba, at);
  }
  return { size, rgba: pixels };
};

/**
 * The icon file main hands Windows: every drawing a frame, smallest first,
 * each one a 32-bit DIB Windows reads at its own size.
 */
describe('the taskbar icon file', () => {
  it('holds every drawing as its own frame, smallest first', () => {
    const ico = encodeIco([
      solid(32, [0, 0, 0, 255]),
      solid(16, [0, 0, 0, 255]),
    ]);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    expect(ico[6]).toBe(16);
    expect(ico[22]).toBe(32);
  });

  it('writes 256 as the zero the size byte cannot hold', () => {
    const ico = encodeIco([solid(256, [0, 0, 0, 255])]);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });

  it('lays each frame out as Windows reads it: BGRA, bottom row first', () => {
    const drawing = solid(16, [0, 0, 0, 0]);
    // The top-left pixel red and opaque, everything else clear.
    drawing.rgba.set([255, 0, 0, 255], 0);
    const ico = encodeIco([drawing]);
    const frame = ico.readUInt32LE(6 + 12);
    expect(ico.readUInt32LE(frame)).toBe(40);
    expect(ico.readInt32LE(frame + 8)).toBe(32);
    expect(ico.readUInt16LE(frame + 14)).toBe(32);
    // The top row is the last of the sixteen.
    const topLeft = frame + 40 + 15 * 16 * 4;
    expect([...ico.subarray(topLeft, topLeft + 4)]).toEqual([0, 0, 255, 255]);
    expect([...ico.subarray(frame + 40, frame + 44)]).toEqual([0, 0, 0, 0]);
  });
});

const allSizes = () =>
  TASKBAR_ICON_SIZES.map((size) => solid(size, [200, 150, 255, 255]));

describe('setting the taskbar icon', () => {
  const realPlatform = process.platform;
  let folder: string;
  let window: BrowserWindow;
  let dispose: () => void;
  const logger = { error: jest.fn() };
  const onIconFile = jest.fn();
  const contents = { mainFrame: {} };

  const askFrom = (sender: unknown, request: unknown, frame?: unknown) => {
    const handler = mockHandlers.get(TASKBAR_ICON_CHANNEL);
    if (!handler) {
      throw new Error('the taskbar icon channel was never registered');
    }
    return handler(
      {
        sender,
        senderFrame: frame ?? (sender as typeof contents).mainFrame,
      } as unknown as IpcMainInvokeEvent,
      request,
    );
  };

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-taskbar-'));
    window = {
      webContents: contents,
      isDestroyed: () => false,
      setIcon: jest.fn(),
    } as unknown as BrowserWindow;
    logger.error.mockReset();
    onIconFile.mockReset();
    ({ dispose } = registerTaskbarIconIpc({
      userDataDir: folder,
      stockIconPath: 'C:\\FluidEQ\\assets\\icon.ico',
      getWindow: () => window,
      logger,
      onIconFile,
    }));
  });

  afterEach(() => {
    dispose();
    Object.defineProperty(process, 'platform', { value: realPlatform });
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it('points the window at a file of every size drawn', async () => {
    await askFrom(contents, { kind: 'drawn', images: allSizes() });
    const written = path.join(folder, 'taskbar-icon.ico');
    expect(window.setIcon).toHaveBeenCalledWith(written);
    const ico = fs.readFileSync(written);
    expect(ico.readUInt16LE(4)).toBe(TASKBAR_ICON_SIZES.length);
    expect(fs.existsSync(`${written}.tmp`)).toBe(false);
  });

  it('puts the installed icon back for the app’s own colours', async () => {
    await askFrom(contents, { kind: 'stock' });
    expect(window.setIcon).toHaveBeenCalledWith(
      'C:\\FluidEQ\\assets\\icon.ico',
    );
  });

  it('hands the tray the drawn file, and nothing once the icon is the installed one', async () => {
    await askFrom(contents, { kind: 'drawn', images: allSizes() });
    expect(onIconFile).toHaveBeenLastCalledWith(
      path.join(folder, 'taskbar-icon.ico'),
    );
    await askFrom(contents, { kind: 'stock' });
    expect(onIconFile).toHaveBeenLastCalledWith(undefined);
  });

  it('refuses a set that lacks a size, or carries pixels of the wrong length', async () => {
    await askFrom(contents, {
      kind: 'drawn',
      images: allSizes().slice(1),
    });
    const short = allSizes();
    short[0] = { size: 16, rgba: new Uint8Array(10) };
    await askFrom(contents, { kind: 'drawn', images: short });
    expect(window.setIcon).not.toHaveBeenCalled();
  });

  it('answers nobody but the window, and not a frame inside it', () => {
    expect(() => askFrom({ mainFrame: {} }, { kind: 'stock' })).toThrow(
      'Only FluidEQ sets its taskbar icon.',
    );
    expect(() => askFrom(contents, { kind: 'stock' }, {})).toThrow(
      'Only FluidEQ sets its taskbar icon.',
    );
    expect(window.setIcon).not.toHaveBeenCalled();
  });

  it('leaves the icon alone away from Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    await askFrom(contents, { kind: 'stock' });
    expect(window.setIcon).not.toHaveBeenCalled();
  });
});
