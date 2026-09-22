/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  PLAYER_DEFAULT_HEIGHT,
  PLAYER_DEFAULT_WIDTH,
  PLAYER_FOLD_HEIGHT,
  PLAYER_MIN_WIDTH,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
} from './constants';

/**
 * What the window is: the full app, or the player it turns into.
 *
 * A mode and not a width. The full app no longer squeezes down (it keeps a
 * floor, `appMinimumSize`), so the small FluidEQ is its own thing, entered by
 * the switch beside the window buttons and left by the same switch in the
 * player's own title strip.
 */
export type TWindowMode = 'app' | 'player';

/**
 * The page address's word for the mode: main opens a player window with it,
 * and the page keeps it in step after every switch, so the page can draw the
 * right mode on its first frame and again after a reload.
 */
export const WINDOW_MODE_PARAM = 'windowMode';

/**
 * The page's word for the player's height ceiling: `[cssHeight]` while
 * nothing in the player can grow, `[null]` otherwise.
 */
export const PLAYER_HEIGHT_LIMIT_CHANNEL = 'window-player-height-limit';

/**
 * The page's word for the width its equalizer needs: `[cssWidth]`, which is
 * the widest band layout the listener has chosen (`playerWidthForBands`).
 * The player cannot be dragged narrower than this, because under it the
 * bands stop having a gap between them.
 */
export const PLAYER_WIDTH_FLOOR_CHANNEL = 'window-player-width-floor';

/** What main tells the page about its window, pushed and asked for alike. */
export interface IWindowState {
  isMaximized: boolean;
  isFullScreen: boolean;
  mode: TWindowMode;
  /** The player's Always on top, whichever mode the window is in. */
  isPinned: boolean;
  /**
   * Chromium's own zoom, as the menu's Ctrl+/- leaves it.
   *
   * The page draws the window's edge itself, at the radius Windows clips the
   * corner to — and that radius is in the system's pixels while everything in
   * the page is in the zoom's. Without this the edge is drawn a fifth too
   * large at 1.2 and its four corners fall outside the clip.
   */
  zoom: number;
}

export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ISize {
  width: number;
  height: number;
}

/**
 * The full app's floor on a screen with this work area: 1024×800
 * (`WINDOW_MIN_WIDTH`, `WINDOW_MIN_HEIGHT`), or the whole work area of a
 * smaller screen.
 *
 * Capped because a floor larger than the screen is a window that cannot be
 * put on it: a 1366×768 laptop at 150% scaling has a work area about 910 by
 * 480, and there the app is simply as large as the screen allows.
 */
export const appMinimumSize = (workArea: ISize): ISize => ({
  width: Math.min(WINDOW_MIN_WIDTH, workArea.width),
  height: Math.min(WINDOW_MIN_HEIGHT, workArea.height),
});

/**
 * The player's floor, in window units.
 *
 * The page lays the player out in CSS pixels and the window is sized in the
 * system's, and the two differ by the page's zoom (Ctrl +/−), so the floor is
 * the CSS figure scaled by it. Its height is one line: the player folded.
 */
export const playerMinimumSize = (zoom: number): ISize => ({
  width: Math.ceil(PLAYER_MIN_WIDTH * zoom),
  height: Math.ceil(PLAYER_FOLD_HEIGHT * zoom),
});

/** The player's size the first time it opens, before it fits its decks. */
export const playerFirstSize = (zoom: number): ISize => ({
  width: Math.round(PLAYER_DEFAULT_WIDTH * zoom),
  height: Math.round(PLAYER_DEFAULT_HEIGHT * zoom),
});

/**
 * A rectangle moved and, if it must be, shrunk so all of it is inside the
 * work area — a window put partly off screen is one whose buttons cannot be
 * reached.
 */
export const clampInto = (rect: IRect, area: IRect): IRect => {
  const width = Math.min(rect.width, area.width);
  const height = Math.min(rect.height, area.height);
  const x = Math.min(Math.max(rect.x, area.x), area.x + area.width - width);
  const y = Math.min(Math.max(rect.y, area.y), area.y + area.height - height);
  return { x, y, width, height };
};

/**
 * A window of this size in the middle of the screen it is on.
 *
 * Where the player opens the first time (Ivan, 2026-09-22: "just in the
 * center of the screen"). It used to open in the top-right corner the app's
 * switch was in, which kept the switch under the pointer and put the amp
 * against the edge of the screen; the middle is where a window somebody has
 * not placed yet belongs, and the tray's recovery puts it there too.
 */
export const centreIn = (size: ISize, area: IRect): IRect =>
  clampInto(
    {
      x: area.x + Math.round((area.width - size.width) / 2),
      y: area.y + Math.round((area.height - size.height) / 2),
      width: size.width,
      height: size.height,
    },
    area,
  );

/**
 * Where the full app goes when there is nowhere to go back to: the same
 * top-right corner the player had.
 *
 * The switch sits beside the window buttons at the top right of both the app
 * and the player, so anchoring that corner leaves the switch under the
 * pointer that pressed it, and a second press takes the window straight back.
 */
export const placeAtTopRight = (
  anchor: IRect,
  size: ISize,
  area: IRect,
): IRect =>
  clampInto(
    {
      x: anchor.x + anchor.width - size.width,
      y: anchor.y,
      width: size.width,
      height: size.height,
    },
    area,
  );

/** Only a rectangle with a finite position and a real size is one to reuse. */
export const isUsableRect = (rect: Partial<IRect> | undefined): rect is IRect =>
  rect !== undefined &&
  [rect.x, rect.y, rect.width, rect.height].every(
    (value) => typeof value === 'number' && Number.isFinite(value),
  ) &&
  (rect.width ?? 0) > 0 &&
  (rect.height ?? 0) > 0;
