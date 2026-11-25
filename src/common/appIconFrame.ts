/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE APP ICON'S FRAME AT EACH SIZE: how far the tile reaches and how heavy
 * its edge is, shared by the installed icon files
 * (`.erb/scripts/make-app-icons.ts`) and the icon the window draws in its own
 * colours (`renderer/utils/taskbarIconArt.ts`), so the two never disagree.
 *
 * Ivan, 2026-11-25, beside FluidWallpapers in the notification area: "the
 * FluidEQ icon is too small. It needs to be the same size, and make sure the
 * border is as visible", and "they need to look like they're from the same
 * family". One drawing scaled to every size left the tile 3.7% short of each
 * edge at 16px and its edge a third of a pixel wide, a dim smear rather than
 * a ring, while FluidWallpapers fills the canvas there with a whole-pixel rim.
 * These are FluidWallpapers' own three frames (its `design/icon-mockups/
 * build.mjs`, a 1024 grid, halved here): the large one is the frame both
 * icons have always shared, and the two small ones grow the tile to the
 * canvas and the edge to a pixel or two. The artwork inside scales with the
 * tile and is otherwise the same drawing.
 */

/** `assets/icon.svg` is drawn on a 512 grid, centred on 256. */
export const APP_ICON_GRID = 512;

/** A ring on the grid: its centre line's half-extent and its width. */
export interface IAppIconRing {
  radius: number;
  width: number;
}

export interface IAppIconFrame {
  /** Which drawing, for file names and messages. */
  name: 'small' | 'mid' | 'large';
  /** The largest pixel size this frame is drawn for. */
  maxSize: number;
  /** The tile's half-extent on the grid: 256 reaches the canvas edge. */
  body: number;
  /** The coloured edge, flush with the tile's outline. */
  rim: IAppIconRing;
  /** The faint white line inside the edge; only where it is a pixel or more. */
  hairline?: IAppIconRing;
  /** How much larger the wave is drawn than in the large frame. */
  glyphScale: number;
}

/** The large frame's tile, which every other frame's wave is scaled from. */
const LARGE_BODY = 236;

const frame = (
  name: IAppIconFrame['name'],
  maxSize: number,
  body: number,
  rim: IAppIconRing,
  hairline?: IAppIconRing,
): IAppIconFrame => ({
  name,
  maxSize,
  body,
  rim,
  hairline,
  glyphScale: body / LARGE_BODY,
});

/**
 * Smallest first. 16 to 32px: the tile bleeds to the canvas and the edge is
 * one sixteenth of it (1px at 16, 2px at 32), its outer side on the canvas
 * edge so it lands on whole pixels. 40 to 64px: 2.1% of padding and a 2.7%
 * edge, which holds at 48 without becoming the small drawing's outline.
 * Above that, 3.9% of padding and a 1.8% edge with the hairline inside it.
 */
export const APP_ICON_FRAMES: readonly IAppIconFrame[] = [
  frame('small', 32, 256, { radius: 240, width: 32 }),
  frame('mid', 64, 245, { radius: 238, width: 14 }),
  frame(
    'large',
    Number.POSITIVE_INFINITY,
    LARGE_BODY,
    { radius: 232, width: 9 },
    { radius: 224, width: 2 },
  ),
];

/** The frame an icon `size` pixels wide is drawn in. */
export const appIconFrameFor = (size: number): IAppIconFrame =>
  APP_ICON_FRAMES.find(({ maxSize }) => size <= maxSize) ??
  APP_ICON_FRAMES[APP_ICON_FRAMES.length - 1];
