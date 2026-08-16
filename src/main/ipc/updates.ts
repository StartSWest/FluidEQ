/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { app, ipcMain } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { latestReleaseNotes } from '../../common/changelog';
import { IAuthorizedAutoUpdater } from '../signedAutoUpdates';

export interface IUpdatesIpcDeps {
  /**
   * Read per call, and undefined is a real answer.
   *
   * The updater is built asynchronously at startup and is deliberately left
   * unset when its signature or feed checks fail — an unsigned build has no
   * business installing anything. So this is a getter rather than the updater
   * itself: captured at registration it would be `undefined` forever, since
   * registration happens before setup finishes.
   */
  getActiveAutoUpdater: () => IAuthorizedAutoUpdater | undefined;
}

/**
 * What changed, and installing it.
 *
 * Two channels that are one subject from the user's side: the release notes
 * they read and the restart that applies them. The AutoEq database sync is
 * *not* here despite sharing the word — that refreshes measurement data and
 * belongs with the rest of the AutoEq handlers.
 */
export const registerUpdatesIpc = ({
  getActiveAutoUpdater,
}: IUpdatesIpcDeps) => {
  /**
   * The release notes for this version, read from the file that ships with the app.
   *
   * A file rather than a string baked into the bundle, so writing an entry is
   * editing CHANGELOG.md and nothing else — no constant to update, no chance of
   * the two drifting apart. It is also the same file people read on GitHub.
   *
   * The dialog opens two ways and they are not the same question. After an update
   * it opens by itself, and there "what's new" means the version just installed —
   * everything below it is by definition not new. Opened deliberately, from the
   * actions menu or from the support panel, it is somebody asking to read, and
   * the whole history is a fair answer.
   *
   * So the caller says which it wants, and the slicing happens here rather than
   * in the renderer because this is where the file is read.
   */
  ipcMain.handle('get-changelog', (_event, scope: 'latest' | 'all') => {
    const candidates = [
      path.join(process.resourcesPath, 'CHANGELOG.md'),
      path.join(__dirname, '../../CHANGELOG.md'),
      path.join(app.getAppPath(), 'CHANGELOG.md'),
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found) {
      return '';
    }
    try {
      const markdown = fs.readFileSync(found, 'utf8');
      return scope === 'all' ? markdown : latestReleaseNotes(markdown);
    } catch {
      return '';
    }
  });

  /**
   * Close FluidEQ and run the downloaded installer.
   *
   * Only ever reached from the "restart to update" button, which the renderer
   * only shows once electron-updater has reported the download finished — so by
   * the time this runs there is definitely something to install.
   */
  ipcMain.handle('install-update', () => {
    const updater = getActiveAutoUpdater();
    if (!updater) {
      throw new Error('Updates are disabled for this build.');
    }
    // `false` for isSilent: the NSIS installer shows its progress, which is the
    // honest thing when the app the user was using has just vanished.
    //
    // Rethrown rather than swallowed. The ordinary update banner already treats
    // a rejection as "put the button back", and the mandatory-update modal needs
    // it to reach the manual-install instructions — a blocking window whose only
    // button silently does nothing is the exact failure this must not have.
    try {
      updater.quitAndInstall(false, true);
    } catch (error) {
      log.info('Update install could not start', error);
      throw error;
    }
  });
};
