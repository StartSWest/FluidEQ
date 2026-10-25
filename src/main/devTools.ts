/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { WebContents } from 'electron';

/**
 * The developer tools, in a window of their own and never docked inside the
 * app's. Development builds only: nothing in a packaged build opens them.
 *
 * DOCKED, THEY DECIDE HOW WIDE THE PAGE IS, NOT THE WINDOW. Their own page
 * works out the room beside them and hands the app's page that rectangle,
 * whatever the window does meanwhile: measured on Electron 43, the page was
 * 1920px wide beside them on a 2560px screen — the width a dev restart into
 * the amp drew the amp at inside its 475px window, clipped at the window's
 * edge until they worked it out again (Ivan, 2026-10-25) — and a reload
 * inside the amp brought the page back 150px wide. Every rule that lays the
 * amp out follows the page's width, so none of them could put it right; in a
 * window of their own the page is the window, always.
 *
 * Not activated, so opening them never takes the focus from the app.
 */
const openDetached = (contents: WebContents) => {
  if (!contents.isDevToolsOpened()) {
    contents.openDevTools({ mode: 'detach', activate: false });
  }
};

/** The menu's Toggle Developer Tools, detached. */
export const toggleDetachedDevTools = (contents: WebContents) => {
  if (contents.isDevToolsOpened()) {
    contents.closeDevTools();
    return;
  }
  openDetached(contents);
};

/**
 * The context menu's Inspect element. Asked of tools that are not open, the
 * inspection opens them where they were last docked, so they are opened
 * detached first.
 */
export const inspectDetached = (
  contents: WebContents,
  x: number,
  y: number,
) => {
  openDetached(contents);
  contents.inspectElement(x, y);
};
