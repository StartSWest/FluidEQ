/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether the Studio's stage holds the window full screen (`StudioStage`).
 *
 * The stage's full screen is the page's own (`requestFullscreen` on its
 * frame), and a page's full screen no longer moves the window
 * (`disableHtmlFullscreenWindowResize` in `mainWindow.ts`), so the stage asks
 * main for the window as well. The shell takes back out any full-screen
 * window nothing claims (`useShellFullScreen`), and reads this when the
 * window says it is full screen — a plain value rather than a store, because
 * that answer is needed in the moment the window's message arrives, not on
 * the next render.
 */
let isClaimed = false;

export const claimStageFullScreen = (next: boolean) => {
  isClaimed = next;
};

export const isStageFullScreenClaimed = () => isClaimed;
