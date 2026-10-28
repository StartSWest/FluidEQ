/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { screen } from 'electron';
import type { BrowserWindow } from 'electron';
import {
  appMinimumSize,
  clampInto,
  isUsableRect,
  placeAtTopRight,
} from '../common/windowMode';
import type { IRect } from '../common/windowMode';

/** The full app's own geometry, independent of the amp sharing its window. */
export interface IAppPlacement extends Partial<IRect> {
  isMaximized?: boolean;
}

const APP_SCREEN_FRACTION = 0.9;

/** Only called while the full app owns the window, outside a mode switch. */
export const appPlacementFromWindow = (
  win: BrowserWindow,
  previous: IAppPlacement,
): IAppPlacement => {
  // Normal bounds can still name the amp after Windows changes its frame.
  // An ordinary app window's actual bounds are the rectangle to remember.
  const bounds =
    win.isMaximized() || win.isMinimized()
      ? win.getNormalBounds()
      : win.getBounds();
  const floor = appMinimumSize(screen.getDisplayMatching(bounds).workArea);
  const placement =
    bounds.width >= floor.width && bounds.height >= floor.height
      ? bounds
      : previous;
  return {
    ...placement,
    // Hidden startup has not applied its saved maximisation; minimising is
    // not a request to forget it either.
    isMaximized:
      win.isVisible() && !win.isMinimized()
        ? win.isMaximized()
        : previous.isMaximized === true,
  };
};

/** An old amp-sized app record must never become the return size again. */
export const appReturnBounds = (saved: IAppPlacement, from: IRect): IRect => {
  const area = screen.getDisplayMatching(
    isUsableRect(saved) ? saved : from,
  ).workArea;
  const floor = appMinimumSize(area);
  return isUsableRect(saved)
    ? clampInto(
        {
          ...saved,
          width: Math.max(saved.width, floor.width),
          height: Math.max(saved.height, floor.height),
        },
        area,
      )
    : placeAtTopRight(
        from,
        {
          width: Math.max(
            floor.width,
            Math.round(area.width * APP_SCREEN_FRACTION),
          ),
          height: Math.max(
            floor.height,
            Math.round(area.height * APP_SCREEN_FRACTION),
          ),
        },
        area,
      );
};
