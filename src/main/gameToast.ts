/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The card that says a game loaded a sound, on the desktop.
 *
 * It cannot live inside FluidEQ's window: at the moment it has something to
 * say, that window is behind a game or minimised to the taskbar. So it is a
 * window of its own — frameless, transparent, always on top, and one nothing
 * can click, because a card that swallowed a shot in a match would be worse
 * than no card at all.
 *
 * It appears on the screen the game is on, from the rectangle the watcher
 * reports, and falls back to the screen the pointer is on — which for a
 * fullscreen game is the same screen. It never takes focus, and it closes
 * itself: the page drains a line and calls `window.close()`, so nothing here
 * counts time.
 */

import { BrowserWindow, screen } from 'electron';
import { existsSync } from 'fs';
import path from 'path';
import log from 'electron-log';

export interface IGameToast {
  /** "Loaded Gaming · Competitive", already in the listener's language. */
  what: string;
  /** "for Overwatch", the same. */
  game: string;
  icon?: string;
  /** The game window's place, `x,y,w,h` in real pixels, where it said. */
  rect?: string;
}

const WIDTH = 420;
const HEIGHT = 108;
const MARGIN = 26;

const pagePath = (): string => {
  const packaged = path.join(
    process.resourcesPath ?? '',
    'assets',
    'game-toast.html',
  );
  return existsSync(packaged)
    ? packaged
    : path.join(__dirname, '../../assets/game-toast.html');
};

/** The middle of the game's window, or the pointer, as a point on the desk. */
const pointOf = (rect: string | undefined): Electron.Point => {
  const parts = (rect ?? '').split(',').map((one) => Number(one));
  if (parts.length === 4 && parts.every((one) => Number.isFinite(one))) {
    const [x, y, width, height] = parts;
    // A fullscreen game's rectangle is its whole screen; a windowed one's is
    // where it sits. The centre is inside either.
    if (width > 0 && height > 0) {
      return { x: Math.round(x + width / 2), y: Math.round(y + height / 2) };
    }
  }
  return screen.getCursorScreenPoint();
};

export interface IGameToasts {
  show: (toast: IGameToast) => void;
  close: () => void;
}

export const createGameToasts = (): IGameToasts => {
  let card: BrowserWindow | undefined;

  const close = () => {
    const open = card;
    card = undefined;
    if (open && !open.isDestroyed()) {
      open.close();
    }
  };

  const show = (toast: IGameToast) => {
    // One at a time: a second game inside five seconds replaces the first
    // rather than stacking cards over somebody's aim.
    close();
    try {
      const display = screen.getDisplayNearestPoint(pointOf(toast.rect));
      const area = display.workArea;
      const window = new BrowserWindow({
        width: WIDTH,
        height: HEIGHT,
        x: area.x + area.width - WIDTH - MARGIN,
        y: area.y + area.height - HEIGHT - MARGIN,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        focusable: false,
        show: false,
        hasShadow: false,
        alwaysOnTop: true,
        acceptFirstMouse: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          devTools: false,
        },
      });
      card = window;
      // Over a fullscreen game, and clickable through: the pointer belongs to
      // whoever is playing.
      window.setAlwaysOnTop(true, 'screen-saver');
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      window.setIgnoreMouseEvents(true, { forward: true });
      window.once('ready-to-show', () => {
        if (!window.isDestroyed()) {
          // Never `show`: that takes the focus off the game.
          window.showInactive();
        }
      });
      window.on('closed', () => {
        if (card === window) {
          card = undefined;
        }
      });
      const said = new URLSearchParams({
        what: toast.what,
        game: toast.game,
        ...(toast.icon ? { icon: toast.icon } : {}),
      });
      window
        .loadFile(pagePath(), { search: said.toString() })
        .catch((error: unknown) =>
          log.info('The game card could not be drawn', error),
        );
    } catch (error) {
      log.info('The game card could not be shown', error);
      card = undefined;
    }
  };

  return { show, close };
};
