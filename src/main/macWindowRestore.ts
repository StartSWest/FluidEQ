/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IRect } from '../common/windowMode';

/**
 * A saved size this close to the screen, both ways, is not one anybody chose
 * to go back to: restored to, the window moves a few points and reads as a
 * restore that did nothing. The usable height moves with the Dock — 795 and
 * 805 points on the same MacBook, an hour apart — so "exactly the screen" is
 * not a test that holds.
 */
const NEARLY_THE_SCREEN = 0.95;

/** The parts of the saved window state this reads: the full app's own. */
export interface IAppWindowSize {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

/**
 * A Mac's full app, never rebuilt at the size of the screen it maximises to.
 *
 * A Mac restores a maximised window to the frame it had before it was
 * maximised, and it has none when the window was built at the maximised
 * frame already: AppKit then leaves the window where it is, and Electron's
 * `unmaximize` says nothing at all. The saved state could hold exactly that —
 * on a 1440×900 MacBook the app's floor (800 tall) is taller than the screen
 * it may use (795), so the floor is the whole height and the window saved its
 * maximised frame as its normal one — and from then on every launch built a
 * window that could not be restored: the title bar's double-click did
 * nothing, and the switch to the player waited for a restore that never came
 * (`windowMode.ts`).
 *
 * A maximised window saved at (nearly) the screen's size is read back at the
 * first-launch size instead, centred on the screen, and the saved maximise
 * then maximises it: the Mac takes that smaller frame as the one to restore
 * to, and every save after it writes that one down. Any other size, and any
 * window that was not maximised, is left exactly as it was saved.
 */
export const withRestorableAppSize = <T extends IAppWindowSize>(
  saved: T,
  workArea: IRect,
  firstRunSize: { width: number; height: number },
): T => {
  if (
    saved.isMaximized !== true ||
    saved.width === undefined ||
    saved.height === undefined ||
    saved.width < workArea.width * NEARLY_THE_SCREEN ||
    saved.height < workArea.height * NEARLY_THE_SCREEN
  ) {
    return saved;
  }
  const width = Math.min(firstRunSize.width, workArea.width);
  const height = Math.min(firstRunSize.height, workArea.height);
  return {
    ...saved,
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
  };
};
