/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs/promises';
import path from 'path';
import {
  ipcMain,
  type BrowserWindow,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron';
import {
  TASKBAR_ICON_CHANNEL,
  TASKBAR_ICON_SIZES,
  type TTaskbarIconRequest,
} from '../common/taskbarIcon';

/**
 * THE TASKBAR BUTTON IN THE WINDOW'S COLOURS (Ivan, 2026-10-26: "change the
 * color on the icon that is on the taskbar to match the app color"). The
 * window draws the icon at every size (`taskbarIconArt.ts`), this packs them
 * into one .ico and sets it on the window.
 *
 * A FILE, NOT A BITMAP. Electron hands Windows a window's small and large
 * icons at exactly the sizes the display asks for only when the icon came
 * from an .ico on disk; from an image in memory it makes both from one
 * bitmap, and Windows scales that, which is the soft icon the stock .ico was
 * made to avoid (`mainWindow.ts`). So each set is written beside the app's
 * data, temp then rename, and the window is pointed at it.
 *
 * A pinned shortcut, with FluidEQ closed, keeps the installed icon: that one
 * is Windows', read from the installed app.
 */

interface ILogger {
  error(message: string, ...details: unknown[]): void;
}

export interface ITaskbarIconDeps {
  userDataDir: string;
  /** The installed icon, for the window in the app's own colours. */
  stockIconPath: string;
  getWindow: () => BrowserWindow | null;
  logger: ILogger;
}

/** The size of one drawing's pixels: `size` × `size` RGBA. */
const rgbaLength = (size: number) => size * size * 4;

const isRequest = (value: unknown): value is TTaskbarIconRequest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const request = value as { kind?: unknown; images?: unknown };
  if (request.kind === 'stock') {
    return true;
  }
  if (request.kind !== 'drawn' || !Array.isArray(request.images)) {
    return false;
  }
  const sizes = request.images.map((image: unknown) => {
    const { size, rgba } = (image ?? {}) as { size?: unknown; rgba?: unknown };
    return typeof size === 'number' &&
      (TASKBAR_ICON_SIZES as readonly number[]).includes(size) &&
      rgba instanceof Uint8Array &&
      rgba.length === rgbaLength(size)
      ? size
      : undefined;
  });
  return (
    sizes.length === TASKBAR_ICON_SIZES.length &&
    TASKBAR_ICON_SIZES.every((size) => sizes.includes(size))
  );
};

/**
 * One drawing as an icon frame: a 32-bit DIB, rows bottom-up in BGRA, its
 * transparency in the alpha channel and an all-clear AND mask after it, the
 * form every Windows reads at every size.
 */
const dibFrame = (size: number, rgba: Uint8Array): Buffer => {
  const maskRow = Math.ceil(size / 32) * 4;
  const frame = Buffer.alloc(40 + rgbaLength(size) + maskRow * size);
  frame.writeUInt32LE(40, 0);
  frame.writeInt32LE(size, 4);
  // Twice the height: the colour rows and the mask rows.
  frame.writeInt32LE(size * 2, 8);
  frame.writeUInt16LE(1, 12);
  frame.writeUInt16LE(32, 14);
  frame.writeUInt32LE(rgbaLength(size) + maskRow * size, 20);
  for (let row = 0; row < size; row += 1) {
    const from = row * size * 4;
    const to = 40 + (size - 1 - row) * size * 4;
    for (let column = 0; column < size; column += 1) {
      const source = from + column * 4;
      const target = to + column * 4;
      frame[target] = rgba[source + 2];
      frame[target + 1] = rgba[source + 1];
      frame[target + 2] = rgba[source];
      frame[target + 3] = rgba[source + 3];
    }
  }
  return frame;
};

/** Every drawing in one .ico, smallest first. */
export const encodeIco = (
  images: readonly { size: number; rgba: Uint8Array }[],
): Buffer => {
  const ordered = [...images].sort((left, right) => left.size - right.size);
  const frames = ordered.map(({ size, rgba }) => dibFrame(size, rgba));
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  ordered.forEach(({ size }, index) => {
    const entry = 6 + index * 16;
    // 256 is written as 0: the byte cannot hold it.
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frames[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frames[index].length;
  });
  return Buffer.concat([header, ...frames]);
};

export const registerTaskbarIconIpc = (deps: ITaskbarIconDeps) => {
  const iconPath = path.join(deps.userDataDir, 'taskbar-icon.ico');
  const fromWindow = (event: IpcMainInvokeEvent) => {
    const contents: WebContents | undefined = deps.getWindow()?.webContents;
    return (
      contents !== undefined &&
      event.sender === contents &&
      event.senderFrame === contents.mainFrame
    );
  };
  // One set at a time, in the order asked: the window sends the next only
  // once this one is answered, and a write half done must never be what the
  // window is pointed at.
  let queue: Promise<void> = Promise.resolve();

  const apply = async (request: TTaskbarIconRequest) => {
    const window = deps.getWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    if (request.kind === 'stock') {
      window.setIcon(deps.stockIconPath);
      return;
    }
    const temporary = `${iconPath}.tmp`;
    await fs.writeFile(temporary, encodeIco(request.images));
    await fs.rename(temporary, iconPath);
    if (!window.isDestroyed()) {
      window.setIcon(iconPath);
    }
  };

  ipcMain.handle(TASKBAR_ICON_CHANNEL, (event, request: unknown) => {
    if (!fromWindow(event)) {
      throw new Error('Only FluidEQ sets its taskbar icon.');
    }
    // Windows only: the taskbar button is what this is for, and a Mac's dock
    // icon is another thing with rules of its own.
    if (process.platform !== 'win32' || !isRequest(request)) {
      return undefined;
    }
    queue = queue
      .then(() => apply(request))
      .catch((error) => {
        deps.logger.error('Taskbar icon: could not set the icon', error);
      });
    return queue;
  });

  return {
    dispose: () => ipcMain.removeHandler(TASKBAR_ICON_CHANNEL),
  };
};
