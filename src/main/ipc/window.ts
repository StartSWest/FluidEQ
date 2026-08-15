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

import { BrowserWindow, ipcMain } from 'electron';

export interface IWindowIpcDeps {
  /** Resolved per call — the window outlives none of these handlers. */
  getMainWindow: () => BrowserWindow | null;
  /**
   * Push the maximised/fullscreen flags to the renderer.
   *
   * Stays in `main.ts` rather than moving here: the same function is called
   * from the window's own `maximize`, `unmaximize` and `enter-full-screen`
   * events, which are wired where the window is built. Two callers, one of
   * which is not IPC at all.
   */
  sendWindowState: () => void;
}

/**
 * The titlebar's buttons.
 *
 * FluidEQ draws its own frame, so minimise, maximise and close are ordinary
 * renderer buttons that have to ask the main process to do the actual thing.
 */
export const registerWindowIpc = ({
  getMainWindow,
  sendWindowState,
}: IWindowIpcDeps) => {
  ipcMain.handle('window-minimize', () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle('window-toggle-maximize', () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return false;
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    sendWindowState();
    return mainWindow.isMaximized();
  });

  ipcMain.handle('window-close', () => {
    getMainWindow()?.close();
  });

  ipcMain.handle(
    'window-is-maximized',
    () => getMainWindow()?.isMaximized() ?? false,
  );

  /**
   * Real fullscreen — the OS kind, with the taskbar gone.
   *
   * Has to happen here: a renderer can ask for the Fullscreen API, but that
   * fullscreens an element within the window rather than the window itself, so
   * the taskbar and the window frame stay. The graph's fullscreen mode is for
   * watching something, and a strip of Windows chrome along the bottom of it is
   * the difference between a mode and a bigger panel.
   *
   * The window state is pushed afterwards because the titlebar's own buttons
   * read it, and a maximise button that still says "restore" while the window
   * has no frame at all is a control describing something that is not on
   * screen.
   */
  ipcMain.handle('window-set-full-screen', (_event, next: boolean) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return false;
    }
    mainWindow.setFullScreen(!!next);
    sendWindowState();
    return mainWindow.isFullScreen();
  });
};
