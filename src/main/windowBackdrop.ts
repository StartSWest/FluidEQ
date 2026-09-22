/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { BrowserWindow } from 'electron';

/**
 * WHAT MAKES THE WINDOW A ROUNDED, GLASS-EDGED WINDOW.
 *
 * Windows 11 draws a backdrop material by extending the frame into the client
 * area, and a window that has one is a window DWM treats as its own: rounded
 * at the system radius, with the lit hairline the shell draws around every
 * Windows 11 app. Take the material off and BOTH go with it — learned the
 * expensive way on 2026-09-21, when it was removed to stop the desktop showing
 * through the gutters and the corners of the app and the player both went
 * square the moment it did. `roundedCorners: true` does not save it; the
 * material is what the frame is made of.
 *
 * So the material stays on every theme, and NOTHING OF IT IS SEEN. The shell's
 * floor is opaque (`$window-backdrop` in _theme.scss, and it was 90% until
 * that same day: the right-hand gutter measured rgb(31,89,254) over a blue
 * wallpaper, which is the desktop rather than a hint of it, and it changed
 * colour with every window dragged behind this one). The material shows in no
 * pixel the page paints, which is every pixel of the window.
 *
 * It is kept for the frame it buys, and for the one moment the page cannot
 * cover: a resize, where the strip Windows adds arrives before the repaint
 * does. A blur of what is already behind the window is the least visible thing
 * that can be there.
 *
 * Do not take it off again, and do not make it the theme's choice — black
 * asked for none, back when a blur under a true-black floor made the floor
 * grey, and a theme that answers no is a theme whose windows are square.
 *
 * Full screen is the one thing that still takes it off, whatever else is true:
 * the frame's margins survive the transition (measured: 2544x1424 at 8,8 on a
 * 2560x1440 display, a strip of desktop down all four edges) and a full-screen
 * window has no corners to round anyway.
 *
 * Only Windows 11 has a material. Everywhere else `setBackgroundMaterial` is a
 * no-op and the window shows the colour it was given.
 */
const WINDOW_BACKDROP_MATERIAL = 'acrylic' as const;

/**
 * What Chromium fills the window with, and it is OPAQUE (Ivan, 2026-09-22:
 * "anyways to not see that empty glass window when opening app or switching
 * modes?").
 *
 * Transparent, the material shows wherever the page has not painted yet — and
 * there are two such moments, both of them the whole window: the frames before
 * the first paint at launch, and the strip Windows opens as the window is
 * resized, which the switch between the app and the player does in one step.
 * Both read as an empty pane of glass where the app should be. Filled with the
 * shell's own floor instead, they read as the app, a moment before its
 * contents arrive.
 *
 * This does not cost the frame. The material is a DWM attribute on the window
 * — it is what makes Windows round the corners and draw its lit edge — and it
 * keeps doing that whether or not anything of it can be seen through the
 * fill.
 *
 * The default is the default theme's `--surface-base`; the renderer states the
 * theme's own on startup and on every switch, because only the document knows
 * it.
 */
const DEFAULT_FLOOR = '#050608';

/** `#rrggbb`, which is what a resolved CSS colour comes back as. */
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/**
 * WHAT A FULL SCREEN STANDS ON, WHATEVER THE THEME IS (Ivan, 2026-09-22).
 *
 * Full screen is one thing being looked at and nothing else — a visualizer, a
 * video, a karaoke stage. The shell's floor is a colour chosen to sit under
 * panels and chrome, and in the light theme it is nearly white: a picture that
 * does not reach every pixel of the display then has a bright margin around
 * it, which is the one thing a full screen is for getting rid of. Black is
 * also what the strip Windows opens during the transition is filled with, so
 * the way in and the way out are black rather than a flash of the theme.
 */
const FULL_SCREEN_FLOOR = '#000000';

let floor = DEFAULT_FLOOR;

export const applyWindowBackdrop = (
  window: BrowserWindow,
  // Said rather than read by the two handlers that call this AS the window
  // changes: Windows has no native full-screen state, so what the window
  // reports during that transition is not something to build a look on.
  isFullScreen = window.isFullScreen(),
) => {
  if (window.isDestroyed()) {
    return;
  }
  window.setBackgroundMaterial(
    isFullScreen ? 'none' : WINDOW_BACKDROP_MATERIAL,
  );
  window.setBackgroundColor(isFullScreen ? FULL_SCREEN_FLOOR : floor);
};

/** What a window is created with, before any page has said anything. */
export const windowFloorColour = () => floor;

/**
 * The theme's floor, as the renderer reads it off the running document.
 *
 * Validated rather than trusted: this arrives over IPC and is handed to
 * Chromium. Anything that is not a plain six-digit hex leaves it as it was.
 */
export const setWindowFloor = (next: unknown, window: BrowserWindow | null) => {
  if (typeof next !== 'string' || !HEX_COLOUR.test(next) || next === floor) {
    return;
  }
  floor = next;
  // Not over a full screen's black: the theme can change while a picture has
  // the display (the player carries its own dark/light switch), and the floor
  // goes back on by itself on the way out.
  if (window && !window.isDestroyed() && !window.isFullScreen()) {
    window.setBackgroundColor(floor);
  }
};
