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

import { BrowserWindow, screen, session } from 'electron';
import { existsSync } from 'fs';
import path from 'path';
import log from 'electron-log';

const PARTITION = 'fluideq-game-card';
let sessionReady = false;

/**
 * The card's own session, and the reason it needs one.
 *
 * FluidEQ's window installs its Content-Security-Policy on the session it
 * runs in (`mainWindow.ts`), which is the default one — so a window opened
 * here with no session of its own was handed the app's policy as well as the
 * page's. Both then have to allow a thing, and the app's `script-src 'self'`
 * refuses an inline script whatever the page says about itself: the card drew
 * its icon, its rule and its brand mark and said nothing at all, and — the
 * listener that closes it living in that same script — never closed either,
 * so an invisible always-on-top window was left behind by every game.
 *
 * On its own session the only policy is the one the page declares, which is
 * `default-src 'none'` plus the hash of that one script. Nothing here may
 * ask for a camera, a microphone or a place on the disk, so nothing is
 * granted, the way the wallpaper's surfaces already do it.
 */
const cardSession = (): Electron.Session => {
  const isolated = session.fromPartition(PARTITION);
  if (sessionReady) {
    return isolated;
  }
  sessionReady = true;
  isolated.setPermissionRequestHandler((_contents, _permission, answer) =>
    answer(false),
  );
  isolated.setPermissionCheckHandler(() => false);
  return isolated;
};

export interface IGameToast {
  /** "Loaded Gaming · Competitive", already in the listener's language. */
  what: string;
  /** "for Overwatch", the same. */
  game: string;
  icon?: string;
  /** The game window's place, `x,y,w,h` in real pixels, where it said. */
  rect?: string;
}

// Wide enough that the longest chain name any of the ten languages produces
// still fits beside the game's icon and the brand mark without an ellipsis:
// measured on the page itself, Russian's "Загружено: Игры · Соревнование" is
// the longest at 284px and the line it goes on is 315px here. Height is the
// content's, not a round number — 120 left a quarter of the card empty.
const WIDTH = 520;
const HEIGHT = 104;
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
          // Never the app's session: its policy refuses this page's script.
          session: cardSession(),
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
