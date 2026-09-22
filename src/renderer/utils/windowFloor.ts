/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { useTheme } from './theme';

/**
 * Tells the native window what colour the shell's floor is.
 *
 * Two moments show the window's own background with no page in front of it:
 * the frames before the first paint at launch, and the strip Windows opens as
 * the window is resized — which the switch between the app and the player does
 * in one step. Both are the whole window, and with a transparent background
 * both read as an empty pane of glass (Ivan, 2026-09-22). Painted in the
 * shell's own floor they read as the app, a moment before its contents arrive.
 *
 * Read back off `#root` rather than listed here. That element's background IS
 * the floor, so this is the one value by construction instead of a copy that
 * can drift — and because it is read after the cascade it is already resolved
 * to `rgb(...)`, whatever a theme wrote it as. A scene tint that repaints the
 * shell is carried for free.
 */
const RGB = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/;

const hex = (value: number) => value.toString(16).padStart(2, '0');

/** `#rrggbb`, or nothing at all if the floor cannot be read yet. */
export const readWindowFloor = (): string | undefined => {
  const root = document.getElementById('root');
  if (!root) {
    return undefined;
  }
  const match = RGB.exec(getComputedStyle(root).backgroundColor);
  if (!match) {
    return undefined;
  }
  return `#${hex(Number(match[1]))}${hex(Number(match[2]))}${hex(
    Number(match[3]),
  )}`;
};

/**
 * Publishes it on mount and on every theme change.
 *
 * In an effect rather than beside the attribute the theme writes: the theme is
 * applied as soon as its module loads, which in development is before
 * style-loader has put the stylesheet in the document, and the floor would
 * read as whatever an unstyled page computes. An effect runs after the cascade
 * has, every time.
 */
const useWindowFloor = () => {
  const theme = useTheme();
  useEffect(() => {
    const floor = readWindowFloor();
    if (!floor) {
      return;
    }
    // Every optional link is deliberate: tests stub the bridge with a handful
    // of methods, and the window's background is not worth taking a render
    // down for.
    window.electron?.ipcRenderer
      ?.setWindowFloor?.(floor)
      ?.catch(() => undefined);
  }, [theme]);
};

export default useWindowFloor;
