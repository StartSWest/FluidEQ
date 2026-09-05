/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { BrowserWindow } from 'electron';

/**
 * Whether the window shows the desktop through a blur behind its panes.
 *
 * Windows 11 draws a backdrop material by extending the frame into the client
 * area; the shell paints a 90% wash of its own colour over it, so a little of
 * whatever is behind the window shows through, softened. That is the ocean
 * theme's look. The black theme is the opposite idea — a floor of true black
 * — and a blur of the desktop under it made the black grey and moved with
 * every window dragged behind it, so that theme asks for the material to come
 * off. Two things decide the material, and this is the one place they meet:
 *
 *  - the theme, which says whether a backdrop is WANTED at all;
 *  - full screen, which takes it off for the duration whatever the theme,
 *    because the frame's margins survive the transition (measured: 2544x1424
 *    at 8,8 on a 2560x1440 display) and there is nothing behind a full-screen
 *    window to blur anyway.
 *
 * Only Windows 11 has a material. Everywhere else `setBackgroundMaterial` is
 * a no-op and the window shows the opaque colour it was given.
 */
const WINDOW_BACKDROP_MATERIAL = 'acrylic' as const;

/**
 * What Chromium paints before the page's first frame, and what shows wherever
 * the page does not paint. Transparent while there is a material, so the blur
 * is what shows; the black theme's own floor when there is not, so there is
 * never a frame of desktop between two paints.
 */
const TRANSPARENT = '#00000000';
const BLACK_FLOOR = '#050608';

let wanted = true;

export const applyWindowBackdrop = (window: BrowserWindow) => {
  if (window.isDestroyed()) {
    return;
  }
  const on = wanted && !window.isFullScreen();
  window.setBackgroundMaterial(on ? WINDOW_BACKDROP_MATERIAL : 'none');
  window.setBackgroundColor(wanted ? TRANSPARENT : BLACK_FLOOR);
};

/** The theme's answer. Applied at once if there is a window to apply it to. */
export const setWindowBackdropWanted = (
  next: boolean,
  window: BrowserWindow | null,
) => {
  wanted = next;
  if (window) {
    applyWindowBackdrop(window);
  }
};

export const isWindowBackdropWanted = () => wanted;
