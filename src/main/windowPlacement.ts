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

import { BrowserWindow, screen } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import {
  WINDOW_HEIGHT,
  WINDOW_HEIGHT_EXPANDED,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
} from '../common/constants';
import {
  appMinimumSize,
  isUsableRect,
  PLAYER_BOUNDS_RULE,
  rememberedPlayer,
  type IRect,
  type IWindowState as IWindowStatePush,
  type TPlayerAmp,
  type TWindowMode,
} from '../common/windowMode';
import { peekScheduled, scheduleWrite } from './asyncWriter';
import type { TWindowModes } from './windowMode';

const WINDOW_STATE_FILENAME = 'window-state.json';

/** What `window-state.json` holds. */
interface IWindowState {
  /** The full app's normal bounds, whichever mode the window was left in. */
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
  /** The app or the player; missing in every file written before the player. */
  mode?: TWindowMode;
  /** The 2.0 amp's bounds — the one amp there was when this was named. */
  player?: IRect;
  /** The Stage's bounds, the amp worn in the Backdrop. */
  stagePlayer?: IRect;
  /**
   * Which rule wrote the amps' bounds down (`PLAYER_BOUNDS_RULE`); missing in
   * every file written before the rule.
   */
  playerRule?: number;
  /** Which amp the player was; missing in every file from before there were two. */
  amp?: TPlayerAmp;
  /** The player's Always on top. */
  isPinned?: boolean;
}

/** The screen a saved rectangle belongs to, or the primary one. */
const workAreaFor = (rect: Partial<IRect>) =>
  isUsableRect(rect)
    ? screen.getDisplayMatching(rect).workArea
    : screen.getPrimaryDisplay().workArea;

/** How much of the screen the window takes when nothing is remembered. */
const FIRST_RUN_SCREEN_FRACTION = 0.9;

/**
 * Under this, a first run opens maximised instead of at 90%.
 *
 * Nine tenths of a small screen is not a comfortable window, it is a cramped
 * one with a frame of wasted desktop around it — this app puts a band editor, a
 * response graph and a profile column side by side, and below 2K something has
 * to give. The test is against the display's **resolution**, not its work area:
 * a 2560x1440 screen reports 2560x1392 once the taskbar is subtracted, so
 * measuring the work area against 1440 would maximise on exactly the screens
 * meant to get the 90% window.
 */
const MAXIMIZE_BELOW_WIDTH = 2560;
const MAXIMIZE_BELOW_HEIGHT = 1440;

/**
 * Where and how big to open when nothing is remembered.
 *
 * A fixed 1428x625 was a guess at somebody else's monitor, and it was made
 * worse by the graph-view expansion below: the window was centred as a 625-tall
 * one and then grown to 1036 from the same top-left, so it reached 411px
 * further down than the position it had been given. On a 1080p display that put
 * the bottom edge under the taskbar on the very first launch.
 *
 * Nine tenths of the work area is the same proportion of whatever screen it
 * lands on, and — because it is applied when the window is built rather than
 * after — `center: true` centres the size the user actually gets. The size is
 * computed even when the window will be maximised, because it is what the
 * window returns to the first time somebody restores it down.
 */
export const firstRunPlacement = () => {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const floor = appMinimumSize(display.workArea);
  return {
    maximize:
      display.bounds.width < MAXIMIZE_BELOW_WIDTH ||
      display.bounds.height < MAXIMIZE_BELOW_HEIGHT,
    width: Math.max(floor.width, Math.round(width * FIRST_RUN_SCREEN_FRACTION)),
    height: Math.max(
      floor.height,
      Math.round(height * FIRST_RUN_SCREEN_FRACTION),
    ),
  };
};

export interface IWindowPlacementDeps {
  userDataDir: string;
  getMainWindow: () => BrowserWindow | null;
  /** The app and the player, and the floor each keeps. */
  windowModes: TWindowModes;
}

/**
 * Where the window is, how big, and in which mode: remembered on disk, restored
 * at launch, and told to the page.
 */
export const createWindowPlacement = ({
  userDataDir,
  getMainWindow,
  windowModes,
}: IWindowPlacementDeps) => {
  /**
   * Where and how big the window was last time.
   *
   * Restoring the position as well as the size matters more than it sounds:
   * FluidEQ is a frameless window that people park somewhere deliberate —
   * beside a player, on a second screen — and opening centred every launch
   * undoes that decision for them daily.
   */
  const windowStatePath = () => path.join(userDataDir, WINDOW_STATE_FILENAME);

  const loadWindowState = (): IWindowState => {
    try {
      // What the writer last accepted, when a write is still on its way: the
      // file behind it is a drag behind (see `saveWindowState`).
      const file = windowStatePath();
      const parsed = JSON.parse(
        peekScheduled(file) ?? fs.readFileSync(file, 'utf8'),
      ) as IWindowState;

      const isSize = (value: unknown): value is number =>
        typeof value === 'number' && Number.isFinite(value) && value > 0;
      const isCoordinate = (value: unknown): value is number =>
        typeof value === 'number' && Number.isFinite(value);

      const state: IWindowState = {
        isMaximized: parsed.isMaximized === true,
        mode: parsed.mode === 'player' ? 'player' : 'app',
        isPinned: parsed.isPinned === true,
      };
      // Each amp's own size and place (Ivan, 2026-09-28: "we should
      // preserve 3 window sizes"), and which one the player was.
      state.amp = parsed.amp === 'stage' ? 'stage' : 'classic';
      const player = rememberedPlayer(parsed);
      const stagePlayer = rememberedPlayer({
        player: parsed.stagePlayer,
        playerRule: parsed.playerRule,
      });
      if (player || stagePlayer) {
        state.playerRule = PLAYER_BOUNDS_RULE;
        state.player = player;
        state.stagePlayer = stagePlayer;
      }
      if (isSize(parsed.width) && isSize(parsed.height)) {
        // Up to the app's floor on the screen it was left on. A window saved
        // smaller by a version that allowed it comes back at the floor — or
        // as large as that screen is, on a smaller one.
        const floor = appMinimumSize(workAreaFor(parsed));
        state.width = Math.max(parsed.width, floor.width);
        state.height = Math.max(parsed.height, floor.height);
      }

      // A saved position is only usable if a display still covers it.
      // Unplugging a second monitor would otherwise reopen FluidEQ at
      // coordinates nobody can reach, and the only fix would be deleting a
      // file they do not know exists.
      const { x, y } = parsed;
      if (isCoordinate(x) && isCoordinate(y)) {
        const onScreen = screen.getAllDisplays().some(({ bounds }) => {
          return (
            x >= bounds.x - 32 &&
            y >= bounds.y - 32 &&
            x < bounds.x + bounds.width &&
            y < bounds.y + bounds.height
          );
        });
        if (onScreen) {
          state.x = x;
          state.y = y;
        }
      }

      return state;
    } catch {
      // No file yet, or one we cannot read. Either way: open at the default.
      return {};
    }
  };

  /**
   * Remember the window geometry.
   *
   * Maximized and full-screen windows report the size of the screen, not the
   * size the user chose, so the normal bounds are saved instead — that is what
   * should come back when they un-maximize.
   *
   * Asked for on every frame of a move or a resize, and never blocking: the
   * coalescing writer keeps one write in flight and the newest waiting, skips
   * contents already on disk, and is flushed by `before-quit`. It used to be a
   * synchronous write 400 ms after the last event (`mainWindow.ts`).
   */
  const saveWindowState = () => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    try {
      const modes = windowModes.memory();
      const isPlayer = modes.mode === 'player';
      // The full app's bounds are the window's own while it is the app. While
      // it is the player they are the ones the switch put aside, to go back to.
      const bounds = isPlayer ? modes.app : mainWindow.getNormalBounds();
      // Each amp's own bounds, never the full screen's or a switch's.
      const player = windowModes.playerBounds(mainWindow, 'classic');
      const stagePlayer = windowModes.playerBounds(mainWindow, 'stage');
      // A window that is off screen right now cannot report the state the user
      // chose. Normally that never happens: the close handler saves before it
      // hides, so the window is still visible at that moment. It does happen
      // after an unattended update, which builds the window and never shows
      // it — `isMaximized()` answers false, and writing that answer down would
      // un-maximise FluidEQ for good, one update at a time. Keep what was
      // already recorded instead.
      const isAppMaximized = mainWindow.isVisible()
        ? mainWindow.isMaximized()
        : loadWindowState().isMaximized === true;
      const state: IWindowState = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        // The player is never maximised; what it keeps is the app's own.
        isMaximized: isPlayer ? modes.app.isMaximized === true : isAppMaximized,
        mode: modes.mode,
        ...(isUsableRect(player) ? { player } : {}),
        ...(isUsableRect(stagePlayer) ? { stagePlayer } : {}),
        ...(isUsableRect(player) || isUsableRect(stagePlayer)
          ? { playerRule: PLAYER_BOUNDS_RULE }
          : {}),
        amp: modes.amp,
        isPinned: modes.isPinned,
      };
      scheduleWrite(windowStatePath(), JSON.stringify(state, null, 2)).catch(
        (error: unknown) =>
          log.warn('Unable to save the window position', error),
      );
    } catch (error) {
      // Losing the window position is not worth an error on screen.
      log.warn('Unable to save the window position', error);
    }
  };

  const setWindowDimension = (isExpanded: boolean) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      const currWidth = mainWindow.getSize()[0];
      const currHeight = mainWindow.getSize()[1];
      if (isExpanded) {
        mainWindow.setMinimumSize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT);
        // Never taller than the screen it is on. Growing to a fixed 1036 is
        // fine on a large monitor and runs off the bottom of a small one, and
        // the window keeps its top-left when it grows, so the part that
        // disappears is the part with the graph in it.
        mainWindow.setSize(
          currWidth,
          Math.min(
            Math.max(currHeight, WINDOW_HEIGHT_EXPANDED),
            screen.getPrimaryDisplay().workAreaSize.height,
          ),
        );
      } else {
        mainWindow.setMinimumSize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT);
        mainWindow.setSize(currWidth, WINDOW_HEIGHT);
      }
    }
  };

  /** What the page is told about its window, pushed and asked for alike. */
  const windowStateOf = (window: BrowserWindow | null): IWindowStatePush => {
    const modes = windowModes.memory();
    const isLive = window !== null && !window.isDestroyed();
    const [contentWidth, contentHeight] = isLive ? window.getContentSize() : [];
    return {
      isMaximized: isLive ? window.isMaximized() : false,
      isFullScreen: isLive ? window.isFullScreen() : false,
      isSystemFullScreen: isLive ? windowModes.isSystemFullScreen() : false,
      mode: modes.mode,
      isPinned: modes.isPinned,
      zoom: isLive ? window.webContents.getZoomFactor() : 1,
      contentSize:
        contentWidth !== undefined && contentHeight !== undefined
          ? { width: contentWidth, height: contentHeight }
          : undefined,
    };
  };

  const sendWindowState = () => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send(
      'window-state-changed',
      windowStateOf(mainWindow),
    );
  };

  /** The state with the full screen a transition is moving into (`mainWindow.ts`). */
  const sendFullScreenState = (isFullScreen: boolean) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send('window-state-changed', {
      ...windowStateOf(mainWindow),
      isFullScreen,
    });
  };

  return {
    loadWindowState,
    saveWindowState,
    setWindowDimension,
    windowStateOf,
    sendWindowState,
    sendFullScreenState,
  };
};
