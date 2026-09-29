/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { app, BrowserWindow } from 'electron';
import log from 'electron-log';
import { sweepAbandonedWrites } from './asyncWriter';
import { karaokeMakerDraftDir } from './karaokeMakerStorage';
import { karaokeStemsDir } from './karaokeSeparation';
import {
  claimInstance,
  describeInstanceHolder,
  instanceLockPath,
} from './singleInstance';

export interface IOnlyCopyDeps {
  userDataDir: string;
  getMainWindow: () => BrowserWindow | null;
}

/**
 * ONE COPY, WHICH THE TRAY MADE NECESSARY.
 *
 * A window that hides instead of closing looks to the user exactly like an app
 * that is not running, so the next thing they do is open it from the Start
 * menu or the desktop shortcut — and without this that starts a second
 * process. Two copies of FluidEQ is not a cosmetic problem: both write the
 * same Equalizer APO config and both watch it for outside edits, so they
 * spend their time overwriting each other and reporting the result as
 * somebody else changing the file.
 *
 * The second copy exits immediately and hands its launch to the first, which
 * brings the hidden window back — which is what the person wanted when they
 * clicked the shortcut.
 *
 * Resolves true once this copy holds the app. Asked before anything is made:
 * `onAppReady` waits for it, so a copy on its way out never builds a window, a
 * tray or a pipe of its own.
 */
const claimTheOnlyCopy = ({
  userDataDir,
  getMainWindow,
}: IOnlyCopyDeps): Promise<boolean> => {
  /**
   * Named for the folder both data directories sit in rather than either one,
   * because the whole point is that development and the installed build do
   * not share one (`singleInstance.ts`).
   */
  const lockPath = instanceLockPath(app.getPath('appData'));

  let releaseInstanceLock: (() => void) | undefined;

  const becomesTheOnlyCopy = async (): Promise<boolean> => {
    if (!app.requestSingleInstanceLock()) {
      // Another copy of THIS build holds Electron's lock, so this one hands
      // its launch over and goes. It used to go without a word, and that is
      // the single reason "the installer opens FluidEQ and it closes again"
      // could not be answered from a bug report: this was the one path out of
      // the whole start-up that wrote nothing anywhere, so the log of such a
      // launch was indistinguishable from the app never having been started
      // at all. Who holds the cross-build lock goes with it, because the copy
      // still holding Electron's is usually one an installer has just killed.
      const holder = await describeInstanceHolder(lockPath);
      log.warn(
        `Another copy of this build already holds the single-instance lock, so this launch is handing over and quitting. ${holder}`,
      );
      app.quit();
      return false;
    }
    const claim = await claimInstance(lockPath);
    if (claim.status === 'taken') {
      // Electron's lock did not catch this one, so it is the other build: dev
      // started while the installed copy is running, or the other way round.
      // Said out loud rather than quitting blankly — a window that never
      // appears is the sort of thing somebody spends an evening on.
      log.warn(
        `Another copy of FluidEQ is already running; this one is quitting so the two do not fight over the Equalizer APO config. ${claim.holder}`,
      );
      app.quit();
      return false;
    }
    // One FluidEQ at a time, whatever build or checkout it comes from: two
    // copies write the same engine config and adopt each other's writes.
    releaseInstanceLock = claim.release;
    // Temporary files an earlier run was killed in the middle of writing. The
    // library index, the Karaoke session, the band layout, the stems and the
    // Karaoke Maker's drafts are written beside themselves and renamed over,
    // each temporary named for its own write, so none is ever overwritten by
    // the next save: End task, a crash, a power cut or a logoff mid-write left
    // each one for good — tens of megabytes for the index or a stem. Swept
    // here, once this copy holds the app, so a second launch handing over can
    // never sweep a write the first is still making; not waited for. The
    // engine's folder is swept by `engineOwnerPipe.ts`.
    [userDataDir, karaokeStemsDir(), karaokeMakerDraftDir(userDataDir)].forEach(
      (directory) => {
        sweepAbandonedWrites(directory)
          .then((swept) => {
            if (swept > 0) {
              log.info(
                `Swept ${swept} unfinished write(s) an earlier run left in ${directory}.`,
              );
            }
            return swept;
          })
          .catch(() => undefined);
      },
    );
    return true;
  };

  const isTheOnlyCopy = becomesTheOnlyCopy();

  app.on('second-instance', () => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  app.on('will-quit', () => {
    releaseInstanceLock?.();
  });

  return isTheOnlyCopy;
};

export default claimTheOnlyCopy;
