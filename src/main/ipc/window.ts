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
import { resolveLocale } from '../../common/i18n';
import { setTrayLocale } from '../tray';

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
    // What was asked for, not what has happened yet.
    //
    // Windows applies the state change on its own message loop, so reading
    // `isMaximized()` straight after the call gives the state the window is
    // leaving: the button reported the wrong answer to the renderer every
    // time, and the maximise glyph flipped to the wrong shape until the
    // window's own event arrived a frame or two later and corrected it.
    const next = !mainWindow.isMaximized();
    if (next) {
      mainWindow.maximize();
    } else {
      mainWindow.unmaximize();
    }
    sendWindowState();
    return next;
  });

  ipcMain.handle('window-close', () => {
    // Still `close()`, and still the same event the OS sends. What it does now
    // depends on whether a quit has been armed — see mainWindow.ts and tray.ts.
    // Deliberately not `hide()` here: routing the button straight to hide would
    // leave the two ways of closing a window behaving differently, and the one
    // that skipped `close` would also skip saving where the window was.
    getMainWindow()?.close();
  });

  /**
   * The language the window is showing, pushed across for the tray's menu.
   *
   * The choice lives in the renderer's local storage, which the main process
   * cannot read, so the renderer states it on startup and again whenever the
   * picker changes it. Re-resolved here rather than trusted: this arrives over
   * IPC as a string, and `resolveLocale` is what turns anything at all into
   * one of the ten shipped codes.
   */
  ipcMain.handle('window-set-locale', (_event, next: unknown) => {
    setTrayLocale(resolveLocale(typeof next === 'string' ? next : null), {
      getMainWindow,
    });
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
    // Straight there, and not by way of maximised.
    //
    // Going through maximised was tried, so the movement would carry the
    // animation Windows gives a maximise instead of arriving as a snap. It
    // does not work: `setFullScreen(true)` on a maximised window is ignored
    // — measured, the window stayed at the work area's 1392px height with
    // the taskbar still showing — so the smoother movement cost the mode
    // itself. The snap stays until there is a way to have both.
    mainWindow.setFullScreen(!!next);
    sendWindowState();
    return !!next;
  });
};
