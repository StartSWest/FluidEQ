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

import path from 'path';
import { app, BrowserWindow, Menu, Tray } from 'electron';
import log from 'electron-log';
import { PRODUCT_NAME } from '../common/branding';
import { DEFAULT_LOCALE, LocaleCode, translate } from '../common/i18n';

/**
 * The notification-area icon, and the window closing into it.
 *
 * WHY THE WINDOW OUTLIVES ITS CLOSE BUTTON. FluidEQ writes an equaliser chain
 * that Equalizer APO reads, and it keeps working with no window on screen —
 * but the app is also the only thing that can change it back, watch the config
 * for outside edits, or keep a Karaoke session alive. Quitting on the close
 * button meant the ordinary way to get the window out of the way was also the
 * way to shut down everything behind it, and there was no cheaper gesture.
 *
 * So the close button hides, and this is where the app goes when it does.
 * Quitting is still one click away — the tray menu has it — and it is now a
 * deliberate one rather than the thing that happens by default.
 */

/**
 * Held at module scope because the tray dies with its last reference.
 *
 * `new Tray()` returns an object whose icon disappears from the notification
 * area the moment it is collected, and a local inside a setup function is
 * collectable as soon as that function returns. This is the documented shape
 * of the bug and it presents as "the tray icon vanishes after a while", which
 * looks like a Windows problem and is not.
 */
let tray: Tray | null = null;

/**
 * Whether a quit is genuinely under way.
 *
 * The window's `close` handler cannot tell on its own why it is being closed:
 * the close button, the tray's Quit item, `app.quit()` from the disclaimer
 * gate and a Windows shutdown all arrive as the same event. Without this flag
 * the handler cancels every one of them and the app cannot be quit at all —
 * including by the installer, which is how an update ends up failing to
 * replace a file that is still open.
 */
let isQuitting = false;

/** The language the renderer is showing, for the tray's menu. */
let locale: LocaleCode = DEFAULT_LOCALE;

/** Read by the window's `close` handler; see the note on the flag. */
export const isAppQuitting = () => isQuitting;

/**
 * Arm a real quit.
 *
 * Every path that means to end the process calls this before asking for it,
 * and `before-quit` calls it as the backstop for the ones that come from
 * outside the app — the installer, a session logout, Task Manager's End Task.
 */
export const beginQuit = () => {
  isQuitting = true;
};

export interface ITrayDeps {
  getMainWindow: () => BrowserWindow | null;
}

const revealWindow = (getMainWindow: () => BrowserWindow | null) => {
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  // Three different ways of being out of sight, and each needs its own call.
  // A window hidden into the tray is not minimised, and a window minimised
  // before it was hidden stays minimised through `show()` unless it is
  // restored first — which is the case that reads as the tray icon doing
  // nothing at all.
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
};

const buildMenu = (getMainWindow: () => BrowserWindow | null) =>
  Menu.buildFromTemplate([
    {
      label: translate(locale, 'app.tray.open', { product: PRODUCT_NAME }),
      click: () => revealWindow(getMainWindow),
    },
    { type: 'separator' },
    {
      label: translate(locale, 'app.tray.quit', { product: PRODUCT_NAME }),
      click: () => {
        beginQuit();
        app.quit();
      },
    },
  ]);

/**
 * Rebuild the menu in the language the window is using.
 *
 * The chosen language lives in the renderer — it is a preference in local
 * storage, not something the main process can read — so it has to be pushed
 * across. Called once when the renderer starts and again whenever the picker
 * changes it, so the tray never sits in a language the rest of the app has
 * left behind.
 */
export const setTrayLocale = (
  next: LocaleCode,
  { getMainWindow }: ITrayDeps,
) => {
  locale = next;
  if (!tray || tray.isDestroyed()) {
    return;
  }
  tray.setToolTip(
    translate(locale, 'app.tray.tooltip', {
      product: PRODUCT_NAME,
    }),
  );
  tray.setContextMenu(buildMenu(getMainWindow));
};

export const setUpTray = ({ getMainWindow }: ITrayDeps) => {
  if (tray) {
    return;
  }

  const assetsPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  // The .ico rather than a png, and for the same reason the window uses it:
  // Windows asks the notification area for a 16px icon at 100% and a 20 or 24
  // at the scalings most laptops actually run at, and picking those out of a
  // multi-resolution icon is the difference between a crisp mark and a
  // resampled smudge. macOS and Linux have no .ico, so they take the png.
  const iconPath = path.join(
    assetsPath,
    process.platform === 'win32' ? 'icon.ico' : 'icon.png',
  );

  try {
    tray = new Tray(iconPath);
  } catch (error) {
    // A missing or unreadable icon must not take the app down with it. Without
    // a tray the close button has nowhere to hide the window, which is why
    // `isAppQuitting` reports true from here on: the window goes back to
    // closing for real rather than vanishing with no way to bring it back.
    log.error(`Could not create the ${PRODUCT_NAME} tray icon`, error);
    isQuitting = true;
    return;
  }

  tray.setToolTip(
    translate(locale, 'app.tray.tooltip', {
      product: PRODUCT_NAME,
    }),
  );
  tray.setContextMenu(buildMenu(getMainWindow));

  // Windows convention: left click opens the thing, right click opens the menu
  // (which Electron wires to the context menu by itself). On macOS a left
  // click opens the menu instead, so this only ever fires where it is wanted.
  tray.on('click', () => revealWindow(getMainWindow));
  // Double click is the older Windows habit and still what a lot of people do.
  tray.on('double-click', () => revealWindow(getMainWindow));
};

/**
 * Let the icon go on the way out.
 *
 * Windows keeps a dead tray icon on screen until something makes it repaint,
 * so a process that exits without this leaves a ghost the user can click on
 * and get nothing from.
 */
export const destroyTray = () => {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
};
