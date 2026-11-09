/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { ipcMain, type BrowserWindow } from 'electron';
import { ANIMATIONS_DIR } from '../../common/studioAnimation';
import {
  readProjectAnimations,
  type IProjectAnimation,
} from '../memberScenes/projectAnimations';

/**
 * The Studio's Animations tab: the open project's animations, read fresh on
 * every ask, and a word to the window whenever one of their files changes.
 *
 * Its own watch, because the project's watcher is told nothing of these: it
 * watches the folder's top alone, and sends a build only when the scene it
 * builds changed - an animation the member's AI writes beside the scene
 * changes neither. So the files are watched where they are: the folder's
 * top for `animations` arriving, `animations/` itself, and each folder a
 * sheet is kept in, for that sheet.
 */

export type TStudioAnimations =
  { kind: 'none' } | { kind: 'animations'; animations: IProjectAnimation[] };

export const ANIMATIONS_CHANGED = 'studio-animations-changed';

interface IFolderWatch {
  on(event: 'error', listener: (error: Error) => void): unknown;
  close(): void;
}

export interface IStudioAnimationsDeps {
  getMainWindow: () => BrowserWindow | null;
  mayEdit: () => boolean;
  activeFolder: () => string | undefined;
  watch?: (
    folder: string,
    onChange: (file: string | null) => void,
  ) => IFolderWatch;
}

const watchFolder = (
  folder: string,
  onChange: (file: string | null) => void,
): IFolderWatch =>
  // Never what keeps the app from quitting.
  fs.watch(folder, { persistent: false }, (_type, file) =>
    onChange(typeof file === 'string' ? file : null),
  );

/** Registers the handler; the returned function takes it away. */
export const registerStudioAnimationsIpc = ({
  getMainWindow,
  mayEdit,
  activeFolder,
  watch = watchFolder,
}: IStudioAnimationsDeps): (() => void) => {
  let watching: { folder: string; watches: IFolderWatch[] } | undefined;
  const unwatch = () => {
    watching?.watches.forEach((each) => each.close());
    watching = undefined;
  };
  const tell = () => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(ANIMATIONS_CHANGED);
    }
  };
  const tryWatch = (
    folder: string,
    wanted: (file: string | null) => boolean,
  ): IFolderWatch | undefined => {
    try {
      const made = watch(folder, (file) => {
        if (wanted(file)) {
          tell();
        }
      });
      made.on('error', () => undefined);
      return made;
    } catch {
      // A folder that is not there yet is watched through its parent.
      return undefined;
    }
  };
  /** Watches what `found` was read from, in place of what was watched before. */
  const rewatch = (folder: string, found: IProjectAnimation[]) => {
    unwatch();
    const sheets = new Map<string, Set<string>>();
    found.forEach(({ animation }) => {
      const directory = path.join(folder, path.dirname(animation.sheet));
      const names = sheets.get(directory) ?? new Set<string>();
      names.add(path.basename(animation.sheet));
      sheets.set(directory, names);
    });
    const watches = [
      tryWatch(folder, (file) => file === null || file === ANIMATIONS_DIR),
      tryWatch(path.join(folder, ANIMATIONS_DIR), () => true),
      ...[...sheets].map(([directory, names]) =>
        tryWatch(directory, (file) => file === null || names.has(file)),
      ),
    ].filter((each) => each !== undefined);
    watching = { folder, watches };
  };

  ipcMain.handle('studio-animations', async (): Promise<TStudioAnimations> => {
    const folder = activeFolder();
    if (!mayEdit() || !folder) {
      unwatch();
      return { kind: 'none' };
    }
    const animations = await readProjectAnimations(folder);
    // Another project may have opened while these were read.
    if (activeFolder() === folder) {
      rewatch(folder, animations);
    }
    return { kind: 'animations', animations };
  });
  return () => {
    unwatch();
    ipcMain.removeHandler('studio-animations');
  };
};
