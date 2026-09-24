/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindowConstructorOptions, Point } from 'electron';

/**
 * THE MAC'S OWN WINDOW CONTROLS.
 *
 * FluidEQ draws its own frame, and on Windows the three buttons at the end of
 * the titlebar are its own too. A frameless window on a Mac has no traffic
 * lights at all, so it showed Windows' minimise, maximise and close there and
 * nothing a Mac user reaches for. A hidden title bar keeps the frame the page
 * draws and gives the window AppKit's own three buttons back, which this
 * module places inside the strip the page draws — the titlebar's card in the
 * app, the player's strip in the player — wherever the page says that strip
 * is (`TrafficLightSlot`).
 *
 * The overlay is switched on for one thing: the CSS variable
 * `titlebar-area-x`, which is the system's own measure of the room the three
 * buttons take — their margin on both sides of them — and so the width the
 * page leaves for them without knowing the size of a button on this release
 * of macOS.
 */
export const macWindowOptions = (
  platform: NodeJS.Platform,
  isPlayer: boolean,
): BrowserWindowConstructorOptions =>
  platform === 'darwin'
    ? {
        titleBarStyle: 'hidden',
        titleBarOverlay: true,
        // The player can neither zoom nor go full screen from its green
        // button — the Music app's MiniPlayer is the same — so the button is
        // drawn disabled there. Its visualizer still takes the screen, from
        // the page (`windowModes.applyLimits` lets it for exactly that long).
        fullscreenable: !isPlayer,
      }
    : {};

/**
 * One of AppKit's standard window buttons, in points: 16 tall until macOS 26,
 * 14 from it (Darwin 25). The numbers and the release test are VS Code's
 * (`windowImpl.ts`, `isTahoeOrNewer`), which positions the same buttons in the
 * same way; no API reports the size, and centring them needs it.
 */
export const trafficLightHeight = (darwinRelease: string): number =>
  Number.parseFloat(darwinRelease) >= 25 ? 14 : 16;

/** Where the page says the buttons belong, in its CSS pixels. */
export interface ITrafficLightBand {
  /** The left edge of the first button. */
  left: number;
  /** The line their centres stand on: the middle of the strip they sit in. */
  centreY: number;
  /** The foot of that strip, which a sheet drops down from. */
  bottom: number;
}

/** No window is this tall or wide; anything past it is not a measurement. */
const MAX_CSS_PX = 20_000;

const isCssLength = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= MAX_CSS_PX;

/** The page's `[left, centreY, bottom]`, or nothing if it is not that. */
export const trafficLightBandOf = (
  arg: unknown,
): ITrafficLightBand | undefined => {
  if (!Array.isArray(arg)) {
    return undefined;
  }
  const [left, centreY, bottom] = arg as unknown[];
  if (!isCssLength(left) || !isCssLength(centreY) || !isCssLength(bottom)) {
    return undefined;
  }
  return { left, centreY, bottom };
};

/**
 * The buttons' position and the sheets' offset, in the window's points.
 *
 * The page measures in CSS pixels and AppKit places in points, and the two
 * differ by the page's zoom. The position is the top-left of the first
 * button, so the centre line is taken back by half a button.
 */
export const trafficLightPlacement = (
  band: ITrafficLightBand,
  zoom: number,
  buttonHeight: number,
): { position: Point; sheetOffset: number } => ({
  position: {
    x: Math.round(band.left * zoom),
    y: Math.max(0, Math.round(band.centreY * zoom - buttonHeight / 2)),
  },
  sheetOffset: Math.round(band.bottom * zoom),
});

/**
 * What a double-click on a title bar does on this Mac, from the setting in
 * System Settings › Desktop & Dock ("Double-click a window's title bar to"),
 * which AppKit keeps as `AppleActionOnDoubleClick`.
 *
 * The rule is AppKit's, as Chromium applies it to a page's own drag handles
 * (`native_widget_mac_nswindow.mm`): nothing set, "Maximize" or "Fill" zoom
 * the window, "Minimize" minimises it, and "None" or a word it does not know
 * does nothing. Electron has no Fill of its own; its maximise fills the
 * screen's visible frame, which is what Fill asks for. Electron answers an
 * unset string default with an empty one.
 */
export const titlebarDoubleClickAction = (
  preference: string | undefined,
): 'zoom' | 'minimize' | 'none' => {
  if (
    preference === undefined ||
    preference === '' ||
    preference === 'Maximize' ||
    preference === 'Fill'
  ) {
    return 'zoom';
  }
  return preference === 'Minimize' ? 'minimize' : 'none';
};
