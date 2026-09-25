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

import { release } from 'os';
import { BrowserWindow, ipcMain, systemPreferences } from 'electron';
import log from 'electron-log';
import { loadLocale, resolveLocale } from '../../common/i18n';
import {
  PLAYER_HEIGHT_LIMIT_CHANNEL,
  PLAYER_WIDTH_FLOOR_CHANNEL,
  TITLEBAR_DOUBLE_CLICK_CHANNEL,
  TRAFFIC_LIGHTS_CHANNEL,
  WINDOW_HIDE_FOR_SWITCH_CHANNEL,
  WINDOW_REVEAL_CHANNEL,
  type IWindowState,
} from '../../common/windowMode';
import {
  titlebarDoubleClickAction,
  trafficLightBandOf,
  trafficLightHeight,
  trafficLightPlacement,
} from '../macWindowChrome';
import { setTrayLocale } from '../tray';
import { setWindowFloor } from '../windowBackdrop';
import { setWindowCloaked } from '../windowDwm';
import type { TWindowModes } from '../windowMode';
import onWindowMessage from './windowMessages';

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
  /** The same state `sendWindowState` pushes, for a page that asks. */
  getWindowState: () => IWindowState;
  /** The full app and the player, and the floor each keeps. */
  windowModes: TWindowModes;
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
  getWindowState,
  windowModes,
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
   *
   * The dictionary is loaded before the tray takes the language, because this
   * process holds only English until asked (`loadLocale`) and everything that
   * translates here — the tray, its notifications, the recovery dialog — reads
   * the tray's language. Only the latest ask applies: two quick switches must
   * end on the second even if the first one's dictionary lands last.
   */
  let localeAsks = 0;
  ipcMain.handle('window-set-locale', async (_event, next: unknown) => {
    const ask = localeAsks + 1;
    localeAsks = ask;
    const locale = resolveLocale(typeof next === 'string' ? next : null);
    await loadLocale(locale).catch((error: unknown) => {
      log.warn(`Could not load the ${locale} dictionary for the tray`, error);
    });
    if (ask === localeAsks) {
      setTrayLocale(locale, { getMainWindow });
    }
  });

  /**
   * The colour the shell's floor is painted in, read off the running document.
   * It is what the window shows before the page's first frame and inside the
   * strip a resize opens, and the native window's background is a property
   * only the main process can set. See `windowBackdrop.ts`.
   */
  ipcMain.handle('window-set-floor', (_event, colour: unknown) => {
    setWindowFloor(colour, getMainWindow());
  });

  ipcMain.handle(
    'window-is-maximized',
    () => getMainWindow()?.isMaximized() ?? false,
  );

  // The same state `sendWindowState` pushes, on request — for a page that
  // mounted after the push and has to ask what window it woke up in.
  ipcMain.handle('window-get-state', () => getWindowState());

  /**
   * The switch beside the window buttons: the full app, or the player.
   *
   * Answers the mode the window is in afterwards, which is the one asked for
   * unless the window is in full screen, where there is no size to change —
   * and answers once the window has that mode's size, so the page draws the
   * player into a player-sized window and not into the app's.
   */
  ipcMain.handle('window-set-mode', (_event, next: unknown) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || (next !== 'app' && next !== 'player')) {
      return windowModes.mode();
    }
    return windowModes.setMode(mainWindow, next);
  });

  /** The player's Always on top. */
  ipcMain.handle('window-set-pinned', (_event, next: unknown) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      windowModes.setPinned(mainWindow, next === true);
    }
  });

  /**
   * The player's height, in the page's CSS pixels: grown or shrunk by a deck
   * opening or closing, and folded to one line and back.
   */
  ipcMain.handle('window-resize-player', (_event, height: unknown) => {
    const mainWindow = getMainWindow();
    if (mainWindow && typeof height === 'number') {
      windowModes.resizePlayer(mainWindow, height);
    }
  });

  /**
   * The player's height ceiling, in the page's CSS pixels, or none: while
   * nothing in the player can grow, the window is exactly as tall as its
   * decks. Sent over the plain message channel, so the page needed no new
   * bridge for it.
   */
  onWindowMessage(PLAYER_HEIGHT_LIMIT_CHANNEL, (event, arg: unknown) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      return;
    }
    const [height, floor] = Array.isArray(arg) ? (arg as unknown[]) : [];
    const asHeight = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : undefined;
    windowModes.limitPlayerHeight(
      mainWindow,
      asHeight(height),
      asHeight(floor),
    );
  });

  /**
   * The width the player's equalizer needs, in the page's CSS pixels: the
   * listener's band layout decides how narrow the window may be dragged.
   */
  onWindowMessage(PLAYER_WIDTH_FLOOR_CHANNEL, (event, arg: unknown) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      return;
    }
    const [width] = Array.isArray(arg) ? (arg as unknown[]) : [];
    windowModes.floorPlayerWidth(
      mainWindow,
      typeof width === 'number' && Number.isFinite(width) && width > 0
        ? width
        : undefined,
    );
  });

  /**
   * A Mac's traffic lights, put where the page draws the strip they belong
   * in (`macWindowChrome.ts`), and a sheet dropped from the foot of it rather
   * than over it. Measured once per page zoom and per strip, so this is not
   * a stream.
   */
  const buttonHeight = trafficLightHeight(release());
  onWindowMessage(TRAFFIC_LIGHTS_CHANNEL, (event, arg: unknown) => {
    const mainWindow = getMainWindow();
    if (
      process.platform !== 'darwin' ||
      !mainWindow ||
      event.sender !== mainWindow.webContents
    ) {
      return;
    }
    const band = trafficLightBandOf(arg);
    if (!band) {
      return;
    }
    const { position, sheetOffset } = trafficLightPlacement(
      band,
      mainWindow.webContents.getZoomFactor(),
      buttonHeight,
    );
    mainWindow.setWindowButtonPosition(position);
    mainWindow.setSheetOffset(sheetOffset);
  });

  /**
   * A double-click on the titlebar where it is not a drag handle, such as the
   * product's name on a narrow window. A Mac answers one on the drag handle
   * itself, by the listener's own setting; this gives the rest of the bar the
   * same answer, where the page's own maximised whatever the setting said.
   */
  onWindowMessage(TITLEBAR_DOUBLE_CLICK_CHANNEL, (event) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      return;
    }
    const action = titlebarDoubleClickAction(
      process.platform === 'darwin'
        ? systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string')
        : undefined,
    );
    if (action === 'minimize') {
      mainWindow.minimize();
    } else if (action === 'zoom') {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  /*
   * A switch between the app and the player, off the screen (Ivan,
   * 2026-09-22: "first we hide the mini app completely then we show the full
   * ui"). The page asks for the window to go before it asks for the other
   * mode, and for it back once it has drawn that mode at the new size; in
   * between, the window changes size cloaked (`setWindowCloaked`). Changing
   * size in view, it showed the old view stretched, then faded in its
   * corner, then Windows' maximise growing out of a picture of it.
   *
   * NOTHING MAY LEAVE THE WINDOW CLOAKED. A page that reloads or dies in the
   * middle of a switch never asks for it back, and a listener who restores
   * the window from the taskbar, or goes to another window and comes back to
   * this one, is asking for it; each of those puts it back too. Coming back
   * only: the switch itself may activate the window it is resizing, and that
   * is no one asking for anything.
   */
  let isCloaked = false;
  let stopWatching: (() => void) | undefined;
  const reveal = () => {
    stopWatching?.();
    stopWatching = undefined;
    const mainWindow = getMainWindow();
    if (isCloaked && mainWindow && !mainWindow.isDestroyed()) {
      setWindowCloaked(mainWindow, false);
    }
    isCloaked = false;
  };
  onWindowMessage(WINDOW_HIDE_FOR_SWITCH_CHANNEL, (event) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || event.sender !== mainWindow.webContents || isCloaked) {
      return;
    }
    isCloaked = setWindowCloaked(mainWindow, true);
    if (!isCloaked) {
      return;
    }
    const contents = mainWindow.webContents;
    const onNavigation = (details: {
      isSameDocument: boolean;
      isMainFrame: boolean;
    }) => {
      // The page's own `replaceState` is a same-document navigation, and the
      // switch makes one; only a new document means the page cannot answer.
      if (details.isMainFrame && !details.isSameDocument) {
        reveal();
      }
    };
    let hasLeft = false;
    const onBlur = () => {
      hasLeft = true;
    };
    const onFocus = () => {
      if (hasLeft) {
        reveal();
      }
    };
    contents.on('did-start-navigation', onNavigation);
    contents.on('render-process-gone', reveal);
    mainWindow.on('restore', reveal);
    mainWindow.on('blur', onBlur);
    mainWindow.on('focus', onFocus);
    stopWatching = () => {
      contents.removeListener('did-start-navigation', onNavigation);
      contents.removeListener('render-process-gone', reveal);
      mainWindow.removeListener('restore', reveal);
      mainWindow.removeListener('blur', onBlur);
      mainWindow.removeListener('focus', onFocus);
    };
  });
  onWindowMessage(WINDOW_REVEAL_CHANNEL, (event) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      return;
    }
    reveal();
  });

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
    // NOTHING IS PUSHED FROM HERE.
    //
    // The window's own `enter-full-screen` and `leave-full-screen` events
    // push the state, and they fire when it is true. Pushing it from here as
    // well announced the state the window is LEAVING — the same message-loop
    // lag the maximise handler above documents — and the renderer does not
    // treat that flag as cosmetic: a `false` arriving while a full-screen
    // request is in flight is how it hears "the user left full screen by some
    // other route", so it dropped the media surface it had just been given.
    // The window went full screen and the tab laid itself out as though it
    // had not, which is a full-screen press that visibly does nothing.
    //
    // Through the modes rather than straight at the window: the player's
    // window has limits of its own that have to come off before it grows and
    // go back on — with the bounds it left from — after it shrinks.
    return windowModes.setFullScreen(mainWindow, !!next);
  });
};
