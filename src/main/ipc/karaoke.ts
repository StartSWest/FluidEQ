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

import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import {
  clearKaraokeSession,
  readRestoredKaraokeFile,
  restoreKaraokeSession,
  saveKaraokeSession,
} from '../karaokeSession';
import {
  deleteKaraokeMakerDraft,
  loadKaraokeMakerDraft,
  normalizeKaraokeMakerExport,
  saveKaraokeMakerDraft,
} from '../karaokeMakerStorage';
import { IKaraokeSessionSnapshot } from '../../common/karaoke/sessionPersistence';

/**
 * What these handlers need from the process around them.
 *
 * Two things, and that is the point of writing it down: the Karaoke channels
 * touch a directory and a window and nothing else. Read from `main.ts` this was
 * not visible — every handler there can reach every one of sixteen mutable
 * module variables, so the only way to know what one of them actually used was
 * to read it.
 *
 * `getMainWindow` is a function rather than the window itself because the
 * window is created, destroyed and recreated over the life of the process. A
 * reference captured at registration would be the first one forever.
 */
export interface IKaraokeIpcDeps {
  userDataDir: string;
  getMainWindow: () => BrowserWindow | null;
}

/**
 * Session snapshots, Maker drafts, and the export save dialog.
 *
 * Every path here is built inside `karaokeSession` and `karaokeMakerStorage`
 * from `userDataDir` and a hashed project id — the id never becomes a filename,
 * so none of these channels can be steered at a path of the caller's choosing.
 */
export const registerKaraokeIpc = ({
  userDataDir,
  getMainWindow,
}: IKaraokeIpcDeps) => {
  ipcMain.handle(
    'karaoke-session-save',
    (_event, snapshot: IKaraokeSessionSnapshot) => {
      if (snapshot?.version !== 1 || !Array.isArray(snapshot.files)) {
        return;
      }
      saveKaraokeSession(userDataDir, snapshot);
    },
  );

  ipcMain.handle('karaoke-session-restore', () =>
    restoreKaraokeSession(userDataDir),
  );

  ipcMain.handle('karaoke-session-read-file', (_event, token: unknown) =>
    typeof token === 'string' ? readRestoredKaraokeFile(token) : undefined,
  );

  ipcMain.handle('karaoke-session-clear', () => {
    clearKaraokeSession(userDataDir);
  });

  ipcMain.handle('karaoke-maker-draft-save', (_event, project: unknown) => {
    saveKaraokeMakerDraft(userDataDir, project);
  });

  ipcMain.handle('karaoke-maker-draft-load', (_event, projectId: unknown) =>
    loadKaraokeMakerDraft(userDataDir, projectId),
  );

  ipcMain.handle('karaoke-maker-draft-delete', (_event, projectId: unknown) => {
    deleteKaraokeMakerDraft(userDataDir, projectId);
  });

  ipcMain.handle('karaoke-maker-export', async (_event, request: unknown) => {
    const output = normalizeKaraokeMakerExport(request);
    const options = {
      title: 'Export karaoke',
      defaultPath: output.fileName,
      filters: [
        { name: output.formatName, extensions: output.extensions },
        { name: 'All files', extensions: ['*'] },
      ],
    };
    const mainWindow = getMainWindow();
    const target = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);
    if (target.canceled || !target.filePath) {
      return { canceled: true };
    }
    fs.writeFileSync(target.filePath, output.contents, 'utf8');
    return { canceled: false, filePath: target.filePath };
  });
};
